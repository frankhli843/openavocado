"use client";

/**
 * Registered widget: image preprocessing pipeline.
 *
 * This is a hand-written, reviewed component for the exact examples used in the
 * image-to-model-tensor lesson. The lesson generator selects a `focus` through
 * params; it does not author React or arbitrary scripts.
 */
import { useMemo, useState } from "react";
import type { SliderControl, SegmentedControl } from "@/lib/widgets/schema";
import { formatValue } from "@/lib/widgets/schema";
import { Slider, Segmented } from "./Controls";
import type { WidgetStateChange } from "./DeclarativeWidget";

type Focus = "resize" | "rescale" | "normalize" | "permute" | "batch";

interface ImagePreprocessingParams {
  focus?: Focus;
}

const TARGETS = [224, 448, 896];
const CHANNELS = [
  { label: "Red", mean: 0.485, std: 0.229, color: "#ef4444" },
  { label: "Green", mean: 0.456, std: 0.224, color: "#16a34a" },
  { label: "Blue", mean: 0.406, std: 0.225, color: "#2563eb" },
];

const sliders: Record<string, SliderControl> = {
  rawW: { type: "slider", id: "rawW", label: "Raw image width", min: 128, max: 4096, step: 128, default: 1920, unit: "px", format: "integer" },
  rawH: { type: "slider", id: "rawH", label: "Raw image height", min: 128, max: 4096, step: 128, default: 1080, unit: "px", format: "integer" },
  target: { type: "slider", id: "target", label: "Model canvas", min: 224, max: 896, step: 224, default: 224, unit: "px", format: "integer" },
  pixel: { type: "slider", id: "pixel", label: "Raw channel value", min: 0, max: 255, step: 1, default: 128, format: "integer" },
  batch: { type: "slider", id: "batch", label: "Batch size", min: 1, max: 8, step: 1, default: 1, format: "integer" },
};

const channelControl: SegmentedControl = {
  type: "segmented",
  id: "channel",
  label: "Channel",
  default: 0,
  options: CHANNELS.map((c, i) => ({ label: c.label, value: i })),
};

const layoutControl: SegmentedControl = {
  type: "segmented",
  id: "layout",
  label: "Show layout",
  default: 0,
  options: [
    { label: "HWC input", value: 0 },
    { label: "CHW model", value: 1 },
  ],
};

