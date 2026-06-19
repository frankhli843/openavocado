"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SubjectSummary } from "@/types";
import { SubjectCard } from "@/components/SubjectCard";
import { LearnerHeader } from "@/components/LearnerHeader";

export default function DashboardPage() {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [learnerId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    load();
  }, [learnerId]);

  const learnerName = subjects[0]?.learner_display_name ?? "Learner";

  const activeSubjects = subjects.filter((s) => s.status === "active");
  const otherSubjects = subjects.filter((s) => s.status !== "active");

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <nav className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center gap-6">
          <span className="font-semibold text-gray-900 text-sm tracking-tight">AvocadoCore</span>
          <div className="flex gap-1 ml-4">
            <NavTab href="/" active>Subjects</NavTab>
            <NavTab href="/progress">Progress</NavTab>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Learner context */}
        <LearnerHeader name={learnerName} />

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
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
                    <SubjectCard key={s.id} subject={s} />
                  ))}
                </div>
              </section>
            )}

            {otherSubjects.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Other
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherSubjects.map((s) => (
                    <SubjectCard key={s.id} subject={s} />
                  ))}
                </div>
              </section>
            )}

            {subjects.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <p className="text-lg font-medium mb-2">No subjects yet</p>
                <p className="text-sm">Add a subject to get started.</p>
              </div>
            )}
          </>
        )}
      </div>
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
