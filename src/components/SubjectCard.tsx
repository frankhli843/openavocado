"use client";

import Link from "next/link";
import type { SubjectSummary } from "@/types";
import { MasteryScore } from "./MasteryScore";

interface SubjectCardProps {
  subject: SubjectSummary;
  /** When provided, shows an archive/restore action on the card. */
  onArchiveToggle?: (subject: SubjectSummary) => void;
  busy?: boolean;
}

const LEVEL_COLORS = {
  familiarity: "bg-blue-50 text-blue-700 border-blue-100",
  competence: "bg-purple-50 text-purple-700 border-purple-100",
  mastery: "bg-green-50 text-green-700 border-green-100",
} as const;

export function SubjectCard({ subject, onArchiveToggle, busy }: SubjectCardProps) {
  const completionPct =
    subject.lesson_count > 0
      ? Math.round((subject.completed_count / subject.lesson_count) * 100)
      : 0;

  const isArchived = subject.status === "archived";

  return (
    <div className="relative p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group">
      <Link href={`/subjects/${subject.id}`} className="block">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="min-w-0 break-words font-semibold text-gray-900 text-base leading-snug group-hover:text-blue-700 transition-colors">
            {subject.title}
          </h3>
          <span
            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LEVEL_COLORS[subject.current_level]}`}
          >
            {subject.current_level}
          </span>
        </div>

        {/* Description */}
        {subject.description && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
            {subject.description}
          </p>
        )}

        {/* Mastery badge */}
        <div className="mb-3">
          <MasteryScore mastery={subject.mastery} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <span>
            <span className="font-medium text-gray-700">{subject.completed_count}</span>
            /{subject.lesson_count} lessons
          </span>
          {subject.queued_count > 0 && (
            <span>
              <span className="font-medium text-gray-700">{subject.queued_count}</span> queued
            </span>
          )}
          {subject.latest_assessment_score !== null && (
            <span>
              <span className="font-medium text-gray-700">
                {Math.round(subject.latest_assessment_score)}%
              </span>{" "}
              assessment
            </span>
          )}
        </div>

        {/* Progress bar */}
        {subject.lesson_count > 0 && (
          <div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-400 text-right">{completionPct}% complete</div>
          </div>
        )}
      </Link>

      {/* Archive / restore action (does not navigate) */}
      {onArchiveToggle && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onArchiveToggle(subject)}
          className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded px-1"
        >
          {busy ? "Working…" : isArchived ? "Restore subject" : "Archive subject"}
        </button>
      )}
    </div>
  );
}
