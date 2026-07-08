"""
Lesson 3 — Part 1 (activity 17): "Equilibrium is the crossing point" (274.75s).

14 Cue<NN> scenes, one per audio.synced_visual cue (segment_17.json, cues
rescaled to the real 274.75s MP3). The visual spine is the classic price–quantity
diagram from econ.py: a downward demand line (blue = buyers), an upward supply
line (amber = sellers), and their crossing = equilibrium (P*, Q*, green). Each
cue lights exactly the element the narration names — the crossing dot, an
off-equilibrium price line, a shortage gap, a surplus gap, or the law-of-demand
slope. Every chunk is a standalone clip (no cross-cue object state), so each
rebuilds the base diagram then animates its one concept.
"""

import econ
from econ import (
    market_axes,
    demand_curve,
    supply_curve,
    curve_label,
    equilibrium,
    gap_marker,
    C_DEMAND,
    C_SUPPLY,
    C_EQ,
    C_SHORT,
    C_SURPLUS,
    Q_EQ,
    P_EQ,
)
import theme
from theme import (
    AvoScene,
    ACCENT,
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
from manim import (
    VGroup,
    Text,
    MathTex,
    Dot,
    DashedLine,
    Line,
    FadeIn,
    FadeOut,
    Write,
    Create,
    Indicate,
    Flash,
    Circle,
    SurroundingRectangle,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
    BOLD,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def base_market(with_labels: bool = True):
    """Axes + demand + supply, positioned on the stage. Returns a VGroup with
    attributes .ax .demand .supply .dlab .slab for the caller to animate."""
    m = market_axes()
    ax = m.ax
    d = demand_curve(ax)
    s = supply_curve(ax)
    g = VGroup(m, d, s)
    g.ax = ax
    g.axes_group = m
    g.demand = d
    g.supply = s
    if with_labels:
        dlab = curve_label(ax, "Demand", 8.7, C_DEMAND, direction=DOWN)
        slab = curve_label(ax, "Supply", 8.7, C_SUPPLY, direction=UP)
        g.add(dlab, slab)
        g.dlab = dlab
        g.slab = slab
    g.move_to(DOWN * 0.25 + RIGHT * 0.3)
    return g


# ─── Cue00 : the two curves ──────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Equilibrium is the crossing point"
    cue_duration = 19.461

    def construct(self):
        m = base_market()
        self.play(Create(m.axes_group), run_time=1.6)
        wait_until(self, 4.0)
        self.play(Create(m.demand), FadeIn(m.dlab), run_time=2.2)
        wait_until(self, 9.0)
        self.play(Create(m.supply), FadeIn(m.slab), run_time=2.2)
        wait_until(self, 14.0)
        cross = Dot(m.ax.c2p(Q_EQ, P_EQ), color=C_EQ, radius=0.12)
        self.play(FadeIn(cross, scale=0.4), Flash(cross, color=C_EQ, line_length=0.3), run_time=1.4)
        self.guard(m)
        pace_to(self, self.cue_duration)


# ─── Cue01 : equilibrium = same quantity for buyers and sellers ──────────────
class Cue01(AvoScene):
    headline = "Where buyers and sellers want the same quantity"
    cue_duration = 19.462

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax)
        self.add(m)
        self.play(FadeIn(eq.dot, scale=0.4), run_time=1.2)
        wait_until(self, 4.5)
        self.play(Create(eq.vline), Create(eq.hline), run_time=1.6)
        self.play(Write(eq.qstar), Write(eq.pstar), run_time=1.2)
        wait_until(self, 11.0)
        note = Text("Q demanded = Q supplied", font_size=LABEL_SIZE, color=C_EQ, weight=BOLD)
        note.next_to(m.ax.c2p(Q_EQ, P_EQ), UP + RIGHT, buff=0.25)
        self.play(Write(note), run_time=1.6)
        wait_until(self, 16.5)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=1.2)
        self.guard(m, eq, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the crossing is the one balanced price ──────────────────────────
class Cue02(AvoScene):
    headline = "The crossing is the one balanced price"
    cue_duration = 19.461

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax)
        self.add(m, eq)
        wait_until(self, 2.0)
        box = SurroundingRectangle(eq.dot, color=C_EQ, buff=0.18, corner_radius=0.08)
        self.play(Create(box), run_time=1.4)
        wait_until(self, 7.0)
        # dim the rest of the curves so the eye lands on the crossing
        self.play(m.demand.animate.set_opacity(0.35), m.supply.animate.set_opacity(0.35),
                  run_time=1.4)
        wait_until(self, 12.0)
        self.play(Indicate(eq.dot, color=EMERALD, scale_factor=1.5),
                  Indicate(box, color=EMERALD), run_time=1.6)
        wait_until(self, 16.5)
        self.play(m.demand.animate.set_opacity(1.0), m.supply.animate.set_opacity(1.0),
                  run_time=1.2)
        self.guard(m, eq, box)
        pace_to(self, self.cue_duration)


