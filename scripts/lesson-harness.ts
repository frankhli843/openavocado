#!/usr/bin/env tsx
/**
 * AvocadoCore Agentic Lesson-Generation Harness
 *
 * Invoked by the agent-harness adapter when a lesson event fires.
 * Receives a JSON payload via stdin describing the event, generates a real
 * lesson using the configured provider (Google AI Studio / Gemini by default),
 * and outputs a JSON result line on stdout.
 *
 * Usage (set AVOCADOCORE_AGENT_HARNESS_COMMAND in .env):
 *   AVOCADOCORE_AGENT_HARNESS_COMMAND="tsx /path/to/scripts/lesson-harness.ts"
 *
 * Environment:
 *   AVOCADOCORE_DB_PATH                       — SQLite DB path (same as app)
 *   GOOGLE_AI_STUDIO_API_KEY                  — Gemini API key (server-side only, never logged)
 *   GOOGLE_AI_STUDIO_MODEL                    — model name (default: gemma-4-26b-a4b-it)
 *   AVOCADOCORE_AGENT_HARNESS_FALLBACK_MODEL  — fallback model after all retries fail (e.g. gemini-2.0-flash)
 *   AVOCADOCORE_FEEDBACK_PROVIDER             — secondary provider config (google = Gemini)
 *   AVOCADOCORE_LOCAL_QUEUE_AUDIO             — "skip" to skip audio generation (testing)
 *
 * Output contract (last JSON-looking line on stdout):
 *   { ok: true, ref: "agent-harness-lesson-N", lesson_id: N }
 *   { ok: false, error: "..." }
 *
 * The harness updates next_lesson_jobs.harness_stage and progress_events in
 * real-time so the subject page can show granular status while it runs.
 */

import { getDb, closeDb } from "../src/db/connection";
import { generateInitialAssessment } from "../src/lib/lesson-generator/initial-assessment";
import { generateLessonAudio } from "../src/lib/audio/generate-lesson-audio";
import { COMPREHENSIVE_LESSON_PLAN_TEMPLATE } from "../src/lib/lesson-generator/plan-template";
import type Database from "better-sqlite3";
import type {
  SubjectCreatedEvent,
  LessonCompletedEvent,
  LessonDiscardedEvent,
} from "../src/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HarnessPayload {
  event_type: string;
  event: SubjectCreatedEvent | LessonCompletedEvent | LessonDiscardedEvent;
  provider: string;
  provider_status: { status: string; model?: string } | null;
  contract: {
    expected_output: string;
    chrome_mcp_required: boolean;
    local_queue_fallback_allowed: boolean;
  };
}

interface HarnessResult {
  ok: boolean;
  ref?: string;
  lesson_id?: number;
  error?: string;
  provider_used?: string;
  stage_reached?: string;
}

interface GeminiLessonDraft {
  title: string;
  description: string;
  audio_script: string;
  orientation_visual?: Record<string, unknown>;
  reading_intro: string;
  reading_blocks: ReadingBlock[];
  reading_summary: string;
  lesson_parts?: LessonPartDraft[];
  final_code?: PracticeCodeDraft;
  assessment_questions: AssessmentQuestion[];
  quiz_questions: QuizQuestion[];
  next_lesson_diagnostics: DiagnosticQuestion[];
  planning_rationale: string;
  comprehensive_lesson_plan: string;
  concept_tags: string[];
}

interface ReadingBlock {
  type: "heading" | "paragraph" | "definition" | "example" | "callout" | "list";
  text?: string;
  term?: string;
  definition?: string;
  title?: string;
  body?: string;
  tone?: string;
  ordered?: boolean;
  items?: string[];
}

interface PracticeCodeDraft {
  prompt: string;
  walkthrough?: {
    title?: string;
    steps: Array<{
      title: string;
      detail: string;
      input?: string;
      output?: string;
      visual?: string;
    }>;
  };
  io_examples?: Array<{
    label: string;
    input: string;
    expected_output: string;
    explanation?: string;
  }>;
  visualization?: {
    title: string;
    description?: string;
    items: Array<{
      label: string;
      value: string;
      role?: "input" | "process" | "output";
      note?: string;
    }>;
  };
  starter_code?: string;
  worked_examples: Array<{
    label: "basic" | "concise";
    title?: string;
    explanation?: string;
    code: string;
  }>;
  constraints?: string[];
  guided_steps?: string[];
  hints?: Array<{ level: number; text: string }>;
  tests: Array<{ id: string; description: string; assert: string }>;
  hidden_tests?: Array<{ id: string; description: string; assert: string }>;
}

interface LessonPartDraft {
  part_id: string;
  title: string;
  reading: {
    intro?: string;
    blocks: ReadingBlock[];
    summary?: string;
  };
  audio: {
    script: string;
    transcript?: string;
    duration_hint?: number;
    synced_visual: Record<string, unknown>;
  };
  interactive: Record<string, unknown>;
  code: PracticeCodeDraft;
  practice: {
    written_feedback?: "llm_judge";
    pass_threshold?: number;
    questions: Array<Record<string, unknown>>;
  };
}

interface AssessmentQuestion {
  id: string;
  text: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard";
  actual_answer?: string;
  rubric?: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard";
  grounding_required?: boolean;
  learning_scope?: "taught" | "review";
  support_ref?: string;
}

interface DiagnosticQuestion {
  id: string;
  prompt: string;
  hint: string;
}

// ─── Progress tracking ────────────────────────────────────────────────────────

