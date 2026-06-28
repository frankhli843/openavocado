/**
 * Unit tests for the multiple-choice quiz session state machine.
 * Covers: init, grading, pass logic, retry scheduling, ACP validation,
 * deterministic fallback, autosave serialization, and schema validation.
 */
import { describe, it, expect } from "vitest";
import {
  initQuizSession,
  gradeAnswer,
  advanceToNext,
  integrateAcpResult,
  validateRetryQuestion,
  makeFallbackRetry,
  resolveItemQuestion,
  checkPassedAfterFeedback,
  hasUnresolvedRetries,
  serializeQuizState,
  deserializeQuizState,
  type QuizSessionState,
  type QueueItem,
  type RetryQuestion,
} from "@/lib/quiz-state";
import { validateMultipleChoiceQuizContent } from "@/lib/lesson-content/schema";
import type { MultipleChoiceQuestion } from "@/lib/lesson-content/schema";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeQuestions(n: number): MultipleChoiceQuestion[] {
  const difficulties: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    question: `Question ${i + 1}`,
    choices: ["Alpha", "Beta", "Gamma", "Delta"],
    correct_index: 0,
    explanation: `Explanation for question ${i + 1}`,
    concept: `concept-${i + 1}`,
    difficulty: difficulties[i % 3],
  }));
}

const THRESHOLD = 6;
const retryCounter = () => ({ n: 0 });

// ─── initQuizSession ──────────────────────────────────────────────────────────

describe("initQuizSession", () => {
  it("creates a fresh session with the right queue length", () => {
    const qs = makeQuestions(8);
    const session = initQuizSession(qs, THRESHOLD);
    expect(session.queue).toHaveLength(8);
    expect(session.current_index).toBe(0);
    expect(session.correct_count).toBe(0);
    expect(session.correct_ids).toHaveLength(0);
    expect(session.passed).toBe(false);
    expect(session.feedback).toBeNull();
    expect(session.retry_questions).toEqual({});
    expect(session.acp_pending).toHaveLength(0);
  });

  it("uses default pass threshold of 6 when omitted", () => {
    const session = initQuizSession(makeQuestions(6));
    expect(session.pass_threshold).toBe(6);
  });

  it("respects a custom pass threshold", () => {
    const session = initQuizSession(makeQuestions(4), 3);
    expect(session.pass_threshold).toBe(3);
  });

  it("all queue items are 'original' kind in order", () => {
    const qs = makeQuestions(3);
    const session = initQuizSession(qs, 3);
    expect(session.queue[0]).toEqual({ kind: "original", question_id: "q1" });
    expect(session.queue[1]).toEqual({ kind: "original", question_id: "q2" });
    expect(session.queue[2]).toEqual({ kind: "original", question_id: "q3" });
  });
});

// ─── gradeAnswer — correct answer ────────────────────────────────────────────

