"""
Reusable graph / traversal visual idioms for the graph-algorithm lessons
(Lesson 24 "Graph Reactivation: One Loop, Swap the Container — BFS, Dijkstra,
DFS, Multi-source, Union Find, Topological Sort", acts 140/141/142, and any
future graph / grid-BFS / union-find lesson).

The whole pedagogy of lesson 24 is *one traversal loop whose behaviour changes
only by which container holds the frontier*: a FIFO queue gives BFS, a LIFO
stack gives DFS, a min-priority-queue gives Dijkstra. So the star idiom here is
`container(kind, ...)` — the same box rendered as queue / stack / pq — beside a
node-and-edge `graph_group(...)` whose nodes recolor as they move unseen →
frontier → current → done. Two supporting stories get their own idioms: a
`grid_board(...)` for multi-source grid BFS (rotting oranges) and a
`forest(...)` of parent pointers for Union Find (number of provinces).

Every helper honours theme.py (dark stage, site accent hues, safe-area guard)
and returns plain Manim mobjects the cue scenes stage, transform, and highlight.
Generic text helpers (chip, fit_label) and the value badge are reused from
bayes.py / arrays.py rather than duplicated.

Semantic colours (shared across all three parts so the eye learns them):
  node/edge at rest        → INK_SUBTLE  (unseen / neutral)
  FRONTIER (in container)  → AMBER       (discovered, waiting to be expanded)
  CURRENT (being expanded) → ACCENT      (the node we popped this step)
  DONE / settled           → EMERALD     (finalized — distance/order locked in)
  SOURCE seed / special    → ROSE        (multi-source seeds, negative edge, cycle)
For the grid board the natural produce colours win: fresh → EMERALD, rotten →
AMBER, wall/empty → INK_SUBTLE.
"""

from __future__ import annotations

from manim import (
    VGroup,
    Circle,
    RoundedRectangle,
    Rectangle,
    Line,
    Arrow,
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
    CATEGORICAL,
)
from bayes import chip, fit_label  # noqa: F401  (re-exported for cue scenes)

# ─── Semantic role colours for the traversal story ──────────────────────────
C_UNSEEN = INK_SUBTLE   # a node/edge not yet discovered
C_FRONTIER = AMBER      # in the container, discovered but not expanded
C_CURRENT = ACCENT      # popped this step, being expanded
C_DONE = EMERALD        # settled — BFS layer / Dijkstra distance finalized
C_SOURCE = ROSE         # multi-source seed / negative weight / cycle edge

# Grid-board (rotting oranges) produce colours.
C_FRESH = EMERALD
C_ROTTEN = AMBER
C_WALL = INK_SUBTLE


# ─── one graph node (labelled circle) ────────────────────────────────────────
def node_circle(label, color=C_UNSEEN, r=0.36, fs=26, fill=0.14):
    """
    A single graph node: a circle with a centred label. Returns a VGroup with
    `.circle` and `.label` attributes so scenes recolor the ring / swap the
    number. Node fill is kept low so edges behind read cleanly.
    """
    circ = Circle(radius=r, stroke_color=color, stroke_width=3.0,
                  fill_color=color, fill_opacity=fill)
    t = fit_label(str(label), r * 1.5, fs, INK, weight="BOLD").move_to(circ.get_center())
    grp = VGroup(circ, t)
    grp.circle = circ
    grp.label = t
    return grp


def recolor_node(node, color, fill=0.22, width=3.4):
    """Recolor a node's ring + fill to a semantic hue (leaves the label ink)."""
    node.circle.set_stroke(color=color, width=width)
    node.circle.set_fill(color=color, opacity=fill)
    return node


