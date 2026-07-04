// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioSyncedLessonVisual } from "@/components/lesson/LessonPartSection";
import type { AudioSyncedVisualContent } from "@/lib/lesson-content/schema";

const visual: AudioSyncedVisualContent = {
  strategy: "timeline",
  artifact_slug: "focused-attention-audio-artifact",
  scene: {
    scene_id: "focused-scene",
    title: "Focused audio scene",
    motif: "approved artifact driven by audio cues",
    description: "Metadata for a generated DB-backed artifact that follows the current audio cue.",
    panels: [
      {
        id: "artifact-state-contract",
        title: "Artifact state contract",
        kind: "custom",
        description: "The actual visual source lives in visual_artifacts and receives cue state from the player.",
        data: [{ label: "artifact_slug", value: "focused-attention-audio-artifact", role: "context" }],
      },
    ],
  },
  cues: [
    {
      start: 0,
      end: 10,
      artifact_slug: "attention-input-row-artifact",
      label: "Input",
      headline: "Token row enters",
      narration: "The row enters the operation.",
      receive: "token row",
      transform: "prepare",
      pass: "query",
    },
    {
      start: 10,
      end: 20,
      artifact_slug: "attention-score-grid-artifact",
      label: "Attention",
      headline: "Context vector leaves attention",
      narration: "The approved artifact should receive cueIndex 1 for this beat.",
      receive: "query/key/value",
      transform: "weighted mix",
      pass: "context vector",
    },
    {
      start: 20,
      end: 30,
      artifact_slug: "attention-residual-handoff-artifact",
      label: "Output",
      headline: "Updated row moves forward",
      narration: "The row leaves the step.",
      receive: "context vector",
      transform: "residual add",
      pass: "updated row",
    },
  ],
};

function withoutCueArtifacts(source: AudioSyncedVisualContent): AudioSyncedVisualContent["cues"] {
  return source.cues.map((cue) => {
    const copy = { ...cue };
    delete copy.artifact_slug;
    return copy;
  });
}

describe("AudioSyncedLessonVisual", () => {
  it("renders only the active cue's approved DB-backed artifact for the main synced visual", () => {
    const { container } = render(<AudioSyncedLessonVisual visual={visual} currentTime={12} duration={30} onSeek={vi.fn()} />);

    expect(screen.getAllByText("Context vector leaves attention").length).toBeGreaterThan(0);
    expect(screen.getByText("The approved artifact should receive cueIndex 1 for this beat.")).toBeInTheDocument();
    const steps = screen.getByLabelText("Audio visual steps");
    expect(steps).toBeInTheDocument();
    expect(steps).toHaveStyle({
      gridTemplateColumns: "repeat(auto-fit, minmax(min(8rem, 100%), 1fr))",
    });
    expect(container.querySelector('[data-audio-synced-artifact="attention-score-grid-artifact"]')).toBeInTheDocument();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("src")).toBe("/api/visual-artifacts/attention-score-grid-artifact/sandbox");
    expect(iframe.className).toContain("max-w-full");

    expect(screen.queryByText("Input panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Attention panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Timed scene board")).not.toBeInTheDocument();
    expect(screen.queryByText("Transformer block scene")).not.toBeInTheDocument();
  });

  it("wraps long cue labels and pipeline text instead of requiring horizontal mobile scroll", () => {
    const longVisual = {
      ...visual,
      cues: visual.cues.map((cue, index) => ({
        ...cue,
        label: `${cue.label} with a long explanatory label ${index}`,
        receive: "A long received hidden-state object description that must wrap inside the mobile lesson card.",
        transform: "A long current operation description that must wrap instead of clipping.",
        pass: "A long pass-forward description that must stay within the viewport.",
      })),
    } satisfies AudioSyncedVisualContent;

    const { container } = render(<AudioSyncedLessonVisual visual={longVisual} currentTime={12} duration={30} onSeek={vi.fn()} />);

    expect(screen.getByLabelText("Audio visual steps")).toHaveClass("grid");
    for (const label of ["Receives", "Current operation", "Passes forward"]) {
      expect(screen.getByText(label).closest("div")).toHaveClass("break-words");
    }
    expect(container.querySelector("[data-audio-synced-artifact]")).toHaveClass("overflow-hidden");
  });

  it("fails loudly instead of drawing a generic panel when artifact_slug is missing", () => {
    const missingArtifact = {
      ...visual,
      artifact_slug: undefined,
      cues: withoutCueArtifacts(visual),
    } as AudioSyncedVisualContent;
    render(<AudioSyncedLessonVisual visual={missingArtifact} currentTime={12} duration={30} onSeek={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/missing a DB-backed bespoke artifact slug/i);
    expect(document.querySelector("iframe")).toBeNull();
  });
});
