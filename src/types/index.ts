// ─── Core domain types for AvocadoCore ───────────────────────────────────────

// Interactive widget schema types live in src/lib/widgets and are re-exported
// here so the generator contract and consumers have a single import surface.
export type {
  WidgetSpec,
  DeclarativeWidgetSpec,
  RegisteredWidgetSpec,
  WidgetControl,
  WidgetOutput,
  WidgetChart,
  TableChartSpec,
  TreeChartSpec,
  TreeNodeSpec,
  OutputFormat,
} from "@/lib/widgets/schema";

// Non-interactive lesson content schemas (written text, media, scaffolded code, MC quiz).
export type {
  ReadingBlock,
  ReadingContent,
  MediaProvider,
  MediaEmbed,
  MediaContent,
  CodeTest,
  CodeHint,
  PracticeCodeContent,
  MultipleChoiceQuestion,
  MultipleChoiceQuizContent,
} from "@/lib/lesson-content/schema";


export type LevelName = "familiarity" | "competence" | "mastery";
export type SubjectStatus = "active" | "paused" | "completed" | "archived";
export type LessonStatus = "queued" | "in_progress" | "completed" | "skipped" | "discarded";

export type ActivityType =
  | "audio"
  | "reading"
  | "media"
  | "interactive"
  | "practice_code"
  | "assessment"
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

export type CompletionAdapter = "agent-harness" | "dora-task" | "webhook" | "local-queue" | "noop";

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
  /** Learner notes for lesson-generation agents: preferred style, constraints, context, emphasis. */
  criteria: string | null;
  current_level: LevelName;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Persistent AI workpad per subject+learner — stored in DB, never committed. */
export interface SubjectWorkpad {
  id: number;
  subject_id: number;
  learner_id: number;
  /** Full markdown content of the living workpad document. */
  content: string;
  /** Monotonically incrementing on each update. */
  version: number;
  last_updated_by: string | null;
  last_updated_for: "lesson_completion" | "lesson_discard" | "manual" | null;
  updated_at: string;
  created_at: string;
}

/** Computed per-subject mastery summary (not a DB row). */
export interface SubjectMastery {
  /** 0–100 mastery score. */
  score: number | null;
  /** Where the score came from, for the explanatory panel. */
  source: "progress_points" | "mastery_signals" | "none";
  /** Direction of recent movement. */
  trend: "up" | "down" | "flat" | "unknown";
  /** Change vs the previous reading, in score points. */
  delta: number | null;
  /** Recent score history for a sparkline (oldest→newest). */
  history: number[];
  /** Plain-language explanation of what the score means. */
  explanation: string;
  /** Counts of qualitative signals backing the score. */
  signal_counts: {
    strength: number;
    weak_spot: number;
    misconception: number;
    review_needed: number;
    ready_to_advance: number;
  };
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
  /** Set when the learner discards this incomplete lesson. NULL for active/completed lessons. */
  discarded_at: string | null;
  /** Learner's reason for discarding — passed to the replacement lesson generator. */
  discard_reason: string | null;
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
  widget_state: string | null; // JSON: {control_id: number}
  last_edited_at: string | null;
  last_run_at: string | null;
  saved_at: string;
}

export interface NextLessonJob {
  id: number;
  subject_id: number;
  completed_lesson_id: number | null;
  discarded_lesson_id: number | null;
  trigger_event: "lesson.completed" | "lesson.discarded" | "subject.created";
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
  /** Computed per-subject mastery summary (score, trend, explanation). */
  mastery?: SubjectMastery;
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
    /** Learner criteria / notes for lesson generator. Included so agents know the learner's preferences. */
    criteria: string | null;
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

// ─── Lesson Discard / Regeneration Hook Contract ─────────────────────────────

/**
 * Payload emitted when a learner discards an incomplete lesson.
 * Distinct from lesson.completed: discarding is not mastery, must not advance
 * the learner's level, and requests a replacement lesson be generated.
 */
export interface LessonDiscardedEvent {
  event: "lesson.discarded";
  learner_id: number;
  subject_id: number;
  subject_title: string;
  subject_description: string | null;
  subject_goals: string | null;
  /** Learner criteria for lesson generation — critical for replacement lesson quality. */
  subject_criteria: string | null;
  discarded_lesson_id: number;
  discarded_lesson_title: string;
  discarded_lesson_status: LessonStatus;
  /** Learner's reason for discarding, if provided. Pass to lesson generator. */
  discard_reason: string | null;
  /** Current mastery summary (not advanced by this discard). */
  mastery_score: number | null;
  /** Completed lesson summaries for context (most recent first). */
  completed_lessons: Array<{
    title: string;
    completed_at: string;
  }>;
  /** Recent mastery signals — helps generator choose what to fix next. */
  mastery_signals: Array<{
    signal_type: SignalType;
    concept: string;
    detail: string | null;
  }>;
  /** Current workpad summary, if available. Passed to help the generator. */
  workpad_summary: string | null;
  discarded_at: string;
}

// ─── Subject Created Hook Contract ───────────────────────────────────────────

/**
 * Payload emitted when a learner creates a new subject.
 * Adapters receive this and dispatch first-lesson generation.
 */
export interface SubjectCreatedEvent {
  event: "subject.created";
  learner_id: number;
  subject_id: number;
  subject_title: string;
  subject_description: string | null;
  subject_goals: string | null;
  /** Learner criteria for lesson generation — passed to the generator. */
  subject_criteria: string | null;
  current_level: LevelName;
  created_at: string;
}

/**
 * A regeneration hook adapter.
 * Receives a lesson.discarded event and triggers replacement lesson generation.
 * Generic adapters (noop, local-queue, webhook) are available; the dora-task
 * adapter creates a Doramon next-lesson task that explicitly considers criteria.
 */
export interface RegenerationHookAdapter {
  name: CompletionAdapter; // reuses same adapter name set
  dispatch(event: LessonDiscardedEvent, config?: Record<string, unknown>): Promise<{
    ok: boolean;
    ref?: string;
    error?: string;
  }>;
}
