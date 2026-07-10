/**
 * Gap 1 regression: the generation-time guard must strip dangling audio-synced
 * artifact_slug references (no matching visual_artifacts row) so lessons never
 * ship a reference the renderer cannot resolve, while keeping slugs that do
 * resolve and merely reporting (not stripping) dangling interactive-widget
 * slugs.
 */
import { describe, expect, it } from "vitest";

import { sanitizeDraftVisualRefs, loadPresentArtifactSlugs } from "./visual-artifact-guard";

/** Minimal fake matching the `prepare(sql).all(...params)` surface the guard uses. */
function fakeDb(presentSlugs: string[]) {
  const present = new Set(presentSlugs);
  return {
    prepare(_sql: string) {
      return {
        all(...params: unknown[]) {
          return (params as string[]).filter((p) => present.has(p)).map((slug) => ({ slug }));
        },
      };
    },
  };
}

describe("sanitizeDraftVisualRefs (Gap 1)", () => {
  it("strips dangling orientation_visual and per-cue slugs, keeps resolvable ones", () => {
    const draft = {
      title: "Test lesson",
      orientation_visual: {
        artifact_slug: "dangling-orientation-scene", // no row -> strip
        cues: [
          { start: 0, end: 5, artifact_slug: "present-cue-artifact", headline: "A" }, // keep
          { start: 5, end: 10, artifact_slug: "dangling-cue-artifact", headline: "B" }, // strip
          { start: 10, end: 15, headline: "C" }, // no slug -> untouched
        ],
      },
      lesson_parts: [
        {
          audio: {
            synced_visual: {
              cues: [
                { start: 0, end: 5, artifact_slug: "dangling-part-cue", headline: "P" }, // strip
              ],
            },
          },
        },
      ],
    };

    const db = fakeDb(["present-cue-artifact"]);
    const result = sanitizeDraftVisualRefs(db, draft as never);

    // Kept slug survives.
    expect((draft.orientation_visual.cues[0] as Record<string, unknown>).artifact_slug).toBe(
      "present-cue-artifact"
    );
    // Dangling refs removed in place.
    expect((draft.orientation_visual as Record<string, unknown>).artifact_slug).toBeUndefined();
    expect((draft.orientation_visual.cues[1] as Record<string, unknown>).artifact_slug).toBeUndefined();
    expect(
      (draft.lesson_parts[0].audio.synced_visual.cues[0] as Record<string, unknown>).artifact_slug
    ).toBeUndefined();

    expect(result.strippedSlugs.map((r) => r.slug).sort()).toEqual(
      ["dangling-cue-artifact", "dangling-orientation-scene", "dangling-part-cue"].sort()
    );
    expect(result.keptSlugs.map((r) => r.slug)).toEqual(["present-cue-artifact"]);
    // Cue without a slug is untouched.
    expect((draft.orientation_visual.cues[2] as Record<string, unknown>).headline).toBe("C");
  });

  it("reports dangling interactive-widget slugs without stripping them", () => {
    const draft = {
      title: "Widget lesson",
      lesson_parts: [
        {
          interactive: { widget_type: "bespoke-artifact", params: { artifact_slug: "dangling-widget" } },
          practice: { widget_type: "bespoke-artifact", params: { artifact_slug: "present-widget" } },
        },
      ],
    };
    const db = fakeDb(["present-widget"]);
    const result = sanitizeDraftVisualRefs(db, draft as never);

    // Widget slugs are NOT stripped (stripping would break the widget entirely).
    expect(draft.lesson_parts[0].interactive.params.artifact_slug).toBe("dangling-widget");
    expect(draft.lesson_parts[0].practice.params.artifact_slug).toBe("present-widget");
    expect(result.danglingWidgetSlugs.map((r) => r.slug)).toEqual(["dangling-widget"]);
    expect(result.strippedSlugs).toEqual([]);
  });

  it("is a no-op for a fully self-contained draft with no slugs", () => {
    const draft = {
      title: "Clean lesson",
      orientation_visual: { cues: [{ start: 0, end: 5, headline: "x", narration: "y" }] },
      lesson_parts: [{ audio: { synced_visual: { cues: [{ start: 0, end: 5, headline: "p" }] } } }],
    };
    const db = fakeDb([]);
    const result = sanitizeDraftVisualRefs(db, draft as never);
    expect(result.strippedSlugs).toEqual([]);
    expect(result.keptSlugs).toEqual([]);
    expect(result.danglingWidgetSlugs).toEqual([]);
  });

  it("loadPresentArtifactSlugs returns only slugs with rows", () => {
    const db = fakeDb(["a", "c"]);
    const present = loadPresentArtifactSlugs(db, ["a", "b", "c", "a"]);
    expect([...present].sort()).toEqual(["a", "c"]);
    expect(loadPresentArtifactSlugs(db, [])).toEqual(new Set());
  });
});
