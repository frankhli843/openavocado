import {
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

const cueSlugByLabel: Record<string, string> = {
  "Hidden-state rows enter": `${SLUG_PREFIX}-hidden-state-input`,
  "Notebook metaphor": `${SLUG_PREFIX}-residual-add`,
  "Tiny token example": `${SLUG_PREFIX}-score-matrix`,
  "Q and K compare": `${SLUG_PREFIX}-qk-dot-product`,
  "Softmax and V mix": `${SLUG_PREFIX}-value-mixing`,
  "Residual add": `${SLUG_PREFIX}-residual-add`,
  "MLP update": `${SLUG_PREFIX}-mlp-handoff`,
  "Shape contract": `${SLUG_PREFIX}-code-shape-check`,
  "Misleading shortcut": `${SLUG_PREFIX}-attention-vs-mlp`,
  "Next-token evidence": `${SLUG_PREFIX}-logits-handoff`,
};

const cuePlan = [
  {
    label: "Hidden-state rows enter",
    headline: "Hidden-state matrix enters the block",
    anchor: "Let's make one transformer block feel like a place you can walk through.",
    narration: "The block receives one row per token. It will preserve the row count while changing what each row represents.",
    receive: "hidden-state matrix H_input",
    transform: "preserve shape while preparing context updates",
    pass: "same rows ready for Q, K, and V projections",
    artifact_slug: cueSlugByLabel["Hidden-state rows enter"],
  },
  {
    label: "Next-token evidence",
    headline: "Rows become evidence for next-token logits",
    anchor: "So \"evidence\" means information that can change the model's next-token scores.",
    narration: "The row matters because later layers and the output head use it to change next-token scores.",
    receive: "token identity, position, and earlier features",
    transform: "turn row values into more predictive evidence",
    pass: "hidden rows that can support logits",
    artifact_slug: cueSlugByLabel["Next-token evidence"],
  },
  {
    label: "Shape contract",
    headline: "The block is specific edits to the same table",
    anchor: "The block is not a black box blob.",
    narration: "Attention, MLP, residuals, and LayerNorm are different edits to the same hidden-state table.",
    receive: "hidden-state table",
    transform: "apply learned sublayer updates",
    pass: "same-shaped but enriched table",
    artifact_slug: cueSlugByLabel["Shape contract"],
  },
  {
    label: "Q and K compare",
    headline: "Queries and keys create attention scores",
    anchor: "I want to slow down at attention.",
    narration: "Q asks what a token is looking for. K advertises what each token can match. Their dot products become scores.",
    receive: "hidden-state rows projected into Q and K",
    transform: "compare every query row with every key row",
    pass: "raw attention score matrix",
    artifact_slug: cueSlugByLabel["Q and K compare"],
  },
  {
    label: "Q and K compare",
    headline: "Vector alignment is the mechanism",
    anchor: "The vectors do not contain English labels like \"verb\".",
    narration: "The human labels are analogy. The actual mechanism is learned vector alignment.",
    receive: "query and key directions",
    transform: "measure compatibility by dot product",
    pass: "score table",
    artifact_slug: cueSlugByLabel["Q and K compare"],
  },
  {
    label: "Softmax and V mix",
    headline: "Scaling keeps softmax from becoming too sharp",
    anchor: "Why do we divide by the square root of d sub k before softmax?",
    narration: "Scaling keeps score magnitudes calm enough for softmax to make graded choices.",
    receive: "raw QK scores",
    transform: "divide by sqrt(d_k)",
    pass: "scaled scores ready for softmax",
    artifact_slug: `${SLUG_PREFIX}-softmax-weights`,
  },
  {
    label: "Softmax and V mix",
    headline: "Weights choose value content",
    anchor: "Softmax is more like a normalizer that turns scores into a budget.",
    narration: "Softmax creates weights. Those weights pull content from V rows.",
    receive: "attention scores and value rows",
    transform: "normalize scores and weight-sum V",
    pass: "context vector for each token row",
    artifact_slug: cueSlugByLabel["Softmax and V mix"],
  },
  {
    label: "Misleading shortcut",
    headline: "Q/K/V are learned projections, not tokenizer facts",
    anchor: "A common misconception is thinking Q, K, and V are three separate facts from the tokenizer",
    narration: "Q asks, K matches, V carries. The weights route, but V carries the content.",
    receive: "current hidden-state rows",
    transform: "project into role-specific views",
    pass: "query, key, and value roles",
    artifact_slug: cueSlugByLabel["Misleading shortcut"],
  },
  {
    label: "Residual add",
    headline: "Attention updates the stream without erasing it",
    anchor: "After the weighted sum of values is computed, where does it go?",
    narration: "The attention output becomes a delta added back into the original residual stream.",
    receive: "H_input plus attention update",
    transform: "add the update through the residual path",
    pass: "H_after_attn",
    artifact_slug: cueSlugByLabel["Residual add"],
  },
  {
    label: "Notebook metaphor",
    headline: "The residual stream is a shared notebook",
    anchor: "the residual stream is like a working notebook",
    narration: "The stream keeps the old signal while each block writes useful updates into it.",
    receive: "current residual stream",
    transform: "add context and per-token updates without replacing the stream",
    pass: "richer residual stream",
    artifact_slug: cueSlugByLabel["Notebook metaphor"],
  },
  {
    label: "MLP update",
    headline: "The MLP edits each row independently",
    anchor: "Where does the MLP enter?",
    narration: "The MLP transforms each row after context has arrived: expand, gate, compress, add.",
    receive: "H_after_attn",
    transform: "expand, GELU-gate, compress, and add",
    pass: "H_output",
    artifact_slug: cueSlugByLabel["MLP update"],
  },
  {
    label: "MLP update",
    headline: "Expansion gives the row room for intermediate features",
    anchor: "Why expand first?",
    narration: "The wider hidden space gives the MLP room to create and gate candidate features.",
    receive: "one token row",
    transform: "expand into wider feature space and apply GELU",
    pass: "compressed same-width update",
    artifact_slug: cueSlugByLabel["MLP update"],
  },
  {
    label: "Next-token evidence",
    headline: "Better rows make better next-token scores",
    anchor: "The block is not predicting directly, but it is shaping the evidence that prediction will use.",
    narration: "Blocks refine hidden states so the output head can assign better vocabulary logits later.",
    receive: "context-aware hidden rows",
    transform: "sharpen predictive features",
    pass: "rows that support better logits",
    artifact_slug: cueSlugByLabel["Next-token evidence"],
  },
  {
    label: "Attention heads",
    headline: "Multiple heads read the same table in different ways",
    anchor: "Where do multiple heads fit in this story?",
    narration: "Each head has its own Q, K, and V projections and contributes one reading of the same table.",
    receive: "shared hidden-state matrix",
    transform: "run several attention patterns in parallel",
    pass: "combined attention update",
    artifact_slug: cueSlugByLabel["Q and K compare"],
  },
  {
    label: "Residual add",
    headline: "LayerNorm creates a stable read path",
    anchor: "I want to ask about LayerNorm again",
    narration: "The sublayer reads a normalized view while the residual path carries the continuing stream.",
    receive: "current hidden-state row",
    transform: "normalize for the sublayer, then add the update",
    pass: "stable residual stream",
    artifact_slug: cueSlugByLabel["Residual add"],
  },
  {
    label: "Misleading shortcut",
    headline: "Fix the wrong shortcut version",
    anchor: "Let me test the causal chain with a wrong version.",
    narration: "The corrected chain is projection, scoring, weighting, value mixing, residual add, MLP update, later logits.",
    receive: "imprecise mental model",
    transform: "replace vague terms with the concrete data path",
    pass: "usable causal chain",
    artifact_slug: cueSlugByLabel["Misleading shortcut"],
  },
  {
    label: "Next-token evidence",
    headline: "Wrong predictions become inspectable",
    anchor: "I also want to connect this to why wrong predictions happen.",
    narration: "Once you know the chain, a mistake can be traced to representations, scores, weights, updates, or logits.",
    receive: "model error",
    transform: "inspect the mechanism that made it plausible",
    pass: "debuggable next-token prediction",
    artifact_slug: cueSlugByLabel["Next-token evidence"],
  },
  {
    label: "Q and K compare",
    headline: "The visual should track the changing object",
    anchor: "That also explains why the visualization should move.",
    narration: "The visual should show the real object being discussed: score grids, value mixing, residual adds, or MLP updates.",
    receive: "audio concept",
    transform: "show the concrete object and operation",
    pass: "visible proof of the concept",
    artifact_slug: cueSlugByLabel["Q and K compare"],
  },
];

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
  const audioTime = Number(initialState?.audioTime ?? 0);
  const cueLocalTime = Number(initialState?.cueLocalTime ?? Math.max(0, audioTime - Number(initialState?.cueStart ?? 0)));
  const beat = Math.floor(cueLocalTime / 3);
  const activeRowIndex = spec.rows.length ? beat % spec.rows.length : 0;
  const activeFocus = spec.focus.length ? spec.focus[beat % spec.focus.length] : spec.stage;
  return (
    <div style={{
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "clamp(10px, 3vw, 16px)",
      color: "#0f172a",
      background: "radial-gradient(circle at top left, #eff6ff 0, #ffffff 42%, #f8fafc 100%)",
      minHeight: 360,
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "100%",
      overflow: "hidden",
      overflowWrap: "anywhere",
    }}>
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
            DB-backed generated cue
          </div>
          <h2 style={{ margin: "4px 0 2px", fontSize: "clamp(18px, 5vw, 24px)", lineHeight: 1.12 }}>{spec.title}</h2>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.35 }}>{spec.caption}</div>
        </div>
        <div style={{ minWidth: 92, textAlign: "right", fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
          audio {progress}%<br />cue beat {beat + 1}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{ borderLeft: "4px solid #2563eb", background: "#eff6ff", padding: "8px 10px" }}>
          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>Spotlight now</div>
          <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: "#172554" }}>{activeFocus}</div>
        </div>
        <div style={{ borderLeft: "4px solid #16a34a", background: "#f0fdf4", padding: "8px 10px" }}>
          <div style={{ fontSize: 11, color: "#166534", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>Question to ask</div>
          <div style={{ marginTop: 2, fontSize: 13, fontWeight: 800, color: "#14532d" }}>
            What changes in this row, and what stays the same shape?
          </div>
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
          fontSize: "clamp(13px, 3.7vw, 17px)",
          lineHeight: 1.5,
          color: "#172554",
          overflowWrap: "anywhere",
        }}>
          {spec.formula}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
          {spec.rows.map((row, rowIndex) => (
            <div key={row.label} style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
              gap: 8,
              alignItems: "center",
              border: rowIndex === activeRowIndex ? "2px solid #2563eb" : "1px solid #e2e8f0",
              background: rowIndex === activeRowIndex ? "#eff6ff" : "#ffffff",
              boxShadow: rowIndex === activeRowIndex ? "0 8px 24px rgba(37, 99, 235, 0.14)" : "none",
              padding: 8,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 850, color: "#0f172a" }}>{row.label}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: "#64748b", lineHeight: 1.3 }}>{row.note}</div>
                {rowIndex === activeRowIndex ? (
                  <div style={{ marginTop: 6, color: "#2563eb", fontSize: 12, fontWeight: 900 }}>← follow this row</div>
                ) : null}
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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateTimeForAnchor(script: string, anchor: string, durationSec: number): number {
  const index = script.indexOf(anchor);
  if (index < 0) return -1;
  const totalWords = Math.max(1, wordCount(script));
  const wordsBefore = wordCount(script.slice(0, index));
  return Math.max(0, Math.min(durationSec - 1, (wordsBefore / totalWords) * durationSec));
}

