/**
 * Reviewer prompt builder — turns gathered lesson content + deterministic
 * pre-screen flags into the structured instruction the ACP reviewer agent
 * evaluates. The reviewer is asked to judge four quality dimensions and return
 * a { approved, evidence[], rejections[] } JSON verdict.
 *
 * The pre-screen flags are presented as "automated hints" — the reviewer must
 * still make its own semantic judgement (the flags are not the final gate).
 */

import type {
  GatheredLesson,
  GatheredCueTimeline,
  GatheredChoiceQuestion,
  GatheredWrittenQuestion,
  GatheredCodeExercise,
  PreScreenFlag,
} from "./gather";

function fmtTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function renderTranscripts(lesson: GatheredLesson): string {
  if (lesson.transcripts.length === 0) return "(no audio transcripts in this lesson)";
  return lesson.transcripts
    .map((t) => {
      const dur = t.durationHint ? ` — duration_hint ${t.durationHint}s` : "";
      return `### Transcript [${t.source}] (${t.wordCount} words${dur})\n${t.script}`;
    })
    .join("\n\n");
}

function renderCueTimeline(timeline: GatheredCueTimeline): string {
  const header = `### Cue timeline [${timeline.source}]${
    timeline.durationHint ? ` (audio ${timeline.durationHint}s)` : ""
  }`;
  const rows = timeline.cues.map((c) => {
    const range = `${fmtTimestamp(c.start)}${c.end != null ? `–${fmtTimestamp(c.end)}` : ""}`;
    const rtp = [c.receive && `receive: ${c.receive}`, c.transform && `transform: ${c.transform}`, c.pass && `pass: ${c.pass}`]
      .filter(Boolean)
      .join(" | ");
    return `- [${range}] label="${c.label}" headline="${c.headline}"${
      c.narration ? ` narration="${c.narration}"` : ""
    }${rtp ? ` (${rtp})` : ""}`;
  });
  return `${header}\n${rows.join("\n")}`;
}

function renderChoiceQuestion(q: GatheredChoiceQuestion): string {
  const correct =
    q.correctIndices !== null
      ? `correct_indices=[${q.correctIndices.join(", ")}]`
      : `correct_index=${q.correctIndex}`;
  const choices = q.choices.map((c, i) => `    ${i}. ${c}`).join("\n");
  return `- [${q.source}] (${q.kind}) "${q.id}": ${q.prompt}\n${choices}\n    ${correct}${
    q.explanation ? `\n    explanation: ${q.explanation}` : ""
  }`;
}

function renderWrittenQuestion(q: GatheredWrittenQuestion): string {
  return `- [${q.source}] "${q.id}": ${q.prompt}\n    expected_answer: ${
    q.actualAnswer ?? "(none)"
  }\n    rubric (shown to learner): ${q.rubric ?? "(none)"}`;
}

function renderCodeExercise(ex: GatheredCodeExercise): string {
  const worked = ex.workedExamples
    .map((w) => `    [${w.label}]\n${w.code.split("\n").map((l) => `      ${l}`).join("\n")}`)
    .join("\n");
  const tests = ex.tests.map((t) => `    - ${t.id}: ${t.assert}`).join("\n");
  const hidden = ex.hiddenTests.map((t) => `    - ${t.id}: ${t.assert}`).join("\n");
  return [
    `### Code exercise [${ex.source}]`,
    `prompt: ${ex.prompt}`,
    `starter_code:\n${(ex.starterCode ?? "(none)").split("\n").map((l) => `    ${l}`).join("\n")}`,
    `worked_examples:\n${worked || "    (none)"}`,
    `public tests:\n${tests || "    (none)"}`,
    `hidden tests:\n${hidden || "    (none)"}`,
  ].join("\n");
}

function renderFlags(flags: PreScreenFlag[]): string {
  if (flags.length === 0) {
    return "(no automated pre-screen flags — evaluate independently)";
  }
  return flags
    .map(
      (f) =>
        `- [${f.severity.toUpperCase()}] (${f.criterion}) in ${f.source}: ${f.detail}${
          f.quote ? ` — "${f.quote}"` : ""
        }`
    )
    .join("\n");
}

