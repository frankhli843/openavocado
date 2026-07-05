import { useState } from "react";

/**
 * Steps through Union Find on the number-of-provinces problem over five people.
 * Friend edges arrive one at a time; each real union (two different roots) merges
 * two groups and drops the component count by one, while a redundant edge (same
 * root already) is a cycle and changes nothing. Nodes are colored by their current
 * root, and the parent array is shown so path compression and union-by-rank are
 * visible. The count that survives is the number of provinces — here 2.
 */
type Kind = "start" | "union" | "redundant" | "done";
type Frame = {
  parent: number[];
  components: number;
  highlight: number[];
  kind: Kind;
  op: string;
  note: string;
};

const N = 5;

const FRAMES: Frame[] = [
  {
    parent: [0, 1, 2, 3, 4],
    components: 5,
    highlight: [],
    kind: "start",
    op: "init",
    note: "Start: every person is their own root, so parent[i] = i and there are 5 components — 5 provinces until edges merge them.",
  },
  {
    parent: [0, 0, 2, 3, 4],
    components: 4,
    highlight: [0, 1],
    kind: "union",
    op: "union(0, 1)",
    note: "find(0)=0, find(1)=1 differ → real union. Attach 1 under 0. components 5 → 4.",
  },
  {
    parent: [0, 0, 0, 3, 4],
    components: 3,
    highlight: [1, 2],
    kind: "union",
    op: "union(1, 2)",
    note: "find(1)=0 (follow parent up), find(2)=2 differ → real union. Attach 2's root under 0. Now {0,1,2} is one group. components 4 → 3.",
  },
  {
    parent: [0, 0, 0, 3, 4],
    components: 3,
    highlight: [0, 2],
    kind: "redundant",
    op: "union(0, 2)",
    note: "find(0)=0, find(2)=0 — SAME root already. This edge joins nothing new; it is a redundant edge, i.e. a cycle. No merge, no decrement. components stays 3.",
  },
  {
    parent: [0, 0, 0, 3, 3],
    components: 2,
    highlight: [3, 4],
    kind: "union",
    op: "union(3, 4)",
    note: "find(3)=3, find(4)=4 differ → real union. Attach 4 under 3. components 3 → 2.",
  },
  {
    parent: [0, 0, 0, 3, 3],
    components: 2,
    highlight: [],
    kind: "done",
    op: "answer",
    note: "All edges processed. Two roots survive — {0,1,2} rooted at 0 and {3,4} rooted at 3 — so the answer is 2 provinces.",
  },
];

// find the root by walking parents (for coloring the nodes by group).
function rootOf(parent: number[], x: number): number {
  while (parent[x] !== x) x = parent[x];
  return x;
}

const ROOT_COLORS: Record<number, { bg: string; fg: string; ring: string }> = {
  0: { bg: "#e0e7ff", fg: "#3730a3", ring: "#6366f1" },
  3: { bg: "#dcfce7", fg: "#15803d", ring: "#22c55e" },
  1: { bg: "#fef9c3", fg: "#854d0e", ring: "#eab308" },
  2: { bg: "#fae8ff", fg: "#86198f", ring: "#d946ef" },
  4: { bg: "#ffe4e6", fg: "#9f1239", ring: "#f43f5e" },
};

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const f = FRAMES[Math.min(step, FRAMES.length - 1)];
  const kindColor = f.kind === "redundant" ? "#b45309" : f.kind === "done" ? "#15803d" : f.kind === "start" ? "#0891b2" : "#4f46e5";
  const kindLabel =
    f.kind === "redundant" ? "redundant edge (cycle) — no merge" : f.kind === "done" ? "done" : f.kind === "start" ? "initial" : "real union — merge";

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
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        Union Find · number of provinces · color = current group root
      </div>

      {/* Nodes colored by root */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        {Array.from({ length: N }, (_, i) => {
          const root = rootOf(f.parent, i);
          const col = ROOT_COLORS[root] ?? ROOT_COLORS[0];
          const hi = f.highlight.includes(i);
          const isRoot = f.parent[i] === i;
          return (
            <div key={i} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: col.bg,
                  color: col.fg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 18,
                  border: `3px solid ${hi ? kindColor : col.ring}`,
                  boxShadow: hi ? `0 0 0 3px ${kindColor}33` : "none",
                }}
              >
                {i}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
                {isRoot ? "root" : `→ ${f.parent[i]}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* parent array + component count */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div
          style={{
            flex: "1 1 200px",
            background: "#f8fafc",
            borderRadius: 8,
            padding: "8px 10px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13,
            color: "#334155",
            overflowX: "auto",
          }}
        >
          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>parent[]</div>
          [{f.parent.join(", ")}]
        </div>
        <div style={{ flex: "1 1 120px", background: "#eef2ff", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#6366f1" }}>components</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#3730a3" }}>{f.components}</div>
        </div>
      </div>

      {/* op + kind */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
          {f.op}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            padding: "3px 8px",
            borderRadius: 6,
            background: kindColor,
            color: "#fff",
          }}
        >
          {kindLabel}
        </span>
      </div>
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 52, color: "#334155" }}>{f.note}</div>

      {/* controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Prev
        </button>
        <button
          onClick={() => setStep((s) => Math.min(FRAMES.length - 1, s + 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 13 }}
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
        aria-label="union find step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        Union Find answers connectivity incrementally: two nodes share a province exactly when they share a root. Start
        the count at n and drop it by one on every real union; a same-root edge is redundant and merges nothing. Path
        compression flattens the parent chain during find, and union by rank hangs the shorter tree under the taller, so
        each operation is near-constant.
      </div>
    </div>
  );
}
