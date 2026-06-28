export const LAST_LESSON_DEEP_LINK_KEY = "avocadocore:last-lesson-deep-link";

export interface LessonResumeState {
  href: string;
  lessonId: number;
  sectionId: string | null;
  updatedAt: string;
}

const SECTION_ID_RE = /^section-[A-Za-z0-9_-]+$/;

export function buildLessonDeepLink(lessonId: number, sectionId?: string | null): string {
  const id = Number.isInteger(lessonId) && lessonId > 0 ? lessonId : null;
  if (id == null) throw new Error("lessonId must be a positive integer");

  const safeSection = sectionId && SECTION_ID_RE.test(sectionId) ? sectionId : null;
  return `/lessons/${id}${safeSection ? `#${safeSection}` : ""}`;
}

export function isSafeLessonDeepLink(value: string): boolean {
  if (!value.startsWith("/lessons/")) return false;
  if (value.startsWith("//")) return false;

  try {
    const parsed = new URL(value, "https://avocadocore.local");
    if (parsed.origin !== "https://avocadocore.local") return false;
    if (!/^\/lessons\/[1-9]\d*$/.test(parsed.pathname)) return false;
    if (parsed.search) return false;
    if (parsed.hash && !SECTION_ID_RE.test(parsed.hash.slice(1))) return false;
    return true;
  } catch {
    return false;
  }
}

export function serializeLessonResumeState(state: LessonResumeState): string {
  return JSON.stringify(state);
}

export function parseLessonResumeState(raw: string | null): LessonResumeState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LessonResumeState>;
    if (typeof parsed.href !== "string" || !isSafeLessonDeepLink(parsed.href)) return null;
    if (!Number.isInteger(parsed.lessonId) || (parsed.lessonId ?? 0) <= 0) return null;
    const lessonId = parsed.lessonId as number;
    const sectionId = typeof parsed.sectionId === "string" && SECTION_ID_RE.test(parsed.sectionId)
      ? parsed.sectionId
      : null;
    return {
      href: parsed.href,
      lessonId,
      sectionId,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return isSafeLessonDeepLink(raw)
      ? {
          href: raw,
          lessonId: Number(raw.match(/^\/lessons\/(\d+)/)?.[1] ?? 0),
          sectionId: raw.includes("#") ? raw.slice(raw.indexOf("#") + 1) : null,
          updatedAt: new Date(0).toISOString(),
        }
      : null;
  }
}

export function readLessonResumeState(storage: Pick<Storage, "getItem">): LessonResumeState | null {
  try {
    return parseLessonResumeState(storage.getItem(LAST_LESSON_DEEP_LINK_KEY));
  } catch {
    return null;
  }
}

export function writeLessonResumeState(
  storage: Pick<Storage, "setItem">,
  state: Omit<LessonResumeState, "updatedAt"> & { updatedAt?: string }
): void {
  if (!isSafeLessonDeepLink(state.href)) return;
  try {
    storage.setItem(
      LAST_LESSON_DEEP_LINK_KEY,
      serializeLessonResumeState({
        ...state,
        updatedAt: state.updatedAt ?? new Date().toISOString(),
      })
    );
  } catch {
    // Private browsing and locked-down environments can reject storage writes.
  }
}
