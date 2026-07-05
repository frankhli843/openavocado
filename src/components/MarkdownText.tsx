"use client";

import type { ReactNode } from "react";
import katex from "katex";

type InlineKind = "text" | "strong" | "em" | "code" | "link" | "math";

interface InlineToken {
  kind: InlineKind;
  text: string;
  href?: string;
}

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "codeblock"; lang: string; code: string }
  | { kind: "mathblock"; latex: string };

export function MarkdownText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, index) => {
        if (block.kind === "codeblock") {
          return (
            <pre key={index} className="overflow-x-auto rounded bg-black/10 p-3 font-mono text-[0.88em]">
              <code>{block.code}</code>
            </pre>
          );
        }
        if (block.kind === "mathblock") {
          return <DisplayMath key={index} latex={block.latex} />;
        }
        if (block.kind === "heading") {
          const className =
            block.level === 1
              ? "m-0 text-base font-semibold text-gray-950"
              : block.level === 2
                ? "m-0 pt-2 text-sm font-semibold text-gray-900"
                : "m-0 pt-1 text-sm font-medium text-gray-800";
          const Tag = `h${Math.min(block.level + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
          return <Tag key={index} className={className}>{renderInline(block.text)}</Tag>;
        }
        if (block.kind === "ul") {
          return (
            <ul key={index} className="m-0 list-disc space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={index} className="m-0 list-decimal space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={index} className="m-0">
            {renderInlineWithBreaks(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const paragraph: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph.length = 0;
  }

  function flushList() {
    if (!list) return;
    blocks.push({ kind: list.kind, items: list.items });
    list = null;
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    const fenceStart = line.match(/^```(\w*)$/);
    if (fenceStart) {
      flushParagraph();
      flushList();
      const lang = fenceStart[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trimEnd() !== "```") {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "codeblock", lang, code: codeLines.join("\n") });
      i++;
      continue;
    }

    const mathFenceStart = line.trim().match(/^\$\$\s*(.*)$/);
    if (mathFenceStart) {
      flushParagraph();
      flushList();
      const firstLine = mathFenceStart[1] ?? "";
      const mathLines: string[] = [];
      if (firstLine.trim().endsWith("$$")) {
        blocks.push({ kind: "mathblock", latex: firstLine.replace(/\s*\$\$\s*$/, "") });
        i++;
        continue;
      }
      if (firstLine.trim()) mathLines.push(firstLine);
      i++;
      while (i < lines.length && !lines[i].trim().endsWith("$$")) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        mathLines.push(lines[i].replace(/\s*\$\$\s*$/, ""));
        i++;
      }
      blocks.push({ kind: "mathblock", latex: mathLines.join("\n").trim() });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4,
        text: heading[2],
      });
      i++;
      continue;
    }

    const standaloneMath = line.trim().match(/^\$(.+)\$$/);
    if (standaloneMath && shouldRenderStandaloneMath(standaloneMath[1])) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "mathblock", latex: standaloneMath[1] });
      i++;
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (!list || list.kind !== "ul") {
        flushList();
        list = { kind: "ul", items: [] };
      }
      list.items.push(unordered[1]);
      i++;
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.kind !== "ol") {
        flushList();
        list = { kind: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      i++;
      continue;
    }

    flushList();
    paragraph.push(line);
    i++;
  }

  flushParagraph();
  flushList();

  if (blocks.length === 0 && text.length > 0) {
    blocks.push({ kind: "paragraph", text });
  }
  return blocks;
}

function renderInlineWithBreaks(text: string): ReactNode[] {
  return text.split("\n").flatMap((line, index) => {
    const nodes = renderInline(line, `line-${index}`);
    return index === 0 ? nodes : [<br key={`br-${index}`} />, ...nodes];
  });
}

