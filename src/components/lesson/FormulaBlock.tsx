"use client";

import { useMemo } from "react";
import katex from "katex";
import type { ReadingBlock } from "@/types";

type FormulaReadingBlock = Extract<ReadingBlock, { type: "formula" }>;

interface FormulaBlockProps {
  block: FormulaReadingBlock;
}

export function FormulaBlock({ block }: FormulaBlockProps) {
  const { html, error } = useMemo(() => {
    try {
      return {
        html: katex.renderToString(block.latex.trim(), {
          displayMode: true,
          throwOnError: false,
          strict: "warn",
          trust: false,
          output: "html",
        }),
        error: null,
      };
    } catch (e) {
      return {
        html: "",
        error: e instanceof Error ? e.message : "Unable to render formula",
      };
    }
  }, [block.latex]);

  return (
    <div className="border-l-2 border-indigo-300 bg-indigo-50/50 px-3 py-3">
      <div className="overflow-x-auto rounded-md bg-white px-3 py-3 text-indigo-950">
        {html ? (
          <div
            className="min-w-max text-[0.98rem]"
            aria-label={`Formula: ${block.latex}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <code className="block whitespace-pre-wrap break-words text-sm text-indigo-950">{block.latex}</code>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs leading-5 text-amber-700">
          Formula renderer warning: {error}
        </p>
      )}
      <p className="mt-2 text-sm leading-6 text-gray-700">{block.plain_english}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {block.variables.map((variable) => (
          <div key={variable.symbol} className="border-t border-indigo-100 pt-2">
            <dt className="font-semibold text-indigo-900">
              <InlineFormula latex={variable.symbol} />
            </dt>
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

function InlineFormula({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: "warn",
        trust: false,
        output: "html",
      });
    } catch {
      return "";
    }
  }, [latex]);

  if (!html) {
    return <code>{latex}</code>;
  }

  return (
    <span
      aria-label={`Variable: ${latex}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
