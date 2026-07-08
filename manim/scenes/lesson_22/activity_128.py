"""
Lesson 22 — Orientation (activity 128): "Monotonic Stack — the family map"
(827.71s / ~13.8min overview audio).

The overview audio is the high-level map of the whole monotonic-stack family.
Following the proven orientation pattern (acts 7/14/38/72/76/80/98/103/108/116/
122), the timeline is the SEVEN designed cues spread over the real duration, each
authored for the actual monotonic-stack content and staged in multiple beats via
wait_until(scene, t) so the frame keeps changing with the narration; pace_to
fills the remainder to hit the exact cue duration.

  Cue00 0-117.3     The trigger — "nearest bigger/smaller" looks quadratic
  Cue01 117.3-241.4 The stack holds only OPEN answers, kept sorted (monotonic)
  Cue02 241.4-386.3 A newcomer settles the accounts — a pop resolves an answer
  Cue03 386.3-524.2 Push once, pop at most once → amortized linear
  Cue04 524.2-662.2 Increasing vs decreasing; store INDICES (recover a width)
  Cue05 662.2-772.5 Leftovers — a default answer or a flushing sentinel
  Cue06 772.5-827.7 When it fails — only nearest-monotonic-neighbor problems

Uses the arrays.py idiom lib (value_row, recolor_cell, pointer, stack_base/
stack_cell/stack_pos/recolor_stack_cell, histogram/recolor_bar/rect_overlay,
complexity, code_line) — the array + monotonic-stack vocabulary, NOT the
transformer / econ / Bayes idioms of other lessons. MathTex is reserved for the
complexity bounds and the width arithmetic.
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
)
from pacing import pace_to, elapsed
from arrays import (
    value_row,
    recolor_cell,
    pointer,
    stack_base,
    stack_cell,
    stack_pos,
    recolor_stack_cell,
    histogram,
    recolor_bar,
    rect_overlay,
    complexity,
    code_line,
    C_STACK,
    C_ARRIVE,
    C_RESOLVE,
)
from bayes import chip, fit_label
from manim import (
    VGroup,
    Text,
    MathTex,
    Line,
    Arrow,
    CurvedArrow,
    DashedLine,
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

# One small array reused across the orientation for continuity.
ARR = [2, 5, 3, 6, 4]
ARR_Y = 1.95
STACK_BASE = [4.9, -2.05, 0]
SH = 0.7
SGAP = 0.12


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_array(values=ARR, y=ARR_Y, xc=-2.0, index=True, w=0.92):
    row = value_row(values, w=w, h=0.92, fs=32, gap=0.22, index=index)
    row.move_to([xc, y, 0])
    return row


def make_stack(entries, base=STACK_BASE, label="stack"):
    b = stack_base(base, label=label, w=1.8, color=C_STACK)
    grp = VGroup(b)
    cells = []
    for level, (idx, val) in enumerate(entries):
        c = stack_cell(val, idx=idx, color=C_STACK, w=1.5, h=SH, fs=27)
        c.move_to(stack_pos(base, level, h=SH, gap=SGAP))
        grp.add(c)
        cells.append(c)
    grp.base = b
    grp.cells = cells
    return grp


def section_tag(text, color=ACCENT):
    return chip(text, color=color, w=4.6, h=0.7, fs=24).to_edge(UP, buff=1.35)


# ─── Cue00 : the trigger — quadratic brute force ─────────────────────────────
class Cue00(AvoScene):
    headline = "\"Nearest bigger/smaller\" looks like a scan inside a scan"
    cue_duration = 117.3

    def construct(self):
        row = build_array()
        self.play(FadeIn(row, shift=UP * 0.2), run_time=1.6)
        task = fit_label("for each element: what is the nearest LARGER value to its right?",
                         12.5, 26, INK)
        task.move_to([0, 0.7, 0])
        self.play(FadeIn(task), run_time=1.4)
        wait_until(self, 22)

        # Beat 2: brute force nested loop
        self.play(FadeOut(task), run_time=0.8)
        code = VGroup(
            code_line("for i in range(n):", color=INK, fs=26),
            code_line("for j in range(i+1, n):", color=INK, fs=26, indent=1),
            code_line("if a[j] > a[i]: answer[i]=a[j]; break", color=ACCENT, fs=24, indent=2),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.24)
        code.move_to([-0.6, -0.55, 0])
        self.play(FadeIn(code), run_time=1.6)
        wait_until(self, 42)

        # Beat 3: the scan-inside-a-scan — sweep j for i=0 (both markers BELOW the
        # row so neither collides with the title band; i on cell 0, j sweeps right)
        ip = pointer(row.cells[0], "i", color=AMBER, side=DOWN, gap=0.75)
        self.play(FadeIn(ip), Indicate(row.cells[0], color=AMBER), run_time=1.2)
        jp = pointer(row.cells[1], "j", color=ACCENT, side=DOWN, gap=0.75)
        self.play(FadeIn(jp), run_time=0.8)
        for k in (2, 3):
            jp2 = pointer(row.cells[k], "j", color=ACCENT, side=DOWN, gap=0.75)
            self.play(Transform(jp, jp2), run_time=1.0)
        sweep = fit_label("every element re-scans everything to its right", 11.5, 24, INK_MUTED)
        sweep.to_edge(DOWN, buff=0.7)
        self.play(FadeIn(sweep), run_time=1.2)
        wait_until(self, 78)

        # Beat 4: O(n^2) -> tease O(n)
        self.play(FadeOut(code), FadeOut(ip), FadeOut(jp), FadeOut(sweep), run_time=0.9)
        bound = MathTex(r"O(n^2)", r"\;\longrightarrow\;", r"O(n)", color=INK).scale(1.3)
        bound.move_to([0, -0.7, 0])
        bound[0].set_color(ROSE)
        bound[2].set_color(EMERALD)
        self.play(Write(bound[0]), run_time=1.2)
        wait_until(self, 96)
        promise = fit_label("a monotonic stack turns the double scan into ONE pass", 12.0, 26, INK)
        promise.next_to(bound, DOWN, buff=0.7)
        self.play(Write(bound[1]), Write(bound[2]), FadeIn(promise), run_time=1.6)
        self.play(Circumscribe(bound[2], color=EMERALD), run_time=1.2)
        self.guard(row, bound)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the stack holds only open answers, sorted ───────────────────────
class Cue01(AvoScene):
    headline = "Keep only the elements whose answer is still open"
    cue_duration = 124.1

    def construct(self):
        row = build_array()
        self.add(row)
        idea = fit_label("the stack is a waiting room: an index stays only until its answer arrives",
                         12.8, 24, INK_MUTED)
        idea.move_to([0, 0.85, 0])
        self.play(FadeIn(idea), run_time=1.4)
        wait_until(self, 20)

        # Beat 2: push the first few (2, then 5? 5>2 would pop — keep it simple:
        # illustrate the invariant with a decreasing prefix). Use indices whose
        # values are decreasing to show the "sorted" stack.
        st = make_stack([])
        self.play(FadeIn(st.base), run_time=1.0)
        # push index 0 (value 2)
        c0 = stack_cell(2, idx=0, color=C_STACK, w=1.5, h=SH, fs=27).move_to(stack_pos(STACK_BASE, 0, h=SH, gap=SGAP))
        recolor_cell(row.cells[0], C_STACK)
        self.play(FadeIn(c0, shift=UP * 0.3), run_time=1.1)
        wait_until(self, 44)

        # Beat 3: the stack stays MONOTONIC (for next-greater: smallest on top)
        note = fit_label("for 'next greater' the stack stays sorted — the smallest unresolved value on top",
                         12.8, 24, INK).to_edge(DOWN, buff=0.75)
        self.play(FadeIn(note), run_time=1.4)
        # a sorted snapshot: bottom = larger (6), top = smaller (4)
        snap = make_stack([(3, 6), (4, 4)], base=[1.4, -2.05, 0], label="sorted stack")
        self.play(FadeIn(snap), run_time=1.3)
        arrow = Text("↑ smaller", font_size=22, color=VIOLET, weight="BOLD").next_to(snap.base, LEFT, buff=0.4).shift(UP * 0.9)
        self.play(FadeIn(arrow), run_time=1.0)
        wait_until(self, 92)

        # Beat 4: contrast with keeping everything
        self.play(FadeOut(snap), FadeOut(arrow), FadeOut(idea), run_time=0.8)
        why = fit_label("keeping everything would be the O(n²) rescan — the stack keeps only the UNRESOLVED",
                        12.0, 23, INK_MUTED)
        why.move_to([0, 0.85, 0])
        self.play(FadeIn(why), run_time=1.4)
        self.play(Indicate(c0, color=VIOLET, scale_factor=1.1), run_time=1.2)
        self.guard(row, st.base, note, why)
        pace_to(self, self.cue_duration)


# ─── Cue02 : a newcomer settles the accounts (pop resolves) ──────────────────
class Cue02(AvoScene):
    headline = "A newcomer that breaks the order settles the accounts"
    cue_duration = 144.9

    def construct(self):
        row = build_array()
        # snapshot: indices 0..? on the stack decreasing. Use [ (0,2) ] then a
        # newcomer 5 arrives and pops it.
        recolor_cell(row.cells[0], C_STACK)
        st = make_stack([(0, 2)])
        self.add(row, st)
        wait_until(self, 16)

        # Beat 1: newcomer 5 (index 1) arrives
        newc = stack_cell(5, idx=1, color=C_ARRIVE, w=1.5, h=SH, fs=27).move_to([2.2, 1.0, 0])
        ntag = Text("newcomer a[1]=5", font_size=22, color=ACCENT, weight="BOLD").next_to(newc, UP, buff=0.18)
        recolor_cell(row.cells[1], C_ARRIVE)
        self.play(FadeIn(newc), FadeIn(ntag), run_time=1.3)
        wait_until(self, 50)

        # Beat 2: 5 > 2 breaks the decreasing order → pop index 0
        cmp = fit_label("5 > 2 : the newcomer beats the top, so it IS index 0's next-greater",
                        13.0, 24, EMERALD).to_edge(DOWN, buff=0.75)
        recolor_stack_cell(st.cells[0], C_RESOLVE)
        self.play(FadeIn(cmp), Indicate(st.cells[0].box, color=EMERALD, scale_factor=1.1), run_time=1.6)
        wait_until(self, 84)

        # Beat 3: each pop = the popped element's answer becomes known
        ans = MathTex(r"\text{answer}[0] = 5", color=EMERALD).scale(0.95).move_to([-2.0, 0.2, 0])
        recolor_cell(row.cells[0], C_RESOLVE)
        self.play(st.cells[0].animate.move_to([-2.0, -0.9, 0]), run_time=1.1)
        self.play(Write(ans), FadeOut(st.cells[0]), run_time=1.3)
        wait_until(self, 116)

        # Beat 4: cascade — one newcomer can resolve several
        self.play(FadeOut(cmp), run_time=0.6)
        cascade = fit_label("if the newcomer is bigger than several waiters, it pops them ALL — one arrival, many answers",
                            13.2, 22, INK).to_edge(DOWN, buff=0.7)
        # push the newcomer onto the (now empty) stack
        c1 = stack_cell(5, idx=1, color=C_STACK, w=1.5, h=SH, fs=27).move_to(stack_pos(STACK_BASE, 0, h=SH, gap=SGAP))
        recolor_cell(row.cells[1], C_STACK)
        self.play(Transform(newc, c1), FadeOut(ntag), FadeIn(cascade), run_time=1.6)
        self.guard(row, cascade)
        pace_to(self, self.cue_duration)


# ─── Cue03 : push once, pop once → linear ────────────────────────────────────
class Cue03(AvoScene):
    headline = "Every element is pushed once and popped at most once"
    cue_duration = 137.9

    def construct(self):
        row = build_array()
        self.add(row)
        wait_until(self, 18)

        # Beat 1: push once
        push = VGroup(
            Text("each index is PUSHED exactly once", font_size=26, color=VIOLET, weight="BOLD"),
        ).move_to([0, 1.0, 0])
        self.play(FadeIn(push), run_time=1.3)
        for i in range(5):
            recolor_cell(row.cells[i], C_STACK)
            self.play(Indicate(row.cells[i], color=VIOLET, scale_factor=1.08), run_time=0.5)
        wait_until(self, 52)

        # Beat 2: pop at most once
        pop = Text("and POPPED at most once", font_size=26, color=EMERALD, weight="BOLD").move_to([0, 0.1, 0])
        self.play(FadeIn(pop), run_time=1.3)
        for i in range(5):
            recolor_cell(row.cells[i], C_RESOLVE)
            self.play(Indicate(row.cells[i], color=EMERALD, scale_factor=1.08), run_time=0.5)
        wait_until(self, 92)

        # Beat 3: total work 2n
        self.play(FadeOut(push), FadeOut(pop), run_time=0.8)
        total = MathTex(r"n\ \text{pushes} + n\ \text{pops} = 2n", color=INK).scale(1.05).move_to([0, 0.6, 0])
        self.play(Write(total), run_time=1.5)
        wait_until(self, 116)

        # Beat 4: the inner while loop is amortized constant → O(n)
        bound = MathTex(r"\Rightarrow\ ", "O(n)", color=INK).scale(1.2).next_to(total, DOWN, buff=0.7)
        bound[1].set_color(EMERALD)
        note = fit_label("the inner while-pop loop is amortized constant — the whole scan is linear",
                         13.0, 23, INK_MUTED).to_edge(DOWN, buff=0.7)
        self.play(Write(bound), FadeIn(note), run_time=1.6)
        self.play(Circumscribe(bound[1], color=EMERALD), run_time=1.2)
        self.guard(row, total, bound)
        pace_to(self, self.cue_duration)


# ─── Cue04 : increasing vs decreasing; store indices ─────────────────────────
class Cue04(AvoScene):
    headline = "Pick the direction; store indices to recover a width"
    cue_duration = 138.0

    def construct(self):
        # Beat 1: two directions
        t1 = section_tag("next GREATER → decreasing stack", color=EMERALD)
        t2 = fit_label("next SMALLER → increasing stack", 6.0, 24, AMBER).next_to(t1, DOWN, buff=0.35)
        self.play(FadeIn(t1), run_time=1.2)
        self.play(FadeIn(t2), run_time=1.2)
        rule = fit_label("the direction is set by what an arrival RESOLVES for a waiter",
                         12.5, 24, INK).move_to([0, 0.4, 0])
        self.play(FadeIn(rule), run_time=1.4)
        wait_until(self, 46)

        self.play(FadeOut(t1), FadeOut(t2), FadeOut(rule), run_time=0.8)

        # Beat 2/3: store indices, not values → recover a WIDTH (histogram)
        idx_note = fit_label("store INDICES, not values — a pop then yields both a value AND a width",
                             13.0, 24, INK).to_edge(UP, buff=1.35)
        self.play(FadeIn(idx_note), run_time=1.4)
        hist = histogram([2, 1, 5, 6, 2, 3], unit=0.42, w=0.9, gap=0.14, base_y=-1.7, index=True)
        self.play(FadeIn(hist, shift=UP * 0.2), run_time=1.6)
        wait_until(self, 92)

        # highlight a width from indices
        recolor_bar(hist.bars[2], C_RESOLVE)
        rect = rect_overlay(hist, 2, 3, 5, color=EMERALD, opacity=0.30)
        wlab = MathTex(r"\text{width} = j - \text{stack.top} - 1", color=EMERALD).scale(0.8)
        wlab.move_to([0, -2.35, 0])
        self.play(FadeIn(rect), Write(wlab), run_time=1.6)
        wait_until(self, 118)

        note = fit_label("indices turn a pop into a rectangle — the histogram, span, and stock-span tricks",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(hist, wlab, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : leftovers — default or sentinel ─────────────────────────────────
class Cue05(AvoScene):
    headline = "Leftovers: a default answer, or a flushing sentinel"
    cue_duration = 110.3

    def construct(self):
        row = build_array()
        recolor_cell(row.cells[3], C_STACK)
        st = make_stack([(3, 6)])
        self.add(row, st)
        wait_until(self, 20)

        # Beat 1: never-popped → default -1
        d = fit_label("indices still on the stack at the end were never beaten",
                      12.5, 24, INK)
        d.move_to([0, 0.6, 0])
        self.play(FadeIn(d), Indicate(st.cells[0].box, color=VIOLET, scale_factor=1.1), run_time=1.6)
        default = MathTex(r"\text{answer} = -1", color=ROSE).scale(1.0).move_to([0, -0.4, 0])
        self.play(Write(default), run_time=1.3)
        wait_until(self, 58)

        # Beat 2: or a sentinel that forces every element to pop
        self.play(FadeOut(default), FadeOut(d), run_time=0.6)
        sent = fit_label("OR append a sentinel that beats everything — it flushes the whole stack in one loop",
                         12.4, 23, EMERALD)
        sent.move_to([0, 0.7, 0])
        self.play(FadeIn(sent), run_time=1.5)
        sbadge = chip("sentinel: +∞ (next-greater)  /  -∞ (histogram h=0)", color=EMERALD, w=8.6, h=0.9, fs=22)
        sbadge.move_to([0, -0.4, 0])
        self.play(FadeIn(sbadge), run_time=1.3)
        wait_until(self, 92)

        note = fit_label("a sentinel removes the after-loop cleanup — every element is measured the same way",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.8)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(row, sbadge, sent, note)
        pace_to(self, self.cue_duration)


# ─── Cue06 : when it fails ───────────────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Only for nearest-monotonic-neighbor problems"
    cue_duration = 55.2

    def construct(self):
        need = fit_label("the stack works when a WAITING element is resolved by a LATER arrival",
                         13.0, 25, INK).move_to([0, 1.4, 0])
        self.play(FadeIn(need), run_time=1.5)
        wait_until(self, 16)

        fail = fit_label("no such 'nearest bigger/smaller neighbor' structure → the stack has nothing to do",
                         13.2, 24, ROSE).move_to([0, 0.2, 0])
        self.play(FadeIn(fail), run_time=1.5)
        wait_until(self, 34)

        alt = chip("reach for a heap or a sort instead", color=AMBER, w=8.0, h=0.95, fs=26).move_to([0, -1.2, 0])
        self.play(FadeIn(alt), run_time=1.3)
        self.play(Circumscribe(alt, color=AMBER), run_time=1.3)
        self.guard(need, fail, alt)
        pace_to(self, self.cue_duration)
