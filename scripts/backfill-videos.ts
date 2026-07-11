#!/usr/bin/env tsx
/**
 * backfill-videos.ts — resumable state manager for the Phase 4 video backfill.
 *
 * The per-lesson Manim scene authoring + frame-review loop is creative agent
 * work and CANNOT be scripted; this tool is the durable, resumable ORCHESTRATION
 * layer around it so the backfill can run as a long-lived Dora workstream with
 * ONE lesson in flight at a time (never one giant session). It:
 *   - enumerates published lessons (queued/in_progress/completed) in sequence
 *     order, skipping any already fully converted (audit:videos --lesson passes);
 *   - persists an ordered, resumable queue with per-lesson/segment status to
 *     runtime_artifacts/videos/backfill-state.json;
 *   - exports storyboards for the next lesson and runs a cue-timing sanity check
 *     (last cue end ~ MP3 duration) so a drifted lesson is flagged before authoring;
 *   - gates a lesson "done" only when `audit:videos --lesson <id> --strict` passes.
 *
 * Subcommands:
 *   status            — print the queue and per-lesson progress.
 *   next              — pick the next pending lesson, export its storyboards, run
 *                       the cue-timing sanity check, mark it in_flight, and print
 *                       the segment worklist for the authoring agent.
 *   complete <lesson> — run the strict per-lesson audit; on pass mark done and
 *                       advance; on fail print the audit errors and keep it in_flight.
 *   reset <lesson>    — clear a lesson back to pending (e.g. to re-author).
 *
 * Env: AVOCADOCORE_DB_PATH, AVOCADOCORE_RUNTIME_ROOT, MANIM_REVIEW_ROOT.
 * Requires: better-sqlite3 under node 22; tsx; ffprobe (via audit/export).
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import Database from "better-sqlite3";

const dbPath = process.env.AVOCADOCORE_DB_PATH ?? "data/avocadocore.db";
const runtimeRoot = process.env.AVOCADOCORE_RUNTIME_ROOT ?? process.cwd();
const reviewRoot = process.env.MANIM_REVIEW_ROOT ?? process.cwd();
const STATE = path.join(runtimeRoot, "runtime_artifacts", "videos", "backfill-state.json");

const cmd = process.argv[2] ?? "status";
const arg = process.argv[3];

const db = new Database(dbPath, { readonly: true });

type Seg = { activity_id: number; activity_type: string; audio_dur: number; audio_path: string };
type LessonState = {
  lesson_id: number;
  title: string;
  sequence: number;
  status: "pending" | "in_flight" | "done";
  segments: number[];
  cue_timing_ok?: boolean | null;
  note?: string;
};

// A segment with 0 cues carries a declarative/interactive widget, not a synced
// cue timeline, so it is not a Manim-video candidate (matches export-storyboard's
// skip and the audit's exclusion). Filter these out so the worklist and per-lesson
// segment set only contain authorable, cue-bearing segments.
function contentCueCount(content: string | null, activityType: string): number {
  if (!content) return 0;
  try {
    const c = JSON.parse(content) as Record<string, any>;
    const cues =
      activityType === "audio" ? c?.orientation_visual?.cues : c?.audio?.synced_visual?.cues;
    return Array.isArray(cues) ? cues.length : 0;
  } catch {
    return 0;
  }
}

function lessonSegments(lessonId: number): Seg[] {
  const rows = db
    .prepare(
      `select g.activity_id, la.activity_type, g.duration_sec audio_dur, g.file_path audio_path, la.content
       from generated_artifacts g
       join lesson_activities la on la.id = g.activity_id
       where g.artifact_type = 'audio' and la.activity_type in ('audio','lesson_part') and la.lesson_id = ?
       order by g.activity_id`
    )
    .all(lessonId) as Array<Seg & { content: string | null }>;
  return rows
    .filter((r) => contentCueCount(r.content, r.activity_type) > 0)
    .map(({ content, ...seg }) => seg);
}

function publishedLessons(): LessonState[] {
  const rows = db
    .prepare(
      `select l.id lesson_id, l.title,
              min(la.sequence_order) sequence
       from lessons l join lesson_activities la on la.lesson_id = l.id
       where l.status in ('queued','in_progress','completed')
       group by l.id
       order by sequence, l.id`
    )
    .all() as Array<{ lesson_id: number; title: string; sequence: number }>;
  return rows
    .map((r) => ({
      lesson_id: r.lesson_id,
      title: (r.title ?? "").slice(0, 60),
      sequence: r.sequence ?? r.lesson_id,
      status: "pending" as const,
      segments: lessonSegments(r.lesson_id).map((s) => s.activity_id),
    }))
    .filter((l) => l.segments.length > 0);
}

function loadState(): { lessons: LessonState[]; updated_at: string | null } {
  if (fs.existsSync(STATE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE, "utf8"));
    } catch {
      /* fall through to rebuild */
    }
  }
  return { lessons: [], updated_at: null };
}

function saveState(state: { lessons: LessonState[]; updated_at: string | null }) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
}

