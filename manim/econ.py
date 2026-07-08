"""
AvocadoCore Manim econ idioms — Lesson 3 (Supply, Demand, and Equilibrium).

Shared price–quantity diagram vocabulary reused by activity_{14,17,18,53}: a
price (y) vs quantity (x) axis, a downward-sloping demand line (blue = buyers),
an upward-sloping supply line (amber = sellers), their crossing = equilibrium
(P*, Q*, green), plus shortage/surplus gap markers at an off-equilibrium price
and a per-unit tax wedge that splits the price buyers pay from what sellers
receive. One fixed linear market is reused across every cue so the geometry is
consistent lesson-wide and every diagram is directly comparable:

    demand(q) = 9 - 0.8 q      supply(q) = 1 + 0.8 q
    equilibrium: Q* = 5, P* = 5
    shortage @ P=3 : Qd 7.5 > Qs 2.5   (gap 5, price pressed up)
    surplus  @ P=7 : Qs 7.5 > Qd 2.5   (gap 5, price pressed down)
    per-unit tax 2 : Q 3.75, buyer pays 6, seller keeps 4  (wedge = 2)

Every helper returns a VGroup with named attributes so scenes can highlight the
exact element the narration is discussing.
"""

from __future__ import annotations

from manim import (
    Axes,
    Dot,
    DashedLine,
    Line,
    DoubleArrow,
    Arrow,
    VGroup,
    Text,
    MathTex,
    Polygon,
    Brace,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    BOLD,
)

