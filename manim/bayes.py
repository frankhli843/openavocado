"""
Reusable Bayes' Theorem visual idioms for Lesson 2 (parts 10 / 11 / 52).

3Blue1Brown-style building blocks shared across the three Bayes lesson_part
segments, so each cue scene composes from a consistent vocabulary rather than
re-inventing shapes: a population icon-grid, a prior tree split, the
prior→likelihood→posterior "spine", stat rows, and small chips/labels. Every
helper honors theme.py (dark stage, site accent hues, safe-area guard) and
returns plain VGroups the cue scenes stage, transform, and highlight.

Colors (semantic, reused across all three parts so the eye learns them):
  SICK / hypothesis-true      → AMBER   (the rare thing we test for)
  HEALTHY / hypothesis-false  → ACCENT  (the common background population)
  TRUE POSITIVE               → EMERALD (correct catch)
  FALSE POSITIVE              → ROSE    (the base-rate trap)
"""

from __future__ import annotations

from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Text,
    MathTex,
    Line,
    Dot,
    Arrow,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
)

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
    STAGE_W,
    STAGE_H,
)

# Semantic role colors for Bayes (shared across parts).
C_SICK = AMBER
C_HEALTHY = ACCENT
C_TP = EMERALD
C_FP = ROSE
C_POST = VIOLET


# ─── tiny text/shape helpers ─────────────────────────────────────────────────
def fit_label(text: str, max_w: float, fs: int = 24, color=INK, weight="NORMAL") -> Text:
    t = Text(text, font_size=fs, color=color, weight=weight)
    if t.width > max_w and t.width > 0:
        t.scale(max_w / t.width)
    return t


def chip(label: str, color=ACCENT, w=2.6, h=1.05, fs=24, fill=0.12) -> VGroup:
    box = RoundedRectangle(
        width=w, height=h, corner_radius=0.14,
        stroke_color=color, stroke_width=2.4, fill_color=color, fill_opacity=fill,
    )
    t = fit_label(label, w - 0.3, fs, INK).move_to(box.get_center())
    return VGroup(box, t)


def stat_row(name: str, value: str, name_color=INK_MUTED, val_color=INK, fs=26) -> VGroup:
    n = Text(name, font_size=fs, color=name_color)
    v = Text(value, font_size=fs, color=val_color, weight="BOLD")
    v.next_to(n, RIGHT, buff=0.28)
    return VGroup(n, v)


# ─── population icon grid (N people) ─────────────────────────────────────────
class PopGrid(VGroup):
    """
    An n_rows × n_cols grid of person-dots. Dots are stored row-major in
    `self.dots` (a flat list) so scenes can recolor arbitrary subsets to mark
    sick vs healthy vs true/false positives.
    """

    def __init__(self, n_rows=10, n_cols=10, r=0.12, gap=0.32, base_color=INK_SUBTLE):
        super().__init__()
        self.dots = []
        for i in range(n_rows):
            for j in range(n_cols):
                d = Dot(radius=r, color=base_color, fill_opacity=0.9)
                d.move_to(RIGHT * j * gap + DOWN * i * gap)
                self.dots.append(d)
                self.add(d)
        self.center()
        self.n_rows, self.n_cols = n_rows, n_cols

    def color_indices(self, indices, color, opacity=1.0):
        for k in indices:
            self.dots[k].set_color(color).set_fill(color, opacity=opacity)

    def recolor_all(self, color, opacity=0.9):
        for d in self.dots:
            d.set_color(color).set_fill(color, opacity=opacity)


def person_dot(color=INK_SUBTLE, r=0.12) -> Dot:
    return Dot(radius=r, color=color, fill_opacity=0.9)


