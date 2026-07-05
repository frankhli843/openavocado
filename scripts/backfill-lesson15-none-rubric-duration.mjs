/**
 * Deterministic Lesson 15 backfill (subject 5, the active subject):
 *
 *  1. Reconcile audio.duration_hint to the REAL generated audio duration for
 *     lesson-part activities 85/86/87. The stored hints were authoring
 *     over-estimates (358/336/338s) while the actual mp3s are 272/162/310s,
 *     which made the synced-visual cue-coverage validator fail even though the
 *     cue timelines already cover the real audio (act 85/86). Truth = ffprobe.
 *  2. Remove authored "None of the above" choices from lesson-part select_all
 *     questions (act 86 q0/q1/q3, act 87 q1/q2/q4/q5). The UI supplies a virtual
 *     none option, so an authored none is a duplicate. Every affected question
 *     has the none at the trailing index and never lists it as correct, so the
 *     removal needs no correct-index reindexing. Mirrors the act-85 fix.
 *  3. Add a substantive actual_answer + rubric to the one written assessment
 *     question that needs LLM feedback but lacks them (act 89 q4).
 *
 * Idempotent: re-running skips work already stamped/applied. Read the DB path
 * from src/db/connection.ts default. Snapshot the DB before running (the caller
 * does this in the shell, per repo convention).
 *
 * Run from the repo root under node 22:  node scripts/backfill-lesson15-none-rubric-duration.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";
const STAMP = new Date().toISOString();

// Real audio durations (seconds, from ffprobe on runtime_artifacts/audio/*.mp3).
const REAL_DURATION = { 85: 272, 86: 162, 87: 310 };

// Which select_all question indices carry an authored trailing "none" choice.
const NONE_QUESTIONS = { 86: [0, 1, 3], 87: [1, 2, 4, 5] };

const NONE_RE = /none of (these|the above|the below)/i;
const choiceText = (ch) =>
  typeof ch === "string" ? ch : ch?.text || ch?.label || "";

const db = new Database(DB_PATH);
const getContent = (id) => {
  const row = db.prepare("SELECT content FROM lesson_activities WHERE id=?").get(id);
  return row ? JSON.parse(row.content) : null;
};
const setContent = (id, obj) =>
  db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(
    JSON.stringify(obj),
    id
  );

const log = [];
const tx = db.transaction(() => {
  // 1 + 2: lesson-part activities
  for (const aid of [85, 86, 87]) {
    const c = getContent(aid);
    if (!c) {
      log.push(`act ${aid}: MISSING, skipped`);
      continue;
    }
    let changed = false;

    // 1. duration_hint reconciliation
    const audio = c.audio;
    const real = REAL_DURATION[aid];
    if (audio && real && audio.duration_hint !== real) {
      log.push(`act ${aid}: duration_hint ${audio.duration_hint} -> ${real}`);
      audio.duration_hint = real;
      changed = true;
    }

    // 2. authored none-choice removal
    const targets = NONE_QUESTIONS[aid] || [];
    if (targets.length && !c.active_learning_duplicate_none_fix_at) {
      const questions = c.practice?.questions || [];
      for (const qi of targets) {
        const q = questions[qi];
        if (!q || q.type !== "select_all" || !Array.isArray(q.choices)) continue;
        const noneIdx = q.choices.findIndex((ch) => NONE_RE.test(choiceText(ch)));
        if (noneIdx < 0) continue;
        const correct = q.correct_indices || q.correct || [];
        if (correct.includes(noneIdx)) {
          log.push(`act ${aid} q${qi}: none at ${noneIdx} is marked correct, SKIP (unsafe)`);
          continue;
        }
        q.choices.splice(noneIdx, 1);
        // reindex any correct index above the removed one (defensive; none expected)
        const reindex = (arr) =>
          Array.isArray(arr) ? arr.map((v) => (v > noneIdx ? v - 1 : v)) : arr;
        if (q.correct_indices) q.correct_indices = reindex(q.correct_indices);
        if (q.correct) q.correct = reindex(q.correct);
        log.push(`act ${aid} q${qi}: removed authored none at index ${noneIdx}`);
        changed = true;
      }
      c.active_learning_duplicate_none_fix_at = STAMP;
      c.active_learning_duplicate_none_fix_note =
        "Removed authored 'None of the above' choices from lesson-part select_all questions; UI supplies a virtual none option.";
    }

    if (changed) setContent(aid, c);
  }

  // 3. act 89 q4 written: actual_answer + rubric
  const c89 = getContent(89);
  if (c89) {
    const q = (c89.questions || [])[4];
    if (q && q.type === "written") {
      let changed = false;
      if (!q.actual_answer && q.sample_answer) {
        q.actual_answer = q.sample_answer;
        changed = true;
      }
      if (!q.rubric || q.rubric.trim().length < 20) {
        q.rubric =
          "Full credit requires naming, in order, the block's data flow: (1) LayerNorm normalizes each token's hidden vector; " +
          "(2) Q, K, V are produced by learned linear projections of the normalized vector; (3) attention scores = Q.K^T scaled by 1/sqrt(d_k) then softmaxed into weights; " +
          "(4) each token's attention output is a weighted sum of the Value vectors; (5) this output is added back via the first residual connection; " +
          "(6) a second LayerNorm runs on the updated stream; (7) the MLP up-projects d->4d (W1), applies GELU, then down-projects 4d->d (W2), independently per token with no cross-token mixing; " +
          "(8) the MLP output is added via the second residual connection to give the block output of shape L x d. " +
          "Award partial credit for correct pieces; deduct for missing residual connections, missing scaling/softmax, or claiming the MLP mixes across tokens.";
        changed = true;
      }
      if (changed) {
        setContent(89, c89);
        log.push("act 89 q4: added actual_answer + rubric");
      } else {
        log.push("act 89 q4: already has actual_answer + rubric, skipped");
      }
    }
  }
});

tx();
db.close();
console.log(log.length ? log.join("\n") : "No changes needed (idempotent no-op).");
