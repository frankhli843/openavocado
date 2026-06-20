import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import type { AutosavePayload } from "@/lib/autosave";

/**
 * POST /api/autosave
 * Upserts lesson autosave state. Never marks a lesson complete.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AutosavePayload;
    const {
      lesson_id,
      learner_id,
      activity_id,
      code_draft,
      run_output,
      test_results,
      runtime_errors,
      assessment_answers,
      widget_state,
      last_edited_at,
      last_run_at,
    } = body;

    if (!lesson_id || !learner_id) {
      return NextResponse.json(
        { error: "lesson_id and learner_id are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // activity_id=0 means "lesson-level" (not scoped to a specific activity)
    db.prepare(
      `INSERT INTO lesson_autosave
         (lesson_id, learner_id, activity_id, code_draft, run_output, test_results,
          runtime_errors, assessment_answers, widget_state, last_edited_at, last_run_at, saved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (lesson_id, learner_id, activity_id) DO UPDATE SET
         code_draft        = COALESCE(excluded.code_draft, code_draft),
         run_output        = COALESCE(excluded.run_output, run_output),
         test_results      = COALESCE(excluded.test_results, test_results),
         runtime_errors    = COALESCE(excluded.runtime_errors, runtime_errors),
         assessment_answers = COALESCE(excluded.assessment_answers, assessment_answers),
         widget_state      = COALESCE(excluded.widget_state, widget_state),
         last_edited_at    = COALESCE(excluded.last_edited_at, last_edited_at),
         last_run_at       = COALESCE(excluded.last_run_at, last_run_at),
         saved_at          = datetime('now')`
    ).run(
      lesson_id,
      learner_id,
      activity_id ?? 0,
      code_draft ?? null,
      run_output ?? null,
      test_results ? JSON.stringify(test_results) : null,
      runtime_errors ? JSON.stringify(runtime_errors) : null,
      assessment_answers ? JSON.stringify(assessment_answers) : null,
      widget_state ? JSON.stringify(widget_state) : null,
      last_edited_at ?? null,
      last_run_at ?? null
    );

    return NextResponse.json({ ok: true, saved_at: new Date().toISOString() });
  } catch (err) {
    console.error("[api/autosave]", err);
    return NextResponse.json({ error: "Autosave failed" }, { status: 500 });
  }
}
