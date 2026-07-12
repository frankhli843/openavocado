/**
 * @vitest-environment jsdom
 *
 * Renderer behavior: a declarative widget computes outputs from controls and
 * updates them live when a control changes, and never reports completion.
 */
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeclarativeWidget } from "../components/lesson/widgets/DeclarativeWidget";
import type { DeclarativeWidgetSpec } from "../lib/widgets/schema";

const spec: DeclarativeWidgetSpec = {
  schema_version: "1.0",
  widget_type: "declarative",
  instructions: "Move the slider.",
  controls: [{ type: "slider", id: "x", label: "X value", min: 0, max: 10, step: 1, default: 2 }],
  outputs: [{ id: "doubled", label: "Doubled", formula: "x * 2", precision: 0 }],
};

describe("DeclarativeWidget rendering", () => {
  it("renders the initial derived output", () => {
    render(<DeclarativeWidget spec={spec} />);
    expect(screen.getByText("Doubled")).toBeInTheDocument();
    // x default 2 -> doubled 4
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("recomputes the output when the control changes and notifies state", () => {
    const onStateChange = vi.fn();
    render(<DeclarativeWidget spec={spec} onStateChange={onStateChange} />);

    const slider = screen.getByLabelText("X value") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "7" } });

    // x 7 -> doubled 14
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledWith({ controls: { x: 7 } });
  });

  it("restores provided initial control state", () => {
    render(<DeclarativeWidget spec={spec} initialState={{ x: 3 }} />);
    // x 3 -> doubled 6 (not a slider bound, so unambiguous)
    expect(screen.getByText("6")).toBeInTheDocument();
  });
});
