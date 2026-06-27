/**
 * CRUD + status-transition tests for the DB-backed visual artifact pipeline.
 *
 * Exercises src/lib/visual-artifacts/db.ts against an in-memory SQLite database
 * seeded from src/db/schema.sql. getDb() is mocked so the CRUD module talks to
 * the test database instead of the real data/avocadocore.db file.
 *
 * Covers AC9: schema correctness for artifact records, the full build_status
 * state machine (pending_build → building → pending_qa → qa_approved/qa_rejected,
 * plus build_failed and reset), the approval gate (only pending_qa with a
 * compiled asset can be approved), QA evidence persistence, and the legacy
 * migration upsert.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";

// Shared holder so the hoisted vi.mock factory and the tests reference the
// same DB instance. Reset to a fresh in-memory DB before every test.
const holder = vi.hoisted(() => ({ db: null as unknown as InstanceType<typeof import("better-sqlite3")> }));

vi.mock("@/db/connection", () => ({
  getDb: () => holder.db,
}));

import {
  createArtifact,
  getArtifactBySlug,
  getArtifactById,
  listArtifacts,
  updateSource,
  markBuilding,
  markBuildSuccess,
  markBuildFailed,
  approveArtifact,
  rejectArtifact,
  resetToPendingBuild,
  recordQaEvidence,
  upsertLegacyApproved,
} from "../lib/visual-artifacts/db";
import type { BuildResult } from "../lib/visual-artifacts/types";

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8");
  db.exec(schema);
  return db;
}

/** Seed a real lesson via the users → learner_profiles → subjects → lessons FK chain. */
function seedLesson(db: InstanceType<typeof Database>): number {
  const userId = db
    .prepare("INSERT INTO users (username, display_name) VALUES (?, 'T')")
    .run(`u-${Math.random().toString(36).slice(2)}`).lastInsertRowid as number;
  const learnerId = db
    .prepare("INSERT INTO learner_profiles (user_id, display_name) VALUES (?, 'L')")
    .run(userId).lastInsertRowid as number;
  const subjectId = db
    .prepare("INSERT INTO subjects (learner_id, title) VALUES (?, 'S')")
    .run(learnerId).lastInsertRowid as number;
  return db
    .prepare("INSERT INTO lessons (subject_id, title, status) VALUES (?, 'Lesson', 'queued')")
    .run(subjectId).lastInsertRowid as number;
}

const VALID_SOURCE = "export default function C() { return <div>hi</div>; }";

function buildOk(): BuildResult {
  return {
    ok: true,
    compiled_asset_path: "runtime_artifacts/visual-artifacts/demo/bundle.js",
    compiled_asset_hash: "deadbeef",
    build_log: "compiled in 12ms",
  };
}

beforeEach(() => {
  holder.db = freshDb();
});

afterEach(() => {
  holder.db?.close();
});

describe("createArtifact", () => {
  it("creates an artifact in pending_build status with a source hash", () => {
    const a = createArtifact({ slug: "demo", title: "Demo", source_react: VALID_SOURCE });
    expect(a.id).toBeGreaterThan(0);
    expect(a.slug).toBe("demo");
    expect(a.build_status).toBe("pending_build");
    expect(a.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.compiled_asset_path).toBeNull();
    expect(a.manifest.allowed_imports).toContain("react");
  });

  it("rejects an invalid slug", () => {
    expect(() =>
      createArtifact({ slug: "Bad Slug!", title: "X", source_react: VALID_SOURCE })
    ).toThrow(/slug/i);
  });

  it("rejects empty source", () => {
    expect(() =>
      createArtifact({ slug: "demo", title: "X", source_react: "   " })
    ).toThrow(/source_react/);
  });

  it("enforces the UNIQUE slug constraint at the DB level", () => {
    createArtifact({ slug: "demo", title: "Demo", source_react: VALID_SOURCE });
    expect(() =>
      createArtifact({ slug: "demo", title: "Demo 2", source_react: VALID_SOURCE })
    ).toThrow();
  });
});

