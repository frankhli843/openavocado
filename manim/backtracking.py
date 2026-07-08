"""
Reusable backtracking / decision-tree visual idioms for Lesson 21
("Backtracking: Choose, Explore, Un-choose — Walk the Decision Tree", acts
122 / 123 / 124) and future recursion / DFS-enumeration lessons.

Backtracking is a *depth-first walk of a decision tree*: every branch is a
choice, every root-to-leaf path is one candidate answer, and the algorithm
carries a single shared `path` list that it pushes onto (choose), recurses on
(explore), then pops (un-choose). The pedagogy is entirely about that tree and
that shared list, so the visual vocabulary here is:

  1. a decision tree     — a hand-specified n-ary tree, tidy-laid-out (leaves get
     sequential x slots, every parent centers over its children), whose EDGES are
     labeled with the choice made ("+1") and whose NODES are labeled with the
     partial state (the subset / permutation built so far);
  2. a shared path list  — a horizontal row of choice cells with push / pop, the
     one mutable structure the recursion threads through the whole tree;
  3. a used-array        — a boolean flag per element (permutations): which
     elements are already placed, so the loop skips them;
  4. the three beats     — Choose / Explore / Un-choose chips, the template every
     backtracking function follows;
  5. a snapshot shelf    — where recorded *copies* of the path land, so the
     "save a copy, never the live list" bug is visible.

Everything honors theme.py (dark stage, site accent hues, safe-area guard) and
reuses bayes.fit_label / chip and arrays.code_line for text. A decision tree is a
structural object — MathTex is reserved for the complexity bounds only
(2^n subsets, n! permutations).

Semantic colors (shared across all three parts so the eye learns them):
  node / edge at rest        → INK_SUBTLE   (unexplored structure)
  the active path (choose)    → ACCENT       (the branch we are on now)
  a recorded answer (copy)    → EMERALD      (snapshot saved / a complete state)
  un-choose (pop / restore)   → AMBER        (backing up, freeing a choice)
  a pruned / doomed subtree   → ROSE         (rejected, deleted whole subtrees)
  used flag ON / permutations → VIOLET       (element already placed)
"""

from __future__ import annotations

import math

from manim import (
    VGroup,
    RoundedRectangle,
    Line,
    Text,
    MathTex,
    Cross,
    RIGHT,
    LEFT,
    UP,
    DOWN,
)

from theme import (
    ACCENT,
    ACCENT_LIGHT,
    AMBER,
    EMERALD,
    ROSE,
    VIOLET,
    INK,
    INK_MUTED,
    INK_SUBTLE,
)
from bayes import fit_label, chip  # noqa: F401  (re-exported for cue scenes)
from arrays import code_line  # noqa: F401  (re-exported for cue scenes)

# Semantic role colors for the backtracking story (shared across all parts).
C_REST = INK_SUBTLE
C_PATH = ACCENT
C_SAVE = EMERALD
C_POP = AMBER
C_PRUNE = ROSE
C_USED = VIOLET

EMPTY = "∅"  # ∅, the empty path / empty subset


# ─── the decision-tree model ─────────────────────────────────────────────────
class _TNode:
    __slots__ = ("nid", "label", "edge", "parent", "children", "depth", "x", "meta")

    def __init__(self, nid, label, edge, parent):
        self.nid = nid            # stable id
        self.label = label        # partial state shown in the node ("1 2")
        self.edge = edge          # choice label on the edge INTO this node ("+2")
        self.parent = parent      # parent id or None for the root
        self.children = []        # child nodes, insertion order
        self.depth = 0
        self.x = 0.0
        self.meta = {}            # free dict (e.g. mark leaves / snapshot nodes)


class TreeModel:
    """
    A decision tree built from an explicit spec so cue scenes control the shape
    exactly. `specs` is a list of tuples::

        (nid, parent_nid_or_None, node_label, edge_label)

    Parents must appear before their children. Nodes get depth + a tidy x (leaves
    sequential, internals centered over children) so subtrees never overlap.
    """

    def __init__(self, specs):
        self.nodes = {}
        self.order = []
        self.root = None
        for nid, parent, label, edge in specs:
            n = _TNode(nid, label, edge, parent)
            self.nodes[nid] = n
            self.order.append(nid)
        for nid in self.order:
            n = self.nodes[nid]
            if n.parent is None:
                self.root = n
            else:
                p = self.nodes[n.parent]
                p.children.append(n)
                n.depth = p.depth + 1
        self._layout()

    def _layout(self):
        counter = [0.0]

        def assign(n):
            if not n.children:
                n.x = counter[0]
                counter[0] += 1.0
                return
            for c in n.children:
                assign(c)
            n.x = sum(c.x for c in n.children) / len(n.children)

        assign(self.root)

    def subtree_ids(self, nid):
        acc = []

        def walk(n):
            acc.append(n.nid)
            for c in n.children:
                walk(c)

        walk(self.nodes[nid])
        return acc

    def path_ids(self, nid):
        """Root→nid inclusive (list of nids)."""
        seq = []
        n = self.nodes[nid]
        while n is not None:
            seq.append(n.nid)
            n = self.nodes[n.parent] if n.parent is not None else None
        return list(reversed(seq))

    def leaves(self):
        return [n.nid for n in self.nodes.values() if not n.children]


