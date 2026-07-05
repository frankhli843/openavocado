/**
 * Hand-authored audio transcripts for the Sliding Window lesson (subject 9).
 * Two-host Socratic format: Leo teaches the mechanism, Maya is a curious skeptic
 * who drills into why each move is safe and when it fails. No page-structure or
 * meta-authoring language (kept out to pass transcript-quality checks).
 */

// Top-level overview: >= 2700 words, stand-alone, teaches the whole pattern.
export const OVERVIEW_SCRIPT = `Leo: Let's start with a problem you have solved a hundred times with a nested loop, and let's make the nested loop disappear. Here is the setup. You have a row of numbers, say four, two, seven, one, nine, three, six, five. Someone asks: across every block of three neighbors in a row, which block has the largest total? The block four two seven totals thirteen. Slide over by one and you get two seven one, which totals ten. Slide again and seven one nine totals seventeen. Keep going to the end and report the biggest total you ever saw.

Maya: Right, and the obvious way is two loops. Pick a starting spot, add up the three numbers there, remember the best. That is a starting spot times three additions.

Leo: Exactly, and that is the thing I want to attack. If the row has n numbers and each block has k numbers, that double loop does roughly n times k additions. When k is small it feels fine. When k grows toward n, you are doing something close to n squared work. So the question I want you to sit with is not "how do I get the answer" — you already know that — it is "how much of that work am I repeating?"

Maya: When you say repeating, what exactly repeats? Each block is a different block.

Leo: Look at two neighbors in the process. The block four two seven, and the next block two seven one. Write them under each other and stare at the middle. The two and the seven sit in both. Only two things actually changed: the four on the left fell out, and the one on the right came in. The shared middle did not change at all, yet the double loop re-adds that middle from scratch every single time. That is the waste. You are paying, again and again, to re-add numbers that never left.

Maya: So the numbers in the overlap are being summed over and over even though they did not move.

Leo: That is the whole insight, and everything called sliding window grows out of it. Instead of throwing away the total when you move, you carry it with you and repair only the part that changed. Old total was thirteen. Slide right. Subtract the number that left, the four. Add the number that entered, the one. Thirteen minus four is nine, plus one is ten. That matches the honest re-sum of two seven one, but you touched exactly two numbers instead of three, and here is the part that matters: it is two numbers no matter how big the block is. If the block were five hundred wide, you would still subtract one leaving number and add one entering number. The cost per slide is constant. Over the whole row that is n steps of constant work, so you have turned roughly n times k into plain n.

Maya: Wait. You keep a single running total and edit its two ends as it moves. The window is imaginary — it is really just a total plus two boundary indices.

Leo: Yes, and hold onto that mental picture, because it is more honest than the word "window" suggests. There is no box in memory. There is a number you are maintaining, and an agreement about which stretch of the row that number currently describes. Sliding means: advance the right boundary to swallow a new element, advance the left boundary to release an old one, and adjust your running number so it stays truthful about the stretch between them.

Maya: Okay, but the size-three example is tidy because the window never changes size. Every real problem I hit does not say "exactly three." It says "the longest" or "the smallest" something. Does this trick survive that?

Leo: That is the fork in the road, and it splits sliding window into two families that feel different but share the same heartbeat. The first family is the fixed-size window, the one we just did: the width is pinned by the problem. Size k subarray, size k substring, exactly k elements. The left boundary simply trails the right boundary by a constant gap, and you slide them together in lockstep. The second family is the variable-size window, where the width is the answer itself, or the width flexes to keep some rule true. That is where "longest substring with no repeated character" or "smallest run of numbers that adds up to at least a target" live. The width breathes. It grows when it can and shrinks when it must.

Maya: Let's do a breathing one, because that is the part I do not trust. Give me the no-repeats problem.

Leo: Take the string a, b, c, a, b, c, b, b. You want the longest stretch with no repeated letter. Two boundaries again, both starting at the front, and a small memory of which letters are currently inside the stretch. The right boundary marches forward and tries to admit each new letter. a comes in, fine. b comes in, fine. c comes in, fine — the stretch a b c has length three, that is your best so far. Now the right boundary reaches the next a. But an a is already inside. If you admit it, your stretch has two a's and your rule is broken.

Maya: So you are stuck. You cannot just refuse the new letter, because then the right boundary never advances.

Leo: Right, and this is the move people miss. You do not refuse the newcomer. You make room for it by retreating the left boundary. You release the leftmost letter — the old a — and check again. Is there still a duplicate a? No. Now the new a fits, and your stretch is b c a, still length three. The right boundary keeps going. b tries to enter, but a b is inside, so you release from the left until it fits. And so on to the end. The best length you ever recorded is the answer.

Maya: Two things bother me. First, that inner "release from the left" is itself a loop. So haven't we just hidden a nested loop inside the outer one? Where did the savings go?

Leo: Beautiful question, and the answer is the most important idea in the whole topic. Look at where the two boundaries can go. The right boundary only ever moves forward. The left boundary only ever moves forward. Neither one ever backs up. Each of the n positions gets crossed by the right boundary exactly once, and gets crossed by the left boundary at most once. So the total number of boundary steps across the entire run is at most two times n, no matter how the shrinking is distributed. Some steps the window barely moves the left boundary; some steps it releases a big chunk. But summed over the whole pass, each index is admitted once and released at most once. That is why we call it linear even though there is an inner loop. You are not counting nested iterations, you are counting total pointer travel, and the travel is bounded.

Maya: That is the part I always got wrong on a whiteboard — I would see the inner while loop and blurt out n squared. The honest accounting is total movement, not loops inside loops.

Leo: That accounting has a name, amortized analysis, and sliding window is the cleanest place to first meet it. Any single slide might do a lot of shrinking, but the shrinking it does is shrinking no later slide can repeat, because those elements are gone for good. Cost you pay once, spread across the run.

Maya: Alright. Now I want the boundary of the pattern. When does this beautiful thing quietly betray me?

Leo: Two betrayals, and knowing them is what separates someone who memorized a template from someone who understands it. The first betrayal is non-contiguity. The whole method assumes the thing you care about is a contiguous stretch — neighbors in the row, adjacent letters in the string. The moment the problem lets you skip around and pick elements that are not next to each other, there is no window to slide, because releasing the left element is meaningless when the answer was never about a solid block. Subsequence problems, where you pick and choose non-adjacent items, are usually not sliding window; they lean toward dynamic programming.

Maya: So the first question I should ask a problem is literally: is the thing I want a solid, unbroken run?

Leo: That is the single best filter. Contiguous run, over an array or a string, where sliding one step changes only the two ends — that is the fingerprint. Now the second betrayal is subtler and it is the one that burns people in interviews. The shrink-when-you-overshoot logic only works when validity is monotonic in the window's size. Let me make that concrete with the "smallest run that sums to at least a target" problem. If every number is positive, then a wider window always has a bigger or equal sum. So once you are at or above the target you can safely shrink from the left to try to get smaller, and you never miss anything. Growing only helps the sum, shrinking only hurts it. That monotonic relationship is what makes the window trustworthy.

Maya: And if a negative number sneaks in?

Leo: Then the spell breaks. With a negative in the mix, making the window wider can lower the sum, and making it narrower can raise it. The comforting promise — bigger window, bigger sum — is gone. So when you shrink because you think you have enough, you might be discarding a negative that was actually dragging you down, and you make the wrong call. For sums with negative numbers you reach for a different tool, usually a running prefix total paired with a clever queue or a sorted structure. The lesson is not "sliding window is fragile." The lesson is that sliding window rides on a monotonic assumption, and your job before you write a line of code is to check that the assumption holds.

Maya: So recognition is really two checks stacked together. Is it a contiguous run, and does making the window bigger move my quantity in one consistent direction.

Leo: That is the entire recognition test, and it is worth more than any template. Let me give you the trigger phrases that should make your ears prick up, because in interviews you get these in plain English. "Subarray" or "substring" — that word alone means contiguous, which is half the fingerprint. "Of size k," "of length k," "exactly k" — that is the fixed family, left trails right by k. "Longest," "shortest," "maximum," "minimum" followed by "such that some condition holds" — that is the variable family, the window breathes to keep the condition. "At most k distinct," "no more than," "containing all of" — those are conditions you check as the window changes.

Maya: Give me the shape of the code so I have something for my hands, not just my head.

Leo: For the fixed family the shape is: build the first window honestly by adding the first k elements, record its measure, then walk the right boundary from k to the end, and at each step add the entering element and subtract the element that is now k behind it, and update your best. Two edits and a comparison per step. For the variable family the shape is: a left boundary starting at the front, a right boundary that sweeps the whole row in a single loop, and inside that loop you first admit the new right element into your running state, then, while your window violates the rule, you release the left element and advance the left boundary, and after the window is valid again you record the answer if it is better. One outer sweep, an inner release that is bounded in total, and a running state that you update at both ends.

Maya: The running state — that is the piece that changes per problem, isn't it? Sometimes it is a sum, sometimes a set of letters, sometimes a count of how many distinct things are inside.

Leo: Precisely, and that is the last thing I want you to carry. The skeleton is fixed — two boundaries, expand right, shrink left, record. What you swap per problem is the bookkeeping that answers "is my window still valid?" and "what is my window's measure right now?" For no-repeats it is a set of the letters inside, and validity is "the newcomer was not already in the set." For at-most-k-distinct it is a small tally of how many of each letter you hold, and validity is "the number of distinct letters is at most k." For sum-at-least-target it is a running total and validity is "the total is still below target, keep growing." Learn to see those two questions and you can rebuild any sliding-window solution from the skeleton without memorizing dozens of separate templates.

Maya: Trace one more variable window for me with real numbers, the smallest-run-summing-to-at-least-a-target one, because I want to see the shrink actually pay off.

Leo: Take the numbers two, three, one, two, four, three, and a target of seven — find the shortest contiguous run whose sum reaches at least seven. Two boundaries at the front, a running total of zero. The right boundary admits two, total two, below seven, keep growing. Admit three, total five, still below, grow. Admit one, total six, still below, grow. Admit two, total eight, now we are at or above seven for the first time — the run two three one two has length four and sum eight. Record length four as our current best, then try to get smaller by releasing from the left.

Maya: So the instant you clear the target you stop growing and start shrinking.

Leo: You shrink as long as you stay legal. Release the leftmost two: total drops to six, which is below seven, so that shrink went too far and we stop shrinking and let the right boundary grow again. Admit four, total ten, comfortably above seven, and the run is three one two four, length four. Now shrink hard: release three, total seven, still at least seven, length three — better than four, record three. Release one, total six, below target, stop. Grow: admit three, total nine, run two four three, length three. Shrink: release two, total seven, still enough, length two — that is the winner, the run four three sums to seven with only two elements.

Maya: And every one of those shrinks was safe because the numbers were positive, so dropping a left element could only lower the total, never secretly raise it.

Leo: That is the monotonic assumption doing its quiet work in the background. Each release either keeps you legal, in which case you found something shorter, or drops you below target, in which case you stop and grow again. You never overshoot into a wrong answer, and every element enters once and leaves once, so it is still one linear sweep.

Maya: So if I only remember one sentence from all of this?

Leo: Remember that a window is a running answer with two moving ends, and sliding is the art of repairing that answer at the ends instead of rebuilding it from scratch — and it is only legal when the thing you want is a contiguous run whose validity changes in one steady direction as the window grows. Get those two boundaries moving forward and never backward, keep your bookkeeping honest at both ends, and the nested loop you started with collapses into a single clean pass.

Maya: That actually reframes it for me. I was treating window problems as a bag of memorized tricks. They are one trick — carry the answer, fix the ends — wearing different bookkeeping each time.

Leo: That is exactly the shift, and once it clicks you will start spotting the fingerprint in problems that never say the word window at all. Contiguous run, steady direction, two ends you repair. That is sliding window, and it is one of the highest-leverage patterns you can own for a coding interview.`;

