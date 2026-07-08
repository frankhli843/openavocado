"""
Lesson 18 — Orientation (activity 103): "Two Pointer — the family map"
(903.91s / ~15.1min overview audio).

The overview audio is the high-level map of the whole two-pointer family.
Following the proven orientation pattern (acts 7/14/38/72/76/80/98), the timeline
is the SEVEN designed cues spread over the real duration, each authored for the
actual two-pointer content:

  Cue00 0-107.6    The O(n²) pair search — a nested loop over every pair
  Cue01 107.6-243.9 Sorted makes a comparison decisive — one comparison kills a side
  Cue02 243.9-387.4 Converging branch — fingers walk toward each other
  Cue03 387.4-545.2 Read / write branch — same direction, two jobs, compact in place
  Cue04 545.2-688.7 Fast / slow branch — one path, two speeds, gap shrinks → collision
  Cue05 688.7-803.5 When it fails — no structure, no license (unsorted breaks it)
  Cue06 803.5-903.9 Recognition & window kinship — a window is a same-direction pair

Each long cue stages its reveals via wait_until(scene, t) so the frame keeps
changing with the narration; pace_to fills the remainder to hit the exact cue
duration. Uses the arrays.py idiom lib (value_row, recolor_cell, pointer,
value_badge, complexity, code_line) — the array/pointer vocabulary, NOT the
transformer / econ / Bayes idioms of other lessons. MathTex is reserved for the
complexity bounds.
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
    pointer,
    value_badge,
    complexity,
    code_line,
    C_ENTER,
    C_LEAVE,
    C_LEFT,
    C_RIGHT,
    C_RESULT,
)
from bayes import chip, fit_label
from manim import (
    VGroup,
    Text,
    MathTex,
    Line,
    Arrow,
    CurvedArrow,
    SurroundingRectangle,
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

SARR = [1, 3, 4, 6, 8, 11]   # sorted array for pair-search / converging cues
SARR_Y = 1.3


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_sorted(index=True, y=SARR_Y):
    row = value_row(SARR, w=0.9, h=0.9, fs=30, gap=0.18, index=index)
    row.move_to([0, y, 0])
    return row


# ─── Cue00 : the O(n²) pair search ───────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Brute force: check every pair"
    cue_duration = 107.6

    def construct(self):
        row = build_sorted()
        self.play(FadeIn(row, shift=UP * 0.2), run_time=2.0)
        goal = fit_label("find a pair that sums to a target", 9.0, BODY_SIZE, INK_MUTED)
        goal.to_edge(DOWN, buff=0.85)
        self.play(FadeIn(goal), run_time=1.6)

        pairs = value_badge("pairs tried", 0, color=ROSE, w=3.8).move_to([-4.2, -1.6, 0])
        self.play(FadeIn(pairs), run_time=1.0)
        wait_until(self, 12)

        # outer i fixed, inner j scans the rest — the nested loop
        n = len(SARR)
        ip = pointer(row.cells[0], "i", color=AMBER, side=UP, gap=0.75)
        self.play(FadeIn(ip), run_time=0.8)
        tried = 0
        # walk i over first 3 anchors, j over the tail for each (illustrative)
        anchors = [0, 1, 2]
        t = 14
        for a in anchors:
            ip2 = pointer(row.cells[a], "i", color=AMBER, side=UP, gap=0.75)
            self.play(Transform(ip, ip2), run_time=0.6)
            jp = pointer(row.cells[a + 1], "j", color=ACCENT, side=DOWN, gap=0.8)
            self.play(FadeIn(jp), run_time=0.5)
            for j in range(a + 1, n):
                wait_until(self, t)
                t += 2.6
                jp2 = pointer(row.cells[j], "j", color=ACCENT, side=DOWN, gap=0.8)
                self.play(Transform(jp, jp2), run_time=0.5)
                self.play(Indicate(VGroup(row.cells[a], row.cells[j]), color=INK_SUBTLE,
                                   scale_factor=1.06), run_time=0.4)
                tried += 1
                self.play(Transform(pairs, value_badge("pairs tried", tried, color=ROSE, w=3.8).move_to([-4.2, -1.6, 0])),
                          run_time=0.3)
            self.play(FadeOut(jp), run_time=0.4)

        wait_until(self, 92)
        waste = fit_label("every pair checked independently — the work grows with n²",
                          12.5, 22, ROSE).to_edge(DOWN, buff=0.85)
        self.play(FadeOut(goal), FadeIn(waste), run_time=1.4)
        on2 = complexity(r"O(n^2)", color=ROSE, fs=44).next_to(waste, UP, buff=0.35)
        self.play(Write(on2), run_time=1.4)
        self.guard(row, ip, pairs, waste, on2)
        pace_to(self, self.cue_duration)


# ─── Cue01 : sorted makes a comparison decisive ──────────────────────────────
class Cue01(AvoScene):
    headline = "Sorted: one comparison kills a whole side"
    cue_duration = 136.3

    def construct(self):
        row = build_sorted()
        self.add(row)
        wait_until(self, 4)

        srt = fit_label("on a sorted row, order carries information", 9.5, BODY_SIZE, INK_MUTED)
        srt.to_edge(DOWN, buff=0.85)
        self.play(FadeIn(srt), run_time=1.6)
        wait_until(self, 18)

        # L on smallest, R on largest — the widest sum
        tgt = value_badge("target", 10, color=AMBER, w=2.6).move_to([5.05, 2.2, 0])
        lp = pointer(row.cells[0], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[5], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[0], C_LEFT)
        recolor_cell(row.cells[5], C_RIGHT)
        self.play(FadeIn(tgt), FadeIn(lp), FadeIn(rp), run_time=1.8)
        wait_until(self, 40)

        # 1 + 11 = 12 > 10 : the largest paired with the smallest still overshoots
        s = MathTex(r"1 + 11 = ", "12", r" > 10", color=INK).scale(0.95).move_to([0, -1.4, 0])
        s[1].set_color(ROSE)
        self.play(Write(s), run_time=1.6)
        wait_until(self, 62)

        # the logical leap: if the smallest + 11 is too big, EVERY pair with 11 is too big
        leap = fit_label("if even the smallest value can't rescue 11, no pair with 11 works",
                         12.5, 22, ROSE).to_edge(DOWN, buff=0.85)
        self.play(FadeOut(srt), FadeIn(leap), run_time=1.6)
        wait_until(self, 84)

        # cross off the entire right side (the column under R)
        killx = MathTex(r"\times", color=ROSE).scale(1.4).move_to(row.cells[5].get_center())
        self.play(row.cells[5].animate.set_opacity(0.3), Write(killx), run_time=1.6)
        drop = Text("drop the whole right end in one move", font_size=24, color=ROSE, weight="BOLD")
        drop.next_to(s, DOWN, buff=0.4)
        self.play(FadeOut(leap), FadeIn(drop), run_time=1.4)
        wait_until(self, 116)

        # the payoff: each comparison discards a candidate, so O(n) not O(n²)
        payoff = MathTex(r"\text{one compare discards one candidate} \;\Rightarrow\; ", "O(n)",
                         color=INK).scale(0.85).to_edge(DOWN, buff=0.85)
        payoff[1].set_color(EMERALD)
        self.play(FadeOut(drop), Write(payoff), run_time=1.8)
        self.play(Circumscribe(payoff[1], color=EMERALD), run_time=1.2)
        self.guard(row, lp, rp, tgt, s, payoff)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the converging branch ───────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Converging: fingers walk toward each other"
    cue_duration = 143.5

    def construct(self):
        row = build_sorted()
        self.add(row)
        wait_until(self, 4)

        tgt = value_badge("target", 10, color=AMBER, w=2.6).move_to([5.05, 2.2, 0])
        lp = pointer(row.cells[0], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[5], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        recolor_cell(row.cells[0], C_LEFT)
        recolor_cell(row.cells[5], C_RIGHT)
        self.play(FadeIn(tgt), FadeIn(lp), FadeIn(rp), run_time=1.6)
        rule = fit_label("too big → retreat right;  too small → advance left", 11.0, 22, INK_MUTED)
        rule.to_edge(DOWN, buff=0.85)
        self.play(FadeIn(rule), run_time=1.4)
        wait_until(self, 26)

        s = MathTex(r"1 + 11 = ", "12", color=INK).scale(0.95).move_to([0, -1.3, 0])
        s[1].set_color(ROSE)
        self.play(Write(s), run_time=1.2)

        # the full convergence trace: (0,5)12>  (0,4)9<  (1,4)11>  (1,3)9<  (2,3)10=
        steps = [
            (0, 4, "1 + 8 = 9", 9, ACCENT, "under → push left", C_LEFT),
            (1, 4, "3 + 8 = 11", 11, ROSE, "over → drop right", C_RIGHT),
            (1, 3, "3 + 6 = 9", 9, ACCENT, "under → push left", C_LEFT),
            (2, 3, "4 + 6 = 10", 10, EMERALD, "found!", EMERALD),
        ]
        cur_l, cur_r = 0, 5
        t = 40
        for (nl, nr, tex, val, col, note, ncol) in steps:
            wait_until(self, t)
            t += 24
            # move whichever pointer changed
            if nl != cur_l:
                recolor_cell(row.cells[cur_l], INK_SUBTLE)
                lp2 = pointer(row.cells[nl], "L", color=C_LEFT, side=DOWN, gap=0.85)
                recolor_cell(row.cells[nl], C_LEFT if val != 10 else EMERALD)
                self.play(Transform(lp, lp2), run_time=1.2)
            if nr != cur_r:
                recolor_cell(row.cells[cur_r], INK_SUBTLE)
                rp2 = pointer(row.cells[nr], "R", color=C_RIGHT, side=DOWN, gap=0.85)
                recolor_cell(row.cells[nr], C_RIGHT if val != 10 else EMERALD)
                self.play(Transform(rp, rp2), run_time=1.2)
            cur_l, cur_r = nl, nr
            s2 = MathTex(tex.split("=")[0] + "= ", str(val), color=INK).scale(0.95).move_to([0, -1.3, 0])
            s2[1].set_color(col)
            self.play(Transform(s, s2), run_time=1.0)
            nt = Text(note, font_size=23, color=ncol, weight="BOLD").to_edge(DOWN, buff=0.85)
            self.play(FadeOut(rule), FadeIn(nt), run_time=1.0)
            rule = nt  # keep a handle so the next iteration fades this note out

        wait_until(self, 138)
        self.play(Circumscribe(VGroup(row.cells[2], row.cells[3]), color=EMERALD), run_time=1.6)
        self.guard(row, lp, rp, tgt, s)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the read / write branch ─────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Read / write: same direction, two jobs"
    cue_duration = 157.8

    RW = [1, 1, 2, 3, 3]

    def construct(self):
        row = value_row(self.RW, w=0.9, h=0.9, fs=30, gap=0.18, index=True)
        row.move_to([0, SARR_Y, 0])
        self.play(FadeIn(row, shift=UP * 0.15), run_time=1.8)
        goal = fit_label("compact a sorted array in place — remove duplicates", 10.5, BODY_SIZE, INK_MUTED)
        goal.to_edge(DOWN, buff=0.85)
        self.play(FadeIn(goal), run_time=1.4)
        wait_until(self, 16)

        # read scans on top, write marks the boundary below
        recolor_cell(row.cells[0], EMERALD)
        wp = pointer(row.cells[1], "write", color=EMERALD, side=DOWN, fs=19, gap=0.85)
        rp = pointer(row.cells[1], "read", color=ACCENT, side=UP, fs=19, gap=0.75)
        self.play(FadeIn(wp), FadeIn(rp), run_time=1.6)
        jobs = fit_label("read visits everything;  write keeps the compacted prefix",
                         12.0, 22, INK).to_edge(DOWN, buff=0.85)
        self.play(FadeOut(goal), FadeIn(jobs), run_time=1.4)
        wait_until(self, 44)

        # read at 1 = duplicate → skip (write stays)
        dup = Text("read's 1 = last kept → skip, write stays", font_size=22, color=ROSE, weight="BOLD")
        dup.move_to([0, -1.5, 0])
        self.play(Indicate(VGroup(row.cells[0], row.cells[1]), color=ROSE, scale_factor=1.1),
                  FadeIn(dup), run_time=1.6)
        rp2 = pointer(row.cells[2], "read", color=ACCENT, side=UP, fs=19, gap=0.75)
        self.play(Transform(rp, rp2), run_time=1.2)
        wait_until(self, 78)

        # read at 2 = new → copy to write slot, advance write
        fresh = Text("read's 2 is new → copy to write, advance write", font_size=22, color=EMERALD, weight="BOLD")
        fresh.move_to([0, -1.5, 0])
        self.play(FadeOut(dup), FadeIn(fresh), run_time=1.2)
        newcell = value_row([2], w=0.9, h=0.9, fs=30, index=False).cells[0]
        newcell.move_to(row.cells[1].get_center())
        recolor_cell(newcell, EMERALD)
        self.play(Transform(row.cells[1], newcell), run_time=1.4)
        wp2 = pointer(row.cells[2], "write", color=EMERALD, side=DOWN, fs=19, gap=0.85)
        self.play(Transform(wp, wp2), run_time=1.2)
        wait_until(self, 116)

        # the principle — clear BOTH prior captions (jobs at the bottom edge and
        # fresh at y=-1.5) so principle owns the bottom band alone.
        principle = fit_label("write only moves when read finds something worth keeping",
                              12.5, 22, INK).to_edge(DOWN, buff=0.85)
        self.play(FadeOut(jobs), FadeOut(fresh), FadeIn(principle), run_time=1.6)
        wait_until(self, 140)

        cost = MathTex(r"\text{read } n + \text{write} \le n = ", "O(n)", r",\ \ O(1)\ \text{space}",
                       color=INK).scale(0.8).move_to([0, -1.5, 0])
        cost[1].set_color(EMERALD)
        self.play(Write(cost), run_time=1.8)
        self.guard(row, wp, rp, principle, cost)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the fast / slow branch ──────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Fast / slow: one path, two speeds"
    cue_duration = 143.5

    NODES = [0, 1, 2, 3, 4, 5, 6]

    def construct(self):
        # a chain of nodes (a linked list laid flat)
        row = value_row(self.NODES, w=0.82, h=0.82, fs=26, gap=0.55, index=False)
        row.move_to([0, SARR_Y, 0])
        # draw connecting arrows node i → i+1
        arrows = VGroup()
        for i in range(len(self.NODES) - 1):
            a = Arrow(row.cells[i].get_right(), row.cells[i + 1].get_left(), buff=0.05,
                      color=INK_SUBTLE, stroke_width=3, max_tip_length_to_length_ratio=0.35)
            arrows.add(a)
        self.play(FadeIn(row), Create(arrows), run_time=2.2)
        goal = fit_label("slow moves 1 step, fast moves 2 — every tick", 10.0, BODY_SIZE, INK_MUTED)
        goal.to_edge(DOWN, buff=0.85)
        self.play(FadeIn(goal), run_time=1.4)
        wait_until(self, 20)

        sp = pointer(row.cells[0], "slow", color=C_LEFT, side=DOWN, fs=19, gap=0.8)
        fp = pointer(row.cells[0], "fast", color=ROSE, side=UP, fs=19, gap=0.7)
        gap = value_badge("gap", 0, color=AMBER, w=2.6).move_to([4.6, -1.5, 0])
        self.play(FadeIn(sp), FadeIn(fp), FadeIn(gap), run_time=1.6)
        wait_until(self, 34)

        # tick the pointers: slow +1, fast +2, gap grows then note it shrinks toward a target
        n = len(self.NODES)
        t = 38
        slow_i, fast_i = 0, 0
        for k in range(1, 4):
            wait_until(self, t)
            t += 20
            slow_i = min(k, n - 1)
            fast_i = min(2 * k, n - 1)
            self.play(
                Transform(sp, pointer(row.cells[slow_i], "slow", color=C_LEFT, side=DOWN, fs=19, gap=0.8)),
                Transform(fp, pointer(row.cells[fast_i], "fast", color=ROSE, side=UP, fs=19, gap=0.7)),
                run_time=1.2)
            self.play(Transform(gap, value_badge("gap", fast_i - slow_i, color=AMBER, w=2.6).move_to([4.6, -1.5, 0])),
                      run_time=0.5)

        wait_until(self, 100)
        # when fast reaches the end, slow is at the midpoint
        mid = Text("fast hits the end → slow sits at the middle", font_size=23, color=EMERALD, weight="BOLD")
        mid.to_edge(DOWN, buff=0.85)
        self.play(FadeOut(goal), FadeIn(mid),
                  Circumscribe(row.cells[slow_i], color=EMERALD), run_time=1.8)
        wait_until(self, 122)

        # the two payoffs
        uses = VGroup(
            Text("• find the middle in one pass", font_size=22, color=INK),
            Text("• detect a cycle: on a loop the gap shrinks by 1 each tick → collision",
                 font_size=22, color=INK),
        ).arrange(DOWN, buff=0.3, aligned_edge=LEFT).move_to([0, -2.5, 0])
        if uses.width > 12.5:
            uses.scale(12.5 / uses.width)
        self.play(FadeOut(mid), FadeIn(uses), run_time=1.6)
        self.guard(row, arrows, sp, fp, uses)
        pace_to(self, self.cue_duration)


# ─── Cue05 : when it fails ───────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "No structure, no license"
    cue_duration = 114.8

    UARR = [8, 3, 11, 1, 6]

    def construct(self):
        # a fixed top note (just under the headline) and the UNSORTED tag just
        # above the row — kept at distinct heights so they never overlap.
        title = fit_label("converging pointers assume a sorted row", 9.0, BODY_SIZE, INK_MUTED)
        title.move_to([0, 2.4, 0])
        self.play(FadeIn(title), run_time=1.4)

        row = value_row(self.UARR, w=0.9, h=0.9, fs=30, gap=0.2, index=True)
        row.move_to([0, 0.7, 0])
        self.play(FadeIn(row), run_time=1.4)
        unsorted = Text("but this row is UNSORTED", font_size=26, color=ROSE, weight="BOLD")
        unsorted.next_to(row, UP, buff=0.4)
        self.play(FadeIn(unsorted), run_time=1.2)
        wait_until(self, 22)

        # put L/R at the ends and show the comparison gives no valid signal. The
        # target chip goes LOWER-right, clear of the top note stack.
        tgt = value_badge("target", 14, color=AMBER, w=2.6).move_to([5.05, -0.4, 0])
        lp = pointer(row.cells[0], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[4], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        self.play(FadeIn(tgt), FadeIn(lp), FadeIn(rp), run_time=1.6)
        s = MathTex(r"8 + 6 = ", "14", color=INK).scale(0.95).move_to([0, -1.4, 0])
        s[1].set_color(EMERALD)
        self.play(Write(s), run_time=1.2)
        wait_until(self, 48)

        # the problem: "too big → drop right" is meaningless when a bigger value may sit left
        why = fit_label("'too big → drop right' is a lie here — a larger value can sit anywhere",
                        13.0, 22, ROSE).to_edge(DOWN, buff=0.85)
        self.play(FadeIn(why), run_time=1.6)
        wait_until(self, 70)

        # highlight 11 sitting in the middle — the ordering assumption is void
        recolor_cell(row.cells[2], ROSE)
        note = Text("11 hides in the middle — retreating right would skip it", font_size=21, color=ROSE)
        note.next_to(s, DOWN, buff=0.4)
        self.play(Indicate(row.cells[2], color=ROSE, scale_factor=1.15), FadeIn(note), run_time=1.6)
        wait_until(self, 96)

        moral = fit_label("force the pattern without the structure and you get a fast WRONG answer",
                          13.0, 22, AMBER).to_edge(DOWN, buff=0.85)
        self.play(FadeOut(why), FadeIn(moral), run_time=1.8)
        self.guard(row, lp, rp, tgt, s, moral)
        pace_to(self, self.cue_duration)


# ─── Cue06 : recognition & window kinship ────────────────────────────────────
class Cue06(AvoScene):
    headline = "Fingerprints and cousins"
    cue_duration = 100.4

    def construct(self):
        # left column: trigger phrases
        trig_title = Text("recognize by structure", font_size=24, color=AMBER, weight="BOLD")
        triggers = VGroup(
            Text("• sorted array + pair / triple sum", font_size=20, color=INK),
            Text("• compact / dedup / partition in place", font_size=20, color=INK),
            Text("• middle of list / cycle detection", font_size=20, color=INK),
            Text("• palindrome check from both ends", font_size=20, color=INK),
        ).arrange(DOWN, buff=0.26, aligned_edge=LEFT)
        left = VGroup(trig_title, triggers).arrange(DOWN, buff=0.35, aligned_edge=LEFT)
        left.to_edge(LEFT, buff=0.7).shift(UP * 0.6)
        self.play(FadeIn(trig_title), run_time=1.2)
        for m in triggers:
            self.play(FadeIn(m, shift=RIGHT * 0.15), run_time=0.7)
        wait_until(self, 34)

        # right column: the two-pointer shapes
        shape_title = Text("two shapes", font_size=24, color=ACCENT, weight="BOLD")
        shapes = VGroup(
            Text("converging: L→ ←R (opposite ends)", font_size=20, color=C_LEFT),
            Text("same-direction: read/write, slow/fast", font_size=20, color=EMERALD),
        ).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
        right = VGroup(shape_title, shapes).arrange(DOWN, buff=0.35, aligned_edge=LEFT)
        right.to_edge(RIGHT, buff=0.7).shift(UP * 0.9)
        self.play(FadeIn(shape_title), run_time=1.0)
        for m in shapes:
            self.play(FadeIn(m, shift=LEFT * 0.15), run_time=0.8)
        wait_until(self, 60)

        # the window kinship punchline
        kin = fit_label("a sliding window IS a same-direction two-pointer — same family",
                        13.0, 24, VIOLET).move_to([0, -2.2, 0])
        self.play(FadeIn(kin), run_time=1.6)
        wait_until(self, 82)

        moral = fit_label("recognize on structure, not surface words", 11.0, 22, INK_MUTED)
        moral.to_edge(DOWN, buff=0.55)
        self.play(FadeIn(moral), run_time=1.4)
        self.guard(left, right, kin, moral)
        pace_to(self, self.cue_duration)