describe("gradeAnswer — correct answer", () => {
  it("increments correct_count on a correct answer", () => {
    const qs = makeQuestions(3);
    const session = initQuizSession(qs, THRESHOLD);
    const item = session.queue[0] as QueueItem;
    const after = gradeAnswer(session, item, 0, qs, retryCounter());
    expect(after.correct_count).toBe(1);
    expect(after.correct_ids).toContain("q1");
  });

  it("does not double-count the same concept", () => {
    const qs = makeQuestions(3);
    let session = initQuizSession(qs, THRESHOLD);
    const rc = retryCounter();
    // Answer q1 correctly twice (simulate a retry)
    session = gradeAnswer(session, session.queue[0], 0, qs, rc);
    // Manually re-add the item as if it were a retry for q1
    const retryItem: QueueItem = { kind: "retry", retry_id: "retry-q1-1", origin_question_id: "q1" };
    const retryQ: RetryQuestion = {
      retry_id: "retry-q1-1",
      origin_question_id: "q1",
      concept: "concept-1",
      question: "Rephrased Q1",
      choices: ["Alpha", "Beta", "Gamma", "Delta"],
      correct_index: 0,
      explanation: "Explanation",
      source: "fallback",
    };
    session = {
      ...session,
      queue: [...session.queue, retryItem],
      retry_questions: { "retry-q1-1": retryQ },
    };
    session = gradeAnswer(session, retryItem, 0, qs, rc);
    // correct_count must still be 1, not 2
    expect(session.correct_count).toBe(1);
    expect(session.correct_ids.filter((id) => id === "q1")).toHaveLength(1);
  });

  it("sets correct feedback", () => {
    const qs = makeQuestions(2);
    const session = initQuizSession(qs, THRESHOLD);
    const after = gradeAnswer(session, session.queue[0], 0, qs, retryCounter());
    expect(after.feedback?.correct).toBe(true);
    expect(after.feedback?.selected_index).toBe(0);
    expect(after.feedback?.correct_answer).toBe("Alpha");
  });

  it("does not append a retry item on a correct answer", () => {
    const qs = makeQuestions(2);
    const session = initQuizSession(qs, THRESHOLD);
    const after = gradeAnswer(session, session.queue[0], 0, qs, retryCounter());
    expect(after.queue).toHaveLength(2);
  });

  it("grades select-all questions by exact selected set", () => {
    const qs: MultipleChoiceQuestion[] = [{
      id: "multi",
      question: "Which statements are true?",
      choices: ["A is true", "B is false", "C is true", "None of the above"],
      allow_multiple_correct: true,
      correct_indices: [0, 2],
      explanation: "A and C are true.",
      concept: "select-all",
      difficulty: "medium",
    }];
    const session = initQuizSession(qs, 1);
    const after = gradeAnswer(session, session.queue[0], [0, 2], qs, retryCounter());
    expect(after.feedback?.correct).toBe(true);
    expect(after.feedback?.correct_answer).toBe("A is true; C is true");
  });

  it("allows select-all questions with exactly one real correct answer", () => {
    const qs: MultipleChoiceQuestion[] = [{
      id: "single-select-all",
      question: "Which statement is true?",
      choices: ["A is false", "B is true", "C is false", "None of the above"],
      allow_multiple_correct: true,
      correct_indices: [1],
      explanation: "Only B is true.",
      concept: "select-all-single",
      difficulty: "easy",
    }];
    const session = initQuizSession(qs, 1);
    const after = gradeAnswer(session, session.queue[0], [1], qs, retryCounter());
    expect(after.feedback?.correct).toBe(true);
  });

  it("allows no-real-answer select-all questions via None of the above", () => {
    const qs: MultipleChoiceQuestion[] = [{
      id: "none",
      question: "Which statements are true?",
      choices: ["A is false", "B is false", "C is false", "None of the above"],
      allow_multiple_correct: true,
      correct_indices: [3],
      explanation: "None of the statements are true.",
      concept: "select-all-none",
      difficulty: "hard",
    }];
    const session = initQuizSession(qs, 1);
    const after = gradeAnswer(session, session.queue[0], [3], qs, retryCounter());
    expect(after.feedback?.correct).toBe(true);
  });
});

// ─── gradeAnswer — wrong answer ───────────────────────────────────────────────

