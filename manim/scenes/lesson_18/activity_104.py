"""
Lesson 18 — Part 1 (activity 104): "Converging pointers" (94.9s, 6 short cues).

The concrete converging-pointer walkthrough behind the orientation's "converging
branch": a sorted row [1, 3, 4, 6, 8, 11], target 10. Left starts on the
smallest, right on the largest; each comparison of sum-vs-target advances
exactly one pointer inward, so the O(n²) all-pairs search collapses to a single
O(n) sweep. Sum sequence: 1+11=12 (drop right), 1+8=9 (push left), 3+8=11 (drop
right), 3+6=9 (push left), 4+6=10 (found at indices 2,3).

Uses the arrays.py idiom lib (value_row, pointer, value_badge, complexity) — the
array/pointer vocabulary, NOT the transformer / econ / Bayes idioms of other
lessons. MathTex is reserved for the one complexity bound at the end.

Cue00 0-17.3     Start at the ends: L=1, R=11, sum 12
Cue01 17.3-35.7  Too big (12 > 10): the largest is hopeless — retreat right
Cue02 35.7-54.6  Too small (9 < 10): advance left for a bigger value
Cue03 54.6-73.6  Zig-zag inward: 11 over → drop right, 9 under → push left
Cue04 73.6-86.3  Found it: 4 + 6 = 10 at indices 2 and 3
Cue05 86.3-94.9  Why linear: pointers only move inward, at most n steps → O(n)

Each cue stages its reveals with wait_until(scene, t); pace_to fills the tail so
the chunk length equals the cue window exactly (the render harness pins it).
"""

