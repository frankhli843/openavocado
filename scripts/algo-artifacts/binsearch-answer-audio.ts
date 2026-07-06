/**
 * Hand-authored audio transcripts for the Binary Search on Answer lesson
 * (subject 9, seq 10). Two-host Socratic format: Leo teaches the template
 * for "binary search on the answer" (as opposed to binary search on an index),
 * and Maya pushes on WHY the approach works, WHERE monotonicity comes from,
 * and WHAT happens when the feasibility function is tricky. Content covers
 * the Koko Eating Bananas class (search on speed/capacity), the Split Array
 * Largest Sum class (search on the maximum allowed partition sum), and the
 * Magnetic Force / aggressive cows class (search on minimum gap, upper binary
 * search). No meta-authoring language, no banned phrases.
 */

// Top-level overview: >= 2700 words, stand-alone.
export const OVERVIEW_SCRIPT = `Leo: There is a whole family of problems where the answer is not hiding inside a sorted array. The answer IS the search space. You are not looking for a target in a list; you are looking for the smallest speed, or the minimum capacity, or the largest gap, and the set of possible answers forms a sorted range where one side is feasible and the other is not. That boundary is what you binary-search for, and the technique is called binary search on the answer.

Maya: That sounds abstract. Can you ground it with a concrete problem so I can see what "the answer is the search space" actually means?

Leo: Think of it like a thermostat dial. Imagine you are setting the temperature on a heater and you want to find the lowest setting where the room is warm enough. Below some threshold the room is too cold, above it every setting is warm enough. You do not need to try every degree; you can binary-search the dial. That is exactly what happens here, except the dial is the candidate answer. Take Koko Eating Bananas, because it is the cleanest example. You have an array of pile sizes, say three, six, seven, and eleven bananas. There are h hours total, and Koko eats at a fixed speed k bananas per hour. If a pile has fewer than k bananas she finishes it and waits for the next hour; she cannot start a second pile in the same hour. The question is: what is the minimum speed k such that she finishes all piles within h hours? Now notice what the search space looks like. The smallest possible speed is one banana per hour, and the largest useful speed is the biggest pile, because eating faster than that wastes nothing. Between those two endpoints, every speed is either fast enough or too slow, and once a speed is fast enough, every speed above it is also fast enough. That is the monotonicity that makes binary search work.

Maya: Why exactly is it monotonic? How do I know that if speed seven works then speed eight definitely works too?

Leo: Because eating faster can never take more hours. If Koko can finish at speed seven in eight hours, then at speed eight she finishes each pile in the same number of hours or fewer, because ceiling of pile size over eight is at most ceiling of pile size over seven for every pile. So the total hours at speed eight is at most the total hours at speed seven, which was at most h. That is the invariant: the feasibility function "can Koko finish in at most h hours at speed k" is false for small k and true for large k, and once it becomes true it stays true. You are searching for the leftmost true.

Maya: So does that mean every binary-search-on-the-answer problem has this same shape: a range of candidate answers where one end is infeasible and the other end is feasible, and you just need the boundary?

Leo: That is exactly the template, and you can break every problem in this family into three pieces. First, define the candidate range: what is the smallest possible answer and the largest possible answer? For Koko, one to the max pile. Second, write the feasibility function: given a candidate answer, can the problem be solved? For Koko, simulate eating and count hours. Third, binary-search the range: if the midpoint is feasible, search the left half for something smaller; if infeasible, search the right half. That three-piece decomposition is the entire technique.

Maya: How exactly do you implement the feasibility check for Koko, step by step?

Leo: You iterate through the piles and compute how many hours each pile takes: ceiling of pile size divided by k. Sum those hours. If the sum is at most h, the speed is feasible. The ceiling division avoids floating point: you compute it as open parenthesis pile plus k minus one close parenthesis integer-divided by k. One pass through the array, constant work per pile, so the feasibility check is order n where n is the number of piles, and the binary search calls it order log of the max pile times, giving a total of order n times log max pile.

Maya: What changes when the problem is not about minimizing but about maximizing? Take the Magnetic Force problem where you want to maximize the minimum distance between balls placed on a line.

Leo: Great question, because the direction flips. In Koko you search for the smallest feasible speed: start from one, go up, find the first one that works. In Magnetic Force you search for the largest feasible gap: start from the maximum possible gap, go down, find the last one that works. The monotonicity is reversed: small gaps are feasible (you can always place the balls closer together), large gaps become infeasible (not enough positions to maintain that spacing). So you are searching for the rightmost true, not the leftmost.

Maya: How does that change the binary search code? Is it a different template?

Leo: The mechanics are almost identical, with two small adjustments. First, you compute mid as lo plus hi plus one integer-divided by two, rounding up, to avoid the infinite loop where lo equals hi minus one and mid rounds down to lo forever. Second, when the midpoint is feasible you move lo up to mid instead of hi down to mid, because you want to keep the feasible side and push the boundary rightward. That is the upper binary search template. The feasibility check itself is a greedy scan: sort the positions, place the first ball at position zero, then walk through the sorted positions and place a ball whenever the gap from the last placed ball is at least the candidate distance. If you placed all m balls, the distance is feasible.

Maya: Can you go deeper on why the greedy placement works? What is the causal chain from greedy to optimal?

Leo: The greedy rule is: always place the next ball at the earliest position that satisfies the gap. The proof is an exchange argument: suppose the optimal placement puts a ball later than the greedy choice. You can slide that ball leftward to the greedy position without shrinking any gap, because the greedy position already satisfies the minimum distance from the previous ball, and moving it earlier can only increase the distance to the next ball. So greedy never does worse, and if greedy cannot place all m balls, then neither can any other placement, because greedy was as aggressive as possible about placing early. That is why it is a valid feasibility oracle for the binary search.

Maya: Let me switch to a harder variant. Split Array Largest Sum asks you to split an array into k contiguous subarrays so that the maximum subarray sum is minimized. How does that fit the template?

Leo: It fits perfectly once you reframe the question. Instead of asking "what is the optimal split," ask "can I split the array into at most k subarrays where no subarray exceeds a target sum?" That target sum is the candidate answer you binary-search on. The range of candidates goes from the maximum single element, because no subarray can be smaller than its largest member, up to the total sum, which is the answer when k is one. The feasibility function is a greedy left-to-right scan: start a new subarray, keep adding elements as long as the running sum stays at or below the target, and the moment the next element would push it over, close the current subarray and start a new one. If you needed at most k subarrays, the target is feasible.

Maya: Why exactly does the greedy scan give the right answer? What if a slightly different split used fewer subarrays?

Leo: The greedy scan maximizes the length of each subarray: it always extends the current one as far as it can before starting a new one. That means it uses the fewest possible subarrays for a given target. If greedy needs more than k, no other strategy can do it in k either, because any other strategy would start a new subarray earlier, using at least as many total. So greedy is the optimal way to spend a budget of k subarrays, which makes it a valid feasibility oracle. And the monotonicity is clear: if you can split with a max sum of fifty, you can certainly split with a max sum of fifty-one, because every subarray that was valid at fifty is still valid at fifty-one, so the number of subarrays only decreases.

Maya: What is the causal chain that prevents this family of problems from being solved greedily without binary search at all?

Leo: Because the greedy scan answers a different question. Greedy tells you "given a target, how many splits do I need," which is the feasibility check. But the original question is "given a number of splits, what is the minimum target." There is no direct greedy that outputs the target; you need the binary search to invert the relationship, turning a "can I do it for this target" oracle into "what is the best target." That inversion is the core insight of the whole technique: you have an efficient oracle for a yes-or-no version of the problem, and binary search turns it into an optimization.

Maya: So does that mean any optimization problem where I can write a monotonic feasibility checker can be solved this way?

Leo: That is the recognition rule. Whenever you see a problem that asks for the minimum or maximum of something, and you can write a function that says "is this candidate achievable" in polynomial time, and that function is monotonic in the candidate, you have a binary search on the answer. The hard part is the recognition, not the code. The code is the same three-piece template every time: define the range, write the feasibility function, binary-search.

Maya: Let me push on the Ship Packages variant. You have an array of package weights and d days. What is the minimum ship capacity to deliver all packages in order within d days?

Leo: That is structurally identical to Split Array Largest Sum. The candidate answer is the ship capacity. The range goes from the heaviest single package, because the ship must hold at least that, up to the total weight, which means shipping everything in one day. The feasibility function is the same greedy scan: load packages onto the current day until the next package would exceed the capacity, then start a new day. If you needed at most d days, the capacity is feasible. The monotonicity is the same: a bigger ship finishes in fewer days.

Maya: What changes if the elements are not contiguous, like Magnetic Force where you pick positions from a sorted set?

Leo: The structure of the binary search stays the same. What changes is the feasibility function. For contiguous splits the feasibility is a left-to-right greedy scan. For position selection the feasibility is a sorted greedy walk where you pick the earliest valid position. For something like "minimize the maximum distance to the nearest gas station when adding k new stations," the feasibility is a different calculation: for a candidate maximum distance d, count how many stations you need to insert so no gap exceeds d, and check if that count is at most k. Each problem has its own feasibility function, but the binary-search wrapper is identical.

Maya: How do I avoid the common off-by-one bugs in the binary search itself?

Leo: The most reliable approach is to commit to one of two templates and never improvise. Template one, lower binary search for the leftmost feasible: lo equals the range start, hi equals the range end, loop while lo is strictly less than hi, compute mid as lo plus hi integer-divided by two rounding down, if feasible at mid set hi to mid, else set lo to mid plus one, return lo. Template two, upper binary search for the rightmost feasible: same setup, but compute mid as lo plus hi plus one integer-divided by two rounding up, if feasible at mid set lo to mid, else set hi to mid minus one, return lo. The rounding-up in template two prevents the infinite loop. Pick the template that matches the problem, memorize it, and do not deviate.

Maya: What is the trap if you round down in the upper search?

Leo: If lo equals five and hi equals six, mid rounds down to five. If five is feasible you set lo to mid which is five, and the loop continues forever because nothing changed. Rounding up makes mid six, which either moves hi down or confirms lo. That one-character difference between lo plus hi over two and lo plus hi plus one over two is the entire off-by-one danger.

Maya: Let me ask about time complexity. For Koko the binary search runs log of the max pile iterations, each calling a linear feasibility check, giving n log max. Is there a problem in this family where the feasibility check is more expensive?

Leo: Yes. The gas-station problem has a feasibility check that scans all gaps, which is order n, so the total is n log of the answer range. But if the feasibility check were itself a DP or a sort, the total could be n squared log something or n log n log something. The key point is that the binary search contributes only a logarithmic factor on top of whatever the feasibility check costs, so the technique is efficient as long as the oracle is efficient.

Maya: What about floating-point answers? Some problems ask for a minimum distance as a real number, not an integer. How does that change the binary search?

Leo: Good catch, because that is a common variant. When the answer is a real number, like "minimize the maximum gap between gas stations after inserting k new stations," the search space is continuous. You cannot use lo less than hi as the stopping condition, because there is always a midpoint. Instead you loop a fixed number of iterations, say a hundred, or loop while hi minus lo is greater than some small epsilon like one over ten to the ninth. Each iteration still halves the range, so a hundred iterations give you precision to about one part in two to the hundredth, which is far more than any judge needs. The feasibility function is the same: for a candidate maximum gap d, count how many new stations you need so no existing gap exceeds d, and check if that count is at most k. The count for each gap g is ceiling of g over d minus one.

Maya: How does that counting work step by step? Say a gap between two existing stations is fifteen and the candidate d is four.

Leo: You need enough new stations so that the largest sub-gap is at most four. That takes ceiling of fifteen over four minus one, which is four minus one equals three new stations, splitting the gap of fifteen into four pieces of three point seven five each. The ceiling over d is how many segments you get, and you subtract one because the original gap already has two endpoints. Sum that across all gaps, and if the total is at most k, the candidate is feasible.

Maya: What about problems where negative numbers show up in the array? Does that break the technique?

Leo: It changes the range bounds but not the technique. For Split Array Largest Sum, if the array contains negatives, the lower bound is no longer the max element. It might be the max subarray sum, and the monotonicity could become tricky, because adding a negative number to a subarray can decrease its sum. The standard version of these problems assumes positive values, and most interview problems in this family do too. If you encounter negatives, pause and re-derive the monotonicity before coding, because a non-monotonic feasibility function breaks binary search silently, giving wrong answers without any obvious error.

Maya: Before we wrap, let me state the recognition rule one more time to make sure it is loaded. When I see an optimization problem that asks for the minimum or maximum of a number, I reframe it as a yes-or-no question: can I achieve this candidate? If the yes-or-no answer is monotonic in the candidate and the check is efficient, I binary-search the range of candidates.

Leo: That is the complete pattern. Define the range, write the feasibility function, binary-search. The same three-piece template solves Koko Eating Bananas, Split Array Largest Sum, Ship Packages Within D Days, Magnetic Force Between Two Balls, Minimize Max Distance to Gas Station, and dozens more. The recognition is the hard part; once you see that the answer itself is the search space, the code writes itself. And the real interview advantage is this: when everyone else is trying dynamic programming or greedy constructions that take twenty minutes to debug, you write three lines of binary search plus a simple feasibility function and move on in eight minutes. That speed advantage compounds when the interviewer throws a follow-up.`;

