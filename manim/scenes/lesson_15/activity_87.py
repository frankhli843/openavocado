"""
Lesson 15, Part 87 — "The MLP: Per-Token Expansion and the GELU Gate"

One Cue<NN> scene per storyboard cue (manim/storyboards/lesson_15/segment_87.json).
Each pins itself to its cue window via pace_to. Visual system:
  - a token hidden row (d_model wide, ACCENT) that the MLP works on privately
  - the expand→gate→compress pipeline: W1 widens the row (AMBER hidden layer),
    GELU gates it, W2 compresses back to d_model (EMERALD result)
  - a GELU curve drawn as a smooth dimmer (not a hard ReLU switch)
  - the MLP delta added back onto the VIOLET residual stream

Colors (from theme): ACCENT = d_model row / query channel, AMBER = wide hidden
layer + GELU gate (the focus channel), EMERALD = compressed result / value,
VIOLET = residual stream. Whatever the narration discusses is the "lit" color.
"""

import numpy as np

import theme
from theme import (
    AvoScene,
    ACCENT,
    AMBER,
    EMERALD,
    VIOLET,
    INK,
    INK_MUTED,
    FORMULA_SIZE,
    FORMULA_SIZE_SMALL,
    LABEL_SIZE,
    BODY_SIZE,
    fit_to_stage,
    highlight,
)
from pacing import pace_to
from manim import (
    VGroup,
    RoundedRectangle,
    Text,
    MathTex,
    Arrow,
    Axes,
    FadeIn,
    FadeOut,
    Write,
    GrowArrow,
    Create,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
)


# ─── shared visual helpers ───────────────────────────────────────────────────
def row_vec(n=6, color=ACCENT, cell=0.42, gap=0.07, opacity=0.18):
    """A row vector as n horizontal rounded cells."""
    g = VGroup()
    for c in range(n):
        sq = RoundedRectangle(
            width=cell, height=cell, corner_radius=0.06,
            stroke_color=color, stroke_width=1.6,
            fill_color=color, fill_opacity=opacity,
        )
        sq.move_to([c * (cell + gap), 0, 0])
        g.add(sq)
    g.move_to(ORIGIN)
    return g


def token_stack(rows=4, cols=6, color=ACCENT, cell=0.32, gap=0.07, opacity=0.16):
    """A stack of token rows (one per token) — the residual page."""
    g = VGroup()
    for r in range(rows):
        row = row_vec(cols, color=color, cell=cell, gap=gap, opacity=opacity)
        row.move_to([0, -r * (cell + gap), 0])
        g.add(row)
    g.move_to(ORIGIN)
    return g


def labeled(mob, text, size=LABEL_SIZE, color=INK, buff=0.25, edge=DOWN):
    lbl = Text(text, font_size=size, color=color)
    lbl.next_to(mob, edge, buff=buff)
    return VGroup(mob, lbl), lbl


def gelu(x):
    """tanh approximation of GELU — a smooth gate."""
    return 0.5 * x * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x ** 3)))


class Cue00(AvoScene):
    headline = "The MLP works on one token row at a time"
    cue_duration = 24.0

    def construct(self):
        stack = fit_to_stage(token_stack(rows=4, color=ACCENT), height_frac=0.5)
        stack.shift(LEFT * 3.2)
        sg, slbl = labeled(stack, "hidden rows (one per token)", color=INK_MUTED)
        # attention = rows talk; MLP = private per-row work
        attn = Text("attention: rows talk", font_size=BODY_SIZE, color=AMBER)
        attn.shift(UP * 1.4 + RIGHT * 2.6)
        one = row_vec(6, color=ACCENT, cell=0.34).shift(DOWN * 0.9 + RIGHT * 2.6)
        mlp = Text("MLP: private per-row work", font_size=BODY_SIZE, color=EMERALD)
        mlp.next_to(one, DOWN, buff=0.4)
        pull = Arrow(stack[0].get_right(), one.get_left(), buff=0.2, color=EMERALD, stroke_width=3)
        self.play(FadeIn(stack), Write(slbl), run_time=1.5)
        self.play(FadeIn(attn), run_time=0.8)
        self.play(GrowArrow(pull), FadeIn(one), FadeIn(mlp), run_time=1.3)
        highlight(self, one, color=EMERALD, run_time=0.8)
        self.guard(sg, attn, one, mlp, pull)
        pace_to(self, self.cue_duration)


