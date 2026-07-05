/**
 * Hand-authored audio transcripts for the Dynamic Programming REACTIVATION lesson
 * (subject 9, seq 7). Two-host Socratic format: Leo frames DP as four decisions
 * and drives execution speed; Maya is a skeptic who already learned DP years ago
 * and drills into why each recurrence is correct and where the fill order bites.
 * This is a speed-reactivation lesson, not a first-teach, so the framing assumes
 * the concept is known. No page-structure or meta-authoring language (kept out to
 * pass transcript-quality).
 */

// Top-level overview: >= 2700 words, stand-alone, reactivates the whole pattern.
export const OVERVIEW_SCRIPT = `Leo: This lesson is different from the weak-pattern ones. You have solved a hundred dynamic programming problems before — the imported evidence shows longest-increasing-subsequence, knapsack, and general DP as some of your most-practiced tags. So we are not teaching DP from scratch. We are reactivating it: rebuilding the speed to write the right recurrence from memory in under two minutes, because in an interview the bottleneck is never "do I understand DP," it is "can I recall the exact state and transition fast enough to code it calmly."

Maya: Good, because I do remember DP, but honestly it comes back slowly. When I see a new problem I know it is DP, and then I stall on what the array should even mean. So what is the actual reactivation drill — what do I rehearse until it is automatic?

Leo: Four decisions, every single time, in the same order. One: name the state — decide what one cell of your table means, in a sentence, like "dp of i is the length of the longest increasing subsequence ending exactly at index i." Two: write the recurrence — how that cell is built from strictly smaller cells. Three: pick the fill order — you must compute every cell a recurrence depends on before you compute the cell itself. Four: set the base case — the smallest subproblems whose answers you know outright. State, recurrence, order, base case. If you can say those four out loud for a problem, the code is basically already written.

Maya: That is a clean checklist. But why does naming the state so precisely matter — what changes if I am sloppy and just say "dp is the answer up to i"?

Leo: Everything downstream breaks, and this is the single most common reason a DP stalls. A vague state makes the recurrence ambiguous. Take longest increasing subsequence. If you say "dp of i is the best answer using the first i elements," you cannot write a clean transition, because that state does not pin down whether element i is used, so you do not know what you are allowed to append to. The instant you sharpen it to "dp of i is the length of the longest increasing subsequence that ends exactly at index i," the recurrence falls out: look at every earlier j where nums j is less than nums i, and extend the best of those by one. A precise state is what makes the transition forced instead of guessed. So the discipline is: never write a recurrence until the state sentence is exact, including the word "ending at" or "using exactly" or "with the last item being."

Maya: How exactly does that precision give me the transition for something like Kadane's maximum subarray? That one is so short I always suspect I am missing why it is correct.

Leo: Kadane is the purest case, so let us be exact. State: best-here of i is the maximum sum of a contiguous subarray that ends exactly at index i. Because it must end at i, element i is definitely included, and the only freedom is whether the run before it is worth keeping. So the recurrence is best-here of i equals the max of two choices: start a brand new run at i, which is just nums i alone, or extend the best run ending at i minus one, which is best-here of i minus one plus nums i. You take whichever is larger. The global answer is the maximum best-here over all i, because the optimal subarray has to end somewhere. That "ends exactly at i" phrasing is what forces the two-way choice; without it you would not know you are allowed to throw away the earlier run.

Maya: So does that mean the whole trick is that a negative running sum should just be abandoned? I want the causal chain from the recurrence to that intuition.

Leo: Yes, and trace it precisely. best-here of i minus one plus nums i beats nums i alone exactly when best-here of i minus one is positive. So the moment your running best-here goes negative, extending it can only drag the next element down, and the max picks "start fresh" automatically. That is the causal chain: the recurrence compares extend versus restart, restart wins precisely when the accumulated run is negative, therefore a negative prefix is discarded. You do not add a special reset rule — it is already inside the max. And because best-here of i depends only on best-here of i minus one, you do not even need an array; two scalars and one pass, constant space. That is the reactivation target: recognize maximum-subarray, and your hand writes the two-line loop without deliberation.

Maya: Before we leave the general picture, give me a mental image for what dynamic programming even is, because "reactivation" only works if I have something to reload into. What is the one metaphor that ties Kadane, knapsack, and the rest together?

Leo: Think of a spreadsheet. Every dynamic programming solution is really a grid of cells you fill in, where each cell's formula references only cells you have already computed — cells above it or to its left, never below or to the right. The state is what one cell means. The recurrence is the formula you type into a cell. The fill order is the direction you drag the fill handle so that every referenced cell already has a number in it. And the base cases are the cells you type literal values into by hand before any formula runs. Kadane is a spreadsheet one cell wide — a single running column. Knapsack is a two-column-by-many-row grid you collapse to one column. Coin change is a single row you fill left to right. Once you see it as "a grid where each cell only looks backward," the whole family stops feeling like separate tricks.

Maya: I like that, and it explains why fill order is not optional. Is there a second image for the reactivation part specifically — for why the skill comes back slowly and how to speed it up?

Leo: Here is the one I use, and it is exact. Reactivating a stale pattern is like a musician relearning a piece they played years ago. You have not forgotten the music — you can hum it, you know how it goes — but your fingers stumble because the muscle memory has faded. You do not relearn the theory; you replay the piece slowly, a few bars at a time, until the fingers remember. Drilling knapsack and coin change back to back is exactly that: you already know the harmony, so you rehearse the fingering — the loop bounds, the sweep direction, the base case — until the recurrence flows out at tempo. That is why we drill in contrasting pairs rather than reading explanations: the gap is speed, not understanding, and speed only comes back through reps.

Maya: Let me push to a table now. Knapsack is where I always slow down, specifically the loop direction. What changes between the two-dimensional table I first learned and the one-dimensional rolling version everyone codes under time pressure?

Leo: This is the highest-value thing to reactivate, so let us go carefully. The honest state is two-dimensional: dp of item-i and capacity-w is the best value using only the first i items within weight budget w. The transition for item i is a clean either-or: skip it, which is dp of i minus one and w, or take it if it fits, which is dp of i minus one and w minus weight-i, plus value-i. You keep the larger. Now, notice the entire right-hand side reads only from row i minus one — the previous item's row. That is the structural fact that lets you collapse the table to a single one-dimensional array that you overwrite in place, one item at a time.

Maya: And that collapse is exactly where the loop direction stops being cosmetic. Why does the one-dimensional version have to sweep capacity from high to low?

Leo: Because the single array is doing double duty as both row i minus one and row i, and you must protect the old values you still need to read. When you compute dp of w you read dp of w minus weight-i. If you sweep capacity from low to high, that lower cell dp of w minus weight-i would already have been updated for the current item, so you would be adding item i on top of a value that already includes item i — you would use the item twice. Sweeping from high to low, the lower cell you read has not been touched yet this pass, so it still holds the previous item's value, and the item is used at most once. That single loop-direction choice is the entire difference between zero-one knapsack and the unbounded, reuse-allowed variant.

Maya: So the reuse-allowed problems flip that on purpose. Does that mean coin change, where I can use a coin any number of times, deliberately sweeps low to high?

Leo: Exactly, and seeing them as one machine with a flipped loop is the reactivation payoff. Coin change minimum: state is dp of amount a equals the fewest coins that sum to a. The recurrence over each coin c is dp of a equals the min of its current value and dp of a minus c plus one. And you sweep the amount from low to high precisely because you want dp of a minus c to already include the current coin — that is what lets a coin repeat. Same table shape as knapsack, same read-a-smaller-cell transition, opposite sweep direction. Zero-one iterates the budget descending to forbid reuse; unbounded iterates ascending to allow it. If you drill just that one contrast, half of the interview DP table problems collapse into a single remembered move.

Maya: That contrast is the thing I will actually rehearse. Let me go back to subsequences, because longest increasing subsequence has two solutions and I can never remember why the fast one is correct. What is the second version doing?

Leo: The order-n-squared version is the straightforward one: dp of i is the length of the longest increasing subsequence ending at i, filled by scanning all earlier j and extending the best compatible one, and the answer is the max cell. The order-n-log-n version is a different idea entirely, called patience. You keep an array called tails, where tails of length k minus one is the smallest possible value that could end an increasing subsequence of length k. You scan the numbers, and for each one you binary-search the first tail that is greater than or equal to it and overwrite that slot; if the number is bigger than every tail, you append it, growing the longest length by one. The length of tails at the end is the answer.

Maya: What changes in my confidence about correctness — why does overwriting a tail not corrupt the answer?

Leo: Because tails is not a real subsequence, it is a set of best-case endings, and keeping each length's ending as small as possible can never reduce a future length. When you overwrite tails at some position with a smaller value, you are saying "there is now a length-k subsequence that ends even lower, so it is easier to extend later." You never shorten any achievable length; you only make future extension easier or equal. Appending, meanwhile, only happens when the number beats every tail, which genuinely proves a new longest length exists. So the length is always exactly the longest increasing subsequence, even though the tails array itself is not one. Picture a row of card piles in the game of patience: each new card goes onto the leftmost pile whose top is at least as big, and the number of piles you end up with is the longest increasing run. That is literally what the binary search into tails is doing — finding the leftmost pile the card can cap. For reactivation, I would code the order-n-squared version by reflex because it is bulletproof, and keep the patience version ready for when the interviewer asks to beat quadratic.

Maya: One more on longest increasing subsequence, because the two versions confuse me on cost. Why does the quadratic one exist at all if the patience one is strictly faster — is there any reason to reach for it first?

Leo: Yes, and it is a reactivation judgment call, not a correctness one. The quadratic dp-ends-at-i version is far easier to modify. The moment the problem is not plain "increasing" — say you must also reconstruct the actual subsequence, or the comparison is a custom two-dimensional dominance like the envelopes problem, or ties are handled a special way — the dp-ends-at-i version bends to it with a one-line change, because every cell is an explicit length you can trace back through. The patience tails version is faster but rigid; reconstructing the sequence from it takes extra bookkeeping. So the reflex is: write the quadratic one first because it is bulletproof and adaptable, state out loud that it is order n squared, and only switch to patience tails if the interviewer explicitly pushes for sub-quadratic. That is exactly the kind of speed-versus-flexibility trade you want reloaded, so you are not silently rederiving it at the whiteboard.

Maya: Let me name the traps so I catch them under pressure. Where do reactivated DP solutions actually go wrong?

Leo: Four traps, and they are almost never about the concept. One: the fill order — computing a cell before the cells it depends on, or the knapsack sweep direction backwards, which silently allows or forbids reuse incorrectly. Two: base cases and boundaries — an empty input, a target of zero, the first row or column of a table; these are where off-by-one and index-out-of-range live. Three: an imprecise state that makes the transition ambiguous, which we already saw is the number one staller. Four: an unreachable answer left as a sentinel — in coin change, if dp of the amount is still infinity at the end, you must return negative one, not the infinity, and you must guard the comparison so infinity plus one does not overflow into a real-looking number. None of these are "I forgot how DP works." They are execution details, and execution speed and accuracy on those details is exactly what reactivation drills.

Maya: Let me say the whole thing back to make sure it is reloaded. Every DP is four decisions: name the state as a precise sentence, write the recurrence from strictly smaller cells, pick a fill order that respects dependencies, and set the base cases. Kadane is a running scalar with an extend-or-restart max. Zero-one knapsack is a rolling array swept high to low so each item lands once. Coin change is the same array swept low to high so coins repeat. Longest increasing subsequence is dp-ends-at-i in quadratic time, or a patience tails array with binary search in n log n. And the bugs are fill order, base cases, vague states, and unreachable sentinels — not the idea itself.

Leo: That is a complete reload, and the two things to underline are the state sentence and the loop direction. The precise state sentence is what converts "I know it is DP" into an actual recurrence in seconds. And the loop direction — descending for use-once, ascending for reuse — is the single distinction that unifies knapsack and coin change into one remembered machine. Reactivation is not relearning; it is making those two reflexes fast enough that the DP part of an interview costs you thinking about the problem, not thinking about the technique.

Maya: So the goal is not to understand DP again. It is to make the four decisions so automatic that recognizing the shape and writing the recurrence happen almost together.

Leo: That is exactly it, and it is worth saying plainly one last time. Name the state as a precise sentence, write the transition from strictly smaller cells, fix the fill order so dependencies come first, and seed the base case — four moves, drilled in contrasting pairs until they are one fluent motion, and the whole stale-but-learned pattern is back at full interview speed.`;

