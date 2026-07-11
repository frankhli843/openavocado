import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "avocadocore-demo-lessons-"));
  process.env.AVOCADOCORE_DB_PATH = path.join(tmpDir, "test.db");
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.AVOCADOCORE_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("demo lesson seeding", () => {
  it("seeds demo audio with cue-to-panel targeting for bespoke synced visuals", async () => {
    const { getDb } = await import("@/db/connection");
    const { DEMO_LESSONS, ensureDemoLessonsForLearner } = await import("./demo-lessons");

    const db = getDb();
    const userId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("demo-visual-user", "Demo Visual User").lastInsertRowid as number;
    const learnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(userId, "Demo Visual User").lastInsertRowid as number;

    ensureDemoLessonsForLearner(db, learnerId);

    const audioRows = db
      .prepare(
        `SELECT lesson_activities.content
         FROM lesson_activities
         JOIN lessons ON lessons.id = lesson_activities.lesson_id
         JOIN subjects ON subjects.id = lessons.subject_id
         WHERE subjects.learner_id = ? AND lesson_activities.activity_type = 'audio'
         ORDER BY lessons.sequence_number ASC`
      )
      .all(learnerId) as Array<{ content: string }>;

    expect(audioRows).toHaveLength(DEMO_LESSONS.length);
    for (const row of audioRows) {
      const content = JSON.parse(row.content) as {
        script?: string;
        transcript?: string;
        duration_hint?: number;
        orientation_visual?: {
          scene?: { panels?: Array<{ id: string; kind?: string }> };
          cues?: Array<{ start?: number; end?: number; panel_id?: string; active_elements?: string[] }>;
        };
      };
      const panels = content.orientation_visual?.scene?.panels ?? [];
      const cues = content.orientation_visual?.cues ?? [];
      const panelIds = new Set(panels.map((panel) => panel.id));

      expect((content.script ?? "").trim().split(/\s+/).length).toBeGreaterThanOrEqual(2700);
      expect(content.script ?? "").not.toMatch(
        /\b(?:the learner should|learner should|the learner needs|learner needs|the lesson should|this lesson should|the overview should|this overview should|the audio should|the transcript should|the script should)\b/i
      );
      expect(content.transcript).toBe(content.script);
      expect(content.duration_hint).toBeGreaterThanOrEqual(900);
      expect(panels.length).toBeGreaterThanOrEqual(4);
      expect(new Set(panels.map((panel) => panel.kind)).size).toBeGreaterThan(1);
      expect(cues.length).toBeGreaterThanOrEqual(4);
      expect(Math.max(...cues.map((cue) => cue.end ?? 0))).toBeGreaterThanOrEqual(900);
      for (const cue of cues) {
        expect(cue.panel_id).toBeTruthy();
        expect(panelIds.has(cue.panel_id ?? "")).toBe(true);
        expect(cue.active_elements?.length).toBeGreaterThan(0);
      }
    }
  });

  it("generates audio artifacts for all seeded demo lessons", async () => {
    const generateLessonAudio = vi.fn(async (_db, lessonId: number) => ({
      lessonId,
      status: "generated" as const,
      relPath: `runtime_artifacts/audio/lesson_${lessonId}_audio.mp3`,
    }));
    vi.doMock("@/lib/audio/generate-lesson-audio", () => ({ generateLessonAudio }));

    const { getDb } = await import("@/db/connection");
    const { ensureDemoLessonAudioForLearner, ensureDemoLessonsForLearner } = await import("./demo-lessons");

    const db = getDb();
    const userId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("demo-audio-user", "Demo Audio User").lastInsertRowid as number;
    const learnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(userId, "Demo Audio User").lastInsertRowid as number;

    ensureDemoLessonsForLearner(db, learnerId);
    await ensureDemoLessonAudioForLearner(db, learnerId);

    expect(generateLessonAudio).toHaveBeenCalledTimes(3);
    expect(generateLessonAudio.mock.calls.map((call) => call[1])).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it("registers seed segment videos at materialization and promotes video_status when assets exist", async () => {
    const runtimeRoot = path.join(tmpDir, "runtime");
    for (const rel of [
      "videos/lesson_12/activity_72.mp4",
      "videos/lesson_13/activity_76.mp4",
      "videos/lesson_14/activity_80.mp4",
    ]) {
      const abs = path.join(runtimeRoot, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, "stub-mp4");
    }
    vi.stubEnv("AVOCADOCORE_RUNTIME_ROOT", runtimeRoot);

    const { getDb } = await import("@/db/connection");
    const { ensureDemoLessonsForLearner } = await import("./demo-lessons");

    const db = getDb();
    const userId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("demo-video-user", "Demo Video User").lastInsertRowid as number;
    const learnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(userId, "Demo Video User").lastInsertRowid as number;

    ensureDemoLessonsForLearner(db, learnerId);

    const lessons = db
      .prepare(
        `SELECT lessons.id, lessons.video_status
         FROM lessons
         JOIN subjects ON subjects.id = lessons.subject_id
         WHERE subjects.learner_id = ?
         ORDER BY lessons.sequence_number ASC`
      )
      .all(learnerId) as Array<{ id: number; video_status: string }>;
    expect(lessons).toHaveLength(3);

    for (const lesson of lessons) {
      expect(lesson.video_status).toBe("ready");
      const audio = db
        .prepare(
          "SELECT id, content FROM lesson_activities WHERE lesson_id = ? AND activity_type = 'audio'"
        )
        .get(lesson.id) as { id: number; content: string };
      const content = JSON.parse(audio.content) as {
        orientation_video?: { file_path?: string; poster_path?: string; captions_path?: string };
      };
      expect(content.orientation_video?.file_path).toMatch(/^runtime_artifacts\/videos\/lesson_1[234]\//);
      expect(content.orientation_video?.poster_path).toBeTruthy();
      expect(content.orientation_video?.captions_path).toBeTruthy();
      const videoRows = db
        .prepare(
          "SELECT COUNT(*) AS count FROM generated_artifacts WHERE activity_id = ? AND artifact_type = 'video'"
        )
        .get(audio.id) as { count: number };
      expect(videoRows.count).toBe(1);
    }

    // Re-materialization must stay idempotent: no duplicate video rows.
    ensureDemoLessonsForLearner(db, learnerId);
    const totalVideoRows = db
      .prepare("SELECT COUNT(*) AS count FROM generated_artifacts WHERE artifact_type = 'video'")
      .get() as { count: number };
    expect(totalVideoRows.count).toBe(3);
  });

  it("keeps demo lessons legacy (not pending_video) when seed video assets are absent", async () => {
    vi.stubEnv("AVOCADOCORE_RUNTIME_ROOT", path.join(tmpDir, "missing-runtime"));

    const { getDb } = await import("@/db/connection");
    const { ensureDemoLessonsForLearner } = await import("./demo-lessons");

    const db = getDb();
    const userId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("demo-novideo-user", "Demo NoVideo User").lastInsertRowid as number;
    const learnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(userId, "Demo NoVideo User").lastInsertRowid as number;

    ensureDemoLessonsForLearner(db, learnerId);

    const statuses = db
      .prepare(
        `SELECT DISTINCT lessons.video_status
         FROM lessons JOIN subjects ON subjects.id = lessons.subject_id
         WHERE subjects.learner_id = ?`
      )
      .all(learnerId) as Array<{ video_status: string }>;
    expect(statuses).toEqual([{ video_status: "legacy" }]);
  });
});
