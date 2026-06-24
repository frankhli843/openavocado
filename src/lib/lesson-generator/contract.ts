/**
 * Lesson Generator Skill Contract
 *
 * This file defines the stable interface between the AvocadoCore app and
 * any lesson-generator skill or agent. The app provides structured context;
 * the generator returns structured content that fits the lesson framework.
 *
 * Implementations:
 * - Dora skill (Frank's deployment): creates a Doramon todo-loop task
 * - CLI script: invokes a model via CLI and writes output to a local file
 * - API-backed: calls a REST endpoint that wraps an LLM
 * - Custom: any code that implements LessonGeneratorAdapter
 *
 * None of these implementations belong in the reusable repo.
 * They live in local deployment config or private skill files.
 */

import type { LessonGeneratorContext, GeneratedLessonContent, ActivityType } from "@/types";
import { validateWidgetSpec, WIDGET_SCHEMA_VERSION } from "@/lib/widgets/schema";
import { REGISTERED_WIDGETS } from "@/lib/widgets/registry";
import {
  validateReadingContent,
  validateMediaContent,
  validatePracticeCodeContent,
  validateNextLessonDiagnostics,
} from "@/lib/lesson-content/schema";

/** Minimum audio script length to count as a real, generation-ready script. */
const MIN_AUDIO_SCRIPT_CHARS = 20;

export { WIDGET_SCHEMA_VERSION };

/**
 * Widget spec authoring guidance for lesson generators.
 *
 * An `interactive` activity's `content` MUST be a WidgetSpec:
 *   - schema_version: "1.x"
 *   - widget_type: "declarative" or a registered type ({@link REGISTERED_WIDGETS})
 *   - instructions: learner-facing description of what to do
 *   - declarative widgets: controls[], outputs[] (safe formulas), optional panels[]/chart
 *   - registered widgets: typed params (never code)
 *
 * Arbitrary AI-authored React/JS is NOT accepted. Custom widgets are expressed
 * declaratively or added to the reviewed registry — never executed from generated code.
 */
export const WIDGET_AUTHORING_NOTE =
  "interactive.content must be a WidgetSpec (declarative or registered). No raw code.";

/**
 * The enrichment quality bar every generated lesson must meet, formatted for
 * direct inclusion in a lesson-generation task/prompt.
 *
 * This is the SAME standard as docs/lesson-authoring-guide.md ("Enrichment
 * requirements") and the machine-checked {@link validateGeneratedContent}. It
 * lives here so the reusable generator paths (the Dora-task adapter and any
 * other generator) hand future lesson-generation AGENTS the requirements
 * directly — not just a doc link they might never open. Keep it in sync with the
 * authoring guide and validateGeneratedContent whenever the contract changes.
 */
