/**
 * Hand-authored audio transcripts for the System Design algorithmic-patterns
 * lesson (subject 9, seq 9). Two-host Socratic format: Leo teaches the small set
 * of algorithms that hide inside system-design interview questions — consistent
 * hashing, rate limiting, quorum/consensus, and LRU caching — and how to
 * recognize the signal that triggers each one; Maya is a sharp student who keeps
 * pushing on WHY each mechanism is correct and WHERE it breaks. No page-structure
 * or meta-authoring language (kept out to pass transcript-quality).
 */

// Top-level overview: >= 2700 words, stand-alone, builds the whole toolbox.
export const OVERVIEW_SCRIPT = `Leo: The system-design round scares people because it feels open-ended, but underneath the whiteboarding there is a small, finite toolbox of algorithms, and the interview is mostly a recognition game: hear the signal, reach for the right tool, and explain the trade-off. Today we load four of them — consistent hashing for spreading data across servers, rate limiting for capping traffic, quorum and consensus for staying correct when machines fail, and the least-recently-used cache for serving hot data in bounded memory. Each one is a crisp algorithm you can actually code, not hand-waving.

Maya: I like that framing, because I always freeze when the question is "design a URL shortener" or "design a rate limiter" and I do not know which piece to start with. So what is the signal for the first tool — when do I even know I need consistent hashing?

Leo: The signal is a sentence like "spread these keys across N servers, and make adding or removing a server cheap." Picture the naive approach first, because seeing it fail is what makes consistent hashing click. The obvious idea is server equals hash of the key modulo N. It spreads keys evenly, and for a fixed N it is perfect. But watch what happens the moment N changes: go from ten servers to eleven and the modulus changes for almost every key, so nearly every key now maps to a different server. In a cache that means a near-total cache miss storm; in a sharded database it means you have to physically move almost all your data. That is the failure that consistent hashing exists to prevent.

Maya: Okay, so modulo breaks because changing N reshuffles everything. How exactly does putting things on a ring fix that — what is the causal chain from "a ring" to "only a few keys move"?

Leo: Think of the ring like a clock face numbered zero up to some large maximum, wrapping around at the top. You hash each server to a point on that clock, and you hash each key to a point too. A key belongs to the first server you meet walking clockwise from the key's position. Now trace what happens when you add one server: it lands at a single new point on the clock, and it only steals the keys that sit in the arc between it and the previous server going counter-clockwise. Every other key on the ring is untouched, because their walk-clockwise still lands on the same server as before. So adding the eleventh server moves roughly one-eleventh of the keys, not almost all of them. The causal chain is: ownership is local to an arc, a new node only changes one arc, so only that arc's keys relocate.

Maya: That is a real improvement. But does that mean the load can get lopsided — if a server lands in a sparse part of the ring, does it get almost no keys while its neighbor is slammed?

Leo: Exactly right, and that is the second half of the tool. With one point per server the arcs are uneven — random placement gives you some huge arcs and some tiny ones — so a single unlucky server can own a giant slice. The fix is virtual nodes: instead of hashing each server to one point, you hash it to many points, say a hundred replicas scattered around the ring. Now each physical server owns a hundred small arcs sprinkled everywhere, and by the law of large numbers those hundred slices average out to a fair share. As a bonus, when a server dies its hundred arcs each spill over to a different neighbor, so the departed load is spread across the whole cluster instead of dumped on one unlucky successor. That is the whole tool: a ring for locality, virtual nodes for balance.

Maya: Good. Let me switch to the second tool, because rate limiting shows up in almost every design. What is the signal there, and what is the cleanest algorithm to reach for?

Leo: The signal is "no client may exceed X requests per unit time" or "smooth out bursty traffic." The cleanest default is the token bucket. Imagine a bucket that holds up to a fixed capacity of tokens, and tokens drip in at a steady refill rate — say five tokens capacity, one token per second. Every request must take one token to proceed; if the bucket is empty, the request is rejected or made to wait. The beautiful property is that it allows a controlled burst: if the bucket has filled up while things were quiet, a client can spend all five tokens at once, then is throttled back to the drip rate of one per second. So it enforces an average rate but tolerates short spikes, which is usually exactly what you want.

Maya: How exactly do you implement the refill without running a background timer for every bucket — that sounds like it would not scale to millions of clients?

Leo: That is the elegant trick, and it is worth saying slowly because people over-engineer it. You do not run a timer at all. You store two numbers per client: the current token count and the timestamp of the last request. When a new request arrives, you compute how much time has elapsed since that stored timestamp, multiply by the refill rate to get how many tokens would have dripped in, add them to the count, and cap at capacity. This is lazy refill — the tokens are computed on demand, only when a request touches that bucket. So a client that is quiet for an hour costs you nothing until its next request, at which point you top it up in one arithmetic step. Two numbers and a subtraction per request; that scales.

Maya: So does that mean the token bucket and a sliding window are the same thing, or is there a real difference in what they allow?

Leo: There is a real, visible difference, and interviewers love to probe it. A sliding-window counter keeps the timestamps of recent requests and simply counts how many fall inside the last window — allow the request if that count is below the limit. It enforces a strict "at most X in any rolling window," with no notion of saved-up burst credit. The token bucket, by contrast, lets a quiet client cash in accumulated tokens for a spike. So if the requirement is "absolutely never more than a hundred in any sixty-second window," you want the sliding window. If the requirement is "average a hundred per minute but bursts are fine," you want the token bucket. There is also the leaky bucket, which is the mirror image: requests queue and drain at a fixed rate, smoothing output completely but adding latency. Same family, different trade-off between burst tolerance and smoothness.

Maya: Let me go to the scary one — consensus. Whenever an interviewer says "what if a node fails," I start hand-waving. What is the actual algorithmic idea that keeps replicated data correct?

Leo: The load-bearing idea is simpler than the papers make it look, and it is the quorum. Suppose you replicate every piece of data on N machines. If you demand that every write is acknowledged by W of them and every read consults R of them, and you choose R plus W to be strictly greater than N, then the set of machines a read touches and the set a write touched must overlap in at least one machine — there is no way to pick R and W that big without sharing a member. That shared machine has the latest write, so the read is guaranteed to see it. That single inequality, R plus W greater than N, is the whole guarantee, and it is why a majority quorum — read a majority, write a majority — is the common choice: any two majorities of the same group always intersect.

Maya: Can you go deeper on why majority specifically, and how that connects to leader election in something like Raft?

Leo: Yes, and majority is the magic number because any two majorities of the same set must share a member — you cannot split a group into two majorities that avoid each other. Leader-based consensus like Raft builds directly on that. To become the leader, a candidate must collect votes from a majority of the servers; because any two majorities overlap, two different candidates cannot both win in the same term, so you never get two leaders committing conflicting decisions. The same overlap logic makes a committed entry durable: an entry is only considered committed once a majority has stored it, so any future leader — who also needed a majority to win — is guaranteed to have seen it. So the mistake people make is treating consensus as mystical; the entire safety story is majorities overlap, which is the same quorum inequality wearing a crown.

Maya: What breaks that guarantee — is there a way the majority idea goes wrong in practice?

Leo: The classic way it goes wrong is a split brain caused by ignoring the majority rule. If a network partition cuts the cluster in two and you let each side keep accepting writes independently, both halves think they are in charge and you get two divergent copies that later cannot be reconciled — that is the bug consensus exists to prevent. The rule that saves you is that only the side holding a strict majority may make progress; the minority side must refuse writes, even though it is painful, because a majority can form on only one side of any partition. So availability on the minority side is sacrificed to keep correctness — a direct taste of the CAP trade-off, where a partition forces you to choose consistency or availability, and consensus deliberately chooses consistency.

Maya: Last tool. Caching feels obvious, but the least-recently-used cache always trips me up on the data structures. Why is it not just a dictionary?

Leo: Because a plain dictionary gives you fast lookup but no notion of order, and a cache with bounded memory must answer one extra question fast: when I am full and need to evict, which entry is the least recently used? So you need two things at once — constant-time lookup by key, and constant-time knowledge of the recency order. The standard answer marries two structures: a hash map from key to a node, and a doubly linked list that holds those nodes in recency order, most-recently-used at the front and least-recently-used at the back. On a get, you find the node through the map in constant time, then splice it out of the list and move it to the front. On a put that overflows, you drop the node at the back, which is by construction the least recently used. Every operation is constant time because the map avoids the scan and the linked list makes the move-to-front and the evict-from-back pointer surgery, not a search.

Maya: How does that stay constant time on the move — what changes in the pointers when I promote a node to the front?

Leo: You unlink the node by pointing its predecessor and successor at each other, then you insert it just after the head sentinel by fixing four pointers. No traversal, no shifting — just a fixed number of pointer reassignments, which is why it is order one and not order n. In practice many languages hand you this for free: Python's OrderedDict, for instance, is exactly a hash map plus a doubly linked list, so move-to-end and pop-from-the-oldest are already constant-time methods. But the interviewer usually wants you to know the machinery underneath, so the mistake to avoid is reaching for a structure that makes eviction a linear scan — for example an array where finding the least-recently-used entry means walking the whole thing every time.

Maya: Before we close, let me push back on consistent hashing with a real-world wrinkle. What changes when one key is wildly more popular than the rest — a celebrity user whose data everyone reads — does the ring still save me?

Leo: Great instinct, because that is exactly where the ring alone is not enough. The ring balances the number of keys per server, but it says nothing about the traffic per key. If one key is a hot spot, the single server that owns that key's arc gets hammered no matter how evenly the arcs are cut — the mistake is assuming even key distribution means even load. The standard fixes layer on top: replicate the hot key across several servers and spread reads among them, or put that key behind a small cache in front of the shard. So the ring solves placement and cheap resharding; hot keys are a separate axis you solve with replication and caching. Naming that limitation out loud is exactly the kind of trade-off talk an interviewer is listening for.

Maya: And for rate limiting across many servers — if my limiter lives on ten machines, how exactly do they agree on one client's token count without a shared bottleneck?

Leo: That is the distributed rate-limiting question, and the honest answer is you pick your spot on a trade-off. The simplest correct design keeps the count in one shared fast store, like a single Redis holding the token count and timestamp, and every server does the lazy-refill arithmetic against it — one round trip per request, strictly correct, but that store is now a hot dependency. If you cannot afford the round trip, you shard the allowance: give each of the ten machines a tenth of the budget locally, which removes the coordination entirely but lets a client slightly exceed the global limit when its traffic is lopsided across machines. So it is the same theme as consensus — perfect global correctness costs coordination, and you decide how much slack you can tolerate to buy speed. The bug to avoid is assuming ten independent local limiters magically enforce a global limit; they do not, and pretending they do is how a "hundred per second" limit quietly becomes a thousand.

Maya: Let me say the whole toolbox back to make sure it is loaded. Consistent hashing puts servers and keys on a ring so adding or removing a server only moves the keys in one arc, and virtual nodes even out the load. Token bucket rate limiting stores a count and a timestamp and lazily refills, allowing bursts up to capacity, while a sliding window enforces a strict rolling count. Quorum keeps replicas correct by making read and write sets overlap through R plus W greater than N, and majority-based consensus like Raft rides on the fact that any two majorities intersect, which prevents two leaders and split brain. And the least-recently-used cache pairs a hash map with a doubly linked list for constant-time lookup, promotion, and eviction.

Leo: That is the whole set, and the thing to underline is the recognition habit, because that is what turns a vague design question into a concrete algorithm in seconds. "Spread keys, cheap to add a server" means a hash ring. "Cap or smooth traffic" means a token bucket, or a sliding window if bursts are forbidden. "Stay correct when a node dies" means quorum and majority. "Fast hot data, bounded memory" means the least-recently-used cache. Each one is a small algorithm with a sharp correctness argument and a clear failure mode, and naming the tool plus its trade-off out loud is exactly what a strong system-design answer sounds like.

Maya: So the goal is not to memorize a hundred designs. It is to recognize which of these few algorithms the question is secretly asking for, then reason about the trade-off it forces.

Leo: That is exactly it. Pick the tool from the signal, state the mechanism in one breath, and then talk about the trade-off — burst versus smoothness, consistency versus availability, memory versus hit rate. Four algorithms, drilled until the recognition is automatic, and the open-ended system-design round stops being open-ended and starts being a short, defensible series of concrete algorithm choices you can defend under real pressure.`;