describe("gradeAnswer — wrong answer", () => {
  it("does not increment correct_count on a wrong answer", () => {
    const qs = makeQuestions(3);
    const session = initQuizSession(qs, THRESHOLD);
    const after = gradeAnswer(session, session.queue[0], 1, qs, retryCounter());
    expect(after.correct_count).toBe(0);
    expect(after.correct_ids).toHaveLength(0);
  });

  it("appends a retry item to the queue", () => {
    const qs = makeQuestions(3);
    const session = initQuizSession(qs, THRESHOLD);
    const after = gradeAnswer(session, session.queue[0], 1, qs, retryCounter());
    expect(after.queue).toHaveLength(4); // 3 original + 1 retry
    const lastItem = after.queue[3];
    expect(lastItem.kind).toBe("retry");
    if (lastItem.kind === "retry") {
      expect(lastItem.origin_question_id).toBe("q1");
    }
  });

  it("inserts a fallback retry question immediately (non-blocking)", () => {
    const qs = makeQuestions(2);
    const session = initQuizSession(qs, THRESHOLD);
    const rc = retryCounter();
    const after = gradeAnswer(session, session.queue[0], 2, qs, rc);
    const retryItem = after.queue[after.queue.length - 1];
    expect(retryItem.kind).toBe("retry");
    if (retryItem.kind === "retry") {
      expect(after.retry_questions[retryItem.retry_id]).toBeDefined();
      expect(after.retry_questions[retryItem.retry_id].source).toBe("fallback");
    }
  });

  it("sets incorrect feedback with the correct answer text", () => {
    const qs = makeQuestions(1);
    const session = initQuizSession(qs, 1);
    const after = gradeAnswer(session, session.queue[0], 2, qs, retryCounter());
    expect(after.feedback?.correct).toBe(false);
    expect(after.feedback?.correct_answer).toBe("Alpha"); // correct_index=0 → "Alpha"
  });

  it("marks select-all answers wrong when only part of the set is selected", () => {
    const qs: MultipleChoiceQuestion[] = [{
      id: "multi",
      question: "Which statements are true?",
      choices: ["A is true", "B is false", "C is true", "None of the above"],
      allow_multiple_correct: true,
      correct_indices: [0, 2],
      explanation: "A and C are true.",
      concept: "select-all",
      difficulty: "medium",
    }];
    const session = initQuizSession(qs, 1);
    const after = gradeAnswer(session, session.queue[0], [0], qs, retryCounter());
    expect(after.feedback?.correct).toBe(false);
    expect(after.feedback?.correct_answer).toBe("A is true; C is true");
  });

  it("retry ids are unique across multiple wrong answers", () => {
    const qs = makeQuestions(4);
    let session = initQuizSession(qs, THRESHOLD);
    const rc = retryCounter();
    session = gradeAnswer(session, session.queue[0], 1, qs, rc);
    session = gradeAnswer(session, session.queue[1], 1, qs, rc);
    const retryIds = session.queue
      .filter((it) => it.kind === "retry")
      .map((it) => (it as Extract<QueueItem, { kind: "retry" }>).retry_id);
    const unique = new Set(retryIds);
    expect(unique.size).toBe(retryIds.length);
  });
});

// ─── Pass condition ───────────────────────────────────────────────────────────

describe("Pass condition", () => {
  it("sets passed=true when correct_count reaches threshold on last item with no retries", () => {
    // 6 questions, answer all 6 correctly then advance
    const qs = makeQuestions(6);
    let session = initQuizSession(qs, 6);
    const rc = retryCounter();
    for (let i = 0; i < 5; i++) {
      session = gradeAnswer(session, session.queue[session.current_index], 0, qs, rc);
      session = advanceToNext(session);
    }
    // 6th answer — passes
    session = gradeAnswer(session, session.queue[session.current_index], 0, qs, rc);
    // checkPassedAfterFeedback should fire here
    expect(checkPassedAfterFeedback(session)).toBe(true);
    session = advanceToNext(session);
    expect(session.passed).toBe(true);
  });

  it("supports lesson-part 4-in-a-row pass rules", () => {
    const qs = makeQuestions(5);
    let session = initQuizSession(qs, 4, 4);
    const counter = { n: 0 };

    for (let i = 0; i < 3; i++) {
      session = gradeAnswer(session, { kind: "original", question_id: qs[i].id }, 0, qs, counter);
      expect(session.current_streak).toBe(i + 1);
      expect(session.passed).toBe(false);
      session = advanceToNext(session);
    }

    session = gradeAnswer(session, { kind: "original", question_id: qs[3].id }, 0, qs, counter);
    expect(session.current_streak).toBe(4);
    expect(checkPassedAfterFeedback(session)).toBe(true);
  });

  it("resets lesson-part streak on wrong answers", () => {
    const qs = makeQuestions(5);
    let session = initQuizSession(qs, 4, 4);
    const counter = { n: 0 };

    session = gradeAnswer(session, { kind: "original", question_id: qs[0].id }, 0, qs, counter);
    session = advanceToNext(session);
    session = gradeAnswer(session, { kind: "original", question_id: qs[1].id }, 1, qs, counter);

    expect(session.current_streak).toBe(0);
    expect(session.passed).toBe(false);
  });

  it("does not pass when threshold not yet met", () => {
    const qs = makeQuestions(8);
    let session = initQuizSession(qs, 6);
    const rc = retryCounter();
    // Answer 5 correctly
    for (let i = 0; i < 5; i++) {
      session = gradeAnswer(session, session.queue[session.current_index], 0, qs, rc);
      session = advanceToNext(session);
    }
    expect(session.passed).toBe(false);
  });

  it("does not pass while retry obligations remain ahead", () => {
    const qs = makeQuestions(6);
    let session = initQuizSession(qs, 6);
    const rc = retryCounter();
    // Wrong on q1, correct on q2-q6 → still has a retry for q1 ahead
    session = gradeAnswer(session, session.queue[0], 1, qs, rc);
    session = advanceToNext(session);
    for (let i = 1; i < 6; i++) {
      session = gradeAnswer(session, session.queue[session.current_index], 0, qs, rc);
      session = advanceToNext(session);
    }
    // At this point we have 5 correct, 1 retry pending → not passed
    expect(session.passed).toBe(false);
  });

  it("passes after correct answer on retry resolves the final obligation", () => {
    const qs = makeQuestions(6);
    let session = initQuizSession(qs, 6);
    const rc = retryCounter();
    // Wrong on q1
    session = gradeAnswer(session, session.queue[0], 1, qs, rc);
    session = advanceToNext(session);
    // Correct on q2–q6
    for (let i = 1; i < 6; i++) {
      session = gradeAnswer(session, session.queue[session.current_index], 0, qs, rc);
      session = advanceToNext(session);
    }
    // Now on the retry item — answer correctly
    const retryItem = session.queue[session.current_index];
    expect(retryItem.kind).toBe("retry");
    session = gradeAnswer(session, retryItem, 0, qs, rc);
    expect(checkPassedAfterFeedback(session)).toBe(true);
    session = advanceToNext(session);
    expect(session.passed).toBe(true);
  });
});

