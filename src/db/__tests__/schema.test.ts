/**
 * Integration tests for the Open Avocado database schema and business logic.
 *
 * Uses better-sqlite3 with an in-memory database so tests run fast, stay
 * isolated, and never touch the real data/avocadocore.db file.
 *
 * Tests cover:
 *  - Schema correctness (columns, CHECK constraints, UNIQUE constraints)
 *  - Workpad upsert with monotonic version increment
 *  - Discard guard logic (mirrors the /api/lessons/:id/discard route)
 *  - Multi-user scoping via learner_id
 *  - Subject criteria field (learner notes for lesson generator)
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.join(
    process.cwd(),
    "src",
    "db",
    "schema.sql"
  );
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  return db;
}

/** Returns true when the given table has the named column. */
function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

/** Seed a user + learner profile, return learner_id. */
function seedLearner(db: Database.Database): number {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('test', 'Test User')")
    .run().lastInsertRowid as number;
  return db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Test Learner')")
    .run(userId).lastInsertRowid as number;
}

/** Seed a subject for the given learner, return subject_id. */
function seedSubject(
  db: Database.Database,
  learnerId: number,
  overrides: { criteria?: string; goals?: string } = {}
): number {
  return db
    .prepare(
      "INSERT INTO subjects (learner_id, title, criteria, goals) VALUES (?, 'Math 101', ?, ?)"
    )
    .run(learnerId, overrides.criteria ?? null, overrides.goals ?? null)
    .lastInsertRowid as number;
}

/** Seed a lesson for the given subject, return lesson_id. */
function seedLesson(
  db: Database.Database,
  subjectId: number,
  status = "queued"
): number {
  return db
    .prepare("INSERT INTO lessons (subject_id, title, status) VALUES (?, 'Lesson 1', ?)")
    .run(subjectId, status)
    .lastInsertRowid as number;
}

/**
 * Mirrors the discard guard from POST /api/lessons/:id/discard.
 * Returns { status, error } or { status: 200, discarded_at } on success.
 */
function simulateDiscard(
  db: Database.Database,
  lessonId: number,
  learnerId: number,
  reason: string | null = null
): { status: number; error?: string; discarded_at?: string } {
  const lesson = db.prepare("SELECT * FROM lessons WHERE id = ?").get(lessonId) as
    | { status: string; subject_id: number }
    | undefined;
  if (!lesson) return { status: 404, error: "Lesson not found" };

  if (lesson.status === "completed")
    return { status: 409, error: "Completed lessons cannot be discarded" };
  if (lesson.status === "discarded")
    return { status: 409, error: "Already discarded" };
  if (lesson.status === "skipped")
    return { status: 409, error: "Skipped lessons cannot be discarded through this flow" };

  const subject = db.prepare("SELECT * FROM subjects WHERE id = ?").get(lesson.subject_id) as
    | { learner_id: number }
    | undefined;
  if (!subject) return { status: 404, error: "Subject not found" };
  if (subject.learner_id !== learnerId) return { status: 403, error: "Forbidden" };

  const discardedAt = new Date().toISOString();
  db.prepare(
    "UPDATE lessons SET status = 'discarded', discarded_at = ?, discard_reason = ? WHERE id = ?"
  ).run(discardedAt, reason, lessonId);

  return { status: 200, discarded_at: discardedAt };
}

// ─── Schema correctness ──────────────────────────────────────────────────────

