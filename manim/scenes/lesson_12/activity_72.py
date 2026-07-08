"""
Lesson 12 — Orientation (activity 72): "Lesson 1: Text to Tokens" (1225.66s /
~20min overview audio).

The overview audio is a spiral: the same eight teaching beats (big map / route /
workshop metaphor / tiny example / mechanism / implementation / confusion /
recap) repeated across five passes. Following the proven, QA-passed orientation
pattern (acts 7/14/38), the timeline is SEVEN route cues spread evenly over the
real duration, each re-authored for the actual tokenization content:

  Cue00 0-175        High-level map: text → pieces → IDs → rows → table
  Cue01 175-350      Analogy: the tokenizer is a workshop station w/ a receipt
  Cue02 350-525      Tiny example: "she saw the saw" — 'saw' twice → same ID/row
  Cue03 525-700      Mechanism: IDs index rows; sequence length costs compute
  Cue04 700-875      Implementation: build a vocab; encode/decode are inverses
  Cue05 875-1050     Misconception: token≠word, ID≠vector, score≠prob, phase≠op
  Cue06 1050-1225.66 Synthesis: return to the map, five perspectives, practice

Each 175s cue stages its reveals across the window via wait_until(scene, t) so
the frame keeps changing with the narration; pace_to fills the remainder to hit
the exact cue duration. The lit element is whatever the beat is discussing.

Reuses the transformer.py idiom lib (token_row, id_boxes, embedding_table,
vector_strip) — the same tokenization vocabulary Lesson 7 established — NOT the
Bayes / econ idioms of unrelated lessons.
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
from transformer import token_row, id_boxes, embedding_table, vector_strip, fit_label
from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Text,
    MathTex,
    Arrow,
    Line,
    Circle,
    Dot,
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


# ─── local helpers ───────────────────────────────────────────────────────────
def wait_until(scene, t: float) -> None:
    """Wait until scene time reaches `t` seconds (no-op if already past)."""
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def chip(label, color=ACCENT, w=2.5, h=1.0, fs=22):
    box = RoundedRectangle(
        width=w, height=h, corner_radius=0.14,
        stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.12,
    )
    t = fit_label(label, w - 0.3, fs, INK).move_to(box.get_center())
    return VGroup(box, t)


def stage_label(text, color=INK_MUTED, fs=20):
    return Text(text, font_size=fs, color=color)


# The running example, shared across cues (continuity with Lesson 7).
PIECES = ["she", "saw", "the", "saw"]
IDS = [12, 44, 91, 44]


# ─── Cue00 : the high-level map ──────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Text becomes a table of numbers"
    cue_duration = 175.094

    def construct(self):
        # top: text → pieces → IDs (the tokenizer half)
        txt = chip('"she saw the saw"', ACCENT, w=3.6, h=1.0, fs=24).move_to([-4.4, 2.0, 0])
        pieces = token_row(PIECES, w=1.15, h=0.62, fs=22, gap=0.14).move_to([2.0, 2.0, 0])
        a1 = Arrow(txt.get_right(), pieces.get_left(), buff=0.25, color=INK_MUTED, stroke_width=4)
        a1l = stage_label("split").next_to(a1, UP, buff=0.1)

        ids = id_boxes(IDS, w=0.9, h=0.72, fs=24, gap=0.5).move_to([2.0, 0.55, 0])
        # align each id under its piece
        for i, b in enumerate(ids):
            b.move_to([pieces[i].get_x(), 0.55, 0])
        drops = VGroup(*[
            Arrow(pieces[i].get_bottom(), ids[i].get_top(), buff=0.1, color=INK_SUBTLE,
                  stroke_width=3, max_tip_length_to_length_ratio=0.3)
            for i in range(len(IDS))
        ])
        ids_l = stage_label("each piece → an integer ID", INK_MUTED).next_to(ids, DOWN, buff=0.22).set_x(2.0)

        # bottom: IDs → embedding rows → table of numbers
        emb = embedding_table(IDS, cols=6, cell=0.26, fs=18).scale(0.92).move_to([1.6, -1.9, 0])
        emb_a = Arrow(ids.get_bottom(), emb.get_top(), buff=0.2, color=INK_SUBTLE,
                      stroke_width=3, max_tip_length_to_length_ratio=0.18)
        emb_l = fit_label("each ID selects one learned row", 3.4, BODY_SIZE, EMERALD).move_to([-4.3, -1.9, 0])

        # 0-16: the input text
        self.play(FadeIn(txt), run_time=2.2)
        wait_until(self, 12)
        # 16-42: split into token pieces
        self.play(GrowArrow(a1), FadeIn(a1l), run_time=1.6)
        self.play(FadeIn(pieces, shift=RIGHT * 0.2), run_time=2.2)
        wait_until(self, 40)
        # 42-72: each piece → ID
        self.play(*[GrowArrow(d) for d in drops], run_time=1.6)
        self.play(FadeIn(ids), FadeIn(ids_l), run_time=2.0)
        wait_until(self, 60)
        # the two 'saw' collapse to the same ID 44
        self.play(Indicate(ids[1], color=AMBER, scale_factor=1.2),
                  Indicate(ids[3], color=AMBER, scale_factor=1.2), run_time=1.6)
        wait_until(self, 84)
        # 84-120: IDs → embedding rows
        self.play(GrowArrow(emb_a), FadeIn(emb), run_time=2.2)
        self.play(FadeIn(emb_l), run_time=1.4)
        wait_until(self, 120)
        # 120-150: it is now a table of numbers
        table_note = fit_label("+ position → a table of numbers", 6.0, LABEL_SIZE, ACCENT_LIGHT).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(table_note), run_time=1.4)
        for r in emb.rows:
            self.play(Indicate(r, color=ACCENT, scale_factor=1.05), run_time=0.5)
        wait_until(self, 150)
        # 150+: fade the tokenizer half, keep the payoff table, name it
        top_pipeline = VGroup(txt, a1, a1l, pieces, drops, ids, ids_l)
        self.play(FadeOut(top_pipeline), run_time=1.0)
        proc = fit_label("this table is what the transformer processes", 9.0, BODY_SIZE, EMERALD).to_edge(UP, buff=1.9)
        self.play(FadeIn(proc), run_time=1.4)
        self.play(Indicate(proc, color=EMERALD, scale_factor=1.06), run_time=1.2)
        self.guard(emb, emb_l, table_note, proc)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the workshop analogy ────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "The tokenizer is a workshop station"
    cue_duration = 175.095

    STATIONS = [
        ("Tokenizer", "text → IDs", AMBER),
        ("Embedding", "IDs → rows", ACCENT),
        ("+ Position", "rows → table", VIOLET),
    ]

    def construct(self):
        # a workshop line: object enters, each station changes it + stamps a receipt
        obj = chip('"she saw…"', ACCENT_LIGHT, w=2.3, h=0.9, fs=22).move_to([-5.4, 1.4, 0])
        boxes = VGroup()
        receipts = VGroup()
        xs = [-2.4, 0.9, 4.2]
        for i, (name, change, color) in enumerate(self.STATIONS):
            b = chip(name, color, w=2.6, h=1.2, fs=24).move_to([xs[i], 1.4, 0])
            r = fit_label(change, 2.5, 20, color).next_to(b, DOWN, buff=0.35)
            boxes.add(b)
            receipts.add(r)
        belt = Line([-6.4, 0.2, 0], [6.4, 0.2, 0], color=INK_SUBTLE, stroke_width=3)
        belt_l = stage_label("the pipeline as a workshop line", INK_MUTED).next_to(belt, DOWN, buff=0.2).set_x(-3.4)

        # 0-14: the object enters
        self.play(FadeIn(obj), run_time=1.8)
        self.play(Create(belt), FadeIn(belt_l), run_time=1.6)
        wait_until(self, 14)
        arrows = []
        prev = obj
        # 14-120: each station receives, changes, and stamps a receipt
        for i, (name, change, color) in enumerate(self.STATIONS):
            t0 = 14 + i * 34
            wait_until(self, t0)
            a = Arrow(prev.get_right(), boxes[i].get_left(), buff=0.2, color=INK_MUTED,
                      stroke_width=4, max_tip_length_to_length_ratio=0.25)
            arrows.append(a)
            self.play(GrowArrow(a), run_time=1.2)
            self.play(FadeIn(boxes[i], shift=UP * 0.15), run_time=1.4)
            self.play(Indicate(boxes[i], color=color, scale_factor=1.08), run_time=1.0)
            self.play(FadeIn(receipts[i]), run_time=1.2)
            prev = boxes[i]
        wait_until(self, 124)
        # 124-150: the tags name the stations & the evidence
        tags = fit_label("tags: llm-foundations · tokenization · embeddings", 11.5, BODY_SIZE, INK).to_edge(DOWN, buff=0.9)
        tag_note = fit_label("they name the stations, not decorations", 8.0, 20, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(tags), run_time=1.4)
        self.play(FadeIn(tag_note), run_time=1.2)
        wait_until(self, 150)
        # 150+: the receipt = evidence of what changed
        self.play(*[Indicate(r, color=self.STATIONS[i][2], scale_factor=1.08)
                    for i, r in enumerate(receipts)], run_time=1.6)
        self.guard(obj, boxes, receipts, tags, tag_note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the tiny concrete example ───────────────────────────────────────
class Cue02(AvoScene):
    headline = "Follow one concrete input"
    cue_duration = 175.094

    def construct(self):
        pieces = token_row(PIECES, w=1.4, h=0.72, fs=26, gap=0.3).move_to([0, 1.9, 0])
        ids = id_boxes(IDS, w=1.0, h=0.8, fs=28, gap=0.7).move_to([0, 0.3, 0])
        for i, b in enumerate(ids):
            b.move_to([pieces[i].get_x(), 0.3, 0])
        drops = VGroup(*[
            Arrow(pieces[i].get_bottom(), ids[i].get_top(), buff=0.12, color=INK_SUBTLE,
                  stroke_width=3, max_tip_length_to_length_ratio=0.3)
            for i in range(len(IDS))
        ])

        # 0-18: show the sentence pieces
        self.play(FadeIn(pieces, shift=RIGHT * 0.2), run_time=2.2)
        wait_until(self, 18)
        # 18-44: map each piece to an ID
        self.play(*[GrowArrow(d) for d in drops], run_time=1.6)
        self.play(FadeIn(ids), run_time=2.0)
        wait_until(self, 44)
        # 44-84: 'saw' appears twice → the SAME id 44 both times
        saw_boxes = [pieces[1], pieces[3]]
        self.play(*[Indicate(s, color=AMBER, scale_factor=1.15) for s in saw_boxes], run_time=1.4)
        link = Line(pieces[1].get_top() + UP * 0.05, pieces[3].get_top() + UP * 0.05,
                    color=AMBER, stroke_width=3).shift(UP * 0.35)
        link_l = stage_label("same word", AMBER).next_to(link, UP, buff=0.1)
        self.play(Create(link), FadeIn(link_l), run_time=1.2)
        self.play(Indicate(ids[1], color=AMBER, scale_factor=1.25),
                  Indicate(ids[3], color=AMBER, scale_factor=1.25), run_time=1.6)
        same = fit_label("the same piece → the same ID 44, every time", 9.5, LABEL_SIZE, AMBER).move_to([0, -1.2, 0])
        self.play(FadeIn(same), run_time=1.4)
        wait_until(self, 96)
        # 96-140: that ID points at ONE embedding row (the same row twice)
        row = vector_strip(6, color=EMERALD, cell=0.42, gap=0.08).move_to([0, -2.4, 0])
        row_l = fit_label("id 44 → one learned row", 3.4, 20, EMERALD).move_to([-4.2, -2.4, 0])
        pt = Arrow(ids[1].get_bottom(), row.get_top(), buff=0.15, color=EMERALD,
                   stroke_width=3, max_tip_length_to_length_ratio=0.15)
        pt2 = Arrow(ids[3].get_bottom(), row.get_top(), buff=0.15, color=EMERALD,
                    stroke_width=3, max_tip_length_to_length_ratio=0.15)
        self.play(FadeOut(same), run_time=0.6)
        self.play(GrowArrow(pt), GrowArrow(pt2), FadeIn(row), FadeIn(row_l), run_time=2.0)
        self.play(Indicate(row, color=EMERALD, scale_factor=1.1), run_time=1.4)
        wait_until(self, 150)
        # 150+: point at one object and say what it is
        note = fit_label("point at one token, one ID, one row — that is the whole idea", 12.0, BODY_SIZE, INK).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(pieces, ids, row, row_l, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the mechanism ───────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "IDs index rows; length costs compute"
    cue_duration = 175.094

    def construct(self):
        # left: the embedding matrix with a highlighted lookup
        emb = embedding_table([12, 44, 91, 7, 63], cols=6, cell=0.3, fs=18).scale(0.95).move_to([-3.4, 0.3, 0])
        emb_title = stage_label("embedding matrix (vocab × D)", INK_MUTED).next_to(emb, UP, buff=0.35)

        # 0-16: the matrix
        self.play(FadeIn(emb), FadeIn(emb_title), run_time=2.4)
        wait_until(self, 16)
        # 16-48: id 44 is a ROW INDEX
        idbox = id_boxes([44], w=1.0, h=0.8, fs=28).move_to([-6.0, 1.5, 0])
        idx_a = Arrow(idbox.get_right(), emb.labels[1].get_left(), buff=0.2, color=AMBER,
                      stroke_width=3.5, max_tip_length_to_length_ratio=0.14)
        idx_l = stage_label("ID = row index", AMBER).next_to(idbox, DOWN, buff=0.25)
        self.play(FadeIn(idbox), FadeIn(idx_l), run_time=1.6)
        self.play(GrowArrow(idx_a),
                  emb.rows[1].animate.set_stroke(AMBER, width=2.6),
                  emb.labels[1].animate.set_color(AMBER), run_time=1.8)
        wait_until(self, 40)
        # 40-80: the row's numbers CARRY learned meaning
        row_hl = SurroundingRectangle(emb.rows[1], color=EMERALD, buff=0.08, corner_radius=0.05)
        mean = fit_label("the row's numbers carry learned meaning", 5.4, BODY_SIZE, EMERALD)
        mean.next_to(emb, RIGHT, buff=0.6).set_y(1.3)
        self.play(Create(row_hl), FadeIn(mean), run_time=1.8)
        pos = MathTex(r"H = \text{embed}(\text{id}) + \text{position}", font_size=FORMULA_SIZE_SMALL, color=INK)
        pos.next_to(emb, RIGHT, buff=0.6).set_y(0.2)
        self.play(Write(pos), run_time=2.0)
        wait_until(self, 84)
        # 84-140: sequence length is a real compute cost
        self.play(FadeOut(mean), FadeOut(pos), FadeOut(row_hl), run_time=0.8)
        cost = MathTex(r"\text{attention cost} \;\sim\; L^2", font_size=FORMULA_SIZE_SMALL, color=ROSE)
        cost.next_to(emb, RIGHT, buff=0.7).set_y(1.2)
        seqs = VGroup()
        for i, L in enumerate([4, 8, 16]):
            bar = Rectangle(width=0.5 + 0.5 * L * L / (16 * 16) * 6, height=0.42,
                            stroke_width=0, fill_color=ROSE, fill_opacity=0.6 + i * 0.12)
            # width proportional to L^2
            w = 0.6 + 6.0 * (L * L) / (16 * 16)
            bar = Rectangle(width=w, height=0.42, stroke_width=0, fill_color=ROSE, fill_opacity=0.5 + i * 0.15)
            lbl = Text(f"L={L}", font_size=20, color=INK)
            grp = VGroup(lbl, bar).arrange(RIGHT, buff=0.3)
            seqs.add(grp)
        seqs.arrange(DOWN, buff=0.3, aligned_edge=LEFT).next_to(emb, RIGHT, buff=0.7).set_y(-1.2)
        self.play(FadeIn(cost), run_time=1.4)
        for g in seqs:
            self.play(FadeIn(g, shift=RIGHT * 0.15), run_time=1.0)
            self.wait(0.8)
        wait_until(self, 150)
        # 150+: more tokens → more work
        note = fit_label("more tokens means more compute — length is not free", 12.0, BODY_SIZE, INK).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.4)
        self.play(Indicate(cost, color=ROSE, scale_factor=1.1), run_time=1.2)
        self.guard(emb, cost, seqs, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : implementation intuition ────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Encode and decode are exact inverses"
    cue_duration = 175.094

    def construct(self):
        # build a tiny char vocab from 'saw the' → collect → sort → index
        s = MathTex(r"\texttt{'she saw'}", font_size=FORMULA_SIZE_SMALL, color=ACCENT).move_to([-4.9, 2.0, 0])
        chars = [" ", "a", "e", "h", "s", "w"]
        uniq = MathTex(r"\{s,h,e,\ ,a,w\}", font_size=FORMULA_SIZE_SMALL, color=INK).move_to([-1.0, 2.0, 0])
        srt = MathTex(r"[\ ,a,e,h,s,w]", font_size=FORMULA_SIZE_SMALL, color=INK).move_to([3.0, 2.0, 0])
        a1 = Arrow(s.get_right(), uniq.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3,
                   max_tip_length_to_length_ratio=0.2)
        a2 = Arrow(uniq.get_right(), srt.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3,
                   max_tip_length_to_length_ratio=0.2)
        steps = VGroup(
            stage_label("collect unique").next_to(a1, UP, buff=0.1),
            stage_label("sort").next_to(a2, UP, buff=0.1),
        )

        # index table
        idx = VGroup()
        for i, ch in enumerate(chars):
            disp = "␣" if ch == " " else ch
            cell = VGroup(
                Text(disp, font_size=26, color=INK),
                Text(str(i), font_size=24, color=EMERALD),
            ).arrange(DOWN, buff=0.12)
            cell.move_to([-4.7 + i * 1.25, 0.5, 0])
            idx.add(cell)
        idx_l = stage_label("char → index", INK_MUTED).next_to(idx, DOWN, buff=0.25).set_x(0)

        enc = MathTex(r"\text{encode}(\texttt{'sea'}) = [4,2,1]", font_size=FORMULA_SIZE_SMALL, color=ACCENT).move_to([0, -1.4, 0])
        dec = MathTex(r"\text{decode}([4,2,1]) = \texttt{'sea'}", font_size=FORMULA_SIZE_SMALL, color=AMBER).move_to([0, -2.2, 0])

        # 0-24: collect → sort
        self.play(Write(s), run_time=1.8)
        self.play(GrowArrow(a1), FadeIn(steps[0]), Write(uniq), run_time=1.8)
        self.play(GrowArrow(a2), FadeIn(steps[1]), Write(srt), run_time=1.8)
        wait_until(self, 30)
        # 30-64: assign an index to each char
        self.play(FadeIn(idx), FadeIn(idx_l), run_time=2.4)
        for c in idx:
            self.play(Indicate(c[1], color=EMERALD, scale_factor=1.15), run_time=0.4)
        wait_until(self, 70)
        # 70-110: encode then decode
        self.play(Write(enc), run_time=1.8)
        wait_until(self, 92)
        self.play(Write(dec), run_time=1.8)
        wait_until(self, 116)
        # 116-150: the assertion — decode(encode(x)) == x
        self.play(Indicate(enc, color=ACCENT, scale_factor=1.08), run_time=1.1)
        self.play(Indicate(dec, color=AMBER, scale_factor=1.08), run_time=1.1)
        asrt = MathTex(r"\text{assert}\ \ \text{decode}(\text{encode}(x)) == x", font_size=FORMULA_SIZE_SMALL, color=EMERALD).to_edge(DOWN, buff=0.65)
        self.play(Write(asrt), run_time=2.0)
        wait_until(self, 150)
        # 150+: fade the vocab-build row, restate the implementation habits up top
        self.play(FadeOut(VGroup(s, a1, steps, uniq, a2, srt)), run_time=1.0)
        note = fit_label("small inputs · named variables · a visible, checkable output", 12.5, 20, INK_MUTED).to_edge(UP, buff=1.9)
        self.play(FadeIn(note), run_time=1.4)
        self.play(Indicate(asrt, color=EMERALD, scale_factor=1.06), run_time=1.2)
        self.guard(idx, idx_l, enc, dec, asrt, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the common confusions ───────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Don't confuse the label with the object"
    cue_duration = 175.095

    PAIRS = [
        ('a token', 'a word', "'saw' is one piece, not the dictionary word"),
        ('an ID', 'its vector', "44 is an address; the row is the meaning"),
        ('a score', 'a probability', "raw scores are normalized only later"),
        ('a phase', 'the operation', "'tokenize' names a step, not its mechanics"),
    ]

    def construct(self):
        rows = VGroup()
        notes = []
        top = 1.5
        dy = 1.0
        for i, (a, b, note) in enumerate(self.PAIRS):
            y = top - i * dy
            ca = chip(a, ACCENT, w=3.0, h=0.7, fs=22).move_to([-3.4, y, 0])
            neq = MathTex(r"\neq", font_size=40, color=ROSE).move_to([-0.4, y, 0])
            cb = chip(b, VIOLET, w=3.0, h=0.7, fs=22).move_to([2.6, y, 0])
            row = VGroup(ca, neq, cb).set_opacity(0.34)
            rows.add(row)
            notes.append(fit_label(note, 12.0, BODY_SIZE, INK).to_edge(DOWN, buff=0.7))

        title = stage_label("four tempting mix-ups", INK_MUTED).to_edge(UP, buff=2.0)
        self.play(FadeIn(rows), FadeIn(title), run_time=2.6)
        wait_until(self, 14)

        prev_rect = None
        prev_note = None
        # 14-150: reveal each contrast, one at a time (~34s each)
        for i, (a, b, note) in enumerate(self.PAIRS):
            wait_until(self, 14 + i * 34)
            fade = [FadeOut(prev_rect)] if prev_rect else []
            if prev_note:
                fade.append(FadeOut(prev_note))
            self.play(rows[i].animate.set_opacity(1.0), *fade, run_time=1.2)
            rect = SurroundingRectangle(rows[i], color=AMBER, buff=0.14, corner_radius=0.08)
            self.play(Create(rect), FadeIn(notes[i]), run_time=1.2)
            self.play(Indicate(rows[i][1], color=ROSE, scale_factor=1.2), run_time=1.0)
            prev_rect = rect
            prev_note = notes[i]
        wait_until(self, 152)
        # 152+: all four lit — the mental model that won't break
        clear = [FadeOut(prev_rect)] if prev_rect else []
        if prev_note:
            clear.append(FadeOut(prev_note))
        self.play(*clear, *[r.animate.set_opacity(1.0) for r in rows], run_time=1.4)
        recap = fit_label("name the pair, and the mix-up stops being tempting", 12.0, BODY_SIZE, EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(recap), run_time=1.4)
        self.guard(rows, recap, title)
        pace_to(self, self.cue_duration)


# ─── Cue06 : synthesis ───────────────────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Return to the map, then practice"
    cue_duration = 175.094

    PERSPECTIVES = [
        ("Audio", "the route / map", ACCENT),
        ("Visual", "makes it visible", AMBER),
        ("Text", "definitions & examples", VIOLET),
        ("Code", "proves you can use it", EMERALD),
        ("Assess", "checks understanding", ROSE),
    ]

    def construct(self):
        # top: the compact pipeline map, back for the recap
        txt = chip("text", ACCENT_LIGHT, w=1.6, h=0.7, fs=22)
        tok = chip("tokens", VIOLET, w=1.8, h=0.7, fs=22)
        idc = chip("IDs", AMBER, w=1.4, h=0.7, fs=22)
        tbl = chip("table", EMERALD, w=1.7, h=0.7, fs=22)
        pipe = VGroup(txt, tok, idc, tbl).arrange(RIGHT, buff=0.9).move_to([0, 1.7, 0])
        parrows = VGroup(*[
            Arrow(pipe[i].get_right(), pipe[i + 1].get_left(), buff=0.12, color=INK_SUBTLE,
                  stroke_width=3, max_tip_length_to_length_ratio=0.3)
            for i in range(3)
        ])

        # 0-24: the map returns
        self.play(FadeIn(pipe[0]), run_time=1.2)
        for i in range(3):
            self.play(GrowArrow(parrows[i]), FadeIn(pipe[i + 1]), run_time=1.1)
        map_l = stage_label("text → tokens → IDs → a table of numbers", INK_MUTED).next_to(pipe, DOWN, buff=0.35)
        self.play(FadeIn(map_l), run_time=1.4)
        wait_until(self, 28)

        # 28-140: five perspectives on the one idea, lit one at a time. Titles are
        # white (INK) so they read on both the dimmed and the lit state; "lit" is a
        # crisp outline + subtle fill, not a loud solid block.
        cards = VGroup()
        boxes, titles, subs = [], [], []
        for i, (name, sub, color) in enumerate(self.PERSPECTIVES):
            box = RoundedRectangle(width=2.3, height=1.5, corner_radius=0.14,
                                   stroke_color=color, stroke_width=2.6,
                                   fill_color=color, fill_opacity=0.14)
            nm = Text(name, font_size=24, color=INK).move_to(box.get_center() + UP * 0.36)
            sb = fit_label(sub, 2.0, 18, INK).move_to(box.get_center() + DOWN * 0.32)
            boxes.append(box); titles.append(nm); subs.append(sb)
            cards.add(VGroup(box, nm, sb))
        cards.arrange(RIGHT, buff=0.28).move_to([0, -0.9, 0])
        for i in range(len(cards)):
            boxes[i].set_stroke(opacity=0.4).set_fill(opacity=0.05)
            titles[i].set_opacity(0.45)
            subs[i].set_opacity(0.4)

        def light(i):
            return [boxes[i].animate.set_stroke(opacity=1.0).set_fill(opacity=0.16),
                    titles[i].animate.set_opacity(1.0),
                    subs[i].animate.set_opacity(0.85)]

        self.play(FadeIn(cards), run_time=2.0)
        for i in range(len(self.PERSPECTIVES)):
            wait_until(self, 34 + i * 20)
            self.play(*light(i), run_time=1.0)
            self.play(Indicate(boxes[i], color=self.PERSPECTIVES[i][2], scale_factor=1.06), run_time=1.0)
        wait_until(self, 140)
        # 140+: all perspectives lit → explain from every angle
        self.play(*[a for i in range(len(cards)) for a in light(i)], run_time=1.2)
        close = fit_label("explain text-to-tokens from every angle — now practice", 12.5, LABEL_SIZE, EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(close), run_time=1.6)
        self.play(Indicate(pipe, color=ACCENT, scale_factor=1.05), run_time=1.4)
        self.guard(pipe, map_l, cards, close)
        pace_to(self, self.cue_duration)
