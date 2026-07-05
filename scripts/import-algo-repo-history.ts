#!/usr/bin/env tsx
/**
 * Import Frank's algorithms-repo comfort-level history into AvocadoCore.
 *
 * Frank maintains https://github.com/frankhli843/algorithms — every attempted
 * problem has a `## Metadata` section recording `comfortLevel::X/5` entries per
 * study session, each dated. This is the most reliable signal about his current
 * (well, 2022-2023) algorithm state. Importing it gives the adaptive lesson
 * generator real priors instead of starting cold.
 *
 * What this script does (idempotent — safe to re-run):
 *   1. Ensures the "Coding Interview Mastery" subject exists (creates it with the
 *      plan metadata if absent) and seeds its workpad.
 *   2. Walks every .md file under the repo's algorithm-challenge tree.
 *   3. Parses each file's Metadata section for comfortLevel/date/labels entries.
 *   4. Maps the file's directory path to a canonical concept tag.
 *   5. Writes ONE learning_evidence row per comfort-level entry (source_type
 *      'historical_import') carrying the real attempt date — this is what
 *      buildPhaseEvidencePacket surfaces to the planner.
 *   6. Writes ONE aggregate mastery_signals row per concept, mapping the latest
 *      comfort level to an existing valid signal_type (5/4 -> strength,
 *      3 -> review_needed, 2/1 -> weak_spot) so the mastery model sees priors.
 *   7. Prints a summary (files parsed, entries imported, per-topic counts).
 *
 * Re-running deletes prior historical_import evidence + algo_repo_import signals
 * for the subject first, so counts stay correct.
 *
 * Usage (MUST run under nvm Node 22 — better-sqlite3 is built for v127):
 *   source ~/.nvm/nvm.sh && nvm use 22
 *   pnpm tsx scripts/import-algo-repo-history.ts [--repo <path>] [--dry-run]
 *
 * Default repo path: code/algorithms (relative to the avocadocore repo root).
 */

import fs from "fs";
import path from "path";
import { getDb, closeDb } from "../src/db/connection";
import {
  ensureLearningEvidenceSchema,
  migrateLearningEvidenceSourceTypeCheck,
} from "../src/lib/learning-evidence";

const LEARNER_ID = 1; // Frank
const SOURCE_LABEL = "algo_repo_import";

const SUBJECT = {
  title: "Coding Interview Mastery",
  description:
    "Systematic preparation for top-tier software engineering interviews. Covers all core algorithm patterns from first principles, with adaptive lessons calibrated to Frank's existing strengths and weaknesses. Target outcome: full fluency at Google L5 / Frontier AI Labs bar — LC Medium in under 20 minutes, LC Hard with a clear approach in under 45 minutes.",
  current_level: "familiarity",
  goals:
    "Full mastery of the ~15 core interview patterns. Able to (1) recognize any pattern from a problem description within 2 minutes, (2) implement the optimal solution for any LC Medium in under 20 minutes with no bugs, (3) produce a working approach and partial implementation for any LC Hard in under 45 minutes. Ready for in-person Google L5 and Frontier AI Labs screens.",
  criteria:
    "Frank has 3 years of algorithm practice history at https://github.com/frankhli843/algorithms. He is strong on Trees, BFS/DFS, most DP families (Napsack, LIS, Kandane, Binary Search on Answer, MCM), Dijkstra, and Linked Lists — but all of this is from 2022-2023 and needs reactivation at speed. He is demonstrably weak on Sliding Window, Two Pointer, Heap, Trie, Backtracking, and Monotonic Stack. His interview timeline is immediate: interviewing.io practice on July 6, TripleTen interview July 7, and ongoing Frontier AI Labs coaching with Courtney McDonald at interviewing.io. Lessons should prioritize weak patterns first, then reactivation of strong-but-stale patterns, then mixed timed practice.",
};

/**
 * Directory-segment -> canonical concept tag. Longest / most specific match
 * wins (checked in order). Segments are matched case-insensitively against the
 * repo-relative file path. Covers the ~20 key directory patterns in the repo.
 */
