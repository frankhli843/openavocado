import { useState } from "react";
import { Check, X } from "lucide-react";

/**
 * The size-k min-heap trick for "k-th largest / top-k". Streams values one at a
 * time into a heap capped at size k; whenever the heap overflows it pops its
 * smallest. The root is always the k-th largest seen so far, and the heap holds
 * the current top-k. Shows why a MIN-heap answers a LARGEST question.
 */
export default function ArtifactComponent() {
  const stream = [3, 1, 5, 2, 6, 4];
  const k = 3;

  // Simulate the size-k min-heap after each incoming value.
  type Frame = { incoming: number; heap: number[]; popped: number | null; kept: boolean };
  const frames: Frame[] = [];
  {
    let heap: number[] = [];
    for (const v of stream) {
      heap = [...heap, v].sort((a, b) => a - b);
      let popped: number | null = null;
      if (heap.length > k) {
        popped = heap[0];
        heap = heap.slice(1);
      }
      frames.push({ incoming: v, heap: [...heap], popped, kept: popped !== v });
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
        k-th largest with a size-{k} MIN-heap · stream in one value at a time
      </div>

      {/* The stream */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {stream.map((v, i) => {
          const isCurrent = i === Math.min(step, frames.length - 1);
          const seen = i <= Math.min(step, frames.length - 1);
          return (
            <div
              key={i}
              style={{
                minWidth: 34,
                flex: "1 1 34px",
                maxWidth: 52,
                textAlign: "center",
                padding: "8px 0",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 15,
                background: isCurrent ? "#4f46e5" : seen ? "#e0e7ff" : "#f1f5f9",
                color: isCurrent ? "#fff" : "#0f172a",
                opacity: seen ? 1 : 0.5,
              }}
            >
              {v}
            </div>
          );
        })}
      </div>

      {/* The heap (kept top-k) */}
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
        heap (the current top-{k})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, minHeight: 44 }}>
        {f.heap.map((v, idx) => (
          <div
            key={idx}
            style={{
              minWidth: 40,
              textAlign: "center",
              padding: "10px 0",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 16,
              background: idx === 0 ? "#4f46e5" : "#eef2ff",
              color: idx === 0 ? "#fff" : "#0f172a",
              border: idx === 0 ? "2px solid #312e81" : "2px solid transparent",
            }}
          >
            {v}
            {idx === 0 && <div style={{ fontSize: 9, fontWeight: 500 }}>root</div>}
          </div>
        ))}
      </div>

      {/* Decision line */}
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 24, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#475569" }}>incoming {f.incoming}:</span>
        {f.popped === null ? (
          <span style={{ color: "#16a34a", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Check size={15} /> heap not full yet → keep it
          </span>
        ) : f.popped === f.incoming ? (
          <span style={{ color: "#dc2626", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <X size={15} /> too small → pushed then popped straight back out ({f.popped})
          </span>
        ) : (
          <span style={{ color: "#16a34a", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Check size={15} /> bigger than the root → keep it, evict the smallest ({f.popped})
          </span>
        )}
      </div>

      {/* Tiles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>root = {k}-th largest so far</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#4f46e5" }}>{f.heap[0]}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>heap size cap</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{k}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>cost</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>O(n log k)</div>
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
          value {Math.min(step, frames.length - 1) + 1} / {frames.length}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        value={Math.min(step, frames.length - 1)}
        onChange={(e) => setStep(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="stream position"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        A MIN-heap of size k keeps the k LARGEST values, because the smallest of those k sits at the root
        and gets evicted first. That root is exactly the k-th largest. Full sort is O(n log n); this is O(n log k).
      </div>
    </div>
  );
}
