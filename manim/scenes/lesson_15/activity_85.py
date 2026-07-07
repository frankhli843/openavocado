"""
Lesson 15, Part 85 — "How Q, K, V Produce Attention Scores"

One Cue<NN> scene per storyboard cue (manim/storyboards/lesson_15/segment_85.json).
Each pins itself to its cue window via pace_to. Visual system:
  - a token's hidden row projected into three learned views Q/K/V (row strips)
  - a stack of key rows (one per token) that the query is matched against
  - dot products → a raw score row → scaled → softmax weights
  - value rows blended by those weights into a single context vector

Colors (from theme): Q = ACCENT (blue), K = AMBER, V = EMERALD. The color that
is "lit" tracks whatever the narration is currently discussing.
"""

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
    Line,
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


def key_stack(rows=4, cols=6, color=AMBER, cell=0.34, gap=0.07, opacity=0.16):
    """A stack of key/value rows (one per token)."""
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


class Cue00(AvoScene):
    headline = "One hidden row is copied into three learned views"
    cue_duration = 24.0

    def construct(self):
        x = row_vec(6, color=INK_MUTED)
        xg, xlbl = labeled(x, "token hidden row  x", color=INK_MUTED, edge=UP, buff=0.3)
        xg.shift(UP * 1.7)
        # three projected views fan out below
        q = row_vec(6, color=ACCENT).shift(DOWN * 0.9 + LEFT * 3.6)
        k = row_vec(6, color=AMBER).shift(DOWN * 0.9)
        v = row_vec(6, color=EMERALD).shift(DOWN * 0.9 + RIGHT * 3.6)
        ql = Text("Q  query", font_size=BODY_SIZE, color=ACCENT).next_to(q, DOWN, buff=0.25)
        kl = Text("K  key", font_size=BODY_SIZE, color=AMBER).next_to(k, DOWN, buff=0.25)
        vl = Text("V  value", font_size=BODY_SIZE, color=EMERALD).next_to(v, DOWN, buff=0.25)
        aq = Arrow(x.get_bottom(), q.get_top(), buff=0.15, color=ACCENT, stroke_width=3)
        ak = Arrow(x.get_bottom(), k.get_top(), buff=0.15, color=AMBER, stroke_width=3)
        av = Arrow(x.get_bottom(), v.get_top(), buff=0.15, color=EMERALD, stroke_width=3)
        self.play(FadeIn(x), Write(xlbl), run_time=1.6)
        self.play(GrowArrow(aq), GrowArrow(ak), GrowArrow(av), run_time=1.2)
        self.play(FadeIn(q), FadeIn(k), FadeIn(v),
                  FadeIn(ql), FadeIn(kl), FadeIn(vl), run_time=1.6)
        self.guard(xg, q, k, v, ql, kl, vl)
        pace_to(self, self.cue_duration)


class Cue01(AvoScene):
    headline = "The query is the current token asking what it needs"
    cue_duration = 23.0

    def construct(self):
        q = fit_to_stage(row_vec(6, color=ACCENT), width_frac=0.6)
        qg, qlbl = labeled(q, "Q = x W_Q", color=ACCENT)
        f = MathTex(r"Q = x\,W_Q", font_size=FORMULA_SIZE_SMALL, color=INK).shift(UP * 1.6)
        f[0][0].set_color(ACCENT)
        note = Text('"what am I looking for?"', font_size=LABEL_SIZE, color=INK_MUTED)
        note.next_to(q, DOWN, buff=1.0)
        self.play(Write(f), run_time=1.4)
        self.play(FadeIn(q), run_time=1.0)
        highlight(self, q, color=ACCENT, run_time=0.9)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(q, f, note)
        pace_to(self, self.cue_duration)


class Cue02(AvoScene):
    headline = "Every token publishes a key that can be matched"
    cue_duration = 23.0

    def construct(self):
        K = fit_to_stage(key_stack(rows=4, color=AMBER), height_frac=0.55)
        K.shift(LEFT * 0.4)
        Kg, klbl = labeled(K, "K rows — one per token", color=AMBER)
        f = MathTex(r"K = X\,W_K", font_size=FORMULA_SIZE_SMALL, color=INK).next_to(K, RIGHT, buff=0.9)
        f[0][0].set_color(AMBER)
        self.play(FadeIn(K), Write(klbl), run_time=1.6)
        self.play(Write(f), run_time=1.0)
        highlight(self, K, color=AMBER, run_time=0.9)
        self.guard(Kg, f)
        pace_to(self, self.cue_duration)


