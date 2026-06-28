"use client";

import { useEffect, useState } from "react";
import type { SubjectWorkpad } from "@/types";

interface SubjectAgentNotesProps {
  subjectId: number;
  learnerId: number;
}

export function SubjectAgentNotes({ subjectId, learnerId }: SubjectAgentNotesProps) {
  const [workpad, setWorkpad] = useState<SubjectWorkpad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/subjects/${subjectId}/workpad?learner_id=${learnerId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { workpad: SubjectWorkpad };
        if (!cancelled) setWorkpad(json.workpad);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load notes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [subjectId, learnerId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-400">
        Loading agent notes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
        Could not load agent notes: {error}
      </div>
    );
  }

  const content = workpad?.content.trim();

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Agent notes</h2>
          {workpad && (
            <span className="text-xs text-gray-400">
              v{workpad.version} | {new Date(workpad.updated_at).toLocaleString()}
            </span>
          )}
        </div>
        {workpad?.last_updated_by && (
          <p className="mt-1 text-xs text-gray-400">
            Last updated by {workpad.last_updated_by}
            {workpad.last_updated_for ? ` for ${workpad.last_updated_for.replace("_", " ")}` : ""}
          </p>
        )}
      </div>
      <div className="px-4 py-4 sm:px-5">
        {content ? (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 font-sans text-sm leading-6 text-gray-700">
            {content}
          </pre>
        ) : (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
            No subject workpad notes yet. Future lesson generation tasks will maintain the living plan here.
          </p>
        )}
      </div>
    </section>
  );
}
