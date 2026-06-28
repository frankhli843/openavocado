/**
 * @vitest-environment jsdom
 *
 * Component behavior for lesson diagrams: each diagram exposes an accessible
 * fullscreen control, the app-level fullscreen overlay opens as a modal dialog
 * with a reachable close control, and static diagrams render their alt text and
 * source attribution. A static diagram is used so the test never depends on the
 * async Mermaid renderer import.
 */
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LessonDiagramsView } from "../components/lesson/LessonDiagrams";
import type { LessonDiagram } from "../lib/lesson-content/schema";

const staticDiagram: LessonDiagram = {
  kind: "static",
  title: "Transformer block",
  asset_path: "runtime_artifacts/diagrams/transformer_block.png",
  alt: "A transformer block: attention then a feed-forward network with residual connections.",
  caption: "One transformer block.",
  external: true,
  source_url: "https://example.org/transformer",
  license: "CC BY 4.0",
  support_ref: "Part 3 reading: the transformer block",
};

describe("LessonDiagramsView", () => {
  it("renders the static image with alt text and source attribution", () => {
    render(<LessonDiagramsView diagrams={[staticDiagram]} />);
    const img = screen.getByAltText(staticDiagram.alt) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe(`/runtime/${(staticDiagram as { asset_path: string }).asset_path}`);
    expect(screen.getByText(/CC BY 4.0/)).toBeInTheDocument();
  });

  it("exposes an accessible fullscreen control per diagram", () => {
    render(<LessonDiagramsView diagrams={[staticDiagram]} />);
    const btn = screen.getByRole("button", {
      name: `View diagram fullscreen: ${staticDiagram.title}`,
    });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("title", "View fullscreen");
  });

  it("opens an app-level fullscreen modal and closes it via the close control", () => {
    render(<LessonDiagramsView diagrams={[staticDiagram]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `View diagram fullscreen: ${staticDiagram.title}` })
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", `Fullscreen diagram: ${staticDiagram.title}`);

    // Zoom and close controls are present and labelled.
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "Close fullscreen diagram" });
    expect(close).toBeInTheDocument();

    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing for an empty diagram list", () => {
    const { container } = render(<LessonDiagramsView diagrams={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
