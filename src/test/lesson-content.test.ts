/**
 * Tests for the non-interactive lesson content schemas: written text (reading),
 * safe media embeds, and scaffolded code exercises (answer-hiding), plus the
 * new declarative chart types (table/tree) and the generator-contract rules.
 */
import { describe, it, expect } from "vitest";
import {
  validateReadingContent,
  validateMediaContent,
  validatePracticeCodeContent,
  validateLessonPartContent,
  extractYouTubeId,
  resolveYouTubeId,
  buildYouTubeEmbedUrl,
} from "../lib/lesson-content/schema";
import { validateWidgetSpec, type DeclarativeWidgetSpec } from "../lib/widgets/schema";
import { validateGeneratedContent } from "../lib/lesson-generator/contract";
import type { GeneratedLessonContent } from "../types";

// ─── Written text ────────────────────────────────────────────────────────────

describe("validateReadingContent", () => {
  it("accepts substantive teaching text", () => {
    const r = validateReadingContent({
      blocks: [
        { type: "heading", text: "Idea" },
        { type: "paragraph", text: "A real explanation of the concept." },
        { type: "definition", term: "X", definition: "what X is" },
      ],
      summary: "recap",
    });
    expect(r.valid).toBe(true);
  });

  it("rejects an empty or near-empty shell", () => {
    expect(validateReadingContent({ blocks: [] }).valid).toBe(false);
    expect(validateReadingContent({ blocks: [{ type: "heading", text: "Only a heading" }] }).valid).toBe(false);
  });

  it("rejects malformed blocks", () => {
    const r = validateReadingContent({ blocks: [{ type: "bogus", text: "x" }, { type: "paragraph" }] });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/unsupported type|missing text/);
  });
});

// ─── Media safety ────────────────────────────────────────────────────────────

describe("YouTube id extraction is host-restricted", () => {
  it("extracts ids from watch / youtu.be / embed / nocookie urls", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=HZGCoVF3YvM")).toBe("HZGCoVF3YvM");
    expect(extractYouTubeId("https://youtu.be/HZGCoVF3YvM")).toBe("HZGCoVF3YvM");
    expect(extractYouTubeId("https://www.youtube-nocookie.com/embed/HZGCoVF3YvM")).toBe("HZGCoVF3YvM");
  });

  it("rejects non-YouTube hosts and unsafe schemes", () => {
    expect(extractYouTubeId("https://evil.example.com/embed/HZGCoVF3YvM")).toBeNull();
    expect(extractYouTubeId("javascript:alert(1)")).toBeNull();
    expect(extractYouTubeId("https://www.youtube.com/watch?v=tooshort")).toBeNull();
  });

  it("resolveYouTubeId prefers a valid video_id", () => {
    expect(resolveYouTubeId({ video_id: "HZGCoVF3YvM" })).toBe("HZGCoVF3YvM");
    expect(resolveYouTubeId({ video_id: "nope", url: "https://youtu.be/HZGCoVF3YvM" })).toBe("HZGCoVF3YvM");
    expect(resolveYouTubeId({ video_id: "bad!" })).toBeNull();
  });

  it("builds a privacy-enhanced nocookie embed url", () => {
    const url = buildYouTubeEmbedUrl("HZGCoVF3YvM", 30);
    expect(url).toContain("youtube-nocookie.com/embed/HZGCoVF3YvM");
    expect(url).toContain("start=30");
  });
});

