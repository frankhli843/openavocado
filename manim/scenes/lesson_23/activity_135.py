"""
Lesson 23 — Part 1 (activity 135): "Kadane — a 1D running scalar" (73.34s, 6
short cues).

The concrete Kadane walkthrough behind the orientation's "a running scalar,
extend or restart." Classic array [-2, 1, -3, 4, -1, 2, 1, -5, 4] (LeetCode 53).
best_here is the largest sum of a contiguous run ending EXACTLY at i; at each
step it either restarts from the current element or extends the previous run —
whichever is larger:

  i:        0    1    2    3    4    5    6    7    8
  x:       -2    1   -3    4   -1    2    1   -5    4
  best_here:-2    1   -2    4    3    5    6    1    5
  best:    -2    1    1    4    4    5    6    6    6

The winning subarray is [4, -1, 2, 1] (indices 3..6) summing to 6, found the
moment best_here reaches 6. Only the previous best_here is needed, so two
scalars carry the whole computation → O(n) time, O(1) space.

Uses the arrays.py idiom lib (value_row, recolor_cell, value_badge, complexity)
plus dp.py (choice_pair, C_STATE/C_TAKE/C_SKIP/C_ANSWER/C_DISCARD) — the array
+ running-scalar vocabulary, NOT the transformer / econ idioms. MathTex is
reserved for the recurrence and the one complexity bound.

Cue00 0-13.3    best_here = best run ending exactly at i
Cue01 13.3-27.6 the transition: max of restart(x) or extend(prev + x)
Cue02 27.6-42.2 a negative running sum resets automatically
Cue03 42.2-56.9 the answer is the global max of best_here
Cue04 56.9-66.7 the winning run [4,-1,2,1] = 6
Cue05 66.7-73.3 two scalars, one pass → O(n) / O(1)
"""

