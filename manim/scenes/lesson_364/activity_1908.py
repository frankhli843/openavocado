"""
Lesson 364 activity 1908: Identifying motivators and reward hierarchy.

One ManimCE scene per storyboard cue. These are diagram scenes, not caption
slides: each cue shows the learner a changing training object, reward ranking,
or environment choice that matches the narration.
"""

from manim import (
    VGroup,
    RoundedRectangle,
    Circle,
    Triangle,
    Line,
    Arrow,
    Text,
    Dot,
    Rectangle,
    FadeIn,
    FadeOut,
    Write,
    GrowArrow,
    Create,
    Transform,
    Indicate,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
)

from pacing import pace_to
from theme import (
    AvoScene,
    ACCENT,
    AMBER,
    EMERALD,
    ROSE,
    VIOLET,
    INK,
    INK_MUTED,
    LABEL_SIZE,
    BODY_SIZE,
    fit_to_stage,
    highlight,
)


def label(text, size=BODY_SIZE, color=INK):
    return Text(text, font_size=size, color=color)


def card(title, value, color, width=2.35, height=1.25):
    box = RoundedRectangle(
        width=width,
        height=height,
        corner_radius=0.14,
        stroke_color=color,
        stroke_width=2.5,
        fill_color=color,
        fill_opacity=0.16,
    )
    t = label(title, 24, INK).move_to(box.get_center() + UP * 0.24)
    v = label(value, 20, INK_MUTED).move_to(box.get_center() + DOWN * 0.24)
    return VGroup(box, t, v)


def dog(color=ACCENT):
    body = RoundedRectangle(
        width=1.35,
        height=0.78,
        corner_radius=0.22,
        stroke_color=color,
        stroke_width=3,
        fill_color=color,
        fill_opacity=0.16,
    )
    head = Circle(radius=0.36, stroke_color=color, stroke_width=3, fill_color=color, fill_opacity=0.16)
    head.next_to(body, RIGHT, buff=-0.03).shift(UP * 0.16)
    ear = Triangle(stroke_color=color, fill_color=color, fill_opacity=0.2).scale(0.18)
    ear.rotate(0.6).move_to(head.get_top() + LEFT * 0.08 + DOWN * 0.02)
    tail = Line(body.get_left() + LEFT * 0.02 + UP * 0.2, body.get_left() + LEFT * 0.42 + UP * 0.5, color=color, stroke_width=4)
    eye = Dot(head.get_center() + RIGHT * 0.11 + UP * 0.08, radius=0.035, color=INK)
    legs = VGroup(
        Line(body.get_bottom() + LEFT * 0.36, body.get_bottom() + LEFT * 0.36 + DOWN * 0.26, color=color, stroke_width=4),
        Line(body.get_bottom() + RIGHT * 0.28, body.get_bottom() + RIGHT * 0.28 + DOWN * 0.26, color=color, stroke_width=4),
    )
    return VGroup(body, head, ear, tail, eye, legs)


def meter(label_text, level, color):
    frame = RoundedRectangle(width=4.8, height=0.46, corner_radius=0.12, stroke_color=INK_MUTED, stroke_width=1.6)
    fill = Rectangle(width=4.55 * level, height=0.29, fill_color=color, fill_opacity=0.85, stroke_width=0)
    fill.move_to(frame.get_left() + RIGHT * (0.14 + fill.width / 2))
    name = label(label_text, 23, INK).next_to(frame, LEFT, buff=0.35)
    return VGroup(name, frame, fill)


