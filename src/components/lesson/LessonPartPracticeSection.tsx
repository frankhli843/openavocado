"use client";

import { useMemo, useState } from "react";
import type { Lesson, LessonActivity } from "@/types";
import type { LessonPartPracticeContent, LessonPartPracticeQuestion } from "@/lib/lesson-content/schema";
import {
  gradePatternRecognition,
  patternRecognitionCorrectChoices,
} from "@/lib/lesson-content/pattern-recognition";
import type { QuizAssessContext } from "./MultipleChoiceAssessmentSection";

type AnswerState = Record<string, string | string[]>;
type FeedbackState = Record<
  string,
  {
    correct: boolean | null;
    text: string;
    loading?: boolean;
    semanticFeedback?: string;
    semanticLoading?: boolean;
    semanticError?: string;
  }
>;

type AnswerJudgment = {
  verdict: "correct" | "partially_correct" | "incorrect" | "unclear";
  feedback: string;
};

interface LessonPartPracticeSectionProps {
  activity: LessonActivity;
  lesson?: Pick<Lesson, "title" | "description"> | null;
  practice: LessonPartPracticeContent;
  assessContext?: QuizAssessContext | null;
}

export function LessonPartPracticeSection({
  activity,
  lesson,
  practice,
  assessContext,
}: LessonPartPracticeSectionProps) {
  const [answers, setAnswers] = useState<AnswerState>({});
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const questions = practice.questions;
  const score = useMemo(
    () => Object.values(feedback).filter((item) => item.correct === true).length,
    [feedback]
  );
  const threshold = practice.pass_threshold ?? Math.min(4, questions.length);

  function setAnswer(questionId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function recordEvidence(
    q: LessonPartPracticeQuestion,
    correct: boolean | null,
    answerText: string,
    feedbackText?: string | null
  ) {
    if (!assessContext) return;
    void fetch("/api/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learner_id: assessContext.learnerId,
        subject_id: assessContext.subjectId,
        lesson_id: assessContext.lessonId,
        activity_id: activity.id,
        question_id: `${activity.id}:${q.id}`,
        question_text: q.prompt,
        question_type: q.type === "written" ? "freeform" : "mc",
        concept: q.concept,
        difficulty: q.difficulty,
        mc_outcome: correct ? "correct" : "incorrect",
        answer_text: answerText,
        feedback_text: feedbackText ?? null,
      }),
    }).catch((e) => console.error("[lesson-part-practice] assess failed", e));
  }

  async function grade(q: LessonPartPracticeQuestion) {
    const answer = answers[q.id];
    if (!hasAnswer(q, answer)) return;
    setFeedback((prev) => ({ ...prev, [q.id]: { correct: null, text: "Checking...", loading: true } }));

    if (q.type === "written") {
      const answerText = String(answer ?? "").trim();
      try {
        const judgment = await requestAnswerJudgment({
          lesson,
          question: q,
          answerText,
          questionType: "free_text",
          actualAnswer: q.actual_answer ?? "",
        });
        const verdict = judgment.verdict;
        const correct = verdict === "correct" || verdict === "partially_correct";
        const feedbackText = formatWrittenFeedback(judgment);
        setFeedback((prev) => ({ ...prev, [q.id]: { correct, text: feedbackText } }));
        recordEvidence(q, correct, answerText, feedbackText);
      } catch (err) {
        const feedbackText = formatJudgeError(err);
        setFeedback((prev) => ({
          ...prev,
          [q.id]: { correct: null, text: feedbackText },
        }));
        recordEvidence(q, null, answerText, feedbackText);
      }
      return;
    }

    const result = gradeDeterministic(q, answer);
    setFeedback((prev) => ({ ...prev, [q.id]: { ...result, semanticLoading: true } }));
    recordEvidence(q, result.correct, formatAnswer(q, answer), result.text);
    void enrichWithSemanticFeedback(q, answer, result.text);
  }

  async function enrichWithSemanticFeedback(
    q: LessonPartPracticeQuestion,
    answer: string | string[] | undefined,
    deterministicFeedback: string
  ) {
    const answerText = formatAnswer(q, answer);
    try {
      const judgment = await requestAnswerJudgment({
        lesson,
        question: q,
        answerText,
        questionType: q.type,
        actualAnswer: expectedAnswerText(q),
      });
      const feedbackText = formatWrittenFeedback(judgment);
      setFeedback((prev) => {
        const current = prev[q.id];
        if (!current) return prev;
        return {
          ...prev,
          [q.id]: {
            ...current,
            semanticLoading: false,
            semanticFeedback: feedbackText,
            semanticError: undefined,
          },
        };
      });
      recordEvidence(q, null, answerText, `${deterministicFeedback}\n${feedbackText}`);
    } catch (err) {
      setFeedback((prev) => {
        const current = prev[q.id];
        if (!current) return prev;
        return {
          ...prev,
          [q.id]: {
            ...current,
            semanticLoading: false,
            semanticError: formatJudgeError(err),
          },
        };
      });
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="border-b border-gray-100 pb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Mixed practice</div>
        <div className="mt-1 text-sm text-gray-600">
          Score: {score} / {threshold}. Includes select-one, select-all, ordering, and written feedback.
        </div>
      </div>
      <div className="space-y-4 py-4">
        {questions.map((q, index) => (
          <PracticeQuestionCard
            key={q.id}
            question={q}
            index={index}
            answer={answers[q.id]}
            feedback={feedback[q.id]}
            onAnswer={(value) => setAnswer(q.id, value)}
            onGrade={() => void grade(q)}
          />
        ))}
      </div>
    </div>
  );
}

