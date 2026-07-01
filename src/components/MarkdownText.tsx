"use client";

import type { ReactNode } from "react";

type InlineKind = "text" | "strong" | "em" | "code" | "link";

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
  | { kind: "codeblock"; lang: string; code: string };

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
  const indexes = ["`", "*", "_", "["]
    .map((marker) => text.indexOf(marker, start))
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : text.length;
}
