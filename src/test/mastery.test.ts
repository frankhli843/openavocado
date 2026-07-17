/**
 * Tests for per-subject mastery computation against an in-memory SQLite DB.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import { computeSubjectMastery, summarizeRecentTrend } from "../lib/mastery";
import { persistAssessment } from "../lib/assessment-store";
import type { AssessmentOutcome } from "../lib/assessment";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(__dirname, "../db/schema.sql"), "utf-8"));
  return db;
}

function seedSubject(db: Database.Database): { subjectId: number; learnerId: number } {
  const userId = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?)").run("u", "U").lastInsertRowid as number;
  const learnerId = db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)").run(userId, "L").lastInsertRowid as number;
  const subjectId = db.prepare("INSERT INTO subjects (learner_id, title) VALUES (?, ?)").run(learnerId, "S").lastInsertRowid as number;
  return { subjectId, learnerId };
}

describe("computeSubjectMastery", () => {
  let db: Database.Database;
  beforeEach(() => { db = createDb(); });
  afterEach(() => { db.close(); });

  it("returns null score and explanation when there is no data", () => {
    const { subjectId, learnerId } = seedSubject(db);
    const m = computeSubjectMastery(db, subjectId, learnerId);
    expect(m.score).toBeNull();
    expect(m.source).toBe("none");
    expect(m.explanation).toMatch(/No mastery data/i);
  });

  it("uses the latest mastery progress point and reports an upward trend", () => {
    const { subjectId, learnerId } = seedSubject(db);
    const ins = db.prepare(
      "INSERT INTO progress_points (learner_id, subject_id, metric, value, recorded_at) VALUES (?, ?, 'mastery', ?, ?)"
    );
    ins.run(learnerId, subjectId, 40, "2026-06-01T00:00:00Z");
    ins.run(learnerId, subjectId, 55, "2026-06-08T00:00:00Z");
    ins.run(learnerId, subjectId, 70, "2026-06-15T00:00:00Z");
    const m = computeSubjectMastery(db, subjectId, learnerId);
    expect(m.score).toBe(70);
    expect(m.source).toBe("progress_points");
    expect(m.trend).toBe("up");
    expect(m.delta).toBe(15);
    expect(m.history).toEqual([40, 55, 70]);
  });

  it("falls back to averaged signal confidence and counts signals", () => {
    const { subjectId, learnerId } = seedSubject(db);
    const ins = db.prepare(
      "INSERT INTO mastery_signals (learner_id, subject_id, signal_type, concept, confidence) VALUES (?, ?, ?, ?, ?)"
    );
    ins.run(learnerId, subjectId, "strength", "a", 0.8);
    ins.run(learnerId, subjectId, "weak_spot", "b", 0.4);
    const m = computeSubjectMastery(db, subjectId, learnerId);
    expect(m.source).toBe("mastery_signals");
    expect(m.score).toBe(60); // (0.8 + 0.4) / 2 * 100
    expect(m.signal_counts.strength).toBe(1);
    expect(m.signal_counts.weak_spot).toBe(1);
  });

  it("describes a windowed rising run in the explanation, not just the last step", () => {
    const { subjectId, learnerId } = seedSubject(db);
    const ins = db.prepare(
      "INSERT INTO progress_points (learner_id, subject_id, metric, value, recorded_at) VALUES (?, ?, 'mastery', ?, ?)"
    );
    ins.run(learnerId, subjectId, 30, "2026-06-01T00:00:00Z");
    ins.run(learnerId, subjectId, 45, "2026-06-08T00:00:00Z");
    ins.run(learnerId, subjectId, 60, "2026-06-15T00:00:00Z");
    ins.run(learnerId, subjectId, 75, "2026-06-22T00:00:00Z");
    const m = computeSubjectMastery(db, subjectId, learnerId);
    expect(m.explanation).toMatch(/rising across your last 4 recorded points/);
  });

  it("counts only UNRESOLVED gaps in the explanation", () => {
    const { subjectId, learnerId } = seedSubject(db);
    const lessonA = db
      .prepare("INSERT INTO lessons (subject_id, title, status, sequence_number, completed_at) VALUES (?, 'A', 'completed', 1, ?)")
      .run(subjectId, "2026-06-01T05:00:00Z").lastInsertRowid as number;
    const lessonB = db
      .prepare("INSERT INTO lessons (subject_id, title, status, sequence_number, completed_at) VALUES (?, 'B', 'completed', 2, ?)")
      .run(subjectId, "2026-06-08T05:00:00Z").lastInsertRowid as number;
    const persist = (
      concept: string,
      difficulty: "easy" | "medium" | "hard",
      outcome: "correct" | "incorrect",
      signalType: "weak_spot" | "strength" | "misconception",
      lessonId: number,
      at: string
    ) => {
      const oc: AssessmentOutcome = {
        outcome,
        tags: [{ name: concept, tag_type: "concept", existing: false }],
        signal: { signal_type: signalType, concept, detail: "", confidence: outcome === "correct" ? 0.8 : 0.3, difficulty },
      };
      const p = persistAssessment(db, {
        learner_id: learnerId,
        subject_id: subjectId,
        lesson_id: lessonId,
        question_id: `q-${concept}-${at}`,
        question_type: "freeform",
        concept,
        difficulty,
        answer_text: "x",
        outcome: oc,
      });
      db.prepare("UPDATE assessment_results SET created_at = ? WHERE id = ?").run(at, p.result_id);
      db.prepare("UPDATE mastery_signals SET created_at = ? WHERE id = ?").run(at, p.signal_id);
    };
    // weak then re-passed -> resolved, must NOT be counted as a gap.
    persist("alpha", "medium", "incorrect", "weak_spot", lessonA, "2026-06-01T02:00:00Z");
    persist("alpha", "medium", "correct", "strength", lessonB, "2026-06-08T02:00:00Z");
    // misconception never retested -> one unresolved gap.
    persist("beta", "medium", "incorrect", "misconception", lessonA, "2026-06-01T03:00:00Z");

    const m = computeSubjectMastery(db, subjectId, learnerId);
    expect(m.explanation).toMatch(/1 unresolved gap to revisit/);
    expect(m.explanation).toMatch(/1 fresh misconception/);
  });

  it("summarizeRecentTrend detects plateau and mixed runs", () => {
    expect(summarizeRecentTrend([50, 51, 50, 51]).direction).toBe("plateaued");
    expect(summarizeRecentTrend([20, 60, 30]).direction).toBe("falling");
    expect(summarizeRecentTrend([10, 40, 20, 55]).direction).toBe("rising");
    expect(summarizeRecentTrend([50]).direction).toBe("unknown");
  });

  it("scopes to the given learner only", () => {
    const { subjectId, learnerId } = seedSubject(db);
    // A different real learner's points on the same subject id must not leak in.
    const otherUser = db.prepare("INSERT INTO users (username, display_name) VALUES (?, ?)").run("u2", "U2").lastInsertRowid as number;
    const otherLearner = db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)").run(otherUser, "L2").lastInsertRowid as number;
    db.prepare(
      "INSERT INTO progress_points (learner_id, subject_id, metric, value) VALUES (?, ?, 'mastery', ?)"
    ).run(otherLearner, subjectId, 99);
    const m = computeSubjectMastery(db, subjectId, learnerId);
    expect(m.score).toBeNull();
  });
});
