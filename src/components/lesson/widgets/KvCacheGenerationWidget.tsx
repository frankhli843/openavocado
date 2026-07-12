"use client";

/**
 * Registered widget: token generation and KV cache mechanics.
 *
 * Purpose-built for the KV-cache lesson family. It visualizes the generation
 * loop, cache memory, and context serving pressure without relying on generic
 * bar charts.
 */
import { useMemo, useState } from "react";
import type { SegmentedControl, SliderControl } from "@/lib/widgets/schema";
import { formatValue } from "@/lib/widgets/schema";
import { Segmented, Slider } from "./Controls";
import type { WidgetStateChange } from "./DeclarativeWidget";

type Focus = "loop" | "cache" | "context";

interface KvCacheGenerationParams {
  focus?: Focus;
}

const focusControl: SegmentedControl = {
  type: "segmented",
  id: "step",
  label: "Generation step",
  default: 1,
  options: [
    { label: "Prefill", value: 0 },
    { label: "Attend", value: 1 },
    { label: "Decode", value: 2 },
    { label: "Repeat", value: 3 },
  ],
};

const contextOptions: SegmentedControl = {
  type: "segmented",
  id: "maxCtx",
  label: "Context window",
  default: 8192,
  options: [
    { label: "4K", value: 4096 },
    { label: "8K", value: 8192 },
    { label: "32K", value: 32768 },
    { label: "128K", value: 131072 },
  ],
};

const precisionOptions: SegmentedControl = {
  type: "segmented",
  id: "bytes",
  label: "KV precision",
  default: 2,
  options: [
    { label: "INT8", value: 1 },
    { label: "FP16", value: 2 },
    { label: "FP32", value: 4 },
  ],
};

const sliders: Record<string, SliderControl> = {
  prompt: { type: "slider", id: "prompt", label: "Prompt tokens", min: 32, max: 8192, step: 32, default: 768, format: "integer" },
  newTokens: { type: "slider", id: "newTokens", label: "Tokens to generate", min: 1, max: 256, step: 1, default: 48, format: "integer" },
  layers: { type: "slider", id: "layers", label: "Layers", min: 2, max: 80, step: 2, default: 32, format: "integer" },
  kvDim: { type: "slider", id: "kvDim", label: "KV dimension", min: 256, max: 8192, step: 256, default: 4096, format: "integer" },
  used: { type: "slider", id: "used", label: "Tokens already in context", min: 0, max: 131072, step: 256, default: 2048, format: "integer" },
  batch: { type: "slider", id: "batch", label: "Parallel requests", min: 1, max: 16, step: 1, default: 3, format: "integer" },
};

const STEPS = [
  { label: "Prefill", detail: "Run the whole prompt once and write keys/values into cache." },
  { label: "Attend", detail: "Each new token reads cached keys/values from prior tokens." },
  { label: "Decode", detail: "The model chooses the next token and appends its KV pair." },
  { label: "Repeat", detail: "The loop continues until stop token, budget, or context limit." },
];

export function KvCacheGenerationWidget({
  params,
  initialState,
  onStateChange,
}: {
  params?: KvCacheGenerationParams;
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const focus = params?.focus ?? "loop";
  const defaults = useMemo(
    () => ({
      step: focusControl.default,
      maxCtx: contextOptions.default,
      bytes: precisionOptions.default,
      prompt: sliders.prompt.default,
      newTokens: sliders.newTokens.default,
      layers: sliders.layers.default,
      kvDim: sliders.kvDim.default,
      used: sliders.used.default,
      batch: sliders.batch.default,
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
    <div className="space-y-5">
      {focus === "loop" && <LoopView values={values} update={update} />}
      {focus === "cache" && <CacheView values={values} update={update} />}
      {focus === "context" && <ContextView values={values} update={update} />}
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

function LoopView({ values, update }: ViewProps) {
  const step = clampInt(values.step, 0, STEPS.length - 1);
  const total = values.prompt + values.newTokens;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Segmented control={focusControl} value={step} onChange={(v) => update("step", v)} />
        <Slider control={sliders.prompt} value={values.prompt} onChange={(v) => update("prompt", v)} />
        <Slider control={sliders.newTokens} value={values.newTokens} onChange={(v) => update("newTokens", v)} />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.label} className={`rounded-lg border px-3 py-3 ${i === step ? "border-blue-300 bg-blue-50" : i < step ? "border-emerald-200 bg-emerald-50" : "border-gray-100 bg-gray-50"}`}>
              <div className="text-sm font-bold text-gray-900">{s.label}</div>
              <div className="mt-1 text-xs leading-snug text-gray-600">{s.detail}</div>
            </div>
          ))}
        </div>
      </div>
      <TokenTape prompt={values.prompt} generated={values.newTokens} />
      <InsightCard
        title="PADR is the generation loop"
        body={`Prefill, Attend, Decode, Repeat. The cache grows from ${formatValue(values.prompt, "integer")} prompt tokens to ${formatValue(total, "integer")} total tokens as generation appends one token at a time.`}
      />
    </div>
  );
}

