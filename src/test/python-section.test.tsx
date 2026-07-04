/**
 * @vitest-environment jsdom
 *
 * Practice-code UX guardrails. Coding exercises must keep a Learn mode
 * so learners can study code comprehension without typing.
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

  it("keeps embedded code practice spacing consistent without nested-card padding", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { container } = render(
      <PythonSection
        activity={practiceActivity()}
        learnerId={1}
        initialCode=""
        initialOutput=""
        initialTests={{}}
        onChange={vi.fn()}
        embedded
      />
    );

    const shell = container.querySelector('[data-code-section-shell="embedded"]');
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveClass("px-3");
    expect(shell).toHaveClass("py-3");
    expect(shell).not.toHaveClass("rounded-xl");
    expect(shell).not.toHaveClass("p-6");
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
  });

  it("always exposes Attempt and Learn modes for coding lessons", async () => {
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

    const attempt = screen.getByRole("button", { name: /attempt/i });
    const learn = screen.getByRole("button", { name: /learn/i });
    expect(attempt).toHaveAttribute("aria-pressed", "true");
    expect(learn).toHaveAttribute("title", "View learn mode");

    fireEvent.click(learn);

    expect(learn).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector('[data-preview-mode="learn"]')).toBeInTheDocument();
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
    expect(screen.getByText("Learn path")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 8")).toBeInTheDocument();
    expect(screen.getByText("1. Algorithm")).toBeInTheDocument();
    expect(screen.queryByText("2. Example trace")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByText(/Make logits\(\[1\]\) produce \{1: 1\}/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Question 2 of 8")).toBeInTheDocument();
    expect(screen.getByText("2. Example trace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Question 3 of 8")).toBeInTheDocument();
    expect(screen.getByText("3. Concise syntax")).toBeInTheDocument();
    expect(container).toHaveTextContent("def logits(ids):");
    expect(container).toHaveTextContent("return {token_id: ids.count(token_id) for token_id in set(ids)}");
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("4. Reasoning order")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Read the prompt and examples/i));
    expect(screen.getByText("Your order")).toBeInTheDocument();
    expect(container).toHaveTextContent("1. Read the prompt and examples");

    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    }
    expect(screen.getByText("Function 1")).toBeInTheDocument();
    expect(screen.getByText(/What inputs it receives, what output it promises/)).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    fireEvent.click(screen.getByLabelText(/Which intermediate value would make/i));
    expect(screen.getByLabelText(/Which intermediate value would make/i)).toBeChecked();
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
