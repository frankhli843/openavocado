"use client";

import { useEffect, useState, type ReactNode } from "react";

interface CollapsibleLessonSectionProps {
  id: string;
  kind: string;
  title: string;
  done: boolean;
  onDoneChange: (done: boolean) => void;
  children: ReactNode;
}

export function CollapsibleLessonSection({
  id,
  kind,
  title,
  done,
  onDoneChange,
  children,
}: CollapsibleLessonSectionProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [id]);

  function toggleDone() {
    const nextDone = !done;
    onDoneChange(nextDone);
    if (nextDone) setOpen(false);
  }

  return (
    <section id={id} className="scroll-mt-24 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-gray-50/60 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span className="text-base text-gray-500" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{kind}</div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 truncate">
              {done && <span className="text-green-600" aria-hidden="true">✓</span>}
              <span className="truncate">{title}</span>
            </h2>
          </div>
        </button>
      </div>
      {open && (
        <div className="p-0">
          {children}
          <div className="flex justify-end border-t border-gray-100 bg-gray-50/50 px-4 py-3">
            <button
              type="button"
              onClick={toggleDone}
              className={`shrink-0 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                done
                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
              }`}
              aria-pressed={done}
            >
              {done ? "Done" : "Mark section done"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
