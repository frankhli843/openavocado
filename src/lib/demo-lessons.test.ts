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
