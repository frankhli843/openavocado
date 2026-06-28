import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import {
  getCompletionAdapter,
  getRegenerationAdapter,
  getSubjectCreatedDispatcher,
  noopAdapter,
  noopRegenerationAdapter,
  noopSubjectCreatedDispatcher,
  localQueueAdapter,
  localQueueRegenerationAdapter,
  localQueueSubjectCreatedDispatcher,
  webhookAdapter,
  webhookRegenerationAdapter,
  webhookSubjectCreatedDispatcher,
  doraTaskAdapter,
  doraTaskRegenerationAdapter,
  doraTaskSubjectCreatedDispatcher,
} from "../index";
import { generateInitialAssessment } from "../../lesson-generator/initial-assessment";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCompletionAdapter", () => {
  it("returns dora-task adapter when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getCompletionAdapter()).toBe(doraTaskAdapter);
  });

  it("returns noop adapter for 'noop'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "noop");
    expect(getCompletionAdapter()).toBe(noopAdapter);
  });

  it("returns local-queue adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "local-queue");
    expect(getCompletionAdapter()).toBe(localQueueAdapter);
  });

  it("returns webhook adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "webhook");
    expect(getCompletionAdapter()).toBe(webhookAdapter);
  });

  it("returns dora-task adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "dora-task");
    expect(getCompletionAdapter()).toBe(doraTaskAdapter);
  });

  it("falls back to noop for unknown adapter name", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "unknown-adapter");
    expect(getCompletionAdapter()).toBe(noopAdapter);
  });

  it("all completion adapters have a name and dispatch function", () => {
    for (const adapter of [noopAdapter, localQueueAdapter, webhookAdapter, doraTaskAdapter]) {
      expect(typeof adapter.name).toBe("string");
      expect(adapter.name.length).toBeGreaterThan(0);
      expect(typeof adapter.dispatch).toBe("function");
    }
  });
});

