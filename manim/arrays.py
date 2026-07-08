"""
Reusable array / sliding-window visual idioms for the algorithm lessons
(Lesson 17 "Sliding Window: Turn Nested Loops Into One Pass", acts 98/99/100,
and future array/two-pointer lessons).

The visual vocabulary here is *algorithm-visual*, deliberately NOT the
Bayes / econ / transformer idioms of the other lessons: a row of indexed value
cells, a window bracket spanning a contiguous slice, labelled left/right
boundary pointers, a running-sum badge, an "enters / leaves" edit annotation,
and a small complexity chip. Sliding-window pedagogy is a story of *state
transitions on an array* — one element leaving, one entering, boundaries moving
in lockstep or breathing — so the idioms make those transitions the star and
reserve MathTex for the complexity bounds only.

Every helper honors theme.py (dark stage, site accent hues, safe-area guard) and
returns plain Manim mobjects the cue scenes stage, transform, and highlight. The
generic text/box helpers (chip, fit_label) are reused from bayes.py, same as
transformer.py / econ.py, rather than duplicated.

Semantic colors (reused across all three parts so the eye learns them):
  ARRAY cell at rest       → INK_SUBTLE outline (neutral data)
  WINDOW / current slice   → ACCENT   (what we are looking at now)
  ENTERS (one in)          → EMERALD  (the element joining the window)
  LEAVES (one out)         → ROSE     (the element leaving the window)
  RIGHT boundary pointer   → ACCENT   (expands / admits)
  LEFT boundary pointer    → AMBER    (trails / shrinks / repairs)
  RESULT / running value   → EMERALD  (sum, best-length, the answer)
"""

from __future__ import annotations