const TAG_RULES: Array<{ match: RegExp; tag: string }> = [
  // DP subcategories (check before the generic "dynamic programming").
  { match: /napsack\s*unbounded|unbounded.*knapsack/i, tag: "knapsack-unbounded" },
  { match: /napsack|knapsack/i, tag: "knapsack" },
  { match: /\bkandane\b|kadane/i, tag: "kadane" },
  { match: /\blis\b|longest.increasing/i, tag: "lis" },
  { match: /\bmcm\b|matrix.chain/i, tag: "matrix-chain-multiplication" },
  { match: /binary.search.on.answer|binary.search.answer/i, tag: "binary-search-on-answer" },
  { match: /fibonacci/i, tag: "fibonacci" },
  { match: /dynamic.programming|\bdp\b/i, tag: "dynamic-programming" },
  // Core pattern buckets.
  { match: /sliding.window/i, tag: "sliding-window" },
  { match: /two.pointer/i, tag: "two-pointer" },
  { match: /monotonic.stack/i, tag: "monotonic-stack" },
  { match: /backtrack/i, tag: "backtracking" },
  { match: /\btrie\b|prefix.tree/i, tag: "trie" },
  { match: /heap|priority.queue/i, tag: "heap" },
  { match: /union.find|disjoint.set/i, tag: "union-find" },
  { match: /dijkstra|shortest.path/i, tag: "dijkstra" },
  { match: /\bbfs\b|breadth.first/i, tag: "bfs" },
  { match: /\bdfs\b|depth.first/i, tag: "dfs" },
  { match: /binary.search/i, tag: "binary-search" },
  { match: /linked.list/i, tag: "linked-list" },
  { match: /\btree\b|traversal/i, tag: "tree" },
  { match: /\bgraph\b/i, tag: "graph" },
  { match: /array|string/i, tag: "arrays-and-strings" },
  { match: /recusion|recursion/i, tag: "recursion" }, // note: repo dir is misspelled "Recusion"
  { match: /bit.manip/i, tag: "bit-manipulation" },
  { match: /finite.state|state.machine/i, tag: "state-machine" },
  { match: /sorting|searching/i, tag: "sorting-searching" },
  { match: /machine.learning/i, tag: "machine-learning" },
  { match: /\bmath\b|numbers/i, tag: "math" },
  { match: /design|\boop\b/i, tag: "design-oop" },
];

function mapPathToTag(relPath: string): string {
  for (const rule of TAG_RULES) {
    if (rule.match.test(relPath)) return rule.tag;
  }
  return "uncategorized";
}

interface ComfortEntry {
  comfort: number; // 1-5
  date: string | null; // ISO-ish or null
  labels: string | null;
}

/**
 * Parse a problem file. Returns the comfort-level entries found in the
 * `## Metadata` section (or, if there is no explicit section, anywhere in the
 * file). Each `comfortLevel::X/5` is one entry; a `date::...` that appears on
 * the same line (or the nearest preceding one) is attached to it.
 */
