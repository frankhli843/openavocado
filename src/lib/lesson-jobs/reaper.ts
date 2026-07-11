import type Database from "better-sqlite3";

/**
 * Stall reaper for next_lesson_jobs.
 *
 * reconcileMaterializedLessonJobs() promotes a pending/dispatched job to
 * `completed` when the lesson it was supposed to produce has materialized. It
 * deliberately never marks a job `failed`, and it has no liveness check. That
 * leaves a real gap: async adapters (dora-task, a detached agent-harness) never
 * write a terminal `status` themselves — the harness only updates
 * `harness_stage`/`progress_events`/`updated_at`. So when such a worker dies,
 * rate-limits out, or never creates a lesson, the job sits in
 * `pending`/`dispatched` forever and the UI renders a perpetual "generating…"
 * spinner with no failure reason.
 *
 * This reaper closes that gap with a job-state invariant: a job that has
 * produced no lesson AND shown no activity for longer than a generous,
 * adapter-specific liveness window is marked `failed` with a visible reason.
 *
 * Liveness, not age: the window is measured against the job's last activity
 * (`updated_at`, which updateJobProgress bumps on every progress event), not
 * against how long ago the job was created. A long-running worker that keeps
 * emitting progress is healthy no matter how old it is; a worker that has gone
 * silent past its adapter's window is dead. This mirrors the "check liveness,
 * not age" rule and never races a still-working worker as long as the window
 * exceeds the longest silent stage (audio generation).
 */

/** Default no-activity windows (minutes) before a job is considered stalled. */
const DEFAULT_STALL_MINUTES: Record<string, number> = {
  // dora-task and agent-harness can legitimately run for many minutes with long
  // silent stages (Gemini authoring, ~20 min edge_tts audio synthesis), so the
  // windows are deliberately generous — a false-negative (waiting longer) is
  // far cheaper than false-failing a live worker.
  "dora-task": 60,
  "agent-harness": 45,
  webhook: 15,
  "local-queue": 15,
};
const FALLBACK_STALL_MINUTES = 30;

function stallWindowMinutes(adapter: string): number {
  const override = Number(process.env.AVOCADOCORE_JOB_STALL_MINUTES);
  if (Number.isFinite(override) && override > 0) return override;
  return DEFAULT_STALL_MINUTES[adapter] ?? FALLBACK_STALL_MINUTES;
}

interface StalledCandidateRow {
  id: number;
  subject_id: number;
  adapter: string;
  harness_stage: string | null;
  progress_events: string | null;
  created_at: string;
  idle_minutes: number | null;
}

function parseEvents(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? (parsed.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>)
      : [];
  } catch {
    return [];
  }
}

/**
 * Mark stalled, output-less lesson jobs as failed so they surface a real error
 * state instead of an eternal spinner. Returns the number of jobs reaped.
 *
 * Call AFTER reconcileMaterializedLessonJobs so a job whose lesson already
 * exists is completed rather than failed. As a second guard, this function also
 * skips any job for which a newer same-subject lesson exists.
 *
 * @param opts.nowIso  Override "now" for deterministic tests. When omitted the
 *                     comparison uses SQLite's own `now` (UTC), which is
 *                     timezone-safe against the stored UTC timestamps.
 */
export function reapStalledLessonJobs(
  db: Database.Database,
  scope: { learnerId?: number; subjectId?: number },
  opts: { nowIso?: string } = {}
): number {
  const filters: string[] = [
    "j.status IN ('pending', 'dispatched')",
    "j.adapter != 'noop'",
    "j.output_lesson_id IS NULL",
  ];
  const params: unknown[] = [];

  const nowExpr = opts.nowIso ? "julianday(?)" : "julianday('now')";
  if (opts.nowIso) params.push(opts.nowIso);

  if (scope.subjectId != null) {
    filters.push("j.subject_id = ?");
    params.push(scope.subjectId);
  }
  if (scope.learnerId != null) {
    filters.push("s.learner_id = ?");
    params.push(scope.learnerId);
  }

  const rows = db
    .prepare(
      `SELECT j.id, j.subject_id, j.adapter, j.harness_stage, j.progress_events, j.created_at,
              (${nowExpr} - julianday(COALESCE(j.updated_at, j.dispatched_at, j.created_at))) * 1440 AS idle_minutes
       FROM next_lesson_jobs j
       JOIN subjects s ON s.id = j.subject_id
       WHERE ${filters.join(" AND ")}
       ORDER BY j.id DESC`
    )
    .all(...params) as StalledCandidateRow[];

  if (rows.length === 0) return 0;

  const findLesson = db.prepare(
    `SELECT id
     FROM lessons
     WHERE subject_id = ?
       AND datetime(created_at) >= datetime(?)
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 1`
  );
  const update = db.prepare(
    `UPDATE next_lesson_jobs
     SET status = 'failed',
         error = COALESCE(error, ?),
         last_error_detail = ?,
         harness_status = 'failed',
         harness_stage = 'failed',
         progress_events = ?,
         completed_at = COALESCE(completed_at, ?),
         updated_at = datetime('now')
     WHERE id = ?`
  );

  let reaped = 0;
  const tx = db.transaction(() => {
    for (const job of rows) {
      const idle = job.idle_minutes ?? 0;
      if (idle < stallWindowMinutes(job.adapter)) continue;
      // Second guard: never fail a job whose lesson actually materialized.
      const lesson = findLesson.get(job.subject_id, job.created_at) as { id: number } | undefined;
      if (lesson) continue;

      const idleLabel = idle >= 60 ? `${Math.round(idle / 60)}h` : `${Math.round(idle)}m`;
      const lastStage = job.harness_stage ?? "queued";
      const reason =
        `Generation stalled: the ${job.adapter} worker stopped responding after ${idleLabel} ` +
        `with no lesson produced (last stage: ${lastStage}). Retry generation for this subject.`;

      const events = parseEvents(job.progress_events);
      events.push({
        ts: opts.nowIso ?? new Date().toISOString(),
        stage: "failed",
        message: reason,
      });

      update.run(reason, reason, JSON.stringify(events), opts.nowIso ?? new Date().toISOString(), job.id);
      reaped++;
    }
  });
  tx();

  return reaped;
}
