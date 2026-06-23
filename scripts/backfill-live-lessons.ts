#!/usr/bin/env tsx
/**
 * Backfill an existing (already-seeded) AvocadoCore database up to the current
 * enriched lesson contract WITHOUT wiping learner data.
 *
 * The seed only runs against an empty database, so a live demo DB created before
 * the adaptive/enrichment work still shows the OLD lesson 4 (one widget, no
 * preview wording, no next-lesson diagnostics, and a placeholder audio row that
 * points at a 404). This script repairs that in place:
 *
 *   1. Build a throwaway REFERENCE database from the real seed (single source of
 *      truth — no content is re-typed here, so backfill can never drift from
 *      seed).
 *   2. For lesson 4 (the GDM "From Raw Image to Model-Ready Tensor" lesson),
 *      copy the canonical activity content from the reference DB into the live
 *      DB: update matching activities in place (preserving activity ids so
 *      autosave/answers keep working) and insert any missing interactive
 *      widgets. Also copy its next_lesson_diagnostics.
 *   3. Backfill next_lesson_diagnostics on every lesson that is missing it.
 *   4. Generate REAL playable audio for every lesson that has an audio activity
 *      and record it in generated_artifacts (replacing placeholder rows).
 *
 * Idempotent: re-running it is a no-op except for regenerating audio only when
 * the script changed.
 *
 * Usage:
 *   pnpm backfill:lessons                 # target AVOCADOCORE_DB_PATH or data/avocadocore.db
 *   AVOCADOCORE_DB_PATH=/path/x.db pnpm backfill:lessons
 *   pnpm backfill:lessons --no-audio      # skip audio generation
 */
import Database from "better-sqlite3";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import { generateAllLessonAudio } from "../src/lib/audio/generate-lesson-audio";

const LESSON4_TITLE = "From Raw Image to Model-Ready Tensor";

interface ActivityRow {
  id: number;
  lesson_id: number;
  activity_type: string;
  is_core: number;
  sequence_order: number;
  title: string | null;
  content: string | null;
}

function liveDbPath(): string {
  return (
    process.env.AVOCADOCORE_DB_PATH ||
    path.join(process.cwd(), "data", "avocadocore.db")
  );
}

/** Seed a fresh reference DB in a child process and return its path. */
function buildReferenceDb(): string {
  const ref = path.join(os.tmpdir(), `avo-ref-seed-${process.pid}.db`);
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(ref + suffix);
    } catch {
      /* ignore */
    }
  }
  console.log(`[backfill] seeding reference DB at ${ref} ...`);
  execFileSync("pnpm", ["db:migrate", "--seed"], {
    env: { ...process.env, AVOCADOCORE_DB_PATH: ref },
    stdio: "inherit",
  });
  return ref;
}

function findLesson4(db: Database.Database): { id: number } | undefined {
  // Prefer id 4 when its title matches (Frank's reviewed URL is /lessons/4),
  // else fall back to the canonical title.
  const byId = db
    .prepare("SELECT id, title FROM lessons WHERE id = 4")
    .get() as { id: number; title: string } | undefined;
  if (byId && byId.title === LESSON4_TITLE) return { id: byId.id };
  return db
    .prepare("SELECT id FROM lessons WHERE title = ? ORDER BY id ASC LIMIT 1")
    .get(LESSON4_TITLE) as { id: number } | undefined;
}

