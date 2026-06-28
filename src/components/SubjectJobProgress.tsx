"use client";

/**
 * SubjectJobProgress — learner-visible panel showing recent lesson generation
 * jobs for a subject. Shown on the Lessons tab when a job is pending, running,
 * or recently completed so the learner knows something is being prepared.
 *
 * Adapter-agnostic: works for local-queue (synchronous assessment creation),
 * dora-task (async agent generation), webhook, and noop adapters.
 */

import type { NextLessonJob } from "@/types";

interface Props {
  jobs: NextLessonJob[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  dispatched: "Dispatched",
  completed: "Done",
  failed: "Failed",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  dispatched: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const TRIGGER_LABEL: Record<string, string> = {
  "subject.created": "Initial assessment",
  "lesson.completed": "Next lesson",
  "lesson.discarded": "Replacement lesson",
};

function timeAgo(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Filter to jobs that are worth showing to the learner:
 * - Any non-noop job that is still pending or dispatched (something is being worked on)
 * - Any job that completed recently (within 24h) for awareness
 * - Any failed job (so the learner knows there was a problem)
 */
function relevantJobs(jobs: NextLessonJob[]): NextLessonJob[] {
  const now = Date.now();
  return jobs.filter((j) => {
    if (j.adapter === "noop") return false;
    if (j.status === "pending" || j.status === "dispatched") return true;
    if (j.status === "failed") return true;
    if (j.status === "completed" && j.completed_at) {
      return now - new Date(j.completed_at).getTime() < 86_400_000;
    }
    return false;
  });
}

export function SubjectJobProgress({ jobs }: Props) {
  const visible = relevantJobs(jobs);
  if (visible.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {visible.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  );
}

function JobRow({ job }: { job: NextLessonJob }) {
  const statusColor = STATUS_COLORS[job.status] ?? "bg-gray-50 text-gray-600 border-gray-200";
  const triggerLabel = TRIGGER_LABEL[job.trigger_event] ?? job.trigger_event;
  const when = timeAgo(job.dispatched_at ?? job.created_at);

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${statusColor}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={job.status} />
          <span className="font-medium truncate">{triggerLabel}</span>
          {job.adapter && job.adapter !== "noop" && (
            <span className="text-xs opacity-60 shrink-0">via {job.adapter}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs opacity-70">
          {STATUS_LABEL[job.status] ?? job.status}
          {when && <span>{when}</span>}
        </div>
      </div>

      {/* Output lesson link for local-queue synchronous jobs */}
      {job.output_lesson_id != null && job.status !== "failed" && (
        <div className="mt-2">
          <a
            href={`/lessons/${job.output_lesson_id}`}
            className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            Open lesson &#8594;
          </a>
        </div>
      )}

      {/* Harness stage progress */}
      {job.harness_stage && (
        <div className="mt-1 text-xs opacity-70">
          Stage: {job.harness_stage}
        </div>
      )}

      {/* Error detail */}
      {job.status === "failed" && (job.last_error_detail ?? job.error) && (
        <div className="mt-2 text-xs opacity-80 break-words">
          {job.last_error_detail ?? job.error}
        </div>
      )}

      {/* Dora-task ref link (for frankavo users who can check the Doramon dashboard) */}
      {job.adapter === "dora-task" && job.adapter_ref && job.status === "dispatched" && (
        <div className="mt-1 text-xs opacity-60">
          Task: {job.adapter_ref}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "dispatched" || status === "pending") {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-current opacity-80 animate-pulse shrink-0"
        aria-label="in progress"
      />
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-current opacity-80 shrink-0" aria-label="done" />
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-current opacity-80 shrink-0" aria-label="failed" />
    );
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-current opacity-40 shrink-0" />;
}
