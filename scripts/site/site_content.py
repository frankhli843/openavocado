# -*- coding: utf-8 -*-
"""Page bodies for the Open Avocado static site. Imported by generate-site.py.

All content here is public and privacy-safe: no personal data, credentials,
private hostnames, or internal task-system details.
"""

REPO = "https://github.com/frankhli843/openavocado"
PAGES = "https://frankhli843.github.io/openavocado/"

# ── Landing page ─────────────────────────────────────────────────────────────
HERO_BODY = f"""
<section class="hero">
  <div class="mark"><svg viewBox="635 -20 445 445" width="76" height="76" role="img" aria-label="Open Avocado"><path fill="#399103" d="M1232.67-1000.76a125.34,125.34,0,0,1,1-13c3.4-33,13.92-86.75,57.37-160.78,33-56.25,49.52-84.38,70.72-85.09,26.54-.89,46.12,32.06,79.12,87.6,39.58,66.6,49.47,123.11,52.53,154.17.83,8.43,1.25,12.64,1.12,17.1-1.53,52.59-48.78,130.92-130.92,130.92A130.92,130.92,0,0,1,1232.67-1000.76Z" transform="translate(-506.6 1267.13)"/><path fill="#f8ee7b" d="M1275.87-1006.33a84,84,0,0,1,.65-8.7c2.28-22.12,9.33-58.12,38.44-107.73,22.12-37.69,33.18-56.53,47.38-57,17.78-.6,30.9,21.48,53,58.69,26.52,44.62,33.14,82.48,35.2,103.29a90.81,90.81,0,0,1,.75,11.45c-1,35.23-32.68,87.71-87.71,87.71A87.71,87.71,0,0,1,1275.87-1006.33Z" transform="translate(-506.6 1267.13)"/><circle fill="#fff" cx="856.99" cy="264.46" r="42.81"/></svg></div>
  <h1><span class="b-open">Open</span><span class="b-avo"> Avocado</span></h1>
  <p class="tagline">An open-source adaptive learning platform and lesson-generation framework.
  Define what you want to learn, let the system keep evidence of what you know, and generate the next best lesson.</p>
  <div class="btn-row">
    <a class="btn btn-primary" href="quickstart.html">Get started</a>
    <a class="btn btn-secondary" href="architecture.html">How it works</a>
    <a class="btn btn-secondary" href="{REPO}" target="_blank" rel="noopener">View on GitHub</a>
  </div>
</section>

<section>
  <h2>The core idea</h2>
  <p>Most courses are a fixed list of lessons for an average student. Open Avocado is different: it treats
  learning as a loop driven by evidence. A learner defines goals and subjects; every answer, code submission,
  quiz result, and diagnostic becomes a <strong>mastery signal</strong>; and a lesson generator uses that growing
  evidence to author the single next lesson that closes the most important gap with the least effort.</p>
  <p>The design goal is to move a learner from <strong>familiarity</strong> (orientation and vocabulary) to
  <strong>competence</strong> (granular understanding and practice) to <strong>mastery</strong> (synthesis,
  transfer, and independent creation).</p>
</section>

<section>
  <h2>What a lesson contains</h2>
  <div class="feature">
    <div class="f"><h3>🎧 Narrated walkthrough</h3><p>A comprehensive audio session with a learner-visible transcript and a synced visual timeline that changes as the audio advances.</p></div>
    <div class="f"><h3>🧩 Bespoke interactives</h3><p>Purpose-built, sandboxed visual artifacts for each concept — not generic widgets — rendered from the database and mobile-verified.</p></div>
    <div class="f"><h3>🐍 Scaffolded code</h3><p>Browser-run Python (Pyodide) with guided steps, progressive hints, worked examples, and public + hidden tests.</p></div>
    <div class="f"><h3>📊 Adaptive assessment</h3><p>One-question-at-a-time multiple choice plus freeform questions, immediate grading, and requeued misses.</p></div>
    <div class="f"><h3>🗺️ Knowledge-graph orientation</h3><p>Each lesson opens by showing where it sits in the subject so the learner keeps the end-to-end picture.</p></div>
    <div class="f"><h3>📈 Mastery tracking</h3><p>Per-subject mastery scores, tags, difficulty, and progress graphs over time — visible and fed back into generation.</p></div>
  </div>
</section>

<section>
  <h2>Run it your way</h2>
  <p>Open Avocado separates the <em>app</em> from the <em>lesson generator</em> behind a small adapter interface,
  so you can plug in whatever produces lessons. Pick the local runtime that fits you:</p>
  <div class="card-grid">
    <a class="card" href="run-api-key.html"><div class="ico">🔑</div><h3>Direct API key <span class="badge badge-ok">ready</span></h3><p>The simplest standalone path. Bring an OpenAI or Google AI Studio key and go.</p></a>
    <a class="card" href="run-gemmaclaw.html"><div class="ico">🦎</div><h3>Gemmaclaw <span class="badge badge-partial">partial</span></h3><p>Point at a local, OpenAI-compatible Gemma model gateway. No cloud key required.</p></a>
    <a class="card" href="run-openclaw.html"><div class="ico">🤖</div><h3>OpenClaw <span class="badge badge-ok">ready</span></h3><p>Hand lesson generation to an external agent/task runner via the task adapter.</p></a>
    <a class="card" href="run-hermes.html"><div class="ico">📜</div><h3>Hermes <span class="badge badge-planned">planned</span></h3><p>Wire a local Hermes agent runtime through the agent-harness command adapter.</p></a>
  </div>
</section>

<section>
  <h2>Explore the docs</h2>
  <div class="card-grid">
    <a class="card" href="quickstart.html"><div class="ico">⚡</div><h3>Quick Start</h3><p>Install, seed a database, and run the app locally in a few commands.</p></a>
    <a class="card" href="architecture.html"><div class="ico">🏗️</div><h3>Architecture</h3><p>Core entities, the evidence loop, and the generation/completion flow.</p></a>
    <a class="card" href="lesson-authoring.html"><div class="ico">✍️</div><h3>Lesson Authoring</h3><p>The generic agent/skill model, quality bar, and separate-QA workflow.</p></a>
    <a class="card" href="configuration.html"><div class="ico">⚙️</div><h3>Configuration</h3><p>Environment variables, providers, adapters, and API-key handling.</p></a>
    <a class="card" href="contributing.html"><div class="ico">🤝</div><h3>Contributing</h3><p>How to set up, test, and propose changes.</p></a>
    <a class="card" href="deployment.html"><div class="ico">🚀</div><h3>Deployment</h3><p>Serving the app and publishing this site to GitHub Pages.</p></a>
  </div>
</section>

<section>
  <h2>A look at the product</h2>
  <p class="subtle">Screenshots are captured from synthetic seed data only. Real, privacy-safe product screenshots
  are added as the public demo matures.</p>
  <div class="shot-grid">
    <div class="shot">Subject dashboard — mastery &amp; progress</div>
    <div class="shot">Lesson workspace — audio, interactives, code</div>
    <div class="shot">Adaptive quiz — one question at a time</div>
    <div class="shot">Mobile (390px) — responsive lesson view</div>
  </div>
</section>
"""


