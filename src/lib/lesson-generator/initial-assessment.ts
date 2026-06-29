/**
 * Generate a proper initial assessment for a newly-created subject.
 *
 * This is a special lesson type: sequence_number=0, purely assessment-only.
 * No teaching content, no audio, no interactive widgets.
 * Its only purpose is to calibrate what the learner already knows so future
 * lessons do not waste time repeating it.
 *
 * Per the lesson-authoring skill:
 * - Create it as a lesson with sequence_number=0 and a title prefix
 *   "Initial Assessment:" so the UI can distinguish it from teaching lessons.
 * - The lesson contains ONLY freeform assessment questions.
 * - Prefer open-ended probes that reveal depth of understanding, not just
 *   recognition or vocabulary recall.
 * - Structure questions to cover the subject's key concept areas at
 *   increasing depth: start broad, then drill into areas where the learner
 *   shows knowledge.
 * - Record results as structured mastery signals so future lessons can skip,
 *   compress, or deepen coverage for each concept.
 */

import type Database from "better-sqlite3";
import type { SubjectCreatedEvent } from "@/types";

export interface InitialAssessmentResult {
  lesson_id: number;
  lesson_title: string;
  question_count: number;
}

/**
 * Create an initial assessment lesson in the DB for the given subject.
 * Returns the lesson id and title.
 */
export function generateInitialAssessment(
  db: Database.Database,
  event: SubjectCreatedEvent
): InitialAssessmentResult {
  const title = `Initial Assessment: ${event.subject_title}`;
  const description =
    `Calibration assessment to determine your existing knowledge of ${event.subject_title} ` +
    `before teaching begins. Your honest answers will shape every subsequent lesson.`;

  const goals = JSON.stringify([
    "Calibrate existing knowledge depth",
    "Identify concepts to skip, compress, or deepen",
    "Establish a starting mastery baseline",
  ]);
  const tags = JSON.stringify(["initial-assessment", "calibration"]);

  // sequence_number=0 distinguishes this from teaching lessons (which start at 1)
  const lessonResult = db
    .prepare(
      `INSERT INTO lessons
         (subject_id, title, description, status, sequence_number, goals, tags,
          generated_by, generator_version)
       VALUES (?, ?, ?, 'queued', 0, ?, ?, 'prodavo-local-queue/v1', '1.0.0')`
    )
    .run(event.subject_id, title, description, goals, tags);

  const lesson_id = lessonResult.lastInsertRowid as number;

  const questions = buildAssessmentQuestions(event);

  const assessmentContent = {
    type: "initial_assessment",
    instruction:
      "Answer each question honestly. There are no wrong answers — your responses " +
      "calibrate the system so your teaching lessons target exactly what you need. " +
      "If you do not know an answer, say so clearly.",
    questions,
  };

  db.prepare(
    `INSERT INTO lesson_activities
       (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'assessment', 1, 1, ?, ?)`
  ).run(
    lesson_id,
    "Initial Assessment: Calibrate Your Starting Knowledge",
    JSON.stringify(assessmentContent)
  );

  return { lesson_id, lesson_title: title, question_count: questions.length };
}

function buildAssessmentQuestions(
  event: SubjectCreatedEvent
): Array<{ id: string; text: string; type: string; depth: string }> {
  const subject = event.subject_title;
  const goals = event.subject_goals ? `Goals: ${event.subject_goals}. ` : "";

  return [
    {
      id: "q1_overview",
      type: "free_text",
      depth: "breadth",
      text:
        `Describe your current understanding of ${subject} in your own words. ` +
        `What is it about? What do you already know?`,
    },
    {
      id: "q2_experience",
      type: "free_text",
      depth: "breadth",
      text:
        `Have you worked with ${subject} before? If yes, describe what you did and how it went. ` +
        `If no, what prompted your interest?`,
    },
    {
      id: "q3_goals",
      type: "free_text",
      depth: "breadth",
      text:
        `${goals}What specific outcome are you working toward? ` +
        `For example: understand the concepts deeply, be able to use it professionally, ` +
        `build something specific, or pass an exam.`,
    },
    {
      id: "q4_depth",
      type: "free_text",
      depth: "depth",
      text:
        `Pick one concept or term from ${subject} that you feel you understand best ` +
        `and explain it thoroughly — as if teaching someone else from scratch. ` +
        `Include an example.`,
    },
    {
      id: "q5_weak",
      type: "free_text",
      depth: "depth",
      text:
        `What aspect of ${subject} feels most confusing, unclear, or overwhelming to you right now? ` +
        `What have you tried to understand it and why did that not fully work?`,
    },
    {
      id: "q6_connections",
      type: "free_text",
      depth: "depth",
      text:
        `Can you connect ${subject} to something else you already know well? ` +
        `How do the two relate, and does the analogy break down anywhere?`,
    },
  ];
}
