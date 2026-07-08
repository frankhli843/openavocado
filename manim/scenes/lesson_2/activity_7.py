"""
Lesson 2 — Orientation (activity 7): "Bayes' Theorem in Practice — the route"
(1014.67s / 16.9min long-form overview audio).

7 Cue<NN> scenes, one per orientation_visual cue (segment_7.json), each ~145s
long, walking the standard "spiral lesson map" route (Leo/Maya dialogue) for the
Bayes lesson. The visuals reuse the shared Bayes idiom library (manim/bayes.py)
so the orientation speaks the same visual vocabulary the three lesson_part
segments (acts 10/11/52) already established — prior tree, population grid,
prior→likelihood→posterior spine, confusion matrix, the positive pile:

  Cue00 0-145      Locate the lesson — the big map (Subject → Lesson → Next),
                   the four study angles, and the one-line purpose.
  Cue01 145-290    Workshop metaphor — the bench receive/transform/pass and the
                   detective board → the Prior · ×Likelihood · Posterior spine.
  Cue02 290-435    Follow one concrete object — the 1-in-100 rare-condition
                   example: a positive test matters but does not erase the base
                   rate.
  Cue03 435-579    Expose what changes and why — the six-step mechanism ledger
                   (prior → likelihoods → reweight → normalize → posterior).
  Cue04 579-725    Connect to code and tests — read Bayes' theorem aloud, then
                   check TP/FP are counted out of the right populations.
  Cue05 725-869    Separate nearby ideas — the base-rate trap: test accuracy is
                   not P(sick | +); the positive pile is 1 true + 5 false → 17%.
  Cue06 869-1014.67 Return to the route — recap the four stops and the one
                   takeaway, then hand off a practice-ready mental model.

Each ~145s cue stages its reveals across the window via wait_until(scene, t) so
the frame keeps changing with the narration; pace_to fills the small remainder
to hit the exact cue duration. Whatever the narration is discussing is the lit
element (amber focus box / Indicate / dimming others).
"""

import theme
from theme import (
    AvoScene,
    ACCENT,
    ACCENT_LIGHT,
    AMBER,
    EMERALD,
    VIOLET,
    ROSE,
    INK,
    INK_MUTED,
    INK_SUBTLE,
    LABEL_SIZE,
    BODY_SIZE,
    FORMULA_SIZE,
    FORMULA_SIZE_SMALL,
)
from pacing import pace_to, elapsed
import bayes
from bayes import (
    chip,
    fit_label,
    stat_row,
    PopGrid,
    prior_tree,
    bayes_spine,
    bayes_formula,
    confusion_matrix,
    positive_pile,
    C_SICK,
    C_HEALTHY,
    C_TP,
    C_FP,
    C_POST,
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
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
)


# ─── local helpers ───────────────────────────────────────────────────────────
def wait_until(scene, t: float) -> None:
    """Wait until scene time reaches `t` seconds (no-op if already past)."""
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def num_chip(n, color=ACCENT, r=0.26, fs=22):
    c = Circle(radius=r, stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=0.16)
    t = Text(str(n), font_size=fs, color=INK).move_to(c.get_center())
    return VGroup(c, t)