function renderInline(text: string, keyPrefix = "inline"): ReactNode[] {
  const tokens = parseInline(text);
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.kind === "strong") return <strong key={key}>{renderInline(token.text, key)}</strong>;
    if (token.kind === "em") return <em key={key}>{renderInline(token.text, key)}</em>;
    if (token.kind === "code") {
      return (
        <code key={key} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.92em]">
          {token.text}
        </code>
      );
    }
    if (token.kind === "math") return <InlineMath key={key} latex={token.text} />;
    if (token.kind === "link" && token.href) {
      return (
        <a
          key={key}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2"
        >
          {renderInline(token.text, key)}
        </a>
      );
    }
    return token.text;
  });
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;

  function pushText(value: string) {
    if (!value) return;
    const last = tokens[tokens.length - 1];
    if (last?.kind === "text") last.text += value;
    else tokens.push({ kind: "text", text: value });
  }

  while (i < text.length) {
    if (text[i] === "[") {
      const closeLabel = text.indexOf("]", i + 1);
      const openHref = closeLabel >= 0 ? text.indexOf("(", closeLabel + 1) : -1;
      const closeHref = openHref >= 0 ? text.indexOf(")", openHref + 1) : -1;
      if (closeLabel > i + 1 && openHref === closeLabel + 1 && closeHref > openHref + 1) {
        const href = text.slice(openHref + 1, closeHref).trim();
        if (/^https?:\/\/[^\s)]+$/i.test(href)) {
          tokens.push({ kind: "link", text: text.slice(i + 1, closeLabel), href });
          i = closeHref + 1;
          continue;
        }
      }
    }

    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        tokens.push({ kind: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (text[i] === "$" && text[i + 1] !== "$") {
      const end = findClosingMathDollar(text, i + 1);
      if (end > i + 1) {
        tokens.push({ kind: "math", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (text.startsWith("**", i) || text.startsWith("__", i)) {
      const marker = text.slice(i, i + 2);
      const end = text.indexOf(marker, i + 2);
      if (end > i + 2) {
        tokens.push({ kind: "strong", text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === "*" || text[i] === "_") {
      const marker = text[i];
      if (text[i + 1] !== marker) {
        const end = text.indexOf(marker, i + 1);
        if (end > i + 1) {
          tokens.push({ kind: "em", text: text.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }
    }

    const nextSpecial = findNextSpecial(text, i + 1);
    pushText(text.slice(i, nextSpecial));
    i = nextSpecial;
  }

  return tokens;
}

function findNextSpecial(text: string, start: number): number {
  const indexes = ["`", "*", "_", "[", "$"]
    .map((marker) => text.indexOf(marker, start))
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : text.length;
}

function findClosingMathDollar(text: string, start: number): number {
  for (let index = start; index < text.length; index++) {
    if (text[index] === "$" && text[index - 1] !== "\\") return index;
  }
  return -1;
}

function shouldRenderStandaloneMath(latex: string): boolean {
  return /[=\\_^]/.test(latex) || latex.trim().length > 8;
}

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    const rendered = katex.renderToString(normalizeMathLatex(latex), {
      displayMode,
      throwOnError: false,
      strict: "warn",
      trust: false,
      output: "html",
    });
    return rendered.includes("katex-error") ? "" : rendered;
  } catch {
    return "";
  }
}

function normalizeMathLatex(latex: string): string {
  return stripUnsupportedLatexHighlights(latex.trim())
    .replace(/\s*·\s*/g, " \\cdot ")
    .replace(/\bsqrt\s*\(([^()]+)\)/g, "\\sqrt{$1}");
}

function stripUnsupportedLatexHighlights(latex: string): string {
  let out = latex;
  let previous = "";
  while (out !== previous) {
    previous = out;
    out = unwrapLatexCommandWithTwoBraceArgs(out, "\\colorbox");
    out = unwrapLatexCommandWithTwoBraceArgs(out, "\\fcolorbox");
    out = unwrapLatexCommandWithOptionalArg(out, "\\bbox");
  }
  return out;
}

function unwrapLatexCommandWithTwoBraceArgs(source: string, command: string): string {
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

function unwrapLatexCommandWithOptionalArg(source: string, command: string): string {
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
  for (let index = cursor; index < source.length; index++) {
    const char = source[index];
    const escaped = index > 0 && source[index - 1] === "\\";
    if (!escaped && char === open) depth += 1;
    if (!escaped && char === close) depth -= 1;
    if (depth === 0) {
      return { body: source.slice(cursor + 1, index), end: index + 1 };
    }
  }
  return null;
}

function InlineMath({ latex }: { latex: string }) {
  const html = renderKatex(latex, false);
  if (!html) return <code>{latex}</code>;
  return <span aria-label={`Formula: ${latex}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function DisplayMath({ latex }: { latex: string }) {
  const html = renderKatex(latex, true);
  if (!html) {
    return <code className="block whitespace-pre-wrap break-words rounded bg-black/10 px-2 py-1 font-mono text-[0.92em]">{latex}</code>;
  }
  return (
    <div className="my-2 max-w-full overflow-x-auto rounded-md bg-white/70 px-2 py-2 text-gray-950">
      <div className="min-w-max" aria-label={`Formula: ${latex}`} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
