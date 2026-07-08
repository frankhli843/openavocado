"""
Lesson 18 — Part 2 (activity 105): "Same-direction read/write" (89.3s, 6 cues).

The in-place compaction behind the orientation's "read/write branch": remove
duplicates from a sorted array [1, 1, 2, 3, 3]. Both pointers move the same
direction — `read` scans every element, `write` marks the boundary of the
compacted answer. write only advances (and copies) when read finds a value
different from the last kept one, so the unique prefix [1, 2, 3] is built in
place with O(n) work and O(1) extra space.

Trace: write=1 (first element trivially kept) → read=1 sees a duplicate 1, walk
on, write stays → read=2 finds a fresh 2, copy to write slot, write→2 → read=3
fresh, copy, write→3 → read=4 sees duplicate 3, skip. Prefix before write is the
answer.

Uses the arrays.py idiom lib (value_row, pointer, value_badge, code_line) — the
array/pointer vocabulary. `read` sits above the row (side UP), `write` below
(side DOWN) so the two same-direction pointers never collide. MathTex is
reserved for the one complexity bound.

Cue00 0-16.2     Seed the boundary: write starts at 1 (first element is kept)
Cue01 16.2-35.7  Skip a duplicate: read's 1 equals the last kept — write stays
Cue02 35.7-54.1  Keep a new value: read finds a fresh 2 — copy it, advance write
Cue03 54.1-71.4  Why linear: read n, write ≤ n, neither backs up — total 2n
Cue04 71.4-81.2  The bug: advancing write blindly copies duplicates back in
Cue05 81.2-89.3  Read the answer: everything before write is the compacted prefix
"""

import theme
from theme import (
    AvoScene,
    ACCENT,
    AMBER,
    EMERALD,
    ROSE,
    INK,
    INK_MUTED,
    INK_SUBTLE,
    LABEL_SIZE,
    BODY_SIZE,
)
from pacing import pace_to, elapsed
from arrays import (
    value_row,
    recolor_cell,
    pointer,
    value_badge,
    complexity,
    code_line,
    C_ENTER,
    C_RESULT,
)
from bayes import fit_label
from manim import (
    VGroup,
    Text,
    MathTex,
    FadeIn,
    FadeOut,
    Write,
    Transform,
    Indicate,
    Circumscribe,
    SurroundingRectangle,
    RIGHT,
    LEFT,
    UP,
    DOWN,
)

ARR = [1, 1, 2, 3, 3]
ARR_Y = 0.7             # vertical center of the value row
READ_C = ACCENT        # read scans (blue)
WRITE_C = EMERALD       # write marks the kept boundary (emerald = the answer)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_array(values=None):
    row = value_row(values or ARR, w=0.95, h=0.95, fs=34, gap=0.22, index=True)
    row.move_to([0, ARR_Y, 0])
    return row


def read_ptr(row, i):
    return pointer(row.cells[i], "read", color=READ_C, side=UP, fs=20, gap=0.85)


def write_ptr(row, i):
    return pointer(row.cells[i], "write", color=WRITE_C, side=DOWN, fs=20, gap=0.85)


# ─── Cue00 : seed the boundary ───────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "First element is always kept"
    cue_duration = 16.2

    def construct(self):
        row = build_array()
        self.play(FadeIn(row, shift=UP * 0.2), run_time=1.6)
        goal = fit_label("remove duplicates from a sorted array, in place", 10.0, BODY_SIZE, INK_MUTED)
        goal.to_edge(DOWN, buff=0.55)
        self.play(FadeIn(goal), run_time=1.2)
        wait_until(self, 5)

        # index 0 is trivially unique — mark it kept, seed write at 1
        recolor_cell(row.cells[0], EMERALD)
        keep = Text("index 0 is trivially unique", font_size=22, color=EMERALD).next_to(row, UP, buff=0.7)
        self.play(Indicate(row.cells[0], color=EMERALD, scale_factor=1.15), FadeIn(keep), run_time=1.6)
        wait_until(self, 10)

        wp = write_ptr(row, 1)
        self.play(FadeIn(wp), run_time=1.2)
        seed = Text("write starts at 1 — the boundary of the kept prefix",
                    font_size=22, color=WRITE_C).to_edge(DOWN, buff=0.55)
        self.play(FadeOut(goal), FadeIn(seed), run_time=1.2)
        self.guard(row, wp, keep, seed)
        pace_to(self, self.cue_duration)


# ─── Cue01 : skip a duplicate ────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "read equals the last kept → skip"
    cue_duration = 19.5

    def construct(self):
        row = build_array()
        recolor_cell(row.cells[0], EMERALD)
        wp = write_ptr(row, 1)
        self.add(row, wp)
        wait_until(self, 2)

        # read at index 1 (the second 1)
        rp = read_ptr(row, 1)
        self.play(FadeIn(rp), run_time=1.2)
        cmp = fit_label("read's 1 equals the last kept value (index 0)", 10.5, 22, ROSE)
        cmp.to_edge(DOWN, buff=0.55)
        self.play(Indicate(VGroup(row.cells[0], row.cells[1]), color=ROSE, scale_factor=1.1),
                  FadeIn(cmp), run_time=1.6)
        wait_until(self, 10)

        # read walks on to index 2; write stays put at 1
        rp2 = read_ptr(row, 2)
        self.play(Transform(rp, rp2), run_time=1.4)
        # caption goes BELOW the row — the read pointer (side UP) owns the space above
        stays = Text("read walks on — write stays put", font_size=23, color=INK).to_edge(DOWN, buff=0.55)
        self.play(FadeOut(cmp), FadeIn(stays), run_time=1.2)
        self.guard(row, rp, wp, stays)
        pace_to(self, self.cue_duration)


