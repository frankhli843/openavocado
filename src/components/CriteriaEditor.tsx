"use client";

import { useState } from "react";

interface CriteriaEditorProps {
  subjectId: number;
  initialCriteria: string;
  /** Called after a successful save with the new value. */
  onSaved?: (criteria: string) => void;
}

/**
 * Inline editor for subject.criteria, the learner's generation preferences.
 * Saves via PATCH /api/subjects/:id.
 */
export function CriteriaEditor({ subjectId, initialCriteria, onSaved }: CriteriaEditorProps) {
  const [criteria, setCriteria] = useState(initialCriteria);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      onSaved?.(criteria);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Preferences</h3>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        Tell Avo how you learn best: preferred style, topics to emphasize or skip,
        current project or exam context, things that haven&apos;t worked before. This is read alongside your
        goals every time a new lesson is generated or a lesson is regenerated after discard.
      </p>
      <textarea
        className="w-full h-44 px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors leading-relaxed font-mono"
        value={criteria}
        onChange={(e) => {
          setCriteria(e.target.value);
          setSaved(false);
        }}
        placeholder={[
          "Examples:",
          "• Build intuition with examples before introducing formal notation.",
          "• I'm prepping for a data engineering interview — emphasize SQL and systems design.",
          "• Always include a Python code exercise even for non-technical concepts.",
          "• Audio-first, then written explanation — I process the audio better when I can re-read.",
        ].join("\n")}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs transition-colors ${error ? "text-red-600" : saved ? "text-green-600" : "text-gray-400"}`}>
          {error ? error : saved ? "Saved" : "Preferences affect future lessons only — past lessons are unaffected."}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