// Part 1 (Koko + Split Array: lower binary search, greedy feasibility): >= 200 words.
export const PART1_SCRIPT = `Leo: Start with the lower binary search template, because it covers the majority of problems in this family. Take Koko Eating Bananas: the candidate is the eating speed, the range is one to the maximum pile, and the feasibility function sums the ceiling divisions to count total hours.

Maya: Why use ceiling division instead of regular division?

Leo: Because Koko cannot eat half a banana in half an hour. If a pile has seven bananas and her speed is four, she eats four in hour one and three in hour two, not one point seven five hours. Ceiling of seven over four is two, which matches the integer reality. Compute it without floating point: pile plus speed minus one, all integer-divided by speed.

Maya: How exactly does Split Array Largest Sum use the same template?

Leo: The candidate is the maximum allowed subarray sum. Range: max element to total sum. Feasibility: greedy scan left to right, extend the current subarray until the next element would exceed the target, then start a new subarray. If the count of subarrays is at most k, the target is feasible. Same binary search wrapper, same lo-hi-mid pattern, different feasibility function.

Maya: What changes if I accidentally initialize lo to zero instead of max element?

Leo: Then a candidate of zero is tested, and the feasibility function loops forever or gives a wrong answer, because no subarray can have a sum of zero if the array has positive elements. The invariant is: lo must be a value where the problem statement makes physical sense. For Koko, zero bananas per hour means infinite time. For split array, a max sum below any single element means a single element cannot fit in a subarray. Always set lo to the tightest lower bound that is meaningful.

Maya: So does that mean the lower bound is always the maximum single element for these partition problems?

Leo: For contiguous partition problems with positive values, yes. The tightest lower bound is the largest element, because every subarray must contain it, and no subarray can have a sum smaller than its largest member. For Koko it is one, because zero speed is meaningless.`;

