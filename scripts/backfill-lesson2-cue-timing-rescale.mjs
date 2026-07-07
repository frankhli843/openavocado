/**
 * Re-scale Lesson 2 (Bayes' Theorem in Practice) cue timelines against the REAL
 * segment audio durations.
 *
 * Unlike lesson 5 (whose 5 placeholder cue LABELS did not match the narration and
 * had to be hand re-placed), lesson 2's cue NARRATION text is already
 * transcript-derived per cue — only the timings are uniform draft blocks that end
 * short of the real audio. So, like the lesson-15 script, a proportional scale
 * (uniform factor per segment) is faithful: it keeps the evenly-authored cue
 * boundaries evenly spaced across the true duration, with the last cue ending
 * exactly at the real MP3 length.
 *
 *   act  7  orientation_visual.cues   7 cues  span 900s  -> audio 1014.67s  (×1.1274)
 *   act 10  audio.synced_visual.cues 14 cues  span 240s  -> audio  278.42s  (×1.1601)
 *   act 11  audio.synced_visual.cues 14 cues  span 240s  -> audio  298.18s  (×1.2424)
 *   act 52  audio.synced_visual.cues 14 cues  span 240s  -> audio  280.10s  (×1.1671)
 *
 * Monotonic, non-overlapping, last cue ends exactly at the real duration.
 * Snapshot the DB before running (caller does this). Run under node 22:
 *   AVOCADOCORE_DB_PATH=<live> node scripts/backfill-lesson2-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";

// per-act: which cue array + the REAL audio duration (ffprobe, from storyboard export)
const ACTS = [
  { act: 7, path: "orientation_visual", real: 1014.67 },
  { act: 10, path: "audio.synced_visual", real: 278.42 },
  { act: 11, path: "audio.synced_visual", real: 298.18 },
  { act: 52, path: "audio.synced_visual", real: 280.1 },
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

    // Proportional scale; snap each boundary to 0.001s. Last cue end := real exactly.
    let prevEnd = 0;
    for (let i = 0; i < cues.length; i++) {
      const q = cues[i];
      const ns = i === 0 ? 0 : prevEnd;
      let ne = Math.round(q.end * factor * 1000) / 1000;
      if (i === cues.length - 1) ne = real;
      if (ne <= ns) ne = ns + 0.001; // guard against degenerate windows
      q.start = ns;
      q.end = ne;
      prevEnd = ne;
    }

    holder.cue_timing_rescaled_at = new Date().toISOString();
    holder.cue_timing_rescaled_note =
      `Proportionally rescaled ${cues.length} cues (last end ${oldLast}s → ${real}s, ×${factor.toFixed(4)}) to the real segment audio; narration text unchanged (already transcript-derived).`;

    db.prepare("UPDATE lesson_activities SET content=? WHERE id=?").run(JSON.stringify(c), act);

    // integrity check
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
