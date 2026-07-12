"""
AvocadoCore Manim theme for lesson videos.

Design intent: the Open Avocado site is light-themed (white bg, accent blue
#3B82F6, success emerald #10b981, warning amber #f59e0b, danger red #ef4444,
text #111827). Math explainer videos read best on a dark stage, so we render on
a refined dark slate background and reuse the site's accent hues for highlights
and semantic color-coding. Formulas are white MathTex. The accent palette marks
"what the narration is currently discussing".

This module exposes:
  - PALETTE / semantic color constants
  - fonts + font sizes tuned to the 16:9 frame
  - a layout grid (safe area, title band, stage, caption band)
  - highlight(): Indicate / SurroundingRectangle / dim-others helper
  - assert_in_safe_area(): FAILS the render if any mobject exceeds the frame
  - AvoScene: a Scene subclass wiring the background, safe-area guard, and a
    title band so chunk authors write less boilerplate.
"""

from __future__ import annotations

from manim import (
    BLACK,
    WHITE,
    UP,
    Scene,
    Mobject,
    VGroup,
    Rectangle,
    Text,
    SurroundingRectangle,
    Indicate,
    AnimationGroup,
    ApplyMethod,
    config,
)

# Palette (dark stage + site accent hues)
# Background: a dark slate rather than pure black, softer with less banding.
BG = "#0F1117"
STAGE = "#161923"          # subtle panel fill for grouping regions
INK = "#F5F7FA"            # primary formula / text ink (near-white)
INK_MUTED = "#9AA4B2"      # secondary / de-emphasized text
INK_SUBTLE = "#5B6472"     # gridlines, axes at rest

# Site accent hues, reused as semantic highlight colors.
ACCENT = "#3B82F6"         # site accent blue, primary highlight
ACCENT_LIGHT = "#7DA9FB"
EMERALD = "#10B981"        # site success, "value / result" channel
AMBER = "#F59E0B"          # site warning, "attention / focus" channel
ROSE = "#F43F5E"           # site danger, "contrast / negative" channel
VIOLET = "#8B5CF6"         # supplemental categorical channel

# Semantic role to color, used by scenes for Q/K/V, residual, etc.
ROLE_QUERY = ACCENT
ROLE_KEY = AMBER
ROLE_VALUE = EMERALD
ROLE_RESIDUAL = VIOLET
ROLE_HIGHLIGHT = AMBER

# Ordered categorical palette (accessible, distinct in luminance + hue).
CATEGORICAL = [ACCENT, AMBER, EMERALD, VIOLET, ROSE, ACCENT_LIGHT]

# Fonts
# Manim renders MathTex via LaTeX (Computer Modern), crisp and familiar.
# Plain-text labels use a clean sans; fall back gracefully if unavailable.
FONT_SANS = "sans-serif"
TITLE_SIZE = 40
HEADLINE_SIZE = 34
LABEL_SIZE = 28
BODY_SIZE = 24
FORMULA_SIZE = 52
FORMULA_SIZE_SMALL = 38

# Layout grid
# Manim's default frame is 14.222 (w) × 8 (h) units for 16:9. We reserve a
# title band at the top and a caption band at the bottom, leaving a central
# "stage" for the main visual. SAFE_MARGIN keeps everything off the true edge.
FRAME_W = config.frame_width      # 14.222...
FRAME_H = config.frame_height     # 8.0
SAFE_MARGIN = 0.5                 # units kept clear on every edge
TITLE_BAND_H = 1.1               # top band for the cue headline
CAPTION_BAND_H = 0.9             # bottom band (kept clear; captions are VTT)

# Usable stage rectangle (centered), after reserving the bands + margins.
STAGE_TOP = FRAME_H / 2 - SAFE_MARGIN - TITLE_BAND_H
STAGE_BOTTOM = -FRAME_H / 2 + SAFE_MARGIN + CAPTION_BAND_H
STAGE_LEFT = -FRAME_W / 2 + SAFE_MARGIN
STAGE_RIGHT = FRAME_W / 2 - SAFE_MARGIN
STAGE_H = STAGE_TOP - STAGE_BOTTOM
STAGE_W = STAGE_RIGHT - STAGE_LEFT


class SafeAreaError(AssertionError):
    """Raised when a mobject would render outside the visible frame."""


def _safe_bounds() -> tuple[float, float, float, float]:
    """(left, right, bottom, top) of the true visible frame minus SAFE_MARGIN."""
    return (
        -FRAME_W / 2 + SAFE_MARGIN,
        FRAME_W / 2 - SAFE_MARGIN,
        -FRAME_H / 2 + SAFE_MARGIN,
        FRAME_H / 2 - SAFE_MARGIN,
    )


