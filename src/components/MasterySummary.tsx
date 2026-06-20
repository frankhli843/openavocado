"use client";

import type { SubjectMastery } from "@/types";
import { Sparkline, scoreColor } from "./MasteryScore";

const SIGNAL_LABELS: Array<{ key: keyof SubjectMastery["signal_counts"]; label: string; cls: string }> = [
  { key: "strength", label: "Strengths", cls: "text-green-700 bg-green-50" },
  { key: "ready_to_advance", label: "Ready to advance", cls: "text-blue-700 bg-blue-50" },
  { key: "review_needed", label: "Review needed", cls: "text-yellow-700 bg-yellow-50" },
  { key: "weak_spot", label: "Weak spots", cls: "text-orange-700 bg-orange-50" },
  { key: "misconception", label: "Misconceptions", cls: "text-red-700 bg-red-50" },
];

/**
 * Detailed per-subject mastery panel: the score, its trend, an explanation of
 * what it means, a history sparkline, and the qualitative signal breakdown.
 */
export function MasterySummary({ mastery }: { mastery?: SubjectMastery }) {
  if (!mastery || mastery.score === null) {
    return (
      <div className="rounded-xl border border-gray-200 p-5 mb-6 text-sm text-gray-500">
        {mastery?.explanation ?? "No mastery data yet."}
      </div>
    );
  }
  const color = scoreColor(mastery.score);

  return (
    <div className="rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-start gap-5">
        {/* Score dial */}
        <div className="shrink-0 text-center">
          <div className="text-3xl font-bold tabular-nums leading-none" style={{ color }}>
            {mastery.score}
            <span className="text-base font-semibold">%</span>
          </div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wider mt-1">mastery</div>
          <div className="mt-2 flex justify-center">
            <Sparkline values={mastery.history} color={color} />
          </div>
        </div>

        {/* Explanation + signals */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-600 leading-relaxed">{mastery.explanation}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SIGNAL_LABELS.map(({ key, label, cls }) => {
              const n = mastery.signal_counts[key];
              if (!n) return null;
              return (
                <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
                  {label} <span className="tabular-nums">{n}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
