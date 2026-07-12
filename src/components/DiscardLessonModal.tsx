"use client";

import { useState } from "react";

interface DiscardResult {
  lesson: { id: number; status: string; discarded_at: string | null };
  regeneration_job: {
    id: number | bigint;
    trigger_event: string;
    adapter: string;
    status: string;
    ref: string | null;
    error: string | null;
  };
}

interface DiscardLessonModalProps {
  lessonId: number;
  lessonTitle: string;
  learnerId: number;
  /** Called when the discard is confirmed and the server responds successfully. */
  onDiscarded: (result: DiscardResult) => void;
  onCancel: () => void;
}

export function DiscardLessonModal({
  lessonId,
  lessonTitle,
  learnerId,
  onDiscarded,
  onCancel,
}: DiscardLessonModalProps) {
  const [reason, setReason] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDiscarding(true);
    setError(null);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learner_id: learnerId, reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as DiscardResult;
      onDiscarded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discard lesson. Please try again.");
    } finally {
      setDiscarding(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg">
            &#9888;
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Discard this lesson?</h2>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
              This removes <span className="font-medium text-gray-700">&ldquo;{lessonTitle}&rdquo;</span> from your
              active work and requests a replacement lesson. This is not lesson completion and will not advance your
              mastery score.
            </p>
          </div>
        </div>

        {/* Reason field */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Why are you discarding this lesson? <span className="font-normal text-gray-400">(optional but helpful)</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Your note is passed to the lesson generator so the replacement is better aligned with what you need.
            For example: too easy, too hard, wrong topic, too abstract, needs more code exercises, bad pacing.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. This lesson was too abstract — I need concrete code examples before diving into the theory."
            rows={3}
            autoFocus
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors leading-relaxed"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={discarding}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
          >
            Keep lesson
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={discarding}
            className="px-5 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {discarding ? "Discarding..." : "Discard and request replacement"}
          </button>
        </div>
      </div>
    </div>
  );
}
