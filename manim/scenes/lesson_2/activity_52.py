"""
Lesson 2 — Part 3 (activity 52): "Posterior reads the positive pile" (280.1s).

14 Cue<NN> scenes, one per audio.synced_visual cue (segment_52.json, cues
rescaled to the real 280.1s MP3). Part 3 is the payoff of the Bayes arc: the
posterior is read off the POSITIVE PILE only —

    P(sick | +) = TP / (TP + FP)

In the shared 100-person world (prior 1% sick, sensitivity 99%, specificity 95%)
the positive pile is 1 true positive + 5 false positives, so the posterior is
1/6 ≈ 17% even though the test is "99% accurate". Each cue lights exactly the
pile member / formula term / before→after panel the narration names, reusing the
idioms in bayes.py (positive_pile, posterior_ratio, posterior_numbers,
confusion_matrix, PopGrid, prior_tree, chip, stat_row).
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
    PopGrid, confusion_matrix, positive_pile, posterior_ratio, posterior_numbers,
    prior_tree, chip, fit_label, stat_row,
    C_SICK, C_HEALTHY, C_TP, C_FP, C_POST,
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
    Brace,
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

# Concrete 100-person world (same as Parts 1 & 2): 1 sick, 99 healthy,
# sensitivity 99%, specificity 95% → TP=1, FN=0, FP=5, TN=94.
# The positive pile is therefore 1 true + 5 false = 6.
COUNTS = {"tp": "1", "fp": "5", "fn": "0", "tn": "94"}


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : the core idea — posterior reads the positive pile ────────────────
class Cue00(AvoScene):
    headline = "The core idea: read the positive pile"
    cue_duration = 19.84

    def construct(self):
        formula = posterior_ratio(size=46).move_to(UP * 1.4)
        pile = positive_pile(tp=1, fp=5, r=0.2).scale(0.95).move_to(DOWN * 1.5)
        self.play(Write(formula), run_time=1.8)
        wait_until(self, 6.0)
        self.play(FadeIn(pile.container), FadeIn(pile.label), run_time=1.2)
        self.play(FadeIn(pile.tp_dots, scale=0.8), FadeIn(pile.fp_dots, scale=0.8), run_time=1.2)
        wait_until(self, 14.0)
        self.play(Indicate(formula, color=C_POST, scale_factor=1.08),
                  Indicate(pile.container, color=C_POST, scale_factor=1.06), run_time=1.4)
        self.guard(formula, pile)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the denominator is ALL positives ────────────────────────────────
class Cue01(AvoScene):
    headline = "The denominator is every positive result"
    cue_duration = 19.841

    def construct(self):
        formula = posterior_ratio(size=46).move_to(UP * 1.6)
        pile = positive_pile(tp=1, fp=5, r=0.2).scale(0.95).move_to(DOWN * 1.3)
        self.add(formula)
        wait_until(self, 3.0)
        self.play(FadeIn(pile), run_time=1.4)
        wait_until(self, 8.0)
        box = SurroundingRectangle(pile.container, color=C_POST, buff=0.16, corner_radius=0.1)
        cap = fit_label("denominator = TP + FP = the whole pile", 9.0, BODY_SIZE, C_POST)
        cap.next_to(pile, DOWN, buff=0.3)
        self.play(Create(box), FadeIn(cap), run_time=1.4)
        wait_until(self, 14.0)
        self.play(Indicate(pile.tp_dots, color=C_TP, scale_factor=1.2),
                  Indicate(pile.fp_dots, color=C_FP, scale_factor=1.1), run_time=1.6)
        self.guard(formula, pile, box, cap)
        pace_to(self, self.cue_duration)


# ─── Cue02 : only the positive pile matters (dim the rest) ────────────────────
class Cue02(AvoScene):
    headline = "Only the positive pile matters for the posterior"
    cue_duration = 19.84

    def construct(self):
        grid = PopGrid(10, 10, r=0.11, gap=0.36, base_color=INK_SUBTLE)
        grid.move_to(LEFT * 2.6 + DOWN * 0.1)
        # 1 sick (amber) somewhere; the 6 who test positive = its TP + 5 FP.
        sick_idx = 44
        positives = [sick_idx, 12, 27, 58, 71, 83]  # the sick TP + 5 false positives
        cap = fit_label("100 people → only 6 test positive", 5.4, BODY_SIZE, INK_MUTED)
        cap.move_to(RIGHT * 3.6 + UP * 1.4)
        self.play(FadeIn(grid), run_time=1.4)
        wait_until(self, 4.0)
        grid.dots[sick_idx].set_color(C_SICK)
        self.play(Indicate(grid.dots[sick_idx], color=C_SICK, scale_factor=2.0), run_time=1.2)
        wait_until(self, 8.0)
        # light the positives, dim everyone else
        rings = VGroup()
        anims = []
        for k in positives:
            c = C_TP if k == sick_idx else C_FP
            anims.append(grid.dots[k].animate.set_color(c))
            rings.add(Circle(radius=0.2, color=c, stroke_width=2.5).move_to(grid.dots[k].get_center()))
        others = [grid.dots[i] for i in range(100) if i not in positives]
        self.play(*anims, *[d.animate.set_opacity(0.18) for d in others],
                  Create(rings), FadeIn(cap), run_time=1.8)
        wait_until(self, 15.0)
        pile_lab = fit_label("the posterior lives here: 1 true, 5 false", 5.6, BODY_SIZE, C_POST)
        pile_lab.move_to(RIGHT * 3.6 + DOWN * 0.4)
        self.play(FadeIn(pile_lab), Indicate(rings, color=C_POST, scale_factor=1.15), run_time=1.4)
        self.guard(grid, rings, cap, pile_lab)
        pace_to(self, self.cue_duration)


# ─── Cue03 : before vs after — what info exists before the operation ──────────
class Cue03(AvoScene):
    headline = "Before → after: the prior becomes the posterior"
    cue_duration = 21.008

    def construct(self):
        before = VGroup(
            fit_label("BEFORE", 2.6, LABEL_SIZE, INK_MUTED),
            chip("prior  P(sick) = 1%", color=C_HEALTHY, w=4.6, h=1.05, fs=24),
            fit_label("what we knew before the test", 4.8, BODY_SIZE, INK_MUTED),
        ).arrange(DOWN, buff=0.3).move_to(LEFT * 3.7 + DOWN * 0.1)
        after = VGroup(
            fit_label("AFTER", 2.6, LABEL_SIZE, INK_MUTED),
            chip("posterior  ≈ 17%", color=C_POST, w=4.6, h=1.05, fs=24),
            fit_label("what the positive result changed it to", 5.0, BODY_SIZE, INK_MUTED),
        ).arrange(DOWN, buff=0.3).move_to(RIGHT * 3.7 + DOWN * 0.1)
        arrow = Arrow(LEFT * 1.2, RIGHT * 1.2, buff=0.1, color=INK_MUTED, stroke_width=4).move_to(UP * 0.4)

        self.play(FadeIn(before, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 8.0)
        self.play(GrowArrow(arrow), run_time=1.2)
        self.play(FadeIn(after, shift=LEFT * 0.2), run_time=1.4)
        wait_until(self, 17.0)
        self.play(Indicate(after[1], color=C_POST, scale_factor=1.1), run_time=1.4)
        self.guard(before, after, arrow)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the likelihood — how well the clue fits each suspect ─────────────
class Cue04(AvoScene):
    headline = "Likelihood: how well the clue fits each suspect"
    cue_duration = 19.84

    def construct(self):
        clue = chip("clue: the test came back +", color=AMBER, w=5.6, h=1.0, fs=24).move_to(UP * 2.2)
        sick = VGroup(
            chip("suspect: Sick", color=C_SICK, w=3.6, h=0.95, fs=23),
            MathTex(r"P(+\mid \text{sick})=99\%", font_size=28, color=C_TP),
        ).arrange(DOWN, buff=0.26).move_to(LEFT * 3.5 + DOWN * 0.6)
        healthy = VGroup(
            chip("suspect: Healthy", color=C_HEALTHY, w=3.6, h=0.95, fs=23),
            MathTex(r"P(+\mid \text{healthy})=5\%", font_size=28, color=C_FP),
        ).arrange(DOWN, buff=0.26).move_to(RIGHT * 3.5 + DOWN * 0.6)

        self.play(FadeIn(clue, shift=DOWN * 0.2), run_time=1.2)
        wait_until(self, 6.0)
        self.play(FadeIn(sick, shift=RIGHT * 0.2), run_time=1.2)
        self.play(FadeIn(healthy, shift=LEFT * 0.2), run_time=1.2)
        wait_until(self, 14.0)
        self.play(Indicate(sick[1], color=C_TP, scale_factor=1.15), run_time=1.4)
        cap = fit_label("the clue fits a sick suspect far better", 8.0, BODY_SIZE, INK_MUTED).move_to(DOWN * 2.8)
        self.play(FadeIn(cap), run_time=1.0)
        self.guard(clue, sick, healthy, cap)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the analogy is only a bridge — return to the numbers ────────────
class Cue05(AvoScene):
    headline = "The analogy is only a bridge back to the numbers"
    cue_duration = 19.841

    def construct(self):
        board = chip("detective's board", color=INK_SUBTLE, w=4.4, h=1.1, fs=26).move_to(LEFT * 3.7)
        bridge = fit_label("only a bridge", 2.6, BODY_SIZE, AMBER).move_to(UP * 0.9)
        arrow = Arrow(LEFT * 1.3, RIGHT * 1.3, buff=0.1, color=INK_MUTED, stroke_width=4)
        formula = posterior_ratio(size=34).move_to(RIGHT * 3.6)

        self.play(FadeIn(board), run_time=1.2)
        wait_until(self, 6.0)
        self.play(GrowArrow(arrow), FadeIn(bridge), run_time=1.2)
        wait_until(self, 11.0)
        self.play(Write(formula), run_time=1.6)
        wait_until(self, 16.0)
        self.play(board.animate.set_opacity(0.4),
                  Indicate(formula, color=C_POST, scale_factor=1.1), run_time=1.4)
        self.guard(board, bridge, arrow, formula)
        pace_to(self, self.cue_duration)


# ─── Cue06 : concrete — 1 in 100 sick, test usually right ─────────────────────
class Cue06(AvoScene):
    headline = "1 in 100 sick · the test is usually right"
    cue_duration = 19.84

    def construct(self):
        stats = VGroup(
            stat_row("prior  P(sick)", "1%"),
            stat_row("sensitivity", "99%", val_color=C_TP),
            stat_row("specificity", "95%", val_color=C_HEALTHY),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3).move_to(LEFT * 3.6 + UP * 0.2)
        cm = confusion_matrix(cell_w=2.0, cell_h=1.05, fs=21, counts=COUNTS)
        cm.scale(0.92).move_to(RIGHT * 3.4 + DOWN * 0.1)

        for row in stats:
            self.play(FadeIn(row, shift=RIGHT * 0.2), run_time=0.8)
        wait_until(self, 8.0)
        self.play(FadeIn(cm.body), Create(cm.col_sick), Create(cm.col_healthy),
                  Create(cm.row_pos), Create(cm.row_neg), run_time=1.6)
        wait_until(self, 15.0)
        self.play(Indicate(cm.tp, color=C_TP), Indicate(cm.fp, color=C_FP), run_time=1.4)
        self.guard(stats, cm)
        pace_to(self, self.cue_duration)


# ─── Cue07 : the payoff — posterior = 1 / (1+5) ≈ 17% ─────────────────────────
class Cue07(AvoScene):
    headline = "Posterior = true / all positives ≈ 17%"
    cue_duration = 19.84

    def construct(self):
        pile = positive_pile(tp=1, fp=5, r=0.19).scale(0.9).move_to(UP * 1.7)
        formula = posterior_ratio(size=40).move_to(DOWN * 0.4)
        numbers = posterior_numbers(size=40).next_to(formula, DOWN, buff=0.35)

        self.play(FadeIn(pile), run_time=1.4)
        wait_until(self, 5.0)
        self.play(Write(formula), run_time=1.6)
        wait_until(self, 11.0)
        self.play(Write(numbers), run_time=1.6)
        wait_until(self, 16.0)
        self.play(Indicate(pile.tp_dots, color=C_TP, scale_factor=1.3),
                  Indicate(numbers, color=C_POST, scale_factor=1.1), run_time=1.4)
        self.guard(pile, formula, numbers)
        pace_to(self, self.cue_duration)


# ─── Cue08 : likelihood — how likely is '+' if sick vs if healthy ────────────
class Cue08(AvoScene):
    headline = "How likely is '+' when sick vs when healthy?"
    cue_duration = 19.841

    def construct(self):
        base_y = -2.4
        base = Line(LEFT * 4.6, RIGHT * 4.6, color=INK_SUBTLE, stroke_width=2).move_to([0, base_y, 0])
        # two vertical bars: P(+|sick)=99% tall emerald, P(+|healthy)=5% short rose.
        # Max bar height kept short enough that the label above clears the title band.
        max_h = 3.0
        h_sick = max_h * 0.99
        h_heal = max_h * 0.05 + 0.08
        bar_sick = Rectangle(width=1.6, height=h_sick, stroke_color=C_TP, stroke_width=2.6,
                             fill_color=C_TP, fill_opacity=0.3).move_to([-2.4, base_y + h_sick / 2, 0])
        bar_heal = Rectangle(width=1.6, height=h_heal, stroke_color=C_FP, stroke_width=2.6,
                             fill_color=C_FP, fill_opacity=0.3).move_to([2.4, base_y + h_heal / 2, 0])
        lab_sick = VGroup(Text("99%", font_size=28, color=C_TP, weight="BOLD"),
                          MathTex(r"P(+\mid \text{sick})", font_size=24, color=C_TP)).arrange(DOWN, buff=0.12)
        lab_sick.next_to(bar_sick, UP, buff=0.18)
        lab_heal = VGroup(Text("5%", font_size=28, color=C_FP, weight="BOLD"),
                          MathTex(r"P(+\mid \text{healthy})", font_size=24, color=C_FP)).arrange(DOWN, buff=0.12)
        lab_heal.next_to(bar_heal, UP, buff=0.18)

        self.play(Create(base), run_time=0.8)
        self.play(FadeIn(bar_sick, shift=UP * 0.2), FadeIn(lab_sick), run_time=1.4)
        wait_until(self, 8.0)
        self.play(FadeIn(bar_heal, shift=UP * 0.2), FadeIn(lab_heal), run_time=1.4)
        wait_until(self, 15.0)
        self.play(Indicate(bar_sick, color=C_TP, scale_factor=1.05),
                  Indicate(bar_heal, color=C_FP, scale_factor=1.1), run_time=1.4)
        self.guard(base, bar_sick, bar_heal, lab_sick, lab_heal)
        pace_to(self, self.cue_duration)


# ─── Cue09 : the posterior becomes the next prior (chaining) ──────────────────
class Cue09(AvoScene):
    headline = "The posterior becomes the next prior"
    cue_duration = 19.84

    def construct(self):
        p0 = chip("prior 1%", color=C_HEALTHY, w=2.6, h=0.95, fs=23).move_to(LEFT * 4.6 + UP * 0.2)
        post1 = chip("posterior 17%", color=C_POST, w=3.0, h=0.95, fs=22).move_to(LEFT * 0.6 + UP * 0.2)
        post2 = chip("posterior ↑", color=C_POST, w=2.8, h=0.95, fs=22).move_to(RIGHT * 4.4 + UP * 0.2)
        a1 = Arrow(p0.get_right(), post1.get_left(), buff=0.14, color=INK_MUTED, stroke_width=3)
        a2 = Arrow(post1.get_right(), post2.get_left(), buff=0.14, color=INK_MUTED, stroke_width=3)
        l1 = fit_label("+ test result", 2.6, 20, AMBER).next_to(a1, UP, buff=0.12)
        l2 = fit_label("+ more evidence", 2.8, 20, AMBER).next_to(a2, UP, buff=0.12)

        self.play(FadeIn(p0), run_time=1.0)
        wait_until(self, 5.0)
        self.play(GrowArrow(a1), FadeIn(l1), FadeIn(post1, shift=RIGHT * 0.1), run_time=1.4)
        wait_until(self, 11.0)
        self.play(GrowArrow(a2), FadeIn(l2), FadeIn(post2, shift=RIGHT * 0.1), run_time=1.4)
        wait_until(self, 16.0)
        cap = fit_label("each posterior feeds the next decision", 8.0, BODY_SIZE, INK_MUTED).move_to(DOWN * 2.4)
        self.play(FadeIn(cap), Indicate(post1, color=C_POST, scale_factor=1.1), run_time=1.4)
        self.guard(p0, post1, post2, a1, a2, l1, l2, cap)
        pace_to(self, self.cue_duration)


# ─── Cue10 : naming vs mechanism — a name can hide an empty explanation ───────
class Cue10(AvoScene):
    headline = "A name is not the mechanism"
    cue_duration = 21.008

    def construct(self):
        name = chip('"just apply Bayes\' rule"', color=INK_SUBTLE, w=6.0, h=1.15, fs=26).move_to(UP * 1.9)
        # the mechanism hidden underneath: formula + pile
        formula = posterior_ratio(size=36).move_to(DOWN * 0.2)
        pile = positive_pile(tp=1, fp=5, r=0.16).scale(0.75).move_to(DOWN * 2.4)

        self.play(FadeIn(name), run_time=1.2)
        wait_until(self, 6.0)
        cross = Line(name.get_left() + DOWN * 0.0, name.get_right() + DOWN * 0.0,
                     color=ROSE, stroke_width=4)
        self.play(Create(cross), run_time=0.9)
        wait_until(self, 11.0)
        self.play(name.animate.set_opacity(0.4), Write(formula), run_time=1.6)
        self.play(FadeIn(pile), run_time=1.2)
        wait_until(self, 18.0)
        self.play(Indicate(formula, color=C_POST, scale_factor=1.08),
                  Indicate(pile.container, color=C_POST, scale_factor=1.06), run_time=1.4)
        self.guard(name, cross, formula, pile)
        pace_to(self, self.cue_duration)


# ─── Cue11 : the common mistake — accuracy is not the answer ──────────────────
class Cue11(AvoScene):
    headline = "The mistake: accuracy is not the base rate"
    cue_duration = 19.84

    def construct(self):
        acc = VGroup(
            fit_label("test accuracy", 3.2, BODY_SIZE, INK_MUTED),
            MathTex(r"P(+\mid \text{sick})=99\%", font_size=32, color=C_TP),
        ).arrange(DOWN, buff=0.3).move_to(LEFT * 3.6 + UP * 0.3)
        ans = VGroup(
            fit_label("what you actually want", 3.8, BODY_SIZE, INK_MUTED),
            MathTex(r"P(\text{sick}\mid +)=17\%", font_size=32, color=C_POST),
        ).arrange(DOWN, buff=0.3).move_to(RIGHT * 3.6 + UP * 0.3)
        neq = MathTex(r"\neq", font_size=54, color=ROSE).move_to(UP * 0.1)

        self.play(FadeIn(acc, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 6.0)
        self.play(FadeIn(ans, shift=LEFT * 0.2), run_time=1.4)
        wait_until(self, 11.0)
        self.play(Write(neq), run_time=1.2)
        wait_until(self, 15.0)
        cap = fit_label("forgetting the base rate inflates the answer 6×", 10.0, BODY_SIZE, ROSE).move_to(DOWN * 2.5)
        self.play(FadeIn(cap), Indicate(neq, color=ROSE, scale_factor=1.2), run_time=1.4)
        self.guard(acc, ans, neq, cap)
        pace_to(self, self.cue_duration)


# ─── Cue12 : before — a prior belief waiting to be updated ────────────────────
class Cue12(AvoScene):
    headline = "Before: a prior belief, waiting for evidence"
    cue_duration = 19.841

    def construct(self):
        tree = prior_tree(total_label="100 people", sick_label="1 sick",
                          healthy_label="99 healthy", sick_frac=0.10)
        tree.scale(0.9).move_to(DOWN * 0.1)
        self.play(FadeIn(tree.root), run_time=1.0)
        wait_until(self, 6.0)
        self.play(Create(tree.edge_sick), Create(tree.edge_healthy),
                  FadeIn(tree.sick), FadeIn(tree.healthy), run_time=1.6)
        wait_until(self, 13.0)
        cap = fit_label("the prior: only 1 in 100 is actually sick", 8.5, BODY_SIZE, INK_MUTED).move_to(DOWN * 3.0)
        self.play(FadeIn(cap), Indicate(tree.sick, color=C_SICK, scale_factor=1.15), run_time=1.4)
        self.guard(tree, cap)
        pace_to(self, self.cue_duration)


# ─── Cue13 : after — reweight the prior, carry usable information ─────────────
class Cue13(AvoScene):
    headline = "After: reweight the prior into a usable posterior"
    cue_duration = 19.84

    def construct(self):
        formula = posterior_ratio(size=42).move_to(UP * 1.6)
        numbers = posterior_numbers(size=42).next_to(formula, DOWN, buff=0.35)
        cap = fit_label("a form the next decision can actually use",
                        10.5, BODY_SIZE, INK_MUTED).move_to(DOWN * 2.6)
        self.play(Write(formula), run_time=1.8)
        wait_until(self, 7.0)
        self.play(Write(numbers), run_time=1.8)
        wait_until(self, 13.0)
        self.play(Indicate(numbers, color=C_POST, scale_factor=1.12), run_time=1.4)
        wait_until(self, 17.0)
        self.play(FadeIn(cap), run_time=1.2)
        self.guard(formula, numbers, cap)
        pace_to(self, self.cue_duration)
