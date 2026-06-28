"use client";

import type { ReactNode } from "react";

type InlineKind = "text" | "strong" | "em" | "code";

interface InlineToken {
  kind: InlineKind;
  text: string;
}

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

export function MarkdownText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, index) => {
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

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
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
      continue;
    }

    flushList();
    paragraph.push(line);
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
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        tokens.push({ kind: "code", text: text.slice(i + 1, end) });
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
  const indexes = ["`", "*", "_"]
    .map((marker) => text.indexOf(marker, start))
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : text.length;
}
