import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  RegenerationHookAdapter,
  LessonDiscardedEvent,
} from "@/types";

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

/**
 * Webhook regeneration adapter — POSTs the lesson.discarded event to a
 * configured endpoint. Uses the same AVOCADOCORE_WEBHOOK_URL by default, or a
 * separate AVOCADOCORE_REGEN_WEBHOOK_URL if configured.
 */
export const webhookRegenerationAdapter: RegenerationHookAdapter = {
  name: "webhook",
  async dispatch(event: LessonDiscardedEvent, config?: Record<string, unknown>) {
    const url =
      (config?.regen_url as string | undefined) ||
      process.env.AVOCADOCORE_REGEN_WEBHOOK_URL ||
      (config?.url as string | undefined) ||
      process.env.AVOCADOCORE_WEBHOOK_URL;

    if (!url) {
      return {
        ok: false,
        error:
          "webhook regeneration adapter: no URL configured " +
          "(AVOCADOCORE_REGEN_WEBHOOK_URL, AVOCADOCORE_WEBHOOK_URL, or config.url)",
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

      return { ok: true, ref: `webhook-regen-${res.status}-${Date.now()}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};
