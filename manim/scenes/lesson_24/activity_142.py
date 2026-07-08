"""
Lesson 24 — Part 2 (activity 142): "Union Find — Number of Provinces" (73.3s,
6 cues).

The concrete Union-Find walkthrough behind the orientation's "Union Find answers
'same group?' incrementally with path compression and union by rank." Five nodes
0..4; process edges and merge groups. Each node points toward a root; two nodes
are in the same group exactly when they share a root. A successful union (roots
differ) attaches one tree under the other and drops the group count by one; an
edge whose endpoints already share a root is redundant (a cycle) and changes
nothing.

Edges processed: (0,1) union → count 5→4, (1,2) union → count 4→3,
(0,2) REDUNDANT (already same root) → count stays 3, (3,4) union → count 3→2.
Two roots remain — groups {0,1,2} and {3,4} — so the answer is 2 provinces.

Uses graph.py (forest_nodes, parent_arrow, root_ring, node_circle, recolor_node)
— the parent-pointer forest vocabulary. MathTex is reserved for the one
complexity bound O(E·α(V)) / O(V).

Cue00 0-13.3    every node points to a root; same group ⇔ same root
Cue01 13.3-27.6 different roots → attach one under the other, count −1
Cue02 27.6-42.2 same root already → redundant edge / cycle → nothing changes
Cue03 42.2-56.9 path compression + union by rank → near-constant per op
Cue04 56.9-66.7 two roots remain → {0,1,2} and {3,4} → answer 2
Cue05 66.7-73.3 Union Find gives connectivity, not the path — use BFS/DFS for that
"""