describe("reads", () => {
  let lessonAlpha: number;

  beforeEach(() => {
    lessonAlpha = seedLesson(holder.db);
    const lessonBeta = seedLesson(holder.db);
    createArtifact({ slug: "alpha", title: "Alpha", source_react: VALID_SOURCE, lesson_id: lessonAlpha });
    createArtifact({ slug: "beta", title: "Beta", source_react: VALID_SOURCE, lesson_id: lessonBeta });
  });

  it("getArtifactBySlug returns the row or null", () => {
    expect(getArtifactBySlug("alpha")?.title).toBe("Alpha");
    expect(getArtifactBySlug("missing")).toBeNull();
  });

  it("getArtifactById returns the row or null", () => {
    const a = getArtifactBySlug("alpha")!;
    expect(getArtifactById(a.id)?.slug).toBe("alpha");
    expect(getArtifactById(99999)).toBeNull();
  });

  it("listArtifacts filters by build_status", () => {
    expect(listArtifacts({ build_status: "pending_build" })).toHaveLength(2);
    expect(listArtifacts({ build_status: "qa_approved" })).toHaveLength(0);
  });

  it("listArtifacts filters by lesson_id", () => {
    const rows = listArtifacts({ lesson_id: lessonAlpha });
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("alpha");
  });
});

describe("build status transitions", () => {
  beforeEach(() => {
    createArtifact({ slug: "demo", title: "Demo", source_react: VALID_SOURCE });
  });

  it("markBuilding moves pending_build → building", () => {
    markBuilding("demo");
    expect(getArtifactBySlug("demo")!.build_status).toBe("building");
  });

  it("markBuildSuccess moves → pending_qa and records the compiled asset", () => {
    markBuilding("demo");
    markBuildSuccess("demo", buildOk());
    const a = getArtifactBySlug("demo")!;
    expect(a.build_status).toBe("pending_qa");
    expect(a.compiled_asset_path).toBe("runtime_artifacts/visual-artifacts/demo/bundle.js");
    expect(a.compiled_asset_hash).toBe("deadbeef");
    expect(a.build_error).toBeNull();
    expect(a.built_at).toBeTruthy();
  });

  it("markBuildFailed moves → build_failed and records diagnostics", () => {
    markBuilding("demo");
    markBuildFailed("demo", { ok: false, error: "Unsupported import: axios", build_log: "esbuild error" });
    const a = getArtifactBySlug("demo")!;
    expect(a.build_status).toBe("build_failed");
    expect(a.build_error).toContain("axios");
    expect(a.compiled_asset_path).toBeNull();
  });

  it("resetToPendingBuild clears a failed build back to pending_build", () => {
    markBuilding("demo");
    markBuildFailed("demo", { ok: false, error: "boom" });
    resetToPendingBuild("demo");
    const a = getArtifactBySlug("demo")!;
    expect(a.build_status).toBe("pending_build");
    expect(a.build_error).toBeNull();
  });

  it("updateSource resets an approved artifact back to pending_build with a new hash", () => {
    markBuilding("demo");
    markBuildSuccess("demo", buildOk());
    approveArtifact("demo", { qa_notes: "looks good" });
    const before = getArtifactBySlug("demo")!;

    const updated = updateSource("demo", "export default function C2() { return <span>v2</span>; }");
    expect(updated.build_status).toBe("pending_build");
    expect(updated.compiled_asset_path).toBeNull();
    expect(updated.approved_at).toBeNull();
    expect(updated.source_hash).not.toBe(before.source_hash);
  });
});

