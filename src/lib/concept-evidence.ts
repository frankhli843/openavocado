/**
 * Per-concept review evidence rollup.
 *
 * Turns the append-only assessment_results + mastery_signals evidence into a
 * queryable, per-concept picture of what the learner should review next and
 * why. This is the artifact the spaced-reinforcement contract needs: instead of
 * the authoring agent re-reading raw signal rows every run, it gets ranked
 * review candidates with resolution already applied.
 *
 * Design constraints (see the project engineering principles):
 *  - Deterministic and pure: takes a better-sqlite3 handle, returns plain
 *    serializable objects. No model calls, no wall-clock reads.
 *  - No blanket numeric thresholds. Review priority is a set of semantic buckets
 *    ordered by evidence recency and outcome mix, not decay constants or fixed
 *    day/lesson cutoffs.
 *  - Resolution is DERIVED, not stored: a weakness that was later answered
 *    correctly at equal-or-higher difficulty is treated as resolved, so gap
 *    counts reflect current reality without a schema migration.
 *
 * Multi-user safe: every query is scoped by both subject_id and learner_id.
 */
import type Database from "better-sqlite3";
import type { SignalType, Difficulty } from "@/types";

/** Weakness signal types that represent a gap the learner may need to revisit. */
const WEAKNESS_SIGNALS: readonly SignalType[] = ["weak_spot", "misconception", "review_needed"];

export type ReviewPriorityBucket =
  | "fresh_misconception"
  | "stale_weak_spot"
  | "untested_recently"
  | "healthy";

export interface OpenSignalCount {
  signal_type: SignalType;
  /** Standing signals of this type (weakness types exclude resolved ones). */
  count: number;
  /** Newest created_at among the counted signals. */
  newest_at: string;
}

export interface ConceptEvidenceRow {
  /** Human-readable concept label (tag name when available, else the concept). */
  concept: string;
  /** Resolved tag name when the evidence is tag-linked, else null. */
  tag: string | null;
  /** Newest assessment_results.created_at for this concept, or null if never tested. */
  last_tested_at: string | null;
  /** Completed lessons since last tested; null when never tested. */
  lessons_since_tested: number | null;
  /** Outcome mix at the most recent testing occasion. */
  recent_correct: number;
  recent_incorrect: number;
  recent_idk: number;
  /** Standing signals by type, weakness types resolution-aware. */
  open_signal_counts: OpenSignalCount[];
  /** Weakness signal types that later evidence has resolved. */
  resolved_signal_types: SignalType[];
  review_priority: ReviewPriorityBucket;
  /** Plain-language reason for the bucket, safe to show a learner. */
  reason: string;
}

export interface ConceptEvidenceSummary {
  total_concepts: number;
  fresh_misconception: number;
  stale_weak_spot: number;
  untested_recently: number;
  healthy: number;
  /** Concepts with at least one UNRESOLVED weakness signal. */
  unresolved_gap_count: number;
}

export interface ConceptEvidenceRollup {
  subject_id: number;
  learner_id: number;
  /** Concepts needing attention, most in need first (excludes healthy). */
  review_candidates: ConceptEvidenceRow[];
  /** Concepts that look solid right now. */
  healthy: ConceptEvidenceRow[];
  summary: ConceptEvidenceSummary;
}

/** Compact, event-friendly slice of the rollup. */
export interface ConceptReviewEvidence {
  /** Ranked review-due concepts, capped for payload size (see displayCap). */
  review_candidates: Array<{
    concept: string;
    review_priority: ReviewPriorityBucket;
    lessons_since_tested: number | null;
    reason: string;
  }>;
  summary: ConceptEvidenceSummary;
}

// ─── Difficulty ordering for resolution ─────────────────────────────────────────

function difficultyRank(d: Difficulty | null | undefined): number {
  switch (d) {
    case "hard":
      return 3;
    case "medium":
      return 2;
    case "easy":
      return 1;
    default:
      return 0; // unspecified difficulty ranks lowest
  }
}

// ─── Row shapes ─────────────────────────────────────────────────────────────────

interface SignalRow {
  id: number;
  signal_type: SignalType;
  concept: string;
  difficulty: Difficulty | null;
  tag_id: number | null;
  created_at: string;
}

