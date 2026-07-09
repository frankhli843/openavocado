"""
Lesson 27 — Part 1 (activity 159): "Minimum Window Substring — the sliding
window mechanics" (100.6s, 8 cues).

The concrete implementation walkthrough behind orientation cue03/04. Two
pointers that only ever move forward over s = "ADOBECODEBANC", t = "ABC":
expand right until the window covers every needed char (formed == required),
then shrink left to minimize, recording the best window ("BANC"). Both pointers
are monotonic, so every character enters and leaves at most once → O(|s|+|t|).

Reuses arrays.py (value_row, window_bracket, pointer, code_line, complexity) and
bayes.chip. MathTex only for the single complexity bound O(|s|+|t|).

Cue00 0.0-7.5    never reset — L and R only move forward
Cue01 7.5-17.6   need / window maps, formed counter
Cue02 17.6-27.7  running tally: window[c]==need[c] → formed++
Cue03 27.7-37.7  minimize: record, drop leftmost, stop when invalid
Cue04 37.7-47.8  continue right after shrinking invalidates
Cue05 47.8-60.4  the expand-then-shrink core loop
Cue06 60.4-72.9  three gotchas
Cue07 72.9-100.6 O(|s| + |t|)
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from arrays import (
    value_row, window_bracket, pointer, recolor_cell, code_line, complexity,
    C_ENTER, C_LEAVE,
)
from bayes import chip, fit_label
from manim import (
    VGroup, Text, MathTex, Arrow, RoundedRectangle, SurroundingRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, GrowArrow, Create,
    RIGHT, LEFT, UP, DOWN,
)

S = list("ADOBECODEBANC")


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def _srow(y=1.4):
    return value_row(S, w=0.82, h=0.82, fs=24, gap=0.1, index=True, idx_fs=15).move_to([0, y, 0])


# ─── Cue00 : never reset — both pointers move forward ────────────────────────
class Cue00(AvoScene):
    headline = "Never reset: L and R only move forward"
    cue_duration = 7.5

    def construct(self):
        row = _srow(0.6)
        self.play(FadeIn(row), run_time=1.2)
        L = pointer(row.cells[0], "L", color=AMBER, side=DOWN, gap=0.85)
        R = pointer(row.cells[3], "R", color=ACCENT, side=UP, gap=0.85)
        self.play(GrowArrow(L[0]), FadeIn(L[1]), GrowArrow(R[0]), FadeIn(R[1]), run_time=1.2)
        note = fit_label("no character is visited more than twice", 8.0, 24, INK_MUTED).move_to([0, -1.9, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.guard(row, L, R, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : need / window maps + formed ─────────────────────────────────────
class Cue01(AvoScene):
    headline = "need counts t · window counts the range · formed tracks satisfied"
    cue_duration = 10.1

    def construct(self):
        need = chip("need = {A:1, B:1, C:1}", color=AMBER, w=5.4, h=1.0, fs=27).move_to([0, 1.7, 0])
        window = chip("window = {}", color=ACCENT, w=4.2, h=1.0, fs=27).move_to([0, 0.35, 0])
        formed = chip("formed = 0   /   required = 3", color=EMERALD, w=6.4, h=1.0, fs=27).move_to([0, -1.0, 0])
        for c, t in zip([need, window, formed], [2.5, 5.0, 8.0]):
            self.play(FadeIn(c), run_time=1.0)
            wait_until(self, t)
        self.guard(need, window, formed)
        pace_to(self, self.cue_duration)


# ─── Cue02 : running tally ───────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "window[c] reaches need[c] → formed += 1"
    cue_duration = 10.1

    def construct(self):
        line = code_line("if window[c] == need[c]:  formed += 1", EMERALD, 28).move_to([0, 1.6, 0])
        self.play(Write(line), run_time=1.6)
        wait_until(self, 4.0)
        rule = fit_label("when formed == distinct chars needed,", 9.0, 27, INK).move_to([0, -0.1, 0])
        valid = chip("the window is VALID", color=EMERALD, w=6.0, h=1.0, fs=30).move_to([0, -1.4, 0])
        self.play(FadeIn(rule), run_time=1.0)
        self.play(FadeIn(valid), Circumscribe(valid, color=EMERALD), run_time=1.8)
        self.guard(line, rule, valid)
        pace_to(self, self.cue_duration)


# ─── Cue03 : minimize the window ─────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Valid → record min, drop leftmost, re-check"
    cue_duration = 10.0

    def construct(self):
        row = _srow(1.5)
        self.play(FadeIn(row), run_time=1.0)
        win = window_bracket(row, 5, 12, color=ACCENT, label="valid window")
        self.play(Create(win), run_time=1.2)
        wait_until(self, 4.0)
        # shrink from left: drop index 5
        drop = pointer(row.cells[5], "drop", color=ROSE, side=DOWN, gap=0.8)
        smaller = window_bracket(row, 9, 12, color=EMERALD, label="smaller & still valid")
        self.play(GrowArrow(drop[0]), FadeIn(drop[1]), run_time=1.0)
        self.play(Transform(win, smaller), run_time=1.6)
        note = fit_label("stop shrinking once formed drops below required", 9.5, 23, INK_MUTED).move_to([0, -2.3, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.guard(row, win, drop, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : continue right ──────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Shrinking broke validity → expand right again"
    cue_duration = 10.1

    def construct(self):
        row = _srow(1.4)
        self.play(FadeIn(row), run_time=1.0)
        win = window_bracket(row, 10, 12, color=ROSE, label="invalid (missing A)")
        self.play(Create(win), run_time=1.2)
        wait_until(self, 4.5)
        grown = window_bracket(row, 10, 12, color=ACCENT, label="push R forward…")
        R = pointer(row.cells[12], "R →", color=ACCENT, side=UP, gap=0.8)
        self.play(Transform(win, grown), GrowArrow(R[0]), FadeIn(R[1]), run_time=1.6)
        note = fit_label("hunt for the next valid window", 7.5, 24, INK).move_to([0, -2.2, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.guard(row, win, R, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the expand-then-shrink core loop ────────────────────────────────
class Cue05(AvoScene):
    headline = "Expand-then-shrink: the core of every sliding window"
    cue_duration = 12.6

    def construct(self):
        loop = VGroup(
            chip("① expand R  →  add s[R]", color=ACCENT, w=6.2, h=0.95, fs=26),
            chip("② while valid: shrink L  →  minimize", color=AMBER, w=7.4, h=0.95, fs=26),
            chip("③ record best, repeat", color=EMERALD, w=5.4, h=0.95, fs=26),
        ).arrange(DOWN, buff=0.45).move_to([0, 0.5, 0])
        for c, t in zip(loop, [3.5, 7.0, 10.0]):
            self.play(FadeIn(c), run_time=1.0)
            wait_until(self, t)
        adapt = fit_label("only the validity check + bookkeeping change per variant",
                          11.0, 23, INK_MUTED).move_to([0, -2.2, 0])
        self.play(FadeIn(adapt), run_time=1.2)
        self.guard(loop, adapt)
        pace_to(self, self.cue_duration)


# ─── Cue06 : three gotchas ───────────────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Three gotchas"
    cue_duration = 12.5

    def construct(self):
        g = VGroup(
            chip("1.  t longer than s  →  no window exists", color=ROSE, w=8.2, h=0.9, fs=25),
            chip("2.  duplicate chars in t  →  counts must match, not just presence",
                 color=AMBER, w=9.8, h=0.9, fs=23),
            chip("3.  track the START index of the best window, not just its length",
                 color=ACCENT, w=10.0, h=0.9, fs=23),
        ).arrange(DOWN, buff=0.5).move_to([0, 0, 0])
        for c, t in zip(g, [4.0, 8.0, 11.5]):
            self.play(FadeIn(c), run_time=1.0)
            wait_until(self, t)
        self.guard(g)
        pace_to(self, self.cue_duration)


# ─── Cue07 : complexity ──────────────────────────────────────────────────────
class Cue07(AvoScene):
    headline = "O(|s| + |t|) — each character enters and leaves once"
    cue_duration = 27.7

    def construct(self):
        row = _srow(1.9)
        self.play(FadeIn(row), run_time=1.2)
        # sweep: each char in once (emerald), out once (rose)
        enter = SurroundingRectangle(VGroup(*row.cells), color=C_ENTER, buff=0.12, corner_radius=0.1)
        enter.set_stroke(width=3.2)
        self.play(Create(enter), run_time=1.6)
        elab = fit_label("R passes each char once  →  +1 each", 8.5, 23, C_ENTER).next_to(row, DOWN, buff=0.5)
        self.play(FadeIn(elab), run_time=1.0)
        wait_until(self, 9.0)

        llab = fit_label("L passes each char at most once  →  −1 each", 8.8, 23, C_LEAVE).next_to(elab, DOWN, buff=0.3)
        self.play(FadeIn(llab), run_time=1.2)
        wait_until(self, 16.0)

        bound = complexity(r"O(|s| + |t|)", color=INK, fs=52).move_to([0, -1.8, 0])
        self.play(Write(bound), run_time=1.8)
        space = fit_label("space O(alphabet size) for the two maps", 8.5, 22, INK_MUTED).move_to([0, -2.85, 0])
        self.play(FadeIn(space), run_time=1.2)
        self.guard(row, enter, elab, llab, bound, space)
        pace_to(self, self.cue_duration)
