import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { computeSubjectMastery } from "@/lib/mastery";
import { evaluateSubjectLevelProgression } from "@/lib/level-progression";
import { reconcileMaterializedLessonJobs } from "@/lib/lesson-jobs/reconcile";
import {
  buildSourceMaterialsFromFormData,
  buildSourceMaterialsFromJson,
  normalizeLessonType,
  normalizeTargetLessonCount,
} from "@/lib/subject-materials";
import type { Subject, Lesson, MasterySignal, ProgressPoint } from "@/types";

/** GET /api/subjects/:id — full subject detail with lessons, mastery, progress */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const subjectId = Number(id);
    reconcileMaterializedLessonJobs(db, { subjectId });

    const subject = db
      .prepare("SELECT * FROM subjects WHERE id = ?")
      .get(subjectId) as Subject | undefined;

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const lessons = db
      .prepare(
        `SELECT * FROM lessons WHERE subject_id = ? ORDER BY sequence_number ASC`
      )
      .all(subjectId) as Lesson[];

    const mastery_signals = db
      .prepare(
        `SELECT * FROM mastery_signals WHERE subject_id = ? ORDER BY created_at DESC LIMIT 20`
      )
      .all(subjectId) as MasterySignal[];

    const progress_points = db
      .prepare(
        `SELECT * FROM progress_points WHERE subject_id = ? ORDER BY recorded_at ASC`
      )
      .all(subjectId) as ProgressPoint[];

    const tags = db
      .prepare(
        `SELECT t.* FROM tags t
         JOIN subject_tags st ON st.tag_id = t.id
         WHERE st.subject_id = ?`
      )
      .all(subjectId);

    const mastery = computeSubjectMastery(db, subjectId, subject.learner_id);
    const level_progression = evaluateSubjectLevelProgression(db, subjectId, subject.learner_id);

    // Most recent generation job — learner-visible status panel. Older
    // completed jobs are intentionally hidden so the page does not read like
    // an audit log after rapid lesson completion.
    const generation_jobs = db
      .prepare(
        `SELECT j.id, j.subject_id, j.completed_lesson_id, j.discarded_lesson_id,
                j.trigger_event, j.adapter, j.status, j.payload, j.adapter_ref, j.error,
                j.dispatched_at, j.completed_at, j.created_at, j.updated_at,
                j.harness_status, j.harness_stage, j.progress_events, j.retry_count,
                j.last_error_detail, j.provider_name, j.output_lesson_id,
                j.qa_status, j.qa_stage, j.qa_events, j.qa_agent_ref, j.qa_lesson_url,
                j.qa_desktop_screenshot_ref, j.qa_mobile_screenshot_ref, j.qa_notes,
                j.qa_completed_at
         FROM next_lesson_jobs j
         LEFT JOIN lessons output_lesson ON output_lesson.id = j.output_lesson_id
         WHERE j.subject_id = ?
           AND NOT (
             j.status = 'completed'
             AND j.output_lesson_id IS NOT NULL
             AND COALESCE(output_lesson.status, 'queued') != 'queued'
           )
         ORDER BY j.created_at DESC
         LIMIT 1`
      )
      .all(subjectId);

    // Tag + difficulty evidence — how the learner has done per tag and per
    // difficulty across all assessed answers. Drives the adaptive-evidence view.
    const tag_evidence = db
      .prepare(
        `SELECT t.name AS tag,
                COALESCE(ar.difficulty, 'ungraded') AS difficulty,
                SUM(CASE WHEN ar.outcome = 'correct' THEN 1 ELSE 0 END) AS correct,
                SUM(CASE WHEN ar.outcome = 'incorrect' THEN 1 ELSE 0 END) AS incorrect,
                SUM(CASE WHEN ar.outcome = 'idk' THEN 1 ELSE 0 END) AS idk,
                COUNT(*) AS total
         FROM assessment_results ar
         JOIN assessment_result_tags art ON art.result_id = ar.id
         JOIN tags t ON t.id = art.tag_id
         WHERE ar.subject_id = ? AND ar.learner_id = ?
         GROUP BY t.name, difficulty
         ORDER BY total DESC, t.name ASC`
      )
      .all(subjectId, subject.learner_id);

    return NextResponse.json({
      subject,
      lessons,
      mastery_signals,
      progress_points,
      mastery,
      level_progression,
      tags,
      tag_evidence,
      generation_jobs,
    });
  } catch (err) {
    console.error("[api/subjects/:id]", err);
    return NextResponse.json(
      { error: "Failed to load subject" },
      { status: 500 }
    );
  }
}

/** PATCH /api/subjects/:id — update goals or status */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const subjectId = Number(id);
    const contentType = request.headers.get("content-type") ?? "";
    const formData = contentType.includes("multipart/form-data") ? await request.formData() : null;
    const body = formData
      ? Object.fromEntries(formData.entries())
      : ((await request.json()) as Partial<Subject & { source_links?: string; source_text?: string }>);

    const allowed = ["goals", "criteria", "status", "title", "description", "current_level"] as const;
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if ("lesson_type" in body || "target_lesson_count" in body) {
      const existing = db.prepare("SELECT lesson_type FROM subjects WHERE id = ?").get(subjectId) as
        | { lesson_type: string }
        | undefined;
      const lessonType = "lesson_type" in body ? normalizeLessonType(body.lesson_type) : normalizeLessonType(existing?.lesson_type);
      updates.push("lesson_type = ?");
      values.push(lessonType);
      if ("target_lesson_count" in body) {
        updates.push("target_lesson_count = ?");
        values.push(normalizeTargetLessonCount(body.target_lesson_count, lessonType));
      } else if (lessonType === "one_off") {
        updates.push("target_lesson_count = COALESCE(target_lesson_count, 1)");
      }
    }

    if (formData) {
      const sourceMaterials = await buildSourceMaterialsFromFormData(formData, subjectId);
      if (sourceMaterials.length > 0 || formData.has("source_materials") || formData.has("source_links") || formData.has("source_text")) {
        updates.push("source_materials = ?");
        values.push(JSON.stringify(sourceMaterials));
      }
    } else if ("source_materials" in body || "source_links" in body || "source_text" in body) {
      const sourceMaterials = buildSourceMaterialsFromJson(body);
      updates.push("source_materials = ?");
      values.push(JSON.stringify(sourceMaterials));
    }

    // Keep archived_at in sync with status. Archiving is reversible and never
    // deletes lessons, attempts, mastery, or progress — only the flag changes.
    if ("status" in body) {
      if (body.status === "archived") {
        updates.push("archived_at = datetime('now')");
      } else {
        updates.push("archived_at = NULL");
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(subjectId);

    db.prepare(`UPDATE subjects SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const updated = db.prepare("SELECT * FROM subjects WHERE id = ?").get(subjectId) as Subject;
    return NextResponse.json({ subject: updated });
  } catch (err) {
    console.error("[api/subjects/:id PATCH]", err);
    return NextResponse.json({ error: "Failed to update subject" }, { status: 500 });
  }
}
