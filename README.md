# Open Avocado

**Open-source adaptive learning with generated video lessons.**

Want to see what it is before cloning anything? Start here:

**Website and docs: <https://frankhli843.github.io/openavocado/>**

Open Avocado is an experimental adaptive learning app. Instead of treating an AI tutor as a chat window, it treats lessons as durable objects: a generated lesson has structured teaching content, video walkthroughs, interactive visuals, code practice, assessments, mastery signals, and enough metadata to generate the next lesson from evidence.

The current goal is simple: help a learner move from familiarity to competence to mastery, while keeping every generated lesson inspectable, reproducible, and editable.

## Why This Exists

Most AI learning tools collapse everything into a conversation. That is useful for quick help, but it is weak as a long-term learning system:

- important explanations disappear into chat history
- the next lesson is not grounded in structured evidence
- media, code exercises, and assessments are usually bolted on later
- generated content is hard to review, migrate, or improve
- the learner cannot easily see why the system thinks they are ready to advance

Open Avocado is built around the opposite shape. Lessons are stored in SQLite. Learner answers, code submissions, quiz results, and completion events become evidence. The generator uses that evidence to decide what lesson should exist next.

## What It Does

- Create subjects with goals, criteria, and learner context.
- Generate lessons with video, reading, interactive sections, code practice, and assessment.
- Store generated lesson content and artifacts durably, not as disposable chat output.
- Track mastery signals, misconceptions, confidence, and progress over time.
- Emit a `lesson.completed` event so another agent or workflow can create the next lesson.
- Keep runtime data, uploaded materials, generated media, credentials, and private learner state out of git.

## Video-First Lessons

The lesson pipeline is video-first. Narration audio can be generated as an internal source track, but the learner-facing artifact is a video with visuals, captions, poster frames, review evidence, and range-seekable serving.

For technical lessons, the intended style is closer to a small 3Blue1Brown-like explanation than a narrated slide deck. A good generated lesson should show the actual objects changing: matrices, queues, prompt templates, state machines, API calls, eval results, or whatever the topic needs.

Audio-only lessons are legacy. A completed lesson should not pass readiness unless its learner-facing teaching segments have reviewed video coverage.

## Architecture Walkthrough

Open Avocado has four main layers.

### 1. Learning Data

SQLite is the local source of truth. The core records are:

- `users` and `learner_profiles`
- `subjects`
- `lessons`
- `lesson_activities`
- `attempts`
- `assessment_results`
- `mastery_signals`
- `progress_points`
- `generated_artifacts`
- `next_lesson_jobs`

The important design choice is that learning evidence is queryable. A future lesson generator should not need to scrape a chat transcript to know what happened.

### 2. Lesson Runtime

The Next.js app renders each lesson as structured activity blocks:

- video walkthroughs
- reading and explanations
- interactive or bespoke visual artifacts
- sandboxed code practice
- quizzes and written assessment

Autosave records interaction state continuously. Completion is manual, because finishing a lesson is a learner decision, not something inferred from watching a video or submitting code.

### 3. Generation Boundary

The repo defines the contract for what a generated lesson must look like. A generator can be an API call, a local command, an agent runtime, or a custom adapter. The app should not care which agent wrote the lesson as long as the output validates and the artifacts exist.

Completion adapters include:

- `noop`, record completion only
- `webhook`, post a completion event elsewhere
- `local-queue`, generate a portable local fixture
- `agent-harness`, run a configured local command with the event JSON
- `dora-task`, optional compatibility for deployments that explicitly configure that task system

That makes the app a reference implementation for adaptive lesson state, not a single hardcoded AI backend.

### 4. Artifact Pipeline

Generated media belongs in runtime storage, not git. The database stores metadata such as type, path, duration, dimensions, hashes, captions, and review state. The runtime route serves artifacts with the right content type and HTTP Range support so long videos can seek.

The video direction is still evolving, but the intended contract is:

1. generate or reuse narration as source material
2. storyboard the lesson segment
3. render a real visual explanation
4. attach captions and poster frames
5. register the artifact in SQLite
6. verify playback in browser
7. only then count the lesson as ready

## Developer Quick Start

Requirements:

- Node 20 or 22
- pnpm
- SQLite runtime files in `data/`

```bash
pnpm install
mkdir -p data
pnpm db:migrate -- --seed
pnpm dev
```

Then open:

<http://localhost:3000>

Run tests:

```bash
pnpm test
```

Build:

```bash
pnpm build
pnpm start
```

## Runtime Configuration

Open Avocado can run without committing secrets. Put local configuration in `.env.local` or your deployment environment.

Common variables:

```bash
AVOCADOCORE_DEFAULT_PROVIDER=google-ai-studio
GOOGLE_AI_STUDIO_API_KEY=...
GOOGLE_AI_STUDIO_MODEL=gemini-2.5-flash

AVOCADOCORE_COMPLETION_ADAPTER=local-queue
AVOCADOCORE_AGENT_HARNESS_COMMAND=
AVOCADOCORE_RUNTIME_ROOT=runtime_artifacts
```

See the docs for more provider and adapter options:

- <https://frankhli843.github.io/openavocado/configuration.html>
- <https://frankhli843.github.io/openavocado/quickstart.html>

## Running With Your Own Agent

Open Avocado is meant to be brought to different agent runtimes. The public docs include setup prompts for several paths:

- Direct API key: <https://frankhli843.github.io/openavocado/run-api-key.html>
- OpenClaw: <https://frankhli843.github.io/openavocado/run-openclaw.html>
- Hermes: <https://frankhli843.github.io/openavocado/run-hermes.html>

The key idea is that agents should generate validated lesson objects and durable artifacts, not just chat text.

If your agent already has a task system, do not copy a private adapter. Use
`agent-harness` or `webhook`, then map the `subject.created`,
`lesson.completed`, and `lesson.discarded` event JSON into your own task id,
job id, or queue id. See [`docs/agent-task-harness.md`](docs/agent-task-harness.md).

## Repository Map

```text
src/app/                         Next.js routes and lesson UI
src/components/lesson/           lesson activity renderers
src/db/                          schema, seed, migrations, SQLite helpers
src/lib/lesson-content/          typed content schemas and validators
src/lib/lesson-generator/        generation contract and next-lesson logic
src/lib/adapters/                completion adapters
src/lib/audio/                   narration generation boundary
scripts/                         migrations, audits, backfills, artifact tooling
docs/                            architecture and authoring guides
```

## Design Principles

- Store learning state in a real database.
- Make generated lessons inspectable.
- Treat tests and assessments as first-class learning evidence.
- Separate public app code from private runtime data.
- Prefer adapters over hardcoded agent assumptions.
- Fail loudly when lesson content is invalid.
- Do not let audio-only output masquerade as a finished lesson.

## Privacy Boundary

This repo should contain application code, schemas, migrations, generic prompts, tests, documentation, and clearly synthetic fixtures.

Do not commit:

- real learner profiles or history
- uploaded source documents
- generated lessons from a private learner
- generated audio or video artifacts
- SQLite databases
- API keys, cookies, tokens, or deployment secrets
- local deployment configuration

## Project Status

This is early and opinionated. It is useful as a working reference for adaptive lesson state, generation contracts, and artifact-backed lessons. The public API, schema, and adapter interfaces may change.

If you try it, the most useful feedback is on:

- whether the lesson schema is the right abstraction
- whether generated lessons should be an app, a protocol, or both
- how strict the video-readiness gate should be
- what belongs in the durable learning record
- how agents should revise or enrich existing lessons

## License

See [`LICENSE`](LICENSE).