describe("getRegenerationAdapter", () => {
  it("returns dora-task regeneration adapter when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getRegenerationAdapter()).toBe(doraTaskRegenerationAdapter);
  });

  it("returns noop regeneration adapter for 'noop'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "noop");
    expect(getRegenerationAdapter()).toBe(noopRegenerationAdapter);
  });

  it("returns local-queue regeneration adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "local-queue");
    expect(getRegenerationAdapter()).toBe(localQueueRegenerationAdapter);
  });

  it("returns webhook regeneration adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "webhook");
    expect(getRegenerationAdapter()).toBe(webhookRegenerationAdapter);
  });

  it("returns dora-task regeneration adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "dora-task");
    expect(getRegenerationAdapter()).toBe(doraTaskRegenerationAdapter);
  });

  it("falls back to noop for unknown adapter name", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "unknown-adapter");
    expect(getRegenerationAdapter()).toBe(noopRegenerationAdapter);
  });

  it("completion and regeneration adapters share the same name key", () => {
    // Both getters use the same env var — same key must return paired adapters
    const pairs = [
      ["noop", noopAdapter, noopRegenerationAdapter],
      ["local-queue", localQueueAdapter, localQueueRegenerationAdapter],
      ["webhook", webhookAdapter, webhookRegenerationAdapter],
      ["dora-task", doraTaskAdapter, doraTaskRegenerationAdapter],
    ] as const;

    for (const [name, completion, regeneration] of pairs) {
      vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", name);
      expect(getCompletionAdapter()).toBe(completion);
      expect(getRegenerationAdapter()).toBe(regeneration);
    }
  });

  it("noop regeneration adapter dispatches without throwing", async () => {
    const event = {
      event: "lesson.discarded" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_description: null,
      subject_goals: null,
      subject_criteria: null,
      discarded_lesson_id: 42,
      discarded_lesson_title: "Test Lesson",
      discarded_lesson_status: "queued" as const,
      discard_reason: "Too easy",
      mastery_score: 0,
      completed_lessons: [],
      mastery_signals: [],
      workpad_summary: null,
      discarded_at: new Date().toISOString(),
    };
    const result = await noopRegenerationAdapter.dispatch(event);
    expect(result.ok).toBe(true);
    expect(typeof result.ref).toBe("string");
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  // Apply the additive migrations we need (harness cols + user_provider_configs)
  const hasColumn = (table: string, col: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(
      (c) => c.name === col
    );
  const additive = [
    ["next_lesson_jobs", "trigger_event", "ALTER TABLE next_lesson_jobs ADD COLUMN trigger_event TEXT NOT NULL DEFAULT 'lesson.completed'"],
    ["next_lesson_jobs", "discarded_lesson_id", "ALTER TABLE next_lesson_jobs ADD COLUMN discarded_lesson_id INTEGER"],
    ["next_lesson_jobs", "harness_status", "ALTER TABLE next_lesson_jobs ADD COLUMN harness_status TEXT"],
    ["next_lesson_jobs", "harness_stage", "ALTER TABLE next_lesson_jobs ADD COLUMN harness_stage TEXT"],
    ["next_lesson_jobs", "progress_events", "ALTER TABLE next_lesson_jobs ADD COLUMN progress_events TEXT"],
    ["next_lesson_jobs", "retry_count", "ALTER TABLE next_lesson_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0"],
    ["next_lesson_jobs", "last_error_detail", "ALTER TABLE next_lesson_jobs ADD COLUMN last_error_detail TEXT"],
    ["next_lesson_jobs", "provider_name", "ALTER TABLE next_lesson_jobs ADD COLUMN provider_name TEXT"],
    ["next_lesson_jobs", "output_lesson_id", "ALTER TABLE next_lesson_jobs ADD COLUMN output_lesson_id INTEGER"],
  ] as const;
  for (const [table, col, sql] of additive) {
    if (!hasColumn(table, col)) db.exec(sql);
  }
  return db;
}

function seedLearner(db: Database.Database) {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('test', 'Test')")
    .run().lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Learner')")
    .run(userId).lastInsertRowid as number;
  return { userId, learnerId };
}

function seedSubject(db: Database.Database, learnerId: number) {
  return db
    .prepare("INSERT INTO subjects (learner_id, title, current_level) VALUES (?, 'Test Subject', 'familiarity')")
    .run(learnerId).lastInsertRowid as number;
}

// ─── getSubjectCreatedDispatcher tests ──────────────────────────────────────

describe("getSubjectCreatedDispatcher", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns dora-task dispatcher when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getSubjectCreatedDispatcher()).toBe(doraTaskSubjectCreatedDispatcher);
  });

  it("returns noop dispatcher for 'noop'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "noop");
    expect(getSubjectCreatedDispatcher()).toBe(noopSubjectCreatedDispatcher);
  });

  it("returns local-queue dispatcher for 'local-queue'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "local-queue");
    expect(getSubjectCreatedDispatcher()).toBe(localQueueSubjectCreatedDispatcher);
  });

  it("returns webhook dispatcher for 'webhook'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "webhook");
    expect(getSubjectCreatedDispatcher()).toBe(webhookSubjectCreatedDispatcher);
  });

  it("returns dora-task dispatcher for 'dora-task'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "dora-task");
    expect(getSubjectCreatedDispatcher()).toBe(doraTaskSubjectCreatedDispatcher);
  });

  it("falls back to noop for unknown adapter name", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "unknown-xyz");
    expect(getSubjectCreatedDispatcher()).toBe(noopSubjectCreatedDispatcher);
  });
});

// ─── noop subject.created dispatcher ────────────────────────────────────────

describe("noopSubjectCreatedDispatcher", () => {
  it("returns ok=true and a ref without side effects", async () => {
    const event = {
      event: "subject.created" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test Subject",
      subject_description: null,
      subject_goals: null,
      subject_criteria: null,
      current_level: "familiarity" as const,
      workpad_summary: null,
      learner_profile_config: null,
      created_at: new Date().toISOString(),
    };
    const result = await noopSubjectCreatedDispatcher(event);
    expect(result.ok).toBe(true);
    expect(typeof result.ref).toBe("string");
    expect(result.lesson_id).toBeUndefined();
  });
});

// ─── webhook subject.created dispatcher ─────────────────────────────────────

describe("webhookSubjectCreatedDispatcher", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns error when no URL configured", async () => {
    vi.stubEnv("AVOCADOCORE_WEBHOOK_URL", "");
    const event = {
      event: "subject.created" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_description: null,
      subject_goals: null,
      subject_criteria: null,
      current_level: "familiarity" as const,
      workpad_summary: null,
      learner_profile_config: null,
      created_at: new Date().toISOString(),
    };
    const result = await webhookSubjectCreatedDispatcher(event);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no URL configured/i);
  });

  it("posts to the webhook URL and returns ok", async () => {
    vi.stubEnv("AVOCADOCORE_WEBHOOK_URL", "https://hook.example.test/subjects");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const event = {
      event: "subject.created" as const,
      learner_id: 1,
      subject_id: 42,
      subject_title: "WebhookSubject",
      subject_description: null,
      subject_goals: null,
      subject_criteria: null,
      current_level: "familiarity" as const,
      workpad_summary: null,
      learner_profile_config: null,
      created_at: new Date().toISOString(),
    };

    const result = await webhookSubjectCreatedDispatcher(event);
    expect(result.ok).toBe(true);
    expect(typeof result.ref).toBe("string");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hook.example.test/subjects",
      expect.objectContaining({ method: "POST" })
    );
  });
});

