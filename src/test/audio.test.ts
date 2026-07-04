/**
 * Real-path tests for the lesson audio pipeline (not typecheck-only):
 *  - runtime-storage path resolution refuses traversal outside runtime_artifacts/
 *  - synthesizeSpeech default provider produces Doraemon voice audio when
 *    edge_tts is available
 *  - synthesizeSpeech (espeak-ng provider) still works as an emergency fallback
 *  - generateLessonAudio writes a file AND upserts a generated_artifacts row
 *    with real provider/hash/duration, and is idempotent on re-run.
 *
 * The espeak-dependent cases are skipped automatically if espeak-ng is not
 * installed, so the suite stays green on hosts without it while still proving
 * the path end-to-end where it is available (the demo host + CI image).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, existsSync, statSync, rmSync, mkdtempSync } from "fs";
import os from "os";
import path from "path";

import {
  resolveRuntimeFile,
  resolveRuntimeSegments,
  lessonAudioRelPath,
  runtimeRoot,
} from "@/lib/audio/runtime-storage";
import {
  synthesizeSpeech,
  espeakAvailable,
  doraemonEdgeAvailable,
} from "@/lib/audio/tts";
import { generateLessonAudio } from "@/lib/audio/generate-lesson-audio";

const HAS_ESPEAK = espeakAvailable();
const HAS_DORAEMON_EDGE = doraemonEdgeAvailable();
const tmpFiles: string[] = [];

afterAll(() => {
  for (const f of tmpFiles) {
    try {
      rmSync(f, { force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("runtime-storage path safety", () => {
  it("resolves a legitimate runtime file under runtime_artifacts/", () => {
    const abs = resolveRuntimeFile("runtime_artifacts/audio/lesson_4_audio.mp3");
    expect(abs).not.toBeNull();
    expect(abs!.startsWith(runtimeRoot())).toBe(true);
  });

  it("refuses paths that escape the runtime root via ..", () => {
    expect(resolveRuntimeFile("runtime_artifacts/../../etc/passwd")).toBeNull();
    expect(resolveRuntimeFile("../secrets.env")).toBeNull();
    expect(resolveRuntimeFile("data/avocadocore.db")).toBeNull();
  });

  it("refuses segment arrays containing traversal tokens", () => {
    expect(resolveRuntimeSegments(["runtime_artifacts", "..", "x"])).toBeNull();
    expect(resolveRuntimeSegments([])).toBeNull();
    expect(
      resolveRuntimeSegments(["runtime_artifacts", "audio", "lesson_4_audio.mp3"])
    ).not.toBeNull();
  });

  it("derives the canonical per-lesson audio path", () => {
    expect(lessonAudioRelPath(4)).toBe("runtime_artifacts/audio/lesson_4_audio.mp3");
  });
});

describe.runIf(HAS_DORAEMON_EDGE)("synthesizeSpeech (default Doraemon voice)", () => {
  it("uses Doraemon edge TTS by default for learner-facing lesson audio", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "avo-tts-"));
    tmpFiles.push(dir);
    const out = path.join(dir, "clip.mp3");
    const res = await synthesizeSpeech(
      "Preprocessing turns an image file into a model ready tensor.",
      { outPath: out }
    );
    expect(res.provider).toBe("doraemon-edge-tts");
    expect(res.voice).toBe("en-US-BrianNeural");
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(1000);
    expect(res.durationSec).toBeGreaterThan(0);
  });

  it("uses male and female Edge voices for two-host podcast transcripts", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "avo-tts-"));
    tmpFiles.push(dir);
    const out = path.join(dir, "dialogue.mp3");
    const res = await synthesizeSpeech(
      [
        "Leo: We are setting up the big map for this lesson.",
        "Maya: I will ask the learner-style clarifying question.",
        "Leo: Then I unpack the mechanism with a tiny example.",
        "Maya: And I check the misconception before practice.",
      ].join("\n\n"),
      { outPath: out }
    );

    expect(res.provider).toBe("doraemon-edge-tts");
    expect(res.voice).toBe("en-US-BrianNeural+en-US-AvaNeural");
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(1000);
    expect(res.durationSec).toBeGreaterThan(0);
  });
});

describe.runIf(HAS_ESPEAK)("synthesizeSpeech (espeak-ng)", () => {
  it("produces a real, playable MP3 with duration and content hash", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "avo-tts-"));
    tmpFiles.push(dir);
    const out = path.join(dir, "clip.mp3");
    const res = await synthesizeSpeech(
      "A vision model sees a three dimensional tensor of height, width, and channels.",
      { outPath: out, provider: "espeak-ng" }
    );
    expect(res.provider).toBe("espeak-ng");
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(1000);
    expect(res.durationSec).toBeGreaterThan(0);
    expect(res.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    // MP3 files start with an ID3 tag or an MPEG frame sync (0xFF 0xFB/0xF3...).
    const head = readFileSync(out).subarray(0, 3);
    const isId3 = head.toString("ascii") === "ID3";
    const isFrameSync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
    expect(isId3 || isFrameSync).toBe(true);
  });

  it("rejects an empty script", async () => {
    await expect(
      synthesizeSpeech("   ", { outPath: "/tmp/never.mp3", provider: "espeak-ng" })
    ).rejects.toThrow();
  });
});

function makeDbWithAudioLesson(): { db: Database.Database; lessonId: number } {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(
    path.join(process.cwd(), "src", "db", "schema.sql"),
    "utf-8"
  );
  db.exec(schema);
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES ('t', 'T')")
    .run().lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'L')")
    .run(userId).lastInsertRowid as number;
  const subjectId = db
    .prepare("INSERT INTO subjects (learner_id, title) VALUES (?, 't')")
    .run(learnerId).lastInsertRowid as number;
  // Force a high, collision-proof lesson id so the generated file lands at
  // runtime_artifacts/audio/lesson_90001_audio.mp3 and never clobbers a real
  // demo lesson's audio (cleanup in afterAll removes only the test file).
  const lessonId = 90001;
  db.prepare(
    "INSERT INTO lessons (id, subject_id, title, status, sequence_number) VALUES (?, ?, 'L', 'queued', 1)"
  ).run(lessonId, subjectId);
  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'audio', 1, 1, 'Audio', ?)`
  ).run(
    lessonId,
    JSON.stringify({
      script:
        "Preprocessing turns a JPEG into a model ready tensor through resize, normalisation, and channel reordering.",
      duration_hint: 30,
    })
  );
  return { db, lessonId };
}

describe.runIf(HAS_ESPEAK)("generateLessonAudio", () => {
  let db: Database.Database;
  let lessonId: number;

  beforeEach(() => {
    ({ db, lessonId } = makeDbWithAudioLesson());
  });

  it("synthesizes audio and records a generated_artifacts row", async () => {
    const res = await generateLessonAudio(db, lessonId, { provider: "espeak-ng" });
    expect(res.status).toBe("generated");
    expect(res.relPath).toBe(lessonAudioRelPath(lessonId));
    tmpFiles.push(path.join(process.cwd(), res.relPath!));

    const row = db
      .prepare(
        "SELECT provider, voice, duration_sec, content_hash, file_path, source_script, script_version FROM generated_artifacts WHERE lesson_id = ? AND artifact_type = 'audio'"
      )
      .get(lessonId) as Record<string, unknown>;
    expect(row.provider).toBe("espeak-ng");
    expect(row.file_path).toBe(lessonAudioRelPath(lessonId));
    expect(row.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Number(row.duration_sec)).toBeGreaterThan(0);
    expect(String(row.source_script).length).toBeGreaterThan(0);
    expect(String(row.script_version)).toMatch(/^sha256:/);

    // Exactly one audio row (no placeholder accumulation).
    const count = db
      .prepare(
        "SELECT COUNT(*) AS n FROM generated_artifacts WHERE lesson_id = ? AND artifact_type = 'audio'"
      )
      .get(lessonId) as { n: number };
    expect(count.n).toBe(1);
  });

  it("is idempotent — a second run skips when the script is unchanged", async () => {
    await generateLessonAudio(db, lessonId, { provider: "espeak-ng" });
    const second = await generateLessonAudio(db, lessonId, { provider: "espeak-ng" });
    expect(second.status).toBe("skipped-exists");
  });

  it("reports no-audio-activity for a lesson without audio", async () => {
    const subjectId = db.prepare("SELECT id FROM subjects LIMIT 1").get() as {
      id: number;
    };
    const bare = db
      .prepare(
        "INSERT INTO lessons (subject_id, title, status, sequence_number) VALUES (?, 'bare', 'queued', 2)"
      )
      .run(subjectId.id).lastInsertRowid as number;
    const res = await generateLessonAudio(db, bare, { provider: "espeak-ng" });
    expect(res.status).toBe("no-audio-activity");
  });
});
