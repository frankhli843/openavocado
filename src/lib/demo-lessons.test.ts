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
        transcript?: string;
        orientation_visual?: {
          scene?: { panels?: Array<{ id: string; kind?: string }> };
          cues?: Array<{ panel_id?: string; active_elements?: string[] }>;
        };
      };
      const panels = content.orientation_visual?.scene?.panels ?? [];
      const cues = content.orientation_visual?.cues ?? [];
      const panelIds = new Set(panels.map((panel) => panel.id));

      expect(content.transcript?.length).toBeGreaterThan(100);
      expect(panels.length).toBeGreaterThanOrEqual(4);
      expect(new Set(panels.map((panel) => panel.kind)).size).toBeGreaterThan(1);
      expect(cues.length).toBeGreaterThanOrEqual(4);
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
});
