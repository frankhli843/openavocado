# AvocadoCore MVP — Summary

**Project:** AvocadoCore Adaptive Learning Platform
**Repo:** [frankhli843/avocadocore](https://github.com/frankhli843/avocadocore)
**Commit:** ea4aa3c (MVP) + interactive widget system (2026-06-20)
**Date:** 2026-06-20

---

## What Was Built

AvocadoCore is a reusable, multi-user adaptive learning platform. This document captures the full MVP implementation.

### Stack
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Database:** SQLite via better-sqlite3 (15-table multi-user schema)
- **Styling:** Tailwind CSS v3
- **Charts:** Recharts
- **Python sandbox:** Pyodide/WASM (browser-side)
- **Tests:** Vitest (41 passing)

---

## Database Schema (15 tables)

| Table | Purpose |
|-------|---------|
| users | Auth identities |
| learner_profiles | Per-user learning profile |
| subjects | Learning subjects per learner |
| diagnostics | Subject diagnostic Q&A |
| lessons | Lessons with status lifecycle |
| lesson_activities | Core + supplementary activities |
| attempts | Activity attempt history |
| mastery_signals | Strength/weak-spot/misconception signals |
| tags | Concept/curriculum tags |
| lesson_tags, subject_tags | Join tables |
| progress_points | Metric time-series (mastery, assessment_score) |
| generated_artifacts | Audio/image artifact metadata |
| next_lesson_jobs | Completion hook job queue |
| lesson_autosave | Per-activity draft state (debounced autosave) |

**Key design:** `lesson_autosave.activity_id` uses sentinel value `0` (not NULL) for lesson-level saves, enabling a UNIQUE constraint on `(lesson_id, learner_id, activity_id)`.

---

## Features

### Subject Dashboard
- Lists all subjects with lesson count, mastery %, assessment %, completion %
- Active vs. Other section grouping
- Each card links to the full-page subject workspace

### Subject Workspace
Four tabs:
1. **Lessons** — ordered list with status indicators (completed/in progress/queued)
2. **Mastery** — mastery signals grouped by type (strength, weak spot, misconception, review needed, ready to advance)
3. **Progress** — Recharts line chart for mastery/assessment_score over time
4. **Goals** — inline editable subject goals saved via PATCH /api/subjects/[id]

### Lesson Workspace
- Sticky top bar with save status ("Saved" / "Saving...") and "Mark Complete" button
- Activities rendered in order: Audio → Interactive → Python Practice → Assessment
- **AudioSection:** renders TTS script + metadata (provider, voice, duration) and persistent transcript
- **InteractiveSection:** dispatches to the widget system — renders live interactive controls or a clear error state if the spec is invalid
- **PythonSection:** Pyodide/WASM editor with test runner — shows test pass/fail per test case
- **AssessmentSection:** free-text and numeric question fields

### Interactive Widget System

Interactive activities are driven by a typed `WidgetSpec` JSON contract. Two kinds:

**Declarative widgets** (`widget_type: "declarative"`) are generated from a data spec: controls (sliders, toggles, segmented selectors), derived outputs computed via a sandboxed expression evaluator, optional bar or curve charts, and explanatory panels with template interpolation. No executable code is embedded.

**Registered widgets** are hand-written components dispatched by `widget_type` string. Currently: `supply-demand` (market equilibrium simulator with SVG supply/demand curves, live equilibrium computation, and tax incidence).

Widget state (control values) autosaves per-activity to `lesson_autosave.widget_state` and restores on load. Interaction never triggers lesson completion.

The expression evaluator (`src/lib/widgets/expression.ts`) is a no-eval recursive-descent parser with a whitelist of safe math functions and loud rejection of unknown calls, property access, and assignment syntax.

### Autosave
- Debounced 1200ms on every content change (code, assessment answers, test results)
- POSTs to `/api/autosave` which upserts `lesson_autosave` — never touches `lessons.status`
- Save status displayed in top bar

### Lesson Completion
- Only triggered by "Mark Complete" button → POST `/api/complete-lesson`
- Marks lesson `completed`, records a `progress_point`, dispatches the configured completion adapter
- Inserts a row in `next_lesson_jobs` for the configured adapter

---

## Completion Hook Adapters

Controlled by `AVOCADOCORE_COMPLETION_ADAPTER` environment variable:

| Adapter | Behavior |
|---------|---------|
| `noop` (default) | Logs the event, no side effects |
| `local-queue` | Writes to `next_lesson_jobs` DB table |
| `webhook` | POSTs JSON to `AVOCADOCORE_WEBHOOK_URL` |
| `dora-task` | POSTs to `AVOCADOCORE_DORA_ENDPOINT`, creates a Doramon next-lesson generation task |

---

## Lesson Generator Skill Contract

`src/lib/lesson-generator/contract.ts` defines a stable adapter interface:

```typescript
interface LessonGeneratorAdapter {
  name: string;
  generate(context: LessonGeneratorContext): Promise<GeneratorResult>;
}

type GeneratorResult =
  | { status: "ready"; content: GeneratedLessonContent }
  | { status: "pending"; ref: string; estimated_ready_at?: string }
  | { status: "error"; error: string };
```

Implementations (CLI, REST, Dora task) are deployment-specific and live outside this repo.

---

## Browser Python Sandbox

`src/lib/python-sandbox.ts` defines the `PythonExecutor` interface:
- `stubExecutor`: returned before Pyodide loads; shows "Loading Python..." state
- `createPyodideExecutor(pyodide)`: wraps Pyodide for code + test execution

Tests defined in activity content JSON run via `pyodide.runPython(test.assert)`.

**CDN loading:** Pyodide is loaded via `new Function("url", "return import(url)")` to bypass TypeScript's module resolution restriction on CDN URLs.

---

## Tests (41 passing)

- Multi-user isolation (users/subjects can't cross-read)
- Lesson lifecycle (queued → in_progress → completed)
- Status constraint enforcement
- Autosave upsert (multiple saves don't create duplicate rows)
- Autosave never marks completion (lesson.status is unchanged after autosave)
- Manual completion semantics
- Noop adapter (returns ok: true, no side effects)
- Webhook adapter (fails gracefully when no URL configured)
- Python sandbox stub (returns "not yet loaded" error when Pyodide hasn't initialized)
- Debounce cancel (cancelled debounce does not call the callback)
- Safe expression evaluator: arithmetic, comparisons, logical, ternary, whitelisted math functions
- Expression evaluator rejects: `process.exit`, assignment operators, member access, template literals, unknown identifiers
- Widget schema validation: missing version, missing type, missing instructions, bad control references, unsafe formulas, unsupported registered types
- Widget compute: ordered dependency evaluation, template interpolation, curve sampling, formatValue formatting
- DeclarativeWidget live recompute on slider change + initialState restore (jsdom tests)

---

## Local Development

```bash
mkdir -p data
NODE_OPTIONS="--localstorage-file=/tmp/avocado-ls.json" pnpm dev --port 3456
```

**Note:** Node.js 25 exposes a built-in `localStorage` global that conflicts with Next.js SSR. The `--localstorage-file` flag provides a backing store so `localStorage.getItem()` works in the server-side render context.

---

## Key Files

| Path | Description |
|------|-------------|
| `src/db/schema.sql` | Full 15-table schema with CREATE TABLE IF NOT EXISTS |
| `src/db/connection.ts` | SQLite singleton, auto-applies schema, uses `process.cwd()` for schema path |
| `src/db/seed.ts` | Synthetic seed data: user alex_learner, 2 subjects, lessons, activities, autosave state |
| `src/types/index.ts` | All domain types + skill contract types |
| `src/lib/python-sandbox.ts` | PythonExecutor interface + Pyodide adapter + stub |
| `src/lib/lesson-generator/contract.ts` | LessonGeneratorAdapter interface + buildGeneratorContext + validateGeneratedContent |
| `src/lib/adapters/` | noop, local-queue, webhook, dora-task adapters |
| `src/lib/widgets/schema.ts` | WidgetSpec types + validateWidgetSpec + formatValue |
| `src/lib/widgets/expression.ts` | No-eval recursive-descent safe expression evaluator |
| `src/lib/widgets/compute.ts` | Ordered output evaluation, template interpolation, curve sampling |
| `src/lib/widgets/registry.ts` | Registered widget type list |
| `src/components/lesson/widgets/WidgetHost.tsx` | Dispatcher: declarative vs registered vs error state |
| `src/components/lesson/widgets/DeclarativeWidget.tsx` | Generic data-driven widget renderer |
| `src/components/lesson/widgets/SupplyDemandWidget.tsx` | Market equilibrium registered widget |
| `src/components/lesson/widgets/Controls.tsx` | Slider, Toggle, Segmented control primitives |
| `src/components/lesson/widgets/Charts.tsx` | SVG BarChart and CurveChart |
| `src/test/schema.test.ts` | 14 Vitest schema tests |
| `src/test/widgets.test.ts` | 24 Vitest widget evaluator/schema/compute tests |
| `src/test/widget-renderer.test.tsx` | 3 jsdom widget render/interaction tests |

---

## Screenshots

All screenshots use synthetic seed data only (learner "Alex"); no personal or generated private data is committed.

### Subject Dashboard

The first screen is the application experience: a learner dashboard listing subjects with lesson counts, mastery %, assessment %, and completion progress.

![Subject dashboard](screenshots/dashboard.png)

### Subject Workspace

Full-page subject view with Lessons / Mastery / Progress / Goals tabs. Lessons show status, goals, and concept tags.

![Subject workspace](screenshots/subject-workspace.png)

### Lesson Workspace

A normal lesson with all four required core sections — Audio (teaching session + transcript), Interactive concept work, Python practice (browser code runner with per-test pass/fail), and Assessment. The sticky top bar shows autosave status and the manual "Mark Complete" button, with a banner clarifying that progress saves automatically and completion is manual only.

![Lesson workspace](screenshots/lesson-workspace.png)

---

## Verification (QA pass — 2026-06-20)

| Check | Result |
|-------|--------|
| `pnpm test` (Vitest) | 41/41 passing |
| `pnpm exec tsc --noEmit` | Clean |
| `pnpm lint` | No warnings or errors |
| `git ls-files` privacy scan | No DB / audio / `.env` / secrets / Discord IDs tracked; runtime `data/*.db` gitignored |
| Autosave vs completion (live API) | `POST /api/autosave` left lessons unchanged; only `POST /api/complete-lesson` triggers completion |
| Widget autosave (live DB) | `lesson_autosave.widget_state` correctly saved slider values for both widget types after interaction |
| Widget no-complete invariant | Lesson 3 remained `queued`/`in_progress` after all widget interactions; lesson 1 `completed` unchanged |
| Bayes widget live | Sliders rendered, outputs updated (prior slider moved 10.1%→9.8%, posterior 51.6%→50.8%), chart redrawn |
| Supply-demand widget live | Sliders rendered, $15 tax shifted equilibrium $28.57→$37.14, quantity 57.1→44.3, tax revenue $664 shown |
| Autosave restore | Supply-demand page reload restored saved tax=15 from `widget_state` |
| React error check | No `setState during render` warnings after fix to `update()` in both widget components |
| UI render | Dashboard, subject workspace, and lesson workspace all render with seed data |
| Multi-user schema | `users` → `learner_profiles` → `subjects` identity separation; no single-user hardcoding |

### Run locally

```bash
cd code/avocadocore
pnpm install
mkdir -p data
NODE_OPTIONS="--localstorage-file=/tmp/avocado-ls.json" pnpm db:migrate --seed
NODE_OPTIONS="--localstorage-file=/tmp/avocado-ls.json" pnpm dev --port 3456
# open http://localhost:3456
```

> Node.js 25 exposes a built-in `localStorage` global that conflicts with Next.js SSR; the `--localstorage-file` flag supplies a backing store. On Node 20–22 the flag is unnecessary.
