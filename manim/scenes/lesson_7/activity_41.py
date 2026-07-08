"""
Lesson 7, Part 41 — "What a Transformer Block Does" (161.71s, 33 cues, 5s each).

A guided walk through one transformer block, one moving part per 5-second cue.
Each cue shows a compact "you-are-here" minimap of the block on the LEFT (the
current stage lit, the rest dimmed) and a larger FOCUS visual on the RIGHT that
actually changes the object the narration names — the L×D matrix, a token row,
the query/key score grid, the residual add, LayerNorm rescale, the MLP
expand→gate→compress, and the path toward the output head / logits.

One Cue<NN> scene per storyboard cue (manim/storyboards/lesson_7/segment_41.json).
Reuses manim/transformer.py idioms. Because each 5s cue is a separate Scene, the
minimap is rebuilt every cue for a continuous look; animations stay ≲3.5s so the
chunk fits its 5s window (pace_to holds the remainder).

Colors: ACCENT=hidden H, AMBER=attention, EMERALD=MLP, VIOLET=residual/norm,
EMERALD=logits.
"""

import theme
from theme import (
    AvoScene,
    ACCENT,
    ACCENT_LIGHT,
    AMBER,
    EMERALD,
    VIOLET,
    ROSE,
    INK,
    INK_MUTED,
    INK_SUBTLE,
    LABEL_SIZE,
    BODY_SIZE,
)
from pacing import pace_to
import transformer
from transformer import (
    mini_pipeline,
    hidden_matrix,
    attention_grid,
    vector_strip,
    logit_bars,
    fit_label,
    C_EMBED,
    C_ATTN,
    C_MLP,
    C_RESID,
    C_LOGIT,
)
from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Square,
    Text,
    MathTex,
    Arrow,
    DoubleArrow,
    Line,
    CurvedArrow,
    Circle,
    Dot,
    SurroundingRectangle,
    Axes,
    FadeIn,
    FadeOut,
    Write,
    GrowArrow,
    Create,
    Indicate,
    Transform,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
    PI,
)


# ─── shared layout ───────────────────────────────────────────────────────────
def stage_map(active):
    """Left minimap (current stage lit) + its caption, positioned on the left."""
    mm = mini_pipeline(active=active, scale=0.5)
    mm.to_edge(LEFT, buff=0.5)
    cap = Text("transformer block", font_size=18, color=INK_SUBTLE)
    cap.next_to(mm, UP, buff=0.2)
    return VGroup(mm, cap), mm


def focus_headline(text, color=INK):
    """A right-side focus caption under the title band region."""
    t = fit_label(text, 8.2, BODY_SIZE, color)
    return t


class _Act41(AvoScene):
    """Base: draws the minimap for `active_stage`, then subclasses add focus."""
    active_stage = 'in'

    def base(self):
        mapg, mm = stage_map(self.active_stage)
        self.play(FadeIn(mapg), run_time=0.7)
        return mapg, mm


# ─── Phase A: the input matrix (cues 00–05) ──────────────────────────────────
class Cue00(_Act41):
    headline = "The matrix is shaped L by D"
    cue_duration = 5.0
    active_stage = 'in'

    def construct(self):
        self.base()
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.5).shift(RIGHT * 2.4)
        shape = MathTex(r"L \times D", font_size=theme.FORMULA_SIZE_SMALL, color=ACCENT).next_to(H, DOWN, buff=0.4)
        self.play(FadeIn(H), run_time=1.2)
        self.play(Write(shape), run_time=1.0)
        self.play(Indicate(shape, color=ACCENT, scale_factor=1.15), run_time=0.8)
        self.guard(H, shape)
        pace_to(self, self.cue_duration)


class Cue01(_Act41):
    headline = "Rows are token positions"
    cue_duration = 5.0
    active_stage = 'in'

    def construct(self):
        self.base()
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.5,
                          row_labels=["pos 0", "pos 1", "pos 2", "pos 3"]).shift(RIGHT * 2.7)
        self.play(FadeIn(H), run_time=1.2)
        for r in H.cell_rows:
            self.play(r.animate.set_stroke(AMBER, 3), run_time=0.35)
        self.guard(H)
        pace_to(self, self.cue_duration)


class Cue02(_Act41):
    headline = "Columns are hidden features"
    cue_duration = 5.0
    active_stage = 'in'

    def construct(self):
        self.base()
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.5).shift(RIGHT * 2.4)
        cols_l = Text("features →", font_size=LABEL_SIZE, color=ACCENT).next_to(H, UP, buff=0.3)
        self.play(FadeIn(H), Write(cols_l), run_time=1.2)
        # light one column across all rows
        for ci in [0, 2, 4]:
            col_cells = [H.cell_rows[r][ci] for r in range(4)]
            self.play(*[c.animate.set_fill(ACCENT, 0.55) for c in col_cells], run_time=0.55)
        self.guard(H, cols_l)
        pace_to(self, self.cue_duration)


