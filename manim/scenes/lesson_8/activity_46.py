"""
Lesson 8 — Part 1 (activity 46): "GCP's Resource Hierarchy" (412.58s, 3 cues).

The four-layer nesting — Organization → Folder → Project → Resource — is GCP's
backbone: unlike a flat AWS account, every resource is nested, IAM cascades
downward, and the Project is the billing + API boundary.

Uses cloud.py (hierarchy, service_box, chip, arrow_between), NOT the ML/algorithm
idioms. No formulas — this is a boundary/containment picture, so MathTex is
intentionally absent.

Cue00 0-138     the four-layer tree Org→Folder→Project→Resource vs AWS flat account
Cue01 138-275   IAM policies cascade downward; the Project = billing + API boundary
Cue02 275-413   every resource belongs to exactly one project; structured, scales
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from cloud import (
    service_box, hierarchy, arrow_between, chip, fit_label,
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


# ─── Cue00 : the four-layer tree vs a flat AWS account ───────────────────────
class Cue00(AvoScene):
    headline = "GCP nests everything in a four-layer tree"
    cue_duration = 138.0

    def construct(self):
        tree = hierarchy(w0=5.4, wstep=0.8, h=0.92, vbuff=0.30, fs=23)
        tree.scale(0.9).move_to([-3.3, -0.15, 0])
        # reveal top-down so the nesting reads as containment
        for i, b in enumerate(tree.boxes):
            self.play(FadeIn(b, shift=DOWN * 0.15), run_time=0.9)
            if i < len(tree.arrows):
                self.play(GrowArrow(tree.arrows[i]), run_time=0.5)
            wait_until(self, 2.0 + (i + 1) * 1.7)

        # right: AWS = a single flat account box
        aws = service_box("AWS account", "flat isolation boundary",
                          color=C_AWS, w=4.2, h=1.4, fs=26, sub_fs=20)
        aws.move_to([3.4, 1.4, 0])
        vs = Text("vs", font_size=26, color=INK_MUTED).move_to([0.2, 1.4, 0])
        self.play(FadeIn(aws), FadeIn(vs), run_time=1.2)
        wait_until(self, 13.0)

        note = fit_label("you cannot create a resource outside a project",
                         6.0, 23, C_FOCUS).move_to([3.3, -1.4, 0])
        self.play(Write(note), run_time=1.6)
        self.guard(tree, aws, vs, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : IAM cascades down; the Project is the boundary ──────────────────
class Cue01(AvoScene):
    headline = "IAM cascades down; the Project is the boundary"
    cue_duration = 137.0

    def construct(self):
        tree = hierarchy(w0=5.4, wstep=0.8, h=0.92, vbuff=0.34, fs=23)
        tree.scale(0.92).move_to([-3.4, 0.0, 0])
        self.play(FadeIn(tree), run_time=1.6)
        wait_until(self, 3.0)

        # a green cascade arrow running the whole height just left of the tree
        # (the headline already says "IAM cascades", so no side label needed —
        # the arrow + level pulses carry it, and a rotated label ran off-frame)
        arrow_x = tree.boxes[0].box.get_left()[0] - 0.32
        cascade = Arrow([arrow_x, tree.boxes[0].box.get_top()[1], 0],
                        [arrow_x, tree.boxes[-1].box.get_bottom()[1], 0],
                        buff=0.0, color=EMERALD, stroke_width=5.0,
                        max_tip_length_to_length_ratio=0.10)
        self.play(GrowArrow(cascade), run_time=1.6)
        # pulse each level as the grant flows down
        for b in tree.boxes:
            self.play(Indicate(b.box, color=EMERALD, scale_factor=1.05), run_time=0.7)
        wait_until(self, 12.0)

        # badge the Project level as the billing + API boundary
        proj = tree.boxes[2]
        badge = VGroup(
            fit_label("Project = billing boundary", 5.2, 22, C_FOCUS),
            fit_label("+ API-enablement boundary", 5.2, 22, C_FOCUS),
        ).arrange(DOWN, buff=0.2).move_to([3.4, 0.9, 0])
        box = SurroundingRectangle(proj.box, color=C_FOCUS, buff=0.10, corner_radius=0.08)
        self.play(Create(box), FadeIn(badge), run_time=1.6)
        wait_until(self, 17.0)

        folder = fit_label("Folders group teams / environments — and can nest",
                           6.0, 21, INK_MUTED).move_to([3.3, -1.6, 0])
        self.play(Write(folder), run_time=1.6)
        self.guard(tree, cascade, badge, box, folder)
        pace_to(self, self.cue_duration)


# ─── Cue02 : every resource belongs to exactly one project ───────────────────
class Cue02(AvoScene):
    headline = "Every resource lives in exactly one project"
    cue_duration = 138.0

    def construct(self):
        proj = service_box("Project: prod-api", color=EMERALD, w=4.6, h=1.3,
                           fs=26, fill=0.12).move_to([0, 1.7, 0])
        self.play(FadeIn(proj), run_time=1.2)
        wait_until(self, 3.0)

        names = ["VM", "Bucket", "Database", "Cloud Run"]
        chips = [chip(n, color=C_GCP, w=2.7, h=0.95, fs=23) for n in names]
        row = VGroup(*chips).arrange(RIGHT, buff=0.4).move_to([0, -1.1, 0])
        arrows = []
        for i, ch in enumerate(chips):
            self.play(FadeIn(ch, shift=UP * 0.12), run_time=0.7)
            a = Arrow(ch.get_top(), proj.box.get_bottom(), buff=0.12,
                      color=C_NEUTRAL, stroke_width=2.6,
                      max_tip_length_to_length_ratio=0.14)
            arrows.append(a)
            self.play(GrowArrow(a), run_time=0.5)
            wait_until(self, 3.0 + (i + 1) * 1.9)

        note = fit_label("belongs to exactly ONE project — more structured than AWS, scales for large orgs",
                         12.5, 22, C_FOCUS).move_to([0, -2.5, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(proj, row, VGroup(*arrows), note)
        pace_to(self, self.cue_duration)
