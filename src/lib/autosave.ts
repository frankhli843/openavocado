/**
 * Autosave utilities.
 *
 * Autosave records lesson progress continuously but NEVER marks a lesson complete.
 * Lesson completion is manual only — the learner clicks a completion button.
 *
 * Server-side autosave goes through the /api/autosave endpoint.
 * Client-side debouncing prevents excessive network requests.
 */

export interface AutosavePayload {
  lesson_id: number;
  learner_id: number;
  activity_id?: number;
  code_draft?: string;
  run_output?: string;
  test_results?: Record<string, string>;
  runtime_errors?: unknown[];
  assessment_answers?: Record<string, string>;
  last_edited_at?: string;
  last_run_at?: string;
}

/**
 * Debounce an autosave call.
 * Returns a cancel function that can clear the pending timeout.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): [(...args: Parameters<T>) => void, () => void] {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return [debounced, cancel];
}

/**
 * Fire-and-forget autosave POST.
 * Errors are caught and logged; autosave failure is never surfaced as a blocking error.
 */
export async function postAutosave(payload: AutosavePayload): Promise<void> {
  try {
    await fetch("/api/autosave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[autosave] Failed to save progress:", err);
  }
}

/**
 * Human-readable save status label.
 * Used by the UI to communicate save/completion state without implying completion.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function savingLabel(status: SaveStatus, lastSavedAt?: string | null): string {
  switch (status) {
    case "saving":
      return "Saving...";
    case "saved":
      return lastSavedAt
        ? `Progress saved at ${new Date(lastSavedAt).toLocaleTimeString()}`
        : "Progress saved";
    case "error":
      return "Save failed — will retry";
    default:
      return "";
  }
}
