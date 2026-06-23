"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { Lesson, LessonActivity, LessonAutosave, GeneratedArtifact, Tag, KnowledgeGraphData } from "@/types";
import { AudioSection } from "@/components/lesson/AudioSection";
import { ReadingSection } from "@/components/lesson/ReadingSection";
import { MediaSection } from "@/components/lesson/MediaSection";
import { InteractiveSection } from "@/components/lesson/InteractiveSection";
import { PythonSection } from "@/components/lesson/PythonSection";
import { AssessmentSection } from "@/components/lesson/AssessmentSection";
import { MultipleChoiceAssessmentSection } from "@/components/lesson/MultipleChoiceAssessmentSection";
import { NextLessonDiagnosticsSection } from "@/components/lesson/NextLessonDiagnosticsSection";
import { KnowledgeGraphOrientation } from "@/components/lesson/KnowledgeGraphOrientation";
import { debounce, postAutosave, type SaveStatus } from "@/lib/autosave";
import { DiscardLessonModal } from "@/components/DiscardLessonModal";
import type { NextLessonDiagnostic } from "@/lib/lesson-content/schema";

interface LessonData {
  lesson: Lesson;
  activities: LessonActivity[];
  autosave: LessonAutosave[];
  artifacts: GeneratedArtifact[];
  tags: Tag[];
  subjectTags: Tag[];
}

