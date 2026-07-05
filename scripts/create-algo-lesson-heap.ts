#!/usr/bin/env tsx
/**
 * P2.2 — Lesson 4 of the "Coding Interview Mastery" subject (id 9):
 * "Heap / Priority Queue: The Extreme, Again and Again, in log n".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in
 * this env). Weak-pattern-first: Heap has only ~8 imported evidence rows, so it
 * gets full teaching.
 *
 * Structure mirrors the Sliding Window / Two Pointer lessons: top-level 2-host
 * overview audio + orientation visual, two collapsed lesson_parts (heap
 * mechanics; the size-k min-heap top-k trick) each with a bespoke approved
 * artifact + per-part audio synced visual + scaffolded code + mixed practice
 * (incl. pattern_recognition), a final integrator practice_code (merge k sorted
 * lists), and an adaptive MC + freeform assessment. Cue timings are provisional
 * and rescaled to the real generated audio duration by rescale-heap-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-heap-overview-map, algo-heap-tree, algo-heap-topk
 *
 * Idempotent: replaces any prior seq=3 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-heap.ts
 */

import { getDb, closeDb } from "../src/db/connection";
import {
  validateLessonPartContent,
  validatePracticeCodeContent,
  validateAssessmentContent,
  validateAudioSyncedVisualContent,
  validateNextLessonDiagnostics,
} from "../src/lib/lesson-content/schema";
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/heap-audio";

const SUBJECT_ID = 9;
const SEQ = 3;

