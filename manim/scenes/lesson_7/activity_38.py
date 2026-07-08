"""
Lesson 7 — Orientation (activity 38): "Inside the Transformer — the route"
(1009.896s / ~16.8min long-form overview audio).

7 Cue<NN> scenes, one per orientation_visual cue (segment_38.json), each ~144s
long, walking the standard spiral-lesson-map route for the transformer lesson.
The visuals reuse the shared transformer idiom library (manim/transformer.py) so
the orientation speaks the same visual vocabulary the three lesson_part segments
(acts 39/40/41) establish — token IDs, the embedding table, the L×D hidden
matrix, the residual/attention/MLP block pipeline, and next-token logits:

  Cue00 0-145      Locate the lesson — the big map (Subject → Lesson → Next) and
                   the one-line pipeline: token IDs → embeddings → blocks →
                   logits → next token, plus the four study angles.
  Cue01 145-288    Workshop metaphor — the block as an annotation workshop:
                   receive H, gather context (attention), refine features (MLP),
                   add each back, pass the same-shape H on.
  Cue02 288-433    Follow one concrete object — one token ("saw"): ID → embedding
                   row → through the block (picks up context) → feeds logits.
  Cue03 433-577    Expose what changes and why — H is refined every block, shape
                   stays L×D, the residual stream preserves the signal.
  Cue04 577-722    Connect to code and tests — the forward pass in pseudocode and
                   the shape assert that guards it.
  Cue05 722-865    Separate nearby ideas — token vs embedding, logits vs
                   probabilities, attention vs MLP, position vs feature.
  Cue06 865-1009.9 Return to the route — recap the pipeline, one takeaway, hand
                   off a practice-ready mental model.

Each ~144s cue stages reveals across its window via wait_until(scene, t); pace_to
fills the small remainder. Whatever the narration discusses is the lit element.
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
    FORMULA_SIZE_SMALL,
)
from pacing import pace_to, elapsed
import transformer
from transformer import (
    chip,
    fit_label,
    token_row,
    id_boxes,
    embedding_table,
    hidden_matrix,
    block_pipeline,
    logit_bars,
    ranking_list,
    vector_strip,
    C_TOKEN,
    C_ID,
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
    Text,
    MathTex,
    Arrow,
    Line,
    DashedLine,
    SurroundingRectangle,
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


def pipeline_map(y=0.0, scale=1.0):
    """The one-line lesson pipeline: IDs → embeddings → blocks → logits → next."""
    stages = [
        ("token\nIDs", C_ID),
        ("embeddings", C_EMBED),
        ("transformer\nblocks", C_ATTN),
        ("logits", C_LOGIT),
        ("next\ntoken", EMERALD),
    ]
    chips = VGroup()
    for name, col in stages:
        chips.add(chip(name, col, w=2.15, h=1.05, fs=20))
    chips.arrange(RIGHT, buff=0.55)
    arrows = VGroup()
    for i in range(len(chips) - 1):
        arrows.add(Arrow(chips[i].get_right(), chips[i + 1].get_left(), buff=0.12,
                         color=INK_SUBTLE, stroke_width=3, max_tip_length_to_length_ratio=0.25))
    grp = VGroup(chips, arrows)
    if scale != 1.0:
        grp.scale(scale)
    grp.move_to([0, y, 0])
    grp.chips = chips
    return grp


# ─── Cue00 : the big map — locate the lesson ─────────────────────────────────
class Cue00(AvoScene):
    headline = "Locate the lesson before details"
    cue_duration = 144.752

    def construct(self):
        subj = chip("Deep Learning\n& LLMs", ACCENT, w=3.6, h=1.35, fs=22).shift(LEFT * 4.7 + UP * 2.0)
        subj_l = Text("Subject", font_size=BODY_SIZE, color=INK_MUTED).next_to(subj, UP, buff=0.16)
        lesson = chip("Inside the\nTransformer", AMBER, w=3.6, h=1.35, fs=22).shift(UP * 2.0)
        lesson_l = Text("Lesson", font_size=BODY_SIZE, color=INK_MUTED).next_to(lesson, UP, buff=0.16)
        nxt = chip("read a forward\npass fluently", EMERALD, w=3.6, h=1.35, fs=22).shift(RIGHT * 4.7 + UP * 2.0)
        nxt_l = Text("Next", font_size=BODY_SIZE, color=INK_MUTED).next_to(nxt, UP, buff=0.16)
        a1 = Arrow(subj.get_right(), lesson.get_left(), buff=0.15, color=INK_MUTED, stroke_width=4)
        a2 = Arrow(lesson.get_right(), nxt.get_left(), buff=0.15, color=INK_MUTED, stroke_width=4)

        pmap = pipeline_map(y=-0.2, scale=0.95)

        angles = ["token → ID walkthrough", "embedding table", "attention & MLP", "logits & ranking"]
        acols = [C_ID, C_EMBED, C_ATTN, C_LOGIT]
        angle_chips = VGroup()
        for name, col in zip(angles, acols):
            angle_chips.add(chip(name, col, w=3.0, h=0.9, fs=19))
        angle_chips.arrange(RIGHT, buff=0.35).to_edge(DOWN, buff=1.15)
        angles_l = Text("four angles on the same pipeline", font_size=BODY_SIZE, color=INK_MUTED).next_to(angle_chips, UP, buff=0.3)

        purpose = fit_label(
            "goal: follow numbers from token IDs to next-token logits — no magic, just shaped tensors",
            13.0, LABEL_SIZE, INK,
        ).to_edge(DOWN, buff=0.5)

        # beat 0-16 : subject
        self.play(FadeIn(subj), FadeIn(subj_l), run_time=2.0)
        wait_until(self, 16)
        # beat 16-34 : the lesson node
        self.play(GrowArrow(a1), FadeIn(lesson), FadeIn(lesson_l), run_time=2.0)
        self.play(Indicate(lesson, color=AMBER, scale_factor=1.06), run_time=1.4)
        wait_until(self, 36)
        # beat 36-52 : where it leads
        self.play(GrowArrow(a2), FadeIn(nxt), FadeIn(nxt_l), run_time=2.0)
        wait_until(self, 58)
        # beat 58-92 : the pipeline map, one chip at a time
        self.play(FadeIn(pmap.chips[0]), run_time=1.0)
        for i in range(1, 5):
            wait_until(self, 60 + i * 8)
            self.play(GrowArrow(pmap[1][i - 1]), FadeIn(pmap.chips[i]), run_time=1.0)
        self.play(Indicate(pmap.chips, color=ACCENT, scale_factor=1.02), run_time=1.2)
        wait_until(self, 100)
        # beat 100-128 : four study angles
        self.play(FadeIn(angles_l), run_time=1.2)
        for i, ch in enumerate(angle_chips):
            wait_until(self, 102 + i * 6)
            self.play(FadeIn(ch, shift=UP * 0.1), run_time=0.9)
        wait_until(self, 130)
        # beat 130+ : the purpose line
        self.play(FadeOut(angles_l), FadeIn(purpose), run_time=1.4)
        self.play(Indicate(purpose, color=ACCENT, scale_factor=1.03), run_time=1.4)
        self.guard(subj, lesson, nxt, pmap, angle_chips, purpose)
        pace_to(self, self.cue_duration)


# ─── Cue01 : workshop metaphor ───────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Translate the idea into a workshop metaphor"
    cue_duration = 143.629

    def construct(self):
        obj = chip("a page of numbers\n(the hidden state H)", VIOLET, w=5.2, h=1.2, fs=22).shift(UP * 1.55)
        obj_l = Text("the object on the bench", font_size=BODY_SIZE, color=INK_MUTED).next_to(obj, UP, buff=0.18)

        recv = chip("Receive\nthe page H", ACCENT, w=3.1, h=1.2, fs=20).shift(LEFT * 4.8 + UP * 0.1)
        gather = chip("Gather context\n(attention)", AMBER, w=3.1, h=1.2, fs=20).shift(LEFT * 1.6 + UP * 0.1)
        refine = chip("Refine features\n(MLP)", EMERALD, w=3.1, h=1.2, fs=20).shift(RIGHT * 1.6 + UP * 0.1)
        pas = chip("Pass the page on\n(same shape)", VIOLET, w=3.1, h=1.2, fs=20).shift(RIGHT * 4.8 + UP * 0.1)
        b1 = Arrow(recv.get_right(), gather.get_left(), buff=0.1, color=INK_SUBTLE, stroke_width=3.5)
        b2 = Arrow(gather.get_right(), refine.get_left(), buff=0.1, color=INK_SUBTLE, stroke_width=3.5)
        b3 = Arrow(refine.get_right(), pas.get_left(), buff=0.1, color=INK_SUBTLE, stroke_width=3.5)

        board = fit_label(
            "each worker adds notes, never rewrites the page — the residual stream keeps the original, "
            "so many blocks can annotate the same page in turn",
            13.2, BODY_SIZE, INK_MUTED,
        ).to_edge(DOWN, buff=1.7)

        f = MathTex(r"H \;\leftarrow\; H + \text{block}(H)", font_size=FORMULA_SIZE_SMALL, color=INK).to_edge(DOWN, buff=0.6)
        f[0][2].set_color(VIOLET)

        self.play(FadeIn(obj), FadeIn(obj_l), run_time=2.0)
        self.play(Indicate(obj, color=VIOLET, scale_factor=1.05), run_time=1.4)
        wait_until(self, 22)
        self.play(FadeIn(recv), run_time=1.4)
        wait_until(self, 40)
        self.play(GrowArrow(b1), FadeIn(gather), run_time=1.6)
        self.play(Indicate(gather, color=AMBER, scale_factor=1.05), run_time=1.2)
        wait_until(self, 62)
        self.play(GrowArrow(b2), FadeIn(refine), run_time=1.6)
        self.play(Indicate(refine, color=EMERALD, scale_factor=1.05), run_time=1.2)
        wait_until(self, 84)
        self.play(GrowArrow(b3), FadeIn(pas), run_time=1.6)
        wait_until(self, 104)
        self.play(FadeIn(board), run_time=1.8)
        wait_until(self, 126)
        self.play(FadeOut(board), FadeIn(f), run_time=1.4)
        self.play(Indicate(f, color=VIOLET, scale_factor=1.05), run_time=1.4)
        self.guard(obj, recv, gather, refine, pas, f)
        pace_to(self, self.cue_duration)


# ─── Cue02 : follow one concrete object ──────────────────────────────────────
class Cue02(AvoScene):
    headline = "Follow one concrete object — a single token"
    cue_duration = 144.752

    def construct(self):
        tok = chip('"saw"', C_TOKEN, w=1.9, h=0.9, fs=26).shift(LEFT * 5.2 + UP * 1.9)
        tok_l = Text("one token", font_size=BODY_SIZE, color=INK_MUTED).next_to(tok, UP, buff=0.16)
        idb = id_boxes([44], color=C_ID, w=1.0, h=0.8).shift(LEFT * 2.6 + UP * 1.9)
        id_l = Text("ID 44", font_size=BODY_SIZE, color=C_ID).next_to(idb, UP, buff=0.16)
        row = vector_strip(6, color=C_EMBED, cell=0.38).shift(RIGHT * 0.9 + UP * 1.9)
        row_l = Text("embedding row", font_size=BODY_SIZE, color=C_EMBED).next_to(row, UP, buff=0.2)
        a1 = Arrow(tok.get_right(), idb.get_left(), buff=0.2, color=INK_SUBTLE, stroke_width=3)
        a2 = Arrow(idb.get_right(), row.get_left(), buff=0.2, color=INK_SUBTLE, stroke_width=3)

        block = block_pipeline(scale=0.42).shift(LEFT * 3.4 + DOWN * 1.6)
        block_l = Text("through the block", font_size=BODY_SIZE, color=INK_MUTED).next_to(block, UP, buff=0.25)
        ctx = vector_strip(6, color=AMBER, cell=0.38).shift(RIGHT * 1.6 + DOWN * 1.6)
        ctx_l = Text("now context-rich", font_size=BODY_SIZE, color=AMBER).next_to(ctx, UP, buff=0.2)
        logits = logit_bars([("cat", 3.1), ("sat", 1.2), ("dog", 0.5), ("the", 2.1)],
                            max_h=1.5, bar_w=0.5, gap=0.28).scale(0.7).shift(RIGHT * 4.9 + DOWN * 1.7)
        logits_l = Text("feeds logits", font_size=BODY_SIZE, color=C_LOGIT).next_to(logits, UP, buff=0.2)
        a3 = Arrow(row.get_bottom(), block.get_top(), buff=0.2, color=INK_SUBTLE, stroke_width=3)
        a4 = Arrow(block.get_right(), ctx.get_left(), buff=0.2, color=AMBER, stroke_width=3)
        a5 = Arrow(ctx.get_right(), logits.get_left(), buff=0.25, color=C_LOGIT, stroke_width=3)

        self.play(FadeIn(tok), FadeIn(tok_l), run_time=1.8)
        wait_until(self, 22)
        self.play(GrowArrow(a1), FadeIn(idb), FadeIn(id_l), run_time=1.6)
        wait_until(self, 44)
        self.play(GrowArrow(a2), FadeIn(row), FadeIn(row_l), run_time=1.6)
        wait_until(self, 66)
        self.play(GrowArrow(a3), FadeIn(block), FadeIn(block_l), run_time=1.8)
        wait_until(self, 92)
        self.play(GrowArrow(a4), FadeIn(ctx), FadeIn(ctx_l), run_time=1.6)
        self.play(Indicate(ctx, color=AMBER, scale_factor=1.06), run_time=1.2)
        wait_until(self, 118)
        self.play(GrowArrow(a5), FadeIn(logits), FadeIn(logits_l), run_time=1.8)
        highlight_bar = logits.bars[logits.top_index]
        self.play(Indicate(highlight_bar, color=C_LOGIT, scale_factor=1.1), run_time=1.2)
        self.guard(tok, idb, row, block, ctx, logits)
        pace_to(self, self.cue_duration)


# ─── Cue03 : expose what changes and why ─────────────────────────────────────
class Cue03(AvoScene):
    headline = "Expose what changes and why"
    cue_duration = 143.630

    def construct(self):
        H0 = hidden_matrix(rows=4, cols=6, color=C_EMBED, cell=0.32).shift(LEFT * 4.6 + UP * 0.3)
        H0_l = Text("H (start)", font_size=LABEL_SIZE, color=INK_MUTED).next_to(H0, UP, buff=0.28)
        H1 = hidden_matrix(rows=4, cols=6, color=AMBER, cell=0.32).shift(UP * 0.3)
        for r in H1.cell_rows:
            for c in r:
                c.set_fill(AMBER, 0.3)
        H1_l = Text("H (after 1 block)", font_size=LABEL_SIZE, color=AMBER).next_to(H1, UP, buff=0.28)
        H2 = hidden_matrix(rows=4, cols=6, color=EMERALD, cell=0.32).shift(RIGHT * 4.6 + UP * 0.3)
        for r in H2.cell_rows:
            for c in r:
                c.set_fill(EMERALD, 0.45)
        H2_l = Text("H (deeper)", font_size=LABEL_SIZE, color=EMERALD).next_to(H2, UP, buff=0.28)
        a1 = Arrow(H0.get_right(), H1.get_left(), buff=0.25, color=INK_SUBTLE, stroke_width=3)
        a2 = Arrow(H1.get_right(), H2.get_left(), buff=0.25, color=INK_SUBTLE, stroke_width=3)

        invariant = MathTex(r"\text{shape } L \times D \text{ never changes}", font_size=FORMULA_SIZE_SMALL, color=INK)
        invariant.shift(DOWN * 1.6)
        why = fit_label(
            "values get richer; the shape is invariant so blocks stack — the residual stream carries the thread forward",
            13.2, BODY_SIZE, INK_MUTED,
        ).to_edge(DOWN, buff=0.6)

        self.play(FadeIn(H0), FadeIn(H0_l), run_time=1.8)
        wait_until(self, 28)
        self.play(GrowArrow(a1), FadeIn(H1), FadeIn(H1_l), run_time=1.8)
        wait_until(self, 56)
        self.play(GrowArrow(a2), FadeIn(H2), FadeIn(H2_l), run_time=1.8)
        wait_until(self, 86)
        self.play(Write(invariant), run_time=1.6)
        self.play(Indicate(invariant, color=ACCENT, scale_factor=1.05), run_time=1.2)
        wait_until(self, 118)
        self.play(FadeIn(why), run_time=1.6)
        self.guard(H0, H1, H2, invariant, why)
        pace_to(self, self.cue_duration)


# ─── Cue04 : connect to code and tests ───────────────────────────────────────
class Cue04(AvoScene):
    headline = "Connect to code and tests"
    cue_duration = 144.752

    def construct(self):
        lines = [
            "h = embed[token_ids]          # (L, D)",
            "for block in blocks:",
            "    h = h + attn(norm(h))     # mix positions",
            "    h = h + mlp(norm(h))      # refine features",
            "logits = h @ W_out.T          # (L, V)",
        ]
        colors = [C_EMBED, INK_MUTED, C_ATTN, C_MLP, C_LOGIT]
        code = VGroup()
        for ln, col in zip(lines, colors):
            code.add(Text(ln, font="monospace", font_size=26, color=col))
        code.arrange(DOWN, aligned_edge=LEFT, buff=0.5).shift(UP * 0.5)
        # indent the two loop-body lines to show they run inside the for-loop
        code[2].shift(RIGHT * 0.7)
        code[3].shift(RIGHT * 0.7)

        assert_line = Text("assert h.shape == (L, D)", font="monospace", font_size=28, color=EMERALD)
        assert_line.next_to(code, DOWN, buff=0.9)

        self.play(FadeIn(code[0]), run_time=1.6)
        for i in range(1, len(code)):
            wait_until(self, 12 + i * 16)
            self.play(FadeIn(code[i], shift=RIGHT * 0.15), run_time=1.4)
            self.play(Indicate(code[i], color=colors[i], scale_factor=1.04), run_time=1.0)
        wait_until(self, 108)
        self.play(Write(assert_line), run_time=1.6)
        self.play(Indicate(assert_line, color=EMERALD, scale_factor=1.06), run_time=1.2)
        self.guard(code, assert_line)
        pace_to(self, self.cue_duration)


# ─── Cue05 : separate nearby ideas ───────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Separate nearby ideas"
    cue_duration = 143.629

    def construct(self):
        pairs = [
            ("token ID", "an integer index", "embedding", "its learned vector", C_ID, C_EMBED),
            ("logits", "raw scores (any real)", "probabilities", "after softmax, sum to 1", C_LOGIT, EMERALD),
            ("attention", "mixes across positions", "MLP", "refines each row alone", C_ATTN, C_MLP),
            ("position", "which row (token)", "feature", "which column (dim)", VIOLET, ACCENT),
        ]
        rows = VGroup()
        for a_name, a_desc, b_name, b_desc, ca, cb in pairs:
            left = VGroup(
                Text(a_name, font_size=24, color=ca, weight="BOLD"),
                Text(a_desc, font_size=20, color=INK_MUTED),
            ).arrange(RIGHT, buff=0.25)
            vs = Text("vs", font_size=20, color=INK_SUBTLE)
            right = VGroup(
                Text(b_name, font_size=24, color=cb, weight="BOLD"),
                Text(b_desc, font_size=20, color=INK_MUTED),
            ).arrange(RIGHT, buff=0.25)
            row = VGroup(left, vs, right).arrange(RIGHT, buff=0.5)
            rows.add(row)
        rows.arrange(DOWN, buff=0.7, aligned_edge=LEFT).move_to(ORIGIN)
        for r in rows:
            if r.width > 12.8:
                r.scale(12.8 / r.width)

        for i, r in enumerate(rows):
            wait_until(self, 4 + i * 30)
            self.play(FadeIn(r, shift=UP * 0.12), run_time=1.6)
            self.play(Indicate(r, color=AMBER, scale_factor=1.02), run_time=1.2)
        self.guard(rows)
        pace_to(self, self.cue_duration)


# ─── Cue06 : return to the route and prepare practice ────────────────────────
class Cue06(AvoScene):
    headline = "Return to the route and prepare practice"
    cue_duration = 144.752

    def construct(self):
        pmap = pipeline_map(y=1.7, scale=1.0)
        recap = fit_label(
            "IDs address rows · embeddings become H · blocks refine H at fixed L×D · the head scores logits · pick the next token",
            13.2, BODY_SIZE, INK_MUTED,
        ).shift(UP * 0.1)

        takeaway = chip("a transformer block is: add attention, add MLP — same shape in, same shape out",
                        EMERALD, w=11.5, h=1.15, fs=22).shift(DOWN * 1.4)

        practice = fit_label(
            "practice next: trace [12, 44, 91, 44] to a logit row and name every shape",
            12.5, LABEL_SIZE, INK,
        ).to_edge(DOWN, buff=0.6)

        self.play(FadeIn(pmap.chips[0]), run_time=1.0)
        for i in range(1, 5):
            wait_until(self, 6 + i * 6)
            self.play(GrowArrow(pmap[1][i - 1]), FadeIn(pmap.chips[i]), run_time=0.9)
        wait_until(self, 44)
        self.play(FadeIn(recap), run_time=1.6)
        wait_until(self, 78)
        self.play(FadeIn(takeaway), run_time=1.6)
        self.play(Indicate(takeaway, color=EMERALD, scale_factor=1.03), run_time=1.4)
        wait_until(self, 116)
        self.play(FadeIn(practice), run_time=1.6)
        self.play(Indicate(practice, color=ACCENT, scale_factor=1.03), run_time=1.2)
        self.guard(pmap, recap, takeaway, practice)
        pace_to(self, self.cue_duration)
