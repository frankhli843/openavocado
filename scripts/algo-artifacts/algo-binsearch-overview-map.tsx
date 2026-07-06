import { useState } from "react";

/**
 * Binary Search on Answer overview map: walks through the three-piece template
 * (define range, write feasibility, binary-search) across four canonical
 * problem classes. Each step shows the candidate range, the feasibility idea,
 * and whether it is a lower or upper binary search.
 */

type Problem = {
  id: string;
  title: string;
  signal: string;
  range: string;
  feasibility: string;
  direction: "minimize" | "maximize";
  template: string;
};

const PROBLEMS: Problem[] = [
  {
    id: "koko",
    title: "Koko Eating Bananas",
    signal: "Find the minimum speed to finish in h hours",
    range: "lo = 1, hi = max(piles)",
    feasibility: "Sum ceil(pile / speed) for each pile; total <= h?",
    direction: "minimize",
    template: "Lower binary search: feasible -> hi = mid",
  },
  {
    id: "split",
    title: "Split Array Largest Sum",
    signal: "Minimize the maximum subarray sum with k splits",
    range: "lo = max(nums), hi = sum(nums)",
    feasibility: "Greedy left-to-right scan; subarrays needed <= k?",
    direction: "minimize",
    template: "Lower binary search: feasible -> hi = mid",
  },
  {
    id: "ship",
    title: "Capacity to Ship Packages",
    signal: "Find the minimum capacity to ship in d days",
    range: "lo = max(weights), hi = sum(weights)",
    feasibility: "Greedy load packages until capacity hit; days <= d?",
    direction: "minimize",
    template: "Lower binary search: feasible -> hi = mid",
  },
  {
    id: "magnetic",
    title: "Magnetic Force Between Balls",
    signal: "Maximize the minimum distance between m balls",
    range: "lo = 1, hi = span / (m - 1)",
    feasibility: "Greedy: place balls at earliest valid position; placed >= m?",
    direction: "maximize",
    template: "Upper binary search: feasible -> lo = mid (round up)",
  },
];

const STEPS = [
  { label: "The template", desc: "Every problem decomposes into three pieces" },
  { label: "Koko Eating Bananas", desc: "Minimize speed (lower search)" },
  { label: "Split Array", desc: "Minimize max partition sum (lower search)" },
  { label: "Ship Packages", desc: "Minimize capacity (lower search)" },
  { label: "Magnetic Force", desc: "Maximize min gap (upper search)" },
];

export default function BinarySearchOverviewMap() {
  const [step, setStep] = useState(0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "100%", padding: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: step === i ? "2px solid #6366f1" : "1px solid #d1d5db",
              background: step === i ? "#eef2ff" : "#fff",
              fontWeight: step === i ? 700 : 400,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "#166534" }}>
              Three-Piece Template
            </div>
            {["1. Define the range: lo = tightest lower bound, hi = loosest upper bound",
              "2. Write the feasibility function: can(candidate) -> boolean",
              "3. Binary-search: if feasible, tighten toward the optimum"].map((t, i) => (
              <div key={i} style={{ padding: "4px 0", fontSize: 14 }}>{t}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1e40af" }}>Lower Search (minimize)</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>mid = (lo + hi) / 2</div>
              <div style={{ fontSize: 13 }}>feasible: hi = mid</div>
              <div style={{ fontSize: 13 }}>infeasible: lo = mid + 1</div>
            </div>
            <div style={{ flex: "1 1 200px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#92400e" }}>Upper Search (maximize)</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>mid = (lo + hi + 1) / 2</div>
              <div style={{ fontSize: 13 }}>feasible: lo = mid</div>
              <div style={{ fontSize: 13 }}>infeasible: hi = mid - 1</div>
            </div>
          </div>
        </div>
      )}

      {step >= 1 && step <= 4 && (() => {
        const p = PROBLEMS[step - 1];
        const isMax = p.direction === "maximize";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{p.title}</div>
            <div style={{ fontSize: 14, color: "#6b7280", fontStyle: "italic" }}>{p.signal}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Range", value: p.range, bg: "#f0f9ff", border: "#bae6fd" },
                { label: "Feasibility", value: p.feasibility, bg: "#fefce8", border: "#fef08a" },
                { label: "Template", value: p.template, bg: isMax ? "#fef3c7" : "#f0fdf4", border: isMax ? "#fde68a" : "#bbf7d0" },
              ].map((item) => (
                <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 8, padding: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{item.label}: </span>
                  <span style={{ fontSize: 14 }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 8, padding: 12, borderRadius: 8,
              background: isMax ? "#fef3c7" : "#eff6ff",
              border: `1px solid ${isMax ? "#fde68a" : "#bfdbfe"}`,
              fontSize: 13,
            }}>
              <strong>Monotonicity: </strong>
              {isMax
                ? "Small gaps are easy (feasible), large gaps become impossible (infeasible). Search for the rightmost feasible."
                : "Large values are easy (feasible), small values become impossible (infeasible). Search for the leftmost feasible."}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
