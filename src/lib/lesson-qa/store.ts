/**
 * Persistence for semantic QA verdicts — the audit trail in the qa_reviews table.
 * One row per review pass so a lesson's full review history (across regeneration
 * attempts) is queryable.
 */

import type Database from "better-sqlite3";
import type { PreScreenFlag } from "./gather";
import { buildRegenerationFeedback, type QaVerdict } from "./verdict";

export interface StoreVerdictArgs {
  lessonId: number;
  attempt: number;
  verdict: QaVerdict;
  flags: PreScreenFlag[];
  reviewerRef?: string | null;
}

export interface StoredQaReview {
  id: number;
  lesson_id: number;
  approved: number;
  attempt: number;
  reviewer_ref: string | null;
  verdict_json: string;
  prescreen_flags: string | null;
  feedback: string | null;
  created_at: string;
}

/** Insert a verdict into qa_reviews and return the new row id. */
export function storeVerdict(db: Database.Database, args: StoreVerdictArgs): number {
  const feedback = args.verdict.approved ? null : buildRegenerationFeedback(args.verdict);
  const result = db
    .prepare(
      `INSERT INTO qa_reviews
         (lesson_id, approved, attempt, reviewer_ref, verdict_json, prescreen_flags, feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      args.lessonId,
      args.verdict.approved ? 1 : 0,
      args.attempt,
      args.reviewerRef ?? null,
      JSON.stringify(args.verdict),
      JSON.stringify(args.flags),
      feedback
    );
  return Number(result.lastInsertRowid);
}

/** Fetch the most recent verdict row for a lesson, or null. */
export function getLatestReview(db: Database.Database, lessonId: number): StoredQaReview | null {
  const row = db
    .prepare("SELECT * FROM qa_reviews WHERE lesson_id = ? ORDER BY id DESC LIMIT 1")
    .get(lessonId) as StoredQaReview | undefined;
  return row ?? null;
}

/** Fetch every review row for a lesson, oldest first. */
export function listReviews(db: Database.Database, lessonId: number): StoredQaReview[] {
  return db
    .prepare("SELECT * FROM qa_reviews WHERE lesson_id = ? ORDER BY id ASC")
    .all(lessonId) as StoredQaReview[];
}