// Part 1 (fixed-size window) per-part audio.
export const PART1_SCRIPT = `Leo: Let's slow down and live inside the fixed-size window, because the mechanics here are the foundation for everything else. Numbers four, two, seven, one, nine, three, six, five, and we want the largest total over any three in a row. First we pay full price exactly once: four plus two plus seven is thirteen. That thirteen is now a thing we own, and we refuse to ever rebuild it from scratch.

Maya: So the first window is the only one where you do the full addition.

Leo: The only one. Every window after that is a repair, not a rebuild. Slide one step to the right. The four on the left falls out of the window, so subtract four. The one on the right enters, so add one. Thirteen minus four plus one is ten, and that is the honest total of two seven one — we can check it, two plus seven plus one really is ten, but we got it with a subtract and an add instead of three additions.

Maya: And the reason that is worth it is that the two and seven in the middle never got re-touched.

Leo: Right, the overlap is carried for free. Slide again: subtract the two that leaves, add the nine that enters, ten minus two plus nine is seventeen — a new best. Keep going to the end, always subtract the leaver, add the enterer, compare to your best. The work per slide is one subtraction, one addition, one comparison, and crucially that never grows with the window's width. A window of size three and a window of size three hundred both cost the same per step, because both change exactly one element on each side.

Maya: So the complexity story is: one full pass to set up, then a constant amount of work at each of the remaining positions.

Leo: Which is linear in the length of the row. Compare that to the double loop that re-adds k numbers at every start — that one grows with both the number of positions and the window width. The fixed window trades that product for a single clean sweep. Watch the left boundary and the right boundary move together, a fixed gap apart, like two people carrying a table down a hallway, and the running total riding on top, edited only at the seams.`;

