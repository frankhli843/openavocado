"""
Reusable image-preprocessing visual idioms for Lesson 9 "Code It From Scratch:
PIL, NumPy, and the Preprocessing Pipeline" (acts 59 orientation / 60 PIL open+
resize / 61 rescale+normalize / 62 permute+batch), and any future
tensor/array-preprocessing lesson.

This visual vocabulary is deliberately NOT the transformer / bayes / algorithm
idioms: image preprocessing is a story of a concrete grid of pixels changing
*shape, dtype, and range* as it flows through seven lines of code. So the idioms
make those transitions the star:

  - a pixel grid (H×W of value cells, optionally shaded by brightness)
  - a 3-plane channel stack (R/G/B depth) — a color image is H×W×3
  - a tensor-shape tag  (H, W, C) with role-labelled dims, transformable so
    HWC → CHW → (1,C,H,W) animates by re-ordering the dim chips
  - a value-range bar (uint8 0..255 → float 0..1 → normalized ≈ −2..2)
  - a small length-C vector strip (per-channel mean / std, for broadcasting)
  - a code block of the seven lines, with one line lit as it is discussed

Every helper honors theme.py (dark stage, site accent hues, safe-area guard) and
returns plain Manim mobjects the cue scenes stage, transform, and highlight. The
generic text/box helpers (chip, fit_label) are reused from bayes.py and the code
line from arrays.py rather than duplicated.

Semantic colors (reused across all parts so the eye learns them):
  PIXEL grid at rest        → INK_SUBTLE outline (neutral data)
  RED / GREEN / BLUE plane  → ROSE / EMERALD / ACCENT (the three channels)
  SHAPE dim being changed   → AMBER (the dim the current line reorders)
  RANGE / dtype value       → ACCENT (uint8), EMERALD (float 0..1), VIOLET (norm)
  MEAN / STD broadcast vec  → AMBER (the small per-channel stats)
  RESULT / tensor out       → EMERALD (what leaves the line)
"""

from __future__ import annotations

from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Text,
    Line,
    Arrow,
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
from arrays import code_line  # noqa: F401  (re-exported for cue scenes)

# Semantic role colors for the preprocessing story (shared across all parts).
C_PIXEL = INK_SUBTLE
C_RED = ROSE
C_GREEN = EMERALD
C_BLUE = ACCENT
C_SHAPE = AMBER
C_UINT8 = ACCENT
C_FLOAT = EMERALD
C_NORM = VIOLET
C_STAT = AMBER
C_RESULT = EMERALD

CHANNEL_COLORS = [C_RED, C_GREEN, C_BLUE]
CHANNEL_NAMES = ["R", "G", "B"]


# ─── the pixel grid (H × W value cells) ──────────────────────────────────────
def pixel_grid(rows_vals, cell=0.62, gap=0.06, color=C_PIXEL, fs=22,
               show_values=True, shade=False, maxv=255.0):
    """
    A 2-D grid of pixel cells — the image (or one channel). `rows_vals` is a list
    of rows, each a list of numbers/strings. Returns a VGroup with attributes:
      .cells  — 2-D list [r][c] of VGroup(box, text) for per-cell highlighting
      .boxes  — flat list of just the box mobjects
      .rows   — list of VGroup, one per grid row (for row highlighting)
      .nrows / .ncols — dimensions
    If `shade` is set, each cell's fill opacity is value/maxv (a grayscale image
    preview); otherwise cells share a light role fill. Centered at ORIGIN.
    """
    grid = VGroup()
    cells = []
    boxes = []
    row_groups = []
    nrows = len(rows_vals)
    ncols = max((len(r) for r in rows_vals), default=0)
    for r, rowv in enumerate(rows_vals):
        rowg = VGroup()
        crow = []
        for c, v in enumerate(rowv):
            if shade:
                op = 0.08 + 0.80 * (float(v) / maxv if maxv else 0.0)
                fill_op = max(0.06, min(0.92, op))
            else:
                fill_op = 0.12
            box = RoundedRectangle(
                width=cell, height=cell, corner_radius=0.06,
                stroke_color=color, stroke_width=1.8,
                fill_color=color, fill_opacity=fill_op,
            )
            box.move_to([c * (cell + gap), -r * (cell + gap), 0])
            if show_values:
                t = fit_label(str(v), cell - 0.14, fs, INK).move_to(box.get_center())
                cellg = VGroup(box, t)
            else:
                cellg = VGroup(box)
            rowg.add(cellg)
            crow.append(cellg)
            boxes.append(box)
        grid.add(rowg)
        cells.append(crow)
        row_groups.append(rowg)
    grid.move_to(ORIGIN)
    grid.cells = cells
    grid.boxes = boxes
    grid.rows = row_groups
    grid.nrows = nrows
    grid.ncols = ncols
    return grid


