/**
 * Configurable LLM client for async answer feedback.
 *
 * Supports four provider modes via environment variables:
 *   - local:     OpenAI-compatible API (llama.cpp, vLLM, etc.)
 *   - openai:    OpenAI API
 *   - anthropic: Anthropic Messages API
 *   - google:    Google Generative Language API
 *
 * Feature is OFF by default. Set AVOCADOCORE_FEEDBACK_PROVIDER to enable.
 *
 * Environment variables:
 *   AVOCADOCORE_FEEDBACK_PROVIDER  - "local" | "openai" | "anthropic" | "google" (unset = disabled)
 *   AVOCADOCORE_FEEDBACK_BASE_URL  - Base URL for local/openai (default: http://127.0.0.1:8080/v1)
 *   AVOCADOCORE_FEEDBACK_GOOGLE_BASE_URL / AVOCADOCORE_FEEDBACK_ANTHROPIC_BASE_URL
 *                                  - Provider-specific cloud endpoint overrides.
 *   AVOCADOCORE_FEEDBACK_API_KEY   - API key for cloud providers
 *   AVOCADOCORE_FEEDBACK_MODEL     - Model name (has sensible defaults per provider)
 */

export type FeedbackProvider = "local" | "openai" | "anthropic" | "google";

export interface FeedbackConfig {
  enabled: boolean;
  provider: FeedbackProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const DEFAULT_MODELS: Record<FeedbackProvider, string> = {
  local: "default",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6-20250514",
  google: "gemma-4-26b-a4b-it",
};

const DEFAULT_BASE_URLS: Record<FeedbackProvider, string> = {
  local: "http://127.0.0.1:8080/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
};

const LOCAL_LESSON_CHAT_MAX_TOKENS = 700;

function feedbackBaseUrlEnvName(provider: FeedbackProvider): string {
  return `AVOCADOCORE_FEEDBACK_${provider.toUpperCase()}_BASE_URL`;
}

function resolveFeedbackBaseUrl(provider: FeedbackProvider): string {
  const providerSpecific = process.env[feedbackBaseUrlEnvName(provider)];
  const genericOpenAiCompatible =
    provider === "local" || provider === "openai"
      ? process.env.AVOCADOCORE_FEEDBACK_BASE_URL
      : undefined;
  return (providerSpecific ?? genericOpenAiCompatible ?? DEFAULT_BASE_URLS[provider]).replace(/\/+$/, "");
}

export function loadFeedbackConfig(): FeedbackConfig {
  const provider = (process.env.AVOCADOCORE_FEEDBACK_PROVIDER ?? "").trim().toLowerCase();
  if (!provider || !["local", "openai", "anthropic", "google"].includes(provider)) {
    return { enabled: false, provider: "local", baseUrl: "", apiKey: "", model: "" };
  }
  const p = provider as FeedbackProvider;
  return {
    enabled: true,
    provider: p,
    baseUrl: resolveFeedbackBaseUrl(p),
    apiKey: process.env.AVOCADOCORE_FEEDBACK_API_KEY ?? "",
    model: process.env.AVOCADOCORE_FEEDBACK_MODEL ?? DEFAULT_MODELS[p],
  };
}

export interface FeedbackRequest {
  lessonTitle: string;
  lessonDescription: string | null;
  questionText: string;
  questionHint: string | null;
  learnerAnswer: string;
}

export interface AnswerJudgeRequest extends FeedbackRequest {
  questionType: string;
  actualAnswer: string;
  rubric: string | null;
  acceptedAnswers: string[];
  supportRef: string | null;
}

export interface AnswerJudgment {
  verdict: "correct" | "partially_correct" | "incorrect" | "unclear";
  confidence: number;
  feedback: string;
}

export interface LessonChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LessonChatRequest {
  lessonTitle: string;
  lessonDescription: string | null;
  lessonContext: string;
  compactSummary: string | null;
  messages: LessonChatMessage[];
}

export interface CodeFeedbackRequest {
  lessonTitle: string;
  lessonDescription: string | null;
  exerciseTitle: string;
  exercisePrompt: string;
  starterCode: string | null;
  learnerCode: string;
  interpreterOutput: string;
  publicTestResults: Array<{ id: string; description: string; status: "pass" | "fail" | "not_run" }>;
  hiddenTestSummary: { total: number; passed: number } | null;
  allPassed: boolean;
}

export interface PhaseDecisionRequest {
  evidencePacket: string;
}

export interface PhaseDecision {
  current_level: "familiarity" | "competence" | "mastery" | "post_mastery";
  recommended_level: "familiarity" | "competence" | "mastery" | "post_mastery";
  should_change_level: boolean;
  confidence: number;
  reason: string;
  missing_evidence: string[];
  next_lesson_directive: string;
}

const LOCAL_CHAT_CONTEXT_CHAR_LIMIT = 3000;
const LOCAL_CHAT_SUMMARY_CHAR_LIMIT = 700;
const LOCAL_CHAT_MESSAGE_CHAR_LIMIT = 700;
const LOCAL_CHAT_MESSAGE_LIMIT = 3;

const FEEDBACK_SYSTEM = `You are a friendly learning coach. Give feedback on the student's answer.

Max 2 paragraphs, max 4 sentences each. Hard limit.
- First paragraph: what they got right and wrong. Be specific and direct.
- Second paragraph: teach what they missed with a concrete example or number.
- Casual tone, like a friend explaining. No bullets, headers, or lists.
- Use **bold** for key terms only.
- If they nailed it, 2-3 sentences total.`;

const JUDGE_SYSTEM = `You judge a learner's answer against the lesson question.

Return ONLY compact JSON with this shape:
{"verdict":"correct|partially_correct|incorrect|unclear","confidence":0.0,"feedback":"one or two learner-facing sentences"}

Rules:
- Grade against the actual answer, using the question text and lesson context to understand what matters.
- Focus on meaning, not exact syntax or wording. Equivalent phrasing, synonyms, and different sentence structure should be correct.
- Require exact syntax, a specific term, a number, or a specific order only when the question or actual answer clearly makes that precision essential.
- Use the rubric, accepted answers, and lesson support reference when provided.
- Mark fill-in-the-blank and numeric answers correct when they match accepted variants or are clearly equivalent.
- Use partially_correct when the answer contains the main idea but misses an important condition, order, or distinction.
- Use unclear for empty, ambiguous, or "I don't know" style answers.
- Feedback must be useful even when verdict is unclear or incorrect. Say what is missing or too vague, then give one concrete hint from the actual answer/rubric/support reference.
- Never return generic feedback like "I could not judge clearly" or "add one concrete detail" without naming the kind of detail to add.
- Do not reveal hidden solution text beyond what is necessary for feedback.`;

const JUDGE_REPAIR_SYSTEM = `You repair an unhelpful learner-answer judgment.

Return ONLY compact JSON with this shape:
{"verdict":"correct|partially_correct|incorrect|unclear","confidence":0.0,"feedback":"one or two learner-facing sentences"}

The previous judgment feedback was too vague. Produce actionable feedback now:
- Name the specific missing concept, mechanism, condition, or distinction.
- Give one concrete hint from the actual answer/rubric/support reference.
- Do not say "I could not judge clearly" or "add one concrete detail" unless you name the detail to add.
- Keep the tone friendly and concise.`;

const LESSON_CHAT_SYSTEM = `You are an in-lesson tutor for Open Avocado.

Answer the learner's quick question using the current lesson context and prior chat.
Rules:
- Keep answers concise by default: 1-4 short paragraphs.
- Explain just enough to unblock the learner, then stop.
- If using a worked example, keep it tiny and finish the example completely. Do not start a numbered list unless you can finish every listed step.
- For math examples, prefer at most 2 tokens and 2 dimensions unless the learner asks for more.
- Prefer the lesson's wording and examples when available.
- If the learner asks for a hint, give a hint, not the full answer.
- If the learner asks for code, show the smallest useful snippet and explain the key idea.
- Do not claim to remember anything outside the supplied lesson/chat context.
- Do not mark lesson progress or say a lesson is complete.`;

const LESSON_CHAT_SUMMARY_SYSTEM = `Compact an Open Avocado lesson chat.

Return a concise running summary that preserves:
- The learner's actual questions.
- Tutor explanations already given.
- Misconceptions, confusions, and examples that should matter later.
- Any unresolved follow-up.

Do not include filler, timestamps, or generic encouragement.`;

const CODE_FEEDBACK_SYSTEM = `You are a code tutor for Open Avocado.

The learner just submitted code. You receive the exercise context, their code, interpreter output, public test results, and only a hidden-test pass count.

Return learner-facing feedback only.
- If all tests passed: 1-2 concise sentences noting the key idea that worked.
- If anything failed: 2-4 concise sentences. Name the most likely issue, cite the visible output or failed public test, and give one actionable hint for the next edit.
- Do not reveal hidden test assertions or invent hidden-test details.
- Do not provide a full corrected solution unless the submitted code is already essentially correct.
- Prefer a hint over a rewrite.`;

const PHASE_DECISION_SYSTEM = `You are Open Avocado's adaptive learning phase evaluator.

Use the Open Avocado adaptive-planning skill mentally before deciding:
1. Query and inspect all available evidence for this user and subject from the supplied evidence packet, including subject goals and criteria, learner profile preferences, completed and discarded lesson history, lesson plans, knowledge graphs, assessments, diagnostics, mastery signals, code attempts, workpad, journal notes, generation jobs, and cross-subject history when present.
2. Treat the packet as the source of truth. If some evidence is missing, name that missing evidence instead of guessing.
3. Compare the learner's demonstrated understanding against the subject's long-term goal, not just the latest lesson.
4. Decide the phase from semantic evidence and trajectory. Do not use fixed numeric thresholds. Do not graduate because a count is high.

Phase meanings:
- familiarity: high-level concepts, vocabulary, purpose, and how pieces relate. Stay here until the learner has a coherent subject map, not merely one local concept.
- competence: important details, mechanisms, edge cases, and practice. Use only when the learner has demonstrated the high-level map well enough that future lessons should mainly deepen details.
- mastery: transfer, integration, debugging, and harder evidence across contexts.
- post_mastery: frontier-paper mode, only after strong mastered foundation and enough evidence that ordinary lessons are no longer the right next move.

Return ONLY compact JSON:
{"current_level":"familiarity|competence|mastery|post_mastery","recommended_level":"familiarity|competence|mastery|post_mastery","should_change_level":false,"confidence":0.0,"reason":"learner-facing explanation","missing_evidence":["specific missing evidence"],"next_lesson_directive":"specific instruction for the next lesson planner"}

Rules:
- You may keep the current phase, advance, or recalibrate downward if the stored phase is ahead of the evidence.
- Prefer holding or recalibrating over premature graduation.
- If evidence confirms only high-level understanding of the earliest concepts in a broad subject, keep or return to familiarity and instruct the next lesson to continue mapping missing high-level stages.
- A preview in a lesson is not proof of understanding.
- A completed lesson is not proof of competence by itself.
- Mention the exact missing concepts or stages when possible.
- Keep reason under 500 characters and next_lesson_directive under 700 characters.`;

function buildUserPrompt(req: FeedbackRequest): string {
  const parts = [`Lesson: ${req.lessonTitle}`];
  if (req.lessonDescription) parts.push(`Context: ${req.lessonDescription}`);
  parts.push(`Question: ${req.questionText}`);
  if (req.questionHint) parts.push(`Hint given: ${req.questionHint}`);
  parts.push(`Student's answer: ${req.learnerAnswer}`);
  return parts.join("\n");
}

function buildJudgePrompt(req: AnswerJudgeRequest): string {
  const parts = [`Lesson: ${req.lessonTitle}`];
  if (req.lessonDescription) parts.push(`Context: ${req.lessonDescription}`);
  parts.push(`Question type: ${req.questionType}`);
  parts.push(`Question: ${req.questionText}`);
  if (req.questionHint) parts.push(`Hint given: ${req.questionHint}`);
  if (req.supportRef) parts.push(`Lesson support reference: ${req.supportRef}`);
  if (req.rubric) parts.push(`Rubric: ${req.rubric}`);
  if (req.acceptedAnswers.length) parts.push(`Accepted answers or variants: ${req.acceptedAnswers.join(" | ")}`);
  parts.push(`Actual answer: ${req.actualAnswer}`);
  parts.push(`Learner answer: ${req.learnerAnswer}`);
  return parts.join("\n");
}

function buildLessonChatSystem(req: LessonChatRequest): string {
  const parts = [
    LESSON_CHAT_SYSTEM,
    "",
    `Current lesson: ${req.lessonTitle}`,
  ];
  if (req.lessonDescription) parts.push(`Lesson description: ${req.lessonDescription}`);
  parts.push("", "Lesson context:", req.lessonContext);
  if (req.compactSummary?.trim()) {
    parts.push("", "Compacted earlier chat:", req.compactSummary.trim());
  }
  return parts.join("\n");
}

function compactTextForLocalChat(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head;
  return [
    trimmed.slice(0, head).trimEnd(),
    "\n\n[Earlier lesson context compacted for local chat latency.]\n\n",
    trimmed.slice(-tail).trimStart(),
  ].join("");
}

function compactLessonChatForLocal(req: LessonChatRequest): LessonChatRequest {
  return {
    ...req,
    lessonContext: compactTextForLocalChat(req.lessonContext, LOCAL_CHAT_CONTEXT_CHAR_LIMIT),
    compactSummary: req.compactSummary
      ? compactTextForLocalChat(req.compactSummary, LOCAL_CHAT_SUMMARY_CHAR_LIMIT)
      : null,
    messages: req.messages.slice(-LOCAL_CHAT_MESSAGE_LIMIT).map((message) => ({
      ...message,
      content: compactTextForLocalChat(message.content, LOCAL_CHAT_MESSAGE_CHAR_LIMIT),
    })),
  };
}

function buildSummaryPrompt(previousSummary: string | null, messages: LessonChatMessage[]): string {
  const lines = [
    previousSummary?.trim()
      ? `Previous running summary:\n${previousSummary.trim()}`
      : "Previous running summary: none",
    "",
    "New messages to compact:",
    ...messages.map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`),
  ];
  return lines.join("\n");
}

function buildCodeFeedbackPrompt(req: CodeFeedbackRequest): string {
  const publicLines = req.publicTestResults.length
    ? req.publicTestResults.map((t) => `- ${t.id}: ${t.status.toUpperCase()} — ${t.description}`).join("\n")
    : "(no public tests)";
  const hiddenLine = req.hiddenTestSummary
    ? `${req.hiddenTestSummary.passed}/${req.hiddenTestSummary.total} hidden tests passed. Hidden assertions are not visible.`
    : "No hidden tests.";
  return [
    `Lesson: ${req.lessonTitle}`,
    req.lessonDescription ? `Lesson context: ${req.lessonDescription}` : null,
    `Exercise: ${req.exerciseTitle}`,
    `Exercise prompt: ${req.exercisePrompt}`,
    req.starterCode ? `Starter code:\n${req.starterCode}` : null,
    `Learner code:\n${req.learnerCode}`,
    `Interpreter output:\n${req.interpreterOutput || "(no output)"}`,
    `Public test results:\n${publicLines}`,
    `Hidden test summary: ${hiddenLine}`,
    `Overall status: ${req.allPassed ? "all tests passed" : "some tests failed"}`,
  ].filter((line): line is string => Boolean(line)).join("\n\n");
}

function parsePhaseDecision(raw: string): PhaseDecision {
  const text = raw.trim();
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Phase evaluator returned malformed JSON: ${text.slice(0, 200)}`);
  }
  const obj = parsed as Record<string, unknown>;
  const levels = ["familiarity", "competence", "mastery", "post_mastery"] as const;
  const currentLevel = levels.includes(obj.current_level as PhaseDecision["current_level"])
    ? (obj.current_level as PhaseDecision["current_level"])
    : null;
  const recommendedLevel = levels.includes(obj.recommended_level as PhaseDecision["recommended_level"])
    ? (obj.recommended_level as PhaseDecision["recommended_level"])
    : null;
  if (!currentLevel || !recommendedLevel) {
    throw new Error(`Phase evaluator returned invalid levels: ${text.slice(0, 200)}`);
  }
  return {
    current_level: currentLevel,
    recommended_level: recommendedLevel,
    should_change_level: obj.should_change_level === true,
    confidence:
      typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
        ? Math.max(0, Math.min(1, obj.confidence))
        : 0,
    reason:
      typeof obj.reason === "string" && obj.reason.trim()
        ? stripTrailingMeta(obj.reason).slice(0, 500)
        : "AI phase evaluator did not provide a reason.",
    missing_evidence: Array.isArray(obj.missing_evidence)
      ? obj.missing_evidence
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 240))
          .slice(0, 8)
      : [],
    next_lesson_directive:
      typeof obj.next_lesson_directive === "string" && obj.next_lesson_directive.trim()
        ? stripTrailingMeta(obj.next_lesson_directive).slice(0, 700)
        : "Plan the next lesson from the learner's unresolved evidence.",
  };
}

