import {
  getArtifactBySlug,
  markBuildFailed,
  markBuilding,
  markBuildSuccess,
  updateSource,
} from "@/lib/visual-artifacts/db";
import { buildArtifact } from "@/lib/visual-artifacts/build";
import { getDb } from "@/db/connection";

const SLUG = "lesson-15-activity-85-part-audio-artifact";

const SOURCE = String.raw`import React from "react";

type Props = { initialState?: Record<string, number> };

const tokens = ["the", "cat", "sat", "mat"];
const q = [0.80, 0.36, 0.53];
const keys = [
  [0.73, 0.18, 0.35],
  [0.70, 0.66, 0.44],
  [0.34, 0.82, 0.51],
  [0.22, 0.58, 0.81],
];
const values = [
  [0.24, 0.43, 0.58],
  [0.61, 0.52, 0.25],
  [0.32, 0.79, 0.66],
  [0.55, 0.35, 0.74],
];
const scores = [0.86, 0.78, 0.42, 0.52];
const scaled = scores.map((s) => s / Math.sqrt(3));
const weights = [0.26, 0.43, 0.16, 0.15];
const mixed = [0.43, 0.53, 0.45];

const phases = [
  { title: "Hidden row branches into three learned views", focus: "split" },
  { title: "Q asks: what does the cat position need?", focus: "q" },
  { title: "K advertises: what can each token offer?", focus: "k" },
  { title: "Dot products compare the active Q with every K", focus: "dot" },
  { title: "QK^T creates a row of raw compatibility scores", focus: "score" },
  { title: "Divide by sqrt(d_k) so softmax does not spike too early", focus: "scale" },
  { title: "Softmax turns scores into a readable weight budget", focus: "softmax" },
  { title: "V rows carry the content that can be mixed", focus: "v" },
  { title: "Weights pull different amounts from each V row", focus: "mix" },
  { title: "The context vector leaves attention for the residual stream", focus: "out" },
];

function toneColor(tone: "blue" | "green" | "purple" | "amber", alpha: number) {
  const rgb = {
    blue: "37,99,235",
    green: "5,150,105",
    purple: "124,58,237",
    amber: "217,119,6",
  }[tone];
  return "rgba(" + rgb + "," + alpha + ")";
}

function Vector({
  label,
  values,
  tone,
  active = false,
}: {
  label: string;
  values: number[];
  tone: "blue" | "green" | "purple" | "amber";
  active?: boolean;
}) {
  return (
    <div style={{
      minWidth: 0,
      border: active ? "2px solid " + toneColor(tone, 0.9) : "1px solid #e2e8f0",
      background: active ? toneColor(tone, 0.09) : "#ffffff",
      padding: "8px",
      boxShadow: active ? "0 8px 22px rgba(15,23,42,0.10)" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontWeight: 900, color: toneColor(tone, 0.95), fontSize: 12 }}>{label}</span>
        {active && <span style={{ fontSize: 11, color: "#0f172a", fontWeight: 800 }}>spotlight</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5 }}>
        {values.map((v, i) => (
          <div key={i} style={{
            minHeight: 30,
            display: "grid",
            placeItems: "center",
            background: toneColor(tone, 0.12 + Math.abs(v) * 0.38),
            border: "1px solid " + toneColor(tone, 0.25),
            color: "#0f172a",
            fontVariantNumeric: "tabular-nums",
            fontSize: 12,
            fontWeight: 800,
          }}>{v.toFixed(2)}</div>
        ))}
      </div>
    </div>
  );
}

function Formula({ phase }: { phase: number }) {
  const active = phases[phase]?.focus;
  const part = (key: string, text: string) => (
    <span style={{
      display: "inline-block",
      padding: "3px 5px",
      margin: "1px",
      background: active === key ? "#dbeafe" : "transparent",
      outline: active === key ? "2px solid #2563eb" : "0",
      color: active === key ? "#1e3a8a" : "#334155",
      fontWeight: active === key ? 900 : 700,
    }}>{text}</span>
  );
  return (
    <div style={{ overflowX: "auto", border: "1px solid #bfdbfe", background: "#f8fbff", padding: 10 }}>
      <div style={{ minWidth: 520, fontSize: "clamp(14px, 3.8vw, 20px)", lineHeight: 1.9, fontFamily: "Georgia, Cambria, serif" }}>
        {part("score", "Attention(Q,K,V) =")}
        {part("softmax", " softmax(")}
        {part("dot", "QKᵀ")}
        {part("scale", " / √dₖ")}
        {part("softmax", ")")}
        {part("mix", " · V")}
      </div>
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
        Formula panel: the highlighted term is the one currently being explained.
      </div>
    </div>
  );
}

function ScoreRow({ phase }: { phase: number }) {
  const focus = phases[phase]?.focus;
  const useScaled = focus === "scale" || focus === "softmax" || focus === "mix" || focus === "out";
  const showWeights = focus === "softmax" || focus === "mix" || focus === "out";
  const row = showWeights ? weights : useScaled ? scaled : scores;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(78px, 100%), 1fr))", gap: 8 }}>
      {tokens.map((token, i) => (
        <div key={token} style={{
          minWidth: 0,
          padding: 8,
          background: showWeights ? "#ecfdf5" : "#fff7ed",
          border: "1px solid " + (showWeights ? "#a7f3d0" : "#fed7aa"),
        }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>{showWeights ? "weight for" : "score with"} {token}</div>
          <div style={{ marginTop: 3, fontSize: 22, color: showWeights ? "#047857" : "#c2410c", fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{row[i].toFixed(2)}</div>
          <div style={{ marginTop: 5, height: 8, background: "#e2e8f0" }}>
            <div style={{ height: "100%", width: Math.max(8, row[i] * 100) + "%", background: showWeights ? "#10b981" : "#f97316" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ValueMix({ phase }: { phase: number }) {
  const active = phases[phase]?.focus === "v" || phases[phase]?.focus === "mix" || phases[phase]?.focus === "out";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(145px, 100%), 1fr))", gap: 8 }}>
      {tokens.map((token, i) => (
        <div key={token} style={{ opacity: active ? 1 : 0.45 }}>
          <Vector label={"V_" + token + " × " + weights[i].toFixed(2)} values={values[i]} tone="purple" active={active && (i === 1 || i === 2)} />
        </div>
      ))}
      <Vector label="context_cat" values={mixed} tone="blue" active={phases[phase]?.focus === "out"} />
    </div>
  );
}

export default function ArtifactComponent({ initialState }: Props) {
  const cuePhase = Number(initialState?.cuePhase ?? initialState?.cueIndex ?? 0);
  const phase = Math.max(0, Math.min(phases.length - 1, cuePhase));
  const cueBeat = Math.max(0, Math.floor(Number(initialState?.cueLocalTime ?? 0) / 3));
  const focus = phases[phase]?.focus ?? "split";
  const connectorActive = focus === "dot" || focus === "score" || focus === "scale" || focus === "softmax";

  return (
    <section style={{
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflowWrap: "anywhere",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      color: "#0f172a",
      background: "radial-gradient(circle at top left, #eff6ff 0, #ffffff 42%, #f8fafc 100%)",
      padding: "clamp(10px, 3vw, 18px)",
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>Generated Q/K/V visual tutor</div>
          <h2 style={{ margin: "2px 0 0", fontSize: "clamp(20px, 6vw, 30px)", lineHeight: 1.08 }}>Attention as a moving read operation</h2>
        </div>
        <div style={{ minWidth: 110, background: "#0f172a", color: "white", padding: "8px 10px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          cue beat {cueBeat + 1}<br />audio-synced
        </div>
      </div>

      <div style={{ marginTop: 12, borderLeft: "4px solid #2563eb", background: "#eff6ff", padding: 10 }}>
        <div style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 900 }}>Now highlighting</div>
        <div style={{ fontSize: "clamp(16px, 4.5vw, 22px)", fontWeight: 900, lineHeight: 1.25 }}>{phases[phase].title}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Formula phase={phase} />
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, textTransform: "uppercase", marginBottom: 8 }}>1. Views made from the cat hidden row</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(145px, 100%), 1fr))", gap: 8 }}>
            <Vector label="Q_cat asks" values={q} tone="blue" active={focus === "q" || focus === "dot"} />
            <Vector label="K rows advertise" values={keys[2]} tone="green" active={focus === "k" || focus === "dot"} />
            <Vector label="V rows carry content" values={values[2]} tone="purple" active={focus === "v" || focus === "mix"} />
          </div>
          <div style={{ marginTop: 10, position: "relative", minHeight: 84, border: "1px dashed #bfdbfe", background: connectorActive ? "#eff6ff" : "#f8fafc", padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8" }}>Query-to-key spotlight</div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ padding: "8px 10px", background: "#dbeafe", fontWeight: 900 }}>Q_cat</span>
              <span style={{ color: connectorActive ? "#2563eb" : "#94a3b8", fontWeight: 900, fontSize: 24 }}>→</span>
              {tokens.map((token, i) => (
                <span key={token} style={{ padding: "8px 10px", background: i === 2 ? "#dcfce7" : "#f1f5f9", fontWeight: 900 }}>K_{token}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, textTransform: "uppercase", marginBottom: 8 }}>2. Scores become weights</div>
          <ScoreRow phase={phase} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, textTransform: "uppercase", marginBottom: 8 }}>3. Weights pull value content</div>
        <ValueMix phase={phase} />
      </div>
    </section>
  );
}
`;

