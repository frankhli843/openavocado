/**
 * Tests for the per-concept review evidence rollup against an in-memory DB.
 *
 * Evidence is seeded through persistAssessment (the real validated write path:
 * assessment_results + tags + mastery_signals), then created_at is stamped to
 * fixed timestamps so ordering and resolution are deterministic.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import { persistAssessment } from "./assessment-store";
import type { AssessmentOutcome } from "./assessment";
import type { Difficulty, SignalType } from "@/types";
import { computeConceptEvidence, toReviewEvidence } from "./concept-evidence";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(__dirname, "../db/schema.sql"), "utf-8"));
  return db;
}

function seedSubject(db: Database.Database): { subjectId: number; learnerId: number } {
  const userId = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?)").run("u", "U")
    .lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
    .run(userId, "L").lastInsertRowid as number;
  const subjectId = db.prepare("INSERT INTO subjects (learner_id, title) VALUES (?, ?)").run(learnerId, "S")
    .lastInsertRowid as number;
  return { subjectId, learnerId };
}

function seedCompletedLesson(
  db: Database.Database,
  subjectId: number,
  seq: number,
  completedAt: string
): number {
  return db
    .prepare(
      `INSERT INTO lessons (subject_id, title, status, sequence_number, completed_at)
       VALUES (?, ?, 'completed', ?, ?)`
    )
    .run(subjectId, `Lesson ${seq}`, seq, completedAt).lastInsertRowid as number;
}

/**
 * Record one assessment occasion for a concept and stamp its timestamps.
 * outcome/signalType drive the derived evidence; the same concept name reuses
 * the same global tag so resolution joins across occasions.
 */
function seedEvidence(
  db: Database.Database,
  args: {
    learnerId: number;
    subjectId: number;
    lessonId: number;
    concept: string;
    difficulty: Difficulty | null;
    outcome: "correct" | "incorrect" | "idk";
    signalType: SignalType;
    at: string;
  }
): void {
  const outcome: AssessmentOutcome = {
    outcome: args.outcome,
    tags: [{ name: args.concept, tag_type: args.signalType === "misconception" ? "misconception" : "concept", existing: false }],
    signal: {
      signal_type: args.signalType,
      concept: args.concept,
      detail: "",
      confidence: args.outcome === "correct" ? 0.8 : 0.3,
      difficulty: args.difficulty,
    },
  };
  const persisted = persistAssessment(db, {
    learner_id: args.learnerId,
    subject_id: args.subjectId,
    lesson_id: args.lessonId,
    question_id: `q-${args.concept}-${args.at}`,
    question_type: "freeform",
    concept: args.concept,
    difficulty: args.difficulty,
    answer_text: "x",
    outcome,
  });
  db.prepare("UPDATE assessment_results SET created_at = ? WHERE id = ?").run(args.at, persisted.result_id);
  db.prepare("UPDATE mastery_signals SET created_at = ? WHERE id = ?").run(args.at, persisted.signal_id);
}

