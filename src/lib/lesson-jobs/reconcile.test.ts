import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";

import { reconcileMaterializedLessonJobs } from "./reconcile";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8"));
  db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN harness_status TEXT");
  db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN harness_stage TEXT");
  db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN progress_events TEXT");
  db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN output_lesson_id INTEGER");
  return db;
}

function seedSubject(db: Database.Database) {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('reconcile-test', 'Reconcile Test')")
    .run().lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Reconcile Learner')")
    .run(userId).lastInsertRowid as number;
  const subjectId = db
    .prepare("INSERT INTO subjects (learner_id, title, current_level) VALUES (?, 'Reconcile Subject', 'familiarity')")
    .run(learnerId).lastInsertRowid as number;
  return { learnerId, subjectId };
}

describe("reconcileMaterializedLessonJobs", () => {
  it("marks stale active jobs completed when their lesson already exists", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    const completedLessonId = db
      .prepare(
        "INSERT INTO lessons (subject_id, title, status, sequence_number, created_at) VALUES (?, 'Done', 'queued', 1, datetime('now', '-5 minutes'))"
      )
      .run(subjectId).lastInsertRowid as number;
    const staleJobId = db
      .prepare(
        `INSERT INTO next_lesson_jobs
         (subject_id, adapter, status, created_at, progress_events)
         VALUES (?, 'agent-harness', 'dispatched', datetime('now', '-10 minutes'), ?)`
      )
      .run(subjectId, JSON.stringify([{ stage: "lesson.queued", message: "Queued" }])).lastInsertRowid as number;
    const noopJobId = db
      .prepare(
        `INSERT INTO next_lesson_jobs
         (subject_id, adapter, status, created_at)
         VALUES (?, 'noop', 'pending', datetime('now', '-10 minutes'))`
      )
      .run(subjectId).lastInsertRowid as number;

    expect(reconcileMaterializedLessonJobs(db, { learnerId })).toBe(1);

    const repaired = db
      .prepare("SELECT status, output_lesson_id, harness_status, harness_stage, progress_events FROM next_lesson_jobs WHERE id = ?")
      .get(staleJobId) as {
      status: string;
      output_lesson_id: number;
      harness_status: string;
      harness_stage: string;
      progress_events: string;
    };
    expect(repaired.status).toBe("completed");
    expect(repaired.output_lesson_id).toBe(completedLessonId);
    expect(repaired.harness_status).toBe("done");
    expect(repaired.harness_stage).toBe("lesson.generated");
    expect(repaired.progress_events).toContain(`Reconciled completed lesson ${completedLessonId}`);

    const noop = db
      .prepare("SELECT status, output_lesson_id FROM next_lesson_jobs WHERE id = ?")
      .get(noopJobId) as { status: string; output_lesson_id: number | null };
    expect(noop.status).toBe("pending");
    expect(noop.output_lesson_id).toBeNull();
  });
});
