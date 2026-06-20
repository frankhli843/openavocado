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

  // Reversible subject archive: track when a subject was archived.
  if (!hasColumn("subjects", "archived_at")) {
    db.exec("ALTER TABLE subjects ADD COLUMN archived_at TEXT");
  }

  // The lesson_activities.activity_type CHECK constraint cannot be ALTERed in
  // SQLite. When an older DB predates the 'media' activity type, rebuild the
  // table inside a transaction, preserving every row and id. This is the
  // standard, non-destructive SQLite table rebuild and is idempotent: the guard
  // checks the stored table SQL for the 'media' value before doing anything.
  migrateActivityTypeCheck(db);
}

function migrateActivityTypeCheck(db: Database.Database): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='lesson_activities'")
    .get() as { sql: string } | undefined;
  if (!row || /'media'/.test(row.sql)) return; // already allows 'media'

  const fkWasOn = (db.pragma("foreign_keys", { simple: true }) as number) === 1;
  if (fkWasOn) db.pragma("foreign_keys = OFF");
  try {
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE lesson_activities__new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
          activity_type   TEXT    NOT NULL CHECK (activity_type IN (
                            'audio', 'reading', 'media', 'interactive',
                            'practice_code', 'assessment',
                            'flashcards', 'case_study', 'diagram',
                            'project', 'debate', 'reference'
                          )),
          is_core         INTEGER NOT NULL DEFAULT 1 CHECK (is_core IN (0, 1)),
          sequence_order  INTEGER NOT NULL DEFAULT 0,
          title           TEXT,
          content         TEXT,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `);
      db.exec(
        `INSERT INTO lesson_activities__new
           (id, lesson_id, activity_type, is_core, sequence_order, title, content, created_at, updated_at)
         SELECT id, lesson_id, activity_type, is_core, sequence_order, title, content, created_at, updated_at
         FROM lesson_activities;`
      );
      db.exec("DROP TABLE lesson_activities;");
      db.exec("ALTER TABLE lesson_activities__new RENAME TO lesson_activities;");
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_lesson_activities_lesson_id ON lesson_activities(lesson_id);"
      );
    });
    rebuild();
  } finally {
    if (fkWasOn) db.pragma("foreign_keys = ON");
  }
}

/** Close the DB (for tests / graceful shutdown). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
