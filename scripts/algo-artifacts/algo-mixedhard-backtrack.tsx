import { useState } from "react";

/**
 * Interactive visualization of the backtracking algorithm for
 * Palindrome Partitioning (LC 131). Steps through the decision tree
 * showing how partitions are built one palindrome at a time.
 */

const S = "aab";

function isPalindrome(s: string, lo: number, hi: number): boolean {
  while (lo < hi) {
    if (s[lo] !== s[hi]) return false;
    lo++;
    hi--;
  }
  return true;
}

type TreeStep = {
  path: string[];
  start: number;
  trying: string | null;
  isPalin: boolean;
  result: string[][] | null;
  action: string;
};

function computeSteps(): TreeStep[] {
  const steps: TreeStep[] = [];
  const result: string[][] = [];

  steps.push({
    path: [],
    start: 0,
    trying: null,
    isPalin: false,
    result: null,
    action: `Start backtracking on "${S}". Try every prefix that is a palindrome.`,
  });

  function backtrack(start: number, path: string[]) {
    if (start === S.length) {
      result.push([...path]);
      steps.push({
        path: [...path],
        start,
        trying: null,
        isPalin: true,
        result: result.map((r) => [...r]),
        action: `Reached end. Partition [${path.join(", ")}] is valid. Total: ${result.length}.`,
      });
      return;
    }

    for (let end = start; end < S.length; end++) {
      const substr = S.slice(start, end + 1);
      const palin = isPalindrome(S, start, end);

      steps.push({
        path: [...path],
        start,
        trying: substr,
        isPalin: palin,
        result: result.length > 0 ? result.map((r) => [...r]) : null,
        action: palin
          ? `Try "${substr}" [${start}..${end}]: palindrome. Recurse from ${end + 1}.`
          : `Try "${substr}" [${start}..${end}]: not a palindrome. Skip.`,
      });

      if (palin) {
        path.push(substr);
        backtrack(end + 1, path);
        path.pop();

        if (end + 1 < S.length || end < S.length - 1) {
          steps.push({
            path: [...path],
            start,
            trying: null,
            isPalin: false,
            result: result.length > 0 ? result.map((r) => [...r]) : null,
            action: `Backtrack: un-choose "${substr}". Try next prefix from ${start}.`,
          });
        }
      }
    }
  }

  backtrack(0, []);

  steps.push({
    path: [],
    start: S.length,
    trying: null,
    isPalin: false,
    result: result.map((r) => [...r]),
    action: `Done. Found ${result.length} valid partitions.`,
  });

  return steps;
}

const STEPS = computeSteps();

export default function BacktrackVisualization() {
  const [idx, setIdx] = useState(0);
  const s = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "100%", padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Palindrome Partitioning</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          s = "{S}". Find all ways to partition into palindromes.
        </div>
      </div>

      {/* String with highlight */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
        {S.split("").map((c, i) => {
          const inTrying =
            s.trying !== null && i >= s.start && i < s.start + s.trying.length;
          const inPath = s.path.some((seg, si) => {
            const segStart = s.path.slice(0, si).reduce((acc, p) => acc + p.length, 0);
            return i >= segStart && i < segStart + seg.length;
          });
          return (
            <div
              key={i}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 700,
                background: inTrying
                  ? s.isPalin
                    ? "#dcfce7"
                    : "#fef2f2"
                  : inPath
                  ? "#dbeafe"
                  : "#f1f5f9",
                border: `2px solid ${
                  inTrying
                    ? s.isPalin
                      ? "#22c55e"
                      : "#ef4444"
                    : inPath
                    ? "#3b82f6"
                    : "#e2e8f0"
                }`,
                color: "#1e293b",
                transition: "all 0.15s",
              }}
            >
              {c}
            </div>
          );
        })}
      </div>

      {/* Current path */}
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <strong>Current path:</strong>{" "}
        {s.path.length > 0
          ? s.path.map((seg, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "#dbeafe",
                  marginRight: 4,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {seg}
              </span>
            ))
          : "(empty)"}
      </div>

      {/* Results so far */}
      {s.result && s.result.length > 0 && (
        <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 8 }}>
          <strong>Found:</strong>{" "}
          {s.result.map((r, i) => `[${r.join(", ")}]`).join("  ")}
        </div>
      )}

      {/* Action */}
      <div
        style={{
          background: isLast ? "#f0fdf4" : "#f8fafc",
          border: `1px solid ${isLast ? "#86efac" : "#e2e8f0"}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          fontSize: 13,
          color: isLast ? "#166534" : "#374151",
          fontWeight: isLast ? 700 : 400,
        }}
      >
        {s.action}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: idx === 0 ? "default" : "pointer",
            opacity: idx === 0 ? 0.4 : 1,
          }}
        >
          Back
        </button>
        <button
          onClick={() => setIdx(Math.min(STEPS.length - 1, idx + 1))}
          disabled={isLast}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #10b981",
            background: "#ecfdf5",
            cursor: isLast ? "default" : "pointer",
            opacity: isLast ? 0.4 : 1,
            fontWeight: 600,
          }}
        >
          Next Step
        </button>
        <button
          onClick={() => setIdx(0)}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
        <span style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center" }}>
          Step {idx + 1} of {STEPS.length}
        </span>
      </div>
    </div>
  );
}
