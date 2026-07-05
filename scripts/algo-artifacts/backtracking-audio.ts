/**
 * Hand-authored audio transcripts for the Backtracking lesson (subject 9).
 * Two-host Socratic format: Leo teaches the mechanism, Maya is a curious skeptic
 * who drills into why each move is safe and when it fails. No page-structure or
 * meta-authoring language (kept out to pass transcript-quality checks).
 */

// Top-level overview: >= 2700 words, stand-alone, teaches the whole pattern.
export const OVERVIEW_SCRIPT = `Leo: Let's start with the feeling you get when a problem says "find all the ways," or "every valid arrangement," or "return each combination that adds up to the target." Your first instinct might be nested loops, but the number of loops you would need is not fixed — it depends on the input — so you cannot write them out. That is the exact signal for backtracking. Backtracking is the disciplined way to explore every possible sequence of choices, one choice at a time, so that you generate all the valid full answers without ever writing an unknown number of nested loops.

Maya: So the trigger is not "find the best answer" but "find or count all the answers." That already feels different from the greedy or dynamic-programming problems, where I usually want a single optimal number.

Leo: That is a sharp distinction to hold onto. Greedy and dynamic programming usually collapse a huge space down to one optimum. Backtracking, by contrast, is about walking the whole space of possibilities in an organized way — enumerating subsets, permutations, board arrangements — where you genuinely need each valid configuration, or need to count them, or need to find one that satisfies a hard constraint. The mental model is a tree of decisions. Picture standing at the root of a tree where every branch is one choice you could make right now, and every path from the root down to a leaf is one complete candidate answer.

Maya: A tree of decisions. Can you make that concrete? What are the branches for something simple, like all the subsets of the list one, two, three?

Leo: Perfect example, and let me build the tree out loud. Start at the root with an empty collection and consider the numbers left to right. At the first level you decide about the number one: one branch includes it, one branch skips it. At the second level, whatever you did with one, you now decide about two the same way. At the third level you decide about three. Every root-to-leaf path is a distinct sequence of include-or-skip decisions, and there are two choices at each of three levels, so eight leaves — exactly the eight subsets, from the empty set to the full set one-two-three. Backtracking is just a depth-first walk of that tree.

Maya: So it is depth-first search wearing a different hat. But if it is just DFS, why does the word "backtracking" get its own name? What is the extra idea the name is pointing at?

Leo: The name points at the single most important move: when you finish exploring one branch, you undo the choice that led into it before you try the next branch. That undo is the backtrack. Here is the analogy I like. Imagine walking a hedge maze while unspooling a ball of string behind you. You walk forward down a corridor making turns; each turn is a choice. When you hit a dead end, you do not teleport — you walk back along your string, rewinding exactly the steps you took, until you reach the last spot where an untried path branches off, and you take that one instead. The string is your state, and rewinding it is backtracking. Without the rewind you would carry the dead-end corridor's footprints into the next attempt and get a corrupted path.

Maya: I like the string, but tell me what "the state" actually is in code, because that is where I would get burned. What am I literally undoing?

Leo: Usually you are undoing a mutation to a shared partial answer. The standard shape is a single list you carry down the recursion, call it the path, that holds the choices made so far. The template has three beats that repeat at every node. First, choose: append the current option to the path. Second, explore: recurse to go one level deeper with that choice in place. Third, un-choose: pop the option back off the path so the list is exactly as it was before you tried that option. Choose, explore, un-choose. That pop is the rewind of the string. If you forget it, the path keeps growing with stale choices and every later branch is polluted.

Maya: So the bug I should fear is forgetting the un-choose step. What does that failure actually look like when it happens — how would I recognize it in my output?

Leo: You would see answers that are too long, or that contain elements you thought you had moved past, because the path never shrank back. A close cousin of that bug is recording the answer by reference instead of by value. When you reach a complete candidate and want to save it, you must save a copy of the path — a snapshot — not the path list itself. If you store the live list, then your later choose and un-choose operations mutate the very thing you already saved, and at the end every saved answer looks identical, usually empty, because the path was emptied out as the recursion unwound. Snapshot on record, undo on the way back up: those two habits kill the two classic backtracking bugs.

Maya: Got it — copy when I record, pop when I return. Now, subsets had a clean include-or-skip tree. How does the shape change for something like all permutations of one, two, three, where order matters and I use each number exactly once?

Leo: The tree gets wider and the constraint moves inside it. For permutations, at each level you are not deciding include-or-skip on one fixed element; you are choosing which unused element goes into the next position. So at the root you have three branches — place one, or two, or three. Down the "place two" branch, the next level offers only one and three, because two is now used. You track usedness with a simple boolean array, one flag per element, and the loop at each node skips any element whose flag is set. Choose becomes: mark the element used and append it. Un-choose becomes: pop it and clear the used flag. When the path length equals the input length, you have a full permutation, so you snapshot it. Same three beats, just with a "used" marker guarding the choices.

Maya: So the marker is how I stop reusing an element. That raises the question of cost. How many nodes am I actually walking, and why is backtracking sometimes described as slow or even dangerous?

Leo: This is the honest heart of it. Backtracking explores a tree whose size is often exponential or factorial in the input, because that is genuinely how many answers exist. Subsets of n elements: two to the n of them. Permutations of n: n factorial. There is no way to enumerate two to the twenty subsets in a handful of steps, because there are over a million of them. So the danger is not that backtracking is inefficient relative to the answer — it usually visits work proportional to the number of answers it must produce — the danger is that people reach for it when the problem does not actually want every configuration. If a problem asks only for the count of ways, or the best single arrangement, dynamic programming can often fold the exponential tree into a polynomial table by reusing overlapping subproblems. Backtracking has no such memory; it walks the whole tree. So reach for it when you truly need to enumerate, or when the constraints are so irregular that no clean formula or table exists.

Maya: That word "constraints" keeps coming up. In subsets and permutations every leaf is a valid answer, so I visit the whole tree. But something like placing queens on a chessboard sounds different — most arrangements are illegal. How does backtracking exploit that?

Leo: This is where backtracking earns its keep, and the key idea is pruning. In the queens problem you place one queen per row and, at each row, you try each column. But before you recurse into a column, you check whether that square is attacked by a queen you have already placed. If it is, you do not even enter that branch — you skip it entirely. That is pruning: cutting off an entire subtree the instant you can prove nothing valid lives inside it. Pruning is what turns a hopeless brute force into something that finishes. Instead of generating every arrangement and filtering at the end, you reject bad partial states as early as possible, so you never waste time exploring the enormous subtree beneath an already-doomed placement.

Maya: So pruning is a partial-answer check done early rather than a full-answer check done late. Why does checking early matter so much more than it sounds — is it not the same test either way?

Leo: It is the same logical test, but the timing changes the cost by orders of magnitude, and here is the causal chain. If you only check validity at the leaves, then a single bad choice near the root still forces you to walk its entire subtree — every leaf below it — before you discover the whole branch was doomed from the start. If instead you check the moment you make that bad choice, you delete the entire subtree from your search in one step. Near the top of the tree a single early rejection can erase a colossal fraction of the work, because the subtree it kills is the biggest. That is why experienced people push every constraint check as high up the recursion as they legally can: the earlier you prune, the more you save.

Maya: Let me test the boundary. Is there a version of combination sum, where I pick numbers that add up to a target, where pruning shows up naturally?

Leo: Yes, and it is a clean one. Say you want every combination of candidate numbers that sums to a target, and you may reuse a number. Sort the candidates first. As you walk, you carry the remaining amount still needed. At each node you loop over candidates from your current position onward. The prune is: if a candidate is already larger than the remaining amount, then because the list is sorted, every later candidate is larger too, so you stop the loop entirely — no point trying any of them. You also stop cleanly when the remaining amount hits exactly zero, which is a complete answer to snapshot. Sorting plus "break when it overshoots" is a tiny amount of code that removes a huge amount of doomed exploration.

Maya: I noticed you said "from your current position onward" for combinations, but for permutations you looped over everything and used a used-array. Why the difference — what changes that makes one use a start index and the other a marker?

Leo: Excellent catch, and the difference is exactly whether order matters. For combinations and subsets, the set one-two is the same as two-one, so you must not generate both. The trick to avoid duplicates is a start index: once you have moved past an element, you never look back at it, which forces every combination to come out in a fixed increasing order and guarantees each is produced once. For permutations, order does matter — one-two and two-one are different answers — so you cannot use a start index that forbids going back; instead you allow any unused element at every step, and the used-array is what prevents placing the same element twice within one arrangement. So: start index when order is irrelevant and you want each set once; used-marker when order matters and you want every arrangement.

Maya: That is the cleanest way I have heard that stated. So before I ever write the recursion, I should ask myself which of those two structures the problem wants.

Leo: That question is most of the battle. Decide first: am I enumerating subsets or combinations, where a start index prevents duplicates, or permutations and arrangements, where a used-marker does. Then decide what "complete" means — a full-length path, a remaining amount of zero, a filled board — because that is your base case where you snapshot. Then decide the prune — the earliest cheap check that proves a partial state is hopeless. Everything else is the same three beats: choose, explore, un-choose. If you carry that skeleton, most backtracking problems become fill-in-the-blanks rather than blank-page terror.

Maya: Can you walk the subsets tree for one-two-three step by step, so I actually see the choose and un-choose fire? I want to watch the path grow and shrink.

Leo: Let me narrate it like footprints in the maze. Start with an empty path; record the empty set. Choose one — path is now the list holding one — record it. Choose two — path holds one and two — record it. Choose three — path holds one, two, three — record it; there is nothing further, so un-choose three, path is back to one and two. There are no more elements past three at this level, so un-choose two, path is just one. Now choose three — path holds one and three — record it, then un-choose it, path is one again. No more options, so un-choose one, path is empty. Then choose two, record two, choose three, record two-three, and unwind; finally choose three, record three, unwind. Eight recorded snapshots, and notice the path was empty again at the very end — every push had a matching pop.

Maya: That last detail is the tell — if the path is not empty at the end, I dropped a pop somewhere. What does that cost me in memory, though; how deep does the recursion actually go?

Leo: The recursion depth is the length of the longest path, which is the number of elements, so it is linear in n — the call stack holds at most n frames at once, even though the tree has exponentially many nodes. That is a reassuring fact: the walk visits an exponential number of nodes over its whole lifetime, but at any single instant it only holds one root-to-leaf path in memory, plus the answers you have chosen to keep. So the working memory beyond the output is just that one path and the call stack, both linear. If stack depth ever worried you, you could rewrite the same walk with an explicit stack instead of recursion, but the recursive form is almost always clearer and the depth is rarely the problem — the sheer number of answers is.

Maya: Let me try to say the whole thing back so you can catch what I have wrong. Backtracking is a depth-first walk of a tree of choices, where each root-to-leaf path is one candidate answer. At every node I choose an option by mutating a shared path, recurse to explore, then un-choose by undoing that mutation so the next branch starts clean. When I reach a complete state I record a copy of the path, never the live list. I prune by rejecting a partial state as early as I can prove it is doomed, which deletes whole subtrees. I use a start index when order does not matter and a used-marker when it does. And the cost is often exponential because the answer set genuinely is.

Leo: That is a complete and correct summary, and the two things I would underline are the two habits that separate a clean solution from a mysterious one. First, always undo on the way back up and always snapshot when you record — those kill the state-leak and the aliasing bugs. Second, prune as high as you legally can, because an early rejection erases the largest subtrees. If you also ask up front whether you want a start index or a used-marker, and what your base case is, you will write backtracking that is correct on the first try far more often. It stops being an exotic technique and becomes one repeatable habit: make a choice, explore what it leads to, quietly take it back, and never explore a branch you can already prove is a dead end.

Maya: So it is not "try everything and hope." It is "walk the decision tree deliberately, take back each move as you leave it, and refuse to walk into a corridor you can already see is walled off."

Leo: That is exactly it. Choose, explore, un-choose, and prune. Carry those four and the whole family of "find all the ways" problems opens up.`;

