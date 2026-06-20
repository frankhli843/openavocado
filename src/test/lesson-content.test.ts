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
    { activity_type: "audio", is_core: true, sequence_order: 1, title: "a", content: { script: "s" } },
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
});