def _rt_header(icon, title, badge_html, audience):
    return f"""
<p class="breadcrumb"><a href="quickstart.html">Quick Start</a> › Run locally</p>
<h1>{icon} {title} {badge_html}</h1>
<p class="lead">{audience}</p>
"""


# ── Runtime: Direct API key ──────────────────────────────────────────────────
RUN_API_KEY = _rt_header(
    "🔑", "Run with a direct API key",
    '<span class="badge badge-ok">ready</span>',
    "The simplest, fully standalone way to run Open Avocado. You bring a single LLM API key; the app calls the "
    "provider directly. Best for a solo learner or a developer evaluating the product with no extra infrastructure."
) + f"""
<h2>Who this is for</h2>
<ul>
  <li>You want the shortest path from clone to a working adaptive lesson.</li>
  <li>You have (or can create) an <strong>OpenAI</strong> or <strong>Google AI Studio</strong> API key.</li>
  <li>You do not want to run a local model or an external agent system.</li>
</ul>

<h2>Prerequisites</h2>
<ul>
  <li>Node.js 20–22 and <code>pnpm</code> (see <a href="quickstart.html">Quick Start</a> for the Node caveat).</li>
  <li>One LLM API key. Keys stay <strong>server-side</strong> — they are never shipped to the browser.</li>
</ul>

<h2>Configuration</h2>
<p>There are two ways to supply the key, and you can use either or both:</p>
<h3>1. In-app provider settings (per user, encrypted at rest)</h3>
<p>Open the app, go to <strong>Settings → Providers</strong>, and paste your key. It is encrypted with
<code>AVOCADOCORE_PROVIDER_KEY_SECRET</code> and stored in the <code>user_provider_configs</code> table — the raw key
is never returned by the API. This is the recommended path for multi-user installs.</p>
<h3>2. Environment variables (single-tenant / local)</h3>
<pre><code># Pick ONE provider key:
export OPENAI_API_KEY=sk-...            # OpenAI
# or
export GOOGLE_AI_STUDIO_API_KEY=...     # Google AI Studio (Gemini)
export AVOCADOCORE_DEFAULT_PROVIDER=google-ai-studio   # or openai

# Generate lessons synchronously in-process on subject creation / completion:
export AVOCADOCORE_COMPLETION_ADAPTER=local-queue
</code></pre>
<p>The same key powers immediate learner feedback (short-answer grading, code feedback, question rephrasing) and,
via the completion adapter, next-lesson generation. Audio narration works with no key at all: if
<code>OPENAI_API_KEY</code> is set it uses OpenAI TTS, otherwise it falls back to an offline
<code>espeak-ng</code> + <code>ffmpeg</code> voice so a lesson always has playable audio.</p>

<h2>Run it</h2>
<pre><code>pnpm install
mkdir -p data
pnpm db:migrate --seed          # first run only: creates + seeds a local SQLite DB
pnpm dev                        # http://localhost:3000
</code></pre>

<h2>Smoke test</h2>
<pre><code># App is up and the DB answers:
curl -s http://localhost:3000/api/health | head -c 300

# Provider is configured (per-user config, no raw key returned):
curl -s "http://localhost:3000/api/provider/config?user_id=1"
</code></pre>
<p>Then, in the browser: create a subject, wait for the initial assessment lesson to appear, complete it, and
confirm a follow-on lesson is generated.</p>

<h2>Common failure modes</h2>
<table>
<tr><th>Symptom</th><th>Cause &amp; fix</th></tr>
<tr><td>Lesson generation never starts</td><td><code>AVOCADOCORE_COMPLETION_ADAPTER</code> unset or <code>noop</code>. Set it to <code>local-queue</code> (or <code>agent-harness</code>).</td></tr>
<tr><td>Provider health shows <code>missing</code></td><td>No key configured for the default provider. Add it in Settings → Providers or via env.</td></tr>
<tr><td>429 / quota errors</td><td>Your API key is rate-limited or out of quota. Audio still works via the offline fallback; lesson generation waits for quota.</td></tr>
<tr><td>Rich lesson content is thin</td><td>Direct API-key mode uses a single model call rather than a full agent loop. For bespoke interactives and deep multi-step lessons, see the <a href="run-openclaw.html">OpenClaw</a> or <a href="run-hermes.html">Hermes</a> runtimes.</td></tr>
</table>

<h2>How it connects to lesson generation</h2>
<p>Open Avocado emits a <code>lesson.completed</code> (and <code>subject.created</code>) event with full learner
evidence. In this runtime the <code>local-queue</code> / <code>agent-harness</code> adapter turns that event into a
direct model call that returns validated lesson content, which is written back to the database. See
<a href="configuration.html">Configuration</a> and <a href="architecture.html">Architecture</a> for the adapter contract.</p>
"""


