import { useState } from "react";
import { ArrowDown, Check } from "lucide-react";

/**
 * Same-direction (read / write) two pointers: in-place compaction.
 * Removes duplicates from a SORTED array without extra space. The read pointer
 * scans every element once; the write pointer marks the boundary of the kept
 * prefix and only advances when a genuinely new value arrives. Both move
 * forward, never backward — one clean O(n) pass, O(1) extra memory.
 */
export default function ArtifactComponent() {
  const original = [1, 1, 2, 2, 2, 3, 4, 4];

  // Pre-compute each read step so scrubbing is deterministic.
  type Frame = { read: number; write: number; kept: number[]; wrote: boolean };
  const frames: Frame[] = [];
  {
    const arr = original.slice();
    let write = 1; // first element is always kept
    frames.push({ read: 0, write, kept: arr.slice(0, write), wrote: true });
    for (let read = 1; read < arr.length; read++) {
      let wrote = false;
      if (arr[read] !== arr[write - 1]) {
        arr[write] = arr[read];
        write++;
        wrote = true;
      }
      frames.push({ read, write, kept: arr.slice(0, write), wrote });
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
        In-place dedup of a sorted array · read scans, write keeps
      </div>

      {/* The array with read/write markers */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {original.map((v, i) => {
          const isRead = i === f.read;
          const isWrite = i === f.write;
          const inPrefix = i < f.write;
          return (
            <div key={i} style={{ position: "relative", minWidth: 34, flex: "1 1 34px", maxWidth: 52 }}>
              <div style={{ height: 16, textAlign: "center" }}>
                {isRead && <ArrowDown size={14} color="#dc2626" />}
              </div>
              <div
                style={{
                  textAlign: "center",
                  padding: "10px 0",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 16,
                  background: inPrefix ? "#dcfce7" : "#f1f5f9",
                  color: "#0f172a",
                  border: isWrite ? "2px solid #16a34a" : "2px solid transparent",
                  transition: "all .15s",
                }}
              >
                {v}
                <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.6, marginTop: 2 }}>{i}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, marginBottom: 12 }}>
        <span style={{ color: "#dc2626", fontWeight: 700 }}>▼ read (scans every element)</span>
        <span style={{ color: "#16a34a", fontWeight: 700 }}>▢ write (next slot for a new value)</span>
      </div>

      {/* Decision readout */}
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 26, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {step === 0 ? (
          <span style={{ color: "#475569" }}>Seed: the first element is always unique, so write starts at 1.</span>
        ) : f.wrote ? (
          <span style={{ color: "#16a34a", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Check size={15} /> {original[f.read]} is new → copy it to the write slot, advance write
          </span>
        ) : (
          <span style={{ color: "#94a3b8", fontWeight: 600 }}>
            {original[f.read]} equals the last kept value → skip it, write stays put
          </span>
        )}
      </div>

      {/* Kept prefix + tiles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>kept prefix</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>[{f.kept.join(", ")}]</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>new length</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{f.write}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b" }}>extra memory</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>O(1)</div>
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
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #16a34a", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Next
        </button>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          read {Math.min(step, frames.length - 1)} / {frames.length - 1}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        value={Math.min(step, frames.length - 1)}
        onChange={(e) => setStep(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="read position"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        The write pointer lags behind read, marking the boundary of the compacted prefix. Because
        neither pointer ever moves backward, the whole compaction is a single O(n) pass in O(1) space.
      </div>
    </div>
  );
}
