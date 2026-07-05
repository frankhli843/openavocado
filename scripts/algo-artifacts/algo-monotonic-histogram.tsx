import { useState } from "react";

/**
 * Steps through Largest Rectangle in Histogram over heights [2,1,5,6,2,3] with
 * an INCREASING monotonic stack of bar indices plus a trailing sentinel bar of
 * height 0. A shorter arrival pops a bar and, at that instant, resolves the
 * widest rectangle limited by the popped bar's height: width = i - newTop - 1
 * (or i when the stack empties). The learner watches the exposed stack neighbor
 * give the left edge and the current index give the right edge for free, and the
 * sentinel flush the leftovers in the same loop. Each bar is pushed once and
 * popped once → O(n). The winning rectangle is height 5 × width 2 = 10.
 */
type Frame = {
  i: number; // current index into hs (heights + sentinel)
  stack: number[]; // indices, heights increasing bottom→top
  best: number;
  resolved: { idx: number; h: number; w: number; area: number } | null;
  action: string;
  kind: "push" | "resolve" | "done";
};

const H = [2, 1, 5, 6, 2, 3];
const HS = [...H, 0]; // index 6 is the flushing sentinel

const FRAMES: Frame[] = [
  { i: -1, stack: [], best: 0, resolved: null, action: "Keep a stack of bar indices with increasing heights. A shorter bar walls in the taller bars behind it, so it triggers the measuring pops. A sentinel 0 at the end flushes everything.", kind: "push" },
  { i: 0, stack: [0], best: 0, resolved: null, action: "i=0 (height 2): stack empty, push index 0.", kind: "push" },
  { i: 1, stack: [], best: 2, resolved: { idx: 0, h: 2, w: 1, area: 2 }, action: "i=1 (height 1) < top height 2 → pop bar 0. Stack is now empty, so it reached the far left: width = 1. Area = 2×1 = 2.", kind: "resolve" },
  { i: 1, stack: [1], best: 2, resolved: null, action: "i=1 continued: 1 is not shorter than the (empty) stack, push index 1.", kind: "push" },
  { i: 2, stack: [1, 2], best: 2, resolved: null, action: "i=2 (height 5) > top height 1, still increasing, push index 2.", kind: "push" },
  { i: 3, stack: [1, 2, 3], best: 2, resolved: null, action: "i=3 (height 6) > top height 5, still increasing, push index 3.", kind: "push" },
  { i: 4, stack: [1, 2], best: 6, resolved: { idx: 3, h: 6, w: 1, area: 6 }, action: "i=4 (height 2) < top height 6 → pop bar 3. New top is index 2, so width = 4 − 2 − 1 = 1. Area = 6×1 = 6.", kind: "resolve" },
  { i: 4, stack: [1], best: 10, resolved: { idx: 2, h: 5, w: 2, area: 10 }, action: "i=4 continued: 2 < top height 5 → pop bar 2. New top is index 1, so width = 4 − 1 − 1 = 2. Area = 5×2 = 10 — the winner.", kind: "resolve" },
  { i: 4, stack: [1, 4], best: 10, resolved: null, action: "i=4 continued: 2 is not shorter than top height 1, push index 4.", kind: "push" },
  { i: 5, stack: [1, 4, 5], best: 10, resolved: null, action: "i=5 (height 3) > top height 2, push index 5.", kind: "push" },
  { i: 6, stack: [1, 4], best: 10, resolved: { idx: 5, h: 3, w: 1, area: 3 }, action: "Sentinel i=6 (height 0) pops everything. Pop bar 5: new top 4, width = 6 − 4 − 1 = 1, area = 3.", kind: "resolve" },
  { i: 6, stack: [1], best: 10, resolved: { idx: 4, h: 2, w: 4, area: 8 }, action: "Sentinel continues: pop bar 4: new top 1, width = 6 − 1 − 1 = 4, area = 2×4 = 8.", kind: "resolve" },
  { i: 6, stack: [], best: 10, resolved: { idx: 1, h: 1, w: 6, area: 6 }, action: "Sentinel continues: pop bar 1: stack empties, width = 6, area = 1×6 = 6.", kind: "resolve" },
  { i: 6, stack: [], best: 10, resolved: null, action: "Done: every bar pushed once and popped once. Largest rectangle = 10 (height 5 across bars 2–3).", kind: "done" },
];

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const f = FRAMES[Math.min(step, FRAMES.length - 1)];
  const kindColor = f.kind === "resolve" ? "#7c3aed" : f.kind === "done" ? "#0891b2" : "#4f46e5";

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
        Largest Rectangle · heights = [2,1,5,6,2,3] · increasing stack + sentinel 0
      </div>

      {/* Histogram bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 4, minHeight: 108, overflowX: "auto", paddingBottom: 2 }}>
        {HS.map((h, idx) => {
          const isCur = idx === f.i;
          const onStack = f.stack.includes(idx);
          const isSentinel = idx === 6;
          return (
            <div key={idx} style={{ textAlign: "center", flex: "0 0 auto" }}>
              <div
                style={{
                  width: 30,
                  height: Math.max(6, h * 16),
                  borderRadius: "4px 4px 0 0",
                  background: isCur ? "#7c3aed" : onStack ? "#c4b5fd" : isSentinel ? "#e2e8f0" : "#ddd6fe",
                  border: "2px solid " + (isCur ? "#6d28d9" : onStack ? "#a78bfa" : "transparent"),
                  color: "#3730a3",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  paddingTop: 2,
                  boxSizing: "border-box",
                }}
              >
                {h}
              </div>
              <div style={{ fontSize: 10, color: isSentinel ? "#cbd5e1" : "#94a3b8", marginTop: 2 }}>
                {isSentinel ? "sent" : "i" + idx}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stack + best */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
            Stack (index:height ↑)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", minHeight: 30 }}>
            {f.stack.length === 0 ? (
              <span style={{ fontSize: 13, color: "#94a3b8" }}>empty</span>
            ) : (
              f.stack.map((idx) => (
                <span key={idx} style={{ padding: "4px 9px", borderRadius: 8, fontWeight: 700, fontSize: 13, background: "#7c3aed", color: "#fff" }}>
                  i{idx}:{HS[idx]}
                </span>
              ))
            )}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
            Best area
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>{f.best}</div>
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
        {f.kind === "resolve" ? "pop → measure" : f.kind}
      </div>
      <div style={{ fontSize: 13, marginBottom: 6, minHeight: 52, color: "#334155" }}>{f.action}</div>

      {f.resolved && (
        <div style={{ fontSize: 12, background: "#f5f3ff", borderRadius: 8, padding: "6px 10px", marginBottom: 10, color: "#6d28d9" }}>
          Resolved bar i{f.resolved.idx}: height {f.resolved.h} × width {f.resolved.w} = <b>{f.resolved.area}</b>
        </div>
      )}

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
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #7c3aed", background: "#7c3aed", color: "#fff", cursor: "pointer", fontSize: 13 }}
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
        aria-label="largest rectangle step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        At each pop the height is the popped bar, the left edge is the bar now exposed below it on the stack, and the
        right edge is the current index — the stack hands you both boundaries for free. The sentinel 0 is shorter than
        everything, so it flushes the leftovers through the same loop body instead of a separate cleanup pass.
      </div>
    </div>
  );
}