class Cue03(_Act41):
    headline = "No context is mixed between rows yet"
    cue_duration = 5.0
    active_stage = 'in'

    def construct(self):
        self.base()
        rows = VGroup()
        for i in range(4):
            r = vector_strip(6, color=C_EMBED, cell=0.34)
            rows.add(r)
        rows.arrange(DOWN, buff=0.5).shift(RIGHT * 2.4)
        note = Text("rows independent", font_size=LABEL_SIZE, color=INK_MUTED).next_to(rows, DOWN, buff=0.35)
        self.play(FadeIn(rows), run_time=1.2)
        # separate rows to emphasize independence
        self.play(rows[0].animate.shift(UP * 0.15), rows[3].animate.shift(DOWN * 0.15), run_time=0.8)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(rows, note)
        pace_to(self, self.cue_duration)


class Cue04(_Act41):
    headline = "The block sees numbers, not text"
    cue_duration = 5.0
    active_stage = 'in'

    def construct(self):
        self.base()
        # a row of number cells with values
        vals = ["0.4", "-1.2", "0.7", "0.1", "-0.5", "1.3"]
        row = VGroup()
        for v in vals:
            box = RoundedRectangle(width=0.95, height=0.7, corner_radius=0.06,
                                   stroke_color=C_EMBED, stroke_width=1.6, fill_color=C_EMBED, fill_opacity=0.16)
            t = Text(v, font_size=20, color=INK).move_to(box.get_center())
            row.add(VGroup(box, t))
        row.arrange(RIGHT, buff=0.14).shift(RIGHT * 2.3)
        cap = Text('"she" → numbers, no letters', font_size=LABEL_SIZE, color=INK_MUTED).next_to(row, UP, buff=0.35)
        self.play(FadeIn(cap), run_time=0.7)
        self.play(FadeIn(row, shift=UP * 0.1), run_time=1.3)
        self.play(Indicate(row, color=C_EMBED, scale_factor=1.05), run_time=0.8)
        self.guard(row, cap)
        pace_to(self, self.cue_duration)


class Cue05(_Act41):
    headline = "The table shape stays L by D"
    cue_duration = 5.0
    active_stage = 'in'

    def construct(self):
        self.base()
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.5).shift(RIGHT * 2.4)
        inv = MathTex(r"L \times D \;=\; \text{invariant}", font_size=theme.FORMULA_SIZE_SMALL, color=EMERALD).next_to(H, DOWN, buff=0.4)
        self.play(FadeIn(H), run_time=1.0)
        self.play(Write(inv), run_time=1.1)
        self.play(Indicate(inv, color=EMERALD, scale_factor=1.1), run_time=0.9)
        self.guard(H, inv)
        pace_to(self, self.cue_duration)


# ─── Phase B: attention (cues 06–11) ─────────────────────────────────────────
class Cue06(_Act41):
    headline = "Context now enters the rows"
    cue_duration = 5.0
    active_stage = 'attn'

    def construct(self):
        self.base()
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.46).shift(RIGHT * 2.6)
        arcs = VGroup(
            CurvedArrow(H.cell_rows[0].get_right(), H.cell_rows[2].get_right(), color=AMBER, angle=-PI / 2),
            CurvedArrow(H.cell_rows[3].get_right(), H.cell_rows[1].get_right(), color=AMBER, angle=-PI / 2),
        )
        self.play(FadeIn(H), run_time=1.0)
        self.play(Create(arcs), run_time=1.3)
        self.play(*[H.cell_rows[r].animate.set_fill(AMBER, 0.3) for r in range(4)], run_time=0.9)
        self.guard(H, arcs)
        pace_to(self, self.cue_duration)


class Cue07(_Act41):
    headline = "Build the query–key score grid"
    cue_duration = 5.0
    active_stage = 'attn'

    def construct(self):
        self.base()
        grid = attention_grid(L=4, cell=0.6).shift(RIGHT * 2.6)
        ql = Text("query ↓", font_size=20, color=AMBER).next_to(grid, LEFT, buff=0.3)
        kl = Text("key →", font_size=20, color=AMBER).next_to(grid, UP, buff=0.25)
        self.play(FadeIn(grid), run_time=1.4)
        self.play(Write(ql), Write(kl), run_time=1.0)
        self.guard(grid, ql, kl)
        pace_to(self, self.cue_duration)