describe("validateMediaContent", () => {
  it("accepts a well-formed YouTube embed", () => {
    const r = validateMediaContent({
      embeds: [{ provider: "youtube", video_id: "HZGCoVF3YvM", title: "T", reason: "why", fallback_text: "fb" }],
    });
    expect(r.valid).toBe(true);
  });

  it("accepts timestamped segment guidance", () => {
    const r = validateMediaContent({
      embeds: [{
        provider: "youtube",
        video_id: "HZGCoVF3YvM",
        title: "T",
        reason: "Watch the transform pipeline.",
        relevance: "segments",
        segments: [{ label: "Resize walkthrough", start: 15, end: 180, reason: "Shows the shape mismatch." }],
        fallback_text: "fb",
      }],
    });
    expect(r.valid).toBe(true);
  });

  it("rejects segment guidance without exact usable times", () => {
    const missing = validateMediaContent({
      embeds: [{ provider: "youtube", video_id: "HZGCoVF3YvM", title: "T", reason: "r", relevance: "segments", fallback_text: "f" }],
    });
    expect(missing.valid).toBe(false);
    expect(missing.errors.join(" ")).toMatch(/segments array/);

    const backwards = validateMediaContent({
      embeds: [{
        provider: "youtube",
        video_id: "HZGCoVF3YvM",
        title: "T",
        reason: "r",
        relevance: "segments",
        segments: [{ start: 90, end: 30 }],
        fallback_text: "f",
      }],
    });
    expect(backwards.valid).toBe(false);
    expect(backwards.errors.join(" ")).toMatch(/end must be greater than start/);
  });

  it("rejects unsupported providers and unresolvable videos", () => {
    expect(validateMediaContent({ embeds: [{ provider: "vimeo", video_id: "x", title: "T", reason: "r", fallback_text: "f" }] }).valid).toBe(false);
    expect(validateMediaContent({ embeds: [{ provider: "youtube", url: "https://evil.com/x", title: "T", reason: "r", fallback_text: "f" }] }).valid).toBe(false);
  });

  it("requires title, reason, and fallback_text", () => {
    const r = validateMediaContent({ embeds: [{ provider: "youtube", video_id: "HZGCoVF3YvM" }] });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/title|reason|fallback/);
  });
});

// ─── Code exercise answer-hiding ─────────────────────────────────────────────

describe("validatePracticeCodeContent", () => {
  it("accepts a scaffolded exercise with prompt + tests", () => {
    const r = validatePracticeCodeContent({
      prompt: "Do the thing",
      walkthrough: {
        title: "Think through the behavior",
        steps: [
          {
            title: "Read the input",
            detail: "Start by identifying the exact value entering the function before writing syntax.",
            input: "helper(3)",
            output: "3",
            visual: "3 flows into helper",
          },
        ],
      },
      io_examples: [
        {
          label: "Small value",
          input: "helper(3)",
          expected_output: "3",
          explanation: "The helper preserves the input in this exercise.",
        },
      ],
      visualization: {
        title: "Input moves through the helper",
        items: [
          { label: "Input", value: "3", role: "input" },
          { label: "Return", value: "3", role: "output" },
        ],
      },
      starter_code: "pass",
      hints: [{ level: 1, text: "think" }],
      tests: [{ id: "t1", description: "works", assert: "x == 1" }],
      hidden_tests: [{ id: "h1", description: "edge", assert: "x >= 0" }],
    });
    expect(r.valid).toBe(true);
  });

  it("rejects an exposed final answer", () => {
    for (const key of ["solution", "answer", "solution_code", "reference_solution", "completed_code"]) {
      const r = validatePracticeCodeContent({ prompt: "p", tests: [{ id: "t", description: "d", assert: "x" }], [key]: "x = 1" });
      expect(r.valid, key).toBe(false);
      expect(r.errors.join(" ")).toMatch(/must not expose a final answer/);
    }
  });

  it("requires a prompt and at least one test", () => {
    expect(validatePracticeCodeContent({ tests: [{ id: "t", description: "d", assert: "x" }] }).valid).toBe(false);
    expect(validatePracticeCodeContent({ prompt: "p" }).valid).toBe(false);
  });

  it("rejects malformed code walkthrough and input-output visualization fields", () => {
    const r = validatePracticeCodeContent({
      prompt: "Do the thing",
      walkthrough: { steps: [{ title: "", detail: "too short" }] },
      io_examples: [{ label: "Case", input: "", expected_output: "" }],
      visualization: { title: "Flow", items: [{ label: "Only", value: "x", role: "middle" }] },
      tests: [{ id: "t", description: "d", assert: "x" }],
    });

    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/walkthrough|io_examples|visualization/);
  });
});

// ─── New declarative chart types ─────────────────────────────────────────────

