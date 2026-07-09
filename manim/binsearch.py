"""
Reusable "binary search on the answer" visual idioms (Lesson 26, acts
152 / 153 / 154, and any future search-the-answer-space lesson).

The whole pattern is one picture: a range [lo..hi] of *candidate answers* and a
boolean feasibility oracle can(candidate) that is MONOTONIC — for a lower search
the predicate is all-✗ then all-✓ (find the first feasible), for an upper search
it is all-✓ then all-✗ (find the last feasible). Binary search collapses the
range onto the boundary between the two regions, and that boundary IS the answer.
So the idioms make the *candidate range + monotonic ✓/✗ predicate + lo/mid/hi
narrowing + boundary* the star. MathTex is reserved for the complexity bounds.

Visual vocabulary (distinct from arrays / graph / transformer idioms):
  candidate cell at rest    → INK_SUBTLE outline (untested candidate)
  INFEASIBLE candidate (✗)  → ROSE
  FEASIBLE candidate (✓)    → EMERALD
  lo pointer                → AMBER
  hi pointer                → ROSE
  mid pointer (probing)     → ACCENT
  boundary / answer         → EMERALD ring

Reuses value_row / recolor_cell / complexity / code_line from arrays.py and
chip / fit_label from bayes.py rather than duplicating primitives.
"""

from __future__ import annotations

from manim import (
    VGroup,
    Text,
    SurroundingRectangle,
    Arrow,
    Line,
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
)
from arrays import value_row, recolor_cell, complexity, code_line, pointer  # noqa: F401
from bayes import chip, fit_label  # noqa: F401  (re-exported for cue scenes)

# Semantic role colors for the binary-search-on-answer story.
C_REST = INK_SUBTLE
C_INFEASIBLE = ROSE
C_FEASIBLE = EMERALD
C_LO = AMBER
C_HI = ROSE
C_MID = ACCENT
C_ANSWER = EMERALD


def candidate_row(values, feasible=None, w=0.92, h=0.82, fs=26, gap=0.12,
                  index=False):
    """
    A row of candidate-answer cells (an arrays.value_row) with an optional
    feasibility badge row below each cell: ✓ (emerald) where can(candidate) is
    true, ✗ (rose) where false. `feasible` is a list of bools the same length as
    `values` (or None to draw the bare range with no badges yet).

    Returns a VGroup(row[, badges…]) with attributes:
      .row     — the value_row (has .cells / .boxes for highlighting / pointers)
      .badges  — list of the ✓/✗ Text mobjects, aligned under each cell (or [])
    """
    row = value_row(values, w=w, h=h, fs=fs, gap=gap, index=index)
    grp = VGroup(row)
    badges = []
    if feasible is not None:
        for i, ok in enumerate(feasible):
            sym = "✓" if ok else "✗"           # ✓ / ✗
            col = C_FEASIBLE if ok else C_INFEASIBLE
            b = Text(sym, font_size=fs + 4, color=col, weight="BOLD")
            b.next_to(row.cells[i], DOWN, buff=0.18)
            grp.add(b)
            badges.append(b)
    grp.row = row
    grp.badges = badges
    return grp


def paint_feasibility(cand, feasible, fill=0.20):
    """Recolor each candidate cell by its feasibility (emerald ✓ / rose ✗)."""
    for i, ok in enumerate(feasible):
        recolor_cell(cand.row.cells[i], C_FEASIBLE if ok else C_INFEASIBLE,
                     fill=fill)
    return cand


def lohi_pointers(cand, lo, hi, mid=None, side=UP, gap=0.8, fs=22):
    """
    lo (amber) and hi (rose) pointers on cells `lo` / `hi` from the `side`
    direction, plus an optional mid (accent) pointer on the opposite side so the
    three never collide. Returns a VGroup laid out with arrays.pointer. Rebuild
    (FadeOut old, FadeIn new) as the range narrows rather than mutating.
    """
    opp = DOWN if side is UP else UP
    out = VGroup()
    out.add(pointer(cand.row.cells[lo], "lo", color=C_LO, side=side, gap=gap, fs=fs))
    out.add(pointer(cand.row.cells[hi], "hi", color=C_HI, side=side, gap=gap, fs=fs))
    if mid is not None:
        out.add(pointer(cand.row.cells[mid], "mid", color=C_MID, side=opp,
                        gap=gap, fs=fs))
    return out


def boundary_ring(cell, color=C_ANSWER):
    """An emerald ring around the boundary (answer) candidate cell."""
    ring = SurroundingRectangle(cell, color=color, buff=0.12, corner_radius=0.10)
    ring.set_stroke(width=4.2)
    return ring


def region_brace(cand, lo, hi, label, color, fs=22, side=UP, buff=0.2):
    """
    A thin bracket line spanning candidate cells lo..hi with a label — used to
    shade the "infeasible" vs "feasible" halves of the monotonic range.
    Returns VGroup(line, label).
    """
    left = cand.row.cells[lo].get_edge_center(LEFT)
    right = cand.row.cells[hi].get_edge_center(RIGHT)
    y = cand.row.get_edge_center(side)[1] + (buff if side is UP else -buff)
    line = Line([left[0], y, 0], [right[0], y, 0], color=color, stroke_width=5)
    lab = Text(label, font_size=fs, color=color, weight="BOLD")
    lab.next_to(line, side, buff=0.12)
    return VGroup(line, lab)
