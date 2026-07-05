/**
 * Hand-authored audio transcripts for the Trie (prefix tree) lesson (subject 9).
 * Two-host Socratic format: Leo teaches the mechanism, Maya is a curious skeptic
 * who drills into why each move is safe and when it fails. No page-structure or
 * meta-authoring language (kept out to pass transcript-quality checks).
 */

// Top-level overview: >= 2700 words, stand-alone, teaches the whole pattern.
export const OVERVIEW_SCRIPT = `Leo: Let's start from a problem you have almost certainly solved the slow way. You are given a big dictionary of words, and you keep getting asked questions like: is this exact word in the set, and — the harder one — how many stored words start with the prefix "pre"? A hash set answers the first question instantly, but it is useless for the second, because a hash of the whole word tells you nothing about which words share a beginning. The trie exists to make prefix questions as cheap as exact-match questions.

Maya: So the distinguishing feature is not membership on its own — a hash set already nails that. It is that I need to reason about shared beginnings, about prefixes, across a whole pile of strings at once.

Leo: Exactly, and hold onto that word "shared," because it is the entire idea. A trie — some people say "try," some say "tree," it comes from re-trie-val — stores strings by their characters along a path, and words that begin the same way literally share the same path until they diverge. Picture a subway map where every word is a route from the central station. "car," "card," and "cart" all ride the same three stops c, a, r, and only then split. You store the common prefix once and branch only where the words actually differ.

Maya: Okay, so it is a tree, but the edges mean something specific. What exactly is a node, and what is on the edges?

Leo: Let me pin the structure down precisely, because the mental model is everything here. Each node represents a position reached by spelling out some prefix. A node holds two things: a map from a single character to a child node, and a boolean flag that says "a complete word ends right here." The edges are labeled with characters. The root is the empty prefix — you have spelled nothing yet. To follow the word "car," you start at the root, take the edge labeled c to a child, then the edge labeled a, then the edge labeled r. The node you land on gets its end-of-word flag set to true. That flag is the subtle, crucial part.

Maya: Why does that flag matter so much? If I have already walked the path c-a-r, is it not obvious that "car" is in there?

Leo: This is the question that separates a working trie from a buggy one, so let me build the intuition slowly. Walking a path only proves that those characters exist as a prefix of something. Suppose you only ever inserted "card." Then the path c-a-r exists — it has to, because it is on the way to "card" — but "car" itself was never stored. Without the end-of-word flag, a search for "car" would walk the path, find it present, and wrongly report success. The flag is how the trie distinguishes "this is a real stored word" from "this is merely a prefix on the way to a longer word." Every node on the path to "card" exists, but only the final d node has its flag set.

Maya: Ah. So the path existing and a word ending are two different facts, and the flag is the second one. That is exactly the bug I would have written. So does that mean every single operation has to consult that flag differently?

Leo: It does, and that is the perfect way to organize the three operations, which all share one skeleton: walk the string character by character from the root. Insert is first. For each character, look for a child under that character; if it does not exist, create an empty node and link it; then step into that child. When you have consumed the whole word, set the end-of-word flag on the node you finished on. Insert is where the tree grows new branches. Search is second, and it is insert without the creation: for each character, look for the child; if at any point the child is missing, the word is not present, so return false immediately. If you consume the whole word, the answer is not just "you made it" — it is "you made it AND the end-of-word flag is true." That final check is what stops "car" from matching when only "card" was inserted. And the third operation, startsWith, is the reason we are here.

Maya: Right, the prefix one. How exactly does startsWith differ from a plain search, step by step?

Leo: startsWith — "does any stored word begin with this prefix" — is search without the final flag check. You walk the prefix character by character; if you ever fail to find a child, no word has that prefix, return false; if you consume the whole prefix successfully, return true, and here is the difference: you do not consult the end-of-word flag at all, because you are not asking whether the prefix is itself a word, only whether it leads anywhere. Search checks the flag at the end; startsWith ignores it. That one-line difference is the whole distinction, and it is the operation a hash set fundamentally cannot do — the trie answers it in time proportional to the length of the prefix, completely independent of how many words are stored.

Maya: Let me slow down on that cost claim, because it sounds almost too good. Why does searching a trie not depend on how many words are in it at all?

Leo: Because the walk only ever touches the path for the one string you are looking up, and that path's length is the length of the string, not the size of the dictionary. Searching for a word of length L is O(L) — you take L steps down the tree, and at each step you do a single constant-time lookup in that node's children map. It does not matter whether the trie holds ten words or ten million; the walk for "car" is three steps either way. Compare that to scanning a list of a million words to find prefixes, which is O(number of words times their length). The trie converts a "search everything" problem into a "walk one short path" problem. The number of stored words has moved out of the time cost entirely.

Maya: So where is the catch? Nothing is free. If time does not grow with the number of words, what changes on the cost side to make up for it?

Leo: Memory pays, and this is the honest tradeoff you must be able to state in an interview. A trie can use a lot of space, because in the worst case — words that share almost no prefixes — you allocate a separate node for nearly every character of every word, plus the overhead of a children map at each node. If your alphabet is large, say Unicode, each node's child map can be heavy. So a trie trades memory for fast prefix operations. When words share long common prefixes — think dictionaries of English words, or URLs, or file paths — the sharing is dramatic and the memory is reasonable. When they share almost nothing, a trie can be wasteful, and a plain hash set plus a different strategy may be better.

Maya: Give me the recognition signal, then. When I read a fresh problem, what phrasing should make me think "trie"?

Leo: There is a small family of fingerprints, and learning them is the real skill. The clearest is any mention of prefixes: "words starting with," "common prefix," "autocomplete," "type-ahead suggestions." The second is repeated lookups against a fixed dictionary of strings, where you will query many times and want each query cheap. The third is word games and board puzzles — think of a word-search or Boggle solver, where you walk a grid and want to prune the moment the letters you have collected are not a prefix of any real word; the trie lets you abandon dead paths early. And a subtler fourth: bitwise problems, like finding the maximum XOR of two numbers, where you build a trie over the binary digits of the numbers and walk it greedily. If you see prefixes, autocomplete, dictionary-with-many-queries, or grid-word-pruning, reach for a trie.

Maya: The Boggle one is interesting — you said "prune the moment the letters are not a prefix." Can you go deeper on why the trie is what makes that pruning possible?

Leo: This is my favorite application, so let me build it. In a word-search you wander a grid collecting letters, and the search space explodes because from each cell you can go many directions. The killer optimization is: as you collect letters, keep a pointer into the trie in lockstep. Add a letter, take the matching edge. The instant there is no matching edge, you know that no word in the entire dictionary begins with the letters you have gathered, so you stop exploring that direction immediately — you do not wander further hoping a word appears, because the trie has proven none can. That single check turns an impossible brute force into something fast, and it works precisely because the trie answers "is this a live prefix" in one step. The end-of-word flag, meanwhile, tells you the moment your collected letters spell a complete word worth recording.

Maya: So the trie is doing two jobs at once there — it prunes dead directions with the edges, and it flags real words with the boolean. Now the part I care about most: when does reaching for a trie go wrong? Where does it betray me?

Leo: Several honest failure modes, and knowing them is what separates understanding from pattern-matching. First and most common: if the problem only ever asks "is this exact word present," with no prefix reasoning at all, a trie is overkill — a hash set is simpler, faster in practice, and lighter. Do not build a trie just because you are storing strings. Second, watch the memory when the alphabet is huge or the words share little; the node overhead can dominate, and sometimes a compressed trie, called a radix tree or Patricia trie, which merges chains of single-child nodes into one edge, is the right refinement. Third — and this is the number one implementation bug — forgetting the end-of-word flag, so that searching for a prefix of a stored word wrongly reports it as a full word. Fourth, mixing up search and startsWith: search must check the flag at the end, startsWith must not. Get those two confused and half your test cases fail in a way that looks random.

Maya: That radix-tree idea you slipped in — when a chain of nodes each has only one child — why is collapsing them worth the trouble?

Leo: Because those single-child chains are pure overhead. Imagine you store just the one long word "internationalization." A plain trie makes twenty nodes in a straight line, each with exactly one child, each carrying a whole children map to hold a single entry. That is a lot of objects to represent one edge's worth of information. A radix tree collapses that straight run into a single edge labeled with the whole substring, so you pay for one node instead of twenty. When your data has many long non-branching stretches — like file-system paths or IP routing tables — that compression is a large memory win, and IP routers really do use Patricia tries for exactly this reason. The plain trie is the mental model; the radix tree is the production optimization when the shape justifies it.

Maya: Before deletion, one implementation choice is nagging me. You keep saying "a map from a character to a child." How exactly should I store that map — a real hash map, or something simpler?

Leo: Great instinct, because the two standard choices trade memory against constant factors, and interviewers love to poke at it. Choice one is a fixed-size array of children, one slot per possible character. If your alphabet is the twenty-six lowercase English letters, every node carries an array of twenty-six pointers, and you index it by subtracting the code of 'a' from the character. Lookups are the fastest possible — a raw array index, no hashing — but you pay twenty-six slots at every node even if only one is used, which is wasteful for sparse tries. Choice two is a hash map from character to child, which stores only the children that actually exist. That is far leaner on memory when nodes have few children, and it is the only sane choice for a large or unknown alphabet like Unicode, at the cost of a hash computation per step. So: fixed array for a small dense alphabet where speed is everything, hash map for a large or sparse one where memory matters. In Python people almost always reach for a dictionary because it is clean and the alphabet is rarely tiny.

Maya: So the node is the same idea either way — children plus a flag — and I am just choosing how the "children" part is physically represented based on the alphabet.

Leo: Precisely. The abstraction never changes; only the container behind the arrow does. Now, deletion.

Maya: Right — how does removing a word from a trie work, and why is it trickier than insert?

Leo: Deletion is genuinely the fiddly one, and it is a common follow-up, so it is worth a beat. The naive move is just to clear the end-of-word flag on the last node — and often that is enough, because the word's characters might still be needed as a prefix of other stored words. If you stored "card" and "car" and you delete "car," you must not remove any nodes; you simply turn off the flag on the r node, because the path is still load-bearing for "card." But if you delete "card" and nothing else uses that tail, you should prune the now-dead nodes from the bottom up, stopping the moment you reach a node that either has the end-of-word flag or still has other children. So deletion is: unset the flag, then walk back up removing only nodes that are childless and not themselves word-ends. That "is this node still needed" check is exactly why it is trickier than insert, which never has to ask permission before adding.

Maya: Let me try to say the whole thing back so you can catch what I have wrong. A trie stores strings along character-labeled paths from a root; words with shared beginnings share the path until they diverge, so I store each common prefix once. Each node has a child-per-character map and an end-of-word flag. Insert walks the word, creating missing children, and sets the flag at the end. Search walks the word and succeeds only if it consumes everything AND the flag is set. startsWith walks the prefix and succeeds if it consumes everything, ignoring the flag. Every operation is O(length of the string), independent of how many words are stored, and I pay for that speed in memory.

Leo: That is a genuinely complete summary, and the only thing I would underline is the pair of gotchas, because they are what get graded. The end-of-word flag is what makes "card stored, car not stored" behave correctly, and the difference between search and startsWith is exactly whether you check that flag at the end. If you carry the structure — child map plus flag — the three walks, the O(length) cost, the prefix superpower, and those two failure modes into the exercises, the trie stops being an exotic data structure and becomes one clear idea: store strings by their shared prefixes so that any question about beginnings becomes a short walk down a path.

Maya: So it is not "use a trie whenever I have strings." It is "use a trie when I must reason about shared prefixes or run many dictionary queries cheaply," and the child-map-plus-flag node is the whole machine.

Leo: That is exactly right. Prefixes are the trigger, the flag is the correctness detail, the O(length) walk is the payoff, and memory is the price. Carry those four and you will recognize and implement a trie fast when it counts.`;

