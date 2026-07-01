"use client";

import { useState, useCallback, useRef } from "react";
import type { LessonActivity } from "@/types";
import type { MultipleChoiceQuestion, MultipleChoiceQuizContent } from "@/lib/lesson-content/schema";
import { normalizeQuizChoiceOrder } from "@/lib/lesson-content/quiz-choice-order";
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
  isIdkSelection,
  getCorrectIndices,
  isMultiSelectQuestion,
  IDK_LABEL,
} from "@/lib/quiz-state";
import { requestRephrase } from "@/lib/acp-rephrase";

/** Context needed to record per-question assessment evidence (tags + signals). */
export interface QuizAssessContext {
  learnerId: number;
  subjectId: number;
  lessonId: number;
}

interface MultipleChoiceAssessmentSectionProps {
  activity: LessonActivity;
  /** Restored serialized quiz state from autosave. Null means start fresh. */
  savedQuizState: string | null;
  /** Called whenever quiz state changes — pass to parent for autosave. */
  onStateChange: (serialized: string) => void;
  /** Whether the "Mark Complete" button should be enabled. */
  onPassedChange: (passed: boolean) => void;
  /** When provided, each graded answer posts evidence to /api/assess. */
  assessContext?: QuizAssessContext | null;
}

/**
 * Record a graded MC answer as assessment evidence (tag + difficulty + outcome).
 * Fire-and-forget: a tagging failure is logged but never blocks the quiz.
 */
function recordMcAssessment(
  ctx: QuizAssessContext,
  q: { id: string; concept: string; difficulty: "easy" | "medium" | "hard"; question: string },
  outcome: "correct" | "incorrect" | "idk",
  answerText: string
) {
  void fetch("/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      learner_id: ctx.learnerId,
      subject_id: ctx.subjectId,
      lesson_id: ctx.lessonId,
      question_id: q.id,
      question_text: q.question,
      question_type: "mc",
      concept: q.concept,
      difficulty: q.difficulty,
      mc_outcome: outcome,
      answer_text: answerText,
    }),
  }).catch((e) => console.error("[quiz] assess failed", e));
}

