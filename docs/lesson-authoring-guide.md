# Lesson Authoring Guide (quality bar for generated lessons)

This is the standard any agent or skill must meet when generating AvocadoCore
lessons. It describes the required content, the safety boundaries, and the
pedagogical rules. The machine-checked version of these rules lives in
`src/lib/lesson-generator/contract.ts` (`validateGeneratedContent`) and
`src/lib/lesson-content/schema.ts`; a lesson that fails validation must be fixed,
not shipped. A lesson that *passes* validation but is thin, decorative, or
confusing still fails this guide.

## A good lesson is not audio-only

Every normal lesson must include all of these core sections (`is_core: true`):

| Section        | activity_type   | What "good" looks like |
| -------------- | --------------- | ---------------------- |
| Audio          | `audio`         | A comprehensive spoken walkthrough. Provide a real `script`, not a stub. |
| Written text   | `reading`       | First-class teaching text a learner can study without the audio. |
| Interactive    | `interactive`   | One or more visualizations/manipulatives (see "Multiple views"). |
| Practice code  | `practice_code` | A scaffolded exercise the learner submits (see "Code: scaffold, never solve"). |
| Assessment     | `assessment`    | Free-text / numeric questions that surface understanding. |

Optional sections (`media`, `flashcards`, `case_study`, `diagram`, `project`,
`debate`, `reference`) enrich a lesson but never replace the core.

## Written text (`reading`)

Written text is real lesson content, not a transcript dump. Use a `blocks`
array drawn from: `heading`, `paragraph`, `definition`, `example` (worked
examples), `callout` (`info` / `warning` / `insight`), and `list`. Include a
short `summary` for skimming and revision. Validation requires at least two
substantive text blocks. Write for a reader: define terms, show a worked
example, and end with a one-paragraph recap.

## Embedded media (`media`) — safe by construction

Media embeds carry an `embeds` array. Each embed:

- `provider: "youtube"` (the only supported provider today).
- a `video_id` (11 url-safe characters) **or** a `url` on a YouTube host. The
  app resolves and validates the id; the iframe is always built from the id via
  the privacy-enhanced `youtube-nocookie.com` domain. A raw URL is never
  injected into an iframe, and non-YouTube hosts / non-http(s) schemes are
  rejected.
- `title`, `reason` (why it helps), and `fallback_text` (shown if the video
  cannot load). All three are required.
- optional `start` (seconds).

If a video is unavailable or blocked, the lesson degrades to the fallback text
plus a "Watch on YouTube" link — it never breaks the page. Pick general,
durable educational videos. Never embed private or credentialed content.

## Multiple views of one concept

A strong lesson shows the same idea from several angles. There are two ways to
do this, and you can combine them:

1. **Several `interactive` activities** in one lesson. Each restores its own
   state independently.
2. **Several charts in one declarative widget** via `charts: WidgetChart[]`
   (in addition to or instead of the single `chart`). All charts are driven by
   the same controls, so they update together. Chart types: `bar`, `curve`,
   `table` (a frequency/contingency grid of live-computed cells), and `tree`
   (a population-split / flow diagram with live counts).

The seeded Bayes lesson is the reference: one slider set drives a bar chart, a
frequency table, and a population tree, and a second widget plots the posterior
against prevalence. Keep every chart responsive (no page-level horizontal
scroll at 390px) — the built-in charts already are.

Interactive widgets are declarative or registered specs only. **Never** emit raw
React/JS. Outputs are computed by the sandboxed expression evaluator (arithmetic,
comparisons, logic, ternary, whitelisted math functions). Formulas may only
reference control ids and earlier output ids; unknown identifiers fail
validation.

## Code: scaffold, never solve

`practice_code` is a real submission exercise. Provide:

- `prompt` — the task (required).
- `starter_code` — scaffolding only.
- `constraints` and `guided_steps` — rules and an ordered path that guide
  without giving the answer.
- `hints` — progressive: level 1 conceptual, level 2 structural, level 3
  syntax. Hints are revealed one at a time. **The final answer is never a hint
  and never appears inline.**
- `tests` — public tests the learner can see and Run.
- `hidden_tests` — run on Submit; their assertions are never shown, only a
  pass/fail count.

Validation **rejects** any `solution`, `answer`, `solution_code`,
`reference_solution`, or `completed_code` field. The learner must write and
submit code that passes the tests. Passing tests records a mastery signal but
**never** completes the lesson.

## Multiple-choice quiz (`assessment` content — optional)

An `assessment` activity can include an adaptive multiple-choice quiz by adding
a `quiz` key to its content JSON. When present, the quiz is shown above the
freeform questions and the "Mark Complete" button is gated until the learner
passes.

### Schema

```json
{
  "questions": [...],      // freeform questions (unchanged)
  "quiz": {
    "pass_threshold": 6,   // distinct concepts the learner must get correct (default: 6)
    "idk_option": true,    // optional; defaults true, must NOT be false (see below)
    "questions": [
      {
        "id": "q1",                         // unique within the quiz
        "concept": "bayes-prior",           // concept tag (assessment + retry dedup)
        "difficulty": "easy",               // REQUIRED: "easy" | "medium" | "hard"
        "question": "...",                  // question text
        "choices": ["A", "B", "C", "D"],   // 2–6 distinct non-empty strings
        "correct_index": 0,                 // 0-based index into choices
        "explanation": "...",              // shown after submit (required)
        "misconception_target": "...",      // optional: the error this question tests
        "rephrase_instructions": "..."      // optional: hint for ACP rephrasing
      }
    ]
  }
}
```

