"""
Lesson 30 - Part 1 (activity 197): "Single-turn versus multi-turn, and who owns
the eval" (95.28s, 5 cues).

A model can ace every single-turn question and still fall over the moment it
runs as an agent, because a single-turn eval grades one response in isolation
while an agentic task carries state across turns and a tool call spans turns.
BFCL v3 added multi-turn state checks; the FunctionGemma docs admit multi-turn
is unsupported. The org root cause: two teams disagreed on scope, so the
multi-turn eval had no owner and the gap shipped.

Cue00 0.0-19.1    green single-turn score, broken agent
Cue01 19.1-38.2   single-turn grades one response in isolation
Cue02 38.2-57.3   a tool call spans turns
Cue03 57.3-76.4   BFCL v3 checks state across turns
Cue04 76.4-95.3   nobody owned the eval, so the gap shipped
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


# ─── Cue00 : green score, broken agent ───────────────────────────────────────
class Cue00(AvoScene):
    headline = "Green single-turn score, broken agent"
    cue_duration = 19.1

    def construct(self):
        score = block("single-turn score: 98%", EMERALD, w=5.4, h=1.1, fs=25).move_to([0, 1.6, 0])
        self.play(FadeIn(score), run_time=1.4)
        self.play(Indicate(score, color=EMERALD), run_time=1.2)
        wait_until(self, 6.0)

        agent = block("runs as an agent: falls over", ROSE, w=6.0, h=1.1, fs=25).move_to([0, -0.4, 0])
        arr = Arrow(score.get_bottom(), agent.get_top(), color=INK_SUBTLE, buff=0.15, stroke_width=3)
        self.play(GrowArrow(arr), FadeIn(agent), run_time=1.8)
        self.play(Indicate(agent, color=ROSE), run_time=1.4)
        wait_until(self, 13.0)

        q = fit_label("how can both be true at once?", 8.0, 24, AMBER).move_to([0, -2.2, 0])
        self.play(Write(q), run_time=2.0)
        self.guard(score, agent, q)
        pace_to(self, self.cue_duration)


# ─── Cue01 : single-turn in isolation ────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Single-turn grades one response in isolation"
    cue_duration = 19.1

    def construct(self):
        prompt = block("one prompt", ACCENT, w=3.4, h=1.0, fs=24).move_to([-3.6, 0.6, 0])
        resp = block("one graded response", EMERALD, w=4.4, h=1.0, fs=24).move_to([3.0, 0.6, 0])
        arr = arrow_between(prompt, resp, color=INK_SUBTLE)
        self.play(FadeIn(prompt), run_time=1.2)
        self.play(GrowArrow(arr), FadeIn(resp), run_time=1.6)
        wait_until(self, 9.0)

        note = fit_label("everything the model needs is already present, no state to carry",
                         12.0, 23, INK_MUTED).move_to([0, -1.4, 0])
        self.play(Write(note), run_time=2.4)
        self.guard(prompt, resp, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : tool call spans turns ───────────────────────────────────────────
class Cue02(AvoScene):
    headline = "A tool call spans turns"
    cue_duration = 19.1

    def construct(self):
        turns = VGroup(
            block("turn 1\nrequest a tool", ACCENT, w=3.4, h=1.2, fs=22),
            block("turn 2\nget the result", AMBER, w=3.4, h=1.2, fs=22),
            block("turn 3\nreuse it", EMERALD, w=3.4, h=1.2, fs=22),
        ).arrange(RIGHT, buff=0.5).move_to([0, 0.6, 0])
        arr = VGroup(*[
            Arrow(turns[i].get_right(), turns[i + 1].get_left(), color=INK_SUBTLE,
                  buff=0.12, stroke_width=3) for i in range(2)
        ])
        self.play(FadeIn(turns[0]), run_time=1.2)
        self.play(GrowArrow(arr[0]), FadeIn(turns[1]), run_time=1.4)
        self.play(GrowArrow(arr[1]), FadeIn(turns[2]), run_time=1.4)
        wait_until(self, 12.0)

        note = fit_label("state has to survive across turns, which single-turn never tests",
                         12.0, 23, INK).move_to([0, -1.6, 0])
        self.play(Write(note), run_time=2.2)
        self.guard(turns, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : BFCL v3 grounding ───────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "BFCL v3 checks state across turns"
    cue_duration = 19.1

    def construct(self):
        bfcl = block("Berkeley FCL v3:\nmulti-turn + state checks", EMERALD, w=5.6, h=1.3, fs=22).move_to([-3.2, 0.7, 0])
        fg = block("FunctionGemma docs:\nmulti-turn not supported", ROSE, w=5.6, h=1.3, fs=22).move_to([3.2, 0.7, 0])
        self.play(FadeIn(bfcl), run_time=1.6)
        self.play(FadeIn(fg), run_time=1.6)
        wait_until(self, 11.0)

        note = fit_label("the benchmark that grades it says one thing, the model card another",
                         12.5, 22, AMBER).move_to([0, -1.5, 0])
        self.play(Write(note), run_time=2.4)
        self.guard(bfcl, fg, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : org root cause ──────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Nobody owned the eval, so the gap shipped"
    cue_duration = 19.1

    def construct(self):
        t1 = block("post-training team:\nout of scope", ACCENT, w=5.0, h=1.2, fs=22).move_to([-3.2, 0.8, 0])
        t2 = block("evals team:\nusers depend on it", VIOLET, w=5.0, h=1.2, fs=22).move_to([3.2, 0.8, 0])
        self.play(FadeIn(t1), run_time=1.4)
        self.play(FadeIn(t2), run_time=1.4)
        wait_until(self, 8.0)

        gap = block("multi-turn eval: no owner", ROSE, w=6.0, h=1.0, fs=24).move_to([0, -1.2, 0])
        self.play(FadeIn(gap), Indicate(gap, color=ROSE), run_time=2.0)
        wait_until(self, 15.0)
        note = fit_label("the blind spot was a position somebody held, not an oversight",
                         12.0, 22, INK).move_to([0, -2.6, 0])
        self.play(Write(note), run_time=2.0)
        self.guard(t1, t2, gap, note)
        pace_to(self, self.cue_duration)
