import { describe, expect, it } from "vitest";
import {
  LAST_LESSON_DEEP_LINK_KEY,
  buildLessonDeepLink,
  isSafeLessonDeepLink,
  parseOpenSectionQuery,
  parsePartOpenQuery,
  parseLessonResumeState,
  readLessonResumeState,
  serializeOpenSectionQuery,
  serializePartOpenQuery,
  writeLessonResumeState,
} from "../lib/lesson-resume";

describe("lesson resume deep links", () => {
  it("builds lesson links with optional section focus", () => {
    expect(buildLessonDeepLink(7)).toBe("/lessons/7");
    expect(buildLessonDeepLink(7, "section-40")).toBe("/lessons/7#section-40");
    expect(buildLessonDeepLink(7, "section-40", ["section-10", "section-40"])).toBe(
      "/lessons/7?open=section-10%2Csection-40#section-40"
    );
    expect(buildLessonDeepLink(7, "bad section")).toBe("/lessons/7");
  });

  it("only accepts safe relative lesson deep links", () => {
    expect(isSafeLessonDeepLink("/lessons/7")).toBe(true);
    expect(isSafeLessonDeepLink("/lessons/7#section-40")).toBe(true);
    expect(isSafeLessonDeepLink("/lessons/7?open=section-10%2Csection-40#section-40")).toBe(true);
    expect(isSafeLessonDeepLink("/lessons/7?mode=go&partOpen=section-40%3Aaudio%2Cpractice#section-40-practice")).toBe(true);
    expect(isSafeLessonDeepLink("/subjects/5?tab=lessons")).toBe(false);
    expect(isSafeLessonDeepLink("https://example.com/lessons/7")).toBe(false);
    expect(isSafeLessonDeepLink("//example.com/lessons/7")).toBe(false);
    expect(isSafeLessonDeepLink("/lessons/7?next=https://example.com")).toBe(false);
    expect(isSafeLessonDeepLink("/lessons/7?mode=edit")).toBe(false);
    expect(isSafeLessonDeepLink("/lessons/7?open=section-10,bad section")).toBe(false);
    expect(isSafeLessonDeepLink("/lessons/7?partOpen=section-10:bad block")).toBe(false);
    expect(isSafeLessonDeepLink("/lessons/7#bad section")).toBe(false);
  });

  it("parses and serializes open section query state", () => {
    expect(parseOpenSectionQuery("section-10,section-40,bad section,section-10")).toEqual([
      "section-10",
      "section-40",
    ]);
    expect(serializeOpenSectionQuery(["section-40", "bad section", "section-10"])).toBe(
      "section-40,section-10"
    );
  });

  it("parses and serializes open lesson-part block query state", () => {
    expect(parsePartOpenQuery("section-10:audio,text,bad block,audio;bad section:code;section-40:practice")).toEqual({
      "section-10": ["audio", "text"],
      "section-40": ["practice"],
    });
    expect(serializePartOpenQuery({
      "section-40": ["practice", "bad block"],
      "bad section": ["audio"],
      "section-10": ["audio", "text"],
    })).toBe("section-40:practice;section-10:audio,text");
  });

  it("parses current JSON state and legacy plain-link state", () => {
    expect(
      parseLessonResumeState(
        JSON.stringify({
          href: "/lessons/7?open=section-10%2Csection-40#section-40",
          lessonId: 7,
          sectionId: "section-40",
          updatedAt: "2026-06-27T00:00:00.000Z",
        })
      )
    ).toMatchObject({
      href: "/lessons/7?open=section-10%2Csection-40#section-40",
      lessonId: 7,
      sectionId: "section-40",
    });

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
