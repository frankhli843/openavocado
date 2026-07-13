"use client";

import { useEffect, useMemo } from "react";
import { buildLessonDeepLink, parseOpenSectionQuery, writeLessonResumeState } from "@/lib/lesson-resume";

interface LessonResumeTrackerProps {
  lessonId: number;
  sectionIds: string[];
  onActiveSectionChange?: (sectionId: string | null) => void;
}

export function LessonResumeTracker({ lessonId, sectionIds, onActiveSectionChange }: LessonResumeTrackerProps) {
  const sectionKey = useMemo(() => sectionIds.join("|"), [sectionIds]);

  useEffect(() => {
    const ids = sectionKey ? sectionKey.split("|").filter(Boolean) : [];
    const safeSectionIds = new Set(ids);
    let lastSavedSection: string | null | undefined;
    let scrollFrame: number | null = null;

    function currentHashSection(): string | null {
      const id = window.location.hash.replace(/^#/, "");
      return safeSectionIds.has(id) ? id : null;
    }

    function save(sectionId: string | null) {
      if (sectionId === lastSavedSection) return;
      lastSavedSection = sectionId;
      const openSectionIds = parseOpenSectionQuery(new URLSearchParams(window.location.search).get("open"));
      const href = buildLessonDeepLink(lessonId, sectionId, openSectionIds);
      writeLessonResumeState(window.localStorage, {
        href,
        lessonId,
        sectionId,
      });
      onActiveSectionChange?.(sectionId);
    }

    function scrollToSection(sectionId: string | null) {
      if (!sectionId) return;
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ block: "start" });
      });
    }

    function visibleReadingSection(): string | null {
      const readingLine = 150;
      let active: string | null = null;
      let nearestBelow: { id: string; top: number } | null = null;

      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0) continue;
        if (rect.top <= readingLine) {
          active = id;
          continue;
        }
        if (!nearestBelow || rect.top < nearestBelow.top) {
          nearestBelow = { id, top: rect.top };
        }
      }

      return active ?? nearestBelow?.id ?? currentHashSection();
    }

    function handleViewportChange() {
      if (scrollFrame != null) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        save(visibleReadingSection());
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
    window.addEventListener("scroll", handleViewportChange, { passive: true });
    window.addEventListener("resize", handleViewportChange);
    window.requestAnimationFrame(handleViewportChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      if (scrollFrame != null) window.cancelAnimationFrame(scrollFrame);
    };
  }, [lessonId, onActiveSectionChange, sectionKey]);

  return null;
}
