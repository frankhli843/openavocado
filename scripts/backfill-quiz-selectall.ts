/**
 * Backfill: convert every single-answer (bare correct_index) MC question in the
 * ACTIVE lessons to select-all format, author new final quizzes for L15/26/27,
 * and remove the dead (never-rendered) lesson_part quizzes on L7.
 *
 * The converted content lives in scripts/quiz-selectall/act<id>.json so the
 * backfill is reproducible and reviewable. Each file:
 *   {
 *     "activityId": 36,
 *     "lessonId": 5,
 *     "op": "assessment_quiz" | "new_assessment_quiz" | "part_practice" | "delete_part_quiz",
 *     "questions": [ ... ]           // omitted for delete_part_quiz
 *   }
 *
 * ops:
 *   assessment_quiz      set content.quiz.questions = questions (preserve quiz meta)
 *   new_assessment_quiz  create content.quiz = {meta, questions} on an assessment
 *                        activity that currently has no MC quiz
 *   part_practice        set content.practice.questions = questions
 *   delete_part_quiz     delete content.quiz (dead when content.practice exists)
 *
 * Every edit is validated with the real schema validators before any write, and
 * a DB backup is taken first.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-quiz-selectall.ts --validate   # dry run, no writes
 *   pnpm tsx scripts/backfill-quiz-selectall.ts              # write (backs up DB)
 *   pnpm tsx scripts/backfill-quiz-selectall.ts --only 36    # single activity
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  validateMultipleChoiceQuizContent,
  validateLessonPartPracticeContent,
} from "../src/lib/lesson-content/schema";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH ?? path.join(process.cwd(), "data", "avocadocore.db");
const CONTENT_DIR = path.join(__dirname, "quiz-selectall");
const VALIDATE_ONLY = process.argv.includes("--validate");
const onlyIdx = process.argv.indexOf("--only");
const ONLY_ID = onlyIdx >= 0 ? Number(process.argv[onlyIdx + 1]) : null;

const DEFAULT_QUIZ_META = {
  pass_threshold: 6,
  consecutive_correct_required: 6,
  idk_option: true,
  grounding_required: true,
};

interface EditFile {
  activityId: number;
  lessonId: number;
  op: "assessment_quiz" | "new_assessment_quiz" | "part_practice" | "delete_part_quiz";
  questions?: any[];
}

function loadEdits(): EditFile[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), "utf8")) as EditFile)
    .sort((a, b) => a.activityId - b.activityId);
}

function applyEdit(content: Record<string, any>, edit: EditFile): { errors: string[] } {
  switch (edit.op) {
    case "assessment_quiz": {
      if (!content.quiz || !Array.isArray(content.quiz.questions)) {
        return { errors: [`activity ${edit.activityId}: assessment_quiz op but no existing content.quiz.questions`] };
      }
      content.quiz.questions = edit.questions;
      return { errors: validateMultipleChoiceQuizContent(content.quiz).errors };
    }
    case "new_assessment_quiz": {
      if (content.quiz && Array.isArray(content.quiz.questions) && content.quiz.questions.length) {
        return { errors: [`activity ${edit.activityId}: new_assessment_quiz op but content.quiz already exists`] };
      }
      content.quiz = { ...DEFAULT_QUIZ_META, questions: edit.questions };
      return { errors: validateMultipleChoiceQuizContent(content.quiz).errors };
    }
    case "part_practice": {
      if (!content.practice || typeof content.practice !== "object") {
        return { errors: [`activity ${edit.activityId}: part_practice op but no content.practice`] };
      }
      content.practice.questions = edit.questions;
      // A lesson_part that has practice never renders its content.quiz (see
      // LessonPartSection: practice takes precedence). Drop the dead quiz so it
      // stops contributing bare correct_index questions to the gate.
      if (content.quiz) delete content.quiz;
      return { errors: validateLessonPartPracticeContent(content.practice).errors };
    }
    case "delete_part_quiz": {
      if (content.quiz) delete content.quiz;
      return { errors: [] };
    }
    default:
      return { errors: [`activity ${edit.activityId}: unknown op ${edit.op}`] };
  }
}

function main() {
  const edits = loadEdits().filter((e) => (ONLY_ID == null ? true : e.activityId === ONLY_ID));
  if (!edits.length) {
    console.log("no edit files found in", CONTENT_DIR);
    return;
  }
  const db = new Database(DB_PATH);
  const getStmt = db.prepare("select id, lesson_id, activity_type, content from lesson_activities where id = ?");

  const results: Array<{ edit: EditFile; content: string; errors: string[] }> = [];
  let hardErrors = 0;
  for (const edit of edits) {
    const row = getStmt.get(edit.activityId) as any;
    if (!row) {
      console.log(`MISSING activity ${edit.activityId}`);
      hardErrors++;
      continue;
    }
    if (row.lesson_id !== edit.lessonId) {
      console.log(`LESSON MISMATCH act ${edit.activityId}: db=${row.lesson_id} file=${edit.lessonId}`);
      hardErrors++;
      continue;
    }
    const content = JSON.parse(row.content);
    const { errors } = applyEdit(content, edit);
    if (errors.length) {
      hardErrors += errors.length;
      console.log(`FAIL act ${edit.activityId} (L${edit.lessonId}, ${edit.op}):`);
      for (const e of errors) console.log("   -", e);
    } else {
      console.log(`ok   act ${edit.activityId} (L${edit.lessonId}, ${edit.op})`);
    }
    results.push({ edit, content: JSON.stringify(content), errors });
  }

  if (hardErrors) {
    console.log(`\n${hardErrors} validation error(s), NO WRITES.`);
    db.close();
    process.exit(1);
  }
  if (VALIDATE_ONLY) {
    console.log(`\n--validate: ${results.length} edits pass. No writes.`);
    db.close();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = DB_PATH.replace(/\.db$/, `.before-quiz-selectall-${stamp}.db`);
  fs.copyFileSync(DB_PATH, backup);
  console.log(`\nbackup -> ${backup}`);

  const upd = db.prepare("update lesson_activities set content = ?, updated_at = ? where id = ?");
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const r of results) upd.run(r.content, now, r.edit.activityId);
  });
  tx();
  console.log(`wrote ${results.length} activities.`);
  db.close();
}

main();
