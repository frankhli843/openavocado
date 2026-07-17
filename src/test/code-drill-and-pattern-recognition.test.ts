/**
 * Tests for the two Phase-3 features of the Coding Interview Mastery subject:
 *   Feature A — code_drill activity (timed practice mode with progressive hints)
 *   Feature B — pattern_recognition question type (multi-select, partial credit)
 *
 * Covers the pure logic (timing/hint unlock, partial-credit grading, drill
 * evidence metadata) and the schema validators for both new content shapes.
 */
import { describe, it, expect } from "vitest";
import {
  validateCodeDrillContent,
  validateLessonPartPracticeContent,
  type CodeDrillHint,
} from "../lib/lesson-content/schema";
import {
  elapsedPercent,
  unlockedHintCount,
  unlockedHints,
  remainingSeconds,
  isOvertime,
  formatClock,
  buildDrillEvidenceMetadata,
} from "../lib/lesson-content/code-drill";
import {
  gradePatternRecognition,
  patternRecognitionCorrectChoices,
  SECONDARY_BONUS_WEIGHT,
  WRONG_SELECTION_PENALTY,
} from "../lib/lesson-content/pattern-recognition";

// ─── Feature A: code_drill timing + hint unlock ──────────────────────────────

const HINTS: CodeDrillHint[] = [
  { unlock_at_pct: 33, text: "Consider a sliding window." },
  { unlock_at_pct: 66, text: "Shrink the window when the constraint breaks." },
  { unlock_at_pct: 100, text: "Track the best window length as you go." },
];

describe("code-drill timing", () => {
  it("computes elapsed percent against the target", () => {
    expect(elapsedPercent(600, 0)).toBe(0);
    expect(elapsedPercent(600, 300)).toBe(50);
    expect(elapsedPercent(600, 600)).toBe(100);
    expect(elapsedPercent(600, 900)).toBe(150); // overtime is uncapped
  });

  it("treats a non-positive target as fully unlocked (never permanently locked)", () => {
    expect(elapsedPercent(0, 0)).toBe(100);
    expect(elapsedPercent(-5, 10)).toBe(100);
  });

  it("never yields a negative percent for negative elapsed", () => {
    expect(elapsedPercent(600, -30)).toBe(0);
  });

  it("unlocks hints progressively at 33 / 66 / 100 percent thresholds", () => {
    expect(unlockedHintCount(HINTS, 600, 0)).toBe(0);
    expect(unlockedHintCount(HINTS, 600, 197)).toBe(0); // 32.8% — first still locked
    expect(unlockedHintCount(HINTS, 600, 198)).toBe(1); // 33.0% — first unlocks
    expect(unlockedHintCount(HINTS, 600, 400)).toBe(2); // 66.6%
    expect(unlockedHintCount(HINTS, 600, 600)).toBe(3); // 100%
    expect(unlockedHintCount(HINTS, 600, 999)).toBe(3); // capped at total
  });

  it("returns unlocked hint objects in ascending threshold order", () => {
    const scrambled: CodeDrillHint[] = [HINTS[2], HINTS[0], HINTS[1]];
    const shown = unlockedHints(scrambled, 600, 400);
    expect(shown.map((h) => h.unlock_at_pct)).toEqual([33, 66]);
  });

  it("handles drills with no hints", () => {
    expect(unlockedHintCount([], 600, 600)).toBe(0);
    expect(unlockedHintCount(undefined, 600, 600)).toBe(0);
    expect(unlockedHints(undefined, 600, 600)).toEqual([]);
  });

  it("computes remaining seconds clamped at zero and detects overtime", () => {
    expect(remainingSeconds(600, 100)).toBe(500);
    expect(remainingSeconds(600, 600)).toBe(0);
    expect(remainingSeconds(600, 900)).toBe(0);
    expect(isOvertime(600, 599)).toBe(false);
    expect(isOvertime(600, 601)).toBe(true);
  });

  it("formats a countdown clock as mm:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(600)).toBe("10:00");
    expect(formatClock(-10)).toBe("0:00");
  });

  it("builds drill evidence metadata with normalized timing fields", () => {
    const meta = buildDrillEvidenceMetadata({
      pattern: "sliding-window",
      targetSeconds: 600,
      timeTakenSeconds: 742.6,
      hintsUsed: 2,
      hintsTotal: 3,
      attempts: 1,
      passed: true,
    });
    expect(meta).toMatchObject({
      activity_mode: "code_drill",
      pattern: "sliding-window",
      target_seconds: 600,
      time_taken_seconds: 743,
      hints_used: 2,
      hints_total: 3,
      attempts: 1,
      overtime: true,
      outcome: "passed",
    });
  });

  it("records a failed under-time drill without marking overtime", () => {
    const meta = buildDrillEvidenceMetadata({
      pattern: "two-pointer",
      targetSeconds: 600,
      timeTakenSeconds: 120,
      hintsUsed: 0,
      hintsTotal: 3,
      attempts: 2,
      passed: false,
    });
    expect(meta.overtime).toBe(false);
    expect(meta.outcome).toBe("failed");
    expect(meta.attempts).toBe(2);
  });
});

