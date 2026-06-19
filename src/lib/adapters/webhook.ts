import type { CompletionHookAdapter, LessonCompletedEvent } from "@/types";

/**
 * Webhook adapter — POSTs the lesson.completed event to a configured endpoint.
 * Configure via AVOCADOCORE_WEBHOOK_URL env var or explicit config.
 */
export const webhookAdapter: CompletionHookAdapter = {
  name: "webhook",
  async dispatch(event: LessonCompletedEvent, config?: Record<string, unknown>) {
    const url =
      (config?.url as string | undefined) ||
      process.env.AVOCADOCORE_WEBHOOK_URL;

    if (!url) {
      return {
        ok: false,
        error: "webhook adapter: no URL configured (AVOCADOCORE_WEBHOOK_URL or config.url)",
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        return { ok: false, error: `webhook responded with ${res.status}` };
      }

      const ref = `webhook-${res.status}-${Date.now()}`;
      return { ok: true, ref };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};