class Cue00(AvoScene):
    headline = "Every dog has a different reward profile"
    cue_duration = 27.46

    def construct(self):
        pup = dog(ACCENT).scale(1.25).shift(LEFT * 3.2)
        rewards = VGroup(
            card("Kibble", "okay", ACCENT),
            card("Tug toy", "maybe", VIOLET),
            card("Chicken", "wow", EMERALD),
        ).arrange(DOWN, buff=0.35).shift(RIGHT * 2.4)
        arrows = VGroup(*[Arrow(pup.get_right(), r.get_left(), buff=0.18, color=r[0].get_stroke_color(), stroke_width=3) for r in rewards])
        title = label("Find what lights up this dog", 30, INK).next_to(pup, DOWN, buff=0.55)
        self.play(FadeIn(pup), Write(title), run_time=1.3)
        self.play(FadeIn(rewards), run_time=1.1)
        self.play(*[GrowArrow(a) for a in arrows], run_time=1.2)
        highlight(self, rewards[2], color=EMERALD, run_time=0.8)
        self.guard(pup, rewards, arrows, title)
        pace_to(self, self.cue_duration)


class Cue01(AvoScene):
    headline = "Observe enthusiasm, speed, and focus"
    cue_duration = 27.46

    def construct(self):
        pup = dog(ACCENT).scale(0.95).shift(LEFT * 4.2 + UP * 0.4)
        low = card("Kibble trial", "slow sit, wandering eyes", ACCENT, width=3.1).shift(RIGHT * 0.3 + UP * 1.15)
        high = card("Chicken trial", "fast sit, eyes return", EMERALD, width=3.1).shift(RIGHT * 0.3 + DOWN * 0.65)
        speed = meter("response speed", 0.82, EMERALD).scale(0.72).shift(RIGHT * 2.1 + UP * 1.95)
        focus = meter("focus hold", 0.72, AMBER).scale(0.72).shift(RIGHT * 2.1 + DOWN * 1.65)
        path1 = Arrow(pup.get_right(), low.get_left(), buff=0.15, color=ACCENT)
        path2 = Arrow(pup.get_right() + DOWN * 0.15, high.get_left(), buff=0.15, color=EMERALD)
        self.play(FadeIn(pup), FadeIn(low), GrowArrow(path1), run_time=1.4)
        self.play(Transform(low.copy(), high), FadeIn(high), GrowArrow(path2), run_time=1.3)
        self.play(FadeIn(speed), FadeIn(focus), run_time=1.0)
        highlight(self, high, color=EMERALD, run_time=0.8)
        self.guard(pup, low, high, speed, focus, path1, path2)
        pace_to(self, self.cue_duration)


class Cue02(AvoScene):
    headline = "Turn observations into a reward ladder"
    cue_duration = 27.46

    def construct(self):
        low = card("Low value", "dry kibble", ACCENT).shift(LEFT * 3.3 + DOWN * 1.0)
        mid = card("Medium value", "training treat", AMBER).shift(ORIGIN)
        high = card("High value", "boiled chicken", EMERALD).shift(RIGHT * 3.3 + UP * 1.0)
        ladder = VGroup(low, mid, high)
        ramp = Arrow(low.get_right(), high.get_left(), buff=0.15, color=INK_MUTED, stroke_width=5)
        label_low = label("easy / quiet", 23, INK_MUTED).next_to(low, DOWN, buff=0.25)
        label_high = label("hard / distracting", 23, INK_MUTED).next_to(high, UP, buff=0.25)
        self.play(FadeIn(low), run_time=0.8)
        self.play(FadeIn(mid), run_time=0.8)
        self.play(FadeIn(high), GrowArrow(ramp), run_time=1.0)
        self.play(Write(label_low), Write(label_high), run_time=0.8)
        highlight(self, ladder, color=AMBER, run_time=0.8)
        self.guard(ladder, ramp, label_low, label_high)
        pace_to(self, self.cue_duration)


