"""
Lesson 9 — Part 3 (activity 62): "Permute HWC → CHW and Add the Batch Dimension"
(442.97s). 3 synced_visual cues, each ~147.7s, rescaled to the real MP3.

  Cue00 0-147.7    Input:    the (896,896,3) HWC float array — frameworks want CHW
  Cue01 147.7-295.3 Transform: transpose(2,0,1) -> (3,896,896) CHW, then [None]
                              -> (1,3,896,896) NCHW
  Cue02 295.3-443.0 Handoff:  the model-ready batch-of-1 float tensor

Idioms (imgprep.py): the tensor-shape tag whose dim chips re-order to animate
HWC->CHW->NCHW, a 3-plane channel stack, and code lines. No MathTex.
"""

import imgprep
from imgprep import (
    channel_stack,
    shape_tag,
    code_block,
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


# ─── Cue00 : HWC input, why channels-first ───────────────────────────────────
class Cue00(AvoScene):
    headline = "NumPy gives H×W×C — deep-learning frameworks want C×H×W"
    cue_duration = 147.656

    def construct(self):
        # the current shape tag: (896, 896, 3) HWC
        tag = shape_tag([896, 896, 3], labels=["H", "W", "C"]).scale(0.95)
        tag.shift(UP * 1.3)
        tag_cap = Text("what Part 2 handed us: channels LAST",
                       font_size=24, color=EMERALD).next_to(tag, DOWN, buff=0.5)

        # the two conventions contrasted
        conv = VGroup(
            VGroup(
                Text("PIL / NumPy / matplotlib", font_size=22, color=INK_MUTED),
                Text("H, W, C  (channels last)", font="monospace", font_size=24, color=EMERALD),
            ).arrange(DOWN, buff=0.2),
            VGroup(
                Text("PyTorch / most conv nets", font_size=22, color=INK_MUTED),
                Text("C, H, W  (channels first)", font="monospace", font_size=24, color=ACCENT),
            ).arrange(DOWN, buff=0.2),
        ).arrange(RIGHT, buff=1.6).shift(DOWN * 1.9)

        self.play(FadeIn(tag), run_time=1.8)
        for i, cg in enumerate(tag.dim_chips):
            self.play(Indicate(cg, color=AMBER, scale_factor=1.08), run_time=0.9)
        self.play(FadeIn(tag_cap), run_time=1.2)
        wait_until(self, 46)
        # beat 46-96: the two conventions
        self.play(FadeIn(conv[0]), run_time=1.8)
        self.play(Indicate(conv[0], color=EMERALD, scale_factor=1.05), run_time=1.2)
        wait_until(self, 74)
        self.play(FadeIn(conv[1]), run_time=1.8)
        self.play(Indicate(conv[1], color=ACCENT, scale_factor=1.05), run_time=1.2)
        wait_until(self, 108)
        # beat 108+: the mismatch is why we permute
        why = fit_label("the array is right, the axis order is wrong — so we reorder axes",
                        12.5, 22, AMBER).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(why), run_time=1.6)
        self.play(Indicate(why, color=AMBER, scale_factor=1.04), run_time=1.2)
        self.guard(tag, tag_cap, conv, why)
        pace_to(self, self.cue_duration)


