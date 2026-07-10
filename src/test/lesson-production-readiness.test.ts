import { describe, expect, it } from "vitest";
import { validateLessonProductionReadiness } from "../lib/lesson-generator/readiness";

const video = {
  file_path: "runtime_artifacts/videos/lesson_364/activity_1906.mp4",
  duration_sec: 120,
  width: 1920,
  height: 1080,
  source: { tool: "manim-ce" as const, version: "manim-ce/0.19.1", scene_module: "manim/scenes/lesson_364/activity_1906.py" },
  review: { reviewed_at: "2026-07-10T15:00:00.000Z", frames_reviewed: 3, iterations: 1 },
};

function approvedArtifact(slug: string) {
  return {
    slug,
    build_status: "qa_approved",
    approved_at: "2026-07-10T15:00:00.000Z",
    compiled_asset_path: `visual-artifacts/${slug}/bundle.js`,
    qa_notes: "Desktop and mobile screenshots passed.",
    qa_screenshot_ref: "state/qa.png",
  };
}

describe("validateLessonProductionReadiness", () => {
  it("rejects audio and lesson_part segments without registered videos", () => {
    const result = validateLessonProductionReadiness({
      activities: [
        {
          id: 1906,
          activity_type: "audio",
          title: "Audio",
          content: {
            orientation_visual: {
              artifact_slug: "overview-artifact",
              scene: { scene_id: "s1", title: "Scene", motif: "flow", description: "desc", panels: [] },
              cues: [],
            },
          },
        },
        {
          id: 1908,
          activity_type: "lesson_part",
          title: "Part",
          content: {
            audio: {
              synced_visual: {
                artifact_slug: "part-artifact",
                scene: { scene_id: "s2", title: "Scene", motif: "flow", description: "desc", panels: [] },
                cues: [],
              },
            },
            interactive: {
              widget_type: "bespoke-artifact",
              params: { artifact_slug: "part-artifact" },
            },
          },
        },
      ],
      generatedArtifacts: [
        { activity_id: 1906, artifact_type: "audio", file_path: "runtime_artifacts/audio/lesson_364_audio.mp3" },
        { activity_id: 1908, artifact_type: "audio", file_path: "runtime_artifacts/audio/lesson_364_activity_1908_audio.mp3" },
      ],
      visualArtifacts: [approvedArtifact("overview-artifact"), approvedArtifact("part-artifact")],
      options: { checkFiles: false },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("activity 1906"),
        expect.stringContaining("missing a registered segment video"),
        expect.stringContaining("activity 1908"),
        expect.stringContaining("has no generated_artifacts video row"),
      ])
    );
  });

  it("rejects referenced visual artifact slugs that are missing or not approved", () => {
    const result = validateLessonProductionReadiness({
      activities: [
        {
          id: 1906,
          activity_type: "audio",
          title: "Audio",
          content: {
            orientation_video: video,
            orientation_visual: {
              artifact_slug: "missing-artifact",
              scene: { scene_id: "s1", title: "Scene", motif: "flow", description: "desc", panels: [] },
              cues: [],
            },
          },
        },
        {
          id: 1908,
          activity_type: "lesson_part",
          title: "Part",
          content: {
            audio: {
              video: { ...video, file_path: "runtime_artifacts/videos/lesson_364/activity_1908.mp4" },
              synced_visual: {
                artifact_slug: "pending-artifact",
                scene: { scene_id: "s2", title: "Scene", motif: "flow", description: "desc", panels: [] },
                cues: [],
              },
            },
            interactive: {
              widget_type: "bespoke-artifact",
              params: { artifact_slug: "pending-artifact" },
            },
          },
        },
      ],
      generatedArtifacts: [
        { activity_id: 1906, artifact_type: "video", file_path: "runtime_artifacts/videos/lesson_364/activity_1906.mp4" },
        { activity_id: 1908, artifact_type: "video", file_path: "runtime_artifacts/videos/lesson_364/activity_1908.mp4" },
      ],
      visualArtifacts: [
        {
          slug: "pending-artifact",
          build_status: "pending_qa",
          approved_at: null,
          compiled_asset_path: null,
          qa_notes: null,
          qa_screenshot_ref: null,
        },
      ],
      options: { checkFiles: false },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('visual artifact "missing-artifact"'),
        expect.stringContaining("has no visual_artifacts row"),
        expect.stringContaining('visual artifact "pending-artifact"'),
        expect.stringContaining("build_status is pending_qa"),
      ])
    );
  });

  it("accepts registered videos and approved visual artifacts", () => {
    const result = validateLessonProductionReadiness({
      activities: [
        {
          id: 1906,
          activity_type: "audio",
          title: "Audio",
          content: {
            orientation_video: video,
            orientation_visual: {
              artifact_slug: "overview-artifact",
              scene: { scene_id: "s1", title: "Scene", motif: "flow", description: "desc", panels: [] },
              cues: [],
            },
          },
        },
        {
          id: 1908,
          activity_type: "lesson_part",
          title: "Part",
          content: {
            audio: {
              video: { ...video, file_path: "runtime_artifacts/videos/lesson_364/activity_1908.mp4" },
              synced_visual: {
                artifact_slug: "part-artifact",
                scene: { scene_id: "s2", title: "Scene", motif: "flow", description: "desc", panels: [] },
                cues: [],
              },
            },
            interactive: {
              widget_type: "bespoke-artifact",
              params: { artifact_slug: "part-artifact" },
            },
          },
        },
      ],
      generatedArtifacts: [
        { activity_id: 1906, artifact_type: "video", file_path: "runtime_artifacts/videos/lesson_364/activity_1906.mp4" },
        { activity_id: 1908, artifact_type: "video", file_path: "runtime_artifacts/videos/lesson_364/activity_1908.mp4" },
      ],
      visualArtifacts: [approvedArtifact("overview-artifact"), approvedArtifact("part-artifact")],
      options: { checkFiles: false },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