import theme
from theme import (
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

# ─── the one fixed linear market ─────────────────────────────────────────────
SLOPE = 0.8
D_INT = 9.0
S_INT = 1.0


def demand(q: float) -> float:
    return D_INT - SLOPE * q


def supply(q: float) -> float:
    return S_INT + SLOPE * q


def qd(p: float) -> float:
    """Quantity demanded at price p (inverse demand)."""
    return (D_INT - p) / SLOPE


def qs(p: float) -> float:
    """Quantity supplied at price p (inverse supply)."""
    return (p - S_INT) / SLOPE


Q_EQ, P_EQ = 5.0, 5.0
# per-unit tax of 2: D(Q)-S(Q)=2 -> Q=3.75, buyer pays 6, seller keeps 4.
Q_TAX, P_BUY, P_SELL = 3.75, 6.0, 4.0

# semantic channel colors
C_DEMAND = ACCENT      # blue  = demand / buyers
C_SUPPLY = AMBER       # amber = supply / sellers
C_EQ = EMERALD         # green = equilibrium
C_SHORT = ROSE         # rose  = shortage
C_SURPLUS = VIOLET     # violet = surplus
C_TAX = ROSE           # rose  = tax wedge


# ─── axes ────────────────────────────────────────────────────────────────────
def market_axes(x_length: float = 7.6, y_length: float = 5.0) -> VGroup:
    """Price(y) vs Quantity(x) axes with clean unlabeled ticks and word labels."""
    ax = Axes(
        x_range=[0, 10, 2],
        y_range=[0, 10, 2],
        x_length=x_length,
        y_length=y_length,
        axis_config={
            "color": INK_SUBTLE,
            "stroke_width": 2.5,
            "include_ticks": True,
            "include_numbers": False,
        },
        tips=False,
    )
    xlab = Text("Quantity", font_size=BODY_SIZE, color=INK_MUTED)
    xlab.next_to(ax.x_axis.get_right(), DOWN, buff=0.22)
    ylab = Text("Price", font_size=BODY_SIZE, color=INK_MUTED)
    ylab.next_to(ax.y_axis.get_top(), RIGHT, buff=0.18)
    g = VGroup(ax, xlab, ylab)
    g.ax = ax
    g.xlab = xlab
    g.ylab = ylab
    return g


# ─── curves ──────────────────────────────────────────────────────────────────
def demand_curve(ax: Axes, color: str = C_DEMAND, q0: float = 0.55, q1: float = 9.9) -> Line:
    return ax.plot(lambda q: demand(q), x_range=[q0, q1], color=color, stroke_width=5)


def supply_curve(ax: Axes, color: str = C_SUPPLY, q0: float = 0.2, q1: float = 9.6) -> Line:
    return ax.plot(lambda q: supply(q), x_range=[q0, q1], color=color, stroke_width=5)


def demand_shifted(ax: Axes, dq: float, color: str = ACCENT_LIGHT,
                   q0: float = 0.55, q1: float = 9.9) -> Line:
    """Demand shifted right (dq>0 = more demand at every price)."""
    return ax.plot(lambda q: demand(q - dq), x_range=[max(0.2, q0 + dq), q1], color=color, stroke_width=5)


def curve_label(ax: Axes, text: str, q: float, color: str, direction=UP, buff: float = 0.22) -> Text:
    p = demand(q) if text.lower().startswith("d") else supply(q)
    lab = Text(text, font_size=LABEL_SIZE, color=color, weight=BOLD)
    lab.next_to(ax.c2p(q, p), direction, buff=buff)
    return lab


# ─── equilibrium ─────────────────────────────────────────────────────────────
def equilibrium(ax: Axes, color: str = C_EQ, label: bool = True) -> VGroup:
    pt = ax.c2p(Q_EQ, P_EQ)
    dot = Dot(pt, color=color, radius=0.11)
    vline = DashedLine(ax.c2p(Q_EQ, 0), pt, color=color, stroke_width=2.5, dash_length=0.12)
    hline = DashedLine(ax.c2p(0, P_EQ), pt, color=color, stroke_width=2.5, dash_length=0.12)
    g = VGroup(vline, hline, dot)
    g.dot = dot
    g.vline = vline
    g.hline = hline
    if label:
        qstar = MathTex("Q^*", color=color, font_size=36).next_to(ax.c2p(Q_EQ, 0), DOWN, buff=0.18)
        pstar = MathTex("P^*", color=color, font_size=36).next_to(ax.c2p(0, P_EQ), LEFT, buff=0.18)
        g.add(qstar, pstar)
        g.qstar = qstar
        g.pstar = pstar
    return g


# ─── shortage / surplus gap ──────────────────────────────────────────────────
def gap_marker(ax: Axes, p: float, kind: str) -> VGroup:
    """
    At off-equilibrium price p, mark the horizontal distance between the supply
    point (Qs) and the demand point (Qd). kind ∈ {"shortage","surplus"}. The
    double-arrow spans the gap; a colored label names it; a dashed price line
    and two curve dots anchor it to the two curves.
    """
    color = C_SHORT if kind == "shortage" else C_SURPLUS
    x_s, x_d = qs(p), qd(p)
    lo, hi = sorted([x_s, x_d])
    pline = DashedLine(ax.c2p(0, p), ax.c2p(hi, p), color=INK_MUTED, stroke_width=2, dash_length=0.1)
    dot_s = Dot(ax.c2p(x_s, p), color=C_SUPPLY, radius=0.08)
    dot_d = Dot(ax.c2p(x_d, p), color=C_DEMAND, radius=0.08)
    arrow = DoubleArrow(ax.c2p(lo, p), ax.c2p(hi, p), color=color, buff=0.02,
                        stroke_width=5, tip_length=0.2)
    lab = Text(kind.capitalize(), font_size=LABEL_SIZE, color=color, weight=BOLD)
    lab.next_to(arrow, UP, buff=0.16)
    plab = MathTex(f"P = {int(p)}", color=INK_MUTED, font_size=30).next_to(ax.c2p(0, p), LEFT, buff=0.18)
    g = VGroup(pline, arrow, dot_s, dot_d, lab, plab)
    g.pline = pline
    g.arrow = arrow
    g.dot_s = dot_s
    g.dot_d = dot_d
    g.lab = lab
    g.plab = plab
    return g


def push_arrow(ax: Axes, p_from: float, direction: str, color: str) -> Arrow:
    """Vertical arrow on the price axis showing pressure back toward equilibrium."""
    dy = 1.1 if direction == "up" else -1.1
    a = Arrow(ax.c2p(0.35, p_from), ax.c2p(0.35, p_from + dy), color=color,
              buff=0, stroke_width=6, tip_length=0.25)
    return a


# ─── tax wedge ───────────────────────────────────────────────────────────────
def tax_wedge(ax: Axes) -> VGroup:
    """
    Vertical wedge at Q_TAX between the demand curve (price buyers pay) and the
    supply curve (price sellers keep). The gap = the per-unit tax.
    """
    top = ax.c2p(Q_TAX, P_BUY)
    bot = ax.c2p(Q_TAX, P_SELL)
    wedge = Line(bot, top, color=C_TAX, stroke_width=7)
    buyer_dot = Dot(top, color=C_DEMAND, radius=0.09)
    seller_dot = Dot(bot, color=C_SUPPLY, radius=0.09)
    qline = DashedLine(ax.c2p(Q_TAX, 0), bot, color=INK_SUBTLE, stroke_width=2, dash_length=0.1)
    brace = Brace(wedge, LEFT, color=C_TAX, buff=0.12)
    tlab = brace.get_tex(r"\text{tax}").set_color(C_TAX).scale(1.15)
    tlab.next_to(brace, LEFT, buff=0.12)
    buyer_lab = Text("Buyer pays", font_size=22, color=C_DEMAND).next_to(top, UP, buff=0.14)
    seller_lab = Text("Seller keeps", font_size=22, color=C_SUPPLY).next_to(bot, DOWN, buff=0.14)
    g = VGroup(qline, wedge, buyer_dot, seller_dot, brace, tlab, buyer_lab, seller_lab)
    g.qline = qline
    g.wedge = wedge
    g.buyer_dot = buyer_dot
    g.seller_dot = seller_dot
    g.brace = brace
    g.tlab = tlab
    g.buyer_lab = buyer_lab
    g.seller_lab = seller_lab
    return g


def burden_split(ax: Axes) -> VGroup:
    """Two braces at Q_TAX: the buyer's share (P* → P_BUY, up) and the seller's
    share (P_SELL → P*, down). Reads the incidence off the wedge."""
    x = Q_TAX
    top = ax.c2p(x, P_BUY)
    mid = ax.c2p(x, P_EQ)
    bot = ax.c2p(x, P_SELL)
    b_line = Line(mid, top, color=C_DEMAND, stroke_width=6)
    s_line = Line(bot, mid, color=C_SUPPLY, stroke_width=6)
    b_brace = Brace(b_line, RIGHT, color=C_DEMAND, buff=0.1)
    s_brace = Brace(s_line, RIGHT, color=C_SUPPLY, buff=0.1)
    b_lab = b_brace.get_text("buyer's share").set_color(C_DEMAND)
    s_lab = s_brace.get_text("seller's share").set_color(C_SUPPLY)
    for lab in (b_lab, s_lab):
        lab.scale(0.7)
    pstar = DashedLine(ax.c2p(0, P_EQ), mid, color=C_EQ, stroke_width=2, dash_length=0.1)
    g = VGroup(pstar, b_line, s_line, b_brace, s_brace, b_lab, s_lab)
    g.pstar = pstar
    g.b_brace = b_brace
    g.s_brace = s_brace
    g.b_lab = b_lab
    g.s_lab = s_lab
    return g


def steep_demand(ax: Axes, color: str = ACCENT_LIGHT, q0: float = 3.0, q1: float = 6.6) -> Line:
    """A steeper (more inelastic) demand line through equilibrium (5,5): buyers
    barely respond to price, so they bear more of a tax. Slope -2.5."""
    return ax.plot(lambda q: 5.0 - 2.5 * (q - Q_EQ), x_range=[q0, q1], color=color, stroke_width=4)
