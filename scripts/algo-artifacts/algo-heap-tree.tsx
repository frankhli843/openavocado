import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

/**
 * Binary min-heap as an array drawn as a tree. Steps through a push (sift-up)
 * and a pop (sift-down) so the learner sees the heap invariant repaired one
 * swap at a time, and sees the array/tree index relationship (children of i are
 * at 2i+1 and 2i+2).
 */
export default function ArtifactComponent() {
  // Each frame is a full array snapshot plus a note and the "active" index.
  type Frame = { arr: number[]; note: string; active: number; dir: "up" | "down" | null };
  const frames: Frame[] = [
    { arr: [2, 5, 4, 8, 6], note: "A valid min-heap: every parent ≤ its children.", active: -1, dir: null },
    { arr: [2, 5, 4, 8, 6, 1], note: "push(1): drop the new value at the end (index 5).", active: 5, dir: "up" },
    { arr: [2, 5, 1, 8, 6, 4], note: "sift-up: 1 < parent 4 → swap. Now 1 is at index 2.", active: 2, dir: "up" },
    { arr: [1, 5, 2, 8, 6, 4], note: "sift-up: 1 < parent 2 → swap. 1 reaches the root. Heap valid.", active: 0, dir: "up" },
    { arr: [4, 5, 2, 8, 6], note: "pop(): remove root 1, move last value 4 to the root (index 0).", active: 0, dir: "down" },
    { arr: [2, 5, 4, 8, 6], note: "sift-down: 4 > smaller child 2 → swap. Heap valid again.", active: 2, dir: "down" },
  ];

  const [step, setStep] = useState(0);
  const f = frames[Math.min(step, frames.length - 1)];
  const arr = f.arr;

  // Tree levels: index ranges [0], [1,2], [3,4,5,6] ...
  const levels: number[][] = [];
  let lvlStart = 0;
  let width = 1;
  while (lvlStart < arr.length) {
    levels.push(arr.map((_, i) => i).slice(lvlStart, lvlStart + width));
    lvlStart += width;
    width *= 2;
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
        Binary min-heap · push sifts up, pop sifts down
      </div>

      {/* Tree view */}
      <div style={{ marginBottom: 12 }}>
        {levels.map((lvl, li) => (
          <div key={li} style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            {lvl.map((i) => {
              const isActive = i === f.active;
              return (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    minWidth: 40,
                    textAlign: "center",
                    padding: "10px 0",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 16,
                    width: 44,
                    background: isActive ? (f.dir === "up" ? "#16a34a" : "#dc2626") : "#eef2ff",
                    color: isActive ? "#fff" : "#0f172a",
                    border: "2px solid " + (isActive ? "transparent" : "#c7d2fe"),
                    transition: "all .15s",
                  }}
                >
                  {arr[i]}
                  <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.6 }}>i={i}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Array view */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10, justifyContent: "center" }}>
        {arr.map((v, i) => (
          <div
            key={i}
            style={{
              minWidth: 30,
              flex: "0 1 30px",
              textAlign: "center",
              padding: "5px 0",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              background: i === f.active ? "#fde68a" : "#f1f5f9",
            }}
          >
            {v}
          </div>
        ))}
      </div>

      {/* Note */}
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 40, display: "flex", alignItems: "center", gap: 8, color: "#334155" }}>
        {f.dir === "up" && <ArrowUp size={16} color="#16a34a" />}
        {f.dir === "down" && <ArrowDown size={16} color="#dc2626" />}
        <span>{f.note}</span>
      </div>

      {/* Tiles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>root (minimum)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#4f46e5" }}>{arr[0]}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>children of i</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>2i+1, 2i+2</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>push / pop cost</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>O(log n)</div>
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
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 13 }}
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
        aria-label="heap operation step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        The heap is stored as a flat array; the tree is just how we picture it. Each push or pop repairs
        the parent-≤-child invariant along one root-to-leaf path, so the height — and the cost — is O(log n).
      </div>
    </div>
  );
}
