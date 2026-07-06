#!/usr/bin/env tsx
/**
 * P4.1 — Lesson 10 of the "Coding Interview Mastery" subject (id 9):
 * "System Design Algorithmic Patterns: Consistent Hashing, Rate Limiting, Quorum, LRU".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in this
 * env). This is an INTEGRATION lesson: the system-design round is a recognition
 * game over a small, finite toolbox of real algorithms. The unifying mental model:
 * hear the signal, reach for the tool, state the trade-off. Four tools loaded —
 * consistent hashing (spread keys so adding a server moves few), rate limiting
 * (token bucket = amortized allowance, sliding window = strict count), quorum &
 * consensus (R + W > N so read/write sets overlap; majority prevents split brain),
 * and the LRU cache (hash map + doubly linked list for O(1) get/put/evict).
 *
 * Structure mirrors the Graph / DP lessons: top-level 2-host overview audio +
 * orientation visual, two collapsed lesson_parts (Consistent Hashing via the ring;
 * Rate Limiting via the token bucket) each with a bespoke approved artifact +
 * per-part audio synced visual + scaffolded code + mixed practice (incl.
 * pattern_recognition), a final integrator practice_code (RecentCounter / LC 933,
 * sliding-window log), an adaptive MC + freeform assessment (which also probes
 * consensus/quorum), and a timed code_drill (LRU Cache / LC 146). Cue timings are
 * provisional and rescaled to the real generated audio duration by
 * rescale-systemdesign-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-sysdesign-overview-map, algo-sysdesign-ring, algo-sysdesign-ratelimit
 *
 * Idempotent: replaces any prior seq=9 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-systemdesign.ts
 */

import { getDb, closeDb } from "../src/db/connection";
import {
  validateLessonPartContent,
  validatePracticeCodeContent,
  validateAssessmentContent,
  validateAudioSyncedVisualContent,
  validateNextLessonDiagnostics,
  validateCodeDrillContent,
} from "../src/lib/lesson-content/schema";
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/system-design-audio";

const SUBJECT_ID = 9;
const SEQ = 9;

