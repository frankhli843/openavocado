#!/usr/bin/env tsx
/**
 * P4.1 — Binary Search on Answer lesson (subject 9, seq 10):
 * "Binary Search on the Answer: When the Answer Is a Search Space".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill. This is a GENUINE
 * UNCOVERED GAP: Frank has deep DP subcategory history (Binary Search on Answer
 * was listed in his DP families) but it has not been explicitly taught as a
 * stand-alone technique. The key insight: reframe "minimize/maximize X" as
 * "is candidate X feasible?", confirm monotonicity, then binary-search the
 * candidate range with a greedy feasibility oracle.
 *
 * Structure mirrors prior lessons: top-level 2-host overview audio +
 * orientation visual, two collapsed lesson_parts (Koko/Split Array via lower
 * search; Magnetic Force via upper search) each with a bespoke approved
 * artifact + per-part audio synced visual + scaffolded code + mixed practice
 * (incl. pattern_recognition), a final integrator practice_code (Magnetic
 * Force, LC 1552), an adaptive MC + freeform assessment, and a timed
 * code_drill (Capacity to Ship, LC 1011). Cue timings are provisional and
 * rescaled to the real generated audio duration by rescale-binsearch-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-binsearch-overview-map, algo-binsearch-koko, algo-binsearch-magnetic
 *
 * Idempotent: replaces any prior seq=10 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-binsearchanswer.ts
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
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/binsearch-answer-audio";

const SUBJECT_ID = 9;
const SEQ = 10;

const A_OVERVIEW = "algo-binsearch-overview-map";
const A_KOKO = "algo-binsearch-koko";
const A_MAGNETIC = "algo-binsearch-magnetic";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "binsearch-answer-orientation",
    title: "Binary search on the answer: the candidate range IS the search space",
    motif: "range-feasibility-converge",
    description:
      "Orientation for the whole technique. Instead of searching a sorted array for a target, you search a range of candidate answers for the boundary between infeasible and feasible. Three pieces: define the range (lo = tightest lower bound, hi = loosest upper bound), write a monotonic feasibility function (can this candidate be achieved?), and binary-search the range. Lower search finds the leftmost feasible (minimize), upper search finds the rightmost feasible (maximize). Four problem classes demonstrate the template: Koko Eating Bananas (minimize speed), Split Array Largest Sum (minimize max partition sum), Ship Packages (minimize capacity), and Magnetic Force (maximize min gap). The code is the same three-piece decomposition every time; the recognition is the hard part.",
    panels: [
      {
        id: "template",
        title: "The three-piece template",
        kind: "flow" as const,
        description: "Every binary-search-on-the-answer problem decomposes into the same three steps.",
        data: [
          { label: "define the candidate range", value: "lo = tightest lower bound, hi = loosest upper bound", role: "input" as const },
          { label: "write the feasibility function", value: "can(candidate) returns boolean, monotonic", role: "process" as const },
          { label: "binary-search the range", value: "lower search (minimize) or upper search (maximize)", role: "output" as const },
        ],
      },
      {
        id: "direction",
        title: "Lower vs upper search",
        kind: "cards" as const,
        description: "The direction determines how mid is computed and which side tightens.",
        data: [
          { label: "lower search (minimize)", value: "mid = (lo+hi)/2, feasible: hi=mid", role: "context" as const },
          { label: "upper search (maximize)", value: "mid = (lo+hi+1)/2, feasible: lo=mid", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 170, label: "The family", headline: "The answer IS the search space", narration: "A whole family of problems where you search a range of candidate answers for the boundary between infeasible and feasible.", receive: "an optimization problem", transform: "reframe as feasibility", pass: "a binary-searchable range" },
    { start: 170, end: 370, label: "Koko", headline: "Minimize speed, greedy hours", narration: "Koko Eating Bananas: search on speed, sum ceiling divisions, check against h hours.", receive: "piles and hours", transform: "ceiling(pile/speed)", pass: "minimum speed" },
    { start: 370, end: 560, label: "Monotonicity", headline: "Faster is always enough", narration: "If speed k works, speed k+1 works too, because eating faster never takes more hours. The feasibility function is monotonic.", receive: "a feasible speed", transform: "try smaller", pass: "leftmost feasible" },
    { start: 560, end: 750, label: "Template", headline: "Range, feasibility, search", narration: "Three pieces: define the range, write the feasibility oracle, binary-search. Same code structure every time.", receive: "any BS-on-answer problem", transform: "decompose into three pieces", pass: "the optimal candidate" },
    { start: 750, end: 950, label: "Upper search", headline: "Maximize the minimum gap", narration: "Magnetic Force flips the direction: small gaps are feasible, large gaps are not. Upper search with round-up mid avoids the infinite loop.", receive: "positions and ball count", transform: "greedy placement", pass: "largest feasible gap" },
    { start: 950, end: 1150, label: "Split Array", headline: "Minimize max subarray sum", narration: "Same template: candidate is the max allowed sum, feasibility is a greedy scan counting subarrays, lower search for the leftmost feasible.", receive: "array and k splits", transform: "greedy partition", pass: "minimum max sum" },
    { start: 1150, end: 1350, label: "Off-by-one", headline: "Round up prevents infinite loop", narration: "In upper search, rounding down mid when lo and hi differ by one causes an infinite loop. Round up: mid = (lo + hi + 1) / 2.", receive: "lo = hi - 1", transform: "round up mid", pass: "loop terminates" },
    { start: 1350, end: 1500, label: "Recognition", headline: "Monotonic feasibility implies BS-on-answer", narration: "The recognition rule: if you can write a monotonic can(candidate) in polynomial time, you have a binary search on the answer.", receive: "an optimization question", transform: "check monotonicity", pass: "the three-piece template" },
  ],
};

// ── Part 1: Koko + Split Array (lower binary search) ─────────────────────────
const kokoComplexity = {
  type: "formula",
  latex: "O(n \\cdot \\log(\\max(\\text{piles})))",
  plain_english:
    "The binary search runs O(log(max pile)) iterations, and each iteration calls the feasibility function that scans all n piles once with a constant-time ceiling division per pile. The total is O(n log max) where n is the number of piles and max is the largest pile. For Split Array Largest Sum the total is O(n log(sum - max)) where n is the array length, sum is the total, and max is the largest element.",
  variables: [
    { symbol: "n", meaning: "number of piles (or array elements)" },
    { symbol: "\\max(\\text{piles})", meaning: "the largest pile, upper bound of the search range" },
    { symbol: "O(\\log(\\max))", meaning: "number of binary search iterations" },
  ],
};

const part1 = {
  part_id: "binsearch-part-1-lower-search",
  reading: {
    blocks: [
      { type: "heading", text: "Lower binary search: Koko Eating Bananas and Split Array Largest Sum" },
      {
        type: "paragraph",
        text:
          "The lower binary search template finds the SMALLEST feasible candidate. The loop condition is lo < hi, mid is computed as (lo + hi) / 2 rounding down, and the update rule is: if the candidate at mid is feasible, set hi = mid (the answer might be at mid or smaller); if infeasible, set lo = mid + 1 (mid was too small). When the loop ends, lo equals hi and that is the answer. The key property that makes this correct is monotonicity: once a candidate is feasible, every larger candidate is also feasible, so there is a clean boundary between the infeasible left side and the feasible right side, and the binary search finds that boundary.",
      },
      {
        type: "definition",
        term: "Feasibility function (Koko)",
        definition:
          "Given a candidate speed k, compute the total hours needed: for each pile p, add ceiling(p / k). If the total is at most h, the speed is feasible. Ceiling division without floating point: (p + k - 1) // k. This runs in O(n) per call and is monotonic: increasing k can only decrease the ceiling for each pile, so total hours only goes down.",
      },
      {
        type: "example",
        body:
          "Piles = [3, 6, 7, 11], h = 8. Range: lo=1, hi=11. Iteration 1: mid=6, hours = ceil(3/6)+ceil(6/6)+ceil(7/6)+ceil(11/6) = 1+1+2+2 = 6 <= 8, feasible, hi=6. Iteration 2: mid=3, hours = 1+2+3+4 = 10 > 8, infeasible, lo=4. Iteration 3: mid=5, hours = 1+2+2+3 = 8 <= 8, feasible, hi=5. Iteration 4: mid=4, hours = 1+2+2+3 = 8 <= 8, feasible, hi=4. lo=hi=4, answer is 4.",
      },
      {
        type: "callout",
        text:
          "Split Array Largest Sum (LC 410) uses the same template with a different feasibility function: given a candidate max sum, greedily extend each subarray until the next element would exceed the target, then start a new subarray. If the count of subarrays is at most k, the target is feasible. Range: lo = max(nums), hi = sum(nums). The greedy scan is the optimal way to spend the budget of k subarrays, because extending each subarray as far as possible minimizes the number of splits.",
      },
      kokoComplexity,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_KOKO,
      scene: {
        scene_id: "binsearch-koko-scene",
        title: "Binary search converging on the minimum eating speed for Koko",
        motif: "range-narrowing",
        description: "Step through the binary search on eating speed for piles [3,6,7,11] and h=8 hours. Each step computes the hours needed at the mid speed, checks feasibility, and narrows the range. The search converges to speed 4, the minimum speed where Koko finishes in time.",
        panels: [
          {
            id: "search",
            title: "Search state",
            kind: "ledger" as const,
            description: "How the candidate range narrows each iteration.",
            data: [
              { label: "compute mid from lo and hi", value: "the candidate speed", role: "input" as const },
              { label: "check feasibility: sum ceilings vs h", value: "feasible or too slow", role: "process" as const },
              { label: "narrow the range toward the boundary", value: "hi=mid or lo=mid+1", role: "output" as const },
            ],
          },
          {
            id: "feasibility",
            title: "Ceiling division per pile",
            kind: "flow" as const,
            description: "How each pile contributes to the total hours at a given speed.",
            data: [
              { label: "for each pile p", value: "iterate the array", role: "input" as const },
              { label: "ceiling(p / speed)", value: "(p + speed - 1) // speed", role: "process" as const },
              { label: "sum all ceilings", value: "total hours, compare to h", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Lower template", headline: "lo < hi, mid = (lo+hi)/2", narration: "The lower binary search template finds the smallest feasible candidate by narrowing the range from both sides.", receive: "the full range", transform: "pick the midpoint", pass: "check feasibility" },
        { start: 30, end: 62, label: "Ceiling division", headline: "ceil(pile / speed) counts hours", narration: "Each pile takes ceiling of pile over speed hours. Use integer arithmetic: (pile + speed - 1) // speed.", receive: "pile and speed", transform: "ceiling divide", pass: "hours for this pile" },
        { start: 62, end: 95, label: "Split Array", headline: "Same template, greedy partition", narration: "Split Array Largest Sum uses the same lower search: candidate is the max allowed sum, feasibility is a greedy left-to-right scan counting subarrays.", receive: "array and k", transform: "greedy partition", pass: "subarrays needed" },
        { start: 95, end: 128, label: "Range bounds", headline: "lo = max element, hi = total sum", narration: "For partition problems, lo is the largest element (no subarray can be smaller), hi is the total sum (one subarray holds everything).", receive: "the array", transform: "extract max and sum", pass: "the candidate range" },
        { start: 128, end: 150, label: "Zero init trap", headline: "lo = 0 breaks the feasibility check", narration: "Setting lo to zero tests a meaningless candidate: zero speed means infinite time, and zero max sum means no element fits. Always use the tightest meaningful lower bound.", receive: "a bad lo", transform: "fix to max element", pass: "valid range" },
        { start: 150, end: 165, label: "Greedy is optimal", headline: "Extend each subarray as far as possible", narration: "The greedy scan uses the fewest subarrays for a given target, so if greedy needs more than k, nothing else can do it in k either.", receive: "a target sum", transform: "greedy scan", pass: "optimal split count" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Step through the binary search on Koko's eating speed. Watch the candidate range [lo, hi] narrow as each midpoint is tested: if the total hours at that speed is at most h, the speed is feasible and hi shrinks; otherwise lo grows. The search converges to the minimum speed.",
    params: { artifact_slug: A_KOKO, min_height: 340 },
  },
  code: {
    prompt:
      "Implement minEatingSpeed(piles, h) using binary search on the answer. Search for the minimum speed k such that Koko can eat all piles within h hours. For each candidate speed, compute total hours as the sum of ceiling(pile / speed) for each pile. Use the lower binary search template.",
    starter_code:
      "import math\n\ndef minEatingSpeed(piles, h):\n    lo, hi = 1, max(piles)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        # TODO: compute total hours at speed mid\n        # hours = sum(math.ceil(p / mid) for p in piles)\n        # if hours <= h: hi = mid\n        # else: lo = mid + 1\n        pass\n    return lo\n",
    constraints: [
      "Use the lower binary search template: lo < hi, mid = (lo + hi) // 2, feasible -> hi = mid, infeasible -> lo = mid + 1.",
      "Use math.ceil for the ceiling division, or the integer form (p + mid - 1) // mid.",
      "The range is 1 to max(piles). Do not start at 0 (meaningless speed).",
    ],
    walkthrough: {
      title: "Binary search on eating speed",
      steps: [
        { title: "Set the range", detail: "lo = 1 (minimum meaningful speed), hi = max(piles) (eating faster than the biggest pile is pointless).", input: "piles", output: "lo, hi" },
        { title: "Check feasibility at mid", detail: "Sum ceiling(p / mid) for each pile. If total <= h, the speed works and we can try smaller (hi = mid). Otherwise it is too slow (lo = mid + 1).", input: "mid speed", output: "feasible or not" },
        { title: "Return lo", detail: "When lo == hi, the search has converged to the minimum feasible speed.", input: "converged range", output: "the answer" },
      ],
    },
    io_examples: [
      { label: "basic", input: "piles = [3,6,7,11], h = 8", expected_output: "4", explanation: "At speed 4: ceil(3/4)+ceil(6/4)+ceil(7/4)+ceil(11/4) = 1+2+2+3 = 8 <= 8." },
      { label: "tight", input: "piles = [30,11,23,4,20], h = 5", expected_output: "30", explanation: "With 5 piles and 5 hours, each pile must be eaten in one hour, so speed must be at least 30." },
    ],
    visualization: {
      title: "range narrows to the minimum feasible speed",
      description: "Each iteration halves the candidate range by testing the midpoint speed.",
      items: [
        { label: "lo = 1, hi = max(piles)", value: "initial range", role: "input" },
        { label: "sum ceil(p/mid) for each pile", value: "total hours", role: "process" },
        { label: "lo == hi = minimum speed", value: "the answer", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Koko Eating Bananas — lower binary search",
        code:
          "import math\ndef minEatingSpeed(piles, h):\n    lo, hi = 1, max(piles)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        hours = sum(math.ceil(p / mid) for p in piles)\n        if hours <= h:\n            hi = mid\n        else:\n            lo = mid + 1\n    return lo",
        explanation: "O(n log max) time. The feasibility check is one pass summing ceiling divisions.",
      },
      {
        label: "concise",
        title: "Split Array Largest Sum — same template, different oracle",
        code:
          "def splitArray(nums, k):\n    def canSplit(maxSum):\n        count, cur = 1, 0\n        for n in nums:\n            if cur + n > maxSum:\n                count += 1\n                cur = n\n            else:\n                cur += n\n        return count <= k\n    lo, hi = max(nums), sum(nums)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if canSplit(mid): hi = mid\n        else: lo = mid + 1\n    return lo",
        explanation: "Same lower search, different feasibility: greedy left-to-right partition counting subarrays.",
      },
    ],
    hints: [
      { level: 1, text: "Set lo = 1 and hi = max(piles). Loop while lo < hi." },
      { level: 2, text: "Compute mid = (lo + hi) // 2. Calculate total hours: sum(math.ceil(p / mid) for p in piles)." },
      { level: 3, text: "If total hours <= h, set hi = mid. Otherwise set lo = mid + 1." },
      { level: 4, text: "When the loop ends, return lo — that is the minimum feasible speed." },
    ],
    tests: [
      { id: "t_koko1", description: "piles [3,6,7,11] h=8", assert: "assert minEatingSpeed([3,6,7,11], 8) == 4" },
      { id: "t_koko2", description: "piles [30,11,23,4,20] h=5", assert: "assert minEatingSpeed([30,11,23,4,20], 5) == 30" },
      { id: "t_koko3", description: "piles [30,11,23,4,20] h=6", assert: "assert minEatingSpeed([30,11,23,4,20], 6) == 23" },
      { id: "t_single", description: "single pile", assert: "assert minEatingSpeed([1], 1) == 1" },
    ],
    hidden_tests: [
      { id: "h_big", description: "large pile", assert: "assert minEatingSpeed([1000000000], 2) == 500000000" },
      { id: "h_tight", description: "just enough hours", assert: "assert minEatingSpeed([2,2], 2) == 2" },
      { id: "h_easy", description: "plenty of time", assert: "assert minEatingSpeed([2,2], 10) == 1" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "bs1-so-1",
        type: "select_one",
        prompt: "What makes binary search on the answer work for Koko Eating Bananas?",
        concept: "binary-search-on-answer",
        difficulty: "easy",
        choices: [
          "The feasibility function is monotonic: if speed k works, every speed above k also works",
          "The piles are sorted in ascending order",
          "The number of piles is always a power of two",
          "Koko can eat from two piles in the same hour",
        ],
        correct_index: 0,
        explanation: "Monotonicity of the feasibility function (more speed never needs more hours) is what creates the clean boundary that binary search finds.",
      },
      {
        id: "bs1-sa-range",
        type: "select_all",
        prompt: "Which are valid choices for lo and hi in Koko Eating Bananas?",
        concept: "binary-search-on-answer",
        difficulty: "medium",
        choices: [
          "lo = 1, hi = max(piles)",
          "lo = 0, hi = sum(piles)",
          "lo = min(piles), hi = max(piles)",
        ],
        correct_indices: [0, 2],
        explanation: "lo = 0 is invalid because speed 0 is meaningless. lo = 1 and lo = min(piles) are both valid lower bounds (min >= 1). hi = max(piles) is tight because eating faster than the biggest pile wastes nothing.",
      },
      {
        id: "bs1-pr-1",
        type: "pattern_recognition",
        prompt: "You need to split an array of positive integers into k contiguous subarrays so that the maximum subarray sum is minimized. Which algorithmic pattern(s) apply?",
        concept: "binary-search-on-answer",
        difficulty: "medium",
        choices: [
          "binary search on the answer",
          "greedy",
          "dynamic programming",
          "sliding window",
          "two pointer",
          "divide and conquer",
          "backtracking",
        ],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "The primary pattern is binary search on the answer: the candidate is the max allowed subarray sum, with a greedy feasibility check. Greedy is secondary because it implements the feasibility oracle. DP can also solve it but is slower.",
      },
      {
        id: "bs1-sa-none",
        type: "select_all",
        prompt: "Which of the following are necessary conditions for binary search on the answer to work? (If none, select none.)",
        concept: "binary-search-on-answer",
        difficulty: "hard",
        choices: [
          "The input array must be sorted",
          "The feasibility function must run in O(1) time",
          "The candidates must be floating-point numbers",
        ],
        correct_indices: [] as number[],
        explanation: "None of these are necessary: the input need not be sorted (Koko piles can be in any order), the feasibility function can be O(n) or more, and candidates can be integers. The only requirement is a monotonic feasibility function over the candidate range.",
      },
      {
        id: "bs1-order-1",
        type: "ordering",
        prompt: "Order the steps of applying binary search on the answer to Koko Eating Bananas.",
        concept: "binary-search-on-answer",
        difficulty: "medium",
        items: [
          "Set lo = 1, hi = max(piles)",
          "Compute mid = (lo + hi) // 2",
          "Calculate total hours: sum of ceiling(pile / mid) for each pile",
          "If hours <= h, set hi = mid; else set lo = mid + 1",
          "When lo == hi, return lo as the minimum speed",
        ],
        correct_order: [
          "Set lo = 1, hi = max(piles)",
          "Compute mid = (lo + hi) // 2",
          "Calculate total hours: sum of ceiling(pile / mid) for each pile",
          "If hours <= h, set hi = mid; else set lo = mid + 1",
          "When lo == hi, return lo as the minimum speed",
        ],
        explanation: "The algorithm first defines the range, then iteratively picks the midpoint, checks feasibility via ceiling division, narrows the range, and returns when converged.",
      },
      {
        id: "bs1-written-1",
        type: "written",
        prompt: "Explain why the greedy left-to-right scan gives the correct feasibility answer for Split Array Largest Sum. Why can no other split strategy use fewer subarrays for the same target sum?",
        concept: "binary-search-on-answer",
        difficulty: "hard",
        actual_answer:
          "The greedy scan extends each subarray as far as possible before starting a new one, which minimizes the number of subarrays. Any other strategy would start a new subarray earlier than greedy, which means it uses at least as many subarrays. Therefore, if greedy needs more than k subarrays, no other strategy can do it in k. This makes greedy the optimal way to spend the budget of k subarrays, and therefore a valid feasibility oracle for the binary search.",
        rubric: "Should explain that greedy extends each subarray as far as possible, using the fewest splits. Any other strategy starts a new subarray earlier, using at least as many. So if greedy needs more than k, nothing else can do it in k either. Should mention that this makes greedy a valid feasibility oracle.",
      },
    ],
  },
};

// ── Part 2: Magnetic Force (upper binary search) ──────────────────────────────
const magneticComplexity = {
  type: "formula",
  latex: "O(n \\log n + n \\cdot \\log(\\text{span}))",
  plain_english:
    "The positions must be sorted first (O(n log n)), then the binary search runs O(log span) iterations where span is position[n-1] - position[0]. Each iteration calls the greedy placement check in O(n). The total is O(n log n + n log span). Sorting dominates for small spans; the binary search dominates for large spans.",
  variables: [
    { symbol: "n", meaning: "number of positions" },
    { symbol: "\\text{span}", meaning: "position[n-1] - position[0], the range of the number line" },
    { symbol: "O(n)", meaning: "cost of one feasibility check (greedy walk)" },
  ],
};

const part2 = {
  part_id: "binsearch-part-2-upper-search",
  reading: {
    blocks: [
      { type: "heading", text: "Upper binary search: Magnetic Force Between Two Balls" },
      {
        type: "paragraph",
        text:
          "The upper binary search template finds the LARGEST feasible candidate. It is used when the problem asks to maximize something. The loop condition is still lo < hi, but mid is computed as (lo + hi + 1) / 2 rounding UP to prevent the infinite loop when lo and hi differ by one. The update rule is: if the candidate at mid is feasible, set lo = mid (the answer might be at mid or larger); if infeasible, set hi = mid - 1 (mid was too large). When the loop ends, lo equals hi and that is the answer.",
      },
      {
        type: "definition",
        term: "Feasibility function (Magnetic Force)",
        definition:
          "Given a candidate minimum gap d, sort the positions, place the first ball at position[0], then walk left to right: whenever a position is at least d from the last placed ball, place a ball there. If you placed all m balls, the gap d is achievable. The greedy rule (always take the earliest valid position) is optimal by an exchange argument: sliding any ball leftward to the greedy position never shrinks a gap, so greedy never does worse than any alternative placement.",
      },
      {
        type: "example",
        body:
          "Positions = [1,2,3,4,7], m = 3 balls. Range: lo=1, hi=(7-1)/(3-1)=3. Iteration 1: mid=(1+3+1)/2=2, greedy places at 1,3,7 (gaps 2,4), placed 3 >= 3, feasible, lo=2. Iteration 2: mid=(2+3+1)/2=3, greedy places at 1,4,7 (gaps 3,3), placed 3 >= 3, feasible, lo=3. lo=hi=3, answer is 3.",
      },
      {
        type: "callout",
        text:
          "The off-by-one trap: if you compute mid as (lo + hi) / 2 rounding down in an upper search, then when lo = 2 and hi = 3, mid = 2. If 2 is feasible you set lo = mid = 2, and the loop continues forever. Rounding up (lo + hi + 1) / 2 makes mid = 3, which either moves hi down or confirms lo. This single-character difference is the entire infinite-loop danger in upper binary search.",
      },
      magneticComplexity,
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_MAGNETIC,
      scene: {
        scene_id: "binsearch-magnetic-scene",
        title: "Upper binary search converging on the maximum feasible gap",
        motif: "placement-on-line",
        description: "Step through the upper binary search for Magnetic Force with positions [1,2,3,4,7] and m=3 balls. Each step tests a candidate minimum gap via greedy placement: place balls at the earliest valid positions, check if all m are placed. The search converges to gap 3, the largest achievable minimum distance.",
        panels: [
          {
            id: "greedy",
            title: "Greedy placement",
            kind: "ledger" as const,
            description: "How the feasibility check places balls.",
            data: [
              { label: "sort positions, place first ball at position[0]", value: "always start here", role: "input" as const },
              { label: "walk right, place when gap >= candidate", value: "greedy earliest valid", role: "process" as const },
              { label: "placed m balls means feasible", value: "try a larger gap", role: "output" as const },
            ],
          },
          {
            id: "upper-update",
            title: "Upper search update rule",
            kind: "flow" as const,
            description: "How the range narrows in upper binary search with round-up mid.",
            data: [
              { label: "mid = (lo + hi + 1) // 2", value: "round UP to prevent infinite loop", role: "input" as const },
              { label: "feasible: lo = mid", value: "push toward larger gaps", role: "process" as const },
              { label: "infeasible: hi = mid - 1", value: "gap was too wide", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Upper template", headline: "mid = (lo+hi+1)/2 rounds UP", narration: "The upper binary search finds the largest feasible candidate. Rounding up mid prevents the infinite loop.", receive: "the full range", transform: "round-up midpoint", pass: "check feasibility" },
        { start: 30, end: 62, label: "Greedy rule", headline: "Place at the earliest valid position", narration: "Sort positions, start at position zero, then place a ball whenever the gap from the last ball is at least the candidate distance.", receive: "sorted positions", transform: "greedy walk", pass: "how many placed" },
        { start: 62, end: 95, label: "Exchange proof", headline: "Greedy never does worse", narration: "Any optimal placement can be slid leftward to the greedy position without shrinking gaps. So if greedy cannot place all m balls, nothing else can either.", receive: "an alternative placement", transform: "slide left", pass: "at least as good" },
        { start: 95, end: 128, label: "Range", headline: "lo = 1, hi = span / (m-1)", narration: "The smallest gap is 1 (distinct positions). The largest is the total span divided by m minus 1 evenly spaced balls.", receive: "positions and m", transform: "compute range", pass: "lo and hi" },
        { start: 128, end: 150, label: "Update rule", headline: "feasible: lo = mid, infeasible: hi = mid - 1", narration: "When feasible, push lo up to try larger gaps. When infeasible, pull hi down.", receive: "feasibility result", transform: "update range", pass: "narrowed range" },
        { start: 150, end: 165, label: "Off-by-one", headline: "Round down loops forever", narration: "If lo equals hi minus one and mid rounds down to lo, a feasible result sets lo to lo again, looping forever. Round up to break the tie.", receive: "lo = hi - 1", transform: "round up mid", pass: "loop terminates" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Step through the upper binary search for Magnetic Force. Watch the greedy placement of balls on the number line at each candidate gap. The search converges to the largest gap where all balls can be placed.",
    params: { artifact_slug: A_MAGNETIC, min_height: 340 },
  },
  code: {
    prompt:
      "Implement maxDistance(position, m) using binary search on the answer. Search for the maximum minimum gap between m balls placed on the given positions. Sort the positions, then use the upper binary search template with a greedy feasibility check.",
    starter_code:
      "def maxDistance(position, m):\n    position.sort()\n    def canPlace(minDist):\n        count, last = 1, position[0]\n        for p in position[1:]:\n            if p - last >= minDist:\n                count += 1\n                last = p\n        return count >= m\n    lo, hi = 1, (position[-1] - position[0]) // (m - 1)\n    while lo < hi:\n        # TODO: upper binary search\n        # mid = (lo + hi + 1) // 2\n        # if canPlace(mid): lo = mid\n        # else: hi = mid - 1\n        pass\n    return lo\n",
    constraints: [
      "Use the upper binary search template: mid = (lo + hi + 1) // 2, feasible -> lo = mid, infeasible -> hi = mid - 1.",
      "Sort the positions first. The greedy placement scans left to right.",
      "lo = 1, hi = (position[-1] - position[0]) // (m - 1).",
    ],
    walkthrough: {
      title: "Upper binary search on minimum gap",
      steps: [
        { title: "Sort positions", detail: "The greedy placement needs sorted positions to walk left to right.", input: "unsorted positions", output: "sorted positions" },
        { title: "Set the range", detail: "lo = 1 (minimum gap), hi = span / (m-1) (evenly spaced balls).", input: "sorted positions, m", output: "lo, hi" },
        { title: "Greedy feasibility", detail: "Place first ball at position[0], then place a ball whenever gap >= candidate. If placed >= m, feasible.", input: "candidate gap", output: "feasible or not" },
        { title: "Upper search update", detail: "Feasible: lo = mid (try larger). Infeasible: hi = mid - 1 (too wide).", input: "feasibility result", output: "narrowed range" },
      ],
    },
    io_examples: [
      { label: "basic", input: "position = [1,2,3,4,7], m = 3", expected_output: "3", explanation: "Place at 1, 4, 7: gaps are 3 and 3, minimum is 3." },
      { label: "two balls", input: "position = [5,4,3,2,1,1000000000], m = 2", expected_output: "999999999", explanation: "Two balls at 1 and 1000000000, gap is 999999999." },
    ],
    visualization: {
      title: "sorted positions, greedy placement, upper search",
      description: "Each iteration tests a candidate gap via greedy ball placement.",
      items: [
        { label: "sort + set range", value: "lo=1, hi=span/(m-1)", role: "input" },
        { label: "greedy: earliest valid position", value: "placed >= m?", role: "process" },
        { label: "lo == hi = max gap", value: "the answer", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Magnetic Force — upper binary search",
        code:
          "def maxDistance(position, m):\n    position.sort()\n    def canPlace(minDist):\n        count, last = 1, position[0]\n        for p in position[1:]:\n            if p - last >= minDist:\n                count += 1\n                last = p\n        return count >= m\n    lo, hi = 1, (position[-1] - position[0]) // (m - 1)\n    while lo < hi:\n        mid = (lo + hi + 1) // 2\n        if canPlace(mid):\n            lo = mid\n        else:\n            hi = mid - 1\n    return lo",
        explanation: "O(n log n + n log span) time. The feasibility check is a single greedy pass.",
      },
      {
        label: "concise",
        title: "Magnetic Force — compact version",
        code:
          "def maxDistance(p, m):\n    p.sort()\n    lo, hi = 1, (p[-1] - p[0]) // (m - 1)\n    while lo < hi:\n        d = (lo + hi + 1) // 2\n        c, last = 1, p[0]\n        for x in p[1:]:\n            if x - last >= d: c += 1; last = x\n        if c >= m: lo = d\n        else: hi = d - 1\n    return lo",
        explanation: "Same logic inlined. The canPlace check is embedded in the loop body.",
      },
    ],
    hints: [
      { level: 1, text: "Sort the positions first. Set lo = 1, hi = (position[-1] - position[0]) // (m - 1)." },
      { level: 2, text: "Compute mid = (lo + hi + 1) // 2. The +1 rounds up to prevent infinite loops." },
      { level: 3, text: "In canPlace: walk sorted positions, place a ball whenever gap >= minDist. Return count >= m." },
      { level: 4, text: "If canPlace(mid) is true, set lo = mid. Otherwise set hi = mid - 1." },
    ],
    tests: [
      { id: "t_mag1", description: "[1,2,3,4,7] m=3", assert: "assert maxDistance([1,2,3,4,7], 3) == 3" },
      { id: "t_mag2", description: "two balls, max gap", assert: "assert maxDistance([5,4,3,2,1,1000000000], 2) == 999999999" },
      { id: "t_mag3", description: "all positions m=3", assert: "assert maxDistance([1,2,3], 3) == 1" },
    ],
    hidden_tests: [
      { id: "h_mag4", description: "two positions", assert: "assert maxDistance([1,1000000000], 2) == 999999999" },
      { id: "h_mag5", description: "tight placement", assert: "assert maxDistance([1,2,4,8,9], 3) == 3" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "bs2-so-1",
        type: "select_one",
        prompt: "Why does the upper binary search compute mid as (lo + hi + 1) // 2 instead of (lo + hi) // 2?",
        concept: "binary-search-on-answer",
        difficulty: "medium",
        choices: [
          "Rounding up prevents an infinite loop when lo and hi differ by one",
          "Rounding up makes the search faster by skipping candidates",
          "The problem requires a ceiling division",
          "It makes the search find the smallest answer instead of the largest",
        ],
        correct_index: 0,
        explanation: "When lo = hi - 1 and mid rounds down to lo, setting lo = mid does nothing and loops forever. Rounding up makes mid = hi, which breaks the tie.",
      },
      {
        id: "bs2-sa-1",
        type: "select_all",
        prompt: "Which of these problems can be solved with binary search on the answer?",
        concept: "binary-search-on-answer",
        difficulty: "medium",
        choices: [
          "Koko Eating Bananas: minimize eating speed",
          "Two Sum: find two numbers that sum to a target",
          "Capacity to Ship Packages: minimize ship capacity",
          "Magnetic Force: maximize minimum distance",
        ],
        correct_indices: [0, 2, 3],
        explanation: "Two Sum is not a binary-search-on-the-answer problem because the answer is a pair of indices, not a single number in a monotonic feasibility range.",
      },
      {
        id: "bs2-pr-1",
        type: "pattern_recognition",
        prompt: "Given n baskets on a line, place m balls in baskets to maximize the minimum distance between any two balls. Which pattern(s) apply?",
        concept: "binary-search-on-answer",
        difficulty: "hard",
        choices: [
          "binary search on the answer",
          "greedy",
          "dynamic programming",
          "sliding window",
          "two pointer",
          "divide and conquer",
        ],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Binary search on the answer with an upper search template. The feasibility check is a greedy placement.",
      },
      {
        id: "bs2-sa-none",
        type: "select_all",
        prompt: "Which of these changes to the upper binary search template would still produce a correct answer? (If none, select none.)",
        concept: "binary-search-on-answer",
        difficulty: "hard",
        choices: [
          "Using mid = (lo + hi) // 2 instead of (lo + hi + 1) // 2",
          "Setting hi = mid instead of hi = mid - 1 when infeasible",
          "Placing balls at the latest valid position instead of the earliest",
        ],
        correct_indices: [] as number[],
        explanation: "None: rounding down mid causes infinite loops, setting hi=mid instead of hi=mid-1 also causes infinite loops, and placing balls at the latest valid position is not optimal (greedy earliest is proven correct by the exchange argument).",
      },
      {
        id: "bs2-order-1",
        type: "ordering",
        prompt: "Order the steps of the greedy feasibility check for Magnetic Force.",
        concept: "binary-search-on-answer",
        difficulty: "medium",
        items: [
          "Sort the positions",
          "Place the first ball at position[0]",
          "Walk through positions: place a ball when gap from last placed ball >= candidate distance",
          "Count placed balls; if count >= m, the candidate distance is feasible",
        ],
        correct_order: [
          "Sort the positions",
          "Place the first ball at position[0]",
          "Walk through positions: place a ball when gap from last placed ball >= candidate distance",
          "Count placed balls; if count >= m, the candidate distance is feasible",
        ],
        explanation: "The greedy check sorts positions, starts at the leftmost, then greedily places balls at the earliest valid positions, and checks if enough balls were placed.",
      },
      {
        id: "bs2-written-1",
        type: "written",
        prompt: "Explain the exchange argument for why greedy placement (always take the earliest valid position) is optimal for the Magnetic Force feasibility check. Why can sliding a ball leftward to the greedy position never make things worse?",
        concept: "binary-search-on-answer",
        difficulty: "hard",
        actual_answer:
          "Suppose an optimal placement puts a ball at position X, but the greedy algorithm would place it at position Y where Y < X (earlier). Sliding the ball from X to Y does not shrink the gap from the previous ball, because Y already satisfies the minimum distance (greedy only places when the gap is sufficient). And the gap to the NEXT ball can only increase, because the ball moved further away from it. So greedy is at least as good as any alternative, which means if greedy cannot place all m balls, nothing else can either.",
        rubric: "Full credit: explains that sliding a ball left to the greedy position keeps the gap from the previous ball valid (still >= candidate) and increases the gap to the next ball. Therefore greedy never does worse. If greedy fails, all alternatives fail. Partial: says greedy places early without the exchange mechanics.",
      },
    ],
  },
};

// ── Practice code integrator: Magnetic Force (LC 1552) ────────────────────────
const finalCode = {
  prompt:
    "Implement maxDistance(position, m) that returns the maximum possible minimum magnetic force (distance) between m balls placed in n baskets at the given positions. Use binary search on the answer with the upper search template and a greedy feasibility check.",
  starter_code:
    "def maxDistance(position, m):\n    position.sort()\n    # TODO: implement upper binary search on the minimum gap\n    # Feasibility: greedy placement from left to right\n    pass\n",
  constraints: [
    "Sort the positions first.",
    "The candidate range is lo=1 to hi=(last-first)//(m-1).",
    "Use the upper binary search template with round-up mid.",
    "Feasibility: greedy walk placing balls whenever the gap from the last ball is at least the candidate.",
  ],
  walkthrough: {
    title: "Magnetic Force via binary search on the answer",
    steps: [
      { title: "Sort positions", detail: "The greedy placement needs sorted positions.", input: "unsorted array", output: "sorted array" },
      { title: "Define the range", detail: "lo=1, hi=(position[-1]-position[0])//(m-1). The answer is between 1 and the maximum possible even spacing.", input: "sorted positions, m", output: "lo, hi" },
      { title: "Upper binary search", detail: "mid=(lo+hi+1)//2. If canPlace(mid) is true, lo=mid. Else hi=mid-1.", input: "range", output: "narrowed range each iteration" },
      { title: "Greedy canPlace", detail: "Place first ball at position[0]. Walk right, place a ball whenever gap >= minDist. Return count >= m.", input: "candidate gap, positions", output: "feasible or not" },
    ],
  },
  io_examples: [
    { label: "basic", input: "position = [1,2,3,4,7], m = 3", expected_output: "3", explanation: "Place balls at 1, 4, 7. Gaps: 3 and 3. Minimum is 3." },
    { label: "two balls", input: "position = [5,4,3,2,1,1000000000], m = 2", expected_output: "999999999", explanation: "Place balls at the endpoints for the maximum gap." },
    { label: "dense", input: "position = [1,2,3], m = 3", expected_output: "1", explanation: "Three balls in three positions, minimum gap is 1." },
  ],
  visualization: {
    title: "upper search on minimum gap with greedy placement",
    description: "Sort, set range, binary-search with greedy feasibility.",
    items: [
      { label: "sort + range", value: "lo=1, hi=span/(m-1)", role: "input" },
      { label: "greedy placement check", value: "placed >= m?", role: "process" },
      { label: "max feasible gap", value: "the answer", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "Full implementation",
      code:
        "def maxDistance(position, m):\n    position.sort()\n    def canPlace(minDist):\n        count, last = 1, position[0]\n        for p in position[1:]:\n            if p - last >= minDist:\n                count += 1\n                last = p\n        return count >= m\n    lo, hi = 1, (position[-1] - position[0]) // (m - 1)\n    while lo < hi:\n        mid = (lo + hi + 1) // 2\n        if canPlace(mid):\n            lo = mid\n        else:\n            hi = mid - 1\n    return lo",
      explanation: "O(n log n + n log span). Sort once, then binary-search with a linear greedy check per iteration.",
    },
    {
      label: "concise",
      title: "Compact inline version",
      code:
        "def maxDistance(p, m):\n    p.sort()\n    lo, hi = 1, (p[-1] - p[0]) // (m - 1)\n    while lo < hi:\n        d = (lo + hi + 1) // 2\n        c, last = 1, p[0]\n        for x in p[1:]:\n            if x - last >= d: c += 1; last = x\n        if c >= m: lo = d\n        else: hi = d - 1\n    return lo",
      explanation: "Same algorithm with the feasibility check inlined into the search loop.",
    },
  ],
  hints: [
    { level: 1, text: "Sort the positions first." },
    { level: 2, text: "Set lo = 1, hi = (position[-1] - position[0]) // (m - 1)." },
    { level: 3, text: "Use mid = (lo + hi + 1) // 2. If canPlace(mid) is true, set lo = mid. Otherwise hi = mid - 1." },
    { level: 4, text: "canPlace walks sorted positions: place first ball at position[0], then place whenever gap >= minDist." },
    { level: 5, text: "Return lo when lo == hi." },
  ],
  tests: [
    { id: "t_int1", description: "[1,2,3,4,7] m=3", assert: "assert maxDistance([1,2,3,4,7], 3) == 3" },
    { id: "t_int2", description: "max gap two balls", assert: "assert maxDistance([5,4,3,2,1,1000000000], 2) == 999999999" },
    { id: "t_int3", description: "dense three balls", assert: "assert maxDistance([1,2,3], 3) == 1" },
  ],
  hidden_tests: [
    { id: "h_int4", description: "two endpoints", assert: "assert maxDistance([1,1000000000], 2) == 999999999" },
    { id: "h_int5", description: "four positions", assert: "assert maxDistance([1,2,4,8,9], 3) == 3" },
    { id: "h_int6", description: "sorted already", assert: "assert maxDistance([1,3,5,7,9], 4) == 2" },
  ],
};

// ── Code drill: Ship Packages (LC 1011, lower binary search) ─────────────────
const codeDrill = {
  pattern: "binary-search-on-answer",
  prompt:
    "A conveyor belt has packages with weights given as an array. You must ship them in order within d days. A ship holds a fixed weight capacity. Find the minimum capacity to ship all packages within d days. Each day the ship loads packages sequentially until the next would exceed the capacity, then sails. Use binary search on the answer with a greedy feasibility check.",
  difficulty: "medium" as const,
  target_seconds: 600,
  concept_tags: ["binary-search-on-answer", "greedy"],
  starter_code:
    "def shipWithinDays(weights, days):\n    # TODO: binary search on ship capacity\n    pass\n",
  reference_solution:
    "def shipWithinDays(weights, days):\n    def canShip(cap):\n        d, cur = 1, 0\n        for w in weights:\n            if cur + w > cap:\n                d += 1\n                cur = w\n            else:\n                cur += w\n        return d <= days\n    lo, hi = max(weights), sum(weights)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if canShip(mid): hi = mid\n        else: lo = mid + 1\n    return lo\n",
  hints: [
    { unlock_at_pct: 33, text: "The candidate range is lo = max(weights), hi = sum(weights). The feasibility check is: can you ship everything in at most d days with this capacity?" },
    { unlock_at_pct: 66, text: "Greedy: load packages until the next one would exceed capacity, then start a new day. Count the days. If days <= target, the capacity is feasible." },
    { unlock_at_pct: 100, text: "Lower binary search: mid = (lo + hi) // 2. If canShip(mid), hi = mid. Else lo = mid + 1. Return lo." },
  ],
  tests: [
    { id: "d_ship1", description: "10 packages 5 days", assert: "assert shipWithinDays([1,2,3,4,5,6,7,8,9,10], 5) == 15" },
    { id: "d_ship2", description: "6 packages 3 days", assert: "assert shipWithinDays([3,2,2,4,1,4], 3) == 6" },
    { id: "d_ship3", description: "5 packages 4 days", assert: "assert shipWithinDays([1,2,3,1,1], 4) == 3" },
    { id: "d_ship4", description: "single package", assert: "assert shipWithinDays([10], 1) == 10" },
    { id: "d_ship5", description: "ship all in one day", assert: "assert shipWithinDays([1,1,1,1,1], 1) == 5" },
  ],
};

// ── Assessment ───────────────────────────────────────────────────────────────
const assessment = {
  pass_threshold: 6,
  questions: [
    {
      id: "bs-a1",
      type: "multiple_choice",
      text: "Binary search on the answer requires the feasibility function to be monotonic. What does this mean?",
      concept: "binary-search-on-answer",
      difficulty: "easy",
      accepted_answers: ["Once a candidate is feasible, every larger (or smaller, depending on direction) candidate is also feasible"],
    },
    {
      id: "bs-a2",
      type: "numeric",
      text: "For Koko Eating Bananas with piles [3,6,7,11] and h=8 hours, what is the minimum eating speed?",
      concept: "binary-search-on-answer",
      difficulty: "medium",
      accepted_answers: ["4"],
    },
    {
      id: "bs-a3",
      type: "free_text",
      text: "Describe the difference between lower and upper binary search templates. When do you use each, and what changes in the code?",
      concept: "binary-search-on-answer",
      difficulty: "medium",
      accepted_answers: [
        "Lower search minimizes (leftmost feasible): mid=(lo+hi)//2, feasible->hi=mid, infeasible->lo=mid+1. Upper search maximizes (rightmost feasible): mid=(lo+hi+1)//2, feasible->lo=mid, infeasible->hi=mid-1.",
      ],
    },
    {
      id: "bs-a4",
      type: "numeric",
      text: "In Magnetic Force with positions [1,2,3,4,7] and m=3 balls, what is the maximum possible minimum gap between any two balls?",
      concept: "binary-search-on-answer",
      difficulty: "medium",
      accepted_answers: ["3"],
    },
    {
      id: "bs-a5",
      type: "free_text",
      text: "For Split Array Largest Sum, what should lo and hi be initialized to, and why?",
      concept: "binary-search-on-answer",
      difficulty: "medium",
      accepted_answers: [
        "lo = max(nums) because no subarray sum can be smaller than the largest element. hi = sum(nums) because one subarray holding everything is always feasible.",
      ],
    },
    {
      id: "bs-a6",
      type: "free_text",
      text: "What happens if you use mid = (lo + hi) // 2 (rounding down) in an upper binary search when lo = 5 and hi = 6? Explain the bug.",
      concept: "binary-search-on-answer",
      difficulty: "hard",
      accepted_answers: [
        "Infinite loop: mid = (5+6)//2 = 5. If feasible, lo = mid = 5, and the loop repeats forever because nothing changed.",
      ],
    },
    {
      id: "bs-a7",
      type: "free_text",
      text: "Explain the three-piece template for binary search on the answer. What are the three pieces, and how do you decide between lower and upper search?",
      concept: "binary-search-on-answer",
      difficulty: "medium",
      accepted_answers: [
        "Three pieces: (1) define the candidate range (lo = tightest lower bound, hi = loosest upper bound), (2) write a monotonic feasibility function, (3) binary-search the range. Lower search for minimizing (leftmost feasible, hi=mid), upper search for maximizing (rightmost feasible, lo=mid with round-up mid).",
      ],
    },
    {
      id: "bs-a8",
      type: "free_text",
      text: "A problem asks: given an array of positive integers and a target number of subarrays k, find the minimum possible value of the maximum subarray sum. Describe how you would solve this with binary search on the answer, including the feasibility function.",
      concept: "binary-search-on-answer",
      difficulty: "hard",
      accepted_answers: [
        "Candidate = max allowed sum. Range = [max(nums), sum(nums)]. Feasibility: greedy left-to-right scan, extend each subarray until next element exceeds target, start new subarray, count <= k means feasible. Lower binary search. Greedy is optimal because extending each subarray as far as possible uses the fewest splits.",
      ],
    },
  ],
};

// ── Diagnostics (next-lesson calibration questions) ──────────────────────────
const diagnostics = [
  {
    id: "bs-dx1",
    prompt: "How confident are you applying binary search on the answer to a new problem you have not seen before?",
  },
  {
    id: "bs-dx2",
    prompt: "Can you explain when to use lower vs upper binary search without looking up the template?",
  },
  {
    id: "bs-dx3",
    prompt: "What is the hardest part of binary search on the answer for you: recognizing the pattern, writing the feasibility function, or getting the binary search bounds right?",
  },
];

// ── Knowledge graph ─────────────────────────────────────────────────────────
const knowledgeGraph = {
  nodes: [
    { id: "bs-on-answer", label: "Binary search on the answer (three-piece template)", category: "lesson_concept", covered: true },
    { id: "bs-lower", label: "Lower binary search (minimize, leftmost feasible)", category: "lesson_concept", covered: true },
    { id: "bs-upper", label: "Upper binary search (maximize, rightmost feasible)", category: "lesson_concept", covered: true },
    { id: "bs-feasibility", label: "Monotonic feasibility function", category: "lesson_concept", covered: true },
    { id: "system-design", label: "System design algorithmic patterns (prior)", category: "concept", covered: true },
    { id: "greedy-oracle", label: "Greedy feasibility oracle", category: "concept", covered: true },
    { id: "mock-interview", label: "Mock interview simulation (next)", category: "concept", covered: false },
  ],
  edges: [],
  curriculum_stages: [
    { id: "system-design", label: "System Design algo patterns", status: "done" },
    { id: "binary-search-answer", label: "Binary Search on Answer", status: "current" },
    { id: "mock-interview", label: "Mock interview simulation", status: "next" },
    { id: "gap-analysis", label: "Gap analysis + targeted drills", status: "later" },
  ],
  current: "binary-search-answer",
};

const planningRationale =
  "This lesson covers a genuine uncovered gap in Frank's interview preparation. Binary Search on Answer was listed among his DP subcategories (evidence rows show familiarity with lis and knapsack) but has never been taught as a standalone technique. The core insight is reframing 'minimize/maximize X' as 'is candidate X feasible?' and confirming monotonicity. The lesson teaches both the lower search template (Koko Eating Bananas, Split Array Largest Sum, Ship Packages) and the upper search template (Magnetic Force / aggressive cows), with emphasis on the off-by-one trap of rounding down in upper search. The feasibility functions are greedy scans in every case, and the lesson connects the exchange argument for why greedy is optimal as the oracle. The integrator exercise is Magnetic Force (LC 1552) which combines sorting, upper binary search, and a greedy feasibility check. The code drill is Capacity to Ship Packages (LC 1011), a canonical lower-search problem that tests speed under time pressure. Pattern recognition questions probe whether the learner can identify BS-on-answer from a problem statement before coding. This lesson connects backward to the system-design lesson (which used a different style of binary search) and forward to the mock interview simulation where these techniques appear without pattern labels.";

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
  bad = fail("Part 1 (Koko + Split Array)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (Magnetic Force)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code (Magnetic Force)", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Code drill (Ship Packages)", validateCodeDrillContent(codeDrill)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1500)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Binary Search on the Answer: When the Answer Is a Search Space";
  const description =
    "A whole family of optimization problems where you search a range of candidate answers for the boundary between infeasible and feasible. Three pieces: define the range, write a monotonic feasibility function, binary-search. Covers Koko Eating Bananas (minimize speed, lower search), Split Array Largest Sum (minimize max partition sum), Magnetic Force (maximize min gap, upper search), and Capacity to Ship Packages (timed drill). The recognition rule: if can(candidate) is monotonic and efficient, you have a binary search on the answer.";
  const goals = JSON.stringify([
    "Recognize optimization problems that can be solved with binary search on the answer by checking for a monotonic feasibility function",
    "Implement the lower binary search template (minimize) and the upper binary search template (maximize) without off-by-one bugs",
    "Write greedy feasibility oracles for partition, placement, and consumption problems and explain why the greedy scan is optimal",
  ]);
  const tags = JSON.stringify(["binary-search-on-answer", "greedy", "lower-binary-search", "upper-binary-search", "koko", "split-array", "magnetic-force", "ship-packages", "interview-prep"]);
  const overviewAudioContent = {
    script: OVERVIEW_SCRIPT,
    transcript: OVERVIEW_SCRIPT,
    duration_hint: 1500,
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
    insertAct.run(lessonId, "audio", 1, "Audio: binary search on the answer — when the answer IS the search space", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Lower binary search — Koko Eating Bananas and Split Array Largest Sum", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Upper binary search — Magnetic Force and the round-up trap", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: Magnetic Force Between Two Balls (LC 1552)", JSON.stringify(finalCode));
    insertAct.run(lessonId, "code_drill", 5, "Drill: Capacity to Ship Packages (LC 1011)", JSON.stringify(codeDrill));
    insertAct.run(lessonId, "assessment", 6, "Assessment: binary search on the answer — recognition, templates, feasibility", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 6 activities.`);
  closeDb();
}

main();
