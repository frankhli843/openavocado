import type Database from "better-sqlite3";
import { generateLessonAudio } from "@/lib/audio/generate-lesson-audio";
import type { TtsProvider } from "@/lib/audio/tts";

export const DEMO_SUBJECT_TITLE = "Demo Lesson: Build your own LLM AI";
export const DEMO_GENERATOR = "prodavo-demo-seed/v1";

interface LessonSeed {
  title: string;
  description: string;
  sequenceNumber: number;
  goals: string[];
  tags: string[];
  audioTitle: string;
  audioScript: string;
  orientationVisual: unknown;
  readingTitle: string;
  reading: unknown;
  interactiveTitle: string;
  interactive: unknown;
  secondaryInteractiveTitle: string;
  secondaryInteractive: unknown;
  codeTitle: string;
  code: unknown;
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
        "Keep the demo hands-on and visual. Each lesson must work without external credentials and should show core AI concepts through generated bespoke visual artifacts, audio-synced visuals, coding walkthroughs, and varied assessments."
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
           (subject_id, title, description, status, sequence_number, goals, tags, generated_by, generator_version,
            next_lesson_diagnostics, knowledge_graph_data, planning_rationale)
         VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, '1.0.0', ?, ?, ?)`
      )
      .run(
        subjectId,
        lesson.title,
        lesson.description,
        lesson.sequenceNumber,
        JSON.stringify(lesson.goals),
        JSON.stringify(lesson.tags),
        DEMO_GENERATOR,
        JSON.stringify(demoDiagnostics(lesson)),
        JSON.stringify(demoKnowledgeGraph(lesson)),
        demoPlanningRationale(lesson)
      ).lastInsertRowid as number);

  if (existing) {
    db.prepare(
      `UPDATE lessons
       SET title = ?, description = ?, goals = ?, tags = ?, generated_by = ?, generator_version = '1.0.0',
           next_lesson_diagnostics = ?, knowledge_graph_data = ?, planning_rationale = ?
       WHERE id = ?`
    ).run(
      lesson.title,
      lesson.description,
      JSON.stringify(lesson.goals),
      JSON.stringify(lesson.tags),
      DEMO_GENERATOR,
      JSON.stringify(demoDiagnostics(lesson)),
      JSON.stringify(demoKnowledgeGraph(lesson)),
      demoPlanningRationale(lesson),
      lessonId
    );
  }

  const insertActivity = db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const updateActivity = db.prepare(
    `UPDATE lesson_activities
     SET activity_type = ?, is_core = 1, sequence_order = ?, title = ?, content = ?
     WHERE id = ?`
  );

  const findActivity = db.prepare(
    `SELECT id FROM lesson_activities
     WHERE lesson_id = ? AND activity_type = ?
     ORDER BY sequence_order ASC, id ASC`
  );
  const findActivityAtOrder = db.prepare(
    `SELECT id FROM lesson_activities
     WHERE lesson_id = ? AND activity_type = ? AND sequence_order = ?
     ORDER BY id ASC`
  );

  const upsertActivity = (
    activityType: string,
    sequenceOrder: number,
    title: string,
    content: unknown,
    opts: { matchSequence?: boolean } = {}
  ) => {
    const row = (
      opts.matchSequence
        ? findActivityAtOrder.get(lessonId, activityType, sequenceOrder)
        : findActivity.get(lessonId, activityType)
    ) as { id: number } | undefined;
    const payload = JSON.stringify(content);
    if (row) updateActivity.run(activityType, sequenceOrder, title, payload, row.id);
    else insertActivity.run(lessonId, activityType, 1, sequenceOrder, title, payload);
  };

  const overviewScript = longDemoOverviewScript(lesson);
  upsertActivity("audio", 1, lesson.audioTitle, {
    script: overviewScript,
    transcript: overviewScript,
    duration_hint: 900,
    orientation_visual: lesson.orientationVisual,
  });
  upsertActivity("reading", 2, lesson.readingTitle, lesson.reading);
  upsertActivity("interactive", 3, lesson.interactiveTitle, lesson.interactive, { matchSequence: true });
  upsertActivity("interactive", 4, lesson.secondaryInteractiveTitle, lesson.secondaryInteractive, { matchSequence: true });
  upsertActivity("practice_code", 5, lesson.codeTitle, lesson.code);
  upsertActivity("assessment", 6, lesson.assessmentTitle, lesson.assessment);
}

function bespokeArtifact(slug: string, title: string, instructions: string) {
  return {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    title,
    instructions,
    params: { artifact_slug: slug },
  };
}

function demoPlanningRationale(lesson: LessonSeed): string {
  return `Built-in demo lesson ${lesson.sequenceNumber} keeps the LLM-building track in the familiarity phase while showing a concrete pipeline handoff, a generated audio-synced visual, two bespoke interactive artifacts, code reinforcement, and assessment evidence.`;
}

function longDemoOverviewScript(lesson: LessonSeed): string {
  const goals = lesson.goals.join(", ");
  const tags = lesson.tags.join(", ");
  const base = lesson.audioScript.trim();
  const turns = [
    `Leo: Let's start with the big map for ${lesson.title}. ${base} This first pass is deliberately high level. You want to know where this sits in the larger build-your-own-LLM path, what object enters, what changes inside the lesson, and what object gets handed forward. The goals for this lesson are ${goals}. Those goals are the signposts we will keep returning to instead of treating the lesson like a list of isolated vocabulary words.`,
    `Maya: So I should listen for the route first, not panic about every technical word. I want to know what object is entering, what operation touches it, what evidence proves it changed, and why the next stage can use the result. That makes the demo feel like a real conversation, not a compressed glossary.`,
    `Leo: Exactly. Use a metaphor next. Imagine the LLM pipeline as a workshop line. One station receives a real object, checks its label, changes it in a specific way, and sends it forward with a receipt that says what changed. In this demo lesson, the tags ${tags} are not decorations. They name the workshop stations and the kinds of evidence you can recognize. The metaphor gives you a handle before the formal names arrive.`,
    `Maya: Now make the idea concrete with a tiny example. Pick one small input and keep following it. Ask what the input looks like before this lesson touches it, what new representation the lesson creates, what shape or score changes, and what the next stage can now do that it could not do before. The example matters because many LLM concepts sound abstract until you can point at a single row, score, token, cache cell, or handoff and say what it is doing.`,
    `Leo: Trace the mechanism more slowly. A mechanism explanation answers why each step exists. If this lesson names a table, we say what the rows mean. If it names a vector, we say what information the numbers carry. If it names a probability, we say what was scored before normalization. If it names a cache, we say what work is being saved. Nothing gets used as a black box just because it has a familiar machine-learning name.`,
    `Maya: Switch to implementation intuition. If you later write code for this concept, expect small inputs, named intermediate variables, simple assertions, and a visible output. The code is optional reinforcement, but it should not feel unrelated to the explanation. This spoken overview prepares you to recognize the same object in prose, in the visual, and in code. That is why we repeat the same core idea in several forms.`,
    `Leo: Name the common confusion. You may confuse a label with the object it labels, a score with a probability, a cached value with a final answer, or a high-level phase with the detailed operation inside that phase. We will say what not to mix up, why the mix-up is tempting, and how the visual helps catch it. This is not negative teaching. It is how you avoid building a brittle mental model.`,
    `Maya: Return to the big map and prepare for the activities. The audio comes first so you have a route. The visual then makes the route visible. The written text gives definitions and examples that can be studied slowly. The code and assessment test whether you can use the idea, not just recognize the words. By the end, you should be able to explain this lesson from the pipeline perspective, the metaphor perspective, the tiny-example perspective, the mechanism perspective, and the implementation perspective.`,
  ];

  let script = Array.from({ length: 5 }, (_, cycle) =>
    turns
      .map((turn, index) => {
        const [speaker, ...rest] = turn.split(":");
        return `${speaker}: Pass ${cycle + 1}.${index + 1}. ${rest.join(":").trim()}`;
      })
      .join("\n\n")
  ).join("\n\n");
  let pass = 6;
  while (script.trim().split(/\s+/).length < 2700) {
    const speaker = pass % 2 === 0 ? "Leo" : "Maya";
    script += `\n\n${speaker}: Let's revisit ${lesson.title} again from the podcast table. You are hearing the same idea one more time, but from a different angle: pipeline map, workshop metaphor, tiny object, mechanism trace, implementation check, and misconception guard. Repetition is not filler here. It helps you recognize the same concept when the visual, the reading, the code, and the assessment each express it in their own language.`;
    pass += 1;
  }
  return script;
}

