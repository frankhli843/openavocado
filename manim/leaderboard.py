"""
Model-building / leaderboard visual idioms for lesson 28 ("How Gemma Actually
Gets Built"). Shared by the orientation + part scenes: signal gauges with an
accept bar, percent bars for eval pass rates, and small run/idea boxes.

Follows the same conventions as arrays.py / bayes.py: plain constructors that
return VGroups with named attributes for the pieces scenes animate.
"""

from __future__ import annotations

from manim import (
    VGroup, Text, Rectangle, RoundedRectangle, Line, DashedLine,
    RIGHT, LEFT, UP, DOWN,
)
from theme import ACCENT, AMBER, EMERALD, ROSE, INK, INK_MUTED, INK_SUBTLE

_PAD = 0.06


def meter(frac, *, w=6.6, h=0.66, color=ACCENT, bar_frac=None,
          bar_label="bar", title=None, fs=22):
    """
    Horizontal signal gauge: a muted track, a colored fill spanning `frac` of
    it, and (optionally) an amber threshold tick at `bar_frac` labeled
    `bar_label`. Returns a VGroup with .track / .fill / .tick / .title so
    scenes can Transform the fill as the signal moves.
    """
    track = RoundedRectangle(
        width=w, height=h, corner_radius=0.10,
        stroke_color=INK_SUBTLE, stroke_width=2.2,
        fill_color=INK_SUBTLE, fill_opacity=0.08,
    )
    grp = VGroup(track)
    grp.track = track
    grp.fill = meter_fill(grp, frac, color=color)
    grp.add(grp.fill)
    grp.tick = None
    if bar_frac is not None:
        tick = DashedLine(
            track.get_bottom() + DOWN * 0.16, track.get_top() + UP * 0.16,
            color=AMBER, stroke_width=3.4, dash_length=0.09,
        )
        tick.move_to([_fill_x(track, w, bar_frac), track.get_center()[1], 0])
        tlab = Text(bar_label, font_size=19, color=AMBER)
        tlab.next_to(tick, UP, buff=0.10)
        grp.tick = VGroup(tick, tlab)
        grp.add(grp.tick)
    grp.title = None
    if title:
        t = Text(title, font_size=fs, color=INK_MUTED)
        t.next_to(track, UP, buff=0.55 if bar_frac is not None else 0.22)
        grp.title = t
        grp.add(t)
    return grp


def _fill_x(track, w, frac):
    """x coordinate `frac` of the way along the track's inner span."""
    return track.get_left()[0] + _PAD + (w - 2 * _PAD) * frac


def meter_fill(meter_grp, frac, *, color=ACCENT):
    """
    A fill rectangle for `meter_grp` spanning `frac` of the track — build a new
    one and Transform(meter.fill, new_fill) to animate the signal moving.
    """
    track = meter_grp.track
    w = track.width
    h = track.height
    fill_w = max((w - 2 * _PAD) * min(max(frac, 0.0), 1.0), 0.02)
    fill = Rectangle(
        width=fill_w, height=h - 2 * _PAD, stroke_width=0,
        fill_color=color, fill_opacity=0.85,
    )
    fill.move_to([
        track.get_left()[0] + _PAD + fill_w / 2,
        track.get_center()[1], 0,
    ])
    return fill


def pct_bar(pct, label, *, color=ACCENT, w=1.2, max_h=2.9, fs=26, lab_fs=21):
    """
    A vertical eval pass-rate bar: height = pct/100 of `max_h`, the percentage
    printed above, the eval name below. The group's origin is the bar's BOTTOM
    center — place with `.move_to([x, base_y, 0], aligned_edge=DOWN)` or use
    `place_bar()`. Attributes: .bar / .pct_text / .name .
    """
    bh = max(max_h * pct / 100.0, 0.05)
    bar = Rectangle(
        width=w, height=bh,
        stroke_color=color, stroke_width=2.4,
        fill_color=color, fill_opacity=0.28,
    )
    pct_text = Text(f"{pct:g}%", font_size=fs, color=color, weight="BOLD")
    pct_text.next_to(bar, UP, buff=0.14)
    name = Text(label, font_size=lab_fs, color=INK_MUTED)
    name.next_to(bar, DOWN, buff=0.18)
    grp = VGroup(bar, pct_text, name)
    grp.bar = bar
    grp.pct_text = pct_text
    grp.name = name
    return grp


def place_bar(grp, x, base_y):
    """Position a pct_bar so its bar bottom sits on the baseline at x."""
    dy = base_y - grp.bar.get_bottom()[1]
    grp.shift(RIGHT * (x - grp.bar.get_center()[0]) + UP * dy)
    return grp


def baseline(x0, x1, y, *, color=INK_SUBTLE, width=2.4):
    """A shared floor line for a group of pct_bars."""
    return Line([x0, y, 0], [x1, y, 0], color=color, stroke_width=width)
