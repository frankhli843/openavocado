import type Database from "better-sqlite3";
import type { LevelName, LevelProgression, SignalType } from "@/types";
import type { PhaseDecision } from "@/lib/feedback-llm";
import { getPhaseDecision, loadFeedbackConfig } from "@/lib/feedback-llm";
import { computeSubjectMastery } from "@/lib/mastery";
import { createSubjectJournalEntry } from "@/lib/subject-journal";

export const LEVEL_SEQUENCE: LevelName[] = [
  "familiarity",
  "competence",
  "mastery",
  "post_mastery",
];

export const LEVEL_LABELS: Record<LevelName, string> = {
  familiarity: "Familiarity",
  competence: "Competence",
  mastery: "Mastery",
  post_mastery: "Post-mastery",
};

const LEVEL_SUMMARIES: Record<LevelName, string> = {
  familiarity: "Map the high-level concepts, vocabulary, and how the pieces relate.",
  competence: "Move into the important details, mechanisms, edge cases, and practice.",
  mastery: "Transfer the ideas across contexts and handle harder evidence.",
  post_mastery: "Study relevant frontier papers and connect them back to the subject.",
};

interface EvaluateOptions {
  persist?: boolean;
  completedLessonId?: number | null;
}

interface SubjectRow {
  current_level: LevelName;
  title: string;
  goals: string | null;
  criteria: string | null;
  description: string | null;
}

interface AssessmentStats {
  correct: number;
  incorrect: number;
  idk: number;
  total: number;
  hard_correct: number;
  hard_total: number;
}

interface CodeStats {
  passed: number;
  total: number;
}

interface EvidenceSummary {
  completedLessons: number;
  totalLessons: number;
  assessmentTotal: number;
  hardAssessmentTotal: number;
  assessmentAccuracy: number | null;
  hardAssessmentAccuracy: number | null;
  positiveSignals: number;
  reviewSignals: number;
  passedCodeSubmissions: number;
  totalCodeSubmissions: number;
  masteryScore: number | null;
}

export function evaluateSubjectLevelProgression(
  db: Database.Database,
  subjectId: number,
  learnerId: number
): LevelProgression {
  const subject = db
    .prepare("SELECT title, description, goals, criteria, current_level FROM subjects WHERE id = ? AND learner_id = ?")
    .get(subjectId, learnerId) as SubjectRow | undefined;
  if (!subject) {
    throw new Error(`Subject ${subjectId} not found for learner ${learnerId}`);
  }

  const evidence = collectEvidenceSummary(db, subjectId, learnerId);
  const latestAi = loadLatestPhaseDecision(db, subjectId, learnerId);
  const currentLevel = latestAi?.current_level ?? previousStoredLevel(subject.current_level);
  const nextLevel = nextLevelFor(currentLevel);
  const gates = buildAiStatusGates(evidence, latestAi);
  const passedGateCount = gates.filter((gate) => gate.passed).length;
  const progressPercent = gates.length > 0 ? Math.round((passedGateCount / gates.length) * 100) : 0;

  return {
    previous_level: currentLevel,
    current_level: currentLevel,
    recommended_level: latestAi?.recommended_level ?? currentLevel,
    next_level: nextLevel,
    graduated: false,
    progress_percent: progressPercent,
    reason:
      latestAi?.reason ??
      "Holding current phase until the AI phase evaluator reviews the full learner history.",
    frontier_mode: currentLevel === "post_mastery",
    evidence: {
      completed_lessons: evidence.completedLessons,
      total_lessons: evidence.totalLessons,
      mastery_score: evidence.masteryScore,
      assessment_total: evidence.assessmentTotal,
      assessment_accuracy: evidence.assessmentAccuracy !== null ? Math.round(evidence.assessmentAccuracy * 100) : null,
      hard_assessment_total: evidence.hardAssessmentTotal,
      hard_assessment_accuracy:
        evidence.hardAssessmentAccuracy !== null ? Math.round(evidence.hardAssessmentAccuracy * 100) : null,
      positive_signals: evidence.positiveSignals,
      review_signals: evidence.reviewSignals,
      passed_code_submissions: evidence.passedCodeSubmissions,
      total_code_submissions: evidence.totalCodeSubmissions,
    },
    gates,
    phases: buildPhases(currentLevel),
  };
}

