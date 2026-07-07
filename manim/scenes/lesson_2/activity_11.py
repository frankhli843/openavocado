"""
Lesson 2 — Part 2 (activity 11): "Sensitivity and specificity run the test" (298.18s).

14 Cue<NN> scenes, one per audio.synced_visual cue (segment_11.json, cues
rescaled to the real 298.18s MP3). Part 2 zooms in on the two dials of a test
and the 2×2 confusion matrix they fill, using the shared idioms in bayes.py:

  sensitivity = TP/(TP+FN) = P(+|sick)   catches the sick        (emerald)
  specificity = TN/(TN+FP) = P(−|healthy) blocks false alarms    (accent)

Both dials feed the POSITIVE PILE (TP + FP), which is where the posterior is
read. The concrete model (stated Cue06) is the same 100-person world as Part 1:
prior 1% sick, sensitivity 99%, specificity 95% → confusion counts TP=1, FN=0,
FP=5, TN=94, so the positive pile is 1 true + 5 false. Each cue lights exactly
the cell / dial / formula the narration names.
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
    PopGrid, confusion_matrix, sensitivity_formula, specificity_formula,
    posterior_ratio, chip, fit_label, stat_row,
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

# Concrete 100-person world (same as Part 1): 1 sick, 99 healthy,
# sensitivity 99%, specificity 95% → TP=1, FN=0, FP=5, TN=94.
COUNTS = {"tp": "1", "fp": "5", "fn": "0", "tn": "94"}


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : the two dials of a test ─────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Two dials that run the test"
    cue_duration = 21.121

    def construct(self):
        sens = VGroup(
            chip("Sensitivity", color=C_TP, w=3.8, h=1.0, fs=26),
            MathTex(r"P(+\mid \text{sick})", font_size=30, color=C_TP),
            fit_label("catches the sick", 3.6, BODY_SIZE, INK_MUTED),
        ).arrange(DOWN, buff=0.28).move_to(LEFT * 3.6 + DOWN * 0.1)
        spec = VGroup(
            chip("Specificity", color=C_HEALTHY, w=3.8, h=1.0, fs=26),
            MathTex(r"P(-\mid \text{healthy})", font_size=30, color=C_HEALTHY),
            fit_label("blocks false alarms", 3.6, BODY_SIZE, INK_MUTED),
        ).arrange(DOWN, buff=0.28).move_to(RIGHT * 3.6 + DOWN * 0.1)

        self.play(FadeIn(sens, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 7.0)
        self.play(FadeIn(spec, shift=LEFT * 0.2), run_time=1.4)
        wait_until(self, 14.0)
        self.play(Indicate(sens[0], color=C_TP, scale_factor=1.1),
                  Indicate(spec[0], color=C_HEALTHY, scale_factor=1.1), run_time=1.4)
        self.guard(sens, spec)
        pace_to(self, self.cue_duration)


# ─── Cue01 : specificity blocks healthy false alarms ─────────────────────────
class Cue01(AvoScene):
    headline = "Specificity: most healthy people test negative"
    cue_duration = 21.121

    def construct(self):
        # A row of 20 healthy people; most correctly negative (accent), 1 false alarm (rose).
        grid = PopGrid(2, 10, r=0.15, gap=0.5, base_color=C_HEALTHY)
        grid.scale(1.0).move_to(UP * 0.4)
        fp_one = 7
        self.play(FadeIn(grid), run_time=1.4)
        wait_until(self, 5.0)
        cap_tn = fit_label("Test − : correctly cleared", 6.0, BODY_SIZE, C_HEALTHY).move_to(DOWN * 1.8)
        self.play(FadeIn(cap_tn), Indicate(grid, color=C_HEALTHY, scale_factor=1.03), run_time=1.4)
        wait_until(self, 12.0)
        ring = Circle(radius=0.32, color=C_FP, stroke_width=3).move_to(grid.dots[fp_one].get_center())
        self.play(grid.dots[fp_one].animate.set_color(C_FP), Create(ring), run_time=1.2)
        cap_fp = fit_label("a few slip through as false alarms", 8.0, BODY_SIZE, C_FP).move_to(DOWN * 2.7)
        self.play(FadeIn(cap_fp), run_time=1.2)
        wait_until(self, 18.0)
        self.play(Flash(grid.dots[fp_one], color=C_FP, flash_radius=0.4), run_time=1.0)
        self.guard(grid, cap_tn, cap_fp, ring)
        pace_to(self, self.cue_duration)


# ─── Cue02 : both dials feed the positive pile ───────────────────────────────
class Cue02(AvoScene):
    headline = "Both feed the positive-result mixture"
    cue_duration = 21.121

    def construct(self):
        tp_src = chip("TP · from the sick", color=C_TP, w=4.2, h=1.05, fs=24).move_to(LEFT * 3.9 + UP * 1.5)
        fp_src = chip("FP · from the healthy", color=C_FP, w=4.4, h=1.05, fs=24).move_to(LEFT * 3.9 + DOWN * 1.5)
        pile = chip("the positive pile", color=C_POST, w=4.0, h=1.2, fs=26).move_to(RIGHT * 4.0)
        a1 = Arrow(tp_src.get_right(), pile.get_left() + UP * 0.3, buff=0.15, color=INK_MUTED, stroke_width=3)
        a2 = Arrow(fp_src.get_right(), pile.get_left() + DOWN * 0.3, buff=0.15, color=INK_MUTED, stroke_width=3)

        self.play(FadeIn(tp_src, shift=RIGHT * 0.2), run_time=1.2)
        wait_until(self, 5.0)
        self.play(FadeIn(fp_src, shift=RIGHT * 0.2), run_time=1.2)
        wait_until(self, 10.0)
        self.play(GrowArrow(a1), GrowArrow(a2), run_time=1.4)
        self.play(FadeIn(pile, shift=LEFT * 0.2), run_time=1.2)
        wait_until(self, 17.0)
        self.play(Indicate(pile, color=C_POST, scale_factor=1.12), run_time=1.4)
        self.guard(tp_src, fp_src, pile, a1, a2)
        pace_to(self, self.cue_duration)


# ─── Cue03 : why the object (the 2×2 matrix) matters ─────────────────────────
class Cue03(AvoScene):
    headline = "Why this object? It sorts every outcome"
    cue_duration = 22.364

    def construct(self):
        q = fit_label("Every test result lands in one of four boxes.",
                      11.0, BODY_SIZE, INK_MUTED).move_to(UP * 2.6)
        cm = confusion_matrix(cell_w=2.6, cell_h=1.35, fs=24)
        cm.move_to(DOWN * 0.4)
        self.play(FadeIn(q), run_time=1.2)
        wait_until(self, 4.0)
        self.play(Create(cm.col_sick), Create(cm.col_healthy),
                  Create(cm.row_pos), Create(cm.row_neg), run_time=1.6)
        wait_until(self, 9.0)
        for cell in (cm.tp, cm.fp, cm.fn, cm.tn):
            self.play(FadeIn(cell, scale=0.9), run_time=0.7)
        wait_until(self, 18.0)
        self.play(Indicate(cm.body, color=INK, scale_factor=1.04), run_time=1.4)
        self.guard(cm, q)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the detective board analogy ─────────────────────────────────────
class Cue04(AvoScene):
    headline = "Think of a detective's board"
    cue_duration = 21.121

    def construct(self):
        board = RoundedRectangle(width=8.4, height=4.4, corner_radius=0.2,
                                 stroke_color=INK_SUBTLE, stroke_width=2.6,
                                 fill_color=theme.STAGE, fill_opacity=0.6).move_to(DOWN * 0.2)
        title = fit_label("EVIDENCE  BOARD", 4.0, LABEL_SIZE, INK_MUTED).move_to(board.get_top() + DOWN * 0.45)
        # pinned notes connected by strings
        notes = VGroup(
            chip("positive test", color=C_SICK, w=2.6, h=0.9, fs=22),
            chip("who is sick?", color=C_TP, w=2.6, h=0.9, fs=22),
            chip("who is a false alarm?", color=C_FP, w=3.2, h=0.9, fs=20),
        )
        notes[0].move_to(board.get_center() + UP * 0.9)
        notes[1].move_to(board.get_center() + LEFT * 2.4 + DOWN * 0.9)
        notes[2].move_to(board.get_center() + RIGHT * 2.4 + DOWN * 0.9)
        s1 = Line(notes[0].get_bottom(), notes[1].get_top(), color=ROSE, stroke_width=2)
        s2 = Line(notes[0].get_bottom(), notes[2].get_top(), color=ROSE, stroke_width=2)

        self.play(Create(board), FadeIn(title), run_time=1.4)
        wait_until(self, 5.0)
        self.play(FadeIn(notes[0], scale=0.9), run_time=1.0)
        wait_until(self, 10.0)
        self.play(Create(s1), Create(s2), FadeIn(notes[1]), FadeIn(notes[2]), run_time=1.6)
        wait_until(self, 17.0)
        self.play(Indicate(notes[0], color=C_SICK, scale_factor=1.12), run_time=1.4)
        self.guard(board, title, notes, s1, s2)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the analogy gives the reasoning a familiar shape ─────────────────
class Cue05(AvoScene):
    headline = "The board gives the reasoning a familiar shape"
    cue_duration = 21.121

    def construct(self):
        board = chip("detective's board", color=INK_SUBTLE, w=4.4, h=1.15, fs=26).move_to(LEFT * 3.9)
        arrow = Arrow(LEFT * 1.4, RIGHT * 1.4, buff=0.1, color=INK_MUTED, stroke_width=4)
        cm = confusion_matrix(cell_w=1.7, cell_h=0.9, fs=20)
        cm.scale(0.85).move_to(RIGHT * 3.5)
        self.play(FadeIn(board), run_time=1.2)
        wait_until(self, 6.0)
        self.play(GrowArrow(arrow), run_time=1.2)
        wait_until(self, 11.0)
        self.play(FadeIn(cm, shift=LEFT * 0.2), run_time=1.6)
        wait_until(self, 17.0)
        self.play(board.animate.set_opacity(0.4),
                  Indicate(cm.body, color=INK, scale_factor=1.06), run_time=1.4)
        self.guard(board, arrow, cm)
        pace_to(self, self.cue_duration)


# ─── Cue06 : the concrete numbers fill the matrix ────────────────────────────
class Cue06(AvoScene):
    headline = "1 in 100 sick · test usually right"
    cue_duration = 21.121

    def construct(self):
        cm = confusion_matrix(cell_w=2.6, cell_h=1.35, fs=24, counts=COUNTS)
        cm.move_to(LEFT * 1.1 + DOWN * 0.1)
        # Blank cells first (no counts), then reveal counts — build a version w/o counts to swap.
        stats = VGroup(
            stat_row("prior  P(sick)", "1%"),
            stat_row("sensitivity", "99%", val_color=C_TP),
            stat_row("specificity", "95%", val_color=C_HEALTHY),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.32).to_edge(RIGHT, buff=0.5).shift(DOWN * 0.1)

        self.play(FadeIn(cm.body), Create(cm.col_sick), Create(cm.col_healthy),
                  Create(cm.row_pos), Create(cm.row_neg), run_time=1.6)
        wait_until(self, 6.0)
        for row in stats:
            self.play(FadeIn(row, shift=LEFT * 0.2), run_time=0.8)
        wait_until(self, 14.0)
        self.play(Indicate(cm.tp, color=C_TP), Indicate(cm.fp, color=C_FP),
                  Indicate(cm.tn, color=C_HEALTHY), run_time=1.4)
        self.guard(cm, stats)
        pace_to(self, self.cue_duration)


# ─── Cue07 : sensitivity catches the sick (TP row) ───────────────────────────
class Cue07(AvoScene):
    headline = "Sensitivity catches the sick"
    cue_duration = 21.121

    def construct(self):
        cm = confusion_matrix(cell_w=2.4, cell_h=1.25, fs=24, counts=COUNTS)
        cm.move_to(UP * 0.7)
        formula = sensitivity_formula(size=32).move_to(DOWN * 2.4)
        self.add(cm)
        self.play(Write(formula), run_time=1.8)
        wait_until(self, 6.0)
        box = SurroundingRectangle(VGroup(cm.tp, cm.fn), color=C_TP, buff=0.12, corner_radius=0.08)
        self.play(Create(box), Indicate(cm.tp, color=C_TP, scale_factor=1.15), run_time=1.6)
        wait_until(self, 13.0)
        cap = fit_label("99% of the 1 sick person → true positive", 10.0, BODY_SIZE, C_TP).move_to(DOWN * 3.3)
        self.play(FadeIn(cap), run_time=1.2)
        wait_until(self, 18.0)
        self.play(Flash(cm.tp, color=C_TP, flash_radius=0.6), run_time=1.0)
        self.guard(cm, formula, box, cap)
        pace_to(self, self.cue_duration)


# ─── Cue08 : specificity blocks the healthy (TN cell) ────────────────────────
class Cue08(AvoScene):
    headline = "Specificity blocks the healthy false alarms"
    cue_duration = 21.121

    def construct(self):
        cm = confusion_matrix(cell_w=2.4, cell_h=1.25, fs=24, counts=COUNTS)
        cm.move_to(UP * 0.7)
        formula = specificity_formula(size=32).move_to(DOWN * 2.4)
        self.add(cm)
        self.play(Write(formula), run_time=1.8)
        wait_until(self, 6.0)
        box = SurroundingRectangle(VGroup(cm.tn, cm.fp), color=C_HEALTHY, buff=0.12, corner_radius=0.08)
        self.play(Create(box), Indicate(cm.tn, color=C_HEALTHY, scale_factor=1.15), run_time=1.6)
        wait_until(self, 13.0)
        cap = fit_label("95% of the 99 healthy → correctly negative (94)", 11.0, BODY_SIZE, C_HEALTHY).move_to(DOWN * 3.3)
        self.play(FadeIn(cap), run_time=1.2)
        wait_until(self, 18.0)
        self.play(Indicate(cm.fp, color=C_FP, scale_factor=1.15), run_time=1.2)
        self.guard(cm, formula, box, cap)
        pace_to(self, self.cue_duration)


# ─── Cue09 : how likely is '+' if the hypothesis is false ────────────────────
class Cue09(AvoScene):
    headline = "How likely is '+' when the hypothesis is false?"
    cue_duration = 21.121

    def construct(self):
        cm = confusion_matrix(cell_w=2.2, cell_h=1.2, fs=22, counts=COUNTS)
        cm.move_to(LEFT * 3.1 + DOWN * 0.1)
        eq = MathTex(r"P(+\mid \text{healthy})", r"=1-\text{spec}", r"=5\%",
                     font_size=32, color=C_FP).arrange(RIGHT, buff=0.2)
        eq.move_to(RIGHT * 3.2 + UP * 1.1)
        note = fit_label("the false-alarm rate — small, but on many people",
                         6.4, BODY_SIZE, INK_MUTED)
        note.next_to(eq, DOWN, buff=0.5)
        self.add(cm)
        self.play(Indicate(cm.fp, color=C_FP, scale_factor=1.2), run_time=1.4)
        wait_until(self, 6.0)
        self.play(Write(eq), run_time=1.8)
        wait_until(self, 13.0)
        box = SurroundingRectangle(cm.fp, color=C_FP, buff=0.1, corner_radius=0.08)
        note.move_to(DOWN * 2.7)
        self.play(Create(box), FadeIn(note, shift=UP * 0.1), run_time=1.4)
        wait_until(self, 18.0)
        self.play(Flash(cm.fp, color=C_FP, flash_radius=0.5), run_time=1.0)
        self.guard(cm, eq, note, box)
        pace_to(self, self.cue_duration)


# ─── Cue10 : the check — TP and FP together are the positive pile ────────────
class Cue10(AvoScene):
    headline = "The check: TP and FP read the positive row"
    cue_duration = 22.364

    def construct(self):
        cm = confusion_matrix(cell_w=2.5, cell_h=1.3, fs=24, counts=COUNTS)
        cm.move_to(DOWN * 0.35)
        pos_lab = fit_label("the positive row = the positive pile", 8.0, BODY_SIZE, C_POST)
        pos_lab.next_to(cm, UP, buff=0.28)
        self.add(cm)
        wait_until(self, 3.0)
        box = SurroundingRectangle(VGroup(cm.tp, cm.fp), color=C_POST, buff=0.14, corner_radius=0.08)
        self.play(Create(box), FadeIn(pos_lab), run_time=1.6)
        wait_until(self, 9.0)
        self.play(Indicate(cm.tp, color=C_TP), Indicate(cm.fp, color=C_FP), run_time=1.4)
        wait_until(self, 14.0)
        calc = MathTex(r"\text{positives}=\text{TP}+\text{FP}=1+5=6",
                       font_size=36, color=INK).move_to(DOWN * 2.9)
        self.play(Write(calc), run_time=1.8)
        wait_until(self, 20.0)
        self.play(Indicate(calc, color=C_POST, scale_factor=1.08), run_time=1.2)
        self.guard(cm, box, pos_lab, calc)
        pace_to(self, self.cue_duration)


# ─── Cue11 : the common mistake — reading sensitivity as the answer ──────────
class Cue11(AvoScene):
    headline = "The common mistake: sensitivity is not the answer"
    cue_duration = 21.121

    def construct(self):
        wrong = VGroup(
            fit_label("reads as", 3.0, BODY_SIZE, INK_MUTED),
            MathTex(r"P(+\mid \text{sick})=99\%", font_size=34, color=C_TP),
        ).arrange(DOWN, buff=0.3).move_to(LEFT * 3.6 + UP * 0.3)
        right = VGroup(
            fit_label("but the question is", 3.6, BODY_SIZE, INK_MUTED),
            MathTex(r"P(\text{sick}\mid +)=?", font_size=34, color=C_POST),
        ).arrange(DOWN, buff=0.3).move_to(RIGHT * 3.6 + UP * 0.3)
        neq = MathTex(r"\neq", font_size=52, color=ROSE).move_to(UP * 0.1)

        self.play(FadeIn(wrong, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 6.0)
        self.play(FadeIn(right, shift=LEFT * 0.2), run_time=1.4)
        wait_until(self, 11.0)
        self.play(Write(neq), run_time=1.2)
        wait_until(self, 15.0)
        cap = fit_label("flipping the condition ignores the base rate", 10.0, BODY_SIZE, ROSE).move_to(DOWN * 2.6)
        self.play(FadeIn(cap), Indicate(neq, color=ROSE, scale_factor=1.2), run_time=1.4)
        self.guard(wrong, right, neq, cap)
        pace_to(self, self.cue_duration)


# ─── Cue12 : before — sensitivity alone, an incomplete belief ────────────────
class Cue12(AvoScene):
    headline = "Before: sensitivity alone is a limited form"
    cue_duration = 21.121

    def construct(self):
        before = VGroup(
            fit_label("BEFORE", 3.0, LABEL_SIZE, INK_MUTED),
            chip('"the test is 99% accurate"', color=C_TP, w=5.4, h=1.05, fs=24),
            fit_label("a number with no base rate attached", 5.6, BODY_SIZE, INK_MUTED),
        ).arrange(DOWN, buff=0.34).move_to(DOWN * 0.2)
        self.play(FadeIn(before[0]), run_time=1.0)
        wait_until(self, 5.0)
        self.play(FadeIn(before[1], shift=UP * 0.1), run_time=1.4)
        wait_until(self, 12.0)
        self.play(FadeIn(before[2], shift=UP * 0.1), run_time=1.2)
        wait_until(self, 17.0)
        self.play(Indicate(before[1], color=C_TP, scale_factor=1.08), run_time=1.4)
        self.guard(before)
        pace_to(self, self.cue_duration)


# ─── Cue13 : after — the positive pile carries usable information ────────────
class Cue13(AvoScene):
    headline = "After: the positive pile becomes a usable answer"
    cue_duration = 21.121

    def construct(self):
        formula = posterior_ratio(size=42).move_to(UP * 1.7)
        calc = MathTex(r"=\frac{1}{1+5}=\tfrac{1}{6}\approx 17\%",
                       font_size=42, color=C_POST).move_to(ORIGIN + DOWN * 0.1)
        cap = fit_label("a form the next decision can actually use",
                        10.5, BODY_SIZE, INK_MUTED).move_to(DOWN * 2.4)
        self.play(Write(formula), run_time=1.8)
        wait_until(self, 7.0)
        self.play(Write(calc), run_time=1.8)
        wait_until(self, 13.0)
        self.play(Indicate(calc, color=C_POST, scale_factor=1.12), run_time=1.4)
        wait_until(self, 18.0)
        self.play(FadeIn(cap), run_time=1.2)
        self.guard(formula, calc, cap)
        pace_to(self, self.cue_duration)
