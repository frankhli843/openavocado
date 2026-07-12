# Open Avocado Architecture

Open Avocado is a Next.js application for durable adaptive lessons. The core idea is simple: lessons, learner evidence, generated artifacts, and next-lesson jobs are stored as structured records instead of being left inside a chat transcript.

## Boundaries

Commit only portable source:

- application code
- schemas and migrations
- generic prompt contracts
- synthetic fixtures
- tests and public documentation

Do not commit private runtime state:

- learner profiles or learning history
- uploaded documents
- generated lessons from a real learner
- audio, video, screenshots, or other generated artifacts
- SQLite databases
- credentials, tokens, cookies, or deployment config

## Stack

- Next.js, React, and TypeScript for the web app
- SQLite for local-first learning state
- Vitest for unit and integration coverage
- Pluggable adapters for generation and completion workflows

The portable baseline runs locally with `pnpm install`, `pnpm db:migrate -- --seed`, and `pnpm dev`.

## Data Model

The application is multi-user and multi-profile. A user can own multiple learner profiles, and each subject is scoped to one learner profile.

Important tables:

- `users` and `learner_profiles`
- `subjects`
- `lessons`
- `lesson_activities`
- `attempts`
- `assessment_results`
- `assessment_result_tags`
- `mastery_signals`
- `progress_points`
- `generated_artifacts`
- `next_lesson_jobs`

The design goal is that the next lesson can be generated from structured evidence: goals, tags, quiz outcomes, code attempts, diagnostics, misconceptions, completed lessons, discarded lessons, and learner preferences.

## Lesson Runtime

A lesson is rendered as ordered activity blocks. Current block families include:

- video and media walkthroughs
- reading sections
- interactive visual artifacts
- code practice
- quizzes and written assessment
- next-lesson diagnostics

Autosave records interaction state, but completion is manual. Watching media, submitting code, or passing a quiz never completes the lesson by itself. The learner explicitly marks the lesson complete.

## Generated Artifacts

Generated media belongs in runtime storage, not git. The database stores metadata such as artifact type, path, duration, dimensions, captions, source hashes, and review state.

The learner-facing direction is video-first. Narration can be generated as a source track, but a finished teaching segment should include reviewed visuals, captions, poster frames, and browser playback verification.

## Generation Contract

`src/lib/lesson-generator/contract.ts` defines the structured contract for generated lesson content. A generator can be an API call, local command, agent runtime, or custom workflow as long as the output validates and the required artifacts exist.

The app should fail loudly when generated content is invalid. A polished page with thin or missing teaching content is worse than a clear failure.

## Completion Adapters

When a lesson is completed, the app emits a `lesson.completed` event. The selected adapter decides what to do with it.

Supported adapters:

- `local-queue`: default portable mode, writes a local generated fixture for development and demos.
- `webhook`: POSTs the event JSON to a configured endpoint.
- `agent-harness`: runs a configured local command with the event JSON on stdin.
- `dora-task`: optional compatibility adapter for deployments that explicitly configure that task system.
- `noop`: records completion without dispatching external work.

The default is `local-queue`, not a private task system. See `docs/agent-task-harness.md` for the contract to connect another queue, agent runtime, or task tracker.

## Subject Creation

Subject creation can also dispatch work through the same adapter family. A `subject.created` event gives an agent enough context to create the first lesson, or the local queue can create a portable first-lesson fixture for local testing.

## Assessment And Mastery

Multiple-choice answers, written diagnostics, and code submissions are recorded as learning evidence. The deterministic assessor maps concepts to tags and writes mastery signals. This keeps adaptive generation grounded in what the learner actually did.

Per-subject mastery is computed from recent progress points and mastery signals. The UI shows both the current score and evidence context so the learner can see why the system thinks something is a strength, weak spot, misconception, or ready-to-advance signal.

## Security Model

The app treats generator output as untrusted. Runtime routes should validate paths, content types, artifact metadata, and sandbox boundaries. Visual artifacts should be approved before being shown to learners.

Secrets live in `.env.local` or deployment environment variables. The repo includes `.env.example` only.

## Public Release Rule

Before publishing, run the public readiness check, tests, build, and a local smoke test. The public readiness check should fail on private hostnames, private IPs, real credentials, generated learner data, private task paths, or personal deployment details.
