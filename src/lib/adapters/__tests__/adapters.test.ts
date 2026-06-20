import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getCompletionAdapter,
  getRegenerationAdapter,
  noopAdapter,
  noopRegenerationAdapter,
  localQueueAdapter,
  localQueueRegenerationAdapter,
  webhookAdapter,
  webhookRegenerationAdapter,
  doraTaskAdapter,
  doraTaskRegenerationAdapter,
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