function parseFile(content: string): { entries: ComfortEntry[]; fileLabels: string | null } {
  // Prefer the Metadata section if present.
  const metaIdx = content.search(/^##\s*Metadata/im);
  const scope = metaIdx >= 0 ? content.slice(metaIdx) : content;

  // File-level labels: `labels: a, b, c` or `labels::a, b`.
  const fileLabelMatch = scope.match(/labels\s*::?\s*([^\n]+)/i);
  const fileLabels = fileLabelMatch ? fileLabelMatch[1].trim() : null;

  const entries: ComfortEntry[] = [];
  // Walk line by line so a date on the same line as a comfortLevel binds to it.
  const lines = scope.split(/\r?\n/);
  let lastDate: string | null = null;
  for (const line of lines) {
    const dateM = line.match(/date\s*::?\s*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i);
    if (dateM) lastDate = normalizeDate(dateM[1]);
    // A single line may contain multiple comfortLevel entries.
    const clRe = /comfortLevel\s*::?\s*([1-5])\s*\/\s*5/gi;
    let m: RegExpExecArray | null;
    while ((m = clRe.exec(line)) !== null) {
      const lineLabels = line.match(/labels\s*::?\s*([^\n]+)/i);
      entries.push({
        comfort: Number(m[1]),
        date: dateM ? normalizeDate(dateM[1]) : lastDate,
        labels: lineLabels ? lineLabels[1].trim() : null,
      });
    }
  }
  return { entries, fileLabels };
}

/** Normalize a variety of date formats to YYYY-MM-DD, or null if implausible. */
function normalizeDate(raw: string): string | null {
  const s = raw.trim().replace(/\//g, "-");
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // MM-DD-YYYY or M-D-YY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = `20${y}`;
    const yn = Number(y);
    if (yn < 2015 || yn > 2030) return null; // implausible for this repo
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function comfortToSignalType(comfort: number): "strength" | "review_needed" | "weak_spot" {
  if (comfort >= 4) return "strength";
  if (comfort === 3) return "review_needed";
  return "weak_spot";
}

function walkMdFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let ents: fs.Dirent[];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of ents) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) out.push(full);
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const repoArgIdx = args.indexOf("--repo");
  const repoPath = repoArgIdx >= 0 ? args[repoArgIdx + 1] : path.join(process.cwd(), "code", "algorithms");

  if (!fs.existsSync(repoPath)) {
    console.error(`Repo path not found: ${repoPath}`);
    console.error("Clone it first: git clone https://github.com/frankhli843/algorithms.git code/algorithms");
    process.exit(1);
  }

  // Prefer the algorithm-challenge subtree if it exists; else scan the whole repo.
  const challengesDir = ["Challenges/Algorithms", "Challenges", "Algorithms"]
    .map((p) => path.join(repoPath, p))
    .find((p) => fs.existsSync(p));
  const scanRoot = challengesDir ?? repoPath;
  console.log(`Scanning: ${scanRoot}`);

  const db = getDb();
  ensureLearningEvidenceSchema(db);
  migrateLearningEvidenceSourceTypeCheck(db);

  // 1. Ensure subject.
  let subject = db
    .prepare("SELECT id FROM subjects WHERE learner_id = ? AND title = ?")
    .get(LEARNER_ID, SUBJECT.title) as { id: number } | undefined;
  if (!subject) {
    const res = db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(LEARNER_ID, SUBJECT.title, SUBJECT.description, SUBJECT.goals, SUBJECT.criteria, SUBJECT.current_level);
    subject = { id: Number(res.lastInsertRowid) };
    console.log(`Created subject "${SUBJECT.title}" id=${subject.id}`);
  } else {
    console.log(`Subject "${SUBJECT.title}" already exists id=${subject.id}`);
  }
  const subjectId = subject.id;

  // Seed workpad if absent.
  const wp = db
    .prepare("SELECT id FROM subject_workpads WHERE subject_id = ? AND learner_id = ?")
    .get(subjectId, LEARNER_ID);
  if (!wp && !dryRun) {
    db.prepare(
      `INSERT INTO subject_workpads (subject_id, learner_id, content, last_updated_by, last_updated_for)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      subjectId,
      LEARNER_ID,
      `# Coding Interview Mastery — Workpad\n\nSeeded ${new Date().toISOString().slice(0, 10)} from algo-repo import.\n\n## Calibrated priors (from github.com/frankhli843/algorithms)\nPopulated by scripts/import-algo-repo-history.ts. See learning_evidence (source_type=historical_import, structured metadata) and mastery_signals (one aggregate signal per concept).\n\n## Weakness map (from plan)\n- Weak (build first): sliding-window, two-pointer, heap, trie, backtracking, monotonic-stack\n- Strong-but-stale (reactivate): tree, bfs, dfs, dynamic-programming (all families), dijkstra, union-find, linked-list\n`,
      SOURCE_LABEL,
      "planner"
    );
    console.log("Seeded subject workpad.");
  }

  // Idempotency: clear prior import rows for this subject.
  if (!dryRun) {
    db.prepare(
      "DELETE FROM learning_evidence WHERE subject_id = ? AND source_type = 'historical_import'"
    ).run(subjectId);
    // Matches both the legacy JSON detail (`"note":"Imported prior from algorithms
    // repo..."`) and the current human-sentence detail, so re-runs stay idempotent.
    db.prepare(
      "DELETE FROM mastery_signals WHERE subject_id = ? AND detail LIKE ?"
    ).run(subjectId, `%from algorithms repo%`);
  }

  // 2-5. Walk + parse + insert.
  const files = walkMdFiles(scanRoot);
  console.log(`Found ${files.length} .md files.`);

  const insertEvidence = db.prepare(
    `INSERT INTO learning_evidence
       (learner_id, subject_id, source_type, source_id, concept, difficulty, outcome, prompt, learner_input, metadata, created_at)
     VALUES (?, ?, 'historical_import', ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSignal = db.prepare(
    `INSERT INTO mastery_signals (learner_id, subject_id, signal_type, concept, detail, confidence, difficulty, tag_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const insertTag = db.prepare("INSERT INTO tags (name, tag_type) VALUES (?, 'concept')");
  const tagIdCache = new Map<string, number>();
  const ensureTag = (name: string): number => {
    if (tagIdCache.has(name)) return tagIdCache.get(name)!;
    let row = findTag.get(name) as { id: number } | undefined;
    if (!row) row = { id: Number(insertTag.run(name).lastInsertRowid) };
    tagIdCache.set(name, row.id);
    return row.id;
  };

  const difficultyFromPath = (p: string): "easy" | "medium" | "hard" | null => {
    if (/\bhard\b/i.test(p)) return "hard";
    if (/\bmedium\b|\bmed\b/i.test(p)) return "medium";
    if (/\beasy\b/i.test(p)) return "easy";
    return null;
  };

  let filesWithData = 0;
  let entriesImported = 0;
  const byTag = new Map<string, { entries: number; files: number; latestComfort: number; latestDate: string }>();
  const perConceptEntries = new Map<string, ComfortEntry[]>();

  const runImport = db.transaction(() => {
    for (const file of files) {
      const rel = path.relative(scanRoot, file);
      const content = fs.readFileSync(file, "utf-8");
      const { entries } = parseFile(content);
      if (entries.length === 0) continue;
      filesWithData++;
      const tag = mapPathToTag(rel);
      const difficulty = difficultyFromPath(rel);
      const problemTitle = path.basename(file, ".md");

      const bucket = byTag.get(tag) ?? { entries: 0, files: 0, latestComfort: 0, latestDate: "" };
      bucket.files++;

      for (const e of entries) {
        const createdAt = e.date ? `${e.date}T12:00:00Z` : new Date("2022-06-01T12:00:00Z").toISOString();
        if (!dryRun) {
          insertEvidence.run(
            LEARNER_ID,
            subjectId,
            `${SOURCE_LABEL}:${rel}`,
            tag,
            difficulty,
            `comfort ${e.comfort}/5`,
            `[historical] ${problemTitle} (${tag})`,
            `Self-rated comfort ${e.comfort}/5${e.labels ? ` — labels: ${e.labels}` : ""}`,
            JSON.stringify({
              source: SOURCE_LABEL,
              comfortLevel: e.comfort,
              date: e.date,
              labels: e.labels,
              repoPath: rel,
              historical: true,
            }),
            createdAt
          );
        }
        entriesImported++;
        bucket.entries++;
        if (e.date && e.date > bucket.latestDate) {
          bucket.latestDate = e.date;
          bucket.latestComfort = e.comfort;
        } else if (!bucket.latestDate && bucket.latestComfort === 0) {
          bucket.latestComfort = e.comfort;
        }
      }
      byTag.set(tag, bucket);
      const pce = perConceptEntries.get(tag) ?? [];
      pce.push(...entries);
      perConceptEntries.set(tag, pce);
    }

    // 6. Aggregate mastery_signals per concept (latest comfort -> signal type).
    if (!dryRun) {
      for (const [tag, entries] of perConceptEntries) {
        const dated = entries.filter((e) => e.date).sort((a, b) => (a.date! < b.date! ? 1 : -1));
        const latest = dated[0] ?? entries[entries.length - 1];
        const best = Math.max(...entries.map((e) => e.comfort));
        const signalType = comfortToSignalType(latest.comfort);
        const tagId = ensureTag(tag);
        // Human-readable detail — this is rendered verbatim in the Mastery tab
        // (MasteryPanel), so it must be a sentence, not a JSON blob. Full
        // structured provenance lives on the learning_evidence rows' metadata.
        const detail =
          `Imported prior from algorithms repo — comfort ${latest.comfort}/5` +
          (best !== latest.comfort ? ` (best ${best}/5)` : "") +
          `, ${entries.length} attempt${entries.length === 1 ? "" : "s"}` +
          (latest.date ? `, last practiced ${latest.date}` : "") +
          `. Historical self-rating, likely stale at interview speed.`;
        insertSignal.run(
          LEARNER_ID,
          subjectId,
          signalType,
          tag,
          detail,
          latest.comfort / 5,
          null,
          tagId,
          latest.date ? `${latest.date}T12:00:00Z` : new Date("2022-06-01T12:00:00Z").toISOString()
        );
      }
    }
  });
  runImport();

  // 7. Summary.
  console.log("\n===== IMPORT SUMMARY =====");
  console.log(`Files scanned:        ${files.length}`);
  console.log(`Files with comfort:   ${filesWithData}`);
  console.log(`Evidence entries:     ${entriesImported}`);
  console.log(`Concepts:             ${byTag.size}`);
  const sorted = [...byTag.entries()].sort((a, b) => b[1].entries - a[1].entries);
  console.log("\nPer-concept (entries / files / latestComfort):");
  for (const [tag, b] of sorted) {
    console.log(`  ${tag.padEnd(28)} ${String(b.entries).padStart(4)} entries  ${String(b.files).padStart(3)} files  latest=${b.latestComfort || "?"}/5`);
  }
  if (dryRun) console.log("\n(DRY RUN — nothing written.)");
  else console.log(`\nSubject id: ${subjectId}. Verify with buildPhaseEvidencePacket(${subjectId}, ${LEARNER_ID}).`);

  closeDb();
}

main();
