"""
Lesson 11 — Orientation (activity 66): "Fingerpicking Fundamentals: Why Your
Hands Should Do Different Jobs" (1020.19s, 7 cues).

The top-level overview: fingerpicking works by giving the thumb and the fingers
DIFFERENT jobs. The thumb keeps a steady bass pulse on the low strings while the
index/middle/ring fingers carry melody/chord tones on the treble strings. The
object we follow all lesson is a repeating picking pattern split between bass and
melody strings.

Uses guitar.py (StringSet, region_brace, pima_row, pluck, finger_legend), NOT
the algorithm/ML idioms. No formulas — fingerpicking is rhythmic, not algebraic,
so MathTex is intentionally absent (theme allows plain Text/idioms only here).

Cue00 0-146     why separate jobs: thumb = bass pulse (6/5/4), fingers = melody (3/2/1)
Cue01 146-291   follow one object: repeating pattern split bass/melody = band in one hand
Cue02 291-437   tiny example: thumb alternates two bass strings, fingers fill the gaps
Cue03 437-583   mechanism: anchor → assign → thumb pulse → add one finger → grow slowly
Cue04 583-729   read as rhythm: thumb on beats, finger notes between; pulse stays even
Cue05 729-874   common mistake: moving all fingers as one clump vs independent roles
Cue06 874-1020  division of labor: steady bass role + flexible upper voices
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from guitar import (
    StringSet, region_brace, pima_row, pluck, finger_legend, time_axis,
    C_THUMB, C_INDEX, C_MIDDLE, C_RING, C_BASS, C_TREBLE, FINGER_COLOR,
)
from bayes import chip, fit_label
from manim import (
    VGroup, Text, Line, Dot, Arrow, RoundedRectangle, SurroundingRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, GrowArrow,
    Create, RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def _strings(x_center=-0.6, width=6.6, y_center=0.0):
    return StringSet(width=width, gap=0.6, x_center=x_center, y_center=y_center)


# ─── Cue00 : why separate the jobs ───────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Give the thumb and fingers different jobs"
    cue_duration = 146.0

    def construct(self):
        s = _strings()
        self.play(Create(VGroup(*s.lines.values())), run_time=2.2)
        self.play(FadeIn(VGroup(*s.labels.values())), run_time=1.0)
        wait_until(self, 5.0)

        for n in (6, 5, 4):
            s.tint(n, C_BASS)
        bass = region_brace(s, 4, 6, C_THUMB, "thumb: bass pulse", fs=22)
        self.play(FadeIn(bass), run_time=1.4)
        wait_until(self, 11.0)

        for n in (3, 2, 1):
            s.tint(n, C_TREBLE)
        treble = region_brace(s, 1, 3, C_TREBLE, "fingers: melody", fs=22)
        self.play(FadeIn(treble), run_time=1.4)
        wait_until(self, 17.0)

        note = fit_label("stop competing for the same job", 8.0, 26, INK)
        note.next_to(s, DOWN, buff=0.5)
        self.play(Write(note), run_time=1.6)
        self.guard(s, bass, treble, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : follow one object — a band in one hand ──────────────────────────
class Cue01(AvoScene):
    headline = "The object: one pattern split bass ↔ melody"
    cue_duration = 145.0

    def construct(self):
        obj = fit_label("a repeating picking pattern, split between bass and melody strings",
                        11.0, 26, INK).move_to([0, 2.0, 0])
        self.play(Write(obj), run_time=2.0)
        wait_until(self, 4.0)

        band = Text("a small band in one hand", font_size=26, color=INK_MUTED).move_to([0, 1.15, 0])
        row = pima_row(fs=32, box_w=1.05, box_h=1.05, gap=0.6).move_to([0, -0.35, 0])
        self.play(FadeIn(band), run_time=1.0)
        self.play(FadeIn(row), run_time=1.2)
        wait_until(self, 8.5)

        roles = VGroup(
            fit_label("p → bass player: keeps the floor steady", 11.0, 24, C_THUMB),
            fit_label("i · m · a → upper voices: rhythm & color", 11.0, 24, C_INDEX),
        ).arrange(DOWN, buff=0.35).move_to([0, -2.35, 0])
        self.play(Indicate(row.chips["p"], color=C_THUMB, scale_factor=1.12), run_time=1.0)
        self.play(FadeIn(roles[0]), run_time=1.0)
        self.play(*[Indicate(row.chips[k], color=FINGER_COLOR[k], scale_factor=1.1)
                    for k in ("i", "m", "a")], run_time=1.2)
        self.play(FadeIn(roles[1]), run_time=1.0)
        self.guard(obj, band, row, roles)
        pace_to(self, self.cue_duration)


# ─── Cue02 : a tiny concrete example ─────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Tiny example: thumb alternates, fingers fill in"
    cue_duration = 146.0

    def construct(self):
        s = _strings()
        for n in (6, 5, 4):
            s.tint(n, C_BASS)
        for n in (3, 2, 1):
            s.tint(n, C_TREBLE)
        self.play(Create(VGroup(*s.lines.values())),
                  FadeIn(VGroup(*s.labels.values())), run_time=2.4)
        wait_until(self, 4.0)

        # thumb alternates strings 5 and 4; index/middle pluck 3/2 between them.
        events = [("p", 5, 0.10), ("i", 3, 0.28), ("p", 4, 0.46),
                  ("m", 2, 0.64), ("p", 5, 0.82), ("i", 3, 1.0)]
        dots = VGroup()
        t0 = 6.0
        for k, (letter, st, frac) in enumerate(events):
            frac = min(frac, 0.96)
            col = C_THUMB if letter == "p" else FINGER_COLOR[letter]
            p = pluck(s, st, frac, color=col, letter=letter)
            dots.add(p)
            self.play(FadeIn(p, scale=0.6), run_time=0.5)
            wait_until(self, t0 + (k + 1) * 1.6)

        legend = VGroup(
            fit_label("thumb (p): alternates bass 5 ↔ 4", 6.0, 22, C_THUMB),
            fit_label("i · m: pluck 3 / 2 between thumb notes", 6.0, 22, C_INDEX),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3).next_to(s, DOWN, buff=0.55)
        legend[1][0].set_color(C_MIDDLE)
        self.play(FadeIn(legend), run_time=1.4)
        self.guard(s, dots, legend)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the mechanism, step by step ─────────────────────────────────────
class Cue03(AvoScene):
    headline = "Build it in order: anchor, assign, then grow"
    cue_duration = 146.0

    def construct(self):
        steps = [
            "1 · anchor the picking hand, relaxed",
            "2 · assign the thumb to the bass strings",
            "3 · assign i · m · a to the treble strings",
            "4 · practice the thumb pulse alone until steady",
            "5 · add ONE finger note without disturbing the pulse",
            "6 · add the rest of the pattern slowly",
            "7 · keep the fretting hand simple until stable",
        ]
        colors = [INK, C_THUMB, C_INDEX, C_THUMB, EMERALD, INK, INK_MUTED]
        rows = VGroup(*[Text(t, font_size=24, color=c)
                        for t, c in zip(steps, colors)])
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.28).move_to([0, 0, 0])
        if rows.width > 12.0:
            rows.scale(12.0 / rows.width)
        for k, r in enumerate(rows):
            self.play(FadeIn(r, shift=RIGHT * 0.2), run_time=0.7)
            wait_until(self, 3.0 + (k + 1) * 1.8)
        box = SurroundingRectangle(rows[3], color=C_THUMB, buff=0.14, corner_radius=0.08)
        self.play(Create(box), Indicate(rows[3], color=C_THUMB, scale_factor=1.06),
                  run_time=1.4)
        self.guard(rows, box)
        pace_to(self, self.cue_duration)


# ─── Cue04 : read it as rhythm, not algebra ──────────────────────────────────
class Cue04(AvoScene):
    headline = "Count the beats: thumb lands, fingers fit between"
    cue_duration = 146.0

    def construct(self):
        # a beat ruler: 1 & 2 & 3 & 4 ; thumb on the numbers, fingers on the &'s
        slots = ["1", "&", "2", "&", "3", "&", "4", "&"]
        cells = VGroup()
        for lab in slots:
            on_beat = lab.isdigit()
            col = C_THUMB if on_beat else C_INDEX
            box = RoundedRectangle(width=1.2, height=1.0, corner_radius=0.1,
                                   stroke_color=col, stroke_width=2.4,
                                   fill_color=col, fill_opacity=0.10)
            t = Text(lab, font_size=30, color=col, weight="BOLD").move_to(box.get_center())
            cells.add(VGroup(box, t))
        cells.arrange(RIGHT, buff=0.18).move_to([0, 0.6, 0])
        if cells.width > 12.5:
            cells.scale(12.5 / cells.width)
        self.play(FadeIn(cells), run_time=2.0)
        wait_until(self, 4.0)

        # tag which digit plays each slot
        tags = VGroup()
        for i, cell in enumerate(cells):
            letter = "p" if slots[i].isdigit() else ("i" if i % 4 == 1 else "m")
            col = C_THUMB if letter == "p" else FINGER_COLOR[letter]
            tg = Text(letter, font_size=22, color=col, weight="BOLD").next_to(cell, UP, buff=0.12)
            tags.add(tg)
        self.play(FadeIn(tags), run_time=1.4)
        wait_until(self, 9.0)

        note = fit_label("test: the thumb pulse stays even when a finger note is added or removed",
                         12.0, 24, EMERALD).next_to(cells, DOWN, buff=0.8)
        self.play(Write(note), run_time=1.8)
        self.guard(cells, tags, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the common mistake ──────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "The mistake: moving every finger as one clump"
    cue_duration = 145.0

    def construct(self):
        # left: one clump (all four move together, wrong). right: independent roles.
        left_title = Text("one clump", font_size=26, color=ROSE, weight="BOLD").move_to([-3.6, 2.0, 0])
        clump = RoundedRectangle(width=2.6, height=1.4, corner_radius=0.14,
                                 stroke_color=ROSE, stroke_width=2.6,
                                 fill_color=ROSE, fill_opacity=0.14).move_to([-3.6, 0.4, 0])
        clump_t = Text("p i m a", font_size=30, color=ROSE, weight="BOLD").move_to(clump.get_center())
        cross = Text("✗ fingers glued together", font_size=22, color=ROSE).next_to(clump, DOWN, buff=0.4)

        right_title = Text("independent roles", font_size=26, color=EMERALD, weight="BOLD").move_to([3.2, 2.0, 0])
        row = pima_row(fs=30, box_w=1.0, box_h=1.0, gap=0.3).move_to([3.2, 0.4, 0])
        check = fit_label("✓ each digit a predictable job", 4.6, 22, EMERALD).next_to(row, DOWN, buff=0.4)

        self.play(FadeIn(left_title), FadeIn(clump), Write(clump_t), run_time=1.8)
        wait_until(self, 4.0)
        self.play(Indicate(VGroup(clump, clump_t), color=ROSE, scale_factor=1.08),
                  FadeIn(cross), run_time=1.4)
        wait_until(self, 8.0)
        self.play(FadeIn(right_title), FadeIn(row), run_time=1.4)
        self.play(*[Indicate(row.chips[k], color=FINGER_COLOR[k], scale_factor=1.12)
                    for k in ("p", "i", "m", "a")], run_time=1.4)
        self.play(FadeIn(check), run_time=1.0)
        self.guard(left_title, clump, clump_t, cross, right_title, row, check)
        pace_to(self, self.cue_duration)


# ─── Cue06 : division of labor (takeaway) ────────────────────────────────────
class Cue06(AvoScene):
    headline = "Fingerpicking = a division of labor"
    cue_duration = 146.0

    def construct(self):
        bass = RoundedRectangle(width=5.4, height=2.0, corner_radius=0.16,
                                stroke_color=C_THUMB, stroke_width=2.8,
                                fill_color=C_THUMB, fill_opacity=0.12).move_to([-3.1, 0.3, 0])
        bass_t = VGroup(
            Text("steady bass role", font_size=26, color=C_THUMB, weight="BOLD"),
            fit_label("thumb, low strings, the pulse", 4.8, 22, INK_MUTED),
        ).arrange(DOWN, buff=0.25).move_to(bass.get_center())

        voices = RoundedRectangle(width=5.4, height=2.0, corner_radius=0.16,
                                  stroke_color=C_INDEX, stroke_width=2.8,
                                  fill_color=C_INDEX, fill_opacity=0.12).move_to([3.1, 0.3, 0])
        voices_t = VGroup(
            Text("flexible upper voices", font_size=26, color=C_INDEX, weight="BOLD"),
            fit_label("i · m · a, treble, melody & color", 4.8, 22, INK_MUTED),
        ).arrange(DOWN, buff=0.25).move_to(voices.get_center())

        plus = Text("+", font_size=44, color=INK).move_to([0, 0.3, 0])
        self.play(FadeIn(bass), Write(bass_t), run_time=1.8)
        wait_until(self, 4.0)
        self.play(FadeIn(plus), run_time=0.6)
        self.play(FadeIn(voices), Write(voices_t), run_time=1.8)
        wait_until(self, 9.0)
        take = fit_label("not random plucking — a division of labor you can hear",
                         12.0, 26, EMERALD).next_to(VGroup(bass, voices), DOWN, buff=0.7)
        self.play(Write(take), run_time=1.8)
        self.guard(bass, bass_t, voices, voices_t, plus, take)
        pace_to(self, self.cue_duration)
