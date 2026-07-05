import { useState } from "react";

/**
 * Orientation map for the Sliding Window pattern. Shows the two branches the
 * learner must recognize (fixed-size vs variable-size) with the trigger phrases
 * that signal each, plus the cost collapse from brute force O(n·k) to O(n).
 * Selecting a branch reveals its recognition cues and canonical problems.
 */
const BRANCHES = {
  fixed: {
    label: "Fixed-size window",
    color: "#2563eb",
    triggers: ['"subarray of size k"', '"every window of length k"', '"exactly k elements"'],
    problems: ["Max sum of size-k subarray", "Average of subarrays size k", "Max vowels in size-k substring"],
    move: "Right advances; left follows k steps behind. Window width is constant.",
  },
  variable: {
    label: "Variable-size window",
    color: "#7c3aed",
    triggers: ['"longest / shortest subarray such that…"', '"at most K distinct"', '"sum ≥ target"'],
    problems: ["Longest substring w/o repeats", "Min subarray sum ≥ target", "Longest w/ at most K distinct"],
    move: "Right expands to include; left shrinks while a constraint is violated. Width changes.",
  },
} as const;

type Key = keyof typeof BRANCHES;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("fixed");
  const b = BRANCHES[sel];

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
      {/* Cost collapse */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Why the pattern exists</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}>
          Recompute each window → O(n·k)
        </span>
        <span style={{ color: "#64748b" }}>→ reuse the overlap →</span>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
          Slide & update ends → O(n)
        </span>
      </div>

      {/* Branch selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(Object.keys(BRANCHES) as Key[]).map((k) => {
          const active = k === sel;
          return (
            <button
              key={k}
              onClick={() => setSel(k)}
              style={{
                flex: "1 1 140px",
                padding: "10px 12px",
                borderRadius: 10,
                border: `2px solid ${BRANCHES[k].color}`,
                background: active ? BRANCHES[k].color : "#fff",
                color: active ? "#fff" : BRANCHES[k].color,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
              aria-pressed={active}
            >
              {BRANCHES[k].label}
            </button>
          );
        })}
      </div>

      {/* Branch detail */}
      <div style={{ borderLeft: `3px solid ${b.color}`, paddingLeft: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 10, color: "#334155" }}>{b.move}</div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          Recognize it when you read
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {b.triggers.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                padding: "3px 8px",
                borderRadius: 999,
                background: "#f1f5f9",
                color: b.color,
                fontWeight: 600,
              }}
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
    </div>
  );
}