// Part 1 (subsets / the choose-explore-unchoose template): >= 200 words.
export const PART1_SCRIPT = `Leo: Let's make the template concrete with subsets. You want every subset of a list, and the shape is a depth-first walk where every node you visit is itself a valid subset. Carry one shared list called the path. The three beats are: choose — append an element; explore — recurse deeper; un-choose — pop that element back off.

Maya: So every node is an answer, not just the leaves? That is different from what I expected.

Leo: Right, and it is why the base case is trivial here — there is no filtering. The instant you enter the function you record a copy of the current path, because the path as it stands is a genuine subset. Then you loop over the elements from a start index onward, and for each one you choose it, recurse with the next start index, and un-choose it.

Maya: Why the start index instead of looping over the whole list every time?

Leo: Because the set containing one and two is the same as the set containing two and one, and you must not emit both. The start index says "only ever look forward," which forces every subset to be built in increasing position order, so each one is produced exactly once. If you looped over everything you would generate every ordering and drown in duplicates.

Maya: And what exactly do I copy when I record?

Leo: A snapshot — path[:] in Python, a fresh copy of the list. If you store the live path instead, your later choose and un-choose calls mutate the thing you already saved, and every saved subset ends up wrong. Copy on record, pop on return.

Maya: So: record a copy, loop forward from the start index, choose, recurse, un-choose.

Leo: That is the whole template. Master it on subsets and the harder problems are variations on those same beats.`;

