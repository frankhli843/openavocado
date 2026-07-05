// Update subject 9 workpad (Comprehensive Avo Lesson Plan) + add a journal entry
// after generating Lesson 2 (Sliding Window). Idempotent: replaces workpad content.
import Database from "better-sqlite3";

const WORKPAD = `# Coding Interview Mastery — Comprehensive Avo Lesson Plan
_Last updated after generating Lesson 2 (Sliding Window), 2026-07-05._

## Subject Goal And Learner Outcome
Full mastery of the ~15 core interview patterns so Frank can (1) recognize any pattern from a
problem description within ~2 minutes, (2) implement the optimal solution for a LeetCode-Medium in
under ~20 minutes, and (3) articulate complexity and failure modes under interview pressure. The
subject is weak-pattern-first: it teaches Frank's least-practiced patterns before reactivating
strong-but-stale ones, then integrates everything into mock-interview simulation. The outcome is
interview readiness measured by recognition speed and from-scratch implementation speed, not by
completion counts.

## Evidence Consulted
1. mastery_signals (source=algo_repo_import): 26 concept signals imported from Frank's algorithms
   repo, breakdown 24 strength / 1 review_needed / 1 weak_spot.
2. learning_evidence (source=historical_import): 595 rows across 26 concepts — the 2022-2023 comfort
   map. Volume by concept: lis 106, dynamic-programming 65, knapsack 55 ... sliding-window 14,
   two-pointer 14, heap 8, trie 4, backtracking 1 (weak patterns have minimal volume).
3. sliding-window mastery_signal count = 1 (weak) — the single weakest tracked pattern.
4. Lesson 16 (seq 0) initial assessment: 18 weak-weighted questions (pattern recognition + approach),
   deliberately re-calibrating over the stale repo map. Answers, when submitted, override priors.
5. Lesson 17 (seq 1, this generation): Sliding Window, 5 activities, all schema-validated.
6. Approved bespoke artifacts: algo-sw-overview-map, algo-sw-fixed-window, algo-sw-variable-window
   (qa_approved, CDP desktop+390px verified).
7. Generated audio artifacts: activity 98 (845s overview), 99 (117s), 100 (128s) — all serve 200.
8. Code exercises: reference solutions for all three exercises proven to pass all public+hidden
   tests in CPython (identical Pyodide assert semantics).

## Current Learner Model
Strong-but-stale (2-3 years old, needs speed reactivation, not re-teaching): DP variants (LIS,
Kadane, knapsack, MCM), Tree/Graph traversal, Union Find, Linked List, binary search. Weak / near-zero
recent practice (teach first): sliding window (now taught), two pointer, heap/priority queue, trie,
backtracking, monotonic stack. Sliding window was the single weakest signal and is Frank's active
interview bottleneck, so it was chosen as the first teaching lesson. The initial assessment (lesson 16)
is the ground-truth recalibration; until Frank submits it, the imported repo comfort map is the prior.

## Phase Decision
Phase = early Competence, not Familiarity. Rationale (semantic, not threshold-based): Frank is an
experienced engineer with 685 tracked problems; he does not need vocabulary orientation, he needs
mechanism depth, recognition speed, and execution reps on his weak patterns. So Lesson 2 goes
straight into the mechanism (overlap insight, both branches, amortized argument, failure modes) and
drills recognition, rather than a high-level tour. Mastery-phase integration (mock interviews) is
deferred to lessons 9-11 after the weak patterns are competent.

## Course And Reference Map
Concept progression synthesized from common interview-prep syllabi (Grokking the Coding Interview
pattern taxonomy; NeetCode roadmap; CLRS for amortized analysis). Weak-first order: Sliding Window →
Two Pointer → Heap → Trie → Backtracking → Monotonic Stack, then stale reactivation (DP, Graphs),
then integration (system-design algorithms, mock interview, gap-driven drills). Sliding window and
two pointer are adjacent because a window is bounded by two same-direction pointers.

## Near-Term Detailed Plan
**Lesson 3 — Two Pointer (next, ~300 words of intent).** Purpose: teach the two-pointer family and
distinguish it from sliding window. Prerequisites: sliding window's same-direction pointers (taught).
Concepts not to assume: opposite-end (converging) pointers, the sorted-array precondition, fast/slow
(Floyd) pointers, partitioning. Examples: two-sum on a sorted array (converging), remove-duplicates
in place (read/write pointers), container-with-most-water (greedy converging), cycle detection
(fast/slow). Visuals: a converging-pointers artifact over a sorted array showing the sum vs target
decision, and a read/write in-place-compaction artifact. Audio-synced scene plan: overview contrasts
same-direction (window) vs opposite-direction (converging) vs different-speed (Floyd). Practice/code:
scaffolded two-sum-sorted and in-place dedup, plus pattern_recognition questions separating window
from two-pointer. Assessment evidence to collect: can Frank pick converging vs same-direction from a
prompt; does he know why sorting is the enabler. Resequencing trigger: if lesson-16 answers show
two-pointer is already strong, compress to a speed-drill and pull Heap forward.

**Lesson 4 — Heap / Priority Queue (~260 words of intent).** Purpose: teach the heap as the
"k-th / top-k / merge-streams / scheduling" tool. Prerequisites: comfort with O(log n) inserts.
Concepts not to assume: heap invariant, heapify O(n), Python heapq (min-heap only; negate for
max-heap), lazy deletion. Examples: k-th largest, top-k frequent, merge k sorted lists, task
scheduler. Visuals: a binary-heap tree artifact showing sift-up/sift-down, and a "running top-k"
ledger. Practice/code: scaffolded heapq usage with explicit API docs in starter comments (heappush,
heappop, nlargest). Evidence: does Frank reach for a heap on "top-k" and know the min-heap-of-size-k
trick. Resequencing trigger: heap has only 8 evidence rows, so expect it to need full teaching.

**Backfill for Lessons 2-4 (P3.3): code_drill activities.** The code_drill activity_type and the
pattern_recognition question type already exist (committed b17d50a). Backfill each weak-pattern lesson
with 1-2 timed drills targeting the single pattern (target 300-600s, progressive hints at 33/66/100%).

## Mid-Term Plan
**Lessons 5-8:** Trie (prefix-tree insert/search, word-search II), Backtracking (subsets, permutations,
combination-sum, N-queens; the choose/explore/unchoose template), Monotonic Stack (next-greater-element,
daily-temperatures, largest-rectangle), then DP reactivation (Kadane, LIS, knapsack, MCM — speed drills
assuming understanding). Each ~120 words of intent, weak-first, each its own generation + QA task.

## Long-Term Horizon
1. **Graph reactivation (lesson ~9):** BFS/DFS, Dijkstra, Union Find, topological sort — speed reps.
2. **System-design algorithms (lesson ~10):** consistent hashing, rate limiting, consensus.
3. **Mock interview simulation (lesson ~11):** timed, pattern-selection-under-stress scenarios.
4. **Gap analysis + targeted drill generation:** synthesize accumulated evidence into a personalized
   weak-spot drill set.
5. **Spaced-retrieval maintenance:** recurring review lessons keyed off decaying mastery signals.
Each milestone will name concepts, references, visuals, and the evidence required, and will be
resequenced against Frank's real interview timeline.

## Resequencing Rules
- If lesson-16 assessment answers show a "weak" pattern is actually competent, compress its lesson to
  a speed drill and pull the next weak pattern forward.
- If Frank reports an imminent interview targeting a specific company/pattern, jump that pattern ahead.
- A single wrong answer is a mastery-signal note, not a resequence; only resequence when a
  misconception would make the next lesson invalid.

## References And Citations
- Grokking the Coding Interview — pattern taxonomy (coverage map, not copied).
- NeetCode 150 / roadmap — sequencing reference for pattern order.
- CLRS ch. 17 — amortized analysis (the potential/aggregate argument used in the variable-window proof).
- LeetCode canonical problems per pattern (maximum-average-subarray-I, longest-substring-without-repeating,
  minimum-size-subarray-sum) — used as exercise sources.
- Frank's algorithms repo (github.com/frankhli843/algorithms) — historical comfort evidence.

## What Changed Since The Previous Plan
Generated Lesson 2 (Sliding Window), the first teaching lesson. Added three approved bespoke artifacts
and ~1090s of two-host audio. Caught and fixed a content bug (window 9,3,6 = 18, not 17) via execution,
and decoupled code tests from internal helper names so both scaffolded and idiomatic solutions pass.
Confirmed the weak-first ordering against imported evidence. Next action: Two Pointer (lesson 3), then
backfill code_drills into lessons 2-4.`;

