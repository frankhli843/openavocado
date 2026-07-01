import type Database from "better-sqlite3";

interface StaleJobRow {
  id: number;
  subject_id: number;
  created_at: string;
  progress_events: string | null;
}

interface LessonRow {
  id: number;
  created_at: string;
}

function parseEvents(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
  } catch {
    return [];
  }
}

/**
 * Reconcile jobs that are still marked pending/dispatched even though the
 * requested lesson has already materialized. This is behavior-based: a job is
 * only repaired when a newer same-subject lesson exists.
 */
export function reconcileMaterializedLessonJobs(
  db: Database.Database,
  scope: { learnerId?: number; subjectId?: number }
): number {
  const filters: string[] = ["j.status IN ('pending', 'dispatched')", "j.adapter != 'noop'", "j.output_lesson_id IS NULL"];
  const params: unknown[] = [];
  if (scope.subjectId != null) {
    filters.push("j.subject_id = ?");
    params.push(scope.subjectId);
  }
  if (scope.learnerId != null) {
    filters.push("s.learner_id = ?");
    params.push(scope.learnerId);
  }

  const jobs = db
    .prepare(
      `SELECT j.id, j.subject_id, j.created_at, j.progress_events
       FROM next_lesson_jobs j
       JOIN subjects s ON s.id = j.subject_id
       WHERE ${filters.join(" AND ")}
       ORDER BY j.created_at DESC`
    )
    .all(...params) as StaleJobRow[];

  let repaired = 0;
  const findLesson = db.prepare(
    `SELECT id, created_at
     FROM lessons
     WHERE subject_id = ?
       AND datetime(created_at) >= datetime(?)
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 1`
  );
  const update = db.prepare(
    `UPDATE next_lesson_jobs
     SET status = 'completed',
         output_lesson_id = ?,
         completed_at = COALESCE(completed_at, ?),
         harness_status = COALESCE(harness_status, 'done'),
         harness_stage = 'lesson.generated',
         progress_events = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  );

  const tx = db.transaction(() => {
    for (const job of jobs) {
      const lesson = findLesson.get(job.subject_id, job.created_at) as LessonRow | undefined;
      if (!lesson) continue;
      const events = parseEvents(job.progress_events);
      events.push({
        ts: new Date().toISOString(),
        stage: "lesson.generated",
        message: `Reconciled completed lesson ${lesson.id}`,
      });
      update.run(lesson.id, lesson.created_at, JSON.stringify(events), job.id);
      repaired++;
    }
  });
  tx();
  return repaired;
}
