# Architecture Notes

This repo is intentionally starting as a privacy-safe design shell.

## Core Boundary

Commit:

- Application and skill code.
- SQLite schemas and migrations.
- Generic prompt templates.
- Synthetic fixtures.
- Tests and documentation.

Do not commit:

- Learner profiles or history.
- Generated lessons, audio, uploads, or assessment responses.
- SQLite database files.
- Local deployment configuration.
- Credentials or API keys.

## Application Stack

AvocadoCore should use Next.js, React, and TypeScript.

## Multi-User Model

AvocadoCore is multi-user from day one. The data model should separate account/user identity from learner profile and learning progress.

Core records should be scoped so multiple users can have their own subjects, goals, lessons, attempts, mastery signals, tags, generated artifacts, and progress history. Even if a deployment starts with one learner, the schema should not assume a single global learner.

A user account can hold several **learner profiles**. Each profile has a display name, bio, preferred language, and a free-form privacy-safe `config` JSON (learner notes/preferences/context that guide lesson generation). `users.active_learner_id` records which profile is active; the app falls back to the account's first profile when unset. Profiles are managed from the UI (`ProfileSwitcher`) via `/api/profiles` (list/create), `/api/profiles/[id]` (rename/edit config), and `/api/profiles/active` (switch). Every subject, mastery, autosave, assessment, and completion query is scoped by `learner_id`, so one profile's history never leaks into another.

## First Data Model Sketch

- `users`: account or local user identity.
- `learner_profiles`: learner preferences and profile data.
- `subjects`: subject title, description, goals, status.
- `diagnostics`: initial level checks and answers.
- `lessons`: generated lesson plans and status.
- `lesson_activities`: audio, visualization, reading, code, and assessment blocks.
- `attempts`: learner interaction history and answer/code attempts.
- `mastery_signals`: strengths, weak spots, misconceptions, and confidence.
- `tags`: concepts, curriculum areas, lesson types, misconceptions, and review topics.
- `progress_points`: time-series data for mastery, confidence, assessment results, code/test results, and review cadence.
- `generated_artifacts`: durable generated assets, including audio metadata.
- `next_lesson_jobs`: next-lesson generation links, adapter metadata, and generation state.
- `assessment_results`: per-question evidence (question type, `concept`, `difficulty`, `outcome`) for every graded MC attempt and freeform/diagnostic answer.
- `assessment_result_tags`: tags attached to each assessment result by the assessor.

## Adaptive Assessment Pipeline

Answer assessment is a first-class part of the learning loop, not a static display. When a learner answers (an MC attempt graded live, or freeform/diagnostic answers at completion), the answer goes through an `AssessmentAdapter` (`src/lib/assessment.ts`). The default is a **deterministic, no-LLM assessor** behind a clean boundary so a future ACP/LLM adapter can replace it without touching callers. The assessor:

- matches the question's `concept` against the subject's existing tag vocabulary (`subject_tags`), or **creates a normalized tag automatically** when the concept is new (a `misconception` tag for wrong/IDK answers, a `concept` tag for correct ones);
- emits a single mastery signal (type + concept + confidence + `difficulty`).

`src/lib/assessment-store.ts` persists the decision in one transaction: an `assessment_results` row, the matched/created tags linked to both the subject and the result, and a `mastery_signals` row carrying `difficulty` and the resolved `tag_id`. The `/api/assess` route surfaces persistence/tagging failures as errors rather than swallowing them. Because `difficulty` is stored on every attempt and signal, performance is queryable by tag **and** difficulty (e.g. "how did this learner do on hard `base-rate-fallacy` questions"), which feeds both the subject-page evidence panel and next-lesson generation.

Every multiple-choice question carries a **required** `difficulty` and renders a virtual **"I don't know"** option (index `=== choices.length`, never the correct answer, no schema change). IDK grades incorrect (the concept requeues) but is recorded as a distinct low-confidence `review_needed` signal. Each lesson also ends with freeform **next-lesson diagnostics** (`lessons.next_lesson_diagnostics`) whose answers autosave, are assessed for tags/signals, and enrich the `lesson.completed` payload — none of which complete the lesson.

## Completion Semantics

Lesson completion is manual only. Autosave records all progress continuously, but the system must not infer completion from audio progress, interactive usage, code execution, or assessment submission.

The learner explicitly clicks a completion button. That button marks the lesson complete and triggers the next-lesson generation task.

## Lesson Structure

Lessons should be adaptable, but every normal lesson keeps the same core sections:

