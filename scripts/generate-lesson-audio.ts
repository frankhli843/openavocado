#!/usr/bin/env tsx
/**
 * Generate real, playable audio for lesson audio activities and record the
 * artifacts in the configured database. This is the durable creation path the
 * `/runtime/[...path]` route serves from.
 *
 * Usage:
 *   pnpm audio:generate            # all lessons that have an audio activity
 *   pnpm audio:generate 4          # only lesson 4
 *   pnpm audio:generate --force    # regenerate even if up-to-date
 *   AVOCADOCORE_DB_PATH=/tmp/x.db pnpm audio:generate   # target a specific DB
 *
 * Provider order is OpenAI TTS (if OPENAI_API_KEY + quota) then the offline
 * espeak-ng fallback (apt: espeak-ng), so it works with no network/quota.
 */
import { getDb, closeDb } from "../src/db/connection";
import {
  generateAllLessonAudio,
  generateLessonAudio,
} from "../src/lib/audio/generate-lesson-audio";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const ids = args
    .filter((a) => /^\d+$/.test(a))
    .map((a) => parseInt(a, 10));

  const db = getDb();
  const results =
    ids.length > 0
      ? await Promise.all(ids.map((id) => generateLessonAudio(db, id, { force })))
      : await generateAllLessonAudio(db, { force });

  for (const r of results) {
    if (r.status === "generated") {
      console.log(
        `lesson ${r.lessonId}: ${r.status} via ${r.provider} (${r.durationSec}s) -> ${r.relPath}`
      );
    } else {
      console.log(`lesson ${r.lessonId}: ${r.status}`);
    }
  }
  closeDb();
}

main().catch((e) => {
  console.error("Audio generation failed:", e);
  process.exit(1);
});
