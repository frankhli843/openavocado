import { useState } from "react";
import { ArrowRight, Plus, Minus } from "lucide-react";

/**
 * Fixed-size sliding window over an integer array computing the window sum.
 * Teaches the core O(n) insight: when the window slides one step, add the
 * entering element and subtract the leaving element instead of re-summing.
 */
export default function ArtifactComponent() {
  const nums = [4, 2, 7, 1, 9, 3, 6, 5];
  const k = 3;
  const maxStart = nums.length - k;
  const [start, setStart] = useState(0);

  const windowVals = nums.slice(start, start + k);
  const windowSum = windowVals.reduce((a, b) => a + b, 0);
  const entering = start > 0 ? nums[start + k - 1] : null;
  const leaving = start > 0 ? nums[start - 1] : null;

  // Track the best window seen up to the current position (max sum).
  let best = -Infinity;
  let bestStart = 0;
  for (let s = 0; s <= start; s++) {
    const sum = nums.slice(s, s + k).reduce((a, b) => a + b, 0);
    if (sum > best) {
      best = sum;
      bestStart = s;
    }
  }

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
        Fixed window of size k = {k} · maximum window sum
      </div>

      {/* The array with the window highlighted */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 14,
        }}
      >
        {nums.map((v, i) => {
          const inWindow = i >= start && i < start + k;
          const inBest = i >= bestStart && i < bestStart + k;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                minWidth: 34,
                flex: "1 1 34px",
                maxWidth: 52,
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 16,
                background: inWindow ? "#2563eb" : inBest ? "#dbeafe" : "#f1f5f9",
                color: inWindow ? "#fff" : "#0f172a",
                border: inBest && !inWindow ? "2px solid #2563eb" : "2px solid transparent",
                transition: "all .15s",
              }}
            >
              {v}
              <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.6, marginTop: 2 }}>
                {i}
              </div>
            </div>
          );
        })}
      </div>

      {/* Incremental update explanation */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          marginBottom: 12,
          minHeight: 26,
        }}
      >
        {start === 0 ? (
          <span style={{ color: "#475569" }}>
            First window: sum the {k} elements once →{" "}
            <b style={{ color: "#2563eb" }}>{windowSum}</b>
          </span>
        ) : (
          <>
            <span style={{ color: "#475569" }}>prev sum</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                color: "#16a34a",
                fontWeight: 700,
              }}
            >
              <Plus size={13} /> {entering} (enters)
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                color: "#dc2626",
                fontWeight: 700,
              }}
            >
              <Minus size={13} /> {leaving} (leaves)
            </span>
            <ArrowRight size={14} color="#64748b" />
            <span style={{ fontWeight: 700, color: "#2563eb" }}>sum = {windowSum}</span>
          </>
        )}
      </div>

      {/* Readout */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          fontSize: 13,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>current window sum</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#2563eb" }}>{windowSum}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>best sum so far</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{best}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>work per slide</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>O(1)</div>
        </div>
      </div>

      {/* Control */}
      <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>
        Slide the window (start index = {start})
      </label>
      <input
        type="range"
        min={0}
        max={maxStart}
        value={start}
        onChange={(e) => setStart(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="window start index"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        Brute force re-sums k elements every step: O(n·k). The window reuses the overlap and
        only touches the two changed ends: O(n).
      </div>
    </div>
  );
}
