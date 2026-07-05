/**
 * Hand-authored audio transcripts for the Heap / Priority Queue lesson (subject 9).
 * Two-host Socratic format: Leo teaches the mechanism, Maya is a curious skeptic
 * who drills into why each move is safe and when it fails. No page-structure or
 * meta-authoring language (kept out to pass transcript-quality checks).
 */

// Top-level overview: >= 2700 words, stand-alone, teaches the whole pattern.
export const OVERVIEW_SCRIPT = `Leo: Let's start with a question you have answered the slow way many times: as numbers keep arriving, tell me the smallest one still in play — and keep telling me, even as I add more and remove the ones you have handed back. If you keep the numbers in a plain list, finding the smallest is a full scan every time, and doing that again and again is where the cost piles up. The heap exists to make that one recurring question — give me the extreme — cheap.

Maya: So the setting is not a single "find the minimum," which I could do in one pass. It is "find the minimum over and over while the data keeps changing." That repetition is the whole point.

Leo: Exactly, and hold onto that distinction, because it is the number one recognition mistake. If you only need the smallest once, just scan — a heap is overkill. The heap earns its keep when "give me the best remaining" is a question you ask repeatedly as items come and go. Think of a hospital waiting room where the most urgent patient is always seen next: new patients arrive, the most urgent leaves, and at every moment you need whoever is now most urgent. That is a priority queue, and a heap is how you build one efficiently.

Maya: Okay, so what actually is a heap? When I picture one I get vague — is it a tree, is it an array, is it sorted?

Leo: Great, let me pin all three down because the confusion is common. A binary heap is a tree in your imagination and an array in memory, and it is emphatically not fully sorted. The rule — the heap invariant — is local, not global. In a min-heap, every parent is less than or equal to its two children. That is the only promise. It says nothing about left-versus-right siblings, nothing about cousins. So the very smallest element is forced to bubble to the top, the root, but the rest are only loosely arranged. A heap is a tournament where the champion is known but the full ranking is not.

Maya: So the root is the minimum, guaranteed, but if I asked for the second-smallest I could not just read it off?

Leo: Right, and that is a subtlety worth its own beat. The second-smallest must be one of the root's two children — it cannot hide deeper — but which of the two, you do not know without looking. So a heap answers "what is the extreme" in constant time by reading the root, but it deliberately does not maintain a full sort, and that laziness is exactly why it is fast. Now here is the elegant part: we store this tree without any pointers. Put the root at array index zero. For any node at index i, its left child sits at 2i plus 1 and its right child at 2i plus 2, and its parent is at i minus 1 divided by two, rounded down. The tree structure is pure arithmetic on indices.

Maya: That is clever — no node objects, no left and right pointers, just index math. But then how do the two operations, adding and removing, keep that parent-child promise true?

Leo: Two little repair routines, and they are mirror images. To insert, you drop the new value at the very end of the array — the next open leaf — and then sift it up. You compare it to its parent; if it is smaller, you swap them, and you keep swapping upward until it is no longer smaller than its parent or it reaches the root. Because the tree's height is about log n, you do at most log n swaps. To remove the minimum, you take the root — that is your answer — then move the last element into the root slot and sift it down. You compare it to its two children, swap it with the smaller child if it is out of order, and keep going down until it settles. Again, at most log n swaps.

Maya: Wait, let me make sure I see why removal moves the LAST element to the top. That feels arbitrary. Why not promote a child?

Leo: Beautiful question, because the reason is structural. The array must stay a compact, gap-free tree — every level full, left to right — or the index arithmetic breaks. If you promoted a child to the root, you would tear a hole somewhere in the middle and the neat 2i-plus-1 formula would no longer point at real nodes. Moving the last element keeps the shape perfect; it just temporarily violates the value ordering, which the sift-down then repairs. Shape stays valid the whole time, ordering is fixed in log n steps. That is the trade that makes it all work.

Maya: So both insert and remove are log n. What about building a heap from a pile of n numbers all at once — is that n times log n?

Leo: You would think so, and the naive way is exactly that. But there is a classic surprise: if you have all n elements up front, you can heapify in place in O(n) linear time, not n log n. The trick is to sift down starting from the lowest internal nodes upward. Most nodes are near the bottom and sift down only a step or two; only the few near the top can travel far. When you sum that up carefully, the total is linear. It is a lovely result and a common interview follow-up, so it is worth remembering that bulk-building beats inserting one at a time.

Maya: Alright, mechanism clear. Now the practical wrinkle — in Python I reach for heapq. Anything I should watch out for?

Leo: One thing burns everyone, so let me say it loudly: Python's heapq is a min-heap only. There is no max-heap flag. If you want the largest instead of the smallest, the standard move is to push the negated value and negate again when you pop. So to track the maximum, you store minus the number, and the heap's smallest negated value corresponds to the largest real value. Miss that and you will confidently pull the wrong extreme — a bug that passes on a symmetric test and dies on a real one. The other gotcha is that heapq gives you push and pop and a peek at index zero, but it does not support efficiently removing an arbitrary element in the middle; for that people use lazy deletion, which we can touch on later.

Maya: Good, so min-heap by default, negate for max. Now the payoff — what problems does this actually unlock? Give me the families.

Leo: There are four jobs a heap does better than anything else, and recognizing them is the skill. The first is top-k or k-th largest, which is so important it gets its own deep treatment: you keep a heap capped at size k and stream everything through it. The second is merging sorted streams — merge k sorted lists is the poster child. You keep one element from each list in the heap, pop the global smallest, and push the next element from whichever list it came from. The heap always holds the current frontier across all lists, so each output costs one log-k pop and push. The third is scheduling by priority: a task scheduler, meeting rooms, anything where you repeatedly pull the most urgent item and push updated work back — the heap is the ready queue. The fourth is any running-extreme problem, like a streaming median, which you solve with two heaps facing each other, a max-heap for the lower half and a min-heap for the upper half.

Maya: Let me slow down on the top-k one because it is the one I always fumble. If I want the k largest numbers, my gut says use a MAX-heap. But you keep hinting it is a min-heap. Why on earth a min-heap for a largest question?

Leo: This inversion is the single most useful heap trick, so let me build the intuition carefully. You want the k largest out of a long stream. Keep a min-heap that you never let grow past size k. Push each incoming number. The moment the heap has k plus one elements, pop the smallest. Think about what that does: the smallest of your current candidates is always the one on the chopping block, sitting right at the root where you can evict it in one step. What survives is the k largest seen so far. And here is the payoff for the exact question "k-th largest": the root of that size-k min-heap is the smallest of the k largest, which is precisely the k-th largest. A max-heap would put your biggest value at the root, but you do not want to evict the biggest — you want to evict the smallest of the winners, so a min-heap puts the right element in the firing line.

Maya: Oh. So the min-heap's root being the weakest survivor is a feature — that is the guy you compare each newcomer against, and the guy you drop. The size cap is what makes it k-th largest instead of just the minimum.

Leo: You have it exactly. And notice the cost. Sorting everything to grab the top k is n log n. The size-k heap is n log k, because every operation touches a heap of size k, not n. When k is small and n is huge — the top ten trending items out of a billion events — that is a massive win, and it uses only O(k) memory instead of holding all n. That memory point matters for streaming data you cannot fit at once.

Maya: Before the failure modes, walk me through the merge-streams job a bit more — how exactly does one heap merge several sorted lists without ever scanning them all?

Leo: Picture three sorted lists laid side by side. You do not need to look at every element to know the global smallest; you only need the front of each list, because each list is already sorted. So you put just those fronts into the heap — one representative per list — and each heap entry remembers which list it came from and where. Pop the global minimum; that is the next element of your merged output. Then push the next element from that same list, because its front just advanced. The heap never holds more than the number of lists, so if there are k lists and N total elements, each of the N outputs costs one log-k pop and push. That is N log k, far better than concatenating everything and sorting.

Maya: So the heap is a little window showing only the current front of each stream, and popping one just pulls that stream forward by one. Why does that guarantee the output comes out sorted?

Leo: Because at every step the true global minimum among all remaining elements must be one of the current fronts — nothing behind a front can be smaller than it in a sorted list. The heap always contains those fronts, so its root is always the correct next element. Induction does the rest: each pop is right, so the whole sequence is right.

Maya: Let me push on the running-median one too, because two heaps facing each other sounds fiddly. How does that actually stay balanced?

Leo: This is my favorite composite, so let me build it. You want the median of numbers as they stream in. Keep two heaps: a max-heap holding the smaller half and a min-heap holding the larger half. The max-heap's root is the biggest of the small side; the min-heap's root is the smallest of the large side. Those two roots straddle the middle. If the two halves are equal in size, the median is the average of the two roots; if one half has one extra element, its root is the median. The work is keeping them balanced: after each insert you may move one element from one heap's root to the other so their sizes differ by at most one.

Maya: So what changes when a new number arrives — how do you decide which heap it joins?

Leo: You compare it to the max-heap's root. If it is smaller or equal, it belongs to the lower half, so push it there; otherwise it belongs to the upper half. Then you rebalance if one heap has grown two ahead of the other by popping its root and pushing it onto the other. Every step is a couple of log n heap operations, so you get the running median in log n per element instead of re-sorting the whole history each time. It is two of the same tool pointed in opposite directions, and the negation trick is what lets you build that max-heap in a min-heap-only library.

Maya: Now the part I care about most — when does reaching for a heap go wrong? Where does it betray me?

Leo: Several honest failure modes, and knowing them is what separates understanding from memorizing. First, do not use a heap when a single scan suffices. If the question is "what is the maximum" asked exactly once, scanning is O(n) and simpler than building a heap; the heap only pays off on repetition. Second, a heap does not give you a sorted list for free, and it does not support "find or delete this specific value in the middle" efficiently — it only knows about the extreme. If you need arbitrary lookups, you want a balanced search tree or a hash map, not a heap. Third, watch the min-versus-max negation bug we discussed; it is the most common real mistake. Fourth, in scheduling problems where a task's priority changes while it sits in the heap, a plain binary heap cannot cheaply update it, so people use lazy deletion — you leave the stale entry in place and skip it when it pops — or a more advanced indexed heap.

Maya: That lazy-deletion idea you mentioned — how exactly does it rescue a scheduling heap when a task's priority goes stale?

Leo: The problem is that a binary heap cannot reach into its middle and update or remove a specific entry cheaply. So instead of fighting that, you cheat: when a task changes, you push a fresh entry with the new priority and leave the old, stale one sitting in the heap. When a stale entry eventually pops to the top, you recognize it as outdated — usually by checking it against a separate record of the current truth — and you simply discard it and pop again. You pay a little extra memory for the ghosts, but every operation stays log n, and you never have to search the heap's interior. That is lazy deletion, and it is the pragmatic escape hatch for priority changes.

Maya: So the recognition checklist is: am I asking for the extreme repeatedly as data changes, and is k or the number of streams small enough that a heap beats re-sorting or re-scanning. If it is a one-shot extreme, or I need full ordering, or arbitrary search, the heap is the wrong tool.

Leo: That is the discipline in one breath, and it is worth repeating. A heap is the tool for "give me the best remaining, again and again, while the set changes." Its root is the champion in constant time; its insert and remove are log n because they repair one root-to-leaf path; its array-with-index-math representation needs no pointers; and its killer application is the size-k trick where a min-heap of the k largest answers k-th-largest in n log k time and O(k) space. Reach for it when the extreme question recurs, negate when you need the max, cap the size when you want top-k, and walk away when a single scan or a fully sorted structure is what the problem actually wants.

Maya: So it is not "use a heap whenever I see the word largest." It is "use a heap when I need the extreme repeatedly and the working set I must keep is small," and the size-k min-heap is the sharpest version of that idea.

Leo: That is exactly right, and if you carry those four jobs, the min-heap inversion, and those failure modes into the exercises, the heap stops being a mysterious data structure and becomes a single clear question you know how to recognize and answer fast.`;