# ─── Cue00 : the big map — locate the lesson ─────────────────────────────────
class Cue00(AvoScene):
    headline = "Locate the lesson before details"
    cue_duration = 145.436

    def construct(self):
        # The big map: Subject → Lesson → Next (a horizontal pipeline).
        subj = chip("Applied Probability\n& Statistics", ACCENT, w=3.7, h=1.4, fs=22).shift(LEFT * 4.7 + UP * 1.7)
        subj_l = Text("Subject", font_size=BODY_SIZE, color=INK_MUTED).next_to(subj, UP, buff=0.18)
        lesson = chip("Bayes' Theorem\nin Practice", AMBER, w=3.7, h=1.4, fs=22).shift(UP * 1.7)
        lesson_l = Text("Lesson", font_size=BODY_SIZE, color=INK_MUTED).next_to(lesson, UP, buff=0.18)
        nxt = chip("practice-ready\nobject", EMERALD, w=3.7, h=1.4, fs=22).shift(RIGHT * 4.7 + UP * 1.7)
        nxt_l = Text("Next", font_size=BODY_SIZE, color=INK_MUTED).next_to(nxt, UP, buff=0.18)
        a1 = Arrow(subj.get_right(), lesson.get_left(), buff=0.15, color=INK_MUTED, stroke_width=4)
        a2 = Arrow(lesson.get_right(), nxt.get_left(), buff=0.15, color=INK_MUTED, stroke_width=4)

        # Four study angles (read / watch / explore / code).
        angles = ["base-rate simulator", "frequency table", "population tree", "scaffolded exercise"]
        acols = [ACCENT, AMBER, EMERALD, VIOLET]
        angle_chips = VGroup()
        for i, (name, col) in enumerate(zip(angles, acols)):
            ch = chip(name, col, w=3.0, h=0.95, fs=20).move_to([-5.05 + i * 3.35, -0.55, 0])
            angle_chips.add(ch)
        angles_l = Text("four angles on the same idea", font_size=BODY_SIZE, color=INK_MUTED).next_to(angle_chips, UP, buff=0.35)

        # The one-line purpose.
        purpose = fit_label(
            "Bayes' theorem: a disciplined way to change your mind — base rate × how expected the evidence is",
            13.0, LABEL_SIZE, INK,
        ).to_edge(DOWN, buff=0.7)

        # beat 0-14 : subject in context
        self.play(FadeIn(subj), FadeIn(subj_l), run_time=2.0)
        wait_until(self, 14)
        # beat 14-30 : the lesson node lit
        self.play(GrowArrow(a1), FadeIn(lesson), FadeIn(lesson_l), run_time=2.0)
        self.play(Indicate(lesson, color=AMBER, scale_factor=1.06), run_time=1.4)
        wait_until(self, 34)
        # beat 34-48 : where it leads
        self.play(GrowArrow(a2), FadeIn(nxt), FadeIn(nxt_l), run_time=2.0)
        wait_until(self, 56)
        # beat 56-96 : the four study angles, one at a time
        self.play(FadeIn(angles_l), run_time=1.2)
        for i, ch in enumerate(angle_chips):
            wait_until(self, 62 + i * 8)
            self.play(FadeIn(ch, shift=UP * 0.12), run_time=1.0)
            self.play(Indicate(ch, color=acols[i], scale_factor=1.05), run_time=0.7)
        wait_until(self, 104)
        # beat 104+ : the purpose line
        self.play(FadeIn(purpose), run_time=1.6)
        self.play(Indicate(purpose, color=ACCENT, scale_factor=1.03), run_time=1.4)
        self.guard(subj, lesson, nxt, angle_chips, angles_l, purpose)
        pace_to(self, self.cue_duration)


