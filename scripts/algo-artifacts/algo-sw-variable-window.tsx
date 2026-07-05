import { useMemo, useState } from "react";

/**
 * Variable-size sliding window: "longest substring without repeating characters".
 * The right pointer always advances; whenever a duplicate enters the window, the
 * left pointer advances (shrinks) until the window is valid again. The learner
 * scrubs through the precomputed pointer states and watches the window grow and
 * shrink while the answer (best length) is tracked.
 */
type Step = {
  left: number;
  right: number;
  action: "expand" | "shrink" | "record";
  best: number;
  note: string;
};

function buildSteps(s: string): Step[] {
  const steps: Step[] = [];
  const seen = new Set<string>();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    while (seen.has(s[right])) {
      seen.delete(s[left]);
      left++;
      steps.push({
        left,
        right,
        action: "shrink",
        best,
        note: `'${s[right]}' already inside — shrink from the left`,
      });
    }
    seen.add(s[right]);
    const len = right - left + 1;
    const improved = len > best;
    best = Math.max(best, len);
    steps.push({
      left,
      right,
      action: improved ? "record" : "expand",
      best,
      note: improved
        ? `window length ${len} → new best`
        : `add '${s[right]}', window length ${len}`,
    });
  }
  return steps;
}

export default function ArtifactComponent() {
  const s = "abcabcbb";
  const steps = useMemo(() => buildSteps(s), []);
  const [i, setI] = useState(0);
  const step = steps[i];

  const color =
    step.action === "shrink" ? "#dc2626" : step.action === "record" ? "#16a34a" : "#2563eb";

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
        Longest substring without repeats · s = "{s}"
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {s.split("").map((ch, idx) => {
          const inWindow = idx >= step.left && idx <= step.right;
          const isLeft = idx === step.left;
          const isRight = idx === step.right;
          return (
            <div key={idx} style={{ textAlign: "center", flex: "1 1 30px", minWidth: 30, maxWidth: 48 }}>
              <div style={{ height: 14, fontSize: 10, fontWeight: 700, color }}>
                {isLeft ? "L" : ""}
                {isLeft && isRight ? "/" : ""}
                {isRight ? "R" : ""}
              </div>
              <div
                style={{
                  padding: "10px 0",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 16,
                  background: inWindow ? color : "#f1f5f9",
                  color: inWindow ? "#fff" : "#334155",
                  transition: "all .15s",
                }}
              >
                {ch}
              </div>
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{idx}</div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          fontSize: 13,
          minHeight: 20,
          marginBottom: 12,
          color,
          fontWeight: 600,
        }}
      >
        {step.action === "shrink" ? "◀ shrink" : step.action === "record" ? "★ record" : "▶ expand"}
        <span style={{ color: "#475569", fontWeight: 400 }}> — {step.note}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>window [L, R]</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            [{step.left}, {step.right}]
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>current length</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#2563eb" }}>
            {step.right - step.left + 1}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>best length</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>{step.best}</div>
        </div>
      </div>

      <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
        Step {i + 1} / {steps.length}
      </label>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={i}
        onChange={(e) => setI(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="algorithm step"
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => setI((v) => Math.max(0, v - 1))}
          style={btn}
          aria-label="previous step"
        >
          ‹ Prev
        </button>
        <button
          onClick={() => setI((v) => Math.min(steps.length - 1, v + 1))}
          style={btn}
          aria-label="next step"
        >
          Next ›
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
        Right always moves forward once. Left only moves when a duplicate forces a shrink, so each
        index enters and leaves the window at most once → O(n) total.
      </div>
    </div>
  );
}

const btn = {
  flex: "1 1 auto",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