// Part 2 (Magnetic Force: upper binary search, greedy placement proof): >= 200 words.
export const PART2_SCRIPT = `Leo: Now the upper binary search template, for problems where you maximize instead of minimize. Magnetic Force gives you n positions on a line and asks: place m balls so the minimum distance between any two is as large as possible.

Maya: How exactly does the feasibility check work here?

Leo: Sort the positions. Place the first ball at position zero. Walk left to right: whenever a position is at least the candidate distance from the last placed ball, place a ball there. If you placed all m balls, the candidate distance is achievable. This is the greedy placement: always grab the earliest valid position.

Maya: Why does greedy give the correct answer and not some suboptimal placement?

Leo: Because placing a ball as early as possible never hurts. Suppose an optimal placement puts a ball later. Slide it left to the greedy position: the gap from the previous ball is still at least the candidate, and the gap to the next ball only gets larger. So greedy is at least as good as any alternative, which means if greedy fails, everything else fails too. That makes it a valid feasibility oracle.

Maya: What changes in the binary search code compared to the Koko template?

Leo: Two things. First, mid is computed as lo plus hi plus one integer-divided by two, rounding up. This prevents the infinite loop when lo and hi differ by one. Second, when the candidate is feasible you move lo up to mid, because you want to push toward larger values. When infeasible, hi moves down to mid minus one. The final answer is lo, which is the largest feasible candidate.

Maya: What is the range for this problem?

Leo: Lo is one, because two balls on adjacent positions have distance at least one if positions are distinct integers. Hi is the total span divided by m minus one, because m balls cannot be spread wider than the span allows. In practice, hi can be position-last minus position-first divided by m minus one.`;
