/**
 * Semantic QA reviewer — deterministic content gathering + pre-screen heuristics.
 *
 * This module reads a generated lesson's content from the database and extracts
 * the pieces the semantic reviewer needs to evaluate (transcripts, synced-visual
 * cue timelines, practice questions, code exercises). It also computes a set of
 * DETERMINISTIC pre-screen flags — cheap keyword/structure/coverage checks that
 * surface likely problems to the reviewer.
 *
 * IMPORTANT: the pre-screen flags are INPUTS to the semantic reviewer, never the
 * final quality gate. The acceptance criteria forbids using regex-only or
 * keyword-only checks as the final gate; the LLM reviewer makes the semantic
 * verdict and the flags simply direct its attention. Everything in this file is
 * pure/deterministic and unit-tested without any model calls.
 */

import type Database from "better-sqlite3";

// ─── Gathered content shapes ───────────────────────────────────────────────────

export interface GatheredTranscript {
  /** Source label, e.g. "overview" or the lesson_part id/title. */
  source: string;
  script: string;
  transcript: string;
  durationHint: number | null;
  wordCount: number;
}

export interface GatheredCue {
  source: string;
  start: number;
  end: number | null;
  label: string;
  headline: string;
  narration: string;
  receive?: string;
  transform?: string;
  pass?: string;
}

export interface GatheredCueTimeline {
  source: string;
  durationHint: number | null;
  cues: GatheredCue[];
}

export interface GatheredChoiceQuestion {
  source: string;
  kind: "multiple_choice" | "select_one" | "select_all";
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number | null;
  correctIndices: number[] | null;
  allowMultipleCorrect: boolean;
  explanation: string;
}

export interface GatheredWrittenQuestion {
  source: string;
  id: string;
  prompt: string;
  actualAnswer: string | null;
  rubric: string | null;
}

export interface GatheredCodeExercise {
  source: string;
  prompt: string;
  starterCode: string | null;
  workedExamples: Array<{ label: string; code: string }>;
  tests: Array<{ id: string; description: string; assert: string }>;
  hiddenTests: Array<{ id: string; description: string; assert: string }>;
}

export type PreScreenSeverity = "warn" | "severe";

export type PreScreenCriterion =
  | "transcript_generator_structure"
  | "transcript_generic_advice"
  | "transcript_repetition"
  | "visual_template_placeholder"
  | "visual_low_coverage"
  | "question_degenerate_grading"
  | "written_rubric_reveals_answer"
  | "code_signature_mismatch";

export interface PreScreenFlag {
  criterion: PreScreenCriterion;
  severity: PreScreenSeverity;
  source: string;
  detail: string;
  /** A short quote/snippet of the offending content, when applicable. */
  quote?: string;
}

export interface GatheredLesson {
  lessonId: number;
  title: string;
  transcripts: GatheredTranscript[];
  cueTimelines: GatheredCueTimeline[];
  choiceQuestions: GatheredChoiceQuestion[];
  writtenQuestions: GatheredWrittenQuestion[];
  codeExercises: GatheredCodeExercise[];
  flags: PreScreenFlag[];
}

// ─── Small helpers ──────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Deterministic pre-screen heuristics ────────────────────────────────────────

/**
 * Generator-structure / meta-planning phrases that must never appear in a spoken
 * transcript. Mirrors the forbidden phrases in the lesson-generator contract.
 */
const GENERATOR_STRUCTURE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bpoint\s+\d+\b/i, label: '"Point N" enumeration' },
  { re: /\blesson\s+parts?\b/i, label: '"lesson part(s)"' },
  { re: /\b(first|second|third|fourth)\s+layer\b/i, label: '"Nth layer" scaffolding' },
  { re: /\bstart\s+socratically\b/i, label: '"start Socratically"' },
  { re: /\bgo\s+one\s+layer\s+deeper\b/i, label: '"go one layer deeper"' },
  { re: /\bthe\s+(learner|lesson|audio|overview|transcript)\s+should\b/i, label: 'meta "the X should"' },
  { re: /\bthis\s+(lesson\s+part|section)\b/i, label: 'page-structure "this lesson part/section"' },
  { re: /\b(the\s+)?(practice|exercises?|assessments?)\s+(section|below|that follow)/i, label: 'page-structure reference to exercises/assessment' },
];

