/**
 * Tests for per-subject mastery computation against an in-memory SQLite DB.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import { computeSubjectMastery } from "../lib/mastery";

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
