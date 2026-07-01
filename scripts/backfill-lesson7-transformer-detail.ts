#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath =
  process.env.AVOCADOCORE_DB_PATH ||
  path.join(process.cwd(), "data", "avocadocore.db");

const db = new Database(dbPath);

type LessonPartContent = {
  part_id: string;
  reading: {
    intro: string;
    blocks: Array<Record<string, unknown>>;
    summary: string;
    diagrams?: Array<Record<string, unknown>>;
  };
  audio: { script: string; duration_hint: number };
  interactive: Record<string, unknown>;
  quiz: Record<string, unknown>;
};

function backupDb() {
  if (!fs.existsSync(dbPath)) throw new Error(`DB not found: ${dbPath}`);
  const parsed = path.parse(dbPath);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
  const backup = path.join(parsed.dir, `${parsed.name}.before-lesson7-transformer-detail-${stamp}${parsed.ext}`);
  fs.copyFileSync(dbPath, backup);
  return backup;
}

function getPart(activityId: number): LessonPartContent {
  const row = db
    .prepare("SELECT content FROM lesson_activities WHERE id = ? AND lesson_id = 7 AND activity_type = 'lesson_part'")
    .get(activityId) as { content: string } | undefined;
  if (!row) throw new Error(`Lesson 7 activity ${activityId} was not found`);
  return JSON.parse(row.content) as LessonPartContent;
}

function updatePart(activityId: number, title: string, part: LessonPartContent) {
  db.prepare(
    `UPDATE lesson_activities
     SET title = ?, content = ?
     WHERE id = ? AND lesson_id = 7 AND activity_type = 'lesson_part'`
  ).run(title, JSON.stringify(part), activityId);

  // The script changed, so existing audio artifacts for this activity must be
  // regenerated. The audio generator will recreate rows/files from the script.
  db.prepare(
    "DELETE FROM generated_artifacts WHERE lesson_id = 7 AND activity_id = ? AND artifact_type = 'audio'"
  ).run(activityId);
}

function withQuizSupport(part: LessonPartContent, label: string): Record<string, unknown> {
  const quiz = part.quiz as { questions?: Array<Record<string, unknown>> };
  return {
    ...part.quiz,
    questions: (quiz.questions ?? []).map((q) => ({
      ...q,
      support_ref: label,
      grounding_required: true,
    })),
  };
}

const part40 = getPart(40);
const part41 = getPart(41);

