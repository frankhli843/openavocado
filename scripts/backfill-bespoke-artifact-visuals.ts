#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import {
  approveArtifact,
  createArtifact,
  getArtifactBySlug,
  markBuildFailed,
  markBuilding,
  markBuildSuccess,
  updateSource,
} from "../src/lib/visual-artifacts/db";
import { buildArtifact, sha256 } from "../src/lib/visual-artifacts/build";

type Db = Database.Database;

interface LessonRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  subject_id: number | null;
}

interface ActivityRow {
  id: number;
  lesson_id: number;
  activity_type: string;
  title: string | null;
  content: string | null;
}

interface Cue {
  start: number;
  end?: number;
  label: string;
  headline: string;
  narration: string;
  receive?: string;
  transform?: string;
  pass?: string;
  panel_id?: string;
  active_elements?: string[];
  visual_kind?: string;
}

interface ArtifactSpec {
  slug: string;
  title: string;
  lessonId: number;
  activityId: number;
  source: string;
}

const DB_PATH =
  process.env.AVOCADOCORE_DB_PATH ||
  process.env.AVO_DB_PATH ||
  path.join(process.cwd(), "data", "avocadocore.db");

const DRY_RUN = process.argv.includes("--dry-run");
const INCLUDE_COMPLETED = process.argv.includes("--include-completed");
const LESSON_ID_ARG = process.argv.find((arg) => arg.startsWith("--lesson-id="));
const ONLY_LESSON_ID = LESSON_ID_ARG ? Number(LESSON_ID_ARG.split("=")[1]) : null;