export async function evaluateSubjectLevelProgressionWithAi(
  db: Database.Database,
  subjectId: number,
  learnerId: number,
  options: EvaluateOptions = {}
): Promise<LevelProgression> {
  const subject = db
    .prepare("SELECT title, description, goals, criteria, current_level FROM subjects WHERE id = ? AND learner_id = ?")
    .get(subjectId, learnerId) as SubjectRow | undefined;
  if (!subject) {
    throw new Error(`Subject ${subjectId} not found for learner ${learnerId}`);
  }

  const previousLevel = previousStoredLevel(subject.current_level);
  const evidence = collectEvidenceSummary(db, subjectId, learnerId);
  const config = loadFeedbackConfig();
  let decision: PhaseDecision | null = null;
  let evaluatorError: string | null = null;

  if (config.enabled) {
    try {
      decision = await getPhaseDecision(config, {
        evidencePacket: buildPhaseEvidencePacket(db, subjectId, learnerId, subject, previousLevel, evidence),
      });
    } catch (err) {
      evaluatorError = err instanceof Error ? err.message : String(err);
    }
  } else {
    evaluatorError = "AI phase evaluator is not configured.";
  }

  const currentLevel = decision?.current_level ?? previousLevel;
  const recommendedLevel = decision?.recommended_level ?? currentLevel;
  const shouldChange = decision?.should_change_level === true && currentLevel !== previousLevel;
  if (options.persist && shouldChange) {
    db.prepare("UPDATE subjects SET current_level = ?, updated_at = datetime('now') WHERE id = ?").run(
      currentLevel,
      subjectId
    );
  }

  if (options.persist) {
    createSubjectJournalEntry(db, {
      subject_id: subjectId,
      learner_id: learnerId,
      entry_type: "planning",
      title: decision
        ? `AI phase review: ${LEVEL_LABELS[previousLevel]} -> ${LEVEL_LABELS[currentLevel]}`
        : "AI phase review unavailable",
      content: decision
        ? buildAiPhaseJournalContent(subject.title, previousLevel, decision)
        : `The AI phase evaluator did not produce a decision. Holding at ${LEVEL_LABELS[previousLevel]}.\n\nError: ${evaluatorError}`,
      metadata: {
        kind: "ai_phase_decision",
        previous_level: previousLevel,
        current_level: currentLevel,
        recommended_level: recommendedLevel,
        completed_lesson_id: options.completedLessonId ?? null,
        decision,
        evaluator_error: evaluatorError,
      },
      created_by: "avocadocore-ai-phase-evaluator",
    });
  }

  const gates = buildAiStatusGates(evidence, decision, evaluatorError);
  const passedGateCount = gates.filter((gate) => gate.passed).length;
  const progressPercent = gates.length > 0 ? Math.round((passedGateCount / gates.length) * 100) : 0;
  return {
    previous_level: previousLevel,
    current_level: currentLevel,
    recommended_level: recommendedLevel,
    next_level: nextLevelFor(currentLevel),
    graduated: shouldChange,
    progress_percent: progressPercent,
    reason:
      decision?.reason ??
      `Holding at ${LEVEL_LABELS[previousLevel]} because the AI phase evaluator is unavailable.`,
    frontier_mode: currentLevel === "post_mastery",
    evidence: {
      completed_lessons: evidence.completedLessons,
      total_lessons: evidence.totalLessons,
      mastery_score: evidence.masteryScore,
      assessment_total: evidence.assessmentTotal,
      assessment_accuracy: evidence.assessmentAccuracy !== null ? Math.round(evidence.assessmentAccuracy * 100) : null,
      hard_assessment_total: evidence.hardAssessmentTotal,
      hard_assessment_accuracy:
        evidence.hardAssessmentAccuracy !== null ? Math.round(evidence.hardAssessmentAccuracy * 100) : null,
      positive_signals: evidence.positiveSignals,
      review_signals: evidence.reviewSignals,
      passed_code_submissions: evidence.passedCodeSubmissions,
      total_code_submissions: evidence.totalCodeSubmissions,
    },
    gates,
    phases: buildPhases(currentLevel),
  };
}

