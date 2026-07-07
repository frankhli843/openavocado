"""
Lesson 15, Part 86 — "The Residual Stream: How Information Flows Through Blocks"

One Cue<NN> scene per storyboard cue (manim/storyboards/lesson_15/segment_86.json).
Each pins itself to its cue window via pace_to. Visual system:
  - hidden-state matrix H as a grid of cells (rows = tokens, cols = d_model)
  - the residual stream as a horizontal spine carrying H forward
  - sublayers contribute a delta added back with a ⊕ node
  - MathTex for the additive-continuity formulas

Colors (from theme): ACCENT=stream/H, AMBER=attention delta, EMERALD=mlp delta,
VIOLET=LayerNorm.
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
    FORMULA_SIZE_SMALL,
    LABEL_SIZE,
    fit_to_stage,
    highlight,
)
from pacing import pace_to
from manim import (
    VGroup,
    Square,
    RoundedRectangle,
    Text,
    MathTex,
    Arrow,
    Line,
    Circle,
    Dot,
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


def hidden_matrix(rows=4, cols=6, color=ACCENT, cell=0.34, gap=0.06):
    """A hidden-state matrix as a grid of small rounded cells (rows = tokens)."""
    grid = VGroup()
    for r in range(rows):
        for c in range(cols):
            sq = RoundedRectangle(
                width=cell,
                height=cell,
                corner_radius=0.05,
                stroke_color=color,
                stroke_width=1.5,
                fill_color=color,
                fill_opacity=0.18,
            )
            sq.move_to([c * (cell + gap), -r * (cell + gap), 0])
            grid.add(sq)
    grid.move_to(ORIGIN)
    return grid


def labeled(mob, text, size=LABEL_SIZE, color=INK, buff=0.25, edge=DOWN):
    lbl = Text(text, font_size=size, color=color)
    lbl.next_to(mob, edge, buff=buff)
    return VGroup(mob, lbl), lbl


def plus_node(color=INK):
    c = Circle(radius=0.22, stroke_color=color, stroke_width=2.5, fill_color=theme.BG, fill_opacity=1)
    p = Text("+", font_size=30, color=color).move_to(c.get_center())
    return VGroup(c, p)


class Cue00(AvoScene):
    headline = "The residual stream carries the hidden state forward"
    cue_duration = 16.0

    def construct(self):
        H = fit_to_stage(hidden_matrix(color=ACCENT), height_frac=0.55)
        H.shift(LEFT * 2.2)
        Hg, hlbl = labeled(H, "H  (tokens × d_model)", color=INK_MUTED)
        spine = Arrow(H.get_right() + RIGHT * 0.2, H.get_right() + RIGHT * 4.2, buff=0.1, color=ACCENT, stroke_width=6)
        stream_lbl = Text("residual stream", font_size=LABEL_SIZE, color=ACCENT).next_to(spine, UP, buff=0.2)
        self.play(FadeIn(H), Write(hlbl), run_time=1.4)
        self.play(GrowArrow(spine), FadeIn(stream_lbl), run_time=1.2)
        highlight(self, spine, color=ACCENT, box=False, run_time=0.8)
        self.guard(Hg, spine, stream_lbl)
        pace_to(self, self.cue_duration)


class Cue01(AvoScene):
    headline = "A sublayer contributes a delta, not a whole new row"
    cue_duration = 18.0

    def construct(self):
        f = fit_to_stage(
            MathTex(
                r"H_{\text{after-attn}} = ",
                r"H_{\text{input}}",
                r" + \operatorname{Attention}(\operatorname{LayerNorm}(H_{\text{input}}))",
                font_size=FORMULA_SIZE_SMALL,
                color=INK,
            ),
            width_frac=0.95,
        )
        f.shift(UP * 0.6)
        f[1].set_color(ACCENT)   # original stream kept
        f[2].set_color(AMBER)    # the added delta
        note = Text("add an update — keep the original", font_size=LABEL_SIZE, color=INK_MUTED)
        note.next_to(f, DOWN, buff=0.9)
        self.play(Write(f), run_time=1.8)
        highlight(self, f[2], color=AMBER, run_time=0.9)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(f, note)
        pace_to(self, self.cue_duration)


class Cue02(AvoScene):
    headline = "Sublayers annotate the same stream"
    cue_duration = 18.0

    def construct(self):
        page = fit_to_stage(hidden_matrix(color=ACCENT), height_frac=0.5)
        page.shift(LEFT * 1.6)
        pg, plbl = labeled(page, "same page size", color=INK_MUTED)
        note = plus_node(AMBER).next_to(page, RIGHT, buff=0.7)
        notes_txt = Text("+ notes", font_size=LABEL_SIZE, color=AMBER).next_to(note, RIGHT, buff=0.3)
        self.play(FadeIn(page), Write(plbl), run_time=1.3)
        self.play(FadeIn(note), FadeIn(notes_txt), run_time=1.0)
        highlight(self, page, color=ACCENT, run_time=0.8)
        self.guard(pg, note, notes_txt)
        pace_to(self, self.cue_duration)


class Cue03(AvoScene):
    headline = "Row count and hidden width stay unchanged"
    cue_duration = 15.0

    def construct(self):
        H = fit_to_stage(hidden_matrix(color=ACCENT), height_frac=0.5)
        shape = MathTex(r"L \times d_{\text{model}}", font_size=FORMULA_SIZE_SMALL, color=EMERALD)
        shape.next_to(H, DOWN, buff=0.35)
        self.play(FadeIn(H), run_time=1.0)
        self.play(Write(shape), run_time=1.0)
        highlight(self, shape, color=EMERALD, run_time=0.9)
        self.guard(H, shape)
        pace_to(self, self.cue_duration)


class Cue04(AvoScene):
    headline = "LayerNorm stabilizes what the sublayer reads"
    cue_duration = 21.0

    def construct(self):
        # residual spine straight across; LN branch reads off it
        spine = Line(LEFT * 5, RIGHT * 5, color=ACCENT, stroke_width=6).shift(UP * 1.2)
        spine_lbl = Text("residual path (unchanged)", font_size=LABEL_SIZE, color=ACCENT).next_to(spine, UP, buff=0.2)
        ln = RoundedRectangle(width=2.2, height=1.0, corner_radius=0.12, stroke_color=VIOLET, stroke_width=2.5,
                              fill_color=VIOLET, fill_opacity=0.15)
        ln_txt = Text("LayerNorm", font_size=LABEL_SIZE, color=VIOLET).move_to(ln.get_center())
        ln_group = VGroup(ln, ln_txt).shift(DOWN * 0.6)
        read = Arrow(spine.get_center(), ln.get_top(), buff=0.1, color=VIOLET, stroke_width=4)
        self.play(Create(spine), FadeIn(spine_lbl), run_time=1.3)
        self.play(GrowArrow(read), FadeIn(ln_group), run_time=1.2)
        highlight(self, ln_group, color=VIOLET, run_time=0.9)
        self.guard(spine, spine_lbl, ln_group, read)
        pace_to(self, self.cue_duration)


class Cue05(AvoScene):
    headline = "Attention adds cross-token context to the stream"
    cue_duration = 20.0

    def construct(self):
        f = fit_to_stage(
            MathTex(
                r"H_{\text{after-attn}} = H_{\text{input}} + ",
                r"\operatorname{Attention}(\operatorname{LayerNorm}(H_{\text{input}}))",
                font_size=FORMULA_SIZE_SMALL,
                color=INK,
            ),
            width_frac=0.95,
        )
        f.shift(UP * 0.7)
        f[1].set_color(AMBER)
        cross = Text("context gathered from other token rows", font_size=LABEL_SIZE, color=INK_MUTED)
        cross.next_to(f, DOWN, buff=0.9)
        self.play(Write(f), run_time=1.8)
        highlight(self, f[1], color=AMBER, run_time=0.9)
        self.play(FadeIn(cross), run_time=0.8)
        self.guard(f, cross)
        pace_to(self, self.cue_duration)


class Cue06(AvoScene):
    headline = "The MLP adds a same-width per-token update"
    cue_duration = 20.0

    def construct(self):
        f = fit_to_stage(
            MathTex(
                r"H_{\text{output}} = H_{\text{after-attn}} + ",
                r"\operatorname{MLP}(\operatorname{LayerNorm}(H_{\text{after-attn}}))",
                font_size=FORMULA_SIZE_SMALL,
                color=INK,
            ),
            width_frac=0.95,
        )
        f.shift(UP * 0.7)
        f[1].set_color(EMERALD)
        perrow = Text("each row updated on its own — no mixing", font_size=LABEL_SIZE, color=INK_MUTED)
        perrow.next_to(f, DOWN, buff=0.9)
        self.play(Write(f), run_time=1.8)
        highlight(self, f[1], color=EMERALD, run_time=0.9)
        self.play(FadeIn(perrow), run_time=0.8)
        self.guard(f, perrow)
        pace_to(self, self.cue_duration)


class Cue07(AvoScene):
    headline = "Blocks stack because every block returns the same shape"
    cue_duration = 17.0

    def construct(self):
        blocks = VGroup()
        prev = None
        for i in range(3):
            b = RoundedRectangle(width=1.6, height=1.6, corner_radius=0.12, stroke_color=ACCENT, stroke_width=2.5,
                                 fill_color=ACCENT, fill_opacity=0.12)
            t = Text(f"Block {i+1}", font_size=22, color=INK).move_to(b.get_center())
            g = VGroup(b, t)
            if prev is not None:
                g.next_to(prev, RIGHT, buff=1.0)
            blocks.add(g)
            prev = g
        blocks.move_to(ORIGIN)
        arrows = VGroup()
        for i in range(2):
            a = Arrow(blocks[i].get_right(), blocks[i + 1].get_left(), buff=0.1, color=EMERALD, stroke_width=4)
            arrows.add(a)
        shape = MathTex(r"L \times d_{\text{model}}", font_size=28, color=EMERALD)
        shape.next_to(blocks, UP, buff=0.5)
        self.play(FadeIn(blocks), run_time=1.3)
        self.play(GrowArrow(arrows[0]), GrowArrow(arrows[1]), Write(shape), run_time=1.2)
        highlight(self, shape, color=EMERALD, run_time=0.9)
        self.guard(blocks, arrows, shape)
        pace_to(self, self.cue_duration)


class Cue08(AvoScene):
    headline = "Residuals preserve the thread while updates accumulate"
    cue_duration = 17.0

    def construct(self):
        f = fit_to_stage(
            MathTex(
                r"H_{out} = ",
                r"H_{in}",
                r" + \Delta_{\text{attention}}",
                r" + \Delta_{\text{mlp}}",
                font_size=theme.FORMULA_SIZE,
                color=INK,
            ),
            width_frac=0.95,
        )
        f[1].set_color(ACCENT)
        f[2].set_color(AMBER)
        f[3].set_color(EMERALD)
        self.play(Write(f), run_time=2.0)
        highlight(self, f[2], color=AMBER, box=False, run_time=0.6)
        highlight(self, f[3], color=EMERALD, box=False, run_time=0.6)
        self.guard(f)
        pace_to(self, self.cue_duration)
