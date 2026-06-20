"use client";

import { useMemo } from "react";
import type { LessonActivity } from "@/types";
import { WidgetHost } from "./widgets/WidgetHost";
import type { WidgetStateChange } from "./widgets/DeclarativeWidget";

interface InteractiveSectionProps {
  activity: LessonActivity;
  /** Restored widget state (control values) from autosave. */
  initialState?: Record<string, number>;
  /** Fired when the learner manipulates the widget. Never completes the lesson. */
  onStateChange?: (state: WidgetStateChange) => void;
}

export function InteractiveSection({ activity, initialState, onStateChange }: InteractiveSectionProps) {
  const parsed = useMemo(() => {
    if (!activity.content) return { spec: null as unknown, parseError: null as string | null };
    try {
      return { spec: JSON.parse(activity.content) as unknown, parseError: null };
    } catch (e) {
      return { spec: null, parseError: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }, [activity.content]);

  const instructions =
    parsed.spec && typeof parsed.spec === "object" && parsed.spec !== null
      ? (parsed.spec as { instructions?: string }).instructions
      : undefined;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xl" aria-hidden="true">&#129518;</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Interactive</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
            {activity.title ?? "Concept Explorer"}
          </h2>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {instructions && (
          <p className="text-sm text-gray-600 leading-relaxed">{instructions}</p>
        )}

        {parsed.parseError ? (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            <div className="font-semibold mb-1">This interactive widget could not be loaded</div>
            <p className="text-xs text-amber-700">Malformed widget content: {parsed.parseError}</p>
          </div>
        ) : (
          <WidgetHost spec={parsed.spec} initialState={initialState} onStateChange={onStateChange} />
        )}

        <p className="text-xs text-gray-400">
          Explore the controls above. Interacting with this widget saves your progress but never completes the lesson.
        </p>
      </div>
    </div>
  );
}