class Cue08(_Act41):
    headline = "Bright cells show which tokens are read"
    cue_duration = 5.0
    active_stage = 'attn'

    def construct(self):
        self.base()
        # row 3 (query) attends strongly to keys 0 and 3
        weights = [[(0.9 if c <= r else 0.0) for c in range(4)] for r in range(4)]
        grid = attention_grid(L=4, weights=weights, cell=0.6).shift(RIGHT * 2.6)
        self.play(FadeIn(grid), run_time=1.0)
        # brighten the strongest cells in the last query row
        bright = [grid.cell_grid[3][0], grid.cell_grid[3][3]]
        self.play(*[c.animate.set_fill(AMBER, 1.0).set_stroke(INK, 2) for c in bright], run_time=1.2)
        self.play(*[Indicate(c, color=AMBER, scale_factor=1.12) for c in bright], run_time=0.9)
        self.guard(grid)
        pace_to(self, self.cue_duration)


class Cue09(_Act41):
    headline = "A weighted mix pulls context together"
    cue_duration = 5.0
    active_stage = 'attn'

    def construct(self):
        self.base()
        srcs = VGroup(*[vector_strip(6, color=C_EMBED, cell=0.26) for _ in range(3)])
        srcs.arrange(DOWN, buff=0.35).shift(RIGHT * 0.8)
        mixed = vector_strip(6, color=AMBER, cell=0.34).shift(RIGHT * 5.0)
        mixed_l = Text("context vector", font_size=20, color=AMBER).next_to(mixed, DOWN, buff=0.25)
        arrows = VGroup(*[Arrow(s.get_right(), mixed.get_left(), buff=0.2, color=AMBER, stroke_width=2.4,
                               max_tip_length_to_length_ratio=0.1) for s in srcs])
        self.play(FadeIn(srcs), run_time=1.0)
        self.play(*[GrowArrow(a) for a in arrows], run_time=1.1)
        self.play(FadeIn(mixed), Write(mixed_l), run_time=1.0)
        self.guard(srcs, mixed, mixed_l)
        pace_to(self, self.cue_duration)


class Cue10(_Act41):
    headline = "Each row gets its own context update"
    cue_duration = 5.0
    active_stage = 'attn'

    def construct(self):
        self.base()
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.46).shift(RIGHT * 2.6)
        checks = VGroup()
        self.play(FadeIn(H), run_time=1.0)
        for r in range(4):
            plus = Text("+Δ", font_size=22, color=AMBER).next_to(H.cell_rows[r], RIGHT, buff=0.25)
            checks.add(plus)
            self.play(FadeIn(plus, shift=LEFT * 0.1), H.cell_rows[r].animate.set_fill(AMBER, 0.32), run_time=0.5)
        self.guard(H, checks)
        pace_to(self, self.cue_duration)


class Cue11(_Act41):
    headline = "Attention mixes across positions"
    cue_duration = 5.0
    active_stage = 'attn'

    def construct(self):
        self.base()
        rows = VGroup(*[vector_strip(6, color=C_EMBED, cell=0.3) for _ in range(4)])
        rows.arrange(DOWN, buff=0.4).shift(RIGHT * 2.6)
        cross = VGroup(
            CurvedArrow(rows[0].get_left(), rows[3].get_left(), color=AMBER, angle=PI / 2),
            CurvedArrow(rows[3].get_right(), rows[1].get_right(), color=AMBER, angle=-PI / 2),
            CurvedArrow(rows[2].get_left(), rows[0].get_left(), color=AMBER, angle=PI / 2),
        )
        self.play(FadeIn(rows), run_time=1.0)
        self.play(Create(cross), run_time=1.6)
        self.guard(rows, cross)
        pace_to(self, self.cue_duration)


# ─── Phase C: residual add (cues 12–13) ──────────────────────────────────────
class Cue12(_Act41):
    headline = "Add the update onto the old row"
    cue_duration = 5.0
    active_stage = 'add1'

    def construct(self):
        self.base()
        old = vector_strip(6, color=C_EMBED, cell=0.32).shift(RIGHT * 0.4 + UP * 0.1)
        old_l = Text("old row", font_size=20, color=ACCENT).next_to(old, DOWN, buff=0.2)
        plus = Text("+", font_size=38, color=C_RESID).next_to(old, RIGHT, buff=0.3)
        delta = vector_strip(6, color=AMBER, cell=0.32).next_to(plus, RIGHT, buff=0.3)
        delta_l = Text("attention Δ", font_size=20, color=AMBER).next_to(delta, DOWN, buff=0.2)
        eq = Text("=", font_size=38, color=INK).next_to(delta, RIGHT, buff=0.3)
        new = vector_strip(6, color=EMERALD, cell=0.32).next_to(eq, RIGHT, buff=0.3)
        new_l = Text("new row", font_size=20, color=EMERALD).next_to(new, DOWN, buff=0.2)
        grp = VGroup(old, old_l, plus, delta, delta_l, eq, new, new_l)
        if grp.width > 9.0:
            grp.scale(9.0 / grp.width)
        grp.move_to(RIGHT * 1.4)
        self.play(FadeIn(VGroup(old, old_l)), run_time=0.8)
        self.play(FadeIn(VGroup(plus, delta, delta_l)), run_time=0.9)
        self.play(FadeIn(VGroup(eq, new, new_l)), run_time=0.9)
        self.play(Indicate(new, color=EMERALD, scale_factor=1.08), run_time=0.7)
        self.guard(grp)
        pace_to(self, self.cue_duration)


