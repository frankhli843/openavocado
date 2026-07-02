import {
  approveArtifact,
  createArtifact,
  getArtifactBySlug,
  markBuildFailed,
  markBuildSuccess,
  updateSource,
} from "../src/lib/visual-artifacts/db";
import { buildArtifact } from "../src/lib/visual-artifacts/build";
import { getDb } from "../src/db/connection";
import type { ArtifactManifest } from "../src/lib/visual-artifacts/types";

type CueArtifact = {
  slug: string;
  title: string;
  stage: string;
  formula: string;
  focus: string[];
  caption: string;
  rows: Array<{ label: string; values: number[]; note: string }>;
  sidebars: Array<{ label: string; value: string }>;
};

const LESSON_ID = Number(process.env.LESSON_ID ?? 15);
const ACTIVITY_ID = Number(process.env.ACTIVITY_ID ?? 84);
const SLUG_PREFIX = process.env.SLUG_PREFIX ?? `lesson-${LESSON_ID}-cue`;

const baseCueArtifacts: CueArtifact[] = [
  {
    slug: "lesson-15-cue-hidden-state-input",
    title: "Hidden-state matrix enters the block",
    stage: "Input object",
    formula: "H_input has shape L x d_model",
    focus: ["H_input", "token rows", "same shape"],
    caption: "The transformer block receives one row per token. It will change values inside the rows, not the number of rows.",
    rows: [
      { label: "token 0: The", values: [0.22, -0.14, 0.63, 0.31], note: "row vector" },
      { label: "token 1: cat", values: [0.47, 0.11, -0.29, 0.58], note: "row vector" },
      { label: "token 2: sat", values: [-0.05, 0.76, 0.18, -0.22], note: "row vector" },
    ],
    sidebars: [
      { label: "Receives", value: "Hidden-state matrix from embeddings or the previous block" },
      { label: "Preserves", value: "The L x d_model shape" },
      { label: "Changes", value: "The information stored in each row" },
    ],
  },
  {
    slug: "lesson-15-cue-qk-dot-product",
    title: "Q and K create raw compatibility scores",
    stage: "QK dot product",
    formula: "scoreᵢⱼ = (qᵢ · kⱼ) / √dₖ",
    focus: ["q_cat", "k_The", "k_cat", "k_sat"],
    caption: "The active token's query row asks a question. Every key row advertises what that token can offer.",
    rows: [
      { label: "q_cat", values: [0.62, -0.18, 0.44], note: "what cat is looking for" },
      { label: "k_The", values: [0.20, -0.08, 0.31], note: "modifier signal" },
      { label: "k_cat", values: [0.71, -0.16, 0.38], note: "self signal" },
      { label: "k_sat", values: [-0.22, 0.54, 0.12], note: "action signal" },
    ],
    sidebars: [
      { label: "Q", value: "What this row is looking for" },
      { label: "K", value: "What each row offers for matching" },
      { label: "Output", value: "One raw score per possible source token" },
    ],
  },
  {
    slug: "lesson-15-cue-score-matrix",
    title: "QK^T forms the attention score matrix",
    stage: "Score matrix",
    formula: "S = QKᵀ / √dₖ",
    focus: ["S_cat,The", "S_cat,cat", "S_cat,sat"],
    caption: "Each row asks from one token position. Each column points to a token position that might be read.",
    rows: [
      { label: "The asks", values: [0.72, 0.18, -0.06], note: "row 0" },
      { label: "cat asks", values: [0.33, 0.84, 0.51], note: "row 1, active" },
      { label: "sat asks", values: [-0.11, 0.42, 0.77], note: "row 2" },
    ],
    sidebars: [
      { label: "Rows", value: "Query positions" },
      { label: "Columns", value: "Key positions" },
      { label: "Scale", value: "sqrt(d_k) keeps scores numerically stable" },
    ],
  },
  {
    slug: "lesson-15-cue-softmax-weights",
    title: "Softmax turns scores into attention weights",
    stage: "Softmax",
    formula: "Aᵢⱼ = exp(Sᵢⱼ) / Σₘ exp(Sᵢₘ)",
    focus: ["0.26", "0.43", "0.31"],
    caption: "Softmax turns arbitrary scores into positive weights that add to one across the row.",
    rows: [
      { label: "scores for cat", values: [0.33, 0.84, 0.51], note: "raw S row" },
      { label: "weights for cat", values: [0.26, 0.43, 0.31], note: "softmax row sums to 1" },
    ],
    sidebars: [
      { label: "Before", value: "Raw compatibility scores" },
      { label: "After", value: "Readable mixing weights" },
      { label: "Evidence", value: "0.26 + 0.43 + 0.31 = 1.00" },
    ],
  },
  {
    slug: "lesson-15-cue-value-mixing",
    title: "Attention weights mix V rows into context",
    stage: "Value mix",
    formula: "context_cat = Σⱼ A_cat,j Vⱼ",
    focus: ["V_The", "V_cat", "V_sat", "context_cat"],
    caption: "V rows carry the content. The weights decide how much of each value row enters the active token's output.",
    rows: [
      { label: "0.26 x V_The", values: [0.05, -0.02, 0.08], note: "small modifier contribution" },
      { label: "0.43 x V_cat", values: [0.31, 0.04, -0.12], note: "self contribution" },
      { label: "0.31 x V_sat", values: [-0.02, 0.23, 0.06], note: "action contribution" },
      { label: "context_cat", values: [0.34, 0.25, 0.02], note: "mixed output" },
    ],
    sidebars: [
      { label: "V", value: "The content being copied or blended" },
      { label: "A", value: "The mixing recipe" },
      { label: "Result", value: "One context vector for the active row" },
    ],
  },
  {
    slug: "lesson-15-cue-residual-add",
    title: "Residual addition preserves the stream",
    stage: "Residual add",
    formula: "H_after-attn = H_input + Attention(LayerNorm(H_input))",
    focus: ["H_input", "attention update", "H_after_attn"],
    caption: "Attention adds an update to the existing stream. It does not erase the old token representation.",
    rows: [
      { label: "H_input cat", values: [0.47, 0.11, -0.29, 0.58], note: "old stream" },
      { label: "attention update", values: [0.34, 0.25, 0.02, -0.10], note: "context added" },
      { label: "H_after_attn cat", values: [0.81, 0.36, -0.27, 0.48], note: "old plus update" },
    ],
    sidebars: [
      { label: "Stable", value: "Token count and vector width" },
      { label: "Changed", value: "The values in each row" },
      { label: "Why", value: "Old signal remains available to later layers" },
    ],
  },
  {
    slug: "lesson-15-cue-mlp-handoff",
    title: "The MLP adds a per-token feature update",
    stage: "MLP",
    formula: "H_output = H_after-attn + MLP(LayerNorm(H_after-attn))",
    focus: ["expand", "GELU gate", "compress", "H_output"],
    caption: "The MLP works on each row independently: expand features, gate them, compress back to d_model, then add the update.",
    rows: [
      { label: "cat row", values: [0.81, 0.36, -0.27, 0.48], note: "d_model" },
      { label: "expanded", values: [0.62, 0.08, -0.44, 0.71, 0.33, -0.16], note: "wider feature space" },
      { label: "gated", values: [0.45, 0.04, -0.12, 0.54, 0.21, -0.05], note: "GELU" },
      { label: "H_output cat", values: [0.93, 0.41, -0.19, 0.52], note: "same width as input" },
    ],
    sidebars: [
      { label: "Cross-token mixing?", value: "No, attention already did that" },
      { label: "Per-token work", value: "Each row gets its own feature update" },
      { label: "Handoff", value: "H_output goes to the next block or logits head" },
    ],
  },
  {
    slug: "lesson-15-cue-code-shape-check",
    title: "Code checks the block shape contract",
    stage: "Implementation check",
    formula: "assert shape(block(x)) = shape(x)",
    focus: ["x", "attn", "mlp", "same shape"],
    caption: "A correct transformer block changes values while preserving the tensor shape expected by the next block.",
    rows: [
      { label: "x", values: [3, 4, 4], note: "batch, tokens, width" },
      { label: "attn(x)", values: [3, 4, 4], note: "same shape update" },
      { label: "mlp(x)", values: [3, 4, 4], note: "same shape update" },
    ],
    sidebars: [
      { label: "Public test", value: "Shape is unchanged" },
      { label: "Hidden test", value: "Residual path is actually used" },
      { label: "Bug signal", value: "Shape mismatch breaks the next block" },
    ],
  },
  {
    slug: "lesson-15-cue-attention-vs-mlp",
    title: "Attention and MLP do different jobs",
    stage: "Misconception check",
    formula: "Attention: mix across positions. MLP: transform each row.",
    focus: ["positions", "features", "not the same"],
    caption: "Attention moves information across token positions. The MLP updates features inside each token row.",
    rows: [
      { label: "attention", values: [0.26, 0.43, 0.31], note: "reads across rows" },
      { label: "MLP", values: [0.45, 0.04, -0.12, 0.54], note: "updates within one row" },
    ],
    sidebars: [
      { label: "Attention", value: "Which other tokens should this token read?" },
      { label: "MLP", value: "What feature update should this token get?" },
      { label: "Residual", value: "How is the update added without erasing the stream?" },
    ],
  },
  {
    slug: "lesson-15-cue-logits-handoff",
    title: "The block output can feed the logits head",
    stage: "Handoff",
    formula: "logits = H_output W_vocab + b_vocab",
    focus: ["H_output", "W_vocab", "logits"],
    caption: "After enough blocks, the final hidden row can be projected into one raw score per vocabulary token.",
    rows: [
      { label: "H_output last row", values: [0.93, 0.41, -0.19, 0.52], note: "final representation" },
      { label: "vocab scores", values: [1.4, -0.2, 2.1, 0.7], note: "raw logits" },
    ],
    sidebars: [
      { label: "Receives", value: "Updated hidden-state rows" },
      { label: "Changes", value: "Representation becomes vocabulary scores" },
      { label: "Next", value: "Training supervises logits, inference samples from them" },
    ],
  },
];

