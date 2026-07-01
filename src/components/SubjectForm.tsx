"use client";

import { useState } from "react";
import type { LevelName, Subject } from "@/types";

export interface SubjectFormValues {
  title: string;
  description: string;
  goals: string;
  criteria: string;
  current_level: LevelName;
}

interface SubjectFormProps {
  /** Provide an existing subject to populate an edit form; omit for create. */
  initial?: Partial<Subject>;
  learnerId: number;
  onSave: (subject: Subject) => void;
  onCancel: () => void;
}

const LEVEL_OPTIONS: { value: LevelName; label: string; hint: string }[] = [
  { value: "familiarity", label: "Familiarity", hint: "High-level concepts, vocabulary, and how the pieces relate" },
  { value: "competence", label: "Competence", hint: "Important details, mechanisms, edge cases, and practice" },
  { value: "mastery", label: "Mastery", hint: "Strong foundation, transfer, integration, and harder evidence" },
  { value: "post_mastery", label: "Post-mastery", hint: "Relevant frontier papers and well-cited current research" },
];

export function SubjectForm({ initial, learnerId, onSave, onCancel }: SubjectFormProps) {
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [goals, setGoals] = useState(initial?.goals ?? "");
  const [criteria, setCriteria] = useState(initial?.criteria ?? "");
  const [level, setLevel] = useState<LevelName>(initial?.current_level ?? "familiarity");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Subject name is required.";
    if (title.trim().length > 120) errs.title = "Keep the subject name under 120 characters.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setErrors({});

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        goals: goals.trim() || null,
        criteria: criteria.trim() || null,
        current_level: level,
        learner_id: learnerId,
      };

      let res: Response;
      if (isEdit && initial?.id) {
        res = await fetch(`/api/subjects/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { subject: Subject };
      onSave(data.subject);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Save failed. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Subject name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Subject name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((p) => ({ ...p, title: "" }));
          }}
          placeholder="e.g. Applied Probability & Statistics"
          maxLength={120}
          className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.title
              ? "border-red-300 focus:ring-red-200"
              : "border-gray-200 focus:ring-blue-200 focus:border-blue-400"
          }`}
          autoFocus
        />
        {errors.title && <p className="mt-1.5 text-xs text-red-600">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          What is this subject about?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description to remind yourself what this subject covers — topics, scope, context."
          rows={2}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors leading-relaxed"
        />
      </div>

      {/* Goals */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          What do you want to be able to do?
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Describe your long-term learning goal. Lesson generators use this to keep lessons aligned with where you want to end up.
        </p>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="e.g. Understand Bayesian inference well enough to build and interpret probability models in Python on real datasets."
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors leading-relaxed"
        />
      </div>

      {/* Criteria / notes for lesson generator */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Notes for the lesson generator
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Tell the lesson generator how you learn best. Be specific: preferred style, topics to emphasize or avoid,
          current project context, exam deadlines, things that haven&apos;t worked before. This is read alongside your
          goals every time a new lesson is generated.
        </p>
        <textarea
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder={[
            "Examples:",
            "• I find formula derivations less useful than seeing examples first — start concrete.",
            "• I'm preparing for a job interview in ML, so prioritize practical skills over theory.",
            "• I've found that code exercises help me retain concepts much better than reading alone.",
            "• Avoid heavy notation until I've seen the intuition in a simple case.",
          ].join("\n")}
          rows={5}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors leading-relaxed font-mono"
        />
        <p className="mt-1.5 text-xs text-gray-400">
          You can update this at any time. Changes affect future lessons, not past ones.
        </p>
      </div>

      {/* Starting level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {isEdit ? "Current level" : "Where are you starting?"}
        </label>
        <div className="space-y-2">
          {LEVEL_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="level"
                value={opt.value}
                checked={level === opt.value}
                onChange={() => setLevel(opt.value)}
                className="mt-0.5 accent-blue-600"
              />
              <span>
                <span className="block text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors">
                  {opt.label}
                </span>
                <span className="block text-xs text-gray-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Form-level error */}
      {errors.form && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errors.form}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save changes" : "Create subject"}
        </button>
      </div>
    </form>
  );
}
