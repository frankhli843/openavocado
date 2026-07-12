import { describe, it, expect } from "vitest";
import {
  computePreScreenFlags,
  detectCueFlags,
  detectDegenerateQuestion,
  detectRubricRevealsAnswer,
  detectCodeSignatureMismatch,
  parsePythonSignature,
  type GatheredCueTimeline,
  type GatheredChoiceQuestion,
  type GatheredWrittenQuestion,
  type GatheredCodeExercise,
  type GatheredTranscript,
} from "../gather";

function cue(start: number, end: number, label: string, headline = "") {
  return { source: "part_1", start, end, label, headline, narration: "" };
}

function emptyGathered() {
  return {
    lessonId: 1,
    title: "t",
    transcripts: [] as GatheredTranscript[],
    cueTimelines: [] as GatheredCueTimeline[],
    choiceQuestions: [] as GatheredChoiceQuestion[],
    writtenQuestions: [] as GatheredWrittenQuestion[],
    codeExercises: [] as GatheredCodeExercise[],
  };
}

describe("detectCueFlags — coverage", () => {
  it("flags the L15-A87 case: cues covering only 48s of 338s (14%)", () => {
    const timeline: GatheredCueTimeline = {
      source: "overview",
      durationHint: 338,
      cues: [cue(0, 24, "Q dot K", "score grid"), cue(24, 48, "softmax", "normalize")],
    };
    const flags = detectCueFlags(timeline);
    const cov = flags.find((f) => f.criterion === "visual_low_coverage");
    expect(cov).toBeDefined();
    expect(cov?.severity).toBe("severe");
    expect(cov?.detail).toContain("14%");
  });

  it("does not flag coverage when cues span >=80% of the audio", () => {
    const timeline: GatheredCueTimeline = {
      source: "overview",
      durationHint: 100,
      cues: [cue(0, 45, "start", "intro"), cue(45, 92, "end", "wrap")],
    };
    const flags = detectCueFlags(timeline).filter((f) => f.criterion === "visual_low_coverage");
    expect(flags).toHaveLength(0);
  });
});

describe("detectCueFlags — template placeholders", () => {
  it("flags the L2/L3 template visuals: generic Input/Transform/Handoff labels with no content", () => {
    const timeline: GatheredCueTimeline = {
      source: "part_1",
      durationHint: 60,
      cues: [cue(0, 20, "Input"), cue(20, 40, "Transform"), cue(40, 58, "Handoff")],
    };
    const flag = detectCueFlags(timeline).find((f) => f.criterion === "visual_template_placeholder");
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe("severe");
    expect(flag?.quote).toContain("Input");
  });

  it("does not flag placeholder labels that carry content-specific headlines", () => {
    const timeline: GatheredCueTimeline = {
      source: "part_1",
      durationHint: 60,
      cues: [
        cue(0, 20, "Input", "token embeddings enter the block"),
        cue(20, 58, "Transform", "attention mixes context across tokens"),
      ],
    };
    const flags = detectCueFlags(timeline).filter((f) => f.criterion === "visual_template_placeholder");
    expect(flags).toHaveLength(0);
  });
});

describe("detectDegenerateQuestion", () => {
  const base = { source: "assessment", id: "q1", prompt: "?", explanation: "" };

  it("flags select-all where ALL choices are correct", () => {
    const q: GatheredChoiceQuestion = {
      ...base,
      kind: "select_all",
      choices: ["a", "b", "c"],
      correctIndex: null,
      correctIndices: [0, 1, 2],
      allowMultipleCorrect: true,
    };
    expect(detectDegenerateQuestion(q)?.severity).toBe("severe");
  });

  it("allows a select-all with an empty correct set (the intentional 'none apply' variety)", () => {
    const q: GatheredChoiceQuestion = {
      ...base,
      kind: "select_all",
      choices: ["a", "b", "c"],
      correctIndex: null,
      correctIndices: [],
      allowMultipleCorrect: true,
    };
    expect(detectDegenerateQuestion(q)).toBeNull();
  });

  it("flags a classic multiple-choice question that declares an empty correct set with no 'None of the above'", () => {
    const q: GatheredChoiceQuestion = {
      ...base,
      kind: "multiple_choice",
      choices: ["a", "b", "c"],
      correctIndex: null,
      correctIndices: [],
      allowMultipleCorrect: false,
    };
    expect(detectDegenerateQuestion(q)?.criterion).toBe("question_degenerate_grading");
  });

  it("flags single-choice with an out-of-range correct_index", () => {
    const q: GatheredChoiceQuestion = {
      ...base,
      kind: "multiple_choice",
      choices: ["a", "b"],
      correctIndex: 5,
      correctIndices: null,
      allowMultipleCorrect: false,
    };
    expect(detectDegenerateQuestion(q)?.severity).toBe("severe");
  });

  it("passes a well-formed single-choice question", () => {
    const q: GatheredChoiceQuestion = {
      ...base,
      kind: "multiple_choice",
      choices: ["a", "b", "c"],
      correctIndex: 1,
      correctIndices: null,
      allowMultipleCorrect: false,
    };
    expect(detectDegenerateQuestion(q)).toBeNull();
  });
});

