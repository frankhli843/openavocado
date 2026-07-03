/**
 * Lesson Generator Skill Contract
 *
 * This file defines the stable interface between the AvocadoCore app and
 * any lesson-generator skill or agent. The app provides structured context;
 * the generator returns structured content that fits the lesson framework.
 *
 * Implementations:
 * - Dora skill (Frank's deployment): creates a Doramon todo-loop task
 * - CLI script: invokes a model via CLI and writes output to a local file
 * - API-backed: calls a REST endpoint that wraps an LLM
 * - Custom: any code that implements LessonGeneratorAdapter
 *
 * None of these implementations belong in the reusable repo.
 * They live in local deployment config or private skill files.
 */

import type { LessonGeneratorContext, GeneratedLessonContent, ActivityType, LevelName } from "@/types";
import { validateWidgetSpec, WIDGET_SCHEMA_VERSION } from "@/lib/widgets/schema";
import { COMPREHENSIVE_LESSON_PLAN_TEMPLATE } from "@/lib/lesson-generator/plan-template";
import {
  validateReadingContent,
  validateMediaContent,
  validatePracticeCodeContent,
  validateNextLessonDiagnostics,
  validateLessonPartContent,
  validateAudioSyncedVisualContent,
} from "@/lib/lesson-content/schema";

/** Minimum audio script length to count as a real, generation-ready script. */
const MIN_AUDIO_SCRIPT_CHARS = 20;
/** Fifteen minutes with margin at the current Doraemon Edge TTS pace. */
const MIN_OVERVIEW_AUDIO_WORDS = 2700;
const PODCAST_MALE_RE = /^(?:\*\*)?(Leo|Male host|Host A|Doraemon|Daniel|Alex)(?:\*\*)?:/gim;
const PODCAST_FEMALE_RE = /^(?:\*\*)?(Maya|Female host|Host B|Guest|Ava|Mina)(?:\*\*)?:/gim;
const AUTHORING_LEAK_RE =
  /\b(?:the learner should|learner should|the learner needs|learner needs|the lesson should|this lesson should|the overview should|this overview should|the audio should|the transcript should|the script should|must be written as|should be written as)\b/i;
