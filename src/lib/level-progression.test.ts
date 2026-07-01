import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import { evaluateSubjectLevelProgression } from "@/lib/level-progression";
import type { LevelName } from "@/types";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8");
  db.exec(schema);
  return db;
}

function seedLearner(db: Database.Database) {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('phase-user', 'Phase User')")
    .run().lastInsertRowid as number;
  return db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Phase Learner')")
    .run(userId).lastInsertRowid as number;
}

function seedSubject(db: Database.Database, learnerId: number, level: LevelName) {
  return db
    .prepare("INSERT INTO subjects (learner_id, title, current_level) VALUES (?, 'Transformers', ?)")
    .run(learnerId, level).lastInsertRowid as number;
}

function seedCompletedLessons(db: Database.Database, subjectId: number, count: number) {
  for (let i = 1; i <= count; i++) {
    db.prepare(
      "INSERT INTO lessons (subject_id, title, status, sequence_number, completed_at) VALUES (?, ?, 'completed', ?, datetime('now'))"
    ).run(subjectId, `Lesson ${i}`, i);
  }
}

function seedMastery(db: Database.Database, learnerId: number, subjectId: number, score: number) {
  db.prepare(
    "INSERT INTO progress_points (learner_id, subject_id, metric, value) VALUES (?, ?, 'mastery', ?)"
  ).run(learnerId, subjectId, score);
}

function seedAssessment(
  db: Database.Database,
  learnerId: number,
  subjectId: number,
  rows: Array<{ difficulty: "easy" | "medium" | "hard"; outcome: "correct" | "incorrect" | "idk" }>
) {
  rows.forEach((row, index) => {
    db.prepare(
      `INSERT INTO assessment_results
         (learner_id, subject_id, question_id, question_type, concept, difficulty, outcome)
       VALUES (?, ?, ?, 'mc', 'phase-evidence', ?, ?)`
    ).run(learnerId, subjectId, `q-${index}`, row.difficulty, row.outcome);
  });
}

function seedSignals(db: Database.Database, learnerId: number, subjectId: number, positive: number, review: number) {
  for (let i = 0; i < positive; i++) {
    db.prepare(
      `INSERT INTO mastery_signals (learner_id, subject_id, signal_type, concept, confidence)
       VALUES (?, ?, 'strength', 'phase-evidence', 0.9)`
    ).run(learnerId, subjectId);
  }
  for (let i = 0; i < review; i++) {
    db.prepare(
      `INSERT INTO mastery_signals (learner_id, subject_id, signal_type, concept, confidence)
       VALUES (?, ?, 'review_needed', 'phase-evidence', 0.2)`
    ).run(learnerId, subjectId);
  }
}

function seedPassingCodeSubmissions(db: Database.Database, learnerId: number, subjectId: number, count: number) {
  const lessonId = db
    .prepare("INSERT INTO lessons (subject_id, title, status, sequence_number) VALUES (?, 'Code lesson', 'completed', 99)")
    .run(subjectId).lastInsertRowid as number;
  const activityId = db
    .prepare(
      "INSERT INTO lesson_activities (lesson_id, activity_type, title, sequence_order) VALUES (?, 'practice_code', 'Integrator', 1)"
    )
    .run(lessonId).lastInsertRowid as number;
  for (let i = 0; i < count; i++) {
    db.prepare(
      "INSERT INTO attempts (activity_id, learner_id, attempt_type, result, is_final) VALUES (?, ?, 'submit', '{}', 1)"
    ).run(activityId, learnerId);
  }
}

describe("evaluateSubjectLevelProgression", () => {
  it("graduates familiarity to competence when enough evidence is present", () => {
    const db = makeDb();
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId, "familiarity");
    seedCompletedLessons(db, subjectId, 2);
    seedMastery(db, learnerId, subjectId, 61);
    seedAssessment(db, learnerId, subjectId, [
      { difficulty: "easy", outcome: "correct" },
      { difficulty: "medium", outcome: "correct" },
      { difficulty: "medium", outcome: "correct" },
      { difficulty: "hard", outcome: "incorrect" },
    ]);

    const progression = evaluateSubjectLevelProgression(db, subjectId, learnerId, { persist: true });
    const row = db.prepare("SELECT current_level FROM subjects WHERE id = ?").get(subjectId) as { current_level: string };

    expect(progression.graduated).toBe(true);
    expect(progression.current_level).toBe("competence");
    expect(row.current_level).toBe("competence");
  });

  it("holds at familiarity when lesson history is thin", () => {
    const db = makeDb();
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId, "familiarity");
    seedCompletedLessons(db, subjectId, 1);
    seedMastery(db, learnerId, subjectId, 88);

    const progression = evaluateSubjectLevelProgression(db, subjectId, learnerId, { persist: true });

    expect(progression.graduated).toBe(false);
    expect(progression.current_level).toBe("familiarity");
    expect(progression.gates.find((gate) => gate.label === "Lesson evidence")?.passed).toBe(false);
  });

  it("graduates mastery to post-mastery when hard evidence and applied practice are strong", () => {
    const db = makeDb();
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId, "mastery");
    seedCompletedLessons(db, subjectId, 8);
    seedMastery(db, learnerId, subjectId, 93);
    seedSignals(db, learnerId, subjectId, 6, 1);
    seedAssessment(db, learnerId, subjectId, [
      { difficulty: "hard", outcome: "correct" },
      { difficulty: "hard", outcome: "correct" },
      { difficulty: "hard", outcome: "correct" },
      { difficulty: "hard", outcome: "correct" },
      { difficulty: "hard", outcome: "incorrect" },
    ]);
    seedPassingCodeSubmissions(db, learnerId, subjectId, 2);

    const progression = evaluateSubjectLevelProgression(db, subjectId, learnerId, { persist: true });
    const journal = db
      .prepare("SELECT title, content FROM subject_journal_entries WHERE subject_id = ?")
      .get(subjectId) as { title: string; content: string };

    expect(progression.graduated).toBe(true);
    expect(progression.current_level).toBe("post_mastery");
    expect(progression.frontier_mode).toBe(true);
    expect(journal.title).toContain("Post-mastery");
    expect(journal.content).toContain("frontier");
  });
});