class Cue13(_Act41):
    headline = "The residual path preserves the previous signal"
    cue_duration = 5.0
    active_stage = 'spine'

    def construct(self):
        self.base()
        spine = Line(LEFT * 0.5, RIGHT * 5.5, color=C_RESID, stroke_width=7).shift(UP * 0.6)
        spine_l = Text("residual highway", font_size=LABEL_SIZE, color=C_RESID).next_to(spine, UP, buff=0.2)
        sub = RoundedRectangle(width=2.2, height=0.9, corner_radius=0.12, stroke_color=AMBER,
                               stroke_width=2.2, fill_color=AMBER, fill_opacity=0.12).shift(RIGHT * 2.4 + DOWN * 1.0)
        sub_t = Text("sublayer Δ", font_size=20, color=INK).move_to(sub.get_center())
        merge = Arrow(sub.get_top(), spine.get_center() + RIGHT * 1.9, buff=0.1, color=AMBER, stroke_width=3)
        self.play(Create(spine), Write(spine_l), run_time=1.2)
        self.play(FadeIn(VGroup(sub, sub_t)), GrowArrow(merge), run_time=1.2)
        self.play(Indicate(spine, color=C_RESID, scale_factor=1.02), run_time=0.9)
        self.guard(spine, spine_l, sub, merge)
        pace_to(self, self.cue_duration)


# ─── Phase D: normalize + highway (cues 14–17) ───────────────────────────────
class Cue14(_Act41):
    headline = "LayerNorm rescales each row"
    cue_duration = 5.0
    active_stage = 'ln2'

    def construct(self):
        self.base()
        # before: uneven bars; after: evened bars
        before = VGroup(*[Rectangle(width=0.4, height=h, stroke_width=0, fill_color=ACCENT, fill_opacity=0.6)
                          for h in [0.4, 1.8, 0.9, 2.4, 0.6, 1.2]])
        for i, b in enumerate(before):
            b.move_to([i * 0.55, b.height / 2, 0])
        before.move_to(RIGHT * 1.4 + DOWN * 0.2)
        bl = Text("before", font_size=18, color=INK_MUTED).next_to(before, DOWN, buff=0.3)
        after = VGroup(*[Rectangle(width=0.4, height=h, stroke_width=0, fill_color=VIOLET, fill_opacity=0.7)
                         for h in [1.1, 1.4, 1.2, 1.5, 1.0, 1.3]])
        for i, b in enumerate(after):
            b.move_to([i * 0.55, b.height / 2, 0])
        after.move_to(RIGHT * 4.6 + DOWN * 0.2)
        al = Text("after (normalized)", font_size=18, color=VIOLET).next_to(after, DOWN, buff=0.3)
        arr = Arrow(before.get_right(), after.get_left(), buff=0.3, color=VIOLET, stroke_width=3)
        self.play(FadeIn(before), Write(bl), run_time=1.0)
        self.play(GrowArrow(arr), FadeIn(after), Write(al), run_time=1.4)
        self.guard(before, after, bl, al)
        pace_to(self, self.cue_duration)


class Cue15(_Act41):
    headline = "Stabilize the scale before the next sublayer"
    cue_duration = 5.0
    active_stage = 'ln2'

    def construct(self):
        self.base()
        row = vector_strip(6, color=VIOLET, cell=0.44).shift(RIGHT * 2.6 + UP * 0.2)
        eq = MathTex(r"\mu = 0,\ \ \sigma = 1", font_size=theme.FORMULA_SIZE_SMALL, color=VIOLET).next_to(row, DOWN, buff=0.5)
        self.play(FadeIn(row), run_time=1.0)
        self.play(Write(eq), run_time=1.2)
        self.play(Indicate(eq, color=VIOLET, scale_factor=1.1), run_time=0.9)
        self.guard(row, eq)
        pace_to(self, self.cue_duration)