// ─── Feature A: validateCodeDrillContent ─────────────────────────────────────

function validDrill() {
  return {
    pattern: "sliding-window",
    prompt: "Return the length of the longest substring without repeating characters.",
    target_seconds: 600,
    difficulty: "medium" as const,
    starter_code: "def solve(s):\n    pass\n",
    tests: [
      { id: "t1", description: "empty string -> 0", assert: "solve('') == 0" },
      { id: "t2", description: "abcabcbb -> 3", assert: "solve('abcabcbb') == 3" },
    ],
    hints: HINTS,
    solution: "def solve(s): ...",
  };
}

describe("validateCodeDrillContent", () => {
  it("accepts a well-formed drill", () => {
    expect(validateCodeDrillContent(validDrill())).toEqual({ valid: true, errors: [] });
  });

  it("requires a pattern, prompt and in-range target time", () => {
    expect(validateCodeDrillContent({ ...validDrill(), pattern: "" }).valid).toBe(false);
    expect(validateCodeDrillContent({ ...validDrill(), prompt: "  " }).valid).toBe(false);
    expect(validateCodeDrillContent({ ...validDrill(), target_seconds: 30 }).valid).toBe(false);
    expect(validateCodeDrillContent({ ...validDrill(), target_seconds: 5000 }).valid).toBe(false);
  });

  it("requires at least one test with id/description/assert", () => {
    expect(validateCodeDrillContent({ ...validDrill(), tests: [] }).valid).toBe(false);
    const bad = validateCodeDrillContent({
      ...validDrill(),
      tests: [{ id: "t1", description: "", assert: "solve('') == 0" }],
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/description/);
  });

  it("rejects duplicate test ids", () => {
    const r = validateCodeDrillContent({
      ...validDrill(),
      tests: [
        { id: "t1", description: "a", assert: "solve('') == 0" },
        { id: "t1", description: "b", assert: "solve('a') == 1" },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/duplicate id/);
  });

  it("requires hint thresholds to strictly increase", () => {
    const r = validateCodeDrillContent({
      ...validDrill(),
      hints: [
        { unlock_at_pct: 66, text: "later hint first" },
        { unlock_at_pct: 33, text: "earlier hint second" },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/strictly increase/);
  });

  it("rejects out-of-range hint percentages", () => {
    expect(
      validateCodeDrillContent({ ...validDrill(), hints: [{ unlock_at_pct: 0, text: "x" }] }).valid
    ).toBe(false);
    expect(
      validateCodeDrillContent({ ...validDrill(), hints: [{ unlock_at_pct: 120, text: "x" }] }).valid
    ).toBe(false);
  });
});

// ─── Feature B: pattern_recognition partial-credit grading ───────────────────

// choices: 0 sliding-window (primary), 1 two-pointer (secondary),
//          2 dynamic-programming (distractor), 3 binary-search (distractor)
const CHOICES = ["Sliding Window", "Two Pointer", "Dynamic Programming", "Binary Search"];
const PRIMARY = [0];
const SECONDARY = [1];

describe("gradePatternRecognition", () => {
  it("passes when the primary pattern is selected and nothing wrong is", () => {
    const g = gradePatternRecognition(CHOICES, PRIMARY, SECONDARY, ["Sliding Window"]);
    expect(g.correct).toBe(true);
    expect(g.score).toBe(1); // full primary, no bonus taken, no penalty
    expect(g.primaryMissed).toEqual([]);
    expect(g.wrongSelected).toEqual([]);
  });

  it("still passes when a bonus secondary pattern is also selected, and notes the bonus", () => {
    const g = gradePatternRecognition(CHOICES, PRIMARY, SECONDARY, ["Sliding Window", "Two Pointer"]);
    expect(g.correct).toBe(true);
    expect(g.secondaryHit).toEqual(["Two Pointer"]);
    // primaryFraction(1) + secondaryBonus(0.15) clamped to 1
    expect(g.score).toBe(1);
    expect(g.text).toMatch(/bonus/i);
  });

  it("fails when the required primary pattern is missing", () => {
    const g = gradePatternRecognition(CHOICES, PRIMARY, SECONDARY, ["Two Pointer"]);
    expect(g.correct).toBe(false);
    expect(g.primaryMissed).toEqual(["Sliding Window"]);
    // primaryFraction 0 + bonus 0.15
    expect(g.score).toBeCloseTo(SECONDARY_BONUS_WEIGHT, 5);
    expect(g.text).toMatch(/Missing required/i);
  });

  it("fails and penalizes when a distractor is selected alongside the primary", () => {
    const g = gradePatternRecognition(CHOICES, PRIMARY, SECONDARY, ["Sliding Window", "Dynamic Programming"]);
    expect(g.correct).toBe(false);
    expect(g.wrongSelected).toEqual(["Dynamic Programming"]);
    // primaryFraction 1 - wrongPenalty 0.25
    expect(g.score).toBeCloseTo(1 - WRONG_SELECTION_PENALTY, 5);
    expect(g.text).toMatch(/don't apply/i);
  });

  it("supports multiple required primary patterns (all needed to pass)", () => {
    const primaries = [0, 1];
    const half = gradePatternRecognition(CHOICES, primaries, [], ["Sliding Window"]);
    expect(half.correct).toBe(false);
    expect(half.score).toBeCloseTo(0.5, 5);
    const full = gradePatternRecognition(CHOICES, primaries, [], ["Sliding Window", "Two Pointer"]);
    expect(full.correct).toBe(true);
    expect(full.score).toBe(1);
  });

  it("clamps score to [0,1] even with many wrong selections", () => {
    const g = gradePatternRecognition(CHOICES, PRIMARY, [], [
      "Dynamic Programming",
      "Binary Search",
      "Two Pointer",
    ]);
    expect(g.score).toBe(0);
    expect(g.correct).toBe(false);
  });

  it("resolves primary/secondary correct-choice sets for the renderer", () => {
    const sets = patternRecognitionCorrectChoices({
      id: "q1",
      type: "pattern_recognition",
      prompt: "…",
      concept: "pattern-recognition",
      difficulty: "medium",
      choices: CHOICES,
      primary_indices: PRIMARY,
      secondary_indices: SECONDARY,
    });
    expect([...sets.primary]).toEqual(["Sliding Window"]);
    expect([...sets.secondary]).toEqual(["Two Pointer"]);
  });
});

// ─── Feature B: pattern_recognition schema validation ────────────────────────

/**
 * A full lesson-part practice payload that satisfies the base requirements
 * (3 select_all incl. none, some, and all true cases, an ordering, a written) plus one
 * pattern_recognition question, so we can assert the new type validates in situ.
 */
function practiceWith(prQuestion: Record<string, unknown>) {
  return {
    questions: [
      {
        id: "so1",
        type: "select_one",
        prompt: "Pick the best fit",
        concept: "c",
        difficulty: "easy",
        choices: ["A", "B", "C"],
        correct_index: 1,
      },
      {
        id: "sa1",
        type: "select_all",
        prompt: "Which are true?",
        concept: "c",
        difficulty: "easy",
        choices: ["A", "B", "C"],
        correct_indices: [0, 1],
      },
      {
        id: "sa2",
        type: "select_all",
        prompt: "Which apply (none)?",
        concept: "c",
        difficulty: "easy",
        choices: ["X", "Y"],
        correct_indices: [],
      },
      {
        id: "sa3",
        type: "select_all",
        prompt: "Which apply (all)?",
        concept: "c",
        difficulty: "easy",
        choices: ["L", "M", "N"],
        correct_indices: [0, 1, 2],
      },
      {
        id: "ord1",
        type: "ordering",
        prompt: "Order these",
        concept: "c",
        difficulty: "easy",
        items: ["one", "two", "three"],
        correct_order: ["one", "two", "three"],
      },
      {
        id: "wr1",
        type: "written",
        prompt: "Explain the mechanism in your own words.",
        concept: "c",
        difficulty: "medium",
        actual_answer: "A substantive reference answer used for LLM grading here.",
        rubric: "Mentions the key mechanism and why it works in this context.",
      },
      prQuestion,
    ],
  };
}

function validPrQuestion() {
  return {
    id: "pr1",
    type: "pattern_recognition",
    prompt: "Longest substring without repeats — which patterns apply?",
    concept: "pattern-recognition",
    difficulty: "medium",
    choices: ["Sliding Window", "Two Pointer", "Dynamic Programming", "Binary Search"],
    primary_indices: [0],
    secondary_indices: [1],
  };
}

describe("validateLessonPartPracticeContent — pattern_recognition", () => {
  it("accepts a valid pattern_recognition question", () => {
    const r = validateLessonPartPracticeContent(practiceWith(validPrQuestion()));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("requires a non-empty primary_indices array", () => {
    const r = validateLessonPartPracticeContent(
      practiceWith({ ...validPrQuestion(), primary_indices: [] })
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/non-empty primary_indices/);
  });

  it("rejects out-of-range primary indices", () => {
    const r = validateLessonPartPracticeContent(
      practiceWith({ ...validPrQuestion(), primary_indices: [9] })
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/out-of-range/);
  });

  it("rejects secondary indices overlapping primary", () => {
    const r = validateLessonPartPracticeContent(
      practiceWith({ ...validPrQuestion(), primary_indices: [0], secondary_indices: [0] })
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/disjoint/);
  });

  it("rejects an authored 'none of these' choice", () => {
    const r = validateLessonPartPracticeContent(
      practiceWith({
        ...validPrQuestion(),
        choices: ["Sliding Window", "Two Pointer", "None of these"],
        primary_indices: [0],
        secondary_indices: [1],
      })
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/authored "none" choice/);
  });

  it("rejects correct_indices/correct_index on a pattern_recognition question", () => {
    const r = validateLessonPartPracticeContent(
      practiceWith({ ...validPrQuestion(), correct_indices: [0] })
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/primary_indices\/secondary_indices/);
  });
});
