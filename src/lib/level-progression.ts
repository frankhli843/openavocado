import type Database from "better-sqlite3";
import type { LevelName, LevelProgression, SignalType } from "@/types";
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

export function evaluateSubjectLevelProgression(
  db: Database.Database,
  subjectId: number,
  learnerId: number,
  options: EvaluateOptions = {}
): LevelProgression {
  const subject = db
    .prepare("SELECT title, current_level FROM subjects WHERE id = ? AND learner_id = ?")
    .get(subjectId, learnerId) as SubjectRow | undefined;
  if (!subject) {
    throw new Error(`Subject ${subjectId} not found for learner ${learnerId}`);
  }

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

  const previousLevel = normalizeLevel(subject.current_level);
  const gates = buildGates(previousLevel, {
    completedLessons,
    masteryScore: mastery.score,
    assessmentTotal,
    assessmentAccuracy,
    hardAssessmentTotal,
    hardAssessmentAccuracy,
    positiveSignals,
    reviewSignals,
    passedCodeSubmissions,
    totalCodeSubmissions,
  });
  const passedGateCount = gates.filter((gate) => gate.passed).length;
  const progressPercent = gates.length > 0 ? Math.round((passedGateCount / gates.length) * 100) : 100;
  const canGraduate = gates.length > 0 && gates.every((gate) => gate.passed);
  const nextLevel = nextLevelFor(previousLevel);
  const recommendedLevel = canGraduate && nextLevel ? nextLevel : previousLevel;

  let currentLevel = previousLevel;
  let graduated = false;
  if (options.persist && recommendedLevel !== previousLevel) {
    db.prepare("UPDATE subjects SET current_level = ?, updated_at = datetime('now') WHERE id = ?").run(
      recommendedLevel,
      subjectId
    );
    currentLevel = recommendedLevel;
    graduated = true;
    createSubjectJournalEntry(db, {
      subject_id: subjectId,
      learner_id: learnerId,
      entry_type: "planning",
      title: `Graduated to ${LEVEL_LABELS[recommendedLevel]}`,
      content: buildGraduationJournalContent(subject.title, previousLevel, recommendedLevel, gates),
      metadata: {
        previous_level: previousLevel,
        current_level: recommendedLevel,
        completed_lesson_id: options.completedLessonId ?? null,
        gates,
      },
      created_by: "avocadocore-level-progression",
    });
  }

  return {
    previous_level: previousLevel,
    current_level: currentLevel,
    recommended_level: recommendedLevel,
    next_level: nextLevelFor(currentLevel),
    graduated,
    progress_percent: graduated ? 0 : progressPercent,
    reason: buildReason(previousLevel, currentLevel, recommendedLevel, gates),
    frontier_mode: currentLevel === "post_mastery",
    evidence: {
      completed_lessons: completedLessons,
      total_lessons: totalLessons,
      mastery_score: mastery.score,
      assessment_total: assessmentTotal,
      assessment_accuracy: assessmentAccuracy !== null ? Math.round(assessmentAccuracy * 100) : null,
      hard_assessment_total: hardAssessmentTotal,
      hard_assessment_accuracy: hardAssessmentAccuracy !== null ? Math.round(hardAssessmentAccuracy * 100) : null,
      positive_signals: positiveSignals,
      review_signals: reviewSignals,
      passed_code_submissions: passedCodeSubmissions,
      total_code_submissions: totalCodeSubmissions,
    },
    gates,
    phases: buildPhases(currentLevel),
  };
}