const db = new Database("data/avocadocore.db");
const existing = db.prepare("SELECT id FROM subject_workpads WHERE subject_id=9").get();
if (existing) {
  db.prepare("UPDATE subject_workpads SET content=?, version=COALESCE(version,0)+1, last_updated_by='cc-handauthored/algo-interview', last_updated_for='lesson-2-sliding-window', updated_at=CURRENT_TIMESTAMP WHERE subject_id=9").run(WORKPAD);
} else {
  db.prepare("INSERT INTO subject_workpads (subject_id, learner_id, content, version, last_updated_by, last_updated_for) VALUES (9,1,?,1,'cc-handauthored/algo-interview','lesson-2-sliding-window')").run(WORKPAD);
}
db.prepare(
  "INSERT INTO subject_journal_entries (subject_id, learner_id, entry_type, title, content, created_by) VALUES (9,1,'lesson_generation',?,?,'cc-handauthored/algo-interview')"
).run(
  "Generated Lesson 2: Sliding Window",
  "Authored the first teaching lesson (Sliding Window, seq 1) — Frank's single weakest tracked pattern. Structure: two-host Socratic overview audio (~14 min) with an orientation map, two lesson parts (fixed-size and variable-size windows) each with a bespoke Chrome-QA'd interactive, per-part synced audio visuals, scaffolded Python, and mixed practice including pattern-recognition; a final integrator exercise (smallest subarray with sum >= target); and an MC + freeform assessment. Verified in the live browser at desktop and 390px. Execution QA caught a real bug (the maximum size-3 window is 9,3,6 = 18, not 17) which was fixed, and code tests were decoupled from internal helper names. Next lesson: Two Pointer, then backfill timed code drills into lessons 2-4."
);
db.close();
console.log("workpad updated + journal entry added for subject 9");
