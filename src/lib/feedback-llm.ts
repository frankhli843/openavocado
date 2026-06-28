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
  google: "gemini-2.5-flash",
};

const DEFAULT_BASE_URLS: Record<FeedbackProvider, string> = {
  local: "http://127.0.0.1:8080/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
};

export function loadFeedbackConfig(): FeedbackConfig {
  const provider = (process.env.AVOCADOCORE_FEEDBACK_PROVIDER ?? "").trim().toLowerCase();
  if (!provider || !["local", "openai", "anthropic", "google"].includes(provider)) {
    return { enabled: false, provider: "local", baseUrl: "", apiKey: "", model: "" };
  }
  const p = provider as FeedbackProvider;
  return {
    enabled: true,
    provider: p,
    baseUrl: (process.env.AVOCADOCORE_FEEDBACK_BASE_URL ?? DEFAULT_BASE_URLS[p]).replace(/\/+$/, ""),
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

const LESSON_CHAT_SYSTEM = `You are an in-lesson tutor for AvocadoCore.

Answer the learner's quick question using the current lesson context and prior chat.
Rules:
- Keep answers concise by default: 1-4 short paragraphs.
- Explain just enough to unblock the learner, then stop.
- Prefer the lesson's wording and examples when available.
- If the learner asks for a hint, give a hint, not the full answer.
- If the learner asks for code, show the smallest useful snippet and explain the key idea.
- Do not claim to remember anything outside the supplied lesson/chat context.
- Do not mark lesson progress or say a lesson is complete.`;

const LESSON_CHAT_SUMMARY_SYSTEM = `Compact an AvocadoCore lesson chat.

Return a concise running summary that preserves:
- The learner's actual questions.
- Tutor explanations already given.
- Misconceptions, confusions, and examples that should matter later.
- Any unresolved follow-up.

Do not include filler, timestamps, or generic encouragement.`;

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
  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: FEEDBACK_SYSTEM }] },
      contents: [{ parts: [{ text: buildUserPrompt(req) }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "(no feedback generated)";
}

async function callGoogleJudge(
  config: FeedbackConfig,
  req: AnswerJudgeRequest,
  system = JUDGE_SYSTEM,
  userPrompt = buildJudgePrompt(req)
): Promise<string> {
  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.1, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google judge API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
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

  // For local llama.cpp with --reasoning on, cap per-request thinking budget.
  // budget_tokens: 4096 at 14ms/tok ≈ 57s; 256 caps thinking at ~3.5s while
  // still giving the model enough context to produce correct, coherent answers.
  const extraBody = config.provider === "local" ? { budget_tokens: 256 } : {};
  const timeoutMs = config.provider === "local" ? 120000 : 60000;

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: maxTokens,
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
  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google chat API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
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
  const system = buildLessonChatSystem(req);
  const answer = await callLessonChatRaw(config, system, req.messages, 1200, 0.35);
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