function buildGates(
  level: LevelName,
  evidence: {
    completedLessons: number;
    masteryScore: number | null;
    assessmentTotal: number;
    assessmentAccuracy: number | null;
    hardAssessmentTotal: number;
    hardAssessmentAccuracy: number | null;
    positiveSignals: number;
    reviewSignals: number;
    passedCodeSubmissions: number;
    totalCodeSubmissions: number;
  }
): LevelProgression["gates"] {
  if (level === "post_mastery") return [];

  if (level === "familiarity") {
    return [
      {
        label: "Lesson evidence",
        passed: evidence.completedLessons >= 2,
        detail: `${evidence.completedLessons}/2 completed lessons`,
      },
      {
        label: "Understanding",
        passed: (evidence.masteryScore ?? 0) >= 55 || evidence.positiveSignals >= Math.max(2, evidence.reviewSignals),
        detail:
          evidence.masteryScore !== null
            ? `${evidence.masteryScore}% mastery score`
            : `${evidence.positiveSignals} positive signals vs ${evidence.reviewSignals} review signals`,
      },
      {
        label: "Assessment reliability",
        passed: evidence.assessmentTotal < 4 || (evidence.assessmentAccuracy ?? 0) >= 0.6,
        detail:
          evidence.assessmentTotal > 0
            ? `${Math.round((evidence.assessmentAccuracy ?? 0) * 100)}% across ${evidence.assessmentTotal} assessed answers`
            : "not enough assessed answers yet",
      },
    ];
  }

  if (level === "competence") {
    return [
      {
        label: "Sustained lesson history",
        passed: evidence.completedLessons >= 5,
        detail: `${evidence.completedLessons}/5 completed lessons`,
      },
      {
        label: "Mastery score",
        passed: (evidence.masteryScore ?? 0) >= 78,
        detail: evidence.masteryScore !== null ? `${evidence.masteryScore}% mastery score` : "no mastery score yet",
      },
      {
        label: "Hard-question performance",
        passed: evidence.hardAssessmentTotal >= 3 && (evidence.hardAssessmentAccuracy ?? 0) >= 0.67,
        detail:
          evidence.hardAssessmentTotal > 0
            ? `${Math.round((evidence.hardAssessmentAccuracy ?? 0) * 100)}% across ${evidence.hardAssessmentTotal} hard answers`
            : "no hard answers yet",
      },
      {
        label: "Review debt",
        passed: evidence.positiveSignals >= evidence.reviewSignals,
        detail: `${evidence.positiveSignals} positive signals vs ${evidence.reviewSignals} review signals`,
      },
    ];
  }

  return [
    {
      label: "Deep subject history",
      passed: evidence.completedLessons >= 8,
      detail: `${evidence.completedLessons}/8 completed lessons`,
    },
    {
      label: "High mastery",
      passed: (evidence.masteryScore ?? 0) >= 90,
      detail: evidence.masteryScore !== null ? `${evidence.masteryScore}% mastery score` : "no mastery score yet",
    },
    {
      label: "Hard evidence",
      passed: evidence.hardAssessmentTotal >= 5 && (evidence.hardAssessmentAccuracy ?? 0) >= 0.8,
      detail:
        evidence.hardAssessmentTotal > 0
          ? `${Math.round((evidence.hardAssessmentAccuracy ?? 0) * 100)}% across ${evidence.hardAssessmentTotal} hard answers`
          : "no hard answers yet",
    },
    {
      label: "Low review debt",
      passed: evidence.reviewSignals <= 1 || evidence.positiveSignals >= evidence.reviewSignals * 2,
      detail: `${evidence.positiveSignals} positive signals vs ${evidence.reviewSignals} review signals`,
    },
    {
      label: "Applied practice",
      passed: evidence.totalCodeSubmissions === 0 || evidence.passedCodeSubmissions >= 2,
      detail:
        evidence.totalCodeSubmissions > 0
          ? `${evidence.passedCodeSubmissions}/2 passing code submissions`
          : "no coding exercises assigned yet",
    },
  ];
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

function buildReason(
  previousLevel: LevelName,
  currentLevel: LevelName,
  recommendedLevel: LevelName,
  gates: LevelProgression["gates"]
): string {
  if (currentLevel !== previousLevel) {
    if (currentLevel === "post_mastery") {
      return "Graduated to post-mastery. Future lessons should now use relevant, recent, well-cited or frontier papers as the center of instruction.";
    }
    return `Graduated from ${LEVEL_LABELS[previousLevel]} to ${LEVEL_LABELS[currentLevel]} based on the latest lesson evidence.`;
  }
  if (recommendedLevel !== previousLevel) {
    return `Ready to graduate to ${LEVEL_LABELS[recommendedLevel]} on the next persisted completion.`;
  }
  const remaining = gates.filter((gate) => !gate.passed).map((gate) => gate.label);
  if (remaining.length === 0) {
    return currentLevel === "post_mastery"
      ? "You are in post-mastery. The next lesson should explore a relevant current paper."
      : `Holding at ${LEVEL_LABELS[currentLevel]} while the next lesson is planned.`;
  }
  return `Holding at ${LEVEL_LABELS[currentLevel]}. Remaining evidence: ${remaining.join(", ")}.`;
}

function buildGraduationJournalContent(
  subjectTitle: string,
  previousLevel: LevelName,
  nextLevel: LevelName,
  gates: LevelProgression["gates"]
): string {
  const gateText = gates
    .map((gate) => `- ${gate.passed ? "Pass" : "Wait"}: ${gate.label} (${gate.detail})`)
    .join("\n");
  const frontierNote =
    nextLevel === "post_mastery"
      ? "\n\nPost-mastery instruction requirement: choose a relevant frontier or uniquely well-cited paper, research it, cite it clearly, and build the lesson around what the paper adds beyond the learner's mastered foundation."
      : "";
  return [
    `${subjectTitle} graduated from ${LEVEL_LABELS[previousLevel]} to ${LEVEL_LABELS[nextLevel]}.`,
    "",
    "Evidence gates:",
    gateText,
    frontierNote,
  ].join("\n");
}

function nextLevelFor(level: LevelName): LevelName | null {
  const index = LEVEL_SEQUENCE.indexOf(level);
  if (index < 0 || index >= LEVEL_SEQUENCE.length - 1) return null;
  return LEVEL_SEQUENCE[index + 1];
}

function normalizeLevel(level: string): LevelName {
  return LEVEL_SEQUENCE.includes(level as LevelName) ? (level as LevelName) : "familiarity";
}
