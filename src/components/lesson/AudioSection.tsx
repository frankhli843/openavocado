"use client";

import { useRef, useState } from "react";
import type { LessonActivity, GeneratedArtifact } from "@/types";
import type { AudioSyncedVisualContent, LessonSegmentVideo } from "@/lib/lesson-content/schema";
import {
  audioResumeKey,
  clearAudioResumeTime,
  readAudioResumeTime,
  writeAudioResumeTime,
} from "@/lib/audio-resume";
import { WidgetHost } from "./widgets/WidgetHost";
import { AudioSyncedLessonVisual } from "./LessonPartSection";
import { SegmentVideoPlayer } from "./SegmentVideoPlayer";

interface AudioSectionProps {
  activity: LessonActivity;
  artifact?: GeneratedArtifact;
}

export function AudioSection({ activity, artifact }: AudioSectionProps) {
  const content: {
    script?: string;
    transcript?: string;
    duration_hint?: number;
    orientation_visual?: unknown;
    orientation_video?: LessonSegmentVideo;
  } = activity.content ? JSON.parse(activity.content) : {};
  const orientationVisual = content.orientation_visual;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSavedAudioTimeRef = useRef(0);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  // Preferred per-segment Manim video (audio muxed in). Falls back to the legacy
  // <audio> + cue-swapped orientation visual if absent or if the <video> errors.
  const orientationVideo = content.orientation_video ?? null;
  const showVideo = Boolean(orientationVideo) && !videoFailed;
  const syncedOrientation = isAudioSyncedVisual(orientationVisual) ? orientationVisual : null;
  const widgetOrientation = syncedOrientation ? null : orientationVisual;
  const resumeKey = audioResumeKey(activity.id, artifact?.file_path);

  const durationMin = artifact?.duration_sec
    ? Math.ceil(artifact.duration_sec / 60)
    : content.duration_hint
    ? Math.ceil(content.duration_hint / 60)
    : null;
  const seekAudio = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setAudioTime(time);
    writeAudioResumeTime(window.localStorage, resumeKey, time);
    lastSavedAudioTimeRef.current = time;
    void audioRef.current.play().catch(() => undefined);
  };

  const saveAudioTime = (time: number, force = false) => {
    if (!force && Math.abs(time - lastSavedAudioTimeRef.current) < 2) return;
    writeAudioResumeTime(window.localStorage, resumeKey, time);
    lastSavedAudioTimeRef.current = time;
  };

  return (
    <div className="border-t border-gray-100 pt-4">
      {/* Section header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5">
            {activity.title ?? "Audio Walkthrough"}
          </h2>
        </div>
        {durationMin && (
          <span className="ml-auto text-xs text-gray-400">{durationMin} min</span>
        )}
      </div>

      <div className="px-3 py-4 sm:p-6">
        <div className="min-w-0 space-y-5">
          <div className="min-w-0 space-y-4">
            {/* Preferred Manim video (audio muxed in); else legacy audio player */}
            {showVideo && orientationVideo ? (
              <SegmentVideoPlayer
                activityId={activity.id}
                video={orientationVideo}
                onError={() => setVideoFailed(true)}
              />
            ) : artifact?.file_path ? (
              <div
                className={
                  audioPlaying
                    ? "sticky top-[4.75rem] z-20 rounded-xl border border-blue-100 bg-white/95 p-2 shadow-lg shadow-blue-100/60 backdrop-blur"
                    : ""
                }
              >
                <audio
                  ref={audioRef}
                  controls
                  className="h-10 w-full min-w-0 max-w-full"
                  src={`/runtime/${artifact.file_path}`}
                  onLoadedMetadata={(event) => {
                    const duration = event.currentTarget.duration || 0;
                    setAudioDuration(duration);
                    const savedTime = readAudioResumeTime(window.localStorage, resumeKey, duration);
                    if (savedTime > 0) {
                      event.currentTarget.currentTime = savedTime;
                      setAudioTime(savedTime);
                      lastSavedAudioTimeRef.current = savedTime;
                    }
                  }}
                  onTimeUpdate={(event) => {
                    const time = event.currentTarget.currentTime;
                    setAudioTime(time);
                    saveAudioTime(time);
                  }}
                  onPlay={() => setAudioPlaying(true)}
                  onPause={(event) => {
                    setAudioPlaying(false);
                    saveAudioTime(event.currentTarget.currentTime, true);
                  }}
                  onEnded={() => {
                    setAudioPlaying(false);
                    clearAudioResumeTime(window.localStorage, resumeKey);
                    lastSavedAudioTimeRef.current = 0;
                  }}
                >
                  Your browser does not support audio playback.
                </audio>
              </div>
            ) : (
              <div className="border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Audio file not yet generated. The lesson generator will produce audio when the lesson is created.
              </div>
            )}

            {/* Transcript / Script */}
            {(content.transcript || content.script) && (
              <details className="hidden border-t border-gray-100 pt-3 sm:block">
                <summary className="cursor-pointer select-none py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                  Transcript
                </summary>
                <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
                  {content.transcript ?? content.script}
                </div>
              </details>
            )}
          </div>

          {showVideo ? null : syncedOrientation ? (
            <AudioSyncedLessonVisual
              visual={syncedOrientation}
              currentTime={audioTime}
              duration={audioDuration || content.duration_hint || 154}
              onSeek={seekAudio}
            />
          ) : widgetOrientation ? (
            <div className="min-w-0 border-t border-gray-100 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-600">
                Interactive orientation
              </div>
              <WidgetHost spec={widgetOrientation} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function isAudioSyncedVisual(value: unknown): value is AudioSyncedVisualContent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { cues?: unknown };
  return Array.isArray(candidate.cues);
}
