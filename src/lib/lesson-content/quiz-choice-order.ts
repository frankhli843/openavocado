import type { MultipleChoiceQuestion, MultipleChoiceQuizContent } from "./schema";

const IDK_CHOICE_LABEL = "I'm not sure / I don't know";

export function isIdkChoiceText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
  return (
    normalized === "i dont know" ||
    normalized === "i do not know" ||
    normalized === "im not sure / i dont know" ||
    normalized === IDK_CHOICE_LABEL.toLowerCase().replace(/[’']/g, "")
  );
}

export function normalizeQuizChoiceOrder(
  quiz: MultipleChoiceQuizContent,
  seed = "avocadocore-quiz-choice-order"
): MultipleChoiceQuizContent {
  return {
    ...quiz,
    idk_option: quiz.idk_option === false ? quiz.idk_option : true,
    questions: quiz.questions.map((question, index) =>
      normalizeQuestionChoiceOrder(question, `${seed}:${question.id}:${index}`)
    ),
  };
}

export function normalizeQuestionChoiceOrder(
  question: MultipleChoiceQuestion,
  seed: string
): MultipleChoiceQuestion {
  const realChoices = question.choices
    .map((choice, index) => ({ choice, originalIndex: index }))
    .filter((item) => !isIdkChoiceText(item.choice));
  const originalChoices = realChoices.map((item) => item.choice);
  const correctOriginalIndices = question.correct_indices?.length
    ? question.correct_indices
    : typeof question.correct_index === "number"
    ? [question.correct_index]
    : [];
  const correctChoices = correctOriginalIndices
    .map((correctIndex) => realChoices.find((item) => item.originalIndex === correctIndex)?.choice)
    .filter((choice): choice is string => Boolean(choice));

  if (
    correctChoices.length === 0 ||
    correctChoices.some(isIdkChoiceText) ||
    originalChoices.length < 2
  ) {
    const boundedCorrectIndices = correctOriginalIndices
      .filter((idx) => idx >= 0 && idx < originalChoices.length);
    return {
      ...question,
      choices: originalChoices.length >= 2 ? originalChoices : question.choices,
      correct_index: question.allow_multiple_correct ? undefined : boundedCorrectIndices[0] ?? 0,
      correct_indices: question.allow_multiple_correct ? boundedCorrectIndices : undefined,
    };
  }

  const ordered = seededShuffle(originalChoices, `${seed}:all-choices`);
  const nextCorrectIndices = ordered
    .map((choice, index) => (correctChoices.includes(choice) ? index : -1))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const allowMultiple = question.allow_multiple_correct === true || nextCorrectIndices.length > 1;

  return {
    ...question,
    choices: ordered,
    correct_index: allowMultiple ? undefined : nextCorrectIndices[0],
    correct_indices: allowMultiple ? nextCorrectIndices : undefined,
    allow_multiple_correct: allowMultiple || undefined,
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const shuffled = [...items];
  let state = stableHash(seed);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    state = nextState(state);
    const j = state % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextState(state: number): number {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}
