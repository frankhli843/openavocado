/**
 * SQLite database connection singleton.
 * Runtime DB path is configurable via env var and defaults to data/avocadocore.db (gitignored).
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { readFileSync } from "fs";
import { scryptSync, randomBytes } from "crypto";

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

  // Active learner profile pointer on the account (multi-profile support).
  if (!hasColumn("users", "active_learner_id")) {
    db.exec("ALTER TABLE users ADD COLUMN active_learner_id INTEGER REFERENCES learner_profiles(id) ON DELETE SET NULL");
  }

  // Per-profile learner configuration JSON for lesson generation.
  if (!hasColumn("learner_profiles", "config")) {
    db.exec("ALTER TABLE learner_profiles ADD COLUMN config TEXT");
  }

  // End-of-lesson freeform next-lesson diagnostics (JSON array).
  if (!hasColumn("lessons", "next_lesson_diagnostics")) {
    db.exec("ALTER TABLE lessons ADD COLUMN next_lesson_diagnostics TEXT");
  }
  // Knowledge graph orientation authored per-lesson by the generator.
  if (!hasColumn("lessons", "knowledge_graph_data")) {
    db.exec("ALTER TABLE lessons ADD COLUMN knowledge_graph_data TEXT");
  }

  // Difficulty + tag link on mastery signals so tag-plus-difficulty evidence is
  // queryable. SQLite allows adding columns with a CHECK that permits NULL.
  if (!hasColumn("mastery_signals", "difficulty")) {
    db.exec(
      "ALTER TABLE mastery_signals ADD COLUMN difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL)"
    );
  }
  if (!hasColumn("mastery_signals", "tag_id")) {
    db.exec("ALTER TABLE mastery_signals ADD COLUMN tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL");
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

  // The next_lesson_jobs.trigger_event CHECK constraint cannot be ALTERed in
  // SQLite. Rebuild when an older DB predates the subject.created trigger.
  migrateNextLessonJobTriggerCheck(db);

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

  // Saved per-lesson chat history + compacted prompt context.
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_chat_messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
      role            TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
      content         TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_chat_state (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
      compact_summary TEXT    NOT NULL DEFAULT '',
      compacted_through_message_id INTEGER,
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (lesson_id, learner_id)
    )
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_lesson_chat_messages_lesson_learner ON lesson_chat_messages(lesson_id, learner_id, id)"
  );

  // Append-only subject planning/research/lesson-generation journal.
  db.exec(`
    CREATE TABLE IF NOT EXISTS subject_journal_entries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
      entry_type      TEXT    NOT NULL DEFAULT 'planning' CHECK (entry_type IN (
                        'lesson_completion', 'lesson_generation', 'research',
                        'planning', 'manual', 'lesson_discard'
                      )),
      title           TEXT    NOT NULL,
      content         TEXT    NOT NULL,
      metadata        TEXT,
      created_by      TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_subject_journal_subject_learner ON subject_journal_entries(subject_id, learner_id, id DESC)"
  );

  // Visual artifact pipeline — DB-backed bespoke React visualization storage.
  // Stores source, manifest, build status, compiled asset ref, and QA metadata.
  db.exec(`
    CREATE TABLE IF NOT EXISTS visual_artifacts (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      slug                TEXT    NOT NULL UNIQUE,
      title               TEXT    NOT NULL,
      lesson_id           INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
      activity_id         INTEGER REFERENCES lesson_activities(id) ON DELETE SET NULL,
      source_react        TEXT    NOT NULL,
      manifest            TEXT    NOT NULL DEFAULT '{"allowed_imports":["react","lucide-react","recharts"]}',
      source_hash         TEXT    NOT NULL,
      build_status        TEXT    NOT NULL DEFAULT 'pending_build'
                                  CHECK (build_status IN (
                                    'pending_build', 'building', 'build_failed',
                                    'pending_qa', 'qa_approved', 'qa_rejected'
                                  )),
      compiled_asset_path TEXT,
      compiled_asset_hash TEXT,
      build_error         TEXT,
      build_log           TEXT,
      built_at            TEXT,
      qa_notes            TEXT,
      qa_snapshot_ref     TEXT,
      qa_screenshot_ref   TEXT,
      approved_at         TEXT,
      approved_by         TEXT,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_visual_artifacts_slug ON visual_artifacts(slug)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_visual_artifacts_build_status ON visual_artifacts(build_status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_visual_artifacts_lesson_id ON visual_artifacts(lesson_id)");

  // Harness job lifecycle columns on next_lesson_jobs.
  // These are additive and nullable so existing rows are unaffected.
  // harness_status: fine-grained state for the native harness agent flow.
  if (!hasColumn("next_lesson_jobs", "harness_status")) {
    db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN harness_status TEXT");
  }
  // harness_stage: current stage name within the harness flow (e.g. 'planning', 'generating').
  if (!hasColumn("next_lesson_jobs", "harness_stage")) {
    db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN harness_stage TEXT");
  }
  // progress_events: JSON array of timestamped progress events for learner-visible status.
  if (!hasColumn("next_lesson_jobs", "progress_events")) {
    db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN progress_events TEXT");
  }
  // retry_count: number of times the harness has retried this job.
  if (!hasColumn("next_lesson_jobs", "retry_count")) {
    db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0");
  }
  // last_error_detail: last error detail string for display in the UI.
  if (!hasColumn("next_lesson_jobs", "last_error_detail")) {
    db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN last_error_detail TEXT");
  }
  // provider_name: which provider config was used for this job.
  if (!hasColumn("next_lesson_jobs", "provider_name")) {
    db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN provider_name TEXT");
  }
  // output_lesson_id: the lesson id produced by this job (for local-queue jobs).
  if (!hasColumn("next_lesson_jobs", "output_lesson_id")) {
    db.exec("ALTER TABLE next_lesson_jobs ADD COLUMN output_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL");
  }

  // Per-user provider configuration for the native harness.
  // Credentials (encrypted_api_key) are stored server-side only and never
  // returned to the browser. The plaintext key is decrypted at job-dispatch
  // time using AVOCADOCORE_PROVIDER_KEY_SECRET.
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_provider_configs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_name     TEXT    NOT NULL,
      base_url          TEXT,
      model             TEXT,
      encrypted_api_key TEXT,
      health_status     TEXT    NOT NULL DEFAULT 'unchecked'
                                CHECK (health_status IN ('unchecked', 'healthy', 'error')),
      health_error      TEXT,
      health_checked_at TEXT,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, provider_name)
    )
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_user_provider_configs_user_id ON user_provider_configs(user_id)"
  );

  // ── Auth: password hashing + sessions (prodavo only, safe no-op on frankavo) ──

  // Password hash column on users (scrypt format, nullable for legacy seed users)
  if (!hasColumn("users", "password_hash")) {
    db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }

  // Sessions table for auth cookie management
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)");

  // Bootstrap admin account from env vars (runs only when vars are set and user absent)
  applyAuthBootstrap(db);
}

function applyAuthBootstrap(db: Database.Database): void {
  const bootstrapUser = process.env.AVOCADOCORE_ADMIN_BOOTSTRAP_USER;
  const bootstrapPass = process.env.AVOCADOCORE_ADMIN_BOOTSTRAP_PASS;
  if (!bootstrapUser || !bootstrapPass) return;

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(bootstrapUser);
  if (existing) return; // already created

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(bootstrapPass, salt, 64).toString("hex");
  const passwordHash = `scrypt:N=32768,r=8,p=1:${salt}:${hash}`;

  const displayName = process.env.AVOCADOCORE_ADMIN_BOOTSTRAP_DISPLAY || bootstrapUser;
  const email = process.env.AVOCADOCORE_ADMIN_BOOTSTRAP_EMAIL || null;

  const result = db
    .prepare("INSERT INTO users (username, display_name, email, password_hash) VALUES (?, ?, ?, ?)")
    .run(bootstrapUser, displayName, email, passwordHash);

  const userId = result.lastInsertRowid as number;
  db.prepare(
    "INSERT INTO learner_profiles (user_id, display_name, preferred_lang) VALUES (?, ?, ?)"
  ).run(userId, displayName, "en");
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

function migrateNextLessonJobTriggerCheck(db: Database.Database): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='next_lesson_jobs'")
    .get() as { sql: string } | undefined;
  if (!row || /'subject\.created'/.test(row.sql)) return;

  const fkWasOn = (db.pragma("foreign_keys", { simple: true }) as number) === 1;
  if (fkWasOn) db.pragma("foreign_keys = OFF");
  try {
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE next_lesson_jobs__new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          completed_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
          discarded_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
          trigger_event   TEXT    NOT NULL DEFAULT 'lesson.completed' CHECK (trigger_event IN ('lesson.completed', 'lesson.discarded', 'subject.created')),
          adapter         TEXT    NOT NULL DEFAULT 'noop',
          status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'completed', 'failed')),
          payload         TEXT,
          adapter_ref     TEXT,
          error           TEXT,
          dispatched_at   TEXT,
          completed_at    TEXT,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `);
      db.exec(`
        INSERT INTO next_lesson_jobs__new
          (id, subject_id, completed_lesson_id, discarded_lesson_id, trigger_event,
           adapter, status, payload, adapter_ref, error, dispatched_at, completed_at,
           created_at, updated_at)
        SELECT id, subject_id, completed_lesson_id, discarded_lesson_id, trigger_event,
               adapter, status, payload, adapter_ref, error, dispatched_at, completed_at,
               created_at, updated_at
        FROM next_lesson_jobs;
      `);
      db.exec("DROP TABLE next_lesson_jobs;");
      db.exec("ALTER TABLE next_lesson_jobs__new RENAME TO next_lesson_jobs;");
      db.exec("CREATE INDEX IF NOT EXISTS idx_next_lesson_jobs_subject_id ON next_lesson_jobs(subject_id);");
      db.exec("CREATE INDEX IF NOT EXISTS idx_next_lesson_jobs_status ON next_lesson_jobs(status);");
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
  if (!row || /'lesson_part'/.test(row.sql)) return; // already allows lesson parts

  const fkWasOn = (db.pragma("foreign_keys", { simple: true }) as number) === 1;
  if (fkWasOn) db.pragma("foreign_keys = OFF");
  try {
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE lesson_activities__new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
          activity_type   TEXT    NOT NULL CHECK (activity_type IN (
                            'audio', 'reading', 'media', 'lesson_part', 'interactive',
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
