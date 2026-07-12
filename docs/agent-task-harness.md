# Agent Task Harness

Open Avocado can run with any agent runtime or task queue. The app emits structured events. Your harness turns those events into work, then writes validated lessons and artifacts back to the app.

Use this guide if you already have a queue, workflow engine, agent platform, or task tracker and want Open Avocado to use it.

## Adapter Choices

- `local-queue`: default local mode. It creates portable fixture lessons for development and demos.
- `webhook`: POSTs event JSON to your service.
- `agent-harness`: runs a local command and passes event JSON on stdin.
- `dora-task`: optional compatibility adapter for deployments that explicitly configure that system.
- `noop`: records the app event only.

For most custom systems, use `agent-harness` for local development and `webhook` for production.

## Configure A Local Harness

```bash
AVOCADOCORE_COMPLETION_ADAPTER=agent-harness
AVOCADOCORE_AGENT_HARNESS_COMMAND="node ./scripts/my-open-avocado-harness.mjs"
```

The command receives one JSON object on stdin. It should return one JSON object on stdout.

Minimum success response:

```json
{
  "ok": true,
  "ref": "queue-123"
}
```

If your harness creates a lesson synchronously, include the lesson id:

```json
{
  "ok": true,
  "ref": "queue-123",
  "lesson_id": 42
}
```

Failure response:

```json
{
  "ok": false,
  "error": "Missing learner profile"
}
```

## Event Types

The event payload includes `event_type`.

Common values:

- `subject.created`: create the first lesson for a subject.
- `lesson.completed`: generate or enrich the next lesson from learner evidence.
- `lesson.discarded`: replace or repair a discarded lesson.

Treat the event JSON as the source of truth for the job. Store the raw event in your task system so the agent can reproduce the decision later.

## What Your Task Should Contain

When registering a task in your own system, include:

- event type and event id
- subject id and learner id
- lesson id when present
- subject goals and criteria
- learner profile context
- completed lesson summary
- assessment and diagnostic evidence
- code attempt evidence
- mastery signals and weak spots
- required authoring guide: `docs/lesson-authoring-guide.md`
- validation commands
- expected completion evidence

The agent should write notes or structured status updates as it works. Another agent should be able to resume from the task without reading chat history.

## Completion Contract

A finished job should prove:

- the lesson row exists
- lesson activities validate
- required media artifacts exist
- video or visual sections load in browser
- assessments include concepts and difficulty
- next-lesson diagnostics exist
- private data was not written into public content
- the app can open the lesson page

If your harness runs asynchronously, it should update Open Avocado when the lesson is ready. You can do this by calling your own API layer or by writing through a controlled local script that updates SQLite and validates the lesson.

## Example Harness

```js
#!/usr/bin/env node

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));

const ref = `open-avocado-${Date.now()}`;

// Replace this with your real queue registration.
console.error(`Registering ${input.event_type} as ${ref}`);

process.stdout.write(JSON.stringify({ ok: true, ref }) + "\n");
```

## Privacy Rules

Your harness must not commit generated lessons, learner files, runtime media, logs with secrets, or local deployment paths.

Before publishing a repo or artifact, run:

```bash
pnpm public:check
```

If that check fails, fix the source of the leak instead of adding a broad ignore that hides the problem.