const A_OVERVIEW = "algo-sysdesign-overview-map";
const A_RING = "algo-sysdesign-ring";
const A_RATE = "algo-sysdesign-ratelimit";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "sysdesign-orientation",
    title: "System design is a recognition game over a small toolbox of algorithms",
    motif: "signal-to-tool",
    description:
      "Orientation for the whole pattern. The system-design round feels open-ended, but underneath the whiteboarding is a finite set of algorithms, and the interview is mostly: hear the signal, reach for the right tool, and defend the trade-off. Four tools load here. Consistent hashing places servers and keys on a ring so adding or removing a server only moves the keys in one arc, and virtual nodes even out the load. Token-bucket rate limiting stores a count and a timestamp and lazily refills, allowing bursts up to capacity, while a sliding window enforces a strict rolling count. Quorum keeps replicas correct by making read and write sets overlap through R plus W greater than N, and majority-based consensus like Raft rides on the fact that any two majorities intersect, which prevents two leaders and split brain. And the least-recently-used cache pairs a hash map with a doubly linked list for constant-time lookup, promotion, and eviction.",
    panels: [
      {
        id: "habit",
        title: "The recognition habit",
        kind: "flow" as const,
        description: "Turn a vague design prompt into a concrete algorithm choice in seconds.",
        data: [
          { label: "hear the signal in the prompt", value: "spread keys · cap traffic · survive failure · fast hot data", role: "input" as const },
          { label: "reach for the tool", value: "ring · token bucket · quorum · LRU", role: "process" as const },
          { label: "defend the trade-off", value: "burst vs smooth · consistency vs availability", role: "output" as const },
        ],
      },
      {
        id: "tools",
        title: "Four tools, four signals",
        kind: "cards" as const,
        description: "Each is a small algorithm with a sharp correctness argument and a clear failure mode.",
        data: [
          { label: "consistent hashing", value: "cheap resharding on a ring", role: "context" as const },
          { label: "rate limiting", value: "token bucket · sliding window", role: "context" as const },
          { label: "quorum · LRU", value: "majority overlap · O(1) cache", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 210, label: "Recognition game", headline: "A small toolbox hides in system design", narration: "The system-design round is mostly recognition: hear the signal, reach for the tool, defend the trade-off.", receive: "an open-ended prompt", transform: "spot the signal", pass: "a concrete algorithm" },
    { start: 210, end: 420, label: "Modulo fails", headline: "Change N and everything reshuffles", narration: "Server equals hash modulo N reshuffles almost every key when N changes — a cache-miss storm.", receive: "a resize", transform: "recompute modulo", pass: "near-total remap" },
    { start: 420, end: 630, label: "The ring", headline: "Ownership is local to an arc", narration: "Place servers and keys on a ring; a new server only steals one arc, so adding one of N moves about one-Nth of the keys.", receive: "a new server", transform: "claim one arc", pass: "minimal remap" },
    { start: 630, end: 840, label: "Token bucket", headline: "Lazy refill, bounded burst", narration: "Store a count and a timestamp; refill on demand. Bursts up to capacity are allowed, then throttled to the drip rate.", receive: "a request", transform: "refill then spend", pass: "allow or reject" },
    { start: 840, end: 1050, label: "Sliding window", headline: "Strict rolling count", narration: "A sliding-window counter forbids bursts: it counts recent timestamps and allows only if the count is under the limit.", receive: "a request", transform: "count the window", pass: "strict limit" },
    { start: 1050, end: 1300, label: "Quorum", headline: "R + W > N forces overlap", narration: "Make read and write sets overlap so a read always sees the latest write; majorities always intersect.", receive: "replicated data", transform: "read/write a majority", pass: "guaranteed freshness" },
    { start: 1300, end: 1500, label: "Consensus", headline: "Majority prevents split brain", narration: "Only the side with a strict majority may make progress, so two leaders can never both commit.", receive: "a partition", transform: "require a majority", pass: "one consistent history" },
    { start: 1500, end: 1680, label: "LRU cache", headline: "Map + list = O(1) evict", narration: "A hash map plus a doubly linked list gives constant-time lookup, move-to-front, and evict-from-back.", receive: "a cache hit or miss", transform: "promote or evict", pass: "bounded fast cache" },
  ],
};

// ── Reading builder helpers ───────────────────────────────────────────────────
const ringComplexity = {
  type: "formula",
  latex: "\\text{lookup } O(\\log n) \\qquad \\text{remap on } \\pm 1 \\text{ node } \\approx O(K/N)",
  plain_english:
    "With the occupied ring positions kept in a sorted array, finding a key's owner is a binary search for the next position clockwise — O(log n) where n is the number of ring points (servers times virtual replicas). The headline property is the remap cost: adding or removing one of N servers only relocates the keys in that server's arc, about K/N of the K keys, instead of the near-total reshuffle that hash-modulo-N causes when N changes. Virtual nodes multiply n by the replica count to smooth the arc sizes, trading a little memory and lookup time for balanced load.",
  variables: [
    { symbol: "n", meaning: "ring points = servers × virtual replicas" },
    { symbol: "K", meaning: "the number of keys stored" },
    { symbol: "N", meaning: "the number of physical servers" },
    { symbol: "O(K/N)", meaning: "keys that move when one server joins or leaves" },
  ],
};

const rateComplexity = {
  type: "formula",
  latex: "\\text{token bucket } O(1) \\text{ time, } O(1) \\text{ state per client}",
  plain_english:
    "The token bucket stores exactly two numbers per client — the current token count and the timestamp of the last request — and each request does a constant amount of work: compute elapsed time, add elapsed times the refill rate, cap at capacity, then spend one token if available. No background timer and no per-request scan, so it is O(1) time and O(1) space per client. A sliding-window log instead stores the recent request timestamps, so it is O(1) amortized per request but O(w) space for the w requests inside the window; a fixed-window counter is O(1) space but allows a double-rate burst across a window boundary.",
  variables: [
    { symbol: "O(1) \\text{ time}", meaning: "one arithmetic refill + one compare per request" },
    { symbol: "O(1) \\text{ state}", meaning: "token count + last timestamp per client" },
    { symbol: "\\text{capacity}", meaning: "the maximum allowed burst size" },
    { symbol: "\\text{refill rate}", meaning: "the enforced long-run average rate" },
  ],
};

// ── Part 1: Consistent Hashing (the ring) ─────────────────────────────────────
const part1 = {
  part_id: "sysdesign-part-1-consistent-hashing",
  reading: {
    blocks: [
      { type: "heading", text: "Consistent hashing: a ring so adding a server moves few keys" },
      {
        type: "paragraph",
        text:
          "Consistent hashing exists to fix one specific failure of the obvious approach. The naive scheme is server = hash(key) mod N: it spreads keys evenly for a fixed N, but the moment N changes — you add or remove a server — the modulus changes for almost every key, so nearly all of them map to a different server. In a distributed cache that is a near-total cache-miss storm; in a sharded database it means physically moving almost all the data. Consistent hashing removes that pain by putting both servers and keys on a ring (a hash space that wraps around, like a clock face). A key is owned by the first server you meet walking clockwise from the key's position. Now adding a server drops a single new point on the ring, and it only captures the keys in the one arc between it and the previous server going counter-clockwise; every other key still walks clockwise to the same server as before. So adding one of N servers relocates only about one-Nth of the keys. Ownership is local to an arc, a new node touches one arc, so only that arc's keys move.",
      },
      {
        type: "definition",
        term: "The ring + virtual nodes",
        definition:
          "The ring is a circular hash space; each server and each key hashes to a point on it, and a key belongs to the first server clockwise from its point. Virtual nodes address load balance: instead of one point per server you hash each server to many replicas scattered around the ring, so each physical server owns many small arcs that average to a fair share, and when a server leaves its arcs spill to several different neighbors instead of dumping the whole load onto one successor. To find an owner fast you keep the occupied positions in a sorted array and binary-search for the next one clockwise (with wraparound), which is O(log n).",
      },
      {
        type: "example",
        body:
          "Ring positions 0..360. Servers A@50, B@140, C@230, D@320. A key hashing to 10 walks clockwise to 50 → owned by A; 100 → B; 160 → C; 200 → C; 300 → D; 340 wraps past the top back to 50 → A. Now add server E@180: only keys landing in the arc (140,180] move — a key at 160 shifts from C to E, while 100 (still B) and 200 (still C) are untouched. Adding one server moved a single key's owner, not the whole table.",
      },
      {
        type: "callout",
        text:
          "Two things the ring does NOT solve. First, hot keys: the ring balances the NUMBER of keys per server, not the TRAFFIC per key, so one celebrity key can still hammer its owner — fix that with replication of the hot key plus a front cache, a separate axis from placement. Second, skipping virtual nodes: with one point per server the arcs are uneven and an unlucky server owns a giant slice, so always use many replicas. Claiming 'even key count means even load' is the classic misconception.",
      },
      ringComplexity,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_RING,
      scene: {
        scene_id: "sysdesign-ring-scene",
        title: "Servers and keys on a ring; a new server only steals one arc",
        motif: "ring-arc-ownership",
        description: "The walk of consistent hashing on a ring: four servers A, B, C, D sit at fixed points; six keys each belong to the first server clockwise; adding virtual replicas smooths the arcs; adding a new server relocates only the keys in a single arc, and removing one spills its arc to the next neighbor — never a full reshuffle.",
        panels: [
          {
            id: "own",
            title: "Ownership",
            kind: "ledger" as const,
            description: "How a key finds its server.",
            data: [
              { label: "hash key onto the ring", value: "a point 0..max", role: "input" as const },
              { label: "walk clockwise to the first server", value: "that server owns it", role: "process" as const },
              { label: "add a server → one arc moves", value: "≈ K/N keys", role: "output" as const },
            ],
          },
          {
            id: "balance",
            title: "Why virtual nodes",
            kind: "matrix" as const,
            description: "Many replicas even out the arcs.",
            data: [
              { label: "one point per server", value: "uneven arcs, hot server", role: "context" as const },
              { label: "many replicas per server", value: "fair average share", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Modulo fails", headline: "Change N, reshuffle all", narration: "Server equals hash modulo N reshuffles nearly every key when N changes — a cache-miss storm.", receive: "a resize", transform: "recompute modulo", pass: "near-total remap" },
        { start: 30, end: 62, label: "The ring", headline: "First server clockwise owns it", narration: "Put servers and keys on a ring; a key is owned by the first server clockwise from its point.", receive: "a key's hash", transform: "walk clockwise", pass: "its owner" },
        { start: 62, end: 95, label: "Add a server", headline: "Only one arc moves", narration: "A new server drops one point and only steals the keys in its arc — about one-Nth of them.", receive: "a new server", transform: "claim one arc", pass: "minimal remap" },
        { start: 95, end: 128, label: "Virtual nodes", headline: "Many replicas smooth load", narration: "One point per server gives uneven arcs; many replicas per server average to a fair share.", receive: "an unlucky placement", transform: "add replicas", pass: "balanced load" },
        { start: 128, end: 150, label: "Fast lookup", headline: "Binary search the ring", narration: "Keep the positions sorted and binary-search for the next one clockwise — order log n per lookup.", receive: "a key", transform: "bisect the positions", pass: "the owner in log n" },
        { start: 150, end: 165, label: "Remove a server", headline: "Its arc spills to a neighbor", narration: "Removing a server hands its arc to the next neighbor clockwise; nothing else moves.", receive: "a departure", transform: "spill one arc", pass: "the rest untouched" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk consistent hashing on the ring: place four servers, resolve six keys to their clockwise owner, add virtual replicas to smooth the arcs, then add and remove a server. Watch that adding or removing a node only relocates the keys in a single arc — never the whole table.",
    params: { artifact_slug: A_RING, min_height: 380 },
  },
  code: {
    prompt:
      "Implement the core consistent-hashing lookup: find_owner(ring, key_pos). The ring is a list of (position, node) sorted by position ascending; key_pos is the key's hash point on the ring. Return the node that owns the key — the first node whose position is >= key_pos, wrapping around to the first node if key_pos is past the last position. Return None for an empty ring. Fill in the TODO using a binary search (bisect) over the positions.",
    starter_code:
      "import bisect\n\ndef find_owner(ring, key_pos):\n    # ring: list of (position, node) sorted by position ascending\n    # key_pos: the key's hash point on the ring\n    if not ring:\n        return None\n    positions = [p for p, _ in ring]\n    # TODO: binary-search for the first position >= key_pos, wrapping around:\n    #   idx = bisect.bisect_left(positions, key_pos) % len(ring)\n    #   return ring[idx][1]\n    pass\n",
    constraints: [
      "Use bisect on the sorted positions — do not linear-scan the ring; lookup must be O(log n).",
      "Wrap around: if key_pos is past the last position, the owner is the FIRST node (the ring is circular). Use % len(ring).",
      "A key exactly on a node's position is owned by that node (use bisect_left so >= matches). Return None for an empty ring.",
    ],
    walkthrough: {
      title: "The clockwise owner via binary search",
      steps: [
        { title: "Guard the empty ring", detail: "If there are no (position, node) entries, there is no owner — return None.", input: "the ring", output: "None or continue" },
        { title: "Binary-search the positions", detail: "bisect_left over the sorted positions finds the index of the first position >= key_pos — the next server clockwise.", input: "key_pos", output: "an insertion index" },
        { title: "Wrap around", detail: "If the index equals the length (key_pos is past the last point), the circular ring wraps to index 0. Take the index mod len(ring) and return that node.", input: "the index", output: "the owning node" },
      ],
    },
    io_examples: [
      { label: "clockwise", input: "ring = [(50,'A'),(140,'B'),(230,'C'),(320,'D')], key_pos = 100", expected_output: "'B'", explanation: "100 walks clockwise to the first position >= 100, which is 140 → B." },
      { label: "wrap", input: "ring = [(50,'A'),(140,'B'),(230,'C'),(320,'D')], key_pos = 340", expected_output: "'A'", explanation: "340 is past the last point 320, so it wraps around to the first server A@50." },
      { label: "empty", input: "ring = [], key_pos = 5", expected_output: "None", explanation: "No servers on the ring, so there is no owner." },
    ],
    visualization: {
      title: "hash onto the ring · walk clockwise · wrap at the top",
      description: "The owner is the first position at or after the key, circularly.",
      items: [
        { label: "positions sorted on the ring", value: "the servers", role: "input" },
        { label: "bisect_left for first >= key_pos", value: "next clockwise", role: "process" },
        { label: "index % len → node", value: "the owner", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The clockwise-owner lookup",
        code:
          "import bisect\ndef find_owner(ring, key_pos):\n    if not ring:\n        return None\n    positions = [p for p, _ in ring]\n    idx = bisect.bisect_left(positions, key_pos) % len(ring)\n    return ring[idx][1]",
        explanation: "One binary search plus a wraparound modulo. O(log n) per lookup because the positions are sorted.",
      },
      {
        label: "concise",
        title: "Adding a server only moves one arc",
        code:
          "import bisect\ndef add_server(ring, pos, node):\n    # keep the ring sorted so lookups stay O(log n)\n    positions = [p for p, _ in ring]\n    i = bisect.bisect_left(positions, pos)\n    ring.insert(i, (pos, node))\n    return ring\n# A key only changes owner if it lands in the new server's arc;\n# every other key's clockwise walk is unchanged.",
        explanation: "Inserting a server keeps the array sorted and only affects the keys in its single arc — the whole point of consistent hashing versus hash-modulo-N.",
      },
    ],
    hints: [
      { level: 1, text: "If the ring is empty, return None. Otherwise extract the sorted positions: positions = [p for p, _ in ring]." },
      { level: 2, text: "The owner is the first server clockwise, i.e. the first position >= key_pos. bisect_left(positions, key_pos) gives that index." },
      { level: 3, text: "If key_pos is past the last position, bisect returns len(ring); the circular ring wraps to index 0, so take the index % len(ring)." },
      { level: 4, text: "Return the node at that index: ring[idx][1]." },
      { level: 5, text: "A key exactly on a node's position should be owned by that node — bisect_left makes >= match, which is correct." },
    ],
    tests: [
      { id: "t_b", description: "clockwise to B", assert: "assert find_owner([(50,'A'),(140,'B'),(230,'C'),(320,'D')], 100) == 'B'" },
      { id: "t_c", description: "clockwise to C", assert: "assert find_owner([(50,'A'),(140,'B'),(230,'C'),(320,'D')], 160) == 'C'" },
      { id: "t_wrap", description: "wraps to A", assert: "assert find_owner([(50,'A'),(140,'B'),(230,'C'),(320,'D')], 340) == 'A'" },
      { id: "t_empty", description: "empty ring", assert: "assert find_owner([], 5) is None" },
    ],
    hidden_tests: [
      { id: "h_on", description: "key exactly on a node", assert: "assert find_owner([(50,'A'),(140,'B'),(230,'C'),(320,'D')], 50) == 'A'" },
      { id: "h_single", description: "single server owns all", assert: "assert find_owner([(50,'A')], 999) == 'A'" },
      { id: "h_add", description: "adding E only moves the 160 key to E", assert: "assert find_owner(sorted([(50,'A'),(140,'B'),(230,'C'),(320,'D'),(180,'E')]), 160) == 'E'" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "s1-so-1",
        type: "select_one",
        prompt: "Why does hash(key) mod N reshuffle almost every key when you add one server?",
        concept: "consistent-hashing",
        difficulty: "easy",
        choices: [
          "The modulus changes for nearly every key when N changes, so their destinations all shift at once",
          "Adding a server rehashes only the keys on the new server",
          "The keys are stored in sorted order and must be re-sorted",
          "Hashing is non-deterministic, so keys move randomly",
        ],
        correct_index: 0,
        explanation: "mod N ties every key's destination to the exact value of N, so a new divisor rewrites the remainder for keys all over the table.",
      },
      {
        id: "s1-sa-multi",
        type: "select_all",
        prompt: "Which statements about consistent hashing on a ring are true?",
        concept: "consistent-hashing",
        difficulty: "medium",
        choices: [
          "A key is owned by the first server clockwise from its position",
          "Adding one of N servers relocates only about K/N keys",
          "Virtual nodes give each server many small arcs to balance load",
          "The ring guarantees even TRAFFIC across servers even with a hot key",
        ],
        correct_indices: [0, 1, 2],
        explanation: "The ring balances key COUNT, not traffic — a hot key still hammers its owner, so that last claim is false.",
      },
      {
        id: "s1-sa-none",
        type: "select_all",
        prompt: "On the ring A@50, B@140, C@230, D@320, which of these ownerships are correct? (If none, select none.)",
        concept: "consistent-hashing",
        difficulty: "hard",
        choices: [
          "A key at position 100 is owned by A",
          "A key at position 340 is owned by D",
          "A key at position 200 is owned by B",
        ],
        correct_indices: [],
        explanation: "None: 100 → B (first clockwise), 340 wraps to A, and 200 → C. All three stated owners are wrong.",
      },
      {
        id: "s1-order",
        type: "ordering",
        prompt: "Order the steps of finding a key's owner on a sorted ring.",
        concept: "consistent-hashing",
        difficulty: "medium",
        items: [
          "Hash the key to a point on the ring",
          "Binary-search the sorted positions for the first one >= the key's point",
          "If the search runs past the end, wrap the index around to 0",
          "Return the server at that ring position",
        ],
        correct_order: [
          "Hash the key to a point on the ring",
          "Binary-search the sorted positions for the first one >= the key's point",
          "If the search runs past the end, wrap the index around to 0",
          "Return the server at that ring position",
        ],
      },
      {
        id: "s1-pattern",
        type: "pattern_recognition",
        prompt: "\"Distribute cached objects across a fleet of cache servers so that adding or retiring a server rebalances as little data as possible.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Consistent Hashing (hash ring)", "Virtual nodes for load balance", "Two Pointer", "Dynamic Programming", "Binary Search"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Minimal-rebalance distribution across servers is the consistent-hashing ring; virtual nodes are the standard companion for even load.",
      },
      {
        id: "s1-written",
        type: "written",
        prompt: "Explain precisely why adding one server to a consistent-hashing ring moves only about K/N keys, while hash-modulo-N moves almost all of them.",
        concept: "consistent-hashing",
        difficulty: "hard",
        actual_answer:
          "With hash-modulo-N, a key's server is hash(key) mod N, so the destination depends on the exact value of N. Change N from ten to eleven and the remainder changes for almost every key at once, because the modulus applies globally — so nearly all K keys relocate, causing a full cache-miss storm or data reshuffle. On a ring, ownership is instead LOCAL to an arc: each key belongs to the first server clockwise from its point, and each server owns the arc between it and the previous server. Adding a server drops a single new point on the ring, and the only keys that change owner are the ones sitting in the arc between the new point and the previous server going counter-clockwise — those keys used to walk clockwise to the old next server and now stop at the new one. Every other key's clockwise walk is completely unchanged, so it stays on the same server. Because the new server captures roughly one arc out of N, it steals about K/N keys, not all of them. Virtual nodes preserve this while smoothing balance: the new server's replicas each steal a small arc from a different neighbor, so its K/N share is spread across the cluster rather than taken from one server.",
        rubric:
          "Full credit: mod N ties destination to N so changing N rewrites nearly every key; ring ownership is local to an arc so a new node only steals its own arc (≈ K/N) and every other key's clockwise walk is unchanged. Partial: says 'the ring moves fewer keys' without the arc-locality reason. Low: vague.",
      },
    ],
  },
};

// ── Part 2: Rate Limiting (token bucket) ──────────────────────────────────────
const part2 = {
  part_id: "sysdesign-part-2-rate-limiting",
  reading: {
    blocks: [
      { type: "heading", text: "Rate limiting: the token bucket, lazy refill, and the burst trade-off" },
      {
        type: "paragraph",
        text:
          "When the requirement is 'no client may exceed X requests per unit time' or 'smooth bursty traffic', the default tool is the token bucket. Picture a bucket that holds up to a fixed CAPACITY of tokens, refilling at a steady RATE — say five tokens capacity, one token per second. Every request must spend one token to proceed; an empty bucket means the request is rejected or made to wait. The property that makes it the friendly default is the controlled burst: while traffic is quiet the bucket fills up, so a client can spend all five tokens at once as a short spike, then is throttled back to the drip rate of one per second. The implementation is deliberately tiny and needs no background timer. You store just two numbers per client — the current token count and the timestamp of the last request. When a request arrives you compute the elapsed time since that timestamp, multiply by the refill rate to get how many tokens would have dripped in, add them (capped at capacity), then spend one if available. That is LAZY refill: the tokens are computed on demand, only when a request touches the bucket, so a client that is idle for an hour costs nothing until its next request. Two numbers and a subtraction per request — O(1) time and space, which scales to millions of clients.",
      },
      {
        type: "definition",
        term: "Token bucket vs sliding window vs leaky bucket",
        definition:
          "The token bucket allows bounded bursts (up to capacity) while enforcing a long-run average — good when short spikes are acceptable. A sliding-window counter keeps the timestamps of recent requests and allows a request only if the count inside the trailing window is under the limit, enforcing a strict 'at most X per rolling window' with no saved-up burst. A leaky bucket queues requests and drains them at a fixed rate, smoothing the OUTPUT stream perfectly but adding latency because a request may wait in line. Same family; the trade-off axis is burst tolerance versus smoothness, and you pick from the requirement.",
      },
      {
        type: "example",
        body:
          "Capacity 5, refill 1/sec, bucket starts full. Three requests at t=0 → 3 tokens spent, 2 left, all allowed. A burst of 4 more at t=0 → only 2 allowed (bucket hits 0), 2 rejected. Wait until t=3s → lazy refill adds min(5, 0 + 3×1) = 3 tokens, so 3 are available again. No timer ran; the refill was computed from the elapsed 3 seconds on the next request.",
      },
      {
        type: "callout",
        text:
          "Two traps. First, forgetting the CAP: if you keep adding tokens without capping at capacity, an idle client accumulates thousands and can unleash a burst that swamps the service — the cap IS the maximum allowed burst, and without it the limiter is effectively off. Second, distributing naively: ten independent local limiters, each with a tenth of the budget, do NOT enforce a global limit when a client's traffic is lopsided across servers — assuming they do is how a 'hundred per second' limit quietly becomes a thousand. Use a shared store for strict global correctness, or accept bounded slack for speed.",
      },
      rateComplexity,
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_RATE,
      scene: {
        scene_id: "sysdesign-ratelimit-scene",
        title: "A bucket of tokens: refill on demand, spend one per request, cap the burst",
        motif: "token-bucket-drain-refill",
        description: "The walk of the token bucket: capacity 5, refill 1/sec, starts full. Requests drain tokens; a burst empties the bucket and further requests are rejected; elapsed time lazily refills the tokens up to capacity; a sliding-window counter is contrasted as the strict, no-burst alternative.",
        panels: [
          {
            id: "op",
            title: "The request step",
            kind: "ledger" as const,
            description: "What one request does to the bucket.",
            data: [
              { label: "elapsed × rate, capped at capacity", value: "lazy refill", role: "input" as const },
              { label: "token available? spend it", value: "allow", role: "process" as const },
              { label: "bucket empty?", value: "reject", role: "output" as const },
            ],
          },
          {
            id: "compare",
            title: "Burst vs strict",
            kind: "matrix" as const,
            description: "Two answers, different guarantees.",
            data: [
              { label: "token bucket", value: "bursts up to capacity, average rate", role: "context" as const },
              { label: "sliding window", value: "strict count per rolling window", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Full bucket", headline: "Capacity 5, refill 1/sec", narration: "The bucket holds up to a capacity of tokens and refills at a steady rate; each request spends one.", receive: "an idle bucket", transform: "fill to capacity", pass: "ready tokens" },
        { start: 30, end: 62, label: "Spend tokens", headline: "Three requests, three tokens", narration: "Three requests at once spend three tokens; all are allowed while the bucket has tokens.", receive: "requests", transform: "spend one each", pass: "allowed" },
        { start: 62, end: 95, label: "Burst empties it", headline: "Extra requests rejected", narration: "A burst drains the bucket to zero; once empty, further requests are rejected until it refills.", receive: "a burst", transform: "drain to zero", pass: "some rejected" },
        { start: 95, end: 128, label: "Lazy refill", headline: "Elapsed × rate, capped", narration: "On the next request, elapsed time times the rate refills the tokens, capped at capacity — no timer.", receive: "elapsed time", transform: "compute the refill", pass: "tokens restored" },
        { start: 128, end: 150, label: "Sliding window", headline: "Strict rolling count", narration: "The sliding-window counter forbids bursts: it counts recent timestamps and allows only under the limit.", receive: "a request", transform: "count the window", pass: "strict allow/deny" },
        { start: 150, end: 165, label: "Pick the tool", headline: "Burst vs smoothness", narration: "Token bucket for friendly bursts and an average; sliding window when bursts are forbidden.", receive: "a requirement", transform: "match the trade-off", pass: "the right limiter" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk the token bucket: a full bucket of 5 tokens, three requests draining it, a burst that empties it and rejects the overflow, then a lazy refill after time passes. The final step contrasts the sliding-window counter, which enforces a strict rolling count with no saved-up burst.",
    params: { artifact_slug: A_RATE, min_height: 380 },
  },
  code: {
    prompt:
      "Implement a token-bucket rate limiter over a stream of requests: token_bucket(capacity, refill_rate, requests). requests is a list of arrival times in seconds, non-decreasing. The bucket starts FULL (capacity tokens) at time 0 with last=0. For each request time, LAZILY refill (tokens = min(capacity, tokens + (now - last) * refill_rate), set last = now), then if at least 1 token is available spend one and allow (append True), else reject (append False). Return the list of booleans. Fill in the TODO.",
    starter_code:
      "def token_bucket(capacity, refill_rate, requests):\n    tokens = float(capacity)   # start full\n    last = 0.0\n    out = []\n    for now in requests:\n        # TODO: lazy refill, then spend one token if available\n        #   tokens = min(capacity, tokens + (now - last) * refill_rate)\n        #   last = now\n        #   if tokens >= 1:\n        #       tokens -= 1; out.append(True)\n        #   else:\n        #       out.append(False)\n        pass\n    return out\n",
    constraints: [
      "Lazy refill: on each request compute tokens = min(capacity, tokens + (now - last) * refill_rate) and update last = now. Do not run a background timer.",
      "Cap at capacity every refill — an idle client must not accumulate unlimited tokens (that would allow an unbounded burst).",
      "Allow (True) and spend one token only when tokens >= 1; otherwise reject (False) without going negative.",
    ],
    walkthrough: {
      title: "Two numbers per client: count and last timestamp",
      steps: [
        { title: "Start full", detail: "tokens = capacity, last = 0. The bucket begins able to serve a full burst.", input: "capacity", output: "a full bucket" },
        { title: "Lazy refill on each request", detail: "Add (now - last) * refill_rate tokens, capped at capacity, and set last = now. This is computed only when a request arrives.", input: "the arrival time", output: "the refilled count" },
        { title: "Spend or reject", detail: "If tokens >= 1, subtract one and allow; else reject. Record the boolean.", input: "the token count", output: "allow / reject" },
      ],
    },
    io_examples: [
      { label: "burst", input: "capacity=5, refill_rate=1, requests=[0,0,0,0,0,0,0]", expected_output: "[True,True,True,True,True,False,False]", explanation: "Five tokens serve the first five; the bucket is empty for the last two." },
      { label: "refill", input: "capacity=5, refill_rate=1, requests=[0,0,0,3]", expected_output: "[True,True,True,True]", explanation: "Three spent, then 3s elapse and refill to 5, so the fourth is allowed." },
      { label: "steady", input: "capacity=1, refill_rate=1, requests=[0,1,2,3]", expected_output: "[True,True,True,True]", explanation: "One token per second exactly matches one request per second." },
    ],
    visualization: {
      title: "start full · lazy refill · spend or reject",
      description: "Elapsed time refills tokens up to capacity; each request spends one.",
      items: [
        { label: "tokens = capacity, last = 0", value: "full bucket", role: "input" },
        { label: "min(cap, tokens + elapsed*rate)", value: "lazy refill", role: "process" },
        { label: "tokens >= 1 ? allow : reject", value: "the decision", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The token-bucket stream",
        code:
          "def token_bucket(capacity, refill_rate, requests):\n    tokens = float(capacity)\n    last = 0.0\n    out = []\n    for now in requests:\n        tokens = min(capacity, tokens + (now - last) * refill_rate)\n        last = now\n        if tokens >= 1:\n            tokens -= 1\n            out.append(True)\n        else:\n            out.append(False)\n    return out",
        explanation: "Two numbers of state and one arithmetic refill per request. Bursts up to capacity are allowed; the long-run rate is the refill rate.",
      },
      {
        label: "concise",
        title: "The sliding-window-counter alternative (strict, no burst)",
        code:
          "from collections import deque\ndef sliding_window(limit, window, requests):\n    q = deque(); out = []\n    for now in requests:\n        while q and q[0] <= now - window:\n            q.popleft()\n        if len(q) < limit:\n            q.append(now); out.append(True)\n        else:\n            out.append(False)\n    return out",
        explanation: "Count the requests inside the trailing window and allow only if under the limit — no saved-up burst, the stricter guarantee.",
      },
    ],
    hints: [
      { level: 1, text: "Start tokens = capacity (a full bucket) and last = 0. Build an empty output list." },
      { level: 2, text: "For each request time now, first refill: tokens = min(capacity, tokens + (now - last) * refill_rate)." },
      { level: 3, text: "Update last = now so the next elapsed calculation is correct." },
      { level: 4, text: "If tokens >= 1, subtract one and append True; otherwise append False." },
      { level: 5, text: "The min(...) cap is essential — without it an idle client accumulates unlimited tokens and can burst without bound." },
    ],
    tests: [
      { id: "t_burst", description: "5 then reject 2", assert: "assert token_bucket(5, 1, [0,0,0,0,0,0,0]) == [True,True,True,True,True,False,False]" },
      { id: "t_refill", description: "refill after 3s", assert: "assert token_bucket(5, 1, [0,0,0,3]) == [True,True,True,True]" },
      { id: "t_steady", description: "one per second", assert: "assert token_bucket(1, 1, [0,1,2,3]) == [True,True,True,True]" },
      { id: "t_deny", description: "second request denied", assert: "assert token_bucket(1, 1, [0,0]) == [True,False]" },
    ],
    hidden_tests: [
      { id: "h_empty", description: "no requests", assert: "assert token_bucket(3, 1, []) == []" },
      { id: "h_cap", description: "idle does not exceed capacity", assert: "assert token_bucket(2, 1, [0, 100]) == [True, True]" },
      { id: "h_partial", description: "partial refill still short", assert: "assert token_bucket(3, 1, [0,0,0,1]) == [True,True,True,True]" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "s2-so-1",
        type: "select_one",
        prompt: "How does the token bucket refill without a background timer per client?",
        concept: "rate-limiting",
        difficulty: "easy",
        choices: [
          "On each request it adds (elapsed time × refill rate) tokens, capped at capacity — computed lazily",
          "A cron job tops up every bucket each second",
          "It resets to full at the start of every window",
          "It never refills; each client gets a fixed quota once",
        ],
        correct_index: 0,
        explanation: "Lazy refill: store the count and last timestamp, and compute the drip on demand when a request arrives.",
      },
      {
        id: "s2-sa-multi",
        type: "select_all",
        prompt: "Which statements about rate-limiting algorithms are true?",
        concept: "rate-limiting",
        difficulty: "medium",
        choices: [
          "The token bucket allows a burst up to its capacity",
          "A sliding-window counter enforces a strict count per rolling window with no saved-up burst",
          "The leaky bucket smooths output at a fixed drain rate, adding latency",
          "Ten independent local limiters automatically enforce a correct global limit",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Independent local limiters do NOT enforce a global limit under lopsided traffic — that is a classic distributed-rate-limiting bug.",
      },
      {
        id: "s2-sa-none",
        type: "select_all",
        prompt: "For token_bucket(5, 1, [0,0,0,0,0,0,0]), which of these describe the result? (If none, select none.)",
        concept: "rate-limiting",
        difficulty: "hard",
        choices: [
          "All seven requests are allowed",
          "Exactly six are allowed and one is rejected",
          "The first three are rejected and the rest allowed",
        ],
        correct_indices: [],
        explanation: "None: the bucket serves the first FIVE (capacity 5) and rejects the last TWO → [T,T,T,T,T,F,F].",
      },
      {
        id: "s2-order",
        type: "ordering",
        prompt: "Order the steps the token bucket takes when a request arrives.",
        concept: "rate-limiting",
        difficulty: "medium",
        items: [
          "Compute elapsed time since the last request",
          "Add elapsed × refill_rate tokens, capped at capacity",
          "Update the stored last-request timestamp to now",
          "If a token is available, spend one and allow; otherwise reject",
        ],
        correct_order: [
          "Compute elapsed time since the last request",
          "Add elapsed × refill_rate tokens, capped at capacity",
          "Update the stored last-request timestamp to now",
          "If a token is available, spend one and allow; otherwise reject",
        ],
      },
      {
        id: "s2-pattern",
        type: "pattern_recognition",
        prompt: "\"Allow each API key up to 100 requests per minute, but tolerate short bursts when a client has been quiet.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Token Bucket rate limiter", "Lazy refill from elapsed time", "Union Find", "Binary Search", "Consistent Hashing"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Average rate with tolerated bursts is the token bucket; lazy refill from the stored timestamp is its implementation trick.",
      },
      {
        id: "s2-written",
        type: "written",
        prompt: "Explain the trade-off between a token bucket and a sliding-window counter, and give one requirement that would make you choose each.",
        concept: "rate-limiting",
        difficulty: "hard",
        actual_answer:
          "Both cap a client's request rate, but they differ in how they treat bursts. A token bucket stores a token count that refills at a steady rate up to a capacity; a request spends a token, and because tokens accumulate while the client is quiet, the client can spend a whole bucket at once as a short burst, then is throttled back to the refill rate. So it enforces a long-run AVERAGE while tolerating spikes up to capacity. A sliding-window counter instead keeps the timestamps of recent requests and allows a new request only if the number inside the trailing window is below the limit; it enforces a strict 'at most X in any rolling window' with no saved-up burst credit at all. The trade-off is burst tolerance versus strictness: the token bucket is friendlier to real, bursty traffic and cheaper (two numbers of state), while the sliding window gives a hard guarantee that the count never exceeds the limit in any window, at the cost of storing recent timestamps. Choose the token bucket when short bursts are acceptable and you want an average rate — for example a public API that should not punish an occasional spike. Choose the sliding window when bursts are forbidden and the limit must never be exceeded in any window — for example a strict per-user cap on an expensive or abuse-prone operation.",
        rubric:
          "Full credit: token bucket = average rate + bounded burst via accumulated tokens; sliding window = strict rolling count, no burst; trade-off burst-tolerance vs strictness; a concrete requirement for each. Partial: describes both but not the burst-vs-strict trade-off or only one use case. Low: vague.",
      },
    ],
  },
};

// ── Final integrator practice_code: RecentCounter (LC 933) — sliding-window log ─
const finalCode = {
  prompt:
    "Integrator: a monitoring service records ping timestamps that arrive in strictly increasing order. For each ping at time t, return how many pings happened in the inclusive window [t - 3000, t]. Implement recent_calls(pings): given the full list of ping times, return the list where element i is the count in the last 3000 ms up to and including pings[i]. This is a SLIDING-WINDOW LOG — a queue of timestamps, dropping any that fall out of the window from the front. Fill in the TODO.",
  starter_code:
    "from collections import deque\n\ndef recent_calls(pings):\n    q = deque()\n    out = []\n    for t in pings:\n        q.append(t)\n        # TODO: drop timestamps older than the 3000 ms window from the FRONT,\n        #   then record how many remain:\n        #   while q[0] < t - 3000:\n        #       q.popleft()\n        #   out.append(len(q))\n        pass\n    return out\n",
  constraints: [
    "Use a deque as a sliding window of timestamps; append the new ping, then popleft any timestamp strictly less than t - 3000.",
    "The window is inclusive: a ping exactly at t - 3000 still counts (drop only when q[0] < t - 3000).",
    "Record len(q) after trimming — that is the number of pings in the last 3000 ms up to and including the current one.",
  ],
  walkthrough: {
    title: "A sliding window of recent timestamps",
    steps: [
      { title: "Append the new ping", detail: "Add t to the back of the deque; it is by definition inside its own window.", input: "a ping time t", output: "the window plus t" },
      { title: "Trim the front", detail: "Pop timestamps from the front while they are older than t - 3000 (strictly less). Those pings have slid out of the window.", input: "the window", output: "only in-window timestamps" },
      { title: "Count", detail: "The remaining size of the deque is the number of pings in [t - 3000, t].", input: "the trimmed window", output: "the count" },
    ],
  },
  io_examples: [
    { label: "classic", input: "pings = [1, 100, 3001, 3002]", expected_output: "[1, 2, 3, 3]", explanation: "At 3001, the window [1,3001] still includes 1; at 3002, 1 slides out (< 3002-3000=2) but 100,3001,3002 remain → 3." },
    { label: "slide out", input: "pings = [100, 3100, 3200, 4000]", expected_output: "[1, 2, 2, 3]", explanation: "At 3200 the 100 ping is older than 200 and slides out, leaving 3100 and 3200." },
    { label: "single", input: "pings = [5]", expected_output: "[1]", explanation: "One ping is always in its own window." },
  ],
  visualization: {
    title: "append · drop the stale front · count the window",
    description: "A queue of timestamps trimmed to the last 3000 ms.",
    items: [
      { label: "append t to the deque", value: "widen the window", role: "input" },
      { label: "popleft while q[0] < t - 3000", value: "drop stale pings", role: "process" },
      { label: "len(q)", value: "the count", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "The sliding-window-log template",
      code:
        "from collections import deque\ndef recent_calls(pings):\n    q = deque(); out = []\n    for t in pings:\n        q.append(t)\n        while q[0] < t - 3000:\n            q.popleft()\n        out.append(len(q))\n    return out",
      explanation: "Each timestamp is appended once and popped at most once, so the whole pass is O(n) amortized. The deque holds only in-window pings.",
    },
    {
      label: "concise",
      title: "The classic RecentCounter class (LC 933)",
      code:
        "from collections import deque\nclass RecentCounter:\n    def __init__(self):\n        self.q = deque()\n    def ping(self, t):\n        self.q.append(t)\n        while self.q[0] < t - 3000:\n            self.q.popleft()\n        return len(self.q)",
      explanation: "The same sliding-window log exposed as a streaming ping(t) call; recent_calls simply runs it over a whole list of times.",
    },
  ],
  hints: [
    { level: 1, text: "Keep a deque of recent ping timestamps. For each t, append it to the back." },
    { level: 2, text: "The window is the last 3000 ms: any timestamp strictly less than t - 3000 has slid out." },
    { level: 3, text: "Pop from the FRONT while q[0] < t - 3000 — the front holds the oldest pings." },
    { level: 4, text: "After trimming, len(q) is the count of pings in [t - 3000, t]. Append it to the output." },
    { level: 5, text: "Each ping is appended once and removed at most once, so the amortized cost per ping is O(1)." },
  ],
  tests: [
    { id: "f_classic", description: "classic RecentCounter sequence", assert: "assert recent_calls([1, 100, 3001, 3002]) == [1, 2, 3, 3]" },
    { id: "f_slide", description: "an old ping slides out", assert: "assert recent_calls([100, 3100, 3200, 4000]) == [1, 2, 2, 3]" },
    { id: "f_single", description: "single ping", assert: "assert recent_calls([5]) == [1]" },
  ],
  hidden_tests: [
    { id: "hf_empty", description: "no pings", assert: "assert recent_calls([]) == []" },
    { id: "hf_edge", description: "inclusive at exactly t-3000", assert: "assert recent_calls([1000, 4000, 4001]) == [1, 2, 2]" },
    { id: "hf_far", description: "far-apart pings each alone", assert: "assert recent_calls([0, 10000, 20000]) == [1, 1, 1]" },
  ],
};

// ── Timed code drill: LRU Cache (LC 146) ──────────────────────────────────────
const codeDrill = {
  pattern: "lru-cache",
  prompt:
    "One rep, timed: implement an LRU cache and replay a sequence of operations. lru_results(capacity, ops): ops is a list of tuples — ('put', key, value) or ('get', key). Return the list of results of the GET operations in order (the value, or -1 if the key is absent). A get or put makes that key the most-recently-used; when a put exceeds capacity, evict the least-recently-used key. Aim for O(1) per operation (a hash map plus a doubly linked list, or an OrderedDict).",
  target_seconds: 900,
  difficulty: "medium",
  language: "python",
  starter_code:
    "from collections import OrderedDict\n\ndef lru_results(capacity, ops):\n    cache = OrderedDict()\n    out = []\n    for op in ops:\n        if op[0] == 'put':\n            _, k, v = op\n            # TODO: insert/update k, mark it most-recently-used,\n            #   and evict the least-recently-used if over capacity\n            #   if k in cache: cache.move_to_end(k)\n            #   cache[k] = v\n            #   if len(cache) > capacity: cache.popitem(last=False)\n            pass\n        else:  # ('get', k)\n            _, k = op\n            # TODO: append cache[k] and mark it most-recently-used,\n            #   or append -1 if k is absent\n            #   if k in cache:\n            #       cache.move_to_end(k); out.append(cache[k])\n            #   else:\n            #       out.append(-1)\n            pass\n    return out\n",
  tests: [
    { id: "d_classic", description: "classic LC146 sequence", assert: "assert lru_results(2, [('put',1,1),('put',2,2),('get',1),('put',3,3),('get',2),('put',4,4),('get',1),('get',3),('get',4)]) == [1,-1,-1,3,4]" },
    { id: "d_cap1", description: "capacity 1 evicts", assert: "assert lru_results(1, [('put',1,1),('get',1),('put',2,2),('get',1),('get',2)]) == [1,-1,2]" },
    { id: "d_update", description: "put updates value", assert: "assert lru_results(2, [('put',2,1),('put',2,2),('get',2)]) == [2]" },
    { id: "d_miss", description: "absent key is -1", assert: "assert lru_results(2, [('get',9)]) == [-1]" },
    { id: "d_refresh", description: "get refreshes recency", assert: "assert lru_results(2, [('put',1,1),('put',2,2),('get',1),('put',3,3),('get',2)]) == [1,-1]" },
  ],
  hints: [
    { unlock_at_pct: 33, text: "Use an OrderedDict as key → value, treating the front as least-recently-used and the back as most-recently-used." },
    { unlock_at_pct: 66, text: "On get: if the key exists, cache.move_to_end(k) then append cache[k]; else append -1. On put: if present move_to_end, set cache[k]=v." },
    { unlock_at_pct: 100, text: "After a put, if len(cache) > capacity, cache.popitem(last=False) evicts the least-recently-used (front) entry. That is O(1) per op." },
  ],
  solution:
    "from collections import OrderedDict\n\ndef lru_results(capacity, ops):\n    cache = OrderedDict()\n    out = []\n    for op in ops:\n        if op[0] == 'put':\n            _, k, v = op\n            if k in cache:\n                cache.move_to_end(k)\n            cache[k] = v\n            if len(cache) > capacity:\n                cache.popitem(last=False)\n        else:\n            _, k = op\n            if k in cache:\n                cache.move_to_end(k)\n                out.append(cache[k])\n            else:\n                out.append(-1)\n    return out\n",
};

// ── Assessment (adaptive MC + freeform; also probes consensus/quorum) ──────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Explain the 'recognition game' view of the system-design round: name the signal that triggers consistent hashing, rate limiting, quorum/consensus, and an LRU cache, and the one-line mechanism of each.",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "medium",
      actual_answer:
        "The system-design round is mostly recognition: a small set of algorithms hide behind the prompts, and the skill is hearing the signal and reaching for the tool. 'Spread keys across N servers so adding or removing a server moves few keys' signals consistent hashing: hash servers and keys onto a ring, a key belongs to the first server clockwise, virtual nodes smooth the load, and changing N remaps only about K/N keys. 'Cap requests per client or smooth bursty traffic' signals rate limiting: a token bucket refills tokens at a fixed rate up to a capacity and each request spends one, allowing bounded bursts, while a sliding-window counter enforces a strict rolling count with no burst. 'Stay correct when a node fails or agree on one value' signals quorum and consensus: require read and write sets to overlap via R plus W greater than N, and majority-based consensus like Raft commits once a majority acknowledges, because any two majorities intersect. 'Serve hot data fast in bounded memory' signals an LRU cache: a hash map plus a doubly linked list gives O(1) get, put, promote, and evict-least-recently-used. Naming the tool and its trade-off out loud is what a strong system-design answer sounds like.",
      rubric:
        "Full credit: all four signals matched to the right tool with a correct one-line mechanism (ring/clockwise/virtual nodes; token bucket refill + sliding window; R+W>N / majority; map+DLL O(1)). Partial: three of four, or tools without the signals. Low: vague.",
      support_ref: "sysdesign-part-1-consistent-hashing",
    },
    {
      id: "a-free-2",
      text: "Explain the quorum inequality R + W > N and why majority-based consensus prevents split brain. What does the minority side of a network partition have to do, and why?",
      type: "free_text",
      concept: "consensus",
      difficulty: "hard",
      actual_answer:
        "If every piece of data is replicated on N machines, and you require every write to be acknowledged by W machines and every read to consult R machines with R plus W strictly greater than N, then the set a read touches and the set the last write touched must share at least one machine — you cannot pick two subsets that big without an overlap. That shared machine holds the latest write, so the read is guaranteed to see it; that single inequality is the whole freshness guarantee, and majority quorums (read a majority, write a majority) are the common choice because any two majorities of the same group always intersect. Majority-based consensus like Raft rides on the same fact. To become leader a candidate must win votes from a majority, and because two majorities overlap, two candidates cannot both win the same term, so you never get two leaders committing conflicting decisions. A committed entry is durable for the same reason: it is only committed once a majority stored it, and any future leader also needed a majority to win, so it must have seen that entry. During a network partition, only the side holding a strict majority may accept writes; the minority side must refuse writes even though that hurts availability, because a majority can form on only one side of any partition. If instead both sides kept accepting writes you would get split brain — two divergent histories that cannot be reconciled. So the minority sacrifices availability to preserve consistency, which is the CAP trade-off made concrete.",
      rubric:
        "Full credit: R+W>N forces read/write overlap so a read sees the latest write; majorities always intersect so no two leaders and committed entries survive; the minority side must refuse writes because a majority forms on only one side, else split brain. Partial: explains overlap but not the partition/minority rule, or vice versa. Low: vague.",
      support_ref: "sysdesign-part-2-rate-limiting",
    },
    {
      id: "a-free-3",
      text: "Why does an LRU cache need both a hash map and a doubly linked list, and what breaks if you try to implement it with just an array or just a dictionary?",
      type: "free_text",
      concept: "lru-cache",
      difficulty: "medium",
      actual_answer:
        "A bounded cache must do two things in constant time: look up a value by key, and, when it is full, evict the least-recently-used entry — which means it must also track recency order. A plain dictionary gives O(1) lookup but has no ordering, so finding the least-recently-used entry to evict would require scanning every entry, which is O(n) per eviction. A plain array or list can hold recency order (append on use, remove from the front to evict) but then looking up or moving a specific key means an O(n) scan to find it. The standard LRU marries the two structures so each covers the other's weakness: a hash map from key to a list node gives O(1) lookup, and a doubly linked list holds those nodes in recency order with the most-recently-used at the front and the least at the back. On a get you find the node through the map in O(1) and splice it to the front by fixing a fixed number of pointers; on a put that overflows you drop the node at the back, which is by construction the least recently used. Every operation is O(1) because the map avoids the search and the doubly linked list makes move-to-front and evict-from-back pure pointer surgery rather than a scan. Using only one structure forces at least one of lookup, promotion, or eviction to become linear, which is the failure the pairing prevents. Many languages give this for free as an ordered dictionary, which is exactly a hash map plus a doubly linked list.",
      rubric:
        "Full credit: cache needs O(1) lookup AND O(1) recency/evict; dict alone → O(n) to find LRU; array alone → O(n) to find/move a key; map+DLL gives O(1) lookup, move-to-front, evict-from-back. Partial: names the pairing without the why-each-alone-fails. Low: vague.",
      support_ref: "sysdesign-part-2-rate-limiting",
    },
  ],
  quiz: {
    pass_threshold: 6,
    consecutive_correct_required: 6,
    idk_option: true,
    grounding_required: true,
    questions: [
      {
        id: "q1",
        question: "Why does hash(key) mod N cause a near-total remap when you add one server?",
        choices: [
          "The modulus changes for almost every key at once when N changes",
          "The new server rehashes only its own keys",
          "Keys must be re-sorted after each resize",
          "Hashing becomes non-deterministic with more servers",
        ],
        correct_index: 0,
        explanation: "Every key's destination depends on N, so a new N rewrites nearly all of them — the failure consistent hashing fixes.",
        concept: "consistent-hashing",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "sysdesign-part-1-consistent-hashing",
      },
      {
        id: "q2",
        question: "On a consistent-hashing ring, which keys move when you add one server?",
        choices: [
          "Only the keys in the new server's single arc — about K/N of them",
          "All keys, since the ring is recomputed",
          "Half the keys, split with the nearest neighbor",
          "None — the new server only takes future keys",
        ],
        correct_index: 0,
        explanation: "Ownership is local to an arc, so a new node only steals its own arc; every other key's clockwise walk is unchanged.",
        concept: "consistent-hashing",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "sysdesign-part-1-consistent-hashing",
      },
      {
        id: "q3",
        question: "What problem do virtual nodes solve on the ring?",
        choices: [
          "Uneven arc sizes — many replicas per server average to a fair load share",
          "Slow lookups — they replace the binary search",
          "Hot keys — they spread a single key's traffic",
          "Cycle detection in the ring",
        ],
        correct_index: 0,
        explanation: "One point per server gives lopsided arcs; many replicas even out the key COUNT. Hot-key TRAFFIC is a separate problem.",
        concept: "consistent-hashing",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "sysdesign-part-1-consistent-hashing",
      },
      {
        id: "q4",
        question: "How does a token bucket refill without a per-client timer?",
        choices: [
          "On each request it adds elapsed-time × refill-rate tokens, capped at capacity",
          "A background job refills every bucket each second",
          "It resets to full at each window boundary",
          "It counts requests and blocks after the limit",
        ],
        correct_index: 0,
        explanation: "Lazy refill from the stored last-timestamp — O(1) state and time per client.",
        concept: "rate-limiting",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "sysdesign-part-2-rate-limiting",
      },
      {
        id: "q5",
        question: "What is the key behavioral difference between a token bucket and a sliding-window counter?",
        choices: [
          "The token bucket allows bursts up to capacity; the sliding window enforces a strict rolling count with no burst",
          "The sliding window allows bigger bursts than the token bucket",
          "They are identical in behavior",
          "The token bucket cannot enforce an average rate",
        ],
        correct_index: 0,
        explanation: "Burst tolerance vs strictness is the trade-off; pick from the requirement.",
        concept: "rate-limiting",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "sysdesign-part-2-rate-limiting",
      },
      {
        id: "q6",
        question: "Why does R + W > N guarantee a read sees the latest write?",
        choices: [
          "The read set and the write set must share at least one machine, which holds the latest write",
          "It makes reads faster than writes",
          "It forces every machine to store every write",
          "It sorts the replicas by version",
        ],
        correct_index: 0,
        explanation: "Two subsets of N whose sizes sum to more than N must overlap; the shared node has the freshest data.",
        concept: "consensus",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "sysdesign-part-2-rate-limiting",
      },
      {
        id: "q7",
        question: "Which are true about majority-based consensus and partitions? (Select all that apply.)",
        choices: [
          "Two majorities of the same group always intersect, so two leaders cannot both commit",
          "Only the side with a strict majority may accept writes during a partition",
          "Both sides of a partition may keep accepting writes safely",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "Letting both sides write causes split brain; only the majority side may progress, and majorities always overlap.",
        concept: "consensus",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "sysdesign-part-2-rate-limiting",
      },
      {
        id: "q8",
        question: "Why does an LRU cache pair a hash map with a doubly linked list?",
        choices: [
          "The map gives O(1) lookup; the list gives O(1) move-to-front and evict-from-back",
          "The list makes lookups faster than the map",
          "The map stores recency order",
          "To detect cycles among cache entries",
        ],
        correct_index: 0,
        explanation: "Each structure covers the other's weakness, so every cache operation is O(1).",
        concept: "lru-cache",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "sysdesign-part-2-rate-limiting",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-sd-signal", prompt: "Given a fresh system-design prompt, how fast can you now name which algorithm it is secretly asking for and why?", hint: "Spread keys → ring; cap/smooth traffic → token bucket or sliding window; survive failure → quorum/majority; fast hot data → LRU." },
  { id: "diag-sd-ring", prompt: "Can you explain in one sentence why the ring moves only K/N keys when hash-modulo-N moves nearly all of them?", hint: "Ownership is local to an arc, so a new node only steals its own arc." },
  { id: "diag-sd-ratelimit", prompt: "Could you implement a token bucket and a sliding-window limiter from memory, and state which requirement picks each?", hint: "Token bucket = average + bounded burst; sliding window = strict rolling count, no burst." },
  { id: "diag-sd-quorum", prompt: "Can you justify R + W > N and why only the majority side of a partition may accept writes?", hint: "Overlapping sets see the latest write; a majority forms on only one side, so the minority must refuse writes to avoid split brain." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "System-design algorithms in the interview-pattern map",
  description:
    "This lesson integrates the algorithmic core of the system-design round: consistent hashing (a ring so adding a server moves few keys), rate limiting (token bucket vs sliding window), quorum and majority consensus (R + W > N, no split brain), and the LRU cache (map + doubly linked list). The mock-interview simulation is the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "sd-signal", label: "Recognition: signal → tool", category: "lesson_concept", covered: true },
    { id: "sd-ring", label: "Consistent hashing (the ring)", category: "lesson_concept", covered: true },
    { id: "sd-ratelimit", label: "Rate limiting (token bucket / window)", category: "lesson_concept", covered: true },
    { id: "sd-quorum", label: "Quorum & consensus (R+W>N, majority)", category: "lesson_concept", covered: true },
    { id: "graph-reactivation", label: "Graph reactivation (prior)", category: "concept", covered: true },
    { id: "sd-lru", label: "LRU cache (map + DLL)", category: "concept", covered: true, preview: true },
    { id: "mock-interview", label: "Mock interview simulation (next)", category: "concept", covered: false },
  ],
  edges: [],
  curriculum_stages: [
    { id: "dp-reactivation", label: "DP reactivation", status: "done" },
    { id: "graph-reactivation", label: "Graph reactivation", status: "done" },
    { id: "system-design", label: "System Design algo patterns", status: "current" },
    { id: "mock-interview", label: "Mock interview simulation", status: "next" },
    { id: "gap-analysis", label: "Gap analysis + targeted drills", status: "later" },
  ],
  current: "system-design",
};

const planningRationale =
  "This lesson integrates the strand of algorithms that a strong system-design round actually tests, framed as a recognition game rather than a re-teach: the learner has strong data-structure foundations (heavy imported evidence on trees, graphs, and dynamic programming) but the interview pipeline includes system-design rounds where the skill is hearing a signal and reaching for the right algorithm with a defensible trade-off. It loads four tools. Consistent hashing is grounded on the ring and the failure of hash-modulo-N: ownership is local to an arc, so adding a server moves only about K/N keys, and virtual nodes smooth the load; the scaffolded exercise drills the O(log n) clockwise-owner lookup, the core mechanic. Rate limiting is taught through the token bucket's lazy refill (two numbers of state, bursts up to capacity) contrasted with the strict sliding-window counter and the smoothing leaky bucket; the exercise implements the token-bucket stream. Quorum and majority consensus are taught in the overview and assessed by free response because they are conceptual rather than a short coding exercise: R plus W greater than N forces read/write overlap, majorities always intersect so there is no split brain, and the minority side of a partition must refuse writes. The integrator implements the sliding-window log (RecentCounter, LeetCode 933), and a timed drill implements the LRU cache (LeetCode 146), the canonical map-plus-doubly-linked-list system-design coding question. Pattern-recognition questions and a distributed-rate-limiting failure case build the recognition and debugging judgment the round rewards. It connects backward to the graph-reactivation lesson and forward to the mock-interview simulation, where these tools appear without labels under time pressure.";

// ── Assemble, validate, insert ────────────────────────────────────────────────
function fail(label: string, res: { valid: boolean; errors: string[] }) {
  if (!res.valid) {
    console.error(`\n✗ ${label} FAILED validation:`);
    for (const e of res.errors) console.error("   -", e);
    return true;
  }
  console.log(`✓ ${label} valid`);
  return false;
}

function main() {
  const db = getDb();
  const subject = db.prepare("SELECT id, title FROM subjects WHERE id = ?").get(SUBJECT_ID) as
    | { id: number; title: string }
    | undefined;
  if (!subject) throw new Error(`Subject ${SUBJECT_ID} not found`);

  let bad = false;
  bad = fail("Part 1 (consistent hashing)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (rate limiting)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code (RecentCounter)", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Code drill (LRU Cache)", validateCodeDrillContent(codeDrill)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1680)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "System Design Algorithmic Patterns: Consistent Hashing, Rate Limiting, Quorum, LRU";
  const description =
    "The system-design round is a recognition game over a small toolbox of real algorithms — hear the signal, reach for the tool, defend the trade-off. Consistent hashing puts servers and keys on a ring so adding a server moves only about K/N keys (virtual nodes balance the load). Rate limiting uses the token bucket (lazy refill, bursts up to capacity) or a strict sliding-window counter. Quorum keeps replicas correct with R + W > N, and majority consensus prevents split brain. The LRU cache pairs a hash map with a doubly linked list for O(1) get/put/evict. Drills the clockwise-owner ring lookup, a token-bucket stream, the sliding-window log (RecentCounter, LC 933), and an LRU cache (LC 146).";
  const goals = JSON.stringify([
    "Recognize which algorithm a system-design prompt is secretly asking for — ring, token bucket, quorum, or LRU — and state its trade-off",
    "Implement the consistent-hashing clockwise lookup, a token-bucket rate limiter, the sliding-window log, and an LRU cache to interview timing",
    "Explain R + W > N, why majority consensus prevents split brain, and why the ring moves only K/N keys",
  ]);
  const tags = JSON.stringify(["system-design", "consistent-hashing", "rate-limiting", "quorum", "consensus", "lru-cache", "interview-prep"]);
  const overviewAudioContent = {
    script: OVERVIEW_SCRIPT,
    transcript: OVERVIEW_SCRIPT,
    duration_hint: 1680,
    orientation_visual: orientationVisual,
    long_overview_style: "two-host-socratic",
  };

  const tx = db.transaction(() => {
    const prior = db
      .prepare("SELECT id FROM lessons WHERE subject_id = ? AND sequence_number = ?")
      .all(SUBJECT_ID, SEQ) as Array<{ id: number }>;
    for (const p of prior) {
      db.prepare("DELETE FROM lesson_activities WHERE lesson_id = ?").run(p.id);
      db.prepare("DELETE FROM lessons WHERE id = ?").run(p.id);
      console.log(`Removed prior seq=${SEQ} lesson ${p.id}`);
    }

    const res = db
      .prepare(
        `INSERT INTO lessons
           (subject_id, title, description, status, sequence_number, goals, tags,
            generated_by, generator_version, next_lesson_diagnostics, knowledge_graph_data, planning_rationale)
         VALUES (?, ?, ?, 'queued', ?, ?, ?, 'cc-handauthored/algo-interview', '1.0.0', ?, ?, ?)`
      )
      .run(
        SUBJECT_ID,
        title,
        description,
        SEQ,
        goals,
        tags,
        JSON.stringify(diagnostics),
        JSON.stringify(knowledgeGraph),
        planningRationale
      );
    const lessonId = Number(res.lastInsertRowid);

    const insertAct = db.prepare(
      `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
       VALUES (?, ?, 1, ?, ?, ?)`
    );
    insertAct.run(lessonId, "audio", 1, "Audio: system design — the algorithmic toolbox and the recognition habit", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Consistent Hashing — a ring so adding a server moves few keys", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Rate Limiting — the token bucket and the burst trade-off", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: RecentCounter (sliding-window log, LC 933)", JSON.stringify(finalCode));
    insertAct.run(lessonId, "code_drill", 5, "Drill: LRU Cache (LC 146)", JSON.stringify(codeDrill));
    insertAct.run(lessonId, "assessment", 6, "Assessment: system-design recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 6 activities.`);
  closeDb();
}

main();
