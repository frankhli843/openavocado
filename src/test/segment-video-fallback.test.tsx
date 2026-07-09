// @vitest-environment jsdom
//
// Strategy-A ("gate-and-shrink") retirement lock for the legacy audio+cue-swap
// visual path. These tests pin the RENDER-side invariant so the legacy fallback
// can never silently re-appear alongside a registered video, and can never be
// deleted out from under the pending_video window:
//
//   (i)  a segment WITH a registered video renders the <video> and NOT the
//        legacy cue-swap visual (and no fallback <audio>);
//   (ii) a segment WITHOUT a registered video still renders the legacy cue
//        visual + the accessibility <audio> element;
//   (iii) a registered video that errors at runtime degrades to the legacy path.
//
// Covers both render-side consumers: LessonPartSection (lesson_part segments,
// content.audio.video / audio.synced_visual) and AudioSection (orientation
// segment, content.orientation_video / orientation_visual).
import "@testing-library/jest-dom/vitest";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LessonActivity } from "@/types";
import type {
  AudioSyncedVisualContent,
  LessonSegmentVideo,
} from "@/lib/lesson-content/schema";

// Heavy / unrelated children are stubbed so the tests isolate the audio-segment
// branch (video vs legacy cue-swap). SegmentVideoPlayer and AudioSyncedLessonVisual
// (the two branches under test) are intentionally NOT mocked.
vi.mock("@/components/lesson/widgets/WidgetHost", () => ({
  WidgetHost: () => <div data-testid="widget-host" />,
}));
vi.mock("@/components/lesson/widgets/BespokeArtifactRenderer", () => ({
  BespokeArtifactRenderer: () => <div data-testid="bespoke-artifact" />,
}));
vi.mock("@/components/lesson/PythonSection", () => ({
  PythonSection: () => <div data-testid="python-section" />,
}));
vi.mock("@/components/lesson/LessonPartPracticeSection", () => ({
  LessonPartPracticeSection: () => <div data-testid="practice-section" />,
}));
vi.mock("@/components/lesson/MultipleChoiceAssessmentSection", () => ({
  MultipleChoiceAssessmentSection: () => <div data-testid="mc-assessment" />,
}));
vi.mock("@/components/lesson/LessonDiagrams", () => ({
  LessonDiagramsView: () => <div data-testid="diagrams" />,
}));

// Imported AFTER the mocks are registered.
import { LessonPartSection } from "@/components/lesson/LessonPartSection";
import { AudioSection } from "@/components/lesson/AudioSection";

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

function syncedVisual(): AudioSyncedVisualContent {
  return {
    strategy: "timeline",
    artifact_slug: "attention-score-grid-artifact",
    scene: {
      scene_id: "gate-scene",
      title: "Gate test scene",
      motif: "approved artifact driven by audio cues",
      description: "Metadata for a DB-backed artifact that follows the current audio cue.",
      panels: [
        {
          id: "artifact-state-contract",
          title: "Artifact state contract",
          kind: "custom",
          description: "The real visual source lives in visual_artifacts and receives cue state.",
          data: [{ label: "artifact_slug", value: "attention-score-grid-artifact", role: "context" }],
        },
      ],
    },
    cues: [
      {
        start: 0,
        end: 30,
        artifact_slug: "attention-score-grid-artifact",
        label: "Attention",
        headline: "Context vector leaves attention",
        narration: "The approved artifact receives cue state for this beat.",
        receive: "query/key/value",
        transform: "weighted mix",
        pass: "context vector",
      },
    ],
  };
}

function activity(id: number, content: unknown): LessonActivity {
  return {
    id,
    lesson_id: 1,
    activity_type: "lesson_part",
    is_core: 1,
    sequence_order: 1,
    title: "Segment under test",
    content: JSON.stringify(content),
    created_at: "2026-07-09T00:00:00Z",
    updated_at: "2026-07-09T00:00:00Z",
  };
}

function partContent(video?: LessonSegmentVideo) {
  const script = "L".repeat(220);
  return {
    reading: {
      intro: "x".repeat(60),
      blocks: [{ type: "text", content: "y".repeat(60) }],
      summary: "z".repeat(40),
    },
    audio: {
      script,
      transcript: script,
      duration_hint: 30,
      synced_visual: syncedVisual(),
      ...(video ? { video } : {}),
    },
    interactive: { schema_version: 1, instructions: "do", type: "sandbox" },
  };
}

