#!/usr/bin/env tsx
/**
 * Import an exported rich lesson into a target subject while preserving the
 * subject URL and, when possible, the first lesson URL.
 *
 * Usage:
 *   AVOCADOCORE_DB_PATH=/var/prodavo/data/avocadocore.db \
 *     pnpm tsx scripts/import-lesson-export-to-subject.ts \
 *       --export avo_lesson15_to_prod11.json \
 *       --subject-id 31 \
 *       --target-lesson-id 64 \
 *       --replace-subject-lessons \
 *       --copy-audio \
 *       --runtime-root /root/prodavo
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

interface ExportedLessonBundle {
  lesson: Record<string, unknown>;
  activities: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
  visualArtifacts: Array<Record<string, unknown>>;
}

interface Options {
  exportPath: string;
  subjectId: number;
  targetLessonId?: number;
  replaceSubjectLessons: boolean;
  copyAudio: boolean;
  runtimeRoot: string;
  backup: boolean;
}

const lessonColumns = [
  "title",
  "description",
  "status",
  "sequence_number",
  "goals",
  "tags",
  "started_at",
  "completed_at",
  "discarded_at",
  "discard_reason",
  "generated_by",
  "generator_version",
  "source_context",
  "planning_rationale",
  "next_lesson_diagnostics",
  "knowledge_graph_data",
] as const;

const generatedArtifactColumns = [
  "lesson_id",
  "activity_id",
  "artifact_type",
  "provider",
  "voice",
  "duration_sec",
  "content_hash",
  "file_path",
  "object_key",
  "source_script",
  "script_version",
  "generated_at",
  "created_at",
] as const;

const visualArtifactColumns = [
  "slug",
  "title",
  "lesson_id",
  "activity_id",
  "source_react",
  "manifest",
  "source_hash",
  "build_status",
  "compiled_asset_path",
  "compiled_asset_hash",
  "build_error",
  "build_log",
  "built_at",
  "qa_notes",
  "qa_snapshot_ref",
  "qa_screenshot_ref",
  "approved_at",
  "approved_by",
  "created_at",
  "updated_at",
] as const;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);
  if (opts.backup) {
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const backupPath = `${dbPath}.before-lesson-import-${stamp}`;
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Backup written: ${backupPath}`);
  }

  const bundle = JSON.parse(fs.readFileSync(opts.exportPath, "utf8")) as ExportedLessonBundle;
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  const result = db.transaction(() => importBundle(db, bundle, opts))();
  db.close();
  console.log(JSON.stringify(result, null, 2));
}

function importBundle(db: Database.Database, bundle: ExportedLessonBundle, opts: Options) {
  const subject = db.prepare("SELECT id, learner_id, title FROM subjects WHERE id = ?").get(opts.subjectId) as
    | { id: number; learner_id: number; title: string }
    | undefined;
  if (!subject) throw new Error(`Subject ${opts.subjectId} not found`);

  const targetLessonId =
    opts.targetLessonId ??
    ((db
      .prepare("SELECT id FROM lessons WHERE subject_id = ? ORDER BY sequence_number ASC, id ASC LIMIT 1")
      .get(opts.subjectId) as { id: number } | undefined)?.id ?? insertEmptyLesson(db, opts.subjectId));

  const targetLesson = db.prepare("SELECT id FROM lessons WHERE id = ? AND subject_id = ?").get(targetLessonId, opts.subjectId);
  if (!targetLesson) throw new Error(`Lesson ${targetLessonId} is not in subject ${opts.subjectId}`);

  if (opts.replaceSubjectLessons) {
    db.prepare("DELETE FROM lessons WHERE subject_id = ? AND id != ?").run(opts.subjectId, targetLessonId);
  }

  updateLesson(db, bundle.lesson, opts.subjectId, targetLessonId);

  db.prepare("DELETE FROM generated_artifacts WHERE lesson_id = ?").run(targetLessonId);
  db.prepare("DELETE FROM lesson_autosave WHERE lesson_id = ?").run(targetLessonId);
  db.prepare("DELETE FROM lesson_activities WHERE lesson_id = ?").run(targetLessonId);

  const activityMap = new Map<number, number>();
  const insertActivity = db.prepare(
    `INSERT INTO lesson_activities
       (lesson_id, activity_type, is_core, sequence_order, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`
  );

  for (const activity of bundle.activities.sort((a, b) => Number(a.sequence_order ?? 0) - Number(b.sequence_order ?? 0))) {
    const inserted = insertActivity.run(
      targetLessonId,
      activity.activity_type,
      Number(activity.is_core ?? 1),
      activity.sequence_order,
      activity.title,
      activity.content,
      activity.created_at ?? null
    ).lastInsertRowid as number;
    activityMap.set(Number(activity.id), inserted);
  }

  insertGeneratedArtifacts(db, bundle, targetLessonId, activityMap, opts);
  upsertVisualArtifacts(db, bundle, targetLessonId, activityMap);
  linkTags(db, opts.subjectId, targetLessonId, safeJsonArray(bundle.lesson.tags));

  return {
    subject_id: opts.subjectId,
    target_lesson_id: targetLessonId,
    title: bundle.lesson.title,
    activities_imported: activityMap.size,
    audio_artifacts_imported: bundle.artifacts.length,
    visual_artifacts_upserted: bundle.visualArtifacts.length,
    replaced_other_subject_lessons: opts.replaceSubjectLessons,
  };
}

function updateLesson(db: Database.Database, lesson: Record<string, unknown>, subjectId: number, targetLessonId: number) {
  const values = lessonColumns.map((column) => {
    if (column === "sequence_number") return 1;
    if (column === "status") return lesson.status ?? "in_progress";
    return lesson[column] ?? null;
  });
  const assignments = lessonColumns.map((column) => `${column} = ?`).join(", ");
  db.prepare(`UPDATE lessons SET subject_id = ?, ${assignments}, updated_at = datetime('now') WHERE id = ?`).run(
    subjectId,
    ...values,
    targetLessonId
  );
}

function insertGeneratedArtifacts(
  db: Database.Database,
  bundle: ExportedLessonBundle,
  targetLessonId: number,
  activityMap: Map<number, number>,
  opts: Options
) {
  const placeholders = generatedArtifactColumns.map(() => "?").join(", ");
  const insert = db.prepare(`INSERT INTO generated_artifacts (${generatedArtifactColumns.join(", ")}) VALUES (${placeholders})`);
  for (const artifact of bundle.artifacts) {
    const sourceActivityId = artifact.activity_id == null ? null : Number(artifact.activity_id);
    const targetActivityId = sourceActivityId == null ? null : activityMap.get(sourceActivityId) ?? null;
    const sourcePath = String(artifact.file_path ?? "");
    const targetPath = remapAudioPath(sourcePath, Number(bundle.lesson.id), targetLessonId, sourceActivityId, targetActivityId);
    if (opts.copyAudio && sourcePath && targetPath) copyRuntimeFile(opts.runtimeRoot, sourcePath, targetPath);
    const row: Record<string, unknown> = {
      ...artifact,
      lesson_id: targetLessonId,
      activity_id: targetActivityId,
      file_path: targetPath,
      content_hash: targetPath ? hashIfExists(path.join(opts.runtimeRoot, targetPath)) ?? artifact.content_hash : artifact.content_hash,
    };
    insert.run(...generatedArtifactColumns.map((column) => row[column] ?? null));
  }
}

function upsertVisualArtifacts(
  db: Database.Database,
  bundle: ExportedLessonBundle,
  targetLessonId: number,
  activityMap: Map<number, number>
) {
  const updateAssignments = visualArtifactColumns
    .filter((column) => column !== "slug" && column !== "created_at")
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");
  const placeholders = visualArtifactColumns.map(() => "?").join(", ");
  const upsert = db.prepare(
    `INSERT INTO visual_artifacts (${visualArtifactColumns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT(slug) DO UPDATE SET ${updateAssignments}`
  );

  for (const visual of bundle.visualArtifacts) {
    const sourceActivityId = visual.activity_id == null ? null : Number(visual.activity_id);
    const row: Record<string, unknown> = {
      ...visual,
      lesson_id: targetLessonId,
      activity_id: sourceActivityId == null ? null : activityMap.get(sourceActivityId) ?? null,
      updated_at: new Date().toISOString(),
    };
    upsert.run(...visualArtifactColumns.map((column) => row[column] ?? null));
  }
}

function linkTags(db: Database.Database, subjectId: number, lessonId: number, tags: string[]) {
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, 'concept')");
  const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const linkSubject = db.prepare("INSERT OR IGNORE INTO subject_tags (subject_id, tag_id) VALUES (?, ?)");
  const linkLesson = db.prepare("INSERT OR IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)");
  for (const tag of tags) {
    if (!tag) continue;
    insertTag.run(tag);
    const row = getTag.get(tag) as { id: number } | undefined;
    if (!row) continue;
    linkSubject.run(subjectId, row.id);
    linkLesson.run(lessonId, row.id);
  }
}

function insertEmptyLesson(db: Database.Database, subjectId: number): number {
  return db
    .prepare("INSERT INTO lessons (subject_id, title, status, sequence_number) VALUES (?, 'Imported lesson', 'queued', 1)")
    .run(subjectId).lastInsertRowid as number;
}

function remapAudioPath(
  sourcePath: string,
  sourceLessonId: number,
  targetLessonId: number,
  sourceActivityId: number | null,
  targetActivityId: number | null
): string {
  if (!sourcePath) return sourcePath;
  const escapedLesson = String(sourceLessonId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (sourceActivityId != null && targetActivityId != null) {
    const activityMapped = sourcePath.replace(
      new RegExp(`lesson_${escapedLesson}_activity_${sourceActivityId}_audio\\.mp3$`),
      `lesson_${targetLessonId}_activity_${targetActivityId}_audio.mp3`
    );
    if (activityMapped !== sourcePath) return activityMapped;
  }
  return sourcePath.replace(new RegExp(`lesson_${escapedLesson}_audio\\.mp3$`), `lesson_${targetLessonId}_audio.mp3`);
}

function copyRuntimeFile(runtimeRoot: string, sourceRelPath: string, targetRelPath: string) {
  const sourceAbs = path.join(runtimeRoot, sourceRelPath);
  const targetAbs = path.join(runtimeRoot, targetRelPath);
  if (!fs.existsSync(sourceAbs)) {
    console.warn(`WARN source artifact missing, leaving DB path mapped: ${sourceAbs}`);
    return;
  }
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.copyFileSync(sourceAbs, targetAbs);
}

function hashIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function safeJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function resolveDbPath(): string {
  const explicit = process.env.AVOCADOCORE_DB_PATH;
  if (explicit) return explicit;
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith("file:")) return databaseUrl.slice("file:".length);
  if (databaseUrl) return databaseUrl;
  return path.join(process.cwd(), "data", "avocadocore.db");
}

function parseArgs(args: string[]): Options {
  const opts: Options = {
    exportPath: "",
    subjectId: 0,
    replaceSubjectLessons: false,
    copyAudio: false,
    runtimeRoot: process.cwd(),
    backup: true,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--export") opts.exportPath = requireValue(args, ++i, arg);
    else if (arg === "--subject-id") opts.subjectId = Number(requireValue(args, ++i, arg));
    else if (arg === "--target-lesson-id") opts.targetLessonId = Number(requireValue(args, ++i, arg));
    else if (arg === "--runtime-root") opts.runtimeRoot = requireValue(args, ++i, arg);
    else if (arg === "--replace-subject-lessons") opts.replaceSubjectLessons = true;
    else if (arg === "--copy-audio") opts.copyAudio = true;
    else if (arg === "--no-backup") opts.backup = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!opts.exportPath) throw new Error("--export is required");
  if (!opts.subjectId || Number.isNaN(opts.subjectId)) throw new Error("--subject-id is required");
  return opts;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

main();
