"""
Lesson 15 — Orientation (activity 84): "What Happens Inside One Transformer Block"

18 Cue<NN> scenes, one per orientation_visual cue (segment_84.json). This is the
18.6-minute top-of-lesson overview, so several cues are long (up to 143s). Long
cues stage their reveals across the window (interior waits) so the frame is not
frozen, then pace_to fills the remainder to hit the exact cue duration.

Visual system reuses the lesson's building blocks:
  - hidden-state matrix H (tokens × d_model), ACCENT
  - the residual stream as a VIOLET spine that sublayers add deltas onto
  - Q/K/V projections (ACCENT / AMBER / EMERALD), scores, softmax, value mixing
  - the MLP expand→gate→compress, attention heads, LayerNorm read path
  - next-token logits the refined rows feed

Whatever the narration discusses is the "lit" color.
"""

import theme
from theme import (
    AvoScene,
    ACCENT,
    AMBER,
    EMERALD,
    VIOLET,
    ROSE,
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
    Rectangle,
    Text,
    MathTex,
    Arrow,
    Line,
    Circle,
    FadeIn,
    FadeOut,
    Write,
    GrowArrow,
    Create,
    Indicate,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
)


# ─── shared visual helpers ───────────────────────────────────────────────────
def row_vec(n=6, color=ACCENT, cell=0.4, gap=0.07, opacity=0.18):
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


def hidden_matrix(rows=4, cols=6, color=ACCENT, cell=0.34, gap=0.06):
    grid = VGroup()
    for r in range(rows):
        for c in range(cols):
            sq = RoundedRectangle(
                width=cell, height=cell, corner_radius=0.05,
                stroke_color=color, stroke_width=1.5,
                fill_color=color, fill_opacity=0.18,
            )
            sq.move_to([c * (cell + gap), -r * (cell + gap), 0])
            grid.add(sq)
    grid.move_to(ORIGIN)
    return grid


def stack(rows=4, cols=6, color=AMBER, cell=0.3, gap=0.06, opacity=0.16):
    g = VGroup()
    for r in range(rows):
        row = row_vec(cols, color=color, cell=cell, gap=gap, opacity=opacity)
        row.move_to([0, -r * (cell + gap), 0])
        g.add(row)
    g.move_to(ORIGIN)
    return g


def block_box(label, color=ACCENT, w=2.4, h=1.4, fs=22):
    box = RoundedRectangle(width=w, height=h, corner_radius=0.14,
                           stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.12)
    t = Text(label, font_size=fs, color=INK).move_to(box.get_center())
    return VGroup(box, t)


def note_text(s, color=INK_MUTED, size=LABEL_SIZE):
    """A note Text clamped to the stage width so it never breaks the safe area."""
    return fit_to_stage(Text(s, font_size=size, color=color), width_frac=0.95)


def labeled(mob, text, size=LABEL_SIZE, color=INK, buff=0.25, edge=DOWN):
    lbl = Text(text, font_size=size, color=color)
    lbl.next_to(mob, edge, buff=buff)
    return VGroup(mob, lbl), lbl


def logit_bars(color=ACCENT):
    heights = [0.5, 1.4, 0.8, 1.9, 0.6, 1.1]
    g = VGroup()
    for i, hh in enumerate(heights):
        bar = Rectangle(width=0.32, height=hh, stroke_width=0,
                        fill_color=color, fill_opacity=0.6)
        bar.move_to([i * 0.42, hh / 2, 0])
        g.add(bar)
    g.move_to(ORIGIN)
    return g


class Cue00(AvoScene):
    headline = "Hidden-state matrix enters the block"
    cue_duration = 76.0

    def construct(self):
        H = fit_to_stage(hidden_matrix(color=ACCENT), height_frac=0.5)
        H.shift(LEFT * 3.4)
        Hg, hlbl = labeled(H, "one row per token", color=INK_MUTED)
        blk = block_box("Transformer\nBlock", ACCENT, w=2.8, h=2.0)
        blk.shift(RIGHT * 2.6)
        into = Arrow(H.get_right(), blk.get_left(), buff=0.3, color=ACCENT, stroke_width=5)
        note = note_text("row count preserved — what each row represents changes").to_edge(DOWN, buff=0.8)
        self.play(FadeIn(H), Write(hlbl), run_time=1.8)
        self.wait(2.0)
        self.play(GrowArrow(into), FadeIn(blk), run_time=1.6)
        self.wait(2.0)
        self.play(FadeIn(note), run_time=1.0)
        highlight(self, H, color=ACCENT, run_time=1.0)
        self.guard(Hg, blk, into, note)
        pace_to(self, self.cue_duration)


