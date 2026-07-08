"""
Lesson 14 — Orientation (activity 80): "Lesson 3: Serving with a KV Cache"
(1004.88s / ~16.7min overview audio).

The overview audio is a spiral: the same eight teaching beats (big map / route /
workshop metaphor / tiny example / mechanism / implementation / confusion /
recap) repeated across five passes. Following the proven, QA-passed orientation
pattern (acts 7/14/38/72/76), the timeline is SEVEN route cues spread evenly
over the real duration, each re-authored for the actual KV-cache serving
content:

  Cue00 0-143.6      High-level map: prefill builds the cache → decode reuses it
  Cue01 143.6-287.1  Analogy: the KV cache is a filed set of key/value receipts
  Cue02 287.1-430.7  Tiny example: prefill 'The cat sat' → 3 cached K,V rows
  Cue03 430.7-574.2  Mechanism: decode computes only q_new, attends over cache
  Cue04 574.2-717.8  Implementation: growing cache_k/cache_v, M = L·2·n·d memory
  Cue05 717.8-861.3  Misconception: reuse saves compute, not memory; prefill≠decode
  Cue06 861.3-1004.9 Synthesis: prefill builds, decode reuses+grows, repeat

Each ~143.55s cue stages its reveals across the window via wait_until(scene, t)
so the frame keeps changing with the narration; pace_to fills the remainder to
hit the exact cue duration. The lit element is whatever the beat discusses.

Reuses the transformer.py idiom lib (token_row, hidden_matrix, vector_strip) —
the transformer vocabulary Lesson 7 established — now telling the *serving /
inference* story: the KV cache as two grids (keys, values) that prefill fills
once and decode grows one row at a time. NOT the Bayes / econ idioms of
unrelated lessons.
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
)
from pacing import pace_to, elapsed
from transformer import (
    token_row,
    hidden_matrix,
    vector_strip,
    fit_label,
)
from manim import (
    VGroup,
    RoundedRectangle,
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


# ─── local helpers (shared idioms, same as the L13 orientation) ──────────────
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
PROMPT = ["The", "cat", "sat"]


# ─── Cue00 : the high-level map (two phases) ─────────────────────────────────
class Cue00(AvoScene):
    headline = "Serving has two phases: prefill, then decode"
    cue_duration = 143.554

    def construct(self):
        # the prompt entering
        toks = token_row(PROMPT, w=1.15, h=0.66, fs=22, gap=0.16).move_to([-4.55, 2.2, 0])

        # two phase stations
        prefill = chip("PREFILL", ACCENT, w=2.4, h=1.0, fs=25).move_to([-1.4, 2.2, 0])
        pre_sub = fit_label("read the whole prompt once", 3.4, 19, ACCENT_LIGHT).next_to(prefill, DOWN, buff=0.24)
        decode = chip("DECODE", EMERALD, w=2.6, h=1.0, fs=26).move_to([3.4, 2.2, 0])
        dec_sub = fit_label("one new token at a time", 3.4, 19, EMERALD).next_to(decode, DOWN, buff=0.24)

        a_in = Arrow(toks.get_right(), prefill.get_left(), buff=0.22, color=INK_MUTED,
                     stroke_width=4, max_tip_length_to_length_ratio=0.24)
        a_mid = Arrow(prefill.get_right(), decode.get_left(), buff=0.22, color=INK_MUTED,
                      stroke_width=4, max_tip_length_to_length_ratio=0.18)

        # the KV cache built by prefill, reused by decode
        kv = hidden_matrix(rows=3, cols=6, color=AMBER, cell=0.34, gap=0.07,
                           row_labels=PROMPT).move_to([-1.4, -1.4, 0])
        kv_l = fit_label("key–value cache (one row per token, every layer)",
                         9.5, BODY_SIZE, AMBER).next_to(kv, DOWN, buff=0.4)

        # 0-16: the prompt enters prefill
        self.play(FadeIn(toks), run_time=2.0)
        wait_until(self, 8)
        self.play(GrowArrow(a_in), FadeIn(prefill), FadeIn(pre_sub), run_time=2.0)
        self.play(Indicate(prefill, color=ACCENT, scale_factor=1.08), run_time=1.2)
        wait_until(self, 22)
        # 22-52: prefill builds the KV cache
        self.play(FadeIn(kv_l), run_time=1.2)
        for r in range(3):
            wait_until(self, 24 + r * 8)
            self.play(FadeIn(kv.cell_rows[r], shift=RIGHT * 0.1), run_time=1.1)
            self.play(Indicate(kv.cell_rows[r], color=AMBER, scale_factor=1.05), run_time=0.8)
        wait_until(self, 56)
        # 56-92: decode reuses the cache, generating one token at a time
        self.play(GrowArrow(a_mid), FadeIn(decode), FadeIn(dec_sub), run_time=2.0)
        self.play(Indicate(decode, color=EMERALD, scale_factor=1.08), run_time=1.2)
        reuse = Arrow(decode.get_bottom(), kv.get_right() + UP * 0.2, buff=0.25, color=EMERALD,
                      stroke_width=3, max_tip_length_to_length_ratio=0.1)
        reuse_l = fit_label("decode reuses the cache instead of recomputing the prompt",
                            11.0, 20, EMERALD).to_edge(DOWN, buff=0.9)
        self.play(GrowArrow(reuse), FadeIn(reuse_l), run_time=1.8)
        wait_until(self, 108)
        # 108-136: append one row per new token → cache grows with context
        newrow = hidden_matrix(rows=1, cols=6, color=EMERALD, cell=0.34, gap=0.07).move_to(
            kv.cell_rows[2].get_center() + DOWN * 0.41)
        new_l = fit_label("+1 row per generated token", 4.2, 19, EMERALD).next_to(newrow, RIGHT, buff=0.3)
        self.play(FadeIn(newrow, shift=UP * 0.1), FadeIn(new_l), run_time=1.6)
        self.play(Indicate(newrow, color=EMERALD, scale_factor=1.1), run_time=1.2)
        wait_until(self, 138)
        # 138+: the payoff — long chats cost memory
        note = fit_label("the cache grows with context length — long chats cost memory",
                         12.0, LABEL_SIZE, INK).to_edge(DOWN, buff=0.5)
        self.play(FadeOut(reuse_l), FadeIn(note), run_time=1.4)
        self.guard(toks, prefill, decode, kv, kv_l, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the workshop analogy (filed receipts) ───────────────────────────
class Cue01(AvoScene):
    headline = "The KV cache is a filed set of receipts"
    cue_duration = 143.555

    STATIONS = [
        ("Prefill", "read the whole prompt", ACCENT),
        ("File K, V", "one receipt per token", AMBER),
        ("Decode", "reuse the filed receipts", EMERALD),
        ("Append", "one new receipt / token", VIOLET),
    ]

    def construct(self):
        obj = chip("the prompt", ACCENT_LIGHT, w=2.0, h=0.9, fs=20).move_to([-5.6, 1.7, 0])
        boxes = VGroup()
        receipts = VGroup()
        xs = [-2.9, -0.3, 2.3, 5.0]
        for i, (name, change, color) in enumerate(self.STATIONS):
            b = chip(name, color, w=2.1, h=1.1, fs=20).move_to([xs[i], 1.7, 0])
            r = fit_label(change, 2.2, 17, color).next_to(b, DOWN, buff=0.3)
            boxes.add(b)
            receipts.add(r)
        belt = Line([-6.5, 0.3, 0], [6.1, 0.3, 0], color=INK_SUBTLE, stroke_width=3)
        belt_l = stage_label("the serving pipeline as a workshop line", INK_MUTED).next_to(belt, DOWN, buff=0.2).set_x(-3.2)

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
        tags = fit_label("tags: inference · kv-cache · serving", 9.5, BODY_SIZE, INK).to_edge(DOWN, buff=0.9)
        tag_note = fit_label("they name the stations, not decorations", 8.0, 20, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(tags), run_time=1.4)
        self.play(FadeIn(tag_note), run_time=1.2)
        wait_until(self, 140)
        # 140+: the receipt = evidence of what changed
        self.play(*[Indicate(r, color=self.STATIONS[i][2], scale_factor=1.1)
                    for i, r in enumerate(receipts)], run_time=1.6)
        self.guard(obj, boxes, receipts, tags, tag_note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the tiny concrete example (prefill builds 3 rows) ───────────────
class Cue02(AvoScene):
    headline = "Prefill files a K and V row per token"
    cue_duration = 143.554

    def construct(self):
        toks = token_row(PROMPT, w=1.6, h=0.78, fs=26, gap=0.35).move_to([0, 2.5, 0])

        # two side-by-side cache grids: Keys and Values, one row per token
        K = hidden_matrix(rows=3, cols=5, color=AMBER, cell=0.36, gap=0.07,
                          row_labels=PROMPT).move_to([-2.9, 0.1, 0])
        K_l = stage_label("key cache", AMBER).next_to(K, UP, buff=0.35)
        V = hidden_matrix(rows=3, cols=5, color=EMERALD, cell=0.36, gap=0.07).move_to([3.0, 0.1, 0])
        V_l = stage_label("value cache", EMERALD).next_to(V, UP, buff=0.35)

        # 0-18: the prompt
        self.play(FadeIn(toks, shift=DOWN * 0.12), run_time=2.0)
        wait_until(self, 12)
        self.play(FadeIn(K_l), FadeIn(V_l), run_time=1.2)
        wait_until(self, 18)
        # 18-96: prefill computes K and V for each of the 3 tokens and stores them
        for r in range(3):
            wait_until(self, 18 + r * 22)
            dropK = Arrow(toks[r].get_bottom(), K.cell_rows[r].get_left() + LEFT * 0.05,
                          buff=0.15, color=AMBER, stroke_width=3, max_tip_length_to_length_ratio=0.14)
            dropV = Arrow(toks[r].get_bottom(), V.cell_rows[r].get_left() + LEFT * 0.05,
                          buff=0.15, color=EMERALD, stroke_width=3, max_tip_length_to_length_ratio=0.14)
            self.play(GrowArrow(dropK), GrowArrow(dropV), run_time=1.1)
            self.play(FadeIn(K.cell_rows[r], shift=RIGHT * 0.1),
                      FadeIn(V.cell_rows[r], shift=RIGHT * 0.1), run_time=1.3)
            self.play(Indicate(K.cell_rows[r], color=AMBER, scale_factor=1.05),
                      Indicate(V.cell_rows[r], color=EMERALD, scale_factor=1.05), run_time=1.0)
        wait_until(self, 100)
        # 100-134: now the model can attend over the 3 cached rows, no re-read
        boxK = SurroundingRectangle(K.cell_rows[:3] if False else VGroup(*K.cell_rows),
                                    color=AMBER, buff=0.12, corner_radius=0.06)
        boxV = SurroundingRectangle(VGroup(*V.cell_rows), color=EMERALD, buff=0.12, corner_radius=0.06)
        self.play(Create(boxK), Create(boxV), run_time=1.6)
        stored = fit_label("3 tokens → 3 cached key rows + 3 cached value rows",
                           11.0, BODY_SIZE, INK).to_edge(DOWN, buff=0.75)
        self.play(FadeIn(stored), run_time=1.4)
        wait_until(self, 136)
        # 136+: no need to read the raw prompt again
        note = fit_label("attend over the cache — never re-read the raw prompt",
                         11.5, LABEL_SIZE, EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeOut(stored), FadeIn(note), run_time=1.4)
        self.guard(toks, K, V, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the mechanism (decode reuses, computes only q_new) ──────────────
class Cue03(AvoScene):
    headline = "Decode computes one query, attends over the cache"
    cue_duration = 143.554

    def construct(self):
        # the cache (keys) with an appended new row highlighted
        K = hidden_matrix(rows=3, cols=6, color=AMBER, cell=0.34, gap=0.07,
                          row_labels=PROMPT).move_to([-3.4, 0.9, 0])
        K_l = stage_label("cached keys (reused)", AMBER).next_to(K, UP, buff=0.3)

        # the single new query the decode step must compute
        q = vector_strip(6, color=ACCENT, cell=0.34, gap=0.07).move_to([-3.4, -1.5, 0])
        q_l = fit_label("q — the ONLY new vector this step", 5.0, 20, ACCENT).next_to(q, DOWN, buff=0.28)

        # the attention formula
        formula = MathTex(r"\mathrm{attn} = \mathrm{softmax}\!\left(\frac{q\,K^\top}{\sqrt{d}}\right)V",
                          font_size=FORMULA_SIZE_SMALL, color=INK).move_to([3.2, 1.6, 0])

        # cost contrast
        without = fit_label("without cache: recompute K,V for all n  →  O(n²)",
                            6.8, 19, ROSE).move_to([2.7, -0.4, 0])
        withc = fit_label("with cache: compute 1 new K,V  →  O(n)",
                          6.8, 19, EMERALD).move_to([2.7, -1.4, 0])

        # 0-24: the cache is already there, reused
        self.play(FadeIn(K), FadeIn(K_l), run_time=2.0)
        self.play(Indicate(VGroup(*K.cell_rows), color=AMBER, scale_factor=1.03), run_time=1.4)
        wait_until(self, 28)
        # 28-52: the decode step computes only the new query q
        self.play(FadeIn(q), FadeIn(q_l), run_time=2.0)
        self.play(Indicate(q, color=ACCENT, scale_factor=1.1), run_time=1.4)
        wait_until(self, 56)
        # 56-88: q attends over all cached keys, then weighted values
        rays = VGroup(*[
            Arrow(q.get_top(), K.cell_rows[r].get_bottom(), buff=0.12, color=ACCENT_LIGHT,
                  stroke_width=2.4, max_tip_length_to_length_ratio=0.08)
            for r in range(3)
        ])
        self.play(*[GrowArrow(a) for a in rays], run_time=1.8)
        self.play(Write(formula), run_time=2.0)
        wait_until(self, 92)
        # 92-118: without the cache you would redo the whole prompt
        self.play(FadeIn(without), run_time=1.6)
        self.play(Indicate(without, color=ROSE, scale_factor=1.05), run_time=1.2)
        wait_until(self, 120)
        # 120-140: with the cache each step is linear
        self.play(FadeIn(withc), run_time=1.6)
        self.play(Indicate(withc, color=EMERALD, scale_factor=1.06), run_time=1.2)
        wait_until(self, 142)
        # 142+: the saving in one line
        note = fit_label("the cache turns per-step recompute from O(n) into O(1)",
                         12.0, LABEL_SIZE, INK).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(K, q, formula, without, withc, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : implementation (growing tensors, memory formula) ────────────────
class Cue04(AvoScene):
    headline = "A growing per-layer tensor of keys and values"
    cue_duration = 143.554

    def construct(self):
        # cache_k / cache_v as labeled grids, [seq × dim]
        K = hidden_matrix(rows=4, cols=6, color=AMBER, cell=0.32, gap=0.06).move_to([-3.6, 0.6, 0])
        K_l = MathTex(r"\texttt{cache\_k}", font_size=28, color=AMBER).next_to(K, UP, buff=0.28)
        V = hidden_matrix(rows=4, cols=6, color=EMERALD, cell=0.32, gap=0.06).move_to([0.4, 0.6, 0])
        V_l = MathTex(r"\texttt{cache\_v}", font_size=28, color=EMERALD).next_to(V, UP, buff=0.28)
        shape = fit_label("shape: [ sequence × dimension ]", 5.6, 20, INK_MUTED).move_to([-1.6, -1.7, 0])

        # the memory formula on the right
        mem = MathTex(r"M = L \times 2 \times n \times d", font_size=FORMULA_SIZE_SMALL, color=INK).move_to([4.2, 1.6, 0])
        legend = VGroup(
            fit_label("L  layers", 3.0, 19, INK_MUTED),
            fit_label("2  keys & values", 3.4, 19, INK_MUTED),
            fit_label("n  sequence length", 3.6, 19, INK_MUTED),
            fit_label("d  hidden dimension", 3.6, 19, INK_MUTED),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.22).move_to([4.2, -0.3, 0])

        # 0-24: the two growing tensors
        self.play(FadeIn(K), FadeIn(K_l), run_time=1.8)
        self.play(FadeIn(V), FadeIn(V_l), run_time=1.8)
        self.play(FadeIn(shape), run_time=1.0)
        wait_until(self, 28)
        # 28-64: each decode step appends one row to each
        for step in range(2):
            wait_until(self, 30 + step * 16)
            newK = hidden_matrix(rows=1, cols=6, color=AMBER, cell=0.32, gap=0.06).move_to(
                K.cell_rows[3].get_center() + DOWN * (0.38 + step * 0.38))
            newV = hidden_matrix(rows=1, cols=6, color=EMERALD, cell=0.32, gap=0.06).move_to(
                V.cell_rows[3].get_center() + DOWN * (0.38 + step * 0.38))
            self.play(FadeIn(newK, shift=UP * 0.08), FadeIn(newV, shift=UP * 0.08), run_time=1.2)
            self.play(Indicate(newK, color=AMBER, scale_factor=1.08),
                      Indicate(newV, color=EMERALD, scale_factor=1.08), run_time=0.9)
        wait_until(self, 68)
        # 68-104: the memory formula
        self.play(Write(mem), run_time=2.0)
        for i in range(len(legend)):
            wait_until(self, 74 + i * 7)
            self.play(FadeIn(legend[i], shift=RIGHT * 0.1), run_time=1.0)
        wait_until(self, 108)
        # 108-136: memory climbs as n grows
        grow = fit_label("n climbs with every generated token → memory climbs with it",
                         12.0, BODY_SIZE, ROSE).to_edge(DOWN, buff=0.75)
        self.play(FadeIn(grow), run_time=1.6)
        self.play(Indicate(mem, color=ROSE, scale_factor=1.06), run_time=1.4)
        wait_until(self, 138)
        # 138+: the code shape mirrors the math
        note = fit_label("append a row per step · attend over the whole cache",
                         11.5, LABEL_SIZE, INK).to_edge(DOWN, buff=0.55)
        self.play(FadeOut(grow), FadeIn(note), run_time=1.4)
        self.guard(K, V, mem, legend, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the common confusions ───────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Reuse saves compute — not memory"
    cue_duration = 143.555

    PAIRS = [
        ('prefill', 'decode', "prefill reads the whole prompt; decode adds one token at a time"),
        ('a cached K/V', 'the final answer', "the cache is stored work, not the model's output"),
        ('saving compute', 'saving memory', "reuse skips recompute, but the cache still grows with context"),
        ('a phase name', 'the operation', "'decode' is a query, an attention over the cache, and a sample"),
    ]

    def construct(self):
        rows = VGroup()
        notes = []
        top = 1.5
        dy = 1.0
        for i, (a, b, note) in enumerate(self.PAIRS):
            y = top - i * dy
            ca = chip(a, ACCENT, w=3.4, h=0.7, fs=20).move_to([-3.7, y, 0])
            neq = MathTex(r"\neq", font_size=40, color=ROSE).move_to([-0.3, y, 0])
            cb = chip(b, VIOLET, w=3.4, h=0.7, fs=20).move_to([2.9, y, 0])
            row = VGroup(ca, neq, cb).set_opacity(0.34)
            rows.add(row)
            notes.append(fit_label(note, 12.5, BODY_SIZE, INK).to_edge(DOWN, buff=0.7))

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


# ─── Cue06 : synthesis (prefill → decode loop, cost scales with context) ─────
class Cue06(AvoScene):
    headline = "Prefill builds it, decode reuses and grows it"
    cue_duration = 143.554

    PERSPECTIVES = [
        ("Audio", "the route / map", ACCENT),
        ("Visual", "makes it visible", AMBER),
        ("Text", "definitions & examples", VIOLET),
        ("Code", "proves you can use it", EMERALD),
        ("Assess", "checks understanding", ROSE),
    ]

    def construct(self):
        # top: the compact serving route, back for the recap, with a loop-back
        pf = chip("prefill", ACCENT, w=2.0, h=0.7, fs=22)
        ca = chip("KV cache", AMBER, w=2.2, h=0.7, fs=22)
        dc = chip("decode", EMERALD, w=2.0, h=0.7, fs=22)
        tk = chip("+1 token", VIOLET, w=2.0, h=0.7, fs=22)
        pipe = VGroup(pf, ca, dc, tk).arrange(RIGHT, buff=0.8).move_to([0, 2.2, 0])
        parrows = VGroup(*[
            Arrow(pipe[i].get_right(), pipe[i + 1].get_left(), buff=0.12, color=INK_SUBTLE,
                  stroke_width=3, max_tip_length_to_length_ratio=0.3)
            for i in range(3)
        ])
        loop = CurvedArrow(tk.get_bottom(), ca.get_bottom(), angle=-0.8, color=AMBER, stroke_width=4)
        loop_l = fit_label("append the token's K,V → cache grows → decode again", 8.8, 20, AMBER).next_to(loop, DOWN, buff=0.1)

        # 0-24: the route returns
        self.play(FadeIn(pipe[0]), run_time=1.2)
        for i in range(3):
            self.play(GrowArrow(parrows[i]), FadeIn(pipe[i + 1]), run_time=1.0)
        self.play(Create(loop), FadeIn(loop_l), run_time=1.6)
        wait_until(self, 28)

        # 28-92: watch the cache grow, one decoded token at a time
        gen_l = stage_label("each decoded token adds a row — cost scales with context", INK_MUTED).move_to([0, -0.4, 0])
        self.play(FadeIn(gen_l), run_time=1.2)
        steps = ['prompt: 3 tokens', 'cache: 4 rows', 'cache: 5 rows', 'cache: 6 rows']
        adds = ["prefill", "+ 'on'", "+ 'the'", "+ 'mat'"]
        prev = None
        for i, s in enumerate(steps):
            wait_until(self, 32 + i * 14)
            ctx = fit_label(s, 5.2, 26, INK).move_to([-2.2, -1.35, 0])
            plus = fit_label(adds[i], 3.2, 24, EMERALD).next_to(ctx, RIGHT, buff=0.4)
            grp = VGroup(ctx, plus)
            if prev is None:
                self.play(FadeIn(grp), run_time=1.0)
            else:
                # sequential replace so the two same-position lines never overlap
                self.play(FadeOut(prev), run_time=0.5)
                self.play(FadeIn(grp), run_time=0.7)
            self.play(Indicate(plus, color=EMERALD, scale_factor=1.1), run_time=0.8)
            prev = grp
        wait_until(self, 96)

        # 96-140: five perspectives on the one serving loop
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
