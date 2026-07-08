/**
 * Re-place Lesson 14 "Lesson 3: Serving with a KV Cache" orientation
 * (activity 80) cue timeline against the REAL audio.
 *
 * act 80 is an orientation-type ("audio") overview, 1004.88s long. Its stored
 * cues were 4 generic placeholder blocks (span 900s, DRIFT 104.9s) whose
 * narration ("The visual begins with the concrete object…") does not match the
 * audio. The real narration (.transcript, ~19.5k chars) is a spiral overview:
 * the same eight teaching beats — big map / listen-for-the-route / workshop
 * metaphor / tiny example / mechanism / implementation intuition / common
 * confusion / return-to-map — repeated verbatim across five passes, all about
 * SERVING WITH A KV CACHE: serving has two phases; prefill reads the prompt and
 * builds a key-value cache for every layer; decode generates one new token at a
 * time, reusing the cache instead of recomputing the whole prompt; the cache
 * still grows with context length, which is why long chats cost memory.
 *
 * Same shape as the QA-passed orientation segments (act 7/14/38/72/76), cued as
 * SEVEN route steps spread evenly across the full duration (High-level map,
 * Analogy, Tiny example, Mechanism, Implementation, Misconception, Synthesis).
 * We write real KV-cache-specific narration mapped onto the eight transcript
 * beats (beat 2 "listen for the route" folds into beat 1 "big map").
 *
 *   7 cues, even 143.554s windows, last cue ends exactly at 1004.88s.
 *
 * Monotonic, non-overlapping. Snapshot the DB before running (caller does this).
 * Run under node 22:
 *   AVOCADOCORE_DB_PATH=<live> node scripts/backfill-lesson14-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";
const ACT = 80;
const REAL = 1004.88;
const N = 7;
const STEP = REAL / N;

const CONTENT = [
  {
    label: "High-level map",
    headline: "Serving has two phases: prefill, then decode",
    narration:
      "Serving an LLM has two phases. Prefill reads the whole prompt once and builds a key-value cache for every layer. Decode then generates one new token at a time, reusing that cache instead of recomputing the prompt. The cache grows with context length, which is why long chats cost memory.",
    receive: "a prompt to serve",
    transform: "prefill → build KV cache, then decode token by token",
    pass: "generated tokens, one per decode step",
  },
  {
    label: "Analogy",
    headline: "The KV cache is a filed set of receipts",
    narration:
      "Picture the pipeline as a workshop line. Prefill is the station that reads the whole prompt once and files a receipt — the keys and values — for every token at every layer. Decode is the station that reuses those filed receipts, adding just one new receipt for the token it just produced.",
    receive: "the prompt at the prefill station",
    transform: "file K and V per token, then reuse the file each step",
    pass: "the next token plus one appended receipt",
  },
  {
    label: "Tiny example",
    headline: "Follow one short prompt through prefill",
    narration:
      "Take one small prompt and follow it. For 'The cat sat', prefill computes a key and a value vector for all three tokens at each layer and stores them. Now the model can attend over those three cached rows without ever reading the raw prompt again.",
    receive: "the prompt 'The cat sat'",
    transform: "compute and store K,V for each of the 3 tokens",
    pass: "a cache of 3 key rows and 3 value rows per layer",
  },
  {
    label: "Mechanism",
    headline: "Decode reuses cached K,V and appends one row",
    narration:
      "The cache stores, per layer, a key and value for every past token. To generate the next token the model computes only the new query, then attends over all cached keys and values. Without the cache it would recompute keys and values for the entire prompt every single step — quadratic work instead of linear.",
    receive: "the cached keys and values plus one new token",
    transform: "q_new · K_cache → weights, weights · V_cache → context",
    pass: "the new token's output, and its K,V appended",
  },
  {
    label: "Implementation",
    headline: "A growing per-layer tensor of keys and values",
    narration:
      "In code, keep two growing tensors per layer: cache_k and cache_v, shaped sequence by dimension. Each decode step computes k and v for the new position, appends them, and attends over the full cache. Memory scales as layers times two times sequence length times dimension — so it climbs as the chat gets longer.",
    receive: "cache_k, cache_v and the new token's k, v",
    transform: "append the new row, then attend over the whole cache",
    pass: "an updated cache one row taller",
  },
  {
    label: "Misconception",
    headline: "The cache saves compute but costs memory",
    narration:
      "Separate nearby ideas: prefill is not decode, a cached key or value is not the final answer, and reusing the cache saves computation but it does not save memory — the cache grows linearly with context. Naming the phase 'decode' is not the same as the attention matmul happening inside it.",
    receive: "four tempting mix-ups",
    transform: "name each pair and why it confuses",
    pass: "a mental model that won't break",
  },
  {
    label: "Synthesis",
    headline: "Prefill builds it, decode reuses and grows it",
    narration:
      "Return to the route: prefill reads the prompt and builds the KV cache, decode reuses that cache and appends one key-value row per new token, then repeats. That is why serving cost scales with context length — the audio maps it, the visual shows it, the code proves it.",
    receive: "the whole serving route, seen once",
    transform: "five perspectives on one prefill-then-decode loop",
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
  ov.cues = PLAN.map((p, i) => ({ ...p, index: i, duration: Math.round((p.end - p.start) * 1000) / 1000 }));
  ov.cue_timing_replaced_at = new Date().toISOString();
  ov.cue_timing_replaced_note =
    `Replaced ${oldLen} placeholder cues (span 900s, drift 104.9s) with ${N} route-aligned content cues across the real ${REAL}s overview audio (even ${STEP.toFixed(3)}s windows), narration written from the transcript's eight KV-cache serving beats, matching the proven act 7/14/38/72/76 orientation pattern.`;
  db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(JSON.stringify(c), ACT);
  let maxGap = 0, prev = 0, overlap = false;
  for (const q of ov.cues) { if (q.start < prev - 1e-6) overlap = true; if (q.start - prev > maxGap) maxGap = q.start - prev; prev = q.end; }
  log.push(`act ${ACT}: replaced ${oldLen}->${ov.cues.length} cues; lastEnd=${ov.cues.at(-1).end}s (real ${REAL}); maxGap=${maxGap.toFixed(4)}s; overlap=${overlap}`);
});
tx();
db.close();
console.log(log.join("\n"));
