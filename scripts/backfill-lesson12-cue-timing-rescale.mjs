/**
 * Re-place Lesson 12 "Lesson 1: Text to Tokens" orientation (activity 72) cue
 * timeline against the REAL audio.
 *
 * act 72 is an orientation-type ("audio") overview, 1225.66s long. Its stored
 * cues were 4 generic placeholder blocks (span 900s) whose narration
 * ("The visual starts by naming the object entering…") does not match the audio.
 * The real narration (.transcript, 3385 words) is a spiral overview: the same
 * eight teaching beats — big map / listen-for-the-route / workshop metaphor /
 * tiny example / mechanism / implementation intuition / common confusion /
 * return-to-map — repeated verbatim across five passes.
 *
 * This is the same shape as the already-converted, QA-passed orientation
 * segments (act 7 / act 14 / act 38), which were all cued as SEVEN route steps
 * spread evenly across the full duration (High-level map, Analogy, Tiny example,
 * Mechanism, Implementation, Misconception, Synthesis). We follow that proven
 * pattern here, but write real tokenization-specific narration (better captions
 * than the generic route template) mapped onto the eight transcript beats
 * (beat 2 "listen for the route" folds into beat 1 "big map").
 *
 *   7 cues, even 175.094s windows, last cue ends exactly at 1225.66s.
 *
 * Monotonic, non-overlapping. Snapshot the DB before running (caller does this).
 * Run under node 22:
 *   AVOCADOCORE_DB_PATH=<live> node scripts/backfill-lesson12-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";
const ACT = 72;
const REAL = 1225.66;
const N = 7;
const STEP = REAL / N;

const CONTENT = [
  {
    label: "High-level map",
    headline: "Text becomes a table of numbers",
    narration:
      "An LLM does not read words. Tokenization splits text into pieces, each piece gets an ID, and each ID selects a learned vector — a table of numbers the transformer can process.",
    receive: "raw characters of text",
    transform: "split into token pieces, then IDs, then embedding rows",
    pass: "a table of numbers (tokens × features)",
  },
  {
    label: "Analogy",
    headline: "The tokenizer is a workshop station",
    narration:
      "Picture the pipeline as a workshop line. The tokenizer station receives text, checks its label, changes it into IDs, and hands forward a receipt saying exactly what changed.",
    receive: "a real object: the input text",
    transform: "one station changes it and stamps a receipt",
    pass: "the changed object plus evidence of the change",
  },
  {
    label: "Tiny example",
    headline: "Follow one concrete input",
    narration:
      "Take one small input and follow it. In 'she saw the saw', the word 'saw' appears twice, becomes the same token ID both times, and each ID looks up the same embedding row.",
    receive: "one short sentence",
    transform: "each piece maps to a stable integer ID",
    pass: "a row of IDs you can point at",
  },
  {
    label: "Mechanism",
    headline: "IDs index rows; length costs compute",
    narration:
      "Each token ID is a row index into the embedding matrix, and the row's numbers carry learned meaning. Sequence length is a real compute cost — more tokens means more work.",
    receive: "token IDs",
    transform: "look up one embedding row per ID, then add position",
    pass: "an L × D table; longer L costs more",
  },
  {
    label: "Implementation",
    headline: "Encode and decode are exact inverses",
    narration:
      "In code, expect small inputs, named variables, and simple assertions. Build a vocab, encode text to IDs, decode IDs back to text, and assert that decode(encode(x)) == x.",
    receive: "a training-text string",
    transform: "collect chars, index them, encode/decode",
    pass: "a reversible tokenizer with a visible output",
  },
  {
    label: "Misconception",
    headline: "Don't confuse the label with the object",
    narration:
      "Separate nearby ideas: a token is not a word, an ID is not its vector, a score is not a probability, and a high-level phase is not the detailed operation inside it.",
    receive: "four tempting mix-ups",
    transform: "name each pair and why it confuses",
    pass: "a mental model that won't break",
  },
  {
    label: "Synthesis",
    headline: "Return to the map, then practice",
    narration:
      "Return to the route: the audio gives the map, the visual makes it visible, the text defines it, and the code proves it. You can now explain text-to-tokens from every angle.",
    receive: "the whole route, seen once",
    transform: "five perspectives on one idea",
    pass: "readiness for the lesson's activities",
  },
];

const PLAN = CONTENT.map((c, i) => {
  const start = Math.round(i * STEP * 1000) / 1000;
  const end = i === N - 1 ? REAL : Math.round((i + 1) * STEP * 1000) / 1000;
  return { start, end, ...c };
});

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
    `Replaced ${oldLen} placeholder cues (span 900s) with ${N} route-aligned content cues across the real ${REAL}s overview audio (even ${STEP.toFixed(3)}s windows), narration written from the transcript's eight teaching beats, matching the proven act 7/14/38 orientation pattern.`;
  db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(JSON.stringify(c), ACT);
  let maxGap = 0, prev = 0, overlap = false;
  for (const q of ov.cues) { if (q.start < prev - 1e-6) overlap = true; if (q.start - prev > maxGap) maxGap = q.start - prev; prev = q.end; }
  log.push(`act ${ACT}: replaced ${oldLen}->${ov.cues.length} cues; lastEnd=${ov.cues.at(-1).end}s (real ${REAL}); maxGap=${maxGap.toFixed(4)}s; overlap=${overlap}`);
});
tx();
db.close();
console.log(log.join("\n"));
