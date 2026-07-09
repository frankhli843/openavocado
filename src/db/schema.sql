-- AvocadoCore SQLite Schema
-- Multi-user adaptive learning platform
-- Runtime DB lives in data/ (gitignored). Only schema/migrations are committed.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── USERS & IDENTITY ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  display_name TEXT   NOT NULL,
  email       TEXT    UNIQUE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── LEARNER PROFILES ──────────────────────────────────────────────────────────
-- Separated from users so a deployment can support multiple learner profiles
-- per account, or a shared account with distinct learner contexts.

CREATE TABLE IF NOT EXISTS learner_profiles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name    TEXT    NOT NULL,
  bio             TEXT,
  preferred_lang  TEXT    NOT NULL DEFAULT 'en',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── SUBJECTS ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subjects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  description     TEXT,
  status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  goals           TEXT,   -- editable long-form goals text
  criteria        TEXT,   -- learner notes for the lesson generator: what to optimize for, preferred style, constraints, context
  current_level   TEXT    NOT NULL DEFAULT 'familiarity' CHECK (current_level IN ('familiarity', 'competence', 'mastery')),
  archived_at     TEXT,   -- set when a subject is archived (reversible); NULL when active
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── DIAGNOSTICS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS diagnostics (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  question        TEXT    NOT NULL,
  answer          TEXT,
  completed_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── LESSONS ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lessons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  description     TEXT,
  status          TEXT    NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'skipped', 'discarded')),
  sequence_number INTEGER NOT NULL DEFAULT 0,
  goals           TEXT,   -- JSON array of lesson goals
  tags            TEXT,   -- JSON array of tag strings
  -- Completion tracking
  started_at      TEXT,
  completed_at    TEXT,
  -- Discard tracking (soft-delete for incomplete lessons)
  discarded_at    TEXT,   -- set when learner discards an incomplete lesson; NULL otherwise
  discard_reason  TEXT,   -- optional learner note on why they discarded this lesson
  -- Generator metadata
  generated_by    TEXT,   -- agent/skill identifier
  generator_version TEXT,
  source_context  TEXT,   -- JSON: what signals triggered this lesson
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── LESSON ACTIVITIES ─────────────────────────────────────────────────────────
-- Core sections: audio, interactive, practice_code, assessment
-- Optional sections: reading, flashcards, case_study, diagram, project, debate, reference

CREATE TABLE IF NOT EXISTS lesson_activities (
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
  content         TEXT,   -- JSON: activity-specific content spec
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── ATTEMPTS ──────────────────────────────────────────────────────────────────
-- Immutable audit trail of learner interactions with activities

CREATE TABLE IF NOT EXISTS attempts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id     INTEGER NOT NULL REFERENCES lesson_activities(id) ON DELETE CASCADE,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  attempt_type    TEXT    NOT NULL, -- 'autosave', 'run', 'submit', 'complete'
  content         TEXT,   -- JSON: the saved state (code, answers, etc.)
  result          TEXT,   -- JSON: run output, test results, evaluation
  is_final        INTEGER NOT NULL DEFAULT 0 CHECK (is_final IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── MASTERY SIGNALS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mastery_signals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  lesson_id       INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  signal_type     TEXT    NOT NULL CHECK (signal_type IN (
                    'strength', 'weak_spot', 'misconception', 'review_needed', 'ready_to_advance'
                  )),
  concept         TEXT    NOT NULL,
  detail          TEXT,
  confidence      REAL    CHECK (confidence BETWEEN 0.0 AND 1.0),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── TAGS ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tags (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL UNIQUE,
  tag_type        TEXT    NOT NULL DEFAULT 'concept' CHECK (tag_type IN (
                    'concept', 'misconception', 'review_topic', 'curriculum_area', 'lesson_type'
                  )),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_tags (
  lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, tag_id)
);

CREATE TABLE IF NOT EXISTS subject_tags (
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, tag_id)
);

-- ─── PROGRESS POINTS ───────────────────────────────────────────────────────────
-- Time-series data for graphing

CREATE TABLE IF NOT EXISTS progress_points (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  lesson_id       INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  metric          TEXT    NOT NULL CHECK (metric IN (
                    'mastery', 'confidence', 'assessment_score',
                    'code_tests_passed', 'review_frequency', 'weak_spot_count'
                  )),
  value           REAL    NOT NULL,
  recorded_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── GENERATED ARTIFACTS ───────────────────────────────────────────────────────
-- Durable metadata for all generated assets (audio, images, exports)
-- Actual files stay in gitignored runtime storage

CREATE TABLE IF NOT EXISTS generated_artifacts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id       INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  activity_id     INTEGER REFERENCES lesson_activities(id) ON DELETE SET NULL,
  artifact_type   TEXT    NOT NULL CHECK (artifact_type IN ('audio', 'image', 'export', 'transcript')),
  -- Audio-specific
  provider        TEXT,   -- 'openai-tts', 'local-f5', etc.
  voice           TEXT,
  duration_sec    REAL,
  content_hash    TEXT,   -- SHA256 of the generated file
  -- Storage
  file_path       TEXT,   -- relative path within gitignored runtime storage
  object_key      TEXT,   -- for S3/object storage adapters
  -- Source tracking
  source_script   TEXT,   -- the text/script used to generate this artifact
  script_version  TEXT,   -- hash or version of the source script
  generated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── NEXT LESSON JOBS ──────────────────────────────────────────────────────────
-- Adapter metadata for queued next-lesson generation tasks

CREATE TABLE IF NOT EXISTS next_lesson_jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  completed_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  discarded_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL, -- set when triggered by a discard
  trigger_event   TEXT    NOT NULL DEFAULT 'lesson.completed' CHECK (trigger_event IN ('lesson.completed', 'lesson.discarded', 'subject.created')),
  adapter         TEXT    NOT NULL DEFAULT 'noop', -- 'agent-harness', 'dora-task', 'webhook', 'local-queue', 'noop'
  status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'completed', 'failed')),
  payload         TEXT,   -- JSON: the event payload (lesson.completed or lesson.discarded)
  adapter_ref     TEXT,   -- external reference (dora task id, webhook delivery id, etc.)
  error           TEXT,
  dispatched_at   TEXT,
  completed_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── SUBJECT WORKPADS ───────────────────────────────────────────────────────
