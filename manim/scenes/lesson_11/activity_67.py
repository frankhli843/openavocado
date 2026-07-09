"""
Lesson 11 — Part 1 (activity 67): "Why Fingerpicking: The Two Dimensions of
Guitar Sound" (319.44s, 3 cues).

The concept: texture = how a chord's notes are arranged in TIME. A strum stacks
every note at one instant (vertical texture); fingerpicking spreads the same
pitches across time (horizontal texture). That horizontal spread is what lets the
thumb hold a bass line while the fingers carry a melody — the guitar's "two
instruments at once".

Uses guitar.py (StringSet, strum_column, pluck, time_axis). No formulas.

Cue00 0-106    one Am chord: strum it (all at once) vs unfold it note by note
Cue01 106-213  vertical (simultaneous) vs horizontal (sequential) texture
Cue02 213-319  two instruments at once: thumb bass line under an independent melody
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from guitar import (
    StringSet, strum_column, pluck, time_axis, region_brace,
    C_THUMB, C_INDEX, C_MIDDLE, C_RING, C_BASS, C_TREBLE, FINGER_COLOR,
    STRING_FINGER,
)
from bayes import chip, fit_label
from manim import (
    VGroup, Text, Line, Dot, Arrow, RoundedRectangle, SurroundingRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Create, GrowArrow,
    RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : one chord, two textures ─────────────────────────────────────────
class Cue00(AvoScene):
    headline = "One Am chord, two different sounds"
    cue_duration = 106.0

    def construct(self):
        s = StringSet(width=6.8, gap=0.52, x_center=-0.4, y_center=0.2)
        for n in (6, 5, 4):
            s.tint(n, C_BASS)
        for n in (3, 2, 1):
            s.tint(n, C_TREBLE)
        self.play(Create(VGroup(*s.lines.values())),
                  FadeIn(VGroup(*s.labels.values())), run_time=2.2)
        chord = Text("Am chord", font_size=24, color=INK_MUTED).next_to(s, UP, buff=0.3)
        self.play(FadeIn(chord), run_time=0.8)
        wait_until(self, 5.0)

        # strum: all played strings ring at one instant (string 6 is muted in Am)
        col = strum_column(s, frac=0.30, sset=(5, 4, 3, 2, 1))
        strum_lab = fit_label("strum → every note at once", 5.4, 22, INK).next_to(
            s, DOWN, buff=0.5).shift(LEFT * 2.6)
        self.play(Create(col), run_time=1.4)
        self.play(FadeIn(strum_lab), run_time=1.0)
        wait_until(self, 11.0)

        # unfold: the same notes, one at a time, later in time
        seq = VGroup()
        for k, st in enumerate((5, 3, 2, 1)):
            seq.add(pluck(s, st, 0.58 + k * 0.12, color=C_BASS if st >= 4 else C_TREBLE))
        arr = Arrow(s.lines[3].get_center() + LEFT * 0.2, [s.x_at(0.58), s.ynum[3], 0],
                    buff=0.1, color=INK_MUTED, stroke_width=3)
        unfold_lab = fit_label("or unfold: one note at a time", 5.4, 22, EMERALD).next_to(
            s, DOWN, buff=0.5).shift(RIGHT * 2.6)
        self.play(*[FadeIn(d, scale=0.6) for d in seq], run_time=1.6)
        self.play(FadeIn(unfold_lab), run_time=1.0)
        wait_until(self, 17.0)
        same = fit_label("same chord · same pitches · different texture", 11.0, 24, INK).next_to(
            VGroup(strum_lab, unfold_lab), DOWN, buff=0.4)
        self.play(Write(same), run_time=1.6)
        self.guard(s, chord, col, seq, strum_lab, unfold_lab, same)
        pace_to(self, self.cue_duration)


# ─── Cue01 : vertical vs horizontal texture ──────────────────────────────────
class Cue01(AvoScene):
    headline = "Texture = how the notes sit in time"
    cue_duration = 107.0

    def _stack(self, x, color):
        # a vertical column of 5 note dots — all at the same moment (strum)
        g = VGroup()
        for i in range(5):
            g.add(Dot([x, 1.9 - i * 0.5, 0], radius=0.16, color=color).set_fill(color, 1.0))
        return g

    def construct(self):
        # LEFT: vertical texture (strum)
        v = self._stack(-3.6, ACCENT)
        vline = Line([-3.6, 2.15, 0], [-3.6, -0.25, 0], color=ACCENT, stroke_width=3)
        vtitle = Text("STRUMMING", font_size=26, color=ACCENT, weight="BOLD").move_to([-3.6, 2.4, 0])
        vsub = fit_label("vertical · all notes at one moment", 4.6, 21, INK_MUTED).move_to([-3.6, -0.95, 0])
        self.play(FadeIn(vtitle), Create(vline), run_time=1.4)
        self.play(FadeIn(v), run_time=1.2)
        self.play(FadeIn(vsub), run_time=0.9)
        wait_until(self, 6.0)

        # RIGHT: horizontal texture (fingerpick) — same 5 notes spread across time
        cols = [C_BASS, C_TREBLE, C_MIDDLE, C_RING, C_INDEX]
        h = VGroup()
        for i in range(5):
            h.add(Dot([1.4 + i * 0.85, 0.85, 0], radius=0.16, color=cols[i]).set_fill(cols[i], 1.0))
        htitle = Text("FINGERPICKING", font_size=26, color=EMERALD, weight="BOLD").move_to([3.4, 2.4, 0])
        tarrow = Arrow([1.15, 0.0, 0], [5.6, 0.0, 0], buff=0, color=INK_MUTED, stroke_width=3,
                       max_tip_length_to_length_ratio=0.05)
        tlab = Text("time →", font_size=20, color=INK_MUTED).next_to(tarrow, DOWN, buff=0.12)
        hsub = fit_label("horizontal · spread across time", 4.6, 21, INK_MUTED).move_to([3.4, -0.95, 0])
        self.play(FadeIn(htitle), run_time=1.0)
        self.play(FadeIn(h, shift=UP * 0.1), GrowArrow(tarrow), FadeIn(tlab), run_time=1.6)
        self.play(FadeIn(hsub), run_time=0.9)
        wait_until(self, 12.0)

        note = fit_label("same pitches, different character", 8.0, 24, INK).move_to([0, -2.55, 0])
        self.play(Write(note), run_time=1.6)
        self.guard(v, vline, vtitle, vsub, h, htitle, tarrow, tlab, hsub, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : two instruments at once ─────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Two instruments at once — from one hand"
    cue_duration = 106.0

    def construct(self):
        s = StringSet(width=6.8, gap=0.56, x_center=-0.4, y_center=0.1)
        self.play(Create(VGroup(*s.lines.values())),
                  FadeIn(VGroup(*s.labels.values())), run_time=2.0)
        wait_until(self, 3.5)

        # bass line: steady thumb notes on the low strings
        for n in (6, 5, 4):
            s.tint(n, C_BASS)
        bass = VGroup(*[pluck(s, 5, f, color=C_THUMB) for f in (0.14, 0.42, 0.70, 0.92)])
        bass_lab = region_brace(s, 4, 6, C_THUMB, "thumb: bass line", fs=21)
        self.play(FadeIn(bass_lab), run_time=1.0)
        self.play(*[FadeIn(d, scale=0.6) for d in bass], run_time=1.4)
        wait_until(self, 9.0)

        # melody: fingers on the treble strings, freely
        for n in (3, 2, 1):
            s.tint(n, C_TREBLE)
        mel = VGroup(
            pluck(s, 3, 0.28, color=C_INDEX), pluck(s, 2, 0.56, color=C_MIDDLE),
            pluck(s, 1, 0.80, color=C_RING), pluck(s, 2, 0.98, color=C_MIDDLE),
        )
        mel_lab = region_brace(s, 1, 3, C_TREBLE, "fingers: melody", fs=21)
        self.play(FadeIn(mel_lab), run_time=1.0)
        self.play(*[FadeIn(d, scale=0.6) for d in mel], run_time=1.4)
        wait_until(self, 15.0)

        note = fit_label("independent — a pick can only hit everything at once", 12.0, 23,
                         EMERALD).next_to(s, DOWN, buff=0.55)
        self.play(Write(note), run_time=1.6)
        self.guard(s, bass, bass_lab, mel, mel_lab, note)
        pace_to(self, self.cue_duration)
