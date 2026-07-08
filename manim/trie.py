"""
Reusable trie / prefix-tree visual idioms for Lesson 20
("Trie / Prefix Tree: Store Strings by Their Shared Beginnings", acts
116 / 117 / 118) and future string-tree lessons.

A trie is a *general (n-ary) tree whose EDGES are labeled with characters*, and
whose NODES carry a boolean "a real word ends here" flag. The whole pedagogy is
about the character-labeled path: shared prefixes are stored once (car, card,
cart share c-a-r and split only where they differ), and the end-of-word flag is
what separates "this path exists" from "this string is actually a word".

So the visual vocabulary here is:

  1. a tidy tree layout   — root at top, children fanned out below, x assigned by
     leaf order so subtrees never overlap and every parent centers over its kids;
  2. character-labeled edges — the label rides the middle of each parent→child
     line (this is the trie's defining feature, not the node value);
  3. an end-of-word ring   — a second concentric ring on a node marks isEnd=true
     (the flag search checks and startsWith ignores).

The idioms build a TrieModel from a word list (so the same code draws any word
set), lay it out, and return a TrieMobject VGroup whose cue scenes can:
  - highlight a walk down a path (insert / search / startsWith);
  - flip an end-of-word ring on;
  - dim everything outside a prefix subtree (autocomplete).

Everything honors theme.py (dark stage, site accent hues, safe-area guard) and
reuses bayes.fit_label / chip for text. MathTex is not needed — a trie is a
structural, not an algebraic, object; complexity chips use plain text.

Semantic colors (shared across all three parts so the eye learns them):
  node / edge at rest        → INK_SUBTLE   (neutral structure)
  the active walk / path      → ACCENT       (insert/search/startsWith cursor)
  a newly created node/edge   → EMERALD      (what insert added this step)
  end-of-word ring (isEnd)    → AMBER        (a real word ends here)
  the "false" / missing beat  → ROSE         (path exists but flag off, or char missing)
  prefix subtree (autocomplete)→ VIOLET      (everything under the prefix node)
"""

from __future__ import annotations

from manim import (
    VGroup,
    Circle,
    Line,
    Text,
    RIGHT,
    LEFT,
    UP,
    DOWN,
)

from theme import (
    ACCENT,
    AMBER,
    EMERALD,
    ROSE,
    VIOLET,
    INK,
    INK_MUTED,
    INK_SUBTLE,
    STAGE_W,
)
from bayes import fit_label, chip  # noqa: F401  (re-exported for cue scenes)

# Semantic role colors for the trie story (shared across all parts).
C_NODE = INK_SUBTLE
C_PATH = ACCENT
C_NEW = EMERALD
C_END = AMBER
C_MISS = ROSE
C_SUBTREE = VIOLET


# ─── the trie model: build node structure from a word list ───────────────────
class _Node:
    __slots__ = ("nid", "char", "children", "is_end", "depth", "path", "x")

    def __init__(self, nid, char, depth, path):
        self.nid = nid
        self.char = char          # edge label from parent ("" for the root)
        self.children = {}        # char -> _Node, insertion-ordered
        self.is_end = False
        self.depth = depth
        self.path = path          # the string spelled from root to here
        self.x = 0.0


class TrieModel:
    """
    Build a trie from `words` (insertion order preserved). Every node gets a
    stable integer id (assigned in build order), its edge char, depth, the full
    path string to it, and an is_end flag. `node_by_path[""]` is the root.
    """

    def __init__(self, words):
        self._next_id = 0
        self.root = _Node(self._new_id(), "", 0, "")
        self.node_by_path = {"": self.root}
        self.nodes = [self.root]
        self.order = list(words)
        for w in words:
            self._insert(w)
        self._layout()

    def _new_id(self):
        i = self._next_id
        self._next_id += 1
        return i

    def _insert(self, word):
        cur = self.root
        for ch in word:
            if ch not in cur.children:
                child = _Node(self._new_id(), ch, cur.depth + 1, cur.path + ch)
                cur.children[ch] = child
                self.node_by_path[child.path] = child
                self.nodes.append(child)
            cur = cur.children[ch]
        cur.is_end = True

    # tidy tree: leaves get sequential x slots, internals center over children.
    def _layout(self):
        self._leaf_counter = [0.0]

        def assign(node):
            kids = list(node.children.values())
            if not kids:
                node.x = self._leaf_counter[0]
                self._leaf_counter[0] += 1.0
                return
            for k in kids:
                assign(k)
            node.x = sum(k.x for k in kids) / len(kids)

        assign(self.root)

    def path_nodes(self, word):
        """The list of nodes root→word (root excluded), stopping at the deepest
        node that exists; if a char is missing, returns what exists plus a flag."""
        cur = self.root
        out = []
        for ch in word:
            if ch in cur.children:
                cur = cur.children[ch]
                out.append(cur)
            else:
                return out, ch  # missing char → (existing prefix nodes, the char that failed)
        return out, None

    def subtree_nodes(self, prefix):
        """Every node in the subtree rooted at `prefix` (prefix node included)."""
        start = self.node_by_path.get(prefix)
        if start is None:
            return []
        acc = []

        def walk(n):
            acc.append(n)
            for k in n.children.values():
                walk(k)

        walk(start)
        return acc

    def end_words(self):
        """(path) for every is_end node — the actual stored words."""
        return [n.path for n in self.nodes if n.is_end]


