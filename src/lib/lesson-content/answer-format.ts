import type {
  ClassificationItemSpec,
  FreeformQuestion,
  MatchingOptionSpec,
} from "./schema";

type LegacyFreeformQuestion = FreeformQuestion & { question?: string };

function parseRecord(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
        key,
        typeof value === "string" ? value : String(value ?? ""),
      ])
    );
  } catch {
    return {};
  }
}

function textForItem(item: string | ClassificationItemSpec, index: number): string {
  return typeof item === "string" ? item : item.text || item.id || `Item ${index + 1}`;
}

function optionLabel(options: MatchingOptionSpec[] | undefined, id: string): string {
  return options?.find((option) => option.id === id)?.text ?? id;
}

function sortedOrderingItems(
  items: Array<string | ClassificationItemSpec>,
  values: Record<string, string>
): string[] {
  return items
    .map((item, index) => {
      const rank = Number.parseInt(values[`item-${index}`] ?? "", 10);
      return { rank: Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER, index, text: textForItem(item, index) };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item, index) => `${index + 1}. ${item.text}`);
}

export function freeformQuestionText(question: LegacyFreeformQuestion): string {
  return question.text || question.question || question.id;
}

export function expectedOrRubric(question: FreeformQuestion): string | undefined {
  if (question.actual_answer?.trim()) return question.actual_answer.trim();
  if (question.rubric?.trim()) return question.rubric.trim();
  if (question.accepted_answers?.length) return question.accepted_answers.join(", ");
  if (question.type === "fill_blank") {
    const accepted = question.blanks
      ?.flatMap((blank) => blank.accepted_answers ?? [])
      .filter((answer) => answer.trim());
    if (accepted?.length) return accepted.join(", ");
  }
  return undefined;
}

export function formatFreeformAnswer(question: FreeformQuestion, raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  const type = question.type ?? "free_text";
  if (!trimmed) return "";

  if (type === "free_text" || type === "numeric" || type === "multiple_choice") {
    return trimmed;
  }

  const values = parseRecord(trimmed);
  if (Object.keys(values).length === 0) return trimmed;

  if (type === "fill_blank") {
    const lines = (question.blanks ?? [])
      .map((blank) => {
        const label = blank.label || blank.id;
        return `${label}: ${values[blank.id] ?? ""}`.trim();
      })
      .filter((line) => line.replace(/^[^:]+:\s*/, "").trim());
    return lines.join("\n");
  }

  if (type === "ordering") {
    const items = question.items ?? [];
    return sortedOrderingItems(items, values).join("\n");
  }

  if (type === "matching") {
    const prompts = question.prompts ?? [];
    const lines = prompts
      .map((prompt) => `${prompt.text}: ${optionLabel(question.options, values[prompt.id] ?? "")}`)
      .filter((line) => !line.endsWith(": "));
    return lines.join("\n");
  }

  if (type === "classification") {
    const categoryLabels = new Map((question.categories ?? []).map((category) => [category.id, category.label]));
    const items = (question.items ?? []).filter((item): item is ClassificationItemSpec => typeof item !== "string");
    return items
      .map((item) => `${item.text}: ${categoryLabels.get(values[item.id] ?? "") ?? values[item.id] ?? ""}`)
      .filter((line) => !line.endsWith(": "))
      .join("\n");
  }

  return trimmed;
}

export function hasFormattedAnswer(question: FreeformQuestion, raw: string | undefined): boolean {
  return formatFreeformAnswer(question, raw).trim().length > 0;
}
