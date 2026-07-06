import { useState } from "react";

/**
 * Interactive visualization of binary search on the answer for Koko Eating
 * Bananas. Shows the piles, the candidate speed range [lo, hi], and steps
 * through the binary search: compute mid, check feasibility (sum of ceilings),
 * narrow the range. The learner sees the search converge to the minimum speed.
 */

const PILES = [3, 6, 7, 11];
const H = 8;

function hoursNeeded(piles: number[], speed: number): number {
  return piles.reduce((sum, p) => sum + Math.ceil(p / speed), 0);
}

type SearchStep = { lo: number; hi: number; mid: number; hours: number; feasible: boolean };

function computeSteps(): SearchStep[] {
  const steps: SearchStep[] = [];
  let lo = 1, hi = Math.max(...PILES);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const hours = hoursNeeded(PILES, mid);
    const feasible = hours <= H;
    steps.push({ lo, hi, mid, hours, feasible });
    if (feasible) hi = mid; else lo = mid + 1;
  }
  steps.push({ lo, hi: lo, mid: lo, hours: hoursNeeded(PILES, lo), feasible: true });
  return steps;
}

const STEPS = computeSteps();

export default function KokoVisualization() {
  const [idx, setIdx] = useState(0);
  const s = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "100%", padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Koko Eating Bananas</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Piles: [{PILES.join(", ")}], h = {H} hours. Find minimum speed.
        </div>
      </div>

      {/* Pile visualization */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
        {PILES.map((p, i) => {
          const perPile = Math.ceil(p / s.mid);
          return (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{
                width: 48, height: Math.min(p * 4, 60), background: "#a78bfa",
                borderRadius: "4px 4px 0 0", display: "flex", alignItems: "center",
                justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14,
              }}>
                {p}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {perPile}h
              </div>
            </div>
          );
        })}
      </div>

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
          <span><strong>hours(mid):</strong> {s.hours}</span>
          <span style={{ color: s.feasible ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
            {s.feasible ? "Feasible" : "Too slow"}
          </span>
        </div>
        {!isLast && (
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
            {s.feasible
              ? `${s.hours} <= ${H}: speed ${s.mid} works, try smaller -> hi = ${s.mid}`
              : `${s.hours} > ${H}: speed ${s.mid} too slow -> lo = ${s.mid + 1}`}
          </div>
        )}
        {isLast && (
          <div style={{ fontSize: 14, color: "#16a34a", fontWeight: 700, marginTop: 6 }}>
            Converged: minimum speed = {s.lo}
          </div>
        )}
      </div>

      {/* Range bar */}
      <div style={{ position: "relative", height: 32, background: "#f1f5f9", borderRadius: 6, marginBottom: 16, overflow: "hidden" }}>
        {(() => {
          const maxVal = Math.max(...PILES);
          const loP = ((s.lo - 1) / (maxVal - 1)) * 100;
          const hiP = ((s.hi - 1) / (maxVal - 1)) * 100;
          const midP = ((s.mid - 1) / (maxVal - 1)) * 100;
          return (
            <>
              <div style={{ position: "absolute", left: `${loP}%`, width: `${hiP - loP}%`, height: "100%", background: "#dbeafe", borderRadius: 4 }} />
              <div style={{ position: "absolute", left: `${midP}%`, width: 3, height: "100%", background: s.feasible ? "#16a34a" : "#dc2626" }} />
              <div style={{ position: "absolute", left: `${midP}%`, top: 2, transform: "translateX(-50%)", fontSize: 11, fontWeight: 700, color: "#1e293b" }}>
                {s.mid}
              </div>
            </>
          );
        })()}
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