# ─── Cue01 : transpose then add batch ────────────────────────────────────────
class Cue01(AvoScene):
    headline = "transpose(2, 0, 1) → CHW, then [None] → NCHW"
    cue_duration = 147.656

    def construct(self):
        code1 = Text("arr = arr.transpose(2, 0, 1)", font="monospace",
                     font_size=25, color=INK).shift(UP * 2.5)
        code2 = Text("arr = arr[None, ...]", font="monospace",
                     font_size=25, color=INK).next_to(code1, DOWN, buff=0.26)

        # start HWC, transform to CHW by re-ordering the dim chips
        tag = shape_tag([896, 896, 3], labels=["H", "W", "C"]).scale(0.85)
        tag.shift(DOWN * 0.3)

        self.play(Write(code1), run_time=2.0)
        self.play(FadeIn(tag), run_time=1.6)
        wait_until(self, 20)
        # beat 20-70: animate the permute — C jumps to the front → (3,896,896)
        chips = tag.dim_chips  # [H=896, W=896, C=3]
        self.play(Indicate(chips[2], color=AMBER, scale_factor=1.12), run_time=1.2)
        # build the CHW tag and cross-fade
        chw = shape_tag([3, 896, 896], labels=["C", "H", "W"]).scale(0.85).shift(DOWN * 0.3)
        chw.dim_chips[0][0].set_stroke(color=ACCENT, width=3.0)
        chw.dim_chips[0][0].set_fill(color=ACCENT, opacity=0.20)
        # place the transient permute label ABOVE the chips so it never collides
        # with the "channels FIRST" caption that sits below the chips
        arrow = Text("permute axes  (2,0,1)", font_size=22, color=INK_MUTED).move_to(UP * 1.15)
        self.play(FadeIn(arrow), run_time=1.2)
        self.play(ReplacementTransform(tag, chw), run_time=2.4)
        chw_cap = Text("(3, 896, 896)  →  channels FIRST", font="monospace",
                       font_size=22, color=ACCENT).next_to(chw, DOWN, buff=0.9)
        self.play(FadeIn(chw_cap), run_time=1.4)
        self.play(Indicate(chw.dim_chips[0], color=ACCENT, scale_factor=1.10), run_time=1.2)
        wait_until(self, 96)
        # beat 96-130: add the batch dim → (1,3,896,896)
        self.play(Write(code2), FadeOut(arrow), run_time=1.8)
        nchw = shape_tag([1, 3, 896, 896], labels=["N", "C", "H", "W"]).scale(0.72).shift(DOWN * 0.3)
        nchw.dim_chips[0][0].set_stroke(color=VIOLET, width=3.0)
        nchw.dim_chips[0][0].set_fill(color=VIOLET, opacity=0.22)
        self.play(FadeOut(chw_cap), ReplacementTransform(chw, nchw), run_time=2.4)
        self.play(Indicate(nchw.dim_chips[0], color=VIOLET, scale_factor=1.12), run_time=1.2)
        nchw_cap = Text("N = 1  →  a batch of one image", font="monospace",
                        font_size=22, color=VIOLET).next_to(nchw, DOWN, buff=0.9)
        self.play(FadeIn(nchw_cap), run_time=1.4)
        wait_until(self, 138)
        self.play(Indicate(nchw, color=EMERALD, scale_factor=1.04), run_time=1.2)
        self.guard(code1, code2, nchw, nchw_cap)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the model-ready tensor (handoff) ────────────────────────────────
class Cue02(AvoScene):
    headline = "Handoff: a (1, 3, 896, 896) float tensor, ready for the model"
    cue_duration = 147.656

    def construct(self):
        final = shape_tag([1, 3, 896, 896], labels=["N", "C", "H", "W"]).scale(0.78)
        final.shift(UP * 1.4)
        final_cap = VGroup(
            Text("dtype: float32", font="monospace", font_size=22, color=EMERALD),
            Text("normalized, channels-first, batched", font="monospace", font_size=22, color=INK_MUTED),
        ).arrange(DOWN, buff=0.24).next_to(final, DOWN, buff=0.5)

        # recap the three things every line changed
        recap = code_block(
            [
                "shape:  (H,W,C) -> (C,H,W) -> (1,C,H,W)",
                "dtype:  uint8   -> float32",
                "range:  0..255  -> 0..1 -> normalized",
            ],
            fs=22, gap=0.34, num=False,
        )
        recap.shift(DOWN * 1.9)
        for ln in recap.lines:
            ln.set_color(INK)

        self.play(FadeIn(final), run_time=1.8)
        for cg in final.dim_chips:
            self.play(Indicate(cg, color=EMERALD, scale_factor=1.08), run_time=0.8)
        self.play(FadeIn(final_cap), run_time=1.4)
        wait_until(self, 44)
        # beat 44-100: the three-line recap of what the whole pipeline changed
        for i, ln in enumerate(recap.lines):
            self.play(FadeIn(ln), run_time=1.4)
            self.play(Indicate(ln, color=[AMBER, ACCENT, VIOLET][i], scale_factor=1.03), run_time=1.0)
            wait_until(self, 50 + (i + 1) * 16)
        wait_until(self, 116)
        # beat 116+: ready-for-model close
        close = fit_label("feed this straight into model(tensor) — no more preprocessing",
                          12.5, 22, EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(close), run_time=1.6)
        self.play(Indicate(close, color=EMERALD, scale_factor=1.04), run_time=1.2)
        self.guard(final, final_cap, recap, close)
        pace_to(self, self.cue_duration)
