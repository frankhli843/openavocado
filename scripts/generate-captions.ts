#!/usr/bin/env tsx
/**
 * generate-captions.ts <lesson_id> <activity_id>
 *
 * Turns a segment storyboard's cue narration into a WebVTT caption file, one
 * cue → one caption line, timed to the cue's start/end. Written to the live
 * runtime video dir next to the MP4:
 *   runtime_artifacts/videos/lesson_<id>/activity_<activity>.vtt
 *
 * A free accessibility win: the narration text is already timed against the
 * real audio, so captions line up with both audio and the baked-in highlights.
 *
 * Env: AVOCADOCORE_RUNTIME_ROOT (default <repo>/runtime_artifacts) — the
 * runtime_artifacts root (point at the live artifact tree while in a worktree).
 *
 * Usage: tsx scripts/generate-captions.ts 15 85
 */
import fs from "fs";
import path from "path";

const lessonId = Number(process.argv[2]);
const activityId = Number(process.argv[3]);
if (!Number.isInteger(lessonId) || !Number.isInteger(activityId)) {
  console.error("usage: tsx scripts/generate-captions.ts <lesson_id> <activity_id>");
  process.exit(2);
}

const RUNTIME_ROOT =
  process.env.AVOCADOCORE_RUNTIME_ROOT ?? path.join(process.cwd(), "runtime_artifacts");
const storyboardPath = path.join(
  __dirname,
  "..",
  "manim",
  "storyboards",
  `lesson_${lessonId}`,
  `segment_${activityId}.json`
);
if (!fs.existsSync(storyboardPath)) {
  console.error(`Storyboard not found: ${storyboardPath}. Run export-storyboard first.`);
  process.exit(1);
}

type Cue = { index: number; start: number; end: number; narration: string; headline: string };
const seg = JSON.parse(fs.readFileSync(storyboardPath, "utf8")) as {
  cues: Cue[];
  audio: { duration_sec: number | null };
};

function ts(seconds: number): string {
  const s = Math.max(0, seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}.${pad(ms, 3)}`;
}

function wrapNarration(text: string, maxLen = 42): string {
  // Split long narration onto <=2 lines for readable captions.
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  const words = clean.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    if ((line + " " + w).trim().length > maxLen && line) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
    if (lines.length === 1 && line.length > maxLen) {
      lines.push(line.trim());
      line = "";
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 2).join("\n");
}

const outDir = path.join(RUNTIME_ROOT, "videos", `lesson_${lessonId}`);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `activity_${activityId}.vtt`);

const parts: string[] = ["WEBVTT", ""];
for (const cue of seg.cues) {
  const text = wrapNarration(cue.narration || cue.headline || "");
  if (!text) continue;
  parts.push(`${cue.index + 1}`);
  parts.push(`${ts(cue.start)} --> ${ts(cue.end)}`);
  parts.push(text);
  parts.push("");
}

fs.writeFileSync(outPath, parts.join("\n"));
const relPath = path.join("runtime_artifacts", path.relative(RUNTIME_ROOT, outPath));
console.log(`Wrote ${seg.cues.length} captions → ${relPath}`);
