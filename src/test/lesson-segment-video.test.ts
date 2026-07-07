/**
 * Unit tests for validateLessonSegmentVideo + its wiring into lesson_part
 * content validation.
 */
import { describe, it, expect } from "vitest";
import {
  validateLessonSegmentVideo,
  validateLessonPartContent,
  type LessonSegmentVideo,
} from "@/lib/lesson-content/schema";

function goodVideo(): LessonSegmentVideo {
  return {
    file_path: "runtime_artifacts/videos/lesson_15/activity_85.mp4",
    poster_path: "runtime_artifacts/videos/lesson_15/activity_85.poster.png",
    captions_path: "runtime_artifacts/videos/lesson_15/activity_85.vtt",
    duration_sec: 272.18,
    width: 1920,
    height: 1080,
    source: { tool: "manim-ce", version: "manim-ce/0.19.1", scene_module: "manim/scenes/lesson_15/activity_85.py" },
    review: { reviewed_at: "2026-07-07T12:00:00Z", frames_reviewed: 36, iterations: 1 },
  };
}

describe("validateLessonSegmentVideo", () => {
  it("accepts a well-formed video", () => {
    const r = validateLessonSegmentVideo(goodVideo());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("accepts a video without optional sidecars", () => {
    const v = goodVideo();
    delete v.poster_path;
    delete v.captions_path;
    expect(validateLessonSegmentVideo(v).valid).toBe(true);
  });

  it("rejects a non-mp4 / wrong-root file_path", () => {
    expect(validateLessonSegmentVideo({ ...goodVideo(), file_path: "videos/x.mp4" }).valid).toBe(false);
    expect(validateLessonSegmentVideo({ ...goodVideo(), file_path: "runtime_artifacts/videos/x.webm" }).valid).toBe(
      false
    );
  });

  it("rejects non-positive duration/dimensions", () => {
    expect(validateLessonSegmentVideo({ ...goodVideo(), duration_sec: 0 }).errors).toContain(
      "duration_sec must be a positive number"
    );
    expect(validateLessonSegmentVideo({ ...goodVideo(), width: 0 }).valid).toBe(false);
  });

  it("rejects a bad captions extension", () => {
    expect(validateLessonSegmentVideo({ ...goodVideo(), captions_path: "x.srt" }).valid).toBe(false);
  });

  it("requires source.tool manim-ce and non-empty version/scene_module", () => {
    expect(validateLessonSegmentVideo({ ...goodVideo(), source: { tool: "ffmpeg", version: "x", scene_module: "y" } as never }).valid).toBe(false);
    expect(
      validateLessonSegmentVideo({ ...goodVideo(), source: { tool: "manim-ce", version: "", scene_module: "y" } as never }).valid
    ).toBe(false);
  });

  it("requires a review block proving the review happened", () => {
    const v = goodVideo();
    // @ts-expect-error deleting a required field for the test
    delete v.review;
    expect(validateLessonSegmentVideo(v).valid).toBe(false);
    expect(validateLessonSegmentVideo({ ...goodVideo(), review: { reviewed_at: "now", frames_reviewed: 0, iterations: 1 } }).valid).toBe(
      false
    );
    expect(validateLessonSegmentVideo({ ...goodVideo(), review: { reviewed_at: "now", frames_reviewed: 3, iterations: 0 } }).valid).toBe(
      false
    );
  });

  it("rejects non-objects", () => {
    expect(validateLessonSegmentVideo(null).valid).toBe(false);
    expect(validateLessonSegmentVideo("x").valid).toBe(false);
  });
});

describe("validateLessonPartContent wiring for audio.video", () => {
  const baseAudioScript = "L".repeat(220);
  function partContent(video?: unknown) {
    return {
      reading: {
        intro: "x".repeat(60),
        blocks: [{ type: "text", content: "y".repeat(60) }],
        summary: "z".repeat(40),
      },
      audio: {
        script: baseAudioScript,
        transcript: baseAudioScript,
        synced_visual: undefined,
        ...(video !== undefined ? { video } : {}),
      },
      interactive: { schema_version: 1, instructions: "do", type: "sandbox" },
    };
  }

  it("does not error when audio.video is absent", () => {
    const r = validateLessonPartContent(partContent());
    expect(r.errors.some((e) => e.startsWith("audio.video:"))).toBe(false);
  });

  it("surfaces audio.video errors with the audio.video prefix", () => {
    const r = validateLessonPartContent(partContent({ file_path: "bad", duration_sec: -1 }));
    expect(r.errors.some((e) => e.startsWith("audio.video:"))).toBe(true);
  });

  it("passes video validation for a well-formed audio.video", () => {
    const r = validateLessonPartContent(partContent(goodVideo()));
    expect(r.errors.some((e) => e.startsWith("audio.video:"))).toBe(false);
  });
});
