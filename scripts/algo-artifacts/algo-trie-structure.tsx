import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Builds a trie one word at a time (car, card, cat) then runs three lookups so
 * the learner sees the end-of-word flag do its job: search("car") succeeds
 * because its node is flagged, search("ca") fails because that node exists only
 * as a prefix and is NOT flagged, and startsWith("ca") succeeds because it never
 * checks the flag. The tree is drawn as an indented list — one node per row,
 * indented by depth, with a filled dot marking end-of-word nodes.
 */
type Node = { char: string; children: Record<string, Node>; end: boolean };

function emptyNode(char: string): Node {
  return { char, children: {}, end: false };
}

function insert(root: Node, word: string) {
  let cur = root;
  for (const ch of word) {
    if (!cur.children[ch]) cur.children[ch] = emptyNode(ch);
    cur = cur.children[ch];
  }
  cur.end = true;
}

function buildTrie(words: string[]): Node {
  const root = emptyNode("·"); // root = empty prefix
  for (const w of words) insert(root, w);
  return root;
}

type Row = { char: string; depth: number; end: boolean; path: string };

function flatten(node: Node, depth: number, path: string, out: Row[]) {
  if (depth >= 0) out.push({ char: node.char, depth, end: node.end, path });
  for (const key of Object.keys(node.children).sort()) {
    flatten(node.children[key], depth + 1, path + key, out);
  }
}

export default function ArtifactComponent() {
  type Frame = {
    words: string[];
    activePath: string; // characters of the path to highlight, e.g. "car"
    note: string;
    verdict?: { text: string; ok: boolean };
  };
  const frames: Frame[] = [
    { words: ["car"], activePath: "car", note: "insert(\"car\"): create c → a → r, then set end-of-word on the r node." },
    { words: ["car", "card"], activePath: "card", note: "insert(\"card\"): c-a-r already exist, so only d is new. \"card\" shares the whole \"car\" path." },
    { words: ["car", "card", "cat"], activePath: "cat", note: "insert(\"cat\"): c-a exist; branch a new t. Now \"ca\" is a shared prefix of three words." },
    { words: ["car", "card", "cat"], activePath: "car", note: "search(\"car\"): walk c-a-r; the node exists AND its end-of-word flag is set.", verdict: { text: "search(\"car\") → true", ok: true } },
    { words: ["car", "card", "cat"], activePath: "ca", note: "search(\"ca\"): walk c-a; the node exists but its end-of-word flag is OFF — \"ca\" was never stored.", verdict: { text: "search(\"ca\") → false", ok: false } },
    { words: ["car", "card", "cat"], activePath: "ca", note: "startsWith(\"ca\"): walk c-a; it consumed the whole prefix, so it returns true and never checks the flag.", verdict: { text: "startsWith(\"ca\") → true", ok: true } },
  ];

  const [step, setStep] = useState(0);
  const f = frames[Math.min(step, frames.length - 1)];
  const root = buildTrie(f.words);
  const rows: Row[] = [];
  flatten(root, -1, "", rows); // start below the invisible root so depth 0 = first char

  // A row is "on the active path" if the active path starts with this row's path.
  const onPath = (p: string) => p.length > 0 && f.activePath.startsWith(p);
  const isTip = (p: string) => p === f.activePath;

  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#0f172a",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "4px 2px",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        Trie · insert grows shared paths, the flag marks real words
      </div>

      {/* Root label */}
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>root = empty prefix "" ↓</div>

      {/* Tree as indented rows */}
      <div style={{ marginBottom: 12 }}>
        {rows.map((r) => {
          const active = onPath(r.path);
          const tip = isTip(r.path);
          return (
            <div
              key={r.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingLeft: r.depth * 22,
                marginBottom: 4,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "#cbd5e1", fontSize: 12 }}>{r.depth > 0 ? "└─" : ""}</span>
              <span
                style={{
                  minWidth: 30,
                  textAlign: "center",
                  padding: "5px 9px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  background: tip ? "#4f46e5" : active ? "#e0e7ff" : "#f1f5f9",
                  color: tip ? "#fff" : "#0f172a",
                  border: "2px solid " + (r.end ? "#16a34a" : "transparent"),
                }}
              >
                {r.char}
              </span>
              {r.end && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "#16a34a", fontWeight: 700 }}>
                  <Check size={13} /> end-of-word
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Note */}
      <div style={{ fontSize: 13, marginBottom: 10, minHeight: 38, color: "#334155" }}>{f.note}</div>

      {/* Verdict */}
      {f.verdict && (
        <div
          style={{
            display: "inline-block",
            fontSize: 13,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 8,
            marginBottom: 12,
            background: f.verdict.ok ? "#dcfce7" : "#fee2e2",
            color: f.verdict.ok ? "#15803d" : "#b91c1c",
          }}
        >
          {f.verdict.text}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        <span>
          <span style={{ borderBottom: "2px solid #16a34a" }}>green border</span> = word ends here
        </span>
        <span>
          <span style={{ color: "#4f46e5", fontWeight: 700 }}>indigo</span> = current walk tip
        </span>
      </div>

      {/* Control */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Prev
        </button>
        <button
          onClick={() => setStep((s) => Math.min(frames.length - 1, s + 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Next
        </button>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          step {Math.min(step, frames.length - 1) + 1} / {frames.length}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        value={Math.min(step, frames.length - 1)}
        onChange={(e) => setStep(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="trie operation step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        Inserting a word walks its characters, creating any that are missing, and flags the final node. The
        end-of-word flag is what separates a stored word from a path that merely passes through on the way to
        a longer one — which is why search("ca") is false but startsWith("ca") is true.
      </div>
    </div>
  );
}
