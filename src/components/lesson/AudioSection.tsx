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

  const durationMin = artifact?.duration_sec
    ? Math.ceil(artifact.duration_sec / 60)
    : content.duration_hint
    ? Math.ceil(content.duration_hint / 60)
    : null;

  return (
    <div className="border-t border-gray-100 pt-4">
      {/* Section header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
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

      <div className="px-3 py-4 sm:p-6">
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
          <div className="mb-4 border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Audio file not yet generated. The lesson generator will produce audio when the lesson is created.
          </div>
        )}

        {/* Transcript / Script */}
        {content.script && (
          <details className="border-t border-gray-100 pt-3">
            <summary className="cursor-pointer select-none py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
              Transcript
            </summary>
            <div className="mt-2 max-h-64 overflow-y-auto border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
              {content.script}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function SectionIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    audio: "\u{1F3A7}",
    interactive: "\u{1F9E9}",
    practice_code: "\u{1F4BB}",
    assessment: "\u{1F4DD}",
  };
  return (
    <span className="text-xl" aria-hidden="true">
      {icons[type] ?? "●"}
    </span>
  );
}
