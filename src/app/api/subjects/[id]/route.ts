import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { computeSubjectMastery } from "@/lib/mastery";
import type { Subject, Lesson, MasterySignal, ProgressPoint, NextLessonJob } from "@/types";

/** GET /api/subjects/:id — full subject detail with lessons, mastery, progress */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const subjectId = Number(id);

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

    const next_lesson_jobs = db
      .prepare(
        `SELECT * FROM next_lesson_jobs WHERE subject_id = ? ORDER BY created_at DESC LIMIT 10`
      )
      .all(subjectId) as NextLessonJob[];

    const mastery = computeSubjectMastery(db, subjectId, subject.learner_id);

    return NextResponse.json({
      subject,
      lessons,
      mastery_signals,
      progress_points,
      mastery,
      tags,
      next_lesson_jobs,
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
    const body = (await request.json()) as Partial<Subject>;
    const subjectId = Number(id);

    const allowed = ["goals", "criteria", "status", "title", "description", "current_level"] as const;
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        values.push(body[key]);
      }
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
