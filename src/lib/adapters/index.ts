import type { CompletionAdapter, CompletionHookAdapter } from "@/types";
import { noopAdapter } from "./noop";
import { localQueueAdapter } from "./local-queue";
import { webhookAdapter } from "./webhook";
import { doraTaskAdapter } from "./dora-task";

const ADAPTERS: Record<CompletionAdapter, CompletionHookAdapter> = {
  noop: noopAdapter,
  "local-queue": localQueueAdapter,
  webhook: webhookAdapter,
  "dora-task": doraTaskAdapter,
};

/**
 * Returns the configured completion adapter.
 * Priority: AVOCADOCORE_COMPLETION_ADAPTER env var, then 'noop'.
 */
export function getCompletionAdapter(): CompletionHookAdapter {
  const name = (process.env.AVOCADOCORE_COMPLETION_ADAPTER || "noop") as CompletionAdapter;
  return ADAPTERS[name] ?? ADAPTERS.noop;
}

export { noopAdapter, localQueueAdapter, webhookAdapter, doraTaskAdapter };
export { ADAPTERS };
