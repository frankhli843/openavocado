/**
 * Tests for the knowledge graph orientation feature:
 *  - validateKnowledgeGraphData (contract validator)
 *  - Seed coverage: all seeded lessons have knowledge_graph_data
 *  - Graph data integrity: every seeded lesson's graph is valid
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync } from "fs";
import os from "os";
import path from "path";
import type Database from "better-sqlite3";
import type { KnowledgeGraphData } from "@/types";

// ─── Validator unit tests (pure, no DB) ──────────────────────────────────────

// Import synchronously after the test file loads — the validator has no DB dep.
import { validateKnowledgeGraphData } from "@/lib/lesson-generator/contract";

describe("validateKnowledgeGraphData", () => {
  it("passes a well-formed high-level graph", () => {
    const g: KnowledgeGraphData = {
      type: "high-level",
      title: "Probability Overview",
      nodes: [
        { id: "root", label: "Probability", category: "subject_root", covered: true },
        { id: "cond", label: "Conditional P", category: "concept", covered: true },
        { id: "bayes", label: "Bayes", category: "concept", covered: false, preview: true },
      ],
      edges: [
        { from: "root", to: "cond" },
        { from: "root", to: "bayes" },
      ],
    };
    const r = validateKnowledgeGraphData(g);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("passes a focused graph with empty edge list", () => {
    const g: KnowledgeGraphData = {
      type: "focused",
      title: "Bayes Deep Dive",
      nodes: [
        { id: "root", label: "Bayes", category: "subject_root", covered: true },
        { id: "prior", label: "Prior", category: "concept", covered: true },
        { id: "posterior", label: "Posterior", category: "concept", covered: true },
      ],
      edges: [],
    };
    const r = validateKnowledgeGraphData(g);
    expect(r.valid).toBe(true);
  });

  it("fails when type is invalid", () => {
    const r = validateKnowledgeGraphData({
      type: "wrong",
      title: "T",
      nodes: [
        { id: "a", label: "A", category: "subject_root", covered: true },
        { id: "b", label: "B", covered: false },
      ],
      edges: [],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("type"))).toBe(true);
  });

  it("fails when title is missing or empty", () => {
    const r = validateKnowledgeGraphData({
      type: "high-level",
      title: "  ",
      nodes: [
        { id: "a", label: "A", category: "subject_root", covered: true },
        { id: "b", label: "B", covered: false },
      ],
      edges: [],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("title"))).toBe(true);
  });

  it("fails with fewer than 2 nodes", () => {
    const r = validateKnowledgeGraphData({
      type: "focused",
      title: "Lonely",
      nodes: [{ id: "root", label: "Root", category: "subject_root", covered: true }],
      edges: [],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("2 nodes"))).toBe(true);
  });

  it("fails when no subject_root node is present", () => {
    const r = validateKnowledgeGraphData({
      type: "focused",
      title: "No root",
      nodes: [
        { id: "a", label: "A", category: "concept", covered: true },
        { id: "b", label: "B", category: "concept", covered: false },
      ],
      edges: [],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("subject_root"))).toBe(true);
  });

  it("fails when an edge references a nonexistent node id", () => {
    const r = validateKnowledgeGraphData({
      type: "high-level",
      title: "Edge mismatch",
      nodes: [
        { id: "root", label: "Root", category: "subject_root", covered: true },
        { id: "child", label: "Child", covered: true },
      ],
      edges: [{ from: "root", to: "ghost" }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('"ghost"'))).toBe(true);
  });

  it("rejects non-object input gracefully", () => {
    expect(validateKnowledgeGraphData(null).valid).toBe(false);
    expect(validateKnowledgeGraphData("string").valid).toBe(false);
    expect(validateKnowledgeGraphData(42).valid).toBe(false);
  });
});

// ─── Seed coverage tests (file-backed DB) ────────────────────────────────────

const TMP_DB = path.join(os.tmpdir(), `avo-kgtest-${process.pid}.db`);

let db: Database.Database;
let closeDb: () => void;

beforeAll(async () => {
  for (const s of ["", "-wal", "-shm"]) {
    try { rmSync(TMP_DB + s, { force: true }); } catch { /* ignore */ }
  }
  process.env.AVOCADOCORE_DB_PATH = TMP_DB;
  const { getDb, closeDb: close } = await import("@/db/connection");
  const { seedDatabase } = await import("@/db/seed");
  seedDatabase();
  db = getDb();
  closeDb = close;
});