// Part 1 (heap mechanics): >= 200 words, two-host, layered.
export const PART1_SCRIPT = `Leo: Let's make the mechanism concrete. A min-heap is a tree in your head, an array in memory, with one promise: every parent is at most its children. The root is the minimum. For a node at index i, its children live at 2i plus 1 and 2i plus 2 — pure index math, no pointers.

Maya: So the smallest is guaranteed at the root, but the rest are only loosely ordered. Why does that looseness make it fast rather than broken?

Leo: Because we never pay to fully sort. To insert, drop the new value at the end and sift it up: compare with its parent, swap if smaller, repeat until it fits. The tree height is about log n, so at most log n swaps.

Maya: And removing the minimum — why move the LAST element to the root instead of promoting a child?

Leo: To keep the tree's shape gap-free so the index formula stays valid. Take the root as your answer, move the last element into the root slot, then sift it down: swap with the smaller child until it settles. Shape stays perfect, ordering is repaired in log n steps.

Maya: What is the classic bug here?

Leo: In Python, heapq is a min-heap only — there is no max flag. If you want the largest, push the negated value and negate on the way out. Forget that and you pull the wrong extreme, a mistake that hides on a symmetric test.

Maya: So the invariant is local, the operations repair one path, and the representation is just arithmetic.

Leo: One promise, two mirror-image repairs, log n each.`;

