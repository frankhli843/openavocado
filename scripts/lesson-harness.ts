#!/usr/bin/env tsx
/**
 * AvocadoCore Agentic Lesson-Generation Harness
 *
 * Invoked by the agent-harness adapter when a lesson event fires.
 * Receives a JSON payload via stdin describing the event, generates a real
 * lesson using the configured provider (Google AI Studio / Gemini by default),
 * and outputs a JSON result line on stdout.
 *
 * Usage (set AVOCADOCORE_AGENT_HARNESS_COMMAND in .env):
 *   AVOCADOCORE_AGENT_HARNESS_COMMAND="tsx /path/to/scripts/lesson-harness.ts"
 *
 * Environment:
 *   AVOCADOCORE_DB_PATH           — SQLite DB path (same as app)
 *   GOOGLE_AI_STUDIO_API_KEY      — Gemini API key (server-side only, never logged)
 *   GOOGLE_AI_STUDIO_MODEL        — model name (default: gemini-2.5-flash)
 *   AVOCADOCORE_FEEDBACK_PROVIDER — secondary provider config (google = Gemini)
 *   AVOCADOCORE_LOCAL_QUEUE_AUDIO — "skip" to skip audio generation (testing)
 *
 * Output contract (last JSON-looking line on stdout):
 *   { ok: true, ref: "agent-harness-lesson-N", lesson_id: N }
 *   { ok: false, error: "..." }
 *
 * The harness updates next_lesson_jobs.harness_stage and progress_events in
 * real-time so the subject page can show granular status while it runs.
 */

import { getDb, closeDb } from "../src/db/connection";
import { generateInitialAssessment } from "../src/lib/lesson-generator/initial-assessment";
import { generateLessonAudio } from "../src/lib/audio/generate-lesson-audio";
import type Database from "better-sqlite3";
import type {
  SubjectCreatedEvent,
  LessonCompletedEvent,
  LessonDiscardedEvent,
} from "../src/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HarnessPayload {
  event_type: string;
  event: SubjectCreatedEvent | LessonCompletedEvent | LessonDiscardedEvent;
  provider: string;
  provider_status: { status: string; model?: string } | null;
  contract: {
    expected_output: string;
    chrome_mcp_required: boolean;
    local_queue_fallback_allowed: boolean;
  };
}

interface HarnessResult {
  ok: boolean;
  ref?: string;
  lesson_id?: number;
  error?: string;
  provider_used?: string;
  stage_reached?: string;
}

interface GeminiLessonDraft {
  title: string;
  description: string;
  audio_script: string;
  reading_intro: string;
  reading_blocks: ReadingBlock[];
  reading_summary: string;
  assessment_questions: AssessmentQuestion[];
  quiz_questions: QuizQuestion[];
  next_lesson_diagnostics: DiagnosticQuestion[];
  planning_rationale: string;
  concept_tags: string[];
}

interface ReadingBlock {
  type: "heading" | "paragraph" | "definition" | "example" | "callout" | "list";
  text?: string;
  term?: string;
  definition?: string;
  title?: string;
  body?: string;
  tone?: string;
  ordered?: boolean;
  items?: string[];
}

interface AssessmentQuestion {
  id: string;
  text: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard";
  actual_answer?: string;
  rubric?: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard";
  grounding_required?: boolean;
  learning_scope?: "taught" | "review";
  support_ref?: string;
}

interface DiagnosticQuestion {
  id: string;
  prompt: string;
  hint: string;
}

// ─── Progress tracking ────────────────────────────────────────────────────────

