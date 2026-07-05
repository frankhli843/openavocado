import { useState } from "react";

/**
 * Orientation map for the Heap / Priority Queue pattern. Shows the four jobs a
 * heap does best — top-k / k-th, streaming merge, scheduling by priority, and
 * repeated get-min/get-max — with the trigger phrases that signal each and the
 * Python heapq reality (min-heap only; negate for a max-heap). Selecting a job
 * reveals its cues and canonical problems.
 */
const JOBS = {
  topk: {
    label: "Top-k / k-th",
    color: "#4f46e5",
    triggers: ['"k largest / k smallest"', '"k-th largest"', '"k most frequent"'],
    problems: ["K-th largest element", "Top K frequent", "K closest points"],
    move: "Keep a size-k heap: a MIN-heap for the k largest, a MAX-heap for the k smallest. O(n log k).",
  },
  merge: {
    label: "Merge streams",
    color: "#0891b2",
    triggers: ['"merge k sorted lists"', '"smallest across several streams"', '"k-way merge"'],
    problems: ["Merge k sorted lists", "Smallest range covering k lists", "Ugly numbers"],
    move: "Heap holds one frontier element per stream; pop the min, push that stream's next. O(N log k).",
  },
  schedule: {
    label: "Schedule by priority",
    color: "#7c3aed",
    triggers: ['"most urgent / highest priority next"', '"task scheduler"', '"process by deadline"'],
    problems: ["Task scheduler", "Meeting rooms II", "Reorganize string"],
    move: "Always pull the current best (min or max) and push updated work back. The heap is the ready queue.",
  },
  getmin: {
    label: "Repeated get-min/max",
    color: "#16a34a",
    triggers: ['"running median" (two heaps)', '"keep pulling the extreme"', '"connect ropes / min cost"'],
    problems: ["Find median from a stream", "Minimum cost to connect sticks", "Last stone weight"],
    move: "When you need the extreme again and again as data changes, a heap gives O(log n) insert + pop.",
  },
} as const;

type Key = keyof typeof JOBS;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("topk");
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
          Re-scan for the extreme → O(n) each time
        </span>
        <span style={{ color: "#64748b" }}>→ keep a heap →</span>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
          get-min / insert → O(log n)
        </span>
      </div>

      {/* heapq reality */}
      <div style={{ fontSize: 12, background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 14, color: "#3730a3" }}>
        Python's <b>heapq is a MIN-heap only</b>. For a max-heap, push the negated value and negate on the way out.
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
                flex: "1 1 120px",
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
        The unifying idea: when you need the smallest-or-largest repeatedly as data changes, a heap
        beats re-sorting. If you only need the extreme ONCE, a single linear scan is simpler — reach for a
        heap only when the "give me the best" question recurs.
      </div>
    </div>
  );
}
