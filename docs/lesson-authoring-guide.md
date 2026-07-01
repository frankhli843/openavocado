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

## Enrichment requirements (every generated lesson, by default)

A lesson must be enriched, not thin. These are the durable, non-negotiable rules
every lesson-generation agent/skill must satisfy. The machine-checked subset is
enforced by `validateGeneratedContent`; the rest is a hard authoring rule.

- **Read the main lesson-authoring skill first.** Any Dora task that generates a
  first lesson for a new subject, a next lesson after `lesson.completed`, a
  replacement after `lesson.discarded`, or a manual backfill must start by
  reading `skills/avocadocore-lesson-authoring/SKILL.md`. That skill is the
  deployment-level contract for how to use SQLite evidence, mastery signals, and
  bespoke authoring judgment.
- **Generated audio is available at creation.** The `audio` activity must carry a
  substantive `script` (enforced: at least ~20 chars, never a stub/placeholder),
  and the deployment's generator should produce the actual audio artifact at
  lesson-creation time and record it in `generated_artifacts` — not leave a
  "audio coming soon" message. A lesson without real audio is not done. The
  implementation is `src/lib/audio/` (TTS adapter: OpenAI → offline `espeak-ng`
  fallback) plus the `/runtime/[...path]` route, which **self-heals** a missing
  file by synthesizing it from the recorded script on first request. Produce/repair
  audio with `pnpm audio:generate` (fresh DB) or `pnpm backfill:lessons` (existing
  DB). Verify a lesson's audio actually plays: `GET /runtime/<file_path>` must
  return **HTTP 200** with an `audio/*` content type — a metadata row pointing at a
  404 does **not** count as generated audio.
- **Start with the why, not the mechanics.** Before formulas or code, explain
  the higher-level purpose of the lesson and the mismatch, failure mode, or
  decision the learner is trying to understand. For preprocessing-style lessons,
  each step must answer: "what breaks or becomes invalid if we skip this?" A
  lesson that only lists operations is not ready.
- **No undocumented assumptions.** Do not assume a domain fact, prerequisite,
  learner weakness, or next-step need unless it is documented in AvocadoCore
  context, visible in the local SQLite learner evidence, or verified and then
  recorded in task notes / lesson metadata.
- **Planning stage before authoring.** Before writing lesson content, do a
  deliberate planning pass over the whole lesson. For active technical domains
  such as model building, inference, quantization, GGUF conversion, Hugging Face
  releases, and Gemma contribution practice, perform comprehensive current
  research from reliable sources first. Record source-backed findings, what has
  changed since the previous plan, and any uncertainty. Update the subject
  workpad and long-term plan before generating the lesson itself.
- **Follow the subject phase.** Familiarity lessons focus on high-level
  concepts, vocabulary, and how the pieces relate. Competence lessons move into
  the important details, mechanisms, edge cases, and practice. Mastery lessons
  emphasize transfer, integration, and harder evidence. Post-mastery lessons
  are paper-driven: find a recent, relevant, well-cited or frontier paper, cite
  it clearly, explain why it matters for the subject, and teach what it adds
  beyond the learner's mastered foundation.
- **Bespoke authoring, not template filling.** The agent must choose the
  metaphor, examples, visuals, practice, quiz, and video dynamically for the
  topic and learner evidence. Templates may describe the acceptance criteria,
  but the lesson content itself must not be a generic fill-in pattern.
- **Purpose-built React visuals, not visual templates.** Every visualization
  must be designed for the exact concept block it supports. Treat a dense block
  like a small custom learning app: identify the real data, artifact, process,
  or failure mode in the prose, then show the learner the actual rows, columns,
  axes, stages, states, transitions, or before/after values. If code is needed,
  prefer bespoke React for that interactive part, then pass it through a
  reviewed build boundary and reference it from the lesson by stable component
  id / widget type plus safe params. The current app path is a reviewed source
  component wired through the widget registry; a future DB-backed visual system
  may store source and compiled artifacts in SQLite, but only after build/test
  approval and sandboxed rendering. Never execute raw React/JS directly from
  lesson JSON. If a diagram is enough, author a bespoke Mermaid or static
  diagram tied to the paragraph. Generic bars, relabelable boxes, and template
  diagrams fail QA unless the lesson is genuinely about quantities, trends, or
  distributions.
- **Ground the object before teaching the operation.** Dense technical terms
  must get a tiny concrete representation before the lesson performs operations
  on them. If the lesson uses words such as embedding, matrix, tensor, vector,
  logits, index, prior, likelihood, cache, gradient, loss, or queue, first show
  what the object is, where it comes from, and how it relates to the previous
  step. Example: before "embedding lookup", show the embedding matrix as
  vocabulary-ID rows by hidden-dimension columns, explain that it is learned
  model weights, and show that tokenizer IDs are row addresses. Do not make the
  learner learn the object and the operation in the same breath.
