/**
 * Generate a native prodavo teaching lesson after a learner completes the
 * previous lesson. This is intentionally deterministic: prodavo must be able to
 * prove the subject -> lesson -> complete -> next lesson loop without relying
 * on Dora/frankclaw private task infrastructure.
 */
import type Database from "better-sqlite3";
import type { LessonCompletedEvent } from "@/types";

export interface NextLessonResult {
  lesson_id: number;
  lesson_title: string;
  sequence_number: number;
}

export function generateNextLesson(
  db: Database.Database,
  event: LessonCompletedEvent
): NextLessonResult {
  const subject = db
    .prepare("SELECT title, goals, criteria, current_level FROM subjects WHERE id = ?")
    .get(event.subject_id) as
    | {
        title: string;
        goals: string | null;
        criteria: string | null;
        current_level: string;
      }
    | undefined;
  if (!subject) throw new Error(`Subject ${event.subject_id} not found`);

  const maxSeq = db
    .prepare("SELECT COALESCE(MAX(sequence_number), -1) AS max_seq FROM lessons WHERE subject_id = ?")
    .get(event.subject_id) as { max_seq: number };
  const sequenceNumber = Number(maxSeq.max_seq) + 1;
  const subjectTitle = subject.title || event.subject_title;
  const theme = chooseTheme(sequenceNumber);
  const title = `${theme.title}: ${subjectTitle}`;
  const concept = normalizeConcept(subjectTitle);
  const completedTitles = [
    event.lesson_title,
    ...event.completed_lessons.map((l) => l.title),
  ].filter(Boolean);
  const reviewFocus = event.concepts_to_review[0] || event.recent_misconceptions[0] || concept;
  const readyFocus = event.concepts_ready_to_advance[0] || concept;

  const sourceContext = {
    trigger: event.event,
    completed_lesson_id: event.lesson_id,
    completed_lesson_title: event.lesson_title,
    concepts_to_review: event.concepts_to_review,
    concepts_ready_to_advance: event.concepts_ready_to_advance,
    quiz_result: event.quiz_result,
    diagnostics: event.next_lesson_diagnostics,
    generated_by: "prodavo-local-queue/v1",
  };

  const lessonResult = db
    .prepare(
      `INSERT INTO lessons
         (subject_id, title, description, status, sequence_number, goals, tags,
          next_lesson_diagnostics, generated_by, generator_version, source_context)
       VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, 'prodavo-local-queue/v1', '1.0.0', ?)`
    )
    .run(
      event.subject_id,
      title,
      buildDescription(subjectTitle, theme.description, reviewFocus, readyFocus),
      sequenceNumber,
      JSON.stringify([
        `Build a usable mental model for ${subjectTitle}`,
        `Connect ${subjectTitle} to a concrete example`,
        `Leave clear evidence for the next adaptive lesson`,
      ]),
      JSON.stringify(["prodavo-native", theme.tag, concept]),
      JSON.stringify(buildDiagnostics(subjectTitle, theme.nextPrompt)),
      JSON.stringify(sourceContext)
    );

  const lessonId = Number(lessonResult.lastInsertRowid);
  const insertActivity = db.prepare(
    `INSERT INTO lesson_activities
       (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertActivity.run(
    lessonId,
    "audio",
    1,
    1,
    `Audio: ${theme.audioTitle}`,
    JSON.stringify({
      script: buildAudioScript(subjectTitle, theme, reviewFocus, readyFocus, completedTitles),
      duration_hint: 480,
    })
  );

  insertActivity.run(
    lessonId,
    "reading",
    1,
    2,
    `Read: ${theme.readingTitle}`,
    JSON.stringify(buildReading(subjectTitle, theme, reviewFocus, readyFocus))
  );

  insertActivity.run(
    lessonId,
    "interactive",
    1,
    3,
    `Explore: ${theme.visualTitle}`,
    JSON.stringify(buildInteractive(subjectTitle, sequenceNumber))
  );

  insertActivity.run(
    lessonId,
    "assessment",
    1,
    4,
    "Check: Explain, choose, and shape the next lesson",
    JSON.stringify(buildAssessment(subjectTitle, reviewFocus, readyFocus, sequenceNumber))
  );

  upsertTags(db, event.subject_id, lessonId, ["prodavo-native", theme.tag, concept]);
  upsertWorkpad(db, event, lessonId, title, reviewFocus, readyFocus);

  return { lesson_id: lessonId, lesson_title: title, sequence_number: sequenceNumber };
}

function chooseTheme(sequenceNumber: number) {
  if (sequenceNumber <= 1) {
    return {
      title: "Foundation Map",
      tag: "foundation",
      description: "A first teaching lesson that turns the calibration answers into a concrete map.",
      audioTitle: "The map before the details",
      readingTitle: "Start with the object, then the action",
      visualTitle: "Learning pressure knobs",
      nextPrompt: "which foundation should be deepened next",
    };
  }
  return {
    title: `Applied Loop ${sequenceNumber}`,
    tag: "application",
    description: "A follow-on lesson that uses the completed lesson evidence to move from understanding to use.",
    audioTitle: "Turning the model into action",
    readingTitle: "Use the model without losing the foundation",
    visualTitle: "Practice depth and feedback",
    nextPrompt: "which application should come next",
  };
}

function normalizeConcept(subjectTitle: string): string {
  return subjectTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "subject";
}

function buildDescription(
  subjectTitle: string,
  themeDescription: string,
  reviewFocus: string,
  readyFocus: string
): string {
  return `${themeDescription} It reviews ${reviewFocus} and advances toward ${readyFocus} inside ${subjectTitle}.`;
}

function buildAudioScript(
  subjectTitle: string,
  theme: ReturnType<typeof chooseTheme>,
  reviewFocus: string,
  readyFocus: string,
  completedTitles: string[]
): string {
  const completed = completedTitles.length
    ? `You just completed ${completedTitles.slice(0, 2).join(" and ")}. `
    : "";
  return [
    `${completed}This lesson is about ${subjectTitle}. The first job is not to memorize labels, it is to know what object you are looking at and what action changes it.`,
    `For this pass, hold two ideas at the same time. The review thread is ${reviewFocus}. The forward thread is ${readyFocus}. If those sound similar, that is the point: adaptive learning should reuse the old idea while adding one small new demand.`,
    `Use the visual in this lesson as a pressure gauge. Increase prior confidence only when the learner can explain the object. Increase practice depth only when the learner can apply it. Increase example concreteness whenever the explanation starts floating away from a real case.`,
    `By the end, you should be able to say three things clearly: what ${subjectTitle} is for, what changes when you use it, and what evidence would prove you are ready for the next lesson.`,
    `The final questions are not busywork. They leave structured evidence for prodavo's native lesson loop, so the next lesson is generated from what happened here instead of from a fixed syllabus.`,
  ].join(" ");
}

