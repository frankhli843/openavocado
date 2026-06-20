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

  // Learner criteria / notes for lesson generator (subject-level).
  if (!hasColumn("subjects", "criteria")) {
    db.exec("ALTER TABLE subjects ADD COLUMN criteria TEXT");
  }

  // Soft-delete tracking for discarded incomplete lessons.
  if (!hasColumn("lessons", "discarded_at")) {
    db.exec("ALTER TABLE lessons ADD COLUMN discarded_at TEXT");
  }
  if (!hasColumn("lessons", "discard_reason")) {
    db.exec("ALTER TABLE lessons ADD COLUMN discard_reason TEXT");
  }

  // Discard trigger for next_lesson_jobs and the discarded lesson reference.
  if (!hasColumn("next_lesson_jobs", "trigger_event")) {
    db.exec(
      "ALTER TABLE next_lesson_jobs ADD COLUMN trigger_event TEXT NOT NULL DEFAULT 'lesson.completed'"
    );
  }
  if (!hasColumn("next_lesson_jobs", "discarded_lesson_id")) {
    db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN discarded_lesson_id INTEGER");
  }

  // The lessons.status CHECK constraint cannot be ALTERed in SQLite.
  // When an older DB predates the 'discarded' status value, rebuild the table
  // preserving every row. Same non-destructive pattern as migrateActivityTypeCheck.
  migrateLessonStatusCheck(db);

  // The lesson_activities.activity_type CHECK constraint cannot be ALTERed in
  // SQLite. When an older DB predates the 'media' activity type, rebuild the
  // table inside a transaction, preserving every row and id. This is the
  // standard, non-destructive SQLite table rebuild and is idempotent: the guard
  // checks the stored table SQL for the 'media' value before doing anything.
  migrateActivityTypeCheck(db);

  // Ensure subject_workpads table exists (added after initial schema).
  // CREATE TABLE IF NOT EXISTS in schema.sql handles fresh installs; this
  // also runs on existing DBs where schema.sql was already applied without it.
  db.exec(`
    CREATE TABLE IF NOT EXISTS subject_workpads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
      content         TEXT    NOT NULL DEFAULT '',
      version         INTEGER NOT NULL DEFAULT 1,
      last_updated_by TEXT,
      last_updated_for TEXT,
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (subject_id, learner_id)
    )
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_subject_workpads_subject_learner ON subject_workpads(subject_id, learner_id)"
  );
}

/**
 * Rebuild the lessons table when it predates the 'discarded' status value.
 * SQLite cannot ALTER CHECK constraints, so we use the same table-rebuild
 * pattern as migrateActivityTypeCheck. Idempotent: guards on the stored SQL.
 */
function migrateLessonStatusCheck(db: Database.Database): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='lessons'")
    .get() as { sql: string } | undefined;
  if (!row || /'discarded'/.test(row.sql)) return; // already allows 'discarded'

  const fkWasOn = (db.pragma("foreign_keys", { simple: true }) as number) === 1;
  if (fkWasOn) db.pragma("foreign_keys = OFF");
  try {
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE lessons__new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          title           TEXT    NOT NULL,
          description     TEXT,
          status          TEXT    NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'skipped', 'discarded')),
          sequence_number INTEGER NOT NULL DEFAULT 0,
          goals           TEXT,
          tags            TEXT,
          started_at      TEXT,
          completed_at    TEXT,
          discarded_at    TEXT,
          discard_reason  TEXT,
          generated_by    TEXT,
          generator_version TEXT,
          source_context  TEXT,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `);
      db.exec(`
        INSERT INTO lessons__new
          (id, subject_id, title, description, status, sequence_number, goals, tags,
           started_at, completed_at, discarded_at, discard_reason,
           generated_by, generator_version, source_context, created_at, updated_at)
        SELECT id, subject_id, title, description, status, sequence_number, goals, tags,
               started_at, completed_at,
               NULL AS discarded_at, NULL AS discard_reason,
               generated_by, generator_version, source_context, created_at, updated_at
        FROM lessons;
      `);
      db.exec("DROP TABLE lessons;");
      db.exec("ALTER TABLE lessons__new RENAME TO lessons;");
      db.exec("CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON lessons(subject_id);");
      db.exec("CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);");
    });
    rebuild();
  } finally {
    if (fkWasOn) db.pragma("foreign_keys = ON");
  }
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