// Part 2 (permutations + pruning / used-marker): >= 200 words.
export const PART2_SCRIPT = `Leo: Now permutations, where order matters and each element is used exactly once. The tree is wider: at every position you may place any element that is not already in your path. You track that with a boolean used-array, one flag per element.

Maya: So the used-array replaces the start index from subsets? Why can't I just use the start index again?

Leo: Because a start index forbids going back, and for permutations you must be able to place a smaller-positioned element after a larger one — one-then-two and two-then-one are both valid, distinct answers. The used-marker is looser: it forbids reusing an element within a single arrangement, but lets you visit elements in any order across the tree.

Maya: What are the three beats here, then?

Leo: Same skeleton, guarded by the marker. Loop over all elements; skip any whose used flag is set. To choose, set the flag and append the element. Explore by recursing. To un-choose, pop the element and clear the flag. The base case is when the path length equals the input length — a full arrangement — so you snapshot a copy.

Maya: And where does pruning enter, since here every leaf is valid?

Leo: In plain permutations it does not — every full-length path is a real answer. Pruning shows up when constraints appear, like the N-Queens board, where before recursing into a square you check whether it is attacked and, if so, skip that branch entirely. That early rejection deletes the whole doomed subtree instead of walking it to a dead leaf.

Maya: So permutations teach the used-marker, and constraints teach the prune.

Leo: Set the flag, explore, clear the flag — and refuse any branch you can already prove is illegal.`;
