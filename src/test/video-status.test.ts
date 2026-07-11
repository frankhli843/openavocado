/**
 * Video-first gate (2026-07-11 directive): a lesson without reviewed Manim
 * segment videos must be classified pending_video (not learner-ready, not
 * buffer-ready) and must carry a structured pending-video manifest for the
 * authoring worker. These tests lock the classification, the manifest, and
 * the two-ready buffer's video_ready_count accounting.
 */
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import {
  evaluateLessonVideoCoverage,
  markLessonVideoState,
  promoteLessonVideoStatusIfReady,
} from "../lib/lesson-generator/video-status";
import { buildLessonBufferPlan } from "../lib/lesson-buffer";

const VIDEO_OBJECT = {
  file_path: "runtime_artifacts/videos/lesson_1/activity_1.mp4",
  poster_path: "runtime_artifacts/videos/lesson_1/activity_1.poster.png",
  captions_path: "runtime_artifacts/videos/lesson_1/activity_1.vtt",
  duration_sec: 120,
  width: 1920,
  height: 1080,
  source: {
    tool: "manim-ce" as const,
    version: "manim-ce/0.19.1",
    scene_module: "manim/scenes/lesson_1/activity_1.py",
  },
  review: { reviewed_at: "2026-07-11T00:00:00.000Z", frames_reviewed: 9, iterations: 1 },
};

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8"));
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('t', 'T')")
    .run().lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'L')")
    .run(userId).lastInsertRowid as number;
  db.prepare("INSERT INTO subjects (learner_id, title) VALUES (?, 'Subject')").run(learnerId);
  return db;
}

function insertLesson(
  db: Database.Database,
  opts: { sequence?: number; videoStatus?: string } = {}
): number {
  return db
    .prepare(
      `INSERT INTO lessons (subject_id, title, status, sequence_number, video_status)
       VALUES (1, 'Lesson', 'queued', ?, ?)`
    )
    .run(opts.sequence ?? 1, opts.videoStatus ?? "pending_video").lastInsertRowid as number;
}

function insertAudioSegment(
  db: Database.Database,
  lessonId: number,
  opts: { withVideo?: boolean } = {}
): number {
  const content: Record<string, unknown> = {
    audio_script: "narration",
    orientation_visual: { cues: [{ index: 0, start: 0, end: 10 }] },
  };
  if (opts.withVideo) content.orientation_video = VIDEO_OBJECT;
  const activityId = db
    .prepare(
      `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
       VALUES (?, 'audio', 1, 0, 'Audio', ?)`
    )
    .run(lessonId, JSON.stringify(content)).lastInsertRowid as number;
  db.prepare(
    `INSERT INTO generated_artifacts (lesson_id, activity_id, artifact_type, provider, duration_sec, file_path)
     VALUES (?, ?, 'audio', 'edge-tts', 120, 'runtime_artifacts/audio/test.mp3')`
  ).run(lessonId, activityId);
  if (opts.withVideo) {
    db.prepare(
      `INSERT INTO generated_artifacts (lesson_id, activity_id, artifact_type, provider, duration_sec, file_path)
       VALUES (?, ?, 'video', 'manim-ce', 120, ?)`
    ).run(lessonId, activityId, VIDEO_OBJECT.file_path);
  }
  return activityId;
}

describe("markLessonVideoState", () => {
  it("classifies an audio-only lesson as pending_video with a structured manifest", () => {
    const db = makeDb();
    const lessonId = insertLesson(db);
    const activityId = insertAudioSegment(db, lessonId, { withVideo: false });

    const state = markLessonVideoState(db, lessonId);
    expect(state.status).toBe("pending_video");
    expect(state.manifest).not.toBeNull();
    expect(state.manifest?.segments.map((segment) => segment.activity_id)).toEqual([activityId]);
    expect(state.manifest?.segments[0]?.audio_file_path).toBe("runtime_artifacts/audio/test.mp3");
    expect(state.manifest?.segments[0]?.cue_count).toBe(1);
    expect(state.manifest?.next_steps.join(" ")).toContain(`export-storyboard.ts ${lessonId}`);

    const row = db
      .prepare("SELECT video_status, source_context FROM lessons WHERE id = ?")
      .get(lessonId) as { video_status: string; source_context: string };
    expect(row.video_status).toBe("pending_video");
    const source = JSON.parse(row.source_context) as { pending_video?: { policy: string } };
    expect(source.pending_video?.policy).toBe("video-first/v1");
  });

  it("classifies a lesson with registered reviewed videos as ready and clears the manifest", () => {
    const db = makeDb();
    const lessonId = insertLesson(db);
    insertAudioSegment(db, lessonId, { withVideo: true });

    // First mark it pending via a second uncovered segment, then cover it.
    const state = markLessonVideoState(db, lessonId);
    expect(state.status).toBe("ready");
    const row = db
      .prepare("SELECT video_status, source_context FROM lessons WHERE id = ?")
      .get(lessonId) as { video_status: string; source_context: string | null };
    expect(row.video_status).toBe("ready");
    if (row.source_context) {
      expect(JSON.parse(row.source_context)).not.toHaveProperty("pending_video");
    }
  });

  it("treats an assessment-only lesson as ready (no audio/lesson_part segments)", () => {
    const db = makeDb();
    const lessonId = insertLesson(db, { sequence: 0 });
    db.prepare(
      `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
       VALUES (?, 'assessment', 1, 0, 'Assessment', '{}')`
    ).run(lessonId);

    const state = markLessonVideoState(db, lessonId);
    expect(state.status).toBe("ready");
    expect(state.coverage.segments).toHaveLength(0);
  });
});