# ─── Cue03 : analogy — the balance point (longer cue 20.6s) ──────────────────
class Cue03(AvoScene):
    headline = "Like a scale that settles when both sides balance"
    cue_duration = 20.607

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m)
        self.play(FadeIn(eq.dot, scale=0.4), run_time=1.0)
        wait_until(self, 4.0)
        # two "pressure" labels: buyers pull down price, sellers pull up
        buyers = Text("buyers want more", font_size=22, color=C_DEMAND)
        sellers = Text("sellers want more", font_size=22, color=C_SUPPLY)
        buyers.next_to(m.ax.c2p(2.2, 2.2), LEFT, buff=0.1)
        sellers.next_to(m.ax.c2p(8.0, 8.4), LEFT, buff=0.1)
        self.play(FadeIn(buyers, shift=RIGHT * 0.2), run_time=1.4)
        wait_until(self, 9.0)
        self.play(FadeIn(sellers, shift=LEFT * 0.2), run_time=1.4)
        wait_until(self, 14.0)
        settle = Text("settles at the crossing", font_size=LABEL_SIZE, color=C_EQ, weight=BOLD)
        settle.next_to(eq.dot, UP + RIGHT, buff=0.25)
        self.play(Write(settle), Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=1.8)
        self.guard(m, eq, buyers, sellers, settle)
        pace_to(self, self.cue_duration)


# ─── Cue04 : off-equilibrium pushes back ─────────────────────────────────────
class Cue04(AvoScene):
    headline = "Away from the crossing, pressure pushes price back"
    cue_duration = 19.461

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        # high price line -> surplus -> arrow pushing price down
        gap = gap_marker(m.ax, 7.0, "surplus")
        self.play(Create(gap.pline), run_time=1.2)
        wait_until(self, 4.0)
        self.play(FadeIn(gap.dot_s), FadeIn(gap.dot_d), Create(gap.arrow), run_time=1.6)
        self.play(FadeIn(gap.lab), FadeIn(gap.plab), run_time=1.0)
        wait_until(self, 11.0)
        arr = econ.push_arrow(m.ax, 7.0, "down", C_SURPLUS)
        self.play(Create(arr), run_time=1.4)
        wait_until(self, 16.0)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=1.4)
        self.guard(m, gap, arr)
        pace_to(self, self.cue_duration)


# ─── Cue05 : back from the analogy to the diagram ────────────────────────────
class Cue05(AvoScene):
    headline = "The analogy is a bridge — the graph is the mechanism"
    cue_duration = 19.462

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax)
        self.add(m)
        wait_until(self, 2.5)
        self.play(FadeIn(eq), run_time=1.6)
        wait_until(self, 8.0)
        cap = Text("two lines, one crossing", font_size=LABEL_SIZE, color=INK_MUTED)
        cap.to_edge(DOWN, buff=0.75)
        self.play(Write(cap), run_time=1.6)
        wait_until(self, 13.5)
        self.play(Indicate(m.demand, color=C_DEMAND, scale_factor=1.05),
                  Indicate(m.supply, color=C_SUPPLY, scale_factor=1.05), run_time=1.6)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=1.2)
        self.guard(m, eq, cap)
        pace_to(self, self.cue_duration)


# ─── Cue06 : low price -> shortage ───────────────────────────────────────────
class Cue06(AvoScene):
    headline = "At a low price, buyers want more than sellers make"
    cue_duration = 19.461

    def construct(self):
        m = base_market()
        self.add(m)
        gap = gap_marker(m.ax, 3.0, "shortage")
        self.play(Create(gap.pline), FadeIn(gap.plab), run_time=1.6)
        wait_until(self, 5.0)
        self.play(FadeIn(gap.dot_s, scale=0.5), run_time=1.0)
        sup_note = Text("sellers make few", font_size=22, color=C_SUPPLY).next_to(gap.dot_s, DOWN, buff=0.15)
        self.play(FadeIn(sup_note), run_time=1.0)
        wait_until(self, 10.0)
        self.play(FadeIn(gap.dot_d, scale=0.5), run_time=1.0)
        dem_note = Text("buyers want many", font_size=22, color=C_DEMAND).next_to(gap.dot_d, DOWN, buff=0.15)
        self.play(FadeIn(dem_note), run_time=1.0)
        wait_until(self, 15.0)
        self.play(Create(gap.arrow), FadeIn(gap.lab), run_time=1.6)
        self.guard(m, gap, sup_note, dem_note)
        pace_to(self, self.cue_duration)


