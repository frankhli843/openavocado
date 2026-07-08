"""
Lesson 23 — Orientation (activity 134): "DP reactivation — the four decisions at
speed" (850.32s, 8 long cues).

The high-level map for the whole lesson: DP is a strong-but-stale pattern, so the
goal is RECALL SPEED — write the right recurrence from memory in under two
minutes. Every DP is the same four decisions in the same order (state,
recurrence, order, base); the rest of the lesson drills three concrete machines
(Kadane, 0/1 knapsack, and the ascending-sweep flip to coin change / unbounded)
plus LIS and the four classic traps.

These are long orientation cues (≈60-130s each). Each stages a handful of beats
over the first ~15-25s and then holds a rich settled frame while the narration
talks over it — the highlight-sync design pins each chunk to its cue window so
the concatenated segment lines up with the audio.

Uses dp.py (decisions_ledger, item_card, sweep_arrow, choice_pair) + arrays.py
(value_row, recolor_cell, complexity) + bayes.chip/fit_label. MathTex only for
recurrences and complexity bounds.

Cue00 0-103.3      reactivation: you know DP; rebuild the speed (< 2 min recall)
Cue01 103.3-212.6  the four decisions: state, recurrence, order, base
Cue02 212.6-340.1  the state sentence is exact — vague vs "ending exactly at i"
Cue03 340.1-461.6  Kadane: a running scalar, extend or restart
Cue04 461.6-583.1  0/1 knapsack: rolling array, sweep descending
Cue05 583.1-680.3  direction flip: ascending allows reuse (coin change)
Cue06 680.3-789.6  LIS: dp-ends-at-i (n^2) or patience tails + binary search
Cue07 789.6-850.3  the traps: order, base, vague state, unreachable sentinel
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
)
from pacing import pace_to, elapsed
from arrays import value_row, recolor_cell, complexity, window_bracket
from dp import (
    decisions_ledger,
    highlight_decision,
    item_card,
    sweep_arrow,
    choice_pair,
    C_STATE,
    C_TAKE,
    C_SKIP,
    C_ANSWER,
    C_DISCARD,
)
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


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : reactivation ────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "You know DP; rebuild the speed"
    cue_duration = 103.3

    def construct(self):
        title = Text("Dynamic Programming", font_size=44, color=INK, weight="BOLD").move_to([0, 1.7, 0])
        tag = Text("a strong but stale pattern", font_size=26, color=INK_MUTED).next_to(title, DOWN, buff=0.3)
        self.play(Write(title), run_time=1.6)
        self.play(FadeIn(tag), run_time=1.0)
        wait_until(self, 5.0)

        goal = chip("goal: recall speed", color=ACCENT, w=5.2, h=1.1, fs=28).move_to([0, -0.4, 0])
        self.play(FadeIn(goal, shift=UP * 0.2), run_time=1.4)
        wait_until(self, 9.5)

        target = MathTex(r"\text{right recurrence from memory} \;<\; 2\text{ min}",
                         color=EMERALD).scale(0.8).move_to([0, -2.1, 0])
        self.play(Write(target), run_time=1.8)
        self.play(Circumscribe(target, color=EMERALD), run_time=1.2)
        self.guard(title, tag, goal, target)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the four decisions ──────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "State, recurrence, order, base"
    cue_duration = 109.3

    def construct(self):
        ledger = decisions_ledger(w=8.4)
        ledger.move_to([0, -0.1, 0])
        self.play(FadeIn(ledger.rows[0], shift=UP * 0.15), run_time=1.3)
        wait_until(self, 4.0)
        for k in range(1, 4):
            self.play(FadeIn(ledger.rows[k], shift=UP * 0.15), run_time=1.2)
            wait_until(self, 4.0 + k * 3.5)

        # sweep the highlight top→bottom to stress the fixed order
        for k in range(4):
            box = highlight_decision(ledger.rows[k], color=C_STATE)
            self.play(Indicate(ledger.rows[k].box, color=C_STATE, scale_factor=1.03), run_time=0.9)
            if k < 3:
                highlight_decision(ledger.rows[k], color=INK_SUBTLE, fill=0.06)
        note = fit_label("same four decisions, always in this order", 10.0, 24, INK_MUTED)
        note.next_to(ledger, UP, buff=0.35)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(ledger, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : precise state ───────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "The state sentence is exact"
    cue_duration = 127.5

    def construct(self):
        vague = chip("dp[i] = something about the first i", color=ROSE, w=8.6, h=1.15, fs=27)
        vague.move_to([0, 1.6, 0])
        vtag = Text("vague → ambiguous recurrence", font_size=23, color=ROSE).next_to(vague, DOWN, buff=0.25)
        self.play(FadeIn(vague), run_time=1.4)
        self.play(FadeIn(vtag), run_time=1.0)
        wait_until(self, 7.0)

        arrow = Arrow([0, 0.4, 0], [0, -0.4, 0], color=INK_MUTED, buff=0.1, stroke_width=5)
        self.play(FadeIn(arrow), run_time=1.0)
        sharp = chip("dp[i] = best run ending exactly at i", color=EMERALD, w=8.6, h=1.15, fs=27)
        sharp.move_to([0, -1.2, 0])
        stag = Text("sharp → the transition is forced", font_size=23, color=EMERALD).next_to(sharp, DOWN, buff=0.25)
        self.play(FadeIn(sharp, shift=UP * 0.15), run_time=1.4)
        self.play(FadeIn(stag), Circumscribe(sharp, color=EMERALD), run_time=1.4)
        self.guard(vague, vtag, arrow, sharp, stag)
        pace_to(self, self.cue_duration)


# ─── Cue03 : Kadane preview ──────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "A running scalar: extend or restart"
    cue_duration = 121.5

    def construct(self):
        arr = value_row([-2, 1, -3, 4, -1, 2, 1], color=INK_SUBTLE, w=0.82, h=0.82, fs=26, gap=0.16)
        arr.move_to([0, 1.5, 0])
        self.play(FadeIn(arr), run_time=1.4)
        wait_until(self, 4.0)

        rec = MathTex(r"\text{best\_here}", r"=\max\big(", r"x", r",\;", r"\text{best\_here}+x", r"\big)")
        rec.scale(0.82).move_to([0, 0.1, 0])
        rec[2].set_color(C_SKIP)
        rec[4].set_color(C_TAKE)
        self.play(Write(rec), run_time=2.0)
        wait_until(self, 9.0)

        pair = choice_pair("restart: x", "extend: prev + x", w=3.6).scale(0.85).move_to([0, -1.7, 0])
        self.play(FadeIn(pair.a), FadeIn(pair.picker), FadeIn(pair.b), run_time=1.4)
        hint = fit_label("restart wins exactly when the run went negative", 11.0, 22, INK_MUTED)
        hint.to_edge(DOWN, buff=0.55)
        self.play(FadeIn(hint), run_time=1.0)
        self.guard(arr, rec, pair, hint)
        pace_to(self, self.cue_duration)


# ─── Cue04 : knapsack preview ────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Rolling array, sweep descending"
    cue_duration = 121.5

    def construct(self):
        prev = value_row([0, 0, 0, 4, 4, 4, 4, 4], color=INK_SUBTLE, w=0.72, h=0.62, fs=22, gap=0.14)
        cur = value_row([0, 0, 0, 4, 5, 5, 5, 9], color=ACCENT, w=0.72, h=0.62, fs=22, gap=0.14)
        prev.move_to([0, 1.7, 0])
        cur.move_to([0, 0.75, 0])
        pl = Text("2D table", font_size=20, color=INK_SUBTLE).next_to(prev, LEFT, buff=0.3)
        self.play(FadeIn(prev), FadeIn(cur), FadeIn(pl), run_time=1.6)
        wait_until(self, 5.0)

        single, lab = value_row([0, 0, 0, 4, 5, 5, 5, 9], color=ACCENT, w=0.82, h=0.72, fs=24, gap=0.16), None
        single.move_to([0, -0.4, 0])
        dl = Text("one rolling row", font_size=20, color=ACCENT).next_to(single, LEFT, buff=0.3)
        self.play(FadeOut(prev), FadeOut(pl), Transform(cur, single), FadeIn(dl), run_time=1.6)
        arr = sweep_arrow(single, descending=True, label="high → low  (use-once)", buff=0.45)
        self.play(FadeIn(arr), run_time=1.4)
        note = fit_label("the 2D table collapses to one row; descending keeps each item used once",
                         12.8, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(cur, arr, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : direction flip ──────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Ascending allows reuse"
    cue_duration = 97.2

    def construct(self):
        row = value_row([0, 0, 1, 1, 2, 2, 3], color=INK_SUBTLE, w=0.82, h=0.72, fs=24, gap=0.16)
        row.move_to([0, 0.9, 0])
        lab = Text("dp (coin change)", font_size=20, color=INK_MUTED).next_to(row, LEFT, buff=0.3)
        self.play(FadeIn(row), FadeIn(lab), run_time=1.4)
        wait_until(self, 4.0)

        asc = sweep_arrow(row, descending=False, label="low → high  (coin can repeat)", buff=0.45)
        self.play(FadeIn(asc), run_time=1.4)
        wait_until(self, 8.0)

        one = fit_label("same one-array machine — only the loop direction flips",
                        12.6, 24, INK).move_to([0, -0.9, 0])
        self.play(FadeIn(one), run_time=1.4)
        contrast = VGroup(
            chip("descending → 0/1 (once)", color=AMBER, w=5.6, h=0.95, fs=24),
            chip("ascending → unbounded (repeat)", color=EMERALD, w=5.9, h=0.95, fs=24),
        ).arrange(RIGHT, buff=0.5).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(contrast), run_time=1.4)
        self.guard(row, asc, one, contrast)
        pace_to(self, self.cue_duration)


# ─── Cue06 : LIS ─────────────────────────────────────────────────────────────
class Cue06(AvoScene):
    headline = "dp-ends-at-i, or patience tails"
    cue_duration = 109.3

    def construct(self):
        seq = value_row([3, 1, 4, 1, 5, 9, 2, 6], color=INK_SUBTLE, w=0.78, h=0.78, fs=25, gap=0.16)
        seq.move_to([0, 1.7, 0])
        # highlight an increasing subsequence 1,4,5,9 (indices 1,2,4,5)
        for i in (1, 2, 4, 5):
            recolor_cell(seq.cells[i], C_TAKE)
        self.play(FadeIn(seq), run_time=1.4)
        wait_until(self, 4.5)

        opt1 = VGroup(
            fit_label("dp ending at i", 5.0, 26, ACCENT, weight="BOLD"),
            complexity(r"O(n^2)", color=ACCENT).scale(0.8),
        ).arrange(DOWN, buff=0.25).move_to([-3.4, -0.6, 0])
        opt2 = VGroup(
            fit_label("patience tails + binary search", 6.0, 26, EMERALD, weight="BOLD"),
            complexity(r"O(n \log n)", color=EMERALD).scale(0.8),
        ).arrange(DOWN, buff=0.25).move_to([3.0, -0.6, 0])
        self.play(FadeIn(opt1), run_time=1.4)
        wait_until(self, 9.0)
        self.play(FadeIn(opt2), run_time=1.4)
        note = fit_label("two machines for the same answer — pick by the size of n",
                         12.0, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(seq, opt1, opt2, note)
        pace_to(self, self.cue_duration)


# ─── Cue07 : the traps ───────────────────────────────────────────────────────
class Cue07(AvoScene):
    headline = "Order, base, vague state, sentinel"
    cue_duration = 60.7

    def construct(self):
        traps = VGroup(
            chip("wrong fill order", color=ROSE, w=5.6, h=0.95, fs=25),
            chip("missing base case", color=ROSE, w=5.6, h=0.95, fs=25),
            chip("a vague state", color=ROSE, w=5.6, h=0.95, fs=25),
            chip("an unreachable sentinel", color=ROSE, w=5.6, h=0.95, fs=25),
        ).arrange_in_grid(rows=2, cols=2, buff=(0.6, 0.5)).move_to([0, 0.4, 0])
        for i, t in enumerate(traps):
            self.play(FadeIn(t, shift=UP * 0.12), run_time=0.9)
            wait_until(self, 2.0 + i * 3.0)

        note = fit_label("the bugs are the mechanics — not the idea itself", 12.0, 24, INK)
        note.to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(traps, note)
        pace_to(self, self.cue_duration)
