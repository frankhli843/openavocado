"use client";

import { useMemo, useState } from "react";
import type { Lesson, LessonActivity } from "@/types";
import type { LessonPartPracticeContent, LessonPartPracticeQuestion } from "@/lib/lesson-content/schema";
import type { QuizAssessContext } from "./MultipleChoiceAssessmentSection";

type AnswerState = Record<string, string | string[]>;
type FeedbackState = Record<string, { correct: boolean | null; text: string; loading?: boolean }>;

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

  function recordEvidence(q: LessonPartPracticeQuestion, correct: boolean | null, answerText: string) {
    if (!assessContext) return;
    void fetch("/api/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learner_id: assessContext.learnerId,
        subject_id: assessContext.subjectId,
        lesson_id: assessContext.lessonId,
        question_id: `${activity.id}:${q.id}`,
        question_text: q.prompt,
        question_type: q.type === "written" ? "freeform" : "mc",
        concept: q.concept,
        difficulty: q.difficulty,
        mc_outcome: correct ? "correct" : "incorrect",
        answer_text: answerText,
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
        const res = await fetch("/api/answer-judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lesson_title: lesson?.title ?? "Untitled lesson",
            lesson_description: lesson?.description ?? null,
            question_type: "free_text",
            question_text: q.prompt,
            question_hint: q.hint ?? null,
            learner_answer: answerText,
            actual_answer: q.actual_answer,
            rubric: q.rubric ?? null,
            accepted_answers: q.accepted_answers ?? [],
          }),
        });
        const json = (await res.json()) as {
          enabled?: boolean;
          judgment?: { verdict: string; feedback: string } | null;
        };
        const verdict = json.judgment?.verdict;
        const correct = verdict === "correct" || verdict === "partially_correct";
        const text =
          json.enabled === false
            ? `Local grading fallback: compare your answer to this target. ${q.actual_answer}`
            : json.judgment?.feedback ?? q.rubric ?? "Feedback was unavailable.";
        setFeedback((prev) => ({ ...prev, [q.id]: { correct, text } }));
        recordEvidence(q, correct, answerText);
      } catch {
        setFeedback((prev) => ({
          ...prev,
          [q.id]: { correct: null, text: q.rubric ?? "Feedback was unavailable. Try again." },
        }));
      }
      return;
    }

    const result = gradeDeterministic(q, answer);
    setFeedback((prev) => ({ ...prev, [q.id]: result }));
    recordEvidence(q, result.correct, formatAnswer(q, answer));
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50/60 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Mixed practice</div>
        <div className="mt-1 text-sm text-gray-600">
          Score: {score} / {threshold}. Includes select-one, select-all, ordering, and written feedback.
        </div>
      </div>
      <div className="space-y-4 p-4">
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
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-3">
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {index + 1}. {question.type.replace("_", " ")} · {question.difficulty}
          </div>
          <div className="mt-1 text-sm font-medium leading-6 text-gray-800">{question.prompt}</div>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-500">
          {question.concept}
        </span>
      </div>
      <PracticeInput question={question} answer={answer} onAnswer={onAnswer} />
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
            {feedback.text}
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeInput({
  question,
  answer,
  onAnswer,
}: {
  question: LessonPartPracticeQuestion;
  answer: string | string[] | undefined;
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
  return (
    <div className="mt-3 space-y-2">
      {question.type === "select_all" && (
        <button
          type="button"
          onClick={() => onAnswer([])}
          className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
            Array.isArray(answer) && answer.length === 0
              ? "border-blue-300 bg-blue-50 text-blue-900"
              : "border-gray-100 bg-white text-gray-700 hover:border-blue-200"
          }`}
        >
          <span className={`mt-0.5 h-5 w-5 shrink-0 rounded border text-center text-xs font-bold ${Array.isArray(answer) && answer.length === 0 ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-400"}`}>
            {Array.isArray(answer) && answer.length === 0 ? "✓" : ""}
          </span>
          <span className="leading-6">None of these</span>
        </button>
      )}
      {choices.map((choice) => {
        const checked = selected.includes(choice);
        return (
          <button
            key={choice}
            type="button"
            onClick={() => {
              if (question.type === "select_one") {
                onAnswer(choice);
              } else {
                onAnswer(checked ? selected.filter((item) => item !== choice) : [...selected, choice]);
              }
            }}
            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              checked ? "border-blue-300 bg-blue-50 text-blue-900" : "border-gray-100 bg-white text-gray-700 hover:border-blue-200"
            }`}
          >
            <span className={`mt-0.5 h-5 w-5 shrink-0 border text-center text-xs font-bold ${question.type === "select_one" ? "rounded-full" : "rounded"} ${checked ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-400"}`}>
              {checked ? "✓" : ""}
            </span>
            <span className="leading-6">{choice}</span>
          </button>
        );
      })}
    </div>
  );
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
