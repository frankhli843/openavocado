"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lesson, LessonActivity, GeneratedArtifact } from "@/types";
import type { LessonPartContent, LessonSegmentVideo } from "@/lib/lesson-content/schema";
import { LessonPartPracticeSection } from "./LessonPartPracticeSection";
import { MultipleChoiceAssessmentSection, type QuizAssessContext } from "./MultipleChoiceAssessmentSection";
import { SegmentVideoPlayer } from "./SegmentVideoPlayer";

interface OnTheGoLessonModeProps {
  lesson: Lesson;
  activities: LessonActivity[];
  artifacts: GeneratedArtifact[];
  sectionDone: Record<number, boolean>;
  partQuizStates: Record<number, string | null>;
  assessContext: QuizAssessContext;
  completionBlocked: boolean;
  completing: boolean;
  /** Final-assessment quiz state, shared with normal mode so progress carries over. */
  assessmentQuizState: string | null;
  onAssessmentQuizStateChange: (serialized: string) => void;
  onAssessmentQuizPassedChange: (passed: boolean) => void;
  onBackToNormal: () => void;
  onSectionDoneChange: (activityId: number, done: boolean) => void;
  onPartQuizStateChange: (activityId: number, serialized: string) => void;
  onCompleteLesson: () => void;
}

/** Shape of the lesson-level `audio` activity content (the overview). */
interface OverviewAudioContent {
  script?: string;
  transcript?: string;
  duration_hint?: number;
  orientation_video?: LessonSegmentVideo;
}

type OnTheGoCard =
  | { kind: "overview"; key: string; activity: LessonActivity; content: OverviewAudioContent; artifact?: GeneratedArtifact }
  | { kind: "media"; key: string; activity: LessonActivity; part: LessonPartContent; artifact?: GeneratedArtifact }
  | { kind: "practice"; key: string; activity: LessonActivity; part: LessonPartContent }
  | { kind: "sectionDone"; key: string; activity: LessonActivity; part: LessonPartContent }
  | { kind: "finalQuiz"; key: string; activity: LessonActivity }
  | { kind: "lessonDone"; key: string };

