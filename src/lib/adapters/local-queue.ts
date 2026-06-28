import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  RegenerationHookAdapter,
  LessonDiscardedEvent,
  SubjectCreatedEvent,
} from "@/types";
import { getDb } from "@/db/connection";
import { generateStarterLesson } from "@/lib/lesson-generator/starter-lesson";

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
          `INSERT INTO next_lesson_jobs (subject_id, completed_lesson_id, trigger_event, adapter, status, payload)
           VALUES (?, ?, 'lesson.completed', 'local-queue', 'pending', ?)`
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

/**
 * Local-queue subject.created dispatcher — generates a deterministic orientation
 * lesson synchronously. No LLM or task runner required. Suitable for self-hosted
 * deployments (devavo, prodavo) where Dora or webhook automation is not available.
 *
 * The lesson is created immediately; the learner sees it as soon as the subject
 * detail page loads.
 */
export async function localQueueSubjectCreatedDispatcher(
  event: SubjectCreatedEvent
): Promise<{ ok: boolean; ref?: string; error?: string }> {
  try {
    const db = getDb();
    const { lesson_id, lesson_title } = generateStarterLesson(db, event);
    const ref = `local-queue-starter-lesson-${lesson_id}`;
    console.log(
      `[subject.created:local-queue] Created orientation lesson "${lesson_title}" (id ${lesson_id}) for subject ${event.subject_id}`
    );
    return { ok: true, ref };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[subject.created:local-queue] Error generating starter lesson:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Local-queue regeneration adapter — writes the lesson.discarded event to the
 * next_lesson_jobs table. The discard endpoint already writes a job row, so
 * this is a no-op at the adapter level (the endpoint handles persistence).
 * Returns ok so the endpoint flow continues cleanly.
 */
export const localQueueRegenerationAdapter: RegenerationHookAdapter = {
  name: "local-queue",
  async dispatch(event: LessonDiscardedEvent) {
    try {
      console.log(
        `[regeneration:local-queue] Lesson.discarded enqueued for subject "${event.subject_title}" (lesson ${event.discarded_lesson_id})`
      );
      return { ok: true, ref: `local-queue-regen-${event.discarded_lesson_id}-${Date.now()}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};