export function parseAnswerJudgment(raw: string): AnswerJudgment {
  const text = raw.trim();
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      verdict: "unclear",
      confidence: 0,
      feedback: stripTrailingMeta(text).slice(0, 500) || "Judgment output was malformed.",
    };
  }
  const obj = parsed as Record<string, unknown>;
  const verdict = typeof obj.verdict === "string" && ["correct", "partially_correct", "incorrect", "unclear"].includes(obj.verdict)
    ? obj.verdict as AnswerJudgment["verdict"]
    : "unclear";
  const confidence = typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
    ? Math.max(0, Math.min(1, obj.confidence))
    : 0;
  const feedback = typeof obj.feedback === "string" && obj.feedback.trim()
    ? stripTrailingMeta(obj.feedback).slice(0, 500)
    : "Judgment did not include feedback.";
  return { verdict, confidence, feedback };
}

function needsActionableHint(verdict: AnswerJudgment["verdict"], feedback: string): boolean {
  if (!feedback.trim()) return true;
  if (!["unclear", "incorrect", "partially_correct"].includes(verdict)) return false;
  return /\b(could not judge|can't judge|cannot judge|not judge|unclear|add (one )?concrete detail|more detail|too vague|malformed|did not include feedback)\b/i.test(feedback)
    && !/\bmissing|hint|mention|explain|connect|because|for example\b/i.test(feedback);
}

function buildJudgeRepairPrompt(req: AnswerJudgeRequest, firstJudgment: AnswerJudgment): string {
  return [
    buildJudgePrompt(req),
    "",
    `Previous verdict: ${firstJudgment.verdict}`,
    `Previous confidence: ${firstJudgment.confidence}`,
    `Previous feedback: ${firstJudgment.feedback}`,
    "",
    "Repair task: return a better JSON judgment whose feedback names the missing lesson-specific detail and gives one concrete hint.",
  ].join("\n");
}

/** Strip trailing meta-commentary that leaked past the student-facing feedback. */
function stripTrailingMeta(text: string): string {
  // Split into paragraphs, drop any that look like internal analysis
  const paragraphs = text.split(/\n\n+/);
  const clean = paragraphs.filter((p) => {
    const t = p.trim();
    if (!t) return false;
    // Drop lines that are clearly meta-commentary
    if (/^(The student|My feedback|Wait,|Let me|I should|Actually,|One more|Para \d|Bold:|Total:|Constraint)/i.test(t)) return false;
    if (/^\*[^*]+\*$/.test(t)) return false;
    return true;
  });
  let result = clean.join("\n\n").trim();
  // Strip wrapping quotes
  if (result.startsWith('"') && result.endsWith('"')) {
    result = result.slice(1, -1).trim();
  }
  return result;
}

/**
 * When the model ran out of content tokens and only produced reasoning_content,
 * extract the final polished paragraphs from the thinking dump.
 */
function extractFromThinking(thinking: string): string {
  // The model typically produces several drafts, ending with a final version.
  // Look for the last block of clean prose (no * prefixes, no "Check" markers).
  const lines = thinking.split("\n");
  const cleanParagraphs: string[] = [];
  let currentPara = "";

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip thinking markers
    if (
      trimmed.startsWith("*") ||
      trimmed.includes("Check") ||
      trimmed.includes("Constraint") ||
      trimmed.includes("sentence count") ||
      trimmed.includes("sentence)") ||
      trimmed.includes("sentences)") ||
      trimmed.startsWith("(") ||
      trimmed === ""
    ) {
      if (currentPara.trim()) {
        cleanParagraphs.push(currentPara.trim());
        currentPara = "";
      }
      continue;
    }
    currentPara += (currentPara ? " " : "") + trimmed;
  }
  if (currentPara.trim()) cleanParagraphs.push(currentPara.trim());

  // Take the last 2 substantial paragraphs (the final draft)
  const substantial = cleanParagraphs.filter((p) => p.length > 40);
  if (substantial.length >= 2) {
    return substantial.slice(-2).join("\n\n");
  }
  if (substantial.length === 1) {
    return substantial[0];
  }
  // Last resort: return last 500 chars cleaned up
  return thinking.slice(-500).replace(/^\s*\*\s*/gm, "").trim();
}

