/**
 * Hand-authored audio transcripts for the Monotonic Stack lesson (subject 9).
 * Two-host Socratic format: Leo teaches the mechanism, Maya is a curious skeptic
 * who drills into why the amortized cost is linear and when the pattern fails. No
 * page-structure or meta-authoring language (kept out to pass transcript-quality).
 */

// Top-level overview: >= 2700 words, stand-alone, teaches the whole pattern.
export const OVERVIEW_SCRIPT = `Leo: Let's start with a problem that feels like it must be quadratic. You are given a row of numbers and for each one you want the next number to its right that is strictly larger than it. The obvious approach is: for every position, scan rightward until you find something bigger. That is a loop inside a loop, and on a sorted-descending input it is genuinely n squared. The monotonic stack is the pattern that collapses that nested scan into a single left-to-right pass, and the whole trick lives in one disciplined rule about what you allow to sit on a stack.

Maya: So this is another "turn nested loops into one pass" story, like sliding window was. But a window slid a range; what is actually on the stack here, and how does that end up staying sorted while I scan?

Leo: Great link, and the contrast is exactly right. A sliding window kept a contiguous range; a monotonic stack keeps a subset of elements you have seen but not yet resolved, and it keeps them in sorted order at all times. Monotonic just means the values on the stack are always increasing from bottom to top, or always decreasing from bottom to top — you pick one direction and never let it be violated. The instant a new element would break that order, you pop the offending elements off first, and here is the key: each pop is not wasted work. Each pop is the moment you finally resolve the answer for the element being popped.

Maya: That last sentence is the part I want to slow down on. Why is the moment of popping exactly the moment an answer becomes known? What does the arriving element tell me about the one I'm popping?

Leo: Let me make it concrete with the next-greater problem and a decreasing stack. As you scan left to right, you push indices whose answers are still open. You keep the stack decreasing in value: bottom is the largest still-waiting number, top is the smallest. Now a new number arrives. If it is bigger than the number on top of the stack, then by definition it is the next greater element for that top number — it is the first thing to its right that beat it. So you pop the top and record the arriving number as its answer. You keep popping while the new number beats the top, because it is the next greater for every one of those waiting numbers. Then you push the new number, because its own answer is still open. The arrival is a witness: it settles the accounts of everyone smaller that was waiting.

Maya: So the stack is a queue of unfinished business, ordered so that the first to get settled is always the one on top. Picture help me here — is there an everyday image for "waiting until someone taller walks by"?

Leo: Here is the one I use. Imagine people standing in a line, each looking to the right for the first person taller than them. A short person can be "seen past" — a taller person behind them blocks their view forever. So you keep a stack of people whose taller-neighbor is still unknown, and crucially that stack is always in decreasing height from bottom to top, because if someone shorter is standing behind someone even shorter, the front one already had their view blocked. When a tall newcomer walks up, everyone on the stack shorter than the newcomer just found their answer — the newcomer — so they leave the stack. Everyone still taller than the newcomer stays, still waiting. The newcomer joins the back. Each person joins once and leaves once.

Maya: That image makes me suspicious about cost, though. Every arrival can trigger a whole cascade of pops. How is that not quadratic again — what changes across the whole run that stops one element from popping the entire stack every single time?

Leo: This is the heart of why the pattern is beautiful, and it is an amortized argument. Look at the total number of pushes and pops across the entire run, not the worst single step. Every element is pushed onto the stack exactly once. Every element can be popped off the stack at most once, because once it is gone it never comes back. So across the whole scan, the total pop work is bounded by n, no matter how the cascades are distributed. Yes, one particular arrival might pop five elements — but those five will never be popped again, so they cannot contribute to any future step. Push once, pop at most once: two n operations of stack work, plus the n of the outer loop, so the whole thing is linear. The nested-looking while loop is a lie about the real cost.

Maya: So the while loop can run many times on one step but few times overall. That is the same accounting as the amortized cost of a dynamic array doubling. Let me push on the direction choice — you said decreasing stack for next-greater. When would I want an increasing stack instead, and how do I decide?

Leo: The direction is dictated by what event resolves an answer. Ask: what kind of arriving element settles the business of a waiting element? For next greater, a larger arrival resolves smaller waiters, so you keep the stack decreasing and pop when the newcomer is bigger. For next smaller, a smaller arrival resolves larger waiters, so you keep the stack increasing and pop when the newcomer is smaller. The rule of thumb: you pop an element the moment the arriving element is the answer you were looking for on its behalf. Flip the comparison, and you flip the monotonic direction. Most bugs here come from mixing up strict versus non-strict — whether you pop on greater, or on greater-or-equal — and that choice decides how ties are handled, so you must think about whether equal values should resolve each other.

Maya: Ties deciding correctness is a good warning. Let me change problems entirely. The largest rectangle in a histogram is famous for a monotonic-stack solution, but there is nothing about "next greater" there. How does the same machine solve an area problem — what does a pop mean in that world?

Leo: This is where the pattern shows its real reach, and the shift is what a pop resolves. In the histogram you keep a stack of bar indices with increasing heights. While a new bar is shorter than the bar on top of the stack, that top bar can never extend any further right — the shorter newcomer walls it in. So you pop it, and at that instant you can compute the largest rectangle that uses the popped bar as its limiting height: its height times its width. The height is the popped bar's height; the width runs from just after the new element on the stack below it, up to just before the current position. So the pop does not record "the next greater element" — it records "the widest rectangle bounded by this bar's height." Same skeleton, but the pop now settles a geometric fact instead of a neighbor.

Maya: Wait, how exactly do I get the width at the moment of the pop? I can see the height is just the popped bar, but the left and right edges confuse me — can you go deeper on where those two edges come from?

Leo: The stack gives you both edges for free, and that is the elegant part. When you pop a bar, the element now exposed just below it on the stack is the nearest bar to the left that is strictly shorter than the popped bar — because the stack was increasing, everything between them was taller and already popped. The current scanning position is the nearest bar to the right that is shorter — that is precisely why you are popping right now. So the rectangle of the popped bar's height stretches from one past that left neighbor to one before the current index. The width is current index minus the new stack top minus one. If the stack becomes empty after the pop, the bar extended all the way to the left edge, so the width is just the current index. A classic trick is to append a sentinel bar of height zero at the very end, which forces every remaining bar to be popped and measured, so you do not need a separate cleanup loop.

Maya: The sentinel is a nice touch — it means the same loop body handles the leftovers. Does that same "append a flushing sentinel" idea generalize, or is it special to histograms?

Leo: It generalizes to any monotonic-stack problem where elements can be left unresolved at the end. In next-greater, elements still on the stack when the scan finishes simply have no greater element, so their answer stays the default — often negative one — and you need no sentinel because "no answer" is a valid outcome. But whenever every element must be measured or flushed, you push a boundary value that is guaranteed to trigger the pop condition for everything left: a zero-height bar for histograms, or positive infinity, or an index-marking end cap. It is the same idea as a guard node in a linked list — a fake element whose only job is to make the general case handle the boundary so you write one loop, not two.

Maya: Let me try a harder cross-over. Trapping rain water over a bar chart also has a monotonic-stack solution. That is neither "next greater" nor "largest area" cleanly — so what does a pop resolve there, and does the same accounting still hold?

Leo: Trapping rain water is the best integrator because it fuses both ideas. You keep a decreasing stack of bar indices. When a taller bar arrives, it can form a basin with whatever is below the bar you are about to pop. So you pop the low bar — call it the floor of a puddle — and if there is still a bar left on the stack, that is the left wall; the arriving bar is the right wall. The water trapped in that horizontal layer is the width between the walls times the height of the shorter wall minus the floor's height. You keep popping and adding layers while the arrival keeps exceeding the top. So a pop resolves one horizontal slab of water, bounded left and right by the two walls the stack hands you. And yes, the same amortized argument holds untouched: each bar is pushed once and popped once, so it is still linear even though you are now summing areas instead of finding neighbors.

Maya: You keep saying "store indices," not the heights themselves. What is the causal chain there — how does that one choice ripple through the rest of the code?

Leo: Trace it forward and you will never store raw values again. Start from the fact that at a pop you need three things: the popped element's own value, the position of the exposed neighbor below it, and the current scanning position. If the stack holds indices, all three are one lookup away — the value is the array indexed by the popped index, the left boundary is the neighbor index still on the stack, and the right boundary is the loop counter. Now suppose instead you stored raw values. You still recover the popped value directly, but the two boundaries are gone: a value does not tell you where it lived, so you cannot compute a width, a distance, or a wait-time. You would have to keep a parallel stack of positions anyway, which is strictly worse than just storing the index and reading the value through it. So the chain is: widths and distances require positions, positions require indices on the stack, therefore store indices and dereference for values. The only time you can get away with raw values is a pure next-greater-value query where you never measure a distance — and even then, indices cost nothing and keep the code uniform.

Maya: That settles it — indices are the default and values are the rare shortcut. So across all three — next greater, largest rectangle, trapping water — the constant is "a pop resolves the answer for the popped element, and the neighbor on the stack plus the current index give me its boundaries." What changes between them?

Leo: Exactly that constant is the pattern, and only three things vary. First, the direction of monotonicity — increasing or decreasing — which you pick from what arrival resolves a waiter. Second, what you compute at the moment of a pop — a neighbor's value, a rectangle's area, a slab of water. Third, whether you store indices or raw values on the stack — you almost always store indices, because indices let you recover both the value and the distance for width computations, whereas values alone throw the positions away. Get those three decisions right and the loop body writes itself: while the stack is non-empty and the invariant would break, pop and resolve; then push the current index.

Maya: Let me name the failure modes so I recognize them under interview pressure. Where does this go wrong?

Leo: Four traps. One: storing values when you needed indices, so you cannot compute a width — always default to indices. Two: the strict-versus-equal comparison, which silently mis-handles duplicate values; decide up front whether equal elements resolve each other. Three: forgetting the leftovers — either failing to leave a sensible default for elements never popped, or forgetting the flushing sentinel when everything must be measured. Four: reaching for a monotonic stack when the problem does not actually have this "nearest element that breaks a monotonic relation" shape — if there is no notion of a waiting element getting resolved by a later arrival, the stack has nothing to do, and you probably want a different tool like a heap or a plain sort. The monotonic stack is razor-specific: it answers "for each element, what is the nearest thing to one side that is bigger, or smaller, or that walls it in?" When you hear that shape, reach for it; when you don't, don't force it. And a subtle fifth trap: scanning the wrong direction. Next-greater-to-the-right wants a left-to-right pass, but next-greater-to-the-left, or a problem that looks backward, wants you to scan right-to-left instead — the stack machine is identical, only the loop direction flips, so always confirm which side the question is actually asking about before you write the loop.

Maya: Let me say the whole thing back. A monotonic stack holds unresolved elements in sorted order. As I scan once, a new element that would break the order triggers pops, and each pop is the moment the popped element's answer becomes known, with its boundaries read off the exposed stack neighbor and the current index. Push once, pop at most once, so the whole scan is linear despite the inner while loop. I choose increasing or decreasing by what arrival resolves a waiter, I store indices so I can measure widths, I handle leftovers with a default or a sentinel, and I watch the strict-versus-equal comparison for ties.

Leo: That is a complete and correct summary, and the two things I would underline are the amortized argument and the pop-resolves-the-answer framing. The amortized argument is what gives you the confidence to write a while loop inside a for loop without fearing quadratic blowup. And "a pop resolves the answer" is the lens that lets you carry one mechanism across next-greater, histograms, and rain water, instead of memorizing three unrelated tricks. Decide the direction, decide what a pop computes, store indices, cap the boundary — and a whole family of "nearest bigger or smaller" problems becomes one repeatable move.

Maya: So it is not three clever hacks. It is one machine — keep the unresolved in order, and let each newcomer settle the accounts of everyone it dominates — pointed at three different questions.

Leo: That is exactly it. One stack, one invariant, one linear pass, and a pop that always means "your answer just arrived."`;