class Cue01(AvoScene):
    headline = "Rows become evidence for next-token logits"
    cue_duration = 36.0

    def construct(self):
        row = row_vec(6, color=ACCENT, cell=0.36).shift(LEFT * 3.6)
        row_l = Text("hidden row", font_size=BODY_SIZE, color=ACCENT).next_to(row, DOWN, buff=0.3)
        head = block_box("output head", ACCENT, w=2.2, h=1.0, fs=20)
        bars = fit_to_stage(logit_bars(EMERALD), height_frac=0.4).shift(RIGHT * 3.8)
        bars_l = Text("next-token logits", font_size=BODY_SIZE, color=EMERALD).next_to(bars, DOWN, buff=0.3)
        a1 = Arrow(row.get_right(), head.get_left(), buff=0.25, color=INK_MUTED, stroke_width=3)
        a2 = Arrow(head.get_right(), bars.get_left(), buff=0.25, color=INK_MUTED, stroke_width=3)
        self.play(FadeIn(row), FadeIn(row_l), run_time=1.4)
        self.play(GrowArrow(a1), FadeIn(head), run_time=1.2)
        self.play(GrowArrow(a2), FadeIn(bars), FadeIn(bars_l), run_time=1.4)
        highlight(self, bars, color=EMERALD, run_time=0.9)
        self.guard(row, row_l, head, bars, bars_l, a1, a2)
        pace_to(self, self.cue_duration)


class Cue02(AvoScene):
    headline = "The block is specific edits to the same table"
    cue_duration = 8.0

    def construct(self):
        H = fit_to_stage(hidden_matrix(color=ACCENT), height_frac=0.4)
        edits = VGroup(
            Text("Attention", font_size=22, color=AMBER),
            Text("MLP", font_size=22, color=EMERALD),
            Text("Residuals", font_size=22, color=VIOLET),
            Text("LayerNorm", font_size=22, color=ACCENT),
        ).arrange(RIGHT, buff=0.7).next_to(H, DOWN, buff=0.6)
        self.play(FadeIn(H), run_time=0.9)
        self.play(FadeIn(edits), run_time=1.0)
        self.guard(H, edits)
        pace_to(self, self.cue_duration)


class Cue03(AvoScene):
    headline = "Queries and keys create attention scores"
    cue_duration = 55.0

    def construct(self):
        q = row_vec(6, color=ACCENT, cell=0.32).shift(UP * 1.8 + LEFT * 0.4)
        ql = Text("Q — what it looks for", font_size=BODY_SIZE, color=ACCENT).next_to(q, LEFT, buff=0.4)
        K = stack(rows=4, color=AMBER, cell=0.28).shift(DOWN * 0.9 + LEFT * 0.4)
        kl = Text("K — what it matches", font_size=BODY_SIZE, color=AMBER).next_to(K, LEFT, buff=0.4)
        dots = VGroup(*[
            Arrow(q.get_bottom(), K[r].get_left() + LEFT * 0.03, buff=0.12, color=INK_MUTED, stroke_width=2)
            for r in range(4)
        ])
        f = MathTex(r"q \cdot k_i \rightarrow \text{score}", font_size=FORMULA_SIZE_SMALL, color=INK).to_edge(RIGHT, buff=1.0)
        self.play(FadeIn(q), FadeIn(ql), run_time=1.4)
        self.wait(1.5)
        self.play(FadeIn(K), FadeIn(kl), run_time=1.4)
        self.wait(1.5)
        self.play(*[GrowArrow(a) for a in dots], Write(f), run_time=1.6)
        highlight(self, f, color=AMBER, run_time=0.9)
        self.guard(q, ql, K, kl, f)
        pace_to(self, self.cue_duration)


class Cue04(AvoScene):
    headline = "Vector alignment is the mechanism"
    cue_duration = 25.0

    def construct(self):
        origin = LEFT * 1.5
        v1 = Arrow(origin, origin + RIGHT * 2.6 + UP * 1.2, buff=0, color=ACCENT, stroke_width=5)
        v2 = Arrow(origin, origin + RIGHT * 2.9 + UP * 0.7, buff=0, color=AMBER, stroke_width=5)
        l1 = Text("q", font_size=BODY_SIZE, color=ACCENT).next_to(v1.get_end(), UP, buff=0.15)
        l2 = Text("k", font_size=BODY_SIZE, color=AMBER).next_to(v2.get_end(), RIGHT, buff=0.15)
        note = note_text("labels are analogy — the mechanism is learned vector alignment").to_edge(DOWN, buff=0.9)
        self.play(GrowArrow(v1), FadeIn(l1), run_time=1.2)
        self.play(GrowArrow(v2), FadeIn(l2), run_time=1.2)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(v1, v2, l1, l2, note)
        pace_to(self, self.cue_duration)


