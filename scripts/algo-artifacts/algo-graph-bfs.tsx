import { useState } from "react";

/**
 * Steps through MULTI-SOURCE breadth-first search on the rotting-oranges grid, a
 * 3x3 board where only the top-left cell starts rotten and the other eight are
 * fresh. Each step is one minute: the whole current frontier is processed at once,
 * every fresh orthogonal neighbor flips to rotten and joins the next frontier, and
 * the fresh count drops. The minute a cell flips equals its distance to the nearest
 * source, so the answer (minutes until nothing is fresh) is just the number of
 * layers BFS runs. Mark-on-enqueue keeps each cell entering the frontier once.
 */
type Cell = 0 | 1 | 2; // 0 empty, 1 fresh, 2 rotten

// distance-from-(0,0) grid drives the animation; d = minute the cell rots.
const DIST = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 4],
];

const MAX_MIN = 4;

function gridAtMinute(m: number): Cell[][] {
  return DIST.map((row) => row.map((d) => (d <= m ? 2 : 1))) as Cell[][];
}
function freshAtMinute(m: number): number {
  let f = 0;
  for (const row of DIST) for (const d of row) if (d > m) f += 1;
  return f;
}
function frontierAtMinute(m: number): string {
  const cells: string[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (DIST[r][c] === m) cells.push(`(${r},${c})`);
  return cells.join("  ");
}

const NOTES = [
  "Seed: enqueue the one rotten cell (0,0) at minute 0. fresh = 8. Nothing has spread yet.",
  "Minute 1: process the frontier {(0,0)}. Its two fresh neighbors (0,1) and (1,0) flip to rotten and enqueue. fresh = 6.",
  "Minute 2: process {(0,1),(1,0)}. Three fresh neighbors (0,2),(1,1),(2,0) flip. fresh = 3.",
  "Minute 3: process {(0,2),(1,1),(2,0)}. Two more (1,2),(2,1) flip. fresh = 1.",
  "Minute 4: process {(1,2),(2,1)}. The far corner (2,2) flips. fresh = 0 → answer is 4 minutes.",
];

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const m = Math.min(step, MAX_MIN);
  const grid = gridAtMinute(m);
  const fresh = freshAtMinute(m);

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
        Multi-source BFS · rotting oranges · layer = minute = distance to nearest source
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
        {/* The grid */}
        <div>
          {grid.map((row, r) => (
            <div key={r} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {row.map((cell, c) => {
                const justRotted = DIST[r][c] === m && m > 0;
                const bg = cell === 2 ? (justRotted ? "#f97316" : "#fed7aa") : "#dcfce7";
                const fg = cell === 2 ? (justRotted ? "#fff" : "#9a3412") : "#15803d";
                return (
                  <div
                    key={c}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 10,
                      background: bg,
                      color: fg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                      border: "2px solid " + (justRotted ? "#ea580c" : "transparent"),
                      textAlign: "center",
                      lineHeight: 1.1,
                    }}
                  >
                    {cell === 2 ? "rot" : "fresh"}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            orange = just rotted this minute · pale = already rotten · green = still fresh
          </div>
        </div>

        {/* State panel */}
        <div style={{ flex: "1 1 180px", minWidth: 160 }}>
          <div style={{ background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#6366f1" }}>minute</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#3730a3" }}>{m}</div>
          </div>
          <div style={{ background: fresh === 0 ? "#dcfce7" : "#fef2f2", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: fresh === 0 ? "#16a34a" : "#dc2626" }}>
              fresh remaining
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: fresh === 0 ? "#15803d" : "#b91c1c" }}>{fresh}</div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>frontier processed this minute</div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              color: "#334155",
              background: "#f8fafc",
              borderRadius: 6,
              padding: "6px 8px",
              overflowX: "auto",
            }}
          >
            {frontierAtMinute(m) || "—"}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 52, color: "#334155" }}>{NOTES[m]}</div>

      {/* recurrence reminder */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 12,
          marginBottom: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>seed all sources @ 0</span>
        <span style={{ color: "#94a3b8" }}>→</span>
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>process one layer / minute</span>
        <span style={{ color: "#94a3b8" }}>→</span>
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#e0e7ff", color: "#3730a3", fontWeight: 700 }}>
          fresh == 0 ? layers : -1
        </span>
      </div>

      {/* controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Prev
        </button>
        <button
          onClick={() => setStep((s) => Math.min(MAX_MIN, s + 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Next
        </button>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          minute {m} / {MAX_MIN}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={MAX_MIN}
        value={m}
        onChange={(e) => setStep(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="bfs minute"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        Because every source started at minute 0, the minute a cell flips is its distance to the nearest rotten cell. The
        answer is the number of layers BFS runs; if any cell is still fresh when the frontier empties, it is unreachable
        and the answer is -1. Marking a cell rotten the moment it is enqueued keeps each cell entering the frontier once.
      </div>
    </div>
  );
}
