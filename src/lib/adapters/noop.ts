import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  RegenerationHookAdapter,
  LessonDiscardedEvent,
  SubjectCreatedEvent,
} from "@/types";

/**
 * Noop adapter — records lesson completion locally without triggering any
 * external automation. Safe default for local development.
 */
export const noopAdapter: CompletionHookAdapter = {
  name: "noop",
  async dispatch(event: LessonCompletedEvent) {
    console.log(
      `[completion:noop] Lesson "${event.lesson_title}" completed by learner ${event.learner_id}`
    );
    return { ok: true, ref: `noop-${event.lesson_id}-${Date.now()}` };
  },
};

/**
 * Noop regeneration adapter — records the discard event locally without
 * triggering external automation. Safe default for local development.
 */
export const noopRegenerationAdapter: RegenerationHookAdapter = {
  name: "noop",
  async dispatch(event: LessonDiscardedEvent) {
    console.log(
      `[regeneration:noop] Lesson "${event.discarded_lesson_title}" discarded by learner ${event.learner_id}.` +
        (event.discard_reason ? ` Reason: ${event.discard_reason}` : "")
    );
    return { ok: true, ref: `noop-regen-${event.discarded_lesson_id}-${Date.now()}` };
  },
};

/**
 * Noop subject.created dispatcher — logs the event without triggering any
 * first-lesson generation. No lesson will appear; use local-queue for
 * self-hosted deployments or dora-task for automated generation.
 */
export async function noopSubjectCreatedDispatcher(
  event: SubjectCreatedEvent
): Promise<{ ok: boolean; ref?: string; error?: string }> {
  console.log(
    `[subject.created:noop] Subject "${event.subject_title}" created by learner ${event.learner_id}. No first-lesson dispatch configured.`
  );
  return { ok: true, ref: `noop-subject-${event.subject_id}-${Date.now()}` };
}