def recolor_pixel(cell, color, fill=0.30):
    """Recolor one pixel cell's box (cell[0]) to a semantic hue."""
    box = cell[0]
    box.set_stroke(color=color, width=2.6)
    box.set_fill(color=color, opacity=fill)
    return cell


# ─── the 3-plane channel stack (H × W × 3) ───────────────────────────────────
def channel_stack(nrows=3, ncols=3, cell=0.42, gap=0.05, offset=(0.42, 0.34),
                  colors=None, names=None, name_fs=24):
    """
    Three offset H×W plane grids drawn back-to-front (blue behind, green, red in
    front) to picture a color image as depth H×W×3. Returns a VGroup with:
      .planes — list of the 3 plane VGroups [front..back] = [R, G, B]
      .labels — list of the 3 channel-name labels
    The offset gives the isometric "stacked sheets" look. Centered at ORIGIN.
    """
    colors = colors or CHANNEL_COLORS
    names = names or CHANNEL_NAMES
    ox, oy = offset
    stack = VGroup()
    planes = []
    labels = []
    # back-to-front so the front (R) is drawn last / on top
    for k in reversed(range(3)):
        col = colors[k]
        plane = VGroup()
        for r in range(nrows):
            for c in range(ncols):
                sq = RoundedRectangle(
                    width=cell, height=cell, corner_radius=0.05,
                    stroke_color=col, stroke_width=1.6,
                    fill_color=col, fill_opacity=0.22,
                )
                sq.move_to([c * (cell + gap) + k * ox, -r * (cell + gap) + k * oy, 0])
                plane.add(sq)
        lab = Text(names[k], font_size=name_fs, color=col, weight="BOLD")
        lab.next_to(plane, UP, buff=0.12).shift(RIGHT * (k * ox))
        stack.add(plane, lab)
        planes.insert(0, plane)   # keep planes[0]=R … planes[2]=B
        labels.insert(0, lab)
    stack.move_to(ORIGIN)
    stack.planes = planes
    stack.labels = labels
    return stack


# ─── the tensor-shape tag  (H, W, C) ─────────────────────────────────────────
def shape_tag(dims, labels=None, color=C_SHAPE, w=1.5, h=1.15, gap=0.28,
              num_fs=32, lab_fs=20):
    """
    A tuple of dim chips like (224, 224, 3) with a role label under each dim
    (H / W / C / N). Returns a VGroup laid left→right with attributes:
      .dim_chips  — list of VGroup(box, number) per dim
      .dim_nums   — list of the number Text mobjects (Transform to change a size)
      .dim_labs   — list of the role Text labels
      .parens     — VGroup(open, close) parentheses framing the tuple
    Re-order .dim_chips (and re-arrange) to animate HWC→CHW→NCHW.
    """
    tag = VGroup()
    chips = []
    nums = []
    labs = []
    labels = labels or [None] * len(dims)
    for d, lab in zip(dims, labels):
        box = RoundedRectangle(
            width=w, height=h, corner_radius=0.12,
            stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.14,
        )
        num = fit_label(str(d), w - 0.24, num_fs, INK, weight="BOLD").move_to(box.get_center() + UP * 0.14)
        cg = VGroup(box, num)
        if lab:
            lt = Text(lab, font_size=lab_fs, color=INK_MUTED)
            lt.move_to(box.get_center() + DOWN * (h / 2 - 0.24))
            cg.add(lt)
            labs.append(lt)
        else:
            labs.append(None)
        chips.append(cg)
        nums.append(num)
    row = VGroup(*chips).arrange(RIGHT, buff=gap)
    lp = Text("(", font_size=num_fs + 18, color=INK_MUTED).next_to(row, LEFT, buff=0.18)
    rp = Text(")", font_size=num_fs + 18, color=INK_MUTED).next_to(row, RIGHT, buff=0.18)
    tag.add(lp, row, rp)
    tag.dim_chips = chips
    tag.dim_nums = nums
    tag.dim_labs = labs
    tag.parens = VGroup(lp, rp)
    tag.move_to(ORIGIN)
    return tag


