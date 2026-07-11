#!/usr/bin/env tsx
/**
 * Backfill the two-ready-lesson buffer for active subjects.
 *
 * Dry run:
 *   pnpm exec tsx scripts/backfill-two-ready-lessons.ts
 *
 * Dispatch configured adapter work:
 *   pnpm exec tsx scripts/backfill-two-ready-lessons.ts --write
 */
import { getDb, closeDb } from "../src/db/connection";
import { getCompletionAdapter } from "../src/lib/adapters";
import { buildLessonBufferPlan, needsLessonBufferBackfill } from "../src/lib/lesson-buffer";
import type { LessonBufferPlan, LessonCompletedEvent, LevelProgression } from "../src/types";

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const force = args.has("--force");
const subjectArg = process.argv[process.argv.indexOf("--subject") + 1];
const subjectFilter = args.has("--subject") ? Number(subjectArg) : null;
const limitArg = process.argv[process.argv.indexOf("--limit") + 1];
const limit = args.has("--limit") ? Number(limitArg) : null;

if (args.has("--subject") && !Number.isInteger(subjectFilter)) {
  throw new Error("usage: --subject <id>");
}
if (args.has("--limit") && (!Number.isInteger(limit) || Number(limit) <= 0)) {
  throw new Error("usage: --limit <positive integer>");
}

const DEFAULT_LEVEL_PROGRESSION: LevelProgression = {
  previous_level: "familiarity",
  current_level: "familiarity",
  recommended_level: "familiarity",
  next_level: "competence",
  graduated: false,
  progress_percent: 0,
  reason: "Backfill event synthesized from stored lesson history.",
  frontier_mode: false,
  evidence: {
    completed_lessons: 0,
    total_lessons: 0,
    mastery_score: null,
    assessment_total: 0,
    assessment_accuracy: null,
    hard_assessment_total: 0,
    hard_assessment_accuracy: null,
    positive_signals: 0,
    review_signals: 0,
    passed_code_submissions: 0,
    total_code_submissions: 0,
  },
  gates: [],
  phases: [],
};

interface SubjectRow {
  id: number;
  learner_id: number;
  title: string;
  description: string | null;
  goals: string | null;
  criteria: string | null;
  current_level: "familiarity" | "competence" | "mastery" | "post_mastery";
}

interface LessonRow {
  id: number;
  title: string;
  goals: string | null;
  completed_at: string | null;
}

interface DispatchSummary {
  subject_id: number;
  subject_title: string;
  action: "skip" | "would_dispatch" | "dispatched" | "failed";
  reason: string;
  plan?: LessonBufferPlan;
  ref?: string;
  lesson_id?: number;
  error?: string;
}