# convenience builders ────────────────────────────────────────────────────────
def subsets_model(elems=(1, 2, 3)):
    """
    The forward-only *subsets* decision tree of `elems` — the classic start-index
    tree where each node adds an element strictly greater than the last, so every
    subset appears exactly once. EVERY node (not just leaves) is a valid subset.
    Returns (TreeModel, node_ids_in_dfs_order).
    """
    specs = []
    counter = [0]
    order = []

    def new(parent, chosen, edge):
        nid = counter[0]
        counter[0] += 1
        label = EMPTY if not chosen else " ".join(str(c) for c in chosen)
        specs.append((nid, parent, label, edge))
        order.append(nid)
        return nid

    def build(parent, chosen, start):
        for i in range(start, len(elems)):
            nid = new(parent, chosen + [elems[i]], f"+{elems[i]}")
            build(nid, chosen + [elems[i]], i + 1)

    root = new(None, [], "")
    build(root, [], 0)
    return TreeModel(specs), order


def perm_model(elems=(1, 2, 3)):
    """
    The *permutations* decision tree of `elems` — order matters, every element
    used once, so a node may branch to any element not already on the path. Only
    the leaves (full length) are answers. Returns (TreeModel, leaf_ids).
    """
    specs = []
    counter = [0]

    def new(parent, chosen, edge):
        nid = counter[0]
        counter[0] += 1
        label = EMPTY if not chosen else " ".join(str(c) for c in chosen)
        specs.append((nid, parent, label, edge))
        return nid

    def build(parent, chosen):
        if len(chosen) == len(elems):
            return
        for e in elems:
            if e in chosen:
                continue
            nid = new(parent, chosen + [e], f"+{e}")
            build(nid, chosen + [e])

    root = new(None, [], "")
    build(root, [])
    model = TreeModel(specs)
    return model, model.leaves()


