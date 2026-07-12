# Open Avocado Summary

Open Avocado is an experimental adaptive learning app built around durable generated lessons.

Instead of treating tutoring as a chat transcript, it stores subjects, lessons, activities, attempts, assessment results, mastery signals, generated artifacts, and next-lesson jobs in SQLite.

## What Works Today

- subject creation with goals, criteria, and learner context
- seeded demo lessons
- structured lesson pages
- reading sections
- video and media-ready lesson activity types
- interactive visual artifacts
- code practice with public and hidden tests
- multiple-choice and written assessment
- next-lesson diagnostics
- mastery signals and progress views
- configurable completion adapters
- local queue mode for portable development

## Why It Matters

The lesson record is inspectable. A reviewer can see what was taught, what the learner attempted, what concepts were tagged, what artifacts were generated, and why the next lesson should exist.

That makes Open Avocado useful as:

- a working adaptive-learning prototype
- a reference schema for agent-generated lessons
- a testbed for video-first AI lessons
- a harness target for agent runtimes and task queues

## Public Release Boundary

The public repo must not contain private learner data, deployment details, generated lesson artifacts, screenshots from private QA runs, SQLite databases, credentials, hostnames, or task-system identifiers.

Use `.env.example` for configuration examples. Use `docs/agent-task-harness.md` to connect your own queue or agent runtime.

## Verification

Before a public release, run:

```bash
pnpm public:check
pnpm test
pnpm build
```

Then smoke test a local instance with a temporary database and verify the app creates a subject through the default `local-queue` adapter.
