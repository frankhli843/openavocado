import { useState } from "react";

/**
 * Orientation map for the Trie (prefix tree) pattern. Shows the four recognition
 * fingerprints — prefix queries, autocomplete, many dictionary lookups, and
 * grid/word-search pruning — with the trigger phrases that signal each and the
 * one structural fact that powers all of them: a node is a child-per-character
 * map plus an end-of-word flag, and every operation is O(length of the string),
 * independent of how many words are stored. Selecting a job reveals its cues.
 */
const JOBS = {
  prefix: {
    label: "Prefix queries",
    color: "#4f46e5",
    triggers: ['"words starting with"', '"common prefix"', '"count words with prefix p"'],
    problems: ["Implement Trie (insert/search/startsWith)", "Longest common prefix", "Map sum of prefixes"],
    move: "Walk the prefix from the root; if you consume it, every word beneath that node is a match. O(len).",
  },
  autocomplete: {
    label: "Autocomplete",
    color: "#0891b2",
    triggers: ['"type-ahead suggestions"', '"return all completions"', '"search suggestions system"'],
    problems: ["Search suggestions system", "Design autocomplete", "Replace words with roots"],
    move: "startsWith to reach the prefix node, then DFS its subtree emitting every end-of-word node.",
  },
  dictionary: {
    label: "Many dictionary lookups",
    color: "#7c3aed",
    triggers: ['"fixed word list, many queries"', '"is this a valid word"', '"add & search word"'],
    problems: ["Add and search word (with .)", "Word break", "Stream of characters"],
    move: "Store the dictionary once; each query is a single O(len) walk, no matter how many words exist.",
  },
  grid: {
    label: "Grid / word-search pruning",
    color: "#16a34a",
    triggers: ['"find all words on a board"', '"Boggle"', '"prune dead letter paths"'],
    problems: ["Word Search II", "Boggle solver", "Concatenated words"],
    move: "Carry a trie pointer as you collect letters; the instant an edge is missing, abandon that path.",
  },
} as const;

type Key = keyof typeof JOBS;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("prefix");
  const b = JOBS[sel];

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
      {/* Core fact */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Why the pattern exists</div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}>
          Scan every word for a prefix → O(N · len)
        </span>
        <span style={{ color: "#64748b" }}>→ store by shared prefix →</span>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
          walk one path → O(len)
        </span>
      </div>

      {/* Node structure fact */}
      <div style={{ fontSize: 12, background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 14, color: "#3730a3" }}>
        A node is just two things: a <b>map from character → child</b> and an <b>end-of-word flag</b>. Search checks
        the flag at the end; <b>startsWith ignores it</b>. That flag is why "card" stored but "car" not stored behaves right.
      </div>

      {/* Job selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(Object.keys(JOBS) as Key[]).map((k) => {
          const active = k === sel;
          return (
            <button
              key={k}
              onClick={() => setSel(k)}
              style={{
                flex: "1 1 130px",
                padding: "10px 12px",
                borderRadius: 10,
                border: `2px solid ${JOBS[k].color}`,
                background: active ? JOBS[k].color : "#fff",
                color: active ? "#fff" : JOBS[k].color,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
              aria-pressed={active}
            >
              {JOBS[k].label}
            </button>
          );
        })}
      </div>

      {/* Job detail */}
      <div style={{ borderLeft: `3px solid ${b.color}`, paddingLeft: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 10, color: "#334155" }}>{b.move}</div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          Recognize it when you read
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {b.triggers.map((t) => (
            <span
              key={t}
              style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "#f1f5f9", color: b.color, fontWeight: 600 }}
            >
              {t}
            </span>
          ))}
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          Canonical problems
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155" }}>
          {b.problems.map((p) => (
            <li key={p} style={{ marginBottom: 2 }}>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 14 }}>
        The unifying idea: store strings by their shared prefixes so any question about beginnings becomes a
        short walk down a path. If a problem only asks "is this exact word present" with no prefix reasoning,
        a plain hash set is simpler — reach for a trie when prefixes or many dictionary queries are in play.
      </div>
    </div>
  );
}
