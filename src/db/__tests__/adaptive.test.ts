/**
 * Integration tests for the adaptive-profiles upgrade against a real SQLite DB.
 *
 * Exercises the actual persistence paths (not typecheck-only):
 *  - new schema columns/tables exist,
 *  - persistAssessment writes assessment_results + tags + mastery signals,
 *  - existing subject tags are matched and missing tags are auto-created,
 *  - tag + difficulty evidence is queryable,
 *  - multi-profile isolation (one profile's evidence never leaks to another),
 *  - IDK quiz grading produces an uncertainty signal,
 *  - assessment + diagnostics content validators.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import { deterministicAssessmentAdapter } from "@/lib/assessment";
import { persistAssessment, loadSubjectTags, loadReusableTags } from "@/lib/assessment-store";
import {
  validateAssessmentContent,
  validateNextLessonDiagnostics,
  DEFAULT_NEXT_LESSON_DIAGNOSTICS,
} from "@/lib/lesson-content/schema";
import {
  initQuizSession,
  gradeAnswer,
  idkIndexFor,
  isIdkSelection,
} from "@/lib/quiz-state";
import type { MultipleChoiceQuestion } from "@/lib/lesson-content/schema";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8");
  db.exec(schema);
  return db;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

let userSeq = 0;
function seedLearner(db: Database.Database, name = "Test Learner"): { userId: number; learnerId: number } {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
    .run(`u-${name}-${++userSeq}`, name).lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
    .run(userId, name).lastInsertRowid as number;
  return { userId, learnerId };
}

function seedSubject(db: Database.Database, learnerId: number, title = "Probability"): number {
  return db
    .prepare("INSERT INTO subjects (learner_id, title) VALUES (?, ?)")
    .run(learnerId, title).lastInsertRowid as number;
}

let db: Database.Database;
beforeEach(() => {
  db = makeDb();
});

describe("adaptive schema columns + tables", () => {
  it("has the new additive columns", () => {
    expect(hasColumn(db, "users", "active_learner_id")).toBe(true);
    expect(hasColumn(db, "learner_profiles", "config")).toBe(true);
    expect(hasColumn(db, "lessons", "next_lesson_diagnostics")).toBe(true);
    expect(hasColumn(db, "mastery_signals", "difficulty")).toBe(true);
    expect(hasColumn(db, "mastery_signals", "tag_id")).toBe(true);
  });

  it("has the assessment_results + assessment_result_tags tables", () => {
    expect(hasColumn(db, "assessment_results", "outcome")).toBe(true);
    expect(hasColumn(db, "assessment_result_tags", "tag_id")).toBe(true);
  });
});

describe("persistAssessment", () => {
  it("matches an existing subject tag and writes a result + signal", () => {
    const { learnerId } = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    // Seed subject vocabulary.
    const tagId = db.prepare("INSERT INTO tags (name, tag_type) VALUES ('bayes-theorem', 'concept')").run()
      .lastInsertRowid as number;
    db.prepare("INSERT INTO subject_tags (subject_id, tag_id) VALUES (?, ?)").run(subjectId, tagId);

    const subjectTags = loadSubjectTags(db, subjectId);
    const outcome = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "What is the prior?",
      concept: "bayes-theorem",
      difficulty: "hard",
      mc_outcome: "correct",
      answer_text: "base rate",
      subject_tags: subjectTags,
    });
    const persisted = persistAssessment(db, {
      learner_id: learnerId,
      subject_id: subjectId,
      lesson_id: null,
      question_id: "bq1",
      question_type: "mc",
      concept: "bayes-theorem",
      difficulty: "hard",
      answer_text: "base rate",
      outcome,
    });

    expect(persisted.created_tag_names).toHaveLength(0); // matched existing
    const result = db.prepare("SELECT * FROM assessment_results WHERE id = ?").get(persisted.result_id) as {
      outcome: string;
      difficulty: string;
      concept: string;
    };
    expect(result.outcome).toBe("correct");
    expect(result.difficulty).toBe("hard");
    const signal = db.prepare("SELECT * FROM mastery_signals WHERE id = ?").get(persisted.signal_id) as {
      signal_type: string;
      difficulty: string;
      tag_id: number;
    };
    expect(signal.signal_type).toBe("strength");
    expect(signal.difficulty).toBe("hard");
    expect(signal.tag_id).toBe(tagId);
    // The result is linked to the tag.
    const link = db.prepare("SELECT * FROM assessment_result_tags WHERE result_id = ?").get(persisted.result_id);
    expect(link).toBeTruthy();
  });

  it("auto-creates a missing tag and adds it to the subject vocabulary", () => {
    const { learnerId } = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    const subjectTags = loadSubjectTags(db, subjectId);
    expect(subjectTags).toHaveLength(0);

    const outcome = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "q",
      concept: "Sequential Testing",
      difficulty: "hard",
      mc_outcome: "incorrect",
      answer_text: "x",
      subject_tags: subjectTags,
    });
    const persisted = persistAssessment(db, {
      learner_id: learnerId,
      subject_id: subjectId,
      question_id: "q9",
      question_type: "mc",
      concept: "Sequential Testing",
      difficulty: "hard",
      answer_text: "x",
      outcome,
    });

    expect(persisted.created_tag_names).toContain("sequential-testing");
    // Now part of the subject vocabulary for future matching.
    const vocab = loadSubjectTags(db, subjectId).map((t) => t.name);
    expect(vocab).toContain("sequential-testing");
    // And it was created as a misconception (wrong answer).
    const tag = db.prepare("SELECT tag_type FROM tags WHERE name = 'sequential-testing'").get() as { tag_type: string };
    expect(tag.tag_type).toBe("misconception");
  });

  it("reuses a concept label across subjects instead of forking a duplicate tag", () => {
    const { learnerId } = seedLearner(db);
    const subjectA = seedSubject(db, learnerId, "Transformers");
    const subjectB = seedSubject(db, learnerId, "Attention Deep Dive");

    // Subject A mints a concept tag.
    const outA = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "q",
      concept: "Softmax Scaling",
      difficulty: "medium",
      mc_outcome: "correct",
      subject_tags: loadReusableTags(db, subjectA),
    });
    const persistedA = persistAssessment(db, {
      learner_id: learnerId,
      subject_id: subjectA,
      question_id: "qa",
      question_type: "mc",
      concept: "Softmax Scaling",
      difficulty: "medium",
      outcome: outA,
    });
    expect(persistedA.created_tag_names).toContain("softmax-scaling");
    const tagCountAfterA = (db.prepare("SELECT COUNT(*) AS n FROM tags WHERE name = 'softmax-scaling'").get() as { n: number }).n;
    expect(tagCountAfterA).toBe(1);

    // Subject B does NOT yet have this tag in its own vocabulary...
    expect(loadSubjectTags(db, subjectB).map((t) => t.name)).not.toContain("softmax-scaling");
    // ...but the cross-subject reusable vocabulary surfaces it for matching.
    expect(loadReusableTags(db, subjectB).map((t) => t.name)).toContain("softmax-scaling");

    // Subject B assesses the same concept; the matcher reuses the existing tag.
    const outB = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "q",
      concept: "Softmax Scaling",
      difficulty: "medium",
      mc_outcome: "correct",
      subject_tags: loadReusableTags(db, subjectB),
    });
    persistAssessment(db, {
      learner_id: learnerId,
      subject_id: subjectB,
      question_id: "qb",
      question_type: "mc",
      concept: "Softmax Scaling",
      difficulty: "medium",
      outcome: outB,
    });

    // No duplicate global tag row was created...
    const tagCountAfterB = (db.prepare("SELECT COUNT(*) AS n FROM tags WHERE name = 'softmax-scaling'").get() as { n: number }).n;
    expect(tagCountAfterB).toBe(1);
    // ...and the shared tag is now linked to BOTH subjects for cross-subject mastery.
    const tagId = (db.prepare("SELECT id FROM tags WHERE name = 'softmax-scaling'").get() as { id: number }).id;
    const links = (db.prepare("SELECT COUNT(*) AS n FROM subject_tags WHERE tag_id = ?").get(tagId) as { n: number }).n;
    expect(links).toBe(2);
  });

  it("IDK answer persists a low-confidence review_needed signal", () => {
    const { learnerId } = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    const outcome = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "q",
      concept: "posterior-update",
      difficulty: "medium",
      mc_outcome: "idk",
      subject_tags: [],
    });
    const persisted = persistAssessment(db, {
      learner_id: learnerId,
      subject_id: subjectId,
      question_id: "q2",
      question_type: "mc",
      concept: "posterior-update",
      difficulty: "medium",
      outcome,
    });
    const result = db.prepare("SELECT outcome FROM assessment_results WHERE id = ?").get(persisted.result_id) as {
      outcome: string;
    };
    expect(result.outcome).toBe("idk");
    const signal = db.prepare("SELECT signal_type, confidence FROM mastery_signals WHERE id = ?").get(persisted.signal_id) as {
      signal_type: string;
      confidence: number;
    };
    expect(signal.signal_type).toBe("review_needed");
    expect(signal.confidence).toBeLessThan(0.2);
  });

  it("supports querying performance by tag AND difficulty", () => {
    const { learnerId } = seedLearner(db);
    const subjectId = seedSubject(db, learnerId);
    const record = (concept: string, difficulty: "easy" | "medium" | "hard", mc: "correct" | "incorrect" | "idk") => {
      const outcome = deterministicAssessmentAdapter.assess({
        question_type: "mc",
        question_text: "q",
        concept,
        difficulty,
        mc_outcome: mc,
        subject_tags: loadSubjectTags(db, subjectId),
      });
      persistAssessment(db, {
        learner_id: learnerId,
        subject_id: subjectId,
        question_id: `${concept}-${difficulty}-${mc}`,
        question_type: "mc",
        concept,
        difficulty,
        outcome,
      });
    };
    record("base-rate-fallacy", "hard", "incorrect");
    record("base-rate-fallacy", "hard", "correct");
    record("base-rate-fallacy", "easy", "correct");

    // "How did the learner do on HARD base-rate-fallacy questions?"
    const row = db
      .prepare(
        `SELECT
           SUM(CASE WHEN ar.outcome='correct' THEN 1 ELSE 0 END) AS correct,
           COUNT(*) AS total
         FROM assessment_results ar
         JOIN assessment_result_tags art ON art.result_id = ar.id
         JOIN tags t ON t.id = art.tag_id
         WHERE t.name = 'base-rate-fallacy' AND ar.difficulty = 'hard' AND ar.learner_id = ?`
      )
      .get(learnerId) as { correct: number; total: number };
    expect(row.total).toBe(2);
    expect(row.correct).toBe(1);
  });
});

describe("multi-profile isolation", () => {
  it("keeps each profile's subjects and assessment evidence separate", () => {
    const a = seedLearner(db, "Alice");
    const b = seedLearner(db, "Bob");
    const subjectA = seedSubject(db, a.learnerId, "A-subject");
    const subjectB = seedSubject(db, b.learnerId, "B-subject");

    const out = deterministicAssessmentAdapter.assess({
      question_type: "mc",
      question_text: "q",
      concept: "c",
      difficulty: "easy",
      mc_outcome: "correct",
      subject_tags: [],
    });
    persistAssessment(db, { learner_id: a.learnerId, subject_id: subjectA, question_id: "qa", question_type: "mc", concept: "c", difficulty: "easy", outcome: out });

    // Bob's evidence query returns nothing.
    const bobResults = db.prepare("SELECT COUNT(*) AS n FROM assessment_results WHERE learner_id = ?").get(b.learnerId) as { n: number };
    expect(bobResults.n).toBe(0);
    const aliceResults = db.prepare("SELECT COUNT(*) AS n FROM assessment_results WHERE learner_id = ?").get(a.learnerId) as { n: number };
    expect(aliceResults.n).toBe(1);

    // Subjects don't cross profiles.
    const aSubjects = db.prepare("SELECT id FROM subjects WHERE learner_id = ?").all(a.learnerId) as Array<{ id: number }>;
    expect(aSubjects.map((s) => s.id)).toEqual([subjectA]);
    expect(aSubjects.map((s) => s.id)).not.toContain(subjectB);
  });

  it("active_learner_id can be set per account and resolves independently", () => {
    const a = seedLearner(db, "Carol");
    const p2 = db.prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'Carol-Kid')").run(a.userId)
      .lastInsertRowid as number;
    db.prepare("UPDATE users SET active_learner_id = ? WHERE id = ?").run(p2, a.userId);
    const user = db.prepare("SELECT active_learner_id FROM users WHERE id = ?").get(a.userId) as { active_learner_id: number };
    expect(user.active_learner_id).toBe(p2);
  });
});

describe("IDK quiz grading (virtual option)", () => {
  const questions: MultipleChoiceQuestion[] = [
    { id: "q1", question: "Q1", choices: ["a", "b", "c"], correct_index: 0, explanation: "e", concept: "c1", difficulty: "easy" },
  ];

  it("idkIndexFor / isIdkSelection identify the virtual option", () => {
    expect(idkIndexFor(3)).toBe(3);
    expect(isIdkSelection(3, 3)).toBe(true);
    expect(isIdkSelection(3, 0)).toBe(false);
  });

  it("selecting IDK grades as incorrect and flags is_idk", () => {
    const session = initQuizSession(questions, 1);
    const graded = gradeAnswer(session, session.queue[0], idkIndexFor(3), questions, { n: 0 });
    expect(graded.feedback?.correct).toBe(false);
    expect(graded.feedback?.is_idk).toBe(true);
    // A retry is scheduled like any wrong answer.
    expect(graded.queue.some((it) => it.kind === "retry")).toBe(true);
  });
});

describe("content validators", () => {
  it("validateAssessmentContent accepts freeform + quiz, rejects bad difficulty", () => {
    const ok = validateAssessmentContent({
      questions: [{ id: "q1", text: "Explain.", type: "free_text", concept: "c", difficulty: "medium" }],
    });
    expect(ok.valid).toBe(true);

    const bad = validateAssessmentContent({
      questions: [{ id: "q1", text: "Explain.", difficulty: "trivial" }],
    });
    expect(bad.valid).toBe(false);
  });

  it("validateNextLessonDiagnostics accepts the default set", () => {
    const r = validateNextLessonDiagnostics(DEFAULT_NEXT_LESSON_DIAGNOSTICS);
    expect(r.valid).toBe(true);
    expect(DEFAULT_NEXT_LESSON_DIAGNOSTICS.length).toBeGreaterThanOrEqual(3);
  });

  it("validateNextLessonDiagnostics rejects entries missing prompts", () => {
    const r = validateNextLessonDiagnostics([{ id: "d1" }]);
    expect(r.valid).toBe(false);
  });
});
