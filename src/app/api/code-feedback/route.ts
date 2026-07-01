import { NextResponse } from "next/server";
import { getCodeFeedback, loadFeedbackConfig } from "@/lib/feedback-llm";

type PublicTestStatus = "pass" | "fail" | "not_run";

interface NormalizedPublicTestResult {
  id: string;
  description: string;
  status: PublicTestStatus;
}

function normalizePublicTestResults(value: unknown): NormalizedPublicTestResult[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 25).map((raw, index) => {
    const item = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `public-${index + 1}`;
    const statusText = typeof item.status === "string" ? item.status.trim().toLowerCase() : "";
    let status: PublicTestStatus = "not_run";
    if (statusText === "pass" || statusText === "passed") status = "pass";
    else if (statusText === "fail" || statusText === "failed") status = "fail";
    else if (statusText === "not_run" || statusText === "not run") status = "not_run";
    else if (typeof item.passed === "boolean") status = item.passed ? "pass" : "fail";

    const description =
      typeof item.description === "string" && item.description.trim()
        ? item.description.trim()
        : typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : typeof item.output === "string" && item.output.trim()
            ? item.output.trim()
            : id;
    return { id, description: description.slice(0, 500), status };
  });
}

/**
 * POST /api/code-feedback
 *
 * LLM feedback for a code submission. The prompt includes the learner's code,
 * exercise context, interpreter output, public test results, and hidden-test
 * pass count only. Hidden assertions are never sent or revealed.
 */
export async function POST(request: Request) {
  try {
    const config = loadFeedbackConfig();
    if (!config.enabled) {
      return NextResponse.json({ enabled: false, feedback: null });
    }

    const body = (await request.json()) as {
      lesson_title?: string;
      lesson_description?: string | null;
      exercise_title?: string;
      exercise_prompt?: string;
      starter_code?: string | null;
      learner_code?: string;
      interpreter_output?: string;
      public_test_results?: unknown;
      hidden_test_summary?: { total: number; passed: number } | null;
      all_passed?: boolean;
    };

    if (!body.exercise_prompt?.trim() || !body.learner_code?.trim()) {
      return NextResponse.json(
        { error: "exercise_prompt and learner_code are required" },
        { status: 400 }
      );
    }

    const feedback = await getCodeFeedback(config, {
      lessonTitle: body.lesson_title ?? "Untitled Lesson",
      lessonDescription: body.lesson_description ?? null,
      exerciseTitle: body.exercise_title ?? "Code exercise",
      exercisePrompt: body.exercise_prompt,
      starterCode: body.starter_code ?? null,
      learnerCode: body.learner_code,
      interpreterOutput: body.interpreter_output ?? "",
      publicTestResults: normalizePublicTestResults(body.public_test_results),
      hiddenTestSummary: body.hidden_test_summary ?? null,
      allPassed: body.all_passed === true,
    });

    return NextResponse.json({ enabled: true, feedback });
  } catch (err) {
    console.error("[api/code-feedback]", err);
    return NextResponse.json(
      { enabled: true, feedback: null, error: "Code feedback generation failed" },
      { status: 200 }
    );
  }
}

/** GET /api/code-feedback — check if code feedback is enabled. */
export async function GET() {
  const config = loadFeedbackConfig();
  return NextResponse.json({ enabled: config.enabled, provider: config.enabled ? config.provider : null });
}
