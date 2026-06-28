import { NextResponse } from "next/server";
import { loadFeedbackConfig, getAnswerFeedback } from "@/lib/feedback-llm";

/**
 * POST /api/answer-feedback
 *
 * Async LLM feedback on a learner's answer. Returns constructive guidance
 * without giving away the full answer. Feature is off by default; enable
 * via AVOCADOCORE_FEEDBACK_PROVIDER env var.
 */
export async function POST(request: Request) {
  try {
    const config = loadFeedbackConfig();
    if (!config.enabled) {
      return NextResponse.json({ enabled: false, feedback: null });
    }

    const body = (await request.json()) as {
      lesson_title: string;
      lesson_description?: string | null;
      question_text: string;
      question_hint?: string | null;
      learner_answer: string;
    };

    if (!body.question_text || !body.learner_answer?.trim()) {
      return NextResponse.json({ error: "question_text and learner_answer are required" }, { status: 400 });
    }

    // Skip very short answers (likely still typing)
    if (body.learner_answer.trim().length < 20) {
      return NextResponse.json({ enabled: true, feedback: null, reason: "answer_too_short" });
    }

    const feedback = await getAnswerFeedback(config, {
      lessonTitle: body.lesson_title ?? "Untitled Lesson",
      lessonDescription: body.lesson_description ?? null,
      questionText: body.question_text,
      questionHint: body.question_hint ?? null,
      learnerAnswer: body.learner_answer,
    });

    return NextResponse.json({ enabled: true, feedback });
  } catch (err) {
    console.error("[api/answer-feedback]", err);
    return NextResponse.json(
      { enabled: true, feedback: null, error: "Feedback generation failed" },
      { status: 200 } // don't break the UI on feedback failure
    );
  }
}

/** GET /api/answer-feedback — check if feedback is enabled */
export async function GET() {
  const config = loadFeedbackConfig();
  return NextResponse.json({ enabled: config.enabled, provider: config.enabled ? config.provider : null });
}