function updateJobProgress(
  db: Database.Database,
  subjectId: number,
  triggerEvent: string,
  stage: string,
  message: string
): void {
  try {
    const job = db
      .prepare(
        `SELECT id, progress_events FROM next_lesson_jobs
         WHERE subject_id = ? AND trigger_event = ? AND status = 'dispatched'
         ORDER BY id DESC LIMIT 1`
      )
      .get(subjectId, triggerEvent) as { id: number; progress_events: string | null } | undefined;

    if (!job) return;

    const events: Array<{ ts: string; stage: string; message: string }> = [];
    if (job.progress_events) {
      try {
        const parsed = JSON.parse(job.progress_events);
        if (Array.isArray(parsed)) events.push(...parsed);
      } catch { /* ignore */ }
    }
    events.push({ ts: new Date().toISOString(), stage, message });

    db.prepare(
      `UPDATE next_lesson_jobs
       SET harness_stage = ?, progress_events = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(stage, JSON.stringify(events), job.id);
  } catch {
    // Progress updates are best-effort — never fail the harness over them
  }
}

// ─── Google AI Studio / Gemini call ──────────────────────────────────────────

function getGeminiKey(): string {
  return (process.env.GOOGLE_AI_STUDIO_API_KEY ?? "").trim();
}

function getGeminiModel(): string {
  return (
    process.env.GOOGLE_AI_STUDIO_MODEL ??
    process.env.AVOCADOCORE_FEEDBACK_MODEL ??
    "gemma-4-26b-a4b-it"
  );
}

function getFallbackModel(): string | null {
  return process.env.AVOCADOCORE_AGENT_HARNESS_FALLBACK_MODEL?.trim() || null;
}

function getGeneratorId(modelOverride?: string): string {
  return `agent-harness/google-ai-studio/${modelOverride ?? getGeminiModel()}/v1`;
}

async function callGemini(prompt: string, modelOverride?: string): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error("GOOGLE_AI_STUDIO_API_KEY is not set");

  const model = modelOverride ?? getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 32768,
      temperature: 0.7,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Never include the API key in error messages
    const safe = text.replace(key, "[redacted]").slice(0, 400);
    throw new Error(`Gemini HTTP ${res.status}: ${safe}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    const safe = data.error.message.replace(key, "[redacted]").slice(0, 300);
    throw new Error(`Gemini API error: ${safe}`);
  }

  const text =
    data.candidates?.[0]?.content?.parts?.find((part) => part.text && !part.thought)?.text ??
    data.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text ??
    "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

function incrementRetryCount(
  db: Database.Database,
  subjectId: number,
  triggerEvent: string
): void {
  try {
    db.prepare(
      `UPDATE next_lesson_jobs
       SET retry_count = COALESCE(retry_count, 0) + 1, updated_at = datetime('now')
       WHERE subject_id = ? AND trigger_event = ? AND status = 'dispatched'`
    ).run(subjectId, triggerEvent);
  } catch {
    // Best-effort — never fail the harness over a retry counter update
  }
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  // Retry on HTTP 500 (server-side capacity/transient) or AbortSignal timeout
  return (
    msg.includes("Gemini HTTP 500") ||
    msg.includes("AbortError") ||
    err.name === "AbortError" ||
    msg.includes("The operation was aborted")
  );
}

async function callGeminiWithRetry(
  db: Database.Database,
  subjectId: number,
  triggerEvent: string,
  prompt: string
): Promise<{ text: string; modelUsed: string }> {
  const primaryModel = getGeminiModel();
  const fallbackModel = getFallbackModel();
  const backoffMs = [10_000, 30_000]; // wait before retry 1 and retry 2
  const maxRetries = backoffMs.length;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = backoffMs[attempt - 1];
      incrementRetryCount(db, subjectId, triggerEvent);
      updateJobProgress(
        db,
        subjectId,
        triggerEvent,
        "retrying",
        `Retry ${attempt}/${maxRetries} after ${waitMs / 1000}s (previous error: ${lastError?.message?.slice(0, 120) ?? "unknown"})`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    try {
      const text = await callGemini(prompt, primaryModel);
      return { text, modelUsed: primaryModel };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isRetryableError(err)) {
        // Non-retryable error (e.g. auth, parse error) — fail fast
        throw lastError;
      }
      console.error(
        `[lesson-harness] Gemini attempt ${attempt + 1} failed (retryable): ${lastError.message}`
      );
    }
  }

  // All primary model retries exhausted — try fallback model if configured
  if (fallbackModel) {
    updateJobProgress(
      db,
      subjectId,
      triggerEvent,
      "retrying",
      `Switching to fallback model "${fallbackModel}" after ${maxRetries + 1} failed attempts with primary model`
    );
    console.error(
      `[lesson-harness] All retries exhausted for primary model "${primaryModel}". Trying fallback "${fallbackModel}".`
    );
    try {
      const text = await callGemini(prompt, fallbackModel);
      return { text, modelUsed: fallbackModel };
    } catch (fbErr) {
      const fbMsg = fbErr instanceof Error ? fbErr.message : String(fbErr);
      throw new Error(
        `Primary model "${primaryModel}" failed after ${maxRetries + 1} attempts and fallback "${fallbackModel}" also failed: ${fbMsg}`
      );
    }
  }

  // No fallback configured — throw the last error
  throw new Error(
    `Gemini call failed after ${maxRetries + 1} attempts (no fallback configured): ${lastError?.message ?? "unknown error"}`
  );
}

// ─── Learner context query ────────────────────────────────────────────────────

function buildLearnerContext(
  db: Database.Database,
  subjectId: number,
  learnerId: number
): string {
  const subject = db
    .prepare("SELECT title, description, goals, criteria, current_level FROM subjects WHERE id = ?")
    .get(subjectId) as {
      title: string;
      description: string | null;
      goals: string | null;
      criteria: string | null;
      current_level: string;
    } | undefined;

  if (!subject) return "(subject not found)";

  const completedLessons = db
    .prepare(
      `SELECT title, description, sequence_number
       FROM lessons WHERE subject_id = ? AND status = 'completed'
       ORDER BY sequence_number ASC LIMIT 10`
    )
    .all(subjectId) as Array<{ title: string; description: string | null; sequence_number: number }>;

  const masterySignals = db
    .prepare(
      `SELECT ms.signal_type, ms.confidence, ms.difficulty, COALESCE(t.name, ms.concept) AS concept
       FROM mastery_signals ms
       LEFT JOIN tags t ON t.id = ms.tag_id
       WHERE ms.learner_id = ? AND ms.subject_id = ?
       ORDER BY ms.created_at DESC LIMIT 20`
    )
    .all(learnerId, subjectId) as Array<{
      signal_type: string;
      confidence: number;
      difficulty: string | null;
      concept: string;
    }>;

  const recentAssessments = db
    .prepare(
      `SELECT ar.question_id, ar.outcome, ar.question_type, ar.concept, ar.difficulty
       FROM assessment_results ar
       WHERE ar.learner_id = ? AND ar.subject_id = ?
       ORDER BY ar.created_at DESC LIMIT 15`
    )
    .all(learnerId, subjectId) as Array<{
      question_id: string;
      outcome: string;
      question_type: string;
      concept: string | null;
      difficulty: string | null;
    }>;

  const workpad = db
    .prepare("SELECT content FROM subject_workpads WHERE subject_id = ? AND learner_id = ? ORDER BY updated_at DESC LIMIT 1")
    .get(subjectId, learnerId) as { content: string } | undefined;

  const nextSeq = db
    .prepare("SELECT COALESCE(MAX(sequence_number), -1) + 1 AS next_seq FROM lessons WHERE subject_id = ?")
    .get(subjectId) as { next_seq: number };

  const lines: string[] = [
    `SUBJECT: ${subject.title}`,
    subject.description ? `Description: ${subject.description}` : "",
    subject.goals ? `Goals: ${subject.goals}` : "",
    subject.criteria ? `Success criteria: ${subject.criteria}` : "",
    `Current level: ${subject.current_level}`,
    `Next lesson sequence number: ${nextSeq.next_seq}`,
    "",
    `COMPLETED LESSONS (${completedLessons.length}):`,
    ...completedLessons.map(
      (l) => `  [${l.sequence_number}] ${l.title}`
    ),
    "",
    `MASTERY SIGNALS (recent, ${masterySignals.length}):`,
    ...masterySignals.slice(0, 10).map(
      (m) =>
        `  ${m.signal_type} | concept: ${m.concept} | confidence: ${m.confidence} | difficulty: ${m.difficulty ?? "unset"}`
    ),
    "",
    `RECENT ASSESSMENT EVIDENCE (${recentAssessments.length}):`,
    ...recentAssessments.slice(0, 8).map(
      (a) =>
        `  [${a.outcome}] ${a.question_id.slice(0, 120)} (concept: ${a.concept ?? "?"}, difficulty: ${a.difficulty ?? "?"})`
    ),
    "",
    workpad ? `WORKPAD (current evolving plan):\n${workpad.content.slice(0, 6000)}` : "(no workpad yet)",
  ];

  return lines.filter((l) => l !== "").join("\n");
}

// ─── Gemini lesson generation prompt ─────────────────────────────────────────

function buildLessonPrompt(
  context: string,
  eventType: string,
  discardedLessonTitle?: string
): string {
  const trigger =
    eventType === "lesson.discarded"
      ? `The previous lesson "${discardedLessonTitle ?? "unknown"}" was discarded. Generate a replacement that takes a different approach.`
      : "Generate the next adaptive teaching lesson based on the learner evidence above.";

  return `You are an expert adaptive learning designer for AvocadoCore, an adaptive learning system.

LEARNER CONTEXT:
${context}

TASK:
${trigger}

Generate a high-quality adaptive lesson for this learner. The lesson must:
- Be pedagogically grounded in the learner's actual evidence (mastery signals, assessment results, completed lessons)
- Include a clear planning_rationale explaining WHY this lesson is the right next step NOW
- Before authoring the lesson, update the evolving comprehensive subject plan using the required template below. The JSON response must include that full plan in comprehensive_lesson_plan, not only the short planning_rationale.
- Start from a concept audit: list the major nouns and mechanisms the lesson will rely on, treat a concept as known only when assessment answers, mastery signals, completed lesson content, or profile criteria prove it, and define every unproven prerequisite before using it
- Have a rich top-level overview audio script of at least 2,700 words, targeting at least 15 minutes of spoken audio with margin. This overview is the learner's first pass through the lesson and must be written as a two-host podcast transcript with clear male/female speaker labels such as "Leo:" and "Maya:". Use a calm, conversational long-form interview / NotebookLM-style back-and-forth without imitating any specific living person. One host should ask natural learner-like questions and the other should unpack mechanisms in plain language. Start high-level, then revisit the same lesson through multiple perspectives including analogy/metaphor, concrete example, mechanism trace, implementation intuition, common misconception, failure mode, and final synthesis. The script must sound like the hosts are speaking directly to the learner, not like instructions to an author or narrator.
- Include 8-12 substantive reading blocks that teach the concept clearly with definitions, worked examples, mechanism traces, and explicit preview/deeper-later language when needed
- Include 2-3 open-ended assessment questions that check understanding
- Include mixed practice beyond plain multiple choice: select-one, select-all
  with some correct, select-all with none correct, ordering, and written
  responses with an expected answer and rubric for immediate LLM grading
- Include a small executable code exercise for each lesson sub-part plus one
  final integrator code exercise. Every code exercise must include full
  worked_examples for both a basic/readable implementation and a best concise
  implementation so phone mode can show complete code clearly.
- Include 8-10 final multiple-choice quiz questions grounded in taught material
- Include 2 next-lesson diagnostic questions (look-ahead probes, NOT graded)
- Be specific to this subject and learner — avoid generic filler content

${COMPREHENSIVE_LESSON_PLAN_TEMPLATE}

Non-negotiable lesson-depth rules:
- VISUALS MUST BE DB-BACKED BESPOKE ARTIFACTS. Do not author lesson visuals as registered widgets, generic declarative widgets, local panel JSON, or any precreated component. The production path is: generate a self-contained React visual artifact for this exact lesson/audio segment, store it in visual_artifacts, build it, open the sandbox URL with Chrome MCP, take desktop and mobile screenshots, record QA evidence, approve it, then reference it from lesson JSON as widget_type "bespoke-artifact" with params.artifact_slug. For audio-synced visuals, also store that approved slug in orientation_visual.artifact_slug or audio.synced_visual.artifact_slug; cue metadata coordinates the artifact but does not replace generated component code.
- EVERY AUDIO SEGMENT NEEDS A TRANSCRIPT AND TIMED VISUAL SCENE. Treat audio_script as a learner-visible transcript. For lesson parts, include a synced visual plan whose cues cover the audio duration and change the scene as playback advances. The cues must show what the section receives, what changes during the narration, and what is passed forward.
- TOP-LEVEL OVERVIEW AUDIO MINIMUM. The first audio_script is not a short intro. It must be at least 2,700 words and must target 15+ minutes of substantive teaching. It must be a two-host podcast transcript with male/female turns, for example "Leo:" and "Maya:". Use a calm, conversational long-form interview / NotebookLM-style back-and-forth without imitating any specific living person. It should begin with a high-level map, then gradually descend into details, repeat the core ideas from several perspectives, use metaphors/analogies, define every major term, and explain why each step matters. For dense subjects, use a "spiral" structure: map -> analogy -> tiny worked example -> mechanism -> implementation intuition -> misconception/failure mode -> recap. Do not compress this to a table of contents. Do not leak authoring instructions or meta-planning language into the script: avoid phrases like "the learner should", "the lesson should", "the overview should", "the audio should", or "the transcript should". Speak directly to the learner with "you", "we", and natural host questions.
- SPOKEN FORMULAS MUST BE AUDIO-FRIENDLY. Keep formal formulas in reading blocks with LaTeX, but in audio describe notation in words before explaining meaning. For example, say "Q times K transpose, divided by the square root of d sub k" rather than reading raw text like "QK^T / √d_k".
- FORMULA-SYNCED VISUALS. When audio explains a formula, the synced visual must include a formula panel (kind "formula") that displays the formula and highlights the specific symbols or subexpressions named by the current cue. For attention, show the expression and highlight Q, K, the score matrix, softmax, and V as each is discussed. Do not narrate a formula while showing only an unrelated pipeline or generic cards.
- KATEX-COMPATIBLE FORMULAS ONLY. Formula strings must be clean KaTeX-compatible LaTeX. Do not include presentation wrappers such as \\colorbox, \\fcolorbox, \\bbox, raw HTML, or CSS in formula values. Put highlighting intent in synced visual active_elements; the renderer applies safe highlighting.
- EVERY AUDIO SYNCED VISUAL NEEDS AN APPROVED ARTIFACT. Do not rely on registered widgets, regex-selected scenes, repeated receive/transform/pass cards, or generated panel JSON. Each orientation_visual and audio.synced_visual must include a unique artifact_slug pointing to an approved DB-backed bespoke React artifact plus cue timing metadata. The artifact renders the moving visualization; the cue timeline only tells it which audio state is active.
- AUDIO + INTERACTIVE SIDE-BY-SIDE FOR ORIENTATION. The top-level audio activity must include orientation_visual using the same timed cue scene pattern as lesson parts, and every lesson_part audio segment must include audio.synced_visual. The learner should see the paired visual beside the audio on desktop and immediately below it on mobile. Do not make the learner listen to a long orientation before they can see the moving object, pipeline, matrix, or state transition being described.
- FORMAL MATH REQUIREMENT. Whenever you use mathematical notation or formulas, include a reading block of type "formula" with these EXACT field names: "type" must be "formula", "latex" must be a LaTeX string, "plain_english" must be a clear English explanation of at least 20 characters, and "variables" must be an array of objects where each object has "symbol" (the LaTeX symbol string), "meaning" (what it represents in plain English, at least 8 characters), and an optional "shape" field (a string describing matrix dimension or data type). Do NOT use "variable_definitions", "description", or "unit" as field names. Example: { "type": "formula", "latex": "y = Wx + b", "plain_english": "A linear transformation applies a weight matrix W and bias b to input x to produce output y.", "variables": [{ "symbol": "W", "meaning": "weight matrix of learned parameters", "shape": "d_out × d_in" }, { "symbol": "x", "meaning": "input vector", "shape": "d_in" }, { "symbol": "b", "meaning": "bias vector", "shape": "d_out" }, { "symbol": "y", "meaning": "output vector after linear transformation", "shape": "d_out" }] }
- AUDIO-ADJACENT VISUALS MUST BE SCOPED TO THE CURRENT AUDIO. The visual beside an audio player should show only the object, stage, state transition, formula, or tiny example that the audio is currently narrating, with minimal before/after handoff context. The step rail may show nearby beats, but the main synced visual should show only the currently relevant generated panel, not every panel in the scene at once. Do not put a broad whole-lesson map, all-step simulator, or later exploratory interactive beside the audio if most of it is unrelated to the spoken segment. Use a dedicated focused orientation artifact or timed synced scene for the audio, then place the broader exploratory interactive later in its own lesson activity.
- USE A MANIM / 3BLUE1BROWN SCENE MINDSET. Build visuals as staged objects and transformations, not text cards. Define positions, tables, matrices, arrows, moving focus, camera/framing emphasis, before/after states, and visible consequences. Multiple coordinated components are preferred when they clarify the concept.
- DEFINE MAJOR NOUNS UNLESS EVIDENCE PROVES THEY ARE KNOWN. Do not assume the learner understands terms such as transformer block, attention, MLP, residual stream, normalization, logits, loss, gradient, KV cache, matrix, vector, tensor, prior, likelihood, or cache from a title or curriculum outline alone.
- MECHANISM-LEVEL DETAIL, NOT COMPRESSED SUMMARIES. A sentence like "attention mixes context, the MLP transforms each token, residuals keep signal, and the output head produces logits" is an outline, not teaching. Expand dense mechanisms into a concrete micro-trace with tiny labeled dimensions and before/after state.
- ADJACENT VISUALS FOR DENSE MECHANISMS. Every mechanism-heavy paragraph should be paired with a diagram or interactive that uses the same nouns as the text. For transformer content, show token positions, hidden-state rows, attention weights or context update, MLP update, normalization/residual boundary, output-head projection, and logits table near the prose that names them.
- SECTION PIPELINE STAGE MAPS. Every lesson part in a pipeline/process lesson must include a local stage-and-handoff visual: what came before, what this section receives, what it changes, what it outputs, and what comes next. For LLM lessons, explicitly distinguish tokenizer, embeddings/hidden states, transformer blocks, output head/logits, training, and inference/serving.
- LESSON FLOW ORDER. The learner-facing flow is: listen to audio first, then study text and visualizations together, then do practice problems/code and assessments.
- EVERY SUB-LESSON NEEDS CODE AND MIXED PRACTICE. Do not ship a lesson part that only contains prose, audio, and a visual. Each part must have an executable code exercise for that exact mechanism, plus mixed practice with select-one, select-all some, select-all none, ordering, and written response. Written responses need actual_answer and rubric so /api/answer-judge can grade immediately.
- FINAL CODE TIES THE PARTS TOGETHER. In addition to per-part code, include a final integrator coding task that combines the lesson mechanisms. Each coding task must include worked_examples with both "basic" and "concise" full-code versions, and those examples must be readable in phone preview.
- CODE EXERCISES TEACH BEFORE THEY ASK. Each coding task must include: a walkthrough with 3-5 conceptual steps, at least 2 concrete io_examples, and a visualization that maps input → transformation → expected output. The walkthrough must explain what the input represents, what shape/type the output has, and why the tests expect that behavior. Phone mode shows this reference/answer material instead of a runnable editor.
- Transformer-block example standard: before saying "a transformer block refines hidden states", define it as one repeated layer that receives one vector row per token, lets token rows read other token rows through attention, updates each row through an MLP, wraps updates with normalization and residual addition, and returns the same shape with more context-aware values.
- MLP example standard: before saying "the MLP transforms each token", define MLP as the per-token feed-forward subnetwork inside the block, show that it receives one token hidden vector at a time, uses learned linear layers plus an activation, and returns an update vector that fits back into the same token row.

CRITICAL: Use the mastery signals and assessment evidence to personalize content.
- If a concept has low confidence signals: address it directly and carefully
- If a concept shows strength: acknowledge it and build forward from it
- If there are recent incorrect answers: address that misconception clearly
- The audio script must feel like a skilled human tutor speaking directly to this learner

Return ONLY a valid JSON object matching this exact schema (no markdown, no prose, just JSON):

{
  "title": "Specific lesson title (not generic)",
  "description": "2-3 sentence description of what this lesson covers and why",
  "planning_rationale": "2-3 sentences explaining why this is the right next lesson for this specific learner right now",
  "comprehensive_lesson_plan": "Full evolving subject roadmap following the Comprehensive Avo Lesson Plan template. Must satisfy the template word-count floors, near-term detail, 1,000-word future horizon milestone requirement, and references/evidence ledger.",
  "audio_script": "Full top-level overview narration script (minimum 2,700 words, targets at least 15 minutes with margin, two-host podcast transcript with clear male/female labels such as Leo: and Maya:, conversational, addresses learner directly, starts high-level then revisits the lesson through analogy, worked example, mechanism trace, implementation intuition, misconception/failure mode, and synthesis)",
  "orientation_visual": {
    "strategy": "timeline",
    "artifact_slug": "focused-audio-orientation-scene-slug",
    "scene": {
      "scene_id": "unique-generated-scene-id-for-this-audio",
      "title": "Scene title specific to this audio",
      "motif": "attention score grid / residual ledger / MLP expansion gate / etc.",
      "description": "Why this scene is specific to this audio narration",
      "panels": [
        {
          "id": "panel-id",
          "title": "Panel title",
          "kind": "matrix",
          "description": "What this panel shows",
          "data": [
            { "label": "row or object label", "value": "optional text", "values": [20, 60, 40], "role": "input" }
          ]
        }
      ]
    },
    "cues": [
      {
        "start": 0,
        "end": 8,
        "label": "Current beat",
        "headline": "What the audio is saying now",
        "narration": "Short transcript-aligned visual note",
        "receive": "what enters this beat",
        "transform": "what changes in this beat",
        "pass": "what moves forward",
        "panel_id": "panel-id",
        "active_elements": ["row or object label"]
      }
    ]
  },
  "reading_intro": "Opening paragraph for the reading section (2-3 sentences)",
  "reading_blocks": [
    {
      "type": "heading",
      "text": "Section heading"
    },
    {
      "type": "paragraph",
      "text": "Explanatory paragraph..."
    },
    {
      "type": "definition",
      "term": "Key term",
      "definition": "Clear definition in learner language"
    },
    {
      "type": "example",
      "title": "Concrete example title",
      "body": "Example explanation..."
    },
    {
      "type": "callout",
      "tone": "insight",
      "text": "Key insight or warning..."
    },
    {
      "type": "list",
      "ordered": true,
      "items": ["Step 1...", "Step 2...", "Step 3..."]
    }
  ],
  "reading_summary": "1-2 sentence summary of what the reading section covered",
  "lesson_parts": [
    {
      "part_id": "part_1",
      "title": "Specific sub-lesson title",
      "reading": {
        "intro": "Short intro for this part",
        "blocks": [
          { "type": "heading", "text": "Part heading" },
          { "type": "paragraph", "text": "Mechanism-level explanation with concrete objects." },
          { "type": "definition", "term": "Key noun", "definition": "Definition grounded in learner language." }
        ],
        "summary": "What this part proved"
      },
      "audio": {
        "script": "Spoken walkthrough for this exact part",
        "transcript": "Same learner-visible transcript",
        "duration_hint": 120,
        "synced_visual": {
          "strategy": "timeline",
          "cues": [
            {
              "start": 0,
              "end": 5,
              "label": "Receives",
              "headline": "What arrives from the prior step",
              "narration": "Name the object and show it visually.",
              "receive": "previous object",
              "transform": "focus the learner",
              "pass": "ready state"
            }
          ]
        }
      },
      "interactive": {
        "schema_version": "1.0",
        "widget_type": "bespoke-artifact",
        "instructions": "Use the custom visual to inspect the state change.",
        "params": { "artifact_slug": "approved-artifact-slug" }
      },
      "code": {
        "prompt": "Implement this part's tiny mechanism.",
        "walkthrough": {
          "title": "Trace the expected behavior before coding",
          "steps": [
            {
              "title": "Name the input",
              "detail": "Explain what the function receives, including type, shape, and concept meaning.",
              "input": "helper(3)",
              "output": "not returned yet",
              "visual": "3 enters helper as the one value to preserve"
            },
            {
              "title": "Apply the mechanism",
              "detail": "Explain the exact transformation the learner should implement before syntax details.",
              "input": "3",
              "output": "3",
              "visual": "the value passes through unchanged"
            }
          ]
        },
        "io_examples": [
          { "label": "Small case", "input": "helper(3)", "expected_output": "3", "explanation": "The helper returns the same value." },
          { "label": "Different case", "input": "helper(10)", "expected_output": "10", "explanation": "The same rule applies to a different input." }
        ],
        "visualization": {
          "title": "Input becomes output",
          "description": "A compact map of the value before, during, and after the function.",
          "items": [
            { "label": "Input", "value": "3", "role": "input", "note": "what the caller passes in" },
            { "label": "Transform", "value": "preserve x", "role": "process", "note": "the mechanism to implement" },
            { "label": "Output", "value": "3", "role": "output", "note": "what tests expect" }
          ]
        },
        "starter_code": "def helper(x):\n    pass\n",
        "worked_examples": [
          { "label": "basic", "title": "Basic readable version", "code": "def helper(x):\n    result = x\n    return result\n" },
          { "label": "concise", "title": "Best concise version", "code": "def helper(x):\n    return x\n" }
        ],
        "tests": [{ "id": "part_test", "description": "Helper returns expected value", "assert": "helper(3) == 3" }]
      },
      "practice": {
        "written_feedback": "llm_judge",
        "questions": [
          { "id": "p1", "type": "select_one", "prompt": "...", "choices": ["A", "B"], "correct_index": 0, "explanation": "..." },
          { "id": "p2", "type": "select_all", "prompt": "...", "choices": ["A", "B", "C"], "correct_indices": [0, 2], "explanation": "..." },
          { "id": "p3", "type": "select_all", "prompt": "...", "choices": ["A", "B", "C"], "correct_indices": [], "explanation": "None are correct because ..." },
          { "id": "p4", "type": "ordering", "prompt": "...", "items": ["first", "second"], "correct_order": ["first", "second"], "explanation": "..." },
          { "id": "p5", "type": "written", "prompt": "...", "actual_answer": "Expected answer", "rubric": "What good answers include" }
        ]
      }
    }
  ],
  "final_code": {
    "prompt": "Integrator exercise that combines the lesson parts",
    "walkthrough": {
      "title": "Trace the integrator behavior",
      "steps": [
        { "title": "Collect the lesson objects", "detail": "Identify the values from the earlier parts that this function receives.", "input": "solve(3)", "visual": "one call enters the integrator" },
        { "title": "Combine the mechanisms", "detail": "Apply the earlier part mechanisms in the same order taught by the lesson.", "output": "3", "visual": "part outputs become the final return value" }
      ]
    },
    "io_examples": [
      { "label": "Small case", "input": "solve(3)", "expected_output": "3", "explanation": "The integrator applies the lesson path to a small value." },
      { "label": "Different case", "input": "solve(10)", "expected_output": "10", "explanation": "The same path should generalize." }
    ],
    "visualization": {
      "title": "Parts compose into one result",
      "items": [
        { "label": "Input", "value": "3", "role": "input" },
        { "label": "Part chain", "value": "part 1 → part 2 → part 3", "role": "process" },
        { "label": "Return", "value": "3", "role": "output" }
      ]
    },
    "starter_code": "def solve(x):\n    pass\n",
    "worked_examples": [
      { "label": "basic", "title": "Basic readable version", "code": "def solve(x):\n    result = x\n    return result\n" },
      { "label": "concise", "title": "Best concise version", "code": "def solve(x):\n    return x\n" }
    ],
    "tests": [{ "id": "final_test", "description": "Integrator returns expected value", "assert": "solve(3) == 3" }]
  },
  "assessment_questions": [
    {
      "id": "free_1",
      "text": "Open-ended question that checks deep understanding",
      "concept": "the concept being tested",
      "difficulty": "easy",
      "actual_answer": "Expected answer or key points the learner should mention",
      "rubric": "What a good answer includes"
    }
  ],
  "quiz_questions": [
    {
      "id": "mc_1",
      "question": "Multiple choice question grounded in what was just taught",
      "choices": ["Option A", "Option B", "Option C"],
      "correct_index": 0,
      "explanation": "Why this answer is correct, citing specific lesson content",
      "concept": "concept being tested",
      "difficulty": "medium",
      "grounding_required": true,
      "learning_scope": "taught",
      "support_ref": "reference to the specific reading block or audio section"
    }
  ],
  "next_lesson_diagnostics": [
    {
      "id": "diag_1",
      "prompt": "What aspect of [topic] still feels unclear or would you most like to explore next?",
      "hint": "Think about what concepts felt shaky or what you'd want to apply first."
    }
  ],
  "concept_tags": ["tag1", "tag2", "tag3"]
}`;
}

// ─── Formula block field normalizer ────────────────────────────────────────────
// Secondary defense: Gemini sometimes generates variable_definitions (with variable/description/unit)
// instead of variables (with symbol/meaning/shape?). This normalizer fixes the mismatch before DB write.

function normalizeFormulaBlocks(blocks: ReadingBlock[]): ReadingBlock[] {
  return blocks.map((block) => {
    const b = block as unknown as Record<string, unknown>;
    if (b.type !== "formula") return block;
    if (Array.isArray(b.variables) && b.variables.length > 0) return block;
    const varDefs = b.variable_definitions;
    if (!Array.isArray(varDefs) || varDefs.length === 0) return block;
    const normalized: Record<string, unknown> = { ...b };
    normalized.variables = varDefs.map((entry: Record<string, unknown>) => {
      const mapped: Record<string, unknown> = {
        symbol: String(entry.variable ?? entry.symbol ?? ""),
        meaning: String(entry.description ?? entry.meaning ?? ""),
      };
      const unitVal = entry.unit ?? entry.shape;
      if (unitVal && String(unitVal).trim() && String(unitVal).toLowerCase() !== "dimensionless") {
        mapped.shape = String(unitVal);
      }
      return mapped;
    });
    delete normalized.variable_definitions;
    return normalized as unknown as ReadingBlock;
  });
}

// ─── Lesson assembly and DB write ─────────────────────────────────────────────

function insertGeneratedLesson(
  db: Database.Database,
  draft: GeminiLessonDraft,
  subjectId: number,
  learnerId: number,
  eventType: string
): number {
  const maxSeq = db
    .prepare("SELECT COALESCE(MAX(sequence_number), 0) AS max_seq FROM lessons WHERE subject_id = ?")
    .get(subjectId) as { max_seq: number };
  const sequenceNumber = maxSeq.max_seq + 1;

  const goals = JSON.stringify([
    `Understand and apply ${draft.concept_tags[0] ?? "the core concept"}`,
    `Connect new knowledge to ${draft.concept_tags[1] ?? "prior learning"}`,
    "Leave structured evidence for the next adaptive lesson",
  ]);

  const sourceContext = {
    trigger: eventType,
    generated_by: getGeneratorId(),
    planning_rationale: draft.planning_rationale,
    comprehensive_lesson_plan_excerpt: draft.comprehensive_lesson_plan?.slice(0, 2000) ?? null,
    provider: "google-ai-studio",
    model: getGeminiModel(),
    concept_tags: draft.concept_tags,
    generated_at: new Date().toISOString(),
  };

  const lessonResult = db
    .prepare(
      `INSERT INTO lessons
         (subject_id, title, description, status, sequence_number, goals, tags,
          generated_by, generator_version, source_context, planning_rationale)
       VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, '1.0.0', ?, ?)`
    )
    .run(
      subjectId,
      draft.title,
      draft.description,
      sequenceNumber,
      goals,
      JSON.stringify(draft.concept_tags),
      getGeneratorId(),
      JSON.stringify(sourceContext),
      draft.planning_rationale
    );

  const lessonId = Number(lessonResult.lastInsertRowid);

  const insertActivity = db.prepare(
    `INSERT INTO lesson_activities
       (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  let sequence = 3;

  const audioContent: Record<string, unknown> = {
    script: draft.audio_script,
    transcript: draft.audio_script,
    duration_hint: Math.max(15 * 60, Math.round(draft.audio_script.split(/\s+/).length / 150) * 60),
    planning_rationale: draft.planning_rationale,
  };
  if (draft.orientation_visual) {
    audioContent.orientation_visual = draft.orientation_visual;
  }

  // 1. Audio activity
  insertActivity.run(
    lessonId,
    "audio",
    1,
    1,
    `Audio: ${draft.title}`,
    JSON.stringify(audioContent)
  );

  // 2. Reading activity
  insertActivity.run(
    lessonId,
    "reading",
    1,
    2,
    `Read: ${draft.title}`,
    JSON.stringify({
      intro: draft.reading_intro,
      blocks: draft.reading_blocks,
      summary: draft.reading_summary,
    })
  );

  const concept0 = draft.concept_tags[0] ?? "the concept";
  const concept1 = draft.concept_tags[1] ?? "application";
  if (Array.isArray(draft.lesson_parts) && draft.lesson_parts.length > 0) {
    for (const part of draft.lesson_parts) {
      insertActivity.run(
        lessonId,
        "lesson_part",
        1,
        sequence++,
        part.title || `Part ${sequence - 2}: ${draft.title}`,
        JSON.stringify({
          part_id: part.part_id,
          reading: part.reading,
          audio: part.audio,
          interactive: part.interactive,
          code: part.code,
          practice: part.practice,
        })
      );
    }
  } else {
    insertActivity.run(
      lessonId,
      "interactive",
      1,
      sequence++,
      `Explore: ${draft.title} — readiness check`,
      JSON.stringify({
        schema_version: "1.0",
        widget_type: "declarative",
        title: `${draft.title} — learning pressure`,
        instructions:
          "Adjust the sliders to reflect your confidence in each area. " +
          "Watch how readiness changes. This compatibility widget is used only when the provider omits lesson_parts.",
        controls: [
          { type: "slider", id: "concept_clarity", label: `Clarity on ${concept0}`, min: 0, max: 10, step: 1, default: 4 },
          { type: "slider", id: "application_depth", label: `Ability to apply ${concept1}`, min: 0, max: 10, step: 1, default: 3 },
          { type: "slider", id: "example_recall", label: "Can recall a concrete example", min: 0, max: 10, step: 1, default: 5 },
        ],
        outputs: [
          {
            id: "readiness",
            label: "Lesson readiness",
            formula: "(concept_clarity * 0.45 + application_depth * 0.35 + example_recall * 0.20) * 10",
            format: "percent",
            precision: 0,
            description: "Weighted readiness across the three dimensions.",
          },
          { id: "gap", label: "Gap to address", formula: "100 - readiness", format: "percent", precision: 0 },
        ],
        charts: [
          {
            type: "bar",
            title: "Self-assessment by dimension",
            bars: [
              { label: `${concept0} clarity`, ref: "concept_clarity", color: "#2563eb" },
              { label: `${concept1} depth`, ref: "application_depth", color: "#16a34a" },
              { label: "Example recall", ref: "example_recall", color: "#f59e0b" },
            ],
            max: 10,
          },
        ],
        panels: [{ title: "What this means", template: "Your current readiness is {{readiness}}." }],
      })
    );
  }

  const finalCode = draft.final_code ?? fallbackFinalCode(concept0, concept1);
  insertActivity.run(
    lessonId,
    "practice_code",
    1,
    sequence++,
    `Code: Tie ${draft.title} together`,
    JSON.stringify(finalCode)
  );

  // Assessment activity
  insertActivity.run(
    lessonId,
    "assessment",
    1,
    sequence++,
    "Check: Reflect, consolidate, and shape the next lesson",
    JSON.stringify({
      questions: draft.assessment_questions,
      quiz: {
        pass_threshold: Math.max(1, Math.floor(draft.quiz_questions.length * 0.6)),
        idk_option: true,
        questions: draft.quiz_questions,
      },
    })
  );

  // 5. Next-lesson diagnostics (stored on the lesson row)
  db.prepare(
    `UPDATE lessons SET next_lesson_diagnostics = ? WHERE id = ?`
  ).run(JSON.stringify(draft.next_lesson_diagnostics), lessonId);

  // Upsert tags
  upsertLessonTags(db, subjectId, lessonId, [
    "agent-harness",
    "gemini-generated",
    ...draft.concept_tags.slice(0, 5),
  ]);

  // Upsert workpad
  upsertWorkpad(db, subjectId, learnerId, lessonId, draft);

  return lessonId;
}

function fallbackFinalCode(concept0: string, concept1: string): PracticeCodeDraft {
  const safeConcept0 = concept0.replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 40) || "the first concept";
  const safeConcept1 = concept1.replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 40) || "the second concept";
  return {
    prompt: `Represent how ${safeConcept0} connects to ${safeConcept1}. Return a short dictionary with both names and a one-line relationship.`,
    walkthrough: {
      title: "Trace the dictionary this function should return",
      steps: [
        {
          title: "Start with two lesson concepts",
          detail: "The function does not take arguments. It uses the two concepts from the lesson as the fixed input ideas.",
          input: "connect_concepts()",
          output: "a dictionary with first, second, and relationship",
          visual: `${safeConcept0} and ${safeConcept1} are the two named inputs to organize.`,
        },
        {
          title: "Package the concepts into stable keys",
          detail: "The output shape matters: tests expect exactly first, second, and relationship so later code can read those fields reliably.",
          input: "two concept names",
          output: "{'first': ..., 'second': ..., 'relationship': ...}",
          visual: "three labeled slots appear in the returned dictionary.",
        },
        {
          title: "Write the relationship in plain language",
          detail: "The relationship value should say how the first concept supports or sets up the second concept, not just repeat the names.",
          input: `${safeConcept0} → ${safeConcept1}`,
          output: "a non-empty relationship string",
          visual: "an arrow label becomes the relationship field.",
        },
      ],
    },
    io_examples: [
      {
        label: "Expected shape",
        input: "connect_concepts()",
        expected_output: "{'first': '...', 'second': '...', 'relationship': '...'}",
        explanation: "The exact text may vary, but the three keys must be present and filled.",
      },
      {
        label: "Relationship check",
        input: "connect_concepts()['relationship']",
        expected_output: "a non-empty sentence",
        explanation: "The relationship should explain the connection rather than return an empty placeholder.",
      },
    ],
    visualization: {
      title: "Concepts become a returned dictionary",
      description: "The exercise maps lesson concepts into a stable structure that tests can inspect.",
      items: [
        { label: "Input ideas", value: `${safeConcept0} + ${safeConcept1}`, role: "input", note: "the concepts from the lesson" },
        { label: "Package", value: "first / second / relationship", role: "process", note: "the dictionary keys tests expect" },
        { label: "Return", value: "filled dictionary", role: "output", note: "the learner's final value" },
      ],
    },
    starter_code:
      "def connect_concepts():\n" +
      "    return {\n" +
      "        'first': '',\n" +
      "        'second': '',\n" +
      "        'relationship': '',\n" +
      "    }\n",
    worked_examples: [
      {
        label: "basic",
        title: "Basic readable version",
        code:
          "def connect_concepts():\n" +
          `    first = ${JSON.stringify(safeConcept0)}\n` +
          `    second = ${JSON.stringify(safeConcept1)}\n` +
          "    relationship = 'The first concept sets up the second concept.'\n" +
          "    return {\n" +
          "        'first': first,\n" +
          "        'second': second,\n" +
          "        'relationship': relationship,\n" +
          "    }\n",
      },
      {
        label: "concise",
        title: "Best concise version",
        code:
          "def connect_concepts():\n" +
          `    return {'first': ${JSON.stringify(safeConcept0)}, 'second': ${JSON.stringify(safeConcept1)}, 'relationship': 'first supports second'}\n`,
      },
    ],
    hints: [
      { level: 1, text: "Start by naming the two concepts from the lesson." },
      { level: 2, text: "Return a dictionary with first, second, and relationship keys." },
      { level: 3, text: "The relationship should describe how the first concept helps make the second concept possible." },
    ],
    tests: [
      { id: "shape", description: "returns the expected keys", assert: "set(connect_concepts().keys()) == {'first', 'second', 'relationship'}" },
      { id: "filled", description: "fills every value", assert: "all(str(v).strip() for v in connect_concepts().values())" },
    ],
  };
}

function upsertLessonTags(
  db: Database.Database,
  subjectId: number,
  lessonId: number,
  tags: string[]
): void {
  const insert = db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, 'concept')");
  const get = db.prepare("SELECT id FROM tags WHERE name = ?");
  const linkSubject = db.prepare("INSERT OR IGNORE INTO subject_tags (subject_id, tag_id) VALUES (?, ?)");
  const linkLesson = db.prepare("INSERT OR IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)");
  for (const tag of tags) {
    insert.run(tag);
    const row = get.get(tag) as { id: number } | undefined;
    if (!row) continue;
    linkSubject.run(subjectId, row.id);
    linkLesson.run(lessonId, row.id);
  }
}

function upsertWorkpad(
  db: Database.Database,
  subjectId: number,
  learnerId: number,
  lessonId: number,
  draft: GeminiLessonDraft
): void {
  const comprehensivePlan = draft.comprehensive_lesson_plan?.trim();
  const addition = [
    `## ${new Date().toISOString()} ${getGeneratorId()} generation`,
    `Generated lesson: ${draft.title} (id ${lessonId})`,
    `Planning rationale: ${draft.planning_rationale}`,
    `Concept tags: ${draft.concept_tags.join(", ")}`,
    `Provider: google-ai-studio / ${getGeminiModel()}`,
    "",
    comprehensivePlan || "Comprehensive lesson plan was missing from provider output and must be regenerated before production use.",
  ].join("\n");

  const existing = db
    .prepare(
      "SELECT id, content, version FROM subject_workpads WHERE subject_id = ? AND learner_id = ?"
    )
    .get(subjectId, learnerId) as { id: number; content: string; version: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE subject_workpads
       SET content = ?, version = ?, last_updated_by = ?,
           last_updated_for = 'lesson_generation', updated_at = datetime('now')
       WHERE id = ?`
    ).run(`${existing.content}\n\n${addition}`, existing.version + 1, getGeneratorId(), existing.id);
  } else {
    db.prepare(
      `INSERT INTO subject_workpads
         (subject_id, learner_id, content, last_updated_by, last_updated_for)
       VALUES (?, ?, ?, ?, 'lesson_generation')`
    ).run(subjectId, learnerId, addition, getGeneratorId());
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleSubjectCreated(
  db: Database.Database,
  event: SubjectCreatedEvent
): Promise<HarnessResult> {
  const { subject_id: subjectId, learner_id: learnerId } = event;

  // Stage: check for existing initial assessment (idempotency)
  updateJobProgress(db, subjectId, "subject.created", "provider.check", "Checking for existing initial assessment");
  const existing = db
    .prepare("SELECT id, title FROM lessons WHERE subject_id = ? AND sequence_number = 0 LIMIT 1")
    .get(subjectId) as { id: number; title: string } | undefined;

  if (existing) {
    updateJobProgress(db, subjectId, "subject.created", "lesson.generated", `Existing initial assessment found (lesson ${existing.id})`);
    return {
      ok: true,
      ref: `agent-harness-assessment-existing-${existing.id}`,
      lesson_id: existing.id,
      provider_used: "local-fixture",
      stage_reached: "lesson.generated",
    };
  }

  // Stage: generate initial assessment (deterministic, no LLM needed)
  updateJobProgress(db, subjectId, "subject.created", "local.fixture", "Generating initial assessment (deterministic calibration)");

  const result = generateInitialAssessment(db, event);

  updateJobProgress(db, subjectId, "subject.created", "lesson.generated", `Initial assessment ready (lesson ${result.lesson_id}, ${result.question_count} questions)`);

  return {
    ok: true,
    ref: `agent-harness-assessment-${result.lesson_id}`,
    lesson_id: result.lesson_id,
    provider_used: "local-fixture/initial-assessment",
    stage_reached: "lesson.generated",
  };
}

async function handleLessonCompleted(
  db: Database.Database,
  event: LessonCompletedEvent
): Promise<HarnessResult> {
  const { subject_id: subjectId, learner_id: learnerId } = event;
  const triggerEvent = "lesson.completed";

  // Check provider
  updateJobProgress(db, subjectId, triggerEvent, "provider.check", "Verifying Google AI Studio provider");
  const key = getGeminiKey();
  if (!key) {
    return { ok: false, error: "GOOGLE_AI_STUDIO_API_KEY is not configured. Cannot generate adaptive lesson." };
  }

  // Build learner context
  updateJobProgress(db, subjectId, triggerEvent, "researching", "Reading learner evidence from database");
  const context = buildLearnerContext(db, subjectId, learnerId);

  // Call Gemini (with automatic retry + fallback model on transient failures)
  updateJobProgress(db, subjectId, triggerEvent, "authoring", "Calling Gemini to generate adaptive lesson content");
  const prompt = buildLessonPrompt(context, event.event);
  let raw: string;
  let modelUsed: string;
  try {
    ({ text: raw, modelUsed } = await callGeminiWithRetry(db, subjectId, triggerEvent, prompt));
  } catch (geminiErr) {
    const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    return { ok: false, error: `Gemini generation failed: ${msg}` };
  }

  // Parse response
  let draft: GeminiLessonDraft;
  try {
    draft = JSON.parse(raw) as GeminiLessonDraft;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Gemini response parse failed: ${msg}` };
  }

  // Validate essential fields
  if (!draft.title || !draft.audio_script || !draft.reading_blocks) {
    return {
      ok: false,
      error: `Gemini returned incomplete lesson draft (missing title/audio_script/reading_blocks)`,
    };
  }

  // Normalize formula blocks: map variable_definitions -> variables if needed
  draft.reading_blocks = normalizeFormulaBlocks(draft.reading_blocks);
  if (Array.isArray(draft.lesson_parts)) {
    for (const part of draft.lesson_parts) {
      if (part.reading?.blocks) {
        part.reading.blocks = normalizeFormulaBlocks(part.reading.blocks);
      }
    }
  }

  // Write to DB
  updateJobProgress(db, subjectId, triggerEvent, "validating", "Writing lesson to database");
  const lessonId = insertGeneratedLesson(db, draft, subjectId, learnerId, event.event);

  // Generate audio
  if (process.env.AVOCADOCORE_LOCAL_QUEUE_AUDIO !== "skip") {
    updateJobProgress(db, subjectId, triggerEvent, "generating_audio", "Generating lesson audio");
    try {
      await generateLessonAudio(db, lessonId);
    } catch (audioErr) {
      const msg = audioErr instanceof Error ? audioErr.message : String(audioErr);
      console.error(`[lesson-harness] Audio generation failed for lesson ${lessonId}: ${msg}`);
      // Audio failure is non-fatal — lesson is still usable
      updateJobProgress(db, subjectId, triggerEvent, "generating_audio", `Audio generation failed (non-fatal): ${msg.slice(0, 100)}`);
    }
  }

  updateJobProgress(db, subjectId, triggerEvent, "finalizing", `Lesson "${draft.title}" ready (id ${lessonId})`);

  return {
    ok: true,
    ref: `agent-harness-lesson-${lessonId}`,
    lesson_id: lessonId,
    provider_used: getGeneratorId(modelUsed),
    stage_reached: "finalizing",
  };
}

