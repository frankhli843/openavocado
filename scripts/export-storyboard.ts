#!/usr/bin/env tsx
/**
 * export-storyboard.ts <lesson_id>
 *
 * Reads the DB and writes ONE storyboard JSON per audio segment of a lesson to
 * manim/storyboards/lesson_<id>/segment_<activity>.json. The storyboard is the
 * ready-made 3b1b shot list: the existing cue timelines (already rescaled to the
 * real MP3) become one authored Manim chunk per cue.
 *
 * Segment sources:
 *   - orientation (activity_type='audio'):     content.orientation_visual.cues[]
 *   - lesson_part (activity_type='lesson_part'): content.audio.synced_visual.cues[]
 * Audio (file_path + duration_sec) comes from the generated_artifacts row.
 * LaTeX candidates come from content.reading.blocks[].latex plus inline $...$.
 *
 * Env: AVOCADOCORE_DB_PATH (default data/avocadocore.db). Run from the repo root
 * (or the worktree with AVOCADOCORE_DB_PATH pointed at the live DB).
 *
 * Usage: tsx scripts/export-storyboard.ts 15
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dbPath = process.env.AVOCADOCORE_DB_PATH ?? "data/avocadocore.db";
const lessonId = Number(process.argv[2]);
if (!Number.isInteger(lessonId)) {
  console.error("usage: tsx scripts/export-storyboard.ts <lesson_id>");
  process.exit(2);
}

const OUT_ROOT = path.join(__dirname, "..", "manim", "storyboards", `lesson_${lessonId}`);

type Cue = {
  index: number;
  start: number;
  end: number;
  duration: number;
  label: string;
  headline: string;
  narration: string;
  active_elements?: unknown;
};

type Segment = {
  lesson_id: number;
  activity_id: number;
  activity_type: string;
  title: string;
  audio: { file_path: string | null; duration_sec: number | null };
  audio_source: "artifact" | "content-hint" | "none";
  cue_source: string;
  cues: Cue[];
  cue_span_sec: number;
  formulas: string[];
  exported_at: string;
};

const db = new Database(dbPath, { readonly: true });

type ActivityRow = {
  id: number;
  activity_type: string;
  title: string;
  content: string | null;
  sequence_order: number;
};

const activities = db
  .prepare(
    `SELECT id, activity_type, title, content, sequence_order
       FROM lesson_activities
      WHERE lesson_id = ? AND activity_type IN ('audio', 'lesson_part')
      ORDER BY sequence_order`
  )
  .all(lessonId) as ActivityRow[];

if (activities.length === 0) {
  console.error(`No audio/lesson_part activities found for lesson ${lessonId}`);
  process.exit(1);
}

function normalizeCues(raw: unknown[]): Cue[] {
  return (raw ?? [])
    .map((c, i) => {
      const cue = c as Record<string, unknown>;
      const start = Number(cue.start ?? 0);
      const end = Number(cue.end ?? start);
      return {
        index: i,
        start,
        end,
        duration: Math.max(0, Number((end - start).toFixed(3))),
        label: String(cue.label ?? ""),
        headline: String(cue.headline ?? cue.label ?? ""),
        narration: String(cue.narration ?? ""),
        active_elements: cue.active_elements,
      } as Cue;
    })
    .filter((c) => c.end > c.start);
}

function rescaleCuesToAudio(cues: Cue[], audioDur: number | null): { cues: Cue[]; scaled: boolean } {
  if (!Number.isFinite(audioDur) || audioDur == null || audioDur <= 0 || cues.length === 0) {
    return { cues, scaled: false };
  }
  const firstStart = cues[0].start;
  const lastEnd = cues[cues.length - 1].end;
  const span = lastEnd - firstStart;
  if (!Number.isFinite(span) || span <= 0) return { cues, scaled: false };

  const drift = Math.abs(span - audioDur);
  if (drift <= 2) return { cues, scaled: false };

  const scale = audioDur / span;
  let cursor = 0;
  const scaled = cues.map((cue, index) => {
    const originalDuration = Math.max(0, cue.end - cue.start);
    const duration =
      index === cues.length - 1 ? Math.max(0, audioDur - cursor) : Number((originalDuration * scale).toFixed(3));
    const start = Number(cursor.toFixed(3));
    const end = Number((cursor + duration).toFixed(3));
    cursor = end;
    return {
      ...cue,
      index,
      start,
      end,
      duration: Number((end - start).toFixed(3)),
    };
  });

  return { cues: scaled, scaled: true };
}

function extractFormulas(content: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const reading = content.reading as Record<string, unknown> | undefined;
  const blocks = (reading?.blocks as Array<Record<string, unknown>>) ?? [];
  for (const b of blocks) {
    if (typeof b.latex === "string" && b.latex.trim()) out.add(b.latex.trim());
    // Some blocks embed inline math in their content.
    if (typeof b.content === "string") {
      for (const m of b.content.matchAll(/\$([^$]{2,})\$/g)) out.add(m[1].trim());
    }
  }
  // Orientation formula panels sometimes live under presentation/scene text.
  const ov = content.orientation_visual as Record<string, unknown> | undefined;
  if (ov && typeof ov.description === "string") {
    for (const m of ov.description.matchAll(/\$([^$]{2,})\$/g)) out.add(m[1].trim());
  }
  return [...out];
}

function audioArtifact(activityId: number): { file_path: string | null; duration_sec: number | null } {
  const row = db
    .prepare(
      `SELECT file_path, duration_sec FROM generated_artifacts
        WHERE activity_id = ? AND artifact_type = 'audio'
        ORDER BY generated_at DESC LIMIT 1`
    )
    .get(activityId) as { file_path: string | null; duration_sec: number | null } | undefined;
  return { file_path: row?.file_path ?? null, duration_sec: row?.duration_sec ?? null };
}

fs.mkdirSync(OUT_ROOT, { recursive: true });

const written: string[] = [];
for (const act of activities) {
  const content = act.content ? (JSON.parse(act.content) as Record<string, unknown>) : {};
  let cues: Cue[] = [];
  let cueSource = "none";
  if (act.activity_type === "audio") {
    const ov = content.orientation_visual as Record<string, unknown> | undefined;
    cues = normalizeCues((ov?.cues as unknown[]) ?? []);
    cueSource = "orientation_visual.cues";
  } else {
    const audio = content.audio as Record<string, unknown> | undefined;
    const sv = audio?.synced_visual as Record<string, unknown> | undefined;
    cues = normalizeCues((sv?.cues as unknown[]) ?? []);
    cueSource = "audio.synced_visual.cues";
  }

  const art = audioArtifact(act.id);
  let audioFile = art.file_path;
  let audioDur = art.duration_sec;
  let audioSourceKind: Segment["audio_source"] = art.file_path ? "artifact" : "none";
  if (!audioFile) {
    // Fall back to content hint (duration only) so the storyboard is still usable.
    const hint =
      (content.duration_hint as number | undefined) ??
      ((content.audio as Record<string, unknown>)?.duration_hint as number | undefined);
    if (hint) {
      audioDur = Number(hint);
      audioSourceKind = "content-hint";
    }
  }

  if (cues.length === 0) {
    console.warn(`  ! activity ${act.id} (${act.activity_type}) has no cues — skipping storyboard`);
    continue;
  }

  const rescaled = rescaleCuesToAudio(cues, audioDur);
  cues = rescaled.cues;

  const cueSpan = cues[cues.length - 1].end - cues[0].start;
  const seg: Segment = {
    lesson_id: lessonId,
    activity_id: act.id,
    activity_type: act.activity_type,
    title: act.title,
    audio: { file_path: audioFile, duration_sec: audioDur },
    audio_source: audioSourceKind,
    cue_source: cueSource,
    cues,
    cue_span_sec: Number(cueSpan.toFixed(3)),
    formulas: extractFormulas(content),
    exported_at: new Date().toISOString(),
  };

  const outPath = path.join(OUT_ROOT, `segment_${act.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(seg, null, 2));
  written.push(outPath);

  // Cue-timing sanity check (acceptance: last cue end ≈ MP3 duration).
  const drift = audioDur != null ? Math.abs(seg.cue_span_sec - audioDur) : null;
  const driftFlag =
    drift != null && drift > 2
      ? `  ⚠ DRIFT ${drift.toFixed(1)}s vs audio`
      : rescaled.scaled
        ? "  rescaled cues to audio"
        : "";
  console.log(
    `  ✓ activity ${act.id} (${act.activity_type}): ${cues.length} cues, span ${seg.cue_span_sec}s, ` +
      `audio ${audioDur ?? "?"}s [${audioSourceKind}], ${seg.formulas.length} formulas${driftFlag}`
  );
}

console.log(`Wrote ${written.length} storyboard(s) to ${OUT_ROOT}`);
db.close();
