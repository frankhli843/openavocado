import { NextResponse } from "next/server";
import type { RetryQuestion } from "@/lib/quiz-state";
import type { MultipleChoiceQuestion } from "@/lib/lesson-content/schema";
import { callConfiguredLlmForJson } from "@/lib/providers/llm";
import { makeFallbackRetry, validateRetryQuestion } from "@/lib/quiz-state";

interface RephraseRequestBody {
  retry_id: string;
  origin_question_id: string;
  original: Pick<MultipleChoiceQuestion, "question" | "choices" | "correct_index" | "explanation" | "concept" | "misconception_target" | "rephrase_instructions">;
}

/**
 * POST /api/rephrase-question
 *
 * Rephrases a missed multiple-choice question for a retry. Uses the configured
 * provider abstraction, then falls back to the deterministic shuffler on any
 * missing provider, transport failure, or validation failure.
 *
 * Response: { ok: boolean; retry: RetryQuestion; source: "provider"|"fallback" }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RephraseRequestBody;
    const { retry_id, origin_question_id, original } = body;

    if (!retry_id || !origin_question_id || !original?.question) {
      return NextResponse.json({ ok: false, error: "missing required fields" }, { status: 400 });
    }

    try {
      const providerResult = await callConfiguredLlmForJson(buildRephrasePrompt(original));
      if (providerResult) {
        const retry = providerResult as Partial<RetryQuestion>;
        const validation = validateRetryQuestion(retry);
        if (validation.valid) {
          return NextResponse.json({
            ok: true,
            retry: { ...retry, retry_id, origin_question_id, source: "acp" },
            source: "provider",
          });
        }
        console.warn("[rephrase-question] Provider output failed validation:", validation.errors);
      }
    } catch (err) {
      console.warn("[rephrase-question] Provider call failed:", err);
    }

    const fallback = makeFallbackRetry(retry_id, origin_question_id, original);
    return NextResponse.json({ ok: true, retry: fallback, source: "fallback" });
  } catch (err) {
    console.error("[rephrase-question] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
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
