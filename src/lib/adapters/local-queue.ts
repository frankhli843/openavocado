import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  RegenerationHookAdapter,
  LessonDiscardedEvent,
  SubjectCreatedDispatcher,
} from "@/types";
import { getDb } from "@/db/connection";
import { generateInitialAssessment } from "@/lib/lesson-generator/initial-assessment";
import { generateNextLesson } from "@/lib/lesson-generator/next-lesson";
import { generateLessonAudio } from "@/lib/audio/generate-lesson-audio";
import { buildLessonBufferPlan, enrichQueuedLessonsFromCompletion } from "@/lib/lesson-buffer";
import type { LevelProgression } from "@/types";

/**
 * Local-queue adapter — writes the lesson.completed event to the
 * next_lesson_jobs table for offline/async processing.
 * No external network calls. Useful for environments without a task runner.
 */
export const localQueueAdapter: CompletionHookAdapter = {
  name: "local-queue",
  async dispatch(event: LessonCompletedEvent) {
    try {
      const db = getDb();
      const plan = event.lesson_buffer ?? buildLessonBufferPlan(db, {
        subjectId: event.subject_id,
        completedLessonId: event.lesson_id,
      });
      const enrichedLessonIds = enrichQueuedLessonsFromCompletion(db, event);
      const generatedLessonIds: number[] = [];
      let firstGeneratedTitle: string | null = null;

      for (let i = 0; i < plan.lessons_to_generate; i += 1) {
        const result = generateNextLesson(db, event);
        generatedLessonIds.push(result.lesson_id);
        firstGeneratedTitle ??= result.lesson_title;
      }

      if (process.env.AVOCADOCORE_LOCAL_QUEUE_AUDIO !== "skip") {
        for (const lessonId of generatedLessonIds) {
          await generateLessonAudio(db, lessonId);
        }
      }

      const primaryLessonId = generatedLessonIds[0] ?? plan.existing_ready_lessons[0]?.id;
      const ref = `local-queue-buffer-${[...enrichedLessonIds, ...generatedLessonIds].join("-") || "unchanged"}`;
      console.log(
        `[completion:local-queue] Maintained two-ready buffer for subject ${event.subject_id}: ` +
          `enriched ${enrichedLessonIds.length}, generated ${generatedLessonIds.length}` +
          (firstGeneratedTitle ? `, first new lesson "${firstGeneratedTitle}"` : "")
      );
      return { ok: true, ref, lesson_id: primaryLessonId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};

/**
 * Local-queue regeneration adapter — writes the lesson.discarded event to the
 * next_lesson_jobs table. The discard endpoint already writes a job row, so
 * this is a no-op at the adapter level (the endpoint handles persistence).
 * Returns ok so the endpoint flow continues cleanly.
 */
export const localQueueRegenerationAdapter: RegenerationHookAdapter = {
  name: "local-queue",
  async dispatch(event: LessonDiscardedEvent) {
    try {
      console.log(
        `[regeneration:local-queue] Lesson.discarded enqueued for subject "${event.subject_title}" (lesson ${event.discarded_lesson_id})`
      );
      return { ok: true, ref: `local-queue-regen-${event.discarded_lesson_id}-${Date.now()}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};

/**
 * Local-queue subject.created dispatcher — synchronously generates an initial
 * assessment lesson so the learner has something to do immediately.
 *
 * This is the AvocadoCore-native path for prodavo and other self-hosted
 * deployments that do not have a Dora endpoint or external task runner.
 *
 * The initial assessment:
 *  - sequence_number=0 (before teaching lessons)
 *  - Title prefix "Initial Assessment:" (UI-distinguishable)
 *  - Assessment activities only — no teaching text, no audio, no widgets
 *  - Open-ended questions to calibrate the learner's existing knowledge
 *
 * Idempotent: if a lesson with sequence_number=0 already exists for this
 * subject, returns the existing lesson ref without creating a duplicate.
 */
export const localQueueSubjectCreatedDispatcher: SubjectCreatedDispatcher = async (event) => {
  try {
    const db = getDb();
    if (event.lesson_type === "one_off") {
      const existing = db
        .prepare("SELECT id, title FROM lessons WHERE subject_id = ? AND sequence_number = 1 LIMIT 1")
        .get(event.subject_id) as { id: number; title: string } | undefined;
      if (existing) {
        console.log(`[subject.created:local-queue] One-off lesson already exists (lesson ${existing.id}) for subject ${event.subject_id}.`);
        return { ok: true, ref: `local-queue-one-off-existing-${existing.id}`, lesson_id: existing.id };
      }
      const result = generateNextLesson(db, buildOneOffSeedEvent(event));
      if (process.env.AVOCADOCORE_LOCAL_QUEUE_AUDIO !== "skip") {
        await generateLessonAudio(db, result.lesson_id);
      }
      console.log(`[subject.created:local-queue] Created one-off lesson "${result.lesson_title}" (lesson ${result.lesson_id}).`);
      return { ok: true, ref: `local-queue-one-off-${result.lesson_id}`, lesson_id: result.lesson_id };
    }

    // Idempotency check: skip if an initial assessment already exists
    const existing = db
      .prepare(
        `SELECT id, title FROM lessons WHERE subject_id = ? AND sequence_number = 0 LIMIT 1`
      )
      .get(event.subject_id) as { id: number; title: string } | undefined;

    if (existing) {
      console.log(
        `[subject.created:local-queue] Initial assessment already exists ` +
          `(lesson ${existing.id}) for subject ${event.subject_id} — skipping.`
      );
      return {
        ok: true,
        ref: `local-queue-assessment-existing-${existing.id}`,
        lesson_id: existing.id,
      };
    }

    const result = generateInitialAssessment(db, event);
    const ref = `local-queue-assessment-${result.lesson_id}`;
    console.log(
      `[subject.created:local-queue] Created initial assessment "${result.lesson_title}" ` +
        `(lesson ${result.lesson_id}, ${result.question_count} questions)`
    );
    return { ok: true, ref, lesson_id: result.lesson_id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[subject.created:local-queue] Failed:`, err);
    return { ok: false, error: msg };
  }
};

function buildOneOffSeedEvent(event: Parameters<SubjectCreatedDispatcher>[0]): LessonCompletedEvent {
  const level = event.current_level;
  const levelProgression: LevelProgression = {
    previous_level: level,
    current_level: level,
    recommended_level: level,
    next_level: null,
    graduated: false,
    progress_percent: 0,
    reason: "One-off subject starts from provided context without a separate initial assessment.",
    frontier_mode: false,
    evidence: {
      completed_lessons: 0,
      total_lessons: 1,
      mastery_score: null,
      assessment_total: 0,
      assessment_accuracy: null,
      hard_assessment_total: 0,
      hard_assessment_accuracy: null,
      positive_signals: 0,
      review_signals: 0,
      passed_code_submissions: 0,
      total_code_submissions: 0,
    },
    gates: [],
    phases: [{ level, label: level, status: "current", summary: "One-off lesson generated directly from source materials." }],
  };

  return {
    event: "lesson.completed",
    learner_id: event.learner_id,
    subject_id: event.subject_id,
    subject_title: event.subject_title,
    subject_goals: event.subject_goals,
    subject_criteria: event.subject_criteria,
    current_level: level,
    level_progression: levelProgression,
    lesson_id: 0,
    lesson_title: "One-off source context",
    lesson_goals: [],
    activities_completed: [],
    assessment_qa: [],
    code_attempts: [],
    mastery_signals: [],
    concepts_to_review: [event.subject_title],
    concepts_ready_to_advance: [event.subject_title],
    next_lesson_diagnostics: [],
    quiz_result: null,
    tag_difficulty_performance: [],
    recent_misconceptions: [],
    completed_lessons: [],
    discarded_lessons: [],
    workpad_summary: event.workpad_summary,
    learner_profile_config: event.learner_profile_config,
    cross_subject_history: [],
    lesson_buffer: {
      policy_version: "two-ready-lessons/v1",
      target_ready_count: 0,
      ready_count: 0,
      lessons_to_generate: 0,
      existing_ready_lessons: [],
      enrichment_required_for_lesson_ids: [],
    },
    completed_at: new Date().toISOString(),
  };
}
