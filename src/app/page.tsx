"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SubjectSummary, Subject } from "@/types";
import { SubjectCard } from "@/components/SubjectCard";
import { LearnerHeader } from "@/components/LearnerHeader";
import { Logo } from "@/components/Logo";
import { SubjectForm } from "@/components/SubjectForm";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { readLessonResumeState } from "@/lib/lesson-resume";
import { isBuiltInDemoSubjectTitle } from "@/lib/demo-subject";

const subjectListCache = new Map<number, SubjectSummary[]>();

interface CurrentUser {
  id: number;
  username: string;
  display_name: string;
  active_learner_id: number | null;
  is_guest: boolean;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [learnerId, setLearnerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(() => searchParams.get("view") === "archived");
  const [showCreateForm, setShowCreateForm] = useState(() => searchParams.get("new") === "subject");
  const checkedResumeRef = useRef(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { user: CurrentUser };
        setCurrentUser(data.user);
        if (data.user.active_learner_id != null) {
          setLearnerId(data.user.active_learner_id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load account");
        setLoading(false);
      }
    }
    void loadSession();
  }, []);

  useEffect(() => {
    if (checkedResumeRef.current) return;
    checkedResumeRef.current = true;

    const resume = searchParams.get("resume");
    const suppressResume = resume === "0" || resume === "false" || searchParams.get("new") || searchParams.get("view");
    if (suppressResume) return;

    const saved = readLessonResumeState(window.localStorage);
    if (saved) router.replace(saved.href);
  }, [router, searchParams]);