// Part 1 (Next Greater Element / decreasing monotonic stack): >= 200 words.
export const PART1_SCRIPT = `Leo: Let's ground the pattern on the cleanest problem: for each number, find the next strictly greater number to its right, or report that none exists. The brute force scans right from every position, which is quadratic. The monotonic stack does it in one pass.

Maya: What do I actually put on the stack, and in what order?

Leo: Store indices whose answers are still open, and keep them so the values are strictly decreasing from bottom to top. As you scan left to right, before you push the current index, look at the top of the stack. While the current value is greater than the value at the top index, the current element is that top element's next greater — so pop it and record the current value as its answer. Keep popping while the current value keeps beating the new top.

Maya: Why does one arrival get to resolve several waiting elements at once?

Leo: Because the stack is decreasing, everyone on it that is smaller than the newcomer has been waiting for exactly this: the first larger thing to their right. The newcomer is that thing for all of them, so they all resolve now and leave. Then you push the current index, since its own next-greater is still unknown.

Maya: And the ones still on the stack at the end?

Leo: They never found anything larger, so their answer stays the default of negative one. Push once, pop at most once, so the whole scan is linear even with the inner while loop.`;

// Part 2 (Largest Rectangle in Histogram / increasing stack + width): >= 200 words.
export const PART2_SCRIPT = `Leo: Now the same machine solves an area problem: the largest rectangle you can draw inside a histogram of bar heights. Here you keep a stack of bar indices with increasing heights, and a pop no longer resolves a neighbor — it resolves the widest rectangle limited by the popped bar's height.

Maya: Why increasing this time, and what triggers a pop?

Leo: You pop when a new bar is shorter than the bar on top. A shorter bar walls the top bar in on the right — it can extend no further — so this is the moment to measure the biggest rectangle that uses that bar as its limiting height. Because the stack was increasing, the element exposed just below the popped bar is the nearest shorter bar to the left, and the current position is the nearest shorter bar to the right.

Maya: So how exactly do I compute the width at the pop?

Leo: The width runs from just past that left neighbor to just before the current index: current index minus the new stack top minus one. If the stack is empty after popping, the bar reached the far left, so the width is just the current index. The area is the popped height times that width, and you track the maximum.

Maya: What about bars still on the stack when the scan ends?

Leo: Append a sentinel bar of height zero at the end. It is shorter than everything, so it forces every remaining bar to be popped and measured in the same loop — no separate cleanup pass. One pass, each bar pushed once and popped once, linear time.`;
