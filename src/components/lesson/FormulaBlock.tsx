"use client";

import { useMemo } from "react";
import katex from "katex";
import type { ReadingBlock } from "@/types";

type FormulaReadingBlock = Extract<ReadingBlock, { type: "formula" }>;

interface FormulaBlockProps {
  block: FormulaReadingBlock;
}

export function FormulaBlock({ block }: FormulaBlockProps) {
  const { latex, html, error } = useMemo(() => {
    const latex = normalizeFormulaLatex(block.latex.trim());
    try {
      const rendered = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        strict: "warn",
        trust: false,
        output: "html",
      });
      return {
        latex,
        html: rendered.includes("katex-error") ? "" : rendered,
        error: null,
      };
    } catch (e) {
      return {
        latex,
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
            aria-label={`Formula: ${latex}`}
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

function normalizeFormulaLatex(formula: string) {
  return stripUnsupportedLatexHighlights(formula)
    .replace(/\s*·\s*/g, " \\cdot ")
    .replace(/\bsqrt\s*\(([^()]+)\)/g, "\\sqrt{$1}");
}

function stripUnsupportedLatexHighlights(formula: string) {
  let out = formula;
  let previous = "";
  while (out !== previous) {
    previous = out;
    out = unwrapLatexCommandWithTwoBraceArgs(out, "\\colorbox");
    out = unwrapLatexCommandWithTwoBraceArgs(out, "\\fcolorbox");
    out = unwrapLatexCommandWithOptionalArg(out, "\\bbox");
  }
  return out;
}

function unwrapLatexCommandWithTwoBraceArgs(source: string, command: string) {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const commandIndex = source.indexOf(command, index);
    if (commandIndex < 0) {
      out += source.slice(index);
      break;
    }
    out += source.slice(index, commandIndex);
    const first = readBraceGroup(source, commandIndex + command.length);
    if (!first) {
      out += source.slice(commandIndex, commandIndex + command.length);
      index = commandIndex + command.length;
      continue;
    }
    const second = readBraceGroup(source, first.end);
    if (!second) {
      out += source.slice(commandIndex, first.end);
      index = first.end;
      continue;
    }
    out += second.body;
    index = second.end;
  }
  return out;
}

function unwrapLatexCommandWithOptionalArg(source: string, command: string) {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const commandIndex = source.indexOf(command, index);
    if (commandIndex < 0) {
      out += source.slice(index);
      break;
    }
    out += source.slice(index, commandIndex);
    let cursor = commandIndex + command.length;
    if (source[cursor] === "[") {
      const optional = readDelimitedGroup(source, cursor, "[", "]");
      if (optional) cursor = optional.end;
    }
    const body = readBraceGroup(source, cursor);
    if (!body) {
      out += source.slice(commandIndex, cursor);
      index = cursor;
      continue;
    }
    out += body.body;
    index = body.end;
  }
  return out;
}

function readBraceGroup(source: string, start: number) {
  return readDelimitedGroup(source, start, "{", "}");
}

function readDelimitedGroup(source: string, start: number, open: string, close: string) {
  let cursor = start;
  while (/\s/.test(source[cursor] ?? "")) cursor += 1;
  if (source[cursor] !== open) return null;
  let depth = 0;
  for (let i = cursor; i < source.length; i++) {
    const char = source[i];
    const escaped = i > 0 && source[i - 1] === "\\";
    if (!escaped && char === open) depth += 1;
    if (!escaped && char === close) depth -= 1;
    if (depth === 0) {
      return { body: source.slice(cursor + 1, i), end: i + 1 };
    }
  }
  return null;
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
