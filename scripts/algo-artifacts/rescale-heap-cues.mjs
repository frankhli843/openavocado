// Rescale lesson 17 synced-visual cues + duration_hint to the REAL generated
// audio durations (from generated_artifacts), then re-validate the lesson-part
// synced visuals. Idempotent: rescales relative to the stored duration_hint.
import Database from "better-sqlite3";

const db = new Database("data/avocadocore.db");

function realDuration(activityId) {
  const row = db
    .prepare("SELECT duration_sec FROM generated_artifacts WHERE activity_id=? AND artifact_type='audio' ORDER BY id DESC LIMIT 1")
    .get(activityId);
  return row ? Number(row.duration_sec) : null;
}

function rescaleVisual(visual, oldHint, real) {
  const factor = real / oldHint;
  const cues = visual.cues;
  cues.forEach((c, i) => {
    c.start = Math.max(0, Math.round(c.start * factor * 10) / 10);
    if (c.end !== undefined) c.end = Math.round(c.end * factor * 10) / 10;
    if (i > 0 && c.start < cues[i - 1].start) c.start = cues[i - 1].start;
  });
  // Clamp the final cue's end to the real duration so coverage is exact.
  const last = cues[cues.length - 1];
  last.end = Math.round(real * 10) / 10;
  return visual;
}

const acts = db.prepare("SELECT id, activity_type, content FROM lesson_activities WHERE lesson_id=19 ORDER BY sequence_order").all();
const tx = db.transaction(() => {
  for (const a of acts) {
    const content = JSON.parse(a.content);
    let real, visual, hintPath;
    if (a.activity_type === "audio") {
      real = realDuration(a.id);
      visual = content.orientation_visual;
      hintPath = () => (content.duration_hint = real);
    } else if (a.activity_type === "lesson_part") {
      real = realDuration(a.id);
      visual = content.audio?.synced_visual;
      hintPath = () => (content.audio.duration_hint = real);
    } else continue;
    if (!real || !visual) continue;
    const oldHint = content.duration_hint ?? content.audio?.duration_hint ?? real;
    rescaleVisual(visual, oldHint, real);
    hintPath();
    db.prepare("UPDATE lesson_activities SET content=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(content), a.id);
    console.log(`activity ${a.id} (${a.activity_type}): duration_hint -> ${real}s, last cue ends ${visual.cues[visual.cues.length - 1].end}s`);
  }
});
tx();
db.close();
console.log("rescale done");