describe("approval gate", () => {
  beforeEach(() => {
    createArtifact({ slug: "demo", title: "Demo", source_react: VALID_SOURCE });
  });

  it("refuses to approve an artifact that has not built (status pending_build)", () => {
    expect(() => approveArtifact("demo", {})).toThrow(/pending_qa/);
  });

  it("refuses to approve a build_failed artifact", () => {
    markBuilding("demo");
    markBuildFailed("demo", { ok: false, error: "boom" });
    expect(() => approveArtifact("demo", {})).toThrow(/pending_qa/);
  });

  it("approves a pending_qa artifact and persists QA evidence", () => {
    markBuilding("demo");
    markBuildSuccess("demo", buildOk());
    const approved = approveArtifact("demo", {
      qa_notes: "control changes all stages; insight updates",
      qa_snapshot_ref: "state/qa/demo-snapshot.txt",
      qa_screenshot_ref: "state/qa/demo-screenshot.png",
      approved_by: "qa-agent",
    });
    expect(approved.build_status).toBe("qa_approved");
    expect(approved.qa_snapshot_ref).toBe("state/qa/demo-snapshot.txt");
    expect(approved.qa_screenshot_ref).toBe("state/qa/demo-screenshot.png");
    expect(approved.approved_by).toBe("qa-agent");
    expect(approved.approved_at).toBeTruthy();
  });

  it("rejectArtifact moves → qa_rejected with notes", () => {
    markBuilding("demo");
    markBuildSuccess("demo", buildOk());
    const rejected = rejectArtifact("demo", "control did not change the insight line");
    expect(rejected.build_status).toBe("qa_rejected");
    expect(rejected.qa_notes).toContain("insight line");
  });

  it("throws when approving a missing artifact", () => {
    expect(() => approveArtifact("nope", {})).toThrow(/not found/i);
  });
});

describe("recordQaEvidence", () => {
  beforeEach(() => {
    createArtifact({ slug: "demo", title: "Demo", source_react: VALID_SOURCE });
  });

  it("attaches QA snapshot/screenshot refs without changing build_status", () => {
    markBuilding("demo");
    markBuildSuccess("demo", buildOk());
    approveArtifact("demo", {});
    const updated = recordQaEvidence("demo", {
      qa_notes: "Chrome MCP: control changes all stages",
      qa_snapshot_ref: "state/qa/demo-snapshot.txt",
      qa_screenshot_ref: "state/qa/demo-desktop.png",
    });
    expect(updated.build_status).toBe("qa_approved"); // unchanged
    expect(updated.qa_snapshot_ref).toBe("state/qa/demo-snapshot.txt");
    expect(updated.qa_screenshot_ref).toBe("state/qa/demo-desktop.png");
    expect(updated.qa_notes).toContain("all stages");
  });

  it("works on a non-approved artifact too (evidence is status-independent)", () => {
    const updated = recordQaEvidence("demo", { qa_screenshot_ref: "state/qa/demo.png" });
    expect(updated.build_status).toBe("pending_build");
    expect(updated.qa_screenshot_ref).toBe("state/qa/demo.png");
  });

  it("COALESCE preserves existing evidence when a field is omitted", () => {
    recordQaEvidence("demo", { qa_snapshot_ref: "snap1.txt" });
    const updated = recordQaEvidence("demo", { qa_screenshot_ref: "shot1.png" });
    expect(updated.qa_snapshot_ref).toBe("snap1.txt"); // preserved
    expect(updated.qa_screenshot_ref).toBe("shot1.png");
  });

  it("throws on a missing artifact", () => {
    expect(() => recordQaEvidence("nope", { qa_notes: "x" })).toThrow(/not found/i);
  });
});

describe("DB-level CHECK constraint", () => {
  it("rejects an unknown build_status value", () => {
    createArtifact({ slug: "demo", title: "Demo", source_react: VALID_SOURCE });
    expect(() => {
      holder.db.prepare("UPDATE visual_artifacts SET build_status = 'bogus' WHERE slug = 'demo'").run();
    }).toThrow();
  });
});

describe("upsertLegacyApproved", () => {
  it("inserts a qa_approved legacy artifact and is idempotent", () => {
    const first = upsertLegacyApproved({
      slug: "supply-demand",
      title: "Supply & Demand",
      source_react: "// registered component placeholder",
      compiled_asset_path: "registry://supply-demand",
      compiled_asset_hash: "legacyhash",
      qa_notes: "legacy reviewed component",
    });
    expect(first.build_status).toBe("qa_approved");
    expect(first.approved_by).toBe("legacy-migration");

    // Second call must not create a duplicate; returns the existing row.
    const second = upsertLegacyApproved({
      slug: "supply-demand",
      title: "Supply & Demand v2",
      source_react: "// changed",
      compiled_asset_path: "registry://supply-demand",
      compiled_asset_hash: "legacyhash2",
      qa_notes: "should be ignored",
    });
    expect(second.id).toBe(first.id);
    expect(second.title).toBe("Supply & Demand");
    expect(listArtifacts()).toHaveLength(1);
  });
});
