#!/usr/bin/env tsx
/**
 * P4.1 — Mixed Hard lesson (subject 9, seq 11):
 * "No Pattern Labels: Recognize, Articulate, Implement Under Pressure".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill. This is the
 * lesson where problems are presented WITHOUT identifying the technique.
 * Frank must recognize the pattern from the problem statement alone,
 * articulate the approach, then implement under time pressure.
 *
 * Three problems from historically weak areas:
 *   1. Minimum Window Substring (LC 76) — sliding window
 *   2. Task Scheduler (LC 621) — heap + greedy
 *   3. Palindrome Partitioning (LC 131) — backtracking
 *
 * Structure: top-level 2-host overview audio + orientation visual, two
 * collapsed lesson_parts (sliding window implementation; backtracking
 * implementation) each with a bespoke approved artifact + per-part audio
 * synced visual + scaffolded code + mixed practice, a final integrator
 * practice_code (Task Scheduler, LC 621), an adaptive MC + freeform
 * assessment, a timed code_drill (Minimum Window Substring, LC 76),
 * and diagnostics.
 *
 * References the three approved bespoke artifacts:
 *   algo-mixedhard-recognition, algo-mixedhard-slidingwindow,
 *   algo-mixedhard-backtrack
 *
 * Idempotent: replaces any prior seq=11 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-mixedhard.ts
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
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/mixedhard-audio";

const SUBJECT_ID = 9;
const SEQ = 11;

const A_RECOGNITION = "algo-mixedhard-recognition";
const A_SLIDINGWINDOW = "algo-mixedhard-slidingwindow";
const A_BACKTRACK = "algo-mixedhard-backtrack";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_RECOGNITION,
  scene: {
    scene_id: "mixedhard-orientation",
    title: "No pattern labels: the recognition challenge",
    motif: "unlabeled-problem-recognition",
    description:
      "Orientation for the mixed hard lesson. Three problems presented without technique labels. The learner must recognize which algorithm family each problem belongs to before implementing. This exercises the critical interview skill of pattern recognition under pressure, covering sliding window, heap/greedy, and backtracking from the problem statement alone. The recognition checklist: read fully, identify output type, check constraints, match to known template, verify against examples.",
    panels: [
      {
        id: "checklist",
        title: "Recognition checklist",
        kind: "flow" as const,
        description: "The five-step process for identifying which algorithm to apply to an unseen problem.",
        data: [
          { label: "Read fully", value: "Do not skim. Read every constraint and example.", role: "input" as const },
          { label: "Output type", value: "Single number? String? List of lists? Boolean?", role: "process" as const },
          { label: "Constraints", value: "n <= 10^5 = O(n log n). n <= 16 = exponential OK.", role: "process" as const },
          { label: "Match template", value: "Two pointer, sliding window, binary search, heap, DP, backtracking", role: "output" as const },
        ],
      },
      {
        id: "problems",
        title: "Three unlabeled problems",
        kind: "cards" as const,
        description: "The three problems in this lesson, each from a different pattern family.",
        data: [
          { label: "Problem 1", value: "Minimum window containing all characters (contiguous, coverage)", role: "context" as const },
          { label: "Problem 2", value: "Schedule tasks with cooldown, minimize total time (scheduling, frequency)", role: "context" as const },
          { label: "Problem 3", value: "All palindrome partitions of a string (enumerate, small n)", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 120, label: "Training wheels off", headline: "No labels, no hints", narration: "Today the problems arrive without technique labels. You have to figure out what you are looking at before you write a single line of code.", receive: "an unlabeled problem", transform: "read and analyze", pass: "a pattern hypothesis" },
    { start: 120, end: 250, label: "Recognition instinct", headline: "Ask the right questions", narration: "Build a mental checklist: contiguous subarray = sliding window, repeated max/min = heap, all combinations = backtracking.", receive: "problem statement", transform: "mental checklist", pass: "pattern candidate" },
    { start: 250, end: 420, label: "Five-step framework", headline: "Read, output, constraints, template, verify", narration: "Step one: read fully. Step two: identify the output type. Step three: check constraints. Step four: match to a known template. Step five: verify against examples.", receive: "any interview problem", transform: "five-step checklist", pass: "confirmed pattern" },
    { start: 420, end: 560, label: "Problem 1", headline: "Minimum Window Substring", narration: "Find the minimum window in s containing every character of t. Substring means contiguous. Coverage condition. This is a sliding window with frequency map.", receive: "two strings s and t", transform: "expand right, shrink left", pass: "minimum valid window" },
    { start: 560, end: 720, label: "Sliding window detail", headline: "Expand then shrink", narration: "Maintain need and have frequency maps. Track formed count. When formed equals required, shrink from left. Record minimum valid window.", receive: "frequency maps", transform: "expand-shrink loop", pass: "O(n) coverage" },
    { start: 720, end: 890, label: "Problem 2", headline: "Task Scheduler", narration: "Schedule tasks with cooldown, minimize idle time. Most frequent task determines minimum length. Greedy with a max heap or a mathematical formula.", receive: "tasks and cooldown n", transform: "schedule most-frequent first", pass: "minimum intervals" },
    { start: 890, end: 1040, label: "Formula approach", headline: "(f-1)(n+1) + count_max", narration: "The formula: max frequency f, count of tasks at max frequency. Result is max of total tasks and (f-1)(n+1) + count_max.", receive: "frequency distribution", transform: "math formula", pass: "O(n) solution" },
    { start: 1040, end: 1180, label: "Problem 3", headline: "Palindrome Partitioning", narration: "All possible palindrome partitions. Return all means enumerate. n up to 16 means exponential is fine. Choose-explore-unchoose backtracking.", receive: "string s, |s| <= 16", transform: "try every palindrome prefix, recurse", pass: "all valid partitions" },
    { start: 1180, end: 1350, label: "DP optimization", headline: "Precompute palindrome table", narration: "Build a dp table where dp[i][j] is true when substring i..j is a palindrome. O(1) lookup inside the backtracking, so the bottleneck is the number of valid partitions.", receive: "O(n^2) palindrome table", transform: "O(1) palindrome check", pass: "efficient backtracking" },
    { start: 1350, end: 1500, label: "The real lesson", headline: "Name the shape first", narration: "The first thirty seconds of reading a new problem matter more than the next thirty minutes of coding. Can you name the shape before you touch the keyboard?", receive: "any interview problem", transform: "recognition checklist", pass: "technique confirmed, start coding" },
  ],
};

// ── sliding window complexity ────────────────────────────────────────────────
const slidingWindowComplexity = {
  type: "formula",
  latex: "O(|s| + |t|)",
  plain_english:
    "Each character in s is visited at most twice: once when the right pointer expands the window, and once when the left pointer shrinks it. Building the need map from t takes O(|t|). The total time is O(|s| + |t|) and the space is O(|alphabet|) for the frequency maps.",
  variables: [
    { symbol: "|s|", meaning: "length of the source string s" },
    { symbol: "|t|", meaning: "length of the target string t" },
    { symbol: "|alphabet|", meaning: "number of distinct characters (at most 52 for English letters)" },
  ],
};

// ── Part 1: Sliding Window — Minimum Window Substring ────────────────────────
const part1 = {
  part_id: "mixedhard-sliding-window",
  reading: {
    intro: "The first unlabeled problem is Minimum Window Substring (LC 76). The recognition signal: 'minimum substring' plus a coverage condition points directly to sliding window with two pointers and a frequency map.",
    blocks: [
      { type: "heading", text: "Sliding window with frequency tracking" },
      { type: "paragraph", text: "The sliding window technique maintains a window [left, right] that expands by advancing right and shrinks by advancing left. For Minimum Window Substring, the window must contain every character in t, including duplicates. The key invariant is that each character enters and leaves the window at most once, giving O(|s|) time." },
      { type: "definition", term: "Need map", definition: "A frequency counter built from t. For each character c in t, need[c] records how many copies of c the window must contain. This is fixed for the entire run." },
      { type: "definition", term: "Window map", definition: "A frequency counter for the current window [left, right]. For each character c between left and right inclusive, window[c] records how many copies are present. Updated incrementally as left and right move." },
      { type: "definition", term: "Formed count", definition: "The number of distinct characters whose window count meets or exceeds the need count. When formed equals the number of distinct characters in need, the window is valid. This avoids comparing the entire maps on every step." },
      slidingWindowComplexity,
      { type: "callout", tone: "insight" as const, text: "The expand-then-shrink pattern is the core of every sliding window problem. Expand right to satisfy the condition, then shrink left to minimize. Record the best valid window seen so far." },
      { type: "example", title: "ADOBECODEBANC with t=ABC", body: "The algorithm finds the minimum window 'BANC' (length 4) starting at index 9. The window expands through ADOBEC to first satisfy coverage, then shrinks toDOBEC, then continues expanding and shrinking until BANC emerges as the minimum." },
    ],
    summary: "Sliding window for coverage: maintain need and window frequency maps, track formed count, expand right to satisfy, shrink left to minimize. O(|s| + |t|) time.",
  },
  audio: {
    script: PART1_SCRIPT,
    duration_hint: 200,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_SLIDINGWINDOW,
      scene: {
        scene_id: "mixedhard-slidingwindow-scene",
        title: "Sliding window expand-shrink loop",
        motif: "window-coverage-minimize",
        description: "Visualization of the sliding window algorithm for Minimum Window Substring. Shows the expand-right, shrink-left loop with character frequency tracking, formed count, and minimum valid window discovery.",
        panels: [
          {
            id: "expand-shrink",
            title: "The expand-shrink loop",
            kind: "flow" as const,
            description: "The two phases of the sliding window: expand right to satisfy coverage, shrink left to minimize.",
            data: [
              { label: "Expand right", value: "Add character, update window map and formed count", role: "input" as const },
              { label: "Check validity", value: "formed == required means window contains all of t", role: "process" as const },
              { label: "Shrink left", value: "Remove character from left, update formed, record minimum", role: "output" as const },
            ],
          },
          {
            id: "frequency-tracking",
            title: "Frequency accounting",
            kind: "cards" as const,
            description: "The need map, window map, and formed count that drive the algorithm.",
            data: [
              { label: "need map", value: "Fixed from t: {A:1, B:1, C:1}", role: "context" as const },
              { label: "window map", value: "Dynamic: updated as left/right move", role: "context" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 15, label: "Key insight", headline: "Never reset the window", narration: "The right pointer only moves forward, the left pointer only moves forward. No character is visited more than twice.", receive: "string s", transform: "two forward-only pointers", pass: "O(n) guarantee" },
        { start: 15, end: 35, label: "Two dictionaries", headline: "Need and window maps", narration: "Need counts what t requires. Window counts what the current range contains. Formed tracks how many characters are satisfied.", receive: "target t", transform: "build need map", pass: "frequency tracking" },
        { start: 35, end: 55, label: "Formed count", headline: "Running tally", narration: "When window[c] reaches need[c], increment formed. When formed equals distinct needed characters, the window is valid.", receive: "character added", transform: "check against need", pass: "formed update" },
        { start: 55, end: 75, label: "Shrink phase", headline: "Minimize the window", narration: "When valid, record the minimum, then remove the leftmost character and check if formed drops. Stop shrinking when the window is no longer valid.", receive: "valid window", transform: "remove leftmost", pass: "minimum recorded" },
        { start: 75, end: 95, label: "Expand again", headline: "Continue right", narration: "After shrinking invalidates the window, continue expanding right to find the next valid window.", receive: "invalid window", transform: "expand right pointer", pass: "next valid window" },
        { start: 95, end: 120, label: "The template", headline: "Expand then shrink", narration: "This expand-then-shrink loop is the core of every sliding window problem. Adapt the validity check and the bookkeeping for each variant.", receive: "any coverage problem", transform: "sliding window template", pass: "minimum contiguous range" },
        { start: 120, end: 145, label: "Edge cases", headline: "Three gotchas", narration: "Three edge cases: t longer than s, duplicate characters in t, and tracking the start index of the best window, not just the length.", receive: "edge case input", transform: "boundary check", pass: "correct result" },
        { start: 145, end: 200, label: "Complexity", headline: "O(|s| + |t|)", narration: "Each character in s enters and leaves the window at most once. Building the need map is O(|t|). Space is O(alphabet size).", receive: "time analysis", transform: "amortized constant per character", pass: "linear total" },
      ],
    },
  },
  interactive: {
    type: "bespoke_artifact",
    artifact_slug: A_SLIDINGWINDOW,
    description: "Step through the sliding window algorithm on ADOBECODEBANC with target ABC.",
  },
  code: {
    language: "python",
    prompt: "Implement the sliding window solution for Minimum Window Substring. Given strings s and t, return the minimum window in s that contains every character of t including duplicates. Return '' if no such window exists.",
    walkthrough: {
      title: "Minimum Window Substring walkthrough",
      steps: [
        { title: "Build the need map", detail: "Count every character in t using a dictionary. Also compute the number of distinct characters needed (required = len(need)).", input: "t = 'ABC'", output: "need = {'A':1, 'B':1, 'C':1}, required = 3" },
        { title: "Initialize pointers and tracking", detail: "Set left = 0, formed = 0, window_counts = {}, and result = (infinity, 0, 0) to track the minimum window length, start, and end indices.", input: "left = 0", output: "ready to expand" },
        { title: "Expand right pointer", detail: "For each right from 0 to len(s)-1, add s[right] to window_counts. If window_counts[s[right]] equals need[s[right]], increment formed.", input: "s[right] = 'A'", output: "window_counts['A'] = 1, formed = 1" },
        { title: "Shrink from left when valid", detail: "While formed == required, compute window length, update result if smaller, then remove s[left] from window_counts. If window_counts[s[left]] drops below need[s[left]], decrement formed. Increment left.", input: "formed == required", output: "minimum window updated" },
      ],
    },
    io_examples: [
      { label: "Standard case", input: "s = 'ADOBECODEBANC', t = 'ABC'", expected_output: "'BANC'", explanation: "BANC at index 9 is the shortest window containing A, B, and C." },
      { label: "Single character", input: "s = 'a', t = 'a'", expected_output: "'a'", explanation: "The entire string is the minimum window." },
      { label: "No valid window", input: "s = 'a', t = 'aa'", expected_output: "''", explanation: "t requires two copies of 'a' but s has only one." },
    ],
    visualization: {
      title: "Sliding window data flow",
      items: [
        { label: "Input strings", value: "s = 'ADOBECODEBANC', t = 'ABC'", role: "input" as const },
        { label: "Need map", value: "Fixed frequency counter from t", role: "input" as const },
        { label: "Window expand-shrink", value: "Two pointers moving forward, frequency accounting", role: "process" as const },
        { label: "Formed count check", value: "formed == required means valid window", role: "process" as const },
        { label: "Minimum window", value: "'BANC' (length 4)", role: "output" as const },
      ],
    },
    starter_code: `from collections import Counter

def min_window(s: str, t: str) -> str:
    if not s or not t or len(t) > len(s):
        return ""

    need = Counter(t)
    required = len(need)

    # TODO: implement the sliding window
    # Use left pointer, formed count, and window_counts dict

    return ""`,
    worked_examples: [
      {
        label: "basic",
        title: "Readable sliding window",
        explanation: "Uses explicit need and window dictionaries with a formed counter.",
        code: `from collections import Counter

def min_window(s: str, t: str) -> str:
    if not s or not t or len(t) > len(s):
        return ""

    need = Counter(t)
    required = len(need)
    window_counts = {}
    formed = 0

    best_len = float('inf')
    best_start = 0
    left = 0

    for right in range(len(s)):
        c = s[right]
        window_counts[c] = window_counts.get(c, 0) + 1
        if c in need and window_counts[c] == need[c]:
            formed += 1

        while formed == required:
            window_len = right - left + 1
            if window_len < best_len:
                best_len = window_len
                best_start = left

            lc = s[left]
            window_counts[lc] -= 1
            if lc in need and window_counts[lc] < need[lc]:
                formed -= 1
            left += 1

    return "" if best_len == float('inf') else s[best_start:best_start + best_len]`,
      },
      {
        label: "concise",
        title: "Compact sliding window",
        code: `from collections import Counter
def min_window(s, t):
    need, W, formed, res = Counter(t), {}, 0, ""
    req, l = len(need), 0
    for r, c in enumerate(s):
        W[c] = W.get(c, 0) + 1
        if c in need and W[c] == need[c]: formed += 1
        while formed == req:
            if not res or r - l + 1 < len(res): res = s[l:r+1]
            W[s[l]] -= 1
            if s[l] in need and W[s[l]] < need[s[l]]: formed -= 1
            l += 1
    return res`,
      },
    ],
    tests: [
      { id: "mws-t1", description: "Standard case ADOBECODEBANC", assert: "min_window('ADOBECODEBANC', 'ABC') == 'BANC'" },
      { id: "mws-t2", description: "Single character match", assert: "min_window('a', 'a') == 'a'" },
      { id: "mws-t3", description: "No valid window", assert: "min_window('a', 'aa') == ''" },
    ],
    hidden_tests: [
      { id: "mws-h1", description: "Empty t", assert: "min_window('abc', '') == ''" },
      { id: "mws-h2", description: "Full string is answer", assert: "min_window('abc', 'abc') == 'abc'" },
    ],
  },
  practice: {
    questions: [
      {
        id: "mh-p1-q1",
        type: "select_one" as const,
        prompt: "In the sliding window for Minimum Window Substring, what does the 'formed' counter track?",
        concept: "sliding-window-recognition",
        difficulty: "easy" as const,
        choices: [
          "The total number of characters in the current window",
          "The number of distinct characters whose window count meets or exceeds the need count",
          "The number of times the left pointer has moved",
          "The length of the longest valid window seen so far",
        ],
        correct_index: 1,
        explanation: "Formed counts how many distinct required characters are fully satisfied in the current window. When it equals the number of distinct characters in t, the window is valid.",
      },
      {
        id: "mh-p1-q2",
        type: "select_one" as const,
        prompt: "Why does the sliding window guarantee O(|s|) time?",
        concept: "sliding-window-complexity",
        difficulty: "medium" as const,
        choices: [
          "Because it uses a hash map with O(1) lookups",
          "Because each character in s is visited at most twice: once by right and once by left",
          "Because the window never contains more than 26 characters",
          "Because the algorithm sorts the string first",
        ],
        correct_index: 1,
        explanation: "Each character enters the window when right advances past it and leaves the window when left advances past it. Since both pointers only move forward, each character is processed at most twice.",
      },
      {
        id: "mh-p1-q3",
        type: "select_all" as const,
        prompt: "Which of these are valid recognition signals for sliding window?",
        concept: "pattern-recognition",
        difficulty: "medium" as const,
        choices: [
          "The problem asks for a contiguous subarray or substring",
          "The problem asks for all possible combinations",
          "The problem involves a coverage or count condition over a range",
          "The problem mentions 'minimum' or 'maximum' window",
        ],
        correct_indices: [0, 2, 3],
        explanation: "Sliding window problems involve contiguous ranges with coverage/count conditions. 'All possible combinations' is a backtracking signal, not sliding window.",
      },
      {
        id: "mh-p1-q4",
        type: "select_all" as const,
        prompt: "Which of these statements about the need map are correct?",
        concept: "sliding-window-implementation",
        difficulty: "easy" as const,
        choices: [
          "The need map is rebuilt every time the window moves",
          "The need map is updated when the right pointer adds a new character",
          "The need map records how many copies of each character are in t",
          "The need map changes when the left pointer shrinks the window",
        ],
        correct_indices: [],
        explanation: "The need map is built once from t and never changes. Only the window map is updated as pointers move. Statements A, B, and D describe the window map, not the need map. Statement C describes the need map but is listed here incorrectly as modifiable.",
      },
      {
        id: "mh-p1-q5",
        type: "ordering" as const,
        prompt: "Order the steps of the sliding window algorithm for Minimum Window Substring.",
        concept: "sliding-window-implementation",
        difficulty: "medium" as const,
        items: [
          "Shrink from left while window is valid, recording minimum",
          "Build the need map from t",
          "Expand right pointer and update window counts",
          "Check if formed equals required",
          "Return the minimum window found",
        ],
        correct_order: [
          "Build the need map from t",
          "Expand right pointer and update window counts",
          "Check if formed equals required",
          "Shrink from left while window is valid, recording minimum",
          "Return the minimum window found",
        ],
        explanation: "First build the need map, then iterate with the right pointer expanding and checking validity, shrink when valid, and return the result.",
      },
      {
        id: "mh-p1-q6",
        type: "written" as const,
        prompt: "Explain why the sliding window approach is optimal for Minimum Window Substring and why brute force would be too slow.",
        concept: "sliding-window-complexity",
        difficulty: "hard" as const,
        actual_answer: "Brute force checks all O(n^2) substrings and verifies each in O(n) or O(alphabet), giving O(n^2 * alphabet) total. For n = 100,000, this is too slow. Sliding window achieves O(n) because each character enters and leaves the window at most once. The amortized cost per character is O(1) since the left pointer advances at most n times total across all iterations. The space is O(alphabet) for the two frequency maps.",
        rubric: "Must mention: (1) brute force is O(n^2) or worse, (2) sliding window visits each character at most twice, (3) amortized O(1) per step because left only moves forward, (4) space is bounded by alphabet size.",
      },
      {
        id: "mh-p1-q7",
        type: "pattern_recognition" as const,
        prompt: "You are given an array of integers and need to find the longest subarray where the absolute difference between any two elements is at most k. Which algorithmic patterns could solve this?",
        concept: "pattern-recognition",
        difficulty: "hard" as const,
        choices: [
          "Sliding window",
          "Binary search on the answer",
          "Backtracking",
          "Heap / multiset",
          "Dynamic programming",
          "Monotonic deque",
        ],
        primary_indices: [0],
        secondary_indices: [3, 5],
        explanation: "This is a sliding window problem: longest contiguous subarray satisfying a condition. A monotonic deque or sorted container can track the window min/max efficiently. Binary search on the answer does not apply here because the answer is a length, not a value to search. Backtracking and DP are overkill for a contiguous-range problem.",
      },
    ],
    pass_threshold: 5,
    written_feedback: "llm_judge" as const,
  },
};

// ── backtracking complexity ──────────────────────────────────────────────────
const backtrackComplexity = {
  type: "formula",
  latex: "O(n \\cdot 2^n)",
  plain_english:
    "In the worst case, every partition of the string is valid (e.g. 'aaa'), giving 2^(n-1) partitions. For each partition, copying the path takes O(n). The precomputed palindrome table takes O(n^2) time and space. With n <= 16, 2^15 = 32768 partitions, which is easily manageable.",
  variables: [
    { symbol: "n", meaning: "length of the input string s" },
    { symbol: "2^(n-1)", meaning: "maximum number of ways to partition a string of length n (each gap can be a split or not)" },
  ],
};

// ── Part 2: Backtracking — Palindrome Partitioning ───────────────────────────
const part2 = {
  part_id: "mixedhard-backtracking",
  reading: {
    intro: "The third unlabeled problem is Palindrome Partitioning (LC 131). The recognition signal: 'return ALL possible' plus a small constraint (n <= 16) is the textbook backtracking signal.",
    blocks: [
      { type: "heading", text: "Backtracking with palindrome precomputation" },
      { type: "paragraph", text: "Backtracking is choose-explore-unchoose: at each position in the string, try every possible end position. If the substring from start to end is a palindrome, add it to the current path and recurse from end+1. When start reaches the string length, the current path is a complete valid partition." },
      { type: "definition", term: "Decision tree", definition: "The implicit tree where each node represents a split point. At position i, the children correspond to palindrome prefixes ending at positions i, i+1, ..., n-1. Each root-to-leaf path is one valid partition. The total number of leaves is the number of valid partitions." },
      { type: "definition", term: "Palindrome DP table", definition: "A 2D boolean array dp[i][j] that is true when the substring from index i to index j inclusive is a palindrome. Base cases: dp[i][i] = true (single characters). Transition: dp[i][j] = (s[i] == s[j]) and (j - i < 2 or dp[i+1][j-1]). Precomputing this table turns each palindrome check from O(n) into O(1)." },
      backtrackComplexity,
      { type: "callout", tone: "insight" as const, text: "The un-choose step is critical: after the recursive call returns, pop the last element from the current path. Without this, the path accumulates across branches and produces garbage results." },
      { type: "example", title: "Palindrome Partitioning of 'aab'", body: "Two valid partitions: ['a','a','b'] and ['aa','b']. The backtracking first tries splitting at every position from the start. 'a' is a palindrome, so recurse on 'ab'. From 'ab': 'a' is a palindrome, recurse on 'b'. 'b' is a palindrome, recurse on empty. Found ['a','a','b']. Backtrack. Then 'ab' is not a palindrome, skip. Back to start: 'aa' is a palindrome, recurse on 'b'. 'b' is a palindrome. Found ['aa','b']. Backtrack. 'aab' is not a palindrome, skip. Done." },
    ],
    summary: "Backtracking for enumeration: choose a palindrome prefix, recurse on the suffix, unchoose. Precompute palindrome table for O(1) checks. O(n * 2^n) total.",
  },
  audio: {
    script: PART2_SCRIPT,
    duration_hint: 200,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_BACKTRACK,
      scene: {
        scene_id: "mixedhard-backtrack-scene",
        title: "Backtracking decision tree for palindrome partitioning",
        motif: "choose-explore-unchoose",
        description: "Visualization of the backtracking algorithm for Palindrome Partitioning. Shows how partitions are built one palindrome at a time, with the choose-explore-unchoose pattern driving the decision tree exploration.",
        panels: [
          {
            id: "backtrack-loop",
            title: "Choose-explore-unchoose",
            kind: "flow" as const,
            description: "The three phases of backtracking: choose a palindrome prefix, explore the rest, then undo the choice.",
            data: [
              { label: "Choose", value: "Try substring s[start..end] if it is a palindrome", role: "input" as const },
              { label: "Explore", value: "Add to path, recurse from end+1", role: "process" as const },
              { label: "Un-choose", value: "Pop from path after recursion returns", role: "output" as const },
            ],
          },
          {
            id: "palindrome-table",
            title: "Palindrome DP precomputation",
            kind: "cards" as const,
            description: "Precompute dp[i][j] for O(1) palindrome checks during backtracking.",
            data: [
              { label: "Base case", value: "dp[i][i] = true for all i", role: "context" as const },
              { label: "Transition", value: "dp[i][j] = (s[i]==s[j]) and dp[i+1][j-1]", role: "context" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 15, label: "Structure", headline: "Decision tree of splits", narration: "Each node represents a split point. At position i, try every end position j. If s[i..j] is a palindrome, add to path and recurse.", receive: "string s", transform: "decision tree", pass: "all valid partitions" },
        { start: 15, end: 35, label: "Base case", headline: "Start equals length", narration: "When start equals the string length, the current path is a complete valid partition. Copy it into the result list.", receive: "start == len(s)", transform: "copy path to result", pass: "one valid partition" },
        { start: 35, end: 55, label: "Un-choose", headline: "Pop after recursion", narration: "After the recursive call returns, pop the last substring from the path. This is the backtracking step that resets state for the next branch.", receive: "return from recursion", transform: "path.pop()", pass: "clean state for next branch" },
        { start: 55, end: 80, label: "Palindrome check", headline: "Inline vs precomputed", narration: "Inline two-pointer check is O(n) per call. Precomputed DP table is O(1) per call after O(n^2) setup. For n up to 16, both work.", receive: "substring check needed", transform: "dp[i][j] lookup", pass: "O(1) answer" },
        { start: 80, end: 105, label: "DP table", headline: "Fill diagonals outward", narration: "Base: every single character is a palindrome. Then pairs: dp[i][i+1] is true if s[i] equals s[i+1]. Then length 3 and up: dp[i][j] = (s[i] == s[j]) and dp[i+1][j-1].", receive: "string of length n", transform: "O(n^2) DP fill", pass: "palindrome lookup table" },
        { start: 105, end: 130, label: "Optimization", headline: "Bottleneck is output size", narration: "After precomputation, the backtracking cost is proportional to the number of valid partitions times n for path copying. For n = 16, this is at most 32K partitions.", receive: "bounded output", transform: "enumerate all", pass: "complete result" },
        { start: 130, end: 160, label: "Template", headline: "Backtracking = choose-explore-unchoose", narration: "This pattern applies to every enumeration problem: combinations, permutations, subsets, N-queens, Sudoku. The only thing that changes is the validity check.", receive: "any enumeration problem", transform: "same three-step template", pass: "all valid solutions" },
        { start: 160, end: 200, label: "Recognition", headline: "'All possible' is the signal", narration: "When a problem says 'return all possible,' 'find every valid,' or 'list all,' and the constraint is small, you are looking at backtracking.", receive: "problem statement", transform: "check for enumeration signal", pass: "backtracking confirmed" },
      ],
    },
  },
  interactive: {
    type: "bespoke_artifact",
    artifact_slug: A_BACKTRACK,
    description: "Step through the backtracking algorithm on 'aab' to find all palindrome partitions.",
  },
  code: {
    language: "python",
    prompt: "Implement the backtracking solution for Palindrome Partitioning. Given a string s, return all possible palindrome partitions.",
    walkthrough: {
      title: "Palindrome Partitioning walkthrough",
      steps: [
        { title: "Precompute palindrome table", detail: "Build a 2D boolean array dp[i][j] where dp[i][j] is True if s[i..j] is a palindrome. Fill diagonals from length 1 outward. Single chars are always palindromes. Pairs: check if s[i] == s[i+1]. Longer: dp[i][j] = (s[i] == s[j]) and dp[i+1][j-1].", input: "s = 'aab'", output: "dp table filled" },
        { title: "Define the backtrack function", detail: "backtrack(start, path) tries every end position from start to len(s)-1. If dp[start][end] is True, append s[start:end+1] to path and recurse with start=end+1. After recursion, pop from path.", input: "start=0, path=[]", output: "recursive exploration" },
        { title: "Base case: complete partition", detail: "When start == len(s), the path is a complete partition. Append a copy of path (not a reference) to the result list.", input: "start == 3", output: "result.append(path[:])" },
        { title: "Collect and return results", detail: "Call backtrack(0, []) and return the accumulated result list containing all valid palindrome partitions.", input: "backtrack(0, [])", output: "[['a','a','b'], ['aa','b']]" },
      ],
    },
    io_examples: [
      { label: "Standard case", input: "s = 'aab'", expected_output: "[['a','a','b'], ['aa','b']]", explanation: "Two valid partitions: split into three singles or group the leading 'aa'." },
      { label: "Single character", input: "s = 'a'", expected_output: "[['a']]", explanation: "Only one partition: the character itself." },
      { label: "All same", input: "s = 'aaa'", expected_output: "[['a','a','a'], ['a','aa'], ['aa','a'], ['aaa']]", explanation: "Every substring is a palindrome, so every possible split is valid." },
    ],
    visualization: {
      title: "Backtracking data flow",
      items: [
        { label: "Input string", value: "s = 'aab'", role: "input" as const },
        { label: "Palindrome DP table", value: "O(n^2) precomputed boolean matrix", role: "input" as const },
        { label: "Backtracking tree", value: "Choose palindrome prefix, recurse on suffix, un-choose", role: "process" as const },
        { label: "Path copy at leaf", value: "When start == len(s), copy current path to result", role: "process" as const },
        { label: "All valid partitions", value: "[['a','a','b'], ['aa','b']]", role: "output" as const },
      ],
    },
    starter_code: `def partition(s: str) -> list[list[str]]:
    n = len(s)
    # Step 1: precompute palindrome table
    dp = [[False] * n for _ in range(n)]
    for i in range(n):
        dp[i][i] = True
    # TODO: fill dp for lengths 2..n

    result = []
    # TODO: implement backtrack(start, path)

    return result`,
    worked_examples: [
      {
        label: "basic",
        title: "Readable backtracking with DP table",
        explanation: "Uses explicit DP precomputation and a clean backtrack function.",
        code: `def partition(s: str) -> list[list[str]]:
    n = len(s)
    dp = [[False] * n for _ in range(n)]
    for i in range(n):
        dp[i][i] = True
    for i in range(n - 1):
        if s[i] == s[i + 1]:
            dp[i][i + 1] = True
    for length in range(3, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            if s[i] == s[j] and dp[i + 1][j - 1]:
                dp[i][j] = True

    result = []

    def backtrack(start, path):
        if start == n:
            result.append(path[:])
            return
        for end in range(start, n):
            if dp[start][end]:
                path.append(s[start:end + 1])
                backtrack(end + 1, path)
                path.pop()

    backtrack(0, [])
    return result`,
      },
      {
        label: "concise",
        title: "Compact backtracking",
        code: `def partition(s):
    n, res = len(s), []
    dp = [[False]*n for _ in range(n)]
    for i in range(n):
        for j in range(i+1):
            if s[j] == s[i] and (i - j < 2 or dp[j+1][i-1]):
                dp[j][i] = True
    def bt(start, path):
        if start == n: res.append(path[:]); return
        for end in range(start, n):
            if dp[start][end]: path.append(s[start:end+1]); bt(end+1, path); path.pop()
    bt(0, [])
    return res`,
      },
    ],
    tests: [
      { id: "pp-t1", description: "Standard case 'aab'", assert: "sorted(partition('aab')) == sorted([['a','a','b'], ['aa','b']])" },
      { id: "pp-t2", description: "Single character", assert: "partition('a') == [['a']]" },
      { id: "pp-t3", description: "All same 'aaa'", assert: "len(partition('aaa')) == 4" },
    ],
    hidden_tests: [
      { id: "pp-h1", description: "Two character palindrome", assert: "sorted(partition('aa')) == sorted([['a','a'], ['aa']])" },
      { id: "pp-h2", description: "No multi-char palindrome", assert: "partition('abc') == [['a','b','c']]" },
    ],
  },
  practice: {
    questions: [
      {
        id: "mh-p2-q1",
        type: "select_one" as const,
        prompt: "What is the base case in the backtracking for Palindrome Partitioning?",
        concept: "backtracking-base-case",
        difficulty: "easy" as const,
        choices: [
          "When the current substring is not a palindrome",
          "When start equals the length of the string",
          "When the path contains n elements",
          "When all characters have been checked for palindromes",
        ],
        correct_index: 1,
        explanation: "When start equals len(s), every character has been assigned to a palindrome partition, so the current path is a complete valid partition.",
      },
      {
        id: "mh-p2-q2",
        type: "select_one" as const,
        prompt: "Why must you copy the path (path[:]) when adding to results in backtracking?",
        concept: "backtracking-implementation",
        difficulty: "medium" as const,
        choices: [
          "To avoid exceeding the recursion depth limit",
          "Because Python lists are mutable and the same object is modified during backtracking",
          "To reduce memory usage by creating a shallow copy",
          "Because the DP table references the path object",
        ],
        correct_index: 1,
        explanation: "If you append the path reference directly, all entries in the result list would point to the same list object, which gets modified during backtracking. Copying creates an independent snapshot.",
      },
      {
        id: "mh-p2-q3",
        type: "select_all" as const,
        prompt: "Which of these are recognition signals for backtracking?",
        concept: "pattern-recognition",
        difficulty: "medium" as const,
        choices: [
          "The problem says 'return all possible' or 'find every valid'",
          "The constraint n is very small (typically n <= 20)",
          "The problem asks for the minimum or maximum value",
          "The problem involves building solutions incrementally with constraints",
        ],
        correct_indices: [0, 1, 3],
        explanation: "'Return all possible' and small n are classic backtracking signals. Building solutions incrementally with validity constraints is the core backtracking pattern. 'Minimum or maximum' is usually optimization (DP, binary search, greedy), not enumeration.",
      },
      {
        id: "mh-p2-q4",
        type: "select_all" as const,
        prompt: "Which of these statements correctly describe how backtracking differs from brute force?",
        concept: "backtracking-vs-bruteforce",
        difficulty: "hard" as const,
        choices: [
          "Backtracking always explores every possible combination without pruning",
          "Backtracking generates solutions in sorted order by default",
          "Backtracking uses memoization to cache intermediate results",
          "Backtracking requires a graph data structure to track visited states",
        ],
        correct_indices: [],
        explanation: "None are correct. Backtracking prunes invalid branches early (not brute force). It does not guarantee sorted output. Memoization is a DP technique, not backtracking. Backtracking uses recursion and the call stack, not necessarily an explicit graph.",
      },
      {
        id: "mh-p2-q5",
        type: "ordering" as const,
        prompt: "Order the steps to fill the palindrome DP table.",
        concept: "palindrome-dp",
        difficulty: "medium" as const,
        items: [
          "Fill pairs: dp[i][i+1] = (s[i] == s[i+1])",
          "Fill singles: dp[i][i] = True for all i",
          "Fill length 3+: dp[i][j] = (s[i]==s[j]) and dp[i+1][j-1]",
        ],
        correct_order: [
          "Fill singles: dp[i][i] = True for all i",
          "Fill pairs: dp[i][i+1] = (s[i] == s[i+1])",
          "Fill length 3+: dp[i][j] = (s[i]==s[j]) and dp[i+1][j-1]",
        ],
        explanation: "Start with the smallest substrings (length 1), then pairs (length 2), then expand outward. Each longer substring depends on the answer for the substring two characters shorter.",
      },
      {
        id: "mh-p2-q6",
        type: "written" as const,
        prompt: "Explain the time complexity of Palindrome Partitioning including the DP precomputation and the backtracking enumeration.",
        concept: "backtracking-complexity",
        difficulty: "hard" as const,
        actual_answer: "The DP precomputation fills an n x n table in O(n^2) time. The backtracking explores at most 2^(n-1) partitions (each of the n-1 gaps is either a split or not). For each partition, copying the path takes O(n). So the total time is O(n^2) for DP plus O(n * 2^n) for backtracking, giving O(n * 2^n) overall. For n = 16, 2^15 = 32768 partitions, easily manageable.",
        rubric: "Must mention: (1) O(n^2) for DP precomputation, (2) 2^(n-1) maximum partitions, (3) O(n) per partition for path copy, (4) total O(n * 2^n), (5) feasibility for n <= 16.",
      },
      {
        id: "mh-p2-q7",
        type: "pattern_recognition" as const,
        prompt: "A problem asks: given a set of n items with weights and values, find all subsets whose total weight does not exceed W. n <= 20. Which patterns apply?",
        concept: "pattern-recognition",
        difficulty: "hard" as const,
        choices: [
          "Backtracking",
          "Dynamic programming",
          "Sliding window",
          "Bit manipulation (enumerate all 2^n subsets)",
          "Greedy",
          "Binary search",
        ],
        primary_indices: [0],
        secondary_indices: [3],
        explanation: "The problem asks for 'all subsets' with a constraint and n <= 20, which is the backtracking signal. Bit manipulation (2^20 = ~1M) is also feasible as an alternative enumeration strategy. DP would find optimal value, not enumerate all valid subsets. Sliding window does not apply to subsets. Greedy is for optimization. Binary search does not apply here.",
      },
    ],
    pass_threshold: 5,
    written_feedback: "llm_judge" as const,
  },
};

// ── Final integrator code: Task Scheduler (LC 621) ───────────────────────────
const finalCode = {
  language: "python",
  prompt: "Implement the Task Scheduler (LC 621). Given an array of tasks (characters) and a cooldown n, return the minimum number of intervals to finish all tasks. Same tasks must be separated by at least n intervals. Use either the heap simulation or the mathematical formula approach.",
  walkthrough: {
    title: "Task Scheduler walkthrough",
    steps: [
      { title: "Count task frequencies", detail: "Use a Counter to count how many times each task appears. Identify the maximum frequency f and how many tasks share that maximum frequency (count_max).", input: "tasks = ['A','A','A','B','B','B'], n = 2", output: "freqs = {A:3, B:3}, f = 3, count_max = 2" },
      { title: "Apply the formula", detail: "The minimum intervals is max(len(tasks), (f - 1) * (n + 1) + count_max). The first term handles the case with no idle time. The second term handles the case where the most frequent tasks force idle gaps.", input: "f=3, n=2, count_max=2, total=6", output: "max(6, (3-1)*(2+1)+2) = max(6, 8) = 8" },
      { title: "Understanding the formula", detail: "Imagine filling a grid with (n+1) columns and (f-1) rows. The most frequent task fills the first column. Other tasks fill remaining slots. The last row only has count_max items. Total slots = (f-1)*(n+1) + count_max.", input: "grid layout", output: "idle slots emerge naturally" },
    ],
  },
  io_examples: [
    { label: "Standard case", input: "tasks = ['A','A','A','B','B','B'], n = 2", expected_output: "8", explanation: "Schedule: A B idle A B idle A B. Total 8 intervals." },
    { label: "No cooldown", input: "tasks = ['A','A','A','B','B','B'], n = 0", expected_output: "6", explanation: "With n=0, no cooldown needed. Just do all tasks: 6 intervals." },
    { label: "Single task type", input: "tasks = ['A','A','A'], n = 2", expected_output: "7", explanation: "A idle idle A idle idle A. Total 7 intervals." },
  ],
  visualization: {
    title: "Task scheduler data flow",
    items: [
      { label: "Input", value: "tasks array + cooldown n", role: "input" as const },
      { label: "Frequency count", value: "Count each task, find max frequency f", role: "input" as const },
      { label: "Formula computation", value: "(f-1)*(n+1) + count_max", role: "process" as const },
      { label: "Max with total", value: "max(total_tasks, formula_result)", role: "process" as const },
      { label: "Minimum intervals", value: "The answer", role: "output" as const },
    ],
  },
  starter_code: `from collections import Counter

def least_interval(tasks: list[str], n: int) -> int:
    freq = Counter(tasks)
    # TODO: find max frequency, count_max, apply formula
    return 0`,
  worked_examples: [
    {
      label: "basic",
      title: "Formula approach",
      explanation: "Uses the mathematical formula. Clean and O(n) time.",
      code: `from collections import Counter

def least_interval(tasks: list[str], n: int) -> int:
    freq = Counter(tasks)
    max_freq = max(freq.values())
    count_max = sum(1 for v in freq.values() if v == max_freq)

    # Minimum slots needed by the most frequent tasks
    formula_result = (max_freq - 1) * (n + 1) + count_max

    # If total tasks exceed formula, no idle time needed
    return max(len(tasks), formula_result)`,
    },
    {
      label: "concise",
      title: "Compact formula",
      code: `from collections import Counter
def least_interval(tasks, n):
    f = Counter(tasks); m = max(f.values()); c = sum(v == m for v in f.values())
    return max(len(tasks), (m - 1) * (n + 1) + c)`,
    },
  ],
  tests: [
    { id: "ts-t1", description: "Standard case with cooldown 2", assert: "least_interval(['A','A','A','B','B','B'], 2) == 8" },
    { id: "ts-t2", description: "No cooldown needed", assert: "least_interval(['A','A','A','B','B','B'], 0) == 6" },
    { id: "ts-t3", description: "Single task type", assert: "least_interval(['A','A','A'], 2) == 7" },
  ],
  hidden_tests: [
    { id: "ts-h1", description: "Single task", assert: "least_interval(['A'], 5) == 1" },
    { id: "ts-h2", description: "Many distinct tasks no idle", assert: "least_interval(['A','B','C','D','E','F'], 2) == 6" },
  ],
};

// ── Code drill: Minimum Window Substring (timed) ─────────────────────────────
const codeDrill = {
  pattern: "sliding-window",
  prompt: "Implement Minimum Window Substring (LC 76): given strings s and t, find the shortest substring of s containing every character of t (including duplicates). Return '' if no such window exists. Target: 10 minutes.",
  target_seconds: 600,
  difficulty: "hard" as const,
  language: "python",
  starter_code: `from collections import Counter

def min_window(s: str, t: str) -> str:
    # Your implementation here
    pass`,
  tests: [
    { id: "mws-d1", description: "Standard case", assert: "min_window('ADOBECODEBANC', 'ABC') == 'BANC'" },
    { id: "mws-d2", description: "Single char", assert: "min_window('a', 'a') == 'a'" },
    { id: "mws-d3", description: "No valid window", assert: "min_window('a', 'aa') == ''" },
    { id: "mws-d4", description: "Full string", assert: "min_window('abc', 'cba') == 'abc'" },
  ],
  hints: [
    { unlock_at_pct: 33, text: "Use two dictionaries: need (from t) and window (current counts). Track a formed counter for how many characters are satisfied." },
    { unlock_at_pct: 66, text: "Expand right to add characters. When formed == required, shrink from left recording the minimum. Decrement formed when a character drops below need." },
    { unlock_at_pct: 100, text: "The full pattern: for right in range(len(s)), add to window. While formed == required: update best, remove s[left], check formed, left += 1." },
  ],
  solution: `from collections import Counter
def min_window(s, t):
    if not t or not s: return ""
    need = Counter(t)
    req, formed, l, W = len(need), 0, 0, {}
    res = ""
    for r, c in enumerate(s):
        W[c] = W.get(c, 0) + 1
        if c in need and W[c] == need[c]: formed += 1
        while formed == req:
            if not res or r - l + 1 < len(res): res = s[l:r+1]
            W[s[l]] -= 1
            if s[l] in need and W[s[l]] < need[s[l]]: formed -= 1
            l += 1
    return res`,
};

// ── Assessment ───────────────────────────────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "mh-a1",
      type: "multiple_choice" as const,
      text: "A problem asks you to find the longest substring with at most k distinct characters. Which technique should you use?",
      concept: "pattern-recognition",
      difficulty: "easy" as const,
      accepted_answers: ["Sliding window"],
    },
    {
      id: "mh-a2",
      type: "multiple_choice" as const,
      text: "A problem says 'return all possible ways to place n queens on an n x n board.' What technique does this require?",
      concept: "pattern-recognition",
      difficulty: "easy" as const,
      accepted_answers: ["Backtracking"],
    },
    {
      id: "mh-a3",
      type: "free_text" as const,
      text: "Explain the difference between using a formed counter versus comparing the entire need and window maps on every step in the sliding window algorithm.",
      concept: "sliding-window-implementation",
      difficulty: "medium" as const,
      accepted_answers: [
        "The formed counter is O(1) to update (increment or decrement when a character crosses the threshold), while comparing entire maps is O(alphabet_size) per step. Over n steps, this is the difference between O(n) total and O(n * alphabet) total.",
      ],
    },
    {
      id: "mh-a4",
      type: "free_text" as const,
      text: "Derive the Task Scheduler formula. Why is the answer max(total_tasks, (f-1)*(n+1) + count_max)?",
      concept: "heap-greedy-formula",
      difficulty: "hard" as const,
      accepted_answers: [
        "Imagine a grid with n+1 columns. The most frequent task (frequency f) fills the first column across f rows, creating f-1 gaps of size n between consecutive occurrences. Each gap has n+1 slots (one task + n cooldown). So we need (f-1)*(n+1) slots plus count_max for the last row. If total tasks exceed this, there are no idle slots and the answer is simply total_tasks.",
      ],
    },
    {
      id: "mh-a5",
      type: "numeric" as const,
      text: "What is the maximum number of palindrome partitions for a string of length 16 (worst case, all same character)?",
      concept: "backtracking-complexity",
      difficulty: "medium" as const,
      accepted_answers: ["32768"],
    },
    {
      id: "mh-a6",
      type: "ordering" as const,
      text: "Order the pattern recognition checklist from first to last.",
      concept: "pattern-recognition",
      difficulty: "medium" as const,
      items: [
        "Verify candidate pattern against examples",
        "Read the problem fully without skimming",
        "Check constraints for time complexity hints",
        "Match the problem shape to a known template",
        "Identify the output type (number, string, list of lists, boolean)",
      ],
    },
    {
      id: "mh-a7",
      type: "free_text" as const,
      text: "You see a new problem in an interview: 'Given a string, find the shortest palindrome you can make by adding characters only to the front.' How would you approach recognizing the technique?",
      concept: "pattern-recognition",
      difficulty: "hard" as const,
      accepted_answers: [
        "Step 1: Output is a string (modified palindrome). Step 2: Constraint is likely n up to 10^5 (needs O(n) or O(n log n)). Step 3: This is about finding the longest palindrome prefix of the string, then prepending the reverse of the remaining suffix. The technique is KMP failure function or rolling hash on the reversed string concatenated with the original. Recognition signal: string manipulation + palindrome + efficiency constraint = string matching algorithm.",
      ],
    },
    {
      id: "mh-a8",
      type: "free_text" as const,
      text: "In a 45-minute interview with three problems, how should you allocate your time for pattern recognition versus implementation?",
      concept: "interview-strategy",
      difficulty: "medium" as const,
      accepted_answers: [
        "Spend 2-3 minutes on recognition per problem (read, identify output type, check constraints, match template, verify with examples). Then 10-12 minutes implementing per problem. Verbalize your recognition to the interviewer ('this looks like a sliding window problem because...') since showing thought process earns credit even before code. If stuck on recognition after 3 minutes, verbalize what you have considered and ask the interviewer for a hint on approach rather than wasting time in silence.",
      ],
    },
  ],
};

// ── Diagnostics (next-lesson calibration questions) ──────────────────────────
const diagnostics = [
  {
    id: "mh-dx1",
    prompt: "How confident are you recognizing the correct algorithm from an unlabeled problem statement?",
  },
  {
    id: "mh-dx2",
    prompt: "Which of the three patterns (sliding window, heap/greedy, backtracking) felt hardest to recognize from the problem statement alone?",
  },
  {
    id: "mh-dx3",
    prompt: "Can you implement all three techniques from memory without looking up the template?",
  },
];

// ── Knowledge graph ─────────────────────────────────────────────────────────
const knowledgeGraph = {
  nodes: [
    { id: "pattern-recognition", label: "Pattern recognition from unlabeled problems", category: "lesson_concept", covered: true },
    { id: "sliding-window-review", label: "Sliding window: Minimum Window Substring", category: "lesson_concept", covered: true },
    { id: "heap-greedy-review", label: "Heap/greedy: Task Scheduler formula", category: "lesson_concept", covered: true },
    { id: "backtracking-review", label: "Backtracking: Palindrome Partitioning", category: "lesson_concept", covered: true },
    { id: "binary-search-answer", label: "Binary search on answer (prior)", category: "concept", covered: true },
    { id: "interview-strategy", label: "Interview time management and verbalization", category: "concept", covered: true },
    { id: "mock-interview", label: "Mock interview simulation (next)", category: "concept", covered: false },
  ],
  edges: [],
  curriculum_stages: [
    { id: "binary-search-answer", label: "Binary Search on Answer", status: "done" },
    { id: "mixed-hard", label: "Mixed Hard: No Pattern Labels", status: "current" },
    { id: "mock-interview", label: "Mock interview simulation", status: "next" },
    { id: "gap-analysis", label: "Gap analysis + targeted drills", status: "later" },
  ],
  current: "mixed-hard",
};

const planningRationale =
  "This lesson addresses the critical gap between knowing algorithms in isolation and recognizing them in interview conditions. Prior lessons labeled the technique upfront; this lesson removes that crutch. Three problems from historically weak areas (sliding window, heap/greedy, backtracking) are presented without pattern labels. The learner must recognize the technique from problem signals (contiguous range = sliding window, scheduling with frequency = heap/greedy, enumerate all = backtracking), articulate the approach, then implement under time pressure. The five-step recognition checklist (read fully, output type, constraints, match template, verify) is the primary teaching objective. This connects backward to every prior technique lesson and forward to the mock interview simulation where multiple unlabeled problems appear in sequence.";

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
  bad = fail("Part 1 (Sliding Window)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (Backtracking)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code (Task Scheduler)", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Code drill (Min Window Substring)", validateCodeDrillContent(codeDrill)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1500)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "No Pattern Labels: Recognize, Articulate, Implement Under Pressure";
  const description =
    "Three problems presented without identifying the underlying technique. The learner must recognize the algorithm family from the problem statement alone, articulate the approach, then implement under time pressure. Covers Minimum Window Substring (sliding window), Task Scheduler (heap/greedy), and Palindrome Partitioning (backtracking). The primary teaching objective is the five-step recognition checklist: read fully, identify output type, check constraints, match to known template, verify against examples.";
  const goals = JSON.stringify([
    "Recognize sliding window, heap/greedy, and backtracking patterns from unlabeled problem statements using the five-step recognition checklist",
    "Implement all three techniques from memory under time pressure without template reference",
    "Articulate pattern recognition reasoning aloud, as practiced in interview settings",
  ]);
  const tags = JSON.stringify(["pattern-recognition", "sliding-window", "heap", "greedy", "backtracking", "interview-prep", "mixed-hard", "minimum-window-substring", "task-scheduler", "palindrome-partitioning"]);
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
    insertAct.run(lessonId, "audio", 1, "Audio: no pattern labels — recognize, articulate, implement", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Sliding Window — Minimum Window Substring (LC 76)", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Backtracking — Palindrome Partitioning (LC 131)", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: Task Scheduler (LC 621)", JSON.stringify(finalCode));
    insertAct.run(lessonId, "code_drill", 5, "Drill: Minimum Window Substring (LC 76, timed)", JSON.stringify(codeDrill));
    insertAct.run(lessonId, "assessment", 6, "Assessment: pattern recognition, implementation, and interview strategy", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 6 activities.`);
  closeDb();
}

main();
