/**
 * P3.3 backfill: add one `code_drill` activity to each of the first three
 * weak-pattern lessons (Sliding Window 17, Two Pointer 18, Heap 19).
 *
 * Each drill is a single-pattern timed rep ("one more rep" muscle memory) that
 * targets the same concept slug the lesson teaches, so drill evidence flows into
 * the same learning_evidence.concept the historical import populated. Every drill
 * is validated against validateCodeDrillContent before insert, and the reference
 * solution for all three was proven in CPython (see drill_solutions_test.py).
 *
 * Ordering: the drill lands at sequence_order 4 (right after the two teaching
 * lesson_parts), bumping practice_code -> 5 and assessment -> 6. Idempotent:
 * re-running deletes any prior drill and re-normalises the tail ordering.
 */
import { getDb, closeDb } from "../src/db/connection";
import { validateCodeDrillContent, type CodeDrillContent } from "../src/lib/lesson-content/schema";

interface DrillPlan {
  lessonId: number;
  title: string;
  content: CodeDrillContent;
}

const DRILLS: DrillPlan[] = [
  {
    lessonId: 17,
    title: "Drill: fixed-window max sum",
    content: {
      pattern: "sliding-window",
      prompt:
        "Given an integer array `nums` and an integer `k` (1 <= k <= len(nums)), return the maximum sum of any contiguous subarray of length k. Do it in one pass: compute the first window's sum, then slide — add the entering element and subtract the leaving one — so every step is O(1). No nested loop.",
      target_seconds: 420,
      difficulty: "easy",
      language: "python",
      starter_code:
        "def max_window_sum(nums, k):\n    # TODO: sum the first k elements, then slide the window one step at a time,\n    # adding nums[i] and subtracting nums[i-k], tracking the running best.\n    pass\n",
      tests: [
        { id: "t_basic", description: "typical middle window wins", assert: "assert max_window_sum([2,1,5,1,3,2], 3) == 9" },
        { id: "t_all", description: "k equals the whole array", assert: "assert max_window_sum([1,2,3,4], 4) == 10" },
        { id: "t_size1", description: "window of size 1 is the max element", assert: "assert max_window_sum([4,-1,2,1], 1) == 4" },
        { id: "t_neg", description: "all negatives — least-negative window", assert: "assert max_window_sum([-3,-1,-2,-5], 2) == -3" },
      ],
      hints: [
        { unlock_at_pct: 33, text: "Compute the sum of the first k elements once — that is your first window and your initial best." },
        { unlock_at_pct: 66, text: "To slide from index i-1 to i, do window += nums[i] - nums[i-k]. Never re-sum the whole window." },
        { unlock_at_pct: 100, text: "After each slide, best = max(best, window). Loop i from k to len(nums)-1." },
      ],
      solution:
        "def max_window_sum(nums, k):\n    window = sum(nums[:k])\n    best = window\n    for i in range(k, len(nums)):\n        window += nums[i] - nums[i - k]\n        best = max(best, window)\n    return best\n",
    },
  },
  {
    lessonId: 18,
    title: "Drill: sorted squares (converging pointers)",
    content: {
      pattern: "two-pointer",
      prompt:
        "Given an integer array `nums` sorted in non-decreasing order (it may contain negatives), return the squares of each number, also sorted in non-decreasing order, in O(n) time. Use two pointers at the ends: the largest square always sits at one end. Fill the result array from the back.",
      target_seconds: 420,
      difficulty: "medium",
      language: "python",
      starter_code:
        "def sorted_squares(nums):\n    # TODO: two pointers l=0, r=len-1; compare abs(nums[l]) vs abs(nums[r]);\n    # write the larger square at the current back slot, then move that pointer inward.\n    pass\n",
      tests: [
        { id: "t_mixed", description: "negatives and positives interleave", assert: "assert sorted_squares([-4,-1,0,3,10]) == [0,1,9,16,100]" },
        { id: "t_negs", description: "all negative — reverses after squaring", assert: "assert sorted_squares([-7,-3,-1]) == [1,9,49]" },
        { id: "t_pos", description: "already non-negative", assert: "assert sorted_squares([1,2,3]) == [1,4,9]" },
        { id: "t_single", description: "single element", assert: "assert sorted_squares([-5]) == [25]" },
      ],
      hints: [
        { unlock_at_pct: 33, text: "The biggest square comes from whichever end has the larger absolute value — compare abs(nums[l]) and abs(nums[r])." },
        { unlock_at_pct: 66, text: "Build the result from the back: put the larger square at res[pos], then decrement pos." },
        { unlock_at_pct: 100, text: "Advance the pointer you consumed (l += 1 if you took the left, else r -= 1) and loop while l <= r." },
      ],
      solution:
        "def sorted_squares(nums):\n    n = len(nums)\n    res = [0] * n\n    l, r = 0, n - 1\n    pos = n - 1\n    while l <= r:\n        if abs(nums[l]) > abs(nums[r]):\n            res[pos] = nums[l] * nums[l]\n            l += 1\n        else:\n            res[pos] = nums[r] * nums[r]\n            r -= 1\n        pos -= 1\n    return res\n",
    },
  },
  {
    lessonId: 19,
    title: "Drill: last stone weight (max-heap)",
    content: {
      pattern: "heap",
      prompt:
        "You are given `stones`, a list of positive integer weights. On each turn take the two heaviest stones and smash them: if equal, both are destroyed; otherwise the lighter is destroyed and the heavier keeps weight (heavier - lighter). Return the weight of the last remaining stone, or 0 if none remain. Use a max-heap so each 'two heaviest' lookup is O(log n).",
      target_seconds: 480,
      difficulty: "medium",
      language: "python",
      starter_code:
        "import heapq\n\ndef last_stone_weight(stones):\n    # TODO: heapq is a MIN-heap, so negate every weight to simulate a max-heap.\n    # Each turn: pop the two largest, and push back their difference if nonzero.\n    pass\n",
      tests: [
        { id: "t_example", description: "classic worked example", assert: "assert last_stone_weight([2,7,4,1,8,1]) == 1" },
        { id: "t_one", description: "single stone survives untouched", assert: "assert last_stone_weight([3]) == 3" },
        { id: "t_equal", description: "two equal stones annihilate", assert: "assert last_stone_weight([2,2]) == 0" },
        { id: "t_two", description: "difference of the last pair", assert: "assert last_stone_weight([10,4]) == 6" },
      ],
      hints: [
        { unlock_at_pct: 33, text: "heapq is a min-heap. Push -w for every stone so the most-negative entry is the heaviest real stone." },
        { unlock_at_pct: 66, text: "Pop twice to get the two heaviest (both negative). With a <= b, the real difference is (-a) - (-b) = b - a; note a - b gives the negated difference directly." },
        { unlock_at_pct: 100, text: "If the two heaviest differ, push a - b back onto the heap. Loop while len(heap) > 1, then return -heap[0] if any stone remains else 0." },
      ],
      solution:
        "import heapq\n\ndef last_stone_weight(stones):\n    heap = [-w for w in stones]\n    heapq.heapify(heap)\n    while len(heap) > 1:\n        a = heapq.heappop(heap)\n        b = heapq.heappop(heap)\n        if a != b:\n            heapq.heappush(heap, a - b)\n    return -heap[0] if heap else 0\n",
    },
  },
];

