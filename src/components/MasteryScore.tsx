"use client";

import type { SubjectMastery } from "@/types";

const TREND_META: Record<SubjectMastery["trend"], { glyph: string; cls: string; label: string }> = {
  up: { glyph: "↗", cls: "text-green-600", label: "trending up" },
  down: { glyph: "↘", cls: "text-orange-500", label: "trending down" },
  flat: { glyph: "→", cls: "text-gray-400", label: "steady" },
  unknown: { glyph: "", cls: "text-gray-300", label: "" },
};

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 55) return "#2563eb";
  if (score >= 30) return "#d97706";
  return "#dc2626";
}

/** A tiny inline sparkline of mastery history (oldest → newest). */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 56;
  const H = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Compact mastery badge for subject cards: score + trend + sparkline. */
export function MasteryScore({ mastery }: { mastery?: SubjectMastery }) {
  if (!mastery || mastery.score === null) {
    return <span className="text-xs text-gray-400">No mastery data yet</span>;
  }
  const color = scoreColor(mastery.score);
  const trend = TREND_META[mastery.trend];
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>
        {mastery.score}%
      </span>
      <span className="text-[11px] text-gray-400 uppercase tracking-wide">mastery</span>
      {trend.glyph && (
        <span className={`text-xs font-medium ${trend.cls}`} title={trend.label}>
          {trend.glyph}
          {mastery.delta !== null && mastery.delta !== 0 ? ` ${Math.abs(mastery.delta)}` : ""}
        </span>
      )}
      <Sparkline values={mastery.history} color={color} />
    </div>
  );
}

export { scoreColor };
