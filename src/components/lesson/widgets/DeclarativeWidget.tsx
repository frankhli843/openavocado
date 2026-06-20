"use client";

/**
 * Generic, data-driven interactive widget.
 *
 * Renders controls -> computes derived outputs through the sandboxed expression
 * evaluator -> shows live outputs, explanatory panels, and an optional chart.
 * No code is executed; everything is computed from the typed spec.
 */
import { useMemo, useState } from "react";
import type { DeclarativeWidgetSpec } from "@/lib/widgets/schema";
import { initialControlValues } from "@/lib/widgets/schema";
import { computeOutputs, renderTemplate, sampleCurve } from "@/lib/widgets/compute";
import { evaluate } from "@/lib/widgets/expression";
import { Slider, Toggle, Segmented } from "./Controls";
import { BarChart, CurveChart, type BarDatum, type CurveSeries } from "./Charts";

export interface WidgetStateChange {
  controls: Record<string, number>;
}

export function DeclarativeWidget({
  spec,
  initialState,
  onStateChange,
}: {
  spec: DeclarativeWidgetSpec;
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const defaults = useMemo(() => initialControlValues(spec.controls), [spec.controls]);
  const [values, setValues] = useState<Record<string, number>>(() => ({
    ...defaults,
    ...(initialState ?? {}),
  }));

  function update(id: string, v: number) {
    const next = { ...values, [id]: v };
    setValues(next);
    onStateChange?.({ controls: next });
  }

  function reset() {
    setValues(defaults);
    onStateChange?.({ controls: defaults });
  }

  const { outputs, scope } = useMemo(
    () => computeOutputs(spec.outputs, values),
    [spec.outputs, values]
  );

  const formatMap = useMemo(() => buildFormatMap(spec), [spec]);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        {spec.controls.map((c) => (
          <div key={c.id} className="min-w-0">
            {c.type === "slider" && <Slider control={c} value={values[c.id]} onChange={(v) => update(c.id, v)} />}
            {c.type === "toggle" && <Toggle control={c} value={values[c.id]} onChange={(v) => update(c.id, v)} />}
            {c.type === "segmented" && <Segmented control={c} value={values[c.id]} onChange={(v) => update(c.id, v)} />}
          </div>
        ))}
      </div>

      {/* Outputs */}
      {outputs.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {outputs.map((o) => (
            <div
              key={o.id}
              className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 min-w-0"
              title={o.description}
            >
              <div className="text-[11px] font-medium text-gray-500 truncate">{o.label}</div>
              <div className={`text-lg font-semibold tabular-nums ${o.error ? "text-red-500" : "text-gray-900"}`}>
                {o.error ? "—" : o.display}
                {!o.error && o.unit ? <span className="text-xs font-normal text-gray-400 ml-1">{o.unit}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {spec.chart && <ChartView spec={spec} scope={scope} />}

      {/* Explanatory panels */}
      {spec.panels?.map((p, i) => (
        <div key={i} className="rounded-lg bg-blue-50/60 border border-blue-100 px-4 py-3">
          {p.title && <div className="text-xs font-semibold text-blue-700 mb-1">{p.title}</div>}
          <p className="text-sm text-gray-700 leading-relaxed">{renderTemplate(p.template, scope, formatMap)}</p>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded px-1"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

type FormatInfo = { format?: import("@/lib/widgets/schema").OutputFormat; precision?: number };

function buildFormatMap(spec: DeclarativeWidgetSpec): Record<string, FormatInfo> {
  const m: Record<string, FormatInfo> = {};
  for (const c of spec.controls) {
    if (c.type === "slider" && c.format) m[c.id] = { format: c.format };
  }
  for (const o of spec.outputs) m[o.id] = { format: o.format, precision: o.precision };
  return m;
}

function ChartView({ spec, scope }: { spec: DeclarativeWidgetSpec; scope: Record<string, number> }) {
  const chart = spec.chart!;
  if (chart.type === "bar") {
    const formatMap = buildFormatMap(spec);
    const data: BarDatum[] = chart.bars.map((b) => ({
      label: b.label,
      value: scope[b.ref] ?? 0,
      color: b.color,
      format: formatMap[b.ref]?.format,
      precision: formatMap[b.ref]?.precision,
    }));
    return (
      <figure className="m-0">
        {chart.title && <figcaption className="text-xs font-medium text-gray-500 mb-1">{chart.title}</figcaption>}
        <BarChart data={data} max={chart.max} />
      </figure>
    );
  }

  // curve
  const steps = chart.x.steps ?? 40;
  let series: CurveSeries[];
  try {
    series = chart.curves.map((c) => ({
      label: c.label,
      color: c.color,
      points: sampleCurve(c.formula, chart.x.id, chart.x.min, chart.x.max, steps, scope),
    }));
  } catch {
    return <div className="text-xs text-red-500">Chart formula error.</div>;
  }
  let marker: { x: number; y: number; label?: string } | undefined;
  if (chart.marker) {
    try {
      marker = {
        x: evaluate(chart.marker.xFormula, scope),
        y: evaluate(chart.marker.yFormula, scope),
        label: chart.marker.label,
      };
    } catch {
      marker = undefined;
    }
  }
  return (
    <figure className="m-0">
      {chart.title && <figcaption className="text-xs font-medium text-gray-500 mb-1">{chart.title}</figcaption>}
      <CurveChart series={series} marker={marker} xLabel={chart.x.label} yLabel={chart.yLabel} />
    </figure>
  );
}
