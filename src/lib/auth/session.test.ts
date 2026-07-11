import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "avocadocore-session-"));
  process.env.AVOCADOCORE_DB_PATH = path.join(tmpDir, "test.db");
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.AVOCADOCORE_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("ensureActiveLearnerProfile", () => {
  it("creates an active learner profile for a valid account that has none", async () => {
    const { getDb } = await import("@/db/connection");
    const { ensureActiveLearnerProfile } = await import("./session");
    const db = getDb();
    const userId = db
      .prepare("INSERT INTO users (username, display_name, is_guest) VALUES (?, ?, 1)")
      .run("guest-stale", "Guest learner").lastInsertRowid as number;

    const repaired = ensureActiveLearnerProfile({
      id: userId,
      username: "guest-stale",
      display_name: "Guest learner",
      email: null,
      active_learner_id: null,
      is_guest: true,
    });

    expect(repaired.active_learner_id).toEqual(expect.any(Number));
    const user = db
      .prepare("SELECT active_learner_id FROM users WHERE id = ?")
      .get(userId) as { active_learner_id: number };
    expect(user.active_learner_id).toBe(repaired.active_learner_id);
    const profile = db
      .prepare("SELECT user_id, display_name FROM learner_profiles WHERE id = ?")
      .get(repaired.active_learner_id) as { user_id: number; display_name: string };
    expect(profile).toEqual({ user_id: userId, display_name: "Guest learner" });
    const demo = db
      .prepare(
        `SELECT s.title, COUNT(l.id) AS lesson_count,
                GROUP_CONCAT(l.sequence_number, ',') AS sequences
         FROM subjects s
         JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ? AND s.title = 'Demo Lesson: Build your own LLM AI'
         GROUP BY s.id`
      )
      .get(repaired.active_learner_id) as { title: string; lesson_count: number; sequences: string };
    expect(demo).toEqual({
      title: "Demo Lesson: Build your own LLM AI",
      lesson_count: 3,
      sequences: "1,2,3",
    });
  });

  it("reuses the account's first learner profile when the active pointer is stale", async () => {
    const { getDb } = await import("@/db/connection");
    const { ensureActiveLearnerProfile } = await import("./session");
    const db = getDb();
    const otherUserId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("other-user", "Other User").lastInsertRowid as number;
    const wrongProfileId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(otherUserId, "Other profile").lastInsertRowid as number;
    const userId = db
      .prepare("INSERT INTO users (username, display_name, active_learner_id) VALUES (?, ?, ?)")
      .run("claimed-stale", "Claimed Learner", wrongProfileId).lastInsertRowid as number;
    const existingProfileId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(userId, "Existing profile").lastInsertRowid as number;

    const repaired = ensureActiveLearnerProfile({
      id: userId,
      username: "claimed-stale",
      display_name: "Claimed Learner",
      email: null,
      active_learner_id: wrongProfileId,
      is_guest: false,
    });

    expect(repaired.active_learner_id).toBe(existingProfileId);
    const profileCount = db
      .prepare("SELECT COUNT(*) AS count FROM learner_profiles WHERE user_id = ?")
      .get(userId) as { count: number };
    expect(profileCount.count).toBe(1);
    const demoCount = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM subjects s
         JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ? AND s.title = 'Demo Lesson: Build your own LLM AI'`
      )
      .get(existingProfileId) as { count: number };
    expect(demoCount.count).toBe(3);
  });

  it("does not duplicate the demo subject when profile repair runs repeatedly", async () => {
    const { getDb } = await import("@/db/connection");
    const { ensureActiveLearnerProfile } = await import("./session");
    const db = getDb();
    const userId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("repeat-user", "Repeat User").lastInsertRowid as number;
    const learnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(userId, "Repeat User").lastInsertRowid as number;
    db.prepare("UPDATE users SET active_learner_id = ? WHERE id = ?").run(learnerId, userId);

    const user = {
      id: userId,
      username: "repeat-user",
      display_name: "Repeat User",
      email: null,
      active_learner_id: learnerId,
      is_guest: false,
    };
    ensureActiveLearnerProfile(user);
    ensureActiveLearnerProfile(user);

    const demo = db
      .prepare(
        `SELECT COUNT(DISTINCT s.id) AS subject_count, COUNT(l.id) AS lesson_count
         FROM subjects s
         JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ? AND s.title = 'Demo Lesson: Build your own LLM AI'`
      )
      .get(learnerId) as { subject_count: number; lesson_count: number };
    expect(demo).toEqual({ subject_count: 1, lesson_count: 3 });
  });

  it("clones the configured canonical demo subject instead of the old three-lesson seed", async () => {
    const { getDb } = await import("@/db/connection");
    const { ensureActiveLearnerProfile } = await import("./session");
    const { CANONICAL_DEMO_GENERATOR } = await import("@/lib/demo-lessons");
    const db = getDb();

    const canonicalUserId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("canonical-user", "Canonical User").lastInsertRowid as number;
    const canonicalLearnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(canonicalUserId, "Canonical").lastInsertRowid as number;
    const canonicalSubjectId = db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        canonicalLearnerId,
        "Model Building and Inference",
        "Rich canonical demo subject.",
        "Understand the model-building path.",
        "Use the rich subject as public demo source.",
        "familiarity"
      ).lastInsertRowid as number;

    const insertLesson = db.prepare(
      `INSERT INTO lessons
         (subject_id, title, description, status, sequence_number, goals, tags, generated_by, generator_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertActivity = db.prepare(
      `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
       VALUES (?, ?, 1, ?, ?, ?)`
    );
    db.exec(`
      CREATE TABLE IF NOT EXISTS subject_workpads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        learner_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS subject_journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        learner_id INTEGER NOT NULL,
        entry_type TEXT NOT NULL DEFAULT 'planning',
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    for (const [index, title] of [
      "Initial Assessment: Model Building and Inference",
      "The LLM Lifecycle: From Raw Text to Running Model",
      "Inside the Transformer: From Token IDs to Next-Token Logits",
      "Inside the Attention Block: Q, K, V, MLP, and the Residual Stream",
      "Private Sara Gemma Planning Lesson",
    ].entries()) {
      const lessonId = insertLesson.run(
        canonicalSubjectId,
        title,
        `Canonical lesson ${index}`,
        index < 2 ? "completed" : "in_progress",
        index,
        JSON.stringify(["goal"]),
        JSON.stringify(["tag"]),
        "canonical-source-test",
        "test"
      ).lastInsertRowid as number;
      db.prepare("UPDATE lessons SET source_context = ? WHERE id = ?").run(
        JSON.stringify({ private_note: "Sara private Gemma discussion, do not copy" }),
        lessonId
      );
      insertActivity.run(
        lessonId,
        index === 0 ? "assessment" : "reading",
        1,
        "Canonical activity",
        JSON.stringify({ text: `activity ${index}` })
      );
    }
    db.prepare(
      "INSERT INTO subject_workpads (subject_id, learner_id, content) VALUES (?, ?, ?)"
    ).run(canonicalSubjectId, canonicalLearnerId, "Private Sara Gemma workpad");
    db.prepare(
      "INSERT INTO subject_journal_entries (subject_id, learner_id, title, content) VALUES (?, ?, ?, ?)"
    ).run(canonicalSubjectId, canonicalLearnerId, "Private journal", "Private Sara Gemma journal");
    vi.stubEnv("AVOCADOCORE_DEMO_SOURCE_SUBJECT_ID", String(canonicalSubjectId));

    const userId = db
      .prepare("INSERT INTO users (username, display_name, is_guest) VALUES (?, ?, 1)")
      .run("guest-canonical", "Guest learner").lastInsertRowid as number;
    const repaired = ensureActiveLearnerProfile({
      id: userId,
      username: "guest-canonical",
      display_name: "Guest learner",
      email: null,
      active_learner_id: null,
      is_guest: true,
    });

    const demo = db
      .prepare(
        `SELECT s.title, s.description, COUNT(l.id) AS lesson_count,
                GROUP_CONCAT(l.sequence_number, ',') AS sequences,
                GROUP_CONCAT(l.status, ',') AS statuses,
                GROUP_CONCAT(l.generated_by, ',') AS generators,
                SUM(CASE WHEN l.source_context IS NULL THEN 1 ELSE 0 END) AS null_source_contexts
         FROM subjects s
         JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ? AND s.title = 'Demo Lesson: Build your own LLM AI'
         GROUP BY s.id`
      )
      .get(repaired.active_learner_id) as {
        title: string;
        description: string;
        lesson_count: number;
        sequences: string;
        statuses: string;
        generators: string;
        null_source_contexts: number;
      };

    expect(demo.title).toBe("Demo Lesson: Build your own LLM AI");
    expect(demo.description).toContain("built-in demo track");
    expect(demo.lesson_count).toBe(4);
    expect(demo.sequences).toBe("0,1,2,3");
    expect(demo.statuses).toBe("queued,queued,queued,queued");
    expect(demo.generators).toBe(
      Array.from({ length: 4 }, () => CANONICAL_DEMO_GENERATOR).join(",")
    );
    expect(demo.null_source_contexts).toBe(4);
    const privateLessonCount = db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM lessons l
           JOIN subjects s ON s.id = l.subject_id
          WHERE s.learner_id = ?
            AND s.title = 'Demo Lesson: Build your own LLM AI'
            AND l.title LIKE '%Private Sara%'`
      )
      .get(repaired.active_learner_id) as { count: number };
    expect(privateLessonCount.count).toBe(0);
    const copiedWorkpadCount = db
      .prepare("SELECT COUNT(*) AS count FROM subject_workpads WHERE learner_id = ?")
      .get(repaired.active_learner_id) as { count: number };
    const copiedJournalCount = db
      .prepare("SELECT COUNT(*) AS count FROM subject_journal_entries WHERE learner_id = ?")
      .get(repaired.active_learner_id) as { count: number };
    expect(copiedWorkpadCount.count).toBe(0);
    expect(copiedJournalCount.count).toBe(0);
  });

  it("ignores canonical demo cloning in production", async () => {
    const { getDb } = await import("@/db/connection");
    const { ensureActiveLearnerProfile } = await import("./session");
    const db = getDb();

    const canonicalUserId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("prod-canonical-user", "Canonical User").lastInsertRowid as number;
    const canonicalLearnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(canonicalUserId, "Canonical").lastInsertRowid as number;
    const canonicalSubjectId = db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        canonicalLearnerId,
        "Private Model Building",
        "Private canonical source.",
        "Private goal.",
        "Private criteria.",
        "familiarity"
      ).lastInsertRowid as number;
    db.prepare(
      `INSERT INTO lessons
         (subject_id, title, description, status, sequence_number, goals, tags, generated_by)
       VALUES (?, ?, ?, 'queued', 0, ?, ?, ?)`
    ).run(
      canonicalSubjectId,
      "Private Sara Gemma Planning Lesson",
      "Private",
      JSON.stringify(["goal"]),
      JSON.stringify(["tag"]),
      "canonical-source-test"
    );
    vi.stubEnv("AVOCADOCORE_DEMO_SOURCE_SUBJECT_ID", String(canonicalSubjectId));
    vi.stubEnv("NODE_ENV", "production");

    const userId = db
      .prepare("INSERT INTO users (username, display_name, is_guest) VALUES (?, ?, 1)")
      .run("guest-prod-canonical", "Guest learner").lastInsertRowid as number;
    const repaired = ensureActiveLearnerProfile({
      id: userId,
      username: "guest-prod-canonical",
      display_name: "Guest learner",
      email: null,
      active_learner_id: null,
      is_guest: true,
    });

    const demo = db
      .prepare(
        `SELECT COUNT(l.id) AS lesson_count,
                GROUP_CONCAT(l.sequence_number, ',') AS sequences,
                SUM(CASE WHEN l.title LIKE '%Private Sara%' THEN 1 ELSE 0 END) AS private_count
         FROM subjects s
         JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ? AND s.title = 'Demo Lesson: Build your own LLM AI'`
      )
      .get(repaired.active_learner_id) as {
        lesson_count: number;
        sequences: string;
        private_count: number;
      };
    expect(demo).toEqual({ lesson_count: 3, sequences: "1,2,3", private_count: 0 });
  });
});
