/**
 * Repair the Lesson 15 freeform assessment questions.
 *
 * Context: after the select-all MC quiz backfill (commit a0c3029), the Lesson 15
 * assessment activities (act89 "Check Your Understanding" and act90 "Next Lesson
 * Diagnostic") still carried freeform `content.questions` authored in the quiz
 * internal shape ({ type: "select_all", question, options, correct }) with no
 * stable `id` and a field named `question` instead of `text`. AssessmentSection
 * keeps only questions where `q.id && q.text.trim()`, so every freeform question
 * was filtered out and the section rendered the placeholder
 * "Assessment questions were generated without usable prompts." The MC quiz
 * (content.quiz) is healthy and untouched here.
 *
 * This script rewrites ONLY content.questions on act89 and act90 into valid
 * FreeformQuestion objects (id + text + typed fields), preserves the existing
 * content.quiz verbatim, validates the whole activity with the canonical
 * validateAssessmentContent contract, and writes it back. It is keyed by
 * activity id (Lesson 15 has two assessment activities, so a lesson-keyed
 * backfill would clobber both identically).
 *
 * Run: nvm use 22 && npx tsx scripts/backfill-l15-freeform-assessment.ts
 * A dry run that only validates without writing: add --validate.
 */
import { getDb } from "../src/db/connection";
import { validateAssessmentContent } from "../src/lib/lesson-content/schema";

type FreeformQuestion = Record<string, unknown>;

// act89: graded "Check Your Understanding" freeform prompts. Four prompts that
// span the reasoning modes the lesson teaches: a mechanistic explanation, a
// contrast/diagnosis, an applied scenario, and a second mechanistic walk. Every
// prompt is answerable from Lesson 15 alone and carries a grading rubric.
const ACT89_QUESTIONS: FreeformQuestion[] = [
  {
    id: "l15-ff-attention-scoring",
    text: "In your own words, how does the model decide how much one token should attend to another? Walk through what Q and K represent and how their dot product, the scaling, and softmax turn into attention weights.",
    type: "free_text",
    actual_answer:
      "Each token embedding is projected into a Query and a Key by learned matrices W_Q and W_K. The Query says what this token is looking for and the Key says what another token has to offer. To score how much token A attends to token B you take the dot product of A's Query with B's Key. A large dot product means the query and key line up, so B is relevant to A. You compute this for every query and key pair, divide each score by the square root of the key dimension so the numbers do not grow too large, then run softmax across each row so the weights are positive and sum to one. Those weights say how much of each token's Value to blend into the output.",
    rubric:
      "Full credit names Q as what the token is looking for and K as what a token offers, states that the raw score is the dot product of Q and K, includes the divide by the square root of the key dimension, and says softmax turns the scaled scores into positive weights that sum to one. Partial credit if the scaling or the softmax normalization is missing. Deduct if the learner confuses the Value with the Key or claims the score comes from anything other than the query and key dot product.",
    support_ref: "Lesson 15 Part 1: How Q, K, V Produce Attention Scores",
    concept: "qk-attention-scoring",
    difficulty: "medium",
  },
  {
    id: "l15-ff-routing-vs-transform",
    text: "A classmate says the attention sublayer replaces each token's vector with a blend of the other tokens, and that the MLP then mixes information between tokens. Two things are wrong here. Identify both and correct them.",
    type: "free_text",
    actual_answer:
      "First, attention does not replace the token vector. It computes a context mixing update and adds that update back to the incoming vector through the residual connection, written H_after = H_input + Attention(LayerNorm(H_input)). The original information is preserved and the new context is layered on top. Second, the MLP does not mix information between tokens. It runs on each token independently with no cross token communication. Attention is the part that routes information across positions, and the MLP transforms each token on its own by expanding, gating with GELU, then compressing.",
    rubric:
      "Full credit corrects both errors: attention adds rather than replaces because of the residual connection, and the MLP is per token with no cross token mixing while attention is what moves information across positions. Partial credit for correcting only one. Deduct if the learner swaps the roles and claims attention is per token or that the MLP mixes tokens.",
    support_ref: "Lesson 15 Part 2 (The Residual Stream) and Part 3 (The MLP)",
    concept: "attention-routing-vs-mlp-transform",
    difficulty: "medium",
  },
  {
    id: "l15-ff-softmax-saturation",
    text: "Suppose you drop the scaling step and use a large key dimension, so the raw Q dot K scores become very large before softmax. Predict what happens to the attention weights and to the gradients during training, and explain why.",
    type: "free_text",
    actual_answer:
      "With no scaling and a large key dimension the dot products grow large in magnitude. Softmax over large inputs becomes very peaked, so almost all the weight lands on a single token and the others get weight near zero. In that saturated region the softmax gradient is close to zero, so very little learning signal flows back through the attention weights and training becomes unstable or slow. Dividing by the square root of the key dimension keeps the scores in a range where softmax stays smoother and the gradients stay useful.",
    rubric:
      "Full credit says the large dot products push softmax into a saturated, nearly one hot distribution and that the gradients in that region shrink toward zero, which hurts training, and connects this to why the square root of the key dimension scaling exists. Partial credit for noting saturation without the gradient consequence. Deduct if the learner claims the scaling changes whether the weights are positive or affects the Value vectors.",
    support_ref: "Lesson 15 Part 1: scaling by the square root of the key dimension",
    concept: "softmax-saturation-scaling",
    difficulty: "hard",
  },
  {
    id: "l15-ff-mlp-gelu",
    text: "Describe what the MLP sublayer does to a single token's vector, step by step, and explain why GELU is used instead of a hard cutoff like ReLU.",
    type: "free_text",
    actual_answer:
      "The MLP takes one token's vector and first expands it with a linear layer from the model dimension up to about four times that size. It then applies GELU, a smooth gate that multiplies each value by how likely it is to be positive using the Gaussian CDF, so strongly positive values pass through, strongly negative values are suppressed, and values near zero are smoothly interpolated. A second linear layer compresses the expanded vector back down to the model dimension. GELU is preferred over ReLU because ReLU hard cuts every negative value to exactly zero, which throws away gradient information, while GELU stays smooth, gives more useful gradients, and works well with the pretrained models we use.",
    rubric:
      "Full credit lists expand to about four times the dimension, apply GELU, then compress back to the model dimension, and explains that GELU is a smooth gate based on the Gaussian CDF that gives better gradients than ReLU's hard zero cutoff. Partial credit for the three step shape change without the GELU reasoning. Deduct if the learner says the MLP mixes across tokens or changes the sequence length.",
    support_ref: "Lesson 15 Part 3: The MLP, Per-Token Expansion and the GELU Gate",
    concept: "mlp-expand-gelu-compress",
    difficulty: "medium",
  },
];