# ─── prior tree split (population → sick / healthy branches) ──────────────────
def prior_tree(total_label="100 people", sick_label="Sick", healthy_label="Healthy",
               sick_frac=0.08, root_color=INK, sick_color=C_SICK, healthy_color=C_HEALTHY):
    """
    A root node that splits into two branches whose *box heights* encode the
    prior: the sick branch is drawn small, the healthy branch large. Returns a
    VGroup with named attributes: .root, .sick, .healthy, .edge_sick,
    .edge_healthy so scenes can highlight parts.
    """
    root = chip(total_label, color=root_color, w=3.2, h=1.0, fs=26)
    root.move_to(LEFT * 4.2)

    # branch box heights encode the prior (min height so labels fit).
    h_sick = max(0.9, 3.2 * sick_frac)
    h_healthy = max(1.1, 3.2 * (1 - sick_frac))
    sick = RoundedRectangle(width=3.0, height=h_sick, corner_radius=0.12,
                            stroke_color=sick_color, stroke_width=2.6,
                            fill_color=sick_color, fill_opacity=0.16)
    healthy = RoundedRectangle(width=3.0, height=h_healthy, corner_radius=0.12,
                               stroke_color=healthy_color, stroke_width=2.6,
                               fill_color=healthy_color, fill_opacity=0.16)
    sick.move_to(RIGHT * 3.2 + UP * 1.9)
    healthy.move_to(RIGHT * 3.2 + DOWN * 1.4)

    s_lab = fit_label(sick_label, 2.6, 24, INK).move_to(sick.get_center())
    h_lab = fit_label(healthy_label, 2.6, 24, INK).move_to(healthy.get_center())

    edge_sick = Line(root.get_right(), sick.get_left(), color=sick_color, stroke_width=2.6)
    edge_healthy = Line(root.get_right(), healthy.get_left(), color=healthy_color, stroke_width=2.6)

    g = VGroup(root, edge_sick, edge_healthy,
               VGroup(sick, s_lab), VGroup(healthy, h_lab))
    g.root = root
    g.sick = VGroup(sick, s_lab)
    g.healthy = VGroup(healthy, h_lab)
    g.edge_sick = edge_sick
    g.edge_healthy = edge_healthy
    return g


# ─── prior → likelihood → posterior spine ────────────────────────────────────
def bayes_spine(fs=24, y=0.0):
    """
    Three chips connected by arrows: Prior → (×Likelihood) → Posterior. Returns
    a VGroup with .prior, .like, .post, .a1, .a2 attributes.
    """
    prior = chip("Prior", color=C_HEALTHY, w=3.0, h=1.0, fs=fs)
    like = chip("× Likelihood", color=C_SICK, w=3.4, h=1.0, fs=fs)
    post = chip("Posterior", color=C_POST, w=3.0, h=1.0, fs=fs)
    prior.move_to(LEFT * 4.6 + UP * y)
    like.move_to(ORIGIN + UP * y)
    post.move_to(RIGHT * 4.6 + UP * y)
    a1 = Arrow(prior.get_right(), like.get_left(), buff=0.12, color=INK_MUTED, stroke_width=3)
    a2 = Arrow(like.get_right(), post.get_left(), buff=0.12, color=INK_MUTED, stroke_width=3)
    g = VGroup(prior, a1, like, a2, post)
    g.prior, g.like, g.post, g.a1, g.a2 = prior, like, post, a1, a2
    return g


def bayes_formula(size=48):
    """The posterior form of Bayes' theorem as MathTex (correct, legible)."""
    return MathTex(
        r"P(H\mid E)=\frac{P(E\mid H)\,P(H)}{P(E)}",
        font_size=size, color=INK,
    )


def posterior_ratio(size=44):
    """Posterior = true positives / (true positives + false positives)."""
    return MathTex(
        r"P(\text{sick}\mid +)=\frac{\text{TP}}{\text{TP}+\text{FP}}",
        font_size=size, color=INK,
    )


