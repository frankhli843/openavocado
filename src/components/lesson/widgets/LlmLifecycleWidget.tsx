"use client";

/**
 * Registered widget: LLM lifecycle.
 *
 * Purpose-built for the "raw text to running model" lesson family. The lesson
 * author selects a focus, while the learner manipulates model size,
 * quantization, tokenization, and stage selection inside a reviewed component.
 */
import { useMemo, useState } from "react";
import type { SliderControl } from "@/lib/widgets/schema";
import { formatValue } from "@/lib/widgets/schema";
import { Slider } from "./Controls";
import type { WidgetStateChange } from "./DeclarativeWidget";

type Focus = "roadmap" | "storage" | "tokenization";

interface LlmLifecycleParams {
  focus?: Focus;
}

const STAGES = [
  { key: "plan", letter: "P", label: "Plan", contract: "Pick task, scale, data, and eval target.", failure: "Training optimizes a vague goal." },
  { key: "organize", letter: "O", label: "Organize", contract: "Clean, dedupe, license, and mix the corpus.", failure: "Garbage or leakage gets memorized." },
  { key: "tokenize", letter: "T", label: "Tokenize", contract: "Turn text into stable integer ids.", failure: "The model cannot read the same units at train and serve time." },
  { key: "train", letter: "T", label: "Train", contract: "Fit weights to predict the next token.", failure: "Loss does not map to useful behavior." },
  { key: "evaluate", letter: "E", label: "Evaluate", contract: "Measure capability, safety, and regressions.", failure: "A broken checkpoint looks impressive." },
  { key: "reduce", letter: "R", label: "Reduce", contract: "Quantize or distill for the target hardware.", failure: "The model cannot fit or runs too slowly." },
  { key: "serve", letter: "S", label: "Serve", contract: "Package tokenizer, weights, prompt, cache, and runtime.", failure: "The demo works locally but fails in production." },
] as const;

const defaultStage = 2;

const sliders: Record<string, SliderControl> = {
  modelB: { type: "slider", id: "modelB", label: "Model size", min: 1, max: 70, step: 1, default: 26, unit: "B params", format: "integer" },
  bits: { type: "slider", id: "bits", label: "Weight precision", min: 4, max: 32, step: 4, default: 4, unit: "bits", format: "integer" },
  vocab: { type: "slider", id: "vocab", label: "Vocabulary size", min: 8000, max: 262000, step: 2000, default: 32000, format: "integer" },
  textChars: { type: "slider", id: "textChars", label: "Input length", min: 80, max: 5000, step: 80, default: 640, unit: "chars", format: "integer" },
};

