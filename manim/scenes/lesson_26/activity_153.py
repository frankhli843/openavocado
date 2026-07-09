"""
Lesson 26 — Part 1 (activity 153): "Lower binary search — Koko Eating Bananas
and Split Array Largest Sum" (122.8s, 6 cues).

The concrete walkthrough of the LOWER template behind the orientation: find the
SMALLEST feasible candidate. The predicate can(candidate) is monotonic ✗…✗✓…✓,
so binary search collapses [lo..hi] onto the first ✓ — the answer. Two problems,
one template: Koko searches on eating speed (feasibility = ceil-division hours ≤
h), Split Array searches on the max allowed subarray sum (feasibility = a greedy
left-to-right partition needs ≤ k subarrays).

Uses binsearch.py (candidate_row, paint_feasibility, lohi_pointers,
boundary_ring) + arrays.py (value_row, value_badge, code_line, complexity), NOT
the transformer / graph idioms. MathTex is reserved for the one complexity bound
O(n·log(max piles)).

Cue00 0-22.3    lower template: lo<hi, mid=(lo+hi)//2, feasible→hi=mid else lo=mid+1
Cue01 22.3-46.2 Koko: ceil(pile/speed) hours, sum ≤ h is the feasibility oracle
Cue02 46.2-70.7 Split Array: same template, greedy partition counts subarrays
Cue03 70.7-95.3 range bounds: lo = max element, hi = total sum
Cue04 95.3-111.7 zero-init trap: lo=0 tests a meaningless candidate
Cue05 111.7-122.8 greedy is optimal: extend each subarray as far as possible
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from binsearch import (
    candidate_row, paint_feasibility, lohi_pointers, boundary_ring,
    C_LO, C_HI, C_MID, C_FEASIBLE, C_INFEASIBLE, C_ANSWER,
)
from arrays import value_row, value_badge, recolor_cell, code_line, complexity
from bayes import chip, fit_label
from manim import (
    VGroup, Text, MathTex, Arrow, Line, Dot, RoundedRectangle, Brace,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, GrowArrow,
    GrowFromCenter, Create, RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : the lower template ──────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Lower search: lo < hi, mid = (lo + hi) // 2"
    cue_duration = 22.3

    def construct(self):
        lines = VGroup(
            code_line("lo, hi = min_cand, max_cand", INK, 26),
            code_line("while lo < hi:", INK, 26),
            code_line("mid = (lo + hi) // 2", ACCENT_LIGHT, 26, indent=1),
            code_line("if can(mid):  hi = mid", EMERALD, 26, indent=1),
            code_line("else:         lo = mid + 1", AMBER, 26, indent=1),
            code_line("return lo   # first feasible", C_ANSWER, 26),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.16).move_to([0, 1.35, 0])
        self.play(Write(lines), run_time=3.0)
        wait_until(self, 5.0)

        vals = [1, 2, 3, 4, 5, 6, 7, 8]
        feas = [v >= 4 for v in vals]                     # ✗✗✗✓✓✓✓✓
        cand = candidate_row(vals, feas, w=1.02, h=0.74, fs=24).move_to([0, -1.55, 0])
        self.play(FadeIn(cand.row), run_time=1.2)
        self.play(*[FadeIn(b) for b in cand.badges], run_time=1.0)
        paint_feasibility(cand, feas)
        self.play(*[Indicate(cand.row.cells[i], color=cand.badges[i].get_color(),
                             scale_factor=1.06) for i in range(len(vals))],
                  run_time=1.4)
        wait_until(self, 12.0)

        ring = boundary_ring(cand.row.cells[3])           # value 4 = first ✓
        lab = fit_label("first ✓ = the answer", 4.6, 24, C_ANSWER).next_to(
            cand.row, UP, buff=0.3)
        self.play(Create(ring), FadeIn(lab), run_time=1.6)
        self.guard(lines, cand, ring, lab)
        pace_to(self, self.cue_duration)


# ─── Cue01 : Koko — ceiling division hours ───────────────────────────────────
class Cue01(AvoScene):
    headline = "Koko: hours = Σ ceil(pile / speed) ≤ h"
    cue_duration = 23.9

    def construct(self):
        piles = [3, 6, 7, 11]
        speed = 4
        hours = [(p + speed - 1) // speed for p in piles]   # [1,2,2,3]
        total = sum(hours)                                  # 8

        row = value_row(piles, w=1.15, h=0.85, fs=30, index=False).move_to([0, 1.55, 0])
        cap = Text("piles", font_size=22, color=INK_MUTED).next_to(row, UP, buff=0.22)
        self.play(FadeIn(row), FadeIn(cap), run_time=1.2)
        speed_chip = chip(f"speed k = {speed}", color=ACCENT, w=3.4, h=0.9, fs=26)
        speed_chip.move_to([0, 0.35, 0])
        self.play(FadeIn(speed_chip), run_time=1.0)
        wait_until(self, 5.0)

        formula = MathTex(r"\lceil pile / k \rceil = (pile + k - 1)\ //\ k",
                          color=INK).scale(0.75).move_to([0, -0.55, 0])
        self.play(Write(formula), run_time=1.6)
        wait_until(self, 10.0)

        hrow = VGroup(*[Text(str(hours[i]), font_size=30, color=EMERALD, weight="BOLD")
                        .move_to([row.cells[i].get_center()[0], -1.55, 0])
                        for i in range(len(piles))])
        hcap = Text("hours per pile", font_size=20, color=INK_MUTED).next_to(hrow, LEFT, buff=0.4)
        self.play(*[FadeIn(h) for h in hrow], FadeIn(hcap), run_time=1.5)
        wait_until(self, 16.0)

        badge = value_badge("hours =", total, color=EMERALD, w=3.4, h=0.95).move_to([-2.4, -2.55, 0])
        cmp = Text(f"{total} ≤ h = 8   ✓ feasible", font_size=26, color=C_FEASIBLE,
                   weight="BOLD").move_to([2.3, -2.55, 0])
        self.play(FadeIn(badge), run_time=1.0)
        self.play(FadeIn(cmp), Circumscribe(cmp, color=C_FEASIBLE), run_time=1.6)
        self.guard(row, cap, speed_chip, formula, hrow, badge, cmp)
        pace_to(self, self.cue_duration)


# ─── Cue02 : Split Array — greedy partition ──────────────────────────────────
class Cue02(AvoScene):
    headline = "Split Array: candidate = max sum, count subarrays"
    cue_duration = 24.5

    def construct(self):
        nums = [7, 2, 5, 10, 8]
        cand_max = 18
        row = value_row(nums, w=1.1, h=0.82, fs=28, index=False).move_to([0, 1.5, 0])
        self.play(FadeIn(row), run_time=1.2)
        cchip = chip(f"max allowed sum ≤ {cand_max}", color=ACCENT, w=5.4, h=0.9, fs=26)
        cchip.move_to([0, -0.55, 0])
        self.play(FadeIn(cchip), run_time=1.0)
        wait_until(self, 4.5)

        # greedy scan: [7,2,5] = 14, then [10,8] = 18  → 2 subarrays
        parts = [(0, 2, 14), (3, 4, 18)]
        pcols = [EMERALD, VIOLET]
        brs = VGroup()
        for k, (lo, hi, s) in enumerate(parts):
            grp = VGroup(*row.cells[lo:hi + 1])
            from manim import SurroundingRectangle
            br = SurroundingRectangle(grp, color=pcols[k], buff=0.12, corner_radius=0.10)
            br.set_stroke(width=3.4)
            slab = Text(f"Σ={s}", font_size=24, color=pcols[k], weight="BOLD").next_to(br, DOWN, buff=0.22)
            brs.add(br, slab)
            self.play(Create(br), FadeIn(slab), run_time=1.4)
            wait_until(self, 7.0 + k * 4.5)

        note = Text("greedy: extend until adding would exceed the candidate",
                    font_size=22, color=INK_MUTED).move_to([0, -1.65, 0])
        cmp = Text("2 subarrays ≤ k = 2   ✓ feasible", font_size=26, color=C_FEASIBLE,
                   weight="BOLD").move_to([0, -2.55, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.play(FadeIn(cmp), Circumscribe(cmp, color=C_FEASIBLE), run_time=1.6)
        self.guard(row, cchip, brs, note, cmp)
        pace_to(self, self.cue_duration)


# ─── Cue03 : range bounds ────────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Range: lo = max element, hi = total sum"
    cue_duration = 24.6

    def construct(self):
        nums = [7, 2, 5, 10, 8]
        row = value_row(nums, w=1.1, h=0.82, fs=28, index=False).move_to([0, 1.35, 0])
        self.play(FadeIn(row), run_time=1.2)
        # highlight the max element
        recolor_cell(row.cells[3], AMBER)
        self.play(Indicate(row.cells[3], color=AMBER, scale_factor=1.15), run_time=1.4)
        wait_until(self, 4.0)

        lo_line = VGroup(
            Text("lo = max element = 10", font_size=28, color=AMBER, weight="BOLD"),
            Text("no single subarray can be smaller than the biggest element",
                 font_size=21, color=INK_MUTED),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.14).move_to([0, -0.35, 0])
        self.play(FadeIn(lo_line), run_time=1.4)
        wait_until(self, 11.0)

        hi_line = VGroup(
            Text("hi = total sum = 32", font_size=28, color=ROSE, weight="BOLD"),
            Text("one subarray can hold everything (k = 1)",
                 font_size=21, color=INK_MUTED),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.14).move_to([0, -1.85, 0])
        self.play(FadeIn(hi_line), run_time=1.4)
        wait_until(self, 18.0)

        rng = Text("search only [10 .. 32]", font_size=26, color=ACCENT,
                   weight="BOLD").move_to([0, -2.75, 0])
        self.play(FadeIn(rng), Circumscribe(rng, color=ACCENT), run_time=1.6)
        self.guard(row, lo_line, hi_line, rng)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the lo = 0 trap ─────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "lo = 0 tests a meaningless candidate"
    cue_duration = 16.4

    def construct(self):
        warn = chip("lo = 0  ✗", color=ROSE, w=3.4, h=1.0, fs=30).move_to([0, 1.55, 0])
        self.play(FadeIn(warn), run_time=1.0)
        wait_until(self, 2.5)

        rows = VGroup(
            Text("Koko:  speed 0  →  infinite hours", font_size=26, color=INK),
            Text("Split: max sum 0  →  no element ever fits", font_size=26, color=INK),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4).move_to([0, 0.1, 0])
        self.play(FadeIn(rows[0]), run_time=1.2)
        wait_until(self, 7.0)
        self.play(FadeIn(rows[1]), run_time=1.2)
        wait_until(self, 11.5)

        fix = Text("always use the tightest meaningful lower bound",
                   font_size=26, color=C_ANSWER, weight="BOLD").move_to([0, -1.85, 0])
        self.play(FadeIn(fix), Circumscribe(fix, color=C_ANSWER), run_time=1.8)
        self.guard(warn, rows, fix)
        pace_to(self, self.cue_duration)


# ─── Cue05 : greedy is optimal ───────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Greedy uses the fewest subarrays"
    cue_duration = 11.1

    def construct(self):
        line = Text("extend each subarray as far as the candidate allows",
                    font_size=26, color=INK).move_to([0, 1.1, 0])
        self.play(FadeIn(line), run_time=1.2)
        wait_until(self, 3.0)

        claim = VGroup(
            Text("→ fewest subarrays for that candidate", font_size=25, color=EMERALD),
            Text("if greedy needs > k, nothing else fits in k either",
                 font_size=25, color=INK_MUTED),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.28).move_to([0, -0.5, 0])
        self.play(FadeIn(claim), run_time=1.5)
        bound = complexity(r"O(n \cdot \log(\max\ \text{piles}))", color=INK, fs=36).move_to([0, -2.2, 0])
        self.play(Write(bound), run_time=1.6)
        self.guard(line, claim, bound)
        pace_to(self, self.cue_duration)
