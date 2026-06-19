"use client";

import { useState } from "react";

interface GoalsEditorProps {
  subjectId: number;
  initialGoals: string;
}

export function GoalsEditor({ subjectId, initialGoals }: GoalsEditorProps) {
  const [goals, setGoals] = useState(initialGoals);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Learning Goals</h3>
      <p className="text-xs text-gray-500 mb-4">
        Describe what you want to achieve in this subject. This context informs the lesson generator.
      </p>
      <textarea
        className="w-full h-40 px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors font-mono leading-relaxed"
        value={goals}
        onChange={(e) => {
          setGoals(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. Reach competence in Bayesian inference and apply it to real datasets using Python."
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {saved ? "Saved" : error ? error : ""}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Goals"}
        </button>
      </div>
    </div>
  );
}
