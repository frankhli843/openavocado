import { useState } from "react";

/**
 * Orientation map for the Dynamic Programming REACTIVATION lesson. This is a
 * strong-but-stale pattern for the learner, so the map is a speed-recall grid:
 * the four DP shapes seen most in interviews — 1D running (Kadane), 0/1 knapsack,
 * subsequence (LIS), and unbounded (coin change) — each with the trigger phrases
 * that signal it and the one recurrence to write from memory. The unifying frame
 * across all four: name the STATE, write the RECURRENCE, pick the ORDER, set the
 * BASE CASE. Selecting a shape reveals its triggers, canonical problems, and the
 * exact recurrence to reach interview speed on.
 */
const SHAPES = {
  running: {
    label: "1D running (Kadane)",
    color: "#4f46e5",
    triggers: ['"maximum subarray"', '"best contiguous run"', '"max sum ending here"'],
    problems: ["Maximum Subarray (53)", "Maximum Product Subarray (152)", "Best Time to Buy/Sell Stock (121)"],
    recurrence: "best_here = max(x, best_here + x); answer = max over all best_here. One scan, O(1) space.",
  },
  knapsack: {
    label: "0/1 knapsack",
    color: "#0891b2",
    triggers: ['"pick items under a budget"', '"each item once"', '"subset sum to target"'],
    problems: ["0/1 Knapsack", "Partition Equal Subset Sum (416)", "Target Sum (494)"],
    recurrence: "dp[w] = max(dp[w], dp[w - wt] + val); iterate capacity DESCENDING so each item is used once.",
  },
  subseq: {
    label: "Subsequence (LIS)",
    color: "#7c3aed",
    triggers: ['"longest increasing subsequence"', '"best subsequence, order kept"', '"longest chain"'],
    problems: ["Longest Increasing Subsequence (300)", "Russian Doll Envelopes (354)", "Longest Common Subsequence (1143)"],
    recurrence: "dp[i] = 1 + max(dp[j] for j < i with nums[j] < nums[i]). O(n²), or O(n log n) with patience tails.",
  },
  unbounded: {
    label: "Unbounded (coin change)",
    color: "#16a34a",
    triggers: ['"fewest coins to make an amount"', '"reuse items freely"', '"ways to reach a total"'],
    problems: ["Coin Change (322)", "Coin Change II (518)", "Combination Sum IV (377)"],
    recurrence: "dp[a] = min(dp[a], dp[a - c] + 1); iterate amount ASCENDING so each coin can repeat.",
  },
} as const;

type Key = keyof typeof SHAPES;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("running");
  const b = SHAPES[sel];

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
      {/* Reactivation frame */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Reactivation, not re-teaching</div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
          You already know DP
        </span>
        <span style={{ color: "#64748b" }}>→ rebuild recall speed →</span>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
          recurrence from memory in &lt; 2 min
        </span>
      </div>

      {/* The four-question machine */}
      <div style={{ fontSize: 12, background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 14, color: "#3730a3" }}>
        Every DP is four decisions: name the <b>state</b> (what a cell means), write the <b>recurrence</b> (how a cell
        builds on smaller cells), pick the <b>order</b> (fill dependencies first), and set the <b>base case</b>. Reactivating
        the pattern is drilling those four until each shape&apos;s recurrence is muscle memory.
      </div>

      {/* Shape selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(Object.keys(SHAPES) as Key[]).map((k) => {
          const active = k === sel;
          return (
            <button
              key={k}
              onClick={() => setSel(k)}
              style={{
                flex: "1 1 140px",
                padding: "10px 12px",
                borderRadius: 10,
                border: `2px solid ${SHAPES[k].color}`,
                background: active ? SHAPES[k].color : "#fff",
                color: active ? "#fff" : SHAPES[k].color,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
              aria-pressed={active}
            >
              {SHAPES[k].label}
            </button>
          );
        })}
      </div>

      {/* Shape detail */}
      <div style={{ borderLeft: `3px solid ${b.color}`, paddingLeft: 12 }}>
        <div
          style={{
            fontSize: 13,
            marginBottom: 10,
            color: "#0f172a",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            background: "#f8fafc",
            borderRadius: 6,
            padding: "8px 10px",
          }}
        >
          {b.recurrence}
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          Recognize it when you read
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {b.triggers.map((t) => (
            <span
              key={t}
              style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "#f1f5f9", color: b.color, fontWeight: 600 }}
            >
              {t}
            </span>
          ))}
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          Canonical problems
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155" }}>
          {b.problems.map((p) => (
            <li key={p} style={{ marginBottom: 2 }}>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 14 }}>
        The tell that separates the four: is the state a running scalar (Kadane), a table indexed by remaining budget
        (knapsack), a value indexed by position with a look-back (LIS), or a target you rebuild from smaller totals with
        reuse (coin change)? The one trap that costs interviews is the fill <b>order</b>: 0/1 knapsack iterates capacity
        <b> descending</b> to forbid reuse; the unbounded coin problem iterates <b>ascending</b> to allow it — the same
        table, opposite loop direction.
      </div>
    </div>
  );
}
