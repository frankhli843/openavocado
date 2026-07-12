/**
 * Tests for the deterministic assessment adapter — the local, no-LLM path that
 * turns an answer into tag + difficulty + mastery evidence.
 */
import { describe, it, expect } from "vitest";
import {
  deterministicAssessmentAdapter,
  normalizeTagName,
  getAssessmentAdapter,
  type SubjectTagRef,
} from "@/lib/assessment";

const SUBJECT_TAGS: SubjectTagRef[] = [
  { id: 1, name: "bayes-theorem", tag_type: "concept" },
  { id: 2, name: "base-rate-fallacy", tag_type: "misconception" },
];

describe("normalizeTagName", () => {
  it("lowercases, hyphenates, and strips punctuation", () => {
    expect(normalizeTagName("Base Rate Fallacy!")).toBe("base-rate-fallacy");
    expect(normalizeTagName("  P(A|B) reasoning  ")).toBe("p-a-b-reasoning");
    expect(normalizeTagName("already-normalized")).toBe("already-normalized");
  });
  it("is idempotent", () => {
    const once = normalizeTagName("Conditional Probability");
    expect(normalizeTagName(once)).toBe(once);
  });
});

describe("deterministic MC assessment", () => {
  it("correct answer → strength signal with difficulty-scaled confidence", () => {
    const out = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "What is the prior?",
      concept: "bayes-theorem",
      difficulty: "hard",
      mc_outcome: "correct",
      answer_text: "the base rate",
      subject_tags: SUBJECT_TAGS,
    });
    expect(out.outcome).toBe("correct");
    expect(out.signal.signal_type).toBe("strength");
    expect(out.signal.difficulty).toBe("hard");
    expect(out.signal.confidence).toBeGreaterThan(0.8);
    // Matched the existing subject tag rather than creating a new one.
    expect(out.tags.some((t) => t.name === "bayes-theorem" && t.existing)).toBe(true);
    expect(out.tags.every((t) => t.existing)).toBe(true);
  });

  it('"I don\'t know" → review_needed signal with very low confidence', () => {
    const out = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "What is the prior?",
      concept: "bayes-theorem",
      difficulty: "medium",
      mc_outcome: "idk",
      answer_text: "I'm not sure / I don't know",
      subject_tags: SUBJECT_TAGS,
    });
    expect(out.outcome).toBe("idk");
    expect(out.signal.signal_type).toBe("review_needed");
    expect(out.signal.confidence).toBeLessThan(0.2);
    expect(out.signal.difficulty).toBe("medium");
  });

  it("incorrect answer → misconception signal", () => {
    const out = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "q",
      concept: "bayes-theorem",
      difficulty: "easy",
      mc_outcome: "incorrect",
      answer_text: "wrong choice",
      subject_tags: SUBJECT_TAGS,
    });
    expect(out.outcome).toBe("incorrect");
    expect(out.signal.signal_type).toBe("misconception");
  });

  it("creates a new tag when the concept is outside the subject vocabulary", () => {
    const out = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "q",
      concept: "Sequential Testing",
      difficulty: "hard",
      mc_outcome: "incorrect",
      answer_text: "x",
      subject_tags: SUBJECT_TAGS,
    });
    const created = out.tags.find((t) => !t.existing);
    expect(created).toBeDefined();
    expect(created!.name).toBe("sequential-testing");
    // A wrong/IDK answer reveals a misconception tag type.
    expect(created!.tag_type).toBe("misconception");
  });
});

describe("deterministic freeform assessment", () => {
  it("substantive answer → strength signal, outcome 'assessed'", () => {
    const out = deterministicAssessmentAdapter.assess({
      question_type: "freeform",
      question_text: "Explain conditioning.",
      concept: "conditional-probability",
      difficulty: "medium",
      answer_text:
        "Conditioning restricts the sample space to outcomes where the condition holds, then measures the event of interest inside that smaller world.",
      subject_tags: SUBJECT_TAGS,
    });
    expect(out.outcome).toBe("assessed");
    expect(out.signal.signal_type).toBe("strength");
  });

  it("uncertain answer → review_needed signal", () => {
    const out = deterministicAssessmentAdapter.assess({
      question_type: "freeform",
      question_text: "Explain conditioning.",
      concept: "conditional-probability",
      answer_text: "I'm not sure, no idea honestly",
      subject_tags: SUBJECT_TAGS,
    });
    expect(out.signal.signal_type).toBe("review_needed");
    expect(out.signal.confidence).toBeLessThanOrEqual(0.3);
  });

  it("empty answer → review_needed signal", () => {
    const out = deterministicAssessmentAdapter.assess({
      question_type: "diagnostic",
      question_text: "What felt unclear?",
      answer_text: "",
      subject_tags: SUBJECT_TAGS,
    });
    expect(out.signal.signal_type).toBe("review_needed");
  });
});

describe("getAssessmentAdapter", () => {
  it("returns the deterministic adapter by default", () => {
    expect(getAssessmentAdapter().name).toBe("deterministic");
  });
});
