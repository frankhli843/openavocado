"use client";

import { useMemo, useState } from "react";
import type { SliderControl, ToggleControl } from "@/lib/widgets/schema";
import { Slider, Toggle } from "./Controls";
import type { WidgetStateChange } from "./DeclarativeWidget";

const vocab = ["the", "model", "learns", "tokens", "because", "data", ".", "cat", "runs", "slowly"];
const sequence = ["the", "tokenizer", "turns", "raw", "text", "into", "token", "IDs"];

const sliders: Record<string, SliderControl> = {
  context: { type: "slider", id: "context", label: "Visible context tokens", min: 2, max: 8, step: 1, default: 5, format: "integer" },
  temperature: { type: "slider", id: "temperature", label: "Sampling temperature", min: 0.2, max: 1.8, step: 0.1, default: 0.8, format: "number" },
};

const ablateControl: ToggleControl = {
  type: "toggle",
  id: "ablate",
  label: "Hide context mixing",
  default: false,
  onLabel: "Context hidden",
  offLabel: "Context visible",
};

function scoreToken(token: string, contextTokens: string[], ablate: boolean): number {
  const base = token.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 17;
  const contextSignal = contextTokens.reduce((sum, contextToken, index) => {
    const recency = (index + 1) / Math.max(1, contextTokens.length);
    const shared = token[0] === contextToken[0] ? 0.9 : 0;
    return sum + recency * ((contextToken.length % 5) * 0.18 + shared);
  }, 0);
  const signal = ablate ? 0 : contextSignal;
  return (base + signal) / 10;
}

export function TransformerLogitsLabWidget({
  initialState,
  onStateChange,
}: {
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const defaults = useMemo(() => ({ context: 5, temperature: 0.8, ablate: 0 }), []);
  const [values, setValues] = useState<Record<string, number>>(() => ({ ...defaults, ...(initialState ?? {}) }));

  function update(id: string, value: number) {
    const next = { ...values, [id]: value };
    setValues(next);
    onStateChange?.({ controls: next });
  }

  const context = Math.trunc(values.context);
  const ablate = (values.ablate ?? 0) >= 0.5;
  const temperature = values.temperature;
  const visibleStart = Math.max(0, sequence.length - context);
  const visible = sequence.slice(visibleStart);
  const logits = vocab
    .map((token) => ({ token, logit: scoreToken(token, visible, ablate) / temperature }))
    .sort((a, b) => b.logit - a.logit);
  const max = Math.max(...logits.map((l) => l.logit));
  const exps = logits.map((l) => Math.exp(l.logit - max));
  const denom = exps.reduce((a, b) => a + b, 0);
  const probs = logits.map((l, i) => ({ ...l, prob: exps[i] / denom }));
  const topToken = probs[0];
  const contextStrength = visible.map((token, index) => ({
    token,
    strength: ablate ? 0 : Math.round((((index + 1) / visible.length) * (token.length + 3) * 7)),
  }));
  const contextWindowLabel = ablate
    ? "Context hidden from the output head"
    : `Window uses the last ${visible.length} token states`;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider control={sliders.context} value={context} onChange={(v) => update("context", v)} />
        <Slider control={sliders.temperature} value={temperature} onChange={(v) => update("temperature", v)} />
        <Toggle control={ablateControl} value={ablate ? 1 : 0} onChange={(v) => update("ablate", v)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">1. Context mixing</div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">{contextWindowLabel}</div>
            <div className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">
              {visible.length} / {sequence.length}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {sequence.map((token, index) => {
              const inContext = index >= visibleStart;
              return (
                <span
                  key={`${token}-${index}`}
                  className={`relative rounded-lg border px-2 py-2 text-center text-sm font-semibold transition ${
                    inContext && !ablate
                      ? "border-teal-400 bg-teal-50 text-teal-950 shadow-sm shadow-teal-100"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <span className="mb-1 block font-mono text-[10px] font-bold text-slate-400">t-{sequence.length - index}</span>
                  {token}
                  {inContext && !ablate ? (
                    <span className="absolute inset-x-2 -bottom-1 h-1 rounded-full bg-teal-500" aria-hidden="true" />
                  ) : null}
                </span>
              );
            })}
          </div>
          <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-teal-900">
            Highlighted tokens are the visible context window. Drag the dial and the window edge moves left or right.
          </div>
          <div className="mt-4 rounded-lg bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-100">
            {ablate
              ? "Context mixing is hidden. The output head still produces logits, but they are much less connected to the sentence."
              : `The final position reads ${visible.length} prior token states before producing next-token scores.`}
          </div>
          <div className="mt-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Signals sent into the output head</div>
            {contextStrength.map((item) => (
              <div key={item.token} className="grid grid-cols-[76px_1fr_42px] items-center gap-2 text-xs">
                <span className={ablate ? "font-mono text-slate-400" : "font-mono text-teal-900"}>{item.token}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={ablate ? "h-full rounded-full bg-slate-300" : "h-full rounded-full bg-teal-500"}
                    style={{ width: `${Math.min(100, Math.max(2, item.strength))}%` }}
                  />
                </div>
                <span className="text-right font-mono text-slate-500">{item.strength}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">2. Output head scores vocabulary</div>
          <div className="space-y-2">
            {probs.slice(0, 6).map((item, index) => (
              <div key={item.token} className="grid grid-cols-[80px_1fr_54px] items-center gap-2 text-sm">
                <span className="font-mono text-slate-700">{item.token}</span>
                <div className="h-7 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={index === 0 ? "h-full rounded-full bg-indigo-600" : "h-full rounded-full bg-indigo-300"}
                    style={{ width: `${Math.max(3, item.prob * 100)}%` }}
                  />
                </div>
                <span className="text-right font-mono text-xs text-slate-500">{(item.prob * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-950">
        {ablate
          ? "The model can still rank vocabulary tokens when context is hidden, but the highlighted sentence window no longer sends evidence into the logits. This is the breakage the toggle is meant to reveal."
          : `The context dial changes which token states can influence the final hidden state. With ${visible.length} visible tokens, the output head currently favors “${topToken.token}” at ${(topToken.prob * 100).toFixed(1)}%. Lower temperature sharpens the probability pile after those logits are computed.`}
      </div>
    </div>
  );
}
