/**
 * AvocadoCore lesson content schemas (non-interactive activities).
 *
 * These typed contracts cover the lesson content blocks that are NOT the
 * interactive widget system (which lives in src/lib/widgets). They define the
 * shape and validation for:
 *
 *  - `reading`  — first-class written teaching text (headings, definitions,
 *                 worked examples, callouts, lists, and a review summary).
 *  - `media`    — safe embedded media (YouTube), built from a validated video
 *                 id or a privacy-enhanced URL, with reason + fallback text.
 *  - `practice_code` — scaffolded code exercises with hints, constraints,
 *                 guided steps, public tests, and hidden tests. The final
 *                 solution is never part of the lesson content; the learner
 *                 must submit code that passes tests.
 *
 * Everything here is data-only and framework-agnostic so the validator can be
 * imported by both the generator contract and the UI without pulling in React.
 */

// ─── Written lesson text ─────────────────────────────────────────────────────

export type ReadingBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "definition"; term: string; definition: string }
  | { type: "example"; title?: string; body: string }
  | { type: "callout"; tone?: "info" | "warning" | "insight"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] };

export interface ReadingContent {
  /** Optional short intro shown above the blocks. */
  intro?: string;
  blocks: ReadingBlock[];
  /** Short review/summary so the text is useful for skimming and revision. */
  summary?: string;
}

const READING_BLOCK_TYPES = new Set([
  "heading",
  "paragraph",
  "definition",
  "example",
  "callout",
  "list",
]);

/**
 * Validate a written-text (reading) activity's content.
 * Reading must be substantive teaching content, not an empty shell or a bare
 * transcript dump, so we require a non-trivial number of blocks with real text.
 */
