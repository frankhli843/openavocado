"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import type { Subject, Lesson, MasterySignal, ProgressPoint, SubjectMastery } from "@/types";
import { LessonList } from "@/components/LessonList";
import { MasteryPanel } from "@/components/MasteryPanel";
import { MasterySummary } from "@/components/MasterySummary";
import { ProgressChart } from "@/components/ProgressChart";
import { GoalsEditor } from "@/components/GoalsEditor";
import { CriteriaEditor } from "@/components/CriteriaEditor";
import { SubjectForm } from "@/components/SubjectForm";

interface SubjectData {
  subject: Subject;
  lessons: Lesson[];
  mastery_signals: MasterySignal[];
  progress_points: ProgressPoint[];
  mastery?: SubjectMastery;
  tags: Array<{ id: number; name: string; tag_type: string }>;
  tag_evidence?: TagEvidenceRow[];
}

interface TagEvidenceRow {
  tag: string;
  difficulty: "easy" | "medium" | "hard" | "ungraded";
  correct: number;
  incorrect: number;
  idk: number;
  total: number;
}

type TabId = "lessons" | "mastery" | "progress" | "goals" | "criteria";

export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SubjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("lessons");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/subjects/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SubjectData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleArchive() {
    if (!data) return;
    const archiving = data.subject.status !== "archived";
    setArchiveBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/subjects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: archiving ? "archived" : "active" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      setNotice(
        archiving
          ? "Subject archived. Lessons, assessments, and progress are preserved — restore anytime."
          : "Subject restored to active learning."
      );
    } catch (e) {
      setNotice(e instanceof Error ? `Action failed: ${e.message}` : "Action failed");
    } finally {
      setArchiveBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-4">{error ?? "Not found"}</p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { subject, lessons, mastery_signals, progress_points, tags } = data;
  const completedLessons = lessons.filter((l) => l.status === "completed");
  const activeLessons = lessons.filter((l) => l.status === "in_progress");
  const queuedLessons = lessons.filter((l) => l.status === "queued");
  const discardedLessons = lessons.filter((l) => l.status === "discarded");

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "lessons", label: "Lessons", count: lessons.length },
    { id: "mastery", label: "Mastery", count: mastery_signals.length },
    { id: "progress", label: "Progress" },
    { id: "goals", label: "Goals" },
    { id: "criteria", label: "Generator notes" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky back + nav */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        {/* Breadcrumb bar */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-10 flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
          >
            <span>&#8592;</span>
            <span>Dashboard</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium truncate max-w-xs">{subject.title}</span>
        </div>

        {/* Tab bar — horizontal scroll on mobile */}
        <div className="border-t border-gray-100 overflow-x-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-0 w-max min-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 text-xs text-gray-400">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subject header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2 mb-1">
              <h1 className="min-w-0 break-words text-xl font-bold text-gray-900 tracking-tight">{subject.title}</h1>
              <LevelBadge level={subject.current_level} />
            </div>
            {subject.description && (
              <p className="text-sm text-gray-500 leading-relaxed break-words">{subject.description}</p>
            )}
          </div>

          {/* Quick stats + edit button */}
          <div className="flex flex-wrap items-center gap-2 text-sm sm:shrink-0 sm:gap-3">
            <StatPill label="Done" value={completedLessons.length} color="green" />
            <StatPill label="Active" value={activeLessons.length} color="blue" />
            <StatPill label="Queued" value={queuedLessons.length} color="gray" />
            <button
              onClick={() => setShowEditForm(true)}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
              title="Edit subject details"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Archive state + action */}
        <div className="flex items-center justify-between gap-3 mb-4">
          {subject.status === "archived" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <span aria-hidden="true">&#128230;</span> Archived — hidden from active learning, nothing deleted
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={toggleArchive}
            disabled={archiveBusy}
            className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors px-2 py-1"
          >
            {archiveBusy ? "Working…" : subject.status === "archived" ? "Restore subject" : "Archive subject"}
          </button>
        </div>

        {notice && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-sm">
            {notice}
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {tags.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Tab content */}
        <div className="mt-2">
          {activeTab === "lessons" && (
            <LessonList
              completed={completedLessons}
              active={activeLessons}
              queued={queuedLessons}
              discarded={discardedLessons}
            />
          )}
          {activeTab === "mastery" && (
            <>
              <MasterySummary mastery={data.mastery} />
              <TagEvidencePanel evidence={data.tag_evidence ?? []} />
              <MasteryPanel signals={mastery_signals} />
            </>
          )}
          {activeTab === "progress" && (
            <ProgressChart points={progress_points} />
          )}
          {activeTab === "goals" && (
            <GoalsEditor subjectId={subject.id} initialGoals={subject.goals ?? ""} />
          )}
          {activeTab === "criteria" && (
            <CriteriaEditor subjectId={subject.id} initialCriteria={subject.criteria ?? ""} />
          )}
        </div>
      </div>

      {/* Edit subject modal — bottom sheet on mobile, centered on desktop */}
      {showEditForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4 sm:py-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditForm(false);
          }}
        >
          <div
            className="w-full sm:max-w-xl max-h-[90vh] flex flex-col bg-white rounded-t-2xl sm:rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — stays visible while form scrolls */}
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Edit subject</h2>
              <button
                onClick={() => setShowEditForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                &#10005;
              </button>
            </div>
            {/* Scrollable form body */}
            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              {subject.status === "archived" && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  This subject is archived. You can edit its details, but it will remain hidden from the active learning list until restored.
                </div>
              )}
              <SubjectForm
                initial={subject}
                learnerId={subject.learner_id}
                onSave={(updated) => {
                  setShowEditForm(false);
                  setNotice(`Subject updated.`);
                  load();
                  void updated; // load() refreshes from server
                }}
                onCancel={() => setShowEditForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tag + difficulty evidence panel. Shows how the learner has done on each tag,
 * broken out by difficulty — the queryable evidence behind adaptive lessons.
 * Readable on mobile (stacked rows) and desktop.
 */
function TagEvidencePanel({ evidence }: { evidence: TagEvidenceRow[] }) {
  if (evidence.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-gray-200 p-5 text-sm text-gray-500">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
          Tag &amp; difficulty evidence
        </div>
        No assessed answers yet. Answer a lesson&apos;s quiz or diagnostics to build tag-by-difficulty evidence.
      </div>
    );
  }
  const diffColor: Record<string, string> = {
    easy: "bg-green-50 text-green-700",
    medium: "bg-amber-50 text-amber-700",
    hard: "bg-red-50 text-red-700",
    ungraded: "bg-gray-50 text-gray-500",
  };
  return (
    <div className="mb-6 rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
        Tag &amp; difficulty evidence
      </div>
      <ul className="space-y-2">
        {evidence.map((e, i) => {
          const accuracy = e.total > 0 ? Math.round((e.correct / e.total) * 100) : 0;
          return (
            <li
              key={`${e.tag}-${e.difficulty}-${i}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-50/60 px-3 py-2"
            >
              <span className="min-w-0 break-words text-sm font-medium text-gray-800">{e.tag}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${diffColor[e.difficulty] ?? diffColor.ungraded}`}>
                {e.difficulty}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-gray-500">
                <span className="text-green-600">{e.correct}✓</span>
                {e.incorrect > 0 && <span className="text-red-500">{e.incorrect}✗</span>}
                {e.idk > 0 && <span className="text-amber-600">{e.idk}?</span>}
                <span className="font-medium text-gray-700">{accuracy}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    familiarity: "bg-blue-50 text-blue-700 border-blue-100",
    competence: "bg-purple-50 text-purple-700 border-purple-100",
    mastery: "bg-green-50 text-green-700 border-green-100",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        styles[level] ?? "bg-gray-50 text-gray-600 border-gray-100"
      }`}
    >
      {level}
    </span>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "blue" | "gray";
}) {
  const styles = {
    green: "text-green-700 bg-green-50",
    blue: "text-blue-700 bg-blue-50",
    gray: "text-gray-600 bg-gray-50",
  };
  return (
    <div className={`text-center px-3 py-1 rounded-lg ${styles[color]}`}>
      <div className="font-bold text-base leading-none">{value}</div>
      <div className="text-xs opacity-70 mt-0.5">{label}</div>
    </div>
  );
}