describe("detectRubricRevealsAnswer", () => {
  it("flags a rubric that contains the expected answer verbatim", () => {
    const q: GatheredWrittenQuestion = {
      source: "assessment",
      id: "w1",
      prompt: "Why do residuals help?",
      actualAnswer: "They preserve the input signal across layers",
      rubric: "Full marks if the learner says They preserve the input signal across layers.",
    };
    expect(detectRubricRevealsAnswer(q)?.severity).toBe("severe");
  });

  it("does not flag a rubric that describes criteria without revealing the answer", () => {
    const q: GatheredWrittenQuestion = {
      source: "assessment",
      id: "w1",
      prompt: "Why do residuals help?",
      actualAnswer: "They preserve the input signal across layers",
      rubric: "Award credit if the learner explains the mechanism and its effect on gradient flow.",
    };
    expect(detectRubricRevealsAnswer(q)).toBeNull();
  });
});

describe("parsePythonSignature + detectCodeSignatureMismatch", () => {
  it("parses a function name and ordered params", () => {
    expect(parsePythonSignature("def solve(x, y=3):\n    return x")).toEqual({ name: "solve", params: ["x", "y"] });
  });

  it("flags a reference answer whose function name differs from the starter", () => {
    const ex: GatheredCodeExercise = {
      source: "final_code",
      prompt: "p",
      starterCode: "def solve(x):\n    pass\n",
      workedExamples: [{ label: "basic", code: "def resolve(x):\n    return x\n" }],
      tests: [],
      hiddenTests: [],
    };
    expect(detectCodeSignatureMismatch(ex)?.criterion).toBe("code_signature_mismatch");
  });

  it("flags a param-count mismatch between starter and reference answer", () => {
    const ex: GatheredCodeExercise = {
      source: "final_code",
      prompt: "p",
      starterCode: "def solve(x):\n    pass\n",
      workedExamples: [{ label: "basic", code: "def solve(x, y):\n    return x + y\n" }],
      tests: [],
      hiddenTests: [],
    };
    expect(detectCodeSignatureMismatch(ex)?.severity).toBe("severe");
  });

  it("passes when signatures match exactly", () => {
    const ex: GatheredCodeExercise = {
      source: "final_code",
      prompt: "p",
      starterCode: "def solve(x):\n    pass\n",
      workedExamples: [{ label: "basic", code: "def solve(x):\n    return x\n" }],
      tests: [],
      hiddenTests: [],
    };
    expect(detectCodeSignatureMismatch(ex)).toBeNull();
  });
});

describe("computePreScreenFlags — transcript heuristics", () => {
  it("flags generator-structure language in a transcript", () => {
    const g = emptyGathered();
    g.transcripts = [
      {
        source: "overview",
        script: "Leo: Point 1 is the most important idea here, and the learner should focus on it.",
        transcript: "Leo: Point 1 is the most important idea here, and the learner should focus on it.",
        durationHint: 120,
        wordCount: 16,
      },
    ];
    const flags = computePreScreenFlags(g);
    expect(flags.some((f) => f.criterion === "transcript_generator_structure")).toBe(true);
  });

  it("flags generic study-coaching advice", () => {
    const g = emptyGathered();
    g.transcripts = [
      {
        source: "overview",
        script: "Leo: The trick is do not try to memorize things, just use active recall every day.",
        transcript: "Leo: The trick is do not try to memorize things, just use active recall every day.",
        durationHint: 120,
        wordCount: 16,
      },
    ];
    const flags = computePreScreenFlags(g);
    expect(flags.some((f) => f.criterion === "transcript_generic_advice")).toBe(true);
  });

  it("flags a transcript that loops the same sentence verbatim", () => {
    const g = emptyGathered();
    const loop = "The attention mechanism lets every token read from every other token position.";
    g.transcripts = [
      {
        source: "overview",
        script: `${loop} And so it goes. ${loop}`,
        transcript: `${loop} And so it goes. ${loop}`,
        durationHint: 120,
        wordCount: 24,
      },
    ];
    const flags = computePreScreenFlags(g);
    expect(flags.some((f) => f.criterion === "transcript_repetition")).toBe(true);
  });

  it("produces no flags for clean, specific content", () => {
    const g = emptyGathered();
    g.transcripts = [
      {
        source: "overview",
        script:
          "Leo: A residual connection adds the block input back to its output. Maya: Why does that help the gradient? Leo: It gives the signal a direct path so early layers still learn.",
        transcript:
          "Leo: A residual connection adds the block input back to its output. Maya: Why does that help the gradient? Leo: It gives the signal a direct path so early layers still learn.",
        durationHint: 120,
        wordCount: 40,
      },
    ];
    g.cueTimelines = [
      { source: "overview", durationHint: 120, cues: [cue(0, 60, "Residual add", "input rejoins output"), cue(60, 118, "Gradient path", "signal flows to early layers")] },
    ];
    expect(computePreScreenFlags(g)).toHaveLength(0);
  });
});