function collectEvidenceSummary(db: Database.Database, subjectId: number, learnerId: number): EvidenceSummary {
  const lessonCounts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM lessons
       WHERE subject_id = ? AND status != 'discarded'`
    )
    .get(subjectId) as { total: number; completed: number | null };

  const assessment = db
    .prepare(
      `SELECT
         SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END) AS correct,
         SUM(CASE WHEN outcome = 'incorrect' THEN 1 ELSE 0 END) AS incorrect,
         SUM(CASE WHEN outcome = 'idk' THEN 1 ELSE 0 END) AS idk,
         COUNT(*) AS total,
         SUM(CASE WHEN difficulty = 'hard' AND outcome = 'correct' THEN 1 ELSE 0 END) AS hard_correct,
         SUM(CASE WHEN difficulty = 'hard' THEN 1 ELSE 0 END) AS hard_total
       FROM assessment_results
       WHERE subject_id = ? AND learner_id = ?`
    )
    .get(subjectId, learnerId) as AssessmentStats;

  const signalRows = db
    .prepare(
      `SELECT signal_type, COUNT(*) AS n
       FROM mastery_signals
       WHERE subject_id = ? AND learner_id = ?
       GROUP BY signal_type`
    )
    .all(subjectId, learnerId) as Array<{ signal_type: SignalType; n: number }>;

  const codeStats = db
    .prepare(
      `SELECT
         SUM(CASE WHEN a.is_final = 1 THEN 1 ELSE 0 END) AS passed,
         COUNT(*) AS total
       FROM attempts a
       JOIN lesson_activities la ON la.id = a.activity_id
       JOIN lessons l ON l.id = la.lesson_id
       WHERE l.subject_id = ? AND a.learner_id = ? AND a.attempt_type = 'submit'`
    )
    .get(subjectId, learnerId) as CodeStats;

  const mastery = computeSubjectMastery(db, subjectId, learnerId);
  const signalCounts = Object.fromEntries(signalRows.map((row) => [row.signal_type, row.n])) as Partial<Record<SignalType, number>>;
  const positiveSignals = (signalCounts.strength ?? 0) + (signalCounts.ready_to_advance ?? 0);
  const reviewSignals = (signalCounts.review_needed ?? 0) + (signalCounts.weak_spot ?? 0) + (signalCounts.misconception ?? 0);

  const completedLessons = Number(lessonCounts.completed ?? 0);
  const totalLessons = Number(lessonCounts.total ?? 0);
  const assessmentTotal = Number(assessment.total ?? 0);
  const hardAssessmentTotal = Number(assessment.hard_total ?? 0);
  const assessmentAccuracy = assessmentTotal > 0 ? Number(assessment.correct ?? 0) / assessmentTotal : null;
  const hardAssessmentAccuracy =
    hardAssessmentTotal > 0 ? Number(assessment.hard_correct ?? 0) / hardAssessmentTotal : null;
  const passedCodeSubmissions = Number(codeStats.passed ?? 0);
  const totalCodeSubmissions = Number(codeStats.total ?? 0);

  return {
    completedLessons,
    totalLessons,
    assessmentTotal,
    assessmentAccuracy,
    hardAssessmentTotal,
    hardAssessmentAccuracy,
    positiveSignals,
    reviewSignals,
    passedCodeSubmissions,
    totalCodeSubmissions,
    masteryScore: mastery.score,
  };
}

function buildAiStatusGates(
  evidence: EvidenceSummary,
  decision?: PhaseDecision | null,
  evaluatorError?: string | null
): LevelProgression["gates"] {
  return [
    {
      label: "AI phase review",
      passed: Boolean(decision),
      detail: decision
        ? `${Math.round(decision.confidence * 100)}% confidence: ${decision.reason}`
        : evaluatorError ?? "waiting for AI evaluator",
    },
    {
      label: "Available learner history",
      passed: evidence.completedLessons > 0 || evidence.assessmentTotal > 0 || evidence.totalCodeSubmissions > 0,
      detail: `${evidence.completedLessons} completed lessons, ${evidence.assessmentTotal} assessed answers, ${evidence.totalCodeSubmissions} code submissions`,
    },
    {
      label: "Next lesson directive",
      passed: Boolean(decision?.next_lesson_directive),
      detail: decision?.next_lesson_directive ?? "AI evaluator has not produced a planning directive yet",
    },
  ];
}

function loadLatestPhaseDecision(
  db: Database.Database,
  subjectId: number,
  learnerId: number
): PhaseDecision | null {
  const row = db
    .prepare(
      `SELECT metadata
       FROM subject_journal_entries
       WHERE subject_id = ?
         AND learner_id = ?
         AND created_by = 'avocadocore-ai-phase-evaluator'
       ORDER BY id DESC
       LIMIT 1`
    )
    .get(subjectId, learnerId) as { metadata: string | null } | undefined;
  if (!row?.metadata) return null;
  try {
    const metadata = JSON.parse(row.metadata) as { decision?: PhaseDecision | null };
    return metadata.decision ?? null;
  } catch {
    return null;
  }
}

function buildPhaseEvidencePacket(
  db: Database.Database,
  subjectId: number,
  learnerId: number,
  subject: SubjectRow,
  storedLevel: LevelName,
  evidence: EvidenceSummary
): string {
  const learnerProfile = db
    .prepare("SELECT id, display_name, config FROM learner_profiles WHERE id = ?")
    .get(learnerId) as Record<string, unknown> | undefined;

  const lessons = db
    .prepare(
      `SELECT id, title, description, status, sequence_number, goals, tags,
              completed_at, discarded_at, discard_reason,
              next_lesson_diagnostics, knowledge_graph_data, planning_rationale,
              source_context, generated_by
       FROM lessons
       WHERE subject_id = ?
       ORDER BY sequence_number ASC, id ASC`
    )
    .all(subjectId) as Array<Record<string, unknown>>;

  const assessmentResults = db
    .prepare(
      `SELECT id, lesson_id, question_id, question_type, concept, difficulty,
              outcome, answer_text, created_at
       FROM assessment_results
       WHERE subject_id = ? AND learner_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(subjectId, learnerId) as Array<Record<string, unknown>>;

  const autosaveAnswers = db
    .prepare(
      `SELECT l.id AS lesson_id, l.title AS lesson_title, la.title AS activity_title,
              las.assessment_answers
       FROM lesson_autosave las
       JOIN lessons l ON l.id = las.lesson_id
       LEFT JOIN lesson_activities la ON la.id = las.activity_id
       WHERE l.subject_id = ?
         AND las.learner_id = ?
         AND las.assessment_answers IS NOT NULL
       ORDER BY las.saved_at ASC, las.id ASC`
    )
    .all(subjectId, learnerId) as Array<Record<string, unknown>>;

  const masterySignals = db
    .prepare(
      `SELECT lesson_id, signal_type, concept, detail, confidence, difficulty, created_at
       FROM mastery_signals
       WHERE subject_id = ? AND learner_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(subjectId, learnerId) as Array<Record<string, unknown>>;

  const attempts = db
    .prepare(
      `SELECT l.id AS lesson_id, l.title AS lesson_title, la.title AS activity_title,
              a.attempt_type, a.result, a.is_final, a.created_at
       FROM attempts a
       JOIN lesson_activities la ON la.id = a.activity_id
       JOIN lessons l ON l.id = la.lesson_id
       WHERE l.subject_id = ? AND a.learner_id = ?
       ORDER BY a.created_at ASC, a.id ASC`
    )
    .all(subjectId, learnerId) as Array<Record<string, unknown>>;

  const workpad = db
    .prepare(
      `SELECT content, version, last_updated_by, last_updated_for, updated_at
       FROM subject_workpads
       WHERE subject_id = ? AND learner_id = ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .get(subjectId, learnerId) as Record<string, unknown> | undefined;

  const journal = db
    .prepare(
      `SELECT entry_type, title, content, metadata, created_by, created_at
       FROM subject_journal_entries
       WHERE subject_id = ? AND learner_id = ?
       ORDER BY id ASC`
    )
    .all(subjectId, learnerId) as Array<Record<string, unknown>>;

  const generationJobs = db
    .prepare(
      `SELECT trigger_event, adapter, status, error, completed_lesson_id,
              output_lesson_id, harness_stage, progress_events, provider_name,
              created_at, updated_at
       FROM next_lesson_jobs
       WHERE subject_id = ?
       ORDER BY id ASC`
    )
    .all(subjectId) as Array<Record<string, unknown>>;

  const crossSubject = db
    .prepare(
      `SELECT s.id, s.title, s.current_level,
              (SELECT pp.value FROM progress_points pp
               WHERE pp.subject_id = s.id AND pp.learner_id = s.learner_id AND pp.metric = 'mastery'
               ORDER BY pp.recorded_at DESC LIMIT 1) AS latest_mastery
       FROM subjects s
       WHERE s.learner_id = ?
       ORDER BY s.updated_at DESC, s.id DESC`
    )
    .all(learnerId) as Array<Record<string, unknown>>;

  const packet = {
    task: "Decide the learner phase and next lesson planning direction from all available AvocadoCore evidence.",
    subject: {
      id: subjectId,
      title: subject.title,
      description: subject.description,
      goals: parseJsonField(subject.goals),
      criteria: subject.criteria,
      stored_current_level: storedLevel,
    },
    learner_profile: learnerProfile
      ? {
          id: learnerProfile.id,
          display_name: learnerProfile.display_name,
          config: parseJsonField(learnerProfile.config),
        }
      : null,
    deterministic_evidence_summary_for_orientation_only: evidence,
    completed_and_planned_lessons: lessons.map((lesson) => ({
      id: lesson.id,
      sequence_number: lesson.sequence_number,
      title: lesson.title,
      description: truncate(lesson.description),
      status: lesson.status,
      completed_at: lesson.completed_at,
      discarded_at: lesson.discarded_at,
      discard_reason: lesson.discard_reason,
      goals: parseJsonField(lesson.goals),
      tags: parseJsonField(lesson.tags),
      diagnostics: parseJsonField(lesson.next_lesson_diagnostics),
      knowledge_graph: summarizeKnowledgeGraph(parseJsonField(lesson.knowledge_graph_data)),
      planning_rationale: truncate(lesson.planning_rationale, 1200),
      source_context: parseJsonField(lesson.source_context),
      generated_by: lesson.generated_by,
    })),
    assessment_results: assessmentResults.map((row) => ({
      ...row,
      answer_text: truncate(row.answer_text, 1000),
    })),
    autosaved_assessment_answers: autosaveAnswers.map((row) => ({
      lesson_id: row.lesson_id,
      lesson_title: row.lesson_title,
      activity_title: row.activity_title,
      answers: parseJsonField(row.assessment_answers),
    })),
    mastery_signals: masterySignals,
    code_attempts: attempts.map((attempt) => ({
      ...attempt,
      result: truncate(attempt.result, 1200),
    })),
    subject_workpad: workpad
      ? {
          ...workpad,
          content: truncate(workpad.content, 6000),
        }
      : null,
    subject_journal: journal.map((entry) => ({
      ...entry,
      content: truncate(entry.content, 1800),
      metadata: parseJsonField(entry.metadata),
    })),
    generation_jobs: generationJobs.map((job) => ({
      ...job,
      progress_events: parseJsonField(job.progress_events),
    })),
    cross_subject_history: crossSubject,
    instruction:
      "Use the complete packet above. Do not decide from counts alone. If the stored phase is ahead of demonstrated understanding, return a lower current_level and should_change_level=true so the product recalibrates.",
  };

  return JSON.stringify(packet);
}