function buildReading(
  subjectTitle: string,
  theme: ReturnType<typeof chooseTheme>,
  reviewFocus: string,
  readyFocus: string
) {
  return {
    intro: `${subjectTitle} becomes easier when you separate the object, the operation, and the evidence that the operation worked.`,
    blocks: [
      { type: "heading", text: "Start with the object" },
      {
        type: "paragraph",
        text: `Before doing anything with ${subjectTitle}, name the concrete thing under discussion. It might be a process, a decision, a tool, a habit, a data structure, or a real-world situation. If you cannot point at the object, the next step becomes guesswork.`,
      },
      {
        type: "definition",
        term: "Learning object",
        definition: `The smallest concrete thing in ${subjectTitle} that can be inspected, changed, practiced, and evaluated.`,
      },
      { type: "heading", text: "Then choose one operation" },
      {
        type: "paragraph",
        text: `This lesson keeps the operation small: review ${reviewFocus}, then advance toward ${readyFocus}. One useful lesson changes one visible thing. A lesson that changes five hidden things usually leaves the learner unsure what actually improved.`,
      },
      {
        type: "example",
        title: "Concrete example",
        body: `If ${subjectTitle} were a workflow, the object is the current step, the operation is the next deliberate action, and the evidence is whether the output is clearer, faster, more accurate, or easier to explain.`,
      },
      {
        type: "callout",
        tone: "insight",
        text: `Adaptive progress is not just moving forward. It is moving forward while carrying enough review that the foundation stays usable.`,
      },
      {
        type: "list",
        ordered: true,
        items: [
          `Name the object in ${subjectTitle}.`,
          `Say what operation changes it.`,
          `Check whether the evidence improved.`,
        ],
      },
    ],
    summary: `${theme.description} The next lesson should use the learner's explanation, uncertainty, and practice evidence from this one.`,
  };
}

