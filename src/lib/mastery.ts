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
  // Mastery time-series (oldest → newest), 0–100.
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

  return {
    score,
    source,
    trend,
    delta,
    history,
    explanation: buildExplanation(score, source, trend, signal_counts),
    signal_counts,
  };
}

function buildExplanation(
  score: number | null,
  source: SubjectMastery["source"],
  trend: SubjectMastery["trend"],
  counts: typeof EMPTY_COUNTS
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

  const move =
    trend === "up"
      ? " It has been trending up recently."
      : trend === "down"
      ? " It has dipped recently — a review lesson would help."
      : trend === "flat"
      ? " It has held steady recently."
      : "";

  const gaps = counts.weak_spot + counts.misconception + counts.review_needed;
  const gapNote = gaps > 0 ? ` There ${gaps === 1 ? "is" : "are"} ${gaps} flagged gap${gaps === 1 ? "" : "s"} to revisit.` : "";

  return `A ${score}% score reflects ${band}, ${basis}.${move}${gapNote}`;
}
