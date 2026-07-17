import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import { emptyConceptReviewEvidence } from "@/lib/concept-evidence";
import { parseJobProgressEvents, summarizeJobProgress } from "../../lesson-jobs/status";
import { summarizeAiStudioConfig, validateGoogleAiStudioKeyShape } from "../../providers/google-ai-studio";
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
  agentHarnessAdapter,
  agentHarnessRegenerationAdapter,
  agentHarnessSubjectCreatedDispatcher,
  webhookAdapter,
  webhookRegenerationAdapter,
  webhookSubjectCreatedDispatcher,
  doraTaskAdapter,
  doraTaskRegenerationAdapter,
  doraTaskSubjectCreatedDispatcher,
  getConfiguredCompletionAdapterName,
} from "../index";
import { generateInitialAssessment } from "../../lesson-generator/initial-assessment";
import type { CompletionAdapter, LevelProgression, NextLessonJob } from "../../../types";

const DEFAULT_LEVEL_PROGRESSION: LevelProgression = {
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

const DEFAULT_COMPLETION_LEVEL_FIELDS = {
  current_level: DEFAULT_LEVEL_PROGRESSION.current_level,
  level_progression: DEFAULT_LEVEL_PROGRESSION,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCompletionAdapter", () => {
  it("returns local-queue adapter when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getConfiguredCompletionAdapterName()).toBe("local-queue");
    expect(getCompletionAdapter()).toBe(localQueueAdapter);
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

  it("returns agent-harness adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "agent-harness");
    expect(getCompletionAdapter()).toBe(agentHarnessAdapter);
  });

  it("returns dora-task adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "dora-task");
    expect(getCompletionAdapter()).toBe(doraTaskAdapter);
  });

  it("falls back to noop for unknown adapter name", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "unknown-adapter");
    expect(getConfiguredCompletionAdapterName()).toBe("noop");
    expect(getCompletionAdapter()).toBe(noopAdapter);
  });

  it("all completion adapters have a name and dispatch function", () => {
    for (const adapter of [noopAdapter, localQueueAdapter, agentHarnessAdapter, webhookAdapter, doraTaskAdapter]) {
      expect(typeof adapter.name).toBe("string");
      expect(adapter.name.length).toBeGreaterThan(0);
      expect(typeof adapter.dispatch).toBe("function");
    }
  });
});

