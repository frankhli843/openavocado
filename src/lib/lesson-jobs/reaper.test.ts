import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";

import { reapStalledLessonJobs } from "./reaper";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8"));
  return db;
}

function seedSubject(db: Database.Database) {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('reaper-test', 'Reaper Test')")
    .run().lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Reaper Learner')")
    .run(userId).lastInsertRowid as number;
  const subjectId = db
    .prepare("INSERT INTO subjects (learner_id, title, current_level) VALUES (?, 'Reaper Subject', 'familiarity')")
    .run(learnerId).lastInsertRowid as number;
  return { learnerId, subjectId };
}

/** Insert a job whose last activity (updated_at) is `idleMinutes` ago. */
function insertJob(
  db: Database.Database,
  subjectId: number,
  opts: { adapter?: string; status?: string; idleMinutes: number; harnessStage?: string; outputLessonId?: number | null }
): number {
  const adapter = opts.adapter ?? "agent-harness";
  const status = opts.status ?? "dispatched";
  const ts = `datetime('now', '-${opts.idleMinutes} minutes')`;
  return db
    .prepare(
      `INSERT INTO next_lesson_jobs
        (subject_id, adapter, status, harness_stage, output_lesson_id,
         progress_events, created_at, dispatched_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ${ts}, ${ts}, ${ts})`
    )
    .run(
      subjectId,
      adapter,
      status,
      opts.harnessStage ?? "authoring",
      opts.outputLessonId ?? null,
      JSON.stringify([{ ts: new Date(Date.now() - opts.idleMinutes * 60_000).toISOString(), stage: "authoring", message: "Calling Gemini" }])
    ).lastInsertRowid as number;
}

afterEach(() => {
  delete process.env.AVOCADOCORE_JOB_STALL_MINUTES;
});

describe("reapStalledLessonJobs", () => {
  it("marks a silent, output-less async job failed with a visible reason", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    // agent-harness default window is 45m; 90m idle is well past it.
    const jobId = insertJob(db, subjectId, { adapter: "agent-harness", idleMinutes: 90, harnessStage: "generating_audio" });

    expect(reapStalledLessonJobs(db, { learnerId })).toBe(1);

    const row = db
      .prepare("SELECT status, error, last_error_detail, harness_status, harness_stage, completed_at, progress_events FROM next_lesson_jobs WHERE id = ?")
      .get(jobId) as {
      status: string;
      error: string;
      last_error_detail: string;
      harness_status: string;
      harness_stage: string;
      completed_at: string | null;
      progress_events: string;
    };
    expect(row.status).toBe("failed");
    expect(row.harness_status).toBe("failed");
    expect(row.harness_stage).toBe("failed");
    expect(row.completed_at).not.toBeNull();
    expect(row.last_error_detail).toContain("stalled");
    expect(row.last_error_detail).toContain("generating_audio");
    expect(row.error).toContain("stalled");
    expect(row.progress_events).toContain("stalled");
  });

  it("leaves a still-active job (recent activity) alone", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    // 10m idle < 45m agent-harness window → healthy, keep waiting.
    const jobId = insertJob(db, subjectId, { adapter: "agent-harness", idleMinutes: 10 });

    expect(reapStalledLessonJobs(db, { learnerId })).toBe(0);
    const row = db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(jobId) as { status: string };
    expect(row.status).toBe("dispatched");
  });

  it("respects the longer dora-task window (a 50m-idle dora job is not yet stalled)", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    const doraId = insertJob(db, subjectId, { adapter: "dora-task", idleMinutes: 50 }); // < 60m dora window
    const harnessId = insertJob(db, subjectId, { adapter: "agent-harness", idleMinutes: 50 }); // > 45m harness window

    expect(reapStalledLessonJobs(db, { learnerId })).toBe(1);
    expect((db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(doraId) as { status: string }).status).toBe("dispatched");
    expect((db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(harnessId) as { status: string }).status).toBe("failed");
  });

  it("never touches noop jobs or jobs that already have an output lesson", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    const noopId = insertJob(db, subjectId, { adapter: "noop", idleMinutes: 999 });
    const lessonId = db
      .prepare("INSERT INTO lessons (subject_id, title, status, sequence_number) VALUES (?, 'Made', 'queued', 1)")
      .run(subjectId).lastInsertRowid as number;
    const withOutputId = insertJob(db, subjectId, { adapter: "agent-harness", idleMinutes: 999, outputLessonId: lessonId });

    expect(reapStalledLessonJobs(db, { learnerId })).toBe(0);
    expect((db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(noopId) as { status: string }).status).toBe("dispatched");
    expect((db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(withOutputId) as { status: string }).status).toBe("dispatched");
  });

  it("does not fail a stalled job whose lesson actually materialized (reconcile's job)", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    // Job created 90m ago, and a lesson was created after it — output_lesson_id
    // was just never linked. The reaper must defer to reconcile, not fail it.
    const jobId = insertJob(db, subjectId, { adapter: "agent-harness", idleMinutes: 90 });
    db.prepare(
      "INSERT INTO lessons (subject_id, title, status, sequence_number, created_at) VALUES (?, 'Materialized', 'queued', 1, datetime('now', '-80 minutes'))"
    ).run(subjectId);

    expect(reapStalledLessonJobs(db, { learnerId })).toBe(0);
    expect((db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(jobId) as { status: string }).status).toBe("dispatched");
  });

  it("honors the AVOCADOCORE_JOB_STALL_MINUTES override", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    const jobId = insertJob(db, subjectId, { adapter: "agent-harness", idleMinutes: 20 }); // < 45m default
    process.env.AVOCADOCORE_JOB_STALL_MINUTES = "15"; // 20m now exceeds override

    expect(reapStalledLessonJobs(db, { learnerId })).toBe(1);
    expect((db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(jobId) as { status: string }).status).toBe("failed");
  });

  it("scopes by subjectId when provided", () => {
    const db = makeDb();
    const { subjectId } = seedSubject(db);
    const otherSubjectId = db
      .prepare("INSERT INTO subjects (learner_id, title, current_level) VALUES ((SELECT learner_id FROM subjects WHERE id = ?), 'Other', 'familiarity')")
      .run(subjectId).lastInsertRowid as number;
    const inScope = insertJob(db, subjectId, { adapter: "agent-harness", idleMinutes: 90 });
    const outOfScope = insertJob(db, otherSubjectId, { adapter: "agent-harness", idleMinutes: 90 });

    expect(reapStalledLessonJobs(db, { subjectId })).toBe(1);
    expect((db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(inScope) as { status: string }).status).toBe("failed");
    expect((db.prepare("SELECT status FROM next_lesson_jobs WHERE id = ?").get(outOfScope) as { status: string }).status).toBe("dispatched");
  });
});
