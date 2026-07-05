/**
 * Hand-authored audio transcripts for the Two Pointer lesson (subject 9).
 * Two-host Socratic format: Leo teaches the mechanism, Maya is a curious skeptic
 * who drills into why each move is safe and when it fails. No page-structure or
 * meta-authoring language (kept out to pass transcript-quality checks).
 */

// Top-level overview: >= 2700 words, stand-alone, teaches the whole pattern.
export const OVERVIEW_SCRIPT = `Leo: Let's take a problem you have probably brute-forced a hundred times and watch a second pointer erase the inner loop. Here is the setup. I hand you a sorted row of numbers — one, three, four, six, eight, eleven — and I ask: is there a pair inside that adds up to exactly ten? The lazy answer is two loops. Pick a first number, then scan every later number and check the sum. That is roughly n times n work, a full nested loop.

Maya: Right, and that nested loop is the thing that feels wasteful, but I never questioned it. Why is it wasteful here? Each pair really is different.

Leo: Because you are ignoring a gift the problem already gave you: the row is sorted. Sorted means the numbers get bigger as you move right and smaller as you move left. That ordering is information, and the nested loop throws it away. So let me put down two fingers instead of one. One finger on the far left, on the one. One finger on the far right, on the eleven. Add what they point at. One plus eleven is twelve. Twelve is bigger than my target of ten.

Maya: Okay, twelve is too big. But how does that one comparison help? You have only checked a single pair.

Leo: Here is the move that makes the whole pattern click. Ask yourself: which pointer could possibly fix an overshoot? The sum is too big. If I move the left finger rightward, I land on a bigger number, so the sum gets even bigger. That is the wrong direction. The only way to bring the sum down is to move the right finger leftward, onto a smaller number. So I retreat the right finger from eleven to eight. Now one plus eight is nine, which is under ten. Same logic in reverse: to raise the sum I advance the left finger. Three plus eight is eleven, too big, retreat the right finger to six. Three plus six is nine, too small, advance the left finger to four. Four plus six is ten. Found it. Two fingers walked toward each other and met in the middle, and I never restarted a scan.

Maya: Wait. So every single comparison let you throw away an entire number forever, not just one pair. That is why it collapses to one pass.

Leo: Exactly, and say that back to yourself slowly because it is the soul of the pattern. When the sum was twelve and I retreated the right finger, I did not just reject the pair one-and-eleven. I rejected every pair that uses eleven, because eleven is the largest number and even paired with the smallest available it was already too big. One comparison, a whole column of possibilities gone. The pointers only ever move inward, each takes at most n steps total, so the work is linear. The sorted order is what makes a single comparison decisive — it tells you, without checking, which side is hopeless.

Maya: So the honest precondition here is not "two pointers." It is "sorted." If the row were shuffled, moving the right finger left would not reliably shrink the sum, and the whole decision falls apart.

Leo: You just found the first failure mode before I could set the trap, which is exactly the instinct I want you to build. If the array is not sorted, converging pointers are simply wrong. A too-big sum no longer means "the right side is hopeless," because a smaller number could be sitting anywhere. On an unsorted array the right tool for two-sum is a hash map — you remember what you have seen and check for the complement in one pass. Same linear time, completely different mechanism. So the recognition question is not only "am I looking for a pair," it is "do I have the ordering that makes one comparison decisive." Miss that and you will confidently write a fast wrong answer.

Maya: Good, so that is one flavor of two pointers, where the fingers start apart and converge. You made it sound like there is a family. What are the others?

Leo: There are three siblings, and telling them apart is most of the battle. The first is the one we just did — converging, or opposite-ends. Left starts at the front, right at the back, they walk toward each other. That is your pair-and-triplet-in-sorted-data tool, your is-this-a-palindrome tool, your container-with-most-water tool. The second sibling looks totally different at first: both pointers start at the front and move the same direction, but at different jobs. I call them read and write. The read pointer marches across every element, inspecting. The write pointer lags behind and marks the boundary of the answer you are building in place.

Maya: Give me something concrete for read and write, because "building in place" is vague and I want to see the two jobs.

Leo: Take a sorted array with duplicates — one, one, two, two, two, three — and the task is to squash it down to the distinct values without allocating a new array. The read finger walks every slot. The write finger sits at the next place a fresh value should go. Read sees the first one; it is the very first element, always keep it, so write advances past it. Read moves to the second one; that equals the last value we kept, so it is a duplicate — read keeps walking, write stays put. Read hits the first two; that is new, so we copy it to the write slot and advance write. And so on. When read reaches the end, everything before the write finger is the compacted, deduplicated answer, and you never used a second array.

Maya: So the write pointer is basically a running promise: "everything to my left is already correct and final." And read is out ahead scouting. Why is that still linear? It looks like two things happening.

Leo: It is two jobs but one pass. Read advances exactly n times, once per element. Write advances only on the subset of steps that produce a keeper, so it moves at most n times. Neither ever walks backward. Total finger travel is bounded by two n, which is linear, and the extra memory is a single index — constant space. That constant-space part is why interviewers love it. "Do it in place" is almost a code word for read-and-write two pointers. Move all the zeros to the end, remove a target value, partition an array into smaller-than and bigger-than — same skeleton, you just change the rule that decides when write gets to advance.

Maya: Okay, converging and read-write. You said three siblings. What is the last one, and how is it not just one of these two wearing a hat?

Leo: The third is fast and slow, sometimes called Floyd's pointers, and it is the strangest because both pointers traverse the same sequence but at different speeds. Picture two runners on a track. One takes one step at a time, the other takes two steps at a time. If the track is a straight line, the fast runner simply reaches the end first — and that alone is useful, because when the fast one hits the end, the slow one is sitting exactly at the middle. That is how you find the midpoint of a linked list in one pass without counting its length first.

Maya: I can see the midpoint trick. But the famous use is cycle detection, and I have never had a clean intuition for why different speeds catch a loop. Can you go deeper on that?

Leo: This is my favorite, so let me build it carefully. Imagine the track is not straight — it bends around into a loop, like a running lane that circles back on itself. Put both runners at the start. The fast one laps the track; the slow one plods. Now think about the gap between them once they are both inside the loop. Every tick, the fast runner gains exactly one step on the slow runner, because it moves two while the other moves one. So the gap shrinks by one every single tick. A gap that steadily shrinks by one, on a finite circular track, must eventually reach zero — they collide. If there is no loop, the fast runner just runs off the end and you learn there was no cycle. So different speeds turn "is there a loop" into "do these two ever land on the same spot," which you can check with two moving fingers and no extra memory at all.

Maya: That is genuinely beautiful — the gap closing by one guarantees the meeting. So the enabling structure there is not sortedness, it is that both pointers share one path and the speed difference forces an eventual overlap.

Leo: And there is a second act to that trick that interviewers adore, so let me push one layer further. Detecting the loop is only half the question; often they want the exact node where the loop begins. Once the fast and slow runners collide somewhere inside the loop, do one strange-looking thing: leave one pointer at the collision spot, send the other back to the very start, and now walk both at the same slow speed, one step each. The spot where they meet again is the entrance to the loop.

Maya: That feels like magic. Why on earth would resetting one to the start and walking evenly land both on the loop's entrance?

Leo: It is arithmetic hiding behind the magic. Call the distance from the start to the loop entrance some length a, and the distance from the entrance to the collision point some length b. When they collided, the fast runner had traveled exactly twice the slow runner's distance, and the extra distance it covered is a whole number of full loops. Grind that equality out and it says a equals the remaining distance from the collision point back around to the entrance. So a pointer starting at the front and a pointer starting at the collision, both moving one step at a time, cover that same length a and arrive at the entrance together. You do not have to re-derive it in the room, but knowing it is a clean distance equation keeps you from thinking it is a trick you must memorize.

Maya: So even the scary version is just the sorted-order idea in disguise — some structural fact makes a simple move decisive.

Leo: Let me give you one more converging example, because it shows the pattern working without any addition at all — the palindrome check. Is the string r, a, c, e, c, a, r the same forwards and backwards? Left finger at the first r, right finger at the last r. Compare the two characters. Equal, so step both inward. a and a, equal, step in. c and c, equal. The fingers meet in the middle having never found a mismatch, so it is a palindrome. The instant any pair disagrees you stop and answer no. No extra string, no reversal, one pass with two fingers walking toward each other.

Maya: And the enabling structure for the palindrome is that a palindrome is defined by mirrored positions, so comparing the ends inward is exactly the definition.

Leo: Now let me hand you the exercise you will actually solve, because it stretches converging pointers with a greedy twist — container with most water. Picture a row of vertical walls of different heights; pick two of them so the water trapped between forms the biggest rectangle. The area is the shorter of the two walls times the horizontal distance between them. Start with the widest possible container: left finger on the first wall, right finger on the last. You have the maximum width, but the area is capped by whichever wall is shorter.

Maya: So width is as big as it will ever be, and the only lever left is height. But which finger do I move, and why not just try everything?

Leo: Here is the greedy insight, and it is the whole exercise. Move the finger on the shorter wall inward, and always the shorter one. Think about why the other choice is pointless: if you moved the taller wall inward instead, the width shrinks and the height is still capped by that same short wall, so the area can only get worse. Only by abandoning the short wall do you have any chance of finding a taller limiter that beats the loss in width. So every step you retire the shorter wall and keep the taller candidate, and the fingers converge in one linear pass while you track the best area seen.

Maya: So the failure mode there would be moving the wrong wall — dropping the tall one — which quietly throws away the only pairs that could have improved. It would still run, it would just return a smaller wrong answer.

Leo: Exactly the kind of bug that passes the easy tests and dies on the tricky one. And that is the unifying lesson across all three. In every case a second pointer removes an inner loop, but something about the structure is what makes the second pointer trustworthy. For converging it is sortedness — one comparison rules out a whole side. For read-write it is that the answer is a prefix you can build forward without ever looking back. For fast-slow it is a shared path where a speed gap must eventually close. If that enabling property is missing, the pointers are just two random indices and you have fooled yourself.

Maya: Let me stress-test the recognition, because in an interview I do not get a label that says "two pointer." What words in a problem should trip the alarm?

Leo: Train your ear for a few fingerprints. For converging: a sorted array plus "find a pair, or a triplet, that sums to something," or the words "palindrome," or "two walls and water between them." For read-write: the phrase "in place," "remove," "dedup," "move to the end," "without extra space" — anything that screams do-not-allocate. For fast-slow: a linked list plus "cycle," "middle," or "nth from the end." And here is the subtle one that trips people who half-learned it: two-sum on an unsorted array. The word "pair that sums" tempts you toward converging pointers, but without sorting it is a hash-map problem. If you would have to sort first and the problem needs the original indices, sorting destroys them, and now converging pointers actively hurt you.

Maya: So the mistake is pattern-matching on the surface phrase — "pair that sums" — instead of on the enabling structure. The phrase suggests two pointers; the missing sortedness forbids it.

Leo: That is the whole discipline in one sentence, and it is worth repeating: recognize on structure, not on surface words. Now let me connect this to something you already know, because two pointers and the sliding window you just studied are cousins, and seeing the family resemblance will save you. A sliding window is really a read-write pair with a rule: the right pointer expands, the left pointer contracts, and the stretch between them is the window. So window problems are a special case of same-direction two pointers where you care about the span between the fingers. Converging pointers are the opposite geometry — the fingers start apart and the interesting thing is where they meet, not the span between them.

Maya: So if someone asks me the difference between sliding window and two pointer, the honest answer is that a window is one particular same-direction two-pointer setup, and the broader two-pointer idea also includes fingers that move toward each other or at different speeds.

Leo: Precisely, and an interviewer who hears you say that knows you understand the machinery instead of memorizing templates. Let me leave you with the mental checklist you should run in the first two minutes of any problem. First: am I searching for a relationship between two positions — a pair, a span, a meeting point? If yes, a second pointer is on the table. Second: what structure makes a single comparison decisive — is the data sorted, is the answer a buildable prefix, is there a shared path with a speed difference? Name that structure out loud. Third: if none of those hold, back off — you probably want a hash map, a heap, or dynamic programming instead. That third step, knowing when to walk away from the pattern, is what separates someone who has drilled two pointers from someone who has actually understood it.

Maya: So the pattern is not "use two indices." It is "find the structure that lets one comparison throw away a whole class of possibilities, then let two indices exploit it." And when that structure is absent, forcing two pointers is the bug.

Leo: That is it exactly. Converging exploits sorted order. Read-write exploits a forward-only answer. Fast-slow exploits a shared path. Three geometries, one idea, and a very sharp failure mode when the enabling structure is not really there. Carry those three fingerprints and that one discipline into the exercises, and two pointers stops being a bag of tricks and becomes a single question you know how to ask.`;

