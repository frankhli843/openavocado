"""
Lesson 2 — Part 1 (activity 10): "Prior filters the population" (278.42s).

14 Cue<NN> scenes, one per audio.synced_visual cue (segment_10.json, cues
rescaled to the real 278.42s MP3). The visual spine for Part 1 is the classic
Bayes base-rate story, built from the shared idioms in bayes.py:

  the prior splits a population of 100 into a tiny SICK branch and a large
  HEALTHY branch (tree) — that split is fixed BEFORE any test; the likelihood
  is how strongly a positive test favors each branch; the posterior reads only
  the positive pile, where a 99%-accurate test on a 1%-rare condition still
  yields mostly FALSE positives (1 true + ~5 false → ≈17% posterior). Each cue
  lights exactly the element the narration names.

Concrete model used throughout (stated in Cue06): 100 people, prior 1% sick,
sensitivity 99%, specificity 95% → 1 true positive + ~5 false positives.
"""

import theme
from theme import (
    AvoScene,
    ACCENT,
    ACCENT_LIGHT,
    AMBER,
    EMERALD,
    ROSE,
    VIOLET,
    INK,
    INK_MUTED,
    INK_SUBTLE,
    LABEL_SIZE,
    BODY_SIZE,
)
from pacing import pace_to, elapsed
import bayes
from bayes import (
    PopGrid, prior_tree, bayes_spine, bayes_formula, posterior_ratio,
    chip, fit_label, stat_row, C_SICK, C_HEALTHY, C_TP, C_FP, C_POST,
)
from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Text,
    MathTex,
    Arrow,
    Line,
    DashedLine,
    Circle,
    Dot,
    SurroundingRectangle,
    FadeIn,
    FadeOut,
    Write,
    GrowArrow,
    Create,
    Transform,
    Indicate,
    Flash,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
)

# Which grid dots are sick / false-positive (100-person grid, prior 1%).
SICK_IDX = [44]                       # the 1 truly sick person → true positive
FP_IDX = [12, 29, 57, 73, 91]         # ~5 healthy false positives (5% of 99)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def make_grid():
    g = PopGrid(10, 10, r=0.12, gap=0.34, base_color=INK_SUBTLE)
    g.scale(0.92).move_to(DOWN * 0.35)
    return g


# ─── Cue00 : intro / the updating loop ───────────────────────────────────────
class Cue00(AvoScene):
    headline = "Prior filters the population"
    cue_duration = 19.721

    def construct(self):
        spine = bayes_spine(fs=24, y=-0.2)
        sub = fit_label("Before any test result, the prior sets the stage.",
                        11.5, BODY_SIZE, INK_MUTED).move_to(UP * 1.9)
        self.play(FadeIn(sub, shift=DOWN * 0.2), run_time=1.2)
        wait_until(self, 3.0)
        self.play(FadeIn(spine.prior, shift=RIGHT * 0.2), run_time=1.0)
        wait_until(self, 7.0)
        self.play(GrowArrow(spine.a1), FadeIn(spine.like), run_time=1.2)
        wait_until(self, 12.0)
        self.play(GrowArrow(spine.a2), FadeIn(spine.post), run_time=1.2)
        wait_until(self, 16.0)
        self.play(Indicate(spine.prior, color=C_HEALTHY, scale_factor=1.1), run_time=1.0)
        self.guard(spine, sub)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the prior splits the population into branches ────────────────────