- **Do not assume the learner knows the main nouns.** A major concept can be
  used without redefinition only when learner evidence shows it is already
  known: prior assessment answers, mastery signals, explicit profile criteria,
  or completed lesson content that actually taught the term. A prior lesson
  title or curriculum plan is not enough. If evidence is missing or weak, define
  the object before using it. Example: before saying "a transformer block
  refines hidden states", explain that a transformer block is one repeated layer
  that receives one vector row per token, lets token rows read from other token
  rows through attention, updates each row through an MLP, wraps those updates
  with normalization and residual addition, and returns the same shape with more
  context-aware values. Likewise, do not say "the MLP transforms each token"
  until the lesson has defined MLP as the per-token feed-forward subnetwork
  inside the block, shown its input hidden vector, explained its learned linear
  layers plus activation in learner language, and shown its output update
  fitting back into the token row.
- **Mechanism paragraphs need mechanism-level detail.** Do not ship compressed
  paragraphs that name several operations without unpacking them. For example,
  "transformer blocks refine hidden states; attention mixes context; the MLP
  transforms each token; residuals keep older signal; the output head produces
  logits" is only an outline. A finished lesson must expand that into a
  concrete micro-trace: the incoming hidden-state matrix, which token positions
  attend to which other positions, what the attention update adds, what the MLP
  changes per token, where normalization and residual addition sit, and how the
  final hidden vector is projected into one raw score per vocabulary token. Use
  tiny numbers and stable labels, for example 4 token positions, 3 hidden
  dimensions, and a 5-token vocabulary, so the learner sees actual rows/cells
  changing instead of abstract verbs.
- **Put visuals beside the exact text they explain.** A distant overview widget
  does not count as support for several dense paragraphs. When a paragraph
  teaches a mechanism, attach a Mermaid/static diagram in `reading.diagrams[]`
  or include a lesson-part interactive immediately next to that text. The
  visual should use the same nouns as the paragraph: token positions, hidden
  state rows, residual stream, attention weights, MLP update, normalization
  boundary, output-head projection, logits table, or the equivalent concrete
  objects for the lesson domain. If a mechanism is intentionally only a preview,
  say "preview" in both audio and written text and state when deeper treatment
  will come later.
- **Every pipeline/process section needs a local stage map.** The full lesson
  knowledge graph is not enough. Each lesson part that belongs to a pipeline,
  lifecycle, syllabus path, or build sequence should include a small handoff
  visual showing what came before, what this section receives, what it changes,
  what it outputs, and what comes next. For LLM lessons, explicitly distinguish
  tokenizer, embeddings/hidden states, transformer blocks, output head/logits,
  training, and inference/serving so the learner can answer questions like
  "how does the tokenizer relate to the transformer?" while reading the section.
- **Learner flow order is audio, then text plus visuals, then practice.** The
  learner should first listen to the audio orientation, then study the written
  explanation and nearby visualizations together, then do the practice/code and
  assessments. Do not bury audio after the written explanation inside a lesson
  part, and do not separate mechanism text from its visual support.
- **Dynamic visual components are now the authoring path.** The fixed registered
  widget catalog and generic declarative renderer are legacy read-only
  compatibility for older lessons. New generated lessons must use the
  DB-backed `bespoke-artifact` pipeline: generate per-part React components,
  store source and manifest in SQLite, compile in isolation, attach build hash
  and compiled artifact reference, run Chrome MCP desktop/mobile sandbox QA with
  screenshots, record QA evidence, then approve. Lesson JSON stores only
  `widget_type: "bespoke-artifact"` plus the stable approved slug.
- **Generic visuals are forbidden for new generation.** Do not use the generic
  declarative chart renderer or a registered widget for new lesson authoring,
  even if one is close. If a visual needs a bar chart, matrix, stage map, or
  flow diagram, implement that as a bespoke artifact with the exact objects,
  labels, controls, and failure states for this lesson. Visual quality is core
  lesson quality, not decoration.
- **Metaphors, simple examples, and step-specific visuals.** For multi-step
  lessons, each major step should have a plain-language handle, a fitting
  metaphor, easy examples, and its own visual/interactive treatment when that
  would clarify what the step changes or what breaks if skipped.
- **Audio is a real walkthrough, not a short caption.** The spoken script must be
  detailed enough for the learner to understand the high-level picture, the why,
  and concrete worked examples before using the interactives. Normal lessons
  should target at least 10 minutes of substantive Doraemon-voice audio, and may
  be longer when the topic needs it. Go shorter only for explicitly short
  reference/diagnostic content and document why. The audio should explicitly
  bridge concepts in plain language. If it sounds like a quick summary or table
  of contents, regenerate it.