describe("declarative widget table/tree charts", () => {
  const base = (charts: unknown): DeclarativeWidgetSpec =>
    ({
      schema_version: "1.0",
      widget_type: "declarative",
      instructions: "go",
      controls: [{ type: "slider", id: "p", label: "P", min: 0, max: 1, step: 0.01, default: 0.5 }],
      outputs: [{ id: "q", label: "Q", formula: "p * 100" }],
      charts,
    } as unknown as DeclarativeWidgetSpec);

  it("accepts a frequency table whose cells reference known ids", () => {
    const r = validateWidgetSpec(
      base([{ type: "table", headers: ["a", "b"], rows: [{ label: "r", cells: [{ formula: "q" }, { formula: "p" }] }] }])
    );
    expect(r.valid).toBe(true);
  });

  it("accepts a tree whose node formulas reference known ids", () => {
    const r = validateWidgetSpec(
      base([{ type: "tree", root: { label: "root", valueFormula: "q", children: [{ label: "c", valueFormula: "p" }] } }])
    );
    expect(r.valid).toBe(true);
  });

  it("rejects table/tree formulas referencing unknown ids", () => {
    const t = validateWidgetSpec(base([{ type: "table", headers: ["a"], rows: [{ label: "r", cells: [{ formula: "nope" }] }] }]));
    expect(t.valid).toBe(false);
    const tr = validateWidgetSpec(base([{ type: "tree", root: { label: "x", valueFormula: "ghost" } }]));
    expect(tr.valid).toBe(false);
  });
});

// ─── Generator contract: richer-lesson requirements ──────────────────────────

function codeStudySupport() {
  return {
    walkthrough: {
      title: "Trace the behavior",
      steps: [
        {
          title: "Read the input",
          detail: "Identify the exact value that enters the function before writing implementation syntax.",
          input: "solve()",
          output: "not returned yet",
          visual: "the call enters the helper",
        },
        {
          title: "Return the expected value",
          detail: "The function should produce the value the tests expect, keeping the output shape simple and inspectable.",
          input: "internal value 1",
          output: "1",
          visual: "the value moves into the return slot",
        },
      ],
    },
    io_examples: [
      { label: "Default call", input: "solve()", expected_output: "1", explanation: "The fixture returns the expected value." },
      { label: "Result variable", input: "result", expected_output: "1", explanation: "The final result should contain the same value." },
    ],
    visualization: {
      title: "Input maps to expected output",
      items: [
        { label: "Input", value: "solve()", role: "input" as const },
        { label: "Process", value: "choose expected value", role: "process" as const },
        { label: "Output", value: "1", role: "output" as const },
      ],
    },
  };
}

function richLesson(overrides: Partial<GeneratedLessonContent["activities"][number]>[] = []): GeneratedLessonContent {
  const activities: GeneratedLessonContent["activities"] = [
    { activity_type: "audio", is_core: true, sequence_order: 1, title: "a", content: { script: "A full spoken walkthrough of the concept for this lesson." } },
    {
      activity_type: "reading",
      is_core: true,
      sequence_order: 2,
      title: "r",
      content: { blocks: [{ type: "paragraph", text: "Real teaching text here." }, { type: "definition", term: "T", definition: "d" }] },
    },
    {
      activity_type: "interactive",
      is_core: true,
      sequence_order: 3,
      title: "i",
      content: {
        schema_version: "1.0",
        widget_type: "bespoke-artifact",
        instructions: "Explore the purpose-built visualization.",
        params: { artifact_slug: "rich-lesson-viz" },
      },
    },
    {
      activity_type: "practice_code",
      is_core: true,
      sequence_order: 4,
      title: "c",
      content: {
        prompt: "do",
        ...codeStudySupport(),
        starter_code: "x = 1\n",
        worked_examples: [
          {
            label: "basic",
            title: "Basic readable version",
            code: "def solve():\n    value = 1\n    result = value\n    return result\n\nresult = solve()\n",
          },
          {
            label: "concise",
            title: "Best concise version",
            code: "def solve():\n    return 1\n\nresult = solve()\n",
          },
        ],
        tests: [{ id: "t", description: "d", assert: "x == 1" }],
      },
    },
    { activity_type: "assessment", is_core: true, sequence_order: 5, title: "s", content: {} },
  ];
  for (const o of overrides) {
    activities.push({ activity_type: "reading", is_core: true, sequence_order: 9, title: "x", content: {}, ...o });
  }
  return {
    title: "T",
    description: "d",
    goals: ["g"],
    tags: [],
    activities,
    mastery_targets: [],
    metadata: { generator: "t", generator_version: "1", generated_at: "now", source_context_summary: "x" },
  };
}

