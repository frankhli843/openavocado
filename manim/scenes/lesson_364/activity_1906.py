"""
Lesson 364 activity 1906: Positive reinforcement overview.

These ManimCE scenes replace the emergency text-only MP4 with diagrammatic
3Blue1Brown-style visuals. Each cue shows an object changing: cue -> behavior ->
reward, timing windows, reward value, consistency, and the final learning loop.
"""

from manim import (
    VGroup,
    RoundedRectangle,
    Circle,
    Triangle,
    Line,
    Arrow,
    CurvedArrow,
    Text,
    MathTex,
    Dot,
    Rectangle,
    NumberLine,
    FadeIn,
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
    FORMULA_SIZE_SMALL,
    fit_to_stage,
    highlight,
)


def text(value, size=BODY_SIZE, color=INK):
    return Text(value, font_size=size, color=color)


def box(title, subtitle, color, width=2.7, height=1.25):
    rect = RoundedRectangle(
        width=width,
        height=height,
        corner_radius=0.15,
        stroke_color=color,
        stroke_width=2.6,
        fill_color=color,
        fill_opacity=0.15,
    )
    t = text(title, 25, INK).move_to(rect.get_center() + UP * 0.24)
    s = text(subtitle, 19, INK_MUTED).move_to(rect.get_center() + DOWN * 0.24)
    return VGroup(rect, t, s)


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


def training_loop():
    cue = box("Antecedent", "you say sit", ACCENT).shift(LEFT * 4.1 + UP * 1.0)
    behavior = box("Behavior", "dog sits", AMBER).shift(ORIGIN + UP * 1.0)
    reward = box("Consequence", "treat appears", EMERALD).shift(RIGHT * 4.1 + UP * 1.0)
    future = box("Future", "sit becomes likelier", VIOLET, width=3.2).shift(DOWN * 1.35)
    arrows = VGroup(
        Arrow(cue.get_right(), behavior.get_left(), buff=0.18, color=ACCENT, stroke_width=4),
        Arrow(behavior.get_right(), reward.get_left(), buff=0.18, color=AMBER, stroke_width=4),
        Arrow(reward.get_bottom(), future.get_right(), buff=0.2, color=EMERALD, stroke_width=4),
        CurvedArrow(future.get_left(), cue.get_bottom(), color=VIOLET, stroke_width=4, angle=-1.2),
    )
    return VGroup(cue, behavior, reward, future), arrows


class Cue00(AvoScene):
    headline = "Positive reinforcement changes the next choice"
    cue_duration = 131.3

    def construct(self):
        loop, arrows = training_loop()
        self.play(FadeIn(loop[0]), run_time=0.7)
        self.play(GrowArrow(arrows[0]), FadeIn(loop[1]), run_time=0.9)
        self.play(GrowArrow(arrows[1]), FadeIn(loop[2]), run_time=0.9)
        self.play(GrowArrow(arrows[2]), FadeIn(loop[3]), Create(arrows[3]), run_time=1.2)
        highlight(self, loop[3], color=VIOLET, run_time=0.8)
        self.guard(loop, arrows)
        pace_to(self, self.cue_duration)


class Cue01(AvoScene):
    headline = "The metaphor: a workshop where rewards tune behavior"
    cue_duration = 130.136

    def construct(self):
        workbench = RoundedRectangle(width=8.8, height=3.0, corner_radius=0.18, stroke_color=INK_MUTED, stroke_width=2, fill_color="#202431", fill_opacity=0.7)
        workbench.shift(DOWN * 0.15)
        pup = dog(ACCENT).scale(0.85).shift(LEFT * 3.6 + DOWN * 0.25)
        lever = box("Signal", "sit cue", ACCENT, width=1.9).shift(LEFT * 1.25 + UP * 0.65)
        outcome = box("Feedback", "reward", EMERALD, width=1.9).shift(RIGHT * 1.25 + UP * 0.65)
        dial = VGroup(Circle(radius=0.45, stroke_color=AMBER, stroke_width=3), Line(ORIGIN, UP * 0.35, color=AMBER, stroke_width=4)).shift(RIGHT * 3.6 + DOWN * 0.25)
        dial_label = text("motivation dial", 22, AMBER).next_to(dial, DOWN, buff=0.25)
        a1 = Arrow(pup.get_right(), lever.get_left(), buff=0.2, color=ACCENT)
        a2 = Arrow(lever.get_right(), outcome.get_left(), buff=0.2, color=EMERALD)
        a3 = Arrow(outcome.get_right(), dial.get_left(), buff=0.2, color=AMBER)
        self.play(FadeIn(workbench), FadeIn(pup), run_time=0.9)
        self.play(FadeIn(lever), GrowArrow(a1), FadeIn(outcome), GrowArrow(a2), run_time=1.3)
        self.play(FadeIn(dial), Write(dial_label), GrowArrow(a3), run_time=1.0)
        self.play(Indicate(dial, color=AMBER, scale_factor=1.15), run_time=0.8)
        self.guard(workbench, pup, lever, outcome, dial, dial_label, a1, a2, a3)
        pace_to(self, self.cue_duration)


