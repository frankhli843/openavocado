"""
Lesson 8 — Orientation (activity 45): "GCP Through an AWS Lens: Core Services,
Projects, and Identity" (1078.97s, 7 cues).

The overview arc: the object we follow all lesson is a single cloud resource
request that must live in the right account boundary and identity model. GCP
feels familiar only after you respect its project and identity boundaries; the
contract behind every request is identity + resource + role + scope.

Uses cloud.py (service_box, map_pair, column, hierarchy, iam_binding, chip),
NOT the ML/algorithm idioms. No formulas — a boundary/identity model, so MathTex
is intentionally absent (theme allows plain Text/idioms here).

Cue00 0-154     high-level map: one object — a cloud resource request; not a translation table
Cue01 154-308   analogy: AWS vs GCP = two office buildings, different floor plan + badges
Cue02 308-462   tiny example: AWS account+roles → GCP org/folder/project/service-account/binding
Cue03 462-617   mechanism: project = container, bindings, service accounts, enabled APIs
Cue04 617-771   implementation: which project? which principal? which role? which API/quota?
Cue05 771-925   misconception: one AWS account is NOT always one GCP project
Cue06 925-1079  synthesis: respect the boundaries — identity + resource + role + scope
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from cloud import (
    service_box, map_pair, column, hierarchy, iam_binding, chip, fit_label,
    C_GCP, C_AWS, C_FOCUS, C_AVOID, C_NEUTRAL,
)
from manim import (
    VGroup, Text, Arrow, Line, RoundedRectangle, SurroundingRectangle,
    FadeIn, FadeOut, Write, Create, GrowArrow, Indicate, Circumscribe, Cross,
    RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : high-level map — the one object we follow ───────────────────────
class Cue00(AvoScene):
    headline = "One object: a cloud resource request"
    cue_duration = 154.0

    def construct(self):
        obj = service_box("a cloud resource request", color=C_FOCUS, w=6.0, h=1.3,
                          fs=28).move_to([0, 0.7, 0])
        self.play(FadeIn(obj, scale=0.9), run_time=1.4)
        wait_until(self, 4.0)

        left = service_box("account boundary", color=C_GCP, w=4.2, h=1.0, fs=24).move_to([-4.0, -1.4, 0])
        right = service_box("identity model", color=C_AWS, w=4.2, h=1.0, fs=24).move_to([4.0, -1.4, 0])
        a1 = Arrow(obj.box.get_bottom(), left.box.get_top(), buff=0.15, color=C_NEUTRAL,
                   stroke_width=2.6, max_tip_length_to_length_ratio=0.16)
        a2 = Arrow(obj.box.get_bottom(), right.box.get_top(), buff=0.15, color=C_NEUTRAL,
                   stroke_width=2.6, max_tip_length_to_length_ratio=0.16)
        self.play(GrowArrow(a1), FadeIn(left), run_time=1.0)
        self.play(GrowArrow(a2), FadeIn(right), run_time=1.0)
        wait_until(self, 11.0)

        note = fit_label("goal: not a translation table — see where GCP draws its boundaries differently",
                         13.0, 22, INK_MUTED).move_to([0, -2.8, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(obj, left, right, a1, a2, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : analogy — two office buildings ──────────────────────────────────
class Cue01(AvoScene):
    headline = "Two office buildings, different floor plans"
    cue_duration = 154.0

    def construct(self):
        def building(name, color, x):
            box = RoundedRectangle(width=4.6, height=3.3, corner_radius=0.16,
                                   stroke_color=color, stroke_width=2.8,
                                   fill_color=color, fill_opacity=0.07).move_to([x, -0.1, 0])
            title = Text(name, font_size=26, color=color, weight="BOLD")
            title.next_to(box.get_top(), DOWN, buff=0.16)
            items = VGroup(*[chip(t, color=color, w=3.4, h=0.55, fs=20)
                             for t in ["rooms", "badges", "teams", "budgets"]])
            items.arrange(DOWN, buff=0.14).next_to(title, DOWN, buff=0.22)
            g = VGroup(box, title, items)
            g.box = box
            return g

        aws = building("AWS", C_AWS, -3.6)
        gcp = building("GCP", C_GCP, 3.6)
        self.play(FadeIn(aws), run_time=1.4)
        self.play(FadeIn(gcp), run_time=1.4)
        wait_until(self, 8.0)
        note = fit_label("same rooms, badges, teams, budgets — but different floor plan and badge rules",
                         13.0, 22, C_FOCUS).move_to([0, -2.9, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(aws, gcp, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : tiny example — AWS start vs GCP start ───────────────────────────
class Cue02(AvoScene):
    headline = "AWS: account + roles → GCP: a whole tree"
    cue_duration = 154.0

    def construct(self):
        aws = column("AWS: you start with",
                     ["account", "IAM roles"],
                     color=C_AWS, chip_w=3.6, chip_h=0.9, fs=22, title_fs=24)
        aws.move_to([-3.7, 0.2, 0])
        gcp = column("GCP: you start with",
                     ["organization", "folders", "projects", "service accounts", "IAM bindings"],
                     color=C_GCP, chip_w=3.8, chip_h=0.72, fs=20, title_fs=24)
        gcp.move_to([3.5, -0.15, 0])

        self.play(FadeIn(aws.header), run_time=0.7)
        for ch in aws.chips:
            self.play(FadeIn(ch, shift=RIGHT * 0.1), run_time=0.6)
        wait_until(self, 7.0)
        self.play(FadeIn(gcp.header), run_time=0.7)
        for ch in gcp.chips:
            self.play(FadeIn(ch, shift=LEFT * 0.1), run_time=0.55)
        wait_until(self, 15.0)
        note = fit_label("the small version keeps the same relationships as the real system",
                         12.0, 22, INK_MUTED).move_to([0, -2.9, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(aws, gcp, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : mechanism — the five moving parts ───────────────────────────────
class Cue03(AvoScene):
    headline = "The mechanism: project, bindings, accounts, APIs"
    cue_duration = 155.0

    def construct(self):
        steps = [
            "1 · a Project is the resource + billing container",
            "2 · IAM bindings attach principals to roles on resources",
            "3 · service accounts are the identities workloads use",
            "4 · APIs must be enabled before services can be used",
            "5 · networks, storage, compute inherit project + IAM",
        ]
        colors = [EMERALD, C_GCP, VIOLET, AMBER, INK]
        rows = VGroup(*[Text(t, font_size=24, color=c)
                        for t, c in zip(steps, colors)])
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.36).move_to([0, 0.1, 0])
        if rows.width > 12.6:
            rows.scale(12.6 / rows.width)
        for i, r in enumerate(rows):
            self.play(FadeIn(r, shift=RIGHT * 0.18), run_time=0.8)
            wait_until(self, 2.0 + (i + 1) * 2.2)
        box = SurroundingRectangle(rows[0], color=EMERALD, buff=0.12, corner_radius=0.08)
        self.play(Create(box), Indicate(rows[0], color=EMERALD, scale_factor=1.04), run_time=1.4)
        self.guard(rows, box)
        pace_to(self, self.cue_duration)


# ─── Cue04 : implementation — the four questions ─────────────────────────────
class Cue04(AvoScene):
    headline = "Four questions that check any request"
    cue_duration = 154.0

    def construct(self):
        qs = [
            ("which PROJECT", "owns this resource?", C_GCP),
            ("which PRINCIPAL", "is acting?", ACCENT_LIGHT),
            ("which ROLE", "grants the permission?", EMERALD),
            ("which API / QUOTA", "blocks it?", AMBER),
        ]
        cards = []
        for head, sub, color in qs:
            box = RoundedRectangle(width=5.6, height=1.15, corner_radius=0.14,
                                   stroke_color=color, stroke_width=2.4,
                                   fill_color=color, fill_opacity=0.10)
            t = VGroup(
                Text(head, font_size=24, color=color, weight="BOLD"),
                fit_label(sub, 5.0, 20, INK_MUTED),
            ).arrange(DOWN, buff=0.12).move_to(box.get_center())
            cards.append(VGroup(box, t))
        grid = VGroup(*cards).arrange_in_grid(rows=2, cols=2, buff=(0.6, 0.5)).move_to([0, -0.1, 0])
        for c in cards:
            self.play(FadeIn(c, scale=0.94), run_time=0.9)
            wait_until(self, elapsed(self) + 1.7)
        note = fit_label("if these line up, the concept is usable — not just memorized",
                         12.0, 22, C_FOCUS).move_to([0, -2.9, 0])
        self.play(Write(note), run_time=1.6)
        self.guard(grid, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : misconception — one account ≠ one project ───────────────────────
class Cue05(AvoScene):
    headline = "One AWS account is not always one project"
    cue_duration = 154.0

    def construct(self):
        # the tempting wrong mapping, struck through
        acct = service_box("1 AWS account", color=C_AWS, w=3.8, h=1.1, fs=24).move_to([-3.6, 1.5, 0])
        proj = service_box("1 GCP project", color=C_GCP, w=3.8, h=1.1, fs=24).move_to([3.6, 1.5, 0])
        eq = Text("=", font_size=40, color=INK_MUTED).move_to([0, 1.5, 0])
        self.play(FadeIn(acct), FadeIn(eq), FadeIn(proj), run_time=1.4)
        wait_until(self, 4.5)
        strike = Line(eq.get_left() + LEFT * 0.3, eq.get_right() + RIGHT * 0.3,
                      color=C_AVOID, stroke_width=6.0)
        wrong = fit_label("not in every situation", 4.0, 20, C_AVOID).next_to(eq, DOWN, buff=0.3)
        self.play(Create(strike), FadeIn(wrong), run_time=1.2)
        wait_until(self, 9.0)

        # the correct picture: org + folders above several projects
        org = service_box("Organization", color=C_GCP, w=5.2, h=0.85, fs=22).move_to([0, -0.6, 0])
        projects = VGroup(*[chip(f"project {n}", color=EMERALD, w=2.5, h=0.7, fs=19)
                            for n in ("dev", "staging", "prod")])
        projects.arrange(RIGHT, buff=0.5).move_to([0, -2.0, 0])
        arrows = VGroup(*[Arrow(org.box.get_bottom(), p.get_top(), buff=0.12, color=C_NEUTRAL,
                                stroke_width=2.4, max_tip_length_to_length_ratio=0.16)
                          for p in projects])
        self.play(FadeIn(org), run_time=0.9)
        self.play(GrowArrow(arrows[0]), GrowArrow(arrows[1]), GrowArrow(arrows[2]),
                  FadeIn(projects), run_time=1.4)
        good = fit_label("the organization and folder layers matter", 8.0, 21, C_FOCUS).move_to([0, -3.0, 0])
        self.play(FadeIn(good), run_time=1.2)
        self.guard(acct, proj, eq, strike, wrong, org, projects, arrows, good)
        pace_to(self, self.cue_duration)


# ─── Cue06 : synthesis — the contract ────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Respect the boundaries and GCP feels familiar"
    cue_duration = 154.0

    def construct(self):
        take = fit_label("GCP feels familiar only after you respect its project and identity boundaries",
                         13.0, 25, INK).move_to([0, 1.9, 0])
        self.play(Write(take), run_time=2.2)
        wait_until(self, 5.0)

        parts = ["identity", "resource", "role", "scope"]
        chips = [chip(p, color=col, w=2.7, h=1.0, fs=24)
                 for p, col in zip(parts, [C_GCP, AMBER, EMERALD, VIOLET])]
        pluses = [Text("+", font_size=32, color=INK_MUTED) for _ in range(3)]
        seq = []
        for i, ch in enumerate(chips):
            seq.append(ch)
            if i < 3:
                seq.append(pluses[i])
        contract = VGroup(*seq).arrange(RIGHT, buff=0.35).move_to([0, -0.3, 0])
        if contract.width > 12.6:
            contract.scale(12.6 / contract.width)
        clabel = Text("the contract behind every request", font_size=22, color=INK_MUTED)
        clabel.next_to(contract, UP, buff=0.5)
        self.play(FadeIn(clabel), run_time=0.8)
        for m in seq:
            self.play(FadeIn(m, scale=0.9), run_time=0.5)
        wait_until(self, 14.0)
        note = fit_label("keep the object visible, and the rest of the lesson stops being mysterious",
                         12.5, 22, C_FOCUS).move_to([0, -2.6, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(take, contract, clabel, note)
        pace_to(self, self.cue_duration)