// Part 1 (converging): >= 200 words, two-host, layered.
export const PART1_SCRIPT = `Leo: Let's nail the converging version on the sorted row one, three, four, six, eight, eleven, hunting for a pair that sums to ten. Left finger on the one, right finger on the eleven. One plus eleven is twelve, over target.

Maya: And your claim is that this single over-the-target reading lets you discard something permanent, not just this one pair. Why permanent?

Leo: Because eleven is the largest value left, and paired with the smallest available number it is already too big. Every other pair using eleven is at least this big, so all of them are hopeless at once. I retreat the right finger to eight. One plus eight is nine, now under target.

Maya: So now the mirror argument fires — to raise a too-small sum you can only advance the left finger, because the right side is already as small as it is allowed to get?

Leo: Exactly the mirror. Advance left to three. Three plus eight is eleven, over, retreat right to six. Three plus six is nine, under, advance left to four. Four plus six is ten. The fingers converged and met the target, and I never rescanned.

Maya: What breaks this if the row is not sorted?

Leo: Then "too big" no longer means the right side is hopeless — a smaller number could sit anywhere, so moving a finger does not reliably push the sum the way you expect. On unsorted data this is a bug, and you switch to a hash map that remembers complements. Sorted order is the whole license for the converging walk.

Maya: So the discipline is to say the precondition out loud before the first comparison.

Leo: Say "it is sorted, so one comparison kills a side," and only then move a finger.`;

