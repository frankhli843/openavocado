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
      walkthrough: {
        title: "Trace the value before coding",
        steps: [
          {
            title: "Receive token ids",
            detail: "The function receives a short list of token ids and should preserve which ids appeared.",
            input: "logits([1])",
            output: "a dictionary-like score summary",
            visual: "[1] enters the helper",
          },
        ],
      },
      io_examples: [
        {
          label: "Single token",
          input: "logits([1])",
          expected_output: "{1: 1}",
          explanation: "The token id becomes the key and the count becomes the value.",
        },
      ],
      visualization: {
        title: "Token ids move into score slots",
        description: "The input list is read, transformed, and returned as scores.",
        items: [
          { label: "Input ids", value: "[1]", role: "input" },
          { label: "Count ids", value: "{1: 1}", role: "process" },
          { label: "Return scores", value: "{1: 1}", role: "output" },
        ],
      },
      starter_code: "def logits(ids):\n    return ids\n",
      worked_examples: [
        {
          label: "basic",
          title: "Basic readable version",
          explanation: "Use named variables so each step is visible.",
          code: "def logits(ids):\n    scores = {}\n    for token_id in ids:\n        scores[token_id] = scores.get(token_id, 0) + 1\n    return scores\n",
        },
        {
          label: "concise",
          title: "Best concise version",
          explanation: "The same idea can be written more tightly once it is understood.",
          code: "def logits(ids):\n    return {token_id: ids.count(token_id) for token_id in set(ids)}\n",
        },
      ],
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
    expect(screen.queryByLabelText("Python code editor")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run tests/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Python unavailable")).not.toBeInTheDocument();
    expect(screen.getByText("Optional coding reinforcement.")).toBeInTheDocument();
    expect(screen.getByText("Reference answers")).toBeInTheDocument();
    expect(screen.getByText("Basic readable version")).toBeInTheDocument();
    expect(screen.getByText("Trace the value before coding")).toBeInTheDocument();
    expect(screen.getByText("Single token")).toBeInTheDocument();
    expect(screen.getByText("Token ids move into score slots")).toBeInTheDocument();
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
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