# ─── Cue07 : the crossing is where the gap closes ────────────────────────────
class Cue07(AvoScene):
    headline = "The crossing is where the gap closes to zero"
    cue_duration = 19.461

    def construct(self):
        m = base_market()
        self.add(m)
        # animate a price line sliding from low up to equilibrium, gap shrinking
        eq = equilibrium(m.ax, label=False)
        gap = gap_marker(m.ax, 3.0, "shortage")
        self.play(Create(gap.pline), Create(gap.arrow), FadeIn(gap.lab), run_time=1.6)
        wait_until(self, 5.0)
        # slide to equilibrium
        eqgap = gap_marker(m.ax, 4.6, "shortage")
        self.play(gap.pline.animate.become(eqgap.pline),
                  gap.arrow.animate.become(eqgap.arrow),
                  gap.lab.animate.become(eqgap.lab), run_time=2.2)
        wait_until(self, 11.5)
        self.play(FadeOut(gap.arrow), FadeOut(gap.lab), FadeOut(gap.pline), run_time=1.0)
        self.play(FadeIn(eq.dot, scale=0.4), Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=1.4)
        wait_until(self, 16.5)
        z = Text("gap = 0", font_size=LABEL_SIZE, color=C_EQ, weight=BOLD).next_to(eq.dot, RIGHT, buff=0.3)
        self.play(Write(z), run_time=1.2)
        self.guard(m, eq.dot, z)
        pace_to(self, self.cue_duration)


# ─── Cue08 : the mechanism — two curves, one intersection ────────────────────
class Cue08(AvoScene):
    headline = "The mechanism: two curves, one intersection"
    cue_duration = 19.462

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax)
        self.add(m.axes_group)
        self.play(Create(m.demand), FadeIn(m.dlab), run_time=1.8)
        wait_until(self, 6.0)
        self.play(Create(m.supply), FadeIn(m.slab), run_time=1.8)
        wait_until(self, 12.0)
        self.play(FadeIn(eq.dot, scale=0.4), Create(eq.vline), Create(eq.hline),
                  Write(eq.qstar), Write(eq.pstar), run_time=2.0)
        wait_until(self, 17.0)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=1.2)
        self.guard(m, eq)
        pace_to(self, self.cue_duration)


# ─── Cue09 : surplus = Qs > Qd ───────────────────────────────────────────────
class Cue09(AvoScene):
    headline = "A surplus: quantity supplied exceeds quantity demanded"
    cue_duration = 19.461

    def construct(self):
        m = base_market()
        self.add(m)
        gap = gap_marker(m.ax, 7.0, "surplus")
        self.play(Create(gap.pline), FadeIn(gap.plab), run_time=1.4)
        wait_until(self, 4.5)
        self.play(FadeIn(gap.dot_d, scale=0.5), run_time=1.0)
        self.play(FadeIn(gap.dot_s, scale=0.5), run_time=1.0)
        wait_until(self, 9.5)
        self.play(Create(gap.arrow), FadeIn(gap.lab), run_time=1.6)
        wait_until(self, 14.0)
        eqn = MathTex(r"Q_s > Q_d", color=C_SURPLUS, font_size=40).next_to(gap.lab, UP, buff=0.2)
        self.play(Write(eqn), run_time=1.6)
        self.guard(m, gap, eqn)
        pace_to(self, self.cue_duration)