def assert_in_safe_area(*mobjects: Mobject, tol: float = 0.02) -> None:
    """
    FAIL the render (raise SafeAreaError) if any given mobject's bounding box
    exceeds the safe frame area. This is the pre-review guard the acceptance
    requires: nothing off-frame or clipped ever reaches the screenshot review.

    tol allows a hair of overshoot (anti-alias bleed) without false positives.
    """
    left, right, bottom, top = _safe_bounds()
    for m in mobjects:
        if m is None:
            continue
        # Skip zero-size / empty groups.
        try:
            w = m.width
            h = m.height
        except Exception:
            continue
        if w == 0 and h == 0:
            continue
        ml = m.get_left()[0]
        mr = m.get_right()[0]
        mb = m.get_bottom()[1]
        mt = m.get_top()[1]
        problems = []
        if ml < left - tol:
            problems.append(f"left {ml:.2f} < {left:.2f}")
        if mr > right + tol:
            problems.append(f"right {mr:.2f} > {right:.2f}")
        if mb < bottom - tol:
            problems.append(f"bottom {mb:.2f} < {bottom:.2f}")
        if mt > top + tol:
            problems.append(f"top {mt:.2f} > {top:.2f}")
        if problems:
            name = getattr(m, "tex_string", None) or type(m).__name__
            raise SafeAreaError(
                f"Mobject '{name}' exceeds safe area: {', '.join(problems)}. "
                f"Scale down or reposition before rendering."
            )


def fit_to_stage(mobject: Mobject, width_frac: float = 1.0, height_frac: float = 1.0) -> Mobject:
    """
    Scale a mobject down (never up) so it fits within the stage rectangle,
    optionally to a fraction of the stage. Returns the same mobject for
    chaining. Use this on big matrices / wide formulas before positioning.
    """
    max_w = STAGE_W * width_frac
    max_h = STAGE_H * height_frac
    if mobject.width > max_w:
        mobject.scale(max_w / mobject.width)
    if mobject.height > max_h:
        mobject.scale(max_h / mobject.height)
    return mobject


def highlight(
    scene: Scene,
    target: Mobject,
    *,
    others: list[Mobject] | None = None,
    color: str = ROLE_HIGHLIGHT,
    box: bool = True,
    run_time: float = 0.8,
    dim: float = 0.35,
) -> VGroup:
    """
    Emphasize `target` the way 3b1b does: draw a rounded SurroundingRectangle,
    pulse an Indicate, and (optionally) dim every other listed mobject so the
    eye lands on what the narration is discussing.

    Returns the SurroundingRectangle (wrapped in a VGroup) so the caller can
    FadeOut / Transform it on the next cue. Idempotent-safe: pass the previous
    box in `others` to fade it as you move focus.
    """
    box_group = VGroup()
    anims = []
    if others:
        for o in others:
            if o is target or o is None:
                continue
            anims.append(ApplyMethod(o.set_opacity, dim))
    if box:
        rect = SurroundingRectangle(target, color=color, buff=0.15, corner_radius=0.08)
        box_group.add(rect)
        scene.play(*anims, run_time=run_time) if anims else None
        scene.play(Indicate(target, color=color, scale_factor=1.12), run_time=run_time)
        scene.add(rect)
    else:
        anims.append(Indicate(target, color=color, scale_factor=1.12))
        scene.play(AnimationGroup(*anims), run_time=run_time)
    return box_group


def background_rect() -> Rectangle:
    """A full-frame background rectangle in the theme BG color."""
    return Rectangle(
        width=FRAME_W,
        height=FRAME_H,
        fill_color=BG,
        fill_opacity=1.0,
        stroke_width=0,
    )


def title_band(text: str) -> Text:
    """A cue headline placed in the reserved top band, clipped to width."""
    t = Text(text, font=FONT_SANS, font_size=HEADLINE_SIZE, color=INK)
    max_w = FRAME_W - 2 * SAFE_MARGIN
    if t.width > max_w:
        t.scale(max_w / t.width)
    t.to_edge(UP, buff=SAFE_MARGIN + 0.1)
    return t


class AvoScene(Scene):
    """
    Base scene for AvocadoCore lesson chunks. Paints the dark background and the
    cue headline, and exposes `guard()` to assert the safe area before finishing.

    Chunk scenes subclass this and implement `construct()`. Because Manim's
    config background is set here, `config.background_color = BG` is also applied
    at import-render time by the render script.
    """

    headline: str = ""

    def setup(self) -> None:  # noqa: D401 - Manim hook
        super().setup()
        self.camera.background_color = BG
        self.add(background_rect())
        if self.headline:
            self.add(title_band(self.headline))

    def guard(self, *mobjects: Mobject) -> None:
        """Assert the given mobjects are inside the safe area (call before wait/end)."""
        assert_in_safe_area(*mobjects)


# Apply the background color globally when this module is imported by a render.
config.background_color = BG
