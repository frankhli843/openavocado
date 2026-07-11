import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  LessonDiscardedEvent,
  RegenerationHookAdapter,
  SubjectCreatedDispatcher,
  SubjectCreatedEvent,
} from "@/types";
import { LESSON_QUALITY_BAR_PROMPT } from "@/lib/lesson-generator/contract";
import { COMPREHENSIVE_LESSON_PLAN_TEMPLATE } from "@/lib/lesson-generator/plan-template";
import { sourceMaterialsToPrompt } from "@/lib/subject-materials";

const execFileAsync = promisify(execFile);

export const AVOCADOCORE_LESSON_AUTHORING_SKILL =
  "skills/avocadocore-lesson-authoring/SKILL.md";

const KNOWLEDGE_FILES_SECTION = [
  "RELEVANT KNOWLEDGE FILES:",
  "- knowledge/projects/avocadocore_dev.md",
].join("\n");

const SUBJECT_NOTES_AND_JOURNAL_REQUIREMENT = [
  "=== SUBJECT NOTES AND JOURNAL REQUIREMENT ===",
  "Update the subject workpad as the mutable latest comprehensive plan, then append at least one subject journal entry as the durable audit log for this run. The journal entry must be readable by the learner in the AvocadoCore AI Work tab. It should summarize what evidence and research you consulted, what sequencing or master-plan decision you made, why this lesson is the right next move, which weaknesses are being deferred, and what you verified in validators or Chrome MCP. Use POST /api/subjects/:id/journal when the app server is available, or insert into subject_journal_entries directly in SQLite when working offline. Use entry_type 'research' for source-backed findings, 'planning' for sequencing decisions, or 'lesson_generation' for the final lesson creation/repair summary.",
  COMPREHENSIVE_LESSON_PLAN_TEMPLATE,
].join("\n");

const PURPOSE_BUILT_VISUAL_REQUIREMENT = [
  "=== PURPOSE-BUILT VISUAL REQUIREMENT ===",
  "Every visualization must be designed for the exact concept block it supports, not chosen from a reusable visual template catalog. Treat each dense block like a small custom learning app: identify the real data, artifact, process, or failure mode in the prose, then show its rows, columns, axes, stages, states, transitions, before/after values, or concrete artifacts. If code is needed, prefer bespoke React for that lesson part. The current safe path is to land it as reviewed source code wired through the AvocadoCore widget registry or equivalent visual-component manifest, then reference a stable component id/widget type from the lesson. Future DB-backed visuals may store source, compiled artifact refs, QA screenshots, and approval metadata in SQLite, but raw React/JS must not execute directly from lesson JSON. If a diagram is enough, author a bespoke Mermaid or static diagram tied to the exact paragraph. QA must reject generic bars, relabelable flow boxes, decorative colored blocks, and any visual whose labels could be swapped to fit an unrelated lesson, unless the lesson is genuinely about quantities, trends, or distributions.",
  "Before showing operations on a technical object, ground the object itself. If the lesson says embedding lookup, first show what an embedding is, what the embedding matrix looks like in a tiny concrete form, where it comes from, and how tokenizer IDs address rows. Apply the same rule to tensors, matrices, vectors, logits, priors, gradients, caches, queues, losses, and other dense terms. The learner should never have to infer what the thing is while simultaneously learning an operation on it.",
].join("\n");

const LOCAL_MODEL_BOUNDARY_REQUIREMENT = [
  "=== LOCAL MODEL BOUNDARY ===",
  "Local AvocadoCore may use a low-latency local model for instant learner-facing paths such as chat, short-answer grading, code-submission feedback, hints, and immediate formative feedback. Do not use that local feedback model as the lesson author. Lesson generation and lesson repair must go through the AvocadoCore/Dora lesson-authoring flow, an approved harness, or a controlled backfill script that validates and writes real lesson content.",
].join("\n");

interface DoraCreateTaskInput {
  project: string;
  title: string;
  acceptance: string;
  metadata: Record<string, unknown>;
}

function getConfiguredProject(config?: Record<string, unknown>): string {
  return (
    (config?.project as string | undefined) ||
    process.env.AVOCADOCORE_DORA_PROJECT ||
    "avocadocore"
  );
}

