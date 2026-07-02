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
    motif: "one relevant panel at a time",
    description: "A generated scene with multiple panels where only the current cue panel should render.",
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
      narration: "The current beat should show the attention panel only.",
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
  it("renders only the panel relevant to the active audio cue", () => {
    render(<AudioSyncedLessonVisual visual={visual} currentTime={12} duration={30} onSeek={vi.fn()} />);

    expect(screen.getAllByText("Context vector leaves attention").length).toBeGreaterThan(0);
    expect(screen.getByText("Attention panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Generated scene steps")).toBeInTheDocument();
    expect(screen.getByText("The current beat should show the attention panel only.")).toBeInTheDocument();
    expect(screen.queryByText("Input panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Output panel")).not.toBeInTheDocument();
  });
});
