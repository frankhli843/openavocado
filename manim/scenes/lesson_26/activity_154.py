"""
Lesson 26 — Part 2 (activity 154): "Upper binary search — Magnetic Force and the
round-up trap" (112.2s, 6 cues).

The UPPER template: find the LARGEST feasible candidate. Magnetic Force (a.k.a.
Aggressive Cows) flips the monotonic direction — small gaps are feasible ✓,
large gaps are not ✗ — so we search for the LAST ✓. The one dangerous detail is
the mid rounding: an upper search MUST round mid up, mid = (lo + hi + 1) // 2,
or a feasible tie sets lo = lo and the loop spins forever.

Uses binsearch.py (candidate_row, paint_feasibility, boundary_ring) + arrays.py
(value_row, code_line, complexity). The positions live on a number line (Dots on
a Line) so "place a ball at the earliest valid spot" and the exchange-argument
slide read spatially. MathTex is reserved for the complexity bound.

Cue00 0-20.4    upper template: mid = (lo+hi+1)//2 rounds UP; feasible→lo=mid
Cue01 20.4-42.1 greedy: sort, start at pos0, place when gap ≥ candidate
Cue02 42.1-64.6 exchange proof: slide any optimal left to greedy, gaps never shrink
Cue03 64.6-87   range: lo = 1, hi = span / (m-1)
Cue04 87-102    update rule: feasible lo=mid, infeasible hi=mid-1
Cue05 102-112.2 off-by-one: rounding down loops forever
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from binsearch import (
    candidate_row, paint_feasibility, boundary_ring,
    C_LO, C_HI, C_MID, C_FEASIBLE, C_INFEASIBLE, C_ANSWER,
)
from arrays import value_row, recolor_cell, code_line, complexity
from bayes import chip, fit_label
from manim import (
    VGroup, Text, MathTex, Arrow, Line, Dot, DoubleArrow, RoundedRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, GrowArrow,
    GrowFromCenter, Create, RIGHT, LEFT, UP, DOWN,
)

POS = [1, 2, 4, 8, 9]              # sorted positions
M = 3                              # balls to place
X0, X1 = -5.4, 5.4                 # number-line endpoints (x units)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def number_line(y=0.0, positions=POS):
    """A number line with a Dot + value label at each position. Returns
    VGroup(line, dots_group) with .dots (list) and .px (pos→x mapper)."""
    lo, hi = positions[0], positions[-1]
    line = Line([X0, y, 0], [X1, y, 0], color=INK_SUBTLE, stroke_width=4)

    def px(p):
        return X0 + (X1 - X0) * (p - lo) / (hi - lo)

    dots = []
    grp = VGroup(line)
    for p in positions:
        d = Dot([px(p), y, 0], radius=0.11, color=INK_MUTED)
        lab = Text(str(p), font_size=22, color=INK).next_to(d, DOWN, buff=0.16)
        grp.add(d, lab)
        dots.append(d)
    grp.dots = dots
    grp.px = px
    grp.y = y
    return grp


# ─── Cue00 : upper template ──────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Upper search: mid = (lo + hi + 1) // 2 rounds UP"
    cue_duration = 20.4

    def construct(self):
        lines = VGroup(
            code_line("lo, hi = 1, max_gap", INK, 26),
            code_line("while lo < hi:", INK, 26),
            code_line("mid = (lo + hi + 1) // 2   # round UP", ACCENT_LIGHT, 26, indent=1),
            code_line("if can(mid):  lo = mid", EMERALD, 26, indent=1),
            code_line("else:         hi = mid - 1", AMBER, 26, indent=1),
            code_line("return lo   # last feasible", C_ANSWER, 26),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.16).move_to([0, 1.2, 0])
        self.play(Write(lines), run_time=3.0)
        wait_until(self, 5.0)

        vals = [1, 2, 3, 4, 5]
        feas = [v <= 3 for v in vals]                     # ✓✓✓✗✗ (small gaps feasible)
        cand = candidate_row(vals, feas, w=1.02, h=0.72, fs=24).move_to([0, -1.7, 0])
        self.play(FadeIn(cand.row), run_time=1.0)
        self.play(*[FadeIn(b) for b in cand.badges], run_time=1.0)
        paint_feasibility(cand, feas)
        wait_until(self, 12.0)

        ring = boundary_ring(cand.row.cells[2])           # value 3 = last ✓
        lab = fit_label("last ✓ = the answer", 4.6, 24, C_ANSWER).next_to(
            cand.row, UP, buff=0.28)
        self.play(Create(ring), FadeIn(lab), run_time=1.6)
        self.guard(lines, cand, ring, lab)
        pace_to(self, self.cue_duration)


# ─── Cue01 : greedy placement ────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Greedy: place a ball at the earliest valid spot"
    cue_duration = 21.7

    def construct(self):
        nl = number_line(y=0.4)
        self.play(Create(nl[0]), *[GrowFromCenter(d) for d in nl.dots], run_time=1.6)
        self.play(*[FadeIn(m) for m in nl if isinstance(m, Text)], run_time=0.8)
        cchip = chip("candidate gap d = 3", color=ACCENT, w=4.6, h=0.85, fs=25).move_to([0, 2.0, 0])
        self.play(FadeIn(cchip), run_time=1.0)
        wait_until(self, 4.5)

        # greedy places at 1, then next ≥ 4 → 4, then next ≥ 7 → 8  (3 balls)
        placed = [1, 4, 8]
        balls = VGroup()
        for k, p in enumerate(placed):
            b = Dot([nl.px(p), 0.4, 0], radius=0.17, color=EMERALD)
            tag = Text("●", font_size=18, color=EMERALD)  # unused visual anchor
            balls.add(b)
            self.play(GrowFromCenter(b), Indicate(b, color=EMERALD, scale_factor=1.5),
                      run_time=1.2)
            if k > 0:
                gap = DoubleArrow([nl.px(placed[k - 1]), 1.0, 0], [nl.px(p), 1.0, 0],
                                  buff=0.05, color=AMBER, stroke_width=4,
                                  tip_length=0.18)
                glab = Text(f"gap {p - placed[k-1]} ≥ 3", font_size=20, color=AMBER)
                glab.next_to(gap, UP, buff=0.1)
                balls.add(gap, glab)
                self.play(GrowArrow(gap), FadeIn(glab), run_time=1.0)
            wait_until(self, 6.0 + k * 4.0)

        ok = Text("placed all 3 balls  ✓ feasible", font_size=26, color=C_FEASIBLE,
                  weight="BOLD").move_to([0, -1.9, 0])
        self.play(FadeIn(ok), Circumscribe(ok, color=C_FEASIBLE), run_time=1.6)
        self.guard(nl, cchip, balls, ok)
        pace_to(self, self.cue_duration)


# ─── Cue02 : exchange argument ───────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Any optimal placement slides left to greedy"
    cue_duration = 22.5

    def construct(self):
        top = number_line(y=1.5)
        self.play(Create(top[0]), *[GrowFromCenter(d) for d in top.dots], run_time=1.4)
        cap1 = Text("some optimal placement", font_size=22, color=VIOLET).next_to(top, UP, buff=0.2)
        # an optimal-but-not-greedy placement: 2, 4, 9
        opt = [2, 4, 9]
        ob = VGroup(*[Dot([top.px(p), 1.5, 0], radius=0.16, color=VIOLET) for p in opt])
        self.play(FadeIn(cap1), *[GrowFromCenter(d) for d in ob], run_time=1.4)
        wait_until(self, 6.0)

        bot = number_line(y=-1.4)
        self.play(Create(bot[0]), *[GrowFromCenter(d) for d in bot.dots], run_time=1.2)
        cap2 = Text("greedy (each ball as far left as valid)", font_size=22,
                    color=EMERALD).next_to(bot, DOWN, buff=0.2)
        grd = [1, 4, 8]
        gb = VGroup(*[Dot([bot.px(p), -1.4, 0], radius=0.16, color=EMERALD) for p in grd])
        self.play(FadeIn(cap2), *[GrowFromCenter(d) for d in gb], run_time=1.4)
        wait_until(self, 12.0)

        slides = VGroup(*[Arrow([top.px(opt[i]), 0.9, 0], [bot.px(grd[i]), -0.8, 0],
                                buff=0.1, color=AMBER, stroke_width=4)
                          for i in range(len(opt))])
        self.play(*[GrowArrow(a) for a in slides], run_time=1.8)
        note = Text("sliding left never shrinks a gap → greedy is never worse",
                    font_size=23, color=INK_MUTED).move_to([0, -2.7, 0])
        self.play(FadeIn(note), run_time=1.2)
        self.guard(top, cap1, ob, bot, cap2, gb, slides, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : range ───────────────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Range: lo = 1, hi = span / (m - 1)"
    cue_duration = 22.4

    def construct(self):
        nl = number_line(y=0.6)
        self.play(Create(nl[0]), *[GrowFromCenter(d) for d in nl.dots], run_time=1.4)
        self.play(*[FadeIn(m) for m in nl if isinstance(m, Text)], run_time=0.8)
        wait_until(self, 3.0)

        span = DoubleArrow([nl.px(1), 1.7, 0], [nl.px(9), 1.7, 0], buff=0.05,
                           color=ACCENT, stroke_width=4, tip_length=0.2)
        slab = Text("span = 9 − 1 = 8", font_size=24, color=ACCENT).next_to(span, UP, buff=0.12)
        self.play(GrowArrow(span), FadeIn(slab), run_time=1.6)
        wait_until(self, 8.0)

        lo_line = Text("lo = 1   (distinct positions, smallest gap is 1)",
                       font_size=24, color=AMBER).move_to([0, -1.4, 0])
        hi_line = MathTex(r"hi = \dfrac{\text{span}}{m-1} = \dfrac{8}{2} = 4",
                          color=ROSE).scale(0.7).move_to([0, -2.4, 0])
        self.play(FadeIn(lo_line), run_time=1.2)
        wait_until(self, 15.0)
        self.play(Write(hi_line), run_time=1.6)
        self.guard(nl, span, slab, lo_line, hi_line)
        pace_to(self, self.cue_duration)


# ─── Cue04 : update rule ─────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Feasible → lo = mid   |   Infeasible → hi = mid − 1"
    cue_duration = 15.0

    def construct(self):
        left = VGroup(
            chip("can(mid) ✓", color=EMERALD, w=3.6, h=0.9, fs=26),
            Text("push lo up: lo = mid", font_size=24, color=EMERALD),
            Text("try LARGER gaps", font_size=22, color=INK_MUTED),
        ).arrange(DOWN, buff=0.3).move_to([-3.3, 0.1, 0])
        right = VGroup(
            chip("can(mid) ✗", color=ROSE, w=3.6, h=0.9, fs=26),
            Text("pull hi down: hi = mid − 1", font_size=24, color=ROSE),
            Text("gap too big", font_size=22, color=INK_MUTED),
        ).arrange(DOWN, buff=0.3).move_to([3.3, 0.1, 0])
        divider = Line([0, 1.4, 0], [0, -1.4, 0], color=INK_SUBTLE, stroke_width=2)
        self.play(FadeIn(left[0]), FadeIn(right[0]), Create(divider), run_time=1.4)
        wait_until(self, 4.5)
        self.play(FadeIn(left[1]), FadeIn(left[2]), run_time=1.2)
        self.play(FadeIn(right[1]), FadeIn(right[2]), run_time=1.2)
        note = Text("keep the feasible mid as a live answer — that is why lo = mid",
                    font_size=22, color=INK_MUTED).move_to([0, -2.3, 0])
        self.play(FadeIn(note), run_time=1.2)
        self.guard(left, right, divider, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : off-by-one ──────────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Round down and the loop spins forever"
    cue_duration = 10.2

    def construct(self):
        setup = Text("lo = 3, hi = 4   (differ by one)", font_size=26, color=INK).move_to([0, 1.3, 0])
        self.play(FadeIn(setup), run_time=1.0)
        bad = VGroup(
            Text("round down: mid = (3+4)//2 = 3", font_size=24, color=ROSE),
            Text("feasible → lo = 3 … unchanged → ∞ loop", font_size=24, color=ROSE),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.18).move_to([0, 0.0, 0])
        self.play(FadeIn(bad), run_time=1.4)
        wait_until(self, 5.0)
        good = MathTex(r"\text{round up: } mid = (3+4+1)//2 = 4", color=C_ANSWER).scale(0.7).move_to([0, -1.5, 0])
        self.play(Write(good), Circumscribe(good, color=C_ANSWER), run_time=1.8)
        self.guard(setup, bad, good)
        pace_to(self, self.cue_duration)
