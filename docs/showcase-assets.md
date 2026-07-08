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

## Showcase video (`site/assets/media/`)

- `showcase.mp4` — ~30s, 1280×720, H.264 + AAC, `+faststart` for web streaming.
- `showcase-poster.jpg` — poster/fallback image shown before playback.

**Subjects (≈5s each), in order:**

1. Probability — Bayes' Theorem
2. Economics — Supply & Demand
3. Machine Learning — The LLM Lifecycle
4. Deep Learning — Inside Attention
5. Algorithms — Trie / Prefix Tree
6. Algorithms — Sliding Window

**Generation method.** Assembled with `ffmpeg` from real audio-synced lesson
videos that Open Avocado generated for the subjects above (the app's Manim-based
lesson-video capability). For each subject a ~5s segment was extracted, scaled to
720p, given a subject caption and an "Open Avocado" wordmark, audio-normalized
(`loudnorm`) with short fades, then concatenated. Each segment keeps its own
generated narration, so audio stays in sync with the visuals (verified: 30.0s
video / 30.0s audio, mean level ≈ −23.7 dB across all six segments).

**Honesty note / limitations.** The clips are real generated lesson-video output;
the reel is an edited highlight (captions, wordmark, level-matching) rather than a
single continuous end-to-end render. Subject coverage reflects what was available
as generated video at capture time (math, economics, ML/AI, and algorithms); it
does not imply every subject area has finished video yet. The video is embedded
with `preload="none"`, a poster image, an accessible `aria-label`, a `<video>`
caption, and a download fallback link for browsers without inline playback.
