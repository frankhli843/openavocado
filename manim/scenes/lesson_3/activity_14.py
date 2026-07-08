"""
Lesson 3 — Orientation (activity 14): "Audio: How Markets Find a Price" (972.96s).

7 long Cue<NN> scenes (segment_14.json, rescaled to the real 972.96s MP3; each
chunk ≈139s). This is the generic route-map orientation: High-level map → Analogy
→ Tiny example → Mechanism → Implementation → Misconception → Synthesis. Each
chapter is a slow visual essay built from the shared price–quantity idioms in
econ.py so the orientation previews the exact vocabulary the lesson parts use.
Every chunk is standalone; long cues are paced with many timed beats.
"""

import econ
from econ import (
    market_axes,
    demand_curve,
    supply_curve,
    curve_label,
    equilibrium,
    gap_marker,
    tax_wedge,
    C_DEMAND,
    C_SUPPLY,
    C_EQ,
    C_SHORT,
    C_SURPLUS,
    C_TAX,
    Q_EQ,
    P_EQ,
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
    TITLE_SIZE,
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
    RoundedRectangle,
    Circle,
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

STOPS = ["Demand", "Supply", "Equilibrium"]


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


def route_map(active: int | None = None):
    """Three stops (Demand → Supply → Equilibrium) as a horizontal route."""
    nodes = VGroup()
    dots = []
    labels = []
    xs = [-4.2, 0.0, 4.2]
    colors = [C_DEMAND, C_SUPPLY, C_EQ]
    for i, (x, name, col) in enumerate(zip(xs, STOPS, colors)):
        c = Circle(radius=0.28, color=col, fill_color=col, fill_opacity=0.25, stroke_width=4).move_to(RIGHT * x)
        lab = Text(name, font_size=LABEL_SIZE, color=col if active == i else INK_MUTED).next_to(c, DOWN, buff=0.3)
        dots.append(c)
        labels.append(lab)
        nodes.add(c, lab)
    conns = VGroup()
    for i in range(len(xs) - 1):
        conns.add(Line(RIGHT * (xs[i] + 0.35), RIGHT * (xs[i + 1] - 0.35), color=INK_SUBTLE, stroke_width=3))
    g = VGroup(conns, nodes)
    g.dots = dots
    g.labels = labels
    g.conns = conns
    g.move_to(UP * 0.4)
    return g


# ─── Cue00 : High-level map ──────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "How markets find a price — the route"
    cue_duration = 139.458

    def construct(self):
        rm = route_map()
        intro = Text("Three ideas, one picture", font_size=TITLE_SIZE, color=INK).move_to(UP * 2.6)
        self.play(Write(intro), run_time=2.5)
        wait_until(self, 8.0)
        for i in range(3):
            self.play(Create(rm.dots[i]), FadeIn(rm.labels[i], shift=UP * 0.2), run_time=2.0)
            if i < 2:
                self.play(Create(rm.conns[i]), run_time=1.5)
            wait_until(self, 16.0 + i * 12.0)
        wait_until(self, 58.0)
        # each stop lights in turn with a one-line gloss
        gloss = [
            "buyers: how much at each price",
            "sellers: how much at each price",
            "the price where they agree",
        ]
        # tie each gloss to its stop's accent color (rm.labels[i].color returns the
        # group default black, which is illegible on the near-black background)
        gloss_colors = [C_DEMAND, C_SUPPLY, C_EQ]
        for i in range(3):
            g = Text(gloss[i], font_size=BODY_SIZE, color=gloss_colors[i]).move_to(DOWN * 2.4)
            self.play(Indicate(rm.dots[i], color=rm.dots[i].color, scale_factor=1.3),
                      FadeIn(g, shift=UP * 0.2), run_time=2.2)
            wait_until(self, 72.0 + i * 16.0)
            self.play(FadeOut(g), run_time=1.2)
        wait_until(self, 122.0)
        preview = Text("next: draw the two curves and cross them", font_size=BODY_SIZE, color=INK_MUTED).move_to(DOWN * 2.4)
        self.play(FadeIn(preview), run_time=2.0)
        self.play(Indicate(rm.dots[2], color=C_EQ, scale_factor=1.3), run_time=2.0)
        self.guard(rm, intro, preview)
        pace_to(self, self.cue_duration)


# ─── Cue01 : Analogy — a workshop / market stall ─────────────────────────────
class Cue01(AvoScene):
    headline = "A market stall: buyers on one side, sellers on the other"
    cue_duration = 138.376

    def construct(self):
        title = Text("The price is where two crowds meet", font_size=TITLE_SIZE, color=INK).move_to(UP * 2.7)
        self.play(Write(title), run_time=2.5)
        wait_until(self, 8.0)
        buyers = RoundedRectangle(width=3.6, height=2.0, corner_radius=0.15, color=C_DEMAND, stroke_width=3).move_to(LEFT * 4.2 + DOWN * 0.3)
        b_lab = Text("Buyers", font_size=LABEL_SIZE, color=C_DEMAND).move_to(buyers.get_top() + DOWN * 0.4)
        b_note = Text("want low prices", font_size=BODY_SIZE, color=INK_MUTED).move_to(buyers.get_center() + DOWN * 0.3)
        self.play(Create(buyers), Write(b_lab), run_time=2.5)
        self.play(FadeIn(b_note), run_time=1.5)
        wait_until(self, 30.0)
        sellers = RoundedRectangle(width=3.6, height=2.0, corner_radius=0.15, color=C_SUPPLY, stroke_width=3).move_to(RIGHT * 4.2 + DOWN * 0.3)
        s_lab = Text("Sellers", font_size=LABEL_SIZE, color=C_SUPPLY).move_to(sellers.get_top() + DOWN * 0.4)
        s_note = Text("want high prices", font_size=BODY_SIZE, color=INK_MUTED).move_to(sellers.get_center() + DOWN * 0.3)
        self.play(Create(sellers), Write(s_lab), run_time=2.5)
        self.play(FadeIn(s_note), run_time=1.5)
        wait_until(self, 60.0)
        arrow_b = Arrow(buyers.get_right(), RIGHT * -0.7 + DOWN * 0.3, color=C_DEMAND, buff=0.1, stroke_width=4)
        arrow_s = Arrow(sellers.get_left(), RIGHT * 0.7 + DOWN * 0.3, color=C_SUPPLY, buff=0.1, stroke_width=4)
        self.play(Create(arrow_b), Create(arrow_s), run_time=2.5)
        wait_until(self, 80.0)
        price = Circle(radius=0.45, color=C_EQ, fill_color=C_EQ, fill_opacity=0.25, stroke_width=4).move_to(DOWN * 0.3)
        p_lab = Text("price", font_size=BODY_SIZE, color=C_EQ).move_to(price.get_center())
        self.play(Create(price), Write(p_lab), run_time=2.5)
        wait_until(self, 100.0)
        pull = Text("each side pulls; the price settles between them", font_size=BODY_SIZE, color=INK_MUTED).move_to(DOWN * 2.7)
        self.play(FadeIn(pull), run_time=2.0)
        self.play(Indicate(price, color=C_EQ, scale_factor=1.25), run_time=2.5)
        wait_until(self, 128.0)
        self.play(Indicate(arrow_b, color=C_DEMAND), Indicate(arrow_s, color=C_SUPPLY), run_time=2.0)
        self.guard(title, buyers, sellers, price, pull)
        pace_to(self, self.cue_duration)


# ─── Cue02 : Tiny example — one good, real numbers ───────────────────────────
class Cue02(AvoScene):
    headline = "One good: how many at $3, at $5, at $7"
    cue_duration = 139.458

    def construct(self):
        m = base_market()
        self.play(Create(m.axes_group), run_time=2.5)
        self.play(Create(m.demand), Create(m.supply), FadeIn(m.dlab), FadeIn(m.slab), run_time=3.0)
        wait_until(self, 18.0)
        # read three prices, showing Qd vs Qs at each
        rows = [(3.0, "3"), (5.0, "5"), (7.0, "7")]
        y0 = 2.9
        header = Text("price   buyers   sellers", font_size=BODY_SIZE, color=INK_MUTED).move_to(LEFT * 4.4 + UP * y0)
        self.play(FadeIn(header), run_time=1.5)
        for i, (p, plab) in enumerate(rows):
            pline = DashedLine(m.ax.c2p(0, p), m.ax.c2p(10, p), color=INK_SUBTLE, stroke_width=2, dash_length=0.1)
            dd = Dot(m.ax.c2p(econ.qd(p), p), color=C_DEMAND, radius=0.08)
            ds = Dot(m.ax.c2p(econ.qs(p), p), color=C_SUPPLY, radius=0.08)
            row = Text(f"${plab}      {econ.qd(p):.1f}        {econ.qs(p):.1f}", font_size=BODY_SIZE, color=INK).move_to(LEFT * 4.4 + UP * (y0 - 0.7 - i * 0.7))
            self.play(Create(pline), FadeIn(dd), FadeIn(ds), FadeIn(row), run_time=2.5)
            wait_until(self, 30.0 + i * 22.0)
        wait_until(self, 100.0)
        note = Text("at $5 the two match — the price", font_size=BODY_SIZE, color=C_EQ).move_to(DOWN * 3.0 + LEFT * 0.6)
        eq = equilibrium(m.ax, label=False)
        self.play(FadeIn(eq.dot, scale=0.4), Flash(eq.dot, color=C_EQ, line_length=0.3), FadeIn(note), run_time=3.0)
        wait_until(self, 128.0)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=2.5)
        self.guard(m, header, eq.dot, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : Mechanism — shortage & surplus push to the crossing ─────────────
class Cue03(AvoScene):
    headline = "The mechanism: gaps push the price to the crossing"
    cue_duration = 138.376

    def construct(self):
        m = base_market()
        eq = equilibrium(m.ax, label=False)
        self.play(Create(m), run_time=3.0)
        self.play(FadeIn(eq.dot, scale=0.4), run_time=1.5)
        wait_until(self, 20.0)
        # shortage
        gL = gap_marker(m.ax, 3.0, "shortage")
        up = econ.push_arrow(m.ax, 3.2, "up", C_SHORT)
        self.play(Create(gL.pline), Create(gL.arrow), FadeIn(gL.lab), FadeIn(gL.plab), run_time=3.0)
        self.play(Create(up), run_time=2.0)
        wait_until(self, 55.0)
        self.play(FadeOut(gL.pline), FadeOut(gL.arrow), FadeOut(gL.lab), FadeOut(gL.plab), FadeOut(up), run_time=1.5)
        # surplus
        gS = gap_marker(m.ax, 7.0, "surplus")
        down = econ.push_arrow(m.ax, 6.8, "down", C_SURPLUS)
        self.play(Create(gS.pline), Create(gS.arrow), FadeIn(gS.lab), FadeIn(gS.plab), run_time=3.0)
        self.play(Create(down), run_time=2.0)
        wait_until(self, 95.0)
        self.play(FadeOut(gS.pline), FadeOut(gS.arrow), FadeOut(gS.lab), FadeOut(gS.plab), FadeOut(down), run_time=1.5)
        settle = Text("gaps vanish only at the crossing", font_size=BODY_SIZE, color=C_EQ).move_to(DOWN * 3.0 + LEFT * 0.6)
        self.play(FadeIn(settle), Flash(eq.dot, color=C_EQ, line_length=0.3), run_time=3.0)
        wait_until(self, 128.0)
        self.play(Indicate(eq.dot, color=C_EQ, scale_factor=1.5), run_time=2.5)
        self.guard(m, eq.dot, settle)
        pace_to(self, self.cue_duration)


# ─── Cue04 : Implementation — the equations you can solve ────────────────────
class Cue04(AvoScene):
    headline = "In code: two lines, solve for the crossing"
    cue_duration = 139.458

    def construct(self):
        title = Text("Model it as two equations", font_size=TITLE_SIZE, color=INK).move_to(UP * 2.55)
        self.play(Write(title), run_time=2.5)
        wait_until(self, 8.0)
        dem = MathTex(r"\text{demand}(q) = 9 - 0.8\,q", color=C_DEMAND, font_size=44).move_to(UP * 1.4)
        sup = MathTex(r"\text{supply}(q) = 1 + 0.8\,q", color=C_SUPPLY, font_size=44).move_to(UP * 0.3)
        self.play(Write(dem), run_time=3.0)
        wait_until(self, 30.0)
        self.play(Write(sup), run_time=3.0)
        wait_until(self, 52.0)
        seteq = MathTex(r"9 - 0.8\,q = 1 + 0.8\,q", color=INK, font_size=44).move_to(DOWN * 1.0)
        self.play(Write(seteq), run_time=3.0)
        wait_until(self, 78.0)
        solve = MathTex(r"1.6\,q = 8 \;\Rightarrow\; q = 5", color=INK, font_size=44).move_to(DOWN * 2.1)
        self.play(Write(solve), run_time=3.0)
        wait_until(self, 104.0)
        ans = MathTex(r"Q^* = 5,\quad P^* = 5", color=C_EQ, font_size=48).move_to(DOWN * 3.2)
        self.play(Write(ans), run_time=3.0)
        wait_until(self, 128.0)
        self.play(Indicate(ans, color=C_EQ, scale_factor=1.15), run_time=2.5)
        self.guard(title, dem, sup, seteq, solve, ans)
        pace_to(self, self.cue_duration)


# ─── Cue05 : Misconception — nearby ideas kept apart ─────────────────────────
class Cue05(AvoScene):
    headline = "Keep nearby ideas apart"
    cue_duration = 138.376

    def construct(self):
        m = base_market()
        self.play(Create(m), run_time=3.0)
        wait_until(self, 12.0)
        # 1) equilibrium is the crossing, not the highest point
        eq = equilibrium(m.ax, label=False)
        wrong = Dot(m.ax.c2p(7.0, econ.supply(7.0)), color=ROSE, radius=0.1)
        w_lab = Text("not the highest point", font_size=BODY_SIZE, color=ROSE).move_to(DOWN * 3.0)
        self.play(FadeIn(wrong), FadeIn(w_lab), run_time=2.5)
        wait_until(self, 40.0)
        self.play(FadeIn(eq.dot, scale=0.4), Flash(eq.dot, color=C_EQ, line_length=0.3),
                  w_lab.animate.become(Text("the crossing is the price", font_size=BODY_SIZE, color=C_EQ).move_to(DOWN * 3.0)),
                  run_time=3.0)
        wait_until(self, 70.0)
        self.play(FadeOut(wrong), run_time=1.2)
        # 2) a surplus is a gap, not a curve shift
        gS = gap_marker(m.ax, 7.0, "surplus")
        note2 = Text("a surplus is a gap, not a new curve", font_size=BODY_SIZE, color=INK_MUTED).move_to(DOWN * 3.0 + LEFT * 0.6)
        self.play(Create(gS.pline), Create(gS.arrow), FadeIn(gS.lab),
                  w_lab.animate.become(note2), run_time=3.0)
        wait_until(self, 110.0)
        self.play(Indicate(gS.arrow, color=C_SURPLUS), Indicate(eq.dot, color=C_EQ, scale_factor=1.4), run_time=3.0)
        self.guard(m, eq.dot, gS)
        pace_to(self, self.cue_duration)


# ─── Cue06 : Synthesis — back to the route, on to practice ───────────────────
class Cue06(AvoScene):
    headline = "The whole route, ready for practice"
    cue_duration = 139.458

    def construct(self):
        rm = route_map()
        self.play(FadeIn(rm), run_time=3.0)
        wait_until(self, 12.0)
        for i in range(3):
            self.play(Indicate(rm.dots[i], color=rm.dots[i].color, scale_factor=1.3),
                      rm.labels[i].animate.set_color(rm.dots[i].color), run_time=2.5)
            wait_until(self, 22.0 + i * 12.0)
        wait_until(self, 62.0)
        recap = VGroup(
            Text("Demand slopes down · Supply slopes up", font_size=BODY_SIZE, color=INK_MUTED),
            Text("Equilibrium = the crossing, where the gap is zero", font_size=BODY_SIZE, color=INK_MUTED),
        ).arrange(DOWN, buff=0.35).move_to(DOWN * 2.0)
        self.play(FadeIn(recap[0]), run_time=2.5)
        wait_until(self, 88.0)
        self.play(FadeIn(recap[1]), run_time=2.5)
        wait_until(self, 112.0)
        go = Text("Now: three short parts + practice", font_size=LABEL_SIZE, color=C_EQ).move_to(DOWN * 3.2)
        self.play(Write(go), run_time=2.5)
        wait_until(self, 130.0)
        self.play(Indicate(rm.dots[2], color=C_EQ, scale_factor=1.3), run_time=2.5)
        self.guard(rm, recap, go)
        pace_to(self, self.cue_duration)