// act90: ungraded "Next Lesson Diagnostic" reflection prompts. These surface
// what the learner still finds unclear so the next lesson can adapt. Free text,
// no rubric (not graded), each with a stable id, learner-facing text, and hint.
const ACT90_QUESTIONS: FreeformQuestion[] = [
  {
    id: "l15-diag-weight-learning",
    text: "Now that you have seen how W_Q, W_K, W_V, W1, and W2 are used inside a block, which part of how those weight matrices actually get learned feels most unclear to you?",
    type: "free_text",
    hint: "Name the exact step, for example the loss, backpropagation, or the optimizer.",
    concept: "next-lesson-weight-learning",
    difficulty: "medium",
  },
  {
    id: "l15-diag-multi-head",
    text: "Multi-head attention runs several separate Q, K, V projections in parallel. What do you think having multiple heads buys you compared to one larger attention computation?",
    type: "free_text",
    hint: "Think about what different heads might each specialize in.",
    concept: "next-lesson-multi-head",
    difficulty: "medium",
  },
  {
    id: "l15-diag-reinforce",
    text: "Which single idea from this lesson, attention scoring, the residual stream, or the MLP, would you most like the next lesson to reinforce with more worked examples?",
    type: "free_text",
    hint: "Pick the one that still feels the least concrete.",
    concept: "next-lesson-reinforce",
    difficulty: "easy",
  },
];

const BACKFILLS: Record<number, FreeformQuestion[]> = {
  89: ACT89_QUESTIONS,
  90: ACT90_QUESTIONS,
};

function main() {
  const validateOnly = process.argv.includes("--validate");
  const db = getDb();
  const select = db.prepare("SELECT id, lesson_id, activity_type, title, content FROM lesson_activities WHERE id = ?");
  const update = db.prepare("UPDATE lesson_activities SET content = ?, updated_at = datetime('now') WHERE id = ?");

  let changed = 0;
  for (const [idStr, questions] of Object.entries(BACKFILLS)) {
    const activityId = Number(idStr);
    const row = select.get(activityId) as
      | { id: number; lesson_id: number; activity_type: string; title: string | null; content: string | null }
      | undefined;
    if (!row) throw new Error(`activity ${activityId} not found`);
    if (row.activity_type !== "assessment") {
      throw new Error(`activity ${activityId} is ${row.activity_type}, expected assessment`);
    }

    const content = JSON.parse(row.content ?? "{}") as Record<string, unknown>;
    const nextContent = { ...content, questions };

    const validation = validateAssessmentContent(nextContent);
    if (!validation.valid) {
      throw new Error(`activity ${activityId} (L${row.lesson_id}) invalid after backfill: ${validation.errors.join("; ")}`);
    }

    if (validateOnly) {
      console.log(`VALIDATE OK act${activityId} (L${row.lesson_id}) "${row.title}" questions=${questions.length}`);
      continue;
    }

    update.run(JSON.stringify(nextContent), activityId);
    changed++;
    console.log(`backfilled act${activityId} (L${row.lesson_id}) "${row.title}" with ${questions.length} valid freeform questions`);
  }

  if (validateOnly) {
    console.log("Validation-only run complete. No rows written.");
  } else {
    console.log(`Done. Rewrote freeform questions on ${changed} Lesson 15 assessment activities. content.quiz preserved.`);
  }
}

main();
