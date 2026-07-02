import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath =
  process.env.AVOCADOCORE_DB_PATH ||
  process.env.AVO_DB_PATH ||
  path.join(process.cwd(), "data", "avocadocore.db");

const ACTIVITY_ID = 86;

function backupDb() {
  if (!fs.existsSync(dbPath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = dbPath.replace(/\.db$/, `.before-lesson15-residual-formulas-${stamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

const db = new Database(dbPath);
const row = db
  .prepare("SELECT id, content FROM lesson_activities WHERE id = ? AND activity_type = 'lesson_part'")
  .get(ACTIVITY_ID) as { id: number; content: string } | undefined;

if (!row) {
  throw new Error(`Activity ${ACTIVITY_ID} not found`);
}

const content = JSON.parse(row.content) as {
  reading?: {
    blocks?: Array<Record<string, unknown>>;
    summary?: string;
  };
};

if (!content.reading || !Array.isArray(content.reading.blocks)) {
  throw new Error(`Activity ${ACTIVITY_ID} has no reading.blocks`);
}

const originalText =
  "Every transformer block follows the same pattern: compute something, then add it to what came in. After the attention sublayer, you get: H_after_attn = H_input + Attention(H_input). After the MLP sublayer: H_output = H_after_attn + MLP(LayerNorm(H_after_attn)). This additive structure is called the residual stream. The original token information is never overwritten — only enriched.";

const idx = content.reading.blocks.findIndex(
  (block) => block.type === "text" && block.content === originalText
);

if (idx === -1) {
  console.log(`Activity ${ACTIVITY_ID} is already backfilled or has different content.`);
  process.exit(0);
}

const replacement: Array<Record<string, unknown>> = [
  {
    type: "text",
    content:
      "Every transformer block follows the same pattern: compute something, then add it to what came in. The attention sublayer reads the incoming hidden-state matrix, computes a context-mixing update, and adds that update back into the same residual stream.",
  },
  {
    type: "formula",
    latex:
      "H_{\\text{after-attn}} = H_{\\text{input}} + \\operatorname{Attention}(\\operatorname{LayerNorm}(H_{\\text{input}}))",
    plain_english:
      "Normalize the incoming hidden-state matrix, let attention compute a context-mixing update, then add that update to the original incoming matrix.",
    variables: [
      {
        symbol: "H_{\\text{input}}",
        meaning: "Hidden-state matrix entering this transformer block",
        shape: "L x d_model",
      },
      {
        symbol: "\\operatorname{LayerNorm}",
        meaning: "Normalization applied to each token row before the sublayer update",
      },
      {
        symbol: "\\operatorname{Attention}",
        meaning: "Attention sublayer that mixes context across token positions",
        shape: "returns L x d_model",
      },
      {
        symbol: "H_{\\text{after-attn}}",
        meaning: "Residual stream after the attention update is added",
        shape: "L x d_model",
      },
    ],
  },
  {
    type: "text",
    content:
      "The MLP sublayer then does a second residual update. It works on each token row separately, expands and compresses that row through learned nonlinear layers, then adds the resulting per-token update back into the stream.",
  },
  {
    type: "formula",
    latex:
      "H_{\\text{output}} = H_{\\text{after-attn}} + \\operatorname{MLP}(\\operatorname{LayerNorm}(H_{\\text{after-attn}}))",
    plain_english:
      "Normalize the post-attention stream, let the MLP transform each token row, then add that MLP update to produce the block output.",
    variables: [
      {
        symbol: "H_{\\text{after-attn}}",
        meaning: "Hidden-state matrix after the attention residual update",
        shape: "L x d_model",
      },
      {
        symbol: "\\operatorname{MLP}",
        meaning: "Per-token feed-forward sublayer that expands, activates, and compresses each row",
        shape: "returns L x d_model",
      },
      {
        symbol: "H_{\\text{output}}",
        meaning: "Hidden-state matrix leaving this transformer block",
        shape: "L x d_model",
      },
    ],
  },
  {
    type: "text",
    content:
      "This additive structure is called the residual stream. The original token information is never overwritten. It is carried forward while attention and the MLP add new evidence on top.",
  },
];

content.reading.blocks.splice(idx, 1, ...replacement);
content.reading.summary =
  "Every block adds updates to the residual stream. LayerNorm runs before each sublayer, attention adds a context-mixing update, and the MLP adds a per-token update. Blocks enrich rather than replace the hidden-state matrix, so the original token signal persists all the way to the final layer.";

const backupPath = backupDb();
db.prepare("UPDATE lesson_activities SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
  JSON.stringify(content),
  ACTIVITY_ID
);

console.log(
  `Backfilled activity ${ACTIVITY_ID} residual-stream formulas${backupPath ? ` after backup ${backupPath}` : ""}.`
);
