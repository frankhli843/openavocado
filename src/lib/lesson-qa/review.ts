/**
 * Orchestrator for the semantic QA review.
 *
 * reviewLesson: gather content -> invoke the ACP reviewer -> persist the verdict.
 * reviewLessonWithRetry: run the review, and on rejection feed the reviewer's fix
 * suggestions into a caller-supplied regeneration step, up to a bounded number of
 * attempts, before escalating. The regeneration itself lives with the caller (the
 * harness) because only it knows how to re-run the generator; this module owns the
 * gate + feedback loop.
 */

import type Database from "better-sqlite3";
import { gatherLessonForReview } from "./gather";
import { invokeReviewer, type InvokeReviewerOptions } from "./reviewer";
import { storeVerdict } from "./store";
import { buildRegenerationFeedback, type QaVerdict } from "./verdict";

export interface ReviewLessonResult {
  lessonId: number;
  verdict: QaVerdict;
  reviewId: number;
  /** Number of pre-screen flags surfaced to the reviewer (audit). */
  flagCount: number;
  rawOutput: string;
}

export interface ReviewLessonOptions extends InvokeReviewerOptions {
  reviewerRef?: string | null;
}

/** Run one review pass on a lesson and persist the verdict. */
export async function reviewLesson(
  db: Database.Database,
  lessonId: number,
  opts: ReviewLessonOptions = {}
): Promise<ReviewLessonResult> {
  const gathered = gatherLessonForReview(db, lessonId);
  const attempt = opts.attempt ?? 1;
  const { verdict, rawOutput } = await invokeReviewer(gathered, opts);
  const reviewId = storeVerdict(db, {
    lessonId,
    attempt,
    verdict,
    flags: gathered.flags,
    reviewerRef: opts.reviewerRef ?? null,
  });
  return { lessonId, verdict, reviewId, flagCount: gathered.flags.length, rawOutput };
}

/**
 * Regeneration callback: given the reviewer's feedback, produce a replacement
 * lesson and return its new lesson_id. The retry loop reviews that new lesson.
 */
export type RegenerateFn = (feedback: string, attempt: number) => Promise<number>;

export interface ReviewWithRetryOptions extends ReviewLessonOptions {
  /** Max total attempts (initial + regenerations). Defaults to 3. */
  maxAttempts?: number;
}

export interface ReviewWithRetryResult {
  approved: boolean;
  /** The lesson_id of the final reviewed lesson (may differ from the input after regeneration). */
  finalLessonId: number;
  attempts: number;
  verdict: QaVerdict;
  /** Per-attempt review results, in order. */
  history: ReviewLessonResult[];
}

/**
 * Review a lesson and, on rejection, regenerate with the reviewer's feedback
 * injected, up to `maxAttempts`. Returns the final verdict; `approved` is false
 * when all attempts are exhausted without approval (the caller should escalate).
 */
export async function reviewLessonWithRetry(
  db: Database.Database,
  lessonId: number,
  regenerate: RegenerateFn,
  opts: ReviewWithRetryOptions = {}
): Promise<ReviewWithRetryResult> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const history: ReviewLessonResult[] = [];
  let currentLessonId = lessonId;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await reviewLesson(db, currentLessonId, { ...opts, attempt });
    history.push(result);

    if (result.verdict.approved) {
      return {
        approved: true,
        finalLessonId: currentLessonId,
        attempts: attempt,
        verdict: result.verdict,
        history,
      };
    }

    // Rejected. If we have attempts left, regenerate with feedback injected.
    if (attempt < maxAttempts) {
      const feedback = buildRegenerationFeedback(result.verdict);
      currentLessonId = await regenerate(feedback, attempt + 1);
    }
  }

  const last = history[history.length - 1];
  return {
    approved: false,
    finalLessonId: currentLessonId,
    attempts: history.length,
    verdict: last.verdict,
    history,
  };
}
