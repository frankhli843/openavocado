"""
Lesson 29 - Part 2 (activity 192): "Job here, model there: the Borg to GCP
crossover" (110.78s, 4 cues).

An eval is a round trip between two systems. Ditto (the eval runner) executes as
a job on Borg, Google's cluster scheduler, while the model it grades is hosted
on GCP. Auth, networking, and routing between Borg and GCP are the crossover,
and that bridge is exactly where Sindhu is stuck. The same weights also run on
two serving surfaces (vLLM and Hugging Face), so the eval must target the one
you mean to certify.

Cue00 0.0-28.0    the runner and the model live in different places
Cue01 28.0-56.0   Ditto runs as a job on Borg, model hosted on GCP
Cue02 56.0-84.0   auth + networking + routing = the crossover Sindhu is stuck on
Cue03 84.0-110.8  same weights, two serving runtimes - target the right one
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from bayes import chip, fit_label
from cloud import service_box, map_pair, arrow_between
from manim import (
    VGroup, Text, MathTex, Arrow, DoubleArrow, DashedLine, RoundedRectangle,
    SurroundingRectangle, FadeIn, FadeOut, Write, Transform, Indicate,
    Circumscribe, GrowArrow, Create, RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : two locations ───────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "The job runs here, the model lives there"
    cue_duration = 28.0

    def construct(self):
        runner = service_box("eval job", "runs the test", color=ACCENT,
                            w=3.8, h=1.3, fs=26).move_to([-4.0, 1.2, 0])
        model = service_box("the model", "answers requests", color=EMERALD,
                          w=3.8, h=1.3, fs=26).move_to([4.0, 1.2, 0])
        self.play(FadeIn(runner), run_time=1.6)
        wait_until(self, 5.0)
        self.play(FadeIn(model), run_time=1.6)
        wait_until(self, 10.0)

        trip = DoubleArrow(runner.get_right(), model.get_left(), color=AMBER,
                           buff=0.2, stroke_width=4)
        req = fit_label("request ->", 3.0, 20, INK_MUTED).next_to(trip, UP, buff=0.12)
        resp = fit_label("<- response", 3.0, 20, INK_MUTED).next_to(trip, DOWN, buff=0.12)
        self.play(GrowArrow(trip), run_time=1.6)
        self.play(FadeIn(req), FadeIn(resp), run_time=1.6)
        wait_until(self, 19.0)

        note = fit_label("an eval is really a round trip between two systems",
                         11.0, 25, INK).move_to([0, -2.0, 0])
        self.play(Write(note), run_time=2.2)
        self.guard(runner, model, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : runner on Borg, model on GCP ────────────────────────────────────
class Cue01(AvoScene):
    headline = "Ditto runs on Borg, the model is hosted on GCP"
    cue_duration = 28.0

    def construct(self):
        borg = RoundedRectangle(width=5.4, height=3.0, corner_radius=0.16,
                                stroke_color=ACCENT, stroke_width=2.6,
                                fill_color=ACCENT, fill_opacity=0.06).move_to([-3.6, 0.2, 0])
        borg_t = Text("Borg  (cluster scheduler)", font_size=22, color=ACCENT,
                      weight="BOLD").next_to(borg, UP, buff=0.14)
        ditto = chip("Ditto: eval runner", color=EMERALD, w=4.0, h=1.0, fs=23).move_to(borg.get_center())
        self.play(Create(borg), FadeIn(borg_t), run_time=1.8)
        self.play(FadeIn(ditto), run_time=1.4)
        wait_until(self, 10.0)

        gcp = RoundedRectangle(width=5.4, height=3.0, corner_radius=0.16,
                               stroke_color=AMBER, stroke_width=2.6,
                               fill_color=AMBER, fill_opacity=0.06).move_to([3.6, 0.2, 0])
        gcp_t = Text("GCP  (hosting)", font_size=22, color=AMBER,
                     weight="BOLD").next_to(gcp, UP, buff=0.14)
        served = chip("served model", color=VIOLET, w=4.0, h=1.0, fs=23).move_to(gcp.get_center())
        self.play(Create(gcp), FadeIn(gcp_t), run_time=1.8)
        self.play(FadeIn(served), run_time=1.4)
        wait_until(self, 20.0)

        link = Arrow(ditto.get_right(), served.get_left(), color=INK_SUBTLE, buff=0.2, stroke_width=3)
        self.play(GrowArrow(link), run_time=1.6)
        self.guard(borg, gcp, ditto, served)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the crossover ───────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "The crossover: auth, networking, routing"
    cue_duration = 28.0

    def construct(self):
        borg = chip("Borg job (Ditto)", color=ACCENT, w=4.2, h=1.1, fs=23).move_to([-4.2, 1.4, 0])
        gcp = chip("GCP model", color=AMBER, w=4.2, h=1.1, fs=23).move_to([4.2, 1.4, 0])
        self.play(FadeIn(borg), FadeIn(gcp), run_time=1.6)
        wait_until(self, 4.0)

        bridge = VGroup(
            chip("auth", color=VIOLET, w=2.6, h=0.8, fs=22),
            chip("networking", color=VIOLET, w=3.0, h=0.8, fs=22),
            chip("routing", color=VIOLET, w=2.6, h=0.8, fs=22),
        ).arrange(RIGHT, buff=0.3).move_to([0, -0.3, 0])
        crossbox = SurroundingRectangle(bridge, color=ROSE, buff=0.28, corner_radius=0.1)
        a1 = Arrow(borg.get_bottom(), bridge.get_left() + UP * 0.2, color=INK_SUBTLE, buff=0.15, stroke_width=3)
        a2 = Arrow(gcp.get_bottom(), bridge.get_right() + UP * 0.2, color=INK_SUBTLE, buff=0.15, stroke_width=3)
        self.play(GrowArrow(a1), GrowArrow(a2), run_time=1.6)
        self.play(FadeIn(bridge), run_time=1.6)
        wait_until(self, 13.0)
        self.play(Create(crossbox), Indicate(bridge, color=ROSE), run_time=1.8)

        stuck = fit_label("this bridge is where Sindhu is stuck - and it blocks every eval run",
                          12.5, 23, ROSE).move_to([0, -2.2, 0])
        self.play(Write(stuck), run_time=2.4)
        self.guard(borg, gcp, bridge, stuck)
        pace_to(self, self.cue_duration)


# ─── Cue03 : serving surfaces ────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Same weights, two serving runtimes"
    cue_duration = 26.8

    def construct(self):
        weights = service_box("one set of weights", None, color=VIOLET,
                            w=4.6, h=1.1, fs=25).move_to([0, 2.1, 0])
        self.play(FadeIn(weights), run_time=1.4)
        wait_until(self, 5.0)

        vllm = service_box("vLLM", "production serving", color=ACCENT,
                         w=4.0, h=1.3, fs=26).move_to([-3.6, -0.3, 0])
        hf = service_box("Hugging Face impl", "reference serving", color=EMERALD,
                       w=4.0, h=1.3, fs=25).move_to([3.6, -0.3, 0])
        a1 = Arrow(weights.get_bottom(), vllm.get_top(), color=INK_SUBTLE, buff=0.15, stroke_width=3)
        a2 = Arrow(weights.get_bottom(), hf.get_top(), color=INK_SUBTLE, buff=0.15, stroke_width=3)
        self.play(GrowArrow(a1), FadeIn(vllm), run_time=1.6)
        self.play(GrowArrow(a2), FadeIn(hf), run_time=1.6)
        wait_until(self, 16.0)

        note = fit_label("target the runtime you actually intend to certify, or the number drifts",
                         12.8, 23, AMBER).move_to([0, -2.2, 0])
        self.play(Write(note), run_time=2.4)
        self.guard(weights, vllm, hf, note)
        pace_to(self, self.cue_duration)