const A_OVERVIEW = "algo-heap-overview-map";
const A_TREE = "algo-heap-tree";
const A_TOPK = "algo-heap-topk";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "heap-orientation",
    title: "Heap / Priority Queue: the family map",
    motif: "the-extreme-again-and-again-in-log-n",
    description:
      "Orientation for the whole pattern: re-scanning for the extreme is O(n) each time; a heap makes get-min and insert O(log n). The heap does four jobs — top-k / k-th, merging streams, scheduling by priority, and repeated running-extreme — and Python's heapq is a min-heap only.",
    panels: [
      {
        id: "cost",
        title: "Cost collapse",
        kind: "flow" as const,
        description: "Why the pattern exists: re-scanning for the extreme every time is O(n); a heap makes it O(log n).",
        data: [
          { label: "re-scan for the extreme", value: "O(n) each time", role: "input" as const },
          { label: "keep a heap invariant", value: "parent ≤ children", role: "process" as const },
          { label: "get-min / insert", value: "O(log n)", role: "output" as const },
        ],
      },
      {
        id: "jobs",
        title: "Four jobs",
        kind: "cards" as const,
        description: "Top-k / k-th, merge sorted streams, schedule by priority, and repeated running-extreme (e.g. streaming median with two heaps).",
        data: [
          { label: "top-k / k-th", value: "size-k heap, O(n log k)", role: "context" as const },
          { label: "merge streams", value: "one frontier per list", role: "context" as const },
          { label: "schedule / running-extreme", value: "the ready queue", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 150, label: "The recurring-extreme cost", headline: "Re-scanning is O(n) each time", narration: "When you need the smallest again and again as data changes, scanning every time is wasteful.", receive: "a changing set of numbers", transform: "repeated linear scans", pass: "a baseline cost to beat" },
    { start: 150, end: 340, label: "The heap invariant", headline: "Parent ≤ children, root is the min", narration: "A local promise forces the minimum to the root while leaving the rest loosely ordered.", receive: "a pile of numbers", transform: "impose the heap invariant", pass: "the extreme in O(1)" },
    { start: 340, end: 540, label: "Array with index math", headline: "Children at 2i+1 and 2i+2", narration: "The tree is stored as a flat array; children and parents are pure index arithmetic — no pointers.", receive: "a binary tree shape", transform: "map to array indices", pass: "a pointerless heap" },
    { start: 540, end: 740, label: "Push sifts up, pop sifts down", headline: "Repair one root-to-leaf path", narration: "Insert drops at the end and sifts up; remove moves the last element to the root and sifts down.", receive: "an insert or a removal", transform: "sift along one path", pass: "an O(log n) operation" },
    { start: 740, end: 940, label: "The four jobs", headline: "Top-k, merge, schedule, running-extreme", narration: "Size-k top-k, k-way merge, priority scheduling, and streaming median with two heaps.", receive: "a problem statement", transform: "match to a heap job", pass: "the right heap setup" },
    { start: 940, end: 1140, label: "heapq is min-only", headline: "Negate for a max-heap", narration: "Python's heapq has no max flag; push negated values and negate on the way out.", receive: "a largest question", transform: "negate the values", pass: "a working max-heap" },
    { start: 1140, end: 1280, label: "When it fails", headline: "One-shot extreme, full sort, arbitrary search", narration: "A single scan beats a heap for a one-shot extreme; heaps do not give full order or middle lookups.", receive: "a candidate problem", transform: "check for recurrence", pass: "a go / no-go decision" },
  ],
};

// ── Reading builder helper ────────────────────────────────────────────────────
const heapComplexity = {
  type: "formula",
  latex: "\\text{scan } O(n) \\;\\longrightarrow\\; \\text{heap } O(\\log n)",
  plain_english:
    "Re-scanning a changing set for its extreme costs a full linear pass every time; a heap keeps the extreme at the root and repairs only one root-to-leaf path per change, so each get-min or insert is logarithmic.",
  variables: [
    { symbol: "n", meaning: "the number of elements currently in the heap" },
    { symbol: "log n", meaning: "the height of the balanced binary heap — the length of a sift path" },
  ],
};

// ── Part 1: heap mechanics ────────────────────────────────────────────────────
const part1 = {
  part_id: "heap-part-1-mechanics",
  reading: {
    blocks: [
      { type: "heading", text: "Heap mechanics: one local promise, two mirror-image repairs" },
      {
        type: "paragraph",
        text:
          "A binary min-heap is a tree in your head and an array in memory. Its only rule — the heap invariant — is local: every parent is at most its two children. That forces the minimum to the root but leaves everything else loosely ordered, which is exactly why it is fast: you never pay to fully sort. The tree is stored without pointers — a node at index i has children at 2i+1 and 2i+2 and a parent at (i-1)//2 — so structure is pure index arithmetic.",
      },
      {
        type: "definition",
        term: "Heap invariant",
        definition:
          "In a min-heap, every parent node is less than or equal to each of its children. This local promise (nothing is said about siblings) guarantees the global minimum sits at the root, readable in O(1), while the rest stays only partially ordered.",
      },
      {
        type: "example",
        body:
          "Insert into [2,5,4,8,6]: push 1 at the end (index 5), then sift up. 1 < parent 4, swap → 1 at index 2. 1 < parent 2, swap → 1 at the root. Remove the min: take 1, move the last value to the root and sift down, swapping with the smaller child until the parent-≤-children promise holds. Each repair walks one root-to-leaf path of length about log n.",
      },
      heapComplexity,
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
        scene_id: "heap-tree-scene",
        title: "Push sifts up, pop sifts down",
        motif: "repair-one-path-per-operation",
        description: "A binary min-heap drawn as a tree and an array; a push sifts the new value up and a pop moves the last value to the root and sifts it down, each along a single root-to-leaf path.",
        panels: [
          {
            id: "tree",
            title: "Tree and array views",
            kind: "matrix" as const,
            description: "The same heap shown as a tree and as the flat array it is stored in.",
            data: [
              { label: "root", value: "the minimum", role: "output" as const },
              { label: "children of i", value: "2i+1, 2i+2", role: "context" as const },
            ],
          },
          {
            id: "ops",
            title: "The two repairs",
            kind: "ledger" as const,
            description: "How insert and remove each restore the invariant.",
            data: [
              { label: "push", value: "drop at end, sift up", role: "input" as const },
              { label: "pop", value: "last → root, sift down", role: "input" as const },
              { label: "cost", value: "O(log n) each", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "A valid heap", headline: "Parent ≤ children", narration: "Every parent is at most its children, so the minimum sits at the root.", receive: "a pile of numbers", transform: "impose the invariant", pass: "the minimum at the root" },
        { start: 30, end: 62, label: "Push at the end", headline: "New value at the next leaf", narration: "Insert drops the new value at the end of the array to keep the shape gap-free.", receive: "a new value", transform: "place at the last slot", pass: "a temporarily out-of-order leaf" },
        { start: 62, end: 95, label: "Sift up", headline: "Swap while smaller than parent", narration: "Compare with the parent and swap upward until it fits or reaches the root.", receive: "an out-of-place leaf", transform: "swap up one path", pass: "a repaired heap" },
        { start: 95, end: 128, label: "Pop the root", headline: "Last element takes the throne", narration: "Remove the root as the answer, move the last value to the root, and sift it down.", receive: "a removal request", transform: "promote the last value", pass: "the minimum, plus a shape to repair" },
        { start: 128, end: 150, label: "Sift down", headline: "Swap with the smaller child", narration: "Swap with the smaller child until the parent-≤-children promise holds again.", receive: "an out-of-place root", transform: "swap down one path", pass: "a valid heap" },
        { start: 150, end: 165, label: "Why log n", headline: "One path, not the whole tree", narration: "Each repair walks a single root-to-leaf path of length about log n.", receive: "any single operation", transform: "bounded path length", pass: "an O(log n) guarantee" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to step a push (sift-up) and a pop (sift-down) through the min-heap. Watch the highlighted value swap along a single root-to-leaf path while the tree and its backing array stay in sync, and note the root always holds the minimum.",
    params: { artifact_slug: A_TREE, min_height: 360 },
  },
  code: {
    prompt:
      "Return the k smallest values of nums in ascending order using a heap. Heapify the list once (O(n)), then pop the minimum k times. Python's heapq is a min-heap: heapq.heapify(list) builds it in place, heapq.heappop(list) removes and returns the smallest. Fill in the two TODO helpers, then compose them.",
    starter_code:
      "import heapq\n\n\ndef build_heap(nums):\n    # TODO: copy nums into a list and heapify it in place (O(n)); return the heap list.\n    pass\n\n\ndef pop_min(heap):\n    # TODO: remove and return the smallest element using heapq.heappop.\n    pass\n\n\ndef k_smallest(nums, k):\n    # Compose: build the heap once, then pop the minimum k times.\n    heap = build_heap(nums)\n    out = []\n    for _ in range(k):\n        out.append(pop_min(heap))\n    return out\n",
    constraints: [
      "0 <= k <= len(nums).",
      "heapq is a MIN-heap: heappop returns the smallest. Build once with heapify (O(n)), then k pops (O(k log n)).",
    ],
    walkthrough: {
      title: "From blank file to k smallest via a heap",
      steps: [
        { title: "Bulk-build the heap", detail: "build_heap copies nums and calls heapq.heapify, which arranges the list into a valid min-heap in O(n) — cheaper than n separate pushes.", input: "nums", output: "a min-heap list" },
        { title: "Pop the minimum", detail: "pop_min calls heapq.heappop, which removes and returns the root (the smallest) and re-sifts in O(log n).", input: "the heap", output: "the current smallest" },
        { title: "Compose k pops", detail: "Pop k times, collecting each minimum; because each pop returns the next-smallest, the result comes out sorted ascending.", input: "nums, k", output: "the k smallest in order" },
      ],
    },
    io_examples: [
      { label: "typical", input: "nums = [5,3,8,1,9,2], k = 3", expected_output: "[1, 2, 3]", explanation: "The three smallest values, popped in ascending order." },
      { label: "duplicates", input: "nums = [4,4,4], k = 2", expected_output: "[4, 4]", explanation: "Duplicates are fine; the two smallest are both 4." },
      { label: "k = 0", input: "nums = [10,20,30], k = 0", expected_output: "[]", explanation: "Zero pops returns an empty list." },
    ],
    visualization: {
      title: "Input → heapify → pop",
      description: "Bulk-build once, then repeated get-min.",
      items: [
        { label: "raw list", value: "[5,3,8,1,9,2]", role: "input" },
        { label: "heapify O(n), then pop k times", value: "root = current min", role: "process" },
        { label: "k smallest in order", value: "[1,2,3]", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Explicit helpers",
        code:
          "import heapq\n\ndef build_heap(nums):\n    heap = list(nums)\n    heapq.heapify(heap)\n    return heap\n\ndef pop_min(heap):\n    return heapq.heappop(heap)\n\ndef k_smallest(nums, k):\n    heap = build_heap(nums)\n    out = []\n    for _ in range(k):\n        out.append(pop_min(heap))\n    return out",
        explanation: "heapify builds the heap in O(n); each heappop returns the next-smallest so the output is sorted.",
      },
      {
        label: "concise",
        title: "Idiomatic Python",
        code:
          "import heapq\n\ndef k_smallest(nums, k):\n    return heapq.nsmallest(k, nums)",
        explanation: "heapq.nsmallest does exactly this pattern under the hood, using a heap to get the k smallest in order.",
      },
    ],
    hints: [
      { level: 1, text: "heapq turns a list into a min-heap in place — the smallest ends up reachable at index 0." },
      { level: 2, text: "build_heap: copy nums into a new list, call heapq.heapify on it, return it." },
      { level: 3, text: "pop_min is just heapq.heappop(heap), which removes and returns the smallest." },
      { level: 4, text: "Popping k times collects the k smallest, and because each pop is the next-smallest they come out sorted." },
      { level: 5, text: "For the idiomatic one-liner, heapq.nsmallest(k, nums) does the whole job." },
    ],
    tests: [
      { id: "t_typical", description: "three smallest in order", assert: "assert k_smallest([5,3,8,1,9,2], 3) == [1, 2, 3]" },
      { id: "t_dups", description: "duplicates are handled", assert: "assert k_smallest([4,4,4], 2) == [4, 4]" },
      { id: "t_zero", description: "k = 0 returns empty", assert: "assert k_smallest([10,20,30], 0) == []" },
    ],
    hidden_tests: [
      { id: "h_neg", description: "handles negatives", assert: "assert k_smallest([-1,-5,2,0], 2) == [-5, -1]" },
      { id: "h_single", description: "single smallest", assert: "assert k_smallest([7], 1) == [7]" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "hp1-so-1",
        type: "select_one",
        prompt: "In a min-heap, what does the heap invariant guarantee about the ROOT?",
        concept: "heap",
        difficulty: "easy",
        choices: ["It holds the minimum element", "It holds the maximum element", "It holds the median", "Nothing in particular"],
        correct_index: 0,
        explanation: "Every parent ≤ its children, so the smallest value is forced to the root.",
      },
      {
        id: "hp1-sa-multi",
        type: "select_all",
        prompt: "Which statements about a binary min-heap are true?",
        concept: "heap",
        difficulty: "medium",
        choices: [
          "It is stored as an array; a node at index i has children at 2i+1 and 2i+2",
          "push and pop each run in O(log n)",
          "It keeps all elements fully sorted at all times",
          "Building a heap from n elements at once can be done in O(n)",
        ],
        correct_indices: [0, 1, 3],
        explanation: "A heap is only partially ordered (the invariant is local); push/pop are O(log n) and bulk heapify is O(n).",
      },
      {
        id: "hp1-sa-none",
        type: "select_all",
        prompt: "Which of these does a plain binary heap support EFFICIENTLY (better than O(n))? (If none, select none.)",
        concept: "heap",
        difficulty: "hard",
        choices: [
          "Finding whether an arbitrary value is present",
          "Returning the elements in fully sorted order for free",
          "Deleting a specific element from the middle by value",
        ],
        correct_indices: [],
        explanation: "None — a heap only makes the extreme cheap; arbitrary search, full sorting, and middle deletion are not its strengths.",
      },
      {
        id: "hp1-order",
        type: "ordering",
        prompt: "Order the steps of removing the minimum from a min-heap.",
        concept: "heap",
        difficulty: "medium",
        items: [
          "Take the root as the minimum to return",
          "Move the last element into the root slot",
          "Sift down: swap with the smaller child while out of order",
          "Stop when the parent is ≤ both children",
        ],
        correct_order: [
          "Take the root as the minimum to return",
          "Move the last element into the root slot",
          "Sift down: swap with the smaller child while out of order",
          "Stop when the parent is ≤ both children",
        ],
      },
      {
        id: "hp1-pattern",
        type: "pattern_recognition",
        prompt: "\"Design a data structure that supports inserting numbers and repeatedly removing the smallest one, both efficiently, as items keep arriving.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Heap / Priority Queue", "Sorting", "Two Pointer", "Binary Search Tree", "Sliding Window"],
        primary_indices: [0],
        secondary_indices: [3],
        explanation: "Repeated insert + remove-min on changing data is the priority-queue fingerprint. A balanced BST can also do it in O(log n) and is a reasonable secondary answer.",
      },
      {
        id: "hp1-written",
        type: "written",
        prompt: "Explain why removing the minimum moves the LAST element to the root (rather than promoting a child), and why the operation is still O(log n).",
        concept: "heap",
        difficulty: "hard",
        actual_answer:
          "The heap must stay a complete tree — every level full, filled left to right — because that shape is what makes the array index math (children at 2i+1 and 2i+2) valid. Promoting a child would leave a hole in the middle of the array and break that arithmetic. Moving the last element to the root keeps the shape perfectly compact; it only violates the value ordering temporarily. You then sift that element down, swapping it with its smaller child until the parent-≤-children invariant holds again. Sifting down walks a single root-to-leaf path whose length is the tree height, about log n, so the whole removal is O(log n).",
        rubric:
          "Full credit: moving the last element preserves the complete-tree shape (needed for the index math), and sift-down repairs ordering along one path of height log n. Partial: mentions shape OR the log n path but not both. Low: vague.",
      },
    ],
  },
};

// ── Part 2: the size-k min-heap top-k trick ───────────────────────────────────
const part2 = {
  part_id: "heap-part-2-topk",
  reading: {
    blocks: [
      { type: "heading", text: "The size-k min-heap: a MIN-heap answers a LARGEST question" },
      {
        type: "paragraph",
        text:
          "To find the k largest values (or the k-th largest) in a long stream, keep a MIN-heap that you never let grow past size k. Push each incoming value; the instant the heap exceeds k, pop its smallest. What survives is always the k largest seen so far, and the root — the smallest of those k — is exactly the k-th largest. A min-heap is right precisely because it keeps the weakest survivor at the root, ready to be evicted.",
      },
      {
        type: "definition",
        term: "Size-k heap trick",
        definition:
          "Bound a heap at k elements to track the top (or bottom) k of a stream. For the k LARGEST, use a min-heap so the smallest candidate sits at the root and is the first evicted; its root is the k-th largest. Cost is O(n log k) time and O(k) space.",
      },
      {
        type: "example",
        body:
          "Stream 3, 1, 5, 2, 6, 4 with k = 3. Keep the heap ≤ 3: after 3,1,5 the heap is {1,3,5}, root 1. 2 arrives → {1,2,3,5} then pop 1 → {2,3,5}, root 2. 6 arrives → pop 2 → {3,5,6}, root 3. 4 arrives → pop 3 → {4,5,6}, root 4. The 3rd largest is 4.",
      },
      {
        type: "callout",
        text:
          "The instinctive bug is reaching for a MAX-heap because the question says 'largest'. A max-heap puts the biggest value at the root — but the biggest is the one you never want to evict. You want the smallest of the winners on the chopping block, so a min-heap is correct. And remember heapq is min-only; for a max-heap you would negate.",
      },
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_TOPK,
      scene: {
        scene_id: "heap-topk-scene",
        title: "A size-k min-heap keeps the k largest",
        motif: "evict-the-weakest-survivor",
        description: "Values stream into a min-heap capped at size k; whenever it overflows the smallest is popped, so the k largest survive and the root is the k-th largest.",
        panels: [
          {
            id: "stream",
            title: "The incoming stream",
            kind: "vector" as const,
            description: "Numbers arriving one at a time into the size-k heap.",
            data: [
              { label: "heap size cap", value: "k", role: "context" as const },
              { label: "root", value: "the k-th largest so far", role: "output" as const },
            ],
          },
          {
            id: "rule",
            title: "The keep/evict rule",
            kind: "ledger" as const,
            description: "How each incoming value is handled.",
            data: [
              { label: "push incoming", value: "add to the heap", role: "input" as const },
              { label: "if size > k", value: "pop the smallest", role: "process" as const },
              { label: "cost", value: "O(n log k)", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Fill to k", headline: "Heap not full yet", narration: "The first k values just go in; nothing is evicted until the cap is reached.", receive: "the first k values", transform: "fill the heap", pass: "a size-k heap of candidates" },
        { start: 30, end: 66, label: "Overflow evicts the smallest", headline: "Pop the weakest survivor", narration: "When a new value pushes the heap past k, pop the root — the smallest candidate.", receive: "a new value", transform: "push then pop the min", pass: "the k largest so far" },
        { start: 66, end: 100, label: "Root is the k-th largest", headline: "Smallest of the winners", narration: "The min-heap's root is the smallest of the k largest — exactly the k-th largest.", receive: "the current heap", transform: "read the root", pass: "the k-th largest" },
        { start: 100, end: 132, label: "Why min not max", headline: "Evict the weakest, not the strongest", narration: "A max-heap would guard the biggest; you want the smallest winner on the chopping block.", receive: "a largest question", transform: "choose a min-heap", pass: "correct evictions" },
        { start: 132, end: 150, label: "Cost and memory", headline: "n log k, O(k) space", narration: "Each operation touches a size-k heap, so the pass is n log k using only k slots.", receive: "a long stream", transform: "bounded heap work", pass: "an O(n log k) solution" },
        { start: 150, end: 165, label: "The trap", headline: "Do not grab a max-heap", narration: "Reaching for a max-heap on instinct evicts winners and returns a wrong answer.", receive: "a tempting instinct", transform: "reject the wrong heap", pass: "a correct top-k" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to stream values one at a time into the size-3 min-heap. Watch the heap fill to k, then evict its smallest whenever a bigger value arrives, while the root tracks the k-th largest seen so far.",
    params: { artifact_slug: A_TOPK, min_height: 340 },
  },
  code: {
    prompt:
      "Return the k-th largest element of nums using a size-k MIN-heap. Push each value; whenever the heap exceeds k, pop the smallest. The root (heap[0]) is then the smallest of the k largest — the k-th largest. Fill in the TODO helper, then compose it.",
    starter_code:
      "import heapq\n\n\ndef push_capped(heap, value, k):\n    # TODO: push value onto heap; if the heap now holds more than k, pop the smallest.\n    # Return the heap.\n    pass\n\n\ndef kth_largest(nums, k):\n    heap = []\n    for v in nums:\n        push_capped(heap, v, k)\n    return heap[0]  # smallest of the k largest = the k-th largest\n",
    constraints: [
      "1 <= k <= len(nums).",
      "Use a MIN-heap capped at size k. O(n log k) time, O(k) space — do not sort the whole array.",
    ],
    walkthrough: {
      title: "k-th largest with a size-k min-heap",
      steps: [
        { title: "Push then cap", detail: "push_capped adds the value with heapq.heappush, then if the heap exceeds k it pops the smallest with heapq.heappop, keeping only the k largest.", input: "heap, value, k", output: "the capped heap" },
        { title: "Stream everything through", detail: "Feed every element through push_capped; the heap always holds the current top k.", input: "nums, k", output: "a size-k heap of the largest" },
        { title: "Read the root", detail: "heap[0] is the smallest of the k largest, which is the k-th largest element.", input: "the final heap", output: "the k-th largest" },
      ],
    },
    io_examples: [
      { label: "classic", input: "nums = [3,2,1,5,6,4], k = 2", expected_output: "5", explanation: "The two largest are 6 and 5; the 2nd largest is 5." },
      { label: "with duplicates", input: "nums = [3,2,3,1,2,4,5,5,6], k = 4", expected_output: "4", explanation: "The four largest are 6,5,5,4; the 4th largest is 4." },
      { label: "single", input: "nums = [1], k = 1", expected_output: "1", explanation: "One element is trivially the 1st largest." },
    ],
    visualization: {
      title: "Input → cap at k → root",
      description: "Each overflow evicts the smallest candidate.",
      items: [
        { label: "push incoming value", value: "heappush(heap, v)", role: "input" },
        { label: "if len(heap) > k: pop smallest", value: "heappop(heap)", role: "process" },
        { label: "root = k-th largest", value: "heap[0]", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Explicit helper",
        code:
          "import heapq\n\ndef push_capped(heap, value, k):\n    heapq.heappush(heap, value)\n    if len(heap) > k:\n        heapq.heappop(heap)\n    return heap\n\ndef kth_largest(nums, k):\n    heap = []\n    for v in nums:\n        push_capped(heap, v, k)\n    return heap[0]",
        explanation: "The heap never exceeds k; the smallest of the k survivors sits at the root and is the k-th largest.",
      },
      {
        label: "concise",
        title: "Idiomatic Python",
        code:
          "import heapq\n\ndef kth_largest(nums, k):\n    return heapq.nlargest(k, nums)[-1]",
        explanation: "heapq.nlargest(k, nums) returns the k largest in descending order; the last of them is the k-th largest.",
      },
    ],
    hints: [
      { level: 1, text: "Keep a MIN-heap and never let it grow past k — that keeps the k largest, with the smallest of them at the root." },
      { level: 2, text: "push_capped: heapq.heappush(heap, value), then if len(heap) > k, heapq.heappop(heap)." },
      { level: 3, text: "After streaming all values, heap[0] is the smallest of the k largest." },
      { level: 4, text: "That root value is exactly the k-th largest element." },
      { level: 5, text: "Idiomatic: heapq.nlargest(k, nums)[-1]." },
    ],
    tests: [
      { id: "t_classic", description: "2nd largest is 5", assert: "assert kth_largest([3,2,1,5,6,4], 2) == 5" },
      { id: "t_dups", description: "handles duplicates", assert: "assert kth_largest([3,2,3,1,2,4,5,5,6], 4) == 4" },
      { id: "t_single", description: "single element", assert: "assert kth_largest([1], 1) == 1" },
    ],
    hidden_tests: [
      { id: "h_allsame", description: "all identical", assert: "assert kth_largest([7,7,7], 2) == 7" },
      { id: "h_smallest", description: "k equals length picks the minimum", assert: "assert kth_largest([2,1], 2) == 1" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "hp2-so-1",
        type: "select_one",
        prompt: "To find the k LARGEST values in a stream with a size-k heap, which heap type do you use?",
        concept: "heap",
        difficulty: "easy",
        choices: ["A min-heap", "A max-heap", "A sorted list", "A stack"],
        correct_index: 0,
        explanation: "A min-heap keeps the smallest candidate at the root so it is evicted first, leaving the k largest.",
      },
      {
        id: "hp2-sa-multi",
        type: "select_all",
        prompt: "Which statements about the size-k min-heap for k-th largest are true?",
        concept: "heap",
        difficulty: "hard",
        choices: [
          "The root is the smallest of the k largest, i.e. the k-th largest",
          "It runs in O(n log k) time",
          "It uses only O(k) extra memory",
          "It requires sorting the whole array first",
        ],
        correct_indices: [0, 1, 2],
        explanation: "No full sort is needed; each operation touches a size-k heap, giving O(n log k) time and O(k) space.",
      },
      {
        id: "hp2-sa-none",
        type: "select_all",
        prompt: "For the size-k min-heap top-k solution, which of these are REQUIRED? (If none, select none.)",
        concept: "heap",
        difficulty: "medium",
        choices: ["Sorting the entire input first", "Storing all n elements in memory", "A second max-heap"],
        correct_indices: [],
        explanation: "None — the whole point is to avoid sorting and to keep only k elements, using a single min-heap.",
      },
      {
        id: "hp2-order",
        type: "ordering",
        prompt: "Order the steps of processing one incoming value in the size-k min-heap.",
        concept: "heap",
        difficulty: "medium",
        items: [
          "Push the incoming value onto the min-heap",
          "Check whether the heap now holds more than k elements",
          "If so, pop the smallest (the root)",
          "The root now holds the k-th largest so far",
        ],
        correct_order: [
          "Push the incoming value onto the min-heap",
          "Check whether the heap now holds more than k elements",
          "If so, pop the smallest (the root)",
          "The root now holds the k-th largest so far",
        ],
      },
      {
        id: "hp2-pattern",
        type: "pattern_recognition",
        prompt: "\"Return the k most frequent elements in an array.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Heap / Priority Queue", "Hashing", "Two Pointer", "Sliding Window", "Binary Search"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "\"k most frequent\" is a top-k heap job: count with a hash map (a reasonable secondary), then keep a size-k heap by frequency.",
      },
      {
        id: "hp2-written",
        type: "written",
        prompt: "Explain why a MIN-heap (not a max-heap) is correct for finding the k largest elements, and what the root represents.",
        concept: "heap",
        difficulty: "hard",
        actual_answer:
          "With a size-k heap you repeatedly need to throw away the weakest of your current top candidates whenever a new value arrives. A min-heap keeps the smallest candidate at the root, so that weakest survivor is exactly the element you can evict in one step. A max-heap would instead guard the largest value at the root — but the largest is the one you most want to keep, so a max-heap puts the wrong element on the chopping block and you would discard winners. After streaming everything, the min-heap's root is the smallest of the k largest values, which is precisely the k-th largest element.",
        rubric:
          "Full credit: min-heap keeps the weakest survivor at the root for cheap eviction (max-heap would evict winners), AND the root is the smallest of the k largest = the k-th largest. Partial: one of the two. Low: vague.",
      },
    ],
  },
};

// ── Final integrator practice_code: merge k sorted lists ──────────────────────
const finalCode = {
  prompt:
    "Integrator: merge k sorted lists into one sorted list using a heap. Seed the heap with the first element of each non-empty list, remembering which list and index it came from; then repeatedly pop the global smallest and push the next element from that same list. Fill the two TODO helpers, then compose them.",
  starter_code:
    "import heapq\n\n\ndef seed_heap(lists):\n    # TODO: push (value, list_index, elem_index) for the FIRST element of each\n    # non-empty list, and return the heap. The list_index/elem_index break ties\n    # and let you find the next element later.\n    heap = []\n    # ... fill this in ...\n    return heap\n\n\ndef push_next(heap, lists, i, j):\n    # TODO: if list i has an element after index j, push (lists[i][j+1], i, j+1).\n    pass\n\n\ndef merge_k_sorted(lists):\n    heap = seed_heap(lists)\n    out = []\n    while heap:\n        val, i, j = heapq.heappop(heap)\n        out.append(val)\n        push_next(heap, lists, i, j)\n    return out\n",
  constraints: [
    "Each input list is individually sorted ascending.",
    "The heap holds at most one element per list, so it never exceeds k entries.",
    "Total work is O(N log k) for N elements across k lists — do not concatenate and sort.",
  ],
  walkthrough: {
    title: "Merge k sorted lists with a k-sized frontier heap",
    steps: [
      { title: "Seed the frontier", detail: "seed_heap pushes the first element of every non-empty list as (value, list_index, 0). The heap now holds the front of each stream.", input: "lists", output: "a heap of list fronts" },
      { title: "Pop the global minimum", detail: "The smallest across all fronts must be the next output element, since each list is sorted. Pop it and record which list (i) and index (j) it came from.", input: "the frontier heap", output: "the next sorted element" },
      { title: "Advance that stream", detail: "push_next pushes the next element from list i (index j+1) if it exists, keeping the frontier complete. Repeat until the heap empties.", input: "lists, i, j", output: "the fully merged sorted list" },
    ],
  },
  io_examples: [
    { label: "three lists", input: "lists = [[1,4,5],[1,3,4],[2,6]]", expected_output: "[1,1,2,3,4,4,5,6]", explanation: "The k-way merge interleaves the fronts in sorted order." },
    { label: "empty input", input: "lists = []", expected_output: "[]", explanation: "No lists, nothing to merge." },
    { label: "some empty", input: "lists = [[],[1],[]]", expected_output: "[1]", explanation: "Empty lists are skipped by the seeding step." },
  ],
  visualization: {
    title: "Input → pop min / push next → output",
    description: "The heap is a moving frontier across all lists.",
    items: [
      { label: "seed with each list's front", value: "(value, list_i, 0)", role: "input" },
      { label: "pop global min, push that list's next", value: "heappop → heappush", role: "process" },
      { label: "merged sorted list", value: "out", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "Explicit helpers",
      code:
        "import heapq\n\ndef seed_heap(lists):\n    heap = []\n    for i, lst in enumerate(lists):\n        if lst:\n            heapq.heappush(heap, (lst[0], i, 0))\n    return heap\n\ndef push_next(heap, lists, i, j):\n    if j + 1 < len(lists[i]):\n        heapq.heappush(heap, (lists[i][j+1], i, j+1))\n\ndef merge_k_sorted(lists):\n    heap = seed_heap(lists)\n    out = []\n    while heap:\n        val, i, j = heapq.heappop(heap)\n        out.append(val)\n        push_next(heap, lists, i, j)\n    return out",
      explanation: "The tuple carries (value, list index, element index) so ties break cleanly and the next element is easy to find.",
    },
    {
      label: "concise",
      title: "Idiomatic Python",
      code:
        "import heapq\n\ndef merge_k_sorted(lists):\n    return list(heapq.merge(*lists))",
      explanation: "heapq.merge merges any number of sorted iterables using exactly this frontier-heap idea.",
    },
  ],
  hints: [
    { level: 1, text: "The next output is always the smallest current front across the lists — that is what the heap gives you." },
    { level: 2, text: "Store tuples (value, list_index, elem_index) so equal values break ties by index and you can find the next element." },
    { level: 3, text: "seed_heap: for each non-empty list i, push (lists[i][0], i, 0)." },
    { level: 4, text: "After popping (val, i, j), push (lists[i][j+1], i, j+1) if j+1 is in range." },
    { level: 5, text: "Idiomatic: list(heapq.merge(*lists)) does the whole thing." },
  ],
  tests: [
    { id: "f_three", description: "merges three lists", assert: "assert merge_k_sorted([[1,4,5],[1,3,4],[2,6]]) == [1,1,2,3,4,4,5,6]" },
    { id: "f_empty", description: "empty input", assert: "assert merge_k_sorted([]) == []" },
    { id: "f_some_empty", description: "skips empty lists", assert: "assert merge_k_sorted([[],[1],[]]) == [1]" },
  ],
  hidden_tests: [
    { id: "hf_one", description: "single list passes through", assert: "assert merge_k_sorted([[1,2,3]]) == [1,2,3]" },
    { id: "hf_singletons", description: "singleton lists sort", assert: "assert merge_k_sorted([[5],[1],[3]]) == [1,3,5]" },
  ],
};

// ── Assessment (adaptive MC + freeform) ───────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Describe the heap invariant and the two operations (insert and remove-min), and explain why each operation is O(log n).",
      type: "free_text",
      concept: "heap",
      difficulty: "medium",
      actual_answer:
        "The heap invariant is local: in a min-heap every parent is less than or equal to its children, which forces the minimum to the root while leaving the rest only partially ordered. Insert drops the new value at the end of the array and sifts it up, swapping with its parent while it is smaller. Remove-min takes the root as the answer, moves the last element into the root, and sifts it down, swapping with the smaller child while it is out of order. Both operations repair a single root-to-leaf path, whose length is the tree height, about log n, so each is O(log n).",
      rubric:
        "Full credit: local parent-≤-children invariant (min at root); insert = append + sift up; remove = root out, last to root, sift down; both walk one path of height log n. Partial: invariant + one operation, or misses the log n reason. Low: vague.",
      support_ref: "heap-part-1-mechanics",
    },
    {
      id: "a-free-2",
      text: "A candidate needs the k largest numbers from a huge stream and says 'I'll sort the whole array and take the last k.' What is a better heap-based approach, and why is it better in time AND memory?",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "hard",
      actual_answer:
        "Keep a min-heap capped at size k: push each value and pop the smallest whenever the heap exceeds k, so it always holds the k largest seen so far. This runs in O(n log k) time because every operation touches a heap of size k rather than n, which beats the O(n log n) of a full sort when k is much smaller than n. It also uses only O(k) memory instead of holding all n elements, which matters for a stream you cannot fit in memory at once. The k-th largest, if needed, is simply the root of that heap.",
      rubric:
        "Full credit: size-k min-heap, O(n log k) time (beats n log n) and O(k) space (beats O(n)), root is k-th largest. Partial: names the heap approach without both the time and memory wins. Low: vague.",
      support_ref: "heap-part-2-topk",
    },
    {
      id: "a-free-3",
      text: "Python's heapq only implements a min-heap. Explain how you would use it to always retrieve the MAXIMUM, and name one situation where a heap is the wrong tool.",
      type: "free_text",
      concept: "heap",
      difficulty: "medium",
      actual_answer:
        "Since heapq is min-only, you store the negation of each value: push -x instead of x, and negate again when you pop, so the heap's smallest negated value corresponds to the largest real value. That turns a min-heap into a max-heap. A heap is the wrong tool when you only need the extreme once — a single O(n) scan is simpler than building a heap — or when you need full sorted order, arbitrary membership search, or deletion of a specific middle element, none of which a plain binary heap supports efficiently.",
      rubric:
        "Full credit: negate on push and pop to get a max-heap; wrong tool for a one-shot extreme (scan instead) OR full order / arbitrary search / middle delete. Partial: negation trick only, or wrong-tool only. Low: vague.",
      support_ref: "overview: heapq is min-only / when it fails",
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
        question: "What is the time complexity of inserting into or removing the min from a binary heap of n elements?",
        choices: ["O(log n)", "O(1)", "O(n)", "O(n log n)"],
        correct_index: 0,
        explanation: "Each operation repairs a single root-to-leaf path of height about log n.",
        concept: "complexity",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "heap-part-1-mechanics",
      },
      {
        id: "q2",
        question: "In a min-heap stored as an array, where are the children of the node at index i?",
        choices: ["2i+1 and 2i+2", "i+1 and i+2", "2i and 2i+1", "i/2 and i/2+1"],
        correct_index: 0,
        explanation: "Children live at 2i+1 and 2i+2; the parent is at (i-1)//2.",
        concept: "heap",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "heap-part-1-mechanics",
      },
      {
        id: "q3",
        question: "To keep the k LARGEST elements of a stream with a size-k heap, you use a:",
        choices: [
          "Min-heap, so the smallest survivor sits at the root and is evicted first",
          "Max-heap, so the largest sits at the root",
          "Sorted array rebuilt each step",
          "Stack of the last k values",
        ],
        correct_index: 0,
        explanation: "A min-heap puts the weakest survivor on the chopping block, leaving the k largest.",
        concept: "heap",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "heap-part-2-topk",
      },
      {
        id: "q4",
        question: "Which problem is NOT a natural heap fit?",
        choices: [
          "Return the elements in fully sorted order with no extra work",
          "Merge k sorted lists",
          "Find the k-th largest element",
          "Repeatedly serve the highest-priority task",
        ],
        correct_index: 0,
        explanation: "A heap only makes the extreme cheap; it does not hand you a full sort for free.",
        concept: "pattern-recognition",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "overview: when it fails",
      },
      {
        id: "q5",
        question: "What is the time complexity of the size-k min-heap solution for k-th largest over n elements?",
        choices: ["O(n log k)", "O(n log n)", "O(n)", "O(k log n)"],
        correct_index: 0,
        explanation: "Every operation touches a heap of size k, so the pass is n log k.",
        concept: "complexity",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "heap-part-2-topk",
      },
      {
        id: "q6",
        question: "Python's heapq is a min-heap only. How do you use it as a max-heap?",
        choices: [
          "Push the negated value and negate again when you pop",
          "Pass a reverse=True flag to heappush",
          "Call heapq.maxheapify",
          "Sort the list descending first",
        ],
        correct_index: 0,
        explanation: "Negating turns smallest-negated into largest-real; there is no max flag.",
        concept: "heap",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "overview: heapq is min-only",
      },
      {
        id: "q7",
        question: "Which phrases hint at a heap / priority-queue solution? (Select all that apply.)",
        choices: [
          "\"k-th largest\"",
          "\"merge k sorted lists\"",
          "\"return any subarray\"",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "'k-th largest' and 'merge k sorted lists' are classic heap fingerprints; the third is unrelated.",
        concept: "pattern-recognition",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "overview: recognition",
      },
      {
        id: "q8",
        question: "Building a heap from n elements given all at once can be done in:",
        choices: ["O(n) with bottom-up heapify", "O(n log n) only", "O(log n)", "O(n²)"],
        correct_index: 0,
        explanation: "Bottom-up heapify (sift-down from the lowest internal nodes) is linear.",
        concept: "complexity",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "overview: heapify",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-heap-recognize", prompt: "Given a fresh problem, how quickly could you now tell it wants a heap, and which of the four jobs (top-k, merge, schedule, running-extreme) it is?", hint: "Name the recurring-extreme signal you would look for." },
  { id: "diag-heap-trie", prompt: "The next lesson is Trie. Where have you seen prefix / character-by-character structure before, and what feels different about storing many strings by shared prefixes rather than by priority?", hint: "Think prefixes and autocomplete, not extremes." },
  { id: "diag-heap-shaky", prompt: "What part of heaps still feels shaky — the sift-up/down mechanics, the size-k min-heap inversion, or the negate-for-max trick?", hint: "Be specific so the next review targets it." },
  { id: "diag-heap-speed", prompt: "Could you write the size-k min-heap for k-th largest and the merge-k-sorted skeleton from memory in under 5 minutes each right now? What would slow you down?", hint: "Execution speed is the interview bottleneck." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "Heap / Priority Queue in the interview-pattern map",
  description:
    "This lesson covers the heap invariant and sift-up/sift-down mechanics, the four heap jobs, the size-k min-heap top-k trick, and the k-way merge integrator. Trie is the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "heap-invariant", label: "Heap invariant + sift", category: "lesson_concept", covered: true },
    { id: "size-k-heap", label: "Size-k min-heap (top-k)", category: "lesson_concept", covered: true },
    { id: "kway-merge", label: "k-way merge", category: "lesson_concept", covered: true },
    { id: "heapq-min-only", label: "heapq min-only / negate", category: "lesson_concept", covered: true },
    { id: "two-pointer", label: "Two Pointer (prior)", category: "concept", covered: true },
    { id: "two-heaps-median", label: "Two-heaps running median", category: "concept", preview: true },
    { id: "trie", label: "Trie (next)", category: "concept" },
  ],
  edges: [],
  curriculum_stages: [
    { id: "assessment", label: "Initial assessment", status: "done" },
    { id: "sliding-window", label: "Sliding Window", status: "done" },
    { id: "two-pointer", label: "Two Pointer", status: "done" },
    { id: "heap", label: "Heap / Priority Queue", status: "current" },
    { id: "trie", label: "Trie", status: "next" },
    { id: "backtracking", label: "Backtracking", status: "later" },
    { id: "monotonic-stack", label: "Monotonic Stack", status: "later" },
  ],
  current: "heap",
};

const planningRationale =
  "Heap / Priority Queue is taught in full because the imported repo evidence flags it as near-untouched (~8 rows), the weakest remaining tracked pattern after sliding window and two pointer. The lesson grounds the mechanism first (the local heap invariant, array-with-index-math representation, sift-up/sift-down, O(log n) operations and O(n) bulk heapify) so the abstraction is not magic, then drills the single most useful interview trick — the size-k min-heap for top-k / k-th largest, including the min-versus-max inversion that trips people. The scaffolded exercises (k-smallest, k-th largest) plus a k-way-merge integrator build execution speed, and pattern_recognition questions plus 'when it fails' cases (one-shot extreme, full sort, arbitrary search, heapq min-only) build the recognition judgment that separates strong interviewees from grinders.";

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
  bad = fail("Part 1 (heap mechanics)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (size-k top-k)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1280)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Heap / Priority Queue: The Extreme, Again and Again, in log n";
  const description =
    "The tool for 'give me the best remaining, repeatedly, while the set changes.' The heap invariant and pointerless array representation, sift-up/sift-down in O(log n), the four heap jobs, and the sharpest trick — a size-k MIN-heap that answers k-th-largest in O(n log k) — plus heapq's min-only reality and when a heap is the wrong tool.";
  const goals = JSON.stringify([
    "Recognize heap / priority-queue problems (top-k, merge, schedule, running-extreme) from trigger phrases in under 2 minutes",
    "Implement k-th largest with a size-k min-heap and a k-way merge, from a scaffold, using heapq correctly (min-only, negate for max)",
    "Explain the heap invariant, why push/pop are O(log n), and when a single scan or a sorted structure beats a heap",
  ]);
  const tags = JSON.stringify(["heap", "priority-queue", "top-k", "weak-pattern", "interview-prep"]);
  const overviewAudioContent = {
    script: OVERVIEW_SCRIPT,
    transcript: OVERVIEW_SCRIPT,
    duration_hint: 1280,
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
    insertAct.run(lessonId, "audio", 1, "Audio: Heap — the family map", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Heap mechanics", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: The size-k min-heap trick", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: merge k sorted lists", JSON.stringify(finalCode));
    insertAct.run(lessonId, "assessment", 5, "Assessment: Heap recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 5 activities.`);
  closeDb();
}

main();
