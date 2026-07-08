"""
Reusable transformer visual idioms for Lesson 7
("Inside the Transformer: From Token IDs to Next-Token Logits", acts 38/39/40/41).

3Blue1Brown-style building blocks shared across the four Lesson-7 segments so
each cue scene composes from a consistent vocabulary rather than re-inventing
shapes. The visual vocabulary is *transformer-specific* (token-ID rows,
embedding table + rows, the L×D hidden-state matrix, the attention score grid,
the residual/attention/MLP block pipeline, vocabulary logit bars, a next-token
ranking list) — deliberately NOT the Bayes / econ idioms used by other lessons.

Every helper honors theme.py (dark stage, site accent hues, safe-area guard) and
returns plain VGroups the cue scenes stage, transform, and highlight. The two
truly generic text/box helpers (chip, fit_label) are reused from bayes.py rather
than duplicated.

Semantic colors (reused across all four parts so the eye learns them):
  TOKEN / text            → VIOLET  (human-readable text pieces)
  ID / integer address    → AMBER   (the integer IDs / addresses)
  EMBEDDING / hidden H     → ACCENT  (model-owned numeric state, the stream)
  ATTENTION delta          → AMBER   (cross-token context mixing)
  MLP delta                → EMERALD (per-row feature update)
  RESIDUAL / add           → VIOLET  (the highway that preserves the signal)
  LOGITS / result          → EMERALD (vocabulary scores / the answer)
"""

from __future__ import annotations

from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Square,
    Text,
    MathTex,
    Line,
    Arrow,
    Circle,
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
    BG,
    LABEL_SIZE,
    BODY_SIZE,
)
# Reuse the generic text/box helpers (DRY — same as lesson_2 orientation reuses bayes).
from bayes import chip, fit_label  # noqa: F401  (re-exported for cue scenes)

# Semantic role colors for the transformer story (shared across all four parts).
C_TOKEN = VIOLET
C_ID = AMBER
C_EMBED = ACCENT
C_ATTN = AMBER
C_MLP = EMERALD
C_RESID = VIOLET
C_LOGIT = EMERALD


# ─── token pieces + integer-ID boxes ─────────────────────────────────────────
def token_row(pieces, color=C_TOKEN, w=1.5, h=0.7, fs=24, gap=0.18):
    """A horizontal row of text-piece chips (the tokenizer's output pieces)."""
    row = VGroup()
    for p in pieces:
        box = RoundedRectangle(
            width=w, height=h, corner_radius=0.1,
            stroke_color=color, stroke_width=2.2, fill_color=color, fill_opacity=0.14,
        )
        t = fit_label(p, w - 0.2, fs, INK).move_to(box.get_center())
        row.add(VGroup(box, t))
    row.arrange(RIGHT, buff=gap)
    return row


def id_boxes(ids, color=C_ID, w=0.95, h=0.8, fs=26, gap=0.16, vertical=False):
    """
    A row (or column, if vertical=True) of integer-ID boxes. `ids` is a list of
    ints. A vertical column is handy on the left, aligned with embedding rows.
    """
    row = VGroup()
    for n in ids:
        box = RoundedRectangle(
            width=w, height=h, corner_radius=0.09,
            stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.16,
        )
        t = Text(str(n), font_size=fs, color=INK).move_to(box.get_center())
        row.add(VGroup(box, t))
    row.arrange(DOWN if vertical else RIGHT, buff=gap)
    return row


# ─── embedding table (vocab rows × d_model cols) ─────────────────────────────
def embedding_table(row_ids, cols=6, cell=0.3, gap=0.05, color=C_EMBED,
                    id_color=C_ID, fs=20):
    """
    A learned embedding table: one labeled row per vocab ID in `row_ids`, each
    row a strip of `cols` value-cells. Returns a VGroup with attributes:
      .rows  — list of VGroup (each the row's cells)
      .labels— list of the id Text labels (to the left of each row)
    so scenes can highlight "fetch row 44".
    """
    table = VGroup()
    rows = []
    labels = []
    for i, rid in enumerate(row_ids):
        cells = VGroup()
        for c in range(cols):
            sq = RoundedRectangle(
                width=cell, height=cell, corner_radius=0.04,
                stroke_color=color, stroke_width=1.3,
                fill_color=color, fill_opacity=0.16,
            )
            sq.move_to([c * (cell + gap), 0, 0])
            cells.add(sq)
        cells.move_to([0, -i * (cell + gap + 0.12), 0])
        lbl = Text(f"id {rid}", font_size=fs, color=id_color)
        lbl.next_to(cells, LEFT, buff=0.28)
        table.add(cells, lbl)
        rows.append(cells)
        labels.append(lbl)
    table.move_to(ORIGIN)
    table.rows = rows
    table.labels = labels
    return table


def vector_strip(n=6, color=C_EMBED, cell=0.34, gap=0.06, horizontal=True):
    """A single embedding vector as a strip of `n` value-cells."""
    strip = VGroup()
    for i in range(n):
        sq = RoundedRectangle(
            width=cell, height=cell, corner_radius=0.05,
            stroke_color=color, stroke_width=1.6, fill_color=color, fill_opacity=0.2,
        )
        strip.add(sq)
    strip.arrange(RIGHT if horizontal else DOWN, buff=gap)
    return strip