// Part 1 (trie structure + insert/search): >= 200 words, two-host, layered.
export const PART1_SCRIPT = `Leo: Let's make the structure concrete. A trie node holds two things: a map from a single character to a child node, and a boolean that says "a word ends here." The root is the empty prefix. To store "car," you walk c, a, r from the root, creating any missing child as you go, and set the end-of-word flag on the final node.

Maya: So the path spells the word. But why do I need a separate flag — if the path c-a-r exists, is "car" not obviously stored?

Leo: That is the exact bug to avoid. Suppose you only inserted "card." The path c-a-r exists because it is on the way to "card," but "car" was never a word you stored. Without the flag, searching "car" walks that path, finds it, and wrongly says yes. The flag is how you tell "a real word ends here" apart from "this is just a prefix of something longer."

Maya: Got it. So how does search use that flag, and how is startsWith different?

Leo: Search walks the word character by character; if any child is missing, return false immediately. If you consume the whole word, you return true only if the end-of-word flag is set on the node you finished on. startsWith walks the prefix the same way, but when you finish you return true regardless of the flag — you only asked whether the prefix leads anywhere, not whether it is itself a word.

Maya: And the cost of all this walking?

Leo: Each operation is O(L) for a string of length L — L steps, one constant-time child lookup per step — and it does not depend on how many words the trie holds. That independence is the whole point.

Maya: So one node type, three walks, and the flag is the only subtle part.

Leo: Child map plus end-of-word flag. Everything else is just following characters.`;