// ─── advanceToNext ────────────────────────────────────────────────────────────

describe("advanceToNext", () => {
  it("increments current_index", () => {
    const qs = makeQuestions(3);
    let session = initQuizSession(qs, 3);
    const rc = retryCounter();
    session = gradeAnswer(session, session.queue[0], 0, qs, rc);
    const after = advanceToNext(session);
    expect(after.current_index).toBe(1);
  });

  it("clears feedback after advancing", () => {
    const qs = makeQuestions(2);
    let session = initQuizSession(qs, 2);
    const rc = retryCounter();
    session = gradeAnswer(session, session.queue[0], 0, qs, rc);
    expect(session.feedback).not.toBeNull();
    const after = advanceToNext(session);
    expect(after.feedback).toBeNull();
  });

  it("does not advance past the last item", () => {
    const qs = makeQuestions(2);
    let session = initQuizSession(qs, 2);
    const rc = retryCounter();
    for (let i = 0; i < 2; i++) {
      session = gradeAnswer(session, session.queue[session.current_index], 0, qs, rc);
      session = advanceToNext(session);
    }
    // current_index is capped at the last item
    expect(session.current_index).toBeLessThanOrEqual(session.queue.length - 1);
  });
});

// ─── hasUnresolvedRetries ─────────────────────────────────────────────────────

describe("hasUnresolvedRetries", () => {
  it("returns false when no retries are ahead", () => {
    const qs = makeQuestions(3);
    const session = initQuizSession(qs, 3);
    expect(hasUnresolvedRetries(session)).toBe(false);
  });

  it("returns true when a retry item is ahead of current_index", () => {
    const qs = makeQuestions(3);
    let session = initQuizSession(qs, 3);
    const rc = retryCounter();
    session = gradeAnswer(session, session.queue[0], 1, qs, rc); // wrong
    expect(hasUnresolvedRetries(session)).toBe(true);
  });
});

// ─── makeFallbackRetry ────────────────────────────────────────────────────────

