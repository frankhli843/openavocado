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
  "Do not ship a thin, audio-only, or high-level-only lesson. Every lesson must include:",
  '- Generated audio AVAILABLE AT CREATION: a substantive spoken script (never a stub or "audio coming soon"); produce the actual audio artifact at creation time and record it as a generated artifact.',
  "- First-class WRITTEN teaching text the learner can study without the audio (headings, a definition, a worked example, a summary) — not a transcript dump.",
  "- MULTIPLE meaningful visual/interactive explorations when the lesson covers multiple concepts. A multi-concept lesson (3+ goals/mastery targets) needs at least TWO distinct visual perspectives: several interactive widgets, or one declarative widget driving a charts[] array. One thin widget for many concepts is rejected.",
  "- PRACTICE/CODE the learner submits: scaffolded, with progressive hints and public + hidden tests, and never an exposed answer.",
  '- ADAPTIVE ASSESSMENT: an MC quiz where every question carries a required difficulty (easy|medium|hard) and the virtual "I don\'t know" option, plus freeform questions.',
  "- END-OF-LESSON next-lesson diagnostics: what felt unclear, what to cover next, confidence/effort, and a practical objective.",
  "- EXPLICIT preview / deeper-later wording: if a concept is intentionally introduced only at a high level, the audio script AND the written text must say so — name it a preview and state it will be explored in more detail in a later lesson. Never leave a glossed-over idea looking fully taught.",
  "The machine-checked gate is validateGeneratedContent (src/lib/lesson-generator/contract.ts); the full standard is docs/lesson-authoring-guide.md. A lesson that fails validateGeneratedContent must be fixed, not shipped.",
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
): { valid: boolean; errors: string[] } {
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

  return { valid: errors.length === 0, errors };
}
