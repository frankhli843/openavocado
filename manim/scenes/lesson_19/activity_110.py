"""
Lesson 19 — Part 2 (activity 110): "The size-k min-heap trick" (83.8s, 6 cues).

The concrete k-th-largest walkthrough behind the orientation's "size-k top-k"
application. Find the k-th largest with a size-k MIN-heap: keep only the k
biggest seen so far; the min-heap's root is the smallest of those k — exactly
the k-th largest.

  k = 3, stream  5, 2, 8, 1, 9, 3, 7
  fill first 3   → min-heap {2, 5, 8}, root 2
  9 arrives      → push (size 4 > cap) → pop root 2 → {5, 8, 9}, root 5
  after the run  → the 3 largest are {7, 8, 9}; root 7 = the 3rd largest
  (sorted desc 9,8,7,5,3,2,1 → 3rd largest is indeed 7)

Cue00 0-15.2     The first k just go in — nothing evicted until the cap is hit
Cue01 15.2-33.5  Over cap: pop the root, the smallest candidate, and it leaves
Cue02 33.5-50.8  The root is the smallest of the k largest = the k-th largest
Cue03 50.8-67    Why MIN not MAX: keep the smallest winner on the chopping block
Cue04 67-76.1    Each op touches a size-k heap → n log k time, k slots
Cue05 76.1-83.8  The max-heap instinct evicts winners → wrong answer

Uses heap.py (heap_tree, cap_badge, recolor_node) + arrays.py value_row for the
stream. MathTex reserved for the n log k bound.
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
    cap_badge,
    recolor_node,
    root_marker,
    C_ROOT,
    C_ACTIVE,
    C_NEW,
    C_EVICT,
    C_NODE,
)
from arrays import value_row, recolor_cell
from bayes import fit_label
from manim import (
    VGroup,
    Text,
    MathTex,
    Circle,
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

STREAM = [5, 2, 8, 1, 9, 3, 7]
K = 3
TREE_TOP = 1.5
TREE_LG = 1.55
TREE_W = 4.6


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def mini_heap(values, center=(0, 0.2, 0)):
    """A 3-node min-heap (root + two children) centered on screen."""
    t = heap_tree(values, r=0.5, fs=34, top=TREE_TOP, level_gap=TREE_LG, width=TREE_W)
    t.move_to(list(center))
    return t


def stream_row(values, highlight_upto=-1, y=2.55):
    row = value_row(values, w=0.72, h=0.72, fs=26, gap=0.14, index=False)
    row.move_to([0, y, 0])
    lab = Text("stream", font_size=20, color=INK_MUTED).next_to(row, LEFT, buff=0.3)
    return VGroup(row, lab), row


# ─── Cue00 : first k just go in ──────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Find the 3rd largest: keep only the 3 biggest so far"
    cue_duration = 15.2

    def construct(self):
        streamg, srow = stream_row(STREAM)
        self.play(FadeIn(streamg), run_time=1.2)
        cap = cap_badge(K, color=ACCENT).move_to([4.9, 2.1, 0])
        self.play(FadeIn(cap), run_time=0.8)
        wait_until(self, 3.5)

        # first three stream values 5, 2, 8 flow into a min-heap {2,5,8}
        for i in range(3):
            recolor_cell(srow.cells[i], C_NEW)
        heap = mini_heap([2, 5, 8], center=(0, -0.4, 0))
        recolor_node(heap.nodes[0], C_ROOT)
        self.play(FadeIn(heap, shift=UP * 0.2), run_time=1.6)
        rm = root_marker(heap.nodes[0], "root = 2", side=LEFT, gap=0.4)
        self.play(FadeIn(rm), run_time=1.0)
        wait_until(self, 10)

        note = fit_label("under the cap → every value is admitted, nothing evicted yet",
                         12.5, 22, INK_MUTED).to_edge(DOWN, buff=0.5)
        self.play(FadeIn(note), run_time=1.2)
        self.guard(streamg, cap, heap, rm, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : over cap → pop the root ─────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Over the cap: pop the root — the smallest candidate"
    cue_duration = 18.3

    def construct(self):
        cap = cap_badge(K, color=ACCENT).move_to([4.9, 2.1, 0])
        heap = mini_heap([2, 5, 8], center=(0, 0.0, 0))
        recolor_node(heap.nodes[0], C_EVICT)   # root 2 is the smallest, on the block
        self.add(cap, heap)
        rm = root_marker(heap.nodes[0], "smallest of the 3", side=LEFT, gap=0.4, color=C_EVICT)
        self.add(rm)
        wait_until(self, 2.5)

        # a bigger value 9 arrives
        incoming = VGroup(
            Circle(radius=0.5, stroke_color=C_NEW, stroke_width=2.8,
                   fill_color=C_NEW, fill_opacity=0.15),
            Text("9", font_size=34, color=C_NEW, weight="BOLD"),
        ).move_to([5.0, 0.0, 0])
        tag = Text("new: 9", font_size=22, color=C_NEW).next_to(incoming, UP, buff=0.2)
        self.play(FadeIn(incoming), FadeIn(tag), run_time=1.2)
        push = fit_label("push 9 → size 4 > cap 3", 7.0, 23, C_NEW).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(push), run_time=1.0)
        wait_until(self, 8)

        # pop the root (2) — the smallest candidate leaves
        pop = fit_label("pop the root: 2 can't be one of the 3 largest — evict it",
                        12.5, 22, C_EVICT).to_edge(DOWN, buff=0.6)
        self.play(Transform(push, pop),
                  Circumscribe(heap.nodes[0], color=C_EVICT), run_time=1.4)
        evicted = VGroup(
            Circle(radius=0.42, stroke_color=C_EVICT, stroke_width=2.6, fill_color=C_EVICT, fill_opacity=0.12),
            Text("2", font_size=30, color=C_EVICT, weight="BOLD"),
        ).move_to([-5.0, 0.0, 0])
        elab = Text("evicted", font_size=20, color=C_EVICT).next_to(evicted, UP, buff=0.2)
        self.play(heap.labels[0].animate.move_to(evicted.get_center()),
                  FadeIn(evicted[0]), FadeIn(elab), run_time=1.4)
        self.remove(heap.labels[0])
        self.add(evicted[1])
        wait_until(self, 14)

        # 9 settles into the heap; min-heap re-settles to {5,8,9} with root 5
        self.play(incoming.animate.move_to(heap.xy[2]).scale(0.85), FadeOut(tag), run_time=1.0)
        self.remove(incoming)
        # relabel: root becomes 5 (was child), 9 takes a child slot; show final {5,8,9}
        final = mini_heap([5, 8, 9], center=(0, 0.0, 0))
        recolor_node(final.nodes[0], C_ROOT)
        self.play(FadeOut(heap), FadeOut(rm), FadeIn(final), run_time=1.0)
        rm2 = root_marker(final.nodes[0], "root = 5", side=LEFT, gap=0.4)
        self.play(FadeIn(rm2), run_time=0.8)
        self.guard(final, cap, rm2, push)
        pace_to(self, self.cue_duration)


# ─── Cue02 : root = k-th largest ─────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "The root is the smallest of the 3 largest = the 3rd largest"
    cue_duration = 17.3

    def construct(self):
        # after the whole stream, the 3 largest are {7,8,9}
        heap = mini_heap([7, 8, 9], center=(-2.4, 0.0, 0))
        recolor_node(heap.nodes[0], C_ROOT)
        self.play(FadeIn(heap), run_time=1.4)
        rm = root_marker(heap.nodes[0], "root = 7", side=DOWN, gap=0.35)
        self.play(FadeIn(rm), run_time=0.9)
        wait_until(self, 4)

        # the full sorted context on the right
        sorted_vals = [9, 8, 7, 5, 3, 2, 1]
        srow = value_row(sorted_vals, w=0.6, h=0.6, fs=24, gap=0.1, index=False)
        srow.arrange(DOWN, buff=0.12)
        srow.move_to([3.4, 0.0, 0])
        slabel = Text("all values, sorted ↓", font_size=20, color=INK_MUTED).next_to(srow, UP, buff=0.22)
        self.play(FadeIn(srow), FadeIn(slabel), run_time=1.4)
        wait_until(self, 9)

        # bracket the top 3 (9,8,7) and point 7 as the answer
        for i in range(3):
            recolor_cell(srow.cells[i], EMERALD)
        top3 = Text("the 3 largest", font_size=20, color=EMERALD).next_to(srow.cells[1], RIGHT, buff=0.3)
        self.play(FadeIn(top3),
                  Indicate(srow.cells[2], color=EMERALD, scale_factor=1.2), run_time=1.4)
        wait_until(self, 13)

        ans = fit_label("7 is the smallest winner → the 3rd largest",
                        11.0, 23, EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(ans),
                  Circumscribe(heap.nodes[0], color=EMERALD), run_time=1.4)
        self.guard(heap, srow, slabel, ans)
        pace_to(self, self.cue_duration)


# ─── Cue03 : why min not max ─────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Why a MIN-heap: keep the smallest winner on the chopping block"
    cue_duration = 16.2

    def construct(self):
        # left: MIN-heap (correct); right: MAX-heap (wrong instinct)
        minh = mini_heap([7, 8, 9], center=(-3.4, 0.2, 0))
        recolor_node(minh.nodes[0], C_ROOT)
        minlab = Text("MIN-heap ✓", font_size=24, color=EMERALD, weight="BOLD").next_to(minh, UP, buff=0.35)
        self.play(FadeIn(minh), FadeIn(minlab), run_time=1.4)
        wait_until(self, 4)

        minnote = fit_label("root 7 is first to be popped — the weakest survivor guards the door",
                            12.5, 21, EMERALD).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(minnote), Indicate(minh.nodes[0], color=EMERALD, scale_factor=1.12), run_time=1.4)
        wait_until(self, 8)

        maxh = mini_heap([9, 7, 8], center=(3.4, 0.2, 0))
        recolor_node(maxh.nodes[0], C_EVICT)
        maxlab = Text("MAX-heap ✗", font_size=24, color=ROSE, weight="BOLD").next_to(maxh, UP, buff=0.35)
        self.play(FadeIn(maxh), FadeIn(maxlab), run_time=1.2)
        wait_until(self, 13)

        maxnote = fit_label("a max-heap guards 9 at the top — you'd pop the biggest, not the k-th",
                            12.5, 21, ROSE).to_edge(DOWN, buff=0.55)
        self.play(Transform(minnote, maxnote),
                  Indicate(maxh.nodes[0], color=ROSE, scale_factor=1.12), run_time=1.4)
        self.guard(minh, maxh, minlab, maxlab, minnote)
        pace_to(self, self.cue_duration)


# ─── Cue04 : complexity n log k ──────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Each op touches a size-k heap → n log k, k slots"
    cue_duration = 9.1

    def construct(self):
        heap = mini_heap([7, 8, 9], center=(-3.6, 0.2, 0))
        recolor_node(heap.nodes[0], C_ROOT)
        slots = Text("only k = 3 slots", font_size=22, color=ACCENT).next_to(heap, DOWN, buff=0.4)
        self.play(FadeIn(heap), FadeIn(slots), run_time=1.3)
        wait_until(self, 3)

        bound = MathTex(r"n \text{ pushes} \times \log k \text{ per op} \;=\; ", r"O(n \log k)",
                        color=INK).scale(0.95).move_to([1.6, 0.5, 0])
        bound[1].set_color(EMERALD)
        self.play(Write(bound), run_time=1.4)
        cmp = fit_label("beats sort's O(n log n) when k ≪ n, and uses only k memory",
                        11.5, 22, INK_MUTED).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(cmp), Circumscribe(bound[1], color=EMERALD), run_time=1.4)
        self.guard(heap, slots, bound, cmp)
        pace_to(self, self.cue_duration)


# ─── Cue05 : the max-heap misconception ──────────────────────────────────────
class Cue05(AvoScene):
    headline = "The max-heap instinct evicts winners → wrong answer"
    cue_duration = 7.7

    def construct(self):
        wrong = fit_label("“k-th largest → max-heap” feels right, but a max-heap pops the LARGEST",
                          13.0, 23, ROSE).move_to([0, 1.1, 0])
        self.play(FadeIn(wrong), run_time=1.3)
        wait_until(self, 3)

        fix = fit_label("keep a MIN-heap of size k — its root is the answer",
                        12.0, 24, EMERALD).move_to([0, -0.6, 0])
        self.play(Write(fix), run_time=1.4)
        self.play(Circumscribe(fix, color=EMERALD), run_time=1.2)
        self.guard(wrong, fix)
        pace_to(self, self.cue_duration)
