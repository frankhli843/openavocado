import type Database from "better-sqlite3";
import type { LessonBufferPlan, LessonCompletedEvent } from "@/types";

export const READY_LESSON_BUFFER_TARGET = 2;

interface ReadyLessonRow {
  id: number;
  title: string;
  status: "queued" | "in_progress";
  sequence_number: number;
  planning_rationale: string | null;
  generated_by: string | null;
  updated_at: string;
  source_context: string | null;
  video_status: "legacy" | "pending_video" | "ready";
}

export function buildLessonBufferPlan(
  db: Database.Database,
  params: {
    subjectId: number;
    completedLessonId?: number | null;
    targetReadyCount?: number;
  }
): LessonBufferPlan {
  const target = params.targetReadyCount ?? resolveReadyTargetForSubject(db, params.subjectId);
  const readyRows = loadReadyLessons(db, params.subjectId);
  const completedLessonId = typeof params.completedLessonId === "number" ? params.completedLessonId : null;
  const enrichmentTargets = completedLessonId
    ? readyRows
        .filter((lesson) => !wasEnrichedFromLesson(lesson.source_context, completedLessonId))
        .map((lesson) => lesson.id)
    : [];

  // Video-first (2026-07-11): only queued lessons whose video pass is complete
  // ('ready') — or pre-directive 'legacy' lessons kept as a temporary fallback
  // — count as buffer-ready for the learner. pending_video lessons still count
  // toward generation dedup (lessons_to_generate) so the buffer does not pile
  // up duplicate audio-only lessons while the Manim pass is outstanding.
  const pendingVideoIds = readyRows
    .filter((lesson) => lesson.video_status === "pending_video")
    .map((lesson) => lesson.id);

  return {
    policy_version: "two-ready-lessons/v2",
    target_ready_count: target,
    ready_count: readyRows.length,
    video_ready_count: readyRows.length - pendingVideoIds.length,
    pending_video_lesson_ids: pendingVideoIds,
    lessons_to_generate: Math.max(0, target - readyRows.length),
    existing_ready_lessons: readyRows.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      status: lesson.status,
      sequence_number: lesson.sequence_number,
      planning_rationale: lesson.planning_rationale,
      generated_by: lesson.generated_by,
      updated_at: lesson.updated_at,
      video_status: lesson.video_status,
    })),
    enrichment_required_for_lesson_ids: enrichmentTargets,
  };
}

function resolveReadyTargetForSubject(db: Database.Database, subjectId: number): number {
  const row = db
    .prepare(
      `SELECT lesson_type, target_lesson_count
       FROM subjects
       WHERE id = ?`
    )
    .get(subjectId) as { lesson_type: string | null; target_lesson_count: number | null } | undefined;
  if (!row?.target_lesson_count) return READY_LESSON_BUFFER_TARGET;

  const completedTeaching = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM lessons
       WHERE subject_id = ?
         AND status = 'completed'
         AND sequence_number > 0`
    )
    .get(subjectId) as { count: number };
  const remaining = Math.max(0, row.target_lesson_count - completedTeaching.count);
  return Math.min(READY_LESSON_BUFFER_TARGET, remaining);
}

export function enrichQueuedLessonsFromCompletion(
  db: Database.Database,
  event: LessonCompletedEvent
): number[] {
  const plan = event.lesson_buffer ?? buildLessonBufferPlan(db, {
    subjectId: event.subject_id,
    completedLessonId: event.lesson_id,
  });
  const ids = plan.enrichment_required_for_lesson_ids;
  if (ids.length === 0) return [];

  const rows = db
    .prepare(
      `SELECT id, title, description, planning_rationale, source_context
       FROM lessons
       WHERE subject_id = ?
         AND status = 'queued'
         AND id IN (${ids.map(() => "?").join(",")})
       ORDER BY sequence_number ASC, id ASC`
    )
    .all(event.subject_id, ...ids) as Array<{
      id: number;
      title: string;
      description: string | null;
      planning_rationale: string | null;
      source_context: string | null;
    }>;

  const enrichedIds: number[] = [];
  const update = db.prepare(
    `UPDATE lessons
     SET description = ?,
         planning_rationale = ?,
         source_context = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const source = parseObject(row.source_context);
      source.lesson_buffer_enrichment = {
        policy_version: plan.policy_version,
        enriched_at: new Date().toISOString(),
        completed_lesson_id: event.lesson_id,
        completed_lesson_title: event.lesson_title,
        concepts_to_review: event.concepts_to_review,
        concepts_ready_to_advance: event.concepts_ready_to_advance,
        diagnostics: event.next_lesson_diagnostics,
        quiz_result: event.quiz_result,
      };

      const reviewFocus = event.concepts_to_review[0] || event.recent_misconceptions[0] || "the latest weak spot";
      const readyFocus = event.concepts_ready_to_advance[0] || "the next frontier";
      const description = appendOnce(
        row.description,
        `Updated after "${event.lesson_title}" so it reviews ${reviewFocus} and advances toward ${readyFocus}.`
      );
      const rationale = appendOnce(
        row.planning_rationale,
        `Before this lesson is attempted, it was enriched from the completed lesson "${event.lesson_title}". It should reuse the latest evidence, repair any newly exposed weakness, and only advance where the learner is ready.`
      );

      update.run(description, rationale, JSON.stringify(source), row.id);
      linkLessonTags(db, event.subject_id, row.id, ["lesson-buffer-enriched"]);
      enrichedIds.push(row.id);
    }

    appendWorkpadBufferNote(db, event, rows.map((row) => row.id), plan);
  });
  tx();

  return enrichedIds;
}

