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

  return _db;
}

/** Close the DB (for tests / graceful shutdown). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