/** Extract quiz config from activity content. Returns null if missing/malformed. */
function parseQuizContent(activity: LessonActivity): MultipleChoiceQuizContent | null {
  if (!activity.content) return null;
  try {
    const raw = JSON.parse(activity.content) as Record<string, unknown>;
    const quiz = raw.quiz as MultipleChoiceQuizContent | undefined;
    if (!quiz?.questions?.length) return null;
    return normalizeQuizChoiceOrder(quiz);
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
  assessContext,
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
      assessContext={assessContext ?? null}
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
  assessContext: QuizAssessContext | null;
}

function QuizEngine({ activity, quiz, savedQuizState, onStateChange, onPassedChange, assessContext }: QuizEngineProps) {
  const questions: MultipleChoiceQuestion[] = quiz.questions;
  const consecutive_required = quiz.consecutive_correct_required;
  const pass_threshold = quiz.pass_threshold ?? consecutive_required ?? 6;
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
    const fresh = initQuizSession(questions, pass_threshold, consecutive_required);
    return fresh;
  });

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
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
    if (!currentQuestion) return;
    const idkIndex = currentQuestion.choices.length;
    const multi = isMultiSelectQuestion(currentQuestion);
    if (!multi || index === idkIndex) {
      setSelectedIndices([index]);
      return;
    }
    setSelectedIndices((prev) => {
      const withoutIdk = prev.filter((idx) => idx !== idkIndex);
      return withoutIdk.includes(index)
        ? withoutIdk.filter((idx) => idx !== index)
        : [...withoutIdk, index].sort((a, b) => a - b);
    });
  }

  function handleSubmit() {
    if (selectedIndices.length === 0 || !currentItem || submitted) return;
    setSubmitted(true);

    const newSession = gradeAnswer(
      session,
      currentItem,
      selectedIndices,
      questions,
      retryCounterRef.current
    );
    setSession(newSession);
    persist(newSession);

    // Record assessment evidence (tag + difficulty + outcome) for this answer.
    // Retry items trace back to their origin question's concept + difficulty.
    if (assessContext && currentQuestion) {
      const originId =
        currentItem.kind === "original" ? currentItem.question_id : currentItem.origin_question_id;
      const originQ = questions.find((q) => q.id === originId);
      if (originQ) {
        const fb = newSession.feedback;
        const outcome: "correct" | "incorrect" | "idk" = fb?.correct
          ? "correct"
          : fb?.is_idk
          ? "idk"
          : "incorrect";
        const answerText = selectedIndices.some((idx) => isIdkSelection(currentQuestion.choices.length, idx))
          ? IDK_LABEL
          : selectedIndices.map((idx) => currentQuestion.choices[idx]).filter(Boolean).join("; ");
        recordMcAssessment(assessContext, originQ, outcome, answerText);
      }
    }

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
            correct_indices: originalQ.correct_indices,
            allow_multiple_correct: originalQ.allow_multiple_correct,
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
    setSelectedIndices([]);
    setSubmitted(false);
  }

  // ─── Passed screen ────────────────────────────────────────────────────────

  const thresholdMet = consecutive_required
    ? (session.current_streak ?? 0) >= consecutive_required
    : session.correct_count >= pass_threshold;

  if (session.passed || (isExhausted && thresholdMet)) {
    return (
      <div className="border-t border-gray-100 pt-4">
        <QuizHeader activity={activity} />
        <div className="space-y-4 px-3 py-8 text-center sm:px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <span className="text-3xl">&#10003;</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Assessment passed</h3>
            <p className="text-sm text-gray-500 mt-1">
              {consecutive_required
                ? `You answered ${consecutive_required} questions correctly in a row.`
                : `You answered ${session.correct_count} questions correctly.`}
              You can now mark the lesson complete.
            </p>
          </div>
          <div className="flex justify-center">
            <ProgressBar
              correct={session.correct_count}
              threshold={pass_threshold}
              streak={session.current_streak ?? 0}
              consecutiveRequired={consecutive_required}
            />
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
      <div className="border-t border-gray-100 pt-4">
        <QuizHeader activity={activity} />
        <div className="px-3 py-6 text-center text-sm text-gray-400 sm:px-6">
          {isExhausted && session.correct_count < pass_threshold
            ? `You completed all questions with ${session.correct_count} / ${pass_threshold} correct. Some retry questions are being prepared.`
            : "Loading next question..."}
        </div>
      </div>
    );
  }

  const { question, choices, explanation } = currentQuestion;
  const multiSelect = isMultiSelectQuestion(currentQuestion);
  const correctIndices = getCorrectIndices(currentQuestion);
  const feedback = session.feedback;
  const nextWouldPass = consecutive_required
    ? (session.current_streak ?? 0) >= consecutive_required
    : session.correct_count >= pass_threshold;
  const nextButtonLabel =
    session.current_index + 1 >= session.queue.length
      ? nextWouldPass
        ? "See results"
        : "Finish"
      : "Next question";

  // ─── Main quiz card ───────────────────────────────────────────────────────

  return (
    <div className="border-t border-gray-100 pt-4">
      <QuizHeader activity={activity} />

      <div className="space-y-5 px-3 py-4 sm:p-6">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <ProgressBar
            correct={session.correct_count}
            threshold={pass_threshold}
            streak={session.current_streak ?? 0}
            consecutiveRequired={consecutive_required}
          />
          <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
            Question {session.current_index + 1} of {session.queue.length}
            {formatRetryCount(session.queue.length - questions.length)}
          </span>
        </div>

        {/* Retry notice */}
        {isRetryItem && (
          <div className="flex items-center gap-2 border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
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
        <div className="space-y-2" role={multiSelect ? "group" : "radiogroup"} aria-label="Answer choices">
          {choices.map((choice, index) => {
            const isSelected = selectedIndices.includes(index);
            const showResult = submitted && feedback;
            const isCorrectChoice = correctIndices.includes(index);

            let borderClass = "border-gray-200 hover:bg-gray-50 hover:border-gray-300";
            let bgClass = "bg-white";
            let indicator: React.ReactNode = null;

            if (showResult) {
              if (isCorrectChoice) {
                borderClass = "border-green-400";
                bgClass = "bg-green-50";
                indicator = <span className="text-green-600 shrink-0">&#10003;</span>;
              } else if (isSelected) {
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
                role={multiSelect ? "checkbox" : "radio"}
                aria-checked={isSelected}
                onClick={() => handleSelect(index)}
                disabled={submitted}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-colors text-sm text-gray-700 ${borderClass} ${bgClass} disabled:cursor-default`}
              >
                <span
                  className={`mt-0.5 shrink-0 w-5 h-5 ${multiSelect ? "rounded" : "rounded-full"} border-2 flex items-center justify-center text-xs font-bold
                    ${isSelected && !submitted ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-500"}
                    ${submitted && isCorrectChoice ? "border-green-500 bg-green-500 text-white" : ""}
                    ${submitted && isSelected && !isCorrectChoice ? "border-red-400 bg-red-400 text-white" : ""}
                  `}
                >
                  {multiSelect && isSelected ? "✓" : String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1 leading-relaxed">{choice}</span>
                {indicator}
              </button>
            );
          })}

          {/* Virtual "I don't know" option — always present, never correct.
              Treated as incorrect but recorded as high-signal uncertainty. */}
          {(() => {
            const idkIndex = choices.length;
            const isSelected = selectedIndices.includes(idkIndex);
            const showResult = submitted && feedback;
            let cls = "border-gray-200 hover:bg-gray-50 hover:border-gray-300 bg-white text-gray-500";
            if (showResult && isSelected) {
              cls = "border-amber-300 bg-amber-50 text-amber-700";
            } else if (isSelected) {
              cls = "border-blue-400 ring-2 ring-blue-100 bg-blue-50 text-gray-700";
            }
            return (
              <button
                type="button"
                role={multiSelect ? "checkbox" : "radio"}
                aria-checked={isSelected}
                onClick={() => handleSelect(idkIndex)}
                disabled={submitted}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors text-sm italic ${cls} disabled:cursor-default`}
              >
                <span className="shrink-0 w-5 h-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-xs font-bold">
                  ?
                </span>
                <span className="flex-1 leading-relaxed">{IDK_LABEL}</span>
              </button>
            );
          })()}
        </div>

        {/* Submit button */}
        {!submitted && (
          <div className="pt-1">
            <button
              onClick={handleSubmit}
              disabled={selectedIndices.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {multiSelect ? "Submit selections" : "Submit answer"}
            </button>
          </div>
        )}

        {/* Feedback panel — stays visible until Next is clicked */}
        {submitted && feedback && (
          <div
            className={`rounded-xl border p-4 space-y-3 ${
              feedback.correct
                ? "bg-green-50 border-green-200"
                : feedback.is_idk
                ? "bg-amber-50 border-amber-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-lg ${feedback.correct ? "text-green-600" : feedback.is_idk ? "text-amber-500" : "text-red-500"}`}>
                {feedback.correct ? "✓" : feedback.is_idk ? "?" : "✗"}
              </span>
              <span className={`text-sm font-semibold ${feedback.correct ? "text-green-700" : feedback.is_idk ? "text-amber-700" : "text-red-700"}`}>
                {feedback.correct ? "Correct!" : feedback.is_idk ? "No problem — here's the answer." : "Not quite."}
              </span>
              {!feedback.correct && (
                <span className={`text-xs ml-auto ${feedback.is_idk ? "text-amber-700" : "text-red-600"}`}>
                  Correct answer: <strong>{feedback.correct_answer}</strong>
                </span>
              )}
            </div>

            <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>

            {!feedback.correct && (
              <p className="border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {feedback.is_idk
                  ? "Saying “I don’t know” is useful signal — we’ll bring this concept back so you can lock it in. No penalty."
                  : "This concept will come back later in a different form. Keep going!"}
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
              {nextButtonLabel}
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
    <div className="flex items-center gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
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

function ProgressBar({
  correct,
  threshold,
  streak,
  consecutiveRequired,
}: {
  correct: number;
  threshold: number;
  streak?: number;
  consecutiveRequired?: number;
}) {
  const activeValue = consecutiveRequired ? streak ?? 0 : correct;
  const activeThreshold = consecutiveRequired ?? threshold;
  const pct = Math.min(100, Math.round((activeValue / activeThreshold) * 100));
  const label = formatQuizProgressLabel({ correct, threshold, streak, consecutiveRequired });
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 min-w-0 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-300 bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 whitespace-nowrap shrink-0">
        {label}
      </span>
    </div>
  );
}

export function formatQuizProgressLabel({
  correct,
  threshold,
  streak,
  consecutiveRequired,
}: {
  correct: number;
  threshold: number;
  streak?: number;
  consecutiveRequired?: number;
}) {
  if (!consecutiveRequired) {
    return `${correct} / ${threshold} correct`;
  }
  const currentStreak = streak ?? 0;
  if (currentStreak >= consecutiveRequired) {
    return `${currentStreak} in a row (target ${consecutiveRequired})`;
  }
  return `${currentStreak} / ${consecutiveRequired} in a row`;
}

export function formatRetryCount(retryCount: number) {
  if (retryCount <= 0) return "";
  return retryCount === 1 ? " (1 retry)" : ` (${retryCount} retries)`;
}
