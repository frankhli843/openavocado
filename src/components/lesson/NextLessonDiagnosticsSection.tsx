"use client";

import type { NextLessonDiagnostic } from "@/lib/lesson-content/schema";

interface NextLessonDiagnosticsSectionProps {
  diagnostics: NextLessonDiagnostic[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * End-of-lesson freeform diagnostics. These ask what felt unclear, what the
 * learner wants next, their confidence/effort, and a practical objective. The
 * answers autosave and feed next-lesson planning + tag/mastery assessment, but
 * answering them never completes the lesson — only the Mark Complete button does.
 */
export function NextLessonDiagnosticsSection({
  diagnostics,
  answers,
  onChange,
  disabled,
}: NextLessonDiagnosticsSectionProps) {
  function set(id: string, value: string) {
    onChange({ ...answers, [id]: value });
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
        <span className="text-xl" aria-hidden="true">&#128173;</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Before you finish
          </div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
            Help shape your next lesson
          </h2>
        </div>
      </div>

      <div className="space-y-5 px-3 py-4 sm:p-6">
        <p className="text-xs text-gray-500 leading-relaxed">
          These quick reflections guide what comes next. They save automatically and
          do <strong>not</strong> complete the lesson — use Mark Complete for that.
        </p>
        {diagnostics.map((d) => (
          <label key={d.id} className="block">
            <span className="text-sm font-medium text-gray-800 leading-relaxed">{d.prompt}</span>
            {d.hint && <span className="mt-0.5 block text-xs text-gray-400">{d.hint}</span>}
            <textarea
              value={answers[d.id] ?? ""}
              onChange={(e) => set(d.id, e.target.value)}
              disabled={disabled}
              rows={2}
              placeholder="Your answer…"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y disabled:bg-gray-50 disabled:text-gray-400"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