# ── Runtime: Gemmaclaw ───────────────────────────────────────────────────────
RUN_GEMMACLAW = _rt_header(
    "🦎", "Run with Gemmaclaw (local model)",
    '<span class="badge badge-partial">partial</span>',
    "Run Open Avocado against a local, OpenAI-compatible model gateway instead of a cloud API. "
    "Gemmaclaw is one such gateway: it stands up a local Gemma model and exposes an OpenAI-style endpoint. "
    "Any equivalent local server (Ollama, llama.cpp server, LM Studio, vLLM) works the same way."
) + f"""
<h2>Who this is for</h2>
<ul>
  <li>You want lessons and feedback generated by a <strong>local model</strong> — no cloud key, data stays on your machine.</li>
  <li>You already run, or can run, a local server that speaks the OpenAI chat-completions API.</li>
</ul>

<h2>Prerequisites</h2>
<ul>
  <li>A local model gateway reachable over HTTP that exposes an OpenAI-compatible <code>/v1</code> endpoint.</li>
  <li>Enough hardware to serve your chosen model at a usable speed.</li>
</ul>

<h2>Configuration</h2>
<p>Open Avocado talks to a local model through its <strong>OpenAI-compatible endpoint</strong> settings. Point the
feedback provider and the rephrase/generation endpoint at your gateway:</p>
<pre><code># Instant learner-facing feedback (grading, hints, code feedback) via a local model:
export AVOCADOCORE_FEEDBACK_PROVIDER=local
export AVOCADOCORE_FEEDBACK_BASE_URL=http://127.0.0.1:8080/v1
export AVOCADOCORE_FEEDBACK_MODEL=your-local-model

# Question rephrasing / lightweight generation endpoint (OpenAI-compatible):
export AVOCADOCORE_ACP_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions
export AVOCADOCORE_ACP_MODEL=your-local-model
# export AVOCADOCORE_ACP_TOKEN=...   # only if your gateway requires a bearer token

export AVOCADOCORE_COMPLETION_ADAPTER=local-queue
</code></pre>
<p>Replace the host, port, and model with your gateway's values. Nothing here assumes any particular machine — a
gateway on <code>127.0.0.1</code> is the common case for a single-workstation setup.</p>

<div class="note"><p><strong>Status:</strong> The instant-feedback and question-rephrase paths run against a local
OpenAI-compatible endpoint today. Full end-to-end <em>lesson authoring</em> from a single local model is best-effort:
smaller local models may not reliably produce the full validated lesson structure (bespoke interactives, synced
visuals, hidden tests). For the richest lessons, use a capable model or the agentic runtimes.</p></div>

<h2>Run it</h2>
<pre><code># 1. Start your local model gateway (example — substitute your own):
#    gemmaclaw serve      # or: ollama serve / llama-server / lms server start
# 2. Point Open Avocado at it (env above), then:
pnpm install
mkdir -p data
pnpm db:migrate --seed
pnpm dev
</code></pre>

<h2>Smoke test</h2>
<pre><code># Your gateway answers the OpenAI-style API:
curl -s http://127.0.0.1:8080/v1/models | head -c 300

# Open Avocado sees the local provider as healthy:
curl -s http://localhost:3000/api/health | head -c 300
</code></pre>

<h2>Common failure modes</h2>
<table>
<tr><th>Symptom</th><th>Cause &amp; fix</th></tr>
<tr><td>Connection refused</td><td>Gateway not running or wrong port. Confirm the <code>/v1/models</code> curl above works first.</td></tr>
<tr><td>Feedback falls back to deterministic text</td><td>Endpoint unreachable or returned an unexpected shape — Open Avocado degrades gracefully rather than blocking the learner. Check <code>AVOCADOCORE_ACP_ENDPOINT</code>.</td></tr>
<tr><td>Lessons look shallow / invalid</td><td>The local model can't satisfy the generator contract. Try a larger model, or use it only for feedback and generate lessons via <a href="run-openclaw.html">OpenClaw</a>.</td></tr>
</table>

<h2>How it connects to lesson generation</h2>
<p>The local gateway is just an OpenAI-compatible backend for the same feedback and generation code paths described in
<a href="configuration.html">Configuration</a>. Swapping cloud for local is a matter of changing the base URL and model —
no code changes.</p>
"""


# ── Runtime: OpenClaw ────────────────────────────────────────────────────────
RUN_OPENCLAW = _rt_header(
    "🤖", "Run with an external agent task runner (OpenClaw-style)",
    '<span class="badge badge-ok">ready</span>',
    "Hand lesson generation to a separate agent or task system instead of generating in-process. Open Avocado ships a "
    "task-runner completion adapter (<code>dora-task</code>) that turns each learning event into a fully-specified "
    "generation task for an external runner such as OpenClaw. Best when you want a full agent loop — research, code "
    "execution, bespoke artifact building, and separate QA — behind each lesson."
) + f"""
<h2>Who this is for</h2>
<ul>
  <li>You run an agent/task platform (for example OpenClaw) that can pick up a task, author a lesson, and report back.</li>
  <li>You want the highest-quality lessons: multi-step authoring, real interactives, and independent QA.</li>
</ul>

<h2>How it works</h2>
<p>On <code>subject.created</code>, <code>lesson.completed</code>, and <code>lesson.discarded</code>, the app builds a
generation task containing the full learner evidence (goals, mastery signals, tag/difficulty performance, diagnostics,
misconceptions, and history) plus the verbatim lesson quality bar. The task adapter dispatches that task to your
runner. Your runner authors and QAs the lesson, then writes the validated lesson content back into the database
(directly or through the app API). The app shows generation progress on the subject page while the task runs.</p>

<h2>Configuration</h2>
<pre><code>export AVOCADOCORE_COMPLETION_ADAPTER=dora-task

# EITHER post tasks to an HTTP endpoint your runner exposes:
export AVOCADOCORE_DORA_ENDPOINT=https://your-runner.example/tasks
# OR run a local task CLI the adapter can shell out to:
export AVOCADOCORE_DORA_TODO_CLI=/path/to/your-task-cli
export AVOCADOCORE_DORA_PROJECT=openavocado
</code></pre>
<p>The endpoint, CLI path, project, and any channel are yours to define — the adapter only needs a way to deliver the
task payload. Keep credentials for your runner in your own environment, never in this repository.</p>

<h2>Prerequisites</h2>
<ul>
  <li>An agent/task runner that can accept a task with a large acceptance-criteria payload and act on it.</li>
  <li>A way for the runner to write lesson content back (DB access or an authenticated app API call).</li>
  <li>The runner should read the lesson-authoring skill and meet the <a href="lesson-authoring.html">quality bar</a>.</li>
</ul>

<h2>Smoke test</h2>
<pre><code># Complete a lesson (or create a subject) in the UI, then confirm a job was dispatched:
curl -s "http://localhost:3000/api/subjects/1/jobs"    # shows pending/dispatched generation jobs
</code></pre>
<p>A healthy run shows a job move from <code>queued</code> → <code>dispatched</code>, your runner picking it up, and a
new lesson appearing when it reports back.</p>

<h2>Common failure modes</h2>
<table>
<tr><th>Symptom</th><th>Cause &amp; fix</th></tr>
<tr><td>Jobs stay <code>queued</code></td><td>Endpoint/CLI not reachable. Verify <code>AVOCADOCORE_DORA_ENDPOINT</code> or <code>AVOCADOCORE_DORA_TODO_CLI</code>.</td></tr>
<tr><td>Task dispatched but no lesson appears</td><td>Your runner hasn't written the lesson back or it failed validation. Check your runner's logs and the generator contract.</td></tr>
<tr><td>Lessons skip QA</td><td>QA is your runner's responsibility in this mode — enforce a separate reviewer before writing lessons back.</td></tr>
</table>

<h2>How it connects to lesson generation</h2>
<p>This runtime keeps the app thin and moves all authoring intelligence into your agent system. The contract between
them is the task payload plus the <a href="lesson-authoring.html">lesson-authoring standard</a>. Any runner that honours
that contract — OpenClaw or otherwise — is a valid backend.</p>
"""


