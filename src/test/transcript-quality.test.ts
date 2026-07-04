import { describe, expect, it } from "vitest";

import { validateLearnerFacingAudioTranscript } from "@/lib/audio/transcript-quality";

function goodTranscript(): string {
  const turns = [
    "Leo: Let's follow the hidden-state matrix through one transformer block. The object is one row per token and one column per model feature.",
    "Maya: Why is that the right object to follow instead of just a technical label?",
    "Leo: Think of the residual stream like a shared notebook. Attention writes notes gathered from other token rows, then the MLP writes a per-token interpretation note.",
    "Maya: How exactly does that change help the next prediction?",
    "Leo: Use three token rows: The, cat, sat. The row for cat starts as a vector. Attention lets it borrow context from The and sat, while the MLP sharpens features inside that row.",
    "Maya: What changes inside the row after attention and the MLP touch it?",
    "Leo: The common mistake is thinking Q, K, and V come from the tokenizer. They are learned projections of the current hidden state inside the block.",
    "Maya: So does that mean vocabulary recognition is not enough?",
    "Leo: Yes. Real understanding means tracing the causal chain from hidden-state row to attention update to residual stream to better next-token evidence.",
    "Maya: Can you go deeper on how that evidence affects prediction quality?",
  ];
  return Array.from({ length: 40 }, () => turns.join("\n\n")).join("\n\n");
}

describe("validateLearnerFacingAudioTranscript", () => {
  it("passes a long learner-facing two-host transcript with skeptical causal questions, analogy, examples, and misconception", () => {
    const result = validateLearnerFacingAudioTranscript(goodTranscript(), {
      requireLongOverview: true,
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.words).toBeGreaterThanOrEqual(2700);
    expect(result.metrics.questions).toBeGreaterThanOrEqual(5);
  });

  it("fails generator-outline and debug metadata transcript leaks before LLM QA", () => {
    const bad = `${goodTranscript()}

Audio Session
Provider: doraemon-edge-tts
Voice: en-US-BrianNeural+en-US-JennyNeural
Leo: Here is the lesson content we are carrying through the route.
Maya: Point 1: Lesson part "How Q, K, V Produce Attention Scores" tells the learner what to learn.
Leo: Treat these as signposts and ask four questions.`;

    const result = validateLearnerFacingAudioTranscript(bad, {
      requireLongOverview: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/provider\/debug metadata|generator-outline/i);
  });
});
