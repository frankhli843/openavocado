/**
 * Strategy B backfill: strip dangling audio-synced `artifact_slug` references
 * from EXISTING lessons' stored content.
 *
 * The generation-time guard (src/lib/lessons/visual-artifact-guard.ts) only runs
 * for newly inserted lessons. Lessons authored before the guard shipped still
 * carry audio-synced artifact_slug references that have no `visual_artifacts`
 * row, so the renderer shows a "being prepared" placeholder where a real visual
 * was promised. This script applies the same guard to already-stored lessons:
 * for each lesson's audio activity (`orientation_visual`) and each `lesson_part`
 * activity (`audio.synced_visual`), it removes every artifact_slug that does not
 * resolve to a `visual_artifacts` row and writes the sanitized content back.
 *
 * Usage:
 *   pnpm tsx scripts/sanitize-dangling-audio-visual-refs.ts <lessonId|all> [--dry-run]
 *
 * It never touches standalone interactive-widget artifact_slugs (those follow a
 * separate authored-artifact path); it only reports them.
 */
import { getDb, closeDb } from "../src/db/connection";
import { sanitizeDraftVisualRefs } from "../src/lib/lessons/visual-artifact-guard";

interface ActivityRow {
  id: number;
  lesson_id: number;
  activity_type: string;
  content: string | null;
}

function main() {
  const target = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!target) {
    console.error("Usage: tsx scripts/sanitize-dangling-audio-visual-refs.ts <lessonId|all> [--dry-run]");
    process.exit(1);
  }

  const db = getDb();
  const lessonIds: number[] =
    target === "all"
      ? (db
          .prepare(
            `SELECT DISTINCT lesson_id AS id FROM lesson_activities
             WHERE activity_type IN ('audio','lesson_part') ORDER BY lesson_id ASC`
          )
          .all() as Array<{ id: number }>).map((r) => r.id)
      : [Number(target)];

  let lessonsChanged = 0;
  let totalStripped = 0;

  for (const lessonId of lessonIds) {
    const activities = db
      .prepare(
        `SELECT id, lesson_id, activity_type, content FROM lesson_activities
         WHERE lesson_id = ? AND activity_type IN ('audio','lesson_part')
         ORDER BY sequence_order ASC`
      )
      .all(lessonId) as ActivityRow[];
    if (activities.length === 0) continue;

    // Parse each activity's content into a live object, then assemble a
    // pseudo-draft that points at those SAME objects so the guard mutates them
    // in place. We then re-serialize each activity from its parsed object.
    const parsed = new Map<number, Record<string, unknown>>();
    for (const a of activities) {
      try {
        parsed.set(a.id, a.content ? JSON.parse(a.content) : {});
      } catch {
        parsed.set(a.id, {});
      }
    }

    const audioActivity = activities.find((a) => a.activity_type === "audio");
    const partActivities = activities.filter((a) => a.activity_type === "lesson_part");

    const pseudoDraft = {
      orientation_visual: audioActivity ? parsed.get(audioActivity.id)?.orientation_visual : undefined,
      lesson_parts: partActivities.map((a) => ({
        audio: parsed.get(a.id)?.audio as { synced_visual?: unknown } | undefined,
      })),
    };

    const result = sanitizeDraftVisualRefs(
      db as unknown as Parameters<typeof sanitizeDraftVisualRefs>[0],
      pseudoDraft
    );
    if (result.strippedSlugs.length === 0 && result.danglingWidgetSlugs.length === 0) {
      continue;
    }

    if (result.strippedSlugs.length > 0) {
      lessonsChanged++;
      totalStripped += result.strippedSlugs.length;
      console.log(
        `lesson ${lessonId}: stripped ${result.strippedSlugs.length} dangling audio-synced ref(s): ` +
          result.strippedSlugs.map((r) => r.slug).join(", ")
      );
      if (!dryRun) {
        const update = db.prepare(`UPDATE lesson_activities SET content = ? WHERE id = ?`);
        const tx = db.transaction(() => {
          if (audioActivity) update.run(JSON.stringify(parsed.get(audioActivity.id)), audioActivity.id);
          for (const a of partActivities) update.run(JSON.stringify(parsed.get(a.id)), a.id);
        });
        tx();
      }
    }
    if (result.danglingWidgetSlugs.length > 0) {
      console.warn(
        `lesson ${lessonId}: ${result.danglingWidgetSlugs.length} interactive-widget slug(s) still dangling (not stripped): ` +
          result.danglingWidgetSlugs.map((r) => r.slug).join(", ")
      );
    }
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] " : ""}Done. Lessons changed: ${lessonsChanged}, audio-synced refs stripped: ${totalStripped}.`
  );
  closeDb();
}

main();
