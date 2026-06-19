import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { seedDatabase } from "@/db/seed";
import type { SubjectSummary } from "@/types";

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

    return NextResponse.json({ subjects, learner_id: learnerId });
  } catch (err) {
    console.error("[api/subjects]", err);
    return NextResponse.json(
      { error: "Failed to load subjects" },
      { status: 500 }
    );
  }
}
