"""
Lesson 17 — Part 2 (activity 100): "Variable-size window" (128.23s, 6 short cues).

The concrete variable-size walkthrough behind the orientation's "variable
branch" — longest substring with no repeated character over the string
a b c a b c b. The right pointer expands greedily, admitting characters while
the window stays legal; when a duplicate arrives, the left pointer shrinks from
the left until the window is legal again. Right advances once per index and left
advances at most once, so total pointer travel is 2n = O(n). Uses the arrays.py
idiom lib (value_row, window_bracket, pointer, value_badge) — the array/pointer
vocabulary; MathTex only for the 2n / O(n) bound.

Cue00 0-23.3     Expand a, b, c — window a,b,c has length 3
Cue01 23.3-51.3  Duplicate a arrives — admitting it would repeat
Cue02 51.3-77.7  Shrink from the left — release the old a, advance L
Cue03 77.7-102.6 Why still linear — each index moves once, total travel 2n
Cue04 102.6-116.6 Swap the bookkeeping — change only the validity test
Cue05 116.6-128.2 Record the best — update the best length whenever legal
"""

import theme
from theme import (
    AvoScene,
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
from pacing import pace_to, elapsed
from arrays import (
    value_row,
    recolor_cell,
    window_bracket,
    pointer,
    value_badge,
    complexity,
    C_ENTER,
    C_LEAVE,
    C_WINDOW,
    C_RIGHT,
    C_LEFT,
    C_RESULT,
)
from manim import (
    VGroup,
    Text,
    MathTex,
    CurvedArrow,
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

CHARS = ["a", "b", "c", "a", "b", "c", "b"]
ROW_Y = 0.9


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_row():
    """The shared character row (no index labels — the L/R pointers mark position)."""
    row = value_row(CHARS, w=0.9, h=0.9, fs=32, gap=0.16, index=False)
    row.move_to([0, ROW_Y, 0])
    return row


def r_pointer(row, r):
    return pointer(row.cells[r], "R", color=C_RIGHT, side=DOWN, gap=0.85)


def l_pointer(row, l):
    return pointer(row.cells[l], "L", color=C_LEFT, side=DOWN, gap=1.75)


# ─── Cue00 : expand a, b, c ──────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Expand: admit while legal"
    cue_duration = 23.3

    def construct(self):
        row = build_row()
        self.play(FadeIn(row, shift=UP * 0.15), run_time=1.4)
        wait_until(self, 3)

        lp = l_pointer(row, 0)
        self.play(FadeIn(lp), run_time=0.8)

        # right pointer admits a, b, c one at a time; window grows
        win = None
        for r in range(3):
            wait_until(self, 4 + r * 4.6)
            rp = r_pointer(row, r)
            if r == 0:
                self.play(FadeIn(rp), run_time=0.7)
                cur_rp = rp
            else:
                self.play(Transform(cur_rp, rp), run_time=0.7)
            recolor_cell(row.cells[r], C_ENTER)
            self.play(Indicate(row.cells[r], color=C_ENTER, scale_factor=1.15), run_time=0.6)
            newwin = window_bracket(row, 0, r, color=C_WINDOW)
            if win is None:
                self.play(Create(newwin[0]), run_time=0.6)
                win = newwin
            else:
                self.play(Transform(win[0], newwin[0]), run_time=0.6)

        wait_until(self, 18)
        badge = value_badge("length", 3, color=C_RESULT, w=3.4).to_edge(DOWN, buff=0.7)
        note = Text("window  a, b, c  — all distinct", font_size=24, color=EMERALD)
        note.next_to(badge, UP, buff=0.3)
        self.play(FadeIn(note), FadeIn(badge), run_time=1.4)
        self.guard(row, win, badge)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the duplicate arrives ───────────────────────────────────────────
class Cue01(AvoScene):
    headline = "A duplicate is about to break the rule"
    cue_duration = 28.0

    def construct(self):
        row = build_row()
        win = window_bracket(row, 0, 2, color=C_WINDOW)
        for i in range(3):
            recolor_cell(row.cells[i], C_WINDOW, fill=0.14)
        lp = l_pointer(row, 0)
        rp = r_pointer(row, 2)
        self.add(row, win, lp, rp)
        wait_until(self, 3)

        # R advances to index 3 = 'a'
        rp2 = r_pointer(row, 3)
        self.play(Transform(rp, rp2), run_time=1.2)
        self.play(Indicate(row.cells[3], color=AMBER, scale_factor=1.2), run_time=1.0)
        wait_until(self, 9)

        # 'a' at index 3 is already inside the window (index 0)
        recolor_cell(row.cells[3], C_LEAVE)
        recolor_cell(row.cells[0], C_LEAVE)
        clash = CurvedArrow(row.cells[3].get_top(), row.cells[0].get_top(),
                            color=ROSE, angle=-1.1, stroke_width=4)
        self.play(Create(clash), run_time=1.4)
        self.play(Indicate(VGroup(row.cells[0], row.cells[3]), color=ROSE, scale_factor=1.1),
                  run_time=1.2)
        wait_until(self, 18)

        msg = Text("the next  a  is already inside", font_size=26, color=ROSE, weight="BOLD")
        sub = Text("admitting it would create a repeat", font_size=22, color=INK_MUTED)
        grp = VGroup(msg, sub).arrange(DOWN, buff=0.25).to_edge(DOWN, buff=0.7)
        self.play(FadeIn(msg), run_time=1.2)
        wait_until(self, 23)
        self.play(FadeIn(sub), run_time=1.2)
        self.guard(row, win, clash, msg, sub)
        pace_to(self, self.cue_duration)


# ─── Cue02 : shrink from the left ────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Shrink from the left: release the old a"
    cue_duration = 26.4

    def construct(self):
        row = build_row()
        win = window_bracket(row, 0, 3, color=ROSE)  # illegal window (contains repeat)
        for i in range(4):
            recolor_cell(row.cells[i], C_WINDOW, fill=0.12)
        recolor_cell(row.cells[0], C_LEAVE)
        recolor_cell(row.cells[3], AMBER)
        lp = l_pointer(row, 0)
        rp = r_pointer(row, 3)
        self.add(row, win, lp, rp)
        illegal = Text("illegal — a repeats", font_size=22, color=ROSE).to_edge(DOWN, buff=0.7)
        self.play(FadeIn(illegal), run_time=1.0)
        wait_until(self, 5)

        # remove the leftmost 'a' (index 0), advance L to 1
        self.play(Indicate(row.cells[0], color=ROSE, scale_factor=1.15), run_time=1.0)
        self.play(row.cells[0].animate.set_opacity(0.28), run_time=1.0)
        lp2 = l_pointer(row, 1)
        self.play(Transform(lp, lp2), run_time=1.4)
        wait_until(self, 13)

        # window now [1..3] = b, c, a — legal again
        recolor_cell(row.cells[3], C_ENTER)
        win2 = window_bracket(row, 1, 3, color=C_WINDOW)
        self.play(Transform(win[0], win2[0]), run_time=1.4)
        self.play(Indicate(VGroup(row.cells[1], row.cells[2], row.cells[3]),
                           color=C_WINDOW, scale_factor=1.08), run_time=1.2)
        wait_until(self, 20)

        legal = Text("window  b, c, a  — the new a fits", font_size=24, color=EMERALD)
        self.play(FadeOut(illegal), run_time=0.5)
        legal.to_edge(DOWN, buff=0.7)
        self.play(FadeIn(legal), run_time=1.2)
        self.guard(row, win, legal)
        pace_to(self, self.cue_duration)


# ─── Cue03 : why still linear ────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Why still linear: each index moves once"
    cue_duration = 24.9

    def construct(self):
        row = build_row()
        self.add(row)
        wait_until(self, 2)

        n = len(CHARS)
        # R sweeps left→right once
        r_track = Text("R: forward once, never back", font_size=24, color=C_RIGHT, weight="BOLD")
        l_track = Text("L: forward at most once", font_size=24, color=C_LEFT, weight="BOLD")
        tracks = VGroup(r_track, l_track).arrange(DOWN, buff=0.35, aligned_edge=LEFT).move_to([0, -1.0, 0])
        self.play(FadeIn(r_track, shift=RIGHT * 0.2), run_time=1.3)
        wait_until(self, 8)
        self.play(FadeIn(l_track, shift=RIGHT * 0.2), run_time=1.3)
        wait_until(self, 14)

        # total travel = 2n
        total = MathTex(r"\text{total travel} \le ", "2n", r" = O(n)", color=INK).scale(1.0)
        total[1].set_color(EMERALD)
        total[2].set_color(EMERALD)
        total.to_edge(DOWN, buff=0.7)
        self.play(Write(total), run_time=1.8)
        self.play(Circumscribe(total[1], color=EMERALD), run_time=1.2)
        self.guard(row, tracks, total)
        pace_to(self, self.cue_duration)


# ─── Cue04 : swap the bookkeeping ────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Same skeleton, new rule"
    cue_duration = 14.0

    def construct(self):
        row = build_row()
        self.add(row)
        wait_until(self, 1.0)

        keep = Text("keep: two boundaries, expand R, repair with L, record",
                    font_size=22, color=INK_MUTED)
        swap = Text("change only: the validity test", font_size=26, color=AMBER, weight="BOLD")
        ex1 = Text("no-repeat → a set", font_size=22, color=EMERALD)
        ex2 = Text("at-most-k-distinct → a count map", font_size=22, color=EMERALD)
        examples = VGroup(ex1, ex2).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
        col = VGroup(keep, swap, examples).arrange(DOWN, buff=0.32).move_to([0, -1.2, 0])
        if col.width > 12.5:
            col.scale(12.5 / col.width)
        self.play(FadeIn(keep), run_time=1.0)
        wait_until(self, 5)
        self.play(FadeIn(swap), run_time=1.0)
        wait_until(self, 8.5)
        self.play(FadeIn(examples), run_time=1.4)
        self.guard(row, col)
        pace_to(self, self.cue_duration)


# ─── Cue05 : record the best ─────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Track the answer"
    cue_duration = 11.6

    def construct(self):
        row = build_row()
        win = window_bracket(row, 1, 3, color=C_WINDOW)
        for i in range(1, 4):
            recolor_cell(row.cells[i], C_WINDOW, fill=0.14)
        self.add(row, win)
        wait_until(self, 1.0)

        rule = Text("whenever the window is legal, update the best length",
                    font_size=23, color=INK).move_to([0, -1.2, 0])
        if rule.width > 12.5:
            rule.scale(12.5 / rule.width)
        self.play(FadeIn(rule), run_time=1.2)
        wait_until(self, 5)

        best = value_badge("best", 3, color=EMERALD, w=3.2).to_edge(DOWN, buff=0.7)
        self.play(FadeIn(best), Circumscribe(best, color=EMERALD), run_time=1.6)
        self.guard(row, win, rule, best)
        pace_to(self, self.cue_duration)
