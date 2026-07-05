import { describe, it, expect } from "vitest";
import { validateAudioSyncedVisualContent } from "../schema";

function makeCue(start: number, end: number, label: string) {
  return {
    start,
    end,
    label,
    headline: `${label} headline`,
    narration: `${label} narration`,
    receive: "input",
    transform: "process",
    pass: "output",
  };
}

function makeValidScene() {
  return {
    scene_id: "test-scene-abc",
    title: "Test Scene for Validator",
    motif: "attention-matrix",
    description: "A test scene that shows Q/K dot products as an attention score grid for the validator",
    panels: [
      {
        id: "panel-a",
        title: "Query vectors",
        kind: "matrix",
        description: "Shows the query vectors as matrix rows per token position",
        data: [{ label: "Q[0]", value: "[0.2, 0.8, 0.1]", role: "input" }],
      },
      {
        id: "panel-b",
        title: "Score grid",
        kind: "matrix",
        description: "Shows the attention scores after Q*K^T dot products",
        data: [{ label: "score[0,0]", value: "0.9", role: "output" }],
      },
    ],
  };
}

describe("validateAudioSyncedVisualContent", () => {
  it("passes when cues cover 80%+ of duration", () => {
    const visual = {
      strategy: "timeline",
      artifact_slug: "test-artifact",
      scene: makeValidScene(),
      cues: [
        makeCue(0, 25, "intro"),
        makeCue(25, 55, "middle-a"),
        makeCue(55, 85, "middle-b"),
        makeCue(85, 110, "middle-c"),
        makeCue(110, 135, "closing"),
        makeCue(135, 155, "end"),
      ],
    };
    const result = validateAudioSyncedVisualContent(visual, 160);
    if (!result.valid) console.log("ERRORS:", result.errors);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it("fails when cues only cover 30% of duration (the Lesson 15 Section 86 bug)", () => {
    const visual = {
      strategy: "timeline",
      artifact_slug: "test-artifact",
      scene: makeValidScene(),
      cues: [
        makeCue(0, 16, "first"),
        makeCue(16, 32, "second"),
        makeCue(32, 48, "third"),
      ],
    };
    const result = validateAudioSyncedVisualContent(visual, 162);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("80%"))).toBe(true);
  });

  it("fails when there are too few cues for the duration", () => {
    const visual = {
      strategy: "timeline",
      artifact_slug: "test-artifact",
      scene: makeValidScene(),
      cues: [
        makeCue(0, 80, "first"),
        makeCue(80, 160, "second"),
        makeCue(160, 240, "third"),
      ],
    };
    // 300s audio needs at least max(3, ceil(300/60)) = max(3, 5) = 5 cues; got 3
    const result = validateAudioSyncedVisualContent(visual, 300);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("needs at least"))).toBe(true);
  });

  it("fails when there is a gap > 30s between cues", () => {
    const visual = {
      strategy: "timeline",
      artifact_slug: "test-artifact",
      scene: makeValidScene(),
      cues: [
        makeCue(0, 20, "first"),
        makeCue(20, 40, "second"),
        makeCue(40, 60, "third"),
        // 35s gap here
        makeCue(95, 115, "fourth"),
        makeCue(115, 135, "fifth"),
        makeCue(135, 155, "sixth"),
      ],
    };
    const result = validateAudioSyncedVisualContent(visual, 160);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("gap of"))).toBe(true);
  });

  it("passes with dense cues covering full duration", () => {
    const cues = [];
    for (let i = 0; i < 8; i++) {
      cues.push(makeCue(i * 20, (i + 1) * 20, `cue-${i}`));
    }
    const visual = {
      strategy: "timeline",
      artifact_slug: "test-artifact",
      scene: makeValidScene(),
      cues,
    };
    const result = validateAudioSyncedVisualContent(visual, 160);
    if (!result.valid) console.log("ERRORS:", result.errors);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it("skips density/gap checks for short audio (< 60s)", () => {
    const visual = {
      strategy: "timeline",
      artifact_slug: "test-artifact",
      scene: makeValidScene(),
      cues: [
        makeCue(0, 15, "first"),
        makeCue(15, 30, "second"),
        makeCue(30, 45, "third"),
      ],
    };
    const result = validateAudioSyncedVisualContent(visual, 50);
    if (!result.valid) console.log("ERRORS:", result.errors);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });
});
