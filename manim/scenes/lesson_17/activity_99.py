"""
Lesson 17 — Part 1 (activity 99): "Fixed-size window" (117.31s, 6 short cues).

The concrete fixed-size walkthrough behind the orientation's "fixed branch": a
size-3 window over the array [4, 2, 7, 1, 9]. The first window is the only full
addition (4+2+7 = 13); every slide is a constant edit (drop the element that
leaves, add the one that enters), so 13 → 10 → 17 with O(1) work per step and
O(n) total. Uses the arrays.py idiom lib (value_row, window_bracket, pointer,
value_badge, edit_note, complexity) — the array/pointer vocabulary, NOT the
transformer / econ / Bayes idioms of other lessons. MathTex is reserved for the
one complexity bound at the end.

Cue00 0-21.3     First window full price: 4+2+7 = 13
Cue01 21.3-44.1  Slide one: −4 +1 → 13−4+1 = 10
Cue02 44.1-67.5  Overlap is free: 2 and 7 sit in both windows, never re-added
Cue03 67.5-91    Slide two: −2 +9 → 10−2+9 = 17, a new best
Cue04 91-106.6   Constant per step: width 3 or 300 costs the same
Cue05 106.6-117.3 Linear total: one full sum + a constant edit each step = O(n)

Each cue stages its reveals with wait_until(scene, t); pace_to fills the tail so
the chunk length equals the cue window exactly (the render harness pins it).
"""

import theme
from theme import (
    AvoScene,
    ACCENT,
    ACCENT_LIGHT,
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
    window_bracket,
    value_badge,
    edit_note,
    complexity,
    C_ENTER,
    C_LEAVE,
    C_WINDOW,
    C_RESULT,
)
from manim import (
    VGroup,
    Text,
    MathTex,
    FadeIn,
    FadeOut,
    Write,
    Create,
    Transform,
    Indicate,
    Circumscribe,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
)

ARR = [4, 2, 7, 1, 9]
ARR_Y = 0.7          # vertical center of the value row
BADGE_POS = [4.7, 0.6, 0]    # sum badge: right side, aligned near the row
BEST_POS = [4.7, -0.8, 0]    # best badge: right side, below the sum


def wait_until(scene, t: float) -> None:
    """Wait until scene time reaches `t` seconds (no-op if already past)."""
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_array():
    """The shared [4,2,7,1,9] row, positioned consistently across cues."""
    row = value_row(ARR, w=0.95, h=0.95, fs=32, gap=0.18)
    row.move_to([0, ARR_Y, 0])
    return row


# ─── Cue00 : the first window is the only full addition ──────────────────────
class Cue00(AvoScene):
    headline = "The first window: sum k once"
    cue_duration = 21.3

    def construct(self):
        row = build_array()
        self.play(FadeIn(row, shift=UP * 0.2), run_time=1.6)
        wait_until(self, 3)

        # window over indices 0..2
        win = window_bracket(row, 0, 2, color=C_WINDOW, label="window (k = 3)")
        self.play(Create(win[0]), FadeIn(win[1]), run_time=1.4)

        badge = value_badge("sum", 0, color=C_RESULT).move_to(BADGE_POS)
        self.play(FadeIn(badge), run_time=0.8)
        wait_until(self, 6)

        # add 4 + 2 + 7 one at a time, accumulating into the badge
        running = 0
        for i in range(3):
            wait_until(self, 6 + i * 3.6)
            running += ARR[i]
            self.play(Indicate(row.cells[i], color=C_WINDOW, scale_factor=1.18), run_time=0.7)
            newv = value_badge("sum", running, color=C_RESULT).move_to(BADGE_POS)
            self.play(Transform(badge, newv), run_time=0.7)

        eq = Text("4 + 2 + 7 = 13", font_size=LABEL_SIZE, color=INK).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(eq), run_time=1.0)
        note = Text("the only full addition we ever do", font_size=22, color=INK_MUTED)
        note.next_to(eq, UP, buff=0.25)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(row, win, badge, eq)
        pace_to(self, self.cue_duration)


