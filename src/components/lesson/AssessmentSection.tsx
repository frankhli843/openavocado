"use client";

import type { LessonActivity } from "@/types";

interface Question {
  id: string;
  text: string;
  type: "free_text" | "numeric" | "multiple_choice";
  options?: string[];
  hint?: string;
}

interface AssessmentSectionProps {
  activity: LessonActivity;
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}

export function AssessmentSection({ activity, answers, onChange }: AssessmentSectionProps) {
  const content: { questions?: Question[] } = activity.content
    ? JSON.parse(activity.content)
    : {};

  const questions: Question[] = content.questions ?? [];

  function handleChange(questionId: string, value: string) {
    const updated = { ...answers, [questionId]: value };
    onChange(updated);
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
        <span className="text-xl" aria-hidden="true">&#128221;</span>
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Assessment</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
            {activity.title ?? "Assessment Questions"}
          </h2>
        </div>
      </div>

      <div className="space-y-6 px-3 py-4 sm:p-6">
        {/* Clarification: submitting answers != completing the lesson */}
        <div className="border-l-2 border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-600">
          Answer the questions below. Your answers autosave as you type.
          Answering does not complete the lesson — use &quot;Mark Complete&quot; when you&apos;re done with the whole lesson.
        </div>

        {questions.map((q, index) => (
          <div key={q.id} className="space-y-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-800">
                {index + 1}. {q.text}
              </span>
              {q.hint && (
                <span className="block text-xs text-gray-400 mt-0.5">{q.hint}</span>
              )}
            </label>

            {q.type === "multiple_choice" && q.options ? (
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors text-sm"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => handleChange(q.id, opt)}
                      className="accent-blue-600"
                    />
                    <span className="text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors leading-relaxed"
                rows={q.type === "numeric" ? 2 : 4}
                value={answers[q.id] ?? ""}
                onChange={(e) => handleChange(q.id, e.target.value)}
                placeholder={
                  q.type === "numeric"
                    ? "Enter your numerical answer..."
                    : "Write your answer here..."
                }
              />
            )}
          </div>
        ))}

        {questions.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">
            No assessment questions yet.
          </div>
        )}
      </div>
    </div>
  );
}
