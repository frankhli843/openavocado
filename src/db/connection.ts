/**
 * SQLite database connection singleton.
 * Runtime DB path is configurable via env var and defaults to data/avocadocore.db (gitignored).
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { readFileSync } from "fs";

const DB_PATH =
  process.env.AVOCADOCORE_DB_PATH ||
  path.join(process.cwd(), "data", "avocadocore.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure the data directory exists (gitignored)
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Apply schema on first connection
  // Use process.cwd() instead of __dirname — __dirname resolves to .next/server/... in bundled Next.js
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  _db.exec(schema);

  applyAdditiveMigrations(_db);

  return _db;
}

/**
 * Idempotent additive migrations for columns introduced after the initial
 * schema. `CREATE TABLE IF NOT EXISTS` never adds columns to existing tables,
 * so new optional columns are applied here. Each ALTER is guarded by a column
 * existence check, so this is safe to run on every connection.
 */
function applyAdditiveMigrations(db: Database.Database): void {
  const hasColumn = (table: string, column: string): boolean => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return cols.some((c) => c.name === column);
  };

  if (!hasColumn("lesson_autosave", "widget_state")) {
    db.exec("ALTER TABLE lesson_autosave ADD COLUMN widget_state TEXT");
  }
}

/** Close the DB (for tests / graceful shutdown). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
