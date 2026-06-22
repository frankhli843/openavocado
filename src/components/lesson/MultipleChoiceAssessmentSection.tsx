"use client";

import { useState, useCallback, useRef } from "react";
import type { LessonActivity } from "@/types";
import type { MultipleChoiceQuestion, MultipleChoiceQuizContent } from "@/lib/lesson-content/schema";
import {
  type QuizSessionState,
  initQuizSession,
  gradeAnswer,
  advanceToNext,
  resolveItemQuestion,
  integrateAcpResult,
  serializeQuizState,
  deserializeQuizState,
  checkPassedAfterFeedback,
} from "@/lib/quiz-state";
import { requestRephrase } from "@/lib/acp-rephrase";

interface MultipleChoiceAssessmentSectionProps {
  activity: LessonActivity;
  /** Restored serialized quiz state from autosave. Null means start fresh. */
  savedQuizState: string | null;
  /** Called whenever quiz state changes — pass to parent for autosave. */
  onStateChange: (serialized: string) => void;
  /** Whether the "Mark Complete" button should be enabled. */
  onPassedChange: (passed: boolean) => void;
}

/** Extract quiz config from activity content. Returns null if missing/malformed. */
function parseQuizContent(activity: LessonActivity): MultipleChoiceQuizContent | null {
  if (!activity.content) return null;
  try {
    const raw = JSON.parse(activity.content) as Record<string, unknown>;
    const quiz = raw.quiz as MultipleChoiceQuizContent | undefined;
    if (!quiz?.questions?.length) return null;
    return quiz;
  } catch {
    return null;
  }
}

// Shared retry counter ref (mutated during gradeAnswer to produce unique retry ids).
// Using a ref ensures stability across re-renders without causing re-renders itself.

export function MultipleChoiceAssessmentSection({
  activity,
  savedQuizState,
  onStateChange,
  onPassedChange,
}: MultipleChoiceAssessmentSectionProps) {
  const quiz = parseQuizContent(activity);

  // If no quiz config, render nothing — the parent shows the freeform section.
  if (!quiz) return null;

  return (
    <QuizEngine
      activity={activity}
      quiz={quiz}
      savedQuizState={savedQuizState}
      onStateChange={onStateChange}
      onPassedChange={onPassedChange}
    />
  );
}

// ─── Inner quiz engine (separate component so parseQuizContent is called outside) ──

interface QuizEngineProps {
  activity: LessonActivity;
  quiz: MultipleChoiceQuizContent;
  savedQuizState: string | null;
  onStateChange: (serialized: string) => void;
  onPassedChange: (passed: boolean) => void;
}

