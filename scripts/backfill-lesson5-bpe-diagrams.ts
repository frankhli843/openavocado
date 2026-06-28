/**
 * Backfill the canonical BPE merge-flow diagram (and a paired tokenizer-pipeline
 * static diagram) onto Lesson 5, Part 2 (Data and Tokenization) using the new
 * first-class lesson-diagram content model (reading.diagrams).
 *
 * This is the example Frank called out: the BPE paragraph that says tokenization
 * starts from characters and repeatedly merges the most frequent adjacent pair
 * should not stand alone as prose — it should sit beside a flow/merge diagram.
 *
 * Idempotent: re-running it leaves a part that already has reading.diagrams
 * untouched. Validates the resulting lesson_part against the real contract
 * before writing.
 *
 * Run with:  AVOCADOCORE_DB_PATH=data/avocadocore.db npx tsx scripts/backfill-lesson5-bpe-diagrams.ts
 */
import Database from "better-sqlite3";
import {
  validateReadingContent,
  validateLessonDiagrams,
  type LessonDiagram,
} from "../src/lib/lesson-content/schema";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";
const ACTIVITY_ID = 34; // Lesson 5, Part 2: Data and Tokenization

const mermaidBpe: LessonDiagram = {
  kind: "mermaid",
  title: "BPE merge flow",
  mermaid: [
    "flowchart LR",
    '  C["Characters<br/>l e a r n i n g"]',
    '  P["Count adjacent pairs<br/>(i,n) most frequent"]',
    '  M["Merge the top pair<br/>in -> in"]',
    '  R{"Reached target<br/>vocab size?"}',
    '  T["Tokens<br/>common words = 1 token,<br/>rare words = subword pieces"]',
    "  C --> P --> M --> R",
    "  R -- no, merge again --> P",
    "  R -- yes --> T",
  ].join("\n"),
  takeaway:
    "BPE builds the vocabulary bottom-up: start from characters, repeatedly merge the most frequent adjacent pair, and stop at the target size — so frequent words collapse to single tokens while rare words stay as familiar subword pieces.",
  caption: "Byte-pair encoding turns the merge paragraph into a loop you can trace.",
  support_ref:
    "Part 2 reading: 'BPE solves both problems by working at the subword level. It starts from characters, then merges the most common adjacent pair repeatedly.'",
};

const tokenizerPipeline: LessonDiagram = {
  kind: "static",
  title: "The tokenizer contract: text to integer IDs",
  asset_path: "runtime_artifacts/diagrams/tokenizer_pipeline.svg",
  alt: "Raw text flows into a BPE tokenizer with a fixed vocabulary and out as a sequence of integer IDs, which then feed the model.",
  takeaway:
    "The tokenizer is the bridge from text to numbers; the same token ID always maps to the same subword from training through every later inference call.",
  caption: "An original diagram for this lesson; concept reference below.",
  external: true,
  source_url: "https://huggingface.co/learn/nlp-course/en/chapter6/5",
  license:
    "Original diagram recreated for this lesson. Concept reference only (Hugging Face NLP course, BPE chapter); no third-party asset is embedded.",
  support_ref:
    "Part 2 reading: 'The tokenizer is the bridge: before training, it converts your entire corpus to integer IDs.'",
};

function main() {
  const db = new Database(DB_PATH);
  const row = db
    .prepare("SELECT id, lesson_id, activity_type, content FROM lesson_activities WHERE id = ?")
    .get(ACTIVITY_ID) as
    | { id: number; lesson_id: number; activity_type: string; content: string }
    | undefined;

  if (!row) throw new Error(`activity ${ACTIVITY_ID} not found`);
  if (row.activity_type !== "lesson_part") {
    throw new Error(`activity ${ACTIVITY_ID} is ${row.activity_type}, expected lesson_part`);
  }

  const content = JSON.parse(row.content) as Record<string, unknown>;
  const reading = content.reading as Record<string, unknown>;

  if (Array.isArray(reading.diagrams) && reading.diagrams.length > 0) {
    console.log(`activity ${ACTIVITY_ID} already has ${reading.diagrams.length} diagram(s); leaving untouched.`);
    return;
  }

  reading.diagrams = [mermaidBpe, tokenizerPipeline];

  // Validate only what we are changing: the new diagrams and the reading block
  // (the part's interactive widget is a pre-existing registered custom widget
  // and is out of scope for this additive backfill).
  const diagResult = validateLessonDiagrams(reading.diagrams, "reading.diagrams");
  const readResult = validateReadingContent(reading);
  if (!diagResult.valid || !readResult.valid) {
    const errs = [...diagResult.errors, ...readResult.errors];
    throw new Error(`validation failed before write:\n - ${errs.join("\n - ")}`);
  }

  db.prepare("UPDATE lesson_activities SET content = ? WHERE id = ?").run(
    JSON.stringify(content),
    ACTIVITY_ID
  );
  console.log(`activity ${ACTIVITY_ID}: added ${(reading.diagrams as unknown[]).length} diagrams (mermaid BPE merge flow + static tokenizer pipeline). Validation passed.`);
}

main();