const GENERIC_LISTENING_COACH_RE =
  /\b(?:do not try to memorize|don't try to memorize|listen for the object|listen for this handoff|listen for the route|object and the handoff|before we dive into details, you need the route|building a mental map|guided conversation and less like a lecture|not rushing through a table of contents)\b/i;
const RAW_FORMULA_AUDIO_RE = /\b(?:QK\^T|Q\s*·\s*K\^T|√d_k|softmax\([^)]*[·^√_][^)]*\)|[A-Za-z]\^[A-Za-z0-9]|\b\w+_\w+\b)/;
const RAW_LATEX_AUDIO_RE = /(?:\\[A-Za-z]+|[A-Za-z]_\{|_\{|[{}])/;

export { WIDGET_SCHEMA_VERSION };

/**
 * Widget spec authoring guidance for lesson generators.
 *
 * A newly generated `interactive` activity's `content` MUST be a WidgetSpec:
 *   - schema_version: "1.x"
 *   - widget_type: "bespoke-artifact"
 *   - instructions: learner-facing description of what to do
 *   - params.artifact_slug: approved DB-backed visual_artifacts slug
 *
 * Arbitrary AI-authored React/JS is NOT accepted from lesson JSON/SQLite. The
 * model-generated component must cross the visual-artifact build/review
 * boundary first, including Chrome MCP sandbox screenshots, then the lesson
 * references only the approved slug.
 */
export const WIDGET_AUTHORING_NOTE =
  "interactive.content for new lessons must be widget_type:'bespoke-artifact' with an approved visual_artifacts slug. No registered/declarative widgets for new generation.";

/**
 * The enrichment quality bar every generated lesson must meet, formatted for
 * direct inclusion in a lesson-generation task/prompt.
 *
 * This is the SAME standard as docs/lesson-authoring-guide.md ("Enrichment
 * requirements") and the machine-checked {@link validateGeneratedContent}. It
 * lives here so the reusable generator paths (the Dora-task adapter and any
 * other generator) hand future lesson-generation AGENTS the requirements
 * directly — not just a doc link they might never open. Keep it in sync with the
 * authoring guide and validateGeneratedContent whenever the contract changes.
 */
export const LESSON_QUALITY_BAR_PROMPT = [
  "=== LESSON QUALITY BAR (required for EVERY generated lesson) ===",
  "Before lesson work starts, read the main AvocadoCore lesson-authoring skill: skills/avocadocore-lesson-authoring/SKILL.md.",
  "Do not ship a thin, audio-only, or high-level-only lesson. Every lesson must include:",
  '- Generated audio AVAILABLE AT CREATION: a substantive spoken script (never a stub or "audio coming soon"); produce the actual audio artifact at creation time and record it as a generated artifact.',
  "- WHY-FIRST TEACHING: before formulas or implementation details, explain the high-level purpose and the specific mismatch/failure mode this lesson resolves. Each major step must answer: what breaks or becomes invalid if we skip it?",
  "- NO UNDOCUMENTED ASSUMPTIONS: do not assume domain facts are true unless they are already documented in AvocadoCore context, present in the local SQLite evidence, or verified and recorded in the lesson/task notes.",
  "- PLANNING STAGE BEFORE AUTHORING: before writing lesson content, do comprehensive current research for the topic, especially when it touches active model-building, inference, quantization, GGUF, Hugging Face, or Gemma practice. Record source-backed findings, update the subject workpad and long-term plan, then author the lesson from that plan.",
  COMPREHENSIVE_LESSON_PLAN_TEMPLATE,
  "- DYNAMIC, BESPOKE AUTHORING: do not fill a reusable template. Choose the lesson scope, metaphor, examples, visualizations, practice, quiz, and video because they fit this learner, this topic, and the DB evidence.",
  "- PURPOSE-BUILT REACT VISUALS ONLY: every visual must be designed as generated source code for the exact concept block it supports, stored in visual_artifacts, built, Chrome-QAed, approved, and rendered by artifact slug. Treat each dense block like a small custom learning app: identify the real data/artifact/process in the prose, then show its rows, columns, axes, states, transitions, failure points, or before/after values. Do not use registered widgets, declarative widgets, reusable JSON panel schemas, or any precreated component path. Do not execute raw React/JS directly from lesson JSON or SQLite. Generic bars, relabelable flow boxes, and template-looking diagrams fail QA unless the lesson is genuinely about generic quantities, trends, or distributions and has still been implemented as a bespoke artifact.",
  "- CONCEPT GROUNDING BEFORE OPERATIONS: before a lesson says to look up, add, optimize, sample, cache, classify, normalize, or compare a technical object, first show what that object is, where it comes from, and how it relates to the previous step. Terms like embedding, matrix, tensor, vector, logits, index, prior, likelihood, gradient, loss, and cache must get a tiny concrete representation before operations are performed on them. Example: for embedding lookup, show the embedding matrix as vocabulary-ID rows by hidden-dimension columns, explain that it is learned model weights, show that tokenizer IDs are row addresses, then show the selected row becoming the embedding vector.",
  "- DEFINE MAJOR NOUNS UNLESS EVIDENCE PROVES THEY ARE KNOWN: do not assume the learner understands a concept just because it appears in a curriculum plan or prior lesson title. If assessment answers, mastery signals, completed lesson content, or profile criteria do not prove the learner knows a term, define and ground it before using it as a building block. Example: before saying 'a transformer block refines hidden states', explain that a transformer block is one repeated layer that receives one vector row per token, lets token rows read other token rows through attention, updates each row through an MLP, wraps updates with normalization and residual addition, and returns the same shape with more context-aware values. Likewise, do not say 'the MLP transforms each token' until the lesson has defined MLP as the per-token feed-forward subnetwork inside the block, shown its input hidden vector, explained its learned linear layers plus activation in learner language, and shown its output update fitting back into the token row.",
  "- PHASE BEHAVIOR: familiarity lessons focus on high-level concepts, vocabulary, and how pieces relate. Competence lessons move into the important details, mechanisms, edge cases, and practice. Mastery lessons emphasize transfer, integration, and harder evidence. Post-mastery lessons must be research-driven: find a recent, relevant, well-cited or frontier paper, cite it clearly, explain why it is worth studying, and build the lesson around what the paper adds beyond the mastered foundation.",
  "- MECHANISM-LEVEL DETAIL, NOT COMPRESSED SUMMARIES: paragraphs that name several operations without unpacking them fail the quality bar. A sentence like 'attention mixes context, the MLP transforms each token, residuals keep signal, and the output head produces logits' is an outline, not teaching. Expand it into a concrete micro-trace with tiny dimensions and labels, such as 4 token positions, 3 hidden dimensions, and 5 vocabulary logits. Show what object enters, which rows/cells change after attention, what the MLP changes, where normalization and residual addition sit, and how the final hidden vector becomes one raw score per vocabulary token.",
  "- ADJACENT VISUALS FOR DENSE MECHANISMS: every mechanism-heavy paragraph needs a diagram or interactive next to the exact text it explains, not one distant overview widget later in the lesson. Attach Mermaid/static diagrams through reading.diagrams[] or place a lesson-part interactive immediately beside the prose. Use the same nouns as the text: token positions, hidden-state rows, residual stream, attention weights, MLP update, normalization boundary, output-head projection, logits table, or the equivalent concrete artifacts for the domain.",
  "- SECTION PIPELINE STAGE MAPS: every lesson part in a pipeline/process lesson must include a local stage-and-handoff visual that shows what came before, what this section receives, what it changes, what it outputs, and what comes next. For LLM lessons, explicitly distinguish tokenizer, embeddings/hidden states, transformer blocks, output head/logits, training, and inference/serving. The learner should never have to guess how the current object relates to the wider pipeline.",
  "- LESSON FLOW ORDER: the learner-facing order should be listen first, then study written text and visualizations together, then do practice problems/code and assessments. Lesson-part UI and content should put audio before the written/visual pair, and visuals should stay close enough to the text that they can be read together.",
  "- AUDIO + INTERACTIVE SIDE-BY-SIDE FOR ORIENTATION: every top-level audio orientation and every lesson_part audio segment must have a paired DB-backed bespoke artifact visible alongside the audio on desktop and immediately below it on mobile. Top-level audio stores cue timing in orientation_visual and lesson parts store cue timing in audio.synced_visual, but the visual itself must be an approved visual_artifacts component referenced by artifact_slug. Do not make learners finish listening before they can see the moving object being described.",
  "- AUDIO-ADJACENT VISUALS MUST BE SCOPED TO THE CURRENT AUDIO: the visual shown beside or immediately below an audio player must show only what that audio segment is narrating now, plus minimal before/after handoff context. Do not reuse a broad whole-lesson interactive, all-step simulator, complete curriculum map, later exploratory widget, or generic generated-panel renderer beside the audio when most of it is unrelated to the current narration. Put broad exploratory interactives after the audio/text block as their own activity; the audio-adjacent visual should be a focused approved bespoke artifact with timed states matching the spoken beats.",
  "- AUDIO-SYNCED VISUAL TRANSCRIPTS ARE REQUIRED: every top-level audio activity and every lesson_part audio object must include the learner-visible transcript and a synced visual. Top-level audio stores timing metadata in orientation_visual; lesson parts store timing metadata in audio.synced_visual. The synced visual must include either a fallback artifact_slug for an approved visual_artifacts component or per-cue cue.artifact_slug values that each mount a separate approved component as the audio advances. Cues must identify what object the section receives, what operation is happening, and what is passed forward. A transcript-only accordion, one static component, a generic receive-transform-pass box layout, or a card that just writes the audio text is rejected.",
  "- SEGMENTED AUDIO VISUALS FOR DENSE SECTIONS: for formula-heavy, transformer, matrix, code-trace, or multi-object audio, prefer separate cue.artifact_slug components instead of one component that only swaps state. Each 5-10 second cue can mount a different generated artifact: one for Q/K dot products, one for the score matrix, one for softmax normalization, one for V mixing, one for residual addition, one for the MLP handoff. The renderer swaps artifacts by active cue, so authors should generate genuinely different components, not one relabeled template.",
  "- UNIQUE BESPOKE AUDIO VISUALS: every audio-synced visual in the same lesson must be individually generated as approved visual_artifacts code for that exact audio segment or cue. Do not repeat the same component source, receive-transform-pass layout, cue labels, scene objects, or visual motif with different text. Use different artifact code per audio or per cue: an attention score grid for Q/K/V, a residual-stream ledger for residual flow, an expansion/compression gate for an MLP, a pipeline map for orientation, or a logits table for output-head audio. The checker rejects duplicate synced-visual fingerprints within a lesson.",
  "- MOBILE-FIRST BESPOKE ARTIFACT SOURCE: every visual_artifacts React component must be authored for both desktop and 390px mobile from the start. Source must use responsive layout signals such as flexWrap, minmax()/auto-fit grids, clamp(), width/maxWidth:100%, overflow-x:auto for wide tables, and text wrapping. Fixed desktop widths, imported registered/declarative widgets, reused template components, and tiny placeholder components are rejected by the artifact source validator before build/approval.",
  "- FORMAL MATH REQUIREMENT: whenever a lesson uses mathematical notation, formulas, or expressions such as Attention(Q,K,V), QK^T, softmax, square roots, matrix shapes, probabilities, or loss functions, the reading content must include a `formula` block with LaTeX, a plain-English interpretation, and explicit variable definitions including shapes/units when relevant. Do not leave formulas as plain prose.",
  "- KATEX-COMPATIBLE FORMULAS ONLY: LaTeX strings must be renderable by KaTeX. Do not embed presentation commands such as `\\colorbox`, `\\fcolorbox`, `\\bbox`, raw HTML, or unsupported highlight wrappers in formula strings. Put the clean formula in LaTeX and use synced-visual `active_elements` to indicate what should be highlighted.",
  "- FIVE-SECOND VISUAL BEATS: normal lesson-part audio should be planned at roughly one moving visual beat per 5 seconds of audio. Every beat does not need an entirely separate component, but it must visibly change an object, focus, matrix cell, pointer, arrow, row, layer, or before/after state. For a 160-second audio clip, expect about 30+ timed cue states. Long static intervals fail QA.",
  "- MANIM / 3BLUE1BROWN-STYLE SCENE DESIGN: model each synced visualization like a small Manim scene rather than a slide. Define objects, positions, transforms, camera/framing emphasis, and timed state changes. Use multiple coordinated visual components where useful: a pipeline map, a tiny matrix/table, a moving pointer, a before/after failure view, and a consequence panel. For transformer lessons, show real concept objects such as embedding tables, hidden-state matrices, attention score grids, residual paths, normalization, MLP layer expansion/compression, and logits tables. The public 3Blue1Brown Manim demo shows the intended workflow: build a scene from simple objects, animate transformations step by step, and iterate on styling/rendering rather than dumping prose into a box.",
  "- BESPOKE ARTIFACT PIPELINE (REQUIRED FOR ALL VISUALS): the DB-backed bespoke artifact pipeline is the only learner-facing interactive path. For any interactive or audio-synced visual, generate a self-contained React component (React + recharts/lucide-react only, no external fetches), store it via POST /api/visual-artifacts with a stable slug, build it via POST /api/visual-artifacts/{slug}/build, run Chrome MCP QA on the sandbox URL (/api/visual-artifacts/{slug}/sandbox), take desktop and 390px mobile screenshots, attach QA evidence via POST /api/visual-artifacts/{slug}/qa-evidence, then approve it via POST /api/visual-artifacts/{slug}/approve. Approval requires notes/screenshot refs that explicitly mention desktop and mobile/390px evidence. Once approved, the lesson interactive JSON stores widget_type:'bespoke-artifact' and params.artifact_slug only, and audio synced visuals store artifact_slug plus cue timing. Component contract: export default function ArtifactComponent(). Allowed imports: react, react-dom, lucide-react, recharts. No fs, path, child_process, net, http, https, crypto.",
  "- NO PRECREATED INTERACTIVE COMPONENTS: registered widgets, declarative widgets, local generated-panel renderers, and other prewritten visual components are forbidden as learner-facing Avo interactives. Existing active lessons must be backfilled to approved bespoke artifacts instead of relying on compatibility renderers.",
  "- EXAMPLES + METAPHORS: use fitting metaphors and simple examples to make each major step or concept understandable. Multi-step lessons should give each major step its own plain-language handle, metaphor, and easy examples where useful.",
  "- TOP-LEVEL OVERVIEW AUDIO MINIMUM: the first audio activity is the learner's primary lecture and must target at least 15 minutes of substantive Doraemon-voice audio, which means at least 2,700 words unless the lesson is explicitly diagnostic/reference-only and documents why it is shorter. The transcript must use a two-host podcast format with clear male and female speaker labels, for example `Leo:` and `Maya:`. Use a calm long-form interview / NotebookLM-style back-and-forth without imitating a specific living person. One host should ask learner-like clarifying questions while the other unpacks the mechanism. Start at the high-level map, then spiral into more detail by revisiting the same core ideas through analogy/metaphor, tiny worked example, mechanism trace, implementation intuition, misconception/failure mode, and final synthesis. It must define every major noun, explain why each step matters, connect the steps, repeat the essential model from multiple perspectives, and use concrete examples in plain language. A short caption, table of contents, or quick intro fails QA.",
  "- LEARNER-FACING AUDIO ONLY: audio scripts and transcripts must sound like the hosts are teaching the learner directly. Do not leak authoring instructions, rubric language, checklist language, or meta-planning phrases such as 'the learner should', 'the lesson should', 'the overview should', 'the audio should', or 'the transcript should'. Do not spend overview time telling the learner how to listen, how not to memorize, or how to use the lesson. Teach the concept itself through concrete examples, mechanisms, contrasts, and visual references.",
  "- NO GENERIC LISTENING COACHING: avoid filler such as 'before we dive in, you need the route', 'do not try to memorize everything', 'listen for the object and the handoff', 'we are building a mental map', or 'this is a guided conversation, not a lecture.' Those are authoring reminders, not lesson content. If orientation is needed, make it topic-specific: name the actual object, actual transformation, actual evidence, and actual next stage.",
  "- AUDIO-FRIENDLY FORMULAS: reading blocks still need formal LaTeX, but spoken audio must describe formulas in words. Do not read raw notation such as `QK^T / √d_k` as text. Say 'Q times K transpose, divided by the square root of d sub k', then explain what the quantity means before returning to the visual or example.",
  "- FORMULA-SYNCED VISUALS: when audio explains a formula, the paired synced visual must include a formula panel (kind `formula`) that displays the formula and highlights the specific symbols or subexpressions named by the current cue. For attention, show the expression and highlight Q, K, the score matrix, softmax, and V as the hosts discuss each one. Do not narrate a formula while showing an unrelated pipeline or generic cards.",
  "- First-class WRITTEN teaching text the learner can study without the audio (headings, a definition, a worked example, a summary) — not a transcript dump.",
  "- MULTIPLE meaningful visual/interactive explorations when the lesson covers multiple concepts. A multi-concept lesson (3+ goals/mastery targets) needs at least TWO distinct visual perspectives; a multi-step lesson should prefer step-specific visuals. One thin widget for many concepts is rejected.",
  "- LESSON PARTS: break normal lessons into collapsed `lesson_part` activities. Each part must contain written explanation, a per-part audio script/transcript, audio.synced_visual timed across that part's audio length, a bespoke-artifact interactive visualization, a part-specific executable code practice, and mixed reinforcement practice. Mixed practice must include select-one, select-all with some correct, select-all with none correct, ordering, and written questions. Written questions must provide actual_answer + rubric so /api/answer-judge can give immediate LLM feedback. Section done/undone buttons are a learner checklist only, available at any time, persisted in SQLite, and never used as a completion gate.",
  "- CODE IN EVERY SUB-LESSON + FINAL INTEGRATOR: every normal lesson_part must include a code field with a small runnable exercise for that part's mechanism. The lesson must also include a final practice_code activity that ties the lesson parts together. Coding sections must provide a walkthrough, at least two concrete input/output examples, a behavior visualization mapping input -> process -> output, and worked_examples with both a basic/readable full implementation and a best concise full implementation. Phone preview is read-only answer/study mode: it must hide the runnable editor and show the optional-coding notice, walkthrough, expected I/O, behavior map, and reference answers clearly.",
  "- Interactives must deepen understanding, not merely display graphs. Each widget needs a learning objective, learner-controlled variable, visible consequence/failure mode, and written takeaway. Prefer before/after and 'what breaks if...' interactions. QA should reject any visual whose labels could be swapped and reused for an unrelated lesson.",
  "- AUDIO FOR EVERY VISUALIZATION: every visualization/interactive must have a spoken explanation clip or per-part audio script that explains what to change, what to notice, and what the visual proves. Do not leave visuals as silent graphs.",
  "- TABLE OF CONTENTS AND DEEP LINKS: every lesson, subject tab, dashboard menu, section, and activity should be reachable by stable URL/query/hash links so the learner can return directly to the right place.",
  "- YouTube media should be included when highly relevant videos are found, usually as late-lesson reinforcement rather than the opening move. Prefer multiple short, complementary videos when available. Do NOT include long generic videos as filler. If media is used, declare whether the whole video is relevant or only exact timestamped segments, and show the precise start/end times to watch plus the reason; otherwise omit media.",
  "- PRACTICE/CODE the learner submits: scaffolded, with progressive, unboxable hints that can go all the way to the full answer explanation; public + hidden tests; no top-level exposed solution field.",
  '- ADAPTIVE ASSESSMENT IS REQUIRED for normal generated lessons: include an MC quiz where every question carries a required difficulty (easy|medium|hard) and the virtual "I don\'t know" option, plus freeform questions. Omit the quiz only for explicitly non-assessed reference/diagnostic content and document why.',
  "- SQLITE MASTERY EVIDENCE: lesson generation must use and update structured local DB evidence where appropriate: assessment_results, attempts, progress_points, mastery_signals, generated_artifacts, and next_lesson_jobs. Do not hide durable mastery state in prose.",
  "- CONTINUOUS MODEL NOTES: maintain a concise subject workpad for long-term planning. Compress completed history into brief durable notes and keep next steps, open questions, weak concepts, and planned evidence checks more detailed. Refactor stale detail out instead of appending endless logs.",
  "- END-OF-LESSON 'help shape your next lesson' diagnostics must be bespoke to the lesson just completed. Ask genuine planning questions that reveal what still feels unclear, what direction would help most, and what the learner wants next; do not reuse generic boilerplate unless no lesson-specific question would help.",
  "- EXPLICIT preview / deeper-later wording: if a concept is intentionally introduced only at a high level, the audio script AND the written text must say so — name it a preview and state it will be explored in more detail in a later lesson. Never leave a glossed-over idea looking fully taught.",
  "The machine-checked gate is validateGeneratedContent (src/lib/lesson-generator/contract.ts); the full standard is docs/lesson-authoring-guide.md. A lesson that fails validateGeneratedContent must be fixed, not shipped.",
  "- KNOWLEDGE GRAPH ORIENTATION: every lesson must include a knowledge_graph_data field (KnowledgeGraphData) showing where this lesson sits in the curriculum — which concepts are covered, which are previewed, and which come later. Validated by validateKnowledgeGraphData.",
  "- MANUAL AUTHORING (not blind autogeneration): you are the AI lesson author. Own the pedagogy. Before generating, decide what gap this lesson addresses, what the single most important takeaway is, and what example/interaction will make it click. Author the knowledge_graph_data first (it is the lesson map). Design each interactive as a purpose-built widget/spec for the exact block it teaches. A template fill or autogeneration-only output does not pass QA.",
  "- DORA TASK AND MANUAL QA: generation must be tracked in a Dora task following the acceptance criteria template in docs/lesson-authoring-guide.md 'New lesson Dora task — acceptance criteria template'. Evidence required in task notes BEFORE QA: lesson id in DB, audio route HTTP 200, live-URL or fresh-DB screenshot (desktop 1280 + mobile 390). QA must be done by a DIFFERENT reviewer agent (not the generator). The reviewer opens the browser and interacts with every activity. See docs/lesson-authoring-guide.md 'Lesson generation workflow' and 'What separate QA means'.",
].join("\n");

/**
 * A lesson generator adapter.
 * Implement this to wire your preferred generation backend.
 */
export interface LessonGeneratorAdapter {
  name: string;

  /**
   * Generate lesson content for a given context.
   * May be async and long-running (dispatches a background task).
   *
   * Returns either the generated content directly (sync/fast adapters)
   * or a pending ticket reference (async adapters where generation happens offline).
   */
  generate(
    context: LessonGeneratorContext
  ): Promise<GeneratorResult>;
}

export type GeneratorResult =
  | { status: "ready"; content: GeneratedLessonContent }
  | { status: "pending"; ref: string; estimated_ready_at?: string }
  | { status: "error"; error: string };

/**
 * Builds the generator context from database state.
 * This is what the app passes to the generator skill.
 */
export function buildGeneratorContext(params: {
  subject: {
    id: number;
    title: string;
    description: string | null;
    goals: string | null;
    criteria: string | null;
    current_level: LevelName;
  };
  learner: {
    id: number;
    display_name: string;
    preferred_lang: string;
  };
  lesson_number: number;
  previous_lessons: Array<{
    title: string;
    status: "queued" | "in_progress" | "completed" | "skipped";
    completed_at: string | null;
  }>;
  mastery_signals: Array<{
    signal_type: "strength" | "weak_spot" | "misconception" | "review_needed" | "ready_to_advance";
    concept: string;
    detail: string | null;
    confidence: number | null;
  }>;
  latest_assessment_answers?: Record<string, string>;
  instructions?: string;
}): LessonGeneratorContext {
  return {
    subject: params.subject,
    learner: params.learner,
    lesson_number: params.lesson_number,
    previous_lessons: params.previous_lessons,
    mastery_signals: params.mastery_signals,
    latest_assessment_answers: params.latest_assessment_answers,
    instructions: params.instructions,
  };
}

/**
 * Validates that generated content satisfies the lesson structure requirements.
 * Every lesson must have: audio, lesson_part/reading/interactive teaching,
 * practice_code, assessment (core).
 */
export function validateGeneratedContent(
  content: GeneratedLessonContent
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];

  if (!content.title?.trim()) errors.push("Missing title");
  if (!Array.isArray(content.goals) || content.goals.length === 0) {
    errors.push("Missing goals");
  }

  // Every normal lesson must teach in writing as well as audio, so `reading`
  // joins the required core sections.
  const usesLessonParts = content.activities.some((a) => a.activity_type === "lesson_part");
  const coreRequired: ActivityType[] = usesLessonParts
    ? ["audio", "lesson_part", "practice_code", "assessment"]
    : ["audio", "reading", "interactive", "practice_code", "assessment"];
  const coreActivities = content.activities
    .filter((a) => a.is_core)
    .map((a) => a.activity_type);

  for (const required of coreRequired) {
    if (!coreActivities.includes(required)) {
      errors.push(`Missing required core section: ${required}`);
    }
  }

  // Code section required for every subject (even non-technical)
  if (!coreActivities.includes("practice_code")) {
    errors.push("practice_code section is required for every subject");
  }

  // Generated audio must be available at lesson creation, not a placeholder.
  // The audio activity must carry a substantive script (the source the audio is
  // generated from), so a lesson can never ship audio-less or with a stub.
  const audioActivity = content.activities.find((a) => a.activity_type === "audio");
  if (audioActivity) {
    const audioContent = audioActivity.content as Record<string, unknown>;
    const script = audioContent?.script;
    if (typeof script !== "string" || script.trim().length < MIN_AUDIO_SCRIPT_CHARS) {
      errors.push(
        "audio activity must include a substantive script (generated audio must be available at lesson creation, not a placeholder)"
      );
    } else {
      const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < MIN_OVERVIEW_AUDIO_WORDS) {
        errors.push(
          `top-level overview audio script must be at least ${MIN_OVERVIEW_AUDIO_WORDS} words to target 15+ minutes; got ${wordCount}`
        );
      }
      const maleLines = script.match(PODCAST_MALE_RE)?.length ?? 0;
      const femaleLines = script.match(PODCAST_FEMALE_RE)?.length ?? 0;
      if (maleLines < 4 || femaleLines < 4) {
        errors.push(
          "top-level overview audio script must use a two-host podcast transcript with at least four male-host and four female-host turns"
        );
      }
      if (AUTHORING_LEAK_RE.test(script)) {
        errors.push(
          "top-level overview audio script must be learner-facing and must not leak authoring instructions such as 'the learner should', 'the lesson should', or 'the audio should'"
        );
      }
      if (GENERIC_LISTENING_COACH_RE.test(script)) {
        errors.push(
          "top-level overview audio script must teach the topic directly, not generic listening coaching such as 'do not try to memorize', 'listen for the object and the handoff', or 'we are building a mental map'"
        );
      }
      if (RAW_FORMULA_AUDIO_RE.test(script) || RAW_LATEX_AUDIO_RE.test(script)) {
        errors.push(
          "top-level overview audio script must describe formulas in audio-friendly words instead of raw notation such as QK^T, √d_k, LaTeX commands, braces, or underscored variable names"
        );
      }
    }
    const transcript =
      typeof audioContent?.transcript === "string" && audioContent.transcript.trim()
        ? audioContent.transcript
        : script;
    if (typeof transcript !== "string" || transcript.trim().length < MIN_AUDIO_SCRIPT_CHARS) {
      errors.push("audio activity must include a learner-visible transcript");
    }
    const visual = validateAudioSyncedVisualContent(
      audioContent?.orientation_visual,
      audioContent?.duration_hint
    );
    for (const e of visual.errors) errors.push(`audio activity orientation_visual: ${e}`);
    const durationHint = Number(audioContent?.duration_hint ?? 0);
    if (!Number.isFinite(durationHint) || durationHint < 15 * 60) {
      errors.push("top-level overview audio duration_hint must be at least 900 seconds");
    }
  }

  // Multiple visual perspectives when the lesson covers multiple concepts. A
  // multi-concept lesson (3+ goals or mastery targets) must offer at least two
  // distinct visual explorations, normally several lesson parts or several
  // DB-backed bespoke-artifact activities, so a broad lesson is never a single
  // thin visualization. (Single-concept lessons are exempt.)
  const interactiveActivities = content.activities.filter((a) => a.activity_type === "interactive");
  const lessonPartActivities = content.activities.filter((a) => a.activity_type === "lesson_part");
  let perspectives = interactiveActivities.length;
  for (const a of interactiveActivities) {
    const charts = (a.content as Record<string, unknown>)?.charts;
    if (Array.isArray(charts) && charts.length >= 2) perspectives += charts.length - 1;
  }
  perspectives += lessonPartActivities.length;
  const conceptCount = Math.max(
    Array.isArray(content.goals) ? content.goals.length : 0,
    Array.isArray(content.mastery_targets) ? content.mastery_targets.length : 0
  );
  if (conceptCount >= 3 && perspectives < 2) {
    errors.push(
      "a multi-concept lesson needs at least two visual perspectives using multiple lesson parts or DB-backed bespoke-artifact interactives; do not ship one thin widget for many concepts"
    );
  }

  // End-of-lesson next-lesson diagnostics: when provided, they must be valid.
  // (Generators should always provide them; the app applies a default set if a
  // lesson omits them — see DEFAULT_NEXT_LESSON_DIAGNOSTICS.)
  if (content.next_lesson_diagnostics !== undefined) {
    const r = validateNextLessonDiagnostics(content.next_lesson_diagnostics);
    if (!r.valid) for (const e of r.errors) errors.push(`next_lesson_diagnostics: ${e}`);
  }

  // New generation accepts only DB-backed bespoke artifacts. Passing an empty
  // known-type list makes registered/precreated widget names invalid here.
  const knownWidgetTypes: string[] = [];
  for (const [i, activity] of content.activities.entries()) {
    const label = `activity[${i}] (${activity.title ?? "untitled"})`;

    // Interactive activities must carry a valid, safe widget spec.
    if (activity.activity_type === "interactive") {
      const result = validateWidgetSpec(activity.content, knownWidgetTypes);
      if (!result.valid) {
        for (const e of result.errors) errors.push(`interactive ${label}: ${e}`);
      }
      for (const e of validateNewLessonBespokeArtifact(activity.content)) {
        errors.push(`interactive ${label}: ${e}`);
      }
    }

    if (activity.activity_type === "lesson_part") {
      const result = validateLessonPartContent(
        activity.content,
        knownWidgetTypes,
        validateWidgetSpec
      );
      if (!result.valid) {
        for (const e of result.errors) errors.push(`lesson_part ${label}: ${e}`);
      }
      const part = activity.content as Record<string, unknown> | undefined;
      for (const e of validateNewLessonBespokeArtifact(part?.interactive)) {
        errors.push(`lesson_part ${label}: interactive: ${e}`);
      }
    }

    // Written text must be substantive teaching content, not an empty shell.
    if (activity.activity_type === "reading") {
      const result = validateReadingContent(activity.content);
      if (!result.valid) {
        for (const e of result.errors) errors.push(`reading ${label}: ${e}`);
      }
    }

    // Media embeds must be safe (resolvable YouTube ids) with reason + fallback.
    if (activity.activity_type === "media") {
      const result = validateMediaContent(activity.content);
      if (!result.valid) {
        for (const e of result.errors) errors.push(`media ${label}: ${e}`);
      }
    }

    // Code exercises must be scaffolded submissions, never an exposed answer.
    if (activity.activity_type === "practice_code") {
      const result = validatePracticeCodeContent(activity.content);
      if (!result.valid) {
        for (const e of result.errors) errors.push(`practice_code ${label}: ${e}`);
      }
      for (const e of validateGeneratedCodeStudySupport(activity.content)) {
        errors.push(`practice_code ${label}: ${e}`);
      }
    }
  }

  for (const e of findDuplicateAudioVisuals(content.activities)) {
    errors.push(e);
  }

  // Knowledge graph orientation: strongly recommended for all lessons.
  // Logged as a warning, not a hard error, so existing seeded lessons still
  // pass until they are authored with graph data.
  const warnings: string[] = [];
  if (!content.knowledge_graph_data) {
    warnings.push(
      "knowledge_graph_data missing — every lesson should include a KnowledgeGraphData orientation map showing where this lesson fits in the subject curriculum"
    );
  } else {
    const kg = validateKnowledgeGraphData(content.knowledge_graph_data);
    for (const e of kg.errors) warnings.push(`knowledge_graph_data: ${e}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateNewLessonBespokeArtifact(spec: unknown): string[] {
  if (!spec || typeof spec !== "object") return [];
  const widgetType = (spec as Record<string, unknown>).widget_type;
  if (widgetType !== "bespoke-artifact") {
    return [
      'new generated lessons must use widget_type:"bespoke-artifact"; registered, declarative, generated-panel, and other precreated widget paths are not accepted',
    ];
  }
  return [];
}

function findDuplicateAudioVisuals(activities: GeneratedLessonContent["activities"]): string[] {
  const seen = new Map<string, string>();
  const errors: string[] = [];
  for (const [index, activity] of activities.entries()) {
    const content = activity.content as Record<string, unknown> | undefined;
    const visual =
      activity.activity_type === "audio"
        ? (content?.orientation_visual as Record<string, unknown> | undefined)
        : activity.activity_type === "lesson_part"
          ? ((content?.audio as Record<string, unknown> | undefined)?.synced_visual as Record<string, unknown> | undefined)
          : undefined;
    if (!visual || !Array.isArray(visual.cues) || visual.cues.length === 0) continue;
    const sceneId = typeof visual.scene === "object" && visual.scene && typeof (visual.scene as Record<string, unknown>).scene_id === "string"
      ? (visual.scene as Record<string, unknown>).scene_id as string
      : null;
    if (sceneId) {
      const sceneKey = `scene-id:${sceneId}`;
      const priorById = seen.get(sceneKey);
      const label = `activity[${index}] (${activity.title ?? activity.activity_type})`;
      if (priorById) {
        errors.push(`audio synced visual for ${label} reuses scene_id from ${priorById}; each audio segment needs a generated scene_id`);
      } else {
        seen.set(sceneKey, label);
      }
    }
    const fingerprint = audioVisualFingerprint(visual);
    if (!fingerprint) continue;
    const label = `activity[${index}] (${activity.title ?? activity.activity_type})`;
    const prior = seen.get(fingerprint);
    if (prior) {
      errors.push(`audio synced visual for ${label} duplicates ${prior}; each audio segment needs a bespoke visual scene`);
    } else {
      seen.set(fingerprint, label);
    }
  }
  return errors;
}

function audioVisualFingerprint(visual: Record<string, unknown>): string {
  const cues = Array.isArray(visual.cues) ? visual.cues : [];
  const words = cues
    .map((raw) => {
      if (!raw || typeof raw !== "object") return "";
      const cue = raw as Record<string, unknown>;
      return [
        cue.label,
        cue.headline,
        cue.receive,
        cue.transform,
        cue.pass,
        cue.visual_kind,
        visual.artifact_slug,
        typeof visual.scene === "object" && visual.scene ? (visual.scene as Record<string, unknown>).title : null,
        typeof visual.scene === "object" && visual.scene ? (visual.scene as Record<string, unknown>).motif : null,
        typeof visual.scene === "object" && visual.scene ? (visual.scene as Record<string, unknown>).description : null,
        ...(typeof visual.scene === "object" && visual.scene && Array.isArray((visual.scene as Record<string, unknown>).panels)
          ? ((visual.scene as Record<string, unknown>).panels as unknown[]).flatMap((panel) => {
              if (!panel || typeof panel !== "object") return [];
              const p = panel as Record<string, unknown>;
              const data = Array.isArray(p.data) ? p.data : [];
              return [
                p.title,
                p.kind,
                p.description,
                ...data.flatMap((datum) => {
                  if (!datum || typeof datum !== "object") return [];
                  const d = datum as Record<string, unknown>;
                  return [d.label, d.value, d.role];
                }),
              ];
            })
          : []),
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ");
    })
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !AUDIO_VISUAL_STOP_WORDS.has(word));
  return Array.from(new Set(words)).sort().slice(0, 90).join(" ");
}

const AUDIO_VISUAL_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "into",
  "from",
  "ready",
  "state",
  "visual",
  "audio",
  "section",
  "object",
  "next",
  "previous",
]);

function validateGeneratedCodeStudySupport(content: unknown): string[] {
  if (!content || typeof content !== "object") {
    return [
      "practice_code content must include walkthrough, io_examples, visualization, and worked_examples",
    ];
  }
  const c = content as Record<string, unknown>;
  const errors: string[] = [];

  const walkthrough = c.walkthrough as Record<string, unknown> | undefined;
  const steps = walkthrough && typeof walkthrough === "object" ? walkthrough.steps : undefined;
  if (!Array.isArray(steps) || steps.length < 2) {
    errors.push("practice_code must include walkthrough.steps with at least 2 conceptual steps");
  }

  const ioExamples = c.io_examples;
  if (!Array.isArray(ioExamples) || ioExamples.length < 2) {
    errors.push("practice_code must include at least 2 io_examples");
  }

  const visualization = c.visualization as Record<string, unknown> | undefined;
  const vizItems = visualization && typeof visualization === "object" ? visualization.items : undefined;
  if (!Array.isArray(vizItems) || vizItems.length < 3) {
    errors.push("practice_code must include visualization.items mapping input, process, and output");
  } else {
    const roles = new Set(
      vizItems
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).role : null))
        .filter((role): role is string => typeof role === "string")
        .map((role) => role.toLowerCase())
    );
    for (const role of ["input", "process", "output"]) {
      if (!roles.has(role)) errors.push(`practice_code visualization missing "${role}" role`);
    }
  }

  const examples = c.worked_examples;
  if (!Array.isArray(examples)) {
    errors.push('practice_code must include worked_examples with "basic" and "concise" full-code versions');
    return errors;
  }
  const labels = new Set(
    examples
      .map((ex) => (ex && typeof ex === "object" ? (ex as Record<string, unknown>).label : null))
      .filter((label): label is string => typeof label === "string")
      .map((label) => label.toLowerCase())
  );
  if (!labels.has("basic")) errors.push('practice_code worked_examples missing "basic" full-code version');
  if (!labels.has("concise")) errors.push('practice_code worked_examples missing "concise" full-code version');
  return errors;
}

/**
 * Validate a KnowledgeGraphData object (soft — warnings only).
 * The graph is authored per-lesson to show the curriculum context, so the
 * minimum bar is: at least one root/subject node, at least two total nodes,
 * and every edge references nodes that exist in the graph.
 */
export function validateKnowledgeGraphData(
  graph: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!graph || typeof graph !== "object") {
    return { valid: false, errors: ["knowledge_graph_data must be an object"] };
  }
  const g = graph as Record<string, unknown>;
  if (g.type !== "high-level" && g.type !== "focused") {
    errors.push('knowledge_graph_data.type must be "high-level" or "focused"');
  }
  if (!g.title || typeof g.title !== "string" || !g.title.trim()) {
    errors.push("knowledge_graph_data.title is required");
  }
  if (!Array.isArray(g.nodes) || g.nodes.length < 2) {
    errors.push("knowledge_graph_data.nodes must have at least 2 nodes");
    return { valid: errors.length === 0, errors };
  }
  const nodeIds = new Set<string>();
  for (const [i, n] of (g.nodes as unknown[]).entries()) {
    if (!n || typeof n !== "object") { errors.push(`nodes[${i}] must be an object`); continue; }
    const node = n as Record<string, unknown>;
    if (!node.id || typeof node.id !== "string") errors.push(`nodes[${i}].id is required`);
    else nodeIds.add(node.id as string);
    if (!node.label || typeof node.label !== "string") errors.push(`nodes[${i}].label is required`);
    if (typeof node.covered !== "boolean") errors.push(`nodes[${i}].covered must be boolean`);
  }
  const hasRoot = (g.nodes as unknown[]).some((n) => {
    if (!n || typeof n !== "object") return false;
    return (n as Record<string, unknown>).category === "subject_root";
  });
  if (!hasRoot) errors.push("knowledge_graph_data.nodes must include at least one subject_root node");
  if (Array.isArray(g.edges)) {
    for (const [i, e] of (g.edges as unknown[]).entries()) {
      if (!e || typeof e !== "object") { errors.push(`edges[${i}] must be an object`); continue; }
      const edge = e as Record<string, unknown>;
      if (!nodeIds.has(edge.from as string)) errors.push(`edges[${i}].from "${edge.from}" is not a known node id`);
      if (!nodeIds.has(edge.to as string)) errors.push(`edges[${i}].to "${edge.to}" is not a known node id`);
    }
  }
  return { valid: errors.length === 0, errors };
}