class Cue16(_Act41):
    headline = "Do not lose the highway"
    cue_duration = 5.0
    active_stage = 'spine'

    def construct(self):
        self.base()
        spine = Line(LEFT * 0.4, RIGHT * 5.4, color=C_RESID, stroke_width=8).shift(UP * 0.3)
        keep = Text("signal carried straight through", font_size=LABEL_SIZE, color=C_RESID).next_to(spine, UP, buff=0.3)
        dots = VGroup(*[Dot(spine.point_from_proportion(p), color=INK, radius=0.06) for p in [0.1, 0.4, 0.7, 0.95]])
        self.play(Create(spine), Write(keep), run_time=1.4)
        self.play(FadeIn(dots), run_time=0.8)
        self.play(Indicate(spine, color=C_RESID, scale_factor=1.02), run_time=0.9)
        self.guard(spine, keep, dots)
        pace_to(self, self.cue_duration)


class Cue17(_Act41):
    headline = "Rows stay comparable to each other"
    cue_duration = 5.0
    active_stage = 'ln2'

    def construct(self):
        self.base()
        rows = VGroup(*[vector_strip(6, color=VIOLET, cell=0.32) for _ in range(4)])
        rows.arrange(DOWN, buff=0.34).shift(RIGHT * 2.6)
        guide = VGroup(
            Line(rows.get_left() + UP * 0.02, rows.get_left() + DOWN * 0.02, color=INK_SUBTLE),
        )
        bracket = Line(rows[0].get_left() + LEFT * 0.3 + UP * 0.1,
                       rows[3].get_left() + LEFT * 0.3 + DOWN * 0.1, color=EMERALD, stroke_width=3)
        cmp = Text("same scale", font_size=20, color=EMERALD).next_to(bracket, LEFT, buff=0.2)
        self.play(FadeIn(rows), run_time=1.0)
        self.play(Create(bracket), Write(cmp), run_time=1.2)
        self.guard(rows, bracket, cmp)
        pace_to(self, self.cue_duration)


# ─── Phase E: MLP (cues 18–24) ───────────────────────────────────────────────
class Cue18(_Act41):
    headline = "The MLP creates a feature update"
    cue_duration = 5.0
    active_stage = 'mlp'

    def construct(self):
        self.base()
        row = vector_strip(6, color=C_EMBED, cell=0.34).shift(RIGHT * 0.4)
        mlp = RoundedRectangle(width=1.7, height=1.0, corner_radius=0.12, stroke_color=C_MLP,
                               stroke_width=2.4, fill_color=C_MLP, fill_opacity=0.14).shift(RIGHT * 2.7)
        mlp_t = Text("MLP", font_size=24, color=INK).move_to(mlp.get_center())
        out = vector_strip(6, color=C_MLP, cell=0.34).shift(RIGHT * 4.8)
        a1 = Arrow(row.get_right(), mlp.get_left(), buff=0.2, color=INK_SUBTLE, stroke_width=3)
        a2 = Arrow(mlp.get_right(), out.get_left(), buff=0.2, color=C_MLP, stroke_width=3)
        self.play(FadeIn(row), run_time=0.8)
        self.play(GrowArrow(a1), FadeIn(VGroup(mlp, mlp_t)), run_time=1.0)
        self.play(GrowArrow(a2), FadeIn(out), run_time=1.0)
        self.guard(row, mlp, out)
        pace_to(self, self.cue_duration)


class Cue19(_Act41):
    headline = "The MLP does not mix positions"
    cue_duration = 5.0
    active_stage = 'mlp'

    def construct(self):
        self.base()
        rows = VGroup(*[vector_strip(6, color=C_MLP, cell=0.3) for _ in range(4)])
        rows.arrange(DOWN, buff=0.4).shift(RIGHT * 2.4)
        bars = VGroup()
        for r in rows:
            b = Line(r.get_left() + LEFT * 0.3 + UP * 0.02, r.get_left() + LEFT * 0.3 + DOWN * 0.02)
        # draw independence: a small "no-cross" mark between rows
        marks = VGroup(*[Text("↓", font_size=22, color=INK_SUBTLE).next_to(r, LEFT, buff=0.35) for r in rows])
        note = Text("each row processed alone", font_size=LABEL_SIZE, color=INK_MUTED).next_to(rows, DOWN, buff=0.35)
        self.play(FadeIn(rows), run_time=1.0)
        self.play(FadeIn(marks), run_time=0.8)
        self.play(FadeIn(note), run_time=0.8)
        self.guard(rows, marks, note)
        pace_to(self, self.cue_duration)


