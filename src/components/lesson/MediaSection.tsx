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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xl" aria-hidden="true">&#127909;</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Watch</div>
          <h2 className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
            {activity.title ?? "Related Videos"}
          </h2>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {parsed.error || !parsed.content ? (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
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

  const watchUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}${embed.start ? `&t=${Math.floor(embed.start)}` : ""}`
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

      {videoId && !failed ? (
        <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-black" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={buildYouTubeEmbedUrl(videoId, embed.start)}
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
