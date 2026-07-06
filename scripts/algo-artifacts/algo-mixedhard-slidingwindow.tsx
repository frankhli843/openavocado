import { useState } from "react";

/**
 * Interactive visualization of the sliding window algorithm for
 * Minimum Window Substring (LC 76). Steps through the expand-right,
 * shrink-left loop showing the window, character counts, and the
 * minimum valid window found so far.
 */

const S = "ADOBECODEBANC";
const T = "ABC";

type StepState = {
  left: number;
  right: number;
  windowCounts: Record<string, number>;
  formed: number;
  required: number;
  bestStart: number;
  bestLen: number;
  action: string;
};

function computeSteps(): StepState[] {
  const need: Record<string, number> = {};
  for (const c of T) need[c] = (need[c] || 0) + 1;
  const required = Object.keys(need).length;

  const steps: StepState[] = [];
  const windowCounts: Record<string, number> = {};
  let formed = 0;
  let left = 0;
  let bestStart = -1;
  let bestLen = Infinity;

  steps.push({
    left: 0,
    right: -1,
    windowCounts: { ...windowCounts },
    formed: 0,
    required,
    bestStart,
    bestLen,
    action: `Need: ${JSON.stringify(need)}. Start expanding right.`,
  });

  for (let right = 0; right < S.length; right++) {
    const c = S[right];
    windowCounts[c] = (windowCounts[c] || 0) + 1;
    if (need[c] !== undefined && windowCounts[c] === need[c]) formed++;

    steps.push({
      left,
      right,
      windowCounts: { ...windowCounts },
      formed,
      required,
      bestStart,
      bestLen,
      action: `Expand: add '${c}' at ${right}. formed=${formed}/${required}.`,
    });

    while (formed === required) {
      const windowLen = right - left + 1;
      if (windowLen < bestLen) {
        bestLen = windowLen;
        bestStart = left;
      }
      steps.push({
        left,
        right,
        windowCounts: { ...windowCounts },
        formed,
        required,
        bestStart,
        bestLen,
        action: `Valid window [${left}..${right}]="${S.slice(left, right + 1)}" len=${windowLen}. Best=${bestLen}.`,
      });

      const lc = S[left];
      windowCounts[lc]--;
      if (need[lc] !== undefined && windowCounts[lc] < need[lc]) formed--;
      left++;

      steps.push({
        left,
        right,
        windowCounts: { ...windowCounts },
        formed,
        required,
        bestStart,
        bestLen,
        action: `Shrink: remove '${lc}'. left=${left}. formed=${formed}/${required}.`,
      });
    }
  }

  if (bestStart >= 0) {
    steps.push({
      left,
      right: S.length - 1,
      windowCounts: { ...windowCounts },
      formed,
      required,
      bestStart,
      bestLen,
      action: `Done. Minimum window: "${S.slice(bestStart, bestStart + bestLen)}" (length ${bestLen}).`,
    });
  }

  return steps;
}

const STEPS = computeSteps();

export default function SlidingWindowVisualization() {
  const [idx, setIdx] = useState(0);
  const s = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "100%", padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Minimum Window Substring</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          s = "{S}", t = "{T}". Find shortest window containing all of t.
        </div>
      </div>

      {/* String with window highlight */}
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 16 }}>
        {S.split("").map((c, i) => {
          const inWindow = i >= s.left && i <= s.right && s.right >= 0;
          const isBestStart = s.bestStart >= 0 && i >= s.bestStart && i < s.bestStart + s.bestLen;
          return (
            <div
              key={i}
              style={{
                width: 28,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 700,
                background: inWindow ? "#dbeafe" : isBestStart && isLast ? "#dcfce7" : "#f1f5f9",
                border: `2px solid ${inWindow ? "#3b82f6" : isBestStart && isLast ? "#22c55e" : "#e2e8f0"}`,
                color: inWindow ? "#1e40af" : "#475569",
                transition: "all 0.15s",
              }}
            >
              {c}
            </div>
          );
        })}
      </div>

      {/* Pointers */}
      <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 12, flexWrap: "wrap" }}>
        <span><strong>left:</strong> {s.left}</span>
        <span><strong>right:</strong> {s.right < 0 ? "-" : s.right}</span>
        <span><strong>formed:</strong> {s.formed}/{s.required}</span>
        <span><strong>best:</strong> {s.bestLen === Infinity ? "-" : `${s.bestLen} ("${S.slice(s.bestStart, s.bestStart + s.bestLen)}")`}</span>
      </div>

      {/* Action */}
      <div
        style={{
          background: isLast ? "#f0fdf4" : "#f8fafc",
          border: `1px solid ${isLast ? "#86efac" : "#e2e8f0"}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          fontSize: 13,
          color: isLast ? "#166534" : "#374151",
          fontWeight: isLast ? 700 : 400,
        }}
      >
        {s.action}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.4 : 1 }}>
          Back
        </button>
        <button onClick={() => setIdx(Math.min(STEPS.length - 1, idx + 1))} disabled={isLast}
          style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #3b82f6", background: "#eff6ff", cursor: isLast ? "default" : "pointer", opacity: isLast ? 0.4 : 1, fontWeight: 600 }}>
          Next Step
        </button>
        <button onClick={() => setIdx(0)}
          style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
          Reset
        </button>
        <span style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center" }}>
          Step {idx + 1} of {STEPS.length}
        </span>
      </div>
    </div>
  );
}