function buildInteractive(subjectTitle: string, sequenceNumber: number) {
  return {
    schema_version: "1.0",
    widget_type: "declarative",
    title: `${subjectTitle} readiness balance`,
    instructions:
      "Move the sliders and watch the readiness score change. The goal is to see that progress depends on foundation, practice, and concrete examples together.",
    controls: [
      { type: "slider", id: "foundation", label: "Foundation clarity", min: 0, max: 10, step: 1, default: 4 },
      { type: "slider", id: "practice", label: "Practice depth", min: 0, max: 10, step: 1, default: sequenceNumber <= 1 ? 3 : 5 },
      { type: "slider", id: "examples", label: "Concrete examples", min: 0, max: 10, step: 1, default: 5 },
    ],
    outputs: [
      {
        id: "readiness",
        label: "Next-lesson readiness",
        formula: "(foundation * 0.45 + practice * 0.35 + examples * 0.20) * 10",
        format: "percent",
        precision: 0,
        description: "Weighted readiness based on the visible controls.",
      },
      {
        id: "drag",
        label: "Risk of moving too fast",
        formula: "100 - readiness",
        format: "percent",
        precision: 0,
      },
    ],
    charts: [
      {
        type: "bar",
        title: "What is carrying the lesson?",
        bars: [
          { label: "Foundation", ref: "foundation", color: "#2563eb" },
          { label: "Practice", ref: "practice", color: "#16a34a" },
          { label: "Examples", ref: "examples", color: "#f59e0b" },
        ],
        max: 10,
      },
      {
        type: "bar",
        title: "Advance vs. review pressure",
        bars: [
          { label: "Ready", ref: "readiness", color: "#059669" },
          { label: "Review needed", ref: "drag", color: "#dc2626" },
        ],
        max: 100,
      },
    ],
    panels: [
      {
        title: "What to notice",
        template:
          "Readiness is {{readiness}}. If foundation is low, more practice alone should not force the next lesson forward.",
      },
    ],
  };
}

function buildAssessment(
  subjectTitle: string,
  reviewFocus: string,
  readyFocus: string,
  sequenceNumber: number
) {
  return {
    questions: [
      {
        id: "free_object",
        text: `What is the concrete learning object in this ${subjectTitle} lesson?`,
        concept: reviewFocus,
        difficulty: "easy",
      },
      {
        id: "free_evidence",
        text: `What evidence would show you are ready to move from ${reviewFocus} toward ${readyFocus}?`,
        concept: readyFocus,
        difficulty: "medium",
      },
    ],
    quiz: {
      pass_threshold: 1,
      idk_option: true,
      questions: [
        {
          id: `q${sequenceNumber}_object`,
          question: "What should a useful adaptive lesson identify first?",
          choices: [
            "The concrete object being learned",
            "A long list of unrelated terminology",
            "Only the next topic title",
          ],
          correct_index: 0,
          explanation: "The object anchors the lesson so actions and evidence have something to attach to.",
          concept: reviewFocus,
          difficulty: "easy",
        },
        {
          id: `q${sequenceNumber}_evidence`,
          question: "Why does the lesson collect diagnostics at the end?",
          choices: [
            "To create evidence for the next generated lesson",
            "To mark the lesson complete automatically",
            "To replace the need for practice",
          ],
          correct_index: 0,
          explanation: "Diagnostics shape the next lesson. Completion remains a separate learner action.",
          concept: readyFocus,
          difficulty: "medium",
        },
      ],
    },
  };
}

function buildDiagnostics(subjectTitle: string, nextPrompt: string) {
  return [
    {
      id: "next_confusing",
      prompt: `What still feels unclear about ${subjectTitle} after this lesson?`,
      hint: "Name the smallest confusing object or step.",
    },
    {
      id: "next_direction",
      prompt: `For ${nextPrompt}, would you rather see a worked example, a visual simulation, or a practice task next?`,
      hint: "Pick the format that would make the next lesson easier to use.",
    },
  ];
}

function upsertTags(db: Database.Database, subjectId: number, lessonId: number, tags: string[]): void {
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
  event: LessonCompletedEvent,
  lessonId: number,
  lessonTitle: string,
  reviewFocus: string,
  readyFocus: string
): void {
  const addition = [
    `## ${new Date().toISOString()} prodavo native generation`,
    `Completed lesson: ${event.lesson_title} (${event.lesson_id}).`,
    `Generated next lesson: ${lessonTitle} (${lessonId}).`,
    `Review focus: ${reviewFocus}.`,
    `Advance focus: ${readyFocus}.`,
  ].join("\n");
  const existing = db
    .prepare("SELECT id, content, version FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
    .get(event.subject_id, event.learner_id) as
    | { id: number; content: string; version: number }
    | undefined;
  if (existing) {
    db.prepare(
      `UPDATE subject_workpads
       SET content = ?, version = ?, last_updated_by = 'prodavo-local-queue/v1',
           last_updated_for = 'lesson_completion', updated_at = datetime('now')
       WHERE id = ?`
    ).run(`${existing.content}\n\n${addition}`, existing.version + 1, existing.id);
  } else {
    db.prepare(
      `INSERT INTO subject_workpads
         (subject_id, learner_id, content, last_updated_by, last_updated_for)
       VALUES (?, ?, ?, 'prodavo-local-queue/v1', 'lesson_completion')`
    ).run(event.subject_id, event.learner_id, addition);
  }
}
