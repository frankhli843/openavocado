import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { getCompletionAdapter } from "@/lib/adapters";
import type { LessonCompletedEvent, SignalType } from "@/types";

/**
 * POST /api/complete-lesson
 *
 * Manual lesson completion endpoint.
 * This is the ONLY path to marking a lesson complete.
 * Autosave never triggers this. The learner must explicitly click Complete.
 *
 * On completion:
 * 1. Mark lesson as completed in DB
 * 2. Record a progress point for mastery/assessment
 * 3. Dispatch the configured completion adapter (creates next-lesson task)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lesson_id: number;
      learner_id: number;
      assessment_answers?: Record<string, string>;
      code_results?: {
        activity_title: string;
        code: string;
        test_results: Record<string, string>;
        run_output: string;
      }[];
    };

    const { lesson_id, learner_id, assessment_answers = {}, code_results = [] } = body;

    if (!lesson_id || !learner_id) {
      return NextResponse.json(
        { error: "lesson_id and learner_id are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Fetch lesson details
    const lesson = db
      .prepare(
        `SELECT l.*, s.title AS subject_title, s.id AS subject_id_val
         FROM lessons l JOIN subjects s ON s.id = l.subject_id
         WHERE l.id = ?`
      )
      .get(lesson_id) as {
        id: number;
        title: string;
        goals: string | null;
        subject_id: number;
        subject_title: string;
        status: string;
      } | undefined;

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (lesson.status === "completed") {
      return NextResponse.json({ ok: true, message: "Lesson already completed" });
    }

    // Fetch assessment questions
    const assessmentActivity = db
      .prepare(
        `SELECT * FROM lesson_activities
         WHERE lesson_id = ? AND activity_type = 'assessment'
         ORDER BY sequence_order ASC LIMIT 1`
      )
      .get(lesson_id) as { content: string | null } | undefined;

    const questions: Array<{ id: string; text: string }> = [];
    if (assessmentActivity?.content) {
      try {
        const parsed = JSON.parse(assessmentActivity.content) as { questions?: Array<{ id: string; text: string }> };
        if (Array.isArray(parsed.questions)) {
          questions.push(...parsed.questions);
        }
      } catch {
        // ignore parse error
      }
    }

    const assessment_qa = questions.map((q) => ({
      question: q.text,
      learner_answer: assessment_answers[q.id] || "(no answer)",
    }));

    // Fetch autosaved mastery signals for this lesson
    const mastery_signals = db
      .prepare(
        `SELECT signal_type, concept, detail FROM mastery_signals
         WHERE lesson_id = ? AND learner_id = ?`
      )
      .all(lesson_id, learner_id) as Array<{ signal_type: SignalType; concept: string; detail: string | null }>;

    const concepts_to_review = mastery_signals
      .filter((s) => s.signal_type === "review_needed" || s.signal_type === "weak_spot")
      .map((s) => s.concept);

    const concepts_ready = mastery_signals
      .filter((s) => s.signal_type === "ready_to_advance" || s.signal_type === "strength")
      .map((s) => s.concept);

    // Mark lesson completed
    db.prepare(
      `UPDATE lessons
       SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(lesson_id);

    // Record progress point
    const allPassed = code_results.every((r) =>
      Object.values(r.test_results).every((v) => v === "pass")
    );
    const testScore = code_results.length > 0 ? (allPassed ? 100 : 50) : null;

    if (testScore !== null) {
      db.prepare(
        `INSERT INTO progress_points (learner_id, subject_id, lesson_id, metric, value)
         VALUES (?, ?, ?, 'code_tests_passed', ?)`
      ).run(learner_id, lesson.subject_id, lesson_id, testScore);
    }

    // Build completion event
    const goals: string[] = lesson.goals ? JSON.parse(lesson.goals) : [];
    const event: LessonCompletedEvent = {
      event: "lesson.completed",
      learner_id,
      subject_id: lesson.subject_id,
      subject_title: lesson.subject_title,
      lesson_id,
      lesson_title: lesson.title,
      lesson_goals: goals,
      activities_completed: ["audio", "interactive", "practice_code", "assessment"],
      assessment_qa,
      code_attempts: code_results,
      mastery_signals,
      concepts_to_review,
      concepts_ready_to_advance: concepts_ready,
      completed_at: new Date().toISOString(),
    };

    // Dispatch completion adapter
    const adapter = getCompletionAdapter();
    const dispatchResult = await adapter.dispatch(event);

    // Record the next-lesson job
    db.prepare(
      `INSERT INTO next_lesson_jobs (subject_id, completed_lesson_id, adapter, status, payload, adapter_ref)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      lesson.subject_id,
      lesson_id,
      adapter.name,
      dispatchResult.ok ? "dispatched" : "failed",
      JSON.stringify(event),
      dispatchResult.ref ?? null
    );

    return NextResponse.json({
      ok: true,
      lesson_id,
      adapter: adapter.name,
      dispatch_ok: dispatchResult.ok,
      adapter_ref: dispatchResult.ref,
    });
  } catch (err) {
    console.error("[api/complete-lesson]", err);
    return NextResponse.json({ error: "Failed to complete lesson" }, { status: 500 });
  }
}