  async function load(options: { background?: boolean } = {}) {
    if (learnerId == null) return;
    try {
      if (!options.background) setLoading(true);
      const res = await fetch(`/api/subjects?learner_id=${learnerId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { subjects: SubjectSummary[]; learner_id: number };
      subjectListCache.set(learnerId, data.subjects);
      setSubjects(data.subjects);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!options.background) setLoading(false);
    }
  }

  useEffect(() => {
    if (learnerId == null) return;
    const cached = subjectListCache.get(learnerId);
    if (cached) {
      setSubjects(cached);
      setLoading(false);
      void load({ background: true });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerId]);

  useEffect(() => {
    for (const subject of subjects) {
      if (subject.status !== "archived") {
        router.prefetch(`/subjects/${subject.id}?tab=lessons`);
      }
    }
  }, [router, subjects]);

  useEffect(() => {
    setShowArchived(searchParams.get("view") === "archived");
    setShowCreateForm(searchParams.get("new") === "subject");
  }, [searchParams]);

  function openCreateForm() {
    setShowCreateForm(true);
    router.replace("/?new=subject", { scroll: false });
  }

  function closeCreateForm() {
    setShowCreateForm(false);
    router.replace("/", { scroll: false });
  }

  function toggleArchived() {
    const next = !showArchived;
    setShowArchived(next);
    router.replace(next ? "/?view=archived#archived-subjects" : "/", { scroll: false });
  }

  function handleSubjectCreated(subject: Subject) {
    closeCreateForm();
    setNotice(`Subject "${subject.title}" created. Open it to start generating lessons.`);
    load();
  }

  async function handleArchiveToggle(subject: SubjectSummary) {
    const archiving = subject.status !== "archived";
    setBusyId(subject.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/subjects/${subject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: archiving ? "archived" : "active" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      setNotice(
        archiving
          ? `Archived “${subject.title}”. Its lessons and progress are preserved — restore it anytime.`
          : `Restored “${subject.title}” to active learning.`
      );
    } catch (e) {
      setNotice(e instanceof Error ? `Action failed: ${e.message}` : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const learnerName = subjects[0]?.learner_display_name ?? "Learner";

  const activeSubjects = subjects.filter((s) => s.status !== "archived" && s.lesson_type !== "one_off");
  const oneOffSubjects = subjects.filter((s) => s.status !== "archived" && s.lesson_type === "one_off");
  const archivedSubjects = subjects.filter((s) => s.status === "archived");
  const visibleActiveSubjects = [...activeSubjects, ...oneOffSubjects];
  const hasPersonalActiveSubject = visibleActiveSubjects.some((s) => !isBuiltInDemoSubjectTitle(s.title));
  const shouldShowCreateSubjectCallout = !loading && !error && visibleActiveSubjects.length > 0 && !hasPersonalActiveSubject;

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <nav className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-2 sm:gap-6">
          <Logo size={20} />
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {currentUser && (
              <ProfileSwitcher userId={currentUser.id} activeId={learnerId} onActiveChange={setLearnerId} />
            )}
            <button
              onClick={openCreateForm}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              <span className="hidden sm:inline">New subject</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Learner context */}
        <LearnerHeader name={learnerName} />

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action feedback */}
        {notice && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-sm flex items-center justify-between gap-3">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-blue-400 hover:text-blue-600 shrink-0" aria-label="Dismiss">
              &#10005;
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-12">
            <span className="animate-spin">&#9679;</span>
            Loading subjects...
          </div>
        )}

        {/* Subject grid */}
        {!loading && !error && (
          <>
            {shouldShowCreateSubjectCallout && (
              <section className="mb-6 overflow-hidden rounded-lg border-2 border-blue-400 bg-blue-50 shadow-sm ring-2 ring-blue-200 animate-pulse">
                <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Start your own path
                    </div>
                    <p className="mt-1 break-words text-sm font-medium leading-relaxed text-blue-950">
                      You are only viewing the built-in demo right now. Create a subject to generate lessons around your own goal.
                    </p>
                  </div>
                  <button
                    onClick={openCreateForm}
                    className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    Create subject
                  </button>
                </div>
              </section>
            )}

            {oneOffSubjects.length > 0 && (
              <section id="one-off-subjects" className="mb-10 scroll-mt-24">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  1 offs
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {oneOffSubjects.map((s) => (
                    <SubjectCard key={s.id} subject={s} onArchiveToggle={handleArchiveToggle} busy={busyId === s.id} />
                  ))}
                </div>
              </section>
            )}

            {activeSubjects.length > 0 && (
              <section id="active-subjects" className="mb-10 scroll-mt-24">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Active
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSubjects.map((s) => (
                    <SubjectCard key={s.id} subject={s} onArchiveToggle={handleArchiveToggle} busy={busyId === s.id} />
                  ))}
                </div>
              </section>
            )}

            {archivedSubjects.length > 0 && (
              <section id="archived-subjects" className="scroll-mt-24">
                <button
                  onClick={toggleArchived}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 hover:text-gray-700 transition-colors"
                >
                  <span className={`transition-transform ${showArchived ? "rotate-90" : ""}`}>&#9656;</span>
                  Archived
                  <span className="text-xs text-gray-400 normal-case font-normal">({archivedSubjects.length})</span>
                </button>
                {showArchived && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-90">
                    {archivedSubjects.map((s) => (
                      <SubjectCard key={s.id} subject={s} onArchiveToggle={handleArchiveToggle} busy={busyId === s.id} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {subjects.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <p className="text-lg font-medium mb-2">No subjects yet</p>
                <p className="text-sm mb-4">Create your first subject to get started.</p>
                <button
                  onClick={openCreateForm}
                  className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create a subject
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create subject modal — bottom sheet on mobile, centered on desktop */}
      {showCreateForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4 sm:py-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCreateForm();
          }}
        >
          <div
            className="w-full sm:max-w-xl max-h-[90vh] flex flex-col bg-white rounded-t-2xl sm:rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — stays visible while form scrolls */}
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Create a new subject</h2>
              <button
                onClick={closeCreateForm}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                &#10005;
              </button>
            </div>
            {/* Scrollable form body */}
            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <SubjectForm
                learnerId={learnerId ?? 1}
                onSave={handleSubjectCreated}
                onCancel={closeCreateForm}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
