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
          {
            title: "Return the result",
            detail: "Then preserve the value through the helper so the returned output matches the expected shape.",
            input: "value = 3",
            output: "3",
            visual: "the value moves from process to output",
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
        {
          label: "Larger value",
          input: "helper(8)",
          expected_output: "8",
          explanation: "The same input-output contract holds for another value.",
        },
      ],
      visualization: {
        title: "Input moves through the helper",
        items: [
          { label: "Input", value: "3", role: "input" },
          { label: "Process", value: "preserve value", role: "process" },
          { label: "Return", value: "3", role: "output" },
        ],
      },
      starter_code: "pass",
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

  it("requires complete learner-facing code support, not just starter and tests", () => {
    const r = validatePracticeCodeContent({
      prompt: "Implement attention.",
      starter_code: "def attention():\n    pass\n",
      tests: [{ id: "t", description: "runs", assert: "attention() is not None" }],
    });

    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/walkthrough|io_examples|visualization|worked_examples/);
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

describe("validateReadingContent formula blocks", () => {
  it("accepts formal LaTeX with variable definitions", () => {
    const r = validateReadingContent({
      blocks: [
        { type: "paragraph", text: "Scaled dot-product attention uses queries, keys, and values." },
        {
          type: "formula",
          latex: "\\\\operatorname{Attention}(Q,K,V)=\\\\operatorname{softmax}(QK^T / \\\\sqrt{d_k})V",
          plain_english: "Queries and keys create attention weights, then those weights mix value rows into output rows.",
          variables: [
            { symbol: "Q", meaning: "query matrix, one row per token", shape: "L x d_k" },
            { symbol: "K", meaning: "key matrix, one row per token", shape: "L x d_k" },
            { symbol: "V", meaning: "value matrix carrying content to mix", shape: "L x d_v" },
            { symbol: "d_k", meaning: "key/query vector width used for scaling" },
          ],
        },
      ],
    });

    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("rejects formula-like prose without a formal LaTeX block", () => {
    const r = validateReadingContent({
      blocks: [
        { type: "paragraph", text: "Attention(Q,K,V) = softmax(QK^T / √d_k) · V" },
        { type: "paragraph", text: "This formula controls how value rows are mixed." },
      ],
    });

    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/formal formula block/);
  });

  it("rejects legacy formula blocks that do not define latex and variables", () => {
    const r = validateReadingContent({
      blocks: [
        { type: "paragraph", text: "Scaled attention has a formal expression." },
        { type: "formula", content: "Attention(Q,K,V) = softmax(QK^T / √d_k)·V" } as unknown,
      ],
    });

    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/latex|variable/);
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

function orientationVisual(slug = "orientation-scene") {
  return {
    strategy: "timeline",
    artifact_slug: slug,
    scene: {
      scene_id: `${slug}-generated-scene`,
      title: "Orientation map and tiny example",
      motif: "pipeline map plus concrete object",
      description: "A generated orientation scene that locates the lesson and creates a tiny object for the first part.",
      panels: [
        {
          id: "map",
          title: "Where we are",
          kind: "pipeline",
          description: "Shows the subject map narrowing to this lesson.",
          data: [
            { label: "Subject", value: "broad context", role: "context" },
            { label: "Lesson target", value: "focused concept", role: "process" },
            { label: "First part", value: "ready input", role: "output" },
          ],
        },
        {
          id: "example",
          title: "Tiny object",
          kind: "cards",
          description: "Names the small object the learner carries forward.",
          data: [
            { label: "Object", value: "visible example", role: "input" },
            { label: "Question", value: "what changes next", role: "process" },
          ],
        },
      ],
    },
    cues: [
      {
        start: 0,
        end: 300,
        label: "Map",
        headline: "The lesson starts by locating the concept",
        narration: "The learner first sees where this concept sits before any detail starts.",
        receive: "subject map",
        transform: "focus on this lesson target",
        pass: "local learning objective",
        panel_id: "map",
        active_elements: ["Subject", "Lesson target"],
      },
      {
        start: 300,
        end: 600,
        label: "Concrete example",
        headline: "A small example makes the object visible",
        narration: "The visual introduces a tiny concrete object that the later sections will transform.",
        receive: "local learning objective",
        transform: "instantiate a tiny example",
        pass: "visible example object",
        panel_id: "example",
        active_elements: ["Object"],
      },
      {
        start: 600,
        end: 900,
        label: "Handoff",
        headline: "The example is ready for the first lesson part",
        narration: "The learner can now carry this object into the first detailed lesson section.",
        receive: "visible example object",
        transform: "name the next operation",
        pass: "first section input",
        panel_id: "map",
        active_elements: ["First part"],
      },
    ],
  };
}

function longOverviewAudioScript(topic = "this lesson"): string {
  const paragraphs = [
    `Start with the concrete object for ${topic}. The lesson names the object, shows its shape, explains where it came from, and states why the next operation needs it. A major term is never treated as magic. It is introduced as a thing with a job, an input, an output, and a reason to exist. The opening example matters because it gives every later definition something visible to attach to.`,
    `Now revisit the same object through an analogy. Think of ${topic} as a kitchen pass in a restaurant. Ingredients arrive from one station, a cook changes them, and the plate moves to the next station with a label saying what changed. The analogy is not the final truth, but it gives the formal vocabulary a stable handle. When the written section later uses more precise terms, each term still points back to a specific object and a specific change.`,
    `Use a tiny worked example next. Take one small object, give it a name, and follow it through the lesson. The example states what shape it has, what information it carries, what operation reads it, what operation changes it, and what evidence would show the change succeeded. A worked example is valuable because it prevents labels from floating away from the actual sequence they describe.`,
    `Then trace the mechanism. A mechanism explanation answers why the next step is needed, not only what the next step is called. If a component receives a representation, explain what that representation already contains and what it lacks. If a component transforms it, explain whether the transformation changes the values, the order, the scale, the confidence, or the interpretation. If a component passes it forward, explain why the following section can trust that handoff.`,
    `Shift into implementation intuition. You should hear how the idea would feel in code or in a system diagram even if this overview is still conceptual. Name the likely data structures, the small functions, the checks, and the common debugging questions. This does not reveal a full solution. It gives you enough hooks so the later coding section feels like reinforcing the concept instead of suddenly becoming a separate programming puzzle.`,
    `Name a misconception or failure mode. It is easy to nod along while silently swapping two nearby ideas. This pass says what not to confuse, why the confusion is tempting, and what visible symptom would appear if the confusion guided an implementation. The correction uses the same concrete object again so the distinction is visible rather than merely verbal.`,
    `Synthesize the lesson again. The visual shows the object changing, the reading defines it more formally, practice checks whether the relationship is usable, and anything outside the scope can safely wait for a later lesson. That final pass ties the spoken explanation, the visual state, the written definition, and the code exercise to the same taught mechanism.`,
  ];

  return Array.from({ length: 6 }, (_, cycle) =>
    paragraphs
      .map((paragraph, index) => `${index % 2 === 0 ? "Leo" : "Maya"}: Perspective ${cycle + 1}.${index + 1}. ${paragraph}`)
      .join("\n\n")
  ).join("\n\n");
}

function richLesson(overrides: Partial<GeneratedLessonContent["activities"][number]>[] = []): GeneratedLessonContent {
  const overviewScript = longOverviewAudioScript("the fixture lesson");
  const activities: GeneratedLessonContent["activities"] = [
    {
      activity_type: "audio",
      is_core: true,
      sequence_order: 1,
      title: "a",
      content: {
        script: overviewScript,
        transcript: overviewScript,
        duration_hint: 900,
        orientation_visual: orientationVisual(),
      },
    },
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
    {
      activity_type: "assessment",
      is_core: true,
      sequence_order: 5,
      title: "s",
      content: {
        questions: [
          {
            id: "assess-q1",
            text: "Explain the fixture concept in your own words.",
            type: "free_text",
            actual_answer: "Any coherent explanation of the fixture concept.",
            rubric: "Credit a coherent explanation that names the core idea.",
          },
        ],
      },
    },
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
        "This is a substantive audio script for the visualization. It explains what to change, what to notice, what failure mode the visualization reveals, and why the visual matters for the concept being taught.",
      transcript:
        "This is a substantive audio script for the visualization. It explains what to change, what to notice, what failure mode the visualization reveals, and why the visual matters for the concept being taught.",
      duration_hint: 90,
      synced_visual: {
        strategy: "timeline",
        artifact_slug: "part-concept-audio-artifact",
        scene: {
          scene_id: "part-concept-generated-scene",
          title: "Part object transformation",
          motif: "before-after transformation board",
          description: "A generated scene specific to this part showing the incoming object, the operation, and the handoff.",
          panels: [
            {
              id: "handoff",
              title: "Part handoff",
              kind: "flow",
              description: "Shows the local receive, transform, and pass-forward steps.",
              data: [
                { label: "Receive", value: "previous concept", role: "input" },
                { label: "Transform", value: "core operation", role: "process" },
                { label: "Pass", value: "next input", role: "output" },
              ],
            },
            {
              id: "object",
              title: "Object state",
              kind: "matrix",
              description: "Shows a tiny object changing values during the audio.",
              data: [
                { label: "row 1", values: [20, 50, 80], role: "input" },
                { label: "row 2", values: [45, 70, 35], role: "process" },
              ],
            },
          ],
        },
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
            panel_id: "handoff",
            active_elements: ["Receive"],
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
            panel_id: "object",
            active_elements: ["row 2"],
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
            panel_id: "handoff",
            active_elements: ["Pass"],
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
          type: "select_all",
          prompt: "Select all statements that are true for a complete lesson part.",
          concept: "part-concept",
          difficulty: "medium",
          choices: ["It names the object", "It shows the transformation", "It checks understanding"],
          correct_indices: [0, 1, 2],
          explanation: "All are true because a complete part teaches, visualizes, and checks the mechanism.",
        },
        {
          id: "p5",
          type: "ordering",
          prompt: "Order the section flow.",
          concept: "part-concept",
          difficulty: "medium",
          items: ["receive object", "transform object", "pass object forward"],
          correct_order: ["receive object", "transform object", "pass object forward"],
          explanation: "A section should show receive, transform, and pass forward.",
        },
        {
          id: "p6",
          type: "written",
          prompt: "Explain why the visual must stay beside the text.",
          concept: "part-concept",
          difficulty: "hard",
          actual_answer: "The visual must stay beside the text so the learner can map each named object and operation to what changes on screen without searching elsewhere.",
          rubric: "Look for text-to-visual mapping, named objects, operations, and reduced cognitive load.",
        },
        {
          id: "p7",
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

describe("validateGeneratedContent: richer lessons", () => {
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

  it("fails when an assessment freeform question is authored in the quiz shape (no id/text)", () => {
    // Regression guard for the Lesson 15 placeholder: questions authored as
    // { question, options, correct } instead of { id, text } are dropped by
    // AssessmentSection and render the "generated without usable prompts"
    // placeholder. The contract must reject this before it reaches production.
    const lesson = richLesson();
    const assessment = lesson.activities.find((a) => a.activity_type === "assessment")!;
    assessment.content = {
      questions: [
        {
          type: "select_all",
          question: "Which statements are true about attention?",
          options: ["a", "b", "c", "None of the above"],
          correct: [0, 1],
        },
      ],
    };
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/assessment/);
    expect(r.errors.join(" ")).toMatch(/missing id/);
    expect(r.errors.join(" ")).toMatch(/missing text/);
  });

  it("passes when assessment freeform questions use the valid id + text shape", () => {
    const lesson = richLesson();
    const assessment = lesson.activities.find((a) => a.activity_type === "assessment")!;
    assessment.content = {
      questions: [
        {
          id: "ff1",
          text: "Explain how attention scores become weights.",
          type: "free_text",
          actual_answer: "Dot product of Q and K, scaled, then softmax into weights.",
          rubric: "Credit naming the dot product, the scaling, and softmax.",
        },
      ],
    };
    const r = validateGeneratedContent(lesson);
    expect(r.errors.filter((e) => e.startsWith("assessment "))).toEqual([]);
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

  it("fails when the top-level overview audio is shorter than the 15-minute floor", () => {
    const lesson = richLesson();
    const audio = lesson.activities.find((a) => a.activity_type === "audio")!;
    const content = audio.content as Record<string, unknown>;
    content.script = Array.from({ length: 300 }, () => "short").join(" ");
    content.transcript = content.script;
    content.duration_hint = 120;
    const r = validateGeneratedContent(lesson);

    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/2700 words/);
    expect(r.errors.join(" ")).toMatch(/900 seconds/);
  });

  it("fails when the top-level overview audio leaks authoring instructions", () => {
    const lesson = richLesson();
    const audio = lesson.activities.find((a) => a.activity_type === "audio")!;
    const content = audio.content as Record<string, unknown>;
    content.script = `${longOverviewAudioScript("the fixture lesson")}\n\nLeo: The learner should receive this as a planning note, not a spoken lesson.`;
    content.transcript = content.script;
    const r = validateGeneratedContent(lesson);

    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/learner-facing/i);
  });

  it("fails when top-level overview audio leaks lesson-outline scaffolding or generic study coaching", () => {
    const lesson = richLesson();
    const audio = lesson.activities.find((a) => a.activity_type === "audio")!;
    const content = audio.content as Record<string, unknown>;
    content.script = `${longOverviewAudioScript("the fixture lesson")}

Leo: Here is the lesson content we are carrying through the route. Point 1: Lesson part "How Q, K, V Produce Attention Scores" introduces the next block.

Maya: Treat these as signposts, not disconnected slides. Ask four questions: what are we receiving, what are we changing, what are we preserving, and what are we passing forward.

Leo: What would the variable names be? What would a small input look like?`;
    content.transcript = content.script;
    const r = validateGeneratedContent(lesson);

    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/learner-facing|generic listening/i);
  });

  it("fails when the top-level overview audio reads raw formula notation aloud", () => {
    const lesson = richLesson();
    const audio = lesson.activities.find((a) => a.activity_type === "audio")!;
    const content = audio.content as Record<string, unknown>;
    content.script = `${longOverviewAudioScript("the fixture lesson")}\n\nMaya: Now read QK^T divided by √d_k and H_{\\text{input}} directly from the transcript.`;
    content.transcript = content.script;
    const r = validateGeneratedContent(lesson);

    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/audio-friendly/i);
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

  it("rejects an authored none choice in a lesson-part select_all (UI supplies a virtual none)", () => {
    const content = validLessonPartContent();
    const q = content.practice.questions.find((x) => x.id === "p2") as {
      choices: string[];
      correct_indices: number[];
    };
    q.choices = [...q.choices, "None of the above"];
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/must not include an authored "none" choice/);
  });

  it("rejects an authored all choice in a lesson-part select_all (UI supplies a virtual all)", () => {
    const content = validLessonPartContent();
    const q = content.practice.questions.find((x) => x.id === "p4") as {
      choices: string[];
      correct_indices: number[];
    };
    q.choices = [...q.choices, "All of the above"];
    q.correct_indices = [0, 1, 2, 3];
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/must not include an authored "all" choice/);
  });

  it("rejects legacy char-offset audio cues that cannot sync to playback time", () => {
    const content = validLessonPartContent();
    content.audio.synced_visual = {
      cues: [
        { at_char: 0, action: "highlight", target: "step-0", label: "Old cue" },
        { at_char: 120, action: "highlight", target: "step-1", label: "Old cue 2" },
        { at_char: 240, action: "highlight", target: "step-2", label: "Old cue 3" },
      ],
    } as unknown as typeof content.audio.synced_visual;
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/legacy at_char|start must be/);
  });

  it("rejects timed audio cues that lack a generated bespoke scene plan", () => {
    const content = validLessonPartContent();
    const visualWithoutScene = { ...content.audio.synced_visual };
    delete (visualWithoutScene as Partial<typeof content.audio.synced_visual>).scene;
    content.audio.synced_visual = visualWithoutScene as typeof content.audio.synced_visual;
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/generated bespoke scene plan/);
  });

  it("rejects audio-synced visuals without an approved bespoke artifact slug", () => {
    const content = validLessonPartContent();
    delete (content.audio.synced_visual as Partial<typeof content.audio.synced_visual>).artifact_slug;
    content.audio.synced_visual.cues = content.audio.synced_visual.cues.map((cue) => {
      const copy = { ...(cue as typeof cue & { artifact_slug?: string }) };
      delete copy.artifact_slug;
      return copy;
    });
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/artifact_slug/);
  });

  it("accepts segmented audio visuals where every cue has its own approved artifact slug", () => {
    const content = validLessonPartContent();
    delete (content.audio.synced_visual as Partial<typeof content.audio.synced_visual>).artifact_slug;
    content.audio.synced_visual.cues = content.audio.synced_visual.cues.map((cue, index) => ({
      ...cue,
      artifact_slug: `part-audio-cue-${index + 1}`,
    }));
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(true);
  });

  it("rejects segmented audio visuals that repeat the same cue artifact", () => {
    const content = validLessonPartContent();
    content.audio.synced_visual.cues = content.audio.synced_visual.cues.map((cue) => ({
      ...cue,
      artifact_slug: "same-reused-component",
    }));
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/distinct per-cue artifact_slug/);
  });

  it("rejects select-one practice questions with select-all answer metadata", () => {
    const content = validLessonPartContent();
    content.practice.questions[0] = {
      ...content.practice.questions[0],
      type: "select_one",
      correct_index: undefined,
      correct_indices: [0, 1],
    } as typeof content.practice.questions[number];
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/select_one must not use correct_indices/);
  });

  it("rejects ordering practice whose correct_order uses numeric indices instead of item strings", () => {
    const content = validLessonPartContent();
    const ordering = content.practice.questions.find((q) => q.type === "ordering")!;
    ordering.correct_order = [1, 2, 0] as unknown as string[];
    const r = validateLessonPartContent(content, ["declarative"], validateWidgetSpec);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/correct_order must contain item strings/);
  });

  it("validates next_lesson_diagnostics when provided", () => {
    const lesson = richLesson();
    lesson.next_lesson_diagnostics = [{ id: "d1" } as unknown as { id: string; prompt: string }];
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/next_lesson_diagnostics/);
  });

  it("rejects duplicate audio-synced visuals within the same lesson", () => {
    const lesson = richLesson();
    const duplicate = validLessonPartContent();
    duplicate.audio.synced_visual = orientationVisual() as typeof duplicate.audio.synced_visual;
    lesson.activities.push({
      activity_type: "lesson_part",
      is_core: true,
      sequence_order: 6,
      title: "Duplicate visual part",
      content: duplicate,
    });
    const r = validateGeneratedContent(lesson);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/duplicates/);
  });
});