export const LESSON_QUALITY_BAR_PROMPT = [
  "=== LESSON QUALITY BAR (required for EVERY generated lesson) ===",
  "Before lesson work starts, read the main AvocadoCore lesson-authoring skill: skills/avocadocore-lesson-authoring/SKILL.md.",
  "Do not ship a thin, audio-only, or high-level-only lesson. Every lesson must include:",
  '- Generated audio AVAILABLE AT CREATION: a substantive spoken script (never a stub or "audio coming soon"); produce the actual audio artifact at creation time and record it as a generated artifact.',
  "- WHY-FIRST TEACHING: before formulas or implementation details, explain the high-level purpose and the specific mismatch/failure mode this lesson resolves. Each major step must answer: what breaks or becomes invalid if we skip it?",
  "- NO UNDOCUMENTED ASSUMPTIONS: do not assume domain facts are true unless they are already documented in AvocadoCore context, present in the local SQLite evidence, or verified and recorded in the lesson/task notes.",
  "- DYNAMIC, BESPOKE AUTHORING: do not fill a reusable template. Choose the lesson scope, metaphor, examples, visualizations, practice, quiz, and video because they fit this learner, this topic, and the DB evidence.",
  "- EXAMPLES + METAPHORS: use fitting metaphors and simple examples to make each major step or concept understandable. Multi-step lessons should give each major step its own plain-language handle, metaphor, and easy examples where useful.",
  "- Audio must be a real walkthrough, not a short caption or table of contents. It must explain the why, connect the steps, and include at least one concrete worked example in plain language.",
  "- First-class WRITTEN teaching text the learner can study without the audio (headings, a definition, a worked example, a summary) — not a transcript dump.",
  "- MULTIPLE meaningful visual/interactive explorations when the lesson covers multiple concepts. A multi-concept lesson (3+ goals/mastery targets) needs at least TWO distinct visual perspectives; a multi-step lesson should prefer step-specific visuals. One thin widget for many concepts is rejected.",
  "- Interactives must deepen understanding, not merely display graphs. Each widget needs a learning objective, learner-controlled variable, visible consequence/failure mode, and written takeaway. Prefer before/after and 'what breaks if...' interactions.",
  "- YouTube media should be included when a highly relevant video is found. Do NOT include long generic videos as filler. If media is used, it must be short or timestamped to the exact relevant segment, with a reason that tells the learner what to watch for; otherwise omit media.",
  "- PRACTICE/CODE the learner submits: scaffolded, with progressive hints and public + hidden tests, and never an exposed answer.",
  '- ADAPTIVE ASSESSMENT IS REQUIRED for normal generated lessons: include an MC quiz where every question carries a required difficulty (easy|medium|hard) and the virtual "I don\'t know" option, plus freeform questions. Omit the quiz only for explicitly non-assessed reference/diagnostic content and document why.',
  "- SQLITE MASTERY EVIDENCE: lesson generation must use and update structured local DB evidence where appropriate: assessment_results, attempts, progress_points, mastery_signals, generated_artifacts, and next_lesson_jobs. Do not hide durable mastery state in prose.",
  "- END-OF-LESSON next-lesson diagnostics: what felt unclear, what to cover next, confidence/effort, and a practical objective.",
  "- EXPLICIT preview / deeper-later wording: if a concept is intentionally introduced only at a high level, the audio script AND the written text must say so — name it a preview and state it will be explored in more detail in a later lesson. Never leave a glossed-over idea looking fully taught.",
  "The machine-checked gate is validateGeneratedContent (src/lib/lesson-generator/contract.ts); the full standard is docs/lesson-authoring-guide.md. A lesson that fails validateGeneratedContent must be fixed, not shipped.",
  "- KNOWLEDGE GRAPH ORIENTATION: every lesson must include a knowledge_graph_data field (KnowledgeGraphData) showing where this lesson sits in the curriculum — which concepts are covered, which are previewed, and which come later. Validated by validateKnowledgeGraphData.",
  "- MANUAL AUTHORING (not blind autogeneration): you are the AI lesson author — own the pedagogy. Before generating, decide what gap this lesson addresses, what the single most important takeaway is, and what example/interaction will make it click. Author the knowledge_graph_data first (it is the lesson map). Design each interactive intentionally with a learning objective and a learner-controlled variable that reveals a consequence. A template fill or autogeneration-only output does not pass QA.",
  "- DORA TASK AND MANUAL QA: generation must be tracked in a Dora task following the acceptance criteria template in docs/lesson-authoring-guide.md 'New lesson Dora task — acceptance criteria template'. Evidence required in task notes BEFORE QA: lesson id in DB, audio route HTTP 200, live-URL or fresh-DB screenshot (desktop 1280 + mobile 390). QA must be done by a DIFFERENT reviewer agent (not the generator). The reviewer opens the browser and interacts with every activity. See docs/lesson-authoring-guide.md 'Lesson generation workflow' and 'What separate QA means'.",
].join("\n");

/**
 * A lesson generator adapter.
 * Implement this to wire your preferred generation backend.
 */
export interface LessonGeneratorAdapter {
  name: string;

  /**
   * Generate lesson content for a given context.
   * May be async and long-running (dispatches a background task).
   *
   * Returns either the generated content directly (sync/fast adapters)
   * or a pending ticket reference (async adapters where generation happens offline).
   */
  generate(
    context: LessonGeneratorContext
  ): Promise<GeneratorResult>;
}

export type GeneratorResult =
  | { status: "ready"; content: GeneratedLessonContent }
  | { status: "pending"; ref: string; estimated_ready_at?: string }
  | { status: "error"; error: string };

/**
 * Builds the generator context from database state.
 * This is what the app passes to the generator skill.
 */