/** Copy lesson-4 canonical activities from reference → live (in place). */
function backfillLesson4Activities(
  ref: Database.Database,
  live: Database.Database
): { updated: number; inserted: number; liveLessonId: number } {
  const refLesson = findLesson4(ref);
  const liveLesson = findLesson4(live);
  if (!refLesson) throw new Error("reference DB has no lesson 4");
  if (!liveLesson) throw new Error("live DB has no lesson 4");

  const refActivities = ref
    .prepare(
      `SELECT id, lesson_id, activity_type, is_core, sequence_order, title, content
       FROM lesson_activities WHERE lesson_id = ? ORDER BY sequence_order, id`
    )
    .all(refLesson.id) as ActivityRow[];

  let updated = 0;
  let inserted = 0;

  const upsert = live.transaction(() => {
    for (const a of refActivities) {
      // Match an existing live activity by (type, title) so we update content in
      // place and never orphan autosave/answers tied to its id.
      const existing = live
        .prepare(
          `SELECT id FROM lesson_activities
           WHERE lesson_id = ? AND activity_type = ?
             AND IFNULL(title,'') = IFNULL(?, '')`
        )
        .get(liveLesson.id, a.activity_type, a.title) as
        | { id: number }
        | undefined;

      if (existing) {
        live
          .prepare(
            `UPDATE lesson_activities
             SET content = ?, is_core = ?, sequence_order = ?,
                 updated_at = datetime('now')
             WHERE id = ?`
          )
          .run(a.content, a.is_core, a.sequence_order, existing.id);
        updated++;
      } else {
        live
          .prepare(
            `INSERT INTO lesson_activities
               (lesson_id, activity_type, is_core, sequence_order, title, content)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            liveLesson.id,
            a.activity_type,
            a.is_core,
            a.sequence_order,
            a.title,
            a.content
          );
        inserted++;
      }
    }

    // Copy lesson-4 diagnostics + knowledge graph orientation from reference.
    const refRow = ref
      .prepare(
        "SELECT next_lesson_diagnostics, knowledge_graph_data FROM lessons WHERE id = ?"
      )
      .get(refLesson.id) as {
      next_lesson_diagnostics: string | null;
      knowledge_graph_data: string | null;
    };
    live
      .prepare(
        `UPDATE lessons
         SET next_lesson_diagnostics = ?,
             knowledge_graph_data = COALESCE(knowledge_graph_data, ?),
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(refRow.next_lesson_diagnostics, refRow.knowledge_graph_data, liveLesson.id);
  });
  upsert();

  return { updated, inserted, liveLessonId: liveLesson.id };
}

/**
 * Backfill knowledge_graph_data for all seeded lessons by matching on title.
 * Safe to run on existing DBs: COALESCE preserves any existing authored graph.
 */
function backfillKnowledgeGraphData(ref: Database.Database, live: Database.Database): number {
  const refLessons = ref
    .prepare("SELECT title, knowledge_graph_data FROM lessons WHERE knowledge_graph_data IS NOT NULL")
    .all() as Array<{ title: string; knowledge_graph_data: string }>;

  let changed = 0;
  for (const row of refLessons) {
    const res = live
      .prepare(
        "UPDATE lessons SET knowledge_graph_data = ? WHERE title = ? AND knowledge_graph_data IS NULL"
      )
      .run(row.knowledge_graph_data, row.title);
    changed += res.changes;
  }
  return changed;
}

/** Backfill default next-lesson diagnostics on every lesson missing them. */
function backfillDiagnostics(ref: Database.Database, live: Database.Database): number {
  // Pull the canonical default from a reference lesson that has it set.
  const def = ref
    .prepare(
      "SELECT next_lesson_diagnostics FROM lessons WHERE next_lesson_diagnostics IS NOT NULL LIMIT 1"
    )
    .get() as { next_lesson_diagnostics: string } | undefined;
  if (!def) return 0;
  const res = live
    .prepare(
      "UPDATE lessons SET next_lesson_diagnostics = ? WHERE next_lesson_diagnostics IS NULL"
    )
    .run(def.next_lesson_diagnostics);
  return res.changes;
}

async function main() {
  const noAudio = process.argv.includes("--no-audio");
  const livePath = liveDbPath();
  if (!fs.existsSync(livePath)) {
    throw new Error(
      `live DB not found at ${livePath} — nothing to backfill (a fresh DB is seeded automatically)`
    );
  }
  console.log(`[backfill] live DB: ${livePath}`);

  const refPath = buildReferenceDb();
  const ref = new Database(refPath, { readonly: true });
  const live = new Database(livePath);
  live.pragma("busy_timeout = 5000");
  live.pragma("foreign_keys = ON");

  try {
    const l4 = backfillLesson4Activities(ref, live);
    console.log(
      `[backfill] lesson 4 (id ${l4.liveLessonId}): updated ${l4.updated}, inserted ${l4.inserted} activities`
    );
    const diag = backfillDiagnostics(ref, live);
    console.log(`[backfill] next_lesson_diagnostics backfilled on ${diag} lesson(s)`);
    const graphs = backfillKnowledgeGraphData(ref, live);
    console.log(`[backfill] knowledge_graph_data backfilled on ${graphs} lesson(s)`);

    if (!noAudio) {
      console.log("[backfill] generating real audio artifacts ...");
      const results = await generateAllLessonAudio(live);
      for (const r of results) {
        console.log(
          `[backfill] audio lesson ${r.lessonId}: ${r.status}` +
            (r.provider ? ` (${r.provider}, ${r.durationSec}s)` : "")
        );
      }
    }
  } finally {
    live.close();
    ref.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(refPath + suffix);
      } catch {
        /* ignore */
      }
    }
  }
  console.log("[backfill] done.");
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
