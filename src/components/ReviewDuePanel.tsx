"use client";

import type { ConceptReviewEvidence, ReviewPriorityBucket } from "@/lib/concept-evidence";

const BUCKET_STYLE: Record<ReviewPriorityBucket, { label: string; cls: string }> = {
  fresh_misconception: { label: "Misconception", cls: "text-red-700 bg-red-50 border-red-100" },
  stale_weak_spot: { label: "Weak spot", cls: "text-orange-700 bg-orange-50 border-orange-100" },
  untested_recently: { label: "Due for review", cls: "text-yellow-700 bg-yellow-50 border-yellow-100" },
  healthy: { label: "Solid", cls: "text-green-700 bg-green-50 border-green-100" },
};

/**
 * Learner-facing "what to review next and why" panel. Reads the resolution-aware
 * per-concept rollup so a weakness already cleared up by a later correct answer
 * is not resurfaced. Plain language, no jargon.
 */
export function ReviewDuePanel({ evidence }: { evidence?: ConceptReviewEvidence }) {
  if (!evidence || evidence.summary.total_concepts === 0) {
    return (
      <div className="rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800">Review queue</h3>
        <p className="mt-1 text-sm text-gray-500">
          Nothing to review yet. Complete a lesson and its assessment and your weak or stale concepts will show up here.
        </p>
      </div>
    );
  }

  const candidates = evidence.review_candidates;

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-800">What to review next</h3>
        <span className="text-xs text-gray-400 tabular-nums">
          {evidence.summary.unresolved_gap_count} unresolved of {evidence.summary.total_concepts} tracked
        </span>
      </div>

      {candidates.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">
          Everything you have been tested on is looking solid right now. Keep going and new concepts will surface here when they need a refresher.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {candidates.map((c, i) => {
            const style = BUCKET_STYLE[c.review_priority];
            return (
              <li key={`${c.concept}-${i}`} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style.cls}`}
                >
                  {style.label}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 break-words">{c.concept}</p>
                  <p className="text-xs text-gray-500 break-words">{c.reason}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        {evidence.summary.fresh_misconception > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
            {evidence.summary.fresh_misconception} misconception{evidence.summary.fresh_misconception === 1 ? "" : "s"}
          </span>
        )}
        {evidence.summary.stale_weak_spot > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 font-medium text-orange-700">
            {evidence.summary.stale_weak_spot} weak spot{evidence.summary.stale_weak_spot === 1 ? "" : "s"}
          </span>
        )}
        {evidence.summary.untested_recently > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 font-medium text-yellow-700">
            {evidence.summary.untested_recently} due for review
          </span>
        )}
        {evidence.summary.healthy > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">
            {evidence.summary.healthy} solid
          </span>
        )}
      </div>
    </div>
  );
}
