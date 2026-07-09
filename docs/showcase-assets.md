# Landing page showcase assets

This documents the media used on the public landing page (`site/index.html`).
All assets are public-safe: they contain no personal learner data, no private
infrastructure, no internal task-system references, and no legacy "Core" naming.

## Screenshots (`site/assets/shots/`)

Captured from the actual Open Avocado app running locally against a **synthetic,
scrubbed seed database** (the sample learner is a generic "Sample Learner"; all
subject/lesson text was scrubbed of any personal or career-specific content
before capture). Rendered with headless Chrome via the DevTools protocol at 2x
device scale, then optimized.

| File | What it shows |
| --- | --- |
| `dashboard.png` | Learner dashboard — subjects with mastery % and progress bars. |
| `subject.png` | Subject page — lessons, phase, and progress. |
| `mastery.png` | Mastery view — familiarity → competence → mastery phases + evidence-based score. |
| `concept-map.png` | Knowledge-graph orientation for a transformer-block lesson. |
| `viz-attention.png` | Bespoke interactive: Attention Score Calculator (Q, K, V steps). |
| `viz-trie.png` | Bespoke interactive: trie insert/search step-through. |
| `viz-tokens.png` | Bespoke interactive: token-ID to embedding-row flow. |
| `viz-heap.png` | Bespoke interactive: binary heap sift up/down. |
| `interactive-slider.png` | Live manipulable: sliding-window sum. |
| `code-exercise.png` | Scaffolded code exercise — browser-run Python (Pyodide), tests, hints. |
| `quiz.png` | Adaptive quiz — select-one / select-all with difficulty tags. |
| `mobile-dashboard.png` | Dashboard at 390px (mobile). |
| `mobile-lesson.png` | Lesson workspace at 390px (mobile). |

## Feature walkthrough video (`site/assets/media/`)

- `showcase.mp4` — ~71s, 1280×720, H.264 + AAC, `+faststart` for web streaming.
  A **narrated feature walkthrough** (not a plain lesson-clip reel): a guided tour
  of the product, capped by a real audio-synced lesson-video segment.
- `showcase-poster.jpg` — poster/fallback image shown before playback. It is a
  designed "Feature walkthrough" cover (play affordance + product frame), so it
  reads as a product tour rather than a random lesson frame.

**Walkthrough sequence (voiceover-narrated, in order):**

1. **Intro** — what Open Avocado is (free, open-source, AI-powered adaptive learning).
2. **Subjects & mastery** — the learner dashboard with evidence-based mastery scores.
3. **Lesson orientation** — a lesson's knowledge-graph orientation view.
4. **Interactive visualizations** — a bespoke, manipulable in-lesson interactive.
5. **Adaptive quizzes** — one-question-at-a-time assessment that re-asks misses.
6. **Progress** — familiarity → competence → mastery, with the next lesson generated.
7. **Audio-synced lesson video** — ~6s of a real generated "Inside Attention"
   lesson video (Deep Learning), keeping its own narration synced to the visuals.

**Voiceover script (Aria neural TTS, en-US):**

> 1. "Open Avocado is a free, open-source adaptive learning platform, powered by AI.
>    You set a goal, and it works out the single next lesson you actually need."
> 2. "Everything starts from your subjects. Each one carries a mastery score built
>    from real evidence of what you already know."
> 3. "Open a lesson and it begins with a knowledge-graph orientation, so you always
>    see exactly where this concept fits."
> 4. "Every lesson is a full workspace, with bespoke interactive visualizations you
>    can manipulate to build real intuition."
> 5. "Adaptive quizzes check your understanding one question at a time, and re-ask
>    anything you miss until it clicks."
> 6. "Your mastery grows from familiarity, to competence, to mastery, and Open
>    Avocado always generates what you need next."
> 7. "It even generates narrated lesson videos, with the audio synced to the visuals."

**Generation method.** Steps 1–7 (except the final lesson clip) are branded slides
rendered from **real, scrubbed product screenshots** (`site/assets/shots/`, the same
synthetic "Sample Learner" seed used elsewhere on the site), framed in a browser
card with a title, caption, and the "Open Avocado" wordmark, then given a gentle
Ken-Burns zoom with `ffmpeg`. Each slide is timed to its own voiceover line
(generated with `edge-tts`, `en-US-AriaNeural`). The closing segment is a real
audio-synced lesson video the app generated (the Manim-based "Inside Attention"
lesson), extracted (~6s) with its original narration intact. All parts are
concatenated and encoded H.264 + AAC with `+faststart` (verified: 70.8s video /
70.8s audio in sync; audio present throughout, ≈ −25 dB mean).

**Honesty note / limitations.** The screenshots and the closing lesson clip are
real Open Avocado output; the walkthrough is a **staged, narrated edit** — the
product-tour steps use captured screenshots with motion and a scripted voiceover,
not a single continuous live screen recording. The closing lesson-video segment is
genuine generated output and keeps its own narration. Nothing implies functionality
the app does not have; all data is synthetic/scrubbed, with no personal learner data,
private infrastructure, or internal task-system references. The video is embedded
with `preload="none"`, a poster image, an accessible `aria-label`, a `<video>`
caption, and a download fallback link for browsers without inline playback.
