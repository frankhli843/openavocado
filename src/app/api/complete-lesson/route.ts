import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { getCompletionAdapter } from "@/lib/adapters";
import { getAssessmentAdapter } from "@/lib/assessment";
import { loadReusableTags, persistAssessment } from "@/lib/assessment-store";
import { deserializeQuizState } from "@/lib/quiz-state";
import { createSubjectJournalEntry } from "@/lib/subject-journal";
import { evaluateSubjectLevelProgressionWithAi } from "@/lib/level-progression";
import type { Difficulty, LessonCompletedEvent, SignalType } from "@/types";

/**
 * POST /api/complete-lesson
 *
 * Manual lesson completion endpoint — the ONLY path to marking a lesson
 * complete. Autosave, quiz passing, code submission, and diagnostic answering
 * never reach this. On completion we:
 *  1. assess freeform assessment + end-of-lesson diagnostic answers (tags + signals),
 *  2. mark the lesson completed and record a progress point,
 *  3. build the enriched next-lesson evidence payload,
 *  4. dispatch the configured completion adapter.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lesson_id: number;
      learner_id: number;
      assessment_answers?: Record<string, string>;
      diagnostic_answers?: Record<string, string>;
      code_results?: {
        activity_title: string;
        code: string;
        test_results: Record<string, string>;
        run_output: string;
      }[];
    };

    const { lesson_id, learner_id, assessment_answers = {}, diagnostic_answers = {}, code_results = [] } = body;

    if (!lesson_id || !learner_id) {
      return NextResponse.json(
        { error: "lesson_id and learner_id are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const lesson = db
      .prepare(
        `SELECT l.*, s.title AS subject_title, s.goals AS subject_goals,
                s.criteria AS subject_criteria
         FROM lessons l JOIN subjects s ON s.id = l.subject_id
         WHERE l.id = ?`
      )
      .get(lesson_id) as {
        id: number;
        title: string;
        goals: string | null;
        subject_id: number;
        subject_title: string;
        subject_goals: string | null;
        subject_criteria: string | null;
        status: string;
        next_lesson_diagnostics: string | null;
      } | undefined;

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (!db.prepare("SELECT id FROM subjects WHERE id = ? AND learner_id = ?").get(lesson.subject_id, learner_id)) {
      return NextResponse.json({ error: "Lesson does not belong to this learner" }, { status: 403 });
    }

    if (lesson.status === "completed") {
      return NextResponse.json({ ok: true, message: "Lesson already completed" });
    }

    // ─── Fetch the assessment activity (freeform questions + optional quiz) ──
    const assessmentActivity = db
      .prepare(
        `SELECT id, content FROM lesson_activities
         WHERE lesson_id = ? AND activity_type = 'assessment'
         ORDER BY sequence_order ASC LIMIT 1`
      )
      .get(lesson_id) as { id: number; content: string | null } | undefined;

    type FreeQ = { id: string; text: string; concept?: string; difficulty?: Difficulty };
    const questions: FreeQ[] = [];
    if (assessmentActivity?.content) {
      try {
        const parsed = JSON.parse(assessmentActivity.content) as { questions?: FreeQ[] };
        if (Array.isArray(parsed.questions)) questions.push(...parsed.questions);
      } catch {
        // ignore parse error
      }
    }

    const assessment_qa = questions.map((q) => ({
      question: q.text,
      learner_answer: assessment_answers[q.id] || "(no answer)",
    }));

    // ─── Assess freeform assessment answers (tags + mastery evidence) ────────
    const assessor = getAssessmentAdapter();
    const subjectTags = loadReusableTags(db, lesson.subject_id);
    const assessOne = (
      qid: string,
      text: string,
      concept: string | null,
      difficulty: Difficulty | null,
      answer: string,
      qtype: "freeform" | "diagnostic"
    ) => {
      if (!answer || !answer.trim()) return;
      try {
        const outcome = assessor.assess({
          question_type: qtype,
          question_text: text,
          concept,
          difficulty,
          answer_text: answer,
          subject_tags: subjectTags,
        });
        persistAssessment(db, {
          learner_id,
          subject_id: lesson.subject_id,
          lesson_id,
          activity_id: assessmentActivity?.id ?? null,
          question_id: qid,
          question_type: qtype,
          concept,
          difficulty,
          answer_text: answer,
          outcome: outcome as Awaited<ReturnType<typeof assessor.assess>>,
        });
      } catch (e) {
        // Surface in logs; do not silently swallow tagging failures.
        console.error("[complete-lesson] assess failed for", qid, e);
      }
    };

    for (const q of questions) {
      assessOne(q.id, q.text, q.concept ?? null, q.difficulty ?? null, assessment_answers[q.id] || "", "freeform");
    }

    // ─── End-of-lesson diagnostics ───────────────────────────────────────────
    type Diag = { id: string; prompt: string };
    const diagnostics: Diag[] = lesson.next_lesson_diagnostics
      ? (() => {
          try {
            return JSON.parse(lesson.next_lesson_diagnostics) as Diag[];
          } catch {
            return [];
          }
        })()
      : [];
    const next_lesson_diagnostics = diagnostics.map((d) => ({
      prompt: d.prompt,
      answer: diagnostic_answers[d.id] || "(no answer)",
    }));
    for (const d of diagnostics) {
      assessOne(d.id, d.prompt, null, null, diagnostic_answers[d.id] || "", "diagnostic");
    }

    // ─── Mastery signals (now includes freshly assessed evidence) ────────────
    const mastery_signals = db
      .prepare(
        `SELECT signal_type, concept, detail, difficulty FROM mastery_signals
         WHERE lesson_id = ? AND learner_id = ?`
      )
      .all(lesson_id, learner_id) as Array<{
        signal_type: SignalType;
        concept: string;
        detail: string | null;
        difficulty: Difficulty | null;
      }>;

    const concepts_to_review = mastery_signals
      .filter((s) => s.signal_type === "review_needed" || s.signal_type === "weak_spot")
      .map((s) => s.concept);
    const concepts_ready = mastery_signals
      .filter((s) => s.signal_type === "ready_to_advance" || s.signal_type === "strength")
      .map((s) => s.concept);
    const recent_misconceptions = db
      .prepare(
        `SELECT DISTINCT concept FROM mastery_signals
         WHERE subject_id = ? AND learner_id = ? AND signal_type = 'misconception'
         ORDER BY created_at DESC LIMIT 10`
      )
      .all(lesson.subject_id, learner_id)
      .map((r) => (r as { concept: string }).concept);

    // ─── Tag + difficulty performance (queryable evidence) ───────────────────
    const tagPerfRows = db
      .prepare(
        `SELECT t.name AS tag,
                COALESCE(ar.difficulty, 'ungraded') AS difficulty,
                SUM(CASE WHEN ar.outcome = 'correct' THEN 1 ELSE 0 END) AS correct,
                SUM(CASE WHEN ar.outcome = 'incorrect' THEN 1 ELSE 0 END) AS incorrect,
                SUM(CASE WHEN ar.outcome = 'idk' THEN 1 ELSE 0 END) AS idk,
                COUNT(*) AS total
         FROM assessment_results ar
         JOIN assessment_result_tags art ON art.result_id = ar.id
         JOIN tags t ON t.id = art.tag_id
         WHERE ar.subject_id = ? AND ar.learner_id = ?
         GROUP BY t.name, difficulty
         ORDER BY total DESC`
      )
      .all(lesson.subject_id, learner_id) as Array<{
        tag: string;
        difficulty: Difficulty | "ungraded";
        correct: number;
        incorrect: number;
        idk: number;
        total: number;
      }>;

    // ─── Quiz result from autosave ───────────────────────────────────────────
    let quiz_result: LessonCompletedEvent["quiz_result"] = null;
    const autosaveRow = db
      .prepare(
        `SELECT assessment_answers FROM lesson_autosave
         WHERE lesson_id = ? AND learner_id = ? AND assessment_answers IS NOT NULL
         ORDER BY saved_at DESC LIMIT 1`
      )
      .get(lesson_id, learner_id) as { assessment_answers: string | null } | undefined;
    if (autosaveRow?.assessment_answers) {
      try {
        const blob = JSON.parse(autosaveRow.assessment_answers) as Record<string, unknown>;
        const quizState = deserializeQuizState(
          typeof blob.__quiz__ === "string" ? blob.__quiz__ : null
        );
        if (quizState) {
          quiz_result = {
            passed: quizState.passed,
            correct_count: quizState.correct_count,
            pass_threshold: quizState.pass_threshold,
          };
        }
      } catch {
        // ignore
      }
    }

    // ─── Curriculum + cross-subject context ──────────────────────────────────
    const completed_lessons = db
      .prepare(
        `SELECT title, completed_at FROM lessons
         WHERE subject_id = ? AND status = 'completed' AND id != ?
         ORDER BY completed_at DESC LIMIT 10`
      )
      .all(lesson.subject_id, lesson_id) as Array<{ title: string; completed_at: string }>;
    const discarded_lessons = db
      .prepare(
        `SELECT title, discard_reason AS reason FROM lessons
         WHERE subject_id = ? AND status = 'discarded'
         ORDER BY discarded_at DESC LIMIT 10`
      )
      .all(lesson.subject_id) as Array<{ title: string; reason: string | null }>;

    const workpadRow = db
      .prepare(
        "SELECT content FROM subject_workpads WHERE subject_id = ? AND learner_id = ?"
      )
      .get(lesson.subject_id, learner_id) as { content: string } | undefined;
    const workpad_summary = workpadRow?.content ? workpadRow.content.slice(0, 800) : null;

    const profileRow = db
      .prepare("SELECT config FROM learner_profiles WHERE id = ?")
      .get(learner_id) as { config: string | null } | undefined;
    let learner_profile_config: Record<string, unknown> | null = null;
    if (profileRow?.config) {
      try {
        learner_profile_config = JSON.parse(profileRow.config) as Record<string, unknown>;
      } catch {
        learner_profile_config = null;
      }
    }

    const cross_subject_history = db
      .prepare(
        `SELECT s.title AS subject_title,
                (SELECT pp.value FROM progress_points pp
                 WHERE pp.subject_id = s.id AND pp.metric = 'mastery'
                 ORDER BY pp.recorded_at DESC LIMIT 1) AS mastery_score
         FROM subjects s
         WHERE s.learner_id = ? AND s.id != ? AND s.status != 'archived'
         ORDER BY s.updated_at DESC LIMIT 8`
      )
      .all(learner_id, lesson.subject_id) as Array<{
        subject_title: string;
        mastery_score: number | null;
      }>;

    // ─── Mark lesson completed + record progress ─────────────────────────────
    db.prepare(
      `UPDATE lessons
       SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(lesson_id);

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

    const level_progression = await evaluateSubjectLevelProgressionWithAi(db, lesson.subject_id, learner_id, {
      persist: true,
      completedLessonId: lesson_id,
    });

    const goals: string[] = lesson.goals ? JSON.parse(lesson.goals) : [];
    const event: LessonCompletedEvent = {
      event: "lesson.completed",
      learner_id,
      subject_id: lesson.subject_id,
      subject_title: lesson.subject_title,
      subject_goals: lesson.subject_goals,
      subject_criteria: lesson.subject_criteria,
      current_level: level_progression.current_level,
      level_progression,
      lesson_id,
      lesson_title: lesson.title,
      lesson_goals: goals,
      activities_completed: ["audio", "reading", "interactive", "practice_code", "assessment"],
      assessment_qa,
      code_attempts: code_results,
      mastery_signals,
      concepts_to_review,
      concepts_ready_to_advance: concepts_ready,
      next_lesson_diagnostics,
      quiz_result,
      tag_difficulty_performance: tagPerfRows,
      recent_misconceptions,
      completed_lessons,
      discarded_lessons,
      workpad_summary,
      learner_profile_config,
      cross_subject_history,
      completed_at: new Date().toISOString(),
    };

    const adapter = getCompletionAdapter();
    const generatorStage = adapter.name === "local-queue" ? "local.fixture" : "generating_lesson";
    const progressEvents = [
      {
        ts: new Date().toISOString(),
        stage: "lesson_completed",
        message: "Lesson completion recorded",
      },
      {
        ts: new Date().toISOString(),
        stage: "mastery.updated",
        message: level_progression.graduated
          ? `Updated mastery evidence and graduated to ${level_progression.current_level.replace("_", " ")}`
          : "Updated mastery, level, quiz, code, and diagnostic evidence",
      },
      {
        ts: new Date().toISOString(),
        stage: generatorStage,
        message:
          adapter.name === "local-queue"
            ? "Generating the next lesson with the deterministic local fixture"
            : "Generating the next lesson from your latest progress",
      },
    ];
    const jobResult = db
      .prepare(
        `INSERT INTO next_lesson_jobs
           (subject_id, completed_lesson_id, trigger_event, adapter, status, payload,
            dispatched_at, harness_status, harness_stage, progress_events)
         VALUES (?, ?, 'lesson.completed', ?, 'dispatched', ?, datetime('now'), 'running', 'generating_lesson', ?)`
      )
      .run(
        lesson.subject_id,
        lesson_id,
        adapter.name,
        JSON.stringify(event),
        JSON.stringify(progressEvents)
      );
    const nextLessonJobId = jobResult.lastInsertRowid as number;

    const dispatchResult = await adapter.dispatch(event);
    progressEvents.push(
      dispatchResult.ok && dispatchResult.lesson_id
        ? {
            ts: new Date().toISOString(),
            stage: "lesson.generated",
            message: `Generated next lesson ${dispatchResult.lesson_id}`,
          }
        : dispatchResult.ok
        ? {
            ts: new Date().toISOString(),
            stage: "planning",
            message: "Generation request accepted by the lesson worker",
          }
        : {
            ts: new Date().toISOString(),
            stage: "failed",
            message: dispatchResult.error ?? "Next lesson generation failed",
          }
    );

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
      dispatchResult.ok && dispatchResult.lesson_id ? "completed" : dispatchResult.ok ? "dispatched" : "failed",
      dispatchResult.ref ?? null,
      dispatchResult.error ?? null,
      dispatchResult.lesson_id ?? null,
      dispatchResult.ok && dispatchResult.lesson_id ? new Date().toISOString() : null,
      dispatchResult.ok && dispatchResult.lesson_id ? "done" : dispatchResult.ok ? "waiting" : "failed",
      dispatchResult.ok && dispatchResult.lesson_id ? "lesson.generated" : dispatchResult.ok ? "planning" : "failed",
      JSON.stringify(progressEvents),
      nextLessonJobId
    );

    createSubjectJournalEntry(db, {
      subject_id: lesson.subject_id,
      learner_id,
      entry_type: "lesson_completion",
      title: `Completed lesson: ${lesson.title}`,
      content: buildCompletionJournalContent(event, {
        adapter: adapter.name,
        dispatch_ok: dispatchResult.ok,
        adapter_ref: dispatchResult.ref ?? null,
        error: dispatchResult.error ?? null,
      }),
      metadata: {
        lesson_id,
        adapter: adapter.name,
        dispatch_ok: dispatchResult.ok,
        adapter_ref: dispatchResult.ref ?? null,
      },
      created_by: "avocadocore-complete-lesson",
    });

    return NextResponse.json({
      ok: true,
      lesson_id,
      adapter: adapter.name,
      dispatch_ok: dispatchResult.ok,
      adapter_ref: dispatchResult.ref,
      output_lesson_id: dispatchResult.lesson_id ?? null,
      level_progression,
    });
  } catch (err) {
    console.error("[api/complete-lesson]", err);
    return NextResponse.json({ error: "Failed to complete lesson" }, { status: 500 });
  }
}

function buildCompletionJournalContent(
  event: LessonCompletedEvent,
  dispatch: {
    adapter: string;
    dispatch_ok: boolean;
    adapter_ref: string | null;
    error: string | null;
  }
): string {
  const quiz = event.quiz_result
    ? `${event.quiz_result.passed ? "passed" : "not passed"} (${event.quiz_result.correct_count}/${event.quiz_result.pass_threshold})`
    : "no final quiz recorded";
  const diagnosticText = event.next_lesson_diagnostics.length
    ? event.next_lesson_diagnostics
        .map((d) => `- ${d.prompt}\n  Answer: ${d.answer}`)
        .join("\n")
    : "- No next-lesson diagnostic answers recorded.";
  const tagText = event.tag_difficulty_performance.length
    ? event.tag_difficulty_performance
        .slice(0, 12)
        .map(
          (p) =>
            `- ${p.tag} (${p.difficulty}): ${p.correct} correct, ${p.incorrect} incorrect, ${p.idk} idk, ${p.total} total`
        )
        .join("\n")
    : "- No tag-level performance evidence recorded.";
  const reviewText = [
    event.concepts_to_review.length
      ? `Needs review: ${event.concepts_to_review.join(", ")}`
      : "Needs review: none recorded",
    event.concepts_ready_to_advance.length
      ? `Ready to advance: ${event.concepts_ready_to_advance.join(", ")}`
      : "Ready to advance: none recorded",
    event.recent_misconceptions.length
      ? `Recent misconceptions: ${event.recent_misconceptions.join(", ")}`
      : "Recent misconceptions: none recorded",
  ].join("\n");
  const dispatchText = dispatch.dispatch_ok
    ? `Next-lesson task dispatched through ${dispatch.adapter}${dispatch.adapter_ref ? `, ref ${dispatch.adapter_ref}` : ""}.`
    : `Next-lesson dispatch failed through ${dispatch.adapter}: ${dispatch.error ?? "unknown error"}.`;

  return [
    `Lesson completed at ${event.completed_at}.`,
    `Current level after completion: ${event.current_level}.`,
    `Level progression: ${event.level_progression.reason}`,
    `Quiz result: ${quiz}.`,
    "",
    "Learner diagnostics for next planning:",
    diagnosticText,
    "",
    "Mastery direction:",
    reviewText,
    "",
    "Tag and difficulty evidence:",
    tagText,
    "",
    event.workpad_summary
      ? `Current workpad excerpt before next generation:\n${event.workpad_summary}`
      : "Current workpad excerpt before next generation: none.",
    "",
    dispatchText,
  ].join("\n");
}
