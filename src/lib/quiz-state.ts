/**
 * Quiz session state types and deterministic grading logic.
 *
 * The quiz runs a queue of items. Each item is either an original question
 * from the lesson content or a retry item generated when a question was
 * answered incorrectly. A retry item replaces the missed concept obligation;
 * the original question is never marked done until a retry is answered correctly.
 *
 * Pass rule: exactly pass_threshold (default 6) distinct correct answers.
 * A concept is counted only once even if multiple retries were needed.
 *
 * This module contains only pure logic — no React, no side effects.
 * It can be imported by both the component and unit tests.
 */

import type { MultipleChoiceQuestion } from "@/lib/lesson-content/schema";
export { IDK_LABEL } from "@/lib/lesson-content/schema";

/**
 * Index of the virtual "I don't know" option for a question with `n` real
 * choices. IDK is always appended after the real choices, so it is never the
 * correct answer and never collides with `correct_index`.
 */
export function idkIndexFor(choiceCount: number): number {
  return choiceCount;
}

/** True when the learner selected the virtual "I don't know" option. */
export function isIdkSelection(choiceCount: number, selected_index: number): boolean {
  return selected_index === choiceCount;
}

// ─── Core item types ──────────────────────────────────────────────────────────

/**
 * An item currently in the quiz queue.
 * Either an original question or a retry for a previously missed concept.
 */
export type QueueItem =
  | { kind: "original"; question_id: string }
  | { kind: "retry"; retry_id: string; origin_question_id: string };

/**
 * A rephrased retry question ready to replace the fallback.
 * May be ACP-generated or produced by the deterministic fallback generator.
 */
export interface RetryQuestion {
  /** Matches the retry_id in the QueueItem. */
  retry_id: string;
  /** The original question id this retry covers. */
  origin_question_id: string;
  /** Concept tag carried over from the original. */
  concept: string;
  /** Rephrased question text. Must differ from the original. */
  question: string;
  /** Choices. Correct answer may be in a different position than the original. */
  choices: string[];
  /** 0-based index of the correct choice in this retry's choices array. */
  correct_index: number;
  /** Explanation — same or improved from the original. */
  explanation: string;
  /** How this retry was produced. */
  source: "acp" | "fallback";
}

// ─── Feedback state ──────────────────────────────────────────────────────────

export interface QuizFeedback {
  /** Which question/retry we just answered. */
  item: QueueItem;
  /** The choice index the learner selected. */
  selected_index: number;
  /** Whether the answer was correct. */
  correct: boolean;
  /** Correct answer text (always shown after submit). */
  correct_answer: string;
  /** Explanation text. */
  explanation: string;
  /**
   * True when the learner picked the "I don't know" option. Treated as incorrect
   * (so the concept still requeues), but recorded as a distinct high-signal
   * uncertainty rather than a wrong guess. The UI shows a no-shame message.
   */
  is_idk: boolean;
  /** True when feedback is being displayed and the learner has not clicked Next. */
  showing: boolean;
}

// ─── Full session state (autosaved) ──────────────────────────────────────────

export interface QuizSessionState {
  /** 0-based index into `queue` for the current item. */
  current_index: number;
  /**
   * Ordered queue. A wrong answer appends a retry entry toward the end.
   * current_index advances after each Next click.
   */
  queue: QueueItem[];
  /**
   * Correctly answered question ids (originals, not retry ids).
   * A concept is counted once when either its original or a retry is first answered correctly.
   */
  correct_ids: string[];
  /** Number of distinct correct answers (length of correct_ids). */
  correct_count: number;
  /** Pass threshold. Copied from content spec at session start. */
  pass_threshold: number;
  /** True when correct_count >= pass_threshold and all retry obligations are settled. */
  passed: boolean;
  /** Feedback currently shown (null when not showing). */
  feedback: QuizFeedback | null;
  /**
   * Retry questions keyed by retry_id.
   * Populated by ACP rephrase (async) or the deterministic fallback (sync on wrong answer).
   * When a retry item is front-of-queue, the component looks here for the question content.
   */
  retry_questions: Record<string, RetryQuestion>;
  /**
   * Ids of original questions whose ACP rephrase is still pending.
   * The component shows a subtle "rephrasing..." indicator while these are in flight.
   * Once resolved, the result overwrites the fallback in retry_questions.
   */
  acp_pending: string[];
}

// ─── Session initialization ──────────────────────────────────────────────────

/**
 * Build a fresh quiz session from a list of questions and a pass threshold.
 * Shuffles nothing — the original order is preserved; content authors should
 * arrange questions from easy to hard.
 */
export function initQuizSession(
  questions: MultipleChoiceQuestion[],
  pass_threshold: number = 6
): QuizSessionState {
  return {
    current_index: 0,
    queue: questions.map((q) => ({ kind: "original" as const, question_id: q.id })),
    correct_ids: [],
    correct_count: 0,
    pass_threshold,
    passed: false,
    feedback: null,
    retry_questions: {},
    acp_pending: [],
  };
}