from manim import (
    VGroup,
    RoundedRectangle,
    Text,
    MathTex,
    Arrow,
    Line,
    SurroundingRectangle,
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

# Semantic role colors for the sliding-window story (shared across all parts).
C_CELL = INK_SUBTLE
C_WINDOW = ACCENT
C_ENTER = EMERALD
C_LEAVE = ROSE
C_RIGHT = ACCENT
C_LEFT = AMBER
C_RESULT = EMERALD

# Semantic role colors for the MONOTONIC-STACK story (Lesson 22, acts 128/129/130).
# The stack is a vertical column of "unresolved" indices; a newcomer arriving
# from the array either just waits (push) or settles accounts (pop = answer
# known). The eye learns: violet = still waiting on the stack, blue = the
# newcomer we are processing, emerald = an answer just resolved, rose = evicted.
C_STACK = VIOLET     # an index sitting on the stack, answer still open
C_ARRIVE = ACCENT    # the current newcomer being processed
C_RESOLVE = EMERALD  # a pop — the popped element's answer just became known
C_EVICT = ROSE       # a bar/element leaving without ever being the answer


# ─── the indexed value row ───────────────────────────────────────────────────
def value_row(values, color=C_CELL, w=0.9, h=0.9, fs=30, gap=0.14,
              index=True, idx_fs=17):
    """
    A horizontal row of value cells — the array (or string) the window slides
    over. `values` is a list of ints/strings. Returns a VGroup with attributes:
      .cells   — list of VGroup(box, text), one per element (for highlighting)
      .boxes   — list of just the box mobjects (for window brackets / pointers)
      .idx     — list of the index Text labels below each cell (or [] if off)
    so cue scenes can highlight cell k, span a window, or attach a pointer.
    """
    row = VGroup()
    cells = []
    boxes = []
    for v in values:
        box = RoundedRectangle(
            width=w, height=h, corner_radius=0.08,
            stroke_color=color, stroke_width=2.2, fill_color=color, fill_opacity=0.10,
        )
        t = fit_label(str(v), w - 0.22, fs, INK).move_to(box.get_center())
        cell = VGroup(box, t)
        row.add(cell)
        cells.append(cell)
        boxes.append(box)
    row.arrange(RIGHT, buff=gap)
    idx = []
    if index:
        idx_group = VGroup()
        for i, cell in enumerate(cells):
            lab = Text(str(i), font_size=idx_fs, color=INK_SUBTLE)
            lab.next_to(cell, DOWN, buff=0.16)
            idx_group.add(lab)
            idx.append(lab)
        row.add(idx_group)
    row.cells = cells
    row.boxes = boxes
    row.idx = idx
    return row


def recolor_cell(cell, color, fill=0.22):
    """Recolor one value cell's box (box is cell[0]) to a semantic hue."""
    box = cell[0]
    box.set_stroke(color=color, width=2.8)
    box.set_fill(color=color, opacity=fill)
    return cell


# ─── the window bracket (a contiguous slice) ─────────────────────────────────
def window_bracket(row, lo, hi, color=C_WINDOW, buff=0.14, label=None,
                   label_fs=22):
    """
    A rounded rectangle enclosing cells lo..hi (inclusive) of a value_row — the
    current window. Returns a VGroup(rect[, label]); the caller Transforms it as
    the window slides/breathes. `label` (e.g. "window") sits above the bracket.
    """
    lo = max(0, lo)
    hi = min(len(row.cells) - 1, hi)
    slice_group = VGroup(*row.cells[lo:hi + 1])
    rect = SurroundingRectangle(
        slice_group, color=color, buff=buff, corner_radius=0.12,
    )
    rect.set_stroke(width=3.4)
    grp = VGroup(rect)
    if label:
        lab = fit_label(label, rect.width, label_fs, color).next_to(rect, UP, buff=0.18)
        grp.add(lab)
    return grp


# ─── boundary pointers (left / right) ────────────────────────────────────────
def pointer(cell, name, color=C_RIGHT, side=DOWN, fs=22, gap=0.9):
    """
    A labelled arrow pointing AT one cell from the `side` direction: side=DOWN
    sits below the row and points up at the cell's bottom edge; side=UP sits
    above and points down. Used for the L / R boundary markers. Returns
    VGroup(arrow, label). Stagger `gap` when two pointers share a cell so their
    labels do not collide (e.g. R gap 0.85, L gap 1.75 both below the row).
    """
    edge = cell.get_edge_center(side)  # the cell edge the arrow touches
    tail = edge + side * gap           # tail sits `gap` beyond that edge
    arrow = Arrow(tail, edge, buff=0.06, color=color, stroke_width=5,
                  max_tip_length_to_length_ratio=0.34, max_stroke_width_to_length_ratio=8)
    lab = Text(name, font_size=fs, color=color, weight="BOLD")
    lab.next_to(tail, side, buff=0.1)
    return VGroup(arrow, lab)


# ─── running value badge (sum / best length) ─────────────────────────────────
def value_badge(label, value, color=C_RESULT, w=3.0, h=1.0, name_fs=22, val_fs=34):
    """
    A chip showing a named running quantity, e.g. "sum = 13" or "best = 3".
    Returns VGroup(box, name, value) with .value_text pointing at the number so
    the caller can Transform just the number as it updates.
    """
    box = RoundedRectangle(
        width=w, height=h, corner_radius=0.14,
        stroke_color=color, stroke_width=2.6, fill_color=color, fill_opacity=0.12,
    )
    name = Text(label, font_size=name_fs, color=INK_MUTED)
    val = Text(str(value), font_size=val_fs, color=color, weight="BOLD")
    name.move_to(box.get_center() + LEFT * (w * 0.22))
    val.move_to(box.get_center() + RIGHT * (w * 0.18))
    grp = VGroup(box, name, val)
    grp.value_text = val
    return grp


# ─── the edit annotation ("−4 +1") ───────────────────────────────────────────
def edit_note(out_val, in_val, out_color=C_LEAVE, in_color=C_ENTER, fs=30):
    """
    The constant-work edit: "− out  + in" with the leaving element in rose and
    the entering element in emerald. Returns a VGroup laid left→right.
    """
    minus = Text(f"−{out_val}", font_size=fs, color=out_color, weight="BOLD")
    plus = Text(f"+{in_val}", font_size=fs, color=in_color, weight="BOLD")
    plus.next_to(minus, RIGHT, buff=0.4)
    return VGroup(minus, plus)


# ─── complexity chip (MathTex, bounds only) ──────────────────────────────────
def complexity(tex, color=INK, fs=46):
    """
    A complexity bound rendered as MathTex — the ONE place MathTex is used in
    these algorithm scenes (e.g. r"O(n\\cdot k)", r"O(n)", r"2n"). Returns the
    MathTex mobject.
    """
    return MathTex(tex, color=color).scale(fs / 46.0)


# ─── code skeleton line ──────────────────────────────────────────────────────
def code_line(text, color=INK, fs=24, indent=0):
    """
    One monospace-style line of the template skeleton. Rendered as plain Text
    (Manim's MathTex collapses spaces), left-anchored, with `indent` levels of
    leading space so the skeleton reads like code.
    """
    line = Text(("    " * indent) + text, font="monospace", font_size=fs, color=color)
    return line


# ─── the monotonic stack (a vertical column of unresolved indices) ───────────
# A monotonic stack is a story of a VERTICAL column that grows and shrinks: an
# index is pushed (waits, still unresolved) and later popped (its answer becomes
# known when a newcomer breaks the order). These helpers give cue scenes the
# column vocabulary — a base line the stack grows up from, a labelled cell for
# one entry, and a level→position map so push animates a new cell onto the top
# and pop fades the top cell off. Reused by Lesson 22 acts 128/129/130 and any
# future nearest-greater / histogram / span lesson.
def stack_base(base_point, label="stack", w=1.6, color=C_STACK, fs=20):
    """
    The baseline the stack grows UP from, with a label beneath it. `base_point`
    is the [x, y, 0] of the base line's center; cells stack upward from here so
    the top-of-stack is the highest cell. Returns VGroup(line, label) with a
    `.base_point` attribute the position helper reads.
    """
    line = Line(
        [base_point[0] - w / 2, base_point[1], 0],
        [base_point[0] + w / 2, base_point[1], 0],
        color=color, stroke_width=5,
    )
    lab = Text(label, font_size=fs, color=INK_MUTED).next_to(line, DOWN, buff=0.16)
    grp = VGroup(line, lab)
    grp.base_point = list(base_point)
    return grp


def stack_pos(base_point, level, h=0.82, gap=0.12, pad=0.14):
    """
    Center [x, y, 0] of the stack cell at `level` (0 = bottom, just above the
    base line) in a column growing UP. Push a cell by move_to(stack_pos(..,
    len(stack))); pop by fading the cell at the current top level.
    """
    return [
        base_point[0],
        base_point[1] + pad + h / 2 + (h + gap) * level,
        0,
    ]


def stack_cell(value, idx=None, color=C_STACK, w=1.7, h=0.82, fs=30, idx_fs=18):
    """
    One monotonic-stack cell: a value box with an optional small index tag at
    its left ("i3"), since a monotonic stack conventionally stores indices whose
    value it also shows. Returns VGroup with `.box` and `.val_text` attributes
    for recolor/Transform, and `.idx_tag` when an index is given.
    """
    box = RoundedRectangle(
        width=w, height=h, corner_radius=0.10,
        stroke_color=color, stroke_width=2.6, fill_color=color, fill_opacity=0.16,
    )
    t = fit_label(str(value), w - 0.30, fs, INK).move_to(box.get_center())
    cell = VGroup(box, t)
    cell.box = box
    cell.val_text = t
    if idx is not None:
        tag = Text(f"i{idx}", font_size=idx_fs, color=INK_SUBTLE, weight="BOLD")
        tag.next_to(box, LEFT, buff=0.12)
        cell.add(tag)
        cell.idx_tag = tag
    return cell


def recolor_stack_cell(cell, color, fill=0.22):
    """Recolor a stack cell's box (and its index tag) to a semantic hue."""
    cell.box.set_stroke(color=color, width=3.0)
    cell.box.set_fill(color=color, opacity=fill)
    return cell


# ─── the histogram (bars for largest-rectangle) ──────────────────────────────
def histogram(heights, unit=0.42, w=1.0, gap=0.12, base_y=-1.9, color=C_CELL,
              index=True, idx_fs=17):
    """
    A row of vertical bars of the given integer `heights`, all sitting on a
    common baseline at `base_y` — the largest-rectangle-in-a-histogram picture.
    Bar i has pixel height heights[i]*unit. Returns a VGroup with attributes:
      .bars      — list of the bar Rectangles (for recolor / SurroundingRectangle)
      .base_y    — the shared baseline y
      .xs        — list of each bar's center x (for width brackets / walls)
      .unit      — the height→units scale (for drawing rectangle overlays)
    """
    from manim import Rectangle
    group = VGroup()
    bars = []
    xs = []
    n = len(heights)
    total_w = n * w + (n - 1) * gap
    x0 = -total_w / 2 + w / 2
    for i, hgt in enumerate(heights):
        bh = max(hgt, 0.001) * unit
        bar = Rectangle(
            width=w, height=bh,
            stroke_color=color, stroke_width=2.2, fill_color=color, fill_opacity=0.16,
        )
        cx = x0 + i * (w + gap)
        bar.move_to([cx, base_y + bh / 2, 0])
        lab = Text(str(hgt), font_size=24, color=INK).next_to(bar, UP, buff=0.10)
        group.add(bar, lab)
        bars.append(bar)
        xs.append(cx)
    if index:
        for i, cx in enumerate(xs):
            t = Text(str(i), font_size=idx_fs, color=INK_SUBTLE)
            t.move_to([cx, base_y - 0.28, 0])
            group.add(t)
    group.bars = bars
    group.base_y = base_y
    group.xs = xs
    group.unit = unit
    group.bar_w = w
    return group


def recolor_bar(bar, color, fill=0.30):
    """Recolor one histogram bar to a semantic hue."""
    bar.set_stroke(color=color, width=3.0)
    bar.set_fill(color=color, opacity=fill)
    return bar


def rect_overlay(hist, lo, hi, height, color=EMERALD, opacity=0.30):
    """
    A measured rectangle spanning histogram bars lo..hi (inclusive) at the given
    bar `height`, sitting on the histogram baseline — the candidate answer for
    the largest-rectangle family. Reads hist.xs / hist.base_y / hist.unit /
    hist.bar_w, so keep those in sync if you shift the histogram.
    """
    from manim import Rectangle
    left = hist.xs[lo] - hist.bar_w / 2
    right = hist.xs[hi] + hist.bar_w / 2
    w = right - left
    h = height * hist.unit
    rect = Rectangle(width=w, height=h, stroke_color=color, stroke_width=3.5,
                     fill_color=color, fill_opacity=opacity)
    rect.move_to([(left + right) / 2, hist.base_y + h / 2, 0])
    return rect
