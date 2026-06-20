import type {
  CompletionAdapter,
  CompletionHookAdapter,
  RegenerationHookAdapter,
} from "@/types";
import { noopAdapter, noopRegenerationAdapter } from "./noop";
import { localQueueAdapter, localQueueRegenerationAdapter } from "./local-queue";
import { webhookAdapter, webhookRegenerationAdapter } from "./webhook";
import { doraTaskAdapter, doraTaskRegenerationAdapter } from "./dora-task";

const ADAPTERS: Record<CompletionAdapter, CompletionHookAdapter> = {
  noop: noopAdapter,
  "local-queue": localQueueAdapter,
  webhook: webhookAdapter,
  "dora-task": doraTaskAdapter,
};

const REGENERATION_ADAPTERS: Record<CompletionAdapter, RegenerationHookAdapter> = {
  noop: noopRegenerationAdapter,
  "local-queue": localQueueRegenerationAdapter,
  webhook: webhookRegenerationAdapter,
  "dora-task": doraTaskRegenerationAdapter,
};

/**
 * Returns the configured completion adapter.
 * Priority: AVOCADOCORE_COMPLETION_ADAPTER env var, then 'noop'.
 */
export function getCompletionAdapter(): CompletionHookAdapter {
  const name = (process.env.AVOCADOCORE_COMPLETION_ADAPTER || "noop") as CompletionAdapter;
  return ADAPTERS[name] ?? ADAPTERS.noop;
}

/**
 * Returns the configured regeneration adapter for lesson.discarded events.
 * Uses the same adapter name as the completion adapter (same env var).
 * Falls back to noop so a missing config never throws.
 */
export function getRegenerationAdapter(): RegenerationHookAdapter {
  const name = (process.env.AVOCADOCORE_COMPLETION_ADAPTER || "noop") as CompletionAdapter;
  return REGENERATION_ADAPTERS[name] ?? REGENERATION_ADAPTERS.noop;
}

export {
  noopAdapter, noopRegenerationAdapter,
  localQueueAdapter, localQueueRegenerationAdapter,
  webhookAdapter, webhookRegenerationAdapter,
  doraTaskAdapter, doraTaskRegenerationAdapter,
};
export { ADAPTERS, REGENERATION_ADAPTERS };
