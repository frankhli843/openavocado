"""
Lesson 9 — Orientation (activity 59): "Seven Lines of Code — The Complete
Pipeline" (1008.07s / 16.8min). 7 orientation_visual cues, each ~144s, rescaled
to the real MP3.

The generic orientation route (locate / analogy / tiny-example / mechanism /
implementation / misconception / synthesis) is grounded to THIS lesson: the
seven-line PIL+NumPy preprocessing pipeline that turns a raw image file into a
model-ready (1, 3, 896, 896) float tensor.

  Cue00 High-level map   raw photo -> model-ready tensor is exactly 7 lines
  Cue01 Analogy          a 7-station assembly line, each does one job
  Cue02 Tiny example     follow one tiny image; shape/dtype/range at each step
  Cue03 Mechanism        the 3 axes that change — shape, dtype, range — and why
  Cue04 Implementation   the 7 real lines, lit one at a time + how to test
  Cue05 Misconception    the traps: (W,H) order, int÷int, normalize-before-permute
  Cue06 Synthesis        recap the 7 stations -> (1,3,896,896); code it yourself

Long cues stage reveals via wait_until(scene, t); pace_to fills the remainder to
the exact cue duration. Whatever the narration discusses is the lit element.
No MathTex (this lesson has no formulas).
"""

