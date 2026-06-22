/**
 * Regression test: every seeded normal lesson must have schema-valid
 * multiple-choice quiz content.
 *
 * The quiz banks are exported from seed.ts as plain constants so this test
 * can validate them without opening a database. If the schema ever changes
 * and a seeded quiz breaks the contract, this test fails — preventing the
 * broken content from reaching the demo or production seed path.
 *
 * Coverage:
 *  - BAYES_MC_QUIZ (Applied Probability & Statistics — lesson 2, Bayes' Theorem)
 *  - SUPPLY_DEMAND_MC_QUIZ (Microeconomics — lesson 1, Supply & Demand)
 *  - CONDITIONAL_PROBABILITY_MC_QUIZ (Applied Probability & Statistics — lesson 1, Conditional Probability)
 *  - IMAGE_PREPROCESSING_MC_QUIZ (GDM Image Preprocessor — lesson 1)
 */
import { describe, it, expect } from "vitest";
import { validateMultipleChoiceQuizContent } from "@/lib/lesson-content/schema";
import {
  BAYES_MC_QUIZ,
  SUPPLY_DEMAND_MC_QUIZ,
  CONDITIONAL_PROBABILITY_MC_QUIZ,
  IMAGE_PREPROCESSING_MC_QUIZ,
} from "@/db/seed";

// Every seeded quiz bank paired with a human-readable label for clear failure messages.
const SEEDED_QUIZZES = [
  {
    label: "CONDITIONAL_PROBABILITY_MC_QUIZ (Applied Probability & Statistics — lesson 1)",
    quiz: CONDITIONAL_PROBABILITY_MC_QUIZ,
  },
  {
    label: "BAYES_MC_QUIZ (Applied Probability & Statistics — lesson 2)",
    quiz: BAYES_MC_QUIZ,
  },
  {
    label: "SUPPLY_DEMAND_MC_QUIZ (Microeconomics — lesson 1)",
    quiz: SUPPLY_DEMAND_MC_QUIZ,
  },
  {
    label: "IMAGE_PREPROCESSING_MC_QUIZ (GDM Image Preprocessor — lesson 1)",
    quiz: IMAGE_PREPROCESSING_MC_QUIZ,
  },
];

describe("Seeded MC quiz schema coverage", () => {
  for (const { label, quiz } of SEEDED_QUIZZES) {
    describe(label, () => {
      it("passes validateMultipleChoiceQuizContent with no errors", () => {
        const result = validateMultipleChoiceQuizContent(quiz);
        if (!result.valid) {
          throw new Error(
            `Schema validation failed for ${label}:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`
          );
        }
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("has enough questions to satisfy the 6-correct pass gate", () => {
        const threshold = quiz.pass_threshold ?? 6;
        expect(quiz.questions.length).toBeGreaterThanOrEqual(
          threshold,
          `${label} has ${quiz.questions.length} questions but pass_threshold is ${threshold} — not enough questions to pass`
        );
      });

      it("has a pass_threshold of 6 or explicitly set", () => {
        const threshold = quiz.pass_threshold ?? 6;
        expect(threshold).toBeGreaterThanOrEqual(6);
      });

      it("has no duplicate question ids", () => {
        const ids = quiz.questions.map((q: { id: string }) => q.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(
          ids.length,
          `${label} has duplicate question ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`
        );
      });

      it("every question has a non-empty concept tag", () => {
        for (const q of quiz.questions as Array<{ id: string; concept: string }>) {
          expect(q.concept?.trim()).toBeTruthy();
        }
      });
    });
  }

  it("covers all 4 expected seeded quiz banks", () => {
    expect(SEEDED_QUIZZES).toHaveLength(4);
    const labels = SEEDED_QUIZZES.map((s) => s.label);
    expect(labels.some((l) => l.includes("CONDITIONAL_PROBABILITY"))).toBe(true);
    expect(labels.some((l) => l.includes("BAYES"))).toBe(true);
    expect(labels.some((l) => l.includes("SUPPLY_DEMAND"))).toBe(true);
    expect(labels.some((l) => l.includes("IMAGE_PREPROCESSING"))).toBe(true);
  });
});