class Cue03(AvoScene):
    headline = "Values hold the content attention will retrieve"
    cue_duration = 19.0

    def construct(self):
        V = fit_to_stage(key_stack(rows=4, color=EMERALD), height_frac=0.55)
        V.shift(LEFT * 0.4)
        Vg, vlbl = labeled(V, "V rows — the actual content", color=EMERALD)
        f = MathTex(r"V = X\,W_V", font_size=FORMULA_SIZE_SMALL, color=INK).next_to(V, RIGHT, buff=0.9)
        f[0][0].set_color(EMERALD)
        note = Text("keys match • values carry", font_size=LABEL_SIZE, color=INK_MUTED)
        note.to_edge(DOWN, buff=1.0)
        self.play(FadeIn(V), Write(vlbl), run_time=1.4)
        self.play(Write(f), FadeIn(note), run_time=1.0)
        highlight(self, V, color=EMERALD, run_time=0.9)
        self.guard(Vg, f, note)
        pace_to(self, self.cue_duration)


class Cue04(AvoScene):
    headline = "Q is compared with every K row"
    cue_duration = 22.0

    def construct(self):
        q = row_vec(6, color=ACCENT).shift(UP * 1.7)
        qlbl = Text("query", font_size=LABEL_SIZE, color=ACCENT).next_to(q, LEFT, buff=0.4)
        K = key_stack(rows=4, color=AMBER, cell=0.3).shift(DOWN * 1.0 + LEFT * 0.4)
        klbl = Text("keys", font_size=LABEL_SIZE, color=AMBER).next_to(K, LEFT, buff=0.4)
        dots = VGroup(*[
            Arrow(q.get_bottom(), K[r].get_left() + LEFT * 0.05, buff=0.12,
                  color=INK_MUTED, stroke_width=2.5)
            for r in range(4)
        ])
        f = MathTex(r"q \cdot k_i", font_size=FORMULA_SIZE_SMALL, color=INK).to_edge(RIGHT, buff=1.2)
        self.play(FadeIn(q), FadeIn(qlbl), run_time=1.2)
        self.play(FadeIn(K), FadeIn(klbl), run_time=1.2)
        self.play(*[GrowArrow(a) for a in dots], Write(f), run_time=1.4)
        self.guard(q, qlbl, K, klbl, f)
        pace_to(self, self.cue_duration)


class Cue05(AvoScene):
    headline = "The dot products become a row of QK^T"
    cue_duration = 15.0

    def construct(self):
        scores = row_vec(4, color=VIOLET, cell=0.55, opacity=0.2).shift(UP * 0.3)
        vals = ["4.1", "0.7", "2.9", "1.2"]
        nums = VGroup(*[
            Text(vals[i], font_size=22, color=INK).move_to(scores[i].get_center())
            for i in range(4)
        ])
        slbl = Text("one score per source token", font_size=LABEL_SIZE, color=VIOLET)
        slbl.next_to(scores, DOWN, buff=0.5)
        f = MathTex(r"(QK^T)_{\text{row}}", font_size=FORMULA_SIZE_SMALL, color=VIOLET).next_to(scores, UP, buff=0.6)
        self.play(FadeIn(scores), Write(f), run_time=1.4)
        self.play(FadeIn(nums), FadeIn(slbl), run_time=1.0)
        self.guard(scores, nums, slbl, f)
        pace_to(self, self.cue_duration)


class Cue06(AvoScene):
    headline = "Scaling keeps the raw scores from spiking too early"
    cue_duration = 28.0

    def construct(self):
        f = fit_to_stage(
            MathTex(
                r"\frac{QK^T}{\sqrt{d_k}}",
                font_size=FORMULA_SIZE, color=INK,
            ),
            height_frac=0.5,
        )
        f.shift(UP * 0.6)
        f[0][3:].set_color(AMBER)  # the sqrt(d_k) denominator
        note = Text("divide by √dₖ — keep the range calm before softmax",
                    font_size=LABEL_SIZE, color=INK_MUTED)
        note.next_to(f, DOWN, buff=1.0)
        self.play(Write(f), run_time=1.8)
        highlight(self, f, color=AMBER, run_time=0.9)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(f, note)
        pace_to(self, self.cue_duration)


class Cue07(AvoScene):
    headline = "Softmax turns scores into an attention budget"
    cue_duration = 27.0

    def construct(self):
        raw = row_vec(4, color=VIOLET, cell=0.5, opacity=0.18).shift(UP * 1.4 + LEFT * 2.4)
        raw_lbl = Text("scores", font_size=BODY_SIZE, color=VIOLET).next_to(raw, LEFT, buff=0.35)
        weights = row_vec(4, color=ACCENT, cell=0.5, opacity=0.18).shift(DOWN * 0.6 + LEFT * 2.4)
        w_vals = ["0.62", "0.05", "0.26", "0.07"]
        w_nums = VGroup(*[
            Text(w_vals[i], font_size=18, color=INK).move_to(weights[i].get_center())
            for i in range(4)
        ])
        arrow = Arrow(raw.get_bottom(), weights.get_top(), buff=0.2, color=INK_MUTED, stroke_width=3)
        f = MathTex(r"\operatorname{softmax}", font_size=FORMULA_SIZE_SMALL, color=INK).next_to(arrow, RIGHT, buff=0.4)
        sums = Text("positive • sums to 1", font_size=LABEL_SIZE, color=ACCENT).next_to(weights, DOWN, buff=0.6)
        self.play(FadeIn(raw), FadeIn(raw_lbl), run_time=1.2)
        self.play(GrowArrow(arrow), Write(f), run_time=1.0)
        self.play(FadeIn(weights), FadeIn(w_nums), FadeIn(sums), run_time=1.4)
        highlight(self, weights, color=ACCENT, run_time=0.8)
        self.guard(raw, raw_lbl, weights, w_nums, arrow, f, sums)
        pace_to(self, self.cue_duration)


