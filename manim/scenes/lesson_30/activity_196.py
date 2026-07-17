"""
Lesson 30 - Orientation (activity 196): "Agentic Evals That Matter" (890.42s,
8 cues). Even with perfect reproducible plumbing, the team found their evals
were quietly missing the failures that mattered: single-turn grades one answer
in isolation while agentic tasks carry state across turns; BFCL v3 adds
multi-turn state checks while FunctionGemma promises only single and parallel
calls; the Gemma 4 launch tool-call rate of about ten percent was a chat-template
formatting bug, not weak weights; an agentic benchmark turned a guess into proof
and justified the rollout; what counts as a real eval was a position teams held,
not an oversight; seeded state and held-out discipline keep the score honest;
and a context-disclosure privacy eval is worth building.

Long cues are built in staged beats so no diagram holds static for two minutes.

Cue00 0.0-120.8     good plumbing cannot save a wrong test
Cue01 120.8-250.9   single-turn is blind to multi-turn
Cue02 250.9-381.0   the benchmarks that expose it
Cue03 381.0-520.4   ten percent was a formatting bug
Cue04 520.4-650.5   the right eval turned guess into proof
Cue05 650.5-762.0   what counts as a real eval is a decision
Cue06 762.0-836.4   seeded state and held-out discipline
Cue07 836.4-890.42  disclosure by audience
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from bayes import chip, fit_label
from cloud import service_box, arrow_between
from leaderboard import meter, meter_fill
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


# ─── Cue00 : good plumbing, wrong test ───────────────────────────────────────
class Cue00(AvoScene):
    headline = "Good plumbing cannot save a wrong test"
    cue_duration = 120.8

    def construct(self):
        plumbing = block("reproducible plumbing: solid", EMERALD, w=6.4, h=1.0, fs=24).move_to([0, 2.2, 0])
        self.play(FadeIn(plumbing), run_time=2.0)
        self.play(Indicate(plumbing, color=EMERALD), run_time=1.6)
        wait_until(self, 26.0)

        evals = block("but the evals themselves", AMBER, w=6.0, h=1.0, fs=24).move_to([0, 0.6, 0])
        arr = Arrow(plumbing.get_bottom(), evals.get_top(), color=INK_SUBTLE, buff=0.14, stroke_width=3)
        self.play(GrowArrow(arr), FadeIn(evals), run_time=2.2)
        wait_until(self, 60.0)

        miss = block("quietly missing the failures that matter most", ROSE, w=8.6, h=1.0, fs=24).move_to([0, -1.0, 0])
        self.play(FadeIn(miss), Indicate(miss, color=ROSE), run_time=2.4)
        wait_until(self, 96.0)

        punch = fit_label("which evals to build is the real question", 9.5, 24, INK).move_to([0, -2.6, 0])
        self.play(Write(punch), run_time=2.6)
        self.guard(plumbing, evals, miss, punch)
        pace_to(self, self.cue_duration)


# ─── Cue01 : single-turn blind to multi-turn ─────────────────────────────────
class Cue01(AvoScene):
    headline = "Single-turn is blind to multi-turn"
    cue_duration = 130.1

    def construct(self):
        single = service_box("single-turn", "one answer in isolation", color=ACCENT, w=5.0, h=1.3, fs=25).move_to([0, 1.95, 0])
        self.play(FadeIn(single), run_time=2.0)
        wait_until(self, 30.0)

        turns = VGroup(
            block("turn 1", ACCENT, w=2.4, h=0.85, fs=22),
            block("turn 2", AMBER, w=2.4, h=0.85, fs=22),
            block("turn 3", EMERALD, w=2.4, h=0.85, fs=22),
        ).arrange(RIGHT, buff=0.6).move_to([0, 0.3, 0])
        arr = VGroup(*[Arrow(turns[i].get_right(), turns[i + 1].get_left(), color=INK_SUBTLE, buff=0.1, stroke_width=3) for i in range(2)])
        mt_cap = fit_label("multi-turn agentic task: state carries across turns", 10.5, 22, VIOLET).next_to(turns, UP, buff=0.3)
        self.play(FadeIn(mt_cap), run_time=1.8)
        self.play(FadeIn(turns[0]), run_time=1.4)
        wait_until(self, 60.0)
        self.play(GrowArrow(arr[0]), FadeIn(turns[1]), run_time=1.8)
        wait_until(self, 82.0)
        self.play(GrowArrow(arr[1]), FadeIn(turns[2]), run_time=1.8)
        wait_until(self, 104.0)

        span = DoubleArrow(turns[0].get_bottom() + DOWN * 0.1, turns[2].get_bottom() + DOWN * 0.1, color=ROSE, buff=0.1, stroke_width=3)
        span_cap = fit_label("a tool call can span turns", 6.0, 22, ROSE).next_to(span, DOWN, buff=0.2)
        self.play(GrowArrow(span), FadeIn(span_cap), run_time=2.2)
        self.guard(single, turns, span_cap)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the benchmarks ──────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "The benchmarks that expose it"
    cue_duration = 130.1

    def construct(self):
        bfcl = service_box("Berkeley FCL v3", "multi-turn + state checks", color=EMERALD, w=5.4, h=1.3, fs=24).move_to([0, 1.95, 0])
        self.play(FadeIn(bfcl), run_time=2.2)
        wait_until(self, 34.0)

        fg = service_box("FunctionGemma docs", "single + parallel calls only", color=AMBER, w=5.6, h=1.3, fs=23).move_to([0, 0.4, 0])
        self.play(FadeIn(fg), run_time=2.2)
        wait_until(self, 74.0)

        gap = block("the model card promises less than the benchmark grades", ROSE, w=9.2, h=1.0, fs=23).move_to([0, -1.2, 0])
        self.play(FadeIn(gap), Indicate(gap, color=ROSE), run_time=2.4)
        wait_until(self, 108.0)
        punch = fit_label("grade the world, and match the eval to the real use", 11.0, 23, INK).move_to([0, -2.6, 0])
        self.play(Write(punch), run_time=2.6)
        self.guard(bfcl, fg, gap, punch)
        pace_to(self, self.cue_duration)


# ─── Cue03 : ten percent formatting bug ──────────────────────────────────────
class Cue03(AvoScene):
    headline = "Ten percent was a formatting bug, not weak weights"
    cue_duration = 139.4

    def construct(self):
        m = meter(0.10, w=8.8, h=0.8, color=ROSE, bar_frac=0.6, bar_label="target",
                  title="Gemma 4 launch tool-call pass rate", fs=22).move_to([0, 1.85, 0])
        self.play(FadeIn(m), run_time=2.2)
        self.play(Indicate(m.fill, color=ROSE), run_time=1.6)
        wait_until(self, 34.0)

        weights = block("the weights were fine", EMERALD, w=5.0, h=1.0, fs=24).move_to([-3.2, 0.4, 0])
        template = block("the chat template was wrong", AMBER, w=5.6, h=1.0, fs=23).move_to([3.0, 0.4, 0])
        self.play(FadeIn(weights), run_time=2.0)
        wait_until(self, 64.0)
        self.play(FadeIn(template), run_time=2.0)
        wait_until(self, 96.0)

        fixed = meter_fill(m, 0.84, color=EMERALD)
        fix_cap = block("hand-tuned template lifted the rate", EMERALD, w=7.0, h=0.95, fs=23).move_to([0, -1.4, 0])
        self.play(Transform(m.fill, fixed), FadeIn(fix_cap), run_time=2.6)
        wait_until(self, 124.0)
        self.play(Circumscribe(fix_cap, color=EMERALD), run_time=2.0)
        self.guard(m, weights, template, fix_cap)
        pace_to(self, self.cue_duration)


# ─── Cue04 : guess into proof ────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "The right eval turned a guess into proof"
    cue_duration = 130.1

    def construct(self):
        acad = block("academic single-turn eval: just a low number", ROSE, w=9.2, h=1.0, fs=23).move_to([0, 2.1, 0])
        self.play(FadeIn(acad), run_time=2.2)
        wait_until(self, 38.0)

        agentic = block("agentic benchmark: the failures were formatting", EMERALD, w=9.2, h=1.0, fs=23).move_to([0, 0.4, 0])
        self.play(FadeIn(agentic), run_time=2.2)
        wait_until(self, 78.0)

        proof = block("justified the rollout", VIOLET, w=5.0, h=1.0, fs=24).move_to([0, -1.2, 0])
        arr = Arrow(agentic.get_bottom(), proof.get_top(), color=INK_SUBTLE, buff=0.14, stroke_width=3)
        self.play(GrowArrow(arr), FadeIn(proof), run_time=2.2)
        wait_until(self, 108.0)
        punch = fit_label("a guess became evidence you could act on", 9.5, 23, INK).move_to([0, -2.6, 0])
        self.play(Write(punch), run_time=2.6)
        self.guard(acad, agentic, proof, punch)
        pace_to(self, self.cue_duration)


# ─── Cue05 : a real eval is a decision ───────────────────────────────────────
class Cue05(AvoScene):
    headline = "What counts as a real eval is a decision"
    cue_duration = 111.5

    def construct(self):
        pt = service_box("post-training team", "multi-turn out of scope", color=ACCENT, w=5.4, h=1.3, fs=24).move_to([-3.4, 1.6, 0])
        ev = service_box("evals team", "users depend on it", color=VIOLET, w=5.4, h=1.3, fs=24).move_to([3.4, 1.6, 0])
        self.play(FadeIn(pt), run_time=2.2)
        wait_until(self, 34.0)
        self.play(FadeIn(ev), run_time=2.2)
        wait_until(self, 66.0)

        blind = block("the blind spot was a position somebody held", ROSE, w=8.4, h=1.0, fs=23).move_to([0, -0.6, 0])
        self.play(FadeIn(blind), Indicate(blind, color=ROSE), run_time=2.4)
        wait_until(self, 94.0)
        punch = fit_label("scope is a judgment call, so someone has to own it", 11.0, 23, INK).move_to([0, -2.2, 0])
        self.play(Write(punch), run_time=2.4)
        self.guard(pt, ev, blind, punch)
        pace_to(self, self.cue_duration)


# ─── Cue06 : seeded + held-out ───────────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Seeded state and held-out discipline"
    cue_duration = 74.4

    def construct(self):
        seeded = block("seeded environment grades final state", EMERALD, w=8.0, h=1.0, fs=23).move_to([0, 1.6, 0])
        self.play(FadeIn(seeded), run_time=2.0)
        wait_until(self, 26.0)

        held = block("hold eval data out of training", ACCENT, w=6.6, h=1.0, fs=23).move_to([0, 0.1, 0])
        self.play(FadeIn(held), run_time=2.0)
        wait_until(self, 48.0)
        defeat = block("defeats contamination that inflates the number into a lie", ROSE, w=9.6, h=1.0, fs=22).move_to([0, -1.4, 0])
        self.play(FadeIn(defeat), Indicate(defeat, color=ROSE), run_time=2.4)
        self.guard(seeded, held, defeat)
        pace_to(self, self.cue_duration)


# ─── Cue07 : disclosure by audience ──────────────────────────────────────────
class Cue07(AvoScene):
    headline = "An eval worth building: disclosure by audience"
    cue_duration = 53.9

    def construct(self):
        agent = block("context-disclosure eval", ACCENT, w=5.4, h=1.0, fs=24).move_to([0, 2.0, 0])
        self.play(FadeIn(agent), run_time=1.8)
        wait_until(self, 12.0)
        aud = VGroup(
            chip("wife", color=EMERALD, w=2.2, h=0.8, fs=21),
            chip("friend", color=ACCENT, w=2.2, h=0.8, fs=21),
            chip("colleague", color=AMBER, w=2.8, h=0.8, fs=21),
            chip("stranger", color=ROSE, w=2.6, h=0.8, fs=21),
        ).arrange(RIGHT, buff=0.3).move_to([0, 0.5, 0])
        arrs = VGroup(*[Arrow(agent.get_bottom(), a.get_top(), color=INK_SUBTLE, buff=0.1, stroke_width=2.2) for a in aud])
        self.play(*[GrowArrow(a) for a in arrs], FadeIn(aud, lag_ratio=0.15), run_time=2.4)
        wait_until(self, 34.0)
        note = fit_label("score whether it reveals the right amount to each audience",
                         12.5, 22, INK).move_to([0, -1.4, 0])
        self.play(Write(note), run_time=2.4)
        self.guard(agent, aud, note)
        pace_to(self, self.cue_duration)
