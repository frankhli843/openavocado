/**
 * Schema and domain model tests.
 * Tests run against an in-memory SQLite database.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import type { LevelProgression } from "@/types";
import { emptyConceptReviewEvidence } from "@/lib/concept-evidence";

const TEST_LEVEL_PROGRESSION: LevelProgression = {
  previous_level: "familiarity",
  current_level: "familiarity",
  recommended_level: "familiarity",
  next_level: "competence",
  graduated: false,
  progress_percent: 0,
  reason: "Holding at Familiarity for test fixture.",
  frontier_mode: false,
  evidence: {
    completed_lessons: 0,
    total_lessons: 0,
    mastery_score: null,
    assessment_total: 0,
    assessment_accuracy: null,
    hard_assessment_total: 0,
    hard_assessment_accuracy: null,
    positive_signals: 0,
    review_signals: 0,
    passed_code_submissions: 0,
    total_code_submissions: 0,
  },
  gates: [],
  phases: [
    { level: "familiarity", label: "Familiarity", status: "current", summary: "High-level concepts" },
    { level: "competence", label: "Competence", status: "locked", summary: "Important details" },
    { level: "mastery", label: "Mastery", status: "locked", summary: "Transfer" },
    { level: "post_mastery", label: "Post-mastery", status: "locked", summary: "Frontier papers" },
  ],
};

const TEST_COMPLETION_LEVEL_FIELDS = {
  current_level: TEST_LEVEL_PROGRESSION.current_level,
  level_progression: TEST_LEVEL_PROGRESSION,
};

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(
    path.join(__dirname, "../db/schema.sql"),
    "utf-8"
  );
  db.exec(schema);
  return db;
}

describe("Schema: multi-user isolation", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("creates separate learner profiles per user", () => {
    const u1 = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?) RETURNING id").get("alice", "Alice") as { id: number };
    const u2 = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?) RETURNING id").get("bob", "Bob") as { id: number };

    db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)").run(u1.id, "Alice");
    db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)").run(u2.id, "Bob");

    const profiles = db.prepare("SELECT * FROM learner_profiles").all() as Array<{ user_id: number; display_name: string }>;
    expect(profiles).toHaveLength(2);
    expect(profiles.map((p) => p.display_name)).toEqual(["Alice", "Bob"]);
  });

  it("subjects are scoped to learner, not globally visible", () => {
    const u1 = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?) RETURNING id").get("alice", "Alice") as { id: number };
    const u2 = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?) RETURNING id").get("bob", "Bob") as { id: number };

    const p1 = db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?) RETURNING id").get(u1.id, "Alice") as { id: number };
    const p2 = db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?) RETURNING id").get(u2.id, "Bob") as { id: number };

    db.prepare("INSERT INTO subjects (learner_id, title) VALUES (?, ?)").run(p1.id, "Alice's Subject");
    db.prepare("INSERT INTO subjects (learner_id, title) VALUES (?, ?)").run(p2.id, "Bob's Subject");

    const alice_subjects = db.prepare("SELECT * FROM subjects WHERE learner_id = ?").all(p1.id) as Array<{ title: string }>;
    const bob_subjects = db.prepare("SELECT * FROM subjects WHERE learner_id = ?").all(p2.id) as Array<{ title: string }>;

    expect(alice_subjects).toHaveLength(1);
    expect(alice_subjects[0].title).toBe("Alice's Subject");
    expect(bob_subjects).toHaveLength(1);
    expect(bob_subjects[0].title).toBe("Bob's Subject");
  });
});

describe("Schema: lesson lifecycle", () => {
  let db: Database.Database;
  let learnerId: number;
  let subjectId: number;

  beforeEach(() => {
    db = createTestDb();
    const u = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?) RETURNING id").get("test", "Test") as { id: number };
    const p = db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?) RETURNING id").get(u.id, "Test") as { id: number };
    learnerId = p.id;
    const s = db.prepare("INSERT INTO subjects (learner_id, title) VALUES (?, ?) RETURNING id").get(learnerId, "Test Subject") as { id: number };
    subjectId = s.id;
  });
  afterEach(() => db.close());

  it("creates a lesson in queued state", () => {
    const lesson = db
      .prepare("INSERT INTO lessons (subject_id, title, sequence_number) VALUES (?, ?, ?) RETURNING *")
      .get(subjectId, "Lesson 1", 1) as { status: string };
    expect(lesson.status).toBe("queued");
  });

  it("creates all required core activity types", () => {
    const lesson = db
      .prepare("INSERT INTO lessons (subject_id, title) VALUES (?, ?) RETURNING id")
      .get(subjectId, "Test Lesson") as { id: number };

    const coreTypes = ["audio", "interactive", "practice_code", "assessment"];
    for (const type of coreTypes) {
      db.prepare(
        "INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order) VALUES (?, ?, 1, ?)"
      ).run(lesson.id, type, coreTypes.indexOf(type));
    }

    const activities = db
      .prepare("SELECT activity_type FROM lesson_activities WHERE lesson_id = ? AND is_core = 1")
      .all(lesson.id) as Array<{ activity_type: string }>;

    const types = activities.map((a) => a.activity_type);
    expect(types).toContain("audio");
    expect(types).toContain("interactive");
    expect(types).toContain("practice_code");
    expect(types).toContain("assessment");
  });

  it("validates lesson status check constraint", () => {
    const lesson = db
      .prepare("INSERT INTO lessons (subject_id, title) VALUES (?, ?) RETURNING id")
      .get(subjectId, "Test Lesson") as { id: number };

    expect(() => {
      db.prepare("UPDATE lessons SET status = 'invalid_status' WHERE id = ?").run(lesson.id);
    }).toThrow();
  });
});

describe("Schema: autosave — never marks completion", () => {
  let db: Database.Database;
  let learnerId: number;
  let lessonId: number;

  beforeEach(() => {
    db = createTestDb();
    const u = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?) RETURNING id").get("test", "Test") as { id: number };
    const p = db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?) RETURNING id").get(u.id, "Test") as { id: number };
    learnerId = p.id;
    const s = db.prepare("INSERT INTO subjects (learner_id, title) VALUES (?, ?) RETURNING id").get(learnerId, "Subject") as { id: number };
    const l = db.prepare("INSERT INTO lessons (subject_id, title) VALUES (?, ?) RETURNING id").get(s.id, "Lesson") as { id: number };
    lessonId = l.id;
  });
  afterEach(() => db.close());

  it("autosave upserts do not change lesson status", () => {
    db.prepare(
      `INSERT INTO lesson_autosave (lesson_id, learner_id, activity_id, code_draft, saved_at)
       VALUES (?, ?, 0, ?, datetime('now'))`
    ).run(lessonId, learnerId, "x = 1");

    const lesson = db
      .prepare("SELECT status FROM lessons WHERE id = ?")
      .get(lessonId) as { status: string };

    expect(lesson.status).toBe("queued");
  });

  it("autosave upsert on conflict updates code_draft", () => {
    // activity_id=0 is the sentinel for "lesson-level" (not scoped to specific activity)
    db.prepare(
      `INSERT INTO lesson_autosave (lesson_id, learner_id, activity_id, code_draft, saved_at)
       VALUES (?, ?, 0, ?, datetime('now'))`
    ).run(lessonId, learnerId, "x = 1");

    db.prepare(
      `INSERT INTO lesson_autosave (lesson_id, learner_id, activity_id, code_draft, saved_at)
       VALUES (?, ?, 0, ?, datetime('now'))
       ON CONFLICT (lesson_id, learner_id, activity_id) DO UPDATE SET
         code_draft = excluded.code_draft,
         saved_at = datetime('now')`
    ).run(lessonId, learnerId, "x = 2");

    const saved = db
      .prepare("SELECT code_draft FROM lesson_autosave WHERE lesson_id = ? AND learner_id = ?")
      .get(lessonId, learnerId) as { code_draft: string };

    expect(saved.code_draft).toBe("x = 2");
  });
});

describe("Schema: completion is manual only", () => {
  let db: Database.Database;
  let lessonId: number;

  beforeEach(() => {
    db = createTestDb();
    const u = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?) RETURNING id").get("test", "Test") as { id: number };
    const p = db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?) RETURNING id").get(u.id, "Test") as { id: number };
    const s = db.prepare("INSERT INTO subjects (learner_id, title) VALUES (?, ?) RETURNING id").get(p.id, "Subject") as { id: number };
    const l = db.prepare("INSERT INTO lessons (subject_id, title) VALUES (?, ?) RETURNING id").get(s.id, "Lesson") as { id: number };
    lessonId = l.id;
  });
  afterEach(() => db.close());

  it("lesson stays queued until explicitly updated to completed", () => {
    const before = db.prepare("SELECT status FROM lessons WHERE id = ?").get(lessonId) as { status: string };
    expect(before.status).toBe("queued");

    // Simulate: multiple autosaves happen
    for (let i = 0; i < 5; i++) {
      // In real code, autosave writes to lesson_autosave, NOT to lessons.status
      db.prepare(`INSERT OR REPLACE INTO lesson_autosave (lesson_id, learner_id, activity_id, code_draft, saved_at)
        VALUES (?, 1, 0, ?, datetime('now'))`).run(lessonId, `draft ${i}`);
    }

    const afterAutosave = db.prepare("SELECT status FROM lessons WHERE id = ?").get(lessonId) as { status: string };
    expect(afterAutosave.status).toBe("queued"); // Still queued

    // Only explicit update moves to completed
    db.prepare("UPDATE lessons SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(lessonId);
    const afterComplete = db.prepare("SELECT status FROM lessons WHERE id = ?").get(lessonId) as { status: string };
    expect(afterComplete.status).toBe("completed");
  });
});

describe("Completion adapter contract", () => {
  it("noop adapter returns ok without side effects", async () => {
    const { noopAdapter } = await import("../lib/adapters/noop");
    const result = await noopAdapter.dispatch({
      event: "lesson.completed",
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      ...TEST_COMPLETION_LEVEL_FIELDS,
      lesson_id: 1,
      lesson_title: "Test Lesson",
      lesson_goals: [],
      activities_completed: [],
      assessment_qa: [],
      code_attempts: [],
      mastery_signals: [],
      concepts_to_review: [],
      concepts_ready_to_advance: [],
      next_lesson_diagnostics: [],
      quiz_result: null,
      tag_difficulty_performance: [],
      recent_misconceptions: [],
      concept_review_evidence: emptyConceptReviewEvidence(),
      completed_lessons: [],
      discarded_lessons: [],
      workpad_summary: null,
      learner_profile_config: null,
      cross_subject_history: [],
      subject_goals: null,
      subject_criteria: null,
      completed_at: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
    expect(result.ref).toBeDefined();
  });

  it("webhook adapter fails gracefully when URL missing", async () => {
    const { webhookAdapter } = await import("../lib/adapters/webhook");
    const result = await webhookAdapter.dispatch({
      event: "lesson.completed",
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      ...TEST_COMPLETION_LEVEL_FIELDS,
      lesson_id: 1,
      lesson_title: "Test Lesson",
      lesson_goals: [],
      activities_completed: [],
      assessment_qa: [],
      code_attempts: [],
      mastery_signals: [],
      concepts_to_review: [],
      concepts_ready_to_advance: [],
      next_lesson_diagnostics: [],
      quiz_result: null,
      tag_difficulty_performance: [],
      recent_misconceptions: [],
      concept_review_evidence: emptyConceptReviewEvidence(),
      completed_lessons: [],
      discarded_lessons: [],
      workpad_summary: null,
      learner_profile_config: null,
      cross_subject_history: [],
      subject_goals: null,
      subject_criteria: null,
      completed_at: new Date().toISOString(),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no URL configured/);
  });
});

describe("Python sandbox adapter boundary", () => {
  it("stub executor returns ready=false", async () => {
    const { stubExecutor } = await import("../lib/python-sandbox");
    expect(stubExecutor.isReady()).toBe(false);
    expect(stubExecutor.name).toBe("stub");
  });

  it("stub executor run returns informative error", async () => {
    const { stubExecutor } = await import("../lib/python-sandbox");
    const result = await stubExecutor.run({ code: "print(1)" });
    expect(result.error).toMatch(/not yet loaded/);
    expect(result.test_results).toHaveLength(0);
  });
});

describe("Autosave utilities", () => {
  it("debounce fires once after delay", async () => {
    const { debounce } = await import("../lib/autosave");
    let callCount = 0;
    const [debouncedFn, cancel] = debounce(() => { callCount++; }, 50);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(1);
    cancel();
  });

  it("cancel prevents the debounced call", async () => {
    const { debounce } = await import("../lib/autosave");
    let callCount = 0;
    const [debouncedFn, cancel] = debounce(() => { callCount++; }, 50);

    debouncedFn();
    cancel();

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(0);
  });
});
