import { getDb } from "../src/db/connection";
import { validateAssessmentContent } from "../src/lib/lesson-content/schema";

type AssessmentQuestion = Record<string, unknown>;

const questionBackfills: Record<number, AssessmentQuestion[]> = {
  2: [
    {
      id: "q1",
      text: "Fill the key Bayes terms for this test example.",
      type: "fill_blank",
      blanks: [
        { id: "prior", label: "Disease rate before seeing the test" },
        { id: "sensitivity", label: "Chance of a positive test when sick" },
        { id: "specificity", label: "Chance of a negative test when healthy" },
      ],
      actual_answer: "prior: prevalence or base rate; sensitivity: P(positive | sick); specificity: P(negative | healthy)",
      accepted_answers: ["prior/base rate/prevalence", "sensitivity/true positive rate", "specificity/true negative rate"],
      rubric: "Correct answers identify the starting population rate, the true-positive rate among sick people, and the true-negative rate among healthy people. Equivalent wording is fine.",
      support_ref: "Lesson 2 Part 1 and Part 2",
      concept: "bayes-test-terms",
      difficulty: "easy",
    },
    {
      id: "q2",
      text: "Put the Filter Funnel steps in the order you should reason through a positive test.",
      type: "ordering",
      items: [
        "Split the population into sick and healthy groups.",
        "Run the test separately through each group.",
        "Count true positives and false positives.",
        "Compute the fraction of positive tests that came from the sick group.",
      ],
      actual_answer: "1. Split the population into sick and healthy groups. 2. Run the test separately through each group. 3. Count true positives and false positives. 4. Compute the fraction of positives that came from the sick group.",
      rubric: "The population split must come before test accuracy, and posterior calculation must come after true positives and false positives are counted.",
      support_ref: "Lesson 2 Part 3: Posterior reads the positive pile",
      concept: "posterior-update-order",
      difficulty: "medium",
    },
    {
      id: "q3",
      text: "Why can a positive result on an accurate test still mean you probably do not have a rare disease?",
      type: "free_text",
      actual_answer: "Because the healthy group can be much larger than the sick group. Even a small false-positive rate applied to many healthy people can create more false positives than true positives.",
      rubric: "Correct answers must mention the base rate or large healthy population and explain how false positives can outnumber true positives.",
      support_ref: "Lesson 2 Part 1 and Part 3",
      concept: "base-rate-fallacy",
      difficulty: "medium",
    },
  ],
  3: [
    {
      id: "q1",
      text: "Match each market term to the pressure it creates.",
      type: "matching",
      prompts: [
        { id: "shortage", text: "Shortage" },
        { id: "surplus", text: "Surplus" },
        { id: "equilibrium", text: "Equilibrium" },
      ],
      options: [
        { id: "price_up", text: "Quantity demanded exceeds quantity supplied, pushing price up" },
        { id: "price_down", text: "Quantity supplied exceeds quantity demanded, pushing price down" },
        { id: "no_pressure", text: "Quantity demanded equals quantity supplied" },
      ],
      actual_answer: "Shortage matches price_up. Surplus matches price_down. Equilibrium matches no_pressure.",
      rubric: "Correct answers pair shortage with upward price pressure, surplus with downward price pressure, and equilibrium with no pressure to change.",
      support_ref: "Lesson 3 Part 1 and Part 2",
      concept: "market-pressure",
      difficulty: "easy",
    },
    {
      id: "q2",
      text: "Classify each tax-incidence example.",
      type: "classification",
      items: [
        { id: "inelastic_demand", text: "Demand is less price-sensitive than supply" },
        { id: "inelastic_supply", text: "Supply is less price-sensitive than demand" },
        { id: "same_elasticity", text: "Demand and supply have similar price sensitivity" },
      ],
      categories: [
        { id: "buyers", label: "Buyers bear more tax" },
        { id: "sellers", label: "Sellers bear more tax" },
        { id: "shared", label: "Burden is roughly shared" },
      ],
      actual_answer: "inelastic_demand: buyers; inelastic_supply: sellers; same_elasticity: shared.",
      rubric: "The less price-sensitive side bears more tax. Similar sensitivity means the burden is split more evenly.",
      support_ref: "Lesson 3 Part 3",
      concept: "tax-incidence-elasticity",
      difficulty: "medium",
    },
    {
      id: "q3",
      text: "In your own words, what does the equilibrium price represent?",
      type: "free_text",
      actual_answer: "The equilibrium price is the price where quantity demanded equals quantity supplied, so there is no shortage or surplus pushing price up or down.",
      rubric: "Correct answers must connect equilibrium to quantity demanded equaling quantity supplied and no pressure for price to move.",
      support_ref: "Lesson 3 Part 1",
      concept: "equilibrium-definition",
      difficulty: "easy",
    },
  ],
  4: [
    {
      id: "gq1",
      text: "Put the image preprocessing steps in the order the model expects.",
      type: "ordering",
      items: [
        "Open/decode the image.",
        "Resize to the model's target resolution.",
        "Convert uint8 pixels to float values and divide by 255.",
        "Normalize with the channel mean and standard deviation.",
        "Reorder axes from HWC to CHW.",
        "Add the batch dimension.",
      ],
      actual_answer: "1. Open/decode. 2. Resize. 3. Convert to float and divide by 255. 4. Normalize. 5. Reorder HWC to CHW. 6. Add batch dimension.",
      rubric: "Resize must happen before the final model tensor, rescale must happen before normalization, axis reorder must happen before model input, and batching is last.",
      support_ref: "Lesson 4 preprocessing pipeline",
      concept: "image-preprocessing-order",
      difficulty: "medium",
    },
    {
      id: "gq2",
      text: "Fill the shape labels for a single RGB image after preprocessing.",
      type: "fill_blank",
      blanks: [
        { id: "pil", label: "PIL/NumPy image shape before permute" },
        { id: "chw", label: "Tensor shape after channel reorder" },
        { id: "batch", label: "Tensor shape after adding batch dimension" },
      ],
      actual_answer: "pil: (height, width, 3) or HWC; chw: (3, height, width) or CHW; batch: (1, 3, height, width) or NCHW",
      accepted_answers: ["HWC", "CHW", "NCHW"],
      rubric: "Correct answers identify HWC before permute, CHW after permute, and NCHW after adding a batch dimension.",
      support_ref: "Lesson 4 Shape, Axis, and Batch Contract",
      concept: "axis-order-hwc-chw",
      difficulty: "medium",
    },
    {
      id: "gq3",
      text: "You forget the axis permute and pass shape (896, 896, 3) to a model expecting (3, 896, 896). What goes wrong?",
      type: "free_text",
      actual_answer: "The model reads height as channels and interprets the dimensions incorrectly. The shape contract is violated, so the tensor is rejected or the data is mapped to the wrong axes.",
      rubric: "Correct answers must explain that the axes are in the wrong semantic order, not merely that the numbers are different.",
      support_ref: "Lesson 4 axis-order explanation",
      concept: "axis-order-bug",
      difficulty: "hard",
    },
  ],
  5: [
    {
      id: "q1",
      text: "Put the LLM lifecycle stages in the order they happen.",
      type: "ordering",
      items: [
        "Raw text corpus is collected and cleaned.",
        "Text is tokenized into IDs.",
        "The model is pretrained to predict tokens.",
        "The model is aligned or instruction-tuned.",
        "Weights are packaged and served for inference.",
      ],
      actual_answer: "1. Collect and clean raw text. 2. Tokenize text. 3. Pretrain token prediction. 4. Align or instruction-tune. 5. Package and serve for inference.",
      rubric: "The data and tokenization steps must come before training, alignment must come after pretraining, and serving/inference comes after a trained model exists.",
      support_ref: "Lesson 5 lifecycle overview",
      concept: "llm-lifecycle-order",
      difficulty: "medium",
    },
    {
      id: "q2",
      text: "Match the lifecycle artifact to what it does.",
      type: "matching",
      prompts: [
        { id: "tokens", text: "Tokens" },
        { id: "weights", text: "Weights" },
        { id: "runtime", text: "Runtime/server" },
      ],
      options: [
        { id: "ids", text: "Integer IDs the model reads instead of raw text" },
        { id: "learned", text: "Learned parameters produced by training" },
        { id: "serves", text: "Loads the model and generates responses" },
      ],
      actual_answer: "Tokens: ids. Weights: learned. Runtime/server: serves.",
      rubric: "Correct answers distinguish the representation, the trained parameters, and the serving process.",
      support_ref: "Lesson 5 lifecycle artifacts",
      concept: "llm-artifact-roles",
      difficulty: "easy",
    },
    {
      id: "q3",
      text: "Why is tokenization not just a cosmetic preprocessing step?",
      type: "free_text",
      actual_answer: "Tokenization defines the discrete symbols the model can read and predict. It shapes vocabulary, sequence length, cost, and how text is split before the model ever sees it.",
      rubric: "Correct answers must explain that tokenization changes the model's actual input representation, not only formatting.",
      support_ref: "Lesson 5 tokenization section",
      concept: "tokenization-role",
      difficulty: "medium",
    },
  ],
  7: [
    {
      id: "q1",
      text: "Fill the KV cache roles.",
      type: "fill_blank",
      blanks: [
        { id: "k", label: "K stores" },
        { id: "v", label: "V stores" },
        { id: "why", label: "The cache avoids recomputing" },
      ],
      actual_answer: "K stores key vectors for previous tokens. V stores value vectors for previous tokens. The cache avoids recomputing attention keys and values for the whole prefix each step.",
      rubric: "Correct answers identify keys and values as cached per previous token and explain that the cache saves repeated prefix computation.",
      support_ref: "Lesson 7 KV cache explanation",
      concept: "kv-cache-purpose",
      difficulty: "medium",
    },
    {
      id: "q2",
      text: "Put one generation step in order.",
      type: "ordering",
      items: [
        "Embed the latest token.",
        "Use cached keys/values from earlier tokens.",
        "Compute logits for the next token.",
        "Sample or choose the next token.",
        "Append the new token and update the cache.",
      ],
      actual_answer: "1. Embed latest token. 2. Use cached keys/values. 3. Compute logits. 4. Sample/choose next token. 5. Append token and update cache.",
      rubric: "The answer should preserve the loop: current token in, cached prefix reused, logits computed, next token selected, cache updated.",
      support_ref: "Lesson 7 generation loop",
      concept: "autoregressive-generation-order",
      difficulty: "medium",
    },
    {
      id: "q3",
      text: "Classify each generation setting.",
      type: "classification",
      items: [
        { id: "temperature", text: "Higher temperature makes sampling more varied" },
        { id: "max_tokens", text: "Maximum new tokens limits response length" },
        { id: "context", text: "Context window limits how much history can be attended to" },
      ],
      categories: [
        { id: "sampling", label: "Sampling behavior" },
        { id: "length", label: "Output length control" },
        { id: "memory", label: "Prompt/history capacity" },
      ],
      actual_answer: "temperature: sampling; max_tokens: length; context: memory.",
      rubric: "Correct answers separate randomness, output length, and available prompt/history capacity.",
      support_ref: "Lesson 7 inference settings",
      concept: "generation-controls",
      difficulty: "easy",
    },
  ],
  8: [
    {
      id: "q1",
      text: "Match each AWS idea to the closest GCP idea.",
      type: "matching",
      prompts: [
        { id: "account", text: "AWS account boundary" },
        { id: "iam", text: "IAM role/policy" },
        { id: "region", text: "Region/zone placement" },
      ],
      options: [
        { id: "project", text: "GCP project as the main resource and billing boundary" },
        { id: "gcp_iam", text: "GCP IAM bindings on resources, folders, projects, or orgs" },
        { id: "location", text: "GCP regions and zones for workload placement" },
      ],
      actual_answer: "AWS account boundary maps most closely to GCP project. IAM role/policy maps to GCP IAM bindings. Region/zone maps to GCP regions and zones.",
      rubric: "Correct answers should show the AWS-to-GCP analogy while acknowledging it is approximate.",
      support_ref: "Lesson 8 AWS-to-GCP mapping",
      concept: "gcp-aws-mapping",
      difficulty: "easy",
    },
    {
      id: "q2",
      text: "Classify each GCP concern.",
      type: "classification",
      items: [
        { id: "billing", text: "Which team pays for this workload?" },
        { id: "permissions", text: "Who can deploy or read this resource?" },
        { id: "latency", text: "Where should this workload run?" },
      ],
      categories: [
        { id: "project", label: "Project/billing structure" },
        { id: "iam", label: "IAM and access" },
        { id: "location", label: "Region/zone choice" },
      ],
      actual_answer: "billing: project; permissions: IAM; latency: location.",
      rubric: "Correct answers classify billing ownership as project structure, access control as IAM, and workload placement as region/zone choice.",
      support_ref: "Lesson 8 core services and identity",
      concept: "gcp-operating-model",
      difficulty: "medium",
    },
    {
      id: "q3",
      text: "Why is a GCP project more than just a folder for resources?",
      type: "free_text",
      actual_answer: "A project is a major boundary for resources, IAM policy, APIs, quotas, and billing. It is closer to an operational container than a visual folder.",
      rubric: "Correct answers should mention at least two of resources, IAM, APIs, quotas, or billing, and should reject the idea that a project is only visual organization.",
      support_ref: "Lesson 8 project boundary explanation",
      concept: "gcp-project-boundary",
      difficulty: "medium",
    },
  ],
};

function main() {
  const db = getDb();
  const update = db.prepare("UPDATE lesson_activities SET content = ?, updated_at = datetime('now') WHERE id = ?");
  const rows = db
    .prepare(
      "SELECT l.id AS lesson_id, a.id AS activity_id, a.content FROM lessons l JOIN lesson_activities a ON a.lesson_id = l.id WHERE l.status != 'completed' AND a.activity_type = 'assessment' ORDER BY l.id"
    )
    .all() as Array<{ lesson_id: number; activity_id: number; content: string }>;

  let changed = 0;
  for (const row of rows) {
    const questions = questionBackfills[row.lesson_id];
    if (!questions) continue;
    const content = JSON.parse(row.content) as Record<string, unknown>;
    const nextContent = { ...content, questions };
    const validation = validateAssessmentContent(nextContent);
    if (!validation.valid) {
      throw new Error(`Lesson ${row.lesson_id} assessment invalid: ${validation.errors.join("; ")}`);
    }
    update.run(JSON.stringify(nextContent), row.activity_id);
    changed++;
  }
  console.log(`Backfilled ${changed} incomplete lesson assessments with creative judged question types.`);
}

main();
