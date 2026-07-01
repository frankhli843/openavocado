"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2, Monitor, Smartphone } from "lucide-react";
import type { LessonActivity, PracticeCodeContent, CodeTest } from "@/types";
import { createPyodideExecutor, stubExecutor, type PythonExecutor } from "@/lib/python-sandbox";
import { MarkdownText } from "@/components/MarkdownText";

// CodeMirror is client-only (uses DOM APIs). Dynamically import to skip SSR.
const CodeMirrorEditor = dynamic(() => import("./PythonEditor"), { ssr: false, loading: () => null });

interface PythonSectionProps {
  activity: LessonActivity;
  learnerId: number;
  initialCode: string;
  initialOutput: string;
  initialTests: Record<string, string>;
  onChange: (code: string, output: string, tests: Record<string, string>) => void;
  reserveChatRail?: boolean;
  lessonTitle?: string;
  lessonDescription?: string | null;
}

type PreviewMode = "desktop" | "phone";

/**
 * Scaffolded code exercise with a real submission workflow.
 *
 * The learner gets a task prompt, constraints, guided steps, progressive hints,
 * starter code, and visible public tests. Running checks the public tests;
 * submitting also runs hidden tests (whose assertions are never shown).
 * Progressive hints may eventually reveal the answer path, but the learner
 * still writes and submits code that passes. Drafts, output, and test results
 * autosave; passing tests is recorded as a mastery signal but never
 * auto-completes the lesson.
 *
 * The editor uses CodeMirror (via @uiw/react-codemirror) for Python syntax
 * highlighting, auto-indentation, bracket matching, and fullscreen/focus mode.
 */
