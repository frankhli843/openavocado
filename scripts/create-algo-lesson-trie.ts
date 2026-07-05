#!/usr/bin/env tsx
/**
 * P4.1 — Lesson 5 of the "Coding Interview Mastery" subject (id 9):
 * "Trie / Prefix Tree: Store Strings by Their Shared Beginnings".
 *
 * Hand-authored per the avocadocore-lesson-authoring skill (no AI harness in
 * this env). Weak-pattern-first: Trie has only ~4 imported evidence rows (two
 * hard problems, no repeat practice), so it gets full teaching.
 *
 * Structure mirrors the Sliding Window / Two Pointer / Heap lessons: top-level
 * 2-host overview audio + orientation visual, two collapsed lesson_parts
 * (structure + insert/search; prefix autocomplete) each with a bespoke approved
 * artifact + per-part audio synced visual + scaffolded code + mixed practice
 * (incl. pattern_recognition), a final integrator practice_code (the full Trie
 * class, LeetCode 208), an adaptive MC + freeform assessment, and a timed
 * code_drill (count words with a prefix). Cue timings are provisional and
 * rescaled to the real generated audio duration by rescale-trie-cues.mjs.
 *
 * References the three approved bespoke artifacts:
 *   algo-trie-overview-map, algo-trie-structure, algo-trie-prefix
 *
 * Idempotent: replaces any prior seq=4 lesson for the subject.
 *
 * Run under node 22:  pnpm tsx scripts/create-algo-lesson-trie.ts
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
import { OVERVIEW_SCRIPT, PART1_SCRIPT, PART2_SCRIPT } from "./algo-artifacts/trie-audio";

const SUBJECT_ID = 9;
const SEQ = 4;

const A_OVERVIEW = "algo-trie-overview-map";
const A_STRUCTURE = "algo-trie-structure";
const A_PREFIX = "algo-trie-prefix";

// ── Top-level orientation visual (paired with the overview audio) ─────────────
const orientationVisual = {
  strategy: "timeline" as const,
  artifact_slug: A_OVERVIEW,
  scene: {
    scene_id: "trie-orientation",
    title: "Trie / Prefix Tree: the family map",
    motif: "store-strings-by-their-shared-beginnings",
    description:
      "Orientation for the whole pattern: scanning every word for a prefix is O(number of words times length); a trie stores strings along character paths so words that begin the same share the same path, turning any prefix question into a single O(length) walk. A node is a child-per-character map plus an end-of-word flag; search checks the flag, startsWith ignores it.",
    panels: [
      {
        id: "cost",
        title: "Cost collapse",
        kind: "flow" as const,
        description: "Why the pattern exists: scanning every stored word for a prefix is O(N·len); walking one shared path is O(len).",
        data: [
          { label: "scan every word for a prefix", value: "O(N · len)", role: "input" as const },
          { label: "store strings by shared prefix", value: "one path per common start", role: "process" as const },
          { label: "search / startsWith", value: "O(len)", role: "output" as const },
        ],
      },
      {
        id: "jobs",
        title: "Four fingerprints",
        kind: "cards" as const,
        description: "Prefix queries, autocomplete, many dictionary lookups against a fixed word list, and grid word-search pruning.",
        data: [
          { label: "prefix queries", value: "\"words starting with\"", role: "context" as const },
          { label: "autocomplete", value: "walk prefix, DFS subtree", role: "context" as const },
          { label: "grid word-search", value: "prune dead letter paths", role: "context" as const },
        ],
      },
    ],
  },
  cues: [
    { start: 0, end: 150, label: "The prefix cost", headline: "Scanning every word is O(N·len)", narration: "A hash set answers exact membership but is useless for prefixes; scanning every word is wasteful.", receive: "a big dictionary of words", transform: "repeated prefix scans", pass: "a baseline cost to beat" },
    { start: 150, end: 340, label: "Store by shared prefix", headline: "Words that start alike share a path", narration: "A trie stores strings along character-labeled paths; car, card, cart share c-a-r and split only where they differ.", receive: "many strings", transform: "merge common beginnings", pass: "one path per shared prefix" },
    { start: 340, end: 540, label: "What a node is", headline: "Child map + end-of-word flag", narration: "Each node holds a map from a character to a child and a boolean marking that a real word ends here.", receive: "a position in the tree", transform: "store children and a flag", pass: "a spellable prefix" },
    { start: 540, end: 740, label: "Three walks", headline: "Insert, search, startsWith", narration: "All three walk the string; insert creates missing children and flags the end, search checks the flag, startsWith ignores it.", receive: "a query string", transform: "walk character by character", pass: "an O(length) answer" },
    { start: 740, end: 940, label: "The flag matters", headline: "card stored, car not stored", narration: "If only card was inserted the c-a-r path exists, so search must check the end-of-word flag, not just the path.", receive: "a prefix of a stored word", transform: "consult the flag", pass: "a correct membership answer" },
    { start: 940, end: 1140, label: "The four fingerprints", headline: "Prefix, autocomplete, dictionary, grid", narration: "Prefix queries, type-ahead suggestions, many lookups on a fixed word list, and pruning dead paths in a grid word-search.", receive: "a problem statement", transform: "match to a trie fingerprint", pass: "the right structure" },
    { start: 1140, end: 1280, label: "When it fails", headline: "Exact-only, huge alphabet, memory", narration: "For exact membership with no prefixes a hash set is simpler; tries trade memory for speed and can be heavy on sparse data.", receive: "a candidate problem", transform: "check for prefix reasoning", pass: "a go / no-go decision" },
  ],
};

// ── Reading builder helper ────────────────────────────────────────────────────
const trieComplexity = {
  type: "formula",
  latex: "\\text{scan } O(N \\cdot L) \\;\\longrightarrow\\; \\text{trie } O(L)",
  plain_english:
    "Scanning every one of N stored words to answer a prefix question costs the total text length; a trie walks a single character path for the query string, so each insert, search, or prefix check is O(L) in the length of that string and does not depend on how many words are stored.",
  variables: [
    { symbol: "N", meaning: "the number of words stored in the trie" },
    { symbol: "L", meaning: "the length of the query string (word or prefix) being walked" },
  ],
};

// ── Part 1: structure + insert/search ─────────────────────────────────────────
const part1 = {
  part_id: "trie-part-1-structure",
  reading: {
    blocks: [
      { type: "heading", text: "Trie structure: one node is a child map plus an end-of-word flag" },
      {
        type: "paragraph",
        text:
          "A trie stores strings along character-labeled paths from a root that represents the empty prefix. Each node holds exactly two things: a map from a single character to a child node, and a boolean flag that says a complete word ends right here. Words that begin the same way share the same path until they diverge — car, card, and cart all ride c, a, r and only then split — so a common prefix is stored once. Every operation walks the string character by character, doing one constant-time child lookup per step, which makes insert, search, and startsWith all O(length of the string), independent of how many words the trie holds.",
      },
      {
        type: "definition",
        term: "End-of-word flag",
        definition:
          "A boolean on each trie node marking that the path from the root to this node spells a complete stored word (not merely a prefix of a longer one). Search must check it; a path existing only proves the characters exist as a prefix of something.",
      },
      {
        type: "example",
        body:
          "Insert car, then card: c-a-r are created and the r node is flagged; card reuses c-a-r and only adds d, flagging the d node. Now search(\"car\") walks c-a-r and returns true because the r node's flag is set. But search(\"ca\") walks c-a, finds the node, and returns FALSE — the node exists as a shared prefix but its flag is off, because \"ca\" was never stored. startsWith(\"ca\") returns true, because it only asks whether the prefix leads anywhere and never checks the flag.",
      },
      trieComplexity,
    ],
  },
  audio: {
    script: PART1_SCRIPT,
    transcript: PART1_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_STRUCTURE,
      scene: {
        scene_id: "trie-structure-scene",
        title: "Insert grows shared paths; the flag marks real words",
        motif: "path-exists-versus-word-ends",
        description: "A trie built by inserting car, card, and cat, then queried, so the learner sees insert reuse shared prefixes and sees search consult the end-of-word flag while startsWith ignores it.",
        panels: [
          {
            id: "nodes",
            title: "Node contents",
            kind: "matrix" as const,
            description: "What each trie node stores and what the root represents.",
            data: [
              { label: "each node", value: "char → child map + flag", role: "context" as const },
              { label: "root", value: "the empty prefix", role: "input" as const },
            ],
          },
          {
            id: "ops",
            title: "The three walks",
            kind: "ledger" as const,
            description: "How insert, search, and startsWith each use the flag.",
            data: [
              { label: "insert", value: "create missing, flag the end", role: "input" as const },
              { label: "search", value: "consume all AND flag set", role: "process" as const },
              { label: "startsWith", value: "consume all, ignore flag", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "A node's contents", headline: "Child map + end-of-word flag", narration: "Each node maps a character to a child and carries a boolean marking that a word ends here.", receive: "a position in the tree", transform: "store children and a flag", pass: "a spellable prefix" },
        { start: 30, end: 62, label: "Insert car", headline: "Create c, a, r; flag the end", narration: "Insert walks the characters, creating any that are missing, and sets the end-of-word flag on the final node.", receive: "the word car", transform: "create the path", pass: "a stored word" },
        { start: 62, end: 95, label: "Insert card", headline: "Reuse c-a-r, add only d", narration: "card shares the whole car path, so only the d node is new — the common prefix is stored once.", receive: "the word card", transform: "reuse the shared path", pass: "a branch at d" },
        { start: 95, end: 128, label: "search(car) is true", headline: "Path exists AND flag set", narration: "search walks c-a-r; the node exists and its end-of-word flag is set, so it returns true.", receive: "the query car", transform: "walk then check the flag", pass: "true" },
        { start: 128, end: 150, label: "search(ca) is false", headline: "Prefix node, flag off", narration: "search walks c-a; the node exists but its flag is off, because ca was never stored, so it returns false.", receive: "the query ca", transform: "walk then check the flag", pass: "false" },
        { start: 150, end: 165, label: "startsWith(ca) is true", headline: "Consume prefix, ignore flag", narration: "startsWith walks c-a, consumes the whole prefix, and returns true without ever checking the flag.", receive: "the prefix ca", transform: "walk, skip the flag", pass: "true" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to insert car, card, and cat one at a time and watch the shared prefixes merge into one path. Then step through the three lookups and note how search(\"ca\") is false — the node exists but its end-of-word flag is off — while startsWith(\"ca\") is true because it never checks the flag.",
    params: { artifact_slug: A_STRUCTURE, min_height: 360 },
  },
  code: {
    prompt:
      "Build a trie from a list of words, then report whether a query is a STORED word (not merely a prefix). Represent a node as a dict of char → child dict, with the sentinel key \"#\" marking end-of-word. Fill in the two TODO helpers, then compose them.",
    starter_code:
      "END = \"#\"\n\n\ndef insert(root, word):\n    # TODO: walk word char by char from root, creating a child dict for any\n    # missing character (use dict.setdefault), then set root-node[END] = True\n    # on the final node. Return root.\n    pass\n\n\ndef search(root, word):\n    # TODO: walk word char by char; if any character is missing, return False.\n    # If you consume the whole word, return True only if END is set on the\n    # node you finished on.\n    pass\n\n\ndef build_and_search(words, query):\n    # Compose: build the trie by inserting every word, then search the query.\n    root = {}\n    for w in words:\n        insert(root, w)\n    return search(root, query)\n",
    constraints: [
      "A node is a dict; children are keyed by a single character, and END = \"#\" flags a complete word.",
      "search must return False for a prefix that was never stored (e.g. \"car\" when only \"card\" was inserted).",
      "Each operation is O(length of the string), independent of how many words are stored.",
    ],
    walkthrough: {
      title: "From blank file to trie membership with the end-of-word flag",
      steps: [
        { title: "Insert walks and creates", detail: "insert steps through the word, using setdefault so a missing character gets a fresh empty child dict, then flags the final node with END = True.", input: "root, word", output: "the trie with the word stored" },
        { title: "Search walks and checks the flag", detail: "search steps through the word; a missing character means the word is absent, and consuming the word is only a match if END is set on the last node.", input: "root, word", output: "True only for a stored word" },
        { title: "Compose build then search", detail: "Insert every word to build the trie, then search the query; the flag is what makes a prefix like \"car\" of a stored \"card\" return False.", input: "words, query", output: "membership of the query" },
      ],
    },
    io_examples: [
      { label: "stored word", input: "words = [\"car\",\"card\",\"cat\"], query = \"car\"", expected_output: "True", explanation: "The r node is flagged end-of-word." },
      { label: "prefix only", input: "words = [\"card\"], query = \"car\"", expected_output: "False", explanation: "The c-a-r path exists on the way to card, but car was never stored, so its flag is off." },
      { label: "absent", input: "words = [\"cat\"], query = \"dog\"", expected_output: "False", explanation: "The first character has no child, so search fails immediately." },
    ],
    visualization: {
      title: "Insert every word → walk the query → check the flag",
      description: "The end-of-word flag separates a stored word from a passing-through prefix.",
      items: [
        { label: "insert words", value: "create paths, flag word-ends", role: "input" },
        { label: "walk the query char by char", value: "one child lookup per step", role: "process" },
        { label: "stored only if END set", value: "True / False", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Explicit helpers",
        code:
          "END = \"#\"\n\ndef insert(root, word):\n    node = root\n    for ch in word:\n        node = node.setdefault(ch, {})\n    node[END] = True\n    return root\n\ndef search(root, word):\n    node = root\n    for ch in word:\n        if ch not in node:\n            return False\n        node = node[ch]\n    return node.get(END, False)\n\ndef build_and_search(words, query):\n    root = {}\n    for w in words:\n        insert(root, w)\n    return search(root, query)",
        explanation: "setdefault creates missing children; the END sentinel is what distinguishes a stored word from a mere prefix.",
      },
      {
        label: "concise",
        title: "Same idea, tightened",
        code:
          "END = \"#\"\n\ndef build_and_search(words, query):\n    root = {}\n    for w in words:\n        node = root\n        for ch in w:\n            node = node.setdefault(ch, {})\n        node[END] = True\n    node = root\n    for ch in query:\n        if ch not in node:\n            return False\n        node = node[ch]\n    return node.get(END, False)",
        explanation: "Inlining insert and search shows the shared skeleton: both just walk the string one character at a time.",
      },
    ],
    hints: [
      { level: 1, text: "A node is a plain dict; its keys are single characters mapping to child dicts, plus one sentinel key END that marks a complete word." },
      { level: 2, text: "insert: node = node.setdefault(ch, {}) steps into (or creates) the child; after the loop set node[END] = True." },
      { level: 3, text: "search: if ch not in node return False; otherwise node = node[ch]." },
      { level: 4, text: "After consuming the whole word, return node.get(END, False) — NOT just True — so a bare prefix returns False." },
      { level: 5, text: "That final flag check is why search(\"car\") is False when only \"card\" was inserted." },
    ],
    tests: [
      { id: "t_stored", description: "a stored word is found", assert: "assert build_and_search([\"car\",\"card\",\"cat\"], \"car\") == True" },
      { id: "t_prefix_only", description: "a prefix of a stored word is not itself a word", assert: "assert build_and_search([\"card\"], \"car\") == False" },
      { id: "t_absent", description: "an absent word returns False", assert: "assert build_and_search([\"cat\"], \"dog\") == False" },
    ],
    hidden_tests: [
      { id: "h_both", description: "both a word and its prefix stored", assert: "assert build_and_search([\"apple\",\"app\"], \"app\") == True" },
      { id: "h_empty", description: "empty dictionary finds nothing", assert: "assert build_and_search([], \"x\") == False" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "tp1-so-1",
        type: "select_one",
        prompt: "What two things does a single trie node store?",
        concept: "trie",
        difficulty: "easy",
        choices: [
          "A map from character to child node, and an end-of-word flag",
          "A full copy of every word passing through it",
          "A sorted list of all descendant words",
          "A parent pointer and a subtree size",
        ],
        correct_index: 0,
        explanation: "A node is just a child-per-character map plus a boolean marking that a word ends there.",
      },
      {
        id: "tp1-sa-multi",
        type: "select_all",
        prompt: "Which statements about a trie are true?",
        concept: "trie",
        difficulty: "medium",
        choices: [
          "Words that share a prefix share the same path until they diverge",
          "search, insert, and startsWith are each O(length of the string)",
          "The time cost grows with the number of words stored",
          "search must check the end-of-word flag, but startsWith does not",
        ],
        correct_indices: [0, 1, 3],
        explanation: "Cost is O(length), independent of how many words are stored; the flag distinguishes search from startsWith.",
      },
      {
        id: "tp1-sa-none",
        type: "select_all",
        prompt: "If ONLY \"card\" has been inserted, which of these return true? (If none, select none.)",
        concept: "trie",
        difficulty: "hard",
        choices: [
          "search(\"car\")",
          "search(\"ca\")",
          "search(\"cardable\")",
        ],
        correct_indices: [],
        explanation: "None — car and ca are unflagged prefixes, and cardable walks off the end of the stored path.",
      },
      {
        id: "tp1-order",
        type: "ordering",
        prompt: "Order the steps of inserting a word into a trie.",
        concept: "trie",
        difficulty: "medium",
        items: [
          "Start at the root (the empty prefix)",
          "For each character, follow its child, creating an empty node if missing",
          "Step into that child and continue",
          "After the last character, set the end-of-word flag on the final node",
        ],
        correct_order: [
          "Start at the root (the empty prefix)",
          "For each character, follow its child, creating an empty node if missing",
          "Step into that child and continue",
          "After the last character, set the end-of-word flag on the final node",
        ],
      },
      {
        id: "tp1-pattern",
        type: "pattern_recognition",
        prompt: "\"Given a fixed dictionary of words and many queries, each asking whether a string is a stored word or whether any word starts with a given prefix.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Trie / Prefix Tree", "Hashing", "Two Pointer", "Binary Search", "Sliding Window"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Prefix queries against a fixed dictionary are the trie fingerprint; a hash set is a reasonable secondary for the exact-membership half but cannot do prefixes.",
      },
      {
        id: "tp1-written",
        type: "written",
        prompt: "Explain why a trie needs an explicit end-of-word flag, using an example where a stored word is a prefix of another stored word.",
        concept: "trie",
        difficulty: "hard",
        actual_answer:
          "Walking a path in a trie only proves that those characters exist as a prefix of some stored word; it does not prove that the prefix is itself a word. Suppose you insert both \"app\" and \"apple\". The path a-p-p exists because it is on the way to \"apple\", but \"app\" is also a real stored word, and the only way to record that fact is a boolean flag on the second p node. Without the flag, search would either report every prefix as a word — wrongly matching \"ap\" — or have no way to tell that \"app\" is stored while \"ap\" is not. The end-of-word flag is exactly the bit that separates \"a word ends here\" from \"this node is only passed through.\"",
        rubric:
          "Full credit: a path existing only proves a prefix exists, not a word; the flag records which nodes are real word-ends; concrete example where one word is a prefix of another (app/apple) and both facts must be distinguishable. Partial: states the flag's purpose without the prefix-of-another example. Low: vague.",
      },
    ],
  },
};

// ── Part 2: prefix autocomplete ───────────────────────────────────────────────
const part2 = {
  part_id: "trie-part-2-autocomplete",
  reading: {
    blocks: [
      { type: "heading", text: "Autocomplete: reach the prefix once, then let the subtree hand you the words" },
      {
        type: "paragraph",
        text:
          "Autocomplete asks: given a prefix, return every stored word that begins with it. It runs in two phases. Phase one is startsWith — walk the prefix character by character from the root; if any character has no child, there are no completions, so return empty. If you consume the whole prefix, you are standing on the node for that prefix, and every word in its subtree is a completion. Phase two is a depth-first walk of that subtree that builds the string as it descends: at each node, if the end-of-word flag is set, record the accumulated string; then for each child edge, append that character and recurse. The trie has already grouped every completion under one node, so you never even look at a word that fails to start with the prefix.",
      },
      {
        type: "definition",
        term: "Prefix subtree",
        definition:
          "The subtree rooted at the node you reach by walking a prefix from the trie root. Every word that begins with that prefix lives in this subtree, and no word outside it does — so collecting completions means a single DFS of exactly this subtree.",
      },
      {
        type: "example",
        body:
          "Dictionary {car, card, cart, cat, cap, dog}, prefix \"car\". Phase one walks c-a-r and lands on the car node in three steps, skipping dog entirely. Phase two DFS: the car node is flagged, so record \"car\"; its child d leads to a flagged card node, record \"card\"; its child t leads to a flagged cart node, record \"cart\". The words cat and cap live under \"ca\", not under \"car\", so they are never visited. Result: car, card, cart.",
      },
      {
        type: "callout",
        text:
          "The classic bug is emitting every node you visit instead of only flagged ones. In the example the c-a node is passed through but is not a word; recording it would invent \"ca\", which nobody stored. Record a word only when the end-of-word flag is set.",
      },
    ],
  },
  audio: {
    script: PART2_SCRIPT,
    transcript: PART2_SCRIPT,
    duration_hint: 165,
    synced_visual: {
      strategy: "timeline" as const,
      artifact_slug: A_PREFIX,
      scene: {
        scene_id: "trie-prefix-scene",
        title: "Walk the prefix, then DFS its subtree",
        motif: "reach-the-prefix-then-collect",
        description: "Autocomplete for prefix car over {car, card, cart, cat, cap, dog}: phase one walks the prefix to its node, phase two DFS-collects every end-of-word node beneath it, ignoring words that do not start with the prefix.",
        panels: [
          {
            id: "phase1",
            title: "Phase 1: reach the prefix",
            kind: "vector" as const,
            description: "Walk the prefix from the root to the node that anchors all completions.",
            data: [
              { label: "walk the prefix", value: "O(length of prefix)", role: "input" as const },
              { label: "prefix node", value: "anchors every completion", role: "process" as const },
            ],
          },
          {
            id: "phase2",
            title: "Phase 2: DFS collect",
            kind: "ledger" as const,
            description: "Depth-first walk of the subtree, recording flagged nodes.",
            data: [
              { label: "at a flagged node", value: "record accumulated word", role: "process" as const },
              { label: "for each child", value: "append char, recurse", role: "input" as const },
              { label: "result", value: "all completions", role: "output" as const },
            ],
          },
        ],
      },
      cues: [
        { start: 0, end: 30, label: "The ask", headline: "All words starting with a prefix", narration: "Autocomplete returns every stored word that begins with the given prefix.", receive: "a prefix", transform: "define the completion set", pass: "a target to collect" },
        { start: 30, end: 62, label: "Phase 1: walk", headline: "Reach the prefix node", narration: "Walk the prefix from the root; if a character is missing, there are no completions, return empty.", receive: "the prefix car", transform: "walk c-a-r", pass: "the prefix node" },
        { start: 62, end: 95, label: "Anchor", headline: "Everything below is a completion", narration: "Standing on the prefix node, every word in its subtree begins with the prefix, and nothing outside does.", receive: "the prefix node", transform: "scope to the subtree", pass: "the completion set" },
        { start: 95, end: 128, label: "Phase 2: DFS", headline: "Record flagged nodes", narration: "Depth-first through the subtree; at each end-of-word node record the accumulated string.", receive: "the subtree", transform: "DFS building the string", pass: "car, card, cart" },
        { start: 128, end: 150, label: "Skip the rest", headline: "cat and cap never visited", narration: "Words under ca but not under car are never looked at — the walk to the prefix skipped them.", receive: "the full dictionary", transform: "prune non-matches", pass: "only real completions" },
        { start: 150, end: 165, label: "The bug", headline: "Emit only flagged nodes", narration: "Recording every visited node would invent the prefix ca as a word; record only end-of-word nodes.", receive: "a tempting shortcut", transform: "check the flag", pass: "a correct word list" },
      ],
    },
  },
  interactive: {
    schema_version: "1.0",
    widget_type: "bespoke-artifact",
    instructions: "Use Prev/Next or the slider to run autocomplete for the prefix \"car\". Phase one walks c-a-r to the prefix node; phase two depth-first walks its subtree, recording car, card, and cart as it lands on each end-of-word node, while cat and cap — which live under \"ca\" but not \"car\" — are never visited.",
    params: { artifact_slug: A_PREFIX, min_height: 340 },
  },
  code: {
    prompt:
      "Return every stored word that begins with a given prefix, in sorted order. First walk the prefix to its node (or bail out if the prefix is absent), then depth-first collect every end-of-word node beneath it, building the string as you descend. Fill in the two TODO helpers, then compose them.",
    starter_code:
      "END = \"#\"\n\n\ndef insert(root, word):\n    node = root\n    for ch in word:\n        node = node.setdefault(ch, {})\n    node[END] = True\n    return root\n\n\ndef prefix_node(root, prefix):\n    # TODO: walk prefix char by char from root. If any character is missing,\n    # return None. Otherwise return the node you land on.\n    pass\n\n\ndef collect(node, prefix):\n    # TODO: DFS from node. If END is set on node, append prefix to the result.\n    # Then for each child character (sorted), recurse with prefix + char.\n    # Return the list of words.\n    pass\n\n\ndef autocomplete(words, prefix):\n    root = {}\n    for w in words:\n        insert(root, w)\n    node = prefix_node(root, prefix)\n    if node is None:\n        return []\n    return collect(node, prefix)\n",
    constraints: [
      "END = \"#\" marks a complete word; a child key is any single character other than END.",
      "Return completions in sorted order (recurse over sorted child characters).",
      "A missing prefix returns an empty list; the prefix itself counts as a completion if it is a stored word.",
    ],
    walkthrough: {
      title: "Autocomplete = walk the prefix, then DFS its subtree",
      steps: [
        { title: "Walk to the prefix node", detail: "prefix_node steps through the prefix; a missing character means no word has that prefix, so it returns None.", input: "root, prefix", output: "the prefix node or None" },
        { title: "DFS collect flagged nodes", detail: "collect records the accumulated string whenever END is set, then recurses into each child (sorted) with the character appended.", input: "prefix node, prefix", output: "every completion in the subtree" },
        { title: "Compose", detail: "Build the trie, reach the prefix node, and if it exists collect its subtree; the walk already skipped every non-matching word.", input: "words, prefix", output: "sorted completions" },
      ],
    },
    io_examples: [
      { label: "typical", input: "words = [\"car\",\"card\",\"cart\",\"cat\",\"cap\",\"dog\"], prefix = \"car\"", expected_output: "[\"car\", \"card\", \"cart\"]", explanation: "Only the subtree under car is visited; cat and cap live under ca." },
      { label: "broader prefix", input: "prefix = \"ca\"", expected_output: "[\"cap\", \"car\", \"card\", \"cart\", \"cat\"]", explanation: "The ca subtree holds five words; dog is skipped at the first character." },
      { label: "absent prefix", input: "prefix = \"z\"", expected_output: "[]", explanation: "No child z at the root, so prefix_node returns None." },
    ],
    visualization: {
      title: "Walk prefix → DFS subtree → sorted words",
      description: "Reaching the prefix node skips every non-matching word in O(length of prefix).",
      items: [
        { label: "walk the prefix", value: "prefix_node or None", role: "input" },
        { label: "DFS, record flagged nodes", value: "prefix + char, recurse", role: "process" },
        { label: "completions in order", value: "[...]", role: "output" },
      ],
    },
    worked_examples: [
      {
        label: "basic",
        title: "Explicit helpers",
        code:
          "END = \"#\"\n\ndef insert(root, word):\n    node = root\n    for ch in word:\n        node = node.setdefault(ch, {})\n    node[END] = True\n    return root\n\ndef prefix_node(root, prefix):\n    node = root\n    for ch in prefix:\n        if ch not in node:\n            return None\n        node = node[ch]\n    return node\n\ndef collect(node, prefix):\n    words = []\n    if node.get(END):\n        words.append(prefix)\n    for ch in sorted(k for k in node if k != END):\n        words.extend(collect(node[ch], prefix + ch))\n    return words\n\ndef autocomplete(words, prefix):\n    root = {}\n    for w in words:\n        insert(root, w)\n    node = prefix_node(root, prefix)\n    if node is None:\n        return []\n    return collect(node, prefix)",
        explanation: "prefix_node handles the absent-prefix case; collect records only END nodes, so passing-through prefixes are never emitted.",
      },
      {
        label: "concise",
        title: "Iterative DFS with a stack",
        code:
          "END = \"#\"\n\ndef autocomplete(words, prefix):\n    root = {}\n    for w in words:\n        node = root\n        for ch in w:\n            node = node.setdefault(ch, {})\n        node[END] = True\n    node = root\n    for ch in prefix:\n        if ch not in node:\n            return []\n        node = node[ch]\n    out, stack = [], [(node, prefix)]\n    while stack:\n        n, pre = stack.pop()\n        if n.get(END):\n            out.append(pre)\n        for ch in n:\n            if ch != END:\n                stack.append((n[ch], pre + ch))\n    return sorted(out)",
        explanation: "An explicit stack replaces recursion; sorting at the end gives the same ordered result.",
      },
    ],
    hints: [
      { level: 1, text: "Two phases: walk the prefix to a node, then DFS that node's subtree collecting end-of-word nodes." },
      { level: 2, text: "prefix_node: if ch not in node return None; else node = node[ch]; return node at the end." },
      { level: 3, text: "collect: if node.get(END) append the accumulated prefix; then recurse into each child with prefix + ch." },
      { level: 4, text: "Iterate children as sorted(k for k in node if k != END) so the output is ordered and END is never treated as a character." },
      { level: 5, text: "The prefix itself is a completion when its node is flagged (e.g. \"car\" is in the results for prefix \"car\")." },
    ],
    tests: [
      { id: "t_typical", description: "completions of car", assert: "assert autocomplete([\"car\",\"card\",\"cart\",\"cat\",\"cap\",\"dog\"], \"car\") == [\"car\", \"card\", \"cart\"]" },
      { id: "t_broad", description: "completions of ca", assert: "assert autocomplete([\"car\",\"card\",\"cart\",\"cat\",\"cap\",\"dog\"], \"ca\") == [\"cap\", \"car\", \"card\", \"cart\", \"cat\"]" },
      { id: "t_absent", description: "absent prefix returns empty", assert: "assert autocomplete([\"dog\"], \"cat\") == []" },
    ],
    hidden_tests: [
      { id: "h_word_is_prefix", description: "a stored word that is also a prefix is included", assert: "assert autocomplete([\"apple\",\"app\",\"apricot\"], \"ap\") == [\"app\", \"apple\", \"apricot\"]" },
      { id: "h_nested", description: "nested words all collected", assert: "assert autocomplete([\"a\",\"ab\",\"abc\"], \"a\") == [\"a\", \"ab\", \"abc\"]" },
    ],
  },
  practice: {
    written_feedback: "llm_judge" as const,
    pass_threshold: 5,
    questions: [
      {
        id: "tp2-so-1",
        type: "select_one",
        prompt: "In autocomplete, what do you do the instant you finish walking the prefix successfully?",
        concept: "trie",
        difficulty: "easy",
        choices: [
          "DFS the subtree rooted at the prefix node, recording end-of-word nodes",
          "Return the prefix as the only completion",
          "Re-scan the whole dictionary for matches",
          "Sort every stored word and binary search",
        ],
        correct_index: 0,
        explanation: "The prefix node anchors every completion; a DFS of its subtree collects them.",
      },
      {
        id: "tp2-sa-multi",
        type: "select_all",
        prompt: "Which statements about trie autocomplete are true?",
        concept: "trie",
        difficulty: "hard",
        choices: [
          "Reaching the prefix node costs O(length of the prefix)",
          "Only words in the prefix node's subtree are ever visited",
          "You must record every node you pass through, flagged or not",
          "The prefix itself is a completion when its node is end-of-word",
        ],
        correct_indices: [0, 1, 3],
        explanation: "Record only flagged nodes; emitting passing-through nodes would invent unstored words.",
      },
      {
        id: "tp2-sa-none",
        type: "select_all",
        prompt: "For prefix \"car\" over {car, card, cart, cat, cap, dog}, which of these words does the DFS VISIT? (If none, select none.)",
        concept: "trie",
        difficulty: "medium",
        choices: ["cat", "cap", "dog"],
        correct_indices: [],
        explanation: "None — cat and cap live under \"ca\" but not \"car\", and dog fails at the first character, so the car-subtree DFS never touches them.",
      },
      {
        id: "tp2-order",
        type: "ordering",
        prompt: "Order the steps of autocomplete for a prefix.",
        concept: "trie",
        difficulty: "medium",
        items: [
          "Walk the prefix character by character from the root",
          "If a character is missing, return no completions",
          "Stand on the prefix node; its subtree holds every completion",
          "DFS the subtree, recording each end-of-word node's string",
        ],
        correct_order: [
          "Walk the prefix character by character from the root",
          "If a character is missing, return no completions",
          "Stand on the prefix node; its subtree holds every completion",
          "DFS the subtree, recording each end-of-word node's string",
        ],
      },
      {
        id: "tp2-pattern",
        type: "pattern_recognition",
        prompt: "\"Design a search-suggestions system: as the user types each character, show up to three stored products that start with what they have typed so far.\" Which pattern(s) apply?",
        concept: "pattern-recognition",
        difficulty: "medium",
        choices: ["Trie / Prefix Tree", "Heap / Priority Queue", "Binary Search", "Two Pointer", "Sliding Window"],
        primary_indices: [0],
        secondary_indices: [1],
        explanation: "Type-ahead over a fixed product list is the trie fingerprint; a heap is a reasonable secondary to keep the top three suggestions by rank.",
      },
      {
        id: "tp2-written",
        type: "written",
        prompt: "Explain why trie autocomplete never looks at words that do not start with the prefix, and why that makes it faster than filtering a flat list.",
        concept: "trie",
        difficulty: "hard",
        actual_answer:
          "Walking the prefix from the root lands you on exactly one node, and by construction every word that begins with that prefix lives in that node's subtree while every word that does not begin with it lives elsewhere in the tree. So once you reach the prefix node you only DFS its subtree — you have already excluded every non-matching word in O(length of the prefix), without inspecting any of them. Filtering a flat list, by contrast, must test all N stored words against the prefix, which is O(N times prefix length). The trie converts \"check every word\" into \"walk to one node and enumerate its subtree,\" so the cost scales with the number of matches plus the prefix length, not with the size of the whole dictionary.",
        rubric:
          "Full credit: the prefix node's subtree contains exactly the matching words; reaching it excludes non-matches in O(prefix length) without inspecting them; a flat filter is O(N·len). Partial: says the subtree holds matches but misses the cost comparison. Low: vague.",
      },
    ],
  },
};

// ── Final integrator practice_code: the full Trie class (LeetCode 208) ────────
const finalCode = {
  prompt:
    "Integrator: implement the classic Trie class with insert, search, and startsWith. Represent each node as a dict of char → child, with the sentinel key \"#\" marking end-of-word. All three methods share one skeleton — walk the string from self.root — differing only in whether they create nodes and whether they check the flag. Fill in the three TODO methods.",
  starter_code:
    "class Trie:\n    END = \"#\"\n\n    def __init__(self):\n        self.root = {}\n\n    def insert(self, word):\n        # TODO: walk word from self.root, creating missing children with\n        # setdefault, then set self.END on the final node.\n        pass\n\n    def search(self, word):\n        # TODO: walk word; if any character is missing return False. Return True\n        # only if self.END is set on the node you finish on.\n        pass\n\n    def startsWith(self, prefix):\n        # TODO: walk prefix; if any character is missing return False. Return\n        # True if you consume the whole prefix (do NOT check the flag).\n        pass\n\n\ndef run_trie_ops(ops, args):\n    # Driver used by the tests: replays a sequence of operations and collects\n    # each return value (None for constructor/insert).\n    out = []\n    t = None\n    for op, a in zip(ops, args):\n        if op == \"Trie\":\n            t = Trie(); out.append(None)\n        elif op == \"insert\":\n            t.insert(a[0]); out.append(None)\n        elif op == \"search\":\n            out.append(t.search(a[0]))\n        elif op == \"startsWith\":\n            out.append(t.startsWith(a[0]))\n    return out\n",
  constraints: [
    "Words and prefixes are lowercase letters; a node is a dict keyed by single characters plus END = \"#\".",
    "search checks the end-of-word flag; startsWith does not.",
    "Each operation is O(length of the string) — do not scan stored words.",
  ],
  walkthrough: {
    title: "One skeleton, three methods",
    steps: [
      { title: "insert creates and flags", detail: "Walk the word with setdefault so missing children appear, then set self.END on the final node to mark a complete word.", input: "a word", output: "the word stored" },
      { title: "search walks and checks the flag", detail: "Walk the word; a missing character returns False, and consuming the word is a match only if self.END is set.", input: "a word", output: "True only for a stored word" },
      { title: "startsWith walks and ignores the flag", detail: "Walk the prefix; a missing character returns False, and consuming the prefix returns True regardless of the flag.", input: "a prefix", output: "True if any word has the prefix" },
    ],
  },
  io_examples: [
    { label: "LeetCode 208", input: "insert(\"apple\"); search(\"apple\"); search(\"app\"); startsWith(\"app\"); insert(\"app\"); search(\"app\")", expected_output: "True, False, True, then True", explanation: "search(\"app\") is False until \"app\" is inserted; startsWith(\"app\") is True as soon as \"apple\" exists." },
    { label: "prefix vs word", input: "insert(\"card\"); startsWith(\"car\"); search(\"car\")", expected_output: "True, then False", explanation: "car is a live prefix of card but was never stored as a word." },
    { label: "empty trie", input: "search(\"x\"); startsWith(\"x\")", expected_output: "False, False", explanation: "Nothing inserted, so both fail at the first character." },
  ],
  visualization: {
    title: "insert / search / startsWith share one walk",
    description: "The only differences are creating nodes and checking the flag.",
    items: [
      { label: "insert: create missing, flag end", value: "setdefault + END", role: "input" },
      { label: "search: consume all AND flag set", value: "node.get(END)", role: "process" },
      { label: "startsWith: consume all, ignore flag", value: "reached the end", role: "output" },
    ],
  },
  worked_examples: [
    {
      label: "basic",
      title: "The three methods",
      code:
        "class Trie:\n    END = \"#\"\n\n    def __init__(self):\n        self.root = {}\n\n    def insert(self, word):\n        node = self.root\n        for ch in word:\n            node = node.setdefault(ch, {})\n        node[self.END] = True\n\n    def search(self, word):\n        node = self.root\n        for ch in word:\n            if ch not in node:\n                return False\n            node = node[ch]\n        return node.get(self.END, False)\n\n    def startsWith(self, prefix):\n        node = self.root\n        for ch in prefix:\n            if ch not in node:\n                return False\n            node = node[ch]\n        return True",
      explanation: "search returns node.get(END, False); startsWith returns True once the prefix is consumed — the one-line difference is the whole distinction.",
    },
    {
      label: "concise",
      title: "Shared private walk",
      code:
        "class Trie:\n    END = \"#\"\n\n    def __init__(self):\n        self.root = {}\n\n    def _walk(self, s):\n        node = self.root\n        for ch in s:\n            if ch not in node:\n                return None\n            node = node[ch]\n        return node\n\n    def insert(self, word):\n        node = self.root\n        for ch in word:\n            node = node.setdefault(ch, {})\n        node[self.END] = True\n\n    def search(self, word):\n        node = self._walk(word)\n        return node is not None and node.get(self.END, False)\n\n    def startsWith(self, prefix):\n        return self._walk(prefix) is not None",
      explanation: "Factoring the walk into _walk makes the difference explicit: search also checks END, startsWith just checks the node exists.",
    },
  ],
  hints: [
    { level: 1, text: "All three methods start node = self.root and step ch by ch; only insert creates children, and only search checks the flag." },
    { level: 2, text: "insert: node = node.setdefault(ch, {}); after the loop node[self.END] = True." },
    { level: 3, text: "search / startsWith: if ch not in node return False; else node = node[ch]." },
    { level: 4, text: "search ends with return node.get(self.END, False); startsWith ends with return True." },
    { level: 5, text: "That final line — flag check versus plain True — is the only thing separating the two lookups." },
  ],
  tests: [
    { id: "f_leet208", description: "classic LeetCode 208 sequence", assert: "assert run_trie_ops([\"Trie\",\"insert\",\"search\",\"search\",\"startsWith\",\"insert\",\"search\"], [[],[\"apple\"],[\"apple\"],[\"app\"],[\"app\"],[\"app\"],[\"app\"]]) == [None,None,True,False,True,None,True]" },
    { id: "f_prefix_vs_word", description: "prefix true but word false", assert: "assert run_trie_ops([\"Trie\",\"insert\",\"startsWith\",\"search\"], [[],[\"card\"],[\"car\"],[\"car\"]]) == [None,None,True,False]" },
    { id: "f_empty", description: "empty trie fails both", assert: "assert run_trie_ops([\"Trie\",\"search\",\"startsWith\"], [[],[\"x\"],[\"x\"]]) == [None,False,False]" },
  ],
  hidden_tests: [
    { id: "hf_repeat_insert", description: "re-inserting is idempotent", assert: "assert run_trie_ops([\"Trie\",\"insert\",\"insert\",\"search\"], [[],[\"a\"],[\"a\"],[\"a\"]]) == [None,None,None,True]" },
    { id: "hf_longer_query", description: "query longer than any word fails", assert: "assert run_trie_ops([\"Trie\",\"insert\",\"search\"], [[],[\"ab\"],[\"abc\"]]) == [None,None,False]" },
  ],
};

// ── Timed code drill: count words with a prefix ───────────────────────────────
const codeDrill = {
  pattern: "trie",
  prompt:
    "One rep, timed: return how many words in `words` start with `prefix`, using a trie. Build the trie (a node is a dict of char → child, with END = \"#\" flagging a complete word), walk the prefix, then count end-of-word nodes in that subtree. Return 0 if the prefix is absent.",
  target_seconds: 420,
  difficulty: "medium",
  language: "python",
  starter_code:
    "END = \"#\"\n\n\ndef count_with_prefix(words, prefix):\n    # Build a trie, walk the prefix, then count end-of-word nodes beneath it.\n    root = {}\n    for w in words:\n        node = root\n        for ch in w:\n            node = node.setdefault(ch, {})\n        node[END] = True\n    # walk the prefix\n    node = root\n    for ch in prefix:\n        if ch not in node:\n            return 0\n        node = node[ch]\n    # count end-of-word nodes in the subtree\n    def count(n):\n        # TODO: 1 if this node is a word-end, plus the counts of all children.\n        pass\n    return count(node)\n",
  tests: [
    { id: "d_car", description: "three words start with car", assert: "assert count_with_prefix([\"car\",\"card\",\"cart\",\"cat\",\"dog\"], \"car\") == 3" },
    { id: "d_ca", description: "four words start with ca", assert: "assert count_with_prefix([\"car\",\"card\",\"cart\",\"cat\",\"dog\"], \"ca\") == 4" },
    { id: "d_do", description: "one word starts with do", assert: "assert count_with_prefix([\"car\",\"card\",\"cart\",\"cat\",\"dog\"], \"do\") == 1" },
    { id: "d_absent", description: "absent prefix counts zero", assert: "assert count_with_prefix([\"car\",\"cat\"], \"xyz\") == 0" },
    { id: "d_nested", description: "a word that is also a prefix counts", assert: "assert count_with_prefix([\"apple\",\"app\",\"apply\"], \"app\") == 3" },
  ],
  hints: [
    { unlock_at_pct: 33, text: "Build the trie first (setdefault per character, flag END on the last node), then walk the prefix; a missing character means the answer is 0." },
    { unlock_at_pct: 66, text: "count(n) returns 1 if n has the END flag, else 0, plus the sum of count over every child (skip the END key)." },
    { unlock_at_pct: 100, text: "def count(n): return (1 if n.get(END) else 0) + sum(count(n[k]) for k in n if k != END)" },
  ],
  solution:
    "END = \"#\"\n\n\ndef count_with_prefix(words, prefix):\n    root = {}\n    for w in words:\n        node = root\n        for ch in w:\n            node = node.setdefault(ch, {})\n        node[END] = True\n    node = root\n    for ch in prefix:\n        if ch not in node:\n            return 0\n        node = node[ch]\n    def count(n):\n        return (1 if n.get(END) else 0) + sum(count(n[k]) for k in n if k != END)\n    return count(node)\n",
};

// ── Assessment (adaptive MC + freeform) ───────────────────────────────────────
const assessment = {
  questions: [
    {
      id: "a-free-1",
      text: "Describe a trie node and the three core operations (insert, search, startsWith), and explain why each is O(length of the string) rather than depending on how many words are stored.",
      type: "free_text",
      concept: "trie",
      difficulty: "medium",
      actual_answer:
        "A trie node holds a map from a single character to a child node and a boolean end-of-word flag. Insert walks the string from the root, creating a child for any missing character and setting the flag on the final node. Search walks the string and returns true only if it consumes every character AND the flag is set on the last node. startsWith walks the string and returns true if it consumes every character, ignoring the flag. Each operation takes one step per character and does a single constant-time child lookup at each step, so the cost is proportional to the length of the query string. It does not depend on the number of stored words because the walk only ever touches the one path for that string, no matter how large the dictionary is.",
      rubric:
        "Full credit: node = child map + end-of-word flag; insert creates + flags, search consumes + checks flag, startsWith consumes + ignores flag; O(length) because one lookup per character and the walk touches only the query's path, independent of word count. Partial: operations right but misses the why-O(length) reason. Low: vague.",
      support_ref: "trie-part-1-structure",
    },
    {
      id: "a-free-2",
      text: "A candidate must return all dictionary words that start with a typed prefix and says 'I'll loop over every word and keep the ones that start with the prefix.' What is a better trie-based approach, and why is it faster?",
      type: "free_text",
      concept: "pattern-recognition",
      difficulty: "hard",
      actual_answer:
        "Build a trie of the dictionary once, then for each query walk the prefix from the root to a single node in O(length of the prefix); if a character is missing there are no completions. Every word beginning with the prefix lives in that node's subtree and nothing else does, so a depth-first walk of just that subtree, recording each end-of-word node, yields all completions. This is faster than the flat loop because reaching the prefix node already excludes every non-matching word without inspecting it: the flat loop is O(N times prefix length) over all N words, while the trie is O(prefix length) to locate plus the number of actual matches to enumerate. When the dictionary is large and queries are frequent, that is a major win, and the trie is built only once.",
      rubric:
        "Full credit: build trie once, walk prefix to a node in O(len), DFS its subtree for completions; faster because non-matches are excluded without inspection (O(prefix+matches) vs O(N·len)). Partial: names the trie approach without the cost comparison. Low: vague.",
      support_ref: "trie-part-2-autocomplete",
    },
    {
      id: "a-free-3",
      text: "When is a trie the WRONG tool, and what is the main cost you pay for its fast prefix operations? Name at least one concrete situation where a simpler structure is better.",
      type: "free_text",
      concept: "trie",
      difficulty: "medium",
      actual_answer:
        "A trie is the wrong tool when the problem only ever asks whether an exact word is present, with no prefix reasoning at all — a hash set answers that more simply, faster in practice, and with less memory, so building a trie just because you are storing strings is overkill. The main cost you pay is memory: in the worst case, when words share few common prefixes, a trie allocates a separate node for nearly every character of every word, each carrying the overhead of a children map, so it trades space for fast prefix walks. A large alphabet like Unicode makes each node heavier still. When words share little structure or you only need exact membership, a hash set or a compressed trie (radix tree) is the better choice.",
      rubric:
        "Full credit: wrong for exact-only membership (hash set simpler/faster/lighter); main cost is memory (a node per character in the worst case, heavier for large alphabets); concrete simpler alternative named. Partial: memory OR the exact-membership point but not both. Low: vague.",
      support_ref: "overview: when it fails",
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
        question: "What is the time complexity of searching a trie for a word of length L, with N words stored?",
        choices: ["O(L)", "O(N)", "O(N·L)", "O(log N)"],
        correct_index: 0,
        explanation: "Search walks one character path of length L with a constant-time lookup per step, independent of N.",
        concept: "complexity",
        difficulty: "easy",
        learning_scope: "taught",
        support_ref: "trie-part-1-structure",
      },
      {
        id: "q2",
        question: "Only \"card\" has been inserted. What does search(\"car\") return, and why?",
        choices: [
          "False — the c-a-r node exists but its end-of-word flag is not set",
          "True — the characters c, a, r are all present",
          "True — any prefix of a stored word counts as stored",
          "Error — the word is too short",
        ],
        correct_index: 0,
        explanation: "The path exists on the way to card, but car was never flagged as a complete word.",
        concept: "trie",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "trie-part-1-structure",
      },
      {
        id: "q3",
        question: "How does startsWith differ from search in a trie?",
        choices: [
          "startsWith returns true once the string is consumed; search also requires the end-of-word flag",
          "startsWith is O(N) while search is O(L)",
          "startsWith creates missing nodes; search does not",
          "There is no difference",
        ],
        correct_index: 0,
        explanation: "Both walk the string; only search checks the end-of-word flag at the end.",
        concept: "trie",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "trie-part-1-structure",
      },
      {
        id: "q4",
        question: "For autocomplete, once you have walked the prefix to its node, how do you collect the completions?",
        choices: [
          "DFS the node's subtree, recording each end-of-word node's string",
          "Return the prefix as the only answer",
          "Binary search a sorted array of all words",
          "Re-scan the whole dictionary",
        ],
        correct_index: 0,
        explanation: "Every completion lives in the prefix node's subtree; a DFS of it collects the flagged nodes.",
        concept: "trie",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "trie-part-2-autocomplete",
      },
      {
        id: "q5",
        question: "Which problem is NOT a natural trie fit?",
        choices: [
          "Return whether an exact string is present, with no prefix queries at all",
          "Return all words starting with a given prefix",
          "Autocomplete / type-ahead suggestions",
          "Prune dead letter paths in a grid word-search",
        ],
        correct_index: 0,
        explanation: "Exact membership with no prefix reasoning is a plain hash set job; a trie is overkill.",
        concept: "pattern-recognition",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "overview: when it fails",
      },
      {
        id: "q6",
        question: "What is the primary cost a trie pays for its fast prefix operations?",
        choices: [
          "Memory — potentially a node per character of every word, plus each node's child map",
          "Time — every query is O(N log N)",
          "It cannot store more than 26 words",
          "It must re-sort after each insert",
        ],
        correct_index: 0,
        explanation: "A trie trades space for speed; sparse data with large alphabets makes the node overhead heavy.",
        concept: "trie",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "overview: when it fails",
      },
      {
        id: "q7",
        question: "Which phrases hint at a trie / prefix-tree solution? (Select all that apply.)",
        choices: [
          "\"words starting with a given prefix\"",
          "\"autocomplete suggestions\"",
          "\"return any element that appears twice\"",
          "None of the above",
        ],
        correct_indices: [0, 1],
        allow_multiple_correct: true,
        explanation: "Prefix queries and autocomplete are trie fingerprints; find-a-duplicate is not.",
        concept: "pattern-recognition",
        difficulty: "medium",
        learning_scope: "taught",
        support_ref: "overview: recognition",
      },
      {
        id: "q8",
        question: "A trie has long chains of single-child nodes (e.g. storing \"internationalization\"). What refinement removes that overhead?",
        choices: [
          "A radix tree / Patricia trie that merges single-child chains into one edge",
          "Converting the trie to a hash set",
          "Sorting the children at every node",
          "Adding parent pointers to every node",
        ],
        correct_index: 0,
        explanation: "A radix tree collapses non-branching chains into a single labeled edge, a large memory win for long non-branching data.",
        concept: "trie",
        difficulty: "hard",
        learning_scope: "taught",
        support_ref: "overview: radix tree",
      },
    ],
  },
};

// ── Next-lesson diagnostics (bespoke) ─────────────────────────────────────────
const diagnostics = [
  { id: "diag-trie-recognize", prompt: "Given a fresh problem, how quickly could you now tell it wants a trie, and which fingerprint (prefix query, autocomplete, many dictionary lookups, grid word-search) it is?", hint: "Name the prefix-or-dictionary signal you would look for." },
  { id: "diag-trie-flag", prompt: "Can you state, in one sentence each, why search checks the end-of-word flag and startsWith does not?", hint: "Think card stored, car not stored." },
  { id: "diag-trie-backtracking", prompt: "The next lesson is Backtracking. Where have you already seen a DFS that builds up a partial answer and unwinds — like the autocomplete subtree walk — and what would 'undo the last choice' add to it?", hint: "Autocomplete's DFS is a gentle preview of backtracking's explore-then-undo." },
  { id: "diag-trie-speed", prompt: "Could you write the full Trie class (insert/search/startsWith) and the autocomplete collector from memory in under 5 minutes each right now? What would slow you down?", hint: "Execution speed is the interview bottleneck." },
];

// ── Knowledge graph ───────────────────────────────────────────────────────────
const knowledgeGraph = {
  type: "focused",
  title: "Trie / Prefix Tree in the interview-pattern map",
  description:
    "This lesson covers the trie node (child map + end-of-word flag), insert/search/startsWith mechanics, prefix autocomplete via walk-then-DFS, and the full Trie class integrator. Backtracking is the next stage.",
  nodes: [
    { id: "subject-root", label: "Interview Patterns", category: "subject_root", covered: true },
    { id: "trie-node", label: "Trie node (map + flag)", category: "lesson_concept", covered: true },
    { id: "trie-walks", label: "insert / search / startsWith", category: "lesson_concept", covered: true },
    { id: "trie-autocomplete", label: "Prefix autocomplete (DFS)", category: "lesson_concept", covered: true },
    { id: "radix-tree", label: "Radix / Patricia trie", category: "lesson_concept", covered: true },
    { id: "heap", label: "Heap (prior)", category: "concept", covered: true },
    { id: "word-search", label: "Grid word-search pruning", category: "concept", preview: true },
    { id: "backtracking", label: "Backtracking (next)", category: "concept" },
  ],
  edges: [],
  curriculum_stages: [
    { id: "assessment", label: "Initial assessment", status: "done" },
    { id: "sliding-window", label: "Sliding Window", status: "done" },
    { id: "two-pointer", label: "Two Pointer", status: "done" },
    { id: "heap", label: "Heap / Priority Queue", status: "done" },
    { id: "trie", label: "Trie / Prefix Tree", status: "current" },
    { id: "backtracking", label: "Backtracking", status: "next" },
    { id: "monotonic-stack", label: "Monotonic Stack", status: "later" },
  ],
  current: "trie",
};

const planningRationale =
  "Trie is taught in full because the imported repo evidence flags it as near-untouched (~4 rows, two hard problems with no repeat practice), one of the weakest remaining tracked patterns after sliding window, two pointer, and heap. The lesson grounds the structure first (a node is a child-per-character map plus an end-of-word flag; the root is the empty prefix) so the abstraction is concrete, then teaches the three walks that share one skeleton (insert creates + flags, search consumes + checks the flag, startsWith consumes + ignores it), emphasizing the single most common bug — the end-of-word flag that separates 'card stored, car not stored'. Part two teaches the payoff operation, prefix autocomplete, as walk-the-prefix-then-DFS-the-subtree, which also previews the explore/unwind shape of the upcoming Backtracking lesson. The scaffolded exercises (build-and-search, autocomplete) plus the full Trie-class integrator and a timed count-words-with-prefix drill build execution speed, and pattern_recognition questions plus 'when it fails' cases (exact-only membership, memory cost, radix-tree refinement) build the recognition judgment that separates strong interviewees from grinders.";

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
  bad = fail("Part 1 (trie structure)", validateLessonPartContent(part1)) || bad;
  bad = fail("Part 2 (autocomplete)", validateLessonPartContent(part2)) || bad;
  bad = fail("Final integrator code", validatePracticeCodeContent(finalCode)) || bad;
  bad = fail("Code drill", validateCodeDrillContent(codeDrill)) || bad;
  bad = fail("Assessment", validateAssessmentContent(assessment)) || bad;
  bad = fail("Orientation visual", validateAudioSyncedVisualContent(orientationVisual, 1280)) || bad;
  bad = fail("Diagnostics", validateNextLessonDiagnostics(diagnostics)) || bad;
  if (bad) {
    console.error("\nAborting: fix validation errors before inserting.");
    process.exit(1);
  }

  const title = "Trie / Prefix Tree: Store Strings by Their Shared Beginnings";
  const description =
    "The tool for 'reason about prefixes, or run many dictionary queries cheaply.' A node is a child-per-character map plus an end-of-word flag; insert, search, and startsWith all walk the string in O(length), independent of how many words are stored. Covers the flag that separates 'card stored, car not stored', prefix autocomplete via walk-then-DFS, the full Trie class, and when a plain hash set beats a trie.";
  const goals = JSON.stringify([
    "Recognize trie problems (prefix queries, autocomplete, many dictionary lookups, grid word-search pruning) from trigger phrases in under 2 minutes",
    "Implement insert, search, startsWith, and prefix autocomplete from a scaffold, using the end-of-word flag correctly",
    "Explain why every operation is O(length) independent of word count, and when a hash set or radix tree beats a plain trie",
  ]);
  const tags = JSON.stringify(["trie", "prefix-tree", "autocomplete", "weak-pattern", "interview-prep"]);
  const overviewAudioContent = {
    script: OVERVIEW_SCRIPT,
    transcript: OVERVIEW_SCRIPT,
    duration_hint: 1280,
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
    insertAct.run(lessonId, "audio", 1, "Audio: Trie — the family map", JSON.stringify(overviewAudioContent));
    insertAct.run(lessonId, "lesson_part", 2, "Part 1: Trie structure + insert/search", JSON.stringify(part1));
    insertAct.run(lessonId, "lesson_part", 3, "Part 2: Prefix autocomplete", JSON.stringify(part2));
    insertAct.run(lessonId, "practice_code", 4, "Integrator: implement the Trie class", JSON.stringify(finalCode));
    insertAct.run(lessonId, "code_drill", 5, "Drill: count words with a prefix", JSON.stringify(codeDrill));
    insertAct.run(lessonId, "assessment", 6, "Assessment: Trie recognition + implementation", JSON.stringify(assessment));

    return lessonId;
  });

  const lessonId = tx();
  console.log(`\n✓ Inserted lesson ${lessonId} (seq ${SEQ}) for subject ${SUBJECT_ID} with 6 activities.`);
  closeDb();
}

main();
