export interface TranscriptQualityResult {
  ok: boolean;
  errors: string[];
  metrics: {
    words: number;
    leoTurns: number;
    mayaTurns: number;
    questions: number;
    layeredQuestions: number;
    analogyHits: number;
    concreteHits: number;
    failureModeHits: number;
  };
}

export const TRANSCRIPT_BAD_PATTERN_RE =
  /(?:audio session|provider:|voice:|here is the lesson content|point\s+\d+\s*:\s*(?:lesson part|code practice|assessment|reading|interactive)|lesson part\s+"|code practice\s+"|assessment\s+".*checks whether|\b(?:lesson part|code exercise|practice question|assessment question|final integrator|the practice|this part belongs|section title)\b|treat these as signposts|ask four questions|what would the variable names be|what would a small input look like|what output would a test assert|do not try to memorize|don't try to memorize|listen for the object|object and the handoff|before we dive into details|building a mental map|guided conversation and less like a lecture|not rushing through a table of contents|pick one small object from the lesson|exact object matters less than the habit|this mechanism pass is slower on purpose|if a word sounds important|look for in the visual|watch in the visual)/i;

const LEO_RE = /^(?:\*\*)?Leo(?:\*\*)?:/gim;
const MAYA_RE = /^(?:\*\*)?Maya(?:\*\*)?:/gim;
const ANALOGY_RE = /\b(?:analogy|metaphor|think of|imagine|like a|as if|picture|same way)\b/i;
const CONCRETE_RE = /\b(?:example|tiny|concrete|take the|use three|short text|in code|shape|row|table|score|probability|token|vector|price|image|string)\b/i;
const FAILURE_RE = /\b(?:mistake|misconception|failure|breaks|wrong|bug|invalid|confuse|too quickly|goes wrong)\b/i;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function validateLearnerFacingAudioTranscript(
  transcript: string,
  opts: { minWords?: number; requireLongOverview?: boolean } = {}
): TranscriptQualityResult {
  const text = transcript.trim();
  const errors: string[] = [];
  const metrics = {
    words: wordCount(text),
    leoTurns: text.match(LEO_RE)?.length ?? 0,
    mayaTurns: text.match(MAYA_RE)?.length ?? 0,
    questions: (text.match(/\?/g) ?? []).length,
    layeredQuestions: (text.match(/\b(?:why|how exactly|what changes|what does that|how does that|so does that mean|can you go deeper|what is the causal chain)\b/gi) ?? []).length,
    analogyHits: text.match(new RegExp(ANALOGY_RE.source, "gi"))?.length ?? 0,
    concreteHits: text.match(new RegExp(CONCRETE_RE.source, "gi"))?.length ?? 0,
    failureModeHits: text.match(new RegExp(FAILURE_RE.source, "gi"))?.length ?? 0,
  };
  const minWords = opts.minWords ?? (opts.requireLongOverview ? 2700 : 200);

  if (metrics.words < minWords) {
    errors.push(`transcript must have at least ${minWords} words; got ${metrics.words}`);
  }
  if (metrics.leoTurns < 4 || metrics.mayaTurns < 4) {
    errors.push("transcript must use a real two-host conversation with at least four Leo and four Maya turns");
  }
  if (metrics.questions < 5) {
    errors.push("transcript must include real learner-style questions, not only monologue");
  }
  if (metrics.layeredQuestions < 5) {
    errors.push("Maya must ask at least five layered why/how/causal follow-up questions");
  }
  if (metrics.analogyHits < 1) {
    errors.push("transcript must include at least one analogy or metaphor that supports the concept");
  }
  if (metrics.concreteHits < 3) {
    errors.push("transcript must include concrete examples, objects, shapes, rows, tables, code, or comparable specifics");
  }
  if (metrics.failureModeHits < 1) {
    errors.push("transcript must name a misconception, failure mode, bug, or concrete way the idea can be misused");
  }
  if (TRANSCRIPT_BAD_PATTERN_RE.test(text)) {
    errors.push("transcript must not include provider/debug metadata, generator-outline narration, or generic study-coaching instructions");
  }

  return { ok: errors.length === 0, errors, metrics };
}