function partQuestions() {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `part-q${i + 1}`,
    concept: "part-concept",
    difficulty: (i < 3 ? "easy" : i < 7 ? "medium" : "hard") as "easy" | "medium" | "hard",
    question: `Question ${i + 1}?`,
    choices: ["Correct", "Wrong A", "Wrong B", "Wrong C"],
    correct_index: 0,
    explanation: "The first option is correct for this test fixture.",
    misconception_target: "fixture misconception",
  }));
}

function validLessonPartContent() {
  return {
    reading: {
      intro: "Part intro",
      blocks: [
        { type: "paragraph", text: "A real explanation of this part." },
        { type: "definition", term: "Part", definition: "One focused lesson segment." },
      ],
      summary: "Part summary",
    },
    audio: {
      script:
        "This is a substantive audio script for the visualization. It explains what the learner should change, what they should notice, what failure mode the visualization reveals, and why the visual matters for the concept being taught.",
      transcript:
        "This is a substantive audio script for the visualization. It explains what the learner should change, what they should notice, what failure mode the visualization reveals, and why the visual matters for the concept being taught.",
      duration_hint: 90,
      synced_visual: {
        strategy: "timeline",
        cues: [
          {
            start: 0,
            end: 25,
            label: "Receives",
            headline: "The part starts from the previous concept",
            narration: "The visual begins by naming what arrives from the previous section.",
            receive: "previous concept",
            transform: "focus the learner on this part",
            pass: "ready-to-change state",
          },
          {
            start: 25,
            end: 60,
            label: "Transforms",
            headline: "The central operation changes the object",
            narration: "The visual changes the object while the audio explains the mechanism.",
            receive: "ready-to-change state",
            transform: "perform the core operation",
            pass: "changed object",
          },
          {
            start: 60,
            end: 90,
            label: "Passes forward",
            headline: "The result becomes the next section's input",
            narration: "The visual shows the handoff so the learner knows why this section mattered.",
            receive: "changed object",
            transform: "package the output",
            pass: "next input",
          },
        ],
      },
    },
    interactive: {
      schema_version: "1.0",
      widget_type: "bespoke-artifact",
      instructions: "Move the control and watch the result.",
      params: { artifact_slug: "part-concept-viz" },
    },
    code: {
      prompt: "Implement the focused helper for this lesson part.",
      ...codeStudySupport(),
      starter_code: "def helper(x):\n    return x\n",
      worked_examples: [
        {
          label: "basic",
          title: "Basic readable version",
          code: "def helper(x):\n    result = x\n    return result\n",
        },
        {
          label: "concise",
          title: "Best concise version",
          code: "def helper(x):\n    return x\n",
        },
      ],
      tests: [{ id: "part-code", description: "helper returns input", assert: "helper(3) == 3" }],
    },
    practice: {
      pass_threshold: 4,
      written_feedback: "llm_judge",
      questions: [
        {
          id: "p1",
          type: "select_one",
          prompt: "Which object enters the part?",
          concept: "part-concept",
          difficulty: "easy",
          choices: ["previous concept", "unrelated fact", "final answer"],
          correct_index: 0,
          explanation: "The part starts from the previous concept.",
        },
        {
          id: "p2",
          type: "select_all",
          prompt: "Select all true statements.",
          concept: "part-concept",
          difficulty: "medium",
          choices: ["The object changes", "The handoff matters", "The visual is decorative"],
          correct_indices: [0, 1],
          explanation: "The visual should show the object changing and being handed off.",
        },
        {
          id: "p3",
          type: "select_all",
          prompt: "Select all statements that are true for a placeholder-only lesson.",
          concept: "part-concept",
          difficulty: "medium",
          choices: ["It grounds objects", "It supports practice", "It is acceptable"],
          correct_indices: [],
          explanation: "None are true because placeholders are rejected.",
        },
        {
          id: "p4",
          type: "ordering",
          prompt: "Order the section flow.",
          concept: "part-concept",
          difficulty: "medium",
          items: ["receive object", "transform object", "pass object forward"],
          correct_order: ["receive object", "transform object", "pass object forward"],
          explanation: "A section should show receive, transform, and pass forward.",
        },
        {
          id: "p5",
          type: "written",
          prompt: "Explain why the visual must stay beside the text.",
          concept: "part-concept",
          difficulty: "hard",
          actual_answer: "The visual must stay beside the text so the learner can map each named object and operation to what changes on screen without searching elsewhere.",
          rubric: "Look for text-to-visual mapping, named objects, operations, and reduced cognitive load.",
        },
        {
          id: "p6",
          type: "select_one",
          prompt: "What should the code practice target?",
          concept: "part-concept",
          difficulty: "easy",
          choices: ["The section's mechanism", "A random syntax drill", "Only the final lesson concept"],
          correct_index: 0,
          explanation: "Part code should practice the part's mechanism.",
        },
      ],
    },
    quiz: {
      pass_threshold: 4,
      consecutive_correct_required: 4,
      idk_option: true,
      questions: partQuestions(),
    },
  };
}

