// ─── Core domain types for AvocadoCore ───────────────────────────────────────

export type LevelName = "familiarity" | "competence" | "mastery";
export type SubjectStatus = "active" | "paused" | "completed" | "archived";
export type LessonStatus = "queued" | "in_progress" | "completed" | "skipped";

export type ActivityType =
  | "audio"
  | "interactive"
  | "practice_code"
  | "assessment"
  | "reading"
  | "flashcards"
  | "case_study"
  | "diagram"
  | "project"
  | "debate"
  | "reference";

export type SignalType =
  | "strength"
  | "weak_spot"
  | "misconception"
  | "review_needed"
  | "ready_to_advance";

export type ProgressMetric =
  | "mastery"
  | "confidence"
  | "assessment_score"
  | "code_tests_passed"
  | "review_frequency"
  | "weak_spot_count";

export type CompletionAdapter = "dora-task" | "webhook" | "local-queue" | "noop";

// ─── DB Row types ─────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearnerProfile {
  id: number;
  user_id: number;
  display_name: string;
  bio: string | null;
  preferred_lang: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: number;
  learner_id: number;
  title: string;
  description: string | null;
  status: SubjectStatus;
  goals: string | null;
  current_level: LevelName;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: number;
  subject_id: number;
  title: string;
  description: string | null;
  status: LessonStatus;
  sequence_number: number;
  goals: string | null; // JSON string
  tags: string | null;  // JSON string
  started_at: string | null;
  completed_at: string | null;
  generated_by: string | null;
  generator_version: string | null;
  source_context: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

export interface LessonActivity {
  id: number;
  lesson_id: number;
  activity_type: ActivityType;
  is_core: number;
  sequence_order: number;
  title: string | null;
  content: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

export interface Attempt {
  id: number;
  activity_id: number;
  learner_id: number;
  attempt_type: "autosave" | "run" | "submit" | "complete";
  content: string | null; // JSON
  result: string | null;  // JSON
  is_final: number;
  created_at: string;
}

export interface MasterySignal {
  id: number;
  learner_id: number;
  subject_id: number;
  lesson_id: number | null;
  signal_type: SignalType;
  concept: string;
  detail: string | null;
  confidence: number | null;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  tag_type: "concept" | "misconception" | "review_topic" | "curriculum_area" | "lesson_type";
  created_at: string;
}

export interface ProgressPoint {
  id: number;
  learner_id: number;
  subject_id: number;
  lesson_id: number | null;
  metric: ProgressMetric;
  value: number;
  recorded_at: string;
}

export interface GeneratedArtifact {
  id: number;
  lesson_id: number | null;
  activity_id: number | null;
  artifact_type: "audio" | "image" | "export" | "transcript";
  provider: string | null;
  voice: string | null;
  duration_sec: number | null;
  content_hash: string | null;
  file_path: string | null;
  object_key: string | null;
  source_script: string | null;
  script_version: string | null;
  generated_at: string;
  created_at: string;
}

export interface LessonAutosave {
  id: number;
  lesson_id: number;
  learner_id: number;
  activity_id: number | null;
  code_draft: string | null;
  run_output: string | null;
  test_results: string | null; // JSON
  runtime_errors: string | null; // JSON
  assessment_answers: string | null; // JSON
  last_edited_at: string | null;
  last_run_at: string | null;
  saved_at: string;
}

export interface NextLessonJob {
  id: number;
  subject_id: number;
  completed_lesson_id: number | null;
  adapter: CompletionAdapter;
  status: "pending" | "dispatched" | "completed" | "failed";
  payload: string | null; // JSON
  adapter_ref: string | null;
  error: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── View / Aggregate types ───────────────────────────────────────────────────

export interface SubjectSummary extends Subject {
  lesson_count: number;
  completed_count: number;
  queued_count: number;
  latest_mastery: number | null;
  latest_assessment_score: number | null;
  learner_display_name: string;
}

export interface LessonDetail extends Lesson {
  activities: LessonActivity[];
  autosave?: LessonAutosave[];
  artifacts?: GeneratedArtifact[];
}

// ─── Lesson Generator Contract ───────────────────────────────────────────────

/**
 * Context the app provides to a lesson-generator skill/agent.
 * Keeps deployment-specific details out of the reusable interface.
 */
export interface LessonGeneratorContext {
  subject: {
    id: number;
    title: string;
    description: string | null;
    goals: string | null;
    current_level: LevelName;
  };
  learner: {
    id: number;
    display_name: string;
    preferred_lang: string;
  };
  lesson_number: number;
  previous_lessons: Array<{
    title: string;
    status: LessonStatus;
    completed_at: string | null;
  }>;
  mastery_signals: Array<{
    signal_type: SignalType;
    concept: string;
    detail: string | null;
    confidence: number | null;
  }>;
  latest_assessment_answers?: Record<string, string>;
  instructions?: string; // deployment-specific instructions (e.g. from Dora task)
}

/**
 * Structured lesson content returned by a lesson-generator skill/agent.
 */
export interface GeneratedLessonContent {
  title: string;
  description: string;
  goals: string[];
  tags: string[];
  activities: Array<{
    activity_type: ActivityType;
    is_core: boolean;
    sequence_order: number;
    title: string;
    content: Record<string, unknown>;
  }>;
  mastery_targets: Array<{
    concept: string;
    target_confidence: number;
  }>;
  metadata: {
    generator: string;
    generator_version: string;
    generated_at: string;
    source_context_summary: string;
  };
}

// ─── Completion Hook Contract ─────────────────────────────────────────────────

/**
 * Payload emitted when a learner manually completes a lesson.
 * Adapters receive this and decide what to do next.
 */
export interface LessonCompletedEvent {
  event: "lesson.completed";
  learner_id: number;
  subject_id: number;
  subject_title: string;
  lesson_id: number;
  lesson_title: string;
  lesson_goals: string[];
  activities_completed: string[];
  assessment_qa: Array<{
    question: string;
    learner_answer: string;
    expected_or_rubric?: string;
    evaluation_notes?: string;
  }>;
  code_attempts: Array<{
    activity_title: string;
    code: string;
    test_results: Record<string, string>;
    run_output: string;
  }>;
  mastery_signals: Array<{
    signal_type: SignalType;
    concept: string;
    detail: string | null;
  }>;
  concepts_to_review: string[];
  concepts_ready_to_advance: string[];
  completed_at: string;
}

/**
 * A completion hook adapter.
 * Implement this interface to wire custom next-lesson automation.
 */
export interface CompletionHookAdapter {
  name: CompletionAdapter;
  dispatch(event: LessonCompletedEvent, config?: Record<string, unknown>): Promise<{
    ok: boolean;
    ref?: string;
    error?: string;
  }>;
}
