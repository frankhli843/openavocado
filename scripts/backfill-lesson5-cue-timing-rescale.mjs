/**
 * Re-place Lesson 5 orientation (activity 32) cue timeline against the REAL
 * audio.
 *
 * Unlike lesson 15 (whose cues were transcript-derived and merely needed a
 * uniform scale factor), lesson 5's 5 cues were uniform 30s PLACEHOLDER blocks
 * (span 0-150s) whose labels ("Raw text / Tokenization / Architecture / Training
 * / Serving") do not match the actual 570.55s narration, which is a seven-stage
 * lifecycle overview followed by a tokenization deep dive. Simple scaling would
 * misalign every boundary. Instead we place 5 content-aligned cues derived from
 * proportional word timing of the real narration (1488 words, 2.61 wps):
 *
 *   Cue0 0-49     the map: raw text -> running model is seven contracts
 *   Cue1 49-335   the seven stages walkthrough (data..release), each a contract
 *   Cue2 335-406  tokenization = translation layer + tokenizer/model contract
 *   Cue3 406-452  vocabulary size (70 / 32k / 100k / 262,144) + embedding table
 *   Cue4 452-570.55 build a char tokenizer (encode/decode) + POTTERS hook
 *
 * Monotonic, non-overlapping, last cue ends exactly at the real duration.
 * Snapshot the DB before running (caller does this). Run under node 22:
 *   AVOCADOCORE_DB_PATH=<live> node scripts/backfill-lesson5-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";
const ACT = 32;
const REAL = 570.55;

// content-aligned cue plan
const PLAN = [
  {
    start: 0, end: 49, label: "The lifecycle map",
    headline: "Raw text to a running model is seven contracts",
    narration: "The lesson opens with the map: getting from raw text to a running language model is seven distinct stages, each a contract between what came before and what comes next.",
    receive: "a blank roadmap", transform: "see the whole pipeline at once", pass: "a mental map to slot every later lesson into",
  },
  {
    start: 49, end: 335, label: "The seven stages",
    headline: "Data → Tokenizer → Architecture → Training → Checkpoint → Quantization → Release",
    narration: "Each of the seven stages transforms what you have into what the next stage needs: clean data, a tokenizer, an initialized architecture, the training loop, checkpoints with evals, quantization, then packaging and release. Skip or break one and everything downstream breaks.",
    receive: "raw web-scale text", transform: "seven staged contracts, each with a failure mode", pass: "a released, runnable model",
  },
  {
    start: 335, end: 406, label: "Tokenization = translation",
    headline: "The tokenizer/model contract: swap it and the output turns to garbage",
    narration: "Tokenization is the translation layer between human text and model math. The tokenizer and model share a fixed-vocabulary contract: an ID means one learned vector. Swap the tokenizer at inference and the model silently produces nonsense with no error.",
    receive: "human characters and words", transform: "map text to stable integer IDs the model was trained on", pass: "token IDs that index the right embeddings",
  },
  {
    start: 406, end: 452, label: "Vocabulary size",
    headline: "70 vs 32k vs 100k vs 262,144: vocab size sets the embedding table",
    narration: "Vocabulary size is a real design lever: a character tokenizer has about 70 entries, LLaMA about 32,000, GPT-4 about 100,000, and Gemma 4 uses 262,144. Bigger vocab means fewer tokens per sentence but a larger embedding table (over a billion parameters at 4,096 dims).",
    receive: "a target vocabulary size", transform: "trade tokens-per-sentence against embedding-table size", pass: "a vocabulary and an encode function",
  },
  {
    start: 452, end: REAL, label: "Build a char tokenizer",
    headline: "Collect, sort, index: encode and decode — POTTERS",
    narration: "You build a character-level tokenizer the nanoGPT way: collect the unique characters, sort them, assign each an index; encoding maps char to index, decoding maps back. Remember the lifecycle with POTTERS: Plan, Organize, Tokenize, Train, Evaluate, Reduce, Serve.",
    receive: "a training-text string", transform: "unique chars → sorted → indexed → encode/decode", pass: "a transparent, reversible tokenizer",
  },
];

const db = new Database(DB_PATH);
const log = [];
const tx = db.transaction(() => {
  const row = db.prepare("SELECT content FROM lesson_activities WHERE id=?").get(ACT);
  if (!row) { log.push(`act ${ACT}: MISSING`); return; }
  const c = JSON.parse(row.content);
  const ov = c.orientation_visual;
  if (!ov || !Array.isArray(ov.cues)) { log.push(`act ${ACT}: no orientation_visual.cues`); return; }
  const oldLen = ov.cues.length;
  ov.cues = PLAN.map((p, i) => ({ ...p, index: i }));
  ov.cue_timing_replaced_at = new Date().toISOString();
  ov.cue_timing_replaced_note =
    `Replaced ${oldLen} placeholder 30s cues (span 150s) with 5 content-aligned cues across real audio ${REAL}s, boundaries from proportional word timing of the narration.`;
  db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(JSON.stringify(c), ACT);
  let maxGap = 0, prev = 0, overlap = false;
  for (const q of ov.cues) { if (q.start < prev) overlap = true; if (q.start - prev > maxGap) maxGap = q.start - prev; prev = q.end; }
  log.push(`act ${ACT}: replaced ${oldLen}->${ov.cues.length} cues; lastEnd=${ov.cues.at(-1).end}s (real ${REAL}); maxGap=${maxGap}s; overlap=${overlap}`);
});
tx();
db.close();
console.log(log.join("\n"));