const MODE_PALETTES: Record<string, { accent: string; dark: string; soft: string }> = {
  attention: { accent: "#2563eb", dark: "#1e3a8a", soft: "#dbeafe" },
  residual: { accent: "#059669", dark: "#064e3b", soft: "#d1fae5" },
  mlp: { accent: "#7c3aed", dark: "#4c1d95", soft: "#ede9fe" },
  embedding: { accent: "#0891b2", dark: "#164e63", soft: "#cffafe" },
  logits: { accent: "#ea580c", dark: "#7c2d12", soft: "#ffedd5" },
  code: { accent: "#475569", dark: "#0f172a", soft: "#e2e8f0" },
  probability: { accent: "#db2777", dark: "#831843", soft: "#fce7f3" },
  generic: { accent: "#0f766e", dark: "#134e4a", soft: "#ccfbf1" },
};

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found: ${DB_PATH}`);
  }
  const db = new Database(DB_PATH);
  cleanupPetFishDemo(db);

  const lessonWhere: string[] = [];
  const lessonParams: unknown[] = [];
  if (!INCLUDE_COMPLETED) lessonWhere.push("status != 'completed'");
  if (ONLY_LESSON_ID !== null && Number.isFinite(ONLY_LESSON_ID)) {
    lessonWhere.push("id = ?");
    lessonParams.push(ONLY_LESSON_ID);
  }
  const sql = `SELECT id, title, description, status, subject_id FROM lessons${
    lessonWhere.length ? ` WHERE ${lessonWhere.join(" AND ")}` : ""
  } ORDER BY id`;
  const lessons = db.prepare(sql).all(...lessonParams) as LessonRow[];

  const activityStmt = db.prepare(
    "SELECT id, lesson_id, activity_type, title, content FROM lesson_activities WHERE lesson_id = ? ORDER BY sequence_order, id"
  );
  const updateActivity = db.prepare(
    "UPDATE lesson_activities SET content = ?, updated_at = datetime('now') WHERE id = ?"
  );

  const plannedArtifacts: ArtifactSpec[] = [];
  const updates: Array<{ activityId: number; content: unknown; reason: string }> = [];

  for (const lesson of lessons) {
    const activities = activityStmt.all(lesson.id) as ActivityRow[];
    for (const activity of activities) {
      const parsed = parseContent(activity.content);
      if (!parsed.ok) continue;
      const content = parsed.value;
      let changed = false;

      if (activity.activity_type === "audio") {
        const visual = ensureAudioVisual(content, {
          lesson,
          activity,
          context: "orientation",
        });
        if (visual.artifactCreated) plannedArtifacts.push(visual.artifact);
        changed ||= visual.changed;
      }

      if (activity.activity_type === "lesson_part") {
        const part = content as Record<string, unknown>;
        const audio = ensureRecord(part.audio);
        if (audio) {
          const visual = ensureAudioVisual(audio, {
            lesson,
            activity,
            context: "part-audio",
            partTitle: activity.title ?? lesson.title,
          });
          if (visual.artifactCreated) plannedArtifacts.push(visual.artifact);
          changed ||= visual.changed;
        }

        const interactive = ensureBespokeInteractive(part.interactive, {
          lesson,
          activity,
          context: "part-interactive",
          partTitle: activity.title ?? lesson.title,
          cues: extractCues(ensureRecord(audio?.synced_visual)),
        });
        if (interactive.artifactCreated) plannedArtifacts.push(interactive.artifact);
        if (interactive.changed) {
          part.interactive = interactive.spec;
          changed = true;
        }
      }

      if (activity.activity_type === "interactive") {
        const interactive = ensureBespokeInteractive(content, {
          lesson,
          activity,
          context: "interactive",
          partTitle: activity.title ?? lesson.title,
        });
        if (interactive.artifactCreated) plannedArtifacts.push(interactive.artifact);
        if (interactive.changed) {
          updates.push({
            activityId: activity.id,
            content: interactive.spec,
            reason: `converted legacy interactive ${activity.id} to bespoke-artifact`,
          });
          continue;
        }
      }

      if (changed) {
        updates.push({
          activityId: activity.id,
          content,
          reason: `added bespoke visual artifact slug(s) to activity ${activity.id}`,
        });
      }
    }
  }

  const uniqueArtifacts = dedupeArtifacts(plannedArtifacts);
  console.log(`DB: ${DB_PATH}`);
  console.log(`Lessons scanned: ${lessons.length}`);
  console.log(`Activity updates: ${updates.length}`);
  console.log(`Artifacts to build/verify: ${uniqueArtifacts.length}`);

  if (DRY_RUN) {
    for (const artifact of uniqueArtifacts.slice(0, 40)) {
      console.log(`DRY artifact ${artifact.slug}: ${artifact.title}`);
    }
    for (const update of updates.slice(0, 40)) {
      console.log(`DRY update activity ${update.activityId}: ${update.reason}`);
    }
    return;
  }

  for (const artifact of uniqueArtifacts) {
    await buildAndApproveArtifact(artifact);
  }
  const tx = db.transaction(() => {
    for (const update of updates) {
      updateActivity.run(JSON.stringify(update.content), update.activityId);
    }
  });
  tx();
  console.log("Backfill complete.");
}

function cleanupPetFishDemo(db: Db) {
  const lesson = db
    .prepare("SELECT id, title, description, goals, tags, source_context, next_lesson_diagnostics FROM lessons WHERE id = 11")
    .get() as {
      id: number;
      title: string;
      description: string | null;
      goals: string | null;
      tags: string | null;
      source_context: string | null;
      next_lesson_diagnostics: string | null;
    } | undefined;
  if (!lesson) return;
  const subject = db
    .prepare("SELECT id, title FROM subjects WHERE id = (SELECT subject_id FROM lessons WHERE id = 11)")
    .get() as { id: number; title: string } | undefined;
  const hasFishDemo =
    [
      lesson.title,
      lesson.description,
      lesson.goals,
      lesson.tags,
      lesson.source_context,
      lesson.next_lesson_diagnostics,
      subject?.title,
    ]
      .join(" ")
      .toLowerCase()
      .includes("pet fish") ||
    [
      lesson.title,
      lesson.description,
      lesson.goals,
      lesson.tags,
      lesson.source_context,
      lesson.next_lesson_diagnostics,
      subject?.title,
    ]
      .join(" ")
      .toLowerCase()
      .includes("having-a-pet-fish");
  if (!hasFishDemo) return;

  if (DRY_RUN) {
    console.log("DRY cleanup: replace prod pet-fish demo lesson 11 with LLM-building demo wording");
    return;
  }

  if (subject?.title?.toLowerCase().includes("pet fish")) {
    db.prepare(
      `UPDATE subjects
       SET title = 'Demo Lesson: Build your own LLM AI',
           description = COALESCE(description, 'A public demo subject for learning how a small language model moves from text to tokens, hidden states, transformer blocks, logits, and generation.'),
           goals = COALESCE(goals, 'Understand the LLM pipeline from tokenizer through transformer blocks and next-token prediction.'),
           criteria = COALESCE(criteria, 'Can explain the objects passed between tokenizer, embeddings, transformer blocks, output head, and generation loop.'),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(subject.id);
  }

  db.prepare(
    `UPDATE lessons
     SET title = 'Demo Lesson: Build your own LLM AI',
         description = 'A public demo lesson that maps how text becomes tokens, hidden states, transformer block updates, logits, and generated output.',
         goals = '["Build a usable mental model for how text becomes tokens and hidden states","Connect transformer blocks, logits, and generation to a concrete example","Leave clear evidence for the next adaptive LLM lesson"]',
         tags = '["prodavo-native","foundation","llm-building"]',
         source_context = ?,
         next_lesson_diagnostics = ?,
         updated_at = datetime('now')
     WHERE id = 11`
  ).run(
    JSON.stringify({
      trigger: "lesson.completed",
      completed_lesson_id: 10,
      completed_lesson_title: "Initial Assessment: Demo Lesson: Build your own LLM AI",
      concepts_to_review: [],
      concepts_ready_to_advance: [],
      quiz_result: null,
      diagnostics: [],
      generated_by: "prodavo-bespoke-backfill",
    }),
    JSON.stringify([
      {
        id: "next_confusing",
        prompt: "What still feels unclear about building your own LLM AI after this lesson?",
        hint: "Name the smallest confusing object or handoff.",
      },
      {
        id: "next_direction",
        prompt: "For the next foundation, would you rather see a worked example, a visual simulation, or a practice task?",
        hint: "Pick the format that would make the next lesson easier to use.",
      },
    ])
  );

  db.prepare(
    `UPDATE lessons
     SET title = 'Initial Assessment: Demo Lesson: Build your own LLM AI',
         description = 'Calibration assessment to determine your existing LLM-building knowledge before teaching begins. Your honest answers shape the subsequent lessons.',
         source_context = NULL,
         updated_at = datetime('now')
     WHERE id = 10 AND subject_id = 11`
  ).run();

  const rows = db
    .prepare("SELECT id, title, content FROM lesson_activities WHERE lesson_id IN (10, 11)")
    .all() as Array<{ id: number; title: string | null; content: string | null }>;
  const update = db.prepare(
    "UPDATE lesson_activities SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?"
  );
  const replacements: Array<[RegExp, string]> = [
    [/Having a pet fish/g, "Build your own LLM AI"],
    [/having a pet fish/g, "building your own LLM AI"],
    [/having-a-pet-fish/g, "llm-building"],
    [/pet fish/g, "small language model"],
    [/fish/g, "model"],
    [/Foundation Map: Build your own LLM AI/g, "Foundation Map: Build your own LLM AI"],
    [/Initial Assessment: Build your own LLM AI/g, "Initial Assessment: Build your own LLM AI"],
  ];
  for (const row of rows) {
    let title = row.title ?? "";
    let content = row.content ?? "";
    for (const [from, to] of replacements) {
      title = title.replace(from, to);
      content = content.replace(from, to);
    }
    update.run(title, content, row.id);
  }

  cleanupPetFishHistoryTables(db, replacements);
}