/** Reconcile persisted state with the current DB + audit truth. */
function reconcile(): { lessons: LessonState[]; updated_at: string | null } {
  const state = loadState();
  const live = publishedLessons();
  const byId = new Map(state.lessons.map((l) => [l.lesson_id, l]));
  const merged: LessonState[] = live.map((l) => {
    const prev = byId.get(l.lesson_id);
    const cur: LessonState = prev
      ? { ...l, status: prev.status, cue_timing_ok: prev.cue_timing_ok, note: prev.note }
      : l;
    // truth-check: if the strict per-lesson audit passes, it's done regardless of prior state
    if (auditLessonPasses(l.lesson_id)) cur.status = "done";
    else if (cur.status === "done") cur.status = "in_flight"; // regressed
    return cur;
  });
  return { lessons: merged, updated_at: state.updated_at };
}

function auditLessonPasses(lessonId: number): boolean {
  try {
    execFileSync(
      "node_modules/.bin/tsx",
      ["scripts/audit-videos.ts", "--lesson", String(lessonId)],
      { stdio: "ignore", env: { ...process.env } }
    );
    return true;
  } catch {
    return false;
  }
}

function cueTimingSanity(lessonId: number): boolean | null {
  const segs = lessonSegments(lessonId);
  let allOk = true;
  let checked = false;
  for (const s of segs) {
    const sbPath = path.join(reviewRoot, "manim", "storyboards", `lesson_${lessonId}`, `segment_${s.activity_id}.json`);
    if (!fs.existsSync(sbPath)) return null; // storyboards not exported yet
    checked = true;
    try {
      const sb = JSON.parse(fs.readFileSync(sbPath, "utf8"));
      const cues = sb.cues ?? sb.segments ?? [];
      const last = cues[cues.length - 1];
      const lastEnd = Number(last?.end ?? last?.end_sec ?? 0);
      if (Math.abs(lastEnd - s.audio_dur) > 2.0) allOk = false; // >2s drift
    } catch {
      allOk = false;
    }
  }
  return checked ? allOk : null;
}

function exportStoryboards(lessonId: number) {
  execFileSync("node_modules/.bin/tsx", ["scripts/export-storyboard.ts", String(lessonId)], {
    stdio: "inherit",
    env: { ...process.env },
  });
}

const state = reconcile();
const pending = state.lessons.filter((l) => l.status !== "done");
const done = state.lessons.filter((l) => l.status === "done");

if (cmd === "status") {
  console.log(`backfill state: ${STATE}`);
  console.log(`lessons: ${state.lessons.length}  done: ${done.length}  remaining: ${pending.length}`);
  for (const l of state.lessons) {
    const flag = l.status === "done" ? "✓" : l.status === "in_flight" ? "▶" : "·";
    console.log(`  ${flag} lesson ${l.lesson_id} [seq ${l.sequence}] ${l.segments.length} seg — ${l.title}`);
  }
  saveState({ lessons: state.lessons, updated_at: state.updated_at });
} else if (cmd === "next") {
  const inFlight = state.lessons.find((l) => l.status === "in_flight");
  // Prefer the smallest still-pending lesson (fewest cue-bearing segments), then
  // sequence, then id. This implements the acceptance's explicit ordering: do the
  // shorter, single-segment lessons first to keep each session small and to build
  // a library of reusable scene idioms before the multi-segment lessons. Ties fall
  // back to the natural sequence/id order so the walk is deterministic.
  const nextPending = pending
    .filter((l) => l.status === "pending")
    .sort(
      (a, b) =>
        a.segments.length - b.segments.length ||
        a.sequence - b.sequence ||
        a.lesson_id - b.lesson_id
    )[0];
  const target = inFlight ?? nextPending;
  if (!target) {
    console.log("backfill complete — no pending lessons.");
  } else {
    target.status = "in_flight";
    console.log(`next lesson: ${target.lesson_id} — ${target.title}`);
    console.log("exporting storyboards…");
    exportStoryboards(target.lesson_id);
    const cueOk = cueTimingSanity(target.lesson_id);
    target.cue_timing_ok = cueOk;
    console.log(`cue-timing sanity: ${cueOk === null ? "n/a" : cueOk ? "ok" : "DRIFTED (>2s) — rescale cues before authoring"}`);
    const segs = lessonSegments(target.lesson_id);
    console.log("segment worklist (author Manim scenes, -ql review loop, final render, mux, captions, register):");
    for (const s of segs)
      console.log(`  activity ${s.activity_id} (${s.activity_type}) audio ${s.audio_dur.toFixed(1)}s`);
    saveState({ lessons: state.lessons, updated_at: new Date(0).toISOString() });
  }
} else if (cmd === "complete") {
  const lid = Number(arg);
  const l = state.lessons.find((x) => x.lesson_id === lid);
  if (!l) {
    console.error(`lesson ${lid} not in backfill queue`);
    process.exitCode = 2;
  } else if (auditLessonPasses(lid)) {
    l.status = "done";
    console.log(`lesson ${lid} DONE (strict audit passed).`);
    saveState({ lessons: state.lessons, updated_at: state.updated_at });
  } else {
    console.error(`lesson ${lid} NOT complete — strict audit failed. Run: pnpm audit:videos --lesson ${lid}`);
    process.exitCode = 1;
  }
} else if (cmd === "reset") {
  const lid = Number(arg);
  const l = state.lessons.find((x) => x.lesson_id === lid);
  if (l) {
    l.status = "pending";
    l.cue_timing_ok = null;
    saveState({ lessons: state.lessons, updated_at: state.updated_at });
    console.log(`lesson ${lid} reset to pending.`);
  }
} else {
  console.error("usage: backfill-videos.ts status|next|complete <lesson>|reset <lesson>");
  process.exitCode = 2;
}
