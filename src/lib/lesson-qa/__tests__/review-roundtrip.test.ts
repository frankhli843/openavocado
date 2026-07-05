import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "fs";
import path from "path";
import os from "os";

import { gatherLessonForReview } from "../gather";
import { invokeReviewer } from "../reviewer";
import { storeVerdict, getLatestReview, listReviews } from "../store";
import { reviewLesson, reviewLessonWithRetry } from "../review";

// ─── DB + fixtures ──────────────────────────────────────────────────────────────

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8");
  db.exec(schema);
  return db;
}

function seedSubject(db: InstanceType<typeof Database>): number {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES (?, 'T')")
    .run(`u-${Math.random().toString(36).slice(2)}`).lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'L')")
    .run(userId).lastInsertRowid as number;
  return db
    .prepare("INSERT INTO subjects (learner_id, title) VALUES (?, 'S')")
    .run(learnerId).lastInsertRowid as number;
}

function insertLesson(db: InstanceType<typeof Database>, subjectId: number, title: string): number {
  return db
    .prepare("INSERT INTO lessons (subject_id, title, status, sequence_number) VALUES (?, ?, 'queued', 1)")
    .run(subjectId, title).lastInsertRowid as number;
}

function addActivity(
  db: InstanceType<typeof Database>,
  lessonId: number,
  type: string,
  seq: number,
  content: unknown
) {
  db.prepare(
    "INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content) VALUES (?, ?, 1, ?, ?, ?)"
  ).run(lessonId, type, seq, `${type} ${seq}`, JSON.stringify(content));
}

/** A lesson with severe pre-screen problems: generator-structure transcript + template-placeholder cues. */
function seedBadLesson(db: InstanceType<typeof Database>, subjectId: number): number {
  const id = insertLesson(db, subjectId, "Bad Lesson");
  addActivity(db, id, "audio", 1, {
    script: "Leo: Point 1 is about attention, and the learner should just memorize it.",
    transcript: "Leo: Point 1 is about attention, and the learner should just memorize it.",
    duration_hint: 120,
    orientation_visual: {
      strategy: "timeline",
      cues: [
        { start: 0, end: 20, label: "Input", headline: "", narration: "" },
        { start: 20, end: 40, label: "Transform", headline: "", narration: "" },
        { start: 40, end: 58, label: "Handoff", headline: "", narration: "" },
      ],
    },
  });
  return id;
}

/** A clean lesson with specific content, aligned cues, valid question + matching code signature. */
function seedGoodLesson(db: InstanceType<typeof Database>, subjectId: number): number {
  const id = insertLesson(db, subjectId, "Good Lesson");
  addActivity(db, id, "audio", 1, {
    script:
      "Leo: A residual connection adds the block input back to its output. Maya: Why does that help the gradient? Leo: It gives the signal a direct path so early layers keep learning.",
    transcript:
      "Leo: A residual connection adds the block input back to its output. Maya: Why does that help the gradient? Leo: It gives the signal a direct path so early layers keep learning.",
    duration_hint: 120,
    orientation_visual: {
      strategy: "timeline",
      cues: [
        { start: 0, end: 60, label: "Residual add", headline: "input rejoins output", narration: "add x back" },
        { start: 60, end: 118, label: "Gradient path", headline: "signal reaches early layers", narration: "direct path" },
      ],
    },
  });
  addActivity(db, id, "assessment", 2, {
    questions: [
      { id: "w1", text: "Why do residuals help training?", actual_answer: "They give gradients a direct path", rubric: "Credit if the learner explains gradient flow and signal preservation." },
    ],
    quiz: {
      pass_threshold: 1,
      idk_option: true,
      questions: [
        { id: "mc1", question: "What does a residual connection add?", choices: ["The block input", "A random vector", "Nothing"], correct_index: 0, explanation: "It adds the input back.", concept: "residual", difficulty: "medium" },
      ],
    },
  });
  addActivity(db, id, "practice_code", 3, {
    prompt: "Implement a residual add.",
    starter_code: "def residual(x, fx):\n    pass\n",
    worked_examples: [{ label: "basic", code: "def residual(x, fx):\n    return x + fx\n" }],
    tests: [{ id: "t1", description: "adds", assert: "residual(1, 2) == 3" }],
  });
  return id;
}

// ─── Mock ACP reviewer command ──────────────────────────────────────────────────
// Reads the reviewer payload on stdin and emits a verdict on stdout. It rejects
// when the gathered content carries severe pre-screen flags, else approves — this
// deterministically simulates a semantic reviewer for the round-trip test.

