// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioSyncedLessonVisual } from "@/components/lesson/LessonPartSection";
import { EmbeddingMatrixLookupWidget } from "@/components/lesson/widgets/EmbeddingMatrixLookupWidget";
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
  it("shows only the active generated panel while keeping the step rail visible", () => {
    const { container } = render(<AudioSyncedLessonVisual visual={visual} currentTime={12} duration={30} onSeek={vi.fn()} />);

    expect(screen.getAllByText("Context vector leaves attention").length).toBeGreaterThan(0);
    expect(screen.getByText("Attention panel")).toBeInTheDocument();
    expect(screen.queryByText("Input panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Output panel")).not.toBeInTheDocument();
    expect(screen.queryByText(/Generated scene/i)).not.toBeInTheDocument();
    expect(screen.queryByText("focused-scene")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Generated scene steps")).toBeInTheDocument();
    expect(screen.getByText("The current beat should highlight the attention panel in place.")).toBeInTheDocument();
    expect(screen.getByText("Attention panel").closest("[aria-current='step']")).toBeTruthy();

    expect(container.innerHTML).toContain("flex min-w-0 gap-2 overflow-x-auto");
    expect(container.innerHTML).not.toContain("grid-cols-2 gap-2 sm:grid-cols-4");
  });

  it("renders formula panels and highlights the formula terms named by the cue", () => {
    const formulaVisual: AudioSyncedVisualContent = {
      strategy: "timeline",
      scene: {
        scene_id: "formula-scene",
        title: "Formula scene",
        motif: "formula strip",
        description: "A generated formula scene that highlights symbols as the audio explains them.",
        panels: [
          {
            id: "formula",
            title: "Attention formula",
            kind: "formula",
            description: "Shows the attention formula and the symbols being narrated.",
            data: [
              { label: "formula", value: "Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) · V", role: "context" },
              { label: "Q", value: "Query rows: what this token asks for", role: "input" },
              { label: "K", value: "Key rows: what each token advertises", role: "input" },
              { label: "V", value: "Value rows: content being mixed", role: "output" },
            ],
          },
          {
            id: "after",
            title: "After formula",
            kind: "cards",
            description: "Shows what happens after the formula.",
            data: [{ label: "Context", value: "mixed vector", role: "output" }],
          },
        ],
      },
      cues: [
        {
          start: 0,
          end: 15,
          label: "Formula",
          headline: "Q and K create scores",
          narration: "The formula is highlighted as the audio names Q and K.",
          receive: "query and key rows",
          transform: "compute scores",
          pass: "attention weights",
          panel_id: "formula",
          active_elements: ["Q", "K"],
        },
      ],
    };

    render(<AudioSyncedLessonVisual visual={formulaVisual} currentTime={4} duration={15} onSeek={vi.fn()} />);

    expect(screen.getByText("Attention formula")).toBeInTheDocument();
    const renderedFormula = screen.getByLabelText("Formula: Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) · V");
    expect(renderedFormula.innerHTML).toContain("#dbeafe");
    expect(screen.getAllByText("Q").some((el) => el.closest(".border-l-2")?.className.includes("border-blue-500"))).toBe(true);
    expect(screen.getAllByText("K").some((el) => el.closest(".border-l-2")?.className.includes("border-blue-500"))).toBe(true);
    expect(screen.queryByText("After formula")).not.toBeInTheDocument();
  });

  it("keeps the embedding lookup primer in a single readable column", () => {
    const { container } = render(<EmbeddingMatrixLookupWidget />);
    const styleText = [...container.querySelectorAll("style")].map((style) => style.textContent ?? "").join("\n");

    expect(screen.getByText("From token IDs to hidden states")).toBeInTheDocument();
    expect(styleText).toContain(".hsl-primer-grid");
    expect(styleText).toContain("max-width: 100%");
    expect(styleText).not.toContain("grid-template-columns: minmax(0, 0.9fr) minmax(280px, 1.1fr)");
  });
});