class Cue01(AvoScene):
    headline = "The row is no longer context-free after attention"
    cue_duration = 24.0

    def construct(self):
        row = fit_to_stage(row_vec(6, color=ACCENT, cell=0.55), width_frac=0.7)
        row.shift(UP * 0.3)
        rg, rlbl = labeled(row, "one token row", color=ACCENT)
        badge = RoundedRectangle(
            width=3.0, height=0.7, corner_radius=0.2,
            stroke_color=AMBER, stroke_width=2.2, fill_color=AMBER, fill_opacity=0.14,
        )
        btxt = Text("+ context from attention", font_size=BODY_SIZE, color=AMBER).move_to(badge.get_center())
        bg = VGroup(badge, btxt).next_to(row, UP, buff=0.6)
        self.play(FadeIn(row), Write(rlbl), run_time=1.4)
        self.play(FadeIn(bg), run_time=1.0)
        highlight(self, bg, color=AMBER, run_time=0.9)
        self.guard(rg, bg)
        pace_to(self, self.cue_duration)


class Cue02(AvoScene):
    headline = "A linear layer expands, GELU gates, another compresses"
    cue_duration = 22.0

    def construct(self):
        din = row_vec(4, color=ACCENT, cell=0.38).shift(LEFT * 4.6)
        wide = row_vec(10, color=AMBER, cell=0.34).shift(ORIGIN)
        dout = row_vec(4, color=EMERALD, cell=0.38).shift(RIGHT * 4.6)
        din_l = Text("d_model", font_size=22, color=ACCENT).next_to(din, DOWN, buff=0.3)
        wide_l = Text("wide hidden", font_size=22, color=AMBER).next_to(wide, DOWN, buff=0.3)
        dout_l = Text("d_model", font_size=22, color=EMERALD).next_to(dout, DOWN, buff=0.3)
        a1 = Arrow(din.get_right(), wide.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3)
        a2 = Arrow(wide.get_right(), dout.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3)
        w1 = Text("W₁ + GELU", font_size=20, color=INK).next_to(a1, UP, buff=0.15)
        w2 = Text("W₂", font_size=20, color=INK).next_to(a2, UP, buff=0.15)
        grp = VGroup(din, wide, dout, din_l, wide_l, dout_l, a1, a2, w1, w2)
        fit_to_stage(grp, width_frac=0.98)
        self.play(FadeIn(din), FadeIn(din_l), run_time=1.0)
        self.play(GrowArrow(a1), FadeIn(w1), FadeIn(wide), FadeIn(wide_l), run_time=1.3)
        self.play(GrowArrow(a2), FadeIn(w2), FadeIn(dout), FadeIn(dout_l), run_time=1.3)
        highlight(self, wide, color=AMBER, run_time=0.8)
        self.guard(grp)
        pace_to(self, self.cue_duration)


class Cue03(AvoScene):
    headline = "Expansion creates room for intermediate feature combinations"
    cue_duration = 24.0

    def construct(self):
        wide = fit_to_stage(row_vec(12, color=AMBER, cell=0.42), width_frac=0.9)
        wide.shift(UP * 0.3)
        wg, wlbl = labeled(wide, "wide hidden space", color=AMBER)
        note = Text("a workbench — more room for candidate signals",
                    font_size=LABEL_SIZE, color=INK_MUTED).next_to(wide, DOWN, buff=1.0)
        self.play(FadeIn(wide), Write(wlbl), run_time=1.5)
        self.play(FadeIn(note), run_time=0.8)
        highlight(self, wide, color=AMBER, run_time=0.9)
        self.guard(wg, note)
        pace_to(self, self.cue_duration)