# ── Runtime: Hermes ──────────────────────────────────────────────────────────
RUN_HERMES = _rt_header(
    "📜", "Run with a Hermes agent runtime",
    '<span class="badge badge-planned">planned</span>',
    "Wire a local Hermes agent (Nous Research) — or any local agentic runtime that can run tools and code — as the "
    "lesson generator through Open Avocado's agent-harness command adapter."
) + f"""
<div class="planned"><p><strong>Status: planned / not yet wired end-to-end.</strong> Open Avocado already exposes the
generic <em>command adapter</em> this runtime would use, but a turnkey Hermes integration is not shipped. This page
documents the intended interface and the current blocker honestly, so you can wire it yourself or track progress.</p></div>

<h2>Who this is for</h2>
<ul>
  <li>You run a local agentic runtime (Hermes Agent, or similar) that can take a prompt, use tools, execute code, and return a result.</li>
  <li>You want a fully local agent loop authoring lessons, without a hosted task platform.</li>
</ul>

<h2>The intended interface</h2>
<p>The <code>agent-harness</code> completion adapter shells out to a command you configure and hands it the generation
task on stdin (learner evidence + the lesson quality bar). The command is expected to author a validated lesson and
write it back, then exit non-zero on failure. Hermes would be wrapped by such a command.</p>
<pre><code># Planned configuration:
export AVOCADOCORE_COMPLETION_ADAPTER=agent-harness
export AVOCADOCORE_AGENT_HARNESS_COMMAND=/path/to/hermes-lesson-runner
export AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS=1800000
</code></pre>
<p>Your <code>hermes-lesson-runner</code> wrapper is the missing piece: it must translate the task payload into a Hermes
session, run the agent, and persist the resulting lesson through the database or app API.</p>

<h2>What already exists vs. what's missing</h2>
<table>
<tr><th>Piece</th><th>Status</th></tr>
<tr><td><code>agent-harness</code> command adapter + timeout</td><td><span class="badge badge-ok">ready</span> — the app can invoke an arbitrary command per event.</td></tr>
<tr><td>Task payload with full learner evidence + quality bar</td><td><span class="badge badge-ok">ready</span> — same payload every adapter receives.</td></tr>
<tr><td>Hermes wrapper (<code>hermes-lesson-runner</code>)</td><td><span class="badge badge-planned">planned</span> — you supply this; a reference wrapper is not yet shipped.</td></tr>
<tr><td>Validated write-back + QA loop for Hermes output</td><td><span class="badge badge-planned">planned</span> — reuse the generator contract and a separate reviewer.</td></tr>
</table>

<h2>Current blocker</h2>
<p>There is no shipped, tested Hermes wrapper, and small local agent models vary widely in their ability to satisfy the
full lesson contract (bespoke interactives, synced visuals, hidden tests, separate QA). Until a reference wrapper lands,
treat Hermes as a build-it-yourself integration on top of the ready <code>agent-harness</code> adapter. Contributions of
a reference wrapper are welcome — see <a href="contributing.html">Contributing</a>.</p>

<h2>How it will connect to lesson generation</h2>
<p>Identical contract to every other runtime: consume the task payload, meet the
<a href="lesson-authoring.html">lesson-authoring standard</a>, and write validated lesson content back. Only the
execution engine (a local Hermes agent) differs.</p>
"""


