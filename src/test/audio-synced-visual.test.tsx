// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * BespokeArtifactRenderer probes `/api/visual-artifacts/<slug>` and only mounts
 * the sandbox iframe when build_status is qa_approved. In jsdom there is no
 * server, so stub fetch to report the artifact approved for the "renders the
 * approved artifact" case.
 */
function stubApprovedArtifactFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ artifact: { build_status: "qa_approved" } }),
    })) as unknown as typeof fetch
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});
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
  it("renders only the active cue's approved DB-backed artifact for the main synced visual", async () => {
    stubApprovedArtifactFetch();
    const { container } = render(<AudioSyncedLessonVisual visual={visual} currentTime={12} duration={30} onSeek={vi.fn()} />);

    expect(screen.getAllByText("Context vector leaves attention").length).toBeGreaterThan(0);
    expect(screen.getByText("The approved artifact should receive cueIndex 1 for this beat.")).toBeInTheDocument();
    const steps = screen.getByLabelText("Audio visual steps");
    expect(steps).toBeInTheDocument();
    expect(steps).toHaveClass("hidden", "sm:grid");
    expect(steps).toHaveStyle({
      gridTemplateColumns: "repeat(auto-fit, minmax(min(8rem, 100%), 1fr))",
    });
    expect(container.querySelector('[data-audio-synced-artifact="attention-score-grid-artifact"]')).toBeInTheDocument();
    // The iframe mounts only after the availability probe confirms qa_approved.
    const iframe = await waitFor(() => {
      const el = container.querySelector("iframe") as HTMLIFrameElement | null;
      expect(el).toBeInTheDocument();
      return el as HTMLIFrameElement;
    });
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

    expect(screen.getByLabelText("Audio visual steps")).toHaveClass("hidden", "sm:grid");
    for (const label of ["Receives", "Current operation", "Passes forward"]) {
      expect(screen.getByText(label).closest("div")).toHaveClass("break-words");
    }
    expect(container.querySelector("[data-audio-synced-artifact]")).toHaveClass("overflow-hidden");
  });

  it("keeps the bespoke visualization first-class on mobile by hiding synced scaffold chrome below sm", () => {
    const { container } = render(<AudioSyncedLessonVisual visual={visual} currentTime={12} duration={30} onSeek={vi.fn()} />);

    const heading = nearestAncestorWithClass(screen.getByText("Audio-synced visual"), "hidden");
    expect(heading).toHaveClass("hidden", "sm:block");
    expect(screen.getByLabelText("Audio visual steps")).toHaveClass("hidden", "sm:grid");

    const pipeline = nearestAncestorWithClass(screen.getByText("Current operation"), "sm:grid");
    expect(pipeline).toHaveClass("hidden", "sm:grid");

    const narration = screen.getByText("The approved artifact should receive cueIndex 1 for this beat.");
    expect(narration).toHaveClass("hidden", "sm:block");
    expect(container.querySelector('[data-audio-synced-artifact="attention-score-grid-artifact"]')).not.toHaveClass("border-t");
  });

  it("collapses the mobile synced visual disclosure by default", () => {
    render(<AudioSyncedLessonVisual visual={visual} currentTime={12} duration={30} onSeek={vi.fn()} />);

    const mobileToggle = screen.getByRole("button", {
      name: /Visualization\s+Context vector leaves attention\s+Show/i,
    });
    expect(nearestAncestorWithClass(mobileToggle, "sm:hidden")).toHaveClass("sm:hidden");
    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(mobileToggle);
    expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
    expect(mobileToggle).toHaveTextContent("Hide");
  });

  it("renders the clean self-contained authored scene when no artifact_slug is present (Strategy B)", () => {
    const missingArtifact = {
      ...visual,
      artifact_slug: undefined,
      cues: withoutCueArtifacts(visual),
    } as AudioSyncedVisualContent;
    render(<AudioSyncedLessonVisual visual={missingArtifact} currentTime={12} duration={30} onSeek={vi.fn()} />);

    // Strategy B: no bespoke artifact was authored, so the authored cue scene is
    // the intended, complete visual. No red error box, no iframe, and no
    // "being prepared" note implying a richer visual is coming.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByText(/being prepared/i)).toBeNull();
    // The authored narration/pipeline content still renders as the scene.
    expect(screen.getAllByText("The approved artifact should receive cueIndex 1 for this beat.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Current operation").length).toBeGreaterThan(0);
  });
});

function nearestAncestorWithClass(element: HTMLElement, className: string): HTMLElement | null {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.classList.contains(className)) return current;
    current = current.parentElement;
  }
  return null;
}