# ─── a node-and-edge graph at explicit positions ─────────────────────────────
def graph_group(labels, edges, positions, *, directed=False, weights=None,
                node_r=0.36, node_fs=26, edge_color=C_UNSEEN, node_color=C_UNSEEN,
                weight_fs=22, edge_width=2.6):
    """
    Build a graph from explicit geometry — the author owns the layout so nothing
    ever collides or leaves the safe area.

      labels     — list of node labels, index 0..n-1
      edges      — list of (u, v) index pairs
      positions  — list of [x, y] (or [x, y, 0]) per node, same order as labels
      directed   — draw Arrows (u→v) instead of undirected Lines
      weights    — optional dict {(u, v): w} → draws a small weight label at the
                   edge midpoint (Dijkstra); keys match `edges` order/orientation

    Returns a VGroup with attributes:
      .nodes     — list of node VGroups (recolor via recolor_node)
      .edge      — dict {(u, v): Line|Arrow} keyed exactly as given in `edges`
      .wlabel    — dict {(u, v): Text} weight labels (empty if no weights)
    Edges are added first (drawn behind the nodes) so node fills sit on top.
    """
    g = VGroup()
    nodes = []
    pos = []
    for p in positions:
        pos.append([p[0], p[1], 0] if len(p) == 2 else list(p))

    edge_map = {}
    wlabel = {}
    edge_layer = VGroup()
    for (u, v) in edges:
        a, b = pos[u], pos[v]
        if directed:
            e = Arrow(a, b, buff=node_r + 0.04, color=edge_color, stroke_width=edge_width,
                      max_tip_length_to_length_ratio=0.14, max_stroke_width_to_length_ratio=6)
        else:
            # trim the line to the circle rims so it doesn't poke through nodes
            import numpy as np
            a_np, b_np = np.array(a, float), np.array(b, float)
            d = b_np - a_np
            L = float(np.linalg.norm(d)) or 1.0
            unit = d / L
            e = Line(a_np + unit * node_r, b_np - unit * node_r,
                     color=edge_color, stroke_width=edge_width)
        edge_map[(u, v)] = e
        edge_layer.add(e)
        if weights and (u, v) in weights:
            mid = e.get_center()
            wl = Text(str(weights[(u, v)]), font_size=weight_fs, color=INK_MUTED, weight="BOLD")
            # nudge the weight label off the edge line
            wl.move_to(mid).shift(UP * 0.24 + RIGHT * 0.06)
            wlabel[(u, v)] = wl
            edge_layer.add(wl)
    g.add(edge_layer)

    node_layer = VGroup()
    for i, lab in enumerate(labels):
        nd = node_circle(lab, color=node_color, r=node_r, fs=node_fs)
        nd.move_to(pos[i])
        nodes.append(nd)
        node_layer.add(nd)
    g.add(node_layer)

    g.nodes = nodes
    g.edge = edge_map
    g.wlabel = wlabel
    g._pos = pos
    return g


def recolor_edge(g, u, v, color, width=4.0):
    """Recolor one graph edge (matches the (u, v) key it was created with)."""
    e = g.edge.get((u, v)) or g.edge.get((v, u))
    if e is not None:
        e.set_stroke(color=color, width=width)
    return e


def dist_badge(node, value, color=C_DONE, fs=22, gap=0.10, side=UP):
    """
    A small distance / layer label pinned just outside a node (BFS layer index,
    Dijkstra tentative distance). Returns a Text mobject the scene Transforms as
    the value settles.
    """
    t = Text(str(value), font_size=fs, color=color, weight="BOLD")
    t.next_to(node, side, buff=gap)
    return t


# ─── the frontier container (queue / stack / priority-queue) ─────────────────
def container(kind, items, *, w=0.86, h=0.72, gap=0.12, fs=26, color=C_FRONTIER,
              title=True):
    """
    THE lesson-24 idiom: the frontier, rendered three ways from one shape.

      kind = "queue"  → a horizontal FIFO row; front (dequeue end) on the LEFT,
                        marked "front", back (enqueue) on the RIGHT.
      kind = "stack"  → a vertical LIFO column growing UP; top (pop end) marked.
      kind = "pq"     → a horizontal row kept sorted ascending; the min (next
                        pop) on the LEFT marked "min".

    `items` is a list of labels (ints/strings). Returns a VGroup with:
      .slots    — list of cell VGroups (index 0 = the marked pop-end)
      .kind     — the kind string
      .tag      — the front/top/min marker Text (or None)
      .caption  — the small kind caption Text (or None)
    Recolor a slot with recolor_slot(); the marked pop-end is slots[0].
    """
    grp = VGroup()
    slots = []
    cells = VGroup()
    for it in items:
        box = RoundedRectangle(width=w, height=h, corner_radius=0.10,
                               stroke_color=color, stroke_width=2.6,
                               fill_color=color, fill_opacity=0.14)
        t = fit_label(str(it), w - 0.20, fs, INK, weight="BOLD").move_to(box.get_center())
        cell = VGroup(box, t)
        cell.box = box
        cell.val = t
        slots.append(cell)
        cells.add(cell)

    tag = None
    if kind == "stack":
        # grow UP: first item at the bottom, last (top) on top and marked
        cells.arrange(UP, buff=gap)
        grp.add(cells)
        # reorder slots so slots[0] is the POP end = the visual top = last item
        slots = list(reversed(slots))
        if slots:
            tag = Text("top", font_size=20, color=color, weight="BOLD")
            tag.next_to(slots[0], RIGHT, buff=0.22)
            grp.add(tag)
    else:
        cells.arrange(RIGHT, buff=gap)
        grp.add(cells)
        if slots:
            label = "min" if kind == "pq" else "front"
            tag = Text(label, font_size=20, color=color, weight="BOLD")
            tag.next_to(slots[0], DOWN, buff=0.20)
            grp.add(tag)

    caption = None
    if title:
        name = {"queue": "queue → BFS", "stack": "stack → DFS",
                "pq": "priority queue → Dijkstra"}.get(kind, kind)
        caption = Text(name, font_size=22, color=INK_MUTED)
        caption.next_to(cells, UP, buff=0.28)
        grp.add(caption)

    grp.slots = slots
    grp.kind = kind
    grp.tag = tag
    grp.caption = caption
    grp.cells = cells
    return grp


