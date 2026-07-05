#!/usr/bin/env tsx
/**
 * P4.1 — Lesson 8 of the "Coding Interview Mastery" subject (id 9):
 * "Dynamic Programming Reactivation: State, Recurrence, Order, Base Case — at Speed".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in this
 * env). This is a STRONG-but-STALE pattern for the learner (imported evidence:
 * lis 106, dynamic-programming 65, knapsack 55), so the lesson is framed as SPEED
 * REACTIVATION — assume the concept is known, rebuild execution speed to interview
 * timing. The mental model is four decisions: name the STATE, write the
 * RECURRENCE, pick the ORDER, set the BASE CASE.
 *
 * Structure mirrors the Monotonic Stack / Backtracking / Trie lessons: top-level
 * 2-host overview audio + orientation visual, two collapsed lesson_parts (Kadane /
 * maximum subarray as a 1D running DP; 0/1 knapsack as a rolling 1D array swept
 * descending) each with a bespoke approved artifact + per-part audio synced visual
 * + scaffolded code + mixed practice (incl. pattern_recognition), a final
 * integrator practice_code (Longest Increasing Subsequence, LeetCode 300), an
 * adaptive MC + freeform assessment, and a timed code_drill (Coin Change, LeetCode
 * 322). Cue timings are provisional and rescaled to the real generated audio
 * duration by rescale-dp-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-dp-overview-map, algo-dp-kadane, algo-dp-knapsack
 *
 * Idempotent: replaces any prior seq=7 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-dp.ts
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
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/dp-audio";

const SUBJECT_ID = 9;
const SEQ = 7;

const A_OVERVIEW = "algo-dp-overview-map";
const A_KADANE = "algo-dp-kadane";
const A_KNAPSACK = "algo-dp-knapsack";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "dp-orientation",
    title: "DP reactivation: name the state, write the recurrence, fix the order, seed the base case",
    motif: "four-decisions",
    description:
      "Orientation for the whole pattern as a reactivation, not a first-teach. You already know dynamic programming; the goal is to rebuild the speed to write the right recurrence from memory in under two minutes. Every DP is four decisions: name the state (what one cell means, as a precise sentence), write the recurrence (how a cell builds on strictly smaller cells), pick the fill order (dependencies first), and set the base case. The lesson drills four canonical shapes in contrasting pairs — 1D running (Kadane), 0/1 knapsack (rolling array swept descending), subsequence (LIS), and unbounded (coin change swept ascending) — so the recurrence for each becomes muscle memory. The single trap that costs interviews is the fill order: 0/1 knapsack sweeps capacity descending to forbid reuse; the unbounded coin problem sweeps ascending to allow it — same table, opposite direction.",
    panels: [
      {
        id: "cost",
        title: "Reactivation, not re-teaching",
        kind: "flow" as const,
        description: "The bottleneck is recall speed, not understanding — drill the four decisions until each recurrence is automatic.",
        data: [
          { label: "you already know DP", value: "strong but stale", role: "input" as const },
          { label: "drill the four decisions in pairs", value: "state · recurrence · order · base", role: "process" as const },
          { label: "recurrence from memory", value: "< 2 min, calm coding", role: "output" as const },
        ],
      },
      {
        id: "shapes",
        title: "Four fingerprints",
        kind: "cards" as const,
        description: "1D running, 0/1 knapsack, subsequence, and unbounded.",
        data: [
          { label: "1D running (Kadane)", value: "best_here = max(x, best_here + x)", role: "context" as const },
          { label: "0/1 knapsack", value: "rolling array, capacity DESCENDING", role: "context" as const },
          { label: "subsequence / unbounded", value: "dp-ends-at-i · coin ASCENDING", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 170, label: "Reactivation", headline: "You know DP; rebuild the speed", narration: "This is a strong-but-stale pattern, so the goal is recall speed: write the right recurrence from memory in under two minutes.", receive: "a known pattern gone stale", transform: "drill for speed", pass: "interview-timing recall" },
    { start: 170, end: 350, label: "The four decisions", headline: "State, recurrence, order, base", narration: "Every DP is four decisions in the same order: name the state, write the recurrence, pick the fill order, set the base case.", receive: "a DP problem", transform: "run the four-question checklist", pass: "code that is basically written" },
    { start: 350, end: 560, label: "Precise state", headline: "The state sentence is exact", narration: "A vague state makes the recurrence ambiguous; sharpen it to 'ending exactly at i' and the transition is forced.", receive: "a fuzzy 'answer up to i'", transform: "sharpen the sentence", pass: "a forced recurrence" },
    { start: 560, end: 760, label: "Kadane", headline: "A running scalar, extend or restart", narration: "Maximum subarray is best-here equals the max of x alone or best-here plus x; restart wins exactly when the run went negative.", receive: "an array", transform: "one running decision", pass: "O(n) time, O(1) space" },
    { start: 760, end: 960, label: "Knapsack", headline: "Rolling array, sweep descending", narration: "The 2D table collapses to one row; sweeping capacity high to low keeps each item used at most once.", receive: "items and a budget", transform: "roll the row, descend", pass: "each item once" },
    { start: 960, end: 1120, label: "Direction flip", headline: "Ascending allows reuse", narration: "Coin change is the same table swept ascending so a coin can repeat — one machine, opposite loop direction.", receive: "reuse-allowed problems", transform: "flip the sweep", pass: "the unbounded variant" },
    { start: 1120, end: 1300, label: "LIS", headline: "dp-ends-at-i, or patience tails", narration: "Longest increasing subsequence is dp ending at i in n squared, or a patience tails array with binary search in n log n.", receive: "a subsequence problem", transform: "pick the version", pass: "the length" },
    { start: 1300, end: 1400, label: "Traps", headline: "Order, base, vague state, sentinel", narration: "The bugs are fill order, base cases, a vague state, and an unreachable sentinel — not the idea itself.", receive: "a coded solution", transform: "check the four traps", pass: "a correct submission" },
  ],
};

// ── Reading builder helper ────────────────────────────────────────────────────
const kadaneComplexity = {
  type: "formula",
  latex: "\\text{time } O(n) \\qquad \\text{space } O(1)",
  plain_english:
    "Kadane makes a single left-to-right pass, and at each index it does a constant amount of work: one addition and one comparison to update best-here, and one comparison to update the global best. Because best-here of i depends only on best-here of i minus one, you never materialize an array — two scalars suffice — so the extra space is constant. One pass of n constant-time steps is O(n) time and O(1) space, the cheapest a subarray-sum DP can be.",
  variables: [
    { symbol: "n", meaning: "the number of elements you scan once" },
    { symbol: "O(n) \\text{ time}", meaning: "one pass, constant work per element" },
    { symbol: "O(1) \\text{ space}", meaning: "two carried scalars: best-here and best" },
  ],
};

const knapsackComplexity = {
  type: "formula",
  latex: "\\text{time } O(n \\cdot W) \\qquad \\text{space } O(W)",
  plain_english:
    "The rolling knapsack folds in each of the n items, and for each item it sweeps the capacity axis of width W once, doing constant work per cell. That is n times W cells of constant work, so O(n·W) time — pseudo-polynomial, because it depends on the numeric capacity W, not just the input length. The single reused array has W plus one entries, so the extra space is O(W); collapsing the honest 2D table dp[item][capacity] to one row is what buys the space reduction, and the descending sweep is what keeps it correct.",
  variables: [
    { symbol: "n", meaning: "the number of items" },
    { symbol: "W", meaning: "the weight capacity (the size of the rolling array)" },
    { symbol: "O(n \\cdot W)", meaning: "each item sweeps the capacity axis once" },
    { symbol: "O(W)", meaning: "one rolling row instead of the full 2D table" },
  ],
};

// ── Part 1: Kadane / Maximum Subarray (1D running DP) ─────────────────────────
const part1 = {
  part_id: "dp-part-1-kadane",
  reading: {
    blocks: [
      { type: "heading", text: "The purest 1D DP: a running scalar that extends or restarts" },
      {
        type: "paragraph",
        text:
          "Maximum Subarray is the cleanest place to reload dynamic programming, because its whole table is one scalar. The state must be phrased exactly: best-here of index i is the maximum sum of a contiguous subarray that ends exactly at index i. That final phrase, 'ends exactly at i', is doing all the work — it forces element i to be included, so the only remaining freedom is whether the run before it is worth keeping. From that precise state the recurrence is forced: best-here of i is the max of two choices, starting a brand-new run at i (which is nums[i] alone) or extending the best run ending at i minus one (which is best-here of i minus one, plus nums[i]). You keep whichever is larger. The answer to the whole problem is the maximum best-here over every index, because the optimal subarray has to end somewhere, and you have computed the best subarray ending at each possible somewhere. The famous 'reset when the running sum goes negative' intuition is not a separate rule — it is already inside the max, because extending beats restarting exactly when best-here of i minus one is positive.",
      },
      {
        type: "definition",
        term: "State (the DP cell's meaning)",
        definition:
          "A precise one-sentence description of what a single entry of your table represents — here, 'the max sum of a contiguous run ending exactly at index i'. Precision is not optional: a vague state like 'the best answer up to i' does not pin down whether element i is used, so no clean recurrence exists. Sharpening the state to include 'ending exactly at' or 'using exactly' is the single move that converts 'I know it is DP' into a forced transition, which is why it is the first of the four decisions.",
      },
      {
        type: "example",
        body:
          "max_subarray([-2,1,-3,4,-1,2,1,-5,4]): best_here starts at -2 (best -2). x=1: max(1, -2+1=-1)=1 → restart, best 1. x=-3: max(-3, 1-3=-2)=-2 → extend, best 1. x=4: max(4, -2+4=2)=4 → restart, best 4. x=-1: max(-1, 4-1=3)=3, best 4. x=2: 3+2=5, best 5. x=1: 5+1=6, best 6 (the run [4,-1,2,1]). x=-5: 6-5=1, best 6. x=4: max(4, 1+4=5)=5, best 6. Answer 6.",
      },
      {
        type: "callout",
        text:
          "The all-negatives trap: initialize best and best_here to nums[0], NOT to 0. If you seed them at 0, an input like [-3,-2,-5] returns 0 (an empty subarray) instead of -2. Seeding at the first element forces at least one element into the answer, which is what 'contiguous subarray' means unless the problem explicitly allows empty.",
      },
      kadaneComplexity,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_KADANE,
      scene: {
        scene_id: "dp-kadane-scene",
        title: "One decision per element: extend the run, or start fresh",
        motif: "running-max-extend-restart",
        description: "The full walk of max_subarray([-2,1,-3,4,-1,2,1,-5,4]): at each index best_here is the max of the element alone or the previous best_here plus it, and the global best tracks the largest best_here ever seen. A negative running sum is abandoned automatically by the max.",
        panels: [
          {
            id: "decision",
            title: "The loop body",
            kind: "ledger" as const,
            description: "What each element does to the two scalars.",
            data: [
              { label: "best_here = max(x, best_here + x)", value: "extend or restart", role: "process" as const },
              { label: "best = max(best, best_here)", value: "track the global answer", role: "input" as const },
              { label: "best_here < 0", value: "next positive element restarts", role: "output" as const },
            ],
          },
          {
            id: "why",
            title: "Why it is O(1) space",
            kind: "matrix" as const,
            description: "The dependency is only one step back.",
            data: [
              { label: "best_here of i depends on", value: "best_here of i-1 only", role: "context" as const },
              { label: "so you carry", value: "two scalars, no array", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "The state", headline: "Best run ending at i", narration: "best_here is the largest sum of a contiguous run that ends exactly at the current index.", receive: "the array", transform: "define a running scalar", pass: "a precise state" },
        { start: 30, end: 62, label: "Extend or restart", headline: "Max of two choices", narration: "best_here is the max of the element alone or the previous best_here plus it — start fresh or extend.", receive: "the current element", transform: "compare the two options", pass: "the new best_here" },
        { start: 62, end: 95, label: "Negatives reset", headline: "A negative run is abandoned", narration: "Extending wins only when the previous run was positive, so a negative running sum resets automatically.", receive: "a negative best_here", transform: "restart on the next element", pass: "no wasted prefix" },
        { start: 95, end: 128, label: "Track the best", headline: "Global max of best_here", narration: "The answer is the largest best_here ever seen, because the optimal subarray ends somewhere.", receive: "every best_here", transform: "keep the maximum", pass: "the global answer" },
        { start: 128, end: 150, label: "The winner", headline: "The run [4,-1,2,1] = 6", narration: "Here the best run is 4, -1, 2, 1 summing to 6, found the moment best_here reaches 6.", receive: "the running values", transform: "read the peak", pass: "6" },
        { start: 150, end: 165, label: "Constant space", headline: "Two scalars, one pass", narration: "Because each step needs only the previous best_here, you carry two scalars — O(n) time, O(1) space.", receive: "the finished walk", transform: "count the state", pass: "O(1) space" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk max_subarray([-2,1,-3,4,-1,2,1,-5,4]). Watch best_here make one decision per element — extend the shaded run or restart at the element alone — and best track the largest best_here. Notice the run resets whenever best_here would go negative, and the winner is the run [4,-1,2,1] = 6.",
    params: { artifact_slug: A_KADANE, min_height: 360 },
  },
  code: {
    prompt:
      "Return the largest sum of any non-empty contiguous subarray (Kadane's algorithm). Use a running scalar. Fill in the TODO: seed best_here and best to nums[0]; scan from index 1; set best_here = max(x, best_here + x) (start fresh vs extend); update best = max(best, best_here).",
    starter_code:
      "def max_subarray(nums):\n    best_here = nums[0]\n    best = nums[0]\n\n    for x in nums[1:]:\n        # TODO:\n        #   best_here = max(x, best_here + x)   # restart at x, or extend the run\n        #   best = max(best, best_here)\n        pass\n\n    return best\n",
    constraints: [
      "Seed both best_here and best to nums[0], NOT 0, so an all-negative input returns the largest single element.",
      "best_here = max(x, best_here + x): the max itself decides restart vs extend, so no explicit reset rule is needed.",
      "Track the global best as the maximum best_here over the whole scan — the optimal subarray ends somewhere.",
    ],
    walkthrough: {
      title: "One running decision per element",
      steps: [
        { title: "Seed at the first element", detail: "best_here and best both start at nums[0]; a non-empty subarray must include at least one element, and this makes all-negative inputs correct.", input: "nums", output: "best_here = best = nums[0]" },
        { title: "Extend or restart", detail: "For each later element, best_here becomes the max of the element alone or the previous best_here plus it. Restart wins exactly when the running sum was negative.", input: "the current element", output: "the updated best_here" },
        { title: "Track the global best", detail: "After updating best_here, update best to the larger of best and best_here. The answer is the peak best_here.", input: "best_here", output: "the global maximum" },
      ],
    },
    io_examples: [
      { label: "classic", input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", expected_output: "6", explanation: "The run [4,-1,2,1] sums to 6, the largest contiguous sum." },
      { label: "all positive", input: "nums = [5,4,-1,7,8]", expected_output: "23", explanation: "The whole array is the best run; a single negative dip is worth spanning." },
      { label: "all negative", input: "nums = [-3,-2,-5,-1]", expected_output: "-1", explanation: "With no positive element, the answer is the largest single value, -1." },
    ],
    visualization: {
      title: "running scalar · extend or restart · track the peak",
      description: "best_here makes one decision per element; best keeps the maximum.",
      items: [
        { label: "x alone vs best_here + x", value: "keep the larger", role: "input" },
        { label: "best_here < 0", value: "restart next", role: "process" },
        { label: "best = max(best, best_here)", value: "the answer", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The Kadane template",
        code:
          "def max_subarray(nums):\n    best_here = nums[0]\n    best = nums[0]\n    for x in nums[1:]:\n        best_here = max(x, best_here + x)\n        best = max(best, best_here)\n    return best",
        explanation: "One pass, two scalars. The max inside best_here folds the 'reset on negative' rule into the recurrence. O(n) time, O(1) space.",
      },
      {
        label: "concise",
        title: "Maximum Product Subarray (track min and max)",
        code:
          "def max_product(nums):\n    best = cur_max = cur_min = nums[0]\n    for x in nums[1:]:\n        cand = (x, cur_max * x, cur_min * x)\n        cur_max = max(cand)\n        cur_min = min(cand)\n        best = max(best, cur_max)\n    return best",
        explanation: "The product variant carries BOTH a running max and a running min, because a negative element can flip the smallest product into the largest. Same one-pass running-DP shape, two scalars instead of one.",
      },
    ],
    hints: [
      { level: 1, text: "Seed best_here = best = nums[0]; never seed at 0 (that breaks all-negative inputs)." },
      { level: 2, text: "For each later element x, the only decision is start fresh at x or extend: best_here = max(x, best_here + x)." },
      { level: 3, text: "The max itself handles the reset — when best_here + x < x, best_here becomes x, restarting the run." },
      { level: 4, text: "After updating best_here, do best = max(best, best_here)." },
      { level: 5, text: "Return best, the largest best_here ever seen — the optimal subarray ends at that index." },
    ],
    tests: [
      { id: "t_classic", description: "classic mixed", assert: "assert max_subarray([-2,1,-3,4,-1,2,1,-5,4]) == 6" },
      { id: "t_pos", description: "spanning a dip", assert: "assert max_subarray([5,4,-1,7,8]) == 23" },
      { id: "t_neg", description: "all negative", assert: "assert max_subarray([-3,-2,-5,-1]) == -1" },
    ],
    hidden_tests: [
      { id: "h_single", description: "single element", assert: "assert max_subarray([1]) == 1" },
      { id: "h_single_neg", description: "single negative", assert: "assert max_subarray([-1]) == -1" },
      { id: "h_two_neg", description: "two negatives", assert: "assert max_subarray([-2,-1]) == -1" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "dp1-so-1",
        type: "select_one",
        prompt: "In Kadane's algorithm, what is the state best_here[i]?",
        concept: "dynamic-programming",
        difficulty: "easy",
        choices: [
          "The maximum sum of a contiguous subarray ending exactly at index i",
          "The maximum sum of any subarray in the whole array",
          "The sum of the first i elements",
          "The number of positive elements up to i",
        ],
        correct_index: 0,
        explanation: "The 'ending exactly at i' phrasing forces element i in and makes the extend-or-restart recurrence well defined.",
      },
      {
        id: "dp1-sa-multi",
        type: "select_all",
        prompt: "Which statements about Kadane's algorithm are true?",
        concept: "dynamic-programming",
        difficulty: "medium",
        choices: [
          "best_here = max(x, best_here + x) folds the 'reset on negative' rule into the max",
          "The global answer is the maximum best_here over all indices",
          "It runs in O(n) time and O(1) space",
          "You must seed best_here and best to 0",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Seeding at 0 breaks all-negative inputs; seed at nums[0]. The other three are the core facts.",
      },
      {
        id: "dp1-sa-none",
        type: "select_all",
        prompt: "For max_subarray([-3,-2,-5,-1]), which of these outputs are correct? (If none, select none.)",
        concept: "dynamic-programming",
        difficulty: "hard",
        choices: [
          "0 (the empty subarray)",
          "-11 (the sum of everything)",
          "-2 (the largest adjacent pair)",
        ],
        correct_indices: [],
        explanation: "None: with all negatives the answer is the largest single element, -1. Empty (0) is wrong unless empty subarrays are allowed; -11 and -2 are not maxima.",
      },
      {
        id: "dp1-order",
        type: "ordering",
        prompt: "Order the operations for one element in Kadane's loop.",
        concept: "dynamic-programming",
        difficulty: "medium",
        items: [
          "Read the current element x",
          "best_here = max(x, best_here + x)  (restart or extend)",
          "best = max(best, best_here)",
          "Move to the next element",
        ],
        correct_order: [
          "Read the current element x",
          "best_here = max(x, best_here + x)  (restart or extend)",
          "best = max(best, best_here)",
          "Move to the next element",
        ],
      },
      {
        id: "dp1-pattern",
        type: "pattern_recognition",
        prompt: "\"Find the contiguous run of days with the maximum total profit, where daily profit may be negative.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Dynamic Programming (Kadane)", "Running scalar / O(1) state", "Sliding Window", "Two Pointer", "Heap"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Maximum contiguous sum with possible negatives is exactly Kadane — a 1D running-DP with an extend-or-restart scalar; a fixed sliding window does not apply because the run length is unbounded.",
      },
      {
        id: "dp1-written",
        type: "written",
        prompt: "Explain why 'reset the run when the sum goes negative' is not a separate rule you add, but a consequence of the recurrence best_here = max(x, best_here + x).",
        concept: "dynamic-programming",
        difficulty: "hard",
        actual_answer:
          "The recurrence compares exactly two candidates for the best run ending at the current element: the element standing alone, x, and the element appended to the best run ending just before it, best_here_prev + x. Subtract the two and you see that best_here_prev + x beats x by exactly best_here_prev, so extending wins if and only if best_here_prev is positive. Turn that around: the moment the previous running best is negative, x alone is at least as large as best_here_prev + x, so the max selects x, which is precisely 'throw away the accumulated run and start fresh here.' There is no separate branch that checks for a negative sum and zeroes it out; the comparison inside the max already encodes the decision. That is why the loop body is a single line. Adding an explicit reset would be redundant at best and, if done wrong (resetting to 0 instead of to x), would corrupt all-negative inputs. So the discipline is to trust the recurrence: the max is the reset.",
        rubric:
          "Full credit: best_here_prev + x beats x by best_here_prev, so extend wins iff prev > 0; a negative prev makes the max pick x = restart; no separate rule needed. Partial: says the max handles it without the subtraction argument. Low: vague.",
      },
    ],
  },
};

// ── Part 2: 0/1 Knapsack (rolling 1D array + descending sweep) ────────────────
const part2 = {
  part_id: "dp-part-2-knapsack",
  reading: {
    blocks: [
      { type: "heading", text: "The table everyone slows down on: a rolling row swept high to low" },
      {
        type: "paragraph",
        text:
          "0/1 Knapsack is the DP whose loop direction trips up otherwise-fluent candidates, so it is the highest-value thing to reactivate. Start with the honest two-dimensional state: dp of the first i items and capacity w is the best total value achievable using only items 0 through i minus 1 without exceeding weight w. The transition for item i is a clean either-or: skip the item, which is dp of i minus one at the same capacity w, or take the item if it fits, which is dp of i minus one at capacity w minus the item's weight, plus the item's value. You keep the larger. The crucial structural observation is that the entire right-hand side reads only from row i minus one — the previous item's row — so you never need the full two-dimensional table. You keep a single one-dimensional array indexed by capacity and fold in one item at a time, overwriting it in place. But that reuse of one array forces a subtlety: you must sweep the capacity from high to low. When you compute dp of w you read dp of w minus the item's weight; sweeping high to low guarantees that lower cell still holds the previous item's value, so the current item is added at most once. Sweep low to high instead and that lower cell would already include the current item, so you would use the item twice — which is exactly the unbounded, reuse-allowed variant. That single loop-direction choice is the entire difference between 0/1 knapsack and the unbounded coin problem.",
      },
      {
        type: "definition",
        term: "Fill order (dependency direction)",
        definition:
          "The order in which you compute the cells so that every cell a recurrence reads is already finalized before it is used. In the rolling 1D knapsack the array doubles as both the previous row and the current row, so 'order' becomes a within-row sweep direction: descending capacity protects the previous-row values you still need to read (use-once), ascending capacity deliberately lets them already include the current item (reuse). Getting the direction backwards silently changes which problem you are solving.",
      },
      {
        type: "example",
        body:
          "knapsack(weights=[1,3,4,5], values=[1,4,5,7], capacity=7), dp[0..7] starts all 0. Item (1,1) sweep 7..1: every dp[w≥1]=1. Item (3,4) sweep 7..3: dp[7]=max(1,dp[4]+4=5)=5, dp[3]=dp[0]+4=4 → dp=[0,1,1,4,5,5,5,5]. Item (4,5) sweep 7..4: dp[7]=max(5,dp[3]+5=9)=9, dp[5]=dp[1]+5=6 → dp=[0,1,1,4,5,6,6,9]. Item (5,7) sweep 7..5: dp[7]=max(9,dp[2]+7=8)=9, dp[5]=dp[0]+7=7 → dp=[0,1,1,4,5,7,8,9]. Answer dp[7]=9, taking items (3,4)+(4,5).",
      },
      {
        type: "callout",
        text:
          "The loop-direction bug that changes the answer silently: iterating capacity ascending in the 1D array lets dp[w - wt] already include item i, so item i gets picked multiple times. That is a correct UNBOUNDED knapsack but a wrong 0/1 knapsack. Always sweep descending for use-once; reach for ascending only when reuse is intended.",
      },
      knapsackComplexity,
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_KNAPSACK,
      scene: {
        scene_id: "dp-knapsack-scene",
        title: "A rolling row folds in one item, swept high to low so it lands once",
        motif: "rolling-array-descending",
        description: "The walk of knapsack([1,3,4,5],[1,4,5,7],7): dp[w] is the best value within capacity w, and each item is folded in by sweeping capacity descending, so dp[w-wt] still holds the pre-item value and the item is used at most once. The answer is dp[7]=9.",
        panels: [
          {
            id: "fold",
            title: "The item loop",
            kind: "ledger" as const,
            description: "What folding in one item does.",
            data: [
              { label: "for w = capacity down to wt", value: "descending sweep", role: "process" as const },
              { label: "dp[w] = max(dp[w], dp[w-wt] + val)", value: "skip vs take", role: "input" as const },
              { label: "answer", value: "dp[capacity]", role: "output" as const },
            ],
          },
          {
            id: "why",
            title: "Why descending",
            kind: "matrix" as const,
            description: "Protect the previous-row value.",
            data: [
              { label: "high → low read of dp[w-wt]", value: "still pre-item → use once", role: "context" as const },
              { label: "low → high", value: "already includes item → reuse", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "The state", headline: "dp[w] = best within capacity w", narration: "Each cell of the rolling array is the best total value achievable within a weight budget of w.", receive: "items and a budget", transform: "define the cell", pass: "a rolling row" },
        { start: 30, end: 62, label: "Skip or take", headline: "The either-or transition", narration: "For each item, dp[w] is the max of skipping it or taking it: dp[w-weight] plus its value.", receive: "one item", transform: "compare skip vs take", pass: "the updated cell" },
        { start: 62, end: 95, label: "Roll the row", headline: "2D collapses to one array", narration: "The transition only reads the previous item's row, so one array reused in place is enough.", receive: "the 2D table", transform: "collapse to one row", pass: "O(W) space" },
        { start: 95, end: 128, label: "Sweep descending", headline: "High to low keeps it use-once", narration: "Sweeping capacity high to low, dp[w-weight] still holds the pre-item value, so the item lands at most once.", receive: "the capacity axis", transform: "sweep descending", pass: "each item once" },
        { start: 128, end: 150, label: "The answer", headline: "dp[7] = 9", narration: "Here dp[7] reaches 9 by taking the weight-3 and weight-4 items — value 4 plus 5.", receive: "the filled row", transform: "read the last cell", pass: "9" },
        { start: 150, end: 165, label: "The flip", headline: "Ascending allows reuse", narration: "Flip the sweep to ascending and the same code becomes unbounded knapsack, where a single item repeats.", receive: "reuse-allowed problems", transform: "flip the direction", pass: "the unbounded variant" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk knapsack([1,3,4,5],[1,4,5,7],7). Watch the single rolling dp array fold in one item per step, with the cyan cells updated by that item; note the capacity is swept high to low so dp[w-wt] still holds the pre-item value, keeping each item used once. The green-bordered answer cell dp[7] reaches 9.",
    params: { artifact_slug: A_KNAPSACK, min_height: 380 },
  },
  code: {
    prompt:
      "Return the maximum total value for a 0/1 knapsack: each item may be taken at most once, within the weight capacity. Use a ROLLING 1D dp array swept DESCENDING. Fill in the TODO: for each item (wt, val), sweep w from capacity down to wt, and set dp[w] = max(dp[w], dp[w - wt] + val).",
    starter_code:
      "def knapsack(weights, values, capacity):\n    dp = [0] * (capacity + 1)\n\n    for i in range(len(weights)):\n        wt, val = weights[i], values[i]\n        # TODO: sweep w from capacity DOWN to wt (descending) so each item is used once\n        #   for w in range(capacity, wt - 1, -1):\n        #       dp[w] = max(dp[w], dp[w - wt] + val)\n        pass\n\n    return dp[capacity]\n",
    constraints: [
      "Sweep the capacity DESCENDING (from capacity down to wt): this keeps dp[w - wt] at its pre-item value, so each item is used at most once.",
      "The transition is skip-vs-take: dp[w] = max(dp[w] (skip), dp[w - wt] + val (take)).",
      "The answer is dp[capacity]; the single array replaces the full 2D dp[item][capacity] table.",
    ],
    walkthrough: {
      title: "Fold in one item at a time, swept high to low",
      steps: [
        { title: "One array, one item at a time", detail: "dp[w] is the best value within capacity w using the items processed so far; you fold in each item by updating the array in place.", input: "the rolling dp array", output: "dp after this item" },
        { title: "Descending sweep", detail: "Sweep w from capacity down to the item's weight. Going high to low, dp[w - wt] still holds the value from before this item, so taking the item cannot reuse it.", input: "the capacity axis", output: "a use-once update" },
        { title: "Skip vs take", detail: "dp[w] = max(dp[w], dp[w - wt] + val): keep the better of not taking the item or taking it and freeing wt of capacity.", input: "the current item", output: "the updated dp[w]" },
      ],
    },
    io_examples: [
      { label: "classic", input: "weights=[1,3,4,5], values=[1,4,5,7], capacity=7", expected_output: "9", explanation: "Take the weight-3 (value 4) and weight-4 (value 5) items for total value 9 within capacity 7." },
      { label: "tight fit", input: "weights=[1,2,3], values=[6,10,12], capacity=5", expected_output: "22", explanation: "Items of weight 2 and 3 (values 10 + 12) exactly fill capacity 5." },
      { label: "too heavy", input: "weights=[5], values=[10], capacity=4", expected_output: "0", explanation: "The only item does not fit, so the best value is 0." },
    ],
    visualization: {
      title: "rolling array · descending sweep · skip vs take",
      description: "Each item folds into one dp array; descending keeps it use-once.",
      items: [
        { label: "for w = capacity..wt", value: "descending", role: "input" },
        { label: "dp[w] = max(dp[w], dp[w-wt]+val)", value: "skip vs take", role: "process" },
        { label: "dp[capacity]", value: "the answer", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The rolling 1D knapsack template",
        code:
          "def knapsack(weights, values, capacity):\n    dp = [0] * (capacity + 1)\n    for i in range(len(weights)):\n        wt, val = weights[i], values[i]\n        for w in range(capacity, wt - 1, -1):\n            dp[w] = max(dp[w], dp[w - wt] + val)\n    return dp[capacity]",
        explanation: "One array, folded item by item. The descending inner sweep protects dp[w - wt]'s pre-item value, guaranteeing each item is used at most once. O(n·W) time, O(W) space.",
      },
      {
        label: "concise",
        title: "The unbounded variant is one flip away (coin-style)",
        code:
          "def knapsack_unbounded(weights, values, capacity):\n    dp = [0] * (capacity + 1)\n    for i in range(len(weights)):\n        wt, val = weights[i], values[i]\n        for w in range(wt, capacity + 1):   # ASCENDING: item can repeat\n            dp[w] = max(dp[w], dp[w - wt] + val)\n    return dp[capacity]",
        explanation: "The exact same transition swept ASCENDING lets dp[w - wt] already include the current item, so an item can be taken multiple times — the unbounded knapsack. Only the loop direction changed.",
      },
    ],
    hints: [
      { level: 1, text: "One array dp of size capacity+1, all zeros; fold in items one at a time." },
      { level: 2, text: "For 0/1 (use each item once), the inner loop must go DESCENDING: for w in range(capacity, wt-1, -1)." },
      { level: 3, text: "Transition: dp[w] = max(dp[w], dp[w - wt] + val) — skip the item, or take it and add its value." },
      { level: 4, text: "Descending protects dp[w - wt]: it still holds the pre-item value, so the item is not reused." },
      { level: 5, text: "Return dp[capacity]. If you swept ascending instead, you'd be solving unbounded knapsack." },
    ],
    tests: [
      { id: "t_classic", description: "classic knapsack", assert: "assert knapsack([1,3,4,5],[1,4,5,7],7) == 9" },
      { id: "t_tight", description: "exact fill", assert: "assert knapsack([1,2,3],[6,10,12],5) == 22" },
      { id: "t_heavy", description: "item too heavy", assert: "assert knapsack([5],[10],4) == 0" },
    ],
    hidden_tests: [
      { id: "h_empty", description: "no items", assert: "assert knapsack([],[],10) == 0" },
      { id: "h_pair", description: "two-item pick", assert: "assert knapsack([2,3,4,5],[3,4,5,6],5) == 7" },
      { id: "h_zero_cap", description: "zero capacity", assert: "assert knapsack([1,2],[5,6],0) == 0" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "dp2-so-1",
        type: "select_one",
        prompt: "In the rolling 1D 0/1 knapsack, why must you sweep the capacity from high to low?",
        concept: "dynamic-programming",
        difficulty: "easy",
        choices: [
          "So dp[w - wt] still holds the previous item's value, keeping each item used at most once",
          "To visit larger capacities first for speed",
          "Because Python ranges must count down",
          "To avoid an index-out-of-range error",
        ],
        correct_index: 0,
        explanation: "Descending protects the pre-item value at dp[w - wt]; sweeping ascending would reuse the item (that is unbounded knapsack).",
      },
      {
        id: "dp2-sa-multi",
        type: "select_all",
        prompt: "Which statements about the rolling 1D knapsack are true?",
        concept: "dynamic-programming",
        difficulty: "medium",
        choices: [
          "The transition dp[w] = max(dp[w], dp[w-wt]+val) is skip-vs-take",
          "The 2D table collapses to 1D because the transition only reads the previous item's row",
          "Sweeping ascending instead solves the unbounded (reuse-allowed) variant",
          "Time is O(capacity) regardless of the number of items",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Time is O(items × capacity), pseudo-polynomial. The other three are the core facts.",
      },
      {
        id: "dp2-sa-none",
        type: "select_all",
        prompt: "For knapsack([1,3,4,5],[1,4,5,7],7) = 9, which of these describe the optimal pick? (If none, select none.)",
        concept: "dynamic-programming",
        difficulty: "hard",
        choices: [
          "Take the weight-5 item (value 7) plus the weight-1 item (value 1) for 8",
          "Take all four items",
          "Take the weight-1, weight-3, and weight-4 items for value 10",
        ],
        correct_indices: [],
        explanation: "None: the optimum is weight-3 + weight-4 = value 9. Option 1 gives 8; all four exceed capacity 7; weights 1+3+4=8 also exceed 7, so value 10 is unreachable.",
      },
      {
        id: "dp2-order",
        type: "ordering",
        prompt: "Order the steps to fold ONE item into the rolling knapsack array.",
        concept: "dynamic-programming",
        difficulty: "medium",
        items: [
          "Read the item's weight wt and value val",
          "Start w at capacity and sweep DOWN to wt",
          "dp[w] = max(dp[w], dp[w - wt] + val)",
          "Move to the next item once the sweep finishes",
        ],
        correct_order: [
          "Read the item's weight wt and value val",
          "Start w at capacity and sweep DOWN to wt",
          "dp[w] = max(dp[w], dp[w - wt] + val)",
          "Move to the next item once the sweep finishes",
        ],
      },
      {
        id: "dp2-pattern",
        type: "pattern_recognition",
        prompt: "\"Can this array be split into two subsets with equal sum?\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Dynamic Programming (0/1 knapsack / subset sum)", "Boolean reachability over a target", "Two Pointer", "Greedy", "Binary Search"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Partition Equal Subset Sum is subset-sum to total/2, a boolean 0/1 knapsack: dp[s] = can we hit sum s, swept descending so each number is used once.",
      },
      {
        id: "dp2-written",
        type: "written",
        prompt: "You have a working rolling-array 0/1 knapsack, but a teammate changes the inner loop to sweep capacity ascending and now items appear multiple times. Explain precisely why, and what problem the ascending version actually solves.",
        concept: "dynamic-programming",
        difficulty: "hard",
        actual_answer:
          "The single dp array plays two roles at once: before you touch a cell it holds the previous item's value, and after you touch it, it holds the current item's value. The transition dp[w] = max(dp[w], dp[w - wt] + val) reads a lower cell, dp[w - wt]. Whether that lower cell has already been updated for the current item depends entirely on sweep direction. Sweeping descending, you compute high w before low w, so when you read dp[w - wt] it has not yet been visited this pass and still holds the previous item's value — the item is added on top of a state that does not include it, so it is used at most once. Sweeping ascending, you compute low w before high w, so dp[w - wt] has already been updated to include the current item; adding the item again on top of that stacks it a second, third, and further time. That is not a bug in general — it is exactly the unbounded knapsack, where each item may be taken any number of times, and it is the same machine coin change uses. So the ascending version correctly solves unbounded knapsack; it is only wrong when the problem demands each item be used at most once. The fix for 0/1 is to restore the descending sweep.",
        rubric:
          "Full credit: the array doubles as prev/current row; descending keeps dp[w-wt] pre-item (use once), ascending makes it already-include-item (reuse); ascending correctly solves unbounded knapsack. Partial: says ascending reuses without explaining the read-order. Low: vague.",
      },
    ],
  },
};

// ── Final integrator practice_code: Longest Increasing Subsequence (LC 300) ───
const finalCode = {
  prompt:
    "Integrator: return the length of the longest strictly increasing subsequence. This reuses the 'dp ends at i' state from Kadane, but with a look-back over all earlier indices. Fill in the TODO: dp[i] starts at 1 (the element alone); for each i, scan every earlier j, and if nums[j] < nums[i], set dp[i] = max(dp[i], dp[j] + 1). The answer is the max of dp.",
  starter_code:
    "def length_of_lis(nums):\n    if not nums:\n        return 0\n    dp = [1] * len(nums)  # dp[i] = LIS length ending exactly at i\n\n    for i in range(len(nums)):\n        # TODO:\n        #   for j in range(i):\n        #       if nums[j] < nums[i]:\n        #           dp[i] = max(dp[i], dp[j] + 1)\n        pass\n\n    return max(dp)\n",
  constraints: [
    "State: dp[i] is the length of the longest strictly increasing subsequence ENDING exactly at index i; initialize every dp[i] to 1.",
    "Transition: for each i, extend the best compatible earlier subsequence — dp[i] = max over j<i with nums[j]<nums[i] of dp[j]+1.",
    "The answer is max(dp), not dp[-1], because the longest subsequence can end at any index.",
  ],
  walkthrough: {
    title: "dp ends at i, extended by a look-back",
    steps: [
      { title: "Seed each cell at 1", detail: "Every element alone is an increasing subsequence of length 1, so dp[i] starts at 1.", input: "nums", output: "dp filled with 1" },
      { title: "Look back for extensions", detail: "For each i, scan all earlier j; whenever nums[j] < nums[i], the subsequence ending at j can be extended by i, giving dp[j] + 1.", input: "the current index i", output: "the best extension" },
      { title: "Take the global max", detail: "The longest subsequence can end anywhere, so the answer is the maximum dp value, not the last one.", input: "dp", output: "the LIS length" },
    ],
  },
  io_examples: [
    { label: "classic", input: "nums = [10,9,2,5,3,7,101,18]", expected_output: "4", explanation: "One longest increasing subsequence is [2,3,7,101], length 4." },
    { label: "with dips", input: "nums = [0,1,0,3,2,3]", expected_output: "4", explanation: "[0,1,2,3] has length 4." },
    { label: "all equal", input: "nums = [7,7,7,7]", expected_output: "1", explanation: "Strictly increasing forbids equal values, so the answer is 1." },
  ],
  visualization: {
    title: "dp ends at i · look back · take the max",
    description: "Each cell extends the best compatible earlier subsequence.",
    items: [
      { label: "dp[i] = 1", value: "element alone", role: "input" },
      { label: "nums[j] < nums[i]", value: "dp[i] = max(dp[i], dp[j]+1)", role: "process" },
      { label: "max(dp)", value: "the LIS length", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "The O(n^2) dp-ends-at-i template",
      code:
        "def length_of_lis(nums):\n    if not nums:\n        return 0\n    dp = [1] * len(nums)\n    for i in range(len(nums)):\n        for j in range(i):\n            if nums[j] < nums[i]:\n                dp[i] = max(dp[i], dp[j] + 1)\n    return max(dp)",
      explanation: "dp[i] is the LIS ending at i; the inner loop extends the best compatible earlier run. Bulletproof and easy to modify (reconstruction, custom comparisons). O(n^2) time.",
    },
    {
      label: "concise",
      title: "The O(n log n) patience-tails variant",
      code:
        "import bisect\ndef length_of_lis(nums):\n    tails = []  # tails[k] = smallest tail of an increasing subsequence of length k+1\n    for x in nums:\n        i = bisect.bisect_left(tails, x)\n        if i == len(tails):\n            tails.append(x)\n        else:\n            tails[i] = x\n    return len(tails)",
      explanation: "Keep each length's smallest possible ending; binary-search the first tail >= x and overwrite it, or append if x beats every tail. tails is not a real subsequence, but its length is the LIS. O(n log n).",
    },
  ],
  hints: [
    { level: 1, text: "dp[i] = 1 for all i: every single element is an increasing subsequence of length 1." },
    { level: 2, text: "For each i, look back at every earlier j: if nums[j] < nums[i], you can extend that subsequence by i." },
    { level: 3, text: "dp[i] = max(dp[i], dp[j] + 1) inside the j-loop." },
    { level: 4, text: "Use strict '<' (not '<=') so equal values do not count as increasing." },
    { level: 5, text: "Return max(dp), because the longest subsequence can end at any index, not necessarily the last." },
  ],
  tests: [
    { id: "f_classic", description: "classic LIS", assert: "assert length_of_lis([10,9,2,5,3,7,101,18]) == 4" },
    { id: "f_dips", description: "with dips", assert: "assert length_of_lis([0,1,0,3,2,3]) == 4" },
    { id: "f_equal", description: "all equal → 1", assert: "assert length_of_lis([7,7,7,7]) == 1" },
  ],
  hidden_tests: [
    { id: "hf_empty", description: "empty input", assert: "assert length_of_lis([]) == 0" },
    { id: "hf_decr", description: "strictly decreasing → 1", assert: "assert length_of_lis([4,3,2,1]) == 1" },
    { id: "hf_incr", description: "already increasing", assert: "assert length_of_lis([1,2,3,4,5]) == 5" },
  ],
};

// ── Timed code drill: Coin Change (LeetCode 322) ──────────────────────────────
const codeDrill = {
  pattern: "dynamic-programming",
  prompt:
    "One rep, timed: given coin denominations and an amount, return the fewest coins that sum to the amount, or -1 if it cannot be made. This is UNBOUNDED knapsack — each coin may repeat — so dp[a] = fewest coins for amount a, and you sweep the amount ASCENDING so a coin can be reused. dp[a] = min(dp[a], dp[a - c] + 1) over each coin c that fits.",
  target_seconds: 420,
  difficulty: "medium",
  language: "python",
  starter_code:
    "def coin_change(coins, amount):\n    INF = amount + 1  # unreachable sentinel (amount+1 coins is impossible)\n    dp = [0] + [INF] * amount  # dp[0]=0; dp[a]=fewest coins for amount a\n\n    for a in range(1, amount + 1):\n        # TODO: for c in coins:\n        #           if c <= a:\n        #               dp[a] = min(dp[a], dp[a - c] + 1)\n        pass\n\n    return dp[amount] if dp[amount] != INF else -1\n",
  tests: [
    { id: "d_classic", description: "11 = 5+5+1", assert: "assert coin_change([1,2,5], 11) == 3" },
    { id: "d_impossible", description: "cannot make 3 from {2}", assert: "assert coin_change([2], 3) == -1" },
    { id: "d_zero", description: "amount 0 needs 0 coins", assert: "assert coin_change([1], 0) == 0" },
    { id: "d_greedy_trap", description: "greedy fails: 27 = 10+10+5+2", assert: "assert coin_change([2,5,10,1], 27) == 4" },
    { id: "d_large", description: "6249 from {186,419,83,408}", assert: "assert coin_change([186,419,83,408], 6249) == 20" },
  ],
  hints: [
    { unlock_at_pct: 33, text: "dp[a] = fewest coins to make amount a. Seed dp[0]=0 and all others to a sentinel like amount+1 (unreachable)." },
    { unlock_at_pct: 66, text: "Sweep amount ASCENDING (this is unbounded — coins repeat): for each a, for each coin c<=a, dp[a]=min(dp[a], dp[a-c]+1)." },
    { unlock_at_pct: 100, text: "At the end, if dp[amount] is still the sentinel, the amount is unreachable → return -1, else return dp[amount]." },
  ],
  solution:
    "def coin_change(coins, amount):\n    INF = amount + 1\n    dp = [0] + [INF] * amount\n    for a in range(1, amount + 1):\n        for c in coins:\n            if c <= a:\n                dp[a] = min(dp[a], dp[a - c] + 1)\n    return dp[amount] if dp[amount] != INF else -1\n",
};

// ── Assessment (adaptive MC + freeform) ───────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Describe the four decisions every dynamic programming solution requires, and explain why naming the state precisely is the one that unblocks the rest.",
      type: "free_text",
      concept: "dynamic-programming",
      difficulty: "medium",
      actual_answer:
        "Every DP is four decisions in order: name the state — a precise one-sentence description of what a single table cell means; write the recurrence — how that cell is built from strictly smaller cells; pick the fill order — compute every cell a recurrence depends on before the cell itself; and set the base case — the smallest subproblems whose answers you know outright. Naming the state precisely is the decision that unblocks the others because the recurrence is only well defined once the cell's meaning is exact. A vague state such as 'the best answer using the first i elements' does not say whether element i is used, so you cannot say what you are allowed to append to, and the transition is ambiguous. Sharpen it to 'the longest increasing subsequence ending exactly at i' or 'the max subarray sum ending exactly at i' and the recurrence becomes forced: you look at compatible earlier cells and extend. So the precise state sentence is what converts the vague recognition 'this is DP' into an actual transition you can code in seconds, which is exactly the recall speed reactivation is trying to rebuild.",
      rubric:
        "Full credit: names state, recurrence, order, base case; explains a precise state makes the recurrence well defined (uses an 'ending exactly at i' style example); vague state → ambiguous transition. Partial: lists the four but not why state is primary. Low: vague.",
      support_ref: "dp-part-1-kadane",
    },
    {
      id: "a-free-2",
      text: "A candidate codes a rolling-array 0/1 knapsack but sweeps the capacity ascending, and items get counted multiple times. Explain the bug precisely and what problem the ascending version actually solves.",
      type: "free_text",
      concept: "dynamic-programming",
      difficulty: "hard",
      actual_answer:
        "The single dp array does double duty: before a cell is updated this pass it holds the previous item's value, and after, the current item's value. The transition dp[w] = max(dp[w], dp[w - wt] + val) reads the lower cell dp[w - wt], and whether that cell already includes the current item depends only on sweep direction. Sweeping descending computes high w before low w, so when you read dp[w - wt] it has not been touched this pass and still holds the pre-item value; the item is added on top of a state without it, so it is used at most once. Sweeping ascending computes low w first, so dp[w - wt] already includes the current item, and adding it again stacks the same item multiple times. That is precisely the unbounded knapsack, where each item may be taken any number of times — the same machine coin change uses. So the ascending version is not simply broken; it correctly solves unbounded knapsack and is only wrong when the problem requires each item at most once. To fix the 0/1 version, restore the descending sweep.",
      rubric:
        "Full credit: the array is both prev/current row; descending keeps dp[w-wt] pre-item (use once); ascending makes it already-include-item (reuse); ascending = correct unbounded knapsack. Partial: identifies descending-vs-ascending without the read-order reasoning. Low: vague.",
      support_ref: "dp-part-2-knapsack",
    },
    {
      id: "a-free-3",
      text: "Longest Increasing Subsequence has an O(n^2) dp-ends-at-i solution and an O(n log n) patience-tails solution. When would you reach for the slower one first, and why is it not simply obsolete?",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "medium",
      actual_answer:
        "The quadratic dp-ends-at-i version is the one to write first by reflex, even though it is asymptotically slower, because it is far more adaptable. Each cell is an explicit length ending at that index, so you can trace back through the dp array to reconstruct the actual subsequence, you can swap the comparison for a custom two-dimensional dominance test like the Russian-doll-envelopes problem, or you can change how ties are handled, all with a one-line change. The patience-tails version is faster but rigid: tails is not a real subsequence, only a set of best-case endings, so reconstructing the actual sequence from it takes extra bookkeeping, and a custom comparison does not slot in cleanly because the binary search assumes a total order. So the reactivation reflex is to code the quadratic version first, state aloud that it is order n squared, and only switch to patience tails if the interviewer explicitly asks to beat quadratic or the input is large enough to matter. The slower version is not obsolete because interview DP often wants the sequence itself or a nonstandard order, and the quadratic form bends to those where the fast form fights you.",
      rubric:
        "Full credit: quadratic dp-ends-at-i is adaptable (reconstruction, custom comparison, ties) via explicit per-cell lengths; patience-tails is faster but rigid (tails isn't a real subsequence); reach for fast one only when sub-quadratic is required. Partial: names both costs without the adaptability trade. Low: vague.",
      support_ref: "dp-part-2-knapsack",
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
        question: "What are the four decisions that define every dynamic programming solution?",
        choices: [
          "Name the state, write the recurrence, pick the fill order, set the base case",
          "Sort, search, partition, merge",
          "Recurse, memoize, prune, backtrack",
          "Choose a data structure, a loop, a variable, and a return",
        ],
        correct_index: 0,
        explanation: "State, recurrence, order, base case — said out loud, they make the code nearly automatic.",
        concept: "dynamic-programming",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "dp-part-1-kadane",
      },
      {
        id: "q2",
        question: "In Kadane's algorithm, best_here = max(x, best_here + x). Why is there no separate 'reset when negative' rule?",
        choices: [
          "Extending beats restarting only when the previous best_here is positive, so the max restarts automatically when it is negative",
          "Because the input is assumed to be non-negative",
          "Because best is always larger than best_here",
          "Because the array is scanned right to left",
        ],
        correct_index: 0,
        explanation: "best_here_prev + x beats x by exactly best_here_prev, so a negative prev makes the max pick x — a restart.",
        concept: "dynamic-programming",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "dp-part-1-kadane",
      },
      {
        id: "q3",
        question: "How should best_here and best be initialized in Kadane's algorithm?",
        choices: [
          "Both to nums[0], so all-negative inputs return the largest single element",
          "Both to 0",
          "best_here to 0 and best to negative infinity",
          "Both to the sum of the array",
        ],
        correct_index: 0,
        explanation: "Seeding at 0 wrongly returns an empty subarray (0) for all-negative inputs; seed at nums[0].",
        concept: "dynamic-programming",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "dp-part-1-kadane",
      },
      {
        id: "q4",
        question: "In the rolling 1D 0/1 knapsack, why sweep the capacity from high to low?",
        choices: [
          "So dp[w - wt] still holds the previous item's value, keeping each item used at most once",
          "To finish larger capacities sooner",
          "Because the answer is at dp[capacity]",
          "To avoid negative indices",
        ],
        correct_index: 0,
        explanation: "Descending protects the pre-item value; ascending would reuse the item (unbounded knapsack).",
        concept: "dynamic-programming",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "dp-part-2-knapsack",
      },
      {
        id: "q5",
        question: "What is the time/space of the rolling 1D 0/1 knapsack over n items and capacity W?",
        choices: [
          "O(n·W) time, O(W) space",
          "O(n log W) time, O(1) space",
          "O(n²) time, O(n) space",
          "O(W) time, O(n) space",
        ],
        correct_index: 0,
        explanation: "Each item sweeps the capacity axis once; one rolling row replaces the full 2D table — pseudo-polynomial in W.",
        concept: "dynamic-programming",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "dp-part-2-knapsack",
      },
      {
        id: "q6",
        question: "For coin change (fewest coins, coins reusable), which sweep direction and why?",
        choices: [
          "Amount ascending, so dp[a - c] can already include the current coin, allowing reuse",
          "Amount descending, to forbid reuse",
          "Coins descending, largest first (greedy)",
          "Either direction gives the same answer",
        ],
        correct_index: 0,
        explanation: "Coin change is unbounded knapsack: sweeping the amount ascending lets a coin repeat.",
        concept: "dynamic-programming",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "dp-part-2-knapsack",
      },
      {
        id: "q7",
        question: "Which problems are dynamic-programming fingerprints from this lesson? (Select all that apply.)",
        choices: [
          "\"maximum contiguous subarray sum\"",
          "\"fewest coins to make an amount\"",
          "\"find the two numbers that sum to a target\"",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "Max subarray (Kadane) and coin change are DP; two-sum is a hashing job, not DP.",
        concept: "pattern-recognition",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "dp-part-1-kadane",
      },
      {
        id: "q8",
        question: "Why write the O(n²) dp-ends-at-i version of LIS before the O(n log n) one?",
        choices: [
          "It is far more adaptable — reconstruction, custom comparisons, tie handling are one-line changes",
          "It uses less memory",
          "It is the only correct version",
          "The patience-tails version is wrong for duplicates",
        ],
        correct_index: 0,
        explanation: "Explicit per-cell lengths bend to variations; patience tails is faster but rigid. Switch to it only when sub-quadratic is required.",
        concept: "pattern-recognition",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "dp-part-2-knapsack",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-dp-recognize", prompt: "Given a fresh problem, how fast can you now name the DP state as a precise 'ending exactly at i' style sentence and write the recurrence?", hint: "The state sentence is what forces the transition; drill it first." },
  { id: "diag-dp-direction", prompt: "Can you state in one sentence when a rolling knapsack array is swept descending vs ascending, and what each means?", hint: "Descending = use once (0/1); ascending = reuse (unbounded / coin change)." },
  { id: "diag-dp-kadane", prompt: "Could you write Kadane, coin change, and LIS from memory in under 5 minutes each right now? What slows you down?", hint: "Execution speed on base cases and loop bounds is the interview bottleneck." },
  { id: "diag-dp-base", prompt: "Can you list the four DP traps and catch them in your own code before running it?", hint: "Fill order, base cases, vague state, unreachable sentinel." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "DP reactivation in the interview-pattern map",
  description:
    "This lesson reactivates the dynamic-programming machine at interview speed: the four decisions (state, recurrence, order, base case), Kadane's 1D running scalar, the rolling 0/1 knapsack swept descending, the coin-change reuse flip (ascending), and the LIS integrator. Graph reactivation is the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "dp-four", label: "State · recurrence · order · base", category: "lesson_concept", covered: true },
    { id: "dp-kadane", label: "Kadane (1D running)", category: "lesson_concept", covered: true },
    { id: "dp-knapsack", label: "0/1 Knapsack (rolling, descending)", category: "lesson_concept", covered: true },
    { id: "dp-lis", label: "Longest Increasing Subsequence", category: "lesson_concept", covered: true },
    { id: "monotonic-stack", label: "Monotonic Stack (prior)", category: "concept", covered: true },
    { id: "coin-change", label: "Coin change (unbounded)", category: "concept", preview: true },
    { id: "graph-reactivation", label: "Graph reactivation (next)", category: "concept" },
  ],
  edges: [],
  curriculum_stages: [
    { id: "trie", label: "Trie / Prefix Tree", status: "done" },
    { id: "backtracking", label: "Backtracking", status: "done" },
    { id: "monotonic-stack", label: "Monotonic Stack", status: "done" },
    { id: "dp-reactivation", label: "DP reactivation", status: "current" },
    { id: "graph-reactivation", label: "Graph reactivation", status: "next" },
    { id: "system-design", label: "System Design algo patterns", status: "later" },
  ],
  current: "dp-reactivation",
};

const planningRationale =
  "Dynamic programming is reactivated rather than taught because the imported repo evidence flags it as one of the learner's most-practiced but stalest areas — longest-increasing-subsequence, general DP, and knapsack all carry heavy historical comfort, so the bottleneck is recall speed, not understanding. The lesson is built around one reusable mental model, the four decisions (name the state, write the recurrence, pick the fill order, set the base case), because a precise state sentence is the single move that converts 'I know it is DP' into a forced transition, which is exactly the recall the learner needs to rebuild. Part one grounds the model on Kadane's maximum subarray, the purest 1D running DP, where the extend-or-restart max makes 'reset on negative' a consequence of the recurrence rather than a bolted-on rule, and the all-negatives seeding trap is taught explicitly. Part two attacks the highest-value reactivation target, the rolling 0/1 knapsack, teaching the descending capacity sweep as the exact mechanism that keeps each item used once, and framing the ascending flip as the unbounded variant so knapsack and coin change unify into one machine. The scaffolded exercises (Kadane, knapsack) plus the LIS integrator (dp-ends-at-i with the patience-tails contrast) and a timed Coin Change drill (unbounded knapsack) build execution speed, while pattern_recognition questions and a fill-order-bug case build the recognition and debugging judgment that separates fast interviewees from those who rederive the technique under pressure. It connects backward to the monotonic-stack lesson's 'store what is unresolved' framing and forward to graph reactivation.";

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
  bad = fail("Part 1 (Kadane)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (knapsack)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code (LIS)", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Code drill (coin change)", validateCodeDrillContent(codeDrill)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1400)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Dynamic Programming Reactivation: State, Recurrence, Order, Base Case — at Speed";
  const description =
    "You already know DP — this lesson rebuilds the speed to write the right recurrence from memory in under two minutes. Every DP is four decisions: name the state (what one cell means, precisely), write the recurrence (how a cell builds on smaller cells), pick the fill order (dependencies first), and set the base case. Drills Kadane's 1D running scalar, the rolling 0/1 knapsack swept descending (use once) versus the coin-change ascending flip (reuse), and the Longest Increasing Subsequence integrator with its O(n²) and O(n log n) forms.";
  const goals = JSON.stringify([
    "Recall the four DP decisions (state, recurrence, order, base case) and name a precise state sentence for a fresh problem in under 2 minutes",
    "Write Kadane, rolling 0/1 knapsack, LIS, and coin change from memory to interview timing, with correct base cases and loop bounds",
    "Explain the descending-vs-ascending sweep (use-once vs reuse) that unifies 0/1 knapsack and coin change, and the four DP traps",
  ]);
  const tags = JSON.stringify(["dynamic-programming", "kadane", "knapsack", "lis", "coin-change", "reactivation", "interview-prep"]);
  const overviewAudioContent = {
    script: OVERVIEW_SCRIPT,
    transcript: OVERVIEW_SCRIPT,
    duration_hint: 1400,
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
    insertAct.run(lessonId, "audio", 1, "Audio: DP reactivation — the four decisions at speed", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Kadane — a 1D running scalar", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: 0/1 Knapsack — a rolling row swept descending", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: Longest Increasing Subsequence", JSON.stringify(finalCode));
    insertAct.run(lessonId, "code_drill", 5, "Drill: Coin Change (unbounded knapsack)", JSON.stringify(codeDrill));
    insertAct.run(lessonId, "assessment", 6, "Assessment: DP reactivation recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 6 activities.`);
  closeDb();
}

main();
