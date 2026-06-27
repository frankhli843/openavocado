/**
 * Backfill Mermaid diagrams into the remaining 5 AvocadoCore lessons,
 * then delete the corresponding stopgap interactive "Diagram:" activities.
 *
 * Migrations:
 *   Lesson 2, activity 52  <- Bayes evidence funnel   (removes stopgap 57)
 *   Lesson 3, activity 53  <- Tax wedge                (removes stopgap 58)
 *   Lesson 5, activity 33  <- LLM seven-stage pipeline (removes stopgap 54)
 *   Lesson 7, activity 40  <- KV-cache prefill/decode  (removes stopgap 55)
 *   Lesson 8, activity 46  <- AWS-to-GCP map           (removes stopgap 56)
 *
 * Idempotent: parts already carrying reading.diagrams are left untouched.
 * Validates before every write. Deletes stopgap only after migration passes.
 *
 * Run with:
 *   AVOCADOCORE_DB_PATH=data/avocadocore.db npx tsx scripts/backfill-remaining-diagrams.ts
 */

import Database from "better-sqlite3";
import {
  validateReadingContent,
  validateLessonDiagrams,
  type LessonDiagram,
} from "../src/lib/lesson-content/schema";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";

// ─── Diagram definitions ────────────────────────────────────────────────────

// Lesson 2 — Bayes evidence funnel
const bayesFunnel: LessonDiagram = {
  kind: "mermaid",
  title: "Bayes evidence funnel",
  mermaid: [
    "flowchart TD",
    "  P[\"Prior population\\n(e.g. 1 000 people)\"]",
    "  P -- \"prevalence 1%\" --> D[\"Has condition\\n(10)\"]",
    "  P -- \"99%\" --> ND[\"No condition\\n(990)\"]",
    "  D -- \"sensitivity 90%\" --> TP[\"True positives\\n(9 test +)\"]",
    "  D -- \"10%\" --> FN[\"False negatives\\n(1 test −)\"]",
    "  ND -- \"1 − specificity 5%\" --> FP[\"False positives\\n(~50 test +)\"]",
    "  ND -- \"specificity 95%\" --> TN[\"True negatives\\n(~940 test −)\"]",
    "  TP -- \"9 / (9 + 50)\" --> POST[\"Posterior ≈ 15%\\n(PPV)\"]",
    "  FP --> POST",
  ].join("\n"),
  takeaway:
    "Even with a 90% sensitive test, a rare condition means most positives are false positives — the posterior (PPV) is shaped by prevalence, not just test accuracy.",
  caption: "The evidence funnel: population splits by condition, then by test result, and the posterior reads only the positive pile.",
  support_ref:
    "Part 3 reading: 'The posterior is true positives divided by all positives, so the denominator is the whole positive pile.'",
};

// Lesson 3 — Tax wedge
const taxWedge: LessonDiagram = {
  kind: "mermaid",
  title: "Tax wedge: burden splits by elasticity",
  mermaid: [
    "flowchart TD",
    "  EQ[\"Pre-tax equilibrium\\nPrice = P*, Qty = Q*\"]",
    "  TAX[\"Per-unit tax T inserted\\n(government collects T × Q_new)\"]",
    "  EQ --> TAX",
    "  TAX --> BP[\"Buyer pays P_b = P* + consumer burden\\n(price rises toward inelastic demand)\"]",
    "  TAX --> SP[\"Seller receives P_s = P* − producer burden\\n(price falls toward inelastic supply)\"]",
    "  BP --> SPLIT[\"Burden split:\\nless elastic side bears more\"]",
    "  SP --> SPLIT",
    "  SPLIT --> DWL[\"Deadweight loss: Q shrinks from Q* to Q_tax\\n(trades that would have happened don't)\"]",
  ].join("\n"),
  takeaway:
    "A per-unit tax drives a wedge between buyer price and seller receipt; the burden flows toward whichever side is least able to walk away (lower price-elasticity).",
  caption: "The tax wedge: equilibrium splits into buyer price and seller receipt, and the less elastic side absorbs more of the gap.",
  support_ref:
    "Part 3 reading: 'A per-unit tax separates buyer price from seller receipt. The less responsive side bears more of the burden.'",
};