# ─── 2×2 diagnostic confusion matrix (Part 2 centerpiece) ────────────────────
def _cm_cell(label: str, color, count: str | None, w: float, h: float, fs: int) -> VGroup:
    box = RoundedRectangle(
        width=w, height=h, corner_radius=0.1,
        stroke_color=color, stroke_width=2.6, fill_color=color, fill_opacity=0.14,
    )
    lab = Text(label, font_size=fs, color=color, weight="BOLD")
    if count is not None:
        cnt = Text(count, font_size=fs + 8, color=INK, weight="BOLD")
        stack = VGroup(lab, cnt).arrange(DOWN, buff=0.12).move_to(box.get_center())
    else:
        stack = VGroup(lab).move_to(box.get_center())
    g = VGroup(box, stack)
    g.box = box
    return g


def confusion_matrix(cell_w=2.6, cell_h=1.35, fs=24, counts=None):
    """
    A 2×2 diagnostic confusion matrix.
      columns = actual state  (Sick / Healthy)
      rows    = test result   (Test + / Test −)
    Cells: TP emerald (top-left), FP rose (top-right),
           FN muted   (bottom-left), TN accent (bottom-right).

    `counts`, if given, is a dict like {'tp':'1','fp':'5','fn':'0','tn':'94'}
    that adds a bold count under each cell's label.

    Returns a VGroup with named attrs: .tp .fp .fn .tn (each a cell VGroup with
    a .box), .col_sick .col_healthy (column headers), .row_pos .row_neg (row
    headers), and .body (the four cells), so scenes highlight exactly one part.
    """
    counts = counts or {}
    hx = cell_w / 2 + 0.06   # half horizontal cell pitch (small gap)
    hy = cell_h / 2 + 0.06

    tp = _cm_cell("TP", C_TP, counts.get("tp"), cell_w, cell_h, fs).move_to(LEFT * hx + UP * hy)
    fp = _cm_cell("FP", C_FP, counts.get("fp"), cell_w, cell_h, fs).move_to(RIGHT * hx + UP * hy)
    fn = _cm_cell("FN", INK_MUTED, counts.get("fn"), cell_w, cell_h, fs).move_to(LEFT * hx + DOWN * hy)
    tn = _cm_cell("TN", C_HEALTHY, counts.get("tn"), cell_w, cell_h, fs).move_to(RIGHT * hx + DOWN * hy)
    body = VGroup(tp, fp, fn, tn)

    col_sick = fit_label("Actually Sick", cell_w, 22, C_SICK, "BOLD")
    col_sick.move_to([tp.get_center()[0], body.get_top()[1] + 0.36, 0])
    col_healthy = fit_label("Actually Healthy", cell_w, 22, C_HEALTHY, "BOLD")
    col_healthy.move_to([fp.get_center()[0], body.get_top()[1] + 0.36, 0])

    row_pos = fit_label("Test +", 1.7, 22, INK, "BOLD")
    row_pos.move_to([body.get_left()[0] - 1.15, tp.get_center()[1], 0])
    row_neg = fit_label("Test −", 1.7, 22, INK_MUTED, "BOLD")
    row_neg.move_to([body.get_left()[0] - 1.15, fn.get_center()[1], 0])

    g = VGroup(body, col_sick, col_healthy, row_pos, row_neg)
    g.tp, g.fp, g.fn, g.tn = tp, fp, fn, tn
    g.body = body
    g.col_sick, g.col_healthy = col_sick, col_healthy
    g.row_pos, g.row_neg = row_pos, row_neg
    return g


def sensitivity_formula(size=32):
    """Sensitivity = TP / (TP + FN) = P(+ | sick)."""
    return MathTex(
        r"\text{sensitivity}=\frac{\text{TP}}{\text{TP}+\text{FN}}=P(+\mid \text{sick})",
        font_size=size, color=INK,
    )


def specificity_formula(size=32):
    """Specificity = TN / (TN + FP) = P(− | healthy)."""
    return MathTex(
        r"\text{specificity}=\frac{\text{TN}}{\text{TN}+\text{FP}}=P(-\mid \text{healthy})",
        font_size=size, color=INK,
    )