class Cue08(AvoScene):
    headline = "The weights decide how much each V row contributes"
    cue_duration = 29.0

    def construct(self):
        V = key_stack(rows=4, color=EMERALD, cell=0.32).shift(LEFT * 2.4)
        vlbl = Text("V rows", font_size=BODY_SIZE, color=EMERALD).next_to(V, UP, buff=0.3)
        w_vals = ["0.62", "0.05", "0.26", "0.07"]
        wgts = VGroup()
        for r in range(4):
            wt = Text("× " + w_vals[r], font_size=20, color=ACCENT).next_to(V[r], RIGHT, buff=0.4)
            wgts.add(wt)
        f = MathTex(r"\sum_i \alpha_i\, v_i", font_size=FORMULA_SIZE_SMALL, color=INK).to_edge(RIGHT, buff=1.4)
        f[0][1:3].set_color(ACCENT)
        f[0][3:].set_color(EMERALD)
        self.play(FadeIn(V), FadeIn(vlbl), run_time=1.4)
        self.play(FadeIn(wgts), Write(f), run_time=1.4)
        highlight(self, wgts[0], color=ACCENT, run_time=0.8)
        self.guard(V, vlbl, wgts, f)
        pace_to(self, self.cue_duration)


class Cue09(AvoScene):
    headline = "High weights pull more content into the context vector"
    cue_duration = 26.0

    def construct(self):
        # emphasize the dominant value row feeding the output
        V = key_stack(rows=4, color=EMERALD, cell=0.34).shift(LEFT * 2.6)
        out = row_vec(6, color=ACCENT, cell=0.36).shift(RIGHT * 3.0)
        out_lbl = Text("context vector", font_size=BODY_SIZE, color=ACCENT).next_to(out, DOWN, buff=0.35)
        # strongest weight = row 0
        strong = Arrow(V[0].get_right(), out.get_left(), buff=0.2, color=EMERALD, stroke_width=5)
        weak = VGroup(*[
            Arrow(V[r].get_right(), out.get_left(), buff=0.2, color=INK_MUTED, stroke_width=1.5)
            for r in range(1, 4)
        ])
        self.play(FadeIn(V), run_time=1.2)
        self.play(FadeIn(out), FadeIn(out_lbl), run_time=1.0)
        self.play(GrowArrow(strong), *[GrowArrow(a) for a in weak], run_time=1.4)
        highlight(self, V[0], color=EMERALD, run_time=0.8)
        self.guard(V, out, out_lbl, strong, weak)
        pace_to(self, self.cue_duration)


class Cue10(AvoScene):
    headline = "The context vector is the attention update"
    cue_duration = 27.0

    def construct(self):
        f = fit_to_stage(
            MathTex(
                r"\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\!\left(\frac{QK^T}{\sqrt{d_k}}\right)V",
                font_size=FORMULA_SIZE_SMALL, color=INK,
            ),
            width_frac=0.95,
        )
        f.shift(UP * 0.5)
        note = Text("one concrete update for this token position",
                    font_size=LABEL_SIZE, color=INK_MUTED).next_to(f, DOWN, buff=1.0)
        self.play(Write(f), run_time=2.2)
        highlight(self, f, color=ACCENT, box=False, run_time=0.9)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(f, note)
        pace_to(self, self.cue_duration)


class Cue11(AvoScene):
    headline = "Attention hands the update back to the residual stream"
    cue_duration = 9.0

    def construct(self):
        ctx = row_vec(6, color=ACCENT, cell=0.4).shift(LEFT * 2.2)
        ctx_lbl = Text("context vector", font_size=BODY_SIZE, color=ACCENT).next_to(ctx, DOWN, buff=0.3)
        spine = Arrow(ctx.get_right() + RIGHT * 0.2, ctx.get_right() + RIGHT * 4.0,
                      buff=0.1, color=VIOLET, stroke_width=6)
        stream_lbl = Text("residual stream", font_size=LABEL_SIZE, color=VIOLET).next_to(spine, UP, buff=0.2)
        self.play(FadeIn(ctx), FadeIn(ctx_lbl), run_time=1.0)
        self.play(GrowArrow(spine), FadeIn(stream_lbl), run_time=1.2)
        self.guard(ctx, ctx_lbl, spine, stream_lbl)
        pace_to(self, self.cue_duration)