class Cue05(AvoScene):
    headline = "Scaling keeps softmax from becoming too sharp"
    cue_duration = 36.0

    def construct(self):
        f = fit_to_stage(
            MathTex(r"\operatorname{softmax}\!\left(\frac{QK^T}{\sqrt{d_k}}\right)",
                    font_size=FORMULA_SIZE, color=INK),
            width_frac=0.7,
        )
        f.shift(UP * 0.6)
        note = note_text("divide by √dₖ — keep magnitudes calm so choices stay graded").to_edge(DOWN, buff=0.9)
        self.play(Write(f), run_time=2.0)
        self.wait(1.5)
        highlight(self, f, color=AMBER, run_time=1.0)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(f, note)
        pace_to(self, self.cue_duration)


class Cue06(AvoScene):
    headline = "Weights choose value content"
    cue_duration = 37.0

    def construct(self):
        weights = row_vec(4, color=ACCENT, cell=0.5).shift(UP * 1.6)
        w_vals = ["0.62", "0.05", "0.26", "0.07"]
        w_nums = VGroup(*[Text(w_vals[i], font_size=18, color=INK).move_to(weights[i].get_center()) for i in range(4)])
        wl = Text("softmax weights", font_size=BODY_SIZE, color=ACCENT).next_to(weights, UP, buff=0.3)
        V = stack(rows=4, color=EMERALD, cell=0.3).shift(DOWN * 1.1 + LEFT * 2.2)
        vl = Text("V rows", font_size=BODY_SIZE, color=EMERALD).next_to(V, LEFT, buff=0.35)
        out = row_vec(6, color=ACCENT, cell=0.32).shift(DOWN * 1.1 + RIGHT * 3.0)
        ol = Text("context vector", font_size=BODY_SIZE, color=ACCENT).next_to(out, DOWN, buff=0.3)
        pull = Arrow(V.get_right(), out.get_left(), buff=0.3, color=EMERALD, stroke_width=4)
        self.play(FadeIn(weights), FadeIn(w_nums), FadeIn(wl), run_time=1.4)
        self.wait(1.5)
        self.play(FadeIn(V), FadeIn(vl), run_time=1.4)
        self.play(GrowArrow(pull), FadeIn(out), FadeIn(ol), run_time=1.4)
        highlight(self, out, color=ACCENT, run_time=0.9)
        self.guard(weights, wl, V, vl, out, ol, pull)
        pace_to(self, self.cue_duration)


class Cue07(AvoScene):
    headline = "Q asks, K matches, V carries"
    cue_duration = 28.0

    def construct(self):
        q = block_box("Q asks", ACCENT, w=2.4, h=1.0, fs=20).shift(LEFT * 4.2)
        k = block_box("K matches", AMBER, w=2.4, h=1.0, fs=20)
        v = block_box("V carries", EMERALD, w=2.4, h=1.0, fs=20).shift(RIGHT * 4.2)
        note = note_text("all three are learned projections — weights route, V carries content").to_edge(DOWN, buff=0.9)
        self.play(FadeIn(q), run_time=0.9)
        self.play(FadeIn(k), run_time=0.9)
        self.play(FadeIn(v), run_time=0.9)
        self.play(FadeIn(note), run_time=1.0)
        highlight(self, v, color=EMERALD, run_time=0.9)
        self.guard(q, k, v, note)
        pace_to(self, self.cue_duration)


