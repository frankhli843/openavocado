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
  | { type: "text"; content: string }
  | { type: "paragraph"; text: string }
  | { type: "definition"; term: string; definition: string }
  | { type: "example"; title?: string; body: string }
  | {
      type: "formula";
      latex: string;
      plain_english: string;
      variables: Array<{ symbol: string; meaning: string; shape?: string }>;
    }
  | { type: "callout"; tone?: "info" | "warning" | "insight"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] };

export interface ReadingContent {
  /** Optional short intro shown above the blocks. */
  intro?: string;
  blocks: ReadingBlock[];
  /** Diagrams attached near the prose they explain. */
  diagrams?: LessonDiagram[];
  /** Short review/summary so the text is useful for skimming and revision. */
  summary?: string;
}

export type LessonDiagram =
  | {
      kind: "mermaid";
      title: string;
      mermaid: string;
      takeaway: string;
      caption?: string;
      support_ref: string;
    }
  | {
      kind: "static";
      title: string;
      asset_path: string;
      alt: string;
      takeaway?: string;
      caption?: string;
      external?: boolean;
      source_url?: string;
      license?: string;
      support_ref: string;
    };

export function isExternalAssetPath(assetPath: string): boolean {
  return /^https?:\/\//i.test(assetPath);
}

export function validateLessonDiagram(
  diagram: unknown,
  path = "diagram"
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!diagram || typeof diagram !== "object") {
    return { valid: false, errors: [`${path} must be an object`] };
  }
  const d = diagram as Record<string, unknown>;
  if (d.kind !== "mermaid" && d.kind !== "static") {
    errors.push(`${path}.kind must be "mermaid" or "static"`);
  }
  if (typeof d.title !== "string" || !d.title.trim()) {
    errors.push(`${path}.title is required`);
  }
  if (typeof d.support_ref !== "string" || !d.support_ref.trim()) {
    errors.push(`${path}.support_ref is required`);
  }
  if (d.caption !== undefined && typeof d.caption !== "string") {
    errors.push(`${path}.caption must be a string when present`);
  }

  if (d.kind === "mermaid") {
    if (typeof d.mermaid !== "string" || !d.mermaid.trim()) {
      errors.push(`${path}.mermaid is required`);
    }
    if (typeof d.takeaway !== "string" || !d.takeaway.trim()) {
      errors.push(`${path}.takeaway is required`);
    }
  }
  if (d.kind === "static") {
    if (typeof d.asset_path !== "string" || !d.asset_path.trim()) {
      errors.push(`${path}.asset_path is required`);
    } else if (isExternalAssetPath(d.asset_path)) {
      errors.push(`${path}.asset_path must be local/runtime-relative, not an http(s) hotlink`);
    }
    if (typeof d.alt !== "string" || !d.alt.trim()) {
      errors.push(`${path}.alt is required`);
    }
    if (d.takeaway !== undefined && typeof d.takeaway !== "string") {
      errors.push(`${path}.takeaway must be a string when present`);
    }
    if (d.external === true) {
      if (typeof d.source_url !== "string" || !d.source_url.trim()) {
        errors.push(`${path}.source_url is required for external static diagrams`);
      }
      if (typeof d.license !== "string" || !d.license.trim()) {
        errors.push(`${path}.license is required for external static diagrams`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateLessonDiagrams(
  diagrams: unknown,
  path = "diagrams"
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (diagrams === undefined || diagrams === null) return { valid: true, errors };
  if (!Array.isArray(diagrams)) {
    return { valid: false, errors: [`${path} must be an array when present`] };
  }
  for (const [i, diagram] of diagrams.entries()) {
    const result = validateLessonDiagram(diagram, `${path}[${i}]`);
    errors.push(...result.errors);
  }
  return { valid: errors.length === 0, errors };
}

const READING_BLOCK_TYPES = new Set([
  "heading",
  "text",
  "paragraph",
  "definition",
  "example",
  "formula",
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
  let hasFormalFormulaBlock = false;
  let hasFormulaLikeText = false;
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
        } else {
          textBlocks++;
          if (looksLikeFormulaText(b.text)) hasFormulaLikeText = true;
        }
        break;
      case "text":
        if (typeof b.content !== "string" || !b.content.trim()) {
          errors.push(`reading blocks[${i}] (text) missing content`);
        } else {
          textBlocks++;
          if (looksLikeFormulaText(b.content)) hasFormulaLikeText = true;
        }
        break;
      case "definition":
        if (typeof b.term !== "string" || !b.term.trim()) {
          errors.push(`reading blocks[${i}] (definition) missing term`);
        }
        if (typeof b.definition !== "string" || !b.definition.trim()) {
          errors.push(`reading blocks[${i}] (definition) missing definition`);
        } else {
          textBlocks++;
          if (looksLikeFormulaText(b.definition)) hasFormulaLikeText = true;
        }
        break;
      case "example":
        if (typeof b.body !== "string" || !b.body.trim()) {
          errors.push(`reading blocks[${i}] (example) missing body`);
        } else {
          textBlocks++;
          if (looksLikeFormulaText(b.body)) hasFormulaLikeText = true;
        }
        break;
      case "formula": {
        hasFormalFormulaBlock = true;
        if (typeof b.latex !== "string" || !b.latex.trim()) {
          errors.push(`reading blocks[${i}] (formula) requires latex`);
        }
        if (typeof b.plain_english !== "string" || b.plain_english.trim().length < 20) {
          errors.push(`reading blocks[${i}] (formula) requires a substantive plain_english explanation`);
        }
        if (!Array.isArray(b.variables) || b.variables.length === 0) {
          errors.push(`reading blocks[${i}] (formula) requires variable definitions`);
        } else {
          for (const [vi, rawVar] of b.variables.entries()) {
            if (!rawVar || typeof rawVar !== "object") {
              errors.push(`reading blocks[${i}] (formula).variables[${vi}] must be an object`);
              continue;
            }
            const variable = rawVar as Record<string, unknown>;
            if (typeof variable.symbol !== "string" || !variable.symbol.trim()) {
              errors.push(`reading blocks[${i}] (formula).variables[${vi}] missing symbol`);
            }
            if (typeof variable.meaning !== "string" || variable.meaning.trim().length < 8) {
              errors.push(`reading blocks[${i}] (formula).variables[${vi}] missing meaning`);
            }
            if (variable.shape !== undefined && typeof variable.shape !== "string") {
              errors.push(`reading blocks[${i}] (formula).variables[${vi}].shape must be a string when present`);
            }
          }
        }
        textBlocks++;
        break;
      }
      case "list":
        if (!Array.isArray(b.items) || b.items.length === 0) {
          errors.push(`reading blocks[${i}] (list) needs a non-empty items array`);
        } else if (!b.items.every((it) => typeof it === "string" && it.trim())) {
          errors.push(`reading blocks[${i}] (list) items must be non-empty strings`);
        } else {
          textBlocks++;
          if (b.items.some((it) => looksLikeFormulaText(it))) hasFormulaLikeText = true;
        }
        break;
    }
  }

  if (textBlocks < 2) {
    errors.push("reading content needs at least 2 substantive text blocks");
  }
  if (hasFormulaLikeText && !hasFormalFormulaBlock) {
    errors.push(
      "reading content uses mathematical notation but lacks a formal formula block with LaTeX, plain_english, and variable definitions"
    );
  }

  const diagramResult = validateLessonDiagrams(c.diagrams, "reading.diagrams");
  errors.push(...diagramResult.errors);

  return { valid: errors.length === 0, errors };
}

function looksLikeFormulaText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text) return false;
  return (
    /\b[A-Za-z][A-Za-z0-9_]*\([^)]{1,80}\)\s*=/.test(text) ||
    /\bsoftmax\s*\(/i.test(text) ||
    /[A-Za-z0-9_]\s*[·*]\s*[A-Za-z0-9_]/.test(text) ||
    /√|\\sqrt|[A-Za-z0-9_]\^[A-Za-z0-9_{]/.test(text) ||
    /\b[A-Z][A-Za-z0-9_]*\s*=\s*[^.!?]{2,80}/.test(text)
  );
}

// ─── Embedded media (YouTube) ────────────────────────────────────────────────

export type MediaProvider = "youtube";

export interface MediaSegment {
  /** Human-readable label, for example "Resize and crop walkthrough". */
  label?: string;
  /** Segment start time in seconds. */
  start: number;
  /** Optional end time in seconds. */
  end?: number;
  /** Why this segment is worth watching. */
  reason?: string;
}

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
  /** Whether the whole video is relevant or only selected timestamped segments. */
  relevance?: "whole" | "segments";
  /** Required when relevance is "segments"; exact times the learner should watch. */
  segments?: MediaSegment[];
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
    if (e.relevance !== undefined && e.relevance !== "whole" && e.relevance !== "segments") {
      errors.push(`media embeds[${i}] relevance must be "whole" or "segments"`);
    }
    if (e.relevance === "segments") {
      if (!Array.isArray(e.segments) || e.segments.length === 0) {
        errors.push(`media embeds[${i}] relevance "segments" requires a non-empty segments array`);
      } else {
        for (const [j, rawSegment] of e.segments.entries()) {
          if (!rawSegment || typeof rawSegment !== "object") {
            errors.push(`media embeds[${i}].segments[${j}] must be an object`);
            continue;
          }
          const segment = rawSegment as Record<string, unknown>;
          if (typeof segment.start !== "number" || !Number.isFinite(segment.start) || segment.start < 0) {
            errors.push(`media embeds[${i}].segments[${j}] start must be a non-negative number`);
          }
          if (
            segment.end !== undefined
            && (typeof segment.end !== "number" || !Number.isFinite(segment.end) || segment.end <= Number(segment.start))
          ) {
            errors.push(`media embeds[${i}].segments[${j}] end must be greater than start`);
          }
          if (segment.label !== undefined && typeof segment.label !== "string") {
            errors.push(`media embeds[${i}].segments[${j}] label must be a string`);
          }
          if (segment.reason !== undefined && typeof segment.reason !== "string") {
            errors.push(`media embeds[${i}].segments[${j}] reason must be a string`);
          }
        }
      }
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
  /** Progressive reveal level, from conceptual nudge through full answer explanation. */
  level: number;
  text: string;
}

export interface PracticeCodeContent {
  language?: string;
  /** The task the learner must accomplish. */
  prompt?: string;
  /** Conceptual walkthrough that explains the exercise before code is edited. */
  walkthrough?: PracticeCodeWalkthrough;
  /** Concrete input/output examples that make the expected behavior inspectable. */
  io_examples?: PracticeCodeIoExample[];
  /** Small visual model of how values move through the exercise. */
  visualization?: PracticeCodeVisualization;
  /** Starter code — scaffolding only, never the completed solution. */
  starter_code?: string;
  /** Full worked implementations, shown as basic/readable and concise versions. */
  worked_examples?: PracticeCodeWorkedExample[];
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

export interface PracticeCodeWorkedExample {
  label: "basic" | "concise" | string;
  title?: string;
  explanation?: string;
  code: string;
}

export interface PracticeCodeWalkthrough {
  title?: string;
  steps: PracticeCodeWalkthroughStep[];
}

export interface PracticeCodeWalkthroughStep {
  title: string;
  detail: string;
  input?: string;
  output?: string;
  visual?: string;
}

export interface PracticeCodeIoExample {
  label: string;
  input: string;
  expected_output: string;
  explanation?: string;
}

export interface PracticeCodeVisualization {
  title: string;
  description?: string;
  items: PracticeCodeVisualizationItem[];
}

export interface PracticeCodeVisualizationItem {
  label: string;
  value: string;
  role?: "input" | "process" | "output";
  note?: string;
}

/**
 * Fields that must never appear in a practice_code content spec, because the
 * UI renders worked_examples in a controlled place rather than letting authors
 * smuggle unstructured answer fields into the payload.
 */
const FORBIDDEN_ANSWER_KEYS = ["solution", "answer", "solution_code", "reference_solution", "completed_code"];

/**
 * Validate a practice_code activity's content.
 *
 * Enforces the pedagogical boundary: scaffolding (prompt, starter, hints,
 * constraints, tests) is required, and any completed answer must be inside
 * worked_examples with both a basic/readable and concise implementation.
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

  const requireStudySupport = true;

  if (c.walkthrough === undefined && requireStudySupport) {
    errors.push("practice_code requires walkthrough.steps so learners see the expected input/output transformation");
  } else if (c.walkthrough !== undefined) {
    if (!c.walkthrough || typeof c.walkthrough !== "object") {
      errors.push("practice_code walkthrough must be an object when present");
    } else {
      const walkthrough = c.walkthrough as Record<string, unknown>;
      if (walkthrough.title !== undefined && typeof walkthrough.title !== "string") {
        errors.push("practice_code walkthrough.title must be a string when present");
      }
      if (!Array.isArray(walkthrough.steps) || walkthrough.steps.length < 2) {
        errors.push("practice_code walkthrough requires at least two conceptual steps");
      } else {
        for (const [i, raw] of walkthrough.steps.entries()) {
          if (!raw || typeof raw !== "object") {
            errors.push(`practice_code walkthrough.steps[${i}] must be an object`);
            continue;
          }
          const step = raw as Record<string, unknown>;
          if (typeof step.title !== "string" || !step.title.trim()) {
            errors.push(`practice_code walkthrough.steps[${i}] missing title`);
          }
          if (typeof step.detail !== "string" || step.detail.trim().length < 20) {
            errors.push(`practice_code walkthrough.steps[${i}] needs a substantive detail`);
          }
          for (const key of ["input", "output", "visual"] as const) {
            if (step[key] !== undefined && typeof step[key] !== "string") {
              errors.push(`practice_code walkthrough.steps[${i}].${key} must be a string when present`);
            }
          }
        }
      }
    }
  }

  if (c.io_examples === undefined && requireStudySupport) {
    errors.push("practice_code requires at least two io_examples showing expected inputs and outputs");
  } else if (c.io_examples !== undefined) {
    if (!Array.isArray(c.io_examples)) {
      errors.push("practice_code io_examples must be an array when present");
    } else if (c.io_examples.length < 2) {
      errors.push("practice_code requires at least two io_examples showing expected inputs and outputs");
    } else {
      for (const [i, raw] of c.io_examples.entries()) {
        if (!raw || typeof raw !== "object") {
          errors.push(`practice_code io_examples[${i}] must be an object`);
          continue;
        }
        const example = raw as Record<string, unknown>;
        if (typeof example.label !== "string" || !example.label.trim()) {
          errors.push(`practice_code io_examples[${i}] missing label`);
        }
        if (typeof example.input !== "string" || !example.input.trim()) {
          errors.push(`practice_code io_examples[${i}] missing input`);
        }
        if (typeof example.expected_output !== "string" || !example.expected_output.trim()) {
          errors.push(`practice_code io_examples[${i}] missing expected_output`);
        }
        if (example.explanation !== undefined && typeof example.explanation !== "string") {
          errors.push(`practice_code io_examples[${i}].explanation must be a string when present`);
        }
      }
    }
  }

  if (c.visualization === undefined && requireStudySupport) {
    errors.push("practice_code requires visualization.items mapping input, process, and output");
  } else if (c.visualization !== undefined) {
    if (!c.visualization || typeof c.visualization !== "object") {
      errors.push("practice_code visualization must be an object when present");
    } else {
      const viz = c.visualization as Record<string, unknown>;
      if (typeof viz.title !== "string" || !viz.title.trim()) {
        errors.push("practice_code visualization missing title");
      }
      if (viz.description !== undefined && typeof viz.description !== "string") {
        errors.push("practice_code visualization.description must be a string when present");
      }
      if (!Array.isArray(viz.items) || viz.items.length < 3) {
        errors.push("practice_code visualization requires at least 3 items");
      } else {
        const roles = new Set<string>();
        for (const [i, raw] of viz.items.entries()) {
          if (!raw || typeof raw !== "object") {
            errors.push(`practice_code visualization.items[${i}] must be an object`);
            continue;
          }
          const item = raw as Record<string, unknown>;
          if (typeof item.label !== "string" || !item.label.trim()) {
            errors.push(`practice_code visualization.items[${i}] missing label`);
          }
          if (typeof item.value !== "string" || !item.value.trim()) {
            errors.push(`practice_code visualization.items[${i}] missing value`);
          }
          if (item.role !== undefined && !["input", "process", "output"].includes(String(item.role))) {
            errors.push(`practice_code visualization.items[${i}].role must be input, process, or output`);
          } else if (typeof item.role === "string") {
            roles.add(item.role);
          }
          if (item.note !== undefined && typeof item.note !== "string") {
            errors.push(`practice_code visualization.items[${i}].note must be a string when present`);
          }
        }
        for (const role of ["input", "process", "output"]) {
          if (!roles.has(role)) errors.push(`practice_code visualization missing "${role}" role`);
        }
      }
    }
  }

  if (c.worked_examples === undefined && requireStudySupport) {
    errors.push('practice_code requires worked_examples with "basic" and "concise" full-code versions');
  } else if (c.worked_examples !== undefined) {
    if (!Array.isArray(c.worked_examples)) {
      errors.push("practice_code worked_examples must be an array when present");
    } else {
      const labels = new Set<string>();
      for (const [i, raw] of c.worked_examples.entries()) {
        if (!raw || typeof raw !== "object") {
          errors.push(`practice_code worked_examples[${i}] must be an object`);
          continue;
        }
        const ex = raw as Record<string, unknown>;
        if (typeof ex.label !== "string" || !ex.label.trim()) {
          errors.push(`practice_code worked_examples[${i}] missing label`);
        } else {
          labels.add(ex.label.trim().toLowerCase());
        }
        if (typeof ex.code !== "string" || ex.code.trim().length < 20) {
          errors.push(`practice_code worked_examples[${i}] requires full code`);
        }
        if (ex.title !== undefined && typeof ex.title !== "string") {
          errors.push(`practice_code worked_examples[${i}].title must be a string when present`);
        }
        if (ex.explanation !== undefined && typeof ex.explanation !== "string") {
          errors.push(`practice_code worked_examples[${i}].explanation must be a string when present`);
        }
      }
      if (c.worked_examples.length > 0 && (!labels.has("basic") || !labels.has("concise"))) {
        errors.push('practice_code worked_examples must include both "basic" and "concise" examples when present');
      }
    }
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

  // Hints, when present, must be progressive and textual. The lesson payload
  // still cannot expose a top-level solution field, but later hints may reveal
  // the answer path so a stuck learner can keep unboxing help.
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
  /** 0-based index of the correct choice in `choices` for classic single-choice questions. */
  correct_index?: number;
  /**
   * 0-based indices of every correct choice for select-all-that-apply questions.
   * Use with allow_multiple_correct=true. This also supports the "none are
   * correct" case by making the real "None of the above" choice the only
   * correct index.
   */
  correct_indices?: number[];
  /**
   * When true, render as checkbox/select-all. Authors should still vary the
   * answer pattern: one correct, several correct, or only "None of the above".
   */
  allow_multiple_correct?: boolean;
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

export function isNoneOfTheAboveChoiceText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
  return (
    normalized === "none of the above" ||
    normalized === "none are correct" ||
    normalized === "none of these" ||
    normalized === "no statements are correct"
  );
}

/**
 * Validate a MultipleChoiceQuizContent spec.
 * Enforces: non-empty questions, unique ids, valid answer indices,
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

    const hasCorrectIndex = typeof q.correct_index === "number";
    const hasCorrectIndices = Array.isArray(q.correct_indices);
    const allowMultiple = q.allow_multiple_correct === true || (hasCorrectIndices && (q.correct_indices as unknown[]).length > 1);
    const choiceCount = Array.isArray(q.choices) ? (q.choices as unknown[]).length : 0;

    if (q.allow_multiple_correct !== undefined && typeof q.allow_multiple_correct !== "boolean") {
      errors.push(`quiz questions[${i}] allow_multiple_correct must be a boolean when present`);
    }

    if (!hasCorrectIndex && !hasCorrectIndices) {
      errors.push(`quiz questions[${i}] needs correct_index or correct_indices`);
    }
    if (hasCorrectIndex) {
      if (!Number.isInteger(q.correct_index) || (q.correct_index as number) < 0) {
        errors.push(`quiz questions[${i}] correct_index must be a non-negative integer`);
      } else if (Array.isArray(q.choices) && (q.correct_index as number) >= choiceCount) {
        errors.push(
          `quiz questions[${i}] correct_index ${q.correct_index} out of range for ${choiceCount} choices`
        );
      }
    }
    if (hasCorrectIndices) {
      const indices = q.correct_indices as unknown[];
      if (indices.length === 0) {
        errors.push(`quiz questions[${i}] correct_indices must not be empty`);
      }
      if (!indices.every((idx) => typeof idx === "number" && Number.isInteger(idx) && idx >= 0)) {
        errors.push(`quiz questions[${i}] correct_indices must contain non-negative integers`);
      } else if (Array.isArray(q.choices)) {
        for (const idx of indices as number[]) {
          if (idx >= choiceCount) {
            errors.push(`quiz questions[${i}] correct_indices contains out-of-range index ${idx}`);
          }
        }
        if (new Set(indices).size !== indices.length) {
          errors.push(`quiz questions[${i}] correct_indices must not contain duplicates`);
        }
      }
      if ((indices.length > 1 || q.allow_multiple_correct === true) && !allowMultiple) {
        errors.push(`quiz questions[${i}] multiple correct indices require allow_multiple_correct=true`);
      }
    }
    if (allowMultiple && Array.isArray(q.choices)) {
      const noneIndex = (q.choices as unknown[]).findIndex(isNoneOfTheAboveChoiceText);
      if (noneIndex < 0) {
        errors.push(`quiz questions[${i}] select-all questions must include a real "None of the above" choice`);
      }
      const indices = hasCorrectIndices
        ? (q.correct_indices as number[])
        : hasCorrectIndex
        ? [q.correct_index as number]
        : [];
      if (indices.includes(noneIndex) && indices.length > 1) {
        errors.push(`quiz questions[${i}] "None of the above" must be the only correct choice when selected`);
      }
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

export type FreeformAnswerType =
  | "free_text"
  | "numeric"
  | "fill_blank"
  | "ordering"
  | "matching"
  | "classification"
  | "multiple_choice";

export interface FillBlankSpec {
  id: string;
  label?: string;
  accepted_answers?: string[];
  actual_answer?: string;
}

export interface ClassificationItemSpec {
  id: string;
  text: string;
  category_id?: string;
}

export interface MatchingPromptSpec {
  id: string;
  text: string;
  correct_option_id?: string;
}

export interface MatchingOptionSpec {
  id: string;
  text: string;
}

export interface ClassificationCategorySpec {
  id: string;
  label: string;
}

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
  actual_answer?: string;
  rubric?: string;
  accepted_answers?: string[];
  support_ref?: string;
  blanks?: FillBlankSpec[];
  items?: Array<string | ClassificationItemSpec>;
  prompts?: MatchingPromptSpec[];
  options?: MatchingOptionSpec[];
  categories?: ClassificationCategorySpec[];
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

export type LessonPartPracticeQuestionType = "select_one" | "select_all" | "ordering" | "written";

export interface LessonPartPracticeQuestion {
  id: string;
  type: LessonPartPracticeQuestionType;
  prompt: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
  hint?: string;
  choices?: string[];
  correct_index?: number;
  /** Empty array means "none of these are correct" for select_all. */
  correct_indices?: number[];
  items?: string[];
  correct_order?: string[];
  actual_answer?: string;
  rubric?: string;
  accepted_answers?: string[];
}

