"""
Lesson 11 — Part 2 (activity 68): "Meet PIMA: Your Right Hand's Job Assignment"
(330.53s, 3 cues).

PIMA is the classical notation that gives each right-hand picking finger a fixed
home: p = pulgar (thumb), i = índice (index), m = medio (middle), a = anular
(ring). Each owns a string region — p the bass strings 6/5/4, i string 3, m
string 2, a string 1 — because the strong thumb reaches the wound bass strings
while the three light fingers sit above the treble.

Uses guitar.py (StringSet, pima_row, finger_legend, assign_arrow, region_brace).

Cue00 0-110    PIMA = Spanish names for the four picking fingers
Cue01 110-220  each finger owns a string region (p:6/5/4, i:3, m:2, a:1)
Cue02 220-331  why the split works: strong thumb below, light fingers above
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from guitar import (
    StringSet, pima_row, finger_legend, assign_arrow, region_brace, pluck,
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


# ─── Cue00 : PIMA — Spanish names ────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "PIMA: Spanish names for the picking hand"
    cue_duration = 110.0

    def construct(self):
        row = pima_row(fs=40, box_w=1.3, box_h=1.3, gap=0.9).move_to([0, 1.4, 0])
        self.play(FadeIn(row), run_time=1.6)
        wait_until(self, 4.0)

        legends = VGroup(*[finger_legend(k, fs=26) for k in ("p", "i", "m", "a")])
        legends.arrange(DOWN, aligned_edge=LEFT, buff=0.4).move_to([0, -1.4, 0])
        for k, (letter, leg) in enumerate(zip(("p", "i", "m", "a"), legends)):
            self.play(Indicate(row.chips[letter], color=FINGER_COLOR[letter], scale_factor=1.12),
                      FadeIn(leg, shift=RIGHT * 0.2), run_time=1.1)
            wait_until(self, 6.0 + (k + 1) * 2.0)
        tag = fit_label("four letters — the alphabet of fingerpicking", 9.0, 22, INK_MUTED).next_to(
            legends, DOWN, buff=0.5)
        self.play(Write(tag), run_time=1.4)
        self.guard(row, legends, tag)
        pace_to(self, self.cue_duration)


# ─── Cue01 : each finger owns a region ───────────────────────────────────────
class Cue01(AvoScene):
    headline = "One finger, one string region"
    cue_duration = 110.0

    def construct(self):
        s = StringSet(width=5.6, gap=0.72, x_center=1.5, y_center=-0.1)
        for n in (6, 5, 4):
            s.tint(n, C_BASS)
        for n in (3, 2, 1):
            s.tint(n, C_TREBLE)
        self.play(Create(VGroup(*s.lines.values())),
                  FadeIn(VGroup(*s.labels.values())), run_time=2.2)
        wait_until(self, 4.0)

        # chips on the left, one per finger, aligned to their target string
        targets = {"a": 1, "m": 2, "i": 3, "p": 5}
        chips = {}
        for letter, st in targets.items():
            col = FINGER_COLOR[letter]
            box = RoundedRectangle(width=0.82, height=0.6, corner_radius=0.1,
                                   stroke_color=col, stroke_width=2.6,
                                   fill_color=col, fill_opacity=0.14)
            box.move_to([-4.7, s.ynum[st], 0])
            t = Text(letter, font_size=26, color=col, weight="BOLD").move_to(box.get_center())
            chips[letter] = VGroup(box, t)
        # p spans the bass region — a brace makes that explicit
        brace = region_brace(s, 4, 6, C_THUMB, "", fs=20)
        self.play(FadeIn(VGroup(*chips.values())), FadeIn(brace), run_time=1.6)
        wait_until(self, 8.0)

        rows = [("a", 1, "a → string 1"), ("m", 2, "m → string 2"),
                ("i", 3, "i → string 3"), ("p", 5, "p → strings 6·5·4")]
        arrows = VGroup()
        labels = VGroup()
        for k, (letter, st, txt) in enumerate(rows):
            col = FINGER_COLOR[letter]
            ar = assign_arrow(chips[letter], s, st, col)
            arrows.add(ar)
            lab = fit_label(txt, 3.0, 20, col).next_to(chips[letter], DOWN, buff=0.08)
            self.play(GrowArrow(ar), Indicate(chips[letter], color=col, scale_factor=1.1),
                      run_time=1.0)
            wait_until(self, 10.0 + (k + 1) * 1.8)
        legend = fit_label("p covers the wound bass strings; i · m · a take the treble",
                           12.0, 22, INK_MUTED).next_to(s, DOWN, buff=0.7)
        self.play(Write(legend), run_time=1.6)
        self.guard(s, brace, VGroup(*chips.values()), arrows, legend)
        pace_to(self, self.cue_duration)


# ─── Cue02 : why the split works ─────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Strong thumb below, light fingers above"
    cue_duration = 111.0

    def construct(self):
        s = StringSet(width=6.6, gap=0.56, x_center=-0.5, y_center=0.1)
        self.play(Create(VGroup(*s.lines.values())),
                  FadeIn(VGroup(*s.labels.values())), run_time=2.0)
        wait_until(self, 3.5)

        for n in (6, 5, 4):
            s.tint(n, C_BASS)
        bass = region_brace(s, 4, 6, C_THUMB, "thumb: the foundation", fs=22)
        bnote = fit_label("strongest digit · reaches the wound bass strings", 5.4, 20,
                          INK_MUTED).next_to(bass, DOWN, buff=0.2)
        self.play(FadeIn(bass), run_time=1.2)
        self.play(FadeIn(bnote), run_time=0.9)
        wait_until(self, 9.0)

        for n in (3, 2, 1):
            s.tint(n, C_TREBLE)
        treble = region_brace(s, 1, 3, C_TREBLE, "fingers: the melody", fs=22)
        tnote = fit_label("three light fingers sit naturally above the treble", 5.4, 20,
                          INK_MUTED).next_to(treble, UP, buff=0.2)
        self.play(FadeIn(treble), run_time=1.2)
        self.play(FadeIn(tnote), run_time=0.9)
        wait_until(self, 15.0)

        note = fit_label("the assignment is not arbitrary — it fits the hand", 11.0, 24,
                         EMERALD).next_to(s, DOWN, buff=0.95)
        self.play(Write(note), run_time=1.6)
        self.guard(s, bass, bnote, treble, tnote, note)
        pace_to(self, self.cue_duration)
