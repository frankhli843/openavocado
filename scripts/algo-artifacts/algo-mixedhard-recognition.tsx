import { useState } from "react";

/**
 * Interactive "pattern recognition" dashboard for the Mixed Hard lesson.
 * Three problems are displayed without pattern labels. The learner clicks
 * "Reveal Pattern" on each card to see the technique and the recognition
 * signal that gives it away.
 */

const PROBLEMS = [
  {
    id: 1,
    title: "Minimum Window Substring",
    lc: "LC 76",
    statement: "Given strings s and t, find the minimum window in s that contains every character in t (including duplicates). Return \"\" if no such window exists.",
    constraints: "1 <= s.length, t.length <= 10^5. s and t consist of uppercase and lowercase English letters.",
    pattern: "Sliding Window",
    signal: "\"minimum substring\" + coverage condition = expand-right, shrink-left sliding window with frequency map",
    color: "#3b82f6",
  },
  {
    id: 2,
    title: "Task Scheduler",
    lc: "LC 621",
    statement: "Given an array of tasks (characters) and a cooldown n, return the minimum number of intervals to finish all tasks. Same tasks must be separated by at least n intervals.",
    constraints: "1 <= tasks.length <= 10^4. tasks[i] is uppercase English letter. 0 <= n <= 100.",
    pattern: "Heap + Greedy",
    signal: "\"minimum intervals\" + cooldown constraint = schedule most-frequent first using max-heap or math formula",
    color: "#8b5cf6",
  },
  {
    id: 3,
    title: "Palindrome Partitioning",
    lc: "LC 131",
    statement: "Given a string s, partition s such that every substring is a palindrome. Return all possible palindrome partitionings.",
    constraints: "1 <= s.length <= 16. s contains only lowercase English letters.",
    pattern: "Backtracking",
    signal: "\"return ALL possible\" + small n (16) = enumerate with choose-explore-unchoose backtracking",
    color: "#10b981",
  },
];

export default function MixedHardRecognition() {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allRevealed = revealed.size === PROBLEMS.length;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "100%", padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Pattern Recognition Challenge</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Read each problem. Identify the pattern before revealing the answer.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PROBLEMS.map((p) => {
          const isRevealed = revealed.has(p.id);
          return (
            <div
              key={p.id}
              style={{
                border: `1px solid ${isRevealed ? p.color : "#e2e8f0"}`,
                borderRadius: 10,
                padding: 14,
                background: isRevealed ? `${p.color}08` : "#fff",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 6 }}>
                <div style={{ maxWidth: "100%", overflowWrap: "break-word" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>{p.lc}</span>
                </div>
                {isRevealed && (
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      background: p.color,
                      color: "#fff",
                    }}
                  >
                    {p.pattern}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 13, color: "#374151", marginBottom: 6, lineHeight: 1.5, overflowWrap: "break-word" }}>
                {p.statement}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, fontStyle: "italic" }}>
                Constraints: {p.constraints}
              </div>

              {isRevealed && (
                <div
                  style={{
                    background: `${p.color}12`,
                    border: `1px solid ${p.color}40`,
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 13,
                    color: "#1e293b",
                    marginBottom: 10,
                  }}
                >
                  <strong>Recognition signal:</strong> {p.signal}
                </div>
              )}

              <button
                onClick={() => toggle(p.id)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  border: `1px solid ${isRevealed ? "#d1d5db" : p.color}`,
                  background: isRevealed ? "#fff" : `${p.color}15`,
                  color: isRevealed ? "#6b7280" : p.color,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {isRevealed ? "Hide" : "Reveal Pattern"}
              </button>
            </div>
          );
        })}
      </div>

      {allRevealed && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            fontSize: 13,
            color: "#166534",
            fontWeight: 600,
          }}
        >
          All patterns revealed. The recognition checklist: read fully, check output type, check constraints, match to template, verify with examples, then code.
        </div>
      )}
    </div>
  );
}
