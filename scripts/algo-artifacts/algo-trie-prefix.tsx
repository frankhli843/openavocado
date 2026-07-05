import { useState } from "react";

/**
 * Autocomplete on a trie in two phases. Phase 1: walk the prefix "car" from the
 * root, one character per step, to reach the prefix node. Phase 2: depth-first
 * walk of that subtree, building the string as it descends and recording every
 * node whose end-of-word flag is set. The dictionary is {car, card, cart, cat,
 * cap, dog}; the completions of "car" are car, card, cart. Each step shows the
 * accumulated text and the growing list of found words.
 */
type Phase = {
  kind: "walk" | "dfs";
  at: string; // current accumulated string
  note: string;
  found: string[]; // words recorded so far
  fail?: boolean;
};

const DICT = ["car", "card", "cart", "cat", "cap", "dog"];
const PREFIX = "car";

export default function ArtifactComponent() {
  // Precomputed narrative of the algorithm over this fixed dictionary + prefix.
  const frames: Phase[] = [
    { kind: "walk", at: "c", note: "Phase 1 — walk the prefix. Take edge c from the root. c exists.", found: [] },
    { kind: "walk", at: "ca", note: "Take edge a. \"ca\" exists — it is shared by car, card, cart, cat, cap.", found: [] },
    { kind: "walk", at: "car", note: "Take edge r. Prefix consumed → we are standing on the \"car\" node. Everything below is a completion.", found: [] },
    { kind: "dfs", at: "car", note: "Phase 2 — DFS from the prefix node. \"car\" node is flagged end-of-word → record it.", found: ["car"] },
    { kind: "dfs", at: "card", note: "Descend edge d to \"card\". Flagged → record it.", found: ["car", "card"] },
    { kind: "dfs", at: "cart", note: "Back up, descend edge t to \"cart\". Flagged → record it.", found: ["car", "card", "cart"] },
    { kind: "dfs", at: "car", note: "Subtree exhausted. \"cat\" and \"cap\" live under \"ca\", not under \"car\", so they were never visited.", found: ["car", "card", "cart"] },
  ];

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
        Autocomplete · reach the prefix, then DFS its subtree
      </div>

      {/* Dictionary + prefix */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 12, marginBottom: 12 }}>
        <span style={{ color: "#64748b" }}>dictionary:</span>
        {DICT.map((w) => (
          <span
            key={w}
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              fontWeight: 600,
              background: f.found.includes(w) ? "#dcfce7" : "#f1f5f9",
              color: f.found.includes(w) ? "#15803d" : "#334155",
            }}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Prefix path visualization */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>prefix "car":</span>
        {PREFIX.split("").map((ch, i) => {
          const reached = f.at.length > i && f.at.startsWith(PREFIX.slice(0, i + 1));
          const walking = f.kind === "walk" && f.at.length === i + 1;
          return (
            <span
              key={i}
              style={{
                minWidth: 26,
                textAlign: "center",
                padding: "5px 8px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 15,
                background: walking ? "#4f46e5" : reached ? "#e0e7ff" : "#f1f5f9",
                color: walking ? "#fff" : "#0f172a",
              }}
            >
              {ch}
            </span>
          );
        })}
        {f.kind === "dfs" && (
          <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700, marginLeft: 4 }}>
            ↳ at: {f.at}
          </span>
        )}
      </div>

      {/* Phase badge */}
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            padding: "3px 8px",
            borderRadius: 6,
            background: f.kind === "walk" ? "#eef2ff" : "#f3e8ff",
            color: f.kind === "walk" ? "#4f46e5" : "#7c3aed",
          }}
        >
          {f.kind === "walk" ? "Phase 1 · walk prefix" : "Phase 2 · DFS collect"}
        </span>
      </div>

      {/* Note */}
      <div style={{ fontSize: 13, marginBottom: 12, minHeight: 40, color: "#334155" }}>{f.note}</div>

      {/* Found list */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 4 }}>
          completions found
        </div>
        {f.found.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94a3b8" }}>— none yet (still reaching the prefix) —</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {f.found.map((w) => (
              <span
                key={w}
                style={{ fontSize: 13, fontWeight: 700, padding: "4px 10px", borderRadius: 8, background: "#dcfce7", color: "#15803d" }}
              >
                {w}
              </span>
            ))}
          </div>
        )}
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
        aria-label="autocomplete step"
      />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        Reaching the prefix node costs O(length of the prefix) and skips every word that does not start with
        it. The DFS then visits only the subtree of real completions, recording a word each time it lands on an
        end-of-word node — so "cat" and "cap" are never even looked at.
      </div>
    </div>
  );
}
