import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import type { SubjectWorkpad } from "@/types";

/**
 * GET /api/subjects/:id/workpad?learner_id=N
 *
 * Returns the current AI workpad for a subject+learner pair.
 * Creates an empty workpad row if none exists yet.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const subjectId = Number(id);
    const { searchParams } = new URL(request.url);
    const learnerId = Number(searchParams.get("learner_id") || 1);

    const subject = db.prepare("SELECT id, learner_id FROM subjects WHERE id = ?").get(subjectId) as
      | { id: number; learner_id: number }
      | undefined;
    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    if (subject.learner_id !== learnerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let workpad = db
      .prepare("SELECT * FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
      .get(subjectId, learnerId) as SubjectWorkpad | undefined;

    if (!workpad) {
      // Create an empty workpad on first access
      const result = db
        .prepare(
          `INSERT INTO subject_workpads (subject_id, learner_id, content, version, last_updated_for)
           VALUES (?, ?, '', 1, 'manual')`
        )
        .run(subjectId, learnerId);
      workpad = db
        .prepare("SELECT * FROM subject_workpads WHERE id = ?")
        .get(result.lastInsertRowid) as SubjectWorkpad;
    }

    return NextResponse.json({ workpad });
  } catch (err) {
    console.error("[api/subjects/:id/workpad GET]", err);
    return NextResponse.json({ error: "Failed to load workpad" }, { status: 500 });
  }
}

/**
 * PUT /api/subjects/:id/workpad
 *
 * Atomically replaces the workpad content for a subject+learner pair.
 * Increments the version counter on each update.
 *
 * Body:
 *   learner_id      number   (required)
 *   content         string   (required — full markdown)
 *   updated_by      string   (optional — agent/skill identifier)
 *   updated_for     string   (optional — 'lesson_completion' | 'lesson_discard' | 'manual')
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const subjectId = Number(id);

    const body = (await request.json()) as {
      learner_id?: number;
      content: string;
      updated_by?: string;
      updated_for?: string;
    };
    const learnerId = Number(body.learner_id || 1);
    const content = typeof body.content === "string" ? body.content : "";
    const updatedBy = typeof body.updated_by === "string" ? body.updated_by : null;
    const validFor = ["lesson_completion", "lesson_discard", "manual"];
    const updatedFor = validFor.includes(body.updated_for ?? "")
      ? (body.updated_for as SubjectWorkpad["last_updated_for"])
      : "manual";

    const subject = db.prepare("SELECT id, learner_id FROM subjects WHERE id = ?").get(subjectId) as
      | { id: number; learner_id: number }
      | undefined;
    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    if (subject.learner_id !== learnerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Upsert — increment version on update
    db.prepare(
      `INSERT INTO subject_workpads (subject_id, learner_id, content, version, last_updated_by, last_updated_for, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, datetime('now'))
       ON CONFLICT (subject_id, learner_id)
       DO UPDATE SET
         content = excluded.content,
         version = version + 1,
         last_updated_by = excluded.last_updated_by,
         last_updated_for = excluded.last_updated_for,
         updated_at = datetime('now')`
    ).run(subjectId, learnerId, content, updatedBy, updatedFor);

    const workpad = db
      .prepare("SELECT * FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
      .get(subjectId, learnerId) as SubjectWorkpad;

    return NextResponse.json({ workpad });
  } catch (err) {
    console.error("[api/subjects/:id/workpad PUT]", err);
    return NextResponse.json({ error: "Failed to update workpad" }, { status: 500 });
  }
}
