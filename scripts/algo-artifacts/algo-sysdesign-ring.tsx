import { useState } from "react";

/**
 * Walks through CONSISTENT HASHING on a hash ring (positions 0..360, 0 at the top,
 * clockwise). Four physical nodes A,B,C,D sit at fixed ring positions; every key
 * hashes to a ring position and is owned by the FIRST node found walking clockwise
 * from that position (wrapping past 360 back to 0). The steps show: bare ring,
 * placing six keys and resolving ownership, adding virtual replicas to smooth the
 * arcs, adding a new node E (only the keys in the arc just before E move), and
 * removing node C (only C's keys slide to the next node clockwise). Every position
 * and owner below is a deterministic module-level constant, never Math.random, so
 * the picture is identical on every render. The point: changing the node set remaps
 * only about K/N keys, unlike plain modulo hashing which reshuffles almost all of
 * them whenever N changes.
 */
type RingNode = { id: string; pos: number; color: string; virtual?: boolean; removed?: boolean; isNew?: boolean };
type OwnedKey = { id: string; pos: number; owner: string };

const BASE_NODES: RingNode[] = [
  { id: "A", pos: 30, color: "#6366f1" },
  { id: "B", pos: 120, color: "#10b981" },
  { id: "C", pos: 210, color: "#f59e0b" },
  { id: "D", pos: 300, color: "#ec4899" },
];

const E_NODE: RingNode = { id: "E", pos: 205, color: "#0ea5e9", isNew: true };

const KEYS = [
  { id: "k1", pos: 10 },
  { id: "k2", pos: 80 },
  { id: "k3", pos: 150 },
  { id: "k4", pos: 200 },
  { id: "k5", pos: 250 },
  { id: "k6", pos: 340 },
];

// Three replicas per physical node, evenly thirded around the ring — deterministic.
function virtualNodes(): RingNode[] {
  const out: RingNode[] = [];
  BASE_NODES.forEach((n) => {
    for (let j = 0; j < 3; j++) {
      out.push({ id: n.id + "#" + j, pos: (n.pos + j * 120) % 360, color: n.color, virtual: true });
    }
  });
  return out;
}

// First active node clockwise from a key position (wrap past 360 → smallest pos).
function ownerOf(keyPos: number, nodes: RingNode[]): string {
  const active = nodes.filter((n) => !n.removed).slice().sort((a, b) => a.pos - b.pos);
  for (const n of active) if (n.pos >= keyPos) return n.id;
  return active.length ? active[0].id : "?";
}
function physicalId(nodeId: string): string {
  return nodeId.split("#")[0];
}
function ownersFor(nodes: RingNode[]): OwnedKey[] {
  return KEYS.map((k) => ({ id: k.id, pos: k.pos, owner: physicalId(ownerOf(k.pos, nodes)) }));
}

const BASE_OWNERS = ownersFor(BASE_NODES);
function baseOwner(id: string): string {
  return BASE_OWNERS.find((o) => o.id === id)?.owner || "?";
}

function colorOf(nodeId: string, nodes: RingNode[]): string {
  const hit = nodes.find((n) => physicalId(n.id) === nodeId);
  return hit ? hit.color : "#94a3b8";
}

// Convert ring degrees (0 at top, clockwise) to SVG x,y on a circle of radius r.
function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: 160 + r * Math.sin(rad), y: 160 - r * Math.cos(rad) };
}

type Scene = { nodes: RingNode[]; keys: OwnedKey[]; showKeys: boolean; moved: Set<string>; emph: Set<string> };