class Cue04(AvoScene):
    headline = "GELU is a smooth gate, not a hard switch"
    cue_duration = 24.0

    def construct(self):
        ax = Axes(
            x_range=[-4, 4, 2], y_range=[-1, 4, 1],
            x_length=7.0, y_length=3.6,
            axis_config={"color": theme.INK_SUBTLE, "stroke_width": 2},
            tips=False,
        )
        curve = ax.plot(gelu, x_range=[-4, 4], color=AMBER, stroke_width=4)
        clbl = MathTex(r"\operatorname{GELU}(x)", font_size=FORMULA_SIZE_SMALL, color=AMBER)
        clbl.next_to(ax, UP, buff=0.25)
        note = Text("strong passes • weak dims • negative fades",
                    font_size=LABEL_SIZE, color=INK_MUTED).next_to(ax, DOWN, buff=0.4)
        grp = VGroup(ax, curve, clbl, note)
        fit_to_stage(grp, height_frac=0.95)
        self.play(Create(ax), run_time=1.4)
        self.play(Create(curve), Write(clbl), run_time=1.6)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(grp)
        pace_to(self, self.cue_duration)


class Cue05(AvoScene):
    headline = "The MLP can sharpen useful internal evidence"
    cue_duration = 26.0

    def construct(self):
        wide = fit_to_stage(row_vec(10, color=AMBER, cell=0.44), width_frac=0.85)
        wide.shift(UP * 0.3)
        # amplify a couple of "useful" cells, dim the rest
        strong_idx = {2, 5, 8}
        for i, cell in enumerate(wide):
            if i in strong_idx:
                cell.set_fill(EMERALD, opacity=0.55)
                cell.set_stroke(EMERALD, width=2.2)
            else:
                cell.set_fill(AMBER, opacity=0.10)
        wg, wlbl = labeled(wide, "sharpened internal features", color=EMERALD)
        note = Text("changes internal evidence, not the next token",
                    font_size=LABEL_SIZE, color=INK_MUTED).next_to(wide, DOWN, buff=1.0)
        self.play(FadeIn(wide), Write(wlbl), run_time=1.6)
        self.play(FadeIn(note), run_time=0.8)
        highlight(self, VGroup(wide[2], wide[5], wide[8]), color=EMERALD, run_time=0.9)
        self.guard(wg, note)
        pace_to(self, self.cue_duration)


class Cue06(AvoScene):
    headline = "The output head later reads the changed hidden features"
    cue_duration = 24.0

    def construct(self):
        feats = row_vec(6, color=EMERALD, cell=0.4).shift(LEFT * 3.2)
        feats_l = Text("changed features", font_size=BODY_SIZE, color=EMERALD).next_to(feats, DOWN, buff=0.3)
        head = RoundedRectangle(width=2.0, height=1.0, corner_radius=0.12,
                                stroke_color=ACCENT, stroke_width=2.4, fill_color=ACCENT, fill_opacity=0.14)
        head_t = Text("output head", font_size=22, color=ACCENT).move_to(head.get_center())
        hg = VGroup(head, head_t).shift(RIGHT * 1.4)
        logits = Text("logits (later)", font_size=BODY_SIZE, color=INK_MUTED).next_to(hg, RIGHT, buff=0.6)
        a1 = Arrow(feats.get_right(), head.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3)
        a2 = Arrow(head.get_right(), logits.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3)
        note = Text("the MLP does not emit vocabulary probabilities",
                    font_size=LABEL_SIZE, color=INK_MUTED).to_edge(DOWN, buff=0.9)
        self.play(FadeIn(feats), FadeIn(feats_l), run_time=1.2)
        self.play(GrowArrow(a1), FadeIn(hg), run_time=1.1)
        self.play(GrowArrow(a2), FadeIn(logits), FadeIn(note), run_time=1.1)
        self.guard(feats, feats_l, hg, logits, a1, a2, note)
        pace_to(self, self.cue_duration)


