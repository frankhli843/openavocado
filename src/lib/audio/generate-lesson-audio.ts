/**
 * Generate the real audio file for a lesson's audio activity and record it in
 * `generated_artifacts`. This is the durable creation path: run it after the
 * database is seeded/backfilled (see `pnpm audio:generate`) so every lesson
 * whose audio activity has a script ends up with a real, playable MP3 served by
 * the `/runtime/[...path]` route — never a placeholder row pointing at a 404.
 *
 * Idempotent: if a file already exists whose content matches the current script
 * version, generation is skipped unless `force` is set.
 */
import type Database from "better-sqlite3";
import { createHash } from "crypto";
import fs from "fs";

import { activityAudioRelPath, lessonAudioRelPath, resolveRuntimeFile } from "./runtime-storage";
import { synthesizeSpeech, type TtsProvider } from "./tts";

export interface GenerateResult {
  lessonId: number;
  status: "generated" | "skipped-exists" | "no-audio-activity" | "empty-script";
  provider?: string;
  filePath?: string;
  relPath?: string;
  durationSec?: number;
  contentHash?: string;
}

interface AudioActivityRow {
  id: number;
  activity_type: string;
  sequence_order: number;
  content: string | null;
}

/** Short stable version tag for a script (so we can detect script changes). */
function scriptVersion(script: string): string {
  return "sha256:" + createHash("sha256").update(script).digest("hex").slice(0, 16);
}

/**
 * Generate (or reuse) the audio artifact for one lesson.
 *
 * @param db        open better-sqlite3 handle for the target database
 * @param lessonId  lesson to process
 * @param opts.force  regenerate even if an up-to-date file exists
 * @param opts.provider force a TTS provider (mainly for tests)
 */
export async function generateLessonAudio(
  db: Database.Database,
  lessonId: number,
  opts: { force?: boolean; provider?: TtsProvider } = {}
): Promise<GenerateResult> {
  const activities = db
    .prepare(
      `SELECT id, activity_type, sequence_order, content FROM lesson_activities
       WHERE lesson_id = ? AND activity_type IN ('audio', 'lesson_part')
       ORDER BY CASE activity_type WHEN 'audio' THEN 0 ELSE 1 END, sequence_order ASC`
    )
    .all(lessonId) as AudioActivityRow[];

  if (activities.length === 0) return { lessonId, status: "no-audio-activity" };

  let primary: GenerateResult | null = null;
  for (const activity of activities) {
    const result = await generateActivityAudio(db, lessonId, activity, opts);
    if (!primary || activity.activity_type === "audio") primary = result;
  }
  return primary ?? { lessonId, status: "no-audio-activity" };
}

async function generateActivityAudio(
  db: Database.Database,
  lessonId: number,
  activity: AudioActivityRow,
  opts: { force?: boolean; provider?: TtsProvider } = {}
): Promise<GenerateResult> {
  let script = "";
  try {
    const parsed = activity.content ? JSON.parse(activity.content) : {};
    script = (
      activity.activity_type === "lesson_part"
        ? parsed.audio?.script ?? ""
        : parsed.script ?? ""
    ).toString().trim();
  } catch {
    script = "";
  }
  if (!script) return { lessonId, status: "empty-script" };

  const relPath =
    activity.activity_type === "audio"
      ? lessonAudioRelPath(lessonId)
      : activityAudioRelPath(lessonId, activity.id);
  // Resolve the write path through the same resolver the `/runtime/[...path]`
  // serving route uses, so generated audio honors AVOCADOCORE_RUNTIME_ROOT (set
  // on frank-dev to /var/prodavo/runtime_artifacts) and never drifts from the
  // served location. Falls back to <cwd>/runtime_artifacts when unset (local).
  const absPath = resolveRuntimeFile(relPath);
  if (!absPath) {
    throw new Error(
      `generate-lesson-audio: refusing unsafe/unresolvable runtime path "${relPath}"`
    );
  }
  const version = scriptVersion(script);

  // Idempotency: skip if a file exists and the recorded script_version matches.
  if (!opts.force && fs.existsSync(absPath) && fs.statSync(absPath).size > 0) {
    const existing = db
      .prepare(
        `SELECT script_version FROM generated_artifacts
         WHERE lesson_id = ? AND activity_id = ? AND artifact_type = 'audio'
         ORDER BY generated_at DESC LIMIT 1`
      )
      .get(lessonId, activity.id) as { script_version: string | null } | undefined;
    if (existing && existing.script_version === version) {
      return {
        lessonId,
        status: "skipped-exists",
        filePath: absPath,
        relPath,
      };
    }
  }

  const result = await synthesizeSpeech(script, {
    outPath: absPath,
    // Let the adapter pick a provider-appropriate default voice. Generated
    // lessons use Doraemon edge TTS by default.
    provider: opts.provider,
  });

  // Upsert the artifact row: replace any prior audio rows for this lesson so we
  // never accumulate stale placeholder metadata.
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM generated_artifacts WHERE lesson_id = ? AND activity_id = ? AND artifact_type = 'audio'`
    ).run(lessonId, activity.id);
    db.prepare(
      `INSERT INTO generated_artifacts
         (lesson_id, activity_id, artifact_type, provider, voice, duration_sec,
          content_hash, file_path, source_script, script_version, generated_at)
       VALUES (?, ?, 'audio', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      lessonId,
      activity.id,
      result.provider,
      result.voice,
      result.durationSec,
      result.contentHash,
      relPath,
      script,
      version
    );
  });
  tx();

  return {
    lessonId,
    status: "generated",
    provider: result.provider,
    filePath: result.filePath,
    relPath,
    durationSec: result.durationSec,
    contentHash: result.contentHash,
  };
}

/** Generate audio for every lesson that has an audio activity with a script. */
export async function generateAllLessonAudio(
  db: Database.Database,
  opts: { force?: boolean; provider?: TtsProvider } = {}
): Promise<GenerateResult[]> {
  const lessons = db
    .prepare(
      `SELECT DISTINCT lesson_id AS id FROM lesson_activities
       WHERE activity_type = 'audio' ORDER BY lesson_id ASC`
    )
    .all() as Array<{ id: number }>;
  const out: GenerateResult[] = [];
  for (const { id } of lessons) {
    out.push(await generateLessonAudio(db, id, opts));
  }
  return out;
}
