/**
 * Audio scripts for the Mixed Hard lesson (subject 9, seq 11):
 * "No Pattern Labels: Recognize, Articulate, Implement Under Pressure".
 *
 * Two-host Socratic format (Leo teaches, Maya asks). Three problems
 * presented without revealing their underlying technique. Frank must
 * recognize the pattern from the problem statement alone.
 *
 * Problem 1: Minimum Window Substring (LC 76) - sliding window
 * Problem 2: Task Scheduler (LC 621) - heap + greedy
 * Problem 3: Palindrome Partitioning (LC 131) - backtracking
 */

export const OVERVIEW_SCRIPT = `
Leo: Up to now, every lesson has told you the technique before you start. Today, the training wheels come off. You get three problems, and you have to figure out what you are looking at before you write a single line of code. No hints, no labels, just a problem statement and a clock.

Maya: So the hard part is not the algorithm itself. It is knowing which algorithm to reach for.

Leo: Exactly. In a real interview the problem never arrives with a label saying "this is sliding window" or "use a heap." You have to read the constraints, spot the shape, and name the technique yourself. That recognition step is where most people lose time, because they jump straight into coding before they have a plan.

Maya: How do you train that recognition instinct?

Leo: You build a mental checklist. When you see a problem, you ask a series of questions in order. Does the problem ask for a contiguous subarray or substring that satisfies some condition? That is probably a two-pointer or sliding-window problem. Does it ask for the maximum, minimum, or kth something that you need to access repeatedly? That is a heap. Does it want all combinations, all permutations, all partitions, every possible decomposition of a structure? That is backtracking or DFS.

Maya: And the three problems today each exercise one of those branches.

Leo: Right. But I am not going to tell you which one is which. You will see the problem, pause, think about which technique fits, and then confirm your guess before coding. The lesson checks your recognition as seriously as it checks your implementation.

Maya: Walk me through the recognition framework one more time, slowly.

Leo: Sure. Step one: read the problem fully. Do not skim. Step two: identify the output type. Are you returning a single number, a string, a list of lists, a boolean? Step three: look at the constraints. Array of length n up to ten to the fifth usually means O of n or O of n log n. String with characters from a small alphabet screams sliding window or hash map. "All possible X" or "every valid Y" means exponential search, backtracking. Step four: match the shape to a known template. If you cannot match it, go through your pattern library one by one, cheapest first: two pointer, sliding window, binary search, BFS or DFS, heap, DP, backtracking. Step five: once you have a candidate pattern, verify it against the examples. Can you trace through example one using that technique and get the right answer? If yes, start coding. If no, reconsider.

Maya: What if two patterns seem to fit?

Leo: Pick the simpler one first. If sliding window works, do not use DP. If a greedy approach with a heap gives you the right answer, do not build a graph. Interviews reward the cleanest correct solution, not the most clever one.

Maya: Let us start with the first problem then.

Leo: Problem one. You are given two strings, s and t. Find the minimum window in s that contains every character in t, including duplicates. If no such window exists, return the empty string. The constraint is that s can be up to a hundred thousand characters long, and t can be up to the same length. The alphabet is uppercase and lowercase English letters.

Maya: So I need to find the shortest substring of s that contains all characters of t.

Leo: Pause here. Before we go further, what technique would you reach for?

Maya: The problem says "substring," which means contiguous. I am looking for the shortest contiguous region that satisfies a coverage condition. That sounds like a sliding window with two pointers.

Leo: Good. Why not brute force all substrings?

Maya: Because s is up to a hundred thousand characters. Brute force is O of n squared times the cost to check coverage, so at least O of n squared. Sliding window gives me O of n because each character enters and leaves the window at most once.

Leo: Perfect recognition. The technique is sliding window with a character frequency map. You maintain a window between left and right pointers. You expand right to include more characters until the window contains everything in t. Then you shrink left to find the minimum valid window. You track how many characters are "satisfied" using a frequency counter and a match count. When the match count equals the number of distinct characters needed, the window is valid. You record the minimum, then shrink left and repeat.

Maya: What is the tricky part of the implementation?

Leo: Two things. First, the frequency accounting. You need a "need" map built from t and a "have" map built from the current window. A character is satisfied when have of that character is greater than or equal to need of that character. Second, the match count. You increment it when a character becomes satisfied and decrement it when it becomes unsatisfied after shrinking. Do not compare the entire maps on every step, that would make it O of n times alphabet size. Use the match count as a running tally.

Maya: Got it. And the complexity?

Leo: O of s plus t for time, O of the alphabet size for space. Each character in s is visited at most twice, once by right and once by left.

Maya: Moving on to problem two.

Leo: Problem two. You are given an array of tasks represented by characters, and a non-negative integer n representing the cooldown period between two same tasks. Return the minimum number of intervals the CPU takes to finish all tasks. Tasks can be done in any order, and each task takes one unit of time. In each interval, the CPU can either complete a task or sit idle.

Maya: So identical tasks must be separated by at least n intervals. I need the shortest schedule.

Leo: Pause. What technique?

Maya: The constraint is about scheduling with cooldowns. I want to minimize idle time. The most frequent task determines the minimum length, because it forces the most gaps. I would reach for a greedy approach, maybe with a heap to always pick the most frequent remaining task.

Leo: Good instinct. Why a heap?

Maya: Because at each step I want to schedule the task that has the most remaining count. That way I fill cooldown gaps as efficiently as possible. A max heap gives me the highest-frequency task in O of log k time, where k is the number of distinct tasks.

Leo: There is also a mathematical formula approach. The minimum time is the maximum of two values: the total number of tasks, and (max_frequency minus one) times (n plus one) plus the count of tasks that have max_frequency. The heap simulation confirms this formula.

Maya: Walk me through the formula.

Leo: Imagine the most frequent task appears f times. You need f minus one gaps of size n plus one between those occurrences, plus one final slot. That gives (f minus one) times (n plus one) plus one. But if multiple tasks share the max frequency, each one adds one to the last group. So the formula becomes (f minus one) times (n plus one) plus count_of_max. If the total number of tasks exceeds this formula, the answer is just the total tasks, because there is no idle time.

Maya: And the heap approach?

Leo: You put all task counts into a max heap. Each round, you pull up to n plus one tasks from the heap, decrement their counts, and push back any that still have remaining count. The number of rounds times the round size, minus the idle slots in the last round, gives the answer. Both approaches are O of n log k, but the formula is O of n plus k, which is cleaner.

Maya: Problem three.

Leo: Problem three. Given a string s, partition s such that every substring of the partition is a palindrome. Return all possible palindrome partitionings.

Maya: So I need every way to split the string into parts where each part reads the same forwards and backwards. "All possible" means I am enumerating, not optimizing.

Leo: Pause. What technique?

Maya: "Return all possible" is the backtracking signal. I need to explore every valid split point, and at each point, if the prefix is a palindrome, recurse on the suffix. When I reach the end of the string, I have found one valid partition.

Leo: That is textbook backtracking. What makes it efficient enough?

Maya: The string length is at most 16. The number of partitions is bounded by 2 to the power of n minus one, which for n equals 16 is about 32 thousand. Each partition check is O of n. So the total work is manageable.

Leo: There is an optimization: precompute a palindrome table using DP, so each isPalindrome check is O of 1 instead of O of n. The DP table dp of i comma j is true if the substring from i to j is a palindrome. Base cases: every single character, and every pair of matching adjacent characters. Then expand outward: dp of i comma j equals (s of i equals s of j) and dp of i plus one comma j minus one.

Maya: Then the backtracking just indexes into the table.

Leo: Exactly. At each position, you try every possible end index. If dp of start comma end is true, you add the substring to the current path and recurse from end plus one. When start equals the string length, you copy the path into the result.

Maya: So the three problems were sliding window, heap or greedy, and backtracking.

Leo: Yes. And the real lesson is not any one of those techniques, which you have already drilled individually. The lesson is the first thirty seconds of reading a new problem. Can you name the shape before you touch the keyboard? That is what separates a candidate who solves three problems in forty-five minutes from one who solves one.

Maya: The recognition checklist again: read fully, identify the output type, check constraints, match to a known template, verify against examples, then code.

Leo: And if you are stuck for more than two minutes on pattern recognition, verbalize to your interviewer. Say "I notice the problem asks for all valid partitions, which suggests a backtracking approach." Saying it out loud helps you commit and also shows the interviewer your thought process. That is worth more than a silent correct answer.
`;

