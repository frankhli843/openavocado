"""
Lesson 29 - Part 1 (activity 191): "Gbench: seed a world, let the model act,
grade the end state" (92.5s, 4 cues).

Evals as Infrastructure. An agentic eval is not a string match: Gbench seeds a
fake backend (files, tools, starting state), triggers the model as an agent that
calls tools in whatever order it likes, then reads the resulting state and
compares it to an expected end state. The harness is three parts: environment,
trigger, grader.

Cue00 0.0-24.7    seed fake files, fake tools, a known starting backend state
Cue01 24.7-49.4   trigger the model as an agent - it calls tools in any order
Cue02 49.4-74.1   read the end state and compare to expected
Cue03 74.1-92.5   env + trigger + grader - grade the world, not the words
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


# ─── Cue00 : seed the world ──────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Seed a fake world before the model runs"
    cue_duration = 24.7

    def construct(self):
        harness = service_box("Gbench harness", "sets up the sandbox", color=ACCENT,
                              w=4.6, h=1.25, fs=26).move_to([0, 2.2, 0])
        self.play(FadeIn(harness), run_time=1.6)
        wait_until(self, 4.0)

        seeds = VGroup(
            chip("fake files", color=EMERALD, w=3.4, h=0.95, fs=24),
            chip("fake tools", color=AMBER, w=3.4, h=0.95, fs=24),
            chip("known start state", color=VIOLET, w=3.8, h=0.95, fs=24),
        ).arrange(RIGHT, buff=0.5).move_to([0, -0.2, 0])
        arrows = VGroup(*[
            Arrow(harness.get_bottom(), s.get_top(), color=INK_SUBTLE, buff=0.15,
                  stroke_width=3, max_tip_length_to_length_ratio=0.12)
            for s in seeds
        ])
        for i, s in enumerate(seeds):
            self.play(GrowArrow(arrows[i]), FadeIn(s), run_time=1.6)
            wait_until(self, 8.0 + i * 4.0)

        note = fit_label("the backend starts in a state the grader already knows",
                         11.5, 24, INK_MUTED).move_to([0, -2.3, 0])
        self.play(Write(note), run_time=2.0)
        self.guard(harness, seeds, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : trigger the agent ───────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Trigger the model as an agent"
    cue_duration = 24.7

    def construct(self):
        model = service_box("the model", "acts as an agent", color=ACCENT,
                            w=3.8, h=1.2, fs=26).move_to([-4.2, 1.6, 0])
        self.play(FadeIn(model), run_time=1.4)
        wait_until(self, 4.0)

        calls = VGroup(
            chip("read_file()", color=EMERALD, w=3.6, h=0.8, fs=22),
            chip("search()", color=AMBER, w=3.6, h=0.8, fs=22),
            chip("write_record()", color=VIOLET, w=3.6, h=0.8, fs=22),
        ).arrange(DOWN, buff=0.35).move_to([2.4, 1.4, 0])
        arr = arrow_between(model, calls, color=INK_SUBTLE)
        self.play(GrowArrow(arr), run_time=1.2)
        for i, c in enumerate(calls):
            self.play(FadeIn(c), run_time=1.2)
            wait_until(self, 9.0 + i * 3.5)

        order = fit_label("the agent chooses the order of tool calls - you do not script it",
                          12.0, 23, INK).move_to([0, -1.9, 0])
        self.play(Write(order), Indicate(calls, color=ACCENT), run_time=2.2)
        self.guard(model, calls, order)
        pace_to(self, self.cue_duration)


# ─── Cue02 : compare end state ───────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Read the end state, compare to expected"
    cue_duration = 24.7

    def construct(self):
        got = service_box("resulting state", "what the agent left behind", color=ACCENT,
                         w=4.2, h=1.2, fs=25).move_to([-3.4, 1.4, 0])
        want = service_box("expected state", "the grader's answer key", color=EMERALD,
                         w=4.2, h=1.2, fs=25).move_to([3.4, 1.4, 0])
        self.play(FadeIn(got), run_time=1.4)
        self.play(FadeIn(want), run_time=1.4)
        wait_until(self, 6.0)

        cmp = Text("compare", font_size=30, color=AMBER, weight="BOLD").move_to([0, 1.4, 0])
        a1 = Arrow(got.get_right(), cmp.get_left(), color=INK_SUBTLE, buff=0.2, stroke_width=3)
        a2 = Arrow(want.get_left(), cmp.get_right(), color=INK_SUBTLE, buff=0.2, stroke_width=3)
        self.play(GrowArrow(a1), GrowArrow(a2), FadeIn(cmp), run_time=1.8)
        wait_until(self, 12.0)

        verdict = VGroup(
            chip("match  ->  pass", color=EMERALD, w=4.4, h=0.95, fs=25),
            chip("differ  ->  fail", color=ROSE, w=4.4, h=0.95, fs=25),
        ).arrange(RIGHT, buff=0.7).move_to([0, -1.6, 0])
        self.play(FadeIn(verdict), run_time=1.8)
        self.play(Circumscribe(verdict[0], color=EMERALD), run_time=1.6)
        self.guard(got, want, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue03 : harness anatomy ─────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Environment + trigger + grader"
    cue_duration = 18.5

    def construct(self):
        parts = VGroup(
            chip("environment", color=VIOLET, w=3.6, h=1.0, fs=24),
            chip("trigger", color=ACCENT, w=3.6, h=1.0, fs=24),
            chip("grader", color=EMERALD, w=3.6, h=1.0, fs=24),
        ).arrange(RIGHT, buff=0.5).move_to([0, 1.3, 0])
        arr = VGroup(*[
            Arrow(parts[i].get_right(), parts[i + 1].get_left(), color=INK_SUBTLE,
                  buff=0.12, stroke_width=3) for i in range(2)
        ])
        self.play(FadeIn(parts[0]), run_time=1.0)
        self.play(GrowArrow(arr[0]), FadeIn(parts[1]), run_time=1.2)
        self.play(GrowArrow(arr[1]), FadeIn(parts[2]), run_time=1.2)
        wait_until(self, 7.0)

        contrast = fit_label("agentic eval grades what the model DID - not a string match on the answer",
                             12.5, 24, INK).move_to([0, -1.4, 0])
        self.play(Write(contrast), run_time=2.4)
        self.guard(parts, contrast)
        pace_to(self, self.cue_duration)