// Lesson 5 — LLM seven-stage pipeline
const llmPipeline: LessonDiagram = {
  kind: "mermaid",
  title: "LLM lifecycle: seven stages, seven contracts",
  mermaid: [
    "flowchart LR",
    "  D[\"1. Data\\nclean+filter corpus\"]",
    "  T[\"2. Tokenize\\ntext → integer IDs\"]",
    "  A[\"3. Architecture\\ntransformer design\"]",
    "  TR[\"4. Train\\ngradient descent\"]",
    "  E[\"5. Evaluate\\nbenchmarks+evals\"]",
    "  Q[\"6. Quantize/Convert\\nfloat32 → GGUF/INT4\"]",
    "  S[\"7. Serve\\nruntime inference\"]",
    "  D -- \"training corpus\" --> T",
    "  T -- \"token vocab\" --> A",
    "  A -- \"model spec\" --> TR",
    "  TR -- \"checkpoint\" --> E",
    "  E -- \"validated weights\" --> Q",
    "  Q -- \"quantized model file\" --> S",
  ].join("\n"),
  takeaway:
    "Each stage emits one artifact that becomes the next stage's contract — breaking any link (mismatched tokenizer, wrong quantization format) causes silent failure downstream.",
  caption: "Seven stages, seven handoffs. Each arrow is a contract: change the format and the next stage breaks.",
  support_ref:
    "Part 1 reading: 'Building and deploying a language model is not a single step — it is a sequence of transformations, each producing what the next stage needs.'",
};

// Lesson 7 — KV-cache prefill + decode
const kvCache: LessonDiagram = {
  kind: "mermaid",
  title: "Prefill then decode with KV-cache reuse",
  mermaid: [
    "flowchart TD",
    "  PROMPT[\"Full prompt tokens\\n(all processed in parallel)\"]",
    "  PREFILL[\"Prefill pass\\nCompute K,V for every prompt token\"]",
    "  CACHE[\"KV cache\\n(K,V for tokens 1…n stored)\"]",
    "  PROMPT --> PREFILL --> CACHE",
    "  CACHE --> DEC1[\"Decode step 1\\nNew token t_{n+1}:\\nquery attends to cached K,V + own K,V\"]",
    "  DEC1 -- \"append t_{n+1} K,V\" --> CACHE",
    "  CACHE --> DEC2[\"Decode step 2\\nNew token t_{n+2}:\\nquery attends to cached K,V only\"]",
    "  DEC2 -- \"append t_{n+2} K,V\" --> CACHE",
    "  CACHE --> DOTS[\"… (repeat until EOS or max length)\"]",
  ].join("\n"),
  takeaway:
    "Prefill is done once in parallel across the whole prompt; every decode step is O(1) because past K,V are read from the cache rather than recomputed.",
  caption: "The cache grows one row per generated token. Without it every decode step would recompute all previous tokens.",
  support_ref:
    "Part 2 reading: 'once a token is in the sequence, its Key and Value never change. Token 47's Key and Value were computed from Token 47's input embedding and never need updating.'",
};

// Lesson 8 — AWS-to-GCP translation map
const awsGcpMap: LessonDiagram = {
  kind: "mermaid",
  title: "AWS to GCP translation map",
  mermaid: [
    "flowchart LR",
    "  subgraph AWS",
    "    A_ORG[\"AWS Organization\"]",
    "    A_OU[\"Organizational Unit (OU)\"]",
    "    A_ACCT[\"AWS Account\"]",
    "    A_EC2[\"EC2\"]",
    "    A_S3[\"S3\"]",
    "    A_RDS[\"RDS\"]",
    "    A_IAM_U[\"IAM User/Role\"]",
    "    A_SQS[\"SQS / SNS\"]",
    "    A_VPC[\"VPC\"]",
    "  end",
    "  subgraph GCP",
    "    G_ORG[\"GCP Organization\"]",
    "    G_FOLDER[\"Folder\"]",
    "    G_PROJ[\"Project\"]",
    "    G_GCE[\"Compute Engine\"]",
    "    G_GCS[\"Cloud Storage\"]",
    "    G_SQL[\"Cloud SQL\"]",
    "    G_SA[\"Cloud IAM / Service Account\"]",
    "    G_PUBSUB[\"Pub/Sub\"]",
    "    G_VPC[\"VPC\"]",
    "  end",
    "  A_ORG <-- \"≈\" --> G_ORG",
    "  A_OU <-- \"≈\" --> G_FOLDER",
    "  A_ACCT <-- \"≈\" --> G_PROJ",
    "  A_EC2 <-- \"≈\" --> G_GCE",
    "  A_S3 <-- \"≈\" --> G_GCS",
    "  A_RDS <-- \"≈\" --> G_SQL",
    "  A_IAM_U <-- \"≈\" --> G_SA",
    "  A_SQS <-- \"≈\" --> G_PUBSUB",
    "  A_VPC <-- \"≈\" --> G_VPC",
  ].join("\n"),
  takeaway:
    "Every AWS concept has a near-exact GCP counterpart; the biggest shift is that the GCP hierarchy is explicit (Organization → Folder → Project → Resource) rather than implicit.",
  caption: "AWS engineers already know this vocabulary — GCP uses different names for the same architecture.",
  support_ref:
    "Part 1 reading: 'GCP organizes every resource into a strict four-layer hierarchy: Organization → Folder → Project → Resource. Unlike AWS where an account is a largely flat unit...'",
};

