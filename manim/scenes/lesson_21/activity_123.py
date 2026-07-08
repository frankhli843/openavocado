"""
Lesson 21 — Part 1 (activity 123): "The template via subsets" (99.6s, 6 cues).

One running subsets decision tree of {1,2,3} (the forward-only start-index tree:
every node is a subset, added in increasing order) sits centered on the stage,
with the shared `path` list and a one-line skeleton in the lower band. Each cue
lights up one beat of the Choose / Record / Un-choose template on the SAME tree,
so the template reads as motion on one structure, not six unrelated pictures.

Cue0 0-18.1    One shared path list; every node of the tree is a subset.
Cue1 18.1-37.4 Choose: push nums[i] onto path, recurse one level deeper (∅→[1]).
Cue2 37.4-57.4 Record: every node is a valid subset → save a COPY of the path.
Cue3 57.4-77.3 Un-choose: pop the element so the path is restored for the next branch.
Cue4 77.3-90.6 Start index: loop from a start index forward → each subset once, increasing.
Cue5 90.6-99.6 Balanced: path empty again; every push had a pop. O(2^n) / O(n!).

Uses the backtracking.py idiom lib. MathTex only for the complexity bounds.
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
from backtracking import (
    subsets_model,
    TreeMobject,
    PathList,
    snapshot_chip,
    complexity,
    code_line,
    fit_label,
    chip,
    C_REST,
    C_PATH,
    C_SAVE,
    C_POP,
    EMPTY,
)
from manim import (
    VGroup,
    Text,
    RoundedRectangle,
    SurroundingRectangle,
    Arrow,
    FadeIn,
    FadeOut,
    Write,
    Create,
    Indicate,
    GrowFromCenter,
    TransformFromCopy,
    RIGHT,
    LEFT,
    UP,
    DOWN,
)

# ── shared layout for the subsets tree {1,2,3} ───────────────────────────────
TOP = 2.72
LG = 1.16
XG = 2.2
XC = 0.0
NFS = 24


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def subs_tree():
    m, order = subsets_model([1, 2, 3])
    t = TreeMobject(m, top=TOP, level_gap=LG, x_gap=XG, node_h=0.58, fs=NFS, x_center=XC)
    return m, t, order


def path_at(values):
    """A PathList anchored in the lower band, pre-filled with `values`."""
    pl = PathList(name="path", cell=0.66, fs=26)
    pl.to_edge(LEFT, buff=1.1).shift(DOWN * 2.05)
    for v in values:
        pl.push_cell(v)
    return pl


# ─── Cue00 : shared list, every node is a subset ─────────────────────────────
class Cue00(AvoScene):
    headline = "One shared path list — every node of the tree is a subset"
    cue_duration = 18.1

    def construct(self):
        m, t, order = subs_tree()
        # grow the tree edges + nodes
        self.play(Create(t._edges_grp), run_time=1.6)
        self.play(FadeIn(t._nodes_grp), run_time=1.4)
        wait_until(self, 5.0)

        # highlight that every node is a subset (root = ∅)
        t.recolor_node(0, ACCENT, fill=0.18)
        self.play(Indicate(t.node[0], color=ACCENT, scale_factor=1.15), run_time=1.0)
        note = fit_label("root = ∅ (the empty subset)", 6.0, 22, INK_MUTED).move_to([0, -1.35, 0])
        self.play(FadeIn(note), run_time=0.9)
        wait_until(self, 10.5)

        # the shared path list
        pl = path_at([])
        self.play(FadeIn(pl), run_time=1.0)
        note2 = fit_label("one path list, carried down every branch", 7.4, 22, INK_MUTED)
        note2.move_to([0, -2.75, 0])
        self.play(FadeIn(note2), run_time=1.0)
        self.guard(t, pl, note, note2)
        pace_to(self, self.cue_duration)


# ─── Cue01 : Choose — push, recurse deeper ───────────────────────────────────
class Cue01(AvoScene):
    headline = "Choose: push the element onto the path, then recurse deeper"
    cue_duration = 19.3

    def construct(self):
        m, t, order = subs_tree()
        self.add(t)
        pl = path_at([])
        self.add(pl)

        skel = VGroup(
            code_line("path.push(nums[i])", color=ACCENT, fs=24),
            code_line("backtrack(i + 1)", color=ACCENT_LIGHT, fs=24),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.22)
        skel.to_edge(RIGHT, buff=0.9).shift(DOWN * 1.9)
        self.play(FadeIn(skel), run_time=1.0)
        wait_until(self, 3.0)

        # highlight the ∅ root, then choose +1 → node "1"
        t.recolor_node(0, ACCENT, fill=0.16)
        self.play(Indicate(t.node[0], color=ACCENT), run_time=0.8)
        cell = pl.push_cell(1)
        self.play(GrowFromCenter(cell), run_time=0.7)
        # light the +1 edge and node "1"
        t.recolor_edge(1, ACCENT, width=3.4)
        t.recolor_node(1, ACCENT, fill=0.20)
        self.play(Create(t.edge[1].line), Indicate(t.node[1], color=ACCENT), run_time=1.1)
        wait_until(self, 9.5)

        # emphasize "one level deeper"
        arr = Arrow(t.node[0].get_bottom(), t.node[1].get_top(), buff=0.08,
                    color=ACCENT, stroke_width=5)
        deeper = fit_label("recurse: one level deeper", 5.4, 22, INK_MUTED).move_to([0, -1.35, 0])
        self.play(GrowFromCenter(arr), FadeIn(deeper), run_time=1.0)
        wait_until(self, 15.0)
        self.play(Indicate(pl.cells[0], color=ACCENT), run_time=0.8)
        self.guard(t, pl, skel)
        pace_to(self, self.cue_duration)


# ─── Cue02 : Record — save a COPY ────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Record: every node is a subset — save a COPY of the path"
    cue_duration = 20.0

    def construct(self):
        m, t, order = subs_tree()
        # path is at [1]; light that branch
        t.color_path(1, color=ACCENT)
        self.add(t)
        pl = path_at([1])
        self.add(pl)

        # results shelf on the right
        shelf_title = Text("results", font_size=22, color=EMERALD, weight="BOLD")
        shelf_title.to_edge(RIGHT, buff=1.4).shift(UP * 1.6)
        self.play(FadeIn(shelf_title), run_time=0.8)
        wait_until(self, 3.0)

        # save ∅ = [] and [1] as COPIES
        saves = []
        for k, vals in enumerate([[], [1]]):
            snap = snapshot_chip(vals)
            snap.next_to(shelf_title, DOWN, buff=0.35 + k * 0.85, aligned_edge=RIGHT)
            src = pl if vals else t.node[0]
            self.play(TransformFromCopy(pl.bracket_l if vals else t.node[0], snap), run_time=1.1)
            saves.append(snap)
            wait_until(self, 6.0 + k * 3.0)

        # copy-not-reference warning
        warn = fit_label("save a COPY, never the live list", 6.4, 24, AMBER).move_to([0, -1.25, 0])
        self.play(Indicate(saves[1], color=EMERALD), FadeIn(warn), run_time=1.2)
        why = fit_label("later pops would corrupt a saved reference", 7.6, 21, INK_MUTED)
        why.move_to([0, -1.75, 0])
        self.play(FadeIn(why), run_time=1.0)
        self.guard(t, pl, warn, why)
        pace_to(self, self.cue_duration)


# ─── Cue03 : Un-choose — pop, restore ────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Un-choose: pop the element so the path is restored"
    cue_duration = 19.9

    def construct(self):
        m, t, order = subs_tree()
        # start with [1] branch fully explored (dim its subtree), path=[1]
        t.color_path(1, color=ACCENT)
        self.add(t)
        pl = path_at([1])
        self.add(pl)

        code = code_line("path.pop()", color=C_POP, fs=26)
        code.to_edge(RIGHT, buff=1.2).shift(UP * 0.2)
        self.play(FadeIn(code), run_time=1.0)
        wait_until(self, 3.5)

        # pop 1 → path empty; node "1" dims back to rest
        popped = pl.pop_cell()
        self.play(popped.animate.shift(DOWN * 0.9).set_opacity(0.0), run_time=1.0)
        self.remove(popped)
        t.recolor_node(1, C_REST, fill=0.08, width=2.4)
        t.recolor_edge(1, C_REST, width=2.2)
        t.recolor_node(0, ACCENT, fill=0.16)
        self.play(Indicate(t.node[0], color=AMBER), run_time=1.0)
        wait_until(self, 10.0)

        restored = fit_label("path restored — next branch starts clean", 7.8, 22, INK_MUTED)
        restored.move_to([0, -1.3, 0])
        self.play(FadeIn(restored), run_time=1.0)
        wait_until(self, 14.5)
        # now the next branch: +2 → node "2"
        cell = pl.push_cell(2, color=ACCENT)
        t.recolor_edge(5, ACCENT, width=3.4)
        t.recolor_node(5, ACCENT, fill=0.20)
        self.play(GrowFromCenter(cell), Create(t.edge[5].line),
                  Indicate(t.node[5], color=ACCENT), run_time=1.2)
        self.guard(t, pl, restored)
        pace_to(self, self.cue_duration)


# ─── Cue04 : Start index — only look forward ─────────────────────────────────
class Cue04(AvoScene):
    headline = "Start index: loop forward → each subset once, in increasing order"
    cue_duration = 13.3

    def construct(self):
        m, t, order = subs_tree()
        self.add(t)

        code = code_line("for i in range(start, n):", color=ACCENT, fs=25)
        code.move_to([0, -1.55, 0])
        self.play(FadeIn(code), run_time=1.0)
        wait_until(self, 2.5)

        # from node "1" you only branch forward to 2,3 — never back to 1
        t.recolor_node(1, ACCENT, fill=0.18)
        self.play(Indicate(t.node[1], color=ACCENT), run_time=0.8)
        for nid in (2, 4):  # "1 2", "1 3"
            t.recolor_edge(nid, EMERALD, width=3.2)
            t.recolor_node(nid, EMERALD, fill=0.16)
        self.play(*[Indicate(t.node[k], color=EMERALD) for k in (2, 4)], run_time=1.1)
        wait_until(self, 8.0)

        note = fit_label("forward-only → no duplicate subsets", 6.8, 22, INK_MUTED)
        note.move_to([0, -2.25, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.guard(t, code, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : Balanced — every push had a pop + complexity ────────────────────
class Cue05(AvoScene):
    headline = "Balanced: the path is empty again — every push had a pop"
    cue_duration = 9.0

    def construct(self):
        m, t, order = subs_tree()
        t.fade_ids(list(m.nodes.keys())[1:], opacity=0.5)
        t.recolor_node(0, ACCENT, fill=0.16)
        self.add(t)

        pl = path_at([])
        empty = fit_label("path = [ ]  →  no state leaked", 6.2, 24, EMERALD)
        empty.move_to([0, -1.35, 0])
        self.play(FadeIn(pl), FadeIn(empty), run_time=1.0)
        wait_until(self, 3.5)

        cx = complexity(r"\text{subsets } O(2^{n}) \qquad \text{permutations } O(n!)",
                        color=INK, fs=40)
        theme.fit_to_stage(cx, width_frac=0.94)
        cx.move_to([0, -2.35, 0])
        self.play(Write(cx), run_time=1.4)
        self.guard(t, pl, empty, cx)
        pace_to(self, self.cue_duration)
