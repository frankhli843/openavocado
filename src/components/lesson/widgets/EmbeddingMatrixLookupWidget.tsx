"use client";

import { Fragment, useMemo, useState } from "react";
import type { WidgetStateChange } from "./DeclarativeWidget";

const D = 8;
const VOCAB = 50257;
const SAMPLES = [
  "the cat sat on the mat",
  "we train the model so the model learns",
  "robots quietly read every page",
];

type Token = { str: string; id: number; pos: number };

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tokenId(token: string): number {
  return hashStr(token) % VOCAB;
}

function embeddingVector(id: number, trained: boolean): number[] {
  const seed = trained ? (id * 2654435761) >>> 0 : (id ^ 0x5bd1e995) >>> 0;
  const random = mulberry32(seed ^ (trained ? 0 : 0xdead));
  return Array.from({ length: D }, () => {
    const value = random() * 2 - 1;
    return trained ? value : value * 0.3;
  });
}

function positionVector(pos: number): number[] {
  return Array.from({ length: D }, (_, i) => {
    const k = Math.floor(i / 2);
    const denom = Math.pow(10000, (2 * k) / D);
    return i % 2 === 0 ? Math.sin(pos / denom) : Math.cos(pos / denom);
  });
}

function tokenize(text: string): Token[] {
  return (text.toLowerCase().match(/[a-z']+|[.,!?;:]/g) || [])
    .slice(0, 12)
    .map((str, pos) => ({ str, id: tokenId(str), pos }));
}

const NEUTRAL = [237, 241, 246];
const TEAL = [13, 118, 110];
const AMBER = [194, 100, 10];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueColor(value: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, value / 1.8));
  const target = t < 0 ? TEAL : AMBER;
  const m = Math.abs(t);
  return [
    lerp(NEUTRAL[0], target[0], m),
    lerp(NEUTRAL[1], target[1], m),
    lerp(NEUTRAL[2], target[2], m),
  ];
}

function rgbCss(rgb: [number, number, number]): string {
  return `rgb(${rgb.map((x) => Math.round(x)).join(",")})`;
}

function textOn(rgb: [number, number, number]): string {
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.62 ? "#1e293b" : "#f8fafc";
}

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(Math.max(0, length - 1), Number.isFinite(value) ? Math.trunc(value) : 0));
}