// ─── Grading ─────────────────────────────────────────────────────────────────

/**
 * Grade a submitted answer and return the updated session state.
 * This is purely deterministic and synchronous — the ACP rephrase runs outside this.
 *
 * On a correct answer: increments correct_count (if not already counted), advances pass check.
 * On a wrong answer: schedules a retry item to be appended after the remaining queue
 *   items (not immediately, so the learner doesn't hit it right away).
 *
 * Does NOT auto-advance current_index — that happens when the learner clicks Next.
 */
export function gradeAnswer(
  state: QuizSessionState,
  item: QueueItem,
  selected_index: number,
  allQuestions: MultipleChoiceQuestion[],
  retryCounter: { n: number }
): QuizSessionState {
  // Resolve the question definition being answered.
  const qDef = resolveItemQuestion(item, state, allQuestions);
  if (!qDef) return state; // defensive: item not found, skip

  // The virtual IDK option sits at index === choices.length, so it can never
  // equal correct_index — IDK always grades as incorrect, but is flagged.
  const is_idk = isIdkSelection(qDef.choices.length, selected_index);
  const correct = !is_idk && selected_index === qDef.correct_index;
  const correct_answer = qDef.choices[qDef.correct_index];

  // Build feedback state (will be shown until learner clicks Next).
  const feedback: QuizFeedback = {
    item,
    selected_index,
    correct,
    correct_answer,
    explanation: qDef.explanation,
    is_idk,
    showing: true,
  };

  let { correct_ids, correct_count, queue } = state;

  if (correct) {
    // Mark the original concept as correctly answered (idempotent).
    const origin_id = item.kind === "original" ? item.question_id : item.origin_question_id;
    if (!correct_ids.includes(origin_id)) {
      correct_ids = [...correct_ids, origin_id];
      correct_count = correct_ids.length;
    }
  } else {
    // Schedule a retry. The retry goes to the position just past the remaining
    // items in the current queue (i.e., after all still-pending items), so the
    // learner gets through the rest of the lesson before seeing it again.
    const retry_id = `retry-${item.kind === "original" ? item.question_id : item.origin_question_id}-${++retryCounter.n}`;
    const origin_id = item.kind === "original" ? item.question_id : item.origin_question_id;
    const retryItem: QueueItem = { kind: "retry", retry_id, origin_question_id: origin_id };
    queue = [...queue, retryItem];
    // Immediately insert a fallback retry question so the UI is never blocked.
    const fallback = makeFallbackRetry(retry_id, origin_id, qDef);
    state = {
      ...state,
      retry_questions: { ...state.retry_questions, [retry_id]: fallback },
    };
  }

  // Check pass condition: correct_count >= threshold and no pending retry obligations.
  const unresolvedRetries = queue
    .slice(state.current_index + 1)
    .filter((it) => it.kind === "retry");
  const passed =
    correct_count >= state.pass_threshold && unresolvedRetries.length === 0 && correct;

  return {
    ...state,
    queue,
    correct_ids,
    correct_count,
    passed,
    feedback,
  };
}

/**
 * Advance to the next question after the learner clicks Next.
 * Clears feedback and increments current_index.
 * Also re-evaluates pass state in case all obligations are now fulfilled.
 */
export function advanceToNext(state: QuizSessionState): QuizSessionState {
  const next_index = state.current_index + 1;
  const done = next_index >= state.queue.length;

  // Re-evaluate pass: correct_count >= threshold and queue is exhausted.
  const passed = state.correct_count >= state.pass_threshold && done;

  return {
    ...state,
    current_index: done ? state.current_index : next_index,
    feedback: null,
    passed,
  };
}

// ─── ACP result integration ───────────────────────────────────────────────────

/**
 * Integrate an ACP rephrase result (or a failure) into the session state.
 * If valid, replaces the fallback retry question. If invalid or failed,
 * keeps the fallback (already in retry_questions) and removes from acp_pending.
 */
export function integrateAcpResult(
  state: QuizSessionState,
  retry_id: string,
  origin_question_id: string,
  acpResult: Partial<RetryQuestion> | null,
  allQuestions: MultipleChoiceQuestion[]
): QuizSessionState {
  const pending = state.acp_pending.filter((id) => id !== origin_question_id);

  if (acpResult) {
    const validation = validateRetryQuestion(acpResult);
    if (validation.valid) {
      const rq: RetryQuestion = {
        retry_id,
        origin_question_id,
        concept: acpResult.concept ?? (allQuestions.find((q) => q.id === origin_question_id)?.concept ?? ""),
        question: acpResult.question!,
        choices: acpResult.choices!,
        correct_index: acpResult.correct_index!,
        explanation: acpResult.explanation!,
        source: "acp",
      };
      return {
        ...state,
        acp_pending: pending,
        retry_questions: { ...state.retry_questions, [retry_id]: rq },
      };
    } else {
      console.warn("[quiz] ACP retry rejected:", validation.errors);
    }
  }

  return { ...state, acp_pending: pending };
}

// ─── Retry question validation ────────────────────────────────────────────────

