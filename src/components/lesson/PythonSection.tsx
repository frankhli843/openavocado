"use client";

import { useEffect, useRef, useState } from "react";
import type { LessonActivity, PracticeCodeContent, CodeTest } from "@/types";
import { createPyodideExecutor, stubExecutor, type PythonExecutor } from "@/lib/python-sandbox";

interface PythonSectionProps {
  activity: LessonActivity;
  learnerId: number;
  initialCode: string;
  initialOutput: string;
  initialTests: Record<string, string>;
  onChange: (code: string, output: string, tests: Record<string, string>) => void;
}

/**
 * Scaffolded code exercise with a real submission workflow.
 *
 * The learner gets a task prompt, constraints, guided steps, progressive hints,
 * starter code, and visible public tests. Running checks the public tests;
 * submitting also runs hidden tests (whose assertions are never shown). The
 * completed solution is never displayed inline — the learner must write and
 * submit code that passes. Drafts, output, and test results autosave; passing
 * tests is recorded as a mastery signal but never auto-completes the lesson.
 */
export function PythonSection({
  activity,
  learnerId,
  initialCode,
  initialOutput,
  initialTests,
  onChange,
}: PythonSectionProps) {
  const content: PracticeCodeContent = activity.content ? JSON.parse(activity.content) : {};

  const starterCode = content.starter_code ?? "# Write your Python code here\n";
  const publicTests: CodeTest[] = content.tests ?? [];
  const hiddenTests: CodeTest[] = content.hidden_tests ?? [];
  const hints = content.hints ?? [];
  const constraints = content.constraints ?? [];
  const guidedSteps = content.guided_steps ?? [];

  const [code, setCode] = useState(initialCode || starterCode);
  const [output, setOutput] = useState(initialOutput);
  const [testResults, setTestResults] = useState<Record<string, string>>(initialTests);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [executor, setExecutor] = useState<PythonExecutor>(stubExecutor);
  const [pyStatus, setPyStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const executorRef = useRef(executor);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    async function loadPy() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type PyodideModule = { loadPyodide: (opts: { indexURL: string }) => Promise<any> };
        // eslint-disable-next-line no-new-func
        const dynamicImport = new Function("url", "return import(url)") as (url: string) => Promise<PyodideModule>;
        const pyodideModule = await dynamicImport(
          "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.mjs"
        );
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
        console.warn("[PythonSection] Pyodide load failed:", e);
        if (!cancelled) setPyStatus("unavailable");
      }
    }
    loadPy();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runTests(tests: CodeTest[]): Promise<{ output: string; results: Record<string, string> }> {
    const result = await executorRef.current.run({ code, tests });
    const outLines = [
      result.stdout || "(no output)",
      result.stderr ? `\nSTDERR:\n${result.stderr}` : "",
      result.error ? `\nERROR:\n${result.error}` : "",
    ]
      .filter(Boolean)
      .join("");
    const results: Record<string, string> = {};
    for (const t of result.test_results) {
      results[t.id] = t.passed ? "pass" : "fail";
    }
    return { output: outLines.trim(), results };
  }

  async function handleRun() {
    setRunning(true);
    try {
      const { output: newOutput, results } = await runTests(publicTests);
      const merged = { ...testResults, ...results };
      setOutput(newOutput);
      setTestResults(merged);
      onChange(code, newOutput, merged);
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const { output: newOutput, results } = await runTests([...publicTests, ...hiddenTests]);
      const merged = { ...testResults, ...results };
      setOutput(newOutput);
      setTestResults(merged);
      setSubmitted(true);
      onChange(code, newOutput, merged);
      // Record the submission as a mastery signal if all tests pass. This never
      // auto-completes the lesson — manual completion remains the only trigger.
      const all = [...publicTests, ...hiddenTests];
      const passed = all.length > 0 && all.every((t) => results[t.id] === "pass");
      if (passed) {
        try {
          await fetch("/api/code-submission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activity_id: activity.id, learner_id: learnerId, passed: true }),
          });
        } catch {
          /* submission signal is best-effort */
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setCode(starterCode);
    setOutput("");
    setTestResults({});
    setSubmitted(false);
    onChange(starterCode, "", {});
  }

  const publicPassed = publicTests.length > 0 && publicTests.every((t) => testResults[t.id] === "pass");
  const hiddenPassedCount = hiddenTests.filter((t) => testResults[t.id] === "pass").length;
  const allPassed =
    [...publicTests, ...hiddenTests].length > 0 &&
    [...publicTests, ...hiddenTests].every((t) => testResults[t.id] === "pass");

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xl" aria-hidden="true">&#128187;</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Code Exercise</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
            {activity.title ?? "Code Exercise"}
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0 ${
            pyStatus === "ready"
              ? "bg-green-50 text-green-700"
              : pyStatus === "loading"
              ? "bg-yellow-50 text-yellow-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              pyStatus === "ready" ? "bg-green-500" : pyStatus === "loading" ? "bg-yellow-400 animate-pulse" : "bg-red-400"
            }`}
          />
          {pyStatus === "ready" ? "Pyodide ready" : pyStatus === "loading" ? "Loading Python..." : "Python unavailable"}
        </span>
      </div>

      <div className="p-6 space-y-4">
        {/* Task prompt */}
        {content.prompt && (
          <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-4 py-3">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Your task</div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content.prompt}</p>
          </div>
        )}

        {/* Constraints */}
        {constraints.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Constraints</div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
              {constraints.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {/* Guided steps */}
        {guidedSteps.length > 0 && (
          <details className="rounded-lg border border-gray-100 bg-gray-50/40 px-4 py-2.5">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
              Guided steps
            </summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm text-gray-600">
              {guidedSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </details>
        )}

        {/* Editor */}
        <div>
          <div className="text-xs text-gray-400 mb-1.5 font-mono">Python 3 (Pyodide/WASM)</div>
          <textarea
            aria-label="Python code editor"
            className="code-editor w-full h-52 px-4 py-3 bg-gray-950 text-green-300 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors text-sm"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              onChange(e.target.value, output, testResults);
            }}
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running || submitting || pyStatus !== "ready"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {running ? "Running..." : "Run tests"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={running || submitting || pyStatus !== "ready"}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button
            onClick={handleReset}
            disabled={running || submitting}
            className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
          >
            Reset
          </button>
          {hints.length > 0 && (
            <button
              onClick={() => setHintsShown((n) => Math.min(n + 1, hints.length))}
              disabled={hintsShown >= hints.length}
              className="ml-auto px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 disabled:opacity-40 transition-colors"
            >
              {hintsShown >= hints.length ? "All hints shown" : `Show hint (${hintsShown}/${hints.length})`}
            </button>
          )}
        </div>

        {/* Progressive hints */}
        {hintsShown > 0 && (
          <div className="space-y-1.5">
            {hints.slice(0, hintsShown).map((h, i) => (
              <div key={i} className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-900">
                <span className="font-semibold mr-1.5">Hint {h.level ?? i + 1}:</span>
                {h.text}
              </div>
            ))}
          </div>
        )}

        {/* Output */}
        {(output || running || submitting) && (
          <div>
            <div className="text-xs text-gray-400 mb-1.5 font-mono">Output</div>
            <pre className="w-full min-h-12 px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {running || submitting ? "Running..." : output}
            </pre>
          </div>
        )}

        {/* Public tests */}
        {publicTests.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs text-gray-400 font-mono">Tests</div>
              {publicPassed && <span className="text-xs text-green-600 font-medium">All public tests passed</span>}
            </div>
            <div className="space-y-1.5">
              {publicTests.map((test) => {
                const result = testResults[test.id];
                return (
                  <div
                    key={test.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      result === "pass"
                        ? "bg-green-50 border border-green-100 text-green-700"
                        : result === "fail"
                        ? "bg-red-50 border border-red-100 text-red-700"
                        : "bg-gray-50 border border-gray-100 text-gray-500"
                    }`}
                  >
                    <span>{result === "pass" ? "✓" : result === "fail" ? "✗" : "○"}</span>
                    <span>{test.description}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hidden tests — count only, assertions never shown */}
        {hiddenTests.length > 0 && (
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm border ${
              submitted
                ? hiddenPassedCount === hiddenTests.length
                  ? "bg-green-50 border-green-100 text-green-700"
                  : "bg-red-50 border-red-100 text-red-700"
                : "bg-gray-50 border-gray-100 text-gray-500"
            }`}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true">&#128274;</span>
              {hiddenTests.length} hidden test{hiddenTests.length > 1 ? "s" : ""}
            </span>
            <span className="font-medium">
              {submitted ? `${hiddenPassedCount}/${hiddenTests.length} passed` : "run on submit"}
            </span>
          </div>
        )}

        {/* Submission feedback */}
        {submitted && (
          <div
            className={`rounded-lg px-4 py-3 text-sm border ${
              allPassed
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            {allPassed ? (
              <span><strong>Solution accepted.</strong> All public and hidden tests pass. You can still revise, then mark the lesson complete when ready.</span>
            ) : (
              <span><strong>Not passing yet.</strong> Some tests fail. Use the hints, adjust your code, and submit again — the answer is never shown for you.</span>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400">
          Your code, output, and results save automatically. Submitting or passing tests does not complete the lesson — use &quot;Mark Complete&quot; for that.
        </p>
      </div>
    </div>
  );
}
