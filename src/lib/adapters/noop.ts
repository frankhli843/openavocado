import type { CompletionHookAdapter, LessonCompletedEvent } from "@/types";

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
