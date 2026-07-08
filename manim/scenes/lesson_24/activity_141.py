"""
Lesson 24 — Part 1 (activity 141): "Rotting Oranges — multi-source grid BFS"
(75.8s, 6 cues).

The concrete grid-BFS walkthrough behind the orientation's "multi-source BFS
seeds all sources together and counts layers." A grid where 2 cells start
rotten (multi-source) and rot spreads to 4-neighbours one minute at a time; the
minute a fresh cell flips is its BFS distance to the NEAREST rotten source, so
the answer is the deepest layer reached.

Grid (R rotten source, F fresh, 5×3):
    R F F F R
    F F F F F
    F F F F F
Two sources at (0,0) and (0,4). Multi-source BFS layers (minute a cell flips):
    0 1 2 1 0
    1 2 3 2 1
    2 3 4 3 2
The deepest fresh cell is the bottom-centre (2,2) at minute 4, so all 13 fresh
oranges are rotten by minute 4 → answer 4. If a fresh cell were walled off from
every source it would still be fresh when the queue empties → answer −1.

Uses graph.py (grid_board, set_cell, minute_tag, container) — the grid + queue
vocabulary, NOT the transformer / econ idioms. MathTex is reserved for the one
complexity bound O(V+E) / O(V).

Cue00 0-13.8    enqueue every already-rotten cell at minute 0, count fresh
Cue01 13.8-28.5 each minute pops the whole frontier; fresh neighbours flip + join
Cue02 28.5-43.7 the minute a cell flips is its distance to the nearest source
Cue03 43.7-58.8 flip rotten the instant enqueued → no cell processed twice
Cue04 58.8-68.9 fresh hits zero at minute 4 (deepest layer) → answer 4
Cue05 68.9-75.8 a cell still fresh when the queue empties → answer −1
"""