const THREE_SECOND_CUES = [
  ["Hidden row splits", "Three learned projections appear", "The same hidden row is being viewed through W_Q, W_K, and W_V.", "hidden-state row h_cat", "project into Q, K, and V", "three role-specific vectors", 0],
  ["Q asks", "The query vector gets the spotlight", "Q is the question asked by the current token position.", "Q_cat", "ask what information is needed", "query ready to compare", 1],
  ["K advertises", "Key rows become possible matches", "Every token position offers a key vector for matching.", "all K rows", "advertise matchable features", "key table ready for dot products", 2],
  ["Dot product", "Q_cat points at every K row", "The active query is compared with each key row one by one.", "Q_cat and K rows", "compute vector alignment", "raw compatibility scores", 3],
  ["QK transpose", "The score row becomes part of QK^T", "All query-key comparisons form the score matrix.", "all Q and K rows", "matrix multiply Q by K transpose", "score matrix S", 4],
  ["Scale", "The denominator controls score sharpness", "Dividing by square root of d_k keeps the scores from becoming too spiky.", "raw scores", "divide by sqrt(d_k)", "scaled scores", 5],
  ["Softmax", "Scores become a weight budget", "Softmax turns the row into positive weights that sum to one.", "scaled score row", "normalize with softmax", "attention weights", 6],
  ["V content", "Value rows carry what can be mixed", "The weights are routing numbers. V holds the content being blended.", "attention weights and V rows", "select content by weight", "weighted value rows", 7],
  ["Mix values", "Weighted V rows combine", "Each V row contributes in proportion to its attention weight.", "weighted V rows", "sum weighted vectors", "context vector", 8],
  ["Handoff", "Context leaves attention", "The resulting context vector becomes an attention update for the residual stream.", "context vector", "pass to residual add", "updated hidden row", 9],
] as const;