- `audio`: primary teaching session and comprehensive explanation.
- `interactive`: visualization, dashboard, simulation, or other concept manipulation.
- `practice_code`: Python practice exercise for every subject, using code to model concepts, rules, systems, decisions, simulations, or tests.
- `assessment`: freeform questions or tasks used to evaluate understanding.

The lesson generator may add optional sections, such as reading, flashcards, worked examples, case studies, projects, debates, diagrams, or references. Optional sections should extend the core lesson, not replace it. Code practice should appear even for non-technical subjects by turning the subject into an executable model or metaphor.

## Interactive Widget System

Interactive activities use a typed `WidgetSpec` contract stored as JSON in `lesson_activities.content`. Two widget kinds are supported:

**Declarative widgets** (`widget_type: "declarative"`) are fully data-driven. The lesson generator emits controls (sliders, toggles, segmented selectors), derived outputs (computed via a sandboxed expression evaluator), explanatory panels with template interpolation, and one or more charts. A widget may carry a single `chart` and/or a `charts: []` array so the **same controls can drive several visual perspectives at once**. Chart types: `bar`, `curve`, `table` (a frequency/contingency grid of live-computed cells), and `tree` (a population-split / flow diagram with live counts). No executable code is embedded — the spec is a declarative description only. Key files: `src/lib/widgets/schema.ts`, `compute.ts`, `expression.ts`, `src/components/lesson/widgets/Charts.tsx`.

**Registered widgets** are hand-written React components with known, safe behaviour. The lesson generator emits a typed `widget_type` string and a `params` object; the component registry dispatches to the correct renderer. Key file: `src/lib/widgets/registry.ts`. Current registered types: `supply-demand` (market equilibrium simulator with SVG curve chart).

Widget state (control values) is autosaved per activity to `lesson_autosave.widget_state` on a 1-second debounce and restored on page load. Autosave never triggers lesson completion — that path is manual-only.

The expression evaluator (`src/lib/widgets/expression.ts`) is a no-eval recursive-descent parser supporting arithmetic, comparisons, logical operators, ternary expressions, and a whitelist of safe math functions. It rejects unknown identifiers, property access, function calls outside the whitelist, and any assignment syntax. Validation errors fail loudly rather than silently.

Widget rendering is gated by `validateWidgetSpec` which checks schema version, required fields, control references in formulas (including `table` cell and `tree` node formulas), and known types. Invalid or unrecognised specs display a clear amber error state rather than a blank section.

Multiple visualizations per lesson are supported two ways, which compose: (1) several `interactive` activities in one lesson — each restores its own widget state independently, keyed by activity id in `lesson_autosave`; (2) several charts in one declarative widget via `charts: []`. The seeded Bayes lesson demonstrates both.

## Written Text, Media, and Scaffolded Code

Non-interactive lesson content has its own typed schemas and validators in `src/lib/lesson-content/schema.ts`. A lesson is not audio-only; written text is a required core section.

**Written text (`reading`)** is first-class teaching content rendered by `ReadingSection`. Its `content` is `{ intro?, blocks[], summary? }` where each block is a `heading`, `paragraph`, `definition`, `example` (worked example), `callout` (`info`/`warning`/`insight`), or `list`. `validateReadingContent` requires at least two substantive text blocks, so an empty shell or a bare transcript dump fails validation.

**Media (`media`)** is rendered by `MediaSection`. Its `content` is `{ embeds[] }` where each embed has `provider: "youtube"`, a `video_id` or `url`, plus `title`, `reason`, `fallback_text`, and optional `start`. Security boundary: the iframe is **always** built from a validated 11-character video id via the privacy-enhanced `youtube-nocookie.com` domain (`buildYouTubeEmbedUrl`). A raw, generator-supplied URL is never injected into an iframe; `extractYouTubeId` whitelists YouTube hosts and rejects other domains and non-http(s) schemes. If a video cannot resolve or fails to load, the section degrades to the fallback text plus a "Watch on YouTube" link — it never breaks the page.

**Scaffolded code (`practice_code`)** is a real submission exercise rendered by `PythonSection`. Its `content` carries `prompt`, `starter_code`, `constraints[]`, `guided_steps[]`, progressive `hints[]` (level 1 conceptual, 2 structural, 3 syntax — revealed one at a time), public `tests[]`, and `hidden_tests[]` (run on submit; assertions never shown, only a pass/fail count). Pedagogical boundary: `validatePracticeCodeContent` **rejects** any exposed-answer field (`solution`, `answer`, `solution_code`, `reference_solution`, `completed_code`). The learner must write and submit code; the completed answer is never shown inline. Run checks public tests; Submit runs public + hidden tests, and a passing submission posts to `/api/code-submission`, which records an immutable attempt and a `ready_to_advance` mastery signal — but never completes the lesson.