async function callOpenAICompatible(config: FeedbackConfig, req: FeedbackRequest): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: FEEDBACK_SYSTEM },
        { role: "user", content: buildUserPrompt(req) },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  const msg = data.choices?.[0]?.message;
  // Thinking models put reasoning in reasoning_content, final answer in content.
  // With enough tokens, content is clean. If content is empty (token budget ran
  // out during thinking), extract from reasoning_content.
  let content = msg?.content?.trim();
  if (content) {
    // Strip any trailing meta-commentary the model leaked after the feedback.
    // These lines typically start with "The student" or contain analysis markers.
    content = stripTrailingMeta(content);
    return content;
  }

  const reasoning = msg?.reasoning_content?.trim();
  if (!reasoning) return "(no feedback generated)";
  return extractFromThinking(reasoning);
}

async function callOpenAICompatibleJudge(
  config: FeedbackConfig,
  req: AnswerJudgeRequest,
  system = JUDGE_SYSTEM,
  userPrompt = buildJudgePrompt(req)
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 512,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM judge API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim()
    ?? data.choices?.[0]?.message?.reasoning_content?.trim()
    ?? "";
}

async function callAnthropic(config: FeedbackConfig, req: FeedbackRequest): Promise<string> {
  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system: FEEDBACK_SYSTEM,
      messages: [{ role: "user", content: buildUserPrompt(req) }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text?.trim() ?? "(no feedback generated)";
}

async function callAnthropicJudge(
  config: FeedbackConfig,
  req: AnswerJudgeRequest,
  system = JUDGE_SYSTEM,
  userPrompt = buildJudgePrompt(req)
): Promise<string> {
  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic judge API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text?.trim() ?? "";
}

async function callGoogle(config: FeedbackConfig, req: FeedbackRequest): Promise<string> {
  const data = await fetchGoogleGenerateContent(
    config,
    {
      systemInstruction: { parts: [{ text: FEEDBACK_SYSTEM }] },
      contents: [{ parts: [{ text: buildUserPrompt(req) }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    },
    "Google API error"
  );
  return extractGoogleText(data)?.trim() ?? "(no feedback generated)";
}

async function callGoogleJudge(
  config: FeedbackConfig,
  req: AnswerJudgeRequest,
  system = JUDGE_SYSTEM,
  userPrompt = buildJudgePrompt(req)
): Promise<string> {
  const data = await fetchGoogleGenerateContent(
    config,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.1, responseMimeType: "application/json" },
    },
    "Google judge API error"
  );
  return extractGoogleText(data)?.trim() ?? "";
}

async function callOpenAICompatibleChat(
  config: FeedbackConfig,
  system: string,
  messages: LessonChatMessage[],
  maxTokens = 1024,
  temperature = 0.4
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const isLocal = config.provider === "local";
  const effectiveMaxTokens = isLocal ? Math.min(maxTokens, LOCAL_LESSON_CHAT_MAX_TOKENS) : maxTokens;
  const extraBody = isLocal
    ? {
      budget_tokens: 0,
      chat_template_kwargs: { enable_thinking: false },
    }
    : {};
  const timeoutMs = isLocal ? 15000 : 60000;

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: effectiveMaxTokens,
      temperature,
      ...extraBody,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM chat API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  const msg = data.choices?.[0]?.message;
  const content = msg?.content?.trim();
  if (content) return stripTrailingMeta(content);
  const reasoning = msg?.reasoning_content?.trim();
  return reasoning ? extractFromThinking(reasoning) : "";
}

async function callAnthropicChat(
  config: FeedbackConfig,
  system: string,
  messages: LessonChatMessage[],
  maxTokens = 1024,
  temperature = 0.4
): Promise<string> {
  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic chat API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text?.trim() ?? "";
}

async function callGoogleChat(
  config: FeedbackConfig,
  system: string,
  messages: LessonChatMessage[],
  maxTokens = 1024,
  temperature = 0.4
): Promise<string> {
  const data = await fetchGoogleGenerateContent(
    config,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    },
    "Google chat API error",
    60000
  );
  return extractGoogleText(data)?.trim() ?? "";
}

async function callOpenAICompatiblePhaseDecision(
  config: FeedbackConfig,
  req: PhaseDecisionRequest
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const isLocal = config.provider === "local";
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: PHASE_DECISION_SYSTEM },
        { role: "user", content: req.evidencePacket },
      ],
      max_tokens: isLocal ? 700 : 1200,
      temperature: 0.1,
      response_format: { type: "json_object" },
      ...(isLocal ? { budget_tokens: 0, chat_template_kwargs: { enable_thinking: false } } : {}),
    }),
    signal: AbortSignal.timeout(isLocal ? 30000 : 60000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM phase evaluator API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim()
    ?? data.choices?.[0]?.message?.reasoning_content?.trim()
    ?? "";
}

