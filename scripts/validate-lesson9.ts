#!/usr/bin/env tsx
/**
 * Validate lesson 9 against the lesson generator contract.
 */
import { validateGeneratedContent } from "../src/lib/lesson-generator/contract";
import { getDb, closeDb } from "../src/db/connection";
import type { ActivityType, GeneratedLessonContent } from "../src/types";

async function main() {
  const db = await getDb();

  // Get lesson
  const lesson = db.prepare("SELECT * FROM lessons WHERE id=9").get() as Record<string, unknown>;
  if (!lesson) {
    console.error("Lesson 9 not found");
    process.exit(1);
  }
  console.log(`Lesson: ${lesson.title}`);

  // Get activities
  const activities = db.prepare(
    "SELECT * FROM lesson_activities WHERE lesson_id=9 ORDER BY sequence_order"
  ).all() as Record<string, unknown>[];

  console.log(`Activities count: ${activities.length}`);
  for (const a of activities) {
    console.log(`  [${a.sequence_order}] ${a.activity_type}: ${a.title}`);
  }

  // Build GeneratedLessonContent shape for validation
  const goals = JSON.parse(lesson.goals as string || "[]");
  const tags = JSON.parse(lesson.tags as string || "[]");
  const knowledgeGraphData = lesson.knowledge_graph_data
    ? JSON.parse(lesson.knowledge_graph_data as string)
    : undefined;
  const nextLessonDiagnostics = lesson.next_lesson_diagnostics
    ? JSON.parse(lesson.next_lesson_diagnostics as string)
    : undefined;

  const content: GeneratedLessonContent = {
    title: lesson.title as string,
    description: lesson.description as string || "",
    planning_rationale:
      (lesson.planning_rationale as string | null) ||
      "This validation wrapper is checking an existing lesson; no authored rationale was stored.",
    goals,
    tags,
    activities: activities.map((a) => ({
      activity_type: a.activity_type as ActivityType,
      is_core: Boolean(a.is_core),
      sequence_order: a.sequence_order as number,
      title: a.title as string,
      content: JSON.parse(a.content as string || "{}"),
    })),
    mastery_targets: [] as { concept: string; target_confidence: number }[],
    next_lesson_diagnostics: nextLessonDiagnostics,
    knowledge_graph_data: knowledgeGraphData,
    metadata: {
      generator: "doramon-lesson-generator/v2",
      generator_version: "2.0.0",
      generated_at: new Date().toISOString(),
      source_context_summary: "",
    },
  };

  console.log("\n=== Running validateGeneratedContent ===");
  const result = validateGeneratedContent(content);
  if (result.valid) {
    console.log("✅ VALID — lesson passes contract validation");
  } else {
    console.log("❌ INVALID — errors:");
    for (const e of result.errors) {
      console.log(`  ERROR: ${e}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of result.warnings) {
      console.log(`  WARNING: ${w}`);
    }
  }

  await closeDb();
  process.exit(result.valid ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
