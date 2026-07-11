"use client";

import { useState } from "react";
import type { LevelName, Subject, SubjectLessonType } from "@/types";

export interface SubjectFormValues {
  title: string;
  description: string;
  goals: string;
  criteria: string;
  current_level: LevelName;
  lesson_type: SubjectLessonType;
  target_lesson_count: number | null;
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
  const [lessonType, setLessonType] = useState<SubjectLessonType>(initial?.lesson_type ?? "course");
  const [targetLessonCount, setTargetLessonCount] = useState(String(initial?.target_lesson_count ?? (initial?.lesson_type === "one_off" ? 1 : 6)));
  const [sourceLinks, setSourceLinks] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceFiles, setSourceFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Subject name is required.";
    if (title.trim().length > 120) errs.title = "Keep the subject name under 120 characters.";
    const parsedTarget = Number(targetLessonCount);
    if (!Number.isFinite(parsedTarget) || parsedTarget < 1 || parsedTarget > 100) {
      errs.target_lesson_count = "Choose a finish-by count from 1 to 100.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setErrors({});

    try {
      const payload = new FormData();
      payload.set("title", title.trim());
      payload.set("description", description.trim());
      payload.set("goals", goals.trim());
      payload.set("criteria", criteria.trim());
      payload.set("current_level", level);
      payload.set("lesson_type", lessonType);
      payload.set("target_lesson_count", String(Math.max(1, Math.floor(Number(targetLessonCount)))));
      payload.set("learner_id", String(learnerId));
      payload.set("source_links", sourceLinks.trim());
      payload.set("source_text", sourceText.trim());
      if (isEdit && initial?.source_materials && !sourceLinks.trim() && !sourceText.trim() && !sourceFiles?.length) {
        payload.set("source_materials", initial.source_materials);
      }
      if (sourceFiles) {
        Array.from(sourceFiles).forEach((file) => payload.append("source_files", file));
      }

      let res: Response;
      if (isEdit && initial?.id) {
        res = await fetch(`/api/subjects/${initial.id}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        res = await fetch("/api/subjects", {
          method: "POST",
          body: payload,
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
          placeholder="A brief description to remind yourself what this subject covers: topics, scope, context."
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lesson plan
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { value: "course" as const, label: "Course", hint: "Adaptive sequence with calibration and follow-up lessons" },
            { value: "one_off" as const, label: "One-off", hint: "A focused lesson from context, links, and documents" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                lessonType === opt.value ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="lesson_type"
                value={opt.value}
                checked={lessonType === opt.value}
                onChange={() => {
                  setLessonType(opt.value);
                  if (opt.value === "one_off") setTargetLessonCount("1");
                }}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-gray-900">{opt.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">{opt.hint}</span>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Finish by lesson count
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={targetLessonCount}
            onChange={(e) => setTargetLessonCount(e.target.value)}
            className={`w-32 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
              errors.target_lesson_count
                ? "border-red-300 focus:ring-red-200"
                : "border-gray-200 focus:ring-blue-200 focus:border-blue-400"
            }`}
          />
          {errors.target_lesson_count && <p className="mt-1.5 text-xs text-red-600">{errors.target_lesson_count}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Source context
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Add meeting notes, links, PDFs, TXT, Markdown, or DOCX files. One-off lessons use these as the main teaching context.
        </p>
        <textarea
          value={sourceLinks}
          onChange={(e) => setSourceLinks(e.target.value)}
          placeholder="Links, one per line"
          rows={2}
          className="mb-2 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors leading-relaxed"
        />
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Notes or context, for example: Meeting with Sara about Gemma contribution path..."
          rows={4}
          className="mb-2 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors leading-relaxed"
        />
        <input
          type="file"
          multiple
          accept=".pdf,.txt,.md,.markdown,.doc,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setSourceFiles(e.target.files)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        {initial?.source_materials && isEdit && (
          <p className="mt-1.5 text-xs text-gray-400">
            Existing source materials are preserved unless you add new source context here.
          </p>
        )}
      </div>

      {/* Preferences */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Preferences
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Tell Avo how you learn best. Be specific: preferred style, topics to emphasize or avoid,
          current project context, exam deadlines, things that haven&apos;t worked before. This is read alongside your
          goals every time a new lesson is generated.
        </p>
        <textarea
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder={[
            "Examples:",
            "• I find formula derivations less useful than seeing examples first, start concrete.",
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
