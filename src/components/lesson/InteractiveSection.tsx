"use client";

import type { LessonActivity } from "@/types";

interface InteractiveSectionProps {
  activity: LessonActivity;
}

export function InteractiveSection({ activity }: InteractiveSectionProps) {
  const content: { spec?: string; description?: string } = activity.content
    ? JSON.parse(activity.content)
    : {};

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xl" aria-hidden="true">&#129531;</span>
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Interactive</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
            {activity.title ?? "Concept Visualization"}
          </h2>
        </div>
      </div>

      <div className="p-6">
        {content.description && (
          <p className="text-sm text-gray-600 mb-4">{content.description}</p>
        )}

        {/* Placeholder for interactive widget */}
        <div className="h-48 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2">&#129531;</div>
            <div className="text-sm font-medium">Interactive widget</div>
            <div className="text-xs mt-1">
              {content.spec ?? "Visualization spec not yet generated"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
