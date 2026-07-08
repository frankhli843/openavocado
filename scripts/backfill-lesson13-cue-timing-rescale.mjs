/**
 * Re-place Lesson 13 "Lesson 2: Predicting the Next Token" orientation
 * (activity 76) cue timeline against the REAL audio.
 *
 * act 76 is an orientation-type ("audio") overview, 1039.87s long. Its stored
 * cues were 4 generic placeholder blocks (span 900s, DRIFT 139.9s) whose
 * narration ("The visual begins with the concrete object…") does not match the
 * audio. The real narration (.transcript, ~19.5k chars) is a spiral overview:
 * the same eight teaching beats — big map / listen-for-the-route / workshop
 * metaphor / tiny example / mechanism / implementation intuition / common
 * confusion / return-to-map — repeated verbatim across five passes, all about
 * NEXT-TOKEN PREDICTION: a transformer mixes context, the output head turns the
 * final hidden state into logits (one score per vocab token), softmax makes
 * them probabilities, generation samples/chooses one, appends it, and repeats.
 *
 * Same shape as the QA-passed orientation segments (act 7/14/38/72), cued as
 * SEVEN route steps spread evenly across the full duration (High-level map,
 * Analogy, Tiny example, Mechanism, Implementation, Misconception, Synthesis).
 * We write real prediction-specific narration mapped onto the eight transcript
 * beats (beat 2 "listen for the route" folds into beat 1 "big map").
 *
 *   7 cues, even 148.553s windows, last cue ends exactly at 1039.87s.
 *
 * Monotonic, non-overlapping. Snapshot the DB before running (caller does this).
 * Run under node 22:
 *   AVOCADOCORE_DB_PATH=<live> node scripts/backfill-lesson13-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";
const ACT = 76;
const REAL = 1039.87;
const N = 7;
const STEP = REAL / N;

const CONTENT = [
  {
    label: "High-level map",
    headline: "Hidden state becomes a next-token guess",
    narration:
      "A transformer mixes information across the prompt. The output head turns the final hidden state into logits — one score per possible next token. Softmax makes them probabilities, generation picks one, appends it, and repeats.",
    receive: "the final hidden state of the prompt",
    transform: "output head → logits → softmax → probabilities",
    pass: "one sampled next token, then loop",
  },
  {
    label: "Analogy",
    headline: "The output head is a scoring station",
    narration:
      "Picture the pipeline as a workshop line. The transformer mixes context, the output-head station scores every word in the vocabulary, softmax stamps a receipt of probabilities, and generation picks one token to send forward.",
    receive: "a hidden state carrying the context",
    transform: "each station scores, normalizes, then selects",
    pass: "the chosen token plus its probability",
  },
  {
    label: "Tiny example",
    headline: "Follow one concrete prompt",
    narration:
      "Take one small prompt and follow it. In 'The cat', the final position's hidden state summarizes everything read so far. That single vector is what the model turns into a guess about the very next word.",
    receive: "the prompt 'The cat'",
    transform: "keep only the last position's hidden state",
    pass: "one vector h that predicts what comes next",
  },
  {
    label: "Mechanism",
    headline: "Logits are the hidden state scored per word",
    narration:
      "The output head is a matrix with one row per vocabulary word. Multiplying it by the hidden state gives a logit for each word — a raw, unbounded score. Here 'sat' scores highest, so it will win once we normalize.",
    receive: "hidden state h and the output-head matrix",
    transform: "z = W · h, one raw score per vocab word",
    pass: "a logit vector over the whole vocabulary",
  },
  {
    label: "Implementation",
    headline: "Softmax turns scores into probabilities",
    narration:
      "Softmax exponentiates every logit and divides by their sum, so the scores become positive numbers that add to one. In code: take the logit vector, apply softmax, and read off P('sat'). Argmax picks the top token; sampling can pick others.",
    receive: "the raw logit vector",
    transform: "p = exp(z) / sum(exp(z)), a valid distribution",
    pass: "probabilities that sum to 1, ranked",
  },
  {
    label: "Misconception",
    headline: "A score is not yet a probability",
    narration:
      "Separate nearby ideas: a logit is not a probability until softmax, a high probability is not certainty, argmax is not the only way to choose, and naming a phase like 'predict' is not the same as the matrix multiply inside it.",
    receive: "four tempting mix-ups",
    transform: "name each pair and why it confuses",
    pass: "a mental model that won't break",
  },
  {
    label: "Synthesis",
    headline: "Sample, append, and predict again",
    narration:
      "Return to the route: hidden state, logits, softmax, choose a token. Then append it and run the whole loop again — that autoregressive loop is how context grows and how each new word changes the next prediction. The audio maps it, the visual shows it, the code proves it.",
    receive: "the whole route, seen once",
    transform: "five perspectives on one prediction loop",
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
    `Replaced ${oldLen} placeholder cues (span 900s, drift 139.9s) with ${N} route-aligned content cues across the real ${REAL}s overview audio (even ${STEP.toFixed(3)}s windows), narration written from the transcript's eight next-token-prediction beats, matching the proven act 7/14/38/72 orientation pattern.`;
  db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(JSON.stringify(c), ACT);
  let maxGap = 0, prev = 0, overlap = false;
  for (const q of ov.cues) { if (q.start < prev - 1e-6) overlap = true; if (q.start - prev > maxGap) maxGap = q.start - prev; prev = q.end; }
  log.push(`act ${ACT}: replaced ${oldLen}->${ov.cues.length} cues; lastEnd=${ov.cues.at(-1).end}s (real ${REAL}); maxGap=${maxGap.toFixed(4)}s; overlap=${overlap}`);
});
tx();
db.close();
console.log(log.join("\n"));