class Cue08(AvoScene):
    headline = "Attention updates the stream without erasing it"
    cue_duration = 66.0

    def construct(self):
        f = fit_to_stage(
            MathTex(r"H_{\text{after-attn}} = ", r"H_{\text{input}}", r" + \Delta_{\text{attention}}",
                    font_size=FORMULA_SIZE_SMALL, color=INK),
            width_frac=0.9,
        )
        f.shift(UP * 1.2)
        f[1].set_color(VIOLET)
        f[2].set_color(AMBER)
        spine = Arrow(LEFT * 5, RIGHT * 5, buff=0.1, color=VIOLET, stroke_width=6).shift(DOWN * 0.6)
        spine_l = Text("residual stream (kept)", font_size=LABEL_SIZE, color=VIOLET).next_to(spine, DOWN, buff=0.3)
        delta = Arrow(DOWN * 2.4, DOWN * 0.9, buff=0.1, color=AMBER, stroke_width=4).shift(RIGHT * 0.5)
        delta_l = Text("attention delta added in", font_size=LABEL_SIZE, color=AMBER).next_to(delta, DOWN, buff=0.2)
        self.play(Write(f), run_time=2.0)
        self.wait(2.0)
        self.play(GrowArrow(spine), FadeIn(spine_l), run_time=1.6)
        self.wait(1.5)
        self.play(GrowArrow(delta), FadeIn(delta_l), run_time=1.4)
        highlight(self, f[2], color=AMBER, run_time=0.9)
        self.guard(f, spine, spine_l, delta, delta_l)
        pace_to(self, self.cue_duration)


class Cue09(AvoScene):
    headline = "The residual stream is a shared notebook"
    cue_duration = 36.0

    def construct(self):
        spine = Line(LEFT * 5, RIGHT * 5, color=VIOLET, stroke_width=6)
        spine_l = Text("residual stream", font_size=LABEL_SIZE, color=VIOLET).next_to(spine, UP, buff=0.3)
        notes = VGroup()
        for i, x in enumerate([-3.0, -0.5, 2.0, 4.0]):
            n = RoundedRectangle(width=1.3, height=0.8, corner_radius=0.1,
                                 stroke_color=AMBER if i % 2 else EMERALD, stroke_width=2,
                                 fill_color=AMBER if i % 2 else EMERALD, fill_opacity=0.14)
            n.next_to([x, spine.get_center()[1], 0], DOWN, buff=0.5)
            notes.add(n)
        label = note_text("keeps the old signal, each block writes useful updates").to_edge(DOWN, buff=0.8)
        self.play(Create(spine), FadeIn(spine_l), run_time=1.4)
        self.wait(1.0)
        self.play(FadeIn(notes), run_time=1.4)
        self.play(FadeIn(label), run_time=1.0)
        self.guard(spine, spine_l, notes, label)
        pace_to(self, self.cue_duration)


class Cue10(AvoScene):
    headline = "The MLP edits each row independently"
    cue_duration = 34.0

    def construct(self):
        din = row_vec(4, color=ACCENT, cell=0.34).shift(LEFT * 4.6)
        wide = row_vec(9, color=AMBER, cell=0.3)
        dout = row_vec(4, color=EMERALD, cell=0.34).shift(RIGHT * 4.6)
        a1 = Arrow(din.get_right(), wide.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3)
        a2 = Arrow(wide.get_right(), dout.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3)
        l1 = Text("expand", font_size=18, color=AMBER).next_to(a1, UP, buff=0.12)
        l2 = Text("gate • compress", font_size=18, color=EMERALD).next_to(a2, UP, buff=0.12)
        grp = VGroup(din, wide, dout, a1, a2, l1, l2)
        fit_to_stage(grp, width_frac=0.98)
        note = note_text("per-row: expand, gate, compress, add").to_edge(DOWN, buff=0.9)
        self.play(FadeIn(din), run_time=1.0)
        self.play(GrowArrow(a1), FadeIn(l1), FadeIn(wide), run_time=1.4)
        self.play(GrowArrow(a2), FadeIn(l2), FadeIn(dout), run_time=1.4)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(grp, note)
        pace_to(self, self.cue_duration)


class Cue11(AvoScene):
    headline = "Expansion gives the row room for intermediate features"
    cue_duration = 71.0

    def construct(self):
        narrow = row_vec(4, color=ACCENT, cell=0.5).shift(UP * 1.7)
        narrow_l = Text("d_model", font_size=BODY_SIZE, color=ACCENT).next_to(narrow, LEFT, buff=0.4)
        wide = fit_to_stage(row_vec(14, color=AMBER, cell=0.44), width_frac=0.92).shift(DOWN * 0.4)
        wide_l = Text("wide hidden space", font_size=BODY_SIZE, color=AMBER).next_to(wide, DOWN, buff=0.4)
        grow = Arrow(narrow.get_bottom(), wide.get_top(), buff=0.25, color=INK_MUTED, stroke_width=3)
        note = note_text("room to create and gate candidate features").to_edge(DOWN, buff=0.8)
        self.play(FadeIn(narrow), FadeIn(narrow_l), run_time=1.4)
        self.wait(2.0)
        self.play(GrowArrow(grow), run_time=1.2)
        self.play(FadeIn(wide), FadeIn(wide_l), run_time=1.6)
        self.wait(1.5)
        self.play(FadeIn(note), run_time=1.0)
        highlight(self, wide, color=AMBER, run_time=1.0)
        self.guard(narrow, narrow_l, wide, wide_l, grow, note)
        pace_to(self, self.cue_duration)