export interface LessonPartPracticeContent {
  questions: LessonPartPracticeQuestion[];
  pass_threshold?: number;
  written_feedback?: "llm_judge";
}

export interface LessonPartAudioContent {
  script: string;
  /** Explicit learner-visible transcript. If omitted, script is treated as the transcript. */
  transcript?: string;
  duration_hint?: number;
  synced_visual?: AudioSyncedVisualContent;
}

export interface AudioSyncedVisualCue {
  start: number;
  end?: number;
  /** Optional per-cue visual_artifacts slug. When present, the renderer swaps to this artifact for the cue. */
  artifact_slug?: string;
  label: string;
  headline: string;
  narration: string;
  receive?: string;
  transform?: string;
  pass?: string;
  panel_id?: string;
  active_elements?: string[];
  visual_kind?: "pipeline" | "matrix" | "flow" | "graph" | "camera" | "custom";
}

export interface AudioGeneratedScenePanel {
  id: string;
  title: string;
  kind: "matrix" | "vector" | "ledger" | "pipeline" | "flow" | "bar" | "cards" | "formula" | "custom";
  description: string;
  data: Array<{
    label: string;
    value?: string;
    values?: number[];
    role?: "input" | "process" | "output" | "context";
  }>;
}

export interface AudioGeneratedScene {
  scene_id: string;
  title: string;
  motif: string;
  description: string;
  panels: AudioGeneratedScenePanel[];
}