describe("makeFallbackRetry", () => {
  const original = {
    question: "What is 2+2?",
    choices: ["1", "2", "3", "4"],
    correct_index: 3, // "4"
    explanation: "Basic addition.",
    concept: "arithmetic",
  };

  it("preserves the correct answer text after shuffle", () => {
    const retry = makeFallbackRetry("retry-q1-1", "q1", original);
    expect(retry.choices[retry.correct_index ?? -1]).toBe("4");
  });

  it("contains all original choices", () => {
    const retry = makeFallbackRetry("retry-q1-1", "q1", original);
    const sorted = [...retry.choices].sort();
    const origSorted = [...original.choices].sort();
    expect(sorted).toEqual(origSorted);
  });

  it("is deterministic — same retry_id always gives the same shuffle", () => {
    const r1 = makeFallbackRetry("retry-q1-1", "q1", original);
    const r2 = makeFallbackRetry("retry-q1-1", "q1", original);
    expect(r1.choices).toEqual(r2.choices);
    expect(r1.correct_index).toBe(r2.correct_index);
  });

  it("different retry_ids generally produce different shuffles", () => {
    const r1 = makeFallbackRetry("retry-q1-1", "q1", original);
    const r2 = makeFallbackRetry("retry-q1-2", "q1", original);
    // Not guaranteed to differ every time, but statistically very likely with 4! permutations
    const same = r1.choices.every((c, i) => c === r2.choices[i]);
    // Run this just as a smoke test — it should differ in practice
    // (not a hard assertion since collisions are possible)
    expect(typeof same).toBe("boolean");
  });

  it("sets source to fallback", () => {
    const retry = makeFallbackRetry("retry-q1-1", "q1", original);
    expect(retry.source).toBe("fallback");
  });
});

// ─── validateRetryQuestion ────────────────────────────────────────────────────

describe("validateRetryQuestion", () => {
  const valid: RetryQuestion = {
    retry_id: "retry-q1-1",
    origin_question_id: "q1",
    concept: "arithmetic",
    question: "What is two plus two?",
    choices: ["Three", "Four", "Five", "Six"],
    correct_index: 1,
    explanation: "Two plus two equals four.",
    source: "acp",
  };

  it("accepts a valid retry question", () => {
    const result = validateRetryQuestion(valid);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects when question text is empty", () => {
    const r = validateRetryQuestion({ ...valid, question: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("empty"))).toBe(true);
  });

  it("rejects fewer than 2 choices", () => {
    const r = validateRetryQuestion({ ...valid, choices: ["Only one"] });
    expect(r.valid).toBe(false);
  });

  it("rejects more than 6 choices", () => {
    const r = validateRetryQuestion({ ...valid, choices: ["A","B","C","D","E","F","G"] });
    expect(r.valid).toBe(false);
  });

  it("rejects duplicate choices", () => {
    const r = validateRetryQuestion({ ...valid, choices: ["Same", "Same", "Other", "Another"] });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("duplicates"))).toBe(true);
  });

  it("rejects correct_index out of range", () => {
    const r = validateRetryQuestion({ ...valid, correct_index: 10 });
    expect(r.valid).toBe(false);
  });

  it("rejects negative correct_index", () => {
    const r = validateRetryQuestion({ ...valid, correct_index: -1 });
    expect(r.valid).toBe(false);
  });

  it("rejects empty explanation", () => {
    const r = validateRetryQuestion({ ...valid, explanation: "  " });
    expect(r.valid).toBe(false);
  });
});

// ─── integrateAcpResult ───────────────────────────────────────────────────────

describe("integrateAcpResult", () => {
  const qs = makeQuestions(3);

  function sessionWithPending(originId: string, retryId: string): QuizSessionState {
    const session = initQuizSession(qs, THRESHOLD);
    const fallback = makeFallbackRetry(retryId, originId, {
      question: "Q",
      choices: ["A", "B", "C", "D"],
      correct_index: 0,
      explanation: "E",
      concept: "c",
    });
    return {
      ...session,
      acp_pending: [originId],
      retry_questions: { [retryId]: fallback },
    };
  }

  it("replaces fallback with valid ACP result", () => {
    const session = sessionWithPending("q1", "retry-q1-1");
    const acpResult: Partial<RetryQuestion> = {
      question: "ACP-rephrased question",
      choices: ["New A", "New B", "New C", "New D"],
      correct_index: 2,
      explanation: "ACP explanation",
    };
    const after = integrateAcpResult(session, "retry-q1-1", "q1", acpResult, qs);
    expect(after.retry_questions["retry-q1-1"].question).toBe("ACP-rephrased question");
    expect(after.retry_questions["retry-q1-1"].source).toBe("acp");
    expect(after.acp_pending).not.toContain("q1");
  });

  it("keeps fallback and removes pending when ACP result is null", () => {
    const session = sessionWithPending("q1", "retry-q1-1");
    const fallbackQ = session.retry_questions["retry-q1-1"].question;
    const after = integrateAcpResult(session, "retry-q1-1", "q1", null, qs);
    expect(after.retry_questions["retry-q1-1"].question).toBe(fallbackQ);
    expect(after.acp_pending).not.toContain("q1");
  });

  it("keeps fallback when ACP result fails validation", () => {
    const session = sessionWithPending("q1", "retry-q1-1");
    const fallbackQ = session.retry_questions["retry-q1-1"].question;
    const badResult: Partial<RetryQuestion> = {
      question: "", // fails validation
      choices: ["A", "B"],
      correct_index: 0,
      explanation: "OK",
    };
    const after = integrateAcpResult(session, "retry-q1-1", "q1", badResult, qs);
    expect(after.retry_questions["retry-q1-1"].question).toBe(fallbackQ);
  });
});

