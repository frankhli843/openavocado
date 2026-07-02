"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import katex from "katex";
import type { GeneratedArtifact, LessonActivity, ReadingBlock } from "@/types";
import type {
  AudioGeneratedScenePanel,
  AudioSyncedVisualContent,
  AudioSyncedVisualCue,
  LessonPartContent,
} from "@/lib/lesson-content/schema";
import type { WidgetStateChange } from "./widgets/DeclarativeWidget";
import { WidgetHost } from "./widgets/WidgetHost";
import { LessonDiagramsView } from "./LessonDiagrams";
import { FormulaBlock } from "./FormulaBlock";
import { PythonSection } from "./PythonSection";
import { LessonPartPracticeSection } from "./LessonPartPracticeSection";
import {
  MultipleChoiceAssessmentSection,
  type QuizAssessContext,
} from "./MultipleChoiceAssessmentSection";

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
  const syncedVisual =
    part?.audio.synced_visual ??
    (activity.id === 40
      ? ({
          strategy: "timeline",
          scene: {
            scene_id: "legacy-hidden-state-generated-scene",
            title: "Token IDs become hidden-state rows",
            motif: "embedding table and row stack",
            description: "Generated compatibility scene for the older hidden-state lesson, showing token IDs selecting embedding rows and stacking into a matrix.",
            panels: [
              {
                id: "embedding-table",
                title: "Embedding table rows",
                kind: "matrix",
                description: "Token IDs act like row addresses into learned embedding weights.",
                data: [
                  { label: "ID 12", values: [20, 42, 70], role: "input" },
                  { label: "ID 44", values: [85, 52, 30], role: "process" },
                  { label: "ID 91", values: [40, 82, 18], role: "process" },
                ],
              },
              {
                id: "hidden-state",
                title: "Hidden-state matrix",
                kind: "matrix",
                description: "Selected rows stack into the L by D object the transformer edits.",
                data: [
                  { label: "row 1", values: [20, 42, 70], role: "output" },
                  { label: "row 2", values: [85, 52, 30], role: "output" },
                  { label: "row 3", values: [40, 82, 18], role: "output" },
                ],
              },
            ],
          },
          cues: HIDDEN_STATE_AUDIO_CUES,
        } satisfies AudioSyncedVisualContent)
      : null);

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
            <div className={syncedVisual ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)] xl:items-start" : "min-w-0 space-y-3"}>
              <div className="min-w-0 space-y-3">
                {artifact?.file_path ? (
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
                    <div className="text-xs text-gray-400">
                      {artifact.voice ? `Voice: ${artifact.voice}` : "Generated audio"}
                    </div>
                  </div>
                ) : (
                  <div className="border-l-2 border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-700">
                    Part audio artifact is not generated yet. The script below is the per-part audio source.
                  </div>
                )}
                <details className="border-t border-gray-100 pt-3">
                  <summary className="cursor-pointer select-none py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                    Transcript
                  </summary>
                  <div className="mt-2 max-h-56 overflow-y-auto border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
                    {part.audio.transcript ?? part.audio.script}
                  </div>
                </details>
              </div>
              {syncedVisual && (
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

const HIDDEN_STATE_AUDIO_CUES: AudioSyncedVisualCue[] = [
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
  const cues = normalizeVisualCues(visual.cues, duration);
  if (cues.length === 0) return null;
  const safeDuration = Math.max(duration, 1);
  const foundIndex = cues.findIndex(
    (cue) => currentTime >= cue.start && currentTime < cue.end
  );
  const activeIndex = foundIndex >= 0 ? foundIndex : currentTime >= cues[cues.length - 1].end ? cues.length - 1 : 0;
  const cue = cues[Math.max(activeIndex, 0)] ?? cues[0];
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

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

  const rows = [
    { token: "ID 12", vector: [20, 42, 70], active: cue.start >= 18 },
    { token: "ID 44", vector: [85, 52, 30], active: cue.start >= 44 },
    { token: "ID 91", vector: [40, 82, 18], active: cue.start >= 44 },
    { token: "ID 44", vector: [85, 34, 58], active: cue.start >= 72 },
  ];
  const hiddenStateScene =
    visual.artifact_slug === "lesson-7-token-ids-hidden-states" ||
    cues.some((item) => item.label === "Embedding lookup");
  const qkvScene =
    visual.artifact_slug?.includes("qkv") === true ||
    cues.some((item) => /q[,/ ]*k[,/ ]*v|query|key|value|score|softmax/i.test(`${item.label} ${item.headline}`));
  const residualScene =
    visual.artifact_slug?.includes("residual") === true ||
    cues.some((item) => /residual|stream|ledger|add/i.test(`${item.label} ${item.headline}`));
  const mlpScene =
    visual.artifact_slug?.includes("mlp") === true ||
    cues.some((item) => /mlp|gelu|feed|expansion|gate/i.test(`${item.label} ${item.headline}`));
  const transformerBlockScene =
    visual.artifact_slug === "lesson-7-transformer-block-scene" ||
    cues.some((item) => item.label.toLowerCase().includes("attention") || item.label.toLowerCase().includes("mlp"));

  return (
    <div className="min-w-0 border-t border-gray-100 pt-4 xl:border-t-0 xl:pt-0">
      <div className="border-b border-gray-100 pb-3">
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
        <div className="mt-3 h-2 rounded-full bg-gray-100">
          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 pt-4 pb-16 sm:pb-0 2xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {pipelineCues.map((stage, index) => {
              const done = index < activePipelineIndex;
              const active = index === activePipelineIndex;
              return (
                <div
                  key={`${stage.start}-${stage.label}`}
                  className={`border-b-2 px-1 py-2 text-center text-xs font-medium ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : done
                      ? "border-blue-200 bg-blue-50/40 text-blue-700"
                      : "border-gray-100 bg-gray-50/40 text-gray-400"
                  }`}
                >
                  {stage.label}
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <PipelineCard label="Receives" text={cue.receive ?? "prior visual state"} tone="gray" />
            <PipelineCard label="Current operation" text={cue.transform ?? cue.headline} tone="blue" />
            <PipelineCard label="Passes forward" text={cue.pass ?? "updated visual state"} tone="green" />
          </div>
          <div className="border-l-2 border-gray-200 bg-gray-50/60 px-3 py-2 text-sm leading-6 text-gray-600">
            {cue.narration}
          </div>

          {visual.scene ? (
            <GeneratedAudioScene visual={visual} cue={cue} currentTime={currentTime} />
          ) : qkvScene ? (
            <QkvAttentionScene cue={cue} currentTime={currentTime} />
          ) : residualScene ? (
            <ResidualStreamScene cue={cue} currentTime={currentTime} />
          ) : mlpScene ? (
            <MlpExpansionScene cue={cue} currentTime={currentTime} />
          ) : hiddenStateScene ? (
            <div className="border-t border-gray-100 pt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Tiny hidden-state trace
              </div>
              <div className="space-y-2">
                {rows.map((row, rowIndex) => (
                  <div
                    key={`${row.token}-${rowIndex}`}
                    className={`grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 border-l-2 px-2 py-2 sm:px-3 ${
                      row.active
                        ? "border-blue-400 bg-blue-50/40"
                        : "border-gray-100 bg-gray-50/60 opacity-60"
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
          ) : transformerBlockScene ? (
            <TransformerBlockScene cue={cue} currentTime={currentTime} />
          ) : (
            <GenericSceneBoard cue={cue} index={activeIndex} total={cues.length} />
          )}
        </div>

        <div className="hidden space-y-2 2xl:block">
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
    </div>
  );
}

function TransformerBlockScene({
  cue,
  currentTime,
}: {
  cue: NormalizedAudioCue;
  currentTime: number;
}) {
  const label = cue.label.toLowerCase();
  const phase =
    label.includes("attention") || label.includes("score") || label.includes("mix")
      ? "attention"
      : label.includes("residual") || label.includes("norm")
      ? "residual"
      : label.includes("mlp") || label.includes("feed") || label.includes("feature")
      ? "mlp"
      : label.includes("handoff") || label.includes("output") || label.includes("logit")
      ? "output"
      : "input";
  const pulse = Math.round((currentTime % 5) + 1);
  const rows = [
    { token: "the", values: [34, 62, 45, 24] },
    { token: "cat", values: [72, 28, 52, 64] },
    { token: "sat", values: [48, 74, 34, 58] },
    { token: "mat", values: [26, 42, 78, 46] },
  ];
  const attention = [
    [82, 35, 22, 18],
    [28, 80, 44, 52],
    [34, 56, 76, 42],
    [22, 62, 48, 86],
  ];
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Transformer block scene
          </div>
          <div className="text-sm font-semibold text-gray-800">{cue.headline}</div>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">
          5s beat {pulse}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3">
          <SceneStage active={phase === "input"} label="1. Hidden-state rows enter">
            <div className="space-y-2">
              {rows.map((row, rowIndex) => (
                <div key={row.token} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
                  <div className="rounded bg-white px-2 py-1 text-xs font-semibold text-gray-600">
                    {rowIndex}: {row.token}
                  </div>
                  <div className="flex gap-1">
                    {row.values.map((value, i) => (
                      <div key={i} className="h-7 flex-1 rounded bg-blue-50">
                        <div
                          className={`h-full rounded transition-all duration-500 ${
                            phase === "input" ? "bg-blue-500" : "bg-blue-200"
                          }`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SceneStage>

          <SceneStage active={phase === "attention"} label="2. Attention mixes rows">
            <div className="grid grid-cols-[3.5rem_repeat(4,minmax(0,1fr))] gap-1 text-center text-[11px]">
              <div />
              {rows.map((row) => (
                <div key={row.token} className="font-semibold text-gray-400">{row.token}</div>
              ))}
              {attention.map((line, rowIndex) => (
                <FragmentRow
                  key={rows[rowIndex].token}
                  label={rows[rowIndex].token}
                  values={line}
                  active={phase === "attention"}
                />
              ))}
            </div>
          </SceneStage>
        </div>

        <div className="space-y-3">
          <SceneStage active={phase === "residual"} label="3. Residual + normalization">
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-xs">
              <MiniBox label="old row" active={phase === "residual"} />
              <span className="font-semibold text-blue-500">+</span>
              <MiniBox label="attention update" active={phase === "residual"} />
              <span className="font-semibold text-green-500">→</span>
              <MiniBox label="stable row" active={phase === "residual"} tone="green" />
            </div>
            <div className="mt-2 h-2 rounded-full bg-white">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  phase === "residual" ? "w-4/5 bg-green-500" : "w-1/3 bg-gray-200"
                }`}
              />
            </div>
          </SceneStage>

          <SceneStage active={phase === "mlp"} label="4. MLP edits each row">
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-xs">
              <MiniBox label="D features" active={phase === "mlp"} />
              <span className="font-semibold text-purple-500">→</span>
              <MiniBox label="expand + activation" active={phase === "mlp"} tone="purple" />
              <span className="font-semibold text-purple-500">→</span>
              <MiniBox label="D update" active={phase === "mlp"} tone="blue" />
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              The MLP works row-by-row. It does not mix token positions; attention already did that.
            </p>
          </SceneStage>

          <SceneStage active={phase === "output"} label="5. Same shape leaves richer">
            <div className="grid grid-cols-4 gap-1">
              {rows.map((row, index) => (
                <div
                  key={row.token}
                  className={`border-l-2 px-2 py-2 text-center text-xs ${
                    phase === "output" ? "border-blue-400 bg-blue-50 text-blue-800" : "border-gray-100 bg-gray-50 text-gray-500"
                  }`}
                >
                  row {index + 1}
                  <div className="mt-1 text-[10px] text-gray-400">D cols</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Shape stays L by D. The values now carry more context, ready for another block or the logits head.
            </p>
          </SceneStage>
        </div>
      </div>
    </div>
  );
}

function SceneStage({ active, label, children }: { active: boolean; label: string; children: ReactNode }) {
  return (
    <div className={`border-l-2 px-3 py-3 transition-colors ${active ? "border-blue-500 bg-blue-50/40" : "border-gray-100 bg-gray-50/50"}`}>
      <div className={`mb-2 text-xs font-semibold uppercase tracking-wider ${active ? "text-blue-600" : "text-gray-400"}`}>
        {label}
      </div>
      {children}
    </div>
  );
}

function FragmentRow({ label, values, active }: { label: string; values: number[]; active: boolean }) {
  return (
    <>
      <div className="bg-white/70 px-1 py-1 font-semibold text-gray-500">{label}</div>
      {values.map((value, index) => (
        <div key={index} className="h-7 bg-white/70">
          <div
            className={`h-full transition-all duration-500 ${active ? "bg-blue-500" : "bg-gray-200"}`}
            style={{ width: `${value}%`, opacity: active ? Math.max(0.25, value / 100) : 0.45 }}
          />
        </div>
      ))}
    </>
  );
}

function MiniBox({ label, active, tone = "blue" }: { label: string; active: boolean; tone?: "blue" | "green" | "purple" }) {
  const colors = {
    blue: active ? "border-blue-400 bg-blue-50 text-blue-800" : "border-gray-100 bg-white/70 text-gray-500",
    green: active ? "border-green-400 bg-green-50 text-green-800" : "border-gray-100 bg-white/70 text-gray-500",
    purple: active ? "border-purple-400 bg-purple-50 text-purple-800" : "border-gray-100 bg-white/70 text-gray-500",
  };
  return <div className={`border-l-2 px-2 py-3 font-medium ${colors[tone]}`}>{label}</div>;
}

function GenericSceneBoard({
  cue,
  index,
  total,
}: {
  cue: NormalizedAudioCue;
  index: number;
  total: number;
}) {
  const fill = Math.min(100, Math.max(8, ((index + 1) / Math.max(total, 1)) * 100));
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Timed scene board
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_2rem_minmax(0,1fr)] md:items-stretch">
        <SceneCard label="Incoming object" text={cue.receive ?? "previous state"} />
        <div className="hidden md:flex items-center justify-center text-blue-400">&#8594;</div>
        <SceneCard label="Animated change" text={cue.transform ?? cue.headline} active />
        <div className="hidden md:flex items-center justify-center text-green-500">&#8594;</div>
        <SceneCard label="Output" text={cue.pass ?? "next state"} />
      </div>
      <div className="mt-3 h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-green-500" style={{ width: `${fill}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">
        This scene board follows the audio cue-by-cue: the incoming object, the animated
        transformation, and the handoff to the next part stay visible together.
      </p>
    </div>
  );
}

function SceneCard({ label, text, active }: { label: string; text: string; active?: boolean }) {
  return (
    <div
      className={`border-l-2 px-3 py-3 ${
        active ? "border-blue-500 bg-blue-50 text-blue-900" : "border-gray-100 bg-gray-50/60 text-gray-700"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-60">{label}</div>
      <div className="mt-1 text-sm font-medium leading-5">{text}</div>
    </div>
  );
}

function normalizeVisualCues(cues: AudioSyncedVisualCue[], duration: number): NormalizedAudioCue[] {
  const safeDuration = Math.max(duration, 1);
  return cues.map((cue, index) => {
    const nextStart = cues[index + 1]?.start;
    const end =
      typeof cue.end === "number"
        ? cue.end
        : typeof nextStart === "number"
        ? nextStart
        : safeDuration;
    return {
      start: cue.start,
      end,
      label: cue.label,
      headline: cue.headline,
      narration: cue.narration,
      receive: cue.receive,
      transform: cue.transform,
      pass: cue.pass,
      visual_kind: cue.visual_kind,
      panel_id: cue.panel_id,
      active_elements: cue.active_elements,
    };
  });
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
    gray: "border-gray-100 bg-gray-50/60 text-gray-700",
    blue: "border-blue-400 bg-blue-50/70 text-blue-800",
    green: "border-green-400 bg-green-50/70 text-green-800",
  };
  return (
    <div className={`border-l-2 px-3 py-3 ${styles[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-sm font-medium leading-5">{text}</div>
    </div>
  );
}

function GeneratedAudioScene({
  visual,
  cue,
  currentTime,
}: {
  visual: AudioSyncedVisualContent;
  cue: NormalizedAudioCue;
  currentTime: number;
}) {
  const panels = visual.scene.panels;
  const activePanelId = cue.panel_id && panels.some((panel) => panel.id === cue.panel_id)
    ? cue.panel_id
    : panels[Math.floor(currentTime / 7) % panels.length]?.id;
  const activePanelIndex = Math.max(0, panels.findIndex((panel) => panel.id === activePanelId));
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="mb-3 flex max-w-full gap-1 overflow-x-auto pb-1" aria-label="Generated scene steps">
        {panels.map((panel, index) => (
          <div
            key={panel.id}
            className={`h-1.5 min-w-10 flex-1 rounded-full ${
              panel.id === activePanelId ? "bg-blue-600" : index < activePanelIndex ? "bg-blue-200" : "bg-gray-200"
            }`}
            title={panel.title}
          />
        ))}
      </div>
      {panels[activePanelIndex] ? (
        <GeneratedScenePanel
          panel={panels[activePanelIndex]}
          active
          activeElements={cue.active_elements ?? []}
        />
      ) : null}
    </div>
  );
}

function GeneratedScenePanel({
  panel,
  active,
  activeElements,
}: {
  panel: AudioGeneratedScenePanel;
  active: boolean;
  activeElements: string[];
}) {
  return (
    <div
      aria-current={active ? "step" : undefined}
      className={`border-l-2 px-3 py-3 transition-colors ${
        active ? "border-blue-500 bg-blue-50/50 shadow-sm shadow-blue-100/70" : "border-gray-100 bg-gray-50/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wider ${active ? "text-blue-600" : "text-gray-400"}`}>
            {panel.kind}
          </div>
          <h4 className="mt-0.5 text-sm font-semibold text-gray-800">{panel.title}</h4>
        </div>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500">{panel.description}</p>
      <div className="mt-3">
        {panel.kind === "matrix" ? (
          <GeneratedMatrix data={panel.data} activeElements={activeElements} active={active} />
        ) : panel.kind === "ledger" ? (
          <GeneratedLedger data={panel.data} activeElements={activeElements} active={active} />
        ) : panel.kind === "vector" || panel.kind === "bar" ? (
          <GeneratedVectors data={panel.data} activeElements={activeElements} active={active} />
        ) : panel.kind === "pipeline" || panel.kind === "flow" ? (
          <GeneratedFlow data={panel.data} activeElements={activeElements} active={active} />
        ) : panel.kind === "formula" ? (
          <GeneratedFormula data={panel.data} activeElements={activeElements} active={active} />
        ) : (
          <GeneratedCards data={panel.data} activeElements={activeElements} active={active} />
        )}
      </div>
    </div>
  );
}

function GeneratedFormula({
  data,
  activeElements,
  active,
}: {
  data: AudioGeneratedScenePanel["data"];
  activeElements: string[];
  active: boolean;
}) {
  const formula = data.find((item) => /formula|equation|expression/i.test(item.label))?.value ?? data[0]?.value ?? "";
  const terms = data.filter((item) => !/formula|equation|expression/i.test(item.label));
  const formulaHtml = useMemo(() => renderGeneratedFormula(String(formula), activeElements), [formula, activeElements]);
  return (
    <div className="space-y-3">
      <div className="max-w-full overflow-hidden rounded bg-white px-3 py-4 text-gray-800">
        {formulaHtml ? (
          <div
            className="max-w-full overflow-x-auto text-sm sm:text-base [&_.katex-display]:my-0 [&_.katex]:whitespace-normal"
            aria-label={`Formula: ${formula}`}
            dangerouslySetInnerHTML={{ __html: formulaHtml }}
          />
        ) : (
          <code className="block whitespace-pre-wrap break-all font-mono text-sm leading-7">
            {formula}
          </code>
        )}
      </div>
      {terms.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {terms.map((item) => {
            const highlighted = active && isActiveGeneratedElement(item.label, activeElements);
            return (
              <div
                key={item.label}
                className={`border-l-2 bg-white px-3 py-2 ${
                  highlighted ? "border-blue-500 text-blue-900" : "border-gray-100 text-gray-700"
                }`}
              >
                <div className="text-xs font-semibold">{item.label}</div>
                <div className="mt-1 text-xs leading-5 text-gray-500">{item.value}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderGeneratedFormula(formula: string, activeElements: string[]) {
  if (!formula.trim()) return "";
  try {
    return katex.renderToString(highlightLatexTerms(formula.trim(), activeElements), {
      displayMode: true,
      throwOnError: false,
      strict: "warn",
      trust: false,
      output: "html",
    });
  } catch {
    return "";
  }
}

function highlightLatexTerms(formula: string, activeElements: string[]) {
  let out = formula;
  const replacements = activeElements
    .flatMap((item) => latexTargetsForActiveElement(item))
    .filter((item, index, all) => item && all.indexOf(item) === index)
    .sort((a, b) => b.length - a.length);

  for (const target of replacements) {
    out = out.replace(new RegExp(escapeRegExp(target), "g"), `\\colorbox{#dbeafe}{${target}}`);
  }
  return out;
}

function latexTargetsForActiveElement(label: string) {
  const normalized = label.trim();
  const lower = normalized.toLowerCase();
  const isOperator = lower === "layernorm" || lower === "attention" || lower === "mlp" || lower === "softmax";
  const targets = isOperator ? [] : [normalized];
  const subMatch = lower.match(/^([a-z]) sub (.+)$/);
  if (subMatch) {
    const base = subMatch[1].toUpperCase() === normalized[0] ? normalized[0] : subMatch[1];
    const sub = subMatch[2].replace(/\s+/g, "-");
    targets.push(`${base}_{\\text{${sub}}}`, `${base}_{${sub}}`, `${base}_${sub}`);
  }
  if (isOperator) {
    targets.push(`\\operatorname{${normalized}}`, `\\mathrm{${normalized}}`);
  }
  return targets;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isActiveGeneratedElement(label: string, activeElements: string[]) {
  const normalized = label.toLowerCase();
  return activeElements.some((item) => normalized.includes(item.toLowerCase()));
}

function GeneratedMatrix({
  data,
  activeElements,
  active,
}: {
  data: AudioGeneratedScenePanel["data"];
  activeElements: string[];
  active: boolean;
}) {
  return (
    <div className="space-y-2">
      {data.map((row) => {
        const highlighted = active && isActiveGeneratedElement(row.label, activeElements);
        const values = row.values && row.values.length > 0 ? row.values : [35, 65, 48];
        return (
          <div key={row.label} className={`grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 rounded bg-white px-2 py-2 ${highlighted ? "ring-1 ring-blue-300" : ""}`}>
            <div className="text-xs font-semibold text-gray-600">{row.label}</div>
            <div className="flex gap-1">
              {values.map((value, index) => (
                <div key={index} className="h-6 flex-1 rounded bg-gray-100">
                  <div
                    className={`h-6 rounded ${highlighted || active ? "bg-blue-500" : "bg-gray-200"}`}
                    style={{ width: `${Math.max(6, Math.min(100, value))}%`, opacity: highlighted ? 1 : active ? 0.65 : 0.35 }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GeneratedLedger({
  data,
  activeElements,
  active,
}: {
  data: AudioGeneratedScenePanel["data"];
  activeElements: string[];
  active: boolean;
}) {
  return (
    <div className="space-y-2">
      {data.map((item, index) => {
        const highlighted = active && (activeElements.length === 0 ? index === 0 : isActiveGeneratedElement(item.label, activeElements));
        const width = Math.max(12, Math.min(100, Number(item.value?.replace(/[^0-9.]/g, "")) || 30 + index * 15));
        return (
          <div key={item.label} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2 rounded bg-white px-2 py-2">
            <span className="text-xs font-semibold text-gray-600">{item.label}</span>
            <div className="h-3 rounded bg-gray-100">
              <div className={`h-3 rounded ${highlighted ? "bg-green-500" : active ? "bg-green-300" : "bg-gray-200"}`} style={{ width: `${width}%` }} />
            </div>
            <span className="text-right text-[11px] text-gray-400">{item.value ?? ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function GeneratedVectors({
  data,
  activeElements,
  active,
}: {
  data: AudioGeneratedScenePanel["data"];
  activeElements: string[];
  active: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {data.map((item) => {
        const highlighted = active && isActiveGeneratedElement(item.label, activeElements);
        const values = item.values && item.values.length > 0 ? item.values : [45, 72, 28, 60];
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        return (
          <div key={item.label} className={`rounded bg-white px-2 py-2 text-center ${highlighted ? "ring-1 ring-purple-300" : ""}`}>
            <div className="text-xs font-semibold text-gray-600">{item.label}</div>
            <div className="mt-2 flex h-16 items-end gap-1">
              {values.map((value, index) => (
                <div key={index} className={`flex-1 rounded-t ${active ? "bg-purple-500" : "bg-gray-200"}`} style={{ height: `${Math.max(8, Math.min(100, value))}%`, opacity: highlighted ? 1 : 0.55 }} />
              ))}
            </div>
            <div className="mt-1 text-[11px] text-gray-400">{item.value ?? Math.round(avg)}</div>
          </div>
        );
      })}
    </div>
  );
}

function GeneratedFlow({
  data,
  activeElements,
  active,
}: {
  data: AudioGeneratedScenePanel["data"];
  activeElements: string[];
  active: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {data.map((item, index) => {
        const highlighted = active && (activeElements.length === 0 ? index === 0 : isActiveGeneratedElement(item.label, activeElements));
        return (
          <div key={item.label} className={`border-l-2 bg-white px-2 py-2 ${highlighted ? "border-blue-500 text-blue-900" : "border-gray-100 text-gray-700"}`}>
            <div className="text-xs font-semibold">{item.label}</div>
            <div className="mt-1 text-xs leading-5 text-gray-500">{item.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function GeneratedCards({
  data,
  activeElements,
  active,
}: {
  data: AudioGeneratedScenePanel["data"];
  activeElements: string[];
  active: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {data.map((item) => {
        const highlighted = active && isActiveGeneratedElement(item.label, activeElements);
        return (
          <div key={item.label} className={`rounded bg-white px-3 py-2 ${highlighted ? "ring-1 ring-blue-300" : ""}`}>
            <div className="text-xs font-semibold text-gray-700">{item.label}</div>
            <div className="mt-1 text-xs leading-5 text-gray-500">{item.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function QkvAttentionScene({ cue, currentTime }: { cue: NormalizedAudioCue; currentTime: number }) {
  const label = `${cue.label} ${cue.headline}`.toLowerCase();
  const phase = label.includes("softmax")
    ? "softmax"
    : label.includes("value") || label.includes("weighted")
      ? "values"
      : label.includes("score") || label.includes("dot")
        ? "scores"
        : label.includes("key")
          ? "keys"
          : "queries";
  const tokens = ["the", "cat", "sat", "mat"];
  const scoreRows = [
    [86, 28, 18, 12],
    [24, 78, 46, 52],
    [20, 42, 82, 35],
    [16, 58, 45, 74],
  ];
  const activeRow = Math.floor(currentTime / 8) % tokens.length;
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Q/K/V attention score scene
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1fr_0.72fr]">
        <SceneStage active={phase === "queries"} label="Query: what this row asks for">
          <VectorColumn tokens={tokens} activeIndex={activeRow} suffix="Q" tone="blue" />
        </SceneStage>
        <SceneStage active={phase === "keys" || phase === "scores" || phase === "softmax"} label="QK^T score matrix">
          <div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] gap-1 text-center text-[11px]">
            <div />
            {tokens.map((token) => <div key={token} className="font-semibold text-gray-400">K:{token}</div>)}
            {scoreRows.map((row, rowIndex) => (
              <FragmentRow key={tokens[rowIndex]} label={`Q:${tokens[rowIndex]}`} values={row} active={phase === "scores" || phase === "softmax"} />
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            The active row asks: for this token&apos;s Query, which Key columns line up most strongly?
          </p>
        </SceneStage>
        <SceneStage active={phase === "values"} label="Values: content being mixed">
          <VectorColumn tokens={tokens} activeIndex={activeRow} suffix="V" tone="green" />
          <div className="mt-3 rounded bg-white px-3 py-2 text-xs leading-5 text-gray-600">
            Softmax decides how much. Value rows provide what content gets blended.
          </div>
        </SceneStage>
      </div>
    </div>
  );
}

function ResidualStreamScene({ cue, currentTime }: { cue: NormalizedAudioCue; currentTime: number }) {
  const steps = [
    { label: "Embedding row", amount: 34 },
    { label: "Attention delta", amount: 24 },
    { label: "MLP delta", amount: 18 },
    { label: "Next block delta", amount: 12 },
  ];
  const active = Math.min(steps.length - 1, Math.floor(currentTime / 10) % steps.length);
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Residual stream ledger
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <SceneStage active label="Running representation">
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={step.label} className={`grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-2 rounded bg-white px-2 py-2 ${index <= active ? "opacity-100" : "opacity-45"}`}>
                <div className="text-xs font-semibold text-gray-600">{index === 0 ? step.label : `+ ${step.label}`}</div>
                <div className="h-3 rounded bg-gray-100">
                  <div className={`h-3 rounded ${index <= active ? "bg-green-500" : "bg-gray-200"}`} style={{ width: `${step.amount + index * 12}%` }} />
                </div>
                <div className="text-right text-xs text-gray-400">{step.amount}</div>
              </div>
            ))}
          </div>
        </SceneStage>
        <SceneStage active={/norm|residual|add/i.test(`${cue.label} ${cue.headline}`)} label="Add, then stabilize">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-xs">
            <MiniBox label="old stream" active tone="green" />
            <span className="font-semibold text-green-600">+</span>
            <MiniBox label="new delta" active tone="blue" />
            <span className="font-semibold text-blue-600">→</span>
            <MiniBox label="updated stream" active tone="green" />
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            A residual stream behaves like a running ledger. Blocks add useful deltas instead of replacing the whole representation.
          </p>
        </SceneStage>
      </div>
    </div>
  );
}

function MlpExpansionScene({ cue }: { cue: NormalizedAudioCue; currentTime: number }) {
  const phase = /gelu|gate/i.test(`${cue.label} ${cue.headline}`)
    ? "gate"
    : /compress|output|back/i.test(`${cue.label} ${cue.headline}`)
      ? "compress"
      : /expand|4d|w1/i.test(`${cue.label} ${cue.headline}`)
        ? "expand"
        : "input";
  const bars = [42, 78, 28, 64, 36, 88, 52, 22];
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        MLP expansion and gate scene
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <SceneStage active={phase === "input"} label="One token row enters">
          <VectorBars values={[54, 24, 68, 38]} active={phase === "input"} />
          <p className="mt-2 text-xs text-gray-500">The MLP sees one token vector at a time.</p>
        </SceneStage>
        <SceneStage active={phase === "expand" || phase === "gate"} label="Expand, activate">
          <VectorBars values={bars} active={phase === "expand" || phase === "gate"} tone="purple" />
          <div className="mt-2 text-xs leading-5 text-gray-500">
            Expansion creates more feature channels. GELU gates which channels matter for this token.
          </div>
        </SceneStage>
        <SceneStage active={phase === "compress"} label="Compress back to D">
          <VectorBars values={[66, 32, 58, 74]} active={phase === "compress"} tone="green" />
          <p className="mt-2 text-xs text-gray-500">The output fits back into the residual stream row shape.</p>
        </SceneStage>
      </div>
    </div>
  );
}

function VectorColumn({ tokens, activeIndex, suffix, tone }: { tokens: string[]; activeIndex: number; suffix: string; tone: "blue" | "green" }) {
  const color = tone === "blue" ? "bg-blue-500" : "bg-green-500";
  return (
    <div className="space-y-2">
      {tokens.map((token, index) => (
        <div key={`${suffix}-${token}`} className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 rounded bg-white px-2 py-2 ${index === activeIndex ? "ring-1 ring-blue-200" : ""}`}>
          <span className="text-xs font-semibold text-gray-600">{suffix}:{token}</span>
          <div className="flex gap-1">
            {[32, 64, 46].map((base, i) => (
              <div key={i} className="h-5 flex-1 rounded bg-gray-100">
                <div className={`h-5 rounded ${color}`} style={{ width: `${Math.min(90, base + index * 8 + i * 5)}%`, opacity: index === activeIndex ? 1 : 0.35 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VectorBars({ values, active, tone = "blue" }: { values: number[]; active: boolean; tone?: "blue" | "purple" | "green" }) {
  const colors = { blue: "bg-blue-500", purple: "bg-purple-500", green: "bg-green-500" };
  return (
    <div className="flex items-end gap-1">
      {values.map((value, index) => (
        <div key={index} className="h-24 flex-1 rounded-t bg-gray-100">
          <div
            className={`mt-auto rounded-t transition-all duration-500 ${active ? colors[tone] : "bg-gray-200"}`}
            style={{ height: `${value}%`, opacity: active ? 0.9 : 0.45 }}
          />
        </div>
      ))}
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
