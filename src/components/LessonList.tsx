"use client";

import Link from "next/link";
import type { Lesson, NextLessonJob } from "@/types";

interface LessonListProps {
  completed: Lesson[];
  active: Lesson[];
  queued: Lesson[];
  discarded?: Lesson[];
  /** Recent next_lesson_jobs for this subject — used to show honest pending/failed state. */
  nextLessonJobs?: NextLessonJob[];
}

export function LessonList({
  completed,
  active,
  queued,
  discarded = [],
  nextLessonJobs = [],
}: LessonListProps) {
  const isEmpty =
    completed.length === 0 &&
    active.length === 0 &&
    queued.length === 0 &&
    discarded.length === 0;
  return (
    <div className="space-y-8">
      {/* In Progress */}
      {active.length > 0 && (
        <Section title="In Progress">
          {active.map((l) => <LessonRow key={l.id} lesson={l} />)}
        </Section>
      )}

      {/* Queued */}
      {queued.length > 0 && (
        <Section title="Queued">
          {queued.map((l) => <LessonRow key={l.id} lesson={l} />)}
        </Section>
      )}

      {/* Replacement requested */}
      {discarded.length > 0 && (
        <Section title="Replacement requested">
          <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 mb-2">
            The lesson generator has been asked to create a replacement for the discarded lesson below.
            A new lesson will appear in the Queued section when ready.
          </div>
          {discarded.map((l) => <LessonRow key={l.id} lesson={l} />)}
        </Section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <Section title="Completed">
          {completed.map((l) => <LessonRow key={l.id} lesson={l} />)}
        </Section>
      )}

      {isEmpty && <EmptyLessonsState jobs={nextLessonJobs} />}
    </div>
  );
}

function EmptyLessonsState({ jobs }: { jobs: NextLessonJob[] }) {
  const subjectCreatedJobs = jobs.filter((j) => j.trigger_event === "subject.created");
  const pendingOrDispatched = subjectCreatedJobs.some(
    (j) => j.status === "pending" || j.status === "dispatched"
  );
  const failed = subjectCreatedJobs.some((j) => j.status === "failed");
  const failedJob = subjectCreatedJobs.find((j) => j.status === "failed");

  if (pendingOrDispatched) {
    return (
      <div className="py-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-sm">
          <span className="block w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
          Your first lesson is being prepared. Refresh in a moment.
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="py-10 text-center">
        <div className="inline-flex flex-col items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-sm max-w-sm mx-auto">
          <span className="font-medium">Lesson generation failed</span>
          {failedJob?.error && (
            <span className="text-xs text-amber-600 font-mono break-all">{failedJob.error}</span>
          )}
          <span className="text-xs text-amber-600 mt-1">
            Check the server configuration (AVOCADOCORE_COMPLETION_ADAPTER) and try creating the subject again.
          </span>
        </div>
      </div>
    );
  }

  // No job at all or noop — generic message
  return (
    <div className="py-12 text-center text-gray-400 text-sm">
      No lessons yet. A lesson will appear here once the lesson generator runs.
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function LessonRow({ lesson }: { lesson: Lesson }) {
  const goals: string[] = lesson.goals ? JSON.parse(lesson.goals) : [];
  const tags: string[] = lesson.tags ? JSON.parse(lesson.tags) : [];

  const statusDot: Record<string, string> = {
    completed: "bg-green-500",
    in_progress: "bg-blue-500 animate-pulse",
    queued: "bg-gray-300",
    skipped: "bg-gray-200",
    discarded: "bg-amber-400",
  };

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className="flex items-start gap-3 p-4 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
    >
      {/* Status indicator */}
      <div className="mt-1.5 shrink-0">
        <span className={`block w-2 h-2 rounded-full ${statusDot[lesson.status] ?? "bg-gray-300"}`} />
      </div>

      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-gray-900 text-sm group-hover:text-blue-700 transition-colors">
            {lesson.sequence_number ? `${lesson.sequence_number}. ` : ""}
            {lesson.title}
          </h4>
          {lesson.completed_at && (
            <span className="shrink-0 text-xs text-gray-400">
              {new Date(lesson.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Description */}
        {lesson.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{lesson.description}</p>
        )}

        {/* Goals preview */}
        {goals.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {goals.slice(0, 2).map((g, i) => (
              <li key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                <span className="text-gray-300">&#9679;</span>
                {g}
              </li>
            ))}
          </ul>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 4).map((t) => (
              <span key={t} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Arrow */}
      <span className="shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors mt-1">
        &#8250;
      </span>
    </Link>
  );
}