# ─── the drawn trie ──────────────────────────────────────────────────────────
class TrieMobject(VGroup):
    """
    A drawn trie. Exposes:
      .node[path]     → VGroup(circle, char_label) for the node spelled by `path`
      .ring[path]     → the end-of-word ring VGroup (hidden until shown)
      .edge[path]     → VGroup(line, char_label) for the edge INTO `path`
      .model          → the TrieModel
    Root is drawn as a small solid dot labeled nothing (the empty string).
    """

    def __init__(self, model: TrieModel, top=2.55, level_gap=1.28, x_gap=1.35,
                 r=0.40, fs=30, x_center=0.0):
        super().__init__()
        self.model = model
        self.node = {}
        self.ring = {}
        self.edge = {}

        # center the leaf-slot x-range around x_center
        xs = [n.x for n in model.nodes]
        span = (max(xs) - min(xs)) if len(xs) > 1 else 0.0
        mid = (max(xs) + min(xs)) / 2.0 if xs else 0.0

        def pos(n):
            return [x_center + (n.x - mid) * x_gap, top - n.depth * level_gap, 0]

        self._pos = {n.path: pos(n) for n in model.nodes}

        edges_grp = VGroup()
        # edges first (drawn under nodes)
        for n in model.nodes:
            if n.depth == 0:
                continue
            parent_path = n.path[:-1]
            a = self._pos[parent_path]
            b = self._pos[n.path]
            line = Line(a, b, stroke_color=C_NODE, stroke_width=2.4)
            # char label rides the middle of the edge, nudged perpendicular-ish
            lbl = Text(n.char, font_size=fs - 4, color=INK_MUTED, weight="BOLD")
            lbl.move_to(line.get_center())
            lbl.shift(_edge_label_offset(a, b))
            eg = VGroup(line, lbl)
            eg.line = line
            eg.char_label = lbl
            self.edge[n.path] = eg
            edges_grp.add(eg)
        self.add(edges_grp)

        nodes_grp = VGroup()
        for n in model.nodes:
            p = self._pos[n.path]
            if n.depth == 0:
                circ = Circle(radius=0.16, stroke_color=C_NODE, stroke_width=2.6,
                              fill_color=C_NODE, fill_opacity=0.5).move_to(p)
                lab = Text("", font_size=1, color=INK).move_to(p)
            else:
                circ = Circle(radius=r, stroke_color=C_NODE, stroke_width=2.6,
                              fill_color=C_NODE, fill_opacity=0.08).move_to(p)
                lab = fit_label(n.char, 2 * r - 0.16, fs, INK).move_to(p)
            node = VGroup(circ, lab)
            node.circle = circ
            node.char_label = lab
            self.node[n.path] = node
            nodes_grp.add(node)
            # pre-build the end ring (added on demand)
            ring = Circle(radius=r + 0.11, stroke_color=C_END, stroke_width=3.0).move_to(p)
            rg = VGroup(ring)
            self.ring[n.path] = rg
        self.add(nodes_grp)
        self._nodes_grp = nodes_grp
        self._edges_grp = edges_grp

    def pos(self, path):
        return self._pos[path]

    def recolor_node(self, path, color, fill=0.20, width=3.0):
        node = self.node[path]
        node.circle.set_stroke(color=color, width=width)
        node.circle.set_fill(color=color, opacity=fill)
        return node

    def recolor_edge(self, path, color, width=3.4):
        eg = self.edge.get(path)
        if eg is not None:
            eg.line.set_stroke(color=color, width=width)
            eg.char_label.set_color(color)
        return eg

    def path_mobjects(self, word):
        """Ordered [edge_into_c, node_c, edge_into_ca, node_ca, ...] for a walk."""
        seq = []
        cur = ""
        for ch in word:
            cur = cur + ch
            if cur in self.node:
                seq.append(("edge", cur))
                seq.append(("node", cur))
            else:
                break
        return seq


def _edge_label_offset(a, b):
    """Push the char label slightly off the edge midpoint toward the outside so
    it never sits directly on the line. For near-vertical edges nudge right; for
    slanted edges nudge along the outward normal."""
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    import math
    ln = math.hypot(dx, dy) or 1.0
    # normal (perpendicular), pointing to the side the child leans
    nx, ny = -dy / ln, dx / ln
    if dx >= 0:  # child to the right → nudge label up-right; else up-left
        nx = abs(nx)
    else:
        nx = -abs(nx)
    return [nx * 0.32 + (0.16 if abs(dx) < 0.05 else 0.0), abs(ny) * 0.0 + 0.02, 0]


# ─── small shared widgets ────────────────────────────────────────────────────
def end_flag_badge(color=C_END, fs=20):
    """A legend chip: an amber ring meaning 'a word ends here'."""
    ring = Circle(radius=0.18, stroke_color=color, stroke_width=3.0)
    inner = Circle(radius=0.11, stroke_color=INK_SUBTLE, stroke_width=2.0,
                   fill_color=INK_SUBTLE, fill_opacity=0.08)
    lab = Text("= word ends here", font_size=fs, color=INK_MUTED)
    grp = VGroup(VGroup(inner, ring), lab)
    lab.next_to(grp[0], RIGHT, buff=0.22)
    return grp


def op_row(name, does, color=ACCENT, name_fs=26, does_fs=22, w=11.0):
    """One operation description row: NAME — what it does. Returns VGroup."""
    n = Text(name, font_size=name_fs, color=color, weight="BOLD")
    d = fit_label(does, w - n.width - 0.5, does_fs, INK_MUTED)
    d.next_to(n, RIGHT, buff=0.4)
    return VGroup(n, d)


def word_chip(word, color=ACCENT, fs=30):
    """A monospaced-ish word chip for stored/queried strings."""
    return chip(word, color=color, w=max(1.6, 0.62 * len(word) + 0.9), h=0.9, fs=fs)