function updateJobProgress(
  db: Database.Database,
  subjectId: number,
  triggerEvent: string,
  stage: string,
  message: string
): void {
  try {
    const job = db
      .prepare(
        `SELECT id, progress_events FROM next_lesson_jobs
         WHERE subject_id = ? AND trigger_event = ? AND status = 'dispatched'
         ORDER BY id DESC LIMIT 1`
      )
      .get(subjectId, triggerEvent) as { id: number; progress_events: string | null } | undefined;

    if (!job) return;

    const events: Array<{ ts: string; stage: string; message: string }> = [];
    if (job.progress_events) {
      try {
        const parsed = JSON.parse(job.progress_events);
        if (Array.isArray(parsed)) events.push(...parsed);
      } catch { /* ignore */ }
    }
    events.push({ ts: new Date().toISOString(), stage, message });

    db.prepare(
      `UPDATE next_lesson_jobs
       SET harness_stage = ?, progress_events = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(stage, JSON.stringify(events), job.id);
  } catch {
    // Progress updates are best-effort — never fail the harness over them
  }
}

// ─── Google AI Studio / Gemini call ──────────────────────────────────────────

function getGeminiKey(): string {
  return (process.env.GOOGLE_AI_STUDIO_API_KEY ?? "").trim();
}

function getGeminiModel(): string {
  return (
    process.env.GOOGLE_AI_STUDIO_MODEL ??
    process.env.AVOCADOCORE_FEEDBACK_MODEL ??
    "gemini-2.5-flash"
  );
}

async function callGemini(prompt: string): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error("GOOGLE_AI_STUDIO_API_KEY is not set");

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      temperature: 0.7,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Never include the API key in error messages
    const safe = text.replace(key, "[redacted]").slice(0, 400);
    throw new Error(`Gemini HTTP ${res.status}: ${safe}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    const safe = data.error.message.replace(key, "[redacted]").slice(0, 300);
    throw new Error(`Gemini API error: ${safe}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

// ─── Learner context query ────────────────────────────────────────────────────

function buildLearnerContext(
  db: Database.Database,
  subjectId: number,
  learnerId: number
): string {
  const subject = db
    .prepare("SELECT title, description, goals, criteria, current_level FROM subjects WHERE id = ?")
    .get(subjectId) as {
      title: string;
      description: string | null;
      goals: string | null;
      criteria: string | null;
      current_level: string;
    } | undefined;

  if (!subject) return "(subject not found)";

  const completedLessons = db
    .prepare(
      `SELECT title, description, sequence_number
       FROM lessons WHERE subject_id = ? AND status = 'completed'
       ORDER BY sequence_number ASC LIMIT 10`
    )
    .all(subjectId) as Array<{ title: string; description: string | null; sequence_number: number }>;

  const masterySignals = db
    .prepare(
      `SELECT ms.signal_type, ms.confidence, ms.difficulty, COALESCE(t.name, ms.concept) AS concept
       FROM mastery_signals ms
       LEFT JOIN tags t ON t.id = ms.tag_id
       WHERE ms.learner_id = ? AND ms.subject_id = ?
       ORDER BY ms.created_at DESC LIMIT 20`
    )
    .all(learnerId, subjectId) as Array<{
      signal_type: string;
      confidence: number;
      difficulty: string | null;
      concept: string;
    }>;

  const recentAssessments = db
    .prepare(
      `SELECT ar.question_id, ar.outcome, ar.question_type, ar.concept, ar.difficulty
       FROM assessment_results ar
       WHERE ar.learner_id = ? AND ar.subject_id = ?
       ORDER BY ar.created_at DESC LIMIT 15`
    )
    .all(learnerId, subjectId) as Array<{
      question_id: string;
      outcome: string;
      question_type: string;
      concept: string | null;
      difficulty: string | null;
    }>;

  const workpad = db
    .prepare("SELECT content FROM subject_workpads WHERE subject_id = ? AND learner_id = ? ORDER BY updated_at DESC LIMIT 1")
    .get(subjectId, learnerId) as { content: string } | undefined;

  const nextSeq = db
    .prepare("SELECT COALESCE(MAX(sequence_number), -1) + 1 AS next_seq FROM lessons WHERE subject_id = ?")
    .get(subjectId) as { next_seq: number };

  const lines: string[] = [
    `SUBJECT: ${subject.title}`,
    subject.description ? `Description: ${subject.description}` : "",
    subject.goals ? `Goals: ${subject.goals}` : "",
    subject.criteria ? `Success criteria: ${subject.criteria}` : "",
    `Current level: ${subject.current_level}`,
    `Next lesson sequence number: ${nextSeq.next_seq}`,
    "",
    `COMPLETED LESSONS (${completedLessons.length}):`,
    ...completedLessons.map(
      (l) => `  [${l.sequence_number}] ${l.title}`
    ),
    "",
    `MASTERY SIGNALS (recent, ${masterySignals.length}):`,
    ...masterySignals.slice(0, 10).map(
      (m) =>
        `  ${m.signal_type} | concept: ${m.concept} | confidence: ${m.confidence} | difficulty: ${m.difficulty ?? "unset"}`
    ),
    "",
    `RECENT ASSESSMENT EVIDENCE (${recentAssessments.length}):`,
    ...recentAssessments.slice(0, 8).map(
      (a) =>
        `  [${a.outcome}] ${a.question_id.slice(0, 120)} (concept: ${a.concept ?? "?"}, difficulty: ${a.difficulty ?? "?"})`
    ),
    "",
    workpad ? `WORKPAD (planning notes):\n${workpad.content.slice(0, 1000)}` : "(no workpad yet)",
  ];

  return lines.filter((l) => l !== "").join("\n");
}

// ─── Gemini lesson generation prompt ─────────────────────────────────────────

function buildLessonPrompt(
  context: string,
  eventType: string,
  discardedLessonTitle?: string
): string {
  const trigger =
    eventType === "lesson.discarded"
      ? `The previous lesson "${discardedLessonTitle ?? "unknown"}" was discarded. Generate a replacement that takes a different approach.`
      : "Generate the next adaptive teaching lesson based on the learner evidence above.";

  return `You are an expert adaptive learning designer for AvocadoCore, an adaptive learning system.

LEARNER CONTEXT:
${context}

TASK:
${trigger}

Generate a high-quality adaptive lesson for this learner. The lesson must:
- Be pedagogically grounded in the learner's actual evidence (mastery signals, assessment results, completed lessons)
- Include a clear planning_rationale explaining WHY this lesson is the right next step NOW
- Have a rich audio script (target 800-1200 words — the learner will listen to this as their primary learning)
- Include 3-5 substantive reading blocks that teach the concept clearly with examples
- Include 2-3 open-ended assessment questions that check understanding
- Include 3-4 multiple-choice quiz questions grounded in taught material
- Include 2 next-lesson diagnostic questions (look-ahead probes, NOT graded)
- Be specific to this subject and learner — avoid generic filler content

CRITICAL: Use the mastery signals and assessment evidence to personalize content.
- If a concept has low confidence signals: address it directly and carefully
- If a concept shows strength: acknowledge it and build forward from it
- If there are recent incorrect answers: address that misconception clearly
- The audio script must feel like a skilled human tutor speaking directly to this learner

Return ONLY a valid JSON object matching this exact schema (no markdown, no prose, just JSON):

{
  "title": "Specific lesson title (not generic)",
  "description": "2-3 sentence description of what this lesson covers and why",
  "planning_rationale": "2-3 sentences explaining why this is the right next lesson for this specific learner right now",
  "audio_script": "Full audio narration script (800-1200 words, conversational, addresses learner directly)",
  "reading_intro": "Opening paragraph for the reading section (2-3 sentences)",
  "reading_blocks": [
    {
      "type": "heading",
      "text": "Section heading"
    },
    {
      "type": "paragraph",
      "text": "Explanatory paragraph..."
    },
    {
      "type": "definition",
      "term": "Key term",
      "definition": "Clear definition in learner language"
    },
    {
      "type": "example",
      "title": "Concrete example title",
      "body": "Example explanation..."
    },
    {
      "type": "callout",
      "tone": "insight",
      "text": "Key insight or warning..."
    },
    {
      "type": "list",
      "ordered": true,
      "items": ["Step 1...", "Step 2...", "Step 3..."]
    }
  ],
  "reading_summary": "1-2 sentence summary of what the reading section covered",
  "assessment_questions": [
    {
      "id": "free_1",
      "text": "Open-ended question that checks deep understanding",
      "concept": "the concept being tested",
      "difficulty": "easy",
      "actual_answer": "Expected answer or key points the learner should mention",
      "rubric": "What a good answer includes"
    }
  ],
  "quiz_questions": [
    {
      "id": "mc_1",
      "question": "Multiple choice question grounded in what was just taught",
      "choices": ["Option A", "Option B", "Option C"],
      "correct_index": 0,
      "explanation": "Why this answer is correct, citing specific lesson content",
      "concept": "concept being tested",
      "difficulty": "medium",
      "grounding_required": true,
      "learning_scope": "taught",
      "support_ref": "reference to the specific reading block or audio section"
    }
  ],
  "next_lesson_diagnostics": [
    {
      "id": "diag_1",
      "prompt": "What aspect of [topic] still feels unclear or would you most like to explore next?",
      "hint": "Think about what concepts felt shaky or what you'd want to apply first."
    }
  ],
  "concept_tags": ["tag1", "tag2", "tag3"]
}`;
}

// ─── Lesson assembly and DB write ─────────────────────────────────────────────

function insertGeneratedLesson(
  db: Database.Database,
  draft: GeminiLessonDraft,
  subjectId: number,
  learnerId: number,
  eventType: string
): number {
  const maxSeq = db
    .prepare("SELECT COALESCE(MAX(sequence_number), 0) AS max_seq FROM lessons WHERE subject_id = ?")
    .get(subjectId) as { max_seq: number };
  const sequenceNumber = maxSeq.max_seq + 1;

  const goals = JSON.stringify([
    `Understand and apply ${draft.concept_tags[0] ?? "the core concept"}`,
    `Connect new knowledge to ${draft.concept_tags[1] ?? "prior learning"}`,
    "Leave structured evidence for the next adaptive lesson",
  ]);

  const sourceContext = {
    trigger: eventType,
    generated_by: "agent-harness/gemini/v1",
    planning_rationale: draft.planning_rationale,
    provider: "google-ai-studio",
    model: getGeminiModel(),
    concept_tags: draft.concept_tags,
    generated_at: new Date().toISOString(),
  };

  const lessonResult = db
    .prepare(
      `INSERT INTO lessons
         (subject_id, title, description, status, sequence_number, goals, tags,
          generated_by, generator_version, source_context)
       VALUES (?, ?, ?, 'queued', ?, ?, ?, 'agent-harness/gemini/v1', '1.0.0', ?)`
    )
    .run(
      subjectId,
      draft.title,
      draft.description,
      sequenceNumber,
      goals,
      JSON.stringify(draft.concept_tags),
      JSON.stringify(sourceContext)
    );

  const lessonId = Number(lessonResult.lastInsertRowid);

  const insertActivity = db.prepare(
    `INSERT INTO lesson_activities
       (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  // 1. Audio activity
  insertActivity.run(
    lessonId,
    "audio",
    1,
    1,
    `Audio: ${draft.title}`,
    JSON.stringify({
      script: draft.audio_script,
      duration_hint: Math.round(draft.audio_script.split(/\s+/).length / 150) * 60,
      planning_rationale: draft.planning_rationale,
    })
  );

  // 2. Reading activity
  insertActivity.run(
    lessonId,
    "reading",
    1,
    2,
    `Read: ${draft.title}`,
    JSON.stringify({
      intro: draft.reading_intro,
      blocks: draft.reading_blocks,
      summary: draft.reading_summary,
    })
  );

  // 3. Interactive activity (declarative widget)
  const concept0 = draft.concept_tags[0] ?? "the concept";
  const concept1 = draft.concept_tags[1] ?? "application";
  insertActivity.run(
    lessonId,
    "interactive",
    1,
    3,
    `Explore: ${draft.title} — readiness check`,
    JSON.stringify({
      schema_version: "1.0",
      widget_type: "declarative",
      title: `${draft.title} — learning pressure`,
      instructions:
        "Adjust the sliders to reflect your confidence in each area. " +
        "Watch how readiness changes. This is a self-assessment tool, not a grade.",
      controls: [
        {
          type: "slider",
          id: "concept_clarity",
          label: `Clarity on ${concept0}`,
          min: 0,
          max: 10,
          step: 1,
          default: 4,
        },
        {
          type: "slider",
          id: "application_depth",
          label: `Ability to apply ${concept1}`,
          min: 0,
          max: 10,
          step: 1,
          default: 3,
        },
        {
          type: "slider",
          id: "example_recall",
          label: "Can recall a concrete example",
          min: 0,
          max: 10,
          step: 1,
          default: 5,
        },
      ],
      outputs: [
        {
          id: "readiness",
          label: "Lesson readiness",
          formula: "(concept_clarity * 0.45 + application_depth * 0.35 + example_recall * 0.20) * 10",
          format: "percent",
          precision: 0,
          description: "Weighted readiness across the three dimensions.",
        },
        {
          id: "gap",
          label: "Gap to address",
          formula: "100 - readiness",
          format: "percent",
          precision: 0,
        },
      ],
      charts: [
        {
          type: "bar",
          title: "Self-assessment by dimension",
          bars: [
            { label: `${concept0} clarity`, ref: "concept_clarity", color: "#2563eb" },
            { label: `${concept1} depth`, ref: "application_depth", color: "#16a34a" },
            { label: "Example recall", ref: "example_recall", color: "#f59e0b" },
          ],
          max: 10,
        },
      ],
      panels: [
        {
          title: "What this means",
          template:
            `Your current readiness is {{readiness}}. ` +
            `Focus on the dimension with the lowest slider if you want to improve the most.`,
        },
      ],
    })
  );

  // 4. Assessment activity
  insertActivity.run(
    lessonId,
    "assessment",
    1,
    4,
    "Check: Reflect, consolidate, and shape the next lesson",
    JSON.stringify({
      questions: draft.assessment_questions,
      quiz: {
        pass_threshold: Math.max(1, Math.floor(draft.quiz_questions.length * 0.6)),
        idk_option: true,
        questions: draft.quiz_questions,
      },
    })
  );

  // 5. Next-lesson diagnostics (stored on the lesson row)
  db.prepare(
    `UPDATE lessons SET next_lesson_diagnostics = ? WHERE id = ?`
  ).run(JSON.stringify(draft.next_lesson_diagnostics), lessonId);

  // Upsert tags
  upsertLessonTags(db, subjectId, lessonId, [
    "agent-harness",
    "gemini-generated",
    ...draft.concept_tags.slice(0, 5),
  ]);

  // Upsert workpad
  upsertWorkpad(db, subjectId, learnerId, lessonId, draft);

  return lessonId;
}

function upsertLessonTags(
  db: Database.Database,
  subjectId: number,
  lessonId: number,
  tags: string[]
): void {
  const insert = db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, 'concept')");
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

function upsertWorkpad(
  db: Database.Database,
  subjectId: number,
  learnerId: number,
  lessonId: number,
  draft: GeminiLessonDraft
): void {
  const addition = [
    `## ${new Date().toISOString()} agent-harness/gemini generation`,
    `Generated lesson: ${draft.title} (id ${lessonId})`,
    `Planning rationale: ${draft.planning_rationale}`,
    `Concept tags: ${draft.concept_tags.join(", ")}`,
    `Provider: google-ai-studio / ${getGeminiModel()}`,
  ].join("\n");

  const existing = db
    .prepare(
      "SELECT id, content, version FROM subject_workpads WHERE subject_id = ? AND learner_id = ?"
    )
    .get(subjectId, learnerId) as { id: number; content: string; version: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE subject_workpads
       SET content = ?, version = ?, last_updated_by = 'agent-harness/gemini/v1',
           last_updated_for = 'lesson_generation', updated_at = datetime('now')
       WHERE id = ?`
    ).run(`${existing.content}\n\n${addition}`, existing.version + 1, existing.id);
  } else {
    db.prepare(
      `INSERT INTO subject_workpads
         (subject_id, learner_id, content, last_updated_by, last_updated_for)
       VALUES (?, ?, ?, 'agent-harness/gemini/v1', 'lesson_generation')`
    ).run(subjectId, learnerId, addition);
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleSubjectCreated(
  db: Database.Database,
  event: SubjectCreatedEvent
): Promise<HarnessResult> {
  const { subject_id: subjectId, learner_id: learnerId } = event;

  // Stage: check for existing initial assessment (idempotency)
  updateJobProgress(db, subjectId, "subject.created", "provider.check", "Checking for existing initial assessment");
  const existing = db
    .prepare("SELECT id, title FROM lessons WHERE subject_id = ? AND sequence_number = 0 LIMIT 1")
    .get(subjectId) as { id: number; title: string } | undefined;

  if (existing) {
    updateJobProgress(db, subjectId, "subject.created", "lesson.generated", `Existing initial assessment found (lesson ${existing.id})`);
    return {
      ok: true,
      ref: `agent-harness-assessment-existing-${existing.id}`,
      lesson_id: existing.id,
      provider_used: "local-fixture",
      stage_reached: "lesson.generated",
    };
  }

  // Stage: generate initial assessment (deterministic, no LLM needed)
  updateJobProgress(db, subjectId, "subject.created", "local.fixture", "Generating initial assessment (deterministic calibration)");

  const result = generateInitialAssessment(db, event);

  updateJobProgress(db, subjectId, "subject.created", "lesson.generated", `Initial assessment ready (lesson ${result.lesson_id}, ${result.question_count} questions)`);

  return {
    ok: true,
    ref: `agent-harness-assessment-${result.lesson_id}`,
    lesson_id: result.lesson_id,
    provider_used: "local-fixture/initial-assessment",
    stage_reached: "lesson.generated",
  };
}

async function handleLessonCompleted(
  db: Database.Database,
  event: LessonCompletedEvent
): Promise<HarnessResult> {
  const { subject_id: subjectId, learner_id: learnerId } = event;
  const triggerEvent = "lesson.completed";

  // Check provider
  updateJobProgress(db, subjectId, triggerEvent, "provider.check", "Verifying Google AI Studio provider");
  const key = getGeminiKey();
  if (!key) {
    return { ok: false, error: "GOOGLE_AI_STUDIO_API_KEY is not configured. Cannot generate adaptive lesson." };
  }

  // Build learner context
  updateJobProgress(db, subjectId, triggerEvent, "researching", "Reading learner evidence from database");
  const context = buildLearnerContext(db, subjectId, learnerId);

  // Call Gemini
  updateJobProgress(db, subjectId, triggerEvent, "authoring", "Calling Gemini to generate adaptive lesson content");
  const prompt = buildLessonPrompt(context, event.event);
  const raw = await callGemini(prompt);

  // Parse response
  let draft: GeminiLessonDraft;
  try {
    draft = JSON.parse(raw) as GeminiLessonDraft;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Gemini response parse failed: ${msg}` };
  }

  // Validate essential fields
  if (!draft.title || !draft.audio_script || !draft.reading_blocks) {
    return {
      ok: false,
      error: `Gemini returned incomplete lesson draft (missing title/audio_script/reading_blocks)`,
    };
  }

  // Write to DB
  updateJobProgress(db, subjectId, triggerEvent, "validating", "Writing lesson to database");
  const lessonId = insertGeneratedLesson(db, draft, subjectId, learnerId, event.event);

  // Generate audio
  if (process.env.AVOCADOCORE_LOCAL_QUEUE_AUDIO !== "skip") {
    updateJobProgress(db, subjectId, triggerEvent, "generating_audio", "Generating lesson audio");
    try {
      await generateLessonAudio(db, lessonId);
    } catch (audioErr) {
      const msg = audioErr instanceof Error ? audioErr.message : String(audioErr);
      console.error(`[lesson-harness] Audio generation failed for lesson ${lessonId}: ${msg}`);
      // Audio failure is non-fatal — lesson is still usable
      updateJobProgress(db, subjectId, triggerEvent, "generating_audio", `Audio generation failed (non-fatal): ${msg.slice(0, 100)}`);
    }
  }

  updateJobProgress(db, subjectId, triggerEvent, "finalizing", `Lesson "${draft.title}" ready (id ${lessonId})`);

  return {
    ok: true,
    ref: `agent-harness-lesson-${lessonId}`,
    lesson_id: lessonId,
    provider_used: `google-ai-studio/${getGeminiModel()}`,
    stage_reached: "finalizing",
  };
}

async function handleLessonDiscarded(
  db: Database.Database,
  event: LessonDiscardedEvent
): Promise<HarnessResult> {
  const { subject_id: subjectId, learner_id: learnerId } = event;
  const triggerEvent = "lesson.discarded";

  updateJobProgress(db, subjectId, triggerEvent, "provider.check", "Verifying Google AI Studio provider");
  const key = getGeminiKey();
  if (!key) {
    return { ok: false, error: "GOOGLE_AI_STUDIO_API_KEY is not configured. Cannot generate replacement lesson." };
  }

  updateJobProgress(db, subjectId, triggerEvent, "researching", "Reading learner evidence from database");
  const context = buildLearnerContext(db, subjectId, learnerId);

  updateJobProgress(db, subjectId, triggerEvent, "authoring", "Calling Gemini to generate replacement lesson");
  const prompt = buildLessonPrompt(context, event.event, event.discarded_lesson_title);
  const raw = await callGemini(prompt);

  let draft: GeminiLessonDraft;
  try {
    draft = JSON.parse(raw) as GeminiLessonDraft;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Gemini response parse failed: ${msg}` };
  }

  if (!draft.title || !draft.audio_script || !draft.reading_blocks) {
    return {
      ok: false,
      error: "Gemini returned incomplete lesson draft (missing required fields)",
    };
  }

  updateJobProgress(db, subjectId, triggerEvent, "validating", "Writing replacement lesson to database");
  const lessonId = insertGeneratedLesson(db, draft, subjectId, learnerId, event.event);

  if (process.env.AVOCADOCORE_LOCAL_QUEUE_AUDIO !== "skip") {
    updateJobProgress(db, subjectId, triggerEvent, "generating_audio", "Generating audio for replacement lesson");
    try {
      await generateLessonAudio(db, lessonId);
    } catch (audioErr) {
      const msg = audioErr instanceof Error ? audioErr.message : String(audioErr);
      console.error(`[lesson-harness] Audio generation failed for lesson ${lessonId}: ${msg}`);
    }
  }

  updateJobProgress(db, subjectId, triggerEvent, "finalizing", `Replacement lesson "${draft.title}" ready (id ${lessonId})`);

  return {
    ok: true,
    ref: `agent-harness-lesson-${lessonId}`,
    lesson_id: lessonId,
    provider_used: `google-ai-studio/${getGeminiModel()}`,
    stage_reached: "finalizing",
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Read stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const input = Buffer.concat(chunks).toString("utf-8").trim();

  let payload: HarnessPayload;
  try {
    payload = JSON.parse(input) as HarnessPayload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputResult({ ok: false, error: `Payload parse failed: ${msg}` });
    return;
  }

  const db = getDb();

  try {
    let result: HarnessResult;

    if (payload.event_type === "subject.created") {
      result = await handleSubjectCreated(db, payload.event as SubjectCreatedEvent);
    } else if (payload.event_type === "lesson.completed") {
      result = await handleLessonCompleted(db, payload.event as LessonCompletedEvent);
    } else if (payload.event_type === "lesson.discarded") {
      result = await handleLessonDiscarded(db, payload.event as LessonDiscardedEvent);
    } else {
      result = { ok: false, error: `Unknown event_type: ${payload.event_type}` };
    }

    outputResult(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Sanitize: never print the API key in output
    const key = getGeminiKey();
    const safe = key ? msg.split(key).join("[redacted]") : msg;
    outputResult({ ok: false, error: safe.slice(0, 500) });
  } finally {
    closeDb();
  }
}

function outputResult(result: HarnessResult): void {
  // Always output the result as the last JSON line on stdout
  process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  const key = getGeminiKey();
  const safe = key ? msg.split(key).join("[redacted]") : msg;
  outputResult({ ok: false, error: `Harness uncaught error: ${safe.slice(0, 400)}` });
  process.exit(1);
});