Validation (enforced by `validateMultipleChoiceQuizContent`):
- 2–6 distinct non-empty choices per question.
- `correct_index` must be in range.
- All question `id` values must be unique.
- `concept`, `explanation`, and `question` text are required.
- **`difficulty` is required** on every question (`easy` | `medium` | `hard`).
  Difficulty is persisted with every graded attempt and mastery signal so the
  learner's performance is queryable by tag **and** difficulty (e.g. "hard
  questions tagged `base-rate-fallacy`").
- `idk_option` may be omitted (defaults `true`) but must never be `false`.

### "I don't know" option (always rendered)

Every multiple-choice question shows a virtual **"I'm not sure / I don't know"**
option after the real choices. You do NOT author it — the app appends it at
render time (index `=== choices.length`), so it never appears in `choices` and
never collides with `correct_index`. Selecting it is graded **incorrect** (the
concept requeues like any miss) but recorded as a distinct high-signal
uncertainty: it reveals the correct answer + explanation with no-shame messaging
and writes a low-confidence `review_needed` mastery signal for that tag and
difficulty.

### Answer → tag assessment

Every graded MC answer is sent to the assessment pipeline (`/api/assess`). The
assessor matches the question's `concept` against the subject's existing tag
vocabulary, or **creates a normalized tag automatically** when the concept is
new (a `misconception` tag for wrong/IDK answers, a `concept` tag for correct
ones). The result is persisted as `assessment_results` + linked tags + a mastery
signal carrying difficulty. Freeform assessment answers and the end-of-lesson
diagnostics are assessed the same way at completion.

### Pass rule and retry behaviour

- The learner must answer `pass_threshold` **distinct concepts** correctly
  (default: 6). A concept is counted once even if multiple retries were needed.
- A wrong answer schedules a retry: the missed concept returns later in the
  queue in a rephrased form (via `AVOCADOCORE_ACP_ENDPOINT` if configured, or
  a deterministic choice-shuffle fallback). The retry is generated
  asynchronously and never blocks feedback display.
- "Mark Complete" is disabled until `passed === true`. The quiz does not
  auto-complete the lesson.

### Authoring tips

- Order questions easy → hard. The retry mechanism will bring missed concepts
  back, so the initial queue should build from foundations up.
- Write `misconception_target` to describe the exact wrong reasoning the
  question is designed to surface. This improves ACP rephrasing quality.
- Write `rephrase_instructions` to guide the rephrasing model (e.g. "use a
  non-medical context", "keep the formula explicit").
- Provide 8–12 questions when `pass_threshold` is 6 so the learner has some
  headroom and wrong-answer retries do not immediately loop.

## End-of-lesson next-lesson diagnostics

Every lesson can carry `lessons.next_lesson_diagnostics` — a JSON array of
freeform prompts shown at the very end of the lesson:

```json
[
  { "id": "diag-unclear", "prompt": "What still feels unclear?", "hint": "..." },
  { "id": "diag-next", "prompt": "What should the next lesson cover?" }
]
```

If you omit them, the seed/backfill applies a sensible default set
(`DEFAULT_NEXT_LESSON_DIAGNOSTICS`: what felt unclear, what to cover next,
confidence/effort, a practical objective). The answers autosave, are assessed
for tags + mastery signals, and are included in the `lesson.completed` event so
the next-lesson generator knows the learner's readiness and intent. **Answering
diagnostics never completes the lesson** — only "Mark Complete" does.

## Completion is manual, always

Reading, watching, exploring widgets, and drafting/running code all autosave as
progress. **None** of them complete a lesson — including passing the MC quiz.
Only the learner clicking "Mark Complete" does, which dispatches the next-lesson
hook. When a quiz is present, "Mark Complete" is disabled until the quiz is
passed, but passing the quiz alone does not fire the hook.

## Privacy boundary

Generated lessons, audio files, learner answers, and SQLite databases stay in
gitignored runtime storage. Seed/sample content committed to the repo must be
clearly synthetic. Never commit personal data, credentials, or private
deployment configuration.

## Quick checklist before shipping a generated lesson

- [ ] Audio script is comprehensive, not a placeholder.
- [ ] Reading has headings, a definition, a worked example, and a summary.
- [ ] At least two visual perspectives on the core concept.
- [ ] Media (if used) has reason + fallback and resolves to a valid video id.
- [ ] Code has a prompt, progressive hints, public + hidden tests, and no
      exposed answer.
- [ ] Assessment questions probe understanding, not recall of the audio.
- [ ] If a quiz is included: 8+ questions, unique ids, `pass_threshold` ≤ question count,
      a **required `difficulty`** on every question, `misconception_target` and
      `rephrase_instructions` on each question.
- [ ] End-of-lesson `next_lesson_diagnostics` present (or rely on the default set).
- [ ] `validateGeneratedContent` returns `{ valid: true }`.
- [ ] `validateMultipleChoiceQuizContent` returns `{ valid: true }` (if quiz included).