# ─── the L × D hidden-state matrix ───────────────────────────────────────────
def hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.36, gap=0.07,
                  row_labels=None):
    """
    The hidden-state matrix H as a grid of rounded cells (rows = token
    positions, cols = hidden features). Returns a VGroup with:
      .cell_rows — list of VGroup, one per token row (for row highlighting)
      .grid      — the flat VGroup of all cells
    Optional `row_labels` (list of str) are placed to the left of each row.
    """
    grid = VGroup()
    cell_rows = []
    for r in range(rows):
        rowg = VGroup()
        for c in range(cols):
            sq = RoundedRectangle(
                width=cell, height=cell, corner_radius=0.05,
                stroke_color=color, stroke_width=1.5,
                fill_color=color, fill_opacity=0.18,
            )
            sq.move_to([c * (cell + gap), -r * (cell + gap), 0])
            rowg.add(sq)
        grid.add(rowg)
        cell_rows.append(rowg)
    grid.move_to(ORIGIN)
    grid.cell_rows = cell_rows
    if row_labels:
        for rowg, lab in zip(cell_rows, row_labels):
            t = Text(lab, font_size=18, color=INK_MUTED)
            t.next_to(rowg, LEFT, buff=0.22)
            grid.add(t)
    return grid


# ─── attention score grid (L × L) ────────────────────────────────────────────
def attention_grid(L=4, weights=None, cell=0.6, gap=0.06, color=C_ATTN,
                   labels=None):
    """
    An L×L attention score heatmap: rows = query token, cols = key token; cell
    fill opacity encodes attention weight. `weights` is an optional L×L list of
    floats in [0,1]; default is a lower-triangular causal pattern. Returns a
    VGroup with .cells (row-major flat list) and .cell_grid (list of rows).
    """
    if weights is None:
        weights = [[(0.85 if c <= r else 0.0) for c in range(L)] for r in range(L)]
    grid = VGroup()
    cell_grid = []
    cells = []
    for r in range(L):
        rowg = VGroup()
        for c in range(L):
            w = weights[r][c]
            sq = Square(side_length=cell, stroke_color=INK_SUBTLE, stroke_width=1.2,
                        fill_color=color, fill_opacity=max(0.05, w))
            sq.move_to([c * (cell + gap), -r * (cell + gap), 0])
            rowg.add(sq)
            cells.append(sq)
        grid.add(rowg)
        cell_grid.append(rowg)
    grid.move_to(ORIGIN)
    grid.cells = cells
    grid.cell_grid = cell_grid
    return grid


# ─── vocabulary logit bars + ranking ─────────────────────────────────────────
def logit_bars(items, max_h=2.6, bar_w=0.9, gap=0.4, color=C_LOGIT,
               top_color=EMERALD, fs=20):
    """
    A vocabulary logit bar chart. `items` is a list of (label, value) with
    value the raw logit (can be negative). Bars scaled to the max |value|.
    The single tallest bar is drawn in `top_color`. Returns a VGroup with
    .bars (list) and .labels (list) for highlighting the winner.
    """
    vals = [v for _, v in items]
    lo = min(vals)
    hi = max(vals)
    span = (hi - lo) or 1.0
    chart = VGroup()
    bars = []
    labels = []
    top_i = vals.index(hi)
    for i, (name, v) in enumerate(items):
        frac = (v - lo) / span
        h = max(0.08, frac * max_h)
        col = top_color if i == top_i else color
        bar = Rectangle(width=bar_w, height=h, stroke_width=0,
                        fill_color=col, fill_opacity=0.9 if i == top_i else 0.5)
        bar.move_to([i * (bar_w + gap), h / 2, 0])
        lab = Text(name, font_size=fs, color=INK if i == top_i else INK_MUTED)
        lab.next_to(bar, DOWN, buff=0.18)
        chart.add(bar, lab)
        bars.append(bar)
        labels.append(lab)
    chart.move_to(ORIGIN)
    chart.bars = bars
    chart.labels = labels
    chart.top_index = top_i
    return chart


def ranking_list(items, fs=24, gap=0.42, color=C_LOGIT):
    """
    A next-token ranking list: `items` is an ordered list of (token, prob_str).
    The top row is drawn in `color`; the rest muted. Returns a VGroup with
    .rows for highlighting.
    """
    lst = VGroup()
    rows = []
    for i, (tok, p) in enumerate(items):
        rank = Text(f"{i+1}.", font_size=fs, color=INK_SUBTLE)
        name = Text(tok, font_size=fs, color=INK if i == 0 else INK_MUTED, weight="BOLD" if i == 0 else "NORMAL")
        prob = Text(p, font_size=fs, color=color if i == 0 else INK_MUTED)
        name.next_to(rank, RIGHT, buff=0.3)
        prob.next_to(name, RIGHT, buff=0.6)
        row = VGroup(rank, name, prob)
        lst.add(row)
        rows.append(row)
    lst.arrange(DOWN, buff=gap, aligned_edge=LEFT)
    lst.rows = rows
    return lst


