#!/usr/bin/env tsx
/**
 * P2.1 — Create the hand-authored initial assessment lesson for the
 * "Coding Interview Mastery" subject (id 9).
 *
 * Per the plan (Part 3, "Initial Assessment Design") and the lesson-authoring
 * skill: this is a special assessment-only lesson (sequence_number=0, no teaching
 * content, no audio, no visuals, no code). It replaces the stale 2022-2023 repo
 * comfort map with a FRESH calibration, and is weighted toward Frank's weak
 * patterns. It tests pattern RECOGNITION and APPROACH ARTICULATION, not
 * implementation.
 *
 * Coverage (per plan): >=2 sliding window, >=2 two-pointer, >=1 heap,
 * >=1 backtracking, pattern-ID across buckets, key-insight questions,
 * complexity questions, and adversarial "what breaks this?" probes. Strong
 * areas get 1 confirmation question each.
 *
 * Idempotent: deletes any prior seq=0 lesson (+ its activities) for the subject.
 *
 * Run under nvm node 22:
 *   source ~/.nvm/nvm.sh && nvm use 22
 *   pnpm tsx scripts/create-algo-initial-assessment.ts
 */

import { getDb, closeDb } from "../src/db/connection";
import { validateAssessmentContent } from "../src/lib/lesson-content/schema";

const SUBJECT_ID = 9;

// The curated pattern list shown as options for pattern-recognition questions.
const PATTERNS = [
  "Sliding Window",
  "Two Pointer",
  "Binary Search",
  "Heap / Priority Queue",
  "Backtracking",
  "Monotonic Stack",
  "Trie (Prefix Tree)",
  "Dynamic Programming",
  "BFS",
  "DFS",
  "Union Find",
  "Greedy",
];

type Q = {
  id: string;
  text: string;
  type: "free_text" | "multiple_choice";
  options?: string[];
  actual_answer?: string;
  rubric?: string;
  concept?: string;
  concept_tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
  hint?: string;
};