-- Living AI markdown documents maintained per subject, per learner.
-- Stores research findings, learner progress, misconceptions, current plan,
-- next-lesson direction, and decisions made. Updated each time a lesson is
-- completed or an incomplete lesson is discarded.
-- Private learner data — stored in gitignored runtime DB, not committed.

CREATE TABLE IF NOT EXISTS subject_workpads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  content         TEXT    NOT NULL DEFAULT '', -- Markdown content
  version         INTEGER NOT NULL DEFAULT 1,  -- monotonically incrementing on each update
  last_updated_by TEXT,   -- agent/skill identifier that performed the last update
  last_updated_for TEXT   CHECK (last_updated_for IN ('lesson_completion', 'lesson_discard', 'manual', NULL)),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subject_id, learner_id)
);

-- ─── LESSON AUTOSAVE ───────────────────────────────────────────────────────────
-- Per-lesson lightweight autosave store (not an immutable audit trail)
-- Merges the latest in-progress state across all activity types

CREATE TABLE IF NOT EXISTS lesson_autosave (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  -- activity_id = 0 means "lesson-level" (not scoped to a specific activity)
  activity_id     INTEGER NOT NULL DEFAULT 0,
  -- Code state
  code_draft      TEXT,
  run_output      TEXT,
  test_results    TEXT,   -- JSON
  runtime_errors  TEXT,   -- JSON
  -- Assessment state
  assessment_answers TEXT, -- JSON: {question_id: answer}
  -- Interactive widget state (control values), keyed to the interactive activity_id
  widget_state    TEXT,   -- JSON: {control_id: number}
  -- Timestamps
  last_edited_at  TEXT,
  last_run_at     TEXT,
  saved_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lesson_id, learner_id, activity_id)
);

-- ─── INDEXES ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_learner_profiles_user_id ON learner_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_learner_id ON subjects(learner_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON lessons(subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_lesson_activities_lesson_id ON lesson_activities(lesson_id);
CREATE INDEX IF NOT EXISTS idx_attempts_activity_id ON attempts(activity_id);
CREATE INDEX IF NOT EXISTS idx_mastery_signals_learner_subject ON mastery_signals(learner_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_progress_points_learner_subject ON progress_points(learner_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_progress_points_recorded_at ON progress_points(recorded_at);
CREATE INDEX IF NOT EXISTS idx_generated_artifacts_lesson_id ON generated_artifacts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_next_lesson_jobs_subject_id ON next_lesson_jobs(subject_id);
CREATE INDEX IF NOT EXISTS idx_lesson_autosave_lesson_learner ON lesson_autosave(lesson_id, learner_id);
CREATE INDEX IF NOT EXISTS idx_subject_workpads_subject_learner ON subject_workpads(subject_id, learner_id);
