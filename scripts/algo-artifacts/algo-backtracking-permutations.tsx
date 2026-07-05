import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Steps through the backtracking walk that enumerates permutations of [1,2,3]
 * with a used-array. The learner watches each "choose" set an element's used
 * flag and push it, and each "un-choose" pop it and clear the flag — so state
 * is restored exactly on the way back up. Unlike subsets, there is no start
 * index: every free element may be placed at every position, which is why order
 * matters and both {1,2,3}-order and {1,3,2}-order appear.
 */
type Frame = {
  path: number[];
  used: Record<number, boolean>;
  recorded: number[][];
  action: string;
  kind: "choose" | "record" | "unchoose" | "start" | "done";
};

const S = (xs: number[][]) => xs.map((x) => [...x]);
const U = (a: boolean, b: boolean, c: boolean): Record<number, boolean> => ({ 1: a, 2: b, 3: c });

const FRAMES: Frame[] = [
  { path: [], used: U(false, false, false), recorded: S([]), action: "Start: nothing placed, every element free. A used-array tracks which elements are already in the path.", kind: "start" },
  { path: [1], used: U(true, false, false), recorded: S([]), action: "choose 1 → set used[1] = true and push 1.", kind: "choose" },
  { path: [1, 2], used: U(true, true, false), recorded: S([]), action: "choose 2 → set used[2] = true and push 2. Only 3 is still free.", kind: "choose" },
  { path: [1, 2, 3], used: U(true, true, true), recorded: S([[1, 2, 3]]), action: "path length equals input length → a full arrangement. Record a copy: [1, 2, 3].", kind: "record" },
  { path: [1, 2], used: U(true, true, false), recorded: S([[1, 2, 3]]), action: "un-choose 3 → pop it AND clear used[3]. State is restored to just before the choice.", kind: "unchoose" },
  { path: [1], used: U(true, false, false), recorded: S([[1, 2, 3]]), action: "nothing else was free at that level, so un-choose 2 → pop, clear used[2].", kind: "unchoose" },
  { path: [1, 3], used: U(true, false, true), recorded: S([[1, 2, 3]]), action: "back at this level, 3 is now free → choose 3, set used[3], push.", kind: "choose" },
  { path: [1, 3, 2], used: U(true, true, true), recorded: S([[1, 2, 3], [1, 3, 2]]), action: "only 2 was free → choose it. Full length → record [1, 3, 2].", kind: "record" },
  { path: [], used: U(false, false, false), recorded: S([[1, 2, 3], [1, 3, 2]]), action: "unwind fully, clearing every flag — back to the start, ready to place 2 first, then 3 first.", kind: "unchoose" },
  { path: [], used: U(false, false, false), recorded: S([[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]), action: "The same beats fill the other two starting choices. 6 permutations — every flag set going down, cleared coming back up.", kind: "done" },
];

const chipStr = (xs: number[]) => `[${xs.join(", ")}]`;

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
        Permutations of [1, 2, 3] · set the flag, explore, clear the flag
      </div>

      {/* used-array */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        used-array
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {[1, 2, 3].map((n) => {
          const on = f.used[n];
          return (
            <div
              key={n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                background: on ? "#e0e7ff" : "#f1f5f9",
                color: on ? "#3730a3" : "#94a3b8",
                border: "1px solid " + (on ? "#a5b4fc" : "transparent"),
              }}
            >
              {n}
              <span style={{ fontSize: 11, fontWeight: 600 }}>{on ? "used" : "free"}</span>
            </div>
          );
        })}
      </div>

      {/* Current path */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        Path (arrangement so far)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", minHeight: 34, marginBottom: 12 }}>
        {f.path.length === 0 ? (
          <span style={{ fontSize: 13, color: "#94a3b8" }}>empty</span>
        ) : (
          f.path.map((n, i) => (
            <span
              key={i}
              style={{ minWidth: 26, textAlign: "center", padding: "5px 10px", borderRadius: 8, fontWeight: 700, fontSize: 15, background: "#4f46e5", color: "#fff" }}
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
        {f.kind === "unchoose" ? "un-choose (pop + clear)" : f.kind === "choose" ? "choose (set + push)" : f.kind}
      </div>
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 38, color: "#334155" }}>{f.action}</div>

      {/* Recorded */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        Recorded permutations ({f.recorded.length})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {f.recorded.length === 0 ? (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>none yet</span>
        ) : (
          f.recorded.map((s, i) => (
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
          ))
        )}
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
        aria-label="backtracking permutations step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        The used-array is the difference from subsets: there is no start index, so every free element may be placed
        at every position, and both [1, 2, 3] and [1, 3, 2] are produced. Clearing the flag on the way back up is
        what makes the same element available again for a different branch.
      </div>
    </div>
  );
}