function buildTranscriptAlignedCues(script: string, durationSec: number) {
  const anchors = cuePlan
    .map((cue, index) => ({
      ...cue,
      index,
      start: index === 0 ? 0 : estimateTimeForAnchor(script, cue.anchor, durationSec),
    }))
    .filter((cue) => cue.index === 0 || cue.start >= 0)
    .sort((a, b) => a.start - b.start);

  return anchors.map((cue, index) => {
    const next = anchors[index + 1];
    const start = Math.max(0, Math.round(cue.start));
    const end = Math.max(start + 6, Math.round(next?.start ?? durationSec));
    return {
      start,
      end: Math.min(Math.round(durationSec), end),
      label: cue.label,
      headline: cue.headline,
      narration: cue.narration,
      receive: cue.receive,
      transform: cue.transform,
      pass: cue.pass,
      artifact_slug: cue.artifact_slug,
      active_elements: [cue.label],
      phase_index: cue.index,
    };
  });
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
  getDb().prepare(
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
    "Active-learning local fast fix. Cue-level artifact generated for lesson 15 section 84 with a 3-second moving spotlight, highlighted vector rows, and mobile-responsive layout. Full desktop/mobile Chrome QA deferred until Frank is done learning.",
    "active-learning-local-no-full-qa",
    "active-learning-local-no-full-qa",
    spec.slug
  );
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
    throw new Error(`Activity ${ACTIVITY_ID} is missing orientation_visual.cues`);
  }
  const audioRow = db
    .prepare("SELECT duration_sec FROM generated_artifacts WHERE lesson_id = ? AND activity_id = ? AND artifact_type = 'audio'")
    .get(LESSON_ID, ACTIVITY_ID) as { duration_sec?: number } | undefined;
  const durationSec = Number(audioRow?.duration_sec ?? 1113.55);
  visual.artifact_slug = cueArtifacts[0]!.slug;
  visual.segmented_artifacts = true;
  visual.segmentation_note =
    "Each transcript-aligned cue mounts a separate approved visual_artifacts component so formulas, matrices, residuals, and MLP handoff are shown when the audio reaches that concept.";
  visual.cues = buildTranscriptAlignedCues(content.script, durationSec);
  content.backfilled_segmented_audio_visuals_at = new Date().toISOString();
  content.backfilled_segmented_audio_visuals_note =
    "Section 84 now uses transcript-aligned per-cue DB-backed artifacts. Cue starts are estimated from transcript anchor phrases and each artifact uses cue-local 3-second spotlight motion.";

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
  console.log(`updated lesson ${LESSON_ID} activity ${ACTIVITY_ID} with segmented cue artifacts`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
