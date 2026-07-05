/**
 * Rescale Lesson 15 lesson-part synced-visual cue timelines to the REAL audio
 * duration.
 *
 * The cue timelines for activities 85/86/87 were time-mapped to a stale
 * authoring `duration_hint` (358/336/338s) while the generated mp3s are only
 * 272/162/310s (ffprobe). The cues are transcript-derived and correctly ordered
 * (their narrations are the actual spoken lines), but every timestamp runs long,
 * so the visual over-shoots the audio: at act 86 the audio ends at 2:42 while
 * the cue clock still reads ~48% complete. The learner sees the wrong stage at
 * the wrong time (Frank's "MLP delta added too early / cue timing only covers a
 * slice" report).
 *
 * Fix: multiply every cue start/end by realDuration / currentLastCueEnd so the
 * last cue ends exactly at the real audio duration, preserving relative order
 * and transcript alignment. Also pin audio.duration_hint to the real duration.
 * Rendering-compatible schema is untouched (same fields). Monotonic + non-
 * overlapping timestamps are enforced after rounding.
 *
 * Idempotent-ish: skips an activity whose last cue already ends within 2s of the
 * real duration. Snapshot the DB before running (caller does this).
 *
 * Run from repo root under node 22:
 *   node scripts/backfill-lesson15-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";
const REAL_DURATION = { 85: 272, 86: 162, 87: 310 };

const db = new Database(DB_PATH);
const log = [];

const tx = db.transaction(() => {
  for (const aid of [85, 86, 87]) {
    const row = db.prepare("SELECT content FROM lesson_activities WHERE id=?").get(aid);
    if (!row) { log.push(`act ${aid}: MISSING`); continue; }
    const c = JSON.parse(row.content);
    const sv = c.audio?.synced_visual;
    const cues = sv?.cues;
    const real = REAL_DURATION[aid];
    if (!Array.isArray(cues) || cues.length === 0) { log.push(`act ${aid}: no cues`); continue; }

    const lastEnd = cues[cues.length - 1].end ?? cues[cues.length - 1].start ?? 0;
    if (Math.abs(lastEnd - real) <= 2) {
      log.push(`act ${aid}: last cue already ends at ${lastEnd}s (~real ${real}s), skipped`);
      continue;
    }
    const factor = real / lastEnd;

    let prevEnd = 0;
    for (const q of cues) {
      const s = typeof q.start === "number" ? q.start : prevEnd;
      const e = typeof q.end === "number" ? q.end : s;
      let ns = Math.round(s * factor);
      let ne = Math.round(e * factor);
      // enforce monotonic, non-overlapping, positive-length cues
      if (ns < prevEnd) ns = prevEnd;
      if (ne <= ns) ne = ns + 1;
      q.start = ns;
      q.end = ne;
      prevEnd = ne;
    }
    // clamp final cue exactly to real duration
    cues[cues.length - 1].end = real;
    if (cues[cues.length - 1].start >= real) cues[cues.length - 1].start = real - 1;

    c.audio.duration_hint = real;
    sv.cue_timing_rescaled_at = new Date().toISOString();
    sv.cue_timing_rescaled_note =
      `Rescaled cue timeline from ${lastEnd}s span to real audio duration ${real}s (factor ${factor.toFixed(4)}).`;

    db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(JSON.stringify(c), aid);

    // coverage report
    let maxGap = 0;
    for (let i = 1; i < cues.length; i++) {
      const g = cues[i].start - (cues[i - 1].end ?? cues[i - 1].start);
      if (g > maxGap) maxGap = g;
    }
    log.push(
      `act ${aid}: rescaled ${cues.length} cues x${factor.toFixed(4)} -> lastEnd=${cues[cues.length - 1].end}s ` +
      `coverage=${Math.round((100 * cues[cues.length - 1].end) / real)}% maxGap=${maxGap}s dur=${real}`
    );
  }
});

tx();
db.close();
console.log(log.join("\n"));