/** Generic "how to learn" study-coaching phrases (not teaching the actual topic). */
const GENERIC_ADVICE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(do not|don'?t)\s+(try\s+to\s+)?memoriz/i, label: '"don\'t memorize" study coaching' },
  { re: /\bspaced\s+repetition\b/i, label: '"spaced repetition" study coaching' },
  { re: /\bactive\s+recall\b/i, label: '"active recall" study coaching' },
  { re: /\btake\s+(good\s+)?notes\b/i, label: '"take notes" study coaching' },
  { re: /\bhow\s+to\s+study\b/i, label: '"how to study" study coaching' },
];

/** Generic template placeholder cue labels with no lesson-specific content. */
const TEMPLATE_PLACEHOLDER_LABELS = new Set([
  "input",
  "transform",
  "handoff",
  "output",
  "receive",
  "pass",
  "process",
  "step",
]);

function detectGeneratorStructure(t: GatheredTranscript): PreScreenFlag[] {
  const flags: PreScreenFlag[] = [];
  const haystack = `${t.script}\n${t.transcript}`;
  for (const { re, label } of GENERATOR_STRUCTURE_PATTERNS) {
    const m = haystack.match(re);
    if (m) {
      flags.push({
        criterion: "transcript_generator_structure",
        severity: "severe",
        source: t.source,
        detail: `Transcript contains generator-structure language (${label}).`,
        quote: snippetAround(haystack, m.index ?? 0),
      });
    }
  }
  return flags;
}

function detectGenericAdvice(t: GatheredTranscript): PreScreenFlag[] {
  const flags: PreScreenFlag[] = [];
  const haystack = `${t.script}\n${t.transcript}`;
  for (const { re, label } of GENERIC_ADVICE_PATTERNS) {
    const m = haystack.match(re);
    if (m) {
      flags.push({
        criterion: "transcript_generic_advice",
        severity: "warn",
        source: t.source,
        detail: `Transcript contains generic study-coaching (${label}) instead of teaching the specific topic.`,
        quote: snippetAround(haystack, m.index ?? 0),
      });
    }
  }
  return flags;
}

/** Detect a long sentence repeated verbatim (looping content). */
function detectRepetition(t: GatheredTranscript): PreScreenFlag[] {
  const sentences = t.transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((s) => s.length >= 40);
  const seen = new Map<string, number>();
  for (const s of sentences) {
    seen.set(s, (seen.get(s) ?? 0) + 1);
  }
  const flags: PreScreenFlag[] = [];
  for (const [sentence, count] of seen) {
    if (count > 1) {
      flags.push({
        criterion: "transcript_repetition",
        severity: "warn",
        source: t.source,
        detail: `A substantive sentence repeats ${count} times without adding new information (looping).`,
        quote: sentence.slice(0, 160),
      });
      break; // one flag per transcript is enough signal
    }
  }
  return flags;
}

function snippetAround(text: string, index: number): string {
  const start = Math.max(0, index - 30);
  return text.slice(start, index + 90).replace(/\s+/g, " ").trim();
}

/** Coverage and template-placeholder checks for a cue timeline. */
export function detectCueFlags(timeline: GatheredCueTimeline): PreScreenFlag[] {
  const flags: PreScreenFlag[] = [];
  const { cues, durationHint, source } = timeline;
  if (cues.length === 0) return flags;

  // Coverage: last covered second vs the audio duration. The deterministic
  // validator enforces 80%; below that is a strong (severe) signal.
  if (durationHint && durationHint > 0) {
    const lastCovered = Math.max(...cues.map((c) => c.end ?? c.start));
    const coverage = lastCovered / durationHint;
    if (coverage < 0.8) {
      flags.push({
        criterion: "visual_low_coverage",
        severity: "severe",
        source,
        detail: `Synced-visual cues cover only ${Math.round(coverage * 100)}% of the ${Math.round(
          durationHint
        )}s audio (last cue ends at ${Math.round(lastCovered)}s). Cues should track the whole narration.`,
      });
    }
  }

  // Template placeholders: generic labels with no lesson-specific headline text.
  const placeholderCues = cues.filter((c) => {
    const label = c.label.trim().toLowerCase();
    const headline = c.headline.trim();
    const isPlaceholderLabel = TEMPLATE_PLACEHOLDER_LABELS.has(label);
    const headlineHasContent = headline.length > 0 && !TEMPLATE_PLACEHOLDER_LABELS.has(headline.toLowerCase());
    return isPlaceholderLabel && !headlineHasContent;
  });
  if (placeholderCues.length > 0) {
    flags.push({
      criterion: "visual_template_placeholder",
      severity: "severe",
      source,
      detail: `${placeholderCues.length} of ${cues.length} cues use generic template placeholder labels (e.g. Input/Transform/Handoff) without content-specific text.`,
      quote: placeholderCues
        .slice(0, 4)
        .map((c) => c.label)
        .join(" / "),
    });
  }
  return flags;
}

