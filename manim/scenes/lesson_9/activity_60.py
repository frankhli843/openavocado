"""
Lesson 9 — Part 1 (activity 60): "Opening, Inspecting, and Resizing in PIL"
(420.43s). 3 synced_visual cues, each ~140s, rescaled to the real MP3.

  Cue00 0-140.1    Input:    Image.open + inspect .size (W,H) / .mode ("RGB")
  Cue01 140.1-280.3 Transform: img.resize((896,896)) — PIL takes (W,H), resample
  Cue02 280.3-420.4 Handoff:  np.asarray(img) -> uint8 array, shape (896,896,3) HWC

Image-preprocessing visual vocabulary (imgprep.py): a pixel grid the size/shape
of which changes, a 3-plane RGB channel stack, and a tensor-shape tag. NOT the
transformer/bayes idioms. No MathTex (this lesson has no formulas); the story is
shape + dtype transitions, so the grid and shape tag carry it.
"""

import imgprep
from imgprep import (
    pixel_grid,
    recolor_pixel,
    channel_stack,
    shape_tag,
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


# a small "photo" of pixel values — one channel shown, values 0..255
PHOTO = [
    [ 12,  40,  90, 160],
    [ 30,  80, 140, 210],
    [ 55, 120, 190, 240],
    [ 90, 170, 225, 255],
]


# ─── Cue00 : open + inspect ──────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Image.open — a picture becomes a grid of pixels"
    cue_duration = 140.144

    def construct(self):
        # left: the file → PIL Image object
        file_box = chip("cat.jpg", ACCENT, w=2.5, h=1.1, fs=26).shift(LEFT * 4.9 + UP * 1.7)
        file_cap = Text("a file on disk", font_size=20, color=INK_MUTED).next_to(file_box, DOWN, buff=0.2)

        code = Text('img = Image.open("cat.jpg")', font="monospace",
                    font_size=26, color=INK).shift(UP * 2.55)

        # the image as a grid of pixels (one channel shown, shaded by brightness)
        grid = pixel_grid(PHOTO, cell=0.66, shade=True, fs=20)
        grid.shift(DOWN * 0.4 + LEFT * 1.4)
        grid_cap = Text("each cell = one pixel's brightness (0–255)",
                        font_size=20, color=INK_MUTED).next_to(grid, DOWN, buff=0.3)

        # right: inspect .size and .mode
        insp = VGroup(
            Text(".size  →  (4, 4)", font="monospace", font_size=24, color=EMERALD),
            Text(".mode  →  \"RGB\"", font="monospace", font_size=24, color=ACCENT),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.5).shift(RIGHT * 3.7 + DOWN * 0.2)
        size_note = fit_label("PIL .size is (Width, Height) — not (H, W)!",
                              4.6, 20, AMBER).next_to(insp, DOWN, buff=0.5)

        # beat 0-10: the code line + file
        self.play(Write(code), run_time=2.0)
        self.play(FadeIn(file_box), FadeIn(file_cap), run_time=1.6)
        wait_until(self, 16)
        # beat 16-40: the pixel grid appears cell by cell (row by row)
        self.play(Indicate(code, color=ACCENT, scale_factor=1.03), run_time=1.2)
        for r, rowg in enumerate(grid.rows):
            self.play(FadeIn(rowg), run_time=0.7)
        self.play(FadeIn(grid_cap), run_time=1.0)
        wait_until(self, 58)
        # beat 58-92: inspect .size then .mode
        self.play(FadeIn(insp[0]), run_time=1.4)
        self.play(Indicate(insp[0], color=EMERALD, scale_factor=1.06), run_time=1.0)
        wait_until(self, 78)
        self.play(FadeIn(insp[1]), run_time=1.4)
        self.play(Indicate(insp[1], color=ACCENT, scale_factor=1.06), run_time=1.0)
        wait_until(self, 100)
        # beat 100+: the (W,H) misconception warning
        self.play(FadeIn(size_note), run_time=1.4)
        self.play(Indicate(size_note, color=AMBER, scale_factor=1.05), run_time=1.2)
        self.guard(code, file_box, grid, grid_cap, insp, size_note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : resize ──────────────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "img.resize((896, 896)) — a fixed grid the model expects"
    cue_duration = 140.144

    def construct(self):
        code = Text("img = img.resize((896,896), Image.LANCZOS)", font="monospace",
                    font_size=25, color=INK).shift(UP * 2.55)

        # before: the original grid (4x4 stand-in for 1080x1920)
        before = pixel_grid(PHOTO, cell=0.6, shade=True, fs=18).shift(LEFT * 4.3 + DOWN * 0.3)
        before_cap = VGroup(
            Text("before", font_size=22, color=INK_MUTED),
            Text("(1920, 1080)", font="monospace", font_size=22, color=ACCENT),
        ).arrange(DOWN, buff=0.14).next_to(before, DOWN, buff=0.3)

        arrow = Arrow(before.get_right() + RIGHT * 0.2, before.get_right() + RIGHT * 2.1,
                      buff=0.1, color=INK_MUTED, stroke_width=6)
        arrow_lab = Text("LANCZOS", font_size=20, color=INK_MUTED).next_to(arrow, UP, buff=0.15)

        # after: a denser but fixed-size grid (5x5 stand-in for 896x896)
        after_vals = [[(i * 5 + j) * 10 % 256 for j in range(5)] for i in range(5)]
        after = pixel_grid(after_vals, cell=0.5, shade=True, show_values=False)
        after.shift(RIGHT * 4.1 + DOWN * 0.3)
        after_cap = VGroup(
            Text("after", font_size=22, color=EMERALD),
            Text("(896, 896)", font="monospace", font_size=22, color=EMERALD),
        ).arrange(DOWN, buff=0.14).next_to(after, DOWN, buff=0.3)

        note = fit_label("resize takes (Width, Height) — same (W,H) order as .size",
                         11.0, 22, AMBER).to_edge(DOWN, buff=0.55)

        self.play(Write(code), run_time=2.2)
        wait_until(self, 12)
        # beat 12-40: the before grid
        self.play(FadeIn(before), FadeIn(before_cap), run_time=1.8)
        self.play(Indicate(before, color=ACCENT, scale_factor=1.03), run_time=1.2)
        wait_until(self, 46)
        # beat 46-84: the resample arrow → after grid grows in
        self.play(GrowArrow(arrow), FadeIn(arrow_lab), run_time=1.6)
        self.play(FadeIn(after), FadeIn(after_cap), run_time=2.0)
        self.play(Indicate(after, color=EMERALD, scale_factor=1.04), run_time=1.2)
        wait_until(self, 104)
        # beat 104+: the (W,H) order note
        self.play(FadeIn(note), run_time=1.6)
        self.play(Indicate(note, color=AMBER, scale_factor=1.04), run_time=1.2)
        self.guard(code, before, after, arrow, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : to numpy array (handoff) ────────────────────────────────────────
class Cue02(AvoScene):
    headline = "np.asarray(img) — a uint8 array, shape (896, 896, 3)"
    cue_duration = 140.144

    def construct(self):
        code = Text("arr = np.asarray(img)", font="monospace",
                    font_size=28, color=INK).shift(UP * 2.55)

        # the 3-plane RGB channel stack (color image = H x W x 3)
        stack = channel_stack(nrows=4, ncols=4, cell=0.4).shift(LEFT * 3.6 + DOWN * 0.3)
        stack_cap = fit_label("a color image = Height × Width × 3 channels",
                              6.0, 20, INK_MUTED).next_to(stack, DOWN, buff=0.5)

        # the resulting shape tag
        tag = shape_tag([896, 896, 3], labels=["H", "W", "C"]).scale(0.9)
        tag.shift(RIGHT * 3.9 + UP * 0.5)
        tag_cap = VGroup(
            Text("dtype: uint8", font="monospace", font_size=22, color=ACCENT),
            Text("values: 0 … 255", font="monospace", font_size=22, color=INK_MUTED),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3).next_to(tag, DOWN, buff=0.6)

        note = fit_label("this is the layout NumPy hands to Part 2: H, W, C — channels last",
                         12.0, 20, EMERALD).to_edge(DOWN, buff=0.55)

        self.play(Write(code), run_time=2.2)
        wait_until(self, 12)
        # beat 12-52: the channel stack builds R, G, B
        for k, plane in enumerate(stack.planes):
            self.play(FadeIn(plane), FadeIn(stack.labels[k]), run_time=1.3)
        self.play(FadeIn(stack_cap), run_time=1.2)
        wait_until(self, 66)
        # beat 66-104: the shape tag, each dim lit
        self.play(FadeIn(tag), run_time=1.6)
        for i, cg in enumerate(tag.dim_chips):
            self.play(Indicate(cg, color=AMBER, scale_factor=1.08), run_time=0.9)
        self.play(FadeIn(tag_cap), run_time=1.4)
        wait_until(self, 122)
        # beat 122+: the handoff note
        self.play(FadeIn(note), run_time=1.4)
        self.play(Indicate(note, color=EMERALD, scale_factor=1.04), run_time=1.2)
        self.guard(code, stack, tag, tag_cap, note)
        pace_to(self, self.cue_duration)
