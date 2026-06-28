"use client";

import { useEffect, useMemo } from "react";
import { buildLessonDeepLink, writeLessonResumeState } from "@/lib/lesson-resume";

interface LessonResumeTrackerProps {
  lessonId: number;
  sectionIds: string[];
}

export function LessonResumeTracker({ lessonId, sectionIds }: LessonResumeTrackerProps) {
  const sectionKey = useMemo(() => sectionIds.join("|"), [sectionIds]);

  useEffect(() => {
    const ids = sectionKey ? sectionKey.split("|").filter(Boolean) : [];
    const safeSectionIds = new Set(ids);

    function currentHashSection(): string | null {
      const id = window.location.hash.replace(/^#/, "");
      return safeSectionIds.has(id) ? id : null;
    }

    function save(sectionId: string | null) {
      const href = buildLessonDeepLink(lessonId, sectionId);
      writeLessonResumeState(window.localStorage, {
        href,
        lessonId,
        sectionId,
      });
    }

    function scrollToSection(sectionId: string | null) {
      if (!sectionId) return;
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ block: "start" });
      });
    }

    const initialSection = currentHashSection();
    save(initialSection);
    scrollToSection(initialSection);

    function handleHashChange() {
      const sectionId = currentHashSection();
      save(sectionId);
      scrollToSection(sectionId);
    }
    window.addEventListener("hashchange", handleHashChange);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && safeSectionIds.has(entry.target.id))
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) save(visible.target.id);
      },
      {
        root: null,
        rootMargin: "-18% 0px -62% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      observer.disconnect();
    };
  }, [lessonId, sectionKey]);

  return null;
}
