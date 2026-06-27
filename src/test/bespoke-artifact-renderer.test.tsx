/**
 * @vitest-environment jsdom
 *
 * Unit tests for BespokeArtifactRenderer: the React wrapper that renders an
 * approved bespoke artifact inside a sandboxed iframe and bridges state via
 * postMessage.
 *
 * Covers AC9 renderer behavior:
 *  - points the iframe at the approval-gated sandbox route for the given slug
 *  - applies the sandbox attribute (allow-scripts allow-same-origin only)
 *  - shows a loading state until the iframe posts READY
 *  - forwards STATE_CHANGE messages to onStateChange
 *  - surfaces an ERROR message as a visible failure state (no fake fallback)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BespokeArtifactRenderer } from "../components/lesson/widgets/BespokeArtifactRenderer";

/**
 * Dispatch a postMessage as if it came from the rendered iframe's
 * contentWindow, which is what the renderer's source check requires.
 */
function postFromIframe(data: unknown) {
  const iframe = document.querySelector("iframe") as HTMLIFrameElement;
  const evt = new MessageEvent("message", { data, source: iframe.contentWindow });
  act(() => {
    window.dispatchEvent(evt);
  });
}

describe("BespokeArtifactRenderer", () => {
  beforeEach(() => {
    // jsdom does not navigate iframes; we only assert on attributes + messaging.
  });

  it("renders an iframe pointed at the approval-gated sandbox route for the slug", () => {
    render(<BespokeArtifactRenderer artifactSlug="math-explorer-test" />);
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toBe(
      "/api/visual-artifacts/math-explorer-test/sandbox"
    );
  });

  it("encodes the slug in the sandbox URL", () => {
    render(<BespokeArtifactRenderer artifactSlug="a b/c" />);
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe(
      `/api/visual-artifacts/${encodeURIComponent("a b/c")}/sandbox`
    );
  });

  it("restricts the iframe sandbox to scripts + same-origin only", () => {
    render(<BespokeArtifactRenderer artifactSlug="demo" />);
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
  });

  it("shows a loading state until the iframe posts READY", () => {
    render(<BespokeArtifactRenderer artifactSlug="demo" />);
    expect(screen.getByText(/Loading visualization/i)).toBeInTheDocument();

    postFromIframe({ type: "READY" });
    expect(screen.queryByText(/Loading visualization/i)).not.toBeInTheDocument();
  });

  it("forwards STATE_CHANGE messages to onStateChange", () => {
    const onStateChange = vi.fn();
    render(<BespokeArtifactRenderer artifactSlug="demo" onStateChange={onStateChange} />);

    postFromIframe({ type: "STATE_CHANGE", state: { controls: { temperature: 3 } } });
    expect(onStateChange).toHaveBeenCalledWith({ controls: { temperature: 3 } });
  });

  it("surfaces an ERROR message as a visible failure state and drops the iframe", () => {
    render(<BespokeArtifactRenderer artifactSlug="demo" />);
    postFromIframe({ type: "ERROR", message: "ReferenceError: foo is not defined" });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Visualization rendering error/i);
    expect(alert).toHaveTextContent(/ReferenceError: foo is not defined/);
    // Failure state replaces the iframe entirely (no fake fallback visual).
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("ignores messages whose source is not the artifact iframe", () => {
    const onStateChange = vi.fn();
    render(<BespokeArtifactRenderer artifactSlug="demo" onStateChange={onStateChange} />);

    // source defaults to null (not the iframe contentWindow) → must be ignored.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: "STATE_CHANGE", state: { controls: { x: 1 } } } })
      );
    });
    expect(onStateChange).not.toHaveBeenCalled();
  });
});
