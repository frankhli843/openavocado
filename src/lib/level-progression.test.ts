import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import {
  evaluateSubjectLevelProgression,
  evaluateSubjectLevelProgressionWithAi,
} from "@/lib/level-progression";
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
    .prepare(
      "INSERT INTO learner_profiles (user_id, display_name, config) VALUES (?, 'Phase Learner', ?)"
    )
    .run(userId, JSON.stringify({ style: "visual, concrete examples first" })).lastInsertRowid as number;
}

function seedSubject(db: Database.Database, learnerId: number, level: LevelName) {
  return db
    .prepare(
      `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level)
       VALUES (?, 'Model Building and Inference', 'Learn to build and reason about LLM systems', ?, ?, ?)`
    )
    .run(
      learnerId,
      "Understand LLMs well enough to contribute to real open-source model work.",
      "Prefer audio-first, visual mechanisms, and code reinforcement.",
      level
    ).lastInsertRowid as number;
}

function seedCompletedLesson(db: Database.Database, subjectId: number, sequence: number, title: string) {
  return db
    .prepare(
      `INSERT INTO lessons
         (subject_id, title, description, status, sequence_number, completed_at, goals, tags)
       VALUES (?, ?, ?, 'completed', ?, datetime('now'), ?, ?)`
    )
    .run(
      subjectId,
      title,
      `Completed ${title}`,
      sequence,
      JSON.stringify(["Understand a high-level part of the LLM pipeline"]),
      JSON.stringify(["llm-from-scratch", "transformer-architecture"])
    ).lastInsertRowid as number;
}

function seedEvidence(db: Database.Database, learnerId: number, subjectId: number) {
  const lessonId = seedCompletedLesson(db, subjectId, 1, "Tokenization and Architecture Bridge");
  seedCompletedLesson(db, subjectId, 2, "Hidden States and Transformer Blocks");
  seedCompletedLesson(db, subjectId, 3, "Training vs Inference Map");

  db.prepare(
    "INSERT INTO progress_points (learner_id, subject_id, metric, value) VALUES (?, ?, 'mastery', 63)"
  ).run(learnerId, subjectId);

  for (let i = 0; i < 8; i++) {
    db.prepare(
      `INSERT INTO assessment_results
         (learner_id, subject_id, lesson_id, question_id, question_type, concept, difficulty, outcome, answer_text)
       VALUES (?, ?, ?, ?, 'freeform', 'transformer-architecture', 'hard', 'correct', ?)`
    ).run(learnerId, subjectId, lessonId, `hard-${i}`, "A transformer block changes hidden-state values but keeps token positions.");
  }

  for (let i = 0; i < 6; i++) {
    db.prepare(
      `INSERT INTO mastery_signals (learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence)
       VALUES (?, ?, ?, 'strength', 'llm-pipeline-stages', 'High-level pipeline answer was coherent.', 0.8)`
    ).run(learnerId, subjectId, lessonId);
  }

  db.prepare(
    `INSERT INTO subject_workpads (subject_id, learner_id, content, last_updated_by, last_updated_for)
     VALUES (?, ?, ?, 'test', 'lesson_generation')`
  ).run(subjectId, learnerId, "# Comprehensive Avo Lesson Plan\n\nThe existing plan says tokenizer, transformer, training, inference, and quantization are still being mapped.");
}

describe("evaluateSubjectLevelProgression", () => {
  it("does not graduate from deterministic evidence counts without an AI phase decision", () => {
    const db = makeDb();
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId, "familiarity");
    seedEvidence(db, learnerId, subjectId);

    const progression = evaluateSubjectLevelProgression(db, subjectId, learnerId);
    const row = db.prepare("SELECT current_level FROM subjects WHERE id = ?").get(subjectId) as { current_level: string };

    expect(progression.graduated).toBe(false);
    expect(progression.current_level).toBe("familiarity");
    expect(progression.reason).toContain("AI phase evaluator");
    expect(row.current_level).toBe("familiarity");
  });

  it("does not recalibrate through the async completion path when the AI evaluator is unavailable", async () => {
    const db = makeDb();
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId, "competence");
    seedEvidence(db, learnerId, subjectId);

    const progression = await evaluateSubjectLevelProgressionWithAi(db, subjectId, learnerId, {
      persist: true,
      completedLessonId: 1,
    });
    const row = db.prepare("SELECT current_level FROM subjects WHERE id = ?").get(subjectId) as { current_level: string };
    const journal = db
      .prepare("SELECT title, content, metadata, created_by FROM subject_journal_entries WHERE subject_id = ?")
      .get(subjectId) as { title: string; content: string; metadata: string; created_by: string };

    expect(progression.graduated).toBe(false);
    expect(progression.current_level).toBe("competence");
    expect(progression.reason).toContain("AI phase evaluator is unavailable");
    expect(row.current_level).toBe("competence");
    expect(journal.created_by).toBe("avocadocore-ai-phase-evaluator");
    expect(journal.title).toBe("AI phase review unavailable");
    expect(journal.content).toContain("AI phase evaluator is not configured");
    expect(JSON.parse(journal.metadata).evaluator_error).toContain("not configured");
  });

  it("reads the latest persisted AI phase decision for display", async () => {
    const db = makeDb();
    const learnerId = seedLearner(db);
    const subjectId = seedSubject(db, learnerId, "competence");
    seedEvidence(db, learnerId, subjectId);

    db.prepare(
      `INSERT INTO subject_journal_entries
         (subject_id, learner_id, entry_type, title, content, metadata, created_by)
       VALUES (?, ?, 'planning', 'AI phase review', 'AI review', ?, 'avocadocore-ai-phase-evaluator')`
    ).run(
      subjectId,
      learnerId,
      JSON.stringify({
        kind: "ai_phase_decision",
        decision: {
          current_level: "familiarity",
          recommended_level: "familiarity",
          should_change_level: true,
          confidence: 0.8,
          reason: "Use familiarity until the full LLM lifecycle map is demonstrated.",
          missing_evidence: ["checkpointing", "serving"],
          next_lesson_directive: "Teach the lifecycle map.",
        },
      })
    );

    const progression = evaluateSubjectLevelProgression(db, subjectId, learnerId);

    expect(progression.current_level).toBe("familiarity");
    expect(progression.recommended_level).toBe("familiarity");
    expect(progression.reason).toContain("full LLM lifecycle map");
    expect(progression.gates.find((gate) => gate.label === "AI phase review")?.passed).toBe(true);
  });
});