class Cue03(AvoScene):
    headline = "Concrete reward examples live on the ladder"
    cue_duration = 27.46

    def construct(self):
        axis = Line(LEFT * 5, RIGHT * 5, color=INK_MUTED, stroke_width=4).shift(DOWN * 1.0)
        ticks = VGroup()
        items = [
            ("Kibble", ACCENT, -3.7, "low"),
            ("Treat", AMBER, 0, "medium"),
            ("Chicken", EMERALD, 3.7, "high"),
        ]
        for name, color, x, tag in items:
            dot = Dot([x, -1.0, 0], radius=0.11, color=color)
            c = card(name, tag, color, width=2.0, height=1.05).move_to([x, 0.55, 0])
            ticks.add(VGroup(dot, c, Line(dot.get_top(), c.get_bottom(), color=color, stroke_width=2)))
        low_label = label("low appeal", 20, INK_MUTED).move_to(axis.get_left() + RIGHT * 0.65 + DOWN * 0.34)
        high_label = label("high appeal", 20, INK_MUTED).move_to(axis.get_right() + LEFT * 0.65 + DOWN * 0.34)
        self.play(Create(axis), Write(low_label), Write(high_label), run_time=1.1)
        self.play(FadeIn(ticks[0]), FadeIn(ticks[1]), FadeIn(ticks[2]), run_time=1.4)
        highlight(self, ticks[2], color=EMERALD, run_time=0.8)
        self.guard(axis, ticks, low_label, high_label)
        pace_to(self, self.cue_duration)


class Cue04(AvoScene):
    headline = "Match reward value to task difficulty and distraction"
    cue_duration = 27.46

    def construct(self):
        easy = card("Easy cue", "sit in kitchen", ACCENT, width=2.8).shift(LEFT * 4 + UP * 1.25)
        hard = card("Hard cue", "come at park", ROSE, width=2.8).shift(LEFT * 4 + DOWN * 1.05)
        low = card("Kibble", "enough here", ACCENT, width=2.2).shift(RIGHT * 3.4 + UP * 1.25)
        high = card("Chicken", "needed here", EMERALD, width=2.2).shift(RIGHT * 3.4 + DOWN * 1.05)
        a1 = Arrow(easy.get_right(), low.get_left(), buff=0.2, color=ACCENT, stroke_width=4)
        a2 = Arrow(hard.get_right(), high.get_left(), buff=0.2, color=EMERALD, stroke_width=4)
        diff = meter("difficulty", 0.82, ROSE).scale(0.67).shift(DOWN * 2.35)
        dist = meter("distraction", 0.74, AMBER).scale(0.67).shift(DOWN * 2.95)
        self.play(FadeIn(easy), FadeIn(hard), run_time=1.0)
        self.play(FadeIn(low), FadeIn(high), GrowArrow(a1), GrowArrow(a2), run_time=1.4)
        self.play(FadeIn(diff), FadeIn(dist), run_time=0.9)
        highlight(self, high, color=EMERALD, run_time=0.8)
        self.guard(easy, hard, low, high, a1, a2, diff, dist)
        pace_to(self, self.cue_duration)


class Cue05(AvoScene):
    headline = "Tailored rewards create focus and willingness"
    cue_duration = 27.46

    def construct(self):
        before = dog(INK_MUTED).scale(0.9).shift(LEFT * 4 + UP * 0.55)
        after = dog(EMERALD).scale(0.9).shift(RIGHT * 3.7 + UP * 0.55)
        plan = card("Matched reward", "right value, right moment", EMERALD, width=3.2).shift(ORIGIN + DOWN * 0.15)
        a1 = Arrow(before.get_right(), plan.get_left(), buff=0.2, color=AMBER, stroke_width=4)
        a2 = Arrow(plan.get_right(), after.get_left(), buff=0.2, color=EMERALD, stroke_width=4)
        before_lbl = label("distracted", 24, INK_MUTED).next_to(before, DOWN, buff=0.45)
        after_lbl = label("focused", 24, EMERALD).next_to(after, DOWN, buff=0.45)
        self.play(FadeIn(before), Write(before_lbl), run_time=1.0)
        self.play(FadeIn(plan), GrowArrow(a1), run_time=1.0)
        self.play(FadeIn(after), Write(after_lbl), GrowArrow(a2), run_time=1.0)
        self.play(Indicate(after, color=EMERALD, scale_factor=1.12), run_time=0.8)
        self.guard(before, after, plan, a1, a2, before_lbl, after_lbl)
        pace_to(self, self.cue_duration)
