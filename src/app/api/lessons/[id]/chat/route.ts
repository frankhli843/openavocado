import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import {
  getLessonChatReply,
  loadFeedbackConfig,
  summarizeLessonChat,
  type LessonChatMessage as LlmChatMessage,
} from "@/lib/feedback-llm";
import type { Lesson, LessonActivity, LessonChatMessage, LessonChatState } from "@/types";

const RECENT_MESSAGE_LIMIT = 16;
const COMPACT_BATCH_MIN = 8;

/** GET /api/lessons/:id/chat — saved per-lesson chat history. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lessonId = Number(id);
    const learnerId = Number(new URL(request.url).searchParams.get("learner_id") ?? "1");
    const config = loadFeedbackConfig();
    const db = getDb();

    if (!lessonId || !learnerId) {
      return NextResponse.json({ error: "lesson id and learner_id are required" }, { status: 400 });
    }
    const lesson = db.prepare("SELECT id FROM lessons WHERE id = ?").get(lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const messages = db
      .prepare(
        `SELECT * FROM lesson_chat_messages
         WHERE lesson_id = ? AND learner_id = ?
         ORDER BY id ASC`
      )
      .all(lessonId, learnerId) as LessonChatMessage[];

    return NextResponse.json({
      enabled: config.enabled,
      provider: config.enabled ? config.provider : null,
      messages,
    });
  } catch (err) {
    console.error("[api/lessons/:id/chat GET]", err);
    return NextResponse.json({ error: "Failed to load lesson chat" }, { status: 500 });
  }
}

/** POST /api/lessons/:id/chat — append a learner question and generate a reply. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lessonId = Number(id);
    const body = (await request.json()) as { learner_id?: number; message?: string };
    const learnerId = body.learner_id ?? 1;
    const message = body.message?.trim() ?? "";

    if (!lessonId || !message) {
      return NextResponse.json({ error: "lesson id and message are required" }, { status: 400 });
    }
    if (message.length > 4000) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    const config = loadFeedbackConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { enabled: false, error: "Lesson chat is not configured" },
        { status: 503 }
      );
    }

    const db = getDb();
    const lesson = db
      .prepare("SELECT * FROM lessons WHERE id = ?")
      .get(lessonId) as Lesson | undefined;
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    db.prepare(
      `INSERT INTO lesson_chat_state (lesson_id, learner_id)
       VALUES (?, ?)
       ON CONFLICT(lesson_id, learner_id) DO NOTHING`
    ).run(lessonId, learnerId);

    db.prepare(
      `INSERT INTO lesson_chat_messages (lesson_id, learner_id, role, content)
       VALUES (?, ?, 'user', ?)`
    ).run(lessonId, learnerId, message);

    const { compactSummary, compactedThroughId } = await maybeCompactHistory(db, config, lessonId, learnerId);
    const allMessages = loadMessages(db, lessonId, learnerId);
    const recentMessages = allMessages
      .filter((m) => m.id > (compactedThroughId ?? 0))
      .slice(-RECENT_MESSAGE_LIMIT)
      .map(toLlmMessage);

    const activities = db
      .prepare(
        `SELECT * FROM lesson_activities
         WHERE lesson_id = ?
         ORDER BY sequence_order ASC`
      )
      .all(lessonId) as LessonActivity[];

    const reply = await getLessonChatReply(config, {
      lessonTitle: lesson.title,
      lessonDescription: lesson.description ?? null,
      lessonContext: buildLessonContext(lesson, activities),
      compactSummary,
      messages: recentMessages,
    });

    db.prepare(
      `INSERT INTO lesson_chat_messages (lesson_id, learner_id, role, content)
       VALUES (?, ?, 'assistant', ?)`
    ).run(lessonId, learnerId, reply);

    return NextResponse.json({
      enabled: true,
      message: reply,
      messages: loadMessages(db, lessonId, learnerId),
    });
  } catch (err) {
    console.error("[api/lessons/:id/chat POST]", err);
    return NextResponse.json(
      { enabled: true, error: "Lesson chat failed" },
      { status: 500 }
    );
  }
}

function loadMessages(db: ReturnType<typeof getDb>, lessonId: number, learnerId: number): LessonChatMessage[] {
  return db
    .prepare(
      `SELECT * FROM lesson_chat_messages
       WHERE lesson_id = ? AND learner_id = ?
       ORDER BY id ASC`
    )
    .all(lessonId, learnerId) as LessonChatMessage[];
}

async function maybeCompactHistory(
  db: ReturnType<typeof getDb>,
  config: ReturnType<typeof loadFeedbackConfig>,
  lessonId: number,
  learnerId: number
): Promise<{ compactSummary: string | null; compactedThroughId: number | null }> {
  const state = db
    .prepare(
      `SELECT * FROM lesson_chat_state
       WHERE lesson_id = ? AND learner_id = ?`
    )
    .get(lessonId, learnerId) as LessonChatState | undefined;

  const compactedThroughId = state?.compacted_through_message_id ?? null;
  const candidates = loadMessages(db, lessonId, learnerId)
    .filter((m) => m.id > (compactedThroughId ?? 0))
    .slice(0, -RECENT_MESSAGE_LIMIT);

  if (candidates.length < COMPACT_BATCH_MIN) {
    return {
      compactSummary: state?.compact_summary?.trim() || null,
      compactedThroughId,
    };
  }

  let newSummary: string;
  try {
    newSummary = await summarizeLessonChat(
      config,
      state?.compact_summary ?? null,
      candidates.map(toLlmMessage)
    );
  } catch (err) {
    console.error("[api/lessons/:id/chat] compaction failed", err);
    return {
      compactSummary: state?.compact_summary?.trim() || null,
      compactedThroughId,
    };
  }
  const nextCompactedThroughId = candidates[candidates.length - 1]?.id ?? compactedThroughId;

  db.prepare(
    `UPDATE lesson_chat_state
     SET compact_summary = ?, compacted_through_message_id = ?, updated_at = datetime('now')
     WHERE lesson_id = ? AND learner_id = ?`
  ).run(newSummary, nextCompactedThroughId, lessonId, learnerId);

  return { compactSummary: newSummary, compactedThroughId: nextCompactedThroughId };
}

function toLlmMessage(message: LessonChatMessage): LlmChatMessage {
  return { role: message.role, content: message.content };
}

function buildLessonContext(lesson: Lesson, activities: LessonActivity[]): string {
  const parts: string[] = [];
  if (lesson.goals) {
    try {
      const goals = JSON.parse(lesson.goals) as string[];
      if (Array.isArray(goals) && goals.length) {
        parts.push(`Goals:\n${goals.map((g) => `- ${g}`).join("\n")}`);
      }
    } catch {
      /* ignore malformed goals */
    }
  }

  if (lesson.knowledge_graph_data) {
    try {
      const graph = JSON.parse(lesson.knowledge_graph_data) as { title?: string; description?: string };
      const graphText = [graph.title, graph.description].filter(Boolean).join(": ");
      if (graphText) parts.push(`Lesson map: ${graphText}`);
    } catch {
      /* ignore malformed graph */
    }
  }

  for (const activity of activities) {
    const text = summarizeActivity(activity);
    if (text) parts.push(text);
  }

  return parts.join("\n\n").slice(0, 12000);
}