// Part 2 (prefix collection / autocomplete): >= 200 words, two-host, layered.
export const PART2_SCRIPT = `Leo: Now the payoff operation: autocomplete. Given a prefix, return every stored word that begins with it. Step one is startsWith — walk the prefix from the root; if any character has no child, there are no completions, return empty. If you consume the prefix, you are standing on the node for that prefix, and everything beneath it is a completion.

Maya: So once I reach the prefix node, how do I actually collect the words hanging below it?

Leo: You do a depth-first walk of that subtree, building up the string as you descend. Start with the prefix itself as the accumulated text. At each node, if its end-of-word flag is set, record the accumulated string as a found word. Then for each child edge, append that edge's character and recurse into the child. When the recursion unwinds, you have visited every word in the subtree.

Maya: Why depth-first rather than just scanning some list? What does the tree structure buy me?

Leo: Because the tree has already grouped every completion under one node for free. You never look at a single word that does not start with the prefix — the walk to the prefix node skipped all of them in O(length of prefix). A flat list would force you to test all N words. The trie turned "filter the whole dictionary" into "walk one subtree."

Maya: What is the classic bug in the collection step?

Leo: Forgetting to check the end-of-word flag at each node and instead emitting every path. If you only inserted "cart" and "car," the node at c-a-r-t is a word and the node at c-a-r is a word, but the intermediate node at c-a is not — emitting it would invent a word nobody stored. Record only nodes whose flag is set.

Maya: So: walk to the prefix, then DFS the subtree, emitting flagged nodes.

Leo: Reach the prefix once, then let the subtree hand you the completions.`;
