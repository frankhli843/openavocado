/**
 * @vitest-environment jsdom
 *
 * Chat markdown rendering: lesson chat replies may include lightweight
 * markdown from the tutor prompt. Render that formatting as React nodes without
 * evaluating raw HTML.
 */
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownText } from "../components/MarkdownText";

describe("MarkdownText", () => {
  it("renders bold, italic, inline code, and lists", () => {
    render(
      <MarkdownText
        text={[
          "This is **important** and *subtle* with `code`.",
          "",
          "* first **item**",
          "* second item",
          "",
          "1. ordered one",
          "2. ordered two",
        ].join("\n")}
      />
    );

    expect(screen.getByText("important").tagName).toBe("STRONG");
    expect(screen.getByText("subtle").tagName).toBe("EM");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByText(/first/)).toBeInTheDocument();
    expect(screen.getByText("ordered one")).toBeInTheDocument();
  });

  it("renders headings and safe markdown links", () => {
    render(<MarkdownText text={"# Agent Notes\n\nSee [Gemma 4](https://deepmind.google/models/gemma/gemma-4/) for context."} />);

    const heading = screen.getByRole("heading", { name: "Agent Notes" });
    expect(heading.tagName).toBe("H3");

    const link = screen.getByRole("link", { name: "Gemma 4" });
    expect(link).toHaveAttribute("href", "https://deepmind.google/models/gemma/gemma-4/");
  });

  it("keeps raw HTML as inert text", () => {
    const { container } = render(<MarkdownText text={'<img src=x onerror="alert(1)"> **safe**'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
    expect(screen.getByText("safe").tagName).toBe("STRONG");
  });

  it("renders inline and standalone LaTeX formulas", () => {
    const { container } = render(
      <MarkdownText
        text={[
          "The $Q$, $K$, and $V$ vectors come from hidden states.",
          "",
          "$Q = X \\cdot W_Q$",
          "$K = X \\cdot W_K$",
          "$V = X \\cdot W_V$",
        ].join("\n")}
      />
    );

    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll(".katex-display")).toHaveLength(3);
    expect(container.textContent).not.toContain("$Q$");
    expect(container.textContent).not.toContain("\\cdot");
  });
});
