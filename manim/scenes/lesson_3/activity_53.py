"""
Lesson 3 — Part 3 (activity 53): "Taxes create a wedge and split burden" (291.7s).

14 Cue<NN> scenes (segment_53.json, rescaled to the real 291.7s MP3). A per-unit
tax drives a vertical WEDGE between the price buyers pay (on the demand curve) and
the price sellers keep (on the supply curve); the traded quantity falls from Q*;
and the burden splits between the two sides — the less responsive (steeper) side
bears more. Reuses econ.py's tax_wedge / burden_split / steep_demand on the shared
market demand(q)=9-0.8q, supply(q)=1+0.8q (tax = 2 → Q 3.75, buyer 6, seller 4).
Each chunk is standalone.
"""

import econ
from econ import (
    market_axes,
    demand_curve,
    supply_curve,
    curve_label,
    equilibrium,
    tax_wedge,
    burden_split,
    steep_demand,
    C_DEMAND,
    C_SUPPLY,
    C_EQ,
    C_TAX,
    Q_EQ,
    P_EQ,
    Q_TAX,
    P_BUY,
    P_SELL,
)
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
from manim import (
    VGroup,
    Text,
    MathTex,
    Dot,
    DashedLine,
    Line,
    Arrow,
    Brace,
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


# ─── Cue00 : intro — a tax opens a wedge ─────────────────────────────────────
class Cue00(AvoScene):
    headline = "Taxes create a wedge and split burden"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.play(Create(m.axes_group), run_time=1.4)
        self.play(Create(m.demand), Create(m.supply), FadeIn(m.dlab), FadeIn(m.slab), run_time=2.0)
        wait_until(self, 6.0)
        self.play(FadeIn(eq.dot, scale=0.4), run_time=1.0)
        wait_until(self, 10.0)
        w = tax_wedge(m.ax)
        self.play(Create(w.wedge), FadeIn(w.buyer_dot), FadeIn(w.seller_dot), run_time=2.0)
        wait_until(self, 16.0)
        self.play(FadeIn(w.brace), FadeIn(w.tlab), run_time=1.6)
        self.guard(m, eq.dot, w)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the less responsive side bears more (preview) ───────────────────
class Cue01(AvoScene):
    headline = "The less responsive side bears more of the burden"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        self.add(m)
        bs = burden_split(m.ax)
        self.play(Create(bs.pstar), run_time=1.2)
        wait_until(self, 4.0)
        self.play(FadeIn(bs.b_brace), Write(bs.b_lab), run_time=1.8)
        wait_until(self, 9.5)
        self.play(FadeIn(bs.s_brace), Write(bs.s_lab), run_time=1.8)
        wait_until(self, 15.0)
        rule = Text("steeper curve → bigger share", font_size=BODY_SIZE, color=INK_MUTED)
        rule.to_edge(DOWN, buff=0.6)
        self.play(Write(rule), run_time=1.8)
        self.guard(m, bs, rule)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the concrete object — the vertical wedge ────────────────────────
class Cue02(AvoScene):
    headline = "The concrete object: a vertical wedge at the traded quantity"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        self.add(m)
        w = tax_wedge(m.ax)
        self.play(Create(w.qline), run_time=1.4)
        wait_until(self, 4.5)
        self.play(FadeIn(w.buyer_dot), FadeIn(w.seller_dot), Create(w.wedge), run_time=2.0)
        wait_until(self, 10.0)
        self.play(FadeIn(w.brace), FadeIn(w.tlab), run_time=1.6)
        wait_until(self, 15.0)
        self.play(Indicate(w.wedge, color=C_TAX, scale_factor=1.15), run_time=1.6)
        self.guard(m, w)
        pace_to(self, self.cue_duration)


# ─── Cue03 : why it matters — buyer pays more, seller gets less ──────────────
class Cue03(AvoScene):
    headline = "Buyer pays more, seller keeps less"
    cue_duration = 21.878

    def construct(self):
        m = base_market()
        self.add(m)
        w = tax_wedge(m.ax)
        self.play(Create(w.wedge), FadeIn(w.buyer_dot), FadeIn(w.seller_dot), run_time=1.8)
        wait_until(self, 5.0)
        self.play(Write(w.buyer_lab), run_time=1.4)
        pbuy = MathTex(r"P_b = 6", color=C_DEMAND, font_size=32).next_to(w.buyer_dot, RIGHT, buff=0.2)
        self.play(Write(pbuy), run_time=1.2)
        wait_until(self, 12.0)
        self.play(Write(w.seller_lab), run_time=1.4)
        psell = MathTex(r"P_s = 4", color=C_SUPPLY, font_size=32).next_to(w.seller_dot, RIGHT, buff=0.2)
        self.play(Write(psell), run_time=1.2)
        wait_until(self, 18.5)
        self.play(FadeIn(w.brace), FadeIn(w.tlab), Indicate(w.wedge, color=C_TAX), run_time=1.8)
        self.guard(m, w, pbuy, psell)
        pace_to(self, self.cue_duration)


# ─── Cue04 : analogy — a toll on a road ──────────────────────────────────────
class Cue04(AvoScene):
    headline = "Like a toll: driver pays more than the road keeps"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        self.add(m)
        w = tax_wedge(m.ax)
        self.play(Create(w.wedge), FadeIn(w.buyer_dot), FadeIn(w.seller_dot), run_time=1.8)
        wait_until(self, 5.0)
        pay = Text("driver pays 6", font_size=24, color=C_DEMAND).next_to(w.buyer_dot, UP + RIGHT, buff=0.15)
        keep = Text("road keeps 4", font_size=24, color=C_SUPPLY).next_to(w.seller_dot, DOWN + RIGHT, buff=0.15)
        self.play(FadeIn(pay, shift=UP * 0.1), run_time=1.4)
        wait_until(self, 11.0)
        self.play(FadeIn(keep, shift=DOWN * 0.1), run_time=1.4)
        wait_until(self, 16.0)
        gov = Text("gap = tax", font_size=LABEL_SIZE, color=C_TAX, weight=BOLD).next_to(w.brace, RIGHT, buff=0.12)
        self.play(FadeIn(w.brace), Write(gov), run_time=1.8)
        self.guard(m, w, pay, keep, gov)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the market still adjusts pressure ───────────────────────────────
class Cue05(AvoScene):
    headline = "The price still balances quantity — now around the wedge"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        wait_until(self, 3.0)
        w = tax_wedge(m.ax)
        self.play(Create(w.wedge), FadeIn(w.buyer_dot), FadeIn(w.seller_dot), run_time=2.0)
        wait_until(self, 9.0)
        # quantity settles where the wedge fits between the curves
        note = Text("quantity where the gap = tax", font_size=BODY_SIZE, color=INK_MUTED)
        note.to_edge(DOWN, buff=0.6)
        self.play(Write(note), run_time=1.8)
        wait_until(self, 16.0)
        self.play(Indicate(w.wedge, color=C_TAX, scale_factor=1.15), run_time=1.6)
        self.guard(m, eq.dot, w, note)
        pace_to(self, self.cue_duration)


# ─── Cue06 : the tax changes the effective price ─────────────────────────────
class Cue06(AvoScene):
    headline = "The tax changes the price each side sees"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        # arrows from P* up to buyer price and down to seller price
        pstar_b = Arrow(m.ax.c2p(Q_TAX, P_EQ), m.ax.c2p(Q_TAX, P_BUY), color=C_DEMAND,
                        buff=0.02, stroke_width=5, tip_length=0.18)
        pstar_s = Arrow(m.ax.c2p(Q_TAX, P_EQ), m.ax.c2p(Q_TAX, P_SELL), color=C_SUPPLY,
                        buff=0.02, stroke_width=5, tip_length=0.18)
        self.play(Create(pstar_b), run_time=1.6)
        b_lab = Text("+1 to buyer", font_size=22, color=C_DEMAND).next_to(pstar_b, RIGHT, buff=0.15)
        self.play(FadeIn(b_lab), run_time=1.0)
        wait_until(self, 9.0)
        self.play(Create(pstar_s), run_time=1.6)
        s_lab = Text("−1 to seller", font_size=22, color=C_SUPPLY).next_to(pstar_s, RIGHT, buff=0.15)
        self.play(FadeIn(s_lab), run_time=1.0)
        wait_until(self, 16.0)
        self.play(Indicate(pstar_b, color=C_DEMAND), Indicate(pstar_s, color=C_SUPPLY), run_time=1.6)
        self.guard(m, eq.dot, pstar_b, pstar_s, b_lab, s_lab)
        pace_to(self, self.cue_duration)


# ─── Cue07 : fewer trades — quantity falls ───────────────────────────────────
class Cue07(AvoScene):
    headline = "Fewer trades happen — quantity falls below Q*"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        qstar_line = DashedLine(m.ax.c2p(Q_EQ, 0), m.ax.c2p(Q_EQ, P_EQ), color=C_EQ, stroke_width=2, dash_length=0.1)
        qstar_lab = MathTex("Q^*", color=C_EQ, font_size=32).next_to(m.ax.c2p(Q_EQ, 0), DOWN, buff=0.15)
        self.play(Create(qstar_line), Write(qstar_lab), run_time=1.6)
        wait_until(self, 6.0)
        w = tax_wedge(m.ax)
        qtax_line = DashedLine(m.ax.c2p(Q_TAX, 0), m.ax.c2p(Q_TAX, P_BUY), color=C_TAX, stroke_width=2, dash_length=0.1)
        qtax_lab = MathTex(r"Q_{\text{tax}}", color=C_TAX, font_size=32).next_to(m.ax.c2p(Q_TAX, 0), DOWN, buff=0.15)
        self.play(Create(qtax_line), Create(w.wedge), Write(qtax_lab), run_time=2.2)
        wait_until(self, 13.0)
        arr = Arrow(m.ax.c2p(Q_EQ, 0.6), m.ax.c2p(Q_TAX, 0.6), color=ROSE, buff=0.05, stroke_width=5, tip_length=0.2)
        drop = Text("fewer trades", font_size=BODY_SIZE, color=ROSE, weight=BOLD).next_to(arr, DOWN, buff=0.15)
        self.play(Create(arr), Write(drop), run_time=1.8)
        self.guard(m, eq.dot, qstar_line, qtax_line, arr, drop)
        pace_to(self, self.cue_duration)


# ─── Cue08 : incidence — the steeper side bears more ─────────────────────────
class Cue08(AvoScene):
    headline = "Incidence: the steeper (less responsive) side bears more"
    cue_duration = 20.662

    def construct(self):
        m = base_market(with_labels=False)
        self.add(m.axes_group, m.supply)
        # steep demand through equilibrium = inelastic buyers
        sd = steep_demand(m.ax)
        self.play(Create(sd), run_time=1.8)
        sd_lab = Text("steep demand", font_size=22, color=ACCENT_LIGHT).next_to(m.ax.c2p(3.4, 8.0), RIGHT, buff=0.1)
        self.play(FadeIn(sd_lab), run_time=1.0)
        wait_until(self, 7.0)
        bs = burden_split(m.ax)
        self.play(FadeIn(bs.b_brace), Write(bs.b_lab), run_time=1.8)
        wait_until(self, 12.0)
        self.play(FadeIn(bs.s_brace), Write(bs.s_lab), run_time=1.8)
        wait_until(self, 17.0)
        rule = Text("less responsive → bigger share", font_size=BODY_SIZE, color=INK_MUTED)
        rule.to_edge(DOWN, buff=0.55)
        self.play(Write(rule), Indicate(bs.b_brace, color=C_DEMAND), run_time=1.8)
        self.guard(m.axes_group, bs, sd, rule)
        pace_to(self, self.cue_duration)


# ─── Cue09 : the wedge separates the two prices ──────────────────────────────
class Cue09(AvoScene):
    headline = "A per-unit tax separates buyer price from seller receipt"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        self.add(m)
        w = tax_wedge(m.ax)
        self.play(FadeIn(w.buyer_dot), FadeIn(w.seller_dot), run_time=1.4)
        wait_until(self, 4.5)
        self.play(Create(w.wedge), Write(w.buyer_lab), Write(w.seller_lab), run_time=2.2)
        wait_until(self, 11.0)
        eqn = MathTex(r"P_b - P_s = \text{tax}", color=C_TAX, font_size=38).to_edge(DOWN, buff=0.6)
        self.play(Write(eqn), run_time=1.8)
        wait_until(self, 16.5)
        self.play(FadeIn(w.brace), FadeIn(w.tlab), Indicate(w.wedge, color=C_TAX), run_time=1.8)
        self.guard(m, w, eqn)
        pace_to(self, self.cue_duration)


# ─── Cue10 : law of supply — upward slope ────────────────────────────────────
class Cue10(AvoScene):
    headline = "Law of supply: quantity rises as price rises"
    cue_duration = 21.878

    def construct(self):
        m = base_market()
        self.add(m.axes_group, m.demand, m.dlab)
        self.play(Create(m.supply), FadeIn(m.slab), run_time=1.8)
        wait_until(self, 5.0)
        lo = Dot(m.ax.c2p(econ.qs(3.0), 3.0), color=C_SUPPLY, radius=0.09)
        hi = Dot(m.ax.c2p(econ.qs(7.0), 7.0), color=C_SUPPLY, radius=0.09)
        lo_lab = MathTex(r"\text{low } P \Rightarrow \text{less } Q", color=C_SUPPLY, font_size=28).next_to(lo, LEFT, buff=0.2)
        hi_lab = MathTex(r"\text{high } P \Rightarrow \text{more } Q", color=C_SUPPLY, font_size=28).next_to(hi, LEFT, buff=0.2)
        self.play(FadeIn(lo, scale=0.5), Write(lo_lab), run_time=1.6)
        wait_until(self, 12.0)
        self.play(FadeIn(hi, scale=0.5), Write(hi_lab), run_time=1.6)
        wait_until(self, 18.0)
        self.play(Indicate(m.supply, color=C_SUPPLY, scale_factor=1.06), run_time=1.6)
        self.guard(m, lo, hi, lo_lab, hi_lab)
        pace_to(self, self.cue_duration)


# ─── Cue11 : the wedge reduces quantity from Q* ──────────────────────────────
class Cue11(AvoScene):
    headline = "The wedge shrinks the quantity traded"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.add(m, eq.dot)
        w = tax_wedge(m.ax)
        self.play(Create(w.wedge), FadeIn(w.buyer_dot), FadeIn(w.seller_dot), run_time=1.8)
        wait_until(self, 6.0)
        eqn = MathTex(r"Q_{\text{tax}} = 3.75 < Q^* = 5", color=INK, font_size=34).to_edge(DOWN, buff=0.6)
        self.play(Write(eqn), run_time=2.0)
        wait_until(self, 13.0)
        arr = Arrow(m.ax.c2p(Q_EQ, 2.6), m.ax.c2p(Q_TAX, 2.6), color=ROSE, buff=0.05, stroke_width=5, tip_length=0.2)
        self.play(Create(arr), Indicate(eq.dot, color=C_EQ), run_time=1.8)
        self.guard(m, eq.dot, w, eqn, arr)
        pace_to(self, self.cue_duration)


# ─── Cue12 : name the mechanism AND the direction ────────────────────────────
class Cue12(AvoScene):
    headline = "Saying 'tax' isn't enough — say who bears it"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        self.add(m)
        w = tax_wedge(m.ax)
        self.play(Create(w.wedge), FadeIn(w.buyer_dot), FadeIn(w.seller_dot), run_time=1.8)
        wait_until(self, 6.0)
        q = Text("→ which side is less responsive?", font_size=24, color=INK_MUTED).to_edge(UP, buff=1.5).shift(RIGHT * 1.4)
        self.play(FadeIn(q), run_time=1.4)
        wait_until(self, 11.0)
        bs = burden_split(m.ax)
        self.play(FadeIn(bs.b_brace), FadeIn(bs.s_brace), Write(bs.b_lab), Write(bs.s_lab), run_time=2.0)
        wait_until(self, 17.0)
        self.play(Indicate(bs.b_brace, color=C_DEMAND), Indicate(bs.s_brace, color=C_SUPPLY), run_time=1.8)
        self.guard(m, w, bs, q)
        pace_to(self, self.cue_duration)


# ─── Cue13 : the misconception — equilibrium ≠ everyone happy ────────────────
class Cue13(AvoScene):
    headline = "A taxed market clears — but nobody is fully happy"
    cue_duration = 20.662

    def construct(self):
        m = base_market()
        self.add(m)
        w = tax_wedge(m.ax)
        self.play(Create(w.wedge), FadeIn(w.buyer_dot), FadeIn(w.seller_dot),
                  Write(w.buyer_lab), Write(w.seller_lab), run_time=2.2)
        wait_until(self, 7.0)
        cross = Text("buyer pays more · seller keeps less · fewer trades",
                     font_size=BODY_SIZE, color=ROSE, weight=BOLD)
        cross.to_edge(DOWN, buff=0.55)
        self.play(Write(cross), run_time=2.2)
        wait_until(self, 15.0)
        self.play(FadeIn(w.brace), FadeIn(w.tlab), Indicate(w.wedge, color=C_TAX, scale_factor=1.15), run_time=1.8)
        self.guard(m, w, cross)
        pace_to(self, self.cue_duration)
