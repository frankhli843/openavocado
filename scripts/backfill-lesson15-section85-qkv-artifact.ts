import {
  getArtifactBySlug,
  markBuildFailed,
  markBuilding,
  markBuildSuccess,
  updateSource,
} from "@/lib/visual-artifacts/db";
import { buildArtifact } from "@/lib/visual-artifacts/build";

const SLUG = "lesson-15-activity-85-part-audio-artifact";

const SOURCE = String.raw`import React, { useMemo } from "react";

type Props = { initialState?: Record<string, number> };

type Row = { token: string; hidden: number[]; q: number[]; k: number[]; v: number[] };

const rows: Row[] = [
  { token: "the", hidden: [0.22, -0.14, 0.63, 0.31], q: [0.61, 0.28, 0.42], k: [0.73, 0.18, 0.35], v: [0.24, 0.43, 0.58] },
  { token: "cat", hidden: [0.47, 0.11, -0.29, 0.58], q: [0.80, 0.36, 0.53], k: [0.70, 0.66, 0.44], v: [0.61, 0.52, 0.25] },
  { token: "sat", hidden: [-0.05, 0.76, 0.18, -0.22], q: [0.24, 0.72, 0.64], k: [0.34, 0.82, 0.51], v: [0.32, 0.79, 0.66] },
  { token: "mat", hidden: [0.18, -0.33, 0.41, 0.67], q: [0.30, 0.51, 0.77], k: [0.22, 0.58, 0.81], v: [0.55, 0.35, 0.74] },
];

const cueTitles = [
  "Project hidden rows into Q, K, and V",
  "Assign the three jobs before scoring",
  "Dot one query row against all keys",
  "Fill the QK^T score matrix",
  "Scale by square root of d_k",
  "Softmax makes row weights",
  "Weights blend value rows",
  "Return a context vector to the residual stream",
];

const scoreRows = [
  [0.86, 0.28, 0.18, 0.12],
  [0.24, 0.78, 0.46, 0.52],
  [0.20, 0.42, 0.82, 0.35],
  [0.16, 0.58, 0.45, 0.74],
];

const softmaxSat = [0.20, 0.11, 0.57, 0.12];
const outputSat = [0.42, 0.72, 0.61];

function shade(value: number, tone: "blue" | "emerald" | "purple" | "amber" = "blue") {
  const palettes = {
    blue: [37, 99, 235],
    emerald: [5, 150, 105],
    purple: [124, 58, 237],
    amber: [217, 119, 6],
  } as const;
  const [r, g, b] = palettes[tone];
  const alpha = 0.13 + Math.min(1, Math.abs(value)) * 0.42;
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}

function Cell({
  value,
  tone = "blue",
  active = false,
}: {
  value: number;
  tone?: "blue" | "emerald" | "purple" | "amber";
  active?: boolean;
}) {
  return (
    <span style={{
      minWidth: 38,
      minHeight: 30,
      display: "inline-grid",
      placeItems: "center",
      border: active ? "2px solid #1d4ed8" : "1px solid #cbd5e1",
      background: shade(value, tone),
      color: "#0f172a",
      fontSize: 12,
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums",
      borderRadius: 0,
    }}>{value.toFixed(2)}</span>
  );
}

function MiniVector({
  values,
  tone,
  active,
}: {
  values: number[];
  tone: "blue" | "emerald" | "purple" | "amber";
  active?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {values.map((value, i) => <Cell key={i} value={value} tone={tone} active={active} />)}
    </div>
  );
}

function ProjectionRow({ row, active }: { row: Row; active: boolean }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(72px, 0.7fr) repeat(3, minmax(104px, 1fr))",
      gap: 8,
      alignItems: "start",
      borderBottom: "1px solid #e2e8f0",
      padding: "8px 0",
      overflowX: "auto",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: "#111827" }}>{row.token}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>hidden row</div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8" }}>Q asks</div>
        <MiniVector values={row.q} tone="blue" active={active} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#047857" }}>K advertises</div>
        <MiniVector values={row.k} tone="emerald" active={active} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed" }}>V carries</div>
        <MiniVector values={row.v} tone="purple" active={active} />
      </div>
    </div>
  );
}

function ScoreMatrix({ activeRow, scaled }: { activeRow: number; scaled: boolean }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #dbeafe", background: "#f8fbff" }}>
      <div style={{ minWidth: 330, display: "grid", gridTemplateColumns: "64px repeat(4, minmax(52px, 1fr))", gap: 0 }}>
        <div style={{ padding: 8, fontSize: 11, fontWeight: 800, color: "#64748b" }}>Q \ K</div>
        {rows.map((r) => (
          <div key={r.token} style={{ padding: 8, textAlign: "center", fontSize: 11, fontWeight: 800, color: "#047857" }}>{r.token}</div>
        ))}
        {scoreRows.map((scoreRow, i) => (
          <React.Fragment key={rows[i].token}>
            <div style={{ padding: 8, fontSize: 12, fontWeight: 800, color: i === activeRow ? "#1d4ed8" : "#334155", background: i === activeRow ? "#dbeafe" : "transparent" }}>{rows[i].token}</div>
            {scoreRow.map((score, j) => (
              <div key={j} style={{ padding: 4, background: i === activeRow ? "#eff6ff" : "white" }}>
                <Cell value={scaled ? score / Math.sqrt(3) : score} tone={i === activeRow ? "amber" : "blue"} active={i === activeRow} />
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function ValueBlend() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
      {rows.map((row, i) => (
        <div key={row.token} style={{ borderLeft: "3px solid #7c3aed", background: "#faf5ff", padding: 8, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12, fontWeight: 800 }}>
            <span>V:{row.token}</span>
            <span>{softmaxSat[i].toFixed(2)} weight</span>
          </div>
          <MiniVector values={row.v} tone="purple" active={i === 2} />
        </div>
      ))}
      <div style={{ borderLeft: "3px solid #2563eb", background: "#eff6ff", padding: 8, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>output for sat</div>
        <MiniVector values={outputSat} tone="blue" active />
      </div>
    </div>
  );
}

export default function ArtifactComponent({ initialState }: Props) {
  const cueIndex = Math.max(0, Math.min(7, Math.round(initialState?.cueIndex ?? initialState?.stage ?? 0)));
  const view = cueIndex < 2 ? "projection" : cueIndex < 6 ? "scores" : "values";
  const activeRow = cueIndex >= 2 && cueIndex < 6 ? Math.min(3, cueIndex - 2) : 2;
  const scaled = cueIndex >= 4;
  const progress = Math.max(0, Math.min(100, initialState?.progressPct ?? (cueIndex / 7) * 100));
  const subtitle = useMemo(() => cueTitles[cueIndex] ?? cueTitles[0], [cueIndex]);

  return (
    <section style={{
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflowWrap: "anywhere",
      fontFamily: "Inter, system-ui, sans-serif",
      color: "#0f172a",
      background: "white",
      padding: "clamp(10px, 3vw, 18px)",
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>Q/K/V attention handoff</div>
          <h2 style={{ margin: "2px 0 0", fontSize: "clamp(20px, 6vw, 28px)", lineHeight: 1.05 }}>Three views of one hidden state</h2>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{Math.round(progress)}% through audio</div>
      </div>

      <div style={{ marginTop: 10, height: 6, background: "#e2e8f0", overflow: "hidden" }}>
        <div style={{ width: progress + "%", height: "100%", background: "#2563eb" }} />
      </div>

      <div style={{ marginTop: 12, border: "1px solid #bfdbfe", background: "#eff6ff", padding: 10, overflowX: "auto" }}>
        <code style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "clamp(13px, 3.6vw, 16px)", color: "#1e3a8a" }}>Q = H W_Q, K = H W_K, V = H W_V; attention output = softmax(QK^T / sqrt(d_k)) V</code>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: 8 }}>
        {cueTitles.map((title, i) => (
          <div key={title} style={{
            minWidth: 0,
            borderBottom: i === cueIndex ? "3px solid #2563eb" : "2px solid #e2e8f0",
            background: i === cueIndex ? "#eff6ff" : "#f8fafc",
            color: i === cueIndex ? "#1e3a8a" : "#64748b",
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.25,
          }}>{title}</div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 12, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", marginBottom: 6 }}>
            {view === "projection" ? "1. Projection rows" : view === "scores" ? "2. QK^T score matrix" : "3. Value mixing"}
          </div>
          {view === "projection" ? rows.map((row, i) => <ProjectionRow key={row.token} row={row} active={i === 1} />) : view === "scores" ? <ScoreMatrix activeRow={activeRow} scaled={scaled} /> : <ValueBlend />}
        </div>
        <div style={{ minWidth: 0, borderLeft: "3px solid #2563eb", background: "#f8fafc", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#2563eb", textTransform: "uppercase" }}>What this audio beat is showing</div>
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55 }}>{subtitle}</p>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            <li>Q and K decide <strong>where to read</strong>.</li>
            <li>V carries <strong>what content gets blended</strong>.</li>
            <li>The result returns as a context vector for the residual stream.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
`;

async function main() {
  const updated = updateSource(SLUG, SOURCE);
  markBuilding(SLUG);
  const result = await buildArtifact(SLUG, updated.source_react, updated.manifest);
  if (result.ok) {
    markBuildSuccess(SLUG, result);
    console.log(JSON.stringify({ ok: true, slug: SLUG, status: "pending_qa", compiled_asset_path: result.compiled_asset_path }, null, 2));
  } else {
    markBuildFailed(SLUG, result);
    console.error(JSON.stringify({ ok: false, slug: SLUG, error: result.error, build_log: result.build_log }, null, 2));
    process.exit(1);
  }
  const artifact = getArtifactBySlug(SLUG);
  console.log(JSON.stringify({ slug: artifact?.slug, build_status: artifact?.build_status, source_hash: artifact?.source_hash }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
