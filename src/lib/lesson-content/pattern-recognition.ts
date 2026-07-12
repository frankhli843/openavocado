import type { LessonPartPracticeQuestion } from "./schema";

/**
 * Partial-credit grading for a `pattern_recognition` practice question.
 *
 * A learner reads a problem and selects which algorithmic patterns apply. The
 * question distinguishes PRIMARY patterns (required to demonstrate recognition)
 * from SECONDARY patterns (legitimate but bonus). Grading rules:
 *
 *   - PASS (`correct`) iff every primary pattern is selected AND no distractor
 *     (a choice that is neither primary nor secondary) is selected. Missing a
 *     secondary pattern never fails the question.
 *   - `score` is continuous in [0, 1]:
 *       primaryFraction + secondaryBonus - wrongPenalty, clamped.
 *     where primaryFraction = primaryHit / |primary|,
 *           secondaryBonus  = (secondaryHit / |secondary|) * BONUS_WEIGHT,
 *           wrongPenalty    = wrongSelected * WRONG_PENALTY.
 *
 * This is a pure function so it is unit-testable and shared by the renderer.
 */

/** Bonus contributed by fully identifying every secondary pattern. */
export const SECONDARY_BONUS_WEIGHT = 0.15;
/** Score deducted per distractor pattern selected. */
export const WRONG_SELECTION_PENALTY = 0.25;

export interface PatternRecognitionGrade {
  /** True only when all primary patterns are selected and no distractor is. */
  correct: boolean;
  /** Continuous partial-credit score in [0, 1]. */
  score: number;
  /** Primary choices the learner correctly selected. */
  primaryHit: string[];
  /** Primary choices the learner failed to select. */
  primaryMissed: string[];
  /** Secondary (bonus) choices the learner selected. */
  secondaryHit: string[];
  /** Selected choices that are neither primary nor secondary. */
  wrongSelected: string[];
  /** Human-readable feedback describing the result. */
  text: string;
}

function pickChoices(choices: string[], indices: number[]): string[] {
  return indices
    .map((idx) => choices[idx])
    .filter((choice): choice is string => typeof choice === "string");
}

export function gradePatternRecognition(
  choices: string[],
  primaryIndices: number[],
  secondaryIndices: number[],
  selected: string[]
): PatternRecognitionGrade {
  const primary = pickChoices(choices, primaryIndices);
  const secondary = pickChoices(choices, secondaryIndices);
  const primarySet = new Set(primary);
  const secondarySet = new Set(secondary);
  const selectedSet = new Set(selected);

  const primaryHit = primary.filter((choice) => selectedSet.has(choice));
  const primaryMissed = primary.filter((choice) => !selectedSet.has(choice));
  const secondaryHit = secondary.filter((choice) => selectedSet.has(choice));
  const wrongSelected = [...selectedSet].filter(
    (choice) => !primarySet.has(choice) && !secondarySet.has(choice)
  );

  const primaryFraction = primary.length > 0 ? primaryHit.length / primary.length : 0;
  const secondaryBonus =
    secondary.length > 0 ? (secondaryHit.length / secondary.length) * SECONDARY_BONUS_WEIGHT : 0;
  const wrongPenalty = wrongSelected.length * WRONG_SELECTION_PENALTY;
  const score = Math.max(0, Math.min(1, primaryFraction + secondaryBonus - wrongPenalty));

  const correct = primaryMissed.length === 0 && wrongSelected.length === 0;

  return {
    correct,
    score,
    primaryHit,
    primaryMissed,
    secondaryHit,
    wrongSelected,
    text: buildFeedback({ correct, primaryMissed, wrongSelected, secondaryHit, secondary }),
  };
}

function buildFeedback({
  correct,
  primaryMissed,
  wrongSelected,
  secondaryHit,
  secondary,
}: {
  correct: boolean;
  primaryMissed: string[];
  wrongSelected: string[];
  secondaryHit: string[];
  secondary: string[];
}): string {
  if (correct) {
    if (secondary.length > 0 && secondaryHit.length === secondary.length) {
      return "Correct — you named every primary pattern and all the bonus patterns.";
    }
    if (secondary.length > 0) {
      const missedBonus = secondary.length - secondaryHit.length;
      return `Correct on the required pattern${
        missedBonus > 0 ? `; ${missedBonus} bonus pattern${missedBonus > 1 ? "s" : ""} also applied here` : ""
      }.`;
    }
    return "Correct — you identified the required pattern.";
  }
  const parts: string[] = [];
  if (primaryMissed.length > 0) {
    parts.push(`Missing required pattern${primaryMissed.length > 1 ? "s" : ""}: ${primaryMissed.join(", ")}.`);
  }
  if (wrongSelected.length > 0) {
    parts.push(`These don't apply here: ${wrongSelected.join(", ")}.`);
  }
  return `Not quite. ${parts.join(" ")}`.trim();
}

/**
 * Resolve a pattern_recognition question's primary + secondary choice strings,
 * used by the renderer for correctness highlighting.
 */
export function patternRecognitionCorrectChoices(question: LessonPartPracticeQuestion): {
  primary: Set<string>;
  secondary: Set<string>;
} {
  const choices = question.choices ?? [];
  return {
    primary: new Set(pickChoices(choices, question.primary_indices ?? [])),
    secondary: new Set(pickChoices(choices, question.secondary_indices ?? [])),
  };
}
