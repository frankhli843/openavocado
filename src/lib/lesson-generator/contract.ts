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

  const coreRequired: ActivityType[] = ["audio", "interactive", "practice_code", "assessment"];
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

  // Interactive activities must carry a valid, safe widget spec.
  const knownWidgetTypes = REGISTERED_WIDGETS.map((w) => w.type);
  for (const [i, activity] of content.activities.entries()) {
    if (activity.activity_type !== "interactive") continue;
    const result = validateWidgetSpec(activity.content, knownWidgetTypes);
    if (!result.valid) {
      for (const e of result.errors) {
        errors.push(`interactive activity[${i}] (${activity.title ?? "untitled"}): ${e}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