import theme
from theme import (
    AvoScene,
    ACCENT,
    AMBER,
    EMERALD,
    ROSE,
    VIOLET,
    INK,
    INK_MUTED,
    INK_SUBTLE,
)
from pacing import pace_to, elapsed
from arrays import value_row, recolor_cell, value_badge, complexity, window_bracket
from dp import choice_pair, C_STATE, C_TAKE, C_SKIP, C_ANSWER, C_DISCARD
from bayes import fit_label
from manim import (
    VGroup,
    Text,
    MathTex,
    Arrow,
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

ARR = [-2, 1, -3, 4, -1, 2, 1, -5, 4]
BEST_HERE = [-2, 1, -2, 4, 3, 5, 6, 1, 5]
BEST = [-2, 1, 1, 4, 4, 5, 6, 6, 6]
ARR_Y = 1.35
BH_Y = 0.05
CW = 0.86
GAP = 0.16


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_array(highlight_i=None):
    row = value_row(ARR, w=CW, h=CW, fs=28, gap=GAP, index=True)
    row.move_to([0, ARR_Y, 0])
    lab = Text("nums", font_size=20, color=INK_MUTED).next_to(row, LEFT, buff=0.28)
    if highlight_i is not None:
        recolor_cell(row.cells[highlight_i], C_STATE)
    return row, lab


def bh_row(upto):
    """best_here values filled for indices 0..upto (inclusive), '·' after."""
    vals = [str(BEST_HERE[i]) if i <= upto else "·" for i in range(len(ARR))]
    row = value_row(vals, color=INK_SUBTLE, w=CW, h=0.68, fs=24, gap=GAP, index=False)
    row.move_to([0, BH_Y, 0])
    lab = Text("best_here", font_size=20, color=INK_MUTED).next_to(row, LEFT, buff=0.28)
    return row, lab


# ─── Cue00 : the state ───────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "best_here: the best run ending exactly at i"
    cue_duration = 13.3

    def construct(self):
        row, lab = build_array()
        self.play(FadeIn(row, shift=UP * 0.2), FadeIn(lab), run_time=1.6)
        wait_until(self, 3.0)

        # spotlight one index i and the contiguous run that ENDS there
        i = 6
        recolor_cell(row.cells[i], C_STATE)
        brk = window_bracket(row, 3, i, color=C_STATE, label="a run ending at i")
        self.play(FadeIn(brk), Indicate(row.cells[i], color=C_STATE), run_time=1.6)
        wait_until(self, 7.5)

        badge = value_badge("best_here", "?", color=C_STATE, w=3.6, h=1.0)
        badge.move_to([0, -1.7, 0])
        self.play(FadeIn(badge), run_time=1.0)
        note = fit_label("largest sum of a contiguous run that ENDS at the current index",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(row, brk, badge, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : extend or restart ───────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Extend or restart — the max of two choices"
    cue_duration = 14.3

    def construct(self):
        row, lab = build_array()
        self.add(row, lab)
        wait_until(self, 1.5)

        rec = MathTex(
            r"\text{best\_here}_i", r"=\max\big(", r"x_i", r",\;",
            r"\text{best\_here}_{i-1} + x_i", r"\big)",
        ).scale(0.9).move_to([0, 0.55, 0])
        rec.move_to([0, 0.15, 0])
        rec[2].set_color(C_SKIP)      # x_i alone → restart
        rec[4].set_color(C_TAKE)      # prev + x_i → extend
        self.play(Write(rec), run_time=2.0)
        wait_until(self, 6.0)

        pair = choice_pair("restart:  x", "extend:  prev + x").scale(0.92)
        pair.move_to([0, -1.75, 0])
        self.play(FadeIn(pair.a), FadeIn(pair.picker), FadeIn(pair.b), run_time=1.6)
        self.play(
            Indicate(rec[2], color=C_SKIP, scale_factor=1.15),
            Indicate(pair.a, color=C_SKIP),
            run_time=1.2,
        )
        self.play(
            Indicate(rec[4], color=C_TAKE, scale_factor=1.15),
            Indicate(pair.b, color=C_TAKE),
            run_time=1.2,
        )
        self.guard(row, rec, pair)
        pace_to(self, self.cue_duration)


# ─── Cue02 : negatives reset ─────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "A negative running sum resets automatically"
    cue_duration = 14.6

    def construct(self):
        # focus on i=3 (x=4): prev best_here[2] = -2 (negative) → restart wins
        row, lab = build_array()
        recolor_cell(row.cells[2], C_DISCARD)
        recolor_cell(row.cells[3], C_STATE)
        self.add(row, lab)
        prev = value_badge("prev best_here", "−2", color=C_DISCARD, w=4.6, h=0.9, val_fs=30)
        prev.move_to([0, 0.05, 0])
        self.add(prev)
        wait_until(self, 2.0)

        note = fit_label("the previous run is negative — dragging it along only hurts", 12.0, 23, ROSE)
        note.to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), Indicate(prev, color=ROSE, scale_factor=1.05), run_time=1.6)
        wait_until(self, 6.5)

        # compare the two options at i=3
        compare = MathTex(
            r"\max\big(", r"4", r",\;", r"-2 + 4 = 2", r"\big) = ", r"4",
        ).scale(0.9).move_to([0, -1.15, 0])
        compare[1].set_color(C_TAKE)      # restart-from-4 wins
        compare[3].set_color(C_DISCARD)   # extend gives only 2
        compare[5].set_color(C_ANSWER)
        self.play(Write(compare), run_time=1.8)
        wait_until(self, 11.0)

        restart = fit_label("restart from 4 → the negative prefix is abandoned", 12.0, 23, EMERALD)
        restart.to_edge(DOWN, buff=0.5)
        self.play(FadeOut(note), FadeIn(restart), Circumscribe(compare[5], color=EMERALD), run_time=1.4)
        self.guard(row, prev, compare, restart)
        pace_to(self, self.cue_duration)


# ─── Cue03 : track the best ──────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "The answer is the global max of best_here"
    cue_duration = 14.7

    def construct(self):
        row, lab = build_array()
        self.add(row, lab)
        brow, blab = bh_row(len(ARR) - 1)
        self.play(FadeIn(brow), FadeIn(blab), run_time=1.4)
        wait_until(self, 4.0)

        best = value_badge("best", "6", color=C_ANSWER, w=3.2, h=1.0)
        best.move_to([0, -1.75, 0])
        self.play(FadeIn(best), run_time=1.0)
        # point at the peak best_here (index 6 = 6)
        recolor_cell(brow.cells[6], C_ANSWER)
        arrow = Arrow(best.get_top(), brow.cells[6].get_bottom(), color=C_ANSWER,
                      stroke_width=4, buff=0.12, max_tip_length_to_length_ratio=0.18)
        self.play(FadeIn(arrow), Indicate(brow.cells[6], color=C_ANSWER, scale_factor=1.15), run_time=1.6)
        note = fit_label("keep the largest best_here ever seen — the optimal run ends somewhere",
                         12.8, 21, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(row, brow, best, arrow, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the winner ──────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "The winning run [4, −1, 2, 1] = 6"
    cue_duration = 9.8

    def construct(self):
        row, lab = build_array()
        self.add(row, lab)
        wait_until(self, 1.0)

        # spotlight the answer window indices 3..6
        for i in range(3, 7):
            recolor_cell(row.cells[i], C_ANSWER)
        brk = window_bracket(row, 3, 6, color=C_ANSWER, label="4 + (−1) + 2 + 1 = 6")
        self.play(FadeIn(brk), run_time=1.4)
        best = value_badge("best", "6", color=C_ANSWER, w=3.0, h=1.0).move_to([0, -1.8, 0])
        self.play(FadeIn(best), Circumscribe(best, color=EMERALD), run_time=1.6)
        note = fit_label("found the moment best_here first reaches 6", 11.0, 22, INK_MUTED)
        note.to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(row, brk, best, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : constant space ──────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Two scalars, one pass"
    cue_duration = 6.6

    def construct(self):
        bh = value_badge("best_here", "6", color=C_STATE, w=3.4, h=1.0).move_to([-2.2, 0.7, 0])
        bg = value_badge("best", "6", color=C_ANSWER, w=3.0, h=1.0).move_to([2.2, 0.7, 0])
        self.play(FadeIn(bh), FadeIn(bg), run_time=1.2)

        bound = MathTex(r"\text{time } ", "O(n)", r"\qquad \text{space } ", "O(1)", color=INK).scale(0.95)
        bound.move_to([0, -1.1, 0])
        bound[1].set_color(EMERALD)
        bound[3].set_color(EMERALD)
        self.play(Write(bound), run_time=1.3)
        self.play(Circumscribe(bound[3], color=EMERALD), run_time=1.0)
        self.guard(bh, bg, bound)
        pace_to(self, self.cue_duration)
