import type Database from "better-sqlite3";
import { generateLessonAudio } from "@/lib/audio/generate-lesson-audio";
import type { TtsProvider } from "@/lib/audio/tts";

const DEMO_SUBJECT_TITLE = "Demo Lesson: Build your own LLM AI";
const DEMO_GENERATOR = "prodavo-demo-seed/v1";

interface LessonSeed {
  title: string;
  description: string;
  sequenceNumber: number;
  goals: string[];
  tags: string[];
  audioTitle: string;
  audioScript: string;
  readingTitle: string;
  reading: unknown;
  interactiveTitle: string;
  interactive: unknown;
  assessmentTitle: string;
  assessment: unknown;
}

export function ensureDemoLessonsForLearner(db: Database.Database, learnerId: number): number {
  const existing = db
    .prepare("SELECT id FROM subjects WHERE learner_id = ? AND title = ?")
    .get(learnerId, DEMO_SUBJECT_TITLE) as { id: number } | undefined;

  const subjectId =
    existing?.id ??
    (db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level)
         VALUES (?, ?, ?, ?, ?, 'familiarity')`
      )
      .run(
        learnerId,
        DEMO_SUBJECT_TITLE,
        "A built-in three-lesson demo track that shows how AvocadoCore teaches AI model building with audio, reading, interactive widgets, and assessment.",
        "Understand the core path from text to tokens, transformer predictions, and efficient LLM serving.",
        "Keep the demo hands-on and visual. Each lesson must work without external credentials and should show one core AI concept through a registered interactive widget."
      ).lastInsertRowid as number);

  const tx = db.transaction(() => {
    for (const lesson of DEMO_LESSONS) ensureLesson(db, subjectId, lesson);
  });
  tx();

  return subjectId;
}

export async function ensureDemoLessonAudioForLearner(
  db: Database.Database,
  learnerId: number,
  opts: { provider?: TtsProvider } = {}
): Promise<void> {
  const subject = db
    .prepare("SELECT id FROM subjects WHERE learner_id = ? AND title = ?")
    .get(learnerId, DEMO_SUBJECT_TITLE) as { id: number } | undefined;
  if (!subject) return;

  const lessons = db
    .prepare(
      `SELECT id, title FROM lessons
       WHERE subject_id = ? AND generated_by = ?
       ORDER BY sequence_number ASC`
    )
    .all(subject.id, DEMO_GENERATOR) as Array<{ id: number; title: string }>;

  for (const lesson of lessons) {
    const result = await generateLessonAudio(db, lesson.id, opts);
    if (result.status === "no-audio-activity" || result.status === "empty-script") {
      throw new Error(`Demo lesson audio could not be generated for lesson ${lesson.id}: ${result.status}`);
    }
  }
}

function ensureLesson(db: Database.Database, subjectId: number, lesson: LessonSeed): void {
  const existing = db
    .prepare("SELECT id FROM lessons WHERE subject_id = ? AND sequence_number = ?")
    .get(subjectId, lesson.sequenceNumber) as { id: number } | undefined;

  const lessonId =
    existing?.id ??
    (db
      .prepare(
        `INSERT INTO lessons
           (subject_id, title, description, status, sequence_number, goals, tags, generated_by, generator_version)
         VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, '1.0.0')`
      )
      .run(
        subjectId,
        lesson.title,
        lesson.description,
        lesson.sequenceNumber,
        JSON.stringify(lesson.goals),
        JSON.stringify(lesson.tags),
        DEMO_GENERATOR
      ).lastInsertRowid as number);

  if (existing) {
    db.prepare(
      `UPDATE lessons
       SET title = ?, description = ?, goals = ?, tags = ?, generated_by = ?, generator_version = '1.0.0'
       WHERE id = ?`
    ).run(
      lesson.title,
      lesson.description,
      JSON.stringify(lesson.goals),
      JSON.stringify(lesson.tags),
      DEMO_GENERATOR,
      lessonId
    );
  }

  const activityCount = db
    .prepare("SELECT COUNT(*) AS count FROM lesson_activities WHERE lesson_id = ?")
    .get(lessonId) as { count: number };
  if (activityCount.count > 0) return;

  const insertActivity = db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertActivity.run(
    lessonId,
    "audio",
    1,
    1,
    lesson.audioTitle,
    JSON.stringify({ script: lesson.audioScript, duration_hint: 420 })
  );
  insertActivity.run(lessonId, "reading", 1, 2, lesson.readingTitle, JSON.stringify(lesson.reading));
  insertActivity.run(lessonId, "interactive", 1, 3, lesson.interactiveTitle, JSON.stringify(lesson.interactive));
  insertActivity.run(lessonId, "assessment", 1, 4, lesson.assessmentTitle, JSON.stringify(lesson.assessment));
}

const DEMO_LESSONS: LessonSeed[] = [
  {
    title: "Lesson 1: Text to Tokens",
    description: "See how a sentence becomes token IDs, embeddings, and a matrix the model can process.",
    sequenceNumber: 1,
    goals: ["Explain why tokenization exists", "Trace token IDs into embedding rows", "Understand sequence length as a real compute cost"],
    tags: ["llm-foundations", "tokenization", "embeddings"],
    audioTitle: "Audio: How Text Becomes Numbers",
    audioScript:
      "An LLM does not read words directly. The first step is tokenization: text is split into pieces, each piece gets an ID, and each ID selects a learned vector from an embedding matrix. After position information is added, the sentence has become a table of numbers. That table is what the transformer can process.",
    readingTitle: "Read: The Input Contract",
    reading: {
      intro: "Before a model predicts anything, text must become a numeric input with a stable shape.",
      blocks: [
        { type: "heading", text: "Tokens are the model's alphabet" },
        { type: "paragraph", text: "A token can be a word, part of a word, punctuation, or whitespace pattern. The tokenizer maps each token to an integer ID." },
        { type: "definition", term: "Embedding", definition: "A learned vector looked up by token ID. It turns a discrete token into continuous numbers the model can transform." },
        { type: "callout", tone: "insight", text: "Longer prompts create longer matrices, more attention work, and more cache memory." },
      ],
      summary: "Tokenization and embeddings turn text into a numeric sequence. Sequence length becomes a core cost driver.",
    },
    interactiveTitle: "Explore: Embedding Lookup",
    interactive: {
      schema_version: "1.0",
      widget_type: "embedding-matrix-lookup",
      title: "Token IDs to Embedding Rows",
      instructions: "Change the token IDs and watch each ID select a row from the embedding table.",
      params: {},
    },
    assessmentTitle: "Check: Tokenization",
    assessment: {
      questions: [
        { id: "q1", text: "Why does an LLM need token IDs instead of raw text?", type: "free_text" },
        { id: "q2", text: "What does an embedding row represent?", type: "free_text" },
      ],
      quiz: {
        pass_threshold: 1,
        questions: [
          {
            id: "mc1",
            difficulty: "easy",
            concept: "tokenization",
            question: "What happens immediately after text is tokenized?",
            choices: ["Token IDs look up embedding vectors", "The model sends an email", "The GPU stores the final answer"],
            correct_index: 0,
            explanation: "Token IDs are used to look up learned vectors before transformer layers process the sequence.",
          },
        ],
      },
    },
  },
  {
    title: "Lesson 2: Predicting the Next Token",
    description: "Walk through hidden states, logits, softmax, and why context changes the next-token distribution.",
    sequenceNumber: 2,
    goals: ["Connect hidden states to logits", "Interpret softmax probabilities", "Explain why context changes predictions"],
    tags: ["transformers", "logits", "softmax"],
    audioTitle: "Audio: From Context to Prediction",
    audioScript:
      "A transformer repeatedly mixes information across the prompt. At the end, the output head turns the final hidden state into logits: one score per possible next token. Softmax converts those scores into probabilities. Generation samples or chooses from that distribution, appends the token, then repeats.",
    readingTitle: "Read: Scores Become Words",
    reading: {
      intro: "Next-token prediction is a scoring problem over the vocabulary.",
      blocks: [
        { type: "heading", text: "Hidden state to logits" },
        { type: "paragraph", text: "The final vector at the current position is multiplied by an output matrix. The result is a list of scores, one for every token the model knows." },
        { type: "definition", term: "Logit", definition: "A raw model score before probability normalization. Higher logits become more likely after softmax." },
        { type: "callout", tone: "warning", text: "A token can look likely only because the context made it likely. Hide the context and the distribution can change completely." },
      ],
      summary: "The model scores every possible next token, normalizes the scores, chooses one token, then repeats the loop.",
    },
    interactiveTitle: "Explore: Transformer Logits Lab",
    interactive: {
      schema_version: "1.0",
      widget_type: "transformer-logits-lab",
      title: "Context Changes the Distribution",
      instructions: "Adjust context strength and compare which token becomes most likely.",
      params: {},
    },
    assessmentTitle: "Check: Next-token Prediction",
    assessment: {
      questions: [
        { id: "q1", text: "What is a logit?", type: "free_text" },
        { id: "q2", text: "Why does changing context change the next token?", type: "free_text" },
      ],
      quiz: {
        pass_threshold: 1,
        questions: [
          {
            id: "mc1",
            difficulty: "medium",
            concept: "softmax",
            question: "What does softmax do to logits?",
            choices: ["Converts raw scores into probabilities", "Deletes the prompt", "Compresses the model weights"],
            correct_index: 0,
            explanation: "Softmax normalizes raw logits into a probability distribution over tokens.",
          },
        ],
      },
    },
  },
  {
    title: "Lesson 3: Serving with a KV Cache",
    description: "Understand prefill, decode, cache growth, and why long context affects latency and memory.",
    sequenceNumber: 3,
    goals: ["Explain prefill and decode", "Describe what the KV cache stores", "Predict why context length affects serving cost"],
    tags: ["inference", "kv-cache", "serving"],
    audioTitle: "Audio: The Generation Loop",
    audioScript:
      "Serving an LLM has two phases. Prefill reads the prompt and builds a key-value cache for every layer. Decode then generates one new token at a time. Each new token reuses the cache instead of recomputing the whole prompt, but the cache still grows with context length. That is why long chats cost memory.",
    readingTitle: "Read: Prefill, Decode, Repeat",
    reading: {
      intro: "Fast inference depends on remembering attention state from previous tokens.",
      blocks: [
        { type: "heading", text: "Prefill builds the cache" },
        { type: "paragraph", text: "During prefill, the model processes the entire prompt. It stores key and value tensors for each layer so later tokens can attend back to the prompt." },
        { type: "heading", text: "Decode reuses the cache" },
        { type: "paragraph", text: "During decode, the model adds one token, updates the cache, and predicts the next token. This repeats until generation stops." },
        { type: "callout", tone: "insight", text: "The KV cache is why generation can be interactive, and also why long contexts consume a lot of memory." },
      ],
      summary: "Prefill processes the prompt once. Decode appends tokens one at a time while reusing and extending the KV cache.",
    },
    interactiveTitle: "Explore: KV Cache Generation",
    interactive: {
      schema_version: "1.0",
      widget_type: "kv-cache-generation",
      title: "Prompt Tokens, New Tokens, and Cache Growth",
      instructions: "Change prompt length and generated-token count to see why cache memory grows.",
      params: {},
    },
    assessmentTitle: "Check: Inference Serving",
    assessment: {
      questions: [
        { id: "q1", text: "What is the difference between prefill and decode?", type: "free_text" },
        { id: "q2", text: "Why does a longer context use more memory?", type: "free_text" },
      ],
      quiz: {
        pass_threshold: 1,
        questions: [
          {
            id: "mc1",
            difficulty: "medium",
            concept: "kv-cache",
            question: "What does the KV cache help avoid?",
            choices: ["Recomputing all prompt attention state for every new token", "Training the tokenizer", "Downloading a new model"],
            correct_index: 0,
            explanation: "The cache stores attention key and value tensors so decode can reuse prompt context efficiently.",
          },
        ],
      },
    },
  },
];
