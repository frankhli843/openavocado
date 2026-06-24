"use client";

import { useMemo, type ReactNode } from "react";
import type { GeneratedArtifact, LessonActivity, ReadingBlock } from "@/types";
import type { LessonPartContent } from "@/lib/lesson-content/schema";
import type { WidgetStateChange } from "./widgets/DeclarativeWidget";
import { WidgetHost } from "./widgets/WidgetHost";
import {
  MultipleChoiceAssessmentSection,
  type QuizAssessContext,
} from "./MultipleChoiceAssessmentSection";

interface LessonPartSectionProps {
  activity: LessonActivity;
  artifact?: GeneratedArtifact;
  initialWidgetState?: Record<string, number>;
  onWidgetStateChange?: (state: WidgetStateChange) => void;
  savedQuizState: string | null;
  onQuizStateChange: (serialized: string) => void;
  onQuizPassedChange: (passed: boolean) => void;
  assessContext?: QuizAssessContext | null;
}

export function LessonPartSection({
  activity,
  artifact,
  initialWidgetState,
  onWidgetStateChange,
  savedQuizState,
  onQuizStateChange,
  onQuizPassedChange,
  assessContext,
}: LessonPartSectionProps) {
  const parsed = useMemo(() => {
    if (!activity.content) return { part: null, error: "No lesson-part content" };
    try {
      return { part: JSON.parse(activity.content) as LessonPartContent, error: null };
    } catch (e) {
      return { part: null, error: e instanceof Error ? e.message : "Invalid lesson-part JSON" };
    }
  }, [activity.content]);

  const part = parsed.part;

  return (
    <div className="p-6 space-y-6">
      {parsed.error || !part ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <div className="font-semibold mb-1">This lesson part could not be loaded</div>
          <p className="text-xs text-amber-700">{parsed.error}</p>
        </div>
      ) : (
        <>
          <PartBlock title="Written explanation">
            <article className="space-y-4">
              {part.reading.intro && (
                <p className="text-[15px] text-gray-700 leading-7">{part.reading.intro}</p>
              )}
              {part.reading.blocks.map((block, i) => (
                <ReadingBlockView key={i} block={block} />
              ))}
              {part.reading.summary && (
                <div className="rounded-lg bg-green-50/70 border border-green-100 px-4 py-3">
                  <div className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">
                    In short
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{part.reading.summary}</p>
                </div>
              )}
            </article>
          </PartBlock>

          <PartBlock title="Audio">
            {artifact?.file_path ? (
              <div className="space-y-2">
                <audio controls className="w-full h-10" src={`/runtime/${artifact.file_path}`}>
                  Your browser does not support audio playback.
                </audio>
                <div className="text-xs text-gray-400">
                  {artifact.voice ? `Voice: ${artifact.voice}` : "Generated audio"}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                Part audio artifact is not generated yet. The script below is the per-part audio source.
              </div>
            )}
            <div className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-56 overflow-y-auto">
              {part.audio.script}
            </div>
          </PartBlock>

          <PartBlock title="Interactive">
            <p className="text-sm text-gray-600 leading-relaxed">
              {(part.interactive as { instructions?: string }).instructions}
            </p>
            <WidgetHost
              spec={part.interactive}
              initialState={initialWidgetState}
              onStateChange={onWidgetStateChange}
            />
          </PartBlock>

          <MultipleChoiceAssessmentSection
            activity={activity}
            savedQuizState={savedQuizState}
            onStateChange={onQuizStateChange}
            onPassedChange={onQuizPassedChange}
            assessContext={assessContext ?? null}
          />
        </>
      )}
    </div>
  );
}

function PartBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</div>
      {children}
    </div>
  );
}

function ReadingBlockView({ block }: { block: ReadingBlock }) {
  switch (block.type) {
    case "heading":
      return <h3 className="text-base font-semibold text-gray-900 mt-5">{block.text}</h3>;
    case "paragraph":
      return <p className="text-[15px] text-gray-700 leading-7">{block.text}</p>;
    case "definition":
      return (
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3">
          <dt className="text-sm font-semibold text-gray-900">{block.term}</dt>
          <dd className="text-sm text-gray-600 leading-relaxed mt-0.5">{block.definition}</dd>
        </div>
      );
    case "example":
      return (
        <div className="rounded-lg border-l-4 border-blue-300 bg-blue-50/50 pl-4 pr-3 py-3">
          {block.title && <div className="text-xs font-semibold text-blue-700 mb-1">{block.title}</div>}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{block.body}</p>
        </div>
      );
    case "callout": {
      const tone = block.tone ?? "info";
      const styles: Record<string, string> = {
        info: "border-blue-200 bg-blue-50 text-blue-900",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
        insight: "border-purple-200 bg-purple-50 text-purple-900",
      };
      return (
        <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles[tone]}`}>
          {block.text}
        </div>
      );
    }
    case "list":
      return block.ordered ? (
        <ol className="list-decimal pl-5 space-y-1.5 text-[15px] text-gray-700 leading-7">
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ol>
      ) : (
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-gray-700 leading-7">
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    default:
      return null;
  }
}
