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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("LessonPartPracticeSection — pattern_recognition", () => {
  it("renders the pattern grid and grades a correct primary selection", () => {
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
});
