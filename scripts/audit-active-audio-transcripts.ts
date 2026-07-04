#!/usr/bin/env tsx
/**
 * Deterministic preflight for active lesson audio transcripts.
 *
 * This is NOT semantic approval. It catches obvious hard failures, then reminds
 * the worker that a separate LLM reviewer must still judge transcript quality.
 */
import { getDb, closeDb } from "../src/db/connection";
import { validateLearnerFacingAudioTranscript } from "../src/lib/audio/transcript-quality";

interface Row {
  lesson_id: number;
  lesson_title: string;
  activity_id: number;
  activity_title: string | null;
  activity_type: string;
  content: string | null;
}

function transcriptFor(row: Row): string {
  try {
    const content = row.content ? JSON.parse(row.content) : {};
    if (row.activity_type === "lesson_part") {
      return String(content.audio?.transcript || content.audio?.script || "");
    }
    return String(content.transcript || content.script || "");
  } catch {
    return "";
  }
}

function main() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT l.id AS lesson_id, l.title AS lesson_title,
              a.id AS activity_id, a.title AS activity_title,
              a.activity_type, a.content
         FROM lessons l
         JOIN lesson_activities a ON a.lesson_id = l.id
        WHERE l.status = 'in_progress'
          AND a.activity_type IN ('audio', 'lesson_part')
        ORDER BY l.id, a.sequence_order`
    )
    .all() as Row[];

  const failures = [];
  const summaries = [];
  for (const row of rows) {
    const transcript = transcriptFor(row);
    const result = validateLearnerFacingAudioTranscript(transcript, {
      requireLongOverview: row.activity_type === "audio",
      minWords: row.activity_type === "lesson_part" ? 200 : undefined,
    });
    summaries.push({
      lesson_id: row.lesson_id,
      activity_id: row.activity_id,
      activity_type: row.activity_type,
      words: result.metrics.words,
      questions: result.metrics.questions,
      leoTurns: result.metrics.leoTurns,
      mayaTurns: result.metrics.mayaTurns,
      hard_preflight_ok: result.ok,
    });
    if (!result.ok) {
      failures.push({
        lesson_id: row.lesson_id,
        lesson_title: row.lesson_title,
        activity_id: row.activity_id,
        activity_title: row.activity_title,
        activity_type: row.activity_type,
        errors: result.errors,
        metrics: result.metrics,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        checked: rows.length,
        hard_failures: failures.length,
        llm_qa_required:
          "YES. Passing this script only means obvious metadata/scaffolding leaks were not found. A separate reviewer agent must still read transcripts for usefulness, interest, concept specificity, analogies, examples, failure modes, and whether the audio teaches the lesson.",
        failures,
        summaries,
      },
      null,
      2
    )
  );
  closeDb();
  if (failures.length > 0) process.exit(1);
}

main();