async function handleLessonDiscarded(
  db: Database.Database,
  event: LessonDiscardedEvent
): Promise<HarnessResult> {
  const { subject_id: subjectId, learner_id: learnerId } = event;
  const triggerEvent = "lesson.discarded";

  updateJobProgress(db, subjectId, triggerEvent, "provider.check", "Verifying Google AI Studio provider");
  const key = getGeminiKey();
  if (!key) {
    return { ok: false, error: "GOOGLE_AI_STUDIO_API_KEY is not configured. Cannot generate replacement lesson." };
  }

  updateJobProgress(db, subjectId, triggerEvent, "researching", "Reading learner evidence from database");
  const context = buildLearnerContext(db, subjectId, learnerId);

  updateJobProgress(db, subjectId, triggerEvent, "authoring", "Calling Gemini to generate replacement lesson");
  const prompt = buildLessonPrompt(context, event.event, event.discarded_lesson_title);
  let raw: string;
  let modelUsed: string;
  try {
    ({ text: raw, modelUsed } = await callGeminiWithRetry(db, subjectId, triggerEvent, prompt));
  } catch (geminiErr) {
    const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    return { ok: false, error: `Gemini generation failed: ${msg}` };
  }

  let draft: GeminiLessonDraft;
  try {
    draft = JSON.parse(raw) as GeminiLessonDraft;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Gemini response parse failed: ${msg}` };
  }

  if (!draft.title || !draft.audio_script || !draft.reading_blocks) {
    return {
      ok: false,
      error: "Gemini returned incomplete lesson draft (missing required fields)",
    };
  }

  // Normalize formula blocks: map variable_definitions -> variables if needed
  draft.reading_blocks = normalizeFormulaBlocks(draft.reading_blocks);
  if (Array.isArray(draft.lesson_parts)) {
    for (const part of draft.lesson_parts) {
      if (part.reading?.blocks) {
        part.reading.blocks = normalizeFormulaBlocks(part.reading.blocks);
      }
    }
  }

  updateJobProgress(db, subjectId, triggerEvent, "validating", "Writing replacement lesson to database");
  const lessonId = insertGeneratedLesson(db, draft, subjectId, learnerId, event.event);

  if (process.env.AVOCADOCORE_LOCAL_QUEUE_AUDIO !== "skip") {
    updateJobProgress(db, subjectId, triggerEvent, "generating_audio", "Generating audio for replacement lesson");
    try {
      await generateLessonAudio(db, lessonId);
    } catch (audioErr) {
      const msg = audioErr instanceof Error ? audioErr.message : String(audioErr);
      console.error(`[lesson-harness] Audio generation failed for lesson ${lessonId}: ${msg}`);
    }
  }

  updateJobProgress(db, subjectId, triggerEvent, "finalizing", `Replacement lesson "${draft.title}" ready (id ${lessonId})`);

  return {
    ok: true,
    ref: `agent-harness-lesson-${lessonId}`,
    lesson_id: lessonId,
    provider_used: getGeneratorId(modelUsed),
    stage_reached: "finalizing",
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Read stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const input = Buffer.concat(chunks).toString("utf-8").trim();

  let payload: HarnessPayload;
  try {
    payload = JSON.parse(input) as HarnessPayload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputResult({ ok: false, error: `Payload parse failed: ${msg}` });
    return;
  }

  const db = getDb();

  try {
    let result: HarnessResult;

    if (payload.event_type === "subject.created") {
      result = await handleSubjectCreated(db, payload.event as SubjectCreatedEvent);
    } else if (payload.event_type === "lesson.completed") {
      result = await handleLessonCompleted(db, payload.event as LessonCompletedEvent);
    } else if (payload.event_type === "lesson.discarded") {
      result = await handleLessonDiscarded(db, payload.event as LessonDiscardedEvent);
    } else {
      result = { ok: false, error: `Unknown event_type: ${payload.event_type}` };
    }

    outputResult(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Sanitize: never print the API key in output
    const key = getGeminiKey();
    const safe = key ? msg.split(key).join("[redacted]") : msg;
    outputResult({ ok: false, error: safe.slice(0, 500) });
  } finally {
    closeDb();
  }
}

function outputResult(result: HarnessResult): void {
  // Always output the result as the last JSON line on stdout
  process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  const key = getGeminiKey();
  const safe = key ? msg.split(key).join("[redacted]") : msg;
  outputResult({ ok: false, error: `Harness uncaught error: ${safe.slice(0, 400)}` });
  process.exit(1);
});