export function ImagePreprocessingPipelineWidget({
  params,
  initialState,
  onStateChange,
}: {
  params?: ImagePreprocessingParams;
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const focus = params?.focus ?? "resize";
  const defaults = useMemo(() => ({
    rawW: sliders.rawW.default,
    rawH: sliders.rawH.default,
    target: sliders.target.default,
    pixel: sliders.pixel.default,
    channel: channelControl.default,
    layout: layoutControl.default,
    batch: sliders.batch.default,
  }), []);
  const [values, setValues] = useState<Record<string, number>>(() => ({
    ...defaults,
    ...(initialState ?? {}),
  }));

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
      <PipelineTrail active={focus} />
      {focus === "resize" && <ResizeView values={values} update={update} />}
      {focus === "rescale" && <RescaleView values={values} update={update} />}
      {focus === "normalize" && <NormalizeView values={values} update={update} />}
      {focus === "permute" && <PermuteView values={values} update={update} />}
      {focus === "batch" && <BatchView values={values} update={update} />}
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

function PipelineTrail({ active }: { active: Focus }) {
  const steps: Array<{ id: Focus; label: string }> = [
    { id: "resize", label: "Resize" },
    { id: "rescale", label: "Rescale" },
    { id: "normalize", label: "Normalize" },
    { id: "permute", label: "Permute" },
    { id: "batch", label: "Batch" },
  ];
  return (
    <div className="flex flex-wrap gap-2" aria-label="Preprocessing pipeline steps">
      {steps.map((step) => (
        <span
          key={step.id}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            step.id === active
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {step.label}
        </span>
      ))}
    </div>
  );
}

function ResizeView({ values, update }: ViewProps) {
  const rawPixels = values.rawW * values.rawH;
  const targetPixels = values.target * values.target;
  const scale = targetPixels / rawPixels;
  const rawRatio = values.rawW / values.rawH;
  const targetRatio = 1;
  const needsCropOrPad = Math.abs(rawRatio - targetRatio) > 0.1;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider control={sliders.rawW} value={values.rawW} onChange={(v) => update("rawW", v)} />
        <Slider control={sliders.rawH} value={values.rawH} onChange={(v) => update("rawH", v)} />
        <Slider control={sliders.target} value={values.target} onChange={(v) => update("target", nearestTarget(v))} />
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-center">
        <ImageFrame
          title="Raw image"
          subtitle={`${formatValue(values.rawW, "integer")} x ${formatValue(values.rawH, "integer")} px`}
          width={values.rawW}
          height={values.rawH}
          tone="raw"
        />
        <div className="hidden md:flex justify-center text-2xl text-gray-300" aria-hidden="true">→</div>
        <ImageFrame
          title="Model canvas"
          subtitle={`${values.target} x ${values.target} px`}
          width={values.target}
          height={values.target}
          tone="target"
        />
      </div>
      <InsightCard
        title={needsCropOrPad ? "Shape mismatch is visible here" : "The image already fits the square contract"}
        body={`The target canvas has ${formatValue(targetPixels, "integer")} pixel slots versus ${formatValue(rawPixels, "integer")} raw pixels. That is ${formatValue(scale, "percent", 1)} of the raw pixel count. Resize fixes the canvas only; it does not guarantee the important object survives crop, pad, or scaling choices.`}
      />
    </div>
  );
}

function RescaleView({ values, update }: ViewProps) {
  const rescaled = values.pixel / 255;
  return (
    <div className="space-y-5">
      <Slider control={sliders.pixel} value={values.pixel} onChange={(v) => update("pixel", v)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberTile label="Raw file unit" value={String(values.pixel)} detail="uint8 value from 0 to 255" />
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-center">
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Unit conversion</div>
          <div className="mt-3 text-2xl font-bold text-blue-800">{values.pixel} / 255</div>
          <div className="mt-1 text-sm text-blue-700">cents-to-dollars step</div>
        </div>
        <NumberTile label="Model unit" value={formatValue(rescaled, "number", 4)} detail="float value from 0.0 to 1.0" />
      </div>
      <PixelStrip value={rescaled} />
      <InsightCard
        title="Why this is not optional"
        body={`If you skip /255, the next formula sees ${values.pixel} instead of ${formatValue(rescaled, "number", 4)}. That mixes byte units with 0-to-1 training statistics, so normalization becomes meaningless.`}
      />
    </div>
  );
}

function NormalizeView({ values, update }: ViewProps) {
  const channelIndex = clampInt(values.channel, 0, CHANNELS.length - 1);
  const channel = CHANNELS[channelIndex];
  const rescaled = values.pixel / 255;
  const normalized = (rescaled - channel.mean) / channel.std;
  const marker = Math.max(0, Math.min(100, ((normalized + 3) / 6) * 100));
  const status = normalized < -0.5 ? "below the training average" : normalized > 0.5 ? "above the training average" : "near the training average";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider control={sliders.pixel} value={values.pixel} onChange={(v) => update("pixel", v)} />
        <Segmented control={channelControl} value={channelIndex} onChange={(v) => update("channel", v)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberTile label="After rescale" value={formatValue(rescaled, "number", 4)} detail="pixel / 255" />
        <NumberTile label={`${channel.label} mean/std`} value={`${channel.mean} / ${channel.std}`} detail="training-set baseline" />
        <NumberTile label="Normalized value" value={formatValue(normalized, "number", 3)} detail={status} />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-4">
        <div className="flex justify-between text-xs font-medium text-gray-500 mb-2">
          <span>Far below average</span>
          <span>Training average</span>
          <span>Far above average</span>
        </div>
        <div className="relative h-4 rounded-full bg-gradient-to-r from-blue-500 via-gray-100 to-red-500">
          <span
            className="absolute top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-full bg-gray-950"
            style={{ left: `calc(${marker}% - 3px)` }}
            aria-label={`Normalized marker ${formatValue(normalized, "number", 3)}`}
          />
        </div>
        <div className="mt-3 text-sm text-gray-700">
          Formula: <strong>({formatValue(rescaled, "number", 4)} - {channel.mean}) / {channel.std}</strong> = <strong>{formatValue(normalized, "number", 3)}</strong>
        </div>
      </div>
      <InsightCard
        title="Negative values are expected"
        body="Normalization changes the question from absolute brightness to relative position against the training distribution. Values below the mean become negative; that is not a broken pixel."
      />
    </div>
  );
}

function PermuteView({ values, update }: ViewProps) {
  const layout = values.layout >= 0.5 ? 1 : 0;
  const target = values.target;
  const axes = layout === 0
    ? [{ label: "H", value: target, note: "rows" }, { label: "W", value: target, note: "columns" }, { label: "C", value: 3, note: "RGB last" }]
    : [{ label: "C", value: 3, note: "RGB first" }, { label: "H", value: target, note: "rows" }, { label: "W", value: target, note: "columns" }];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider control={sliders.target} value={target} onChange={(v) => update("target", nearestTarget(v))} />
        <Segmented control={layoutControl} value={layout} onChange={(v) => update("layout", v)} />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="grid grid-cols-3 gap-3">
          {axes.map((axis, i) => (
            <div key={axis.label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-4 text-center">
              <div className="text-xs font-semibold text-gray-400">Axis {i}</div>
              <div className="mt-1 text-3xl font-black text-gray-900">{axis.label}</div>
              <div className="mt-1 text-sm font-semibold text-blue-700">{axis.value}</div>
              <div className="mt-1 text-xs text-gray-500">{axis.note}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChannelPlane label="HWC image-library view" active={layout === 0} />
        <ChannelPlane label="CHW model view" active={layout === 1} />
      </div>
      <InsightCard
        title="Shape can look right while meaning is wrong"
        body="Permute moves semantic axes. A reshape can produce the target numbers but still scramble which values belong to red, green, and blue. The model contract is about axis meaning, not only axis count."
      />
    </div>
  );
}

function BatchView({ values, update }: ViewProps) {
  const batch = clampInt(values.batch, 1, 8);
  const target = values.target;
  const numbers = batch * 3 * target * target;
  const mb = (numbers * 4) / 1_000_000;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider control={sliders.batch} value={batch} onChange={(v) => update("batch", v)} />
        <Slider control={sliders.target} value={target} onChange={(v) => update("target", nearestTarget(v))} />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {["B", "C", "H", "W"].map((axis, i) => (
            <ShapeChip
              key={axis}
              axis={axis}
              value={[batch, 3, target, target][i]}
              label={["examples", "channels", "height", "width"][i]}
            />
          ))}
        </div>
        <div className="mt-5 min-h-24 rounded-lg bg-gray-50 border border-gray-100 p-4 overflow-hidden">
          <div className="relative h-28">
            {Array.from({ length: Math.min(batch, 8) }).map((_, i) => (
              <div
                key={i}
                className="absolute h-24 w-28 rounded-lg border border-blue-200 bg-white shadow-sm"
                style={{ left: `${i * 22}px`, top: `${i * 4}px`, zIndex: i }}
              >
                <div className="h-full rounded-lg bg-gradient-to-br from-blue-100 via-green-50 to-orange-100 p-2">
                  <div className="text-[10px] font-semibold text-gray-500">image {i + 1}</div>
                  <div className="mt-6 text-center text-xs font-bold text-blue-700">3 x {target} x {target}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <InsightCard
        title="Batch wraps examples, it does not alter the image"
        body={`The model-call tensor contains ${formatValue(numbers, "integer")} float32 numbers, about ${formatValue(mb, "number", 2)} MB before activations. Even one image still needs the outer B dimension: [1, 3, H, W].`}
      />
    </div>
  );
}

interface ViewProps {
  values: Record<string, number>;
  update: (id: string, value: number) => void;
}

function ImageFrame({
  title,
  subtitle,
  width,
  height,
  tone,
}: {
  title: string;
  subtitle: string;
  width: number;
  height: number;
  tone: "raw" | "target";
}) {
  const max = Math.max(width, height);
  const w = Math.max(36, (width / max) * 180);
  const h = Math.max(36, (height / max) * 180);
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
      <div className="flex h-52 items-center justify-center rounded-lg bg-gray-50">
        <div
          className={`rounded-md border-2 ${
            tone === "raw" ? "border-gray-400 bg-gradient-to-br from-gray-100 to-gray-200" : "border-blue-500 bg-gradient-to-br from-blue-100 to-orange-100"
          }`}
          style={{ width: `${w}px`, height: `${h}px` }}
        />
      </div>
    </div>
  );
}

function NumberTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-black text-gray-900 tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{detail}</div>
    </div>
  );
}

function PixelStrip({ value }: { value: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex justify-between text-xs font-medium text-gray-500 mb-2">
        <span>black, 0.0</span>
        <span>middle gray</span>
        <span>white, 1.0</span>
      </div>
      <div className="relative h-8 rounded-full bg-gradient-to-r from-black via-gray-400 to-white border border-gray-200">
        <span
          className="absolute top-1/2 h-11 w-2 -translate-y-1/2 rounded-full bg-blue-600 shadow"
          style={{ left: `calc(${value * 100}% - 4px)` }}
          aria-label={`Pixel marker ${formatValue(value, "number", 4)}`}
        />
      </div>
    </div>
  );
}

function ChannelPlane({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-4 ${active ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white"}`}>
      <div className={`text-sm font-semibold ${active ? "text-blue-800" : "text-gray-700"}`}>{label}</div>
      <div className="mt-3 grid grid-cols-3 gap-1">
        {["R", "G", "B"].map((c, i) => (
          <div
            key={c}
            className={`h-16 rounded-md text-center text-xs font-bold leading-[4rem] text-white ${
              ["bg-red-500", "bg-green-500", "bg-blue-500"][i]
            }`}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShapeChip({ axis, value, label }: { axis: string; value: number; label: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 min-w-20">
      <div className="text-xs font-semibold text-gray-400">{axis}</div>
      <div className="text-lg font-black text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}

function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-blue-50/70 border border-blue-100 px-4 py-3">
      <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">{title}</div>
      <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
    </div>
  );
}

function nearestTarget(value: number): number {
  return TARGETS.reduce((best, next) => (
    Math.abs(next - value) < Math.abs(best - value) ? next : best
  ), TARGETS[0]);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
