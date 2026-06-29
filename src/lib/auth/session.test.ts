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
  });
});
