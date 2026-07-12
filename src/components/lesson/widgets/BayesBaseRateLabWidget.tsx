"use client";

import { useMemo, useState } from "react";
import type { SliderControl, SegmentedControl } from "@/lib/widgets/schema";
import { Slider, Segmented } from "./Controls";
import { formatValue } from "@/lib/widgets/schema";
import type { WidgetStateChange } from "./DeclarativeWidget";

type Focus = "prior" | "test" | "posterior";

const focusControl: SegmentedControl = {
  type: "segmented",
  id: "focus",
  label: "Focus",
  default: 0,
  options: [
    { label: "Prior", value: 0 },
    { label: "Test", value: 1 },
    { label: "Posterior", value: 2 },
  ],
};

const sliders: Record<string, SliderControl> = {
  prior: { type: "slider", id: "prior", label: "Disease prevalence", min: 0.001, max: 0.2, step: 0.001, default: 0.01, format: "percent" },
  sensitivity: { type: "slider", id: "sensitivity", label: "Sensitivity P(+ | sick)", min: 0.5, max: 1, step: 0.01, default: 0.95, format: "percent" },
  specificity: { type: "slider", id: "specificity", label: "Specificity P(- | healthy)", min: 0.5, max: 1, step: 0.01, default: 0.9, format: "percent" },
};

const focusByIndex: Focus[] = ["prior", "test", "posterior"];

export function BayesBaseRateLabWidget({
  params,
  initialState,
  onStateChange,
}: {
  params?: { focus?: Focus };
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const defaultFocus = Math.max(0, focusByIndex.indexOf(params?.focus ?? "prior"));
  const defaults = useMemo(
    () => ({
      focus: defaultFocus,
      prior: sliders.prior.default,
      sensitivity: sliders.sensitivity.default,
      specificity: sliders.specificity.default,
    }),
    [defaultFocus]
  );
  const [values, setValues] = useState<Record<string, number>>(() => ({ ...defaults, ...(initialState ?? {}) }));

  function update(id: string, value: number) {
    const next = { ...values, [id]: value };
    setValues(next);
    onStateChange?.({ controls: next });
  }

  const sick = 10000 * values.prior;
  const healthy = 10000 - sick;
  const truePositive = sick * values.sensitivity;
  const falseNegative = sick - truePositive;
  const falsePositive = healthy * (1 - values.specificity);
  const trueNegative = healthy - falsePositive;
  const positives = truePositive + falsePositive;
  const posterior = positives > 0 ? truePositive / positives : 0;
  const naive = values.sensitivity;
  const focus = focusByIndex[Math.max(0, Math.min(2, values.focus ?? defaultFocus))];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Segmented control={focusControl} value={values.focus} onChange={(v) => update("focus", v)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Slider control={sliders.prior} value={values.prior} onChange={(v) => update("prior", v)} />
          <Slider control={sliders.sensitivity} value={values.sensitivity} onChange={(v) => update("sensitivity", v)} />
          <Slider control={sliders.specificity} value={values.specificity} onChange={(v) => update("specificity", v)} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">10,000-person world</div>
            <div className="text-sm text-slate-600">The prior decides how many real cases exist before the test runs.</div>
          </div>
          <div className="text-right font-mono text-sm text-slate-700">
            {formatValue(sick, "integer")} sick / {formatValue(healthy, "integer")} healthy
          </div>
        </div>
        <PopulationStrip sick={sick} healthy={healthy} highlight={focus === "prior"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Test funnel</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FunnelCard
              title="Sick branch"
              tone="green"
              topLabel="Sick people"
              top={sick}
              passLabel="True positives"
              pass={truePositive}
              missLabel="False negatives"
              miss={falseNegative}
              highlight={focus === "test"}
            />
            <FunnelCard
              title="Healthy branch"
              tone="red"
              topLabel="Healthy people"
              top={healthy}
              passLabel="False positives"
              pass={falsePositive}
              missLabel="True negatives"
              miss={trueNegative}
              highlight={focus === "test"}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Positive-result pile</div>
          <PositivePile truePositive={truePositive} falsePositive={falsePositive} highlight={focus === "posterior"} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="Correct posterior" value={formatValue(posterior, "percent", 1)} />
            <Metric label="Naive answer" value={formatValue(naive, "percent", 1)} muted />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-950">
        {focus === "prior" && (
          <p className="m-0">The prior is the starting population. With only {formatValue(values.prior, "percent", 1)} prevalence, the test starts with many more healthy people than sick people.</p>
        )}
        {focus === "test" && (
          <p className="m-0">Sensitivity catches sick people. Specificity protects healthy people from false alarms. Both branches feed the final positive-result pile.</p>
        )}
        {focus === "posterior" && (
          <p className="m-0">A positive result contains {formatValue(truePositive, "integer")} true positives and {formatValue(falsePositive, "integer")} false positives, so P(sick | +) is {formatValue(posterior, "percent", 1)}, not the test sensitivity.</p>
        )}
      </div>
    </div>
  );
}

function PopulationStrip({ sick, healthy, highlight }: { sick: number; healthy: number; highlight: boolean }) {
  const sickCells = Math.max(1, Math.round((sick / 10000) * 80));
  return (
    <div
      className={`grid gap-1 rounded-lg border p-2 ${highlight ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-slate-50"}`}
      style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
    >
      {Array.from({ length: 80 }).map((_, i) => (
        <span
          key={i}
          className={`h-3 rounded-sm ${i < sickCells ? "bg-emerald-500" : "bg-slate-300"}`}
          title={i < sickCells ? "sick" : "healthy"}
        />
      ))}
      <span className="sr-only">{sick} sick people and {healthy} healthy people</span>
    </div>
  );
}

function FunnelCard({
  title,
  tone,
  topLabel,
  top,
  passLabel,
  pass,
  missLabel,
  miss,
  highlight,
}: {
  title: string;
  tone: "green" | "red";
  topLabel: string;
  top: number;
  passLabel: string;
  pass: number;
  missLabel: string;
  miss: number;
  highlight: boolean;
}) {
  const passColor = tone === "green" ? "bg-emerald-500" : "bg-rose-500";
  const passPct = top > 0 ? (pass / top) * 100 : 0;
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-slate-50"}`}>
      <div className="mb-2 text-sm font-bold text-slate-900">{title}</div>
      <div className="text-xs text-slate-500">{topLabel}: {formatValue(top, "integer")}</div>
      <div className="my-2 h-3 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${passColor}`} style={{ width: `${Math.max(2, Math.min(100, passPct))}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="rounded bg-white px-2 py-1 text-slate-700">{passLabel}: <b>{formatValue(pass, "integer")}</b></span>
        <span className="rounded bg-white px-2 py-1 text-slate-700">{missLabel}: <b>{formatValue(miss, "integer")}</b></span>
      </div>
    </div>
  );
}

function PositivePile({ truePositive, falsePositive, highlight }: { truePositive: number; falsePositive: number; highlight: boolean }) {
  const total = truePositive + falsePositive;
  const truePct = total > 0 ? (truePositive / total) * 100 : 0;
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-slate-50"}`}>
      <div className="mb-2 h-8 overflow-hidden rounded-lg bg-rose-400">
        <div className="h-full bg-emerald-500" style={{ width: `${truePct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
        <span><b className="text-emerald-700">{formatValue(truePositive, "integer")}</b> true positives</span>
        <span><b className="text-rose-700">{formatValue(falsePositive, "integer")}</b> false positives</span>
      </div>
    </div>
  );
}

function Metric({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${muted ? "border-amber-100 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-xl font-bold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}