The generator contract (`validateGeneratedContent` in `src/lib/lesson-generator/contract.ts`) ties these together: it requires the core sections including `reading`, and validates every reading, media, and practice_code activity. A bad generated lesson fails loudly with specific errors rather than producing a polished-looking but pedagogically useless page. See `docs/lesson-authoring-guide.md` for the full quality bar.

## Python Sandbox

Python execution should be browser-based by default, using Pyodide/WebAssembly or an equivalent browser sandbox. Server-side execution can be added later as an optional adapter for heavier libraries or long-running workloads, but the portable baseline should not require it.

The code editor is part of lesson progress and must autosave:

- source code drafts
- run output
- test results
- runtime errors
- edit timestamps
- run timestamps

Autosaved code state does not imply lesson completion. Manual completion is still the only completion trigger.

## Audio Storage

Generated audio is a permanent runtime artifact, not a disposable cache. The transcript or source script should remain available, but the generated audio file should also be stored durably.

Audio files must not be committed to git. Store them in runtime storage and keep database metadata such as provider, voice, duration, content hash, file path or object key, generated timestamp, and source lesson/script version.

## Mastery, Tags, and Progress Graphs

Subjects should expose mastery tracking, tagging, and graphs over time.

The app should track tags for concepts, misconceptions, review topics, curriculum areas, and lesson types. Progress graphs should show mastery movement, assessment performance, code/test outcomes, confidence, review frequency, and weak spots over time.

These signals should be visible in the subject dashboard and available to the lesson generator.

**Per-subject mastery score.** `src/lib/mastery.ts` `computeSubjectMastery(db, subjectId, learnerId)` produces a single 0–100 score plus the context to interpret it: its `source` (latest `mastery` progress point, else averaged `mastery_signals` confidence, else none), `trend`/`delta` from the last two readings, a `history` sparkline, qualitative `signal_counts`, and a plain-language `explanation`. It is multi-user safe (scoped by both subject and learner). The score surfaces as a compact badge on subject cards (`MasteryScore`) and as a detailed panel in the subject Mastery tab (`MasterySummary`). Both subject API routes attach the summary.

## Subject Archive

Subjects support reversible archive/restore. Archiving sets `subjects.status = 'archived'` and stamps `archived_at`; restoring sets status back to `active` and clears `archived_at` (handled in `PATCH /api/subjects/:id`). Archiving never deletes lessons, activities, attempts, autosave, mastery signals, progress points, or generated artifacts — only the flag changes. The dashboard hides archived subjects from the active grid and lists them under a collapsible Archived section with a Restore action; the subject detail header also offers archive/restore with clear feedback. The `archived_at` column is added by a guarded additive migration in `src/db/connection.ts`.

## Lesson Generator Skill

Lesson generation should be a reusable skill that any agent can leverage to build lesson content for a particular page or lesson slot in the AvocadoCore framework.

The app should provide a structured page/lesson contract. The skill should return structured lesson content, including audio script, interactive spec, Python/code exercise, tests, assessment, tags, mastery targets, and metadata.

## Completion Hooks

Next-lesson generation should be driven through a configurable completion hook, not hardcoded to one automation system.

The core app emits a `lesson.completed` event after manual completion. A deployment chooses an adapter for that event:

- `webhook`: POST the event to a configured endpoint.
- `local-queue`: enqueue the event in local storage.
- `task-runner`: call a locally configured task system.
- `noop`: record completion without external automation.

Adapters are responsible for transforming the event into their own task format. The shareable repo should contain only generic adapter interfaces and safe examples. Deployment-specific channels, user IDs, credentials, generated lesson data, and private learner configuration belong in gitignored local config.

Recommended event fields:

- learner reference
- subject and lesson references
- lesson goals
- completed activities
- assessment questions and learner answers
- rubric or expected-answer summaries
- evaluation notes
- code exercise attempts and test results
- concepts to review
- misunderstandings to repair
- next curriculum targets

The current `lesson.completed` payload is enriched so next-lesson generation can be **adaptive to evidence** rather than a generic course step. Beyond the basics it carries: subject goals + learner criteria, the subject AI workpad summary, the quiz result, **tag + difficulty performance**, the freeform next-lesson diagnostics, recent misconceptions, completed + discarded lesson history, the learner-profile `config`, and a cross-subject mastery snapshot. The `dora-task` adapter prompt is structured to use this in priority order: subject-specific evidence first; profile config and cross-subject history only when they help. Its stated pedagogical goal is to **find foundational weaknesses and bridge them with the least learner effort**, advancing the curriculum only where the foundation is solid.