# ─── Cue02 : keep a new value ────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "read finds a fresh 2 → copy, advance write"
    cue_duration = 18.4

    def construct(self):
        row = build_array()
        recolor_cell(row.cells[0], EMERALD)
        rp = read_ptr(row, 2)
        wp = write_ptr(row, 1)
        self.add(row, rp, wp)
        wait_until(self, 2)

        # read's 2 is new (differs from last kept 1)
        fresh = fit_label("2 differs from the last kept value — it's new", 10.5, 22, ACCENT)
        fresh.to_edge(DOWN, buff=0.55)
        self.play(Indicate(row.cells[2], color=ACCENT, scale_factor=1.15), FadeIn(fresh), run_time=1.6)
        wait_until(self, 8)

        # copy read's value into the write slot (index 1): 1 → 2
        newcell = value_row([2], w=0.95, h=0.95, fs=34, index=False).cells[0]
        newcell.move_to(row.cells[1].get_center())
        recolor_cell(newcell, EMERALD)
        self.play(Transform(row.cells[1], newcell), run_time=1.4)
        # caption below the row — the read pointer (side UP) owns the space above
        copied = Text("copy 2 into the write slot", font_size=22, color=EMERALD).move_to([0, -1.5, 0])
        self.play(FadeOut(fresh), FadeIn(copied), run_time=1.0)
        wait_until(self, 14)

        # advance write to index 2
        wp2 = write_ptr(row, 2)
        self.play(Transform(wp, wp2), run_time=1.2)
        adv = Text("then advance write", font_size=22, color=WRITE_C).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(adv), run_time=1.0)
        self.guard(row, rp, wp, copied, adv)
        pace_to(self, self.cue_duration)


# ─── Cue03 : why still linear ────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Both pointers move forward — total 2n"
    cue_duration = 17.3

    def construct(self):
        row = build_array(values=[1, 2, 2, 3, 3])  # mid-run: prefix [1,2] built, read scanning
        recolor_cell(row.cells[0], EMERALD)
        recolor_cell(row.cells[1], EMERALD)
        rp = read_ptr(row, 3)
        wp = write_ptr(row, 2)
        self.add(row, rp, wp)
        wait_until(self, 2)

        read_line = Text("read advances n times", font_size=24, color=ACCENT, weight="BOLD")
        write_line = Text("write advances at most n times", font_size=24, color=EMERALD, weight="BOLD")
        never = Text("neither ever backs up", font_size=23, color=INK)
        stack = VGroup(read_line, write_line, never).arrange(DOWN, buff=0.3).move_to([0, -1.7, 0])
        self.play(FadeIn(read_line), run_time=1.0)
        wait_until(self, 7)
        self.play(FadeIn(write_line), run_time=1.0)
        wait_until(self, 11)
        self.play(FadeIn(never), run_time=1.0)
        wait_until(self, 14)

        total = complexity(r"2n = O(n)", color=EMERALD, fs=44).to_edge(DOWN, buff=0.5)
        self.play(Write(total), Circumscribe(total, color=EMERALD), run_time=1.6)
        self.guard(row, rp, wp, stack, total)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the bug to avoid ────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Do not advance write blindly"
    cue_duration = 9.8

    def construct(self):
        row = build_array()
        self.add(row)
        wait_until(self, 1.0)

        bug = fit_label("advancing write on every step copies duplicates back in",
                        12.5, 23, ROSE).move_to([0, -1.4, 0])
        self.play(FadeIn(bug), run_time=1.2)
        # show the corrupted prefix if you blindly write: [1,1,2,...] keeps the dup
        corrupt = value_row([1, 1, 2], w=0.85, h=0.85, fs=30, index=False)
        corrupt.move_to([0, -2.6, 0])
        recolor_cell(corrupt.cells[0], ROSE)
        recolor_cell(corrupt.cells[1], ROSE)
        bad = Text("corrupted prefix", font_size=20, color=ROSE).next_to(corrupt, RIGHT, buff=0.4)
        self.play(FadeIn(corrupt), FadeIn(bad), run_time=1.4)
        self.guard(row, bug, corrupt, bad)
        pace_to(self, self.cue_duration)


# ─── Cue05 : read the answer ─────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Prefix before write is the answer"
    cue_duration = 8.1

    def construct(self):
        row = build_array(values=[1, 2, 3, 3, 3])  # final state: unique prefix [1,2,3]
        self.add(row)
        wait_until(self, 1.0)

        wp = write_ptr(row, 3)
        self.play(FadeIn(wp), run_time=0.9)
        recolor_cell(row.cells[0], EMERALD)
        recolor_cell(row.cells[1], EMERALD)
        recolor_cell(row.cells[2], EMERALD)
        box = SurroundingRectangle(VGroup(row.cells[0], row.cells[1], row.cells[2]),
                                   color=EMERALD, buff=0.14, corner_radius=0.12)
        ans = Text("[1, 2, 3] — the compacted answer", font_size=24, color=EMERALD).to_edge(DOWN, buff=0.7)
        self.play(Write(box), FadeIn(ans), run_time=1.6)
        self.guard(row, wp, box, ans)
        pace_to(self, self.cue_duration)
