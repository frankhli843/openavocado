import { useState } from "react";

/**
 * Orientation map for the Graph REACTIVATION lesson. This is a strong-but-stale
 * area for the learner, so the map is a speed-recall grid built on one unifying
 * idea: graph traversal is a single loop whose FRONTIER CONTAINER sets its
 * behavior. A queue gives breadth-first search (shortest unweighted paths), a
 * stack or recursion gives depth-first search (connectivity, ordering, cycles), a
 * priority queue gives Dijkstra (non-negative weighted shortest paths). Union Find
 * is a separate tool for pure connectivity. Selecting a tool reveals its trigger
 * phrases, canonical problems, and the one-line reflex to reach interview speed.
 */
const TOOLS = {
  bfs: {
    label: "Queue → BFS",
    color: "#4f46e5",
    tagline: "Shortest path in an UNWEIGHTED graph",
    triggers: ['"fewest steps / edges"', '"spread from sources"', '"nearest exit in a grid"'],
    problems: ["Rotting Oranges (994)", "Word Ladder (127)", "Shortest Path in Binary Matrix (1091)"],
    reflex: "Queue of the frontier; mark visited ON ENQUEUE; first discovery = shortest. Multi-source = seed all sources at distance 0, count layers.",
  },
  dfs: {
    label: "Stack / recursion → DFS",
    color: "#0891b2",
    tagline: "Connectivity, ordering, cycle detection",
    triggers: ['"count connected regions"', '"is there a cycle"', '"valid ordering of tasks"'],
    problems: ["Number of Islands (200)", "Course Schedule (207)", "Topological Sort"],
    reflex: "Recurse; mark visited; reverse post-order = topological sort. A node found on the active call stack (gray) = a cycle.",
  },
  dijkstra: {
    label: "Heap → Dijkstra",
    color: "#7c3aed",
    triggers: ['"shortest / cheapest with weights"', '"minimum total cost / time"', '"non-negative edge costs"'],
    tagline: "Shortest path with NON-NEGATIVE weights",
    problems: ["Network Delay Time (743)", "Cheapest Flights (787)", "Path With Min Effort (1631)"],
    reflex: "Priority queue keyed by distance; pop the cheapest, finalize it, relax neighbors; skip stale entries (d > dist[u]). Negative edge → use Bellman-Ford.",
  },
  unionfind: {
    label: "Union Find (DSU)",
    color: "#16a34a",
    tagline: "Incremental connectivity, not a traversal",
    triggers: ['"are these two connected"', '"count groups as edges arrive"', '"redundant edge / cycle"'],
    problems: ["Number of Provinces (547)", "Redundant Connection (684)", "Accounts Merge (721)"],
    reflex: "parent[] forest; find with path compression (halving), union by rank. Components start at n, drop 1 per real union. Near-constant per op.",
  },
} as const;

type Key = keyof typeof TOOLS;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("bfs");
  const b = TOOLS[sel];

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
          You already know graphs
        </span>
        <span style={{ color: "#64748b" }}>→ rebuild recall speed →</span>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
          pick the traversal in seconds
        </span>
      </div>

      {/* The one-machine frame */}
      <div style={{ fontSize: 12, background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 14, color: "#3730a3" }}>
        Graph traversal is <b>one loop</b> — pop a node, look at neighbors, record and push the new ones — and the{" "}
        <b>frontier container</b> sets its personality: a <b>queue</b> fans out in equal-distance rings (BFS), a{" "}
        <b>stack / recursion</b> plunges deep (DFS), a <b>priority queue</b> always expands the cheapest node (Dijkstra).{" "}
        <b>Union Find</b> is the separate tool for pure connectivity.
      </div>

      {/* Tool selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(Object.keys(TOOLS) as Key[]).map((k) => {
          const active = k === sel;
          return (
            <button
              key={k}
              onClick={() => setSel(k)}
              style={{
                flex: "1 1 140px",
                padding: "10px 12px",
                borderRadius: 10,
                border: `2px solid ${TOOLS[k].color}`,
                background: active ? TOOLS[k].color : "#fff",
                color: active ? "#fff" : TOOLS[k].color,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
              aria-pressed={active}
            >
              {TOOLS[k].label}
            </button>
          );
        })}
      </div>

      {/* Tool detail */}
      <div style={{ borderLeft: `3px solid ${b.color}`, paddingLeft: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: b.color, marginBottom: 8 }}>{b.tagline}</div>
        <div
          style={{
            fontSize: 13,
            marginBottom: 10,
            color: "#0f172a",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            background: "#f8fafc",
            borderRadius: 6,
            padding: "8px 10px",
            whiteSpace: "pre-wrap",
          }}
        >
          {b.reflex}
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
        The tell that picks the tool: is it shortest and <b>unweighted</b> (queue), shortest and{" "}
        <b>weighted non-negative</b> (heap), or about <b>ordering / connectivity</b> (recursion or Union Find)? The one
        reflex that keeps every traversal linear and correct is marking a node visited the instant it is discovered and
        pushed — never wait until you pop it, or the same node enters the frontier several times.
      </div>
    </div>
  );
}
