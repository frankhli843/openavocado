"use client";

import type { LessonActivity, GeneratedArtifact } from "@/types";

interface AudioSectionProps {
  activity: LessonActivity;
  artifact?: GeneratedArtifact;
}

export function AudioSection({ activity, artifact }: AudioSectionProps) {
  const content: { script?: string; duration_hint?: number } = activity.content
    ? JSON.parse(activity.content)
    : {};

  const durationMin = content.duration_hint
    ? Math.ceil(content.duration_hint / 60)
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <SectionIcon type="audio" />
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Audio Session</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
            {activity.title ?? "Audio Walkthrough"}
          </h2>
        </div>
        {durationMin && (
          <span className="ml-auto text-xs text-gray-400">{durationMin} min</span>
        )}
      </div>

      <div className="p-6">
        {/* Audio player */}
        {artifact?.file_path ? (
          <div className="mb-4">
            <audio
              controls
              className="w-full h-10"
              src={`/runtime/${artifact.file_path}`}
            >
              Your browser does not support audio playback.
            </audio>
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
              {artifact.provider && <span>Provider: {artifact.provider}</span>}
              {artifact.voice && <span>Voice: {artifact.voice}</span>}
              {artifact.duration_sec && (
                <span>Duration: {Math.ceil(artifact.duration_sec / 60)} min</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
            Audio file not yet generated. The lesson generator will produce audio when the lesson is created.
          </div>
        )}

        {/* Transcript / Script */}
        {content.script && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Transcript
            </div>
            <div className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-64 overflow-y-auto">
              {content.script}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    audio: "&#127911;",
    interactive: "&#129531;",
    practice_code: "&#128187;",
    assessment: "&#128221;",
  };
  return (
    <span className="text-xl" aria-hidden="true">
      {icons[type] ?? "&#9679;"}
    </span>
  );
}