function getConfiguredChannel(config?: Record<string, unknown>): string | undefined {
  return (
    (config?.channel as string | undefined) ||
    process.env.AVOCADOCORE_DORA_CHANNEL
  );
}

function getConfiguredEndpoint(config?: Record<string, unknown>): string | undefined {
  return (
    (config?.endpoint as string | undefined) ||
    process.env.AVOCADOCORE_DORA_ENDPOINT ||
    undefined
  );
}

function resolveTodoCli(config?: Record<string, unknown>): string | null {
  const configured =
    (config?.todo_cli as string | undefined) ||
    process.env.AVOCADOCORE_DORA_TODO_CLI;
  if (configured) return configured;

  const workspace =
    process.env.OPENCLAW_WORKSPACE ||
    path.join(homedir(), ".openclaw", "workspace");
  const candidate = path.join(
    workspace,
    "skills",
    "doramon-todo-loop",
    "scripts",
    "todo.sh"
  );
  return existsSync(candidate) ? candidate : null;
}

function appendDoraQualityGate(text: string): string {
  if (text.toUpperCase().includes("RELEVANT KNOWLEDGE FILES")) return text;
  return [text, "", KNOWLEDGE_FILES_SECTION].join("\n");
}

async function createDoraTask(
  input: DoraCreateTaskInput,
  config?: Record<string, unknown>
): Promise<{ ok: boolean; ref?: string; error?: string }> {
  const endpoint = getConfiguredEndpoint(config);
  const acceptance = appendDoraQualityGate(input.acceptance);

  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: input.project,
          title: input.title,
          acceptance,
          origin_platform: "avocadocore",
          metadata: input.metadata,
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `dora endpoint responded with ${res.status}` };
      }

      const data = (await res.json()) as { id?: string; todo?: { id?: string } };
      return { ok: true, ref: data.id || data.todo?.id || `dora-task-${Date.now()}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  const todoCli = resolveTodoCli(config);
  if (!todoCli) {
    return {
      ok: false,
      error:
        "dora-task adapter: no AVOCADOCORE_DORA_ENDPOINT or todo CLI configured",
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "bash",
      [
        todoCli,
        "add",
        input.project,
        "--title",
        input.title,
        "--acceptance",
        acceptance,
        "--origin-platform",
        "avocadocore",
        "--origin-channel",
        "avocadocore",
        "--origin-preview",
        input.title,
        "--created-by",
        "avocadocore",
      ],
      {
        cwd: process.env.OPENCLAW_WORKSPACE || path.join(homedir(), ".openclaw", "workspace"),
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      }
    );
    const data = JSON.parse(stdout.trim()) as {
      ok?: boolean;
      error?: string;
      todo?: { id?: string };
    };
    if (!data.ok) {
      return { ok: false, error: data.error || stderr || "todo CLI returned ok=false" };
    }
    return { ok: true, ref: data.todo?.id || `dora-task-${Date.now()}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

function fmtChannelInstruction(channel?: string): string {
  return channel
    ? `After generating the lesson, post a review in <#${channel}> explaining what changed, what evidence drove it, and how the lesson bridges the learner's gaps. Tag the learner in the thread.`
    : "After generating the lesson, confirm completion in the appropriate channel.";
}

function buildFirstLessonAcceptance(event: SubjectCreatedEvent, channel?: string): string {
  const lessonType = event.lesson_type ?? "course";
  const targetLessonCount = event.target_lesson_count ?? (lessonType === "one_off" ? 1 : null);
  const subjectSnapshot = [
    `Title: ${event.subject_title}`,
    event.subject_description ? `Description: ${event.subject_description}` : "Description: (none set)",
    `Lesson type: ${lessonType}`,
    targetLessonCount ? `Target lesson count: ${targetLessonCount}` : "Target lesson count: open-ended",
    event.subject_goals ? `Goals:\n${event.subject_goals}` : "Goals: (none set)",
    event.subject_criteria
      ? `Learner preferences:\n${event.subject_criteria}`
      : "Learner preferences: (none set)",
    `Source materials:\n${sourceMaterialsToPrompt(event.source_materials ?? [])}`,
    `Current level: ${event.current_level}`,
    event.workpad_summary ? `Current workpad:\n${event.workpad_summary}` : "Current workpad: (none yet)",
    `Learner profile config: ${event.learner_profile_config ? JSON.stringify(event.learner_profile_config) : "(none)"}`,
  ].join("\n");

  return [
    `Read ${AVOCADOCORE_LESSON_AUTHORING_SKILL} before doing any lesson work.`,
    "",
    lessonType === "one_off"
      ? `Generate the ONE-OFF lesson for new subject "${event.subject_title}" (subject ${event.subject_id}, learner ${event.learner_id}).`
      : `Generate the FIRST lesson for new subject "${event.subject_title}" (subject ${event.subject_id}, learner ${event.learner_id}).`,
    lessonType === "one_off"
      ? "This is a one-off learning request. Do not create an initial assessment lesson. Create exactly one pure teaching lesson that covers the important things to learn from the provided context, links, and uploaded materials. Infer the user's likely starting point from the learner profile, subject text, goals, preferences, and materials. The lesson should be comprehensive enough to stand alone, with rich audio, visuals, practice, and assessments inside the lesson itself. If a queued lesson already exists for this subject, repair it against this contract instead of creating a duplicate."
      : "This is the initial lesson, so the worker must not assume a pre-existing curriculum or hidden mastery state. Start by inspecting the local AvocadoCore SQLite database for this subject, learner profile, related subjects, prior cross-subject mastery, and any existing workpad. If the subject has no lessons yet, create lesson 1. If a lesson was already added while this task was waiting, verify it against the quality bar and either repair it or record that no new lesson is needed.",
    "",
    "=== SUBJECT SNAPSHOT ===",
    subjectSnapshot,
    "",
    "=== REQUIRED PLANNING STAGE ===",
    "Before authoring content, do a deliberate planning pass. Read the subject goals and criteria, inspect SQLite evidence, update or create the subject workpad, and identify the highest-value first slice of the subject. For technical subjects, especially model building, inference, quantization, GGUF conversion, and Hugging Face release workflows, do comprehensive current research before choosing examples or package APIs. Record the source-backed findings in task notes or lesson metadata. Do not guess the current syntax, package names, keyword arguments, flags, or release workflows for external libraries or tools. If the lesson uses an external Python library, CLI, or model package, include enough documentation in code comments and teaching text that the learner can understand the relevant parameters and keywords without already knowing that package.",
    "",
    lessonType === "one_off" ? "=== ONE-OFF LESSON DESIGN GOAL ===" : "=== FIRST LESSON DESIGN GOAL ===",
    lessonType === "one_off"
      ? "The one-off lesson should synthesize the source material into the single highest-value learning experience. For a request like 'I have a meeting coming up and want one lesson on the important things to learn from it,' identify the important concepts, explain what they mean, why they matter, and how to apply them. Do not ask the learner to complete a separate calibration assessment first. Do not split the material across future lessons unless the configured target lesson count is greater than one."
      : "The first lesson should orient the learner to the big picture before diving into details. Explain why the subject matters, what problem the first concept solves, what breaks without it, and how it connects to the learner's long-term goal. Avoid broad survey fluff. Pick a concrete, learnable step that creates useful mental scaffolding and gives the model enough evidence to plan lesson 2.",
    "Phase behavior: familiarity lessons focus on high-level concepts, vocabulary, and how pieces relate. Competence lessons move into important details, mechanisms, edge cases, and practice. Mastery lessons emphasize transfer and integration. Post-mastery lessons are paper-driven and must center a recent, relevant, well-cited or frontier paper with clear citations.",
    "",
    "For the requested model-building and inference track, the first lesson should help the learner understand the lifecycle from data and tokenizer choices through training, inference, quantization, packaging, and release, while still teaching one concrete part deeply enough to practice. The end goal is practical competence in real model-building and inference work, so the lesson should point toward real workflows and vocabulary without pretending the learner already knows them.",
    "",
    "=== REQUIRED LESSON STRUCTURE ===",
    "The top-level overview audio is mandatory and must be long-form: at least 15 minutes, at least 2,700 words, and written as a stand-alone two-host podcast lesson with clear male/female speaker labels such as Leo: and Maya: at the start of each turn. It must be a single coherent authored transcript, written all at once, not padded by looping repeated summary passes. Never put a second speaker label inside another speaker's paragraph. Use a calm, conversational long-form interview / NotebookLM-style back-and-forth without imitating any specific living person. Leo teaches the mechanism in plain language. Maya is a curious skeptical student who challenges vague terms, asks why the concept matters, asks how the actual object changes, asks how that change helps the next prediction/decision/action, and asks 3-4 layer follow-up chains until the causal chain is clear. After the high-level frame, go deeper into each major concept individually instead of restating the same overview. The audio must be useful away from the screen and must not mention lesson parts, exercises, practice, assessments, or page structure. Define every major noun before using it. Do not leak authoring instructions or meta-planning phrases like 'the learner should', 'the lesson should', 'the overview should', 'the audio should', or 'the transcript should'. Speak in 'you' and 'we'. When formulas are discussed in audio, say them in words, for example 'Q times K transpose divided by the square root of d sub k', then explain what that quantity means.",
    "Break normal lessons into collapsed lesson parts. Each part needs first-class written teaching text, a per-part Doraemon voice audio script, an interactive or visual element that deepens understanding, and exactly 10 multiple-choice reinforcement questions requiring 4 correct answers in a row. The done/undone button is only a personal checklist marker and must never gate completion. Add a table of contents and stable deep links for each part and meaningful activity.",
    "",
    "Every major step should use a metaphor, at least three simple examples where useful, and a concrete explanation of why the step exists. Visualizations should not be decorative graphs. They should let the learner change something, see a consequence or failure mode, and understand what the step proves. Every visualization must have audio explanation or a per-part audio script explaining what to change, what to notice, and what the visual proves.",
    LOCAL_MODEL_BOUNDARY_REQUIREMENT,
    PURPOSE_BUILT_VISUAL_REQUIREMENT,
    "",
    "=== CODING PRACTICE AND HINTS ===",
    "If the lesson includes a coding part, provide a scaffolded practice_code activity with public tests and hidden tests. Hints must be progressive and unboxable all the way from high-level nudge to the full answer path. The recommended ladder is: level 1 conceptual hint, level 2 structural plan, level 3 package/API hint, level 4 syntax hint, level 5 near-complete answer, and level 6 complete answer explanation. The learner should be able to keep opening hints until they can finish even if they did not know a keyword, parameter name, or library convention. The starter code and comments should document any external Python library calls used by the exercise, including what important parameters mean and where the learner should change values. Do not assume the learner knows NumPy, PyTorch, Transformers, sentencepiece, gguf tooling, or any package-specific keyword arguments unless that exact usage has already been taught or documented in the lesson.",
    "",
    "The current app validator still rejects exposed solution fields in practice_code content, so do not put a top-level solution/answer field in the lesson payload. Put progressive answer support in hints and comments in a way the UI can reveal step by step, and keep tests authoritative.",
    "",
    LESSON_QUALITY_BAR_PROMPT,
    "",
    "=== COMPLETION REQUIREMENTS ===",
    "Create or repair the lesson in the real local SQLite database, generate or verify Doraemon voice audio, validate generated content, verify runtime artifact links, and smoke-test the lesson page in the browser. Update the subject workpad with concise long-term planning notes: what this first lesson taught, what remains uncertain, what lesson 2 should likely do, and what evidence should be collected from the learner.",
    SUBJECT_NOTES_AND_JOURNAL_REQUIREMENT,
    "",
    fmtChannelInstruction(channel),
  ].join("\n");
}

/**
 * Dora-task adapter - creates a Doramon todo-loop task for next-lesson generation.
 */
export const doraTaskAdapter: CompletionHookAdapter = {
  name: "dora-task",
  async dispatch(event: LessonCompletedEvent, config?: Record<string, unknown>) {
    const project = getConfiguredProject(config);
    const channel = getConfiguredChannel(config);

    const fmtTagPerf = event.tag_difficulty_performance.length
      ? event.tag_difficulty_performance
          .map(
            (p) =>
              `  - ${p.tag} [${p.difficulty}]: ${p.correct} correct, ${p.incorrect} wrong, ${p.idk} "don't know" (of ${p.total})`
          )
          .join("\n")
      : "  (no tagged attempts recorded)";
    const fmtDiagnostics = event.next_lesson_diagnostics.length
      ? event.next_lesson_diagnostics.map((d) => `  - Q: ${d.prompt}\n    A: ${d.answer}`).join("\n")
      : "  (no diagnostics answered)";
    const buffer = event.lesson_buffer;
    const fmtExistingReady = buffer?.existing_ready_lessons.length
      ? buffer.existing_ready_lessons
          .map((lesson) => `  - lesson ${lesson.id}, seq ${lesson.sequence_number}, ${lesson.status}: ${lesson.title}`)
          .join("\n")
      : "  (none)";

    const acceptance = [
      `Read ${AVOCADOCORE_LESSON_AUTHORING_SKILL} before doing any lesson work.`,
      "",
      `Maintain the next-lesson buffer for subject "${event.subject_title}" (learner ${event.learner_id}).`,
      "Be adaptive to the evidence below. Do not produce a generic next chapter.",
      "",
      "=== TWO-READY-LESSON BUFFER CONTRACT ===",
      `Target ready queued lessons after this work: ${buffer?.target_ready_count ?? 2}.`,
      `Queued ready lessons seen at completion time: ${buffer?.ready_count ?? 0}.`,
      `New lessons to generate: ${buffer?.lessons_to_generate ?? 1}.`,
      `Existing queued lessons requiring enrichment from the just-finished lesson: ${buffer?.enrichment_required_for_lesson_ids.join(", ") || "none"}.`,
      "Existing queued lessons:",
      fmtExistingReady,
      "If any queued lesson already exists, do not blindly create the next chapter. First inspect and repair the existing queued lesson in light of the just-completed lesson, the new mastery evidence, and the learner's diagnostic answers. You may retitle it, rewrite sections, change activities, add review, resequence it, regenerate media, or replace stale content. The immediate next lesson must learn from the completed lesson before the learner opens it. Only after existing queued lessons are enriched should you create enough additional queued lessons to maintain two ready lessons for this subject.",
      "Completion requires the subject to have two queued lessons that pass the full lesson readiness bar, including audio, approved interactives, and reviewed Manim segment videos. If media generation or browser QA is not finished, keep the task open or blocked rather than representing the lessons as ready.",
      "",
      "=== PEDAGOGICAL GOAL ===",
      "Find foundational weaknesses and bridge them as fast as possible with the least learner effort. Advance the curriculum only where the foundation is already solid. Prioritise subject-specific evidence first. Use profile config and cross-subject history only if they speed up mastery. Do not assume domain facts unless they are documented in AvocadoCore, present in SQLite evidence, or verified and recorded in the lesson/task notes.",
      "",
      "=== SUBJECT CONTEXT (use first) ===",
      `Goals: ${event.subject_goals || "(none set)"}`,
      `Learner preferences: ${event.subject_criteria || "(none set)"}`,
      `Current phase after completion: ${event.current_level}`,
      `Level progression: ${event.level_progression.reason}`,
      event.workpad_summary ? `AI workpad (current plan):\n${event.workpad_summary}` : "AI workpad: (none yet)",
      "",
      "=== PHASE-SPECIFIC AUTHORING ===",
      "Familiarity means teach the high-level concepts, vocabulary, and relationships. Competence means move into the important details, mechanisms, edge cases, and practice. Mastery means emphasize transfer, integration, and harder evidence.",
      event.current_level === "post_mastery"
        ? "Post-mastery is now active. The next lesson must find a recent, relevant, well-cited or frontier paper, cite it clearly, explain why it matters for this subject, and teach what the paper adds beyond the learner's mastered foundation. Do not generate another fundamentals lesson unless the evidence below proves a blocking gap."
        : "Do not jump into frontier-paper study until the stored current phase is post_mastery.",
      "Every generated next lesson still begins with a long-form stand-alone top-level audio lesson: at least 15 minutes, at least 2,700 words, two-host male/female podcast transcript, useful away from the screen, with Leo teaching mechanisms in plain language and Maya acting as a curious skeptical student who drills into why the concept matters, how the actual object changes, and how that change helps the next prediction/decision/action. The audio must not mention lesson parts, exercises, practice, assessments, or page structure. Do not leak meta-authoring language such as 'the learner should', 'the lesson should', 'the overview should', 'the audio should', or 'the transcript should'. Speak directly with 'you' and 'we'. If formulas appear in audio, describe them in words first and keep raw notation for LaTeX reading blocks.",
      LOCAL_MODEL_BOUNDARY_REQUIREMENT,
      "",
      "=== THIS LESSON ===",
      `Prior lesson: "${event.lesson_title}"  | Goals: ${event.lesson_goals.join(", ")}`,
      event.quiz_result
        ? `Quiz: ${event.quiz_result.passed ? "passed" : "not passed"} (${event.quiz_result.correct_count}/${event.quiz_result.pass_threshold})`
        : "Quiz: (none)",
      "Freeform assessment Q&A:",
      event.assessment_qa.map((qa) => `  - Q: ${qa.question}\n    A: ${qa.learner_answer}`).join("\n"),
      "",
      "=== TAG + DIFFICULTY PERFORMANCE (the queryable evidence) ===",
      fmtTagPerf,
      "",
      "=== END-OF-LESSON DIAGNOSTICS (what the learner wants next) ===",
      fmtDiagnostics,
      "",
      "=== MASTERY SIGNALS ===",
      `Concepts to review: ${event.concepts_to_review.join(", ") || "none"}`,
      `Concepts ready to advance: ${event.concepts_ready_to_advance.join(", ") || "none"}`,
      `Recent misconceptions: ${event.recent_misconceptions.join(", ") || "none"}`,
      "",
      "=== CURRICULUM CONTEXT ===",
      `Completed lessons: ${event.completed_lessons.map((l) => l.title).join("; ") || "none"}`,
      `Discarded lessons (avoid repeating): ${event.discarded_lessons.map((l) => `${l.title}${l.reason ? ` (${l.reason})` : ""}`).join("; ") || "none"}`,
      "",
      "=== SECONDARY CONTEXT (use only if it helps) ===",
      `Profile config: ${event.learner_profile_config ? JSON.stringify(event.learner_profile_config) : "(none)"}`,
      `Cross-subject mastery: ${event.cross_subject_history.map((c) => `${c.subject_title}=${c.mastery_score ?? "n/a"}`).join(", ") || "(none)"}`,
      "",
      "=== CODING PRACTICE AND HINTS ===",
      "For any practice_code activity, hints must be progressive and unboxable all the way to the answer path: conceptual nudge, structural plan, package/API hint, syntax hint, near-complete answer, and complete answer explanation. If an external Python library is used, comments in starter code and teaching text must document the relevant package calls and parameters. Do not assume the learner knows keywords, parameter names, or package conventions.",
      "",
      LESSON_QUALITY_BAR_PROMPT,
      "",
      PURPOSE_BUILT_VISUAL_REQUIREMENT,
      "",
      SUBJECT_NOTES_AND_JOURNAL_REQUIREMENT,
      "",
      "Delivery:",
      fmtChannelInstruction(channel),
    ].join("\n");

    return createDoraTask(
      {
        project,
        title: `Maintain two ready lessons: ${event.subject_title} (after "${event.lesson_title}")`,
        acceptance,
        metadata: { lesson_completed_event: event },
      },
      config
    );
  },
};

/**
 * Dora-task regeneration adapter - creates a Doramon todo-loop task for a
 * replacement lesson after a learner discards an incomplete lesson.
 */
export const doraTaskRegenerationAdapter: RegenerationHookAdapter = {
  name: "dora-task",
  async dispatch(event: LessonDiscardedEvent, config?: Record<string, unknown>) {
    const project = getConfiguredProject(config);
    const channel = getConfiguredChannel(config);

    const acceptance = [
      `Read ${AVOCADOCORE_LESSON_AUTHORING_SKILL} before doing any lesson work.`,
      "",
      `Generate a REPLACEMENT lesson for subject "${event.subject_title}" (learner ${event.learner_id}).`,
      "",
      "IMPORTANT: The learner discarded the previous lesson. This is not a retry of the same lesson. Read the subject context carefully and generate a better-aligned lesson.",
      "",
      "=== SUBJECT CONTEXT ===",
      `Title: ${event.subject_title}`,
      event.subject_description ? `Description: ${event.subject_description}` : "",
      event.subject_goals ? `Learning goals:\n${event.subject_goals}` : "",
      event.subject_criteria
        ? `Learner preferences:\n${event.subject_criteria}`
        : "(no learner preferences set - use subject goals and progress signals as the main guide)",
      "",
      "=== DISCARDED LESSON ===",
      `Lesson: "${event.discarded_lesson_title}" (id: ${event.discarded_lesson_id})`,
      `Status at discard: ${event.discarded_lesson_status}`,
      event.discard_reason
        ? `Learner's reason for discarding: ${event.discard_reason}`
        : "(learner did not provide a specific reason)",
      "",
      "=== LEARNING PROGRESS ===",
      `Mastery score: ${event.mastery_score !== null ? `${event.mastery_score.toFixed(0)}/100` : "not yet measured"}`,
      event.completed_lessons.length > 0
        ? `Completed lessons:\n${event.completed_lessons.map((l) => `  - ${l.title} (${l.completed_at.slice(0, 10)})`).join("\n")}`
        : "No completed lessons yet.",
      event.mastery_signals.length > 0
        ? `Mastery signals:\n${event.mastery_signals
            .slice(0, 10)
            .map((s) => `  - [${s.signal_type}] ${s.concept}${s.detail ? `: ${s.detail}` : ""}`)
            .join("\n")}`
        : "No mastery signals recorded yet.",
      "",
      event.workpad_summary
        ? `=== AI WORKPAD (current plan summary) ===\n${event.workpad_summary}\n`
        : "",
      "=== INSTRUCTIONS ===",
      "Before writing the replacement lesson, review the subject goals, learner criteria, discard reason, current workpad, and mastery evidence. If the learner gave a reason such as too easy, too hard, wrong topic, or bad style, explicitly correct that failure mode. Update the workpad with what you decided and why, then generate a lesson that better fits the learner's goals, criteria, and current level.",
      "The replacement lesson must include a long-form stand-alone top-level audio lesson: at least 15 minutes, at least 2,700 words, written as a two-host male/female podcast transcript, useful away from the screen, with Leo teaching mechanisms in plain language and Maya acting as a curious skeptical student who drills into why the concept matters, how the actual object changes, and how that change helps the next prediction/decision/action. The audio must not mention lesson parts, exercises, practice, assessments, or page structure. Do not leak meta-authoring language such as 'the learner should', 'the lesson should', 'the overview should', 'the audio should', or 'the transcript should'. Speak directly with 'you' and 'we'. If formulas appear in audio, describe them in words first and keep raw notation for LaTeX reading blocks.",
      LOCAL_MODEL_BOUNDARY_REQUIREMENT,
      "",
      "=== CODING PRACTICE AND HINTS ===",
      "If the replacement lesson includes code, provide progressive, unboxable hints that can be opened until the learner reaches the full answer path. Do not assume package-specific keywords or parameters are known. Document every external Python library in starter-code comments and teaching text.",
      "",
      LESSON_QUALITY_BAR_PROMPT,
      "",
      PURPOSE_BUILT_VISUAL_REQUIREMENT,
      "",
      SUBJECT_NOTES_AND_JOURNAL_REQUIREMENT,
      "",
      "Completion:",
      channel
        ? `After generating the replacement lesson, post a summary in <#${channel}> explaining what changed vs the discarded lesson and how it addresses the learner's feedback. Tag the learner in the thread.`
        : "After generating the replacement lesson, confirm completion in the appropriate channel.",
    ]
      .filter((line) => line !== "")
      .join("\n");

    return createDoraTask(
      {
        project,
        title: `Generate replacement lesson: ${event.subject_title} (discarded "${event.discarded_lesson_title}")`,
        acceptance,
        metadata: { lesson_discarded_event: event },
      },
      config
    );
  },
};

/**
 * Dora-task subject.created dispatcher — creates a Doramon todo-loop task so
 * an ACP worker generates the first lesson for the new subject.
 * Returns ok=true with a task ref but no lesson_id (lesson is created async by the worker).
 */
export const doraTaskSubjectCreatedDispatcher: SubjectCreatedDispatcher = async (
  event
) => {
  return dispatchSubjectCreatedLessonTask(event);
};

export async function dispatchSubjectCreatedLessonTask(
  event: SubjectCreatedEvent,
  config?: Record<string, unknown>
): Promise<{ ok: boolean; ref?: string; error?: string }> {
  const project = getConfiguredProject(config);
  const channel = getConfiguredChannel(config);
  return createDoraTask(
    {
      project,
      title: `${event.lesson_type === "one_off" ? "Generate one-off lesson" : "Generate first lesson"}: ${event.subject_title}`,
      acceptance: buildFirstLessonAcceptance(event, channel),
      metadata: { subject_created_event: event },
    },
    config
  );
}