import theme
from theme import (
    AvoScene,
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
from pacing import pace_to, elapsed
from arrays import (
    value_row,
    recolor_cell,
    pointer,
    value_badge,
    complexity,
    C_LEFT,
    C_RIGHT,
    C_RESULT,
    C_ENTER,
)
from bayes import fit_label
from manim import (
    VGroup,
    Text,
    MathTex,
    FadeIn,
    FadeOut,
    Write,
    Transform,
    Indicate,
    Circumscribe,
    RIGHT,
    LEFT,
    UP,
    DOWN,
)

ARR = [1, 3, 4, 6, 8, 11]
TARGET = 10
ARR_Y = 0.9              # vertical center of the value row
SUM_POS = [0, -1.7, 0]   # sum readout below the row (centered)
TGT_POS = [5.05, 2.15, 0]  # target chip: upper-right, clear of the wide value row


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_array(index=True):
    row = value_row(ARR, w=0.92, h=0.92, fs=32, gap=0.20, index=index)
    row.move_to([0, ARR_Y, 0])
    return row


def sum_readout(l_idx, r_idx, color=INK):
    """A centered 'a + b = s' readout for the current pointer pair."""
    a, b = ARR[l_idx], ARR[r_idx]
    grp = MathTex(f"{a} + {b} = ", f"{a + b}", color=color).scale(1.0)
    grp[1].set_color(color)
    grp.move_to(SUM_POS)
    return grp


def target_chip():
    box = value_badge("target", TARGET, color=AMBER, w=2.6).move_to(TGT_POS)
    return box


# ─── Cue00 : start at the ends ───────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Widest pair first: L on 1, R on 11"
    cue_duration = 17.3

    def construct(self):
        row = build_array()
        self.play(FadeIn(row, shift=UP * 0.2), run_time=1.6)
        tgt = target_chip()
        self.play(FadeIn(tgt), run_time=0.8)
        wait_until(self, 4)

        lp = pointer(row.cells[0], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[5], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        self.play(FadeIn(lp), FadeIn(rp), run_time=1.4)
        recolor_cell(row.cells[0], C_LEFT)
        recolor_cell(row.cells[5], C_RIGHT)
        wait_until(self, 9)

        s = sum_readout(0, 5, color=INK)
        self.play(Write(s), run_time=1.4)
        note = fit_label("sorted low → high lets one comparison decide", 9.5, 22, INK_MUTED)
        note.to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(row, lp, rp, tgt, s, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : too big — drop the right ────────────────────────────────────────
class Cue01(AvoScene):
    headline = "12 > 10: the largest is hopeless"
    cue_duration = 18.4

    def construct(self):
        row = build_array()
        tgt = target_chip()
        lp = pointer(row.cells[0], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[5], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[0], C_LEFT)
        recolor_cell(row.cells[5], C_RIGHT)
        s = sum_readout(0, 5, color=ROSE)
        self.add(row, tgt, lp, rp, s)
        wait_until(self, 2)

        # 12 > 10 : any pair using 11 is at least 1+11 — all overshoot
        why = fit_label("11 with the smallest still overshoots — 11 can't be in the answer",
                        12.5, 22, ROSE).to_edge(DOWN, buff=0.6)
        self.play(Indicate(row.cells[5], color=ROSE, scale_factor=1.15), FadeIn(why), run_time=1.6)
        wait_until(self, 9)

        # retreat right : 5 → 4
        recolor_cell(row.cells[5], INK_SUBTLE)
        rp2 = pointer(row.cells[4], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[4], C_RIGHT)
        self.play(Transform(rp, rp2), run_time=1.4)
        s2 = sum_readout(0, 4, color=INK)
        self.play(Transform(s, s2), run_time=1.0)
        drop = Text("drop the right", font_size=22, color=ROSE, weight="BOLD").next_to(tgt, DOWN, buff=0.3)
        self.play(FadeIn(drop), run_time=1.0)
        self.guard(row, lp, rp, tgt, s, why)
        pace_to(self, self.cue_duration)


# ─── Cue02 : too small — push the left ───────────────────────────────────────
class Cue02(AvoScene):
    headline = "9 < 10: reach for a bigger value"
    cue_duration = 18.9

    def construct(self):
        row = build_array()
        tgt = target_chip()
        lp = pointer(row.cells[0], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[4], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[0], C_LEFT)
        recolor_cell(row.cells[4], C_RIGHT)
        s = sum_readout(0, 4, color=ACCENT)
        self.add(row, tgt, lp, rp, s)
        wait_until(self, 2)

        # 9 < 10 : the sum is under — only a bigger left can help
        why = fit_label("under target — the left value is too small to reach 10", 11.5, 22, ACCENT)
        why.to_edge(DOWN, buff=0.6)
        self.play(Indicate(row.cells[0], color=ACCENT, scale_factor=1.15), FadeIn(why), run_time=1.6)
        wait_until(self, 9)

        # advance left : 0 → 1
        recolor_cell(row.cells[0], INK_SUBTLE)
        lp2 = pointer(row.cells[1], "L", color=C_LEFT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[1], C_LEFT)
        self.play(Transform(lp, lp2), run_time=1.4)
        s2 = sum_readout(1, 4, color=INK)
        self.play(Transform(s, s2), run_time=1.0)
        push = Text("push the left", font_size=22, color=ACCENT, weight="BOLD").next_to(tgt, DOWN, buff=0.3)
        self.play(FadeIn(push), run_time=1.0)
        self.guard(row, lp, rp, tgt, s, why)
        pace_to(self, self.cue_duration)


# ─── Cue03 : zig-zag inward ──────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Each step kills a column"
    cue_duration = 19.0

    def construct(self):
        row = build_array()
        tgt = target_chip()
        lp = pointer(row.cells[1], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[4], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[1], C_LEFT)
        recolor_cell(row.cells[4], C_RIGHT)
        s = sum_readout(1, 4, color=ROSE)   # 3 + 8 = 11 (over)
        self.add(row, tgt, lp, rp, s)
        wait_until(self, 2)

        # 3 + 8 = 11 over → retreat right (4 → 3)
        over = Text("11 over → drop right", font_size=22, color=ROSE, weight="BOLD").to_edge(DOWN, buff=0.6)
        self.play(FadeIn(over), Indicate(row.cells[4], color=ROSE, scale_factor=1.12), run_time=1.4)
        recolor_cell(row.cells[4], INK_SUBTLE)
        rp2 = pointer(row.cells[3], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[3], C_RIGHT)
        self.play(Transform(rp, rp2), run_time=1.2)
        s2 = sum_readout(1, 3, color=ACCENT)  # 3 + 6 = 9 (under)
        self.play(Transform(s, s2), run_time=1.0)
        wait_until(self, 10)

        # 3 + 6 = 9 under → advance left (1 → 2)
        under = Text("9 under → push left", font_size=22, color=ACCENT, weight="BOLD").to_edge(DOWN, buff=0.6)
        self.play(FadeOut(over), FadeIn(under), Indicate(row.cells[1], color=ACCENT, scale_factor=1.12),
                  run_time=1.4)
        recolor_cell(row.cells[1], INK_SUBTLE)
        lp2 = pointer(row.cells[2], "L", color=C_LEFT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[2], C_LEFT)
        self.play(Transform(lp, lp2), run_time=1.2)
        s3 = sum_readout(2, 3, color=INK)     # 4 + 6 = 10 (about to be found)
        self.play(Transform(s, s3), run_time=1.0)
        conv = fit_label("pointers converge — never rescan a killed column", 11.0, 21, INK_MUTED)
        conv.next_to(under, UP, buff=0.3)
        self.play(FadeIn(conv), run_time=1.0)
        self.guard(row, lp, rp, tgt, s, under)
        pace_to(self, self.cue_duration)


# ─── Cue04 : found it ────────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Found it: 4 + 6 = 10"
    cue_duration = 12.7

    def construct(self):
        row = build_array()
        tgt = target_chip()
        lp = pointer(row.cells[2], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[3], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[2], EMERALD)
        recolor_cell(row.cells[3], EMERALD)
        self.add(row, tgt, lp, rp)
        wait_until(self, 1.5)

        s = MathTex(r"4 + 6 = ", "10", color=INK).scale(1.15).move_to(SUM_POS)
        s[1].set_color(EMERALD)
        self.play(Write(s), run_time=1.4)
        self.play(Circumscribe(VGroup(row.cells[2], row.cells[3]), color=EMERALD), run_time=1.4)
        wait_until(self, 7)

        idxs = Text("indices 2 and 3 — the pair meets the target", font_size=23, color=EMERALD)
        idxs.to_edge(DOWN, buff=0.7)
        self.play(FadeIn(idxs), run_time=1.2)
        self.guard(row, lp, rp, tgt, s, idxs)
        pace_to(self, self.cue_duration)


# ─── Cue05 : why linear ──────────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Pointers only move inward → O(n)"
    cue_duration = 8.6

    def construct(self):
        row = build_array(index=False)
        self.add(row)
        wait_until(self, 1.0)

        line = fit_label("each pointer takes at most n steps and they never rescan",
                         12.0, 23, INK).move_to([0, -1.4, 0])
        self.play(FadeIn(line), run_time=1.2)
        contrast = MathTex(r"O(n^2)\ \text{all pairs} \;\longrightarrow\; ", "O(n)",
                           color=INK).scale(0.95).to_edge(DOWN, buff=0.7)
        contrast[1].set_color(EMERALD)
        self.play(Write(contrast), run_time=1.4)
        self.play(Circumscribe(contrast[1], color=EMERALD), run_time=1.2)
        self.guard(row, line, contrast)
        pace_to(self, self.cue_duration)
