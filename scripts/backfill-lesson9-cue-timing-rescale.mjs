/**
 * Re-scale Lesson 9 (Code It From Scratch: PIL, NumPy, and the Preprocessing
 * Pipeline) cue timelines against the REAL segment audio durations.
 *
 * All four segments drifted: their cues were authored as uniform draft blocks
 * (orientation 7 cues span 900s; each lesson_part 3 cues span 180s) while the
 * real MP3s are much longer. Like lessons 2/3/5/7/15, the cue narration text is
 * already the transcript-derived route/section structure, so a proportional
 * scale (uniform factor per segment) is faithful: it keeps the evenly-authored
 * boundaries evenly spaced across the true duration, last cue ending exactly at
 * the real MP3 length.
 *
 *   act 59  orientation_visual.cues   7 cues span 900s -> audio 1008.072s (x1.1201)
 *   act 60  audio.synced_visual.cues  3 cues span 180s -> audio  420.432s (x2.3357)
 *   act 61  audio.synced_visual.cues  3 cues span 180s -> audio  380.280s (x2.1127)
 *   act 62  audio.synced_visual.cues  3 cues span 180s -> audio  442.968s (x2.4609)
 *
 * Monotonic, non-overlapping, last cue ends exactly at the real duration.
 * Snapshot the DB before running (caller does this). Run under node 22:
 *   AVOCADOCORE_DB_PATH=<live> node scripts/backfill-lesson9-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";

const ACTS = [
  { act: 59, path: "orientation_visual", real: 1008.072 },
  { act: 60, path: "audio.synced_visual", real: 420.432 },
  { act: 61, path: "audio.synced_visual", real: 380.280 },
  { act: 62, path: "audio.synced_visual", real: 442.968 },
];

function getCueHolder(content, path) {
  if (path === "orientation_visual") return content.orientation_visual;
  if (path === "audio.synced_visual") {
    return content.audio && content.audio.synced_visual ? content.audio.synced_visual : null;
  }
  return null;
}

const db = new Database(DB_PATH);
const log = [];
const tx = db.transaction(() => {
  for (const { act, path, real } of ACTS) {
    const row = db.prepare("SELECT content FROM lesson_activities WHERE id=?").get(act);
    if (!row) { log.push(`act ${act}: MISSING`); continue; }
    const c = JSON.parse(row.content);
    const holder = getCueHolder(c, path);
    if (!holder || !Array.isArray(holder.cues) || holder.cues.length === 0) {
      log.push(`act ${act}: no ${path}.cues`); continue;
    }
    const cues = holder.cues;
    const oldLast = cues[cues.length - 1].end;
    const factor = real / oldLast;

    let prevEnd = 0;
    for (let i = 0; i < cues.length; i++) {
      const q = cues[i];
      const ns = i === 0 ? 0 : prevEnd;
      let ne = Math.round(q.end * factor * 1000) / 1000;
      if (i === cues.length - 1) ne = real;
      if (ne <= ns) ne = ns + 0.001;
      q.start = ns;
      q.end = ne;
      q.duration = Math.round((ne - ns) * 1000) / 1000;
      prevEnd = ne;
    }

    holder.cue_timing_rescaled_at = new Date().toISOString();
    holder.cue_timing_rescaled_note =
      `Proportionally rescaled ${cues.length} cues (last end ${oldLast}s -> ${real}s, x${factor.toFixed(4)}) to the real segment audio; narration text unchanged (already transcript-derived route/section structure).`;

    db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(JSON.stringify(c), act);

    let maxGap = 0, prev = 0, overlap = false;
    for (const q of cues) {
      if (q.start < prev - 1e-6) overlap = true;
      if (q.start - prev > maxGap) maxGap = q.start - prev;
      prev = q.end;
    }
    log.push(`act ${act} [${path}]: x${factor.toFixed(4)}  lastEnd=${cues.at(-1).end}s (real ${real})  maxGap=${maxGap.toFixed(3)}s  overlap=${overlap}`);
  }
});
tx();
db.close();
console.log(log.join("\n"));
