"""
Lesson 22 — Part 1 (activity 129): "The machine via Next Greater Element"
(75.19s, 6 short cues).

The concrete Next-Greater-Element walkthrough behind the orientation's "keep the
unresolved in order, let the newcomer settle up." Array [8, 5, 3, 7, 9]. A stack
holds only the INDICES whose next-greater is still open, kept DECREASING in
value top→bottom. A smaller arrival just waits (push); a bigger arrival is the
next-greater for everything shorter than it, so it pops-and-records, and one
newcomer can resolve several waiters (a cascade). Indices left on the stack at
the end were never beaten → answer −1. Every index is pushed once and popped at
most once → linear.

Walk (nge = next greater element to the right):
  i0=8  push                              stack[8]
  i1=5  5<8 wait, push                    stack[8,5]
  i2=3  3<5 wait, push                    stack[8,5,3]   (decreasing)
  i3=7  7>3 pop→nge[2]=7 ; 7>5 pop→nge[1]=7 ; 7<8 push   stack[8,7]  (cascade)
  i4=9  9>7 pop→nge[3]=9 ; 9>8 pop→nge[0]=9 ; push        stack[9]
  end   index 4 (val 9) never beaten → nge[4]=−1
  nge = [9, 7, 7, 9, −1]

Uses the arrays.py idiom lib (value_row, recolor_cell, stack_base/stack_cell/
stack_pos, recolor_stack_cell, complexity) — the array + monotonic-stack
vocabulary, NOT the transformer / econ / Bayes idioms of other lessons. MathTex
is reserved for the one complexity bound at the end.

Cue00 0-13.7    The stack = unresolved indices, values decreasing top→bottom
Cue01 13.7-28.3 A smaller arrival resolves nothing — just push its index
Cue02 28.3-43.3 A bigger arrival IS the next-greater — pop and record
Cue03 43.3-58.3 Cascade — one newcomer resolves several waiters
Cue04 58.3-68.4 Leftovers — never beaten → default −1
Cue05 68.4-75.2 Push once, pop at most once → linear

Each cue stages its reveals with wait_until(scene, t); pace_to fills the tail so
the chunk length equals the cue window exactly (the render harness pins it).
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
from arrays import (
    value_row,
    recolor_cell,
    stack_base,
    stack_cell,
    stack_pos,
    recolor_stack_cell,
    complexity,
    C_STACK,
    C_ARRIVE,
    C_RESOLVE,
)
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

ARR = [8, 5, 3, 7, 9]
ARR_Y = 1.95
NGE_Y = 0.55
STACK_BASE = [4.7, -2.0, 0]      # stack column base (grows UP), right side
SH = 0.72                         # stack cell height
SGAP = 0.12


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_array():
    row = value_row(ARR, w=0.92, h=0.92, fs=32, gap=0.22, index=True)
    row.move_to([-2.1, ARR_Y, 0])
    return row


def nge_row(known):
    """A result row under the array: nge[i] filled where known (dict i→val),
    else a dim '?'. Returns VGroup with .cells for per-index highlight."""
    vals = [str(known[i]) if i in known else "?" for i in range(len(ARR))]
    row = value_row(vals, color=INK_SUBTLE, w=0.92, h=0.72, fs=26, gap=0.22, index=False)
    row.move_to([-2.1, NGE_Y, 0])
    for i, v in enumerate(vals):
        if v != "?":
            recolor_cell(row.cells[i], C_RESOLVE, fill=0.20)
    return row


def nge_label():
    lab = Text("nge", font_size=22, color=INK_MUTED)
    return lab


def arr_label():
    return Text("arr", font_size=22, color=INK_MUTED)


def make_stack(entries):
    """entries: list of (idx, val) bottom→top. Returns (VGroup base+cells, list
    of cell mobjects bottom→top) positioned on the STACK_BASE column."""
    base = stack_base(STACK_BASE, label="stack (indices)", w=1.9, color=C_STACK)
    cells = []
    grp = VGroup(base)
    for level, (idx, val) in enumerate(entries):
        c = stack_cell(val, idx=idx, color=C_STACK, w=1.55, h=SH, fs=28)
        c.move_to(stack_pos(STACK_BASE, level, h=SH, gap=SGAP))
        grp.add(c)
        cells.append(c)
    grp.base = base
    grp.cells = cells
    return grp


def arrival_marker(idx, val, color=C_ARRIVE):
    """A chip showing the current newcomer 'arr[i]=v' above the stack region."""
    box = stack_cell(val, idx=idx, color=color, w=1.55, h=SH, fs=28)
    box.move_to([STACK_BASE[0], 2.15, 0])
    tag = Text("newcomer", font_size=20, color=color, weight="BOLD").next_to(box, UP, buff=0.14)
    return VGroup(box, tag), box


# ─── Cue00 : the stack holds unresolved indices, decreasing ──────────────────
class Cue00(AvoScene):
    headline = "The stack keeps only indices whose answer is still open"
    cue_duration = 13.7

    def construct(self):
        row = build_array()
        al = arr_label().next_to(row, LEFT, buff=0.3)
        self.play(FadeIn(row, shift=UP * 0.2), FadeIn(al), run_time=1.6)
        nrow = nge_row({})
        nl = nge_label().next_to(nrow, LEFT, buff=0.3)
        self.play(FadeIn(nrow), FadeIn(nl), run_time=1.0)
        wait_until(self, 4.5)

        # push i0 = 8 onto the empty stack
        st = make_stack([])
        self.play(FadeIn(st.base), run_time=1.0)
        c0 = stack_cell(8, idx=0, color=C_STACK, w=1.55, h=SH, fs=28)
        c0.move_to(stack_pos(STACK_BASE, 0, h=SH, gap=SGAP))
        recolor_cell(row.cells[0], C_STACK)
        self.play(FadeIn(c0, shift=UP * 0.3), run_time=1.2)
        wait_until(self, 9)

        note = fit_label("stack holds indices still waiting for a bigger neighbor — values decreasing top→bottom",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(row, nrow, st.base, c0, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : a smaller arrival just waits (push) ─────────────────────────────
class Cue01(AvoScene):
    headline = "A smaller arrival resolves nothing — it just waits"
    cue_duration = 14.6

    def construct(self):
        row = build_array()
        nrow = nge_row({})
        recolor_cell(row.cells[0], C_STACK)
        st = make_stack([(0, 8)])
        self.add(row, nrow, st)
        wait_until(self, 2)

        # i1 = 5 arrives : 5 < 8 → does not beat top, push
        arr1, box1 = arrival_marker(1, 5)
        self.play(FadeIn(arr1, shift=DOWN * 0.2), run_time=1.2)
        why = fit_label("5 < 8 : it does not beat the top, so it resolves nothing", 12.0, 22, INK).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(why), Indicate(st.cells[0].box, color=INK_MUTED, scale_factor=1.06), run_time=1.4)
        wait_until(self, 7)

        c1 = stack_cell(5, idx=1, color=C_STACK, w=1.55, h=SH, fs=28)
        c1.move_to(stack_pos(STACK_BASE, 1, h=SH, gap=SGAP))
        recolor_cell(row.cells[1], C_STACK)
        self.play(Transform(arr1[0], c1), FadeOut(arr1[1]), run_time=1.4)
        wait_until(self, 11)

        # i2 = 3 arrives : 3 < 5 → push again ; stack now decreasing 8,5,3
        arr2, box2 = arrival_marker(2, 3)
        self.play(FadeIn(arr2), run_time=0.9)
        c2 = stack_cell(3, idx=2, color=C_STACK, w=1.55, h=SH, fs=28)
        c2.move_to(stack_pos(STACK_BASE, 2, h=SH, gap=SGAP))
        recolor_cell(row.cells[2], C_STACK)
        self.play(Transform(arr2[0], c2), FadeOut(arr2[1]), run_time=1.2)
        dec = Text("8 · 5 · 3  — decreasing", font_size=24, color=VIOLET, weight="BOLD").to_edge(DOWN, buff=0.6)
        self.play(FadeOut(why), FadeIn(dec), run_time=1.0)
        self.guard(row, nrow, dec)
        pace_to(self, self.cue_duration)


# ─── Cue02 : a bigger arrival pops and records ───────────────────────────────
class Cue02(AvoScene):
    headline = "A bigger arrival is the next-greater — pop and record"
    cue_duration = 15.0

    def construct(self):
        row = build_array()
        nrow = nge_row({})
        for i in (0, 1, 2):
            recolor_cell(row.cells[i], C_STACK)
        st = make_stack([(0, 8), (1, 5), (2, 3)])
        self.add(row, nrow, st)
        wait_until(self, 2)

        # i3 = 7 arrives : 7 > 3 (top)
        arr, box = arrival_marker(3, 7)
        self.play(FadeIn(arr, shift=DOWN * 0.2), run_time=1.2)
        cmp = fit_label("7 > 3 : the newcomer beats the top — 7 is index 2's next greater", 12.6, 22, EMERALD)
        cmp.to_edge(DOWN, buff=0.6)
        self.play(FadeIn(cmp), Indicate(st.cells[2].box, color=EMERALD, scale_factor=1.1), run_time=1.5)
        wait_until(self, 7)

        # pop index 2, record nge[2] = 7
        recolor_stack_cell(st.cells[2], C_RESOLVE)
        arrow = Arrow(st.cells[2].get_left(), nrow.cells[2].get_right(),
                      color=EMERALD, stroke_width=4, buff=0.15,
                      max_tip_length_to_length_ratio=0.12)
        self.play(FadeIn(arrow), run_time=0.8)
        self.play(st.cells[2].animate.move_to([1.2, -1.1, 0]), run_time=1.0)
        nrow2 = nge_row({2: 7})
        recolor_cell(row.cells[2], C_RESOLVE)
        self.play(Transform(nrow, nrow2), Circumscribe(nrow2.cells[2], color=EMERALD), run_time=1.4)
        self.play(FadeOut(st.cells[2]), FadeOut(arrow), run_time=0.6)
        rec = Text("pop = the popped index's answer is now known", font_size=22, color=EMERALD).to_edge(DOWN, buff=0.6)
        self.play(FadeOut(cmp), FadeIn(rec), run_time=1.0)
        self.guard(row, nrow2, rec)
        pace_to(self, self.cue_duration)


# ─── Cue03 : cascade — one newcomer resolves several ─────────────────────────
class Cue03(AvoScene):
    headline = "One newcomer can settle several waiters at once"
    cue_duration = 15.0

    def construct(self):
        row = build_array()
        nrow = nge_row({2: 7})
        for i in (0, 1):
            recolor_cell(row.cells[i], C_STACK)
        recolor_cell(row.cells[2], C_RESOLVE)
        recolor_cell(row.cells[3], C_ARRIVE)
        # stack after popping index 2: [8, 5] with newcomer 7 still pushing down
        st = make_stack([(0, 8), (1, 5)])
        self.add(row, nrow, st)
        newc = stack_cell(7, idx=3, color=C_ARRIVE, w=1.55, h=SH, fs=28).move_to([1.2, 1.0, 0])
        ntag = Text("newcomer 7 keeps popping", font_size=22, color=ACCENT, weight="BOLD").next_to(newc, UP, buff=0.2)
        self.add(newc, ntag)
        wait_until(self, 2.5)

        # 7 > 5 : pop index 1, nge[1] = 7
        cmp = fit_label("7 > 5 : still bigger — pop again, nge[1] = 7", 11.5, 22, EMERALD).to_edge(DOWN, buff=0.6)
        recolor_stack_cell(st.cells[1], C_RESOLVE)
        self.play(FadeIn(cmp), Indicate(st.cells[1].box, color=EMERALD, scale_factor=1.1), run_time=1.5)
        nrow2 = nge_row({1: 7, 2: 7})
        recolor_cell(row.cells[1], C_RESOLVE)
        self.play(st.cells[1].animate.move_to([-0.4, -1.2, 0]), run_time=0.9)
        self.play(Transform(nrow, nrow2), FadeOut(st.cells[1]), run_time=1.1)
        wait_until(self, 8.5)

        # 7 < 8 : stop, push index 3
        cmp2 = fit_label("7 < 8 : order restored — push 7 and move on", 11.5, 22, VIOLET).to_edge(DOWN, buff=0.6)
        self.play(FadeOut(cmp), FadeIn(cmp2), Indicate(st.cells[0].box, color=INK_MUTED, scale_factor=1.06), run_time=1.4)
        c3 = stack_cell(7, idx=3, color=C_STACK, w=1.55, h=SH, fs=28).move_to(stack_pos(STACK_BASE, 1, h=SH, gap=SGAP))
        recolor_cell(row.cells[3], C_STACK)
        self.play(Transform(newc, c3), FadeOut(ntag), run_time=1.3)
        amort = fit_label("each index is popped at most once — the amortized-linear trick",
                          7.6, 21, INK_MUTED)
        amort.next_to(cmp2, UP, buff=0.28).align_to(cmp2, LEFT)
        self.play(FadeIn(amort), run_time=1.0)
        self.guard(row, nrow2, cmp2)
        pace_to(self, self.cue_duration)


# ─── Cue04 : leftovers → default −1 ──────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Never beaten by the end → the answer stays −1"
    cue_duration = 10.1

    def construct(self):
        row = build_array()
        # end state: after i4=9 cascades, stack = [index 4 (9)], nge known for 0..3
        nrow = nge_row({0: 9, 1: 7, 2: 7, 3: 9})
        for i in range(4):
            recolor_cell(row.cells[i], C_RESOLVE)
        recolor_cell(row.cells[4], C_STACK)
        st = make_stack([(4, 9)])
        self.add(row, nrow, st)
        wait_until(self, 2)

        note = fit_label("index 4 is the tallest — nothing to its right ever beats it", 12.5, 22, INK)
        note.to_edge(DOWN, buff=0.6)
        self.play(FadeIn(note), Indicate(st.cells[0].box, color=VIOLET, scale_factor=1.1), run_time=1.5)
        wait_until(self, 6)

        nrow2 = nge_row({0: 9, 1: 7, 2: 7, 3: 9})  # base
        # overwrite the '?' at index 4 with -1
        minus1 = nge_row({0: 9, 1: 7, 2: 7, 3: 9, 4: "−1"})
        recolor_cell(row.cells[4], INK_SUBTLE)
        self.play(Transform(nrow, minus1), Circumscribe(minus1.cells[4], color=ROSE), run_time=1.6)
        self.guard(row, minus1, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : push once, pop once → linear ────────────────────────────────────
class Cue05(AvoScene):
    headline = "Push once, pop at most once → linear"
    cue_duration = 6.8

    def construct(self):
        row = build_array()
        self.add(row)
        wait_until(self, 1.0)

        line = fit_label("every index enters the stack once and leaves at most once",
                         12.0, 24, INK).move_to([0, -0.3, 0])
        self.play(FadeIn(line), run_time=1.0)
        bound = MathTex(r"O(n^2)\ \text{pair scan} \;\longrightarrow\; ", "O(n)", color=INK).scale(0.95)
        bound.to_edge(DOWN, buff=0.7)
        bound[1].set_color(EMERALD)
        self.play(Write(bound), run_time=1.3)
        self.play(Circumscribe(bound[1], color=EMERALD), run_time=1.0)
        self.guard(row, line, bound)
        pace_to(self, self.cue_duration)
