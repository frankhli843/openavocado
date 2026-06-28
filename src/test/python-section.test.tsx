/**
 * @vitest-environment jsdom
 *
 * Practice-code UX guardrails. Coding exercises must keep a phone preview mode
 * so lesson QA can inspect exactly what the exercise feels like at mobile width.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PythonSection } from "../components/lesson/PythonSection";
import type { LessonActivity } from "../types";

vi.mock("../components/lesson/PythonEditor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Python code editor" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
  ),
}));

function practiceActivity(): LessonActivity {
  return {
    id: 43,
    lesson_id: 7,
    activity_type: "practice_code",
    is_core: 1,
    title: "Python: Token IDs to Logits",
    sequence_order: 5,
    content: JSON.stringify({
      prompt: "Implement a tiny logits calculation.",
      starter_code: "def logits(ids):\n    return ids\n",
      tests: [{ id: "public-1", description: "returns something", assert: "assert logits([1])" }],
      hidden_tests: [],
      hints: [],
      constraints: [],
      guided_steps: [],
    }),
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
  };
}

describe("PythonSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("always exposes a phone preview mode for coding lessons", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { container } = render(
      <PythonSection
        activity={practiceActivity()}
        learnerId={1}
        initialCode=""
        initialOutput=""
        initialTests={{}}
        onChange={vi.fn()}
      />
    );

    const desktop = screen.getByRole("button", { name: /desktop/i });
    const phone = screen.getByRole("button", { name: /phone/i });
    expect(desktop).toHaveAttribute("aria-pressed", "true");
    expect(phone).toHaveAttribute("title", "View phone mode");

    fireEvent.click(phone);

    expect(phone).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector('[data-preview-mode="phone"]')).toBeInTheDocument();
    expect(container.querySelector(".max-w-\\[390px\\]")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Python unavailable")).toBeInTheDocument());
  });

  it("uses the same light theme in focus mode", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { container } = render(
      <PythonSection
        activity={practiceActivity()}
        learnerId={1}
        initialCode=""
        initialOutput="sample output"
        initialTests={{}}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /enter fullscreen/i }));

    const dialog = screen.getByRole("dialog", { name: /python code editor fullscreen/i });
    expect(dialog).toHaveClass("bg-white");
    expect(dialog).not.toHaveClass("bg-gray-950");
    expect(within(dialog).queryByText("Output")?.nextElementSibling).not.toHaveClass("bg-gray-900");
    expect(within(dialog).getByText("Your task").parentElement).toHaveClass("bg-blue-50/60");
    expect(container.querySelector('[role="dialog"].bg-white')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Python unavailable").length).toBeGreaterThan(0));
  });

  it("reserves the docked lesson chat rail in desktop focus mode", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <PythonSection
        activity={practiceActivity()}
        learnerId={1}
        initialCode=""
        initialOutput="sample output"
        initialTests={{}}
        onChange={vi.fn()}
        reserveChatRail
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /enter fullscreen/i }));

    const dialog = screen.getByRole("dialog", { name: /python code editor fullscreen/i });
    expect(dialog).toHaveClass("xl:right-[28rem]");
    expect(dialog).toHaveAttribute("aria-modal", "false");
    await waitFor(() => expect(screen.getAllByText("Python unavailable").length).toBeGreaterThan(0));
  });
});