# ─── Cue10 : compare quantities at the same price (longer 20.6s) ─────────────
class Cue10(AvoScene):
    headline = "Read a graph: compare quantities at the same price"
    cue_duration = 20.607

    def construct(self):
        m = base_market()
        self.add(m)
        p = 7.0
        pline = DashedLine(m.ax.c2p(0, p), m.ax.c2p(10, p), color=INK_MUTED, stroke_width=2.5, dash_length=0.12)
        plab = MathTex("P = 7", color=INK_MUTED, font_size=32).next_to(m.ax.c2p(0, p), LEFT, buff=0.18)
        self.play(Create(pline), FadeIn(plab), run_time=1.8)
        wait_until(self, 5.0)
        dot_d = Dot(m.ax.c2p(econ.qd(p), p), color=C_DEMAND, radius=0.09)
        d_read = MathTex(r"Q_d = 2.5", color=C_DEMAND, font_size=32).next_to(dot_d, DOWN + LEFT, buff=0.12)
        self.play(FadeIn(dot_d, scale=0.5), Write(d_read), run_time=1.8)
        wait_until(self, 11.0)
        dot_s = Dot(m.ax.c2p(econ.qs(p), p), color=C_SUPPLY, radius=0.09)
        s_read = MathTex(r"Q_s = 7.5", color=C_SUPPLY, font_size=32).next_to(dot_s, DOWN + RIGHT, buff=0.14)
        self.play(FadeIn(dot_s, scale=0.5), Write(s_read), run_time=1.8)
        wait_until(self, 16.5)
        verdict = Text("→ surplus", font_size=LABEL_SIZE, color=C_SURPLUS, weight=BOLD)
        verdict.move_to(m.ax.c2p(7.1, 5.15))
        self.play(Write(verdict), run_time=1.8)
        self.guard(m, pline, dot_d, dot_s, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue11 : at equilibrium the two quantities are equal ─────────────────────
class Cue11(AvoScene):
    headline = "At equilibrium the two quantities are equal"
    cue_duration = 19.461

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax)
        self.add(m, eq)
        wait_until(self, 2.5)
        eqn = MathTex(r"Q_d(P^*) = Q_s(P^*)", color=C_EQ, font_size=42)
        eqn.next_to(m.ax.c2p(Q_EQ, P_EQ), UP + RIGHT, buff=0.3)
        self.play(Write(eqn), run_time=2.0)
        wait_until(self, 9.0)
        self.play(Indicate(eq.hline, color=C_EQ), Indicate(eq.vline, color=C_EQ), run_time=1.6)
        wait_until(self, 14.0)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.5),
                  Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=1.8)
        self.guard(m, eq, eqn)
        pace_to(self, self.cue_duration)


# ─── Cue12 : the misconception — highest isn't equilibrium ───────────────────
class Cue12(AvoScene):
    headline = "Not the highest point — the crossing"
    cue_duration = 19.462

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m)
        # a wrong guess: point up the supply curve, crossed out
        wrong_pt = m.ax.c2p(7.0, econ.supply(7.0))
        wrong = Dot(wrong_pt, color=ROSE, radius=0.1)
        wrong_lab = Text("not here", font_size=24, color=ROSE, weight=BOLD).next_to(wrong, RIGHT, buff=0.16)
        self.play(FadeIn(wrong, scale=0.5), FadeIn(wrong_lab), run_time=1.4)
        wait_until(self, 5.0)
        cross_x = Line(wrong.get_corner(UP + LEFT), wrong.get_corner(DOWN + RIGHT), color=ROSE, stroke_width=5)
        cross_y = Line(wrong.get_corner(DOWN + LEFT), wrong.get_corner(UP + RIGHT), color=ROSE, stroke_width=5)
        self.play(Create(cross_x), Create(cross_y), run_time=1.2)
        wait_until(self, 10.0)
        self.play(FadeIn(eq.dot, scale=0.4), run_time=1.0)
        right_lab = Text("the crossing", font_size=LABEL_SIZE, color=C_EQ, weight=BOLD).next_to(eq.dot, DOWN + RIGHT, buff=0.22)
        self.play(Write(right_lab), Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=1.6)
        wait_until(self, 16.5)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=1.2)
        self.guard(m, eq.dot, wrong, right_lab)
        pace_to(self, self.cue_duration)


# ─── Cue13 : the law of demand — downward slope ──────────────────────────────
class Cue13(AvoScene):
    headline = "Law of demand: quantity falls as price rises"
    cue_duration = 19.461

    def construct(self):
        m = base_market()
        self.add(m.axes_group, m.supply, m.slab)
        self.play(Create(m.demand), FadeIn(m.dlab), run_time=1.8)
        wait_until(self, 5.0)
        # two sample points showing the downward relationship
        lo = Dot(m.ax.c2p(econ.qd(3.0), 3.0), color=C_DEMAND, radius=0.09)
        hi = Dot(m.ax.c2p(econ.qd(7.0), 7.0), color=C_DEMAND, radius=0.09)
        lo_lab = MathTex(r"\text{low } P \Rightarrow \text{more } Q", color=C_DEMAND, font_size=28).next_to(lo, RIGHT, buff=0.2)
        hi_lab = MathTex(r"\text{high } P \Rightarrow \text{less } Q", color=C_DEMAND, font_size=28).next_to(hi, RIGHT, buff=0.2)
        self.play(FadeIn(lo, scale=0.5), Write(lo_lab), run_time=1.6)
        wait_until(self, 10.5)
        self.play(FadeIn(hi, scale=0.5), Write(hi_lab), run_time=1.6)
        wait_until(self, 15.5)
        self.play(Indicate(m.demand, color=C_DEMAND, scale_factor=1.06), run_time=1.6)
        self.guard(m, lo, hi, lo_lab, hi_lab)
        pace_to(self, self.cue_duration)