import imgprep
from imgprep import (
    pixel_grid,
    channel_stack,
    shape_tag,
    code_block,
    stage_arrow,
    chip,
    fit_label,
)
from theme import (
    AvoScene,
    ACCENT,
    ACCENT_LIGHT,
    AMBER,
    EMERALD,
    ROSE,
    VIOLET,
    INK,
    INK_MUTED,
    INK_SUBTLE,
    LABEL_SIZE,
    BODY_SIZE,
    fit_to_stage,
)
from pacing import pace_to, elapsed
from manim import (
    VGroup,
    Text,
    RoundedRectangle,
    Arrow,
    Line,
    Dot,
    SurroundingRectangle,
    FadeIn,
    FadeOut,
    Write,
    Create,
    GrowArrow,
    Transform,
    ReplacementTransform,
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


# the seven lines of the pipeline (canonical form)
SEVEN = [
    'img = Image.open("cat.jpg")',
    "img = img.resize((896,896), Image.LANCZOS)",
    "arr = np.asarray(img)",
    "arr = arr.astype(np.float32) / 255.0",
    "arr = (arr - mean) / std",
    "arr = arr.transpose(2, 0, 1)",
    "arr = arr[None, ...]",
]

# the seven stations (short name, one-line job)
STATIONS = [
    ("open", "read file → PIL image"),
    ("resize", "→ fixed 896×896"),
    ("to array", "→ uint8 (H,W,C)"),
    ("to float", "→ float32 0…1"),
    ("normalize", "→ zero-mean per channel"),
    ("permute", "→ CHW channels-first"),
    ("batch", "→ (1,3,896,896)"),
]


# ─── Cue00 : the map — raw photo to tensor in 7 lines ────────────────────────
class Cue00(AvoScene):
    headline = "A raw photo becomes a model-ready tensor in seven lines"
    cue_duration = 144.5

    def construct(self):
        src = chip("cat.jpg", ACCENT, w=2.4, h=1.5, fs=26).shift(LEFT * 5.0 + UP * 0.2)
        src_l = Text("raw image file", font_size=20, color=ACCENT).next_to(src, DOWN, buff=0.25)

        dst = shape_tag([1, 3, 896, 896], labels=["N", "C", "H", "W"]).scale(0.5)
        dst.shift(RIGHT * 4.7 + UP * 0.2)
        dst_l = Text("model-ready tensor", font_size=20, color=EMERALD).next_to(dst, DOWN, buff=0.3)

        spine = Arrow(src.get_right(), dst.get_left(), buff=0.35, color=INK_MUTED, stroke_width=5)

        # seven ticks along the spine
        ticks = VGroup()
        for i in range(7):
            x = spine.get_start()[0] + (spine.get_end()[0] - spine.get_start()[0]) * (i + 1) / 8.0
            d = Dot(point=[x, spine.get_start()[1], 0], radius=0.10, color=INK_SUBTLE)
            ticks.add(d)
        spine_l = Text("7 steps", font_size=22, color=INK).next_to(spine, UP, buff=0.25)

        note = fit_label("no magic library call — just PIL and NumPy, one line at a time",
                         12.5, LABEL_SIZE, INK_MUTED).to_edge(DOWN, buff=0.7)

        self.play(FadeIn(src), Write(src_l), run_time=2.0)
        wait_until(self, 14)
        self.play(GrowArrow(spine), FadeIn(spine_l), run_time=1.8)
        self.play(FadeIn(dst), Write(dst_l), run_time=2.0)
        wait_until(self, 40)
        # the seven ticks light up
        for d in ticks:
            self.play(d.animate.set_color(AMBER).scale(1.3), run_time=0.7)
        wait_until(self, 70)
        self.play(Indicate(spine_l, color=AMBER, scale_factor=1.1), run_time=1.2)
        wait_until(self, 96)
        self.play(FadeIn(note), run_time=1.6)
        self.play(Indicate(note, color=ACCENT, scale_factor=1.03), run_time=1.2)
        self.guard(src, src_l, dst, dst_l, spine, ticks, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the analogy — a 7-station assembly line ─────────────────────────
class Cue01(AvoScene):
    headline = "Think of it as a 7-station assembly line"
    cue_duration = 143.4

    def construct(self):
        # two rows of station chips (4 + 3) so they fit the frame
        chips = []
        for name, job in STATIONS:
            c = chip(name, ACCENT, w=2.7, h=1.0, fs=24).set_opacity(0.32)
            chips.append(c)
        top = VGroup(*chips[:4]).arrange(RIGHT, buff=0.5).shift(UP * 1.5)
        bot = VGroup(*chips[4:]).arrange(RIGHT, buff=0.5).shift(DOWN * 0.4)
        # connective arrows within each row
        arrows = VGroup()
        for row in (chips[:4], chips[4:]):
            for a, b in zip(row, row[1:]):
                arrows.add(Arrow(a.get_right(), b.get_left(), buff=0.12,
                                 color=INK_SUBTLE, stroke_width=3))

        job_note = fit_label("", 12.5, BODY_SIZE, INK).to_edge(DOWN, buff=0.7)

        self.play(FadeIn(VGroup(*chips)), FadeIn(arrows), run_time=2.6)
        wait_until(self, 12)
        # each station lights in turn with its one-line job below
        prev_note = None
        for i, (name, job) in enumerate(STATIONS):
            wait_until(self, 12 + i * 17)
            anims = [chips[i].animate.set_opacity(1.0)]
            if prev_note is not None:
                anims.append(FadeOut(prev_note))
            self.play(*anims, run_time=0.9)
            note = fit_label(f"{name}:  {job}", 12.0, BODY_SIZE, AMBER).to_edge(DOWN, buff=0.7)
            box = SurroundingRectangle(chips[i], color=AMBER, buff=0.10, corner_radius=0.10)
            self.play(Create(box), FadeIn(note), run_time=0.9)
            self.play(FadeOut(box), run_time=0.5)
            prev_note = note
        wait_until(self, 132)
        if prev_note is not None:
            self.play(FadeOut(prev_note), run_time=0.8)
        self.play(*[c.animate.set_opacity(1.0) for c in chips], run_time=1.2)
        close = fit_label("each station does exactly one job, then hands off",
                          12.0, BODY_SIZE, INK).to_edge(DOWN, buff=0.7)
        self.play(FadeIn(close), run_time=1.4)
        self.guard(VGroup(*chips), arrows, close)
        pace_to(self, self.cue_duration)


# ─── Cue02 : tiny example — one image through all 7 steps ────────────────────
class Cue02(AvoScene):
    headline = "Follow one tiny image through every step"
    cue_duration = 144.5

    STEPS = [
        ("Image.open", "(W,H)=(2,2)", "PIL img", ACCENT),
        ("resize", "(896,896)", "PIL img", ACCENT),
        ("np.asarray", "(896,896,3)", "uint8", EMERALD),
        ("/255", "(896,896,3)", "float32 0..1", EMERALD),
        ("normalize", "(896,896,3)", "float32 ~-2..2", VIOLET),
        ("transpose", "(3,896,896)", "float32", VIOLET),
        ("[None]", "(1,3,896,896)", "float32", EMERALD),
    ]

    def construct(self):
        # header row
        hdr = VGroup(
            Text("step", font_size=22, color=INK_MUTED),
            Text("shape", font_size=22, color=INK_MUTED),
            Text("dtype / range", font_size=22, color=INK_MUTED),
        )
        hdr[0].move_to([-5.0, 2.5, 0])
        hdr[1].move_to([-0.6, 2.5, 0])
        hdr[2].move_to([4.4, 2.5, 0])

        rows = []
        y0 = 1.8
        dy = 0.62
        for i, (step, shape, dt, col) in enumerate(self.STEPS):
            y = y0 - i * dy
            s = Text(step, font="monospace", font_size=22, color=INK).move_to([-5.0, y, 0], aligned_edge=LEFT)
            s.move_to([-6.4, y, 0]).align_to(hdr[0], LEFT).shift(LEFT * 1.0)
            sh = Text(shape, font="monospace", font_size=22, color=col).move_to([-0.6, y, 0])
            d = Text(dt, font="monospace", font_size=22, color=col).move_to([4.4, y, 0])
            row = VGroup(s, sh, d).set_opacity(0.30)
            rows.append(row)

        self.play(FadeIn(hdr), run_time=1.6)
        wait_until(self, 8)
        prev_box = None
        for i, row in enumerate(rows):
            wait_until(self, 8 + i * 17)
            self.play(row.animate.set_opacity(1.0), run_time=0.9)
            box = SurroundingRectangle(row, color=AMBER, buff=0.10, corner_radius=0.06)
            fade = [FadeOut(prev_box)] if prev_box is not None else []
            self.play(*fade, Create(box), run_time=0.9)
            prev_box = box
        wait_until(self, 130)
        clear = [FadeOut(prev_box)] if prev_box is not None else []
        self.play(*clear, *[r.animate.set_opacity(1.0) for r in rows], run_time=1.4)
        close = fit_label("watch the shape, dtype, and range change at every row",
                          12.5, BODY_SIZE, EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(close), run_time=1.4)
        self.guard(hdr, VGroup(*rows), close)
        pace_to(self, self.cue_duration)


# ─── Cue03 : mechanism — the 3 axes that change ──────────────────────────────
class Cue03(AvoScene):
    headline = "Three things change: shape, dtype, range"
    cue_duration = 143.4

    AXES = [
        ("shape", "(H,W,C) → (C,H,W) → (1,C,H,W)",
         "the model demands a fixed, channels-first, batched layout", AMBER),
        ("dtype", "uint8 → float32",
         "gradients need real numbers, not 0–255 integers", ACCENT),
        ("range", "0…255 → 0…1 → normalized",
         "zero-mean inputs make training stable and fast", VIOLET),
    ]

    def construct(self):
        cards = []
        change_texts = []
        for name, change, why, col in self.AXES:
            box = RoundedRectangle(width=11.0, height=1.5, corner_radius=0.16,
                                   stroke_color=col, stroke_width=2.6,
                                   fill_color=col, fill_opacity=0.10)
            title = Text(name, font_size=28, color=col, weight="BOLD").move_to(box.get_left() + RIGHT * 1.3)
            chg = Text(change, font="monospace", font_size=22, color=INK).move_to(box.get_center() + UP * 0.28 + RIGHT * 1.2)
            why_t = fit_label(why, 8.4, 20, INK_MUTED).move_to(box.get_center() + DOWN * 0.32 + RIGHT * 1.2)
            card = VGroup(box, title, chg, why_t)
            cards.append(card)
            change_texts.append(chg)
        stack = VGroup(*cards).arrange(DOWN, buff=0.4).move_to(DOWN * 0.1)

        # reveal all three at a subtle fill, then LIGHT each in turn with a box
        self.play(FadeIn(stack), run_time=2.4)
        wait_until(self, 12)
        prev_box = None
        for i, card in enumerate(cards):
            wait_until(self, 12 + i * 38)
            box = SurroundingRectangle(card, color=self.AXES[i][3], buff=0.12, corner_radius=0.16)
            box.set_stroke(width=4.0)
            fade = [FadeOut(prev_box)] if prev_box is not None else []
            self.play(*fade, Create(box), run_time=1.0)
            self.play(Indicate(change_texts[i], color=self.AXES[i][3], scale_factor=1.06), run_time=1.2)
            prev_box = box
        wait_until(self, 132)
        clear = [FadeOut(prev_box)] if prev_box is not None else []
        self.play(*clear, run_time=1.0)
        self.guard(stack)
        pace_to(self, self.cue_duration)


# ─── Cue04 : implementation — the 7 real lines + tests ───────────────────────
class Cue04(AvoScene):
    headline = "The seven lines, and how to test them"
    cue_duration = 144.5

    def construct(self):
        block = code_block(SEVEN, fs=23, gap=0.30, num=True)
        fit_to_stage(block, width_frac=0.92, height_frac=0.78)
        block.shift(LEFT * 1.4 + UP * 0.2)

        self.play(FadeIn(block), run_time=2.4)
        wait_until(self, 10)
        # light each line one at a time
        prev_box = None
        for i, ln in enumerate(block.lines):
            wait_until(self, 10 + i * 13)
            self.play(ln.animate.set_color(INK), run_time=0.6)
            box = block.lit(i, boxcolor=AMBER)
            fade = [FadeOut(prev_box)] if prev_box is not None else []
            self.play(*fade, Create(box), run_time=0.8)
            prev_box = box
        wait_until(self, 104)
        clear = [FadeOut(prev_box)] if prev_box is not None else []
        self.play(*clear, run_time=0.6)
        # the tests
        tests = VGroup(
            Text("assert arr.shape == (1, 3, 896, 896)", font="monospace", font_size=22, color=EMERALD),
            Text("assert arr.dtype == np.float32", font="monospace", font_size=22, color=EMERALD),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(tests), run_time=1.8)
        self.play(Indicate(tests, color=EMERALD, scale_factor=1.03), run_time=1.4)
        self.guard(block, tests)
        pace_to(self, self.cue_duration)


# ─── Cue05 : misconceptions — the nearby traps ───────────────────────────────
class Cue05(AvoScene):
    headline = "Separate the traps that look almost right"
    cue_duration = 143.4

    TRAPS = [
        ("PIL .size and resize use (W, H)", "not (H, W) — easy to swap by accident", ROSE),
        ("arr / 255 without astype = float64", "cast to float32 first, or you waste 2× memory", ROSE),
        ("normalize BEFORE permute", "mean/std are per-channel; keep C last until then", AMBER),
        ("channels-first vs channels-last", "NumPy=HWC, PyTorch=CHW — transpose bridges them", AMBER),
    ]

    def construct(self):
        rows = []
        for bad, fix, col in self.TRAPS:
            b = fit_label("⚠  " + bad, 12.0, 24, col, weight="BOLD")
            f = fit_label(fix, 12.0, 20, INK_MUTED)
            row = VGroup(b, f).arrange(DOWN, aligned_edge=LEFT, buff=0.14).set_opacity(0.3)
            rows.append(row)
        stack = VGroup(*rows).arrange(DOWN, aligned_edge=LEFT, buff=0.6).move_to(DOWN * 0.1)

        self.play(FadeIn(stack), run_time=2.2)
        wait_until(self, 10)
        prev_box = None
        for i, row in enumerate(rows):
            wait_until(self, 10 + i * 28)
            self.play(row.animate.set_opacity(1.0), run_time=1.0)
            box = SurroundingRectangle(row, color=self.TRAPS[i][2], buff=0.12, corner_radius=0.08)
            fade = [FadeOut(prev_box)] if prev_box is not None else []
            self.play(*fade, Create(box), run_time=0.9)
            prev_box = box
        wait_until(self, 128)
        clear = [FadeOut(prev_box)] if prev_box is not None else []
        self.play(*clear, *[r.animate.set_opacity(1.0) for r in rows], run_time=1.2)
        self.guard(stack)
        pace_to(self, self.cue_duration)


# ─── Cue06 : synthesis — recap + prepare practice ────────────────────────────
class Cue06(AvoScene):
    headline = "Seven stations, one tensor — now code it yourself"
    cue_duration = 144.57

    def construct(self):
        # the seven station names in a single ribbon
        names = [s[0] for s in STATIONS]
        ribbon = VGroup()
        for nm in names:
            ribbon.add(chip(nm, ACCENT, w=2.3, h=0.85, fs=22).set_opacity(0.35))
        top = VGroup(*ribbon[:4]).arrange(RIGHT, buff=0.35).shift(UP * 1.7)
        bot = VGroup(*ribbon[4:]).arrange(RIGHT, buff=0.35).shift(UP * 0.4)

        dst = shape_tag([1, 3, 896, 896], labels=["N", "C", "H", "W"]).scale(0.62)
        dst.shift(DOWN * 1.5)
        dst_l = Text("the finished tensor", font_size=20, color=EMERALD).next_to(dst, DOWN, buff=0.3)

        self.play(FadeIn(VGroup(*ribbon)), run_time=2.2)
        wait_until(self, 12)
        # light all seven in a quick sweep
        for i, c in enumerate(ribbon):
            wait_until(self, 12 + i * 9)
            self.play(c.animate.set_opacity(1.0), run_time=0.5)
            self.play(Indicate(c, color=AMBER, scale_factor=1.06), run_time=0.5)
        wait_until(self, 84)
        self.play(FadeIn(dst), FadeIn(dst_l), run_time=1.8)
        self.play(Indicate(dst, color=EMERALD, scale_factor=1.05), run_time=1.2)
        wait_until(self, 116)
        close = fit_label("open → resize → array → float → normalize → permute → batch",
                          13.0, BODY_SIZE, INK).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(close), run_time=1.8)
        self.play(Indicate(close, color=ACCENT, scale_factor=1.03), run_time=1.2)
        self.guard(VGroup(*ribbon), dst, dst_l, close)
        pace_to(self, self.cue_duration)