function QuizEngine({ activity, quiz, savedQuizState, onStateChange, onPassedChange }: QuizEngineProps) {
  const questions: MultipleChoiceQuestion[] = quiz.questions;
  const pass_threshold = quiz.pass_threshold ?? 6;
  const retryCounterRef = useRef<{ n: number }>({ n: 0 });

  const [session, setSession] = useState<QuizSessionState>(() => {
    const restored = deserializeQuizState(savedQuizState);
    if (restored) {
      // Keep retryCounter in sync with restored state so new retries get unique ids.
      const maxRetryNum = Math.max(
        0,
        ...restored.queue
          .filter((it) => it.kind === "retry")
          .map((it) => {
            const match = (it.kind === "retry" ? it.retry_id : "").match(/-(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          })
      );
      retryCounterRef.current.n = maxRetryNum;
      onPassedChange(restored.passed);
      return restored;
    }
    const fresh = initQuizSession(questions, pass_threshold);
    return fresh;
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // The current queue item.
  const currentItem = session.queue[session.current_index];
  const isExhausted = !currentItem;

  // Resolve question content for the current item.
  const currentQuestion = currentItem
    ? resolveItemQuestion(currentItem, session, questions)
    : null;

  const isRetryItem = currentItem?.kind === "retry";
  const acpPendingForCurrent =
    currentItem?.kind === "retry" &&
    session.acp_pending.includes(currentItem.origin_question_id);

  const persist = useCallback(
    (newSession: QuizSessionState) => {
      const s = serializeQuizState(newSession);
      onStateChange(s);
      onPassedChange(newSession.passed);
    },
    [onStateChange, onPassedChange]
  );

  function handleSelect(index: number) {
    if (submitted) return;
    setSelectedIndex(index);
  }

  function handleSubmit() {
    if (selectedIndex === null || !currentItem || submitted) return;
    setSubmitted(true);

    const newSession = gradeAnswer(
      session,
      currentItem,
      selectedIndex,
      questions,
      retryCounterRef.current
    );
    setSession(newSession);
    persist(newSession);

    // If wrong, trigger async ACP rephrase for the new retry item.
    if (!newSession.feedback?.correct && currentItem) {
      const origin_id = currentItem.kind === "original" ? currentItem.question_id : currentItem.origin_question_id;
      const originalQ = questions.find((q) => q.id === origin_id);
      const newRetryItem = newSession.queue[newSession.queue.length - 1];

      if (originalQ && newRetryItem?.kind === "retry") {
        const retry_id = newRetryItem.retry_id;
        // Mark as pending, then fire the request.
        const pendingSession = {
          ...newSession,
          acp_pending: [...newSession.acp_pending, origin_id],
        };
        setSession(pendingSession);
        persist(pendingSession);

        requestRephrase({
          retry_id,
          origin_question_id: origin_id,
          original: {
            question: originalQ.question,
            choices: originalQ.choices,
            correct_index: originalQ.correct_index,
            explanation: originalQ.explanation,
            concept: originalQ.concept,
            misconception_target: originalQ.misconception_target,
            rephrase_instructions: originalQ.rephrase_instructions,
          },
        }).then((result) => {
          setSession((prev) => {
            const updated = integrateAcpResult(prev, retry_id, origin_id, result.retry ?? null, questions);
            persist(updated);
            return updated;
          });
        });
      }
    }
  }

  function handleNext() {
    if (!submitted) return;
    const advanced = advanceToNext(session);
    const passed = checkPassedAfterFeedback(session) || advanced.passed;
    const finalSession = { ...advanced, passed };
    setSession(finalSession);
    persist(finalSession);
    setSelectedIndex(null);
    setSubmitted(false);
  }

  // ─── Passed screen ────────────────────────────────────────────────────────

  if (session.passed || (isExhausted && session.correct_count >= pass_threshold)) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <QuizHeader activity={activity} />
        <div className="p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <span className="text-3xl">&#10003;</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Assessment passed</h3>
            <p className="text-sm text-gray-500 mt-1">
              You answered {session.correct_count} questions correctly.
              You can now mark the lesson complete.
            </p>
          </div>
          <div className="flex justify-center">
            <ProgressBar correct={session.correct_count} threshold={pass_threshold} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Progress is saved. Use &ldquo;Mark Complete&rdquo; when you&apos;re done with the whole lesson.
          </p>
        </div>
      </div>
    );
  }

  // ─── No questions available ───────────────────────────────────────────────

  if (!currentQuestion) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <QuizHeader activity={activity} />
        <div className="p-6 text-center text-gray-400 text-sm">
          {isExhausted && session.correct_count < pass_threshold
            ? `You completed all questions with ${session.correct_count} / ${pass_threshold} correct. Some retry questions are being prepared.`
            : "Loading next question..."}
        </div>
      </div>
    );
  }

  const { question, choices, correct_index, explanation } = currentQuestion;
  const feedback = session.feedback;

  // ─── Main quiz card ───────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <QuizHeader activity={activity} />

      <div className="p-6 space-y-5">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <ProgressBar correct={session.correct_count} threshold={pass_threshold} />
          <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
            Question {session.current_index + 1} of {session.queue.length}
            {session.queue.length > questions.length ? ` (${session.queue.length - questions.length} retry)` : ""}
          </span>
        </div>

        {/* Retry notice */}
        {isRetryItem && (
          <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 flex items-center gap-2">
            <span>&#8635;</span>
            <span>
              This concept came back for another look.
              {acpPendingForCurrent && " (personalized version being prepared)"}
            </span>
          </div>
        )}

        {/* Question */}
        <div>
          <p className="text-sm font-medium text-gray-800 leading-relaxed">
            {question}
          </p>
        </div>

        {/* Choices */}
        <div className="space-y-2" role="radiogroup" aria-label="Answer choices">
          {choices.map((choice, index) => {
            const isSelected = selectedIndex === index;
            const showResult = submitted && feedback;

            let borderClass = "border-gray-200 hover:bg-gray-50 hover:border-gray-300";
            let bgClass = "bg-white";
            let indicator: React.ReactNode = null;

            if (showResult) {
              if (index === correct_index) {
                borderClass = "border-green-400";
                bgClass = "bg-green-50";
                indicator = <span className="text-green-600 shrink-0">&#10003;</span>;
              } else if (isSelected && index !== correct_index) {
                borderClass = "border-red-300";
                bgClass = "bg-red-50";
                indicator = <span className="text-red-500 shrink-0">&#10005;</span>;
              }
            } else if (isSelected) {
              borderClass = "border-blue-400 ring-2 ring-blue-100";
              bgClass = "bg-blue-50";
            }

            return (
              <button
                key={index}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelect(index)}
                disabled={submitted}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-colors text-sm text-gray-700 ${borderClass} ${bgClass} disabled:cursor-default`}
              >
                <span
                  className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold
                    ${isSelected && !submitted ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-500"}
                    ${submitted && index === correct_index ? "border-green-500 bg-green-500 text-white" : ""}
                    ${submitted && isSelected && index !== correct_index ? "border-red-400 bg-red-400 text-white" : ""}
                  `}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1 leading-relaxed">{choice}</span>
                {indicator}
              </button>
            );
          })}
        </div>

        {/* Submit button */}
        {!submitted && (
          <div className="pt-1">
            <button
              onClick={handleSubmit}
              disabled={selectedIndex === null}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Submit answer
            </button>
          </div>
        )}

        {/* Feedback panel — stays visible until Next is clicked */}
        {submitted && feedback && (
          <div
            className={`rounded-xl border p-4 space-y-3 ${
              feedback.correct
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-lg ${feedback.correct ? "text-green-600" : "text-red-500"}`}>
                {feedback.correct ? "✓" : "✗"}
              </span>
              <span className={`text-sm font-semibold ${feedback.correct ? "text-green-700" : "text-red-700"}`}>
                {feedback.correct ? "Correct!" : "Not quite."}
              </span>
              {!feedback.correct && (
                <span className="text-xs text-red-600 ml-auto">
                  Correct answer: <strong>{feedback.correct_answer}</strong>
                </span>
              )}
            </div>

            <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>

            {!feedback.correct && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                This concept will come back later in a different form. Keep going!
              </p>
            )}

            <button
              onClick={handleNext}
              className={`mt-1 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                feedback.correct
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {session.current_index + 1 >= session.queue.length
                ? session.correct_count + (feedback.correct ? 1 : 0) >= pass_threshold
                  ? "See results"
                  : "Finish"
                : "Next question"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuizHeader({ activity }: { activity: LessonActivity }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
      <span className="text-xl" aria-hidden="true">&#127891;</span>
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quiz</div>
        <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
          {activity.title ?? "Multiple-Choice Assessment"}
        </h2>
      </div>
    </div>
  );
}

function ProgressBar({ correct, threshold }: { correct: number; threshold: number }) {
  const pct = Math.min(100, Math.round((correct / threshold) * 100));
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 min-w-0 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-300 bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 whitespace-nowrap shrink-0">
        {correct} / {threshold} correct
      </span>
    </div>
  );
}