function PracticeQuestionCard({
  question,
  index,
  answer,
  feedback,
  onAnswer,
  onGrade,
}: {
  question: LessonPartPracticeQuestion;
  index: number;
  answer: string | string[] | undefined;
  feedback: FeedbackState[string] | undefined;
  onAnswer: (value: string | string[]) => void;
  onGrade: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);

  function readQuestionAloud() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(questionReadText(question));
    utterance.rate = 0.92;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.cancel();
    synth.speak(utterance);
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/40 p-2 sm:p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {index + 1}. {question.type.replace("_", " ")} · {question.difficulty}
          </div>
          <div className="mt-1 break-words text-sm font-medium leading-5 text-gray-800 sm:leading-6">{question.prompt}</div>
          <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500 sm:hidden">
            {question.concept}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={readQuestionAloud}
          className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          {speaking ? "Stop" : "Read"}
        </button>
        <span className="hidden rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-500 sm:inline-flex">
          {question.concept}
        </span>
        </div>
      </div>
      <PracticeInput question={question} answer={answer} feedback={feedback} onAnswer={onAnswer} />
      {question.hint && <p className="mt-2 text-xs leading-5 text-gray-500">Hint: {question.hint}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onGrade}
          disabled={!hasAnswer(question, answer) || feedback?.loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {feedback?.loading ? "Checking..." : question.type === "written" ? "Get feedback" : "Check answer"}
        </button>
        {feedback && !feedback.loading && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm leading-5 ${
              feedback.correct
                ? "border-green-100 bg-green-50 text-green-800"
                : feedback.correct === false
                ? "border-amber-100 bg-amber-50 text-amber-900"
                : "border-gray-100 bg-white text-gray-600"
            }`}
          >
            <p>{feedback.text}</p>
            {feedback.semanticLoading && (
              <p className="mt-2 border-t border-current/10 pt-2 text-xs opacity-80">
                Semantic feedback is still checking this answer.
              </p>
            )}
            {feedback.semanticFeedback && (
              <p className="mt-2 border-t border-current/10 pt-2">{feedback.semanticFeedback}</p>
            )}
            {feedback.semanticError && (
              <p className="mt-2 border-t border-current/10 pt-2 text-xs opacity-80">
                {feedback.semanticError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeInput({
  question,
  answer,
  feedback,
  onAnswer,
}: {
  question: LessonPartPracticeQuestion;
  answer: string | string[] | undefined;
  feedback: FeedbackState[string] | undefined;
  onAnswer: (value: string | string[]) => void;
}) {
  if (question.type === "ordering") {
    const order = Array.isArray(answer) ? answer : question.items ?? [];
    return (
      <div className="mt-3 space-y-2">
        {order.map((item, index) => (
          <div key={item} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
            <span className="w-6 text-center text-xs font-semibold text-gray-400">{index + 1}</span>
            <span className="min-w-0 flex-1 text-sm text-gray-700">{item}</span>
            <button
              type="button"
              onClick={() => onAnswer(move(order, index, -1))}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 disabled:opacity-30"
              disabled={index === 0}
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => onAnswer(move(order, index, 1))}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 disabled:opacity-30"
              disabled={index === order.length - 1}
            >
              Down
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "written") {
    return (
      <textarea
        value={typeof answer === "string" ? answer : ""}
        onChange={(event) => onAnswer(event.target.value)}
        rows={4}
        className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        placeholder="Write your explanation, then get immediate feedback..."
      />
    );
  }

  const choices = question.choices ?? [];
  const selected = Array.isArray(answer) ? answer : typeof answer === "string" ? [answer] : [];
  const showResults = Boolean(feedback && !feedback.loading);
  const correctChoices = getCorrectChoices(question);
  const noneSelected = question.type === "select_all" && Array.isArray(answer) && answer.length === 0;
  const noneCorrect = question.type === "select_all" && (question.correct_indices ?? []).length === 0;
  const allSelected =
    question.type === "select_all" &&
    choices.length > 0 &&
    choices.every((choice) => selected.includes(choice));
  const allCorrect =
    question.type === "select_all" &&
    choices.length > 0 &&
    (question.correct_indices ?? []).length === choices.length;
  const isMulti = question.type === "select_all" || question.type === "pattern_recognition";
  return (
    <div className="mt-3 space-y-2">
      {question.type === "pattern_recognition" && (
        <p className="text-xs text-gray-500">
          Select every algorithmic pattern that applies before writing code.
        </p>
      )}
      {question.type === "select_all" && (
        <ChoiceButton
          label="None of these"
          checked={noneSelected}
          selected={noneSelected}
          correct={noneCorrect}
          showResults={showResults}
          multi
          onClick={() => onAnswer([])}
        />
      )}
      {question.type === "select_all" && (
        <ChoiceButton
          label="All of these"
          checked={allSelected}
          selected={allSelected}
          correct={allCorrect}
          showResults={showResults}
          multi
          onClick={() => onAnswer(choices)}
        />
      )}
      {choices.map((choice) => {
        const checked = selected.includes(choice);
        const correct = correctChoices.has(choice);
        return (
          <ChoiceButton
            key={choice}
            label={choice}
            checked={checked}
            selected={checked}
            correct={correct}
            showResults={showResults}
            multi={isMulti}
            onClick={() => {
              if (question.type === "select_one") {
                onAnswer(choice);
              } else {
                onAnswer(checked ? selected.filter((item) => item !== choice) : [...selected, choice]);
              }
            }}
          />
        );
      })}
    </div>
  );
}

function ChoiceButton({
  label,
  checked,
  selected,
  correct,
  showResults,
  multi,
  onClick,
}: {
  label: string;
  checked: boolean;
  selected: boolean;
  correct: boolean;
  showResults: boolean;
  multi: boolean;
  onClick: () => void;
}) {
  const selectedWrong = showResults && selected && !correct;
  const missedCorrect = showResults && correct && !selected;
  const selectedCorrect = showResults && selected && correct;
  const neutralSelected = selected && !showResults;
  const buttonClass = selectedWrong
    ? "border-red-300 bg-red-50 text-red-950"
    : selectedCorrect
      ? "border-green-300 bg-green-50 text-green-950"
      : missedCorrect
        ? "border-green-300 bg-white text-green-950"
        : neutralSelected
          ? "border-blue-300 bg-blue-50 text-blue-900"
          : "border-gray-100 bg-white text-gray-700 hover:border-blue-200";
  const markClass = selectedWrong
    ? "border-red-500 bg-red-500 text-white"
    : selectedCorrect
      ? "border-green-600 bg-green-600 text-white"
      : missedCorrect
        ? "border-green-500 bg-white text-green-700"
        : neutralSelected
          ? "border-blue-500 bg-blue-500 text-white"
          : "border-gray-300 text-gray-400";
  const badge = selectedWrong
    ? "Your selection, not correct"
    : selectedCorrect
      ? "Selected and correct"
      : missedCorrect
        ? "Correct answer"
        : showResults && selected
          ? "Your selection"
          : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors sm:gap-3 sm:px-3 ${buttonClass}`}
    >
      <span className={`mt-0.5 h-5 w-5 shrink-0 border text-center text-xs font-bold ${multi ? "rounded" : "rounded-full"} ${markClass}`}>
        {checked ? "✓" : missedCorrect ? "!" : ""}
      </span>
      <span className="min-w-0 flex-1 break-words leading-5 sm:leading-6">{label}</span>
      {badge ? (
        <span className="hidden shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold sm:inline-flex">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function questionReadText(question: LessonPartPracticeQuestion): string {
  const parts = [`Question. ${question.prompt}`];
  if (question.type === "select_all") {
    parts.push("Answers. None of these. All of these.");
  } else if (question.type === "ordering") {
    parts.push("Items to order.");
  } else if (question.type === "pattern_recognition") {
    parts.push("Select every pattern that applies. Answers.");
  } else if (question.type === "select_one") {
    parts.push("Answers.");
  }
  const choices = question.type === "ordering" ? question.items ?? [] : question.choices ?? [];
  choices.forEach((choice, index) => parts.push(`${index + 1}. ${choice}.`));
  if (question.hint) parts.push(`Hint. ${question.hint}`);
  return parts.join(" ");
}

function getCorrectChoices(question: LessonPartPracticeQuestion): Set<string> {
  const choices = question.choices ?? [];
  if (question.type === "select_one") {
    const correct = choices[question.correct_index ?? -1];
    return new Set(correct ? [correct] : []);
  }
  if (question.type === "select_all") {
    return new Set((question.correct_indices ?? []).map((idx) => choices[idx]).filter(Boolean));
  }
  if (question.type === "pattern_recognition") {
    const { primary, secondary } = patternRecognitionCorrectChoices(question);
    return new Set([...primary, ...secondary]);
  }
  return new Set();
}

function gradeDeterministic(
  question: LessonPartPracticeQuestion,
  answer: string | string[] | undefined
): { correct: boolean; text: string } {
  if (question.type === "select_one") {
    const choices = question.choices ?? [];
    const correct = choices[question.correct_index ?? -1];
    const ok = answer === correct;
    return {
      correct: ok,
      text: ok ? question.explanation ?? "Correct." : `Not quite. Correct answer: ${correct}. ${question.explanation ?? ""}`.trim(),
    };
  }
  if (question.type === "select_all") {
    const choices = question.choices ?? [];
    const correctSet = new Set((question.correct_indices ?? []).map((idx) => choices[idx]));
    const selected = new Set(Array.isArray(answer) ? answer : []);
    const ok = correctSet.size === selected.size && [...correctSet].every((item) => selected.has(item));
    const correctText = correctSet.size ? [...correctSet].join("; ") : "none of these";
    return {
      correct: ok,
      text: ok ? question.explanation ?? "Correct." : `Not quite. Correct selections: ${correctText}. ${question.explanation ?? ""}`.trim(),
    };
  }
  if (question.type === "pattern_recognition") {
    const choices = question.choices ?? [];
    const selected = Array.isArray(answer) ? answer : [];
    const grade = gradePatternRecognition(
      choices,
      question.primary_indices ?? [],
      question.secondary_indices ?? [],
      selected
    );
    const explanation = question.explanation ? ` ${question.explanation}` : "";
    return {
      correct: grade.correct,
      text: `${grade.text}${explanation}`.trim(),
    };
  }
  const expected = question.correct_order ?? [];
  const selected = Array.isArray(answer) ? answer : [];
  const ok = expected.length === selected.length && expected.every((item, idx) => selected[idx] === item);
  return {
    correct: ok,
    text: ok ? question.explanation ?? "Correct." : `Not quite. Target order: ${expected.join(" -> ")}. ${question.explanation ?? ""}`.trim(),
  };
}

function hasAnswer(question: LessonPartPracticeQuestion, answer: string | string[] | undefined): boolean {
  if (question.type === "ordering") return Array.isArray(answer) && answer.length > 1;
  if (question.type === "select_all") return Array.isArray(answer);
  if (question.type === "pattern_recognition") return Array.isArray(answer) && answer.length > 0;
  return typeof answer === "string" && answer.trim().length > 0;
}

function formatAnswer(question: LessonPartPracticeQuestion, answer: string | string[] | undefined): string {
  if (Array.isArray(answer)) return answer.join(" -> ");
  if (typeof answer === "string") return answer;
  return question.type === "select_all" ? "(none selected)" : "";
}

function move(items: string[], index: number, delta: number): string[] {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

async function requestAnswerJudgment({
  lesson,
  question,
  answerText,
  questionType,
  actualAnswer,
}: {
  lesson?: Pick<Lesson, "title" | "description"> | null;
  question: LessonPartPracticeQuestion;
  answerText: string;
  questionType: string;
  actualAnswer: string;
}): Promise<AnswerJudgment> {
  if (!actualAnswer.trim()) {
    throw new Error("This question does not include a reference answer for semantic judging.");
  }

  const res = await fetch("/api/answer-judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lesson_title: lesson?.title ?? "Untitled lesson",
      lesson_description: lesson?.description ?? null,
      question_type: questionType,
      question_text: question.prompt,
      question_hint: question.hint ?? null,
      learner_answer: answerText,
      actual_answer: actualAnswer,
      rubric: question.rubric ?? question.explanation ?? null,
      accepted_answers: question.accepted_answers ?? [],
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    enabled?: boolean;
    judgment?: { verdict?: string; feedback?: string } | null;
    error?: string;
  } | null;

  if (!res.ok) {
    throw new Error(json?.error ?? `Judge request failed with status ${res.status}.`);
  }
  if (json?.enabled === false) {
    throw new Error("Semantic judging is disabled.");
  }
  const verdict = json?.judgment?.verdict;
  const feedback = json?.judgment?.feedback;
  if (
    verdict !== "correct" &&
    verdict !== "partially_correct" &&
    verdict !== "incorrect" &&
    verdict !== "unclear"
  ) {
    throw new Error(json?.error ?? "Semantic judge did not return a verdict.");
  }
  if (typeof feedback !== "string" || !feedback.trim()) {
    throw new Error("Semantic judge did not return feedback.");
  }
  return { verdict, feedback };
}

function expectedAnswerText(question: LessonPartPracticeQuestion): string {
  if (question.actual_answer?.trim()) return question.actual_answer.trim();
  if (question.type === "select_one") {
    const choices = question.choices ?? [];
    const correct = choices[question.correct_index ?? -1];
    return [correct, question.explanation].filter(Boolean).join(". ");
  }
  if (question.type === "select_all") {
    const choices = question.choices ?? [];
    const correctChoices = (question.correct_indices ?? []).map((idx) => choices[idx]).filter(Boolean);
    const selectionText = correctChoices.length ? correctChoices.join(", ") : "None of these.";
    return [selectionText, question.explanation].filter(Boolean).join(". ");
  }
  if (question.type === "pattern_recognition") {
    const { primary, secondary } = patternRecognitionCorrectChoices(question);
    const primaryChoices = Array.from(primary);
    const secondaryChoices = Array.from(secondary);
    const secondaryText = secondaryChoices.length ? `Secondary acceptable patterns: ${secondaryChoices.join(", ")}.` : "";
    return [
      primaryChoices.length ? `Required patterns: ${primaryChoices.join(", ")}.` : "",
      secondaryText,
      question.explanation,
    ].filter(Boolean).join(" ");
  }
  return [question.correct_order?.join(" -> "), question.explanation].filter(Boolean).join(". ");
}

function formatJudgeError(err: unknown) {
  const detail = err instanceof Error && err.message ? ` ${err.message}` : "";
  return `Semantic feedback is unavailable right now.${detail}`;
}

function formatWrittenFeedback(judgment: { verdict: string; feedback: string }) {
  const label =
    judgment.verdict === "correct"
      ? "Correct"
      : judgment.verdict === "partially_correct"
        ? "Partially correct"
        : judgment.verdict === "incorrect"
          ? "Incorrect"
          : "Needs more detail";
  return `${label}: ${judgment.feedback}`;
}