describe("computeConceptEvidence", () => {
  let db: Database.Database;
  let subjectId: number;
  let learnerId: number;
  beforeEach(() => {
    db = createDb();
    const s = seedSubject(db);
    subjectId = s.subjectId;
    learnerId = s.learnerId;
  });
  afterEach(() => db.close());

  it("returns an empty rollup with no evidence", () => {
    const r = computeConceptEvidence(db, subjectId, learnerId);
    expect(r.review_candidates).toEqual([]);
    expect(r.healthy).toEqual([]);
    expect(r.summary.total_concepts).toBe(0);
    expect(r.summary.unresolved_gap_count).toBe(0);
  });

  it("classifies the four canonical fixture states and applies resolution", () => {
    const A = seedCompletedLesson(db, subjectId, 1, "2026-06-01T05:00:00Z");
    seedCompletedLesson(db, subjectId, 2, "2026-06-08T05:00:00Z");
    seedCompletedLesson(db, subjectId, 3, "2026-06-15T05:00:00Z");
    const D = seedCompletedLesson(db, subjectId, 4, "2026-06-22T05:00:00Z");

    // alpha: weak in lesson A, later re-passed at equal difficulty in lesson D.
    seedEvidence(db, { learnerId, subjectId, lessonId: A, concept: "alpha", difficulty: "medium", outcome: "incorrect", signalType: "weak_spot", at: "2026-06-01T02:00:00Z" });
    seedEvidence(db, { learnerId, subjectId, lessonId: D, concept: "alpha", difficulty: "medium", outcome: "correct", signalType: "strength", at: "2026-06-22T02:00:00Z" });

    // beta: misconception in lesson A, never retested.
    seedEvidence(db, { learnerId, subjectId, lessonId: A, concept: "beta", difficulty: "medium", outcome: "incorrect", signalType: "misconception", at: "2026-06-01T03:00:00Z" });

    // gamma: passed once in lesson A, never retested across three later lessons.
    seedEvidence(db, { learnerId, subjectId, lessonId: A, concept: "gamma", difficulty: "easy", outcome: "correct", signalType: "strength", at: "2026-06-01T04:00:00Z" });

    // delta: brand-new concept tested correctly in the latest lesson.
    seedEvidence(db, { learnerId, subjectId, lessonId: D, concept: "delta", difficulty: "easy", outcome: "correct", signalType: "strength", at: "2026-06-22T03:00:00Z" });

    const r = computeConceptEvidence(db, subjectId, learnerId);
    const byConcept = new Map(
      [...r.review_candidates, ...r.healthy].map((row) => [row.concept, row])
    );

    // alpha: resolved weakness -> healthy, not a gap.
    const alpha = byConcept.get("alpha")!;
    expect(alpha.review_priority).toBe("healthy");
    expect(alpha.resolved_signal_types).toContain("weak_spot");
    expect(alpha.lessons_since_tested).toBe(0);
    expect(alpha.recent_correct).toBe(1);
    expect(alpha.open_signal_counts.some((s) => s.signal_type === "weak_spot")).toBe(false);

    // beta: unresolved misconception -> fresh_misconception gap.
    const beta = byConcept.get("beta")!;
    expect(beta.review_priority).toBe("fresh_misconception");
    expect(beta.open_signal_counts.some((s) => s.signal_type === "misconception")).toBe(true);
    expect(beta.lessons_since_tested).toBe(3);

    // gamma: no weakness, untested across several later lessons.
    const gamma = byConcept.get("gamma")!;
    expect(gamma.review_priority).toBe("untested_recently");
    expect(gamma.lessons_since_tested).toBe(3);

    // delta: brand-new, tested correctly in the latest lesson.
    const delta = byConcept.get("delta")!;
    expect(delta.review_priority).toBe("healthy");
    expect(delta.lessons_since_tested).toBe(0);
    expect(delta.resolved_signal_types).toEqual([]);

    // Summary + ordering.
    expect(r.summary.total_concepts).toBe(4);
    expect(r.summary.unresolved_gap_count).toBe(1); // beta only
    expect(r.summary.fresh_misconception).toBe(1);
    expect(r.summary.untested_recently).toBe(1);
    expect(r.summary.healthy).toBe(2);
    expect(r.review_candidates.map((c) => c.review_priority)).toEqual([
      "fresh_misconception",
      "untested_recently",
    ]);
    expect(r.review_candidates[0].concept).toBe("beta");
  });

  it("requires equal-or-higher difficulty to resolve a weakness", () => {
    const A = seedCompletedLesson(db, subjectId, 1, "2026-06-01T05:00:00Z");
    const B = seedCompletedLesson(db, subjectId, 2, "2026-06-08T05:00:00Z");
    // Weak at hard, later correct only at easy -> NOT resolved.
    seedEvidence(db, { learnerId, subjectId, lessonId: A, concept: "kappa", difficulty: "hard", outcome: "incorrect", signalType: "weak_spot", at: "2026-06-01T02:00:00Z" });
    seedEvidence(db, { learnerId, subjectId, lessonId: B, concept: "kappa", difficulty: "easy", outcome: "correct", signalType: "strength", at: "2026-06-08T02:00:00Z" });

    const r = computeConceptEvidence(db, subjectId, learnerId);
    const kappa = [...r.review_candidates, ...r.healthy].find((row) => row.concept === "kappa")!;
    expect(kappa.review_priority).toBe("stale_weak_spot");
    expect(kappa.resolved_signal_types).toEqual([]);
    expect(r.summary.unresolved_gap_count).toBe(1);
  });

  it("scopes to the given learner only", () => {
    const A = seedCompletedLesson(db, subjectId, 1, "2026-06-01T05:00:00Z");
    seedEvidence(db, { learnerId, subjectId, lessonId: A, concept: "beta", difficulty: "medium", outcome: "incorrect", signalType: "misconception", at: "2026-06-01T03:00:00Z" });
    const otherUser = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?)").run("u2", "U2")
      .lastInsertRowid as number;
    const otherLearner = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(otherUser, "L2").lastInsertRowid as number;
    const r = computeConceptEvidence(db, subjectId, otherLearner);
    expect(r.summary.total_concepts).toBe(0);
  });

  it("toReviewEvidence caps candidates and keeps summary", () => {
    const A = seedCompletedLesson(db, subjectId, 1, "2026-06-01T05:00:00Z");
    for (let i = 0; i < 10; i++) {
      seedEvidence(db, {
        learnerId,
        subjectId,
        lessonId: A,
        concept: `m${i}`,
        difficulty: "medium",
        outcome: "incorrect",
        signalType: "misconception",
        at: `2026-06-01T0${i < 10 ? "3" : "4"}:0${i}:00Z`,
      });
    }
    const ev = toReviewEvidence(computeConceptEvidence(db, subjectId, learnerId), 8);
    expect(ev.review_candidates.length).toBe(8);
    expect(ev.summary.fresh_misconception).toBe(10);
    expect(ev.summary.unresolved_gap_count).toBe(10);
  });
});
