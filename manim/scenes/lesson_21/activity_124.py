"""
Lesson 21 — Part 2 (activity 124): "Permutations + pruning" (95.5s, 6 cues).

Permutations care about ORDER and use every element once, so the forward-only
start index of subsets is replaced by a boolean used[] array. The cues build one
running example — permuting {1,2,3} — showing the used-flag mechanism, then close
on pruning: test a partial state before recursing and a red X deletes a whole
doomed subtree.

Cue0 0-17.4   Order matters: 1-2 and 2-1 are different (a tiny {1,2} perm tree).
Cue1 17.4-35.9 Used-array: one boolean flag per element; the loop skips used ones.
Cue2 35.9-55.0 Choose: set the flag, push the element, recurse to fill the next slot.
Cue3 55.0-74.1 Record: path length == input length → a full permutation, save a copy.
Cue4 74.1-86.8 Un-choose: pop and clear the flag, freeing it for a different branch.
Cue5 86.8-95.5 Prune: test the partial state first; a failing constraint deletes a subtree.

Uses the backtracking.py idiom lib. No MathTex.
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
    perm_model,
    TreeModel,
    TreeMobject,
    PathList,
    used_row,
    set_used,
    snapshot_chip,
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

ELEMS = [1, 2, 3]


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def used_block(used_state, y=1.15):
    """A used[] row with its label, centered near the top."""
    lbl = Text("used[]", font_size=24, color=C_USED, weight="BOLD")
    row = used_row(ELEMS, used=used_state, w=0.86, h=0.86, fs=26)
    row.move_to([0.4, y, 0])
    lbl.next_to(row, LEFT, buff=0.5)
    return VGroup(lbl, row), row


def path_block(values, y=-0.7):
    pl = PathList(name="path", cell=0.66, fs=26)
    for v in values:
        pl.push_cell(v)
    pl.move_to([0, y, 0])
    return pl


# ─── Cue00 : order matters — a tiny {1,2} perm tree ──────────────────────────
class Cue00(AvoScene):
    headline = "Order matters: 1-2 and 2-1 are different permutations"
    cue_duration = 17.4

    def construct(self):
        # tiny permutation tree of {1,2}: ∅ → 1 → 1 2 ; ∅ → 2 → 2 1
        m, leaves = perm_model([1, 2])
        t = TreeMobject(m, top=2.35, level_gap=1.35, x_gap=3.2, node_h=0.62, fs=30,
                        x_center=0.0)
        self.play(Create(t._edges_grp), FadeIn(t._nodes_grp), run_time=1.8)
        wait_until(self, 4.0)

        # highlight the two distinct leaves
        for nid in leaves:
            t.recolor_node(nid, EMERALD, fill=0.20)
        self.play(*[Indicate(t.node[k], color=EMERALD) for k in leaves], run_time=1.2)
        both = fit_label("both are valid answers — order is the difference", 9.0, 24, INK_MUTED)
        both.move_to([0, -1.55, 0])
        self.play(FadeIn(both), run_time=1.0)
        wait_until(self, 11.0)

        no_idx = fit_label("so a forward-only start index will NOT work", 8.4, 24, AMBER)
        no_idx.move_to([0, -2.35, 0])
        self.play(FadeIn(no_idx), run_time=1.0)
        self.guard(t, both, no_idx)
        pace_to(self, self.cue_duration)


# ─── Cue01 : used-array — one flag per element ───────────────────────────────
class Cue01(AvoScene):
    headline = "Used-array: one boolean flag per element; the loop skips used ones"
    cue_duration = 18.5

    def construct(self):
        block, row = used_block([False, False, False])
        self.play(FadeIn(block), run_time=1.2)
        wait_until(self, 3.5)

        # mark element 2 as used → the loop skips it
        set_used(row.cells[1], row.flags[1], True)
        self.play(Indicate(row.cells[1], color=C_USED), run_time=1.0)
        skip = fit_label("used[2] = true  →  the loop skips element 2", 8.6, 24, VIOLET)
        skip.move_to([0, -0.55, 0])
        self.play(FadeIn(skip), run_time=1.0)
        wait_until(self, 10.0)

        code = VGroup(
            code_line("for e in elements:", color=INK, fs=24),
            code_line("if used[e]: continue", color=VIOLET, fs=24, indent=1),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.22)
        code.move_to([0, -1.95, 0])
        self.play(FadeIn(code), run_time=1.1)
        self.guard(block, skip, code)
        pace_to(self, self.cue_duration)


# ─── Cue02 : choose — set the flag, push ─────────────────────────────────────
class Cue02(AvoScene):
    headline = "Choose: set the flag, push the element, recurse to fill the next slot"
    cue_duration = 19.1

    def construct(self):
        block, row = used_block([False, False, False])
        self.add(block)
        pl = path_block([])
        self.add(pl)

        code = VGroup(
            code_line("used[e] = true", color=C_USED, fs=24),
            code_line("path.push(e)", color=ACCENT, fs=24),
            code_line("backtrack()", color=ACCENT_LIGHT, fs=24),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.20)
        code.to_edge(RIGHT, buff=0.8).shift(DOWN * 1.9)
        self.play(FadeIn(code), run_time=1.0)
        wait_until(self, 3.0)

        # choose element 2: flag on, push
        set_used(row.cells[1], row.flags[1], True)
        self.play(Indicate(row.cells[1], color=C_USED), run_time=0.9)
        cell = pl.push_cell(2)
        self.play(TransformFromCopy(row.cells[1], cell), run_time=1.1)
        wait_until(self, 9.5)

        # then choose 1: flag on, push
        set_used(row.cells[0], row.flags[0], True)
        cell2 = pl.push_cell(1)
        self.play(Indicate(row.cells[0], color=C_USED),
                  TransformFromCopy(row.cells[0], cell2), run_time=1.2)
        wait_until(self, 15.0)
        note = fit_label("each recursion fills one more position", 7.6, 22, INK_MUTED)
        note.move_to([0, -0.05, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.guard(block, pl, code, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : record — full length is an answer ───────────────────────────────
class Cue03(AvoScene):
    headline = "Record: path length equals input length → a full permutation"
    cue_duration = 19.1

    def construct(self):
        block, row = used_block([True, True, True])
        self.add(block)
        pl = path_block([2, 1, 3])
        self.add(pl)

        # length check
        check = fit_label("len(path) == len(input)  →  complete", 8.0, 24, EMERALD)
        check.move_to([0, 0.15, 0])
        self.play(FadeIn(check), run_time=1.0)
        for c in pl.cells:
            self.play(Indicate(c, color=EMERALD), run_time=0.35)
        wait_until(self, 8.0)

        # save a copy
        snap = snapshot_chip([2, 1, 3])
        snap.move_to([0, -2.0, 0])
        self.play(TransformFromCopy(pl, snap), run_time=1.2)
        warn = fit_label("record a COPY of the path", 6.0, 24, AMBER)
        warn.move_to([0, -1.35, 0])
        self.play(FadeIn(warn), run_time=1.0)
        self.guard(block, pl, check, snap, warn)
        pace_to(self, self.cue_duration)


# ─── Cue04 : un-choose — pop and clear the flag ──────────────────────────────
class Cue04(AvoScene):
    headline = "Un-choose: pop and clear the flag, freeing it for another branch"
    cue_duration = 12.7

    def construct(self):
        block, row = used_block([True, True, True])
        self.add(block)
        pl = path_block([2, 1, 3])
        self.add(pl)

        code = code_line("path.pop();  used[e] = false", color=C_POP, fs=25)
        code.move_to([0, -1.95, 0])
        self.play(FadeIn(code), run_time=1.0)
        wait_until(self, 2.5)

        # pop 3, clear its flag
        popped = pl.pop_cell()
        self.play(popped.animate.shift(DOWN * 0.8).set_opacity(0.0), run_time=0.9)
        self.remove(popped)
        set_used(row.cells[2], row.flags[2], False)
        self.play(Indicate(row.cells[2], color=AMBER), run_time=1.0)
        wait_until(self, 8.0)
        note = fit_label("element 3 is free again for a different branch", 8.6, 22, INK_MUTED)
        note.move_to([0, -0.55, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.guard(block, pl, code, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : prune — skip illegal branches early ─────────────────────────────
class Cue05(AvoScene):
    headline = "Prune: test the partial state first — a doomed subtree is deleted"
    cue_duration = 8.7

    def construct(self):
        # a small tree: from ∅, branch "2" is illegal (constraint fails) → cross it
        specs = [
            (0, None, EMPTY, ""),
            (1, 0, "1", "+1"),
            (2, 1, "1 2", "+2"),
            (3, 1, "1 3", "+3"),
            (4, 0, "2", "+2"),
            (5, 4, "2 1", "+1"),
            (6, 4, "2 3", "+3"),
        ]
        m = TreeModel(specs)
        t = TreeMobject(m, top=2.5, level_gap=1.35, x_gap=1.7, node_h=0.6, fs=26,
                        x_center=0.0)
        self.add(t)

        # the legal branch stays accent
        t.color_path(1, color=ACCENT)
        # the illegal branch: recolor rose, then cross the whole subtree
        for nid in m.subtree_ids(4):
            t.recolor_node(nid, C_PRUNE, fill=0.12)
            if m.nodes[nid].parent is not None:
                t.recolor_edge(nid, C_PRUNE)
        self.play(Indicate(t.node[4], color=C_PRUNE), run_time=0.8)
        x = t.cross(4)
        self.play(Create(x), run_time=1.1)
        wait_until(self, 4.5)

        note = fit_label("constraint fails at [2]  →  skip the entire subtree", 9.4, 23, ROSE)
        note.move_to([0, -2.35, 0])
        self.play(FadeIn(note), run_time=1.0)
        self.guard(t, note)
        pace_to(self, self.cue_duration)