- **First-class written teaching text** (`reading`), not a transcript dump.
- **Collapsed lesson parts for normal lessons.** Break the lesson into
  `lesson_part` activities whenever the topic has steps or sub-concepts. Each
  part contains the written explanation, per-part audio script/transcript,
  `audio.synced_visual`, an adjacent bespoke-artifact visualization, a
  part-specific executable code practice, and mixed reinforcement practice.
  Mixed practice must include select-one, select-all with some correct,
  select-all with none correct, ordering, and written-response prompts.
  Written prompts must include `actual_answer` and `rubric` so
  `/api/answer-judge` can give immediate LLM feedback. Each section has a
  done/undone button that the learner may toggle at any time as a personal
  checklist marker. That marker persists in SQLite but is not a completion gate
  and does not replace the final end-of-lesson assessment or final integrator
  code.
- **Multiple meaningful visual/interactive explorations when the lesson covers
  multiple concepts.** A multi-concept lesson (3+ goals or mastery targets) must
  offer **at least two distinct visual perspectives** — either several
  `interactive` activities, or one declarative widget driving a `charts: []`
  array. Multi-step lessons should prefer step-specific visuals. One thin widget
  for many concepts is rejected (enforced).
- **Interactive sections must deepen understanding.** A widget is not acceptable
  just because it displays a chart. Each interactive must have a clear learning
  objective, a learner-controlled variable, a visible consequence, and a written
  takeaway that explains what changed and why. Prefer "what breaks if..." and
  before/after/counterfactual views over decorative graphs. QA should reject any
  visual whose labels could be swapped and reused for an unrelated lesson.
- **Every control must move a visible object.** A dial, slider, toggle, picker,
  or input fails QA if it only changes a number, caption, or invisible internal
  state. The controlled thing must be labeled and visibly change at each setting:
  a context window edge moves, a matrix row lights up, a path reroutes, a chart
  bar changes, a probability pile reshapes, or a before/after failure appears.
  Chrome MCP QA for newly created lessons must interact with every control on
  desktop and mobile and reject controls whose purpose is not visually obvious.
- **Every visualization needs audio.** Each visualization/interactive must have
  its own spoken explanation clip or a per-part audio script tied directly to
  that visual. The audio should say what to change, what to watch, what failure
  mode is being shown, and what the visual proves. Do not leave silent graphs
  for the learner to interpret alone.
- **Every lesson part needs a transcript and synced visual timeline.** The
  `audio.script` is the source transcript and may be duplicated into
  `audio.transcript` for clarity. Each lesson part must also include
  `audio.synced_visual.cues`: timed states that cover most of the audio duration
  and change the visual as playback advances. A static transcript panel is not
  enough. The timeline should show what the part receives, what changes during
  the narration, and what is passed forward.
- **Plan visual beats about every 5 seconds.** For normal lesson-part audio,
  expect roughly one moving visual beat every 5 seconds. A beat can move a
  pointer, highlight a matrix cell, shift a row, update an arrow, reveal a
  layer, change camera focus, or transition a before/after state. It must not
  merely display the next sentence of the transcript. Long static intervals fail
  QA.
- **Use a Manim / 3Blue1Brown scene mindset.** The reference workflow from
  Grant Sanderson's 3Blue1Brown Manim demo is not "put text beside a chart"; it
  is scene construction. Define objects, positions, transforms, camera emphasis,
  and timed state changes. A good synced visual may combine a pipeline map, a
  tiny table or matrix, a moving pointer, before/after state, and a consequence
  panel, all coordinated by the audio timeline.
- **YouTube media should be included when highly relevant.** Look for a video
  when it can deepen the lesson, but do not embed long general videos as filler.
  If a video is used, it must be short or timestamped to the exact relevant
  segment, and the `reason` must say what the learner should look for. The
  lesson must explicitly say whether the whole video is relevant or only
  specific segments are relevant. For segments, provide precise start/end times
  and what to watch for in each segment. If no tightly relevant clip exists,
  omit the media section and teach the concept directly in audio, writing, and
  interactives.
- **Deep links everywhere.** Lessons must expose stable section links through a
  table of contents. Subject tabs, dashboard views, lesson pages, lesson
  sections, and other major menus should be reachable by URL query or hash so
  the learner can return to the same context.
- **Practice/code** the learner submits (scaffolded, no exposed answer).
- **Adaptive assessment** — an MC quiz (every question carries a required
  `difficulty` and the virtual "I don't know" option) plus freeform questions.
- **Structured SQLite mastery tracking.** Lesson generation and completion must
  use the local SQLite evidence model efficiently: `assessment_results`,
  `attempts`, `progress_points`, `mastery_signals`, `generated_artifacts`, and
  `next_lesson_jobs`. Track per-lesson and cross-lesson mastery with structured
  rows and tags, not hidden prose.
