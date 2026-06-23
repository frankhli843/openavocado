/**
 * Persistence for assessment outcomes.
 *
 * Takes an {@link AssessmentOutcome} produced by the assessor and writes the
 * durable evidence in one transaction:
 *  - an `assessment_results` row (tag + difficulty + outcome, queryable),
 *  - tag rows (existing matched + newly created), linked to the subject and to
 *    the assessment result,
 *  - a `mastery_signals` row carrying difficulty + the resolved tag id.
 *
 * Kept separate from the API route so it can be unit-tested against a real DB.
 */
import type Database from "better-sqlite3";
import type { Difficulty } from "@/types";
import type { AssessmentOutcome, SubjectTagRef, TagType } from "@/lib/assessment";

const VALID_TAG_TYPES: TagType[] = [
  "concept",
  "misconception",
  "review_topic",
  "curriculum_area",
  "lesson_type",
];

export interface PersistAssessmentParams {
  learner_id: number;
  subject_id: number;
  lesson_id?: number | null;
  activity_id?: number | null;
  question_id: string;
  question_type: "mc" | "freeform" | "diagnostic";
  concept?: string | null;
  difficulty?: Difficulty | null;
  answer_text?: string | null;
  outcome: AssessmentOutcome;
}

export interface PersistedAssessment {
  result_id: number;
  signal_id: number;
  tag_ids: number[];
  created_tag_names: string[];
}

/** Load the subject's existing tag vocabulary (from subject_tags joins). */
export function loadSubjectTags(db: Database.Database, subjectId: number): SubjectTagRef[] {
  const rows = db
    .prepare(
      `SELECT t.id AS id, t.name AS name, t.tag_type AS tag_type
       FROM subject_tags st JOIN tags t ON t.id = st.tag_id
       WHERE st.subject_id = ?`
    )
    .all(subjectId) as Array<{ id: number; name: string; tag_type: TagType }>;
  return rows;
}

/** Resolve a tag by name, creating it if absent. Reports whether it was new. */
function upsertTag(
  db: Database.Database,
  name: string,
  tagType: TagType
): { id: number; created: boolean } {
  const type = VALID_TAG_TYPES.includes(tagType) ? tagType : "concept";
  const existing = db.prepare("SELECT id FROM tags WHERE name = ?").get(name) as
    | { id: number }
    | undefined;
  if (existing) return { id: existing.id, created: false };
  const res = db
    .prepare("INSERT INTO tags (name, tag_type) VALUES (?, ?)")
    .run(name, type);
  return { id: res.lastInsertRowid as number, created: true };
}

/**
 * Persist an assessment outcome. Throws on DB errors so callers (the API route)
 * surface the failure rather than silently dropping tagging.
 */
export function persistAssessment(
  db: Database.Database,
  params: PersistAssessmentParams
): PersistedAssessment {
  const { outcome } = params;

  const tx = db.transaction((): PersistedAssessment => {
    // 1. The assessment_results row.
    const resultRes = db
      .prepare(
        `INSERT INTO assessment_results
           (learner_id, subject_id, lesson_id, activity_id, question_id, question_type, concept, difficulty, outcome, answer_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        params.learner_id,
        params.subject_id,
        params.lesson_id ?? null,
        params.activity_id ?? null,
        params.question_id,
        params.question_type,
        params.concept ?? null,
        params.difficulty ?? null,
        outcome.outcome,
        params.answer_text ?? null
      );
    const result_id = resultRes.lastInsertRowid as number;

    // 2. Resolve/create tags, link to subject + assessment result.
    const tag_ids: number[] = [];
    const created_tag_names: string[] = [];
    let primary_tag_id: number | null = null;
    for (const decision of outcome.tags) {
      const { id: tagId, created } = upsertTag(db, decision.name, decision.tag_type);
      if (created) created_tag_names.push(decision.name);
      // Ensure the tag is part of the subject vocabulary going forward.
      db.prepare(
        "INSERT OR IGNORE INTO subject_tags (subject_id, tag_id) VALUES (?, ?)"
      ).run(params.subject_id, tagId);
      db.prepare(
        "INSERT OR IGNORE INTO assessment_result_tags (result_id, tag_id) VALUES (?, ?)"
      ).run(result_id, tagId);
      tag_ids.push(tagId);
      if (primary_tag_id === null) primary_tag_id = tagId;
    }

    // 3. The mastery signal with difficulty + tag link.
    const s = outcome.signal;
    const signalRes = db
      .prepare(
        `INSERT INTO mastery_signals
           (learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence, difficulty, tag_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        params.learner_id,
        params.subject_id,
        params.lesson_id ?? null,
        s.signal_type,
        s.concept,
        s.detail,
        s.confidence,
        s.difficulty ?? null,
        primary_tag_id
      );

    return {
      result_id,
      signal_id: signalRes.lastInsertRowid as number,
      tag_ids,
      created_tag_names,
    };
  });

  return tx();
}