const updated40: LessonPartContent = {
  ...part40,
  reading: {
    intro:
      "This section slows down the first model-owned step after tokenization. Token IDs are not little packets of meaning. They are row addresses. The model uses each address to copy one learned vector row, adds a position vector, and stacks those rows into the initial hidden-state matrix that transformer blocks will edit next.",
    blocks: [
      {
        type: "heading",
        text: "Pipeline handoff: tokenizer output becomes transformer input",
      },
      {
        type: "paragraph",
        text:
          "The tokenizer and the transformer are adjacent stages, not the same object. The tokenizer is a preprocessing contract: it converts text into stable token IDs. The transformer is the neural network stack that consumes those IDs after embedding lookup turns them into hidden-state rows. So the relationship is: tokenizer chooses addresses, embedding lookup creates the first hidden-state matrix, transformer blocks edit that matrix, and the output head later scores next-token logits.",
      },
      { type: "heading", text: "The object entering the model is a list of IDs" },
      {
        type: "paragraph",
        text:
          "After tokenization, the prompt is a sequence like [12, 44, 91, 44]. Each number is stable only because the tokenizer vocabulary and the model were trained as a matched pair. The number 44 is not the word itself. It is an address that says: go to row 44 in the model's embedding table.",
      },
      {
        type: "definition",
        term: "Embedding matrix",
        definition:
          "A learned table inside the model. Rows correspond to tokenizer IDs. Columns are hidden dimensions, the numeric features that training can adjust. If the vocabulary has V entries and the hidden width is D, the embedding matrix has shape V by D.",
      },
      {
        type: "example",
        title: "A tiny visible matrix",
        body:
          "Imagine hidden width D = 3. Row 12 might be [0.20, -0.10, 0.70]. Row 44 might be [0.85, 0.05, -0.30]. Row 91 might be [-0.40, 0.60, 0.10]. If the tokenizer emits [12, 44, 91, 44], lookup returns four rows. The two 44 positions start from the same learned row because they are the same token ID.",
      },
      {
        type: "heading",
        text: "Position vectors make repeated tokens separable",
      },
      {
        type: "paragraph",
        text:
          "If the model stopped after embedding lookup, the two copies of ID 44 would be identical. That would erase order. So the model adds a position vector with the same D columns to each row. Position 1 gets one vector, position 4 gets another vector. The two copies of ID 44 now have different starting hidden states even though they came from the same embedding row.",
      },
      {
        type: "definition",
        term: "Hidden-state matrix",
        definition:
          "The table of token-position rows that moves through the model. At the start, each row is embedding row plus position vector. If the prompt has L token positions and hidden width D, the matrix shape is L by D.",
      },
      {
        type: "example",
        title: "One row, then one matrix",
        body:
          "For position 2 with token ID 44, start with embedding [0.85, 0.05, -0.30]. Add a position vector such as [0.01, 0.30, 0.02]. The starting hidden state becomes [0.86, 0.35, -0.28]. Do that for every token position and stack the rows. That stacked table is what the next transformer block receives.",
      },
      {
        type: "callout",
        tone: "insight",
        text:
          "This is the first key bridge: tokenizer IDs choose rows, training shaped those rows, position vectors preserve order, and the result is a same-width matrix. Nothing has mixed context yet.",
      },
      {
        type: "heading",
        text: "Why this prepares the transformer block",
      },
      {
        type: "paragraph",
        text:
          "A transformer block does not receive raw text or isolated token IDs. It receives this hidden-state matrix. Every later operation in the block can be understood as editing rows in that matrix while preserving the L by D shape, so the next block can receive the same kind of object.",
      },
    ],
    diagrams: [
      {
        kind: "mermaid",
        title: "Current stage: tokenizer IDs become transformer-ready hidden states",
        mermaid:
          "flowchart LR\n  A[\"Before<br/>Raw text\"] --> B[\"Tokenizer<br/>text -> token IDs\"]\n  B --> C[\"This section<br/>embedding lookup + position\"]\n  C --> D[\"Passed forward<br/>initial hidden-state matrix H0<br/>L rows x D columns\"]\n  D --> E[\"Next<br/>transformer blocks edit H0\"]\n  E --> F[\"Later<br/>output head -> logits\"]\n  F --> G[\"Then<br/>training loss or inference sampling\"]\n  B -. relationship .-> E\n  B -. \"tokenizer does not transform hidden states\" .-> C\n  E -. \"transformer consumes hidden states, not raw text\" .-> D",
        takeaway:
          "The tokenizer is before the transformer. It emits token IDs. Embedding lookup converts those IDs into the hidden-state matrix that the transformer actually consumes.",
        caption:
          "Use this map as the local handoff view: before, current section, what gets passed forward, and what comes next.",
        support_ref:
          "Lesson 7 Part 2: pipeline handoff from tokenizer IDs to transformer-ready hidden states.",
      },
      {
        kind: "mermaid",
        title: "From token IDs to the initial hidden-state matrix",
        mermaid:
          "flowchart LR\n  IDS[\"Token IDs<br/>[12, 44, 91, 44]\"] --> LOOKUP[\"Embedding lookup<br/>select rows E[12], E[44], E[91], E[44]\"]\n  LOOKUP --> EMB[\"Embedding rows<br/>L x D table\"]\n  POS[\"Position rows<br/>same L x D shape\"] --> ADD[\"Add row by row\"]\n  EMB --> ADD\n  ADD --> H0[\"Initial hidden-state matrix H0<br/>L token rows x D hidden columns\"]\n  H0 --> BLOCK[\"Next: transformer block edits H0\"]",
        takeaway:
          "The tokenizer supplies addresses. The embedding table supplies learned rows. Position rows make order visible. The sum is the hidden-state matrix.",
        caption:
          "This diagram belongs beside the embedding explanation because it names the exact objects in the text: IDs, embedding rows, position rows, and hidden-state matrix.",
        support_ref:
          "Lesson 7 Part 2: token IDs become hidden states.",
      },
    ],
    summary:
      "Token IDs are row addresses into a learned embedding matrix. The selected rows plus position vectors form the initial L by D hidden-state matrix, which is the concrete object transformer blocks edit next.",
  },
  audio: {
    script:
      "Let's slow this down and make the pipeline relationship visible. The tokenizer is not the transformer. The tokenizer is the stage before the transformer. Its job is to convert raw text into stable token IDs, like twelve, forty-four, ninety-one, forty-four. Those numbers are useful only because the tokenizer vocabulary and the model's learned tables agree on what each ID points to. The transformer stack does not consume raw text. It consumes hidden-state rows. So there is one bridge between tokenizer and transformer: embedding lookup plus position information. Token ID forty-four says: go to row forty-four in the embedding matrix. The embedding matrix is a learned table inside the model. If the vocabulary has V rows and the hidden width is D columns, the matrix shape is V by D. Each row is a vector, a list of D numbers that training has shaped over time. In a real model D might be thousands. For learning, use D equals three. Row twelve might be zero point two, negative zero point one, zero point seven. Row forty-four might be zero point eight five, zero point zero five, negative zero point three. If the tokenizer emits twelve, forty-four, ninety-one, forty-four, lookup copies those four rows into a new table with four token positions. Notice what has not happened yet. The transformer block has not run. Attention has not mixed context. The model has only selected the starting row for each token ID. Now order matters. If token ID forty-four appears twice, both copies start from the same embedding row. Without position information, the two occurrences would be indistinguishable. So the model adds a position vector to each row. Position one gets one vector. Position four gets another. The two copies of ID forty-four now become different hidden-state rows because they sit in different positions. This gives us the starting hidden-state matrix. If there are L token positions and D hidden dimensions, the shape is L by D. That matrix is what gets passed into the transformer. The relationship is: tokenizer emits IDs, embedding lookup turns IDs into hidden states, transformer blocks edit hidden states, output head turns final hidden states into logits, training compares logits to true next tokens, and inference later samples from logits while optimizing attention with KV cache. Keep that handoff in your head: the tokenizer supplies addresses; the transformer consumes the table created from those addresses.",
    duration_hint: 360,
  },
  quiz: withQuizSupport(part40, "Lesson 7 Part 2: token IDs become hidden states"),
};

