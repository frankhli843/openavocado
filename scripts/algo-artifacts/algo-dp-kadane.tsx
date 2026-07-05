import { useState } from "react";
import { ArrowRight } from "lucide-react";

/**
 * Steps through Kadane's algorithm over [-2, 1, -3, 4, -1, 2, 1, -5, 4]. At each
 * index the learner watches the single running-state decision:
 *   best_here = max(x, best_here + x)   ("start fresh here" vs "extend the run")
 * and the global answer best = max(best, best_here). The running run is
 * highlighted on the array; when best_here resets to x alone, the previous run is
 * abandoned. One scan, O(1) space — the 1D DP whose "state" is a single scalar.
 */
type Frame = {
  i: number; // current scan index
  bestHere: number;
  best: number;
  runStart: number; // start index of the current best-ending-here run
  action: string;
  kind: "extend" | "reset" | "newbest" | "start";
};

const NUMS = [-2, 1, -3, 4, -1, 2, 1, -5, 4];

// Precomputed, mirrors the reference solution exactly.
const FRAMES: Frame[] = [
  { i: 0, bestHere: -2, best: -2, runStart: 0, action: "Base case: best_here = best = nums[0] = -2. The only run so far is [-2].", kind: "start" },
  { i: 1, bestHere: 1, best: 1, runStart: 1, action: "x=1. Extending gives -2+1 = -1, but starting fresh at 1 is bigger, so best_here RESETS to 1. New best = 1.", kind: "reset" },
  { i: 2, bestHere: -2, best: 1, runStart: 1, action: "x=-3. Extend: 1 + -3 = -2 beats starting fresh at -3, so best_here = -2. best stays 1.", kind: "extend" },
  { i: 3, bestHere: 4, best: 4, runStart: 3, action: "x=4. Extend: -2 + 4 = 2, but 4 alone is bigger, so best_here RESETS to 4. New best = 4.", kind: "reset" },
  { i: 4, bestHere: 3, best: 4, runStart: 3, action: "x=-1. Extend: 4 + -1 = 3 beats -1 alone, so best_here = 3. best stays 4.", kind: "extend" },
  { i: 5, bestHere: 5, best: 5, runStart: 3, action: "x=2. Extend: 3 + 2 = 5 beats 2 alone, so best_here = 5. New best = 5.", kind: "newbest" },
  { i: 6, bestHere: 6, best: 6, runStart: 3, action: "x=1. Extend: 5 + 1 = 6 beats 1 alone, so best_here = 6. New best = 6 — the run [4,-1,2,1].", kind: "newbest" },
  { i: 7, bestHere: 1, best: 6, runStart: 3, action: "x=-5. Extend: 6 + -5 = 1 beats -5 alone, so best_here = 1. best stays 6.", kind: "extend" },
  { i: 8, bestHere: 5, best: 6, runStart: 7, action: "x=4. Extend: 1 + 4 = 5, but 4 alone is smaller, so extend wins: best_here = 5. best stays 6. Answer: 6.", kind: "extend" },
];

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const f = FRAMES[Math.min(step, FRAMES.length - 1)];
  const kindColor =
    f.kind === "reset" ? "#b45309" : f.kind === "newbest" ? "#15803d" : f.kind === "start" ? "#0891b2" : "#4f46e5";
  const kindLabel =
    f.kind === "reset" ? "reset (start fresh)" : f.kind === "newbest" ? "new global best" : f.kind === "start" ? "base case" : "extend the run";

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
        Kadane · nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4] · max subarray sum
      </div>

      {/* The array with the current run highlighted */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {NUMS.map((n, idx) => {
          const isCur = idx === f.i;
          const inRun = idx >= f.runStart && idx <= f.i;
          return (
            <div key={idx} style={{ textAlign: "center" }}>
              <div
                style={{
                  minWidth: 30,
                  padding: "6px 9px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  background: isCur ? "#4f46e5" : inRun ? "#e0e7ff" : "#f1f5f9",
                  color: isCur ? "#fff" : inRun ? "#3730a3" : "#94a3b8",
                  border: "2px solid " + (isCur ? "#4f46e5" : inRun ? "#a5b4fc" : "transparent"),
                }}
              >
                {n}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>i{idx}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>
        Shaded = the current &ldquo;best run ending here&rdquo; (from i{f.runStart} to i{f.i}).
      </div>

      {/* The two state variables */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: "1 1 150px", background: "#eef2ff", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#6366f1", marginBottom: 2 }}>
            best_here
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#3730a3" }}>{f.bestHere}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>max sum of a run ending at i{f.i}</div>
        </div>
        <div style={{ flex: "1 1 150px", background: "#dcfce7", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#16a34a", marginBottom: 2 }}>
            best (answer)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>{f.best}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>max over all best_here so far</div>
        </div>
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
        {kindLabel}
      </div>
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 52, color: "#334155" }}>{f.action}</div>

      {/* Recurrence reminder */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 13,
          marginBottom: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>x alone</span>
        <span style={{ color: "#94a3b8" }}>vs</span>
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>best_here + x</span>
        <ArrowRight size={13} color="#94a3b8" />
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#e0e7ff", color: "#3730a3", fontWeight: 700 }}>
          keep the larger
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
        aria-label="kadane step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        The whole algorithm is one decision per element: is the best run ending here just this element alone, or the
        previous best run extended by it? Whenever best_here goes negative, extending only hurts, so the next positive
        element resets the run. The answer is the largest best_here ever seen — one pass, constant extra space.
      </div>
    </div>
  );
}