async function callAnthropicPhaseDecision(
  config: FeedbackConfig,
  req: PhaseDecisionRequest
): Promise<string> {
  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1200,
      temperature: 0.1,
      system: PHASE_DECISION_SYSTEM,
      messages: [{ role: "user", content: req.evidencePacket }],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic phase evaluator API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text?.trim() ?? "";
}

async function callGooglePhaseDecision(
  config: FeedbackConfig,
  req: PhaseDecisionRequest
): Promise<string> {
  const data = await fetchGoogleGenerateContent(
    config,
    {
      systemInstruction: { parts: [{ text: PHASE_DECISION_SYSTEM }] },
      contents: [{ parts: [{ text: req.evidencePacket }] }],
      generationConfig: { maxOutputTokens: 1200, temperature: 0.1, responseMimeType: "application/json" },
    },
    "Google phase evaluator API error",
    60000
  );
  return extractGoogleText(data)?.trim() ?? "";
}

interface GoogleGenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
}

function extractGoogleText(data: GoogleGenerateContentResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.find((part) => part.text && !part.thought)?.text ?? parts.find((part) => part.text)?.text ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientGoogleStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function fetchGoogleGenerateContent(
  config: FeedbackConfig,
  body: unknown,
  label: string,
  timeoutMs = 30000
): Promise<GoogleGenerateContentResponse> {
  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent`;
  let lastText = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": config.apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return (await res.json()) as GoogleGenerateContentResponse;
    lastStatus = res.status;
    lastText = await res.text().catch(() => "");
    if (!isTransientGoogleStatus(res.status) || attempt === 2) break;
    await sleep(1000 * (attempt + 1));
  }
  throw new Error(`${label} ${lastStatus}: ${lastText.slice(0, 200)}`);
}

export async function getAnswerFeedback(config: FeedbackConfig, req: FeedbackRequest): Promise<string> {
  switch (config.provider) {
    case "local":
    case "openai":
      return callOpenAICompatible(config, req);
    case "anthropic":
      return callAnthropic(config, req);
    case "google":
      return callGoogle(config, req);
    default:
      throw new Error(`Unknown feedback provider: ${config.provider}`);
  }
}

async function callLessonChatRaw(
  config: FeedbackConfig,
  system: string,
  messages: LessonChatMessage[],
  maxTokens = 1024,
  temperature = 0.4
): Promise<string> {
  switch (config.provider) {
    case "local":
    case "openai":
      return callOpenAICompatibleChat(config, system, messages, maxTokens, temperature);
    case "anthropic":
      return callAnthropicChat(config, system, messages, maxTokens, temperature);
    case "google":
      return callGoogleChat(config, system, messages, maxTokens, temperature);
    default:
      throw new Error(`Unknown feedback provider: ${config.provider}`);
  }
}

export async function getLessonChatReply(config: FeedbackConfig, req: LessonChatRequest): Promise<string> {
  const chatReq = config.provider === "local" ? compactLessonChatForLocal(req) : req;
  const system = buildLessonChatSystem(chatReq);
  const answer = await callLessonChatRaw(
    config,
    system,
    chatReq.messages,
    config.provider === "local" ? LOCAL_LESSON_CHAT_MAX_TOKENS : 1200,
    0.35
  );
  return answer.trim() || "I could not generate a reply for that question.";
}

export async function summarizeLessonChat(
  config: FeedbackConfig,
  previousSummary: string | null,
  messages: LessonChatMessage[]
): Promise<string> {
  if (messages.length === 0) return previousSummary?.trim() ?? "";
  const summary = await callLessonChatRaw(
    config,
    LESSON_CHAT_SUMMARY_SYSTEM,
    [{ role: "user", content: buildSummaryPrompt(previousSummary, messages) }],
    700,
    0.1
  );
  return summary.trim().slice(0, 4000);
}

export async function getCodeFeedback(config: FeedbackConfig, req: CodeFeedbackRequest): Promise<string> {
  const feedback = await callLessonChatRaw(
    config,
    CODE_FEEDBACK_SYSTEM,
    [{ role: "user", content: buildCodeFeedbackPrompt(req) }],
    700,
    0.25
  );
  return feedback.trim() || "I could not generate code feedback for this submission.";
}

export async function getPhaseDecision(config: FeedbackConfig, req: PhaseDecisionRequest): Promise<PhaseDecision> {
  let raw = "";
  switch (config.provider) {
    case "local":
    case "openai":
      raw = await callOpenAICompatiblePhaseDecision(config, req);
      break;
    case "anthropic":
      raw = await callAnthropicPhaseDecision(config, req);
      break;
    case "google":
      raw = await callGooglePhaseDecision(config, req);
      break;
    default:
      throw new Error(`Unknown feedback provider: ${config.provider}`);
  }
  return parsePhaseDecision(raw);
}

async function callJudgeRaw(
  config: FeedbackConfig,
  req: AnswerJudgeRequest,
  system = JUDGE_SYSTEM,
  userPrompt = buildJudgePrompt(req)
): Promise<string> {
  switch (config.provider) {
    case "local":
    case "openai":
      return callOpenAICompatibleJudge(config, req, system, userPrompt);
    case "anthropic":
      return callAnthropicJudge(config, req, system, userPrompt);
    case "google":
      return callGoogleJudge(config, req, system, userPrompt);
    default:
      throw new Error(`Unknown feedback provider: ${config.provider}`);
  }
}

export async function getAnswerJudgment(config: FeedbackConfig, req: AnswerJudgeRequest): Promise<AnswerJudgment> {
  const first = parseAnswerJudgment(await callJudgeRaw(config, req));
  if (!needsActionableHint(first.verdict, first.feedback)) return first;

  const repaired = parseAnswerJudgment(
    await callJudgeRaw(config, req, JUDGE_REPAIR_SYSTEM, buildJudgeRepairPrompt(req, first))
  );
  if (needsActionableHint(repaired.verdict, repaired.feedback)) {
    throw new Error(`Answer judge returned non-actionable feedback after repair: ${repaired.feedback.slice(0, 160)}`);
  }
  return repaired;
}
