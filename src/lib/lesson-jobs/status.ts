import type { NextLessonJob } from "@/types";

export interface JobProgressEvent {
  ts?: string;
  stage?: string;
  message?: string;
}

export interface JobProgressView {
  label: string;
  detail: string;
  stage: string;
  stageLabel: string;
  events: Array<{ ts: string | null; stage: string | null; message: string }>;
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
  remainingSeconds: number;
  percent: number;
  isActive: boolean;
  isDone: boolean;
  isFailed: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  "subject.created": "Starting subject",
  "lesson.completed": "Reading completion",
  "lesson.discarded": "Reading discard request",
  lesson_completed: "Reading completion",
  "mastery.updated": "Updating mastery",
  "provider.check": "Checking provider",
  researching: "Researching",
  planning: "Planning next lesson",
  authoring: "Authoring lesson",
  validating: "Validating lesson",
  "local.fixture": "Local fixture generation",
  generating_lesson: "Generating lesson",
  "lesson.generated": "Lesson ready",
  generating_audio: "Generating audio",
  "browser.verifying": "Verifying in browser",
  "qa.requested": "Waiting for QA",
  "qa.browser_check": "QA browser check",
  "qa.repair_needed": "QA repair needed",
  "qa.passed": "QA passed",
  "qa.failed": "QA failed",
  "repairing": "Repairing lesson",
  finalizing: "Finalizing",
  completed: "Done",
  failed: "Needs attention",
};

const STAGE_OFFSETS: Record<string, number> = {
  queued: 0,
  "subject.created": 5,
  "lesson.completed": 5,
  "lesson.discarded": 5,
  lesson_completed: 5,
  "mastery.updated": 20,
  "provider.check": 25,
  researching: 45,
  planning: 35,
  authoring: 75,
  validating: 120,
  "local.fixture": 60,
  generating_lesson: 65,
  "lesson.generated": 130,
  generating_audio: 145,
  "browser.verifying": 165,
  "qa.requested": 170,
  "qa.browser_check": 175,
  "qa.repair_needed": 175,
  "qa.passed": 178,
  "qa.failed": 180,
  repairing: 175,
  finalizing: 175,
  completed: 180,
  failed: 180,
};

const DEFAULT_TOTAL_SECONDS: Record<string, number> = {
  "subject.created": 75,
  "lesson.completed": 180,
  "lesson.discarded": 150,
};

export function parseJobProgressEvents(raw: string | null | undefined): JobProgressView["events"] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as JobProgressEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((event) => ({
        ts: typeof event.ts === "string" ? event.ts : null,
        stage: typeof event.stage === "string" ? event.stage : null,
        message:
          typeof event.message === "string" && event.message.trim()
            ? event.message.trim()
            : event.stage
            ? labelForStage(event.stage)
            : "Progress updated",
      }))
      .filter((event) => event.message.length > 0);
  } catch {
    return [];
  }
}

export function summarizeJobProgress(job: NextLessonJob, nowMs = Date.now()): JobProgressView {
  const events = [
    ...parseJobProgressEvents(job.progress_events),
    ...parseJobProgressEvents(job.qa_events),
  ];
  const lastEvent = [...events].reverse().find((event) => event.stage || event.message);
  const stage =
    job.qa_stage ||
    job.harness_stage ||
    lastEvent?.stage ||
    (job.status === "completed" ? "completed" : job.status === "failed" ? "failed" : "queued");
  const startedAt = job.dispatched_at || job.created_at;
  const finishedAt = job.completed_at;
  const elapsedSeconds = secondsBetween(startedAt, finishedAt || nowMs);
  const estimatedTotalSeconds = estimateTotalSeconds(job, stage);
  const stageOffset = STAGE_OFFSETS[stage] ?? Math.min(elapsedSeconds, estimatedTotalSeconds * 0.85);
  const effectiveElapsed = Math.max(elapsedSeconds, stageOffset);
  const isDone = job.status === "completed";
  const isFailed = job.status === "failed";
  const remainingSeconds = isDone || isFailed ? 0 : Math.max(0, estimatedTotalSeconds - effectiveElapsed);
  const percent = isDone
    ? 100
    : isFailed
    ? Math.min(100, Math.max(5, Math.round((effectiveElapsed / estimatedTotalSeconds) * 100)))
    : Math.min(95, Math.max(5, Math.round((effectiveElapsed / estimatedTotalSeconds) * 100)));
  return {
    label: triggerLabel(job.trigger_event),
    detail: detailFor(job, stage, remainingSeconds),
    stage,
    stageLabel: labelForStage(stage),
    events,
    elapsedSeconds,
    estimatedTotalSeconds,
    remainingSeconds,
    percent,
    isActive: job.status === "pending" || job.status === "dispatched",
    isDone,
    isFailed,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "now";
  if (seconds < 60) return `${Math.max(5, Math.ceil(seconds / 5) * 5)}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function labelForStage(stage: string): string {
  return STAGE_LABELS[stage] ?? titleCase(stage.replace(/[._-]+/g, " "));
}

function estimateTotalSeconds(job: NextLessonJob, stage: string): number {
  const base = DEFAULT_TOTAL_SECONDS[job.trigger_event] ?? 180;
  const stageFloor = (STAGE_OFFSETS[stage] ?? 0) + 15;
  if (job.adapter === "dora-task") return Math.max(base, stageFloor, 20 * 60);
  if (job.adapter === "agent-harness") return Math.max(base, stageFloor, 15 * 60);
  if (job.adapter === "webhook") return Math.max(base, stageFloor, 5 * 60);
  return Math.max(base, stageFloor);
}

function triggerLabel(trigger: NextLessonJob["trigger_event"]): string {
  if (trigger === "subject.created") return "Initial lesson generation";
  if (trigger === "lesson.discarded") return "Replacement lesson generation";
  return "Next lesson generation";
}

function detailFor(job: NextLessonJob, stage: string, remainingSeconds: number): string {
  if (job.status === "failed") return job.last_error_detail || job.error || "Generation failed";
  if (job.status === "completed") return "Ready to open";
  return `${labelForStage(stage)}. About ${formatDuration(remainingSeconds)} left.`;
}

function secondsBetween(start: string | null | undefined, end: string | number): number {
  if (!start) return 0;
  const startMs = new Date(start).getTime();
  const endMs = typeof end === "number" ? end : new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
