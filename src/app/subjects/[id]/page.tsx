"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import type { Subject, Lesson, MasterySignal, ProgressPoint } from "@/types";
import { LessonList } from "@/components/LessonList";
import { MasteryPanel } from "@/components/MasteryPanel";
import { ProgressChart } from "@/components/ProgressChart";
import { GoalsEditor } from "@/components/GoalsEditor";

interface SubjectData {
  subject: Subject;
  lessons: Lesson[];
  mastery_signals: MasterySignal[];
  progress_points: ProgressPoint[];
  tags: Array<{ id: number; name: string; tag_type: string }>;
}

type TabId = "lessons" | "mastery" | "progress" | "goals";

export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SubjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("lessons");

  useEffect(() => {
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
    load();
  }, [id]);

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

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "lessons", label: "Lessons", count: lessons.length },
    { id: "mastery", label: "Mastery", count: mastery_signals.length },
    { id: "progress", label: "Progress" },
    { id: "goals", label: "Goals" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky back + nav */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        {/* Breadcrumb bar */}
        <div className="max-w-5xl mx-auto px-6 h-10 flex items-center gap-2 text-sm">
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

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-6 flex gap-0 border-t border-gray-100">
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

      {/* Subject header */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{subject.title}</h1>
              <LevelBadge level={subject.current_level} />
            </div>
            {subject.description && (
              <p className="text-sm text-gray-500 leading-relaxed">{subject.description}</p>
            )}
          </div>

          {/* Quick stats */}
          <div className="shrink-0 flex items-center gap-4 text-sm">
            <StatPill label="Done" value={completedLessons.length} color="green" />
            <StatPill label="Active" value={activeLessons.length} color="blue" />
            <StatPill label="Queued" value={queuedLessons.length} color="gray" />
          </div>
        </div>

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
            />
          )}
          {activeTab === "mastery" && (
            <MasteryPanel signals={mastery_signals} />
          )}
          {activeTab === "progress" && (
            <ProgressChart points={progress_points} />
          )}
          {activeTab === "goals" && (
            <GoalsEditor subjectId={subject.id} initialGoals={subject.goals ?? ""} />
          )}
        </div>
      </div>
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