import theme
from theme import (
    AvoScene, ACCENT, AMBER, EMERALD, ROSE, VIOLET, INK, INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from graph import (
    grid_board, set_cell, minute_tag, container, recolor_slot,
    C_FRESH, C_ROTTEN, C_CURRENT, C_FRONTIER, C_DONE,
)
from arrays import value_badge
from bayes import fit_label, chip
from manim import (
    VGroup, Text, MathTex, Arrow, FadeIn, FadeOut, Write, Transform, Indicate,
    Circumscribe, GrowFromCenter, RIGHT, LEFT, UP, DOWN,
)

GRID = ["RFFFR", "FFFFF", "FFFFF"]
SOURCES = [(0, 0), (0, 4)]
# BFS minute each cell flips (distance to nearest rotten source)
LAYER = [
    [0, 1, 2, 1, 0],
    [1, 2, 3, 2, 1],
    [2, 3, 4, 3, 2],
]
GRID_Y = -0.1


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def board(minute=None):
    """Grid coloured for the given elapsed `minute` (None = all fresh + sources
    only). Cells with LAYER <= minute are rotten; the rest stay fresh."""
    states = [list(row) for row in GRID]
    b = grid_board(states, cell=0.74, gap=0.08)
    b.move_to([0, GRID_Y, 0])
    if minute is not None:
        for r in range(b.rows):
            for c in range(b.cols):
                if LAYER[r][c] <= minute:
                    set_cell(b.cell[r][c], C_ROTTEN)
                else:
                    set_cell(b.cell[r][c], C_FRESH)
    return b


# ─── Cue00 : seed sources, count fresh ───────────────────────────────────────
class Cue00(AvoScene):
    headline = "Enqueue every rotten cell at minute 0"
    cue_duration = 13.8

    def construct(self):
        b = board(minute=0)
        b.shift(LEFT * 1.9)
        self.play(FadeIn(b, shift=UP * 0.2), run_time=1.8)
        wait_until(self, 2.8)

        # spotlight the two sources going into the queue at minute 0
        for (r, c) in SOURCES:
            set_cell(b.cell[r][c], C_ROTTEN)
        self.play(*[Indicate(b.cell[r][c].box, color=ROSE, scale_factor=1.15)
                    for (r, c) in SOURCES], run_time=1.4)

        q = container("queue", ["(0,0)", "(0,4)"], w=1.2, h=0.7, fs=22, color=ROSE, title=False)
        q.scale(0.9).move_to([4.2, 1.2, 0])
        qlab = Text("frontier @ minute 0", font_size=22, color=INK_MUTED).next_to(q, UP, buff=0.3)
        self.play(FadeIn(q), FadeIn(qlab), run_time=1.4)
        wait_until(self, 8.5)

        fresh = value_badge("fresh", "13", color=C_FRESH, w=3.0, h=0.95).move_to([4.2, -1.2, 0])
        self.play(FadeIn(fresh), run_time=1.1)
        note = fit_label("2 sources start together; 13 fresh cells still to rot", 12.6, 22, INK_MUTED)
        note.to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.1)
        self.guard(b, q, qlab, fresh, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : one minute expands the whole frontier ───────────────────────────
class Cue01(AvoScene):
    headline = "Each minute pops the whole frontier"
    cue_duration = 14.7

    def construct(self):
        b = board(minute=0)
        b.shift(LEFT * 1.5)
        self.add(b)
        wait_until(self, 1.6)

        # the current frontier (minute-0 sources) is being popped → mark CURRENT
        for (r, c) in SOURCES:
            set_cell(b.cell[r][c], C_CURRENT)
        self.play(*[Indicate(b.cell[r][c].box, color=C_CURRENT) for (r, c) in SOURCES],
                  run_time=1.4)
        wait_until(self, 5.0)

        # every fresh neighbour flips to rotten and joins the NEXT layer
        m1 = [(r, c) for r in range(b.rows) for c in range(b.cols) if LAYER[r][c] == 1]
        arrows = VGroup()
        for (r, c) in m1:
            set_cell(b.cell[r][c], C_FRONTIER)
        self.play(*[GrowFromCenter(b.cell[r][c].box) for (r, c) in m1],
                  *[Indicate(b.cell[r][c].dot, color=C_ROTTEN) for (r, c) in m1],
                  run_time=1.8)
        wait_until(self, 9.5)

        minute = value_badge("minute", "1", color=C_CURRENT, w=3.0, h=0.95).move_to([4.4, 0.9, 0])
        self.play(FadeIn(minute), run_time=1.0)
        note = fit_label("all 4 neighbours flip at once, then join the next minute's frontier",
                         13.0, 21, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(b, minute, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : minute flipped = distance to nearest source ─────────────────────
class Cue02(AvoScene):
    headline = "The minute a cell flips is its distance"
    cue_duration = 15.2

    def construct(self):
        b = board(minute=4)   # fully rotten
        b.shift(LEFT * 1.2)
        self.add(b)
        wait_until(self, 1.2)

        # stamp each cell with the minute it flipped = BFS layer
        tags = VGroup()
        for r in range(b.rows):
            for c in range(b.cols):
                col = ROSE if LAYER[r][c] == 0 else INK
                tags.add(minute_tag(b.cell[r][c], LAYER[r][c], color=col))
        self.play(FadeIn(tags, lag_ratio=0.03), run_time=2.4)
        wait_until(self, 7.0)

        # the two 0-cells are the sources; numbers grow outward in rings
        note = fit_label("each number = minutes to reach that cell from the nearest source",
                         13.2, 21, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note),
                  *[Indicate(b.cell[r][c].box, color=ROSE) for (r, c) in SOURCES],
                  run_time=1.6)
        wait_until(self, 11.0)

        deepest = value_badge("deepest", "4", color=C_DONE, w=3.0, h=0.95).move_to([4.4, 0.4, 0])
        self.play(FadeIn(deepest), Indicate(b.cell[2][2].box, color=C_DONE, scale_factor=1.2),
                  run_time=1.6)
        self.guard(b, tags, note, deepest)
        pace_to(self, self.cue_duration)


# ─── Cue03 : flip-on-enqueue = no double processing ──────────────────────────
class Cue03(AvoScene):
    headline = "Flip rotten the instant it is enqueued"
    cue_duration = 15.1

    def construct(self):
        # a 3-cell diagram: two rotten cells share one fresh neighbour
        states = ["RFR"]
        b = grid_board(states, cell=1.0, gap=0.5).move_to([0, 0.9, 0])
        self.play(FadeIn(b), run_time=1.4)
        left_lab = Text("rotten", font_size=20, color=C_ROTTEN).next_to(b.cell[0][0], UP, buff=0.2)
        right_lab = Text("rotten", font_size=20, color=C_ROTTEN).next_to(b.cell[0][2], UP, buff=0.2)
        mid_lab = Text("fresh", font_size=20, color=C_FRESH).next_to(b.cell[0][1], UP, buff=0.2)
        self.play(FadeIn(left_lab), FadeIn(right_lab), FadeIn(mid_lab), run_time=1.2)
        wait_until(self, 4.5)

        # both neighbours reach for the middle; first one flips + marks it
        a1 = Arrow(b.cell[0][0].get_right(), b.cell[0][1].get_left(), buff=0.1,
                   color=ACCENT, stroke_width=5)
        a2 = Arrow(b.cell[0][2].get_left(), b.cell[0][1].get_right(), buff=0.1,
                   color=INK_SUBTLE, stroke_width=5)
        self.play(GrowFromCenter(a1), run_time=0.9)
        set_cell(b.cell[0][1], C_ROTTEN)
        self.play(Transform(mid_lab, Text("rotten ✓", font_size=20, color=C_ROTTEN)
                            .next_to(b.cell[0][1], UP, buff=0.2)), run_time=1.0)
        wait_until(self, 9.0)

        # second neighbour arrives but sees it already rotten → skips
        skip = Text("already rotten — skip", font_size=24, color=ROSE, weight="BOLD")
        skip.move_to([0, -1.2, 0])
        self.play(GrowFromCenter(a2), FadeIn(skip),
                  a2.animate.set_color(ROSE), run_time=1.4)
        note = fit_label("marking visited at enqueue keeps each cell in the queue exactly once",
                         13.2, 21, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(b, a1, a2, skip, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : fresh hits zero at minute 4 → answer 4 ──────────────────────────
class Cue04(AvoScene):
    headline = "Fresh reaches zero at minute 4"
    cue_duration = 10.1

    def construct(self):
        b = board(minute=4)
        b.shift(LEFT * 1.2)
        self.add(b)
        # the deepest cell (2,2) is the last to flip at minute 4
        deep = b.cell[2][2]
        set_cell(deep, C_DONE)
        tag = minute_tag(deep, "4", color=INK)
        self.play(FadeIn(tag), Circumscribe(deep.box, color=C_DONE), run_time=1.6)
        wait_until(self, 3.5)

        fresh = value_badge("fresh", "0", color=C_DONE, w=3.0, h=0.95).move_to([4.4, 1.0, 0])
        ans = chip("answer = 4 minutes", color=C_DONE, w=4.4, h=1.0, fs=26).move_to([4.4, -0.6, 0])
        self.play(FadeIn(fresh), run_time=1.0)
        self.play(FadeIn(ans), Circumscribe(ans, color=C_DONE), run_time=1.4)
        note = fit_label("queue empties with no fresh left → the deepest layer is the answer",
                         13.2, 21, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.1)
        self.guard(b, fresh, ans, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : unreachable fresh → −1 ──────────────────────────────────────────
class Cue05(AvoScene):
    headline = "A cell that can never rot → −1"
    cue_duration = 6.9

    def construct(self):
        # a fresh cell fenced off from the source by empty walls
        states = ["R.F", "...", "..."]
        b = grid_board(states, cell=0.9, gap=0.14).move_to([-1.0, 0, 0])
        # the lone fresh cell (0,2) is isolated
        set_cell(b.cell[0][2], C_FRESH)
        self.play(FadeIn(b), run_time=1.2)
        stuck = value_badge("stuck fresh", "1", color=ROSE, w=3.6, h=0.95).move_to([3.4, 0.7, 0])
        ans = chip("answer = −1", color=ROSE, w=3.4, h=1.0, fs=28).move_to([3.4, -0.9, 0])
        self.play(FadeIn(stuck), Indicate(b.cell[0][2].box, color=ROSE, scale_factor=1.2),
                  run_time=1.2)
        self.play(FadeIn(ans), Circumscribe(ans, color=ROSE), run_time=1.3)
        self.guard(b, stuck, ans)
        pace_to(self, self.cue_duration)