// Canonical section order. Multiple `interactive` activities keep their relative
// (stable-sorted) order, so a lesson can show several visualization perspectives.
const ACTIVITY_ORDER = ["audio", "reading", "media", "interactive", "practice_code", "assessment"];

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
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const [discardRegenRef, setDiscardRegenRef] = useState<string | null>(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string>>({});
  // End-of-lesson freeform next-lesson diagnostics. Autosaved like answers;
  // answering them never completes the lesson.
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<string, string>>({});
  // Quiz session state: serialized JSON blob stored in assessment_answers under key "__quiz__".
  // Stored separately from freeform answers so both can coexist in the same autosave row.
  const [quizStateSerialized, setQuizStateSerialized] = useState<string | null>(null);
  // True when the MC quiz has been passed — gates the "Mark Complete" button.
  const [quizPassed, setQuizPassed] = useState(false);
  // True when the lesson's assessment activity includes a MC quiz.
  const [hasQuiz, setHasQuiz] = useState(false);
  const [codeDraft, setCodeDraft] = useState<string>("");
  const [runOutput, setRunOutput] = useState<string>("");
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  // Widget state is keyed per interactive activity id so a lesson with several
  // visualizations restores each one independently.
  const [widgetStates, setWidgetStates] = useState<Record<number, Record<string, number>>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/lessons/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LessonData;
        setData(json);

        // Detect if the lesson has an MC quiz in any assessment activity.
        const assessmentAct = json.activities.find((a) => a.activity_type === "assessment");
        if (assessmentAct?.content) {
          try {
            const ac = JSON.parse(assessmentAct.content) as Record<string, unknown>;
            if (ac.quiz && typeof ac.quiz === "object" && Array.isArray((ac.quiz as Record<string, unknown>).questions)) {
              setHasQuiz(true);
            }
          } catch { /* ignore parse errors */ }
        }

        // Restore autosaved state if available.
        const latest = json.autosave[0];
        if (latest) {
          if (latest.code_draft) setCodeDraft(latest.code_draft);
          if (latest.run_output) setRunOutput(latest.run_output);
          if (latest.test_results) setTestResults(JSON.parse(latest.test_results));
          if (latest.assessment_answers) {
            const aa = JSON.parse(latest.assessment_answers) as Record<string, string>;
            // __quiz__ holds serialized QuizSessionState; __diag__ holds diagnostic
            // answers; the rest are freeform assessment answers.
            if (aa.__quiz__) {
              setQuizStateSerialized(aa.__quiz__);
              // If the restored quiz is already passed, reflect that in the gate.
              try {
                const qs = JSON.parse(aa.__quiz__) as { passed?: boolean };
                if (qs.passed) setQuizPassed(true);
              } catch { /* ignore */ }
            }
            if (aa.__diag__) {
              try {
                setDiagnosticAnswers(JSON.parse(aa.__diag__) as Record<string, string>);
              } catch { /* ignore */ }
            }
            const rest = Object.fromEntries(
              Object.entries(aa).filter(([k]) => k !== "__quiz__" && k !== "__diag__")
            ) as Record<string, string>;
            setAssessmentAnswers(rest);
          }
          setLastSavedAt(latest.saved_at);
        }

        // Restore each interactive widget's state, scoped to its own activity row,
        // so multiple visualizations in one lesson restore independently.
        const restored: Record<number, Record<string, number>> = {};
        for (const act of json.activities) {
          if (act.activity_type !== "interactive") continue;
          const widgetRow = json.autosave.find((r) => r.activity_id === act.id && r.widget_state);
          if (widgetRow?.widget_state) {
            try {
              restored[act.id] = JSON.parse(widgetRow.widget_state) as Record<string, number>;
            } catch {
              /* ignore malformed widget state */
            }
          }
        }
        setWidgetStates(restored);
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

  // Quiz state autosave: merges __quiz__ key into the assessment_answers JSON blob,
  // preserving any diagnostic answers already captured.
  function triggerQuizAutosave(serialized: string) {
    if (!data) return;
    const assessmentActivity = data.activities.find((a) => a.activity_type === "assessment");
    const merged: Record<string, string> = { ...assessmentAnswers, __quiz__: serialized };
    if (Object.keys(diagnosticAnswers).length) merged.__diag__ = JSON.stringify(diagnosticAnswers);
    debouncedSave({
      lesson_id: data.lesson.id,
      learner_id: LEARNER_ID,
      activity_id: assessmentActivity?.id,
      assessment_answers: merged,
      last_edited_at: new Date().toISOString(),
    });
    setQuizStateSerialized(serialized);
  }

  // Diagnostic autosave: merges __diag__ into the assessment-activity blob,
  // preserving freeform answers + quiz state. Never marks the lesson complete.
  function triggerDiagAutosave(diag: Record<string, string>) {
    if (!data) return;
    const assessmentActivity = data.activities.find((a) => a.activity_type === "assessment");
    const merged: Record<string, string> = { ...assessmentAnswers, __diag__: JSON.stringify(diag) };
    if (quizStateSerialized) merged.__quiz__ = quizStateSerialized;
    debouncedSave({
      lesson_id: data.lesson.id,
      learner_id: LEARNER_ID,
      activity_id: assessmentActivity?.id,
      assessment_answers: merged,
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
    setWidgetStates((prev) => ({ ...prev, [activityId]: state }));
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
          diagnostic_answers: diagnosticAnswers,
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

  const { lesson, activities, artifacts, tags: lessonTags, subjectTags } = data;

  // Parse authored knowledge graph orientation (optional — falls back to tag-derived view)
  const knowledgeGraphData: KnowledgeGraphData | null = (() => {
    if (!lesson.knowledge_graph_data) return null;
    try { return JSON.parse(lesson.knowledge_graph_data) as KnowledgeGraphData; }
    catch { return null; }
  })();

  // Sort activities in canonical order
  const sorted = [...activities].sort((a, b) => {
    const ai = ACTIVITY_ORDER.indexOf(a.activity_type);
    const bi = ACTIVITY_ORDER.indexOf(b.activity_type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const audioArtifact = artifacts.find((a) => a.artifact_type === "audio");

  const lessonGoals: string[] = lesson.goals ? JSON.parse(lesson.goals) : [];

  // End-of-lesson next-lesson diagnostics (parsed from the lesson row).
  const diagnostics: NextLessonDiagnostic[] = (() => {
    if (!lesson.next_lesson_diagnostics) return [];
    try {
      const parsed = JSON.parse(lesson.next_lesson_diagnostics) as NextLessonDiagnostic[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Context for recording per-question assessment evidence (tags + signals).
  const assessContext = { learnerId: LEARNER_ID, subjectId: lesson.subject_id, lessonId: lesson.id };

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

            {/* Discard button — only for incomplete lessons */}
            {!completed && !discarded && lesson.status !== "completed" && (
              <button
                onClick={() => setShowDiscardModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-colors"
                title="Discard this lesson and request a replacement"
              >
                Discard
              </button>
            )}

            {/* Complete button — gated on MC quiz pass when quiz is present */}
            {!completed && !discarded ? (
              <button
                onClick={handleComplete}
                disabled={completing || lesson.status === "completed" || (hasQuiz && !quizPassed)}
                title={hasQuiz && !quizPassed ? "Pass the quiz first (6 correct answers required)" : undefined}
                className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {completing ? "Completing..." : "Mark Complete"}
              </button>
            ) : completed ? (
              <span className="px-3 py-1.5 text-sm font-medium bg-green-50 text-green-700 rounded-lg border border-green-100">
                Completed
              </span>
            ) : (
              <span className="px-3 py-1.5 text-sm font-medium bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                Discarded
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

        {/* Knowledge graph orientation */}
        <KnowledgeGraphOrientation
          graphData={knowledgeGraphData}
          subjectTags={subjectTags}
          lessonTags={lessonTags}
          subjectTitle={lesson.title}
        />

        {/* Completion notice */}
        {completed && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            <div>
              <strong>Lesson completed.</strong> The next-lesson hook has been dispatched. Check back soon for your next lesson.
            </div>
          </div>
        )}

        {/* Discarded notice */}
        {discarded && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2">
            <span className="mt-0.5">&#9888;</span>
            <div>
              <strong>Lesson discarded.</strong> A replacement lesson has been requested.
              {discardRegenRef && (
                <span className="block text-xs mt-1 text-amber-600 font-mono">Ref: {discardRegenRef}</span>
              )}
              <span className="block mt-1 text-amber-600">
                This lesson is no longer in your active queue. Your mastery score has not changed.
              </span>
            </div>
          </div>
        )}

        {/* Completion clarification */}
        {!completed && !discarded && (
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
          if (activity.activity_type === "reading") {
            return <ReadingSection key={activity.id} activity={activity} />;
          }
          if (activity.activity_type === "media") {
            return <MediaSection key={activity.id} activity={activity} />;
          }
          if (activity.activity_type === "interactive") {
            return (
              <InteractiveSection
                key={activity.id}
                activity={activity}
                initialState={widgetStates[activity.id]}
                onStateChange={(s) => triggerWidgetAutosave(activity.id, s.controls)}
              />
            );
          }
          if (activity.activity_type === "practice_code") {
            return (
              <PythonSection
                key={activity.id}
                activity={activity}
                learnerId={LEARNER_ID}
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
              <div key={activity.id} className="space-y-6">
                {/* MC quiz — renders only when the activity content includes a "quiz" field */}
                <MultipleChoiceAssessmentSection
                  activity={activity}
                  savedQuizState={quizStateSerialized}
                  onStateChange={triggerQuizAutosave}
                  onPassedChange={setQuizPassed}
                  assessContext={assessContext}
                />
                {/* Freeform written response section — always shown */}
                <AssessmentSection
                  activity={activity}
                  answers={assessmentAnswers}
                  onChange={(answers) => {
                    setAssessmentAnswers(answers);
                    triggerAutosave({ assessment_answers: answers });
                  }}
                />
              </div>
            );
          }
          return null;
        })}

        {/* End-of-lesson next-lesson diagnostics — autosave only, never completes */}
        {diagnostics.length > 0 && !discarded && (
          <NextLessonDiagnosticsSection
            diagnostics={diagnostics}
            answers={diagnosticAnswers}
            disabled={completed}
            onChange={(next) => {
              setDiagnosticAnswers(next);
              triggerDiagAutosave(next);
            }}
          />
        )}

        {/* Bottom action row */}
        {!completed && !discarded && (
          <div className="pt-4 pb-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setShowDiscardModal(true)}
              className="px-5 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              Discard lesson
            </button>
            <button
              onClick={handleComplete}
              disabled={completing || (hasQuiz && !quizPassed)}
              title={hasQuiz && !quizPassed ? "Pass the quiz first (6 correct answers required)" : undefined}
              className="px-8 py-3 font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {completing ? "Completing..." : "Mark Lesson Complete"}
            </button>
          </div>
        )}
      </div>

      {/* Discard lesson modal */}
      {showDiscardModal && (
        <DiscardLessonModal
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          learnerId={LEARNER_ID}
          onDiscarded={(result) => {
            setShowDiscardModal(false);
            setDiscarded(true);
            setDiscardRegenRef(result.regeneration_job.ref ?? null);
          }}
          onCancel={() => setShowDiscardModal(false)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-gray-100 text-gray-600",
    in_progress: "bg-blue-50 text-blue-700",
    completed: "bg-green-50 text-green-700",
    skipped: "bg-gray-50 text-gray-400",
    discarded: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] ?? "bg-gray-50 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
