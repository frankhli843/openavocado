#!/usr/bin/env tsx
/**
 * migrate-add-video-artifact-type.ts
 *
 * Expands the generated_artifacts.artifact_type CHECK constraint to include
 * 'video' (the original only allowed audio/image/export/transcript). SQLite
 * cannot ALTER a CHECK in place, so this does the canonical 12-step table
 * rebuild inside a transaction, after taking a timestamped file backup and with
 * a row-count assertion after.
 *
 * scripts/migrate.ts is schema-apply-only (it just re-applies schema.sql on
 * connect and would not rebuild an existing table), so this standalone migration
 * carries the backup/transaction/rowcount discipline the acceptance requires.
 *
 * Idempotent: if 'video' is already allowed, it exits 0 without touching the DB.
 *
 * Env: AVOCADOCORE_DB_PATH (default data/avocadocore.db). Node 22 (better-sqlite3).
 * Usage: tsx scripts/migrate-add-video-artifact-type.ts [--dry-run]
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dbPath = process.env.AVOCADOCORE_DB_PATH ?? "data/avocadocore.db";
const dryRun = process.argv.includes("--dry-run");

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

const currentDDL = (
  db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='generated_artifacts'`).get() as
    | { sql: string }
    | undefined
)?.sql;

if (!currentDDL) {
  console.error("generated_artifacts table not found");
  process.exit(1);
}

if (/artifact_type\s+IN\s*\([^)]*'video'/i.test(currentDDL)) {
  console.log("✓ 'video' already allowed in generated_artifacts CHECK — nothing to do.");
  db.close();
  process.exit(0);
}

const beforeCount = (db.prepare(`SELECT COUNT(*) c FROM generated_artifacts`).get() as { c: number }).c;
console.log(`generated_artifacts rows before: ${beforeCount}`);

if (dryRun) {
  console.log("--dry-run: would back up the DB and rebuild generated_artifacts with CHECK including 'video'.");
  db.close();
  process.exit(0);
}

// ─── 1. timestamped backup FIRST ─────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(
  path.dirname(dbPath),
  `${path.basename(dbPath, ".db")}.before-video-artifact-type-${stamp}.db`
);
fs.copyFileSync(dbPath, backup);
console.log(`Backup written: ${backup}`);

// New table DDL: identical to the original but with 'video' added to the CHECK.
const newTableDDL = `CREATE TABLE generated_artifacts_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id       INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  activity_id     INTEGER REFERENCES lesson_activities(id) ON DELETE SET NULL,
  artifact_type   TEXT    NOT NULL CHECK (artifact_type IN ('audio', 'image', 'export', 'transcript', 'video')),
  provider        TEXT,
  voice           TEXT,
  duration_sec    REAL,
  content_hash    TEXT,
  file_path       TEXT,
  object_key      TEXT,
  source_script   TEXT,
  script_version  TEXT,
  generated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
)`;

// ─── 12-step rebuild (foreign_keys pragma must toggle OUTSIDE the tx) ─────────
db.pragma("foreign_keys = OFF");
const rebuild = db.transaction(() => {
  db.exec(newTableDDL);
  db.exec(
    `INSERT INTO generated_artifacts_new
       (id, lesson_id, activity_id, artifact_type, provider, voice, duration_sec,
        content_hash, file_path, object_key, source_script, script_version, generated_at, created_at)
     SELECT id, lesson_id, activity_id, artifact_type, provider, voice, duration_sec,
        content_hash, file_path, object_key, source_script, script_version, generated_at, created_at
     FROM generated_artifacts`
  );
  db.exec(`DROP TABLE generated_artifacts`);
  db.exec(`ALTER TABLE generated_artifacts_new RENAME TO generated_artifacts`);
  // recreate index that lived on the table
  db.exec(`CREATE INDEX IF NOT EXISTS idx_generated_artifacts_lesson_id ON generated_artifacts(lesson_id)`);
});
rebuild();
const fkProblems = db.pragma("foreign_key_check") as unknown[];
db.pragma("foreign_keys = ON");

// ─── row-count assert + integrity ────────────────────────────────────────────
const afterCount = (db.prepare(`SELECT COUNT(*) c FROM generated_artifacts`).get() as { c: number }).c;
const newDDL = (
  db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='generated_artifacts'`).get() as {
    sql: string;
  }
).sql;
const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
db.close();

console.log(`generated_artifacts rows after:  ${afterCount}`);
if (afterCount !== beforeCount) {
  console.error(`FAIL: row count changed (${beforeCount} → ${afterCount}). Restore from ${backup}`);
  process.exit(1);
}
if (fkProblems.length > 0) {
  console.error(`FAIL: foreign_key_check reported ${fkProblems.length} problem(s). Restore from ${backup}`);
  process.exit(1);
}
if (integrity[0]?.integrity_check !== "ok") {
  console.error(`FAIL: integrity_check = ${JSON.stringify(integrity)}. Restore from ${backup}`);
  process.exit(1);
}
if (!/'video'/.test(newDDL)) {
  console.error("FAIL: new DDL does not include 'video'");
  process.exit(1);
}

console.log("✓ Migration complete: CHECK now includes 'video', row count preserved, integrity ok.");
console.log(`  Backup: ${backup}`);