function main() {
  const db = getDb();
  let inserted = 0;

  const insertAct = db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
       VALUES (?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const drill of DRILLS) {
      const { valid, errors } = validateCodeDrillContent(drill.content);
      if (!valid) {
        throw new Error(`drill for lesson ${drill.lessonId} invalid: ${errors.join("; ")}`);
      }

      // Idempotent: drop any prior drill on this lesson.
      db.prepare("DELETE FROM lesson_activities WHERE lesson_id = ? AND activity_type = 'code_drill'").run(
        drill.lessonId
      );

      // Normalise the tail so the drill can sit at sequence_order 4.
      const practice = db
        .prepare("SELECT id FROM lesson_activities WHERE lesson_id = ? AND activity_type = 'practice_code'")
        .get(drill.lessonId) as { id: number } | undefined;
      const assessment = db
        .prepare("SELECT id FROM lesson_activities WHERE lesson_id = ? AND activity_type = 'assessment'")
        .get(drill.lessonId) as { id: number } | undefined;
      if (!practice || !assessment) {
        throw new Error(`lesson ${drill.lessonId} missing practice_code or assessment`);
      }
      // Bump assessment first to avoid a transient unique collision on order.
      db.prepare("UPDATE lesson_activities SET sequence_order = 6 WHERE id = ?").run(assessment.id);
      db.prepare("UPDATE lesson_activities SET sequence_order = 5 WHERE id = ?").run(practice.id);

      insertAct.run(drill.lessonId, "code_drill", 1, 4, drill.title, JSON.stringify(drill.content));
      inserted += 1;
      console.log(`lesson ${drill.lessonId}: inserted code_drill "${drill.title}" (pattern ${drill.content.pattern})`);
    }
  });

  tx();
  console.log(`\nBackfilled ${inserted} code_drill activities.`);
  closeDb();
}

main();
