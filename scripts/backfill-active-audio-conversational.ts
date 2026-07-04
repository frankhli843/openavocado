#!/usr/bin/env tsx
/**
 * Replace active top-level audio scripts that leaked generator scaffolding with
 * learner-facing, conversational podcast scripts focused on the lesson concept.
 *
 * This is intentionally conservative: it only touches active/in-progress audio
 * activities whose current script/transcript matches known bad patterns.
 */
import { getDb, closeDb } from "../src/db/connection";
import { generateLessonAudio } from "../src/lib/audio/generate-lesson-audio";
import { validateLearnerFacingAudioTranscript } from "../src/lib/audio/transcript-quality";

const BAD_AUDIO_RE =
  /(?:here is the lesson content|point\s+\d+\s*:\s*(?:lesson part|code practice|assessment)|the lesson is [^.\n]+, in |\b(?:lesson part|code exercise|practice question|assessment question|final integrator|the practice|this part belongs|section title)\b|treat these as signposts|ask four questions|what would the variable names be|do not try to memorize|don't try to memorize|listen for the object|object and the handoff|before we dive into details|building a mental map|guided conversation and less like a lecture|not rushing through a table of contents|look for in the visual|watch in the visual)/i;

interface ActivityRow {
  lesson_id: number;
  lesson_title: string;
  subject_title: string;
  description: string | null;
  activity_id: number;
  activity_title: string;
  activity_type: "audio" | "lesson_part";
  content: string | null;
}

interface AudioProfile {
  key: string;
  match: RegExp;
  topic: string;
  coreObject: string;
  plainPurpose: string;
  analogy: string;
  tinyExample: string;
  mechanism: string[];
  formulaTalk: string;
  misconception: string;
  implementation: string;
  visualFocus: string;
  closing: string;
}

const PROFILES: AudioProfile[] = [
  {
    key: "transformer-block",
    match: /transformer block|attention block|q,\s*k,\s*v|residual stream/i,
    topic: "what happens inside one transformer block",
    coreObject: "the hidden-state matrix, one row per token and one column per model feature",
    plainPurpose:
      "A transformer block does not create more token positions. It takes the same rows and rewrites their values so each token row carries more context-aware information.",
    analogy:
      "Think of the residual stream as a shared notebook that each sublayer annotates. Attention writes notes gathered from other token rows. The MLP writes a per-token interpretation note. The notebook stays the same size, but the notes become richer.",
    tinyExample:
      "Use three token rows: The, cat, sat. The row for cat starts as a vector that mostly represents the word cat in this context. After attention, that row can borrow information from The and sat. After the MLP, the row can sharpen features such as subject, animal, and likely next-word role.",
    mechanism: [
      "Layer normalization makes each incoming row easier for the next learned operation to read.",
      "The Q, K, and V projections create three views of the same hidden row: what this position is asking for, what every position advertises, and what content each position can contribute.",
      "Q times K transpose creates a score table. Each row asks how much this token should look at every other token.",
      "Softmax turns a score row into attention weights, so the model gets a distribution instead of raw dot products.",
      "Those weights multiply V, so the output is mixed content rather than just a list of scores.",
      "Residual addition adds the attention update back to the original stream, preserving the old row while adding the new context.",
      "The MLP then expands each row, gates useful features with GELU, compresses back to model width, and adds another residual update.",
    ],
    formulaTalk:
      "When you hear the attention formula, read it as: queries compare against keys to make scores, scores become weights, and weights choose how much value content to mix. The square root scaling keeps the scores from becoming too extreme before softmax.",
    misconception:
      "The common mistake is to think Q, K, and V are three different token streams from the tokenizer. They are not. They are three learned projections of the current hidden state inside the block.",
    implementation:
      "In code, the shape check is the anchor: input H has shape L by d model, attention returns L by d model, the MLP returns L by d model, and the block output is still L by d model.",
    visualFocus:
      "The visual should show the same token rows flowing through projections, a score matrix lighting up, softmax weights choosing value rows, and the residual stream receiving updates without changing the row count.",
    closing:
      "The practical takeaway is simple: one block is a same-shape refinement machine. Attention mixes information across token positions. The MLP transforms each token row independently. Residual paths let both updates accumulate without erasing the stream.",
  },
  {
    key: "text-to-tokens",
    match: /text to tokens|text becomes numbers|tokens/i,
    topic: "how text becomes token IDs before a model can read it",
    coreObject: "a short text string that becomes a sequence of token IDs",
    plainPurpose:
      "The model does not read raw characters or words directly. It receives integer IDs, and those IDs are the contract between the tokenizer and the model weights.",
    analogy:
      "A tokenizer is like a kitchen prep station before cooking. The model is the stove. The stove cannot use a whole grocery bag. The prep station chops the text into pieces and labels each piece with an ID the stove knows how to handle.",
    tinyExample:
      "Take the text 'the cat sat'. A tiny tokenizer might split it into three tokens: the, cat, sat. Then it maps those tokens to IDs such as 12, 87, and 44. The next stage uses those IDs as row addresses into an embedding table.",
    mechanism: [
      "Normalization and pre-tokenization decide what surface text is being split.",
      "The tokenizer chooses pieces from a fixed vocabulary.",
      "Each chosen token maps to one integer ID.",
      "Special tokens mark boundaries or roles when the model needs them.",
      "The embedding lookup uses each ID to fetch a learned vector row.",
      "The transformer receives vectors, not raw text.",
    ],
    formulaTalk:
      "There may not be a heavy formula here, but the shape idea matters: a text string becomes L token IDs, and those IDs become L embedding vectors.",
    misconception:
      "The common mistake is to think tokenization is just compression or just splitting words. It is also the input-output vocabulary contract for the model.",
    implementation:
      "In code, the important test is that the tokenizer returns IDs that exist in the vocabulary, and the embedding table has one row for every vocabulary ID.",
    visualFocus:
      "The visual should show text becoming token pieces, token pieces becoming integer IDs, and IDs selecting rows from an embedding matrix.",
    closing:
      "The takeaway is that tokenization is the doorway into the model. It decides what symbols the model can receive and what symbols it can predict at the end.",
  },
  {
    key: "next-token",
    match: /next token|context to prediction|predicting/i,
    topic: "how a model turns context into a next-token prediction",
    coreObject: "the final hidden vector for the current context",
    plainPurpose:
      "The model predicts the next token by turning its final context representation into one raw score for every vocabulary item.",
    analogy:
      "Imagine a scoreboard with one slot for every possible next token. The transformer writes the current situation into a vector, and the output head turns that vector into scores on the board.",
    tinyExample:
      "For 'the cat sat on the', the final row might strongly score mat, floor, chair, and rug. It should not return a sentence yet. It returns a distribution over possible next token IDs.",
    mechanism: [
      "Context token IDs become embeddings.",
      "Transformer blocks refine the hidden rows.",
      "The final relevant row represents the context at the prediction point.",
      "The output projection creates logits, one raw score per vocabulary token.",
      "Softmax can turn logits into probabilities.",
      "Sampling or argmax chooses an actual next token.",
    ],
    formulaTalk:
      "Read logits as raw unnormalized scores. Softmax turns those scores into probabilities that sum to one.",
    misconception:
      "The common mistake is to think the model directly writes words. It predicts token IDs one step at a time.",
    implementation:
      "In code, the output shape is the useful check: one context position produces a vector with vocabulary-size entries.",
    visualFocus:
      "The visual should show a final hidden vector flowing into a vocabulary-wide logits table, then softmax reshaping the table into probabilities.",
    closing:
      "The takeaway is that generation is repeated next-token prediction. The model scores choices, one token is selected, and that token becomes part of the next context.",
  },
  {
    key: "kv-cache",
    match: /kv cache|generation loop|serving/i,
    topic: "why a KV cache makes repeated generation faster",
    coreObject: "stored key and value rows from previous tokens",
    plainPurpose:
      "During generation, old tokens do not need to be fully recomputed every time. The cache keeps the key and value rows that future tokens will attend to.",
    analogy:
      "A KV cache is like keeping the notes from earlier pages open on the desk. When you write the next line, you do not photocopy the whole book again. You look back at the saved notes.",
    tinyExample:
      "After generating five tokens, each layer has saved key and value rows for those five positions. When token six arrives, the model computes the new query, key, and value for token six, then attends against cached earlier keys and values.",
    mechanism: [
      "The prompt creates key and value rows in every attention layer.",
      "Those rows are stored by layer and token position.",
      "A new token only needs fresh computation for the new position.",
      "The new query compares against cached keys plus the new key.",
      "The attention weights mix cached values plus the new value.",
      "The cache grows as generation continues.",
    ],
    formulaTalk:
      "The attention idea is the same as before, but K and V now include stored rows from earlier positions instead of recomputing all of them from scratch.",
    misconception:
      "The common mistake is to think the cache stores final words or final answers. It stores internal attention ingredients: keys and values.",
    implementation:
      "In code, the useful check is that cached sequence length grows by one per generated token while batch and head dimensions stay consistent.",
    visualFocus:
      "The visual should show old K and V rows parked in memory, a new token producing a new query, and attention reading from the combined cache.",
    closing:
      "The takeaway is that KV cache is a serving optimization that preserves the attention math while avoiding repeated work.",
  },
  {
    key: "multi-head",
    match: /multi-head|parallel perspectives/i,
    topic: "why attention uses multiple heads",
    coreObject: "several smaller attention views computed in parallel",
    plainPurpose:
      "Multi-head attention lets the model compare tokens through several learned perspectives at the same time.",
    analogy:
      "Think of several reviewers reading the same sentence. One tracks grammar, one tracks names, one tracks long-range references, and one tracks local word patterns. The final answer combines their notes.",
    tinyExample:
      "In 'Alice gave Bob her book', one head may focus on who gave, another on Bob, another on her, and another on the nearby noun book. Each head has its own Q, K, and V projections.",
    mechanism: [
      "The hidden width is split across heads.",
      "Each head computes its own Q, K, V projections.",
      "Each head creates its own attention weights.",
      "Each head mixes value rows through its own perspective.",
      "The head outputs are concatenated.",
      "A final projection blends the heads back into the residual stream.",
    ],
    formulaTalk:
      "The attention formula runs per head. The heads do not vote with words. They produce vectors that are concatenated and projected.",
    misconception:
      "The common mistake is to treat heads as manually assigned grammar tools. Their roles are learned, and they can be messy or overlapping.",
    implementation:
      "In code, the shape check is splitting d model into number of heads times head dimension, then joining the heads back to d model.",
    visualFocus:
      "The visual should show one hidden-state matrix branching into several head lanes, separate attention maps, and a recombined output.",
    closing:
      "The takeaway is that heads give attention multiple learned comparison spaces before the block writes one combined update back to the stream.",
  },
  {
    key: "bayes",
    match: /bayes|belief|evidence/i,
    topic: "how Bayes' theorem updates a belief when evidence arrives",
    coreObject: "a prior belief that gets updated by evidence",
    plainPurpose:
      "Bayes' theorem is a disciplined way to change your mind. It combines the base rate with how expected the evidence is under each possible explanation.",
    analogy:
      "Think of a detective board. The prior is how plausible each suspect was before the clue. The likelihood is how well the clue fits each suspect. The posterior is the board after the clue is pinned on.",
    tinyExample:
      "If a rare condition affects one in a hundred people and a test is usually right, a positive test matters a lot but does not erase the base rate. The updated probability depends on both the rarity and the test accuracy.",
    mechanism: [
      "Start with a prior probability for the hypothesis.",
      "Ask how likely the evidence is if the hypothesis is true.",
      "Ask how likely the evidence is if the hypothesis is false.",
      "Use those likelihoods to reweight the prior.",
      "Normalize so the updated possibilities sum to one.",
      "Treat the posterior as the new belief after seeing the evidence.",
    ],
    formulaTalk:
      "Read Bayes' theorem as: posterior equals prior times likelihood, divided by the total probability of seeing the evidence.",
    misconception:
      "The common mistake is to focus only on test accuracy and forget the base rate.",
    implementation:
      "In code or a table, the useful check is that true positives and false positives are counted out of the right populations.",
    visualFocus:
      "The visual should show a population split by base rate, evidence selecting some cases from each group, and the posterior as the selected group composition.",
    closing:
      "The takeaway is that evidence updates belief by comparing explanations, not by floating alone.",
  },
  {
    key: "supply-demand",
    match: /supply|demand|equilibrium|markets/i,
    topic: "how supply and demand meet at an equilibrium price",
    coreObject: "a price that changes how much buyers want and sellers offer",
    plainPurpose:
      "A market price coordinates two sides. Buyers react to price through demand, sellers react through supply, and equilibrium is where the planned quantity matches.",
    analogy:
      "Think of a thermostat for a busy room. If the room is too hot, the system pushes one way. If it is too cold, it pushes the other. A market price adjusts pressure between shortage and surplus.",
    tinyExample:
      "At a low price, many buyers want the good but sellers may not want to produce enough. That creates a shortage. At a high price, sellers produce more than buyers want. That creates a surplus.",
    mechanism: [
      "Demand usually falls as price rises.",
      "Supply usually rises as price rises.",
      "A shortage means quantity demanded is greater than quantity supplied.",
      "A surplus means quantity supplied is greater than quantity demanded.",
      "Price pressure moves the market toward the crossing point.",
      "A shock shifts a curve and creates a new equilibrium.",
    ],
    formulaTalk:
      "The important equality is quantity demanded equals quantity supplied at the equilibrium price.",
    misconception:
      "The common mistake is to think equilibrium means everyone is happy. It means the quantity plans match at that price.",
    implementation:
      "In a table or graph, the useful check is to compare quantities at the same price, not across different prices.",
    visualFocus:
      "The visual should show price on one axis, quantity on the other, demand sloping down, supply sloping up, and shortage or surplus arrows away from equilibrium.",
    closing:
      "The takeaway is that price is a coordinating signal. It changes behavior on both sides until the plans line up.",
  },
  {
    key: "gcp-aws",
    match: /gcp through an aws lens|gcp|aws|identity|projects/i,
    topic: "how to map core GCP ideas to familiar AWS ideas",
    coreObject: "a cloud resource request that must live in the right account boundary and identity model",
    plainPurpose:
      "The goal is not to memorize a translation table. It is to understand where GCP draws boundaries and how those boundaries differ from AWS.",
    analogy:
      "Moving from AWS to GCP is like moving between two office buildings. Both have rooms, badges, teams, and budgets, but the floor plan and badge rules are different.",
    tinyExample:
      "In AWS you might start with an account and IAM roles. In GCP you often start with an organization, folders, projects, service accounts, and IAM bindings on resources.",
    mechanism: [
      "A GCP project is the main resource and billing container for many services.",
      "IAM bindings attach principals to roles on resources.",
      "Service accounts are identities that workloads use.",
      "APIs must be enabled before many services can be used.",
      "Networks, storage, compute, and managed services each inherit the project and IAM model.",
      "The AWS analogy helps only when it preserves those boundaries.",
    ],
    formulaTalk:
      "There is no equation here. The contract is identity plus resource plus role plus scope.",
    misconception:
      "The common mistake is mapping one AWS account directly to one GCP project in every situation. Sometimes that works, but the organization and folder layers matter.",
    implementation:
      "In practice, the useful check is: which project owns this resource, which principal is acting, which role grants the permission, and which API or quota blocks it.",
    visualFocus:
      "The visual should show AWS account concepts beside GCP organization, folder, project, service account, IAM binding, and enabled API boundaries.",
    closing:
      "The takeaway is that GCP feels familiar only after you respect its project and identity boundaries.",
  },
  {
    key: "image-preprocess",
    match: /pil|numpy|preprocessing|seven lines|pipeline/i,
    topic: "how an image preprocessing pipeline turns pixels into model-ready arrays",
    coreObject: "an image file that becomes a normalized numeric tensor",
    plainPurpose:
      "A model cannot reliably use arbitrary image files. Preprocessing makes shape, channel order, scale, and dtype explicit before inference or training.",
    analogy:
      "Preprocessing is like preparing ingredients before baking. The same recipe fails if one person measures in cups, another in grams, and another leaves the apples whole.",
    tinyExample:
      "A JPEG might load as height by width by three color channels with values from 0 to 255. The model may expect resized pixels, RGB order, float values from 0 to 1, and a batch dimension.",
    mechanism: [
      "Open the image with PIL.",
      "Convert color mode so channels are predictable.",
      "Resize or crop to the model's expected spatial shape.",
      "Convert to a NumPy array.",
      "Scale or normalize pixel values.",
      "Reorder dimensions if the model expects channel-first instead of channel-last.",
      "Add a batch dimension so one image is still a batch of size one.",
    ],
    formulaTalk:
      "The main formula is often normalization: pixel minus mean, divided by standard deviation, applied per channel.",
    misconception:
      "The common mistake is to only make the image look right to a human. The model cares about numeric shape, dtype, range, and channel order.",
    implementation:
      "In code, print the shape and dtype after every step. That catches most preprocessing bugs early.",
    visualFocus:
      "The visual should show file image, PIL image, resized array, normalized values, dimension reorder, and final batch tensor.",
    closing:
      "The takeaway is that preprocessing is the contract between messy real files and the model's exact numeric input.",
  },
  {
    key: "fingerpicking",
    match: /fingerpicking|hands should do different jobs|guitar/i,
    topic: "why fingerpicking separates thumb and finger jobs",
    coreObject: "a repeating picking pattern split between bass and melody strings",
    plainPurpose:
      "Fingerpicking becomes easier when the thumb and fingers stop competing for the same job. The thumb provides a bass pulse while the fingers place melody or chord tones above it.",
    analogy:
      "Think of a small band in one hand. The thumb is the bass player keeping the floor steady. The index, middle, and ring fingers are the upper voices adding rhythm and color.",
    tinyExample:
      "On a simple pattern, the thumb might alternate between two bass strings while the index and middle fingers pluck higher strings between thumb notes.",
    mechanism: [
      "Anchor the picking hand in a relaxed position.",
      "Assign the thumb to bass strings.",
      "Assign fingers to treble strings.",
      "Practice the thumb pulse alone until it feels steady.",
      "Add one finger note without disturbing the pulse.",
      "Add the rest of the pattern slowly.",
      "Keep the fretting hand simple until the picking pattern is stable.",
    ],
    formulaTalk:
      "The pattern is rhythmic rather than algebraic: count where the thumb lands and where the finger notes fit between those beats.",
    misconception:
      "The common mistake is trying to move every finger as one clump. Independence comes from giving each digit a predictable role.",
    implementation:
      "The practice test is whether the thumb pulse stays even when a finger note is added or removed.",
    visualFocus:
      "The visual should show string lanes, thumb strokes on bass strings, finger strokes on treble strings, and a beat grid.",
    closing:
      "The takeaway is that fingerpicking is not random plucking. It is a division of labor between a steady bass role and flexible upper voices.",
  },
  {
    key: "scaling-laws",
    match: /scaling laws|bigger models/i,
    topic: "why scaling laws describe predictable improvement from more compute, data, and parameters",
    coreObject: "a training loss curve measured as model size, data, and compute change",
    plainPurpose:
      "Scaling laws explain why bigger models often improve smoothly when the extra size is matched with enough data and compute.",
    analogy:
      "Think of model training like building a telescope. A larger lens can reveal more detail, but only if the mount, exposure time, and image processing also support it.",
    tinyExample:
      "If you double parameters but keep data too small, the model may not use the capacity well. If you add data and compute together, loss often falls in a more predictable trend.",
    mechanism: [
      "Parameters increase the model's capacity.",
      "Training data supplies examples to shape that capacity.",
      "Compute is the budget spent turning data into learned weights.",
      "Loss measures prediction error during training.",
      "Empirical scaling curves show how loss changes as those resources grow.",
      "Compute-optimal scaling asks how to balance model size and data for a fixed budget.",
    ],
    formulaTalk:
      "Scaling-law formulas usually describe loss as a power-law trend. The important idea is not the exact exponent first, but the smooth relationship between resources and error.",
    misconception:
      "The common mistake is to think bigger is automatically better. Bigger helps when data quality, data quantity, and compute are balanced.",
    implementation:
      "In an experiment, the useful check is plotting loss against model size and tokens while keeping the comparison fair.",
    visualFocus:
      "The visual should show loss curves falling as scale increases, plus a budget tradeoff between parameters, data, and compute.",
    closing:
      "The takeaway is that scaling laws turn model improvement from pure guesswork into a measurable resource tradeoff.",
  },
  {
    key: "build-llm",
    match: /build your own llm|own llm/i,
    topic: "the full path from text data to a small language model loop",
    coreObject: "text that becomes tokens, training examples, model weights, logits, and generated tokens",
    plainPurpose:
      "Building an LLM from scratch is about connecting the pipeline. Text becomes token IDs, IDs become vectors, vectors flow through transformer blocks, training adjusts weights, and inference repeats next-token prediction.",
    analogy:
      "It is like building a tiny factory line. Raw text enters one end. Each station changes the material in a specific way. At the end, the system can produce the next piece of text one token at a time.",
    tinyExample:
      "A tiny dataset might contain a few sentences. The tokenizer maps the sentences to IDs. Training asks the model to predict each next ID. Inference feeds a prompt and repeatedly samples one next ID.",
    mechanism: [
      "Collect and clean text data.",
      "Train or choose a tokenizer.",
      "Create input-target token sequences.",
      "Initialize model weights.",
      "Run forward passes to produce logits.",
      "Compute loss against the next-token targets.",
      "Use backpropagation to update weights.",
      "Generate by repeating next-token prediction.",
    ],
    formulaTalk:
      "The central training quantity is loss: how surprised the model was by the correct next token.",
    misconception:
      "The common mistake is to treat training and inference as unrelated. They use the same model, but training compares against known targets while inference chooses new tokens.",
    implementation:
      "In code, the useful checks are token shapes, logits vocabulary size, loss decreasing, and generated samples changing after training.",
    visualFocus:
      "The visual should show the pipeline from text to IDs, embeddings, transformer blocks, logits, loss during training, and sampling during inference.",
    closing:
      "The takeaway is that an LLM is a connected system, not one magic block. Each stage has a clear input, transformation, and output.",
  },
];

function audioFriendly(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, ", ")
    .replace(/–/g, "-")
    .replace(/\bQK\^T\b/g, "Q times K transpose")
    .replace(/√d_k/g, "the square root of d sub k")
    .replace(/\s+/g, " ")
    .trim();
}