class Cue02(AvoScene):
    headline = "Follow one concrete object: the sit cue"
    cue_duration = 131.3

    def construct(self):
        before = dog(INK_MUTED).scale(0.78).shift(LEFT * 4.6)
        cue = box("Cue", "sit", ACCENT, width=1.8).shift(LEFT * 2.15)
        action = dog(AMBER).scale(0.78).shift(RIGHT * 0.15)
        reward = box("Reward", "treat now", EMERALD, width=2.1).shift(RIGHT * 3.25)
        memory = box("Memory trace", "sit paid off", VIOLET, width=2.6).shift(DOWN * 2.0)
        arrows = VGroup(
            Arrow(before.get_right(), cue.get_left(), buff=0.18, color=ACCENT),
            Arrow(cue.get_right(), action.get_left(), buff=0.18, color=AMBER),
            Arrow(action.get_right(), reward.get_left(), buff=0.18, color=EMERALD),
            Arrow(reward.get_bottom(), memory.get_top(), buff=0.2, color=VIOLET),
        )
        self.play(FadeIn(before), FadeIn(cue), GrowArrow(arrows[0]), run_time=1.0)
        self.play(FadeIn(action), GrowArrow(arrows[1]), run_time=1.0)
        self.play(FadeIn(reward), GrowArrow(arrows[2]), run_time=1.0)
        self.play(FadeIn(memory), GrowArrow(arrows[3]), run_time=0.9)
        highlight(self, memory, color=VIOLET, run_time=0.8)
        self.guard(before, cue, action, reward, memory, arrows)
        pace_to(self, self.cue_duration)


class Cue03(AvoScene):
    headline = "Mechanism: timing links behavior to consequence"
    cue_duration = 130.136

    def construct(self):
        line = NumberLine(x_range=[0, 5, 1], length=8.8, color=INK_MUTED, include_numbers=True).shift(DOWN * 0.8)
        behavior = Dot(line.n2p(1.0), color=AMBER, radius=0.13)
        reward_good = Dot(line.n2p(1.4), color=EMERALD, radius=0.13)
        reward_late = Dot(line.n2p(4.2), color=ROSE, radius=0.13)
        window = RoundedRectangle(width=1.35, height=0.72, corner_radius=0.12, stroke_color=EMERALD, fill_color=EMERALD, fill_opacity=0.12)
        window.move_to(line.n2p(1.25) + UP * 0.65)
        lbl_b = text("sit", 24, AMBER).next_to(behavior, UP, buff=0.35)
        lbl_g = text("clear reward", 22, EMERALD).next_to(reward_good, DOWN, buff=0.35)
        lbl_l = text("too late", 22, ROSE).next_to(reward_late, DOWN, buff=0.35)
        self.play(Create(line), run_time=0.9)
        self.play(FadeIn(behavior), Write(lbl_b), run_time=0.8)
        self.play(FadeIn(window), FadeIn(reward_good), Write(lbl_g), run_time=0.9)
        self.play(FadeIn(reward_late), Write(lbl_l), run_time=0.8)
        highlight(self, window, color=EMERALD, run_time=0.8)
        self.guard(line, behavior, reward_good, reward_late, window, lbl_b, lbl_g, lbl_l)
        pace_to(self, self.cue_duration)