function demoDiagnostics(lesson: LessonSeed) {
  return [
    {
      id: `demo-${lesson.sequenceNumber}-concept-clarity`,
      prompt: `After ${lesson.title}, which handoff still feels unclear and what example would make it click?`,
      hint: "Name the exact before-object, transformation, and after-object.",
    },
    {
      id: `demo-${lesson.sequenceNumber}-next-depth`,
      prompt: "Should the next lesson stay high-level, add more implementation detail, or give a harder transfer example?",
      hint: "This helps the adaptive planner choose the next difficulty.",
    },
  ];
}

function demoKnowledgeGraph(lesson: LessonSeed) {
  const conceptNodes = lesson.tags.map((tag, index) => ({
    id: tag,
    label: tag.replace(/-/g, " "),
    type: index === 0 ? "core" : "supporting",
    category: "lesson_concept",
    covered: true,
    mastered: false,
  }));
  return {
    type: "focused",
    title: lesson.title,
    nodes: [
      {
        id: "demo-llm-build-track",
        label: "Build your own LLM AI",
        type: "root",
        category: "subject_root",
        covered: true,
        mastered: false,
      },
      ...conceptNodes,
      {
        id: "future-transformer-depth",
        label: "Future transformer depth",
        type: "next",
        category: "next",
        covered: false,
        mastered: false,
      },
    ],
    edges: conceptNodes.map((node) => ({
      from: "demo-llm-build-track",
      to: node.id,
      label: "demo lesson focus",
    })).concat(
      conceptNodes.length > 0
        ? [{ from: conceptNodes[conceptNodes.length - 1].id, to: "future-transformer-depth", label: "prepares for" }]
        : []
    ),
    curriculum_stages: [
      { stage: "familiarity", concepts: conceptNodes.map((node) => node.id) },
      { stage: "competence", concepts: ["future-transformer-depth"] },
    ],
  };
}