# ─── Cue01 : workshop metaphor — the bench + the detective board ─────────────
class Cue01(AvoScene):
    headline = "Translate the idea into a workshop metaphor"
    cue_duration = 144.309

    def construct(self):
        # The object we follow all lesson.
        obj = chip("a prior belief that gets\nupdated by evidence", VIOLET, w=5.4, h=1.3, fs=22).shift(UP * 1.55)
        obj_l = Text("the object", font_size=BODY_SIZE, color=INK_MUTED).next_to(obj, UP, buff=0.16)

        # Workshop bench: Receive → Transform → Pass.
        recv = chip("Receive\nlabeled object", ACCENT, w=3.3, h=1.25, fs=20).shift(LEFT * 4.7 + UP * 0.2)
        tform = chip("Transform\nchosen tool", AMBER, w=3.3, h=1.25, fs=20).shift(UP * 0.2)
        pas = chip("Pass\ntagged output", EMERALD, w=3.3, h=1.25, fs=20).shift(RIGHT * 4.7 + UP * 0.2)
        b1 = Arrow(recv.get_right(), tform.get_left(), buff=0.12, color=INK_MUTED, stroke_width=4)
        b2 = Arrow(tform.get_right(), pas.get_left(), buff=0.12, color=INK_MUTED, stroke_width=4)

        # The detective board mapping (prior/likelihood/posterior).
        board = fit_label(
            "detective board:  prior = plausibility before the clue   ·   "
            "likelihood = how well the clue fits   ·   posterior = the board after it is pinned",
            13.2, BODY_SIZE, INK_MUTED,
        ).to_edge(DOWN, buff=1.85)

        # The formal spine it maps onto (reused idiom), shifted to the bottom.
        spine = bayes_spine(fs=22, y=0.0)
        spine.scale(0.82).to_edge(DOWN, buff=0.55)

        # beat 0-16 : the object
        self.play(FadeIn(obj), FadeIn(obj_l), run_time=2.0)
        self.play(Indicate(obj, color=VIOLET, scale_factor=1.05), run_time=1.4)
        wait_until(self, 20)
        # beat 20-52 : the bench flow, one station at a time
        self.play(FadeIn(recv), run_time=1.4)
        wait_until(self, 30)
        self.play(GrowArrow(b1), FadeIn(tform), run_time=1.6)
        wait_until(self, 42)
        self.play(GrowArrow(b2), FadeIn(pas), run_time=1.6)
        wait_until(self, 58)
        # beat 58-92 : the detective board reading
        self.play(FadeIn(board), run_time=1.8)
        self.play(Indicate(board, color=AMBER, scale_factor=1.02), run_time=1.4)
        wait_until(self, 100)
        # beat 100+ : map the metaphor onto the formal spine
        self.play(FadeOut(board), run_time=0.8)
        self.play(FadeIn(spine), run_time=1.8)
        self.play(Indicate(spine.prior, color=C_HEALTHY, scale_factor=1.08), run_time=1.1)
        self.play(Indicate(spine.like, color=C_SICK, scale_factor=1.08), run_time=1.1)
        self.play(Indicate(spine.post, color=C_POST, scale_factor=1.08), run_time=1.1)
        self.guard(obj, recv, tform, pas, spine)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the tiny concrete object — 1 in 100 ─────────────────────────────
