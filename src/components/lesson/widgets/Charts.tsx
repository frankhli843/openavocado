"use client";

/**
 * Lightweight, dependency-free SVG charts for interactive widgets.
 * Responsive via viewBox (no fixed pixel width), so they fit a 390px viewport
 * without page-level horizontal scrolling.
 */
import { formatValue, type OutputFormat } from "@/lib/widgets/schema";

const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  format?: OutputFormat;
  precision?: number;
}

export function BarChart({ data, max }: { data: BarDatum[]; max?: number }) {
  const W = 320;
  const H = 180;
  const padL = 8;
  const padR = 8;
  const padTop = 18;
  const padBottom = 26;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBottom;
  const autoMax = Math.max(...data.map((d) => Math.abs(d.value)), 0.0001);
  const scaleMax = max ?? autoMax * 1.15;
  const slot = plotW / data.length;
  const barW = Math.min(slot * 0.6, 64);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Bar chart of widget outputs">
      {/* baseline */}
      <line x1={padL} y1={padTop + plotH} x2={W - padR} y2={padTop + plotH} stroke="#e5e7eb" strokeWidth={1} />
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / scaleMax) * plotH;
        const x = padL + slot * i + (slot - barW) / 2;
        const y = padTop + plotH - h;
        const color = d.color ?? PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 0)} rx={3} fill={color}>
              <title>{`${d.label}: ${formatValue(d.value, d.format, d.precision)}`}</title>
            </rect>
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="#374151">
              {formatValue(d.value, d.format, d.precision)}
            </text>
            <text x={x + barW / 2} y={padTop + plotH + 16} textAnchor="middle" fontSize={11} fill="#6b7280">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface CurveSeries {
  label: string;
  points: Array<{ x: number; y: number }>;
  color?: string;
}

export function CurveChart({
  series,
  marker,
  xLabel,
  yLabel,
}: {
  series: CurveSeries[];
  marker?: { x: number; y: number; label?: string };
  xLabel?: string;
  yLabel?: string;
}) {
  const W = 320;
  const H = 220;
  const padL = 34;
  const padR = 10;
  const padTop = 12;
  const padBottom = 30;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBottom;

  const allPts = series.flatMap((s) => s.points);
  const xs = allPts.map((p) => p.x);
  const ys = allPts.map((p) => p.y);
  if (marker) {
    xs.push(marker.x);
    ys.push(marker.y);
  }
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(...ys, 0.0001);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const sx = (x: number) => padL + ((x - xMin) / xRange) * plotW;
  const sy = (y: number) => padTop + plotH - ((y - yMin) / yRange) * plotH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Line chart">
        {/* axes */}
        <line x1={padL} y1={padTop} x2={padL} y2={padTop + plotH} stroke="#e5e7eb" strokeWidth={1} />
        <line x1={padL} y1={padTop + plotH} x2={W - padR} y2={padTop + plotH} stroke="#e5e7eb" strokeWidth={1} />
        {/* y ticks */}
        {[0, 0.5, 1].map((f) => {
          const yv = yMin + yRange * f;
          return (
            <g key={f}>
              <text x={padL - 4} y={sy(yv) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
                {Math.round(yv)}
              </text>
            </g>
          );
        })}
        {/* curves */}
        {series.map((s, i) => {
          const color = s.color ?? PALETTE[i % PALETTE.length];
          const d = s.points
            .map((p, j) => `${j === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
            .join(" ");
          return <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />;
        })}
        {/* marker */}
        {marker && (
          <g>
            <circle cx={sx(marker.x)} cy={sy(marker.y)} r={4} fill="#111827" />
            <line x1={sx(marker.x)} y1={padTop} x2={sx(marker.x)} y2={padTop + plotH} stroke="#9ca3af" strokeDasharray="3 3" strokeWidth={1} />
          </g>
        )}
        {xLabel && (
          <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#6b7280">
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text x={10} y={padTop + plotH / 2} textAnchor="middle" fontSize={10} fill="#6b7280" transform={`rotate(-90 10 ${padTop + plotH / 2})`}>
            {yLabel}
          </text>
        )}
      </svg>
      {/* legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
        {series.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-1.5 rounded-full" style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
            {s.label}
          </span>
        ))}
        {marker?.label && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full bg-gray-900" />
            {marker.label}
          </span>
        )}
      </div>
    </div>
  );
}
