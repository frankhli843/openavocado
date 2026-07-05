#!/usr/bin/env tsx
/**
 * P4.1 — Lesson 6 of the "Coding Interview Mastery" subject (id 9):
 * "Backtracking: Choose, Explore, Un-choose — Walk the Decision Tree".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in
 * this env). Weak-pattern-first: Backtracking has only ~1 imported evidence row
 * (two problems), so it gets full teaching.
 *
 * Structure mirrors the Trie / Heap / Two Pointer / Sliding Window lessons:
 * top-level 2-host overview audio + orientation visual, two collapsed
 * lesson_parts (subsets template; permutations + pruning) each with a bespoke
 * approved artifact + per-part audio synced visual + scaffolded code + mixed
 * practice (incl. pattern_recognition), a final integrator practice_code
 * (Combination Sum, LeetCode 39), an adaptive MC + freeform assessment, and a
 * timed code_drill (combinations C(n,k), LeetCode 77). Cue timings are
 * provisional and rescaled to the real generated audio duration by
 * rescale-backtracking-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-backtracking-overview-map, algo-backtracking-tree, algo-backtracking-permutations
 *
 * Idempotent: replaces any prior seq=5 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-backtracking.ts
 */

import { getDb, closeDb } from "../src/db/connection";
import {
  validateLessonPartContent,
  validatePracticeCodeContent,
  validateAssessmentContent,
  validateAudioSyncedVisualContent,
  validateNextLessonDiagnostics,
  validateCodeDrillContent,
} from "../src/lib/lesson-content/schema";
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/backtracking-audio";

const SUBJECT_ID = 9;
const SEQ = 5;