describe("Schema columns and constraints", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it("subjects table has criteria column", () => {
    expect(hasColumn(db, "subjects", "criteria")).toBe(true);
  });

  it("subjects table has goals column", () => {
    expect(hasColumn(db, "subjects", "goals")).toBe(true);
  });

  it("subjects table has archived_at column", () => {
    expect(hasColumn(db, "subjects", "archived_at")).toBe(true);
  });

  it("lessons table has discarded_at column", () => {
    expect(hasColumn(db, "lessons", "discarded_at")).toBe(true);
  });

  it("lessons table has discard_reason column", () => {
    expect(hasColumn(db, "lessons", "discard_reason")).toBe(true);
  });

  it("lessons table allows discarded status", () => {
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    const lessonId = seedLesson(db, subjectId, "queued");
    // Should not throw
    expect(() => {
      db.prepare("UPDATE lessons SET status = 'discarded' WHERE id = ?").run(lessonId);
    }).not.toThrow();
    const row = db.prepare("SELECT status FROM lessons WHERE id = ?").get(lessonId) as { status: string };
    expect(row.status).toBe("discarded");
  });

  it("lessons table rejects unknown status values", () => {
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    const lessonId = seedLesson(db, subjectId, "queued");
    expect(() => {
      db.prepare("UPDATE lessons SET status = 'invalid_status' WHERE id = ?").run(lessonId);
    }).toThrow();
  });

  it("next_lesson_jobs table has trigger_event column", () => {
    expect(hasColumn(db, "next_lesson_jobs", "trigger_event")).toBe(true);
  });

  it("next_lesson_jobs table has discarded_lesson_id column", () => {
    expect(hasColumn(db, "next_lesson_jobs", "discarded_lesson_id")).toBe(true);
  });

  it("next_lesson_jobs table has separate QA evidence columns", () => {
    for (const column of [
      "qa_status",
      "qa_stage",
      "qa_events",
      "qa_agent_ref",
      "qa_lesson_url",
      "qa_desktop_screenshot_ref",
      "qa_mobile_screenshot_ref",
      "qa_notes",
      "qa_completed_at",
    ]) {
      expect(hasColumn(db, "next_lesson_jobs", column), column).toBe(true);
    }
  });

  it("next_lesson_jobs trigger_event CHECK rejects unknown values", () => {
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    expect(() => {
      db.prepare(
        "INSERT INTO next_lesson_jobs (subject_id, trigger_event) VALUES (?, 'lesson.unknown')"
      ).run(subjectId);
    }).toThrow();
  });

  it("next_lesson_jobs accepts lesson.discarded trigger_event", () => {
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    const lessonId = seedLesson(db, subjectId, "queued");
    expect(() => {
      db.prepare(
        `INSERT INTO next_lesson_jobs
           (subject_id, discarded_lesson_id, trigger_event, adapter, status)
         VALUES (?, ?, 'lesson.discarded', 'noop', 'dispatched')`
      ).run(subjectId, lessonId);
    }).not.toThrow();
  });

  it("next_lesson_jobs accepts subject.created trigger_event", () => {
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    expect(() => {
      db.prepare(
        `INSERT INTO next_lesson_jobs
           (subject_id, trigger_event, adapter, status)
         VALUES (?, 'subject.created', 'dora-task', 'dispatched')`
      ).run(subjectId);
    }).not.toThrow();
  });

  it("subject_workpads table exists with UNIQUE(subject_id, learner_id)", () => {
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);

    // Insert once
    db.prepare(
      "INSERT INTO subject_workpads (subject_id, learner_id, content) VALUES (?, ?, 'v1')"
    ).run(subjectId, learnerId);

    // Second insert with same (subject_id, learner_id) must fail
    expect(() => {
      db.prepare(
        "INSERT INTO subject_workpads (subject_id, learner_id, content) VALUES (?, ?, 'v2')"
      ).run(subjectId, learnerId);
    }).toThrow();
  });
});

// ─── Subject criteria field ──────────────────────────────────────────────────

describe("Subject criteria field", () => {
  let db: Database.Database;
  let learnerId: number;

  beforeEach(() => {
    db = makeDb();
    learnerId = seedLearner(db);
  });

  it("accepts a null criteria value", () => {
    const subjectId = seedSubject(db, learnerId, { criteria: undefined });
    const row = db.prepare("SELECT criteria FROM subjects WHERE id = ?").get(subjectId) as { criteria: string | null };
    expect(row.criteria).toBeNull();
  });

  it("stores and retrieves criteria text", () => {
    const criteriaText = "Build intuition before notation. Focus on Python exercises.";
    const subjectId = seedSubject(db, learnerId, { criteria: criteriaText });
    const row = db.prepare("SELECT criteria FROM subjects WHERE id = ?").get(subjectId) as { criteria: string };
    expect(row.criteria).toBe(criteriaText);
  });

  it("can be updated via PATCH-equivalent SQL", () => {
    const subjectId = seedSubject(db, learnerId, { criteria: "old criteria" });
    db.prepare("UPDATE subjects SET criteria = ? WHERE id = ?").run("new criteria", subjectId);
    const row = db.prepare("SELECT criteria FROM subjects WHERE id = ?").get(subjectId) as { criteria: string };
    expect(row.criteria).toBe("new criteria");
  });

  it("does not affect other fields when updating criteria", () => {
    const subjectId = seedSubject(db, learnerId, { criteria: "initial", goals: "learn algebra" });
    db.prepare("UPDATE subjects SET criteria = ? WHERE id = ?").run("updated criteria", subjectId);
    const row = db.prepare("SELECT goals, criteria FROM subjects WHERE id = ?").get(subjectId) as {
      goals: string;
      criteria: string;
    };
    expect(row.goals).toBe("learn algebra");
    expect(row.criteria).toBe("updated criteria");
  });
});

// ─── Workpad upsert with version increment ───────────────────────────────────

