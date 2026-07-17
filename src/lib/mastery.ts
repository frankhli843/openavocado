/**
 * Per-subject mastery computation.
 *
 * Produces a single 0–100 mastery score plus the supporting context a learner
 * needs to understand what it means: where it came from, which direction it is
 * moving, a short history for a sparkline, and the qualitative signal counts
 * behind it. Used by both the dashboard cards and the subject detail page so
 * the number is consistent everywhere.
 *
 * Multi-user safe: every query is scoped by both subject_id and learner_id.
 */
import type Database from "better-sqlite3";
import type { SubjectMastery, SignalType } from "@/types";
import { computeConceptEvidence, type ConceptEvidenceSummary } from "@/lib/concept-evidence";

const EMPTY_COUNTS = {
  strength: 0,
  weak_spot: 0,
  misconception: 0,
  review_needed: 0,
  ready_to_advance: 0,
};

export function computeSubjectMastery(
  db: Database.Database,
  subjectId: number,
  learnerId: number
): SubjectMastery {
  // Mastery time series, oldest to newest, 0 to 100.
  const masteryPoints = db
    .prepare(
      `SELECT value FROM progress_points
       WHERE subject_id = ? AND learner_id = ? AND metric = 'mastery'
       ORDER BY recorded_at ASC`
    )
    .all(subjectId, learnerId) as Array<{ value: number }>;

  const signals = db
    .prepare(
      `SELECT signal_type, confidence FROM mastery_signals
       WHERE subject_id = ? AND learner_id = ?`
    )
    .all(subjectId, learnerId) as Array<{ signal_type: SignalType; confidence: number | null }>;

  const signal_counts = { ...EMPTY_COUNTS };
  for (const s of signals) {
    if (s.signal_type in signal_counts) {
      signal_counts[s.signal_type as keyof typeof signal_counts]++;
    }
  }

  const history = masteryPoints.map((p) => Math.round(p.value));

  let score: number | null = null;
  let source: SubjectMastery["source"] = "none";

  if (history.length > 0) {
    score = history[history.length - 1];
    source = "progress_points";
  } else if (signals.length > 0) {
    const withConf = signals.filter((s) => typeof s.confidence === "number");
    if (withConf.length > 0) {
      const avg = withConf.reduce((sum, s) => sum + (s.confidence ?? 0), 0) / withConf.length;
      score = Math.round(avg * 100);
      source = "mastery_signals";
    }
  }

  // Trend from the last two recorded mastery points.
  let trend: SubjectMastery["trend"] = "unknown";
  let delta: number | null = null;
  if (history.length >= 2) {
    delta = history[history.length - 1] - history[history.length - 2];
    trend = delta > 1 ? "up" : delta < -1 ? "down" : "flat";
  } else if (history.length === 1) {
    trend = "flat";
    delta = 0;
  }

  // Resolution-aware review evidence: gap notes should reflect current reality,
  // not every weakness ever flagged. A concept that was weak but has since been
  // answered correctly at equal-or-higher difficulty no longer counts as a gap.
  const evidence = computeConceptEvidence(db, subjectId, learnerId);

  return {
    score,
    source,
    trend,
    delta,
    history,
    explanation: buildExplanation(score, source, trend, history, evidence.summary),
    signal_counts,
  };
}

/**
 * Describe the recent run of progress points beyond the last-two-point delta.
 * Uses the same +/-1 noise band the trend field already uses (no new numeric
 * thresholds) and walks back over the trailing run of same-direction steps, so
 * "rising", "falling", or "plateaued" reflects a window, not a single step.
 */
export function summarizeRecentTrend(
  history: number[]
): { direction: "rising" | "falling" | "plateaued" | "mixed" | "unknown"; windowLength: number } {
  if (history.length < 2) return { direction: "unknown", windowLength: history.length };

  const dir = (step: number): "up" | "down" | "flat" => (step > 1 ? "up" : step < -1 ? "down" : "flat");
  const steps: Array<"up" | "down" | "flat"> = [];
  for (let i = history.length - 1; i > 0; i--) steps.push(dir(history[i] - history[i - 1]));

  // Trailing run of a consistent direction (flat steps extend a run of any dir).
  let runDir: "up" | "down" | "flat" | null = null;
  let run = 0;
  for (const s of steps) {
    if (runDir === null) {
      runDir = s;
      run = 1;
    } else if (s === runDir || s === "flat" || runDir === "flat") {
      if (runDir === "flat" && s !== "flat") runDir = s;
      run++;
    } else {
      break;
    }
  }

  const windowLength = run + 1; // points involved in the trailing run
  if (runDir === "up") return { direction: "rising", windowLength };
  if (runDir === "down") return { direction: "falling", windowLength };
  if (runDir === "flat") return { direction: "plateaued", windowLength };
  return { direction: "mixed", windowLength: history.length };
}

function buildExplanation(
  score: number | null,
  source: SubjectMastery["source"],
  trend: SubjectMastery["trend"],
  history: number[],
  evidence: ConceptEvidenceSummary
): string {
  if (score === null) {
    return "No mastery data yet. Complete a lesson and its assessment to start tracking mastery for this subject.";
  }

  const band =
    score >= 80 ? "strong mastery" : score >= 55 ? "solid competence" : score >= 30 ? "early familiarity" : "just getting started";

  const basis =
    source === "progress_points"
      ? "based on your recorded progress over time"
      : "estimated from your mastery signals so far";

  // Prefer a windowed description over the single last-two-point delta.
  const recent = summarizeRecentTrend(history);
  let move = "";
  if (recent.direction === "rising") {
    move = ` It has been rising across your last ${recent.windowLength} recorded points.`;
  } else if (recent.direction === "falling") {
    move = ` It has been falling across your last ${recent.windowLength} recorded points, so a review lesson would help.`;
  } else if (recent.direction === "plateaued") {
    move = ` It has plateaued across your last ${recent.windowLength} recorded points.`;
  } else if (recent.direction === "mixed") {
    move =
      trend === "up"
        ? " Its recent points have moved both ways but ticked up most recently."
        : trend === "down"
        ? " Its recent points have moved both ways and dipped most recently."
        : " Its recent points have moved both ways.";
  }

  // Only UNRESOLVED gaps are worth revisiting; resolved weaknesses are excluded.
  const gaps = evidence.unresolved_gap_count;
  let gapNote = "";
  if (gaps > 0) {
    const parts: string[] = [];
    if (evidence.fresh_misconception > 0) parts.push(`${evidence.fresh_misconception} fresh misconception${evidence.fresh_misconception === 1 ? "" : "s"}`);
    if (evidence.stale_weak_spot > 0) parts.push(`${evidence.stale_weak_spot} stale weak spot${evidence.stale_weak_spot === 1 ? "" : "s"}`);
    const breakdown = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    gapNote = ` There ${gaps === 1 ? "is" : "are"} ${gaps} unresolved gap${gaps === 1 ? "" : "s"} to revisit${breakdown}.`;
  }

  return `A ${score}% score reflects ${band}, ${basis}.${move}${gapNote}`;
}