class Cue07(AvoScene):
    headline = "GELU decides which intermediate signals survive"
    cue_duration = 26.0

    def construct(self):
        wide = row_vec(10, color=AMBER, cell=0.4).shift(UP * 1.2)
        wide_l = Text("expanded features", font_size=BODY_SIZE, color=AMBER).next_to(wide, UP, buff=0.3)
        gate = Text("GELU gate", font_size=BODY_SIZE, color=AMBER).shift(ORIGIN)
        gated = row_vec(10, color=EMERALD, cell=0.4).shift(DOWN * 1.2)
        # some survive (bright), some damped (faint)
        survive = {1, 3, 4, 7}
        for i, cell in enumerate(gated):
            if i in survive:
                cell.set_fill(EMERALD, opacity=0.5)
                cell.set_stroke(EMERALD, width=2.2)
            else:
                cell.set_fill(INK_MUTED, opacity=0.08)
                cell.set_stroke(INK_MUTED, width=1.2)
        gated_l = Text("damped or preserved", font_size=BODY_SIZE, color=EMERALD).next_to(gated, DOWN, buff=0.3)
        a = Arrow(wide.get_bottom(), gated.get_top(), buff=0.25, color=INK_MUTED, stroke_width=3)
        grp = VGroup(wide, wide_l, gate, gated, gated_l, a)
        fit_to_stage(grp, height_frac=0.98)
        self.play(FadeIn(wide), FadeIn(wide_l), run_time=1.3)
        self.play(GrowArrow(a), FadeIn(gate), run_time=1.0)
        self.play(FadeIn(gated), FadeIn(gated_l), run_time=1.3)
        self.guard(grp)
        pace_to(self, self.cue_duration)


class Cue08(AvoScene):
    headline = "MLP weights express associations, not a lookup table"
    cue_duration = 26.0

    def construct(self):
        f = fit_to_stage(
            MathTex(
                r"\operatorname{MLP}(h) = ",
                r"W_2\,",
                r"\operatorname{GELU}(W_1 h + b_1)",
                r" + b_2",
                font_size=FORMULA_SIZE_SMALL, color=INK,
            ),
            width_frac=0.95,
        )
        f.shift(UP * 0.6)
        f[1].set_color(EMERALD)
        f[2].set_color(AMBER)
        note = Text("a learned transformation applied when the row activates it",
                    font_size=LABEL_SIZE, color=INK_MUTED).next_to(f, DOWN, buff=1.0)
        self.play(Write(f), run_time=2.0)
        highlight(self, f[2], color=AMBER, run_time=0.9)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(f, note)
        pace_to(self, self.cue_duration)


class Cue09(AvoScene):
    headline = "The MLP changes the representation, not the final token"
    cue_duration = 26.0

    def construct(self):
        def stagebox(title, color):
            box = RoundedRectangle(width=3.2, height=1.2, corner_radius=0.12,
                                   stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.12)
            t = Text(title, font_size=20, color=INK).move_to(box.get_center())
            return VGroup(box, t)

        s1 = stagebox("attention\nwrites context", AMBER)
        s2 = stagebox("MLP\ntransforms row", EMERALD)
        s3 = stagebox("output head\nscores later", ACCENT)
        s2.next_to(s1, RIGHT, buff=1.0)
        s3.next_to(s2, RIGHT, buff=1.0)
        chain = VGroup(s1, s2, s3).move_to(ORIGIN)
        a1 = Arrow(s1.get_right(), s2.get_left(), buff=0.1, color=INK_MUTED, stroke_width=3)
        a2 = Arrow(s2.get_right(), s3.get_left(), buff=0.1, color=INK_MUTED, stroke_width=3)
        grp = VGroup(chain, a1, a2)
        fit_to_stage(grp, width_frac=0.98)
        self.play(FadeIn(s1), run_time=0.9)
        self.play(GrowArrow(a1), FadeIn(s2), run_time=1.0)
        self.play(GrowArrow(a2), FadeIn(s3), run_time=1.0)
        highlight(self, s2, color=EMERALD, run_time=0.9)
        self.guard(grp)
        pace_to(self, self.cue_duration)