# ─── the drawn decision tree ─────────────────────────────────────────────────
class TreeMobject(VGroup):
    """
    A drawn decision tree. Exposes:
      .node[nid]  → VGroup(box, label) for the partial-state node
      .edge[nid]  → VGroup(line, choice_label) for the edge INTO `nid`
      .model      → the TreeModel

    Nodes are rounded rects auto-sized to their label; the root is a small pill
    showing ∅. Cue scenes recolor nodes/edges, highlight a root-to-leaf path,
    dim or cross whole subtrees, and drop snapshots on the shelf.
    """

    def __init__(self, model: TreeModel, top=2.45, level_gap=1.25, x_gap=1.55,
                 node_h=0.6, fs=24, x_center=0.0):
        super().__init__()
        self.model = model
        self.node = {}
        self.edge = {}
        self._node_h = node_h
        self._fs = fs

        xs = [n.x for n in model.nodes.values()]
        lo, hi = min(xs), max(xs)
        mid = (lo + hi) / 2.0

        def pos(n):
            return [x_center + (n.x - mid) * x_gap, top - n.depth * level_gap, 0]

        self._pos = {nid: pos(n) for nid, n in model.nodes.items()}

        # edges first (under nodes)
        edges_grp = VGroup()
        for nid, n in model.nodes.items():
            if n.parent is None:
                continue
            a = self._pos[n.parent]
            b = self._pos[nid]
            line = Line(a, b, stroke_color=C_REST, stroke_width=2.2)
            lbl = Text(n.edge, font_size=fs - 6, color=INK_MUTED, weight="BOLD")
            lbl.move_to(line.get_center()).shift(_edge_label_offset(a, b))
            eg = VGroup(line, lbl)
            eg.line = line
            eg.choice_label = lbl
            self.edge[nid] = eg
            edges_grp.add(eg)
        self.add(edges_grp)

        # nodes
        nodes_grp = VGroup()
        for nid, n in model.nodes.items():
            p = self._pos[nid]
            if n.parent is None:
                w = 0.62
            else:
                w = max(0.62, 0.30 * len(n.label) + 0.5)
            box = RoundedRectangle(
                width=w, height=node_h, corner_radius=0.13,
                stroke_color=C_REST, stroke_width=2.4,
                fill_color=C_REST, fill_opacity=0.08,
            ).move_to(p)
            lab = fit_label(n.label, w - 0.16, fs, INK).move_to(p)
            node = VGroup(box, lab)
            node.box = box
            node.label_text = lab
            self.node[nid] = node
            nodes_grp.add(node)
        self.add(nodes_grp)
        self._nodes_grp = nodes_grp
        self._edges_grp = edges_grp

    def pos(self, nid):
        return self._pos[nid]

    def recolor_node(self, nid, color, fill=0.20, width=3.0):
        node = self.node[nid]
        node.box.set_stroke(color=color, width=width)
        node.box.set_fill(color=color, opacity=fill)
        node.label_text.set_color(INK)
        return node

    def recolor_edge(self, nid, color, width=3.2):
        eg = self.edge.get(nid)
        if eg is not None:
            eg.line.set_stroke(color=color, width=width)
            eg.choice_label.set_color(color)
        return eg

    def fade_ids(self, nids, opacity=0.22):
        for nid in nids:
            self.node[nid].set_opacity(opacity)
            eg = self.edge.get(nid)
            if eg is not None:
                eg.set_opacity(opacity)
        return self

    def color_path(self, nid, color=C_PATH, fill=0.20, width=3.2):
        """Recolor root→nid path (nodes + edges into them)."""
        ids = self.model.path_ids(nid)
        for k in ids:
            self.recolor_node(k, color, fill=fill, width=width)
            if self.model.nodes[k].parent is not None:
                self.recolor_edge(k, color, width=width)
        return ids

    def subtree_group(self, nid, include_edge_in=True):
        """A fresh VGroup of the node+edge mobjects under `nid` (for cross / fade).
        Uses the live mobjects, so animate a Cross OVER this rather than reparenting."""
        grp = VGroup()
        for k in self.model.subtree_ids(nid):
            grp.add(self.node[k])
            eg = self.edge.get(k)
            if eg is not None and (include_edge_in or k != nid):
                grp.add(eg)
        return grp

    def cross(self, nid, color=C_PRUNE):
        """A red X over the subtree rooted at nid (does not reparent — safe)."""
        grp = self.subtree_group(nid)
        x = Cross(grp, stroke_color=color, stroke_width=6)
        return x


def _edge_label_offset(a, b):
    """Nudge a choice label off the edge midpoint so it never sits on the line."""
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    ln = math.hypot(dx, dy) or 1.0
    nx = -dy / ln
    nx = abs(nx) if dx >= 0 else -abs(nx)
    return [nx * 0.30 + (0.18 if abs(dx) < 0.05 else 0.0), 0.02, 0]


# ─── the shared path list (push / pop) ───────────────────────────────────────
class PathList(VGroup):
    """
    The single shared `path` list the recursion threads through — a horizontal
    row of choice cells anchored at a fixed left origin, so pushing appends on the
    right and popping removes the rightmost cell without the row jumping around.
    Build empty, then `.push_cell(v)` / `.pop_cell()` return the mobjects to
    animate. `.name_label` sits to the left.
    """

    def __init__(self, name="path", cell=0.72, gap=0.14,
                 fs=28, color=C_PATH):
        super().__init__()
        self.cell = cell
        self.gap = gap
        self.fs = fs
        self.color = color
        self._cells = []
        self._values = []
        self.bracket_l = Text("[", font_size=fs + 8, color=INK_MUTED)
        self.name_label = Text(f"{name} =", font_size=fs - 4, color=INK_MUTED)
        self.name_label.next_to(self.bracket_l, LEFT, buff=0.22)
        self.bracket_r = Text("]", font_size=fs + 8, color=INK_MUTED)
        self.bracket_r.next_to(self.bracket_l, RIGHT, buff=0.30)
        self.add(self.name_label, self.bracket_l, self.bracket_r)

    def _slot_center(self, i):
        return self.bracket_l.get_right() + RIGHT * (0.28 + i * (self.cell + self.gap) + self.cell / 2)

    def push_cell(self, v, color=None):
        color = color or self.color
        i = len(self._cells)
        box = RoundedRectangle(
            width=self.cell, height=self.cell, corner_radius=0.10,
            stroke_color=color, stroke_width=2.6, fill_color=color, fill_opacity=0.16,
        ).move_to(self._slot_center(i))
        t = fit_label(str(v), self.cell - 0.18, self.fs, INK).move_to(box.get_center())
        cell = VGroup(box, t)
        cell.box = box
        self._cells.append(cell)
        self._values.append(v)
        self.add(cell)
        self._reflow_bracket()
        return cell

    def pop_cell(self):
        if not self._cells:
            return None
        cell = self._cells.pop()
        self._values.pop()
        self.remove(cell)
        self._reflow_bracket()
        return cell

    def _reflow_bracket(self):
        """Keep the closing bracket just right of the last cell (or the opening
        bracket when empty), so it never sits under the first pushed cell."""
        if self._cells:
            self.bracket_r.next_to(self._cells[-1], RIGHT, buff=0.16)
        else:
            self.bracket_r.next_to(self.bracket_l, RIGHT, buff=0.30)

    @property
    def cells(self):
        return list(self._cells)

    @property
    def values(self):
        return list(self._values)


