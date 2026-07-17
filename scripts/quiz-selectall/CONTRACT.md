# Quiz select-all conversion contract

You are converting single-answer multiple-choice questions into **select-all**
format for active AvocadoCore lessons. Output one JSON file per activity into
this directory (`scripts/quiz-selectall/act<id>.json`) and self-validate it.

## Environment
- Repo: `/home/frank/.openclaw/workspace/code/avocadocore`
- Node 22 required (better-sqlite3 ABI 127): `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22`
- Live DB (readonly for grounding): `data/avocadocore.db`
- Read an activity's current content for grounding:
  ```
  node -e "const db=require('better-sqlite3')('data/avocadocore.db',{readonly:true});const a=db.prepare('select content from lesson_activities where id=?').get(169);console.log(a.content)"
  ```
  Also read the lesson's `reading` and `audio.script` text in each lesson_part
  (same table) so every claim you author is grounded in what the lesson taught.

## Output file format
`scripts/quiz-selectall/act<id>.json`:
```json
{ "activityId": <id>, "lessonId": <id>, "op": "<op>", "questions": [ ... ] }
```
Ops: `assessment_quiz`, `new_assessment_quiz`, `part_practice`, `delete_part_quiz`
(delete has no `questions`).

## Self-validate EVERY file until it prints `ok`
```
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null
npx tsx scripts/backfill-quiz-selectall.ts --validate --only <id>
```
Do NOT write to the DB. The lead worker runs the actual backfill.

## Universal rules
- Question text MUST start with **"Select all that are true"** or **"Select all
  that are NOT true"**, about ONE specific taught mechanism from that lesson.
- Choices are **complete, self-contained, checkable claims** grounded in the
  lesson's taught content. Do NOT mechanically wrap the old choice strings.
- **Vary the number of correct choices** across a quiz: mix questions with 1, 2,
  3 correct, sometimes all real choices correct, sometimes none. The correct
  count must never be uniform or guessable.
- For "Select all that are NOT true" questions, the correct answers are the
  FALSE statements.
- Keep `concept`, `difficulty` ("easy"|"medium"|"hard"), and a grounded
  `support_ref` on every question. Preserve the existing question `id` when
  converting; for new quizzes use `q1`..`qN`.
- Learner-facing prose: **no em dashes, no semicolons, no typographic dashes**.
  Use periods and commas. ASCII hyphen only inside words.

## op: assessment_quiz / new_assessment_quiz  (top-level final quiz; renders as checkboxes)
- Each question MUST include a real choice with the exact text `"None of the above"`.
- `correct_indices`: non-empty array of indices into `choices`. `allow_multiple_correct: true`.
- If nothing listed is true (or, for NOT-true, everything listed is true), the
  correct answer is "None of the above": `correct_indices` = `[indexOfNone]` and
  it must be the ONLY correct index. Never mix None with other correct indices.
- Add `"learning_scope": "taught"` on every question.
- 2 to 6 choices, no duplicates. Author 6 or more questions (new quizzes: 6 to 8).
- `new_assessment_quiz` is only for L15/L26/L27 (assessment activity has no MC quiz yet).

## op: part_practice  (lesson_part practice; UI supplies virtual none/all)
- Output the FULL `practice.questions` array: convert each `type:"select_one"` to
  `type:"select_all"`, and keep every other question (select_all, ordering,
  written, pattern_recognition) intact and valid.
- Converted: `type:"select_all"`, `correct_indices` (array; `[]` = none correct;
  all indices = all correct). Remove `correct_index`. Do NOT set allow_multiple_correct.
- **Never author a "None of the above" or "All of the above" choice** in
  part_practice select_all. The UI adds virtual none/all. Use `correct_indices:[]`
  for the none case and every index for the all case.
- 2 to 7 choices for select_all.
- The whole array must still satisfy: >=6 questions, >=3 select_all (with one
  none `[]`, one some-but-not-all, one all), >=1 ordering, >=1 written. The
  existing array already meets this; converting select_one to select_all only
  adds select_all, so keep the existing none/some/all select_all questions.

## Gold example
See `scripts/quiz-selectall/act169.json` (L28 assessment) for the assessment_quiz
format: varied correct counts (1, 2, 3), a None-correct case, and a
"Select all that are NOT true" question.
