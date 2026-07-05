import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { getAssessmentAdapter } from "@/lib/assessment";
import { loadReusableTags, persistAssessment } from "@/lib/assessment-store";
import { recordLearningEvidence } from "@/lib/learning-evidence";
import type { Difficulty } from "@/types";

/**
 * POST /api/assess
 *
 * Assess a single answer (multiple-choice attempt, freeform answer, or
 * end-of-lesson diagnostic) against the subject's tag vocabulary, then persist
 * the evidence: an assessment_results row, matched + newly created tags, and a
 * mastery signal carrying difficulty + the resolved tag.
 *
 * This does NOT complete a lesson — it only records evidence. Tagging or
 * persistence failures return an error response (observable), never a silent OK.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      learner_id?: number;
      subject_id?: number;
      lesson_id?: number | null;
      activity_id?: number | null;
      question_id?: string;
      question_text?: string;
      question_type?: "mc" | "freeform" | "diagnostic";
      concept?: string | null;
      difficulty?: Difficulty | null;
      mc_outcome?: "correct" | "incorrect" | "idk";
      answer_text?: string | null;
      feedback_text?: string | null;
    };

    const learner_id = Number(body.learner_id);
    const subject_id = Number(body.subject_id);
    const question_id = (body.question_id || "").trim();
    const question_type = body.question_type;

    if (!learner_id || !subject_id || !question_id || !question_type) {
      return NextResponse.json(
        { error: "learner_id, subject_id, question_id, and question_type are required" },
        { status: 400 }
      );
    }
    if (!["mc", "freeform", "diagnostic"].includes(question_type)) {
      return NextResponse.json(
        { error: "question_type must be 'mc', 'freeform', or 'diagnostic'" },
        { status: 400 }
      );
    }
    if (question_type === "mc" && !body.mc_outcome) {
      return NextResponse.json(
        { error: "mc_outcome ('correct'|'incorrect'|'idk') is required for multiple-choice assessment" },
        { status: 400 }
      );
    }
    if (body.difficulty && !["easy", "medium", "hard"].includes(body.difficulty)) {
      return NextResponse.json(
        { error: "difficulty must be 'easy', 'medium', or 'hard'" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Scope check: subject must belong to the learner so one profile's evidence
    // cannot be written against another profile's subject.
    const subject = db
      .prepare("SELECT id FROM subjects WHERE id = ? AND learner_id = ?")
      .get(subject_id, learner_id) as { id: number } | undefined;
    if (!subject) {
      return NextResponse.json(
        { error: "subject not found for this learner" },
        { status: 404 }
      );
    }

    // Match against the cross-subject tag vocabulary (subject tags first, then
    // every other subject's tags) so semantically-matching concept labels are
    // reused across subjects instead of forking near-duplicate rows.
    const subjectTags = loadReusableTags(db, subject_id);
    const adapter = getAssessmentAdapter();

    const outcome = await adapter.assess({
      question_type,
      question_text: (body.question_text || question_id).trim(),
      concept: body.concept ?? null,
      difficulty: body.difficulty ?? null,
      mc_outcome: body.mc_outcome,
      answer_text: body.answer_text ?? null,
      subject_tags: subjectTags,
    });

    const persisted = persistAssessment(db, {
      learner_id,
      subject_id,
      lesson_id: body.lesson_id ?? null,
      activity_id: body.activity_id ?? null,
      question_id,
      question_type,
      concept: body.concept ?? null,
      difficulty: body.difficulty ?? null,
      answer_text: body.answer_text ?? null,
      outcome,
    });

    const sourceType =
      question_type === "diagnostic"
        ? "diagnostic_answer"
        : question_type === "freeform"
          ? "practice_answer"
          : "assessment_answer";
    const evidenceId = recordLearningEvidence(db, {
      learner_id,
      subject_id,
      lesson_id: body.lesson_id ?? null,
      activity_id: body.activity_id ?? null,
      source_type: sourceType,
      source_id: `assessment_results:${persisted.result_id}`,
      concept: body.concept ?? outcome.signal.concept ?? null,
      difficulty: body.difficulty ?? outcome.signal.difficulty ?? null,
      outcome: outcome.outcome,
      prompt: (body.question_text || question_id).trim(),
      learner_input: body.answer_text ?? null,
      system_response: body.feedback_text ?? outcome.signal.detail ?? null,
      metadata: {
        question_id,
        question_type,
        assessment_result_id: persisted.result_id,
        mastery_signal_id: persisted.signal_id,
        signal_type: outcome.signal.signal_type,
        tags: outcome.tags,
      },
    });

    return NextResponse.json({
      ok: true,
      assessor: adapter.name,
      outcome: outcome.outcome,
      signal_type: outcome.signal.signal_type,
      tags: outcome.tags,
      result_id: persisted.result_id,
      signal_id: persisted.signal_id,
      evidence_id: evidenceId,
      created_tags: persisted.created_tag_names,
    });
  } catch (err) {
    console.error("[api/assess]", err);
    return NextResponse.json({ error: "Failed to assess answer" }, { status: 500 });
  }
}