# ── Quick Start ──────────────────────────────────────────────────────────────
QUICKSTART = f"""
<h1>Quick Start</h1>
<p class="lead">Clone, seed a local database, and run Open Avocado in a few commands. Then choose how lessons are
generated on the <a href="#runtimes">local runtime</a> that fits you.</p>

<h2>Prerequisites</h2>
<ul>
  <li><strong>Node.js 20–22</strong> and <a href="https://pnpm.io" target="_blank" rel="noopener">pnpm</a>.</li>
  <li>A C toolchain for the native SQLite module (<code>better-sqlite3</code>) — usually already present.</li>
</ul>
<div class="warn"><p><strong>Node version caveat.</strong> The native SQLite addon is built for the Node version you
install with. Node 20–22 works out of the box. On <strong>Node 25+</strong>, Next.js server-side rendering collides with
a built-in <code>localStorage</code> global; start the app with
<code>NODE_OPTIONS="--localstorage-file=/tmp/oa-ls.json"</code> to supply a backing store. If you switch Node major
versions, reinstall so the native module is rebuilt.</p></div>

<h2>Install &amp; run</h2>
<pre><code>git clone {REPO}.git
cd openavocado
pnpm install

mkdir -p data
pnpm db:migrate --seed     # first run only — creates + seeds a local SQLite DB with synthetic data
pnpm dev                   # http://localhost:3000
</code></pre>
<p>Open <code>http://localhost:3000</code>. The seed data includes a synthetic learner and sample subjects so the UI
is populated immediately. Runtime data (the SQLite file, generated audio, learner answers) lives in gitignored folders
and is never committed.</p>

<h2>Everyday commands</h2>
<table>
<tr><th>Command</th><th>What it does</th></tr>
<tr><td><code>pnpm dev</code></td><td>Start the dev server (lazy compile, good for local work).</td></tr>
<tr><td><code>pnpm build</code> then <code>pnpm start</code></td><td>Production build + serve. Rebuild before restart.</td></tr>
<tr><td><code>pnpm db:migrate</code></td><td>Apply schema migrations (non-destructive — preserves existing data).</td></tr>
<tr><td><code>pnpm db:migrate --seed</code></td><td>Migrate <em>and</em> seed synthetic demo data (resets a throwaway DB).</td></tr>
<tr><td><code>pnpm test</code></td><td>Run the Vitest unit suite.</td></tr>
<tr><td><code>pnpm lint</code></td><td>Run ESLint.</td></tr>
<tr><td><code>pnpm exec tsc --noEmit</code></td><td>Type-check without emitting.</td></tr>
</table>

<h2>Verify it's healthy</h2>
<pre><code>curl -sf http://localhost:3000/ -o /dev/null &amp;&amp; echo "home OK"
curl -s  http://localhost:3000/api/health | head -c 300</code></pre>

<h2 id="runtimes">Choose a lesson-generation runtime</h2>
<p>The app runs the same regardless of how lessons are produced. Pick one:</p>
<div class="card-grid">
  <a class="card" href="run-api-key.html"><div class="ico">🔑</div><h3>Direct API key <span class="badge badge-ok">ready</span></h3><p>Simplest standalone path — bring one LLM key.</p></a>
  <a class="card" href="run-gemmaclaw.html"><div class="ico">🦎</div><h3>Gemmaclaw <span class="badge badge-partial">partial</span></h3><p>Local, OpenAI-compatible model gateway.</p></a>
  <a class="card" href="run-openclaw.html"><div class="ico">🤖</div><h3>OpenClaw <span class="badge badge-ok">ready</span></h3><p>External agent/task runner for full-quality lessons.</p></a>
  <a class="card" href="run-hermes.html"><div class="ico">📜</div><h3>Hermes <span class="badge badge-planned">planned</span></h3><p>Local Hermes agent via the command adapter.</p></a>
</div>

<p>Next: <a href="configuration.html">Configuration</a> for every environment variable, or
<a href="architecture.html">Architecture</a> for how the pieces fit together.</p>
"""


# ── Architecture ─────────────────────────────────────────────────────────────
ARCHITECTURE = """
<h1>Architecture</h1>
<p class="lead">Open Avocado is an evidence-driven learning loop. The app owns learners, subjects, lessons, and
mastery evidence; a pluggable generator produces the next lesson from that evidence.</p>

<h2>Stack</h2>
<ul>
  <li><strong>Next.js 15</strong> (App Router) + <strong>React 19</strong> + <strong>TypeScript</strong>.</li>
  <li><strong>SQLite</strong> via <code>better-sqlite3</code> — a multi-user schema is the source of truth for local data.</li>
  <li><strong>Tailwind CSS</strong> for styling; <strong>Pyodide</strong> (WASM) for in-browser Python.</li>
  <li><strong>Vitest</strong> for tests.</li>
</ul>

<h2>Core entities</h2>
<p>The data model is multi-user from day one and separates account identity from learner profile and progress:</p>
<table>
<tr><th>Entity</th><th>Role</th></tr>
<tr><td><code>users</code> → <code>learner_profiles</code></td><td>Account identity, then one or more learner profiles per account.</td></tr>
<tr><td><code>subjects</code></td><td>A thing to learn: title, description, editable goals, learner criteria, status.</td></tr>
<tr><td><code>diagnostics</code></td><td>Initial, teaching-free assessment that measures existing knowledge before lessons start.</td></tr>
<tr><td><code>lessons</code> → <code>lesson_activities</code></td><td>A generated lesson and its ordered sections (audio, interactive, reading, code, assessment).</td></tr>
<tr><td><code>attempts</code>, <code>assessment_results</code></td><td>Every learner interaction and per-question evidence (concept, difficulty, outcome).</td></tr>
<tr><td><code>mastery_signals</code>, <code>tags</code></td><td>Strengths, weak spots, misconceptions, review needs — tagged by concept and difficulty.</td></tr>
<tr><td><code>progress_points</code></td><td>Time-series for mastery, assessment scores, and trends.</td></tr>
<tr><td><code>generated_artifacts</code></td><td>Durable metadata for generated assets (e.g. audio: provider, voice, duration, hash, path).</td></tr>
<tr><td><code>next_lesson_jobs</code></td><td>Generation job queue + adapter metadata + state.</td></tr>
</table>

<h2>The learning loop</h2>
<ol class="steps">
  <li><strong>Define.</strong> A learner creates a subject with goals and criteria.</li>
  <li><strong>Diagnose.</strong> An initial assessment (no teaching) probes what they already know, recorded as mastery signals.</li>
  <li><strong>Generate.</strong> A lesson generator reads the evidence and authors the next lesson — audio, bespoke interactives, scaffolded code, and assessment.</li>
  <li><strong>Learn.</strong> The learner works through the lesson; every answer, submission, and quiz result becomes new evidence.</li>
  <li><strong>Complete.</strong> Completion is manual only — autosave never marks a lesson done. Completion emits an event.</li>
  <li><strong>Adapt.</strong> The event triggers the next lesson, mixing review (spaced repetition), repair (misconceptions), and forward progress.</li>
</ol>

<h2>Generation &amp; completion flow</h2>
<p>The app is decoupled from lesson authoring by a small adapter interface. On <code>subject.created</code>,
<code>lesson.completed</code>, and <code>lesson.discarded</code> it emits an event carrying full learner evidence
(goals, mastery/tag/difficulty performance, diagnostics, misconceptions, history). A configured
<strong>completion adapter</strong> handles that event:</p>
<table>
<tr><th>Adapter</th><th>Behaviour</th></tr>
<tr><td><code>noop</code></td><td>Record completion, no external action.</td></tr>
<tr><td><code>local-queue</code></td><td>Generate in-process / enqueue locally (used by the direct-key and local-model runtimes).</td></tr>
<tr><td><code>webhook</code></td><td>POST the event JSON to a configured endpoint.</td></tr>
<tr><td><code>dora-task</code></td><td>Dispatch a fully-specified generation task to an external agent/task runner.</td></tr>
<tr><td><code>agent-harness</code></td><td>Shell out to a configured command (used by the planned Hermes runtime).</td></tr>
</table>
<p>Whatever authors the lesson must satisfy the <strong>generator contract</strong>
(<code>validateGeneratedContent</code>): the required core sections are present and each activity validates, or the
lesson fails loudly rather than shipping a polished-but-empty page. See <a href="lesson-authoring.html">Lesson
Authoring</a> for the full standard and <a href="configuration.html">Configuration</a> for adapter env vars.</p>

<h2>Safety boundaries</h2>
<ul>
  <li><strong>Interactives are sandboxed.</strong> Learner-facing visuals are approved, DB-backed bespoke artifacts rendered in a sandboxed iframe; the widget expression evaluator is a no-eval parser with a math whitelist.</li>
  <li><strong>Media is locked down.</strong> Embeds are built only from a validated video id via a privacy-enhanced host, and degrade to a link.</li>
  <li><strong>Code answers aren't leaked.</strong> The generator rejects top-level answer fields; help comes through progressive hints and worked examples.</li>
  <li><strong>Completion is intentional.</strong> Only an explicit action completes a lesson; autosave never does.</li>
</ul>
"""