// ─── Migrations config ───────────────────────────────────────────────────────

interface Migration {
  partId: number;          // lesson_part activity to receive the diagram
  stopgapId: number;       // interactive activity to delete after migration
  lesson: number;
  partTitle: string;
  diagram: LessonDiagram;
}

const MIGRATIONS: Migration[] = [
  { partId: 52, stopgapId: 57, lesson: 2, partTitle: "Part 3: Posterior reads the positive pile",     diagram: bayesFunnel },
  { partId: 53, stopgapId: 58, lesson: 3, partTitle: "Part 3: Taxes create a wedge and split burden", diagram: taxWedge   },
  { partId: 33, stopgapId: 54, lesson: 5, partTitle: "Part 1: The LLM Pipeline — Seven Stages",       diagram: llmPipeline },
  { partId: 40, stopgapId: 55, lesson: 7, partTitle: "Part 2: The KV Cache",                          diagram: kvCache    },
  { partId: 46, stopgapId: 56, lesson: 8, partTitle: "Part 1: GCP's Resource Hierarchy",              diagram: awsGcpMap  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const db = new Database(DB_PATH);

  let migrated = 0;
  let skipped = 0;
  let stopgapsRemoved = 0;

  for (const m of MIGRATIONS) {
    const row = db
      .prepare("SELECT id, lesson_id, activity_type, content FROM lesson_activities WHERE id = ?")
      .get(m.partId) as
      | { id: number; lesson_id: number; activity_type: string; content: string }
      | undefined;

    if (!row) {
      throw new Error(`[L${m.lesson}] activity ${m.partId} not found`);
    }
    if (row.activity_type !== "lesson_part") {
      throw new Error(`[L${m.lesson}] activity ${m.partId} is ${row.activity_type}, expected lesson_part`);
    }
    if (row.lesson_id !== m.lesson) {
      throw new Error(`[L${m.lesson}] activity ${m.partId} belongs to lesson ${row.lesson_id}, not ${m.lesson}`);
    }

    const content = JSON.parse(row.content) as Record<string, unknown>;
    const reading = content.reading as Record<string, unknown>;

    if (Array.isArray(reading.diagrams) && reading.diagrams.length > 0) {
      console.log(`[L${m.lesson}] activity ${m.partId} already has ${reading.diagrams.length} diagram(s); skipping.`);
      skipped++;
    } else {
      reading.diagrams = [m.diagram];

      // Validate before writing
      const diagResult = validateLessonDiagrams(reading.diagrams, "reading.diagrams");
      const readResult = validateReadingContent(reading);
      if (!diagResult.valid || !readResult.valid) {
        const errs = [...diagResult.errors, ...readResult.errors];
        throw new Error(`[L${m.lesson}] validation failed:\n - ${errs.join("\n - ")}`);
      }

      db.prepare("UPDATE lesson_activities SET content = ?, updated_at = datetime('now') WHERE id = ?").run(
        JSON.stringify(content),
        m.partId
      );
      console.log(`[L${m.lesson}] activity ${m.partId}: added diagram "${m.diagram.title}". Validation passed.`);
      migrated++;
    }

    // Now delete the stopgap (regardless of whether we just wrote or it was already done)
    const stopgap = db
      .prepare("SELECT id, activity_type, title FROM lesson_activities WHERE id = ?")
      .get(m.stopgapId) as { id: number; activity_type: string; title: string } | undefined;

    if (!stopgap) {
      console.log(`[L${m.lesson}] stopgap activity ${m.stopgapId} already gone; nothing to remove.`);
    } else {
      if (stopgap.activity_type !== "interactive") {
        throw new Error(`[L${m.lesson}] stopgap ${m.stopgapId} has type ${stopgap.activity_type}, expected interactive`);
      }
      db.prepare("DELETE FROM lesson_activities WHERE id = ?").run(m.stopgapId);
      console.log(`[L${m.lesson}] deleted stopgap activity ${m.stopgapId} ("${stopgap.title}")`);
      stopgapsRemoved++;
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, skipped (already had diagrams): ${skipped}, stopgaps removed: ${stopgapsRemoved}.`);
}

main();
