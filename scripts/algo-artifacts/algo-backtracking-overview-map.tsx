import { useState } from "react";

/**
 * Orientation map for the Backtracking pattern. Shows the four recognition
 * fingerprints — subsets / combinations, permutations / arrangements,
 * constraint puzzles, and target-sum / partition — with the trigger phrases
 * that signal each and the one structural idea that powers all of them: a
 * depth-first walk of a decision tree with the three-beat template choose →
 * explore → un-choose, plus early pruning of doomed branches. Selecting a job
 * reveals its triggers, canonical problems, and the specific move.
 */
const JOBS = {
  subsets: {
    label: "Subsets / combinations",
    color: "#4f46e5",
    triggers: ['"all subsets"', '"every combination"', '"choose k of n"'],
    problems: ["Subsets (78)", "Combinations (77)", "Combination Sum (39)"],
    move: "Walk with a start index so you only look forward — each set is built once, in order, no duplicates. O(2^n) subsets.",
  },
  permutations: {
    label: "Permutations / arrangements",
    color: "#0891b2",
    triggers: ['"all permutations"', '"every ordering"', '"arrange all of them"'],
    problems: ["Permutations (46)", "Permutations II (47)", "Letter Combinations (17)"],
    move: "Loop over every element, guard reuse with a used-array, place at each position. Order matters. O(n!) leaves.",
  },
  constraints: {
    label: "Constraint puzzles",
    color: "#7c3aed",
    triggers: ['"place N queens"', '"fill the board"', '"no two may conflict"'],
    problems: ["N-Queens (51)", "Sudoku Solver (37)", "Word Search (79)"],
    move: "Before recursing into a choice, test the constraint; if it fails, skip the branch — pruning deletes whole subtrees.",
  },
  target: {
    label: "Target sum / partition",
    color: "#16a34a",
    triggers: ['"sums to the target"', '"partition into groups"', '"split into valid pieces"'],
    problems: ["Combination Sum (39)", "Palindrome Partitioning (131)", "Partition to K Subsets (698)"],
    move: "Carry the remaining amount; prune the instant a choice overshoots (sort first so you can break the loop early).",
  },
} as const;

type Key = keyof typeof JOBS;

export default function ArtifactComponent() {
  const [sel, setSel] = useState<Key>("subsets");
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
          Generate every arrangement, then filter
        </span>
        <span style={{ color: "#64748b" }}>→ reject bad partials early →</span>
        <span style={{ padding: "4px 8px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>
          walk only live branches
        </span>
      </div>

      {/* Template fact */}
      <div style={{ fontSize: 12, background: "#eef2ff", borderRadius: 8, padding: "8px 10px", marginBottom: 14, color: "#3730a3" }}>
        Backtracking is a depth-first walk of a <b>tree of choices</b>. At every node: <b>choose</b> (push onto the
        path), <b>explore</b> (recurse), <b>un-choose</b> (pop it back off). Record a <b>copy</b> of the path at a
        complete state, and <b>prune</b> any branch you can already prove is doomed.
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
        The unifying idea: enumerate a space of choices by walking a decision tree deliberately, taking back each
        move as you leave it. Use a <b>start index</b> when order does not matter (subsets, combinations) and a{" "}
        <b>used-array</b> when it does (permutations). Reach for backtracking when you must produce every valid
        configuration — not when a single optimum can be folded down with dynamic programming or greedy choice.
      </div>
    </div>
  );
}