class Cue12(AvoScene):
    headline = "Better rows make better next-token scores"
    cue_duration = 105.0

    def construct(self):
        blocks = VGroup()
        prev = None
        for i in range(3):
            b = block_box(f"Block {i+1}", ACCENT, w=1.7, h=1.7, fs=20)
            if prev is not None:
                b.next_to(prev, RIGHT, buff=0.7)
            blocks.add(b)
            prev = b
        blocks.move_to(LEFT * 1.4)
        head = block_box("output head", EMERALD, w=2.0, h=1.0, fs=18).next_to(blocks, RIGHT, buff=0.7)
        arrows = VGroup(*[
            Arrow(blocks[i].get_right(), blocks[i + 1].get_left(), buff=0.1, color=INK_MUTED, stroke_width=3)
            for i in range(2)
        ])
        to_head = Arrow(blocks[2].get_right(), head.get_left(), buff=0.15, color=EMERALD, stroke_width=3)
        note = note_text("blocks refine hidden states so the head can score better later").to_edge(DOWN, buff=0.8)
        self.play(FadeIn(blocks[0]), run_time=1.2)
        self.wait(2.0)
        self.play(GrowArrow(arrows[0]), FadeIn(blocks[1]), run_time=1.2)
        self.wait(2.0)
        self.play(GrowArrow(arrows[1]), FadeIn(blocks[2]), run_time=1.2)
        self.wait(2.0)
        self.play(GrowArrow(to_head), FadeIn(head), run_time=1.2)
        self.wait(1.5)
        self.play(FadeIn(note), run_time=1.0)
        highlight(self, head, color=EMERALD, run_time=1.0)
        self.guard(blocks, head, arrows, to_head, note)
        pace_to(self, self.cue_duration)


class Cue13(AvoScene):
    headline = "Multiple heads read the same table in different ways"
    cue_duration = 87.0

    def construct(self):
        H = fit_to_stage(hidden_matrix(color=ACCENT), height_frac=0.4).shift(LEFT * 3.8)
        Hg, hlbl = labeled(H, "one table", color=INK_MUTED)
        heads = VGroup()
        cols = [AMBER, EMERALD, VIOLET]
        for i in range(3):
            hb = block_box(f"head {i+1}", cols[i], w=2.0, h=0.9, fs=18)
            heads.add(hb)
        heads.arrange(DOWN, buff=0.5).shift(RIGHT * 3.0)
        conns = VGroup(*[
            Arrow(H.get_right(), heads[i].get_left(), buff=0.25, color=cols[i], stroke_width=2.5)
            for i in range(3)
        ])
        note = note_text("each head has its own Q, K, V — one reading each").to_edge(DOWN, buff=0.8)
        self.play(FadeIn(H), Write(hlbl), run_time=1.4)
        self.wait(2.0)
        for i in range(3):
            self.play(GrowArrow(conns[i]), FadeIn(heads[i]), run_time=1.1)
            self.wait(1.0)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(Hg, heads, conns, note)
        pace_to(self, self.cue_duration)


class Cue14(AvoScene):
    headline = "LayerNorm creates a stable read path"
    cue_duration = 143.0

    def construct(self):
        spine = Line(LEFT * 5, RIGHT * 5, color=VIOLET, stroke_width=6).shift(UP * 1.3)
        spine_l = Text("residual path (carries the stream)", font_size=LABEL_SIZE, color=VIOLET).next_to(spine, UP, buff=0.25)
        ln = block_box("LayerNorm", ACCENT, w=2.6, h=1.0, fs=22).shift(DOWN * 0.4)
        read = Arrow(spine.get_center(), ln.get_top(), buff=0.15, color=ACCENT, stroke_width=4)
        sub = block_box("sublayer", AMBER, w=2.4, h=1.0, fs=20).shift(DOWN * 2.0)
        into = Arrow(ln.get_bottom(), sub.get_top(), buff=0.15, color=AMBER, stroke_width=4)
        note = note_text("the sublayer reads a normalized view; the stream keeps flowing").to_edge(DOWN, buff=0.7)
        self.play(Create(spine), FadeIn(spine_l), run_time=1.6)
        self.wait(2.5)
        self.play(GrowArrow(read), FadeIn(ln), run_time=1.4)
        self.wait(2.5)
        self.play(GrowArrow(into), FadeIn(sub), run_time=1.4)
        self.wait(2.0)
        self.play(FadeIn(note), run_time=1.0)
        highlight(self, ln, color=ACCENT, run_time=1.0)
        self.guard(spine, spine_l, ln, read, sub, into, note)
        pace_to(self, self.cue_duration)


