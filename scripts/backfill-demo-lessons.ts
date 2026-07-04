#!/usr/bin/env tsx
/**
 * Repair every learner's built-in demo subject to the current demo lesson
 * contract. This preserves existing lesson and activity ids when possible,
 * because ensureDemoLessonsForLearner upserts in place.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-demo-lessons.ts
 *   pnpm tsx scripts/backfill-demo-lessons.ts --audio
 *   AVOCADOCORE_DB_PATH=/var/prodavo/data/avocadocore.db pnpm tsx scripts/backfill-demo-lessons.ts --audio
 */
import { closeDb, getDb } from "../src/db/connection";
import {
  ensureDemoLessonAudioForLearner,
  ensureDemoLessonsForLearner,
} from "../src/lib/demo-lessons";
import { DEMO_SUBJECT_TITLE } from "../src/lib/demo-subject";

interface LearnerRow {
  id: number;
}

async function main() {
  const repairAudio = process.argv.slice(2).includes("--audio");
  const db = getDb();
  const learners = db
    .prepare("SELECT id FROM learner_profiles ORDER BY id ASC")
    .all() as LearnerRow[];

  let repairedSubjects = 0;
  const tx = db.transaction(() => {
    for (const learner of learners) {
      ensureDemoLessonsForLearner(db, learner.id);
      repairedSubjects += 1;
    }
  });
  tx();

  const demoSubjectCount = db
    .prepare("SELECT COUNT(*) AS count FROM subjects WHERE title = ?")
    .get(DEMO_SUBJECT_TITLE) as { count: number };

  let audioChecked = 0;
  if (repairAudio) {
    for (const learner of learners) {
      await ensureDemoLessonAudioForLearner(db, learner.id);
      audioChecked += 1;
    }
  }

  console.log(
    `Backfilled demo lessons for ${repairedSubjects} learner profile(s). Demo subject count: ${demoSubjectCount.count}. Audio repair: ${repairAudio ? `${audioChecked} learner profile(s)` : "skipped"}.`
  );
  closeDb();
}

main().catch((error) => {
  console.error("Demo lesson backfill failed:", error);
  closeDb();
  process.exit(1);
});
