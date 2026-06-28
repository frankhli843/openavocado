import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { createSubjectJournalEntry } from "@/lib/subject-journal";
import type { SubjectJournalEntry, SubjectJournalEntryType } from "@/types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

const ENTRY_TYPES: SubjectJournalEntryType[] = [
  "lesson_completion",
  "lesson_generation",
  "research",
  "planning",
  "manual",
  "lesson_discard",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subjectId = Number(id);
    const { searchParams } = new URL(request.url);
    const learnerId = Number(searchParams.get("learner_id") ?? "1");
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_LIMIT))
    );
    const beforeId = searchParams.get("before_id")
      ? Number(searchParams.get("before_id"))
      : null;

    if (!subjectId || !learnerId) {
      return NextResponse.json({ error: "subject id and learner_id are required" }, { status: 400 });
    }

    const db = getDb();
    const subject = db.prepare("SELECT id, learner_id FROM subjects WHERE id = ?").get(subjectId) as
      | { id: number; learner_id: number }
      | undefined;
    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    if (subject.learner_id !== learnerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = db
      .prepare(
        `SELECT * FROM subject_journal_entries
         WHERE subject_id = ? AND learner_id = ?
           AND (? IS NULL OR id < ?)
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(subjectId, learnerId, beforeId, beforeId, limit + 1) as SubjectJournalEntry[];

    const entries = rows.slice(0, limit);
    const next_cursor = rows.length > limit ? entries[entries.length - 1]?.id ?? null : null;

    return NextResponse.json({ entries, next_cursor });
  } catch (err) {
    console.error("[api/subjects/:id/journal GET]", err);
    return NextResponse.json({ error: "Failed to load subject journal" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subjectId = Number(id);
    const body = (await request.json()) as {
      learner_id?: number;
      entry_type?: SubjectJournalEntryType;
      title?: string;
      content?: string;
      metadata?: Record<string, unknown> | null;
      created_by?: string | null;
    };
    const learnerId = body.learner_id ?? 1;
    const entryType = body.entry_type ?? "manual";
    const title = body.title?.trim() ?? "";
    const content = body.content?.trim() ?? "";

    if (!subjectId || !learnerId || !title || !content) {
      return NextResponse.json(
        { error: "subject id, learner_id, title, and content are required" },
        { status: 400 }
      );
    }
    if (!ENTRY_TYPES.includes(entryType)) {
      return NextResponse.json({ error: "Invalid entry_type" }, { status: 400 });
    }

    const db = getDb();
    const subject = db.prepare("SELECT id, learner_id FROM subjects WHERE id = ?").get(subjectId) as
      | { id: number; learner_id: number }
      | undefined;
    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    if (subject.learner_id !== learnerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const journalId = createSubjectJournalEntry(db, {
      subject_id: subjectId,
      learner_id: learnerId,
      entry_type: entryType,
      title,
      content,
      metadata: body.metadata ?? null,
      created_by: body.created_by ?? "avocadocore-api",
    });

    const entry = db
      .prepare("SELECT * FROM subject_journal_entries WHERE id = ?")
      .get(journalId) as SubjectJournalEntry;

    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    console.error("[api/subjects/:id/journal POST]", err);
    return NextResponse.json({ error: "Failed to create subject journal entry" }, { status: 500 });
  }
}
