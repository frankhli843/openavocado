/**
 * Regression test: the seeded GDM lesson (id 4) must stay enriched, and every
 * seeded lesson must carry the audio + diagnostics contract. This guards the
 * exact failure Frank reported — a lesson that looked like a thin high-level
 * preview with placeholder audio — from silently coming back via the seed.
 *
 * Seeds a throwaway file-backed DB through the real seedDatabase() path so the
 * assertions run against actual seeded rows, not hand-written fixtures.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync } from "fs";
import os from "os";
import path from "path";

const TMP_DB = path.join(os.tmpdir(), `avo-seedtest-${process.pid}.db`);

// getDb() reads AVOCADOCORE_DB_PATH lazily on first call, and seedDatabase()
// calls getDb() internally — so setting the env in beforeAll (before any DB use
// in this isolated test file) targets our throwaway DB.
let getDb: typeof import("@/db/connection").getDb;
let closeDb: typeof import("@/db/connection").closeDb;
let seedDatabase: typeof import("@/db/seed").seedDatabase;

beforeAll(async () => {
  for (const s of ["", "-wal", "-shm"]) {
    try {
      rmSync(TMP_DB + s, { force: true });
    } catch {
      /* ignore */
    }
  }
  process.env.AVOCADOCORE_DB_PATH = TMP_DB;
  ({ getDb, closeDb } = await import("@/db/connection"));
  ({ seedDatabase } = await import("@/db/seed"));
  seedDatabase();
});

afterAll(() => {
  try {
    closeDb();
  } catch {
    /* ignore */
  }
  for (const s of ["", "-wal", "-shm"]) {
    try {
      rmSync(TMP_DB + s, { force: true });
    } catch {
      /* ignore */
    }
  }
});

const GDM_TITLE = "From Raw Image to Model-Ready Tensor";

describe("seeded lesson enrichment contract", () => {
  it("lesson 4 has at least three interactive exploration widgets", () => {
    const db = getDb();
    const lesson = db
      .prepare("SELECT id FROM lessons WHERE title = ?")
      .get(GDM_TITLE) as { id: number };
    expect(lesson).toBeTruthy();
    const widgets = db
      .prepare(
        "SELECT title, content FROM lesson_activities WHERE lesson_id = ? AND activity_type = 'interactive'"
      )
      .all(lesson.id) as Array<{ title: string; content: string }>;
    expect(widgets.length).toBeGreaterThanOrEqual(3);
    // Each widget must be a parseable declarative spec (not an empty stub).
    for (const w of widgets) {
      const spec = JSON.parse(w.content);
      expect(spec.widget_type).toBeTruthy();
      expect(Array.isArray(spec.controls) || Array.isArray(spec.outputs)).toBe(true);
    }
  });

  it("lesson 4 audio script previews tokenization/Gemma as deeper-later, not as taught", () => {
    const db = getDb();
    const lesson = db
      .prepare("SELECT id FROM lessons WHERE title = ?")
      .get(GDM_TITLE) as { id: number };
    const audio = db
      .prepare(
        "SELECT content FROM lesson_activities WHERE lesson_id = ? AND activity_type = 'audio' LIMIT 1"
      )
      .get(lesson.id) as { content: string };
    const script: string = JSON.parse(audio.content).script ?? "";
    expect(script.length).toBeGreaterThan(200);
    expect(/preview/i.test(script)).toBe(true);
    expect(/later lesson/i.test(script)).toBe(true);
  });

  it("lesson 4 records an audio artifact with a real source script and no fake hash", () => {
    const db = getDb();
    const lesson = db
      .prepare("SELECT id FROM lessons WHERE title = ?")
      .get(GDM_TITLE) as { id: number };
    const artifact = db
      .prepare(
        "SELECT provider, file_path, source_script, content_hash FROM generated_artifacts WHERE lesson_id = ? AND artifact_type = 'audio'"
      )
      .get(lesson.id) as
      | { provider: string; file_path: string; source_script: string; content_hash: string | null }
      | undefined;
    expect(artifact).toBeTruthy();
    expect(artifact!.file_path).toBe("runtime_artifacts/audio/lesson_4_audio.mp3");
    expect(artifact!.source_script.trim().length).toBeGreaterThan(0);
    // No placeholder hash — a real hash (sha256:<64 hex>) or NULL until generated.
    if (artifact!.content_hash !== null) {
      expect(artifact!.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("every seeded lesson carries next-lesson diagnostics", () => {
    const db = getDb();
    const missing = db
      .prepare(
        "SELECT COUNT(*) AS n FROM lessons WHERE next_lesson_diagnostics IS NULL"
      )
      .get() as { n: number };
    expect(missing.n).toBe(0);
  });

  it("every seeded audio activity has a non-empty script the generator can voice", () => {
    const db = getDb();
    const audios = db
      .prepare(
        "SELECT lesson_id, content FROM lesson_activities WHERE activity_type = 'audio'"
      )
      .all() as Array<{ lesson_id: number; content: string }>;
    expect(audios.length).toBeGreaterThan(0);
    for (const a of audios) {
      const script = JSON.parse(a.content).script ?? "";
      expect(
        String(script).trim().length,
        `lesson ${a.lesson_id} audio script must be non-empty`
      ).toBeGreaterThan(20);
    }
  });
});
