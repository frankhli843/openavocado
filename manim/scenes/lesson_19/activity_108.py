"""
Lesson 19 — Orientation (activity 108): "Heap — the family map"
(818.5s / ~13.6min overview audio).

The overview audio is the high-level map of the whole heap / priority-queue
family. Following the proven orientation pattern (acts 7/14/38/98/103), the
timeline is the SEVEN designed cues spread over the real duration, each authored
for the actual heap content:

  Cue00 0-95.9      The problem: the min again and again as data changes → a full
                    O(n) scan every time is wasteful
  Cue01 95.9-217.4  The invariant: a LOCAL promise (parent ≤ children) forces the
                    min to the root while leaving the rest only loosely ordered
  Cue02 217.4-345.3 Stored as a flat array — parent/children are pure index
                    arithmetic, no pointers
  Cue03 345.3-473.2 The two operations: insert drops at the end + sifts up;
                    remove lifts the last leaf to the root + sifts down
  Cue04 473.2-601.1 The applications: size-k top-k, k-way merge, priority
                    scheduling, streaming median with two heaps
  Cue05 601.1-729   Python's heapq is min-only: push negated values, negate out
  Cue06 729-818.5   When NOT to use it: one-shot extreme (a single scan wins),
                    no full order, no middle lookups

Each long cue stages its reveals via wait_until(scene, t) so the frame keeps
changing with the narration; pace_to fills the remainder to the exact cue
duration. Uses the heap.py + arrays.py idiom libs (heap_tree, heap_array,
index_math, value_row, code_line). MathTex is reserved for the bounds.
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
from heap import (
    heap_tree,
    heap_array,
    recolor_node,
    root_marker,
    index_math,
    index_link,
    node_xy,
    C_ROOT,
    C_ACTIVE,
    C_NEW,
    C_EVICT,
    C_SPINE,
    C_NODE,
)
from arrays import value_row, recolor_cell, complexity, code_line
from bayes import chip, fit_label
from manim import (
    VGroup,
    Text,
    MathTex,
    Circle,
    Line,
    Arrow,
    RoundedRectangle,
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

HEAP = [1, 3, 5, 7, 4, 9, 8]   # the running example min-heap


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def tree_of(values, top=2.0, lg=1.42, width=9.2, r=0.42, fs=30):
    return heap_tree(values, r=r, fs=fs, top=top, level_gap=lg, width=width)


def app_card(title, subtitle, color, w=5.6, h=1.5):
    box = RoundedRectangle(width=w, height=h, corner_radius=0.16,
                           stroke_color=color, stroke_width=2.6,
                           fill_color=color, fill_opacity=0.08)
    t = Text(title, font_size=25, color=color, weight="BOLD")
    s = fit_label(subtitle, w - 0.5, 19, INK_MUTED)
    VGroup(t, s).arrange(DOWN, buff=0.16).move_to(box.get_center())
    return VGroup(box, t, s)


# ─── Cue00 : the problem — repeated min under change ─────────────────────────
class Cue00(AvoScene):
    headline = "You need the smallest — again and again — as data changes"
    cue_duration = 95.9

    def construct(self):
        arr = value_row([5, 2, 8, 1, 9, 3], w=0.92, h=0.92, fs=32, gap=0.2, index=False)
        arr.move_to([0, 1.4, 0])
        self.play(FadeIn(arr, shift=UP * 0.2), run_time=1.8)
        wait_until(self, 12)

        # query 1: scan every cell to find the min (1 at index 3)
        q1 = fit_label("“give me the smallest” → scan all n cells", 11.0, 26, ACCENT)
        q1.move_to([0, -0.4, 0])
        self.play(FadeIn(q1), run_time=1.2)
        for i in range(len(arr.cells)):
            self.play(Indicate(arr.cells[i], color=AMBER, scale_factor=1.1), run_time=0.5)
        recolor_cell(arr.cells[3], EMERALD)
        found1 = fit_label("found: 1 — after touching every element", 10.5, 23, EMERALD)
        found1.move_to([0, -1.6, 0])
        self.play(FadeIn(found1), run_time=1.2)
        wait_until(self, 40)

        # data changes: 1 is removed, a new value 0 arrives
        self.play(FadeOut(found1), run_time=0.6)
        change = fit_label("now the data changes — remove the 1, a new value arrives",
                           12.5, 23, VIOLET).move_to([0, -0.4, 0])
        self.play(Transform(q1, change), run_time=0.8)
        recolor_cell(arr.cells[3], ROSE)
        self.play(Indicate(arr.cells[3], color=ROSE, scale_factor=1.15), run_time=1.2)
        arr2 = value_row([5, 2, 8, 6, 9, 3], w=0.92, h=0.92, fs=32, gap=0.2, index=False)
        arr2.move_to([0, 1.4, 0])
        self.play(Transform(arr, arr2), run_time=1.4)
        wait_until(self, 62)

        # query 2: another full scan
        q3 = fit_label("“give me the smallest” again → scan all n cells AGAIN",
                       12.5, 25, ACCENT).move_to([0, -0.4, 0])
        self.play(Transform(q1, q3), run_time=0.8)
        for i in range(6):
            self.play(Indicate(arr.cells[i], color=AMBER, scale_factor=1.08), run_time=0.4)
        wait_until(self, 80)

        cost = MathTex(r"q \text{ queries} \times O(n) \text{ each} \;=\; ", r"O(q\,n)",
                       color=INK).scale(0.95).move_to([0, -1.7, 0])
        cost[1].set_color(ROSE)
        self.play(Write(cost), run_time=1.6)
        tease = fit_label("wasteful — what if the structure kept the smallest ready?",
                          12.5, 23, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(tease), run_time=1.2)
        self.guard(arr, q1, cost, tease)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the invariant — local promise, global min ───────────────────────
class Cue01(AvoScene):
    headline = "A local promise forces the minimum to the root"
    cue_duration = 121.5

    def construct(self):
        tree = tree_of(HEAP)
        self.play(FadeIn(tree, shift=UP * 0.2), run_time=1.8)
        wait_until(self, 14)

        # the local promise at three nodes
        promise = fit_label("the only rule: every parent ≤ both of its children",
                            12.0, 25, AMBER).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(promise), run_time=1.2)
        for i in (0, 1, 2):
            lc, rc = 2 * i + 1, 2 * i + 2
            self.play(Indicate(tree.nodes[i], color=AMBER, scale_factor=1.12),
                      Indicate(tree.nodes[lc], color=INK_MUTED, scale_factor=1.05),
                      Indicate(tree.nodes[rc], color=INK_MUTED, scale_factor=1.05), run_time=1.6)
        wait_until(self, 46)

        # the consequence: min chains up to the root
        recolor_node(tree.nodes[0], C_ROOT)
        rm = root_marker(tree.nodes[0], "the minimum lives here", side=LEFT, gap=0.35)
        chain = fit_label("every parent ≤ its children, so no value can beat the root — "
                          "the global minimum is forced to the top",
                          13.0, 21, EMERALD).to_edge(DOWN, buff=0.5)
        self.play(Transform(promise, chain), FadeIn(rm),
                  Circumscribe(tree.nodes[0], color=EMERALD), run_time=1.8)
        wait_until(self, 78)

        # but only LOOSELY ordered — cousins are not comparable
        loose = fit_label("but only loosely ordered — 7 (left) and 5 (right) are never compared",
                          13.0, 21, ROSE).to_edge(DOWN, buff=0.5)
        self.play(Transform(promise, loose),
                  Indicate(tree.nodes[3], color=ROSE, scale_factor=1.12),
                  Indicate(tree.nodes[2], color=ROSE, scale_factor=1.12), run_time=1.8)
        wait_until(self, 104)

        # contrast: a fully sorted array is stronger but expensive to keep
        contrast = fit_label("a sorted array is fully ordered but costly to maintain — a heap keeps "
                             "just enough order to serve the min",
                             13.2, 20, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(Transform(promise, contrast), run_time=1.4)
        self.guard(tree, rm, promise)
        pace_to(self, self.cue_duration)


# ─── Cue02 : stored as a flat array — index arithmetic ───────────────────────
class Cue02(AvoScene):
    headline = "Stored as a flat array — indexes, not pointers"
    cue_duration = 127.9

    def construct(self):
        tree = tree_of(HEAP, top=2.3, lg=1.2, width=7.2, r=0.36, fs=26)
        arr = heap_array(HEAP, w=0.78, h=0.78, fs=26, gap=0.12, y=-2.5)
        self.play(FadeIn(tree), run_time=1.4)
        self.play(FadeIn(arr, shift=UP * 0.15), run_time=1.4)
        wait_until(self, 16)

        # link each tree node to its array cell (identity by index)
        links = VGroup(*[index_link(tree.nodes[i], arr.cells[i]) for i in range(len(HEAP))])
        self.play(FadeIn(links), run_time=1.6)
        same = fit_label("node i in the tree = cell i in the array — same value, same index",
                         13.0, 21, VIOLET).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(same), run_time=1.2)
        wait_until(self, 44)

        # clear the right half: fade the links, slide the tree+array left
        views = VGroup(tree, arr)
        self.play(FadeOut(links), views.animate.shift(LEFT * 3.0), run_time=1.4)

        # reveal the index arithmetic in the cleared right space
        formulas = index_math(fs=28).move_to([3.5, 0.5, 0])
        self.play(Write(formulas.parent_line), run_time=1.2)
        wait_until(self, 66)
        self.play(Write(formulas.left_line), Write(formulas.right_line), run_time=1.4)
        wait_until(self, 88)

        # trace index 3: parent (3-1)//2 = 1
        trace = fit_label("index 3 → parent (3−1)//2 = 1 ✓ — pure arithmetic, no stored links",
                          13.0, 21, ACCENT).to_edge(DOWN, buff=0.55)
        self.play(Transform(same, trace),
                  Indicate(tree.nodes[3], color=ACCENT, scale_factor=1.15),
                  Indicate(tree.nodes[1], color=ACCENT, scale_factor=1.15), run_time=1.8)
        self.play(Indicate(arr.cells[3], color=ACCENT, scale_factor=1.12),
                  Indicate(arr.cells[1], color=ACCENT, scale_factor=1.12),
                  Indicate(formulas.parent_line, color=ACCENT, scale_factor=1.1), run_time=1.4)
        wait_until(self, 112)

        nopt = fit_label("contiguous memory, no allocation, cache-friendly — the array IS the tree",
                         13.2, 20, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(Transform(same, nopt), run_time=1.4)
        self.guard(tree, arr, formulas, same)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the two operations ──────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Two operations: insert sifts up, remove sifts down"
    cue_duration = 127.9

    def construct(self):
        tree = tree_of(HEAP, top=2.1, lg=1.35, width=8.8)
        recolor_node(tree.nodes[0], C_ROOT)
        self.play(FadeIn(tree), run_time=1.4)
        wait_until(self, 12)

        # INSERT: drop at the end, sift UP
        ins = fit_label("INSERT: drop the new value at the end, then sift UP toward the root",
                        13.0, 22, ACCENT).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(ins), run_time=1.2)
        # a new leaf at index 7 with an up-arrow spine
        leaf_xy = node_xy(7, 2.1, 1.35, 8.8)
        newleaf = VGroup(
            Circle(radius=0.38, stroke_color=C_NEW, stroke_width=2.6, fill_color=C_NEW, fill_opacity=0.14),
            Text("2", font_size=24, color=C_NEW, weight="BOLD"),
        ).move_to(leaf_xy)
        newedge = Line(tree.xy[3], leaf_xy, stroke_color=INK_SUBTLE, stroke_width=2.2)
        self.play(FadeIn(newedge), FadeIn(newleaf), run_time=1.4)
        up_arrow = Arrow(leaf_xy, [tree.xy[0][0], tree.xy[0][1] - 0.5, 0],
                         color=ACCENT, stroke_width=5, buff=0.3,
                         max_tip_length_to_length_ratio=0.06)
        self.play(FadeIn(up_arrow), run_time=1.4)
        upnote = Text("swap up while smaller than its parent", font_size=21, color=ACCENT)
        upnote.move_to([2.7, -2.15, 0])
        self.play(FadeIn(upnote), run_time=1.2)
        wait_until(self, 58)

        # REMOVE: pop root, move last leaf up, sift DOWN
        self.play(FadeOut(up_arrow), FadeOut(upnote), FadeOut(newleaf), FadeOut(newedge), run_time=0.8)
        rem = fit_label("REMOVE: pop the root (the answer), move the last leaf up, then sift DOWN",
                        13.2, 22, ROSE).to_edge(DOWN, buff=0.5)
        self.play(Transform(ins, rem), run_time=1.0)
        self.play(Circumscribe(tree.nodes[0], color=EMERALD), run_time=1.4)
        down_arrow = Arrow([tree.xy[0][0], tree.xy[0][1] - 0.5, 0],
                           [tree.xy[6][0], tree.xy[6][1] + 0.5, 0],
                           color=ROSE, stroke_width=5, buff=0.3,
                           max_tip_length_to_length_ratio=0.06)
        self.play(FadeIn(down_arrow), run_time=1.4)
        downnote = Text("swap down with the smaller child", font_size=21, color=ROSE)
        downnote.move_to([-2.7, -2.15, 0])
        self.play(FadeIn(downnote), run_time=1.2)
        wait_until(self, 100)

        # both are one root-to-leaf path
        both = MathTex(r"\text{each fix = one root-to-leaf path} \;=\; ", r"O(\log n)",
                       color=INK).scale(0.92).to_edge(DOWN, buff=0.5)
        both[1].set_color(EMERALD)
        self.play(FadeOut(down_arrow), FadeOut(downnote), Transform(ins, both), run_time=1.4)
        self.play(Circumscribe(both[1], color=EMERALD), run_time=1.2)
        self.guard(tree, ins)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the applications family map ─────────────────────────────────────
class Cue04(AvoScene):
    headline = "Where heaps earn their keep"
    cue_duration = 127.9

    def construct(self):
        wait_until(self, 4)
        cards = [
            app_card("Size-k top-k", "a size-k min-heap keeps the k largest — root is the k-th", ACCENT),
            app_card("K-way merge", "one heap of the current fronts merges k sorted lists", AMBER),
            app_card("Priority scheduling", "always pull the highest-priority task next", EMERALD),
            app_card("Streaming median", "two heaps — a max-heap low half, a min-heap high half", VIOLET),
        ]
        positions = [[-3.1, 1.55, 0], [3.1, 1.55, 0], [-3.1, -0.35, 0], [3.1, -0.35, 0]]
        for c, p in zip(cards, positions):
            c.move_to(p)

        times = [8, 40, 72, 104]
        for c, t in zip(cards, times):
            wait_until(self, t)
            self.play(FadeIn(c, shift=UP * 0.15), run_time=1.4)
            self.play(Indicate(c[1], color=c[1].get_color(), scale_factor=1.05), run_time=1.0)

        wait_until(self, 120)
        common = fit_label("all the same shape: repeatedly serve an extreme as data streams in",
                           13.2, 21, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(common), run_time=1.4)
        self.guard(*cards, common)
        pace_to(self, self.cue_duration)


# ─── Cue05 : Python heapq is min-only ────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Python's heapq is a min-heap only"
    cue_duration = 127.9

    def construct(self):
        wait_until(self, 6)
        line1 = fit_label("heapq gives you a MIN-heap — there is no max flag",
                          12.5, 26, ACCENT).move_to([0, 2.2, 0])
        self.play(FadeIn(line1), run_time=1.4)
        wait_until(self, 30)

        # the negation trick as code
        code = VGroup(
            code_line("heapq.heappush(h, -x)   # store the negative", color=INK, fs=26),
            code_line("smallest_neg = heapq.heappop(h)", color=INK, fs=26),
            code_line("largest = -smallest_neg   # negate back", color=EMERALD, fs=26),
        ).arrange(DOWN, buff=0.34, aligned_edge=LEFT).move_to([0, 0.4, 0])
        self.play(Write(code[0]), run_time=1.4)
        wait_until(self, 58)
        self.play(Write(code[1]), run_time=1.3)
        wait_until(self, 84)
        self.play(Write(code[2]), run_time=1.3)
        self.play(Indicate(code[2], color=EMERALD, scale_factor=1.06), run_time=1.2)
        wait_until(self, 110)

        why = MathTex(r"\text{negating flips the order:}\quad -(-x) = x",
                      color=INK).scale(0.9).to_edge(DOWN, buff=0.6)
        self.play(Write(why), run_time=1.4)
        self.guard(line1, code, why)
        pace_to(self, self.cue_duration)


# ─── Cue06 : when NOT to use a heap ──────────────────────────────────────────
class Cue06(AvoScene):
    headline = "When a heap is the wrong tool"
    cue_duration = 89.5

    def construct(self):
        wait_until(self, 6)
        # one-shot extreme: a single scan wins
        one = fit_label("one-shot extreme? a single O(n) scan beats building a heap",
                        13.0, 23, ROSE).move_to([0, 1.9, 0])
        self.play(FadeIn(one), run_time=1.4)
        arr = value_row([5, 2, 8, 1, 9, 3], w=0.8, h=0.8, fs=28, gap=0.16, index=False)
        arr.move_to([0, 0.6, 0])
        self.play(FadeIn(arr), run_time=1.2)
        recolor_cell(arr.cells[3], EMERALD)
        self.play(Indicate(arr.cells[3], color=EMERALD, scale_factor=1.12), run_time=1.2)
        wait_until(self, 34)

        # no full order
        two = fit_label("need everything in order? a heap won't hand you a sorted list cheaply",
                        13.2, 22, AMBER).move_to([0, -0.8, 0])
        self.play(FadeIn(two), run_time=1.4)
        wait_until(self, 60)

        # no middle lookups
        three = fit_label("need the median or an arbitrary element? a heap only knows its root",
                          13.2, 22, VIOLET).move_to([0, -2.0, 0])
        self.play(FadeIn(three), run_time=1.4)
        wait_until(self, 80)

        self.play(Indicate(one, color=ROSE, scale_factor=1.03),
                  Indicate(two, color=AMBER, scale_factor=1.03),
                  Indicate(three, color=VIOLET, scale_factor=1.03), run_time=1.6)
        self.guard(one, arr, two, three)
        pace_to(self, self.cue_duration)
