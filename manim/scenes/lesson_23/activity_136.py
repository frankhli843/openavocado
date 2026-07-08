"""
Lesson 23 — Part 2 (activity 136): "0/1 Knapsack — a rolling row swept
descending" (79.54s, 6 short cues).

The concrete 0/1-knapsack walkthrough behind the orientation's "rolling array,
sweep descending." Capacity budget W = 7, two items X(weight 3, value 4) and
Y(weight 4, value 5). The 2D table collapses to a single rolling array dp[0..7]
where dp[w] is the best value within a weight budget of w. Each item sweeps
capacity HIGH → LOW so dp[w-weight] still holds the value from BEFORE this item
(the previous row), which is what keeps each item used at most once:

  init            dp = [0,0,0,0,0,0,0,0]
  item X (w3,v4)  w=7..3: dp[w]=max(dp[w], dp[w-3]+4)  → [0,0,0,4,4,4,4,4]
  item Y (w4,v5)  w=7..4: dp[w]=max(dp[w], dp[w-4]+5)  → [0,0,0,4,5,5,5,9]

dp[7] = 9 by taking X and Y (value 4 + 5, weight 3 + 4 = 7). Flip the sweep to
ASCENDING and the same code becomes unbounded knapsack, where one item can
repeat.

Uses arrays.py (value_row, recolor_cell, complexity) + dp.py (item_card,
sweep_arrow, choice_pair, C_STATE/C_TAKE/C_SKIP/C_ANSWER). MathTex only for the
recurrence and the one complexity bound.

Cue00 0-14.5    dp[w] = best value within a weight budget of w
Cue01 14.5-29.9 skip or take: dp[w] = max(dp[w], dp[w-weight] + value)
Cue02 29.9-45.8 the 2D table collapses to one rolling array
Cue03 45.8-61.7 sweep descending → each item lands at most once
Cue04 61.7-72.3 dp[7] = 9 by taking the weight-3 and weight-4 items
Cue05 72.3-79.5 flip ascending → unbounded knapsack, an item repeats
"""

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
)
from pacing import pace_to, elapsed
from arrays import value_row, recolor_cell, complexity
from dp import item_card, sweep_arrow, choice_pair, C_STATE, C_TAKE, C_SKIP, C_ANSWER
from bayes import fit_label, chip
from manim import (
    VGroup,
    Text,
    MathTex,
    Arrow,
    FadeIn,
    FadeOut,
    Write,
    Transform,
    Indicate,
    Circumscribe,
    RIGHT,
    LEFT,
    UP,
    DOWN,
)

DP_INIT = [0, 0, 0, 0, 0, 0, 0, 0]
DP_AFTER_X = [0, 0, 0, 4, 4, 4, 4, 4]
DP_FINAL = [0, 0, 0, 4, 5, 5, 5, 9]
DP_Y = -0.2
CW = 0.82
GAP = 0.16


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_dp(values, y=DP_Y):
    row = value_row(values, color=INK_SUBTLE, w=CW, h=CW, fs=28, gap=GAP, index=True)
    row.move_to([0, y, 0])
    lab = Text("dp", font_size=22, color=INK_MUTED, weight="BOLD").next_to(row, LEFT, buff=0.3)
    cap = Text("capacity w", font_size=19, color=INK_SUBTLE)
    cap.next_to(row, DOWN, buff=0.42)
    return row, lab, cap


def build_items(active=None):
    """Two item cards X, Y placed top-left / top-right. active in {'X','Y',None}."""
    x = item_card(3, 4, name="item X", color=(C_STATE if active == "X" else INK_SUBTLE))
    y = item_card(4, 5, name="item Y", color=(C_STATE if active == "Y" else INK_SUBTLE))
    x.move_to([-3.7, 1.95, 0])
    y.move_to([3.7, 1.95, 0])
    return x, y


