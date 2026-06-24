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
  LessonPartAudioContent,
  LessonPartContent,
} from "@/lib/lesson-content/schema";


export type LevelName = "familiarity" | "competence" | "mastery";
export type SubjectStatus = "active" | "paused" | "completed" | "archived";
export type LessonStatus = "queued" | "in_progress" | "completed" | "skipped" | "discarded";

export type ActivityType =
  | "audio"
  | "reading"
  | "media"
  | "lesson_part"
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

export type CompletionAdapter = "dora-task" | "webhook" | "local-queue" | "noop";

// ─── DB Row types ─────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  /** Currently active learner profile for this account. NULL → use first profile. */
  active_learner_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface LearnerProfile {
  id: number;
  user_id: number;
  display_name: string;
  bio: string | null;
  preferred_lang: string;
  /** Per-profile learner configuration JSON (notes/preferences/context) for generation. */
  config: string | null;
  created_at: string;
  updated_at: string;
}

/** Difficulty scale shared by questions, attempts, and mastery evidence. */
export type Difficulty = "easy" | "medium" | "hard";

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
  /** JSON array of { id, prompt, hint? } end-of-lesson diagnostic questions. */
  next_lesson_diagnostics: string | null;
  /** JSON KnowledgeGraphData authored by the lesson generator — shown as an orientation map at lesson top. */
  knowledge_graph_data: string | null;
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
  /** Difficulty of the evidence that produced this signal, if graded. */
  difficulty: Difficulty | null;
  /** Optional resolved tag this signal concerns, in addition to free-text concept. */
  tag_id: number | null;
  created_at: string;
}

/** Persisted per-question assessment evidence (tag + difficulty + outcome). */
export interface AssessmentResult {
  id: number;
  learner_id: number;
  subject_id: number;
  lesson_id: number | null;
  activity_id: number | null;
  question_id: string;
  question_type: "mc" | "freeform" | "diagnostic";
  concept: string | null;
  difficulty: Difficulty | null;
  outcome: "correct" | "incorrect" | "idk" | "assessed";
  answer_text: string | null;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  tag_type: "concept" | "misconception" | "review_topic" | "curriculum_area" | "lesson_type";
  created_at: string;
}

// ─── Knowledge Graph Orientation ────────────────────────────────────────────

/**
 * A single concept/topic node in the lesson knowledge graph.
 * Authored per-lesson by the lesson generator to describe curriculum position.
 */
export interface KnowledgeGraphNode {
  /** Unique identifier within this graph (does not need to match DB tag id). */
  id: string;
  /** Short display label shown on the node (keep ≤20 chars for readability). */
  label: string;
  /**
   * Role in the graph layout:
   * - "subject_root": the top-level subject or pipeline — placed at center
   * - "concept": a concrete concept or skill
   * - "prerequisite": a foundational concept the lesson builds on
   * - "preview": mentioned but not taught in depth here
   */
  category?: "subject_root" | "concept" | "prerequisite" | "preview";
  /** True if this lesson directly covers and teaches this concept. */
  covered: boolean;
  /**
   * True if the concept is mentioned/introduced but intentionally left for a
   * deeper later lesson. Renders in amber with a "Coming later" label.
   */
  preview?: boolean;
  /** Optional tooltip/description shown on hover. */
  description?: string;
}

export interface KnowledgeGraphEdge {
  from: string; // node id
  to: string;   // node id
  label?: string;
}

/**
 * Lesson-level knowledge graph authored by the lesson generator.
 *
 * "high-level": the lesson is a broad subject overview. Render the full
 *   subject graph, boxing/highlighting which areas this lesson covers.
 *
 * "focused": the lesson is a deep dive. Show the relevant subgraph and
 *   indicate how it fits into the larger subject.
 */
export interface KnowledgeGraphData {
  type: "high-level" | "focused";
  title: string;
  description?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
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
  trigger_event: "lesson.completed" | "lesson.discarded";
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
  /**
   * End-of-lesson freeform next-lesson diagnostics. Generators should provide
   * these; when omitted the app applies DEFAULT_NEXT_LESSON_DIAGNOSTICS.
   */
  next_lesson_diagnostics?: Array<{ id: string; prompt: string; hint?: string }>;
  /**
   * Knowledge graph orientation for the lesson — strongly recommended for all
   * lessons. Shows where this lesson sits in the subject curriculum. See
   * KnowledgeGraphData for the shape. When omitted, the UI falls back to a
   * tag-derived view but the authored graph provides richer orientation.
   */
  knowledge_graph_data?: KnowledgeGraphData;
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
  /** Subject-level goals + learner criteria — primary context for the next lesson. */
  subject_goals: string | null;
  subject_criteria: string | null;
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
    difficulty?: Difficulty | null;
  }>;
  concepts_to_review: string[];
  concepts_ready_to_advance: string[];
  /** Freeform end-of-lesson diagnostic answers — readiness/intent for next lesson. */
  next_lesson_diagnostics: Array<{ prompt: string; answer: string }>;
  /** Quiz outcome for this lesson, when the assessment had an adaptive MC quiz. */
  quiz_result: { passed: boolean; correct_count: number; pass_threshold: number } | null;
  /** Performance aggregated by tag + difficulty — the queryable evidence model. */
  tag_difficulty_performance: Array<{
    tag: string;
    difficulty: Difficulty | "ungraded";
    correct: number;
    incorrect: number;
    idk: number;
    total: number;
  }>;
  /** Recent misconception concepts flagged across the subject. */
  recent_misconceptions: string[];
  /** Completed lesson titles for curriculum context (most recent first). */
  completed_lessons: Array<{ title: string; completed_at: string }>;
  /** Discarded lesson titles + reasons — what the learner rejected. */
  discarded_lessons: Array<{ title: string; reason: string | null }>;
  /** Living AI workpad summary, when available. */
  workpad_summary: string | null;
  /** General learner-profile config (notes/preferences) — secondary context. */
  learner_profile_config: Record<string, unknown> | null;
  /** Cross-subject mastery snapshots — used only when they speed up mastery. */
  cross_subject_history: Array<{ subject_title: string; mastery_score: number | null }>;
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
