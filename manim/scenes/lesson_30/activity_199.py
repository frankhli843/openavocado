"""
Lesson 30 - Part 3 (activity 199): "Designing agentic evals that stay honest"
(103.46s, 5 cues).

Seed a fake environment with a known start state, trigger the agent, and check
the final state against the expected end state, so a pass has one correct
answer just like Gbench. Guard the score: if the eval leaks into training the
model memorizes it and the number is worthless, so hold out a test set the model
never trained on to measure generalization. And an eval worth building: a
context-disclosure privacy eval that scores whether an agent stays within the
disclosure boundary for each audience.

Cue00 0.0-21.78     seed a world, trigger, check final state
Cue01 21.78-43.56   the state check makes pass and fail unambiguous
Cue02 43.56-65.34   contamination: leaked answers inflate the score
Cue03 65.34-87.12   hold out a test set to measure generalization
Cue04 87.12-103.46  a context-disclosure privacy eval
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from bayes import chip, fit_label
from cloud import service_box, arrow_between
from manim import (
    VGroup, Text, MathTex, Arrow, RoundedRectangle, SurroundingRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, GrowArrow, Create,
    RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def block(label, color, w=2.6, h=0.9, fs=23, fill=0.16):
    b = RoundedRectangle(width=w, height=h, corner_radius=0.12, stroke_color=color,
                         stroke_width=2.4, fill_color=color, fill_opacity=fill)
    t = fit_label(label, w - 0.28, fs, INK).move_to(b.get_center())
    return VGroup(b, t)


# ─── Cue00 : seed, trigger, check ────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Seed a world, trigger the agent, check the state"
    cue_duration = 21.78

    def construct(self):
        steps = VGroup(
            block("seed known\nstart state", VIOLET, w=3.2, h=1.2, fs=22),
            block("trigger the\nagent", ACCENT, w=3.2, h=1.2, fs=22),
            block("check final\nvs expected", EMERALD, w=3.2, h=1.2, fs=22),
        ).arrange(RIGHT, buff=0.6).move_to([0, 0.6, 0])
        arr = VGroup(*[
            Arrow(steps[i].get_right(), steps[i + 1].get_left(), color=INK_SUBTLE,
                  buff=0.12, stroke_width=3) for i in range(2)
        ])
        self.play(FadeIn(steps[0]), run_time=1.4)
        self.play(GrowArrow(arr[0]), FadeIn(steps[1]), run_time=1.6)
        self.play(GrowArrow(arr[1]), FadeIn(steps[2]), run_time=1.6)
        wait_until(self, 13.0)
        note = fit_label("score the world the agent left behind, not the words it said",
                         12.0, 23, INK).move_to([0, -1.6, 0])
        self.play(Write(note), run_time=2.2)
        self.guard(steps, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : state check ─────────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "The state check makes pass and fail unambiguous"
    cue_duration = 21.78

    def construct(self):
        got = block("actual end state", ACCENT, w=4.4, h=1.1, fs=24).move_to([-3.4, 0.7, 0])
        want = block("expected end state", EMERALD, w=4.4, h=1.1, fs=24).move_to([3.4, 0.7, 0])
        eq = Text("=?", font_size=34, color=AMBER, weight="BOLD").move_to([0, 0.7, 0])
        self.play(FadeIn(got), FadeIn(want), run_time=1.6)
        self.play(FadeIn(eq), run_time=1.0)
        wait_until(self, 10.0)
        note = fit_label("one correct answer, just like Gbench", 8.5, 24, INK).move_to([0, -1.4, 0])
        self.play(Write(note), run_time=2.2)
        self.guard(got, want, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : contamination ───────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Contamination: leaked answers inflate the score"
    cue_duration = 21.78

    def construct(self):
        evalbox = block("eval data", AMBER, w=3.2, h=1.0, fs=24).move_to([-3.4, 1.2, 0])
        train = block("training data", ROSE, w=3.6, h=1.0, fs=24).move_to([3.0, 1.2, 0])
        leak = Arrow(evalbox.get_right(), train.get_left(), color=ROSE, buff=0.15, stroke_width=3)
        leak_cap = fit_label("leak", 2.0, 20, ROSE).next_to(leak, UP, buff=0.1)
        self.play(FadeIn(evalbox), FadeIn(train), run_time=1.6)
        self.play(GrowArrow(leak), FadeIn(leak_cap), run_time=1.4)
        wait_until(self, 10.0)
        memo = block("model memorizes the answers", ROSE, w=6.4, h=1.0, fs=23).move_to([0, -0.6, 0])
        self.play(FadeIn(memo), Indicate(memo, color=ROSE), run_time=1.8)
        wait_until(self, 16.0)
        note = fit_label("the inflated score is worthless", 7.5, 23, AMBER).move_to([0, -2.2, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(evalbox, train, memo, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : hold out ────────────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Hold out a test set to measure generalization"
    cue_duration = 21.78

    def construct(self):
        train = block("training set", ACCENT, w=4.0, h=1.1, fs=24).move_to([-3.2, 0.8, 0])
        held = block("held-out test set", EMERALD, w=4.4, h=1.1, fs=24).move_to([3.2, 0.8, 0])
        wall = RoundedRectangle(width=0.16, height=2.2, corner_radius=0.06, stroke_width=0,
                                fill_color=INK_SUBTLE, fill_opacity=0.8).move_to([0, 0.4, 0])
        self.play(FadeIn(train), run_time=1.2)
        self.play(Create(wall), run_time=1.0)
        self.play(FadeIn(held), run_time=1.2)
        wait_until(self, 11.0)
        note = fit_label("the model never trained on it, so the score measures generalization",
                         12.5, 22, INK).move_to([0, -1.4, 0])
        self.play(Write(note), Indicate(held, color=EMERALD), run_time=2.4)
        self.guard(train, held, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : privacy eval ────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "A context-disclosure privacy eval"
    cue_duration = 16.34

    def construct(self):
        agent = block("the agent", ACCENT, w=3.2, h=1.0, fs=24).move_to([0, 2.0, 0])
        self.play(FadeIn(agent), run_time=1.2)
        wait_until(self, 4.0)
        audiences = VGroup(
            chip("wife", color=EMERALD, w=2.4, h=0.8, fs=22),
            chip("friend", color=ACCENT, w=2.4, h=0.8, fs=22),
            chip("colleague", color=AMBER, w=2.8, h=0.8, fs=22),
            chip("stranger", color=ROSE, w=2.6, h=0.8, fs=22),
        ).arrange(RIGHT, buff=0.35).move_to([0, 0.4, 0])
        arrs = VGroup(*[
            Arrow(agent.get_bottom(), a.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=2.4)
            for a in audiences
        ])
        self.play(*[GrowArrow(a) for a in arrs], FadeIn(audiences, lag_ratio=0.15), run_time=2.2)
        wait_until(self, 13.0)
        note = fit_label("score whether it stays within the disclosure boundary for each audience",
                         13.0, 22, INK).move_to([0, -1.6, 0])
        self.play(Write(note), run_time=2.4)
        self.guard(agent, audiences, note)
        pace_to(self, self.cue_duration)