class Cue04(AvoScene):
    headline = "Reward value, timing clarity, and consistency multiply"
    cue_duration = 131.3

    def construct(self):
        formula = fit_to_stage(
            MathTex(
                r"P(\text{behavior repeats})",
                r"\propto",
                r"\text{Reward value}",
                r"\times",
                r"\text{Timing clarity}",
                r"\times",
                r"\text{Consistency}",
                font_size=FORMULA_SIZE_SMALL,
                color=INK,
            ),
            width_frac=0.95,
        ).shift(UP * 1.15)
        formula[0].set_color(VIOLET)
        formula[2].set_color(EMERALD)
        formula[4].set_color(AMBER)
        formula[6].set_color(ACCENT)
        bars = VGroup(
            box("Value", "is it worth it?", EMERALD, width=2.4).shift(LEFT * 3.7 + DOWN * 1.0),
            box("Timing", "was that it?", AMBER, width=2.4).shift(DOWN * 1.0),
            box("Consistency", "does this rule hold?", ACCENT, width=2.75).shift(RIGHT * 3.65 + DOWN * 1.0),
        )
        self.play(Write(formula), run_time=1.8)
        self.play(FadeIn(bars), run_time=1.2)
        highlight(self, formula[2], color=EMERALD, run_time=0.7)
        highlight(self, formula[4], color=AMBER, run_time=0.7)
        highlight(self, formula[6], color=ACCENT, run_time=0.7)
        self.guard(formula, bars)
        pace_to(self, self.cue_duration)


class Cue05(AvoScene):
    headline = "Implementation: choose the reward for the context"
    cue_duration = 130.136

    def construct(self):
        context = box("Context", "quiet kitchen", ACCENT, width=2.55).shift(LEFT * 4 + UP * 1.0)
        harder = box("Context", "busy park", ROSE, width=2.55).shift(LEFT * 4 + DOWN * 1.0)
        low = box("Reward", "kibble", ACCENT, width=2.2).shift(RIGHT * 3.5 + UP * 1.0)
        high = box("Reward", "chicken", EMERALD, width=2.2).shift(RIGHT * 3.5 + DOWN * 1.0)
        a1 = Arrow(context.get_right(), low.get_left(), buff=0.2, color=ACCENT, stroke_width=4)
        a2 = Arrow(harder.get_right(), high.get_left(), buff=0.2, color=EMERALD, stroke_width=4)
        code = text("if context is harder, raise reward value", 25, INK_MUTED).shift(DOWN * 2.6)
        self.play(FadeIn(context), FadeIn(harder), run_time=1.0)
        self.play(FadeIn(low), GrowArrow(a1), run_time=0.9)
        self.play(FadeIn(high), GrowArrow(a2), run_time=0.9)
        self.play(Write(code), run_time=0.9)
        highlight(self, high, color=EMERALD, run_time=0.8)
        self.guard(context, harder, low, high, a1, a2, code)
        pace_to(self, self.cue_duration)


class Cue06(AvoScene):
    headline = "Misconception: reward is not bribery"
    cue_duration = 131.3

    def construct(self):
        bribe = box("Bribe", "shown before choice", ROSE, width=2.7).shift(LEFT * 3.5 + UP * 0.6)
        reinforce = box("Reinforcer", "arrives after behavior", EMERALD, width=3.2).shift(RIGHT * 3.1 + UP * 0.6)
        behavior = dog(AMBER).scale(0.78).shift(DOWN * 1.5)
        bad = Arrow(bribe.get_bottom(), behavior.get_left(), buff=0.2, color=ROSE)
        good = Arrow(behavior.get_right(), reinforce.get_bottom(), buff=0.2, color=EMERALD)
        divider = Line(UP * 2.4, DOWN * 2.4, color=INK_MUTED, stroke_width=2)
        self.play(FadeIn(divider), FadeIn(bribe), FadeIn(reinforce), run_time=1.0)
        self.play(FadeIn(behavior), GrowArrow(bad), GrowArrow(good), run_time=1.2)
        self.play(Indicate(good, color=EMERALD, scale_factor=1.1), run_time=0.8)
        self.guard(bribe, reinforce, behavior, bad, good, divider)
        pace_to(self, self.cue_duration)


class Cue07(AvoScene):
    headline = "Synthesis: the loop gets stronger when all pieces align"
    cue_duration = 130.136

    def construct(self):
        loop, arrows = training_loop()
        loop.scale(0.88).shift(UP * 0.1)
        keys = VGroup(
            box("Value", "dog cares", EMERALD, width=2.1, height=1.0),
            box("Timing", "right away", AMBER, width=2.1, height=1.0),
            box("Consistency", "same rule", ACCENT, width=2.35, height=1.0),
        ).arrange(RIGHT, buff=0.55).shift(DOWN * 2.65)
        self.play(
            FadeIn(loop),
            GrowArrow(arrows[0]),
            GrowArrow(arrows[1]),
            GrowArrow(arrows[2]),
            Create(arrows[3]),
            run_time=1.8,
        )
        self.play(FadeIn(keys), run_time=1.0)
        self.play(Indicate(loop[3], color=VIOLET, scale_factor=1.08), run_time=0.8)
        self.guard(loop, arrows, keys)
        pace_to(self, self.cue_duration)