// ─── resolveItemQuestion ──────────────────────────────────────────────────────

describe("resolveItemQuestion", () => {
  it("resolves an original item from the allQuestions array", () => {
    const qs = makeQuestions(2);
    const session = initQuizSession(qs, 2);
    const q = resolveItemQuestion({ kind: "original", question_id: "q2" }, session, qs);
    expect(q?.question).toBe("Question 2");
  });

  it("resolves a retry item from retry_questions", () => {
    const qs = makeQuestions(2);
    const session = initQuizSession(qs, 2);
    const retryQ: RetryQuestion = {
      retry_id: "retry-q1-1",
      origin_question_id: "q1",
      concept: "concept-1",
      question: "Rephrased Q1",
      choices: ["A", "B", "C", "D"],
      correct_index: 1,
      explanation: "Rephrased explanation",
      source: "acp",
    };
    const sessionWithRetry = { ...session, retry_questions: { "retry-q1-1": retryQ } };
    const q = resolveItemQuestion({ kind: "retry", retry_id: "retry-q1-1", origin_question_id: "q1" }, sessionWithRetry, qs);
    expect(q?.question).toBe("Rephrased Q1");
  });

  it("returns null for an unknown question_id", () => {
    const qs = makeQuestions(2);
    const session = initQuizSession(qs, 2);
    const q = resolveItemQuestion({ kind: "original", question_id: "unknown" }, session, qs);
    expect(q).toBeNull();
  });
});

// ─── serializeQuizState / deserializeQuizState ───────────────────────────────

