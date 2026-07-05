import type { CodeDrillHint } from "./schema";

/**
 * Pure timing + hint-unlock logic for `code_drill` activities. Kept free of React
 * so it can be unit-tested and reused by the renderer and any evidence writer.
 */

/**
 * Fraction of the target time that has elapsed, as a percent (>= 0, uncapped so
 * overtime reads above 100). Returns 100 when target is non-positive so hints
 * fully unlock rather than staying locked forever on a misconfigured drill.
 */
export function elapsedPercent(targetSeconds: number, elapsedSeconds: number): number {
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) return 100;
  const clampedElapsed = Math.max(0, elapsedSeconds);
  return (clampedElapsed / targetSeconds) * 100;
}

/**
 * How many progressive hints are unlocked at the given elapsed time. A hint
 * unlocks once elapsed reaches its `unlock_at_pct` threshold. Hints are counted
 * in ascending threshold order so an out-of-order array still behaves.
 */
export function unlockedHintCount(
  hints: CodeDrillHint[] | undefined,
  targetSeconds: number,
  elapsedSeconds: number
): number {
  if (!hints || hints.length === 0) return 0;
  const pct = elapsedPercent(targetSeconds, elapsedSeconds);
  return hints.filter((hint) => pct >= hint.unlock_at_pct).length;
}

/** The hint objects unlocked at the given elapsed time, in threshold order. */
export function unlockedHints(
  hints: CodeDrillHint[] | undefined,
  targetSeconds: number,
  elapsedSeconds: number
): CodeDrillHint[] {
  if (!hints || hints.length === 0) return [];
  const pct = elapsedPercent(targetSeconds, elapsedSeconds);
  return [...hints]
    .sort((a, b) => a.unlock_at_pct - b.unlock_at_pct)
    .filter((hint) => pct >= hint.unlock_at_pct);
}

/** Seconds remaining until the target (clamped at 0; never negative). */
export function remainingSeconds(targetSeconds: number, elapsedSeconds: number): number {
  return Math.max(0, Math.floor(targetSeconds - elapsedSeconds));
}

/** Whether the learner has passed the target time. */
export function isOvertime(targetSeconds: number, elapsedSeconds: number): boolean {
  return elapsedSeconds > targetSeconds;
}

/** mm:ss formatting for a countdown display (negative clamps to 0:00). */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export type DrillOutcome = "passed" | "failed";

export interface DrillEvidenceMetadata {
  activity_mode: "code_drill";
  pattern: string;
  target_seconds: number;
  time_taken_seconds: number;
  hints_used: number;
  hints_total: number;
  attempts: number;
  overtime: boolean;
  outcome: DrillOutcome;
}

/**
 * Build the evidence `metadata` payload for a finished drill. This is what gets
 * stashed on the learning_evidence row so the adaptive model can reason about
 * execution speed and hint dependence, not just pass/fail.
 */
export function buildDrillEvidenceMetadata(params: {
  pattern: string;
  targetSeconds: number;
  timeTakenSeconds: number;
  hintsUsed: number;
  hintsTotal: number;
  attempts: number;
  passed: boolean;
}): DrillEvidenceMetadata {
  const timeTaken = Math.max(0, Math.round(params.timeTakenSeconds));
  return {
    activity_mode: "code_drill",
    pattern: params.pattern,
    target_seconds: params.targetSeconds,
    time_taken_seconds: timeTaken,
    hints_used: Math.max(0, Math.round(params.hintsUsed)),
    hints_total: Math.max(0, Math.round(params.hintsTotal)),
    attempts: Math.max(1, Math.round(params.attempts)),
    overtime: isOvertime(params.targetSeconds, timeTaken),
    outcome: params.passed ? "passed" : "failed",
  };
}
