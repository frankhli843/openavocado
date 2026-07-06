import { useState } from "react";

/**
 * Interactive visualization of the UPPER binary search variant for Magnetic
 * Force Between Two Balls. Shows sorted positions on a number line, the
 * candidate minimum gap, and the greedy placement of balls. Steps through
 * the binary search converging to the maximum feasible gap.
 */

const POSITIONS = [1, 2, 3, 4, 7];
const M = 3;

function greedyPlace(positions: number[], minGap: number, m: number): { placed: number[]; feasible: boolean } {
  const placed = [positions[0]];
  for (let i = 1; i < positions.length && placed.length < m; i++) {
    if (positions[i] - placed[placed.length - 1] >= minGap) {
      placed.push(positions[i]);
    }
  }
  return { placed, feasible: placed.length >= m };
}

type SearchStep = { lo: number; hi: number; mid: number; placed: number[]; feasible: boolean };

function computeSteps(): SearchStep[] {
  const sorted = [...POSITIONS].sort((a, b) => a - b);
  const steps: SearchStep[] = [];
  let lo = 1, hi = Math.floor((sorted[sorted.length - 1] - sorted[0]) / (M - 1));
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const { placed, feasible } = greedyPlace(sorted, mid, M);
    steps.push({ lo, hi, mid, placed, feasible });
    if (feasible) lo = mid; else hi = mid - 1;
  }
  const { placed } = greedyPlace(sorted, lo, M);
  steps.push({ lo, hi: lo, mid: lo, placed, feasible: true });
  return steps;
}

const STEPS = computeSteps();
const SORTED = [...POSITIONS].sort((a, b) => a - b);
const MAX_POS = SORTED[SORTED.length - 1];

export default function MagneticForceVisualization() {
  const [idx, setIdx] = useState(0);
  const s = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "100%", padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Magnetic Force (Upper Binary Search)</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Positions: [{SORTED.join(", ")}], m = {M} balls. Maximize minimum gap.
        </div>
      </div>

      {/* Number line with positions and placed balls */}
      <div style={{ position: "relative", height: 64, marginBottom: 20, paddingLeft: 8, paddingRight: 8 }}>
        <div style={{ position: "absolute", top: 28, left: 8, right: 8, height: 3, background: "#e2e8f0", borderRadius: 2 }} />
        {SORTED.map((p, i) => {
          const pct = ((p - SORTED[0]) / (MAX_POS - SORTED[0])) * 100;
          const isPlaced = s.placed.includes(p);
          return (
            <div key={i} style={{ position: "absolute", left: `calc(${pct}% + 8px)`, top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
              <div style={{
                width: isPlaced ? 20 : 12,
                height: isPlaced ? 20 : 12,
                borderRadius: "50%",
                background: isPlaced ? "#6366f1" : "#cbd5e1",
                margin: "0 auto",
                marginTop: isPlaced ? 18 : 22,
                transition: "all 0.2s",
              }} />
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{p}</div>
            </div>
          );
        })}
      </div>

      {/* Gaps between placed balls */}
      {s.placed.length >= 2 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {s.placed.slice(1).map((p, i) => {
            const gap = p - s.placed[i];
            const ok = gap >= s.mid;
            return (
              <div key={i} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 13,
                background: ok ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${ok ? "#86efac" : "#fecaca"}`,
                color: ok ? "#166534" : "#991b1b",
              }}>
                {s.placed[i]} to {p}: gap = {gap} {ok ? ">=" : "<"} {s.mid}
              </div>
            );
          })}
        </div>
      )}

      {/* Search state */}
      <div style={{
        background: isLast ? "#f0fdf4" : "#f8fafc",
        border: `1px solid ${isLast ? "#86efac" : "#e2e8f0"}`,
        borderRadius: 8, padding: 12, marginBottom: 12,
      }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
          <span><strong>lo:</strong> {s.lo}</span>
          <span><strong>hi:</strong> {s.hi}</span>
          <span><strong>mid:</strong> {s.mid}</span>
          <span><strong>placed:</strong> {s.placed.length} / {M}</span>
          <span style={{ color: s.feasible ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
            {s.feasible ? "Feasible" : "Too wide"}
          </span>
        </div>
        {!isLast && (
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
            {s.feasible
              ? `Placed ${s.placed.length} >= ${M}: gap ${s.mid} works, try larger -> lo = ${s.mid}`
              : `Placed ${s.placed.length} < ${M}: gap ${s.mid} too wide -> hi = ${s.mid - 1}`}
          </div>
        )}
        {isLast && (
          <div style={{ fontSize: 14, color: "#16a34a", fontWeight: 700, marginTop: 6 }}>
            Converged: maximum minimum gap = {s.lo}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.4 : 1 }}>
          Back
        </button>
        <button onClick={() => setIdx(Math.min(STEPS.length - 1, idx + 1))} disabled={isLast}
          style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #6366f1", background: "#eef2ff", cursor: isLast ? "default" : "pointer", opacity: isLast ? 0.4 : 1, fontWeight: 600 }}>
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
