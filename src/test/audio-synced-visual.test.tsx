// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioSyncedLessonVisual } from "@/components/lesson/LessonPartSection";
import type { AudioSyncedVisualContent } from "@/lib/lesson-content/schema";

const visual: AudioSyncedVisualContent = {
  strategy: "timeline",
  scene: {
    scene_id: "focused-scene",
    title: "Focused audio scene",
    motif: "active panel highlighted in place",
    description: "A generated scene with multiple panels where the current cue panel should stay highlighted.",
    panels: [
      {
        id: "input",
        title: "Input panel",
        kind: "cards",
        description: "Shows the object entering the step.",
        data: [{ label: "Input", value: "token row", role: "input" }],
      },
      {
        id: "attention",
        title: "Attention panel",
        kind: "matrix",
        description: "Shows the attention operation for the current audio beat.",
        data: [{ label: "Context vector", values: [20, 80, 50], role: "process" }],
      },
      {
        id: "output",
        title: "Output panel",
        kind: "cards",
        description: "Shows what leaves this step.",
        data: [{ label: "Output", value: "updated hidden row", role: "output" }],
      },
    ],
  },
  cues: [
    {
      start: 0,
      end: 10,
      label: "Input",
      headline: "Token row enters",
      narration: "The row enters the operation.",
      receive: "token row",
      transform: "prepare",
      pass: "query",
      panel_id: "input",
      active_elements: ["Input"],
    },
    {
      start: 10,
      end: 20,
      label: "Attention",
      headline: "Context vector leaves attention",
      narration: "The current beat should highlight the attention panel in place.",
      receive: "query/key/value",
      transform: "weighted mix",
      pass: "context vector",
      panel_id: "attention",
      active_elements: ["Context vector"],
    },
    {
      start: 20,
      end: 30,
      label: "Output",
      headline: "Updated row moves forward",
      narration: "The row leaves the step.",
      receive: "context vector",
      transform: "residual add",
      pass: "updated row",
      panel_id: "output",
      active_elements: ["Output"],
    },
  ],
};

describe("AudioSyncedLessonVisual", () => {
  it("keeps all generated panels visible and highlights the active audio cue panel", () => {
    render(<AudioSyncedLessonVisual visual={visual} currentTime={12} duration={30} onSeek={vi.fn()} />);

    expect(screen.getAllByText("Context vector leaves attention").length).toBeGreaterThan(0);
    expect(screen.getByText("Attention panel")).toBeInTheDocument();
    expect(screen.getByText("Input panel")).toBeInTheDocument();
    expect(screen.getByText("Output panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Generated scene steps")).toBeInTheDocument();
    expect(screen.getByText("The current beat should highlight the attention panel in place.")).toBeInTheDocument();
    expect(screen.getByText("Attention panel").closest("[aria-current='step']")).toBeTruthy();
    expect(screen.getByText("Input panel").closest("[aria-current='step']")).toBeFalsy();
    expect(screen.getByText("Output panel").closest("[aria-current='step']")).toBeFalsy();
  });
});