function sceneAt(step: number): Scene {
  if (step === 0) {
    return { nodes: BASE_NODES, keys: [], showKeys: false, moved: new Set(), emph: new Set(BASE_NODES.map((n) => n.id)) };
  }
  if (step === 1) {
    return { nodes: BASE_NODES, keys: ownersFor(BASE_NODES), showKeys: true, moved: new Set(), emph: new Set() };
  }
  if (step === 2) {
    const vn = virtualNodes();
    return { nodes: vn, keys: ownersFor(vn), showKeys: true, moved: new Set(), emph: new Set(vn.map((n) => n.id)) };
  }
  if (step === 3) {
    const nodes = [...BASE_NODES, E_NODE];
    const keys = ownersFor(nodes);
    const moved = new Set(keys.filter((k) => k.owner !== baseOwner(k.id)).map((k) => k.id));
    return { nodes, keys, showKeys: true, moved, emph: new Set(["E"]) };
  }
  const nodes = BASE_NODES.map((n) => (n.id === "C" ? { ...n, removed: true } : n));
  const keys = ownersFor(nodes);
  const moved = new Set(keys.filter((k) => k.owner !== baseOwner(k.id)).map((k) => k.id));
  return { nodes, keys, showKeys: true, moved, emph: new Set(["C"]) };
}

const MAX_STEP = 4;

const NOTES = [
  "The ring holds four physical nodes A, B, C, D at fixed positions (0 at top, clockwise). No keys are placed yet. Every key that arrives will be owned by the FIRST node found walking clockwise from where the key hashes, wrapping past 360 back to 0.",
  "Six keys hash onto the ring. Following each key clockwise to the next node gives ownership: k1 to A, k2 to B, k3 to C, k4 to C, k5 to D, k6 wraps past the top to A. Each node owns the arc that ends at it.",
  "Virtual nodes: each physical node now appears three times around the ring (A#0, A#1, A#2, and so on). Spreading many small replicas breaks the ring into many short arcs, so no single node is stuck owning one huge slice and the load spreads evenly.",
  "Add a new node E in the arc just before C. Only the keys sitting in that short arc (k3 and k4) hand off to E — every other key keeps its owner. Adding a node remaps only about K/N keys, unlike plain modulo hashing which reshuffles nearly all keys the moment N changes.",
  "Remove node C. Only the keys C owned (k3 and k4) slide clockwise to the next node, D. A, B, and D keep everything else. A departure disturbs a single arc, so consistent hashing keeps churn minimal on both growth and shrink.",
];