// Part 2 (size-k min-heap top-k trick): >= 200 words, two-host, layered.
export const PART2_SCRIPT = `Leo: Now the sharpest heap trick: the k largest values from a long stream, using a MIN-heap capped at size k. Push each incoming number; the instant the heap exceeds k, pop the smallest.

Maya: My gut says a MAX-heap for a largest question. Why is a min-heap the right choice?

Leo: Because you want to evict the WEAKEST survivor, not the strongest. The smallest of your current candidates sits at the min-heap's root, right where you can drop it in one step. What remains is always the k largest seen so far.

Maya: So the root being the weakest is the feature. And for the exact question "k-th largest," what do I read off?

Leo: The root itself. The root of a size-k min-heap is the smallest of the k largest — which is precisely the k-th largest. A newcomer only survives if it beats that root.

Maya: Why is this cheaper than just sorting everything and taking the top k?

Leo: Sorting is n log n. Every heap operation here touches a heap of size k, not n, so the whole pass is n log k, and it holds only O(k) elements in memory. When k is small and n is huge, that is an enormous win on both time and space.

Maya: And the trap?

Leo: Reaching for a MAX-heap on instinct — it puts the biggest at the root, but the biggest is exactly the one you never want to evict, so you would drop winners and get a wrong answer.

Maya: So min-heap, size cap k, root is the k-th largest.

Leo: The inversion is the whole idea.`;
