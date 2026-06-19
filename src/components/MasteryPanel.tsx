"use client";

import type { MasterySignal } from "@/types";

const SIGNAL_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  strength: { label: "Strength", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  weak_spot: { label: "Weak spot", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
  misconception: { label: "Misconception", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
  review_needed: { label: "Review needed", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  ready_to_advance: { label: "Ready to advance", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
};

interface MasteryPanelProps {
  signals: MasterySignal[];
}

export function MasteryPanel({ signals }: MasteryPanelProps) {
  if (signals.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No mastery signals yet. Complete a lesson to see your strengths and gaps.
      </div>
    );
  }

  // Group by signal type
  const grouped = signals.reduce<Record<string, MasterySignal[]>>((acc, s) => {
    if (!acc[s.signal_type]) acc[s.signal_type] = [];
    acc[s.signal_type].push(s);
    return acc;
  }, {});

  const order = ["strength", "ready_to_advance", "review_needed", "weak_spot", "misconception"];

  return (
    <div className="space-y-6">
      {order.map((type) => {
        const items = grouped[type];
        if (!items || items.length === 0) return null;
        const style = SIGNAL_STYLES[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              <h3 className="text-sm font-semibold text-gray-700">{style.label}</h3>
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-start gap-3 p-3 rounded-lg ${style.bg}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium text-sm ${style.text}`}>{s.concept}</span>
                      {s.confidence !== null && (
                        <ConfidenceBar value={s.confidence} />
                      )}
                    </div>
                    {s.detail && (
                      <p className="text-xs text-gray-500 mt-0.5">{s.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-green-400" : pct >= 40 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="w-16 h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  );
}