/** Degenerate grading detection for a choice question. */
export function detectDegenerateQuestion(q: GatheredChoiceQuestion): PreScreenFlag | null {
  const n = q.choices.length;
  if (n === 0) return null;

  // Multi-select: all correct is always degenerate. None correct is only
  // legitimate when a "None of the above" choice is present.
  if (q.allowMultipleCorrect || q.kind === "select_all" || q.correctIndices !== null) {
    const indices = q.correctIndices ?? [];
    if (indices.length === n) {
      return {
        criterion: "question_degenerate_grading",
        severity: "severe",
        source: q.source,
        detail: `Select-all question "${q.id}" marks ALL ${n} choices correct (degenerate grading).`,
        quote: q.prompt.slice(0, 120),
      };
    }
    // A select-all with an empty correct set is the intentional "none of these
    // apply" variety the generator authors on purpose, so it is not degenerate.
    // A classic multiple-choice question that nonetheless declares an empty
    // correct_indices (and offers no "None of the above") is genuinely ungradeable.
    if (indices.length === 0 && q.kind !== "select_all") {
      const hasNoneOfTheAbove = q.choices.some((c) => /\bnone\s+of\s+the\s+above\b/i.test(c));
      if (!hasNoneOfTheAbove) {
        return {
          criterion: "question_degenerate_grading",
          severity: "warn",
          source: q.source,
          detail: `Question "${q.id}" marks NO choice correct and offers no "None of the above" option (degenerate grading).`,
          quote: q.prompt.slice(0, 120),
        };
      }
    }
    return null;
  }

  // Single-choice: correct_index must be a valid in-range index.
  if (q.correctIndex === null || q.correctIndex < 0 || q.correctIndex >= n) {
    return {
      criterion: "question_degenerate_grading",
      severity: "severe",
      source: q.source,
      detail: `Question "${q.id}" has an out-of-range or missing correct_index (${q.correctIndex}) for ${n} choices.`,
      quote: q.prompt.slice(0, 120),
    };
  }
  return null;
}

/** Rubric-reveals-answer detection for a written question. */
export function detectRubricRevealsAnswer(q: GatheredWrittenQuestion): PreScreenFlag | null {
  const answer = (q.actualAnswer ?? "").trim();
  const rubric = (q.rubric ?? "").trim();
  if (answer.length < 12 || !rubric) return null;
  if (rubric.toLowerCase().includes(answer.toLowerCase())) {
    return {
      criterion: "written_rubric_reveals_answer",
      severity: "severe",
      source: q.source,
      detail: `Written question "${q.id}" rubric reveals the expected answer verbatim in the grading text shown to the learner.`,
      quote: answer.slice(0, 120),
    };
  }
  return null;
}

