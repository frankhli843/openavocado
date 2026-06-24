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
        widget_type: "declarative",
        instructions: "go",
        controls: [{ type: "slider", id: "p", label: "P", min: 0, max: 1, step: 0.1, default: 0.5 }],
        outputs: [{ id: "q", label: "Q", formula: "p * 2" }],
      },
    },
    {
      activity_type: "practice_code",
      is_core: true,
      sequence_order: 4,
      title: "c",
      content: { prompt: "do", tests: [{ id: "t", description: "d", assert: "x == 1" }] },
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
      duration_hint: 90,
    },
    interactive: {
      schema_version: "1.0",
      widget_type: "declarative",
      instructions: "Move the control and watch the result.",
      controls: [{ type: "slider", id: "x", label: "X", min: 0, max: 10, step: 1, default: 5 }],
      outputs: [{ id: "y", label: "Y", formula: "x * 2" }],
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
    expect(validateGeneratedContent(richLesson()).valid).toBe(true);
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
        widget_type: "declarative",
        instructions: "explore",
        controls: [{ type: "slider", id: "n", label: "N", min: 1, max: 8, step: 1, default: 1 }],
        outputs: [{ id: "o", label: "O", formula: "n * 3" }],
      },
    });
    expect(validateGeneratedContent(lesson).valid).toBe(true);
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
    expect(validateGeneratedContent(lesson).valid).toBe(true);
  });

  it("rejects lesson parts without 10 questions and 4-in-a-row rule", () => {
    const content = validLessonPartContent();
    content.quiz.questions = content.quiz.questions.slice(0, 9);
    content.quiz.consecutive_correct_required = 3;
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/10 multiple-choice|consecutive_correct_required/);
  });

  it("validates next_lesson_diagnostics when provided", () => {
    const lesson = richLesson();
    lesson.next_lesson_diagnostics = [{ id: "d1" } as unknown as { id: string; prompt: string }];
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/next_lesson_diagnostics/);
  });
});
