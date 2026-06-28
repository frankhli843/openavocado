import type {
  CompletionAdapter,
  CompletionHookAdapter,
  RegenerationHookAdapter,
  SubjectCreatedEvent,
} from "@/types";
import { noopAdapter, noopRegenerationAdapter, noopSubjectCreatedDispatcher } from "./noop";
import {
  localQueueAdapter,
  localQueueRegenerationAdapter,
  localQueueSubjectCreatedDispatcher,
} from "./local-queue";
import {
  webhookAdapter,
  webhookRegenerationAdapter,
  webhookSubjectCreatedDispatcher,
} from "./webhook";
import {
  doraTaskAdapter,
  doraTaskRegenerationAdapter,
  doraTaskSubjectCreatedDispatcher,
} from "./dora-task";

/** Function signature for subject.created first-lesson dispatch. */
export type SubjectCreatedDispatcher = (
  event: SubjectCreatedEvent,
  config?: Record<string, unknown>
) => Promise<{ ok: boolean; ref?: string; error?: string }>;

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

/**
 * Returns the configured subject.created dispatcher.
 * Uses the same adapter env var as the completion adapter.
 * Falls back to noop so a missing config never throws.
 *
 * For prodavo: set AVOCADOCORE_COMPLETION_ADAPTER=local-queue to get
 * synchronous starter-lesson generation on subject creation.
 */
export function getSubjectCreatedDispatcher(): SubjectCreatedDispatcher {
  const name = (process.env.AVOCADOCORE_COMPLETION_ADAPTER || "noop") as CompletionAdapter;
  return SUBJECT_CREATED_DISPATCHERS[name] ?? SUBJECT_CREATED_DISPATCHERS.noop;
}

export {
  noopAdapter, noopRegenerationAdapter, noopSubjectCreatedDispatcher,
  localQueueAdapter, localQueueRegenerationAdapter, localQueueSubjectCreatedDispatcher,
  webhookAdapter, webhookRegenerationAdapter, webhookSubjectCreatedDispatcher,
  doraTaskAdapter, doraTaskRegenerationAdapter, doraTaskSubjectCreatedDispatcher,
};
export { ADAPTERS, REGENERATION_ADAPTERS, SUBJECT_CREATED_DISPATCHERS };
