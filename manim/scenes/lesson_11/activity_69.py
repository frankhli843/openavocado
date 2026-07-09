"""
Lesson 11 — Part 3 (activity 69): "Your First Arpeggio: The p-i-m-a Pattern"
(337.13s, 3 cues).

An arpeggio is a chord played in sequence — its notes unfolded one at a time.
The classic first pattern on an Am chord: thumb (p) plays string 5, the A root,
then i plays string 3, m plays string 2, a plays string 1. Four notes, one
cycle, repeat. The single most important skill is keeping the thumb independent
of the three treble fingers.

Uses guitar.py (StringSet, pluck, time_axis). No formulas.

Cue00 0-112    what an arpeggio is: a chord unfolded one note at a time
Cue01 112-225  the p-i-m-a cycle on Am: p→5 (root), i→3, m→2, a→1
Cue02 225-337  keep the thumb independent: bass reaches while fingers stay home
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from guitar import (
    StringSet, pluck, time_axis, region_brace,
    C_THUMB, C_INDEX, C_MIDDLE, C_RING, C_BASS, C_TREBLE, FINGER_COLOR,
)
from bayes import chip, fit_label
from manim import (
    VGroup, Text, Line, Dot, Arrow, RoundedRectangle, SurroundingRectangle,
    Circle, FadeIn, FadeOut, Write, Transform, Indicate, Create, GrowArrow,
    RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : what an arpeggio is ─────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "An arpeggio: a chord unfolded in time"
    cue_duration = 112.0

    def construct(self):
        # a stacked chord (all at once) on the left
        stack = VGroup(*[Dot([-4.4, 1.6 - i * 0.5, 0], radius=0.16, color=ACCENT).set_fill(ACCENT, 1.0)
                         for i in range(4)])
        stack_lab = fit_label("a chord\n(all at once)", 2.4, 22, INK_MUTED)
        stack_lab = VGroup(Text("a chord", font_size=22, color=INK_MUTED),
                           Text("all at once", font_size=20, color=INK_SUBTLE)
                           ).arrange(DOWN, buff=0.15).next_to(stack, DOWN, buff=0.4)
        self.play(FadeIn(stack), FadeIn(stack_lab), run_time=1.6)
        wait_until(self, 4.0)

        arrow = Arrow([-3.4, 0.35, 0], [-1.6, 0.35, 0], buff=0, color=INK, stroke_width=4)
        self.play(GrowArrow(arrow), run_time=1.0)

        # unfolded, one note at a time, across time
        cols = [C_THUMB, C_INDEX, C_MIDDLE, C_RING]
        seq = VGroup(*[Dot([-0.6 + i * 1.4, 0.35, 0], radius=0.16, color=cols[i]).set_fill(cols[i], 1.0)
                       for i in range(4)])
        tarrow = Arrow([-1.0, -0.5, 0], [5.4, -0.5, 0], buff=0, color=INK_MUTED, stroke_width=3,
                       max_tip_length_to_length_ratio=0.05)
        tlab = Text("time →", font_size=20, color=INK_MUTED).next_to(tarrow, RIGHT, buff=0.1)
        seq_lab = Text("unfolded, one at a time", font_size=22, color=EMERALD).next_to(
            seq, UP, buff=0.5)
        self.play(*[FadeIn(d, scale=0.6) for d in seq], GrowArrow(tarrow), FadeIn(tlab),
                  run_time=1.8)
        self.play(FadeIn(seq_lab), run_time=1.0)
        wait_until(self, 12.0)

        note = fit_label("arpeggio — from Italian 'arpeggiare', to play as a harp", 12.0, 24,
                         INK).move_to([0, -2.5, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(stack, stack_lab, arrow, seq, tarrow, tlab, seq_lab, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the p-i-m-a cycle on Am ─────────────────────────────────────────
class Cue01(AvoScene):
    headline = "The p-i-m-a cycle on an Am chord"
    cue_duration = 113.0

    def construct(self):
        s = StringSet(width=6.6, gap=0.56, x_center=-0.4, y_center=0.15)
        for n in (6, 5, 4):
            s.tint(n, C_BASS)
        for n in (3, 2, 1):
            s.tint(n, C_TREBLE)
        self.play(Create(VGroup(*s.lines.values())),
                  FadeIn(VGroup(*s.labels.values())), run_time=2.2)
        am = Text("Am chord held", font_size=22, color=INK_MUTED).next_to(s, UP, buff=0.28)
        self.play(FadeIn(am), run_time=0.8)
        wait_until(self, 5.0)

        # p→5 (A root), i→3, m→2, a→1, in sequence left→right
        order = [("p", 5, "1"), ("i", 3, "2"), ("m", 2, "3"), ("a", 1, "4")]
        events = VGroup()
        for k, (letter, st, num) in enumerate(order):
            col = FINGER_COLOR[letter]
            frac = 0.15 + k * 0.24
            p = pluck(s, st, frac, color=col, letter=letter)
            num_t = Text(num, font_size=18, color=col).next_to(p.dot, DOWN, buff=0.1)
            grp = VGroup(p, num_t)
            events.add(grp)
            self.play(FadeIn(p, scale=0.6), FadeIn(num_t), run_time=0.7)
            if letter == "p":
                root = fit_label("A root", 1.8, 18, C_THUMB).next_to(p.dot, LEFT, buff=0.15).shift(UP * 0.33)
                self.play(FadeIn(root), run_time=0.6)
                events.add(root)
            wait_until(self, 6.0 + (k + 1) * 2.0)

        seq_lab = VGroup(
            Text("p", font_size=26, color=C_THUMB, weight="BOLD"),
            Text("→ i", font_size=26, color=C_INDEX, weight="BOLD"),
            Text("→ m", font_size=26, color=C_MIDDLE, weight="BOLD"),
            Text("→ a", font_size=26, color=C_RING, weight="BOLD"),
        ).arrange(RIGHT, buff=0.3).next_to(s, DOWN, buff=0.55)
        cyc = Text("four notes · one cycle · repeat", font_size=22, color=EMERALD).next_to(
            seq_lab, DOWN, buff=0.3)
        self.play(FadeIn(seq_lab), run_time=1.2)
        self.play(Write(cyc), run_time=1.2)
        self.guard(s, am, events, seq_lab, cyc)
        pace_to(self, self.cue_duration)


# ─── Cue02 : keep the thumb independent ──────────────────────────────────────
class Cue02(AvoScene):
    headline = "Keep the thumb independent"
    cue_duration = 112.0

    def construct(self):
        s = StringSet(width=6.6, gap=0.56, x_center=-0.4, y_center=0.1)
        for n in (6, 5, 4):
            s.tint(n, C_BASS)
        for n in (3, 2, 1):
            s.tint(n, C_TREBLE)
        self.play(Create(VGroup(*s.lines.values())),
                  FadeIn(VGroup(*s.labels.values())), run_time=2.0)
        wait_until(self, 3.5)

        # thumb reaches across several bass positions (motion)
        thumb = VGroup(*[pluck(s, st, f, color=C_THUMB, letter="p")
                         for st, f in ((5, 0.14), (4, 0.44), (5, 0.74), (4, 0.96))])
        tbrace = region_brace(s, 4, 6, C_THUMB, "thumb moves", fs=21)
        self.play(FadeIn(tbrace), run_time=1.0)
        self.play(*[FadeIn(d, scale=0.6) for d in thumb], run_time=1.6)
        wait_until(self, 9.0)

        # fingers stay lightly resting (hollow rings) on their treble strings
        rest = VGroup()
        for st, letter in ((3, "i"), (2, "m"), (1, "a")):
            col = FINGER_COLOR[letter]
            ring = Circle(radius=0.15, color=col, stroke_width=3).move_to(
                [s.x_at(0.55), s.ynum[st], 0])
            tag = Text(letter, font_size=20, color=col, weight="BOLD").next_to(ring, UP, buff=0.08)
            rest.add(VGroup(ring, tag))
        rbrace = region_brace(s, 1, 3, C_TREBLE, "fingers stay home", fs=21)
        self.play(FadeIn(rbrace), run_time=1.0)
        self.play(*[FadeIn(r) for r in rest], run_time=1.4)
        wait_until(self, 15.0)

        note = fit_label("the motions don't interfere — musical, not mechanical", 12.0, 23,
                         EMERALD).next_to(s, DOWN, buff=0.55)
        self.play(Write(note), run_time=1.6)
        self.guard(s, thumb, tbrace, rest, rbrace, note)
        pace_to(self, self.cue_duration)
