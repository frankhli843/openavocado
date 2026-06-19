import type { CompletionHookAdapter, LessonCompletedEvent } from "@/types";
import { getDb } from "@/db/connection";

/**
 * Local-queue adapter — writes the lesson.completed event to the
 * next_lesson_jobs table for offline/async processing.
 * No external network calls. Useful for environments without a task runner.
 */
export const localQueueAdapter: CompletionHookAdapter = {
  name: "local-queue",
  async dispatch(event: LessonCompletedEvent) {
    try {
      const db = getDb();
      const result = db
        .prepare(
          `INSERT INTO next_lesson_jobs (subject_id, completed_lesson_id, adapter, status, payload)
           VALUES (?, ?, 'local-queue', 'pending', ?)`
        )
        .run(event.subject_id, event.lesson_id, JSON.stringify(event));

      const ref = `local-queue-job-${result.lastInsertRowid}`;
      console.log(`[completion:local-queue] Enqueued ${ref}`);
      return { ok: true, ref };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};