afterAll(() => {
  try { closeDb?.(); } catch { /* ignore */ }
  for (const s of ["", "-wal", "-shm"]) {
    try { rmSync(TMP_DB + s, { force: true }); } catch { /* ignore */ }
  }
});

describe("seed knowledge_graph_data coverage", () => {
  it("all seeded lessons have knowledge_graph_data set", () => {
    const rows = db
      .prepare("SELECT id, title, knowledge_graph_data FROM lessons")
      .all() as Array<{ id: number; title: string; knowledge_graph_data: string | null }>;

    expect(rows.length).toBeGreaterThan(0);
    const missing = rows.filter((r) => !r.knowledge_graph_data);
    expect(
      missing,
      `Lessons missing knowledge_graph_data: ${missing.map((r) => `#${r.id} ${r.title}`).join(", ")}`
    ).toHaveLength(0);
  });

  it("every seeded lesson's graph is valid JSON and passes validateKnowledgeGraphData", () => {
    const rows = db
      .prepare("SELECT id, title, knowledge_graph_data FROM lessons WHERE knowledge_graph_data IS NOT NULL")
      .all() as Array<{ id: number; title: string; knowledge_graph_data: string }>;

    for (const row of rows) {
      let parsed: unknown;
      expect(
        () => { parsed = JSON.parse(row.knowledge_graph_data); },
        `lesson #${row.id} graph is not valid JSON`
      ).not.toThrow();
      const result = validateKnowledgeGraphData(parsed);
      expect(
        result.errors,
        `lesson #${row.id} "${row.title}" graph errors: ${result.errors.join("; ")}`
      ).toHaveLength(0);
    }
  });

  it("every seeded lesson graph has at least one subject_root node", () => {
    const rows = db
      .prepare("SELECT id, title, knowledge_graph_data FROM lessons WHERE knowledge_graph_data IS NOT NULL")
      .all() as Array<{ id: number; title: string; knowledge_graph_data: string }>;

    for (const row of rows) {
      const g = JSON.parse(row.knowledge_graph_data) as KnowledgeGraphData;
      const hasRoot = g.nodes.some((n) => n.category === "subject_root");
      expect(hasRoot, `lesson #${row.id} has no subject_root node`).toBe(true);
    }
  });

  it("lesson 4 (GDM) graph has at least 5 covered concept nodes", () => {
    const row = db
      .prepare("SELECT knowledge_graph_data FROM lessons WHERE title = 'From Raw Image to Model-Ready Tensor'")
      .get() as { knowledge_graph_data: string } | undefined;
    expect(row, "Lesson 4 not found").toBeDefined();

    const g = JSON.parse(row!.knowledge_graph_data) as KnowledgeGraphData;
    const covered = g.nodes.filter((n) => n.covered && n.category !== "subject_root");
    expect(covered.length).toBeGreaterThanOrEqual(5);
  });

  it("lesson 4 graph has preview nodes (concepts taught in later lessons)", () => {
    const row = db
      .prepare("SELECT knowledge_graph_data FROM lessons WHERE title = 'From Raw Image to Model-Ready Tensor'")
      .get() as { knowledge_graph_data: string } | undefined;
    expect(row, "Lesson 4 not found").toBeDefined();

    const g = JSON.parse(row!.knowledge_graph_data) as KnowledgeGraphData;
    const previews = g.nodes.filter((n) => n.preview);
    expect(previews.length, "Lesson 4 graph should have at least 1 preview (coming-later) node").toBeGreaterThanOrEqual(1);
  });

  it("all seeded lesson graphs have at least one edge", () => {
    const rows = db
      .prepare("SELECT id, title, knowledge_graph_data FROM lessons WHERE knowledge_graph_data IS NOT NULL")
      .all() as Array<{ id: number; title: string; knowledge_graph_data: string }>;

    for (const row of rows) {
      const g = JSON.parse(row.knowledge_graph_data) as KnowledgeGraphData;
      expect(g.edges.length, `lesson #${row.id} has no edges`).toBeGreaterThan(0);
    }
  });

  it("all graphs include the knowledge_graph_data column in the lessons table schema", () => {
    const columns = db
      .prepare("PRAGMA table_info(lessons)")
      .all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("knowledge_graph_data");
  });
});
