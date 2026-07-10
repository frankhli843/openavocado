/**
 * Generation-time guard against dangling audio-synced visual references.
 *
 * Avo audio-synced visuals (a lesson's top-level `orientation_visual` and each
 * `lesson_part.audio.synced_visual`) may optionally reference a DB-backed
 * bespoke React artifact by `artifact_slug` (top-level or per-cue). The
 * agent-harness historically authored these slugs without ever creating the
 * matching `visual_artifacts` rows, so lessons shipped with dangling references
 * that render a 7s load timeout and a "being prepared" placeholder where a real
 * visual was promised.
 *
 * Strategy B (see knowledge/projects/avocadocore_dev.md): authored cue scenes
 * are the reliable base; a bespoke `artifact_slug` is optional enrichment that
 * is only valid when a matching `visual_artifacts` row already exists. This
 * guard runs at lesson insert time, strips every audio-synced `artifact_slug`
 * that does not resolve to a real row (so the renderer falls back to the clean
 * authored scene), and reports what it stripped so monitoring can catch a
 * harness that keeps emitting dangling references.
 *
 * It intentionally does NOT touch standalone interactive widget artifact_slugs
 * (widget_type "bespoke-artifact" in `lesson_part.interactive`/`practice`),
 * because stripping those would break the widget entirely — those follow a
 * separate authored-artifact path and are reported (not stripped) for
 * visibility.
 */

type SlugQueryable = {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
};

export interface ArtifactRef {
  slug: string;
  location: string;
}

export interface VisualArtifactGuardResult {
  /** audio-synced slugs stripped because no visual_artifacts row exists */
  strippedSlugs: ArtifactRef[];
  /** audio-synced slugs kept because a matching visual_artifacts row exists */
  keptSlugs: ArtifactRef[];
  /** interactive-widget slugs that are dangling (reported, not stripped) */
  danglingWidgetSlugs: ArtifactRef[];
}

/** Minimal shape of the draft this guard mutates. */
export interface DraftWithVisuals {
  orientation_visual?: unknown;
  lesson_parts?: Array<{
    audio?: { synced_visual?: unknown } | null;
    interactive?: unknown;
    practice?: unknown;
  }> | null;
}

interface CollectedRef {
  owner: Record<string, unknown>;
  key: string;
  slug: string;
  location: string;
}

function collectSyncedVisualRefs(
  visual: unknown,
  location: string,
  out: CollectedRef[]
): void {
  if (!visual || typeof visual !== "object") return;
  const v = visual as Record<string, unknown>;
  if (typeof v.artifact_slug === "string" && v.artifact_slug.trim()) {
    out.push({ owner: v, key: "artifact_slug", slug: v.artifact_slug, location: `${location}.artifact_slug` });
  }
  const cues = v.cues;
  if (Array.isArray(cues)) {
    cues.forEach((cue, i) => {
      if (cue && typeof cue === "object") {
        const c = cue as Record<string, unknown>;
        if (typeof c.artifact_slug === "string" && c.artifact_slug.trim()) {
          out.push({ owner: c, key: "artifact_slug", slug: c.artifact_slug, location: `${location}.cues[${i}].artifact_slug` });
        }
      }
    });
  }
}

function collectWidgetRefs(widget: unknown, location: string, out: ArtifactRef[]): void {
  if (!widget || typeof widget !== "object") return;
  const w = widget as Record<string, unknown>;
  const params = w.params;
  if (params && typeof params === "object") {
    const slug = (params as Record<string, unknown>).artifact_slug;
    if (typeof slug === "string" && slug.trim()) {
      out.push({ slug, location: `${location}.params.artifact_slug` });
    }
  }
}

/** Return the subset of `slugs` that has a row in `visual_artifacts`. */
export function loadPresentArtifactSlugs(db: SlugQueryable, slugs: string[]): Set<string> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Set();
  const placeholders = unique.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT slug FROM visual_artifacts WHERE slug IN (${placeholders})`)
    .all(...unique) as Array<{ slug: string }>;
  return new Set(rows.map((r) => r.slug));
}

/**
 * Strip dangling audio-synced artifact references from a draft in place and
 * report the outcome. `db` must expose the `visual_artifacts` table.
 */
export function sanitizeDraftVisualRefs(
  db: SlugQueryable,
  draft: DraftWithVisuals
): VisualArtifactGuardResult {
  const syncedRefs: CollectedRef[] = [];
  collectSyncedVisualRefs(draft.orientation_visual, "orientation_visual", syncedRefs);

  const widgetRefs: ArtifactRef[] = [];
  const parts = Array.isArray(draft.lesson_parts) ? draft.lesson_parts : [];
  parts.forEach((part, i) => {
    collectSyncedVisualRefs(part?.audio?.synced_visual, `lesson_parts[${i}].audio.synced_visual`, syncedRefs);
    collectWidgetRefs(part?.interactive, `lesson_parts[${i}].interactive`, widgetRefs);
    collectWidgetRefs(part?.practice, `lesson_parts[${i}].practice`, widgetRefs);
  });

  const present = loadPresentArtifactSlugs(db, [
    ...syncedRefs.map((r) => r.slug),
    ...widgetRefs.map((r) => r.slug),
  ]);

  const strippedSlugs: ArtifactRef[] = [];
  const keptSlugs: ArtifactRef[] = [];
  for (const ref of syncedRefs) {
    if (present.has(ref.slug)) {
      keptSlugs.push({ slug: ref.slug, location: ref.location });
    } else {
      delete ref.owner[ref.key];
      strippedSlugs.push({ slug: ref.slug, location: ref.location });
    }
  }

  const danglingWidgetSlugs = widgetRefs.filter((r) => !present.has(r.slug));

  return { strippedSlugs, keptSlugs, danglingWidgetSlugs };
}
