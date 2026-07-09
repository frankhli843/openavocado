/**
 * Re-cue + rescale Lesson 11 "Fingerpicking Fundamentals" synced-visual cue
 * timelines to the REAL audio duration AND real lesson content.
 *
 * Unlike the L2/L3/L15 rescales (whose cue narrations were already
 * transcript-derived and only needed proportional stretching), Lesson 11's DB
 * cues were generic placeholder skeletons emitted by the Gemini prodavo
 * generator: labels like "Input / Transform / Handoff" and narrations like
 * "The visual starts by naming the object entering Fingerpicking Fundamentals".
 * They also drift badly (orientation span 900s vs 1020.19s audio; each part
 * span 180s vs ~320-337s audio). A plain proportional stretch would just
 * lengthen placeholder text, so this script REPLACES each cue's boundaries,
 * label, headline, narration, and active_elements with content-specific values
 * derived from the real spoken transcript (activity scripts 66/67/68/69), while
 * preserving cue count and every other field of the cue object.
 *
 * The new boundaries divide the real audio duration evenly across the existing
 * cue count (orientation 7, each part 3), which matches the established
 * one-staged-diagram-per-cue Manim authoring pattern for these backfill videos.
 * Monotonic, non-overlapping, last-cue-ends-at-real-duration is enforced.
 *
 * Idempotent: skips an activity whose cue0 label already matches the new content
 * (so re-runs after a partial write are safe). Snapshot the DB before running
 * (caller does this: data/backups/avocadocore.db.pre-l11-recue.*).
 *
 * Run from repo root under node 22:
 *   AVOCADOCORE_DB_PATH=<live>/data/avocadocore.db \
 *     node scripts/backfill-lesson11-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";

// Real audio durations (ffprobe / artifact duration_sec).
const REAL_DURATION = { 66: 1020.19, 67: 319.44, 68: 330.53, 69: 337.13 };

// New content-specific cues per activity (boundaries filled in below by even
// division across the real duration; only label/headline/narration/active are
// authored here in cue order).
const CONTENT = {
  66: [
    { label: "Why separate the jobs",
      headline: "Thumb and fingers stop competing",
      narration: "Fingerpicking splits the thumb and finger jobs so they stop competing: the thumb keeps a steady bass pulse while the fingers place melody and chord tones above it.",
      active: ["thumb: bass pulse", "fingers: melody"] },
    { label: "Follow one object",
      headline: "A repeating pattern split bass vs melody",
      narration: "Follow one object: a repeating picking pattern split between bass and melody strings. Think of a small band in one hand: the thumb is the bass player, the index, middle and ring fingers are the upper voices.",
      active: ["bass strings", "melody strings"] },
    { label: "A tiny concrete example",
      headline: "Thumb alternates, fingers fill the gaps",
      narration: "On a simple pattern the thumb alternates between two bass strings while the index and middle fingers pluck the higher strings in the gaps between thumb notes.",
      active: ["thumb alternates", "fingers between"] },
    { label: "The mechanism, step by step",
      headline: "Anchor, assign, then grow the pattern",
      narration: "Anchor the picking hand relaxed, assign the thumb to bass strings and the fingers to treble strings, then grow the pattern: thumb pulse alone, add one finger note, add the rest slowly.",
      active: ["anchor + assign", "grow slowly"] },
    { label: "Read it as rhythm",
      headline: "Count beats, not symbols",
      narration: "Read the pattern as rhythm, not algebra: count where the thumb lands and where the finger notes fit between those beats. The test is whether the thumb pulse stays even when a finger note is added or removed.",
      active: ["thumb beats", "finger offbeats"] },
    { label: "The common mistake",
      headline: "Do not move the fingers as one clump",
      narration: "The common mistake is moving every finger as one clump. Independence comes from giving each digit a predictable role, so the thumb's motion never disturbs the fingers.",
      active: ["one clump: wrong", "independent roles"] },
    { label: "Division of labor",
      headline: "A steady bass, flexible upper voices",
      narration: "Fingerpicking is not random plucking: it is a division of labor between a steady bass role and flexible upper voices. That is the model to carry into the practice that follows.",
      active: ["steady bass", "flexible voices"] },
  ],
  67: [
    { label: "One chord, two textures",
      headline: "Strum it, then unfold it in time",
      narration: "Hold an A minor chord. Strum it and every string rings at once, a single wall of sound. Pluck the strings one at a time and the same chord unfolds, each note getting its own moment in time.",
      active: ["strum: all at once", "pluck: one at a time"] },
    { label: "Vertical vs horizontal",
      headline: "Texture is how notes sit in time",
      narration: "Texture is how notes are arranged in time. Strumming is vertical: all notes at the same moment. Fingerpicking is horizontal: the same pitches spread across time, giving a completely different character.",
      active: ["vertical: simultaneous", "horizontal: sequential"] },
    { label: "Two instruments at once",
      headline: "Bass line under an independent melody",
      narration: "Horizontal texture lets the thumb hold a bass line while the fingers carry the melody, independently. That is the guitar's famous two-instruments-at-once effect, and a single pick cannot produce it.",
      active: ["thumb: bass line", "fingers: melody"] },
  ],
  68: [
    { label: "PIMA: Spanish names",
      headline: "Four letters name the picking hand",
      narration: "PIMA names each right-hand picking finger from Spanish: p is pulgar, the thumb; i is índice, the index; m is medio, the middle; a is anular, the ring. Four letters, the alphabet of fingerpicking.",
      active: ["p pulgar", "i m a"] },
    { label: "Each finger owns a region",
      headline: "One finger, one string region",
      narration: "Each finger is assigned to a string region: p covers the bass strings six, five and four; i plays string three; m plays string two; a plays string one.",
      active: ["p: 6/5/4", "i:3 m:2 a:1"] },
    { label: "Why this split works",
      headline: "Strong thumb below, light fingers above",
      narration: "The thumb is the strongest digit and reaches the wound bass strings without disturbing the others; the three lighter fingers sit naturally above the treble strings. The thumb is the foundation, the fingers carry the melody.",
      active: ["thumb: foundation", "fingers: treble"] },
  ],
  69: [
    { label: "What an arpeggio is",
      headline: "A chord played one note at a time",
      narration: "An arpeggio is a chord played in sequence, its notes unfolded one at a time instead of together. The word comes from the Italian arpeggiare, to play as a harp.",
      active: ["chord", "unfolded in sequence"] },
    { label: "The p-i-m-a cycle on Am",
      headline: "Thumb root, then i-m-a on 3-2-1",
      narration: "Hold A minor. The thumb, p, plucks string five, the A root; then i plucks string three, m plucks string two, and a plucks string one. Four notes, one cycle, then repeat.",
      active: ["p: string 5 root", "i:3 m:2 a:1"] },
    { label: "Keep the thumb independent",
      headline: "Bass reaches while fingers stay home",
      narration: "While the thumb reaches down for the bass string, i, m and a stay lightly on their treble strings. The motions do not interfere, and that independence is what makes the pattern musical instead of mechanical.",
      active: ["thumb independent", "fingers steady"] },
  ],
};

const db = new Database(DB_PATH);
const log = [];

function evenBoundaries(n, total) {
  // n cues spanning [0, total], each ~ total/n, last ends exactly at total.
  const b = [];
  for (let i = 0; i < n; i++) {
    const start = Math.round((total * i) / n);
    let end = i === n - 1 ? Math.round(total) : Math.round((total * (i + 1)) / n);
    b.push([start, end]);
  }
  // enforce monotonic non-overlap + positive length
  for (let i = 1; i < b.length; i++) {
    if (b[i][0] < b[i - 1][1]) b[i][0] = b[i - 1][1];
    if (b[i][1] <= b[i][0]) b[i][1] = b[i][0] + 1;
  }
  return b;
}

const tx = db.transaction(() => {
  for (const aid of [66, 67, 68, 69]) {
    const row = db.prepare("SELECT content FROM lesson_activities WHERE id=?").get(aid);
    if (!row) { log.push(`act ${aid}: MISSING`); continue; }
    const c = JSON.parse(row.content);
    const isOrientation = aid === 66;
    const sv = isOrientation ? c.orientation_visual : c.audio?.synced_visual;
    if (!sv || !Array.isArray(sv.cues)) { log.push(`act ${aid}: no cues container`); continue; }
    const cues = sv.cues;
    const content = CONTENT[aid];
    const real = REAL_DURATION[aid];

    if (cues.length !== content.length) {
      log.push(`act ${aid}: cue count ${cues.length} != content ${content.length} — SKIPPED (manual check)`);
      continue;
    }
    if (cues[0]?.label === content[0].label) {
      log.push(`act ${aid}: already re-cued (cue0 label matches), skipped`);
      continue;
    }

    const bounds = evenBoundaries(cues.length, real);
    for (let i = 0; i < cues.length; i++) {
      const q = cues[i];
      const [s, e] = bounds[i];
      q.index = i;
      q.start = s;
      q.end = e;
      q.duration = e - s;
      q.label = content[i].label;
      q.headline = content[i].headline;
      q.narration = content[i].narration;
      q.active_elements = content[i].active;
    }
    // Pin duration_hint to the real audio so the legacy fallback timeline matches.
    if (isOrientation) {
      c.duration_hint = real;
    } else if (c.audio) {
      c.audio.duration_hint = real;
    }
    db.prepare("UPDATE lesson_activities SET content=? WHERE id=?")
      .run(JSON.stringify(c), aid);
    const last = cues[cues.length - 1];
    log.push(`act ${aid}: re-cued ${cues.length} cues, last ends ${last.end}s (real ${real}s), duration_hint=${real}`);
  }
});

tx();
db.close();
for (const l of log) console.log(l);
