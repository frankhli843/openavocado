#!/usr/bin/env tsx
/**
 * register-video.ts <lesson_id> <activity_id>
 *
 * Registers a finished, reviewed segment MP4 into the DB so the renderer will
 * prefer it over the legacy cue path. Two writes in ONE transaction:
 *   1. insert a generated_artifacts row (artifact_type='video', file_path,
 *      duration_sec, content_hash, width/height in source_script JSON);
 *   2. set the LessonSegmentVideo object in the activity content JSON —
 *      content.audio.video for a lesson_part, content.orientation_video for the
 *      orientation audio activity.
 *
 * HARD GATE: refuses to register unless a valid review.json exists at
 *   manim/review/lesson_<id>/<activity>/review.json
 * with iterations>=1, a non-empty frames[] list, and no unresolved "fix"
 * verdicts. This is the machine-checkable proof that the manual frame review
 * actually happened (mirrors "a UI summary without screenshots is rejected").
 *
 * Requires: ffprobe on PATH; better-sqlite3 under node 22.
 * Env: AVOCADOCORE_DB_PATH (live DB), AVOCADOCORE_RUNTIME_ROOT (live tree).
 *
 * Usage: tsx scripts/register-video.ts 15 85
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import Database from "better-sqlite3";

const lessonId = Number(process.argv[2]);
const activityId = Number(process.argv[3]);
if (!Number.isInteger(lessonId) || !Number.isInteger(activityId)) {
  console.error("usage: tsx scripts/register-video.ts <lesson_id> <activity_id>");
  process.exit(2);
}

const dbPath = process.env.AVOCADOCORE_DB_PATH ?? "data/avocadocore.db";
const RUNTIME_ROOT = process.env.AVOCADOCORE_RUNTIME_ROOT ?? process.cwd();
const MANIM_VERSION = "manim-ce/0.19.1";

function die(msg: string): never {
  console.error(`REFUSED: ${msg}`);
  process.exit(1);
}

// ─── 1. review.json gate ─────────────────────────────────────────────────────
const reviewPath = path.join(
  __dirname,
  "..",
  "manim",
  "review",
  `lesson_${lessonId}`,
  String(activityId),
  "review.json"
);
if (!fs.existsSync(reviewPath)) {
  die(`no review.json at ${reviewPath} — the manual frame review must run before registration`);
}
type Frame = { cue: number; kind: string; path: string; verdict: string; notes?: string };
type Review = {
  lesson_id: number;
  activity_id: number;
  reviewed_at: string;
  iterations: number;
  frames_reviewed: number;
  frames: Frame[];
  quality?: string;
};
let review: Review;
try {
  review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
} catch (e) {
  die(`review.json is not valid JSON: ${(e as Error).message}`);
}
if (review.activity_id !== activityId || review.lesson_id !== lessonId) {
  die(`review.json is for lesson ${review.lesson_id}/activity ${review.activity_id}, not ${lessonId}/${activityId}`);
}
if (!Number.isFinite(review.iterations) || review.iterations < 1) {
  die(`review.json iterations must be >= 1 (got ${review.iterations})`);
}
if (!Array.isArray(review.frames) || review.frames.length === 0) {
  die(`review.json has no frames[] — nothing was reviewed`);
}
const unresolved = review.frames.filter((f) => f.verdict !== "pass");
if (unresolved.length > 0) {
  die(
    `review.json has ${unresolved.length} unresolved non-pass verdict(s) (e.g. cue ${unresolved[0].cue} "${unresolved[0].verdict}") — fix and re-render before registering`
  );
}

// ─── 2. locate + probe the MP4 ───────────────────────────────────────────────
const relVideoPath = `runtime_artifacts/videos/lesson_${lessonId}/activity_${activityId}.mp4`;
const absVideo = path.join(RUNTIME_ROOT, relVideoPath);
if (!fs.existsSync(absVideo)) {
  die(`video not found at ${absVideo}`);
}
function ffprobe(args: string[]): string {
  return execFileSync("ffprobe", args, { encoding: "utf8" }).trim();
}
const durationSec = Number(
  ffprobe(["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", absVideo])
);
const dims = ffprobe([
  "-v",
  "error",
  "-select_streams",
  "v:0",
  "-show_entries",
  "stream=width,height",
  "-of",
  "csv=s=x:p=0",
  absVideo,
]);
const [width, height] = dims.split("x").map((n) => Number(n));
if (!Number.isFinite(durationSec) || durationSec <= 0) die(`ffprobe returned bad duration ${durationSec}`);
if (!width || !height) die(`ffprobe returned bad dimensions ${dims}`);

const buf = fs.readFileSync(absVideo);
const contentHash = crypto.createHash("sha256").update(buf).digest("hex");

// Optional sidecars.
const relPoster = `runtime_artifacts/videos/lesson_${lessonId}/activity_${activityId}.poster.png`;
const relCaptions = `runtime_artifacts/videos/lesson_${lessonId}/activity_${activityId}.vtt`;
const hasPoster = fs.existsSync(path.join(RUNTIME_ROOT, relPoster));
const hasCaptions = fs.existsSync(path.join(RUNTIME_ROOT, relCaptions));

// ─── 3. build the LessonSegmentVideo object ──────────────────────────────────
const sceneModule = `manim/scenes/lesson_${lessonId}/activity_${activityId}.py`;
const videoObj = {
  file_path: relVideoPath,
  poster_path: hasPoster ? relPoster : undefined,
  captions_path: hasCaptions ? relCaptions : undefined,
  duration_sec: Number(durationSec.toFixed(3)),
  width,
  height,
  source: { tool: "manim-ce", version: MANIM_VERSION, scene_module: sceneModule },
  review: {
    reviewed_at: review.reviewed_at,
    frames_reviewed: review.frames_reviewed ?? review.frames.length,
    iterations: review.iterations,
  },
};

// ─── 4. transactional write ──────────────────────────────────────────────────
const db = new Database(dbPath);
const row = db
  .prepare(`SELECT activity_type, content FROM lesson_activities WHERE id = ? AND lesson_id = ?`)
  .get(activityId, lessonId) as { activity_type: string; content: string | null } | undefined;
if (!row) die(`activity ${activityId} not found in lesson ${lessonId}`);

const content = row.content ? JSON.parse(row.content) : {};
if (row.activity_type === "audio") {
  content.orientation_video = videoObj;
} else if (row.activity_type === "lesson_part") {
  content.audio = content.audio ?? {};
  content.audio.video = videoObj;
} else {
  die(`activity ${activityId} is '${row.activity_type}', not audio/lesson_part`);
}

const tx = db.transaction(() => {
  // Replace any prior video artifact for this activity so re-registration is idempotent.
  db.prepare(`DELETE FROM generated_artifacts WHERE activity_id = ? AND artifact_type = 'video'`).run(
    activityId
  );
  db.prepare(
    `INSERT INTO generated_artifacts
       (lesson_id, activity_id, artifact_type, provider, duration_sec, content_hash,
        file_path, source_script, script_version, generated_at, created_at)
     VALUES (?, ?, 'video', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(
    lessonId,
    activityId,
    "manim-ce",
    videoObj.duration_sec,
    contentHash,
    relVideoPath,
    JSON.stringify({ width, height, scene_module: sceneModule, poster: relPoster, captions: relCaptions }),
    MANIM_VERSION
  );
  db.prepare(`UPDATE lesson_activities SET content = ?, updated_at = datetime('now') WHERE id = ?`).run(
    JSON.stringify(content),
    activityId
  );
});
tx();

// Verify.
const artCount = (
  db.prepare(`SELECT COUNT(*) c FROM generated_artifacts WHERE activity_id = ? AND artifact_type = 'video'`).get(
    activityId
  ) as { c: number }
).c;
db.close();

console.log(
  `Registered video for lesson ${lessonId} activity ${activityId} (${row.activity_type}):\n` +
    `  file_path:   ${relVideoPath}\n` +
    `  duration:    ${videoObj.duration_sec}s  dims: ${width}x${height}\n` +
    `  content_hash:${contentHash.slice(0, 16)}…\n` +
    `  poster:      ${hasPoster ? "yes" : "MISSING"}   captions: ${hasCaptions ? "yes" : "MISSING"}\n` +
    `  review:      ${videoObj.review.frames_reviewed} frames, ${videoObj.review.iterations} iteration(s)\n` +
    `  artifact rows now: ${artCount}`
);
