#!/usr/bin/env tsx
/**
 * Semantic QA reviewer CLI — invoke the reviewer on any lesson_id.
 *
 * Usage:
 *   tsx scripts/semantic-qa-review.ts <lesson_id>                  # full review (needs reviewer command)
 *   tsx scripts/semantic-qa-review.ts <lesson_id> --prescreen-only # deterministic flags only, no ACP call
 *   tsx scripts/semantic-qa-review.ts <lesson_id> --print-prompt   # print the reviewer prompt and exit
 *   tsx scripts/semantic-qa-review.ts <lesson_id> --json           # machine-readable output
 *
 * Env:
 *   AVOCADOCORE_DB_PATH               — SQLite DB (same as the app)
 *   AVOCADOCORE_QA_REVIEWER_COMMAND   — ACP reviewer command (required for full review)
 *   AVOCADOCORE_QA_REVIEWER_TIMEOUT_MS
 *
 * Exit code: 0 if approved (or prescreen/print modes), 2 if rejected, 1 on error.
 */

import { getDb, closeDb } from "../src/db/connection";
import {
  gatherLessonForReview,
  buildReviewPrompt,
  reviewLesson,
} from "../src/lib/lesson-qa";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const lessonId = Number(args.find((a) => /^\d+$/.test(a)));
  const json = args.includes("--json");
  const prescreenOnly = args.includes("--prescreen-only");
  const printPrompt = args.includes("--print-prompt");

  if (!lessonId || Number.isNaN(lessonId)) {
    process.stderr.write("Usage: semantic-qa-review.ts <lesson_id> [--prescreen-only|--print-prompt|--json]\n");
    return 1;
  }

  const db = getDb();
  try {
    const gathered = gatherLessonForReview(db, lessonId);

    if (printPrompt) {
      process.stdout.write(buildReviewPrompt(gathered) + "\n");
      return 0;
    }

    if (prescreenOnly) {
      const out = {
        lesson_id: lessonId,
        title: gathered.title,
        transcripts: gathered.transcripts.length,
        cue_timelines: gathered.cueTimelines.length,
        choice_questions: gathered.choiceQuestions.length,
        written_questions: gathered.writtenQuestions.length,
        code_exercises: gathered.codeExercises.length,
        prescreen_flags: gathered.flags,
      };
      if (json) {
        process.stdout.write(JSON.stringify(out, null, 2) + "\n");
      } else {
        process.stdout.write(`Lesson ${lessonId}: ${gathered.title}\n`);
        process.stdout.write(
          `  transcripts=${out.transcripts} cues=${out.cue_timelines} choiceQ=${out.choice_questions} writtenQ=${out.written_questions} code=${out.code_exercises}\n`
        );
        process.stdout.write(`  pre-screen flags (${gathered.flags.length}):\n`);
        for (const f of gathered.flags) {
          process.stdout.write(`   - [${f.severity}] (${f.criterion}) ${f.source}: ${f.detail}\n`);
        }
      }
      return 0;
    }

    const result = await reviewLesson(db, lessonId, {
      reviewerRef: `cli/semantic-qa-review/${lessonId}`,
    });

    if (json) {
      process.stdout.write(
        JSON.stringify(
          { lesson_id: lessonId, review_id: result.reviewId, flag_count: result.flagCount, verdict: result.verdict },
          null,
          2
        ) + "\n"
      );
    } else {
      process.stdout.write(
        `Lesson ${lessonId} — ${result.verdict.approved ? "APPROVED" : "REJECTED"} (review row ${result.reviewId})\n`
      );
      if (result.verdict.approved) {
        for (const e of result.verdict.evidence) process.stdout.write(`  + ${e}\n`);
      } else {
        for (const r of result.verdict.rejections) {
          process.stdout.write(`  - [${r.criterion}] ${r.explanation}\n    fix: ${r.fix_suggestion}\n`);
        }
      }
    }
    return result.verdict.approved ? 0 : 2;
  } finally {
    closeDb();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`semantic-qa-review error: ${msg}\n`);
    process.exit(1);
  });
