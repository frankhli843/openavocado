import { describe, expect, it } from "vitest";
import {
  LAST_LESSON_DEEP_LINK_KEY,
  buildLessonDeepLink,
  isSafeLessonDeepLink,
  parseLessonResumeState,
  readLessonResumeState,
  writeLessonResumeState,
} from "../lib/lesson-resume";

describe("lesson resume deep links", () => {
  it("builds lesson links with optional section focus", () => {
    expect(buildLessonDeepLink(7)).toBe("/lessons/7");
    expect(buildLessonDeepLink(7, "section-40")).toBe("/lessons/7#section-40");
    expect(buildLessonDeepLink(7, "bad section")).toBe("/lessons/7");
  });

  it("only accepts safe relative lesson deep links", () => {
    expect(isSafeLessonDeepLink("/lessons/7")).toBe(true);
    expect(isSafeLessonDeepLink("/lessons/7#section-40")).toBe(true);
    expect(isSafeLessonDeepLink("/subjects/5?tab=lessons")).toBe(false);
    expect(isSafeLessonDeepLink("https://example.com/lessons/7")).toBe(false);
    expect(isSafeLessonDeepLink("//example.com/lessons/7")).toBe(false);
    expect(isSafeLessonDeepLink("/lessons/7?next=https://example.com")).toBe(false);
    expect(isSafeLessonDeepLink("/lessons/7#bad section")).toBe(false);
  });

  it("parses current JSON state and legacy plain-link state", () => {
    expect(
      parseLessonResumeState(
        JSON.stringify({
          href: "/lessons/7#section-40",
          lessonId: 7,
          sectionId: "section-40",
          updatedAt: "2026-06-27T00:00:00.000Z",
        })
      )
    ).toMatchObject({ href: "/lessons/7#section-40", lessonId: 7, sectionId: "section-40" });

    expect(parseLessonResumeState("/lessons/8#section-diagnostics")).toMatchObject({
      href: "/lessons/8#section-diagnostics",
      lessonId: 8,
      sectionId: "section-diagnostics",
    });
    expect(parseLessonResumeState("https://example.com/lessons/7")).toBeNull();
  });

  it("reads and writes storage safely", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    };

    writeLessonResumeState(storage, {
      href: "/lessons/7#section-40",
      lessonId: 7,
      sectionId: "section-40",
      updatedAt: "2026-06-27T00:00:00.000Z",
    });

    expect(store.has(LAST_LESSON_DEEP_LINK_KEY)).toBe(true);
    expect(readLessonResumeState(storage)).toMatchObject({
      href: "/lessons/7#section-40",
      lessonId: 7,
      sectionId: "section-40",
    });
  });
});
