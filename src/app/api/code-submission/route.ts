import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { recordLearningEvidence } from "@/lib/learning-evidence";

/**
 * POST /api/code-submission
 *
 * Records a code exercise submission. When the submission passes all tests it
 * logs an immutable attempt and a `ready_to_advance` mastery signal for the
 * subject. This is a mastery/prerequisite signal ONLY — it never marks the
 * lesson complete. Manual completion via /api/complete-lesson remains the only
 * completion trigger.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      activity_id: number;
      learner_id: number;
      passed: boolean;
      code?: string | null;
      run_output?: string | null;
      test_results?: Record<string, string> | null;
      prompt?: string | null;
    };
    const { activity_id, learner_id, passed } = body;

    if (!activity_id || !learner_id) {
      return NextResponse.json(
        { error: "activity_id and learner_id are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Resolve the activity -> lesson -> subject chain.
    const activity = db
      .prepare(
        `SELECT la.id AS activity_id, la.title, la.content, la.lesson_id, l.subject_id
         FROM lesson_activities la
         JOIN lessons l ON l.id = la.lesson_id
         WHERE la.id = ?`
      )
      .get(activity_id) as
      | { activity_id: number; title: string | null; content: string | null; lesson_id: number; subject_id: number }
      | undefined;

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Immutable submission attempt (audit trail).
    const prompt = body.prompt ?? inferPrompt(activity.content, activity.title);
    const attemptResult = db.prepare(
      `INSERT INTO attempts (activity_id, learner_id, attempt_type, content, result, is_final)
       VALUES (?, ?, 'submit', ?, ?, ?)`
    ).run(
      activity_id,
      learner_id,
      JSON.stringify({ code: body.code ?? null, prompt }),
      JSON.stringify({
        passed: !!passed,
        run_output: body.run_output ?? null,
        test_results: body.test_results ?? null,
      }),
      passed ? 1 : 0
    );

    const concept = activity.title ?? "code exercise";
    const evidenceId = recordLearningEvidence(db, {
      learner_id,
      subject_id: activity.subject_id,
      lesson_id: activity.lesson_id,
      activity_id,
      source_type: "code_submission",
      source_id: `attempts:${String(attemptResult.lastInsertRowid)}`,
      concept,
      outcome: passed ? "passed" : "failed",
      prompt,
      learner_input: body.code ?? null,
      system_response: body.run_output ?? null,
      metadata: {
        attempt_id: attemptResult.lastInsertRowid,
        test_results: body.test_results ?? null,
      },
    });

    // On a passing submission, record a mastery signal (deduped per lesson+concept).
    if (passed) {
      const existing = db
        .prepare(
          `SELECT id FROM mastery_signals
           WHERE learner_id = ? AND subject_id = ? AND lesson_id = ?
             AND signal_type = 'ready_to_advance' AND concept = ?`
        )
        .get(learner_id, activity.subject_id, activity.lesson_id, concept) as { id: number } | undefined;

      if (!existing) {
        db.prepare(
          `INSERT INTO mastery_signals (learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence)
           VALUES (?, ?, ?, 'ready_to_advance', ?, ?, ?)`
        ).run(
          learner_id,
          activity.subject_id,
          activity.lesson_id,
          concept,
          "Submitted code that passed all public and hidden tests.",
          0.8
        );
      }
    }

    return NextResponse.json({ ok: true, recorded: !!passed, evidence_id: evidenceId });
  } catch (err) {
    console.error("[api/code-submission]", err);
    return NextResponse.json({ error: "Failed to record submission" }, { status: 500 });
  }
}

function inferPrompt(content: string | null, fallback: string | null): string | null {
  if (!content) return fallback;
  try {
    const parsed = JSON.parse(content) as { prompt?: string };
    return parsed.prompt ?? fallback;
  } catch {
    return fallback;
  }
}