- **Continuous concise model notes.** Maintain a subject workpad for long-term
  planning. Compress completed work into short durable notes and keep next-step
  planning more detailed: open questions, weak concepts, likely directions,
  useful examples, and planned evidence checks. Refactor stale detail out
  instead of appending endless logs.
- **Bespoke end-of-lesson planning diagnostics** (`next_lesson_diagnostics`,
  validated when present; the app applies `DEFAULT_NEXT_LESSON_DIAGNOSTICS` if
  omitted). The "help shape your next lesson" questions should be tailored to
  the lesson just completed and should genuinely help plan the next lesson. Ask
  what still feels unclear, which direction would help most, and what the
  learner wants to be able to do next. Do not reuse generic boilerplate prompts
  when a lesson-specific question would be more useful.
- **Explicit preview wording for high-level concepts.** If a lesson intentionally
  introduces a concept only at a high level, the **audio script and the written
  text must say so explicitly** — name it a preview and state it will be explored
  in more detail in a later lesson, so the learner is never left thinking a
  glossed-over idea was fully taught. (Reviewed by hand; not auto-detectable.)
- **Audio plus visual side-by-side orientation.** The top-level audio activity
  must include a focused timed `orientation_visual`, and every lesson-part audio
  segment must include `audio.synced_visual`. The learner should see the paired
  visual beside the audio player on desktop and immediately below it on mobile,
  not only after scrolling through the transcript or opening a later activity.
- **Top-level audio uses the same synced pattern as lesson parts.** The first
  audio activity's `orientation_visual` should be a timed cue scene, not just a
  static widget beside the player. Use the same learner behavior as
  `audio.synced_visual`: progress follows playback time, each cue has
  `start`, `end`, `label`, `headline`, `narration`, `receive`, `transform`, and
  `pass`, and clicking a cue seeks the audio to that beat.
- **Audio-adjacent visuals are scoped to that audio segment.** The visual shown
  beside or immediately below an audio player should show only the object,
  stage, state transition, or tiny worked example that the current audio is
  narrating, with only minimal before/after handoff context. Do not reuse a
  broad whole-lesson map, all-step simulator, complete curriculum graph, or
  later exploratory interactive beside the audio when most of it is not being
  discussed in that audio. Put broad exploratory interactives after the
  audio/text block as their own activity; the audio-adjacent visual should be a
  focused subset or dedicated bespoke artifact with timed states matching the
  spoken beats.
- **Knowledge graph orientation (`knowledge_graph_data`).** Every lesson must
  include a `KnowledgeGraphData` object (see `src/types/index.ts`) that shows
  where this lesson sits in the subject curriculum. Think of it as a subject map
  the learner sees at the top of the lesson.
  - For **high-level overview lessons**: include all major subject concepts as
    nodes. Mark which ones this lesson covers (`covered: true`). Set `type:
    "high-level"` — the UI draws a bounding box around the covered area.
  - For **focused/deep-dive lessons**: include the relevant subgraph of concepts
    plus the root/subject node. Set `type: "focused"` — the UI highlights the
    deep-dive area within the larger subject.
  - Nodes not covered in this lesson but worth previewing should be marked
    `preview: true` (amber in the UI). Nodes not yet taught at all should be
    `covered: false, preview: false` (gray).
  - Edges define meaningful concept dependencies. Connect root → direct children
    and known prerequisite → dependent concept. Auto-star (root → all) is the
    minimum; explicit dependency paths are better.
  - Author this carefully for each lesson — it is the first thing the learner
    sees. A generic placeholder is worse than a thoughtful minimal graph.
  - Machine-checked by `validateKnowledgeGraphData` (soft warnings, not errors).


These rules apply to **all** future lessons, not just seed/demo content. The
canonical home of this guidance is this file plus `validateGeneratedContent`;
keep them in sync when the contract changes.

So a future lesson-generation **agent** receives these requirements directly (not
just as a doc link it might never open), the reusable generator paths embed them
in the task prompt. `LESSON_QUALITY_BAR_PROMPT`
(`src/lib/lesson-generator/contract.ts`) is the single formatted copy of this
bar, and the Dora-task adapters (`src/lib/adapters/dora-task.ts`, both
next-lesson and replacement generation) inject it into every generated task.
`src/lib/adapters/__tests__/adapters.test.ts` asserts each generated task prompt
still names every enrichment dimension, so this guidance cannot silently drop out
of the generation pipeline. Keep `LESSON_QUALITY_BAR_PROMPT` in sync with this
section and `validateGeneratedContent`.

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
- optional `relevance: "whole" | "segments"`. Use `"whole"` only when the whole
  video is worth watching for this lesson. Use `"segments"` when only selected
  spans are relevant.
- `segments` when `relevance` is `"segments"`. Each segment needs a non-negative
  `start`, optional `end` greater than `start`, and should include a label or
  reason so the learner knows exactly what to watch for.