export function buildGeneratorContext(params: {
  subject: {
    id: number;
    title: string;
    description: string | null;
    goals: string | null;
    criteria: string | null;
    current_level: "familiarity" | "competence" | "mastery";
  };
  learner: {
    id: number;
    display_name: string;
    preferred_lang: string;
  };
  lesson_number: number;
  previous_lessons: Array<{
    title: string;
    status: "queued" | "in_progress" | "completed" | "skipped";
    completed_at: string | null;
  }>;
  mastery_signals: Array<{
    signal_type: "strength" | "weak_spot" | "misconception" | "review_needed" | "ready_to_advance";
    concept: string;
    detail: string | null;
    confidence: number | null;
  }>;
  latest_assessment_answers?: Record<string, string>;
  instructions?: string;
}): LessonGeneratorContext {
  return {
    subject: params.subject,
    learner: params.learner,
    lesson_number: params.lesson_number,
    previous_lessons: params.previous_lessons,
    mastery_signals: params.mastery_signals,
    latest_assessment_answers: params.latest_assessment_answers,
    instructions: params.instructions,
  };
}

/**
 * Validates that generated content satisfies the lesson structure requirements.
 * Every lesson must have: audio, interactive, practice_code, assessment (core).
 */
export function validateGeneratedContent(
  content: GeneratedLessonContent
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];

  if (!content.title?.trim()) errors.push("Missing title");
  if (!Array.isArray(content.goals) || content.goals.length === 0) {
    errors.push("Missing goals");
  }

  // Every normal lesson must teach in writing as well as audio, so `reading`
  // joins the required core sections.
  const coreRequired: ActivityType[] = [
    "audio",
    "reading",
    "interactive",
    "practice_code",
    "assessment",
  ];
  const coreActivities = content.activities
    .filter((a) => a.is_core)
    .map((a) => a.activity_type);

  for (const required of coreRequired) {
    if (!coreActivities.includes(required)) {
      errors.push(`Missing required core section: ${required}`);
    }
  }

  // Code section required for every subject (even non-technical)
  if (!coreActivities.includes("practice_code")) {
    errors.push("practice_code section is required for every subject");
  }

  // Generated audio must be available at lesson creation, not a placeholder.
  // The audio activity must carry a substantive script (the source the audio is
  // generated from), so a lesson can never ship audio-less or with a stub.
  const audioActivity = content.activities.find((a) => a.activity_type === "audio");
  if (audioActivity) {
    const script = (audioActivity.content as Record<string, unknown>)?.script;
    if (typeof script !== "string" || script.trim().length < MIN_AUDIO_SCRIPT_CHARS) {
      errors.push(
        "audio activity must include a substantive script (generated audio must be available at lesson creation, not a placeholder)"
      );
    }
  }

  // Multiple visual perspectives when the lesson covers multiple concepts. A
  // multi-concept lesson (3+ goals or mastery targets) must offer at least two
  // distinct visual explorations — either several interactive activities, or a
  // declarative widget that drives several charts — so a broad lesson is never a
  // single thin widget. (Single-concept lessons are exempt.)
  const interactiveActivities = content.activities.filter((a) => a.activity_type === "interactive");
  let perspectives = interactiveActivities.length;
  for (const a of interactiveActivities) {
    const charts = (a.content as Record<string, unknown>)?.charts;
    if (Array.isArray(charts) && charts.length >= 2) perspectives += charts.length - 1;
  }
  const conceptCount = Math.max(
    Array.isArray(content.goals) ? content.goals.length : 0,
    Array.isArray(content.mastery_targets) ? content.mastery_targets.length : 0
  );
  if (conceptCount >= 3 && perspectives < 2) {
    errors.push(
      "a multi-concept lesson needs at least two visual perspectives (multiple interactive activities, or a declarative widget with a charts[] array) — do not ship one thin widget for many concepts"
    );
  }

  // End-of-lesson next-lesson diagnostics: when provided, they must be valid.
  // (Generators should always provide them; the app applies a default set if a
  // lesson omits them — see DEFAULT_NEXT_LESSON_DIAGNOSTICS.)
  if (content.next_lesson_diagnostics !== undefined) {
    const r = validateNextLessonDiagnostics(content.next_lesson_diagnostics);
    if (!r.valid) for (const e of r.errors) errors.push(`next_lesson_diagnostics: ${e}`);
  }

  const knownWidgetTypes = REGISTERED_WIDGETS.map((w) => w.type);
  for (const [i, activity] of content.activities.entries()) {
    const label = `activity[${i}] (${activity.title ?? "untitled"})`;

    // Interactive activities must carry a valid, safe widget spec.
    if (activity.activity_type === "interactive") {
      const result = validateWidgetSpec(activity.content, knownWidgetTypes);
      if (!result.valid) {
        for (const e of result.errors) errors.push(`interactive ${label}: ${e}`);
      }
    }

    // Written text must be substantive teaching content, not an empty shell.
    if (activity.activity_type === "reading") {
      const result = validateReadingContent(activity.content);
      if (!result.valid) {
        for (const e of result.errors) errors.push(`reading ${label}: ${e}`);
      }
    }

    // Media embeds must be safe (resolvable YouTube ids) with reason + fallback.
    if (activity.activity_type === "media") {
      const result = validateMediaContent(activity.content);
      if (!result.valid) {
        for (const e of result.errors) errors.push(`media ${label}: ${e}`);
      }
    }

    // Code exercises must be scaffolded submissions, never an exposed answer.
    if (activity.activity_type === "practice_code") {
      const result = validatePracticeCodeContent(activity.content);
      if (!result.valid) {
        for (const e of result.errors) errors.push(`practice_code ${label}: ${e}`);
      }
    }
  }

  // Knowledge graph orientation: strongly recommended for all lessons.
  // Logged as a warning, not a hard error, so existing seeded lessons still
  // pass until they are authored with graph data.
  const warnings: string[] = [];
  if (!content.knowledge_graph_data) {
    warnings.push(
      "knowledge_graph_data missing — every lesson should include a KnowledgeGraphData orientation map showing where this lesson fits in the subject curriculum"
    );
  } else {
    const kg = validateKnowledgeGraphData(content.knowledge_graph_data);
    for (const e of kg.errors) warnings.push(`knowledge_graph_data: ${e}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a KnowledgeGraphData object (soft — warnings only).
 * The graph is authored per-lesson to show the curriculum context, so the
 * minimum bar is: at least one root/subject node, at least two total nodes,
 * and every edge references nodes that exist in the graph.
 */
export function validateKnowledgeGraphData(
  graph: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!graph || typeof graph !== "object") {
    return { valid: false, errors: ["knowledge_graph_data must be an object"] };
  }
  const g = graph as Record<string, unknown>;
  if (g.type !== "high-level" && g.type !== "focused") {
    errors.push('knowledge_graph_data.type must be "high-level" or "focused"');
  }
  if (!g.title || typeof g.title !== "string" || !g.title.trim()) {
    errors.push("knowledge_graph_data.title is required");
  }
  if (!Array.isArray(g.nodes) || g.nodes.length < 2) {
    errors.push("knowledge_graph_data.nodes must have at least 2 nodes");
    return { valid: errors.length === 0, errors };
  }
  const nodeIds = new Set<string>();
  for (const [i, n] of (g.nodes as unknown[]).entries()) {
    if (!n || typeof n !== "object") { errors.push(`nodes[${i}] must be an object`); continue; }
    const node = n as Record<string, unknown>;
    if (!node.id || typeof node.id !== "string") errors.push(`nodes[${i}].id is required`);
    else nodeIds.add(node.id as string);
    if (!node.label || typeof node.label !== "string") errors.push(`nodes[${i}].label is required`);
    if (typeof node.covered !== "boolean") errors.push(`nodes[${i}].covered must be boolean`);
  }
  const hasRoot = (g.nodes as unknown[]).some((n) => {
    if (!n || typeof n !== "object") return false;
    return (n as Record<string, unknown>).category === "subject_root";
  });
  if (!hasRoot) errors.push("knowledge_graph_data.nodes must include at least one subject_root node");
  if (Array.isArray(g.edges)) {
    for (const [i, e] of (g.edges as unknown[]).entries()) {
      if (!e || typeof e !== "object") { errors.push(`edges[${i}] must be an object`); continue; }
      const edge = e as Record<string, unknown>;
      if (!nodeIds.has(edge.from as string)) errors.push(`edges[${i}].from "${edge.from}" is not a known node id`);
      if (!nodeIds.has(edge.to as string)) errors.push(`edges[${i}].to "${edge.to}" is not a known node id`);
    }
  }
  return { valid: errors.length === 0, errors };
}