const MOCK_DIR = path.join(os.tmpdir(), `avo-qa-mock-${process.pid}`);
const MOCK_REVIEWER = path.join(MOCK_DIR, "mock-reviewer.mjs");
const MOCK_APPROVE = path.join(MOCK_DIR, "mock-approve.mjs");
const MOCK_MALFORMED = path.join(MOCK_DIR, "mock-malformed.mjs");

const MOCK_REVIEWER_SRC = `
let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  const p = JSON.parse(data);
  const flags = (p.gathered && p.gathered.flags) || [];
  const severe = flags.filter((f) => f.severity === "severe");
  if (severe.length > 0) {
    console.log(JSON.stringify({
      approved: false,
      evidence: [],
      rejections: severe.slice(0, 3).map((f) => ({
        criterion: f.criterion.startsWith("transcript") ? "transcript_quality" : "visual_transcript_alignment",
        quote: f.quote || f.detail,
        explanation: f.detail,
        fix_suggestion: "Address " + f.criterion,
      })),
    }));
  } else {
    console.log("noise line the agent might print");
    console.log(JSON.stringify({ approved: true, evidence: ["cues align with the narration and the code signature matches"], rejections: [] }));
  }
});
`;
const MOCK_APPROVE_SRC = `
let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{ JSON.parse(d); console.log(JSON.stringify({approved:true,evidence:["ok"],rejections:[]})); });
`;
const MOCK_MALFORMED_SRC = `console.log("not a verdict at all");`;

beforeAll(() => {
  mkdirSync(MOCK_DIR, { recursive: true });
  writeFileSync(MOCK_REVIEWER, MOCK_REVIEWER_SRC);
  writeFileSync(MOCK_APPROVE, MOCK_APPROVE_SRC);
  writeFileSync(MOCK_MALFORMED, MOCK_MALFORMED_SRC);
});

afterAll(() => {
  try { rmSync(MOCK_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

const reviewerCmd = () => `node ${MOCK_REVIEWER}`;

// ─── Tests ───────────────────────────────────────────────────────────────────────

describe("gatherLessonForReview (DB)", () => {
  it("flags the bad lesson (generator structure + template placeholder cues) that would have been rejected", () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const badId = seedBadLesson(db, subjectId);
    const gathered = gatherLessonForReview(db, badId);
    const criteria = gathered.flags.map((f) => f.criterion);
    expect(criteria).toContain("transcript_generator_structure");
    expect(criteria).toContain("visual_template_placeholder");
    expect(gathered.flags.some((f) => f.severity === "severe")).toBe(true);
    db.close();
  });

  it("produces no flags for the clean lesson and extracts all content types", () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const goodId = seedGoodLesson(db, subjectId);
    const gathered = gatherLessonForReview(db, goodId);
    expect(gathered.flags).toHaveLength(0);
    expect(gathered.transcripts.length).toBe(1);
    expect(gathered.cueTimelines.length).toBe(1);
    expect(gathered.choiceQuestions.length).toBe(1);
    expect(gathered.writtenQuestions.length).toBe(1);
    expect(gathered.codeExercises.length).toBe(1);
    db.close();
  });

  it("handles a lesson with only a code exercise and no audio (edge case)", () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const id = insertLesson(db, subjectId, "Code Only");
    addActivity(db, id, "practice_code", 1, {
      prompt: "p",
      starter_code: "def f(x):\n    pass\n",
      worked_examples: [{ label: "basic", code: "def f(x):\n    return x\n" }],
      tests: [],
    });
    const gathered = gatherLessonForReview(db, id);
    expect(gathered.transcripts).toHaveLength(0);
    expect(gathered.codeExercises).toHaveLength(1);
    expect(gathered.flags).toHaveLength(0);
    db.close();
  });

  it("throws for a missing lesson", () => {
    const db = freshDb();
    expect(() => gatherLessonForReview(db, 99999)).toThrow(/not found/);
    db.close();
  });
});

describe("invokeReviewer (ACP command contract)", () => {
  it("throws a clear error when no reviewer command is configured", async () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const gathered = gatherLessonForReview(db, seedGoodLesson(db, subjectId));
    delete process.env.AVOCADOCORE_QA_REVIEWER_COMMAND;
    await expect(invokeReviewer(gathered, {})).rejects.toThrow(/AVOCADOCORE_QA_REVIEWER_COMMAND/);
    db.close();
  });

  it("throws when the reviewer emits malformed output", async () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const gathered = gatherLessonForReview(db, seedGoodLesson(db, subjectId));
    await expect(invokeReviewer(gathered, { command: `node ${MOCK_MALFORMED}` })).rejects.toThrow();
    db.close();
  });
});