export function OnTheGoLessonMode({
  lesson,
  activities,
  artifacts,
  sectionDone,
  partQuizStates,
  assessContext,
  completionBlocked,
  completing,
  assessmentQuizState,
  onAssessmentQuizStateChange,
  onAssessmentQuizPassedChange,
  onBackToNormal,
  onSectionDoneChange,
  onPartQuizStateChange,
  onCompleteLesson,
}: OnTheGoLessonModeProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [videoFailures, setVideoFailures] = useState<Record<number, boolean>>({});

  // Keep the screen awake while learning on the move (treadmill, walking).
  // Re-acquire on tab return: browsers release wake locks when the page hides.
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = () => {
      nav.wakeLock
        ?.request("screen")
        .then((s) => {
          if (cancelled) void s.release().catch(() => undefined);
          else sentinel = s;
        })
        .catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  const hasPracticeCode = activities.some((a) => a.activity_type === "practice_code");

  const cards = useMemo<OnTheGoCard[]>(() => {
    const next: OnTheGoCard[] = [];

    // Lesson overview first: the audio activity carries the main lesson video
    // (orientation_video) or falls back to the overview audio artifact.
    const overviewActivity = activities.find((a) => a.activity_type === "audio");
    if (overviewActivity) {
      let content: OverviewAudioContent = {};
      try {
        content = overviewActivity.content ? (JSON.parse(overviewActivity.content) as OverviewAudioContent) : {};
      } catch {
        content = {};
      }
      const artifact = artifacts.find((a) => a.artifact_type === "audio" && a.activity_id === overviewActivity.id);
      next.push({ kind: "overview", key: `${overviewActivity.id}:overview`, activity: overviewActivity, content, artifact });
    }

    for (const activity of activities) {
      if (activity.activity_type !== "lesson_part" || !activity.content) continue;
      try {
        const part = JSON.parse(activity.content) as LessonPartContent;
        const artifact = artifacts.find((a) => a.artifact_type === "audio" && a.activity_id === activity.id);
        next.push({ kind: "media", key: `${activity.id}:media`, activity, part, artifact });
        next.push({ kind: "practice", key: `${activity.id}:practice`, activity, part });
        next.push({ kind: "sectionDone", key: `${activity.id}:done`, activity, part });
      } catch {
        continue;
      }
    }

    // Final MC quiz gates completion, so it must be reachable on the go.
    const assessmentActivity = activities.find((a) => a.activity_type === "assessment");
    if (assessmentActivity?.content) {
      try {
        const parsed = JSON.parse(assessmentActivity.content) as { quiz?: { questions?: unknown[] } };
        if (Array.isArray(parsed.quiz?.questions) && parsed.quiz.questions.length > 0) {
          next.push({ kind: "finalQuiz", key: `${assessmentActivity.id}:final-quiz`, activity: assessmentActivity });
        }
      } catch {
        /* ignore malformed assessment content */
      }
    }

    next.push({ kind: "lessonDone", key: "lesson-done" });
    return next;
  }, [activities, artifacts]);

  function scrollByCard(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth, behavior: "smooth" });
    // Land at the top of the next card. Button focus otherwise keeps the
    // viewport pinned to the card bottom, hiding the media/quiz content.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-gray-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-200">On the go</div>
            <h1 className="truncate text-sm font-semibold text-white sm:text-base">{lesson.title}</h1>
          </div>
          <button
            type="button"
            onClick={onBackToNormal}
            className="shrink-0 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Normal mode
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        aria-label="On the go lesson cards"
      >
        {cards.map((card, index) => (
          <section
            key={card.key}
            className="flex min-h-[calc(100vh-4.5rem)] w-full shrink-0 snap-center flex-col px-4 py-5"
            aria-label={`Card ${index + 1} of ${cards.length}`}
          >
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col rounded-2xl border border-white/10 bg-white p-4 text-gray-900 shadow-2xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {index + 1} / {cards.length}
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-gray-950 sm:text-xl">{cardTitle(card)}</h2>
                </div>
                {"activity" in card && sectionDone[card.activity.id] && (
                  <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    Done
                  </span>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pb-4">
                {card.kind === "overview" && (
                  <OnTheGoOverviewCard
                    activity={card.activity}
                    content={card.content}
                    artifact={card.artifact}
                    videoFailed={!!videoFailures[card.activity.id]}
                    onVideoError={() => setVideoFailures((prev) => ({ ...prev, [card.activity.id]: true }))}
                    onMediaEnded={() => scrollByCard(1)}
                  />
                )}
                {card.kind === "media" && (
                  <OnTheGoMediaCard
                    activity={card.activity}
                    part={card.part}
                    artifact={card.artifact}
                    videoFailed={!!videoFailures[card.activity.id]}
                    onVideoError={() => setVideoFailures((prev) => ({ ...prev, [card.activity.id]: true }))}
                    onMediaEnded={() => scrollByCard(1)}
                  />
                )}
                {card.kind === "practice" && (
                  card.part.practice ? (
                    <LessonPartPracticeSection
                      activity={card.activity}
                      lesson={{ title: lesson.title, description: lesson.description ?? null }}
                      practice={card.part.practice}
                      assessContext={assessContext}
                    />
                  ) : (
                    <MultipleChoiceAssessmentSection
                      activity={card.activity}
                      savedQuizState={partQuizStates[card.activity.id] ?? null}
                      onStateChange={(serialized) => onPartQuizStateChange(card.activity.id, serialized)}
                      onPassedChange={() => undefined}
                      assessContext={assessContext}
                    />
                  )
                )}
                {card.kind === "finalQuiz" && (
                  <MultipleChoiceAssessmentSection
                    activity={card.activity}
                    savedQuizState={assessmentQuizState}
                    onStateChange={onAssessmentQuizStateChange}
                    onPassedChange={onAssessmentQuizPassedChange}
                    assessContext={assessContext}
                  />
                )}
                {card.kind === "sectionDone" && (
                  <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
                    <div className="mb-4 text-4xl text-green-600">&#10003;</div>
                    <p className="max-w-md text-base leading-7 text-gray-600">
                      Mark this sub lesson as complete when the video and practice feel done enough to move on.
                    </p>
                    <button
                      type="button"
                      onClick={() => onSectionDoneChange(card.activity.id, true)}
                      className="mt-6 rounded-xl bg-green-600 px-8 py-4 text-base font-semibold text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
                    >
                      {sectionDone[card.activity.id] ? "Section complete" : "Mark section complete"}
                    </button>
                  </div>
                )}
                {card.kind === "lessonDone" && (
                  <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
                    <div className="mb-4 text-4xl text-blue-600">&#9733;</div>
                    <p className="max-w-md text-base leading-7 text-gray-600">
                      You reached the end of the on the go path. Finish the lesson when the required checks are complete.
                    </p>
                    {hasPracticeCode && (
                      <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
                        This lesson also has a coding exercise that is easier at a desk. It stays available in normal mode and is not required to finish here.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={onCompleteLesson}
                      disabled={completionBlocked || completing}
                      className="mt-6 rounded-xl bg-blue-600 px-9 py-4 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                    >
                      {completing ? "Completing..." : "Mark lesson done"}
                    </button>
                    {completionBlocked && (
                      <p className="mt-3 text-sm text-amber-600">Pass the final quiz on the previous card first.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => scrollByCard(-1)}
                  className="rounded-xl border border-gray-200 px-6 py-3 text-base font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  disabled={index === 0}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => scrollByCard(1)}
                  className="rounded-xl bg-gray-950 px-8 py-3 text-base font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
                  disabled={index === cards.length - 1}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function cardTitle(card: OnTheGoCard): string {
  if (card.kind === "lessonDone") return "Finish lesson";
  if (card.kind === "overview") return card.activity.title ?? "Lesson overview";
  if (card.kind === "finalQuiz") return "Final quiz";
  if (card.kind === "media") return card.activity.title ?? card.part.part_id ?? "Watch";
  if (card.kind === "practice") return "Quiz";
  return "Section complete";
}

/**
 * Lesson-level overview card: prefers the full overview video, falls back to
 * the overview audio artifact so the intro is never skipped on the go.
 */
function OnTheGoOverviewCard({
  activity,
  content,
  artifact,
  videoFailed,
  onVideoError,
  onMediaEnded,
}: {
  activity: LessonActivity;
  content: OverviewAudioContent;
  artifact?: GeneratedArtifact;
  videoFailed: boolean;
  onVideoError: () => void;
  onMediaEnded: () => void;
}) {
  const overviewVideo = content.orientation_video ?? null;
  if (overviewVideo && !videoFailed) {
    return (
      <SegmentVideoPlayer activityId={activity.id} video={overviewVideo} onError={onVideoError} onEnded={onMediaEnded} />
    );
  }
  if (artifact?.file_path) {
    return (
      <audio
        controls
        className="h-14 w-full min-w-0 max-w-full"
        src={`/runtime/${artifact.file_path}`}
        onEnded={onMediaEnded}
      >
        Your browser does not support audio playback.
      </audio>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      The overview media is not generated yet for this lesson.
    </div>
  );
}

function OnTheGoMediaCard({
  activity,
  part,
  artifact,
  videoFailed,
  onVideoError,
  onMediaEnded,
}: {
  activity: LessonActivity;
  part: LessonPartContent;
  artifact?: GeneratedArtifact;
  videoFailed: boolean;
  onVideoError: () => void;
  onMediaEnded: () => void;
}) {
  const segmentVideo = part.audio.video ?? null;
  if (segmentVideo && !videoFailed) {
    return (
      <SegmentVideoPlayer activityId={activity.id} video={segmentVideo} onError={onVideoError} onEnded={onMediaEnded} />
    );
  }
  if (artifact?.file_path) {
    return (
      <audio controls className="h-14 w-full min-w-0 max-w-full" src={`/runtime/${artifact.file_path}`} onEnded={onMediaEnded}>
        Your browser does not support audio playback.
      </audio>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Media is not generated yet for this sub lesson.
    </div>
  );
}
