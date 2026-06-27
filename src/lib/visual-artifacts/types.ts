/**
 * Types for the DB-backed bespoke React visual artifact pipeline.
 *
 * SAFETY CONTRACT:
 * - source_react is stored for audit and rebuild; never executed directly from SQLite.
 * - Only qa_approved artifacts have their compiled bundle served.
 * - Import allowlist is enforced at build time via the manifest.
 * - Lesson specs reference artifacts by slug only (no embedded code in lesson JSON).
 */

/** Valid build_status values for a visual artifact. */
export type ArtifactBuildStatus =
  | "pending_build"
  | "building"
  | "build_failed"
  | "pending_qa"
  | "qa_approved"
  | "qa_rejected";

/** Manifest stored alongside the source. Controls what the build pipeline allows. */
export interface ArtifactManifest {
  /** Import specifiers allowed in the source. Defaults: react, lucide-react, recharts. */
  allowed_imports: string[];
  /**
   * Optional JSON Schema for the params accepted by this artifact's component.
   * The component receives { params, initialState, onStateChange } from WidgetHost.
   */
  params_schema?: Record<string, unknown>;
  /** Runtime constraints (future: fetch allowed, storage allowed, etc.) */
  runtime_constraints?: {
    allow_fetch?: boolean;
    allow_storage?: boolean;
  };
}

/** Default allowed imports for every artifact unless manifest overrides. */
export const DEFAULT_ALLOWED_IMPORTS: string[] = [
  "react",
  "react-dom",
  "lucide-react",
  "recharts",
];

/** A visual artifact row as stored in the database. */
export interface VisualArtifactRow {
  id: number;
  slug: string;
  title: string;
  lesson_id: number | null;
  activity_id: number | null;
  source_react: string;
  manifest: string; // JSON-encoded ArtifactManifest
  source_hash: string;
  build_status: ArtifactBuildStatus;
  compiled_asset_path: string | null;
  compiled_asset_hash: string | null;
  build_error: string | null;
  build_log: string | null;
  built_at: string | null;
  qa_notes: string | null;
  qa_snapshot_ref: string | null;
  qa_screenshot_ref: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Parsed view of a VisualArtifactRow. */
export interface VisualArtifact extends Omit<VisualArtifactRow, "manifest"> {
  manifest: ArtifactManifest;
}

/** Input for creating a new visual artifact. */
export interface CreateArtifactInput {
  slug: string;
  title: string;
  source_react: string;
  manifest?: Partial<ArtifactManifest>;
  lesson_id?: number;
  activity_id?: number;
}

/** Result of a build attempt. */
export interface BuildResult {
  ok: boolean;
  compiled_asset_path?: string;
  compiled_asset_hash?: string;
  build_log?: string;
  error?: string;
}
