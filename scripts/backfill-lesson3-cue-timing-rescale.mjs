/**
 * Re-scale Lesson 3 (Supply, Demand, and Equilibrium) cue timelines against the
 * REAL segment audio durations.
 *
 * Like lessons 2/15, lesson 3's cue narration text is already transcript-derived
 * per cue — only the timings are uniform draft blocks that end short of the real
 * audio. A proportional scale (uniform factor per segment) is faithful: it keeps
 * the evenly-authored cue boundaries evenly spaced across the true duration, with
 * the last cue ending exactly at the real MP3 length.
 *
 *   act 14  orientation_visual.cues   7 cues  span 900s  -> audio 972.96s  (×1.0811)
 *   act 17  audio.synced_visual.cues 14 cues  span 240s  -> audio 274.75s  (×1.1448)
 *   act 18  audio.synced_visual.cues 14 cues  span 240s  -> audio 287.98s  (×1.1999)
 *   act 53  audio.synced_visual.cues 14 cues  span 240s  -> audio 291.70s  (×1.2154)
 *
 * Monotonic, non-overlapping, last cue ends exactly at the real duration.
 * Snapshot the DB before running (caller does this). Run under node 22:
 *   AVOCADOCORE_DB_PATH=<live> node scripts/backfill-lesson3-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";

const ACTS = [
  { act: 14, path: "orientation_visual", real: 972.96 },
  { act: 17, path: "audio.synced_visual", real: 274.75 },
  { act: 18, path: "audio.synced_visual", real: 287.98 },
  { act: 53, path: "audio.synced_visual", real: 291.7 },
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
      prevEnd = ne;
    }

    holder.cue_timing_rescaled_at = new Date().toISOString();
    holder.cue_timing_rescaled_note =
      `Proportionally rescaled ${cues.length} cues (last end ${oldLast}s → ${real}s, ×${factor.toFixed(4)}) to the real segment audio; narration text unchanged (already transcript-derived).`;

    db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(JSON.stringify(c), act);

    let maxGap = 0, prev = 0, overlap = false;
    for (const q of cues) {
      if (q.start < prev - 1e-6) overlap = true;
      if (q.start - prev > maxGap) maxGap = q.start - prev;
      prev = q.end;
    }
    log.push(`act ${act} [${path}]: ×${factor.toFixed(4)}  lastEnd=${cues.at(-1).end}s (real ${real})  maxGap=${maxGap.toFixed(3)}s  overlap=${overlap}`);
  }
});
tx();
db.close();
console.log(log.join("\n"));