interface ResultRow {
  id: number;
  concept: string | null;
  difficulty: Difficulty | null;
  outcome: string;
  created_at: string;
  lesson_id: number | null;
}

interface ConceptBucket {
  key: string;
  concept: string;
  tag: string | null;
  signals: SignalRow[];
  results: ResultRow[];
}

function tagKey(tagId: number): string {
  return `t:${tagId}`;
}

function conceptKey(concept: string): string {
  return `c:${concept.trim().toLowerCase()}`;
}

// ─── Main rollup ────────────────────────────────────────────────────────────────

export function computeConceptEvidence(
  db: Database.Database,
  subjectId: number,
  learnerId: number
): ConceptEvidenceRollup {
  const signals = db
    .prepare(
      `SELECT id, signal_type, concept, difficulty, tag_id, created_at
         FROM mastery_signals
        WHERE subject_id = ? AND learner_id = ?
        ORDER BY created_at ASC`
    )
    .all(subjectId, learnerId) as SignalRow[];

  const results = db
    .prepare(
      `SELECT id, concept, difficulty, outcome, created_at, lesson_id
         FROM assessment_results
        WHERE subject_id = ? AND learner_id = ?
        ORDER BY created_at ASC`
    )
    .all(subjectId, learnerId) as ResultRow[];

  // Tag names for display + result→tags linkage.
  const tagNames = new Map<number, string>();
  for (const t of db.prepare("SELECT id, name FROM tags").all() as Array<{ id: number; name: string }>) {
    tagNames.set(t.id, t.name);
  }
  const resultTags = new Map<number, number[]>();
  for (const rt of db
    .prepare("SELECT result_id, tag_id FROM assessment_result_tags")
    .all() as Array<{ result_id: number; tag_id: number }>) {
    const arr = resultTags.get(rt.result_id) ?? [];
    arr.push(rt.tag_id);
    resultTags.set(rt.result_id, arr);
  }

  // Completed lessons oldest→newest, for lessons_since_tested.
  const completedLessons = db
    .prepare(
      `SELECT id, completed_at FROM lessons
        WHERE subject_id = ? AND status = 'completed' AND completed_at IS NOT NULL
        ORDER BY completed_at ASC`
    )
    .all(subjectId) as Array<{ id: number; completed_at: string }>;

  const buckets = new Map<string, ConceptBucket>();
  const ensure = (key: string, concept: string, tag: string | null): ConceptBucket => {
    let b = buckets.get(key);
    if (!b) {
      b = { key, concept, tag, signals: [], results: [] };
      buckets.set(key, b);
    }
    // Prefer a real concept label over a bare tag-name fallback.
    if ((!b.concept || b.concept === b.tag) && concept && concept !== b.tag) {
      b.concept = concept;
    }
    if (!b.tag && tag) b.tag = tag;
    return b;
  };

  for (const s of signals) {
    if (s.tag_id != null) {
      const tag = tagNames.get(s.tag_id) ?? null;
      ensure(tagKey(s.tag_id), s.concept || tag || "concept", tag).signals.push(s);
    } else if (s.concept && s.concept.trim()) {
      ensure(conceptKey(s.concept), s.concept, null).signals.push(s);
    }
  }

  for (const r of results) {
    const tagIds = resultTags.get(r.id) ?? [];
    if (tagIds.length > 0) {
      for (const tagId of tagIds) {
        const tag = tagNames.get(tagId) ?? null;
        ensure(tagKey(tagId), r.concept || tag || "concept", tag).results.push(r);
      }
    } else if (r.concept && r.concept.trim()) {
      ensure(conceptKey(r.concept), r.concept, null).results.push(r);
    }
  }

  const rows: ConceptEvidenceRow[] = [];
  for (const b of buckets.values()) {
    rows.push(buildRow(b, completedLessons));
  }

  // Priority ordering across buckets, then within-bucket by staleness / recency.
  const bucketOrder: Record<ReviewPriorityBucket, number> = {
    fresh_misconception: 0,
    stale_weak_spot: 1,
    untested_recently: 2,
    healthy: 3,
  };
  const newestSignalAt = (row: ConceptEvidenceRow): string =>
    row.open_signal_counts.reduce((acc, s) => (s.newest_at > acc ? s.newest_at : acc), "");

  rows.sort((a, b) => {
    const bo = bucketOrder[a.review_priority] - bucketOrder[b.review_priority];
    if (bo !== 0) return bo;
    if (a.review_priority === "fresh_misconception") {
      // Freshest misconception signal first.
      return newestSignalAt(b).localeCompare(newestSignalAt(a));
    }
    // stale_weak_spot / untested_recently / healthy: stalest (most lessons since
    // tested) first, treating never-tested as 0 so long-untested rises above it.
    const la = a.lessons_since_tested ?? 0;
    const lb = b.lessons_since_tested ?? 0;
    if (lb !== la) return lb - la;
    return (b.last_tested_at ?? "").localeCompare(a.last_tested_at ?? "");
  });

  const review_candidates = rows.filter((r) => r.review_priority !== "healthy");
  const healthy = rows.filter((r) => r.review_priority === "healthy");

  const summary: ConceptEvidenceSummary = {
    total_concepts: rows.length,
    fresh_misconception: rows.filter((r) => r.review_priority === "fresh_misconception").length,
    stale_weak_spot: rows.filter((r) => r.review_priority === "stale_weak_spot").length,
    untested_recently: rows.filter((r) => r.review_priority === "untested_recently").length,
    healthy: healthy.length,
    unresolved_gap_count: rows.filter((r) =>
      r.open_signal_counts.some((s) => WEAKNESS_SIGNALS.includes(s.signal_type))
    ).length,
  };

  return { subject_id: subjectId, learner_id: learnerId, review_candidates, healthy, summary };
}

