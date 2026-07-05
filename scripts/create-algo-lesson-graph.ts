#!/usr/bin/env tsx
/**
 * P4.1 — Lesson 9 of the "Coding Interview Mastery" subject (id 9):
 * "Graph Reactivation: One Loop, Swap the Container — BFS, Dijkstra, Union Find, Topo".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in this
 * env). This is a STRONG-but-STALE pattern for the learner (imported evidence:
 * tree-and-graph, union-find, topological all heavily practiced but years old), so
 * the lesson is framed as SPEED REACTIVATION — assume the concept is known,
 * rebuild execution speed to interview timing. The unifying mental model: graph
 * traversal is one loop whose FRONTIER CONTAINER sets its behavior — queue = BFS
 * (shortest unweighted), stack/recursion = DFS (ordering/connectivity), priority
 * queue = Dijkstra (non-negative weighted). Union Find is the separate incremental
 * connectivity tool.
 *
 * Structure mirrors the DP / Monotonic Stack lessons: top-level 2-host overview
 * audio + orientation visual, two collapsed lesson_parts (multi-source BFS via
 * Rotting Oranges; Union Find via Number of Provinces) each with a bespoke approved
 * artifact + per-part audio synced visual + scaffolded code + mixed practice (incl.
 * pattern_recognition), a final integrator practice_code (Course Schedule II —
 * Kahn's topological sort, LeetCode 210), an adaptive MC + freeform assessment, and
 * a timed code_drill (Network Delay Time — Dijkstra, LeetCode 743). Cue timings are
 * provisional and rescaled to the real generated audio duration by
 * rescale-graph-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-graph-overview-map, algo-graph-bfs, algo-graph-unionfind
 *
 * Idempotent: replaces any prior seq=8 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-graph.ts
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
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/graph-audio";

const SUBJECT_ID = 9;
const SEQ = 8;

const A_OVERVIEW = "algo-graph-overview-map";
const A_BFS = "algo-graph-bfs";
const A_UNIONFIND = "algo-graph-unionfind";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "graph-orientation",
    title: "Graph reactivation: one loop, and the frontier container picks the behavior",
    motif: "swap-the-container",
    description:
      "Orientation for the whole pattern as a reactivation, not a first-teach. You already know graph search; the goal is to rebuild the speed to pick the right traversal, mark visited correctly, and code it calmly. Graph traversal is one loop — pop a node, look at neighbors, record and push the new ones — and the container you pull from decides everything: a queue gives breadth-first search and shortest unweighted paths, a stack or recursion gives depth-first search for connectivity and ordering and cycle detection, a priority queue gives Dijkstra for non-negative weighted shortest paths. Union Find is a separate tool that answers connectivity incrementally in near-constant time. The single reflex that keeps every traversal linear and correct is marking a node visited the instant it is discovered and pushed onto the frontier — never when it is popped.",
    panels: [
      {
        id: "cost",
        title: "Reactivation, not re-teaching",
        kind: "flow" as const,
        description: "The bottleneck is recall speed, not understanding — drill the container choice and the visited discipline until each traversal is automatic.",
        data: [
          { label: "you already know graphs", value: "strong but stale", role: "input" as const },
          { label: "pick the container from the question", value: "queue · stack · heap · DSU", role: "process" as const },
          { label: "the right traversal from memory", value: "code it calmly", role: "output" as const },
        ],
      },
      {
        id: "shapes",
        title: "One loop, four tools",
        kind: "cards" as const,
        description: "Queue, stack/recursion, heap, and Union Find.",
        data: [
          { label: "queue → BFS", value: "shortest unweighted, layers", role: "context" as const },
          { label: "stack/recursion → DFS", value: "ordering, connectivity, cycles", role: "context" as const },
          { label: "heap → Dijkstra · DSU", value: "weighted shortest · connectivity", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 170, label: "Reactivation", headline: "You know graphs; rebuild the speed", narration: "This is a strong-but-stale pattern, so the goal is recall speed: pick the right traversal and code it calmly.", receive: "a known pattern gone stale", transform: "drill for speed", pass: "interview-timing recall" },
    { start: 170, end: 360, label: "One machine", headline: "The container sets the behavior", narration: "Graph traversal is one loop; a queue gives BFS, a stack gives DFS, a priority queue gives Dijkstra.", receive: "a graph problem", transform: "choose the frontier container", pass: "the right algorithm" },
    { start: 360, end: 560, label: "Why BFS is shortest", narration: "First-in-first-out forces nondecreasing distance, so the first time BFS reaches a node is along a shortest path.", headline: "FIFO ⇒ shortest unweighted", receive: "an unweighted graph", transform: "process in distance order", pass: "shortest paths" },
    { start: 560, end: 760, label: "Mark on enqueue", headline: "Discovered equals visited", narration: "Mark a node visited the instant you push it, so each node enters the frontier exactly once.", receive: "a discovered node", transform: "mark on enqueue", pass: "linear, correct traversal" },
    { start: 760, end: 980, label: "Multi-source", headline: "Seed every source at distance 0", narration: "Multi-source BFS seeds all sources together and counts layers, turning simultaneous spread into one queue loop.", receive: "many sources", transform: "seed all at zero", pass: "distance to nearest source" },
    { start: 980, end: 1180, label: "Union Find", headline: "Incremental connectivity", narration: "Union Find answers 'same group?' incrementally with path compression and union by rank in near-constant time.", receive: "arriving edges", transform: "union and find", pass: "component count" },
    { start: 1180, end: 1380, label: "Dijkstra", headline: "Expand the cheapest first", narration: "A priority queue always expands the cheapest node, so its first pop is final — for non-negative weights only.", receive: "a weighted graph", transform: "pop the cheapest, relax", pass: "weighted shortest paths" },
    { start: 1380, end: 1560, label: "Topo sort", headline: "Kahn's in-degree BFS", narration: "Topological sort is in-degree BFS; it returns fewer nodes exactly when a cycle exists.", receive: "a dependency graph", transform: "peel in-degree zero", pass: "a valid order or a cycle" },
    { start: 1560, end: 1680, label: "Traps", headline: "Visited timing · container · negatives", narration: "The bugs are visited timing, container mismatch, Dijkstra on negatives, and bare Union Find — not the ideas.", receive: "a coded traversal", transform: "check the four traps", pass: "a correct submission" },
  ],
};

// ── Reading builder helpers ───────────────────────────────────────────────────
const bfsComplexity = {
  type: "formula",
  latex: "\\text{time } O(V + E) \\qquad \\text{space } O(V)",
  plain_english:
    "Breadth-first search visits each vertex once and scans each edge once, because marking on enqueue guarantees every node enters the frontier exactly once and every adjacency is examined a constant number of times. Over V vertices and E edges that is O(V + E) time — linear in the size of the graph. On a grid of R rows and C columns the vertices are the R·C cells and each has at most four edges, so it is O(R·C). The queue and the visited set each hold at most V entries, so the extra space is O(V).",
  variables: [
    { symbol: "V", meaning: "the number of vertices (grid cells)" },
    { symbol: "E", meaning: "the number of edges (adjacencies)" },
    { symbol: "O(V + E) \\text{ time}", meaning: "each node and edge handled once" },
    { symbol: "O(V) \\text{ space}", meaning: "the queue plus the visited set" },
  ],
};

const unionFindComplexity = {
  type: "formula",
  latex: "\\text{time } O(E \\cdot \\alpha(V)) \\qquad \\text{space } O(V)",
  plain_english:
    "With both path compression and union by rank, each find or union costs an amortized inverse-Ackermann factor α(V), which is at most four or five for any V you will ever encounter — effectively constant. Processing E edges is therefore O(E·α(V)), essentially linear. On the number-of-provinces matrix there are up to V² pairs to scan, so building the structure is O(V²·α(V)) dominated by reading the matrix. The parent and rank arrays hold one entry per node, so the space is O(V).",
  variables: [
    { symbol: "V", meaning: "the number of nodes (people)" },
    { symbol: "E", meaning: "the number of union operations (edges)" },
    { symbol: "\\alpha(V)", meaning: "inverse Ackermann — at most ~4, treated as constant" },
    { symbol: "O(V) \\text{ space}", meaning: "the parent and rank arrays" },
  ],
};

// ── Part 1: Multi-source BFS (Rotting Oranges) ────────────────────────────────
const part1 = {
  part_id: "graph-part-1-bfs",
  reading: {
    blocks: [
      { type: "heading", text: "Breadth-first search as layered spread: multi-source, and the layer is the distance" },
      {
        type: "paragraph",
        text:
          "Rotting Oranges is the cleanest place to reload breadth-first search, because it makes the layered nature of BFS visible: rot spreads one ring at a time. The state is a frontier queue of the cells that just became rotten. The move that unlocks the whole problem is the seeding step — before the loop, enqueue EVERY already-rotten cell at time zero, and count the fresh cells. Then run the identical layer-by-layer loop: each pass pops the entire current frontier, and any fresh neighbor of a popped cell flips to rotten, is enqueued, and decrements the fresh count. Because all sources started together at time zero, the pass on which a cell rots is exactly its distance to the NEAREST source, not to any particular one. So 'minutes until every orange rots' is just the number of layers the BFS spreads, and 'is any orange unreachable' is just 'is any cell still fresh when the queue empties'. The one discipline that keeps this correct and linear is marking a cell rotten the instant you enqueue it: if you wait until you pop it, two rotten neighbors could both enqueue the same fresh cell and you would process it twice, miscounting the time.",
      },
      {
        type: "definition",
        term: "Frontier + mark-on-enqueue (the BFS invariant)",
        definition:
          "The frontier is the queue of discovered-but-not-yet-processed nodes; because a queue is first-in-first-out, BFS processes nodes in nondecreasing distance order, so the first time it reaches a node is along a shortest (fewest-edge) path. 'Mark on enqueue' means you mark a node visited the moment you push it, not when you pop it — that guarantees each node enters the frontier exactly once, keeping BFS O(V+E) and preventing double-counting of the layer/distance.",
      },
      {
        type: "example",
        body:
          "3x3 grid, only (0,0) rotten, other 8 fresh. Seed queue=[(0,0)], fresh=8. Minute 1 processes {(0,0)} → (0,1),(1,0) rot, fresh=6. Minute 2 processes {(0,1),(1,0)} → (0,2),(1,1),(2,0) rot, fresh=3. Minute 3 processes those → (1,2),(2,1) rot, fresh=1. Minute 4 processes those → (2,2) rots, fresh=0. Every cell's rot minute equals its grid distance from (0,0); the answer is the deepest layer, 4.",
      },
      {
        type: "callout",
        text:
          "The unreachable trap and the off-by-one: after the queue drains, if any cell is still fresh it can never rot → return -1 (a walled-off orange). And count layers carefully: the initial seeding of sources is layer 0 (nothing spread yet), so the answer is the number of layers that actually spread rot, not the total pop count. Seeding wrong (starting minutes at 1, or forgetting the fresh==0-at-start case) is the classic bug.",
      },
      bfsComplexity,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_BFS,
      scene: {
        scene_id: "graph-bfs-scene",
        title: "One layer per minute: the frontier flips its fresh neighbors and moves outward",
        motif: "multi-source-layers",
        description: "The walk of multi-source BFS on the 3x3 rotting-oranges grid: the frontier queue is processed one full layer per minute, each fresh neighbor flips and joins the next frontier, and the minute a cell flips is its distance to the nearest source. fresh reaches 0 at minute 4.",
        panels: [
          {
            id: "loop",
            title: "The minute loop",
            kind: "ledger" as const,
            description: "What one minute does to the frontier.",
            data: [
              { label: "seed all sources at minute 0", value: "fat starting frontier", role: "input" as const },
              { label: "process one full layer / minute", value: "flip fresh neighbors, enqueue", role: "process" as const },
              { label: "answer", value: "fresh==0 ? layers : -1", role: "output" as const },
            ],
          },
          {
            id: "why",
            title: "Why the layer is the distance",
            kind: "matrix" as const,
            description: "FIFO processes in distance order.",
            data: [
              { label: "queue is first-in-first-out", value: "nondecreasing distance", role: "context" as const },
              { label: "mark rotten on enqueue", value: "each cell enters once", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "Seed the sources", headline: "Enqueue every rotten cell at 0", narration: "Before the loop, enqueue every already-rotten cell at minute zero and count the fresh cells.", receive: "the grid", transform: "seed all sources", pass: "the initial frontier" },
        { start: 30, end: 62, label: "One layer per minute", headline: "Process the whole frontier", narration: "Each minute pops the entire current frontier; every fresh neighbor flips to rotten and joins the next layer.", receive: "the current frontier", transform: "spread one ring", pass: "the next frontier" },
        { start: 62, end: 95, label: "Layer = distance", headline: "Rot minute is nearest-source distance", narration: "Because all sources started together, the minute a cell flips is its distance to the nearest rotten cell.", receive: "a fresh cell", transform: "reach it by BFS", pass: "its distance" },
        { start: 95, end: 128, label: "Mark on enqueue", headline: "Each cell enters once", narration: "Flipping a cell rotten the moment it is enqueued stops two neighbors from processing it twice.", receive: "a discovered cell", transform: "mark on enqueue", pass: "linear time" },
        { start: 128, end: 150, label: "The answer", headline: "fresh == 0 at minute 4", narration: "Here fresh reaches zero at minute four, the deepest layer, so the answer is four minutes.", receive: "the filled grid", transform: "read the deepest layer", pass: "4" },
        { start: 150, end: 165, label: "Unreachable", headline: "Leftover fresh ⇒ -1", narration: "If any cell is still fresh when the queue empties, it can never rot, so the answer is negative one.", receive: "a drained queue", transform: "check leftover fresh", pass: "-1 if any remain" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk multi-source BFS on the 3x3 rotting-oranges grid. Each minute processes one full layer of the frontier: orange cells just rotted this minute, pale cells rotted earlier, green cells are still fresh. Watch the fresh count fall to 0 at minute 4 — the deepest layer, which is the distance of the far corner to the source.",
    params: { artifact_slug: A_BFS, min_height: 380 },
  },
  code: {
    prompt:
      "Return the minutes until no cell is fresh (value 1), or -1 if some fresh orange can never rot. Use MULTI-SOURCE BFS. Fill in the TODO: process the queue one layer (minute) at a time; for each popped cell, flip fresh 4-neighbors to rotten, enqueue them, and decrement fresh. Increment minutes per layer that spreads; at the end return minutes if fresh==0 else -1.",
    starter_code:
      "from collections import deque\n\ndef oranges_rotting(grid):\n    rows, cols = len(grid), len(grid[0])\n    q = deque()\n    fresh = 0\n    for r in range(rows):\n        for c in range(cols):\n            if grid[r][c] == 2:\n                q.append((r, c))     # seed EVERY source at minute 0\n            elif grid[r][c] == 1:\n                fresh += 1\n    if fresh == 0:\n        return 0\n    minutes = 0\n    while q:\n        minutes += 1\n        # TODO: process the whole current frontier (one minute):\n        #   for _ in range(len(q)):\n        #       r, c = q.popleft()\n        #       for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):\n        #           nr, nc = r+dr, c+dc\n        #           if 0<=nr<rows and 0<=nc<cols and grid[nr][nc]==1:\n        #               grid[nr][nc] = 2        # mark rotten ON enqueue\n        #               fresh -= 1\n        #               q.append((nr, nc))\n        pass\n    return minutes - 1 if fresh == 0 else -1\n",
    constraints: [
      "Seed the queue with EVERY rotten cell before the loop; multi-source BFS starts all sources at distance/minute 0.",
      "Process one full layer per minute using for _ in range(len(q)); mark a cell rotten the moment you enqueue it, not when you pop it.",
      "At the end return minutes-1 if fresh==0 (the last increment counted a non-spreading layer), else -1 for any stranded fresh cell; handle fresh==0 at the start as 0.",
    ],
    walkthrough: {
      title: "Multi-source BFS, one minute per layer",
      steps: [
        { title: "Seed all sources", detail: "Scan the grid: enqueue every rotten cell at minute 0 and count the fresh ones. If there are no fresh cells, the answer is 0.", input: "the grid", output: "the initial frontier + fresh count" },
        { title: "Spread one layer per minute", detail: "Pop the whole current frontier; each fresh 4-neighbor flips to rotten, is enqueued, and drops the fresh count. Mark on enqueue so no cell is processed twice.", input: "the current frontier", output: "the next frontier" },
        { title: "Read the answer", detail: "When the queue empties, if fresh==0 the answer is the number of spreading layers; if any cell is still fresh it is unreachable, so return -1.", input: "the drained queue", output: "minutes or -1" },
      ],
    },
    io_examples: [
      { label: "classic", input: "grid = [[2,1,1],[1,1,0],[0,1,1]]", expected_output: "4", explanation: "Rot spreads outward from (0,0); the farthest orange rots at minute 4." },
      { label: "unreachable", input: "grid = [[2,1,1],[0,1,1],[1,0,1]]", expected_output: "-1", explanation: "The bottom-left orange is walled off by empty cells and never rots." },
      { label: "already done", input: "grid = [[0,2]]", expected_output: "0", explanation: "No fresh oranges to begin with, so 0 minutes." },
    ],
    visualization: {
      title: "seed all sources · one layer per minute · read the deepest layer",
      description: "Multi-source BFS spreads rot ring by ring; the layer is the distance.",
      items: [
        { label: "enqueue every rotten cell @ 0", value: "multi-source seed", role: "input" },
        { label: "flip fresh neighbors, mark on enqueue", value: "one layer / minute", role: "process" },
        { label: "fresh==0 ? layers : -1", value: "the answer", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The multi-source BFS template",
        code:
          "from collections import deque\ndef oranges_rotting(grid):\n    rows, cols = len(grid), len(grid[0])\n    q = deque()\n    fresh = 0\n    for r in range(rows):\n        for c in range(cols):\n            if grid[r][c] == 2: q.append((r, c))\n            elif grid[r][c] == 1: fresh += 1\n    if fresh == 0: return 0\n    minutes = 0\n    while q:\n        minutes += 1\n        for _ in range(len(q)):\n            r, c = q.popleft()\n            for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):\n                nr, nc = r+dr, c+dc\n                if 0<=nr<rows and 0<=nc<cols and grid[nr][nc]==1:\n                    grid[nr][nc] = 2\n                    fresh -= 1\n                    q.append((nr, nc))\n    return minutes-1 if fresh == 0 else -1",
        explanation: "One queue, one layer per minute. Marking on enqueue keeps each cell in the frontier once. O(R·C) time and space.",
      },
      {
        label: "concise",
        title: "Single-source shortest path in a grid (same loop)",
        code:
          "from collections import deque\ndef shortest_path(grid, start, target):\n    rows, cols = len(grid), len(grid[0])\n    q = deque([(start, 0)])\n    seen = {start}\n    while q:\n        (r, c), d = q.popleft()\n        if (r, c) == target: return d\n        for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):\n            nr, nc = r+dr, c+dc\n            if 0<=nr<rows and 0<=nc<cols and (nr,nc) not in seen and grid[nr][nc]==0:\n                seen.add((nr, nc))\n                q.append(((nr, nc), d+1))\n    return -1",
        explanation: "The identical BFS loop with a distance carried per node; first pop of the target is its shortest distance. Same machine, single source, distance tracked explicitly.",
      },
    ],
    hints: [
      { level: 1, text: "First scan the grid: enqueue EVERY rotten cell (value 2), and count fresh cells (value 1). If fresh==0, return 0." },
      { level: 2, text: "Loop while the queue is non-empty; each iteration is one minute — process exactly the current frontier with for _ in range(len(q))." },
      { level: 3, text: "For each popped cell, look at 4 neighbors in bounds; if a neighbor is fresh (1), set it to 2, decrement fresh, and enqueue it." },
      { level: 4, text: "Mark the neighbor rotten the moment you enqueue it, so two rotten cells cannot both enqueue the same fresh cell." },
      { level: 5, text: "After the loop, return minutes-1 if fresh==0 (the last minute counted no spread), else -1 for stranded fresh oranges." },
    ],
    tests: [
      { id: "t_classic", description: "spreads in 4", assert: "assert oranges_rotting([[2,1,1],[1,1,0],[0,1,1]]) == 4" },
      { id: "t_unreach", description: "walled-off orange", assert: "assert oranges_rotting([[2,1,1],[0,1,1],[1,0,1]]) == -1" },
      { id: "t_none", description: "no fresh oranges", assert: "assert oranges_rotting([[0,2]]) == 0" },
    ],
    hidden_tests: [
      { id: "h_lone", description: "a lone fresh orange never rots", assert: "assert oranges_rotting([[1]]) == -1" },
      { id: "h_empty_only", description: "only empty/rotten", assert: "assert oranges_rotting([[0]]) == 0" },
      { id: "h_one_min", description: "spreads in 1", assert: "assert oranges_rotting([[2,2],[1,1]]) == 1" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "g1-so-1",
        type: "select_one",
        prompt: "Why does breadth-first search find the shortest path in an unweighted graph?",
        concept: "graph-traversal",
        difficulty: "easy",
        choices: [
          "A FIFO queue processes nodes in nondecreasing distance order, so the first time a node is reached is along a shortest path",
          "It sorts all paths by length first",
          "It uses a priority queue keyed by distance",
          "It explores every path to completion and keeps the minimum",
        ],
        correct_index: 0,
        explanation: "First-in-first-out forces distance-ordered processing, so first discovery equals fewest edges.",
      },
      {
        id: "g1-sa-multi",
        type: "select_all",
        prompt: "Which statements about multi-source BFS on the rotting-oranges grid are true?",
        concept: "graph-traversal",
        difficulty: "medium",
        choices: [
          "You enqueue every rotten cell at minute 0 before the loop",
          "The minute a cell rots equals its distance to the NEAREST source",
          "You should mark a cell rotten when you enqueue it, not when you pop it",
          "If any cell is still fresh at the end, the answer is 0",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Leftover fresh means unreachable → return -1, not 0. The other three are the core facts.",
      },
      {
        id: "g1-sa-none",
        type: "select_all",
        prompt: "For oranges_rotting([[2,1,1],[0,1,1],[1,0,1]]), which of these outputs are correct? (If none, select none.)",
        concept: "graph-traversal",
        difficulty: "hard",
        choices: [
          "4 (everything eventually rots)",
          "2 (the reachable oranges rot in 2)",
          "0 (there is nothing to rot)",
        ],
        correct_indices: [],
        explanation: "None: the bottom-left orange (2,0) is walled off by empty cells, so it never rots and the answer is -1.",
      },
      {
        id: "g1-order",
        type: "ordering",
        prompt: "Order the steps of one minute of multi-source BFS.",
        concept: "graph-traversal",
        difficulty: "medium",
        items: [
          "Record how many cells are in the current frontier (len(q))",
          "Pop each of those cells and scan its 4 neighbors",
          "Flip each fresh neighbor to rotten, decrement fresh, enqueue it",
          "Increment the minute counter and repeat while the queue is non-empty",
        ],
        correct_order: [
          "Record how many cells are in the current frontier (len(q))",
          "Pop each of those cells and scan its 4 neighbors",
          "Flip each fresh neighbor to rotten, decrement fresh, enqueue it",
          "Increment the minute counter and repeat while the queue is non-empty",
        ],
      },
      {
        id: "g1-pattern",
        type: "pattern_recognition",
        prompt: "\"Find the fewest moves to reach the exit of a maze from the entrance, where each move is one step to an open cell.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Breadth-First Search (BFS)", "Shortest path in an unweighted graph", "Dijkstra (priority queue)", "Dynamic Programming", "Two Pointer"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Fewest unit-cost moves in a grid is unweighted shortest path — plain BFS with a queue. Dijkstra is overkill because every edge has weight 1.",
      },
      {
        id: "g1-written",
        type: "written",
        prompt: "Explain precisely why you should mark a cell visited (rotten) when you ENQUEUE it, not when you dequeue it, in BFS.",
        concept: "graph-traversal",
        difficulty: "hard",
        actual_answer:
          "In BFS a node can be adjacent to several nodes in the current frontier, so several of them may try to discover it. If you only mark a node visited when you pop it, then between the time the first neighbor pushes it and the time it is finally popped, other neighbors also see it as unvisited and push it again — the same node ends up in the queue multiple times. That inflates the queue and, worse, the node gets processed more than once, so its distance or the layer count can be assigned twice and corrupted. Marking on enqueue fixes this: the instant a node is discovered and pushed, it is flagged, so no other neighbor will ever enqueue it again. Each node therefore enters the frontier exactly once, every edge is examined a constant number of times, and the traversal stays O(V+E) with each node's first-discovery distance being its true shortest distance. In the rotting-oranges framing, marking rotten on enqueue is what makes 'the minute a cell flips' a well-defined single value rather than something two neighbors could both claim.",
        rubric:
          "Full credit: a node can be discovered by multiple frontier neighbors; marking on dequeue lets it be enqueued/processed multiple times, inflating the queue and corrupting distance; marking on enqueue guarantees each node enters once and keeps O(V+E). Partial: says it avoids duplicates without the multiple-neighbor reason. Low: vague.",
      },
    ],
  },
};

// ── Part 2: Union Find (Number of Provinces) ──────────────────────────────────
const part2 = {
  part_id: "graph-part-2-unionfind",
  reading: {
    blocks: [
      { type: "heading", text: "Connectivity without a traversal: a parent forest with path compression" },
      {
        type: "paragraph",
        text:
          "Union Find is the tool to reload when the question is pure connectivity — 'how many connected groups' or 'are these two nodes in the same group' — and especially when edges arrive one at a time. Unlike a traversal, which re-walks the graph each time you ask, Union Find maintains the answer incrementally. The structure is a forest represented by a single parent array: every node points toward a representative root, and two nodes are in the same group exactly when they share a root. You start with every node as its own root, so the component count begins at n. Each edge attempts a union: find both endpoints' roots, and if they DIFFER, attach one root under the other and drop the component count by one; if they are the SAME, the edge is redundant — it joins nothing new, which is precisely a cycle — so you do nothing. Whatever the count is when all edges are processed is the number of connected groups. Two optimizations make each operation almost free: path compression flattens the chain during find (re-point nodes closer to the root), and union by rank attaches the shorter tree under the taller so heights barely grow. Together they give an amortized inverse-Ackermann cost per operation — effectively constant for any realistic input.",
      },
      {
        type: "definition",
        term: "Union by rank + path compression",
        definition:
          "Two optimizations that keep the parent forest shallow. Union by rank always hangs the shorter (lower-rank) tree under the taller during a union, so a tree's height only grows when two equal-height trees merge — keeping height logarithmic. Path compression, during find, re-points every node on the walk-up path directly toward the root (the halving variant points each node at its grandparent). Used together, the amortized cost per find/union drops to the inverse Ackermann function α(n) ≤ ~4, treated as constant. Omitting them leaves find at O(n) in the worst case, which is the number-one Union Find performance bug.",
      },
      {
        type: "example",
        body:
          "5 people, edges (0,1),(1,2),(0,2),(3,4). Start components=5, parent=[0,1,2,3,4]. union(0,1): roots 0,1 differ → parent[1]=0, components=4. union(1,2): find(1)=0, find(2)=2 differ → parent[2]=0, components=3, group {0,1,2}. union(0,2): find(0)=0, find(2)=0 SAME → redundant (a cycle), no change, components=3. union(3,4): differ → parent[4]=3, components=2. Answer: 2 provinces, {0,1,2} and {3,4}.",
      },
      {
        type: "callout",
        text:
          "The two Union Find traps: (1) forgetting the optimizations — a bare parent array with no compression/rank degrades find to O(n) and a big input times out; (2) decrementing the component count on every edge instead of only on a REAL union (different roots). Only a union that merges two distinct groups reduces the count; a same-root edge is a cycle and must not decrement. Also remember: Union Find answers connectivity, not the actual path between two nodes.",
      },
      unionFindComplexity,
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_UNIONFIND,
      scene: {
        scene_id: "graph-unionfind-scene",
        title: "Edges merge groups; only a real union drops the count, a same-root edge is a cycle",
        motif: "parent-forest-merge",
        description: "The walk of Union Find over 5 people with edges (0,1),(1,2),(0,2),(3,4): nodes are colored by their current root, the parent array is shown, and the component count starts at 5 and drops by one per real union. The (0,2) edge is redundant (same root already) — a cycle — so it changes nothing. The answer is 2 provinces.",
        panels: [
          {
            id: "op",
            title: "The union step",
            kind: "ledger" as const,
            description: "What processing one friendship edge does to the forest.",
            data: [
              { label: "find(a), find(b)", value: "walk to roots", role: "input" as const },
              { label: "roots differ → attach + count--", value: "real union", role: "process" as const },
              { label: "roots same → redundant (cycle)", value: "no change", role: "output" as const },
            ],
          },
          {
            id: "why",
            title: "Why near-constant",
            kind: "matrix" as const,
            description: "Two optimizations, together.",
            data: [
              { label: "path compression", value: "flatten during find", role: "context" as const },
              { label: "union by rank", value: "shorter under taller", role: "input" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "The structure", headline: "A parent forest", narration: "Every node points toward a root; two nodes share a group exactly when they share a root.", receive: "n nodes", transform: "each its own root", pass: "n components" },
        { start: 30, end: 62, label: "Real union", headline: "Different roots merge", narration: "When an edge's endpoints have different roots, attach one under the other and drop the count by one.", receive: "an edge", transform: "find both roots, attach", pass: "one fewer component" },
        { start: 62, end: 95, label: "Redundant edge", headline: "Same root is a cycle", narration: "If both endpoints already share a root, the edge joins nothing new — a redundant edge, a cycle — so nothing changes.", receive: "a same-root edge", transform: "skip it", pass: "count unchanged" },
        { start: 95, end: 128, label: "Optimizations", headline: "Compression + rank", narration: "Path compression flattens the chain during find and union by rank keeps trees shallow — near-constant per op.", receive: "a find or union", transform: "compress and balance", pass: "inverse-Ackermann cost" },
        { start: 128, end: 150, label: "The answer", headline: "2 provinces survive", narration: "After all edges, two roots remain — the groups {0,1,2} and {3,4} — so the answer is two provinces.", receive: "the final forest", transform: "count the roots", pass: "2" },
        { start: 150, end: 165, label: "Not a path", headline: "Connectivity, not routes", narration: "Union Find answers whether two nodes are connected, not the actual path between them — reach for BFS/DFS for that.", receive: "a connectivity query", transform: "compare roots", pass: "same group or not" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to walk Union Find over 5 people with edges (0,1),(1,2),(0,2),(3,4). Nodes are colored by their current root; the parent array and the component count are shown. Watch the count drop from 5 only on real unions (different roots), and note the (0,2) edge is redundant — a cycle — so it changes nothing. Two provinces {0,1,2} and {3,4} survive.",
    params: { artifact_slug: A_UNIONFIND, min_height: 380 },
  },
  code: {
    prompt:
      "Return the number of provinces (connected groups) given an n×n friend matrix is_connected. Use UNION FIND with path compression and union by rank. Fill in the TODO: implement find with path halving and union that attaches by rank and returns False on a same-root (redundant) edge; start components at n and decrement only on a real union.",
    starter_code:
      "def find_provinces(is_connected):\n    n = len(is_connected)\n    parent = list(range(n))\n    rank = [0] * n\n\n    def find(x):\n        while parent[x] != x:\n            parent[x] = parent[parent[x]]   # path compression (halving)\n            x = parent[x]\n        return x\n\n    def union(a, b):\n        ra, rb = find(a), find(b)\n        if ra == rb:\n            return False                     # same root → redundant (cycle)\n        # TODO: union by rank — attach the shorter tree under the taller,\n        #   bump rank on a tie, and return True\n        #   if rank[ra] < rank[rb]: ra, rb = rb, ra\n        #   parent[rb] = ra\n        #   if rank[ra] == rank[rb]: rank[ra] += 1\n        #   return True\n        pass\n\n    components = n\n    for i in range(n):\n        for j in range(i + 1, n):\n            if is_connected[i][j] and union(i, j):\n                components -= 1\n    return components\n",
    constraints: [
      "find must use path compression (halving: parent[x] = parent[parent[x]]) so repeated finds get cheap.",
      "union must return False when both endpoints already share a root (a redundant edge / cycle) and True when it merges two distinct groups.",
      "Start components at n and decrement ONLY when union returns True; a same-root edge must not change the count.",
    ],
    walkthrough: {
      title: "A parent forest that merges groups incrementally",
      steps: [
        { title: "Everyone is their own root", detail: "parent[i]=i and rank[i]=0 for all i; components starts at n because nothing is merged yet.", input: "n nodes", output: "n singleton groups" },
        { title: "find with compression", detail: "Walk parent pointers up to the root, halving the path as you go so future finds are shorter.", input: "a node", output: "its root" },
        { title: "union by rank, count real merges", detail: "If the two roots differ, hang the shorter under the taller and decrement components; if they are the same, the edge is redundant and nothing changes.", input: "an edge", output: "one fewer component, or no change" },
      ],
    },
    io_examples: [
      { label: "two provinces", input: "is_connected = [[1,1,0],[1,1,0],[0,0,1]]", expected_output: "2", explanation: "Persons 0 and 1 are one province; person 2 is alone → 2." },
      { label: "all separate", input: "is_connected = [[1,0,0],[0,1,0],[0,0,1]]", expected_output: "3", explanation: "No friendships, so each person is their own province → 3." },
      { label: "all one", input: "is_connected = [[1,1,1],[1,1,1],[1,1,1]]", expected_output: "1", explanation: "Everyone is transitively connected → a single province." },
    ],
    visualization: {
      title: "parent forest · real union drops count · same root is a cycle",
      description: "Components start at n and fall by one per real merge.",
      items: [
        { label: "parent[i] = i, components = n", value: "n singletons", role: "input" },
        { label: "find(a) != find(b) → attach, count--", value: "real union", role: "process" },
        { label: "components at the end", value: "the answer", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "The Union Find template (compression + rank)",
        code:
          "def find_provinces(is_connected):\n    n = len(is_connected)\n    parent = list(range(n)); rank = [0]*n\n    def find(x):\n        while parent[x] != x:\n            parent[x] = parent[parent[x]]\n            x = parent[x]\n        return x\n    def union(a, b):\n        ra, rb = find(a), find(b)\n        if ra == rb: return False\n        if rank[ra] < rank[rb]: ra, rb = rb, ra\n        parent[rb] = ra\n        if rank[ra] == rank[rb]: rank[ra] += 1\n        return True\n    components = n\n    for i in range(n):\n        for j in range(i+1, n):\n            if is_connected[i][j] and union(i, j):\n                components -= 1\n    return components",
        explanation: "One parent array, one rank array. Real unions drop the count; same-root edges are cycles and skipped. Near-constant per operation.",
      },
      {
        label: "concise",
        title: "Redundant Connection (684): the first cycle edge",
        code:
          "def find_redundant(edges):\n    parent = list(range(len(edges)+1))\n    def find(x):\n        while parent[x] != x:\n            parent[x] = parent[parent[x]]; x = parent[x]\n        return x\n    for u, v in edges:\n        ru, rv = find(u), find(v)\n        if ru == rv:\n            return [u, v]      # same root already → this edge closes a cycle\n        parent[rv] = ru\n    return []",
        explanation: "The same machine used for cycle detection: the first edge whose endpoints already share a root is the one that creates the cycle. A same-root union IS a detected cycle.",
      },
    ],
    hints: [
      { level: 1, text: "parent = list(range(n)), rank = [0]*n, components = n. Each node starts as its own root." },
      { level: 2, text: "find(x): while parent[x] != x, set parent[x] = parent[parent[x]] (halving) and move x up; return x." },
      { level: 3, text: "union(a,b): if find(a)==find(b) return False (redundant/cycle); else attach and return True." },
      { level: 4, text: "Union by rank: if rank[ra] < rank[rb] swap; parent[rb]=ra; if equal ranks, rank[ra]+=1." },
      { level: 5, text: "Scan pairs i<j; when is_connected[i][j] and union(i,j) returns True, do components -= 1. Return components." },
    ],
    tests: [
      { id: "t_two", description: "two provinces", assert: "assert find_provinces([[1,1,0],[1,1,0],[0,0,1]]) == 2" },
      { id: "t_three", description: "all separate", assert: "assert find_provinces([[1,0,0],[0,1,0],[0,0,1]]) == 3" },
      { id: "t_one", description: "all connected", assert: "assert find_provinces([[1,1,1],[1,1,1],[1,1,1]]) == 1" },
    ],
    hidden_tests: [
      { id: "h_single", description: "single person", assert: "assert find_provinces([[1]]) == 1" },
      { id: "h_chain", description: "transitive chain merges to 1", assert: "assert find_provinces([[1,1,0,0],[1,1,1,0],[0,1,1,1],[0,0,1,1]]) == 1" },
      { id: "h_two_pairs", description: "two separate pairs", assert: "assert find_provinces([[1,1,0,0],[1,1,0,0],[0,0,1,1],[0,0,1,1]]) == 2" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "g2-so-1",
        type: "select_one",
        prompt: "In Union Find for counting provinces, when do you decrement the component count?",
        concept: "union-find",
        difficulty: "easy",
        choices: [
          "Only when a union merges two DIFFERENT roots (a real union)",
          "On every edge you process",
          "Whenever find() is called",
          "Only at the very end, once",
        ],
        correct_index: 0,
        explanation: "A same-root edge is redundant (a cycle) and must not change the count; only a real merge reduces it.",
      },
      {
        id: "g2-sa-multi",
        type: "select_all",
        prompt: "Which statements about Union Find are true?",
        concept: "union-find",
        difficulty: "medium",
        choices: [
          "Two nodes are in the same group exactly when they share a root",
          "Path compression flattens the parent chain during find",
          "Union by rank attaches the shorter tree under the taller",
          "It returns the actual shortest path between two nodes",
        ],
        correct_indices: [0, 1, 2],
        explanation: "Union Find answers connectivity, not paths — use BFS/DFS for an actual route. The other three are core facts.",
      },
      {
        id: "g2-sa-none",
        type: "select_all",
        prompt: "For find_provinces([[1,1,0],[1,1,0],[0,0,1]]) = 2, which of these are correct descriptions? (If none, select none.)",
        concept: "union-find",
        difficulty: "hard",
        choices: [
          "There are 3 provinces because there are 3 people",
          "Persons 0, 1, and 2 form a single province",
          "The edge between person 0 and person 2 merges their groups",
        ],
        correct_indices: [],
        explanation: "None: persons 0 and 1 form one province and person 2 is alone (2 total); there is no 0–2 friendship in the matrix.",
      },
      {
        id: "g2-order",
        type: "ordering",
        prompt: "Order the steps of processing one friendship edge (a, b) in Union Find.",
        concept: "union-find",
        difficulty: "medium",
        items: [
          "find(a) and find(b) by walking parent pointers to the roots",
          "If the roots are equal, stop — the edge is redundant (a cycle)",
          "Otherwise attach the shorter-rank root under the taller",
          "Decrement the component count by one",
        ],
        correct_order: [
          "find(a) and find(b) by walking parent pointers to the roots",
          "If the roots are equal, stop — the edge is redundant (a cycle)",
          "Otherwise attach the shorter-rank root under the taller",
          "Decrement the component count by one",
        ],
      },
      {
        id: "g2-pattern",
        type: "pattern_recognition",
        prompt: "\"Given a list of edges added one at a time, find the first edge that creates a cycle in an undirected graph.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Union Find (DSU)", "Cycle detection via same-root union", "Dijkstra", "Sliding Window", "Binary Search"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Redundant Connection is Union Find: process edges, and the first edge whose endpoints already share a root closes the cycle.",
      },
      {
        id: "g2-written",
        type: "written",
        prompt: "Explain why path compression and union by rank together make each Union Find operation effectively constant, and what breaks if you use a bare parent array without them.",
        concept: "union-find",
        difficulty: "hard",
        actual_answer:
          "A bare parent array, where union just points one root at another with no balancing, can build a long chain — in the worst case a linked list of n nodes — so a single find walks O(n) pointers, and a sequence of operations degrades to O(n) each, timing out on large inputs. Union by rank fixes the shape: by always hanging the shorter tree under the taller, a tree's height only increases when two trees of equal height merge, which keeps height logarithmic in the group size, so find is already O(log n). Path compression fixes it further from the other side: during each find, every node on the path is re-pointed closer to the root (or directly to it), so the very next find on those nodes is nearly O(1). When both are combined, the flattening from compression and the balance from rank reinforce each other, and the amortized cost per operation drops to the inverse Ackermann function α(n), which is at most about four for any n you will ever run — effectively constant. So the fix is never to write Union Find with a plain parent array: always include the halving line in find and the rank comparison in union.",
        rubric:
          "Full credit: bare array → O(n) chain/find; union by rank keeps height log n; path compression flattens future finds; together α(n) ≈ constant. Partial: names one optimization or says 'faster' without the worst-case chain. Low: vague.",
      },
    ],
  },
};

// ── Final integrator practice_code: Course Schedule II (LC 210) — Kahn's topo ──
const finalCode = {
  prompt:
    "Integrator: return a valid order to take all courses given prerequisites [course, pre], or an empty list if impossible (a cycle). Use KAHN'S topological sort — BFS over in-degrees. Fill in the TODO: build adjacency pre→course and an in-degree array; seed a queue with every course of in-degree 0; pop a node, append it to the order, and for each neighbor decrement its in-degree, enqueuing it when it reaches 0. Return the order if it has all courses, else [].",
  starter_code:
    "from collections import deque\n\ndef find_order(num_courses, prerequisites):\n    adj = [[] for _ in range(num_courses)]\n    indegree = [0] * num_courses\n    for course, pre in prerequisites:\n        adj[pre].append(course)     # edge pre -> course\n        indegree[course] += 1\n\n    q = deque(c for c in range(num_courses) if indegree[c] == 0)\n    order = []\n    # TODO: Kahn's loop:\n    #   while q:\n    #       node = q.popleft(); order.append(node)\n    #       for nxt in adj[node]:\n    #           indegree[nxt] -= 1\n    #           if indegree[nxt] == 0: q.append(nxt)\n\n    return order if len(order) == num_courses else []\n",
  constraints: [
    "Build the graph as edges pre → course, and in-degree[course] = number of prerequisites pointing at it.",
    "Seed the queue with every node whose in-degree is 0 (no unmet prerequisite); those can go first.",
    "A cycle leaves some nodes with positive in-degree forever, so if the produced order has fewer than num_courses nodes, return [] (impossible).",
  ],
  walkthrough: {
    title: "Kahn's algorithm: peel off in-degree-zero nodes",
    steps: [
      { title: "Build adjacency + in-degrees", detail: "For each [course, pre], add edge pre→course and increment in-degree of course. In-degree counts unmet prerequisites.", input: "prerequisites", output: "adj list + indegree array" },
      { title: "Seed and peel", detail: "Enqueue every in-degree-0 node. Pop one, append to the order, and decrement each neighbor's in-degree; when a neighbor hits 0, all its prerequisites are met, so enqueue it.", input: "the in-degree-0 frontier", output: "a growing valid order" },
      { title: "Detect the cycle", detail: "If the final order is shorter than num_courses, some nodes never reached in-degree 0 — they are stuck in a cycle — so return []. ", input: "the produced order", output: "the order or []" },
    ],
  },
  io_examples: [
    { label: "linear", input: "num_courses = 2, prerequisites = [[1,0]]", expected_output: "[0, 1]", explanation: "Course 0 has no prerequisite; take it first, then course 1." },
    { label: "diamond", input: "num_courses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]", expected_output: "[0,1,2,3] (one valid order)", explanation: "0 first, then 1 and 2 in either order, then 3 last." },
    { label: "cycle", input: "num_courses = 2, prerequisites = [[1,0],[0,1]]", expected_output: "[]", explanation: "0 needs 1 and 1 needs 0 — neither reaches in-degree 0, so it is impossible." },
  ],
  visualization: {
    title: "in-degrees · peel zeros · shorter order means a cycle",
    description: "Kahn's is BFS over in-degree-zero nodes.",
    items: [
      { label: "indegree[course] = #prereqs", value: "unmet prerequisites", role: "input" },
      { label: "pop a 0, decrement neighbors", value: "peel a layer", role: "process" },
      { label: "len(order) < n ? [] : order", value: "the answer", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "The Kahn's topological-sort template",
      code:
        "from collections import deque\ndef find_order(num_courses, prerequisites):\n    adj = [[] for _ in range(num_courses)]\n    indegree = [0]*num_courses\n    for course, pre in prerequisites:\n        adj[pre].append(course); indegree[course] += 1\n    q = deque(c for c in range(num_courses) if indegree[c] == 0)\n    order = []\n    while q:\n        node = q.popleft(); order.append(node)\n        for nxt in adj[node]:\n            indegree[nxt] -= 1\n            if indegree[nxt] == 0: q.append(nxt)\n    return order if len(order) == num_courses else []",
      explanation: "BFS over in-degrees. A cycle leaves nodes with positive in-degree, so a short order signals impossibility. O(V+E).",
    },
    {
      label: "concise",
      title: "The DFS post-order variant (reverse finish order)",
      code:
        "def find_order_dfs(num_courses, prerequisites):\n    adj = [[] for _ in range(num_courses)]\n    for course, pre in prerequisites:\n        adj[pre].append(course)\n    state = [0]*num_courses   # 0 unvisited, 1 on-stack, 2 done\n    order = []\n    def dfs(u):\n        if state[u] == 1: return False   # back edge → cycle\n        if state[u] == 2: return True\n        state[u] = 1\n        for v in adj[u]:\n            if not dfs(v): return False\n        state[u] = 2\n        order.append(u)                  # post-order\n        return True\n    for u in range(num_courses):\n        if not dfs(u): return []\n    return order[::-1]",
      explanation: "The depth-first version pushes a node after its whole subtree finishes (post-order); reversed, that is a topological order. A node found on the active stack (state 1) is a cycle.",
    },
  ],
  hints: [
    { level: 1, text: "Build adj[pre].append(course) and indegree[course] += 1 for each [course, pre]." },
    { level: 2, text: "Seed a queue with every course whose indegree is 0 — those have no unmet prerequisite." },
    { level: 3, text: "Pop a node, append it to order, and for each neighbor decrement indegree; enqueue a neighbor when its indegree hits 0." },
    { level: 4, text: "This is BFS: each node is enqueued exactly when its last prerequisite is satisfied." },
    { level: 5, text: "If len(order) < num_courses, a cycle blocked some nodes — return []. Otherwise return order." },
  ],
  tests: [
    { id: "f_linear", description: "two courses", assert: "assert find_order(2, [[1,0]]) == [0, 1]" },
    { id: "f_diamond", description: "diamond order valid", assert: "assert find_order(4, [[1,0],[2,0],[3,1],[3,2]]) in ([0,1,2,3],[0,2,1,3])" },
    { id: "f_cycle", description: "cycle → []", assert: "assert find_order(2, [[1,0],[0,1]]) == []" },
  ],
  hidden_tests: [
    { id: "hf_one", description: "single course, no prereqs", assert: "assert find_order(1, []) == [0]" },
    { id: "hf_none", description: "no prereqs → all in order", assert: "assert find_order(3, []) == [0,1,2]" },
    { id: "hf_self", description: "self-loop is a cycle", assert: "assert find_order(1, [[0,0]]) == []" },
  ],
};

// ── Timed code drill: Network Delay Time (Dijkstra, LeetCode 743) ─────────────
const codeDrill = {
  pattern: "graph-traversal",
  prompt:
    "One rep, timed: a signal starts at node k in a directed weighted graph of n nodes (times[i] = [u, v, w]); return the time for ALL nodes to receive it, or -1 if some node is unreachable. This is DIJKSTRA — a priority queue keyed by distance. Pop the cheapest node, finalize it, relax its edges; the answer is the max finalized distance. Skip stale heap entries (d > dist[u]).",
  target_seconds: 600,
  difficulty: "medium",
  language: "python",
  starter_code:
    "import heapq\n\ndef network_delay_time(times, n, k):\n    adj = [[] for _ in range(n + 1)]\n    for u, v, w in times:\n        adj[u].append((v, w))\n    dist = [float('inf')] * (n + 1)\n    dist[k] = 0\n    heap = [(0, k)]\n\n    while heap:\n        d, u = heapq.heappop(heap)\n        # TODO:\n        #   if d > dist[u]: continue            # stale entry, skip\n        #   for v, w in adj[u]:\n        #       if d + w < dist[v]:\n        #           dist[v] = d + w\n        #           heapq.heappush(heap, (dist[v], v))\n        pass\n\n    ans = max(dist[1:])\n    return ans if ans != float('inf') else -1\n",
  tests: [
    { id: "d_classic", description: "spreads in 2", assert: "assert network_delay_time([[2,1,1],[2,3,1],[3,4,1]], 4, 2) == 2" },
    { id: "d_one_edge", description: "single edge", assert: "assert network_delay_time([[1,2,1]], 2, 1) == 1" },
    { id: "d_unreach", description: "node 1 unreachable from 2", assert: "assert network_delay_time([[1,2,1]], 2, 2) == -1" },
    { id: "d_shortcut", description: "cheaper multi-hop beats direct", assert: "assert network_delay_time([[1,2,1],[2,3,2],[1,3,4]], 3, 1) == 3" },
    { id: "d_single_node", description: "one node, already there", assert: "assert network_delay_time([], 1, 1) == 0" },
  ],
  hints: [
    { unlock_at_pct: 33, text: "Build an adjacency list adj[u] = [(v, w), ...]. dist[k]=0, all others infinity. Push (0, k) onto a min-heap." },
    { unlock_at_pct: 66, text: "Pop (d, u); if d > dist[u] it is a stale entry, skip it. Otherwise relax: for each (v, w), if d+w < dist[v], update dist[v] and push (dist[v], v)." },
    { unlock_at_pct: 100, text: "The answer is max(dist[1:]) (all nodes must receive it); if that is still infinity, some node is unreachable → return -1." },
  ],
  solution:
    "import heapq\n\ndef network_delay_time(times, n, k):\n    adj = [[] for _ in range(n + 1)]\n    for u, v, w in times:\n        adj[u].append((v, w))\n    dist = [float('inf')] * (n + 1)\n    dist[k] = 0\n    heap = [(0, k)]\n    while heap:\n        d, u = heapq.heappop(heap)\n        if d > dist[u]:\n            continue\n        for v, w in adj[u]:\n            if d + w < dist[v]:\n                dist[v] = d + w\n                heapq.heappush(heap, (dist[v], v))\n    ans = max(dist[1:])\n    return ans if ans != float('inf') else -1\n",
};

// ── Assessment (adaptive MC + freeform) ───────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Explain the 'one loop, swap the container' mental model for graph traversal: what container gives BFS, DFS, and Dijkstra, and what problem shape does each one solve?",
      type: "free_text",
      concept: "graph-traversal",
      difficulty: "medium",
      actual_answer:
        "Graph traversal is a single loop — pop a node from a frontier, look at its neighbors, and record and push the newly discovered ones — and the data structure you pop from decides its behavior. Pop from a FIFO queue and you get breadth-first search: it fans out in rings of equal distance, so it solves shortest paths in an unweighted graph and any 'fewest steps / spread' problem. Pop from a stack, or use the call stack via recursion, and you get depth-first search: it plunges down one path before backtracking, which makes it the tool for connectivity, cycle detection, and topological ordering. Pop from a priority queue keyed by distance and you get Dijkstra: it always expands the cheapest-so-far node, which solves shortest paths when edge weights are non-negative. So you pick the container from the question: shortest and unweighted means a queue, shortest and weighted-non-negative means a heap, and ordering or connectivity means recursion (or Union Find for pure incremental connectivity). Union Find is not a traversal at all — it maintains connectivity as edges arrive. Recognizing which container the problem wants is what converts 'this is a graph problem' into the right algorithm in seconds.",
      rubric:
        "Full credit: queue→BFS→shortest unweighted; stack/recursion→DFS→connectivity/ordering/cycles; priority queue→Dijkstra→non-negative weighted shortest; picking container from the question. Partial: names the three but not the problem shapes. Low: vague.",
      support_ref: "graph-part-1-bfs",
    },
    {
      id: "a-free-2",
      text: "A candidate uses a plain BFS queue on a weighted graph to find the cheapest path and gets a wrong answer. Explain precisely why BFS fails there, and why Dijkstra needs non-negative edges to be correct.",
      type: "free_text",
      concept: "graph-traversal",
      difficulty: "hard",
      actual_answer:
        "Plain BFS counts edges, not cost: because a FIFO queue processes nodes in order of the number of edges from the source, the first time it reaches a node is along the path with the fewest edges, which is only the cheapest path when every edge has the same weight. On a weighted graph a path with more edges can have a smaller total cost, and BFS will have already 'finalized' the node along its fewer-edges-but-more-expensive path, so it reports a wrong minimum. Dijkstra fixes this by pulling from a priority queue keyed by accumulated distance, so it always expands the cheapest-so-far node and finalizes it. Its correctness rests on one promise: when a node is popped, no cheaper path to it can still exist, because every remaining path goes through some not-yet-finalized node whose distance is already at least the popped node's, and non-negative edges can only add to that. A negative edge breaks the promise directly — a later path could dip below the distance you already finalized, since adding a negative edge lowers a total — so 'finalize on first pop' becomes false and Dijkstra silently reports wrong distances. With negative edges you switch to Bellman-Ford, which relaxes all edges repeatedly and tolerates them.",
      rubric:
        "Full credit: BFS finalizes fewest-edges not cheapest, wrong on weights; Dijkstra pops cheapest and finalizes, correct because non-negative edges guarantee no cheaper path remains; a negative edge voids that so use Bellman-Ford. Partial: says BFS is unweighted-only without the Dijkstra invariant. Low: vague.",
      support_ref: "graph-part-1-bfs",
    },
    {
      id: "a-free-3",
      text: "Kahn's algorithm (in-degree BFS) both produces a topological order and detects cycles. Explain how one mechanism does both, and how the DFS post-order variant detects a cycle differently.",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "medium",
      actual_answer:
        "Kahn's algorithm computes each node's in-degree (its number of unmet prerequisites) and seeds a queue with every in-degree-zero node, because those can come first. It repeatedly pops a node, appends it to the order, and decrements each neighbor's in-degree — having just satisfied one of that neighbor's prerequisites — enqueuing any neighbor that reaches in-degree zero. This produces a valid ordering as it goes, since a node is only emitted once all its prerequisites are already emitted. The same mechanism detects cycles for free: if the graph has a cycle, every node in that cycle is waiting on another node in the same cycle, so none of them ever reaches in-degree zero and none ever enters the queue. Therefore the produced order will contain fewer nodes than the graph, and a short order is exactly the signal that the constraints are impossible. The DFS variant detects a cycle differently: it runs a recursion that pushes a node onto the result only after its entire subtree finishes (post-order, reversed for the topological order), and it marks nodes with three states — unvisited, on the active call stack, and done. If the recursion ever reaches a node that is currently on the active stack, that is a back edge, which means a cycle. So Kahn's detects cycles by leftover positive-in-degree nodes; DFS detects them by encountering a gray, on-stack node.",
      rubric:
        "Full credit: Kahn's peels in-degree-0 nodes to build the order, cycle nodes never hit 0 so a short order = cycle; DFS uses post-order (reversed) and detects a cycle via a node found on the active call stack (back edge). Partial: explains one method's cycle detection. Low: vague.",
      support_ref: "graph-part-2-unionfind",
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
        question: "Graph traversal is one loop; which container gives which behavior?",
        choices: [
          "Queue → BFS (shortest unweighted), stack/recursion → DFS (ordering/connectivity), priority queue → Dijkstra (weighted)",
          "Queue → Dijkstra, stack → BFS, heap → DFS",
          "They are unrelated algorithms with nothing in common",
          "Stack → BFS, queue → DFS, heap → Union Find",
        ],
        correct_index: 0,
        explanation: "The frontier container sets the traversal's personality — that is the whole reactivation model.",
        concept: "graph-traversal",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "graph-part-1-bfs",
      },
      {
        id: "q2",
        question: "In BFS, when should you mark a node visited?",
        choices: [
          "When you ENQUEUE it, so each node enters the frontier exactly once",
          "When you dequeue it, to save memory",
          "After you process all its neighbors",
          "Only if it is the target node",
        ],
        correct_index: 0,
        explanation: "Marking on dequeue lets multiple neighbors enqueue the same node, inflating the queue and corrupting distances.",
        concept: "graph-traversal",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "graph-part-1-bfs",
      },
      {
        id: "q3",
        question: "In multi-source BFS (rotting oranges), what does the minute a cell rots represent?",
        choices: [
          "Its distance to the NEAREST source, because all sources start at minute 0",
          "Its distance to a single fixed source",
          "The total number of rotten cells so far",
          "A random spreading order",
        ],
        correct_index: 0,
        explanation: "Seeding all sources at distance 0 makes the layer a cell is reached on its distance to the closest source.",
        concept: "graph-traversal",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "graph-part-1-bfs",
      },
      {
        id: "q4",
        question: "In Union Find, when does the component count decrease?",
        choices: [
          "Only on a real union — when the two endpoints have DIFFERENT roots",
          "On every edge processed",
          "Every time find() is called",
          "When path compression runs",
        ],
        correct_index: 0,
        explanation: "A same-root edge is redundant (a cycle) and must not change the count.",
        concept: "union-find",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "graph-part-2-unionfind",
      },
      {
        id: "q5",
        question: "What makes Union Find operations effectively constant time?",
        choices: [
          "Path compression (flatten during find) plus union by rank (shorter tree under taller)",
          "Sorting the edges first",
          "Using a priority queue",
          "Marking nodes visited on enqueue",
        ],
        correct_index: 0,
        explanation: "Together they give an amortized inverse-Ackermann cost per operation; a bare parent array degrades to O(n).",
        concept: "union-find",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "graph-part-2-unionfind",
      },
      {
        id: "q6",
        question: "Why does Dijkstra require non-negative edge weights?",
        choices: [
          "'Finalize a node on its first pop' is only valid if no later path can be cheaper — a negative edge could lower a finalized distance",
          "Because heaps cannot store negative numbers",
          "To keep the graph connected",
          "Negative edges make the graph directed",
        ],
        correct_index: 0,
        explanation: "A negative edge breaks the invariant; use Bellman-Ford instead.",
        concept: "graph-traversal",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "graph-part-1-bfs",
      },
      {
        id: "q7",
        question: "Which problems are graph fingerprints from this lesson? (Select all that apply.)",
        choices: [
          "\"fewest steps to spread across a grid\"",
          "\"count connected groups as edges arrive\"",
          "\"the two numbers that sum to a target\"",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "Grid spread is multi-source BFS and counting groups is Union Find; two-sum is a hashing job, not a graph.",
        concept: "pattern-recognition",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "graph-part-1-bfs",
      },
      {
        id: "q8",
        question: "How does Kahn's topological sort detect an impossible (cyclic) schedule?",
        choices: [
          "The nodes in a cycle never reach in-degree 0, so the produced order has fewer nodes than the graph",
          "It throws an exception on the first back edge",
          "It sorts and checks for duplicates",
          "It counts negative edges",
        ],
        correct_index: 0,
        explanation: "Cycle nodes stay blocked with positive in-degree, so a short order signals impossibility.",
        concept: "pattern-recognition",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "graph-part-2-unionfind",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-graph-container", prompt: "Given a fresh graph problem, how fast can you now name the right frontier container (queue / stack / heap / Union Find) and justify it?", hint: "Shortest unweighted → queue; weighted non-negative → heap; ordering/connectivity → recursion or DSU." },
  { id: "diag-graph-visited", prompt: "Can you state in one sentence WHEN you mark a node visited in BFS and why marking on dequeue is a bug?", hint: "Mark on enqueue so each node enters the frontier exactly once." },
  { id: "diag-graph-speed", prompt: "Could you write multi-source BFS, Union Find, Kahn's topo sort, and Dijkstra from memory in under 6 minutes each right now? What slows you down?", hint: "Execution speed on the seeding, the visited timing, and the heap stale-entry skip is the interview bottleneck." },
  { id: "diag-graph-traps", prompt: "Can you list the four graph traps and catch them in your own code before running it?", hint: "Visited timing, container mismatch, Dijkstra on negatives, and bare Union Find." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "Graph reactivation in the interview-pattern map",
  description:
    "This lesson reactivates the graph machine at interview speed: one traversal loop whose frontier container sets its behavior (queue → BFS, stack/recursion → DFS, priority queue → Dijkstra), multi-source BFS, Union Find for incremental connectivity, and Kahn's topological sort. System-design algorithmic patterns are the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "graph-container", label: "One loop, swap the container", category: "lesson_concept", covered: true },
    { id: "graph-bfs", label: "Multi-source BFS (layers = distance)", category: "lesson_concept", covered: true },
    { id: "graph-unionfind", label: "Union Find (incremental connectivity)", category: "lesson_concept", covered: true },
    { id: "graph-topo", label: "Kahn's topological sort", category: "lesson_concept", covered: true },
    { id: "dp-reactivation", label: "DP reactivation (prior)", category: "concept", covered: true },
    { id: "graph-dijkstra", label: "Dijkstra (non-negative weighted)", category: "concept", preview: true },
    { id: "system-design", label: "System Design algo patterns (next)", category: "concept" },
  ],
  edges: [],
  curriculum_stages: [
    { id: "backtracking", label: "Backtracking", status: "done" },
    { id: "monotonic-stack", label: "Monotonic Stack", status: "done" },
    { id: "dp-reactivation", label: "DP reactivation", status: "done" },
    { id: "graph-reactivation", label: "Graph reactivation", status: "current" },
    { id: "system-design", label: "System Design algo patterns", status: "next" },
    { id: "mock-interview", label: "Mock interview simulation", status: "later" },
  ],
  current: "graph-reactivation",
};

const planningRationale =
  "Graphs are reactivated rather than taught because the imported repo evidence flags tree-and-graph, union-find, and topological work as among the learner's most-practiced but stalest areas — heavy historical comfort, so the bottleneck is recall speed, not understanding. The lesson is built around one reusable mental model: graph traversal is a single loop whose frontier container sets its behavior, so a queue yields breadth-first search and shortest unweighted paths, a stack or recursion yields depth-first search for connectivity and ordering, and a priority queue yields Dijkstra for non-negative weighted shortest paths, with Union Find held in the other hand for pure incremental connectivity. Part one grounds the model on multi-source breadth-first search via Rotting Oranges, where seeding every source at distance zero makes the layer a cell is reached on its distance to the nearest source, and the mark-on-enqueue discipline is taught explicitly as the invariant that keeps the traversal linear and the distance well defined. Part two attacks Union Find via Number of Provinces, teaching path compression and union by rank as the mechanism behind near-constant operations and the same-root-edge-is-a-cycle rule that governs when the component count drops. The scaffolded exercises (multi-source BFS, Union Find) plus the Course Schedule II integrator (Kahn's topological sort, which doubles as a cycle detector) and a timed Network Delay Time drill (Dijkstra with a heap) build execution speed across all four canonical graph tools, while pattern_recognition questions and a BFS-on-a-weighted-graph failure case build the recognition and debugging judgment that separates fast interviewees from those who rederive the machinery under pressure. It connects backward to the dynamic-programming reactivation lesson and forward to system-design algorithmic patterns.";

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
  bad = fail("Part 1 (multi-source BFS)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (Union Find)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code (Course Schedule II)", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Code drill (Network Delay Time)", validateCodeDrillContent(codeDrill)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1680)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Graph Reactivation: One Loop, Swap the Container — BFS, Dijkstra, Union Find, Topo";
  const description =
    "You already know graphs — this lesson rebuilds the speed to pick the right traversal and code it calmly. Graph traversal is one loop whose frontier container sets its behavior: a queue gives breadth-first search (shortest unweighted paths), a stack or recursion gives depth-first search (connectivity, ordering, cycles), and a priority queue gives Dijkstra (non-negative weighted shortest paths). Union Find is the separate incremental-connectivity tool. Drills multi-source BFS (Rotting Oranges), Union Find (Number of Provinces), Kahn's topological sort (Course Schedule II), and Dijkstra (Network Delay Time), with the mark-on-enqueue discipline and the four graph traps.";
  const goals = JSON.stringify([
    "Pick the frontier container from the problem in seconds — queue for shortest unweighted, heap for non-negative weighted, recursion or Union Find for ordering/connectivity",
    "Write multi-source BFS, Union Find (with path compression + union by rank), Kahn's topological sort, and Dijkstra from memory to interview timing",
    "Explain the mark-on-enqueue invariant, why Dijkstra needs non-negative edges, and the four graph traps",
  ]);
  const tags = JSON.stringify(["graph-traversal", "bfs", "dfs", "union-find", "dijkstra", "topological-sort", "reactivation", "interview-prep"]);
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
    insertAct.run(lessonId, "audio", 1, "Audio: graph reactivation — one loop, swap the container", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Multi-source BFS — layers are distances", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Union Find — incremental connectivity", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: Course Schedule II (Kahn's topological sort)", JSON.stringify(finalCode));
    insertAct.run(lessonId, "code_drill", 5, "Drill: Network Delay Time (Dijkstra)", JSON.stringify(codeDrill));
    insertAct.run(lessonId, "assessment", 6, "Assessment: graph reactivation recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 6 activities.`);
  closeDb();
}

main();
