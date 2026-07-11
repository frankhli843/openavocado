import type Database from "better-sqlite3";
import type { LessonVideoStatus } from "@/types";
import {
  validateLessonProductionReadiness,
  type GeneratedArtifactRow,
  type StoredLessonActivity,
} from "./readiness";

/**
 * Video-first gate (2026-07-11 directive).
 *
 * A completed AvocadoCore lesson is a reviewed Manim segment video for the
 * orientation segment and each lesson_part segment. Narration audio, cue
 * timelines, and transcripts remain authoring inputs / captions / accessibility
 * metadata — never the primary learner-facing output of a new lesson.
 *
 * Every generation path (agent harness, local queue, one-off, discard
 * replacement) must call markLessonVideoState() after inserting a lesson so
 * the lesson row carries an explicit video_status:
 * - 'ready'          full reviewed video coverage — learner-ready
 * - 'pending_video'  generated but blocked on the Manim pass — NOT learner-ready
 * - 'legacy'         pre-directive historical lesson (backfill fallback only)
 */

export interface SegmentVideoCoverage {
  activity_id: number;
  activity_type: "audio" | "lesson_part";
  title: string | null;
  has_video: boolean;
  /** Path of the narration audio artifact, if generated — the mux source. */
  audio_file_path: string | null;
  audio_duration_sec: number | null;
  /** Number of authored cue-timeline entries. The cue timeline IS the storyboard. */
  cue_count: number;
}

export interface LessonVideoCoverageResult {
  ready: boolean;
  errors: string[];
  segments: SegmentVideoCoverage[];
}

interface ActivityRow {
  id: number;
  activity_type: string;
  title: string | null;
  content: string | null;
}

interface ArtifactRow {
  activity_id: number | null;
  artifact_type: string;
  file_path: string | null;
  duration_sec: number | null;
}

/**
 * Evaluates whether every audio/lesson_part segment of a lesson has a
 * registered reviewed video. Video coverage only — approved visual artifacts
 * are a separate production-readiness concern.
 */
export function evaluateLessonVideoCoverage(
  db: Database.Database,
  lessonId: number,
  options?: { runtimeRoot?: string; checkFiles?: boolean }
): LessonVideoCoverageResult {
  const activities = db
    .prepare(
      "SELECT id, activity_type, title, content FROM lesson_activities WHERE lesson_id = ? ORDER BY sequence_order, id"
    )
    .all(lessonId) as ActivityRow[];
  const artifacts = db
    .prepare(
      "SELECT activity_id, artifact_type, file_path, duration_sec FROM generated_artifacts WHERE lesson_id = ?"
    )
    .all(lessonId) as ArtifactRow[];

  const parsed: StoredLessonActivity[] = activities.map((activity) => ({
    id: activity.id,
    activity_type: activity.activity_type,
    title: activity.title,
    content: parseJson(activity.content),
  }));

  const readiness = validateLessonProductionReadiness({
    activities: parsed,
    generatedArtifacts: artifacts as GeneratedArtifactRow[],
    visualArtifacts: [],
    options: {
      requireSegmentVideos: true,
      requireApprovedVisualArtifacts: false,
      runtimeRoot: options?.runtimeRoot,
      checkFiles: options?.checkFiles ?? Boolean(options?.runtimeRoot),
    },
  });

  const audioByActivity = new Map<number, ArtifactRow>();
  const videoActivityIds = new Set<number>();
  for (const artifact of artifacts) {
    if (typeof artifact.activity_id !== "number") continue;
    if (artifact.artifact_type === "audio" && !audioByActivity.has(artifact.activity_id)) {
      audioByActivity.set(artifact.activity_id, artifact);
    }
    if (artifact.artifact_type === "video") videoActivityIds.add(artifact.activity_id);
  }

  const segments: SegmentVideoCoverage[] = [];
  for (const activity of parsed) {
    if (activity.activity_type !== "audio" && activity.activity_type !== "lesson_part") continue;
    const content = asRecord(activity.content);
    const videoObject =
      activity.activity_type === "audio"
        ? content?.orientation_video
        : asRecord(content?.audio)?.video;
    const cues =
      activity.activity_type === "audio"
        ? asRecord(content?.orientation_visual)?.cues
        : asRecord(asRecord(content?.audio)?.synced_visual)?.cues;
    const audioArtifact = audioByActivity.get(activity.id) ?? null;
    segments.push({
      activity_id: activity.id,
      activity_type: activity.activity_type,
      title: activity.title ?? null,
      has_video: Boolean(videoObject) && videoActivityIds.has(activity.id),
      audio_file_path: audioArtifact?.file_path ?? null,
      audio_duration_sec: audioArtifact?.duration_sec ?? null,
      cue_count: Array.isArray(cues) ? cues.length : 0,
    });
  }

  return { ready: readiness.valid, errors: readiness.errors, segments };
}

