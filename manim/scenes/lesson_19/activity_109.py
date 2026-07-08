"""
Lesson 19 — Part 1 (activity 109): "Heap mechanics" (88.0s, 6 short cues).

The concrete min-heap mechanics behind the orientation's "insert sifts up /
remove sifts down" beat. One running heap the whole way:

  start heap  [1, 3, 5, 7, 4, 9, 8]   (a valid min-heap: every parent ≤ children)
  insert 2    → drop at index 7 (child of 7), sift up: 2<7 swap, 2<3 swap, 2>1 stop
              → [1, 2, 5, 3, 4, 9, 8, 7]
  remove min  → answer 1; move last leaf 7 to the root, sift down: 7>2 swap (to
                idx1), 7>3 swap (to idx3), settled → [2, 3, 5, 7, 4, 9, 8]

Cue00 0-16       The invariant: every parent ≤ its children, so the min is the root
Cue01 16-33.1    Insert drops the new value at the end (gap-free array shape)
Cue02 33.1-50.7  Sift up: compare with parent, swap upward until it fits
Cue03 50.7-68.3  Remove the root as the answer, move the last leaf to the root
Cue04 68.3-80    Sift down: swap with the smaller child until the promise holds
Cue05 80-88      Each repair walks one root-to-leaf path of length ≈ log n

Uses the heap.py idiom lib (heap_tree, heap_array, recolor_node, root_marker) —
the tree/array vocabulary. MathTex is reserved for the O(log n) bound.
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
from heap import (
    heap_tree,
    heap_array,
    recolor_node,
    recolor_cell,
    root_marker,
    complexity,
    node_xy,
    C_ROOT,
    C_ACTIVE,
    C_NEW,
    C_EVICT,
    C_SPINE,
    C_NODE,
)
from bayes import fit_label
from manim import (
    VGroup,
    Text,
    MathTex,
    Circle,
    Line,
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

# The running heap states.
H_START = [1, 3, 5, 7, 4, 9, 8]
H_AFTER_INSERT = [1, 2, 5, 3, 4, 9, 8, 7]
H_AFTER_REMOVE = [2, 3, 5, 7, 4, 9, 8]

TOP = 2.15
LG = 1.42
WIDTH = 9.2


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def tree_of(values, width=WIDTH):
    return heap_tree(values, r=0.42, fs=30, top=TOP, level_gap=LG, width=width)


def arr_of(values, y=-2.65):
    return heap_array(values, w=0.8, h=0.8, fs=27, gap=0.12, y=y)


# ─── Cue00 : the invariant ───────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Every parent ≤ its children → the min is the root"
    cue_duration = 16.0

    def construct(self):
        tree = tree_of(H_START)
        self.play(FadeIn(tree, shift=UP * 0.2), run_time=1.6)
        wait_until(self, 3.5)

        # highlight three parent→children promises
        recolor_node(tree.nodes[0], C_ROOT)
        rm = root_marker(tree.nodes[0], "root = min", side=LEFT, gap=0.35)
        self.play(FadeIn(rm), Indicate(tree.nodes[0], color=C_ROOT, scale_factor=1.15), run_time=1.4)
        wait_until(self, 8)

        note = fit_label("1 ≤ 3 and 1 ≤ 5 · 3 ≤ 7 and 3 ≤ 4 · a local promise at every node",
                         12.5, 22, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.2)
        self.play(Indicate(tree.nodes[1], color=AMBER, scale_factor=1.1),
                  Indicate(tree.nodes[3], color=AMBER, scale_factor=1.1),
                  Indicate(tree.nodes[4], color=AMBER, scale_factor=1.1), run_time=1.4)
        self.guard(tree, rm, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : insert drops at the end ─────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Insert 2: drop it at the end, gap-free"
    cue_duration = 17.1

    def construct(self):
        # compact tree of the 7 current nodes in the upper band
        tree = tree_of(H_START, width=8.4)
        tree.scale(0.7).move_to([0, 1.55, 0])
        recolor_node(tree.nodes[0], C_ROOT)

        # the array is the star of this cue: show all 8 slots but reveal only 7,
        # then append the 2 as the 8th cell.
        full = [1, 3, 5, 7, 4, 9, 8, 2]
        arr = heap_array(full, w=0.82, h=0.82, fs=28, gap=0.14, y=-1.35)
        base = VGroup(*arr.cells[:7], *arr.idx[:7])
        self.add(tree)
        self.play(FadeIn(base, shift=UP * 0.2), run_time=1.4)
        wait_until(self, 3)

        # the incoming value
        incoming = VGroup(
            Circle(radius=0.42, stroke_color=C_NEW, stroke_width=2.8,
                   fill_color=C_NEW, fill_opacity=0.15),
            Text("2", font_size=32, color=C_NEW, weight="BOLD"),
        ).move_to([5.4, 1.7, 0])
        tag = Text("new", font_size=20, color=C_NEW).next_to(incoming, UP, buff=0.18)
        self.play(FadeIn(incoming), FadeIn(tag), run_time=1.2)
        wait_until(self, 7)

        # append into the array at index 7 (the 8th cell)
        recolor_cell(arr.cells[7], C_NEW)
        self.play(incoming.animate.move_to(arr.cells[7].get_center()).scale(0.9),
                  FadeOut(tag), run_time=1.4)
        self.remove(incoming)
        self.add(arr.cells[7], arr.idx[7])
        endlab = Text("end", font_size=20, color=C_NEW).next_to(arr.cells[7], UP, buff=0.16)
        self.play(FadeIn(endlab), run_time=0.8)
        wait_until(self, 12)

        # mirror: a faint new leaf appears on the tree at index 7's position
        leaf_xy = [tree.nodes[3].get_center()[0] - 0.55,
                   tree.nodes[3].get_center()[1] - 0.85, 0]
        leaf = VGroup(
            Circle(radius=0.3, stroke_color=C_NEW, stroke_width=2.4,
                   fill_color=C_NEW, fill_opacity=0.12),
            Text("2", font_size=22, color=C_NEW, weight="BOLD"),
        ).move_to(leaf_xy)
        leaf_edge = Line(tree.nodes[3].get_center(), leaf_xy,
                         stroke_color=INK_SUBTLE, stroke_width=2.0)
        self.play(FadeIn(leaf_edge), FadeIn(leaf), run_time=1.0)
        appended = fit_label("append at index 7 — no gap, the tree stays complete",
                             12.5, 22, C_NEW).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(appended), run_time=1.0)
        self.guard(tree, arr, appended)
        pace_to(self, self.cue_duration)


# ─── Cue02 : sift up ─────────────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Sift up: swap with the parent until it fits"
    cue_duration = 17.6

    def construct(self):
        # tree with 2 already at index 7 (below 7 at idx3)
        vals = [1, 3, 5, 7, 4, 9, 8, 2]
        tree = tree_of(vals)
        recolor_node(tree.nodes[0], C_ROOT)
        recolor_node(tree.nodes[7], C_ACTIVE)   # the sifting node position
        self.add(tree)
        # the sifting value "2" is tree.labels[7]; each parent label trades down
        sifter = tree.labels[7]
        parent_at_3 = tree.labels[3]   # value 7
        parent_at_1 = tree.labels[1]   # value 3
        wait_until(self, 2)

        # compare 2 (idx7) with parent 7 (idx3): 2 < 7 → swap
        cmp = fit_label("2 < 7 → swap up", 5.0, 24, C_ACTIVE).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(cmp),
                  Indicate(tree.nodes[3], color=C_ACTIVE, scale_factor=1.12),
                  Indicate(tree.nodes[7], color=C_ACTIVE, scale_factor=1.12), run_time=1.4)
        self.play(sifter.animate.move_to(tree.xy[3]),
                  parent_at_3.animate.move_to(tree.xy[7]), run_time=1.3)
        recolor_node(tree.nodes[7], C_NODE, fill=0.10)
        recolor_node(tree.nodes[3], C_ACTIVE)   # 2 now sits at idx3
        wait_until(self, 8)

        # compare 2 (now at idx3) with parent 3 (idx1): 2 < 3 → swap
        cmp2 = fit_label("2 < 3 → swap up", 5.0, 24, C_ACTIVE).to_edge(DOWN, buff=0.6)
        self.play(Transform(cmp, cmp2),
                  Indicate(tree.nodes[1], color=C_ACTIVE, scale_factor=1.12), run_time=1.3)
        self.play(sifter.animate.move_to(tree.xy[1]),
                  parent_at_1.animate.move_to(tree.xy[3]), run_time=1.3)
        recolor_node(tree.nodes[3], C_NODE, fill=0.10)
        recolor_node(tree.nodes[1], C_ACTIVE)   # 2 now sits at idx1
        wait_until(self, 13.5)

        # compare 2 (idx1) with root 1 (idx0): 2 > 1 → stop
        cmp3 = fit_label("2 > 1 → stop: the min stays at the root", 10.5, 23, EMERALD).to_edge(DOWN, buff=0.6)
        self.play(Transform(cmp, cmp3),
                  Indicate(tree.nodes[0], color=EMERALD, scale_factor=1.12), run_time=1.4)
        recolor_node(tree.nodes[1], ACCENT)   # 2 settled at idx1
        self.guard(tree, cmp)
        pace_to(self, self.cue_duration)


# ─── Cue03 : remove — answer + move last to root ─────────────────────────────
class Cue03(AvoScene):
    headline = "Remove: take the root, move the last leaf up"
    cue_duration = 17.6

    def construct(self):
        vals = H_AFTER_INSERT   # [1,2,5,3,4,9,8,7]
        tree = tree_of(vals)
        recolor_node(tree.nodes[0], C_ROOT)
        recolor_node(tree.nodes[7], C_EVICT)  # last leaf = 7 at idx7 (will move)
        self.add(tree)
        wait_until(self, 2)

        # pop the root as the answer
        ans = fit_label("root 1 is the answer — pop it", 8.0, 23, EMERALD).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(ans), Circumscribe(tree.nodes[0], color=EMERALD), run_time=1.5)
        answer_chip = VGroup(
            Circle(radius=0.42, stroke_color=EMERALD, stroke_width=2.8, fill_color=EMERALD, fill_opacity=0.15),
            Text("1", font_size=34, color=EMERALD, weight="BOLD"),
        ).move_to([-5.4, 1.55, 0])
        alab = Text("popped", font_size=20, color=EMERALD).next_to(answer_chip, UP, buff=0.2)
        self.play(tree.labels[0].animate.move_to(answer_chip.get_center()),
                  FadeIn(answer_chip[0]), FadeIn(alab), run_time=1.3)
        self.remove(tree.labels[0])
        self.add(answer_chip[1])
        recolor_node(tree.nodes[0], C_NODE, fill=0.06)  # root now empty
        wait_until(self, 9)

        # move the last leaf (7 at idx7) up to the root
        movenote = fit_label("move the last leaf 7 into the empty root, drop the leaf",
                             12.5, 22, VIOLET).to_edge(DOWN, buff=0.6)
        self.play(Transform(ans, movenote), run_time=0.8)
        # the edge into idx7 is edges[6] (child i → edges[i-1]); fade it with the leaf
        self.play(tree.labels[7].animate.move_to(tree.xy[0]),
                  FadeOut(tree.circles[7]), FadeOut(tree.edges[6]), run_time=1.6)
        recolor_node(tree.nodes[0], C_ACTIVE)   # 7 now sits at the root, out of place
        wait_until(self, 14)

        outof = fit_label("7 at the root breaks the promise — it must sift down", 12.0, 22, C_ACTIVE)
        outof.to_edge(DOWN, buff=0.6)
        self.play(Transform(ans, outof), Indicate(tree.nodes[0], color=C_ACTIVE, scale_factor=1.12),
                  run_time=1.4)
        self.guard(tree, answer_chip, ans)
        pace_to(self, self.cue_duration)


# ─── Cue04 : sift down ───────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Sift down: swap with the smaller child"
    cue_duration = 11.7

    def construct(self):
        # 7 at root, rest of the post-remove heap laid out (7 nodes)
        vals = [7, 2, 5, 3, 4, 9, 8]
        tree = tree_of(vals)
        recolor_node(tree.nodes[0], C_ACTIVE)
        self.add(tree)
        # the sifting value "7" is tree.labels[0]; smaller children rise to meet it
        sifter = tree.labels[0]
        child_at_1 = tree.labels[1]   # value 2
        child_at_3 = tree.labels[3]   # value 3
        wait_until(self, 1.5)

        # children of root: 2 (idx1) and 5 (idx2); smaller = 2 → swap
        cmp = fit_label("children 2 and 5 → smaller is 2 → swap", 10.5, 22, C_ACTIVE).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(cmp),
                  Indicate(tree.nodes[1], color=EMERALD, scale_factor=1.12),
                  Indicate(tree.nodes[2], color=INK_MUTED, scale_factor=1.05), run_time=1.4)
        self.play(sifter.animate.move_to(tree.xy[1]),
                  child_at_1.animate.move_to(tree.xy[0]), run_time=1.2)
        recolor_node(tree.nodes[0], C_ROOT)     # 2 is now the root/min
        recolor_node(tree.nodes[1], C_ACTIVE)   # 7 sifting at idx1
        wait_until(self, 6.5)

        # children of idx1: 3 (idx3), 4 (idx4); smaller = 3 → swap
        cmp2 = fit_label("children 3 and 4 → smaller is 3 → swap, then it settles", 12.0, 22, C_ACTIVE)
        cmp2.to_edge(DOWN, buff=0.6)
        self.play(Transform(cmp, cmp2),
                  Indicate(tree.nodes[3], color=EMERALD, scale_factor=1.12), run_time=1.2)
        self.play(sifter.animate.move_to(tree.xy[3]),
                  child_at_3.animate.move_to(tree.xy[1]), run_time=1.2)
        recolor_node(tree.nodes[1], C_NODE, fill=0.10)
        recolor_node(tree.nodes[3], EMERALD)   # 7 now a leaf, promise holds
        self.guard(tree, cmp)
        pace_to(self, self.cue_duration)


# ─── Cue05 : one root-to-leaf path → O(log n) ────────────────────────────────
class Cue05(AvoScene):
    headline = "One root-to-leaf path → about log n work"
    cue_duration = 8.0

    def construct(self):
        vals = [2, 3, 5, 7, 4, 9, 8]
        tree = tree_of(vals)
        recolor_node(tree.nodes[0], C_ROOT)
        self.add(tree)
        wait_until(self, 1.0)

        # light the spine 0 → 1 → 3
        spine = VGroup(
            Line(tree.xy[0], tree.xy[1], stroke_color=C_SPINE, stroke_width=6),
            Line(tree.xy[1], tree.xy[3], stroke_color=C_SPINE, stroke_width=6),
        )
        for i in (0, 1, 3):
            recolor_node(tree.nodes[i], C_SPINE)
        self.play(FadeIn(spine), run_time=1.4)
        bound = MathTex(r"\text{height} \approx \log_2 n \;\Rightarrow\; ", r"O(\log n)",
                        color=INK).scale(0.95).to_edge(DOWN, buff=0.7)
        bound[1].set_color(EMERALD)
        self.play(Write(bound), run_time=1.4)
        self.play(Circumscribe(bound[1], color=EMERALD), run_time=1.2)
        self.guard(tree, spine, bound)
        pace_to(self, self.cue_duration)
