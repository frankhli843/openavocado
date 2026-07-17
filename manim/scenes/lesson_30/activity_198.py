"""
Lesson 30 - Part 2 (activity 198): "The template trap: capability versus
protocol" (97.46s, 5 cues).

At the Gemma 4 launch the tool-call pass rate was about ten percent and the room
blamed the weights. But capability lives in the weights and protocol lives in
the chat template: the template serializes roles, turn delimiters, and special
tool tokens into the exact sequence the model trained on. Emit the wrong control
tokens and the output cannot be parsed as a valid tool call, so it scores as a
failure. A hand-tuned template lifted the rate dramatically. Diagnose, do not
assume.

Cue00 0.0-20.5    ten percent pass, blame fell on the model
Cue01 20.5-41.0   the chat template serializes the conversation
Cue02 41.0-61.5   wrong tokens, an unparseable tool call
Cue03 61.5-82.0   capability versus protocol, two layers
Cue04 82.0-97.5   diagnose, do not assume
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from bayes import chip, fit_label
from cloud import service_box
from leaderboard import meter, meter_fill
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


def token(txt, color):
    return block(txt, color, w=1.9, h=0.7, fs=20)


# ─── Cue00 : ten percent ─────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Ten percent pass, and the weights got the blame"
    cue_duration = 20.5

    def construct(self):
        m = meter(0.10, w=8.6, h=0.8, color=ROSE, bar_frac=0.6, bar_label="target",
                  title="tool-call pass rate at launch", fs=22).move_to([0, 1.2, 0])
        self.play(FadeIn(m), run_time=1.8)
        self.play(Indicate(m.fill, color=ROSE), run_time=1.4)
        wait_until(self, 9.0)

        assume = block("the room assumed: weak weights", ROSE, w=6.6, h=1.0, fs=24).move_to([0, -1.0, 0])
        self.play(FadeIn(assume), run_time=1.8)
        wait_until(self, 15.0)
        q = fit_label("but was the model actually the problem?", 9.5, 23, AMBER).move_to([0, -2.4, 0])
        self.play(Write(q), run_time=2.0)
        self.guard(m, assume, q)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the template serializes ─────────────────────────────────────────
class Cue01(AvoScene):
    headline = "The chat template serializes the conversation"
    cue_duration = 20.5

    def construct(self):
        title = fit_label("chat template: roles + turn delimiters + special tool tokens",
                          12.5, 23, ACCENT).move_to([0, 2.2, 0])
        self.play(Write(title), run_time=2.0)
        wait_until(self, 6.0)

        toks = VGroup(
            token("<start>", VIOLET),
            token("user", ACCENT),
            token("<tool>", AMBER),
            token("name", EMERALD),
            token("args", EMERALD),
            token("<end>", VIOLET),
        ).arrange(RIGHT, buff=0.28).move_to([0, 0.4, 0])
        for tk in toks:
            self.play(FadeIn(tk), run_time=0.7)
        wait_until(self, 15.0)
        note = fit_label("the exact sequence the model was trained on", 9.5, 23, INK).move_to([0, -1.4, 0])
        self.play(Write(note), run_time=2.0)
        self.guard(title, toks, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : wrong tokens ────────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Wrong control tokens, an unparseable tool call"
    cue_duration = 20.5

    def construct(self):
        good = VGroup(token("<tool>", EMERALD), token("name", EMERALD), token("args", EMERALD)).arrange(RIGHT, buff=0.28).move_to([0, 1.7, 0])
        good_cap = fit_label("trained format: parses", 5.0, 21, EMERALD).next_to(good, LEFT, buff=0.4)
        self.play(FadeIn(good), FadeIn(good_cap), run_time=1.6)
        wait_until(self, 7.0)

        bad = VGroup(token("[[tool]]", ROSE), token("name", ROSE), token("???", ROSE)).arrange(RIGHT, buff=0.28).move_to([0, 0.0, 0])
        bad_cap = fit_label("wrong tokens: cannot parse", 5.4, 21, ROSE).next_to(bad, LEFT, buff=0.4)
        self.play(FadeIn(bad), FadeIn(bad_cap), run_time=1.6)
        self.play(Indicate(bad, color=ROSE), run_time=1.4)
        wait_until(self, 15.0)
        note = fit_label("an unparseable call scores as a failure, even from a capable model",
                         12.5, 22, AMBER).move_to([0, -1.8, 0])
        self.play(Write(note), run_time=2.2)
        self.guard(good, bad, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : capability vs protocol ──────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Capability versus protocol, two layers"
    cue_duration = 20.5

    def construct(self):
        cap = service_box("capability", "lives in the weights", color=EMERALD, w=4.6, h=1.3, fs=25).move_to([-3.4, 0.6, 0])
        proto = service_box("protocol", "lives in the template", color=AMBER, w=4.6, h=1.3, fs=25).move_to([3.4, 0.6, 0])
        self.play(FadeIn(cap), run_time=1.4)
        self.play(FadeIn(proto), run_time=1.4)
        wait_until(self, 10.0)
        note = fit_label("a protocol bug hides a capable model", 9.0, 24, INK).move_to([0, -1.4, 0])
        self.play(Write(note), Indicate(proto, color=AMBER), run_time=2.4)
        self.guard(cap, proto, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the fix ─────────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Diagnose, do not assume"
    cue_duration = 15.4

    def construct(self):
        m = meter(0.10, w=8.0, h=0.72, color=ROSE, bar_frac=0.6, bar_label="target",
                  title="pass rate", fs=22).move_to([0, 1.2, 0])
        self.play(FadeIn(m), run_time=1.4)
        wait_until(self, 4.0)
        fixed = meter_fill(m, 0.82, color=EMERALD)
        cap = fit_label("hand-tuned template", 5.0, 22, EMERALD).next_to(m, DOWN, buff=0.3)
        self.play(Transform(m.fill, fixed), FadeIn(cap), run_time=2.4)
        wait_until(self, 10.0)
        note = fit_label("the agentic benchmark caught what single-turn evals missed",
                         12.0, 22, INK).move_to([0, -1.6, 0])
        self.play(Write(note), run_time=2.0)
        self.guard(m, note)
        pace_to(self, self.cue_duration)
