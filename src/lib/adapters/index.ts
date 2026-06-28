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

const SUBJECT_CREATED_DISPATCHERS: Record<CompletionAdapter, SubjectCreatedDispatcher> = {
  noop: noopSubjectCreatedDispatcher,
  "local-queue": localQueueSubjectCreatedDispatcher,
  webhook: webhookSubjectCreatedDispatcher,
  "dora-task": doraTaskSubjectCreatedDispatcher,
};

/**
 * Returns the configured completion adapter.
 * Priority: AVOCADOCORE_COMPLETION_ADAPTER env var, then 'dora-task'.
 */
export function getCompletionAdapter(): CompletionHookAdapter {
  const name = (process.env.AVOCADOCORE_COMPLETION_ADAPTER || "dora-task") as CompletionAdapter;
  return ADAPTERS[name] ?? ADAPTERS.noop;
}

/**
 * Returns the configured regeneration adapter for lesson.discarded events.
 * Uses the same adapter name as the completion adapter (same env var).
 * Defaults to dora-task so discarded lessons request real replacement tasks.
 */
export function getRegenerationAdapter(): RegenerationHookAdapter {
  const name = (process.env.AVOCADOCORE_COMPLETION_ADAPTER || "dora-task") as CompletionAdapter;
  return REGENERATION_ADAPTERS[name] ?? REGENERATION_ADAPTERS.noop;
}

/**
 * Returns the configured subject.created dispatcher.
 * The dispatcher is responsible for generating the first lesson (or initial
 * assessment) when a new subject is created. Defaults to dora-task for
 * frankavo; prodavo uses local-queue for synchronous initial assessment generation.
 */
export function getSubjectCreatedDispatcher(): SubjectCreatedDispatcher {
  const name = (process.env.AVOCADOCORE_COMPLETION_ADAPTER || "dora-task") as CompletionAdapter;
  return SUBJECT_CREATED_DISPATCHERS[name] ?? SUBJECT_CREATED_DISPATCHERS.noop;
}

export {
  noopAdapter, noopRegenerationAdapter, noopSubjectCreatedDispatcher,
  localQueueAdapter, localQueueRegenerationAdapter, localQueueSubjectCreatedDispatcher,
  webhookAdapter, webhookRegenerationAdapter, webhookSubjectCreatedDispatcher,
  doraTaskAdapter, doraTaskRegenerationAdapter, doraTaskSubjectCreatedDispatcher,
};
export { ADAPTERS, REGENERATION_ADAPTERS, SUBJECT_CREATED_DISPATCHERS };
