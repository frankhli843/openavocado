"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GeneratedArtifact, LessonActivity, ReadingBlock } from "@/types";
import type {
  AudioSyncedVisualContent,
  AudioSyncedVisualCue,
  LessonPartContent,
} from "@/lib/lesson-content/schema";
import { WidgetHost, type WidgetStateChange } from "./widgets/WidgetHost";
import { LessonDiagramsView } from "./LessonDiagrams";
import { FormulaBlock } from "./FormulaBlock";
import { PythonSection } from "./PythonSection";
import { LessonPartPracticeSection } from "./LessonPartPracticeSection";
import { SegmentVideoPlayer } from "./SegmentVideoPlayer";
import {
  MultipleChoiceAssessmentSection,
  type QuizAssessContext,
} from "./MultipleChoiceAssessmentSection";
import { BespokeArtifactRenderer } from "./widgets/BespokeArtifactRenderer";

type NormalizedAudioCue = AudioSyncedVisualCue & { end: number };

interface LessonPartSectionProps {
  activity: LessonActivity;
  artifact?: GeneratedArtifact;
  initialWidgetState?: Record<string, number>;
  onWidgetStateChange?: (state: WidgetStateChange) => void;
  savedQuizState: string | null;
  onQuizStateChange: (serialized: string) => void;
  onQuizPassedChange: (passed: boolean) => void;
  assessContext?: QuizAssessContext | null;
  learnerId: number;
  lessonTitle?: string;
  lessonDescription?: string | null;
}

