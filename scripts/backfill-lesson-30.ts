/**
 * Backfill lesson 30 ("Agentic Evals That Matter: Multi-Turn,
 * Tool-Calling, and the Template Trap") in subject 5, replacing the deterministic local-queue
 * fixture shell (generated_by open-avocado-local-queue/v1) with a fully authored
 * lesson: an overview audio activity, three lesson_part activities, an
 * integrator practice_code activity, and a grounded assessment.
 *
 * The authored content lives in scripts/lesson-30-content/*.json so this backfill
 * is reproducible and reviewable. The lesson id (29) and its subject linkage are
 * preserved so learner progress references stay intact.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-lesson-30.ts --validate   # dry run, no writes
 *   pnpm tsx scripts/backfill-lesson-30.ts               # write (makes a backup)
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { validateGeneratedContent } from "../src/lib/lesson-generator/contract";
import type { GeneratedLessonContent } from "../src/types";

const LESSON_ID = 30;
const CONTENT_DIR = path.join(__dirname, "lesson-30-content");
const DB_PATH = process.env.AVO_DB_PATH ?? path.join(process.cwd(), "data", "avocadocore.db");

function load(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, `${name}.json`), "utf8"));
}

const fields = load("fields");
const overview = load("overview");
const part1 = load("part1");
const part2 = load("part2");
const part3 = load("part3");
const integrator = load("integrator");
const assessment = load("assessment");

// sequence_order, activity_type, is_core, title, content
const activities: Array<{ type: string; title: string; content: any }> = [
  { type: "audio", title: "Video: Agentic evals that matter", content: overview },
  { type: "lesson_part", title: "Part 1: Single-turn vs multi-turn, the eval that passes but ships a broken agent", content: part1 },
  { type: "lesson_part", title: "Part 2: The template trap, tool-call correctness vs chat-template formatting", content: part2 },
  { type: "lesson_part", title: "Part 3: Designing an agentic eval that means something", content: part3 },
  { type: "practice_code", title: "Integrator: the agentic eval verdict", content: integrator },
  { type: "assessment", title: "Assessment: agentic eval design", content: assessment },
];

function buildGenerated(): GeneratedLessonContent {
  return {
    title: fields.title,
    description: fields.description,
    planning_rationale: fields.planning_rationale,
    goals: fields.goals,
    tags: fields.tags,
    activities: activities.map((a, i) => ({
      activity_type: a.type as any,
      is_core: true,
      sequence_order: i + 1,
      title: a.title,
      content: a.content,
    })),
    mastery_targets: [],
    next_lesson_diagnostics: fields.next_lesson_diagnostics,
    knowledge_graph_data: fields.knowledge_graph_data,
    metadata: {
      generator: fields.generated_by,
      generator_version: fields.generator_version,
      generated_at: new Date().toISOString(),
      source_context_summary: "Agentic Evals That Matter, authored from subject 5 workpad seq 6 + Sara meeting + public research sources",
    },
  } as GeneratedLessonContent;
}

function validate(): boolean {
  const result = validateGeneratedContent(buildGenerated());
  if (result.errors.length > 0) {
    console.error(`Lesson ${LESSON_ID} content is INVALID (${result.errors.length} errors):`);
    for (const e of result.errors) console.error(` - ${e}`);
    return false;
  }
  console.log(`Lesson ${LESSON_ID} content passes validateGeneratedContent.`);
  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) console.log(` - ${w}`);
  }
  return true;
}

function write() {
  // Backup first.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = DB_PATH.replace(/\.db$/, `.before-lesson-30-backfill-${stamp}.db`);
  fs.copyFileSync(DB_PATH, backup);
  console.log(`Backed up DB to ${backup}`);

  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const lesson = db.prepare("SELECT id, subject_id FROM lessons WHERE id = ?").get(LESSON_ID) as any;
    if (!lesson) throw new Error(`Lesson ${LESSON_ID} not found`);
    if (lesson.subject_id !== 5) throw new Error(`Lesson ${LESSON_ID} is not in subject 5 (got ${lesson.subject_id})`);

    db.prepare(
      `UPDATE lessons SET title=?, description=?, goals=?, tags=?, generated_by=?, generator_version=?,
        source_context=?, next_lesson_diagnostics=?, knowledge_graph_data=?, planning_rationale=?, updated_at=?
       WHERE id=?`
    ).run(
      fields.title,
      fields.description,
      JSON.stringify(fields.goals),
      JSON.stringify(fields.tags),
      fields.generated_by,
      fields.generator_version,
      JSON.stringify(fields.source_context),
      JSON.stringify(fields.next_lesson_diagnostics),
      JSON.stringify(fields.knowledge_graph_data),
      fields.planning_rationale,
      now,
      LESSON_ID
    );

    // Remove the fixture shell activities and any fixture generated artifacts.
    db.prepare("DELETE FROM generated_artifacts WHERE lesson_id = ?").run(LESSON_ID);
    db.prepare("DELETE FROM lesson_activities WHERE lesson_id = ?").run(LESSON_ID);

    const insert = db.prepare(
      `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?)`
    );
    activities.forEach((a, i) => {
      insert.run(LESSON_ID, a.type, i + 1, a.title, JSON.stringify(a.content), now, now);
    });
  });

  tx();
  db.close();
  console.log(`Lesson ${LESSON_ID} backfilled: ${activities.length} activities written.`);
}

function main() {
  const dryRun = process.argv.includes("--validate");
  const ok = validate();
  if (!ok) process.exit(1);
  if (dryRun) {
    console.log("Dry run only (--validate). No database changes made.");
    return;
  }
  write();
}

main();
