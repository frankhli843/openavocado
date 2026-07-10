#!/usr/bin/env tsx
/**
 * audit-videos.ts [--lesson <id>]
 *
 * Verifies each published audio segment has a registered reviewed Manim video:
 * content video object, generated_artifacts video row, MP4 file, duration match
 * to the audio row within 0.5s, poster, VTT captions, and review.json covering
 * every storyboard cue.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import Database from "better-sqlite3";

const args = process.argv.slice(2);
const lessonArgIndex = args.indexOf("--lesson");
const lessonId = lessonArgIndex >= 0 ? Number(args[lessonArgIndex + 1]) : null;
if (lessonArgIndex >= 0 && !Number.isInteger(lessonId)) {
  console.error("usage: tsx scripts/audit-videos.ts [--lesson <id>]");
  process.exit(2);
}

const dbPath = process.env.AVOCADOCORE_DB_PATH ?? "data/avocadocore.db";
const runtimeRoot = process.env.AVOCADOCORE_RUNTIME_ROOT ?? path.join(process.cwd(), "runtime_artifacts");

type ActivityRow = {
  id: number;
  lesson_id: number;
  activity_type: string;
  title: string;
  content: string | null;
};

type ArtifactRow = {
  activity_id: number;
  artifact_type: string;
  file_path: string | null;
  duration_sec: number | null;
};

function runtimePath(relPath: string | null | undefined): string | null {
  if (!relPath) return null;
  return path.join(runtimeRoot, relPath.replace(/^runtime_artifacts\//, ""));
}

function ffprobeDuration(file: string): number {
  return Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], {
      encoding: "utf8",
    }).trim()
  );
}

function fail(errors: string[], message: string): void {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

const db = new Database(dbPath, { readonly: true });
const activities = db
  .prepare(
    `SELECT id, lesson_id, activity_type, title, content
       FROM lesson_activities
      WHERE activity_type IN ('audio', 'lesson_part')
        ${lessonId != null ? "AND lesson_id = ?" : ""}
      ORDER BY lesson_id, id`
  )
  .all(...(lessonId != null ? [lessonId] : [])) as ActivityRow[];

const errors: string[] = [];
let checked = 0;

for (const activity of activities) {
  const content = activity.content ? JSON.parse(activity.content) : {};
  const video = activity.activity_type === "audio" ? content.orientation_video : content.audio?.video;
  const label = `lesson ${activity.lesson_id} activity ${activity.id}`;
  if (!video) {
    fail(errors, `${label} has no registered video object`);
    continue;
  }

  const artifacts = db
    .prepare(
      `SELECT activity_id, artifact_type, file_path, duration_sec
         FROM generated_artifacts
        WHERE activity_id = ? AND artifact_type IN ('audio', 'video')
        ORDER BY generated_at DESC`
    )
    .all(activity.id) as ArtifactRow[];
  const audioRow = artifacts.find((row) => row.artifact_type === "audio");
  const videoRow = artifacts.find((row) => row.artifact_type === "video");
  if (!audioRow) fail(errors, `${label} has no generated_artifacts audio row`);
  if (!videoRow) fail(errors, `${label} has no generated_artifacts video row`);
  if (videoRow?.file_path !== video.file_path) {
    fail(errors, `${label} video row path ${videoRow?.file_path ?? "missing"} does not match content ${video.file_path}`);
  }

  const videoFile = runtimePath(video.file_path);
  const posterFile = runtimePath(video.poster_path);
  const captionsFile = runtimePath(video.captions_path);
  if (!videoFile || !fs.existsSync(videoFile)) fail(errors, `${label} MP4 missing at ${videoFile ?? "null"}`);
  if (!posterFile || !fs.existsSync(posterFile)) fail(errors, `${label} poster missing at ${posterFile ?? "null"}`);
  if (!captionsFile || !fs.existsSync(captionsFile)) fail(errors, `${label} captions missing at ${captionsFile ?? "null"}`);

  if (videoFile && fs.existsSync(videoFile) && audioRow?.duration_sec != null) {
    const duration = ffprobeDuration(videoFile);
    const drift = Math.abs(duration - audioRow.duration_sec);
    if (drift > 0.5) {
      fail(errors, `${label} MP4 duration ${duration.toFixed(3)}s differs from audio ${audioRow.duration_sec}s by ${drift.toFixed(3)}s`);
    }
  }

  const storyboardPath = path.join(process.cwd(), "manim", "storyboards", `lesson_${activity.lesson_id}`, `segment_${activity.id}.json`);
  const reviewPath = path.join(process.cwd(), "manim", "review", `lesson_${activity.lesson_id}`, String(activity.id), "review.json");
  if (!fs.existsSync(storyboardPath)) {
    fail(errors, `${label} storyboard missing at ${storyboardPath}`);
  }
  if (!fs.existsSync(reviewPath)) {
    fail(errors, `${label} review.json missing at ${reviewPath}`);
  }
  if (fs.existsSync(storyboardPath) && fs.existsSync(reviewPath)) {
    const storyboard = JSON.parse(fs.readFileSync(storyboardPath, "utf8")) as { cues?: Array<{ index: number }> };
    const review = JSON.parse(fs.readFileSync(reviewPath, "utf8")) as {
      lesson_id?: number;
      activity_id?: number;
      iterations?: number;
      frames?: Array<{ cue: number; kind: string; path?: string; verdict: string }>;
    };
    if (review.lesson_id !== activity.lesson_id || review.activity_id !== activity.id) {
      fail(errors, `${label} review.json identifiers do not match`);
    }
    if (!review.iterations || review.iterations < 1) fail(errors, `${label} review iterations missing`);
    const frames = review.frames ?? [];
    if (frames.some((frame) => frame.verdict !== "pass")) fail(errors, `${label} review has non-pass frames`);
    for (const frame of frames) {
      if (!frame.path || !fs.existsSync(path.join(process.cwd(), frame.path))) {
        fail(errors, `${label} review frame missing on disk: ${frame.path ?? "missing path"}`);
      }
    }
    for (const cue of storyboard.cues ?? []) {
      const kinds = new Set(frames.filter((frame) => frame.cue === cue.index).map((frame) => frame.kind));
      for (const kind of ["start", "mid", "end"]) {
        if (!kinds.has(kind)) fail(errors, `${label} review missing ${kind} frame for cue ${cue.index}`);
      }
    }
  }

  checked += 1;
  console.log(`ok: ${label} ${activity.title}`);
}

db.close();

if (errors.length > 0) {
  console.error(`Video audit failed: ${errors.length} error(s), ${checked} segment(s) checked.`);
  process.exit(1);
}

console.log(`Video audit passed: ${checked} segment(s) checked.`);
