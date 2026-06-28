import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getCompletionAdapter,
  getRegenerationAdapter,
  getSubjectCreatedDispatcher,
  noopAdapter,
  noopRegenerationAdapter,
  noopSubjectCreatedDispatcher,
  localQueueAdapter,
  localQueueRegenerationAdapter,
  localQueueSubjectCreatedDispatcher,
  webhookAdapter,
  webhookRegenerationAdapter,
  webhookSubjectCreatedDispatcher,
  doraTaskAdapter,
  doraTaskRegenerationAdapter,
  doraTaskSubjectCreatedDispatcher,
} from "../index";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCompletionAdapter", () => {
  it("returns noop adapter when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getCompletionAdapter()).toBe(noopAdapter);
  });

  it("returns noop adapter for 'noop'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "noop");
    expect(getCompletionAdapter()).toBe(noopAdapter);
  });

  it("returns local-queue adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "local-queue");
    expect(getCompletionAdapter()).toBe(localQueueAdapter);
  });

  it("returns webhook adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "webhook");
    expect(getCompletionAdapter()).toBe(webhookAdapter);
  });

  it("returns dora-task adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "dora-task");
    expect(getCompletionAdapter()).toBe(doraTaskAdapter);
  });

  it("falls back to noop for unknown adapter name", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "unknown-adapter");
    expect(getCompletionAdapter()).toBe(noopAdapter);
  });

  it("all completion adapters have a name and dispatch function", () => {
    for (const adapter of [noopAdapter, localQueueAdapter, webhookAdapter, doraTaskAdapter]) {
      expect(typeof adapter.name).toBe("string");
      expect(adapter.name.length).toBeGreaterThan(0);
      expect(typeof adapter.dispatch).toBe("function");
    }
  });
});

describe("getRegenerationAdapter", () => {
  it("returns noop regeneration adapter when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getRegenerationAdapter()).toBe(noopRegenerationAdapter);
  });

  it("returns noop regeneration adapter for 'noop'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "noop");
    expect(getRegenerationAdapter()).toBe(noopRegenerationAdapter);
  });

  it("returns local-queue regeneration adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "local-queue");
    expect(getRegenerationAdapter()).toBe(localQueueRegenerationAdapter);
  });

  it("returns webhook regeneration adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "webhook");
    expect(getRegenerationAdapter()).toBe(webhookRegenerationAdapter);
  });

  it("returns dora-task regeneration adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "dora-task");
    expect(getRegenerationAdapter()).toBe(doraTaskRegenerationAdapter);
  });

  it("falls back to noop for unknown adapter name", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "unknown-adapter");
    expect(getRegenerationAdapter()).toBe(noopRegenerationAdapter);
  });

  it("completion and regeneration adapters share the same name key", () => {
    // Both getters use the same env var — same key must return paired adapters
    const pairs = [
      ["noop", noopAdapter, noopRegenerationAdapter],
      ["local-queue", localQueueAdapter, localQueueRegenerationAdapter],
      ["webhook", webhookAdapter, webhookRegenerationAdapter],
      ["dora-task", doraTaskAdapter, doraTaskRegenerationAdapter],
    ] as const;

    for (const [name, completion, regeneration] of pairs) {
      vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", name);
      expect(getCompletionAdapter()).toBe(completion);
      expect(getRegenerationAdapter()).toBe(regeneration);
    }
  });

  it("noop regeneration adapter dispatches without throwing", async () => {
    const event = {
      event: "lesson.discarded" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_description: null,
      subject_goals: null,
      subject_criteria: null,
      discarded_lesson_id: 42,
      discarded_lesson_title: "Test Lesson",
      discarded_lesson_status: "queued" as const,
      discard_reason: "Too easy",
      mastery_score: 0,
      completed_lessons: [],
      mastery_signals: [],
      workpad_summary: null,
      discarded_at: new Date().toISOString(),
    };
    const result = await noopRegenerationAdapter.dispatch(event);
    expect(result.ok).toBe(true);
    expect(typeof result.ref).toBe("string");
  });
});

// ─── Subject Created Dispatcher ───────────────────────────────────────────────

const subjectCreatedEvent = {
  event: "subject.created" as const,
  learner_id: 1,
  subject_id: 42,
  subject_title: "Test Subject",
  subject_description: "A test subject for unit testing.",
  subject_goals: "Learn the fundamentals.",
  subject_criteria: null,
  current_level: "familiarity" as const,
  created_at: new Date().toISOString(),
};

describe("getSubjectCreatedDispatcher", () => {
  it("returns noop dispatcher when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getSubjectCreatedDispatcher()).toBe(noopSubjectCreatedDispatcher);
  });

  it("returns local-queue dispatcher", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "local-queue");
    expect(getSubjectCreatedDispatcher()).toBe(localQueueSubjectCreatedDispatcher);
  });

  it("returns webhook dispatcher", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "webhook");
    expect(getSubjectCreatedDispatcher()).toBe(webhookSubjectCreatedDispatcher);
  });

  it("returns dora-task dispatcher", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "dora-task");
    expect(getSubjectCreatedDispatcher()).toBe(doraTaskSubjectCreatedDispatcher);
  });

  it("falls back to noop for unknown adapter name", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "unknown-thing");
    expect(getSubjectCreatedDispatcher()).toBe(noopSubjectCreatedDispatcher);
  });

  it("noop dispatcher returns ok without side effects", async () => {
    const result = await noopSubjectCreatedDispatcher(subjectCreatedEvent);
    expect(result.ok).toBe(true);
    expect(typeof result.ref).toBe("string");
    expect(result.error).toBeUndefined();
  });

  it("dora-task dispatcher returns error when no endpoint configured", async () => {
    vi.stubEnv("AVOCADOCORE_DORA_ENDPOINT", "");
    const result = await doraTaskSubjectCreatedDispatcher(subjectCreatedEvent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("AVOCADOCORE_DORA_ENDPOINT");
  });

  it("webhook dispatcher returns error when no URL configured", async () => {
    vi.stubEnv("AVOCADOCORE_WEBHOOK_URL", "");
    const result = await webhookSubjectCreatedDispatcher(subjectCreatedEvent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("AVOCADOCORE_WEBHOOK_URL");
  });

  it("all subject-created dispatchers have the correct function signature", () => {
    for (const dispatcher of [
      noopSubjectCreatedDispatcher,
      localQueueSubjectCreatedDispatcher,
      webhookSubjectCreatedDispatcher,
      doraTaskSubjectCreatedDispatcher,
    ]) {
      expect(typeof dispatcher).toBe("function");
    }
  });
});
