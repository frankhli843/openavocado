"use client";

import Link from "next/link";
import type { SubjectSummary } from "@/types";

interface SubjectCardProps {
  subject: SubjectSummary;
}

const LEVEL_COLORS = {
  familiarity: "bg-blue-50 text-blue-700 border-blue-100",
  competence: "bg-purple-50 text-purple-700 border-purple-100",
  mastery: "bg-green-50 text-green-700 border-green-100",
} as const;

export function SubjectCard({ subject }: SubjectCardProps) {
  const completionPct =
    subject.lesson_count > 0
      ? Math.round((subject.completed_count / subject.lesson_count) * 100)
      : 0;

  const masteryPct =
    subject.latest_mastery !== null ? Math.round(subject.latest_mastery) : null;

  return (
    <Link
      href={`/subjects/${subject.id}`}
      className="block p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-blue-700 transition-colors">
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
        {masteryPct !== null && (
          <span>
            <span className="font-medium text-gray-700">{masteryPct}%</span> mastery
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
  );
}