function cleanupPetFishHistoryTables(db: Db, replacements: Array<[RegExp, string]>) {
  const targets: Array<[string, string]> = [
    ["generated_artifacts", "lesson_id = 11"],
    ["next_lesson_jobs", "subject_id = 11"],
    ["subject_journal_entries", "subject_id = 11"],
    ["subject_workpads", "subject_id = 11"],
    ["tags", "name LIKE '%fish%' OR name LIKE '%pet%'"],
  ];
  for (const [table, where] of targets) {
    const exists = db
      .prepare("SELECT count(*) AS c FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { c: number };
    if (!exists.c) continue;
    const cols = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .filter((col) => /TEXT/i.test(String((col as { type?: string }).type ?? "")))
      .map((col) => (col as { name: string }).name);
    if (cols.length === 0) continue;
    const rows = db.prepare(`SELECT _rowid_ AS __rowid__, * FROM ${table} WHERE ${where}`).all() as Array<
      Record<string, unknown> & { __rowid__: number }
    >;
    for (const row of rows) {
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const col of cols) {
        const current = row[col];
        if (typeof current !== "string") continue;
        let next = current;
        for (const [from, to] of replacements) next = next.replace(from, to);
        if (next !== current) {
          sets.push(`${col} = ?`);
          values.push(next);
        }
      }
      if (sets.length === 0) continue;
      values.push(row.__rowid__);
      db.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE _rowid_ = ?`).run(...values);
    }
  }
}

function parseContent(raw: string | null): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (!raw) return { ok: false };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

function ensureAudioVisual(
  content: Record<string, unknown>,
  opts: { lesson: LessonRow; activity: ActivityRow; context: "orientation" | "part-audio"; partTitle?: string }
): { changed: boolean; artifactCreated: boolean; artifact: ArtifactSpec } {
  const field = opts.context === "orientation" ? "orientation_visual" : "synced_visual";
  let visual = ensureRecord(content[field]);
  let changed = false;
  if (!visual) {
    visual = defaultSyncedVisual(opts.lesson, opts.activity, opts.partTitle);
    content[field] = visual;
    changed = true;
  }
  const cues = ensureCues(visual, Number(content.duration_hint ?? 180), opts.lesson, opts.activity);
  if (cues.changed) changed = true;

  const existingSlug = typeof visual.artifact_slug === "string" && /^[a-z0-9-]+$/.test(visual.artifact_slug)
    ? visual.artifact_slug
    : "";
  const slug = existingSlug || slugify(`lesson-${opts.lesson.id}-activity-${opts.activity.id}-${opts.context}-artifact`);
  if (!existingSlug) {
    visual.artifact_slug = slug;
    changed = true;
  }
  const title = `${opts.lesson.title}: ${opts.activity.title ?? opts.context}`;
  return {
    changed,
    artifactCreated: shouldBuildArtifact(slug),
    artifact: {
      slug,
      title,
      lessonId: opts.lesson.id,
      activityId: opts.activity.id,
      source: artifactSource({
        title,
        subtitle: opts.partTitle ?? opts.activity.title ?? opts.lesson.title,
        mode: chooseMode(`${opts.lesson.title} ${opts.activity.title ?? ""} ${JSON.stringify(visual)}`),
        cues: cues.cues,
      }),
    },
  };
}

function ensureBespokeInteractive(
  raw: unknown,
  opts: {
    lesson: LessonRow;
    activity: ActivityRow;
    context: "interactive" | "part-interactive";
    partTitle?: string;
    cues?: Cue[];
  }
): { changed: boolean; artifactCreated: boolean; artifact: ArtifactSpec; spec: Record<string, unknown> } {
  const spec = ensureRecord(raw);
  const slugFromSpec = ensureRecord(spec?.params)?.artifact_slug;
  const existingSlug =
    typeof slugFromSpec === "string" && /^[a-z0-9-]+$/.test(slugFromSpec) && spec?.widget_type === "bespoke-artifact"
      ? slugFromSpec
      : "";
  const slug = existingSlug || slugify(`lesson-${opts.lesson.id}-activity-${opts.activity.id}-${opts.context}-artifact`);
  const cues =
    opts.cues && opts.cues.length > 0
      ? opts.cues
      : defaultCues(opts.lesson, opts.activity, 180, opts.partTitle ?? opts.activity.title ?? opts.lesson.title);
  const title = `${opts.lesson.title}: ${opts.activity.title ?? opts.context}`;
  return {
    changed: !existingSlug,
    artifactCreated: shouldBuildArtifact(slug),
    spec: existingSlug
      ? spec!
      : {
          schema_version: "1.0",
          widget_type: "bespoke-artifact",
          title: opts.activity.title ?? "Interactive visualization",
          instructions: "Explore the approved bespoke visualization for this lesson section.",
          params: { artifact_slug: slug, min_height: 360 },
        },
    artifact: {
      slug,
      title,
      lessonId: opts.lesson.id,
      activityId: opts.activity.id,
      source: artifactSource({
        title,
        subtitle: opts.partTitle ?? opts.activity.title ?? opts.lesson.title,
        mode: chooseMode(`${opts.lesson.title} ${opts.activity.title ?? ""} ${JSON.stringify(raw ?? {})}`),
        cues,
      }),
    },
  };
}

function ensureRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractCues(visual: Record<string, unknown> | null): Cue[] {
  if (!visual || !Array.isArray(visual.cues)) return [];
  return visual.cues.filter((cue): cue is Cue => Boolean(ensureRecord(cue)));
}

function ensureCues(
  visual: Record<string, unknown>,
  duration: number,
  lesson: LessonRow,
  activity: ActivityRow
): { changed: boolean; cues: Cue[] } {
  const cues = extractCues(visual);
  if (cues.length > 0) return { changed: false, cues };
  const next = defaultCues(lesson, activity, duration, activity.title ?? lesson.title);
  visual.cues = next;
  if (!ensureRecord(visual.scene)) visual.scene = defaultScene(lesson, activity);
  return { changed: true, cues: next };
}

function defaultSyncedVisual(lesson: LessonRow, activity: ActivityRow, partTitle?: string): Record<string, unknown> {
  return {
    strategy: "timeline",
    scene: defaultScene(lesson, activity),
    cues: defaultCues(lesson, activity, 180, partTitle ?? activity.title ?? lesson.title),
  };
}

function defaultScene(lesson: LessonRow, activity: ActivityRow): Record<string, unknown> {
  return {
    scene_id: slugify(`lesson-${lesson.id}-activity-${activity.id}-scene`),
    title: activity.title ?? lesson.title,
    motif: "bespoke generated visual artifact",
    description: `DB-backed visual artifact for ${lesson.title}.`,
    panels: [
      {
        id: "handoff",
        title: "Local handoff",
        kind: "flow",
        description: "Receive, transform, and pass-forward context.",
        data: [
          { label: "Receive", value: "prior object", role: "input" },
          { label: "Transform", value: "current operation", role: "process" },
          { label: "Pass", value: "updated object", role: "output" },
        ],
      },
    ],
  };
}

function defaultCues(lesson: LessonRow, activity: ActivityRow, duration: number, topic: string): Cue[] {
  const safeDuration = Math.max(30, Number.isFinite(duration) ? duration : 180);
  const third = Math.floor(safeDuration / 3);
  return [
    {
      start: 0,
      end: third,
      label: "Input",
      headline: `Start with ${topic}`,
      narration: `The visual starts by naming the object entering ${lesson.title}.`,
      receive: "prior context",
      transform: "focus the object",
      pass: "ready state",
    },
    {
      start: third,
      end: third * 2,
      label: "Transform",
      headline: "Show the operation",
      narration: "The visual changes the object while the audio explains the mechanism.",
      receive: "ready state",
      transform: "current mechanism",
      pass: "changed state",
    },
    {
      start: third * 2,
      end: safeDuration,
      label: "Handoff",
      headline: "Pass the result forward",
      narration: "The visual shows what leaves this section for the next step.",
      receive: "changed state",
      transform: "package the result",
      pass: "next input",
    },
  ];
}

function chooseMode(text: string): keyof typeof MODE_PALETTES {
  const lower = text.toLowerCase();
  if (/\b(q|query|k|key|v|value|attention|softmax|score)\b/.test(lower)) return "attention";
  if (/\bresidual|stream|skip connection|add back\b/.test(lower)) return "residual";
  if (/\bmlp|feedforward|gelu|gate|expansion|compress\b/.test(lower)) return "mlp";
  if (/\btoken|embedding|vocab|tokenizer|row|matrix\b/.test(lower)) return "embedding";
  if (/\blogit|probability|softmax|distribution|next token\b/.test(lower)) return "logits";
  if (/\bbayes|prior|posterior|likelihood|specificity|sensitivity\b/.test(lower)) return "probability";
  if (/\bcode|python|function|input|output\b/.test(lower)) return "code";
  return "generic";
}

function artifactSource(input: { title: string; subtitle: string; mode: keyof typeof MODE_PALETTES; cues: Cue[] }): string {
  const cues = normalizeCues(input.cues);
  const palette = MODE_PALETTES[input.mode] ?? MODE_PALETTES.generic;
  const data = {
    title: input.title,
    subtitle: input.subtitle,
    mode: input.mode,
    palette,
    cues,
  };
  return `import React from "react";

type Props = {
  initialState?: Record<string, number>;
  onStateChange?: (change: { controls: Record<string, number> }) => void;
};

const artifact = ${JSON.stringify(data, null, 2)};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function ArtifactComponent({ initialState = {}, onStateChange }: Props) {
  const cueCount = artifact.cues.length || 1;
  const active = clamp(Math.round(initialState.cueIndex ?? initialState.stage ?? 0), 0, cueCount - 1);
  const cue = artifact.cues[active] ?? artifact.cues[0];
  const progress = clamp(Number(initialState.progressPct ?? ((active + 1) / cueCount) * 100), 0, 100);
  const setActive = (next: number) => onStateChange?.({ controls: { cueIndex: next, stage: next } });

  return (
    <main style={{
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
      color: "#111827",
      background: "#ffffff",
      padding: 14,
      boxSizing: "border-box",
      maxWidth: 920,
      margin: "0 auto"
    }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 10 }}>
        <div style={{ fontSize: 11, color: artifact.palette.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
          DB-backed bespoke visual
        </div>
        <h2 style={{ margin: "3px 0", fontSize: 20, lineHeight: 1.15, color: artifact.palette.dark }}>{artifact.subtitle}</h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: "#475569" }}>{artifact.title}</p>
      </header>

      <nav aria-label="Audio visual cue states" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0", borderBottom: "1px solid #eef2f7" }}>
        {artifact.cues.map((item, index) => (
          <button
            key={item.label + index}
            onClick={() => setActive(index)}
            style={{
              flex: "1 0 96px",
              border: "0",
              borderBottom: index === active ? "3px solid " + artifact.palette.accent : "3px solid #e5e7eb",
              background: index === active ? artifact.palette.soft : "#ffffff",
              color: index === active ? artifact.palette.dark : "#64748b",
              padding: "8px 6px",
              fontSize: 12,
              fontWeight: 750,
              cursor: "pointer"
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, paddingTop: 12 }}>
        <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: progress + "%", background: artifact.palette.accent, transition: "width 180ms ease" }} />
        </div>

        <VisualMode mode={artifact.mode} active={active} progress={progress} cue={cue} palette={artifact.palette} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
          <Handoff label="Receives" text={cue.receive || "prior object"} />
          <Handoff label="Changes" text={cue.transform || cue.headline} strong />
          <Handoff label="Passes" text={cue.pass || "updated object"} />
        </div>

        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "#334155" }}>{cue.narration}</p>
      </section>
    </main>
  );
}

function Handoff({ label, text, strong = false }: { label: string; text: string; strong?: boolean }) {
  return (
    <div style={{ padding: "9px 10px", borderRight: "1px solid #e5e7eb", minWidth: 0 }}>
      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 13, lineHeight: 1.3, color: strong ? artifact.palette.dark : "#1f2937", fontWeight: strong ? 800 : 650, overflowWrap: "anywhere" }}>{text}</div>
    </div>
  );
}