If a video is unavailable or blocked, the lesson degrades to the fallback text
plus a "Watch on YouTube" link — it never breaks the page. Pick general,
durable educational videos. Never embed private or credentialed content.

## Multiple views of one concept

A strong lesson shows the same idea from several angles. There are two ways to
do this, and you can combine them:

1. **Several `interactive` activities** in one lesson, each backed by its own
   approved bespoke artifact and restored independently.
2. **Several coordinated views inside one bespoke artifact**, driven by the same
   controls or audio timeline: a table, graph, flow, matrix, stage map, and
   failure view can all live in one purpose-built component.

Older seeded lessons may still demonstrate declarative multi-chart specs, but
that path is not valid for new generation. New interactives are approved
`bespoke-artifact` specs only. Never emit raw React/JS in lesson JSON. The raw
component source belongs in `visual_artifacts`, crosses the build/QA/approval
gate, and lesson JSON references only the slug.

## Code: scaffold, never solve

`practice_code` is a real submission exercise. Provide:

- `prompt` — the task (required).
- `walkthrough` — 3-5 conceptual steps that explain what the input represents,
  what transformation the learner is implementing, what output shape/type is
  expected, and why the tests expect that behavior.
- `io_examples` — at least two concrete input and expected-output examples
  with short explanations. These examples should let the learner predict the
  behavior before reading or editing code.
- `visualization` — a compact behavior map with labelled input, process, and
  output items. It should make the data flow visible even if the learner skips
  the runnable editor on phone.
- `starter_code` — scaffolding only.
- `worked_examples` — two full-code references: one `label: "basic"` readable
  implementation and one `label: "concise"` best concise implementation. These
  are rendered in a controlled study area and are especially important in phone
  preview, where the learner studies the answer/reference path without typing
  in the editor.
- `constraints` and `guided_steps` — rules and an ordered path that guide
  without giving the answer.
- `hints` — progressive and unboxable: start with a conceptual nudge, then a
  structural plan, then package/API help, then syntax, then a near-complete
  answer, then a complete answer explanation. Hints are revealed one at a time,
  and a stuck learner must be able to keep opening hints until they can finish.
- If a coding exercise uses an external Python library, document the relevant
  function calls, keyword arguments, and parameters in starter-code comments or
  the surrounding teaching text. Do not assume the learner already knows package
  vocabulary such as NumPy/PyTorch/Transformers argument names.
- `tests` — public tests the learner can see and Run.
- `hidden_tests` — run on Submit; their assertions are never shown, only a
  pass/fail count.

Validation **rejects** any top-level `solution`, `answer`, `solution_code`,
`reference_solution`, or `completed_code` field. Progressive answer support
belongs in hints, comments, and the controlled `worked_examples` study block.
The learner must write and submit code that passes the tests. Passing tests
records a mastery signal but **never** completes the lesson.

Every Submit also requests LLM code feedback through `/api/code-feedback` when
the feedback provider is enabled. The request includes the exercise prompt,
starter code, learner code, interpreter output, public test results, and only
the hidden-test pass count. Feedback should name the likely issue and provide a
next-edit hint when something fails, without revealing hidden assertions or
dumping a full solution.

## Lesson parts (`lesson_part` content — required for normal lessons with steps)

Normal lessons should be authored as collapsed lesson parts when the concept has
separable steps, sub-concepts, or visual explanations. Each part must teach one
coherent idea and include all four teaching modes:

```json
{
  "part_id": "resize",
  "reading": { "intro": "...", "blocks": [...], "summary": "..." },
  "audio": {
    "script": "A spoken explanation tied to this exact visualization...",
    "transcript": "The exact transcript shown to the learner...",
    "duration_hint": 90,
    "synced_visual": {
      "strategy": "timeline",
      "cues": [
        {
          "start": 0,
          "end": 24,
          "label": "Receives",
          "headline": "Name the incoming object",
          "narration": "The visual shows what arrived from the previous step.",
          "receive": "previous step output",
          "transform": "focus attention",
          "pass": "ready state"
        }
      ]
    }
  },
  "interactive": {
    "schema_version": "1.0",
    "widget_type": "bespoke-artifact",
    "instructions": "Change the image size and watch what breaks...",
    "params": { "artifact_slug": "resize-breakage-scene" }
  },
  "code": {
    "prompt": "Implement the tiny helper for this part's mechanism.",
    "starter_code": "def helper(x):\n    pass\n",
    "worked_examples": [
      { "label": "basic", "title": "Basic readable version", "code": "..." },
      { "label": "concise", "title": "Best concise version", "code": "..." }
    ],
    "tests": [{ "id": "part-code", "description": "...", "assert": "..." }]
  },
  "practice": {
    "written_feedback": "llm_judge",
    "questions": [
      { "type": "select_one", "prompt": "...", "choices": [...], "correct_index": 0, "explanation": "..." },
      { "type": "select_all", "prompt": "...", "choices": [...], "correct_indices": [0, 2], "explanation": "..." },
      { "type": "select_all", "prompt": "...", "choices": [...], "correct_indices": [], "explanation": "None of these are correct because ..." },
      { "type": "ordering", "prompt": "...", "items": [...], "correct_order": [...], "explanation": "..." },
      { "type": "written", "prompt": "...", "actual_answer": "...", "rubric": "..." }
    ]
  }
}
```

