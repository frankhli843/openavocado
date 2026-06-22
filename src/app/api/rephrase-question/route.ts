import { NextResponse } from "next/server";
import type { MultipleChoiceQuestion } from "@/lib/lesson-content/schema";
import { makeFallbackRetry, validateRetryQuestion } from "@/lib/quiz-state";

interface RephraseRequestBody {
  retry_id: string;
  origin_question_id: string;
  original: Pick<MultipleChoiceQuestion, "question" | "choices" | "correct_index" | "explanation" | "concept" | "misconception_target" | "rephrase_instructions">;
}

/**
 * POST /api/rephrase-question
 *
 * Rephrases a missed multiple-choice question for a retry.
 * If AVOCADOCORE_ACP_ENDPOINT is configured, calls the LLM API and validates
 * the result. Falls back to the deterministic shuffler on any failure.
 *
 * Response: { ok: boolean; retry: RetryQuestion; source: "acp"|"fallback" }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RephraseRequestBody;
    const { retry_id, origin_question_id, original } = body;

    if (!retry_id || !origin_question_id || !original?.question) {
      return NextResponse.json({ ok: false, error: "missing required fields" }, { status: 400 });
    }

    const endpoint = process.env.AVOCADOCORE_ACP_ENDPOINT;
    const token = process.env.AVOCADOCORE_ACP_TOKEN;

    if (endpoint) {
      try {
        const acpResult = await callAcpEndpoint(endpoint, token, retry_id, original);
        if (acpResult) {
          const validation = validateRetryQuestion(acpResult);
          if (validation.valid) {
            return NextResponse.json({
              ok: true,
              retry: { ...acpResult, retry_id, origin_question_id, source: "acp" },
              source: "acp",
            });
          }
          console.warn("[rephrase-question] ACP output failed validation:", validation.errors);
        }
      } catch (err) {
        console.warn("[rephrase-question] ACP call failed:", err);
      }
    }

    // Deterministic fallback — always works, no model required.
    const fallback = makeFallbackRetry(retry_id, origin_question_id, original);
    return NextResponse.json({ ok: true, retry: fallback, source: "fallback" });
  } catch (err) {
    console.error("[rephrase-question] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}

/**
 * Call the configured ACP/LLM endpoint to rephrase the question.
 * Expects an OpenAI-compatible chat completions API.
 * Returns the parsed retry object or null on any failure.
 */
async function callAcpEndpoint(
  endpoint: string,
  token: string | undefined,
  retry_id: string,
  original: RephraseRequestBody["original"]
): Promise<Partial<import("@/lib/quiz-state").RetryQuestion> | null> {
  const prompt = buildRephrasePrompt(original);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: process.env.AVOCADOCORE_ACP_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 600,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  const parsed = JSON.parse(raw) as Partial<import("@/lib/quiz-state").RetryQuestion>;
  return parsed;
}

function buildRephrasePrompt(
  original: RephraseRequestBody["original"]
): string {
  const correct_text = original.choices[original.correct_index];
  const instructions = original.rephrase_instructions
    ? `\nAuthoring instructions: ${original.rephrase_instructions}`
    : "";
  const misconception = original.misconception_target
    ? `\nTarget misconception to test: ${original.misconception_target}`
    : "";

  return `You are rephrasing a multiple-choice question for a learner who answered it incorrectly.

Concept: ${original.concept}${misconception}${instructions}

Original question: ${original.question}
Original choices: ${original.choices.map((c, i) => `${i + 1}. ${c}`).join("\n")}
Correct answer: "${correct_text}"
Explanation: ${original.explanation}

Generate a rephrased version covering the SAME learning objective.
RULES:
- Change the wording of both the question and all choices.
- Do NOT use the same phrasing as the original question.
- Do NOT reveal the correct answer in the question text.
- Keep exactly the same number of choices (${original.choices.length}).
- Preserve the same correct answer concept.
- Keep the explanation substantive.

Return ONLY a valid JSON object with this shape:
{
  "question": "...",
  "choices": ["A", "B", "C", "D"],
  "correct_index": 0,
  "explanation": "..."
}
No markdown, no extra keys.`;
}
