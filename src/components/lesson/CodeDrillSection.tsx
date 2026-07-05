"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Lightbulb, TimerReset } from "lucide-react";
import type { CodeDrillContent, CodeTest, LessonActivity } from "@/types";
import { createPyodideExecutor, stubExecutor, type PythonExecutor } from "@/lib/python-sandbox";
import {
  buildDrillEvidenceMetadata,
  formatClock,
  isOvertime,
  remainingSeconds,
  unlockedHints,
} from "@/lib/lesson-content/code-drill";

const CodeMirrorEditor = dynamic(() => import("./PythonEditor"), { ssr: false, loading: () => null });

interface CodeDrillSectionProps {
  activity: LessonActivity;
  learnerId: number;
}

/**
 * Feature A — Code Drill Mode.
 *
 * A single-pattern timed rep. The learner sees one prompt and a visible countdown
 * toward a target time, writes code against visible tests, and unlocks progressive
 * hints as elapsed time crosses the drill's thresholds (e.g. 33/66/100%). The timer
 * is informational, never punitive — it keeps running past zero into "overtime" so
 * the learner can finish. On submit, timing + hints-used + attempts are recorded as
 * learning evidence (via /api/code-submission) so the adaptive model can track
 * execution speed, not just correctness.
 */
export function CodeDrillSection({ activity, learnerId }: CodeDrillSectionProps) {
  const content: CodeDrillContent = activity.content
    ? (JSON.parse(activity.content) as CodeDrillContent)
    : { pattern: "", prompt: "", target_seconds: 600, difficulty: "medium", tests: [] };

  const targetSeconds = content.target_seconds || 600;
  const tests: CodeTest[] = content.tests ?? [];
  const hints = content.hints ?? [];
  const starterCode = content.starter_code ?? "# Solve the drill here. The timer is a pacing guide, not a deadline.\n";

  const [code, setCode] = useState(starterCode);
  const [elapsed, setElapsed] = useState(0);
  const [ticking, setTicking] = useState(false);
  const [started, setStarted] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [revealSolution, setRevealSolution] = useState(false);
  const [executor, setExecutor] = useState<PythonExecutor>(stubExecutor);
  const [pyStatus, setPyStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const executorRef = useRef(executor);

  // Load Pyodide once (client-only), same pattern as PythonSection.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    async function loadPy() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type PyodideModule = { loadPyodide: (opts: { indexURL: string }) => Promise<any> };
        // eslint-disable-next-line no-new-func
        const dynamicImport = new Function("url", "return import(url)") as (url: string) => Promise<PyodideModule>;
        const pyodideModule = await dynamicImport("https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.mjs");
        if (cancelled) return;
        const pyodide = await pyodideModule.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/",
        });
        if (cancelled) return;
        const exec = createPyodideExecutor(pyodide);
        setExecutor(exec);
        executorRef.current = exec;
        setPyStatus("ready");
      } catch (e) {
        console.warn("[CodeDrillSection] Pyodide load failed:", e);
        if (!cancelled) setPyStatus("unavailable");
      }
    }
    loadPy();
    return () => {
      cancelled = true;
    };
  }, []);

  // 1-second drill clock. Only advances while ticking and not yet submitted.
  useEffect(() => {
    if (!ticking || submitted) return;
    const id = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [ticking, submitted]);

  function startDrill() {
    setStarted(true);
    setTicking(true);
  }

  async function runTests(list: CodeTest[]): Promise<{ output: string; results: Record<string, string> }> {
    const result = await executorRef.current.run({ code, tests: list });
    const outLines = [
      result.stdout || "(no output)",
      result.stderr ? `\nSTDERR:\n${result.stderr}` : "",
      result.error ? `\nERROR:\n${result.error}` : "",
    ]
      .filter(Boolean)
      .join("");
    const results: Record<string, string> = {};
    for (const t of result.test_results) results[t.id] = t.passed ? "pass" : "fail";
    return { output: outLines.trim(), results };
  }

  async function handleRun() {
    setRunning(true);
    try {
      const { output: newOutput, results } = await runTests(tests);
      setOutput(newOutput);
      setTestResults((prev) => ({ ...prev, ...results }));
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setTicking(false);
    const attemptNo = attempts + 1;
    setAttempts(attemptNo);
    try {
      const { output: newOutput, results } = await runTests(tests);
      setOutput(newOutput);
      setTestResults(results);
      setSubmitted(true);
      const passed = tests.length > 0 && tests.every((t) => results[t.id] === "pass");
      const hintsUsed = unlockedHints(hints, targetSeconds, elapsed).length;
      const drill = buildDrillEvidenceMetadata({
        pattern: content.pattern,
        targetSeconds,
        timeTakenSeconds: elapsed,
        hintsUsed,
        hintsTotal: hints.length,
        attempts: attemptNo,
        passed,
      });
      try {
        await fetch("/api/code-submission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activity_id: activity.id,
            learner_id: learnerId,
            passed,
            code,
            run_output: newOutput,
            test_results: results,
            prompt: content.prompt,
            drill,
          }),
        });
      } catch {
        /* evidence is best-effort */
      }
    } finally {
      setSubmitting(false);
    }
  }

  const visibleHints = unlockedHints(hints, targetSeconds, elapsed);
  const remaining = remainingSeconds(targetSeconds, elapsed);
  const overtime = started && isOvertime(targetSeconds, elapsed);
  const passedAll = submitted && tests.length > 0 && tests.every((t) => testResults[t.id] === "pass");

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">&#9201;&#65039;</span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Code drill · {content.difficulty}
            </div>
            <h2 className="mt-0.5 text-sm font-semibold text-gray-800">
              {activity.title ?? "Timed drill"} · {content.pattern}
            </h2>
          </div>
        </div>
        <div
          className={`rounded-lg px-3 py-1.5 font-mono text-sm font-semibold tabular-nums ${
            overtime ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"
          }`}
          aria-label="drill timer"
        >
          {overtime ? `+${formatClock(elapsed - targetSeconds)} over` : formatClock(remaining)}
        </div>
      </div>

      <div className="space-y-4 px-3 py-4 sm:p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{content.prompt}</p>

        {!started ? (
          <button
            type="button"
            onClick={startDrill}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Start drill ({formatClock(targetSeconds)} target)
          </button>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <CodeMirrorEditor value={code} onChange={setCode} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRun}
                disabled={running || pyStatus === "loading"}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                {pyStatus === "loading" ? "Loading runtime..." : running ? "Running..." : "Run tests"}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || pyStatus === "loading"}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {submitting ? "Submitting..." : "Submit drill"}
              </button>
              {pyStatus === "unavailable" && (
                <span className="text-xs text-amber-600">Python runtime unavailable — check tests manually.</span>
              )}
            </div>

            {tests.length > 0 && (
              <ul className="space-y-1">
                {tests.map((t) => {
                  const status = testResults[t.id];
                  return (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${
                          status === "pass"
                            ? "bg-green-100 text-green-700"
                            : status === "fail"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {status === "pass" ? "✓" : status === "fail" ? "✕" : "•"}
                      </span>
                      <span className="text-gray-700">{t.description}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {output && (
              <pre className="max-h-48 overflow-auto rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-gray-100">
                {output}
              </pre>
            )}

            {hints.length > 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                  Hints ({visibleHints.length}/{hints.length} unlocked)
                </div>
                {visibleHints.length === 0 ? (
                  <p className="text-xs text-amber-700/80">
                    Keep going — the first hint unlocks at {hints[0]?.unlock_at_pct}% of target time.
                  </p>
                ) : (
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-amber-900">
                    {visibleHints.map((h, i) => (
                      <li key={i}>{h.text}</li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {submitted && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  passedAll ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {passedAll
                  ? `Drill complete in ${formatClock(elapsed)} with ${visibleHints.length} hint${
                      visibleHints.length === 1 ? "" : "s"
                    } used.`
                  : "Some tests still fail — reset and take another rep."}
                {content.solution && (
                  <button
                    type="button"
                    onClick={() => setRevealSolution((v) => !v)}
                    className="ml-2 inline-flex items-center gap-1 text-xs font-semibold underline"
                  >
                    <TimerReset className="h-3 w-3" aria-hidden="true" />
                    {revealSolution ? "Hide" : "Show"} reference solution
                  </button>
                )}
              </div>
            )}

            {submitted && revealSolution && content.solution && (
              <pre className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-800">
                {content.solution}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