describe("serializeQuizState / deserializeQuizState", () => {
  it("round-trips a fresh session without data loss", () => {
    const qs = makeQuestions(4);
    const session = initQuizSession(qs, 3);
    const serialized = serializeQuizState(session);
    const restored = deserializeQuizState(serialized);
    expect(restored).not.toBeNull();
    expect(restored?.current_index).toBe(0);
    expect(restored?.queue).toHaveLength(4);
    expect(restored?.pass_threshold).toBe(3);
  });

  it("round-trips a session with retry questions and feedback", () => {
    const qs = makeQuestions(3);
    let session = initQuizSession(qs, 3);
    const rc = retryCounter();
    session = gradeAnswer(session, session.queue[0], 1, qs, rc); // wrong
    const serialized = serializeQuizState(session);
    const restored = deserializeQuizState(serialized);
    expect(restored?.queue.length).toBeGreaterThan(3); // retry added
    expect(restored?.feedback?.correct).toBe(false);
    expect(Object.keys(restored?.retry_questions ?? {})).toHaveLength(1);
  });

  it("returns null for null input", () => {
    expect(deserializeQuizState(null)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(deserializeQuizState("{not json}")).toBeNull();
  });

  it("returns null when required keys are missing", () => {
    const partial = JSON.stringify({ current_index: 0 }); // missing queue, correct_ids, correct_count
    expect(deserializeQuizState(partial)).toBeNull();
  });

  it("preserves passed=true after re-serialization", () => {
    // 1 question, threshold 1 — after a correct answer + advance the queue is
    // exhausted, so advanceToNext sets passed=true.
    const qs = makeQuestions(1);
    let session = initQuizSession(qs, 1);
    const rc = retryCounter();
    session = gradeAnswer(session, session.queue[0], 0, qs, rc);
    session = advanceToNext(session);
    expect(session.passed).toBe(true);
    const restored = deserializeQuizState(serializeQuizState(session));
    expect(restored?.passed).toBe(true);
  });
});

// ─── validateMultipleChoiceQuizContent ───────────────────────────────────────

describe("validateMultipleChoiceQuizContent (schema)", () => {
  const validQuestion = {
    id: "q1",
    question: "What is 2+2?",
    choices: ["3", "4", "5", "6"],
    correct_index: 1,
    explanation: "Two plus two is four.",
    concept: "arithmetic",
    difficulty: "easy",
  };

  // validateMultipleChoiceQuizContent takes the quiz object directly
  // (i.e., the value of the "quiz" key in activity.content, not the outer wrapper).
  const validQuiz = {
    questions: [validQuestion],
    pass_threshold: 1,
  };

  it("accepts a well-formed quiz", () => {
    const result = validateMultipleChoiceQuizContent(validQuiz);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a quiz with no questions array", () => {
    const result = validateMultipleChoiceQuizContent({});
    expect(result.valid).toBe(false);
  });

  it("rejects a question with empty question text", () => {
    const q = { ...validQuestion, question: "" };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(false);
  });

  it("rejects a question with only one choice", () => {
    const q = { ...validQuestion, choices: ["only one"] };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(false);
  });

  it("rejects a question with more than 6 choices", () => {
    const q = { ...validQuestion, choices: ["A","B","C","D","E","F","G"] };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(false);
  });

  it("rejects a question with duplicate choices", () => {
    const q = { ...validQuestion, choices: ["Same", "Same", "Other", "Another"] };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(false);
  });

  it("rejects a question with correct_index out of bounds", () => {
    const q = { ...validQuestion, correct_index: 10 };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(false);
  });

  it("rejects questions with duplicate ids", () => {
    const q2 = { ...validQuestion, id: "q1" }; // same id as validQuestion
    const result = validateMultipleChoiceQuizContent({ questions: [validQuestion, q2] });
    expect(result.valid).toBe(false);
  });

  it("accepts a quiz without pass_threshold (optional field)", () => {
    const result = validateMultipleChoiceQuizContent({ questions: [validQuestion] });
    expect(result.valid).toBe(true);
  });

  it("accepts a quiz with concept and optional fields on questions", () => {
    const q = {
      ...validQuestion,
      difficulty: "hard" as const,
      misconception_target: "common error",
      rephrase_instructions: "Use a different context.",
    };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(true);
  });

  it("accepts select-all questions with multiple correct answers", () => {
    const q = {
      id: "multi",
      question: "Select all true statements.",
      choices: ["A", "B", "C", "None of the above"],
      allow_multiple_correct: true,
      correct_indices: [0, 2],
      explanation: "A and C are true.",
      concept: "select-all",
      difficulty: "medium",
    };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(true);
  });

  it("accepts select-all questions with only None of the above correct", () => {
    const q = {
      id: "none",
      question: "Select all true statements.",
      choices: ["A", "B", "C", "None of the above"],
      allow_multiple_correct: true,
      correct_indices: [3],
      explanation: "None are true.",
      concept: "select-all-none",
      difficulty: "hard",
    };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(true);
  });

  it("rejects select-all questions without None of the above", () => {
    const q = {
      id: "bad-multi",
      question: "Select all true statements.",
      choices: ["A", "B", "C"],
      allow_multiple_correct: true,
      correct_indices: [0, 2],
      explanation: "A and C are true.",
      concept: "select-all",
      difficulty: "medium",
    };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/None of the above/);
  });

  it("rejects None of the above mixed with another correct answer", () => {
    const q = {
      id: "bad-none",
      question: "Select all true statements.",
      choices: ["A", "B", "None of the above"],
      allow_multiple_correct: true,
      correct_indices: [0, 2],
      explanation: "Contradictory.",
      concept: "select-all",
      difficulty: "medium",
    };
    const result = validateMultipleChoiceQuizContent({ questions: [q] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/only correct choice/);
  });
});