async function main(): Promise<void> {
  const db = getDb();
  const subjects = db
    .prepare(
      `SELECT id, learner_id, title, description, goals, criteria, current_level
       FROM subjects
       WHERE status = 'active'
         ${subjectFilter != null ? "AND id = ?" : ""}
       ORDER BY updated_at DESC, id ASC
       ${limit != null ? `LIMIT ${limit}` : ""}`
    )
    .all(...(subjectFilter != null ? [subjectFilter] : [])) as SubjectRow[];

  const adapter = getCompletionAdapter();
  const summaries: DispatchSummary[] = [];

  for (const subject of subjects) {
    const latestCompleted = db
      .prepare(
        `SELECT id, title, goals, completed_at
         FROM lessons
         WHERE subject_id = ? AND status = 'completed'
         ORDER BY completed_at DESC, sequence_number DESC, id DESC
         LIMIT 1`
      )
      .get(subject.id) as LessonRow | undefined;

    if (!latestCompleted) {
      summaries.push({
        subject_id: subject.id,
        subject_title: subject.title,
        action: "skip",
        reason: "no completed lesson exists yet",
      });
      continue;
    }

    const plan = buildLessonBufferPlan(db, {
      subjectId: subject.id,
      completedLessonId: latestCompleted.id,
    });
    if (!needsLessonBufferBackfill(db, subject.id, latestCompleted.id)) {
      summaries.push({
        subject_id: subject.id,
        subject_title: subject.title,
        action: "skip",
        reason: "already has two queued lessons enriched from the latest completed lesson",
        plan,
      });
      continue;
    }

    const activeJob = db
      .prepare(
        `SELECT id FROM next_lesson_jobs
         WHERE subject_id = ?
           AND trigger_event = 'lesson.completed'
           AND status IN ('pending', 'dispatched')
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(subject.id) as { id: number } | undefined;
    if (activeJob && !force) {
      summaries.push({
        subject_id: subject.id,
        subject_title: subject.title,
        action: "skip",
        reason: `active next-lesson job ${activeJob.id} already exists; use --force to dispatch anyway`,
        plan,
      });
      continue;
    }

    const event = loadPriorCompletionEvent(db, subject, latestCompleted, plan);
    if (!write) {
      summaries.push({
        subject_id: subject.id,
        subject_title: subject.title,
        action: "would_dispatch",
        reason: `would dispatch ${adapter.name} to enrich ${plan.enrichment_required_for_lesson_ids.length} queued lesson(s) and create ${plan.lessons_to_generate}`,
        plan,
      });
      continue;
    }

    const progressEvents = [
      {
        ts: new Date().toISOString(),
        stage: "lesson_buffer.backfill",
        message: `Backfill dispatch: enrich ${plan.enrichment_required_for_lesson_ids.length}, generate ${plan.lessons_to_generate}`,
      },
    ];
    const jobId = db
      .prepare(
        `INSERT INTO next_lesson_jobs
           (subject_id, completed_lesson_id, trigger_event, adapter, status, payload,
            dispatched_at, harness_status, harness_stage, progress_events)
         VALUES (?, ?, 'lesson.completed', ?, 'dispatched', ?, datetime('now'), 'running', 'lesson_buffer.backfill', ?)`
      )
      .run(subject.id, latestCompleted.id, adapter.name, JSON.stringify(event), JSON.stringify(progressEvents))
      .lastInsertRowid as number;

    const result = await adapter.dispatch(event);
    db.prepare(
      `UPDATE next_lesson_jobs
       SET status = ?,
           adapter_ref = ?,
           error = ?,
           output_lesson_id = ?,
           completed_at = ?,
           harness_status = ?,
           harness_stage = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      result.ok && result.lesson_id ? "completed" : result.ok ? "dispatched" : "failed",
      result.ref ?? null,
      result.error ?? null,
      result.lesson_id ?? null,
      result.ok && result.lesson_id ? new Date().toISOString() : null,
      result.ok && result.lesson_id ? "done" : result.ok ? "waiting" : "failed",
      result.ok && result.lesson_id ? "lesson_buffer.ready" : result.ok ? "planning" : "failed",
      jobId
    );

    summaries.push({
      subject_id: subject.id,
      subject_title: subject.title,
      action: result.ok ? "dispatched" : "failed",
      reason: `adapter ${adapter.name}`,
      plan,
      ref: result.ref,
      lesson_id: result.lesson_id,
      error: result.error,
    });
  }

  console.log(JSON.stringify({ ok: true, write, adapter: adapter.name, count: summaries.length, summaries }, null, 2));
  closeDb();
}

function loadPriorCompletionEvent(
  db: ReturnType<typeof getDb>,
  subject: SubjectRow,
  latestCompleted: LessonRow,
  plan: LessonBufferPlan
): LessonCompletedEvent {
  const prior = db
    .prepare(
      `SELECT payload
       FROM next_lesson_jobs
       WHERE subject_id = ?
         AND completed_lesson_id = ?
         AND trigger_event = 'lesson.completed'
         AND payload IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(subject.id, latestCompleted.id) as { payload: string } | undefined;
  if (prior?.payload) {
    try {
      const parsed = JSON.parse(prior.payload) as LessonCompletedEvent;
      if (parsed?.event === "lesson.completed") return { ...parsed, lesson_buffer: plan };
    } catch {
      // Fall through to a synthesized event.
    }
  }

  return {
    event: "lesson.completed",
    learner_id: subject.learner_id,
    subject_id: subject.id,
    subject_title: subject.title,
    subject_goals: subject.goals,
    subject_criteria: subject.criteria,
    current_level: subject.current_level,
    level_progression: { ...DEFAULT_LEVEL_PROGRESSION, current_level: subject.current_level, recommended_level: subject.current_level },
    lesson_id: latestCompleted.id,
    lesson_title: latestCompleted.title,
    lesson_goals: parseStringArray(latestCompleted.goals),
    activities_completed: [],
    assessment_qa: [],
    code_attempts: [],
    mastery_signals: [],
    concepts_to_review: [],
    concepts_ready_to_advance: [],
    next_lesson_diagnostics: [],
    quiz_result: null,
    tag_difficulty_performance: [],
    recent_misconceptions: [],
    completed_lessons: [],
    discarded_lessons: [],
    workpad_summary: null,
    learner_profile_config: null,
    cross_subject_history: [],
    lesson_buffer: plan,
    completed_at: latestCompleted.completed_at ?? new Date().toISOString(),
  };
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
