import { describe, expect, it } from "vitest";
import type { MultipleChoiceQuestion, MultipleChoiceQuizContent } from "@/lib/lesson-content/schema";
import {
  isIdkChoiceText,
  normalizeQuestionChoiceOrder,
  normalizeQuizChoiceOrder,
} from "@/lib/lesson-content/quiz-choice-order";
import {
  formatQuizProgressLabel,
  formatRetryCount,
} from "@/components/lesson/MultipleChoiceAssessmentSection";

const baseQuestion: MultipleChoiceQuestion = {
  id: "q-correct-first",
  question: "Which answer is right?",
  choices: ["Correct", "Wrong A", "Wrong B", "Wrong C"],
  correct_index: 0,
  explanation: "Correct is right.",
  concept: "choice-order",
  difficulty: "easy",
};

describe("quiz choice ordering", () => {
  it("deterministically shuffles choices and remaps the correct index", () => {
    const first = normalizeQuestionChoiceOrder(baseQuestion, "stable-seed");
    const second = normalizeQuestionChoiceOrder(baseQuestion, "stable-seed");

    expect(first.choices).toEqual(second.choices);
    expect(first.choices).not.toEqual(baseQuestion.choices);
    expect(first.choices[first.correct_index ?? -1]).toBe("Correct");
  });

  it("keeps the virtual I don't know option out of stored choices", () => {
    const quiz: MultipleChoiceQuizContent = {
      questions: [
        {
          ...baseQuestion,
          choices: ["Correct", "Wrong A", "I'm not sure / I don't know", "Wrong B"],
        },
      ],
    };

    const normalized = normalizeQuizChoiceOrder(quiz, "idk-seed");

    expect(normalized.idk_option).toBe(true);
    expect(normalized.questions[0].choices.some(isIdkChoiceText)).toBe(false);
    expect(normalized.questions[0].choices[normalized.questions[0].correct_index ?? -1]).toBe("Correct");
  });

  it("remaps select-all correct indices after shuffling", () => {
    const question: MultipleChoiceQuestion = {
      ...baseQuestion,
      choices: ["Correct A", "Wrong A", "Correct B", "None of the above"],
      allow_multiple_correct: true,
      correct_indices: [0, 2],
    };

    const normalized = normalizeQuestionChoiceOrder(question, "multi-seed");
    const correctAnswers = (normalized.correct_indices ?? []).map((idx) => normalized.choices[idx]).sort();

    expect(correctAnswers).toEqual(["Correct A", "Correct B"]);
    expect(normalized.allow_multiple_correct).toBe(true);
  });
});

describe("quiz progress labels", () => {
  it("shows an over-target streak without rendering a fraction like 5 / 4", () => {
    expect(formatQuizProgressLabel({
      correct: 5,
      threshold: 6,
      streak: 5,
      consecutiveRequired: 4,
    })).toBe("5 in a row (target 4)");
  });

  it("keeps below-target streaks as progress toward the target", () => {
    expect(formatQuizProgressLabel({
      correct: 3,
      threshold: 6,
      streak: 3,
      consecutiveRequired: 4,
    })).toBe("3 / 4 in a row");
  });

  it("pluralizes retry counts", () => {
    expect(formatRetryCount(0)).toBe("");
    expect(formatRetryCount(1)).toBe(" (1 retry)");
    expect(formatRetryCount(2)).toBe(" (2 retries)");
  });
});
