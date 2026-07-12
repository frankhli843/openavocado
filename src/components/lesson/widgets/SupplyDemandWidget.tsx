"use client";

/**
 * Registered widget: supply & demand market simulator.
 *
 * This is a hand-written, reviewed component in the curated registry. The
 * lesson generator supplies typed `params` (baseline curve coefficients), never
 * code. Learners shift the curves and a per-unit tax; the equilibrium, surplus,
 * and revenues recompute live and the chart redraws.
 */
import { useMemo, useState } from "react";
import type { SliderControl } from "@/lib/widgets/schema";
import { formatValue } from "@/lib/widgets/schema";
import { Slider } from "./Controls";
import { CurveChart, type CurveSeries } from "./Charts";
import type { WidgetStateChange } from "./DeclarativeWidget";

interface SupplyDemandParams {
  demandIntercept?: number; // Qd at price 0
  demandSlope?: number; // dQd/dP magnitude
  supplyIntercept?: number; // Qs at price 0
  supplySlope?: number; // dQs/dP
  priceMax?: number;
}

const SLIDERS: SliderControl[] = [
  { type: "slider", id: "demandShift", label: "Demand shift", min: -40, max: 40, step: 1, default: 0, unit: "units" },
  { type: "slider", id: "supplyShift", label: "Supply shift", min: -20, max: 40, step: 1, default: 0, unit: "units" },
  { type: "slider", id: "demandSlope", label: "Demand sensitivity", min: 0.5, max: 3, step: 0.1, default: 1.5 },
  { type: "slider", id: "tax", label: "Per-unit tax", min: 0, max: 20, step: 1, default: 0, unit: "$" },
];

export function SupplyDemandWidget({
  params,
  initialState,
  onStateChange,
}: {
  params?: SupplyDemandParams;
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const base = {
    demandIntercept: params?.demandIntercept ?? 100,
    demandSlope: params?.demandSlope ?? 1.5,
    supplyIntercept: params?.supplyIntercept ?? 0,
    supplySlope: params?.supplySlope ?? 2,
    priceMax: params?.priceMax ?? 60,
  };

  const defaults = useMemo(() => {
    const d: Record<string, number> = {};
    for (const s of SLIDERS) d[s.id] = s.default;
    return d;
  }, []);

  const [values, setValues] = useState<Record<string, number>>(() => ({ ...defaults, ...(initialState ?? {}) }));

  function update(id: string, v: number) {
    const next = { ...values, [id]: v };
    setValues(next);
    onStateChange?.({ controls: next });
  }
  function reset() {
    setValues(defaults);
    onStateChange?.({ controls: defaults });
  }

  // Live model
  const dIntercept = base.demandIntercept + values.demandShift;
  const dSlope = values.demandSlope;
  const sIntercept = base.supplyIntercept + values.supplyShift;
  const sSlope = base.supplySlope;
  const tax = values.tax;

  // Demand: Qd = dIntercept - dSlope * P
  // Supply (after tax): Qs = sIntercept + sSlope * (P - tax)
  // Equilibrium: dIntercept - dSlope*P = sIntercept + sSlope*(P - tax)
  const pStar = (dIntercept - sIntercept + sSlope * tax) / (dSlope + sSlope);
  const pClamped = Math.max(0, Math.min(pStar, base.priceMax));
  const qStar = Math.max(0, dIntercept - dSlope * pClamped);
  const revenue = pClamped * qStar;
  const taxRevenue = tax * qStar;

  const series: CurveSeries[] = useMemo(() => {
    const steps = 41;
    const demand: Array<{ x: number; y: number }> = [];
    const supply: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < steps; i++) {
      const p = (base.priceMax * i) / (steps - 1);
      demand.push({ x: p, y: Math.max(0, dIntercept - dSlope * p) });
      supply.push({ x: p, y: Math.max(0, sIntercept + sSlope * (p - tax)) });
    }
    return [
      { label: "Demand", color: "#2563eb", points: demand },
      { label: "Supply", color: "#16a34a", points: supply },
    ];
  }, [dIntercept, dSlope, sIntercept, sSlope, tax, base.priceMax]);

  const outputs = [
    { label: "Equilibrium price", value: pClamped, format: "currency" as const },
    { label: "Equilibrium quantity", value: qStar, format: "number" as const, precision: 1 },
    { label: "Market revenue", value: revenue, format: "currency" as const, precision: 0 },
    { label: "Tax revenue", value: taxRevenue, format: "currency" as const, precision: 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {SLIDERS.map((s) => (
          <div key={s.id} className="min-w-0">
            <Slider control={s} value={values[s.id]} onChange={(v) => update(s.id, v)} />
          </div>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {outputs.map((o) => (
          <div key={o.label} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 min-w-0">
            <div className="text-[11px] font-medium text-gray-500 truncate">{o.label}</div>
            <div className="text-lg font-semibold tabular-nums text-gray-900">
              {formatValue(o.value, o.format, o.precision)}
            </div>
          </div>
        ))}
      </div>

      <figure className="m-0">
        <figcaption className="text-xs font-medium text-gray-500 mb-1">Market curves (price vs quantity)</figcaption>
        <CurveChart
          series={series}
          marker={{ x: pClamped, y: qStar, label: "Equilibrium" }}
          xLabel="Price ($)"
          yLabel="Quantity"
        />
      </figure>

      <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-4 py-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          At the current settings the market clears at a price of{" "}
          <strong>{formatValue(pClamped, "currency")}</strong> with{" "}
          <strong>{formatValue(qStar, "number", 1)}</strong> units traded.
          {tax > 0 ? (
            <> The {formatValue(tax, "currency")} per-unit tax shifts supply up, raising price and lowering quantity, and collects <strong>{formatValue(taxRevenue, "currency", 0)}</strong> in tax revenue.</>
          ) : (
            <> Add a per-unit tax or shift either curve to see how the equilibrium moves.</>
          )}
        </p>
      </div>

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