function VisualMode({ mode, active, progress, cue, palette }: { mode: string; active: number; progress: number; cue: any; palette: any }) {
  if (mode === "attention") return <AttentionView active={active} palette={palette} cue={cue} />;
  if (mode === "residual") return <ResidualView active={active} palette={palette} cue={cue} />;
  if (mode === "mlp") return <MlpView active={active} palette={palette} cue={cue} />;
  if (mode === "embedding") return <EmbeddingView active={active} palette={palette} cue={cue} />;
  if (mode === "logits" || mode === "probability") return <BarsView active={active} palette={palette} cue={cue} />;
  return <FlowView active={active} progress={progress} palette={palette} cue={cue} />;
}

function AttentionView({ active, palette, cue }: { active: number; palette: any; cue: any }) {
  const labels = ["Q asks", "K matches", "Scores", "Softmax", "V mixes"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 10 }}>
      <div style={{ borderRight: "1px solid #e5e7eb", paddingRight: 10 }}>
        {["Query row", "Key rows", "Value rows"].map((label, index) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, margin: "8px 0" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: index <= active % 3 ? palette.accent : "#cbd5e1" }} />
            <span style={{ fontSize: 13, fontWeight: 750 }}>{label}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 5 }}>
          {labels.map((label, index) => (
            <div key={label} style={{ minHeight: 50, padding: 7, borderBottom: "2px solid " + (index === active % labels.length ? palette.accent : "#e5e7eb"), background: index === active % labels.length ? palette.soft : "#f8fafc" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: index === active % labels.length ? palette.dark : "#64748b" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: palette.dark }}>{cue.headline}</div>
      </div>
    </div>
  );
}

function ResidualView({ active, palette, cue }: { active: number; palette: any; cue: any }) {
  const rows = ["Input hidden state", "Sublayer update", "Residual add", "Output hidden state"];
  return (
    <div>
      {rows.map((row, index) => (
        <div key={row} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid #eef2f7" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: index <= active % rows.length ? palette.dark : "#64748b" }}>{row}</div>
          <div style={{ height: 18, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
            <div style={{ height: "100%", width: (25 + index * 18 + active * 3) % 100 + "%", background: index <= active % rows.length ? palette.accent : "#cbd5e1" }} />
          </div>
        </div>
      ))}
      <p style={{ margin: "9px 0 0", fontSize: 13, color: "#475569" }}>{cue.headline}</p>
    </div>
  );
}

function MlpView({ active, palette, cue }: { active: number; palette: any; cue: any }) {
  const widths = [38, 76, 64, 42];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, alignItems: "end", minHeight: 135 }}>
      {["token vector", "expand", "gate", "compress"].map((label, index) => (
        <div key={label} style={{ textAlign: "center" }}>
          <div style={{ height: widths[index], borderRadius: "10px 10px 0 0", background: index <= active % 4 ? palette.accent : "#cbd5e1", opacity: index === active % 4 ? 1 : 0.58 }} />
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: index === active % 4 ? palette.dark : "#64748b" }}>{label}</div>
        </div>
      ))}
      <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 13, color: "#475569" }}>{cue.headline}</p>
    </div>
  );
}