const REVIEWER_INSTRUCTIONS = `You are a rigorous semantic QA reviewer for Open Avocado, an adaptive learning system. A lesson has just been generated. Your job is to decide whether its content is good enough to show a learner. You evaluate FOUR quality dimensions and back every judgement with a direct quote from the content below.

Evaluate:

1. TRANSCRIPT QUALITY. Is the audio script genuinely educational and Socratic? Leo should teach the mechanism clearly while the student (Maya) asks layered follow-up questions (3-5 depth levels). Content must be specific to the actual topic, not generic "how to learn" advice. REJECT if the transcript: loops/repeats the same content without adding information; mentions generator structure ("Point 1", "lesson parts", "exercises", "first layer", "the learner should"); gives generic study coaching instead of teaching the topic; or is flat question-answer without curiosity.

2. VISUAL-TRANSCRIPT ALIGNMENT. Sample 5-10 cue windows and check whether each cue's label/headline/narration matches what the speaker is explaining at that timestamp. REJECT if cues are template placeholders (generic Input/Transform/Handoff labels with no content-specific text) or clearly do not match the transcript at that time range, or if the cues cover only a small fraction of the audio.

3. PRACTICE QUESTION QUALITY. Do questions test understanding (not memorization)? Are distractors plausible? Do select-all questions have a sensible number of correct answers (not all, not none-without-a-"None of the above"-option)? REJECT degenerate grading (all choices correct or all incorrect) and rubrics that reveal the expected answer verbatim in the grading text shown to the learner.

4. CODE EXERCISE QUALITY. Does the reference answer's function signature match the starter code exactly? Do the tests test something meaningful? Is the prompt solvable without peeking at the answer? REJECT signature/return-type mismatches between starter and reference answer.

The AUTOMATED PRE-SCREEN FLAGS below are hints from deterministic checks. They are NOT the final decision — verify each one against the actual content and use your own semantic judgement. You may reject for issues the flags missed, and you may clear a flag you find to be a false positive (explain why in evidence).

Return ONLY a JSON object (no markdown, no prose) with this exact shape:
{
  "approved": boolean,
  "evidence": [ "direct quote or observation supporting your verdict", ... ],
  "rejections": [
    { "criterion": "transcript_quality | visual_transcript_alignment | practice_question_quality | code_exercise_quality", "quote": "the exact offending content", "explanation": "why it fails", "fix_suggestion": "a concrete fix the regenerator can apply" }
  ]
}
When approved is true, rejections must be an empty array and evidence must cite specific strengths. When approved is false, rejections must contain at least one grounded entry.`;

/** Build the full reviewer prompt for a gathered lesson. */
export function buildReviewPrompt(lesson: GatheredLesson): string {
  const cueBlock =
    lesson.cueTimelines.length > 0
      ? lesson.cueTimelines.map(renderCueTimeline).join("\n\n")
      : "(no synced visual cue timelines)";
  const choiceBlock =
    lesson.choiceQuestions.length > 0
      ? lesson.choiceQuestions.map(renderChoiceQuestion).join("\n")
      : "(no choice questions)";
  const writtenBlock =
    lesson.writtenQuestions.length > 0
      ? lesson.writtenQuestions.map(renderWrittenQuestion).join("\n")
      : "(no written questions)";
  const codeBlock =
    lesson.codeExercises.length > 0
      ? lesson.codeExercises.map(renderCodeExercise).join("\n\n")
      : "(no code exercises)";

  return [
    REVIEWER_INSTRUCTIONS,
    "",
    "═══════════════════════════════════════════════════════════════",
    `LESSON ${lesson.lessonId}: ${lesson.title}`,
    "═══════════════════════════════════════════════════════════════",
    "",
    "── AUTOMATED PRE-SCREEN FLAGS ──",
    renderFlags(lesson.flags),
    "",
    "── AUDIO TRANSCRIPTS ──",
    renderTranscripts(lesson),
    "",
    "── SYNCED VISUAL CUE TIMELINES ──",
    cueBlock,
    "",
    "── PRACTICE / QUIZ CHOICE QUESTIONS ──",
    choiceBlock,
    "",
    "── WRITTEN / FREEFORM QUESTIONS ──",
    writtenBlock,
    "",
    "── CODE EXERCISES ──",
    codeBlock,
    "",
    "═══════════════════════════════════════════════════════════════",
    "Return your JSON verdict now.",
  ].join("\n");
}
