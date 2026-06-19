import type { CompletionHookAdapter, LessonCompletedEvent } from "@/types";

/**
 * Dora-task adapter — creates a Doramon todo-loop task for next-lesson generation.
 *
 * This adapter is deployment-specific. It expects local config (gitignored .env) to
 * provide the Doramon endpoint or CLI path. The reusable repo ships this as a reference
 * implementation, not hardcoded with any personal IDs.
 *
 * Required env vars:
 *   AVOCADOCORE_DORA_ENDPOINT  — HTTP endpoint to POST to (optional, falls back to CLI)
 *   AVOCADOCORE_DORA_PROJECT   — Doramon project slug for next-lesson tasks
 *   AVOCADOCORE_DORA_CHANNEL   — Discord channel ID for post-generation review (optional)
 */
export const doraTaskAdapter: CompletionHookAdapter = {
  name: "dora-task",
  async dispatch(event: LessonCompletedEvent, config?: Record<string, unknown>) {
    const endpoint =
      (config?.endpoint as string | undefined) ||
      process.env.AVOCADOCORE_DORA_ENDPOINT;
    const project =
      (config?.project as string | undefined) ||
      process.env.AVOCADOCORE_DORA_PROJECT ||
      "avocadocore";
    const channel =
      (config?.channel as string | undefined) ||
      process.env.AVOCADOCORE_DORA_CHANNEL;

    if (!endpoint) {
      // No endpoint configured — fall back to logging for local development
      console.warn("[completion:dora-task] No AVOCADOCORE_DORA_ENDPOINT set. Logging event only.");
      console.log("[completion:dora-task] Event:", JSON.stringify(event, null, 2));
      return {
        ok: false,
        error: "dora-task adapter: no endpoint configured (AVOCADOCORE_DORA_ENDPOINT)",
      };
    }

    // Build acceptance criteria for the next-lesson Dora task
    const acceptance = [
      `Generate the next lesson for subject "${event.subject_title}" (learner ${event.learner_id}).`,
      ``,
      `Prior lesson: "${event.lesson_title}"`,
      `Goals: ${event.lesson_goals.join(", ")}`,
      ``,
      `Assessment Q&A from completed lesson:`,
      event.assessment_qa
        .map((qa) => `- Q: ${qa.question}\n  A: ${qa.learner_answer}`)
        .join("\n"),
      ``,
      `Concepts to review: ${event.concepts_to_review.join(", ") || "none"}`,
      `Concepts ready to advance: ${event.concepts_ready_to_advance.join(", ") || "none"}`,
      ``,
      `Delivery:`,
      channel
        ? `After generating the next lesson, post a review in <#${channel}> explaining which answers were right, which were wrong, why, and how the next lesson addresses the gaps. Tag the learner in the thread.`
        : `After generating the next lesson, confirm completion in the appropriate channel.`,
    ].join("\n");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          title: `Generate next lesson: ${event.subject_title} (after "${event.lesson_title}")`,
          acceptance,
          origin_platform: "avocadocore",
          metadata: { lesson_completed_event: event },
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `dora endpoint responded with ${res.status}` };
      }

      const data = (await res.json()) as { id?: string };
      const ref = data.id || `dora-task-${Date.now()}`;
      return { ok: true, ref };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};