function buildRow(b: ConceptBucket, completedLessons: Array<{ id: number; completed_at: string }>): ConceptEvidenceRow {
  const results = b.results;
  const last_tested_at =
    results.length > 0 ? results.reduce((acc, r) => (r.created_at > acc ? r.created_at : acc), results[0].created_at) : null;

  const maxResult =
    results.length > 0 ? results.reduce((acc, r) => (r.created_at > acc.created_at ? r : acc), results[0]) : null;

  // Lessons since last tested = whole completed lessons AFTER the lesson the
  // concept was last exercised in, excluding that lesson itself. Anchor on the
  // tested lesson's own completion time (in production a lesson's completed_at
  // is stamped just after its assessment, so a raw test-timestamp compare would
  // wrongly count the concept's own lesson). Fall back to the test timestamp
  // when the result is not tied to a completed lesson.
  let lessons_since_tested: number | null = null;
  if (last_tested_at !== null) {
    const anchorLesson =
      maxResult?.lesson_id != null
        ? completedLessons.find((l) => l.id === maxResult.lesson_id)
        : undefined;
    const threshold = anchorLesson ? anchorLesson.completed_at : last_tested_at;
    lessons_since_tested = completedLessons.filter((l) => l.completed_at > threshold).length;
  }

  // Recent outcome mix = the most recent testing occasion (its lesson, else its
  // exact timestamp), so a single fresh pass is not diluted by old attempts.
  let recent_correct = 0;
  let recent_incorrect = 0;
  let recent_idk = 0;
  if (results.length > 0 && maxResult) {
    const recent =
      maxResult.lesson_id != null
        ? results.filter((r) => r.lesson_id === maxResult.lesson_id)
        : results.filter((r) => r.created_at === maxResult.created_at);
    for (const r of recent) {
      if (r.outcome === "correct") recent_correct++;
      else if (r.outcome === "incorrect") recent_incorrect++;
      else if (r.outcome === "idk") recent_idk++;
    }
  }

  // Resolution: a weakness signal is resolved when a later correct result exists
  // at equal-or-higher difficulty.
  const isResolved = (s: SignalRow): boolean =>
    results.some(
      (r) =>
        r.outcome === "correct" &&
        r.created_at > s.created_at &&
        difficultyRank(r.difficulty) >= difficultyRank(s.difficulty)
    );

  const openByType = new Map<SignalType, { count: number; newest_at: string }>();
  const resolvedTypes = new Set<SignalType>();
  let hasUnresolvedMisconception = false;
  let hasUnresolvedWeakOrReview = false;

  for (const s of b.signals) {
    const isWeakness = WEAKNESS_SIGNALS.includes(s.signal_type);
    if (isWeakness && isResolved(s)) {
      resolvedTypes.add(s.signal_type);
      continue; // resolved weakness no longer counts as open
    }
    const cur = openByType.get(s.signal_type) ?? { count: 0, newest_at: "" };
    cur.count++;
    if (s.created_at > cur.newest_at) cur.newest_at = s.created_at;
    openByType.set(s.signal_type, cur);
    if (isWeakness) {
      if (s.signal_type === "misconception") hasUnresolvedMisconception = true;
      else hasUnresolvedWeakOrReview = true;
    }
  }

  const open_signal_counts: OpenSignalCount[] = Array.from(openByType.entries())
    .map(([signal_type, v]) => ({ signal_type, count: v.count, newest_at: v.newest_at }))
    .sort((a, b2) => b2.newest_at.localeCompare(a.newest_at));

  let review_priority: ReviewPriorityBucket;
  if (hasUnresolvedMisconception) review_priority = "fresh_misconception";
  else if (hasUnresolvedWeakOrReview) review_priority = "stale_weak_spot";
  else if (last_tested_at === null) review_priority = "untested_recently";
  else if (lessons_since_tested === 0) review_priority = "healthy";
  else review_priority = "untested_recently";

  return {
    concept: b.concept,
    tag: b.tag,
    last_tested_at,
    lessons_since_tested,
    recent_correct,
    recent_incorrect,
    recent_idk,
    open_signal_counts,
    resolved_signal_types: Array.from(resolvedTypes),
    review_priority,
    reason: buildReason(review_priority, b.concept, lessons_since_tested, resolvedTypes.size > 0),
  };
}

