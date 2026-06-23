/**
 * Assessment pipeline — turns a learner's answer into tag + difficulty + mastery
 * evidence.
 *
 * This is the boundary between the app and any answer-assessment backend. The
 * default implementation is a DETERMINISTIC local assessor with no LLM call, so
 * the core learning loop always works offline and in tests. A future ACP/LLM
 * assessor can implement the same {@link AssessmentAdapter} interface and enrich
 * the tags without changing any caller.
 *
 * What the assessor decides, given a question + answer + the subject's existing
 * tag vocabulary:
 *  - which EXISTING subject tags the answer matches,
 *  - which MISSING tags should be created (clear normalized name + a tag type
 *    compatible with the tags table),
 *  - a single mastery signal (type + concept + confidence + difficulty).
 *
 * This module is pure (no DB, no React). The /api/assess route persists the
 * decisions; failures there are surfaced as API errors, never silently dropped.
 */

import type { Difficulty, SignalType } from "@/types";

/** Tag types accepted by the tags table. */
export type TagType =
  | "concept"
  | "misconception"
  | "review_topic"
  | "curriculum_area"
  | "lesson_type";

/** A subject's existing tag, used as the vocabulary to match against. */
export interface SubjectTagRef {
  id: number;
  name: string;
  tag_type: TagType;
}

export interface AssessmentInput {
  question_type: "mc" | "freeform" | "diagnostic";
  question_text: string;
  /** Concept tag carried by the question, if any. */
  concept?: string | null;
  difficulty?: Difficulty | null;
  /**
   * Grading outcome for multiple-choice questions. Omitted for freeform and
   * diagnostic answers, which the assessor evaluates heuristically.
   */
  mc_outcome?: "correct" | "incorrect" | "idk";
  /** The learner's freeform answer or selected choice text. */
  answer_text?: string | null;
  /** Existing subject tag vocabulary to match against. */
  subject_tags: SubjectTagRef[];
}

/** A tag the assessor decided is relevant to this answer. */
export interface AssessmentTagDecision {
  /** Normalized, storage-ready tag name. */
  name: string;
  tag_type: TagType;
  /** True when the tag already exists in the subject vocabulary. */
  existing: boolean;
}

export interface AssessmentSignal {
  signal_type: SignalType;
  concept: string;
  detail: string;
  /** Estimated mastery of the concept in [0, 1]; feeds the mastery score. */
  confidence: number;
  difficulty: Difficulty | null;
}

export interface AssessmentOutcome {
  /** Normalized outcome persisted on the assessment_results row. */
  outcome: "correct" | "incorrect" | "idk" | "assessed";
  /** Matched + newly proposed tags for this answer. */
  tags: AssessmentTagDecision[];
  signal: AssessmentSignal;
}

export interface AssessmentAdapter {
  name: string;
  assess(input: AssessmentInput): Promise<AssessmentOutcome> | AssessmentOutcome;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize an arbitrary concept/phrase into a stable tag name: lowercase,
 * hyphen-separated, alphanumeric only. Deterministic and idempotent.
 */
export function normalizeTagName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Stop-word-light tokenizer for overlap matching. */
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "to", "in", "is", "it", "and", "or", "for", "on",
  "that", "this", "with", "as", "by", "are", "be", "at", "from", "what", "how",
  "why", "when", "which", "you", "your", "i", "we", "do", "does", "not", "no",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, " ")
      .split(/[\s-]+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );
}

/** Uncertainty markers that flag a freeform answer as low-confidence. */
const UNCERTAINTY_RE =
  /\b(not sure|unsure|no idea|don'?t know|dont know|idk|not certain|confused|lost|unclear|guess(ing)?|maybe|i think\??)\b/i;

const CONFIDENCE_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 0.6,
  medium: 0.78,
  hard: 0.92,
};

/**
 * Match a concept against the subject's existing tag vocabulary. Returns the
 * matched tag, or null if none matches by normalized name or full token overlap.
 */
function matchExistingTag(
  concept: string | null | undefined,
  haystack: string,
  subjectTags: SubjectTagRef[]
): SubjectTagRef | null {
  if (concept) {
    const norm = normalizeTagName(concept);
    const byName = subjectTags.find((t) => normalizeTagName(t.name) === norm);
    if (byName) return byName;
  }
  // Token-overlap fallback: a subject tag whose name tokens all appear in the
  // question/answer text is a strong match.
  const hayTokens = tokenize(haystack);
  for (const t of subjectTags) {
    const tagTokens = tokenize(t.name);
    if (tagTokens.size > 0 && [...tagTokens].every((tok) => hayTokens.has(tok))) {
      return t;
    }
  }
  return null;
}

