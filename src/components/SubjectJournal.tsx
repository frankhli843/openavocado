"use client";

import { useEffect, useState } from "react";
import type { SubjectJournalEntry } from "@/types";

interface SubjectJournalProps {
  subjectId: number;
  learnerId: number;
}

export function SubjectJournal({ subjectId, learnerId }: SubjectJournalProps) {
  const [entries, setEntries] = useState<SubjectJournalEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(beforeId?: number | null) {
    const isMore = Boolean(beforeId);
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        learner_id: String(learnerId),
        limit: "10",
      });
      if (beforeId) params.set("before_id", String(beforeId));
      const res = await fetch(`/api/subjects/${subjectId}/journal?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        entries: SubjectJournalEntry[];
        next_cursor: number | null;
      };
      setEntries((prev) => (isMore ? [...prev, ...json.entries] : json.entries));
      setNextCursor(json.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journal");
    } finally {
      if (isMore) setLoadingMore(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, learnerId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-400">
        Loading journal...
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
        Could not load journal: {error}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-gray-900">AI journal</h2>
        <p className="mt-1 text-xs text-gray-400">
          Append-only planning, research, and lesson-generation log for this subject.
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {entries.length === 0 ? (
          <p className="px-4 py-5 text-sm text-gray-500 sm:px-5">
            No journal entries yet. Completing lessons and future generation tasks will create entries here.
          </p>
        ) : (
          entries.map((entry, index) => (
            <article key={entry.id} className="px-4 py-4 sm:px-5">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {index === 0 && (
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                      Latest
                    </div>
                  )}
                  <h3 className="break-words text-sm font-semibold text-gray-900">{entry.title}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {entry.entry_type.replace("_", " ")}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                <span>{new Date(entry.created_at).toLocaleString()}</span>
                {entry.created_by && <span>by {entry.created_by}</span>}
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-gray-700">
                {entry.content}
              </pre>
            </article>
          ))
        )}
      </div>
      {(nextCursor || error) && (
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:px-5">
          {error ? <span className="text-xs text-red-600">{error}</span> : <span />}
          {nextCursor && (
            <button
              onClick={() => load(nextCursor)}
              disabled={loadingMore}
              className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              {loadingMore ? "Loading..." : "Load older"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