export interface AudioSyncedVisualContent {
  strategy?: "timeline" | "audio-length-scaled";
  /** Fallback artifact for legacy/simple synced visuals. Rich audio may instead provide per-cue artifact_slug values. */
  artifact_slug?: string;
  scene: AudioGeneratedScene;
  cues: AudioSyncedVisualCue[];
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
  /** Executable part-specific coding practice. */
  code?: PracticeCodeContent;
  /** Mixed reinforcement practice for this part. */
  practice?: LessonPartPracticeContent;
  /** Legacy reinforcement quiz for old generated content. */
  quiz?: MultipleChoiceQuizContent;
}

/**
 * Validate a collapsed lesson-part activity. A lesson part bundles the written
 * teaching, audio script, interactive exploration, and mixed reinforcement
 * practice for one step/concept.
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
  } else {
    const transcript =
      typeof audio.transcript === "string" && audio.transcript.trim()
        ? audio.transcript
        : audio.script;
    if (typeof transcript !== "string" || transcript.trim().length < 200) {
      errors.push("audio: lesson_part requires a substantive learner-visible transcript");
    }
    const visual = validateAudioSyncedVisualContent(audio.synced_visual, audio.duration_hint);
    for (const e of visual.errors) errors.push(`audio.synced_visual: ${e}`);
  }

  if (widgetValidator) {
    const widget = widgetValidator(c.interactive, knownWidgetTypes);
    for (const e of widget.errors) errors.push(`interactive: ${e}`);
  } else if (!c.interactive || typeof c.interactive !== "object") {
    errors.push("interactive: lesson_part requires an interactive widget spec");
  }

  const code = validatePracticeCodeContent(c.code);
  for (const e of code.errors) errors.push(`code: ${e}`);

  const practice = validateLessonPartPracticeContent(c.practice);
  for (const e of practice.errors) errors.push(`practice: ${e}`);

  if (c.quiz !== undefined) {
    const quiz = validateMultipleChoiceQuizContent(c.quiz);
    for (const e of quiz.errors) errors.push(`quiz: ${e}`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateLessonPartPracticeContent(content: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!content || typeof content !== "object") {
    return { valid: false, errors: ["each lesson_part requires mixed practice, not only multiple-choice quiz"] };
  }
  const c = content as Record<string, unknown>;
  if (!Array.isArray(c.questions)) {
    return { valid: false, errors: ["questions must be an array"] };
  }
  if (c.questions.length < 6) {
    errors.push("questions must contain at least 6 mixed practice prompts");
  }
  if (c.pass_threshold !== undefined && (!Number.isInteger(c.pass_threshold) || Number(c.pass_threshold) < 1)) {
    errors.push("pass_threshold must be a positive integer when present");
  }
  if (c.written_feedback !== undefined && c.written_feedback !== "llm_judge") {
    errors.push('written_feedback must be "llm_judge" when present');
  }

  const seen = new Set<string>();
  const typeCounts: Record<LessonPartPracticeQuestionType, number> = {
    select_one: 0,
    select_all: 0,
    ordering: 0,
    written: 0,
  };
  let hasNoneSelectAll = false;
  let hasSomeSelectAll = false;

  for (const [i, raw] of c.questions.entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`questions[${i}] must be an object`);
      continue;
    }
    const q = raw as Record<string, unknown>;
    const type = q.type as LessonPartPracticeQuestionType;
    if (typeof q.id !== "string" || !q.id.trim()) {
      errors.push(`questions[${i}] missing id`);
    } else if (seen.has(q.id)) {
      errors.push(`questions[${i}] duplicate id "${q.id}"`);
    } else {
      seen.add(q.id);
    }
    if (!["select_one", "select_all", "ordering", "written"].includes(String(q.type))) {
      errors.push(`questions[${i}] type must be select_one, select_all, ordering, or written`);
      continue;
    }
    typeCounts[type]++;
    if (typeof q.prompt !== "string" || !q.prompt.trim()) {
      errors.push(`questions[${i}] missing prompt`);
    }
    if (typeof q.concept !== "string" || !q.concept.trim()) {
      errors.push(`questions[${i}] missing concept`);
    }
    if (!["easy", "medium", "hard"].includes(String(q.difficulty))) {
      errors.push(`questions[${i}] difficulty must be "easy", "medium", or "hard"`);
    }

    if (type === "select_one" || type === "select_all") {
      const choices = q.choices;
      if (!Array.isArray(choices) || choices.length < 2 || choices.length > 7) {
        errors.push(`questions[${i}] choices must contain 2 to 7 items`);
      } else if (!choices.every((choice) => typeof choice === "string" && choice.trim())) {
        errors.push(`questions[${i}] choices must be non-empty strings`);
      }
      if (type === "select_one") {
        if (q.correct_indices !== undefined) {
          errors.push(`questions[${i}] select_one must not use correct_indices; use select_all for multi-select answers`);
        }
        if (!Number.isInteger(q.correct_index)) {
          errors.push(`questions[${i}] select_one requires correct_index`);
        } else if (Array.isArray(choices) && (Number(q.correct_index) < 0 || Number(q.correct_index) >= choices.length)) {
          errors.push(`questions[${i}] correct_index out of range`);
        }
      } else {
        if (q.correct_index !== undefined) {
          errors.push(`questions[${i}] select_all must not use correct_index; use correct_indices, including [] for none`);
        }
        if (!Array.isArray(q.correct_indices)) {
          errors.push(`questions[${i}] select_all requires correct_indices, use [] for none`);
          continue;
        }
        const indices = q.correct_indices;
        if (!indices.every((idx) => Number.isInteger(idx) && Number(idx) >= 0)) {
          errors.push(`questions[${i}] correct_indices must contain non-negative integers`);
        }
        if (Array.isArray(choices) && indices.some((idx) => Number(idx) >= choices.length)) {
          errors.push(`questions[${i}] correct_indices contains out-of-range index`);
        }
        if (new Set(indices).size !== indices.length) {
          errors.push(`questions[${i}] correct_indices must not contain duplicates`);
        }
        if (indices.length === 0) hasNoneSelectAll = true;
        if (indices.length > 1) hasSomeSelectAll = true;
        // Lesson-part select_all must NOT carry an authored "none" choice: the
        // practice UI supplies a virtual none option for the true no-correct
        // case (correct_indices: []), so an authored none is a duplicate that
        // renders twice. This is the opposite of the top-level assessment quiz,
        // which requires a real "None of the above" choice.
        if (Array.isArray(choices)) {
          const authoredNone = choices.findIndex(
            (choice) =>
              typeof choice === "string" &&
              /^\s*none of (the above|these|the below|them)\s*\.?\s*$/i.test(choice)
          );
          if (authoredNone >= 0) {
            errors.push(
              `questions[${i}] select_all must not include an authored "none" choice (choices[${authoredNone}]); the UI supplies a virtual none for correct_indices: []`
            );
          }
        }
      }
    }

    if (type === "ordering") {
      if (!Array.isArray(q.items) || q.items.length < 3) {
        errors.push(`questions[${i}] ordering requires at least 3 items`);
      } else if (!q.items.every((item) => typeof item === "string" && item.trim())) {
        errors.push(`questions[${i}] ordering items must be non-empty strings`);
      }
      if (!Array.isArray(q.correct_order) || q.correct_order.length < 3) {
        errors.push(`questions[${i}] ordering requires correct_order`);
      } else if (!q.correct_order.every((item) => typeof item === "string" && item.trim())) {
        errors.push(`questions[${i}] ordering correct_order must contain item strings, not numeric indices`);
      } else if (Array.isArray(q.items)) {
        const items = q.items as unknown[];
        const itemSet = new Set(items);
        const orderSet = new Set(q.correct_order);
        if (itemSet.size !== items.length) {
          errors.push(`questions[${i}] ordering items must not contain duplicates`);
        }
        if (orderSet.size !== q.correct_order.length) {
          errors.push(`questions[${i}] ordering correct_order must not contain duplicates`);
        }
        if (q.correct_order.length !== items.length || !q.correct_order.every((item) => itemSet.has(item))) {
          errors.push(`questions[${i}] ordering correct_order must contain exactly the same strings as items`);
        }
      }
    }

    if (type === "written") {
      if (typeof q.actual_answer !== "string" || q.actual_answer.trim().length < 20) {
        errors.push(`questions[${i}] written requires a substantive actual_answer for LLM grading`);
      }
      if (typeof q.rubric !== "string" || q.rubric.trim().length < 20) {
        errors.push(`questions[${i}] written requires a substantive rubric`);
      }
    }
  }

  if (typeCounts.select_all < 2) errors.push("questions must include at least two select_all prompts");
  if (!hasNoneSelectAll) errors.push("select_all prompts must include one case where none are correct");
  if (!hasSomeSelectAll) errors.push("select_all prompts must include one case where multiple answers are correct");
  if (typeCounts.ordering < 1) errors.push("questions must include at least one ordering prompt");
  if (typeCounts.written < 1) errors.push("questions must include at least one written prompt with LLM grading");

  return { valid: errors.length === 0, errors };
}

export function validateAudioSyncedVisualContent(
  visual: unknown,
  durationHint: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!visual || typeof visual !== "object") {
    return {
      valid: false,
      errors: [
        "required for every lesson_part; provide timed cues that change the visual as the audio advances",
      ],
    };
  }
  const v = visual as Record<string, unknown>;
  if (v.strategy !== undefined && v.strategy !== "timeline" && v.strategy !== "audio-length-scaled") {
    errors.push('strategy must be "timeline" or "audio-length-scaled" when provided');
  }
  const hasFallbackArtifact = typeof v.artifact_slug === "string" && /^[a-z0-9-]+$/.test(v.artifact_slug);
  if (v.artifact_slug !== undefined && !hasFallbackArtifact) {
    errors.push("artifact_slug must be lowercase alphanumeric with hyphens and reference an approved DB-backed bespoke visual artifact");
  }
  const scene = validateAudioGeneratedScene(v.scene);
  for (const e of scene.errors) errors.push(`scene: ${e}`);
  if (!Array.isArray(v.cues) || v.cues.length < 3) {
    errors.push("cues must contain at least 3 timed visual states");
    return { valid: errors.length === 0, errors };
  }
  let previousStart = -1;
  const duration = typeof durationHint === "number" && Number.isFinite(durationHint) ? durationHint : null;
  let lastEnd = 0;
  let cueArtifactCount = 0;
  const cueArtifactSlugs = new Set<string>();
  for (const [index, cue] of v.cues.entries()) {
    if (!cue || typeof cue !== "object") {
      errors.push(`cue[${index}] must be an object`);
      continue;
    }
    const c = cue as Record<string, unknown>;
    if (typeof c.start !== "number" || !Number.isFinite(c.start) || c.start < 0) {
      errors.push(`cue[${index}].start must be a non-negative number of seconds`);
    } else if (c.start < previousStart) {
      errors.push(`cue[${index}].start must be sorted in ascending audio time`);
    } else {
      previousStart = c.start;
      lastEnd = Math.max(lastEnd, c.start);
    }
    if (c.end !== undefined) {
      if (typeof c.end !== "number" || !Number.isFinite(c.end) || c.end <= Number(c.start)) {
        errors.push(`cue[${index}].end must be greater than start when provided`);
      } else {
        lastEnd = Math.max(lastEnd, c.end);
      }
    }
    for (const legacyField of ["at_char", "action", "target"] as const) {
      if (legacyField in c) {
        errors.push(`cue[${index}] uses legacy ${legacyField}; synced visuals require timed start/end cues`);
      }
    }
    for (const field of ["label", "headline", "narration"] as const) {
      if (typeof c[field] !== "string" || !c[field].trim()) {
        errors.push(`cue[${index}].${field} is required`);
      }
    }
    if (c.artifact_slug !== undefined) {
      if (typeof c.artifact_slug !== "string" || !/^[a-z0-9-]+$/.test(c.artifact_slug)) {
        errors.push(`cue[${index}].artifact_slug must be lowercase alphanumeric with hyphens`);
      } else {
        cueArtifactCount += 1;
        cueArtifactSlugs.add(c.artifact_slug);
      }
    }
    if (!c.receive && !c.transform && !c.pass) {
      errors.push(`cue[${index}] must describe at least one of receive, transform, or pass`);
    }
    if (c.panel_id !== undefined && typeof c.panel_id !== "string") {
      errors.push(`cue[${index}].panel_id must be a string when present`);
    }
    if (c.active_elements !== undefined && !isStringArray(c.active_elements)) {
      errors.push(`cue[${index}].active_elements must be an array of strings when present`);
    }
  }
  if (duration !== null && duration > 0 && lastEnd < duration * 0.80) {
    errors.push(
      `timed cues must cover at least 80% of duration_hint (${duration}s) so the visual changes through the entire audio; last cue ends at ${lastEnd}s`
    );
  }
  // Minimum cue density: at least 1 cue per 60 seconds for lesson-part audio
  // (60s < duration <= 600s). Overview audio (> 600s) may use fewer broader
  // cues. This catches the Lesson 15 Section 86 bug class: 3 cues for 162s.
  if (duration !== null && duration > 60 && duration <= 600) {
    const minCues = Math.max(3, Math.ceil(duration / 60));
    if (v.cues.length < minCues) {
      errors.push(
        `audio of ${duration}s needs at least ${minCues} cues (one per ~60s minimum); got ${v.cues.length}. Plan visual beats roughly every 5-10 seconds.`
      );
    }
  }
  // Gap detection: no gap > 30s between consecutive cues for lesson-part audio
  // (60s < duration <= 600s). Overview audio uses broader cues and is exempt.
  if (duration !== null && duration > 60 && duration <= 600 && v.cues.length >= 2) {
    for (let i = 1; i < v.cues.length; i++) {
      const prev = v.cues[i - 1] as Record<string, unknown>;
      const curr = v.cues[i] as Record<string, unknown>;
      const prevEnd = typeof prev.end === "number" ? prev.end : (typeof prev.start === "number" ? prev.start : 0);
      const currStart = typeof curr.start === "number" ? curr.start : 0;
      if (currStart - prevEnd > 30) {
        errors.push(
          `gap of ${Math.round(currStart - prevEnd)}s between cue[${i - 1}] and cue[${i}] exceeds 30s maximum; add intermediate cues to keep the visual changing`
        );
      }
    }
  }
  if (!hasFallbackArtifact && cueArtifactCount !== v.cues.length) {
    errors.push("audio synced visual requires a fallback artifact_slug or an approved cue.artifact_slug on every cue");
  }
  if (cueArtifactCount > 0 && cueArtifactSlugs.size < Math.min(2, cueArtifactCount)) {
    errors.push("segmented audio visuals must use distinct per-cue artifact_slug values, not one repeated component");
  }
  return { valid: errors.length === 0, errors };
}

function validateAudioGeneratedScene(scene: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!scene || typeof scene !== "object") {
    return {
      valid: false,
      errors: ["required; each audio segment needs a generated bespoke scene plan, not a reused generic visual"],
    };
  }
  const s = scene as Record<string, unknown>;
  for (const field of ["scene_id", "title", "motif", "description"] as const) {
    if (typeof s[field] !== "string" || !(s[field] as string).trim()) {
      errors.push(`${field} is required`);
    }
  }
  if (typeof s.description === "string" && s.description.trim().length < 30) {
    errors.push("description must explain what makes this scene specific to the audio");
  }
  if (!Array.isArray(s.panels) || s.panels.length < 2) {
    errors.push("panels must include at least two generated visual panels");
    return { valid: errors.length === 0, errors };
  }
  const ids = new Set<string>();
  for (const [i, rawPanel] of s.panels.entries()) {
    if (!rawPanel || typeof rawPanel !== "object") {
      errors.push(`panels[${i}] must be an object`);
      continue;
    }
    const panel = rawPanel as Record<string, unknown>;
    if (typeof panel.id !== "string" || !panel.id.trim()) {
      errors.push(`panels[${i}].id is required`);
    } else if (ids.has(panel.id)) {
      errors.push(`panels[${i}].id duplicates another panel`);
    } else {
      ids.add(panel.id);
    }
    if (typeof panel.title !== "string" || !panel.title.trim()) {
      errors.push(`panels[${i}].title is required`);
    }
    if (!["matrix", "vector", "ledger", "pipeline", "flow", "bar", "cards", "formula", "custom"].includes(String(panel.kind))) {
      errors.push(`panels[${i}].kind must be matrix, vector, ledger, pipeline, flow, bar, cards, formula, or custom`);
    }
    if (typeof panel.description !== "string" || panel.description.trim().length < 20) {
      errors.push(`panels[${i}].description must explain the panel`);
    }
    if (!Array.isArray(panel.data) || panel.data.length === 0) {
      errors.push(`panels[${i}].data must contain generated visual data`);
      continue;
    }
    for (const [di, rawDatum] of panel.data.entries()) {
      if (!rawDatum || typeof rawDatum !== "object") {
        errors.push(`panels[${i}].data[${di}] must be an object`);
        continue;
      }
      const datum = rawDatum as Record<string, unknown>;
      if (typeof datum.label !== "string" || !datum.label.trim()) {
        errors.push(`panels[${i}].data[${di}].label is required`);
      }
      if (datum.value !== undefined && typeof datum.value !== "string") {
        errors.push(`panels[${i}].data[${di}].value must be a string when present`);
      }
      if (datum.values !== undefined) {
        if (!Array.isArray(datum.values) || !datum.values.every((value) => typeof value === "number" && Number.isFinite(value))) {
          errors.push(`panels[${i}].data[${di}].values must be finite numbers when present`);
        }
      }
      if (datum.role !== undefined && !["input", "process", "output", "context"].includes(String(datum.role))) {
        errors.push(`panels[${i}].data[${di}].role must be input, process, output, or context`);
      }
    }
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
  const freeformTypes: FreeformAnswerType[] = [
    "free_text",
    "numeric",
    "fill_blank",
    "ordering",
    "matching",
    "classification",
    "multiple_choice",
  ];
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
    if (q.type !== undefined && !freeformTypes.includes(q.type as FreeformAnswerType)) {
      errors.push(`assessment questions[${i}] type must be one of ${freeformTypes.join(", ")}`);
    }
    if (q.accepted_answers !== undefined && !isStringArray(q.accepted_answers)) {
      errors.push(`assessment questions[${i}] accepted_answers must be an array of strings`);
    }
    if (q.type === "fill_blank") {
      if (!Array.isArray(q.blanks) || q.blanks.length === 0) {
        errors.push(`assessment questions[${i}] fill_blank requires a non-empty blanks array`);
      } else {
        validateIdTextObjects(q.blanks, `assessment questions[${i}].blanks`, errors, "id", "label", true);
      }
    }
    if (q.type === "ordering") {
      if (!Array.isArray(q.items) || q.items.length < 2) {
        errors.push(`assessment questions[${i}] ordering requires at least 2 items`);
      } else {
        validateStringOrIdTextObjects(q.items, `assessment questions[${i}].items`, errors);
      }
    }
    if (q.type === "matching") {
      if (!Array.isArray(q.prompts) || q.prompts.length < 2) {
        errors.push(`assessment questions[${i}] matching requires at least 2 prompts`);
      } else {
        validateIdTextObjects(q.prompts, `assessment questions[${i}].prompts`, errors);
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`assessment questions[${i}] matching requires at least 2 options`);
      } else {
        validateIdTextObjects(q.options, `assessment questions[${i}].options`, errors);
      }
    }
    if (q.type === "classification") {
      if (!Array.isArray(q.items) || q.items.length < 2) {
        errors.push(`assessment questions[${i}] classification requires at least 2 items`);
      } else {
        validateStringOrIdTextObjects(q.items, `assessment questions[${i}].items`, errors);
      }
      if (!Array.isArray(q.categories) || q.categories.length < 2) {
        errors.push(`assessment questions[${i}] classification requires at least 2 categories`);
      } else {
        validateIdTextObjects(q.categories, `assessment questions[${i}].categories`, errors, "id", "label");
      }
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateStringOrIdTextObjects(value: unknown[], path: string, errors: string[]) {
  for (const [index, item] of value.entries()) {
    if (typeof item === "string") {
      if (!item.trim()) errors.push(`${path}[${index}] must be a non-empty string`);
      continue;
    }
    if (!item || typeof item !== "object") {
      errors.push(`${path}[${index}] must be a string or object`);
      continue;
    }
    validateIdTextObjects([item], `${path}[${index}]`, errors);
  }
}

function validateIdTextObjects(
  value: unknown[],
  path: string,
  errors: string[],
  idKey = "id",
  textKey = "text",
  textOptional = false
) {
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") {
      errors.push(`${path}[${index}] must be an object`);
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = record[idKey];
    if (typeof id !== "string" || !id.trim()) {
      errors.push(`${path}[${index}] missing ${idKey}`);
    } else if (ids.has(id)) {
      errors.push(`${path}[${index}] duplicate ${idKey} "${id}"`);
    } else {
      ids.add(id);
    }
    const text = record[textKey];
    if (!textOptional && (typeof text !== "string" || !text.trim())) {
      errors.push(`${path}[${index}] missing ${textKey}`);
    }
    if (textOptional && text !== undefined && typeof text !== "string") {
      errors.push(`${path}[${index}] ${textKey} must be a string when present`);
    }
  }
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
