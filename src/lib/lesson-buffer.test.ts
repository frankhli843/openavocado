import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";

import { buildLessonBufferPlan, enrichQueuedLessonsFromCompletion } from "./lesson-buffer";
import type { LessonCompletedEvent, LevelProgression } from "@/types";

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
    completed_lessons: 1,
    total_lessons: 2,
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
  phases: [],
};

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8"));
  return db;
}

function seedSubject(db: Database.Database) {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('buffer-user', 'Buffer User')")
    .run().lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Buffer User')")
    .run(userId).lastInsertRowid as number;
  const subjectId = db
    .prepare(
      "INSERT INTO subjects (learner_id, title, goals, current_level) VALUES (?, 'Dog reinforcement', 'Train with positive reinforcement', 'familiarity')"
    )
    .run(learnerId).lastInsertRowid as number;
  return { learnerId, subjectId };
}

function insertLesson(db: Database.Database, subjectId: number, status: string, seq: number, title: string) {
  return db
    .prepare(
      `INSERT INTO lessons (subject_id, title, description, status, sequence_number, planning_rationale, source_context)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(subjectId, title, `${title} description`, status, seq, `${title} rationale`, "{}").lastInsertRowid as number;
}

function completionEvent(learnerId: number, subjectId: number, completedLessonId: number): LessonCompletedEvent {
  return {
    event: "lesson.completed",
    learner_id: learnerId,
    subject_id: subjectId,
    subject_title: "Dog reinforcement",
    subject_goals: "Train with positive reinforcement",
    subject_criteria: null,
    current_level: "familiarity",
    level_progression: TEST_LEVEL_PROGRESSION,
    lesson_id: completedLessonId,
    lesson_title: "Positive reinforcement basics",
    lesson_goals: ["Understand timing and reward value"],
    activities_completed: ["audio", "assessment"],
    assessment_qa: [{ question: "What was hard?", learner_answer: "Timing the reward." }],
    code_attempts: [],
    mastery_signals: [],
    concepts_to_review: ["reward timing"],
    concepts_ready_to_advance: ["reward hierarchy"],
    next_lesson_diagnostics: [{ prompt: "What next?", answer: "Practice with real examples." }],
    quiz_result: { passed: true, correct_count: 4, pass_threshold: 4 },
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

describe("lesson buffer", () => {
  it("plans enrichment for existing queued lessons and enough generation to reach two ready lessons", () => {
    const db = makeDb();
    const { learnerId, subjectId } = seedSubject(db);
    const completedId = insertLesson(db, subjectId, "completed", 1, "Positive reinforcement basics");
    insertLesson(db, subjectId, "queued", 2, "Reward hierarchy");

    const plan = buildLessonBufferPlan(db, { subjectId, completedLessonId: completedId });

    expect(plan.target_ready_count).toBe(2);
    expect(plan.ready_count).toBe(1);
    expect(plan.lessons_to_generate).toBe(1);
    expect(plan.existing_ready_lessons.map((lesson) => lesson.title)).toEqual(["Reward hierarchy"]);
    expect(plan.enrichment_required_for_lesson_ids).toHaveLength(1);

    const enriched = enrichQueuedLessonsFromCompletion(db, completionEvent(learnerId, subjectId, completedId));
    expect(enriched).toEqual(plan.enrichment_required_for_lesson_ids);

    const queued = db
      .prepare("SELECT planning_rationale, source_context FROM lessons WHERE id = ?")
      .get(enriched[0]) as { planning_rationale: string; source_context: string };
    expect(queued.planning_rationale).toContain("Positive reinforcement basics");
    expect(queued.planning_rationale).toContain("latest evidence");
    expect(JSON.parse(queued.source_context).lesson_buffer_enrichment.completed_lesson_id).toBe(completedId);

    const after = buildLessonBufferPlan(db, { subjectId, completedLessonId: completedId });
    expect(after.enrichment_required_for_lesson_ids).toEqual([]);
    expect(after.lessons_to_generate).toBe(1);
  });

  it("does not request generation when two queued lessons already exist", () => {
    const db = makeDb();
    const { subjectId } = seedSubject(db);
    const completedId = insertLesson(db, subjectId, "completed", 1, "Positive reinforcement basics");
    insertLesson(db, subjectId, "queued", 2, "Reward hierarchy");
    insertLesson(db, subjectId, "queued", 3, "Proofing distractions");

    const plan = buildLessonBufferPlan(db, { subjectId, completedLessonId: completedId });

    expect(plan.ready_count).toBe(2);
    expect(plan.lessons_to_generate).toBe(0);
    expect(plan.enrichment_required_for_lesson_ids).toHaveLength(2);
  });
});
