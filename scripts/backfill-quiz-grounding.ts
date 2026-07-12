#!/usr/bin/env tsx
/**
 * Backfill existing lesson quizzes to the grounded-assessment contract.
 *
 * This preserves learner progress and activity ids. It only rewrites activity
 * content JSON:
 * - Adds grounding_required=true to every existing MC quiz.
 * - Adds learning_scope/support_ref to existing questions when missing.
 * - Replaces lesson 4 final assessment questions that tested untaught or
 *   preview-only material.
 * - Moves the lesson 4 tokenization look-ahead into end diagnostics.
 */
import { getDb, closeDb } from "../src/db/connection";

interface ActivityRow {
  id: number;
  lesson_id: number;
  lesson_title: string;
  activity_type: string;
  title: string | null;
  content: string | null;
}

type JsonRecord = Record<string, unknown>;

function withGrounding(question: JsonRecord, supportRef: string): JsonRecord {
  return {
    ...question,
    learning_scope: question.learning_scope === "review" ? "review" : "taught",
    support_ref: typeof question.support_ref === "string" && question.support_ref.trim()
      ? question.support_ref
      : supportRef,
  };
}

function lesson4ReplacementQuestion(id: string): JsonRecord | null {
  if (id === "iq5") {
    return {
      id: "iq5",
      concept: "resize-shape-contract",
      difficulty: "medium",
      learning_scope: "taught",
      support_ref: "Part 1: Resize fixes the canvas",
      question: "Why is resize a contract fix rather than just an image-quality operation?",
      choices: [
        "It makes height and width match the model's expected canvas before later tensor steps",
        "It chooses the final class label before inference",
        "It replaces per-channel normalization",
        "It turns the image into language tokens",
      ],
      correct_index: 0,
      explanation:
        "Resize is the spatial contract: it makes the image fit the expected canvas so later steps operate on a compatible shape.",
      misconception_target:
        "Learner treats resize as a cosmetic quality choice rather than a model input contract",
      rephrase_instructions:
        "Ask the same concept using the scanner-tray metaphor from the lesson. Do not introduce resampling algorithms.",
    };
  }
  if (id === "iq9") {
    return {
      id: "iq9",
      concept: "pipeline-final-shape",
      difficulty: "hard",
      learning_scope: "taught",
      support_ref: "Part 5: Batch fixes the model call",
      question:
        "After resize, rescale, normalize, permute, and batch, what shape should one RGB image commonly have for a channel-first 224 by 224 model call?",
      choices: [
        "[1, 3, 224, 224]",
        "[224, 224, 3]",
        "[3, 224, 224, 1]",
        "[224, 1, 3, 224]",
      ],
      correct_index: 0,
      explanation:
        "A single image becomes batch size 1, channels first, then height and width: [1, 3, 224, 224].",
      misconception_target:
        "Learner understands individual steps but cannot trace the final model-call tensor shape",
      rephrase_instructions:
        "Ask using the folder/tray metaphor and preserve the final shape reasoning.",
    };
  }
  return null;
}

function ensureLesson4Diagnostics(lessonId: number): number {
  const db = getDb();
  const row = db
    .prepare("SELECT next_lesson_diagnostics FROM lessons WHERE id = ?")
    .get(lessonId) as { next_lesson_diagnostics: string | null } | undefined;
  if (!row) return 0;
  let diagnostics: JsonRecord[] = [];
  if (row.next_lesson_diagnostics) {
    try {
      const parsed = JSON.parse(row.next_lesson_diagnostics);
      if (Array.isArray(parsed)) diagnostics = parsed;
    } catch {
      diagnostics = [];
    }
  }
  if (diagnostics.some((d) => d.id === "diag-lookahead-tokenization")) return 0;
  diagnostics.push({
    id: "diag-lookahead-tokenization",
    prompt:
      "Look-ahead for the next lesson: do you want to go deeper on patch tokenization and the vision encoder next, or would you rather practice implementing this image-to-tensor pipeline first?",
    hint:
      "This is not graded. It helps choose the next lesson direction after the preprocessing contract.",
  });
  db.prepare(
    `UPDATE lessons
     SET next_lesson_diagnostics = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(JSON.stringify(diagnostics), lessonId);
  return 1;
}

function updateQuiz(content: JsonRecord, row: ActivityRow): { changed: boolean; content: JsonRecord } {
  const quiz = content.quiz;
  if (!quiz || typeof quiz !== "object" || Array.isArray(quiz)) {
    return { changed: false, content };
  }
  const q = quiz as JsonRecord;
  const rawQuestions = q.questions;
  if (!Array.isArray(rawQuestions)) return { changed: false, content };

  const supportRef = row.activity_type === "lesson_part"
    ? `${row.title ?? row.lesson_title}: written explanation, examples, and interactive`
    : `${row.lesson_title}: written lesson sections and lesson parts`;

  const questions = rawQuestions.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const question = raw as JsonRecord;
    const replacement = row.lesson_id === 4 ? lesson4ReplacementQuestion(String(question.id ?? "")) : null;
    return withGrounding(replacement ?? question, supportRef);
  });

  return {
    changed: true,
    content: {
      ...content,
      quiz: {
        ...q,
        grounding_required: true,
        questions,
      },
    },
  };
}

function main() {
  const db = getDb();
  const rows = db.prepare(
    `SELECT a.id, a.lesson_id, l.title AS lesson_title, a.activity_type, a.title, a.content
     FROM lesson_activities a
     JOIN lessons l ON l.id = a.lesson_id
     WHERE a.content IS NOT NULL
     ORDER BY a.lesson_id, a.sequence_order, a.id`
  ).all() as ActivityRow[];

  let updated = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      let content: JsonRecord;
      try {
        content = JSON.parse(row.content ?? "{}");
      } catch {
        continue;
      }
      const result = updateQuiz(content, row);
      if (!result.changed) continue;
      db.prepare(
        `UPDATE lesson_activities
         SET content = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(JSON.stringify(result.content), row.id);
      updated++;
    }
  });
  tx();
  const diagnostics = ensureLesson4Diagnostics(4);
  console.log(`Backfilled grounded quiz metadata on ${updated} activity/activities`);
  console.log(`Updated lesson 4 look-ahead diagnostics on ${diagnostics} lesson(s)`);
  closeDb();
}

main();
