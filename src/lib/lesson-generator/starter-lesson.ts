import type Database from "better-sqlite3";
import type { SubjectCreatedEvent } from "@/types";
import type { ReadingContent } from "@/lib/lesson-content/schema";

/**
 * Generate a deterministic orientation lesson for a newly-created subject.
 * No LLM required — content is derived from subject metadata provided at
 * creation time. Used by the local-queue adapter for self-hosted deployments
 * that have no task runner or Dora endpoint.
 *
 * The lesson contains:
 *  - A reading activity: orientation overview using the subject's title,
 *    description, and goals
 *  - An assessment activity: three open-ended questions capturing the
 *    learner's starting knowledge so subsequent lessons can be better targeted
 */
export function generateStarterLesson(
  db: Database.Database,
  event: SubjectCreatedEvent
): { lesson_id: number; lesson_title: string } {
  const title = `Getting Started: ${event.subject_title}`;
  const description = event.subject_description
    ? `An orientation lesson for ${event.subject_title}: ${event.subject_description}`
    : `An orientation lesson to set the stage for your ${event.subject_title} learning journey.`;

  const goals = JSON.stringify([
    "Clarify what you already know and what you want to learn",
    "Understand the scope and approach for this subject",
  ]);
  const tags = JSON.stringify(["orientation", "getting-started"]);

  const lessonResult = db
    .prepare(
      `INSERT INTO lessons (subject_id, title, description, status, sequence_number, goals, tags, generated_by, generator_version)
       VALUES (?, ?, ?, 'queued', 1, ?, ?, 'prodavo-internal/v1', '1.0.0')`
    )
    .run(event.subject_id, title, description, goals, tags);
  const lesson_id = lessonResult.lastInsertRowid as number;

  // Reading activity — orientation overview derived from subject metadata
  const readingContent: ReadingContent = {
    intro: buildIntro(event),
    blocks: buildReadingBlocks(event),
    summary:
      "This orientation sets the foundation for your study. Complete the assessment below to capture your starting point — the more context you give, the better the next lesson will be.",
  };

  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'reading', 1, 1, ?, ?)`
  ).run(lesson_id, `Overview: ${event.subject_title}`, JSON.stringify(readingContent));

  // Assessment activity — capture starting knowledge for adaptive targeting
  const assessmentContent = {
    questions: [
      {
        id: "q1",
        text: `What do you already know about ${event.subject_title}? Describe your current level of understanding.`,
        type: "free_text",
      },
      {
        id: "q2",
        text: `What are you most hoping to learn or be able to do after completing this subject?`,
        type: "free_text",
      },
      {
        id: "q3",
        text: `Is there anything you find confusing or challenging about ${event.subject_title} so far?`,
        type: "free_text",
      },
    ],
  };

  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'assessment', 1, 2, ?, ?)`
  ).run(
    lesson_id,
    "Assessment: Where Are You Starting From?",
    JSON.stringify(assessmentContent)
  );

  return { lesson_id, lesson_title: title };
}

function buildIntro(event: SubjectCreatedEvent): string {
  if (event.subject_description) {
    return `Welcome to ${event.subject_title}. ${event.subject_description}`;
  }
  return `Welcome to ${event.subject_title}. This orientation lesson helps you map out what you already know and what you want to learn.`;
}

function buildReadingBlocks(event: SubjectCreatedEvent): ReadingContent["blocks"] {
  const blocks: ReadingContent["blocks"] = [];

  blocks.push({ type: "heading", text: "What is this subject about?" });

  if (event.subject_description) {
    blocks.push({ type: "paragraph", text: event.subject_description });
  } else {
    blocks.push({
      type: "paragraph",
      text: `${event.subject_title} is the focus of this learning track. As you work through lessons, you will build your understanding progressively from familiarity to mastery.`,
    });
  }

  if (event.subject_goals) {
    blocks.push({
      type: "callout",
      tone: "info",
      text: `Learning goals: ${event.subject_goals}`,
    });
  }

  blocks.push({ type: "heading", text: "How this works" });

  blocks.push({
    type: "list",
    ordered: true,
    items: [
      "Each lesson builds on the last, targeting your current level.",
      "Complete assessments honestly — your answers shape the next lesson.",
      "Discard a lesson if it does not fit and get a better replacement.",
      "Your progress and mastery signals are tracked automatically.",
    ],
  });

  blocks.push({
    type: "callout",
    tone: "insight",
    text: "The assessment below captures your starting point. Be honest — there are no wrong answers, and the more context you give, the better the next lesson will be.",
  });

  return blocks;
}
