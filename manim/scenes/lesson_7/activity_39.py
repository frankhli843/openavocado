"""
Lesson 7, Part 39 — "From Text to Model-Owned Numeric State"
(48.65s, 4 cues). The handoff intro: human text → tokenizer → integer IDs →
model-owned numeric state the transformer can actually consume.

One Cue<NN> scene per storyboard cue (manim/storyboards/lesson_7/segment_39.json).
Each pins itself to its cue window via pace_to. Reuses the shared transformer
idiom library (manim/transformer.py): token_row, id_boxes, embedding_table,
hidden_matrix. Running example used across acts 39/40: the prompt "she saw the
saw" tokenizes to IDs [12, 44, 91, 44] — the repeated "saw" maps to the same ID
44, which sets up act 40's "same row, different position" story.

Colors: VIOLET=text/token, AMBER=integer ID/address, ACCENT=embedding/hidden H.
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
    token_row,
    id_boxes,
    embedding_table,
    hidden_matrix,
    fit_label,
    C_TOKEN,
    C_ID,
    C_EMBED,
)
from manim import (
    VGroup,
    RoundedRectangle,
    Text,
    MathTex,
    Arrow,
    Line,
    Cross,
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


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


PIECES = ["she", "saw", "the", "saw"]
IDS = [12, 44, 91, 44]


def transformer_box(w=3.2, h=1.3, color=ACCENT):
    box = RoundedRectangle(width=w, height=h, corner_radius=0.16,
                           stroke_color=color, stroke_width=2.6,
                           fill_color=color, fill_opacity=0.12)
    t = Text("Transformer", font_size=BODY_SIZE, color=INK).move_to(box.get_center())
    return VGroup(box, t)


class Cue00(AvoScene):
    headline = "The prompt starts as text — the transformer cannot read text"
    cue_duration = 12.0

    def construct(self):
        prompt = token_row(PIECES, color=C_TOKEN, w=1.6, h=0.8).shift(UP * 1.4)
        plabel = Text('prompt: "she saw the saw"', font_size=LABEL_SIZE, color=INK_MUTED)
        plabel.next_to(prompt, UP, buff=0.3)
        tf = transformer_box().shift(DOWN * 1.5)
        arrow = Arrow(prompt.get_bottom(), tf.get_top(), buff=0.2, color=INK_MUTED, stroke_width=4)
        cross = Cross(tf, stroke_color=theme.ROSE, stroke_width=6).scale(0.6)
        note = Text("no direct text input", font_size=LABEL_SIZE, color=theme.ROSE)
        note.next_to(tf, DOWN, buff=0.3)

        self.play(FadeIn(prompt), Write(plabel), run_time=1.6)
        wait_until(self, 4)
        self.play(GrowArrow(arrow), FadeIn(tf), run_time=1.4)
        wait_until(self, 7)
        self.play(Create(cross), FadeIn(note), run_time=1.2)
        self.play(Indicate(note, color=theme.ROSE, scale_factor=1.06), run_time=1.0)
        self.guard(prompt, plabel, tf, note)
        pace_to(self, self.cue_duration)


class Cue01(AvoScene):
    headline = "The tokenizer maps text pieces to integer IDs"
    cue_duration = 13.0

    def construct(self):
        pieces = token_row(PIECES, color=C_TOKEN, w=1.6, h=0.8).shift(UP * 1.9)
        tok = RoundedRectangle(width=5.2, height=0.9, corner_radius=0.14,
                               stroke_color=AMBER, stroke_width=2.4, fill_color=AMBER, fill_opacity=0.12)
        tok_t = Text("tokenizer vocabulary", font_size=LABEL_SIZE, color=INK).move_to(tok.get_center())
        tok_g = VGroup(tok, tok_t).move_to(ORIGIN)
        ids = id_boxes(IDS, color=C_ID, w=1.1, h=0.8).shift(DOWN * 1.9)
        # align id boxes under their pieces
        for i, idb in enumerate(ids):
            idb.move_to([pieces[i].get_center()[0], ids.get_center()[1], 0])

        a_in = VGroup(*[Arrow(pieces[i].get_bottom(), tok.get_top(), buff=0.12, color=INK_SUBTLE, stroke_width=3)
                        for i in range(len(PIECES))])
        a_out = VGroup(*[Arrow(tok.get_bottom(), ids[i].get_top(), buff=0.12, color=AMBER, stroke_width=3)
                        for i in range(len(IDS))])

        self.play(FadeIn(pieces), run_time=1.2)
        wait_until(self, 3)
        self.play(FadeIn(tok_g), *[GrowArrow(a) for a in a_in], run_time=1.6)
        wait_until(self, 7)
        self.play(*[GrowArrow(a) for a in a_out], FadeIn(ids), run_time=1.8)
        wait_until(self, 10.5)
        # highlight the repeated token → same ID
        highlight(self, ids[1], color=AMBER, run_time=0.7)
        highlight(self, ids[3], color=AMBER, run_time=0.7)
        self.guard(pieces, tok_g, ids)
        pace_to(self, self.cue_duration)


class Cue02(AvoScene):
    headline = "Integers are not meaning — they are addresses into a table"
    cue_duration = 13.0

    def construct(self):
        ids = id_boxes([12, 44, 91], color=C_ID, w=0.9, h=0.7, vertical=True).shift(LEFT * 4.9)
        ids_l = Text("token IDs", font_size=LABEL_SIZE, color=INK_MUTED).next_to(ids, UP, buff=0.3)
        table = embedding_table([12, 44, 91, 105], cols=6, cell=0.34).shift(RIGHT * 2.7)
        tbl_l = Text("embedding table", font_size=LABEL_SIZE, color=ACCENT).next_to(table, UP, buff=0.35)
        # clean arrow from id 44 (row of ids) → embedding row 44 (table index 1);
        # small tip so it lands in the gap left of the cells, clear of the "id 44" label
        arrow = Arrow(ids[1].get_right(), table.labels[1].get_left() + LEFT * 0.1, buff=0.25,
                      color=AMBER, stroke_width=4, max_tip_length_to_length_ratio=0.06)
        addr = Text("address → row", font_size=BODY_SIZE, color=AMBER).next_to(arrow, UP, buff=0.2)

        self.play(FadeIn(ids), Write(ids_l), run_time=1.4)
        wait_until(self, 3.5)
        self.play(FadeIn(table), Write(tbl_l), run_time=1.8)
        wait_until(self, 7)
        self.play(GrowArrow(arrow), FadeIn(addr), run_time=1.4)
        self.play(Indicate(ids[1], color=AMBER, scale_factor=1.1),
                  *[c.animate.set_fill(opacity=0.55) for c in table.rows[1]], run_time=1.2)
        self.guard(ids, ids_l, table, tbl_l, addr)
        pace_to(self, self.cue_duration)


class Cue03(AvoScene):
    headline = "The transformer receives model-owned numeric state, not text"
    cue_duration = 11.0

    def construct(self):
        # left: text+tokenizer stage → right: transformer consuming numeric H
        text_stage = VGroup(
            Text("text + tokenizer", font_size=BODY_SIZE, color=VIOLET),
        )
        boundary = Line(UP * 2.6, DOWN * 2.6, color=INK_SUBTLE, stroke_width=2)
        H = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.32).shift(LEFT * 3.0)
        H_l = Text("numeric state H  (L × D)", font_size=LABEL_SIZE, color=ACCENT).next_to(H, UP, buff=0.35)
        tf = transformer_box().shift(RIGHT * 3.6)
        arrow = Arrow(H.get_right(), tf.get_left(), buff=0.25, color=ACCENT, stroke_width=5)
        pass_l = Text("hands off", font_size=BODY_SIZE, color=INK_MUTED).next_to(arrow, UP, buff=0.12)

        self.play(FadeIn(H), Write(H_l), run_time=1.6)
        wait_until(self, 4)
        self.play(GrowArrow(arrow), FadeIn(pass_l), FadeIn(tf), run_time=1.6)
        wait_until(self, 8)
        highlight(self, tf, color=ACCENT, run_time=0.9)
        self.guard(H, H_l, tf, pass_l)
        pace_to(self, self.cue_duration)