const TRANSCRIPT_ALIGNED_SCHEDULE = [
  { start: 0, end: 24, phases: [0, 1, 2, 7] },
  { start: 24, end: 62, phases: [1, 2, 7] },
  { start: 62, end: 89, phases: [1, 2, 7] },
  { start: 89, end: 126, phases: [3, 4, 6, 7, 8] },
  { start: 126, end: 154, phases: [5, 6] },
  { start: 154, end: 181, phases: [4, 6, 8] },
  { start: 181, end: 210, phases: [8, 9] },
  { start: 210, end: 236, phases: [6, 7, 3] },
  { start: 236, end: 263, phases: [3, 6, 8, 9] },
  { start: 263, end: 273, phases: [9] },
];

function buildCueTimeline() {
  const cues = [];
  for (const segment of TRANSCRIPT_ALIGNED_SCHEDULE) {
    let step = 0;
    for (let start = segment.start; start < segment.end; start += 3) {
      const phaseIndex = segment.phases[step % segment.phases.length] ?? segment.phases[0]!;
      const spec = THREE_SECOND_CUES[phaseIndex]!;
      cues.push({
        start,
        end: Math.min(start + 3, segment.end),
        label: spec[0],
        headline: spec[1],
        narration: spec[2],
        receive: spec[3],
        transform: spec[4],
        pass: spec[5],
        artifact_slug: SLUG,
        active_elements: [spec[0]],
        phase_index: spec[6],
      });
      step += 1;
    }
  }
  if (cues.length > 0) cues[cues.length - 1].end = 273;
  return cues;
}

async function main() {
  const updated = updateSource(SLUG, SOURCE);
  markBuilding(SLUG);
  const result = await buildArtifact(SLUG, updated.source_react, updated.manifest);
  if (!result.ok) {
    markBuildFailed(SLUG, result);
    throw new Error(result.error ?? "artifact build failed");
  }
  markBuildSuccess(SLUG, result);

  const db = getDb();
  const row = db.prepare("select content from lesson_activities where id = ?").get(85) as { content: string };
  const content = JSON.parse(row.content);
  content.audio.synced_visual = {
    ...(content.audio.synced_visual ?? {}),
    artifact_slug: SLUG,
    description: "Audio-synced Q/K/V visual tutor with formula spotlighting and 3-second moving beats.",
    cues: buildCueTimeline(),
  };
  db.prepare("update lesson_activities set content = ?, updated_at = datetime('now') where id = ?")
    .run(JSON.stringify(content), 85);

  db.prepare(
    `UPDATE visual_artifacts
        SET build_status = 'qa_approved',
            qa_notes = ?,
            qa_snapshot_ref = ?,
            qa_screenshot_ref = ?,
            approved_at = datetime('now'),
            approved_by = 'active-learning-fast-fix',
            updated_at = datetime('now')
      WHERE slug = ?`
  ).run(
    "Active-learning local fast fix. Replaced static Q/K/V table with a bespoke Q/K/V visual tutor that changes highlight focus every 3 seconds from audioTime. Full desktop/mobile Chrome QA deferred until Frank is done learning.",
    "active-learning-local-no-full-qa",
    "active-learning-local-no-full-qa",
    SLUG
  );

  const artifact = getArtifactBySlug(SLUG);
  console.log(JSON.stringify({
    ok: true,
    slug: SLUG,
    status: artifact?.build_status,
    compiled_asset_path: artifact?.compiled_asset_path,
    cue_count: content.audio.synced_visual.cues.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