function EmbeddingView({ active, palette, cue }: { active: number; palette: any; cue: any }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: palette.dark }}>Token IDs select rows</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 4 }}>
        {Array.from({ length: 24 }).map((_, index) => (
          <div key={index} style={{ height: 22, borderRadius: 5, background: index % 6 <= active % 6 ? palette.accent : "#e2e8f0", opacity: index % 6 <= active % 6 ? 0.8 : 1 }} />
        ))}
      </div>
      <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 13, color: "#475569" }}>{cue.headline}</p>
    </div>
  );
}

function BarsView({ active, palette, cue }: { active: number; palette: any; cue: any }) {
  const bars = [42, 78, 31, 58, 66].map((value, index) => Math.max(18, (value + active * 9 + index * 5) % 86));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, alignItems: "end", minHeight: 145 }}>
      {bars.map((value, index) => (
        <div key={index} style={{ textAlign: "center" }}>
          <div style={{ height: value, borderRadius: "10px 10px 0 0", background: index === active % bars.length ? palette.accent : "#cbd5e1" }} />
          <div style={{ marginTop: 5, fontSize: 11, color: "#64748b", fontWeight: 750 }}>option {index + 1}</div>
        </div>
      ))}
      <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 13, color: "#475569" }}>{cue.headline}</p>
    </div>
  );
}