export interface RetryValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate an ACP-generated retry question before accepting it.
 * Guards: question text differs from empty, choices distinct, correct_index in range,
 * explanation present, no answer leakage in question text.
 */
export function validateRetryQuestion(
  raw: Partial<RetryQuestion>
): RetryValidationResult {
  const errors: string[] = [];

  if (typeof raw.question !== "string" || !raw.question.trim()) {
    errors.push("retry question text is empty");
  }
  if (!Array.isArray(raw.choices) || raw.choices.length < 2 || raw.choices.length > 6) {
    errors.push("retry choices must have 2–6 elements");
  } else {
    if (!raw.choices.every((c) => typeof c === "string" && c.trim())) {
      errors.push("retry choices must all be non-empty strings");
    }
    if (new Set(raw.choices).size !== raw.choices.length) {
      errors.push("retry choices must not contain duplicates");
    }
  }
  if (typeof raw.correct_index !== "number" || !Number.isInteger(raw.correct_index) || raw.correct_index < 0) {
    errors.push("retry correct_index must be a non-negative integer");
  } else if (Array.isArray(raw.choices) && raw.correct_index >= raw.choices.length) {
    errors.push("retry correct_index is out of range");
  }
  if (typeof raw.explanation !== "string" || !raw.explanation.trim()) {
    errors.push("retry explanation is empty");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Deterministic fallback retry ────────────────────────────────────────────

/**
 * Build a deterministic local retry question without any LLM call.
 * Strategy: shuffle the choices to a different order (Fisher-Yates with a
 * seeded offset based on the retry_id string so it is reproducible across
 * reloads), keep the same question text but prefix it with a note that the
 * concept will come back. The correct answer is preserved — only its position
 * changes.
 */
export function makeFallbackRetry(
  retry_id: string,
  origin_question_id: string,
  original: { question: string; choices: string[]; correct_index: number; explanation: string; concept: string }
): RetryQuestion {
  const correct_text = original.choices[original.correct_index];

  // Deterministic shuffle based on retry_id hash.
  const seed = stringHash(retry_id);
  const shuffled = deterministicShuffle([...original.choices], seed);
  const new_correct_index = shuffled.indexOf(correct_text);

  return {
    retry_id,
    origin_question_id,
    concept: original.concept,
    question: original.question,
    choices: shuffled,
    correct_index: new_correct_index,
    explanation: original.explanation,
    source: "fallback",
  };
}

// ─── Resolution helpers ───────────────────────────────────────────────────────

/**
 * Resolve a queue item to a question definition that can be rendered.
 * For originals, looks up from allQuestions. For retries, looks up from
 * state.retry_questions (fallback or ACP-generated).
 */
export function resolveItemQuestion(
  item: QueueItem,
  state: QuizSessionState,
  allQuestions: MultipleChoiceQuestion[]
): { question: string; choices: string[]; correct_index: number; explanation: string; concept: string } | null {
  if (item.kind === "original") {
    const q = allQuestions.find((q) => q.id === item.question_id);
    if (!q) return null;
    return { question: q.question, choices: q.choices, correct_index: q.correct_index, explanation: q.explanation, concept: q.concept };
  }
  const rq = state.retry_questions[item.retry_id];
  if (!rq) return null;
  return { question: rq.question, choices: rq.choices, correct_index: rq.correct_index, explanation: rq.explanation, concept: rq.concept };
}

/**
 * True when the session is at the last item and feedback is being shown for
 * a correct answer that pushes correct_count to pass_threshold.
 */
export function checkPassedAfterFeedback(state: QuizSessionState): boolean {
  if (!state.feedback?.correct) return false;
  return state.correct_count >= state.pass_threshold && !hasUnresolvedRetries(state);
}

/**
 * True when there are retry items ahead of the current position in the queue.
 */
export function hasUnresolvedRetries(state: QuizSessionState): boolean {
  return state.queue
    .slice(state.current_index + 1)
    .some((it) => it.kind === "retry");
}

// ─── Autosave serialization ───────────────────────────────────────────────────

/**
 * Serialize quiz session state to a JSON string suitable for the autosave API.
 * Stored in `lesson_autosave.assessment_answers` as a JSON blob.
 */
export function serializeQuizState(state: QuizSessionState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize quiz session state from the autosave JSON string.
 * Returns null on any parse or validation failure so the UI can start fresh.
 */
export function deserializeQuizState(raw: string | null | undefined): QuizSessionState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuizSessionState;
    // Basic sanity check — must have required keys.
    if (
      typeof parsed.current_index !== "number" ||
      !Array.isArray(parsed.queue) ||
      !Array.isArray(parsed.correct_ids) ||
      typeof parsed.correct_count !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ─── Internal utilities ───────────────────────────────────────────────────────

/** Simple deterministic string hash (djb2-style). */
function stringHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Deterministic Fisher-Yates shuffle using a linear congruential generator
 * seeded from `seed`. Ensures the same retry_id always produces the same shuffle.
 */
function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  let rng = seed;
  const next = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
