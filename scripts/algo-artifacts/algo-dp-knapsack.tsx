import { useState } from "react";

/**
 * Steps through 0/1 knapsack with a ROLLING 1D dp array. Items are
 * (weight, value) = (1,1), (3,4), (4,5), (5,7) and capacity = 7. Each frame shows
 * the whole dp[0..7] after one item is folded in, with the cells that changed
 * highlighted. The key teaching point is the DESCENDING capacity sweep: because
 * dp[w] reads dp[w - wt] from the SAME row, sweeping high→low guarantees the value
 * it reads has not yet seen the current item, so each item is used at most once.
 * The final answer is dp[capacity] = dp[7] = 9 (take items (3,4) + (4,5)).
 */
type Frame = {
  itemIdx: number; // -1 = init
  wt: number;
  val: number;
  dp: number[];
  changed: number[]; // indices updated by this item
  action: string;
};

const CAP = 7;

const FRAMES: Frame[] = [
  {
    itemIdx: -1, wt: 0, val: 0,
    dp: [0, 0, 0, 0, 0, 0, 0, 0], changed: [],
    action: "Base case: dp[w] = best value achievable with capacity w and NO items yet = 0 for every w.",
  },
  {
    itemIdx: 0, wt: 1, val: 1,
    dp: [0, 1, 1, 1, 1, 1, 1, 1], changed: [1, 2, 3, 4, 5, 6, 7],
    action: "Item (wt 1, val 1). Sweep w = 7…1 (descending). dp[w] = max(dp[w], dp[w-1] + 1). Every capacity ≥ 1 can now hold this one item → value 1.",
  },
  {
    itemIdx: 1, wt: 3, val: 4,
    dp: [0, 1, 1, 4, 5, 5, 5, 5], changed: [3, 4, 5, 6, 7],
    action: "Item (wt 3, val 4). w = 7…3. dp[7] = max(5?, dp[4] + 4 = 1+4) → 5; dp[3] = dp[0] + 4 = 4. Pairing (1,1)+(3,4) gives 5 at w ≥ 4.",
  },
  {
    itemIdx: 2, wt: 4, val: 5,
    dp: [0, 1, 1, 4, 5, 6, 6, 9], changed: [4, 5, 6, 7],
    action: "Item (wt 4, val 5). w = 7…4. dp[7] = max(5, dp[3] + 5 = 4+5) → 9 (items (3,4)+(4,5)). dp[5] = dp[1] + 5 = 6.",
  },
  {
    itemIdx: 3, wt: 5, val: 7,
    dp: [0, 1, 1, 4, 5, 7, 8, 9], changed: [5, 6, 7],
    action: "Item (wt 5, val 7). w = 7…5. dp[7] = max(9, dp[2] + 7 = 1+7 = 8) → stays 9. dp[5] = dp[0] + 7 = 7. Answer: dp[7] = 9.",
  },
];

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const f = FRAMES[Math.min(step, FRAMES.length - 1)];

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
        0/1 Knapsack · rolling dp[0…7] · capacity 7
      </div>

      {/* Current item */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8" }}>Folding in</span>
        {f.itemIdx === -1 ? (
          <span style={{ fontSize: 13, color: "#0891b2", fontWeight: 700 }}>no items yet — base case</span>
        ) : (
          <span
            style={{
              padding: "5px 11px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              background: "#cffafe",
              color: "#0e7490",
            }}
          >
            item {f.itemIdx}: weight {f.wt}, value {f.val}
          </span>
        )}
      </div>

      {/* dp array */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        dp[w] = best value within capacity w
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {f.dp.map((v, w) => {
          const isChanged = f.changed.includes(w);
          const isAnswer = w === CAP;
          return (
            <div key={w} style={{ textAlign: "center" }}>
              <div
                style={{
                  minWidth: 32,
                  padding: "8px 6px",
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 16,
                  background: isChanged ? "#0891b2" : "#f1f5f9",
                  color: isChanged ? "#fff" : "#334155",
                  border: "2px solid " + (isAnswer ? "#16a34a" : isChanged ? "#0891b2" : "transparent"),
                }}
              >
                {v}
              </div>
              <div style={{ fontSize: 10, color: isAnswer ? "#16a34a" : "#94a3b8", marginTop: 2, fontWeight: isAnswer ? 700 : 400 }}>
                w{w}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>
        Cyan = cells updated by this item. Green border = the answer cell dp[{CAP}]. Cells are swept high→low so each item lands once.
      </div>

      {/* Action */}
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 52, color: "#334155" }}>{f.action}</div>

      {/* Why descending */}
      <div style={{ fontSize: 12, background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 12, color: "#3730a3" }}>
        <b>Why descending?</b> dp[w] reads dp[w − wt] from the same array. Going high→low, that lower cell still holds the
        value from <i>before</i> this item, so the item is added at most once. Sweeping low→high instead would let dp[w −
        wt] already include this item — that is the unbounded (reuse-allowed) variant.
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
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #0891b2", background: "#0891b2", color: "#fff", cursor: "pointer", fontSize: 13 }}
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
        aria-label="knapsack step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        The 2D table dp[item][capacity] collapses to a single row because each item only reads the row above it. The whole
        item loop is O(items × capacity) time and O(capacity) space. The final answer is the last cell, dp[7] = 9, from
        taking the weight-3 and weight-4 items.
      </div>
    </div>
  );
}