class Cue01(AvoScene):
    headline = "The prior sizes the branches — before any test"
    cue_duration = 19.722

    def construct(self):
        tree = prior_tree(total_label="100 people", sick_label="Sick · 1",
                          healthy_label="Healthy · 99", sick_frac=0.10)
        tree.move_to(DOWN * 0.25)
        self.play(FadeIn(tree.root, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 4.0)
        self.play(Create(tree.edge_healthy), FadeIn(tree.healthy), run_time=1.6)
        wait_until(self, 9.0)
        self.play(Create(tree.edge_sick), FadeIn(tree.sick), run_time=1.6)
        wait_until(self, 14.0)
        cap = fit_label("Branch sizes = the prior. Fixed before evidence.",
                        11.5, BODY_SIZE, AMBER).move_to(DOWN * 3.0)
        self.play(FadeIn(cap), Indicate(tree.sick, color=C_SICK, scale_factor=1.15), run_time=1.4)
        self.guard(tree)
        pace_to(self, self.cue_duration)


# ─── Cue02 : that object = the population split (state before evidence) ───────
class Cue02(AvoScene):
    headline = "The object: the population split itself"
    cue_duration = 19.721

    def construct(self):
        grid = make_grid()
        grid.color_indices(SICK_IDX, C_SICK)
        self.play(FadeIn(grid), run_time=1.6)
        wait_until(self, 4.0)
        # ring the one sick person
        ring = Circle(radius=0.34, color=C_SICK, stroke_width=3).move_to(grid.dots[SICK_IDX[0]].get_center())
        self.play(Create(ring), run_time=1.0)
        lab = fit_label("1 sick in 100 — the state before any test", 11.0, BODY_SIZE, INK).move_to(UP * 2.1)
        self.play(FadeIn(lab), run_time=1.0)
        wait_until(self, 11.0)
        self.play(Indicate(grid, color=INK_MUTED, scale_factor=1.03), run_time=1.2)
        wait_until(self, 15.0)
        self.play(Flash(grid.dots[SICK_IDX[0]], color=C_SICK, flash_radius=0.5), run_time=1.0)
        self.guard(grid, lab)
        pace_to(self, self.cue_duration)


# ─── Cue03 : before / after the operation (analogy scaffold) ──────────────────
class Cue03(AvoScene):
    headline = "Before the test, and what the test changes"
    cue_duration = 20.882

    def construct(self):
        before = VGroup(
            fit_label("BEFORE", 3.0, LABEL_SIZE, INK_MUTED),
            chip("Prior belief", color=C_HEALTHY, w=3.6, h=1.0, fs=24),
        ).arrange(DOWN, buff=0.35).move_to(LEFT * 4.0 + DOWN * 0.2)
        after = VGroup(
            fit_label("AFTER", 3.0, LABEL_SIZE, INK_MUTED),
            chip("Updated belief", color=C_POST, w=3.6, h=1.0, fs=24),
        ).arrange(DOWN, buff=0.35).move_to(RIGHT * 4.0 + DOWN * 0.2)
        op = chip("test result", color=C_SICK, w=2.8, h=0.95, fs=22).move_to(DOWN * 0.2)
        a1 = Arrow(before.get_right(), op.get_left(), buff=0.15, color=INK_MUTED)
        a2 = Arrow(op.get_right(), after.get_left(), buff=0.15, color=INK_MUTED)

        self.play(FadeIn(before, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 5.0)
        self.play(GrowArrow(a1), FadeIn(op), run_time=1.4)
        wait_until(self, 11.0)
        self.play(GrowArrow(a2), FadeIn(after, shift=LEFT * 0.2), run_time=1.4)
        wait_until(self, 16.0)
        self.play(Indicate(op, color=C_SICK, scale_factor=1.12), run_time=1.2)
        self.guard(before, after, op)
        pace_to(self, self.cue_duration)


# ─── Cue04 : likelihood = how well the clue fits each branch ──────────────────
class Cue04(AvoScene):
    headline = "Likelihood: how well a '+' fits each branch"
    cue_duration = 19.721

    def construct(self):
        tree = prior_tree(total_label="100 people", sick_label="Sick · 1",
                          healthy_label="Healthy · 99", sick_frac=0.10)
        tree.move_to(LEFT * 0.6 + DOWN * 0.25)
        self.add(tree)
        # likelihood labels pinned to each branch (green = catches sick, rose = false alarm)
        l_sick = MathTex(r"P(+\mid \text{sick})=0.99", font_size=30, color=C_TP)
        l_sick.next_to(tree.sick, UP, buff=0.18)
        l_heal = MathTex(r"P(+\mid \text{healthy})=0.05", font_size=30, color=C_FP)
        l_heal.next_to(tree.healthy, DOWN, buff=0.18)
        wait_until(self, 4.0)
        self.play(Write(l_sick), Indicate(tree.sick, color=C_TP, scale_factor=1.1), run_time=1.6)
        wait_until(self, 11.0)
        self.play(Write(l_heal), Indicate(tree.healthy, color=C_FP, scale_factor=1.05), run_time=1.6)
        wait_until(self, 16.0)
        self.play(Indicate(l_sick, color=C_TP), Indicate(l_heal, color=C_FP), run_time=1.2)
        self.guard(tree, l_sick, l_heal)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the analogy is only a bridge → to the numbers ────────────────────
class Cue05(AvoScene):
    headline = "The analogy is only a bridge"
    cue_duration = 19.722

    def construct(self):
        analogy = chip("detective's board", color=INK_SUBTLE, w=4.2, h=1.1, fs=26).move_to(LEFT * 4.0)
        bridge = Arrow(LEFT * 1.6, RIGHT * 1.6, buff=0.1, color=INK_MUTED, stroke_width=4)
        real = chip("the actual numbers", color=EMERALD, w=4.4, h=1.1, fs=26).move_to(RIGHT * 4.0)
        self.play(FadeIn(analogy), run_time=1.2)
        wait_until(self, 5.0)
        self.play(GrowArrow(bridge), run_time=1.2)
        wait_until(self, 10.0)
        self.play(FadeIn(real, shift=LEFT * 0.2), run_time=1.2)
        wait_until(self, 14.0)
        self.play(analogy.animate.set_opacity(0.35),
                  Indicate(real, color=EMERALD, scale_factor=1.1), run_time=1.4)
        self.guard(analogy, real, bridge)
        pace_to(self, self.cue_duration)


# ─── Cue06 : the concrete numbers (1 in 100, 99% right) ───────────────────────
class Cue06(AvoScene):
    headline = "1 in 100 sick · test 99% right"
    cue_duration = 19.721

    def construct(self):
        grid = make_grid()
        self.play(FadeIn(grid), run_time=1.2)
        wait_until(self, 3.0)
        grid.color_indices(SICK_IDX, C_SICK)
        ring = Circle(radius=0.32, color=C_SICK, stroke_width=3).move_to(grid.dots[SICK_IDX[0]].get_center())
        self.play(grid.dots[SICK_IDX[0]].animate.set_color(C_SICK), Create(ring), run_time=1.2)
        stats = VGroup(
            stat_row("prior  P(sick)", "1%"),
            stat_row("sensitivity  P(+|sick)", "99%"),
            stat_row("specificity  P(–|healthy)", "95%"),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.28).to_edge(RIGHT, buff=0.6).shift(DOWN * 0.2)
        wait_until(self, 8.0)
        for row in stats:
            self.play(FadeIn(row, shift=LEFT * 0.2), run_time=0.9)
        wait_until(self, 16.0)
        self.play(Indicate(stats[0], color=C_HEALTHY), run_time=1.2)
        self.guard(grid, stats)
        pace_to(self, self.cue_duration)


# ─── Cue07 : retrieval practice — change one variable, predict ────────────────
class Cue07(AvoScene):
    headline = "Retrieval practice: change one, predict the rest"
    cue_duration = 19.721

    def construct(self):
        vars_ = VGroup(
            chip("prior ↑", color=C_HEALTHY, w=3.0, h=1.0, fs=24),
            chip("sensitivity", color=C_TP, w=3.0, h=1.0, fs=24),
            chip("specificity", color=C_FP, w=3.0, h=1.0, fs=24),
        ).arrange(DOWN, buff=0.4).move_to(LEFT * 3.6)
        q = fit_label("predict → posterior ?", 4.5, LABEL_SIZE, VIOLET).move_to(RIGHT * 3.6)
        arrow = Arrow(vars_.get_right(), q.get_left(), buff=0.3, color=INK_MUTED)
        self.play(FadeIn(vars_, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 5.0)
        self.play(GrowArrow(arrow), FadeIn(q), run_time=1.2)
        wait_until(self, 9.0)
        # bump the prior chip to show "change one variable"
        self.play(Indicate(vars_[0], color=C_HEALTHY, scale_factor=1.2), run_time=1.2)
        wait_until(self, 14.0)
        self.play(vars_[0].animate.shift(UP * 0.15).set_color(EMERALD),
                  Indicate(q, color=VIOLET), run_time=1.4)
        self.guard(vars_, q)
        pace_to(self, self.cue_duration)


# ─── Cue08 : likelihood if true vs if false ──────────────────────────────────
class Cue08(AvoScene):
    headline = "How likely is '+' if true — and if false?"
    cue_duration = 19.722

    def construct(self):
        true_b = VGroup(
            chip("if SICK (true)", color=C_TP, w=4.0, h=1.0, fs=24),
            MathTex(r"P(+\mid \text{sick})=0.99", font_size=32, color=C_TP),
        ).arrange(DOWN, buff=0.4).move_to(LEFT * 3.6 + DOWN * 0.1)
        false_b = VGroup(
            chip("if HEALTHY (false)", color=C_FP, w=4.0, h=1.0, fs=24),
            MathTex(r"P(+\mid \text{healthy})=0.05", font_size=32, color=C_FP),
        ).arrange(DOWN, buff=0.4).move_to(RIGHT * 3.6 + DOWN * 0.1)
        self.play(FadeIn(true_b, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 7.0)
        self.play(FadeIn(false_b, shift=LEFT * 0.2), run_time=1.4)
        wait_until(self, 13.0)
        self.play(Indicate(true_b[1], color=C_TP), Indicate(false_b[1], color=C_FP), run_time=1.4)
        self.guard(true_b, false_b)
        pace_to(self, self.cue_duration)


# ─── Cue09 : the mechanism improves what comes next ──────────────────────────
class Cue09(AvoScene):
    headline = "The posterior feeds the next decision"
    cue_duration = 19.721

    def construct(self):
        spine = bayes_spine(fs=24, y=0.3)
        nxt = chip("next decision", color=EMERALD, w=3.4, h=1.0, fs=24).move_to(RIGHT * 4.6 + DOWN * 2.2)
        drop = Arrow(spine.post.get_bottom(), nxt.get_top(), buff=0.12, color=INK_MUTED, stroke_width=3)
        self.add(spine)
        self.play(Indicate(spine.post, color=C_POST, scale_factor=1.1), run_time=1.4)
        wait_until(self, 6.0)
        self.play(GrowArrow(drop), FadeIn(nxt, shift=UP * 0.2), run_time=1.6)
        wait_until(self, 12.0)
        cap = fit_label("Evidence leaves in a form the next step can use.",
                        11.5, BODY_SIZE, INK_MUTED).move_to(DOWN * 3.1)
        self.play(FadeIn(cap), run_time=1.2)
        wait_until(self, 16.0)
        self.play(Indicate(nxt, color=EMERALD), run_time=1.2)
        self.guard(spine, nxt, cap)
        pace_to(self, self.cue_duration)


# ─── Cue10 : naming the mechanism is not enough ──────────────────────────────
class Cue10(AvoScene):
    headline = "A name can hide an empty explanation"
    cue_duration = 20.882

    def construct(self):
        name = chip('"Bayesian updating"', color=INK_SUBTLE, w=5.0, h=1.2, fs=28).move_to(UP * 1.7)
        hollow = fit_label("a label — not an explanation", 7.0, BODY_SIZE, ROSE).next_to(name, DOWN, buff=0.35)
        mech = posterior_ratio(size=40).move_to(DOWN * 1.5)
        self.play(FadeIn(name), run_time=1.2)
        wait_until(self, 5.0)
        self.play(FadeIn(hollow, shift=UP * 0.1), name.animate.set_opacity(0.4), run_time=1.4)
        wait_until(self, 11.0)
        self.play(Write(mech), run_time=1.8)
        wait_until(self, 16.0)
        self.play(Indicate(mech, color=C_POST, scale_factor=1.12), run_time=1.4)
        self.guard(name, hollow, mech)
        pace_to(self, self.cue_duration)


# ─── Cue11 : the base-rate trap ──────────────────────────────────────────────
class Cue11(AvoScene):
    headline = "The trap: high accuracy, tiny base rate"
    cue_duration = 19.721

    def construct(self):
        grid = make_grid()
        self.add(grid)
        grid.color_indices(SICK_IDX, C_TP)      # 1 true positive
        grid.color_indices(FP_IDX, C_FP)        # ~5 false positives
        self.play(Indicate(grid.dots[SICK_IDX[0]], color=C_TP, scale_factor=2.0), run_time=1.2)
        wait_until(self, 4.0)
        for k in FP_IDX:
            self.play(Flash(grid.dots[k], color=C_FP, flash_radius=0.35), run_time=0.5)
        wait_until(self, 11.0)
        legend = VGroup(
            stat_row("true positive", "1", val_color=C_TP),
            stat_row("false positives", "5", val_color=C_FP),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3).to_edge(RIGHT, buff=0.6).shift(DOWN * 0.2)
        self.play(FadeIn(legend, shift=LEFT * 0.2), run_time=1.2)
        wait_until(self, 16.0)
        cap = fit_label("99% accurate — yet most positives are false.",
                        11.5, BODY_SIZE, ROSE).move_to(UP * 2.2)
        self.play(FadeIn(cap), run_time=1.2)
        self.guard(grid, legend, cap)
        pace_to(self, self.cue_duration)


# ─── Cue12 : before vs after the update ──────────────────────────────────────
class Cue12(AvoScene):
    headline = "Before: a prior. After: reweighted by evidence"
    cue_duration = 19.722

    def construct(self):
        before = VGroup(
            fit_label("BEFORE", 3.0, LABEL_SIZE, INK_MUTED),
            MathTex(r"P(\text{sick})=0.01", font_size=34, color=C_HEALTHY),
        ).arrange(DOWN, buff=0.35).move_to(LEFT * 3.8 + DOWN * 0.1)
        after = VGroup(
            fit_label("AFTER  '+'", 3.0, LABEL_SIZE, INK_MUTED),
            MathTex(r"P(\text{sick}\mid +)\approx 0.17", font_size=34, color=C_POST),
        ).arrange(DOWN, buff=0.35).move_to(RIGHT * 3.8 + DOWN * 0.1)
        arrow = Arrow(before.get_right(), after.get_left(), buff=0.35, color=INK_MUTED, stroke_width=3)
        self.play(FadeIn(before, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 6.0)
        self.play(GrowArrow(arrow), run_time=1.2)
        wait_until(self, 10.0)
        self.play(FadeIn(after, shift=LEFT * 0.2), run_time=1.4)
        wait_until(self, 15.0)
        self.play(Indicate(after[1], color=C_POST, scale_factor=1.15), run_time=1.4)
        self.guard(before, after)
        pace_to(self, self.cue_duration)


# ─── Cue13 : use the likelihoods to reweight the prior ───────────────────────
class Cue13(AvoScene):
    headline = "Reweight the prior with the likelihoods"
    cue_duration = 19.721

    def construct(self):
        formula = posterior_ratio(size=46).move_to(UP * 1.6)
        calc = MathTex(r"=\frac{1}{1+5}=\tfrac{1}{6}\approx 17\%",
                       font_size=44, color=C_POST).move_to(DOWN * 0.6)
        self.play(Write(formula), run_time=1.8)
        wait_until(self, 6.0)
        self.play(Write(calc), run_time=1.8)
        wait_until(self, 12.0)
        self.play(Indicate(calc, color=C_POST, scale_factor=1.12), run_time=1.4)
        wait_until(self, 16.0)
        cap = fit_label("The positive pile — reweighted — is the posterior.",
                        11.5, BODY_SIZE, INK_MUTED).move_to(DOWN * 2.6)
        self.play(FadeIn(cap), run_time=1.2)
        self.guard(formula, calc, cap)
        pace_to(self, self.cue_duration)
