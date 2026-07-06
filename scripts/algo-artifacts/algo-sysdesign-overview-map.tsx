import { useState } from "react";

/**
 * Orientation map for the System Design algorithmic-patterns lesson. The unifying
 * idea: a system-design question is not a blank-canvas essay — it hides a small,
 * recognizable set of algorithms. When the interviewer describes a constraint
 * ("spread keys across N servers", "cap requests per client", "stay correct
 * despite failures", "serve hot data with bounded memory"), that phrase is a
 * SIGNAL that points at one canonical tool. This map lists four such tools; each
 * card reveals its trigger signal, its canonical use, and a one-line mechanism so
 * the learner can jump from prose to the right data structure in seconds.
 */
const TOOLS = {
  hashing: {
    label: "Consistent Hashing",
    color: "#4f46e5",
    use: "Distribute keys/data across N servers",
    signal: "Distribute keys/data across N servers so adding/removing a server moves few keys",
    mechanism:
      "Hash keys AND nodes onto a ring; a key belongs to the next node clockwise. Virtual nodes smooth the load, and changing N remaps only ~K/N keys instead of nearly all of them.",
    examples: ["Sharded caches / DBs", "CDN edge placement", "Distributed key-value stores"],
  },
  ratelimit: {
    label: "Rate Limiting",
    color: "#0891b2",
    use: "Cap requests per client per unit time",
    signal: "Cap requests per client per unit time / smooth bursty traffic",
    mechanism:
      "Token bucket refills tokens at a fixed rate up to a capacity and each request spends one — this allows bounded bursts. A sliding-window counter instead enforces a strict rolling count.",
    examples: ["Public API throttling", "Login / abuse protection", "Fair-use quotas"],
  },
  quorum: {
    label: "Quorum & Consensus",
    color: "#7c3aed",
    use: "Keep replicated data correct despite failures",
    signal: "Keep replicated data correct despite node failures / agree on one value",
    mechanism:
      "Require a majority so read and write sets overlap (R + W > N) and no read misses a committed write. Leader-based consensus (Raft/Paxos) commits a value once a majority acknowledges it.",
    examples: ["Replicated databases", "Distributed locks / leases", "Config / metadata stores"],
  },
  cache: {
    label: "Caching / LRU",
    color: "#16a34a",
    use: "Serve hot data fast with bounded memory",
    signal: "Serve hot data fast with bounded memory",
    mechanism:
      "An LRU cache pairs a hash map with a doubly linked list (or an OrderedDict) for O(1) get and put, evicting the least-recently-used entry the moment the cache is full.",
    examples: ["Read-through app caches", "Session / token stores", "Hot-object memoization"],
  },
} as const;

type Key = keyof typeof TOOLS;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("hashing");
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
      {/* Mental-model caption */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>The algorithmic toolbox inside system design</div>
      <div
        style={{
          fontSize: 12,
          background: "#eef2ff",
          borderRadius: 8,
          padding: "8px 10px",
          marginBottom: 14,
          color: "#3730a3",
          boxSizing: "border-box",
          maxWidth: "100%",
        }}
      >
        System-design questions hide a small set of algorithms — <b>recognize the signal, reach for the tool</b>. The
        interviewer's constraint ("few keys move", "cap the rate", "survive failures", "bounded memory") tells you which
        data structure to name.
      </div>

      {/* Tool selector grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(clamp(130px, 45%, 180px), 1fr))",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {(Object.keys(TOOLS) as Key[]).map((k) => {
          const active = k === sel;
          const t = TOOLS[k];
          return (
            <button
              key={k}
              onClick={() => setSel(k)}
              aria-pressed={active}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                border: `2px solid ${t.color}`,
                background: active ? t.color : "#fff",
                color: active ? "#fff" : t.color,
                cursor: "pointer",
                boxSizing: "border-box",
                width: "100%",
                maxWidth: "100%",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: 11, fontWeight: 500, opacity: active ? 0.92 : 0.75 }}>{t.use}</div>
            </button>
          );
        })}
      </div>

      {/* Selected tool detail */}
      <div style={{ borderLeft: `3px solid ${b.color}`, paddingLeft: 12, maxWidth: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: b.color, marginBottom: 8 }}>{b.label}</div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          Signal that triggers it
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <span
            style={{
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 999,
              background: "#f1f5f9",
              color: b.color,
              fontWeight: 600,
              maxWidth: "100%",
            }}
          >
            {b.signal}
          </span>
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          One-line mechanism
        </div>
        <div
          style={{
            fontSize: 13,
            marginBottom: 12,
            color: "#0f172a",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            background: "#f8fafc",
            borderRadius: 6,
            padding: "8px 10px",
            whiteSpace: "pre-wrap",
            boxSizing: "border-box",
            maxWidth: "100%",
          }}
        >
          {b.mechanism}
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          Canonical use
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155" }}>
          {b.examples.map((e) => (
            <li key={e} style={{ marginBottom: 2 }}>
              {e}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 14, maxWidth: "100%" }}>
        The tell that picks the tool: are you <b>spreading data</b> (hash ring), <b>shaping traffic</b> (token bucket),{" "}
        <b>staying correct under failure</b> (majority quorum), or <b>serving hot reads cheaply</b> (LRU)? Name the
        signal first, then the structure follows.
      </div>
    </div>
  );
}
