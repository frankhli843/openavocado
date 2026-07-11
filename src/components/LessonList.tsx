"use client";

import Link from "next/link";
import type { Lesson } from "@/types";

interface LessonListProps {
  completed: Lesson[];
  active: Lesson[];
  queued: Lesson[];
  discarded?: Lesson[];
}

export function LessonList({ completed, active, queued, discarded = [] }: LessonListProps) {
  const isEmpty = completed.length === 0 && active.length === 0 && queued.length === 0 && discarded.length === 0;
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

      {isEmpty && (
        <div className="py-12 text-center text-gray-400 text-sm">
          No lessons yet. A lesson will be queued when a next-lesson task runs.
        </div>
      )}
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
  const pendingVideo = lesson.status === "queued" && lesson.video_status === "pending_video";

  const statusDot: Record<string, string> = {
    completed: "bg-green-500",
    in_progress: "bg-blue-500 animate-pulse",
    queued: "bg-gray-300",
    skipped: "bg-gray-200",
    discarded: "bg-amber-400",
  };

  return (
    <Link
      href={`/lessons/${lesson.id}#lesson-toc`}
      prefetch
      className="flex items-start gap-3 p-4 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
    >
      {/* Status indicator */}
      <div className="mt-1.5 shrink-0">
        <span
          className={`block w-2 h-2 rounded-full ${
            pendingVideo ? "bg-violet-400 animate-pulse" : statusDot[lesson.status] ?? "bg-gray-300"
          }`}
        />
      </div>

      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-gray-900 text-sm group-hover:text-blue-700 transition-colors">
            {lesson.sequence_number ? `${lesson.sequence_number}. ` : ""}
            {lesson.title}
          </h4>
          {pendingVideo && (
            <span className="shrink-0 px-1.5 py-0.5 text-xs bg-violet-50 text-violet-600 border border-violet-100 rounded">
              Preparing videos
            </span>
          )}
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