class Cue10(AvoScene):
    headline = "The MLP output is added back as a residual update"
    cue_duration = 24.0

    def construct(self):
        f = fit_to_stage(
            MathTex(
                r"H_{\text{output}} = ",
                r"H_{\text{after-attn}}",
                r" + \operatorname{MLP}(\operatorname{LayerNorm}(H_{\text{after-attn}}))",
                font_size=FORMULA_SIZE_SMALL, color=INK,
            ),
            width_frac=0.95,
        )
        f.shift(UP * 0.6)
        f[1].set_color(VIOLET)
        f[2].set_color(EMERALD)
        note = fit_to_stage(
            Text("the row keeps token identity + attention context, plus the MLP delta",
                 font_size=LABEL_SIZE, color=INK_MUTED),
            width_frac=0.95,
        ).next_to(f, DOWN, buff=1.0)
        self.play(Write(f), run_time=1.9)
        # box=False: a persistent SurroundingRectangle around f[2] overlaps the
        # preceding "H_after-attn" term; the emerald color coding already marks
        # the delta, so a transient Indicate keeps the held frame clean.
        highlight(self, f[2], color=EMERALD, box=False, run_time=0.9)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(f, note)
        pace_to(self, self.cue_duration)


class Cue11(AvoScene):
    headline = "A good MLP visual shows expand, gate, compress, and add"
    cue_duration = 22.0

    def construct(self):
        din = row_vec(4, color=ACCENT, cell=0.32).shift(LEFT * 5.0)
        wide = row_vec(9, color=AMBER, cell=0.28)
        dout = row_vec(4, color=EMERALD, cell=0.32).shift(RIGHT * 5.0)
        a1 = Arrow(din.get_right(), wide.get_left(), buff=0.15, color=INK_MUTED, stroke_width=2.5)
        a2 = Arrow(wide.get_right(), dout.get_left(), buff=0.15, color=INK_MUTED, stroke_width=2.5)
        l1 = Text("expand", font_size=18, color=AMBER).next_to(a1, UP, buff=0.1)
        l2 = Text("gate → compress", font_size=18, color=EMERALD).next_to(a2, UP, buff=0.1)
        spine = Arrow(din.get_left() + DOWN * 1.6 + LEFT * 0.2,
                      dout.get_right() + DOWN * 1.6 + RIGHT * 0.2,
                      buff=0.1, color=VIOLET, stroke_width=5)
        add = Text("residual add", font_size=20, color=VIOLET).next_to(spine, DOWN, buff=0.2)
        grp = VGroup(din, wide, dout, a1, a2, l1, l2, spine, add)
        fit_to_stage(grp, width_frac=0.98)
        self.play(FadeIn(din), run_time=0.8)
        self.play(GrowArrow(a1), FadeIn(l1), FadeIn(wide), run_time=1.0)
        self.play(GrowArrow(a2), FadeIn(l2), FadeIn(dout), run_time=1.0)
        self.play(GrowArrow(spine), FadeIn(add), run_time=1.0)
        self.guard(grp)
        pace_to(self, self.cue_duration)


class Cue12(AvoScene):
    headline = "The MLP is nonlinear per-row feature work in the residual stream"
    cue_duration = 18.0

    def construct(self):
        lines = VGroup(
            Text("attention provides context", font_size=BODY_SIZE, color=AMBER),
            Text("the MLP transforms each row", font_size=BODY_SIZE, color=EMERALD),
            Text("the residual stream carries it forward", font_size=BODY_SIZE, color=VIOLET),
        ).arrange(DOWN, buff=0.5)
        fit_to_stage(lines, height_frac=0.7)
        self.play(FadeIn(lines[0]), run_time=0.9)
        self.play(FadeIn(lines[1]), run_time=0.9)
        self.play(FadeIn(lines[2]), run_time=0.9)
        self.guard(lines)
        pace_to(self, self.cue_duration)
