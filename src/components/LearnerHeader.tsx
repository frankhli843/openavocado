"use client";

const GEMMA4_URL = "https://deepmind.google/models/gemma/gemma-4/";

interface LearnerHeaderProps {
  name: string;
}

export function LearnerHeader({ name }: LearnerHeaderProps) {
  return (
    <div className="mb-8 pb-6 border-b border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {name}&apos;s Learning Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your subjects, lessons, and mastery progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={GEMMA4_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 transition-colors"
          >
            Powered by Gemma 4
          </a>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Active
          </span>
        </div>
      </div>
    </div>
  );
}