/** Extract the first Python function signature (name + ordered param names). */
export function parsePythonSignature(code: string): { name: string; params: string[] } | null {
  const m = code.match(/def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
  if (!m) return null;
  const name = m[1];
  const params = m[2]
    .split(",")
    .map((p) => p.trim().split(/[:=]/)[0].trim())
    .filter((p) => p.length > 0 && p !== "self");
  return { name, params };
}

/** Reference-answer signature must match the starter code's function signature. */
export function detectCodeSignatureMismatch(ex: GatheredCodeExercise): PreScreenFlag | null {
  if (!ex.starterCode) return null;
  const starterSig = parsePythonSignature(ex.starterCode);
  if (!starterSig) return null;
  // Compare against the worked example that defines the same function name if
  // present, else the first worked example.
  const withCode = ex.workedExamples.filter((w) => w.code && w.code.trim());
  if (withCode.length === 0) return null;
  const match =
    withCode.find((w) => parsePythonSignature(w.code)?.name === starterSig.name) ?? withCode[0];
  const answerSig = parsePythonSignature(match.code);
  if (!answerSig) return null;
  if (answerSig.name !== starterSig.name) {
    return {
      criterion: "code_signature_mismatch",
      severity: "severe",
      source: ex.source,
      detail: `Reference answer defines "${answerSig.name}(...)" but the starter code defines "${starterSig.name}(...)". Signatures must match exactly.`,
    };
  }
  if (answerSig.params.join(",") !== starterSig.params.join(",")) {
    return {
      criterion: "code_signature_mismatch",
      severity: "severe",
      source: ex.source,
      detail: `Reference answer signature "${answerSig.name}(${answerSig.params.join(
        ", "
      )})" does not match the starter code "${starterSig.name}(${starterSig.params.join(", ")})".`,
    };
  }
  return null;
}

/** Compute every pre-screen flag from already-gathered content. Pure + testable. */
export function computePreScreenFlags(
  gathered: Omit<GatheredLesson, "flags">
): PreScreenFlag[] {
  const flags: PreScreenFlag[] = [];
  for (const t of gathered.transcripts) {
    flags.push(...detectGeneratorStructure(t));
    flags.push(...detectGenericAdvice(t));
    flags.push(...detectRepetition(t));
  }
  for (const timeline of gathered.cueTimelines) {
    flags.push(...detectCueFlags(timeline));
  }
  for (const q of gathered.choiceQuestions) {
    const f = detectDegenerateQuestion(q);
    if (f) flags.push(f);
  }
  for (const q of gathered.writtenQuestions) {
    const f = detectRubricRevealsAnswer(q);
    if (f) flags.push(f);
  }
  for (const ex of gathered.codeExercises) {
    const f = detectCodeSignatureMismatch(ex);
    if (f) flags.push(f);
  }
  return flags;
}

// ─── Content extraction from activity JSON ──────────────────────────────────────

function extractSyncedVisual(
  source: string,
  visual: unknown,
  durationHint: number | null
): GatheredCueTimeline | null {
  if (!visual || typeof visual !== "object") return null;
  const v = visual as Record<string, unknown>;
  const rawCues = Array.isArray(v.cues) ? v.cues : [];
  if (rawCues.length === 0) return null;
  const cues: GatheredCue[] = rawCues.map((rc) => {
    const c = (rc ?? {}) as Record<string, unknown>;
    return {
      source,
      start: typeof c.start === "number" ? c.start : 0,
      end: typeof c.end === "number" ? c.end : null,
      label: asString(c.label),
      headline: asString(c.headline),
      narration: asString(c.narration),
      receive: asString(c.receive) || undefined,
      transform: asString(c.transform) || undefined,
      pass: asString(c.pass) || undefined,
    };
  });
  return { source, durationHint, cues };
}

function extractChoiceQuestion(
  source: string,
  raw: unknown,
  kind: GatheredChoiceQuestion["kind"]
): GatheredChoiceQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const choices = Array.isArray(q.choices) ? q.choices.map(asString) : [];
  if (choices.length === 0) return null;
  return {
    source,
    kind,
    id: asString(q.id) || "(unlabeled)",
    prompt: asString(q.question) || asString(q.prompt),
    choices,
    correctIndex: typeof q.correct_index === "number" ? q.correct_index : null,
    correctIndices: Array.isArray(q.correct_indices)
      ? (q.correct_indices.filter((n) => typeof n === "number") as number[])
      : null,
    allowMultipleCorrect: q.allow_multiple_correct === true || kind === "select_all",
    explanation: asString(q.explanation),
  };
}

function extractCodeExercise(source: string, raw: unknown): GatheredCodeExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const workedExamples = Array.isArray(c.worked_examples)
    ? c.worked_examples
        .map((w) => {
          const we = (w ?? {}) as Record<string, unknown>;
          return { label: asString(we.label), code: asString(we.code) };
        })
        .filter((w) => w.code)
    : [];
  const mapTests = (arr: unknown): GatheredCodeExercise["tests"] =>
    Array.isArray(arr)
      ? arr.map((t) => {
          const tt = (t ?? {}) as Record<string, unknown>;
          return {
            id: asString(tt.id),
            description: asString(tt.description),
            assert: asString(tt.assert),
          };
        })
      : [];
  return {
    source,
    prompt: asString(c.prompt),
    starterCode: asString(c.starter_code) || null,
    workedExamples,
    tests: mapTests(c.tests),
    hiddenTests: mapTests(c.hidden_tests),
  };
}

/**
 * Gather every reviewable piece of a lesson from the database and attach the
 * deterministic pre-screen flags. This is the single entry point the reviewer,
 * CLI, and harness integration all call.
 */
