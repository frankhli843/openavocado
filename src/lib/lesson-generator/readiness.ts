import fs from "node:fs";
import path from "node:path";
import { validateLessonSegmentVideo } from "../lesson-content/schema";

export interface StoredLessonActivity {
  id: number;
  activity_type: string;
  title?: string | null;
  content: unknown;
}

export interface GeneratedArtifactRow {
  activity_id: number | null;
  artifact_type: string;
  file_path: string | null;
}

export interface VisualArtifactRow {
  slug: string;
  build_status: string;
  approved_at?: string | null;
  compiled_asset_path?: string | null;
  qa_notes?: string | null;
  qa_screenshot_ref?: string | null;
}

export interface LessonProductionReadinessOptions {
  runtimeRoot?: string;
  checkFiles?: boolean;
  requireSegmentVideos?: boolean;
  requireApprovedVisualArtifacts?: boolean;
}

export interface LessonProductionReadinessResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateLessonProductionReadiness(params: {
  activities: StoredLessonActivity[];
  generatedArtifacts: GeneratedArtifactRow[];
  visualArtifacts: VisualArtifactRow[];
  options?: LessonProductionReadinessOptions;
}): LessonProductionReadinessResult {
  const options = params.options ?? {};
  const requireSegmentVideos = options.requireSegmentVideos ?? true;
  const requireApprovedVisualArtifacts = options.requireApprovedVisualArtifacts ?? true;
  const checkFiles = options.checkFiles ?? Boolean(options.runtimeRoot);
  const errors: string[] = [];
  const warnings: string[] = [];
  const generatedByActivity = new Map<number, GeneratedArtifactRow[]>();
  for (const artifact of params.generatedArtifacts) {
    if (typeof artifact.activity_id !== "number") continue;
    const list = generatedByActivity.get(artifact.activity_id) ?? [];
    list.push(artifact);
    generatedByActivity.set(artifact.activity_id, list);
  }

  const visualBySlug = new Map(params.visualArtifacts.map((artifact) => [artifact.slug, artifact]));
  const referencedVisualSlugs = new Map<string, Set<string>>();

  for (const activity of params.activities) {
    const label = activityLabel(activity);
    const content = asRecord(activity.content);

    if (activity.activity_type === "audio") {
      collectVisualSlugs(content?.orientation_visual, `${label} orientation_visual`, referencedVisualSlugs);
      if (requireSegmentVideos) {
        validateSegmentVideo({
          activity,
          label,
          video: content?.orientation_video,
          generatedRows: generatedByActivity.get(activity.id) ?? [],
          runtimeRoot: options.runtimeRoot,
          checkFiles,
          errors,
        });
      }
    }

    if (activity.activity_type === "lesson_part") {
      const audio = asRecord(content?.audio);
      collectVisualSlugs(audio?.synced_visual, `${label} audio.synced_visual`, referencedVisualSlugs);
      collectVisualSlugs(content?.interactive, `${label} interactive`, referencedVisualSlugs);
      if (requireSegmentVideos) {
        validateSegmentVideo({
          activity,
          label,
          video: audio?.video,
          generatedRows: generatedByActivity.get(activity.id) ?? [],
          runtimeRoot: options.runtimeRoot,
          checkFiles,
          errors,
        });
      }
    }

    if (activity.activity_type === "interactive") {
      collectVisualSlugs(content, `${label} interactive`, referencedVisualSlugs);
    }
  }

  if (requireApprovedVisualArtifacts) {
    for (const [slug, locations] of referencedVisualSlugs.entries()) {
      const artifact = visualBySlug.get(slug);
      const locationText = Array.from(locations).join(", ");
      if (!artifact) {
        errors.push(`visual artifact "${slug}" is referenced by ${locationText} but has no visual_artifacts row`);
        continue;
      }
      if (artifact.build_status !== "qa_approved") {
        errors.push(`visual artifact "${slug}" is referenced by ${locationText} but build_status is ${artifact.build_status}`);
      }
      if (!artifact.approved_at) {
        errors.push(`visual artifact "${slug}" is referenced by ${locationText} but approved_at is missing`);
      }
      if (!artifact.compiled_asset_path) {
        errors.push(`visual artifact "${slug}" is referenced by ${locationText} but compiled_asset_path is missing`);
      } else if (checkFiles && options.runtimeRoot) {
        const abs = runtimePath(options.runtimeRoot, artifact.compiled_asset_path);
        if (!fs.existsSync(abs)) {
          errors.push(`visual artifact "${slug}" compiled asset is missing on disk at ${abs}`);
        }
      }
      if (!artifact.qa_notes && !artifact.qa_screenshot_ref) {
        warnings.push(`visual artifact "${slug}" has no QA notes or screenshot reference`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateSegmentVideo(params: {
  activity: StoredLessonActivity;
  label: string;
  video: unknown;
  generatedRows: GeneratedArtifactRow[];
  runtimeRoot?: string;
  checkFiles: boolean;
  errors: string[];
}): void {
  if (params.video === undefined || params.video === null) {
    params.errors.push(`${params.label} is missing a registered segment video`);
  } else {
    const result = validateLessonSegmentVideo(params.video);
    for (const error of result.errors) params.errors.push(`${params.label} video: ${error}`);
  }

  const videoRows = params.generatedRows.filter((row) => row.artifact_type === "video");
  if (videoRows.length === 0) {
    params.errors.push(`${params.label} has no generated_artifacts video row`);
  }

  const videoRecord = asRecord(params.video);
  const expectedPath = typeof videoRecord?.file_path === "string" ? videoRecord.file_path : null;
  if (expectedPath && videoRows.length > 0 && !videoRows.some((row) => row.file_path === expectedPath)) {
    params.errors.push(`${params.label} video file_path ${expectedPath} is not registered in generated_artifacts`);
  }

  if (params.checkFiles && params.runtimeRoot) {
    const filePaths = new Set<string>();
    if (expectedPath) filePaths.add(expectedPath);
    for (const row of videoRows) {
      if (row.file_path) filePaths.add(row.file_path);
    }
    for (const filePath of filePaths) {
      const abs = runtimePath(params.runtimeRoot, filePath);
      if (!fs.existsSync(abs)) {
        params.errors.push(`${params.label} video file is missing on disk at ${abs}`);
      }
    }
  }
}

function collectVisualSlugs(value: unknown, location: string, out: Map<string, Set<string>>): void {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const slug = record.artifact_slug;
  if (typeof slug === "string" && slug.trim()) {
    const locations = out.get(slug) ?? new Set<string>();
    locations.add(location);
    out.set(slug, locations);
  }
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) collectVisualSlugs(item, location, out);
    } else if (child && typeof child === "object") {
      collectVisualSlugs(child, location, out);
    }
  }
}

function activityLabel(activity: StoredLessonActivity): string {
  const title = activity.title ? ` ${JSON.stringify(activity.title)}` : "";
  return `activity ${activity.id} (${activity.activity_type})${title}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function runtimePath(runtimeRoot: string, relPath: string): string {
  return path.join(runtimeRoot, relPath.replace(/^runtime_artifacts\//, ""));
}