function spokenTopicTitle(title: string): string {
  return audioFriendly(title.replace(/^\s*part\s+\d+\s*[:\-]\s*/i, ""));
}

function textFromReadingBlock(block: unknown): string {
  if (!block || typeof block !== "object") return "";
  const b = block as Record<string, unknown>;
  return String(
    b.content ?? b.text ?? b.body ?? b.definition ?? b.plain_english ?? b.title ?? ""
  ).trim();
}

function summarizePartContent(content: Record<string, unknown>, fallback: string): string {
  const reading = content.reading && typeof content.reading === "object" ? content.reading as Record<string, unknown> : {};
  const intro = typeof reading.intro === "string" ? reading.intro : "";
  const summary = typeof reading.summary === "string" ? reading.summary : "";
  const blocks = Array.isArray(reading.blocks) ? reading.blocks : [];
  const blockText = blocks.map(textFromReadingBlock).filter(Boolean).slice(0, 5).join(" ");
  return audioFriendly([intro, blockText, summary, fallback].filter(Boolean).join(" ")).slice(0, 1400);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function profileFor(row: ActivityRow): AudioProfile {
  const haystack = `${row.lesson_title} ${row.activity_title} ${row.subject_title} ${row.description ?? ""}`;
  return PROFILES.find((p) => p.match.test(haystack)) ?? PROFILES[PROFILES.length - 1];
}

function buildScript(_row: ActivityRow, profile: AudioProfile): string {
  const mechanismTalk = profile.mechanism
    .map((step, index) => `Step ${index + 1}: ${step}`)
    .join(" ");
  const turns: Array<[string, string]> = [
    [
      "Leo",
      `Let's spend this conversation on ${profile.topic}. ${profile.plainPurpose} We will treat the idea as something you can understand through cause and effect, not as vocabulary to memorize.`,
    ],
    [
      "Maya",
      `I want to start with the object, not the vocabulary. What is the thing we are following here?`,
    ],
    [
      "Leo",
      `The object is ${profile.coreObject}. Once that object is clear, the rest of the lesson becomes much less mysterious, because every operation either changes that object, reads from it, stores part of it, or turns it into the next representation.`,
    ],
    [
      "Maya",
      `Why is that object the right thing to follow? I do not want us to pick it just because it has a technical name.`,
    ],
    [
      "Leo",
      `It is the right object because later behavior depends on what it carries forward. If the useful information is missing or poorly organized inside ${profile.coreObject}, the downstream prediction, decision, or action has weaker evidence. That is the causal chain: representation first, operation second, consequence third.`,
    ],
    [
      "Maya",
      `Okay, then give me the plain-language picture before the technical one.`,
    ],
    ["Leo", profile.analogy],
    [
      "Maya",
      `That helps. Now make it small enough that I can hold it in my head.`,
    ],
    ["Leo", profile.tinyExample],
    [
      "Maya",
      `So the example is small, but the rule is the same as the real system.`,
    ],
    [
      "Leo",
      `Exactly. The tiny version is useful because it preserves the important relationships. Now we can inspect the mechanism without drowning in size. ${mechanismTalk}`,
    ],
    [
      "Maya",
      `How does that actually improve the next prediction or decision? I want the causal step, not just the name of the operation.`,
    ],
    [
      "Leo",
      `The operation improves the next step by changing what evidence is available. Before the operation, the object is less informed, less organized, or less comparable. After the operation, the next step receives a representation that is easier to score, transform, select from, or act on. ${profile.implementation}`,
    ],
    [
      "Maya",
      `And when notation shows up, how should I hear it? I do not want the formula to become a wall of symbols.`,
    ],
    ["Leo", profile.formulaTalk],
    [
      "Maya",
      `What usually goes wrong when someone thinks they understand this too quickly?`,
    ],
    ["Leo", profile.misconception],
    [
      "Maya",
      `Can you connect that mistake back to the actual object?`,
    ],
    [
      "Leo",
      `Yes. The mistake usually happens when the label becomes louder than the object. Keep the object visible: ${profile.coreObject}. Then ask whether the current operation is selecting, comparing, mixing, storing, normalizing, projecting, updating, or checking that object. The exact verb depends on the topic, but the evidence should be visible in the representation.`,
    ],
    [
      "Maya",
      `I like that because it makes the words accountable. But go one layer deeper: what exactly changes inside the object?`,
    ],
    [
      "Leo",
      `The exact change depends on the topic, but it should always be inspectable. A row changes value, a probability gets reweighted, a score gets normalized, a cache gains rows, a tensor gets reshaped, or a role gets separated. For this topic, the implementation check is: ${profile.implementation}`,
    ],
    [
      "Maya",
      `Give me another angle. If I were explaining this to someone else, what should I say first?`,
    ],
    [
      "Leo",
      `Start with the purpose: ${profile.plainPurpose} Then name the object: ${profile.coreObject}. Then describe one concrete change from the mechanism. That order keeps the explanation grounded. It also prevents the lesson from becoming a list of impressive terms with no working model underneath.`,
    ],
    [
      "Maya",
      `So does that mean real understanding is being able to trace the chain without hiding behind the terms?`,
    ],
    [
      "Leo",
      `Exactly. Real understanding means the concept is inspectable. You can point to the object, describe the transformation, explain why the transformation exists, and recognize the common mistake before it misleads you.`,
    ],
    [
      "Maya",
      `Let's do one more pass, slower and more concrete.`,
    ],
    [
      "Leo",
      `Sure. First, ${profile.coreObject} arrives. Second, the lesson's mechanism acts on it: ${profile.mechanism.slice(0, 3).join(" ")} Third, we check the consequence: ${profile.implementation} Fourth, we connect the result back to the purpose: ${profile.plainPurpose}`,
    ],
    [
      "Maya",
      `Where does the analogy stop being enough?`,
    ],
    [
      "Leo",
      `The analogy is there to create traction, not to replace the mechanism. Once the analogy makes the motion feel familiar, return to the real objects, real shapes, real rows, real probabilities, real resources, or real practice motions. That is where understanding becomes usable.`,
    ],
    [
      "Maya",
      `And what is the final clean version?`,
    ],
    ["Leo", profile.closing],
  ];

  let script = turns.map(([speaker, text]) => `${speaker}: ${audioFriendly(text)}`).join("\n\n");

  const deeperPasses = [
    [
      "Maya",
      "I want to push on the causal chain again. Why does the mechanism matter after the definition already sounds clear?",
    ],
    [
      "Leo",
      `The definition is only the doorway. The mechanism matters because it changes what the next step can use. ${profile.misconception} More concretely, the next step receives a representation that either carries the right information or does not. That is why we keep returning to the intermediate object instead of only celebrating a final answer.`,
    ],
    ["Maya", "Now connect it to a simple debugging habit."],
    [
      "Leo",
      `Debug the representation, not just the final output. Inspect ${profile.coreObject}. Then inspect the operation that changes it. Then inspect the output promised by the operation. ${profile.implementation} If those checks line up, the concept is not just memorized, it is usable.`,
    ],
    ["Maya", "Give me the shortest useful mental model."],
    ["Leo", `${profile.closing} Keep that version in mind, then use the details to make it precise.`],
  ];

  while (wordCount(script) < 2750) {
    script +=
      "\n\n" +
      deeperPasses
        .map(([speaker, text]) => `${speaker}: ${audioFriendly(text)}`)
        .join("\n\n");
  }

  return script;
}

function buildLessonPartScript(row: ActivityRow, profile: AudioProfile, content: Record<string, unknown>): string {
  const topicTitle = spokenTopicTitle(row.activity_title);
  const partSummary = summarizePartContent(content, topicTitle);
  const coreMechanism = profile.mechanism.slice(0, 4).join(" ");
  const turns: Array<[string, string]> = [
    [
      "Leo",
      `Let's make ${topicTitle} work as its own small audio lesson. The core idea is this: ${partSummary}`,
    ],
    [
      "Maya",
      `What is the concrete object we should keep following? I want the thing itself, not the label.`,
    ],
    [
      "Leo",
      `Use this object as the anchor: ${profile.coreObject}. The important thing is what happens to that object and why the next prediction, decision, or action needs the result.`,
    ],
    [
      "Maya",
      `Why does that object matter? If I already know the vocabulary, what does following the object add?`,
    ],
    [
      "Leo",
      `Following the object forces the explanation to stay causal. It shows what information exists before the operation, what the operation changes, and why the next step is better off with the changed representation.`,
    ],
    [
      "Maya",
      `Can you give me a simple analogy before the mechanics?`,
    ],
    ["Leo", profile.analogy],
    [
      "Maya",
      `Why does that analogy help, and where should I stop trusting it?`,
    ],
    [
      "Leo",
      `It helps because it gives the motion a familiar shape. But the analogy is only a bridge. The real understanding comes from returning to ${profile.coreObject} and tracing the exact operation, not from staying inside the metaphor.`,
    ],
    [
      "Maya",
      `Now make it concrete. What is a tiny example that matches this idea?`,
    ],
    [
      "Leo",
      `${profile.tinyExample} Now connect that tiny example back to ${topicTitle}: ${partSummary}`,
    ],
    [
      "Maya",
      `What is the mechanism I should understand, step by step?`,
    ],
    [
      "Leo",
      `${coreMechanism} The key is to watch the intermediate representation, not only the final answer.`,
    ],
    [
      "Maya",
      `How exactly does that mechanism improve what comes next?`,
    ],
    [
      "Leo",
      `It improves what comes next by changing the evidence inside the representation. ${profile.implementation} The important test is whether the next step has a clearer, more useful, or more faithful object to work with.`,
    ],
    [
      "Maya",
      `Why is naming the mechanism not enough here?`,
    ],
    [
      "Leo",
      `Because a name can hide an empty explanation. The useful explanation has to say what information exists before the operation, what gets changed, and why the changed object is better evidence for the next step.`,
    ],
    [
      "Maya",
      `What is the common mistake here?`,
    ],
    [
      "Leo",
      `${profile.misconception} That mistake usually shows up when someone can repeat the label but cannot point to the object, the operation, and the changed value.`,
    ],
    [
      "Maya",
      `Can you go deeper on the cause-and-effect chain? I want to hear the before, the change, and the after.`,
    ],
    [
      "Leo",
      `Before: ${profile.coreObject} has a limited or less organized state. Change: ${coreMechanism} After: the result carries information in a form the next step can use. That is the point of the mechanism, not the title of the mechanism.`,
    ],
    [
      "Maya",
      `Give me the takeaway in one clean version.`,
    ],
    [
      "Leo",
      `${profile.closing} For ${topicTitle}, the useful proof of understanding is that you can explain the concrete object, the causal change, and the consequence without leaning on the title as a shortcut.`,
    ],
  ];
  return turns.map(([speaker, text]) => `${speaker}: ${audioFriendly(text)}`).join("\n\n");
}

function currentTranscript(row: ActivityRow, content: Record<string, unknown>): string {
  if (row.activity_type === "lesson_part") {
    const audio = content.audio && typeof content.audio === "object" ? content.audio as Record<string, unknown> : {};
    return String(audio.transcript || audio.script || "");
  }
  return String(content.transcript || content.script || "");
}

async function main() {
  const forceAudio = process.argv.includes("--generate-audio");
  const forceRewrite = process.argv.includes("--force-rewrite");
  const dryRun = process.argv.includes("--dry-run");
  const lessonIdArgIndex = process.argv.indexOf("--lesson-id");
  const selectedLessonId =
    lessonIdArgIndex >= 0 && process.argv[lessonIdArgIndex + 1]
      ? Number(process.argv[lessonIdArgIndex + 1])
      : null;
  if (selectedLessonId !== null && !Number.isInteger(selectedLessonId)) {
    throw new Error("--lesson-id must be an integer");
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT l.id AS lesson_id, l.title AS lesson_title, s.title AS subject_title,
              l.description, a.id AS activity_id, a.title AS activity_title,
              a.activity_type, a.content
         FROM lessons l
         JOIN subjects s ON s.id = l.subject_id
         JOIN lesson_activities a ON a.lesson_id = l.id
        WHERE l.status = 'in_progress'
          AND a.activity_type IN ('audio', 'lesson_part')
          ${selectedLessonId !== null ? "AND l.id = ?" : ""}
        ORDER BY l.id, a.sequence_order`
    )
    .all(...(selectedLessonId !== null ? [selectedLessonId] : [])) as ActivityRow[];

  const targets: Array<{ row: ActivityRow; profile: AudioProfile; content: Record<string, unknown>; script: string; reason: string[] }> = [];
  for (const row of rows) {
    let content: Record<string, unknown>;
    try {
      content = row.content ? JSON.parse(row.content) : {};
    } catch {
      continue;
    }
    const profile = profileFor(row);
    const existing = currentTranscript(row, content);
    const hard = validateLearnerFacingAudioTranscript(existing, {
      requireLongOverview: row.activity_type === "audio",
      minWords: row.activity_type === "lesson_part" ? 200 : undefined,
    });
    const badPattern = BAD_AUDIO_RE.test(existing);
    if (!forceRewrite && hard.ok && !badPattern) continue;
    targets.push({
      row,
      profile,
      content,
      script: row.activity_type === "audio"
        ? buildScript(row, profile)
        : buildLessonPartScript(row, profile, content),
      reason: badPattern
        ? ["matched generator-outline/generic-coaching pattern", ...hard.errors]
        : hard.errors,
    });
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        forceAudio,
        forceRewrite,
        selectedLessonId,
        targets: targets.map((t) => ({
          lesson_id: t.row.lesson_id,
          activity_id: t.row.activity_id,
          activity_type: t.row.activity_type,
          lesson_title: t.row.lesson_title,
          profile: t.profile.key,
          words: wordCount(t.script),
          reason: t.reason,
        })),
      },
      null,
      2
    )
  );

  if (dryRun) {
    closeDb();
    return;
  }

  const update = db.prepare("UPDATE lesson_activities SET content = ?, updated_at = datetime('now') WHERE id = ?");
  const tx = db.transaction(() => {
    for (const target of targets) {
      if (target.row.activity_type === "lesson_part") {
        const audio =
          target.content.audio && typeof target.content.audio === "object"
            ? target.content.audio as Record<string, unknown>
            : {};
        audio.script = target.script;
        audio.transcript = target.script;
        audio.duration_hint = Math.max(Number(audio.duration_hint ?? 0) || 0, 180);
        target.content.audio = audio;
      } else {
        target.content.script = target.script;
        target.content.transcript = target.script;
        target.content.duration_hint = Math.max(Number(target.content.duration_hint ?? 0) || 0, 900);
      }
      target.content.backfilled_conversational_audio_at = new Date().toISOString();
      target.content.backfilled_conversational_audio_note =
        "Removed generator-outline, generic learning-coach, or weak monologue transcript language. Replaced with learner-facing two-host concept explanation.";
      update.run(JSON.stringify(target.content), target.row.activity_id);
    }
  });
  tx();

  if (forceAudio) {
    const lessonIds = Array.from(new Set(targets.map((t) => t.row.lesson_id)));
    for (const lessonId of lessonIds) {
      const result = await generateLessonAudio(db, lessonId, { force: true });
      console.log(`audio lesson ${lessonId}: ${result.status} ${result.relPath ?? ""}`);
    }
  }

  closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