function lessonWord(n: number): string {
  return n === 1 ? "lesson" : "lessons";
}

function buildReason(
  bucket: ReviewPriorityBucket,
  concept: string,
  lessonsSince: number | null,
  wasResolved: boolean
): string {
  switch (bucket) {
    case "fresh_misconception":
      return `A misconception about "${concept}" has not been cleared up yet.`;
    case "stale_weak_spot":
      return lessonsSince && lessonsSince > 0
        ? `"${concept}" was shaky and you have not revisited it in ${lessonsSince} ${lessonWord(lessonsSince)}.`
        : `"${concept}" came up shaky in your latest work.`;
    case "untested_recently":
      if (lessonsSince === null) return `"${concept}" was introduced but has not been tested yet.`;
      return `You have not been tested on "${concept}" in ${lessonsSince} ${lessonWord(lessonsSince)}.`;
    case "healthy":
    default:
      return wasResolved
        ? `"${concept}" is looking solid now, you answered it correctly after an earlier stumble.`
        : `"${concept}" is looking solid.`;
  }
}

/**
 * Compact, serializable slice for the completion event and adapters. The cap is
 * a payload/display size guard, not a behavioral cutoff; the full rollup and the
 * summary counts remain available for surfaces that want everything.
 */
export function toReviewEvidence(rollup: ConceptEvidenceRollup, displayCap = 8): ConceptReviewEvidence {
  return {
    review_candidates: rollup.review_candidates.slice(0, displayCap).map((r) => ({
      concept: r.concept,
      review_priority: r.review_priority,
      lessons_since_tested: r.lessons_since_tested,
      reason: r.reason,
    })),
    summary: rollup.summary,
  };
}

/** An empty review-evidence payload, for fixtures and no-evidence paths. */
export function emptyConceptReviewEvidence(): ConceptReviewEvidence {
  return {
    review_candidates: [],
    summary: {
      total_concepts: 0,
      fresh_misconception: 0,
      stale_weak_spot: 0,
      untested_recently: 0,
      healthy: 0,
      unresolved_gap_count: 0,
    },
  };
}

/** Convenience: compute the event-shaped review evidence directly. */
export function computeConceptReviewEvidence(
  db: Database.Database,
  subjectId: number,
  learnerId: number,
  displayCap = 8
): ConceptReviewEvidence {
  return toReviewEvidence(computeConceptEvidence(db, subjectId, learnerId), displayCap);
}