// Part 1 (Consistent Hashing: ring + virtual nodes, minimal remapping): >= 200 words.
export const PART1_SCRIPT = `Leo: Start with consistent hashing, and anchor it against the naive approach so the win is obvious. Take the naive scheme: server equals hash of the key modulo N. It balances load, but change N by one and the modulus changes for almost every key, so nearly all of them relocate — that is the failure, a cache-miss storm or a full data reshuffle.

Maya: Why does changing N by just one reshuffle almost every key?

Leo: Because modulo ties every key's destination to the exact value of N, so a new divisor rewrites the remainder for keys all over the table at once. Now picture the fix: hash each server and each key onto a ring, like a clock face that wraps around. A key is owned by the first server clockwise from its position.

Maya: How exactly does adding a server move so few keys on that ring?

Leo: Adding a server drops one new point on the ring, and it only captures the keys in the single arc between it and the previous server going counter-clockwise; every other key still walks clockwise to the same server as before. So adding one of N servers moves about one-Nth of the keys, not all of them — ownership is local to an arc.

Maya: So does that mean the load can end up lopsided if a server lands in a sparse arc?

Leo: Exactly, and that is the trap with one point per server — uneven arcs, so an unlucky server owns a giant slice. Give each server many virtual replicas scattered around the ring and its share becomes many small arcs that average to a fair portion.

Maya: And what changes when a server dies?

Leo: Its arcs spill to several different neighbors instead of dumping the whole load onto one successor. To find a key's owner fast you keep the occupied positions sorted and binary-search for the next one clockwise — order log n per lookup, using the same array-of-positions shape you would reach for in code.

Maya: Why keep the positions sorted rather than scanning the whole ring each lookup?

Leo: Because a linear scan of every point is order n per lookup, and with hundreds of virtual nodes that is slow on the hot path. A sorted array lets a binary search jump straight to the next position clockwise in logarithmic time, and inserting a new server's points keeps that array sorted — so lookups stay fast even as the cluster grows.`;

