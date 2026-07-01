import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { seedDatabase } from "@/db/seed";
import { getSubjectCreatedDispatcher } from "@/lib/adapters";
import { computeSubjectMastery } from "@/lib/mastery";
import { getSessionUser } from "@/lib/auth/session";
import { reconcileMaterializedLessonJobs } from "@/lib/lesson-jobs/reconcile";
import type { LearnerProfile, NextLessonJob, Subject, SubjectCreatedEvent, SubjectSummary } from "@/types";

/** POST /api/subjects — create a new subject for a learner */
export async function POST(request: Request) {
  try {
    const db = getDb();
    const sessionUser = await getSessionUser();
    const body = (await request.json()) as Partial<Subject & { learner_id: number }>;

    // Use session learner when not explicitly provided to prevent cross-user writes.
    const learnerId = Number(body.learner_id || sessionUser?.active_learner_id || 1);
    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // Validate learner exists
    const learner = db.prepare("SELECT * FROM learner_profiles WHERE id = ?").get(learnerId) as
      | LearnerProfile
      | undefined;
    if (!learner) {
      return NextResponse.json({ error: "Learner not found" }, { status: 404 });
    }

    const description = typeof body.description === "string" ? body.description.trim() || null : null;
    const goals = typeof body.goals === "string" ? body.goals.trim() || null : null;
    const criteria = typeof body.criteria === "string" ? body.criteria.trim() || null : null;
    const currentLevel = body.current_level || "familiarity";

    const validLevels = ["familiarity", "competence", "mastery"];
    if (!validLevels.includes(currentLevel)) {
      return NextResponse.json({ error: `current_level must be one of: ${validLevels.join(", ")}` }, { status: 400 });
    }

    const result = db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(learnerId, title, description, goals, criteria, currentLevel);

    const subject = db
      .prepare("SELECT * FROM subjects WHERE id = ?")
      .get(result.lastInsertRowid) as Subject;

    let learnerProfileConfig: Record<string, unknown> | null = null;
    if (learner.config) {
      try {
        learnerProfileConfig = JSON.parse(learner.config) as Record<string, unknown>;
      } catch {
        learnerProfileConfig = { parse_error: "learner profile config is not valid JSON" };
      }
    }

    const event: SubjectCreatedEvent = {
      event: "subject.created",
      learner_id: learnerId,
      subject_id: subject.id,
      subject_title: subject.title,
      subject_description: subject.description,
      subject_goals: subject.goals,
      subject_criteria: subject.criteria,
      current_level: subject.current_level,
      workpad_summary: null,
      learner_profile_config: learnerProfileConfig,
      created_at: new Date().toISOString(),
    };

    const adapterName = process.env.AVOCADOCORE_COMPLETION_ADAPTER || "dora-task";
    const dispatcher = getSubjectCreatedDispatcher();
    const progressEvents = [
      {
        ts: new Date().toISOString(),
        stage: "subject.created",
        message: "Subject created and saved",
      },
      {
        ts: new Date().toISOString(),
        stage: "planning",
        message: "Planning the first lesson from your goals",
      },
      {
        ts: new Date().toISOString(),
        stage: adapterName === "local-queue" ? "local.fixture" : "generating_lesson",
        message:
          adapterName === "local-queue"
            ? "Generating the first lesson with the deterministic local fixture"
            : "Generating the first lesson",
      },
    ];
    const jobResult = db
      .prepare(
        `INSERT INTO next_lesson_jobs
           (subject_id, trigger_event, adapter, status, payload, dispatched_at,
            harness_status, harness_stage, progress_events)
         VALUES (?, 'subject.created', ?, 'dispatched', ?, datetime('now'), 'running', 'generating_lesson', ?)`
      )
      .run(subject.id, adapterName, JSON.stringify(event), JSON.stringify(progressEvents));

    const dispatchResult = await dispatcher(event);
    progressEvents.push(
      dispatchResult.ok && dispatchResult.lesson_id
        ? {
            ts: new Date().toISOString(),
            stage: "lesson.generated",
            message: `Generated first lesson ${dispatchResult.lesson_id}`,
          }
        : dispatchResult.ok
        ? {
            ts: new Date().toISOString(),
            stage: "planning",
            message: "Lesson request accepted by the worker",
          }
        : {
            ts: new Date().toISOString(),
            stage: "failed",
            message: dispatchResult.error ?? "First lesson generation failed",
          }
    );

    // Status semantics:
    //   "completed"  — synchronous dispatch finished and produced a lesson_id (e.g. local-queue)
    //   "dispatched" — async dispatch accepted but work happens later (e.g. dora-task, webhook)
    //   "failed"     — dispatch returned an error
    const jobStatus = !dispatchResult.ok
      ? "failed"
      : dispatchResult.lesson_id
      ? "completed"
      : "dispatched";

    db.prepare(
      `UPDATE next_lesson_jobs
       SET status = ?,
           adapter_ref = ?,
           error = ?,
           output_lesson_id = ?,
           completed_at = ?,
           harness_status = ?,
           harness_stage = ?,
           progress_events = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      jobStatus,
      dispatchResult.ref ?? null,
      dispatchResult.error ?? null,
      dispatchResult.lesson_id ?? null,
      dispatchResult.ok && dispatchResult.lesson_id ? new Date().toISOString() : null,
      dispatchResult.ok && dispatchResult.lesson_id ? "done" : dispatchResult.ok ? "waiting" : "failed",
      dispatchResult.ok && dispatchResult.lesson_id ? "lesson.generated" : dispatchResult.ok ? "planning" : "failed",
      JSON.stringify(progressEvents),
      jobResult.lastInsertRowid
    );

    return NextResponse.json(
      {
        subject,
        next_lesson_job: {
          id: jobResult.lastInsertRowid,
          trigger_event: "subject.created",
          adapter: adapterName,
          status: jobStatus,
          ref: dispatchResult.ref ?? null,
          lesson_id: dispatchResult.lesson_id ?? null,
          error: dispatchResult.error ?? null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/subjects POST]", err);
    return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
  }
}

/** GET /api/subjects — list all subjects for a learner */
export async function GET(request: Request) {
  try {
    const db = getDb();
    seedDatabase(); // idempotent — only runs once

    const sessionUser = await getSessionUser();
    const { searchParams } = new URL(request.url);
    // Use session learner to prevent cross-user data exposure; fall back to
    // explicit query param (for backwards-compatible API use) or learner 1.
    const learnerId = sessionUser?.active_learner_id ?? Number(searchParams.get("learner_id") || 1);
    reconcileMaterializedLessonJobs(db, { learnerId });

    const subjects = db
      .prepare(
        `SELECT
           s.*,
           lp.display_name AS learner_display_name,
           COUNT(l.id) AS lesson_count,
           SUM(CASE WHEN l.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN l.status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
           (
             SELECT pp.value FROM progress_points pp
             WHERE pp.subject_id = s.id AND pp.metric = 'mastery'
             ORDER BY pp.recorded_at DESC LIMIT 1
           ) AS latest_mastery,
           (
             SELECT pp.value FROM progress_points pp
             WHERE pp.subject_id = s.id AND pp.metric = 'assessment_score'
             ORDER BY pp.recorded_at DESC LIMIT 1
           ) AS latest_assessment_score
         FROM subjects s
         JOIN learner_profiles lp ON lp.id = s.learner_id
         LEFT JOIN lessons l ON l.subject_id = s.id
         WHERE s.learner_id = ?
         GROUP BY s.id
         ORDER BY s.updated_at DESC`
      )
      .all(learnerId) as SubjectSummary[];

    // Attach a computed mastery summary to each subject so cards can show a
    // score + trend at a glance, plus the most recent generation job so
    // dashboard cards can explain pending work without opening the subject.
    for (const s of subjects) {
      s.mastery = computeSubjectMastery(db, s.id, learnerId);
      s.latest_generation_job =
        (db
          .prepare(
            `SELECT id, subject_id, completed_lesson_id, discarded_lesson_id,
                    trigger_event, adapter, status, payload, adapter_ref, error,
                    dispatched_at, completed_at, created_at, updated_at,
                    harness_status, harness_stage, progress_events, retry_count,
                    last_error_detail, provider_name, output_lesson_id
             FROM next_lesson_jobs
             WHERE subject_id = ?
             ORDER BY created_at DESC
             LIMIT 1`
          )
          .get(s.id) as NextLessonJob | undefined) ?? null;
    }

    return NextResponse.json({ subjects, learner_id: learnerId });
  } catch (err) {
    console.error("[api/subjects]", err);
    return NextResponse.json(
      { error: "Failed to load subjects" },
      { status: 500 }
    );
  }
}
