"""
Lesson 13 — Orientation (activity 76): "Lesson 2: Predicting the Next Token"
(1039.87s / ~17min overview audio).

The overview audio is a spiral: the same eight teaching beats (big map / route /
workshop metaphor / tiny example / mechanism / implementation / confusion /
recap) repeated across five passes. Following the proven, QA-passed orientation
pattern (acts 7/14/38/72), the timeline is SEVEN route cues spread evenly over
the real duration, each re-authored for the actual next-token-prediction
content:

  Cue00 0-148.6      High-level map: hidden state → logits → softmax → token → loop
  Cue01 148.6-297.1  Analogy: the output head is a "score every word" station
  Cue02 297.1-445.7  Tiny example: "The cat" → the last hidden state h predicts next
  Cue03 445.7-594.2  Mechanism: z = W · h, one raw logit per vocabulary word
  Cue04 594.2-742.8  Implementation: softmax → probabilities that sum to 1; P(sat)
  Cue05 742.8-891.3  Misconception: logit≠prob, high-P≠certainty, argmax≠only-choice
  Cue06 891.3-1039.9 Synthesis: sample, append, predict again (the autoregressive loop)

Each ~148.5s cue stages its reveals across the window via wait_until(scene, t)
so the frame keeps changing with the narration; pace_to fills the remainder to
hit the exact cue duration. The lit element is whatever the beat discusses.

Reuses the transformer.py idiom lib (token_row, hidden_matrix, vector_strip,
logit_bars, ranking_list) — the same transformer vocabulary Lesson 7 established,
now telling the *prediction head* story. NOT the Bayes / econ idioms of unrelated
lessons.
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
    FORMULA_SIZE_SMALL,
    LABEL_SIZE,
    BODY_SIZE,
    fit_to_stage,
)
from pacing import pace_to, elapsed
from transformer import (
    token_row,
    hidden_matrix,
    vector_strip,
    logit_bars,
    ranking_list,
    fit_label,
)
from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Text,
    MathTex,
    Arrow,
    CurvedArrow,
    Line,
    SurroundingRectangle,
    FadeIn,
    FadeOut,
    Write,
    GrowArrow,
    Create,
    Transform,
    Indicate,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
)


# ─── local helpers ───────────────────────────────────────────────────────────
def wait_until(scene, t: float) -> None:
    """Wait until scene time reaches `t` seconds (no-op if already past)."""
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def chip(label, color=ACCENT, w=2.2, h=0.95, fs=22):
    box = RoundedRectangle(
        width=w, height=h, corner_radius=0.14,
        stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.12,
    )
    t = fit_label(label, w - 0.3, fs, INK).move_to(box.get_center())
    return VGroup(box, t)


def stage_label(text, color=INK_MUTED, fs=20):
    return Text(text, font_size=fs, color=color)


# The running example, shared across cues.
PROMPT = ["The", "cat"]
VOCAB = ["the", "cat", "sat", "mat", "dog", "ran"]
# raw logits after "The cat" — 'sat' scores highest (the helper colors the max).
LOGITS = [("the", 0.1), ("cat", -0.3), ("sat", 3.1), ("mat", 1.8), ("dog", 0.4), ("ran", 1.2)]
# softmax(LOGITS) → probabilities, ranked (sum ≈ 1.00).
RANKED = [("sat", "0.64"), ("mat", "0.17"), ("ran", "0.10"),
          ("dog", "0.04"), ("the", "0.03"), ("cat", "0.02")]


# ─── Cue00 : the high-level map ──────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Hidden state becomes a next-token guess"
    cue_duration = 148.553

    def construct(self):
        # lead-in: the prompt collapses to one final hidden state h
        toks = token_row(PROMPT, w=1.5, h=0.7, fs=24, gap=0.2).move_to([-5.2, 2.2, 0])
        h = vector_strip(5, color=ACCENT, cell=0.36, gap=0.08).move_to([-1.6, 2.2, 0])
        h_l = stage_label("final hidden state h", ACCENT_LIGHT).next_to(h, RIGHT, buff=0.35)
        a_in = Arrow(toks.get_right(), h.get_left(), buff=0.25, color=INK_MUTED,
                     stroke_width=4, max_tip_length_to_length_ratio=0.22)

        # the prediction route (left → right)
        NODES = [("h", ACCENT), ("output\nhead", VIOLET), ("logits", AMBER),
                 ("softmax", ACCENT_LIGHT), ("probs", EMERALD), ("token", EMERALD)]
        route = VGroup()
        for label, color in NODES:
            route.add(chip(label.replace("\n", " "), color, w=1.8, h=0.9, fs=19))
        route.arrange(RIGHT, buff=0.36).move_to([0, -0.2, 0])
        rarrows = VGroup(*[
            Arrow(route[i].get_right(), route[i + 1].get_left(), buff=0.08,
                  color=INK_SUBTLE, stroke_width=3, max_tip_length_to_length_ratio=0.3)
            for i in range(len(route) - 1)
        ])

        # 0-24: the prompt → the final hidden state
        self.play(FadeIn(toks), run_time=2.0)
        wait_until(self, 12)
        self.play(GrowArrow(a_in), FadeIn(h), FadeIn(h_l), run_time=2.2)
        self.play(Indicate(h, color=ACCENT, scale_factor=1.1), run_time=1.4)
        wait_until(self, 26)
        # 26-40: drop h into the route as the first node
        self.play(FadeIn(route[0]), run_time=1.4)
        wait_until(self, 40)
        # 40-104: reveal each stage of the route with the narration
        for i in range(1, len(route)):
            wait_until(self, 40 + (i - 1) * 12)
            self.play(GrowArrow(rarrows[i - 1]), run_time=0.9)
            self.play(FadeIn(route[i], shift=RIGHT * 0.15), run_time=1.1)
            self.play(Indicate(route[i], color=NODES[i][1], scale_factor=1.08), run_time=0.9)
        wait_until(self, 108)
        # 108-136: append the chosen token and loop back
        loop = CurvedArrow(route[-1].get_bottom(), route[0].get_bottom(),
                           angle=-0.9, color=AMBER, stroke_width=4)
        loop_l = fit_label("append the token, then predict again", 7.0, BODY_SIZE, AMBER)
        loop_l.next_to(loop, DOWN, buff=0.12)
        self.play(Create(loop), FadeIn(loop_l), run_time=2.0)
        self.play(Indicate(route[-1], color=EMERALD, scale_factor=1.12), run_time=1.2)
        wait_until(self, 138)
        # 138+: name the payoff
        note = fit_label("one score per word → a probability → the next token",
                         11.5, LABEL_SIZE, INK).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(route, loop_l, note, h_l)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the workshop analogy ────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "The output head is a scoring station"
    cue_duration = 148.553

    STATIONS = [
        ("Transformer", "mix the context", ACCENT),
        ("Output head", "score every word", AMBER),
        ("Softmax", "scores → probs", ACCENT_LIGHT),
        ("Sample", "pick one token", EMERALD),
    ]

    def construct(self):
        obj = chip("hidden state h", ACCENT_LIGHT, w=1.9, h=0.9, fs=20).move_to([-5.6, 1.5, 0])
        boxes = VGroup()
        receipts = VGroup()
        xs = [-2.9, -0.3, 2.3, 5.0]
        for i, (name, change, color) in enumerate(self.STATIONS):
            b = chip(name, color, w=2.1, h=1.1, fs=20).move_to([xs[i], 1.5, 0])
            r = fit_label(change, 2.1, 18, color).next_to(b, DOWN, buff=0.32)
            boxes.add(b)
            receipts.add(r)
        belt = Line([-6.5, 0.15, 0], [6.1, 0.15, 0], color=INK_SUBTLE, stroke_width=3)
        belt_l = stage_label("the pipeline as a workshop line", INK_MUTED).next_to(belt, DOWN, buff=0.2).set_x(-3.4)

        # 0-14: the object enters
        self.play(FadeIn(obj), run_time=1.8)
        self.play(Create(belt), FadeIn(belt_l), run_time=1.6)
        wait_until(self, 14)
        prev = obj
        # 14-108: each station receives, changes, stamps a receipt (~23s each)
        for i, (name, change, color) in enumerate(self.STATIONS):
            wait_until(self, 14 + i * 23)
            a = Arrow(prev.get_right(), boxes[i].get_left(), buff=0.18, color=INK_MUTED,
                      stroke_width=4, max_tip_length_to_length_ratio=0.25)
            self.play(GrowArrow(a), run_time=1.1)
            self.play(FadeIn(boxes[i], shift=UP * 0.15), run_time=1.3)
            self.play(Indicate(boxes[i], color=color, scale_factor=1.08), run_time=1.0)
            self.play(FadeIn(receipts[i]), run_time=1.1)
            prev = boxes[i]
        wait_until(self, 112)
        # 112-140: the tags name the stations & the evidence
        tags = fit_label("tags: transformers · logits · softmax", 9.5, BODY_SIZE, INK).to_edge(DOWN, buff=0.9)
        tag_note = fit_label("they name the stations, not decorations", 8.0, 20, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(tags), run_time=1.4)
        self.play(FadeIn(tag_note), run_time=1.2)
        wait_until(self, 140)
        # 140+: the receipt = evidence of what changed
        self.play(*[Indicate(r, color=self.STATIONS[i][2], scale_factor=1.1)
                    for i, r in enumerate(receipts)], run_time=1.6)
        self.guard(obj, boxes, receipts, tags, tag_note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the tiny concrete example ───────────────────────────────────────
class Cue02(AvoScene):
    headline = "Follow one concrete prompt"
    cue_duration = 148.553

    def construct(self):
        toks = token_row(PROMPT, w=1.7, h=0.8, fs=28, gap=0.35).move_to([0, 2.4, 0])
        H = hidden_matrix(rows=2, cols=6, color=ACCENT, cell=0.4, gap=0.08,
                          row_labels=["The", "cat"]).move_to([0, 0.4, 0])
        H_title = stage_label("hidden states (one row per position)", INK_MUTED).next_to(H, UP, buff=0.4)
        drops = VGroup(*[
            Arrow(toks[i].get_bottom(), H.cell_rows[i].get_top(), buff=0.15, color=INK_SUBTLE,
                  stroke_width=3, max_tip_length_to_length_ratio=0.22)
            for i in range(len(PROMPT))
        ])

        # 0-20: the prompt and its hidden states
        self.play(FadeIn(toks, shift=DOWN * 0.15), run_time=2.0)
        wait_until(self, 14)
        self.play(*[GrowArrow(d) for d in drops], run_time=1.4)
        self.play(FadeIn(H), FadeIn(H_title), run_time=2.2)
        wait_until(self, 40)
        # 40-84: the LAST position's hidden state is what predicts the next word
        last = H.cell_rows[1]
        hl = SurroundingRectangle(last, color=AMBER, buff=0.1, corner_radius=0.06)
        h_l = fit_label("the last hidden state h — the model's summary of the prompt so far",
                        12.0, BODY_SIZE, AMBER).move_to([0, -1.3, 0])
        self.play(Create(hl), Indicate(last, color=AMBER, scale_factor=1.06), run_time=1.6)
        self.play(FadeIn(h_l), run_time=1.6)
        wait_until(self, 92)
        # 92-136: that single vector is turned into a guess about the next word
        q = chip("what is the next word?", ACCENT, w=5.4, h=0.95, fs=24).move_to([0, -2.5, 0])
        qa = Arrow(last.get_bottom(), q.get_top(), buff=0.2, color=ACCENT,
                   stroke_width=3, max_tip_length_to_length_ratio=0.16)
        self.play(FadeOut(h_l), run_time=0.5)
        self.play(GrowArrow(qa), FadeIn(q), run_time=1.8)
        self.play(Indicate(q, color=ACCENT, scale_factor=1.06), run_time=1.4)
        wait_until(self, 138)
        # 138+: point at one row and say what it does
        note = fit_label("one prompt · one final hidden state · one prediction",
                         11.5, LABEL_SIZE, EMERALD).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(toks, H, q, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the mechanism (logits = W·h) ────────────────────────────────────
class Cue03(AvoScene):
    headline = "Logits are the hidden state, scored per word"
    cue_duration = 148.552

    def construct(self):
        # left: h as a column vector; center: the output-head matrix (one row/word)
        h = vector_strip(6, color=ACCENT, cell=0.34, gap=0.08, horizontal=False).move_to([-5.6, -0.2, 0])
        h_l = stage_label("h", ACCENT_LIGHT, fs=26).next_to(h, UP, buff=0.2)
        W = hidden_matrix(rows=6, cols=6, color=VIOLET, cell=0.34, gap=0.07,
                          row_labels=VOCAB).move_to([-2.6, -0.2, 0])
        W_l = fit_label("output head W — one row per word", 4.6, 20, VIOLET).next_to(W, UP, buff=0.35)

        formula = MathTex(r"z = W\,h", font_size=44, color=INK).move_to([1.9, 2.5, 0])

        # right: the resulting raw logits as bars (sat is tallest → EMERALD)
        bars = logit_bars(LOGITS, max_h=2.2, bar_w=0.6, gap=0.3, fs=20)
        bars.scale(0.95).move_to([3.6, -0.5, 0])
        bars_l = stage_label("raw logits (one score per word)", INK_MUTED).next_to(bars, UP, buff=0.3)

        # 0-24: the two operands
        self.play(FadeIn(h), FadeIn(h_l), run_time=1.8)
        self.play(FadeIn(W), FadeIn(W_l), run_time=2.2)
        wait_until(self, 26)
        # 26-52: the matmul — each row of W dotted with h gives one score
        self.play(Write(formula), run_time=1.8)
        rowscan = SurroundingRectangle(W.cell_rows[0], color=AMBER, buff=0.06, corner_radius=0.05)
        self.play(Create(rowscan), run_time=1.0)
        for r in range(1, 6):
            self.play(Transform(rowscan, SurroundingRectangle(W.cell_rows[r], color=AMBER, buff=0.06, corner_radius=0.05)),
                      run_time=0.7)
        self.play(FadeOut(rowscan), run_time=0.5)
        wait_until(self, 60)
        # 60-104: reveal each word's logit bar
        self.play(FadeIn(bars_l), run_time=1.2)
        for i in range(len(LOGITS)):
            wait_until(self, 60 + i * 6)
            self.play(FadeIn(bars.bars[i], shift=UP * 0.1), FadeIn(bars.labels[i]), run_time=0.9)
        wait_until(self, 108)
        # 108-140: 'sat' scores highest — it wins once normalized
        top = bars.top_index
        hl = SurroundingRectangle(VGroup(bars.bars[top], bars.labels[top]), color=EMERALD,
                                  buff=0.08, corner_radius=0.06)
        self.play(Create(hl), Indicate(bars.bars[top], color=EMERALD, scale_factor=1.1), run_time=1.6)
        win = fit_label("'sat' has the highest score", 4.4, BODY_SIZE, EMERALD).next_to(bars, DOWN, buff=0.55)
        self.play(FadeIn(win), run_time=1.4)
        wait_until(self, 142)
        # 142+: a raw, unbounded score (can be negative)
        note = fit_label("logits are raw, unbounded scores — not yet probabilities",
                         12.0, LABEL_SIZE, INK).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(h, W, formula, bars, win, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : implementation (softmax → probabilities) ────────────────────────
class Cue04(AvoScene):
    headline = "Softmax turns scores into probabilities"
    cue_duration = 148.553

    def construct(self):
        formula = MathTex(r"p_i = \frac{e^{z_i}}{\sum_j e^{z_j}}",
                          font_size=FORMULA_SIZE_SMALL, color=INK).move_to([-4.3, 1.7, 0])
        f_l = fit_label("exponentiate, then normalize", 4.0, 20, INK_MUTED).next_to(formula, DOWN, buff=0.4)

        # raw logits (left) → probabilities ranking (right)
        bars = logit_bars(LOGITS, max_h=1.9, bar_w=0.5, gap=0.26, fs=18)
        bars.scale(0.9).move_to([-4.2, -1.7, 0])
        bars_l = stage_label("raw logits", INK_MUTED).next_to(bars, UP, buff=0.25)

        ranked = ranking_list(RANKED, fs=23, gap=0.34).move_to([3.4, 0.4, 0])
        ranked_l = fit_label("probabilities (sum to 1)", 4.2, BODY_SIZE, EMERALD).next_to(ranked, UP, buff=0.35)

        # 0-24: the softmax formula
        self.play(Write(formula), run_time=2.2)
        self.play(FadeIn(f_l), run_time=1.2)
        wait_until(self, 26)
        # 26-52: the raw scores we start from
        self.play(FadeIn(bars), FadeIn(bars_l), run_time=2.0)
        wait_until(self, 54)
        # 54-104: turn them into a ranked distribution
        arrow = Arrow(bars.get_right(), ranked.get_left(), buff=0.35, color=AMBER,
                      stroke_width=4, max_tip_length_to_length_ratio=0.12)
        arrow_l = stage_label("softmax", AMBER).next_to(arrow, UP, buff=0.12)
        self.play(GrowArrow(arrow), FadeIn(arrow_l), run_time=1.4)
        self.play(FadeIn(ranked_l), run_time=1.0)
        for i in range(len(RANKED)):
            wait_until(self, 58 + i * 7)
            self.play(FadeIn(ranked.rows[i], shift=RIGHT * 0.12), run_time=0.9)
        wait_until(self, 106)
        # 106-134: read off P('sat') — the top probability
        top_hl = SurroundingRectangle(ranked.rows[0], color=EMERALD, buff=0.1, corner_radius=0.06)
        psat = MathTex(r"P(\text{sat}) = 0.64", font_size=FORMULA_SIZE_SMALL, color=EMERALD).next_to(ranked, DOWN, buff=0.35)
        self.play(Create(top_hl), Indicate(ranked.rows[0], color=EMERALD, scale_factor=1.08), run_time=1.6)
        self.play(Write(psat), run_time=1.6)
        wait_until(self, 136)
        # 136+: argmax picks the top; sampling can pick others
        note = fit_label("argmax picks the top token · sampling can pick others",
                         12.0, LABEL_SIZE, INK).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(formula, bars, ranked, psat, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the common confusions ───────────────────────────────────────────
class Cue05(AvoScene):
    headline = "A score is not yet a probability"
    cue_duration = 148.553

    PAIRS = [
        ('a logit', 'a probability', "raw scores become probabilities only after softmax"),
        ('high probability', 'certainty', "P(sat)=0.64 favors 'sat' — it is not a guarantee"),
        ('argmax', 'the only choice', "sampling with temperature can pick other tokens"),
        ('a phase name', 'the operation', "'predict' is a matrix multiply plus softmax inside"),
    ]

    def construct(self):
        rows = VGroup()
        notes = []
        top = 1.5
        dy = 1.0
        for i, (a, b, note) in enumerate(self.PAIRS):
            y = top - i * dy
            ca = chip(a, ACCENT, w=3.2, h=0.7, fs=21).move_to([-3.6, y, 0])
            neq = MathTex(r"\neq", font_size=40, color=ROSE).move_to([-0.4, y, 0])
            cb = chip(b, VIOLET, w=3.2, h=0.7, fs=21).move_to([2.8, y, 0])
            row = VGroup(ca, neq, cb).set_opacity(0.34)
            rows.add(row)
            notes.append(fit_label(note, 12.0, BODY_SIZE, INK).to_edge(DOWN, buff=0.7))

        title = stage_label("four tempting mix-ups", INK_MUTED).to_edge(UP, buff=2.0)
        self.play(FadeIn(rows), FadeIn(title), run_time=2.4)
        wait_until(self, 14)

        prev_rect = None
        prev_note = None
        # 14-128: reveal each contrast one at a time (~28s each)
        for i, (a, b, note) in enumerate(self.PAIRS):
            wait_until(self, 14 + i * 28)
            fade = [FadeOut(prev_rect)] if prev_rect else []
            if prev_note:
                fade.append(FadeOut(prev_note))
            self.play(rows[i].animate.set_opacity(1.0), *fade, run_time=1.2)
            rect = SurroundingRectangle(rows[i], color=AMBER, buff=0.14, corner_radius=0.08)
            self.play(Create(rect), FadeIn(notes[i]), run_time=1.2)
            self.play(Indicate(rows[i][1], color=ROSE, scale_factor=1.2), run_time=1.0)
            prev_rect = rect
            prev_note = notes[i]
        wait_until(self, 130)
        # 130+: all four lit — the mental model that won't break
        clear = [FadeOut(prev_rect)] if prev_rect else []
        if prev_note:
            clear.append(FadeOut(prev_note))
        self.play(*clear, *[r.animate.set_opacity(1.0) for r in rows], run_time=1.4)
        recap = fit_label("name the pair, and the mix-up stops being tempting",
                          12.0, BODY_SIZE, EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(recap), run_time=1.4)
        self.guard(rows, recap, title)
        pace_to(self, self.cue_duration)


# ─── Cue06 : synthesis (the autoregressive loop) ─────────────────────────────
class Cue06(AvoScene):
    headline = "Sample, append, and predict again"
    cue_duration = 148.553

    PERSPECTIVES = [
        ("Audio", "the route / map", ACCENT),
        ("Visual", "makes it visible", AMBER),
        ("Text", "definitions & examples", VIOLET),
        ("Code", "proves you can use it", EMERALD),
        ("Assess", "checks understanding", ROSE),
    ]

    def construct(self):
        # top: the compact prediction map, back for the recap, with a loop-back
        hn = chip("h", ACCENT, w=1.5, h=0.7, fs=22)
        lg = chip("logits", AMBER, w=1.9, h=0.7, fs=22)
        sm = chip("softmax", ACCENT_LIGHT, w=2.0, h=0.7, fs=22)
        tk = chip("token", EMERALD, w=1.7, h=0.7, fs=22)
        pipe = VGroup(hn, lg, sm, tk).arrange(RIGHT, buff=0.9).move_to([0, 2.2, 0])
        parrows = VGroup(*[
            Arrow(pipe[i].get_right(), pipe[i + 1].get_left(), buff=0.12, color=INK_SUBTLE,
                  stroke_width=3, max_tip_length_to_length_ratio=0.3)
            for i in range(3)
        ])
        loop = CurvedArrow(tk.get_bottom(), hn.get_bottom(), angle=-0.8, color=AMBER, stroke_width=4)
        loop_l = fit_label("append the token → new context → predict again", 8.5, 20, AMBER).next_to(loop, DOWN, buff=0.1)

        # 0-24: the map returns
        self.play(FadeIn(pipe[0]), run_time=1.2)
        for i in range(3):
            self.play(GrowArrow(parrows[i]), FadeIn(pipe[i + 1]), run_time=1.0)
        self.play(Create(loop), FadeIn(loop_l), run_time=1.6)
        wait_until(self, 28)

        # 28-92: watch the context grow, one predicted token at a time
        gen_l = stage_label("each new token changes the next prediction", INK_MUTED).move_to([0, -0.4, 0])
        self.play(FadeIn(gen_l), run_time=1.2)
        steps = ['"The cat"', '"The cat sat"', '"The cat sat on"', '"The cat sat on the"']
        adds = ["sat", "on", "the", "mat"]
        prev = None
        for i, s in enumerate(steps):
            wait_until(self, 32 + i * 14)
            ctx = fit_label(s, 6.2, 26, INK).move_to([-2.4, -1.35, 0])
            plus = fit_label(f"→ predict  '{adds[i]}'", 3.6, 24, EMERALD).next_to(ctx, RIGHT, buff=0.35)
            grp = VGroup(ctx, plus)
            if prev is None:
                self.play(FadeIn(grp), run_time=1.0)
            else:
                # sequential (not simultaneous) so the two same-position lines
                # never overlap mid-crossfade — a clean replace, no ghosted glyphs.
                self.play(FadeOut(prev), run_time=0.5)
                self.play(FadeIn(grp), run_time=0.7)
            self.play(Indicate(plus, color=EMERALD, scale_factor=1.1), run_time=0.8)
            prev = grp
        wait_until(self, 96)

        # 96-140: five perspectives on the one prediction loop
        cards = VGroup()
        boxes, titles, subs = [], [], []
        for i, (name, sub, color) in enumerate(self.PERSPECTIVES):
            box = RoundedRectangle(width=2.3, height=1.4, corner_radius=0.14,
                                   stroke_color=color, stroke_width=2.6,
                                   fill_color=color, fill_opacity=0.14)
            nm = Text(name, font_size=24, color=INK).move_to(box.get_center() + UP * 0.32)
            sb = fit_label(sub, 2.0, 17, INK).move_to(box.get_center() + DOWN * 0.3)
            boxes.append(box); titles.append(nm); subs.append(sb)
            cards.add(VGroup(box, nm, sb))
        cards.arrange(RIGHT, buff=0.26).move_to([0, -2.7, 0])
        for i in range(len(cards)):
            boxes[i].set_stroke(opacity=0.4).set_fill(opacity=0.05)
            titles[i].set_opacity(0.45)
            subs[i].set_opacity(0.4)

        def light(i):
            return [boxes[i].animate.set_stroke(opacity=1.0).set_fill(opacity=0.16),
                    titles[i].animate.set_opacity(1.0),
                    subs[i].animate.set_opacity(0.85)]

        self.play(FadeIn(cards), run_time=1.8)
        for i in range(len(self.PERSPECTIVES)):
            wait_until(self, 100 + i * 7)
            self.play(*light(i), run_time=0.8)
            self.play(Indicate(boxes[i], color=self.PERSPECTIVES[i][2], scale_factor=1.06), run_time=0.7)
        wait_until(self, 140)
        # 140+: all perspectives lit → explain from every angle
        self.play(*[a for i in range(len(cards)) for a in light(i)], run_time=1.2)
        self.play(Indicate(pipe, color=ACCENT, scale_factor=1.05), run_time=1.4)
        self.guard(pipe, loop_l, cards)
        pace_to(self, self.cue_duration)
