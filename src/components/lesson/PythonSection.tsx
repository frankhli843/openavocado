"use client";

import { useEffect, useRef, useState } from "react";
import type { LessonActivity } from "@/types";
import { createPyodideExecutor, stubExecutor, type PythonExecutor } from "@/lib/python-sandbox";

interface PythonSectionProps {
  activity: LessonActivity;
  initialCode: string;
  initialOutput: string;
  initialTests: Record<string, string>;
  onChange: (code: string, output: string, tests: Record<string, string>) => void;
}

export function PythonSection({
  activity,
  initialCode,
  initialOutput,
  initialTests,
  onChange,
}: PythonSectionProps) {
  const content: {
    language?: string;
    starter_code?: string;
    tests?: Array<{ id: string; description: string; assert: string }>;
  } = activity.content ? JSON.parse(activity.content) : {};

  const starterCode = content.starter_code ?? "# Write your Python code here\n";
  const [code, setCode] = useState(initialCode || starterCode);
  const [output, setOutput] = useState(initialOutput);
  const [testResults, setTestResults] = useState<Record<string, string>>(initialTests);
  const [running, setRunning] = useState(false);
  const [executor, setExecutor] = useState<PythonExecutor>(stubExecutor);
  const [pyStatus, setPyStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const executorRef = useRef(executor);

  // Load Pyodide in browser
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    async function loadPy() {
      try {
        // Dynamically import Pyodide from CDN (avoids SSR issues)
        // Use indirect import to bypass TypeScript's module resolution for CDN URL
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

  async function handleRun() {
    setRunning(true);
    try {
      const tests = content.tests ?? [];
      const result = await executorRef.current.run({ code, tests });

      const outLines = [
        result.stdout || "(no output)",
        result.stderr ? `\nSTDERR:\n${result.stderr}` : "",
        result.error ? `\nERROR:\n${result.error}` : "",
      ]
        .filter(Boolean)
        .join("");

      const newOutput = outLines.trim();
      const newTestResults: Record<string, string> = {};
      for (const t of result.test_results) {
        newTestResults[t.id] = t.passed ? "pass" : "fail";
      }

      setOutput(newOutput);
      setTestResults(newTestResults);
      onChange(code, newOutput, newTestResults);
    } finally {
      setRunning(false);
    }
  }

  const tests = content.tests ?? [];
  const allPassed = tests.length > 0 && tests.every((t) => testResults[t.id] === "pass");

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xl" aria-hidden="true">&#128187;</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Python Practice</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
            {activity.title ?? "Code Exercise"}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Python runtime status */}
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
            pyStatus === "ready"
              ? "bg-green-50 text-green-700"
              : pyStatus === "loading"
              ? "bg-yellow-50 text-yellow-700"
              : "bg-red-50 text-red-700"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              pyStatus === "ready" ? "bg-green-500" :
              pyStatus === "loading" ? "bg-yellow-400 animate-pulse" : "bg-red-400"
            }`} />
            {pyStatus === "ready" ? "Pyodide ready" : pyStatus === "loading" ? "Loading Python..." : "Python unavailable"}
          </span>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={running || pyStatus !== "ready"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {running ? "Running..." : "&#9654; Run"}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Editor */}
        <div>
          <div className="text-xs text-gray-400 mb-1.5 font-mono">Python 3 (Pyodide/WASM)</div>
          <textarea
            className="code-editor w-full h-52 px-4 py-3 bg-gray-950 text-green-300 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors text-sm"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              onChange(e.target.value, output, testResults);
            }}
            spellCheck={false}
          />
        </div>

        {/* Output */}
        {(output || running) && (
          <div>
            <div className="text-xs text-gray-400 mb-1.5 font-mono">Output</div>
            <pre className="w-full min-h-12 px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {running ? "Running..." : output}
            </pre>
          </div>
        )}

        {/* Test results */}
        {tests.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs text-gray-400 font-mono">Tests</div>
              {allPassed && (
                <span className="text-xs text-green-600 font-medium">All passed</span>
              )}
            </div>
            <div className="space-y-1.5">
              {tests.map((test) => {
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
                    <span>
                      {result === "pass" ? "✓" : result === "fail" ? "✗" : "○"}
                    </span>
                    <span>{test.description}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Note: autosave does not complete the lesson */}
        <p className="text-xs text-gray-400">
          Code and results are saved automatically. Running code does not complete the lesson.
        </p>
      </div>
    </div>
  );
}
