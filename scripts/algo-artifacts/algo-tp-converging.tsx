import { useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

/**
 * Converging two pointers on a SORTED array: two-sum.
 * Teaches the O(n) insight: because the array is sorted, comparing the pair sum
 * to the target tells you unambiguously which end to move — a sum too small
 * means advance the left pointer for a bigger value, a sum too large means
 * retreat the right pointer for a smaller value. No nested loop needed.
 */
export default function ArtifactComponent() {
  const nums = [1, 3, 4, 6, 8, 11];
  const target = 10;

  // Pre-compute the deterministic search trace so scrubbing is exact.
  type Frame = { left: number; right: number; sum: number; action: string; done: boolean };
  const frames: Frame[] = [];
  {
    let left = 0;
    let right = nums.length - 1;
    while (left < right) {
      const sum = nums[left] + nums[right];
      if (sum === target) {
        frames.push({ left, right, sum, action: `sum = ${sum} = target → found the pair`, done: true });
        break;
      } else if (sum < target) {
        frames.push({ left, right, sum, action: `sum = ${sum} < ${target} → move LEFT right for a bigger value`, done: false });
        left++;
      } else {
        frames.push({ left, right, sum, action: `sum = ${sum} > ${target} → move RIGHT left for a smaller value`, done: false });
        right--;
      }
    }
  }

  const [step, setStep] = useState(0);
  const f = frames[Math.min(step, frames.length - 1)];

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
        Two-sum on a SORTED array · target = {target}
      </div>

      {/* The sorted array with the two pointers */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {nums.map((v, i) => {
          const isL = i === f.left;
          const isR = i === f.right;
          const inside = i > f.left && i < f.right;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                minWidth: 38,
                flex: "1 1 38px",
                maxWidth: 56,
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 16,
                background: isL ? "#2563eb" : isR ? "#7c3aed" : inside ? "#eef2ff" : "#f1f5f9",
                color: isL || isR ? "#fff" : "#0f172a",
                border: f.done && (isL || isR) ? "2px solid #16a34a" : "2px solid transparent",
                transition: "all .15s",
              }}
            >
              {v}
              <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.6, marginTop: 2 }}>{i}</div>
            </div>
          );
        })}
      </div>

      {/* Pointer legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, marginBottom: 12 }}>
        <span style={{ color: "#2563eb", fontWeight: 700 }}>● left (smallest side)</span>
        <span style={{ color: "#7c3aed", fontWeight: 700 }}>● right (largest side)</span>
      </div>

      {/* Decision readout */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          marginBottom: 12,
          minHeight: 26,
        }}
      >
        <span style={{ fontWeight: 700 }}>
          {nums[f.left]} + {nums[f.right]}
        </span>
        <ArrowRight size={14} color="#64748b" />
        <span
          style={{
            fontWeight: 700,
            color: f.done ? "#16a34a" : f.sum < target ? "#2563eb" : "#7c3aed",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {f.done ? <Check size={15} /> : f.sum < target ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
          {f.action}
        </span>
      </div>

      {/* Readout tiles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>pair sum</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#2563eb" }}>{f.sum}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>candidates left</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.max(0, f.right - f.left)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>total work</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>O(n)</div>
        </div>
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
          onClick={() => setStep((s) => Math.min(frames.length - 1, s + 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Next
        </button>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          step {Math.min(step, frames.length - 1) + 1} / {frames.length}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        value={Math.min(step, frames.length - 1)}
        onChange={(e) => setStep(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="search step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        A brute-force pair search is O(n²). Sorting lets one comparison eliminate an entire end, so the
        two pointers converge in a single O(n) sweep.
      </div>
    </div>
  );
}