export function gatherLessonForReview(db: Database.Database, lessonId: number): GatheredLesson {
  const lesson = db.prepare("SELECT id, title FROM lessons WHERE id = ?").get(lessonId) as
    | { id: number; title: string }
    | undefined;
  if (!lesson) {
    throw new Error(`gatherLessonForReview: lesson ${lessonId} not found`);
  }

  const activities = db
    .prepare(
      "SELECT activity_type, title, content FROM lesson_activities WHERE lesson_id = ? ORDER BY sequence_order ASC"
    )
    .all(lessonId) as Array<{ activity_type: string; title: string | null; content: string | null }>;

  const transcripts: GatheredTranscript[] = [];
  const cueTimelines: GatheredCueTimeline[] = [];
  const choiceQuestions: GatheredChoiceQuestion[] = [];
  const writtenQuestions: GatheredWrittenQuestion[] = [];
  const codeExercises: GatheredCodeExercise[] = [];

  for (const activity of activities) {
    const content = safeJsonParse(activity.content);
    if (!content || typeof content !== "object") continue;
    const c = content as Record<string, unknown>;

    if (activity.activity_type === "audio") {
      const script = asString(c.script);
      const transcript = asString(c.transcript) || script;
      const durationHint = typeof c.duration_hint === "number" ? c.duration_hint : null;
      if (script.trim()) {
        transcripts.push({
          source: "overview",
          script,
          transcript,
          durationHint,
          wordCount: wordCount(transcript || script),
        });
      }
      const timeline = extractSyncedVisual("overview", c.orientation_visual, durationHint);
      if (timeline) cueTimelines.push(timeline);
    } else if (activity.activity_type === "lesson_part") {
      const partId = asString(c.part_id) || asString(activity.title) || "lesson_part";
      const audio = (c.audio ?? {}) as Record<string, unknown>;
      const script = asString(audio.script);
      const transcript = asString(audio.transcript) || script;
      const durationHint = typeof audio.duration_hint === "number" ? audio.duration_hint : null;
      if (script.trim()) {
        transcripts.push({
          source: partId,
          script,
          transcript,
          durationHint,
          wordCount: wordCount(transcript || script),
        });
      }
      const timeline = extractSyncedVisual(partId, audio.synced_visual, durationHint);
      if (timeline) cueTimelines.push(timeline);

      // Lesson-part practice questions (select_one / select_all / written).
      const practice = (c.practice ?? {}) as Record<string, unknown>;
      const questions = Array.isArray(practice.questions) ? practice.questions : [];
      for (const rawQ of questions) {
        const q = (rawQ ?? {}) as Record<string, unknown>;
        const type = asString(q.type);
        if (type === "written") {
          writtenQuestions.push({
            source: partId,
            id: asString(q.id) || "(unlabeled)",
            prompt: asString(q.prompt),
            actualAnswer: asString(q.actual_answer) || null,
            rubric: asString(q.rubric) || null,
          });
        } else if (type === "select_one" || type === "select_all") {
          const cq = extractChoiceQuestion(partId, q, type);
          if (cq) choiceQuestions.push(cq);
        }
      }

      const code = extractCodeExercise(partId, c.code);
      if (code) codeExercises.push(code);
    } else if (activity.activity_type === "practice_code") {
      const code = extractCodeExercise("final_code", content);
      if (code) codeExercises.push(code);
    } else if (activity.activity_type === "assessment") {
      // Freeform (written) questions.
      const freeform = Array.isArray(c.questions) ? c.questions : [];
      for (const rawQ of freeform) {
        const q = (rawQ ?? {}) as Record<string, unknown>;
        writtenQuestions.push({
          source: "assessment",
          id: asString(q.id) || "(unlabeled)",
          prompt: asString(q.text) || asString(q.prompt),
          actualAnswer: asString(q.actual_answer) || null,
          rubric: asString(q.rubric) || null,
        });
      }
      // Multiple-choice quiz questions.
      const quiz = (c.quiz ?? {}) as Record<string, unknown>;
      const mcQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
      for (const rawQ of mcQuestions) {
        const cq = extractChoiceQuestion("assessment", rawQ, "multiple_choice");
        if (cq) choiceQuestions.push(cq);
      }
    }
  }

  const partial: Omit<GatheredLesson, "flags"> = {
    lessonId,
    title: lesson.title,
    transcripts,
    cueTimelines,
    choiceQuestions,
    writtenQuestions,
    codeExercises,
  };
  const flags = computePreScreenFlags(partial);
  return { ...partial, flags };
}