Lesson-part rules:
- Parts are collapsed by default in the UI and show a checkmark only after the
  learner clicks "Mark Part Done". Practice feedback and code checks are
  learning evidence, not a hard gate for that checklist marker.
- Each part must include a transcript and `audio.synced_visual` timeline whose
  cues cover most of the part audio. The visual must change with playback time.
- Each part must include a `code` object using the same `practice_code` schema
  as final code activities. The code exercise should target this part's exact
  mechanism, not the whole lesson.
- Each part must include mixed `practice.questions`: at least six prompts,
  including select-one, select-all with multiple correct choices, select-all
  with no correct choices, ordering, and written response.
- Written part-practice questions must provide `actual_answer` and `rubric`.
  The UI calls `/api/answer-judge` for immediate LLM feedback when the provider
  is configured, and falls back loudly to local rubric comparison only when the
  judge is unavailable.
- Prefer one visualization per part. If a part contains multiple charts/views,
  the part audio must explicitly explain each visualization.
- This per-part reinforcement does not replace the final assessment, final
  practice/code, or end-of-lesson diagnostics.

## Multiple-choice quiz (`assessment` content — required for normal lessons)

Normal generated lessons must include an adaptive multiple-choice quiz by
adding a `quiz` key to the assessment content JSON. Omit the quiz only for
explicitly non-assessed reference or diagnostic content, and document why in the
lesson-generation task notes. The quiz is shown above the freeform questions
and the "Mark Complete" button is gated until the learner passes.

### Schema