# ─── Cue01 : slide one — one leaves, one enters ──────────────────────────────
class Cue01(AvoScene):
    headline = "Slide one: −4  +1"
    cue_duration = 22.8

    def construct(self):
        row = build_array()
        win = window_bracket(row, 0, 2, color=C_WINDOW)
        badge = value_badge("sum", 13, color=C_RESULT).move_to(BADGE_POS)
        self.add(row, win, badge)
        self.play(FadeIn(VGroup(row, win, badge)), run_time=0.1)
        wait_until(self, 2)

        # mark the element leaving (index 0 = 4) and entering (index 3 = 1)
        recolor_cell(row.cells[0], C_LEAVE)
        recolor_cell(row.cells[3], C_ENTER)
        leave_lbl = Text("leaves", font_size=20, color=C_LEAVE).next_to(row.cells[0], UP, buff=0.5)
        enter_lbl = Text("enters", font_size=20, color=C_ENTER).next_to(row.cells[3], UP, buff=0.5)
        self.play(Indicate(row.cells[0], color=C_LEAVE, scale_factor=1.15),
                  FadeIn(leave_lbl), run_time=1.3)
        self.play(Indicate(row.cells[3], color=C_ENTER, scale_factor=1.15),
                  FadeIn(enter_lbl), run_time=1.3)
        wait_until(self, 9)

        # slide the window to indices 1..3
        win2 = window_bracket(row, 1, 3, color=C_WINDOW)
        self.play(Transform(win[0], win2[0]), run_time=1.4)
        wait_until(self, 13)

        # the constant-work edit: 13 − 4 + 1 = 10
        ed = edit_note(4, 1).move_to([0, -1.4, 0])
        eq = MathTex(r"13 - 4 + 1 = ", "10", color=INK).scale(0.95).next_to(ed, DOWN, buff=0.4)
        eq[1].set_color(C_RESULT)
        self.play(FadeIn(ed), run_time=1.0)
        self.play(Write(eq), run_time=1.4)
        newb = value_badge("sum", 10, color=C_RESULT).move_to(BADGE_POS)
        self.play(Transform(badge, newb), run_time=1.0)
        self.guard(row, win, badge, ed, eq)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the overlap is free ─────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "The overlap is free"
    cue_duration = 23.4

    def construct(self):
        row = build_array()
        self.add(row)
        wait_until(self, 1.5)

        # two windows drawn together: old [0..2], new [1..3]; the shared middle 2,7
        old = window_bracket(row, 0, 2, color=INK_SUBTLE)
        new = window_bracket(row, 1, 3, color=C_WINDOW)
        old_l = Text("first window", font_size=19, color=INK_SUBTLE).next_to(old[0], UP, buff=0.15).shift(LEFT * 1.2)
        new_l = Text("next window", font_size=19, color=C_WINDOW).next_to(new[0], DOWN, buff=0.15).shift(RIGHT * 1.2)
        self.play(Create(old[0]), FadeIn(old_l), run_time=1.2)
        self.play(Create(new[0]), FadeIn(new_l), run_time=1.2)
        wait_until(self, 8)

        # the shared middle: indices 1,2 → values 2 and 7
        recolor_cell(row.cells[1], EMERALD)
        recolor_cell(row.cells[2], EMERALD)
        self.play(Indicate(VGroup(row.cells[1], row.cells[2]), color=EMERALD, scale_factor=1.12),
                  run_time=1.4)
        shared = Text("2 and 7 sit in both windows", font_size=24, color=EMERALD)
        never = Text("never re-added — only the two ends change", font_size=22, color=INK_MUTED)
        bottom = VGroup(shared, never).arrange(DOWN, buff=0.25).move_to([0, -2.9, 0])
        self.play(FadeIn(shared), run_time=1.2)
        wait_until(self, 15)
        self.play(FadeIn(never), run_time=1.2)
        self.guard(row, old, new, shared, never)
        pace_to(self, self.cue_duration)


