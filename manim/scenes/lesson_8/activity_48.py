"""
Lesson 8 — Part 3 (activity 48): "Storage and Messaging" (446.21s, 3 cues).

GCS ≈ S3 (named buckets of objects, storage-class tiers by access frequency);
Pub/Sub ≈ SQS + SNS combined, with BOTH push and pull delivery, not pull-only.

Uses cloud.py (map_pair, service_box, chip). No formulas — object storage tiers
and a publish/subscribe topology, so MathTex is intentionally absent.

Cue00 0-149     GCS≈S3 (buckets/objects), Pub/Sub≈SQS+SNS (one system)
Cue01 149-297   storage classes: Standard→Nearline→Coldline→Archive, colder=cheaper
Cue02 297-446   Pub/Sub: publish to a topic; push AND pull, unlike pull-only SQS
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


# ─── Cue00 : GCS ≈ S3 ; Pub/Sub ≈ SQS + SNS ──────────────────────────────────
class Cue00(AvoScene):
    headline = "GCS is S3; Pub/Sub is SQS plus SNS"
    cue_duration = 149.0

    def construct(self):
        p1 = map_pair("Cloud Storage", "Amazon S3", gcp_sub="named buckets of objects",
                      aws_sub="object storage", w=3.9, h=1.35, fs=25, sub_fs=18)
        p1.move_to([0, 1.3, 0])
        p2 = map_pair("Pub/Sub", "SQS + SNS", gcp_sub="one messaging system",
                      aws_sub="queue + fan-out", w=3.9, h=1.35, fs=25, sub_fs=18)
        p2.move_to([0, -1.2, 0])

        self.play(FadeIn(p1.gcp, shift=RIGHT * 0.2), run_time=0.9)
        self.play(FadeIn(p1.sym), FadeIn(p1.aws, shift=LEFT * 0.2), run_time=1.0)
        wait_until(self, 5.0)
        self.play(FadeIn(p2.gcp, shift=RIGHT * 0.2), run_time=0.9)
        self.play(FadeIn(p2.sym), FadeIn(p2.aws, shift=LEFT * 0.2), run_time=1.0)
        wait_until(self, 10.0)
        note = fit_label("same use cases as S3, SQS, and SNS — different names, some new behaviour",
                         12.8, 22, INK_MUTED).move_to([0, -2.7, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(p1, p2, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : storage classes ladder ──────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Storage classes: colder access, cheaper price"
    cue_duration = 148.0

    def construct(self):
        tiers = [
            ("Standard", "frequent access", C_GCP),
            ("Nearline", "~once a month", ACCENT_LIGHT),
            ("Coldline", "~once a quarter", VIOLET),
            ("Archive", "~once a year", INK_MUTED),
        ]
        rows = []
        for i, (name, freq, color) in enumerate(tiers):
            box = service_box(name, freq, color=color, w=4.2, h=1.0, fs=24, sub_fs=18)
            box.move_to([-2.4 + i * 0.0, 1.5 - i * 1.05, 0])
            rows.append(box)
        # stagger horizontally to suggest a descending ladder
        for i, box in enumerate(rows):
            box.move_to([-2.2 + i * 1.3, 1.5 - i * 1.05, 0])
        for i, box in enumerate(rows):
            self.play(FadeIn(box, shift=DOWN * 0.15), run_time=0.9)
            wait_until(self, 2.0 + (i + 1) * 2.3)
        # a "colder = cheaper" axis arrow alongside
        arr = Arrow([4.8, 1.9, 0], [4.8, -2.6, 0], buff=0.0, color=EMERALD,
                    stroke_width=4.0, max_tip_length_to_length_ratio=0.06)
        alab = fit_label("colder → cheaper", 3.0, 20, EMERALD).next_to(arr, LEFT, buff=0.2).shift(UP * 2.0)
        self.play(GrowArrow(arr), FadeIn(alab), run_time=1.4)
        wait_until(self, 13.0)
        note = fit_label("matches S3's tiers · uniform bucket-level access (IAM over per-object ACLs)",
                         13.0, 21, INK_MUTED).move_to([0, -2.95, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(VGroup(*rows), arr, alab, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : publish to a topic; push AND pull ───────────────────────────────
class Cue02(AvoScene):
    headline = "Publish to a topic — push AND pull delivery"
    cue_duration = 149.0

    def construct(self):
        producer = chip("producer", color=EMERALD, w=2.6, h=0.95, fs=22).move_to([-4.6, 0.4, 0])
        topic = service_box("topic", color=C_GCP, w=2.8, h=1.2, fs=26).move_to([-0.6, 0.4, 0])
        a_pub = Arrow(producer.get_right(), topic.box.get_left(), buff=0.15,
                      color=C_NEUTRAL, stroke_width=3.0, max_tip_length_to_length_ratio=0.18)
        pub_lab = Text("publish", font_size=19, color=INK_MUTED).next_to(a_pub, UP, buff=0.1)
        self.play(FadeIn(producer), run_time=0.8)
        self.play(GrowArrow(a_pub), FadeIn(pub_lab), FadeIn(topic), run_time=1.4)
        wait_until(self, 5.0)

        push = chip("push subscriber", color=AMBER, w=3.4, h=0.9, fs=21).move_to([4.4, 1.5, 0])
        pull = chip("pull subscriber", color=AMBER, w=3.4, h=0.9, fs=21).move_to([4.4, -0.7, 0])
        a_push = Arrow(topic.box.get_right(), push.get_left(), buff=0.15, color=EMERALD,
                       stroke_width=3.0, max_tip_length_to_length_ratio=0.16)
        a_pull = Arrow(topic.box.get_right(), pull.get_left(), buff=0.15, color=EMERALD,
                       stroke_width=3.0, max_tip_length_to_length_ratio=0.16)
        push_lab = fit_label("Google → your HTTPS endpoint", 3.8, 18, INK_MUTED).next_to(push, DOWN, buff=0.16)
        pull_lab = fit_label("your service polls", 3.8, 18, INK_MUTED).next_to(pull, DOWN, buff=0.16)
        self.play(GrowArrow(a_push), FadeIn(push), FadeIn(push_lab), run_time=1.2)
        self.play(GrowArrow(a_pull), FadeIn(pull), FadeIn(pull_lab), run_time=1.2)
        wait_until(self, 12.0)
        note = fit_label("SQS is pull-only; Pub/Sub supports both — built for Google-scale streaming",
                         13.0, 21, C_FOCUS).move_to([0, -2.6, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(producer, topic, a_pub, pub_lab, push, pull, a_push, a_pull,
                   push_lab, pull_lab, note)
        pace_to(self, self.cue_duration)