// Part 2 (Rate Limiting: token bucket lazy refill vs sliding window): >= 200 words.
export const PART2_SCRIPT = `Leo: Now rate limiting, and the default tool is the token bucket. Picture a bucket with a fixed capacity of tokens that refills at a steady rate — take the example of five tokens, one per second. Each request spends one token; if the bucket is empty the request is rejected. Because tokens accumulate while things are quiet, a client can spend a whole bucket at once as a burst, then is throttled back to the drip rate.

Maya: How exactly do you refill without running a timer per client?

Leo: You store two numbers: the token count and the timestamp of the last request. On each new request you compute the elapsed time, multiply by the refill rate, add that many tokens, and cap at capacity — lazy refill, computed only when a request touches the bucket. Two numbers and a subtraction; no background thread.

Maya: What changes if I forget the cap and just keep adding tokens?

Leo: Then a client that was quiet for an hour accumulates thousands of tokens and can unleash a massive burst that swamps the service — that is the classic bug, and the cap at capacity is exactly what prevents it. The capacity is your maximum allowed burst; without it the limiter is basically off.

Maya: So does that mean I should always prefer the token bucket over a sliding window?

Leo: No — it depends on whether bursts are allowed. A sliding-window counter keeps recent timestamps and counts how many fall inside the last window, allowing the request only if that count is under the limit. It enforces a strict "at most X per rolling window" with no saved-up burst.

Maya: And how does that compare to the leaky bucket?

Leo: The leaky bucket is the mirror image — a queue of requests draining at a fixed rate — which smooths the output stream completely but adds latency, because a request may wait in line. So the token bucket tolerates spikes and enforces an average, the sliding window is strict per window, and the leaky bucket trades latency for perfectly smooth output. Same family, three different trade-offs.

Maya: Why is the token bucket the usual default of the three?

Leo: Because real traffic is bursty and users hate being throttled for a brief, harmless spike, so allowing a bounded burst up to capacity while still enforcing the long-run average is the friendliest behavior — and it costs only two stored numbers per client. You reach for the stricter sliding window or the smoothing leaky bucket only when the requirement specifically forbids bursts or demands a perfectly even output stream.`;