function CacheView({ values, update }: ViewProps) {
  const tokens = values.prompt + values.newTokens;
  const gb = (tokens * values.layers * 2 * values.kvDim * values.bytes) / 1_000_000_000;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Slider control={sliders.prompt} value={values.prompt} onChange={(v) => update("prompt", v)} />
        <Slider control={sliders.layers} value={values.layers} onChange={(v) => update("layers", v)} />
        <Slider control={sliders.kvDim} value={values.kvDim} onChange={(v) => update("kvDim", v)} />
        <Segmented control={precisionOptions} value={values.bytes} onChange={(v) => update("bytes", v)} />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="mb-3 text-xs font-semibold uppercase text-gray-400">KV cache shape</div>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={`h-8 rounded ${i % 5 === 0 ? "bg-blue-600" : "bg-blue-200"}`}
              style={{ opacity: 0.45 + Math.min(values.layers / 80, 1) * 0.45 }}
            />
          ))}
        </div>
        <div className="mt-3 text-sm text-gray-700">
          Think of this as <strong>layers x tokens x key/value vectors</strong>, not as attention itself.
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberTile label="Cached tokens" value={formatValue(tokens, "integer")} />
        <NumberTile label="Estimated KV memory" value={`${formatValue(gb, "number", 2)} GB`} danger={gb > 8} />
        <NumberTile label="Precision bytes" value={`${values.bytes} per value`} />
      </div>
      <InsightCard
        title="The cache stores reusable attention inputs"
        body="It stores keys and values from previous tokens so the model does not recompute the whole prompt for every new token."
      />
    </div>
  );
}

function ContextView({ values, update }: ViewProps) {
  const maxCtx = values.maxCtx;
  const used = Math.min(values.used, maxCtx);
  const remaining = Math.max(0, maxCtx - used);
  const pct = used / maxCtx;
  const perRequest = used * values.batch;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Segmented control={contextOptions} value={maxCtx} onChange={(v) => update("maxCtx", v)} />
        <Slider control={sliders.used} value={values.used} onChange={(v) => update("used", v)} />
        <Slider control={sliders.batch} value={values.batch} onChange={(v) => update("batch", v)} />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
          <span>Context window</span>
          <span>{formatValue(pct, "percent", 0)} used</span>
        </div>
        <div className="relative h-8 overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full ${pct > 0.85 ? "bg-red-500" : pct > 0.65 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">
            {formatValue(used, "integer")} / {formatValue(maxCtx, "integer")} tokens
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberTile label="Remaining room" value={formatValue(remaining, "integer")} danger={remaining < maxCtx * 0.15} />
        <NumberTile label="Parallel request tokens" value={formatValue(perRequest, "integer")} />
        <NumberTile label="Batch pressure" value={`${values.batch} requests`} />
      </div>
      <RequestLanes batch={values.batch} pct={pct} />
      <InsightCard
        title="Serving pressure is context multiplied by concurrency"
        body="Long prompts do not just consume one user's window. In a server, every active request carries its own context and cache pressure."
      />
    </div>
  );
}

function TokenTape({ prompt, generated }: { prompt: number; generated: number }) {
  const promptBlocks = Math.max(2, Math.min(10, Math.round(prompt / 512)));
  const genBlocks = Math.max(1, Math.min(8, Math.round(generated / 24)));
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-2 text-xs font-semibold uppercase text-gray-400">Token tape</div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: promptBlocks }).map((_, i) => <span key={`p-${i}`} className="h-8 w-8 rounded bg-gray-200" title="Prompt token" />)}
        {Array.from({ length: genBlocks }).map((_, i) => <span key={`g-${i}`} className="h-8 w-8 rounded bg-blue-500" title="Generated token" />)}
      </div>
      <div className="mt-2 text-xs text-gray-500">Gray tokens came from prefill. Blue tokens are appended during decode.</div>
    </div>
  );
}

function RequestLanes({ batch, pct }: { batch: number; pct: number }) {
  const lanes = Math.max(1, Math.min(8, Math.round(batch)));
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-2 text-xs font-semibold uppercase text-gray-400">Concurrent request lanes</div>
      <div className="space-y-2">
        {Array.from({ length: lanes }).map((_, i) => (
          <div key={i} className="h-4 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(pct * 100 + i * 2, 100)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NumberTile({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${danger ? "border-red-100 bg-red-50" : "border-gray-100 bg-gray-50/70"}`}>
      <div className={`text-[11px] font-medium ${danger ? "text-red-500" : "text-gray-500"}`}>{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${danger ? "text-red-800" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-blue-900">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