export interface PendingVideoManifest {
  policy: "video-first/v1";
  marked_at: string;
  /** Segments that must receive a reviewed Manim video before release. */
  segments: SegmentVideoCoverage[];
  /**
   * The proven lesson-15 pipeline a capable authoring worker must run:
   * export-storyboard → author Manim cue scenes → render-segment.sh (ql review
   * loop, then final) → review.json → generate-captions → register-video →
   * pnpm audit:videos --lesson <id>.
   */
  next_steps: string[];
  blocking_errors: string[];
}

export interface LessonVideoStateResult {
  status: Extract<LessonVideoStatus, "ready" | "pending_video">;
  coverage: LessonVideoCoverageResult;
  manifest: PendingVideoManifest | null;
}

/**
 * Evaluates video coverage for a freshly generated lesson and persists the
 * resulting video_status on the lesson row. When the lesson is blocked on the
 * Manim pass, a structured pending-video manifest (segments, audio sources,
 * cue counts, pipeline steps) is written into source_context.pending_video so
 * a capable worker can complete the pass without re-deriving state.
 */
export function markLessonVideoState(
  db: Database.Database,
  lessonId: number,
  options?: { runtimeRoot?: string; checkFiles?: boolean }
): LessonVideoStateResult {
  const coverage = evaluateLessonVideoCoverage(db, lessonId, options);
  if (coverage.ready) {
    db.prepare(
      "UPDATE lessons SET video_status = 'ready', updated_at = datetime('now') WHERE id = ?"
    ).run(lessonId);
    clearPendingVideoManifest(db, lessonId);
    return { status: "ready", coverage, manifest: null };
  }

  const manifest: PendingVideoManifest = {
    policy: "video-first/v1",
    marked_at: new Date().toISOString(),
    segments: coverage.segments.filter((segment) => !segment.has_video),
    next_steps: [
      `tsx scripts/export-storyboard.ts ${lessonId}`,
      `author manim/scenes/lesson_${lessonId}/activity_<id>.py (one AvoScene per cue, pace_to timing)`,
      `scripts/render-segment.sh ${lessonId} <activity_id> --quality ql  # review frames, iterate`,
      `write manim/review/lesson_${lessonId}/<activity_id>/review.json (all frames pass)`,
      `scripts/render-segment.sh ${lessonId} <activity_id> --quality final`,
      `tsx scripts/generate-captions.ts ${lessonId} <activity_id>`,
      `tsx scripts/register-video.ts ${lessonId} <activity_id>`,
      `pnpm audit:videos --lesson ${lessonId}`,
    ],
    blocking_errors: coverage.errors.slice(0, 12),
  };

  const row = db.prepare("SELECT source_context FROM lessons WHERE id = ?").get(lessonId) as
    | { source_context: string | null }
    | undefined;
  const source = asRecord(parseJson(row?.source_context ?? null)) ?? {};
  source.pending_video = manifest;
  db.prepare(
    "UPDATE lessons SET video_status = 'pending_video', source_context = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(source), lessonId);

  return { status: "pending_video", coverage, manifest };
}

/**
 * Promotes a lesson to video_status='ready' when full segment-video coverage
 * exists, without demoting it otherwise. Used by seed/demo materialization and
 * backfill, where an uncovered lesson should stay 'legacy' (historical
 * fallback) rather than become 'pending_video' (a new-generation state).
 */
export function promoteLessonVideoStatusIfReady(
  db: Database.Database,
  lessonId: number,
  options?: { runtimeRoot?: string; checkFiles?: boolean }
): boolean {
  const coverage = evaluateLessonVideoCoverage(db, lessonId, options);
  if (!coverage.ready) return false;
  db.prepare(
    "UPDATE lessons SET video_status = 'ready', updated_at = datetime('now') WHERE id = ? AND video_status != 'ready'"
  ).run(lessonId);
  return true;
}

function clearPendingVideoManifest(db: Database.Database, lessonId: number): void {
  const row = db.prepare("SELECT source_context FROM lessons WHERE id = ?").get(lessonId) as
    | { source_context: string | null }
    | undefined;
  const source = asRecord(parseJson(row?.source_context ?? null));
  if (!source || !("pending_video" in source)) return;
  delete source.pending_video;
  db.prepare(
    "UPDATE lessons SET source_context = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(source), lessonId);
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
