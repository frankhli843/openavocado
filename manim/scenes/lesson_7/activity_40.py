"""
Lesson 7, Part 40 — "From Token IDs to the Hidden-State Matrix"
(154.61s, 6 cues). How the integer ID list becomes the L×D hidden-state matrix:
each ID fetches a learned embedding row; the same ID fetches the same row every
time; identical tokens then diverge via position information; the result is the
table (one row per position, one column per hidden feature) the block refines.

One Cue<NN> scene per storyboard cue (manim/storyboards/lesson_7/segment_40.json).
Reuses manim/transformer.py idioms and the running example [12, 44, 91, 44]
("she saw the saw" — the repeated ID 44 is the pedagogical hook).

Colors: AMBER=ID/address, ACCENT=embedding/hidden H, VIOLET=position info,
EMERALD=logits/result.
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
    INK_SUBTLE,
    LABEL_SIZE,
    BODY_SIZE,
    highlight,
)
from pacing import pace_to, elapsed
import transformer
from transformer import (
    id_boxes,
    embedding_table,
    hidden_matrix,
    vector_strip,
    logit_bars,
    block_pipeline,
    fit_label,
    C_ID,
    C_EMBED,
    C_MLP,
    C_ATTN,
    C_LOGIT,
)
from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Text,
    MathTex,
    Arrow,
    Line,
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
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


IDS = [12, 44, 91, 44]
POS_LABELS = ["pos 0", "pos 1", "pos 2", "pos 3"]


class Cue00(AvoScene):
    headline = "Text is already tokenized — now the handoff into numeric state"
    cue_duration = 18.0

    def construct(self):
        ids = id_boxes(IDS, color=C_ID, w=1.1, h=0.85).shift(UP * 1.6)
        ids_l = Text("token IDs (from the tokenizer)", font_size=LABEL_SIZE, color=INK_MUTED).next_to(ids, UP, buff=0.3)
        handoff = RoundedRectangle(width=4.4, height=0.9, corner_radius=0.14,
                                   stroke_color=ACCENT, stroke_width=2.4, fill_color=ACCENT, fill_opacity=0.1)
        handoff_t = Text("handoff → numeric state", font_size=BODY_SIZE, color=INK).move_to(handoff.get_center())
        handoff_g = VGroup(handoff, handoff_t).shift(DOWN * 0.4)
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.3).shift(DOWN * 2.4)
        a1 = Arrow(ids.get_bottom(), handoff.get_top(), buff=0.15, color=INK_SUBTLE, stroke_width=3)
        a2 = Arrow(handoff.get_bottom(), H.get_top(), buff=0.15, color=ACCENT, stroke_width=3)

        self.play(FadeIn(ids), Write(ids_l), run_time=1.6)
        wait_until(self, 6)
        self.play(GrowArrow(a1), FadeIn(handoff_g), run_time=1.6)
        wait_until(self, 12)
        self.play(GrowArrow(a2), FadeIn(H), run_time=1.8)
        highlight(self, handoff_g, color=ACCENT, box=False, run_time=0.9)
        self.guard(ids, ids_l, handoff_g, H)
        pace_to(self, self.cue_duration)


class Cue01(AvoScene):
    headline = "The ID list selects which embedding rows to fetch"
    cue_duration = 26.0

    def construct(self):
        ids = id_boxes(IDS, color=C_ID, w=0.9, h=0.7, vertical=True).shift(LEFT * 5.0)
        ids_l = Text("token IDs", font_size=LABEL_SIZE, color=AMBER).next_to(ids, UP, buff=0.3)
        table = embedding_table([12, 44, 91, 105, 210], cols=6, cell=0.3).shift(RIGHT * 2.4)
        tbl_l = Text("learned embedding table", font_size=LABEL_SIZE, color=ACCENT).next_to(table, UP, buff=0.32)
        # map: 12→row0, 44→row1, 91→row2, 44→row1
        row_of = {12: 0, 44: 1, 91: 2}
        arrows = VGroup()
        for i, n in enumerate(IDS):
            r = row_of[n]
            arrows.add(Arrow(ids[i].get_right(), table.labels[r].get_left() + LEFT * 0.1, buff=0.18,
                             color=AMBER, stroke_width=2.4, max_tip_length_to_length_ratio=0.05))

        self.play(FadeIn(ids), Write(ids_l), run_time=1.6)
        wait_until(self, 5)
        self.play(FadeIn(table), Write(tbl_l), run_time=1.8)
        wait_until(self, 10)
        for i in range(len(IDS)):
            wait_until(self, 11 + i * 3)
            r = row_of[IDS[i]]
            self.play(GrowArrow(arrows[i]),
                      *[c.animate.set_fill(opacity=0.5) for c in table.rows[r]], run_time=1.1)
        self.guard(ids, table, tbl_l, arrows)
        pace_to(self, self.cue_duration)


class Cue02(AvoScene):
    headline = "The same ID fetches the same row every time"
    cue_duration = 28.0

    def construct(self):
        ids = id_boxes(IDS, color=C_ID, w=0.9, h=0.7, vertical=True).shift(LEFT * 5.0)
        table = embedding_table([12, 44, 91, 105], cols=6, cell=0.32).shift(RIGHT * 2.6)
        tbl_l = Text("embedding table", font_size=LABEL_SIZE, color=ACCENT).next_to(table, UP, buff=0.32)
        # both 44s (index 1 and 3) → row 44 (table index 1)
        a1 = Arrow(ids[1].get_right(), table.labels[1].get_left() + LEFT * 0.1, buff=0.18,
                   color=AMBER, stroke_width=3, max_tip_length_to_length_ratio=0.06)
        a3 = Arrow(ids[3].get_right(), table.labels[1].get_left() + LEFT * 0.1, buff=0.18,
                   color=AMBER, stroke_width=3, max_tip_length_to_length_ratio=0.06)
        note = fit_label("tokenizer + embedding table trained as a matched pair",
                         11.0, BODY_SIZE, INK_MUTED).to_edge(DOWN, buff=0.9)

        self.play(FadeIn(ids), FadeIn(table), Write(tbl_l), run_time=1.8)
        wait_until(self, 6)
        self.play(Indicate(ids[1], color=AMBER, scale_factor=1.12), GrowArrow(a1), run_time=1.4)
        wait_until(self, 12)
        self.play(Indicate(ids[3], color=AMBER, scale_factor=1.12), GrowArrow(a3), run_time=1.4)
        wait_until(self, 17)
        self.play(*[c.animate.set_fill(opacity=0.6) for c in table.rows[1]], run_time=1.0)
        highlight(self, table.rows[1], color=ACCENT, run_time=0.9)
        wait_until(self, 22)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(ids, table, tbl_l, note)
        pace_to(self, self.cue_duration)


class Cue03(AvoScene):
    headline = "Identical tokens diverge via position information"
    cue_duration = 24.0

    def construct(self):
        # same learned row → + position 1 vs + position 3 → two different vectors
        base = vector_strip(6, color=C_EMBED, cell=0.42).shift(UP * 1.9)
        base_l = Text("same learned row (id 44)", font_size=LABEL_SIZE, color=ACCENT).next_to(base, UP, buff=0.28)

        p1 = vector_strip(6, color=VIOLET, cell=0.36).shift(LEFT * 3.2 + DOWN * 1.2)
        p1_l = Text("+ position 1", font_size=LABEL_SIZE, color=VIOLET).next_to(p1, DOWN, buff=0.22)
        p3 = vector_strip(6, color=VIOLET, cell=0.36).shift(RIGHT * 3.2 + DOWN * 1.2)
        p3_l = Text("+ position 3", font_size=LABEL_SIZE, color=VIOLET).next_to(p3, DOWN, buff=0.22)
        a1 = Arrow(base.get_bottom(), p1.get_top(), buff=0.2, color=INK_SUBTLE, stroke_width=3)
        a3 = Arrow(base.get_bottom(), p3.get_top(), buff=0.2, color=INK_SUBTLE, stroke_width=3)
        diff = Text("different slots → different vectors", font_size=BODY_SIZE, color=INK_MUTED).to_edge(DOWN, buff=0.5)

        self.play(FadeIn(base), Write(base_l), run_time=1.6)
        wait_until(self, 6)
        self.play(GrowArrow(a1), FadeIn(p1), Write(p1_l), run_time=1.6)
        wait_until(self, 12)
        self.play(GrowArrow(a3), FadeIn(p3), Write(p3_l), run_time=1.6)
        wait_until(self, 17)
        # tint a couple cells differently to show divergence
        self.play(p1[0].animate.set_fill(VIOLET, 0.6), p1[3].animate.set_fill(VIOLET, 0.6),
                  p3[1].animate.set_fill(VIOLET, 0.6), p3[4].animate.set_fill(VIOLET, 0.6), run_time=1.1)
        self.play(FadeIn(diff), run_time=1.0)
        self.guard(base, p1, p3, diff)
        pace_to(self, self.cue_duration)


class Cue04(AvoScene):
    headline = "The result is a table: one row per position, one column per feature"
    cue_duration = 30.0

    def construct(self):
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.5,
                          row_labels=POS_LABELS).shift(RIGHT * 1.3)
        cols_l = Text("columns = hidden features →", font_size=LABEL_SIZE, color=ACCENT)
        cols_l.next_to(H, UP, buff=0.4)
        rows_l = Text("rows = token positions", font_size=LABEL_SIZE, color=VIOLET)
        rows_l.next_to(H, DOWN, buff=0.45).shift(LEFT * 0.3)
        brace_shape = MathTex(r"H \in \mathbb{R}^{L \times D}", font_size=theme.FORMULA_SIZE_SMALL, color=INK)
        brace_shape.next_to(rows_l, DOWN, buff=0.5)

        self.play(FadeIn(H), run_time=1.8)
        wait_until(self, 7)
        self.play(Write(cols_l), run_time=1.2)
        self.play(*[c.animate.set_fill(opacity=0.42) for c in H.cell_rows[0]], run_time=1.0)
        wait_until(self, 15)
        self.play(Write(rows_l), run_time=1.2)
        self.play(H.cell_rows[1].animate.set_stroke(VIOLET, 3), run_time=1.0)
        wait_until(self, 23)
        self.play(Write(brace_shape), run_time=1.4)
        highlight(self, brace_shape, color=ACCENT, run_time=0.9)
        self.guard(H, rows_l, cols_l, brace_shape)
        pace_to(self, self.cue_duration)


class Cue05(AvoScene):
    headline = "This matrix is what attention and MLP refine before the logits"
    cue_duration = 29.0

    def construct(self):
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.26).shift(LEFT * 5.3 + UP * 0.3)
        H_l = Text("hidden H", font_size=20, color=ACCENT).next_to(H, UP, buff=0.28)
        attn = RoundedRectangle(width=1.9, height=0.8, corner_radius=0.12, stroke_color=C_ATTN,
                                stroke_width=2.4, fill_color=C_ATTN, fill_opacity=0.14)
        attn_t = Text("Attention", font_size=20, color=INK).move_to(attn.get_center())
        mlp = RoundedRectangle(width=1.9, height=0.8, corner_radius=0.12, stroke_color=C_MLP,
                               stroke_width=2.4, fill_color=C_MLP, fill_opacity=0.14)
        mlp_t = Text("MLP", font_size=20, color=INK).move_to(mlp.get_center())
        block = VGroup(VGroup(attn, attn_t), VGroup(mlp, mlp_t)).arrange(DOWN, buff=0.45).shift(LEFT * 2.0 + UP * 0.3)
        head = RoundedRectangle(width=1.75, height=0.8, corner_radius=0.12, stroke_color=C_LOGIT,
                                stroke_width=2.4, fill_color=C_LOGIT, fill_opacity=0.14).shift(RIGHT * 1.3 + UP * 0.3)
        head_t = Text("output\nhead", font_size=18, color=INK).move_to(head.get_center())
        head_g = VGroup(head, head_t)
        logits = logit_bars([("cat", 3.1), ("sat", 1.2), ("dog", 0.4), ("the", 2.0)],
                            max_h=1.5, bar_w=0.5, gap=0.26).scale(0.72).shift(RIGHT * 4.7 + UP * 0.1)
        logits_l = Text("next-token logits", font_size=18, color=C_LOGIT).next_to(logits, DOWN, buff=0.2)

        a1 = Arrow(H.get_right(), block.get_left(), buff=0.2, color=INK_SUBTLE, stroke_width=3)
        a2 = Arrow(block.get_right(), head.get_left(), buff=0.2, color=INK_SUBTLE, stroke_width=3)
        a3 = Arrow(head.get_right(), logits.get_left(), buff=0.2, color=C_LOGIT, stroke_width=3)

        self.play(FadeIn(H), Write(H_l), run_time=1.6)
        wait_until(self, 6)
        self.play(GrowArrow(a1), FadeIn(block), run_time=1.6)
        self.play(Indicate(block[0], color=C_ATTN, scale_factor=1.05),
                  Indicate(block[1], color=C_MLP, scale_factor=1.05), run_time=1.2)
        wait_until(self, 15)
        self.play(GrowArrow(a2), FadeIn(head_g), run_time=1.4)
        wait_until(self, 21)
        self.play(GrowArrow(a3), FadeIn(logits), Write(logits_l), run_time=1.6)
        self.play(Indicate(logits.bars[logits.top_index], color=C_LOGIT, scale_factor=1.12), run_time=0.9)
        self.guard(H, block, head_g, logits, logits_l)
        pace_to(self, self.cue_duration)