describe("validateGeneratedContent — richer lessons", () => {
  it("passes a complete lesson with audio, reading, interactive, code, assessment", () => {
    const r = validateGeneratedContent(richLesson());
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("fails when written text (reading) is missing", () => {
    const lesson = richLesson();
    lesson.activities = lesson.activities.filter((a) => a.activity_type !== "reading");
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/reading/);
  });

  it("fails when a practice_code activity exposes the final answer", () => {
    const lesson = richLesson();
    const code = lesson.activities.find((a) => a.activity_type === "practice_code")!;
    (code.content as Record<string, unknown>).solution = "x = 1";
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/must not expose a final answer/);
  });

  it("fails when a media activity has an unsafe embed", () => {
    const lesson = richLesson();
    lesson.activities.push({
      activity_type: "media",
      is_core: false,
      sequence_order: 6,
      title: "m",
      content: { embeds: [{ provider: "youtube", url: "https://evil.com/x", title: "t", reason: "r", fallback_text: "f" }] },
    });
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/media/);
  });

  it("fails when the audio script is missing or a stub (no placeholder audio)", () => {
    const lesson = richLesson();
    const audio = lesson.activities.find((a) => a.activity_type === "audio")!;
    audio.content = { script: "tbd" };
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/audio/i);
  });

  it("fails a multi-concept lesson that ships only one thin visual perspective", () => {
    const lesson = richLesson();
    lesson.goals = ["resize", "normalize", "channel order", "batching"]; // 4 concepts
    // richLesson has a single interactive widget with no charts[] → 1 perspective
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/visual perspective/i);
  });

  it("passes a multi-concept lesson with two interactive perspectives", () => {
    const lesson = richLesson();
    lesson.goals = ["resize", "normalize", "channel order"];
    lesson.activities.push({
      activity_type: "interactive",
      is_core: true,
      sequence_order: 6,
      title: "i2",
      content: {
        schema_version: "1.0",
        widget_type: "bespoke-artifact",
        instructions: "Explore the second purpose-built visualization.",
        params: { artifact_slug: "second-perspective-viz" },
      },
    });
    const r = validateGeneratedContent(lesson);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("passes a lesson-part based lesson and validates the part contract", () => {
    const lesson = richLesson();
    lesson.activities = lesson.activities.filter(
      (a) => a.activity_type !== "reading" && a.activity_type !== "interactive"
    );
    lesson.activities.push({
      activity_type: "lesson_part",
      is_core: true,
      sequence_order: 2,
      title: "Part",
      content: validLessonPartContent(),
    });

    const direct = validateLessonPartContent(
      validLessonPartContent(),
      ["declarative"],
      validateWidgetSpec
    );
    expect(direct.valid).toBe(true);
    const r = validateGeneratedContent(lesson);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("rejects lesson parts without mixed practice and code", () => {
    const content = validLessonPartContent() as Partial<ReturnType<typeof validLessonPartContent>>;
    delete content.practice;
    delete content.code;
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/mixed practice|practice_code/);
  });

  it("validates next_lesson_diagnostics when provided", () => {
    const lesson = richLesson();
    lesson.next_lesson_diagnostics = [{ id: "d1" } as unknown as { id: string; prompt: string }];
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/next_lesson_diagnostics/);
  });
});