export function PythonSection({
  activity,
  learnerId,
  initialCode,
  initialOutput,
  initialTests,
  onChange,
  reserveChatRail = false,
  lessonTitle = "Untitled lesson",
  lessonDescription = null,
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);
  const [codeFeedbackLoading, setCodeFeedbackLoading] = useState(false);
  const executorRef = useRef(executor);
  const isPhonePreview = previewMode === "phone" && !isFullscreen;

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

  // Close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const handleCodeChange = useCallback(
    (value: string) => {
      setCode(value);
      onChange(value, output, testResults);
    },
    [output, testResults, onChange]
  );

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
    setCodeFeedback(null);
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
      try {
        await fetch("/api/code-submission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activity_id: activity.id, learner_id: learnerId, passed }),
        });
      } catch {
        /* submission signal is best-effort */
      }
      setCodeFeedbackLoading(true);
      try {
        const response = await fetch("/api/code-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lesson_title: lessonTitle,
            lesson_description: lessonDescription,
            exercise_title: activity.title ?? "Code exercise",
            exercise_prompt: content.prompt ?? activity.title ?? "Code exercise",
            starter_code: starterCode,
            learner_code: code,
            interpreter_output: newOutput,
            public_test_results: publicTests.map((test) => ({
              id: test.id,
              description: test.description,
              status: results[test.id] === "pass" ? "pass" : results[test.id] === "fail" ? "fail" : "not_run",
            })),
            hidden_test_summary: hiddenTests.length > 0
              ? { total: hiddenTests.length, passed: hiddenTests.filter((test) => results[test.id] === "pass").length }
              : null,
            all_passed: passed,
          }),
        });
        const json = (await response.json()) as { enabled?: boolean; feedback?: string | null };
        if (json.enabled && json.feedback) setCodeFeedback(json.feedback);
      } catch {
        setCodeFeedback("I could not generate AI feedback for this submission. Use the visible output and test results to pick the next edit.");
      } finally {
        setCodeFeedbackLoading(false);
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
  const fullscreenClass = reserveChatRail
    ? "fixed inset-y-0 left-0 right-0 z-50 bg-white text-gray-900 flex flex-col xl:right-[28rem]"
    : "fixed inset-0 z-50 bg-white text-gray-900 flex flex-col";

  const codeFeedbackPanel = (codeFeedbackLoading || codeFeedback) ? (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-950">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-700">AI code feedback</div>
      {codeFeedbackLoading ? (
        <p>Reading your code and test output...</p>
      ) : codeFeedback ? (
        <MarkdownText text={codeFeedback} />
      ) : null}
    </div>
  ) : null;

  const optionalNotice = (
    <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm leading-6 text-sky-950">
      <strong className="font-semibold">Optional coding reinforcement.</strong>{" "}
      This section is meant to deepen the lesson if you already have some coding experience. You can skip it and still complete the lesson.
    </div>
  );

  const walkthroughPanel = content.walkthrough?.steps?.length ? (
    <div className="rounded-lg border border-gray-100 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Walkthrough</div>
        <h3 className="mt-0.5 text-sm font-semibold text-gray-800">
          {content.walkthrough.title ?? "How to think about this exercise"}
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {content.walkthrough.steps.map((step, index) => (
          <div key={`${step.title}-${index}`} className="grid gap-3 px-4 py-3 sm:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="text-sm font-semibold text-gray-800">
                {index + 1}. {step.title}
              </div>
              <p className="mt-1 text-sm leading-6 text-gray-600">{step.detail}</p>
            </div>
            {(step.input || step.output || step.visual) && (
              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs leading-5 text-gray-600">
                {step.visual && <div className="mb-2 font-medium text-gray-700">{step.visual}</div>}
                {step.input && (
                  <div className="grid grid-cols-[4.5rem_1fr] gap-2">
                    <span className="font-semibold uppercase tracking-wide text-gray-400">Input</span>
                    <code className="font-mono text-gray-700">{step.input}</code>
                  </div>
                )}
                {step.output && (
                  <div className="mt-1 grid grid-cols-[4.5rem_1fr] gap-2">
                    <span className="font-semibold uppercase tracking-wide text-gray-400">Output</span>
                    <code className="font-mono text-gray-700">{step.output}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const ioExamplesPanel = content.io_examples?.length ? (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/40">
      <div className="border-b border-emerald-100 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Expected inputs and outputs</div>
        <p className="mt-1 text-sm leading-6 text-emerald-950">
          Use these examples to check the behavior before thinking about syntax.
        </p>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        {content.io_examples.map((example) => (
          <div key={example.label} className="rounded-lg border border-emerald-100 bg-white p-3">
            <div className="text-sm font-semibold text-gray-800">{example.label}</div>
            <div className="mt-2 grid gap-2 text-xs">
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-gray-400">Input</div>
                <pre className="overflow-x-auto rounded bg-gray-50 px-3 py-2 font-mono text-gray-700">{example.input}</pre>
              </div>
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-gray-400">Expected output</div>
                <pre className="overflow-x-auto rounded bg-emerald-50 px-3 py-2 font-mono text-emerald-900">{example.expected_output}</pre>
              </div>
            </div>
            {example.explanation && <p className="mt-2 text-xs leading-5 text-gray-500">{example.explanation}</p>}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const visualizationPanel = content.visualization?.items?.length ? (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Code behavior map</div>
      <h3 className="mt-0.5 text-sm font-semibold text-gray-800">{content.visualization.title}</h3>
      {content.visualization.description && (
        <p className="mt-1 text-sm leading-6 text-gray-600">{content.visualization.description}</p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {content.visualization.items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="relative rounded-lg border border-indigo-100 bg-white p-3">
            <div className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              item.role === "input"
                ? "bg-blue-50 text-blue-700"
                : item.role === "output"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
            }`}>
              {item.role ?? "step"}
            </div>
            <div className="text-sm font-semibold text-gray-800">{item.label}</div>
            <code className="mt-1 block break-words font-mono text-xs leading-5 text-gray-700">{item.value}</code>
            {item.note && <p className="mt-2 text-xs leading-5 text-gray-500">{item.note}</p>}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const workedExamples = content.worked_examples && content.worked_examples.length > 0 ? (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {isPhonePreview ? "Reference answers" : "Full code examples"}
      </div>
      <div className={`grid gap-3 ${isPhonePreview ? "grid-cols-1" : "lg:grid-cols-2"}`}>
        {content.worked_examples.map((example) => (
          <details
            key={example.label}
            open={isPhonePreview}
            className="rounded-lg border border-gray-100 bg-gray-50/50"
          >
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-gray-700">
              {example.title ?? (example.label === "concise" ? "Best concise version" : "Basic readable version")}
            </summary>
            {example.explanation && (
              <p className="border-t border-gray-100 px-3 py-2 text-xs leading-5 text-gray-500">
                {example.explanation}
              </p>
            )}
            <pre className="max-h-[28rem] overflow-auto border-t border-gray-100 bg-white px-3 py-3 text-xs leading-5 text-gray-700">
              <code>{example.code}</code>
            </pre>
          </details>
        ))}
      </div>
    </div>
  ) : null;

  // Shared editor area rendered both inline and in fullscreen overlay
  const editorArea = (
    <div className={`flex h-full flex-col ${isPhonePreview ? "min-h-[360px]" : ""}`}>
      <div
        className={`mb-1.5 font-mono text-gray-400 ${
          isPhonePreview ? "flex flex-col gap-0.5 text-[11px] leading-4" : "flex items-center gap-2 text-xs"
        }`}
      >
        <span>Python 3 (Pyodide/WASM)</span>
        {!isPhonePreview && <span className="text-gray-300">·</span>}
        <span className="text-gray-500 text-xs">syntax highlighting · auto-indent · Tab=4 spaces</span>
      </div>
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-blue-200">
        <CodeMirrorEditor
          value={code}
          onChange={handleCodeChange}
          height={isFullscreen ? "100%" : isPhonePreview ? "360px" : "208px"}
          fullscreen={isFullscreen}
        />
      </div>
    </div>
  );

  const actionBar = (
    <div className={`flex flex-wrap items-center gap-2 ${isPhonePreview ? "items-stretch" : ""}`}>
      <button
        onClick={handleRun}
        disabled={running || submitting || pyStatus !== "ready"}
        className={`flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 ${
          isPhonePreview ? "flex-1" : ""
        }`}
      >
        {running ? "Running..." : "Run tests"}
      </button>
      <button
        onClick={handleSubmit}
        disabled={running || submitting || pyStatus !== "ready"}
        className={`flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40 ${
          isPhonePreview ? "flex-1" : ""
        }`}
      >
        {submitting ? "Submitting..." : "Submit"}
      </button>
      <button
        onClick={handleReset}
        disabled={running || submitting}
        className="px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-40"
      >
        Reset
      </button>
      <button
        onClick={() => setIsFullscreen((v) => !v)}
        title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen focus mode"}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className={`rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-200 ${
          isPhonePreview ? "" : "ml-auto"
        }`}
      >
        {isFullscreen ? (
          <>
            <Minimize2 className="inline h-3.5 w-3.5 mr-1.5 align-[-2px]" aria-hidden="true" />
            Exit focus
          </>
        ) : (
          <>
            <Maximize2 className="inline h-3.5 w-3.5 mr-1.5 align-[-2px]" aria-hidden="true" />
            Focus
          </>
        )}
      </button>
      {hints.length > 0 && (
        <button
          onClick={() => setHintsShown((n) => Math.min(n + 1, hints.length))}
          disabled={hintsShown >= hints.length}
          className={`rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-40 ${
            isPhonePreview ? "w-full" : ""
          }`}
        >
          {hintsShown >= hints.length ? "All hints shown" : `Show hint (${hintsShown}/${hints.length})`}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          className={fullscreenClass}
          role="dialog"
          aria-modal={!reserveChatRail}
          aria-label="Python code editor fullscreen"
        >
          {/* Fullscreen header */}
          <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
            <span className="text-xl" aria-hidden="true">&#128187;</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-gray-800">{activity.title ?? "Code Exercise"}</span>
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
                  pyStatus === "ready" ? "bg-green-400" : pyStatus === "loading" ? "bg-yellow-400 animate-pulse" : "bg-red-400"
                }`}
              />
              {pyStatus === "ready" ? "Pyodide ready" : pyStatus === "loading" ? "Loading Python..." : "Python unavailable"}
            </span>
          </div>
          {/* Fullscreen body: side-by-side on wide screens, stacked on narrow */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 overflow-hidden">
            {/* Left: editor */}
            <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
              {optionalNotice}
              {content.prompt && (
                <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-4 py-3 shrink-0">
                  <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Your task</div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content.prompt}</p>
                </div>
              )}
              <div className="flex-1 min-h-0 flex flex-col">
                {editorArea}
              </div>
              <div className="shrink-0">{actionBar}</div>
            </div>
            {/* Right: output + tests */}
            <div className="lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50/40 flex flex-col gap-3 p-4 overflow-y-auto">
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
              {(output || running || submitting) && (
                <div>
                  <div className="text-xs text-gray-400 mb-1.5 font-mono">Output</div>
                  <pre className="w-full min-h-12 px-4 py-3 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
                    {running || submitting ? "Running..." : output}
                  </pre>
                </div>
              )}
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
                              : "bg-white border border-gray-200 text-gray-500"
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
              {hiddenTests.length > 0 && (
                <div
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm border ${
                    submitted
                      ? hiddenPassedCount === hiddenTests.length
                        ? "bg-green-50 border-green-100 text-green-700"
                        : "bg-red-50 border-red-100 text-red-700"
                      : "bg-white border-gray-200 text-gray-500"
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
              {submitted && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm border ${
                    allPassed
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-amber-50 border-amber-200 text-amber-900"
                  }`}
                >
                  {allPassed ? (
                    <span><strong>Solution accepted.</strong> All public and hidden tests pass.</span>
                  ) : (
                    <span><strong>Not passing yet.</strong> Some tests fail. Use the hints, adjust your code, and submit again.</span>
                  )}
                </div>
              )}
              {codeFeedbackPanel}
            </div>
          </div>
        </div>
      )}

      {/* Inline card (always rendered, editor area hidden when fullscreen so CodeMirror doesn't double-mount) */}
      <div
        className={previewMode === "phone" ? "mx-auto w-full max-w-[390px] pb-20" : "w-full"}
        data-preview-mode={previewMode}
      >
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 px-4 py-4 border-b border-gray-100 bg-gray-50/50 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl" aria-hidden="true">&#128187;</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Code Exercise</div>
              <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
                {activity.title ?? "Code Exercise"}
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <PreviewModeToggle mode={previewMode} onChange={setPreviewMode} />
            {!isPhonePreview && (
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
            )}
          </div>
        </div>

        <div className={`space-y-4 ${isPhonePreview ? "p-3 text-[15px]" : "p-4 sm:p-6"}`}>
          {optionalNotice}

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

          {walkthroughPanel}
          {ioExamplesPanel}
          {visualizationPanel}
          {isPhonePreview && workedExamples}
          {isPhonePreview && !workedExamples && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              Reference answers have not been generated for this older coding exercise yet.
            </div>
          )}

          {/* Editor — hidden in phone preview and when fullscreen so CodeMirror doesn't double-mount */}
          {!isFullscreen && !isPhonePreview && (
            <div className="space-y-2">
              {editorArea}
            </div>
          )}
          {isFullscreen && !isPhonePreview && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500 text-center">
              Editor open in focus mode &mdash; press <kbd className="bg-white border border-gray-200 text-gray-600 px-1 rounded text-xs">Esc</kbd> or click <strong>⊠ Exit focus</strong> to return.
            </div>
          )}

          {/* Actions */}
          {!isFullscreen && !isPhonePreview && actionBar}

          {!isFullscreen && !isPhonePreview && workedExamples}

          {/* Focus mode button when fullscreen not active (also in actionBar, but easy to find here) */}

          {/* Progressive hints */}
          {!isFullscreen && !isPhonePreview && hintsShown > 0 && (
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
          {!isFullscreen && !isPhonePreview && (output || running || submitting) && (
            <div>
              <div className="text-xs text-gray-400 mb-1.5 font-mono">Output</div>
              <pre className="w-full min-h-12 px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
                {running || submitting ? "Running..." : output}
              </pre>
            </div>
          )}

          {/* Public tests */}
          {!isFullscreen && !isPhonePreview && publicTests.length > 0 && (
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
          {!isFullscreen && !isPhonePreview && hiddenTests.length > 0 && (
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
          {!isFullscreen && !isPhonePreview && submitted && (
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
                <span><strong>Not passing yet.</strong> Some tests fail. Open another hint if needed, adjust your code, and submit again.</span>
              )}
            </div>
          )}

          {!isFullscreen && !isPhonePreview && codeFeedbackPanel}

          {!isPhonePreview && <p className="text-xs text-gray-400">
            Your code, output, and results save automatically. Submitting or passing tests does not complete the lesson — use &quot;Mark Complete&quot; for that.
          </p>}
        </div>
      </div>
      </div>
    </>
  );
}

function PreviewModeToggle({
  mode,
  onChange,
}: {
  mode: PreviewMode;
  onChange: (mode: PreviewMode) => void;
}) {
  return (
    <div
      className="inline-flex h-8 overflow-hidden rounded-lg border border-gray-200 bg-white p-0.5"
      role="group"
      aria-label="Code exercise preview mode"
    >
      <button
        type="button"
        onClick={() => onChange("desktop")}
        aria-pressed={mode === "desktop"}
        title="View desktop mode"
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
          mode === "desktop" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        }`}
      >
        <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
        Desktop
      </button>
      <button
        type="button"
        onClick={() => onChange("phone")}
        aria-pressed={mode === "phone"}
        title="View phone mode"
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
          mode === "phone" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        }`}
      >
        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
        Phone
      </button>
    </div>
  );
}
