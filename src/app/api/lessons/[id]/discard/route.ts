import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import type {
  Lesson,
  Subject,
  LessonDiscardedEvent,
  MasterySignal,
} from "@/types";
import { getRegenerationAdapter } from "@/lib/adapters";
import { computeSubjectMastery } from "@/lib/mastery";

/**
 * POST /api/lessons/:id/discard
 *
 * Soft-deletes an incomplete lesson and triggers replacement-lesson generation.
 *
 * Guard: only lessons with status queued or in_progress may be discarded.
 * Completed lessons are part of learning history and cannot be discarded here.
 *
 * Body:
 *   learner_id   number   (required — scopes the operation)
 *   reason       string   (optional — passed to the lesson generator)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const lessonId = Number(id);

    const body = (await request.json()) as {
      learner_id?: number;
      reason?: string;
    };
    const learnerId = Number(body.learner_id || 1);
    const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;

    // Load the lesson
    const lesson = db
      .prepare("SELECT * FROM lessons WHERE id = ?")
      .get(lessonId) as Lesson | undefined;

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Guard: only incomplete (queued / in_progress) lessons may be discarded
    if (lesson.status === "completed") {
      return NextResponse.json(
        {
          error:
            "Completed lessons cannot be discarded. They are part of learning history. " +
            "Only queued or in-progress lessons can be discarded.",
        },
        { status: 409 }
      );
    }
    if (lesson.status === "discarded") {
      return NextResponse.json(
        { error: "This lesson has already been discarded." },
        { status: 409 }
      );
    }
    if (lesson.status === "skipped") {
      return NextResponse.json(
        { error: "Skipped lessons cannot be discarded through this flow." },
        { status: 409 }
      );
    }

    // Load subject (scoped check)
    const subject = db
      .prepare("SELECT * FROM subjects WHERE id = ?")
      .get(lesson.subject_id) as Subject | undefined;

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    if (subject.learner_id !== learnerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft-delete: mark as discarded
    const discardedAt = new Date().toISOString();
    db.prepare(
      `UPDATE lessons
         SET status = 'discarded', discarded_at = ?, discard_reason = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(discardedAt, reason, lessonId);

    // Build regeneration event payload
    const mastery = computeSubjectMastery(db, subject.id, learnerId);

    const completedLessons = db
      .prepare(
        `SELECT title, completed_at FROM lessons
         WHERE subject_id = ? AND status = 'completed'
         ORDER BY completed_at DESC`
      )
      .all(subject.id) as Array<{ title: string; completed_at: string }>;

    const masterySignals = db
      .prepare(
        `SELECT signal_type, concept, detail FROM mastery_signals
         WHERE subject_id = ? AND learner_id = ?
         ORDER BY created_at DESC LIMIT 20`
      )
      .all(subject.id, learnerId) as Array<Pick<MasterySignal, "signal_type" | "concept" | "detail">>;

    // Load current workpad summary if it exists
    const workpadRow = db
      .prepare(
        "SELECT content FROM subject_workpads WHERE subject_id = ? AND learner_id = ?"
      )
      .get(subject.id, learnerId) as { content: string } | undefined;
    const workpadSummary = workpadRow?.content
      ? workpadRow.content.slice(0, 800) + (workpadRow.content.length > 800 ? "\n...(truncated)" : "")
      : null;

    const event: LessonDiscardedEvent = {
      event: "lesson.discarded",
      learner_id: learnerId,
      subject_id: subject.id,
      subject_title: subject.title,
      subject_description: subject.description,
      subject_goals: subject.goals,
      subject_criteria: subject.criteria,
      discarded_lesson_id: lessonId,
      discarded_lesson_title: lesson.title,
      discarded_lesson_status: lesson.status,
      discard_reason: reason,
      mastery_score: mastery.score,
      completed_lessons: completedLessons,
      mastery_signals: masterySignals,
      workpad_summary: workpadSummary,
      discarded_at: discardedAt,
    };

    // Dispatch the regeneration adapter
    const adapter = getRegenerationAdapter();
    const adapterResult = await adapter.dispatch(event);

    // Record a next_lesson_job entry for this regeneration request
    const jobResult = db
      .prepare(
        `INSERT INTO next_lesson_jobs
           (subject_id, discarded_lesson_id, trigger_event, adapter, status, payload,
            adapter_ref, error, dispatched_at)
         VALUES (?, ?, 'lesson.discarded', ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        subject.id,
        lessonId,
        adapter.name,
        adapterResult.ok ? "dispatched" : "failed",
        JSON.stringify(event),
        adapterResult.ref || null,
        adapterResult.error || null
      );

    const discardedLesson = db
      .prepare("SELECT * FROM lessons WHERE id = ?")
      .get(lessonId) as Lesson;

    return NextResponse.json({
      lesson: discardedLesson,
      regeneration_job: {
        id: jobResult.lastInsertRowid,
        trigger_event: "lesson.discarded",
        adapter: adapter.name,
        status: adapterResult.ok ? "dispatched" : "failed",
        ref: adapterResult.ref || null,
        error: adapterResult.error || null,
      },
    });
  } catch (err) {
    console.error("[api/lessons/:id/discard]", err);
    return NextResponse.json({ error: "Failed to discard lesson" }, { status: 500 });
  }
}