function summarizeKnowledgeGraph(graph: unknown): unknown {
  if (!graph || typeof graph !== "object") return graph;
  const g = graph as Record<string, unknown>;
  return {
    type: g.type,
    title: g.title,
    description: g.description,
    curriculum_stages: g.curriculum_stages,
    nodes: Array.isArray(g.nodes)
      ? g.nodes.map((node) => {
          if (!node || typeof node !== "object") return node;
          const n = node as Record<string, unknown>;
          return {
            id: n.id,
            label: n.label,
            category: n.category,
            covered: n.covered,
            preview: n.preview,
            description: truncate(n.description, 400),
          };
        })
      : undefined,
  };
}

function buildAiPhaseJournalContent(
  subjectTitle: string,
  previousLevel: LevelName,
  decision: PhaseDecision
): string {
  const missing = decision.missing_evidence.length
    ? decision.missing_evidence.map((item) => `- ${item}`).join("\n")
    : "- None specified.";
  return [
    `${subjectTitle} AI phase review.`,
    "",
    `Previous stored phase: ${LEVEL_LABELS[previousLevel]}.`,
    `AI current phase: ${LEVEL_LABELS[decision.current_level]}.`,
    `AI recommended phase: ${LEVEL_LABELS[decision.recommended_level]}.`,
    `Confidence: ${Math.round(decision.confidence * 100)}%.`,
    "",
    `Reason: ${decision.reason}`,
    "",
    "Missing evidence:",
    missing,
    "",
    `Next lesson directive: ${decision.next_lesson_directive}`,
  ].join("\n");
}

function parseJsonField(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function truncate(value: unknown, max = 2000): unknown {
  if (typeof value !== "string") return value ?? null;
  return value.length <= max ? value : `${value.slice(0, max)}\n[truncated ${value.length - max} chars]`;
}

function buildPhases(currentLevel: LevelName): LevelProgression["phases"] {
  const currentIndex = LEVEL_SEQUENCE.indexOf(currentLevel);
  return LEVEL_SEQUENCE.map((level, index) => ({
    level,
    label: LEVEL_LABELS[level],
    status: index < currentIndex ? "completed" : index === currentIndex ? "current" : "locked",
    summary: LEVEL_SUMMARIES[level],
  }));
}

function nextLevelFor(level: LevelName): LevelName | null {
  const index = LEVEL_SEQUENCE.indexOf(level);
  if (index < 0 || index >= LEVEL_SEQUENCE.length - 1) return null;
  return LEVEL_SEQUENCE[index + 1];
}

function previousStoredLevel(level: string): LevelName {
  return normalizeLevel(level);
}

function normalizeLevel(level: string): LevelName {
  return LEVEL_SEQUENCE.includes(level as LevelName) ? (level as LevelName) : "familiarity";
}