const cueArtifacts: CueArtifact[] = baseCueArtifacts.map((artifact) => ({
  ...artifact,
  slug: `${SLUG_PREFIX}-${artifact.slug.replace(/^lesson-15-cue-/, "")}`,
}));

function artifactSource(spec: CueArtifact): string {
  return `import React from "react";

type Props = { initialState?: Record<string, number> };

const spec = ${JSON.stringify(spec, null, 2)};

function colorFor(value: number): string {
  const clamped = Math.max(-1, Math.min(1, value));
  if (clamped >= 0) {
    const alpha = 0.18 + Math.abs(clamped) * 0.5;
    return "rgba(37, 99, 235, " + alpha + ")";
  }
  const alpha = 0.14 + Math.abs(clamped) * 0.45;
  return "rgba(225, 29, 72, " + alpha + ")";
}

function Cell({ value }: { value: number }) {
  return (
    <div style={{
      minWidth: 42,
      height: 34,
      display: "grid",
      placeItems: "center",
      border: "1px solid #cbd5e1",
      background: colorFor(value),
      color: "#0f172a",
      fontVariantNumeric: "tabular-nums",
      fontSize: 12,
      fontWeight: 700,
    }}>
      {Number.isInteger(value) ? value : value.toFixed(2)}
    </div>
  );
}

export default function ArtifactComponent({ initialState }: Props) {
  const progress = Math.round(initialState?.progressPct ?? 0);
  return (
    <div style={{
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      padding: 16,
      color: "#0f172a",
      background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
      minHeight: 360,
      boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
            Generated cue artifact
          </div>
          <h2 style={{ margin: "4px 0 2px", fontSize: 20, lineHeight: 1.15 }}>{spec.title}</h2>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.35 }}>{spec.caption}</div>
        </div>
        <div style={{ minWidth: 86, textAlign: "right", fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
          audio {progress}%
        </div>
      </div>

      <div style={{
        border: "1px solid #bfdbfe",
        background: "#eff6ff",
        padding: "10px 12px",
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
          Formula / invariant
        </div>
        <div style={{
          marginTop: 4,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 16,
          lineHeight: 1.5,
          color: "#172554",
          overflowWrap: "anywhere",
        }}>
          {spec.formula}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(220px, 0.7fr)", gap: 14 }}>
        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
          {spec.rows.map((row) => (
            <div key={row.label} style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 0.7fr) minmax(0, 1.3fr)",
              gap: 8,
              alignItems: "center",
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: 8,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 850, color: "#0f172a" }}>{row.label}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: "#64748b", lineHeight: 1.3 }}>{row.note}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {row.values.map((value, index) => <Cell key={row.label + "-" + index} value={value} />)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 8, alignSelf: "start" }}>
          <div style={{
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            padding: 10,
          }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>Focus labels</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {spec.focus.map((item) => (
                <span key={item} style={{ border: "1px solid #93c5fd", background: "#dbeafe", color: "#1e3a8a", padding: "5px 7px", fontSize: 12, fontWeight: 800 }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
          {spec.sidebars.map((item) => (
            <div key={item.label} style={{ borderLeft: "3px solid #2563eb", background: "#f8fafc", padding: "8px 10px" }}>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>{item.label}</div>
              <div style={{ marginTop: 2, fontSize: 13, color: "#1e293b", lineHeight: 1.35 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;
}

function cleanScript(script: string): string {
  return script
    .replace(
      /Before we dive into details, you need the route\.[\s\S]*?onto the same route\./,
      "The concrete object is the hidden-state matrix entering one transformer block. This overview follows how Q and K create scores, how softmax turns scores into weights, how V supplies the content being mixed, how residual addition preserves the stream, and how the MLP adds a per-token feature update."
    )
    .replace(
      /Maya: So as you listen[\s\S]*?where a lot of terms fly by\./,
      "Maya: So the first object is H input, an L by d model matrix. Each row belongs to one token position. The block keeps that shape stable while attention, residual addition, normalization, and the MLP change the row values."
    )
    .replace(
      /Treat these as signposts[\s\S]*?instead of a fog of labels\./,
      "Those sections are connected by the same hidden-state object. The evidence is visible in the formulas: QK transpose creates a score matrix, softmax creates weights, multiplying by V creates a context vector, residual addition preserves the old stream, and the MLP returns another same-shape update."
    )
    .replace(
      /Maya: Return to the map[\s\S]*?misconception perspective\./,
      "Maya: The synthesis is the data path itself. H input enters the block, attention mixes context across token positions, the residual stream adds that update without erasing the old row, the MLP transforms each row independently, and H output leaves with the same shape but richer values."
    )
    .replace(/Revisit Model Building and Inference:/g, "Connect this transformer-block detail back to Model Building and Inference:")
    .replace(/Do not treat repetition as filler\. Repetition is what lets a new mental model survive pressure\./g, "Use this pass to inspect the same mechanism from a concrete angle.")
    .replace(/Say the incoming object again\. Say the operation again\. Say the output again\./g, "Name the incoming object, the operation, and the output.")
    .replace(/If you can explain that signpost using the workshop bench, the tiny example, the mechanism trace, and the implementation check, this has moved from recognition toward usable understanding\./g, "The useful test is whether the formula, matrix view, code shape check, and explanation all describe the same operation.")
    .replace(/We will keep the vibe conversational, like a careful podcast host pausing to make sure the listener is still with the idea before moving deeper\./g, "Then the next lesson part can add detail without changing the object being followed.");
}

async function upsertAndApproveArtifact(spec: CueArtifact): Promise<void> {
  const source = artifactSource(spec);
  const manifest: ArtifactManifest = { allowed_imports: ["react", "react-dom"] };
  const existing = getArtifactBySlug(spec.slug);
  if (existing) {
    updateSource(spec.slug, source, manifest);
  } else {
    createArtifact({
      slug: spec.slug,
      title: spec.title,
      source_react: source,
      manifest,
      lesson_id: LESSON_ID,
      activity_id: ACTIVITY_ID,
    });
  }

  const result = await buildArtifact(spec.slug, source, manifest);
  if (!result.ok) {
    markBuildFailed(spec.slug, result);
    throw new Error(`Build failed for ${spec.slug}: ${result.error}`);
  }
  markBuildSuccess(spec.slug, result);
  approveArtifact(spec.slug, {
    approved_by: "lesson15-section84-segmented-backfill",
    qa_notes:
      "Cue-level artifact generated for lesson 15 section 84. Replaces generic box visual with formula and matrix-focused component.",
  });
}

function updateActivityContent(): void {
  const db = getDb();
  const row = db.prepare("SELECT content FROM lesson_activities WHERE id = ?").get(ACTIVITY_ID) as
    | { content: string }
    | undefined;
  if (!row) throw new Error(`Missing lesson activity ${ACTIVITY_ID}`);
  const content = JSON.parse(row.content);
  content.script = cleanScript(String(content.script ?? ""));
  content.transcript = cleanScript(String(content.transcript ?? content.script ?? ""));

  const visual = content.orientation_visual;
  if (!visual || typeof visual !== "object" || !Array.isArray(visual.cues)) {
    throw new Error("Activity 84 is missing orientation_visual.cues");
  }
  visual.artifact_slug = "lesson-15-cue-hidden-state-input";
  visual.segmented_artifacts = true;
  visual.segmentation_note =
    "Each major cue mounts a separate approved visual_artifacts component so formulas, matrices, residuals, and MLP handoff are not forced into one generic box layout.";
  visual.cues = visual.cues.map((cue: Record<string, unknown>, index: number) => ({
    ...cue,
    artifact_slug: cueArtifacts[index % cueArtifacts.length].slug,
  }));
  content.backfilled_segmented_audio_visuals_at = new Date().toISOString();
  content.backfilled_segmented_audio_visuals_note =
    "Section 84 now uses per-cue DB-backed artifacts for Q/K scoring, softmax, value mixing, residual addition, MLP, code shape checks, and logits handoff.";

  db.prepare("UPDATE lesson_activities SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(content), ACTIVITY_ID);

  db.prepare(
    `UPDATE generated_artifacts
     SET source_script = ?, script_version = 'manual:lesson15-section84-segmented-visuals', generated_at = datetime('now')
     WHERE lesson_id = ? AND activity_id = ? AND artifact_type = 'audio'`
  ).run(content.script, LESSON_ID, ACTIVITY_ID);
}

async function main() {
  for (const spec of cueArtifacts) {
    await upsertAndApproveArtifact(spec);
    console.log(`approved ${spec.slug}`);
  }
  updateActivityContent();
  console.log("updated lesson 15 section 84 with segmented cue artifacts");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
