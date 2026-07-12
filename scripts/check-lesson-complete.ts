import path from "node:path";
import Database from "better-sqlite3";
import { validateGeneratedContent } from "../src/lib/lesson-generator/contract";
import type { ActivityType, GeneratedLessonContent } from "../src/types";

interface LessonRow {
  id: number;
  title: string;
  description: string | null;
  goals: string | null;
  tags: string | null;
  next_lesson_diagnostics?: string | null;
  knowledge_graph_data?: string | null;
  generated_by: string | null;
  generator_version: string | null;
  source_context: string | null;
  planning_rationale?: string | null;
  created_at: string;
}

interface ActivityRow {
  id: number;
  activity_type: ActivityType;
  is_core: number;
  sequence_order: number;
  title: string | null;
  content: string | null;
}

function parseJson<T>(value: string | null | undefined, fallback: T, label: string, errors: string[]): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

function main() {
  const lessonId = Number(process.argv[2]);
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    console.error("Usage: pnpm check:lesson <lesson_id> [db_path]");
    process.exit(2);
  }

  const dbPath = process.argv[3] ?? process.env.AVO_DB_PATH ?? path.join(process.cwd(), "data", "avocadocore.db");
  const errors: string[] = [];
  const db = new Database(dbPath, { readonly: true });

  const lesson = db.prepare("select * from lessons where id = ?").get(lessonId) as LessonRow | undefined;
  if (!lesson) {
    console.error(`Lesson ${lessonId} not found in ${dbPath}`);
    process.exit(2);
  }

  const activities = db
    .prepare("select * from lesson_activities where lesson_id = ? order by sequence_order, id")
    .all(lessonId) as ActivityRow[];

  if (activities.length === 0) {
    errors.push(`lesson ${lessonId} has no activities`);
  }

  const generated: GeneratedLessonContent = {
    title: lesson.title,
    description: lesson.description ?? "",
    planning_rationale: lesson.planning_rationale ?? undefined,
    goals: parseJson<string[]>(lesson.goals, [], "lesson.goals", errors),
    tags: parseJson<string[]>(lesson.tags, [], "lesson.tags", errors),
    activities: activities.map((activity) => ({
      activity_type: activity.activity_type,
      is_core: activity.is_core === 1,
      sequence_order: activity.sequence_order,
      title: activity.title ?? `Activity ${activity.id}`,
      content: parseJson<Record<string, unknown>>(
        activity.content,
        {},
        `activity ${activity.id} (${activity.title ?? activity.activity_type}).content`,
        errors
      ),
    })),
    mastery_targets: [],
    next_lesson_diagnostics: parseJson(lesson.next_lesson_diagnostics, undefined, "lesson.next_lesson_diagnostics", errors),
    knowledge_graph_data: parseJson(lesson.knowledge_graph_data, undefined, "lesson.knowledge_graph_data", errors),
    metadata: {
      generator: lesson.generated_by ?? "unknown",
      generator_version: lesson.generator_version ?? "unknown",
      generated_at: lesson.created_at,
      source_context_summary: lesson.source_context ?? "",
    },
  };

  const result = validateGeneratedContent(generated);
  errors.push(...result.errors);

  if (errors.length > 0) {
    console.error(`Lesson ${lessonId} is incomplete (${errors.length} error${errors.length === 1 ? "" : "s"}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Lesson ${lessonId} passes the full lesson completeness checker.`);
  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) console.log(`- ${warning}`);
  }
}

main();