// Part 1 (Kadane / Maximum Subarray, 1D running DP): >= 200 words.
export const PART1_SCRIPT = `Leo: Start with the purest 1D DP: maximum subarray, Kadane's algorithm. The state is one scalar — best-here at i is the largest sum of a contiguous run that ends exactly at index i. Because it must end at i, element i is always included; the only choice is whether to keep the run before it.

Maya: So what is the recurrence, exactly?

Leo: best-here of i is the max of two options: start fresh at i, which is nums i alone, or extend the previous run, which is best-here of i minus one plus nums i. Take whichever is larger. The answer to the whole problem is the maximum best-here over every index, because the optimal subarray ends somewhere.

Maya: And the intuition about negatives?

Leo: It falls straight out of the max. Extending beats starting fresh only when the previous best-here was positive. The moment your running sum goes negative, extending can only hurt, so the max picks "start fresh" on its own — you never write a reset rule, it is already inside the comparison.

Maya: Why no array?

Leo: Because best-here of i depends only on best-here of i minus one, you carry two scalars — the running best-here and the global best — and make one pass. That is O(n) time and O(1) space. Recognize maximum-subarray and your hand writes the two-line loop without stopping to think.`;

// Part 2 (0/1 Knapsack, rolling 1D array + descending sweep): >= 200 words.
export const PART2_SCRIPT = `Leo: Now the table shape everyone slows down on: 0/1 knapsack. The honest state is two-dimensional — dp of the first i items and capacity w is the best value under that weight budget. The transition for item i is either-or: skip it, dp of i minus one at w, or take it if it fits, dp of i minus one at w minus its weight, plus its value. Keep the larger.

Maya: Why can that collapse to one dimension?

Leo: Because the whole right-hand side reads only the previous item's row. So you keep a single array and fold in one item at a time, overwriting in place.

Maya: And the loop direction everyone gets wrong?

Leo: You must sweep capacity from high to low. When you compute dp of w you read dp of w minus the item's weight. Going high to low, that lower cell has not been updated this pass, so it still holds the value from before this item — the item is used at most once. Sweep low to high instead and that cell would already include the current item, so you would use it twice.

Maya: Which is exactly the unbounded variant?

Leo: Exactly. 0/1 knapsack sweeps the budget descending to forbid reuse; the unbounded coin problem sweeps ascending to allow it. Same array, same read-a-smaller-cell transition, opposite direction. It is O(items times capacity) time and O(capacity) space.`;
