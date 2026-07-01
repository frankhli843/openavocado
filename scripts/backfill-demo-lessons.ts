#!/usr/bin/env tsx
/**
 * Repair every learner's built-in demo subject to the current demo lesson
 * contract. This preserves existing lesson and activity ids when possible,
 * because ensureDemoLessonsForLearner upserts in place.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-demo-lessons.ts
 *   AVOCADOCORE_DB_PATH=/var/prodavo/data/avocadocore.db pnpm tsx scripts/backfill-demo-lessons.ts
 */
import { getDb } from "../src/db/connection";
import { DEMO_SUBJECT_TITLE, ensureDemoLessonsForLearner } from "../src/lib/demo-lessons";

interface LearnerRow {
  id: number;
}

function main() {
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

  console.log(
    `Backfilled demo lessons for ${repairedSubjects} learner profile(s). Demo subject count: ${demoSubjectCount.count}.`
  );
}

main();
