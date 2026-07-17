"""
Lesson 29 - Part 3 (activity 193): "One-shot reproducible runs: Terraform,
Docker, Cloud Run" (104.88s, 5 cues).

Infrastructure as code replaces the fifteen page manual doc. Terraform
provisions resources from a config, a Docker image pins the code and the
benchmark commit, Cloud Run executes exactly one job against one model build,
results are emitted to durable storage, then everything tears down. Three wins:
an identical environment every run, a plan diff you read before apply, and
automatic rollback on failure.

Cue00 0.0-22.1    the brittle fifteen page document
Cue01 22.1-44.2   Terraform provisions, Docker pins code + benchmark commit
Cue02 44.2-66.3   Cloud Run runs exactly one job, then exits
Cue03 66.3-88.4   results to durable storage, then tear everything down
Cue04 88.4-104.9  identical, reviewable, reversible
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
    Cross, RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : the brittle doc ─────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Today: fifteen pages of manual steps"
    cue_duration = 22.1

    def construct(self):
        doc = RoundedRectangle(width=3.4, height=4.0, corner_radius=0.1,
                               stroke_color=ROSE, stroke_width=2.6,
                               fill_color=ROSE, fill_opacity=0.06).move_to([0, 0.1, 0])
        lines = VGroup(*[
            RoundedRectangle(width=2.6, height=0.12, corner_radius=0.06,
                             stroke_width=0, fill_color=INK_SUBTLE, fill_opacity=0.7)
            for _ in range(10)
        ]).arrange(DOWN, buff=0.22).move_to(doc.get_center())
        cap = Text("15-page eval setup doc", font_size=24, color=ROSE).next_to(doc, UP, buff=0.2)
        self.play(Create(doc), FadeIn(cap), run_time=1.8)
        self.play(FadeIn(lines, lag_ratio=0.1), run_time=2.0)
        wait_until(self, 12.0)

        note = fit_label("tribal knowledge - and it breaks the moment a step goes stale",
                         12.0, 24, INK).move_to([0, -2.5, 0])
        self.play(Write(note), Indicate(doc, color=ROSE), run_time=2.4)
        self.guard(doc, cap, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : provision + pin ─────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Terraform provisions, Docker pins"
    cue_duration = 22.1

    def construct(self):
        tf = service_box("Terraform", "provisions from a config", color=ACCENT,
                       w=4.6, h=1.3, fs=26).move_to([-3.4, 1.3, 0])
        self.play(FadeIn(tf), run_time=1.6)
        wait_until(self, 6.0)

        dk = service_box("Docker image", "pins code + benchmark commit", color=EMERALD,
                       w=4.8, h=1.3, fs=25).move_to([3.4, 1.3, 0])
        self.play(FadeIn(dk), run_time=1.6)
        wait_until(self, 12.0)

        pin = VGroup(
            chip("exact code SHA", color=VIOLET, w=4.0, h=0.8, fs=22),
            chip("exact benchmark commit", color=VIOLET, w=4.8, h=0.8, fs=22),
        ).arrange(DOWN, buff=0.3).move_to([0, -1.5, 0])
        self.play(FadeIn(pin), run_time=1.8)
        self.guard(tf, dk, pin)
        pace_to(self, self.cue_duration)


# ─── Cue02 : run exactly once ────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Cloud Run executes exactly one job"
    cue_duration = 22.1

    def construct(self):
        run = service_box("Cloud Run", "one job, one model build", color=ACCENT,
                        w=5.0, h=1.4, fs=27).move_to([0, 1.4, 0])
        self.play(FadeIn(run), run_time=1.6)
        wait_until(self, 6.0)

        flow = VGroup(
            chip("start", color=EMERALD, w=2.4, h=0.9, fs=23),
            chip("run eval", color=ACCENT, w=2.8, h=0.9, fs=23),
            chip("exit", color=INK_MUTED, w=2.4, h=0.9, fs=23),
        ).arrange(RIGHT, buff=0.7).move_to([0, -0.6, 0])
        arr = VGroup(*[
            Arrow(flow[i].get_right(), flow[i + 1].get_left(), color=INK_SUBTLE,
                  buff=0.12, stroke_width=3) for i in range(2)
        ])
        self.play(FadeIn(flow[0]), run_time=1.0)
        self.play(GrowArrow(arr[0]), FadeIn(flow[1]), run_time=1.2)
        self.play(GrowArrow(arr[1]), FadeIn(flow[2]), run_time=1.2)
        wait_until(self, 16.0)

        note = fit_label("no long-lived server to drift - the job is the whole lifetime",
                         12.0, 23, INK_MUTED).move_to([0, -2.2, 0])
        self.play(Write(note), run_time=2.0)
        self.guard(run, flow, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : emit + tear down ────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Results out, resources gone"
    cue_duration = 22.1

    def construct(self):
        job = chip("eval job", color=ACCENT, w=3.4, h=1.1, fs=24).move_to([0, 1.7, 0])
        store = service_box("durable storage", "results land here", color=EMERALD,
                          w=4.4, h=1.2, fs=25).move_to([-3.4, -0.4, 0])
        a1 = Arrow(job.get_bottom(), store.get_top(), color=INK_SUBTLE, buff=0.15, stroke_width=3)
        self.play(FadeIn(job), run_time=1.2)
        self.play(GrowArrow(a1), FadeIn(store), run_time=1.6)
        wait_until(self, 9.0)

        teardown = service_box("infra torn down", "nothing lingers or costs money", color=INK_MUTED,
                             w=4.6, h=1.2, fs=24).move_to([3.4, -0.4, 0])
        a2 = Arrow(job.get_bottom(), teardown.get_top(), color=INK_SUBTLE, buff=0.15, stroke_width=3)
        self.play(GrowArrow(a2), FadeIn(teardown), run_time=1.6)
        self.play(Indicate(teardown, color=EMERALD), run_time=1.4)
        wait_until(self, 18.0)
        keep = fit_label("results persist, compute does not", 8.0, 23, EMERALD).move_to([0, -2.3, 0])
        self.play(Write(keep), run_time=1.8)
        self.guard(job, store, teardown, keep)
        pace_to(self, self.cue_duration)


# ─── Cue04 : three wins ──────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Identical, reviewable, reversible"
    cue_duration = 16.6

    def construct(self):
        wins = VGroup(
            chip("identical env every run", color=EMERALD, w=5.2, h=1.0, fs=24),
            chip("plan diff you read before apply", color=ACCENT, w=6.0, h=1.0, fs=24),
            chip("automatic rollback on failure", color=VIOLET, w=6.0, h=1.0, fs=24),
        ).arrange(DOWN, buff=0.45).move_to([0, 0.2, 0])
        for w in wins:
            self.play(FadeIn(w), run_time=1.2)
        self.play(Circumscribe(wins, color=EMERALD), run_time=1.8)
        self.guard(wins)
        pace_to(self, self.cue_duration)