# ─── Cue00 : the state ───────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "dp[w]: the best value within a weight budget of w"
    cue_duration = 14.5

    def construct(self):
        x, y = build_items()
        self.play(FadeIn(x), FadeIn(y), run_time=1.4)
        wait_until(self, 3.0)

        row, lab, cap = build_dp(DP_INIT)
        self.play(FadeIn(row), FadeIn(lab), run_time=1.4)
        self.play(FadeIn(cap), run_time=0.8)
        wait_until(self, 8.0)

        # spotlight one cell — dp[5] "best value if the budget is 5"
        recolor_cell(row.cells[5], C_STATE)
        note = fit_label("each cell = the best total value you can pack within that budget",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(Indicate(row.cells[5], color=C_STATE, scale_factor=1.15), FadeIn(note), run_time=1.6)
        self.guard(x, y, row, cap, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : skip or take ────────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Skip or take — the either-or transition"
    cue_duration = 15.4

    def construct(self):
        x, y = build_items(active="Y")
        row, lab, cap = build_dp(DP_AFTER_X)   # after item X, now deciding item Y
        self.add(x, y, row, lab, cap)
        wait_until(self, 1.5)

        rec = MathTex(
            r"\text{dp}[w]", r"=\max\big(", r"\text{dp}[w]", r",\;",
            r"\text{dp}[w-\text{wt}] + \text{val}", r"\big)",
        ).scale(0.82).move_to([0, 1.0, 0])
        rec[2].set_color(C_SKIP)      # skip → keep dp[w]
        rec[4].set_color(C_TAKE)      # take → dp[w-wt]+val
        self.play(Write(rec), run_time=2.0)
        wait_until(self, 6.0)

        pair = choice_pair("skip:  keep dp[w]", "take:  dp[w−4] + 5").scale(0.9)
        pair.move_to([0, -1.9, 0])
        self.play(FadeIn(pair.a), FadeIn(pair.picker), FadeIn(pair.b), run_time=1.6)
        self.play(Indicate(rec[2], color=C_SKIP, scale_factor=1.15), Indicate(pair.a, color=C_SKIP), run_time=1.1)
        self.play(Indicate(rec[4], color=C_TAKE, scale_factor=1.15), Indicate(pair.b, color=C_TAKE), run_time=1.1)
        self.guard(x, y, row, rec, pair)
        pace_to(self, self.cue_duration)


# ─── Cue02 : roll the row ────────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "The 2D table collapses to one rolling array"
    cue_duration = 15.9

    def construct(self):
        # two stacked rows (prev item / this item) fold into one
        prev = value_row(DP_INIT, color=INK_SUBTLE, w=CW, h=0.7, fs=24, gap=GAP, index=False)
        cur = value_row(DP_AFTER_X, color=ACCENT, w=CW, h=0.7, fs=24, gap=GAP, index=False)
        prev.move_to([0, 1.35, 0])
        cur.move_to([0, 0.35, 0])
        pl = Text("row i−1", font_size=20, color=INK_SUBTLE).next_to(prev, LEFT, buff=0.3)
        cl = Text("row i", font_size=20, color=ACCENT).next_to(cur, LEFT, buff=0.3)
        self.play(FadeIn(prev), FadeIn(cur), FadeIn(pl), FadeIn(cl), run_time=1.6)
        wait_until(self, 4.0)

        note = fit_label("the transition only reads the previous row — dp[w] and dp[w−wt]",
                         12.6, 22, INK).move_to([0, -1.1, 0])
        self.play(FadeIn(note), run_time=1.4)
        wait_until(self, 8.5)

        # fold: fade prev, move cur to center as the single rolling array
        single, lab, cap = build_dp(DP_AFTER_X, y=0.35)
        self.play(FadeOut(prev), FadeOut(pl), run_time=1.0)
        self.play(Transform(cur, single), Transform(cl, lab), run_time=1.4)
        one = fit_label("so one array, reused in place, is enough", 11.0, 23, EMERALD).to_edge(DOWN, buff=0.5)
        self.play(FadeOut(note), FadeIn(one), FadeIn(cap), run_time=1.2)
        self.guard(cur, one, cap)
        pace_to(self, self.cue_duration)


# ─── Cue03 : sweep descending ────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Sweep high → low keeps each item use-once"
    cue_duration = 15.9

    def construct(self):
        x, _ = build_items(active="X")
        x.move_to([-4.8, 1.9, 0])
        row, lab, cap = build_dp(DP_INIT, y=0.1)
        self.add(x, row, lab, cap)
        arr = sweep_arrow(row, descending=True, label="w = 7 → 3  (descending)")
        self.play(FadeIn(arr), run_time=1.4)
        wait_until(self, 3.0)

        # apply item X descending → dp[3..7] = 4
        after = build_dp(DP_AFTER_X, y=0.1)[0]
        for i in range(3, 8):
            recolor_cell(after.cells[i], C_TAKE)
        self.play(Transform(row, after), run_time=1.6)
        why = fit_label("dp[w−3] still holds the value from BEFORE item X — so X lands once",
                        12.8, 22, INK).move_to([0, -1.55, 0])
        self.play(FadeIn(why), run_time=1.4)
        wait_until(self, 9.0)

        warn = fit_label("sweep ascending instead and dp[6] = dp[3] + 4 would pack X twice",
                         12.8, 21, ROSE).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(warn), run_time=1.4)
        self.guard(row, arr, why, warn)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the answer ──────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "dp[7] = 9 — take the weight-3 and weight-4 items"
    cue_duration = 10.6

    def construct(self):
        # both items chosen → recolor their cards emerald
        x2, y2 = build_items()
        x2.box.set_stroke(C_ANSWER, 3.0); x2.box.set_fill(C_ANSWER, 0.12)
        y2.box.set_stroke(C_ANSWER, 3.0); y2.box.set_fill(C_ANSWER, 0.12)
        row, lab, cap = build_dp(DP_FINAL, y=0.1)
        self.add(x2, y2, row, lab, cap)
        wait_until(self, 1.5)

        recolor_cell(row.cells[7], C_ANSWER)
        box = MathTex(r"4 + 5 = ", "9", color=INK).scale(0.95).move_to([0, -1.7, 0])
        box[1].set_color(C_ANSWER)
        self.play(Indicate(row.cells[7], color=C_ANSWER, scale_factor=1.2), Write(box), run_time=1.8)
        self.play(Circumscribe(row.cells[7], color=EMERALD), run_time=1.2)
        note = fit_label("weight 3 + 4 = 7 fits the budget exactly", 11.0, 22, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(x2, y2, row, box, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the flip ────────────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Flip to ascending → unbounded knapsack"
    cue_duration = 7.2

    def construct(self):
        row, lab, cap = build_dp(DP_FINAL, y=0.4)
        self.add(row, lab)
        arr = sweep_arrow(row, descending=False, label="w = low → high  (ascending)")
        self.play(FadeIn(arr), run_time=1.2)
        note = fit_label("the same code, opposite direction — now a single item can repeat",
                         12.8, 22, INK).move_to([0, -1.2, 0])
        self.play(FadeIn(note), run_time=1.2)
        bound = MathTex(r"\text{time } ", r"O(n\cdot W)", r"\qquad \text{space } ", "O(W)", color=INK).scale(0.9)
        bound.to_edge(DOWN, buff=0.5)
        bound[1].set_color(EMERALD)
        bound[3].set_color(EMERALD)
        self.play(Write(bound), run_time=1.2)
        self.guard(row, arr, note, bound)
        pace_to(self, self.cue_duration)
