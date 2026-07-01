"use client";

import { useMemo } from "react";
import type { LessonActivity, ReadingContent, ReadingBlock } from "@/types";
import { validateReadingContent } from "@/lib/lesson-content/schema";
import { LessonDiagramsView } from "./LessonDiagrams";

interface ReadingSectionProps {
  activity: LessonActivity;
}

/**
 * First-class written lesson text. This is real teaching content — headings,
 * definitions, worked examples, callouts, lists, and a review summary — meant
 * to be studied, searched, and skimmed independently of the audio.
 *
 * Reading never triggers completion; it carries no progress state of its own.
 */
export function ReadingSection({ activity }: ReadingSectionProps) {
  const parsed = useMemo(() => {
    if (!activity.content) return { content: null, error: "No written content" };
    try {
      const c = JSON.parse(activity.content) as ReadingContent;
      const v = validateReadingContent(c);
      if (!v.valid) return { content: null, error: v.errors.join("; ") };
      return { content: c, error: null };
    } catch (e) {
      return { content: null, error: e instanceof Error ? e.message : "Invalid content" };
    }
  }, [activity.content]);

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
        <span className="text-xl" aria-hidden="true">&#128214;</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Written Lesson</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
            {activity.title ?? "Read the Concept"}
          </h2>
        </div>
      </div>

      <div className="px-3 py-4 sm:p-6">
        {parsed.error || !parsed.content ? (
          <div role="alert" className="border-l-2 border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <div className="font-semibold mb-1">Written content unavailable</div>
            <p className="text-xs text-amber-700">{parsed.error}</p>
          </div>
        ) : (
          <article className="prose-avocado max-w-none space-y-4">
            {parsed.content.intro && (
              <p className="text-[15px] text-gray-700 leading-7">{parsed.content.intro}</p>
            )}
            {parsed.content.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
            {parsed.content.diagrams && parsed.content.diagrams.length > 0 && (
              <LessonDiagramsView diagrams={parsed.content.diagrams} />
            )}
            {parsed.content.summary && (
              <div className="mt-6 rounded-lg bg-green-50/70 border border-green-100 px-4 py-3">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">
                  In short
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{parsed.content.summary}</p>
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}

function Block({ block }: { block: ReadingBlock }) {
  switch (block.type) {
    case "heading":
      return <h3 className="text-base font-semibold text-gray-900 mt-5">{block.text}</h3>;
    case "paragraph":
      return <p className="text-[15px] text-gray-700 leading-7">{block.text}</p>;
    case "text":
      return <p className="text-[15px] text-gray-700 leading-7">{block.content}</p>;
    case "formula":
      return <FormulaBlock block={block} />;
    case "definition":
      return (
        <div className="border-l-2 border-gray-200 bg-gray-50/60 px-3 py-3">
          <dt className="text-sm font-semibold text-gray-900">{block.term}</dt>
          <dd className="text-sm text-gray-600 leading-relaxed mt-0.5">{block.definition}</dd>
        </div>
      );
    case "example":
      return (
        <div className="border-l-2 border-blue-300 bg-blue-50/50 pl-3 pr-3 py-3">
          {block.title && <div className="text-xs font-semibold text-blue-700 mb-1">{block.title}</div>}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{block.body}</p>
        </div>
      );
    case "callout": {
      const tone = block.tone ?? "info";
      const styles: Record<string, string> = {
        info: "border-blue-300 bg-blue-50 text-blue-900",
        warning: "border-amber-300 bg-amber-50 text-amber-900",
        insight: "border-purple-300 bg-purple-50 text-purple-900",
      };
      return (
        <div className={`border-l-2 px-3 py-3 text-sm leading-relaxed ${styles[tone]}`}>
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

function FormulaBlock({
  block,
}: {
  block: Extract<ReadingBlock, { type: "formula" }>;
}) {
  return (
    <div className="border-l-2 border-indigo-300 bg-indigo-50/50 px-3 py-3">
      <div className="overflow-x-auto rounded-md bg-white px-3 py-2 font-mono text-sm text-indigo-950">
        {block.latex}
      </div>
      <p className="mt-2 text-sm leading-6 text-gray-700">{block.plain_english}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {block.variables.map((variable) => (
          <div key={variable.symbol} className="border-t border-indigo-100 pt-2">
            <dt className="font-mono font-semibold text-indigo-900">{variable.symbol}</dt>
            <dd className="text-gray-600">
              {variable.meaning}
              {variable.shape ? <span className="text-gray-400"> ({variable.shape})</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
