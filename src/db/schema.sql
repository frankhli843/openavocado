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
  -- Which learner profile is currently active for this account. NULL until a
  -- profile is selected; the app falls back to the account's first profile.
  active_learner_id INTEGER REFERENCES learner_profiles(id) ON DELETE SET NULL,
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
  -- Per-profile learner configuration that guides lesson generation: notes,
  -- preferences, context, goals at the learner (not subject) level. JSON object,
  -- privacy-safe and free-form so the shape can evolve without a migration.
  config          TEXT,
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
  -- Freeform next-lesson diagnostic prompts shown at the end of the lesson.
  -- JSON array of { id, prompt, hint? }. Answers autosave and feed next-lesson
  -- planning; they never trigger completion. NULL when a lesson has none.
  next_lesson_diagnostics TEXT,
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
                    'audio', 'reading', 'media', 'lesson_part', 'interactive',
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
  -- Difficulty of the question/evidence that produced this signal. Lets mastery
  -- and lesson generation answer "how did the learner do on hard questions
  -- tagged X". NULL when the signal is not tied to a graded difficulty.
  difficulty      TEXT    CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL),
  -- Optional direct link to the tag this signal concerns (in addition to the
  -- free-text concept). NULL when no tag row was resolved.
  tag_id          INTEGER REFERENCES tags(id) ON DELETE SET NULL,
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

-- ─── ASSESSMENT RESULTS ────────────────────────────────────────────────────────
-- Per-question evidence produced by the assessment pipeline. Captures the
-- queryable combination of tag + difficulty + outcome for every multiple-choice
-- attempt and freeform/diagnostic answer, so mastery and next-lesson generation
-- can answer questions like "how did this learner do on hard base-rate-fallacy
-- questions". Private learner data — lives in the gitignored runtime DB.

CREATE TABLE IF NOT EXISTS assessment_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  lesson_id       INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  activity_id     INTEGER REFERENCES lesson_activities(id) ON DELETE SET NULL,
  -- Question identity within the activity content (e.g. MC question id or
  -- freeform/diagnostic question id). Free text — questions live in JSON content.
  question_id     TEXT    NOT NULL,
  question_type   TEXT    NOT NULL CHECK (question_type IN ('mc', 'freeform', 'diagnostic')),
  concept         TEXT,
  difficulty      TEXT    CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL),
  -- 'correct'/'incorrect'/'idk' for graded MC; 'assessed' for freeform answers
  -- that the deterministic assessor evaluated without a hard right/wrong.
  outcome         TEXT    NOT NULL CHECK (outcome IN ('correct', 'incorrect', 'idk', 'assessed')),
  answer_text     TEXT,   -- the learner's selected choice text or freeform answer
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Tags attached to a specific assessment result by the assessor (existing tags
-- that matched plus newly created tags). Lets a result carry multiple tags.
CREATE TABLE IF NOT EXISTS assessment_result_tags (
  result_id       INTEGER NOT NULL REFERENCES assessment_results(id) ON DELETE CASCADE,
  tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (result_id, tag_id)
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
  adapter         TEXT    NOT NULL DEFAULT 'noop', -- 'dora-task', 'webhook', 'local-queue', 'agent-harness', 'noop'
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

-- ─── SUBJECT JOURNAL ────────────────────────────────────────────────────────
-- Append-only AI audit log for a subject. Unlike the workpad, these entries
-- are not overwritten. Agents add entries when lessons complete, plans change,
-- research affects direction, or a new lesson is generated.

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

-- ─── LESSON CHAT ─────────────────────────────────────────────────────────────
-- Per-lesson learner chat for quick questions while studying.
-- Full messages are preserved. The compact_summary is prompt-context
-- compaction only, so long conversations stay usable without deleting history.

CREATE TABLE IF NOT EXISTS lesson_chat_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_chat_state (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  learner_id      INTEGER NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
  compact_summary TEXT    NOT NULL DEFAULT '',
  compacted_through_message_id INTEGER,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lesson_id, learner_id)
);

-- ─── VISUAL ARTIFACTS ──────────────────────────────────────────────────────────
-- DB-backed bespoke React visualization pipeline.
-- Stores source TSX, manifest, build status, compiled asset reference, and
-- QA approval metadata. Lessons reference artifacts by slug — no source-code
-- edit required to deploy a new visualization.
--
-- SAFETY CONTRACT:
-- - Source is NEVER executed from SQLite directly.
-- - Only qa_approved artifacts have their compiled bundle served to the browser.
-- - Import allowlist enforced at build time; network/storage APIs blocked.
-- - Sandbox route checks qa_approved before serving iframe HTML.

CREATE TABLE IF NOT EXISTS visual_artifacts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Stable identifier used in lesson widget specs (widget_type: "bespoke-artifact", params.artifact_slug)
  slug                TEXT    NOT NULL UNIQUE,
  title               TEXT    NOT NULL,
  -- Optional lesson/activity association (informational; artifact is reusable)
  lesson_id           INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  activity_id         INTEGER REFERENCES lesson_activities(id) ON DELETE SET NULL,
  -- Source React component (TSX). Stored for audit and rebuild; never executed directly.
  source_react        TEXT    NOT NULL,
  -- JSON: { allowed_imports: string[], params_schema?: object, runtime_constraints?: object }
  manifest            TEXT    NOT NULL DEFAULT '{"allowed_imports":["react","lucide-react","recharts"]}',
  -- SHA-256 of source_react (hex). Used to detect stale compiled assets.
  source_hash         TEXT    NOT NULL,
  -- Build lifecycle
  build_status        TEXT    NOT NULL DEFAULT 'pending_build'
                              CHECK (build_status IN (
                                'pending_build', 'building', 'build_failed',
                                'pending_qa', 'qa_approved', 'qa_rejected'
                              )),
  -- Relative path within runtime_artifacts/ (e.g. visual-artifacts/my-slug/abc123.bundle.js)
  compiled_asset_path TEXT,
  -- SHA-256 of the compiled bundle (hex). Verified before rendering.
  compiled_asset_hash TEXT,
  -- Diagnostics from the last build attempt
  build_error         TEXT,
  build_log           TEXT,
  built_at            TEXT,
  -- QA evidence
  qa_notes            TEXT,
  -- Paths to Chrome MCP snapshot/screenshot stored under state/ or runtime_artifacts/
  qa_snapshot_ref     TEXT,
  qa_screenshot_ref   TEXT,
  approved_at         TEXT,
  approved_by         TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── INDEXES ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_visual_artifacts_slug ON visual_artifacts(slug);
CREATE INDEX IF NOT EXISTS idx_visual_artifacts_build_status ON visual_artifacts(build_status);
CREATE INDEX IF NOT EXISTS idx_visual_artifacts_lesson_id ON visual_artifacts(lesson_id);

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
CREATE INDEX IF NOT EXISTS idx_lesson_chat_messages_lesson_learner ON lesson_chat_messages(lesson_id, learner_id, id);
CREATE INDEX IF NOT EXISTS idx_subject_workpads_subject_learner ON subject_workpads(subject_id, learner_id);
CREATE INDEX IF NOT EXISTS idx_subject_journal_subject_learner ON subject_journal_entries(subject_id, learner_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_results_learner_subject ON assessment_results(learner_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_lesson ON assessment_results(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assessment_result_tags_tag ON assessment_result_tags(tag_id);