const updated41: LessonPartContent = {
  ...part41,
  reading: {
    intro:
      "Now the lesson can define a transformer block instead of assuming the term. A transformer block is a repeated same-shape editing layer: it receives the L by D hidden-state matrix, lets token rows read from one another through attention, updates each token row through an MLP, wraps the updates with residual addition and normalization, and returns another L by D matrix.",
    blocks: [
      {
        type: "heading",
        text: "What a transformer block is",
      },
      {
        type: "definition",
        term: "Transformer block",
        definition:
          "One repeated layer in a transformer model that edits the hidden-state matrix. It takes one vector row per token position, applies attention, an MLP, residual connections, and normalization, then returns the same L by D shape with more context-aware values.",
      },
      {
        type: "paragraph",
        text:
          "Think of the block as a careful editor, not a new file format. The input is H, an L by D hidden-state matrix. The output is also L by D. The row for token position 3 is still row 3, but its numbers now carry more information from the surrounding context.",
      },
      {
        type: "heading",
        text: "Step 1: attention writes a context update",
      },
      {
        type: "paragraph",
        text:
          "Attention lets each token row ask which other token rows it should read. In a tiny four-token example, the row for token 4 might read strongly from token 2 and lightly from token 3. Attention combines those source rows into a context update for token 4. The important object is still a row of D numbers: attention produces an update that can be added back to the token row.",
      },
      {
        type: "example",
        title: "A tiny attention trace",
        body:
          "Suppose token 4 has hidden row [0.10, 0.50, -0.20]. Attention weights say read 70% from token 2 and 30% from token 3. The weighted read produces context update [0.20, -0.10, 0.40]. After residual addition, token 4 carries both the old signal and the context update.",
      },
      {
        type: "heading",
        text: "Step 2: the MLP updates each row independently",
      },
      {
        type: "definition",
        term: "MLP inside a transformer block",
        definition:
          "A per-token feed-forward subnetwork. It receives one token's hidden vector at a time, applies learned linear layers plus a nonlinearity, and returns an update vector with the same hidden width D.",
      },
      {
        type: "paragraph",
        text:
          "Attention mixes across token positions. The MLP does not. The MLP is applied to each row separately. For the row at token 4, it may expand the D numbers into a larger internal feature space, apply an activation that keeps useful features and dampens others, then project back down to D numbers. That returned D-wide vector can be added back to token 4's row.",
      },
      {
        type: "heading",
        text: "Residual connections and normalization keep the edit stable",
      },
      {
        type: "paragraph",
        text:
          "A residual connection means the block adds an update to the existing row instead of replacing the row from scratch. Normalization rescales the row so values stay in a stable range for the next sublayer. These two pieces are why many blocks can be stacked without each layer destroying the signal it received.",
      },
      {
        type: "heading",
        text: "The output head turns the final row into logits",
      },
      {
        type: "definition",
        term: "Logits",
        definition:
          "Raw next-token scores, one per vocabulary token, produced before softmax. Higher logits mean the model currently scores that token as more likely.",
      },
      {
        type: "paragraph",
        text:
          "After many transformer blocks, the model looks at the final hidden row for the position being predicted. The output head is a learned projection from D hidden numbers to V vocabulary scores. If D is 3 and the vocabulary has 5 tokens, the output head turns one 3-number hidden vector into five logits. Training then compares those logits to the true next token.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "KV cache is still only a preview here. It stores past attention Keys and Values during inference. That will make sense after attention, generation, and training have stable meanings.",
      },
    ],
    diagrams: [
      {
        kind: "mermaid",
        title: "Current stage: transformer block consumes hidden states",
        mermaid:
          "flowchart LR\n  A[\"Before<br/>tokenizer -> token IDs\"] --> B[\"Embedding + position<br/>IDs -> H0 hidden states\"]\n  B --> C[\"This section<br/>transformer block\"]\n  C --> D[\"Passed forward<br/>updated hidden states H1<br/>same L x D shape\"]\n  D --> E[\"Next<br/>more blocks or output head\"]\n  E --> F[\"Logits<br/>one score per vocab token\"]\n  F --> G[\"Training<br/>compare to true next token\"]\n  F --> H[\"Inference later<br/>sample token, use KV cache optimization\"]",
        takeaway:
          "The transformer does not tokenize text. It receives hidden states created from token IDs, edits those states, and passes updated states toward logits.",
        caption:
          "This section is the transformer stage of the LLM pipeline: input H0, output H1, same shape, richer context.",
        support_ref:
          "Lesson 7 Part 3: transformer block handoff from hidden states to logits.",
      },
      {
        kind: "mermaid",
        title: "One transformer block preserves shape while editing rows",
        mermaid:
          "flowchart TB\n  H0[\"Input hidden states H<br/>L rows x D columns\"] --> N1[\"Normalize rows\"]\n  N1 --> ATT[\"Attention<br/>rows read other rows\"]\n  ATT --> ADD1[\"Residual add<br/>old row + context update\"]\n  ADD1 --> N2[\"Normalize rows\"]\n  N2 --> MLP[\"MLP per row<br/>linear -> activation -> linear\"]\n  MLP --> ADD2[\"Residual add<br/>old row + MLP update\"]\n  ADD2 --> H1[\"Output hidden states H'<br/>same L x D shape\"]\n  H1 --> HEAD[\"Output head on final row\"]\n  HEAD --> LOGITS[\"V vocabulary logits\"]",
        takeaway:
          "Attention mixes across rows. The MLP transforms each row. Residuals add updates without erasing old signal. The output shape stays L by D until the output head projects one row to vocabulary logits.",
        caption:
          "The diagram sits beside the mechanism trace so each term in the paragraph maps to a visible operation.",
        support_ref:
          "Lesson 7 Part 3: transformer blocks produce logits.",
      },
    ],
    summary:
      "A transformer block is a same-shape editor for the hidden-state matrix. Attention writes context updates, the MLP updates each token row, residuals and normalization stabilize the edit, and the output head projects the final hidden row into vocabulary logits for training.",
  },
  audio: {
    script:
      "Now we can define transformer block properly and place it in the pipeline. The tokenizer came before this. It produced token IDs. Embedding lookup and position information turned those IDs into the initial hidden-state matrix, H zero. The transformer block consumes that hidden-state matrix. It does not tokenize text. It does not store the vocabulary. It receives one vector row per token position and edits those rows. A transformer block is a repeated same-shape editing layer. The object entering the block is L token rows by D hidden columns. The object leaving the block has the same shape. Same number of token rows, same hidden width, but the row values carry more context. The first major substep is attention. Attention lets each token row decide which other rows it should read from. In a four-token example, the final token might read mostly from token two and a little from token three. Attention combines those source rows into a context update, another D-wide vector. Then a residual connection adds that update to the old token row. The old signal is not thrown away. It is carried forward plus the new context information. Normalization keeps the row values in a stable range before the next substep. The second major substep is the MLP. MLP means multilayer perceptron, but inside a transformer block it is easiest to think of it as a per-token feed-forward updater. Attention mixes across token positions. The MLP does not mix positions. It takes one token row at a time, runs learned linear layers plus an activation, and returns another D-wide update for that same row. Again, residual addition keeps the previous row available while adding the MLP update, and normalization keeps the scale stable. After one block, the matrix is still L by D. After many blocks, each token row has passed through repeated context mixing and per-row transformation. What gets passed forward is an updated hidden-state matrix. The output head is the first step here that changes shape. It takes the final hidden vector at the prediction position and projects it into one raw score for every vocabulary token. Those raw scores are logits. If the vocabulary has five tokens in our toy example, one hidden vector becomes five logits. In a real model, one hidden vector becomes tens of thousands of logits. Training uses those logits by comparing them to the true next token. Inference later samples from logits and may use KV cache to avoid recomputing old attention keys and values. So the relationship is tokenizer before transformer, hidden states into transformer, updated hidden states out of transformer, logits after the output head.",
    duration_hint: 420,
  },
  quiz: withQuizSupport(part41, "Lesson 7 Part 3: transformer blocks produce logits"),
};

const backup = backupDb();
const tx = db.transaction(() => {
  updatePart(40, "Part 2: Token IDs Become Hidden States", updated40);
  updatePart(41, "Part 3: What a Transformer Block Does", updated41);
});
tx();

console.log(JSON.stringify({
  ok: true,
  db: dbPath,
  backup,
  updated_activity_ids: [40, 41],
}, null, 2));
