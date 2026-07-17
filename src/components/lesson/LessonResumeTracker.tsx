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
    let lastSavedHref: string | null | undefined;
    let scrollFrame: number | null = null;

    function currentHashFocus(): { sectionId: string | null; focusId: string | null } {
      const id = window.location.hash.replace(/^#/, "");
      if (safeSectionIds.has(id)) return { sectionId: id, focusId: id };
      const partHash = /^(section-[A-Za-z0-9_-]+)-[a-z][a-z0-9_-]{0,31}$/.exec(id);
      if (partHash && safeSectionIds.has(partHash[1])) return { sectionId: partHash[1], focusId: id };
      return { sectionId: null, focusId: null };
    }

    function save(sectionId: string | null, focusId = sectionId) {
      const openSectionIds = parseOpenSectionQuery(new URLSearchParams(window.location.search).get("open"));
      const partOpenQuery = new URLSearchParams(window.location.search).get("partOpen");
      const href = buildLessonDeepLink(lessonId, focusId, openSectionIds, partOpenQuery);
      if (sectionId === lastSavedSection && href === lastSavedHref) return;
      lastSavedSection = sectionId;
      lastSavedHref = href;
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

      return active ?? nearestBelow?.id ?? currentHashFocus().sectionId;
    }

    function handleViewportChange() {
      if (scrollFrame != null) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        save(visibleReadingSection());
      });
    }

    const initialFocus = currentHashFocus();
    save(initialFocus.sectionId, initialFocus.focusId);
    scrollToSection(initialFocus.focusId ?? initialFocus.sectionId);

    function handleHashChange() {
      const focus = currentHashFocus();
      save(focus.sectionId, focus.focusId);
      scrollToSection(focus.focusId ?? focus.sectionId);
    }
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("avocadocore:lesson-url-state-change", handleHashChange);
    window.addEventListener("scroll", handleViewportChange, { passive: true });
    window.addEventListener("resize", handleViewportChange);
    window.requestAnimationFrame(handleViewportChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("avocadocore:lesson-url-state-change", handleHashChange);
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      if (scrollFrame != null) window.cancelAnimationFrame(scrollFrame);
    };
  }, [lessonId, onActiveSectionChange, sectionKey]);

  return null;
}