export function validateReadingContent(content: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!content || typeof content !== "object") {
    return { valid: false, errors: ["reading content must be an object"] };
  }
  const c = content as Record<string, unknown>;
  if (!Array.isArray(c.blocks)) {
    return { valid: false, errors: ["reading content requires a blocks array"] };
  }
  if (c.blocks.length < 2) {
    errors.push("reading content needs at least 2 blocks of real teaching text");
  }

  let textBlocks = 0;
  for (const [i, raw] of c.blocks.entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`reading blocks[${i}] must be an object`);
      continue;
    }
    const b = raw as Record<string, unknown>;
    if (typeof b.type !== "string" || !READING_BLOCK_TYPES.has(b.type)) {
      errors.push(`reading blocks[${i}] has unsupported type "${String(b.type)}"`);
      continue;
    }
    switch (b.type) {
      case "heading":
      case "paragraph":
      case "callout":
        if (typeof b.text !== "string" || !b.text.trim()) {
          errors.push(`reading blocks[${i}] (${b.type}) missing text`);
        } else textBlocks++;
        break;
      case "definition":
        if (typeof b.term !== "string" || !b.term.trim()) {
          errors.push(`reading blocks[${i}] (definition) missing term`);
        }
        if (typeof b.definition !== "string" || !b.definition.trim()) {
          errors.push(`reading blocks[${i}] (definition) missing definition`);
        } else textBlocks++;
        break;
      case "example":
        if (typeof b.body !== "string" || !b.body.trim()) {
          errors.push(`reading blocks[${i}] (example) missing body`);
        } else textBlocks++;
        break;
      case "list":
        if (!Array.isArray(b.items) || b.items.length === 0) {
          errors.push(`reading blocks[${i}] (list) needs a non-empty items array`);
        } else if (!b.items.every((it) => typeof it === "string" && it.trim())) {
          errors.push(`reading blocks[${i}] (list) items must be non-empty strings`);
        } else textBlocks++;
        break;
    }
  }

  if (textBlocks < 2) {
    errors.push("reading content needs at least 2 substantive text blocks");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Embedded media (YouTube) ────────────────────────────────────────────────

export type MediaProvider = "youtube";

export interface MediaEmbed {
  provider: MediaProvider;
  /** Either a video_id or a recognizable YouTube url is required. */
  video_id?: string;
  url?: string;
  title: string;
  /** Why this video is included — shown to the learner. */
  reason: string;
  /** Optional start time in seconds. */
  start?: number;
  /** Shown if the embed cannot load (offline, blocked, removed). */
  fallback_text: string;
}

export interface MediaContent {
  embeds: MediaEmbed[];
}

/** YouTube video ids are exactly 11 url-safe base64 characters. */
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract a YouTube video id from a url, or return null. Accepts the common
 * youtube.com/watch?v=, youtu.be/, /embed/, and youtube-nocookie.com forms.
 * Anything else (arbitrary domains, javascript:, data:, non-YouTube hosts) is
 * rejected so we never build an iframe from untrusted input.
 */
export function extractYouTubeId(url: string): string | null {
  if (typeof url !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const allowedHosts = new Set([
    "youtube.com",
    "m.youtube.com",
    "youtube-nocookie.com",
    "youtu.be",
  ]);
  if (!allowedHosts.has(host)) return null;

  let id: string | null = null;
  if (host === "youtu.be") {
    id = parsed.pathname.slice(1).split("/")[0] || null;
  } else if (parsed.pathname === "/watch") {
    id = parsed.searchParams.get("v");
  } else if (parsed.pathname.startsWith("/embed/")) {
    id = parsed.pathname.split("/embed/")[1]?.split("/")[0] ?? null;
  } else if (parsed.pathname.startsWith("/v/")) {
    id = parsed.pathname.split("/v/")[1]?.split("/")[0] ?? null;
  }
  if (id && YT_ID_RE.test(id)) return id;
  return null;
}

/**
 * Resolve a media embed to a validated YouTube video id, or null if it cannot
 * be safely resolved. The UI uses this to decide between an iframe and the
 * fallback.
 */
export function resolveYouTubeId(embed: Pick<MediaEmbed, "video_id" | "url">): string | null {
  if (embed.video_id && YT_ID_RE.test(embed.video_id)) return embed.video_id;
  if (embed.url) return extractYouTubeId(embed.url);
  return null;
}

/**
 * Build a privacy-enhanced YouTube embed URL from a validated id. Uses the
 * youtube-nocookie.com domain and conservative player params. Never call this
 * with unvalidated input — always go through resolveYouTubeId first.
 */
export function buildYouTubeEmbedUrl(videoId: string, start?: number): string {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (typeof start === "number" && Number.isFinite(start) && start > 0) {
    params.set("start", String(Math.floor(start)));
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Validate a media activity's content. Each embed must be a supported provider
 * and resolve to a safe video id (so we never inject an arbitrary iframe).
 */
export function validateMediaContent(content: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!content || typeof content !== "object") {
    return { valid: false, errors: ["media content must be an object"] };
  }
  const c = content as Record<string, unknown>;
  if (!Array.isArray(c.embeds) || c.embeds.length === 0) {
    return { valid: false, errors: ["media content requires a non-empty embeds array"] };
  }

  for (const [i, raw] of c.embeds.entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`media embeds[${i}] must be an object`);
      continue;
    }
    const e = raw as Record<string, unknown>;
    if (e.provider !== "youtube") {
      errors.push(`media embeds[${i}] has unsupported provider "${String(e.provider)}"`);
      continue;
    }
    if (typeof e.title !== "string" || !e.title.trim()) {
      errors.push(`media embeds[${i}] missing title`);
    }
    if (typeof e.reason !== "string" || !e.reason.trim()) {
      errors.push(`media embeds[${i}] missing reason for inclusion`);
    }
    if (typeof e.fallback_text !== "string" || !e.fallback_text.trim()) {
      errors.push(`media embeds[${i}] missing fallback_text`);
    }
    if (e.start !== undefined && (typeof e.start !== "number" || e.start < 0)) {
      errors.push(`media embeds[${i}] start must be a non-negative number`);
    }
    const id = resolveYouTubeId(e as Pick<MediaEmbed, "video_id" | "url">);
    if (!id) {
      errors.push(
        `media embeds[${i}] does not resolve to a valid YouTube video id (provide video_id or a youtube.com/youtu.be url)`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Scaffolded code exercises ───────────────────────────────────────────────

export interface CodeTest {
  id: string;
  description: string;
  /** Python boolean expression asserted after the learner's code runs. */
  assert: string;
}

export interface CodeHint {
  /** Progressive level: 1 conceptual, 2 structural, 3 syntax. Never the answer. */
  level: number;
  text: string;
}

export interface PracticeCodeContent {
  language?: string;
  /** The task the learner must accomplish. */
  prompt?: string;
  /** Starter code — scaffolding only, never the completed solution. */
  starter_code?: string;
  /** Constraints / rules the solution must respect. */
  constraints?: string[];
  /** Optional ordered steps that guide without giving the answer. */
  guided_steps?: string[];
  /** Progressive hints revealed one at a time. */
  hints?: CodeHint[];
  /** Public tests — visible to the learner. */
  tests?: CodeTest[];
  /** Hidden tests — run on submit; assertions are NOT shown to the learner. */
  hidden_tests?: CodeTest[];
}

/**
 * Fields that must never appear in a practice_code content spec, because the
 * UI requires the learner to write and submit the solution rather than read it.
 */
const FORBIDDEN_ANSWER_KEYS = ["solution", "answer", "solution_code", "reference_solution", "completed_code"];

/**
 * Validate a practice_code activity's content.
 *
 * Enforces the pedagogical boundary: scaffolding (prompt, starter, hints,
 * constraints, tests) is required, but an exposed final answer is rejected.
 */
export function validatePracticeCodeContent(content: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!content || typeof content !== "object") {
    return { valid: false, errors: ["practice_code content must be an object"] };
  }
  const c = content as Record<string, unknown>;

  // Reject any exposed-answer field outright.
  for (const key of FORBIDDEN_ANSWER_KEYS) {
    if (key in c && c[key] != null && String(c[key]).trim() !== "") {
      errors.push(
        `practice_code must not expose a final answer ("${key}"); the learner submits code that passes tests`
      );
    }
  }

  if (typeof c.prompt !== "string" || !c.prompt.trim()) {
    errors.push("practice_code requires a task prompt");
  }

  const publicTests = Array.isArray(c.tests) ? c.tests : [];
  const hiddenTests = Array.isArray(c.hidden_tests) ? c.hidden_tests : [];
  if (publicTests.length === 0 && hiddenTests.length === 0) {
    errors.push("practice_code requires at least one test (public or hidden)");
  }

  const checkTests = (tests: unknown[], kind: string) => {
    const ids = new Set<string>();
    for (const [i, raw] of tests.entries()) {
      if (!raw || typeof raw !== "object") {
        errors.push(`practice_code ${kind}[${i}] must be an object`);
        continue;
      }
      const t = raw as Record<string, unknown>;
      if (typeof t.id !== "string" || !t.id.trim()) {
        errors.push(`practice_code ${kind}[${i}] missing id`);
      } else if (ids.has(t.id)) {
        errors.push(`practice_code ${kind}[${i}] duplicate id "${t.id}"`);
      } else {
        ids.add(t.id);
      }
      if (typeof t.description !== "string" || !t.description.trim()) {
        errors.push(`practice_code ${kind}[${i}] missing description`);
      }
      if (typeof t.assert !== "string" || !t.assert.trim()) {
        errors.push(`practice_code ${kind}[${i}] missing assert expression`);
      }
    }
  };
  checkTests(publicTests, "tests");
  checkTests(hiddenTests, "hidden_tests");

  // Hints, when present, must be progressive and textual (never code answers).
  if (c.hints !== undefined) {
    if (!Array.isArray(c.hints)) {
      errors.push("practice_code hints must be an array");
    } else {
      for (const [i, raw] of c.hints.entries()) {
        const h = raw as Record<string, unknown>;
        if (!h || typeof h !== "object") {
          errors.push(`practice_code hints[${i}] must be an object`);
          continue;
        }
        if (typeof h.text !== "string" || !h.text.trim()) {
          errors.push(`practice_code hints[${i}] missing text`);
        }
        if (h.level !== undefined && (typeof h.level !== "number" || h.level < 1)) {
          errors.push(`practice_code hints[${i}] level must be a positive number`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export { YT_ID_RE };

// ─── Multiple-choice quiz content ────────────────────────────────────────────

/**
 * A single multiple-choice question in a quiz.
 * Stable ids allow retry items to trace back to their origin question.
 */
export interface MultipleChoiceQuestion {
  /** Stable id — unique within the quiz, never changes across saves. */
  id: string;
  /** The question text shown to the learner. */
  question: string;
  /** Answer options. Must have 2–6 non-empty strings with no duplicates. */
  choices: string[];
  /** 0-based index of the correct choice in `choices`. */
  correct_index: number;
  /** Explanation shown after the learner submits. Reveals why the answer is right. */
  explanation: string;
  /** Concept tag — identifies the learning objective targeted by this question. */
  concept: string;
  /**
   * Difficulty of the question. Required so tag + difficulty can be queried
   * together (e.g. "hard questions tagged base-rate-fallacy"). Persisted on every
   * graded attempt and the resulting mastery signal.
   */
  difficulty: "easy" | "medium" | "hard";
  /** Specific misconception this question probes — helps ACP craft a targeted retry. */
  misconception_target?: string;
  /**
   * Optional instructions for the ACP rephrase path.
   * Describe the angle to take, what NOT to reveal, what to preserve.
   * Never include the correct answer here.
   */
  rephrase_instructions?: string;
}

/**
 * Content spec for the multiple-choice adaptive quiz within an assessment activity.
 * Present at `activity.content.quiz` when an assessment uses adaptive MC mode.
 */
export interface MultipleChoiceQuizContent {
  questions: MultipleChoiceQuestion[];
  /**
   * Number of correct answers required to pass. Defaults to 6 when omitted.
   * Counted from distinct correctly answered questions, not total attempts.
   */
  pass_threshold?: number;
  /**
   * Optional streak-based pass rule. When present, the learner must answer this
   * many questions correctly in a row, while retry obligations still apply.
   * Used by lesson-part reinforcement checks.
   */
  consecutive_correct_required?: number;
  /**
   * Whether to render an "I don't know" option on every question. Defaults to
   * true and should stay true — IDK is a product invariant treated as an
   * incorrect-but-high-signal uncertainty answer. The option is a virtual choice
   * appended at render time (index === choices.length), so it never appears in
   * `choices` and never collides with `correct_index`.
   */
  idk_option?: boolean;
}

/**
 * Label rendered for the virtual "I don't know" option appended to every MC
 * question. Selecting it grades as incorrect with a distinct uncertainty signal.
 */
export const IDK_LABEL = "I'm not sure / I don't know";

/**
 * Validate a MultipleChoiceQuizContent spec.
 * Enforces: non-empty questions, unique ids, valid correct_index bounds,
 * 2–6 distinct choices per question, required fields present, no answer leakage.
 */
export function validateMultipleChoiceQuizContent(
  content: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!content || typeof content !== "object") {
    return { valid: false, errors: ["quiz content must be an object"] };
  }
  const c = content as Record<string, unknown>;

  if (!Array.isArray(c.questions) || c.questions.length === 0) {
    return { valid: false, errors: ["quiz content requires a non-empty questions array"] };
  }

  if (c.pass_threshold !== undefined) {
    if (typeof c.pass_threshold !== "number" || !Number.isInteger(c.pass_threshold) || c.pass_threshold < 1) {
      errors.push("quiz pass_threshold must be a positive integer");
    }
  }

  if (c.consecutive_correct_required !== undefined) {
    if (
      typeof c.consecutive_correct_required !== "number" ||
      !Number.isInteger(c.consecutive_correct_required) ||
      c.consecutive_correct_required < 1
    ) {
      errors.push("quiz consecutive_correct_required must be a positive integer");
    } else if (
      Array.isArray(c.questions) &&
      c.consecutive_correct_required > c.questions.length
    ) {
      errors.push("quiz consecutive_correct_required cannot exceed questions.length");
    }
  }

  if (c.idk_option !== undefined && typeof c.idk_option !== "boolean") {
    errors.push("quiz idk_option must be a boolean when present");
  }
  // IDK is a product invariant: an author may not disable it.
  if (c.idk_option === false) {
    errors.push('quiz idk_option must not be false — every multiple-choice question requires an "I don\'t know" option');
  }

  const ids = new Set<string>();
  for (const [i, raw] of (c.questions as unknown[]).entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`quiz questions[${i}] must be an object`);
      continue;
    }
    const q = raw as Record<string, unknown>;

    if (typeof q.id !== "string" || !(q.id as string).trim()) {
      errors.push(`quiz questions[${i}] missing id`);
    } else if (ids.has(q.id as string)) {
      errors.push(`quiz questions[${i}] duplicate id "${q.id}"`);
    } else {
      ids.add(q.id as string);
    }

    if (typeof q.question !== "string" || !(q.question as string).trim()) {
      errors.push(`quiz questions[${i}] missing question text`);
    }

    if (!Array.isArray(q.choices)) {
      errors.push(`quiz questions[${i}] choices must be an array`);
    } else {
      const choices = q.choices as unknown[];
      if (choices.length < 2) {
        errors.push(`quiz questions[${i}] must have at least 2 choices`);
      }
      if (choices.length > 6) {
        errors.push(`quiz questions[${i}] must have at most 6 choices`);
      }
      if (!choices.every((ch) => typeof ch === "string" && (ch as string).trim())) {
        errors.push(`quiz questions[${i}] all choices must be non-empty strings`);
      }
      const choiceSet = new Set(choices);
      if (choiceSet.size !== choices.length) {
        errors.push(`quiz questions[${i}] choices must not contain duplicates`);
      }
    }

    if (typeof q.correct_index !== "number" || !Number.isInteger(q.correct_index) || q.correct_index < 0) {
      errors.push(`quiz questions[${i}] correct_index must be a non-negative integer`);
    } else if (Array.isArray(q.choices) && (q.correct_index as number) >= (q.choices as unknown[]).length) {
      errors.push(
        `quiz questions[${i}] correct_index ${q.correct_index} out of range for ${(q.choices as unknown[]).length} choices`
      );
    }

    if (typeof q.explanation !== "string" || !(q.explanation as string).trim()) {
      errors.push(`quiz questions[${i}] missing explanation`);
    }

    if (typeof q.concept !== "string" || !(q.concept as string).trim()) {
      errors.push(`quiz questions[${i}] missing concept tag`);
    }

    if (q.difficulty === undefined || q.difficulty === null) {
      errors.push(`quiz questions[${i}] missing required difficulty ("easy", "medium", or "hard")`);
    } else if (!["easy", "medium", "hard"].includes(q.difficulty as string)) {
      errors.push(`quiz questions[${i}] difficulty must be "easy", "medium", or "hard"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Freeform assessment + end-of-lesson diagnostics ──────────────────────────

export type FreeformAnswerType = "free_text" | "numeric";

/**
 * A freeform assessment question (non-multiple-choice). Carries an optional
 * concept tag and difficulty so freeform answers can also feed the tag +
 * difficulty evidence model, alongside the deterministic assessor.
 */
export interface FreeformQuestion {
  id: string;
  text: string;
  type?: FreeformAnswerType;
  hint?: string;
  /** Concept this question targets — used by the assessor to attach tags. */
  concept?: string;
  /** Optional difficulty so freeform evidence is queryable like MC evidence. */
  difficulty?: "easy" | "medium" | "hard";
}

/**
 * Content spec for an `assessment` activity. Holds the freeform questions and,
 * optionally, the adaptive multiple-choice quiz.
 */
export interface AssessmentContent {
  questions: FreeformQuestion[];
  quiz?: MultipleChoiceQuizContent;
}

// ─── Lesson parts ────────────────────────────────────────────────────────────

export interface LessonPartAudioContent {
  script: string;
  duration_hint?: number;
}

export interface LessonPartContent {
  /** Stable id within the lesson, for authoring notes and future analytics. */
  part_id?: string;
  /** Written explanation for this part. */
  reading: ReadingContent;
  /** Spoken explanation for this part, used as the per-part audio script. */
  audio: LessonPartAudioContent;
  /** Interactive exploration for this part. */
  interactive: unknown;
  /** Reinforcement quiz for this part. */
  quiz: MultipleChoiceQuizContent;
}

/**
 * Validate a collapsed lesson-part activity. A lesson part bundles the written
 * teaching, audio script, interactive exploration, and 10-question MC
 * reinforcement check for one step/concept.
 */
export function validateLessonPartContent(
  content: unknown,
  knownWidgetTypes?: string[],
  widgetValidator?: (spec: unknown, knownTypes?: string[]) => { valid: boolean; errors: string[] }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!content || typeof content !== "object") {
    return { valid: false, errors: ["lesson_part content must be an object"] };
  }
  const c = content as Record<string, unknown>;

  const reading = validateReadingContent(c.reading);
  for (const e of reading.errors) errors.push(`reading: ${e}`);

  const audio = c.audio as Record<string, unknown> | undefined;
  if (!audio || typeof audio !== "object") {
    errors.push("audio: lesson_part requires an audio object");
  } else if (typeof audio.script !== "string" || audio.script.trim().length < 200) {
    errors.push("audio: lesson_part audio.script must be a substantive per-part script");
  }

  if (widgetValidator) {
    const widget = widgetValidator(c.interactive, knownWidgetTypes);
    for (const e of widget.errors) errors.push(`interactive: ${e}`);
  } else if (!c.interactive || typeof c.interactive !== "object") {
    errors.push("interactive: lesson_part requires an interactive widget spec");
  }

  const quiz = validateMultipleChoiceQuizContent(c.quiz);
  for (const e of quiz.errors) errors.push(`quiz: ${e}`);
  const quizObj = c.quiz as Record<string, unknown> | undefined;
  const questions = Array.isArray(quizObj?.questions) ? quizObj.questions : [];
  if (questions.length !== 10) {
    errors.push("quiz: each lesson_part requires exactly 10 multiple-choice questions");
  }
  if (quizObj?.pass_threshold !== 4) {
    errors.push("quiz: each lesson_part requires pass_threshold: 4");
  }
  if (quizObj?.consecutive_correct_required !== 4) {
    errors.push("quiz: each lesson_part requires consecutive_correct_required: 4");
  }
  if (quizObj?.idk_option === false) {
    errors.push('quiz: idk_option must not be false');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an assessment activity's content. Freeform questions need a stable
 * id and text; difficulty/concept are optional but typed when present. If a
 * `quiz` is present it must satisfy the MC contract.
 */
export function validateAssessmentContent(content: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!content || typeof content !== "object") {
    return { valid: false, errors: ["assessment content must be an object"] };
  }
  const c = content as Record<string, unknown>;
  if (!Array.isArray(c.questions)) {
    return { valid: false, errors: ["assessment content requires a questions array"] };
  }

  const ids = new Set<string>();
  for (const [i, raw] of c.questions.entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`assessment questions[${i}] must be an object`);
      continue;
    }
    const q = raw as Record<string, unknown>;
    if (typeof q.id !== "string" || !q.id.trim()) {
      errors.push(`assessment questions[${i}] missing id`);
    } else if (ids.has(q.id)) {
      errors.push(`assessment questions[${i}] duplicate id "${q.id}"`);
    } else {
      ids.add(q.id);
    }
    if (typeof q.text !== "string" || !q.text.trim()) {
      errors.push(`assessment questions[${i}] missing text`);
    }
    if (q.type !== undefined && !["free_text", "numeric"].includes(q.type as string)) {
      errors.push(`assessment questions[${i}] type must be "free_text" or "numeric"`);
    }
    if (
      q.difficulty !== undefined &&
      !["easy", "medium", "hard"].includes(q.difficulty as string)
    ) {
      errors.push(`assessment questions[${i}] difficulty must be "easy", "medium", or "hard"`);
    }
  }

  if (c.quiz !== undefined) {
    const quizResult = validateMultipleChoiceQuizContent(c.quiz);
    for (const e of quizResult.errors) errors.push(`quiz: ${e}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * A single end-of-lesson next-lesson diagnostic prompt. Freeform; answers
 * autosave and feed next-lesson planning. They never trigger lesson completion.
 */
export interface NextLessonDiagnostic {
  id: string;
  prompt: string;
  hint?: string;
}

/**
 * Validate the lessons.next_lesson_diagnostics JSON array. Each entry needs a
 * stable id and a prompt. A lesson with diagnostics should have at least one.
 */
export function validateNextLessonDiagnostics(content: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(content)) {
    return { valid: false, errors: ["next_lesson_diagnostics must be an array"] };
  }
  if (content.length === 0) {
    errors.push("next_lesson_diagnostics needs at least one prompt when present");
  }
  const ids = new Set<string>();
  for (const [i, raw] of content.entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`next_lesson_diagnostics[${i}] must be an object`);
      continue;
    }
    const d = raw as Record<string, unknown>;
    if (typeof d.id !== "string" || !d.id.trim()) {
      errors.push(`next_lesson_diagnostics[${i}] missing id`);
    } else if (ids.has(d.id)) {
      errors.push(`next_lesson_diagnostics[${i}] duplicate id "${d.id}"`);
    } else {
      ids.add(d.id);
    }
    if (typeof d.prompt !== "string" || !d.prompt.trim()) {
      errors.push(`next_lesson_diagnostics[${i}] missing prompt`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * The standard end-of-lesson diagnostic prompts. Authors may override per
 * lesson, but every backfilled/seeded lesson uses these so the next-lesson
 * generator always gets a readiness signal. Covers: what felt unclear, what the
 * learner wants next, confidence/effort, and a practical objective.
 */
export const DEFAULT_NEXT_LESSON_DIAGNOSTICS: NextLessonDiagnostic[] = [
  {
    id: "diag-unclear",
    prompt: "What still feels unclear or shaky after this lesson?",
    hint: "Name the specific idea, step, or term. 'Nothing' is a valid answer if it all clicked.",
  },
  {
    id: "diag-next",
    prompt: "What would you most like the next lesson to cover or go deeper on?",
    hint: "A concept to revisit, a harder variation, or a new direction.",
  },
  {
    id: "diag-confidence",
    prompt: "How confident do you feel with this material, and how much effort did it take? (e.g. low/medium/high)",
    hint: "Your honest read helps tune the pace and difficulty of the next lesson.",
  },
  {
    id: "diag-objective",
    prompt: "Is there a concrete thing you want to be able to do after the next lesson?",
    hint: "A practical objective, e.g. 'implement it without hints' or 'apply it to my own data'.",
  },
];