# ─── the transformer block pipeline (vertical stages) ────────────────────────
def block_pipeline(scale=1.0, fs=20):
    """
    The transformer block as a vertical pipeline of labeled stages, matching the
    residual-stream mental model:

        Input H
          │ (residual highway kept)
        LayerNorm → Attention →  ⊕ add
          │ (residual highway kept)
        LayerNorm → MLP →  ⊕ add
          │
        Output H   (same L×D shape)

    Returns a VGroup with a `.stage` dict keyed by name:
      'in', 'ln1', 'attn', 'add1', 'ln2', 'mlp', 'add2', 'out', 'spine'
    so cue scenes can highlight the currently-active moving part.
    """
    def stage_box(label, color, w=3.4, h=0.72):
        box = RoundedRectangle(width=w, height=h, corner_radius=0.12,
                               stroke_color=color, stroke_width=2.4,
                               fill_color=color, fill_opacity=0.14)
        t = fit_label(label, w - 0.3, fs, INK).move_to(box.get_center())
        return VGroup(box, t)

    def add_node(color=C_RESID, r=0.24):
        c = Circle(radius=r, stroke_color=color, stroke_width=2.6, fill_color=BG, fill_opacity=1)
        p = Text("+", font_size=28, color=color).move_to(c.get_center())
        return VGroup(c, p)

    stage = {}
    stage['in'] = stage_box("Input H  (L × D)", C_EMBED)
    stage['ln1'] = stage_box("LayerNorm", VIOLET, w=2.4)
    stage['attn'] = stage_box("Attention (mix positions)", C_ATTN)
    stage['add1'] = add_node(C_RESID)
    stage['ln2'] = stage_box("LayerNorm", VIOLET, w=2.4)
    stage['mlp'] = stage_box("MLP (per-row features)", C_MLP)
    stage['add2'] = add_node(C_RESID)
    stage['out'] = stage_box("Output H  (L × D)", C_EMBED)

    col = VGroup(
        stage['in'], stage['ln1'], stage['attn'], stage['add1'],
        stage['ln2'], stage['mlp'], stage['add2'], stage['out'],
    ).arrange(DOWN, buff=0.26)

    # connecting arrows down the main column
    arrows = VGroup()
    order = ['in', 'ln1', 'attn', 'add1', 'ln2', 'mlp', 'add2', 'out']
    for a, b in zip(order[:-1], order[1:]):
        arrows.add(Arrow(stage[a].get_bottom(), stage[b].get_top(), buff=0.05,
                         color=INK_SUBTLE, stroke_width=3, max_tip_length_to_length_ratio=0.18))

    # residual highway: input → add1, add1 → add2 (the "highway" that preserves signal)
    x = col.get_left()[0] - 0.55
    spine = VGroup(
        Line([x, stage['in'].get_center()[1], 0], [x, stage['add1'].get_center()[1], 0],
             color=C_RESID, stroke_width=4),
        Line(stage['in'].get_left(), [x, stage['in'].get_center()[1], 0], color=C_RESID, stroke_width=4),
        Arrow([x, stage['add1'].get_center()[1], 0], stage['add1'].get_left(), buff=0.02,
              color=C_RESID, stroke_width=4, max_tip_length_to_length_ratio=0.4),
    )
    x2 = col.get_left()[0] - 0.9
    spine2 = VGroup(
        Line([x2, stage['add1'].get_center()[1], 0], [x2, stage['add2'].get_center()[1], 0],
             color=C_RESID, stroke_width=4),
        Line(stage['add1'].get_left(), [x2, stage['add1'].get_center()[1], 0], color=C_RESID, stroke_width=4),
        Arrow([x2, stage['add2'].get_center()[1], 0], stage['add2'].get_left(), buff=0.02,
              color=C_RESID, stroke_width=4, max_tip_length_to_length_ratio=0.4),
    )

    group = VGroup(col, arrows, spine, spine2)
    if scale != 1.0:
        group.scale(scale)
    group.stage = stage
    group.arrows = arrows
    group.spine = VGroup(spine, spine2)
    group.move_to(ORIGIN)
    return group


def mini_pipeline(active=None, scale=0.5, dim=0.28):
    """
    A compact "you-are-here" minimap of the transformer block for the act-41
    walkthrough: the full block_pipeline scaled down, with every stage dimmed
    except `active` (a stage key, or 'spine' to light the residual highway).
    Returns the block_pipeline VGroup (with its .stage dict) so the caller can
    also read stage centers for pointer arrows.
    """
    bp = block_pipeline(scale=scale)
    stage = bp.stage
    for k, m in stage.items():
        m.set_opacity(dim)
    bp.spine.set_opacity(dim)
    bp.arrows.set_opacity(dim)
    if active == 'spine':
        bp.spine.set_opacity(1.0)
    elif active in stage:
        stage[active].set_opacity(1.0)
    return bp
