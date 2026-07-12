"use client";

import { useMemo, useState } from "react";
import type { LessonActivity, MediaContent, MediaEmbed } from "@/types";
import {
  validateMediaContent,
  resolveYouTubeId,
  buildYouTubeEmbedUrl,
} from "@/lib/lesson-content/schema";

interface MediaSectionProps {
  activity: LessonActivity;
}

/**
 * Embedded media (YouTube). The iframe is built only from a validated video id
 * via the privacy-enhanced youtube-nocookie domain — never from a raw,
 * generator-supplied URL — so a malformed or hostile media spec cannot inject
 * an arbitrary iframe. If a video cannot be resolved or fails to load, the
 * learner sees a labelled fallback with the reason and a link, not a broken page.
 *
 * Watching a video never completes the lesson.
 */
export function MediaSection({ activity }: MediaSectionProps) {
  const parsed = useMemo(() => {
    if (!activity.content) return { content: null, error: "No media content" };
    try {
      const c = JSON.parse(activity.content) as MediaContent;
      const v = validateMediaContent(c);
      if (!v.valid) return { content: null, error: v.errors.join("; ") };
      return { content: c, error: null };
    } catch (e) {
      return { content: null, error: e instanceof Error ? e.message : "Invalid content" };
    }
  }, [activity.content]);

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 pb-4 sm:px-6">
        <span className="text-xl" aria-hidden="true">&#127909;</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Watch</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
            {activity.title ?? "Related Videos"}
          </h2>
        </div>
      </div>

      <div className="space-y-6 px-3 py-4 sm:p-6">
        {parsed.error || !parsed.content ? (
          <div role="alert" className="border-l-2 border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <div className="font-semibold mb-1">Media could not be loaded</div>
            <p className="text-xs text-amber-700">{parsed.error}</p>
          </div>
        ) : (
          parsed.content.embeds.map((embed, i) => <Embed key={i} embed={embed} />)
        )}
        <p className="text-xs text-gray-400">
          Watching a video saves nothing on its own and never completes the lesson.
        </p>
      </div>
    </div>
  );
}

function Embed({ embed }: { embed: MediaEmbed }) {
  const videoId = resolveYouTubeId(embed);
  const [failed, setFailed] = useState(false);
  const firstSegmentStart = embed.relevance === "segments" ? embed.segments?.[0]?.start : undefined;
  const effectiveStart = embed.start ?? firstSegmentStart;

  const watchUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}${effectiveStart ? `&t=${Math.floor(effectiveStart)}` : ""}`
    : undefined;

  return (
    <figure className="m-0">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <figcaption className="text-sm font-medium text-gray-800">{embed.title}</figcaption>
        {watchUrl && (
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-blue-600 hover:underline"
          >
            Open on YouTube
          </a>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-2.5">{embed.reason}</p>
      <VideoRelevance embed={embed} />

      {videoId && !failed ? (
        <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-black" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={buildYouTubeEmbedUrl(videoId, effectiveStart)}
            title={embed.title}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onError={() => setFailed(true)}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
          <div className="font-medium text-gray-700 mb-1">Video unavailable here</div>
          <p className="text-xs text-gray-500 leading-relaxed">{embed.fallback_text}</p>
          {watchUrl && (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs font-medium text-blue-600 hover:underline"
            >
              Watch on YouTube &#8594;
            </a>
          )}
        </div>
      )}
    </figure>
  );
}

function VideoRelevance({ embed }: { embed: MediaEmbed }) {
  if (embed.relevance === "segments" && embed.segments?.length) {
    return (
      <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5">
        <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1.5">
          Watch these segments
        </div>
        <ul className="space-y-1.5">
          {embed.segments.map((segment, i) => (
            <li key={`${segment.start}-${i}`} className="text-xs text-gray-600 leading-relaxed">
              <span className="font-semibold text-gray-800">
                {formatTime(segment.start)}
                {segment.end !== undefined ? `-${formatTime(segment.end)}` : ""}
              </span>
              {segment.label ? `: ${segment.label}` : ""}
              {segment.reason ? `, ${segment.reason}` : ""}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-green-100 bg-green-50/50 px-3 py-2 text-xs text-green-700">
      Whole video is relevant.
    </div>
  );
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
