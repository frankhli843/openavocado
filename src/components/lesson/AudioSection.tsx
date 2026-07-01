"use client";

import type { LessonActivity, GeneratedArtifact } from "@/types";
import { WidgetHost } from "./widgets/WidgetHost";

interface AudioSectionProps {
  activity: LessonActivity;
  artifact?: GeneratedArtifact;
}

export function AudioSection({ activity, artifact }: AudioSectionProps) {
  const content: { script?: string; transcript?: string; duration_hint?: number; orientation_visual?: unknown } = activity.content
    ? JSON.parse(activity.content)
    : {};
  const orientationVisual = content.orientation_visual;

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
        <div className={orientationVisual ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] xl:items-start" : "min-w-0 space-y-4"}>
          <div className="min-w-0 space-y-4">
            {/* Audio player */}
            {artifact?.file_path ? (
              <div>
                <audio
                  controls
                  className="h-10 w-full min-w-0 max-w-full"
                  src={`/runtime/${artifact.file_path}`}
                >
                  Your browser does not support audio playback.
                </audio>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  {artifact.provider && <span>Provider: {artifact.provider}</span>}
                  {artifact.voice && <span>Voice: {artifact.voice}</span>}
                  {artifact.duration_sec && (
                    <span>Duration: {Math.ceil(artifact.duration_sec / 60)} min</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Audio file not yet generated. The lesson generator will produce audio when the lesson is created.
              </div>
            )}

            {/* Transcript / Script */}
            {(content.transcript || content.script) && (
              <details className="border-t border-gray-100 pt-3">
                <summary className="cursor-pointer select-none py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                  Transcript
                </summary>
                <div className="mt-2 max-h-64 overflow-y-auto border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
                  {content.transcript ?? content.script}
                </div>
              </details>
            )}
          </div>

          {orientationVisual ? (
            <div className="min-w-0 border-t border-gray-100 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-600">
                Interactive orientation
              </div>
              <WidgetHost spec={orientationVisual} />
            </div>
          ) : null}
        </div>
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