describe("Subject workpad upsert", () => {
  let db: Database.Database;
  let learnerId: number;
  let subjectId: number;

  beforeEach(() => {
    db = makeDb();
    learnerId = seedLearner(db);
    subjectId = seedSubject(db, learnerId);
  });

  it("creates a workpad with version 1 on first insert", () => {
    db.prepare(
      "INSERT INTO subject_workpads (subject_id, learner_id, content) VALUES (?, ?, 'Initial content')"
    ).run(subjectId, learnerId);

    const row = db
      .prepare("SELECT version, content FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
      .get(subjectId, learnerId) as { version: number; content: string };

    expect(row.version).toBe(1);
    expect(row.content).toBe("Initial content");
  });

  it("increments version on upsert", () => {
    // First insert
    db.prepare(
      `INSERT INTO subject_workpads (subject_id, learner_id, content)
       VALUES (?, ?, 'v1')`
    ).run(subjectId, learnerId);

    // Upsert via ON CONFLICT
    db.prepare(
      `INSERT INTO subject_workpads (subject_id, learner_id, content, version)
       VALUES (?, ?, 'v2', 1)
       ON CONFLICT(subject_id, learner_id)
       DO UPDATE SET content = excluded.content, version = version + 1, updated_at = datetime('now')`
    ).run(subjectId, learnerId);

    const row = db
      .prepare("SELECT version, content FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
      .get(subjectId, learnerId) as { version: number; content: string };

    expect(row.version).toBe(2);
    expect(row.content).toBe("v2");
  });

  it("version monotonically increments across multiple updates", () => {
    for (let i = 1; i <= 5; i++) {
      db.prepare(
        `INSERT INTO subject_workpads (subject_id, learner_id, content)
         VALUES (?, ?, ?)
         ON CONFLICT(subject_id, learner_id)
         DO UPDATE SET content = excluded.content, version = version + 1, updated_at = datetime('now')`
      ).run(subjectId, learnerId, `content v${i}`);
    }

    const row = db
      .prepare("SELECT version FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
      .get(subjectId, learnerId) as { version: number };

    expect(row.version).toBe(5);
  });

  it("workpads are isolated between learners for the same subject", () => {
    const userId2 = db
      .prepare("INSERT INTO users (username, display_name) VALUES ('test2', 'Learner 2')")
      .run().lastInsertRowid as number;
    const learnerId2 = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Learner 2')")
      .run(userId2).lastInsertRowid as number;

    // Each learner gets their own workpad for the same subject
    db.prepare(
      "INSERT INTO subject_workpads (subject_id, learner_id, content) VALUES (?, ?, 'L1 content')"
    ).run(subjectId, learnerId);
    db.prepare(
      "INSERT INTO subject_workpads (subject_id, learner_id, content) VALUES (?, ?, 'L2 content')"
    ).run(subjectId, learnerId2);

    const r1 = db
      .prepare("SELECT content FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
      .get(subjectId, learnerId) as { content: string };
    const r2 = db
      .prepare("SELECT content FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
      .get(subjectId, learnerId2) as { content: string };

    expect(r1.content).toBe("L1 content");
    expect(r2.content).toBe("L2 content");
  });
});

// ─── Discard guard logic ─────────────────────────────────────────────────────

describe("Lesson discard guard (mirrors POST /api/lessons/:id/discard)", () => {
  let db: Database.Database;
  let learnerId: number;
  let subjectId: number;

  beforeEach(() => {
    db = makeDb();
    learnerId = seedLearner(db);
    subjectId = seedSubject(db, learnerId);
  });

  it("allows discarding a queued lesson", () => {
    const lessonId = seedLesson(db, subjectId, "queued");
    const result = simulateDiscard(db, lessonId, learnerId, "not relevant");
    expect(result.status).toBe(200);
  });

  it("allows discarding an in_progress lesson", () => {
    const lessonId = seedLesson(db, subjectId, "in_progress");
    const result = simulateDiscard(db, lessonId, learnerId);
    expect(result.status).toBe(200);
  });

  it("refuses to discard a completed lesson (409)", () => {
    const lessonId = seedLesson(db, subjectId, "completed");
    const result = simulateDiscard(db, lessonId, learnerId);
    expect(result.status).toBe(409);
    expect(result.error).toContain("Completed lessons");
  });

  it("refuses to discard an already-discarded lesson (409)", () => {
    const lessonId = seedLesson(db, subjectId, "queued");
    simulateDiscard(db, lessonId, learnerId); // first discard
    const result = simulateDiscard(db, lessonId, learnerId); // second attempt
    expect(result.status).toBe(409);
    expect(result.error).toContain("Already discarded");
  });

  it("refuses to discard a skipped lesson (409)", () => {
    const lessonId = seedLesson(db, subjectId, "skipped");
    const result = simulateDiscard(db, lessonId, learnerId);
    expect(result.status).toBe(409);
    expect(result.error).toContain("Skipped lessons");
  });

  it("returns 404 for a non-existent lesson", () => {
    const result = simulateDiscard(db, 99999, learnerId);
    expect(result.status).toBe(404);
  });

  it("returns 403 when the lesson belongs to a different learner", () => {
    const userId2 = db
      .prepare("INSERT INTO users (username, display_name) VALUES ('other', 'Other')")
      .run().lastInsertRowid as number;
    const learnerId2 = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Other Learner')")
      .run(userId2).lastInsertRowid as number;

    const lessonId = seedLesson(db, subjectId, "queued");
    // Lesson belongs to learnerId (via subjectId), attempt by learnerId2
    const result = simulateDiscard(db, lessonId, learnerId2);
    expect(result.status).toBe(403);
  });

  it("sets discarded_at timestamp and discard_reason on success", () => {
    const lessonId = seedLesson(db, subjectId, "queued");
    simulateDiscard(db, lessonId, learnerId, "Too basic, need harder material");

    const row = db.prepare("SELECT status, discarded_at, discard_reason FROM lessons WHERE id = ?").get(lessonId) as {
      status: string;
      discarded_at: string;
      discard_reason: string;
    };

    expect(row.status).toBe("discarded");
    expect(row.discarded_at).toBeTruthy();
    expect(row.discard_reason).toBe("Too basic, need harder material");
  });

  it("sets discard_reason to null when no reason provided", () => {
    const lessonId = seedLesson(db, subjectId, "queued");
    simulateDiscard(db, lessonId, learnerId, null);

    const row = db.prepare("SELECT discard_reason FROM lessons WHERE id = ?").get(lessonId) as {
      discard_reason: string | null;
    };
    expect(row.discard_reason).toBeNull();
  });

  it("completed lesson is not modified after a failed discard attempt", () => {
    const lessonId = seedLesson(db, subjectId, "completed");
    simulateDiscard(db, lessonId, learnerId);

    const row = db.prepare("SELECT status, discarded_at FROM lessons WHERE id = ?").get(lessonId) as {
      status: string;
      discarded_at: string | null;
    };
    expect(row.status).toBe("completed");
    expect(row.discarded_at).toBeNull();
  });
});

// ─── Multi-user scoping ──────────────────────────────────────────────────────

describe("Multi-user scoping", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("learners can each create subjects with criteria without cross-contamination", () => {
    const l1 = seedLearner(db);
    const userId2 = db
      .prepare("INSERT INTO users (username, display_name) VALUES ('u2', 'User 2')")
      .run().lastInsertRowid as number;
    const l2 = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Learner 2')")
      .run(userId2).lastInsertRowid as number;

    const s1 = seedSubject(db, l1, { criteria: "L1 criteria" });
    const s2 = seedSubject(db, l2, { criteria: "L2 criteria" });

    const r1 = db.prepare("SELECT learner_id, criteria FROM subjects WHERE id = ?").get(s1) as {
      learner_id: number;
      criteria: string;
    };
    const r2 = db.prepare("SELECT learner_id, criteria FROM subjects WHERE id = ?").get(s2) as {
      learner_id: number;
      criteria: string;
    };

    expect(r1.learner_id).toBe(l1);
    expect(r1.criteria).toBe("L1 criteria");
    expect(r2.learner_id).toBe(l2);
    expect(r2.criteria).toBe("L2 criteria");
  });

  it("discarding lessons for learner A does not affect learner B's lessons", () => {
    const l1 = seedLearner(db);
    const userId2 = db
      .prepare("INSERT INTO users (username, display_name) VALUES ('u2b', 'User 2B')")
      .run().lastInsertRowid as number;
    const l2 = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Learner 2B')")
      .run(userId2).lastInsertRowid as number;

    const s1 = seedSubject(db, l1);
    const s2 = seedSubject(db, l2);
    const lesson1 = seedLesson(db, s1, "queued");
    const lesson2 = seedLesson(db, s2, "queued");

    simulateDiscard(db, lesson1, l1);

    const row1 = db.prepare("SELECT status FROM lessons WHERE id = ?").get(lesson1) as { status: string };
    const row2 = db.prepare("SELECT status FROM lessons WHERE id = ?").get(lesson2) as { status: string };

    expect(row1.status).toBe("discarded");
    expect(row2.status).toBe("queued"); // unaffected
  });
});