// Part 2 (variable-size window) per-part audio.
export const PART2_SCRIPT = `Leo: Now the window learns to breathe. In the fixed case the two boundaries marched in lockstep. In the variable case the right boundary leads, greedily reaching forward, and the left boundary only steps in when a rule is about to break. Take the string a, b, c, a, b, c, b, b, and the goal of the longest stretch with no repeated letter.

Maya: And you keep some memory of what is currently inside the stretch.

Leo: A set of the letters between the two boundaries. The right boundary admits a, then b, then c — the set is a, b, c, the stretch has length three, that is our best so far. The right boundary reaches the next a, but a is already in the set. Admitting it would put two a's inside and break the no-repeat rule. So instead of refusing the newcomer, we retreat the left boundary: remove the leftmost a from the set, step the left boundary forward, and now there is room. The new a joins, the stretch becomes b, c, a, still length three.

Maya: Here is my worry again. That "remove from the left" is a loop inside the loop. Why is this not quadratic?

Leo: Because of where the boundaries can go. The right boundary only moves forward, once across the string. The left boundary only moves forward, and it can never pass the right boundary. So across the entire run, the left boundary takes at most as many steps as there are letters. Each letter is admitted once and released at most once. Add those up and you get travel bounded by twice the length, which is linear. The inner loop is real, but its total work over the whole sweep is capped, not multiplied.

Maya: So I should stop counting nested loops and start counting how far each pointer travels in total.

Leo: That is the mental correction that makes variable windows click. Total pointer travel, not loops-within-loops. And the validity question — "is my window still legal?" — is the only thing that changes between variable-window problems. Here it is "was the new letter already inside?" For an at-most-k-distinct problem it would be "do I hold more than k different letters?" Same skeleton: expand right, shrink left while illegal, record when legal. Only the bookkeeping between the boundaries changes.`;
