"""
Lesson 8 — Part 4 (activity 49): "IAM and Cloud Identity" (438.26s, 3 cues).

GCP IAM answers who / what / where: every policy is a binding of a principal
(who) + a role (what) + a resource (where). Principals span user / service
account / group / domain; roles span Basic / Predefined / Custom. Service
accounts are machine identities that remove long-lived credential juggling.

Uses cloud.py (iam_binding, service_box, column, chip). No formulas — an
identity model, so MathTex is intentionally absent.

Cue00 0-146     IAM = a binding: principal (who) + role (what) + resource (where)
Cue01 146-292   principal kinds (user/SA/group/domain) · role kinds (Basic/Predefined/Custom)
Cue02 292-438   a concrete grant; service accounts = machine identity, no long-lived keys
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from cloud import (
    service_box, iam_binding, column, chip, fit_label,
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


# ─── Cue00 : the binding — who + what + where ────────────────────────────────
class Cue00(AvoScene):
    headline = "IAM = a binding of who, what, where"
    cue_duration = 146.0

    def construct(self):
        question = fit_label("which principal can perform which actions on which resources?",
                             12.5, 24, INK).move_to([0, 2.2, 0])
        self.play(Write(question), run_time=2.0)
        wait_until(self, 4.0)

        bind = iam_binding("principal", "role", "resource", w=3.4, h=1.1, fs=24)
        bind.move_to([0, 0.1, 0])
        tags = VGroup(
            Text("WHO", font_size=22, color=C_GCP, weight="BOLD").next_to(bind.principal, DOWN, buff=0.3),
            Text("WHAT", font_size=22, color=EMERALD, weight="BOLD").next_to(bind.role, DOWN, buff=0.3),
            Text("WHERE", font_size=22, color=C_AWS, weight="BOLD").next_to(bind.resource, DOWN, buff=0.3),
        )
        self.play(FadeIn(bind.principal), run_time=0.8)
        self.play(FadeIn(tags[0]), run_time=0.5)
        self.play(FadeIn(bind.plus1), FadeIn(bind.role), run_time=0.9)
        self.play(FadeIn(tags[1]), run_time=0.5)
        self.play(FadeIn(bind.plus2), FadeIn(bind.resource), run_time=0.9)
        self.play(FadeIn(tags[2]), run_time=0.5)
        wait_until(self, 12.0)

        note = fit_label("every IAM policy is exactly this three-part binding",
                         11.0, 23, C_FOCUS).move_to([0, -2.2, 0])
        self.play(Write(note), run_time=1.6)
        self.guard(question, bind, tags, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : principal kinds and role kinds ──────────────────────────────────
class Cue01(AvoScene):
    headline = "Principals and roles each come in kinds"
    cue_duration = 146.0

    def construct(self):
        principals = column("Principals (who)",
                            ["user account", "service account", "Google group", "domain"],
                            color=C_GCP, chip_w=3.7, chip_h=0.8, fs=21, title_fs=24)
        principals.move_to([-3.5, -0.1, 0])
        roles = column("Roles (what)",
                       ["Basic — Owner/Editor/Viewer", "Predefined — curated", "Custom — exact set"],
                       color=EMERALD, chip_w=4.2, chip_h=0.86, fs=20, title_fs=24)
        roles.move_to([3.3, 0.05, 0])

        self.play(FadeIn(principals.header), run_time=0.7)
        for ch in principals.chips:
            self.play(FadeIn(ch, shift=RIGHT * 0.12), run_time=0.6)
        wait_until(self, 8.0)
        self.play(FadeIn(roles.header), run_time=0.7)
        for ch in roles.chips:
            self.play(FadeIn(ch, shift=LEFT * 0.12), run_time=0.6)
        wait_until(self, 15.0)
        # flag the "avoid Basic in production" caveat
        warn = fit_label("Basic roles are very broad — avoid in production",
                         6.4, 19, ROSE).next_to(roles, DOWN, buff=0.4)
        self.play(Indicate(roles.chips[0], color=ROSE, scale_factor=1.05),
                  FadeIn(warn), run_time=1.4)
        self.guard(principals, roles, warn)
        pace_to(self, self.cue_duration)


# ─── Cue02 : a concrete grant + service accounts ─────────────────────────────
class Cue02(AvoScene):
    headline = "Bind it — and let machines act as themselves"
    cue_duration = 146.0

    def construct(self):
        bind = iam_binding("user: frank", "roles/run.developer", "project: prod-api",
                           w=3.7, h=1.05, fs=19, gap=0.32)
        if bind.width > 12.6:
            bind.scale(12.6 / bind.width)
        bind.move_to([0, 1.6, 0])
        self.play(FadeIn(bind.principal), FadeIn(bind.plus1), FadeIn(bind.role),
                  FadeIn(bind.plus2), FadeIn(bind.resource), run_time=1.8)
        grant = fit_label("\"grant frank the role roles/run.developer on prod-api\"",
                          12.0, 21, INK_MUTED).next_to(bind, DOWN, buff=0.4)
        self.play(Write(grant), run_time=1.6)
        wait_until(self, 7.0)

        sa = service_box("service account", "a machine identity",
                         color=VIOLET, w=4.6, h=1.3, fs=25, sub_fs=19).move_to([0, -1.3, 0])
        self.play(FadeIn(sa), run_time=1.2)
        wait_until(self, 11.0)
        note = fit_label("workloads act without long-lived keys — removing whole classes of credential bugs",
                         13.0, 21, C_FOCUS).move_to([0, -2.9, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(bind, grant, sa, note)
        pace_to(self, self.cue_duration)
