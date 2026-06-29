import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";

import { generateInitialAssessment } from "./initial-assessment";
import { generateNextLesson } from "./next-lesson";
import type { LessonCompletedEvent, SubjectCreatedEvent } from "@/types";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8"));
  db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN output_lesson_id INTEGER");
  return db;
}

function seedSubject(db: Database.Database) {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('guest-test', 'Guest Test')")
    .run().lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Guest Test')")
    .run(userId).lastInsertRowid as number;
  const subjectId = db
    .prepare(
      "INSERT INTO subjects (learner_id, title, goals, current_level) VALUES (?, 'Transformer attention', 'Understand attention with visuals', 'familiarity')"
    )
    .run(learnerId).lastInsertRowid as number;
  return { userId, learnerId, subjectId };
}

function subjectCreatedEvent(learnerId: number, subjectId: number): SubjectCreatedEvent {
  return {
    event: "subject.created",
    learner_id: learnerId,
    subject_id: subjectId,
    subject_title: "Transformer attention",
    subject_description: null,
    subject_goals: "Understand attention with visuals",
    subject_criteria: null,
    current_level: "familiarity",
    workpad_summary: null,
    learner_profile_config: null,
    created_at: new Date().toISOString(),
  };
}

function lessonCompletedEvent(learnerId: number, subjectId: number, lessonId: number): LessonCompletedEvent {
  return {
    event: "lesson.completed",
    learner_id: learnerId,
    subject_id: subjectId,
    subject_title: "Transformer attention",
    subject_goals: "Understand attention with visuals",
    subject_criteria: null,
    lesson_id: lessonId,
    lesson_title: "Initial Assessment: Transformer attention",
    lesson_goals: ["Calibrate existing knowledge depth"],
    activities_completed: ["assessment"],
    assessment_qa: [
      {
        question: "What feels unclear?",
        learner_answer: "I understand the high level but not what changes at each step.",
      },
    ],
    code_attempts: [],
    mastery_signals: [],
    concepts_to_review: ["attention inputs"],
    concepts_ready_to_advance: ["query-key matching"],
    next_lesson_diagnostics: [
      { prompt: "What next?", answer: "A worked visual example." },
    ],
    quiz_result: { passed: true, correct_count: 1, pass_threshold: 1 },
    tag_difficulty_performance: [],
    recent_misconceptions: [],
    completed_lessons: [],
    discarded_lessons: [],
    workpad_summary: null,
    learner_profile_config: null,
    cross_subject_history: [],
    completed_at: new Date().toISOString(),
  };
}

describe("generateNextLesson", () => {
  it("creates a real teaching lesson after the initial assessment", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    const initial = generateInitialAssessment(db, subjectCreatedEvent(learnerId, subjectId));

    db.prepare("UPDATE lessons SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(initial.lesson_id);

    const next = generateNextLesson(
      db,
      lessonCompletedEvent(learnerId, subjectId, initial.lesson_id)
    );

    expect(next.lesson_id).toBeGreaterThan(initial.lesson_id);
    expect(next.sequence_number).toBe(1);

    const lesson = db
      .prepare("SELECT title, status, sequence_number, generated_by, next_lesson_diagnostics FROM lessons WHERE id = ?")
      .get(next.lesson_id) as {
      title: string;
      status: string;
      sequence_number: number;
      generated_by: string;
      next_lesson_diagnostics: string | null;
    };
    expect(lesson.title).toContain("Transformer attention");
    expect(lesson.status).toBe("queued");
    expect(lesson.sequence_number).toBe(1);
    expect(lesson.generated_by).toBe("prodavo-local-queue/v1");
    expect(JSON.parse(lesson.next_lesson_diagnostics ?? "[]")).toHaveLength(2);

    const activities = db
      .prepare("SELECT activity_type FROM lesson_activities WHERE lesson_id = ? ORDER BY sequence_order ASC")
      .all(next.lesson_id)
      .map((row) => (row as { activity_type: string }).activity_type);
    expect(activities).toEqual(["audio", "reading", "interactive", "assessment"]);

    const workpad = db
      .prepare("SELECT content FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
      .get(subjectId, learnerId) as { content: string } | undefined;
    expect(workpad?.content).toContain(`Generated next lesson: ${next.lesson_title}`);
  });
});