// ─── Deterministic assessor ───────────────────────────────────────────────────

/**
 * The default, no-LLM assessment adapter. Pure and synchronous.
 */
export const deterministicAssessmentAdapter = {
  name: "deterministic",
  assess(input: AssessmentInput): AssessmentOutcome {
    const difficulty = input.difficulty ?? null;
    const haystack = `${input.question_text} ${input.answer_text ?? ""}`;
    const matched = matchExistingTag(input.concept, haystack, input.subject_tags);

    const tags: AssessmentTagDecision[] = [];
    if (matched) {
      tags.push({ name: matched.name, tag_type: matched.tag_type, existing: true });
    }

    // ─── Multiple-choice path ──────────────────────────────────────────────
    if (input.question_type === "mc" && input.mc_outcome) {
      const conceptName = input.concept ?? matched?.name ?? "general";
      const outcome = input.mc_outcome;

      let signal: AssessmentSignal;
      if (outcome === "correct") {
        signal = {
          signal_type: "strength",
          concept: conceptName,
          detail: `Answered a ${difficulty ?? "ungraded"} question on "${conceptName}" correctly.`,
          confidence: difficulty ? CONFIDENCE_BY_DIFFICULTY[difficulty] : 0.7,
          difficulty,
        };
      } else if (outcome === "idk") {
        // High-signal uncertainty — no shame, but clearly review-needed.
        signal = {
          signal_type: "review_needed",
          concept: conceptName,
          detail: `Selected "I don't know" on a ${difficulty ?? "ungraded"} question about "${conceptName}" — flagged as low confidence.`,
          confidence: 0.1,
          difficulty,
        };
      } else {
        signal = {
          signal_type: "misconception",
          concept: conceptName,
          detail: `Answered a ${difficulty ?? "ungraded"} question on "${conceptName}" incorrectly.`,
          // A wrong answer on an easy question is the weakest evidence of mastery.
          confidence: difficulty === "hard" ? 0.3 : difficulty === "medium" ? 0.2 : 0.1,
          difficulty,
        };
      }

      // When the concept is not already in the vocabulary, propose a new tag.
      // Wrong / IDK answers reveal a misconception or review topic; correct
      // answers reveal a mastered concept.
      if (!matched && input.concept) {
        tags.push({
          name: normalizeTagName(input.concept),
          tag_type: outcome === "correct" ? "concept" : "misconception",
          existing: false,
        });
      }

      return { outcome, tags, signal };
    }

    // ─── Freeform / diagnostic path ────────────────────────────────────────
    const answer = (input.answer_text ?? "").trim();
    const conceptName = input.concept ?? matched?.name ?? "general";
    const uncertain = answer.length === 0 || UNCERTAINTY_RE.test(answer);
    const substantive = answer.length >= 40 && tokenize(answer).size >= 5;

    let signal: AssessmentSignal;
    if (uncertain) {
      signal = {
        signal_type: "review_needed",
        concept: conceptName,
        detail:
          answer.length === 0
            ? `Left "${conceptName}" unanswered — flagged for review.`
            : `Expressed uncertainty about "${conceptName}".`,
        confidence: 0.2,
        difficulty,
      };
    } else if (substantive) {
      signal = {
        signal_type: "strength",
        concept: conceptName,
        detail: `Gave a substantive answer about "${conceptName}".`,
        confidence: difficulty ? CONFIDENCE_BY_DIFFICULTY[difficulty] : 0.6,
        difficulty,
      };
    } else {
      signal = {
        signal_type: "review_needed",
        concept: conceptName,
        detail: `Gave a brief answer about "${conceptName}" — worth reinforcing.`,
        confidence: 0.4,
        difficulty,
      };
    }

    // Propose a new concept tag when the question names a concept outside the
    // current vocabulary, so freeform answers grow the tag set too.
    if (!matched && input.concept) {
      tags.push({
        name: normalizeTagName(input.concept),
        tag_type: uncertain ? "review_topic" : "concept",
        existing: false,
      });
    }

    return { outcome: "assessed", tags, signal };
  },
} satisfies AssessmentAdapter;

/**
 * Select the configured assessment adapter. Deterministic by default; a future
 * deployment can register an ACP/LLM adapter behind AVOCADOCORE_ASSESSMENT_ADAPTER
 * without touching callers. Unknown values fall back to deterministic so the
 * core loop never breaks.
 */
export function getAssessmentAdapter(): AssessmentAdapter {
  // Only the deterministic adapter ships in the reusable repo; LLM adapters are
  // deployment-specific and registered locally. Kept as a seam for the future.
  return deterministicAssessmentAdapter;
}
