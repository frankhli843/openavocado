"""
Lesson 8 — Part 2 (activity 47): "Compute and Containers" (417.5s, 3 cues).

GCP compute maps almost directly onto AWS: Cloud Run ≈ Fargate+ECS, Artifact
Registry ≈ ECR, GKE ≈ EKS. The one real behavioural twist is Cloud Run scaling
to zero (and the cold start that follows). GKE is genuine Kubernetes, managed.

Uses cloud.py (map_pair, service_box, chip). No formulas — this is a service
translation + a state picture, so MathTex is intentionally absent.

Cue00 0-139     name mapping: Cloud Run≈Fargate/ECS, Artifact Registry≈ECR, GKE≈EKS
Cue01 139-278   Cloud Run scales to zero → $0, then a cold start Fargate lacks
Cue02 278-418   GKE = real Kubernetes (Pods/Services/…), managed control plane
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from cloud import (
    service_box, map_pair, column, chip, fit_label,
    C_GCP, C_AWS, C_FOCUS, C_NEUTRAL,
)
from manim import (
    VGroup, Text, Arrow, Line, RoundedRectangle, SurroundingRectangle,
    FadeIn, FadeOut, Write, Create, GrowArrow, Indicate, Circumscribe,
    RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : name mapping GCP ≈ AWS ──────────────────────────────────────────
class Cue00(AvoScene):
    headline = "GCP compute maps onto your AWS knowledge"
    cue_duration = 139.0

    def construct(self):
        pairs = [
            map_pair("Cloud Run", "Fargate + ECS", w=3.6, h=1.15, fs=25),
            map_pair("Artifact Registry", "ECR", w=3.6, h=1.15, fs=25),
            map_pair("GKE", "EKS", w=3.6, h=1.15, fs=25),
        ]
        stack = VGroup(*pairs).arrange(DOWN, buff=0.55).move_to([0, -0.1, 0])
        for i, p in enumerate(pairs):
            self.play(FadeIn(p.gcp, shift=RIGHT * 0.2), run_time=0.8)
            self.play(FadeIn(p.sym), FadeIn(p.aws, shift=LEFT * 0.2), run_time=0.9)
            wait_until(self, 2.0 + (i + 1) * 2.4)
        note = fit_label("mostly a rename — push images, run containers, orchestrate",
                         12.0, 22, INK_MUTED).move_to([0, -2.5, 0])
        self.play(Write(note), run_time=1.6)
        self.guard(stack, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : Cloud Run scales to zero → cold start ───────────────────────────
class Cue01(AvoScene):
    headline = "Cloud Run scales to zero — then a cold start"
    cue_duration = 139.0

    def construct(self):
        # three states left→right: idle (0 instances, $0), request arrives, warm.
        def state(title, sub, n_boxes, color):
            head = Text(title, font_size=23, color=color, weight="BOLD")
            if n_boxes == 0:
                inst = fit_label("0 instances", 2.6, 22, INK_SUBTLE)
            else:
                inst = VGroup(*[RoundedRectangle(width=0.6, height=0.6, corner_radius=0.08,
                                                 stroke_color=color, stroke_width=2.2,
                                                 fill_color=color, fill_opacity=0.18)
                                for _ in range(n_boxes)]).arrange(RIGHT, buff=0.16)
            subt = fit_label(sub, 3.2, 20, INK_MUTED)
            return VGroup(head, inst, subt).arrange(DOWN, buff=0.3)

        s_idle = state("no requests", "$0 — everything off", 0, INK_SUBTLE)
        s_req = state("a request arrives", "spins up in a few hundred ms", 1, AMBER)
        s_warm = state("warm", "serving traffic", 3, EMERALD)
        row = VGroup(s_idle, s_req, s_warm).arrange(RIGHT, buff=1.2).move_to([0, 0.5, 0])
        a1 = Arrow(s_idle.get_right(), s_req.get_left(), buff=0.2, color=C_NEUTRAL,
                   stroke_width=3.0, max_tip_length_to_length_ratio=0.2)
        a2 = Arrow(s_req.get_right(), s_warm.get_left(), buff=0.2, color=C_NEUTRAL,
                   stroke_width=3.0, max_tip_length_to_length_ratio=0.2)

        self.play(FadeIn(s_idle), run_time=1.2)
        wait_until(self, 4.0)
        self.play(GrowArrow(a1), FadeIn(s_req), run_time=1.2)
        # the cold start is the moment worth marking
        cold = fit_label("← cold start (Fargate does not have this)", 6.2, 21, AMBER)
        cold.next_to(s_req, DOWN, buff=0.5)
        self.play(Indicate(s_req[0], color=AMBER, scale_factor=1.08), FadeIn(cold), run_time=1.4)
        wait_until(self, 10.0)
        self.play(GrowArrow(a2), FadeIn(s_warm), run_time=1.2)
        wait_until(self, 14.0)
        note = fit_label("scales to zero by default: great for variable traffic, at the cost of cold starts",
                         12.6, 22, C_FOCUS).move_to([0, -2.6, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(row, a1, a2, cold, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : GKE is real, managed Kubernetes ─────────────────────────────────
class Cue02(AvoScene):
    headline = "GKE runs real Kubernetes, managed for you"
    cue_duration = 140.0

    def construct(self):
        cluster = RoundedRectangle(width=8.4, height=2.3, corner_radius=0.18,
                                   stroke_color=C_GCP, stroke_width=2.8,
                                   fill_color=C_GCP, fill_opacity=0.06).move_to([0, 0.7, 0])
        ctitle = Text("GKE cluster", font_size=24, color=C_GCP, weight="BOLD")
        ctitle.next_to(cluster.get_top(), DOWN, buff=0.18)
        self.play(Create(cluster), FadeIn(ctitle), run_time=1.4)
        wait_until(self, 3.0)

        names = ["Pods", "Services", "Deployments", "StatefulSets"]
        chips = [chip(n, color=ACCENT_LIGHT, w=1.9, h=0.8, fs=21) for n in names]
        row = VGroup(*chips).arrange(RIGHT, buff=0.3).move_to([0, 0.35, 0])
        for i, ch in enumerate(chips):
            self.play(FadeIn(ch, shift=UP * 0.1), run_time=0.6)
            wait_until(self, 3.0 + (i + 1) * 1.5)

        managed = fit_label("Google manages: control plane · etcd · node upgrades",
                            11.0, 22, EMERALD).move_to([0, -1.5, 0])
        born = fit_label("Kubernetes was created at Google, open-sourced in 2014",
                         11.0, 21, INK_MUTED).move_to([0, -2.4, 0])
        self.play(FadeIn(managed), run_time=1.2)
        wait_until(self, 12.0)
        self.play(Write(born), run_time=1.6)
        self.guard(cluster, ctitle, row, managed, born)
        pace_to(self, self.cue_duration)