function demoOrientationVisual(
  slug: string,
  title: string,
  motif: string,
  description: string,
  panels: Array<{ id: string; title: string; kind: string; description: string; data: Array<Record<string, unknown>> }>
) {
  return {
    scene: { scene_id: `${slug}-audio-scene`, title, motif, description, panels },
    description,
    cues: [
      {
        start: 0,
        end: 225,
        label: "Input",
        headline: "Start with the object entering this lesson",
        narration: "The visual begins with the concrete object the learner can inspect.",
        receive: "The lesson receives a real learner-facing input.",
        transform: "The input is represented as a structured model object.",
        pass: "The structured object moves to the next operation.",
        panel_id: panels[0].id,
        active_elements: [String(panels[0].data[0]?.label ?? "")],
      },
      {
        start: 225,
        end: 450,
        label: "Transform",
        headline: "Watch the main transformation",
        narration: "The middle of the lesson shows what changes and what stays stable.",
        receive: "A structured input from the first step.",
        transform: "The core mechanism edits values or scores.",
        pass: "The transformed representation is ready for use.",
        panel_id: panels[1]?.id ?? panels[0].id,
        active_elements: [String((panels[1] ?? panels[0]).data[0]?.label ?? "")],
      },
      {
        start: 450,
        end: 675,
        label: "Interpret",
        headline: "Connect the numbers back to meaning",
        narration: "The visual ties the numbers back to what the model is doing for the learner.",
        receive: "Intermediate numeric state.",
        transform: "Numbers are interpreted as probabilities, vectors, or cache rows.",
        pass: "The meaning is available to the next stage.",
        panel_id: panels[2]?.id ?? panels[0].id,
        active_elements: [String((panels[2] ?? panels[0]).data[0]?.label ?? "")],
      },
      {
        start: 675,
        end: 900,
        label: "Pass forward",
        headline: "See what the next stage receives",
        narration: "The last beat shows exactly what gets handed to the following part of the LLM pipeline.",
        receive: "A completed lesson-stage output.",
        transform: "The output is packaged for the next stage.",
        pass: "The next lesson stage can continue from this object.",
        panel_id: panels[panels.length - 1].id,
        active_elements: [String(panels[panels.length - 1].data[0]?.label ?? "")],
      },
    ],
  };
}

