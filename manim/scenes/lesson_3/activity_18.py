"""
Lesson 3 — Part 2 (activity 18): "Shortage and surplus push price back" (287.98s).

14 Cue<NN> scenes (segment_18.json, rescaled to the real 287.98s MP3). Where
Part 1 established the crossing, Part 2 is about the DYNAMICS: a price below
equilibrium leaves a shortage (Qd>Qs) that pushes price up; a price above leaves
a surplus (Qs>Qd) that pushes price down; both forces converge back to the
crossing where the gap is zero. Reuses econ.py's gap_marker / push_arrow and
animates a price marker sliding toward equilibrium. Each chunk is standalone.
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
    Arrow,
    FadeIn,
    FadeOut,
    Write,
    Create,
    Indicate,
    Flash,
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


# ─── Cue00 : intro ───────────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Shortage and surplus push price back"
    cue_duration = 20.399

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.play(Create(m.axes_group), run_time=1.6)
        self.play(Create(m.demand), Create(m.supply), FadeIn(m.dlab), FadeIn(m.slab), run_time=2.2)
        wait_until(self, 7.0)
        self.play(FadeIn(eq.dot, scale=0.4), Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=1.4)
        wait_until(self, 12.0)
        up = econ.push_arrow(m.ax, 3.0, "up", C_SHORT)
        down = econ.push_arrow(m.ax, 7.0, "down", C_SURPLUS)
        self.play(Create(up), Create(down), run_time=2.0)
        wait_until(self, 17.5)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=1.2)
        self.guard(m, eq.dot, up, down)
        pace_to(self, self.cue_duration)


# ─── Cue01 : off-equilibrium prices create pressure ──────────────────────────
class Cue01(AvoScene):
    headline = "Off-equilibrium prices create pressure"
    cue_duration = 20.398

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        # surplus above
        gS = gap_marker(m.ax, 7.0, "surplus")
        self.play(Create(gS.pline), Create(gS.arrow), FadeIn(gS.lab), run_time=1.8)
        down = econ.push_arrow(m.ax, 6.8, "down", C_SURPLUS)
        self.play(Create(down), run_time=1.2)
        wait_until(self, 9.0)
        # shortage below
        gL = gap_marker(m.ax, 3.0, "shortage")
        self.play(Create(gL.pline), Create(gL.arrow), FadeIn(gL.lab), run_time=1.8)
        up = econ.push_arrow(m.ax, 3.2, "up", C_SHORT)
        self.play(Create(up), run_time=1.2)
        wait_until(self, 17.0)
        self.play(Indicate(up, color=C_SHORT), Indicate(down, color=C_SURPLUS), run_time=1.6)
        self.guard(m, eq.dot, gS, gL, up, down)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the price adjusts toward the crossing ───────────────────────────
class Cue02(AvoScene):
    headline = "The price adjusts toward the crossing"
    cue_duration = 20.399

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        # a price marker on the y axis slides from high down to P*
        marker = Dot(m.ax.c2p(0, 7.5), color=INK, radius=0.11)
        mlab = Text("price", font_size=22, color=INK_MUTED).next_to(marker, LEFT, buff=0.15)
        self.play(FadeIn(marker), FadeIn(mlab), run_time=1.2)
        wait_until(self, 4.0)
        self.play(marker.animate.move_to(m.ax.c2p(0, P_EQ)),
                  mlab.animate.next_to(m.ax.c2p(0, P_EQ), LEFT, buff=0.15), run_time=3.5)
        wait_until(self, 11.0)
        # then from low up to P*
        marker2 = Dot(m.ax.c2p(0, 2.5), color=INK, radius=0.11)
        self.play(FadeIn(marker2), run_time=0.8)
        self.play(marker2.animate.move_to(m.ax.c2p(0, P_EQ)), run_time=3.2)
        wait_until(self, 18.0)
        self.play(Flash(eq.dot, color=C_EQ, line_length=0.3), Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=1.4)
        self.guard(m, eq.dot, marker, marker2)
        pace_to(self, self.cue_duration)


# ─── Cue03 : thermostat analogy (longer 21.6s) ───────────────────────────────
class Cue03(AvoScene):
    headline = "Like a thermostat pulling back to its set point"
    cue_duration = 21.598

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        setp = DashedLine(m.ax.c2p(0, P_EQ), m.ax.c2p(10, P_EQ), color=C_EQ, stroke_width=2, dash_length=0.12)
        setlab = Text("set point", font_size=22, color=C_EQ).next_to(m.ax.c2p(10, P_EQ), RIGHT, buff=0.1)
        self.play(Create(setp), FadeIn(setlab), run_time=1.8)
        wait_until(self, 5.0)
        too_high = Text("too high → cools off", font_size=24, color=C_SURPLUS).move_to(m.ax.c2p(5, 8.4))
        self.play(FadeIn(too_high, shift=DOWN * 0.2), run_time=1.6)
        down = econ.push_arrow(m.ax, 7.5, "down", C_SURPLUS)
        self.play(Create(down), run_time=1.2)
        wait_until(self, 12.5)
        too_low = Text("too low → heats up", font_size=24, color=C_SHORT).move_to(m.ax.c2p(5, 1.4))
        self.play(FadeIn(too_low, shift=UP * 0.2), run_time=1.6)
        up = econ.push_arrow(m.ax, 2.2, "up", C_SHORT)
        self.play(Create(up), run_time=1.2)
        wait_until(self, 19.0)
        self.play(Indicate(setp, color=C_EQ), run_time=1.4)
        self.guard(m, eq.dot, setp, too_high, too_low, up, down)
        pace_to(self, self.cue_duration)


# ─── Cue04 : too low pushes up (shortage) ────────────────────────────────────
class Cue04(AvoScene):
    headline = "Too low: a shortage pushes the price up"
    cue_duration = 20.399

    def construct(self):
        m = base_market()
        self.add(m)
        gL = gap_marker(m.ax, 3.0, "shortage")
        self.play(Create(gL.pline), FadeIn(gL.plab), run_time=1.4)
        self.play(FadeIn(gL.dot_s), FadeIn(gL.dot_d), Create(gL.arrow), FadeIn(gL.lab), run_time=2.0)
        wait_until(self, 8.0)
        up = econ.push_arrow(m.ax, 3.2, "up", C_SHORT)
        cap = Text("buyers bid the price up", font_size=LABEL_SIZE, color=C_SHORT, weight=BOLD)
        cap.to_edge(DOWN, buff=0.7)
        self.play(Create(up), Write(cap), run_time=2.0)
        wait_until(self, 15.0)
        self.play(Indicate(gL.arrow, color=C_SHORT), Indicate(up, color=C_SHORT), run_time=1.8)
        self.guard(m, gL, up, cap)
        pace_to(self, self.cue_duration)


# ─── Cue05 : analogy is a bridge, back to the graph ──────────────────────────
class Cue05(AvoScene):
    headline = "The analogy is a bridge — the graph is the mechanism"
    cue_duration = 20.398

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax)
        self.add(m.axes_group, m.demand, m.supply, m.dlab, m.slab)
        wait_until(self, 3.0)
        self.play(FadeIn(eq), run_time=2.0)
        wait_until(self, 10.0)
        cap = Text("pressure only vanishes at the crossing", font_size=LABEL_SIZE, color=INK_MUTED)
        cap.to_edge(DOWN, buff=0.65)
        self.play(Write(cap), run_time=2.0)
        wait_until(self, 17.0)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.5),
                  Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=1.8)
        self.guard(m, eq, cap)
        pace_to(self, self.cue_duration)


# ─── Cue06 : low price -> shortage detail ────────────────────────────────────
class Cue06(AvoScene):
    headline = "At a low price, buyers want more than sellers make"
    cue_duration = 20.399

    def construct(self):
        m = base_market()
        self.add(m)
        gL = gap_marker(m.ax, 3.0, "shortage")
        self.play(Create(gL.pline), FadeIn(gL.plab), run_time=1.6)
        wait_until(self, 5.0)
        self.play(FadeIn(gL.dot_s, scale=0.5), run_time=1.0)
        sn = Text("few made", font_size=22, color=C_SUPPLY).next_to(gL.dot_s, DOWN, buff=0.15)
        self.play(FadeIn(sn), run_time=1.0)
        wait_until(self, 10.5)
        self.play(FadeIn(gL.dot_d, scale=0.5), run_time=1.0)
        dn = Text("many wanted", font_size=22, color=C_DEMAND).next_to(gL.dot_d, UP, buff=0.15)
        self.play(FadeIn(dn), run_time=1.0)
        wait_until(self, 16.0)
        self.play(Create(gL.arrow), FadeIn(gL.lab), run_time=1.8)
        self.guard(m, gL, sn, dn)
        pace_to(self, self.cue_duration)


# ─── Cue07 : shortage closes as price rises to equilibrium ───────────────────
class Cue07(AvoScene):
    headline = "As price rises, the shortage shrinks to zero"
    cue_duration = 20.399

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m)
        g0 = gap_marker(m.ax, 3.0, "shortage")
        self.play(Create(g0.pline), Create(g0.arrow), FadeIn(g0.lab), run_time=1.8)
        wait_until(self, 5.0)
        g1 = gap_marker(m.ax, 4.5, "shortage")
        self.play(g0.pline.animate.become(g1.pline),
                  g0.arrow.animate.become(g1.arrow),
                  g0.lab.animate.become(g1.lab), run_time=3.0)
        wait_until(self, 13.0)
        self.play(FadeOut(g0.pline), FadeOut(g0.arrow), FadeOut(g0.lab), run_time=1.0)
        self.play(FadeIn(eq.dot, scale=0.4), Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=1.4)
        z = Text("gap = 0", font_size=LABEL_SIZE, color=C_EQ, weight=BOLD).next_to(eq.dot, RIGHT, buff=0.3)
        self.play(Write(z), run_time=1.2)
        self.guard(m, eq.dot, z)
        pace_to(self, self.cue_duration)


# ─── Cue08 : mechanism — both sides restore balance ──────────────────────────
class Cue08(AvoScene):
    headline = "Both forces restore the balance"
    cue_duration = 20.398

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        up = econ.push_arrow(m.ax, 3.0, "up", C_SHORT)
        upl = Text("shortage ↑", font_size=24, color=C_SHORT).next_to(up, LEFT, buff=0.12)
        self.play(Create(up), FadeIn(upl), run_time=1.8)
        wait_until(self, 7.0)
        down = econ.push_arrow(m.ax, 7.0, "down", C_SURPLUS)
        downl = Text("surplus ↓", font_size=24, color=C_SURPLUS).next_to(down, LEFT, buff=0.12)
        self.play(Create(down), FadeIn(downl), run_time=1.8)
        wait_until(self, 14.0)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.5),
                  Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=1.8)
        self.guard(m, eq.dot, up, down, upl, downl)
        pace_to(self, self.cue_duration)


# ─── Cue09 : surplus = Qs > Qd, push down ────────────────────────────────────
class Cue09(AvoScene):
    headline = "A surplus: supplied exceeds demanded, price falls"
    cue_duration = 20.399

    def construct(self):
        m = base_market()
        self.add(m)
        gS = gap_marker(m.ax, 7.0, "surplus")
        self.play(Create(gS.pline), FadeIn(gS.plab), run_time=1.4)
        self.play(FadeIn(gS.dot_d), FadeIn(gS.dot_s), Create(gS.arrow), FadeIn(gS.lab), run_time=2.0)
        wait_until(self, 8.0)
        eqn = MathTex(r"Q_s > Q_d", color=C_SURPLUS, font_size=40).next_to(gS.lab, UP, buff=0.2)
        self.play(Write(eqn), run_time=1.6)
        wait_until(self, 13.5)
        down = econ.push_arrow(m.ax, 6.8, "down", C_SURPLUS)
        self.play(Create(down), run_time=1.6)
        self.play(Indicate(down, color=C_SURPLUS), run_time=1.4)
        self.guard(m, gS, eqn, down)
        pace_to(self, self.cue_duration)


# ─── Cue10 : compare quantities at a price (longer 21.6s) ────────────────────
class Cue10(AvoScene):
    headline = "Same price, two quantities — which is bigger?"
    cue_duration = 21.598

    def construct(self):
        m = base_market()
        self.add(m)
        p = 3.0
        pline = DashedLine(m.ax.c2p(0, p), m.ax.c2p(10, p), color=INK_MUTED, stroke_width=2.5, dash_length=0.12)
        plab = MathTex("P = 3", color=INK_MUTED, font_size=32).next_to(m.ax.c2p(0, p), LEFT, buff=0.18)
        self.play(Create(pline), FadeIn(plab), run_time=1.8)
        wait_until(self, 5.0)
        dot_s = Dot(m.ax.c2p(econ.qs(p), p), color=C_SUPPLY, radius=0.09)
        s_read = MathTex(r"Q_s = 2.5", color=C_SUPPLY, font_size=32).next_to(dot_s, DOWN + LEFT, buff=0.12)
        self.play(FadeIn(dot_s, scale=0.5), Write(s_read), run_time=1.8)
        wait_until(self, 11.0)
        dot_d = Dot(m.ax.c2p(econ.qd(p), p), color=C_DEMAND, radius=0.09)
        d_read = MathTex(r"Q_d = 7.5", color=C_DEMAND, font_size=32).next_to(dot_d, UP + RIGHT, buff=0.12)
        self.play(FadeIn(dot_d, scale=0.5), Write(d_read), run_time=1.8)
        wait_until(self, 17.0)
        verdict = Text("→ shortage", font_size=LABEL_SIZE, color=C_SHORT, weight=BOLD)
        verdict.move_to(m.ax.c2p(2.4, 4.7))
        self.play(Write(verdict), run_time=1.8)
        self.guard(m, pline, dot_s, dot_d, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue11 : at equilibrium, no pressure ─────────────────────────────────────
class Cue11(AvoScene):
    headline = "At the crossing, there is no pressure left"
    cue_duration = 20.399

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax)
        self.add(m, eq)
        wait_until(self, 3.0)
        stable = Text("stable", font_size=LABEL_SIZE, color=C_EQ, weight=BOLD).next_to(eq.dot, UP + RIGHT, buff=0.25)
        self.play(Write(stable), run_time=1.6)
        wait_until(self, 9.0)
        eqn = MathTex(r"Q_d = Q_s \Rightarrow \text{no push}", color=C_EQ, font_size=36)
        eqn.to_edge(DOWN, buff=0.65)
        self.play(Write(eqn), run_time=2.0)
        wait_until(self, 16.0)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.5),
                  Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=1.8)
        self.guard(m, eq, stable, eqn)
        pace_to(self, self.cue_duration)


# ─── Cue12 : the misconception — the push is the mechanism ───────────────────
class Cue12(AvoScene):
    headline = "Naming 'shortage' isn't enough — say which way it pushes"
    cue_duration = 20.398

    def construct(self):
        m = base_market()
        self.add(m)
        gL = gap_marker(m.ax, 3.0, "shortage")
        self.play(Create(gL.pline), Create(gL.arrow), FadeIn(gL.lab), run_time=1.8)
        wait_until(self, 6.0)
        q = Text("→ which way does price move?", font_size=26, color=INK_MUTED).to_edge(UP, buff=1.5).shift(RIGHT * 1.4)
        self.play(FadeIn(q), run_time=1.4)
        wait_until(self, 11.0)
        up = econ.push_arrow(m.ax, 3.2, "up", C_SHORT)
        ans = Text("up", font_size=LABEL_SIZE, color=C_SHORT, weight=BOLD).next_to(up, RIGHT, buff=0.15)
        self.play(Create(up), Write(ans), run_time=1.8)
        wait_until(self, 17.0)
        self.play(Indicate(up, color=C_SHORT), run_time=1.6)
        self.guard(m, gL, up, q, ans)
        pace_to(self, self.cue_duration)


# ─── Cue13 : wrap — both forces converge to equilibrium ──────────────────────
class Cue13(AvoScene):
    headline = "Shortage up, surplus down — both meet at the crossing"
    cue_duration = 20.399

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        up = econ.push_arrow(m.ax, 3.0, "up", C_SHORT)
        down = econ.push_arrow(m.ax, 7.0, "down", C_SURPLUS)
        self.play(Create(up), Create(down), run_time=2.0)
        wait_until(self, 7.0)
        conv = Text("converge to  P*, Q*", font_size=LABEL_SIZE, color=C_EQ, weight=BOLD)
        conv.next_to(eq.dot, RIGHT + UP, buff=0.28)
        self.play(Write(conv), run_time=1.8)
        wait_until(self, 14.0)
        self.play(up.animate.set_opacity(0.3), down.animate.set_opacity(0.3),
                  Indicate(eq.dot, color=C_EQ, scale_factor=1.6),
                  Flash(eq.dot, color=C_EQ, line_length=0.35), run_time=2.0)
        self.guard(m, eq.dot, up, down, conv)
        pace_to(self, self.cue_duration)