export function LessonPartSection({
  activity,
  artifact,
  initialWidgetState,
  onWidgetStateChange,
  savedQuizState,
  onQuizStateChange,
  onQuizPassedChange,
  assessContext,
  learnerId,
  lessonTitle,
  lessonDescription,
}: LessonPartSectionProps) {
  const parsed = useMemo(() => {
    if (!activity.content) return { part: null, error: "No lesson-part content" };
    try {
      return { part: JSON.parse(activity.content) as LessonPartContent, error: null };
    } catch (e) {
      return { part: null, error: e instanceof Error ? e.message : "Invalid lesson-part JSON" };
    }
  }, [activity.content]);

  const part = parsed.part;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const syncedVisual = part?.audio.synced_visual ?? null;
  // Preferred per-segment Manim video (audio muxed in). Falls back to the legacy
  // <audio> + cue-swapped artifact if absent or if the <video> errors at runtime.
  const segmentVideo = part?.audio.video ?? null;
  const showVideo = Boolean(segmentVideo) && !videoFailed;

  const seekAudio = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setAudioTime(time);
    void audioRef.current.play().catch(() => undefined);
  };

  return (
    <div className="space-y-5 px-3 py-4 sm:space-y-6 sm:p-6">
      {parsed.error || !part ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <div className="font-semibold mb-1">This lesson part could not be loaded</div>
          <p className="text-xs text-amber-700">{parsed.error}</p>
        </div>
      ) : (
        <>
          <PartBlock title="Audio">
            <div className="min-w-0 space-y-5">
              <div className="min-w-0 space-y-3">
                {showVideo && segmentVideo ? (
                  <SegmentVideoPlayer
                    activityId={activity.id}
                    video={segmentVideo}
                    onError={() => setVideoFailed(true)}
                  />
                ) : artifact?.file_path ? (
                  <div
                    className={`space-y-2 ${
                      audioPlaying
                        ? "sticky top-[4.75rem] z-20 rounded-xl border border-blue-100 bg-white/95 p-2 shadow-lg shadow-blue-100/60 backdrop-blur"
                        : ""
                    }`}
                  >
                    <audio
                      ref={audioRef}
                      controls
                      className="h-10 w-full min-w-0 max-w-full"
                      src={`/runtime/${artifact.file_path}`}
                      onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
                      onTimeUpdate={(event) => setAudioTime(event.currentTarget.currentTime)}
                      onPlay={() => setAudioPlaying(true)}
                      onPause={() => setAudioPlaying(false)}
                      onEnded={() => setAudioPlaying(false)}
                    >
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                ) : (
                  <div className="border-l-2 border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-700">
                    Part audio artifact is not generated yet. The script below is the per-part audio source.
                  </div>
                )}
                <details className="hidden border-t border-gray-100 pt-3 sm:block">
                  <summary className="cursor-pointer select-none py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                    Transcript
                  </summary>
                  <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
                    {part.audio.transcript ?? part.audio.script}
                  </div>
                </details>
              </div>
              {!showVideo && syncedVisual && (
                <AudioSyncedLessonVisual
                  visual={syncedVisual}
                  currentTime={audioTime}
                  duration={audioDuration || part.audio.duration_hint || 154}
                  onSeek={seekAudio}
                />
              )}
            </div>
          </PartBlock>

          <PartBlock title="Written explanation">
            <article className="space-y-4">
              {part.reading.intro && (
                <p className="text-[15px] text-gray-700 leading-7">{part.reading.intro}</p>
              )}
              {part.reading.blocks.map((block, i) => (
                <ReadingBlockView key={i} block={block} />
              ))}
              {part.reading.diagrams && part.reading.diagrams.length > 0 && (
                <LessonDiagramsView diagrams={part.reading.diagrams} />
              )}
              {part.reading.summary && (
                <div className="border-l-2 border-green-300 bg-green-50/70 px-3 py-3">
                  <div className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">
                    In short
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{part.reading.summary}</p>
                </div>
              )}
            </article>
          </PartBlock>

          <PartBlock title="Interactive">
            <p className="text-sm text-gray-600 leading-relaxed">
              {(part.interactive as { instructions?: string }).instructions}
            </p>
            <WidgetHost
              spec={part.interactive}
              initialState={initialWidgetState}
              onStateChange={onWidgetStateChange}
            />
          </PartBlock>

          {part.code && (
            <PartBlock title="Code practice">
              <PythonSection
                activity={{
                  ...activity,
                  activity_type: "practice_code",
                  title: `Code: ${activity.title ?? part.part_id ?? "lesson part"}`,
                  content: JSON.stringify(part.code),
                }}
                learnerId={learnerId}
                lessonTitle={lessonTitle ?? "Untitled lesson"}
                lessonDescription={lessonDescription ?? null}
                initialCode={part.code.starter_code ?? ""}
                initialOutput=""
                initialTests={{}}
                embedded
                onChange={() => undefined}
              />
            </PartBlock>
          )}

          {part.practice ? (
            <PartBlock title="Practice">
              <LessonPartPracticeSection
                activity={activity}
                lesson={{ title: lessonTitle ?? "Untitled lesson", description: lessonDescription ?? null }}
                practice={part.practice}
                assessContext={assessContext ?? null}
              />
            </PartBlock>
          ) : (
            <MultipleChoiceAssessmentSection
              activity={activity}
              savedQuizState={savedQuizState}
              onStateChange={onQuizStateChange}
              onPassedChange={onQuizPassedChange}
              assessContext={assessContext ?? null}
            />
          )}
        </>
      )}
    </div>
  );
}

function PartBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</div>
      {children}
    </div>
  );
}

