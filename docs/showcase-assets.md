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

- `showcase.mp4` — ~157s (~2m37s), 1280×720, H.264 + AAC, `+faststart` for web
  streaming, ~7.7 MB (CRF-encoded for a fast, mobile-friendly landing page).
  A **narrated feature walkthrough** (not a plain lesson-clip reel): a guided tour of
  the product, a dedicated "run it your way" runtime beat, a ~60-second **side-by-side
  audio-synced lesson video** (explanatory text on the left, the real generated lesson
  video on the right), and a proper closing outro card.
- `showcase-poster.jpg` — poster/fallback image shown before playback. It is a
  designed "Feature walkthrough" cover (play affordance + product frame) that names
  the three runtime paths, so it reads as a product tour rather than a random frame.

**Walkthrough sequence (voiceover-narrated, in order):**

1. **Intro** — what Open Avocado is (free, open-source, AI-powered adaptive learning).
2. **Subjects & mastery** — the learner dashboard with evidence-based mastery scores.
3. **Lesson orientation** — a lesson's knowledge-graph orientation view.
4. **Interactive visualizations** — a bespoke, manipulable in-lesson interactive.
5. **Adaptive quizzes** — one-question-at-a-time assessment that re-asks misses.
6. **Progress** — familiarity → competence → mastery, with the next lesson generated.
7. **Run it your way (runtime paths)** — a dedicated three-card beat: a **local LLM**
   for private, offline learning; **your own API key** for the fastest hosted start;
   or an **agent harness** for richer, more agentic lesson generation.
8. **Lead-in** — Open Avocado can turn a lesson into a narrated, audio-synced video.
9. **Side-by-side audio-synced lesson video (~60s)** — explanatory text on the left,
   a real generated "Inside the Attention Block" (Deep Learning) lesson video on the
   right, playing with its own narration synced to the on-screen visuals.
10. **Outro** — a closing summary card: free, open source, and yours to run, with a
    "View the live demo" call to action.

**Voiceover script (Aria neural TTS, en-US, rate −4%):**

> 1. "Open Avocado is a free, open-source adaptive learning platform, powered by AI.
>    You set a goal, and it works out the single next lesson you actually need."
> 2. "Everything starts from your subjects. Each one carries a mastery score, built
>    from real evidence of what you already know."
> 3. "Open a lesson, and it begins with a knowledge-graph orientation, so you always
>    see exactly where this concept fits."
> 4. "Every lesson is a full workspace, with bespoke interactive visualizations you
>    can manipulate to build real intuition."
> 5. "Adaptive quizzes check your understanding one question at a time, and re-ask
>    anything you miss until it clicks."
> 6. "Your mastery grows from familiarity, to competence, to mastery, and Open
>    Avocado always generates what you need next."
> 7. "And you run it your way. Use your own local LLM for private, offline learning.
>    Bring your own hosted API key for the fastest start. Or connect an agent harness
>    for richer, more agentic lesson generation."
> 8. "Open Avocado can even turn a lesson into a narrated video, with the audio synced
>    to the visuals. Here is one it generated."
> (side-by-side segment plays the lesson video's own narration)
> 10. "Open Avocado. Free, open source, and yours to run. Start learning with the live
>     demo today."

**Generation method.** The narrated product/runtime beats are branded slides rendered
from **real, scrubbed product screenshots** (`site/assets/shots/`, the same synthetic
"Sample Learner" seed used elsewhere on the site) framed in a browser card with the
"Open Avocado" wordmark, then given a gentle Ken-Burns zoom with `ffmpeg`. Each slide is
timed to its own voiceover line (generated with `edge-tts`, `en-US-AriaNeural`). The
~60-second side-by-side segment composites a real audio-synced lesson video the app
generated (the Manim-based "Inside the Attention Block" lesson) into a framed card on the
right of a static explanatory panel, keeping its original narration intact. All parts are
concatenated and encoded H.264 + AAC with `+faststart` (verified: 157.5 s video / 157.5 s
audio in sync; audio present throughout, ≈ −25 dB mean for narration and ≈ −24 dB for the
lesson segment; nine discrete speech segments detected).

The build tooling lives in `scripts/site/walkthrough/` (slide renderer, narration script,
poster renderer, and the `ffmpeg` assembly). It reads the lesson source video via the
`LESSON_VIDEO` environment variable (the app's generated `activity_86.mp4` for lesson 15);
that runtime artifact is not committed to this public repo.

**Honesty note / limitations.** The screenshots and the side-by-side lesson clip are real
Open Avocado output; the walkthrough is a **staged, narrated edit** — the product-tour and
runtime steps use captured screenshots with motion and a scripted voiceover, not a single
continuous live screen recording. The side-by-side lesson-video segment is genuine
generated output and keeps its own narration. Nothing implies functionality the app does
not have; all data is synthetic/scrubbed, with no personal learner data, private
infrastructure, or internal task-system references. The video is embedded with
`preload="none"`, a poster image, an accessible `aria-label`, a `<video>` caption, and a
download fallback link for browsers without inline playback.