// ─── generateInitialAssessment (unit) ───────────────────────────────────────

describe("generateInitialAssessment", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    const { learnerId } = seedLearner(db);
    seedSubject(db, learnerId);
  });

  it("creates a lesson with sequence_number=0 and 'Initial Assessment:' prefix", () => {
    const event = {
      event: "subject.created" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Quantum Mechanics",
      subject_description: null,
      subject_goals: "Understand superposition",
      subject_criteria: null,
      current_level: "familiarity" as const,
      workpad_summary: null,
      learner_profile_config: null,
      created_at: new Date().toISOString(),
    };
    const result = generateInitialAssessment(db, event);
    expect(result.lesson_id).toBeGreaterThan(0);
    expect(result.lesson_title).toMatch(/^Initial Assessment:/);
    expect(result.question_count).toBeGreaterThan(0);

    const lesson = db
      .prepare("SELECT * FROM lessons WHERE id = ?")
      .get(result.lesson_id) as { sequence_number: number; status: string };
    expect(lesson.sequence_number).toBe(0);
    expect(lesson.status).toBe("queued");
  });

  it("creates exactly one assessment activity with 6 questions", () => {
    const event = {
      event: "subject.created" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Linear Algebra",
      subject_description: null,
      subject_goals: null,
      subject_criteria: null,
      current_level: "familiarity" as const,
      workpad_summary: null,
      learner_profile_config: null,
      created_at: new Date().toISOString(),
    };
    const result = generateInitialAssessment(db, event);
    expect(result.question_count).toBe(6);

    const activities = db
      .prepare("SELECT * FROM lesson_activities WHERE lesson_id = ?")
      .all(result.lesson_id) as Array<{ activity_type: string; content: string }>;
    expect(activities).toHaveLength(1);
    expect(activities[0].activity_type).toBe("assessment");

    const content = JSON.parse(activities[0].content) as { questions: unknown[] };
    expect(content.questions).toHaveLength(6);
  });
});

// ─── Initial assessment idempotency (via generateInitialAssessment directly) ─
//
// localQueueSubjectCreatedDispatcher calls generateInitialAssessment only when
// no sequence_number=0 lesson exists. The guard and idempotency pattern are
// tested here by simulating the dispatcher logic with a real in-memory DB.

describe("initial assessment idempotency guard", () => {
  let db: Database.Database;
  let subjectId: number;

  beforeEach(() => {
    db = makeDb();
    const { learnerId } = seedLearner(db);
    subjectId = seedSubject(db, learnerId);
  });

  const makeEvent = (id: number) => ({
    event: "subject.created" as const,
    learner_id: 1,
    subject_id: id,
    subject_title: "Idempotency Test Subject",
    subject_description: null,
    subject_goals: null,
    subject_criteria: null,
    current_level: "familiarity" as const,
    workpad_summary: null,
    learner_profile_config: null,
    created_at: new Date().toISOString(),
  });

  it("generateInitialAssessment creates exactly one lesson at sequence_number=0", () => {
    const event = makeEvent(subjectId);
    const r1 = generateInitialAssessment(db, event);
    expect(r1.lesson_id).toBeGreaterThan(0);

    // Simulate the idempotency check: a second call should find the existing row
    const existing = db
      .prepare("SELECT id FROM lessons WHERE subject_id = ? AND sequence_number = 0 LIMIT 1")
      .get(subjectId) as { id: number } | undefined;

    expect(existing).toBeDefined();
    expect(existing?.id).toBe(r1.lesson_id);

    // Verify only one row was created
    const count = (
      db
        .prepare("SELECT COUNT(*) as n FROM lessons WHERE subject_id = ? AND sequence_number = 0")
        .get(subjectId) as { n: number }
    ).n;
    expect(count).toBe(1);
  });

  it("idempotency: detecting existing sequence_number=0 lesson prevents duplicate creation", () => {
    const event = makeEvent(subjectId);

    // First creation
    const r1 = generateInitialAssessment(db, event);

    // The dispatcher checks for existing before creating. Simulating that check:
    function dispatchWithIdempotencyCheck() {
      const existing = db
        .prepare("SELECT id, title FROM lessons WHERE subject_id = ? AND sequence_number = 0 LIMIT 1")
        .get(event.subject_id) as { id: number; title: string } | undefined;
      if (existing) {
        return { ok: true, ref: `local-queue-assessment-existing-${existing.id}`, lesson_id: existing.id };
      }
      const r = generateInitialAssessment(db, event);
      return { ok: true, ref: `local-queue-assessment-${r.lesson_id}`, lesson_id: r.lesson_id };
    }

    const r2 = dispatchWithIdempotencyCheck();
    expect(r2.ok).toBe(true);
    expect(r2.lesson_id).toBe(r1.lesson_id); // same lesson returned

    const count = (
      db
        .prepare("SELECT COUNT(*) as n FROM lessons WHERE subject_id = ? AND sequence_number = 0")
        .get(subjectId) as { n: number }
    ).n;
    expect(count).toBe(1); // still only one
  });
});

