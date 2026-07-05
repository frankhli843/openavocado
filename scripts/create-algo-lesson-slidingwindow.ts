#!/usr/bin/env tsx
/**
 * P2.2 — Lesson 2 of the "Coding Interview Mastery" subject (id 9):
 * "Sliding Window: Turn Nested Loops Into One Pass".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in
 * this env). Weak-pattern-first: Sliding Window is Frank's #1 tracked gap.
 *
 * Structure: top-level 2-host overview audio + orientation visual, two collapsed
 * lesson_parts (fixed-size window, variable-size window) each with a bespoke
 * approved artifact + per-part audio synced visual + scaffolded code + mixed
 * practice (incl. pattern_recognition), a final integrator practice_code, and an
 * adaptive MC + freeform assessment. Cue timings are provisional and rescaled to
 * the real generated audio duration by rescale-slidingwindow-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-sw-overview-map, algo-sw-fixed-window, algo-sw-variable-window
 *
 * Idempotent: replaces any prior seq=1 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-slidingwindow.ts
 */

import { getDb, closeDb } from "../src/db/connection";
import {
  validateLessonPartContent,
  validatePracticeCodeContent,
  validateAssessmentContent,
  validateAudioSyncedVisualContent,
  validateNextLessonDiagnostics,
} from "../src/lib/lesson-content/schema";
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/sliding-window-audio";

const SUBJECT_ID = 9;
const SEQ = 1;

