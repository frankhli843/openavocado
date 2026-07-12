import { NextResponse } from "next/server";
import { getAnswerJudgment, loadFeedbackConfig } from "@/lib/feedback-llm";

/**
 * POST /api/answer-judge
 *
 * LLM semantic grading for freeform, fill-blank, ordering, matching, and
 * classification answers. The judge receives both the learner answer and the
 * hidden actual answer, then grades by meaning in lesson context rather than
 * exact string matching.
 */
export async function POST(request: Request) {
  try {
    const config = loadFeedbackConfig();
    if (!config.enabled) {
      return NextResponse.json({ enabled: false, judgment: null });
    }

    const body = (await request.json()) as {
      lesson_title?: string;
      lesson_description?: string | null;
      question_type?: string;
      question_text?: string;
      question_hint?: string | null;
      learner_answer?: string;
      actual_answer?: string;
      rubric?: string | null;
      accepted_answers?: string[];
      support_ref?: string | null;
    };

    if (!body.question_text?.trim() || !body.learner_answer?.trim() || !body.actual_answer?.trim()) {
      return NextResponse.json(
        { error: "question_text, learner_answer, and actual_answer are required" },
        { status: 400 }
      );
    }

    const judgment = await getAnswerJudgment(config, {
      lessonTitle: body.lesson_title ?? "Untitled Lesson",
      lessonDescription: body.lesson_description ?? null,
      questionType: body.question_type ?? "free_text",
      questionText: body.question_text,
      questionHint: body.question_hint ?? null,
      learnerAnswer: body.learner_answer,
      actualAnswer: body.actual_answer,
      rubric: body.rubric ?? null,
      acceptedAnswers: Array.isArray(body.accepted_answers) ? body.accepted_answers : [],
      supportRef: body.support_ref ?? null,
    });

    return NextResponse.json({ enabled: true, judgment });
  } catch (err) {
    console.error("[api/answer-judge]", err);
    return NextResponse.json(
      {
        enabled: true,
        judgment: null,
        error: "Judgment generation failed",
      },
      { status: 503 }
    );
  }
}

/** GET /api/answer-judge: check if semantic judging is enabled. */
export async function GET() {
  const config = loadFeedbackConfig();
  return NextResponse.json({ enabled: config.enabled, provider: config.enabled ? config.provider : null });
}