function summarizeActivity(activity: LessonActivity): string {
  if (!activity.content) return "";
  try {
    const parsed = JSON.parse(activity.content) as Record<string, unknown>;
    if (activity.activity_type === "lesson_part") {
      const reading = parsed.reading as { intro?: string; summary?: string; blocks?: Array<Record<string, unknown>> } | undefined;
      const snippets = [
        reading?.intro,
        ...(reading?.blocks ?? []).flatMap((b) => [
          typeof b.text === "string" ? b.text : "",
          typeof b.definition === "string" ? b.definition : "",
          typeof b.body === "string" ? b.body : "",
        ]),
        reading?.summary,
      ].filter(Boolean);
      return `Lesson part: ${activity.title ?? "Untitled"}\n${snippets.join("\n").slice(0, 2400)}`;
    }
    if (activity.activity_type === "assessment") {
      const questions = Array.isArray(parsed.questions) ? parsed.questions as Array<{ text?: string; actual_answer?: string }> : [];
      if (!questions.length) return "";
      return `Assessment questions:\n${questions.slice(0, 12).map((q) => `- ${q.text ?? ""}`).join("\n")}`;
    }
    if (typeof parsed.script === "string") {
      return `${activity.title ?? activity.activity_type}:\n${parsed.script.slice(0, 1600)}`;
    }
    if (typeof parsed.prompt === "string") {
      return `${activity.title ?? activity.activity_type}:\n${parsed.prompt.slice(0, 1200)}`;
    }
  } catch {
    return `${activity.title ?? activity.activity_type}:\n${activity.content.slice(0, 1200)}`;
  }
  return "";
}
