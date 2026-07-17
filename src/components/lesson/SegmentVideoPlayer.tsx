"use client";

/**
 * SegmentVideoPlayer plays a per-segment 3Blue1Brown-style ManimCE video (with
 * its audio muxed in) as the PREFERRED representation of an audio segment. The
 * cue-to-visual highlight sync is baked into the video, so there is no runtime
 * sync machinery here, just a <video> with a poster and caption track.
 *
 * Resume position is reused from the same localStorage logic as the <audio>
 * player, keyed on the video file_path so audio↔video switches don't collide.
 *
 * On a load/playback error (missing or corrupt MP4) it calls onError so the
 * parent can fall back to the legacy <audio> + cue-swapped artifact path. This
 * is what makes registering a video safe: a bad file degrades to today's
 * behavior instead of a dead lesson.
 */
import { useEffect, useRef } from "react";
import type { LessonSegmentVideo } from "@/lib/lesson-content/schema";
import {
  audioResumeKey,
  clearAudioResumeTime,
  readAudioResumeTime,
  writeAudioResumeTime,
} from "@/lib/audio-resume";

export function SegmentVideoPlayer({
  activityId,
  video,
  onError,
  onEnded,
}: {
  activityId: number;
  video: LessonSegmentVideo;
  /** Called when the <video> fails to load/play so the parent can fall back. */
  onError?: () => void;
  /** Called after playback finishes (resume position already cleared). */
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedRef = useRef(0);
  const resumeKey = audioResumeKey(activityId, video.file_path);

  const save = (time: number, force = false) => {
    if (typeof window === "undefined") return;
    if (!force && Math.abs(time - lastSavedRef.current) < 2) return;
    writeAudioResumeTime(window.localStorage, resumeKey, time);
    lastSavedRef.current = time;
  };

  // Persist on unmount so a mid-playback navigation keeps the position.
  useEffect(() => {
    const el = videoRef.current;
    return () => {
      if (el && typeof window !== "undefined" && !el.ended) {
        save(el.currentTime, true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const src = `/runtime/${video.file_path}`;
  const poster = video.poster_path ? `/runtime/${video.poster_path}` : undefined;
  const captions = video.captions_path ? `/runtime/${video.captions_path}` : undefined;

  return (
    <video
      ref={videoRef}
      controls
      preload="metadata"
      playsInline
      poster={poster}
      className="w-full min-w-0 max-w-full rounded-xl border border-gray-100 bg-black shadow-sm"
      style={{ aspectRatio: video.width && video.height ? `${video.width} / ${video.height}` : "16 / 9" }}
      onLoadedMetadata={(event) => {
        if (typeof window === "undefined") return;
        const duration = event.currentTarget.duration || video.duration_sec || 0;
        const savedTime = readAudioResumeTime(window.localStorage, resumeKey, duration);
        if (savedTime > 0) {
          event.currentTarget.currentTime = savedTime;
          lastSavedRef.current = savedTime;
        }
      }}
      onTimeUpdate={(event) => save(event.currentTarget.currentTime)}
      onPause={(event) => save(event.currentTarget.currentTime, true)}
      onEnded={() => {
        if (typeof window !== "undefined") clearAudioResumeTime(window.localStorage, resumeKey);
        lastSavedRef.current = 0;
        onEnded?.();
      }}
      onError={() => onError?.()}
    >
      <source src={src} type="video/mp4" />
      {/* Captions stay opt-in (no `default`): the narration is already in the
          audio track, and browser cue overlays cover the animated stage. */}
      {captions && <track kind="captions" src={captions} srcLang="en" label="English" />}
      Your browser does not support video playback.
    </video>
  );
}
