import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import type { Lesson, LessonActivity, LessonAutosave, GeneratedArtifact } from "@/types";

/** GET /api/lessons/:id — full lesson detail with activities, autosave, artifacts */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const lessonId = Number(id);

    const lesson = db
      .prepare("SELECT * FROM lessons WHERE id = ?")
      .get(lessonId) as Lesson | undefined;

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const activities = db
      .prepare(
        "SELECT * FROM lesson_activities WHERE lesson_id = ? ORDER BY sequence_order ASC"
      )
      .all(lessonId) as LessonActivity[];

    const autosave = db
      .prepare(
        "SELECT * FROM lesson_autosave WHERE lesson_id = ? ORDER BY saved_at DESC"
      )
      .all(lessonId) as LessonAutosave[];

    const artifacts = db
      .prepare(
        "SELECT * FROM generated_artifacts WHERE lesson_id = ? ORDER BY generated_at DESC"
      )
      .all(lessonId) as GeneratedArtifact[];

    const tags = db
      .prepare(
        `SELECT t.* FROM tags t JOIN lesson_tags lt ON lt.tag_id = t.id WHERE lt.lesson_id = ?`
      )
      .all(lessonId);

    // Subject-level tags: all concept tags registered for this lesson's subject.
    // Returned alongside lesson tags so the knowledge graph can show the full
    // subject vocabulary and highlight which subset this lesson covers.
    const subjectTags = db
      .prepare(
        `SELECT t.* FROM tags t JOIN subject_tags st ON st.tag_id = t.id WHERE st.subject_id = ?`
      )
      .all(lesson.subject_id);

    // Mark lesson as in_progress when first fetched (if queued)
    if (lesson.status === "queued") {
      db.prepare(
        "UPDATE lessons SET status = 'in_progress', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
      ).run(lessonId);
      lesson.status = "in_progress";
      lesson.started_at = new Date().toISOString();
    }

    return NextResponse.json({ lesson, activities, autosave, artifacts, tags, subjectTags });
  } catch (err) {
    console.error("[api/lessons/:id]", err);
    return NextResponse.json({ error: "Failed to load lesson" }, { status: 500 });
  }
}