class Cue02(AvoScene):
    headline = "Follow one concrete object"
    cue_duration = 145.436

    def construct(self):
        # A 100-person population grid, one sick.
        grid = PopGrid(n_rows=10, n_cols=10, r=0.11, gap=0.30).shift(LEFT * 3.7 + DOWN * 0.15)
        grid_l = Text("100 people", font_size=BODY_SIZE, color=INK_MUTED).next_to(grid, UP, buff=0.28)

        # The prior tree (1 sick / 99 healthy), reused idiom, on the right.
        tree = prior_tree(total_label="100 people", sick_label="1 Sick", healthy_label="99 Healthy",
                          sick_frac=0.10)
        tree.scale(0.66).shift(RIGHT * 2.9 + DOWN * 0.1)

        base = stat_row("base rate:", "1 in 100  =  1%", val_color=C_SICK).to_edge(DOWN, buff=2.15)
        acc = stat_row("test:", "usually right", val_color=EMERALD).next_to(base, DOWN, buff=0.3)
        note = fit_label(
            "a positive test matters a lot — but it does not erase the base rate",
            11.0, LABEL_SIZE, INK,
        ).to_edge(DOWN, buff=0.55)

        # beat 0-20 : the population
        self.play(FadeIn(grid_l), Create(grid), run_time=2.4)
        wait_until(self, 22)
        # beat 22-40 : mark the one sick person
        grid.color_indices([0], C_SICK)
        self.play(grid.dots[0].animate.scale(1.9), run_time=1.2)
        self.play(Indicate(grid.dots[0], color=C_SICK, scale_factor=1.4), run_time=1.2)
        wait_until(self, 44)
        # beat 44-72 : the prior tree split
        self.play(FadeIn(tree), run_time=2.0)
        self.play(Indicate(tree.sick, color=C_SICK, scale_factor=1.1), run_time=1.2)
        wait_until(self, 84)
        # beat 84-104 : the stats
        self.play(FadeIn(base), run_time=1.4)
        self.play(FadeIn(acc), run_time=1.4)
        wait_until(self, 112)
        # beat 112+ : the takeaway
        self.play(FadeIn(note), run_time=1.6)
        self.play(Indicate(note, color=AMBER, scale_factor=1.03), run_time=1.4)
        self.guard(grid, grid_l, tree, base, acc, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the mechanism — six steps ───────────────────────────────────────
class Cue03(AvoScene):
    headline = "Expose what changes and why"
    cue_duration = 144.308

    # (cue-relative beat time, step text)
    STEPS = [
        (0,   "Start with a prior for the hypothesis"),
        (18,  "How likely is the evidence if it is true?"),
        (36,  "How likely is the evidence if it is false?"),
        (56,  "Reweight the prior by those likelihoods"),
        (74,  "Normalize so possibilities sum to one"),
        (92,  "Treat the posterior as the new belief"),
    ]

    def construct(self):
        # Steps occupy the left ~60% of the stage; the right column holds the
        # Before/During/After stage panel so the two never collide.
        rows = VGroup()
        for i, (_, text) in enumerate(self.STEPS):
            y = 2.1 - i * 0.72
            nc = num_chip(i + 1, ACCENT).move_to([-6.0, y, 0])
            tx = fit_label(text, 5.6, BODY_SIZE, INK).next_to(nc, RIGHT, buff=0.3)
            row = VGroup(nc, tx).set_opacity(0.3)
            rows.add(row)

        # Right-side stage panel: Before → During → After. All cells stay fully
        # legible; an amber focus box marks the active stage (opacity tricks
        # would solidify the tinted fill and swallow the label).
        stage_defs = [("Before", "incoming belief", ACCENT),
                      ("During", "reweight + normalize", AMBER),
                      ("After", "handoff posterior", C_POST)]
        stages = VGroup()
        for i, (name, sub, col) in enumerate(stage_defs):
            box = RoundedRectangle(width=3.4, height=1.0, corner_radius=0.12,
                                   stroke_color=col, stroke_width=2.4,
                                   fill_color=col, fill_opacity=0.1)
            nm = Text(name, font_size=24, color=col, weight="BOLD")
            sb = fit_label(sub, 3.0, 18, INK_MUTED)
            VGroup(nm, sb).arrange(DOWN, buff=0.08).move_to(box.get_center())
            cell = VGroup(box, nm, sb).move_to([4.35, 1.15 - i * 1.25, 0])
            stages.add(cell)

        caption = fit_label(
            "the visual: a population split by base rate → evidence selects some from each group "
            "→ the posterior is that selected group's composition",
            13.2, BODY_SIZE, INK_MUTED,
        ).to_edge(DOWN, buff=0.55)

        self.play(FadeIn(rows), FadeIn(stages), run_time=2.6)
        stage_box = SurroundingRectangle(stages[0], color=AMBER, buff=0.08, corner_radius=0.12)
        self.play(Create(stage_box), run_time=1.0)

        prev_rect = None
        cur_stage = 0
        for i, (t, _text) in enumerate(self.STEPS):
            wait_until(self, t if i > 0 else 4.0)
            self.play(rows[i].animate.set_opacity(1.0), run_time=0.9)
            rect = SurroundingRectangle(rows[i], color=AMBER, buff=0.1, corner_radius=0.08)
            fade_prev = [FadeOut(prev_rect)] if prev_rect is not None else []
            # advance the stage focus box: steps 0-2 = Before, 3-4 = During, 5 = After
            target_stage = 0 if i < 3 else (1 if i < 5 else 2)
            stage_anim = []
            if target_stage != cur_stage:
                stage_anim = [stage_box.animate.move_to(stages[target_stage].get_center())]
                cur_stage = target_stage
            self.play(*fade_prev, Create(rect), *stage_anim, run_time=0.9)
            prev_rect = rect

        # 110+ : reveal the population-composition caption
        wait_until(self, 112)
        clear = [FadeOut(prev_rect)] if prev_rect is not None else []
        self.play(*clear, *[r.animate.set_opacity(1.0) for r in rows], run_time=1.2)
        self.play(FadeIn(caption), run_time=1.8)
        self.play(Indicate(caption, color=ACCENT, scale_factor=1.03), run_time=1.3)
        self.guard(rows, stages, caption)
        pace_to(self, self.cue_duration)


# ─── Cue04 : connect to code and tests — the formula + the check ─────────────
class Cue04(AvoScene):
    headline = "Connect to code and tests"
    cue_duration = 145.436

    def construct(self):
        formula = bayes_formula(size=FORMULA_SIZE).shift(UP * 2.1)
        read_as = fit_label(
            "read it: posterior = prior × likelihood ÷ total probability of the evidence",
            12.5, BODY_SIZE, INK_MUTED,
        ).next_to(formula, DOWN, buff=0.45)

        # Map each term to its plain meaning.
        maps = [
            (r"P(H)", "prior belief", C_HEALTHY),
            (r"P(E\mid H)", "likelihood of the evidence", C_SICK),
            (r"P(E)", "total prob. of the evidence", INK_MUTED),
        ]
        map_rows = VGroup()
        for i, (sym, txt, col) in enumerate(maps):
            m = MathTex(sym, font_size=32, color=col)
            arrow = Text("→", font_size=26, color=INK_SUBTLE)
            lab = Text(txt, font_size=22, color=INK)
            r = VGroup(m, arrow, lab).arrange(RIGHT, buff=0.25).move_to([0, 0.55 - i * 0.7, 0])
            map_rows.add(r)

        # The code/table check.
        check = confusion_matrix(cell_w=1.9, cell_h=1.0, fs=20,
                                 counts={"tp": "1", "fp": "5", "fn": "0", "tn": "94"})
        check.scale(0.82).to_edge(DOWN, buff=0.5).shift(RIGHT * 0.9)
        assert_l = fit_label(
            "the useful check:\nTP and FP counted out of\nthe RIGHT populations",
            3.8, 21, EMERALD,
        ).next_to(check, LEFT, buff=0.5).set_x(-4.5)

        # beat 0-24 : the formula
        self.play(Write(formula), run_time=2.6)
        self.play(FadeIn(read_as), run_time=1.6)
        wait_until(self, 26)
        # beat 26-64 : map each symbol to meaning
        for i, r in enumerate(map_rows):
            wait_until(self, 28 + i * 11)
            self.play(FadeIn(r, shift=RIGHT * 0.15), run_time=1.3)
            self.play(Indicate(r[0], color=maps[i][2], scale_factor=1.15), run_time=0.9)
        wait_until(self, 74)
        # beat 74-110 : the code/table check — the confusion matrix
        self.play(FadeOut(map_rows), FadeOut(read_as), run_time=0.9)
        self.play(FadeIn(check), run_time=2.0)
        self.play(FadeIn(assert_l), run_time=1.4)
        wait_until(self, 116)
        # beat 116+ : box the positive row (TP + FP = everyone who tested +)
        pos_box = SurroundingRectangle(VGroup(check.tp, check.fp), color=C_POST, buff=0.12, corner_radius=0.1)
        pos_l = Text("positive results = TP + FP", font_size=BODY_SIZE, color=C_POST).next_to(check, UP, buff=0.3)
        self.play(Create(pos_box), FadeIn(pos_l), run_time=1.6)
        self.play(Indicate(pos_box, color=C_POST, scale_factor=1.04), run_time=1.3)
        self.guard(formula, check, assert_l, pos_box, pos_l)
        pace_to(self, self.cue_duration)


# ─── Cue05 : separate nearby ideas — the base-rate trap ──────────────────────
class Cue05(AvoScene):
    headline = "Separate nearby ideas"
    cue_duration = 144.309

    def construct(self):
        # The tempting wrong read.
        wrong = fit_label('"the test is ~right, so a positive means ~sick"', 5.6, 22, ROSE)
        wrong.move_to([-3.5, 2.1, 0])
        wrong_sym = MathTex(r"P(+\mid \text{sick})", font_size=32, color=ROSE).next_to(wrong, DOWN, buff=0.32)
        cross = Line(wrong_sym.get_corner(LEFT + DOWN), wrong_sym.get_corner(RIGHT + UP), color=ROSE, stroke_width=5)

        # The correct relation.
        right = fit_label("what you actually want", 5.6, 22, EMERALD)
        right.move_to([3.5, 2.1, 0])
        right_sym = MathTex(r"P(\text{sick}\mid +)", font_size=34, color=EMERALD).next_to(right, DOWN, buff=0.35)

        neq = MathTex(r"\neq", font_size=44, color=AMBER).move_to([0, 1.4, 0])

        # The positive pile that settles it (reused idiom).
        pile = positive_pile(tp=1, fp=5, label="everyone who tested positive")
        pile.scale(0.9).shift(DOWN * 1.0)
        posterior = MathTex(
            r"P(\text{sick}\mid +)=\frac{1}{1+5}=\tfrac{1}{6}\approx 17\%",
            font_size=FORMULA_SIZE_SMALL, color=C_POST,
        ).to_edge(DOWN, buff=0.55)

        # beat 0-24 : the confusing label
        self.play(FadeIn(wrong), run_time=1.6)
        self.play(Write(wrong_sym), run_time=1.4)
        wait_until(self, 20)
        self.play(Create(cross), run_time=1.0)
        self.play(Indicate(wrong_sym, color=ROSE, scale_factor=1.08), run_time=1.1)
        wait_until(self, 40)
        # beat 40-58 : the correct relation, and they are NOT equal
        self.play(FadeIn(right), run_time=1.4)
        self.play(Write(right_sym), run_time=1.4)
        self.play(Write(neq), run_time=1.0)
        self.play(Indicate(neq, color=AMBER, scale_factor=1.2), run_time=1.1)
        wait_until(self, 74)
        # beat 74-104 : the positive pile shows why
        self.play(FadeIn(pile), run_time=2.0)
        self.play(Indicate(pile.fp_dots, color=C_FP, scale_factor=1.2), run_time=1.3)
        self.play(Indicate(pile.tp_dots, color=C_TP, scale_factor=1.3), run_time=1.3)
        wait_until(self, 118)
        # beat 118+ : the number — despite a good test, only ~17%
        self.play(Write(posterior), run_time=2.0)
        self.play(Indicate(posterior, color=C_POST, scale_factor=1.04), run_time=1.4)
        self.guard(wrong, wrong_sym, right, right_sym, neq, pile, posterior)
        pace_to(self, self.cue_duration)


# ─── Cue06 : return to the route — synthesis ─────────────────────────────────
class Cue06(AvoScene):
    headline = "Return to the route and prepare practice"
    cue_duration = 145.436

    def construct(self):
        # Recap the four stops as a route path.
        stops = [
            ("Object", "prior belief updated by evidence", VIOLET),
            ("Mechanism", "reweight the prior by likelihood", ACCENT),
            ("Formula", "P(H|E) = P(E|H)P(H) / P(E)", AMBER),
            ("Mistake", "test accuracy ≠ base rate", ROSE),
        ]
        stop_group = VGroup()
        y = 1.9
        for i, (name, txt, col) in enumerate(stops):
            nc = num_chip(i + 1, col).move_to([-5.9, y - i * 0.85, 0])
            nm = Text(name, font_size=LABEL_SIZE, color=col, weight="BOLD").next_to(nc, RIGHT, buff=0.3)
            tx = fit_label(txt, 7.3, BODY_SIZE, INK_MUTED).next_to(nm, RIGHT, buff=0.4)
            stop_group.add(VGroup(nc, nm, tx))

        takeaway = fit_label(
            "evidence updates belief by comparing explanations — not by floating alone",
            12.8, LABEL_SIZE, INK,
        ).to_edge(DOWN, buff=2.05)

        # Practice-ready badge.
        badge = chip("practice-ready mental model", EMERALD, w=6.0, h=1.0, fs=24).to_edge(DOWN, buff=0.5)

        # beat 0-56 : recap the four stops, lighting each
        for i, r in enumerate(stop_group):
            wait_until(self, 4 + i * 12)
            self.play(FadeIn(r, shift=RIGHT * 0.15), run_time=1.4)
            self.play(Indicate(r[1], color=stops[i][2], scale_factor=1.06), run_time=0.9)
        wait_until(self, 78)
        # beat 78-108 : the one takeaway line
        self.play(FadeIn(takeaway), run_time=1.8)
        self.play(Indicate(takeaway, color=ACCENT, scale_factor=1.03), run_time=1.4)
        wait_until(self, 120)
        # beat 120+ : hand off a practice-ready model
        self.play(FadeIn(badge, shift=UP * 0.12), run_time=1.6)
        self.play(Indicate(badge, color=EMERALD, scale_factor=1.04), run_time=1.4)
        self.guard(stop_group, takeaway, badge)
        pace_to(self, self.cue_duration)