function orientationContent(video?: LessonSegmentVideo) {
  const script = "O".repeat(220);
  return {
    script,
    transcript: script,
    duration_hint: 30,
    orientation_visual: syncedVisual(),
    ...(video ? { orientation_video: video } : {}),
  };
}

const audioArtifact = {
  id: 1,
  activity_id: 42,
  file_path: "runtime_artifacts/audio/lesson_15/activity_85.mp3",
  duration_sec: 30,
} as never;

// The legacy AudioSyncedLessonVisual renders a "Audio-synced visual" heading and
// a [data-audio-synced-artifact] wrapper; either is a reliable legacy-branch signal.
function hasLegacyCueVisual(container: HTMLElement): boolean {
  return Boolean(container.querySelector("[data-audio-synced-artifact]"));
}
function hasVideo(container: HTMLElement): boolean {
  return Boolean(container.querySelector('video source[type="video/mp4"]'));
}

describe("LessonPartSection — video vs legacy cue-swap gate", () => {
  it("(i) WITH a registered video renders <video> and NOT the legacy cue visual or fallback <audio>", () => {
    const { container } = render(
      <LessonPartSection
        activity={activity(42, partContent(goodVideo()))}
        artifact={audioArtifact}
        savedQuizState={null}
        onQuizStateChange={vi.fn()}
        onQuizPassedChange={vi.fn()}
        learnerId={1}
      />
    );
    expect(hasVideo(container)).toBe(true);
    expect(hasLegacyCueVisual(container)).toBe(false);
    // Fallback <audio> must not mount when the video is the surface.
    expect(container.querySelector("audio")).toBeNull();
    // The registered video's caption track is present.
    expect(container.querySelector('track[kind="captions"]')).toBeInTheDocument();
  });

  it("(ii) WITHOUT a registered video renders the legacy cue visual + accessibility <audio>", () => {
    const { container } = render(
      <LessonPartSection
        activity={activity(42, partContent(undefined))}
        artifact={audioArtifact}
        savedQuizState={null}
        onQuizStateChange={vi.fn()}
        onQuizPassedChange={vi.fn()}
        learnerId={1}
      />
    );
    expect(hasVideo(container)).toBe(false);
    expect(hasLegacyCueVisual(container)).toBe(true);
    expect(container.querySelector("audio")).toBeInTheDocument();
  });

  it("(iii) a registered video that errors at runtime degrades to the legacy cue visual", () => {
    const { container } = render(
      <LessonPartSection
        activity={activity(42, partContent(goodVideo()))}
        artifact={audioArtifact}
        savedQuizState={null}
        onQuizStateChange={vi.fn()}
        onQuizPassedChange={vi.fn()}
        learnerId={1}
      />
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    fireEvent.error(video);
    // After the <video> errors, showVideo flips false and the legacy path mounts.
    expect(hasVideo(container)).toBe(false);
    expect(hasLegacyCueVisual(container)).toBe(true);
    expect(container.querySelector("audio")).toBeInTheDocument();
  });
});

describe("AudioSection (orientation) — video vs legacy cue-swap gate", () => {
  it("(i) WITH orientation_video renders <video> and NOT the legacy orientation cue visual or <audio>", () => {
    const { container } = render(
      <AudioSection activity={activity(7, orientationContent(goodVideo()))} artifact={audioArtifact} />
    );
    expect(hasVideo(container)).toBe(true);
    expect(hasLegacyCueVisual(container)).toBe(false);
    expect(container.querySelector("audio")).toBeNull();
  });

  it("(ii) WITHOUT orientation_video renders the legacy orientation cue visual + <audio>", () => {
    const { container } = render(
      <AudioSection activity={activity(7, orientationContent(undefined))} artifact={audioArtifact} />
    );
    expect(hasVideo(container)).toBe(false);
    expect(hasLegacyCueVisual(container)).toBe(true);
    expect(container.querySelector("audio")).toBeInTheDocument();
  });
});
