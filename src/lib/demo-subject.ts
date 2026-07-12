export const DEMO_SUBJECT_TITLE = "Demo Lesson: Build your own LLM AI";

export function isBuiltInDemoSubjectTitle(title: string | null | undefined): boolean {
  return (title ?? "").trim().toLowerCase() === DEMO_SUBJECT_TITLE.toLowerCase();
}
