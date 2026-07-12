import type {
  CompletionAdapter,
  CompletionHookAdapter,
  RegenerationHookAdapter,
  SubjectCreatedDispatcher,
} from "@/types";
import { noopAdapter, noopRegenerationAdapter, noopSubjectCreatedDispatcher } from "./noop";
import { localQueueAdapter, localQueueRegenerationAdapter, localQueueSubjectCreatedDispatcher } from "./local-queue";
import { webhookAdapter, webhookRegenerationAdapter, webhookSubjectCreatedDispatcher } from "./webhook";
import { doraTaskAdapter, doraTaskRegenerationAdapter, doraTaskSubjectCreatedDispatcher } from "./dora-task";
import { agentHarnessAdapter, agentHarnessRegenerationAdapter, agentHarnessSubjectCreatedDispatcher } from "./agent-harness";

const ADAPTERS: Record<CompletionAdapter, CompletionHookAdapter> = {
  noop: noopAdapter,
  "local-queue": localQueueAdapter,
  "agent-harness": agentHarnessAdapter,
  webhook: webhookAdapter,
  "dora-task": doraTaskAdapter,
};

const REGENERATION_ADAPTERS: Record<CompletionAdapter, RegenerationHookAdapter> = {
  noop: noopRegenerationAdapter,
  "local-queue": localQueueRegenerationAdapter,
  "agent-harness": agentHarnessRegenerationAdapter,
  webhook: webhookRegenerationAdapter,
  "dora-task": doraTaskRegenerationAdapter,
};

const SUBJECT_CREATED_DISPATCHERS: Record<CompletionAdapter, SubjectCreatedDispatcher> = {
  noop: noopSubjectCreatedDispatcher,
  "local-queue": localQueueSubjectCreatedDispatcher,
  "agent-harness": agentHarnessSubjectCreatedDispatcher,
  webhook: webhookSubjectCreatedDispatcher,
  "dora-task": doraTaskSubjectCreatedDispatcher,
};

export const DEFAULT_COMPLETION_ADAPTER: CompletionAdapter = "local-queue";

function isCompletionAdapter(value: string): value is CompletionAdapter {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, value);
}

export function getConfiguredCompletionAdapterName(): CompletionAdapter {
  const configured = process.env.AVOCADOCORE_COMPLETION_ADAPTER?.trim();
  if (!configured) return DEFAULT_COMPLETION_ADAPTER;
  return isCompletionAdapter(configured) ? configured : "noop";
}

/**
 * Returns the configured completion adapter.
 * Priority: AVOCADOCORE_COMPLETION_ADAPTER env var, then the local queue.
 */
export function getCompletionAdapter(): CompletionHookAdapter {
  return ADAPTERS[getConfiguredCompletionAdapterName()];
}

/**
 * Returns the configured regeneration adapter for lesson.discarded events.
 * Uses the same adapter name as the completion adapter (same env var).
 * Defaults to the local queue so a fresh clone can generate lessons without
 * private task infrastructure.
 */
export function getRegenerationAdapter(): RegenerationHookAdapter {
  return REGENERATION_ADAPTERS[getConfiguredCompletionAdapterName()];
}

/**
 * Returns the configured subject.created dispatcher.
 * The dispatcher is responsible for generating the first lesson (or initial
 * assessment) when a new subject is created. Defaults to local-queue for
 * self-contained local development.
 */
export function getSubjectCreatedDispatcher(): SubjectCreatedDispatcher {
  return SUBJECT_CREATED_DISPATCHERS[getConfiguredCompletionAdapterName()];
}

export {
  noopAdapter, noopRegenerationAdapter, noopSubjectCreatedDispatcher,
  localQueueAdapter, localQueueRegenerationAdapter, localQueueSubjectCreatedDispatcher,
  agentHarnessAdapter, agentHarnessRegenerationAdapter, agentHarnessSubjectCreatedDispatcher,
  webhookAdapter, webhookRegenerationAdapter, webhookSubjectCreatedDispatcher,
  doraTaskAdapter, doraTaskRegenerationAdapter, doraTaskSubjectCreatedDispatcher,
};
export { ADAPTERS, REGENERATION_ADAPTERS, SUBJECT_CREATED_DISPATCHERS };
