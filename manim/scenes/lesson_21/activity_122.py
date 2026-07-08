"""
Lesson 21 — Orientation (activity 122): "Backtracking — walk the decision tree"
(844.1s, 7 long cues). The big-picture "what / why" before the two mechanics
parts. Each cue is 56-148s, so every scene builds progressively across several
beats and settles on one comprehensive, held final frame (3b1b style).

Cue0 0-119.6    Trigger: "find all the ways" needs a variable loop count → recursion.
Cue1 119.6-246.2 A tree of choices: every root-to-leaf path is one answer.
Cue2 246.2-393.9 Choose, explore, un-choose — the three beats on a shared path.
Cue3 393.9-534.6 Record a COPY at a complete state (reference bug vs copy).
Cue4 534.6-675.2 Prune early: an early rejection deletes the largest subtrees.
Cue5 675.2-787.8 Start index (subsets) vs used-array (permutations).
Cue6 787.8-844.1 When it fails: exponential / factorial; DP may fold it to a table.

Uses the backtracking.py idiom lib. MathTex only for complexity bounds.
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
    perm_model,
    TreeModel,
    TreeMobject,
    PathList,
    used_row,
    set_used,
    three_beats,
    snapshot_chip,
    complexity,
    code_line,
    fit_label,
    chip,
    C_REST,
    C_PATH,
    C_SAVE,
    C_POP,
    C_USED,
    C_PRUNE,
    EMPTY,
)
from manim import (
    VGroup,
    Text,
    RoundedRectangle,
    SurroundingRectangle,
    Arrow,
    Line,
    Cross,
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


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def subs_tree(top=2.5, lg=1.16, xg=1.95, xc=0.0, fs=24):
    m, order = subsets_model([1, 2, 3])
    t = TreeMobject(m, top=top, level_gap=lg, x_gap=xg, node_h=0.58, fs=fs, x_center=xc)
    return m, t, order


def code_block(lines, fs=26):
    grp = VGroup(*lines)
    grp.arrange(DOWN, aligned_edge=LEFT, buff=0.22)
    return grp


# ─── Cue00 : the trigger — variable loop count ───────────────────────────────
class Cue00(AvoScene):
    headline = '"Find all the ways" needs a loop count that depends on the input'
    cue_duration = 119.6

    def construct(self):
        # Beat 1: fixed nesting — all pairs = 2 loops
        pairs = code_block([
            code_line("for i in range(n):", color=INK, fs=26),
            code_line("for j in range(i+1, n):", color=INK, fs=26, indent=1),
            code_line("emit(i, j)", color=ACCENT, fs=26, indent=2),
        ])
        pairs.move_to([-3.4, 1.4, 0])
        cap1 = fit_label("all PAIRS → 2 nested loops", 5.2, 24, INK_MUTED).next_to(pairs, DOWN, buff=0.5)
        self.play(FadeIn(pairs), run_time=1.4)
        self.play(FadeIn(cap1), run_time=1.0)
        wait_until(self, 22)

        # Beat 2: all triples = 3 loops
        triples = code_block([
            code_line("for i:", color=INK, fs=26),
            code_line("for j:", color=INK, fs=26, indent=1),
            code_line("for k:", color=INK, fs=26, indent=2),
            code_line("emit(i, j, k)", color=ACCENT, fs=26, indent=3),
        ])
        triples.move_to([3.2, 1.5, 0])
        cap2 = fit_label("all TRIPLES → 3 nested loops", 5.4, 24, INK_MUTED).next_to(triples, DOWN, buff=0.5)
        self.play(FadeIn(triples), run_time=1.4)
        self.play(FadeIn(cap2), run_time=1.0)
        wait_until(self, 48)

        # Beat 3: all subsets of n → n loops? can't write them
        ask = fit_label("all SUBSETS of n items → n nested loops?", 9.4, 30, AMBER)
        ask.move_to([0, -0.55, 0])
        self.play(Write(ask), run_time=1.6)
        wait_until(self, 66)
        cant = fit_label("you cannot write a number of loops that depends on the input", 11.0, 26, ROSE)
        cant.move_to([0, -1.35, 0])
        self.play(FadeIn(cant), run_time=1.4)
        x = Cross(VGroup(pairs, triples), stroke_color=ROSE, stroke_width=5).scale(0.0)
        wait_until(self, 88)

        # Beat 4: resolution — one recursive walk enumerates every choice sequence
        fix = fit_label("backtracking: ONE recursive walk enumerates every choice sequence",
                        12.2, 26, EMERALD)
        fix.move_to([0, -2.35, 0])
        self.play(FadeIn(fix), run_time=1.6)
        self.guard(pairs, triples, ask, cant, fix)
        pace_to(self, self.cue_duration)


# ─── Cue01 : a tree of choices ───────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "A tree of choices — every root-to-leaf path is one answer"
    cue_duration = 126.6

    def construct(self):
        m, t, order = subs_tree(top=2.6, lg=1.2, xg=2.05, xc=0.0, fs=24)
        self.play(Create(t._edges_grp), run_time=2.0)
        self.play(FadeIn(t._nodes_grp), run_time=1.6)
        wait_until(self, 16)

        # each branch is a choice
        b1 = fit_label("each branch = a choice (include the next element, or not)",
                       11.0, 24, INK_MUTED).move_to([0, -1.35, 0])
        self.play(FadeIn(b1), run_time=1.2)
        for nid in (1, 5, 7):
            self.play(Indicate(t.edge[nid].choice_label, color=ACCENT), run_time=0.5)
        wait_until(self, 44)

        # a depth-first walk visits every candidate — sweep-highlight all nodes
        b2 = fit_label("a depth-first walk visits every candidate answer",
                       10.0, 24, INK_MUTED).move_to([0, -1.35, 0])
        self.play(FadeOut(b1), FadeIn(b2), run_time=1.0)
        for nid in order:
            t.recolor_node(nid, ACCENT_LIGHT, fill=0.10, width=2.6)
            self.play(Indicate(t.node[nid], color=ACCENT_LIGHT, scale_factor=1.08), run_time=0.35)
        wait_until(self, 84)

        # one root-to-leaf path = one answer
        b3 = fit_label("one root-to-leaf path = one complete answer", 9.6, 26, EMERALD)
        b3.move_to([0, -2.05, 0])
        self.play(FadeOut(b2), FadeIn(b3), run_time=1.0)
        ids = t.color_path(3, color=EMERALD)  # ∅ → 1 → 1 2 → 1 2 3
        self.play(*[Indicate(t.node[k], color=EMERALD) for k in ids], run_time=1.4)
        snap = snapshot_chip([1, 2, 3])
        snap.move_to([0, -2.75, 0])
        self.play(TransformFromCopy(t.node[3], snap), run_time=1.2)
        self.guard(t, b3, snap)
        pace_to(self, self.cue_duration)


# ─── Cue02 : choose, explore, un-choose ──────────────────────────────────────
class Cue02(AvoScene):
    headline = "Choose, explore, un-choose — the three beats on a shared path"
    cue_duration = 147.7

    def construct(self):
        # the three-beats template on the left
        beats = three_beats(fs=25, w=3.7, h=0.95, gap=0.45)
        beats.to_edge(LEFT, buff=0.7).shift(UP * 0.3)
        self.play(FadeIn(beats), run_time=1.6)
        wait_until(self, 12)

        # a small tree on the right + a path list below it
        m, t, order = subs_tree(top=2.55, lg=1.15, xg=1.5, xc=2.9, fs=22)
        self.play(Create(t._edges_grp), FadeIn(t._nodes_grp), run_time=1.8)
        pl = PathList(name="path", cell=0.6, fs=24)
        pl.move_to([2.9, -2.35, 0])
        self.play(FadeIn(pl), run_time=1.0)
        wait_until(self, 34)

        # Beat 1: CHOOSE — push 1, descend
        self.play(Indicate(beats.beats[0], color=C_PATH), run_time=1.0)
        c1 = pl.push_cell(1)
        t.color_path(1, color=ACCENT)
        self.play(GrowFromCenter(c1), Indicate(t.node[1], color=ACCENT), run_time=1.2)
        wait_until(self, 62)

        # Beat 2: EXPLORE — recurse to child 1 2
        self.play(Indicate(beats.beats[1], color=ACCENT_LIGHT), run_time=1.0)
        c2 = pl.push_cell(2)
        t.recolor_edge(2, ACCENT, width=3.2)
        t.recolor_node(2, ACCENT, fill=0.18)
        self.play(GrowFromCenter(c2), Indicate(t.node[2], color=ACCENT), run_time=1.2)
        wait_until(self, 96)

        # Beat 3: UN-CHOOSE — pop back to [1]
        self.play(Indicate(beats.beats[2], color=C_POP), run_time=1.0)
        popped = pl.pop_cell()
        self.play(popped.animate.shift(DOWN * 0.7).set_opacity(0.0), run_time=0.9)
        self.remove(popped)
        t.recolor_node(2, C_REST, fill=0.08, width=2.4)
        t.recolor_edge(2, C_REST, width=2.2)
        self.play(Indicate(t.node[1], color=AMBER), run_time=1.0)
        wait_until(self, 124)

        note = fit_label("push a choice · recurse · pop it back off — the path is the only shared state",
                         13.2, 24, INK_MUTED).move_to([0, -3.35, 0])
        self.play(FadeIn(note), run_time=1.4)
        self.guard(beats, t, pl, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : record a copy (reference bug vs copy) ───────────────────────────
class Cue03(AvoScene):
    headline = "Record a COPY at a complete state — never the live list"
    cue_duration = 140.7

    def construct(self):
        # left panel: the BUG (save a reference)
        bug_title = Text("save a reference (BUG)", font_size=26, color=ROSE, weight="BOLD")
        bug_title.move_to([-3.6, 2.2, 0])
        self.play(FadeIn(bug_title), run_time=1.0)

        live = PathList(name="path", cell=0.58, fs=24)
        for v in [1, 2]:
            live.push_cell(v)
        live.move_to([-3.6, 1.1, 0])
        self.play(FadeIn(live), run_time=1.0)
        # results all point at the SAME live list
        refs = VGroup()
        for k in range(3):
            r = chip("→ path", color=ROSE, w=2.2, h=0.6, fs=22)
            refs.add(r)
        refs.arrange(DOWN, buff=0.28).move_to([-3.6, -0.7, 0])
        self.play(FadeIn(refs), run_time=1.2)
        wait_until(self, 34)

        # pops empty the live list → every saved reference is now []
        for _ in range(2):
            p = live.pop_cell()
            self.play(p.animate.set_opacity(0.0), run_time=0.7)
            self.remove(p)
        collapse = fit_label("pops empty the live list → all saved answers become [ ]",
                             5.4, 21, ROSE)
        collapse.move_to([-3.5, -2.3, 0])
        for r in refs:
            r[1].become(Text("→ [ ]", font_size=22, color=ROSE).move_to(r[1].get_center()))
        self.play(FadeIn(collapse), *[Indicate(r, color=ROSE) for r in refs], run_time=1.4)
        wait_until(self, 78)

        # right panel: the FIX (save a copy)
        div = Line([0.2, 3.0, 0], [0.2, -3.0, 0], stroke_color=INK_SUBTLE, stroke_width=1.5)
        fix_title = Text("save a COPY", font_size=26, color=EMERALD, weight="BOLD")
        fix_title.move_to([3.7, 2.2, 0])
        self.play(Create(div), FadeIn(fix_title), run_time=1.2)
        good = VGroup(
            snapshot_chip([1]),
            snapshot_chip([1, 2]),
            snapshot_chip([1, 2, 3]),
        ).arrange(DOWN, buff=0.34).move_to([3.7, 0.1, 0])
        for g in good:
            self.play(FadeIn(g), run_time=0.7)
        good_note = fit_label("each snapshot is its own list — pops can't touch it",
                              5.4, 21, EMERALD).move_to([3.5, -2.3, 0])
        self.play(FadeIn(good_note), run_time=1.2)
        self.guard(bug_title, refs, fix_title, good, good_note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : prune early ─────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Prune early — an early rejection erases the largest subtrees"
    cue_duration = 140.6

    def construct(self):
        # full permutation tree of {1,2,3} — a big tree to prune
        m, leaves = perm_model([1, 2, 3])
        t = TreeMobject(m, top=2.55, level_gap=1.2, x_gap=1.75, node_h=0.52, fs=20,
                        x_center=0.0)
        self.play(Create(t._edges_grp), FadeIn(t._nodes_grp), run_time=2.2)
        wait_until(self, 22)

        b1 = fit_label("reject a partial state the instant you can prove it is hopeless",
                       12.0, 24, INK_MUTED).move_to([0, -2.15, 0])
        self.play(FadeIn(b1), run_time=1.3)
        wait_until(self, 40)

        # prune early: cross the whole "1" subtree (id 1) near the root → big cut
        early = t.subtree_group(1)
        for nid in m.subtree_ids(1):
            t.recolor_node(nid, C_PRUNE, fill=0.10)
            if m.nodes[nid].parent is not None:
                t.recolor_edge(nid, C_PRUNE)
        self.play(Indicate(t.node[1], color=C_PRUNE), run_time=1.0)
        xbig = Cross(early, stroke_color=C_PRUNE, stroke_width=6)
        self.play(Create(xbig), run_time=1.4)
        b2 = fit_label("an EARLY cut (near the root) deletes a huge subtree at once",
                       12.0, 24, ROSE).move_to([0, -2.15, 0])
        self.play(FadeOut(b1), FadeIn(b2), run_time=1.1)
        wait_until(self, 92)

        # contrast: a late cut deletes almost nothing — cross a single leaf
        late_leaf = leaves[-1]  # a bottom node in the "3" subtree
        t.recolor_node(late_leaf, AMBER, fill=0.10)
        xsmall = Cross(t.node[late_leaf], stroke_color=AMBER, stroke_width=4)
        self.play(Create(xsmall), run_time=1.0)
        b3 = fit_label("a LATE cut (at a leaf) saves almost nothing — prune as HIGH as you can",
                       13.0, 24, AMBER).move_to([0, -2.85, 0])
        self.play(FadeIn(b3), run_time=1.3)
        self.guard(t, b2, b3)
        pace_to(self, self.cue_duration)


# ─── Cue05 : start index vs used-array ───────────────────────────────────────
class Cue05(AvoScene):
    headline = "Start index (subsets) vs used-array (permutations)"
    cue_duration = 112.6

    def construct(self):
        div = Line([0, 3.0, 0], [0, -3.0, 0], stroke_color=INK_SUBTLE, stroke_width=1.5)
        self.play(Create(div), run_time=1.0)

        # left: subsets with start index
        lt = Text("subsets", font_size=28, color=ACCENT, weight="BOLD").move_to([-3.6, 2.5, 0])
        lcode = code_block([
            code_line("for i in range(start, n):", color=INK, fs=23),
            code_line("path.push(nums[i])", color=ACCENT, fs=23, indent=1),
            code_line("rec(i + 1)", color=ACCENT_LIGHT, fs=23, indent=1),
        ], fs=23).move_to([-3.6, 1.2, 0])
        self.play(FadeIn(lt), FadeIn(lcode), run_time=1.4)
        lnote = fit_label("forward-only → each subset once, no order", 5.8, 22, INK_MUTED)
        lnote.move_to([-3.5, -0.1, 0])
        self.play(FadeIn(lnote), run_time=1.0)
        wait_until(self, 34)

        # small subsets tree (forward-only) under the left column
        mm, order = subsets_model([1, 2, 3])
        tsub = TreeMobject(mm, top=-0.7, level_gap=0.8, x_gap=1.0, node_h=0.42, fs=16,
                           x_center=-3.6)
        self.play(FadeIn(tsub), run_time=1.4)
        wait_until(self, 58)

        # right: permutations with used-array
        rt = Text("permutations", font_size=28, color=VIOLET, weight="BOLD").move_to([3.6, 2.5, 0])
        rcode = code_block([
            code_line("for e in elements:", color=INK, fs=23),
            code_line("if used[e]: continue", color=VIOLET, fs=23, indent=1),
            code_line("used[e]=true; path.push(e)", color=ACCENT, fs=23, indent=1),
        ], fs=23).move_to([3.6, 1.2, 0])
        self.play(FadeIn(rt), FadeIn(rcode), run_time=1.4)
        rnote = fit_label("any free element, any order → all n! orders", 5.8, 22, INK_MUTED)
        rnote.move_to([3.5, -0.1, 0])
        self.play(FadeIn(rnote), run_time=1.0)
        wait_until(self, 88)

        urow = used_row([1, 2, 3], used=[False, True, False], w=0.7, h=0.7, fs=22)
        urow.move_to([3.6, -1.6, 0])
        ulbl = Text("used[]", font_size=20, color=VIOLET).next_to(urow, UP, buff=0.3)
        self.play(FadeIn(urow), FadeIn(ulbl), run_time=1.2)
        self.guard(lt, lcode, tsub, rt, rcode, urow, lnote, rnote)
        pace_to(self, self.cue_duration)


# ─── Cue06 : when it fails — exponential; DP may fold ────────────────────────
class Cue06(AvoScene):
    headline = "When it fails: exponential / factorial — DP may fold it to a table"
    cue_duration = 56.3

    def construct(self):
        cx = complexity(r"O(2^{n}) \quad\text{subsets} \qquad O(n!) \quad\text{permutations}",
                        color=INK, fs=44)
        theme.fit_to_stage(cx, width_frac=0.94)
        cx.move_to([0, 1.7, 0])
        self.play(Write(cx), run_time=1.8)
        wait_until(self, 12)

        b1 = fit_label("the decision tree is often exponential or factorial in size",
                       11.4, 26, ROSE).move_to([0, 0.5, 0])
        self.play(FadeIn(b1), run_time=1.4)
        wait_until(self, 26)

        # DP fold arrow → a small table
        arrow = Arrow([-1.6, -0.6, 0], [1.6, -0.6, 0], color=EMERALD, stroke_width=6)
        alab = fit_label("need ONE optimum or a COUNT?", 6.6, 24, INK_MUTED).next_to(arrow, UP, buff=0.2)
        table = VGroup()
        for r in range(2):
            for c in range(4):
                cellb = RoundedRectangle(width=0.7, height=0.55, corner_radius=0.06,
                                         stroke_color=EMERALD, stroke_width=2.0,
                                         fill_color=EMERALD, fill_opacity=0.10)
                cellb.move_to([c * 0.74, -r * 0.6, 0])
                table.add(cellb)
        table.move_to([2.7, -1.9, 0])
        tlab = fit_label("DP folds the tree → a table", 5.6, 22, EMERALD).next_to(table, UP, buff=0.22)
        self.play(GrowFromCenter(arrow), FadeIn(alab), run_time=1.2)
        self.play(FadeIn(table), FadeIn(tlab), run_time=1.2)
        self.guard(cx, b1, table)
        pace_to(self, self.cue_duration)