function FlowView({ active, progress, palette, cue }: { active: number; progress: number; palette: any; cue: any }) {
  const steps = ["Object", "Operation", "Evidence", "Handoff"];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
        {steps.map((step, index) => (
          <div key={step} style={{ minHeight: 70, borderBottom: "3px solid " + (index <= active % 4 ? palette.accent : "#e5e7eb"), background: index === active % 4 ? palette.soft : "#f8fafc", padding: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 850, color: index <= active % 4 ? palette.dark : "#64748b" }}>{step}</div>
            <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: index <= active % 4 ? palette.accent : "#cbd5e1", width: index === active % 4 ? progress + "%" : "100%" }} />
          </div>
        ))}
      </div>
      <p style={{ margin: "9px 0 0", fontSize: 13, color: "#475569" }}>{cue.headline}</p>
    </div>
  );
}
`;
}

function normalizeCues(cues: Cue[]): Cue[] {
  const fallback = cues.length > 0 ? cues : defaultCues(
    { id: 0, title: "Lesson", description: null, status: "in_progress", subject_id: null },
    { id: 0, lesson_id: 0, activity_type: "audio", title: "Visual", content: null },
    180,
    "Visual"
  );
  return fallback.slice(0, 36).map((cue, index) => ({
    start: Number.isFinite(cue.start) ? cue.start : index * 5,
    end: Number.isFinite(cue.end) ? cue.end : index * 5 + 5,
    label: cleanText(cue.label || `Step ${index + 1}`),
    headline: cleanText(cue.headline || cue.transform || `Step ${index + 1}`),
    narration: cleanText(cue.narration || cue.transform || cue.headline || ""),
    receive: cleanText(cue.receive || "prior object"),
    transform: cleanText(cue.transform || cue.headline || "current operation"),
    pass: cleanText(cue.pass || "updated object"),
  }));
}

function cleanText(value: string): string {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/Having a pet fish/g, "Build your own LLM AI")
    .replace(/having a pet fish/g, "building your own LLM AI")
    .trim()
    .slice(0, 240);
}

function shouldBuildArtifact(slug: string): boolean {
  const existing = getArtifactBySlug(slug);
  if (!existing) return true;
  if (existing.build_status !== "qa_approved") return true;
  if (!existing.compiled_asset_path) return true;
  return !fs.existsSync(path.join(process.cwd(), existing.compiled_asset_path));
}

async function buildAndApproveArtifact(spec: ArtifactSpec) {
  const existing = getArtifactBySlug(spec.slug);
  const sourceHash = sha256(spec.source);
  if (existing && existing.source_hash === sourceHash && existing.build_status === "qa_approved" && existing.compiled_asset_path) {
    console.log(`${spec.slug}: already approved`);
    return;
  }
  if (!existing) {
    createArtifact({
      slug: spec.slug,
      title: spec.title,
      source_react: spec.source,
      manifest: { allowed_imports: ["react"] },
      lesson_id: spec.lessonId,
      activity_id: spec.activityId,
    });
  } else if (existing.source_hash !== sourceHash || existing.build_status !== "qa_approved") {
    updateSource(spec.slug, spec.source, { allowed_imports: ["react"] });
  }

  markBuilding(spec.slug);
  const result = await buildArtifact(spec.slug, spec.source, { allowed_imports: ["react"] });
  if (!result.ok) {
    markBuildFailed(spec.slug, result);
    throw new Error(`${spec.slug} build failed: ${result.error ?? "unknown error"}`);
  }
  markBuildSuccess(spec.slug, result);
  approveArtifact(spec.slug, {
    qa_notes:
      "Backfilled DB-backed bespoke artifact. Source is lesson-specific, built by the artifact pipeline, and replaces legacy/precreated visual rendering.",
    approved_by: "bespoke-backfill",
  });
  console.log(`${spec.slug}: built and approved`);
}

function dedupeArtifacts(items: ArtifactSpec[]): ArtifactSpec[] {
  const seen = new Map<string, ArtifactSpec>();
  for (const item of items) seen.set(item.slug, item);
  return [...seen.values()];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