// Part 2 (read/write compaction): >= 200 words, two-host, layered.
export const PART2_SCRIPT = `Leo: Now the same-direction version, where both fingers start at the front but do different jobs. Take the sorted array with duplicates one, one, two, two, two, three, four, four, and squash it to its distinct values in place, no second array.

Maya: You keep saying "in place" like it is the whole point. Why does refusing a second array change how I think about the pointers?

Leo: Because it forces one finger to be a boundary you can trust. The write finger marks a promise: everything to its left is already the final, deduplicated answer. The read finger scouts ahead across every element. Read sees the first one, always a keeper, so write advances past it. Read hits the second one, which equals the last kept value, so it is a duplicate — read walks on, write stays frozen.

Maya: So write only moves when read finds something genuinely new. How does that stay linear when it looks like two moving parts?

Leo: Read advances exactly once per element, n steps. Write advances only on keepers, so at most n steps. Neither ever backs up, so total travel is at most two n — linear — and the only extra memory is one index, constant space. Read hits the first two, that is new, copy it next to the write finger and advance write; the later twos are skipped; three and four each advance write once.

Maya: What is the classic mistake here?

Leo: Advancing write on every step instead of only on a new value — that copies duplicates right back in and quietly corrupts the prefix. The rule "write moves only on a keeper" is the invariant that keeps the left side honest.`;
