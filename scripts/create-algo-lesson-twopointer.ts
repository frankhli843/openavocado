#!/usr/bin/env tsx
/**
 * P2.2 — Lesson 3 of the "Coding Interview Mastery" subject (id 9):
 * "Two Pointer: One Index, Then a Second That Kills the Inner Loop".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in
 * this env). Weak-pattern-first: Two Pointer follows Sliding Window (a window
 * is a same-direction two-pointer setup) and is one of Frank's tracked gaps.
 *
 * Structure mirrors the Sliding Window lesson: top-level 2-host overview audio +
 * orientation visual, two collapsed lesson_parts (converging pointers, read/write
 * compaction) each with a bespoke approved artifact + per-part audio synced
 * visual + scaffolded code + mixed practice (incl. pattern_recognition), a final
 * integrator practice_code (container with most water), and an adaptive MC +
 * freeform assessment. Cue timings are provisional and rescaled to the real
 * generated audio duration by rescale-twopointer-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-tp-overview-map, algo-tp-converging, algo-tp-compaction
 *
 * Idempotent: replaces any prior seq=2 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-twopointer.ts
 */

import { getDb, closeDb } from "../src/db/connection";
import {
  validateLessonPartContent,
  validatePracticeCodeContent,
  validateAssessmentContent,
  validateAudioSyncedVisualContent,
  validateNextLessonDiagnostics,
} from "../src/lib/lesson-content/schema";
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/two-pointer-audio";

const SUBJECT_ID = 9;
const SEQ = 2;

