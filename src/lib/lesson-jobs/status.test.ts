import { describe, expect, it } from "vitest";
import type { NextLessonJob } from "@/types";
import { formatDuration, parseJobProgressEvents, summarizeJobProgress } from "./status";

function job(overrides: Partial<NextLessonJob> = {}): NextLessonJob {
  return {
    id: 1,
    subject_id: 1,
    completed_lesson_id: 10,
    discarded_lesson_id: null,
    trigger_event: "lesson.completed",
    adapter: "local-queue",
    status: "dispatched",
    payload: null,
    adapter_ref: "local-queue",
    error: null,
    dispatched_at: "2026-06-29T13:00:00.000Z",
    completed_at: null,
    created_at: "2026-06-29T13:00:00.000Z",
    updated_at: "2026-06-29T13:00:00.000Z",
    harness_status: "running",
    harness_stage: "generating_lesson",
    progress_events: JSON.stringify([
      { ts: "2026-06-29T13:00:00.000Z", stage: "lesson_completed", message: "Lesson completion recorded" },
      { ts: "2026-06-29T13:00:20.000Z", stage: "mastery.updated", message: "Updated mastery signals" },
      { ts: "2026-06-29T13:00:45.000Z", stage: "generating_lesson", message: "Generating the next lesson" },
    ]),
    retry_count: 0,
    last_error_detail: null,
    provider_name: null,
    output_lesson_id: null,
    ...overrides,
  };
}

describe("lesson job progress status", () => {
  it("parses structured progress events safely", () => {
    expect(parseJobProgressEvents(null)).toEqual([]);
    expect(parseJobProgressEvents("not-json")).toEqual([]);
    expect(parseJobProgressEvents(JSON.stringify([{ stage: "planning" }]))).toEqual([
      { ts: null, stage: "planning", message: "Planning next lesson" },
    ]);
  });

  it("summarizes active jobs with stage, percent, and ETA", () => {
    const summary = summarizeJobProgress(job(), Date.parse("2026-06-29T13:01:00.000Z"));
    expect(summary.label).toBe("Next lesson generation");
    expect(summary.stageLabel).toBe("Generating lesson");
    expect(summary.percent).toBeGreaterThan(30);
    expect(summary.percent).toBeLessThan(100);
    expect(summary.remainingSeconds).toBeGreaterThan(0);
    expect(summary.detail).toContain("left");
    expect(summary.events).toHaveLength(3);
  });

  it("marks completed jobs ready with no remaining time", () => {
    const summary = summarizeJobProgress(
      job({
        status: "completed",
        completed_at: "2026-06-29T13:01:30.000Z",
        harness_status: "done",
        harness_stage: "lesson.generated",
        output_lesson_id: 11,
      }),
      Date.parse("2026-06-29T13:02:00.000Z")
    );
    expect(summary.isDone).toBe(true);
    expect(summary.percent).toBe(100);
    expect(summary.remainingSeconds).toBe(0);
    expect(summary.detail).toBe("Ready to open");
  });

  it("formats time estimates compactly", () => {
    expect(formatDuration(0)).toBe("now");
    expect(formatDuration(12)).toBe("15s");
    expect(formatDuration(61)).toBe("2m");
    expect(formatDuration(3_900)).toBe("1h 5m");
  });
});
