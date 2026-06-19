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