export function EmbeddingMatrixLookupWidget({
  initialState,
  onStateChange,
}: {
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const [text, setText] = useState(SAMPLES[0]);
  const [controls, setControls] = useState<Record<string, number>>(() => ({
    active: initialState?.active ?? 0,
    position_on: initialState?.position_on ?? 1,
    trained: initialState?.trained ?? 1,
  }));

  const tokens = useMemo(() => tokenize(text), [text]);
  const active = clampIndex(controls.active ?? 0, tokens.length);
  const token = tokens[active] ?? { str: "", id: 0, pos: 0 };
  const positionOn = (controls.position_on ?? 1) >= 0.5;
  const trained = (controls.trained ?? 1) >= 0.5;

  const embedding = useMemo(() => embeddingVector(token.id, trained), [token.id, trained]);
  const position = useMemo(() => positionVector(token.pos), [token.pos]);
  const hidden = embedding.map((value, i) => value + (positionOn ? position[i] : 0));

  const usedIds = useMemo(
    () => [...new Set(tokens.map((t) => t.id))].sort((a, b) => a - b),
    [tokens]
  );
  const duplicatePositions = tokens.filter((t) => t.id === token.id).map((t) => t.pos);
  const hasDuplicate = duplicatePositions.length > 1;

  function update(next: Record<string, number>) {
    setControls(next);
    onStateChange?.({ controls: next });
  }

  function setControl(id: string, value: number) {
    update({ ...controls, [id]: value });
  }

  function chooseText(sample: string) {
    setText(sample);
    update({ ...controls, active: 0 });
  }

  function editText(value: string) {
    setText(value);
    update({ ...controls, active: 0 });
  }

  const insight = getInsight({ token, duplicatePositions, hasDuplicate, positionOn });

  return (
    <div className="hsl-root">
      <style>{css}</style>
      <div className="hsl-wrap">
        <p className="hsl-eyebrow">Embedding lookup / position encoding</p>
        <h3 className="hsl-title">From token IDs to hidden states</h3>
        <p className="hsl-sub">
          An embedding is just a row of learned numbers inside the model. Tap a
          token and follow how the tokenizer ID becomes a row address, then a
          vector, then a hidden state.
        </p>

        <section className="hsl-card hsl-primer">
          <p className="hsl-cap"><span>0</span> What an embedding matrix is</p>
          <div className="hsl-primer-grid">
            <div className="hsl-primer-copy">
              <p>
                The tokenizer only outputs integer IDs. The model owns a learned
                table called <b>E</b>. It has one row for every vocabulary ID and
                one column for each hidden dimension.
              </p>
              <p>
                Looking up ID <b>{token.id}</b> means: go to row <b>{token.id}</b>
                in <b>E</b>, copy its {D} numbers, and use that row as this
                token&apos;s embedding vector.
              </p>
              <div className="hsl-token-to-row">
                <span>{token.str || "token"}</span>
                <span aria-hidden="true">-&gt;</span>
                <span>tokenizer id {token.id}</span>
                <span aria-hidden="true">-&gt;</span>
                <span>row E[{token.id}]</span>
              </div>
            </div>
            <MiniMatrix activeId={token.id} trained={trained} />
          </div>
        </section>

        <section className="hsl-card">
          <p className="hsl-cap">Input sequence</p>
          <div className="hsl-samples">
            {SAMPLES.map((sample) => (
              <button
                key={sample}
                type="button"
                className={`hsl-chip ${sample === text ? "sel" : ""}`}
                onClick={() => chooseText(sample)}
              >
                {sample}
              </button>
            ))}
          </div>
          <input
            className="hsl-input"
            value={text}
            onChange={(event) => editText(event.target.value)}
            placeholder="type a short sentence"
            aria-label="Input text to tokenize"
          />
          <div className="hsl-switches">
            <Toggle
              on={positionOn}
              onLabel="position: on"
              offLabel="position: off"
              onToggle={() => setControl("position_on", positionOn ? 0 : 1)}
            />
            <Toggle
              on={trained}
              onLabel="table: trained"
              offLabel="table: at init"
              onToggle={() => setControl("trained", trained ? 0 : 1)}
            />
          </div>
        </section>

        <section className="hsl-card">
          <p className="hsl-cap"><span>1</span> Tokens become integer IDs</p>
          <div className="hsl-token-row">
            {tokens.length === 0 ? (
              <div className="hsl-empty">Type a few words to create token IDs.</div>
            ) : (
              tokens.map((t, i) => (
                <button
                  key={`${t.str}-${i}`}
                  type="button"
                  onClick={() => setControl("active", i)}
                  className={`hsl-token ${i === active ? "act" : ""} ${
                    t.id === token.id && i !== active ? "dup" : ""
                  }`}
                >
                  <span className="hsl-pos">{t.pos}</span>
                  <span className="hsl-word">{t.str}</span>
                  <span className="hsl-id">{t.id}</span>
                </button>
              ))
            )}
          </div>
          <div className="hsl-boundary">model boundary: IDs cross in here</div>
        </section>

        <section className="hsl-card">
          <p className="hsl-cap"><span>2</span> Embedding lookup: id {token.id} selects a row</p>
          <p className="hsl-stage-note">
            This is the same matrix <b>E</b>, but zoomed into only the rows touched
            by the current sentence. Rows not addressed by these token IDs are
            skipped.
          </p>
          <div className="hsl-table" role="table" aria-label="Embedding table rows addressed by the current sequence">
            {usedIds.length > 0 && usedIds[0] > 0 && (
              <div className="hsl-gap">... {usedIds[0].toLocaleString()} rows above</div>
            )}
            {usedIds.map((id, index) => {
              const rowVector = embeddingVector(id, trained);
              const gapAfter = index < usedIds.length - 1 ? usedIds[index + 1] - id - 1 : 0;
              return (
                <Fragment key={id}>
                  <div className={`hsl-table-row ${id === token.id ? "act" : ""}`} role="row">
                    <span className="hsl-row-id" role="cell">{id}</span>
                    <VectorStrip vec={rowVector} />
                  </div>
                  {gapAfter > 0 && <div className="hsl-gap">... {gapAfter.toLocaleString()} rows skipped</div>}
                </Fragment>
              );
            })}
            {usedIds.length > 0 && (
              <div className="hsl-gap">
                ... {(VOCAB - 1 - usedIds[usedIds.length - 1]).toLocaleString()} rows below
              </div>
            )}
          </div>
          <div className="hsl-legend">
            <span>-</span>
            <span className="hsl-bar" aria-hidden="true" />
            <span>+</span>
            <span>{VOCAB.toLocaleString()} x {D} learned table, showing addressed rows</span>
          </div>
        </section>

        <section className="hsl-card">
          <p className="hsl-cap"><span>3</span> Add position to create the hidden state</p>
          <div className="hsl-stack" key={`${token.id}-${token.pos}-${positionOn}-${trained}`}>
            <VectorLine label={`embedding: what "${token.str || "token"}" means`} mark="e" vec={embedding} />
            <VectorLine
              label={`position ${token.pos}: where it sits${positionOn ? "" : " (off)"}`}
              mark="+"
              vec={positionOn ? position : position.map(() => 0)}
              muted={!positionOn}
            />
            <VectorLine label="hidden state: the vector entering the transformer block" mark="=" vec={hidden} strong />
          </div>
        </section>

        <div className="hsl-insight" role="status">
          <span aria-hidden="true">-&gt;</span>
          <p>{insight}</p>
        </div>

        <p className="hsl-foot">
          Simplification: this lab shows {D} visible dimensions and a GPT-2-sized
          vocabulary count. Real modern models use much wider vectors and more
          complex tokenization, but the mechanism is the same: token ID selects a
          learned row, position is added, and the result is the initial hidden state.
        </p>
      </div>
    </div>
  );
}

function getInsight({
  token,
  duplicatePositions,
  hasDuplicate,
  positionOn,
}: {
  token: Token;
  duplicatePositions: number[];
  hasDuplicate: boolean;
  positionOn: boolean;
}) {
  if (hasDuplicate && positionOn) {
    return `"${token.str}" appears at positions ${duplicatePositions.join(
      " and "
    )}. Both uses select the same embedding row, but each gets a different position vector, so order survives.`;
  }
  if (hasDuplicate && !positionOn) {
    return `Position is off. Every "${token.str}" now has the same hidden state, so the model has lost track of which occurrence came first.`;
  }
  return `ID ${token.id} is an address, not the meaning itself. The meaning available to the model lives in the learned embedding row that this ID selects.`;
}

function MiniMatrix({ activeId, trained }: { activeId: number; trained: boolean }) {
  const visibleRows = useMemo(() => {
    const offsets = [-2, -1, 0, 1, 2];
    return offsets.map((offset) => Math.max(0, Math.min(VOCAB - 1, activeId + offset)));
  }, [activeId]);

  return (
    <div className="hsl-mini" aria-label="Simplified embedding matrix">
      <div className="hsl-mini-title">Embedding matrix E</div>
      <div className="hsl-mini-sub">{VOCAB.toLocaleString()} rows x {D} dimensions</div>
      <div className="hsl-mini-grid" role="table">
        <div className="hsl-mini-head" role="row">
          <span>row</span>
          {Array.from({ length: D }, (_, index) => (
            <span key={index}>d{index}</span>
          ))}
        </div>
        {visibleRows.map((id) => {
          const isActive = id === activeId;
          const row = embeddingVector(id, trained);
          return (
            <div key={id} className={`hsl-mini-row ${isActive ? "act" : ""}`} role="row">
              <span>E[{id}]</span>
              {row.map((value, index) => {
                const color = valueColor(value);
                return (
                  <span
                    key={index}
                    className="hsl-mini-cell"
                    style={{ background: rgbCss(color), color: textOn(color) }}
                  >
                    {value.toFixed(1)}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="hsl-mini-note">
        These numbers start random at initialization, then training nudges them
        until useful token patterns live in the rows.
      </p>
    </div>
  );
}

function Toggle({
  on,
  onLabel,
  offLabel,
  onToggle,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`hsl-toggle ${on ? "on" : ""}`}
      onClick={onToggle}
      aria-pressed={on}
    >
      <span className="hsl-knob" aria-hidden="true" />
      <span>{on ? onLabel : offLabel}</span>
    </button>
  );
}

function VectorLine({
  label,
  mark,
  vec,
  muted,
  strong,
}: {
  label: string;
  mark: string;
  vec: number[];
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`hsl-vector-line ${muted ? "muted" : ""} ${strong ? "strong" : ""}`}>
      <div className="hsl-vector-label">{label}</div>
      <div className="hsl-vector-with-mark">
        <span className="hsl-op">{mark}</span>
        <VectorStrip vec={vec} />
      </div>
    </div>
  );
}

function VectorStrip({ vec }: { vec: number[] }) {
  return (
    <div className="hsl-cells">
      {vec.map((value, index) => {
        const color = valueColor(value);
        return (
          <span
            key={index}
            className="hsl-cell"
            style={{ background: rgbCss(color), color: textOn(color) }}
          >
            {value.toFixed(2)}
          </span>
        );
      })}
    </div>
  );
}

const css = `
.hsl-root {
  color: #1e293b;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.hsl-wrap {
  max-width: 820px;
  margin: 0 auto;
}
.hsl-eyebrow {
  margin: 0 0 0.35rem;
  color: #4f46e5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.hsl-title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(1.35rem, 2.5vw, 1.8rem);
  font-weight: 800;
  line-height: 1.1;
}
.hsl-sub {
  margin: 0.55rem 0 1rem;
  max-width: 62ch;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.55;
}
.hsl-card {
  margin-bottom: 0.85rem;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #ffffff;
  padding: 0.9rem;
  box-shadow: 0 10px 28px -24px rgba(15, 23, 42, 0.45);
}
.hsl-cap {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.7rem;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.hsl-cap span {
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  padding: 0.05rem 0.42rem;
}
.hsl-primer {
  border-color: #c7d2fe;
  background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
}
.hsl-primer-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(280px, 1.1fr);
  gap: 0.9rem;
  align-items: start;
}
.hsl-primer-copy {
  color: #334155;
  font-size: 0.9rem;
  line-height: 1.55;
}
.hsl-primer-copy p {
  margin: 0 0 0.7rem;
}
.hsl-token-to-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
  align-items: center;
  margin-top: 0.75rem;
  color: #312e81;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 750;
}
.hsl-token-to-row span {
  border-radius: 999px;
  background: #eef2ff;
  padding: 0.22rem 0.48rem;
}
.hsl-token-to-row span:nth-child(2n) {
  background: transparent;
  color: #64748b;
  padding-inline: 0;
}
.hsl-mini {
  min-width: 0;
  border: 1px solid #dbe2ec;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.75rem;
}
.hsl-mini-title {
  color: #0f172a;
  font-weight: 850;
}
.hsl-mini-sub,
.hsl-mini-note,
.hsl-stage-note {
  color: #64748b;
  font-size: 0.76rem;
  line-height: 1.45;
}
.hsl-mini-sub {
  margin-top: 0.08rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.hsl-mini-grid {
  display: grid;
  gap: 3px;
  margin-top: 0.55rem;
}
.hsl-mini-head,
.hsl-mini-row {
  display: grid;
  grid-template-columns: minmax(64px, 86px) repeat(8, minmax(28px, 1fr));
  gap: 3px;
  align-items: center;
}
.hsl-mini-head span,
.hsl-mini-row > span:first-child {
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.62rem;
  font-weight: 750;
}
.hsl-mini-head span:not(:first-child) {
  text-align: center;
}
.hsl-mini-row {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 2px;
}
.hsl-mini-row.act {
  border-color: #4f46e5;
  background: #eef2ff;
}
.hsl-mini-row.act > span:first-child {
  color: #3730a3;
}
.hsl-mini-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.56rem;
  font-weight: 700;
}
.hsl-mini-note {
  margin: 0.55rem 0 0;
}
.hsl-stage-note {
  margin: -0.25rem 0 0.65rem;
}
.hsl-samples,
.hsl-switches,
.hsl-token-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.hsl-chip,
.hsl-toggle,
.hsl-token {
  min-height: 38px;
  cursor: pointer;
  border: 1px solid #dbe2ec;
  background: #f8fafc;
  color: #334155;
  transition: border-color 150ms ease, background 150ms ease, color 150ms ease, box-shadow 150ms ease;
}
.hsl-chip {
  border-radius: 999px;
  padding: 0.36rem 0.7rem;
  font-size: 0.78rem;
}
.hsl-chip:hover,
.hsl-token:hover,
.hsl-toggle:hover {
  border-color: #a5b4fc;
}
.hsl-chip.sel {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #ffffff;
}
.hsl-input {
  width: 100%;
  box-sizing: border-box;
  margin: 0.65rem 0;
  border: 1px solid #dbe2ec;
  border-radius: 10px;
  background: #ffffff;
  color: #1e293b;
  padding: 0.62rem 0.72rem;
  font-size: 0.9rem;
}
.hsl-input:focus,
.hsl-chip:focus-visible,
.hsl-toggle:focus-visible,
.hsl-token:focus-visible {
  outline: 3px solid #c7d2fe;
  outline-offset: 2px;
}
.hsl-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  padding: 0.28rem 0.72rem 0.28rem 0.28rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.74rem;
}
.hsl-toggle.on {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #3730a3;
}
.hsl-knob {
  position: relative;
  width: 30px;
  height: 18px;
  flex: none;
  border-radius: 999px;
  background: #cbd5e1;
}
.hsl-knob::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
  transition: transform 150ms ease;
}
.hsl-toggle.on .hsl-knob {
  background: #4f46e5;
}
.hsl-toggle.on .hsl-knob::after {
  transform: translateX(12px);
}
.hsl-token {
  position: relative;
  border-radius: 10px;
  padding: 0.42rem 0.56rem;
  text-align: center;
  min-width: 54px;
}
.hsl-token.act {
  border-color: #4f46e5;
  background: #eef2ff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16);
}
.hsl-token.dup {
  border-color: #c7d2fe;
}
.hsl-pos {
  position: absolute;
  top: -7px;
  right: -6px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #64748b;
  padding: 0.04rem 0.32rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.57rem;
}
.hsl-token.act .hsl-pos {
  background: #4f46e5;
  color: #ffffff;
}
.hsl-word {
  display: block;
  color: #0f172a;
  font-weight: 750;
}
.hsl-id {
  display: block;
  margin-top: 0.16rem;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.66rem;
}
.hsl-boundary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.75rem;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.hsl-boundary::before,
.hsl-boundary::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
}
.hsl-table {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}
.hsl-table-row {
  display: grid;
  grid-template-columns: minmax(58px, 76px) minmax(0, 1fr);
  gap: 0.5rem;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0.32rem 0.45rem;
}
.hsl-table-row.act {
  border-color: #4f46e5;
  background: #f5f6ff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.11);
}
.hsl-row-id {
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.76rem;
}
.hsl-table-row.act .hsl-row-id {
  color: #4f46e5;
  font-weight: 800;
}
.hsl-gap {
  color: #aab5c4;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.68rem;
}
.hsl-cells {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 3px;
  min-width: 0;
}
.hsl-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 31px;
  border-radius: 5px;
  padding: 0 0.08rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: clamp(0.48rem, 1.7vw, 0.62rem);
  font-weight: 650;
}
.hsl-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.65rem;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.68rem;
}
.hsl-bar {
  width: 120px;
  height: 9px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(13,118,110), rgb(237,241,246), rgb(194,100,10));
}
.hsl-stack {
  display: grid;
  gap: 0.65rem;
}
.hsl-vector-line {
  animation: hsl-rise 260ms ease both;
}
.hsl-vector-line.muted {
  opacity: 0.36;
}
.hsl-vector-line.strong .hsl-cell {
  min-height: 38px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
}
.hsl-vector-label {
  margin-bottom: 0.25rem;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 700;
}
.hsl-vector-with-mark {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 0.35rem;
  align-items: center;
}
.hsl-op {
  color: #64748b;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 1rem;
  font-weight: 850;
}
.hsl-insight {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.65rem;
  border-radius: 14px;
  background: #0f172a;
  color: #e2e8f0;
  padding: 0.88rem 1rem;
  font-size: 0.88rem;
  line-height: 1.55;
}
.hsl-insight span {
  color: #a5b4fc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 850;
}
.hsl-insight p,
.hsl-foot {
  margin: 0;
}
.hsl-foot {
  margin-top: 0.65rem;
  color: #64748b;
  font-size: 0.8rem;
  line-height: 1.55;
}
.hsl-empty {
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  padding: 0.75rem;
  font-size: 0.86rem;
}
@keyframes hsl-rise {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 480px) {
  .hsl-card { padding: 0.72rem; }
  .hsl-primer-grid {
    grid-template-columns: 1fr;
  }
  .hsl-mini {
    overflow-x: auto;
  }
  .hsl-mini-grid {
    min-width: 510px;
  }
  .hsl-table-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
  .hsl-row-id::before { content: "row "; }
  .hsl-cells { gap: 2px; }
  .hsl-cell { min-height: 28px; }
}
@media (prefers-reduced-motion: reduce) {
  .hsl-vector-line,
  .hsl-chip,
  .hsl-toggle,
  .hsl-token,
  .hsl-knob::after {
    animation: none;
    transition: none;
  }
}
`;