# ── Lesson Authoring ─────────────────────────────────────────────────────────
LESSON_AUTHORING = """
<h1>Lesson Authoring</h1>
<p class="lead">Any agent, skill, or runtime can author lessons for Open Avocado — as long as it meets the same
evidence-first quality bar and passes independent QA. This is the generic model; nothing here assumes a particular
task system.</p>

<h2>Evidence-first planning</h2>
<p>A good lesson is not a topic dump — it is the next move that closes the most important gap. Before authoring, the
generator reviews the learner's evidence: subject goals and criteria, prior mastery signals, tag + difficulty
performance, recent misconceptions, diagnostics, and completed/discarded history. It plans a lesson that mixes three
streams:</p>
<ul>
  <li><strong>Review</strong> — retrieve earlier material by mastery/weak-spot signals (spaced repetition).</li>
  <li><strong>Repair</strong> — target specific misconceptions surfaced by past answers.</li>
  <li><strong>Advance</strong> — move the curriculum forward only where the foundation is solid.</li>
</ul>
<p>Forward-looking probe questions stay in diagnostics and are never graded as if taught.</p>

<h2>The quality bar</h2>
<p>Every normal lesson keeps the same core sections, and each is validated:</p>
<ul>
  <li><strong>Audio</strong> — a substantial narrated walkthrough with a learner-visible transcript and a synced visual timeline whose cues cover the real audio duration.</li>
  <li><strong>Reading</strong> — first-class written teaching text (headings, definitions, worked examples, callouts), not a transcript dump.</li>
  <li><strong>Interactive</strong> — purpose-built, sandboxed visual artifacts designed for the exact concept, mobile-verified. Generic reskinnable widgets fail QA.</li>
  <li><strong>Code</strong> — scaffolded Python with guided steps, progressive hints, worked examples, and public + hidden tests. No exposed answer fields.</li>
  <li><strong>Assessment</strong> — adaptive multiple choice (one at a time, immediate grading, requeued misses) plus freeform questions with rubrics for LLM feedback.</li>
  <li><strong>Orientation</strong> — a knowledge-graph view placing the lesson in the subject.</li>
</ul>
<p>The machine-checked gate is <code>validateGeneratedContent</code>. A lesson that fails validation must be fixed,
not shipped. The full written standard lives in <code>docs/lesson-authoring-guide.md</code> in the repository.</p>

<h2>Multimedia &amp; interactivity expectations</h2>
<ul>
  <li>Visuals move: roughly one meaningful visual beat per few seconds of audio, refocusing a real lesson object (a matrix row, a pointer, a before/after state) — not static transcript cards.</li>
  <li>Every interactive is bespoke source stored in the database, built, QA-screenshotted at desktop and 390px mobile, approved, and rendered by slug. Precreated/registered widgets are not valid learner-facing visuals.</li>
  <li>Code exercises decompose into small helpers with visible checkpoints, then compose into the full solution.</li>
</ul>

<h2>Separate QA</h2>
<p>Generation and QA are <strong>different roles</strong> and must not collapse into one "generated" state. After a
lesson is authored, a <em>separate reviewer</em> opens it in a real browser, interacts with every activity, checks
desktop and 390px mobile, verifies audio actually plays and cue timing matches the real duration, and only then marks
it ready. "I generated this" is not evidence — a real lesson id, a 200-OK audio route, and desktop + mobile screenshots
are.</p>

<h2>Make it reusable</h2>
<p>The generator is exposed as a stable adapter interface (<code>LessonGeneratorAdapter</code>) that returns structured
lesson content: audio script, interactive specs, code exercise + tests, assessment, tags, and mastery targets. Any
runtime — a direct model call, a local model, or an external agent — implements the same contract, so lessons are
portable across backends.</p>
"""


