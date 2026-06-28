import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { seedDatabase } from "@/db/seed";
import { getSubjectCreatedDispatcher } from "@/lib/adapters";
import { computeSubjectMastery } from "@/lib/mastery";
import type { LearnerProfile, Subject, SubjectCreatedEvent, SubjectSummary } from "@/types";

/** POST /api/subjects — create a new subject for a learner */
export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as Partial<Subject & { learner_id: number }>;

    const learnerId = Number(body.learner_id || 1);
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
    const dispatchResult = await dispatcher(event);

    // Status semantics:
    //   "completed"  — synchronous dispatch finished and produced a lesson_id (e.g. local-queue)
    //   "dispatched" — async dispatch accepted but work happens later (e.g. dora-task, webhook)
    //   "failed"     — dispatch returned an error
    const jobStatus = !dispatchResult.ok
      ? "failed"
      : dispatchResult.lesson_id
      ? "completed"
      : "dispatched";

    const jobResult = db
      .prepare(
        `INSERT INTO next_lesson_jobs
           (subject_id, trigger_event, adapter, status, payload, adapter_ref, error, output_lesson_id, dispatched_at)
         VALUES (?, 'subject.created', ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        subject.id,
        adapterName,
        jobStatus,
        JSON.stringify(event),
        dispatchResult.ref ?? null,
        dispatchResult.error ?? null,
        dispatchResult.lesson_id ?? null
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

    const { searchParams } = new URL(request.url);
    const learnerId = Number(searchParams.get("learner_id") || 1);

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
    // score + trend at a glance.
    for (const s of subjects) {
      s.mastery = computeSubjectMastery(db, s.id, learnerId);
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
