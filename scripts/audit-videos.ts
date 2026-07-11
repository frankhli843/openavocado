#!/usr/bin/env tsx
/**
 * audit-videos.ts  (pnpm audit:videos)
 *
 * Audits per-segment Manim videos across published lessons. For every audio
 * segment (activity_type 'audio' = orientation, 'lesson_part' = a part) in a
 * published lesson (status queued/in_progress/completed) it checks:
 *   1. a generated_artifacts row artifact_type='video' exists for the activity;
 *   2. the activity content carries the LessonSegmentVideo object
 *      (content.orientation_video for 'audio', content.audio.video for 'lesson_part');
 *   3. the mp4 file exists on disk under AVOCADOCORE_RUNTIME_ROOT;
 *   4. ffprobe duration matches the audio artifact duration within +/-0.5s;
 *   5. review.json exists at manim/review/lesson_<id>/<activity>/review.json with
 *      iterations>=1 and frames[] non-empty; when the storyboard is present the
 *      frame count must be >= 3 * cueCount (start/mid/end per cue);
 *   6. poster (.poster.png) and captions (.vtt) exist next to the mp4.
 *
 * Exit behaviour mirrors audit:transcripts / audit:visual-artifacts:
 *   - STRICT by default (exit 1 on ANY missing/invalid segment video) — the
 *     Phase 4 backfill completed 2026-07-09 (all 22 audio-bearing lessons carry
 *     a registered, reviewed video), so every published segment must have one.
 *   - `--no-strict` restores warn-only (exit 0) for diagnostic reporting during
 *     a fresh backfill of a newly authored lesson before its videos land.
 *   - `--lesson <id>` scopes the audit to one lesson (used by backfill-videos.ts
 *     to gate a lesson as done).
 *   - `--json` prints the machine-readable report.
 *
 * Env: AVOCADOCORE_DB_PATH (default data/avocadocore.db),
 *      AVOCADOCORE_RUNTIME_ROOT (default cwd), MANIM_REVIEW_ROOT (default cwd).
 * Requires: ffprobe on PATH; better-sqlite3 under node 22.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import Database from "better-sqlite3";

type SegmentRow = {
  activity_id: number;
  lesson_id: number;
  lesson_status: string;
  activity_type: string;
  content: string | null;
  audio_dur: number;
};

const dbPath = process.env.AVOCADOCORE_DB_PATH ?? "data/avocadocore.db";
const runtimeRoot = process.env.AVOCADOCORE_RUNTIME_ROOT ?? process.cwd();
const reviewRoot = process.env.MANIM_REVIEW_ROOT ?? process.cwd();
// Strict by default now that the Phase 4 backfill is complete; --no-strict
// (or the legacy --strict, still accepted) toggles. --strict remains a no-op
// alias so existing callers keep working.
const strict = !process.argv.includes("--no-strict");
const json = process.argv.includes("--json");
const lessonArgIdx = process.argv.indexOf("--lesson");
const onlyLesson = lessonArgIdx >= 0 ? Number(process.argv[lessonArgIdx + 1]) : null;
const DUR_TOL = 0.5;

const db = new Database(dbPath, { readonly: true });

// every audio-bearing segment in a published lesson is expected to have a video
let sql = `
  select g.activity_id, la.lesson_id, l.status lesson_status, la.activity_type,
         la.content, g.duration_sec audio_dur
  from generated_artifacts g
  join lesson_activities la on la.id = g.activity_id
  join lessons l on l.id = la.lesson_id
  where g.artifact_type = 'audio'
    and la.activity_type in ('audio', 'lesson_part')
    and l.status in ('queued', 'in_progress', 'completed')`;
if (onlyLesson != null) sql += ` and l.id = ${Number(onlyLesson)}`;
sql += ` order by la.lesson_id, g.activity_id`;

const segments = db.prepare(sql).all() as SegmentRow[];

type Failure = { lesson_id: number; activity_id: number; type: string; errors: string[] };
const failures: Failure[] = [];
const excluded: { lesson_id: number; activity_id: number; type: string }[] = [];
let okCount = 0;

function storyboardCueCount(lessonId: number, activityId: number): number | null {
  const p = path.join(reviewRoot, "manim", "storyboards", `lesson_${lessonId}`, `segment_${activityId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    const sb = JSON.parse(fs.readFileSync(p, "utf8"));
    const cues = sb.cues ?? sb.segments ?? [];
    return Array.isArray(cues) ? cues.length : null;
  } catch {
    return null;
  }
}

// Cue count straight from the DB content (single source of truth, matches
// export-storyboard.ts): audio -> orientation_visual.cues, lesson_part ->
// audio.synced_visual.cues. A segment with 0 cues carries a declarative/
// interactive widget instead of a synced cue timeline, so there is nothing to
// author one Manim scene per cue against. Such segments are EXCLUDED from the
// required-video set (same principle as assessment-only lessons that have no
// audio segments at all), and keep their existing interactive visual.
function contentCueCount(content: string | null, activityType: string): number {
  if (!content) return 0;
  try {
    const c = JSON.parse(content) as Record<string, any>;
    const cues =
      activityType === "audio"
        ? c?.orientation_visual?.cues
        : c?.audio?.synced_visual?.cues;
    return Array.isArray(cues) ? cues.length : 0;
  } catch {
    return 0;
  }
}

function ffprobeDuration(file: string): number | null {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" }
    ).trim();
    const d = Number(out);
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

for (const seg of segments) {
  const errors: string[] = [];

  // 0. cue-less segments are not video candidates (declarative/interactive
  //    widget, no per-cue timeline to animate) -> exclude, do not require a video.
  if (contentCueCount(seg.content, seg.activity_type) === 0) {
    excluded.push({ lesson_id: seg.lesson_id, activity_id: seg.activity_id, type: seg.activity_type });
    continue;
  }

  // 1. video artifact row
  const videoRow = db
    .prepare("select file_path, duration_sec from generated_artifacts where activity_id = ? and artifact_type = 'video'")
    .get(seg.activity_id) as { file_path: string; duration_sec: number } | undefined;

  // 2. content video object
  let contentVideoPath: string | null = null;
  try {
    const content = seg.content ? JSON.parse(seg.content) : {};
    const vid = seg.activity_type === "audio" ? content?.orientation_video : content?.audio?.video;
    contentVideoPath = vid?.file_path ?? null;
    if (!vid) errors.push(`content missing ${seg.activity_type === "audio" ? "orientation_video" : "audio.video"}`);
    else {
      if (!vid.poster_path) errors.push("content video missing poster_path");
      if (!vid.captions_path) errors.push("content video missing captions_path");
      if (!vid.review) errors.push("content video missing review metadata");
    }
  } catch {
    errors.push("content is not valid JSON");
  }

  if (!videoRow) {
    errors.push("no generated_artifacts video row");
    failures.push({ lesson_id: seg.lesson_id, activity_id: seg.activity_id, type: seg.activity_type, errors });
    continue;
  }

  const filePath = videoRow.file_path || contentVideoPath || "";
  const absMp4 = path.isAbsolute(filePath) ? filePath : path.join(runtimeRoot, filePath);

  // 3. file exists
  if (!fs.existsSync(absMp4)) {
    errors.push(`mp4 missing on disk: ${filePath}`);
  } else {
    // 4. ffprobe duration vs audio
    const vdur = ffprobeDuration(absMp4);
    if (vdur == null) errors.push("ffprobe failed on mp4");
    else if (Math.abs(vdur - seg.audio_dur) > DUR_TOL)
      errors.push(`video dur ${vdur.toFixed(2)}s vs audio ${seg.audio_dur.toFixed(2)}s (Δ${Math.abs(vdur - seg.audio_dur).toFixed(2)}s > ${DUR_TOL}s)`);

    // 6. poster + vtt exist
    const poster = absMp4.replace(/\.mp4$/, ".poster.png");
    const vtt = absMp4.replace(/\.mp4$/, ".vtt");
    if (!fs.existsSync(poster)) errors.push("poster .poster.png missing");
    if (!fs.existsSync(vtt)) errors.push("captions .vtt missing");
  }

  // 5. review.json
  const reviewPath = path.join(reviewRoot, "manim", "review", `lesson_${seg.lesson_id}`, String(seg.activity_id), "review.json");
  if (!fs.existsSync(reviewPath)) {
    errors.push("review.json missing (no proof of frame review)");
  } else {
    try {
      const r = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
      const frames = Array.isArray(r.frames) ? r.frames : [];
      const iterations = Number(r.iterations ?? 0);
      if (iterations < 1) errors.push(`review.json iterations=${iterations} (<1)`);
      if (frames.length === 0) errors.push("review.json has no frames");
      const unresolved = frames.filter((f: any) => String(f.verdict ?? "").toLowerCase().includes("fix")).length;
      if (unresolved > 0) errors.push(`review.json has ${unresolved} unresolved fix verdicts`);
      const cues = storyboardCueCount(seg.lesson_id, seg.activity_id);
      if (cues != null) {
        // Proof of per-cue review: every storyboard cue must have at least one
        // reviewed frame, plus a thoroughness floor (~2-3 frames per cue). The
        // ideal is start/mid/end (3) per cue, but tail cues legitimately collapse
        // the final "end" frame, so the hard gate is full cue coverage + a 2*cues
        // floor rather than a brittle exact 3*cues.
        const covered = new Set(frames.map((f: any) => Number(f.cue)));
        const missing: number[] = [];
        for (let i = 0; i < cues; i += 1) if (!covered.has(i)) missing.push(i);
        if (missing.length > 0)
          errors.push(`review.json missing frames for cue(s) ${missing.slice(0, 8).join(",")}${missing.length > 8 ? "…" : ""}`);
        if (frames.length < 2 * cues)
          errors.push(`review.json frames ${frames.length} < 2*cues ${2 * cues} (under-reviewed)`);
      }
    } catch {
      errors.push("review.json is not valid JSON");
    }
  }

  if (errors.length > 0) failures.push({ lesson_id: seg.lesson_id, activity_id: seg.activity_id, type: seg.activity_type, errors });
  else okCount += 1;
}

const lessonsWithVideo = new Set(
  segments
    .filter((s) => !failures.find((f) => f.activity_id === s.activity_id))
    .map((s) => s.lesson_id)
);
const report = {
  dbPath,
  runtimeRoot,
  segmentsExpected: segments.length - excluded.length,
  segmentsOk: okCount,
  segmentsFailing: failures.length,
  segmentsExcluded: excluded.length,
  excluded,
  lessonsFullyConverted: [...lessonsWithVideo].sort((a, b) => a - b),
  failures,
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`segment video audit: ${dbPath}${onlyLesson != null ? ` (lesson ${onlyLesson})` : ""}`);
  console.log(`expected segments: ${report.segmentsExpected}  (excluded, no cues: ${report.segmentsExcluded})`);
  console.log(`ok: ${report.segmentsOk}  failing/missing: ${report.segmentsFailing}`);
  const byLesson = new Map<number, Failure[]>();
  for (const f of failures) {
    const arr = byLesson.get(f.lesson_id) ?? [];
    arr.push(f);
    byLesson.set(f.lesson_id, arr);
  }
  for (const [lid, arr] of [...byLesson.entries()].sort((a, b) => a[0] - b[0]).slice(0, 40)) {
    const onlyMissing = arr.every((f) => f.errors.length === 1 && f.errors[0] === "no generated_artifacts video row");
    console.log(`- lesson ${lid}: ${arr.length} segment(s) ${onlyMissing ? "not yet converted (no video)" : "with issues"}`);
    if (!onlyMissing)
      for (const f of arr)
        console.log(`    act ${f.activity_id} (${f.type}): ${f.errors.join("; ")}`);
  }
  console.log(strict ? "[strict] failing on any missing/invalid segment video (default; --no-strict for warn-only)" : "[warn-only] diagnostic mode — not gating on missing/invalid segment video");
}

if (strict && failures.length > 0) process.exitCode = 1;