export function AudioSyncedLessonVisual({
  visual,
  currentTime,
  duration,
  onSeek,
}: {
  visual: AudioSyncedVisualContent;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const cues = normalizeVisualCues(visual.cues, duration);
  if (cues.length === 0) return null;
  const safeDuration = Math.max(duration, 1);
  const foundIndex = cues.findIndex(
    (cue) => currentTime >= cue.start && currentTime < cue.end
  );
  const activeIndex = foundIndex >= 0 ? foundIndex : currentTime >= cues[cues.length - 1].end ? cues.length - 1 : 0;
  const cue = cues[Math.max(activeIndex, 0)] ?? cues[0];
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  const activeArtifactSlug = cue.artifact_slug ?? visual.artifact_slug;

  const pipelineCues =
    cues.length > 10
      ? cues.filter((_, index) => index % 6 === 0 || index === cues.length - 1)
      : cues;
  const activePipelineIndex = Math.max(
    0,
    pipelineCues.findIndex((item, index) => {
      const next = pipelineCues[index + 1];
      return currentTime >= item.start && (!next || currentTime < next.start);
    })
  );

  const artifactState = {
    audioTime: currentTime,
    cueIndex: activeIndex,
    stage: activeIndex,
    cueStart: cue.start,
    cueEnd: cue.end,
    progressPct,
  };

  const visualContent = (
    <div className="grid w-full min-w-0 max-w-full gap-4 pt-3 pb-16 sm:pt-4 sm:pb-0">
      <div className="min-w-0 space-y-4">
        <div
          className="hidden min-w-0 gap-2 pb-1 sm:grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(8rem, 100%), 1fr))" }}
          aria-label="Audio visual steps"
        >
          {pipelineCues.map((stage, index) => {
            const done = index < activePipelineIndex;
            const active = index === activePipelineIndex;
            return (
              <div
                key={`${stage.start}-${stage.label}`}
                className={`min-w-0 border-b-2 px-2 py-2 text-center text-xs font-medium leading-4 ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : done
                    ? "border-blue-200 bg-blue-50/40 text-blue-700"
                    : "border-gray-100 bg-gray-50/40 text-gray-400"
                }`}
              >
                <span className="block min-w-0 break-words">{stage.label}</span>
              </div>
            );
          })}
        </div>

        <div className="hidden min-w-0 gap-2 sm:grid md:grid-cols-3">
          <PipelineCard label="Receives" text={cue.receive ?? "prior visual state"} tone="gray" />
          <PipelineCard label="Current operation" text={cue.transform ?? cue.headline} tone="blue" />
          <PipelineCard label="Passes forward" text={cue.pass ?? "updated visual state"} tone="green" />
        </div>
        <div className="hidden min-w-0 break-words border-l-2 border-gray-200 bg-gray-50/60 px-3 py-2 text-sm leading-6 text-gray-600 sm:block">
          {cue.narration}
        </div>

        {activeArtifactSlug ? (
          <div
            className="w-full min-w-0 max-w-full overflow-hidden sm:border-t sm:border-gray-100 sm:pt-3"
            data-audio-synced-artifact={activeArtifactSlug}
          >
            <BespokeArtifactRenderer
              key={activeArtifactSlug}
              artifactSlug={activeArtifactSlug}
              initialState={artifactState}
              minHeight={360}
            />
          </div>
        ) : (
          <div
            role="alert"
            className="border-l-2 border-red-400 bg-red-50 px-3 py-3 text-sm leading-6 text-red-800"
          >
            Audio-synced visual is missing a DB-backed bespoke artifact slug. Regenerate or backfill this
            lesson part with an approved visual_artifacts row instead of using built-in panel templates.
          </div>
        )}
      </div>

      <div className="hidden space-y-2">
        <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1">
          {cues.map((item, index) => {
            const active = item === cue;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onSeek(item.start)}
                className={`border-l-2 px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-gray-100 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{index + 1}. {item.label}</span>
                  <span className="text-[11px] text-gray-400">{formatTime(item.start)}</span>
                </div>
                <div className="mt-0.5 text-xs leading-4">{item.headline}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden border-t border-gray-100 pt-3 sm:pt-4 xl:border-t-0 xl:pt-0">
      <div className="sm:hidden">
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-3 border-b border-gray-100 py-3 text-left"
          aria-expanded={mobileExpanded}
          onClick={() => setMobileExpanded((expanded) => !expanded)}
        >
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-blue-600">
              Visualization
            </span>
            <span className="block min-w-0 break-words text-sm font-semibold text-gray-900">{cue.headline}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-gray-500">
            {mobileExpanded ? "Hide" : "Show"}
          </span>
        </button>
        {mobileExpanded ? visualContent : null}
      </div>

      {!isMobileViewport ? (
      <div className="hidden sm:block">
        <div className="border-b border-gray-100 pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Audio-synced visual
            </div>
            <div className="min-w-0 break-words text-sm font-semibold text-gray-900">{cue.headline}</div>
          </div>
          <div className="shrink-0 text-xs tabular-nums text-gray-500">
            {formatTime(currentTime)} / {formatTime(safeDuration)}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-gray-100">
          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
        {visualContent}
      </div>
      ) : null}
    </div>
  );
}

function formatTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function normalizeVisualCues(
  cues: AudioSyncedVisualCue[],
  duration: number
): NormalizedAudioCue[] {
  const safeDuration = Math.max(1, Number.isFinite(duration) ? duration : 1);
  return cues
    .map((cue, index) => {
      const next = cues[index + 1];
      const start = Math.max(0, Number.isFinite(cue.start) ? cue.start : 0);
      const rawEnd =
        typeof cue.end === "number" && Number.isFinite(cue.end)
          ? cue.end
          : typeof next?.start === "number" && Number.isFinite(next.start)
            ? next.start
            : safeDuration;
      return {
        ...cue,
        start,
        end: Math.max(start + 0.1, Math.min(safeDuration, rawEnd)),
      };
    })
    .sort((a, b) => a.start - b.start);
}

function PipelineCard({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "gray" | "blue" | "green";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50/70 text-blue-900"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
        : "border-gray-200 bg-gray-50/80 text-gray-700";
  return (
    <div className={`min-w-0 border-l-2 px-3 py-2 ${toneClass}`}>
      <div className="min-w-0 break-words text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 min-w-0 break-words text-sm leading-5">{text}</div>
    </div>
  );
}

function ReadingBlockView({ block }: { block: ReadingBlock }) {
  switch (block.type) {
    case "heading":
      return <h3 className="text-base font-semibold text-gray-900 mt-5">{block.text}</h3>;
    case "paragraph":
      return <p className="text-[15px] text-gray-700 leading-7">{block.text}</p>;
    case "text":
      return <p className="text-[15px] text-gray-700 leading-7">{block.content}</p>;
    case "formula":
      return <FormulaBlockView block={block} />;
    case "definition":
      return (
        <div className="border-l-2 border-gray-200 bg-gray-50/60 px-3 py-3">
          <dt className="text-sm font-semibold text-gray-900">{block.term}</dt>
          <dd className="text-sm text-gray-600 leading-relaxed mt-0.5">{block.definition}</dd>
        </div>
      );
    case "example":
      return (
        <div className="border-l-2 border-blue-300 bg-blue-50/50 pl-3 pr-3 py-3">
          {block.title && <div className="text-xs font-semibold text-blue-700 mb-1">{block.title}</div>}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{block.body}</p>
        </div>
      );
    case "callout": {
      const tone = block.tone ?? "info";
      const styles: Record<string, string> = {
        info: "border-blue-300 bg-blue-50 text-blue-900",
        warning: "border-amber-300 bg-amber-50 text-amber-900",
        insight: "border-purple-300 bg-purple-50 text-purple-900",
      };
      return (
        <div className={`border-l-2 px-3 py-3 text-sm leading-relaxed ${styles[tone]}`}>
          {block.text}
        </div>
      );
    }
    case "list":
      return block.ordered ? (
        <ol className="list-decimal pl-5 space-y-1.5 text-[15px] text-gray-700 leading-7">
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ol>
      ) : (
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-gray-700 leading-7">
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    default:
      return null;
  }
}

function FormulaBlockView({
  block,
}: {
  block: Extract<ReadingBlock, { type: "formula" }>;
}) {
  return <FormulaBlock block={block} />;
}