const questions: Q[] = [
  // ── Pattern recognition, weak areas weighted ───────────────────────────────
  {
    id: "ia-sw-recog-1",
    type: "multiple_choice",
    concept: "sliding-window",
    concept_tags: ["sliding-window", "pattern-recognition"],
    difficulty: "easy",
    options: PATTERNS,
    text:
      "PROBLEM: Given a string s, find the length of the longest substring that contains no repeating characters. " +
      "Which single pattern is the primary fit for an optimal O(n) solution?",
    actual_answer: "Sliding Window",
    rubric:
      "Primary: Sliding Window (variable-size, expand right / contract left on duplicate, track a char->last-index map or a set).",
  },
  {
    id: "ia-sw-recog-2",
    type: "multiple_choice",
    concept: "sliding-window",
    concept_tags: ["sliding-window", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Given strings s and t, return the minimum window substring of s that contains every character of t (with multiplicity). " +
      "Which single pattern is the primary fit?",
    actual_answer: "Sliding Window",
    rubric:
      "Primary: Sliding Window with a need/have count map; expand to satisfy, contract to minimize while still valid.",
  },
  {
    id: "ia-tp-recog-1",
    type: "multiple_choice",
    concept: "two-pointer",
    concept_tags: ["two-pointer", "pattern-recognition"],
    difficulty: "easy",
    options: PATTERNS,
    text:
      "PROBLEM: Given a SORTED array and a target, return the indices of two numbers that add up to the target, in O(n) time and O(1) extra space. " +
      "Which single pattern is the primary fit?",
    actual_answer: "Two Pointer",
    rubric:
      "Primary: Two Pointer (opposite ends; move left in if sum too small, right in if too large). Hashing also works but uses O(n) space — the sorted+O(1) constraint signals two pointer.",
  },
  {
    id: "ia-tp-recog-2",
    type: "multiple_choice",
    concept: "two-pointer",
    concept_tags: ["two-pointer", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Given a linked list, determine whether it contains a cycle using O(1) extra memory. " +
      "Which single pattern is the primary fit?",
    actual_answer: "Two Pointer",
    rubric:
      "Primary: Two Pointer (Floyd's fast/slow tortoise-and-hare; they meet iff a cycle exists).",
  },
  {
    id: "ia-heap-recog-1",
    type: "multiple_choice",
    concept: "heap",
    concept_tags: ["heap", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Design a class that, given a stream of integers, can at any time return the Kth largest element seen so far. " +
      "Which single pattern is the primary fit?",
    actual_answer: "Heap / Priority Queue",
    rubric:
      "Primary: Heap / Priority Queue (a min-heap of fixed size k; the root is the Kth largest).",
  },
  {
    id: "ia-bt-recog-1",
    type: "multiple_choice",
    concept: "backtracking",
    concept_tags: ["backtracking", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Given a set of DISTINCT candidate numbers and a target, return every unique combination of candidates that sums to the target " +
      "(each number may be reused unlimited times). Which single pattern is the primary fit?",
    actual_answer: "Backtracking",
    rubric:
      "Primary: Backtracking (choose / explore / unchoose; prune when the running sum exceeds target; advance the start index to avoid permutations of the same combination).",
  },
  {
    id: "ia-ms-recog-1",
    type: "multiple_choice",
    concept: "monotonic-stack",
    concept_tags: ["monotonic-stack", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Given daily temperatures, for each day output how many days you must wait until a warmer temperature (0 if none). Target O(n). " +
      "Which single pattern is the primary fit?",
    actual_answer: "Monotonic Stack",
    rubric:
      "Primary: Monotonic Stack (decreasing stack of indices; pop and resolve waiting days when a warmer temp arrives).",
  },
  {
    id: "ia-trie-recog-1",
    type: "multiple_choice",
    concept: "trie",
    concept_tags: ["trie", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Build an autocomplete service over a large dictionary that, given a prefix, must quickly enumerate all stored words starting with that prefix. " +
      "Which single pattern is the primary fit for the core data structure?",
    actual_answer: "Trie (Prefix Tree)",
    rubric:
      "Primary: Trie (prefix tree); each node has child links keyed by character; prefix search walks L nodes then collects the subtree.",
  },
  // Strong-but-stale areas: one confirmation each.
  {
    id: "ia-dp-recog-1",
    type: "multiple_choice",
    concept: "dynamic-programming",
    concept_tags: ["dynamic-programming", "lis", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Given an integer array, return the length of the longest strictly increasing subsequence. " +
      "Which single pattern is the primary fit for the classic O(n^2) solution?",
    actual_answer: "Dynamic Programming",
    rubric:
      "Primary: Dynamic Programming (dp[i] = longest increasing subseq ending at i). Bonus: the O(n log n) refinement uses Binary Search on a patience-sorting tails array.",
  },
  {
    id: "ia-bfs-recog-1",
    type: "multiple_choice",
    concept: "bfs",
    concept_tags: ["bfs", "graph", "pattern-recognition"],
    difficulty: "easy",
    options: PATTERNS,
    text:
      "PROBLEM: Given an unweighted grid with walls, find the length of the shortest path from start to goal moving in 4 directions. " +
      "Which single pattern is the primary fit?",
    actual_answer: "BFS",
    rubric: "Primary: BFS (level-order from the source guarantees the first time you reach the goal is the shortest distance in an unweighted graph).",
  },
  {
    id: "ia-uf-recog-1",
    type: "multiple_choice",
    concept: "union-find",
    concept_tags: ["union-find", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Given n nodes and a list of undirected edges, count the number of connected components. " +
      "Which single pattern gives near-constant amortized per-edge cost?",
    actual_answer: "Union Find",
    rubric:
      "Primary: Union Find (path compression + union by rank); components = number of distinct roots. DFS/BFS also work but Union Find is the streaming/near-O(1) answer.",
  },
  {
    id: "ia-bs-recog-1",
    type: "multiple_choice",
    concept: "binary-search",
    concept_tags: ["binary-search", "pattern-recognition"],
    difficulty: "medium",
    options: PATTERNS,
    text:
      "PROBLEM: Given a rotated sorted array with distinct values, find the index of a target in O(log n). " +
      "Which single pattern is the primary fit?",
    actual_answer: "Binary Search",
    rubric:
      "Primary: Binary Search (modified: at each step one half is sorted; decide which half can contain the target).",
  },
  // ── Key insight (free_text, weak areas) ────────────────────────────────────
  {
    id: "ia-sw-insight-1",
    type: "free_text",
    concept: "sliding-window",
    concept_tags: ["sliding-window", "insight", "complexity"],
    difficulty: "hard",
    hint: "Count how many times each index is visited by the left and right pointers over the whole run.",
    text:
      "KEY INSIGHT: A variable-size sliding window looks like it has two nested loops (an outer expand and an inner contract), yet it runs in O(n). " +
      "Explain precisely why the total work is linear, not quadratic.",
    actual_answer:
      "Each index is added to the window exactly once (right pointer advances n times) and removed at most once (left pointer advances at most n times). " +
      "The inner contraction is amortized: across the entire run the left pointer moves a total of at most n steps, so total pointer movement is O(2n) = O(n), even though any single expansion may trigger several contractions.",
    rubric:
      "Must articulate amortization: each element enters and leaves the window at most once; left+right pointers each traverse the array at most once for O(n) total. Naming 'amortized analysis' is a plus.",
  },
  {
    id: "ia-tp-insight-1",
    type: "free_text",
    concept: "two-pointer",
    concept_tags: ["two-pointer", "insight", "3sum"],
    difficulty: "hard",
    hint: "What ordering property lets you decide which pointer to move without ever backtracking?",
    text:
      "KEY INSIGHT: The optimal 3Sum solution sorts the array first, then fixes one element and runs a two-pointer scan on the remainder. " +
      "Explain why sorting is what unlocks the O(n) inner two-pointer pass, and how you avoid emitting duplicate triplets.",
    actual_answer:
      "Sorting makes the sum monotonic in pointer position: if the pair sum is too small, only moving the left pointer right can increase it; if too large, only moving the right pointer left can decrease it — so each pointer moves inward without backtracking, giving an O(n) inner pass and O(n^2) overall. " +
      "Duplicates are skipped by advancing past equal values for the fixed element and after finding a valid pair, so each distinct triplet is emitted once.",
    rubric:
      "Must explain monotonicity from sorting enabling no-backtrack pointer movement (O(n) inner, O(n^2) total) AND the duplicate-skipping technique.",
  },
  // ── Complexity (free_text, weak areas) ─────────────────────────────────────
  {
    id: "ia-trie-complexity-1",
    type: "free_text",
    concept: "trie",
    concept_tags: ["trie", "complexity"],
    difficulty: "medium",
    hint: "Let L = word length, N = number of words, and consider the alphabet size.",
    text:
      "COMPLEXITY: For a trie storing N words, state the time complexity of (a) inserting one word of length L, (b) searching for an exact word of length L, and (c) the startsWith prefix check for a prefix of length P. Briefly note the space cost.",
    actual_answer:
      "(a) Insert: O(L). (b) Search: O(L). (c) startsWith: O(P). All are independent of N because you walk one character at a time down the tree. " +
      "Space is O(total characters stored) in the worst case, i.e. O(N*L) nodes bounded by the alphabet branching factor; a hash map per node keeps it proportional to the actual distinct prefixes.",
    rubric: "Insert/search O(L), startsWith O(P), independent of N; space ~O(total chars). Full credit needs the L/P bounds and the N-independence.",
  },
  {
    id: "ia-heap-complexity-1",
    type: "free_text",
    concept: "heap",
    concept_tags: ["heap", "complexity", "top-k"],
    difficulty: "medium",
    hint: "Compare a size-k heap over n elements against fully sorting all n.",
    text:
      "COMPLEXITY: For the 'top K largest of n elements' problem solved with a size-k min-heap, give the time and space complexity, and explain when this beats simply sorting all n elements.",
    actual_answer:
      "Time O(n log k), space O(k): iterate all n elements, pushing to a min-heap of size k and popping when it exceeds k (each op O(log k)). " +
      "This beats full sorting (O(n log n)) when k << n, and critically it works on a STREAM where you cannot hold or re-sort all n elements at once.",
    rubric: "O(n log k) time, O(k) space; beats O(n log n) sort when k << n and for streaming/online input.",
  },
  // ── Adversarial "what breaks this?" (free_text) ────────────────────────────
  {
    id: "ia-sw-adversarial-1",
    type: "free_text",
    concept: "sliding-window",
    concept_tags: ["sliding-window", "adversarial", "invariant"],
    difficulty: "hard",
    hint: "What must be true about how the running aggregate changes as the window grows or shrinks?",
    text:
      "WHAT BREAKS IT: The classic sliding-window solution for 'minimum length subarray with sum >= target' expands the window to reach the target, then contracts from the left while still valid. " +
      "What property of the array values does this rely on, and precisely what breaks if negative numbers are allowed?",
    actual_answer:
      "It relies on MONOTONICITY of the running sum: with all non-negative values, growing the window never decreases the sum and shrinking never increases it, so 'contract while still >= target' is safe and each pointer moves forward only. " +
      "With negatives, adding an element can DECREASE the sum and removing one can INCREASE it, so the contract step is no longer valid — you might discard a shorter valid window. The correct approach becomes prefix sums + a monotonic deque or binary search, which is O(n log n) or O(n).",
    rubric:
      "Must identify the non-negativity / monotonic-sum invariant and that negatives break the safe-contraction step; bonus for naming prefix-sum + monotonic deque as the fix.",
  },
  {
    id: "ia-tp-adversarial-1",
    type: "free_text",
    concept: "two-pointer",
    concept_tags: ["two-pointer", "adversarial"],
    difficulty: "medium",
    hint: "Think about the precondition that makes moving a pointer a safe, irreversible decision.",
    text:
      "WHAT BREAKS IT: Opposite-direction two pointers find a pair summing to a target in O(n) on a SORTED array. " +
      "Explain why the same technique fails on an unsorted array, and what the cost is of making it work.",
    actual_answer:
      "The technique depends on sorted order to guarantee monotonicity: when the current sum is too small you can safely discard the left element (nothing smaller remains), and when too large discard the right. On an unsorted array that guarantee is gone — a discarded element might have been part of the answer, so moving a pointer can skip valid pairs. " +
      "To fix it you either sort first (O(n log n), which then dominates the O(n) scan) or switch to a hash-set one-pass approach (O(n) time, O(n) space).",
    rubric:
      "Must explain that sorting provides the monotonic guarantee enabling safe pointer discards; unsorted breaks it; fix is sort O(n log n) or hash-set O(n) time / O(n) space.",
  },
];

function main() {
  const db = getDb();

  const subject = db.prepare("SELECT id, title FROM subjects WHERE id = ?").get(SUBJECT_ID) as
    | { id: number; title: string }
    | undefined;
  if (!subject) throw new Error(`Subject ${SUBJECT_ID} not found`);

  const assessmentContent = {
    type: "initial_assessment",
    instruction:
      "This is a calibration assessment — no teaching yet. For each problem, identify the primary algorithmic PATTERN and articulate the APPROACH; you are not asked to write full code. " +
      "Answer honestly: if you are unsure, say so. Your answers replace the stale 2022-2023 comfort map from your algorithms repo and decide exactly what the first lessons teach and how fast they move. " +
      "The assessment is deliberately weighted toward your weaker patterns (sliding window, two pointer, heap, backtracking, monotonic stack, trie).",
    questions,
  };

  // Validate against the real schema gate BEFORE writing.
  const check = validateAssessmentContent(assessmentContent);
  if (!check.valid) {
    console.error("Assessment content FAILED validation:");
    for (const e of check.errors) console.error("  -", e);
    process.exit(1);
  }
  console.log(`Assessment content valid. ${questions.length} questions.`);

  const title = `Initial Assessment: ${subject.title}`;
  const description =
    "Calibration assessment (pattern recognition + approach articulation, no implementation) to produce a fresh knowledge map " +
    "before teaching begins. Weighted toward your weak patterns. Your answers shape every subsequent lesson.";
  const goals = JSON.stringify([
    "Produce a fresh comfort map to replace stale 2022-2023 repo data",
    "Confirm weak patterns (sliding window, two pointer, heap, backtracking, monotonic stack, trie)",
    "Confirm which strong-but-stale patterns need speed reactivation",
  ]);
  const tags = JSON.stringify(["initial-assessment", "calibration", "pattern-recognition"]);

  const tx = db.transaction(() => {
    // Idempotency: remove any prior seq=0 lesson for this subject + its activities.
    const prior = db
      .prepare("SELECT id FROM lessons WHERE subject_id = ? AND sequence_number = 0")
      .all(SUBJECT_ID) as Array<{ id: number }>;
    for (const p of prior) {
      db.prepare("DELETE FROM lesson_activities WHERE lesson_id = ?").run(p.id);
      db.prepare("DELETE FROM lessons WHERE id = ?").run(p.id);
      console.log(`Removed prior seq=0 lesson ${p.id}`);
    }

    const res = db
      .prepare(
        `INSERT INTO lessons
           (subject_id, title, description, status, sequence_number, goals, tags,
            generated_by, generator_version)
         VALUES (?, ?, ?, 'queued', 0, ?, ?, 'cc-handauthored/algo-interview', '1.0.0')`
      )
      .run(SUBJECT_ID, title, description, goals, tags);
    const lessonId = Number(res.lastInsertRowid);

    db.prepare(
      `INSERT INTO lesson_activities
         (lesson_id, activity_type, is_core, sequence_order, title, content)
       VALUES (?, 'assessment', 1, 1, ?, ?)`
    ).run(lessonId, "Initial Assessment: Map Your Pattern Knowledge", JSON.stringify(assessmentContent));

    return lessonId;
  });

  const lessonId = tx();

  // Summary + coverage report.
  const byConcept = new Map<string, number>();
  for (const q of questions) byConcept.set(q.concept ?? "?", (byConcept.get(q.concept ?? "?") ?? 0) + 1);
  console.log(`\nCreated initial assessment lesson id=${lessonId} (subject ${SUBJECT_ID}, seq 0, status queued).`);
  console.log(`Activity: assessment, ${questions.length} questions.`);
  console.log("Per-concept coverage:");
  for (const [c, n] of [...byConcept.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(20)} ${n}`);
  }
  const mc = questions.filter((q) => q.type === "multiple_choice").length;
  console.log(`\nTypes: ${mc} multiple_choice (pattern recognition), ${questions.length - mc} free_text (insight/complexity/adversarial).`);

  closeDb();
}

main();