const A_OVERVIEW = "algo-tp-overview-map";
const A_CONVERGING = "algo-tp-converging";
const A_COMPACTION = "algo-tp-compaction";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "tp-orientation",
    title: "Two Pointer: the family map",
    motif: "second-index-kills-the-inner-loop",
    description:
      "Orientation for the whole pattern: a brute-force pair search is O(n²); a second index driven by a decisive comparison collapses it to O(n). The family splits into converging (opposite ends), same-direction read/write, and fast/slow (Floyd) branches.",
    panels: [
      {
        id: "cost",
        title: "Cost collapse",
        kind: "flow" as const,
        description: "Why the pattern exists: checking every pair is O(n²); letting one comparison drop a whole end is O(n).",
        data: [
          { label: "check every pair", value: "O(n²)", role: "input" as const },
          { label: "one comparison drops an end", value: "exploit structure", role: "process" as const },
          { label: "two pointers sweep once", value: "O(n)", role: "output" as const },
        ],
      },
      {
        id: "branches",
        title: "Three branches",
        kind: "cards" as const,
        description: "Converging (opposite ends, sorted), same-direction read/write (in-place), and fast/slow (shared path, different speeds).",
        data: [
          { label: "converging", value: "left→ ←right, sorted", role: "context" as const },
          { label: "read / write", value: "same direction, in place", role: "context" as const },
          { label: "fast / slow", value: "one path, two speeds", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 150, label: "The O(n²) pair search", headline: "A nested loop over every pair", narration: "Finding a pair that sums to a target by checking all pairs is quadratic work.", receive: "a sorted array and a target", transform: "brute-force pair scan", pass: "a baseline cost to beat" },
    { start: 150, end: 340, label: "Sorted makes a comparison decisive", headline: "One comparison kills a side", narration: "On a sorted row, a too-big sum means the largest value is hopeless — drop the whole right side.", receive: "one pair comparison", transform: "exploit sorted order", pass: "an entire column eliminated" },
    { start: 340, end: 540, label: "Converging branch", headline: "Fingers walk toward each other", narration: "Left starts low, right starts high; each comparison advances one of them inward.", receive: "opposite-end pointers", transform: "converge on the target", pass: "the pair in one linear pass" },
    { start: 540, end: 760, label: "Read / write branch", headline: "Same direction, two jobs", narration: "Read scans every element; write marks the boundary of the compacted answer built in place.", receive: "an array to compact", transform: "keep only new values", pass: "an O(1)-space rewrite" },
    { start: 760, end: 960, label: "Fast / slow branch", headline: "One path, two speeds", narration: "A speed gap that shrinks by one each tick forces a collision, exposing cycles and midpoints.", receive: "a shared sequence", transform: "different-speed traversal", pass: "cycle detection with no extra memory" },
    { start: 960, end: 1120, label: "When it fails", headline: "No structure, no license", narration: "Unsorted data breaks converging pointers; force the pattern and you get a fast wrong answer.", receive: "a candidate problem", transform: "check the enabling structure", pass: "a go / no-go decision" },
    { start: 1120, end: 1260, label: "Recognition & window kinship", headline: "Fingerprints and cousins", narration: "A sliding window is a same-direction two-pointer; recognize on structure, not surface words.", receive: "an interview prompt", transform: "map to the right branch", pass: "a fast correct solution" },
  ],
};

// ── Reading builder helper ────────────────────────────────────────────────────
const convergingComplexity = {
  type: "formula",
  latex: "O(n^2) \\;\\longrightarrow\\; O(n)",
  plain_english:
    "Checking every pair costs the number of pairs, which is quadratic; sorted order lets one comparison discard an entire end, so two pointers converge in a single linear pass.",
  variables: [
    { symbol: "n", meaning: "the number of elements in the array" },
    { symbol: "O(n^2)", meaning: "the brute-force cost of comparing all pairs — the factor the second pointer removes" },
  ],
};

// ── Part 1: converging pointers ───────────────────────────────────────────────
const part1 = {
  part_id: "tp-part-1-converging",
  reading: {
    blocks: [
      { type: "heading", text: "Converging pointers: let one comparison throw away a whole end" },
      {
        type: "paragraph",
        text:
          "A converging two-pointer scan needs a sorted array. Put one pointer on the smallest element (far left) and one on the largest (far right), and look at the pair they form. Because the array is sorted, the sum you read carries information about a whole side: if the sum is too large, the largest value is hopeless in every pair it could form, so you retreat the right pointer; if the sum is too small, the smallest value cannot help, so you advance the left pointer. Each comparison eliminates an entire column of candidate pairs, so the pointers meet in a single linear pass.",
      },
      {
        type: "definition",
        term: "Decisive comparison",
        definition:
          "A single test whose result rules out not just one candidate but a whole class of them. Sorted order is what makes the pair-sum comparison decisive: a too-big sum condemns every pair using the current largest element at once.",
      },
      {
        type: "example",
        body:
          "Sorted array 1, 3, 4, 6, 8, 11, target 10. Left=1, right=11: sum 12 > 10, retreat right to 8. 1+8 = 9 < 10, advance left to 3. 3+8 = 11 > 10, retreat right to 6. 3+6 = 9 < 10, advance left to 4. 4+6 = 10 — found, at indices 2 and 3. Six comparisons, never a rescan.",
      },
      convergingComplexity,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_CONVERGING,
      scene: {
        scene_id: "tp-converging-scene",
        title: "Two fingers converge on the target",
        motif: "too-big-drop-right-too-small-advance-left",
        description: "Two pointers over a sorted array walk toward each other; each pair-sum comparison against the target decides which end moves.",
        panels: [
          {
            id: "array",
            title: "The sorted array and the two pointers",
            kind: "matrix" as const,
            description: "Six sorted integers with the left and right pointers and the pair they currently form.",
            data: [
              { label: "pair sums seen", value: "12 → 9 → 11 → 9 → 10", role: "process" as const },
              { label: "answer", value: "indices 2 and 3 (4 + 6)", role: "output" as const },
            ],
          },
          {
            id: "decision",
            title: "The move rule",
            kind: "ledger" as const,
            description: "How the comparison against the target picks which pointer moves.",
            data: [
              { label: "sum > target", value: "retreat right (smaller)", role: "input" as const },
              { label: "sum < target", value: "advance left (bigger)", role: "input" as const },
              { label: "sum = target", value: "found the pair", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Start at the ends", headline: "Widest pair first", narration: "Left on the smallest, right on the largest: 1 and 11.", receive: "a sorted array", transform: "place opposite-end pointers", pass: "the first pair to test" },
        { start: 30, end: 62, label: "Too big, drop right", headline: "12 > 10", narration: "The sum overshoots, so the largest value is hopeless — retreat the right pointer.", receive: "an over-target sum", transform: "eliminate the right end", pass: "a smaller pair 1 + 8" },
        { start: 62, end: 95, label: "Too small, push left", headline: "9 < 10", narration: "Now the sum is under, so advance the left pointer for a bigger value.", receive: "an under-target sum", transform: "eliminate the left end", pass: "the pair 3 + 8" },
        { start: 95, end: 128, label: "Zig-zag inward", headline: "Each step kills a column", narration: "11 over, retreat right; 9 under, advance left — the pointers converge.", receive: "alternating comparisons", transform: "decisive elimination", pass: "the pair 4 + 6" },
        { start: 128, end: 150, label: "Found it", headline: "4 + 6 = 10", narration: "The pair meets the target at indices 2 and 3.", receive: "a matching pair", transform: "report the indices", pass: "the answer" },
        { start: 150, end: 165, label: "Why linear", headline: "Pointers only move inward", narration: "Each pointer takes at most n steps and they never rescan, so the search is O(n).", receive: "the whole array", transform: "single converging sweep", pass: "an O(n) guarantee" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to step the converging search over the sorted array. Watch the pair-sum compare against the target and drive which pointer moves — retreat right when the sum is too big, advance left when it is too small — until the two fingers meet the target.",
    params: { artifact_slug: A_CONVERGING, min_height: 320 },
  },
  code: {
    prompt:
      "Return the indices (left, right) of a pair in a SORTED array that sums to target, or None if there is none. Start the pointers at the two ends and move them toward each other: when the pair sum is too small advance left, when it is too large retreat right. Fill in the two TODO helpers, then compose them.",
    starter_code:
      "def pair_sum(nums, left, right):\n    # TODO: return the sum of the two pointed-at values nums[left] + nums[right].\n    pass\n\n\ndef step_pointers(left, right, s, target):\n    # TODO: if the sum s is below target, advance left (+1); otherwise retreat right (-1).\n    # Return the new (left, right) tuple. (Only called when s != target.)\n    pass\n\n\ndef two_sum_sorted(nums, target):\n    # Compose the helpers: converge from both ends until the pair meets the target.\n    left, right = 0, len(nums) - 1\n    while left < right:\n        s = pair_sum(nums, left, right)\n        if s == target:\n            return (left, right)\n        left, right = step_pointers(left, right, s, target)\n    return None\n",
    constraints: [
      "The array is sorted ascending — this is what makes one comparison decisive.",
      "Each pointer only moves inward; one linear pass, no nested loop.",
    ],
    walkthrough: {
      title: "From blank file to O(n) two-sum on a sorted array",
      steps: [
        { title: "Read the current pair", detail: "pair_sum returns nums[left] + nums[right], the sum of the two pointed-at values.", input: "nums, left, right", output: "the current pair sum" },
        { title: "Decide which end to move", detail: "step_pointers advances left when the sum is too small (need a bigger value) and retreats right when the sum is too big (need a smaller value).", input: "left, right, sum, target", output: "the new (left, right)" },
        { title: "Converge until they meet the target", detail: "Loop while left < right; return the indices on an exact match, otherwise step the pointers. Return None if they cross.", input: "the full sorted array", output: "the matching indices or None" },
      ],
    },
    io_examples: [
      { label: "classic", input: "nums = [1,3,4,6,8,11], target = 10", expected_output: "(2, 3)", explanation: "4 + 6 = 10; the pointers converge to indices 2 and 3." },
      { label: "adjacent pair", input: "nums = [2,7,11,15], target = 9", expected_output: "(0, 1)", explanation: "2 + 7 = 9 on the very first comparison." },
      { label: "no pair", input: "nums = [1,2,3], target = 7", expected_output: "None", explanation: "No two elements reach 7, so the pointers cross and return None." },
    ],
    visualization: {
      title: "Input → compare → move",
      description: "How one comparison drives the next move.",
      items: [
        { label: "pair sum", value: "1 + 11 = 12", role: "input" },
        { label: "12 > target 10", value: "retreat right", role: "process" },
        { label: "new pair", value: "1 + 8 = 9", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Explicit helpers",
        code:
          "def pair_sum(nums, left, right):\n    return nums[left] + nums[right]\n\ndef step_pointers(left, right, s, target):\n    if s < target:\n        return (left + 1, right)\n    return (left, right - 1)\n\ndef two_sum_sorted(nums, target):\n    left, right = 0, len(nums) - 1\n    while left < right:\n        s = pair_sum(nums, left, right)\n        if s == target:\n            return (left, right)\n        left, right = step_pointers(left, right, s, target)\n    return None",
        explanation: "Each helper does one job; two_sum_sorted converges the pointers until the pair matches.",
      },
      {
        label: "concise",
        title: "Idiomatic Python",
        code:
          "def two_sum_sorted(nums, target):\n    left, right = 0, len(nums) - 1\n    while left < right:\n        s = nums[left] + nums[right]\n        if s == target:\n            return (left, right)\n        if s < target:\n            left += 1\n        else:\n            right -= 1\n    return None",
        explanation: "The move rule is inlined: advance left when under target, retreat right when over.",
      },
    ],
    hints: [
      { level: 1, text: "The array is sorted, so a too-big sum means the largest value can be dropped, and a too-small sum means the smallest value can be dropped." },
      { level: 2, text: "pair_sum is just nums[left] + nums[right]." },
      { level: 3, text: "step_pointers: if s < target return (left+1, right); else return (left, right-1)." },
      { level: 4, text: "Only step when the sum is not equal to the target; return the indices immediately on a match." },
      { level: 5, text: "Loop while left < right; if they cross without a match, return None." },
    ],
    tests: [
      { id: "t_classic", description: "finds 4+6 at indices 2,3", assert: "assert two_sum_sorted([1,3,4,6,8,11], 10) == (2, 3)" },
      { id: "t_adjacent", description: "first-pair match", assert: "assert two_sum_sorted([2,7,11,15], 9) == (0, 1)" },
      { id: "t_none", description: "no pair returns None", assert: "assert two_sum_sorted([1,2,3], 7) is None" },
    ],
    hidden_tests: [
      { id: "h_outer", description: "outermost pair matches immediately", assert: "assert two_sum_sorted([1,1,1,1], 2) == (0, 3)" },
      { id: "h_negatives", description: "handles negative numbers (still sorted)", assert: "assert two_sum_sorted([-3,-1,0,2,5], 2) == (0, 4)" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "tp1-so-1",
        type: "select_one",
        prompt: "On a SORTED array, the converging pointers see a pair sum that is LARGER than the target. Which move is correct?",
        concept: "two-pointer",
        difficulty: "easy",
        choices: ["Retreat the right pointer to a smaller value", "Advance the left pointer to a bigger value", "Move both pointers inward", "Restart from the ends"],
        correct_index: 0,
        explanation: "A too-big sum means the largest value is hopeless, so retreat the right pointer toward smaller values.",
      },
      {
        id: "tp1-sa-multi",
        type: "select_all",
        prompt: "Which statements about converging two-sum on a sorted array are true?",
        concept: "two-pointer",
        difficulty: "medium",
        choices: [
          "Each comparison can eliminate an entire end's worth of pairs",
          "The array must be sorted for the move rule to be valid",
          "It runs in O(n) time",
          "It requires O(n) extra memory for a hash set",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Converging pointers are O(n) time and O(1) space; sortedness is what makes each comparison decisive. No hash set is needed.",
      },
      {
        id: "tp1-sa-none",
        type: "select_all",
        prompt: "Which of these are REQUIRED for converging two-pointer two-sum to be correct? (Select all that truly are; if none, select none.)",
        concept: "two-pointer",
        difficulty: "hard",
        choices: [
          "All values must be positive",
          "The array must contain no duplicates",
          "The target must be even",
        ],
        correct_indices: [],
        explanation: "None are required — converging two-sum works with negatives, duplicates, and any target, as long as the array is sorted.",
      },
      {
        id: "tp1-order",
        type: "ordering",
        prompt: "Put the converging two-sum steps in order.",
        concept: "two-pointer",
        difficulty: "medium",
        items: [
          "Place left at index 0 and right at the last index",
          "Read the pair sum of the two pointed-at values",
          "If the sum is below target advance left, if above retreat right",
          "Return the indices when the sum equals the target",
        ],
        correct_order: [
          "Place left at index 0 and right at the last index",
          "Read the pair sum of the two pointed-at values",
          "If the sum is below target advance left, if above retreat right",
          "Return the indices when the sum equals the target",
        ],
      },
      {
        id: "tp1-pattern",
        type: "pattern_recognition",
        prompt: "\"Given an array of integers that is already SORTED ascending, return two numbers that add up to a specific target.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Two Pointer", "Sliding Window", "Binary Search", "Hashing", "Dynamic Programming"],
        primary_indices: [0],
        secondary_indices: [2, 3],
        explanation: "Sorted + \"two numbers that add to a target\" is the converging two-pointer fingerprint. Binary search for the complement and a hash map are valid alternate approaches, so they are reasonable secondary lenses.",
      },
      {
        id: "tp1-written",
        type: "written",
        prompt: "Explain why the SAME two-sum problem is a two-pointer problem when the array is sorted, but a hashing problem when it is not.",
        concept: "pattern-recognition",
        difficulty: "hard",
        actual_answer:
          "When the array is sorted, the pair sum is monotonic in the pointer positions: moving the right pointer left can only lower the sum and moving the left pointer right can only raise it, so a single comparison against the target tells you unambiguously which end is hopeless and can be dropped. That decisiveness is what lets two converging pointers finish in one linear pass. When the array is unsorted, a too-big or too-small sum says nothing about where a better value sits, so the move rule is invalid; instead you scan once and remember each value in a hash set, checking for the complement (target minus the current value) in O(1) — same linear time, but the mechanism relies on lookup, not on ordering.",
        rubric:
          "Full credit: sorted makes the sum monotonic so one comparison is decisive (enables converging pointers); unsorted breaks that so you use a hash set / complement lookup instead. Partial: says sorted enables two pointers without the monotonic-decisiveness reason. Low: vague.",
      },
    ],
  },
};

// ── Part 2: same-direction read/write compaction ──────────────────────────────
const part2 = {
  part_id: "tp-part-2-readwrite",
  reading: {
    blocks: [
      { type: "heading", text: "Same-direction read/write: build the answer in place with two jobs" },
      {
        type: "paragraph",
        text:
          "The second geometry starts both pointers at the front and moves them the same direction, but with different jobs. The read pointer marches across every element, inspecting. The write pointer lags behind and marks a boundary: everything to its left is already the final, correct answer. The write pointer advances only when the read pointer finds something worth keeping. Because both pointers move forward and never back up, the whole rewrite is a single linear pass using only one extra index — constant space.",
      },
      {
        type: "definition",
        term: "Write boundary invariant",
        definition:
          "The promise that everything strictly to the left of the write pointer is the finished, compacted answer. Every keep operation preserves it: you only ever place a value at the write slot when it genuinely belongs in the answer, then advance the boundary by one.",
      },
      {
        type: "example",
        body:
          "Sorted array 1, 1, 2, 2, 2, 3, 4, 4, remove duplicates in place. write starts at 1 (the first element is always kept). read scans: the second 1 equals the last kept value, skip; the first 2 is new, copy it to index 1 and advance write to 2; later 2s skip; 3 is new, write it, write=3; 4 is new, write it, write=4. The prefix 1, 2, 3, 4 is the answer and the new length is 4.",
      },
      {
        type: "callout",
        text:
          "The classic bug is advancing the write pointer on every step instead of only on a new value. That copies duplicates straight back into the prefix and silently corrupts the answer. The invariant 'write moves only on a keeper' is what keeps the left side honest.",
      },
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_COMPACTION,
      scene: {
        scene_id: "tp-compaction-scene",
        title: "Read scans, write keeps",
        motif: "write-lags-read-advances-on-keepers",
        description: "Two same-direction pointers over a sorted array with duplicates: read inspects every element, write marks the boundary of the deduplicated prefix and only advances on a genuinely new value.",
        panels: [
          {
            id: "pointers",
            title: "Read / write positions",
            kind: "vector" as const,
            description: "The read pointer scans ahead; the write pointer marks the end of the compacted prefix.",
            data: [
              { label: "read", value: "scans every element", role: "process" as const },
              { label: "write", value: "advances only on a keeper", role: "process" as const },
              { label: "new length", value: "4", role: "output" as const },
            ],
          },
          {
            id: "rule",
            title: "Keep rule",
            kind: "ledger" as const,
            description: "The single validity test that decides when write advances.",
            data: [
              { label: "test", value: "nums[read] != last kept value", role: "input" as const },
              { label: "on new value", value: "copy to write slot, write += 1", role: "process" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Seed the boundary", headline: "First element is always kept", narration: "write starts at 1 because the first element is trivially unique.", receive: "a sorted array", transform: "seed the write boundary", pass: "a kept prefix of length 1" },
        { start: 30, end: 66, label: "Skip a duplicate", headline: "read equals the last kept", narration: "The second 1 matches the last kept value, so read walks on and write stays put.", receive: "a duplicate value", transform: "reject it", pass: "an unchanged prefix" },
        { start: 66, end: 100, label: "Keep a new value", headline: "read finds a fresh 2", narration: "The 2 is new, so copy it to the write slot and advance write.", receive: "a new value", transform: "copy and advance write", pass: "a longer prefix 1, 2" },
        { start: 100, end: 132, label: "Why still linear", headline: "Both pointers move forward", narration: "read advances n times, write at most n times, and neither backs up — total travel 2n.", receive: "the whole array", transform: "amortized accounting", pass: "an O(n) time, O(1) space guarantee" },
        { start: 132, end: 150, label: "The bug to avoid", headline: "Do not advance write blindly", narration: "Advancing write on every step copies duplicates back in and corrupts the prefix.", receive: "a tempting shortcut", transform: "reject the wrong rule", pass: "a correct invariant" },
        { start: 150, end: 165, label: "Read the answer", headline: "Prefix before write is done", narration: "When read reaches the end, everything before write is the compacted answer.", receive: "a finished scan", transform: "read the prefix", pass: "the new length 4" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to advance the read pointer across the sorted array. Watch the write pointer stay put on a duplicate and advance only when read finds a new value, while the green kept-prefix grows into the deduplicated answer.",
    params: { artifact_slug: A_COMPACTION, min_height: 340 },
  },
  code: {
    prompt:
      "Remove duplicates from a SORTED array in place and return the new length; the first `length` elements of nums must hold the distinct values in order. Use two same-direction pointers: read scans every element, write marks the next slot for a keeper. Fill in the two TODO helpers, then compose them.",
    starter_code:
      "def is_new(nums, read, write):\n    # TODO: return True if nums[read] differs from the last kept value nums[write-1].\n    pass\n\n\ndef keep(nums, read, write):\n    # TODO: copy nums[read] into the write slot nums[write], then return write + 1.\n    pass\n\n\ndef dedup_sorted(nums):\n    if not nums:\n        return 0\n    write = 1  # the first element is always kept\n    for read in range(1, len(nums)):\n        if is_new(nums, read, write):\n            write = keep(nums, read, write)\n    return write\n",
    constraints: [
      "The array is sorted, so duplicates are adjacent.",
      "In place: O(1) extra memory. read scans once; write advances only on a new value.",
    ],
    walkthrough: {
      title: "In-place dedup with read/write pointers",
      steps: [
        { title: "Test for a new value", detail: "is_new compares nums[read] against the last kept value nums[write-1] — the single validity test for compaction.", input: "nums, read, write", output: "True if this value belongs in the answer" },
        { title: "Keep it and advance the boundary", detail: "keep copies nums[read] into the write slot and returns write + 1, extending the finished prefix by one.", input: "nums, read, write", output: "the new write boundary" },
        { title: "Scan and compose", detail: "Seed write at 1, then for each read from 1 onward, keep only new values. The returned write is the new length; the prefix before it is the answer.", input: "the full sorted array", output: "the new length" },
      ],
    },
    io_examples: [
      { label: "typical", input: "nums = [1,1,2,2,2,3,4,4]", expected_output: "4  (prefix [1,2,3,4])", explanation: "Four distinct values; write ends at 4 and the prefix is [1,2,3,4]." },
      { label: "all unique", input: "nums = [1,2,3]", expected_output: "3", explanation: "Nothing to remove; every value is a keeper." },
      { label: "all identical", input: "nums = [5,5,5]", expected_output: "1", explanation: "Only the first 5 is kept; the rest are duplicates." },
    ],
    visualization: {
      title: "Input → keep test → output",
      description: "One read step that finds a new value.",
      items: [
        { label: "read points at a fresh value", value: "nums[read] != nums[write-1]", role: "input" },
        { label: "copy to write slot, advance write", value: "nums[write] = nums[read]; write += 1", role: "process" },
        { label: "compacted prefix length", value: "write", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Explicit helpers",
        code:
          "def is_new(nums, read, write):\n    return nums[read] != nums[write - 1]\n\ndef keep(nums, read, write):\n    nums[write] = nums[read]\n    return write + 1\n\ndef dedup_sorted(nums):\n    if not nums:\n        return 0\n    write = 1\n    for read in range(1, len(nums)):\n        if is_new(nums, read, write):\n            write = keep(nums, read, write)\n    return write",
        explanation: "is_new is the keep test; keep does the copy and advances the boundary; dedup_sorted drives read across the array.",
      },
      {
        label: "concise",
        title: "Idiomatic Python",
        code:
          "def dedup_sorted(nums):\n    if not nums:\n        return 0\n    write = 1\n    for read in range(1, len(nums)):\n        if nums[read] != nums[write - 1]:\n            nums[write] = nums[read]\n            write += 1\n    return write",
        explanation: "The keep test and copy are inlined; write advances only when nums[read] is a new value.",
      },
    ],
    hints: [
      { level: 1, text: "The array is sorted, so equal values are adjacent — you only need to compare against the last value you kept." },
      { level: 2, text: "The last kept value lives at nums[write - 1]." },
      { level: 3, text: "is_new(nums, read, write) is just nums[read] != nums[write-1]." },
      { level: 4, text: "keep copies nums[read] to nums[write] and returns write + 1." },
      { level: 5, text: "Seed write = 1, loop read from 1, and only advance write when is_new is true; return write." },
    ],
    tests: [
      { id: "t_typical", description: "dedup keeps 4 distinct values", assert: "assert dedup_sorted([1,1,2,2,2,3,4,4]) == 4" },
      { id: "t_unique", description: "no duplicates to remove", assert: "assert dedup_sorted([1,2,3]) == 3" },
      { id: "t_same", description: "all identical collapses to 1", assert: "assert dedup_sorted([5,5,5]) == 1" },
    ],
    hidden_tests: [
      { id: "h_empty", description: "empty array returns 0", assert: "assert dedup_sorted([]) == 0" },
      { id: "h_prefix", description: "the compacted prefix is correct", assert: "assert (lambda a: (dedup_sorted(a), a[:4]))([1,1,2,2,2,3,4,4]) == (4, [1,2,3,4])" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "tp2-so-1",
        type: "select_one",
        prompt: "In the read/write in-place dedup, when does the WRITE pointer advance?",
        concept: "two-pointer",
        difficulty: "easy",
        choices: [
          "Only when the read pointer finds a value different from the last kept one",
          "Every iteration, in lockstep with read",
          "Whenever read reaches an even index",
          "Never — only read moves",
        ],
        correct_index: 0,
        explanation: "Write advances only on a keeper; otherwise it stays put while read scans past duplicates.",
      },
      {
        id: "tp2-sa-multi",
        type: "select_all",
        prompt: "Why is in-place read/write compaction O(n) time and O(1) space? Select all correct reasons.",
        concept: "two-pointer",
        difficulty: "hard",
        choices: [
          "The read pointer advances exactly n times",
          "The write pointer advances at most n times and never backs up",
          "Only a single extra index is stored, no second array",
          "It sorts the array first in O(n log n)",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Total pointer travel is at most 2n and only one index is stored; no sorting happens inside the scan (the input is already sorted).",
      },
      {
        id: "tp2-sa-none",
        type: "select_all",
        prompt: "For in-place dedup of a SORTED array, which of these data structures are REQUIRED? (If none, select none.)",
        concept: "two-pointer",
        difficulty: "medium",
        choices: ["A hash set", "A second output array", "A stack"],
        correct_indices: [],
        explanation: "None are required — two indices and the in-place array suffice; a hash set or second array would waste O(n) space.",
      },
      {
        id: "tp2-order",
        type: "ordering",
        prompt: "Order the read/write dedup loop body for one read position.",
        concept: "two-pointer",
        difficulty: "medium",
        items: [
          "Compare nums[read] against the last kept value nums[write-1]",
          "If it is new, copy nums[read] into the write slot",
          "Advance the write pointer past the new value",
          "Move the read pointer forward regardless",
        ],
        correct_order: [
          "Compare nums[read] against the last kept value nums[write-1]",
          "If it is new, copy nums[read] into the write slot",
          "Advance the write pointer past the new value",
          "Move the read pointer forward regardless",
        ],
      },
      {
        id: "tp2-pattern",
        type: "pattern_recognition",
        prompt: "\"Given an array nums and a value val, remove all occurrences of val IN PLACE and return the new length; extra space must be O(1).\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Two Pointer", "Sliding Window", "Sorting", "Hashing", "Binary Search"],
        primary_indices: [0],
        secondary_indices: [],
        explanation: "\"Remove in place, O(1) extra space\" is the read/write same-direction two-pointer fingerprint. Sorting or hashing would violate the O(1)-space requirement, so they are not valid here.",
      },
      {
        id: "tp2-written",
        type: "written",
        prompt: "State the invariant the write pointer maintains, and explain what goes wrong if you advance write on every read step instead of only on a keeper.",
        concept: "two-pointer",
        difficulty: "hard",
        actual_answer:
          "The invariant is that everything strictly to the left of the write pointer is the final, compacted answer so far — each slot before write holds a value that belongs in the result, in order. If you advance write on every read step instead of only when read finds a genuinely new value, you copy duplicates into the write region and push the boundary past them, so the prefix ends up containing repeated values and a wrong (too-large) length. The invariant is preserved only by advancing write exclusively on a keeper, which is what guarantees the left side stays a correct deduplicated prefix.",
        rubric:
          "Full credit: names the invariant (everything left of write is the finished answer) AND explains that advancing write blindly copies duplicates in, corrupting the prefix and inflating the length. Partial: states the invariant OR the bug but not both. Low: vague.",
      },
    ],
  },
};

// ── Final integrator practice_code: container with most water ─────────────────
const finalCode = {
  prompt:
    "Integrator: given wall heights, return the maximum water a container between two walls can hold. Area = width between the walls times the shorter wall's height. Use converging pointers: start at the two ends (widest container) and always move the pointer at the SHORTER wall inward, tracking the best area. Fill the two TODO helpers, then compose them.",
  starter_code:
    "def area(height, left, right):\n    # TODO: return the container area = width (right - left) times the shorter wall.\n    pass\n\n\ndef move_shorter(height, left, right):\n    # TODO: move the pointer at the SHORTER wall inward; return the new (left, right).\n    # If height[left] < height[right], advance left; otherwise retreat right.\n    pass\n\n\ndef max_area(height):\n    left, right = 0, len(height) - 1\n    best = 0\n    while left < right:\n        best = max(best, area(height, left, right))\n        left, right = move_shorter(height, left, right)\n    return best\n",
  constraints: [
    "Start with the widest container (both ends) — width only shrinks from here.",
    "Always move the shorter wall inward; moving the taller one can never improve the area.",
    "One linear converging pass.",
  ],
  walkthrough: {
    title: "Combine width and height with converging pointers",
    steps: [
      { title: "Measure the current container", detail: "area is the horizontal distance right - left times the shorter of the two walls, since water spills over the lower wall.", input: "height, left, right", output: "the current trapped area" },
      { title: "Move the limiting wall", detail: "The shorter wall caps the area, so retire it: moving the taller wall inward only shrinks width while the same short wall still caps the height, which can never help.", input: "height, left, right", output: "the new (left, right)" },
      { title: "Track the best", detail: "Start best at 0; each converging step records the area and moves the shorter wall. When the pointers meet, best holds the answer.", input: "all pointer positions", output: "the maximum area" },
    ],
  },
  io_examples: [
    { label: "classic", input: "height = [1,8,6,2,5,4,8,3,7]", expected_output: "49", explanation: "Walls of height 8 (index 1) and 7 (index 8) span width 7; min(8,7)*7 = 49." },
    { label: "two walls", input: "height = [1,1]", expected_output: "1", explanation: "One container of width 1 and height 1." },
    { label: "tall ends", input: "height = [4,3,2,1,4]", expected_output: "16", explanation: "The two height-4 walls span width 4; 4*4 = 16." },
  ],
  visualization: {
    title: "Input → move shorter → output",
    description: "Each step retires the shorter wall.",
    items: [
      { label: "area = width * min(walls)", value: "(right-left) * min(h[left], h[right])", role: "input" },
      { label: "move the pointer at the shorter wall", value: "shorter wall inward", role: "process" },
      { label: "best area seen", value: "max over the sweep", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "Explicit helpers",
      code:
        "def area(height, left, right):\n    return (right - left) * min(height[left], height[right])\n\ndef move_shorter(height, left, right):\n    if height[left] < height[right]:\n        return (left + 1, right)\n    return (left, right - 1)\n\ndef max_area(height):\n    left, right = 0, len(height) - 1\n    best = 0\n    while left < right:\n        best = max(best, area(height, left, right))\n        left, right = move_shorter(height, left, right)\n    return best",
      explanation: "area measures the container; move_shorter retires the limiting wall; max_area converges and tracks the best.",
    },
    {
      label: "concise",
      title: "Idiomatic Python",
      code:
        "def max_area(height):\n    left, right = 0, len(height) - 1\n    best = 0\n    while left < right:\n        best = max(best, (right - left) * min(height[left], height[right]))\n        if height[left] < height[right]:\n            left += 1\n        else:\n            right -= 1\n    return best",
      explanation: "The area and move rule are inlined; always advance whichever wall is shorter.",
    },
  ],
  hints: [
    { level: 1, text: "Start with the widest possible container (both ends). Width can only shrink as the pointers converge, so each step must try to gain height." },
    { level: 2, text: "area(height, left, right) is (right - left) * min(height[left], height[right])." },
    { level: 3, text: "The shorter wall caps the area, so moving the taller wall inward can never increase it — always move the shorter one." },
    { level: 4, text: "move_shorter: if height[left] < height[right] advance left, else retreat right." },
    { level: 5, text: "Track best = max(best, area(...)) before each move, and stop when left meets right." },
  ],
  tests: [
    { id: "f_classic", description: "canonical example gives 49", assert: "assert max_area([1,8,6,2,5,4,8,3,7]) == 49" },
    { id: "f_two", description: "two walls of height 1", assert: "assert max_area([1,1]) == 1" },
    { id: "f_ends", description: "tall matching ends give 16", assert: "assert max_area([4,3,2,1,4]) == 16" },
  ],
  hidden_tests: [
    { id: "hf_valley", description: "small valley between low walls", assert: "assert max_area([1,2,1]) == 2" },
    { id: "hf_mixed", description: "mixed heights", assert: "assert max_area([2,3,4,5,18,17,6]) == 17" },
  ],
};

// ── Assessment (adaptive MC + freeform) ───────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Name the three two-pointer geometries (converging, same-direction read/write, fast/slow) and give the enabling structure that makes each one's pointer moves trustworthy.",
      type: "free_text",
      concept: "two-pointer",
      difficulty: "medium",
      actual_answer:
        "Converging pointers start at opposite ends and walk inward; their enabling structure is a SORTED array, which makes a single pair-sum comparison decisive (a too-big sum condemns the largest value). Same-direction read/write pointers both move forward with different jobs — read scans, write marks the finished prefix; the enabling structure is that the answer is a prefix you can build forward without ever looking back, giving O(1)-space in-place rewrites. Fast/slow (Floyd) pointers traverse the same sequence at different speeds; the enabling structure is a shared path where the speed gap shrinks by one each step and must eventually close, which exposes cycles and midpoints.",
      rubric:
        "Full credit: all three geometries with the right enabling structure (converging=sorted/decisive comparison; read-write=forward-only prefix, in place; fast-slow=shared path + speed gap closes). Partial: two of three correct. Low: names geometries without the enabling structure.",
      support_ref: "tp-part-1-converging / tp-part-2-readwrite / overview: fast-slow",
    },
    {
      id: "a-free-2",
      text: "A candidate sees 'find two numbers that sum to a target' in an UNSORTED array and immediately reaches for converging two pointers. Why is that wrong, and what should they use instead?",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "hard",
      actual_answer:
        "Converging pointers rely on sorted order: only then does a too-big or too-small sum tell you which end is hopeless. In an unsorted array that decisiveness is gone, so moving a pointer based on the sum is invalid and you get a fast wrong answer. The right tool is a hash set: scan once, and for each value check whether its complement (target minus the value) has already been seen, which is O(n) time. Sorting first would work for the pointers but costs O(n log n) and destroys the original indices, so if the problem needs indices the hash approach is preferable.",
      rubric:
        "Full credit: converging needs sortedness for the comparison to be decisive; unsorted breaks it; use a hash set / complement lookup (bonus: sorting destroys indices). Partial: says it needs sorting without the reason or the alternative. Low: unclear.",
      support_ref: "tp-part-1-converging / overview: when it fails",
    },
    {
      id: "a-free-3",
      text: "Explain why Floyd's fast/slow pointers are guaranteed to collide inside a cycle, and why they run off the end when there is no cycle.",
      type: "free_text",
      concept: "complexity",
      difficulty: "medium",
      actual_answer:
        "The fast pointer moves two steps per tick and the slow one moves one, so once both are inside the loop the gap between them shrinks by exactly one every tick. A gap that decreases by one on a finite circular track must reach zero, so they land on the same node — a guaranteed collision. If there is no cycle, the path is finite and straight, so the fast pointer simply reaches the end (a null link) first; there is no loop to trap it, so it exits and you conclude there was no cycle. No extra memory is needed because the whole test is 'do these two moving pointers ever meet.'",
      rubric:
        "Full credit: gap shrinks by one per tick inside a finite loop so collision is forced; no cycle means the fast pointer hits the end. Partial: mentions different speeds without the gap-closing argument. Low: just says 'they meet'.",
      support_ref: "overview: fast-slow",
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
        question: "For converging two-sum on a SORTED array of n elements, what is the time complexity?",
        choices: ["O(n)", "O(n²)", "O(n log n)", "O(log n)"],
        correct_index: 0,
        explanation: "Each pointer moves inward at most n steps and they never rescan, so the search is linear.",
        concept: "complexity",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "tp-part-1-converging",
      },
      {
        id: "q2",
        question: "Converging pointers see a pair sum SMALLER than the target. Which move is correct?",
        choices: ["Advance the left pointer to a bigger value", "Retreat the right pointer to a smaller value", "Move both inward together", "Stop and return None"],
        correct_index: 0,
        explanation: "A too-small sum means the smallest value is hopeless, so advance left toward bigger values.",
        concept: "two-pointer",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "tp-part-1-converging",
      },
      {
        id: "q3",
        question: "In the read/write in-place dedup, the write pointer advances specifically to:",
        choices: [
          "Extend the finished prefix by one when read finds a new value",
          "Stay exactly one step behind read at all times",
          "Sort the elements as it goes",
          "Skip to the next duplicate",
        ],
        correct_index: 0,
        explanation: "Write marks the boundary of the answer and advances only on a keeper.",
        concept: "two-pointer",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "tp-part-2-readwrite",
      },
      {
        id: "q4",
        question: "Which problem is NOT a two-pointer fit?",
        choices: [
          "Two-sum on an UNSORTED array requiring original indices",
          "Two-sum on a sorted array",
          "Remove duplicates from a sorted array in place",
          "Detect a cycle in a linked list",
        ],
        correct_index: 0,
        explanation: "Unsorted two-sum lacks the decisive comparison; use a hash map instead.",
        concept: "pattern-recognition",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "overview: when it fails",
      },
      {
        id: "q5",
        question: "Container with most water always moves the pointer at the shorter wall because:",
        choices: [
          "The shorter wall caps the area, so moving the taller one can only shrink width without raising the cap",
          "The taller wall is always on the left",
          "It keeps the array sorted",
          "The width must stay constant",
        ],
        correct_index: 0,
        explanation: "Only abandoning the limiting (shorter) wall gives a chance at a taller cap.",
        concept: "two-pointer",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "integrator: container with most water",
      },
      {
        id: "q6",
        question: "Why do Floyd's fast/slow pointers collide inside a cycle?",
        choices: [
          "The gap between them shrinks by one each tick on a finite loop, so it must reach zero",
          "The fast pointer restarts from the head repeatedly",
          "The array is sorted first",
          "The loop length is always even",
        ],
        correct_index: 0,
        explanation: "A steadily closing gap on a finite circular path forces a meeting.",
        concept: "complexity",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "overview: fast-slow",
      },
      {
        id: "q7",
        question: "Which phrases hint at a same-direction read/write two-pointer solution? (Select all that apply.)",
        choices: [
          "\"in place\"",
          "\"O(1) extra space\"",
          "\"return any valid ordering\"",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "'in place' and 'O(1) extra space' are the compaction fingerprints; the third is unrelated.",
        concept: "pattern-recognition",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "tp-part-2-readwrite",
      },
      {
        id: "q8",
        question: "How is a sliding window related to two pointers?",
        choices: [
          "A window is a same-direction two-pointer setup where you care about the span between the pointers",
          "A window uses converging pointers from opposite ends",
          "A window requires fast/slow pointers",
          "They are unrelated patterns",
        ],
        correct_index: 0,
        explanation: "The window is the stretch between two same-direction pointers, a special case of two pointers.",
        concept: "pattern-recognition",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "overview: window kinship",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-tp-recognize", prompt: "Given a fresh problem, how fast could you now decide converging vs read/write vs fast/slow, and what is the first structural fact you would check?", hint: "Name the enabling structure you would look for first (sorted? in place? shared path?)." },
  { id: "diag-tp-heap", prompt: "The next lesson is Heap / Priority Queue. Where have you seen 'keep the best k so far' thinking, and what feels different about a problem that needs the largest-or-smallest repeatedly rather than a single pass?", hint: "Think top-k and streaming, not a one-shot sweep." },
  { id: "diag-tp-shaky", prompt: "What part of two pointers still feels shaky — the sorted precondition for converging, the write invariant, or the Floyd gap-closing argument?", hint: "Be specific so the next review targets it." },
  { id: "diag-tp-speed", prompt: "Could you write the converging two-sum and the in-place dedup skeletons from memory in under 5 minutes each right now? What would slow you down?", hint: "Execution speed is the interview bottleneck." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "Two Pointer in the interview-pattern map",
  description:
    "This lesson covers the three two-pointer geometries — converging, same-direction read/write, and fast/slow — the sorted precondition, and the greedy converging integrator. Heap / Priority Queue is the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "converging", label: "Converging pointers", category: "lesson_concept", covered: true },
    { id: "read-write", label: "Read/write compaction", category: "lesson_concept", covered: true },
    { id: "fast-slow", label: "Fast/slow (Floyd)", category: "lesson_concept", covered: true },
    { id: "sorted-precondition", label: "Sorted precondition", category: "lesson_concept", covered: true },
    { id: "sliding-window", label: "Sliding Window (prior)", category: "concept", covered: true },
    { id: "container-water", label: "Container with most water", category: "concept", preview: true },
    { id: "heap", label: "Heap / Priority Queue (next)", category: "concept" },
  ],
  edges: [],
  curriculum_stages: [
    { id: "assessment", label: "Initial assessment", status: "done" },
    { id: "sliding-window", label: "Sliding Window", status: "done" },
    { id: "two-pointer", label: "Two Pointer", status: "current" },
    { id: "heap", label: "Heap / Priority Queue", status: "next" },
    { id: "trie", label: "Trie", status: "later" },
    { id: "backtracking", label: "Backtracking", status: "later" },
    { id: "monotonic-stack", label: "Monotonic Stack", status: "later" },
  ],
  current: "two-pointer",
};

const planningRationale =
  "Two Pointer follows Sliding Window because a window is itself a same-direction two-pointer setup, so the lesson explicitly builds on that kinship while widening the family to converging (opposite-end) and fast/slow (Floyd) pointers. It targets Frank's tracked gap (only 14 imported evidence rows) and drills the highest-leverage interview skill — recognizing which geometry a problem needs and the enabling structure that licenses it (sorted for converging, forward-only prefix for read/write, shared path for fast/slow). The scaffolded exercises (converging two-sum, in-place dedup) plus a greedy converging integrator (container with most water) build execution speed, and the pattern_recognition questions plus 'when it fails' cases (unsorted two-sum) build the intuition that separates recognizers from grinders.";

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
  bad = fail("Part 1 (converging)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (read/write)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1260)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Two Pointer: One Index, Then a Second That Kills the Inner Loop";
  const description =
    "The sibling of the window you just learned: a second index removes the O(n²) inner loop when the structure makes one comparison decisive. Three geometries — converging (sorted, opposite ends), same-direction read/write (in place), and fast/slow (Floyd) — plus how to recognize each and when forcing the pattern is a bug.";
  const goals = JSON.stringify([
    "Tell converging, read/write, and fast/slow two-pointer problems apart from trigger phrases in under 2 minutes",
    "Implement converging two-sum and in-place compaction with the correct O(n) / O(1) moves, from a scaffold",
    "Explain the enabling structure each geometry needs and why unsorted two-sum is a hash-map problem, not a two-pointer one",
  ]);
  const tags = JSON.stringify(["two-pointer", "sliding-window", "arrays-and-strings", "weak-pattern", "interview-prep"]);
  const overviewAudioContent = {
    script: OVERVIEW_SCRIPT,
    transcript: OVERVIEW_SCRIPT,
    duration_hint: 1260,
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
    insertAct.run(lessonId, "audio", 1, "Audio: Two Pointer — the family map", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Converging pointers", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Same-direction read/write", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: container with most water", JSON.stringify(finalCode));
    insertAct.run(lessonId, "assessment", 5, "Assessment: Two Pointer recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 5 activities.`);
  closeDb();
}

main();