# ─── the used-array (permutations) ───────────────────────────────────────────
def used_row(elems, used=None, w=0.9, h=0.9, fs=26, gap=0.16, on_color=C_USED):
    """
    A boolean used[] flag row for permutations: one cell per element showing the
    element value with a T/F flag chip below. Returns a VGroup with:
      .cells       list of VGroup(box, val)
      .flags       list of the flag Text (so a cue can flip one on/off)
    `used` is an optional list of bools for the initial state.
    """
    used = used or [False] * len(elems)
    row = VGroup()
    cells = []
    flags = []
    for e, u in zip(elems, used):
        col = on_color if u else INK_SUBTLE
        box = RoundedRectangle(
            width=w, height=h, corner_radius=0.10,
            stroke_color=col, stroke_width=2.4, fill_color=col,
            fill_opacity=0.18 if u else 0.07,
        )
        val = fit_label(str(e), w - 0.2, fs, INK).move_to(box.get_center())
        cell = VGroup(box, val)
        cell.box = box
        flag = Text("T" if u else "F", font_size=fs - 6, color=col, weight="BOLD")
        flag.next_to(box, DOWN, buff=0.14)
        cells.append(cell)
        flags.append(flag)
        row.add(cell, flag)
    # arrange the cells; flags follow their box via next_to below
    grp_cells = VGroup(*cells)
    grp_cells.arrange(RIGHT, buff=gap)
    for cell, flag in zip(cells, flags):
        flag.next_to(cell.box, DOWN, buff=0.14)
    row.cells = cells
    row.flags = flags
    return row


def set_used(cell, flag, on, on_color=C_USED):
    """Flip one used[] cell + its flag between T (violet) and F (rest)."""
    col = on_color if on else INK_SUBTLE
    cell.box.set_stroke(color=col, width=2.8 if on else 2.4)
    cell.box.set_fill(color=col, opacity=0.18 if on else 0.07)
    flag.become(
        Text("T" if on else "F", font_size=flag.font_size, color=col, weight="BOLD").move_to(flag.get_center())
    )
    return cell


# ─── the three-beats template ────────────────────────────────────────────────
def three_beats(fs=26, w=3.4, h=0.9, gap=0.5):
    """
    The Choose / Explore / Un-choose template chips (accent / accent-light /
    amber). Returns VGroup laid out vertically; .beats is the list of the three.
    """
    labels = [
        ("1. Choose", "push a choice", C_PATH),
        ("2. Explore", "recurse deeper", ACCENT_LIGHT),
        ("3. Un-choose", "pop it back off", C_POP),
    ]
    beats = []
    grp = VGroup()
    for name, sub, col in labels:
        box = RoundedRectangle(
            width=w, height=h, corner_radius=0.14,
            stroke_color=col, stroke_width=2.6, fill_color=col, fill_opacity=0.12,
        )
        n = Text(name, font_size=fs, color=col, weight="BOLD")
        s = Text(sub, font_size=fs - 8, color=INK_MUTED)
        n.move_to(box.get_center() + UP * 0.14)
        s.move_to(box.get_center() + DOWN * 0.20)
        beat = VGroup(box, n, s)
        beat.box = box
        beats.append(beat)
        grp.add(beat)
    grp.arrange(DOWN, buff=gap)
    grp.beats = beats
    return grp


# ─── complexity chip (MathTex, bounds only) ──────────────────────────────────
def complexity(tex, color=INK, fs=46):
    """A complexity bound as MathTex — the ONE place MathTex is used here
    (e.g. r'O(2^{n})', r'O(n!)')."""
    return MathTex(tex, color=color).scale(fs / 46.0)


# ─── snapshot shelf (recorded copies) ────────────────────────────────────────
def snapshot_chip(values, color=C_SAVE, fs=24):
    """A saved COPY of the path — an emerald chip like '[1, 2]' that lands on the
    results shelf. Distinct color from the live path so 'copy vs reference' reads."""
    txt = "[" + ", ".join(str(v) for v in values) + "]"
    w = max(1.2, 0.26 * len(txt) + 0.6)
    return chip(txt, color=color, w=w, h=0.68, fs=fs)
