"""
Reusable dynamic-programming visual idioms for Lesson 23 "Dynamic Programming
Reactivation: State, Recurrence, Order, Base" (acts 134 orientation / 135 Kadane
/ 136 0-1 Knapsack) and any future DP lesson (edit distance, LIS, coin change).

DP pedagogy is a story of a *table filled in a chosen order*: name the state,
write the recurrence, pick the fill order, set the base case. So the idioms here
make the table cells, the fill sweep, and the extend-or-restart / skip-or-take
transition the star. The dp array itself is just the arrays.py `value_row` (a
capacity- or index-labelled row of cells), so this module only adds what arrays
does not already cover:

  - decisions_ledger()  — the four-decisions checklist (state/recurrence/order/
    base), the spine of the orientation, with per-row highlight.
  - item_card()         — a knapsack item chip showing weight + value.
  - sweep_arrow()       — a horizontal arrow marking the fill direction
    (descending = use-once, ascending = reuse) over a dp row.
  - choice_pair()       — the two-way transition "restart vs extend" /
    "skip vs take" as two labelled option chips with a max() picker.

Everything honors theme.py (dark stage, site accent hues, safe-area guard) and
returns plain Manim mobjects the cue scenes stage / transform / highlight.
MathTex is reserved for the recurrence and the complexity bounds only.

Semantic colors (shared across all three parts so the eye learns them):
  DP cell at rest        → INK_SUBTLE outline (neutral table data)
  STATE / current cell   → ACCENT   (the cell we are filling now)
  TAKE / extend choice   → EMERALD  (the option that grows the answer)
  SKIP / restart choice  → AMBER    (the option that keeps / resets)
  ANSWER                 → EMERALD  (the winning cell / global best)
  DISCARDED / negative   → ROSE     (a losing option, a negative run)
"""

from __future__ import annotations

from manim import (
    VGroup,
    RoundedRectangle,
    Text,
    MathTex,
    Arrow,
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
    INK,
    INK_MUTED,
    INK_SUBTLE,
    LABEL_SIZE,
    BODY_SIZE,
)
from bayes import chip, fit_label  # noqa: F401  (re-exported for cue scenes)

# Semantic role colors for the DP story (shared across all parts).
C_REST = INK_SUBTLE     # a table cell not yet / no longer in focus
C_STATE = ACCENT        # the cell currently being filled
C_TAKE = EMERALD        # take / extend — the option that grows the answer
C_SKIP = AMBER          # skip / restart — the option that keeps or resets
C_ANSWER = EMERALD      # the winning cell / global best
C_DISCARD = ROSE        # a losing option / a negative running sum


# ─── the four-decisions ledger ───────────────────────────────────────────────
def decisions_ledger(rows=None, w=6.4, row_h=0.92, gap=0.22, fs=26, num=True):
    """
    The spine of every DP: a vertical checklist of the four decisions, in the
    fixed order the lesson drills. `rows` is a list of (title, detail) tuples;
    defaults to the canonical four. Returns a VGroup with attributes:
      .rows   — list of VGroup(box, text) one per decision (for highlight)
      .boxes  — list of just the box mobjects
    so a cue scene can Indicate / SurroundingRectangle decision k as the
    narration reaches it.
    """
    if rows is None:
        rows = [
            ("State", "what one cell means, exactly"),
            ("Recurrence", "how a cell is built from smaller cells"),
            ("Order", "fill smaller subproblems first"),
            ("Base", "the smallest cells, set directly"),
        ]
    group = VGroup()
    boxes = []
    row_grps = []
    for i, (title, detail) in enumerate(rows):
        box = RoundedRectangle(
            width=w, height=row_h, corner_radius=0.12,
            stroke_color=INK_SUBTLE, stroke_width=2.2,
            fill_color=INK_SUBTLE, fill_opacity=0.06,
        )
        num_txt = f"{i + 1}. " if num else ""
        head = Text(num_txt + title, font_size=fs, color=INK, weight="BOLD")
        det = fit_label(detail, w * 0.55, fs - 6, INK_MUTED)
        head.move_to(box.get_left() + RIGHT * (head.width / 2 + 0.28))
        det.next_to(head, RIGHT, buff=0.35)
        # keep the detail inside the box
        if det.get_right()[0] > box.get_right()[0] - 0.2:
            det.scale((box.get_right()[0] - 0.2 - head.get_right()[0]) / det.width)
            det.next_to(head, RIGHT, buff=0.35)
        rg = VGroup(box, head, det)
        rg.box = box
        group.add(rg)
        boxes.append(box)
        row_grps.append(rg)
    group.arrange(DOWN, buff=gap, aligned_edge=LEFT)
    group.rows = row_grps
    group.boxes = boxes
    return group


