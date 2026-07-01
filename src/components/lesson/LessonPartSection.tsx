"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { GeneratedArtifact, LessonActivity, ReadingBlock } from "@/types";
import type { LessonPartContent } from "@/lib/lesson-content/schema";
import type { WidgetStateChange } from "./widgets/DeclarativeWidget";
import { WidgetHost } from "./widgets/WidgetHost";
import { LessonDiagramsView } from "./LessonDiagrams";
import {
  MultipleChoiceAssessmentSection,
  type QuizAssessContext,
} from "./MultipleChoiceAssessmentSection";

interface LessonPartSectionProps {
  activity: LessonActivity;
  artifact?: GeneratedArtifact;
  initialWidgetState?: Record<string, number>;
  onWidgetStateChange?: (state: WidgetStateChange) => void;
  savedQuizState: string | null;
  onQuizStateChange: (serialized: string) => void;
  onQuizPassedChange: (passed: boolean) => void;
  assessContext?: QuizAssessContext | null;
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

  const seekAudio = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setAudioTime(time);
    void audioRef.current.play().catch(() => undefined);
  };

  return (
    <div className="p-6 space-y-6">
      {parsed.error || !part ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <div className="font-semibold mb-1">This lesson part could not be loaded</div>
          <p className="text-xs text-amber-700">{parsed.error}</p>
        </div>
      ) : (
        <>
          <PartBlock title="Audio">
            {artifact?.file_path ? (
              <div className="space-y-2">
                <audio
                  ref={audioRef}
                  controls
                  className="w-full h-10"
                  src={`/runtime/${artifact.file_path}`}
                  onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
                  onTimeUpdate={(event) => setAudioTime(event.currentTarget.currentTime)}
                >
                  Your browser does not support audio playback.
                </audio>
                <div className="text-xs text-gray-400">
                  {artifact.voice ? `Voice: ${artifact.voice}` : "Generated audio"}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                Part audio artifact is not generated yet. The script below is the per-part audio source.
              </div>
            )}
            {activity.id === 40 && (
              <AudioSyncedHiddenStateVisual
                currentTime={audioTime}
                duration={audioDuration || 154}
                onSeek={seekAudio}
              />
            )}
            <details className="rounded-lg border border-gray-100 bg-gray-50">
              <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                Transcript
              </summary>
              <div className="max-h-56 overflow-y-auto border-t border-gray-100 bg-white px-4 py-3 text-sm leading-relaxed text-gray-600">
                {part.audio.script}
              </div>
            </details>
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
                <div className="rounded-lg bg-green-50/70 border border-green-100 px-4 py-3">
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

          <MultipleChoiceAssessmentSection
            activity={activity}
            savedQuizState={savedQuizState}
            onStateChange={onQuizStateChange}
            onPassedChange={onQuizPassedChange}
            assessContext={assessContext ?? null}
          />
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

interface AudioVisualCue {
  start: number;
  end: number;
  label: string;
  headline: string;
  narration: string;
  receive: string;
  transform: string;
  pass: string;
}

const HIDDEN_STATE_AUDIO_CUES: AudioVisualCue[] = [
  {
    start: 0,
    end: 18,
    label: "Map",
    headline: "You are here in the LLM pipeline",
    narration: "Text has already been tokenized. This section explains the handoff into model-owned numeric state.",
    receive: "prompt text plus tokenizer vocabulary",
    transform: "tokenizer creates stable IDs",
    pass: "token ID list",
  },
  {
    start: 18,
    end: 44,
    label: "Token IDs",
    headline: "Token IDs are addresses, not meaning",
    narration: "The list [12, 44, 91, 44] tells the model which rows to fetch from its learned embedding table.",
    receive: "token sequence",
    transform: "convert each token to a row address",
    pass: "[12, 44, 91, 44]",
  },
  {
    start: 44,
    end: 72,
    label: "Embedding lookup",
    headline: "Each ID copies one learned vector row",
    narration: "ID 44 points to the same embedding row every time it appears, because the tokenizer and embedding table were trained as a matched pair.",
    receive: "[12, 44, 91, 44]",
    transform: "look up one vector row per ID",
    pass: "four learned token vectors",
  },
  {
    start: 72,
    end: 96,
    label: "Position",
    headline: "Position vectors tell identical IDs where they are",
    narration: "The two 44 tokens start from the same learned row, then receive different position information because they appear in different slots.",
    receive: "token vectors",
    transform: "add position information to each row",
    pass: "position-aware rows",
  },
  {
    start: 96,
    end: 126,
    label: "Hidden state",
    headline: "Rows stack into the first hidden-state matrix",
    narration: "The transformer does not consume raw text. It consumes this table: one row per token position and one column per hidden feature.",
    receive: "position-aware rows",
    transform: "stack rows into a matrix",
    pass: "hidden-state matrix",
  },
  {
    start: 126,
    end: 154,
    label: "Transformer",
    headline: "Transformer blocks edit the matrix next",
    narration: "This hidden-state matrix is the object attention and MLP layers will refine before the output head scores next-token logits.",
    receive: "hidden-state matrix",
    transform: "attention and MLP update rows",
    pass: "edited matrix for logits",
  },
];

function AudioSyncedHiddenStateVisual({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const safeDuration = Math.max(duration, 1);
  const activeIndex = HIDDEN_STATE_AUDIO_CUES.findIndex(
    (cue) => currentTime >= cue.start && currentTime < cue.end
  );
  const cue = HIDDEN_STATE_AUDIO_CUES[Math.max(activeIndex, 0)] ?? HIDDEN_STATE_AUDIO_CUES[0];
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  const pipeline = [
    "Text",
    "Tokenizer",
    "Token IDs",
    "Embedding",
    "Hidden states",
    "Transformer",
    "Logits",
  ];
  const activePipelineIndex = Math.min(
    pipeline.length - 1,
    cue.label === "Map"
      ? 1
      : cue.label === "Token IDs"
      ? 2
      : cue.label === "Embedding lookup"
      ? 3
      : cue.label === "Position" || cue.label === "Hidden state"
      ? 4
      : 5
  );

  const rows = [
    { token: "ID 12", vector: [20, 42, 70], active: cue.start >= 18 },
    { token: "ID 44", vector: [85, 52, 30], active: cue.start >= 44 },
    { token: "ID 91", vector: [40, 82, 18], active: cue.start >= 44 },
    { token: "ID 44", vector: [85, 34, 58], active: cue.start >= 72 },
  ];

  return (
    <div className="rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-blue-50 bg-blue-50/70 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Audio-synced visual
            </div>
            <div className="text-sm font-semibold text-gray-900">{cue.headline}</div>
          </div>
          <div className="text-xs tabular-nums text-gray-500">
            {formatTime(currentTime)} / {formatTime(safeDuration)}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white">
          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {pipeline.map((stage, index) => {
              const done = index < activePipelineIndex;
              const active = index === activePipelineIndex;
              return (
                <div
                  key={stage}
                  className={`rounded-lg border px-2 py-2 text-center text-xs font-medium ${
                    active
                      ? "border-blue-400 bg-blue-600 text-white shadow-sm"
                      : done
                      ? "border-blue-100 bg-blue-50 text-blue-700"
                      : "border-gray-100 bg-gray-50 text-gray-400"
                  }`}
                >
                  {stage}
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <PipelineCard label="Receives" text={cue.receive} tone="gray" />
            <PipelineCard label="Current operation" text={cue.transform} tone="blue" />
            <PipelineCard label="Passes forward" text={cue.pass} tone="green" />
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Tiny hidden-state trace
            </div>
            <div className="space-y-2">
              {rows.map((row, rowIndex) => (
                <div
                  key={`${row.token}-${rowIndex}`}
                  className={`grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2 ${
                    row.active
                      ? "border-blue-100 bg-white"
                      : "border-gray-100 bg-white/60 opacity-60"
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-600">{row.token}</div>
                  <div className="flex items-center gap-2">
                    {row.vector.map((value, i) => (
                      <div key={i} className="h-6 flex-1 rounded bg-blue-100 overflow-hidden">
                        <div
                          className={`h-full rounded ${row.active ? "bg-blue-500" : "bg-gray-300"}`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    ))}
                    <span className="w-10 text-right text-[11px] text-gray-400">
                      row {rowIndex + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              The visual is not showing real model weights. It shows the shape of the handoff:
              token IDs select rows, rows become vectors, and vectors stack into the matrix that
              transformer blocks edit next.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-600">
            {cue.narration}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {HIDDEN_STATE_AUDIO_CUES.map((item, index) => {
              const active = item === cue;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onSeek(item.start)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-blue-300 bg-blue-50 text-blue-900"
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
    </div>
  );
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
  const styles = {
    gray: "border-gray-100 bg-gray-50 text-gray-700",
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    green: "border-green-100 bg-green-50 text-green-800",
  };
  return (
    <div className={`rounded-lg border px-3 py-3 ${styles[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-sm font-medium leading-5">{text}</div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function ReadingBlockView({ block }: { block: ReadingBlock }) {
  switch (block.type) {
    case "heading":
      return <h3 className="text-base font-semibold text-gray-900 mt-5">{block.text}</h3>;
    case "paragraph":
      return <p className="text-[15px] text-gray-700 leading-7">{block.text}</p>;
    case "definition":
      return (
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3">
          <dt className="text-sm font-semibold text-gray-900">{block.term}</dt>
          <dd className="text-sm text-gray-600 leading-relaxed mt-0.5">{block.definition}</dd>
        </div>
      );
    case "example":
      return (
        <div className="rounded-lg border-l-4 border-blue-300 bg-blue-50/50 pl-4 pr-3 py-3">
          {block.title && <div className="text-xs font-semibold text-blue-700 mb-1">{block.title}</div>}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{block.body}</p>
        </div>
      );
    case "callout": {
      const tone = block.tone ?? "info";
      const styles: Record<string, string> = {
        info: "border-blue-200 bg-blue-50 text-blue-900",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
        insight: "border-purple-200 bg-purple-50 text-purple-900",
      };
      return (
        <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles[tone]}`}>
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
