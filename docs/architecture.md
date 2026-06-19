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

## First Data Model Sketch

- `learners`: generic learner profile, local-only unless explicitly exported.
- `subjects`: subject title, description, goals, status.
- `diagnostics`: initial level checks and answers.
- `lessons`: generated lesson plans and status.
- `lesson_activities`: audio, visualization, reading, code, and assessment blocks.
- `attempts`: learner interaction history and answer/code attempts.
- `mastery_signals`: strengths, weak spots, misconceptions, and confidence.
- `next_lesson_tasks`: Dora task links and generation state.

## Completion Semantics

Lesson completion is manual only. Autosave records all progress continuously, but the system must not infer completion from audio progress, interactive usage, code execution, or assessment submission.

The learner explicitly clicks a completion button. That button marks the lesson complete and triggers the next-lesson generation task.

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
