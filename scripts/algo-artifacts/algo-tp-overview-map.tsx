import { useState } from "react";

/**
 * Orientation map for the Two Pointer pattern. Shows the three branches the
 * learner must tell apart — converging (opposite ends), same-direction
 * (read/write), and fast/slow (Floyd) — each with the trigger phrases that
 * signal it, the pointer choreography, and canonical problems. Selecting a
 * branch reveals its recognition cues.
 */
const BRANCHES = {
  converging: {
    label: "Converging",
    color: "#2563eb",
    move: "Left starts at the front, right at the back; they walk toward each other. One comparison decides which end moves.",
    triggers: ['"pair / triplet that sums to…" (sorted)', '"two lines / container"', '"is it a palindrome"'],
    problems: ["Two-sum on a sorted array", "Container with most water", "Valid palindrome", "3-sum (sort + converge)"],
  },
  readwrite: {
    label: "Same-direction (read / write)",
    color: "#16a34a",
    move: "Both pointers start at the front and move forward; read scans everything, write marks the boundary of the kept prefix.",
    triggers: ['"remove / dedup in place"', '"move all X to the end"', '"compact the array"'],
    problems: ["Remove duplicates in place", "Remove element", "Move zeroes", "Partition / Dutch flag"],
  },
  fastslow: {
    label: "Fast / slow (Floyd)",
    color: "#7c3aed",
    move: "Two pointers over the SAME sequence at different speeds; the gap between them exposes cycles and midpoints.",
    triggers: ['"detect a cycle"', '"find the middle"', '"nth node from the end"'],
    problems: ["Linked-list cycle detection", "Find cycle start", "Middle of a linked list", "Happy number"],
  },
} as const;

type Key = keyof typeof BRANCHES;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("converging");
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
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}>
          Check every pair → O(n²)
        </span>
        <span style={{ color: "#64748b" }}>→ let one comparison drop an end →</span>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
          Two pointers sweep once → O(n)
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
                flex: "1 1 120px",
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
        All three share one idea: a second index removes the inner loop. The array being sorted (converging)
        or the pointers moving at different speeds (fast/slow) is what makes a single comparison decisive.
      </div>
    </div>
  );
}
