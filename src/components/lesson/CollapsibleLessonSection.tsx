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
            <h2 className="text-sm font-semibold text-gray-800 truncate">{title}</h2>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onDoneChange(!done)}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            done
              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-800"
          }`}
          aria-pressed={done}
        >
          {done ? "✓ Done" : "Mark done"}
        </button>
      </div>
      {open && <div className="p-0">{children}</div>}
    </section>
  );
}
