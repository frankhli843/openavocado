"""
Lesson 22 — Part 2 (activity 130): "Largest Rectangle in a Histogram" (77.66s,
6 short cues).

The concrete histogram walkthrough behind the orientation's "an increasing stack
+ a shorter arrival that resolves the leftovers." Bar heights [2, 1, 5, 6, 2, 3].
Keep a stack of bar indices whose height is INCREASING left→right; each still
might extend right. When a shorter bar arrives it is a wall: every taller bar on
the stack can extend no further right, so pop and measure it. The popped bar's
own height is the rectangle height; its width runs from the nearest shorter bar
on its LEFT (the new stack top) to the current index on its RIGHT.

Walk (increasing-height index stack; measure on each pop):
  i0 h2  push                              stack[2]
  i1 h1  1<2 pop bar0 (2×1=2) ; push       stack[1]
  i2 h5  push                              stack[1,5]
  i3 h6  push                              stack[1,5,6]   (increasing 1<5<6)
  i4 h2  wall: 2<6 pop bar3 (6×1=6)
                2<5 pop bar2 (5×2=10) ← MAX  ; push       stack[1,2]
  i5 h3  push                              stack[1,2,3]
  end (sentinel h0) flush: 3×1=3, 2×4=8, 1×6=6
  largest = 5×2 = 10

Uses the arrays.py idiom lib (histogram/recolor_bar, stack_base/stack_cell/
stack_pos, value_badge, complexity) — the histogram + monotonic-stack
vocabulary, NOT the transformer / econ / Bayes idioms of other lessons. MathTex
is reserved for the area arithmetic and the sentinel note.

Cue00 0-14.1    Increasing stack — bars kept short→tall, each may extend right
Cue01 14.1-29.2 A shorter wall arrives → the taller top can't extend → pop
Cue02 29.2-44.7 The rectangle's height is the popped bar's own height
Cue03 44.7-60.2 Width = nearest-shorter-left … current index
Cue04 60.2-70.6 height × width, keep the max — 5 × 2 = 10 wins
Cue05 70.6-77.7 A trailing zero-height sentinel flushes the leftovers

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
    histogram,
    recolor_bar,
    rect_overlay,
    stack_base,
    stack_cell,
    stack_pos,
    recolor_stack_cell,
    value_badge,
    C_STACK,
    C_ARRIVE,
    C_RESOLVE,
)
from bayes import fit_label
from manim import (
    VGroup,
    Rectangle,
    Text,
    MathTex,
    Arrow,
    DashedLine,
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

H = [2, 1, 5, 6, 2, 3]
BASE_Y = -1.75
UNIT = 0.48
BARW = 1.0
STACK_BASE = [5.0, -1.75, 0]
SH = 0.66
SGAP = 0.12


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_hist():
    hist = histogram(H, unit=UNIT, w=BARW, gap=0.14, base_y=BASE_Y, index=True)
    dx = -1.4  # nudge left to clear the right-side stack column
    hist.shift([dx, 0, 0])
    # shift() moves the mobjects but not the stored geometry attributes the
    # overlay helpers read — keep hist.xs in sync so rectangles/braces align.
    hist.xs = [x + dx for x in hist.xs]
    return hist


def make_stack(entries):
    """entries: list of (idx, height) bottom→top."""
    base = stack_base(STACK_BASE, label="stack (bar idx)", w=1.9, color=C_STACK)
    grp = VGroup(base)
    cells = []
    for level, (idx, hv) in enumerate(entries):
        c = stack_cell(hv, idx=idx, color=C_STACK, w=1.5, h=SH, fs=26)
        c.move_to(stack_pos(STACK_BASE, level, h=SH, gap=SGAP))
        grp.add(c)
        cells.append(c)
    grp.base = base
    grp.cells = cells
    return grp


def max_badge(value):
    return value_badge("max area", value, color=EMERALD, w=3.2).to_edge(UP, buff=1.35).shift(RIGHT * 3.9)


# ─── Cue00 : the increasing stack ────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Keep a stack of bars with increasing heights"
    cue_duration = 14.1

    def construct(self):
        hist = build_hist()
        self.play(FadeIn(hist, shift=UP * 0.2), run_time=1.8)
        wait_until(self, 4)

        # form the increasing stack of indices 1,5,6 (heights) — bars 1,2,3
        st = make_stack([])
        self.play(FadeIn(st.base), run_time=0.9)
        entries = [(1, 1), (2, 5), (3, 6)]
        cells = []
        anims_bars = []
        for level, (idx, hv) in enumerate(entries):
            c = stack_cell(hv, idx=idx, color=C_STACK, w=1.5, h=SH, fs=26)
            c.move_to(stack_pos(STACK_BASE, level, h=SH, gap=SGAP))
            recolor_bar(hist.bars[idx], C_STACK)
            self.play(FadeIn(c, shift=UP * 0.25), run_time=0.8)
            cells.append(c)
        wait_until(self, 9)

        note = fit_label("heights increase up the stack (1 < 5 < 6) — each bar might still stretch right",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(hist, st.base, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : a shorter wall triggers a pop ───────────────────────────────────
class Cue01(AvoScene):
    headline = "A shorter bar is a wall — the taller top can't extend right"
    cue_duration = 15.1

    def construct(self):
        hist = build_hist()
        for idx in (1, 2, 3):
            recolor_bar(hist.bars[idx], C_STACK)
        st = make_stack([(1, 1), (2, 5), (3, 6)])
        self.add(hist, st)
        wait_until(self, 2)

        # i4 (h=2) arrives as the wall
        recolor_bar(hist.bars[4], C_ARRIVE)
        wall = DashedLine([hist.xs[4] - hist.bar_w / 2, hist.base_y - 0.15, 0],
                          [hist.xs[4] - hist.bar_w / 2, hist.base_y + 6 * hist.unit + 0.3, 0],
                          color=ACCENT, stroke_width=4)
        wtag = Text("wall: bar 4 (h 2)", font_size=21, color=ACCENT, weight="BOLD").next_to(wall, UP, buff=0.1)
        self.play(FadeIn(wall), FadeIn(wtag), run_time=1.4)
        wait_until(self, 7)

        # 2 < 6 : pop bar 3, it can extend no further right
        cmp = fit_label("2 < 6 : bar 3 can go no further right — pop and measure it", 12.6, 22, EMERALD)
        cmp.to_edge(DOWN, buff=0.6)
        recolor_stack_cell(st.cells[2], C_RESOLVE)
        recolor_bar(hist.bars[3], C_RESOLVE)
        self.play(FadeIn(cmp), Indicate(st.cells[2].box, color=EMERALD, scale_factor=1.1), run_time=1.5)
        # measure bar3: width 1 (just itself), area 6
        r3 = rect_overlay(hist, 3, 3, 6, color=EMERALD, opacity=0.28)
        a3 = MathTex(r"6 \times 1 = 6", color=INK).scale(0.66).move_to(
            [hist.xs[3], hist.base_y + 6 * hist.unit * 0.5, 0])
        self.play(FadeIn(r3), Write(a3), run_time=1.4)
        self.play(FadeOut(st.cells[2]), run_time=0.6)
        self.guard(hist, cmp)
        pace_to(self, self.cue_duration)


# ─── Cue02 : height = popped bar's own height ────────────────────────────────
class Cue02(AvoScene):
    headline = "The rectangle's height is the popped bar's own height"
    cue_duration = 15.5

    def construct(self):
        hist = build_hist()
        for idx in (1, 2):
            recolor_bar(hist.bars[idx], C_STACK)
        recolor_bar(hist.bars[3], INK_SUBTLE)
        recolor_bar(hist.bars[4], C_ARRIVE)
        st = make_stack([(1, 1), (2, 5)])
        self.add(hist, st)
        wall = DashedLine([hist.xs[4] - hist.bar_w / 2, hist.base_y - 0.15, 0],
                          [hist.xs[4] - hist.bar_w / 2, hist.base_y + 6 * hist.unit + 0.3, 0],
                          color=ACCENT, stroke_width=4)
        self.add(wall)
        wait_until(self, 2)

        # wall still 2 < 5 : pop bar 2 next
        cmp = fit_label("the wall is still shorter — 2 < 5 — so bar 2 is measured next", 12.6, 22, EMERALD)
        cmp.to_edge(DOWN, buff=0.6)
        recolor_stack_cell(st.cells[1], C_RESOLVE)
        recolor_bar(hist.bars[2], C_RESOLVE)
        self.play(FadeIn(cmp), Indicate(st.cells[1].box, color=EMERALD, scale_factor=1.12), run_time=1.6)
        wait_until(self, 8)

        # the height is bar 2's own height = 5
        hbrace = DashedLine([hist.xs[2] - hist.bar_w / 2 - 0.15, hist.base_y, 0],
                            [hist.xs[2] - hist.bar_w / 2 - 0.15, hist.base_y + 5 * hist.unit, 0],
                            color=AMBER, stroke_width=4)
        hlab = Text("height = 5", font_size=24, color=AMBER, weight="BOLD")
        hlab.move_to([hist.xs[2] - hist.bar_w / 2 - 1.35, hist.base_y + 5 * hist.unit, 0])
        self.play(FadeIn(hbrace), FadeIn(hlab), run_time=1.5)
        self.guard(hist, cmp, hlab)
        pace_to(self, self.cue_duration)


# ─── Cue03 : width off the stack ─────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Width = nearest shorter bar on the left … current index"
    cue_duration = 15.5

    def construct(self):
        hist = build_hist()
        recolor_bar(hist.bars[1], C_STACK)
        recolor_bar(hist.bars[2], C_RESOLVE)
        recolor_bar(hist.bars[3], INK_SUBTLE)
        recolor_bar(hist.bars[4], C_ARRIVE)
        st = make_stack([(1, 1)])
        self.add(hist, st)
        wait_until(self, 2)

        # left boundary = new stack top (bar 1); right boundary = wall (index 4)
        lb = Text("left = bar 1", font_size=22, color=AMBER, weight="BOLD")
        lb.move_to([hist.xs[1] - 0.2, hist.base_y + 6 * hist.unit + 0.7, 0])
        lb2 = Text("nearest shorter", font_size=17, color=AMBER).next_to(lb, DOWN, buff=0.08)
        rb = Text("right = i4", font_size=22, color=ACCENT, weight="BOLD")
        rb.move_to([hist.xs[4] + 0.2, hist.base_y + 6 * hist.unit + 0.7, 0])
        rb2 = Text("the wall", font_size=17, color=ACCENT).next_to(rb, DOWN, buff=0.08)
        self.play(FadeIn(lb), FadeIn(lb2), Indicate(hist.bars[1], color=AMBER), run_time=1.4)
        self.play(FadeIn(rb), FadeIn(rb2), Indicate(hist.bars[4], color=ACCENT), run_time=1.4)
        wait_until(self, 8)

        # width = 4 - 1 - 1 = 2 (bars 2 and 3 exposed)
        wbrace = DashedLine([hist.xs[2] - hist.bar_w / 2, hist.base_y - 0.35, 0],
                            [hist.xs[3] + hist.bar_w / 2, hist.base_y - 0.35, 0],
                            color=EMERALD, stroke_width=4)
        wlab = MathTex(r"\text{width} = 4 - 1 - 1 = 2", color=EMERALD).scale(0.8)
        wlab.next_to(wbrace, DOWN, buff=0.14)
        self.play(FadeIn(wbrace), Write(wlab), run_time=1.6)
        self.guard(hist, wlab)
        pace_to(self, self.cue_duration)


# ─── Cue04 : area = h × w, keep the max ──────────────────────────────────────
class Cue04(AvoScene):
    headline = "height × width, keep the running max — 5 × 2 = 10 wins"
    cue_duration = 10.4

    def construct(self):
        hist = build_hist()
        recolor_bar(hist.bars[1], C_STACK)
        recolor_bar(hist.bars[4], C_ARRIVE)
        self.add(hist)
        wait_until(self, 1.5)

        # the winning 5×2 rectangle over bars 2..3
        rect = rect_overlay(hist, 2, 3, 5, color=EMERALD, opacity=0.34)
        self.play(FadeIn(rect), run_time=1.2)
        area = MathTex(r"5 \times 2 = ", "10", color=INK).scale(1.0).move_to(rect.get_center())
        area[1].set_color(EMERALD)
        self.play(Write(area), run_time=1.2)
        self.play(Circumscribe(rect, color=EMERALD), run_time=1.2)
        wait_until(self, 6.5)

        badge = max_badge(10)
        self.play(FadeIn(badge), run_time=1.0)
        note = Text("beats the earlier 6 × 1 = 6", font_size=22, color=INK_MUTED).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(note), run_time=0.9)
        self.guard(hist, rect, area, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : sentinel flushes leftovers ──────────────────────────────────────
class Cue05(AvoScene):
    headline = "A trailing zero-height sentinel flushes the leftovers"
    cue_duration = 7.1

    def construct(self):
        hist = build_hist()
        self.add(hist)
        wait_until(self, 1.0)

        # a phantom 0-height bar at the far right forces every remaining bar to pop
        sx = hist.xs[-1] + hist.bar_w + 0.2
        sent = DashedLine([sx, hist.base_y, 0], [sx, hist.base_y + 0.05, 0],
                          color=ROSE, stroke_width=5)
        stag = Text("sentinel h = 0", font_size=22, color=ROSE, weight="BOLD").next_to([sx, hist.base_y, 0], UP, buff=0.2)
        self.play(FadeIn(stag), Indicate(VGroup(*hist.bars), color=ROSE, scale_factor=1.03), run_time=1.4)
        note = fit_label("a 0-height wall pops everything left on the stack — no cleanup pass",
                         12.0, 22, INK).to_edge(DOWN, buff=0.65)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(hist, note)
        pace_to(self, self.cue_duration)
