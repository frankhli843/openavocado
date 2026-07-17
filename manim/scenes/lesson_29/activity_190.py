"""
Lesson 29 - Orientation (activity 190): "Evals as Infrastructure" (879.96s,
7 cues). The overview arc: a compliant model that still cannot ship because the
eval setup is a brittle document; Gbench standing up a fake world and grading
agentic behavior; grading the action, not the words (BFCL, tau-bench); the Ditto
-> Borg -> GCP crossover that gates every run (where Sindhu is stuck); the same
weights behaving differently across vLLM and Hugging Face; infrastructure as code
(Terraform, Docker, Cloud Run) replacing the fifteen page document; and why
fixing this plumbing is the highest-leverage on-ramp for an infra engineer.

Long cues (87-138s) are built in staged beats so no diagram holds static for
two minutes.

Cue00 0.0-129.0     a compliant model, but nothing to trust
Cue01 129.0-267.2   a harness that stands up a fake world
Cue02 267.2-396.2   the action is the truth
Cue03 396.2-534.4   the crossover that gates everything
Cue04 534.4-663.4   same weights, different behavior
Cue05 663.4-792.4   infrastructure as code replaces the document
Cue06 792.4-879.96  fix the plumbing, speed up everyone
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


def block(label, color, w=2.4, h=0.9, fs=23, fill=0.16):
    b = RoundedRectangle(width=w, height=h, corner_radius=0.12, stroke_color=color,
                         stroke_width=2.4, fill_color=color, fill_opacity=fill)
    t = fit_label(label, w - 0.28, fs, INK).move_to(b.get_center())
    return VGroup(b, t)


# ─── Cue00 : evals are the bottleneck ────────────────────────────────────────
class Cue00(AvoScene):
    headline = "A compliant model, but nothing to trust yet"
    cue_duration = 129.0

    def construct(self):
        model = service_box("the model", "weights are coming together", color=EMERALD,
                          w=4.4, h=1.2, fs=26).move_to([0, 2.3, 0])
        self.play(FadeIn(model), run_time=2.0)
        wait_until(self, 14.0)

        gate = block("must pass evals to ship", ROSE, w=5.0, h=0.95, fs=24).move_to([0, 0.9, 0])
        a1 = Arrow(model.get_bottom(), gate.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(GrowArrow(a1), FadeIn(gate), run_time=2.0)
        wait_until(self, 40.0)

        doc = RoundedRectangle(width=2.8, height=1.6, corner_radius=0.1,
                               stroke_color=ROSE, stroke_width=2.6,
                               fill_color=ROSE, fill_opacity=0.06).move_to([0, -1.5, 0])
        dlines = VGroup(*[
            RoundedRectangle(width=2.0, height=0.09, corner_radius=0.04, stroke_width=0,
                             fill_color=INK_SUBTLE, fill_opacity=0.7)
            for _ in range(5)
        ]).arrange(DOWN, buff=0.15).move_to(doc.get_center())
        dcap = fit_label("today: a brittle 15-page eval doc", 6.5, 22, ROSE).next_to(doc, UP, buff=0.16)
        self.play(Create(doc), FadeIn(dcap), run_time=2.0)
        self.play(FadeIn(dlines, lag_ratio=0.15), run_time=2.4)
        wait_until(self, 92.0)
        self.play(Indicate(doc, color=ROSE), run_time=2.0)

        punch = fit_label("the eval setup is the bottleneck: that is what we turn into infrastructure",
                          13.0, 23, AMBER).move_to([0, -3.05, 0])
        self.play(Write(punch), run_time=2.6)
        self.guard(model, gate, doc, punch)
        pace_to(self, self.cue_duration)


# ─── Cue01 : Gbench stands up a fake world ───────────────────────────────────
class Cue01(AvoScene):
    headline = "Gbench stands up a fake world and watches the model act"
    cue_duration = 138.2

    def construct(self):
        gb = service_box("Gbench", "eval harness", color=ACCENT, w=4.0, h=1.1, fs=26).move_to([0, 2.4, 0])
        self.play(FadeIn(gb), run_time=2.0)
        wait_until(self, 14.0)

        kinds = VGroup(
            chip("academic evals", color=VIOLET, w=4.0, h=0.85, fs=23),
            chip("agentic tasks", color=EMERALD, w=4.0, h=0.85, fs=23),
        ).arrange(RIGHT, buff=0.8).move_to([0, 1.15, 0])
        self.play(FadeIn(kinds), run_time=2.2)
        wait_until(self, 36.0)

        seed = VGroup(
            block("fake files", EMERALD, w=2.8, h=0.8, fs=22),
            block("fake tools", AMBER, w=2.8, h=0.8, fs=22),
            block("start state", VIOLET, w=2.8, h=0.8, fs=22),
        ).arrange(RIGHT, buff=0.4).move_to([0, -0.25, 0])
        seed_cap = fit_label("1 - seed the environment", 5.0, 21, INK_MUTED).next_to(seed, UP, buff=0.16)
        self.play(FadeIn(seed_cap), run_time=1.4)
        self.play(FadeIn(seed, lag_ratio=0.2), run_time=2.4)
        wait_until(self, 68.0)

        trig = block("trigger the model as an agent", ACCENT, w=6.4, h=0.85, fs=24).move_to([0, -1.55, 0])
        trig_cap = fit_label("2 - let it call tools", 4.4, 21, INK_MUTED).next_to(trig, UP, buff=0.14)
        self.play(FadeIn(trig_cap), FadeIn(trig), run_time=2.2)
        wait_until(self, 98.0)

        inspect = block("inspect the resulting state", EMERALD, w=6.0, h=0.85, fs=24).move_to([0, -2.85, 0])
        insp_cap = fit_label("3 - grade what changed", 4.6, 21, INK_MUTED).next_to(inspect, UP, buff=0.14)
        self.play(FadeIn(insp_cap), FadeIn(inspect), run_time=2.2)
        wait_until(self, 124.0)
        self.play(Indicate(inspect, color=EMERALD), run_time=2.2)
        self.guard(gb, kinds, seed, trig, inspect)
        pace_to(self, self.cue_duration)


# ─── Cue02 : grade the action ────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "The action is the truth, not the sentence"
    cue_duration = 129.0

    def construct(self):
        refs = VGroup(
            chip("Berkeley Function Calling Leaderboard", color=VIOLET, w=8.4, h=0.85, fs=22),
            chip("tau-bench", color=VIOLET, w=3.4, h=0.85, fs=22),
        ).arrange(DOWN, buff=0.35).move_to([0, 2.4, 0])
        self.play(FadeIn(refs[0]), run_time=1.8)
        wait_until(self, 16.0)
        self.play(FadeIn(refs[1]), run_time=1.6)
        wait_until(self, 34.0)

        words = block("the model's sentence", ROSE, w=5.0, h=1.1, fs=24).move_to([-3.6, 0.4, 0])
        state = block("the backend state", EMERALD, w=5.0, h=1.1, fs=24).move_to([3.6, 0.4, 0])
        self.play(FadeIn(words), run_time=1.8)
        wait_until(self, 54.0)
        self.play(FadeIn(state), run_time=1.8)
        wait_until(self, 74.0)

        w_note = fit_label("a sentence can lie", 4.6, 24, ROSE).next_to(words, DOWN, buff=0.3)
        s_note = fit_label("the state cannot", 4.6, 24, EMERALD).next_to(state, DOWN, buff=0.3)
        self.play(Write(w_note), run_time=1.8)
        self.play(Write(s_note), run_time=1.8)
        wait_until(self, 104.0)
        self.play(Indicate(state, color=EMERALD), Circumscribe(state, color=EMERALD), run_time=2.2)

        punch = fit_label("grade what the model did to the world", 9.5, 26, INK).move_to([0, -2.6, 0])
        self.play(Write(punch), run_time=2.6)
        self.guard(refs, words, state, punch)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the crossover ───────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "The Borg to GCP crossover gates every run"
    cue_duration = 138.2

    def construct(self):
        ditto = service_box("Ditto", "internal-format eval runner", color=ACCENT,
                          w=4.6, h=1.2, fs=25).move_to([0, 2.5, 0])
        self.play(FadeIn(ditto), run_time=2.0)
        wait_until(self, 18.0)

        borg = RoundedRectangle(width=5.0, height=1.6, corner_radius=0.14, stroke_color=ACCENT,
                                stroke_width=2.4, fill_color=ACCENT, fill_opacity=0.06).move_to([-3.6, 0.5, 0])
        borg_t = fit_label("runs on Borg", 4.2, 23, ACCENT).move_to(borg.get_center())
        self.play(Create(borg), FadeIn(borg_t), run_time=2.0)
        wait_until(self, 44.0)

        gcp = RoundedRectangle(width=5.0, height=1.6, corner_radius=0.14, stroke_color=AMBER,
                               stroke_width=2.4, fill_color=AMBER, fill_opacity=0.06).move_to([3.6, 0.5, 0])
        gcp_t = fit_label("model hosted on GCP", 4.6, 23, AMBER).move_to(gcp.get_center())
        self.play(Create(gcp), FadeIn(gcp_t), run_time=2.0)
        wait_until(self, 70.0)

        bridge = DoubleArrow(borg.get_right(), gcp.get_left(), color=ROSE, buff=0.15, stroke_width=4)
        bcap = fit_label("auth + networking + routing", 5.4, 22, ROSE).move_to([0, -1.2, 0])
        self.play(GrowArrow(bridge), run_time=2.0)
        self.play(FadeIn(bcap), run_time=1.8)
        wait_until(self, 104.0)
        self.play(Indicate(bridge, color=ROSE), run_time=2.2)

        stuck = fit_label("this Borg to GCP link is exactly where Sindhu is stuck",
                          11.5, 24, INK).move_to([0, -2.6, 0])
        self.play(Write(stuck), run_time=2.6)
        self.guard(ditto, borg, gcp, stuck)
        pace_to(self, self.cue_duration)


# ─── Cue04 : two serving runtimes ────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Same weights, different behavior across runtimes"
    cue_duration = 129.0

    def construct(self):
        weights = service_box("one set of weights", None, color=VIOLET, w=4.6, h=1.1, fs=26).move_to([0, 2.4, 0])
        self.play(FadeIn(weights), run_time=2.0)
        wait_until(self, 20.0)

        vllm = service_box("vLLM", "one serving runtime", color=ACCENT, w=4.2, h=1.3, fs=26).move_to([-3.6, 0.3, 0])
        hf = service_box("Hugging Face", "another serving runtime", color=EMERALD, w=4.2, h=1.3, fs=25).move_to([3.6, 0.3, 0])
        a1 = Arrow(weights.get_bottom(), vllm.get_top(), color=INK_SUBTLE, buff=0.15, stroke_width=3)
        a2 = Arrow(weights.get_bottom(), hf.get_top(), color=INK_SUBTLE, buff=0.15, stroke_width=3)
        self.play(GrowArrow(a1), FadeIn(vllm), run_time=2.0)
        wait_until(self, 48.0)
        self.play(GrowArrow(a2), FadeIn(hf), run_time=2.0)
        wait_until(self, 78.0)

        drift = fit_label("behavior can differ between the two", 8.0, 23, AMBER).move_to([0, -1.4, 0])
        self.play(Write(drift), run_time=2.2)
        wait_until(self, 104.0)
        punch = fit_label("the eval must hit the runtime you actually intend to certify",
                          12.0, 24, INK).move_to([0, -2.6, 0])
        self.play(Write(punch), run_time=2.6)
        self.guard(weights, vllm, hf, punch)
        pace_to(self, self.cue_duration)


# ─── Cue05 : infrastructure as code ──────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Infrastructure as code replaces the document"
    cue_duration = 129.0

    def construct(self):
        stages = VGroup(
            block("Terraform\nprovisions", ACCENT, w=3.0, h=1.2, fs=22),
            block("Docker\npins code+commit", EMERALD, w=3.2, h=1.2, fs=21),
            block("Cloud Run\none job", VIOLET, w=3.0, h=1.2, fs=22),
        ).arrange(RIGHT, buff=1.0).move_to([0, 1.4, 0])
        arr = VGroup(*[
            Arrow(stages[i].get_right(), stages[i + 1].get_left(), color=INK_SUBTLE,
                  buff=0.12, stroke_width=3) for i in range(2)
        ])
        self.play(FadeIn(stages[0]), run_time=2.0)
        wait_until(self, 26.0)
        self.play(GrowArrow(arr[0]), FadeIn(stages[1]), run_time=2.0)
        wait_until(self, 52.0)
        self.play(GrowArrow(arr[1]), FadeIn(stages[2]), run_time=2.0)
        wait_until(self, 78.0)

        out = block("results -> durable storage", EMERALD, w=5.4, h=0.95, fs=23).move_to([-2.4, -1.0, 0])
        down = block("then tear everything down", INK_MUTED, w=5.4, h=0.95, fs=23).move_to([3.0, -1.0, 0])
        self.play(FadeIn(out), run_time=1.8)
        wait_until(self, 98.0)
        self.play(FadeIn(down), run_time=1.8)
        wait_until(self, 116.0)

        punch = fit_label("one-shot, reproducible runs - no 15-page doc, no drift",
                          12.0, 24, AMBER).move_to([0, -2.5, 0])
        self.play(Write(punch), run_time=2.6)
        self.guard(stages, out, down, punch)
        pace_to(self, self.cue_duration)


# ─── Cue06 : the on-ramp ─────────────────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Fix the plumbing, speed up everyone"
    cue_duration = 87.5

    def construct(self):
        infra = VGroup(
            chip("reproducible evals", color=EMERALD, w=5.0, h=1.0, fs=24),
            chip("solid Borg -> GCP hosting", color=ACCENT, w=5.6, h=1.0, fs=24),
        ).arrange(DOWN, buff=0.4).move_to([0, 1.7, 0])
        self.play(FadeIn(infra[0]), run_time=1.8)
        wait_until(self, 16.0)
        self.play(FadeIn(infra[1]), run_time=1.8)
        wait_until(self, 34.0)

        arrow = Arrow([0, 0.4, 0], [0, -0.6, 0], color=INK_SUBTLE, buff=0.1, stroke_width=4)
        unblock = block("unblocks every future model change", EMERALD, w=7.4, h=1.0, fs=24).move_to([0, -1.2, 0])
        self.play(GrowArrow(arrow), FadeIn(unblock), run_time=2.2)
        wait_until(self, 60.0)
        self.play(Circumscribe(unblock, color=EMERALD), run_time=2.0)

        punch = fit_label("this is how an infrastructure engineer plugs into model building",
                          12.5, 24, INK).move_to([0, -2.6, 0])
        self.play(Write(punch), run_time=2.6)
        self.guard(infra, unblock, punch)
        pace_to(self, self.cue_duration)