import theme
from theme import (
    AvoScene, ACCENT, AMBER, EMERALD, ROSE, VIOLET, INK, INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from graph import (
    forest_nodes, parent_arrow, root_ring, node_circle, recolor_node,
    C_UNSEEN, C_CURRENT, C_DONE,
)
from arrays import value_badge
from bayes import fit_label, chip
from manim import (
    VGroup, Text, MathTex, Arrow, Line, FadeIn, FadeOut, Write, Transform,
    Indicate, Circumscribe, GrowArrow, GrowFromCenter, RIGHT, LEFT, UP, DOWN,
)

# Two final groups: {0,1,2} rooted at 0, {3,4} rooted at 3.
LABELS = ["0", "1", "2", "3", "4"]
POS = [
    [-3.2, 1.3],    # 0  (root of left group)
    [-4.4, -0.5],   # 1
    [-2.0, -0.5],   # 2
    [3.2, 1.3],     # 3  (root of right group)
    [3.2, -0.5],    # 4
]
# final parent pointers: 1→0, 2→0, 4→3
FINAL_EDGES = [(1, 0), (2, 0), (4, 3)]
GROUP_COLOR = {0: ACCENT, 1: ACCENT, 2: ACCENT, 3: EMERALD, 4: EMERALD}


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_forest(edges, color_by_group=False):
    f = forest_nodes(LABELS, POS, r=0.36, fs=26)
    arrows = {}
    for (child, par) in edges:
        col = GROUP_COLOR[par] if color_by_group else INK_MUTED
        a = parent_arrow(f.nodes[child], f.nodes[par], color=col, r=0.36)
        arrows[(child, par)] = a
    return f, arrows


# ─── Cue00 : point to a root; same group ⇔ same root ─────────────────────────
class Cue00(AvoScene):
    headline = "Every node points toward a root"
    cue_duration = 13.3

    def construct(self):
        f, arrows = build_forest(FINAL_EDGES, color_by_group=True)
        self.play(FadeIn(f), run_time=1.6)
        for a in arrows.values():
            self.play(GrowArrow(a), run_time=0.4)
        wait_until(self, 4.5)

        # mark the two roots
        r0 = root_ring(f.nodes[0], color=ACCENT)
        r3 = root_ring(f.nodes[3], color=EMERALD)
        rlab0 = Text("root", font_size=20, color=ACCENT).next_to(f.nodes[0], UP, buff=0.22)
        rlab3 = Text("root", font_size=20, color=EMERALD).next_to(f.nodes[3], UP, buff=0.22)
        self.play(FadeIn(r0), FadeIn(r3), FadeIn(rlab0), FadeIn(rlab3), run_time=1.4)
        wait_until(self, 8.5)

        note = fit_label("find(1) = 0 and find(2) = 0 → same root → same group",
                         12.6, 24, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note),
                  Indicate(f.nodes[1], color=ACCENT), Indicate(f.nodes[2], color=ACCENT),
                  run_time=1.6)
        self.guard(f, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : different roots → union, count −1 ───────────────────────────────
class Cue01(AvoScene):
    headline = "Different roots → attach, count drops by one"
    cue_duration = 14.3

    def construct(self):
        # start with 0,1,2 as three singletons across the top
        labs = ["0", "1", "2"]
        pos = [[-3.6, 0.6], [0.0, 0.6], [3.6, 0.6]]
        f = forest_nodes(labs, pos, r=0.4, fs=28)
        self.play(FadeIn(f), run_time=1.2)
        count = value_badge("count", "3", color=INK, w=3.0, h=0.95).move_to([0, -2.0, 0])
        self.add(count)
        wait_until(self, 2.5)

        # edge (0,1): roots 0≠1 → attach 1 under 0
        e01 = Line(f.nodes[0].get_right(), f.nodes[1].get_left(), color=AMBER, stroke_width=4)
        elab = Text("edge (0,1)", font_size=22, color=AMBER).next_to(e01, UP, buff=0.15)
        self.play(GrowFromCenter(e01), FadeIn(elab), run_time=1.1)
        a1 = parent_arrow(f.nodes[1], f.nodes[0], color=ACCENT, r=0.4)
        self.play(FadeOut(e01), FadeOut(elab), GrowArrow(a1),
                  Transform(count.value_text,
                            Text("2", font_size=34, color=INK, weight="BOLD").move_to(count.value_text)),
                  run_time=1.4)
        wait_until(self, 8.0)

        # edge (1,2): find(1)=0, find(2)=2, roots differ → attach 2 under 0
        e12 = Line(f.nodes[1].get_right(), f.nodes[2].get_left(), color=AMBER, stroke_width=4)
        self.play(GrowFromCenter(e12), run_time=0.9)
        a2 = parent_arrow(f.nodes[2], f.nodes[0], color=ACCENT, r=0.4)
        self.play(FadeOut(e12), GrowArrow(a2),
                  Transform(count.value_text,
                            Text("1", font_size=34, color=EMERALD, weight="BOLD").move_to(count.value_text)),
                  run_time=1.4)
        note = fit_label("each union merges two trees into one → one fewer group",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.1)
        self.guard(f, count, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : same root → redundant edge / cycle ──────────────────────────────
class Cue02(AvoScene):
    headline = "Same root already → redundant edge (a cycle)"
    cue_duration = 14.6

    def construct(self):
        # group {0,1,2} already merged: 1→0, 2→0
        labs = ["0", "1", "2"]
        pos = [[0.0, 1.3], [-2.2, -0.7], [2.2, -0.7]]
        f = forest_nodes(labs, pos, r=0.42, fs=28)
        a1 = parent_arrow(f.nodes[1], f.nodes[0], color=ACCENT, r=0.42)
        a2 = parent_arrow(f.nodes[2], f.nodes[0], color=ACCENT, r=0.42)
        r0 = root_ring(f.nodes[0], color=ACCENT, r=0.42)
        self.add(f, a1, a2, r0)
        count = value_badge("count", "1", color=INK, w=3.0, h=0.95).move_to([4.6, 1.0, 0])
        self.add(count)
        wait_until(self, 2.0)

        # the redundant edge (1,2) — both already root at 0
        e = Line(f.nodes[1].get_bottom(), f.nodes[2].get_bottom(), color=ROSE, stroke_width=4)
        e.shift(DOWN * 0.35)
        elab = Text("edge (1,2)", font_size=22, color=ROSE).next_to(e, DOWN, buff=0.12)
        self.play(GrowFromCenter(e), FadeIn(elab), run_time=1.3)
        wait_until(self, 6.0)

        # find both → same root 0
        self.play(Indicate(f.nodes[1], color=ROSE), Indicate(f.nodes[0], color=ROSE),
                  Indicate(f.nodes[2], color=ROSE), run_time=1.6)
        verdict = Text("find(1) = find(2) = 0  →  a cycle, skip", font_size=26, color=ROSE, weight="BOLD")
        verdict.move_to([0, -2.15, 0])
        self.play(FadeIn(verdict), run_time=1.2)
        wait_until(self, 11.5)

        note = fit_label("count is unchanged — the edge joins nothing new", 12.0, 22, INK_MUTED)
        note.next_to(count, DOWN, buff=0.3)
        self.play(FadeIn(note), Circumscribe(count, color=INK_MUTED), run_time=1.4)
        self.guard(f, e, verdict, count)
        pace_to(self, self.cue_duration)


# ─── Cue03 : path compression + union by rank ────────────────────────────────
class Cue03(AvoScene):
    headline = "Path compression + union by rank"
    cue_duration = 14.7

    def construct(self):
        # LEFT: a tall chain 2→1→0 flattening during find(2)
        left = Text("path compression", font_size=24, color=ACCENT).move_to([-3.6, 2.0, 0])
        c0 = node_circle("0", r=0.34, fs=24).move_to([-3.6, 1.1, 0])
        c1 = node_circle("1", r=0.34, fs=24).move_to([-3.6, 0.0, 0])
        c2 = node_circle("2", r=0.34, fs=24).move_to([-3.6, -1.1, 0])
        chain1 = parent_arrow(c2, c1, color=INK_MUTED, r=0.34)
        chain2 = parent_arrow(c1, c0, color=INK_MUTED, r=0.34)
        self.play(FadeIn(left), FadeIn(c0), FadeIn(c1), FadeIn(c2),
                  GrowArrow(chain1), GrowArrow(chain2), run_time=1.8)
        wait_until(self, 4.5)

        # flatten: 2 and 1 both point straight at root 0
        flat1 = parent_arrow(c2, c0, color=ACCENT, r=0.34)
        flat2 = parent_arrow(c1, c0, color=ACCENT, r=0.34)
        self.play(FadeOut(chain1), FadeOut(chain2),
                  c2.animate.move_to([-4.8, -1.1, 0]), run_time=1.0)
        flat1 = parent_arrow(c2, c0, color=ACCENT, r=0.34)
        self.play(GrowArrow(flat1), GrowArrow(flat2), run_time=1.2)
        wait_until(self, 8.5)

        # RIGHT: union by rank — shorter tree hangs under taller
        right = Text("union by rank", font_size=24, color=EMERALD).move_to([3.4, 2.0, 0])
        tall = node_circle("A", r=0.34, fs=24).move_to([3.4, 1.0, 0])
        tall_kid = node_circle("·", r=0.28, fs=20).move_to([3.4, -0.1, 0])
        short = node_circle("B", r=0.34, fs=24).move_to([5.2, -0.1, 0])
        ta = parent_arrow(tall_kid, tall, color=INK_MUTED, r=0.30)
        self.play(FadeIn(right), FadeIn(tall), FadeIn(tall_kid), FadeIn(short),
                  GrowArrow(ta), run_time=1.4)
        ba = parent_arrow(short, tall, color=EMERALD, r=0.34)
        self.play(GrowArrow(ba), run_time=1.0)

        bound = MathTex(r"O(\alpha(V))", r"\approx O(1)").scale(0.85).move_to([0, -2.15, 0])
        bound[0].set_color(EMERALD)
        bound[1].set_color(EMERALD)
        self.play(Write(bound), run_time=1.2)
        self.guard(c0, c1, c2, tall, short, bound)
        pace_to(self, self.cue_duration)


# ─── Cue04 : two roots remain → 2 provinces ──────────────────────────────────
class Cue04(AvoScene):
    headline = "Two roots remain → 2 provinces"
    cue_duration = 9.8

    def construct(self):
        f, arrows = build_forest(FINAL_EDGES, color_by_group=True)
        self.add(f, *arrows.values())
        r0 = root_ring(f.nodes[0], color=ACCENT)
        r3 = root_ring(f.nodes[3], color=EMERALD)
        self.play(FadeIn(r0), FadeIn(r3), run_time=1.2)
        wait_until(self, 2.5)

        g1 = chip("{0, 1, 2}", color=ACCENT, w=3.0, h=0.9, fs=26).move_to([-3.2, -2.05, 0])
        g2 = chip("{3, 4}", color=EMERALD, w=2.4, h=0.9, fs=26).move_to([3.2, -2.05, 0])
        self.play(FadeIn(g1), FadeIn(g2), run_time=1.2)
        ans = value_badge("provinces", "2", color=C_DONE, w=3.6, h=1.0).move_to([0, 0.2, 0])
        self.play(FadeIn(ans), Circumscribe(ans, color=C_DONE), run_time=1.6)
        self.guard(f, g1, g2, ans)
        pace_to(self, self.cue_duration)


# ─── Cue05 : connectivity, not the path ──────────────────────────────────────
class Cue05(AvoScene):
    headline = "Connectivity, not the path"
    cue_duration = 6.6

    def construct(self):
        yes = chip("connected(0, 2)?  YES", color=EMERALD, w=5.4, h=1.0, fs=26).move_to([0, 1.1, 0])
        self.play(FadeIn(yes), run_time=1.0)
        path = chip("the actual path 0 → 2?", color=AMBER, w=5.4, h=1.0, fs=26).move_to([0, -0.3, 0])
        self.play(FadeIn(path), run_time=1.0)
        use = Text("→ use BFS / DFS for that", font_size=26, color=ACCENT, weight="BOLD")
        use.move_to([0, -1.6, 0])
        self.play(FadeIn(use), Indicate(path, color=AMBER), run_time=1.4)
        self.guard(yes, path, use)
        pace_to(self, self.cue_duration)