class Cue20(_Act41):
    headline = "Attention already supplied the context"
    cue_duration = 5.0
    active_stage = 'mlp'

    def construct(self):
        self.base()
        attn = RoundedRectangle(width=2.4, height=0.9, corner_radius=0.12, stroke_color=AMBER,
                                stroke_width=2.2, fill_color=AMBER, fill_opacity=0.12).shift(RIGHT * 1.2 + UP * 0.8)
        attn_t = Text("Attention (done)", font_size=20, color=INK).move_to(attn.get_center())
        mlp = RoundedRectangle(width=2.4, height=0.9, corner_radius=0.12, stroke_color=C_MLP,
                               stroke_width=2.4, fill_color=C_MLP, fill_opacity=0.16).shift(RIGHT * 3.8 + DOWN * 0.8)
        mlp_t = Text("MLP (now)", font_size=20, color=INK).move_to(mlp.get_center())
        arr = Arrow(attn.get_bottom(), mlp.get_top(), buff=0.15, color=INK_SUBTLE, stroke_width=3)
        note = Text("context in the rows already", font_size=20, color=INK_MUTED).next_to(mlp, DOWN, buff=0.3)
        self.play(FadeIn(VGroup(attn, attn_t)), run_time=0.9)
        self.play(GrowArrow(arr), FadeIn(VGroup(mlp, mlp_t)), run_time=1.1)
        self.play(FadeIn(note), Indicate(mlp, color=C_MLP, scale_factor=1.05), run_time=0.9)
        self.guard(attn, mlp, note)
        pace_to(self, self.cue_duration)


class Cue21(_Act41):
    headline = "Work on one row at a time"
    cue_duration = 5.0
    active_stage = 'mlp'

    def construct(self):
        self.base()
        rows = VGroup(*[vector_strip(6, color=C_EMBED, cell=0.3) for _ in range(4)])
        rows.arrange(DOWN, buff=0.36).shift(RIGHT * 2.4)
        self.play(FadeIn(rows), run_time=1.0)
        # a focus box that hops from row to row (one row processed at a time)
        box = SurroundingRectangle(rows[0], color=C_MLP, buff=0.12)
        self.play(Create(box), run_time=0.5)
        for r in rows[1:]:
            self.play(box.animate.move_to(r.get_center()), run_time=0.45)
        self.guard(rows, box)
        pace_to(self, self.cue_duration)


class Cue22(_Act41):
    headline = "Expand to more hidden features"
    cue_duration = 5.0
    active_stage = 'mlp'

    def construct(self):
        self.base()
        small = vector_strip(6, color=C_EMBED, cell=0.4).shift(LEFT * 0.6)
        small_l = Text("D", font_size=24, color=ACCENT).next_to(small, DOWN, buff=0.25)
        wide = vector_strip(14, color=C_MLP, cell=0.32).shift(RIGHT * 3.4)
        wide_l = Text("4D (wider)", font_size=24, color=C_MLP).next_to(wide, DOWN, buff=0.25)
        arr = Arrow(small.get_right(), wide.get_left(), buff=0.3, color=C_MLP, stroke_width=3)
        self.play(FadeIn(small), Write(small_l), run_time=1.0)
        self.play(GrowArrow(arr), FadeIn(wide), Write(wide_l), run_time=1.4)
        self.guard(small, wide, small_l, wide_l)
        pace_to(self, self.cue_duration)


class Cue23(_Act41):
    headline = "Apply the activation gate"
    cue_duration = 5.0
    active_stage = 'mlp'

    def construct(self):
        self.base()
        ax = Axes(x_range=[-3, 3, 1], y_range=[-1, 3, 1], x_length=5.0, y_length=3.0,
                  axis_config={"stroke_color": INK_SUBTLE, "stroke_width": 2, "include_ticks": False}).shift(RIGHT * 2.6)
        # GELU-ish curve
        gelu = ax.plot(lambda x: x * 0.5 * (1 + (x / (abs(x) + 1))), color=C_MLP, x_range=[-3, 3])
        lbl = Text("GELU", font_size=LABEL_SIZE, color=C_MLP).next_to(ax, UP, buff=0.2)
        self.play(Create(ax), run_time=1.0)
        self.play(Create(gelu), Write(lbl), run_time=1.6)
        self.guard(ax, gelu, lbl)
        pace_to(self, self.cue_duration)


