"""
Reusable heap / priority-queue visual idioms for Lesson 19
("Heap / Priority Queue: The Extreme, Again and Again, in log n", acts
108/109/110) and future tree-shaped-array lessons.

A heap is a *binary tree stored as a flat array*, so the visual vocabulary here
is two synchronized views:

  1. a binary-tree view  — circular nodes laid out by heap index, parent→child
     edges, the root at the top holding the extreme; and
  2. a flat-array view   — the same values in an indexed row (reuse arrays.py's
     value_row), with the pure index arithmetic (parent (i-1)//2, children
     2i+1 / 2i+2) that links the two.

The pedagogy of a heap is a story of *local swaps along one root-to-leaf path*:
insert drops at the end and sifts up; remove moves the last leaf to the root and
sifts down. The idioms make those swaps and that single O(log n) path the star,
and reserve MathTex for the complexity bounds only.

Everything honors theme.py (dark stage, site accent hues, safe-area guard) and
returns plain Manim mobjects the cue scenes stage / transform / highlight. The
generic text/box helpers (chip, fit_label) are reused from bayes.py, and the
flat-array row + complexity chip are reused from arrays.py, rather than
duplicated.

Semantic colors (shared across all three parts so the eye learns them):
  NODE / cell at rest      → INK_SUBTLE outline (neutral data)
  ROOT / the extreme       → EMERALD  (the min at the top — the answer)
  ACTIVE / comparing       → AMBER    (the node currently being sifted)
  NEW / inserted           → ACCENT   (the value entering the heap)
  EVICTED / removed        → ROSE     (the value leaving)
  swap path / index links  → VIOLET   (the root-to-leaf spine, index arithmetic)
"""

from __future__ import annotations

import math

from manim import (
    VGroup,
    Circle,
    Line,
    DashedLine,
    Text,
    MathTex,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
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
    LABEL_SIZE,
    BODY_SIZE,
)
from bayes import chip, fit_label  # noqa: F401  (re-exported for cue scenes)
from arrays import value_row, recolor_cell, complexity  # noqa: F401  (flat-array view)

# Semantic role colors for the heap story (shared across all parts).
C_NODE = INK_SUBTLE
C_ROOT = EMERALD
C_ACTIVE = AMBER
C_NEW = ACCENT
C_EVICT = ROSE
C_SPINE = VIOLET


# ─── node position: index → (x, y) for a complete binary tree ────────────────
def node_xy(i, top=1.9, level_gap=1.45, width=9.0):
    """
    Position of heap index `i` in a level-even complete-binary-tree layout.

    depth d = floor(log2(i+1)); offset o within the level = i - (2^d - 1).
    x spreads each level evenly across `width` and centers it, which makes every
    parent land exactly at the midpoint of its two children (the even-level
    spread has that property). y drops one `level_gap` per depth from `top`.
    """
    d = int(math.floor(math.log2(i + 1)))
    o = i - (2 ** d - 1)
    x = ((o + 0.5) / (2 ** d)) * width - width / 2.0
    y = top - d * level_gap
    return [x, y, 0]


# ─── the binary-tree view ────────────────────────────────────────────────────
def heap_tree(values, r=0.42, fs=30, top=1.9, level_gap=1.45, width=9.0,
              color=C_NODE, edge_color=INK_SUBTLE):
    """
    A min-heap drawn as a binary tree: circular nodes at heap-index positions,
    with parent→child edges drawn UNDER the nodes. `values` is a list of ints.
    Returns a VGroup with attributes:
      .nodes   — list of VGroup(circle, label), one per value (for highlight/swap)
      .circles — list of just the circle mobjects
      .labels  — list of just the value Text mobjects
      .edges   — VGroup of the parent→child Lines
      .xy      — list of the [x,y,0] center of each node
    Edges are added first so nodes render on top of them.
    """
    n = len(values)
    xy = [node_xy(i, top, level_gap, width) for i in range(n)]

    edges = VGroup()
    for i in range(1, n):
        parent = (i - 1) // 2
        edges.add(Line(xy[parent], xy[i], stroke_color=edge_color, stroke_width=2.4))

    nodes = []
    circles = []
    labels = []
    node_group = VGroup()
    for i, v in enumerate(values):
        circ = Circle(radius=r, stroke_color=color, stroke_width=2.6,
                      fill_color=color, fill_opacity=0.10).move_to(xy[i])
        lab = fit_label(str(v), 2 * r - 0.16, fs, INK).move_to(xy[i])
        node = VGroup(circ, lab)
        nodes.append(node)
        circles.append(circ)
        labels.append(lab)
        node_group.add(node)

    grp = VGroup(edges, node_group)
    grp.nodes = nodes
    grp.circles = circles
    grp.labels = labels
    grp.edges = edges
    grp.xy = xy
    return grp