describe("reviewLesson (store verdict)", () => {
  it("approves the clean lesson and persists the verdict to qa_reviews", async () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const goodId = seedGoodLesson(db, subjectId);
    const result = await reviewLesson(db, goodId, { command: reviewerCmd(), reviewerRef: "test" });
    expect(result.verdict.approved).toBe(true);
    const row = getLatestReview(db, goodId);
    expect(row?.approved).toBe(1);
    expect(row?.reviewer_ref).toBe("test");
    expect(JSON.parse(row!.verdict_json).approved).toBe(true);
    db.close();
  });

  it("rejects the bad lesson with grounded rejections and stores feedback", async () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const badId = seedBadLesson(db, subjectId);
    const result = await reviewLesson(db, badId, { command: reviewerCmd() });
    expect(result.verdict.approved).toBe(false);
    expect(result.verdict.rejections.length).toBeGreaterThan(0);
    const row = getLatestReview(db, badId);
    expect(row?.approved).toBe(0);
    expect(row?.feedback).toBeTruthy();
    db.close();
  });
});

describe("storeVerdict / listReviews", () => {
  it("keeps one row per review pass as an audit trail", async () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const id = seedGoodLesson(db, subjectId);
    storeVerdict(db, { lessonId: id, attempt: 1, verdict: { approved: false, evidence: [], rejections: [{ criterion: "c", quote: "q", explanation: "e", fix_suggestion: "f" }] }, flags: [] });
    storeVerdict(db, { lessonId: id, attempt: 2, verdict: { approved: true, evidence: ["ok"], rejections: [] }, flags: [] });
    const rows = listReviews(db, id);
    expect(rows).toHaveLength(2);
    expect(rows[0].attempt).toBe(1);
    expect(rows[1].approved).toBe(1);
    db.close();
  });
});

describe("reviewLessonWithRetry — round-trip improvement loop", () => {
  it("rejects weak content, regenerates with feedback, and approves the improved lesson", async () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const badId = seedBadLesson(db, subjectId);

    let regenCalls = 0;
    let injectedFeedback = "";
    const regenerate = async (feedback: string) => {
      regenCalls += 1;
      injectedFeedback = feedback;
      // The regenerated lesson is clean → the reviewer will approve it.
      return seedGoodLesson(db, subjectId);
    };

    const outcome = await reviewLessonWithRetry(db, badId, regenerate, {
      command: reviewerCmd(),
      maxAttempts: 3,
    });

    expect(regenCalls).toBe(1); // one regeneration was enough
    expect(injectedFeedback).toContain("REJECTED"); // reviewer feedback was injected
    expect(outcome.approved).toBe(true);
    expect(outcome.attempts).toBe(2);
    expect(outcome.finalLessonId).not.toBe(badId);
    // Two verdicts persisted: the initial rejection and the final approval.
    expect(listReviews(db, badId)).toHaveLength(1);
    expect(listReviews(db, outcome.finalLessonId)).toHaveLength(1);
    db.close();
  });

  it("escalates (approved=false) after exhausting attempts when content stays bad", async () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const badId = seedBadLesson(db, subjectId);
    const regenerate = async () => seedBadLesson(db, subjectId); // always bad
    const outcome = await reviewLessonWithRetry(db, badId, regenerate, {
      command: reviewerCmd(),
      maxAttempts: 3,
    });
    expect(outcome.approved).toBe(false);
    expect(outcome.attempts).toBe(3);
    db.close();
  });

  it("approves on the first attempt without regenerating when content is already good", async () => {
    const db = freshDb();
    const subjectId = seedSubject(db);
    const goodId = seedGoodLesson(db, subjectId);
    let regenCalls = 0;
    const outcome = await reviewLessonWithRetry(db, goodId, async () => { regenCalls += 1; return goodId; }, {
      command: `node ${MOCK_APPROVE}`,
      maxAttempts: 3,
    });
    expect(outcome.approved).toBe(true);
    expect(outcome.attempts).toBe(1);
    expect(regenCalls).toBe(0);
    db.close();
  });
});
