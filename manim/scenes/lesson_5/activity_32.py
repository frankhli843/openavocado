"""
Lesson 5 — Orientation (activity 32): "The LLM Lifecycle: From Raw Text to a
Running Model" (570.55s / 9.5min).

5 Cue<NN> scenes, one per orientation_visual cue (segment_32.json), re-placed to
the real narration (proportional word timing, not the stale 30s placeholders):

  Cue00 0-49     the map: raw text -> running model is seven contracts
  Cue01 49-335   the seven-stage lifecycle ledger, each stage lit as narrated
  Cue02 335-406  tokenization = translation layer + the tokenizer/model contract
  Cue03 406-452  vocabulary size (70 / 32k / 100k / 262,144) + embedding table
  Cue04 452-570.55 build a char tokenizer (encode/decode) + POTTERS memory hook

Long cues (01 = 286s, 04 = 118.55s) stage their reveals across the window via
wait_until(scene, t) so the frame keeps changing with the narration; pace_to
fills the small remainder to hit the exact cue duration. Whatever the narration
is discussing is the lit element (amber focus box / opacity).
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
    FORMULA_SIZE,
    FORMULA_SIZE_SMALL,
    LABEL_SIZE,
    BODY_SIZE,
    fit_to_stage,
)
from pacing import pace_to, elapsed
from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Text,
    MathTex,
    Arrow,
    Line,
    DashedLine,
    Circle,
    Dot,
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


def fit_label(text: str, max_w: float, fs: int, color=INK) -> Text:
    t = Text(text, font_size=fs, color=color)
    if t.width > max_w:
        t.scale(max_w / t.width)
    return t


def doc_glyph(color=ACCENT, w=1.8, h=2.2):
    """A little document: a rounded page with text lines."""
    page = RoundedRectangle(
        width=w, height=h, corner_radius=0.12,
        stroke_color=color, stroke_width=2.2, fill_color=color, fill_opacity=0.08,
    )
    lines = VGroup()
    for i in range(6):
        ln = Line(
            page.get_left() + RIGHT * 0.28 + UP * (0.72 - i * 0.28),
            page.get_right() + LEFT * (0.28 + (0.5 if i % 3 == 2 else 0.0)) + UP * (0.72 - i * 0.28),
            color=INK_MUTED, stroke_width=2.4,
        )
        lines.add(ln)
    return VGroup(page, lines)


def chip(label, color=ACCENT, w=2.5, h=1.1, fs=22):
    box = RoundedRectangle(
        width=w, height=h, corner_radius=0.14,
        stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.12,
    )
    t = fit_label(label, w - 0.3, fs, INK).move_to(box.get_center())
    return VGroup(box, t)


def num_chip(n, color=ACCENT, r=0.26, fs=22):
    c = Circle(radius=r, stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.16)
    t = Text(str(n), font_size=fs, color=INK).move_to(c.get_center())
    return VGroup(c, t)


# ─── Cue00 : the map ─────────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Raw text to a running model is seven contracts"
    cue_duration = 49.0

    def construct(self):
        src, _ = doc_glyph(ACCENT), None
        src = doc_glyph(ACCENT).shift(LEFT * 4.6 + DOWN * 0.2)
        src_l = Text("raw text", font_size=BODY_SIZE, color=ACCENT).next_to(src, DOWN, buff=0.3)

        model = chip("running model", EMERALD, w=3.0, h=1.6, fs=24).shift(RIGHT * 4.6 + DOWN * 0.2)
        model_l = Text("a served assistant", font_size=BODY_SIZE, color=EMERALD).next_to(model, DOWN, buff=0.3)

        spine = Arrow(src.get_right(), model.get_left(), buff=0.35, color=INK_MUTED, stroke_width=5)
        spine_l = Text("7 distinct stages", font_size=BODY_SIZE, color=INK).next_to(spine, UP, buff=0.2)

        # seven tick dots along the spine
        ticks = VGroup()
        for i in range(7):
            x = spine.get_start()[0] + (spine.get_end()[0] - spine.get_start()[0]) * (i + 1) / 8.0
            d = Dot(point=[x, spine.get_start()[1], 0], radius=0.11, color=INK_SUBTLE)
            ticks.add(d)

        note = fit_label(
            "each stage is a contract between what came before and what comes next",
            13.0, LABEL_SIZE, INK_MUTED,
        ).to_edge(DOWN, buff=0.7)

        # beat 0-8: raw text
        self.play(FadeIn(src), Write(src_l), run_time=2.2)
        wait_until(self, 8)
        # beat 8-16: spine + model
        self.play(GrowArrow(spine), FadeIn(spine_l), run_time=1.8)
        self.play(FadeIn(model), Write(model_l), run_time=1.8)
        wait_until(self, 18)
        # beat 18-30: seven ticks light up
        for i, d in enumerate(ticks):
            self.play(d.animate.set_color(AMBER).scale(1.25), run_time=0.5)
        wait_until(self, 32)
        # beat 32+: the contract note
        self.play(FadeIn(note), run_time=1.2)
        self.play(Indicate(spine_l, color=AMBER, scale_factor=1.1), run_time=1.0)
        self.guard(src, src_l, model, model_l, spine, spine_l, ticks, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the seven-stage lifecycle ledger ────────────────────────────────
class Cue01(AvoScene):
    headline = "Seven stages, each a contract"
    cue_duration = 286.0

    # (cue-relative beat time, stage name, "if skipped/broken ->" note)
    BEATS = [
        (0,   "Data",          "duplicated / toxic text is learned faithfully"),
        (41,  "Tokenizer",     "no integer inputs — the model cannot train"),
        (94,  "Architecture",  "too large OOMs; too small underfits"),
        (131, "Training",      "undertrained: plausible-sounding but wrong"),
        (171, "Checkpoint",    "a hardware failure loses weeks of compute"),
        (202, "Quantization",  "too aggressive: output collapses to noise"),
        (248, "Release",       "wrong format or license: no one can use it"),
    ]

    def construct(self):
        rows = VGroup()
        names = []
        notes = []
        n = len(self.BEATS)
        top = 2.15
        dy = 0.62
        for i, (_, name, _note) in enumerate(self.BEATS):
            y = top - i * dy
            nc = num_chip(i + 1, ACCENT).move_to([-6.1, y, 0])
            nm = Text(name, font_size=LABEL_SIZE, color=INK).next_to(nc, RIGHT, buff=0.3)
            row = VGroup(nc, nm).set_opacity(0.32)
            rows.add(row)
            names.append(nm)
            # failure note sits bottom-centered (full width), one visible at a time
            note = fit_label("if skipped  →  " + _note, 12.5, BODY_SIZE, ROSE).to_edge(DOWN, buff=0.7)
            notes.append(note)

        title = Text("raw text", font_size=BODY_SIZE, color=ACCENT).move_to([-6.0, top + 0.55, 0])
        title2 = Text("released model", font_size=BODY_SIZE, color=EMERALD).move_to([2.4, top + 0.55, 0])

        self.play(FadeIn(rows), run_time=3.0)
        self.play(FadeIn(title), FadeIn(title2), run_time=1.4)

        prev_rect = None
        prev_note = None
        for i, (t, name, _note) in enumerate(self.BEATS):
            wait_until(self, t if i > 0 else 5.0)
            anims = [rows[i].animate.set_opacity(1.0)]
            if prev_note is not None:
                anims.append(FadeOut(prev_note))
            self.play(*anims, run_time=1.0)
            rect = SurroundingRectangle(rows[i], color=AMBER, buff=0.12, corner_radius=0.08)
            note = notes[i]
            fade_prev = [FadeOut(prev_rect)] if prev_rect is not None else []
            self.play(*fade_prev, Create(rect), FadeIn(note), run_time=0.9)
            prev_rect = rect
            prev_note = note

        # recap: all stages lit, focus box gone, notes cleared
        wait_until(self, 268)
        clear = [FadeOut(prev_rect)] if prev_rect is not None else []
        if prev_note is not None:
            clear.append(FadeOut(prev_note))
        self.play(*clear, *[r.animate.set_opacity(1.0) for r in rows], run_time=1.4)
        recap = fit_label(
            "Data · Tokenizer · Architecture · Training · Checkpoint · Quantization · Release",
            13.0, BODY_SIZE, INK,
        ).to_edge(DOWN, buff=0.6)
        self.play(Write(recap), run_time=2.2)
        self.play(Indicate(recap, color=ACCENT, scale_factor=1.05), run_time=1.2)
        self.guard(rows, recap)
        pace_to(self, self.cue_duration)


# ─── Cue02 : tokenization = translation + the contract ───────────────────────
class Cue02(AvoScene):
    headline = "The tokenizer/model contract"
    cue_duration = 71.0

    def construct(self):
        word = chip('"hello"', ACCENT, w=2.0, h=1.0, fs=26).shift(LEFT * 5.0 + UP * 0.4)
        tok = chip("tokenizer", AMBER, w=2.2, h=1.0, fs=22).shift(LEFT * 1.4 + UP * 0.4)
        ids = MathTex(r"[\,7,\ 4,\ 11,\ 11,\ 14\,]", font_size=FORMULA_SIZE_SMALL, color=INK).shift(RIGHT * 2.4 + UP * 0.4)
        ids_l = Text("token IDs", font_size=BODY_SIZE, color=INK_MUTED).next_to(ids, UP, buff=0.22)

        a1 = Arrow(word.get_right(), tok.get_left(), buff=0.2, color=INK_MUTED, stroke_width=4)
        a2 = Arrow(tok.get_right(), ids.get_left(), buff=0.25, color=INK_MUTED, stroke_width=4)

        # embedding table directly below the IDs so the connector is vertical
        emb = chip("embedding table", VIOLET, w=3.0, h=1.0, fs=22).move_to([2.4, -1.8, 0])
        a3 = Arrow(ids.get_bottom(), emb.get_top(), buff=0.2, color=INK_MUTED, stroke_width=4)
        vec_l = fit_label("each ID → one learned vector", 4.8, BODY_SIZE, VIOLET).next_to(emb, LEFT, buff=0.5)

        # 0-15: build the translation pipeline
        self.play(FadeIn(word), run_time=1.6)
        self.play(GrowArrow(a1), FadeIn(tok), run_time=1.4)
        self.play(GrowArrow(a2), Write(ids), FadeIn(ids_l), run_time=1.8)
        wait_until(self, 12)
        self.play(GrowArrow(a3), FadeIn(emb), run_time=1.4)
        self.play(FadeIn(vec_l), run_time=1.2)
        wait_until(self, 26)
        # 26-62: the contract — a lock between an ID and its vector
        lock = SurroundingRectangle(VGroup(ids, emb), color=EMERALD, buff=0.3, corner_radius=0.12)
        contract = fit_label("fixed-vocabulary contract: trained together", 7.5, LABEL_SIZE, EMERALD).to_edge(UP, buff=1.9)
        self.play(Create(lock), FadeIn(contract), run_time=1.5)
        self.play(Indicate(ids, color=EMERALD, scale_factor=1.15), run_time=1.2)
        wait_until(self, 50)
        self.play(Indicate(emb, color=EMERALD, scale_factor=1.08), run_time=1.2)
        wait_until(self, 62)
        # 62-71: silent bug — swap tokenizer, same text, wrong ID, garbage out
        self.play(FadeOut(lock), FadeOut(contract), run_time=0.6)
        bad = fit_label('swap the tokenizer  →  "hello" now maps to  [ 88, 3, 51, ... ]', 12.0, BODY_SIZE, ROSE).to_edge(UP, buff=1.9)
        garbage = Text("output: silent garbage (no error thrown)", font_size=LABEL_SIZE, color=ROSE).to_edge(DOWN, buff=0.7)
        self.play(FadeIn(bad), run_time=1.2)
        self.play(word[0].animate.set_stroke(ROSE), FadeIn(garbage), run_time=1.2)
        self.play(Indicate(garbage, color=ROSE, scale_factor=1.08), run_time=1.0)
        self.guard(word, tok, ids, ids_l, emb, garbage)
        pace_to(self, self.cue_duration)


# ─── Cue03 : vocabulary size + embedding table ───────────────────────────────
class Cue03(AvoScene):
    headline = "Vocabulary size sets the embedding table"
    cue_duration = 46.0

    ROWS = [
        ("character", 70, ACCENT_LIGHT),
        ("LLaMA (BPE)", 32000, ACCENT),
        ("GPT-4", 100000, AMBER),
        ("Gemma 4", 262144, EMERALD),
    ]

    def construct(self):
        import math
        max_log = math.log10(262144)
        bar_x0 = -3.1
        max_w = 6.9
        bars = VGroup()
        labels = VGroup()
        counts = VGroup()
        top = 1.9
        dy = 0.9
        for i, (name, size, color) in enumerate(self.ROWS):
            y = top - i * dy
            w = max_w * (math.log10(size) / max_log)
            bar = Rectangle(width=w, height=0.5, stroke_width=0, fill_color=color, fill_opacity=0.75)
            bar.move_to([bar_x0 + w / 2, y, 0])
            nm = fit_label(name, 2.9, 22, INK).next_to(bar, LEFT, buff=0.25)
            cnt = fit_label(f"{size:,}", 2.0, 22, color).next_to(bar, RIGHT, buff=0.2)
            bars.add(bar); labels.add(nm); counts.add(cnt)

        # 0-33: reveal the four vocab bars one by one
        for i in range(len(self.ROWS)):
            self.play(FadeIn(labels[i]), run_time=0.5)
            self.play(Create(bars[i]), FadeIn(counts[i]), run_time=1.4)
            self.wait(1.2)
        wait_until(self, 30)
        # 33-46: embedding table math
        emb = MathTex(
            r"262{,}144 \times 4096 \approx 1.07\text{B params}",
            font_size=FORMULA_SIZE_SMALL, color=INK,
        ).to_edge(DOWN, buff=0.85)
        emb_l = Text("just the token embedding table", font_size=BODY_SIZE, color=INK_MUTED).next_to(emb, UP, buff=0.25)
        self.play(FadeIn(emb_l), Write(emb), run_time=2.0)
        self.play(Indicate(emb, color=EMERALD, scale_factor=1.08), run_time=1.2)
        self.guard(bars, labels, counts, emb, emb_l)
        pace_to(self, self.cue_duration)


# ─── Cue04 : build a char tokenizer + POTTERS ────────────────────────────────
class Cue04(AvoScene):
    headline = "Collect, sort, index — encode & decode"
    cue_duration = 118.55

    def construct(self):
        # top: the string -> unique -> sorted -> indexed pipeline
        s = MathTex(r"\texttt{'avocado'}", font_size=FORMULA_SIZE_SMALL, color=ACCENT).move_to([-4.8, 2.0, 0])
        uniq = MathTex(r"\{a,v,o,c,d\}", font_size=FORMULA_SIZE_SMALL, color=INK).move_to([-1.2, 2.0, 0])
        srt = MathTex(r"[a,c,d,o,v]", font_size=FORMULA_SIZE_SMALL, color=INK).move_to([2.4, 2.0, 0])
        a1 = Arrow(s.get_right(), uniq.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3)
        a2 = Arrow(uniq.get_right(), srt.get_left(), buff=0.2, color=INK_MUTED, stroke_width=3)
        step_l = VGroup(
            Text("collect unique", font_size=20, color=INK_MUTED).next_to(a1, UP, buff=0.12),
            Text("sort", font_size=20, color=INK_MUTED).next_to(a2, UP, buff=0.12),
        )

        # index table a:0 c:1 d:2 o:3 v:4
        idx = VGroup()
        chars = ["a", "c", "d", "o", "v"]
        for i, ch in enumerate(chars):
            cell = VGroup(
                Text(ch, font_size=24, color=INK),
                Text(str(i), font_size=22, color=EMERALD),
            ).arrange(DOWN, buff=0.12)
            cell.move_to([-4.6 + i * 1.15, 0.55, 0])
            idx.add(cell)
        idx_l = Text("char → index", font_size=BODY_SIZE, color=INK_MUTED).next_to(idx, LEFT, buff=0.4).set_x(-6.0, RIGHT)
        idx_l.next_to(idx, DOWN, buff=0.25)

        enc = MathTex(r"\text{encode}(\texttt{'cad'}) = [1,0,2]", font_size=FORMULA_SIZE_SMALL, color=ACCENT).move_to([-0.2, -1.4, 0])
        dec = MathTex(r"\text{decode}([1,0,2]) = \texttt{'cad'}", font_size=FORMULA_SIZE_SMALL, color=AMBER).move_to([-0.2, -2.2, 0])

        # 0-22: build the char-tokenizer pipeline
        self.play(Write(s), run_time=1.6)
        self.play(GrowArrow(a1), FadeIn(step_l[0]), Write(uniq), run_time=1.6)
        self.play(GrowArrow(a2), FadeIn(step_l[1]), Write(srt), run_time=1.6)
        wait_until(self, 8)
        self.play(FadeIn(idx), FadeIn(idx_l), run_time=2.0)
        wait_until(self, 16)
        self.play(Write(enc), run_time=1.6)
        self.play(Write(dec), run_time=1.6)
        # 22-38: highlight reversibility
        wait_until(self, 24)
        self.play(Indicate(enc, color=ACCENT, scale_factor=1.08), run_time=1.1)
        self.play(Indicate(dec, color=AMBER, scale_factor=1.08), run_time=1.1)
        rev = Text("encode and decode are exact inverses", font_size=BODY_SIZE, color=EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(rev), run_time=1.2)
        wait_until(self, 40)
        # 40-99: why start here — clear the diagram entirely, then show the note
        diagram = VGroup(s, uniq, srt, a1, a2, step_l, idx, idx_l, enc, dec, rev)
        self.play(FadeOut(diagram), run_time=1.2)
        why = fit_label(
            "the Gemma team needs pipeline fluency, not a from-scratch 70B model",
            12.5, LABEL_SIZE, INK,
        ).move_to([0, 0.4, 0])
        self.play(FadeIn(why), run_time=1.5)
        wait_until(self, 70)
        self.play(Indicate(why, color=ACCENT, scale_factor=1.05), run_time=1.2)
        wait_until(self, 99)
        # 99-118.55: POTTERS memory hook
        self.play(FadeOut(why), run_time=0.8)
        letters = ["P", "O", "T", "T", "E", "R", "S"]
        wordsp = ["Plan", "Organize", "Tokenize", "Train", "Evaluate", "Reduce", "Serve"]
        pot = VGroup()
        for i, (L, w) in enumerate(zip(letters, wordsp)):
            col = theme.CATEGORICAL[i % len(theme.CATEGORICAL)]
            cell = VGroup(
                Text(L, font_size=40, color=col),
                Text(w, font_size=18, color=INK_MUTED),
            ).arrange(DOWN, buff=0.14)
            cell.move_to([-5.4 + i * 1.8, 0.3, 0])
            pot.add(cell)
        pot_title = Text("POTTERS — the lifecycle in one word", font_size=BODY_SIZE, color=INK).next_to(pot, DOWN, buff=0.6)
        for cell in pot:
            self.play(FadeIn(cell, shift=UP * 0.15), run_time=0.6)
        self.play(FadeIn(pot_title), run_time=1.2)
        self.play(Indicate(pot, color=AMBER, scale_factor=1.05), run_time=1.4)
        self.guard(pot, pot_title)
        pace_to(self, self.cue_duration)
