import type Database from "better-sqlite3";
import type { SubjectJournalEntryType } from "@/types";

export interface SubjectJournalInput {
  subject_id: number;
  learner_id: number;
  entry_type: SubjectJournalEntryType;
  title: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
}

export function createSubjectJournalEntry(
  db: Database.Database,
  input: SubjectJournalInput
): number {
  const result = db
    .prepare(
      `INSERT INTO subject_journal_entries
         (subject_id, learner_id, entry_type, title, content, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.subject_id,
      input.learner_id,
      input.entry_type,
      input.title,
      input.content,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.created_by ?? null
    );

  return Number(result.lastInsertRowid);
}
