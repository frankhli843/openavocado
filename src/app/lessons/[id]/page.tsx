"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { Lesson, LessonActivity, LessonAutosave, GeneratedArtifact } from "@/types";
import { AudioSection } from "@/components/lesson/AudioSection";
import { InteractiveSection } from "@/components/lesson/InteractiveSection";
import { PythonSection } from "@/components/lesson/PythonSection";
import { AssessmentSection } from "@/components/lesson/AssessmentSection";
import { debounce, postAutosave, type SaveStatus } from "@/lib/autosave";

interface LessonData {
  lesson: Lesson;
  activities: LessonActivity[];
  autosave: LessonAutosave[];
  artifacts: GeneratedArtifact[];
}

const ACTIVITY_ORDER = ["audio", "interactive", "practice_code", "assessment"];

const LEARNER_ID = 1; // TODO: replace with auth session

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string>>({});
  const [codeDraft, setCodeDraft] = useState<string>("");
  const [runOutput, setRunOutput] = useState<string>("");
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [widgetState, setWidgetState] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/lessons/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LessonData;
        setData(json);

        // Restore autosaved state if available
        const latest = json.autosave[0];
        if (latest) {
          if (latest.code_draft) setCodeDraft(latest.code_draft);
          if (latest.run_output) setRunOutput(latest.run_output);
          if (latest.test_results) setTestResults(JSON.parse(latest.test_results));
          if (latest.assessment_answers) setAssessmentAnswers(JSON.parse(latest.assessment_answers));
          setLastSavedAt(latest.saved_at);
        }

        // Restore interactive widget state (scoped to the interactive activity row)
        const interactive = json.activities.find((a) => a.activity_type === "interactive");
        if (interactive) {
          const widgetRow = json.autosave.find(
            (r) => r.activity_id === interactive.id && r.widget_state
          );
          if (widgetRow?.widget_state) {
            try {
              setWidgetState(JSON.parse(widgetRow.widget_state) as Record<string, number>);
            } catch {
              /* ignore malformed widget state */
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Autosave — debounced, fires on any content change
  const [debouncedSave] = debounce(
    async (payload: Parameters<typeof postAutosave>[0]) => {
      setSaveStatus("saving");
      await postAutosave(payload);
      const now = new Date().toISOString();
      setLastSavedAt(now);
      setSaveStatus("saved");
    },
    1200
  );

  function triggerAutosave(patch: {
    code_draft?: string;
    run_output?: string;
    test_results?: Record<string, string>;
    assessment_answers?: Record<string, string>;
  }) {
    if (!data) return;
    const codeActivity = data.activities.find((a) => a.activity_type === "practice_code");
    debouncedSave({
      lesson_id: data.lesson.id,
      learner_id: LEARNER_ID,
      activity_id: codeActivity?.id,
      ...patch,
      last_edited_at: new Date().toISOString(),
    });
  }

  // Widget state autosaves under its own activity row, so it never collides with
  // the code/assessment row. Like all autosave, it never marks the lesson complete.
  const [debouncedWidgetSave] = debounce(
    async (payload: Parameters<typeof postAutosave>[0]) => {
      setSaveStatus("saving");
      await postAutosave(payload);
      const now = new Date().toISOString();
      setLastSavedAt(now);
      setSaveStatus("saved");
    },
    1200
  );

  function triggerWidgetAutosave(activityId: number, state: Record<string, number>) {
    if (!data) return;
    setWidgetState(state);
    debouncedWidgetSave({
      lesson_id: data.lesson.id,
      learner_id: LEARNER_ID,
      activity_id: activityId,
      widget_state: state,
      last_edited_at: new Date().toISOString(),
    });
  }

  async function handleComplete() {
    if (!data) return;
    setCompleting(true);
    try {
      const codeActivity = data.activities.find((a) => a.activity_type === "practice_code");
      const res = await fetch("/api/complete-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: data.lesson.id,
          learner_id: LEARNER_ID,
          assessment_answers: assessmentAnswers,
          code_results: codeActivity
            ? [
                {
                  activity_title: codeActivity.title ?? "Python Exercise",
                  code: codeDraft,
                  test_results: testResults,
                  run_output: runOutput,
                },
              ]
            : [],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCompleted(true);
    } catch (e) {
      console.error("Completion failed:", e);
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">
        Loading lesson...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error ?? "Lesson not found"}</p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { lesson, activities, artifacts } = data;

  // Sort activities in canonical order
  const sorted = [...activities].sort((a, b) => {
    const ai = ACTIVITY_ORDER.indexOf(a.activity_type);
    const bi = ACTIVITY_ORDER.indexOf(b.activity_type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const audioArtifact = artifacts.find((a) => a.artifact_type === "audio");

  const lessonGoals: string[] = lesson.goals ? JSON.parse(lesson.goals) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-11 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
            <Link href="/" className="hover:text-gray-800 transition-colors shrink-0">
              &#8592; Dashboard
            </Link>
            <span className="text-gray-300">/</span>
            <span className="truncate text-gray-700 font-medium">{lesson.title}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Save status */}
            <span className="text-xs text-gray-400">
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved" && lastSavedAt
                ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                : ""}
            </span>

            {/* Complete button — only path to completion */}
            {!completed ? (
              <button
                onClick={handleComplete}
                disabled={completing || lesson.status === "completed"}
                className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {completing ? "Completing..." : "Mark Complete"}
              </button>
            ) : (
              <span className="px-3 py-1.5 text-sm font-medium bg-green-50 text-green-700 rounded-lg border border-green-100">
                Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lesson content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-xl font-bold text-gray-900">{lesson.title}</h1>
            <StatusBadge status={completed ? "completed" : lesson.status} />
          </div>
          {lesson.description && (
            <p className="text-sm text-gray-500 leading-relaxed mb-3">{lesson.description}</p>
          )}
          {lessonGoals.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Goals
              </div>
              <ul className="space-y-1">
                {lessonGoals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Completion notice */}
        {completed && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            <div>
              <strong>Lesson completed.</strong> The next-lesson hook has been dispatched. Check back soon for your next lesson.
            </div>
          </div>
        )}

        {/* Completion clarification */}
        {!completed && (
          <div className="px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-600 flex items-center gap-2">
            <span>&#8505;</span>
            Progress is saved automatically. Click &quot;Mark Complete&quot; only when you&apos;re done with the whole lesson.
          </div>
        )}

        {/* Activities */}
        {sorted.map((activity) => {
          if (activity.activity_type === "audio") {
            return (
              <AudioSection
                key={activity.id}
                activity={activity}
                artifact={audioArtifact}
              />
            );
          }
          if (activity.activity_type === "interactive") {
            return (
              <InteractiveSection
                key={activity.id}
                activity={activity}
                initialState={widgetState}
                onStateChange={(s) => triggerWidgetAutosave(activity.id, s.controls)}
              />
            );
          }
          if (activity.activity_type === "practice_code") {
            return (
              <PythonSection
                key={activity.id}
                activity={activity}
                initialCode={codeDraft}
                initialOutput={runOutput}
                initialTests={testResults}
                onChange={(code, output, tests) => {
                  setCodeDraft(code);
                  setRunOutput(output);
                  setTestResults(tests);
                  triggerAutosave({ code_draft: code, run_output: output, test_results: tests });
                }}
              />
            );
          }
          if (activity.activity_type === "assessment") {
            return (
              <AssessmentSection
                key={activity.id}
                activity={activity}
                answers={assessmentAnswers}
                onChange={(answers) => {
                  setAssessmentAnswers(answers);
                  triggerAutosave({ assessment_answers: answers });
                }}
              />
            );
          }
          return null;
        })}

        {/* Bottom complete button */}
        {!completed && (
          <div className="pt-4 pb-8 flex justify-center">
            <button
              onClick={handleComplete}
              disabled={completing}
              className="px-8 py-3 font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              {completing ? "Completing..." : "Mark Lesson Complete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-gray-100 text-gray-600",
    in_progress: "bg-blue-50 text-blue-700",
    completed: "bg-green-50 text-green-700",
    skipped: "bg-gray-50 text-gray-400",
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] ?? "bg-gray-50 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