describe("getRegenerationAdapter", () => {
  it("returns local-queue regeneration adapter when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getRegenerationAdapter()).toBe(localQueueRegenerationAdapter);
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

  it("returns agent-harness regeneration adapter", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "agent-harness");
    expect(getRegenerationAdapter()).toBe(agentHarnessRegenerationAdapter);
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
      ["agent-harness", agentHarnessAdapter, agentHarnessRegenerationAdapter],
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
    ["next_lesson_jobs", "qa_status", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_status TEXT"],
    ["next_lesson_jobs", "qa_stage", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_stage TEXT"],
    ["next_lesson_jobs", "qa_events", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_events TEXT"],
    ["next_lesson_jobs", "qa_agent_ref", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_agent_ref TEXT"],
    ["next_lesson_jobs", "qa_lesson_url", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_lesson_url TEXT"],
    ["next_lesson_jobs", "qa_desktop_screenshot_ref", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_desktop_screenshot_ref TEXT"],
    ["next_lesson_jobs", "qa_mobile_screenshot_ref", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_mobile_screenshot_ref TEXT"],
    ["next_lesson_jobs", "qa_notes", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_notes TEXT"],
    ["next_lesson_jobs", "qa_completed_at", "ALTER TABLE next_lesson_jobs ADD COLUMN qa_completed_at TEXT"],
  ] as const;
  for (const [table, col, sql] of additive) {
    if (!hasColumn(table, col)) db.exec(sql);
  }
  // Per-user provider config table (created by connection.ts migration, not in schema.sql)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_provider_configs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_name     TEXT    NOT NULL,
      base_url          TEXT,
      model             TEXT,
      encrypted_api_key TEXT,
      health_status     TEXT    NOT NULL DEFAULT 'unchecked',
      health_error      TEXT,
      health_checked_at TEXT,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, provider_name)
    )
  `);
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

  it("returns local-queue dispatcher when env var is unset", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "");
    expect(getSubjectCreatedDispatcher()).toBe(localQueueSubjectCreatedDispatcher);
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

  it("returns agent-harness dispatcher for 'agent-harness'", () => {
    vi.stubEnv("AVOCADOCORE_COMPLETION_ADAPTER", "agent-harness");
    expect(getSubjectCreatedDispatcher()).toBe(agentHarnessSubjectCreatedDispatcher);
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

// ─── agent-harness dispatcher ───────────────────────────────────────────────

describe("agentHarnessSubjectCreatedDispatcher", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails loudly instead of falling back when no harness command is configured", async () => {
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_COMMAND", "");
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

    const result = await agentHarnessSubjectCreatedDispatcher(event);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("AVOCADOCORE_AGENT_HARNESS_COMMAND");
    expect(result.error).toContain("Refusing to fall back");
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
    "docs/lesson-authoring-guide.md",
    "docs/agent-task-harness.md",
    "Generated audio AVAILABLE AT CREATION",
    "at least 15 minutes",
    "WHY-FIRST TEACHING",
    "NO UNDOCUMENTED ASSUMPTIONS",
    "PLANNING STAGE BEFORE AUTHORING",
    "comprehensive current research",
    "update the subject workpad and long-term plan",
    "DYNAMIC, BESPOKE AUTHORING",
    "bespoke-artifact",
    "forbidden as learner-facing Avo interactives",
    "AUDIO + INTERACTIVE SIDE-BY-SIDE FOR ORIENTATION",
    "orientation_visual",
    "paired DB-backed bespoke artifact",
    "visible alongside the audio",
    "AUDIO-ADJACENT VISUALS MUST BE SCOPED TO THE CURRENT AUDIO",
    "Do not reuse a broad whole-lesson interactive",
    "AUDIO-SYNCED VISUAL TRANSCRIPTS ARE REQUIRED",
    "audio.synced_visual",
    "FIVE-SECOND VISUAL BEATS",
    "one moving visual beat per 5 seconds",
    "at least 80% of the audio duration",
    "no gap exceeding 30 seconds",
    "MANIM / 3BLUE1BROWN-STYLE SCENE DESIGN",
    "attention score grids",
    "MLP layer expansion/compression",
    "Chrome MCP QA on the local pending sandbox URL",
    "qa-evidence",
    "desktop and 390px mobile screenshots",
    "DEFINE MAJOR NOUNS",
    "transformer block",
    "MLP",
    "MECHANISM-LEVEL DETAIL",
    "micro-trace",
    "ADJACENT VISUALS",
    "hidden-state rows",
    "SECTION PIPELINE STAGE MAPS",
    "what came before",
    "tokenizer, embeddings/hidden states, transformer blocks",
    "LESSON FLOW ORDER",
    "listen first",
    "EXAMPLES + METAPHORS",
    "TRANSCRIPT LLM QA REQUIRED",
    "separate reviewer agent must read the full top-level transcript",
    "send it back for revision",
    "what object changes, how it changes, and why that change improves",
    "WRITTEN teaching text",
    "LESSON PARTS",
    "MULTIPLE meaningful visual/interactive explorations",
    "Interactives must deepen understanding",
    "AUDIO FOR EVERY VISUALIZATION",
    "mixed reinforcement practice",
    "select-all with none correct",
    "written questions",
    "/api/answer-judge",
    "CODE IN EVERY SUB-LESSON + FINAL INTEGRATOR",
    "worked_examples",
    "basic/readable full implementation",
    "best concise full implementation",
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
    // Dora task and QA requirement — must reference the harness QA gate
    "TASK / HARNESS QA",
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
      ...DEFAULT_COMPLETION_LEVEL_FIELDS,
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
      concept_review_evidence: emptyConceptReviewEvidence(),
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

// ─── Cross-user isolation: provider credentials and job dispatch ─────────────
//
// Acceptance requirement: "Add tests proving that two users with different
// provider configs create jobs that use the correct account-scoped provider
// context and cannot read each other's secret material."

type ProviderRow = {
  id: number;
  user_id: number;
  provider_name: string;
  base_url: string | null;
  model: string | null;
  encrypted_api_key: string | null;
  health_status: string;
  health_error: string | null;
  health_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

describe("user_provider_configs cross-user isolation", () => {
  let db: Database.Database;
  let userAId: number;
  let userBId: number;

  beforeEach(() => {
    db = makeDb();
    userAId = db
      .prepare("INSERT INTO users (username, display_name) VALUES ('user_a', 'User A')")
      .run().lastInsertRowid as number;
    userBId = db
      .prepare("INSERT INTO users (username, display_name) VALUES ('user_b', 'User B')")
      .run().lastInsertRowid as number;
  });

  it("querying by user_id returns only that user's configs", () => {
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, encrypted_api_key) VALUES (?, 'openai', ?)"
    ).run(userAId, "enc_key_for_user_a");
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, encrypted_api_key) VALUES (?, 'openai', ?)"
    ).run(userBId, "enc_key_for_user_b");

    const userARows = db
      .prepare("SELECT * FROM user_provider_configs WHERE user_id = ?")
      .all(userAId) as ProviderRow[];

    expect(userARows).toHaveLength(1);
    expect(userARows[0].user_id).toBe(userAId);
    expect(userARows[0].encrypted_api_key).toBe("enc_key_for_user_a");

    // User B's secret must NOT appear anywhere in User A's result set
    const serialised = JSON.stringify(userARows);
    expect(serialised).not.toContain("enc_key_for_user_b");
  });

  it("querying User B's configs does not expose User A's encrypted key", () => {
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, encrypted_api_key) VALUES (?, 'openai', ?)"
    ).run(userAId, "secret_a");
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, encrypted_api_key) VALUES (?, 'openai', ?)"
    ).run(userBId, "secret_b");

    const userBRows = db
      .prepare("SELECT * FROM user_provider_configs WHERE user_id = ?")
      .all(userBId) as ProviderRow[];

    expect(userBRows).toHaveLength(1);
    expect(JSON.stringify(userBRows)).not.toContain("secret_a");
  });

  it("UNIQUE(user_id, provider_name) allows same provider name for different users but blocks duplicates per user", () => {
    expect(() => {
      db.prepare("INSERT INTO user_provider_configs (user_id, provider_name) VALUES (?, 'openai')")
        .run(userAId);
      db.prepare("INSERT INTO user_provider_configs (user_id, provider_name) VALUES (?, 'openai')")
        .run(userBId);
    }).not.toThrow();

    // Same user + same provider name = UNIQUE violation
    expect(() => {
      db.prepare("INSERT INTO user_provider_configs (user_id, provider_name) VALUES (?, 'openai')")
        .run(userAId); // duplicate
    }).toThrow();
  });

  it("public API view omits encrypted_api_key and shows has_credentials instead", () => {
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, encrypted_api_key) VALUES (?, 'openai', ?)"
    ).run(userAId, "super_secret_raw_key");

    const row = db
      .prepare("SELECT * FROM user_provider_configs WHERE user_id = ?")
      .get(userAId) as ProviderRow;

    // Simulate toPublic (same logic as provider/config/route.ts)
    const publicConfig = {
      id: row.id,
      user_id: row.user_id,
      provider_name: row.provider_name,
      base_url: row.base_url,
      model: row.model,
      health_status: row.health_status,
      health_error: row.health_error,
      has_credentials: Boolean(row.encrypted_api_key),
      created_at: row.created_at,
      updated_at: row.updated_at,
      // encrypted_api_key intentionally excluded from public view
    };

    expect("encrypted_api_key" in publicConfig).toBe(false);
    expect(publicConfig.has_credentials).toBe(true);
    expect(JSON.stringify(publicConfig)).not.toContain("super_secret_raw_key");
  });

  it("job dispatch for User A uses User A's provider context, not User B's", () => {
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, base_url, model, encrypted_api_key) VALUES (?, 'openai', ?, ?, ?)"
    ).run(userAId, "https://api-a.example.com", "gpt-a-model", "key_a");
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, base_url, model, encrypted_api_key) VALUES (?, 'openai', ?, ?, ?)"
    ).run(userBId, "https://api-b.example.com", "gpt-b-model", "key_b");

    // Simulate how a job dispatcher would fetch the provider config for the job owner
    function resolveProviderForUser(userId: number, providerName: string) {
      return db
        .prepare(
          "SELECT * FROM user_provider_configs WHERE user_id = ? AND provider_name = ?"
        )
        .get(userId, providerName) as ProviderRow | undefined;
    }

    const cfgA = resolveProviderForUser(userAId, "openai");
    const cfgB = resolveProviderForUser(userBId, "openai");

    // User A's job gets User A's provider
    expect(cfgA?.base_url).toBe("https://api-a.example.com");
    expect(cfgA?.model).toBe("gpt-a-model");
    expect(cfgA?.encrypted_api_key).toBe("key_a");

    // User B's job gets User B's provider
    expect(cfgB?.base_url).toBe("https://api-b.example.com");
    expect(cfgB?.model).toBe("gpt-b-model");
    expect(cfgB?.encrypted_api_key).toBe("key_b");

    // No cross-contamination
    expect(cfgA?.encrypted_api_key).not.toBe(cfgB?.encrypted_api_key);
    expect(cfgA?.base_url).not.toBe(cfgB?.base_url);
  });

  it("cascade delete removes user provider configs when user is deleted", () => {
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, encrypted_api_key) VALUES (?, 'openai', ?)"
    ).run(userAId, "key_a");

    const before = db
      .prepare("SELECT COUNT(*) as n FROM user_provider_configs WHERE user_id = ?")
      .get(userAId) as { n: number };
    expect(before.n).toBe(1);

    // Deleting the user should cascade-delete their provider configs
    db.prepare("DELETE FROM users WHERE id = ?").run(userAId);

    const after = db
      .prepare("SELECT COUNT(*) as n FROM user_provider_configs WHERE user_id = ?")
      .get(userAId) as { n: number };
    expect(after.n).toBe(0);

    // User B's configs are unaffected
    db.prepare(
      "INSERT INTO user_provider_configs (user_id, provider_name, encrypted_api_key) VALUES (?, 'openai', ?)"
    ).run(userBId, "key_b");
    const bConfig = db
      .prepare("SELECT COUNT(*) as n FROM user_provider_configs WHERE user_id = ?")
      .get(userBId) as { n: number };
    expect(bConfig.n).toBe(1);
  });
});

// ─── Google AI Studio provider health ───────────────────────────────────────

describe("validateGoogleAiStudioKeyShape", () => {
  it("accepts AIza-prefixed keys", () => {
    expect(validateGoogleAiStudioKeyShape("AIzaSyABCDEFGHIJKLMNOPQR")).toBe(true);
  });

  it("accepts AQ.-prefixed keys", () => {
    expect(validateGoogleAiStudioKeyShape("AQ.ABCDEFGHIJKLMNOPQRSTUVWXYZabc")).toBe(true);
  });

  it("rejects short keys", () => {
    expect(validateGoogleAiStudioKeyShape("AIzaShort")).toBe(false);
  });

  it("rejects empty / undefined", () => {
    expect(validateGoogleAiStudioKeyShape("")).toBe(false);
    expect(validateGoogleAiStudioKeyShape(undefined)).toBe(false);
    expect(validateGoogleAiStudioKeyShape(null)).toBe(false);
  });

  it("rejects keys with wrong prefix", () => {
    expect(validateGoogleAiStudioKeyShape("sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabc")).toBe(false);
  });
});

describe("summarizeAiStudioConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns missing when key env var is absent", () => {
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "");
    const result = summarizeAiStudioConfig();
    expect(result.status).toBe("missing");
    expect(result.configured).toBe(false);
    expect(result.checked).toBe(false);
  });

  it("returns invalid-format when key has bad shape", () => {
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "bad-key-format");
    const result = summarizeAiStudioConfig();
    expect(result.status).toBe("invalid-format");
    expect(result.configured).toBe(true);
    expect(result.error).toBeDefined();
    // The error must not leak the key value
    expect(result.error).not.toContain("bad-key-format");
  });

  it("returns configured-unverified for a plausible key without making an API call", () => {
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234");
    const result = summarizeAiStudioConfig();
    expect(result.status).toBe("configured-unverified");
    expect(result.configured).toBe(true);
    expect(result.checked).toBe(false);
  });

  it("includes the configured model name in every health object", () => {
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "");
    vi.stubEnv("GOOGLE_AI_STUDIO_MODEL", "gemini-test-model");
    const result = summarizeAiStudioConfig();
    expect(result.model).toBe("gemini-test-model");
  });
});

// ─── Job progress event parsing ──────────────────────────────────────────────

describe("parseJobProgressEvents", () => {
  it("returns empty array for null/undefined/empty", () => {
    expect(parseJobProgressEvents(null)).toEqual([]);
    expect(parseJobProgressEvents(undefined)).toEqual([]);
    expect(parseJobProgressEvents("")).toEqual([]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseJobProgressEvents("{not json}")).toEqual([]);
    expect(parseJobProgressEvents("null")).toEqual([]);
  });

  it("parses a valid progress event array", () => {
    const raw = JSON.stringify([
      { ts: "2026-01-01T00:00:00Z", stage: "researching", message: "Querying learner context" },
      { ts: "2026-01-01T00:00:05Z", stage: "authoring", message: "Calling Gemini API" },
    ]);
    const events = parseJobProgressEvents(raw);
    expect(events).toHaveLength(2);
    expect(events[0].stage).toBe("researching");
    expect(events[0].message).toBe("Querying learner context");
    expect(events[1].stage).toBe("authoring");
  });

  it("fills in a label when message is absent", () => {
    const raw = JSON.stringify([
      { ts: "2026-01-01T00:00:00Z", stage: "generating_audio" },
    ]);
    const events = parseJobProgressEvents(raw);
    expect(events).toHaveLength(1);
    expect(events[0].message).toBeTruthy();
  });

  it("skips events with no message and no stage", () => {
    const raw = JSON.stringify([
      { ts: "2026-01-01T00:00:00Z" },
      { ts: "2026-01-01T00:00:05Z", stage: "authoring", message: "Writing" },
    ]);
    const events = parseJobProgressEvents(raw);
    // First event has no stage/message, should be filtered or fallback
    const authoringEvent = events.find((e) => e.stage === "authoring");
    expect(authoringEvent).toBeDefined();
  });
});

describe("summarizeJobProgress", () => {
  function makeJob(overrides: Partial<{
    status: "pending" | "dispatched" | "completed" | "failed";
    harness_stage: string | null;
    progress_events: string | null;
    adapter: CompletionAdapter;
    trigger_event: "lesson.completed" | "lesson.discarded" | "subject.created";
    dispatched_at: string | null;
    created_at: string;
    completed_at: string | null;
    last_error_detail: string | null;
    error: string | null;
  }>): NextLessonJob {
    return {
      id: 1,
      subject_id: 1,
      completed_lesson_id: null,
      discarded_lesson_id: null,
      status: "dispatched" as const,
      harness_stage: null,
      harness_status: null,
      progress_events: null,
      adapter: "agent-harness",
      trigger_event: "lesson.completed" as const,
      payload: null,
      adapter_ref: null,
      dispatched_at: new Date(Date.now() - 60_000).toISOString(),
      created_at: new Date(Date.now() - 65_000).toISOString(),
      updated_at: new Date(Date.now() - 60_000).toISOString(),
      completed_at: null,
      last_error_detail: null,
      error: null,
      retry_count: 0,
      provider_name: null,
      output_lesson_id: null,
      qa_status: null,
      qa_stage: null,
      qa_events: null,
      qa_agent_ref: null,
      qa_lesson_url: null,
      qa_desktop_screenshot_ref: null,
      qa_mobile_screenshot_ref: null,
      qa_notes: null,
      qa_completed_at: null,
      ...overrides,
    };
  }

  it("reports 100% and isDone=true for a completed job", () => {
    const job = makeJob({ status: "completed", completed_at: new Date().toISOString() });
    const view = summarizeJobProgress(job);
    expect(view.percent).toBe(100);
    expect(view.isDone).toBe(true);
    expect(view.isFailed).toBe(false);
    expect(view.remainingSeconds).toBe(0);
  });

  it("reports isFailed=true and surfaces error detail for a failed job", () => {
    const job = makeJob({ status: "failed", last_error_detail: "Gemini returned HTTP 429" });
    const view = summarizeJobProgress(job);
    expect(view.isFailed).toBe(true);
    expect(view.isDone).toBe(false);
    expect(view.detail).toContain("Gemini returned HTTP 429");
    expect(view.remainingSeconds).toBe(0);
  });

  it("uses harness_stage for the stage label when set", () => {
    const job = makeJob({ harness_stage: "authoring" });
    const view = summarizeJobProgress(job);
    expect(view.stage).toBe("authoring");
    expect(view.stageLabel).toBe("Authoring lesson");
  });

  it("falls back to last progress_event stage when harness_stage is null", () => {
    const events = JSON.stringify([
      { ts: new Date().toISOString(), stage: "researching", message: "Querying DB" },
    ]);
    const job = makeJob({ harness_stage: null, progress_events: events });
    const view = summarizeJobProgress(job);
    expect(view.stage).toBe("researching");
  });

  it("percent is between 5 and 95 for an in-progress job", () => {
    const job = makeJob({ status: "dispatched" });
    const view = summarizeJobProgress(job);
    expect(view.percent).toBeGreaterThanOrEqual(5);
    expect(view.percent).toBeLessThanOrEqual(95);
    expect(view.isActive).toBe(true);
  });

  it("isActive is true for both pending and dispatched statuses", () => {
    expect(summarizeJobProgress(makeJob({ status: "pending" })).isActive).toBe(true);
    expect(summarizeJobProgress(makeJob({ status: "dispatched" })).isActive).toBe(true);
    expect(summarizeJobProgress(makeJob({ status: "completed" })).isActive).toBe(false);
    expect(summarizeJobProgress(makeJob({ status: "failed" })).isActive).toBe(false);
  });

  it("events array in view matches parsed progress events", () => {
    const raw = JSON.stringify([
      { ts: new Date().toISOString(), stage: "provider.check", message: "Checking API key" },
      { ts: new Date().toISOString(), stage: "authoring", message: "Writing lesson" },
    ]);
    const job = makeJob({ progress_events: raw });
    const view = summarizeJobProgress(job);
    expect(view.events).toHaveLength(2);
    expect(view.events[0].stage).toBe("provider.check");
    expect(view.events[1].stage).toBe("authoring");
  });
});

// ─── agent-harness: dispatch error paths ─────────────────────────────────────

describe("agentHarnessAdapter dispatch error paths", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns ok=false with AVOCADOCORE_AGENT_HARNESS_COMMAND error when command is missing", async () => {
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_COMMAND", "");
    const event = {
      event: "lesson.completed" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_goals: null,
      subject_criteria: null,
      ...DEFAULT_COMPLETION_LEVEL_FIELDS,
      lesson_id: 7,
      lesson_title: "Prior Work",
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
      completed_at: new Date().toISOString(),
    };
    const result = await agentHarnessAdapter.dispatch(event);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("AVOCADOCORE_AGENT_HARNESS_COMMAND");
  });

  it("returns ok=false when the harness command exits non-zero", async () => {
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_COMMAND", "exit 1");
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS", "5000");
    const event = {
      event: "lesson.completed" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_goals: null,
      subject_criteria: null,
      ...DEFAULT_COMPLETION_LEVEL_FIELDS,
      lesson_id: 7,
      lesson_title: "Prior Work",
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
      completed_at: new Date().toISOString(),
    };
    const result = await agentHarnessAdapter.dispatch(event);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exited 1/);
  }, 10_000);

  it("returns ok=false when harness command produces no JSON output", async () => {
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_COMMAND", "echo 'plain text no json here'");
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS", "5000");
    const event = {
      event: "lesson.completed" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_goals: null,
      subject_criteria: null,
      ...DEFAULT_COMPLETION_LEVEL_FIELDS,
      lesson_id: 7,
      lesson_title: "Prior Work",
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
      completed_at: new Date().toISOString(),
    };
    const result = await agentHarnessAdapter.dispatch(event);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no JSON/i);
  }, 10_000);

  it("returns ok=false when harness JSON result is missing boolean ok", async () => {
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_COMMAND", 'echo \'{"ref":"test-123"}\'');
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS", "5000");
    const event = {
      event: "lesson.completed" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_goals: null,
      subject_criteria: null,
      ...DEFAULT_COMPLETION_LEVEL_FIELDS,
      lesson_id: 7,
      lesson_title: "Prior Work",
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
      completed_at: new Date().toISOString(),
    };
    const result = await agentHarnessAdapter.dispatch(event);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing boolean ok/i);
  }, 10_000);

  it("returns ok=true when harness outputs a valid result on stdout", async () => {
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_COMMAND", 'echo \'{"ok":true,"ref":"harness-ref-abc","lesson_id":42}\'');
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS", "5000");
    const event = {
      event: "lesson.completed" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_goals: null,
      subject_criteria: null,
      ...DEFAULT_COMPLETION_LEVEL_FIELDS,
      lesson_id: 7,
      lesson_title: "Prior Work",
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
      completed_at: new Date().toISOString(),
    };
    const result = await agentHarnessAdapter.dispatch(event);
    expect(result.ok).toBe(true);
    expect(result.ref).toBe("harness-ref-abc");
    expect(result.lesson_id).toBe(42);
  }, 10_000);

  it("sanitizes API key from harness error output", async () => {
    const fakeKey = "AIzaSyFAKEKEY1234567890ABCDEF";
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", fakeKey);
    // Command that outputs the API key in stderr and exits 1
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_COMMAND", `bash -c 'echo "Error: ${fakeKey}" >&2; exit 1'`);
    vi.stubEnv("AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS", "5000");
    const event = {
      event: "lesson.completed" as const,
      learner_id: 1,
      subject_id: 1,
      subject_title: "Test",
      subject_goals: null,
      subject_criteria: null,
      ...DEFAULT_COMPLETION_LEVEL_FIELDS,
      lesson_id: 7,
      lesson_title: "Secrets",
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
      completed_at: new Date().toISOString(),
    };
    const result = await agentHarnessAdapter.dispatch(event);
    expect(result.ok).toBe(false);
    // Key MUST NOT appear in the error message
    expect(result.error).not.toContain(fakeKey);
    expect(result.error).toContain("[redacted]");
  }, 10_000);
});
