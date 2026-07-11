#!/usr/bin/env tsx
/**
 * backfill-video-status.ts  (pnpm backfill:video-status)
 *
 * Video-first inventory + classification for lessons.video_status
 * (2026-07-11 directive: completed lessons are reviewed Manim segment videos,
 * audio/cue panels are authoring inputs or temporary historical fallback).
 *
 * For every non-discarded lesson it evaluates segment-video coverage
 * (orientation `content.orientation_video`, lesson_part `content.audio.video`,
 * generated_artifacts video rows, mp4/poster/captions on disk) and reports:
 *   - lessons with full coverage        → promote video_status to 'ready'
 *   - lessons with partial/no coverage  → stay 'legacy' (historical fallback)
 *     unless already 'pending_video' (new-generation state, left untouched)
 *   - per-segment gaps: missing video object / artifact row / mp4 / poster / vtt
 *
 * Dry-run by default; `--apply` persists the promotions. `--json` prints the
 * machine-readable inventory (used for the prod backfill batches).
 *
 * Env: AVOCADOCORE_DB_PATH (default data/avocadocore.db),
 *      AVOCADOCORE_RUNTIME_ROOT (default cwd).
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { evaluateLessonVideoCoverage } from "../src/lib/lesson-generator/video-status";

const dbPath = process.env.AVOCADOCORE_DB_PATH ?? "data/avocadocore.db";
const runtimeRoot = process.env.AVOCADOCORE_RUNTIME_ROOT ?? process.cwd();
const apply = process.argv.includes("--apply");
const json = process.argv.includes("--json");

const db = new Database(dbPath);

interface LessonRow {
  id: number;
  subject_id: number;
  title: string;
  status: string;
  video_status: string;
  subject_status: string;
  generated_by: string | null;
  created_at: string;
}

const lessons = db
  .prepare(
    `SELECT l.id, l.subject_id, l.title, l.status, COALESCE(l.video_status, 'legacy') AS video_status,
            s.status AS subject_status, l.generated_by, l.created_at
     FROM lessons l JOIN subjects s ON s.id = l.subject_id
     WHERE l.status != 'discarded'
     ORDER BY l.id`
  )
  .all() as LessonRow[];

function runtimePath(relPath: string): string {
  return path.join(runtimeRoot, relPath.replace(/^runtime_artifacts\//, ""));
}

interface SegmentGap {
  activity_id: number;
  activity_type: string;
  missing: string[];
}

interface LessonReport {
  lesson_id: number;
  subject_id: number;
  title: string;
  status: string;
  subject_status: string;
  video_status_before: string;
  video_status_after: string;
  segments_total: number;
  segments_with_video: number;
  gaps: SegmentGap[];
}

const reports: LessonReport[] = [];
let promoted = 0;

for (const lesson of lessons) {
  const coverage = evaluateLessonVideoCoverage(db, lesson.id, { runtimeRoot, checkFiles: true });
  const gaps: SegmentGap[] = [];

  for (const segment of coverage.segments) {
    const missing: string[] = [];
    if (!segment.video_required) continue;
    if (!segment.has_video) {
      missing.push("video");
    } else {
      // Registered video: verify the sidecar files the player depends on.
      const activity = db
        .prepare("SELECT content FROM lesson_activities WHERE id = ?")
        .get(segment.activity_id) as { content: string | null } | undefined;
      try {
        const content = JSON.parse(activity?.content ?? "null") as Record<string, unknown> | null;
        const video =
          segment.activity_type === "audio"
            ? (content?.orientation_video as Record<string, unknown> | undefined)
            : ((content?.audio as Record<string, unknown> | undefined)?.video as
                | Record<string, unknown>
                | undefined);
        const filePath = typeof video?.file_path === "string" ? video.file_path : null;
        const posterPath = typeof video?.poster_path === "string" ? video.poster_path : null;
        const captionsPath = typeof video?.captions_path === "string" ? video.captions_path : null;
        if (!filePath || !fs.existsSync(runtimePath(filePath))) missing.push("mp4_file");
        if (!posterPath || !fs.existsSync(runtimePath(posterPath))) missing.push("poster");
        if (!captionsPath || !fs.existsSync(runtimePath(captionsPath))) missing.push("captions_vtt");
      } catch {
        missing.push("content_parse");
      }
    }
    if (missing.length > 0) gaps.push({ activity_id: segment.activity_id, activity_type: segment.activity_type, missing });
  }

  let after = lesson.video_status;
  if (coverage.ready && gaps.length === 0 && lesson.video_status !== "ready") {
    after = "ready";
    if (apply) {
      db.prepare(
        "UPDATE lessons SET video_status = 'ready', updated_at = datetime('now') WHERE id = ?"
      ).run(lesson.id);
    }
    promoted += 1;
  }

  reports.push({
    lesson_id: lesson.id,
    subject_id: lesson.subject_id,
    title: lesson.title,
    status: lesson.status,
    subject_status: lesson.subject_status,
    video_status_before: lesson.video_status,
    video_status_after: after,
    segments_total: coverage.segments.length,
    segments_with_video: coverage.segments.filter((segment) => segment.has_video).length,
    gaps,
  });
}

const covered = reports.filter((report) => report.video_status_after === "ready");
const pending = reports.filter((report) => report.video_status_after === "pending_video");
const legacyGaps = reports.filter(
  (report) => report.video_status_after === "legacy" && report.segments_total > 0
);
const noSegments = reports.filter(
  (report) => report.segments_total === 0 && report.video_status_after !== "ready"
);

const summary = {
  db_path: dbPath,
  runtime_root: runtimeRoot,
  applied: apply,
  lessons_total: reports.length,
  ready: covered.length,
  pending_video: pending.length,
  legacy_with_uncovered_segments: legacyGaps.length,
  legacy_without_av_segments: noSegments.length,
  promoted_this_run: promoted,
};

if (json) {
  console.log(JSON.stringify({ summary, lessons: reports }, null, 2));
} else {
  console.log(`[backfill-video-status] ${apply ? "APPLY" : "DRY-RUN"} db=${dbPath}`);
  console.log(
    `  lessons=${summary.lessons_total} ready=${summary.ready} pending_video=${summary.pending_video} ` +
      `legacy_uncovered=${summary.legacy_with_uncovered_segments} no_av_segments=${summary.legacy_without_av_segments} promoted=${promoted}`
  );
  for (const report of legacyGaps) {
    console.log(
      `  legacy lesson ${report.lesson_id} [subject ${report.subject_id} ${report.subject_status}] ` +
        `"${report.title.slice(0, 60)}" videos ${report.segments_with_video}/${report.segments_total} ` +
        `gaps: ${report.gaps.map((gap) => `${gap.activity_id}:${gap.missing.join("+")}`).join(", ")}`
    );
  }
  for (const report of pending) {
    console.log(
      `  pending_video lesson ${report.lesson_id} "${report.title.slice(0, 60)}" videos ${report.segments_with_video}/${report.segments_total}`
    );
  }
}

db.close();
process.exit(0);