# ── Configuration ────────────────────────────────────────────────────────────
CONFIGURATION = """
<h1>Configuration</h1>
<p class="lead">Open Avocado is configured through environment variables (all prefixed <code>AVOCADOCORE_</code> for
backward compatibility) and per-user provider settings in the app. Secrets stay server-side and out of git.</p>

<div class="note"><p>The <code>AVOCADOCORE_</code> prefix is an internal compatibility name kept so existing
deployments and service definitions keep working. The public product name is <strong>Open Avocado</strong>; the
environment prefix is intentionally left unchanged to avoid breaking configured installs.</p></div>

<h2>Core</h2>
<table>
<tr><th>Variable</th><th>Default</th><th>Purpose</th></tr>
<tr><td><code>AVOCADOCORE_DB_PATH</code></td><td><code>data/avocadocore.db</code></td><td>SQLite file path (directory auto-created).</td></tr>
<tr><td><code>AVOCADOCORE_RUNTIME_ROOT</code></td><td>repo <code>runtime_artifacts/</code></td><td>Where generated audio and artifacts are stored.</td></tr>
<tr><td><code>PORT</code></td><td><code>3000</code></td><td>Port for <code>next start</code>.</td></tr>
</table>

<h2>Authentication</h2>
<table>
<tr><th>Variable</th><th>Purpose</th></tr>
<tr><td><code>AVOCADOCORE_AUTH_REQUIRED</code></td><td><code>true</code> to require login for all pages/APIs. Leave <code>false</code> for a trusted local run.</td></tr>
<tr><td><code>AVOCADOCORE_SESSION_SECRET</code></td><td>Secret used to sign session tokens. Required when auth is on. Generate a 64-char hex string.</td></tr>
</table>
<p>When auth is enabled, prefer passkeys/WebAuthn; username/password includes rate limiting and lockout. Never commit
bootstrap credentials.</p>

<h2>Lesson generation</h2>
<table>
<tr><th>Variable</th><th>Purpose</th></tr>
<tr><td><code>AVOCADOCORE_COMPLETION_ADAPTER</code></td><td>How lessons are generated: <code>noop</code>, <code>local-queue</code>, <code>webhook</code>, <code>dora-task</code>, or <code>agent-harness</code>.</td></tr>
<tr><td><code>AVOCADOCORE_WEBHOOK_URL</code></td><td>Endpoint for the <code>webhook</code> adapter.</td></tr>
<tr><td><code>AVOCADOCORE_DORA_ENDPOINT</code> / <code>AVOCADOCORE_DORA_TODO_CLI</code> / <code>AVOCADOCORE_DORA_PROJECT</code></td><td>Delivery target for the external task-runner (<code>dora-task</code>) adapter.</td></tr>
<tr><td><code>AVOCADOCORE_AGENT_HARNESS_COMMAND</code> / <code>AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS</code></td><td>Command + timeout for the <code>agent-harness</code> adapter.</td></tr>
</table>

<h2>Providers &amp; API keys</h2>
<p>Two ways to supply model credentials — keys are always kept server-side:</p>
<ul>
  <li><strong>Per-user, in-app:</strong> Settings → Providers stores an encrypted key in <code>user_provider_configs</code>
  (encrypted with <code>AVOCADOCORE_PROVIDER_KEY_SECRET</code>); the raw key is never returned by the API.</li>
  <li><strong>Environment:</strong> <code>OPENAI_API_KEY</code>, <code>GOOGLE_AI_STUDIO_API_KEY</code>, and
  <code>AVOCADOCORE_DEFAULT_PROVIDER</code> for a single-tenant install.</li>
</ul>
<table>
<tr><th>Variable</th><th>Purpose</th></tr>
<tr><td><code>AVOCADOCORE_DEFAULT_PROVIDER</code></td><td>Default model provider (e.g. <code>openai</code>, <code>google-ai-studio</code>).</td></tr>
<tr><td><code>AVOCADOCORE_FEEDBACK_PROVIDER</code> / <code>_BASE_URL</code> / <code>_MODEL</code></td><td>Provider for instant learner feedback (grading, hints, code feedback) — point at a local OpenAI-compatible model for a fully local run.</td></tr>
<tr><td><code>AVOCADOCORE_ACP_ENDPOINT</code> / <code>_MODEL</code> / <code>_TOKEN</code></td><td>OpenAI-compatible endpoint for question rephrasing and lightweight generation.</td></tr>
<tr><td><code>OPENAI_API_KEY</code></td><td>Enables OpenAI TTS for narration; without it, an offline <code>espeak-ng</code> + <code>ffmpeg</code> voice is used.</td></tr>
</table>
<p>A copyable <code>.env.example</code> ships in the repository. Copy it to <code>.env.local</code> (gitignored) and
fill in what your runtime needs. See the four <a href="quickstart.html#runtimes">runtime guides</a> for exact recipes.</p>
"""


# ── Contributing ─────────────────────────────────────────────────────────────
CONTRIBUTING = f"""
<h1>Contributing</h1>
<p class="lead">Open Avocado is open source and welcomes contributions — from bug fixes to new lesson-generation
runtimes (a reference <a href="run-hermes.html">Hermes</a> wrapper is a great first big project).</p>

<h2>Set up</h2>
<pre><code>git clone {REPO}.git
cd openavocado
pnpm install
mkdir -p data
pnpm db:migrate --seed
pnpm dev</code></pre>
<p>See <a href="quickstart.html">Quick Start</a> for the Node version caveat.</p>

<h2>Before you open a PR</h2>
<ol class="steps">
  <li>Run the checks: <code>pnpm test</code>, <code>pnpm lint</code>, and <code>pnpm exec tsc --noEmit</code>.</li>
  <li>For UI changes, verify in a real browser at desktop and 390px mobile widths.</li>
  <li>Keep runtime data out of git — SQLite files, generated audio, learner answers, <code>.env*</code>, and local config are all gitignored. Never commit secrets.</li>
  <li>Match the existing code style; add or update tests for behaviour you change.</li>
</ol>

<h2>Ground rules</h2>
<ul>
  <li><strong>Privacy first.</strong> No personal data, credentials, private hostnames, or client/family data in the repo — in code, tests, docs, or fixtures. Use clearly synthetic sample data.</li>
  <li><strong>Fail loudly.</strong> Validators reject bad lesson content rather than shipping a broken page — keep it that way.</li>
  <li><strong>Portability.</strong> New features should work in the default portable flow, not only in one private deployment.</li>
</ul>

<h2>Good first contributions</h2>
<ul>
  <li>A reference wrapper for the <a href="run-hermes.html">Hermes</a> / <code>agent-harness</code> runtime.</li>
  <li>Additional lesson-generator adapters (new providers or task systems).</li>
  <li>Docs and example improvements on this site.</li>
</ul>
<p>Open an issue to discuss larger changes first: <a href="{REPO}/issues">{REPO}/issues</a>.</p>
"""


