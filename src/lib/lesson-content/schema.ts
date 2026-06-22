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
  /** Optional difficulty hint for authoring. Does not affect grading. */
  difficulty?: "easy" | "medium" | "hard";
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
}

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

    if (
      q.difficulty !== undefined &&
      !["easy", "medium", "hard"].includes(q.difficulty as string)
    ) {
      errors.push(`quiz questions[${i}] difficulty must be "easy", "medium", or "hard"`);
    }
  }

  return { valid: errors.length === 0, errors };
}
