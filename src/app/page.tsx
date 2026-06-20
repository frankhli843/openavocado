"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SubjectSummary, Subject } from "@/types";
import { SubjectCard } from "@/components/SubjectCard";
import { LearnerHeader } from "@/components/LearnerHeader";
import { Logo } from "@/components/Logo";
import { SubjectForm } from "@/components/SubjectForm";

export default function DashboardPage() {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [learnerId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/subjects?learner_id=${learnerId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { subjects: SubjectSummary[]; learner_id: number };
      setSubjects(data.subjects);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerId]);

  function handleSubjectCreated(subject: Subject) {
    setShowCreateForm(false);
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

  const activeSubjects = subjects.filter((s) => s.status !== "archived");
  const archivedSubjects = subjects.filter((s) => s.status === "archived");

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <nav className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-2 sm:gap-6">
          <Logo size={20} />
          <div className="flex gap-1">
            <NavTab href="/" active>Subjects</NavTab>
            <NavTab href="/progress">Progress</NavTab>
          </div>
          <div className="ml-auto flex-shrink-0">
            <button
              onClick={() => setShowCreateForm(true)}
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
            {activeSubjects.length > 0 && (
              <section className="mb-10">
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
              <section>
                <button
                  onClick={() => setShowArchived((v) => !v)}
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
                  onClick={() => setShowCreateForm(true)}
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
            if (e.target === e.currentTarget) setShowCreateForm(false);
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
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                &#10005;
              </button>
            </div>
            {/* Scrollable form body */}
            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <SubjectForm
                learnerId={learnerId}
                onSave={handleSubjectCreated}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavTab({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}
