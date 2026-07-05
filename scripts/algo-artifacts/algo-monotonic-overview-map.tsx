import { useState } from "react";

/**
 * Orientation map for the Monotonic Stack pattern. Shows the recognition
 * fingerprints — nearest greater/smaller neighbor, span / wait-time, largest
 * rectangle, and trapping water — with the trigger phrases that signal each and
 * the one structural idea that powers all of them: keep unresolved elements on a
 * stack in sorted order, and let each newcomer pop-and-resolve everyone it
 * dominates in a single left-to-right pass. Selecting a job reveals its
 * triggers, canonical problems, and the specific move.
 */
const JOBS = {
  neighbor: {
    label: "Nearest greater / smaller",
    color: "#4f46e5",
    triggers: ['"next greater element"', '"previous smaller"', '"nearest taller to the right"'],
    problems: ["Next Greater Element I (496)", "Next Greater Element II (503)", "Online Stock Span (901)"],
    move: "Keep a DECREASING stack of indices; a bigger arrival pops-and-resolves every smaller waiter. Leftovers get the default (-1). O(n).",
  },
  wait: {
    label: "Span / wait-time",
    color: "#0891b2",
    triggers: ['"days until warmer"', '"how far to the next bigger"', '"span of the current value"'],
    problems: ["Daily Temperatures (739)", "Online Stock Span (901)", "Next Greater Element II (503)"],
    move: "Store INDICES so a pop yields a distance: answer = currentIndex - poppedIndex. Same decreasing stack, distance instead of value.",
  },
  rectangle: {
    label: "Largest rectangle",
    color: "#7c3aed",
    triggers: ['"largest rectangle in a histogram"', '"maximal rectangle"', '"widest bar-bounded area"'],
    problems: ["Largest Rectangle in Histogram (84)", "Maximal Rectangle (85)"],
    move: "Keep an INCREASING stack; a shorter arrival pops a bar and resolves its widest rectangle: width = i - newTop - 1. Sentinel 0 flushes the rest.",
  },
  water: {
    label: "Trapping water",
    color: "#16a34a",
    triggers: ['"trap rain water"', '"water held between bars"', '"basins bounded left and right"'],
    problems: ["Trapping Rain Water (42)", "Container With Most Water (11, two-pointer variant)"],
    move: "Keep a DECREASING stack; a taller arrival pops a floor and resolves one water layer bounded by the left wall (new top) and the right wall (arrival).",
  },
} as const;

type Key = keyof typeof JOBS;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("neighbor");
  const b = JOBS[sel];

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
      {/* Core fact */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Why the pattern exists</div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}>
          For each element, re-scan the rest → O(n²)
        </span>
        <span style={{ color: "#64748b" }}>→ keep only the unresolved, in order →</span>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
          one pass, O(n)
        </span>
      </div>

      {/* Machine fact */}
      <div style={{ fontSize: 12, background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 14, color: "#3730a3" }}>
        A monotonic stack holds <b>unresolved elements in sorted order</b>. As you scan once, an element that would
        break the order triggers <b>pops</b>, and every pop is the moment the popped element&apos;s answer is known — its
        boundaries read off the exposed neighbor and the current index. <b>Push once, pop at most once → linear.</b>
      </div>

      {/* Job selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(Object.keys(JOBS) as Key[]).map((k) => {
          const active = k === sel;
          return (
            <button
              key={k}
              onClick={() => setSel(k)}
              style={{
                flex: "1 1 140px",
                padding: "10px 12px",
                borderRadius: 10,
                border: `2px solid ${JOBS[k].color}`,
                background: active ? JOBS[k].color : "#fff",
                color: active ? "#fff" : JOBS[k].color,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
              aria-pressed={active}
            >
              {JOBS[k].label}
            </button>
          );
        })}
      </div>

      {/* Job detail */}
      <div style={{ borderLeft: `3px solid ${b.color}`, paddingLeft: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 10, color: "#334155" }}>{b.move}</div>

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
        The unifying idea: keep the elements whose answer is still open on a stack in sorted order, and let each
        newcomer settle the accounts of everyone it dominates. Pick a <b>decreasing</b> stack when a larger arrival
        resolves waiters (next greater, wait-time, water) and an <b>increasing</b> stack when a smaller one does
        (largest rectangle). Store <b>indices</b> so a pop yields both a value and a width. Reach for it only when the
        problem asks for the nearest element that breaks a monotonic relation.
      </div>
    </div>
  );
}