// ─── The reusable generator paths must hand FUTURE lesson-generation agents the
// enrichment quality bar in the task prompt — not just leave it in the docs.
// These tests fail if a generator-task prompt stops carrying the requirements,
// keeping the "every future lesson is enriched" guarantee from regressing.
describe("dora-task prompts embed the lesson quality bar", () => {
  // Each required enrichment dimension must be named in the generated task prompt.
  const REQUIRED_MARKERS = [
    "LESSON QUALITY BAR",
    "skills/avocadocore-lesson-authoring/SKILL.md",
    "Generated audio AVAILABLE AT CREATION",
    "at least 10 minutes",
    "WHY-FIRST TEACHING",
    "NO UNDOCUMENTED ASSUMPTIONS",
    "PLANNING STAGE BEFORE AUTHORING",
    "comprehensive current research",
    "update the subject workpad and long-term plan",
    "DYNAMIC, BESPOKE AUTHORING",
    "EXAMPLES + METAPHORS",
    "what breaks or becomes invalid if we skip it",
    "WRITTEN teaching text",
    "LESSON PARTS",
    "MULTIPLE meaningful visual/interactive explorations",
    "Interactives must deepen understanding",
    "AUDIO FOR EVERY VISUALIZATION",
    "4 correct answers in a row",
    "done/undone buttons",
    "learner checklist only",
    "TABLE OF CONTENTS AND DEEP LINKS",
    "long generic videos",
    "whole video is relevant",
    "exact timestamped segments",
    "PRACTICE/CODE",
    "unboxable",
    "answer path",
    "external Python library",
    "ADAPTIVE ASSESSMENT IS REQUIRED",
    "SQLITE MASTERY EVIDENCE",
    "CONTINUOUS MODEL NOTES",
    "I don't know",
    "help shape your next lesson",
    "preview / deeper-later wording",
    "validateGeneratedContent",
    // Manual authoring requirement — must travel to every generator agent
    "MANUAL AUTHORING",
    // Dora task and QA requirement — must reference acceptance criteria template
    "acceptance criteria template",
    // Knowledge graph orientation requirement
    "KNOWLEDGE GRAPH ORIENTATION",
  ];

  const captureAcceptance = async (dispatch: () => Promise<unknown>) => {
    let captured = "";
    const fetchMock = vi.fn(async (_url: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}") as { acceptance?: string };
      captured = body.acceptance ?? "";
      return { ok: true, json: async () => ({ id: "task-123" }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AVOCADOCORE_DORA_ENDPOINT", "https://example.test/tasks");
    await dispatch();
    expect(fetchMock).toHaveBeenCalledOnce();
    return captured;
  };

  it("next-lesson generation task includes every enrichment requirement", async () => {
    const event = {
      event: "lesson.completed" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Bayesian Reasoning",
      subject_goals: "Understand base rates",
      subject_criteria: null,
      lesson_id: 7,
      lesson_title: "Priors",
      lesson_goals: ["priors"],
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
      completed_lessons: [],
      discarded_lessons: [],
      workpad_summary: null,
      learner_profile_config: null,
      cross_subject_history: [],
      completed_at: new Date().toISOString(),
    };
    const acceptance = await captureAcceptance(() => doraTaskAdapter.dispatch(event));
    for (const marker of REQUIRED_MARKERS) {
      expect(acceptance).toContain(marker);
    }
  });

  it("replacement (regeneration) task includes every enrichment requirement", async () => {
    const event = {
      event: "lesson.discarded" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Bayesian Reasoning",
      subject_description: null,
      subject_goals: null,
      subject_criteria: null,
      discarded_lesson_id: 42,
      discarded_lesson_title: "Priors",
      discarded_lesson_status: "queued" as const,
      discard_reason: "Too easy",
      mastery_score: 0,
      completed_lessons: [],
      mastery_signals: [],
      workpad_summary: null,
      discarded_at: new Date().toISOString(),
    };
    const acceptance = await captureAcceptance(() =>
      doraTaskRegenerationAdapter.dispatch(event)
    );
    for (const marker of REQUIRED_MARKERS) {
      expect(acceptance).toContain(marker);
    }
  });
});