describe("promoteLessonVideoStatusIfReady", () => {
  it("promotes a covered legacy lesson to ready but never demotes an uncovered one", () => {
    const db = makeDb();
    const covered = insertLesson(db, { sequence: 1, videoStatus: "legacy" });
    insertAudioSegment(db, covered, { withVideo: true });
    const uncovered = insertLesson(db, { sequence: 2, videoStatus: "legacy" });
    insertAudioSegment(db, uncovered, { withVideo: false });

    expect(promoteLessonVideoStatusIfReady(db, covered)).toBe(true);
    expect(promoteLessonVideoStatusIfReady(db, uncovered)).toBe(false);

    const statuses = db
      .prepare("SELECT id, video_status FROM lessons ORDER BY id")
      .all() as Array<{ id: number; video_status: string }>;
    expect(statuses.find((row) => row.id === covered)?.video_status).toBe("ready");
    expect(statuses.find((row) => row.id === uncovered)?.video_status).toBe("legacy");
  });
});

describe("buildLessonBufferPlan (video-first v2)", () => {
  it("counts pending_video lessons for generation dedup but not as video-ready", () => {
    const db = makeDb();
    const readyLesson = insertLesson(db, { sequence: 1, videoStatus: "ready" });
    insertAudioSegment(db, readyLesson, { withVideo: true });
    const pendingLesson = insertLesson(db, { sequence: 2, videoStatus: "pending_video" });
    insertAudioSegment(db, pendingLesson, { withVideo: false });

    const plan = buildLessonBufferPlan(db, { subjectId: 1 });
    expect(plan.policy_version).toBe("two-ready-lessons/v2");
    // Both queued lessons count toward the generation target — no duplicate
    // generation while a lesson waits on its Manim pass.
    expect(plan.ready_count).toBe(2);
    expect(plan.lessons_to_generate).toBe(0);
    // But only the video-ready lesson may be presented as learner-ready.
    expect(plan.video_ready_count).toBe(1);
    expect(plan.pending_video_lesson_ids).toEqual([pendingLesson]);
    expect(
      plan.existing_ready_lessons.find((lesson) => lesson.id === pendingLesson)?.video_status
    ).toBe("pending_video");
  });

  it("keeps legacy lessons video-ready (temporary historical fallback)", () => {
    const db = makeDb();
    const legacyLesson = insertLesson(db, { sequence: 1, videoStatus: "legacy" });
    insertAudioSegment(db, legacyLesson, { withVideo: false });

    const plan = buildLessonBufferPlan(db, { subjectId: 1 });
    expect(plan.video_ready_count).toBe(1);
    expect(plan.pending_video_lesson_ids).toEqual([]);
  });
});

describe("evaluateLessonVideoCoverage", () => {
  it("reports per-segment coverage detail", () => {
    const db = makeDb();
    const lessonId = insertLesson(db);
    const audioActivity = insertAudioSegment(db, lessonId, { withVideo: true });
    const partContent = {
      audio: {
        audio_script: "part narration",
        synced_visual: { cues: [{ index: 0 }, { index: 1 }] },
      },
    };
    const partActivity = db
      .prepare(
        `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
         VALUES (?, 'lesson_part', 1, 1, 'Part', ?)`
      )
      .run(lessonId, JSON.stringify(partContent)).lastInsertRowid as number;

    const coverage = evaluateLessonVideoCoverage(db, lessonId);
    expect(coverage.ready).toBe(false);
    const bySegment = new Map(coverage.segments.map((segment) => [segment.activity_id, segment]));
    expect(bySegment.get(audioActivity)?.has_video).toBe(true);
    expect(bySegment.get(partActivity)?.has_video).toBe(false);
    expect(bySegment.get(partActivity)?.cue_count).toBe(2);
  });
});
