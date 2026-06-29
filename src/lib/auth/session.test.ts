import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "avocadocore-session-"));
  process.env.AVOCADOCORE_DB_PATH = path.join(tmpDir, "test.db");
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.AVOCADOCORE_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("ensureActiveLearnerProfile", () => {
  it("creates an active learner profile for a valid account that has none", async () => {
    const { getDb } = await import("@/db/connection");
    const { ensureActiveLearnerProfile } = await import("./session");
    const db = getDb();
    const userId = db
      .prepare("INSERT INTO users (username, display_name, is_guest) VALUES (?, ?, 1)")
      .run("guest-stale", "Guest learner").lastInsertRowid as number;

    const repaired = ensureActiveLearnerProfile({
      id: userId,
      username: "guest-stale",
      display_name: "Guest learner",
      email: null,
      active_learner_id: null,
      is_guest: true,
    });

    expect(repaired.active_learner_id).toEqual(expect.any(Number));
    const user = db
      .prepare("SELECT active_learner_id FROM users WHERE id = ?")
      .get(userId) as { active_learner_id: number };
    expect(user.active_learner_id).toBe(repaired.active_learner_id);
    const profile = db
      .prepare("SELECT user_id, display_name FROM learner_profiles WHERE id = ?")
      .get(repaired.active_learner_id) as { user_id: number; display_name: string };
    expect(profile).toEqual({ user_id: userId, display_name: "Guest learner" });
    const demo = db
      .prepare(
        `SELECT s.title, COUNT(l.id) AS lesson_count,
                GROUP_CONCAT(l.sequence_number, ',') AS sequences
         FROM subjects s
         JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ? AND s.title = 'Demo Lesson: Build your own LLM AI'
         GROUP BY s.id`
      )
      .get(repaired.active_learner_id) as { title: string; lesson_count: number; sequences: string };
    expect(demo).toEqual({
      title: "Demo Lesson: Build your own LLM AI",
      lesson_count: 3,
      sequences: "1,2,3",
    });
  });

  it("reuses the account's first learner profile when the active pointer is stale", async () => {
    const { getDb } = await import("@/db/connection");
    const { ensureActiveLearnerProfile } = await import("./session");
    const db = getDb();
    const otherUserId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("other-user", "Other User").lastInsertRowid as number;
    const wrongProfileId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(otherUserId, "Other profile").lastInsertRowid as number;
    const userId = db
      .prepare("INSERT INTO users (username, display_name, active_learner_id) VALUES (?, ?, ?)")
      .run("claimed-stale", "Claimed Learner", wrongProfileId).lastInsertRowid as number;
    const existingProfileId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(userId, "Existing profile").lastInsertRowid as number;

    const repaired = ensureActiveLearnerProfile({
      id: userId,
      username: "claimed-stale",
      display_name: "Claimed Learner",
      email: null,
      active_learner_id: wrongProfileId,
      is_guest: false,
    });

    expect(repaired.active_learner_id).toBe(existingProfileId);
    const profileCount = db
      .prepare("SELECT COUNT(*) AS count FROM learner_profiles WHERE user_id = ?")
      .get(userId) as { count: number };
    expect(profileCount.count).toBe(1);
    const demoCount = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM subjects s
         JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ? AND s.title = 'Demo Lesson: Build your own LLM AI'`
      )
      .get(existingProfileId) as { count: number };
    expect(demoCount.count).toBe(3);
  });

  it("does not duplicate the demo subject when profile repair runs repeatedly", async () => {
    const { getDb } = await import("@/db/connection");
    const { ensureActiveLearnerProfile } = await import("./session");
    const db = getDb();
    const userId = db
      .prepare("INSERT INTO users (username, display_name) VALUES (?, ?)")
      .run("repeat-user", "Repeat User").lastInsertRowid as number;
    const learnerId = db
      .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)")
      .run(userId, "Repeat User").lastInsertRowid as number;
    db.prepare("UPDATE users SET active_learner_id = ? WHERE id = ?").run(learnerId, userId);

    const user = {
      id: userId,
      username: "repeat-user",
      display_name: "Repeat User",
      email: null,
      active_learner_id: learnerId,
      is_guest: false,
    };
    ensureActiveLearnerProfile(user);
    ensureActiveLearnerProfile(user);

    const demo = db
      .prepare(
        `SELECT COUNT(DISTINCT s.id) AS subject_count, COUNT(l.id) AS lesson_count
         FROM subjects s
         JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ? AND s.title = 'Demo Lesson: Build your own LLM AI'`
      )
      .get(learnerId) as { subject_count: number; lesson_count: number };
    expect(demo).toEqual({ subject_count: 1, lesson_count: 3 });
  });
});
