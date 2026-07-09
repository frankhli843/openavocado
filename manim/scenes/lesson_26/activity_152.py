"""
Lesson 26 — Orientation (activity 152): "Binary search on the answer — when the
answer IS the search space" (1007.9s, 8 cues).

The map for the whole family. The unifying idea: when the quantity you want is a
number in a known range, and there is a MONOTONIC feasibility test can(candidate)
you can run in polynomial time, you never search the input — you binary-search
the ANSWER SPACE. Each cue plants one landmark: the family shape, the canonical
Koko example, why feasibility is monotonic, the three-piece template, the upper
variant (Magnetic Force) that flips the direction, Split Array's greedy oracle,
the round-up off-by-one, and the recognition rule.

Uses binsearch.py (candidate_row, paint_feasibility, boundary_ring, region_brace)
+ arrays.py (value_row, code_line, complexity). MathTex is reserved for the
recognition-rule statement and complexity forms. Long cues build the landmark in
~18-25s, then hold — the settled frame is the takeaway the narration lands on.

Cue00 0-114.2     the family: search a range for the infeasible↔feasible boundary
Cue01 114.2-248.6 Koko: search on speed, hours = Σ ceil(pile/k) ≤ h
Cue02 248.6-376.3 monotonicity: if speed k works, k+1 works too
Cue03 376.3-504    template: range, feasibility oracle, binary search
Cue04 504-638.3    upper search: Magnetic Force flips ✓/✗, round-up mid
Cue05 638.3-772.7  Split Array: minimize max subarray sum, greedy oracle
Cue06 772.7-907.1  off-by-one: round up prevents the infinite loop
Cue07 907.1-1007.9 recognition: monotonic can(candidate) in poly time ⇒ BS on answer
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from binsearch import (
    candidate_row, paint_feasibility, boundary_ring, region_brace, lohi_pointers,
    C_LO, C_HI, C_MID, C_FEASIBLE, C_INFEASIBLE, C_ANSWER,
)
from arrays import value_row, recolor_cell, code_line, complexity
from bayes import chip, fit_label
from manim import (
    VGroup, Text, MathTex, Arrow, Line, Dot, DoubleArrow, SurroundingRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, GrowArrow,
    GrowFromCenter, Create, RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : the family ──────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "The answer IS the search space"
    cue_duration = 114.2

    def construct(self):
        vals = list(range(1, 11))
        feas = [v >= 6 for v in vals]                     # ✗✗✗✗✗✓✓✓✓✓
        cand = candidate_row(vals, feas, w=1.05, h=0.72, fs=22).move_to([0, 0.5, 0])
        self.play(FadeIn(cand.row), run_time=1.6)
        cap = Text("candidate answers, smallest → largest", font_size=22,
                   color=INK_MUTED).next_to(cand.row, UP, buff=0.3)
        self.play(FadeIn(cap), run_time=1.0)
        self.play(*[FadeIn(b) for b in cand.badges], run_time=1.4)
        paint_feasibility(cand, feas)
        wait_until(self, 8.0)

        inf = region_brace(cand, 0, 4, "infeasible ✗", ROSE, side=DOWN)
        fea = region_brace(cand, 5, 9, "feasible ✓", EMERALD, side=DOWN)
        self.play(Create(inf), Create(fea), run_time=1.8)
        ring = boundary_ring(cand.row.cells[5])
        blab = fit_label("the boundary = the answer", 5.0, 24, C_ANSWER).move_to([0, 2.1, 0])
        self.play(Create(ring), FadeIn(blab), run_time=1.8)
        wait_until(self, 16.0)

        fam = VGroup(
            chip("Koko Eating Bananas", color=ACCENT, w=4.0, h=0.8, fs=20),
            chip("Split Array Largest Sum", color=VIOLET, w=4.0, h=0.8, fs=20),
            chip("Magnetic Force", color=AMBER, w=4.0, h=0.8, fs=20),
        ).arrange(RIGHT, buff=0.3).move_to([0, -2.4, 0])
        self.play(*[FadeIn(c) for c in fam], run_time=1.8)
        self.guard(cand, cap, inf, fea, ring, blab, fam)
        pace_to(self, self.cue_duration)


# ─── Cue01 : Koko ────────────────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Koko: search on speed, check against h hours"
    cue_duration = 134.4

    def construct(self):
        piles = [3, 6, 7, 11]
        row = value_row(piles, w=1.15, h=0.85, fs=30, index=False).move_to([0, 1.7, 0])
        cap = Text("piles of bananas", font_size=22, color=INK_MUTED).next_to(row, UP, buff=0.22)
        self.play(FadeIn(row), FadeIn(cap), run_time=1.4)
        wait_until(self, 3.5)

        oracle = MathTex(r"\text{can}(k):\quad \sum_i \left\lceil \frac{pile_i}{k} \right\rceil \ \le\ h",
                         color=INK).scale(0.8).move_to([0, 0.35, 0])
        self.play(Write(oracle), run_time=2.0)
        wait_until(self, 9.0)

        # k = 4 → hours [1,2,2,3] = 8 ≤ h
        k = 4
        hours = [(p + k - 1) // k for p in piles]
        krow = chip(f"speed k = {k}", color=ACCENT, w=3.4, h=0.85, fs=25).move_to([-3.4, -1.1, 0])
        hlab = Text(f"hours = {'+'.join(map(str,hours))} = {sum(hours)}",
                    font_size=26, color=EMERALD).move_to([1.6, -1.1, 0])
        self.play(FadeIn(krow), run_time=1.0)
        self.play(FadeIn(hlab), run_time=1.4)
        wait_until(self, 16.0)

        verdict = Text(f"{sum(hours)} ≤ 8  →  feasible; try a smaller speed",
                       font_size=26, color=C_FEASIBLE, weight="BOLD").move_to([0, -2.4, 0])
        self.play(FadeIn(verdict), Circumscribe(verdict, color=C_FEASIBLE), run_time=2.0)
        self.guard(row, cap, oracle, krow, hlab, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue02 : monotonicity ────────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Faster is always enough — feasibility is monotonic"
    cue_duration = 127.7

    def construct(self):
        vals = [1, 2, 3, 4, 5, 6, 7, 8]
        feas = [v >= 4 for v in vals]
        cand = candidate_row(vals, feas, w=1.02, h=0.74, fs=24).move_to([0, 0.7, 0])
        cap = Text("eating speed k", font_size=22, color=INK_MUTED).next_to(cand.row, UP, buff=0.3)
        self.play(FadeIn(cand.row), FadeIn(cap), run_time=1.4)
        self.play(*[FadeIn(b) for b in cand.badges], run_time=1.2)
        paint_feasibility(cand, feas)
        wait_until(self, 7.0)

        arrow = Arrow([cand.row.cells[3].get_center()[0], -1.1, 0],
                      [cand.row.cells[7].get_center()[0], -1.1, 0],
                      buff=0.1, color=EMERALD, stroke_width=5)
        note = Text("if speed k works, k+1 works — eating faster never takes longer",
                    font_size=23, color=INK).move_to([0, -1.9, 0])
        self.play(GrowArrow(arrow), run_time=1.4)
        self.play(FadeIn(note), run_time=1.4)
        wait_until(self, 14.0)

        key = Text("one clean ✗→✓ flip → binary search finds it",
                   font_size=25, color=C_ANSWER, weight="BOLD").move_to([0, -2.7, 0])
        self.play(FadeIn(key), Circumscribe(key, color=C_ANSWER), run_time=2.0)
        self.guard(cand, cap, arrow, note, key)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the template ────────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Three pieces: range, feasibility oracle, binary search"
    cue_duration = 127.7

    def construct(self):
        p1 = VGroup(
            chip("1. RANGE", color=AMBER, w=3.0, h=0.7, fs=22),
            Text("lo, hi = tightest bounds", font_size=22, color=INK_MUTED),
        ).arrange(DOWN, buff=0.18).move_to([-4.0, 1.4, 0])
        p2 = VGroup(
            chip("2. ORACLE", color=ACCENT, w=3.0, h=0.7, fs=22),
            Text("can(x) → True/False", font_size=22, color=INK_MUTED),
            Text("monotonic", font_size=20, color=EMERALD),
        ).arrange(DOWN, buff=0.16).move_to([0, 1.4, 0])
        p3 = VGroup(
            chip("3. SEARCH", color=EMERALD, w=3.0, h=0.7, fs=22),
            Text("collapse to the", font_size=22, color=INK_MUTED),
            Text("boundary", font_size=22, color=INK_MUTED),
        ).arrange(DOWN, buff=0.16).move_to([4.0, 1.4, 0])
        self.play(FadeIn(p1), run_time=1.2)
        self.play(FadeIn(p2), run_time=1.2)
        self.play(FadeIn(p3), run_time=1.2)
        wait_until(self, 8.0)

        skeleton = VGroup(
            code_line("lo, hi = RANGE", INK, 24),
            code_line("while lo < hi:", INK, 24),
            code_line("mid = (lo + hi) // 2", ACCENT_LIGHT, 24, indent=1),
            code_line("if can(mid):  hi = mid", EMERALD, 24, indent=1),
            code_line("else:         lo = mid + 1", AMBER, 24, indent=1),
            code_line("return lo", C_ANSWER, 24),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.14).move_to([0, -1.5, 0])
        self.play(Write(skeleton), run_time=2.6)
        note = Text("same structure every time — only can() changes",
                    font_size=22, color=INK_MUTED).next_to(skeleton, DOWN, buff=0.3)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(p1, p2, p3, skeleton, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : upper search flips direction ────────────────────────────────────
class Cue04(AvoScene):
    headline = "Magnetic Force flips it: maximize the minimum gap"
    cue_duration = 134.3

    def construct(self):
        vals = [1, 2, 3, 4, 5, 6, 7, 8]
        feas = [v <= 3 for v in vals]                     # ✓✓✓✗✗✗✗✗
        cand = candidate_row(vals, feas, w=1.02, h=0.74, fs=24).move_to([0, 0.7, 0])
        cap = Text("candidate minimum gap", font_size=22, color=INK_MUTED).next_to(cand.row, UP, buff=0.3)
        self.play(FadeIn(cand.row), FadeIn(cap), run_time=1.4)
        self.play(*[FadeIn(b) for b in cand.badges], run_time=1.2)
        paint_feasibility(cand, feas)
        wait_until(self, 7.0)

        note = Text("small gaps fit ✓, large gaps do not ✗ — search for the LAST ✓",
                    font_size=23, color=INK).move_to([0, -1.2, 0])
        ring = boundary_ring(cand.row.cells[2])
        self.play(FadeIn(note), Create(ring), run_time=1.8)
        wait_until(self, 14.0)

        roundup = MathTex(r"\text{upper: } mid = (lo + hi + 1)\ //\ 2 \quad(\text{round UP})",
                          color=C_ANSWER).scale(0.62).move_to([0, -2.4, 0])
        self.play(Write(roundup), Circumscribe(roundup, color=C_ANSWER), run_time=2.0)
        self.guard(cand, cap, note, ring, roundup)
        pace_to(self, self.cue_duration)


# ─── Cue05 : Split Array ─────────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Split Array: minimize the max subarray sum"
    cue_duration = 134.4

    def construct(self):
        nums = [7, 2, 5, 10, 8]
        row = value_row(nums, w=1.1, h=0.82, fs=28, index=False).move_to([0, 1.6, 0])
        self.play(FadeIn(row), run_time=1.4)
        cchip = chip("candidate = max allowed sum", color=ACCENT, w=6.0, h=0.85, fs=24).move_to([0, -0.5, 0])
        self.play(FadeIn(cchip), run_time=1.0)
        wait_until(self, 4.0)

        # greedy oracle at candidate 18 → [7,2,5]=14, [10,8]=18 → 2 subarrays
        parts = [(0, 2, 14, EMERALD), (3, 4, 18, VIOLET)]
        brs = VGroup()
        for lo, hi, s, col in parts:
            grp = VGroup(*row.cells[lo:hi + 1])
            br = SurroundingRectangle(grp, color=col, buff=0.12, corner_radius=0.10)
            br.set_stroke(width=3.2)
            slab = Text(f"Σ={s}", font_size=22, color=col, weight="BOLD").next_to(br, DOWN, buff=0.2)
            brs.add(br, slab)
            self.play(Create(br), FadeIn(slab), run_time=1.4)
        wait_until(self, 12.0)

        note = Text("feasibility = greedy scan counts subarrays; lower search for leftmost ≤",
                    font_size=22, color=INK_MUTED).move_to([0, -1.7, 0])
        verdict = Text("2 subarrays ≤ k → 18 is feasible", font_size=25, color=C_FEASIBLE,
                       weight="BOLD").move_to([0, -2.5, 0])
        self.play(FadeIn(note), run_time=1.2)
        self.play(FadeIn(verdict), Circumscribe(verdict, color=C_FEASIBLE), run_time=1.8)
        self.guard(row, cchip, brs, note, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue06 : off-by-one ──────────────────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Round up prevents the infinite loop"
    cue_duration = 134.4

    def construct(self):
        setup = Text("upper search, lo = 3, hi = 4  (differ by one)",
                     font_size=26, color=INK).move_to([0, 1.6, 0])
        self.play(FadeIn(setup), run_time=1.2)
        wait_until(self, 3.5)

        bad = VGroup(
            MathTex(r"mid = (3 + 4)\ //\ 2 = 3", color=ROSE).scale(0.7),
            Text("feasible → lo = 3 (unchanged) → loops forever", font_size=24, color=ROSE),
        ).arrange(DOWN, buff=0.24).move_to([0, 0.2, 0])
        self.play(Write(bad[0]), run_time=1.4)
        self.play(FadeIn(bad[1]), run_time=1.2)
        wait_until(self, 12.0)

        good = VGroup(
            MathTex(r"mid = (3 + 4 + 1)\ //\ 2 = 4", color=C_ANSWER).scale(0.7),
            Text("the range finally moves — no infinite loop", font_size=24, color=EMERALD),
        ).arrange(DOWN, buff=0.24).move_to([0, -1.8, 0])
        self.play(Write(good[0]), run_time=1.4)
        self.play(FadeIn(good[1]), Circumscribe(good[0], color=C_ANSWER), run_time=1.8)
        self.guard(setup, bad, good)
        pace_to(self, self.cue_duration)


# ─── Cue07 : recognition ─────────────────────────────────────────────────────
class Cue07(AvoScene):
    headline = "Recognition: monotonic can() ⇒ binary search on the answer"
    cue_duration = 100.8

    def construct(self):
        rule = MathTex(
            r"\text{monotonic } \text{can}(x) \in \text{poly-time} \;\Rightarrow\; "
            r"\text{binary search the answer}",
            color=INK).scale(0.62).move_to([0, 1.5, 0])
        self.play(Write(rule), run_time=2.2)
        wait_until(self, 6.0)

        checklist = VGroup(
            Text("① the answer is a number in a known range", font_size=25, color=INK),
            Text("② can(candidate) is True/False and monotonic", font_size=25, color=INK),
            Text("③ can() runs in polynomial time", font_size=25, color=INK),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.34).move_to([0, -0.6, 0])
        for c in checklist:
            self.play(FadeIn(c), run_time=1.1)
        wait_until(self, 16.0)

        close = Text("all three ✓ → stop searching the input, search the answer",
                     font_size=25, color=C_ANSWER, weight="BOLD").move_to([0, -2.7, 0])
        self.play(FadeIn(close), Circumscribe(close, color=C_ANSWER), run_time=2.0)
        self.guard(rule, checklist, close)
        pace_to(self, self.cue_duration)