# ─── Cue03 : slide two — a new best ──────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Slide two: −2  +9  →  a new best"
    cue_duration = 23.5

    def construct(self):
        row = build_array()
        win = window_bracket(row, 1, 3, color=C_WINDOW)
        badge = value_badge("sum", 10, color=C_RESULT).move_to(BADGE_POS)
        best = value_badge("best", 13, color=AMBER).move_to(BEST_POS)
        self.add(row, win, badge, best)
        wait_until(self, 2)

        recolor_cell(row.cells[1], C_LEAVE)   # 2 leaves
        recolor_cell(row.cells[4], C_ENTER)   # 9 enters
        self.play(Indicate(row.cells[1], color=C_LEAVE, scale_factor=1.15), run_time=1.2)
        self.play(Indicate(row.cells[4], color=C_ENTER, scale_factor=1.15), run_time=1.2)
        wait_until(self, 8)

        win2 = window_bracket(row, 2, 4, color=C_WINDOW)
        self.play(Transform(win[0], win2[0]), run_time=1.4)
        wait_until(self, 12)

        ed = edit_note(2, 9).move_to([0, -1.4, 0])
        eq = MathTex(r"10 - 2 + 9 = ", "17", color=INK).scale(0.95).next_to(ed, DOWN, buff=0.4)
        eq[1].set_color(C_RESULT)
        self.play(FadeIn(ed), run_time=1.0)
        self.play(Write(eq), run_time=1.4)
        newb = value_badge("sum", 17, color=C_RESULT).move_to(BADGE_POS)
        self.play(Transform(badge, newb), run_time=1.0)
        wait_until(self, 19)

        # new best: 17 > 13
        newbest = value_badge("best", 17, color=EMERALD).move_to(BEST_POS)
        self.play(Transform(best, newbest), Circumscribe(newbest, color=EMERALD), run_time=1.4)
        self.guard(row, win, badge, ed, eq, best)
        pace_to(self, self.cue_duration)


# ─── Cue04 : constant per step, width-independent ────────────────────────────
class Cue04(AvoScene):
    headline = "Constant per step — width does not matter"
    cue_duration = 15.6

    def construct(self):
        row = build_array()
        win = window_bracket(row, 2, 4, color=C_WINDOW)
        self.add(row, win)
        wait_until(self, 1.5)

        # one out, one in — always two edits regardless of k
        out = Text("one out", font_size=26, color=C_LEAVE, weight="BOLD")
        plus = Text("one in", font_size=26, color=C_ENTER, weight="BOLD")
        pair = VGroup(out, plus).arrange(RIGHT, buff=0.9).move_to([0, -1.5, 0])
        self.play(FadeIn(out, shift=LEFT * 0.2), run_time=1.0)
        self.play(FadeIn(plus, shift=RIGHT * 0.2), run_time=1.0)
        wait_until(self, 6)

        wk = Text("width 3 or 300 — same cost per slide", font_size=24, color=INK).to_edge(DOWN, buff=0.9)
        self.play(FadeIn(wk), run_time=1.2)
        wait_until(self, 10)
        o1 = complexity(r"O(1)", color=EMERALD, fs=44).next_to(wk, UP, buff=0.35)
        per = Text("per step", font_size=20, color=INK_MUTED).next_to(o1, RIGHT, buff=0.3)
        self.play(Write(o1), FadeIn(per), run_time=1.3)
        self.guard(row, win, pair, wk, o1)
        pace_to(self, self.cue_duration)


# ─── Cue05 : linear total ────────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "One setup, then a sweep: O(n)"
    cue_duration = 10.7

    def construct(self):
        row = build_array()
        self.add(row)
        wait_until(self, 1.0)

        setup = Text("one full sum", font_size=24, color=AMBER, weight="BOLD")
        sweep = Text("+  a constant edit at each remaining position",
                     font_size=22, color=INK)
        line = VGroup(setup, sweep).arrange(RIGHT, buff=0.35).move_to([0, -1.5, 0])
        if line.width > 12.0:
            line.scale(12.0 / line.width)
        self.play(FadeIn(setup), run_time=1.0)
        self.play(FadeIn(sweep), run_time=1.2)
        wait_until(self, 5.5)

        on = complexity(r"O(n)", color=EMERALD, fs=52).to_edge(DOWN, buff=0.7)
        self.play(Write(on), Circumscribe(on, color=EMERALD), run_time=1.6)
        self.guard(row, line, on)
        pace_to(self, self.cue_duration)