def recolor_slot(cell, color, fill=0.28):
    """Recolor one container slot to a semantic hue."""
    cell.box.set_stroke(color=color, width=3.0)
    cell.box.set_fill(color=color, opacity=fill)
    return cell


# ─── the grid board (multi-source grid BFS: rotting oranges) ─────────────────
def grid_board(states, *, cell=0.74, gap=0.08, fresh=C_FRESH, rotten=C_ROTTEN,
               wall=C_WALL, base=None):
    """
    A rows×cols board of cells for grid BFS. `states` is a list of row strings
    (or lists) using: 'F' fresh, 'R' rotten, '.' empty/wall. Returns a VGroup:
      .cell[r][c]  — the cell VGroup(box[, dot]) for recolor / minute-label
      .rows, .cols — dimensions
      .state[r][c] — the char (mutable bookkeeping for the author)
    A fresh/rotten cell carries a small produce dot; walls are dim empty boxes.
    """
    grp = VGroup()
    rows = len(states)
    cols = len(states[0])
    board = [[None] * cols for _ in range(rows)]
    state = [[states[r][c] for c in range(cols)] for r in range(rows)]
    total_w = cols * cell + (cols - 1) * gap
    total_h = rows * cell + (rows - 1) * gap
    x0 = -total_w / 2 + cell / 2
    y0 = total_h / 2 - cell / 2
    for r in range(rows):
        for c in range(cols):
            ch = state[r][c]
            col = {"F": fresh, "R": rotten}.get(ch, wall)
            box = RoundedRectangle(width=cell, height=cell, corner_radius=0.08,
                                   stroke_color=col, stroke_width=2.4,
                                   fill_color=col,
                                   fill_opacity=0.06 if ch == "." else 0.20)
            cx = x0 + c * (cell + gap)
            cy = y0 - r * (cell + gap)
            box.move_to([cx, cy, 0])
            cg = VGroup(box)
            cg.box = box
            cg.dot = None
            if ch in ("F", "R"):
                dot = Circle(radius=cell * 0.22, stroke_width=0,
                             fill_color=col, fill_opacity=0.95).move_to(box.get_center())
                cg.add(dot)
                cg.dot = dot
            board[r][c] = cg
            grp.add(cg)
    if base is not None:
        grp.move_to(base)
    grp.cell = board
    grp.rows = rows
    grp.cols = cols
    grp.state = state
    grp.cell_w = cell
    return grp


def set_cell(cg, color, *, fill=0.24):
    """Recolor a grid cell (box + its produce dot) to a semantic hue."""
    cg.box.set_stroke(color=color, width=3.0)
    cg.box.set_fill(color=color, opacity=fill)
    if cg.dot is not None:
        cg.dot.set_fill(color=color, opacity=0.95)
    return cg


def minute_tag(cg, value, color=C_CURRENT, fs=22):
    """A small minute/distance number centred on a grid cell (over the dot)."""
    t = Text(str(value), font_size=fs, color=INK, weight="BOLD").move_to(cg.box.get_center())
    return t


# ─── the union-find forest (parent pointers) ─────────────────────────────────
def forest_nodes(labels, positions, *, r=0.34, fs=24, color=C_UNSEEN):
    """
    Lay out union-find nodes at explicit positions (author-owned geometry).
    Returns VGroup with `.nodes` (list of node VGroups) and `.pos` — parent
    pointers are then drawn between them with `parent_arrow`.
    """
    g = VGroup()
    nodes = []
    pos = []
    for p in positions:
        pos.append([p[0], p[1], 0] if len(p) == 2 else list(p))
    for i, lab in enumerate(labels):
        nd = node_circle(lab, color=color, r=r, fs=fs)
        nd.move_to(pos[i])
        nodes.append(nd)
        g.add(nd)
    g.nodes = nodes
    g.pos = pos
    return g


def parent_arrow(child, parent, color=ACCENT, width=3.2, r=0.34):
    """
    A directed arrow child → parent (union-find "points at its root"). Trimmed
    to the circle rims. Returns the Arrow so the scene can recolor / fade it as
    a union re-parents a node.
    """
    import numpy as np
    a = np.array(child.get_center(), float)
    b = np.array(parent.get_center(), float)
    d = b - a
    L = float(np.linalg.norm(d)) or 1.0
    unit = d / L
    arr = Arrow(a + unit * r, b - unit * r, buff=0.0, color=color, stroke_width=width,
                max_tip_length_to_length_ratio=0.22, max_stroke_width_to_length_ratio=7)
    return arr


def root_ring(node, color=ACCENT, r=0.34):
    """A highlight ring marking a node as the root of its group."""
    ring = Circle(radius=r + 0.14, stroke_color=color, stroke_width=4.0,
                  fill_opacity=0.0).move_to(node.get_center())
    return ring