class Cue24(_Act41):
    headline = "Compress back down to D"
    cue_duration = 5.0
    active_stage = 'mlp'

    def construct(self):
        self.base()
        wide = vector_strip(14, color=C_MLP, cell=0.3).shift(LEFT * 0.4)
        wide_l = Text("4D", font_size=24, color=C_MLP).next_to(wide, DOWN, buff=0.25)
        small = vector_strip(6, color=C_EMBED, cell=0.4).shift(RIGHT * 4.2)
        small_l = Text("D (back to shape)", font_size=22, color=ACCENT).next_to(small, DOWN, buff=0.25)
        arr = Arrow(wide.get_right(), small.get_left(), buff=0.3, color=ACCENT, stroke_width=3)
        self.play(FadeIn(wide), Write(wide_l), run_time=1.0)
        self.play(GrowArrow(arr), FadeIn(small), Write(small_l), run_time=1.4)
        self.guard(wide, small, wide_l, small_l)
        pace_to(self, self.cue_duration)


# ─── Phase F: second add + norm + output shape (cues 25–27) ──────────────────
class Cue25(_Act41):
    headline = "Add the MLP update back onto the row"
    cue_duration = 5.0
    active_stage = 'add2'

    def construct(self):
        self.base()
        old = vector_strip(6, color=C_EMBED, cell=0.32).shift(RIGHT * 0.6)
        plus = Text("+", font_size=36, color=C_RESID).next_to(old, RIGHT, buff=0.3)
        delta = vector_strip(6, color=C_MLP, cell=0.32).next_to(plus, RIGHT, buff=0.3)
        eq = Text("=", font_size=36, color=INK).next_to(delta, RIGHT, buff=0.3)
        new = vector_strip(6, color=EMERALD, cell=0.32).next_to(eq, RIGHT, buff=0.3)
        dl = Text("MLP Δ", font_size=18, color=C_MLP).next_to(delta, DOWN, buff=0.2)
        grp = VGroup(old, plus, delta, eq, new, dl)
        if grp.width > 9.0:
            grp.scale(9.0 / grp.width)
        grp.move_to(RIGHT * 1.4)
        self.play(FadeIn(VGroup(old, plus, delta, dl)), run_time=1.0)
        self.play(FadeIn(VGroup(eq, new)), run_time=1.0)
        self.play(Indicate(new, color=EMERALD, scale_factor=1.08), run_time=0.8)
        self.guard(grp)
        pace_to(self, self.cue_duration)


class Cue26(_Act41):
    headline = "Normalize once again"
    cue_duration = 5.0
    active_stage = 'add2'

    def construct(self):
        self.base()
        row = vector_strip(6, color=EMERALD, cell=0.42).shift(RIGHT * 2.6 + UP * 0.1)
        eq = MathTex(r"\text{LayerNorm}(\cdot)", font_size=theme.FORMULA_SIZE_SMALL, color=VIOLET).next_to(row, DOWN, buff=0.5)
        self.play(FadeIn(row), run_time=1.0)
        self.play(Write(eq), run_time=1.2)
        self.play(row.animate.set_color(VIOLET), run_time=0.9)
        self.guard(row, eq)
        pace_to(self, self.cue_duration)


class Cue27(_Act41):
    headline = "Return the same L by D shape"
    cue_duration = 5.0
    active_stage = 'out'

    def construct(self):
        self.base()
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.5).shift(RIGHT * 2.4)
        shape = MathTex(r"L \times D", font_size=theme.FORMULA_SIZE_SMALL, color=EMERALD).next_to(H, DOWN, buff=0.4)
        self.play(FadeIn(H), run_time=1.0)
        self.play(Write(shape), run_time=1.0)
        self.play(Indicate(shape, color=EMERALD, scale_factor=1.12), run_time=0.9)
        self.guard(H, shape)
        pace_to(self, self.cue_duration)


# ─── Phase G: outcome → next block → output head → logits (cues 28–32) ───────
class Cue28(_Act41):
    headline = "The values are richer than the input"
    cue_duration = 5.0
    active_stage = 'out'

    def construct(self):
        self.base()
        before = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.34).shift(RIGHT * 0.6)
        bl = Text("input", font_size=18, color=INK_MUTED).next_to(before, DOWN, buff=0.25)
        after = hidden_matrix(rows=4, cols=6, color=EMERALD, cell=0.34).shift(RIGHT * 4.4)
        for r in after.cell_rows:
            for c in r:
                c.set_fill(EMERALD, 0.5)
        al = Text("output (context-rich)", font_size=18, color=EMERALD).next_to(after, DOWN, buff=0.25)
        arr = Arrow(before.get_right(), after.get_left(), buff=0.3, color=EMERALD, stroke_width=3)
        self.play(FadeIn(before), Write(bl), run_time=1.0)
        self.play(GrowArrow(arr), FadeIn(after), Write(al), run_time=1.4)
        self.guard(before, after, bl, al)
        pace_to(self, self.cue_duration)


