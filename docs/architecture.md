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

Open decision: lesson completion should likely be hybrid. The system tracks whether required evidence exists, then asks the learner to confirm completion before triggering the next lesson generation task.
