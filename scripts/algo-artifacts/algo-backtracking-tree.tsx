import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Steps through the backtracking walk that enumerates every subset of [1,2,3]
 * with the start-index template. The learner watches the shared path grow on a
 * "choose", get snapshotted into the recorded list at every node, and shrink on
 * an "un-choose" — so the three beats choose → explore → un-choose become
 * visible, and the path returns to empty at the end (every push had a pop). The
 * start index is what makes each subset appear exactly once, in increasing order.
 */
type Frame = {
  path: number[];
  recorded: number[][];
  action: string;
  kind: "choose" | "record" | "unchoose" | "done";
};

// The full walk of subsets([1,2,3]); recorded grows as each node is entered.
const S = (xs: number[][]) => xs.map((x) => [...x]);
const FRAMES: Frame[] = [
  { path: [], recorded: S([[]]), action: "Enter with an empty path; the path itself is a subset, so record a copy of {}.", kind: "record" },
  { path: [1], recorded: S([[], [1]]), action: "choose 1 → push it, recurse, and record {1}.", kind: "record" },
  { path: [1, 2], recorded: S([[], [1], [1, 2]]), action: "choose 2 (start index moved past 1) → record {1, 2}.", kind: "record" },
  { path: [1, 2, 3], recorded: S([[], [1], [1, 2], [1, 2, 3]]), action: "choose 3 → record {1, 2, 3}. Nothing lies past 3, so this branch is done.", kind: "record" },
  { path: [1], recorded: S([[], [1], [1, 2], [1, 2, 3]]), action: "un-choose 3, then un-choose 2 — the path pops back to {1}.", kind: "unchoose" },
  { path: [1, 3], recorded: S([[], [1], [1, 2], [1, 2, 3], [1, 3]]), action: "choose 3 (the start index skipped 2, so no duplicate) → record {1, 3}.", kind: "record" },
  { path: [], recorded: S([[], [1], [1, 2], [1, 2, 3], [1, 3]]), action: "un-choose 3, then un-choose 1 — the path is empty again.", kind: "unchoose" },
  { path: [2], recorded: S([[], [1], [1, 2], [1, 2, 3], [1, 3], [2]]), action: "choose 2 → record {2}.", kind: "record" },
  { path: [2, 3], recorded: S([[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3]]), action: "choose 3 → record {2, 3}.", kind: "record" },
  { path: [3], recorded: S([[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]), action: "unwind to empty, then choose 3 → record {3}.", kind: "record" },
  { path: [], recorded: S([[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]), action: "Every push had a matching pop: the path is empty. 8 subsets, each produced once.", kind: "done" },
];

const chipStr = (xs: number[]) => (xs.length ? `{${xs.join(", ")}}` : "{ }");

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const f = FRAMES[Math.min(step, FRAMES.length - 1)];
  const lastRecorded = f.kind === "record" ? f.recorded.length - 1 : -1;

  const kindColor =
    f.kind === "choose" ? "#4f46e5" : f.kind === "unchoose" ? "#b45309" : f.kind === "done" ? "#15803d" : "#0891b2";

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
        Subsets of [1, 2, 3] · choose → explore → un-choose
      </div>

      {/* Current path */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        Shared path (the choices in place right now)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", minHeight: 34, marginBottom: 12 }}>
        {f.path.length === 0 ? (
          <span style={{ fontSize: 13, color: "#94a3b8" }}>empty</span>
        ) : (
          f.path.map((n, i) => (
            <span
              key={i}
              style={{
                minWidth: 26,
                textAlign: "center",
                padding: "5px 10px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 15,
                background: "#4f46e5",
                color: "#fff",
              }}
            >
              {n}
            </span>
          ))
        )}
      </div>

      {/* Action */}
      <div
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          padding: "3px 8px",
          borderRadius: 6,
          marginBottom: 6,
          background: kindColor,
          color: "#fff",
        }}
      >
        {f.kind === "unchoose" ? "un-choose (pop)" : f.kind}
      </div>
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 38, color: "#334155" }}>{f.action}</div>

      {/* Recorded subsets */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        Recorded subsets ({f.recorded.length})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {f.recorded.map((s, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              padding: "3px 9px",
              borderRadius: 999,
              fontWeight: 600,
              background: i === lastRecorded ? "#dcfce7" : "#f1f5f9",
              color: i === lastRecorded ? "#15803d" : "#475569",
              border: "1px solid " + (i === lastRecorded ? "#16a34a" : "transparent"),
            }}
          >
            {i === lastRecorded && <Check size={12} />}
            {chipStr(s)}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        <span>
          <span style={{ color: "#4f46e5", fontWeight: 700 }}>choose</span> pushes onto the path
        </span>
        <span>
          <span style={{ color: "#b45309", fontWeight: 700 }}>un-choose</span> pops it back off
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
          onClick={() => setStep((s) => Math.min(FRAMES.length - 1, s + 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Next
        </button>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          step {Math.min(step, FRAMES.length - 1) + 1} / {FRAMES.length}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={FRAMES.length - 1}
        value={Math.min(step, FRAMES.length - 1)}
        onChange={(e) => setStep(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="backtracking subsets step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        Every node is recorded as a copy of the path, so later pushes and pops never corrupt a saved answer. The
        start index only ever looks forward, which is why {"{1, 3}"} appears but {"{3, 1}"} never does — each subset
        is generated exactly once, in increasing order.
      </div>
    </div>
  );
}