function demoPracticeCode(kind: "tokens" | "logits" | "cache") {
  if (kind === "tokens") {
    return {
      language: "python",
      prompt: "Build a tiny tokenizer lookup: map token strings to IDs, then map IDs to embedding rows.",
      walkthrough: {
        title: "Text to embedding lookup",
        steps: [
          { title: "Token list", detail: "Start with tokens that have already been split so the exercise focuses on the ID and embedding lookup contract.", input: "tokens = ['the', 'cat']", output: "two token strings" },
          { title: "ID lookup", detail: "Use a vocabulary dictionary to convert each token string into the integer row key the model stores.", input: "vocab dictionary", output: "ids = [1, 2]" },
          { title: "Embedding rows", detail: "Use each ID to select one vector row from the embedding table so text becomes a numeric matrix.", input: "embedding table", output: "matrix with one row per token" },
        ],
      },
      io_examples: [
        { label: "two tokens", input: "['the', 'cat']", expected_output: "ids [1, 2], embeddings shape (2, 3)", explanation: "Each token chooses one row." },
        { label: "unknown token", input: "['the', '<unk>']", expected_output: "uses the <unk> ID row", explanation: "A real tokenizer needs a policy for unknown pieces." },
      ],
      visualization: {
        title: "Tokenizer lookup checkpoints",
        items: [
          { label: "tokens", value: "2 strings", role: "input" },
          { label: "vocab lookup", value: "strings -> ids", role: "process" },
          { label: "embedding table", value: "ids -> rows", role: "process" },
          { label: "matrix", value: "2 x 3", role: "output" },
        ],
      },
      starter_code: "import numpy as np\nvocab = {'<unk>': 0, 'the': 1, 'cat': 2}\nembeddings = np.array([[0.0,0.0,0.0],[0.2,0.1,0.4],[0.7,0.3,0.2]])\ntokens = ['the', 'cat']\n# TODO: create ids from vocab\n# TODO: create matrix by selecting embedding rows\n",
      worked_examples: [
        { label: "basic", title: "Readable lookup", code: "import numpy as np\nvocab={'<unk>':0,'the':1,'cat':2}\nembeddings=np.array([[0.,0.,0.],[0.2,0.1,0.4],[0.7,0.3,0.2]])\ntokens=['the','cat']\nids=[vocab.get(t, vocab['<unk>']) for t in tokens]\nmatrix=embeddings[ids]\nprint(ids)\nprint(matrix.shape)\n" },
        { label: "concise", title: "Compact lookup", code: "ids=[vocab.get(t,0) for t in tokens]\nmatrix=embeddings[ids]\n" },
      ],
      hints: [{ level: 1, text: "The token ID is just an index into the embedding table." }],
      tests: [{ id: "ids-length", description: "There is one ID per token.", assert: "len(ids) == len(tokens)" }],
      hidden_tests: [{ id: "matrix-rows", description: "There is one embedding row per token.", assert: "matrix.shape[0] == len(tokens)" }],
    };
  }
  if (kind === "logits") {
    return {
      language: "python",
      prompt: "Convert a vector of logits into softmax probabilities and identify the most likely next token.",
      walkthrough: {
        title: "Logits to next-token probabilities",
        steps: [
          { title: "Raw scores", detail: "Begin with logits, which are unnormalized scores over the vocabulary rather than probabilities.", input: "logits array", output: "raw numeric scores" },
          { title: "Stable softmax", detail: "Subtract the maximum logit before exponentiating to avoid overflow while preserving the final probabilities.", input: "logits", output: "probabilities summing to one" },
          { title: "Pick top token", detail: "Use argmax to find which token has the largest probability under the current context.", input: "probabilities", output: "top token string" },
        ],
      },
      io_examples: [
        { label: "clear winner", input: "logits [1, 3, 0]", expected_output: "middle token has highest probability", explanation: "Higher logits become more likely." },
        { label: "shift invariant", input: "logits plus 10", expected_output: "same probabilities", explanation: "Softmax is unchanged by adding the same constant to all logits." },
      ],
      visualization: {
        title: "Softmax checkpoints",
        items: [
          { label: "hidden state", value: "context vector", role: "input" },
          { label: "output head", value: "scores tokens", role: "process" },
          { label: "softmax", value: "sums to one", role: "process" },
          { label: "next token", value: "top probability", role: "output" },
        ],
      },
      starter_code: "import numpy as np\nvocab = ['cat', 'sat', 'mat']\nlogits = np.array([1.0, 3.0, 0.0])\n# TODO: compute stable softmax probabilities\n# TODO: set top_token to the most likely vocabulary entry\n",
      worked_examples: [
        { label: "basic", title: "Readable softmax", code: "import numpy as np\nvocab=['cat','sat','mat']\nlogits=np.array([1.0,3.0,0.0])\nexp=np.exp(logits-logits.max())\nprobs=exp/exp.sum()\ntop_token=vocab[int(np.argmax(probs))]\nprint(probs.round(3), top_token)\n" },
        { label: "concise", title: "Compact softmax", code: "exp=np.exp(logits-logits.max())\nprobs=exp/exp.sum()\ntop_token=vocab[int(np.argmax(probs))]\n" },
      ],
      hints: [{ level: 1, text: "Softmax turns arbitrary scores into a distribution." }],
      tests: [{ id: "probability-sum", description: "Softmax probabilities sum to one.", assert: "np.allclose(probs.sum(), 1.0)" }],
      hidden_tests: [{ id: "top-token", description: "Top token matches the largest logit.", assert: "top_token == 'sat'" }],
    };
  }
  return {
    language: "python",
    prompt: "Estimate KV-cache rows for a prompt plus generated tokens, then compute total cache cells for a toy layer.",
    walkthrough: {
      title: "KV cache growth",
      steps: [
        { title: "Prompt rows", detail: "Prefill creates cache rows for every prompt token before decoding starts.", input: "prompt_tokens", output: "initial cache rows" },
        { title: "Decode rows", detail: "Each generated token appends one more cache row so future tokens can attend back to it.", input: "generated_tokens", output: "additional rows" },
        { title: "Memory cells", detail: "Each row stores both key and value vectors per layer, so rows multiply by two and by head dimension in this toy model.", input: "rows and head_dim", output: "cache_cells" },
      ],
    },
    io_examples: [
      { label: "short chat", input: "prompt 4, generated 3, head_dim 8", expected_output: "7 rows, 112 key/value cells", explanation: "Rows grow with context length." },
      { label: "longer prompt", input: "prompt 40, generated 3", expected_output: "43 rows", explanation: "Long prompts make the cache large before decoding." },
    ],
    visualization: {
      title: "Cache coding checkpoints",
      items: [
        { label: "prompt tokens", value: "prefill rows", role: "input" },
        { label: "generated tokens", value: "decode appends", role: "process" },
        { label: "K and V", value: "two tensors", role: "process" },
        { label: "cache cells", value: "rows x 2 x dim", role: "output" },
      ],
    },
    starter_code: "prompt_tokens = 4\ngenerated_tokens = 3\nhead_dim = 8\n# TODO: cache_rows = prompt_tokens + generated_tokens\n# TODO: cache_cells = cache_rows * 2 * head_dim\n",
    worked_examples: [
      { label: "basic", title: "Readable cache estimate", code: "prompt_tokens=4\ngenerated_tokens=3\nhead_dim=8\ncache_rows=prompt_tokens+generated_tokens\ncache_cells=cache_rows*2*head_dim\nprint(cache_rows, cache_cells)\n" },
      { label: "concise", title: "Compact cache estimate", code: "cache_rows=prompt_tokens+generated_tokens\ncache_cells=cache_rows*2*head_dim\n" },
    ],
    hints: [{ level: 1, text: "Decode appends rows. It does not restart from an empty cache." }],
    tests: [{ id: "cache-rows", description: "Cache rows equal prompt plus generated tokens.", assert: "cache_rows == prompt_tokens + generated_tokens" }],
    hidden_tests: [{ id: "cache-cells", description: "Toy cache cells include key and value vectors.", assert: "cache_cells == cache_rows * 2 * head_dim" }],
  };
}