class Cue15(AvoScene):
    headline = "The corrected chain, in order"
    cue_duration = 92.0

    def construct(self):
        steps = ["projection", "scoring", "weighting", "value mix", "residual add", "MLP update", "logits"]
        cols = [ACCENT, AMBER, AMBER, EMERALD, VIOLET, EMERALD, ACCENT]
        boxes = VGroup()
        for i, (s, c) in enumerate(zip(steps, cols)):
            b = RoundedRectangle(width=1.7, height=0.9, corner_radius=0.1,
                                 stroke_color=c, stroke_width=2.2, fill_color=c, fill_opacity=0.13)
            t = Text(s, font_size=16, color=INK).move_to(b.get_center())
            boxes.add(VGroup(b, t))
        boxes.arrange(RIGHT, buff=0.28)
        fit_to_stage(boxes, width_frac=0.98)
        arrows = VGroup(*[
            Arrow(boxes[i].get_right(), boxes[i + 1].get_left(), buff=0.05, color=INK_MUTED, stroke_width=2)
            for i in range(len(steps) - 1)
        ])
        for i in range(len(steps)):
            self.play(FadeIn(boxes[i]), run_time=0.8)
            if i < len(steps) - 1:
                self.play(GrowArrow(arrows[i]), run_time=0.5)
            self.wait(1.2)
        self.guard(boxes, arrows)
        pace_to(self, self.cue_duration)


class Cue16(AvoScene):
    headline = "Wrong predictions become inspectable"
    cue_duration = 80.0

    def construct(self):
        stages = ["representations", "scores", "weights", "updates", "logits"]
        boxes = VGroup()
        for s in stages:
            b = RoundedRectangle(width=2.2, height=0.9, corner_radius=0.1,
                                 stroke_color=ACCENT, stroke_width=2.2, fill_color=ACCENT, fill_opacity=0.12)
            t = Text(s, font_size=16, color=INK).move_to(b.get_center())
            boxes.add(VGroup(b, t))
        boxes.arrange(RIGHT, buff=0.3)
        fit_to_stage(boxes, width_frac=0.98)
        arrows = VGroup(*[
            Arrow(boxes[i].get_right(), boxes[i + 1].get_left(), buff=0.05, color=INK_MUTED, stroke_width=2)
            for i in range(len(stages) - 1)
        ])
        trace = Text("trace a mistake to any stage", font_size=LABEL_SIZE, color=ROSE).next_to(boxes, DOWN, buff=1.0)
        self.play(FadeIn(boxes), *[GrowArrow(a) for a in arrows], run_time=2.0)
        self.wait(2.0)
        self.play(FadeIn(trace), run_time=1.0)
        for i in range(len(stages)):
            self.play(Indicate(boxes[i], color=ROSE, scale_factor=1.08), run_time=0.7)
            self.wait(0.8)
        self.guard(boxes, arrows, trace)
        pace_to(self, self.cue_duration)


class Cue17(AvoScene):
    headline = "The visual should track the changing object"
    cue_duration = 99.0

    def construct(self):
        objs = VGroup(
            Text("score grids", font_size=BODY_SIZE, color=AMBER),
            Text("value mixing", font_size=BODY_SIZE, color=EMERALD),
            Text("residual adds", font_size=BODY_SIZE, color=VIOLET),
            Text("MLP updates", font_size=BODY_SIZE, color=ACCENT),
        ).arrange(DOWN, buff=0.6)
        fit_to_stage(objs, height_frac=0.75)
        note = note_text("show the real object being discussed, not a static diagram").to_edge(DOWN, buff=0.7)
        for i in range(4):
            self.play(FadeIn(objs[i]), run_time=1.0)
            self.wait(1.5)
        self.play(FadeIn(note), run_time=1.0)
        for i in range(4):
            self.play(Indicate(objs[i], color=objs[i].get_color(), scale_factor=1.1), run_time=0.7)
            self.wait(1.0)
        self.guard(objs, note)
        pace_to(self, self.cue_duration)