# ── Deployment ───────────────────────────────────────────────────────────────
DEPLOYMENT = f"""
<h1>Deployment</h1>
<p class="lead">Two independent things ship here: the <strong>app</strong> (a Next.js server with a SQLite database)
and this <strong>documentation site</strong> (static files on GitHub Pages).</p>

<h2>The app</h2>
<p>The app needs a Node runtime and a writable data directory. A production run is a standard Next.js build + serve:</p>
<pre><code>pnpm install --frozen-lockfile
pnpm build
AVOCADOCORE_AUTH_REQUIRED=true \\
AVOCADOCORE_SESSION_SECRET=&lt;64-hex&gt; \\
pnpm start        # serves on $PORT (default 3000)</code></pre>
<ul>
  <li>Run behind a supervisor (systemd, pm2, a container) that restarts on failure and rebuilds before restart.</li>
  <li>Use a <strong>clean production database</strong>, separate from any local/dev DB. Persist <code>data/</code> and
  <code>runtime_artifacts/</code> outside the image.</li>
  <li>Keep all secrets in the environment, never in git. Put a reverse proxy in front for HTTPS.</li>
</ul>
<p>A generic, privacy-safe pattern for keeping a supervised local demo online (service + safe update + health check)
is described in <code>docs/local-demo.md</code>.</p>

<h2>This site → GitHub Pages</h2>
<p>The site is plain static HTML/CSS under <code>site/</code> — no bundler. It is regenerated with a small script and
published by a GitHub Actions workflow that uploads <code>site/</code> as a Pages artifact.</p>
<pre><code># Regenerate the static site after editing content:
python3 scripts/site/generate-site.py

# Preview locally:
python3 -m http.server -d site 8000   # http://localhost:8000
</code></pre>
<p>The workflow (<code>.github/workflows/deploy-site.yml</code>) runs on pushes to the default branch that touch
<code>site/**</code> or the generator, and on manual dispatch. To turn the live site on, in the repository:
<strong>Settings → Pages → Build and deployment → Source: GitHub Actions</strong>. The expected live URL is:</p>
<pre><code>{PAGES}</code></pre>
<p>Because the site uses relative links, it works correctly under the <code>/openavocado/</code> Pages subpath with no
extra configuration. Set the repository homepage to that URL once the first deploy succeeds.</p>
"""


# ── Privacy ──────────────────────────────────────────────────────────────────
PRIVACY = """
<h1>Privacy &amp; Data Boundaries</h1>
<p class="lead">Open Avocado is built so that a learner's data and an operator's secrets never end up in the
repository. This is a hard boundary, enforced by <code>.gitignore</code> and code review.</p>

<h2>What is safe to commit</h2>
<ul>
  <li>Application and adapter code, SQLite schema and migrations.</li>
  <li>Generic prompt templates and the lesson-generator contract.</li>
  <li>Tests and clearly synthetic sample/seed data.</li>
  <li>Documentation and this static site.</li>
</ul>

<h2>What must never be committed</h2>
<ul>
  <li>Learner profiles, answers, generated lessons, audio, uploads, or assessment history.</li>
  <li>SQLite database files and anything under <code>runtime_artifacts/</code>.</li>
  <li>API keys, session secrets, <code>.env*</code> files, or provider credentials.</li>
  <li>Private hostnames, deployment IPs, or operator-specific configuration.</li>
</ul>

<h2>How secrets are handled at runtime</h2>
<ul>
  <li><strong>Keys stay server-side.</strong> Browser code never contains API keys. Per-user keys are encrypted at rest
  and never returned by the API in raw form.</li>
  <li><strong>Auth.</strong> Hosted runs require authentication with rate limiting and lockout; passkeys/WebAuthn are
  preferred over passwords.</li>
  <li><strong>Media &amp; interactives are sandboxed</strong> and built only from validated inputs.</li>
</ul>

<h2>Seed &amp; screenshots</h2>
<p>The seed produces synthetic, non-personal demo data so the app is usable immediately without exposing anyone's real
learning history. Documentation screenshots are captured from that synthetic data only.</p>

<div class="note"><p>Deploying a public instance? Keep a clean production database separate from any personal/dev
database, enable authentication, and keep all provider keys in the server environment.</p></div>
"""


# ── Registry consumed by generate-site.py ────────────────────────────────────
# fname -> (nav_active, <title>, <meta desc>, body_html)
PAGE_BODIES = {
    "quickstart.html": ("quickstart.html", "Quick Start — Open Avocado",
        "Install Open Avocado, seed a local SQLite database, run the app, and choose a lesson-generation runtime.",
        QUICKSTART),
    "architecture.html": ("architecture.html", "Architecture — Open Avocado",
        "Core entities, the evidence-driven learning loop, and the generation/completion adapter flow.",
        ARCHITECTURE),
    "lesson-authoring.html": ("lesson-authoring.html", "Lesson Authoring — Open Avocado",
        "The generic agent/skill model for authoring lessons: evidence-first planning, quality bar, and separate QA.",
        LESSON_AUTHORING),
    "configuration.html": ("configuration.html", "Configuration — Open Avocado",
        "Environment variables, completion adapters, providers, and server-side API-key handling.",
        CONFIGURATION),
    "contributing.html": ("contributing.html", "Contributing — Open Avocado",
        "How to set up, test, and propose changes to Open Avocado.",
        CONTRIBUTING),
    "deployment.html": ("deployment.html", "Deployment — Open Avocado",
        "Serve the Next.js app and publish this documentation site to GitHub Pages.",
        DEPLOYMENT),
    "privacy.html": ("privacy.html", "Privacy & Data Boundaries — Open Avocado",
        "The privacy boundary between shareable code and gitignored runtime data and secrets.",
        PRIVACY),
    "run-api-key.html": ("quickstart.html", "Run with a direct API key — Open Avocado",
        "The simplest standalone runtime: bring one OpenAI or Google AI Studio key.",
        RUN_API_KEY),
    "run-gemmaclaw.html": ("quickstart.html", "Run with Gemmaclaw (local model) — Open Avocado",
        "Run Open Avocado against a local, OpenAI-compatible Gemma model gateway.",
        RUN_GEMMACLAW),
    "run-openclaw.html": ("quickstart.html", "Run with an external agent task runner — Open Avocado",
        "Hand lesson generation to an external agent/task runner such as OpenClaw via the task adapter.",
        RUN_OPENCLAW),
    "run-hermes.html": ("quickstart.html", "Run with a Hermes agent runtime (planned) — Open Avocado",
        "Wire a local Hermes agent as the lesson generator through the agent-harness command adapter.",
        RUN_HERMES),
}