export default function ArtifactComponent() {
  const [step, setStep] = useState(0);
  const s = Math.min(step, MAX_STEP);
  const scene = sceneAt(s);

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
        Consistent hashing · owner = first node clockwise on the ring
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, width: "100%", maxWidth: "100%" }}>
        {/* The ring */}
        <div style={{ flex: "1 1 240px", minWidth: 200, maxWidth: "100%" }}>
          <svg viewBox="0 0 320 320" style={{ width: "100%", height: "auto", maxWidth: "100%", display: "block" }} role="img" aria-label="hash ring">
            <circle cx={160} cy={160} r={110} fill="none" stroke="#e2e8f0" strokeWidth={14} />
            <circle cx={160} cy={160} r={110} fill="none" stroke="#cbd5e1" strokeWidth={2} />

            {/* nodes on the ring */}
            {scene.nodes.map((n) => {
              const p = polar(n.pos, 110);
              const lab = polar(n.pos, n.virtual ? 132 : 138);
              const r = n.virtual ? 7 : 12;
              const emph = scene.emph.has(n.id);
              if (n.removed) {
                return (
                  <g key={n.id}>
                    <circle cx={p.x} cy={p.y} r={12} fill="#fff" stroke="#94a3b8" strokeWidth={2} strokeDasharray="3 3" />
                    <line x1={p.x - 8} y1={p.y - 8} x2={p.x + 8} y2={p.y + 8} stroke="#ef4444" strokeWidth={2} />
                    <line x1={p.x + 8} y1={p.y - 8} x2={p.x - 8} y2={p.y + 8} stroke="#ef4444" strokeWidth={2} />
                    <text x={lab.x} y={lab.y} fontSize={11} fontWeight={700} fill="#ef4444" textAnchor="middle" dominantBaseline="middle">
                      {n.id} out
                    </text>
                  </g>
                );
              }
              return (
                <g key={n.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={n.color}
                    stroke={emph ? "#0f172a" : "#fff"}
                    strokeWidth={emph ? 3 : 2}
                  />
                  {!n.virtual && (
                    <text x={p.x} y={p.y} fontSize={11} fontWeight={800} fill="#fff" textAnchor="middle" dominantBaseline="middle">
                      {n.id}
                    </text>
                  )}
                  <text x={lab.x} y={lab.y} fontSize={n.virtual ? 8 : 11} fontWeight={700} fill={n.color} textAnchor="middle" dominantBaseline="middle">
                    {n.id}
                  </text>
                </g>
              );
            })}

            {/* keys just outside the ring */}
            {scene.showKeys &&
              scene.keys.map((k) => {
                const p = polar(k.pos, 88);
                const lab = polar(k.pos, 66);
                const moved = scene.moved.has(k.id);
                const kc = colorOf(k.owner, scene.nodes);
                return (
                  <g key={k.id}>
                    <rect
                      x={p.x - 6}
                      y={p.y - 6}
                      width={12}
                      height={12}
                      rx={3}
                      fill={kc}
                      stroke={moved ? "#0f172a" : "#fff"}
                      strokeWidth={moved ? 2.5 : 1.5}
                    />
                    <text x={lab.x} y={lab.y} fontSize={9} fontWeight={moved ? 800 : 600} fill={moved ? "#0f172a" : "#475569"} textAnchor="middle" dominantBaseline="middle">
                      {k.id}
                    </text>
                  </g>
                );
              })}
          </svg>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            circles = nodes · squares = keys (colored by owner) · dark outline = moved this step
          </div>
        </div>

        {/* ownership / state panel */}
        <div style={{ flex: "1 1 180px", minWidth: 160, maxWidth: "100%" }}>
          <div style={{ background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#6366f1" }}>step</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#3730a3" }}>
              {s} / {MAX_STEP}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>key ownership</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {scene.showKeys ? (
              scene.keys.map((k) => {
                const moved = scene.moved.has(k.id);
                const kc = colorOf(k.owner, scene.nodes);
                return (
                  <span
                    key={k.id}
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 11,
                      padding: "3px 7px",
                      borderRadius: 6,
                      background: moved ? kc : "#f1f5f9",
                      color: moved ? "#fff" : "#334155",
                      border: "1.5px solid " + (moved ? "#0f172a" : "transparent"),
                      fontWeight: moved ? 800 : 600,
                    }}
                  >
                    {k.id} → {k.owner}
                  </span>
                );
              })
            ) : (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>no keys placed yet</span>
            )}
          </div>

          <div style={{ fontSize: 11, color: "#64748b", margin: "10px 0 4px" }}>nodes</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {BASE_NODES.map((n) => (
              <span key={n.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#334155" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: n.color, display: "inline-block" }} />
                {n.id}
              </span>
            ))}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#334155" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: E_NODE.color, display: "inline-block" }} />
              E
            </span>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 72, color: "#334155" }}>{NOTES[s]}</div>

      {/* pipeline reminder */}
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
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>hash key → position</span>
        <span style={{ color: "#94a3b8" }}>→</span>
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>walk clockwise</span>
        <span style={{ color: "#94a3b8" }}>→</span>
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "#e0e7ff", color: "#3730a3", fontWeight: 700 }}>first node owns it</span>
      </div>

      {/* controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button
          onClick={() => setStep((v) => Math.max(0, v - 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Prev
        </button>
        <button
          onClick={() => setStep((v) => Math.min(MAX_STEP, v + 1))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Next
        </button>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          step {s} / {MAX_STEP}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={MAX_STEP}
        value={s}
        onChange={(e) => setStep(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="consistent hashing step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        A key is owned by the first node clockwise from its hash position, so each node owns exactly the arc that ends at it.
        Because ownership depends only on that local arc, adding or removing a node touches just one arc and remaps only about
        K/N keys — the reason consistent hashing beats plain modulo hashing, which changes almost every mapping when N changes.
      </div>
    </div>
  );
}
