"""
Lesson 27 — Part 2 (activity 160): "Palindrome Partitioning — backtracking with
a precomputed palindrome table" (82.5s, 8 cues).

The concrete implementation walkthrough behind orientation cue07/08. Over
s = "aab" the recursion is a decision tree of split points: at start index i,
try every end j; if s[i..j] is a palindrome, push it and recurse from j+1. When
start reaches the length, copy the path as one valid partition; after the
recursive call returns, POP (the un-choose step). A precomputed dp[i][j] table
turns each palindrome test into an O(1) lookup, so the bottleneck is the number
of valid partitions × n for path copying.

Reuses backtracking.py (three_beats, snapshot_chip, complexity) and bayes.chip;
builds a tiny inline dp grid + split-decision tree. MathTex only for the bound
O(n · 2^n).

Cue00 0.0-6.2    decision tree of split points
Cue01 6.2-14.4   start == length → copy the path
Cue02 14.4-22.7  pop after recursion (un-choose)
Cue03 22.7-33.0  inline O(n) vs precomputed O(1) palindrome test
Cue04 33.0-43.3  fill the dp table diagonals outward
Cue05 43.3-53.6  bottleneck is the number of partitions × n
Cue06 53.6-66.0  backtracking = choose · explore · un-choose
Cue07 66.0-82.5  'all possible' + small constraint = the signal
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from backtracking import three_beats, snapshot_chip, complexity, C_PATH, C_SAVE, C_POP
from bayes import chip, fit_label
from manim import (
    VGroup, Text, MathTex, Line, Dot, RoundedRectangle, SurroundingRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, Create, GrowFromCenter,
    RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def _piece(label, color=C_PATH, w=1.1, h=0.7, fs=26):
    box = RoundedRectangle(width=w, height=h, corner_radius=0.1,
                           stroke_color=color, stroke_width=2.4,
                           fill_color=color, fill_opacity=0.14)
    t = Text(label, font_size=fs, color=INK, weight="BOLD").move_to(box.get_center())
    return VGroup(box, t)


# ─── Cue00 : decision tree of splits ─────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Each node is a split point of s = \"aab\""
    cue_duration = 6.2

    def construct(self):
        root = _piece('""', color=INK_SUBTLE).move_to([0, 2.0, 0])
        self.play(FadeIn(root), run_time=0.8)
        # from root: choose "a" (i=0,j=0) or "aa" (i=0,j=1)
        a = _piece('"a"', color=C_PATH).move_to([-2.6, 0.4, 0])
        aa = _piece('"aa"', color=C_PATH).move_to([2.6, 0.4, 0])
        la = Line(root.get_bottom(), a.get_top(), color=INK_SUBTLE, stroke_width=2.5)
        laa = Line(root.get_bottom(), aa.get_top(), color=INK_SUBTLE, stroke_width=2.5)
        self.play(Create(la), Create(laa), FadeIn(a), FadeIn(aa), run_time=1.4)
        cap = fit_label("at index i, try every end j; keep the palindromic cuts",
                        11.0, 22, INK_MUTED).move_to([0, -2.0, 0])
        self.play(FadeIn(cap), run_time=1.0)
        self.guard(root, a, aa, la, laa, cap)
        pace_to(self, self.cue_duration)


# ─── Cue01 : start == length → copy path ─────────────────────────────────────
class Cue01(AvoScene):
    headline = "start == len(s) → the path is a complete partition"
    cue_duration = 8.2

    def construct(self):
        path = VGroup(_piece('"a"'), _piece('"a"'), _piece('"b"')).arrange(RIGHT, buff=0.3).move_to([0, 1.4, 0])
        cap = fit_label("path = [ a , a , b ]   and start reached the end", 9.5, 24, INK).move_to([0, 0.2, 0])
        self.play(FadeIn(path), FadeIn(cap), run_time=1.4)
        wait_until(self, 4.0)
        saved = snapshot_chip(["a", "a", "b"]).move_to([0, -1.3, 0])
        arrow = Text("copy →", font_size=24, color=C_SAVE, weight="BOLD").next_to(saved, UP, buff=0.25)
        self.play(FadeIn(arrow), GrowFromCenter(saved), Circumscribe(saved, color=C_SAVE), run_time=1.8)
        self.guard(path, cap, saved, arrow)
        pace_to(self, self.cue_duration)


# ─── Cue02 : pop after recursion ─────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "After recursion returns, pop the last piece (un-choose)"
    cue_duration = 8.3

    def construct(self):
        path = VGroup(_piece('"a"'), _piece('"a"'), _piece('"b"')).arrange(RIGHT, buff=0.3).move_to([0, 1.3, 0])
        self.play(FadeIn(path), run_time=1.0)
        wait_until(self, 3.0)
        # pop "b"
        popmark = Text("pop", font_size=26, color=C_POP, weight="BOLD").next_to(path[2], UP, buff=0.3)
        self.play(FadeIn(popmark), Indicate(path[2], color=C_POP, scale_factor=1.2), run_time=1.2)
        self.play(FadeOut(path[2]), FadeOut(popmark), run_time=1.0)
        note = fit_label("resets state so the next branch starts clean", 9.0, 24, INK_MUTED).move_to([0, -1.6, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.guard(path[0], path[1], note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : inline vs precomputed ───────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Palindrome test: inline O(n) vs precomputed O(1)"
    cue_duration = 10.3

    def construct(self):
        inline = chip("inline two-pointer:  O(n) per call", color=AMBER, w=7.4, h=1.0, fs=26).move_to([0, 1.6, 0])
        pre = chip("precomputed dp table:  O(1) per call", color=EMERALD, w=7.4, h=1.0, fs=26).move_to([0, 0.2, 0])
        for c, t in zip([inline, pre], [3.5, 7.0]):
            self.play(FadeIn(c), run_time=1.0)
            wait_until(self, t)
        setup = fit_label("dp costs O(n²) to build once, then every lookup is free",
                          10.5, 23, INK).move_to([0, -1.2, 0])
        small = chip("for n ≤ 16, both are fine", color=ACCENT, w=6.0, h=0.9, fs=25).move_to([0, -2.4, 0])
        self.play(FadeIn(setup), run_time=1.0)
        self.play(FadeIn(small), run_time=1.0)
        self.guard(inline, pre, setup, small)
        pace_to(self, self.cue_duration)


# ─── Cue04 : fill diagonals outward ──────────────────────────────────────────
class Cue04(AvoScene):
    headline = "dp[i][j] = (s[i] == s[j]) and dp[i+1][j-1]"
    cue_duration = 10.3

    def construct(self):
        s = "aab"
        n = 3
        cell = 0.9
        cellmap = {}
        grid = VGroup()
        for i in range(n):
            for j in range(n):
                box = RoundedRectangle(width=cell, height=cell, corner_radius=0.08,
                                       stroke_color=INK_SUBTLE, stroke_width=2.0,
                                       fill_color=INK_SUBTLE, fill_opacity=0.05)
                box.move_to([j * (cell + 0.12) - 2.2, -i * (cell + 0.12) + 1.4, 0])
                grid.add(box)
                cellmap[(i, j)] = box
        labels = VGroup()
        for k in range(n):
            labels.add(Text(f"i{k}", font_size=17, color=INK_MUTED).next_to(cellmap[(k, 0)], LEFT, buff=0.2))
            labels.add(Text(f"j{k}", font_size=17, color=INK_MUTED).next_to(cellmap[(0, k)], UP, buff=0.2))
        grid.shift([-0.6, 0, 0]); labels.shift([-0.6, 0, 0])
        self.play(FadeIn(grid), FadeIn(labels), run_time=1.2)

        def mark(i, j, val):
            b = cellmap[(i, j)]
            col = EMERALD if val else ROSE
            b.set_stroke(color=col, width=2.8); b.set_fill(color=col, opacity=0.20)
            return Text("T" if val else "F", font_size=26, color=col, weight="BOLD").move_to(b.get_center())

        rules = VGroup(
            fit_label("base: single chars = T", 4.4, 20, EMERALD),
            fit_label("pair: s[i]==s[i+1]", 4.4, 20, AMBER),
            fit_label("len≥3: ends match", 4.4, 20, ACCENT),
            fit_label("AND inner dp", 4.4, 20, ACCENT),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.35).move_to([3.6, 0.5, 0])

        self.play(FadeIn(rules[0]), run_time=0.8)
        self.play(FadeIn(VGroup(mark(0, 0, True), mark(1, 1, True), mark(2, 2, True))), run_time=1.0)
        wait_until(self, 5.0)
        self.play(FadeIn(rules[1]), run_time=0.8)
        self.play(FadeIn(VGroup(mark(0, 1, s[0] == s[1]), mark(1, 2, s[1] == s[2]))), run_time=1.0)
        wait_until(self, 8.0)
        self.play(FadeIn(rules[2:]), run_time=0.8)
        self.play(FadeIn(mark(0, 2, s[0] == s[2] and True)), run_time=0.9)
        self.guard(grid, labels, rules)
        pace_to(self, self.cue_duration)


# ─── Cue05 : bottleneck is output size ───────────────────────────────────────
class Cue05(AvoScene):
    headline = "Bottleneck = number of valid partitions × n"
    cue_duration = 10.3

    def construct(self):
        pre = chip("after O(n²) precompute, each test is O(1)", color=EMERALD, w=8.6, h=0.95, fs=25).move_to([0, 1.7, 0])
        self.play(FadeIn(pre), run_time=1.2)
        wait_until(self, 3.5)
        cost = fit_label("cost ≈ (# valid partitions) × n   for copying each path",
                         11.0, 24, INK).move_to([0, 0.3, 0])
        self.play(FadeIn(cost), run_time=1.2)
        wait_until(self, 7.0)
        bound = complexity(r"n = 16 \;\Rightarrow\; \le 2^{15} \approx 32\text{K partitions}", color=AMBER, fs=38).move_to([0, -1.4, 0])
        self.play(Write(bound), run_time=1.8)
        self.guard(pre, cost, bound)
        pace_to(self, self.cue_duration)


# ─── Cue06 : choose · explore · un-choose ────────────────────────────────────
class Cue06(AvoScene):
    headline = "Backtracking = choose · explore · un-choose"
    cue_duration = 12.4

    def construct(self):
        beats = three_beats(fs=25, w=3.6, h=0.85, gap=0.4).move_to([-3.6, 0, 0])
        self.play(FadeIn(beats), run_time=1.6)
        wait_until(self, 4.0)
        fam = VGroup(
            fit_label("same skeleton for:", 4.6, 23, INK_MUTED),
            chip("combinations", color=ACCENT, w=4.4, h=0.72, fs=23),
            chip("permutations", color=AMBER, w=4.4, h=0.72, fs=23),
            chip("subsets", color=EMERALD, w=4.4, h=0.72, fs=23),
            chip("N-queens · Sudoku", color=VIOLET, w=4.8, h=0.72, fs=23),
        ).arrange(DOWN, buff=0.28).move_to([3.2, 0, 0])
        for c, t in zip(fam, [5.6, 7.0, 8.2, 9.3, 10.2]):
            self.play(FadeIn(c), run_time=0.6)
            wait_until(self, t)
        note = fit_label("only the validity check changes", 7.5, 23, EMERALD, weight="BOLD").move_to([0, -2.6, 0])
        self.play(FadeIn(note), run_time=0.9)
        self.guard(beats, fam, note)
        pace_to(self, self.cue_duration)


# ─── Cue07 : 'all possible' is the signal ────────────────────────────────────
class Cue07(AvoScene):
    headline = "'All possible' + small constraint = backtracking"
    cue_duration = 16.5

    def construct(self):
        signals = VGroup(
            chip('"return all possible …"', color=VIOLET, w=6.8, h=0.9, fs=26),
            chip('"find every valid …"', color=VIOLET, w=6.8, h=0.9, fs=26),
            chip('"list all …"', color=VIOLET, w=6.8, h=0.9, fs=26),
        ).arrange(DOWN, buff=0.4).move_to([0, 1.1, 0])
        for c, t in zip(signals, [3.0, 6.0, 9.0]):
            self.play(FadeIn(c), run_time=1.0)
            wait_until(self, t)
        plus = Text("+  small constraint (n ≤ ~20)", font_size=28, color=AMBER, weight="BOLD").move_to([0, -1.2, 0])
        self.play(FadeIn(plus), run_time=1.2)
        wait_until(self, 13.0)
        verdict = complexity(r"\Rightarrow\; O(n \cdot 2^{n})\ \text{backtracking}", color=EMERALD, fs=40).move_to([0, -2.5, 0])
        self.play(Write(verdict), Circumscribe(verdict, color=EMERALD), run_time=2.0)
        self.guard(signals, plus, verdict)
        pace_to(self, self.cue_duration)
