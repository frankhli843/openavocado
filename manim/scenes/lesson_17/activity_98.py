"""
Lesson 17 — Orientation (activity 98): "Sliding Window — the family map"
(845.52s / ~14.1min overview audio).

The overview audio is the high-level map of the whole sliding-window family.
Following the proven orientation pattern (acts 7/14/38/72/76/80), the timeline
is the SEVEN designed cues spread over the real duration, each authored for the
actual sliding-window content:

  Cue00 0-98.1     The wasteful nested loop — re-summing every window is O(n·k)
  Cue01 98.1-226.5 The overlap insight — only the two ends change (one out, one in)
  Cue02 226.5-354.8 Fixed-size branch — L trails R by a constant gap, slide lockstep
  Cue03 354.8-528.4 Variable-size branch — R expands greedily, L shrinks on a break
  Cue04 528.4-641.7 Amortized linearity — each index enters/leaves once → O(n)
  Cue05 641.7-754.9 When it fails — non-contiguous answers or negatives break it
  Cue06 754.9-845.5 Recognition & template — trigger phrases + the fixed skeleton

Each long cue stages its reveals across the window via wait_until(scene, t) so
the frame keeps changing with the narration; pace_to fills the remainder to hit
the exact cue duration. Uses the arrays.py idiom lib (value_row, window_bracket,
pointer, value_badge, edit_note, complexity, code_line) — the array/pointer
vocabulary, NOT the transformer / econ / Bayes idioms of other lessons. MathTex
is reserved for the complexity bounds.
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
    edit_note,
    complexity,
    code_line,
    C_ENTER,
    C_LEAVE,
    C_WINDOW,
    C_RIGHT,
    C_LEFT,
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

OARR = [4, 2, 7, 1, 9, 3, 5, 8]
OARR_Y = 1.35


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_oarray(index=False):
    row = value_row(OARR, w=0.9, h=0.9, fs=30, gap=0.16, index=index)
    row.move_to([0, OARR_Y, 0])
    return row


# ─── Cue00 : the wasteful nested loop ────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Brute force: re-sum every window"
    cue_duration = 98.1

    def construct(self):
        row = build_oarray()
        self.play(FadeIn(row, shift=UP * 0.2), run_time=2.0)
        wait_until(self, 6)

        intro = fit_label("a size-3 window slides over 8 numbers", 9.0, BODY_SIZE, INK_MUTED)
        intro.to_edge(DOWN, buff=0.8)
        self.play(FadeIn(intro), run_time=1.6)

        reads = value_badge("re-reads", 0, color=ROSE, w=3.6).move_to([-4.3, -1.7, 0])
        self.play(FadeIn(reads), run_time=1.0)
        wait_until(self, 12)

        # 6 window positions, each RE-SUMMING all 3 cells (the waste)
        win = window_bracket(row, 0, 2, color=INK_SUBTLE)
        self.play(Create(win[0]), run_time=1.0)
        total = 0
        for p in range(6):
            wait_until(self, 13 + p * 12.5)
            newwin = window_bracket(row, p, p + 2, color=INK_SUBTLE)
            self.play(Transform(win[0], newwin[0]), run_time=1.1)
            # re-read the whole window (one flash of all 3 cells = the redundant re-sum)
            self.play(Indicate(VGroup(*row.cells[p:p + 3]), color=ROSE, scale_factor=1.1),
                      run_time=1.1)
            total += 3
            newr = value_badge("re-reads", total, color=ROSE, w=3.6).move_to([-4.3, -1.7, 0])
            self.play(Transform(reads, newr), run_time=0.7)

        wait_until(self, 89)
        waste = fit_label("18 element re-reads for only 6 windows — the middle is re-added every time",
                          13.0, 22, ROSE)
        waste.to_edge(DOWN, buff=0.8)
        self.play(FadeOut(intro), FadeIn(waste), run_time=1.4)
        onk = complexity(r"O(n\cdot k)", color=ROSE, fs=44).next_to(waste, UP, buff=0.35)
        self.play(Write(onk), run_time=1.4)
        self.guard(row, win, reads, waste, onk)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the overlap insight ─────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "The insight: only the two ends change"
    cue_duration = 128.4

    def construct(self):
        row = build_oarray()
        self.add(row)
        wait_until(self, 4)

        # window at [0..2], then the next at [1..3]
        win = window_bracket(row, 0, 2, color=ACCENT_LIGHT)
        self.play(Create(win[0]), run_time=1.6)
        wait_until(self, 18)

        # highlight the shared middle (indices 1,2) that carries over
        recolor_cell(row.cells[1], EMERALD)
        recolor_cell(row.cells[2], EMERALD)
        shared_l = fit_label("the middle carries over — never re-added", 9.5, 22, EMERALD)
        shared_l.to_edge(DOWN, buff=0.85)
        self.play(Indicate(VGroup(row.cells[1], row.cells[2]), color=EMERALD, scale_factor=1.12),
                  FadeIn(shared_l), run_time=1.8)
        wait_until(self, 42)

        # the leaving (index 0) and entering (index 3) elements
        recolor_cell(row.cells[0], C_LEAVE)
        recolor_cell(row.cells[3], C_ENTER)
        leave_l = Text("one leaves", font_size=20, color=C_LEAVE).next_to(row.cells[0], UP, buff=0.45)
        enter_l = Text("one enters", font_size=20, color=C_ENTER).next_to(row.cells[3], UP, buff=0.45)
        self.play(Indicate(row.cells[0], color=C_LEAVE, scale_factor=1.15), FadeIn(leave_l), run_time=1.4)
        self.play(Indicate(row.cells[3], color=C_ENTER, scale_factor=1.15), FadeIn(enter_l), run_time=1.4)
        wait_until(self, 66)

        # slide the window to [1..3]
        win2 = window_bracket(row, 1, 3, color=ACCENT_LIGHT)
        self.play(Transform(win[0], win2[0]), run_time=1.6)
        wait_until(self, 82)

        # the O(1) edit replaces the O(k) re-sum
        ed = edit_note(OARR[0], OARR[3]).scale(1.1).move_to([0, -1.1, 0])
        edlbl = Text("subtract the one that left, add the one that entered",
                     font_size=22, color=INK).next_to(ed, DOWN, buff=0.4)
        self.play(FadeOut(shared_l), FadeIn(ed), run_time=1.4)
        self.play(FadeIn(edlbl), run_time=1.4)
        wait_until(self, 104)

        contrast = MathTex(r"O(k)\ \text{re-sum} \;\longrightarrow\; ", "O(1)", r"\ \text{edit}",
                           color=INK).scale(0.95).to_edge(DOWN, buff=0.8)
        contrast[1].set_color(EMERALD)
        self.play(FadeOut(edlbl), Write(contrast), run_time=1.8)
        self.play(Circumscribe(contrast[1], color=EMERALD), run_time=1.2)
        self.guard(row, win, ed, contrast)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the fixed-size branch ───────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Fixed size: L trails R by a constant gap"
    cue_duration = 128.3

    def construct(self):
        row = build_oarray()
        self.add(row)
        wait_until(self, 4)

        # L and R pointers a constant k-1 apart, sliding in lockstep
        lp = pointer(row.cells[0], "L", color=C_LEFT, side=DOWN, gap=0.85)
        rp = pointer(row.cells[2], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        win = window_bracket(row, 0, 2, color=C_WINDOW)
        self.play(FadeIn(lp), FadeIn(rp), Create(win[0]), run_time=1.8)
        gap_l = fit_label("gap pinned by k — width never changes", 9.5, 22, C_WINDOW)
        gap_l.to_edge(DOWN, buff=0.85)
        self.play(FadeIn(gap_l), run_time=1.4)
        wait_until(self, 26)

        # slide both pointers together across positions 1..5
        for p in range(1, 6):
            wait_until(self, 26 + (p - 1) * 16)
            lp2 = pointer(row.cells[p], "L", color=C_LEFT, side=DOWN, gap=0.85)
            rp2 = pointer(row.cells[p + 2], "R", color=C_RIGHT, side=DOWN, gap=0.85)
            win2 = window_bracket(row, p, p + 2, color=C_WINDOW)
            self.play(Transform(lp, lp2), Transform(rp, rp2), Transform(win[0], win2[0]),
                      run_time=1.6)
            self.play(Indicate(VGroup(*row.cells[p:p + 3]), color=C_WINDOW, scale_factor=1.06),
                      run_time=0.9)

        wait_until(self, 110)
        use = fit_label("use it when the size is given: max sum of k, averages of k, fixed substrings",
                        13.0, 21, INK_MUTED).to_edge(DOWN, buff=0.85)
        self.play(FadeOut(gap_l), FadeIn(use), run_time=1.6)
        self.guard(row, lp, rp, win, use)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the variable-size branch ────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Variable size: the window breathes"
    cue_duration = 173.6

    CH = ["a", "b", "c", "a", "b", "c", "b"]

    def construct(self):
        row = value_row(self.CH, w=0.9, h=0.9, fs=30, gap=0.16, index=False)
        row.move_to([0, OARR_Y, 0])
        self.play(FadeIn(row, shift=UP * 0.15), run_time=1.8)
        goal = fit_label("longest run with no repeated character", 9.5, BODY_SIZE, INK_MUTED)
        goal.to_edge(DOWN, buff=0.85)
        self.play(FadeIn(goal), run_time=1.4)
        wait_until(self, 10)

        lp = pointer(row.cells[0], "L", color=C_LEFT, side=DOWN, gap=1.75)
        self.play(FadeIn(lp), run_time=0.8)
        win = None
        rp = None
        # expand: admit a, b, c (indices 0,1,2)
        for r in range(3):
            wait_until(self, 12 + r * 12)
            rp2 = pointer(row.cells[r], "R", color=C_RIGHT, side=DOWN, gap=0.85)
            if rp is None:
                self.play(FadeIn(rp2), run_time=0.8); rp = rp2
            else:
                self.play(Transform(rp, rp2), run_time=0.8)
            recolor_cell(row.cells[r], C_ENTER)
            self.play(Indicate(row.cells[r], color=C_ENTER, scale_factor=1.12), run_time=0.7)
            nw = window_bracket(row, 0, r, color=C_WINDOW)
            if win is None:
                self.play(Create(nw[0]), run_time=0.7); win = nw
            else:
                self.play(Transform(win[0], nw[0]), run_time=0.7)

        wait_until(self, 52)
        expand_l = fit_label("R expands greedily while the window stays legal", 11.0, 22, C_RIGHT)
        expand_l.to_edge(DOWN, buff=0.85)
        self.play(FadeOut(goal), FadeIn(expand_l), run_time=1.4)
        wait_until(self, 70)

        # R hits index 3 = 'a' — duplicate → rule breaks
        rp3 = pointer(row.cells[3], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        self.play(Transform(rp, rp3), run_time=1.2)
        recolor_cell(row.cells[3], ROSE)
        recolor_cell(row.cells[0], ROSE)
        clash = CurvedArrow(row.cells[3].get_top(), row.cells[0].get_top(),
                            color=ROSE, angle=-1.0, stroke_width=4)
        self.play(Create(clash), run_time=1.4)
        break_l = fit_label("a repeats — the rule breaks", 8.0, 22, ROSE).to_edge(DOWN, buff=0.85)
        self.play(FadeOut(expand_l), FadeIn(break_l), run_time=1.4)
        wait_until(self, 104)

        # L shrinks: release index 0, advance to 1 → window legal again
        self.play(row.cells[0].animate.set_opacity(0.28), FadeOut(clash), run_time=1.2)
        lp2 = pointer(row.cells[1], "L", color=C_LEFT, side=DOWN, gap=1.75)
        recolor_cell(row.cells[3], C_ENTER)
        win2 = window_bracket(row, 1, 3, color=C_WINDOW)
        self.play(Transform(lp, lp2), Transform(win[0], win2[0]), run_time=1.8)
        shrink_l = fit_label("L shrinks from the left only until the window is legal again",
                             12.5, 22, C_LEFT).to_edge(DOWN, buff=0.85)
        self.play(FadeOut(break_l), FadeIn(shrink_l), run_time=1.4)
        wait_until(self, 140)

        summary = VGroup(
            Text("R expands greedily", font_size=24, color=C_RIGHT, weight="BOLD"),
            Text("L repairs only when a rule breaks", font_size=24, color=C_LEFT, weight="BOLD"),
        ).arrange(DOWN, buff=0.3, aligned_edge=LEFT).move_to([0, -2.5, 0])
        self.play(FadeOut(shrink_l), FadeIn(summary), run_time=1.6)
        self.guard(row, win, summary)
        pace_to(self, self.cue_duration)


# ─── Cue04 : amortized linearity ─────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Count travel, not nested loops"
    cue_duration = 113.3

    def construct(self):
        row = build_oarray()
        self.add(row)
        n = len(OARR)
        wait_until(self, 4)

        # inline centered counters below the row (no corner badges — the act98
        # array is wide and high, so corners collide with the title/first cell).
        def counters(r_val, l_val):
            r_t = Text(f"R steps: {r_val}", font_size=27, color=C_RIGHT, weight="BOLD")
            l_t = Text(f"L steps: {l_val}", font_size=27, color=C_LEFT, weight="BOLD")
            return VGroup(r_t, l_t).arrange(RIGHT, buff=1.3).move_to([0, -1.4, 0])

        cnt = counters(0, 0)
        self.play(FadeIn(cnt), run_time=1.2)
        wait_until(self, 12)

        # R sweeps left→right once, incrementing its step count
        rp = pointer(row.cells[0], "R", color=C_RIGHT, side=DOWN, gap=0.85)
        self.play(FadeIn(rp), run_time=0.8)
        for i in range(1, n):
            wait_until(self, 14 + i * 6.5)
            rp2 = pointer(row.cells[i], "R", color=C_RIGHT, side=DOWN, gap=0.85)
            self.play(Transform(rp, rp2), run_time=0.7)
            self.play(Transform(cnt, counters(i, 0)), run_time=0.4)

        wait_until(self, 74)
        self.play(Transform(cnt, counters(n - 1, "≤ n")), run_time=0.8)
        note = fit_label("each index is entered once by R and left at most once by L", 12.5, 22, INK)
        note.move_to([0, -2.05, 0])
        self.play(FadeIn(note), run_time=1.6)
        wait_until(self, 96)

        vs = fit_label("not the O(n·k) of nested loops", 8.0, 20, ROSE).move_to([0, -2.65, 0])
        total = MathTex(r"\text{total} \le 2n = ", "O(n)", color=INK).scale(1.0).move_to([0, -3.2, 0])
        total[1].set_color(EMERALD)
        self.play(FadeIn(vs), run_time=1.0)
        self.play(Write(total), Circumscribe(total[1], color=EMERALD), run_time=1.6)
        self.guard(row, cnt, note, total)
        pace_to(self, self.cue_duration)


# ─── Cue05 : when it fails ───────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "When the window breaks its promise"
    cue_duration = 113.2

    def construct(self):
        title = fit_label("the window needs two guarantees", 9.0, BODY_SIZE, INK_MUTED)
        title.to_edge(UP, buff=1.4)
        self.play(FadeIn(title), run_time=1.4)
        wait_until(self, 6)

        # failure 1: non-contiguous answer
        f1_head = Text("1.  the answer must be contiguous", font_size=26, color=ROSE, weight="BOLD")
        row1 = value_row([4, 2, 7, 1, 9], w=0.7, h=0.7, fs=24, gap=0.14, index=False)
        row1.next_to(f1_head, DOWN, buff=0.4)
        # a non-contiguous pick (indices 0,2,4) — window cannot represent it
        f1 = VGroup(f1_head, row1).move_to([0, 1.3, 0])
        self.play(FadeIn(f1_head), run_time=1.2)
        self.play(FadeIn(row1), run_time=1.0)
        wait_until(self, 22)
        for i in (0, 2, 4):
            recolor_cell(row1.cells[i], AMBER)
        picks = SurroundingRectangle(VGroup(row1.cells[0], row1.cells[2], row1.cells[4]),
                                     color=AMBER, buff=0.1, corner_radius=0.08)
        f1_note = fit_label("skipping elements is a subsequence — a window cannot skip",
                            11.5, 20, INK_MUTED).next_to(row1, DOWN, buff=0.35)
        self.play(Indicate(VGroup(row1.cells[0], row1.cells[2], row1.cells[4]),
                           color=AMBER, scale_factor=1.1), run_time=1.4)
        self.play(FadeIn(f1_note), run_time=1.2)
        wait_until(self, 52)

        # failure 2: negatives break monotonicity
        f2_head = Text("2.  extending must move the measure one way", font_size=26, color=ROSE, weight="BOLD")
        row2 = value_row([2, -5, 3, -1, 4], w=0.7, h=0.7, fs=24, gap=0.14, index=False)
        row2.next_to(f2_head, DOWN, buff=0.4)
        f2 = VGroup(f2_head, row2).move_to([0, -1.5, 0])
        self.play(FadeIn(f2_head), run_time=1.2)
        self.play(FadeIn(row2), run_time=1.0)
        wait_until(self, 74)
        recolor_cell(row2.cells[1], ROSE)
        recolor_cell(row2.cells[3], ROSE)
        f2_note = fit_label("with negatives, adding can shrink the sum — shrink logic misfires",
                            12.0, 20, INK_MUTED).next_to(row2, DOWN, buff=0.35)
        self.play(Indicate(VGroup(row2.cells[1], row2.cells[3]), color=ROSE, scale_factor=1.12),
                  run_time=1.4)
        self.play(FadeIn(f2_note), run_time=1.2)
        wait_until(self, 100)

        moral = fit_label("contiguous + monotonic → window works; otherwise reach for another tool",
                          13.0, 21, INK).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(moral), run_time=1.6)
        self.guard(f1, f2, moral)
        pace_to(self, self.cue_duration)


# ─── Cue06 : recognition & template ──────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Fingerprint and skeleton"
    cue_duration = 90.6

    def construct(self):
        # trigger phrases on the left
        trig_title = Text("trigger phrases", font_size=24, color=AMBER, weight="BOLD")
        triggers = VGroup(
            Text("• contiguous subarray / substring", font_size=21, color=INK),
            Text("• longest / shortest / at most k", font_size=21, color=INK),
            Text("• max or min over a range", font_size=21, color=INK),
        ).arrange(DOWN, buff=0.24, aligned_edge=LEFT)
        left = VGroup(trig_title, triggers).arrange(DOWN, buff=0.35, aligned_edge=LEFT)
        left.move_to([-3.7, 0.8, 0])
        self.play(FadeIn(trig_title), run_time=1.2)
        wait_until(self, 8)
        for t in triggers:
            self.play(FadeIn(t, shift=RIGHT * 0.15), run_time=1.1)
        wait_until(self, 28)

        # the skeleton on the right
        skel_title = Text("the skeleton", font_size=24, color=ACCENT, weight="BOLD")
        skel = VGroup(
            code_line("l = 0", fs=22),
            code_line("for r in range(n):", fs=22),
            code_line("admit(r)", fs=22, indent=1),
            code_line("while broken:", fs=22, indent=1),
            code_line("release(l); l += 1", fs=22, indent=2),
            code_line("record(best)", fs=22, indent=1),
        ).arrange(DOWN, buff=0.18, aligned_edge=LEFT)
        skelbox = SurroundingRectangle(skel, color=INK_SUBTLE, buff=0.3, corner_radius=0.1)
        right = VGroup(skel_title, VGroup(skelbox, skel)).arrange(DOWN, buff=0.3)
        right.move_to([3.4, 0.5, 0])
        self.play(FadeIn(skel_title), Create(skelbox), run_time=1.4)
        wait_until(self, 40)
        for ln in skel:
            self.play(FadeIn(ln, shift=RIGHT * 0.1), run_time=0.9)

        wait_until(self, 72)
        # highlight the two boundaries + the repair
        self.play(Indicate(skel[3], color=AMBER, scale_factor=1.05),
                  Indicate(skel[4], color=AMBER, scale_factor=1.05), run_time=1.6)
        closing = fit_label("two boundaries, repair the ends, record the best",
                            11.0, 22, INK).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(closing), run_time=1.6)
        self.guard(left, right, closing)
        pace_to(self, self.cue_duration)
