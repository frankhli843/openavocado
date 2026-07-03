/**
 * CRUD operations for the visual_artifacts table.
 *
 * All writes go through this module so status transitions are consistent
 * and the approval gate is enforced at the DB level.
 */

import type Database from "better-sqlite3";
import { getDb } from "@/db/connection";
import { sha256 } from "./build";
import { parseManifest, validateManifest } from "./manifest";
import type {
  VisualArtifactRow,
  VisualArtifact,
  CreateArtifactInput,
  ArtifactBuildStatus,
  BuildResult,
} from "./types";
import { DEFAULT_ALLOWED_IMPORTS } from "./types";
import {
  validateArtifactApprovalEvidence,
  validateArtifactSource,
} from "./source-validation";

function db(): Database.Database {
  return getDb();
}

function parseRow(row: VisualArtifactRow): VisualArtifact {
  return { ...row, manifest: parseManifest(row.manifest) };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export function getArtifactBySlug(slug: string): VisualArtifact | null {
  const row = db()
    .prepare("SELECT * FROM visual_artifacts WHERE slug = ?")
    .get(slug) as VisualArtifactRow | undefined;
  return row ? parseRow(row) : null;
}

export function getArtifactById(id: number): VisualArtifact | null {
  const row = db()
    .prepare("SELECT * FROM visual_artifacts WHERE id = ?")
    .get(id) as VisualArtifactRow | undefined;
  return row ? parseRow(row) : null;
}

export function listArtifacts(opts?: {
  build_status?: ArtifactBuildStatus;
  lesson_id?: number;
}): VisualArtifact[] {
  let sql = "SELECT * FROM visual_artifacts";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts?.build_status) {
    conditions.push("build_status = ?");
    params.push(opts.build_status);
  }
  if (opts?.lesson_id !== undefined) {
    conditions.push("lesson_id = ?");
    params.push(opts.lesson_id);
  }

  if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY created_at DESC";

  const rows = db().prepare(sql).all(...params) as VisualArtifactRow[];
  return rows.map(parseRow);
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export function createArtifact(input: CreateArtifactInput): VisualArtifact {
  if (!input.slug || !/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error("slug must be lowercase letters, digits, and hyphens only");
  }
  if (!input.source_react?.trim()) {
    throw new Error("source_react is required");
  }
  const sourceValidation = validateArtifactSource(input.source_react);
  if (!sourceValidation.valid) {
    throw new Error(`Invalid artifact source: ${sourceValidation.errors.join("; ")}`);
  }

  const manifest = {
    allowed_imports: DEFAULT_ALLOWED_IMPORTS,
    ...input.manifest,
  };
  const manifestValidation = validateManifest(manifest);
  if (!manifestValidation.valid) {
    throw new Error(`Invalid manifest: ${manifestValidation.errors.join("; ")}`);
  }

  const manifestJson = JSON.stringify(manifestValidation.normalized);
  const sourceHash = sha256(input.source_react);

  const result = db()
    .prepare(
      `INSERT INTO visual_artifacts
         (slug, title, lesson_id, activity_id, source_react, manifest, source_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.slug,
      input.title,
      input.lesson_id ?? null,
      input.activity_id ?? null,
      input.source_react,
      manifestJson,
      sourceHash
    );

  return getArtifactById(result.lastInsertRowid as number)!;
}

export function updateSource(
  slug: string,
  source_react: string,
  manifest?: Partial<{ allowed_imports: string[] }>
): VisualArtifact {
  const artifact = getArtifactBySlug(slug);
  if (!artifact) throw new Error(`Artifact not found: ${slug}`);
  const sourceValidation = validateArtifactSource(source_react);
  if (!sourceValidation.valid) {
    throw new Error(`Invalid artifact source: ${sourceValidation.errors.join("; ")}`);
  }

  const newManifest = manifest
    ? validateManifest({ ...artifact.manifest, ...manifest }).normalized
    : artifact.manifest;

  db()
    .prepare(
      `UPDATE visual_artifacts
       SET source_react = ?, source_hash = ?, manifest = ?,
           build_status = 'pending_build',
           compiled_asset_path = NULL, compiled_asset_hash = NULL,
           build_error = NULL, built_at = NULL,
           approved_at = NULL, approved_by = NULL,
           updated_at = datetime('now')
       WHERE slug = ?`
    )
    .run(
      source_react,
      sha256(source_react),
      JSON.stringify(newManifest),
      slug
    );

  return getArtifactBySlug(slug)!;
}

/** Mark artifact as building (optimistic lock). */
export function markBuilding(slug: string): void {
  db()
    .prepare(
      `UPDATE visual_artifacts
       SET build_status = 'building', updated_at = datetime('now')
       WHERE slug = ?`
    )
    .run(slug);
}

/** Record a successful build result. Status moves to pending_qa. */
export function markBuildSuccess(slug: string, result: BuildResult): void {
  db()
    .prepare(
      `UPDATE visual_artifacts
       SET build_status = 'pending_qa',
           compiled_asset_path = ?, compiled_asset_hash = ?,
           build_error = NULL, build_log = ?, built_at = datetime('now'),
           updated_at = datetime('now')
       WHERE slug = ?`
    )
    .run(result.compiled_asset_path!, result.compiled_asset_hash!, result.build_log ?? null, slug);
}

/** Record a failed build. Status moves to build_failed. */
export function markBuildFailed(slug: string, result: BuildResult): void {
  db()
    .prepare(
      `UPDATE visual_artifacts
       SET build_status = 'build_failed',
           compiled_asset_path = NULL, compiled_asset_hash = NULL,
           build_error = ?, build_log = ?, built_at = datetime('now'),
           updated_at = datetime('now')
       WHERE slug = ?`
    )
    .run(result.error ?? "unknown error", result.build_log ?? null, slug);
}

/** Approve an artifact after QA. Status moves to qa_approved. */
export function approveArtifact(
  slug: string,
  opts: {
    qa_notes?: string;
    qa_snapshot_ref?: string;
    qa_screenshot_ref?: string;
    approved_by?: string;
  }
): VisualArtifact {
  const artifact = getArtifactBySlug(slug);
  if (!artifact) throw new Error(`Artifact not found: ${slug}`);
  if (artifact.build_status !== "pending_qa") {
    throw new Error(
      `Cannot approve artifact with status "${artifact.build_status}". Must be pending_qa.`
    );
  }
  if (!artifact.compiled_asset_path) {
    throw new Error("Cannot approve artifact without a compiled asset.");
  }
  const sourceValidation = validateArtifactSource(artifact.source_react);
  if (!sourceValidation.valid) {
    throw new Error(`Cannot approve artifact source: ${sourceValidation.errors.join("; ")}`);
  }
  const evidenceValidation = validateArtifactApprovalEvidence(opts);
  if (!evidenceValidation.valid) {
    throw new Error(`Cannot approve artifact without complete QA evidence: ${evidenceValidation.errors.join("; ")}`);
  }

  db()
    .prepare(
      `UPDATE visual_artifacts
       SET build_status = 'qa_approved',
           qa_notes = ?, qa_snapshot_ref = ?, qa_screenshot_ref = ?,
           approved_at = datetime('now'), approved_by = ?,
           updated_at = datetime('now')
       WHERE slug = ?`
    )
    .run(
      opts.qa_notes ?? null,
      opts.qa_snapshot_ref ?? null,
      opts.qa_screenshot_ref ?? null,
      opts.approved_by ?? "agent",
      slug
    );

  return getArtifactBySlug(slug)!;
}

/**
 * Attach Chrome MCP QA evidence (snapshot/screenshot references and notes) to
 * an artifact without changing its build_status. Used when QA evidence is
 * captured for an artifact that is already approved, or when re-running QA on
 * an existing artifact. The approval state transition lives in approveArtifact;
 * this only records observability evidence.
 */
export function recordQaEvidence(
  slug: string,
  opts: {
    qa_notes?: string;
    qa_snapshot_ref?: string;
    qa_screenshot_ref?: string;
  }
): VisualArtifact {
  const artifact = getArtifactBySlug(slug);
  if (!artifact) throw new Error(`Artifact not found: ${slug}`);

  db()
    .prepare(
      `UPDATE visual_artifacts
       SET qa_notes = COALESCE(?, qa_notes),
           qa_snapshot_ref = COALESCE(?, qa_snapshot_ref),
           qa_screenshot_ref = COALESCE(?, qa_screenshot_ref),
           updated_at = datetime('now')
       WHERE slug = ?`
    )
    .run(
      opts.qa_notes ?? null,
      opts.qa_snapshot_ref ?? null,
      opts.qa_screenshot_ref ?? null,
      slug
    );

  return getArtifactBySlug(slug)!;
}

/** Reject an artifact after QA. Status moves to qa_rejected. */
export function rejectArtifact(slug: string, qa_notes: string): VisualArtifact {
  const artifact = getArtifactBySlug(slug);
  if (!artifact) throw new Error(`Artifact not found: ${slug}`);

  db()
    .prepare(
      `UPDATE visual_artifacts
       SET build_status = 'qa_rejected', qa_notes = ?, updated_at = datetime('now')
       WHERE slug = ?`
    )
    .run(qa_notes, slug);

  return getArtifactBySlug(slug)!;
}

/** Reset a build_failed or qa_rejected artifact back to pending_build for retry. */
export function resetToPendingBuild(slug: string): void {
  db()
    .prepare(
      `UPDATE visual_artifacts
       SET build_status = 'pending_build',
           compiled_asset_path = NULL, compiled_asset_hash = NULL,
           build_error = NULL, built_at = NULL,
           approved_at = NULL, approved_by = NULL,
           updated_at = datetime('now')
       WHERE slug = ?`
    )
    .run(slug);
}

/** Upsert a legacy-approved artifact (for migrating existing registered widgets). */
export function upsertLegacyApproved(input: {
  slug: string;
  title: string;
  source_react: string;
  compiled_asset_path: string;
  compiled_asset_hash: string;
  qa_notes: string;
}): VisualArtifact {
  const existing = getArtifactBySlug(input.slug);
  if (existing) return existing; // already migrated

  const manifest = JSON.stringify({ allowed_imports: DEFAULT_ALLOWED_IMPORTS });
  const sourceHash = sha256(input.source_react);

  const result = db()
    .prepare(
      `INSERT INTO visual_artifacts
         (slug, title, source_react, manifest, source_hash,
          build_status, compiled_asset_path, compiled_asset_hash,
          built_at, qa_notes, approved_at, approved_by)
       VALUES (?, ?, ?, ?, ?, 'qa_approved', ?, ?, datetime('now'), ?, datetime('now'), 'legacy-migration')`
    )
    .run(
      input.slug,
      input.title,
      input.source_react,
      manifest,
      sourceHash,
      input.compiled_asset_path,
      input.compiled_asset_hash,
      input.qa_notes
    );

  return getArtifactById(result.lastInsertRowid as number)!;
}