export function LlmLifecycleWidget({
  params,
  initialState,
  onStateChange,
}: {
  params?: LlmLifecycleParams;
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const focus = params?.focus ?? "roadmap";
  const defaults = useMemo(
    () => ({
      stage: defaultStage,
      modelB: sliders.modelB.default,
      bits: sliders.bits.default,
      vocab: sliders.vocab.default,
      textChars: sliders.textChars.default,
    }),
    []
  );
  const [values, setValues] = useState<Record<string, number>>(() => ({ ...defaults, ...(initialState ?? {}) }));

  function update(id: string, value: number) {
    const next = { ...values, [id]: value };
    setValues(next);
    onStateChange?.({ controls: next });
  }

  function reset() {
    setValues(defaults);
    onStateChange?.({ controls: defaults });
  }

  return (
    <div className="min-w-0 space-y-5">
      {focus === "roadmap" && <RoadmapView values={values} update={update} />}
      {focus === "storage" && <StorageView values={values} update={update} />}
      {focus === "tokenization" && <TokenizationView values={values} update={update} />}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded px-1"
        >
          Reset to lesson defaults
        </button>
      </div>
    </div>
  );
}

type ViewProps = {
  values: Record<string, number>;
  update: (id: string, value: number) => void;
};

function RoadmapView({ values, update }: ViewProps) {
  const index = clampInt(values.stage, 0, STAGES.length - 1);
  const stage = STAGES[index];
  return (
    <div className="min-w-0 space-y-4">
      <div className="min-w-0 rounded-lg border border-gray-100 bg-white p-2.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-gray-700">Lifecycle stage</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">POTTERS</div>
        </div>
        <div className="min-w-0 overflow-x-auto pb-0.5" role="radiogroup" aria-label="Lifecycle stage">
          <div className="grid min-w-max grid-cols-7 gap-1">
            {STAGES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={i === index}
                aria-label={`${s.letter}: ${s.label}`}
                onClick={() => update("stage", i)}
                className={`h-16 w-[4.25rem] rounded-md border px-1.5 py-1.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                  i === index ? "border-blue-300 bg-blue-50" : i < index ? "border-emerald-200 bg-emerald-50/60" : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                  i === index ? "bg-blue-600 text-white" : "bg-white text-gray-700"
                }`}>
                  {s.letter}
                </div>
                <div className="mt-1 text-[11px] font-semibold leading-tight text-gray-700">{s.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <InsightCard title={`${stage.letter}: ${stage.label} contract`} body={stage.contract} tone="blue" />
        <InsightCard title="What breaks if skipped" body={stage.failure} tone="amber" />
      </div>
      <p className="break-words text-sm leading-relaxed text-gray-700">
        POTTERS is the map: Plan, Organize data, Tokenize, Train, Evaluate, Reduce, Serve. Every stage changes the
        artifact handed to the next stage. The visualization is a contract chain, not a score chart.
      </p>
    </div>
  );
}

function StorageView({ values, update }: ViewProps) {
  const storageGb = (values.modelB * 1_000_000_000 * values.bits) / 8 / 1_000_000_000;
  const gpuGb = 24;
  const used = Math.min(storageGb / gpuGb, 1);
  const blocks = 12;
  const filled = Math.ceil(used * blocks);
  const fits = storageGb <= gpuGb;
  return (
    <div className="min-w-0 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider control={sliders.modelB} value={values.modelB} onChange={(v) => update("modelB", v)} />
        <Slider control={sliders.bits} value={values.bits} onChange={(v) => update("bits", v)} />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400">RTX 3090 memory shelf</div>
            <div className="text-sm text-gray-600">Weights only, before KV cache and runtime overhead.</div>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${fits ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
            {fits ? "fits weights" : "does not fit"}
          </div>
        </div>
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: blocks }).map((_, i) => (
            <div
              key={i}
              className={`h-12 rounded ${i < filled ? (fits ? "bg-blue-500" : "bg-red-500") : "bg-gray-100"}`}
              title={`Memory block ${i + 1}`}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberTile label="Weight storage" value={`${formatValue(storageGb, "number", 1)} GB`} />
        <NumberTile label="GPU budget" value={`${gpuGb} GB`} />
        <NumberTile label="Remaining" value={`${formatValue(gpuGb - storageGb, "number", 1)} GB`} danger={!fits} />
      </div>
      <InsightCard
        title="Reduction is a deployment contract"
        body="Quantization is not decoration. It changes whether a checkpoint can physically fit on the hardware that will serve it."
        tone="blue"
      />
    </div>
  );
}

function TokenizationView({ values, update }: ViewProps) {
  const vocabFactor = Math.max(0.55, Math.min(1.6, 32000 / values.vocab));
  const estimatedTokens = Math.max(1, Math.round((values.textChars / 4) * vocabFactor));
  const unknownRisk = Math.max(0, Math.min(1, (24000 - values.vocab) / 24000));
  const sample =
    values.vocab < 20000
      ? ["model", "-", "run", "time", "?", "UNK", "UNK"]
      : values.vocab < 80000
        ? ["model", "runtime", "serves", "tokens"]
        : ["multimodal", "runtime", "serves", "tokens"];
  return (
    <div className="min-w-0 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider control={sliders.vocab} value={values.vocab} onChange={(v) => update("vocab", v)} />
        <Slider control={sliders.textChars} value={values.textChars} onChange={(v) => update("textChars", v)} />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="mb-3 text-xs font-semibold uppercase text-gray-400">Token boundary preview</div>
        <div className="flex flex-wrap gap-2">
          {sample.map((token, i) => (
            <span key={`${token}-${i}`} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              token === "UNK" ? "border-red-200 bg-red-50 text-red-700" : "border-blue-100 bg-blue-50 text-blue-800"
            }`}>
              {token}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberTile label="Estimated tokens" value={formatValue(estimatedTokens, "integer")} />
        <NumberTile label="Unknown-token risk" value={formatValue(unknownRisk, "percent", 0)} danger={unknownRisk > 0.3} />
        <NumberTile label="Chars per token" value={formatValue(values.textChars / estimatedTokens, "number", 1)} />
      </div>
      <InsightCard
        title="The tokenizer is the first model contract"
        body="The model never sees raw strings. If training and serving disagree on token boundaries or vocabulary, the same sentence becomes a different integer sequence."
        tone="blue"
      />
    </div>
  );
}

function NumberTile({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`min-w-0 rounded-lg border px-3 py-3 ${danger ? "border-red-100 bg-red-50" : "border-gray-100 bg-gray-50/70"}`}>
      <div className={`text-[11px] font-medium ${danger ? "text-red-500" : "text-gray-500"}`}>{label}</div>
      <div className={`mt-1 break-words text-xl font-semibold tabular-nums ${danger ? "text-red-800" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

function InsightCard({ title, body, tone }: { title: string; body: string; tone: "blue" | "amber" }) {
  const cls = tone === "blue" ? "border-blue-100 bg-blue-50/70 text-blue-900" : "border-amber-100 bg-amber-50/70 text-amber-900";
  return (
    <div className={`min-w-0 rounded-xl border px-4 py-3 ${cls}`}>
      <div className="break-words text-sm font-semibold">{title}</div>
      <p className="mt-1 break-words text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
