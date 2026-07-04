import { describe, expect, it } from "vitest";

import { validateLearnerFacingAudioTranscript } from "@/lib/audio/transcript-quality";

function goodTranscript(): string {
  return Array.from({ length: 34 }, (_, i) => {
    const token = ["cat", "river", "model", "sentence", "cache", "score"][i % 6];
    const operation = ["attention", "softmax", "residual addition", "layer normalization", "the MLP", "the output head"][i % 6];
    const vary = (text: string) =>
      text
        .split(" ")
        .map((word, j) => (j > 0 && j % 7 === 0 ? `${word} marker${i}_${j}` : word))
        .join(" ");
    return [
      `Leo: In angle ${i}, follow the hidden-state matrix for ${token}. The object is one row per token and one column per model feature, and ${operation} changes what evidence that row carries forward.`,
      `Maya: Why is ${token} the right object to follow instead of just repeating a technical label?`,
      `Leo: Think of the residual stream like a shared notebook for angle ${i}. Attention writes notes gathered from other token rows, then the MLP writes a per-token interpretation note that still fits back into the same row.`,
      `Maya: How exactly does that changed row help the next prediction in scenario ${i}?`,
      `Leo: Use three token rows around ${token}. The middle row starts as a vector, borrows context through attention, and then gets sharper internal features through the MLP before logits are scored.`,
      `Maya: What changes inside the row after ${operation} touches it, and what evidence would prove that the change mattered?`,
      `Leo: The common misconception in case ${i} is thinking Q, K, and V come from the tokenizer. They are learned projections of the current hidden state inside the block, so the causal chain runs through the row, the score table, the value mixture, and the residual update.`,
      `Maya: Can you go deeper on why that evidence affects prediction quality instead of just sounding mathematically elegant?`,
    ].map(vary).join("\n\n");
  }).join("\n\n");
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

  it("rejects inline speaker labels and repeated padding loops", () => {
    const inline = [
      "Leo: Start with the hidden state.",
      "Maya: Why does it matter? Leo: Because this should have been a new turn.",
      "Maya: Go deeper.",
      "Leo: The row changes before logits are scored.",
    ].join("\n\n");
    const inlineResult = validateLearnerFacingAudioTranscript(inline, { minWords: 1 });
    expect(inlineResult.ok).toBe(false);
    expect(inlineResult.errors.join(" ")).toMatch(/speaker labels must start a new turn/i);

    const repeatedBlock = [
      "Leo: The hidden state row enters the block and the attention update changes the row before the next layer reads it.",
      "Maya: Why does that matter for prediction?",
    ].join("\n\n");
    const looped = `${repeatedBlock}\n\n${repeatedBlock}\n\n${repeatedBlock}\n\n${repeatedBlock}`;
    const loopResult = validateLearnerFacingAudioTranscript(looped, { minWords: 1 });
    expect(loopResult.ok).toBe(false);
    expect(loopResult.errors.join(" ")).toMatch(/repeated padding loops/i);
  });
});