```json
{
  "questions": [...],      // freeform questions (unchanged)
  "quiz": {
    "pass_threshold": 6,   // distinct concepts the learner must get correct (default: 6)
    "consecutive_correct_required": 4, // optional; used by lesson parts for 4-in-a-row
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
- When `consecutive_correct_required` is set, the learner must also satisfy the
  configured streak rule. Use this for final adaptive quiz flows only when it
  improves learning; lesson-part reinforcement now uses mixed practice instead
  of 4-in-a-row MC.
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
- [ ] Normal lessons are broken into `lesson_part` activities where appropriate:
      each part has written explanation, per-part audio transcript,
      `audio.synced_visual` timed cues, a bespoke-artifact interactive
      visualization, part-specific executable code, and mixed practice covering
      select-one, select-all some, select-all none, ordering, and written
      LLM-graded feedback.
- [ ] At least two visual perspectives on the core concept, and every
      visualization has an audio explanation clip or per-part audio script.
- [ ] Every new interactive uses `widget_type: "bespoke-artifact"` and has
      Chrome MCP sandbox QA evidence, including desktop and mobile screenshots,
      before the lesson references it.
- [ ] Media (if used) has reason + fallback and resolves to a valid video id.
- [ ] Code has a prompt, progressive unboxable hints all the way to the answer
      explanation, public + hidden tests, comments documenting any external
      Python library calls, and no top-level exposed solution field. Every
      `practice_code` and lesson-part `code` object includes `walkthrough`,
      at least two `io_examples`, a `visualization` mapping input -> process ->
      output, and `worked_examples` with both basic/readable and best concise
      full implementations.
- [ ] Code Submit shows AI feedback from `/api/code-feedback`, using the
      submitted code, interpreter output, visible test failures, and hidden test
      pass count to give a concrete hint when something is wrong.
- [ ] Assessment questions probe understanding, not recall of the audio.
- [ ] Adaptive MC quiz present for normal lessons: 8+ questions, unique ids, `pass_threshold` ≤ question count,
      a **required `difficulty`** on every question, `misconception_target` and
      `rephrase_instructions` on each question.
- [ ] End-of-lesson `next_lesson_diagnostics` present (or rely on the default set).
- [ ] `validateGeneratedContent` returns `{ valid: true }`.
- [ ] `validateMultipleChoiceQuizContent` returns `{ valid: true }` (if quiz included).
- [ ] `knowledge_graph_data` is authored (not a generic placeholder); `validateKnowledgeGraphData` produces no errors.

## Lesson generation workflow (every new lesson)

Every generated lesson must be tracked as a Dora task and pass a manual QA
review before the learner sees it. Machine validators catch structural problems;
a human reviewer catches content quality problems (thin explanations, bad
examples, wrong difficulty calibration, audio that sounds robotic or truncated).

### Required steps

1. **Create a Dora task** before generation starts. Title: `Generate lesson N
   for <subject> — <learner>`. The task acceptance criteria must start with
   `Read skills/avocadocore-lesson-authoring/SKILL.md before doing any lesson
   work`, then reference this authoring guide and the `validateGeneratedContent`
   contract. This applies to first lessons after a new subject is added,
   next lessons after `lesson.completed`, replacements after `lesson.discarded`,
   and manual backfills. Do not generate ad hoc without a task; the task is the
   audit trail.

2. **Generate.** Use the deployment's `LessonGeneratorAdapter` (e.g. the
   `dora-task` adapter dispatched from `CompletionHookAdapter` on lesson
   completion). The generator receives the enriched `LessonCompletedEvent` and
   LESSON_QUALITY_BAR_PROMPT. For a new-subject first lesson, use equivalent
   subject + learner-profile evidence and create the same style of Dora task;
   do not invent a separate, weaker prompt.

3. **Run the machine checks** before QA:
   ```
   validateGeneratedContent(content)          // must return { valid: true }
   validateMultipleChoiceQuizContent(quiz)    // must return { valid: true } for normal lessons
   validateKnowledgeGraphData(graph)          // must return { valid: true, errors: [] }
   ```
   A lesson that fails any of these must be regenerated or fixed — it cannot
   proceed to QA.

   For each new bespoke artifact, also run:
   ```
   POST /api/visual-artifacts
   POST /api/visual-artifacts/{slug}/build
   open /api/visual-artifacts/{slug}/sandbox with Chrome MCP
   take desktop and mobile screenshots
   POST /api/visual-artifacts/{slug}/qa-evidence
   POST /api/visual-artifacts/{slug}/approve
   ```

4. **Manual QA review.** A reviewer (not the same agent that generated the
   lesson) opens the lesson in the browser and works through it:
   - Listen to the full audio or scan the script. Is it substantive? Does it
     cover all goals? Does it use explicit preview wording for high-level
     concepts?
   - Read the written section. Does it stand alone without the audio?
   - Interact with every widget. Do the controls produce sensible output? Are
     chart labels legible at 390px mobile width?
   - Attempt the code exercise. Is the starter code helpful? Are hints
     progressive without giving the answer? Do the tests actually test the
     concept?
   - Answer a sample of quiz questions. Do the distractors require real
     understanding to reject? Does the IDK option work and show the correct
     answer?
   - Fill in the end-of-lesson diagnostics. Do the prompts make sense for this
     lesson?
   - Check the knowledge graph orientation. Does it accurately reflect what this
     lesson covers vs. previews vs. leaves for later?

5. **Approve or iterate.** If QA passes, mark the Dora task complete with a
   summary of what was reviewed. If QA fails, note the specific problems in the
   task and regenerate the affected sections.

6. **Activate the lesson.** Set `lessons.status` to the appropriate state so the
   learner can access it. The Dora task is the evidence trail; do not activate
   without a completed task.

### Adapters and deployment

The `LessonGeneratorAdapter` interface (`src/lib/lesson-generator/contract.ts`)
decouples generation from the app. The `dora-task` adapter
(`src/lib/adapters/dora-task.ts`) is the reference implementation for
Doramon-backed deployments: it creates a todo task with full learner evidence
as acceptance criteria and includes `LESSON_QUALITY_BAR_PROMPT` verbatim so
the generator agent sees the requirements directly.

Custom adapters (CLI scripts, REST-backed LLMs, etc.) must also embed
`LESSON_QUALITY_BAR_PROMPT` in whatever prompt they send to the model. The
quality bar is not optional for any adapter.

### What "full QA" means

Full QA is not running the validators. It is a human or reviewer agent loading
the lesson in the browser, interacting with every activity, and confirming that
a learner could genuinely learn the subject from this lesson alone. A lesson
that passes all machine checks but is thin, confusing, or pedagogically wrong
still fails QA and must be regenerated.

### Manual authoring principle — no blind autogeneration

Every lesson is authored manually and thoughtfully. Automation (LLMs, generators, scripts) may
assist, but the AI lesson author must own the pedagogy — choosing what to teach, at what
depth, in what order, and through which examples and interactions. No blind
template-fill or autogeneration-only output passes QA. Specifically:

- **Design intent is required.** Before generating any content, decide: what is the learner
  struggling with? What is the single most important thing to understand by the end? What is
  the best analogy or worked example for this particular learner's context?
- **Knowledge graph first.** Author the `knowledge_graph_data` before writing activities. The
  graph is the lesson's map; the activities fill in the areas the map marks as covered.
- **Interactives must be designed, not defaulted.** Each interactive section must have a
  specific learning objective and a learner-controlled variable that reveals a consequence.
  An interactive that merely displays a static figure is not interactive.
- **"I generated this" is not evidence.** The Dora task completion evidence must show what
  the agent verified, not just that it ran a generator. See the acceptance criteria template below.

### New lesson Dora task — acceptance criteria template

When creating a Dora task for a new lesson (whether the first lesson for a subject, a
replacement, or an ad-hoc addition), the task acceptance criteria must include all of the
following. Copy and fill in this template:

```
MANDATORY FIRST STEP:
- Read skills/avocadocore-lesson-authoring/SKILL.md before doing any lesson work.