def highlight_decision(row, color=C_STATE, fill=0.18):
    """Recolor one ledger row's box to mark it active."""
    row.box.set_stroke(color=color, width=3.0)
    row.box.set_fill(color=color, opacity=fill)
    return row


# ─── knapsack item card (weight + value) ─────────────────────────────────────
def item_card(weight, value, name=None, color=ACCENT, w=2.1, h=1.25):
    """
    A knapsack item as a small card: an item name (optional), its weight and its
    value stacked. Returns VGroup with `.box`, `.w_text`, `.v_text` for
    highlight / transform. Weight is amber (a cost / capacity draw), value is
    emerald (the reward).
    """
    box = RoundedRectangle(
        width=w, height=h, corner_radius=0.12,
        stroke_color=color, stroke_width=2.6, fill_color=color, fill_opacity=0.10,
    )
    parts = VGroup()
    if name:
        nm = Text(name, font_size=22, color=INK, weight="BOLD")
        parts.add(nm)
    wt = Text(f"w = {weight}", font_size=22, color=AMBER, weight="BOLD")
    vl = Text(f"v = {value}", font_size=22, color=EMERALD, weight="BOLD")
    parts.add(wt, vl)
    parts.arrange(DOWN, buff=0.12)
    parts.move_to(box.get_center())
    card = VGroup(box, parts)
    card.box = box
    card.w_text = wt
    card.v_text = vl
    return card


# ─── fill-direction sweep arrow ──────────────────────────────────────────────
def sweep_arrow(row, descending=True, color=None, buff=0.55, label=None,
                label_fs=22):
    """
    A horizontal arrow above a dp `value_row` marking the fill direction:
    descending (high capacity → low) keeps each item use-once; ascending (low →
    high) lets an item repeat. Reads row.boxes for the span endpoints. Returns
    VGroup(arrow[, label]).
    """
    if color is None:
        color = AMBER if descending else EMERALD
    left_x = row.boxes[0].get_left()[0]
    right_x = row.boxes[-1].get_right()[0]
    y = row.get_top()[1] + buff
    if descending:
        start = [right_x, y, 0]
        end = [left_x, y, 0]
    else:
        start = [left_x, y, 0]
        end = [right_x, y, 0]
    arr = Arrow(start, end, color=color, stroke_width=5, buff=0.0,
                max_tip_length_to_length_ratio=0.05,
                max_stroke_width_to_length_ratio=3)
    grp = VGroup(arr)
    if label:
        lab = Text(label, font_size=label_fs, color=color, weight="BOLD")
        lab.next_to(arr, UP, buff=0.12)
        grp.add(lab)
    return grp


# ─── the two-way transition (restart vs extend / skip vs take) ───────────────
def choice_pair(opt_a, opt_b, color_a=C_SKIP, color_b=C_TAKE, w=3.7, h=1.0,
                gap=1.4, fs=25):
    """
    The either-or transition as two labelled option chips side by side with a
    'max' picker between them — the visual heart of a DP recurrence. `opt_a` is
    the keep/skip/restart option (amber), `opt_b` the extend/take option
    (emerald). Returns VGroup with `.a`, `.b`, `.picker` for highlight when the
    winner is chosen.
    """
    a = chip(opt_a, color=color_a, w=w, h=h, fs=fs)
    b = chip(opt_b, color=color_b, w=w, h=h, fs=fs)
    picker = Text("max", font_size=fs, color=INK_MUTED, weight="BOLD")
    a.move_to([-(w / 2 + gap / 2), 0, 0])
    b.move_to([(w / 2 + gap / 2), 0, 0])
    picker.move_to([0, 0, 0])
    grp = VGroup(a, picker, b)
    grp.a = a
    grp.b = b
    grp.picker = picker
    return grp
