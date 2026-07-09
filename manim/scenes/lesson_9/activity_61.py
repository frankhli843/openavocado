"""
Lesson 9 — Part 2 (activity 61): "Rescale to Float + Normalize with Broadcasting"
(380.28s). 3 synced_visual cues, each ~126.8s, rescaled to the real MP3.

  Cue00 0-126.8    Input:    the uint8 (896,896,3) array, values 0..255 — why /255
  Cue01 126.8-253.5 Transform: .astype(float32)/255 -> 0..1, then (arr-mean)/std
                              via length-3 broadcasting
  Cue02 253.5-380.3 Handoff:  normalized float32 array (~zero-mean per channel)

Idioms (imgprep.py): a value-range bar (0..255 -> 0..1 -> ~-2..2), a length-3
stat vector broadcast across every pixel, a pixel grid whose numbers change
dtype. No MathTex; the story is the range/dtype transition.
"""

import imgprep
from imgprep import (
    pixel_grid,
    recolor_pixel,
    range_bar,
    stat_vector,
    shape_tag,
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


# ─── Cue00 : the uint8 input, why floats ─────────────────────────────────────
class Cue00(AvoScene):
    headline = "Pixels arrive as integers 0–255 — models want floats"
    cue_duration = 126.76

    def construct(self):
        # the incoming uint8 grid
        vals = [[0, 64, 128], [191, 255, 32], [96, 160, 224]]
        grid = pixel_grid(vals, cell=0.72, shade=True, fs=22).shift(LEFT * 4.0 + DOWN * 0.2)
        grid_cap = VGroup(
            Text("dtype: uint8", font="monospace", font_size=22, color=ACCENT),
            Text("0 ≤ value ≤ 255", font="monospace", font_size=22, color=INK_MUTED),
        ).arrange(DOWN, buff=0.2).next_to(grid, DOWN, buff=0.35)

        # the uint8 range bar
        bar = range_bar(0, 255, [(0, "0"), (128, "128"), (255, "255")],
                        label="uint8 range", color=ACCENT, width=6.0)
        bar.shift(RIGHT * 3.3 + UP * 1.1)

        # the trap: integer division
        trap = VGroup(
            Text("arr / 255  →  float64  (2× RAM)", font="monospace", font_size=22, color=ROSE),
            Text("astype(float32) / 255  →  float32", font="monospace", font_size=22, color=EMERALD),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.34).shift(RIGHT * 2.7 + DOWN * 1.7)

        # beat 0-30: the uint8 grid
        for r, rowg in enumerate(grid.rows):
            self.play(FadeIn(rowg), run_time=0.7)
        self.play(FadeIn(grid_cap), run_time=1.2)
        wait_until(self, 34)
        # beat 34-64: the range bar
        self.play(Create(bar.line), FadeIn(bar.caption), run_time=1.6)
        for tg in bar.ticks:
            self.play(FadeIn(tg), run_time=0.6)
        self.play(Indicate(bar.caption, color=ACCENT, scale_factor=1.06), run_time=1.0)
        wait_until(self, 78)
        # beat 78-104: the integer-division trap
        self.play(FadeIn(trap[0]), run_time=1.6)
        self.play(Indicate(trap[0], color=ROSE, scale_factor=1.05), run_time=1.2)
        wait_until(self, 104)
        # beat 104+: the fix
        self.play(FadeIn(trap[1]), run_time=1.6)
        self.play(Indicate(trap[1], color=EMERALD, scale_factor=1.05), run_time=1.2)
        self.guard(grid, grid_cap, bar, trap)
        pace_to(self, self.cue_duration)


# ─── Cue01 : rescale + normalize via broadcasting ────────────────────────────
class Cue01(AvoScene):
    headline = "astype(float32) / 255, then (arr − mean) / std"
    cue_duration = 126.76

    def construct(self):
        line1 = Text("arr = arr.astype(np.float32) / 255.0", font="monospace",
                     font_size=25, color=INK).shift(UP * 2.5)
        line2 = Text("arr = (arr - mean) / std", font="monospace",
                     font_size=25, color=INK).next_to(line1, DOWN, buff=0.28)

        # the two range bars: 0..1 (after /255) then normalized — right half only
        bar01 = range_bar(0, 1, [(0, "0.0"), (0.5, "0.5"), (1, "1.0")],
                          label="after / 255  →  float 0…1", color=EMERALD, width=5.2)
        bar01.shift(RIGHT * 2.7 + UP * 0.5)
        barN = range_bar(-2.5, 2.5, [(-2, "−2"), (0, "0"), (2, "+2")],
                         label="after normalize  →  ≈ −2…+2, zero-mean", color=VIOLET, width=5.2)
        barN.shift(RIGHT * 2.7 + DOWN * 1.6)

        # the broadcasting vectors (per-channel mean / std, length 3) — left half
        mean_v = stat_vector([0.485, 0.456, 0.406], "mean", color=AMBER, cell=0.8, fs=20)
        std_v = stat_vector([0.229, 0.224, 0.225], "std", color=AMBER, cell=0.8, fs=20)
        stats = VGroup(mean_v, std_v).arrange(DOWN, aligned_edge=LEFT, buff=0.5)
        stats.shift(LEFT * 3.7 + DOWN * 0.4)
        bcast = fit_label("one length-3 vector applied to all 896×896 pixels = broadcasting",
                          12.5, 20, AMBER).to_edge(DOWN, buff=0.5)

        self.play(Write(line1), run_time=2.0)
        wait_until(self, 12)
        # beat 12-40: /255 → the 0..1 bar
        self.play(Create(bar01.line), FadeIn(bar01.caption), run_time=1.6)
        for tg in bar01.ticks:
            self.play(FadeIn(tg), run_time=0.55)
        self.play(Indicate(bar01.caption, color=EMERALD, scale_factor=1.05), run_time=1.0)
        wait_until(self, 50)
        # beat 50-90: the normalize line + mean/std vectors
        self.play(Write(line2), run_time=1.8)
        self.play(FadeIn(mean_v), run_time=1.4)
        self.play(FadeIn(std_v), run_time=1.4)
        self.play(Indicate(stats, color=AMBER, scale_factor=1.04), run_time=1.2)
        wait_until(self, 96)
        # beat 96-116: the normalized range bar
        self.play(Create(barN.line), FadeIn(barN.caption), run_time=1.6)
        for tg in barN.ticks:
            self.play(FadeIn(tg), run_time=0.55)
        wait_until(self, 116)
        # beat 116+: broadcasting note
        self.play(FadeIn(bcast), run_time=1.4)
        self.play(Indicate(bcast, color=AMBER, scale_factor=1.04), run_time=1.0)
        self.guard(line1, line2, bar01, barN, stats, bcast)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the normalized float array (handoff) ────────────────────────────
class Cue02(AvoScene):
    headline = "Handoff: a float32 array, ≈ zero-mean per channel"
    cue_duration = 126.76

    def construct(self):
        # before/after value comparison for a couple of pixels
        head = VGroup(
            Text("uint8", font="monospace", font_size=24, color=ACCENT),
            Text("→  /255", font="monospace", font_size=24, color=EMERALD),
            Text("→  normalized", font="monospace", font_size=24, color=VIOLET),
        ).arrange(RIGHT, buff=0.7).shift(UP * 2.15)

        rows = VGroup()
        data = [("124", "0.486", "+0.01"), ("255", "1.000", "+2.24"), ("0", "0.000", "−2.12")]
        for u, f, n in data:
            r = VGroup(
                chip(u, ACCENT, w=1.7, h=0.78, fs=24),
                chip(f, EMERALD, w=1.9, h=0.78, fs=24),
                chip(n, VIOLET, w=2.0, h=0.78, fs=24),
            ).arrange(RIGHT, buff=1.05)
            rows.add(r)
        rows.arrange(DOWN, buff=0.32).next_to(head, DOWN, buff=0.45)
        # align columns under headers
        rows.move_to([head.get_center()[0], rows.get_center()[1], 0])

        tag_lab = Text("shape unchanged: (896, 896, 3)  ·  dtype now float32",
                       font="monospace", font_size=22, color=EMERALD)
        bottom = VGroup(tag_lab).to_edge(DOWN, buff=0.6)

        self.play(FadeIn(head), run_time=1.6)
        wait_until(self, 14)
        # beat 14-70: reveal each pixel's journey across the three columns
        for i, r in enumerate(rows):
            self.play(FadeIn(r[0]), run_time=0.9)
            self.play(FadeIn(r[1]), run_time=0.9)
            self.play(FadeIn(r[2]), run_time=0.9)
            self.play(Indicate(r, color=VIOLET, scale_factor=1.03), run_time=0.8)
            wait_until(self, 22 + (i + 1) * 15)
        wait_until(self, 84)
        # beat 84+: the shape/dtype summary — shape same, dtype changed
        self.play(FadeIn(bottom), run_time=1.6)
        self.play(Indicate(tag_lab, color=EMERALD, scale_factor=1.03), run_time=1.2)
        self.guard(head, rows, bottom)
        pace_to(self, self.cue_duration)
