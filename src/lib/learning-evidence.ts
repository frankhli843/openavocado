import type Database from "better-sqlite3";
import type { Difficulty } from "@/types";

export type LearningEvidenceSourceType =
  | "practice_answer"
  | "assessment_answer"
  | "diagnostic_answer"
  | "code_submission"
  | "lesson_chat";

export interface LearningEvidenceInput {
  learner_id: number;
  subject_id: number;
  lesson_id?: number | null;
  activity_id?: number | null;
  source_type: LearningEvidenceSourceType;
  source_id?: string | null;
  concept?: string | null;
  difficulty?: Difficulty | null;
  outcome?: string | null;
  prompt?: string | null;
  learner_input?: string | null;
  system_response?: string | null;
  metadata?: Record<string, unknown> | null;
}

const TEXT_LIMIT = 12000;
const RESPONSE_LIMIT = 8000;

export function ensureLearningEvidenceSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_evidence (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
      subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      lesson_id       INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
      activity_id     INTEGER REFERENCES lesson_activities(id) ON DELETE SET NULL,
      source_type     TEXT    NOT NULL CHECK (source_type IN (
                        'practice_answer', 'assessment_answer', 'diagnostic_answer',
                        'code_submission', 'lesson_chat'
                      )),
      source_id       TEXT,
      concept         TEXT,
      difficulty      TEXT    CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL),
      outcome         TEXT,
      prompt          TEXT,
      learner_input   TEXT,
      system_response TEXT,
      metadata        TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_learning_evidence_subject_learner ON learning_evidence(subject_id, learner_id, id DESC)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_learning_evidence_lesson ON learning_evidence(lesson_id, id DESC)");
}

export function recordLearningEvidence(
  db: Database.Database,
  input: LearningEvidenceInput
): number {
  ensureLearningEvidenceSchema(db);
  const result = db
    .prepare(
      `INSERT INTO learning_evidence
         (learner_id, subject_id, lesson_id, activity_id, source_type, source_id,
          concept, difficulty, outcome, prompt, learner_input, system_response, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.learner_id,
      input.subject_id,
      input.lesson_id ?? null,
      input.activity_id ?? null,
      input.source_type,
      cleanText(input.source_id, 512),
      cleanText(input.concept, 512),
      input.difficulty ?? null,
      cleanText(input.outcome, 512),
      cleanText(input.prompt, TEXT_LIMIT),
      cleanText(input.learner_input, TEXT_LIMIT),
      cleanText(input.system_response, RESPONSE_LIMIT),
      input.metadata ? JSON.stringify(input.metadata) : null
    );

  return Number(result.lastInsertRowid);
}

function cleanText(value: string | null | undefined, limit: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}...` : trimmed;
}