export function needsLessonBufferBackfill(
  db: Database.Database,
  subjectId: number,
  completedLessonId?: number | null
): boolean {
  const plan = buildLessonBufferPlan(db, { subjectId, completedLessonId });
  return plan.lessons_to_generate > 0 || plan.enrichment_required_for_lesson_ids.length > 0;
}

function loadReadyLessons(db: Database.Database, subjectId: number): ReadyLessonRow[] {
  return db
    .prepare(
      `SELECT id, title, status, sequence_number, planning_rationale, generated_by, updated_at, source_context,
              COALESCE(video_status, 'legacy') AS video_status
       FROM lessons
       WHERE subject_id = ?
         AND status = 'queued'
       ORDER BY sequence_number ASC, id ASC`
    )
    .all(subjectId) as ReadyLessonRow[];
}

function wasEnrichedFromLesson(sourceContext: string | null, lessonId: number): boolean {
  const source = parseObject(sourceContext);
  const enrichment = parseObject(source.lesson_buffer_enrichment);
  return enrichment.completed_lesson_id === lessonId;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function appendOnce(current: string | null, sentence: string): string {
  const base = current?.trim();
  if (!base) return sentence;
  return base.includes(sentence) ? base : `${base}\n\n${sentence}`;
}

function linkLessonTags(db: Database.Database, subjectId: number, lessonId: number, tags: string[]): void {
  const insert = db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, 'lesson_type')");
  const get = db.prepare("SELECT id FROM tags WHERE name = ?");
  const linkSubject = db.prepare("INSERT OR IGNORE INTO subject_tags (subject_id, tag_id) VALUES (?, ?)");
  const linkLesson = db.prepare("INSERT OR IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)");
  for (const tag of tags) {
    insert.run(tag);
    const row = get.get(tag) as { id: number } | undefined;
    if (!row) continue;
    linkSubject.run(subjectId, row.id);
    linkLesson.run(lessonId, row.id);
  }
}

function appendWorkpadBufferNote(
  db: Database.Database,
  event: LessonCompletedEvent,
  enrichedLessonIds: number[],
  plan: LessonBufferPlan
): void {
  const note = [
    `## ${new Date().toISOString()} two-ready lesson buffer`,
    `Completed lesson: ${event.lesson_title} (id ${event.lesson_id})`,
    `Ready lesson target: ${plan.target_ready_count}`,
    `Ready lessons before generation: ${plan.ready_count}`,
    plan.pending_video_lesson_ids.length
      ? `Queued lessons awaiting Manim videos (not learner-ready): ${plan.pending_video_lesson_ids.join(", ")}`
      : "Queued lessons awaiting Manim videos: none",
    enrichedLessonIds.length
      ? `Enriched existing queued lessons: ${enrichedLessonIds.join(", ")}`
      : "Enriched existing queued lessons: none",
    `New lessons still needed: ${plan.lessons_to_generate}`,
    event.concepts_to_review.length
      ? `Review pressure: ${event.concepts_to_review.join(", ")}`
      : "Review pressure: none recorded",
    event.concepts_ready_to_advance.length
      ? `Advance pressure: ${event.concepts_ready_to_advance.join(", ")}`
      : "Advance pressure: none recorded",
  ].join("\n");

  const existing = db
    .prepare("SELECT id, content, version FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
    .get(event.subject_id, event.learner_id) as { id: number; content: string; version: number } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE subject_workpads
       SET content = ?, version = ?, last_updated_by = 'lesson-buffer',
           last_updated_for = 'lesson_completion', updated_at = datetime('now')
       WHERE id = ?`
    ).run(`${existing.content}\n\n${note}`, existing.version + 1, existing.id);
  } else {
    db.prepare(
      `INSERT INTO subject_workpads
         (subject_id, learner_id, content, last_updated_by, last_updated_for)
       VALUES (?, ?, ?, 'lesson-buffer', 'lesson_completion')`
    ).run(event.subject_id, event.learner_id, note);
  }
}