# ─── value-range bar (uint8 0..255 → float 0..1 → normalized) ────────────────
def range_bar(lo, hi, marks, label=None, color=C_UINT8, width=6.4, y=0.0,
              lab_fs=22, tick_fs=20):
    """
    A horizontal number line from `lo` to `hi` with labelled tick marks — the
    dtype/range of the pixel values at a stage. `marks` is a list of (value,
    text) placed proportionally. Returns a VGroup with:
      .line      — the axis Line
      .ticks     — list of tick VGroup(tick, label)
      .caption   — the range caption (or None)
      .value_at(v) — helper method: the [x,y,0] point of value v on the axis
    """
    axis = Line([-width / 2, y, 0], [width / 2, y, 0], color=color, stroke_width=4)

    def value_at(v):
        frac = 0.0 if hi == lo else (v - lo) / (hi - lo)
        frac = max(0.0, min(1.0, frac))
        return [-width / 2 + frac * width, y, 0]

    grp = VGroup(axis)
    ticks = []
    for v, txt in marks:
        p = value_at(v)
        tk = Line([p[0], y - 0.14, 0], [p[0], y + 0.14, 0], color=INK_MUTED, stroke_width=3)
        tl = Text(txt, font_size=tick_fs, color=INK).next_to(tk, DOWN, buff=0.12)
        tg = VGroup(tk, tl)
        grp.add(tg)
        ticks.append(tg)
    caption = None
    if label:
        caption = Text(label, font_size=lab_fs, color=color, weight="BOLD").next_to(axis, UP, buff=0.22)
        grp.add(caption)
    grp.line = axis
    grp.ticks = ticks
    grp.caption = caption
    grp.value_at = value_at
    return grp


# ─── per-channel stat vector (mean / std) for broadcasting ───────────────────
def stat_vector(vals, label, color=C_STAT, cell=0.9, gap=0.12, fs=26, lab_fs=22,
                horizontal=True):
    """
    A short length-C vector of per-channel statistics (mean or std) shown as a
    strip of value cells with a name label. Returns VGroup with:
      .cells     — list of VGroup(box, text) per channel
      .name      — the label Text
    Used to show broadcasting: one length-3 vector applied across every pixel.
    """
    strip = VGroup()
    cells = []
    for v in vals:
        box = RoundedRectangle(
            width=cell, height=cell, corner_radius=0.10,
            stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.16,
        )
        t = fit_label(str(v), cell - 0.16, fs, INK).move_to(box.get_center())
        cg = VGroup(box, t)
        strip.add(cg)
        cells.append(cg)
    strip.arrange(RIGHT if horizontal else DOWN, buff=gap)
    name = Text(label, font_size=lab_fs, color=color, weight="BOLD")
    name.next_to(strip, LEFT if horizontal else UP, buff=0.3)
    grp = VGroup(name, strip)
    grp.cells = cells
    grp.name = name
    grp.strip = strip
    return grp


# ─── the seven-line code block (one line lit as discussed) ───────────────────
def code_block(lines, fs=24, color=INK, dim=INK_SUBTLE, gap=0.30, num=True,
               num_fs=18):
    """
    A stack of code lines (the seven-line pipeline). `lines` is a list of str.
    Returns a VGroup with attributes:
      .lines    — list of the line Text mobjects (dimmed at rest)
      .nums     — list of the line-number Texts (or [])
      .lit(i)   — returns the SurroundingRectangle to draw on line i
    All lines start dimmed; the cue scene un-dims + boxes the current line.
    """
    block = VGroup()
    line_ms = []
    nums = []
    for i, ln in enumerate(lines):
        t = Text(ln, font="monospace", font_size=fs, color=dim)
        line_ms.append(t)
        block.add(t)
    block.arrange(DOWN, aligned_edge=LEFT, buff=gap)
    if num:
        for i, t in enumerate(line_ms):
            n = Text(str(i + 1), font="monospace", font_size=num_fs, color=INK_SUBTLE)
            n.next_to(t, LEFT, buff=0.4)
            block.add(n)
            nums.append(n)

    def lit(i, boxcolor=ACCENT):
        return SurroundingRectangle(line_ms[i], color=boxcolor, buff=0.12, corner_radius=0.06)

    block.lines = line_ms
    block.nums = nums
    block.lit = lit
    return block


# ─── stage arrow (between pipeline boxes) ────────────────────────────────────
def stage_arrow(a, b, color=INK_MUTED, buff=0.28, label=None, lab_fs=20):
    """A labelled arrow from mobject a to mobject b (left→right handoff)."""
    arr = Arrow(a.get_right(), b.get_left(), buff=buff, color=color, stroke_width=5,
                max_tip_length_to_length_ratio=0.28)
    if label:
        lt = Text(label, font_size=lab_fs, color=INK_MUTED).next_to(arr, UP, buff=0.12)
        return VGroup(arr, lt)
    return VGroup(arr)
