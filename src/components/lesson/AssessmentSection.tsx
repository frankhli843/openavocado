"use client";

import type {
  ClassificationCategorySpec,
  ClassificationItemSpec,
  FillBlankSpec,
  FreeformQuestion,
  MatchingOptionSpec,
  MatchingPromptSpec,
} from "@/lib/lesson-content/schema";
import type { LessonActivity } from "@/types";

type Question = FreeformQuestion & {
  options?: Array<string | MatchingOptionSpec>;
};

interface AssessmentSectionProps {
  activity: LessonActivity;
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}

export function AssessmentSection({ activity, answers, onChange }: AssessmentSectionProps) {
  const content: { questions?: Question[] } = activity.content
    ? JSON.parse(activity.content)
    : {};

  const questions: Question[] = content.questions ?? [];

  function handleChange(questionId: string, value: string) {
    const updated = { ...answers, [questionId]: value };
    onChange(updated);
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
        <span className="text-xl" aria-hidden="true">&#128221;</span>
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Assessment</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
            {activity.title ?? "Assessment Questions"}
          </h2>
        </div>
      </div>

      <div className="space-y-6 px-3 py-4 sm:p-6">
        {/* Clarification: submitting answers != completing the lesson */}
        <div className="border-l-2 border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-600">
          Answer the questions below. Your answers autosave as you type.
          Answering does not complete the lesson — use &quot;Mark Complete&quot; when you&apos;re done with the whole lesson.
        </div>

        {questions.map((q, index) => (
          <div key={q.id} className="space-y-2">
            <label className="block">
              <span className="break-words text-sm font-medium text-gray-800">
                {index + 1}. {q.text}
              </span>
              {q.hint && (
                <span className="mt-0.5 block break-words text-xs text-gray-400">{q.hint}</span>
              )}
            </label>

            <AssessmentQuestionInput
              question={q}
              answer={answers[q.id] ?? ""}
              onChange={(value) => handleChange(q.id, value)}
            />
          </div>
        ))}

        {questions.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">
            No assessment questions yet.
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentQuestionInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: string;
  onChange: (value: string) => void;
}) {
  const type = question.type ?? "free_text";

  if (type === "multiple_choice" && question.options) {
    const options = question.options.map((option) => textOf(option));
    return (
      <div className="space-y-1.5">
        {options.map((opt, oi) => (
          <label
            key={`${opt}-${oi}`}
            className="flex cursor-pointer items-center gap-2.5 border-b border-gray-100 py-2.5 text-sm transition-colors hover:bg-gray-50"
          >
            <input
              type="radio"
              name={question.id}
              value={opt}
              checked={answer === opt}
              onChange={() => onChange(opt)}
              className="accent-blue-600"
            />
            <span className="min-w-0 break-words text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "fill_blank") {
    return <FillBlankInput question={question} answer={answer} onChange={onChange} />;
  }

  if (type === "ordering") {
    return <OrderingInput question={question} answer={answer} onChange={onChange} />;
  }

  if (type === "classification") {
    return <ClassificationInput question={question} answer={answer} onChange={onChange} />;
  }

  if (type === "matching") {
    return <MatchingInput question={question} answer={answer} onChange={onChange} />;
  }

  return (
    <textarea
      className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      rows={type === "numeric" ? 2 : 4}
      value={answer}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        type === "numeric"
          ? "Enter your numerical answer..."
          : "Write your answer here..."
      }
    />
  );
}

function FillBlankInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: string;
  onChange: (value: string) => void;
}) {
  const blanks = question.blanks ?? [];
  const values = parseLabeledAnswer(answer);

  function update(blank: FillBlankSpec, value: string) {
    const next = new Map(values);
    next.set(blankKey(blank), value);
    onChange(formatLabeledAnswer(blanks.map((item) => [blankKey(item), next.get(blankKey(item)) ?? ""])));
  }

  return (
    <div className="divide-y divide-gray-100 border-y border-gray-100">
      {blanks.map((blank) => (
        <label key={blank.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] sm:items-center">
          <span className="min-w-0 break-words text-sm text-gray-600">{blankKey(blank)}</span>
          <input
            value={values.get(blankKey(blank)) ?? ""}
            onChange={(event) => update(blank, event.target.value)}
            className="min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            placeholder="Type the missing term"
          />
        </label>
      ))}
    </div>
  );
}

function OrderingInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: string;
  onChange: (value: string) => void;
}) {
  const sourceItems = (question.items ?? []).map(textOf);
  const order = parseOrderingAnswer(answer, sourceItems);

  function update(next: string[]) {
    onChange(formatOrderingAnswer(next));
  }

  return (
    <div className="divide-y divide-gray-100 border-y border-gray-100">
      {order.map((item, index) => (
        <div key={`${item}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-2">
          <span className="text-center text-xs font-semibold text-gray-400">{index + 1}</span>
          <span className="min-w-0 break-words text-sm text-gray-700">{item}</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => update(move(order, index, -1))}
              disabled={index === 0}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 disabled:opacity-30"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => update(move(order, index, 1))}
              disabled={index === order.length - 1}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 disabled:opacity-30"
            >
              Down
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClassificationInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: string;
  onChange: (value: string) => void;
}) {
  const items = (question.items ?? []).map(toClassificationItem);
  const categories: ClassificationCategorySpec[] = question.categories ?? [];
  const values = parseLabeledAnswer(answer);

  function update(item: ClassificationItemSpec, categoryLabel: string) {
    const next = new Map(values);
    next.set(item.text, categoryLabel);
    onChange(formatLabeledAnswer(items.map((entry) => [entry.text, next.get(entry.text) ?? ""])));
  }

  return (
    <div className="divide-y divide-gray-100 border-y border-gray-100">
      {items.map((item) => (
        <label key={item.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] sm:items-center">
          <span className="min-w-0 break-words text-sm text-gray-700">{item.text}</span>
          <select
            value={values.get(item.text) ?? ""}
            onChange={(event) => update(item, event.target.value)}
            className="min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Choose category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.label}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function MatchingInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: string;
  onChange: (value: string) => void;
}) {
  const prompts = question.prompts ?? [];
  const options = (question.options ?? []).map(toMatchingOption);
  const values = parseLabeledAnswer(answer);

  function update(prompt: MatchingPromptSpec, optionText: string) {
    const next = new Map(values);
    next.set(prompt.text, optionText);
    onChange(formatLabeledAnswer(prompts.map((entry) => [entry.text, next.get(entry.text) ?? ""])));
  }

  return (
    <div className="divide-y divide-gray-100 border-y border-gray-100">
      {prompts.map((prompt) => (
        <label key={prompt.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] sm:items-center">
          <span className="min-w-0 break-words text-sm text-gray-700">{prompt.text}</span>
          <select
            value={values.get(prompt.text) ?? ""}
            onChange={(event) => update(prompt, event.target.value)}
            className="min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Choose match</option>
            {options.map((option) => (
              <option key={option.id} value={option.text}>
                {option.text}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function textOf(item: string | ClassificationItemSpec | MatchingOptionSpec): string {
  return typeof item === "string" ? item : item.text;
}

function blankKey(blank: FillBlankSpec): string {
  return blank.label || blank.id;
}

function toClassificationItem(item: string | ClassificationItemSpec, index: number): ClassificationItemSpec {
  return typeof item === "string" ? { id: `item-${index}`, text: item } : item;
}

function toMatchingOption(option: string | MatchingOptionSpec, index: number): MatchingOptionSpec {
  return typeof option === "string" ? { id: `option-${index}`, text: option } : option;
}

function parseLabeledAnswer(answer: string): Map<string, string> {
  const parsed = new Map<string, string>();
  for (const line of answer.split("\n")) {
    const match = line.match(/^\s*(?:[-*]\s*)?(.+?)\s*:\s*(.*)\s*$/);
    if (match) parsed.set(match[1].trim(), match[2].trim());
  }
  return parsed;
}

function formatLabeledAnswer(entries: Array<[string, string]>): string {
  return entries
    .filter(([, value]) => value.trim().length > 0)
    .map(([label, value]) => `${label}: ${value.trim()}`)
    .join("\n");
}

function parseOrderingAnswer(answer: string, sourceItems: string[]): string[] {
  if (!answer.trim()) return sourceItems;
  const parsed = answer
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  if (parsed.length === sourceItems.length && parsed.every((item) => sourceItems.includes(item))) {
    return parsed;
  }
  return sourceItems;
}

function formatOrderingAnswer(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function move(items: string[], index: number, delta: number): string[] {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
