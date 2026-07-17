// Proportionally rescale a lesson's storyboard cue timelines so the last cue
// ends exactly at the segment's real audio duration. render-segment.sh muxes
// with -shortest and hard-fails if the concatenated video (== sum of cue
// windows) differs from the audio by >0.5s, so cue windows must total audio.
// Usage: tsx scripts/fit-storyboard-to-audio.ts <lessonId>
import fs from "fs";
import path from "path";

const lessonId = Number(process.argv[2]);
if (!Number.isInteger(lessonId)) { console.error("usage: fit-storyboard-to-audio.ts <lessonId>"); process.exit(2); }
const dir = path.join(__dirname, "..", "manim", "storyboards", `lesson_${lessonId}`);
for (const file of fs.readdirSync(dir).filter((f) => f.startsWith("segment_") && f.endsWith(".json"))) {
  const p = path.join(dir, file);
  const d = JSON.parse(fs.readFileSync(p, "utf-8"));
  const audioDur = d.audio?.duration_sec;
  const cues = d.cues ?? [];
  if (!audioDur || cues.length === 0) { console.log(`${file}: no audio/cues, skip`); continue; }
  const span = cues[cues.length - 1].end;
  const factor = audioDur / span;
  for (const c of cues) {
    c.start = Number((c.start * factor).toFixed(3));
    c.end = Number((c.end * factor).toFixed(3));
    c.duration = Number((c.end - c.start).toFixed(3));
  }
  // Pin the last cue end exactly to audioDur (kill rounding residue).
  cues[cues.length - 1].end = Number(audioDur.toFixed(3));
  cues[cues.length - 1].duration = Number((cues[cues.length - 1].end - cues[cues.length - 1].start).toFixed(3));
  d.cue_span_sec = Number(audioDur.toFixed(3));
  fs.writeFileSync(p, JSON.stringify(d, null, 2));
  console.log(`${file}: span ${span}s -> ${audioDur}s (x${factor.toFixed(4)}), ${cues.length} cues [${cues.map((c: any) => c.duration.toFixed(1)).join(", ")}]`);
}
