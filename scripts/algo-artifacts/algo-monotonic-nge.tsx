import { useState } from "react";
import { ArrowRight } from "lucide-react";

/**
 * Steps through the Next Greater Element walk over [2, 1, 2, 4, 3] with a
 * DECREASING monotonic stack of indices. The learner watches the stack hold
 * only the elements whose answer is still open, a bigger arrival pop-and-resolve
 * every smaller waiter (writing the answer at the moment of the pop), and the
 * leftovers keep the default -1. The stack values stay decreasing bottom→top at
 * every step, and each index is pushed once and popped at most once → O(n).
 */
type Frame = {
  i: number; // current scan index, -1 before start
  stack: number[]; // indices, values strictly decreasing bottom→top
  res: (number | -1)[];
  action: string;
  kind: "push" | "resolve" | "done";
};

const NUMS = [2, 1, 2, 4, 3];
const R = (xs: (number | -1)[]) => [...xs];

const FRAMES: Frame[] = [
  { i: -1, stack: [], res: R([-1, -1, -1, -1, -1]), action: "Start: empty stack, every answer defaults to -1. Scan left to right, pushing indices whose next-greater is still open.", kind: "push" },
  { i: 0, stack: [0], res: R([-1, -1, -1, -1, -1]), action: "i=0 (value 2): stack empty, nothing to resolve. Push index 0.", kind: "push" },
  { i: 1, stack: [0, 1], res: R([-1, -1, -1, -1, -1]), action: "i=1 (value 1): 1 is not greater than top value 2, so it resolves nothing. Push index 1 — the stack values 2,1 stay decreasing.", kind: "push" },
  { i: 2, stack: [0], res: R([-1, 2, -1, -1, -1]), action: "i=2 (value 2): 2 > top value 1, so 2 is the next greater for the waiting index 1. Pop it and write res[1]=2.", kind: "resolve" },
  { i: 2, stack: [0, 2], res: R([-1, 2, -1, -1, -1]), action: "i=2 continued: 2 is not greater than the new top value 2, so stop popping. Push index 2.", kind: "push" },
  { i: 3, stack: [], res: R([4, 2, 4, -1, -1]), action: "i=3 (value 4): 4 beats top value 2 → res[2]=4 (pop), and still beats value 2 below → res[0]=4 (pop). One arrival resolved two waiters.", kind: "resolve" },
  { i: 3, stack: [3], res: R([4, 2, 4, -1, -1]), action: "i=3 continued: stack now empty, so push index 3.", kind: "push" },
  { i: 4, stack: [3, 4], res: R([4, 2, 4, -1, -1]), action: "i=4 (value 3): 3 is not greater than top value 4, so it resolves nothing. Push index 4.", kind: "push" },
  { i: 4, stack: [3, 4], res: R([4, 2, 4, -1, -1]), action: "End of scan: indices 3 and 4 (values 4, 3) were never beaten, so their answers stay -1. Result: [4, 2, 4, -1, -1].", kind: "done" },
];

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const f = FRAMES[Math.min(step, FRAMES.length - 1)];
  const kindColor = f.kind === "resolve" ? "#15803d" : f.kind === "done" ? "#0891b2" : "#4f46e5";

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
        Next Greater Element · nums = [2, 1, 2, 4, 3] · decreasing stack
      </div>

      {/* The array */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {NUMS.map((n, idx) => {
          const isCur = idx === f.i;
          const onStack = f.stack.includes(idx);
          return (
            <div key={idx} style={{ textAlign: "center" }}>
              <div
                style={{
                  minWidth: 30,
                  padding: "6px 9px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  background: isCur ? "#4f46e5" : onStack ? "#e0e7ff" : "#f1f5f9",
                  color: isCur ? "#fff" : "#334155",
                  border: "2px solid " + (isCur ? "#4f46e5" : onStack ? "#a5b4fc" : "transparent"),
                }}
              >
                {n}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>i{idx}</div>
            </div>
          );
        })}
      </div>

      {/* Stack */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        Stack (index:value, unresolved, decreasing ↓)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", minHeight: 34, marginBottom: 12 }}>
        {f.stack.length === 0 ? (
          <span style={{ fontSize: 13, color: "#94a3b8" }}>empty</span>
        ) : (
          f.stack.map((idx) => (
            <span
              key={idx}
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                background: "#4f46e5",
                color: "#fff",
              }}
            >
              i{idx}:{NUMS[idx]}
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
        {f.kind === "resolve" ? "pop → resolve" : f.kind}
      </div>
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 52, color: "#334155" }}>{f.action}</div>

      {/* Result array */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        Answers (next greater to the right)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {f.res.map((r, idx) => (
          <span
            key={idx}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 12,
              padding: "3px 9px",
              borderRadius: 999,
              fontWeight: 600,
              background: r === -1 ? "#f1f5f9" : "#dcfce7",
              color: r === -1 ? "#94a3b8" : "#15803d",
            }}
          >
            {NUMS[idx]}
            <ArrowRight size={11} />
            {r === -1 ? "—" : r}
          </span>
        ))}
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
        aria-label="next greater element step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        The stack only ever holds elements still waiting for a bigger neighbor, kept decreasing bottom→top. Each pop is
        the exact moment that element&apos;s answer is known. Every index is pushed once and popped at most once, so the
        inner while loop is amortized O(1) and the whole scan is linear.
      </div>
    </div>
  );
}