export const PART1_SCRIPT = `
Leo: Let us focus on the sliding window implementation for Minimum Window Substring. The key insight is that you never need to reset the window to the beginning. Once the right pointer has passed a character, the left pointer only moves forward, never backward.

Maya: Because any valid window that starts further left would be larger, not smaller. So we only care about the rightmost left boundary that still satisfies coverage.

Leo: Exactly. You keep two dictionaries: "need," which counts how many of each character you require from t, and "window," which counts how many of each character are currently between left and right. You also keep a "formed" counter that tracks how many distinct characters in the window meet or exceed their required count.

Maya: When formed equals the number of distinct characters needed, the window is valid.

Leo: Right. And at that point you try to shrink from the left. Every time you remove a character from the window, you check if it drops below the needed count. If it does, formed decreases by one and the window is no longer valid, so you stop shrinking and go back to expanding right.

Leo: The sliding window template here is: expand right to satisfy the condition, then shrink left to minimize the window. Record the minimum valid window seen so far. This expand-then-shrink loop is the core of every sliding window problem.

Maya: What about edge cases?

Leo: Three main ones. First, if t is longer than s, return empty immediately. Second, if t contains duplicate characters like "AABC," you need to match each occurrence, not just the character types. Third, the problem asks for the actual substring, not its length, so you need to track the start index and length of the best window.
`;

export const PART2_SCRIPT = `
Leo: Now the backtracking for Palindrome Partitioning. The structure is a decision tree where each node represents a split point in the string.

Maya: At position i, I try every end position j from i to the end of the string. If the substring from i to j is a palindrome, I add it to the current path and recurse from j plus one.

Leo: The base case is when i equals the length of the string. At that point, the current path is a complete valid partition, so you copy it into the result list. You must copy, not reference, because the path mutates during backtracking.

Maya: And the backtracking step is to pop the last element from the path after the recursive call returns.

Leo: Yes. Choose, explore, un-choose. The palindrome check can be done inline with two pointers, but for strings up to length 16, precomputing the DP table is both cleaner and faster. The DP table is a two-dimensional boolean array where dp of i comma j means the substring s from index i to index j inclusive is a palindrome. You fill it for all lengths from one up to n.

Maya: The key optimization is that this precomputation turns every palindrome check from O of n into O of 1, so the bottleneck becomes the number of valid partitions, not the cost of checking each candidate.

Leo: Exactly. The number of valid partitions can be exponential, but for n equals 16, the total output is bounded and the solution runs in milliseconds.
`;