def recolor_node(node, color, fill=0.22):
    """Recolor one tree node's circle (node[0]) to a semantic hue."""
    circ = node[0]
    circ.set_stroke(color=color, width=3.0)
    circ.set_fill(color=color, opacity=fill)
    return node


def swap_labels(node_a, node_b):
    """
    Return the two value-Text mobjects (node[1]) so a cue can Transform/animate
    them trading centers to show a swap. The caller drives the animation; this
    just exposes the pieces.
    """
    return node_a[1], node_b[1]


# ─── the flat-array view (thin wrapper over arrays.value_row) ────────────────
def heap_array(values, w=0.82, h=0.82, fs=28, gap=0.12, index=True, y=-2.55):
    """
    The same heap as an indexed flat array row (reusing arrays.py value_row),
    placed near the bottom of the stage so it can sit under the tree view.
    Returns the value_row VGroup (with .cells / .boxes / .idx).
    """
    row = value_row(values, w=w, h=h, fs=fs, gap=gap, index=index)
    row.move_to([0, y, 0])
    return row


def index_link(tree_node, array_cell, color=C_SPINE):
    """A dashed line tying a tree node to its flat-array cell (index identity)."""
    return DashedLine(
        tree_node.get_bottom(), array_cell.get_top(),
        stroke_color=color, stroke_width=2.0, dash_length=0.1,
    )


def index_math(color=INK, fs=34):
    """
    The pure index arithmetic that replaces pointers, as MathTex:
      parent(i) = (i-1)//2 ,  left(i) = 2i+1 ,  right(i) = 2i+2
    Returns a VGroup of three stacked MathTex lines.
    """
    parent = MathTex(r"\mathrm{parent}(i) = \lfloor (i-1)/2 \rfloor", color=color)
    left = MathTex(r"\mathrm{left}(i) = 2i+1", color=color)
    right = MathTex(r"\mathrm{right}(i) = 2i+2", color=color)
    grp = VGroup(parent, left, right).arrange(DOWN, buff=0.34, aligned_edge=LEFT)
    grp.scale(fs / 34.0)
    grp.parent_line = parent
    grp.left_line = left
    grp.right_line = right
    return grp


# ─── the size-k cap badge (Part 2) ───────────────────────────────────────────
def cap_badge(k, color=ACCENT, w=2.4, h=0.95, name_fs=22, val_fs=34):
    """A chip showing the heap's size cap, e.g. 'cap = 3'. Returns VGroup."""
    from manim import RoundedRectangle
    box = RoundedRectangle(width=w, height=h, corner_radius=0.14,
                           stroke_color=color, stroke_width=2.6,
                           fill_color=color, fill_opacity=0.12)
    name = Text("cap", font_size=name_fs, color=INK_MUTED)
    val = Text(f"= {k}", font_size=val_fs, color=color, weight="BOLD")
    name.move_to(box.get_center() + LEFT * (w * 0.24))
    val.move_to(box.get_center() + RIGHT * (w * 0.18))
    return VGroup(box, name, val)


# ─── a labelled root/answer marker ───────────────────────────────────────────
def root_marker(node, text="root = min", color=C_ROOT, fs=22, side=UP, gap=0.28):
    """A small label pointing at the root (or any node), placed to `side`."""
    lab = Text(text, font_size=fs, color=color, weight="BOLD")
    lab.next_to(node, side, buff=gap)
    return lab
