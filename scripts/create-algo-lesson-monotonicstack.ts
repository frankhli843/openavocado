#!/usr/bin/env tsx
/**
 * P4.1 — Lesson 7 of the "Coding Interview Mastery" subject (id 9):
 * "Monotonic Stack: Keep the Unresolved in Order, Let the Newcomer Settle Up".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in
 * this env). Weak-pattern-first: Monotonic Stack has minimal imported evidence,
 * so it gets full teaching.
 *
 * Structure mirrors the Backtracking / Trie / Heap / Two Pointer / Sliding
 * Window lessons: top-level 2-host overview audio + orientation visual, two
 * collapsed lesson_parts (Next Greater Element via a decreasing stack; Largest
 * Rectangle in a histogram via an increasing stack) each with a bespoke approved
 * artifact + per-part audio synced visual + scaffolded code + mixed practice
 * (incl. pattern_recognition), a final integrator practice_code (Trapping Rain
 * Water, LeetCode 42), an adaptive MC + freeform assessment, and a timed
 * code_drill (Daily Temperatures, LeetCode 739). Cue timings are provisional and
 * rescaled to the real generated audio duration by rescale-monotonicstack-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-monotonic-overview-map, algo-monotonic-nge, algo-monotonic-histogram
 *
 * Idempotent: replaces any prior seq=6 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-monotonicstack.ts
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
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/monotonic-stack-audio";

const SUBJECT_ID = 9;
const SEQ = 6;

const A_OVERVIEW = "algo-monotonic-overview-map";
const A_NGE = "algo-monotonic-nge";
const A_HIST = "algo-monotonic-histogram";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "monotonic-orientation",
    title: "Monotonic stack: keep the unresolved in order, let each newcomer settle up",
    motif: "push-once-pop-once",
    description:
      "Orientation for the whole pattern: 'for each element, find the nearest thing to one side that is bigger, smaller, or walls it in' looks quadratic — a scan inside a scan — but a monotonic stack collapses it to one linear pass. You keep on a stack only the elements whose answer is still open, always in sorted order (increasing or decreasing). When a new element would break the order, you pop, and every pop is the exact moment the popped element's answer becomes known — its boundaries read off the exposed neighbor and the current index. Push once, pop at most once, so the whole scan is O(n). Choose the direction by what arrival resolves a waiter; store indices so a pop yields a width; cap the leftovers with a default or a flushing sentinel.",
    panels: [
      {
        id: "cost",
        title: "Cost collapse",
        kind: "flow" as const,
        description: "Why the pattern exists: re-scanning the rest for every element is O(n^2); keeping only the unresolved in order makes it one pass.",
        data: [
          { label: "for each element, re-scan the rest", value: "O(n^2)", role: "input" as const },
          { label: "keep only unresolved, in sorted order", value: "pop-and-resolve on arrival", role: "process" as const },
          { label: "push once, pop at most once", value: "O(n)", role: "output" as const },
        ],
      },
      {
        id: "jobs",
        title: "Four fingerprints",
        kind: "cards" as const,
        description: "Nearest greater/smaller, span/wait-time, largest rectangle, and trapping water.",
        data: [
          { label: "nearest greater / smaller", value: "decreasing / increasing stack", role: "context" as const },
          { label: "span / wait-time", value: "store indices → distance", role: "context" as const },
          { label: "largest rectangle / water", value: "a pop resolves an area", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 170, label: "The trigger", headline: "\"Nearest bigger/smaller\" looks quadratic", narration: "When each element needs the nearest larger or smaller neighbor, the brute force is a scan inside a scan; a monotonic stack makes it one pass.", receive: "a nearest-neighbor problem", transform: "recognize the re-scan", pass: "a reason to use a stack" },
    { start: 170, end: 350, label: "Unresolved in order", headline: "The stack holds only open answers", narration: "You keep on the stack only the elements whose answer is still open, always sorted increasing or decreasing.", receive: "the elements seen so far", transform: "keep only the unresolved, in order", pass: "a sorted waiting list" },
    { start: 350, end: 560, label: "Pop resolves", headline: "A newcomer settles the accounts", narration: "When a new element breaks the order you pop, and each pop is the moment the popped element's answer becomes known.", receive: "an order-breaking arrival", transform: "pop and resolve", pass: "an answer, boundaries read off the stack" },
    { start: 560, end: 760, label: "Amortized linear", headline: "Push once, pop at most once", narration: "Every element is pushed once and popped at most once, so the inner while loop is amortized constant and the scan is linear.", receive: "the whole run", transform: "count pushes and pops", pass: "O(n)" },
    { start: 760, end: 960, label: "Direction & indices", headline: "Increasing vs decreasing; store indices", narration: "Pick the direction from what arrival resolves a waiter; store indices so a pop yields both a value and a width.", receive: "the question's shape", transform: "choose direction and payload", pass: "the right skeleton" },
    { start: 960, end: 1120, label: "Leftovers", headline: "Default or flushing sentinel", narration: "Elements never popped keep a default answer, or you append a sentinel that forces every one to be measured in the same loop.", receive: "the elements still on the stack", transform: "default or flush", pass: "a clean finish" },
    { start: 1120, end: 1200, label: "When it fails", headline: "Only for nearest-monotonic-neighbor", narration: "If there is no waiting element resolved by a later arrival, the stack has nothing to do — reach for a heap or a sort instead.", receive: "a candidate problem", transform: "check the fingerprint", pass: "a go / no-go decision" },
  ],
};

// ── Reading builder helper ────────────────────────────────────────────────────
const monotonicComplexity = {
  type: "formula",
  latex: "\\text{time } O(n) \\qquad \\text{space } O(n)",
  plain_english:
    "Even though the loop body contains a while loop, the whole scan is linear. The reason is an amortized argument: each element is pushed onto the stack exactly once and popped off at most once across the entire run, so the total pop work is bounded by n no matter how the cascades are distributed. The outer loop is another n, giving O(n) time. The stack can hold up to every element in the worst case (a strictly monotonic input), so the extra space is O(n).",
  variables: [
    { symbol: "n", meaning: "the number of elements you scan once" },
    { symbol: "O(n) \\text{ time}", meaning: "push once + pop at most once + one outer pass" },
    { symbol: "O(n) \\text{ space}", meaning: "the stack of still-unresolved elements" },
  ],
};

// ── Part 1: the template via Next Greater Element (decreasing stack) ──────────
const part1 = {
  part_id: "monotonic-part-1-next-greater",
  reading: {
    blocks: [
      { type: "heading", text: "The template: a decreasing stack where each pop resolves an answer" },
      {
        type: "paragraph",
        text:
          "The cleanest place to learn a monotonic stack is Next Greater Element: for each number, find the first strictly larger number to its right, or report that none exists. The brute force scans rightward from every position, which is quadratic. The monotonic stack does it in one left-to-right pass by keeping on the stack only the elements whose answer is still open, held so their values are strictly decreasing from bottom to top. You store indices, not raw values, because an index lets you recover the value and, in span variants, the distance. When a new element arrives, you compare it to the value at the top index: while the new element is greater, it is the next greater element for that top index, so you pop and record the arriving value as the answer. One arrival can resolve several waiters at once, because everyone on a decreasing stack that is smaller than the newcomer was waiting for exactly this. Then you push the current index, since its own answer is still unknown. Elements still on the stack at the end were never beaten, so their answer stays the default of negative one.",
      },
      {
        type: "definition",
        term: "Monotonic invariant",
        definition:
          "The rule that the stack's values are always sorted in one direction — here strictly decreasing bottom to top. You maintain it by popping any element the arriving one dominates before you push. The invariant is what guarantees that a single pop resolves an answer and that each element is pushed once and popped at most once, which is why the scan is linear despite the inner while loop.",
      },
      {
        type: "example",
        body:
          "next_greater([2,1,2,4,3]): push i0(2). i1(1): 1 is not > 2, push i1 — stack values 2,1 stay decreasing. i2(2): 2 > top 1 → res[1]=2, pop; 2 is not > 2, push i2. i3(4): 4 > 2 → res[2]=4, pop; 4 > 2 → res[0]=4, pop; push i3. i4(3): 3 is not > 4, push i4. End: indices 3,4 (values 4,3) were never beaten, so res stays -1. Result [4,2,4,-1,-1].",
      },
      {
        type: "callout",
        text:
          "Two classic bugs: (1) storing raw values instead of indices, so you cannot compute a distance for span/wait-time variants; (2) the strict-versus-equal comparison — popping on '>' versus '>=' decides whether equal values resolve each other, so pick it deliberately based on whether ties should count.",
      },
      monotonicComplexity,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_NGE,
      scene: {
        scene_id: "monotonic-nge-scene",
        title: "A bigger arrival pops and resolves every smaller waiter",
        motif: "decreasing-stack-resolves",
        description: "The full walk of next_greater([2,1,2,4,3]): the stack holds only indices whose next-greater is still open, kept decreasing in value; each arrival that beats the top pops it and writes the answer, and the leftovers keep the default -1.",
        panels: [
          {
            id: "beats",
            title: "The loop body",
            kind: "ledger" as const,
            description: "What each arrival does to the decreasing stack.",
            data: [
              { label: "while arrival > top value", value: "pop & record the answer", role: "process" as const },
              { label: "then", value: "push the current index", role: "input" as const },
              { label: "leftovers", value: "keep default -1", role: "output" as const },
            ],
          },
          {
            id: "why",
            title: "Why it is linear",
            kind: "matrix" as const,
            description: "The amortized accounting.",
            data: [
              { label: "each index pushed", value: "exactly once", role: "context" as const },
              { label: "each index popped", value: "at most once", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "The stack", headline: "Only unresolved indices", narration: "The stack holds only indices whose next-greater is still open, kept decreasing in value.", receive: "the elements seen", transform: "keep the unresolved, sorted", pass: "a waiting list" },
        { start: 30, end: 62, label: "Push a waiter", headline: "Smaller arrival just waits", narration: "An element that does not beat the top resolves nothing, so you just push its index.", receive: "a non-beating arrival", transform: "push it", pass: "a longer decreasing stack" },
        { start: 62, end: 95, label: "Pop resolves", headline: "Bigger arrival settles up", narration: "When the arrival beats the top value, it is that element's next greater, so pop and record it.", receive: "a beating arrival", transform: "pop and record", pass: "a known answer" },
        { start: 95, end: 128, label: "Cascade", headline: "One arrival, many resolved", narration: "Keep popping while the arrival beats the new top — one newcomer can resolve several waiters at once.", receive: "several smaller waiters", transform: "pop them all", pass: "many answers at once" },
        { start: 128, end: 150, label: "Leftovers", headline: "No greater → default -1", narration: "Indices still on the stack at the end were never beaten, so their answer stays negative one.", receive: "the unresolved leftovers", transform: "leave the default", pass: "the final answers" },
        { start: 150, end: 165, label: "Linear", headline: "Push once, pop once", narration: "Every index was pushed once and popped at most once, so the whole scan is linear.", receive: "the finished walk", transform: "count the operations", pass: "O(n)" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk next_greater([2,1,2,4,3]). Watch the stack hold only the still-unresolved indices, kept decreasing in value; see a bigger arrival pop-and-resolve every smaller waiter (writing its answer at that instant), and the leftovers 4 and 3 keep the default -1.",
    params: { artifact_slug: A_NGE, min_height: 360 },
  },
  code: {
    prompt:
      "Return, for each element, the next strictly greater element to its right, or -1 if none. Use a DECREASING monotonic stack of indices. Fill in the TODO: default res to -1; scan left to right; while the stack is non-empty and nums[stack[-1]] < the current value, pop and set res[popped] = current value; then push the current index.",
    starter_code:
      "def next_greater(nums):\n    res = [-1] * len(nums)\n    stack = []  # indices, values strictly decreasing bottom->top\n\n    for i, x in enumerate(nums):\n        # TODO:\n        #   while stack and nums[stack[-1]] < x:\n        #       res[stack.pop()] = x        # x is the next greater for that index\n        #   stack.append(i)\n        pass\n\n    return res\n",
    constraints: [
      "Store INDICES on the stack, not raw values, so span/wait-time variants can recover a distance.",
      "Keep the stack strictly decreasing in value: pop every index whose value is less than the current element before pushing.",
      "Elements still on the stack at the end have no greater element, so leave their answer as the default -1.",
    ],
    walkthrough: {
      title: "One pass, resolving on each pop",
      steps: [
        { title: "Default to -1", detail: "Initialize every answer to -1 up front; anything never resolved keeps it, which is exactly 'no greater element to the right'.", input: "nums", output: "res filled with -1" },
        { title: "Pop while dominated", detail: "For each element, while it is greater than the value at the top index, it is that index's next greater — pop and record it. One arrival can resolve several waiters.", input: "the current value", output: "answers written at the pop" },
        { title: "Push the open index", detail: "After the cascade, push the current index because its own next-greater is still unknown; the stack stays decreasing.", input: "the current index", output: "a still-decreasing stack" },
      ],
    },
    io_examples: [
      { label: "mixed", input: "nums = [2,1,2,4,3]", expected_output: "[4,2,4,-1,-1]", explanation: "4 resolves both 2s; the trailing 4 and 3 have nothing greater to the right." },
      { label: "increasing", input: "nums = [1,2,3,4]", expected_output: "[2,3,4,-1]", explanation: "Each element's neighbor is its next greater; the last has none." },
      { label: "decreasing", input: "nums = [5,4,3,2,1]", expected_output: "[-1,-1,-1,-1,-1]", explanation: "Nothing ever beats an earlier element; every answer stays -1." },
    ],
    visualization: {
      title: "decreasing stack · pop resolves · push the open index",
      description: "The stack holds only unresolved indices; each pop writes an answer.",
      items: [
        { label: "arrival > top value", value: "pop & record", role: "input" },
        { label: "cascade while dominated", value: "resolve many at once", role: "process" },
        { label: "push current index", value: "still decreasing", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The decreasing-stack template",
        code:
          "def next_greater(nums):\n    res = [-1] * len(nums)\n    stack = []\n    for i, x in enumerate(nums):\n        while stack and nums[stack[-1]] < x:\n            res[stack.pop()] = x\n        stack.append(i)\n    return res",
        explanation: "The while loop pops every waiter the arrival dominates and records the answer; the append keeps the still-open index. Push once, pop at most once → O(n).",
      },
      {
        label: "concise",
        title: "Circular variant (next greater in a ring)",
        code:
          "def next_greater_circular(nums):\n    n = len(nums)\n    res = [-1] * n\n    stack = []\n    for k in range(2 * n):\n        x = nums[k % n]\n        while stack and nums[stack[-1]] < x:\n            res[stack.pop()] = x\n        if k < n:\n            stack.append(k)\n    return res",
        explanation: "Scanning twice modulo n lets wrap-around neighbors resolve; only push during the first pass so each index is answered once.",
      },
    ],
    hints: [
      { level: 1, text: "Initialize res = [-1] * len(nums) so 'no greater element' is the default." },
      { level: 2, text: "Store indices on the stack, and keep values decreasing: the guard is nums[stack[-1]] < x." },
      { level: 3, text: "while stack and nums[stack[-1]] < x: res[stack.pop()] = x  — record the answer at the pop." },
      { level: 4, text: "After the while loop, stack.append(i) unconditionally — the current index's answer is still open." },
      { level: 5, text: "Use '<' (strict) so equal values do NOT resolve each other; that keeps 'strictly greater' correct." },
    ],
    tests: [
      { id: "t_mixed", description: "mixed values", assert: "assert next_greater([2,1,2,4,3]) == [4,2,4,-1,-1]" },
      { id: "t_incr", description: "increasing", assert: "assert next_greater([1,2,3,4]) == [2,3,4,-1]" },
      { id: "t_decr", description: "decreasing → all -1", assert: "assert next_greater([5,4,3,2,1]) == [-1,-1,-1,-1,-1]" },
    ],
    hidden_tests: [
      { id: "h_empty", description: "empty input", assert: "assert next_greater([]) == []" },
      { id: "h_single", description: "single element", assert: "assert next_greater([7]) == [-1]" },
      { id: "h_ties", description: "equal values do not resolve each other", assert: "assert next_greater([2,2,3]) == [3,3,-1]" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "mp1-so-1",
        type: "select_one",
        prompt: "For Next Greater Element to the right, which stack do you keep, and when do you pop?",
        concept: "monotonic-stack",
        difficulty: "easy",
        choices: [
          "A decreasing stack; pop while the arriving value is greater than the top value",
          "An increasing stack; pop while the arriving value is smaller than the top",
          "A sorted list you binary-search each step",
          "A max-heap you poll each step",
        ],
        correct_index: 0,
        explanation: "A larger arrival resolves the smaller waiters, so the stack stays decreasing and you pop while the newcomer beats the top.",
      },
      {
        id: "mp1-sa-multi",
        type: "select_all",
        prompt: "Which statements about the Next Greater Element walk are true?",
        concept: "monotonic-stack",
        difficulty: "medium",
        choices: [
          "Each pop is the moment the popped element's answer becomes known",
          "One arrival can resolve several waiting elements at once",
          "Every index is pushed once and popped at most once, so the scan is linear",
          "Elements left on the stack at the end should be re-scanned in a second loop",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Leftovers simply keep the default -1; there is no second scan — the other three are the core facts.",
      },
      {
        id: "mp1-sa-none",
        type: "select_all",
        prompt: "In next_greater([2,1,2,4,3]), which of these answers appear in the output? (If none, select none.)",
        concept: "monotonic-stack",
        difficulty: "hard",
        choices: [
          "res[3] (for value 4) is 5",
          "res[0] (for the first 2) is 3",
          "res[4] (for value 3) is 4",
        ],
        correct_indices: [],
        explanation: "None: res[3]=-1 (nothing beats 4), res[0]=4 (not 3), res[4]=-1 (3 is last). The actual output is [4,2,4,-1,-1].",
      },
      {
        id: "mp1-order",
        type: "ordering",
        prompt: "Order the operations for one arriving element in the Next Greater Element loop.",
        concept: "monotonic-stack",
        difficulty: "medium",
        items: [
          "Compare the arrival to the value at the top index",
          "While the arrival is greater, pop and record res[popped] = arrival",
          "Stop popping once the arrival no longer beats the top",
          "Push the current index onto the stack",
        ],
        correct_order: [
          "Compare the arrival to the value at the top index",
          "While the arrival is greater, pop and record res[popped] = arrival",
          "Stop popping once the arrival no longer beats the top",
          "Push the current index onto the stack",
        ],
      },
      {
        id: "mp1-pattern",
        type: "pattern_recognition",
        prompt: "\"For each day's temperature, return how many days you must wait for a warmer day (0 if none).\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Monotonic Stack", "Store indices for distance", "Two Pointer", "Binary Search", "Heap"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "This is the wait-time variant of next-greater; a decreasing monotonic stack of indices gives the distance currentIndex - poppedIndex.",
      },
      {
        id: "mp1-written",
        type: "written",
        prompt: "Explain why storing indices (rather than raw values) on the stack matters, using the wait-time / span variant as your example.",
        concept: "monotonic-stack",
        difficulty: "hard",
        actual_answer:
          "At the moment you pop an element you need three things to resolve it: its own value, the position of the neighbor now exposed below it, and the current scanning position. If the stack holds indices, all three are one lookup away — the value is the array indexed by the popped index, and the two positions are the exposed stack index and the loop counter. That is exactly what the wait-time variant needs: the answer is a distance, currentIndex minus poppedIndex, which is impossible to compute if the stack only held the raw temperature values, because a value does not tell you where it lived. Daily Temperatures is the clean example: for each day you want the number of days until a warmer one, so at the pop you compute i - poppedIndex. Storing values would force you to keep a parallel stack of positions anyway, which is strictly worse than just storing the index and dereferencing the array for the value. So indices are the default payload; raw values are only a shortcut for a pure next-greater-value query that never measures a distance.",
        rubric:
          "Full credit: a pop needs the value AND positions; indices give both via a lookup while raw values lose the positions; wait-time answer = i - poppedIndex needs the index. Partial: says 'store indices' without the distance reasoning. Low: vague.",
      },
    ],
  },
};

// ── Part 2: Largest Rectangle in Histogram (increasing stack + width) ─────────
const part2 = {
  part_id: "monotonic-part-2-largest-rectangle",
  reading: {
    blocks: [
      { type: "heading", text: "The same machine, an area answer: increasing stack, and a pop resolves a width" },
      {
        type: "paragraph",
        text:
          "Largest Rectangle in a Histogram uses the identical machine, but two things flip. First, the direction: you keep a stack of bar indices whose heights are increasing from bottom to top, because now it is a shorter arrival that resolves a taller waiter. Second, what a pop computes: instead of a neighbor, a pop resolves the widest rectangle limited by the popped bar's height. When a new bar is shorter than the bar on top of the stack, that top bar can extend no further right — the newcomer walls it in — so this is the moment to measure it. The height is the popped bar's height. The width is read off the stack for free: because the stack was increasing, the element now exposed just below the popped bar is the nearest strictly-shorter bar to the left, and the current position is the nearest shorter bar to the right, so the width runs from just past the left neighbor to just before the current index, which is current index minus the new stack top minus one. If the stack becomes empty after the pop, the bar reached the far left edge, so the width is simply the current index. A sentinel bar of height zero appended at the end is shorter than everything, so it forces every remaining bar to be popped and measured through the same loop body — no separate cleanup pass.",
      },
      {
        type: "definition",
        term: "Flushing sentinel",
        definition:
          "A fake trailing element guaranteed to trigger the pop condition for everything left on the stack — a height-zero bar for histograms, or positive infinity for a next-smaller problem. Like a guard node in a linked list, its only job is to make the general loop body handle the boundary case, so you write one loop instead of a loop plus a cleanup pass.",
      },
      {
        type: "example",
        body:
          "largest_rectangle([2,1,5,6,2,3]) with sentinel 0 appended: push i0(2). i1(1) < 2 → pop bar0, stack empties, width 1, area 2. push i1. push i2(5), i3(6). i4(2) < 6 → pop bar3, left=i2, width 4-2-1=1, area 6; 2 < 5 → pop bar2, left=i1, width 4-1-1=2, area 10 (winner). push i4. push i5(3). sentinel 0 pops bar5 (area 3), bar4 (width 4, area 8), bar1 (width 6, area 6). Max = 10.",
      },
      {
        type: "callout",
        text:
          "The width bug that costs interviews: computing width as 'current index minus popped index'. It must be 'current index minus the NEW stack top minus one', because the rectangle extends left past every taller bar you already popped, down to the shorter bar now exposed. When the stack empties, the width is the full current index.",
      },
      monotonicComplexity,
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_HIST,
      scene: {
        scene_id: "monotonic-histogram-scene",
        title: "A shorter bar walls in the taller ones; each pop measures a rectangle",
        motif: "increasing-stack-resolves-width",
        description: "The walk of largest_rectangle([2,1,5,6,2,3]) with a sentinel 0: the stack keeps increasing bar heights, a shorter arrival pops the taller bar and measures its widest rectangle with width = i - newTop - 1, and the sentinel flushes the leftovers in the same loop.",
        panels: [
          {
            id: "flip",
            title: "What flips from Part 1",
            kind: "matrix" as const,
            description: "Direction and payload change; the machine does not.",
            data: [
              { label: "direction", value: "increasing (shorter arrival resolves)", role: "input" as const },
              { label: "a pop resolves", value: "a rectangle's width×height", role: "process" as const },
            ],
          },
          {
            id: "width",
            title: "Reading the width",
            kind: "ledger" as const,
            description: "Both edges come off the stack.",
            data: [
              { label: "left edge", value: "the exposed neighbor below", role: "input" as const },
              { label: "right edge", value: "the current index", role: "process" as const },
              { label: "width", value: "i - newTop - 1 (or i if empty)", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Increasing stack", headline: "Bars kept short→tall", narration: "Keep a stack of bar indices with increasing heights; each still might extend right.", receive: "the bars so far", transform: "keep increasing", pass: "open rectangles" },
        { start: 30, end: 62, label: "A wall arrives", headline: "Shorter bar triggers a pop", narration: "When a new bar is shorter than the top, the top can extend no further right, so measure it now.", receive: "a shorter arrival", transform: "pop the walled-in bar", pass: "a rectangle to measure" },
        { start: 62, end: 95, label: "Height", headline: "The popped bar's height", narration: "The rectangle's height is the popped bar's own height.", receive: "the popped bar", transform: "take its height", pass: "the limiting height" },
        { start: 95, end: 128, label: "Width off the stack", headline: "Left neighbor + current index", narration: "The exposed neighbor is the nearest shorter bar left; the current index is the wall right; width = i - newTop - 1.", receive: "the two edges", transform: "subtract", pass: "the width" },
        { start: 128, end: 150, label: "Track the max", headline: "Height × width", narration: "Multiply height by width and keep the running maximum; here 5×2 = 10 wins.", receive: "height and width", transform: "multiply and compare", pass: "the best area" },
        { start: 150, end: 165, label: "Sentinel", headline: "Flush the leftovers", narration: "A trailing zero-height bar pops everything remaining through the same loop — no cleanup pass.", receive: "the bars still on the stack", transform: "flush with the sentinel", pass: "every bar measured" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk largest_rectangle([2,1,5,6,2,3]). Watch the increasing stack of bar indices, a shorter arrival pop-and-measure the walled-in bar (width = i - newTop - 1), the winning 5×2 = 10 rectangle, and the sentinel 0 flush the leftovers through the same loop body.",
    params: { artifact_slug: A_HIST, min_height: 380 },
  },
  code: {
    prompt:
      "Return the area of the largest rectangle in a histogram of bar heights. Use an INCREASING monotonic stack of indices and a sentinel. Fill in the TODO: append a 0 sentinel to heights; scan; while the stack is non-empty and the top bar is taller than the current height, pop it, take its height, compute width = i - stack[-1] - 1 (or i if the stack is now empty), and update the max area; then push i.",
    starter_code:
      "def largest_rectangle(heights):\n    stack = []  # indices, heights increasing bottom->top\n    max_area = 0\n    hs = list(heights) + [0]  # sentinel flushes the stack at the end\n\n    for i, h in enumerate(hs):\n        # TODO:\n        #   while stack and hs[stack[-1]] > h:\n        #       top = stack.pop()\n        #       height = hs[top]\n        #       left = stack[-1] if stack else -1\n        #       width = i - left - 1\n        #       max_area = max(max_area, height * width)\n        #   stack.append(i)\n        pass\n\n    return max_area\n",
    constraints: [
      "Keep the stack heights INCREASING: pop while the top bar is taller than the current height (a shorter bar walls it in).",
      "Width is i - (new stack top) - 1, or i when the stack empties — NOT i - popped index; the rectangle extends past every taller bar already popped.",
      "Append a height-0 sentinel so the leftovers are measured in the same loop instead of a separate cleanup pass.",
    ],
    walkthrough: {
      title: "Pop resolves a width, the sentinel flushes",
      steps: [
        { title: "Pop when walled in", detail: "A bar shorter than the top means the top cannot extend right, so pop and measure it now — height is the popped bar.", input: "a shorter arrival", output: "a rectangle to measure" },
        { title: "Read the width off the stack", detail: "Left edge = the exposed neighbor below (nearest shorter bar left); right edge = the current index. Width = i - newTop - 1, or i if the stack is empty.", input: "the two edges", output: "the rectangle width" },
        { title: "Sentinel flush", detail: "The trailing 0 is shorter than everything, so it pops and measures every remaining bar through the same loop body.", input: "the leftovers", output: "the global max area" },
      ],
    },
    io_examples: [
      { label: "classic", input: "heights = [2,1,5,6,2,3]", expected_output: "10", explanation: "Bars 5 and 6 give a 5×2 rectangle across indices 2–3." },
      { label: "two bars", input: "heights = [2,4]", expected_output: "4", explanation: "The taller bar alone (4×1) beats the 2×2 = 4 tie; max is 4." },
      { label: "flat", input: "heights = [3,3,3]", expected_output: "9", explanation: "One 3×3 rectangle spans all three equal bars." },
    ],
    visualization: {
      title: "increasing stack · shorter arrival pops · width = i - newTop - 1",
      description: "A pop measures the widest rectangle limited by the popped bar.",
      items: [
        { label: "shorter bar arrives", value: "pop the walled-in bar", role: "input" },
        { label: "left off stack, right = i", value: "width = i - newTop - 1", role: "process" },
        { label: "sentinel 0", value: "flush the leftovers", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The increasing-stack template with a sentinel",
        code:
          "def largest_rectangle(heights):\n    stack = []\n    max_area = 0\n    hs = list(heights) + [0]\n    for i, h in enumerate(hs):\n        while stack and hs[stack[-1]] > h:\n            top = stack.pop()\n            height = hs[top]\n            left = stack[-1] if stack else -1\n            width = i - left - 1\n            if height * width > max_area:\n                max_area = height * width\n        stack.append(i)\n    return max_area",
        explanation: "The pop measures the popped bar's widest rectangle; width uses the new stack top, not the popped index. The sentinel 0 flushes everything left.",
      },
      {
        label: "concise",
        title: "Precompute nearest-smaller spans",
        code:
          "def largest_rectangle(heights):\n    n = len(heights)\n    if n == 0:\n        return 0\n    left = [0] * n   # nearest shorter bar to the left\n    right = [0] * n  # nearest shorter bar to the right\n    st = []\n    for i in range(n):\n        while st and heights[st[-1]] >= heights[i]:\n            st.pop()\n        left[i] = st[-1] if st else -1\n        st.append(i)\n    st = []\n    for i in range(n - 1, -1, -1):\n        while st and heights[st[-1]] >= heights[i]:\n            st.pop()\n        right[i] = st[-1] if st else n\n        st.append(i)\n    return max(heights[i] * (right[i] - left[i] - 1) for i in range(n))",
        explanation: "The same nearest-smaller idea run twice (both directions) gives each bar's span; the area is height times span. Two monotonic passes instead of one with a sentinel.",
      },
    ],
    hints: [
      { level: 1, text: "Append a 0 sentinel: hs = list(heights) + [0]; it forces every bar to be popped and measured." },
      { level: 2, text: "Keep heights increasing: while stack and hs[stack[-1]] > h: measure the popped bar." },
      { level: 3, text: "height = hs[top]; left = stack[-1] if stack else -1; width = i - left - 1." },
      { level: 4, text: "The width uses the NEW stack top after popping, not the popped index itself." },
      { level: 5, text: "When the stack is empty after a pop, the bar reached the far left, so width = i (i - (-1) - 1)." },
    ],
    tests: [
      { id: "t_classic", description: "classic histogram", assert: "assert largest_rectangle([2,1,5,6,2,3]) == 10" },
      { id: "t_two", description: "two bars", assert: "assert largest_rectangle([2,4]) == 4" },
      { id: "t_flat", description: "equal bars", assert: "assert largest_rectangle([3,3,3]) == 9" },
    ],
    hidden_tests: [
      { id: "h_empty", description: "empty histogram", assert: "assert largest_rectangle([]) == 0" },
      { id: "h_single", description: "single bar", assert: "assert largest_rectangle([5]) == 5" },
      { id: "h_valley", description: "valley shape", assert: "assert largest_rectangle([6,2,5,4,5,1,6]) == 12" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "mp2-so-1",
        type: "select_one",
        prompt: "In Largest Rectangle in a Histogram, what does a single pop resolve, and what stack do you keep?",
        concept: "monotonic-stack",
        difficulty: "easy",
        choices: [
          "The widest rectangle limited by the popped bar's height; an increasing stack",
          "The next taller bar to the right; a decreasing stack",
          "The average bar height; a sorted list",
          "The number of bars shorter than the current one; a heap",
        ],
        correct_index: 0,
        explanation: "A shorter arrival walls in the top bar, so popping it measures its widest rectangle; the stack keeps heights increasing.",
      },
      {
        id: "mp2-sa-multi",
        type: "select_all",
        prompt: "Which statements about the histogram walk are true?",
        concept: "monotonic-stack",
        difficulty: "medium",
        choices: [
          "The left edge of the popped bar's rectangle is the neighbor now exposed on the stack",
          "The right edge is the current index that triggered the pop",
          "A sentinel bar of height 0 flushes the remaining bars in the same loop",
          "The width equals the current index minus the popped index",
        ],
        correct_indices: [0, 1, 2],
        explanation: "The width is current index minus the NEW stack top minus one, not minus the popped index — the rectangle extends past every taller bar already popped.",
      },
      {
        id: "mp2-sa-none",
        type: "select_all",
        prompt: "For largest_rectangle([2,1,5,6,2,3]) = 10, which of these describe the winning rectangle? (If none, select none.)",
        concept: "monotonic-stack",
        difficulty: "hard",
        choices: [
          "Height 6 across a width of 2",
          "Height 2 across a width of 6",
          "Height 3 across a width of 4",
        ],
        correct_indices: [],
        explanation: "None: the winning rectangle is height 5 across width 2 (bars at indices 2–3, area 10). Each listed rectangle is unachievable — the bars needed for that height and width are not contiguously present.",
      },
      {
        id: "mp2-order",
        type: "ordering",
        prompt: "Order the steps taken when a shorter bar triggers a pop in the histogram walk.",
        concept: "monotonic-stack",
        difficulty: "medium",
        items: [
          "Pop the top index; its bar is walled in on the right",
          "Take the popped bar's height as the rectangle height",
          "Compute width = current index - new stack top - 1 (or current index if empty)",
          "Update the running maximum area",
        ],
        correct_order: [
          "Pop the top index; its bar is walled in on the right",
          "Take the popped bar's height as the rectangle height",
          "Compute width = current index - new stack top - 1 (or current index if empty)",
          "Update the running maximum area",
        ],
      },
      {
        id: "mp2-pattern",
        type: "pattern_recognition",
        prompt: "\"Given elevations, compute how much rain water is trapped between the bars.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Monotonic Stack", "Two Pointer", "Dynamic Programming (prefix max)", "Binary Search", "Heap"],
        primary_indices: [0],
        secondary_indices: [1, 2],
        explanation: "Trapping Rain Water has a decreasing-monotonic-stack solution (pop resolves a water layer); a converging two-pointer and a precomputed left/right-max DP are equally valid alternatives.",
      },
      {
        id: "mp2-written",
        type: "written",
        prompt: "Explain why the rectangle width at a pop is 'current index minus new stack top minus one' and not 'current index minus the popped index'.",
        concept: "monotonic-stack",
        difficulty: "hard",
        actual_answer:
          "The popped bar's rectangle is limited in height by that bar, but it can extend horizontally as far left and right as every bar that is at least as tall. Because the stack was kept increasing, all the bars between the popped bar and the neighbor now exposed below it were taller and have already been popped — meaning the popped bar's height fits across all of them. So the true left edge of the rectangle is not the popped bar's own position; it is one past the exposed neighbor, the nearest strictly shorter bar to the left. The right edge is the current index, the nearest shorter bar to the right, which is exactly why the pop is happening now. The span of full-height coverage therefore runs from newTop+1 to i-1 inclusive, whose length is i - newTop - 1. Using i minus the popped index would only count from the bar's own position rightward and would ignore all the taller bars to its left that the rectangle actually covers, badly undercounting the width. When the stack empties after the pop, there is no shorter bar to the left at all, so the rectangle reaches the far left edge and the width is the full current index i.",
        rubric:
          "Full credit: the rectangle extends left past every taller already-popped bar to the exposed neighbor; left edge = newTop+1, right edge = i-1, width = i - newTop - 1; empty stack → width i. Partial: says use the new top without explaining the taller-bars coverage. Low: vague.",
      },
    ],
  },
};

// ── Final integrator practice_code: Trapping Rain Water (LeetCode 42) ─────────
const finalCode = {
  prompt:
    "Integrator: compute how much rain water is trapped over a bar chart. This fuses both parts — a DECREASING monotonic stack of indices, where a pop resolves one horizontal layer of water bounded left and right by two walls. Fill in the TODO: scan; while the stack is non-empty and the current bar is taller than the bar at the top, pop it as the 'floor'; if the stack is now empty there is no left wall so break; otherwise the left wall is the new top, the width is i - left - 1, the bounded height is min(height[left], current) - height[floor], and you add width * bounded to the total; then push i.",
  starter_code:
    "def trap(height):\n    stack = []  # indices, heights decreasing bottom->top\n    water = 0\n\n    for i, h in enumerate(height):\n        # TODO:\n        #   while stack and height[stack[-1]] < h:\n        #       floor = stack.pop()\n        #       if not stack:\n        #           break            # no left wall -> no water on this layer\n        #       left = stack[-1]\n        #       width = i - left - 1\n        #       bounded = min(height[left], h) - height[floor]\n        #       water += width * bounded\n        #   stack.append(i)\n        pass\n\n    return water\n",
  constraints: [
    "Keep the stack heights DECREASING: pop while the current bar is taller than the top — the current bar is the right wall.",
    "A pop resolves ONE horizontal layer: width = i - left - 1, bounded height = min(height[left], current) - height[floor].",
    "If the stack is empty after popping the floor, there is no left wall, so that layer holds no water — break out of the while loop.",
  ],
  walkthrough: {
    title: "A pop resolves one water layer between two walls",
    steps: [
      { title: "Taller bar = right wall", detail: "While the current bar is taller than the top, the current bar can wall in water above the top bar, so pop the top as the floor of a layer.", input: "a taller arrival", output: "a floor to fill over" },
      { title: "Left wall off the stack", detail: "The element now exposed below the floor is the left wall. With no element left, there is no left wall, so that layer traps nothing — break.", input: "the exposed neighbor", output: "the left wall or a break" },
      { title: "Add the bounded layer", detail: "The layer's height is min(left wall, right wall) minus the floor's height; its width is i - left - 1; add their product.", input: "the two walls and the floor", output: "the trapped water for this layer" },
    ],
  },
  io_examples: [
    { label: "classic", input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", expected_output: "6", explanation: "Six units trapped across the valleys; each pop adds one horizontal slab." },
    { label: "deep well", input: "height = [4,2,0,3,2,5]", expected_output: "9", explanation: "The 5 on the right and 4 on the left bound a large basin." },
    { label: "no basin", input: "height = [5,4,3,2,1]", expected_output: "0", explanation: "Strictly decreasing bars hold no water — there is never a right wall." },
  ],
  visualization: {
    title: "decreasing stack · pop a floor · fill between two walls",
    description: "Each pop resolves one horizontal layer of trapped water.",
    items: [
      { label: "taller bar arrives", value: "pop the floor", role: "input" },
      { label: "left wall = new top", value: "width = i - left - 1", role: "process" },
      { label: "min(walls) - floor", value: "add width × bounded", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "The decreasing-stack, layer-by-layer template",
      code:
        "def trap(height):\n    stack = []\n    water = 0\n    for i, h in enumerate(height):\n        while stack and height[stack[-1]] < h:\n            floor = stack.pop()\n            if not stack:\n                break\n            left = stack[-1]\n            width = i - left - 1\n            bounded = min(height[left], h) - height[floor]\n            water += width * bounded\n        stack.append(i)\n    return water",
      explanation: "Each pop resolves one horizontal slab bounded by the left wall (new top) and right wall (current bar); no left wall means no water, so break.",
    },
    {
      label: "concise",
      title: "Converging two-pointer variant",
      code:
        "def trap(height):\n    if not height:\n        return 0\n    l, r = 0, len(height) - 1\n    lmax, rmax = height[l], height[r]\n    water = 0\n    while l < r:\n        if lmax < rmax:\n            l += 1\n            lmax = max(lmax, height[l])\n            water += lmax - height[l]\n        else:\n            r -= 1\n            rmax = max(rmax, height[r])\n            water += rmax - height[r]\n    return water",
      explanation: "The two-pointer form fills water column-by-column from the shorter side, using O(1) space instead of a stack — the same answer, a different lens.",
    },
  ],
  hints: [
    { level: 1, text: "Keep a decreasing stack of indices; the current bar is taller than the top is the trigger to pop a floor." },
    { level: 2, text: "After popping the floor, if the stack is empty there is no left wall — break; otherwise left = stack[-1]." },
    { level: 3, text: "width = i - left - 1; bounded = min(height[left], h) - height[floor]; water += width * bounded." },
    { level: 4, text: "Keep popping while the current bar still beats the new top — one arrival can fill several layers." },
    { level: 5, text: "Push i at the end of each step; the water accumulates layer by horizontal layer, not column by column." },
  ],
  tests: [
    { id: "f_classic", description: "classic profile", assert: "assert trap([0,1,0,2,1,0,1,3,2,1,2,1]) == 6" },
    { id: "f_well", description: "deep well", assert: "assert trap([4,2,0,3,2,5]) == 9" },
    { id: "f_none", description: "strictly decreasing traps nothing", assert: "assert trap([5,4,3,2,1]) == 0" },
  ],
  hidden_tests: [
    { id: "hf_empty", description: "empty input", assert: "assert trap([]) == 0" },
    { id: "hf_vshape", description: "simple V holds 2", assert: "assert trap([2,0,2]) == 2" },
    { id: "hf_flat", description: "flat holds nothing", assert: "assert trap([3,3,3]) == 0" },
  ],
};

// ── Timed code drill: Daily Temperatures (LeetCode 739) ───────────────────────
const codeDrill = {
  pattern: "monotonic-stack",
  prompt:
    "One rep, timed: given daily temperatures, return an array where answer[i] is how many days you must wait after day i for a warmer day, or 0 if none. This is the wait-time variant of next-greater — a DECREASING monotonic stack of INDICES, where a warmer arrival pops each waiting day and records the distance i - poppedIndex.",
  target_seconds: 420,
  difficulty: "medium",
  language: "python",
  starter_code:
    "def daily_temperatures(temps):\n    res = [0] * len(temps)\n    stack = []  # indices, temperatures decreasing bottom->top\n\n    for i, t in enumerate(temps):\n        # TODO: while stack and temps[stack[-1]] < t:\n        #           j = stack.pop(); res[j] = i - j\n        #       stack.append(i)\n        pass\n\n    return res\n",
  tests: [
    { id: "d_classic", description: "canonical example", assert: "assert daily_temperatures([73,74,75,71,69,72,76,73]) == [1,1,4,2,1,1,0,0]" },
    { id: "d_incr", description: "each next day warmer", assert: "assert daily_temperatures([30,40,50,60]) == [1,1,1,0]" },
    { id: "d_decr", description: "never warms up", assert: "assert daily_temperatures([90,80,70]) == [0,0,0]" },
    { id: "d_single", description: "single day", assert: "assert daily_temperatures([50]) == [0]" },
    { id: "d_gap", description: "distance greater than one", assert: "assert daily_temperatures([30,60,90]) == [1,1,0]" },
  ],
  hints: [
    { unlock_at_pct: 33, text: "Default res to zeros so 'no warmer day' needs no special case. Keep a decreasing stack of INDICES." },
    { unlock_at_pct: 66, text: "while stack and temps[stack[-1]] < t: j = stack.pop(); res[j] = i - j  — the answer is the distance." },
    { unlock_at_pct: 100, text: "After the while loop, stack.append(i). Storing indices (not temps) is what lets you compute i - j." },
  ],
  solution:
    "def daily_temperatures(temps):\n    res = [0] * len(temps)\n    stack = []\n    for i, t in enumerate(temps):\n        while stack and temps[stack[-1]] < t:\n            j = stack.pop()\n            res[j] = i - j\n        stack.append(i)\n    return res\n",
};

// ── Assessment (adaptive MC + freeform) ───────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Describe the monotonic stack machine in one paragraph: what sits on the stack, what a pop means, and why the whole scan is linear despite the inner while loop.",
      type: "free_text",
      concept: "monotonic-stack",
      difficulty: "medium",
      actual_answer:
        "A monotonic stack holds only the elements whose answer is still open, kept in sorted order — increasing or decreasing depending on the problem. You scan the input once. When a new element would break the sorted order, you pop, and each pop is the exact moment the popped element's answer becomes known: the arriving element resolves it, and the neighbor now exposed on the stack plus the current index give its boundaries for free. One arrival can resolve several waiters at once. The scan is linear because of an amortized argument: every element is pushed onto the stack exactly once and popped off at most once across the entire run, so the total pop work is bounded by n regardless of how the cascades cluster. A single step's while loop may pop many elements, but those elements can never be popped again, so they contribute nothing to future steps. Push once, pop at most once, plus one outer pass, is O(n).",
      rubric:
        "Full credit: stack holds unresolved elements in sorted order; a pop resolves the popped element's answer with boundaries from the exposed neighbor + current index; linear by amortized push-once/pop-once. Partial: describes the mechanism but not the amortized cost. Low: vague.",
      support_ref: "monotonic-part-1-next-greater",
    },
    {
      id: "a-free-2",
      text: "A candidate solving Largest Rectangle computes the width at a pop as 'current index minus the popped index' and gets wrong answers. Explain the bug and the correct width.",
      type: "free_text",
      concept: "monotonic-stack",
      difficulty: "hard",
      actual_answer:
        "The bug is that the popped bar's rectangle does not start at the popped bar's own position — it extends leftward across every taller bar that was already popped before it. Because the stack is kept increasing, all the bars between the popped bar and the neighbor now exposed below it were taller, so the popped bar's height fits across all of them; the true left edge is one past that exposed neighbor, which is the nearest strictly shorter bar to the left. The right edge is the current index, the nearest shorter bar to the right, which is why the pop is firing now. So the width is current index minus the new stack top minus one, i - newTop - 1. Using current index minus the popped index only counts from the bar's own position rightward and ignores all the taller bars to its left that the rectangle actually covers, so it undercounts and produces too-small areas. When the stack is empty after the pop, there is no shorter bar to the left, so the rectangle reaches the far left edge and the width is the full current index i.",
      rubric:
        "Full credit: the rectangle extends left past already-popped taller bars to the exposed neighbor, so width = i - newTop - 1; i - poppedIndex undercounts; empty stack → width i. Partial: says use the new top without the taller-bars reasoning. Low: vague.",
      support_ref: "monotonic-part-2-largest-rectangle",
    },
    {
      id: "a-free-3",
      text: "When is a monotonic stack the WRONG tool? Name the fingerprint that signals it and a problem shape where a heap or a sort is the right choice instead.",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "medium",
      actual_answer:
        "A monotonic stack is the right tool only for the specific fingerprint 'for each element, find the nearest element to one side that is bigger, smaller, or that walls it in' — next greater or smaller, span and wait-time, largest rectangle, trapping water. Its power comes from a waiting element being resolved by a later arrival in a single ordered pass. When the problem has no such notion of a waiting element getting settled by a neighbor, the stack has nothing to do and you are forcing it. For example, 'find the k largest elements' or 'repeatedly extract the current maximum' is a heap job — you need a priority queue, not a nearest-neighbor scan. 'Find whether any two numbers sum to a target' or 'group anagrams' is a hashing or sorting job. And a problem that needs a globally sorted order, not a nearest-larger relation, wants an actual sort. The tell is whether the answer for each element depends on the nearest element that breaks a monotonic relation; if it does, reach for the stack, and if it does not, a heap, hash, or sort usually fits.",
      rubric:
        "Full credit: fingerprint is 'nearest bigger/smaller/walling neighbor, resolved by a later arrival'; wrong when there is no waiting-element-resolved-by-neighbor shape; names a heap (top-k / running max) or sort/hash alternative. Partial: names the fingerprint OR an alternative but not both. Low: vague.",
      support_ref: "monotonic-part-1-next-greater",
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
        question: "What does a monotonic stack keep on it, and in what order?",
        choices: [
          "Only the elements whose answer is still open, kept in sorted (monotonic) order",
          "Every element seen so far, in arrival order",
          "The k largest elements, in a heap",
          "The elements sorted by frequency",
        ],
        correct_index: 0,
        explanation: "The stack holds just the unresolved elements, kept increasing or decreasing so a single pop resolves an answer.",
        concept: "monotonic-stack",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "monotonic-part-1-next-greater",
      },
      {
        id: "q2",
        question: "Why is the whole scan O(n) even though the loop body contains a while loop?",
        choices: [
          "Each element is pushed once and popped at most once, so total stack work is bounded by n",
          "The while loop runs at most twice per element by definition",
          "The input is assumed to be sorted",
          "Because the stack never holds more than a constant number of elements",
        ],
        correct_index: 0,
        explanation: "It is an amortized argument: an element removed can never be removed again, so total pops ≤ n.",
        concept: "monotonic-stack",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "monotonic-part-1-next-greater",
      },
      {
        id: "q3",
        question: "For Next Greater Element to the right, which stack and pop rule are correct?",
        choices: [
          "Decreasing stack; pop while the arriving value is greater than the top value",
          "Increasing stack; pop while the arriving value is greater than the top value",
          "Decreasing stack; pop while the arriving value is smaller than the top value",
          "Increasing stack; never pop, just push",
        ],
        correct_index: 0,
        explanation: "A larger arrival resolves the smaller waiters, so keep the stack decreasing and pop while the newcomer beats the top.",
        concept: "monotonic-stack",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "monotonic-part-1-next-greater",
      },
      {
        id: "q4",
        question: "In Largest Rectangle, what does a single pop resolve?",
        choices: [
          "The widest rectangle limited in height by the popped bar",
          "The next taller bar to the right",
          "The average height of the remaining bars",
          "The number of bars taller than the popped one",
        ],
        correct_index: 0,
        explanation: "A shorter arrival walls in the top bar, so popping it measures the largest rectangle of that bar's height.",
        concept: "monotonic-stack",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "monotonic-part-2-largest-rectangle",
      },
      {
        id: "q5",
        question: "At a pop in the histogram walk, the rectangle width is:",
        choices: [
          "current index - new stack top - 1 (or current index if the stack is empty)",
          "current index - popped index",
          "popped index - new stack top",
          "the height of the popped bar",
        ],
        correct_index: 0,
        explanation: "The rectangle extends left past every taller already-popped bar to the exposed neighbor, so width = i - newTop - 1.",
        concept: "monotonic-stack",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "monotonic-part-2-largest-rectangle",
      },
      {
        id: "q6",
        question: "What is a 'flushing sentinel' and why is it used?",
        choices: [
          "A trailing element guaranteed to trigger the pop condition so leftovers are measured in the same loop",
          "A marker that sorts the input before scanning",
          "A second stack for the leftover elements",
          "A cache of already-computed answers",
        ],
        correct_index: 0,
        explanation: "Appending a height-0 bar (or +infinity) forces every remaining element to be popped, avoiding a separate cleanup pass.",
        concept: "monotonic-stack",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "monotonic-part-2-largest-rectangle",
      },
      {
        id: "q7",
        question: "Which problems are a monotonic-stack fingerprint? (Select all that apply.)",
        choices: [
          "\"days until a warmer temperature\"",
          "\"largest rectangle in a histogram\"",
          "\"the k most frequent elements\"",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "Wait-time and largest-rectangle are nearest-neighbor jobs; top-k frequency is a heap/bucket job.",
        concept: "pattern-recognition",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "monotonic-part-1-next-greater",
      },
      {
        id: "q8",
        question: "Why store indices rather than raw values on the stack?",
        choices: [
          "An index recovers both the value and the position, so a pop can yield a distance or width",
          "Indices use less memory than values",
          "Values cannot be compared directly",
          "It makes the stack sorted automatically",
        ],
        correct_index: 0,
        explanation: "Widths and wait-times are distances, which need positions; storing indices gives the value via a lookup and the position for free.",
        concept: "monotonic-stack",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "monotonic-part-1-next-greater",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-ms-recognize", prompt: "Given a fresh problem, how quickly could you now tell it wants a monotonic stack, and which fingerprint (nearest greater/smaller, span/wait-time, rectangle, water) it is?", hint: "Look for 'the nearest element to one side that breaks a monotonic relation'." },
  { id: "diag-ms-direction", prompt: "Can you state in one sentence how you decide increasing vs decreasing, and why you store indices?", hint: "Direction = what arrival resolves a waiter; indices = recover both value and width." },
  { id: "diag-ms-width", prompt: "Can you explain the histogram width formula i - newTop - 1 and when the width is just i?", hint: "The rectangle extends past every taller already-popped bar; empty stack → far left edge." },
  { id: "diag-ms-speed", prompt: "Could you write next-greater, daily temperatures, and largest rectangle from memory in under 5 minutes each right now? What would slow you down?", hint: "Execution speed is the interview bottleneck." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "Monotonic Stack in the interview-pattern map",
  description:
    "This lesson covers the monotonic-stack machine: a decreasing stack for next-greater and wait-time, an increasing stack for largest rectangle, the width formula, the flushing sentinel, and the trapping-rain-water integrator. DP reactivation is the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "ms-machine", label: "Push once / pop resolves", category: "lesson_concept", covered: true },
    { id: "ms-nge", label: "Next Greater (decreasing)", category: "lesson_concept", covered: true },
    { id: "ms-rectangle", label: "Largest Rectangle (increasing)", category: "lesson_concept", covered: true },
    { id: "ms-water", label: "Trapping Rain Water", category: "lesson_concept", covered: true },
    { id: "backtracking", label: "Backtracking (prior)", category: "concept", covered: true },
    { id: "stock-span", label: "Stock Span / sliding max", category: "concept", preview: true },
    { id: "dp-reactivation", label: "DP reactivation (next)", category: "concept" },
  ],
  edges: [],
  curriculum_stages: [
    { id: "heap", label: "Heap / Priority Queue", status: "done" },
    { id: "trie", label: "Trie / Prefix Tree", status: "done" },
    { id: "backtracking", label: "Backtracking", status: "done" },
    { id: "monotonic-stack", label: "Monotonic Stack", status: "current" },
    { id: "dp-reactivation", label: "DP reactivation", status: "next" },
    { id: "graph-reactivation", label: "Graph reactivation", status: "later" },
  ],
  current: "monotonic-stack",
};

const planningRationale =
  "Monotonic Stack is taught in full because the imported repo evidence flags it as near-untouched, one of the weakest remaining tracked patterns after sliding window, two pointer, heap, trie, and backtracking. The lesson grounds the machine first on Next Greater Element with a decreasing stack, where the two habits that make it click are visible: the stack holds only the still-unresolved elements in sorted order, and each pop is the exact moment an answer is known. The amortized push-once/pop-once argument is taught explicitly because it is what gives a learner the confidence to write a while loop inside a for loop without fearing quadratic cost. Part two flips both the direction (increasing) and what a pop resolves (a rectangle's width) on Largest Rectangle in a Histogram, teaching the width formula i - newTop - 1 and the flushing sentinel as the moves that trip up most candidates. The scaffolded exercises (next-greater, largest-rectangle) plus the trapping-rain-water integrator (a decreasing stack resolving one water layer per pop) and a timed Daily Temperatures drill build execution speed, and pattern_recognition questions plus a 'when it fails' case (no waiting-element-resolved-by-neighbor shape → reach for a heap or sort) build the recognition judgment that separates strong interviewees from grinders. It connects backward to the explore-then-unwind shape of backtracking, reframing the stack here as the data structure that remembers unfinished business.";

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
  bad = fail("Part 1 (next greater)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (largest rectangle)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Code drill", validateCodeDrillContent(codeDrill)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1280)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Monotonic Stack: Keep the Unresolved in Order, Let the Newcomer Settle Up";
  const description =
    "The tool for 'for each element, find the nearest thing to one side that is bigger, smaller, or walls it in' — a scan that looks quadratic collapsed to one linear pass. A monotonic stack holds only the still-unresolved elements in sorted order; each pop is the moment the popped element's answer is known, with boundaries read off the exposed neighbor and the current index. Covers next-greater and wait-time via a decreasing stack, largest rectangle via an increasing stack with the width formula and a flushing sentinel, and the trapping-rain-water integrator.";
  const goals = JSON.stringify([
    "Recognize monotonic-stack problems (nearest greater/smaller, span/wait-time, largest rectangle, trapping water) from trigger phrases in under 2 minutes",
    "Implement the machine from a scaffold: choose the direction, store indices, resolve on each pop, and cap the leftovers with a default or a flushing sentinel",
    "Explain the amortized push-once/pop-once linear cost, the histogram width formula i - newTop - 1, and when a heap or sort beats a monotonic stack",
  ]);
  const tags = JSON.stringify(["monotonic-stack", "stack", "arrays", "weak-pattern", "interview-prep"]);
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
    insertAct.run(lessonId, "audio", 1, "Audio: Monotonic Stack — keep the unresolved in order", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: The machine via Next Greater Element", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Largest Rectangle in a Histogram", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: Trapping Rain Water", JSON.stringify(finalCode));
    insertAct.run(lessonId, "code_drill", 5, "Drill: Daily Temperatures", JSON.stringify(codeDrill));
    insertAct.run(lessonId, "assessment", 6, "Assessment: Monotonic Stack recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 6 activities.`);
  closeDb();
}

main();