class Cue29(_Act41):
    headline = "The next block can repeat the same recipe"
    cue_duration = 5.0
    active_stage = 'out'

    def construct(self):
        self.base()
        blocks = VGroup()
        prev = None
        for i in range(3):
            b = RoundedRectangle(width=1.5, height=1.4, corner_radius=0.12, stroke_color=ACCENT,
                                 stroke_width=2.2, fill_color=ACCENT, fill_opacity=0.12)
            t = Text(f"block {i+1}", font_size=18, color=INK).move_to(b.get_center())
            g = VGroup(b, t)
            if prev is not None:
                g.next_to(prev, RIGHT, buff=0.9)
            blocks.add(g)
            prev = g
        blocks.move_to(RIGHT * 2.6)
        arrows = VGroup(*[Arrow(blocks[i].get_right(), blocks[i + 1].get_left(), buff=0.1,
                               color=EMERALD, stroke_width=3) for i in range(2)])
        shp = MathTex(r"L \times D", font_size=26, color=EMERALD).next_to(blocks, UP, buff=0.35)
        self.play(FadeIn(blocks[0]), run_time=0.7)
        self.play(GrowArrow(arrows[0]), FadeIn(blocks[1]), run_time=0.8)
        self.play(GrowArrow(arrows[1]), FadeIn(blocks[2]), Write(shp), run_time=1.0)
        self.guard(blocks, arrows, shp)
        pace_to(self, self.cue_duration)


class Cue30(_Act41):
    headline = "The final row can feed the output head"
    cue_duration = 5.0
    active_stage = 'out'

    def construct(self):
        self.base()
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.42).shift(RIGHT * 1.6)
        head = RoundedRectangle(width=1.9, height=0.9, corner_radius=0.12, stroke_color=C_LOGIT,
                                stroke_width=2.4, fill_color=C_LOGIT, fill_opacity=0.14).shift(RIGHT * 5.0)
        head_t = Text("output head", font_size=18, color=INK).move_to(head.get_center())
        self.play(FadeIn(H), run_time=1.0)
        self.play(H.cell_rows[3].animate.set_fill(EMERALD, 0.6).set_stroke(EMERALD, 3), run_time=0.9)
        arr = Arrow(H.cell_rows[3].get_right(), head.get_left(), buff=0.25, color=EMERALD, stroke_width=3)
        self.play(GrowArrow(arr), FadeIn(VGroup(head, head_t)), run_time=1.1)
        self.guard(H, head, arr)
        pace_to(self, self.cue_duration)


class Cue31(_Act41):
    headline = "Vocabulary scores come later"
    cue_duration = 5.0
    active_stage = 'out'

    def construct(self):
        self.base()
        head = RoundedRectangle(width=2.0, height=0.9, corner_radius=0.12, stroke_color=C_LOGIT,
                                stroke_width=2.4, fill_color=C_LOGIT, fill_opacity=0.14).shift(LEFT * 0.2 + UP * 0.8)
        head_t = Text("output head", font_size=18, color=INK).move_to(head.get_center())
        logits = logit_bars([("cat", 3.1), ("dog", 1.4), ("mat", 2.3), ("sat", 0.7), ("the", 1.9)],
                            max_h=1.7, bar_w=0.6, gap=0.3).scale(0.8).shift(RIGHT * 3.0 + DOWN * 0.6)
        logits_l = Text("next-token logits", font_size=20, color=C_LOGIT).next_to(logits, DOWN, buff=0.2)
        arr = Arrow(head.get_bottom(), logits.get_top(), buff=0.2, color=C_LOGIT, stroke_width=3)
        self.play(FadeIn(VGroup(head, head_t)), run_time=0.8)
        self.play(GrowArrow(arr), FadeIn(logits), Write(logits_l), run_time=1.4)
        self.play(Indicate(logits.bars[logits.top_index], color=C_LOGIT, scale_factor=1.1), run_time=0.8)
        self.guard(head, logits, logits_l)
        pace_to(self, self.cue_duration)


class Cue32(_Act41):
    headline = "Training supervises those logits"
    cue_duration = 2.0
    active_stage = 'out'

    def construct(self):
        self.base()
        logits = logit_bars([("cat", 3.1), ("dog", 1.4), ("mat", 2.3), ("sat", 0.7)],
                            max_h=1.6, bar_w=0.6, gap=0.3).scale(0.8).shift(RIGHT * 2.6 + UP * 0.2)
        target = Text('target: "cat"', font_size=LABEL_SIZE, color=EMERALD).next_to(logits, DOWN, buff=0.4)
        self.play(FadeIn(logits), run_time=0.7)
        self.play(Write(target), run_time=0.6)
        self.guard(logits, target)
        pace_to(self, self.cue_duration)