const A_OVERVIEW = "algo-backtracking-overview-map";
const A_TREE = "algo-backtracking-tree";
const A_PERM = "algo-backtracking-permutations";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "backtracking-orientation",
    title: "Backtracking: walk the decision tree, take back each move",
    motif: "choose-explore-unchoose",
    description:
      "Orientation for the whole pattern: 'find all the ways' has a variable, input-dependent number of nested loops, so you cannot write them out. Backtracking is a depth-first walk of a tree of choices where every root-to-leaf path is one candidate answer. The three-beat template is choose (push onto a shared path), explore (recurse), un-choose (pop it back off); record a copy of the path at a complete state, and prune any branch you can already prove is doomed. A start index prevents duplicate subsets; a used-array lets permutations reuse positions in any order.",
    panels: [
      {
        id: "cost",
        title: "Cost collapse",
        kind: "flow" as const,
        description: "Why the pattern exists: generating every arrangement then filtering wastes doomed subtrees; rejecting bad partials early deletes them.",
        data: [
          { label: "generate all, then filter", value: "walk every leaf", role: "input" as const },
          { label: "reject bad partial states early", value: "prune whole subtrees", role: "process" as const },
          { label: "walk only live branches", value: "work ≈ number of answers", role: "output" as const },
        ],
      },
      {
        id: "jobs",
        title: "Four fingerprints",
        kind: "cards" as const,
        description: "Subsets/combinations, permutations/arrangements, constraint puzzles, and target-sum/partition.",
        data: [
          { label: "subsets / combinations", value: "start index, no duplicates", role: "context" as const },
          { label: "permutations", value: "used-array, order matters", role: "context" as const },
          { label: "constraint puzzles", value: "prune illegal partials", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 170, label: "The trigger", headline: "\"Find all the ways\" needs a variable loop count", narration: "When the number of nested loops depends on the input, you cannot write them out; backtracking enumerates every choice sequence instead.", receive: "a find-all-configurations problem", transform: "recognize the variable depth", pass: "a reason to recurse" },
    { start: 170, end: 350, label: "A tree of choices", headline: "Every root-to-leaf path is one answer", narration: "Picture a tree where each branch is a choice; a depth-first walk visits every candidate answer.", receive: "the set of choices", transform: "lay them out as a tree", pass: "a space to walk" },
    { start: 350, end: 560, label: "Three beats", headline: "Choose, explore, un-choose", narration: "Push a choice onto a shared path, recurse to explore, then pop it back off so the next branch starts clean.", receive: "a shared path", transform: "mutate then restore", pass: "a clean walk" },
    { start: 560, end: 760, label: "Record a copy", headline: "Snapshot at a complete state", narration: "At a complete answer, save a copy of the path, never the live list, or later pops corrupt every saved answer.", receive: "a full candidate", transform: "snapshot the path", pass: "a durable answer" },
    { start: 760, end: 960, label: "Prune early", headline: "Delete doomed subtrees", narration: "Reject a partial state the instant you can prove it is hopeless; an early rejection erases the largest subtrees.", receive: "a partial state", transform: "test the constraint early", pass: "a smaller search" },
    { start: 960, end: 1120, label: "Index or marker", headline: "Start index vs used-array", narration: "A start index prevents duplicate subsets; a used-array lets permutations place any free element in any order.", receive: "a problem's ordering rule", transform: "choose the guard", pass: "the right skeleton" },
    { start: 1120, end: 1200, label: "When it fails", headline: "Exponential; DP may fold it", narration: "The tree is often exponential or factorial; if you need one optimum or a count, dynamic programming can fold it to a table.", receive: "a candidate problem", transform: "check for enumerate-vs-optimize", pass: "a go / no-go decision" },
  ],
};

// ── Reading builder helper ────────────────────────────────────────────────────
const backtrackingComplexity = {
  type: "formula",
  latex: "\\text{subsets } O(2^{n}) \\qquad \\text{permutations } O(n!)",
  plain_english:
    "Backtracking walks a tree whose leaves are the answers, so its cost tracks how many answers exist: there are 2 to the n subsets of n elements and n factorial permutations. The recursion depth is only the length of one root-to-leaf path — linear in n — but the total number of nodes visited is exponential, which is why backtracking is for enumeration, not for folding a space down to a single optimum.",
  variables: [
    { symbol: "n", meaning: "the number of elements you are choosing from" },
    { symbol: "2^{n}", meaning: "the number of subsets — each element is independently in or out" },
    { symbol: "n!", meaning: "the number of permutations — orderings of all n elements" },
  ],
};

// ── Part 1: the choose-explore-unchoose template via subsets ──────────────────
const part1 = {
  part_id: "backtracking-part-1-subsets",
  reading: {
    blocks: [
      { type: "heading", text: "The template: choose, explore, un-choose — every node is an answer" },
      {
        type: "paragraph",
        text:
          "Backtracking is a depth-first walk of a tree of choices, and subsets are the cleanest place to learn its skeleton. You carry one shared list called the path, holding the choices made so far. The three beats repeat at every node: choose (append an element to the path), explore (recurse one level deeper with that choice in place), and un-choose (pop the element back off so the path is exactly what it was before). For subsets, every node you enter is itself a valid subset, so you record a copy of the path the instant you arrive — there is no filtering. The loop runs over the elements from a start index onward, and that start index is what stops duplicates: because you only ever look forward, each subset is built in increasing position order and produced exactly once.",
      },
      {
        type: "definition",
        term: "Un-choose (the backtrack)",
        definition:
          "Undoing the mutation you made on the way down — popping the element you appended — so that when the recursion returns, the shared path is restored and the next branch starts from a clean state. Forgetting it lets stale choices leak into later branches.",
      },
      {
        type: "example",
        body:
          "subsets([1,2,3]): enter with path [] and record {}. Choose 1 → record {1}. Choose 2 → record {1,2}. Choose 3 → record {1,2,3}; nothing lies past 3, so un-choose 3 then un-choose 2, and the path pops back to [1]. Now choose 3 (the start index skipped 2) → record {1,3}. Un-choose back to [], choose 2 → {2}, choose 3 → {2,3}, unwind, choose 3 → {3}. Eight subsets, and the path is empty at the end because every push had a matching pop.",
      },
      {
        type: "callout",
        text:
          "The two classic bugs: (1) forgetting to un-choose, so the path never shrinks and answers grow corrupt; (2) recording the live path instead of a copy, so later mutations rewrite every saved answer — usually leaving them all empty. Copy on record, pop on return.",
      },
      backtrackingComplexity,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_TREE,
      scene: {
        scene_id: "backtracking-subsets-scene",
        title: "The path grows on choose and shrinks on un-choose",
        motif: "push-then-matching-pop",
        description: "The full walk of subsets([1,2,3]): each choose pushes an element and records a copy of the path, each un-choose pops it back, and the path returns to empty at the end — the start index makes every subset appear exactly once.",
        panels: [
          {
            id: "beats",
            title: "The three beats",
            kind: "ledger" as const,
            description: "What choose, explore, and un-choose each do to the shared path.",
            data: [
              { label: "choose", value: "append the element", role: "input" as const },
              { label: "explore", value: "recurse deeper", role: "process" as const },
              { label: "un-choose", value: "pop it back off", role: "output" as const },
            ],
          },
          {
            id: "why",
            title: "Why it is correct",
            kind: "matrix" as const,
            description: "Recording and the start index.",
            data: [
              { label: "record a copy", value: "at every node", role: "context" as const },
              { label: "start index", value: "only look forward → no duplicates", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "The path", headline: "One shared list of choices", narration: "You carry a single path list holding the choices made so far; every node is a subset.", receive: "an empty path", transform: "hold choices so far", pass: "a walkable state" },
        { start: 30, end: 62, label: "Choose", headline: "Append an element", narration: "Choose pushes the current element onto the path, then recurses one level deeper.", receive: "the current element", transform: "push and recurse", pass: "a longer path" },
        { start: 62, end: 95, label: "Record a copy", headline: "Snapshot at every node", narration: "Every node is a valid subset, so record a copy of the path — never the live list.", receive: "the current path", transform: "snapshot it", pass: "a saved subset" },
        { start: 95, end: 128, label: "Un-choose", headline: "Pop it back off", narration: "When the branch is done, pop the element so the path is restored for the next branch.", receive: "a finished branch", transform: "pop the element", pass: "a clean path" },
        { start: 128, end: 150, label: "Start index", headline: "Only look forward", narration: "Looping from a start index forward is why each subset appears once, in increasing order.", receive: "the remaining elements", transform: "look only forward", pass: "no duplicates" },
        { start: 150, end: 165, label: "Balanced", headline: "Every push had a pop", narration: "At the end the path is empty again — a matching pop for every push means no state leaked.", receive: "the finished walk", transform: "verify balance", pass: "eight clean subsets" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk subsets([1,2,3]). Watch the shared path grow on each choose and shrink on each un-choose, a copy get recorded at every node, and the path return to empty at the end. Note how the start index makes {1,3} appear but never {3,1}.",
    params: { artifact_slug: A_TREE, min_height: 360 },
  },
  code: {
    prompt:
      "Return every subset of nums using the backtracking template. Every node of the walk is a subset, so record a COPY of the path on entry, then loop from a start index, choosing each element (append), exploring (recurse with start = i+1), and un-choosing (pop). Fill in the TODO body of backtrack.",
    starter_code:
      "def subsets(nums):\n    res = []\n\n    def backtrack(start, path):\n        # TODO:\n        #   1. record a COPY of path (path[:]) — every node is a valid subset\n        #   2. for i in range(start, len(nums)):\n        #        choose  -> path.append(nums[i])\n        #        explore -> backtrack(i + 1, path)\n        #        un-choose -> path.pop()\n        pass\n\n    backtrack(0, [])\n    return res\n",
    constraints: [
      "Record a COPY of the path (path[:]), never the live list, or later pops corrupt every saved subset.",
      "Loop from a start index and recurse with i + 1 so each subset is produced once, in increasing order.",
      "Always pop after recursing (un-choose) so the shared path is restored for the next branch.",
    ],
    walkthrough: {
      title: "From an empty path to all 2^n subsets",
      steps: [
        { title: "Record on entry", detail: "Every node of the walk is a valid subset, so append a copy of the current path to the results the moment you enter backtrack.", input: "start, path", output: "the current subset saved" },
        { title: "Choose, explore, un-choose", detail: "For each element from start onward: append it, recurse with start = i + 1, then pop it. The pop is the backtrack that restores the path.", input: "the remaining elements", output: "every subset that extends this path" },
        { title: "Why start index", detail: "Recursing with i + 1 means you never look back, so {1,3} is generated but {3,1} never is — each subset appears exactly once.", input: "the start index", output: "no duplicate subsets" },
      ],
    },
    io_examples: [
      { label: "three elements", input: "nums = [1,2,3]", expected_output: "[[], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]]", explanation: "Eight subsets = 2^3, each recorded as the path is walked depth-first." },
      { label: "empty", input: "nums = []", expected_output: "[[]]", explanation: "The empty set is the only subset; it is recorded on the first entry." },
      { label: "singleton", input: "nums = [0]", expected_output: "[[], [0]]", explanation: "Record {}, then choose 0 and record {0}." },
    ],
    visualization: {
      title: "record a copy → choose → explore → un-choose",
      description: "The path grows and shrinks; the start index keeps each subset unique.",
      items: [
        { label: "record path[:]", value: "every node is a subset", role: "input" },
        { label: "choose i, recurse i+1", value: "walk forward only", role: "process" },
        { label: "pop (un-choose)", value: "restore the path", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The template spelled out",
        code:
          "def subsets(nums):\n    res = []\n    def backtrack(start, path):\n        res.append(path[:])\n        for i in range(start, len(nums)):\n            path.append(nums[i])\n            backtrack(i + 1, path)\n            path.pop()\n    backtrack(0, [])\n    return res",
        explanation: "res.append(path[:]) snapshots every node; the append/pop pair is choose/un-choose; i + 1 forbids looking back.",
      },
      {
        label: "concise",
        title: "Iterative doubling",
        code:
          "def subsets(nums):\n    res = [[]]\n    for x in nums:\n        res += [sub + [x] for sub in res]\n    return res",
        explanation: "Every new element doubles the answer set by adding itself to all existing subsets — the same 2^n structure without recursion.",
      },
    ],
    hints: [
      { level: 1, text: "Every node of the walk is a subset, so the FIRST thing backtrack does is res.append(path[:])." },
      { level: 2, text: "Loop for i in range(start, len(nums)); the start parameter is what stops duplicates." },
      { level: 3, text: "choose = path.append(nums[i]); explore = backtrack(i + 1, path); un-choose = path.pop()." },
      { level: 4, text: "Recurse with i + 1, NOT start + 1 — you advance past the element you just chose." },
      { level: 5, text: "Append path[:] (a copy), not path itself, or every saved subset will be mutated by later pops." },
    ],
    tests: [
      { id: "t_three", description: "all subsets of [1,2,3]", assert: "assert subsets([1,2,3]) == [[],[1],[1,2],[1,2,3],[1,3],[2],[2,3],[3]]" },
      { id: "t_empty", description: "empty list yields just the empty set", assert: "assert subsets([]) == [[]]" },
      { id: "t_single", description: "singleton", assert: "assert subsets([0]) == [[],[0]]" },
    ],
    hidden_tests: [
      { id: "h_count", description: "n elements give 2^n subsets", assert: "assert len(subsets([1,2,3,4])) == 16" },
      { id: "h_copies", description: "recorded subsets are independent copies", assert: "r = subsets([1,2]); r[0].append(99); assert subsets([1,2])[0] == []" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "bp1-so-1",
        type: "select_one",
        prompt: "What are the three beats of the backtracking template?",
        concept: "backtracking",
        difficulty: "easy",
        choices: [
          "Choose (push a choice), explore (recurse), un-choose (pop it back)",
          "Sort, binary search, return",
          "Hash, look up, collide",
          "Divide, conquer, merge",
        ],
        correct_index: 0,
        explanation: "Choose mutates the shared path, explore recurses, un-choose restores the path for the next branch.",
      },
      {
        id: "bp1-sa-multi",
        type: "select_all",
        prompt: "Which statements about the subsets walk are true?",
        concept: "backtracking",
        difficulty: "medium",
        choices: [
          "Every node visited is itself a valid subset, so you record on entry",
          "A start index makes each subset appear exactly once",
          "You must record a copy of the path, not the live list",
          "The number of subsets grows linearly with n",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Subsets grow as 2^n (exponential), not linearly; the other three are the core template facts.",
      },
      {
        id: "bp1-sa-none",
        type: "select_all",
        prompt: "In subsets([1,2,3]) with the start-index template, which of these appear in the output? (If none, select none.)",
        concept: "backtracking",
        difficulty: "hard",
        choices: [
          "[3, 1]",
          "[2, 1]",
          "[3, 2]",
        ],
        correct_indices: [],
        explanation: "None — the start index only looks forward, so subsets are built in increasing order; [1,3], [1,2], [2,3] appear, but their reverses never do.",
      },
      {
        id: "bp1-order",
        type: "ordering",
        prompt: "Order the operations inside one iteration of the subsets loop.",
        concept: "backtracking",
        difficulty: "medium",
        items: [
          "Append the current element to the path (choose)",
          "Recurse with the next start index (explore)",
          "Pop the element back off (un-choose)",
          "Move to the next element in the loop",
        ],
        correct_order: [
          "Append the current element to the path (choose)",
          "Recurse with the next start index (explore)",
          "Pop the element back off (un-choose)",
          "Move to the next element in the loop",
        ],
      },
      {
        id: "bp1-pattern",
        type: "pattern_recognition",
        prompt: "\"Given a list of distinct numbers, return every possible subset (the power set).\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Backtracking", "Bitmask enumeration", "Two Pointer", "Binary Search", "Sliding Window"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Enumerating the power set is the backtracking fingerprint; a bitmask over 0..2^n−1 is a valid secondary for small n.",
      },
      {
        id: "bp1-written",
        type: "written",
        prompt: "Explain why you must record a COPY of the path when saving a subset, using what happens on later pops.",
        concept: "backtracking",
        difficulty: "hard",
        actual_answer:
          "The path is a single shared list that the whole recursion mutates as it walks — every choose appends to it and every un-choose pops from it. If you save that same list object into your results, you have only saved a reference to the live path, not its current contents. As the recursion continues it keeps popping and pushing that very list, so the thing you saved changes underneath you; by the time the walk unwinds to the end, the path has been emptied back out, and every reference you stored now points at the same empty list. Saving path[:] (a shallow copy) freezes the contents at that instant, so later mutations of the path cannot touch it. Copy on record is what makes each saved subset an independent, durable snapshot.",
        rubric:
          "Full credit: the path is one shared mutated list; saving it stores a reference that later pops/pushes change; path[:] freezes a snapshot so each answer is independent. Partial: says 'copy it' without explaining the aliasing. Low: vague.",
      },
    ],
  },
};

// ── Part 2: permutations + pruning (used-array) ───────────────────────────────
const part2 = {
  part_id: "backtracking-part-2-permutations",
  reading: {
    blocks: [
      { type: "heading", text: "Permutations: swap the start index for a used-array, and prune when constraints appear" },
      {
        type: "paragraph",
        text:
          "Permutations use every element exactly once and care about order, so one-two and two-one are different answers. That means you cannot use the subsets trick of a start index that only looks forward — you must be able to place a lower-positioned element after a higher one. Instead you track which elements are already in the path with a boolean used-array, one flag per element, and the loop at each node skips any element whose flag is set. The three beats become: choose (set the flag and append the element), explore (recurse), un-choose (pop the element and clear the flag). Clearing the flag on the way back up is what frees the element to be used again in a different branch. The base case is a full-length path, at which point you record a copy. When a problem adds constraints — a chessboard where queens must not attack, a board that must stay valid — you also prune: before recursing into a choice, test whether it keeps the partial state legal, and if not, skip that branch entirely so you never walk the doomed subtree beneath it.",
      },
      {
        type: "definition",
        term: "Pruning",
        definition:
          "Cutting off an entire subtree the instant you can prove no valid answer lives inside it, by testing a constraint on the partial state before you recurse. Checking early rather than at the leaves is what makes the difference between finishing and not, because an early rejection deletes the largest subtrees.",
      },
      {
        type: "example",
        body:
          "permutations([1,2,3]): choose 1 (used[1]=true) → choose 2 → choose 3 → path is full, record [1,2,3]. Un-choose 3 (pop, clear used[3]); nothing else free, un-choose 2. Now 3 is free → choose 3 → choose 2 → record [1,3,2]. Unwind fully, clearing every flag, then start with 2, then with 3. Six permutations, each flag set on the way down and cleared on the way back up.",
      },
      {
        type: "callout",
        text:
          "Two things separate permutations from subsets. First, a used-array replaces the start index because order matters. Second, un-choose must clear the flag as well as pop, or an element stays 'used' forever and later branches silently lose it.",
      },
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_PERM,
      scene: {
        scene_id: "backtracking-permutations-scene",
        title: "Set the flag, explore, clear the flag",
        motif: "used-array-guards-reuse",
        description: "The walk of permutations([1,2,3]) with a used-array: each choose sets a flag and pushes, each un-choose pops and clears the flag, and there is no start index — every free element may be placed at every position, so both [1,2,3] and [1,3,2] appear.",
        panels: [
          {
            id: "guard",
            title: "The guard",
            kind: "matrix" as const,
            description: "How the used-array differs from a start index.",
            data: [
              { label: "start index (subsets)", value: "only look forward", role: "context" as const },
              { label: "used-array (permutations)", value: "any free element, any order", role: "input" as const },
            ],
          },
          {
            id: "beats",
            title: "The three beats",
            kind: "ledger" as const,
            description: "Choose and un-choose now touch the flag too.",
            data: [
              { label: "choose", value: "set used, append", role: "input" as const },
              { label: "explore", value: "recurse", role: "process" as const },
              { label: "un-choose", value: "pop, clear used", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Order matters", headline: "1-2 and 2-1 are different", narration: "Permutations use every element once and care about order, so you cannot use a forward-only start index.", receive: "the full element list", transform: "note order matters", pass: "a need for a different guard" },
        { start: 30, end: 62, label: "Used-array", headline: "One flag per element", narration: "A boolean used-array tracks which elements are already in the path; the loop skips any that are used.", receive: "the elements", transform: "mark which are placed", pass: "the free choices" },
        { start: 62, end: 95, label: "Choose", headline: "Set the flag, push", narration: "To choose an element, set its used flag and append it, then recurse to fill the next position.", receive: "a free element", transform: "set used and push", pass: "a longer arrangement" },
        { start: 95, end: 128, label: "Record", headline: "Full length is an answer", narration: "When the path length equals the input length, you have a full permutation, so record a copy.", receive: "a full path", transform: "snapshot it", pass: "a saved permutation" },
        { start: 128, end: 150, label: "Un-choose", headline: "Pop and clear the flag", narration: "Un-choose pops the element and clears its flag, freeing it for a different branch.", receive: "a finished branch", transform: "pop and clear used", pass: "the element freed again" },
        { start: 150, end: 165, label: "Prune", headline: "Skip illegal branches early", narration: "With constraints like N-Queens, test the partial state before recursing and skip doomed branches — deleting whole subtrees.", receive: "a constrained choice", transform: "test before recursing", pass: "a pruned search" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk permutations([1,2,3]). Watch each choose set an element's used flag and push it, and each un-choose pop it and clear the flag. Because there is no start index, both [1,2,3] and [1,3,2] are produced — order matters here.",
    params: { artifact_slug: A_PERM, min_height: 360 },
  },
  code: {
    prompt:
      "Return every permutation of nums (all distinct). Order matters, so track placement with a boolean used-array instead of a start index. Fill in the TODO body of backtrack: base case is a full-length path (record a copy); otherwise loop over every index, skip used ones, then set-used + append (choose), recurse (explore), pop + clear-used (un-choose).",
    starter_code:
      "def permutations(nums):\n    res = []\n    used = [False] * len(nums)\n\n    def backtrack(path):\n        # TODO:\n        #   if len(path) == len(nums): record a COPY of path and return\n        #   for i in range(len(nums)):\n        #        if used[i]: continue\n        #        choose    -> used[i] = True; path.append(nums[i])\n        #        explore   -> backtrack(path)\n        #        un-choose -> path.pop(); used[i] = False\n        pass\n\n    backtrack([])\n    return res\n",
    constraints: [
      "Use a boolean used-array, NOT a start index — order matters, so every free element may go in every position.",
      "un-choose must BOTH pop the element AND clear its used flag, or the element stays used forever.",
      "Record a copy of the path only when its length equals len(nums) (a full arrangement).",
    ],
    walkthrough: {
      title: "The used-array template for arrangements",
      steps: [
        { title: "Base case: full length", detail: "When the path has one element per input, it is a complete permutation, so append a copy and return.", input: "a full path", output: "one permutation saved" },
        { title: "Loop over all, skip used", detail: "Unlike subsets, loop over every index and skip any whose used flag is set; there is no forward-only restriction because order matters.", input: "all indices", output: "the free choices" },
        { title: "Choose / explore / un-choose with the flag", detail: "Set used and append (choose), recurse (explore), then pop and clear used (un-choose). Clearing the flag frees the element for other branches.", input: "a free element", output: "every arrangement extending the path" },
      ],
    },
    io_examples: [
      { label: "three elements", input: "nums = [1,2,3]", expected_output: "[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]", explanation: "3! = 6 permutations, in the order the walk produces them." },
      { label: "singleton", input: "nums = [1]", expected_output: "[[1]]", explanation: "One element, one arrangement." },
      { label: "count", input: "nums = [1,2,3,4]", expected_output: "24 permutations", explanation: "4! = 24; every full-length path is a valid answer." },
    ],
    visualization: {
      title: "set used + push → recurse → pop + clear used",
      description: "The used-array is the only structural difference from subsets.",
      items: [
        { label: "skip used, choose free", value: "used[i] guards reuse", role: "input" },
        { label: "recurse to next position", value: "explore", role: "process" },
        { label: "pop AND clear used", value: "restore state", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The used-array template",
        code:
          "def permutations(nums):\n    res = []\n    used = [False] * len(nums)\n    def backtrack(path):\n        if len(path) == len(nums):\n            res.append(path[:])\n            return\n        for i in range(len(nums)):\n            if used[i]:\n                continue\n            used[i] = True\n            path.append(nums[i])\n            backtrack(path)\n            path.pop()\n            used[i] = False\n    backtrack([])\n    return res",
        explanation: "The append/pop pair is choose/un-choose; the used[i] flag toggled alongside it is what enforces 'each element once'.",
      },
      {
        label: "concise",
        title: "Swap-in-place variant",
        code:
          "def permutations(nums):\n    res = []\n    def backtrack(k):\n        if k == len(nums):\n            res.append(nums[:])\n            return\n        for i in range(k, len(nums)):\n            nums[k], nums[i] = nums[i], nums[k]\n            backtrack(k + 1)\n            nums[k], nums[i] = nums[i], nums[k]\n    backtrack(0)\n    return res",
        explanation: "Swapping element i into position k avoids a separate used-array; the second swap is the un-choose that restores order.",
      },
    ],
    hints: [
      { level: 1, text: "Track placement with used = [False] * len(nums); loop over ALL indices, not from a start index." },
      { level: 2, text: "Base case: if len(path) == len(nums): res.append(path[:]); return." },
      { level: 3, text: "Skip already-placed elements: if used[i]: continue." },
      { level: 4, text: "choose = used[i] = True; path.append(nums[i]). un-choose = path.pop(); used[i] = False." },
      { level: 5, text: "If you forget to reset used[i] = False in the un-choose, that element is lost for every later branch." },
    ],
    tests: [
      { id: "t_three", description: "all permutations of [1,2,3]", assert: "assert permutations([1,2,3]) == [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]" },
      { id: "t_single", description: "singleton", assert: "assert permutations([1]) == [[1]]" },
      { id: "t_count", description: "n! permutations", assert: "assert len(permutations([1,2,3,4])) == 24" },
    ],
    hidden_tests: [
      { id: "h_distinct", description: "all permutations are distinct", assert: "p = permutations([1,2,3]); assert len(set(tuple(x) for x in p)) == 6" },
      { id: "h_uses_all", description: "each permutation uses every element", assert: "assert all(sorted(x) == [1,2,3] for x in permutations([1,2,3]))" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "bp2-so-1",
        type: "select_one",
        prompt: "Why do permutations use a used-array instead of the subsets' start index?",
        concept: "backtracking",
        difficulty: "easy",
        choices: [
          "Order matters, so you must be able to place any free element at any position",
          "A used-array is faster than a start index",
          "Start indices only work for even-length inputs",
          "Permutations do not need to avoid reusing elements",
        ],
        correct_index: 0,
        explanation: "A start index forbids looking back, but permutations need both 1-then-2 and 2-then-1, so a used-array guards reuse instead.",
      },
      {
        id: "bp2-sa-multi",
        type: "select_all",
        prompt: "Which statements about the permutations walk are true?",
        concept: "backtracking",
        difficulty: "medium",
        choices: [
          "The base case records a copy when the path is full length",
          "Un-choose must clear the used flag as well as pop the element",
          "Pruning deletes doomed subtrees when a constraint is present",
          "A start index would produce the same set of permutations",
        ],
        correct_indices: [0, 1, 2],
        explanation: "A start index would only produce combinations (order ignored), not all orderings — so the last statement is false.",
      },
      {
        id: "bp2-sa-none",
        type: "select_all",
        prompt: "In plain permutations of [1,2,3] with no extra constraints, which branches get PRUNED before reaching a full-length leaf? (If none, select none.)",
        concept: "backtracking",
        difficulty: "hard",
        choices: [
          "Branches starting with 1",
          "Branches starting with 2",
          "Branches starting with 3",
        ],
        correct_indices: [],
        explanation: "None — with no constraints every full-length path is valid, so nothing is pruned; pruning only appears once a constraint (like N-Queens attacks) can reject a partial state.",
      },
      {
        id: "bp2-order",
        type: "ordering",
        prompt: "Order the operations for choosing one element in the permutations walk.",
        concept: "backtracking",
        difficulty: "medium",
        items: [
          "Skip the element if its used flag is set",
          "Set used[i] = True and append the element (choose)",
          "Recurse to fill the next position (explore)",
          "Pop the element and clear used[i] (un-choose)",
        ],
        correct_order: [
          "Skip the element if its used flag is set",
          "Set used[i] = True and append the element (choose)",
          "Recurse to fill the next position (explore)",
          "Pop the element and clear used[i] (un-choose)",
        ],
      },
      {
        id: "bp2-pattern",
        type: "pattern_recognition",
        prompt: "\"Place 8 queens on a chessboard so that no two attack each other; return the number of valid boards.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Backtracking", "Constraint pruning", "Dynamic Programming", "Two Pointer", "Binary Search"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "N-Queens is the classic backtracking problem; the essential optimization is pruning attacked squares before recursing, so constraint pruning is the natural secondary.",
      },
      {
        id: "bp2-written",
        type: "written",
        prompt: "Explain why pruning a bad partial state early is far more valuable than filtering full answers at the end.",
        concept: "backtracking",
        difficulty: "hard",
        actual_answer:
          "The two approaches run the same validity test, but the timing changes the cost by orders of magnitude. If you only check validity at the leaves, then a single bad choice made near the root still forces you to walk its entire subtree — every leaf beneath it — before you finally discover the whole branch was doomed from the first move. If instead you test the constraint the instant you make that choice, you delete the entire subtree from the search in one step and never enter it. Because subtrees near the top of the tree are the largest, an early rejection erases the most work: one prune high up can eliminate a colossal fraction of the total exploration. That is why experienced solvers push every constraint check as high in the recursion as it can legally go — the earlier you can prove a partial state is hopeless, the bigger the subtree you avoid walking.",
        rubric:
          "Full credit: same test, but early rejection deletes a whole subtree instead of walking it to the leaves; subtrees near the root are largest so early pruning saves the most; push checks as high as legal. Partial: says early is better without the subtree-size reasoning. Low: vague.",
      },
    ],
  },
};

// ── Final integrator practice_code: Combination Sum (LeetCode 39) ─────────────
const finalCode = {
  prompt:
    "Integrator: return every combination of candidates that sums to target, where a number may be reused any number of times. This combines the whole pattern — a start index to avoid duplicate combinations, a running 'remaining' amount for the base case, and a prune. Sort candidates first, then fill in the TODO body of backtrack: base case remaining == 0 records a copy; otherwise loop from start, BREAK when a candidate exceeds remaining (all later ones are bigger too), and recurse with start = i (reuse allowed).",
  starter_code:
    "def combination_sum(candidates, target):\n    res = []\n    cand = sorted(candidates)\n\n    def backtrack(start, path, remaining):\n        # TODO:\n        #   if remaining == 0: record a COPY of path and return\n        #   for i in range(start, len(cand)):\n        #        if cand[i] > remaining: break        # prune: sorted, so rest are bigger\n        #        choose    -> path.append(cand[i])\n        #        explore   -> backtrack(i, path, remaining - cand[i])   # i, not i+1: reuse\n        #        un-choose -> path.pop()\n        pass\n\n    backtrack(0, [], target)\n    return res\n",
  constraints: [
    "Sort candidates first so the prune 'if cand[i] > remaining: break' is valid — every later candidate is at least as large.",
    "Recurse with start = i (not i + 1) so a candidate may be reused; the start index still forbids going backward, which kills duplicate combinations.",
    "Record a copy of the path only when remaining hits exactly 0.",
  ],
  walkthrough: {
    title: "Start index + remaining + prune, together",
    steps: [
      { title: "Base case on remaining", detail: "When remaining reaches exactly 0 the current path sums to target, so append a copy and return.", input: "start, path, remaining", output: "one valid combination saved" },
      { title: "Prune with the sort", detail: "Because candidates are sorted, once cand[i] exceeds remaining every later candidate does too, so break out of the loop — no point trying them.", input: "the sorted candidates", output: "doomed branches skipped" },
      { title: "Reuse via start = i", detail: "Recursing with start = i (not i + 1) lets the same candidate be chosen again, while still forbidding earlier candidates so each combination is generated once.", input: "the chosen candidate", output: "every combination summing to target" },
    ],
  },
  io_examples: [
    { label: "reuse allowed", input: "candidates = [2,3,6,7], target = 7", expected_output: "[[2,2,3],[7]]", explanation: "2+2+3 and 7 both reach the target; 2 is reused." },
    { label: "several", input: "candidates = [2,3,5], target = 8", expected_output: "[[2,2,2,2],[2,3,3],[3,5]]", explanation: "Three combinations, including one that reuses 2 four times." },
    { label: "impossible", input: "candidates = [2], target = 1", expected_output: "[]", explanation: "No combination of 2s reaches 1; the prune stops the loop immediately." },
  ],
  visualization: {
    title: "remaining == 0 records · cand[i] > remaining prunes · start = i reuses",
    description: "The three moves that make combination sum finish quickly.",
    items: [
      { label: "remaining hits 0", value: "record a copy", role: "input" },
      { label: "candidate > remaining", value: "break (prune)", role: "process" },
      { label: "recurse with start = i", value: "allow reuse, no duplicates", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "Sorted, pruned, reusable",
      code:
        "def combination_sum(candidates, target):\n    res = []\n    cand = sorted(candidates)\n    def backtrack(start, path, remaining):\n        if remaining == 0:\n            res.append(path[:])\n            return\n        for i in range(start, len(cand)):\n            if cand[i] > remaining:\n                break\n            path.append(cand[i])\n            backtrack(i, path, remaining - cand[i])\n            path.pop()\n    backtrack(0, [], target)\n    return res",
      explanation: "The break is the prune enabled by sorting; start = i allows reuse; remaining == 0 is the base case.",
    },
    {
      label: "concise",
      title: "Subtract-in-signature variant",
      code:
        "def combination_sum(candidates, target):\n    res = []\n    cand = sorted(candidates)\n    def go(i, path, rem):\n        if rem == 0:\n            res.append(path[:]); return\n        if i == len(cand) or cand[i] > rem:\n            return\n        # take cand[i] (and allow taking it again), or skip to i+1\n        go(i, path + [cand[i]], rem - cand[i])\n        go(i + 1, path, rem)\n    go(0, [], target)\n    return res",
      explanation: "The binary take-or-skip form makes the reuse (go with same i) versus advance (go with i+1) explicit.",
    },
  ],
  hints: [
    { level: 1, text: "Sort candidates first; the base case is remaining == 0, where you record a copy of the path." },
    { level: 2, text: "Loop for i in range(start, len(cand)); the prune is if cand[i] > remaining: break." },
    { level: 3, text: "choose = path.append(cand[i]); explore = backtrack(i, path, remaining - cand[i]); un-choose = path.pop()." },
    { level: 4, text: "Recurse with start = i (NOT i + 1) so the same candidate can be reused; passing i + 1 would forbid reuse." },
    { level: 5, text: "The break works ONLY because you sorted: once one candidate overshoots, every later one does too." },
  ],
  tests: [
    { id: "f_reuse", description: "reuse allowed", assert: "assert combination_sum([2,3,6,7], 7) == [[2,2,3],[7]]" },
    { id: "f_several", description: "several combinations", assert: "assert combination_sum([2,3,5], 8) == [[2,2,2,2],[2,3,3],[3,5]]" },
    { id: "f_impossible", description: "no combination reaches target", assert: "assert combination_sum([2], 1) == []" },
  ],
  hidden_tests: [
    { id: "hf_single", description: "the target itself as a candidate", assert: "assert combination_sum([3,5,8], 11) == [[3,3,5],[3,8]]" },
    { id: "hf_exact", description: "one candidate equal to target", assert: "assert combination_sum([7,3,2], 7) == [[2,2,3],[7]]" },
  ],
};

// ── Timed code drill: combinations C(n, k) (LeetCode 77) ──────────────────────
const codeDrill = {
  pattern: "backtracking",
  prompt:
    "One rep, timed: return every combination of k numbers chosen from 1..n, using the start-index template. The base case is a path of length k (record a copy); otherwise loop from the start index, choose i, recurse with start = i + 1, and un-choose. Order does not matter, so the start index keeps each combination unique.",
  target_seconds: 420,
  difficulty: "medium",
  language: "python",
  starter_code:
    "def combine(n, k):\n    res = []\n\n    def backtrack(start, path):\n        if len(path) == k:\n            res.append(path[:])\n            return\n        for i in range(start, n + 1):\n            # TODO: choose i, recurse with start = i + 1, then un-choose\n            pass\n\n    backtrack(1, [])\n    return res\n",
  tests: [
    { id: "d_4_2", description: "C(4,2) = 6 combinations", assert: "assert combine(4, 2) == [[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]]" },
    { id: "d_1_1", description: "C(1,1)", assert: "assert combine(1, 1) == [[1]]" },
    { id: "d_count", description: "C(5,3) has 10 combinations", assert: "assert len(combine(5, 3)) == 10" },
    { id: "d_full", description: "C(3,3) is the whole set", assert: "assert combine(3, 3) == [[1,2,3]]" },
    { id: "d_k1", description: "C(3,1) is each singleton", assert: "assert combine(3, 1) == [[1],[2],[3]]" },
  ],
  hints: [
    { unlock_at_pct: 33, text: "Base case first: if len(path) == k: res.append(path[:]); return. Then loop for i in range(start, n + 1)." },
    { unlock_at_pct: 66, text: "choose = path.append(i); explore = backtrack(i + 1, path); un-choose = path.pop()." },
    { unlock_at_pct: 100, text: "for i in range(start, n + 1): path.append(i); backtrack(i + 1, path); path.pop()" },
  ],
  solution:
    "def combine(n, k):\n    res = []\n    def backtrack(start, path):\n        if len(path) == k:\n            res.append(path[:])\n            return\n        for i in range(start, n + 1):\n            path.append(i)\n            backtrack(i + 1, path)\n            path.pop()\n    backtrack(1, [])\n    return res\n",
};

// ── Assessment (adaptive MC + freeform) ───────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Describe the three-beat backtracking template (choose, explore, un-choose) and explain the role of the shared path and why you record a copy of it.",
      type: "free_text",
      concept: "backtracking",
      difficulty: "medium",
      actual_answer:
        "Backtracking is a depth-first walk of a tree of choices, and it repeats three beats at every node. Choose: append the current option to a shared path list that holds the choices made so far. Explore: recurse to go one level deeper with that option in place. Un-choose: pop the option back off so the path is restored exactly as it was before the choice, letting the next branch start clean. The shared path is the single mutable state that the whole recursion grows and shrinks. When you reach a complete answer you must record a copy of the path (path[:]), not the path itself, because the recursion keeps mutating that same list; if you stored the live reference, later pushes and pops would rewrite every saved answer, typically leaving them all empty by the time the walk unwinds.",
      rubric:
        "Full credit: choose = push, explore = recurse, un-choose = pop to restore; shared path is the mutable state; record a copy because the live list keeps being mutated. Partial: names the beats but misses the copy reasoning. Low: vague.",
      support_ref: "backtracking-part-1-subsets",
    },
    {
      id: "a-free-2",
      text: "A candidate is generating permutations but reuses a start index like the subsets solution, and gets only combinations. Explain the fix and why a used-array is the right guard for permutations.",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "hard",
      actual_answer:
        "The bug is that a start index only ever looks forward, so it can never place a lower-positioned element after a higher one — it produces each set once in increasing order, which is exactly combinations, not permutations. Permutations care about order: [1,2,3] and [1,3,2] and [2,1,3] are all distinct answers, so the walk must be allowed to place any not-yet-used element at each position, in any order. The fix is to drop the start index and instead track a boolean used-array with one flag per element; the loop runs over all elements and skips any whose flag is set. Choosing sets the flag and appends; un-choosing pops and clears the flag so the element is free again for a different branch. The used-array is the right guard because it enforces 'each element used exactly once within one arrangement' without imposing any order restriction, which is precisely what a permutation needs.",
      rubric:
        "Full credit: start index is forward-only so it yields combinations not permutations; permutations need any free element in any order; fix = used-array, set on choose and clear on un-choose. Partial: says use a used-array without explaining why the start index fails. Low: vague.",
      support_ref: "backtracking-part-2-permutations",
    },
    {
      id: "a-free-3",
      text: "When is backtracking the WRONG tool, and what is the main cost you pay for exploring the whole decision tree? Name a concrete situation where dynamic programming is better.",
      type: "free_text",
      concept: "backtracking",
      difficulty: "medium",
      actual_answer:
        "Backtracking is the wrong tool when you do not actually need to enumerate every configuration — when the problem asks only for a single optimum or for a count of ways. The main cost you pay is time: the decision tree is often exponential (2^n subsets) or factorial (n! permutations), because that is genuinely how many configurations exist, and backtracking has no memory, so it walks the whole tree. When subproblems overlap, dynamic programming can fold that exponential tree into a polynomial table by remembering each subproblem's answer instead of re-deriving it. A concrete example is counting the number of ways to make change for an amount, or the longest common subsequence of two strings: a naive backtracking search over all choices is exponential, but a DP table over (index, remaining) or (i, j) states is polynomial. So reach for backtracking when you must produce or examine each configuration, and for DP when you want one optimal value or a count and the subproblems repeat.",
      rubric:
        "Full credit: wrong when you only need one optimum or a count; main cost is exponential/factorial time with no memoization; DP folds overlapping subproblems into a polynomial table (concrete example named). Partial: mentions exponential cost OR DP but not both. Low: vague.",
      support_ref: "backtracking-part-1-subsets",
    },
  ],
  quiz: {
    pass_threshold: 6,
    consecutive_correct_required: 6,
    idk_option: true,
    grounding_required: true,
    questions: [
      {
        id: "q1",
        question: "What are the three beats of the backtracking template, in order?",
        choices: ["Choose, explore, un-choose", "Sort, search, merge", "Hash, probe, resize", "Divide, conquer, combine"],
        correct_index: 0,
        explanation: "Push a choice onto the shared path, recurse to explore, then pop it back off to restore state.",
        concept: "backtracking",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "backtracking-part-1-subsets",
      },
      {
        id: "q2",
        question: "Why must you record a COPY of the path when saving an answer?",
        choices: [
          "The path is a shared list that later pushes/pops keep mutating, so a saved reference would change",
          "Copying is required by Python syntax",
          "The copy is faster to compare",
          "Otherwise the answer would be sorted",
        ],
        correct_index: 0,
        explanation: "Storing the live path aliases it; later mutations rewrite every saved answer. path[:] freezes a snapshot.",
        concept: "backtracking",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "backtracking-part-1-subsets",
      },
      {
        id: "q3",
        question: "In the subsets template, what does the start index accomplish?",
        choices: [
          "Each subset is produced exactly once, in increasing order — no duplicates",
          "It makes the walk breadth-first",
          "It sorts the input",
          "It limits subsets to length 2",
        ],
        correct_index: 0,
        explanation: "Looking only forward means {1,3} appears but {3,1} never does, so each subset is unique.",
        concept: "backtracking",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "backtracking-part-1-subsets",
      },
      {
        id: "q4",
        question: "Why do permutations need a used-array rather than a start index?",
        choices: [
          "Order matters, so every free element must be placeable at every position",
          "A used-array uses less memory",
          "Start indices only work for sorted input",
          "Permutations never reuse elements, so no guard is needed",
        ],
        correct_index: 0,
        explanation: "A start index is forward-only and would yield combinations; a used-array allows any order while preventing reuse.",
        concept: "backtracking",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "backtracking-part-2-permutations",
      },
      {
        id: "q5",
        question: "What is 'pruning' in backtracking?",
        choices: [
          "Rejecting a partial state early so an entire doomed subtree is never explored",
          "Removing duplicate answers at the end",
          "Sorting the candidates before recursing",
          "Caching subproblem results",
        ],
        correct_index: 0,
        explanation: "Testing a constraint before recursing deletes the whole subtree beneath a doomed choice.",
        concept: "backtracking",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "backtracking-part-2-permutations",
      },
      {
        id: "q6",
        question: "In combination sum, why does sorting the candidates enable the prune 'if candidate > remaining: break'?",
        choices: [
          "Once one candidate overshoots the remaining amount, every later (larger) one does too",
          "Sorting removes duplicates",
          "Sorting makes the recursion iterative",
          "It guarantees a unique answer",
        ],
        correct_index: 0,
        explanation: "With sorted candidates, the first overshoot means all the rest overshoot, so you can stop the loop entirely.",
        concept: "backtracking",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "backtracking-part-1-subsets",
      },
      {
        id: "q7",
        question: "Which phrases hint at a backtracking solution? (Select all that apply.)",
        choices: [
          "\"return all subsets / combinations\"",
          "\"every valid arrangement / permutation\"",
          "\"the single shortest path length\"",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "Enumerating subsets and arrangements are backtracking fingerprints; a single shortest length is a BFS/DP job.",
        concept: "pattern-recognition",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "backtracking-part-1-subsets",
      },
      {
        id: "q8",
        question: "When is backtracking the wrong choice, favoring dynamic programming instead?",
        choices: [
          "When you need one optimum or a count and subproblems overlap, so a table folds the exponential tree",
          "When the input is already sorted",
          "When there are fewer than 10 elements",
          "When the answer is a single boolean",
        ],
        correct_index: 0,
        explanation: "DP reuses overlapping subproblems to turn an exponential enumeration into a polynomial table.",
        concept: "pattern-recognition",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "backtracking-part-2-permutations",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-bt-recognize", prompt: "Given a fresh problem, how quickly could you now tell it wants backtracking, and which fingerprint (subsets/combinations, permutations, constraint puzzle, target-sum) it is?", hint: "Name the 'find all valid configurations' signal you would look for." },
  { id: "diag-bt-guard", prompt: "Can you state, in one sentence each, when to use a start index versus a used-array?", hint: "Order irrelevant → start index; order matters → used-array." },
  { id: "diag-bt-prune", prompt: "Where would you place a constraint check to prune the most work, and why does checking early beat filtering at the leaves?", hint: "Early rejection deletes the largest subtrees." },
  { id: "diag-bt-speed", prompt: "Could you write subsets, permutations, and combination sum from memory in under 5 minutes each right now? What would slow you down?", hint: "Execution speed is the interview bottleneck." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "Backtracking in the interview-pattern map",
  description:
    "This lesson covers the choose/explore/un-choose template, subsets via a start index, permutations via a used-array, constraint pruning, and the combination-sum integrator. Monotonic Stack is the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "bt-template", label: "choose / explore / un-choose", category: "lesson_concept", covered: true },
    { id: "bt-subsets", label: "Subsets (start index)", category: "lesson_concept", covered: true },
    { id: "bt-permutations", label: "Permutations (used-array)", category: "lesson_concept", covered: true },
    { id: "bt-pruning", label: "Constraint pruning", category: "lesson_concept", covered: true },
    { id: "trie", label: "Trie DFS (prior)", category: "concept", covered: true },
    { id: "nqueens", label: "N-Queens / Sudoku", category: "concept", preview: true },
    { id: "monotonic-stack", label: "Monotonic Stack (next)", category: "concept" },
  ],
  edges: [],
  curriculum_stages: [
    { id: "sliding-window", label: "Sliding Window", status: "done" },
    { id: "two-pointer", label: "Two Pointer", status: "done" },
    { id: "heap", label: "Heap / Priority Queue", status: "done" },
    { id: "trie", label: "Trie / Prefix Tree", status: "done" },
    { id: "backtracking", label: "Backtracking", status: "current" },
    { id: "monotonic-stack", label: "Monotonic Stack", status: "next" },
    { id: "dp-reactivation", label: "DP reactivation", status: "later" },
  ],
  current: "backtracking",
};

const planningRationale =
  "Backtracking is taught in full because the imported repo evidence flags it as near-untouched (~1 row, two problems), one of the weakest remaining tracked patterns after sliding window, two pointer, heap, and trie. The lesson grounds the template first (a depth-first walk of a decision tree with the three beats choose, explore, un-choose, and the two habits that kill the classic bugs: record a copy of the path, and always un-choose on the way back up) using subsets, where every node is an answer and a start index prevents duplicates, so the skeleton is concrete before constraints appear. Part two moves to permutations, where order matters and a used-array replaces the start index, and introduces pruning as the move that makes constrained problems (N-Queens, Sudoku) finish by deleting doomed subtrees early. The scaffolded exercises (subsets, permutations) plus the combination-sum integrator (start index + running remaining + sorted-break prune) and a timed C(n,k) combinations drill build execution speed, and pattern_recognition questions plus 'when it fails' cases (exponential cost, and when dynamic programming folds the tree to a polynomial table) build the recognition judgment that separates strong interviewees from grinders. It also connects backward to the trie autocomplete DFS the learner just saw, framing backtracking as that same explore-then-unwind shape with an explicit un-choose.";

// ── Assemble, validate, insert ────────────────────────────────────────────────
function fail(label: string, res: { valid: boolean; errors: string[] }) {
  if (!res.valid) {
    console.error(`\n✗ ${label} FAILED validation:`);
    for (const e of res.errors) console.error("   -", e);
    return true;
  }
  console.log(`✓ ${label} valid`);
  return false;
}

function main() {
  const db = getDb();
  const subject = db.prepare("SELECT id, title FROM subjects WHERE id = ?").get(SUBJECT_ID) as
    | { id: number; title: string }
    | undefined;
  if (!subject) throw new Error(`Subject ${SUBJECT_ID} not found`);

  let bad = false;
  bad = fail("Part 1 (subsets template)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (permutations + pruning)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Code drill", validateCodeDrillContent(codeDrill)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1280)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Backtracking: Choose, Explore, Un-choose — Walk the Decision Tree";
  const description =
    "The tool for 'find all the valid configurations' when the number of nested loops depends on the input. Backtracking is a depth-first walk of a tree of choices: choose (push onto a shared path), explore (recurse), un-choose (pop it back off), recording a copy at each complete state and pruning doomed branches. Covers subsets via a start index, permutations via a used-array, the combination-sum integrator, and when dynamic programming folds the exponential tree instead.";
  const goals = JSON.stringify([
    "Recognize backtracking problems (all subsets/combinations, all permutations/arrangements, constraint puzzles, target-sum partitions) from trigger phrases in under 2 minutes",
    "Implement the choose/explore/un-choose template for subsets, permutations, and combination sum from a scaffold, recording copies and un-choosing correctly",
    "Choose a start index versus a used-array correctly, prune constrained branches early, and explain when dynamic programming beats backtracking",
  ]);
  const tags = JSON.stringify(["backtracking", "recursion", "dfs", "weak-pattern", "interview-prep"]);
  const overviewAudioContent = {
    script: OVERVIEW_SCRIPT,
    transcript: OVERVIEW_SCRIPT,
    duration_hint: 1200,
    orientation_visual: orientationVisual,
    long_overview_style: "two-host-socratic",
  };

  const tx = db.transaction(() => {
    const prior = db
      .prepare("SELECT id FROM lessons WHERE subject_id = ? AND sequence_number = ?")
      .all(SUBJECT_ID, SEQ) as Array<{ id: number }>;
    for (const p of prior) {
      db.prepare("DELETE FROM lesson_activities WHERE lesson_id = ?").run(p.id);
      db.prepare("DELETE FROM lessons WHERE id = ?").run(p.id);
      console.log(`Removed prior seq=${SEQ} lesson ${p.id}`);
    }

    const res = db
      .prepare(
        `INSERT INTO lessons
           (subject_id, title, description, status, sequence_number, goals, tags,
            generated_by, generator_version, next_lesson_diagnostics, knowledge_graph_data, planning_rationale)
         VALUES (?, ?, ?, 'queued', ?, ?, ?, 'cc-handauthored/algo-interview', '1.0.0', ?, ?, ?)`
      )
      .run(
        SUBJECT_ID,
        title,
        description,
        SEQ,
        goals,
        tags,
        JSON.stringify(diagnostics),
        JSON.stringify(knowledgeGraph),
        planningRationale
      );
    const lessonId = Number(res.lastInsertRowid);

    const insertAct = db.prepare(
      `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
       VALUES (?, ?, 1, ?, ?, ?)`
    );
    insertAct.run(lessonId, "audio", 1, "Audio: Backtracking — walk the decision tree", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: The template via subsets", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Permutations + pruning", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: Combination Sum", JSON.stringify(finalCode));
    insertAct.run(lessonId, "code_drill", 5, "Drill: combinations C(n, k)", JSON.stringify(codeDrill));
    insertAct.run(lessonId, "assessment", 6, "Assessment: Backtracking recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 6 activities.`);
  closeDb();
}

main();
