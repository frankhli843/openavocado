/**
 * ACP rephrase adapter for missed multiple-choice quiz questions.
 *
 * When a learner answers a question incorrectly, the UI calls triggerAcpRephrase()
 * asynchronously. The call is fire-and-forget from the learner's perspective —
 * feedback appears immediately without waiting. When the rephrase completes,
 * the result is placed in quiz session state so it's available when the retry
 * item reaches the front of the queue.
 *
 * Endpoint: AVOCADOCORE_ACP_ENDPOINT (env). If not set, the API route returns
 * a deterministic fallback so the UI always has a retry available.
 *
 * Validation: the API route validates the LLM output before returning it.
 * The client also validates with validateRetryQuestion before integrating.
 * Invalid output is logged loudly in dev and the fallback is used instead.
 */

import type { MultipleChoiceQuestion } from "@/lib/lesson-content/schema";
import type { RetryQuestion } from "@/lib/quiz-state";

export interface RephraseRequest {
  retry_id: string;
  origin_question_id: string;
  original: Pick<MultipleChoiceQuestion, "question" | "choices" | "correct_index" | "correct_indices" | "allow_multiple_correct" | "explanation" | "concept" | "misconception_target" | "rephrase_instructions">;
}

export interface RephraseResponse {
  ok: boolean;
  retry?: Partial<RetryQuestion>;
  error?: string;
  source: "acp" | "fallback";
}

/**
 * Fire an async rephrase request and return the result (or fallback).
 * Never throws — any error is caught and logged, returning `ok: false`.
 */
export async function requestRephrase(req: RephraseRequest): Promise<RephraseResponse> {
  try {
    const res = await fetch("/api/rephrase-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      console.warn(`[acp-rephrase] API returned ${res.status} for retry_id=${req.retry_id}`);
      return { ok: false, error: `HTTP ${res.status}`, source: "fallback" };
    }
    const data = (await res.json()) as RephraseResponse;
    return data;
  } catch (err) {
    console.warn("[acp-rephrase] Request failed:", err);
    return { ok: false, error: String(err), source: "fallback" };
  }
}