const A_OVERVIEW = "algo-sw-overview-map";
const A_FIXED = "algo-sw-fixed-window";
const A_VARIABLE = "algo-sw-variable-window";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "sw-orientation",
    title: "Sliding Window: the family map",
    motif: "cost-collapse-and-two-branches",
    description:
      "Orientation for the whole pattern: brute-force O(n·k) collapses to O(n) by repairing the window's ends, and the family splits into a fixed-size branch and a variable-size branch.",
    panels: [
      {
        id: "cost",
        title: "Cost collapse",
        kind: "flow" as const,
        description: "Why the pattern exists: recomputing every window is O(n·k); reusing the overlap is O(n).",
        data: [
          { label: "recompute each window", value: "O(n·k)", role: "input" as const },
          { label: "reuse the overlap", value: "repair the two ends", role: "process" as const },
          { label: "slide & update ends", value: "O(n)", role: "output" as const },
        ],
      },
      {
        id: "branches",
        title: "Two branches",
        kind: "cards" as const,
        description: "Fixed-size window (width pinned by k) versus variable-size window (width breathes to keep a rule true).",
        data: [
          { label: "fixed-size", value: "size k · left trails right", role: "context" as const },
          { label: "variable-size", value: "expand right, shrink left", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 130, label: "The wasteful nested loop", headline: "Every window re-added from scratch", narration: "A size-three window over eight numbers, re-summed at every start, is O(n·k) work.", receive: "an array and a window question", transform: "brute-force re-summation", pass: "a baseline cost to beat" },
    { start: 130, end: 300, label: "The overlap insight", headline: "Only the two ends change", narration: "Adjacent windows share their middle; only one element leaves and one enters.", receive: "two adjacent windows", transform: "subtract the leaver, add the enterer", pass: "a running total repaired in O(1)" },
    { start: 300, end: 470, label: "Fixed-size branch", headline: "Width pinned by k", narration: "The left boundary trails the right by a constant gap and they slide in lockstep.", receive: "a fixed width k", transform: "lockstep slide", pass: "linear scan of all windows" },
    { start: 470, end: 700, label: "Variable-size branch", headline: "The window breathes", narration: "Right expands greedily; left shrinks only when a rule breaks — longest-no-repeat.", receive: "a validity rule", transform: "expand right / shrink left", pass: "the best legal window" },
    { start: 700, end: 850, label: "Amortized linearity", headline: "Count travel, not nested loops", narration: "Each index enters once and leaves at most once, so total pointer travel is O(n).", receive: "an inner shrink loop", transform: "amortized accounting", pass: "confidence it is still linear" },
    { start: 850, end: 1000, label: "When it fails", headline: "Contiguous + monotonic only", narration: "Non-contiguous answers or negative numbers break the window's monotonic promise.", receive: "a candidate problem", transform: "two recognition checks", pass: "a go / no-go decision" },
    { start: 1000, end: 1120, label: "Recognition & template", headline: "Fingerprint and skeleton", narration: "Trigger phrases plus the fixed skeleton: two boundaries, repair the ends, record.", receive: "an interview prompt", transform: "map to the skeleton", pass: "a fast correct solution" },
  ],
};

// ── Reading builder helpers ───────────────────────────────────────────────────
const complexityFormula = {
  type: "formula",
  latex: "O(n \\cdot k) \\;\\longrightarrow\\; O(n)",
  plain_english:
    "Re-summing every window costs the number of windows times the window width; sliding and repairing only the two ends removes the width factor, leaving a single linear pass.",
  variables: [
    { symbol: "n", meaning: "the number of elements in the array or characters in the string" },
    { symbol: "k", meaning: "the window width (for a fixed-size window) — the factor sliding removes" },
  ],
};

// ── Part 1: fixed-size window ─────────────────────────────────────────────────
const part1 = {
  part_id: "sw-part-1-fixed",
  reading: {
    blocks: [
      { type: "heading", text: "Fixed-size window: pay full price once, then only repair the ends" },
      {
        type: "paragraph",
        text:
          "A fixed-size window has a width pinned by the problem — a subarray of size k, a substring of length k, exactly k elements. You compute the measure of the very first window honestly, then every later window is obtained by sliding one step: subtract the element that leaves the left edge and add the element that enters the right edge. The middle of the window never changes, so you never re-touch it.",
      },
      {
        type: "definition",
        term: "Running aggregate",
        definition:
          "A single value (here a sum) that always describes the current window. Sliding never rebuilds it from scratch; it edits the two boundary elements, so the cost per slide is constant regardless of the window width.",
      },
      {
        type: "example",
        body:
          "Array 4, 2, 7, 1, 9, 3, 6, 5 with k = 3. First window 4+2+7 = 13. Slide: subtract 4, add 1, giving 10 (which equals 2+7+1). Slide: subtract 2, add 9, giving 17. Keep sliding to 1,9,3 = 13, then 9,3,6 = 18 — the true maximum. Two edits per step instead of three additions.",
      },
      complexityFormula,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_FIXED,
      scene: {
        scene_id: "sw-fixed-scene",
        title: "Repairing the window's two ends",
        motif: "subtract-leaver-add-enterer",
        description: "A size-3 window slides across eight numbers; each step subtracts the leaving element and adds the entering element to keep the running sum truthful.",
        panels: [
          {
            id: "array",
            title: "The array and the window",
            kind: "matrix" as const,
            description: "Eight integers with the current size-3 window highlighted and the best window outlined.",
            data: [
              { label: "window sum", value: "13 → 10 → 17 → 13 → 18", role: "process" as const },
              { label: "best so far", value: "18 (window 9,3,6)", role: "output" as const },
            ],
          },
          {
            id: "delta",
            title: "The per-slide edit",
            kind: "ledger" as const,
            description: "The subtract-the-leaver, add-the-enterer bookkeeping that makes each slide O(1).",
            data: [
              { label: "leaves (subtract)", value: "left edge element", role: "input" as const },
              { label: "enters (add)", value: "right edge element", role: "input" as const },
              { label: "cost per slide", value: "O(1)", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "First window full price", headline: "Sum the first k once", narration: "4 plus 2 plus 7 is 13 — the only full addition we ever do.", receive: "the first k elements", transform: "one honest sum", pass: "a running total of 13" },
        { start: 30, end: 62, label: "Slide one", headline: "Subtract 4, add 1", narration: "The 4 leaves, the 1 enters: 13 minus 4 plus 1 is 10.", receive: "the previous total 13", transform: "repair both ends", pass: "the new total 10" },
        { start: 62, end: 95, label: "Overlap is free", headline: "The middle never moves", narration: "The 2 and 7 sit in both windows and are never re-added.", receive: "two adjacent windows", transform: "carry the shared middle", pass: "work saved" },
        { start: 95, end: 128, label: "Slide two", headline: "Subtract 2, add 9", narration: "10 minus 2 plus 9 is 17 — a new best.", receive: "the previous total 10", transform: "repair both ends", pass: "the new best 17" },
        { start: 128, end: 150, label: "Constant per step", headline: "Width does not matter", narration: "A width of 3 or 300 costs the same per slide: one out, one in.", receive: "any window width", transform: "boundary-only edits", pass: "O(1) per slide" },
        { start: 150, end: 165, label: "Linear total", headline: "One setup, then a sweep", narration: "One full sum plus a constant edit at each remaining position is O(n).", receive: "the whole array", transform: "single sweep", pass: "the maximum window sum" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Drag the slider to slide the size-3 window across the array. Watch the running sum update by one subtract (the element leaving the left) and one add (the element entering the right), and the best-sum-so-far outline follow the largest window.",
    params: { artifact_slug: A_FIXED, min_height: 320 },
  },
  code: {
    prompt:
      "Return the maximum sum of any contiguous subarray of size k. Build the first window by summing the first k elements, then slide: for each new right index, add the entering element and subtract the element k positions behind it, tracking the best sum. Fill in the two TODO helpers, then compose them.",
    starter_code:
      "def window_sum_first(nums, k):\n    # TODO: return the sum of the first k elements (nums[0..k-1]).\n    # This is the only full-price sum you pay.\n    pass\n\n\ndef slide(prev_sum, entering, leaving):\n    # TODO: return the new window sum after one slide.\n    # 'entering' is the element that just entered on the right;\n    # 'leaving' is the element that just left on the left.\n    pass\n\n\ndef max_sum_size_k(nums, k):\n    # Compose the helpers: seed with window_sum_first, then slide across the rest.\n    if k <= 0 or k > len(nums):\n        return 0\n    best = current = window_sum_first(nums, k)\n    for right in range(k, len(nums)):\n        current = slide(current, nums[right], nums[right - k])\n        best = max(best, current)\n    return best\n",
    constraints: [
      "1 <= k <= len(nums)",
      "Do the first window in one pass, then O(1) work per slide — no re-summing whole windows.",
    ],
    walkthrough: {
      title: "From blank file to O(n) window sum",
      steps: [
        { title: "Seed the first window", detail: "window_sum_first adds nums[0] through nums[k-1] exactly once. This is the only place you touch all k elements together.", input: "nums, k", output: "sum of the first k elements" },
        { title: "Define one slide", detail: "slide takes the previous sum, adds the entering right element, and subtracts the leaving left element. Two arithmetic ops, independent of k.", input: "prev_sum, entering, leaving", output: "prev_sum + entering - leaving" },
        { title: "Compose across the array", detail: "Seed best and current with the first window, then for each right index from k onward, slide and update best. The left element that leaves is always nums[right - k].", input: "the full array", output: "the maximum window sum" },
      ],
    },
    io_examples: [
      { label: "new maximum mid-array", input: "nums = [4,2,7,1,9,3,6,5], k = 3", expected_output: "18", explanation: "Window 9,3,6 sums to 18, the largest size-3 block (7,1,9 is 17; keep sliding and 9,3,6 beats it)." },
      { label: "window equals whole array", input: "nums = [1,2,3], k = 3", expected_output: "6", explanation: "Only one window exists; its sum is 6." },
      { label: "single element windows", input: "nums = [5,1,4], k = 1", expected_output: "5", explanation: "Each window is one element; the max element is 5." },
    ],
    visualization: {
      title: "Input → repair → output",
      description: "How one slide transforms the running sum.",
      items: [
        { label: "previous sum", value: "13", role: "input" },
        { label: "add entering (1), subtract leaving (4)", value: "13 + 1 - 4", role: "process" },
        { label: "new window sum", value: "10", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Explicit helpers",
        code:
          "def window_sum_first(nums, k):\n    total = 0\n    for i in range(k):\n        total += nums[i]\n    return total\n\ndef slide(prev_sum, entering, leaving):\n    return prev_sum + entering - leaving\n\ndef max_sum_size_k(nums, k):\n    if k <= 0 or k > len(nums):\n        return 0\n    best = current = window_sum_first(nums, k)\n    for right in range(k, len(nums)):\n        current = slide(current, nums[right], nums[right - k])\n        best = max(best, current)\n    return best",
        explanation: "Readable version: each helper does one job, then max_sum_size_k composes them.",
      },
      {
        label: "concise",
        title: "Idiomatic Python",
        code:
          "def max_sum_size_k(nums, k):\n    if k <= 0 or k > len(nums):\n        return 0\n    current = sum(nums[:k])\n    best = current\n    for right in range(k, len(nums)):\n        current += nums[right] - nums[right - k]\n        best = max(best, current)\n    return best",
        explanation: "sum(nums[:k]) seeds the window; current += nums[right] - nums[right - k] is the slide inlined.",
      },
    ],
    hints: [
      { level: 1, text: "The first window is the only one you sum fully. After that, each window differs from the last by exactly two elements." },
      { level: 2, text: "window_sum_first: loop i from 0 to k-1 and accumulate nums[i]." },
      { level: 3, text: "slide(prev, entering, leaving) is simply prev + entering - leaving." },
      { level: 4, text: "The element leaving when the right pointer is at index 'right' is nums[right - k]." },
      { level: 5, text: "Full body: seed best=current=window_sum_first(nums,k); for right in range(k,len(nums)): current=slide(current,nums[right],nums[right-k]); best=max(best,current)." },
    ],
    tests: [
      { id: "t_mid", description: "picks the max size-3 window (9,3,6 = 18)", assert: "assert max_sum_size_k([4,2,7,1,9,3,6,5], 3) == 18" },
      { id: "t_whole", description: "k equals array length", assert: "assert max_sum_size_k([1,2,3], 3) == 6" },
      { id: "t_k1", description: "k = 1 returns the max element", assert: "assert max_sum_size_k([5,1,4], 1) == 5" },
    ],
    hidden_tests: [
      { id: "h_first_window_best", description: "best can be the first window", assert: "assert max_sum_size_k([9,9,1,1,1], 2) == 18" },
      { id: "h_negatives", description: "handles negative numbers (still just sums)", assert: "assert max_sum_size_k([-1,-2,-3,-4], 2) == -3" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "p1-so-1",
        type: "select_one",
        prompt: "When a fixed-size window slides one step to the right, how many array elements change membership?",
        concept: "sliding-window",
        difficulty: "easy",
        choices: ["Exactly two: one leaves the left, one enters the right", "All k elements", "Only the entering element", "It depends on the values"],
        correct_index: 0,
        explanation: "One element exits the left edge and one enters the right edge; the shared middle is unchanged.",
      },
      {
        id: "p1-sa-multi",
        type: "select_all",
        prompt: "Which statements about the O(1) slide update are true?",
        concept: "sliding-window",
        difficulty: "medium",
        choices: [
          "The cost per slide does not depend on k",
          "You add the entering element and subtract the leaving element",
          "You must re-sum all k elements each step",
          "The leaving element is nums[right - k] when the right pointer is at index right",
        ],
        correct_indices: [0, 1, 3],
        explanation: "The whole point is to avoid re-summing; the update is add-enter, subtract-leave, and the leaver is k behind the right pointer.",
      },
      {
        id: "p1-sa-none",
        type: "select_all",
        prompt: "Which of these are REQUIRED for a fixed-size window to be correct? (Select all that truly are; if none, select none.)",
        concept: "sliding-window",
        difficulty: "hard",
        choices: [
          "The array must be sorted first",
          "All numbers must be positive",
          "The window width must be a power of two",
        ],
        correct_indices: [],
        explanation: "None of these are required — a fixed-size window sum works on any integers in any order, including negatives, and any width.",
      },
      {
        id: "p1-order",
        type: "ordering",
        prompt: "Put the fixed-size-window algorithm steps in order.",
        concept: "sliding-window",
        difficulty: "medium",
        items: [
          "Sum the first k elements to seed the running total",
          "Set best equal to the first window's sum",
          "For each new right index, add the entering and subtract the leaving element",
          "Update best if the current window sum is larger",
        ],
        correct_order: [
          "Sum the first k elements to seed the running total",
          "Set best equal to the first window's sum",
          "For each new right index, add the entering and subtract the leaving element",
          "Update best if the current window sum is larger",
        ],
      },
      {
        id: "p1-pattern",
        type: "pattern_recognition",
        prompt: "\"Given an array of integers and a number k, find the maximum average of any contiguous subarray of length k.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Sliding Window", "Two Pointer", "Binary Search", "Dynamic Programming", "Heap / Priority Queue"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "\"Contiguous subarray of length k\" is the fixed-size sliding-window fingerprint. A two-pointer framing is a reasonable secondary lens since the window is bounded by two indices.",
      },
      {
        id: "p1-written",
        type: "written",
        prompt: "Explain, in your own words, why the per-slide cost of a fixed-size window is O(1) even though the window contains k elements.",
        concept: "sliding-window",
        difficulty: "medium",
        actual_answer:
          "Because sliding changes only the two boundary elements: the running sum is updated by adding the one element that enters on the right and subtracting the one that leaves on the left. The k-2 shared middle elements are carried over unchanged, so the work per slide is a constant two operations regardless of k.",
        rubric:
          "Full credit: identifies that only two elements change (one enters, one leaves) and the shared middle is reused, so the update is constant work independent of k. Partial: mentions add/subtract but not the reuse of the middle. Low: restates O(1) without the mechanism.",
      },
    ],
  },
};

// ── Part 2: variable-size window ──────────────────────────────────────────────
const part2 = {
  part_id: "sw-part-2-variable",
  reading: {
    blocks: [
      { type: "heading", text: "Variable-size window: expand right, shrink left, keep it legal" },
      {
        type: "paragraph",
        text:
          "In a variable-size window the width is not fixed — it grows and shrinks to keep some rule true. The right boundary sweeps forward once, greedily admitting each new element. Whenever admitting an element breaks the rule, the left boundary steps forward, releasing elements until the window is legal again. You record the best window each time it is valid.",
      },
      {
        type: "definition",
        term: "Amortized linear time",
        definition:
          "The inner shrink loop looks like it could make the algorithm quadratic, but each index is admitted once by the right boundary and released at most once by the left boundary. Total pointer travel is at most 2n, so the whole sweep is O(n).",
      },
      {
        type: "example",
        body:
          "String a, b, c, a, b, c, b, b, goal: longest stretch with no repeated letter. Admit a, b, c (length 3). The next a duplicates, so release the left a; now the new a fits (b, c, a). Continue; the best length seen is 3.",
      },
      {
        type: "callout",
        text:
          "The window trick is only safe when validity is monotonic in window size. For 'smallest subarray summing to at least a target', all-positive numbers make a wider window a bigger sum, so shrinking is safe. Introduce a negative number and that promise breaks — reach for prefix sums or a deque instead.",
      },
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_VARIABLE,
      scene: {
        scene_id: "sw-variable-scene",
        title: "The window breathes",
        motif: "expand-right-shrink-left",
        description: "Two pointers over 'abcabcbb': the right pointer expands to admit letters, the left pointer shrinks whenever a duplicate would break the no-repeat rule.",
        panels: [
          {
            id: "pointers",
            title: "Left / right boundaries",
            kind: "vector" as const,
            description: "The two pointers over the string; the window is the stretch between them.",
            data: [
              { label: "right", value: "expands each step", role: "process" as const },
              { label: "left", value: "shrinks on duplicate", role: "process" as const },
              { label: "best length", value: "3", role: "output" as const },
            ],
          },
          {
            id: "validity",
            title: "Validity check",
            kind: "ledger" as const,
            description: "The set of letters currently inside and the rule that governs shrinking.",
            data: [
              { label: "state", value: "set of letters in window", role: "context" as const },
              { label: "rule", value: "newcomer not already inside", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Expand a, b, c", headline: "Admit while legal", narration: "The right pointer admits a, b, c — the window a,b,c has length 3.", receive: "an empty window", transform: "greedy expansion", pass: "a legal window of length 3" },
        { start: 30, end: 66, label: "Duplicate a arrives", headline: "The rule is about to break", narration: "The next a is already inside; admitting it would create a repeat.", receive: "a duplicate letter", transform: "detect the violation", pass: "a signal to shrink" },
        { start: 66, end: 100, label: "Shrink from the left", headline: "Release the old a", narration: "Remove the leftmost a and advance the left pointer until the new a fits.", receive: "an illegal window", transform: "release from the left", pass: "a legal window b,c,a" },
        { start: 100, end: 132, label: "Why still linear", headline: "Each index moves once", narration: "Right moves forward once, left moves forward at most once — total travel is 2n.", receive: "an inner shrink loop", transform: "amortized accounting", pass: "an O(n) guarantee" },
        { start: 132, end: 150, label: "Swap the bookkeeping", headline: "Same skeleton, new rule", narration: "Change only the validity test — a set here, a distinct-count elsewhere.", receive: "a different constraint", transform: "reuse the skeleton", pass: "a new solution for free" },
        { start: 150, end: 165, label: "Record the best", headline: "Track the answer", narration: "Whenever the window is legal, update the best length seen.", receive: "each legal window", transform: "compare to best", pass: "the final answer" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Scrub the step slider or use Prev/Next to walk the two pointers over the string. Watch the right pointer expand to admit each letter and the left pointer shrink whenever a duplicate would break the no-repeat rule, while the best length is tracked.",
    params: { artifact_slug: A_VARIABLE, min_height: 340 },
  },
  code: {
    prompt:
      "Return the length of the longest substring of s with no repeating characters. Use two pointers: advance right across the string, and whenever the incoming character is already inside the window, advance left (removing characters from a set) until it is not. Fill in the two TODO helpers, then compose them.",
    starter_code:
      "def has_dup(window_set, ch):\n    # TODO: return True if ch is already in the current window set.\n    pass\n\n\ndef shrink_until_fits(s, left, right, window_set):\n    # TODO: while s[right] is already in window_set, remove s[left] and move left forward.\n    # Return the new left index (window_set is mutated in place).\n    pass\n\n\ndef longest_unique(s):\n    window_set = set()\n    left = 0\n    best = 0\n    for right in range(len(s)):\n        if has_dup(window_set, s[right]):\n            left = shrink_until_fits(s, left, right, window_set)\n        window_set.add(s[right])\n        best = max(best, right - left + 1)\n    return best\n",
    constraints: [
      "Right pointer sweeps the string once.",
      "Left pointer only moves forward; each character enters and leaves the set at most once.",
    ],
    walkthrough: {
      title: "Longest substring without repeats, two pointers",
      steps: [
        { title: "Detect a violation", detail: "has_dup checks whether the incoming character s[right] is already in the window set — the single validity test for this problem.", input: "window_set, incoming char", output: "True if it would create a repeat" },
        { title: "Shrink to restore validity", detail: "shrink_until_fits removes s[left] from the set and advances left while the incoming character is still present, returning the new left index.", input: "s, left, right, window_set", output: "the left index where the window is legal again" },
        { title: "Compose and record", detail: "For each right, shrink if needed, add the new character, and update best with the current window length right - left + 1.", input: "the full string", output: "the longest legal window length" },
      ],
    },
    io_examples: [
      { label: "classic", input: "s = \"abcabcbb\"", expected_output: "3", explanation: "\"abc\" is the longest run with no repeats." },
      { label: "all same", input: "s = \"bbbb\"", expected_output: "1", explanation: "Only single characters avoid a repeat." },
      { label: "empty string", input: "s = \"\"", expected_output: "0", explanation: "No characters, so the longest run is length 0." },
    ],
    visualization: {
      title: "Input → shrink → output",
      description: "One step where a duplicate forces a shrink.",
      items: [
        { label: "incoming char already inside", value: "s[right] = 'a'", role: "input" },
        { label: "release from left until it fits", value: "remove s[left], left += 1", role: "process" },
        { label: "legal window length", value: "right - left + 1", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Explicit helpers",
        code:
          "def has_dup(window_set, ch):\n    return ch in window_set\n\ndef shrink_until_fits(s, left, right, window_set):\n    while s[right] in window_set:\n        window_set.discard(s[left])\n        left += 1\n    return left\n\ndef longest_unique(s):\n    window_set = set()\n    left = 0\n    best = 0\n    for right in range(len(s)):\n        if has_dup(window_set, s[right]):\n            left = shrink_until_fits(s, left, right, window_set)\n        window_set.add(s[right])\n        best = max(best, right - left + 1)\n    return best",
        explanation: "Each helper does one job; longest_unique drives the two pointers and records the best length.",
      },
      {
        label: "concise",
        title: "Idiomatic Python",
        code:
          "def longest_unique(s):\n    seen = set()\n    left = best = 0\n    for right, ch in enumerate(s):\n        while ch in seen:\n            seen.discard(s[left])\n            left += 1\n        seen.add(ch)\n        best = max(best, right - left + 1)\n    return best",
        explanation: "enumerate gives (index, char); the while loop shrinks from the left until ch fits, then records the window length.",
      },
    ],
    hints: [
      { level: 1, text: "The right pointer always advances. The left pointer only advances when the incoming character is already inside the window." },
      { level: 2, text: "Track the current window with a set of characters so membership checks are O(1)." },
      { level: 3, text: "has_dup(window_set, ch) is just 'ch in window_set'." },
      { level: 4, text: "shrink_until_fits: while s[right] in window_set: remove s[left], left += 1; return left." },
      { level: 5, text: "After shrinking, add s[right] to the set and update best = max(best, right - left + 1)." },
    ],
    tests: [
      { id: "t_classic", description: "longest run in abcabcbb is 3", assert: "assert longest_unique('abcabcbb') == 3" },
      { id: "t_same", description: "all identical characters gives 1", assert: "assert longest_unique('bbbb') == 1" },
      { id: "t_empty", description: "empty string gives 0", assert: "assert longest_unique('') == 0" },
    ],
    hidden_tests: [
      { id: "h_pwwkew", description: "handles 'pwwkew' -> 3 (wke)", assert: "assert longest_unique('pwwkew') == 3" },
      { id: "h_unique", description: "all-unique string returns its length", assert: "assert longest_unique('abcdef') == 6" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "p2-so-1",
        type: "select_one",
        prompt: "In the longest-no-repeat window, when does the LEFT pointer move?",
        concept: "sliding-window",
        difficulty: "easy",
        choices: [
          "Only when the incoming character is already inside the window",
          "Every iteration, in lockstep with the right pointer",
          "Whenever the window reaches size k",
          "Never — only the right pointer moves",
        ],
        correct_index: 0,
        explanation: "The left pointer shrinks the window only to remove a duplicate; otherwise the right pointer keeps expanding.",
      },
      {
        id: "p2-sa-multi",
        type: "select_all",
        prompt: "Why is the two-pointer no-repeat scan O(n) despite its inner while loop? Select all correct reasons.",
        concept: "sliding-window",
        difficulty: "hard",
        choices: [
          "The right pointer moves forward exactly n times total",
          "The left pointer moves forward at most n times total",
          "Each character is added and removed from the set at most once",
          "The inner loop restarts the scan from the beginning each time",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Total pointer travel is bounded by 2n; the inner loop never rewinds, so it is amortized linear.",
      },
      {
        id: "p2-sa-none",
        type: "select_all",
        prompt: "For the plain 'longest substring without repeats' problem, which of these data structures are REQUIRED? (If none, select none.)",
        concept: "sliding-window",
        difficulty: "medium",
        choices: ["A min-heap", "A sorted list", "A monotonic stack"],
        correct_indices: [],
        explanation: "None are required — a simple set (or last-seen-index map) suffices; heaps, sorting, and stacks are unnecessary here.",
      },
      {
        id: "p2-order",
        type: "ordering",
        prompt: "Order the steps of the variable-size window loop body for one right index.",
        concept: "sliding-window",
        difficulty: "medium",
        items: [
          "Check whether the incoming character breaks the rule",
          "While it breaks the rule, remove the left character and advance left",
          "Add the incoming character to the window state",
          "Record the current window length if it is a new best",
        ],
        correct_order: [
          "Check whether the incoming character breaks the rule",
          "While it breaks the rule, remove the left character and advance left",
          "Add the incoming character to the window state",
          "Record the current window length if it is a new best",
        ],
      },
      {
        id: "p2-pattern",
        type: "pattern_recognition",
        prompt: "\"Find the length of the smallest contiguous subarray whose sum is greater than or equal to a target, given an array of POSITIVE integers.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Sliding Window", "Two Pointer", "Binary Search", "Dynamic Programming", "Monotonic Stack"],
        primary_indices: [0],
        secondary_indices: [1, 2],
        explanation: "\"Smallest contiguous subarray such that a condition holds\" over positive numbers is the variable-size sliding window. Two-pointer is the same mechanism; binary search on answer length is a valid alternate O(n log n) approach.",
      },
      {
        id: "p2-written",
        type: "written",
        prompt: "The variable-window trick for 'smallest subarray with sum >= target' assumes all numbers are positive. Explain what breaks if a negative number is allowed.",
        concept: "sliding-window",
        difficulty: "hard",
        actual_answer:
          "With only positive numbers, a wider window always has a larger-or-equal sum, so once the window reaches the target you can safely shrink from the left to find a smaller valid window without missing anything. A negative number breaks this monotonicity: widening the window can now lower the sum and shrinking can raise it, so shrinking when you think you have enough may discard a negative that was hurting you, leading to a wrong answer. You would switch to prefix sums with a monotonic deque or similar.",
        rubric:
          "Full credit: states that positivity makes sum monotonic in window size, so shrinking is safe, and that a negative destroys that monotonicity making expand/shrink decisions unreliable. Partial: mentions negatives cause problems without the monotonicity reason. Low: vague 'it fails'.",
      },
    ],
  },
};

// ── Final integrator practice_code ────────────────────────────────────────────
const finalCode = {
  prompt:
    "Integrator: return the length of the SMALLEST contiguous subarray of positive integers whose sum is at least target (0 if none exists). Combine both branches you learned: a right pointer that expands the running sum and a left pointer that shrinks it while the window still meets the target. Fill the two TODO helpers, then compose them.",
  starter_code:
    "def meets_target(current_sum, target):\n    # TODO: return True if the current window sum is at least target.\n    pass\n\n\ndef shrink_while_valid(nums, left, current_sum, target):\n    # TODO: while removing nums[left] keeps the sum >= target, remove it and move left.\n    # Return (new_left, new_current_sum). Record best OUTSIDE this helper.\n    pass\n\n\ndef min_subarray_len(nums, target):\n    left = 0\n    current = 0\n    best = len(nums) + 1\n    for right in range(len(nums)):\n        current += nums[right]\n        while meets_target(current, target):\n            best = min(best, right - left + 1)\n            left, current = shrink_while_valid_step(nums, left, current)\n    return 0 if best == len(nums) + 1 else best\n\n\ndef shrink_while_valid_step(nums, left, current):\n    # Provided: remove exactly one element from the left.\n    return left + 1, current - nums[left]\n",
  constraints: [
    "All numbers are positive (this is what makes shrinking safe).",
    "Return 0 when no subarray reaches the target.",
    "One linear pass: each index enters and leaves the window once.",
  ],
  walkthrough: {
    title: "Combine expand and shrink into one O(n) pass",
    steps: [
      { title: "Expand to reach the target", detail: "Add nums[right] to a running sum. meets_target reports whether the window now sums to at least target.", input: "running sum, target", output: "True once the window is big enough" },
      { title: "Shrink while still valid", detail: "While the window still meets the target, record its length and remove the leftmost element to try for something shorter. Positivity guarantees this never skips the true minimum.", input: "nums, left, current sum, target", output: "the shortest window ending at right" },
      { title: "Track the global best", detail: "best starts impossibly large; each valid window updates it. If it never changed, no subarray reached the target, so return 0.", input: "all right positions", output: "the smallest valid length or 0" },
    ],
  },
  io_examples: [
    { label: "typical", input: "nums = [2,3,1,2,4,3], target = 7", expected_output: "2", explanation: "The subarray [4,3] sums to 7 with length 2 — the shortest." },
    { label: "whole array needed", input: "nums = [1,1,1,1], target = 4", expected_output: "4", explanation: "Only the full array reaches 4." },
    { label: "impossible", input: "nums = [1,1,1], target = 7", expected_output: "0", explanation: "No subarray can reach 7, so return 0." },
  ],
  visualization: {
    title: "Input → expand/shrink → output",
    description: "The running sum grows on the right and is trimmed on the left.",
    items: [
      { label: "add nums[right]", value: "current += nums[right]", role: "input" },
      { label: "while current >= target: record, drop left", value: "best = min(best, len); left += 1", role: "process" },
      { label: "smallest valid length", value: "best or 0", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "Explicit helpers",
      code:
        "def meets_target(current_sum, target):\n    return current_sum >= target\n\ndef min_subarray_len(nums, target):\n    left = 0\n    current = 0\n    best = len(nums) + 1\n    for right in range(len(nums)):\n        current += nums[right]\n        while meets_target(current, target):\n            best = min(best, right - left + 1)\n            current -= nums[left]\n            left += 1\n    return 0 if best == len(nums) + 1 else best",
      explanation: "Expand the sum on the right; while it still meets the target, record the length and shrink from the left.",
    },
    {
      label: "concise",
      title: "Idiomatic Python",
      code:
        "def min_subarray_len(nums, target):\n    left = current = 0\n    best = float('inf')\n    for right, x in enumerate(nums):\n        current += x\n        while current >= target:\n            best = min(best, right - left + 1)\n            current -= nums[left]\n            left += 1\n    return 0 if best == float('inf') else best",
      explanation: "float('inf') as the sentinel avoids the len(nums)+1 bookkeeping; the loop body is the same expand/shrink.",
    },
  ],
  hints: [
    { level: 1, text: "Expand the window with the right pointer until the sum reaches the target, then shrink from the left as far as you can while staying at or above the target." },
    { level: 2, text: "meets_target(current, target) is just current >= target." },
    { level: 3, text: "Inside the while loop, record best = min(best, right - left + 1) BEFORE removing the left element." },
    { level: 4, text: "Shrink by current -= nums[left]; left += 1 while the window still meets the target." },
    { level: 5, text: "Use a sentinel like len(nums)+1 or float('inf') for best, and return 0 if it never changed." },
  ],
  tests: [
    { id: "f_typical", description: "shortest window [4,3] has length 2", assert: "assert min_subarray_len([2,3,1,2,4,3], 7) == 2" },
    { id: "f_whole", description: "needs the whole array", assert: "assert min_subarray_len([1,1,1,1], 4) == 4" },
    { id: "f_impossible", description: "returns 0 when unreachable", assert: "assert min_subarray_len([1,1,1], 7) == 0" },
  ],
  hidden_tests: [
    { id: "hf_single", description: "single element meets target", assert: "assert min_subarray_len([5,1,3], 5) == 1" },
    { id: "hf_exact", description: "exact target across two elements", assert: "assert min_subarray_len([1,4,4], 8) == 2" },
  ],
};

// ── Assessment (adaptive MC + freeform) ───────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Describe the single mechanical difference between a fixed-size window and a variable-size window, and give one trigger phrase from a problem statement that tells you which one to use.",
      type: "free_text",
      concept: "sliding-window",
      difficulty: "medium",
      actual_answer:
        "In a fixed-size window the left pointer trails the right by a constant gap k, so both move in lockstep and the width never changes ('subarray of size k' signals this). In a variable-size window the right pointer expands greedily and the left pointer moves only to restore a rule, so the width breathes ('longest/shortest subarray such that a condition holds' signals this).",
      rubric:
        "Full credit: fixed = constant gap / lockstep (width pinned by k) vs variable = expand right, shrink left to keep a rule (width changes), plus a correct trigger phrase for at least one. Partial: correct distinction but no trigger phrase. Low: conflates the two.",
      support_ref: "sw-part-1-fixed / sw-part-2-variable",
    },
    {
      id: "a-free-2",
      text: "A candidate says 'this asks for the maximum sum subsequence, so I'll use a sliding window.' Why is that the wrong pattern, and what is the giveaway word?",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "hard",
      actual_answer:
        "'Subsequence' means the chosen elements need not be contiguous, and you can skip around. A sliding window only works on contiguous runs where sliding changes just the two ends, so it does not apply. The giveaway word is 'subsequence' (versus 'subarray' or 'substring', which are contiguous). Non-contiguous selection problems usually point toward dynamic programming.",
      rubric:
        "Full credit: identifies that subsequence = non-contiguous, sliding window needs contiguity, and names 'subsequence' as the giveaway (bonus: suggests DP). Partial: says it isn't contiguous without naming the word. Low: unclear.",
      support_ref: "overview: when it fails",
    },
    {
      id: "a-free-3",
      text: "Explain why the inner shrink loop of a variable-size window does not make the algorithm O(n^2).",
      type: "free_text",
      concept: "complexity",
      difficulty: "medium",
      actual_answer:
        "Because both pointers only move forward and the left never passes the right. Across the whole run, the right pointer advances n times and the left pointer advances at most n times, so total pointer travel is at most 2n. Each element is admitted once and released at most once; the inner loop's total work over the entire sweep is bounded, which is amortized O(n), not multiplied per outer step.",
      rubric:
        "Full credit: both pointers monotonic forward, total travel <= 2n, each element enters/leaves once => amortized O(n). Partial: mentions each element once but not the travel bound. Low: just says 'it's linear'.",
      support_ref: "sw-part-2-variable",
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
        question: "For a fixed-size window of width k over n elements, what is the time complexity of the sliding solution?",
        choices: ["O(n)", "O(n·k)", "O(n log n)", "O(k^2)"],
        correct_index: 0,
        explanation: "One setup sum plus O(1) work per slide over n positions is linear in n.",
        concept: "complexity",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "sw-part-1-fixed",
      },
      {
        id: "q2",
        question: "When the right pointer of a fixed-size window is at index r (with r >= k), which element just left the window?",
        choices: ["nums[r - k]", "nums[r - 1]", "nums[r + 1]", "nums[0]"],
        correct_index: 0,
        explanation: "The element k positions behind the right pointer is the one that leaves.",
        concept: "sliding-window",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "sw-part-1-fixed",
      },
      {
        id: "q3",
        question: "In the variable-size window, the left pointer advances specifically to:",
        choices: [
          "Restore the window's validity rule after the right pointer broke it",
          "Keep the window exactly size k",
          "Sort the elements inside the window",
          "Skip to the next even index",
        ],
        correct_index: 0,
        explanation: "Left shrinks only to make the window legal again.",
        concept: "sliding-window",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "sw-part-2-variable",
      },
      {
        id: "q4",
        question: "Which problem is NOT a sliding-window fit?",
        choices: [
          "Longest increasing subsequence (elements need not be adjacent)",
          "Maximum sum subarray of size k",
          "Longest substring with at most 2 distinct characters",
          "Smallest subarray of positive numbers with sum >= target",
        ],
        correct_index: 0,
        explanation: "Longest increasing SUBSEQUENCE is non-contiguous, so a window cannot slide over it.",
        concept: "pattern-recognition",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "overview: when it fails",
      },
      {
        id: "q5",
        question: "The 'smallest subarray with sum >= target' window trick relies on which assumption?",
        choices: [
          "All numbers are positive, so a wider window has a larger-or-equal sum",
          "The array is already sorted",
          "The target is a power of two",
          "There are no duplicate values",
        ],
        correct_index: 0,
        explanation: "Positivity makes validity monotonic in window size, which makes shrinking safe.",
        concept: "sliding-window",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "sw-part-2-variable",
      },
      {
        id: "q6",
        question: "Why is a variable-size window O(n) despite an inner while loop?",
        choices: [
          "Each index is admitted once and released at most once, so total pointer travel is at most 2n",
          "The inner loop runs a constant 3 times",
          "Because the array is sorted first",
          "Because k is always small",
        ],
        correct_index: 0,
        explanation: "Amortized: total travel is bounded by 2n regardless of how the shrinking is distributed.",
        concept: "complexity",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "sw-part-2-variable",
      },
      {
        id: "q7",
        question: "Which of the following are contiguous-run keywords that hint at a sliding window? (Select all that apply.)",
        choices: [
          "\"subarray\"",
          "\"substring\"",
          "\"subsequence\"",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "'subarray' and 'substring' are contiguous; 'subsequence' is not.",
        concept: "pattern-recognition",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "overview: recognition",
      },
      {
        id: "q8",
        question: "In the fixed-size window max-sum solution, how many times do you compute a full k-element sum from scratch?",
        choices: ["Exactly once (the first window)", "Once per window", "Never", "k times"],
        correct_index: 0,
        explanation: "Only the first window is summed fully; the rest are O(1) repairs.",
        concept: "sliding-window",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "sw-part-1-fixed",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-sw-recognize", prompt: "Given a fresh problem statement, how quickly could you now tell whether it is a fixed or variable window, and what phrase would you look for first?", hint: "Name the trigger words you would scan for." },
  { id: "diag-sw-twopointer", prompt: "The next lesson is Two Pointer. Where do you already see two-pointer thinking inside sliding window, and what feels different about problems where the two pointers move toward each other instead of the same direction?", hint: "Think opposite-ends vs same-direction pointers." },
  { id: "diag-sw-shaky", prompt: "What part of sliding window still feels shaky — the amortized O(n) argument, the shrink condition, or recognizing when it does NOT apply?", hint: "Be specific so the next review targets it." },
  { id: "diag-sw-speed", prompt: "Could you write the variable-window skeleton from memory in under 5 minutes right now? What would slow you down?", hint: "Execution speed is the interview bottleneck." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "Sliding Window in the interview-pattern map",
  description:
    "This lesson covers both branches of the sliding-window pattern and the amortized-linear argument, and previews at-most-k-distinct windows. Two Pointer is the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "fixed-window", label: "Fixed-size window", category: "lesson_concept", covered: true },
    { id: "variable-window", label: "Variable-size window", category: "lesson_concept", covered: true },
    { id: "amortized", label: "Amortized O(n)", category: "lesson_concept", covered: true },
    { id: "monotonic-validity", label: "Monotonic validity", category: "lesson_concept", covered: true },
    { id: "at-most-k-distinct", label: "At-most-k-distinct", category: "concept", preview: true },
    { id: "two-pointer", label: "Two Pointer (next)", category: "concept" },
    { id: "prefix-deque", label: "Prefix sums + deque", category: "concept" },
  ],
  edges: [],
  curriculum_stages: [
    { id: "assessment", label: "Initial assessment", status: "done" },
    { id: "sliding-window", label: "Sliding Window", status: "current" },
    { id: "two-pointer", label: "Two Pointer", status: "next" },
    { id: "heap", label: "Heap / Priority Queue", status: "later" },
    { id: "trie", label: "Trie", status: "later" },
    { id: "backtracking", label: "Backtracking", status: "later" },
    { id: "monotonic-stack", label: "Monotonic Stack", status: "later" },
  ],
  current: "sliding-window",
};

const planningRationale =
  "Sliding Window is the first teaching lesson because the initial assessment and the imported repo history both flag it as the weakest tracked pattern (near-zero recent practice) while Frank's interview pipeline is active. It is also a natural gateway to Two Pointer (next), since a window is bounded by two same-direction pointers. The lesson teaches both branches (fixed and variable), grounds the amortized-linear argument that trips people up, and drills recognition — the highest-leverage interview skill — via pattern_recognition questions and 'when it fails' cases.";

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
  bad = fail("Part 1 (fixed window)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (variable window)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1120)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Sliding Window: Turn Nested Loops Into One Pass";
  const description =
    "Your #1 tracked weak pattern, taught from the overlap insight up: fixed-size windows (repair the two ends in O(1)), variable-size windows (expand right, shrink left to keep a rule), the amortized-linear argument, and how to recognize the pattern — and when it fails.";
  const goals = JSON.stringify([
    "Recognize fixed vs variable sliding-window problems from trigger phrases in under 2 minutes",
    "Implement both branches with the correct O(n) update, from a scaffold",
    "Explain the amortized-linear argument and the contiguity + monotonicity preconditions",
  ]);
  const tags = JSON.stringify(["sliding-window", "two-pointer", "arrays-and-strings", "weak-pattern", "interview-prep"]);
  const overviewAudioContent = {
    script: OVERVIEW_SCRIPT,
    transcript: OVERVIEW_SCRIPT,
    duration_hint: 1120,
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
    insertAct.run(lessonId, "audio", 1, "Audio: Sliding Window — the family map", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Fixed-size window", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Variable-size window", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: smallest subarray with sum ≥ target", JSON.stringify(finalCode));
    insertAct.run(lessonId, "assessment", 5, "Assessment: Sliding Window recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 5 activities.`);
  closeDb();
}

main();
