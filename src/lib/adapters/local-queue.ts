import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  RegenerationHookAdapter,
  LessonDiscardedEvent,
  SubjectCreatedDispatcher,
} from "@/types";
import { getDb } from "@/db/connection";
import { generateInitialAssessment } from "@/lib/lesson-generator/initial-assessment";
import { generateNextLesson } from "@/lib/lesson-generator/next-lesson";
import { generateLessonAudio } from "@/lib/audio/generate-lesson-audio";

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
      const result = generateNextLesson(db, event);
      if (process.env.AVOCADOCORE_LOCAL_QUEUE_AUDIO !== "skip") {
        await generateLessonAudio(db, result.lesson_id);
      }

      const ref = `local-queue-lesson-${result.lesson_id}`;
      console.log(
        `[completion:local-queue] Generated ${ref} for subject ${event.subject_id}`
      );
      return { ok: true, ref, lesson_id: result.lesson_id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};

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

/**
 * Local-queue subject.created dispatcher — synchronously generates an initial
 * assessment lesson so the learner has something to do immediately.
 *
 * This is the AvocadoCore-native path for prodavo and other self-hosted
 * deployments that do not have a Dora endpoint or external task runner.
 *
 * The initial assessment:
 *  - sequence_number=0 (before teaching lessons)
 *  - Title prefix "Initial Assessment:" (UI-distinguishable)
 *  - Assessment activities only — no teaching text, no audio, no widgets
 *  - Open-ended questions to calibrate the learner's existing knowledge
 *
 * Idempotent: if a lesson with sequence_number=0 already exists for this
 * subject, returns the existing lesson ref without creating a duplicate.
 */
export const localQueueSubjectCreatedDispatcher: SubjectCreatedDispatcher = async (event) => {
  try {
    const db = getDb();

    // Idempotency check: skip if an initial assessment already exists
    const existing = db
      .prepare(
        `SELECT id, title FROM lessons WHERE subject_id = ? AND sequence_number = 0 LIMIT 1`
      )
      .get(event.subject_id) as { id: number; title: string } | undefined;

    if (existing) {
      console.log(
        `[subject.created:local-queue] Initial assessment already exists ` +
          `(lesson ${existing.id}) for subject ${event.subject_id} — skipping.`
      );
      return {
        ok: true,
        ref: `local-queue-assessment-existing-${existing.id}`,
        lesson_id: existing.id,
      };
    }

    const result = generateInitialAssessment(db, event);
    const ref = `local-queue-assessment-${result.lesson_id}`;
    console.log(
      `[subject.created:local-queue] Created initial assessment "${result.lesson_title}" ` +
        `(lesson ${result.lesson_id}, ${result.question_count} questions)`
    );
    return { ok: true, ref, lesson_id: result.lesson_id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[subject.created:local-queue] Failed:`, err);
    return { ok: false, error: msg };
  }
};