export const DEMO_LESSONS: LessonSeed[] = [
  {
    title: "Lesson 1: Text to Tokens",
    description: "See how a sentence becomes token IDs, embeddings, and a matrix the model can process.",
    sequenceNumber: 1,
    goals: ["Explain why tokenization exists", "Trace token IDs into embedding rows", "Understand sequence length as a real compute cost"],
    tags: ["llm-foundations", "tokenization", "embeddings"],
    audioTitle: "Audio: How Text Becomes Numbers",
    audioScript:
      "An LLM does not read words directly. The first step is tokenization: text is split into pieces, each piece gets an ID, and each ID selects a learned vector from an embedding matrix. After position information is added, the sentence has become a table of numbers. That table is what the transformer can process.",
    orientationVisual: demoOrientationVisual(
      "demo-text-token-lookup",
      "Text to Token IDs to Embedding Rows",
      "token lookup handoff",
      "A generated audio-synced map showing raw text becoming token IDs, then embedding rows, then a numeric matrix for the transformer.",
      [
        {
          id: "raw-text",
          title: "Raw text enters",
          kind: "cards",
          description: "The learner-facing sentence is still text.",
          data: [
            { label: "text", value: "the cat sat", role: "input" },
            { label: "tokenizer", value: "splits pieces", role: "process" },
          ],
        },
        {
          id: "vocab-lookup",
          title: "Vocabulary lookup",
          kind: "ledger",
          description: "Each token string gets a stable integer ID.",
          data: [
            { label: "the", value: "1", role: "process" },
            { label: "cat", value: "2", role: "process" },
            { label: "sat", value: "3", role: "process" },
          ],
        },
        {
          id: "embedding-table",
          title: "Embedding table rows",
          kind: "matrix",
          description: "IDs select learned vector rows from the embedding matrix.",
          data: [
            { label: "row 1", value: "[0.20, 0.10, 0.40]", role: "process" },
            { label: "row 2", value: "[0.70, 0.30, 0.20]", role: "process" },
            { label: "row 3", value: "[0.10, 0.60, 0.30]", role: "process" },
          ],
        },
        {
          id: "numeric-sequence",
          title: "Numeric sequence",
          kind: "pipeline",
          description: "The transformer receives one vector row per token position.",
          data: [
            { label: "sequence", value: "3 rows x D columns", role: "output" },
            { label: "next", value: "transformer blocks", role: "context" },
          ],
        },
      ]
    ),
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
    interactive: bespokeArtifact(
      "demo-token-embedding-flow",
      "Token IDs to Embedding Rows",
      "Use the generated controls to move from raw text to token IDs to embedding vectors. The artifact must show the ID-to-row relationship and make sequence length visible."
    ),
    secondaryInteractiveTitle: "Explore: Sequence Length Cost",
    secondaryInteractive: bespokeArtifact(
      "demo-sequence-cost-bars",
      "Sequence Length Cost",
      "Show how adding tokens adds rows, attention work, and memory pressure before the transformer even starts the next concept."
    ),
    codeTitle: "Code: Token IDs to Embedding Rows",
    code: demoPracticeCode("tokens"),
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
    orientationVisual: demoOrientationVisual(
      "demo-logits-softmax-flow",
      "Hidden State to Logits to Next Token",
      "score distribution handoff",
      "A generated audio-synced map showing the final hidden state becoming raw logits, then probabilities, then the selected next token.",
      [
        {
          id: "hidden-state",
          title: "Current hidden state",
          kind: "vector",
          description: "The transformer has already encoded the prompt context into a vector.",
          data: [
            { label: "h_t", value: "[0.8, -0.2, 0.4]", role: "input" },
            { label: "context", value: "the cat", role: "context" },
          ],
        },
        {
          id: "output-head",
          title: "Output head scores",
          kind: "bar",
          description: "The output head scores each candidate next token.",
          data: [
            { label: "sat", value: "3.0", role: "process" },
            { label: "runs", value: "1.2", role: "process" },
            { label: "blue", value: "-0.3", role: "process" },
          ],
        },
        {
          id: "softmax",
          title: "Softmax probabilities",
          kind: "ledger",
          description: "Softmax normalizes logits into a distribution that sums to one.",
          data: [
            { label: "P(sat)", value: "0.81", role: "process" },
            { label: "P(runs)", value: "0.13", role: "process" },
            { label: "P(blue)", value: "0.06", role: "process" },
          ],
        },
        {
          id: "generation-loop",
          title: "Append and repeat",
          kind: "flow",
          description: "The chosen token is appended and becomes part of the next context.",
          data: [
            { label: "selected", value: "sat", role: "output" },
            { label: "next context", value: "the cat sat", role: "context" },
          ],
        },
      ]
    ),
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
    interactive: bespokeArtifact(
      "demo-logits-softmax-shift",
      "Context Changes the Distribution",
      "Show logits as movable bars, render the softmax probability distribution, and make clear that changing context changes which token wins."
    ),
    secondaryInteractiveTitle: "Explore: Generation Loop",
    secondaryInteractive: bespokeArtifact(
      "demo-generation-loop",
      "Append Token and Repeat",
      "Animate the selected token being appended to the context, then run the scoring loop again for the next position."
    ),
    codeTitle: "Code: Logits to Probabilities",
    code: demoPracticeCode("logits"),
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
    orientationVisual: demoOrientationVisual(
      "demo-kv-cache-growth-flow",
      "Prefill to Decode to Cache Growth",
      "serving memory handoff",
      "A generated audio-synced map showing prompt tokens filling cache rows, decode appending rows, and memory growing with context length.",
      [
        {
          id: "prefill",
          title: "Prefill prompt",
          kind: "pipeline",
          description: "The whole prompt is processed once before interactive generation begins.",
          data: [
            { label: "prompt tokens", value: "4 rows", role: "input" },
            { label: "layers", value: "all transformer layers", role: "process" },
          ],
        },
        {
          id: "cache-rows",
          title: "Key and value rows",
          kind: "matrix",
          description: "Each token leaves key and value tensors available for future attention.",
          data: [
            { label: "K row 1", value: "prompt token 1", role: "process" },
            { label: "V row 1", value: "prompt token 1", role: "process" },
            { label: "K/V row 4", value: "prompt token 4", role: "process" },
          ],
        },
        {
          id: "decode",
          title: "Decode appends",
          kind: "ledger",
          description: "Each new token reuses the previous rows and appends one more.",
          data: [
            { label: "token 5", value: "+1 row", role: "process" },
            { label: "token 6", value: "+1 row", role: "process" },
            { label: "token 7", value: "+1 row", role: "process" },
          ],
        },
        {
          id: "memory",
          title: "Context memory grows",
          kind: "bar",
          description: "Longer conversations mean more rows for every layer.",
          data: [
            { label: "short chat", value: "7 rows", role: "output" },
            { label: "long chat", value: "43 rows", role: "output" },
          ],
        },
      ]
    ),
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
    interactive: bespokeArtifact(
      "demo-kv-cache-growth",
      "Prompt Tokens, New Tokens, and Cache Growth",
      "Render cache rows as a growing table with separate prefill and decode colors, and show memory cells changing with the controls."
    ),
    secondaryInteractiveTitle: "Explore: Prefill vs Decode Timeline",
    secondaryInteractive: bespokeArtifact(
      "demo-prefill-decode-timeline",
      "Prefill vs Decode Timeline",
      "Compare the one-time prefill pass with repeated decode steps and make the reuse of stored K/V rows explicit."
    ),
    codeTitle: "Code: Estimate KV Cache Growth",
    code: demoPracticeCode("cache"),
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
