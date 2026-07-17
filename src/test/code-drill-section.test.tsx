/**
 * @vitest-environment jsdom
 *
 * Render guardrails for the two Phase-3 features:
 *   - CodeDrillSection mounts a timer, prompt, and start/run/submit controls.
 *   - LessonPartPracticeSection renders a pattern_recognition grid and grades it
 *     with partial credit + correct/wrong feedback.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CodeDrillSection } from "../components/lesson/CodeDrillSection";
import { LessonPartPracticeSection } from "../components/lesson/LessonPartPracticeSection";
import type { LessonActivity } from "../types";
import type { LessonPartPracticeContent } from "../lib/lesson-content/schema";

vi.mock("../components/lesson/PythonEditor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="code editor" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function drillActivity(): LessonActivity {
  return {
    id: 88,
    lesson_id: 9,
    activity_type: "code_drill",
    is_core: 1,
    title: "Sliding Window drill",
    sequence_order: 6,
    content: JSON.stringify({
      pattern: "sliding-window",
      prompt: "Longest substring without repeating characters.",
      target_seconds: 600,
      difficulty: "medium",
      starter_code: "def solve(s):\n    pass\n",
      tests: [{ id: "t1", description: "abcabcbb -> 3", assert: "solve('abcabcbb') == 3" }],
      hints: [{ unlock_at_pct: 33, text: "Use a sliding window." }],
    }),
  } as LessonActivity;
}

describe("CodeDrillSection", () => {
  it("shows the drill timer, pattern, and a start gate before revealing the editor", async () => {
    render(<CodeDrillSection activity={drillActivity()} learnerId={1} />);
    expect(screen.getByLabelText("drill timer")).toHaveTextContent("10:00");
    expect(screen.getByText(/Sliding Window drill/)).toBeInTheDocument();
    expect(screen.getByText(/Longest substring without repeating/)).toBeInTheDocument();
    // Editor + submit only appear after starting the drill.
    expect(screen.queryByLabelText("code editor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start drill/ }));
    // The editor is a next/dynamic import, so it mounts asynchronously.
    expect(await screen.findByLabelText("code editor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit drill/ })).toBeInTheDocument();
    // Hints are locked until the first threshold; the locked-state hint copy shows.
    expect(screen.getByText(/first hint unlocks at 33%/)).toBeInTheDocument();
  });
});

function patternRecognitionPractice(): LessonPartPracticeContent {
  return {
    questions: [
      {
        id: "pr1",
        type: "pattern_recognition",
        prompt: "Which patterns solve 'longest substring without repeats'?",
        concept: "pattern-recognition",
        difficulty: "medium",
        explanation: "Sliding window is the primary technique here.",
        choices: ["Sliding Window", "Two Pointer", "Dynamic Programming"],
        primary_indices: [0],
        secondary_indices: [1],
      },
    ],
  };
}

function allTrueSelectAllPractice(): LessonPartPracticeContent {
  return {
    questions: [
      {
        id: "all1",
        type: "select_all",
        prompt: "Select all true statements.",
        concept: "attention-qkv",
        difficulty: "medium",
        choices: ["Q_i is a query", "K_j is a key", "Their dot product is an attention score"],
        correct_indices: [0, 1, 2],
        explanation: "All three statements are true.",
      },
    ],
  };
}

describe("LessonPartPracticeSection pattern_recognition", () => {
  it("renders the pattern grid and grades a correct primary selection", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ enabled: false, judgment: null })))
    );
    const practice = patternRecognitionPractice();
    render(
      <LessonPartPracticeSection
        activity={{ id: 5, lesson_id: 9, activity_type: "lesson_part", is_core: 1, title: null, sequence_order: 0, content: null } as LessonActivity}
        lesson={{ title: "Sliding Window", description: null }}
        practice={practice}
        assessContext={null}
      />
    );
    expect(screen.getByText(/Select every algorithmic pattern that applies/)).toBeInTheDocument();
    // All three pattern choices render as selectable buttons.
    expect(screen.getByRole("button", { name: /Sliding Window/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dynamic Programming/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sliding Window/ }));
    fireEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(screen.getByText(/Correct on the required pattern/)).toBeInTheDocument();
  });

  it("marks a missing required pattern as not correct", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ enabled: false, judgment: null })))
    );
    const practice = patternRecognitionPractice();
    render(
      <LessonPartPracticeSection
        activity={{ id: 5, lesson_id: 9, activity_type: "lesson_part", is_core: 1, title: null, sequence_order: 0, content: null } as LessonActivity}
        lesson={{ title: "Sliding Window", description: null }}
        practice={practice}
        assessContext={null}
      />
    );
    // Select only a distractor.
    fireEvent.click(screen.getByRole("button", { name: /Dynamic Programming/ }));
    fireEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(screen.getByText(/Missing required pattern/)).toBeInTheDocument();
  });

  it("keeps deterministic feedback and then appends semantic feedback for closed-form answers", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          enabled: true,
          judgment: {
            verdict: "correct",
            feedback: "This also explains why sliding window fits the repeated-character constraint.",
          },
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const practice = patternRecognitionPractice();
    render(
      <LessonPartPracticeSection
        activity={{ id: 5, lesson_id: 9, activity_type: "lesson_part", is_core: 1, title: null, sequence_order: 0, content: null } as LessonActivity}
        lesson={{ title: "Sliding Window", description: null }}
        practice={practice}
        assessContext={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Sliding Window/ }));
    fireEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(screen.getByText(/Correct on the required pattern/)).toBeInTheDocument();
    expect(screen.getByText(/Semantic feedback is still checking/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/This also explains why sliding window fits/)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/answer-judge",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("requires judge feedback for written answers instead of using keyword fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ enabled: false, judgment: null })))
    );
    const practice: LessonPartPracticeContent = {
      questions: [
        {
          id: "written1",
          type: "written",
          prompt: "What is the dot product of Q_i and K_j computing?",
          concept: "attention-qkv",
          difficulty: "medium",
          actual_answer: "It computes alignment between the query at token i and key at token j. A high score means token i should attend strongly to token j.",
          rubric: "Must mention alignment or compatibility and attention.",
        },
      ],
    };
    render(
      <LessonPartPracticeSection
        activity={{ id: 5, lesson_id: 15, activity_type: "lesson_part", is_core: 1, title: null, sequence_order: 0, content: null } as LessonActivity}
        lesson={{ title: "Attention QKV", description: null }}
        practice={practice}
        assessContext={null}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Write your explanation/), {
      target: { value: "It means the current token is relevant." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Get feedback/ }));

    await waitFor(() => {
      expect(screen.getByText(/Semantic feedback is unavailable right now/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/You have part of the idea/)).not.toBeInTheDocument();
  });

  it("renders an all-of-these virtual choice for all-true select-all questions", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ enabled: false, judgment: null })))
    );
    render(
      <LessonPartPracticeSection
        activity={{ id: 5, lesson_id: 15, activity_type: "lesson_part", is_core: 1, title: null, sequence_order: 0, content: null } as LessonActivity}
        lesson={{ title: "Attention QKV", description: null }}
        practice={allTrueSelectAllPractice()}
        assessContext={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /All of these/ }));
    fireEvent.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(screen.getByRole("button", { name: /All of these/ })).toHaveTextContent("Selected and correct");
    expect(screen.getByText(/All three statements are true/)).toBeInTheDocument();
  });
});