Generate lesson <N> for "<Subject Title>" — learner <profile name or id>.

PEDAGOGICAL INTENT (fill in before generating):
- What weakness or gap is this lesson addressing?
- What is the single most important takeaway?
- Which concepts are COVERED vs PREVIEWED vs LEFT FOR LATER?

GENERATION:
- Use the enriched LessonCompletedEvent / LessonDiscardedEvent context (or equivalent
  subject + learner state) as primary input.
- Query the local SQLite evidence first. Do not assume learner weaknesses,
  prerequisites, or domain facts unless they are documented in AvocadoCore,
  visible in SQLite evidence, or verified and recorded in task notes / metadata.
- The AI author must manually decide the lesson scope, knowledge graph,
  metaphors, examples, interactives, written explanation, audio walkthrough,
  video choice, practice, and quiz misconception targets. Do not accept a
  generic template fill.
- Embed LESSON_QUALITY_BAR_PROMPT in the generator prompt (src/lib/lesson-generator/contract.ts).

MACHINE CHECKS (must all pass before QA):
- validateGeneratedContent(content) → { valid: true }
- validateMultipleChoiceQuizContent(quiz) → { valid: true } (required for normal lessons)
- validateKnowledgeGraphData(graph) → { valid: true, errors: [] }

IMPLEMENTATION EVIDENCE (required in task notes before QA):
- POST /api/lessons created with the full generated content; record the lesson id.
- pnpm audio:generate <id> completes with HTTP 200 from /runtime/... route.
- Verify on LIVE or FRESH DB (not a temporary one-off): GET /api/lessons/<id> returns the
  lesson with all activities, generated_artifacts with real audio, and next_lesson_diagnostics.
- Verify audio route GET /runtime/runtime_artifacts/audio/lesson_<id>_audio.* → HTTP 200, audio/* content-type.
- Record which SQLite rows were read and written for mastery tracking, including
  assessment_results, attempts, progress_points, mastery_signals,
  generated_artifacts, and next_lesson_jobs where applicable.

LIVE / FRESH-DB VERIFICATION (required before QA):
- Open http://<deployment>/lessons/<id> in the browser.
- Take a desktop screenshot (1280px) and a mobile screenshot (390px).
- Confirm the knowledge graph renders at the top, audio player shows real duration (not 0:00),
  and all activities are visible without horizontal overflow at 390px.
- If the lesson has a code exercise, use the code exercise Desktop/Phone preview
  control and verify Phone mode. Phone mode must be read-only: no code editor,
  no Run/Submit controls, no runtime badge. It must show the optional-coding
  notice, walkthrough, expected input/output examples, behavior visualization,
  and full reference answers inside the 390px preview without horizontal
  overflow.
- Run the actual code exercise in the browser. Click Run tests and Submit with
  the starter or intended solution path in Desktop mode, verify public and hidden tests execute,
  and fix any runtime/package failure such as missing Pyodide packages. A code
  section that looks correct but has never been executed does not pass QA.

MANUAL QA REVIEW (must be done by a DIFFERENT agent/reviewer than the one that generated):
- Listen to the audio script or play the audio. Substantive? Covers all goals?
  Uses explicit preview wording for high-level concepts?
- Read the written section. Stands alone without audio?
- Interact with every widget. Controls work? Legible at 390px?
- Attempt the code exercise. Progressive hints? Tests actually test the concept?
  Phone preview mode present and usable?
- Answer sample quiz questions. Distractors require real understanding? IDK works?
- Fill in end-of-lesson diagnostics. Prompts relevant to this lesson?
- Check knowledge graph. Accurately reflects covered / previewed / later?

COMPLETION EVIDENCE:
- Link to commit or lesson id in the database.
- Live URL screenshot (desktop + mobile).
- QA reviewer label (different from generator agent).
- Confirmation that lessons.status was set to the appropriate active state.
```

This template must be referenced (not paraphrased) in the Dora task acceptance criteria.
Reviewers should verify the template was followed, not just that output was produced.

### What "separate QA" means

The reviewer must be a different worker label than the generator. If the same agent generates
and reviews, the review is invalid and must be repeated. The reviewer's job is to find
problems, not confirm that generation ran. A QA reviewer who approves a lesson without
opening the browser and interacting with every activity has not done QA.
