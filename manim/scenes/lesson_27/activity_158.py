"""
Lesson 27 — Orientation (activity 158): "No Pattern Labels: Recognize,
Articulate, Implement Under Pressure" (597.2s, 10 cues).

The capstone meta-lesson. The problems arrive with NO technique labels — the
learner must recognize the shape from the problem text alone. This orientation
teaches the recognition framework (signal → technique map, the 5-step read),
then walks three unlabeled problems and names each shape: Minimum Window
Substring → sliding window + frequency map, Task Scheduler → greedy / max-heap
+ a closed-form idle formula, Palindrome Partitioning → choose-explore-unchoose
backtracking with a precomputed palindrome DP table.

Reuses the committed idiom libs (arrays.value_row / window_bracket / code_line /
complexity, bayes.chip / fit_label) rather than transformer scenes. MathTex is
used only for the two real bounds/formulas the narration states: the Task
Scheduler idle formula (f-1)(n+1)+count_max and the palindrome recurrence.

Cue00 0.0-47.8     No labels, no hints — recognize the shape before coding
Cue01 47.8-99.5    Ask the right questions — signal → technique map
Cue02 99.5-167.2   Read, output, constraints, template, verify (5-step)
Cue03 167.2-223.0  Minimum Window Substring — coverage → sliding window + freq
Cue04 223.0-286.7  Expand then shrink — need/have maps, formed count
Cue05 286.7-354.4  Task Scheduler — cooldown, most-frequent sets the length
Cue06 354.4-414.1  (f-1)(n+1)+count_max — the closed-form idle formula
Cue07 414.1-469.8  Palindrome Partitioning — "all" → backtracking, n≤16
Cue08 469.8-537.5  Precompute palindrome table — dp[i][j], O(1) lookup
Cue09 537.5-597.2  Name the shape first — the first 30 seconds matter most
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from arrays import value_row, window_bracket, recolor_cell, code_line, complexity
from bayes import chip, fit_label
from manim import (
    VGroup, Text, MathTex, Arrow, Line, Dot, RoundedRectangle, SurroundingRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, GrowArrow, Create,
    RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def _pcard(title, subtitle, color, w=3.7, h=1.9):
    """A problem card: bold title + muted one-line shape hint, in one panel."""
    box = RoundedRectangle(width=w, height=h, corner_radius=0.16,
                           stroke_color=color, stroke_width=2.6,
                           fill_color=color, fill_opacity=0.10)
    t = fit_label(title, w - 0.4, 24, INK, weight="BOLD")
    s = fit_label(subtitle, w - 0.4, 19, INK_MUTED)
    t.move_to(box.get_center() + UP * 0.42)
    s.move_to(box.get_center() + DOWN * 0.42)
    g = VGroup(box, t, s)
    g.box = box
    return g


# ─── Cue00 : No labels, no hints ─────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "No labels, no hints — name the shape first"
    cue_duration = 47.8

    def construct(self):
        intro = fit_label("The problems arrive without technique labels.",
                          10.5, 28, INK).move_to([0, 2.35, 0])
        self.play(Write(intro), run_time=2.2)
        wait_until(self, 4.0)

        cards = VGroup(
            _pcard("Minimum Window Substring", "technique?  →  ???", ACCENT),
            _pcard("Task Scheduler", "technique?  →  ???", AMBER),
            _pcard("Palindrome Partitioning", "technique?  →  ???", VIOLET),
        ).arrange(RIGHT, buff=0.5).move_to([0, 0.15, 0])
        for c in cards:
            self.play(FadeIn(c), run_time=1.1)
        wait_until(self, 18.0)

        qmarks = VGroup(*[Text("?", font_size=54, color=c.box.get_color(),
                               weight="BOLD").move_to(c.box.get_center() + DOWN * 0.42)
                          for c in cards])
        self.play(*[Indicate(c, color=c.get_color(), scale_factor=1.4) for c in qmarks],
                  run_time=2.0)
        wait_until(self, 30.0)

        punch = fit_label("Figure out WHAT you are looking at before writing a line.",
                          11.5, 26, AMBER, weight="BOLD").move_to([0, -2.5, 0])
        self.play(FadeIn(punch), Circumscribe(punch, color=AMBER), run_time=2.2)
        self.guard(intro, cards, punch)
        pace_to(self, self.cue_duration)


# ─── Cue01 : signal → technique map ──────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Ask the right questions — a signal → technique map"
    cue_duration = 51.7

    def _rowmap(self, signal, tech, color):
        sig = fit_label(signal, 5.6, 24, INK)
        arr = Text("→", font_size=30, color=INK_SUBTLE)
        tec = fit_label(tech, 4.2, 24, color, weight="BOLD")
        arr.next_to(sig, RIGHT, buff=0.35)
        tec.next_to(arr, RIGHT, buff=0.35)
        return VGroup(sig, arr, tec)

    def construct(self):
        lead = fit_label("Build a mental lookup from problem words to technique:",
                         11.5, 26, INK_MUTED).move_to([0, 2.6, 0])
        self.play(FadeIn(lead), run_time=1.6)

        rows = VGroup(
            self._rowmap("contiguous subarray / substring", "sliding window", ACCENT),
            self._rowmap("repeated max / min extraction", "heap", AMBER),
            self._rowmap("all combinations / permutations", "backtracking", VIOLET),
            self._rowmap("shortest path / levels / grid", "BFS", EMERALD),
            self._rowmap("answer is a value in a range", "binary search", ROSE),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.5).move_to([0, -0.35, 0])

        times = [6.0, 15.0, 24.0, 33.0, 41.0]
        for r, t in zip(rows, times):
            self.play(FadeIn(r), run_time=1.2)
            wait_until(self, t)
        self.guard(lead, rows)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the 5-step read ─────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Read · Output · Constraints · Template · Verify"
    cue_duration = 67.7

    def _step(self, n, title, sub, color):
        num = Text(str(n), font_size=30, color=color, weight="BOLD")
        ring = RoundedRectangle(width=0.72, height=0.72, corner_radius=0.36,
                                stroke_color=color, stroke_width=2.6,
                                fill_color=color, fill_opacity=0.14)
        num.move_to(ring.get_center())
        head = VGroup(ring, num)
        t = fit_label(title, 4.6, 25, INK, weight="BOLD")
        s = fit_label(sub, 6.6, 20, INK_MUTED)
        t.next_to(head, RIGHT, buff=0.3)
        s.next_to(t, RIGHT, buff=0.4)
        return VGroup(head, t, s)

    def construct(self):
        steps = VGroup(
            self._step(1, "Read fully", "every word, twice — do not skim", ACCENT),
            self._step(2, "Output type", "what shape do we return?", AMBER),
            self._step(3, "Constraints", "n, ranges — they name the complexity", EMERALD),
            self._step(4, "Match template", "which known shape fits?", VIOLET),
            self._step(5, "Verify examples", "trace the given cases by hand", ROSE),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.52).move_to([-0.3, 0.0, 0])

        times = [8.0, 20.0, 32.0, 44.0, 56.0]
        for st, t in zip(steps, times):
            self.play(FadeIn(st[0]), run_time=0.8)
            self.play(FadeIn(st[1], st[2]), run_time=1.0)
            wait_until(self, t)
        self.guard(steps)
        pace_to(self, self.cue_duration)


# ─── Cue03 : Minimum Window Substring — recognize the shape ──────────────────
class Cue03(AvoScene):
    headline = "Minimum Window Substring → sliding window + freq map"
    cue_duration = 55.8

    def construct(self):
        s = list("ADOBECODEBANC")
        srow = value_row(s, w=0.82, h=0.82, fs=26, gap=0.1, index=False).move_to([0, 1.7, 0])
        scap = Text("s", font_size=24, color=INK_MUTED).next_to(srow, LEFT, buff=0.3)
        self.play(FadeIn(srow), FadeIn(scap), run_time=1.6)
        trow = value_row(list("ABC"), w=0.82, h=0.82, fs=26, gap=0.1, index=False,
                         color=AMBER).move_to([0, 0.35, 0])
        tcap = Text("t", font_size=24, color=INK_MUTED).next_to(trow, LEFT, buff=0.3)
        self.play(FadeIn(trow), FadeIn(tcap), run_time=1.2)
        wait_until(self, 10.0)

        clues = VGroup(
            fit_label("• 'substring'  →  contiguous slice", 7.0, 23, INK),
            fit_label("• 'containing every char of t'  →  coverage condition", 9.2, 23, INK),
            fit_label("• minimize the length  →  shrink when valid", 8.0, 23, INK),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.34).move_to([0, -1.35, 0])
        for c, t in zip(clues, [20.0, 30.0, 40.0]):
            self.play(FadeIn(c), run_time=1.2)
            wait_until(self, t)

        # the answer window "BANC" (indices 9..12)
        win = window_bracket(srow, 9, 12, color=EMERALD, label="answer: BANC")
        self.play(Create(win), run_time=2.0)
        verdict = fit_label("shape = SLIDING WINDOW with a frequency map",
                            10.5, 25, ACCENT, weight="BOLD").move_to([0, -2.75, 0])
        self.play(FadeIn(verdict), run_time=1.4)
        self.guard(srow, trow, clues, win, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue04 : expand then shrink — the bookkeeping ────────────────────────────
class Cue04(AvoScene):
    headline = "Expand right, shrink left, track 'formed'"
    cue_duration = 63.7

    def construct(self):
        need = chip("need = {A:1, B:1, C:1}", color=AMBER, w=5.2, h=0.95, fs=26).move_to([-3.3, 2.3, 0])
        have = chip("window = { … }", color=ACCENT, w=4.4, h=0.95, fs=26).move_to([3.0, 2.3, 0])
        self.play(FadeIn(need), FadeIn(have), run_time=1.4)
        wait_until(self, 6.0)

        lines = VGroup(
            code_line("for right, c in enumerate(s):", INK, 24),
            code_line("window[c] += 1", ACCENT_LIGHT, 24, indent=1),
            code_line("if window[c] == need[c]:  formed += 1", EMERALD, 24, indent=1),
            code_line("while formed == required:", AMBER, 24, indent=1),
            code_line("record min window", EMERALD, 24, indent=2),
            code_line("window[s[left]] -= 1; left += 1", ROSE, 24, indent=2),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.2).move_to([0, -0.4, 0])
        times = [14.0, 22.0, 30.0, 40.0, 48.0, 56.0]
        for ln, t in zip(lines, times):
            self.play(FadeIn(ln), run_time=1.0)
            wait_until(self, t)
        formed = chip("formed == required  →  valid, start shrinking",
                      color=EMERALD, w=9.4, h=0.9, fs=24).move_to([0, -2.75, 0])
        self.play(FadeIn(formed), Circumscribe(formed, color=EMERALD), run_time=1.8)
        self.guard(need, have, lines, formed)
        pace_to(self, self.cue_duration)


# ─── Cue05 : Task Scheduler — recognize the shape ────────────────────────────
class Cue05(AvoScene):
    headline = "Task Scheduler → greedy: the most frequent task sets the length"
    cue_duration = 67.7

    def construct(self):
        problem = fit_label("Schedule tasks with cooldown n between equal tasks; minimize idle.",
                            12.0, 25, INK).move_to([0, 2.55, 0])
        self.play(FadeIn(problem), run_time=1.8)
        wait_until(self, 8.0)

        # tasks A A A  B B  C, cooldown n=2  →  A _ _ A _ _ A  with B,C filling gaps
        slots = ["A", "B", "C", "A", "B", "idle", "A"]
        cols = {"A": ROSE, "B": ACCENT, "C": EMERALD, "idle": INK_SUBTLE}
        srow = VGroup()
        for lab in slots:
            box = RoundedRectangle(width=1.2, height=1.0, corner_radius=0.1,
                                   stroke_color=cols[lab], stroke_width=2.6,
                                   fill_color=cols[lab], fill_opacity=0.14)
            t = Text(lab if lab != "idle" else "—", font_size=26,
                     color=INK if lab != "idle" else INK_SUBTLE, weight="BOLD")
            t.move_to(box.get_center())
            srow.add(VGroup(box, t))
        srow.arrange(RIGHT, buff=0.14).move_to([0, 0.55, 0])
        self.play(FadeIn(srow), run_time=1.6)
        wait_until(self, 22.0)

        note = fit_label("A is most frequent (3×) → it stamps the frame: A _ _ A _ _ A",
                         12.0, 24, ROSE, weight="BOLD").move_to([0, -0.85, 0])
        self.play(FadeIn(note), run_time=1.4)
        wait_until(self, 34.0)
        # highlight the three A slots
        self.play(*[Indicate(srow[i], color=ROSE, scale_factor=1.18) for i in (0, 3, 6)],
                  run_time=2.0)
        wait_until(self, 48.0)

        fill = VGroup(
            fit_label("• other tasks fill the cooldown gaps", 8.0, 23, INK),
            fit_label("• leftover gaps become idle time", 8.0, 23, INK),
            fit_label("shape = GREEDY (max-heap) or a closed-form formula",
                      11.0, 25, AMBER, weight="BOLD"),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.34).move_to([0, -2.2, 0])
        for c in fill:
            self.play(FadeIn(c), run_time=1.0)
        self.guard(problem, srow, note, fill)
        pace_to(self, self.cue_duration)


# ─── Cue06 : the closed-form idle formula ────────────────────────────────────
class Cue06(AvoScene):
    headline = "Length = max( total tasks, (f−1)(n+1) + count_max )"
    cue_duration = 59.7

    def construct(self):
        formula = MathTex(
            r"\text{len} = \max\big(\,|\text{tasks}|,\ (f-1)(n+1) + c_{\max}\,\big)",
            color=INK).scale(0.95).move_to([0, 2.15, 0])
        self.play(Write(formula), run_time=2.4)
        wait_until(self, 10.0)

        legend = VGroup(
            fit_label("f  =  max frequency (how many of the most common task)", 11.0, 23, ROSE),
            fit_label("n  =  cooldown gap required between equal tasks", 11.0, 23, ACCENT),
            fit_label("c_max  =  how many tasks share that max frequency", 11.0, 23, AMBER),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4).move_to([0, 0.15, 0])
        for c, t in zip(legend, [20.0, 30.0, 40.0]):
            self.play(FadeIn(c), run_time=1.2)
            wait_until(self, t)

        # worked: f=3, n=2 → (3-1)(2+1)=6, +1 = 7 frames
        worked = MathTex(r"(3-1)(2+1) + 1 = 6 + 1 = 7", color=EMERALD).scale(0.85).move_to([0, -1.85, 0])
        self.play(Write(worked), run_time=1.8)
        cap = fit_label("A A A, cooldown 2, one task at max freq  →  7 slots",
                        11.0, 22, INK_MUTED).move_to([0, -2.75, 0])
        self.play(FadeIn(cap), run_time=1.2)
        self.guard(formula, legend, worked, cap)
        pace_to(self, self.cue_duration)


# ─── Cue07 : Palindrome Partitioning — recognize the shape ───────────────────
class Cue07(AvoScene):
    headline = "Palindrome Partitioning → 'all' means backtracking (n ≤ 16)"
    cue_duration = 55.7

    def construct(self):
        problem = fit_label("Return ALL ways to cut s into palindromic pieces.",
                            11.5, 26, INK).move_to([0, 2.5, 0])
        self.play(FadeIn(problem), run_time=1.8)
        wait_until(self, 8.0)

        # s = "aab" → ["a","a","b"] and ["aa","b"]
        srow = value_row(list("aab"), w=0.95, h=0.95, fs=32, gap=0.14, index=False,
                         color=VIOLET).move_to([0, 1.1, 0])
        self.play(FadeIn(srow), run_time=1.2)
        wait_until(self, 16.0)

        parts = VGroup(
            chip('[ "a", "a", "b" ]', color=EMERALD, w=4.4, h=0.85, fs=26),
            chip('[ "aa", "b" ]', color=EMERALD, w=4.4, h=0.85, fs=26),
        ).arrange(DOWN, buff=0.4).move_to([0, -0.55, 0])
        for p, t in zip(parts, [24.0, 32.0]):
            self.play(FadeIn(p), run_time=1.2)
            wait_until(self, t)

        clues = VGroup(
            fit_label("• 'all' / 'every valid'  →  enumerate  →  backtracking", 10.5, 23, INK),
            fit_label("• n ≤ 16  →  exponential is fine  →  choose · explore · un-choose",
                      11.5, 23, VIOLET, weight="BOLD"),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.34).move_to([0, -2.35, 0])
        for c in clues:
            self.play(FadeIn(c), run_time=1.1)
        self.guard(problem, srow, parts, clues)
        pace_to(self, self.cue_duration)


# ─── Cue08 : precompute the palindrome table ─────────────────────────────────
class Cue08(AvoScene):
    headline = "Precompute dp[i][j] = 'is s[i..j] a palindrome?'"
    cue_duration = 67.7

    def construct(self):
        # dp table for "aab": rows i (0..2), cols j (0..2), upper triangle used.
        s = "aab"
        n = 3
        dp = [[False] * n for _ in range(n)]
        for i in range(n):
            dp[i][i] = True
        dp[0][1] = (s[0] == s[1])       # "aa" → True
        dp[1][2] = (s[1] == s[2])       # "ab" → False
        dp[0][2] = (s[0] == s[2] and dp[1][1])  # "aab" → False

        cell = 0.95
        grid = VGroup()
        cellmap = {}
        for i in range(n):
            for j in range(n):
                box = RoundedRectangle(width=cell, height=cell, corner_radius=0.08,
                                       stroke_color=INK_SUBTLE, stroke_width=2.0,
                                       fill_color=INK_SUBTLE, fill_opacity=0.05)
                box.move_to([j * (cell + 0.12) - 1.5, -i * (cell + 0.12) + 1.5, 0])
                grid.add(box)
                cellmap[(i, j)] = box
        # axis labels
        labels = VGroup()
        for k in range(n):
            ci = Text(f"i={k}", font_size=18, color=INK_MUTED).next_to(cellmap[(k, 0)], LEFT, buff=0.25)
            cj = Text(f"j={k}", font_size=18, color=INK_MUTED).next_to(cellmap[(0, k)], UP, buff=0.25)
            labels.add(ci, cj)
        grid.shift([1.6, 0, 0])
        labels.shift([1.6, 0, 0])
        self.play(FadeIn(grid), FadeIn(labels), run_time=1.8)
        wait_until(self, 6.0)

        # left side: the fill rules
        rules = VGroup(
            fit_label("base: dp[i][i] = True (1 char)", 5.6, 21, EMERALD),
            fit_label("pair: dp[i][i+1] = s[i]==s[i+1]", 5.6, 21, AMBER),
            fit_label("len≥3: dp[i][j] =", 5.6, 21, ACCENT),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.36).move_to([-4.0, 1.2, 0])
        recur = MathTex(r"(s_i = s_j)\ \wedge\ dp[i{+}1][j{-}1]", color=ACCENT).scale(0.6)
        recur.next_to(rules, DOWN, aligned_edge=LEFT, buff=0.3)

        # fill diagonal, then pair, then full
        def mark(i, j, val):
            b = cellmap[(i, j)]
            col = EMERALD if val else ROSE
            b.set_stroke(color=col, width=2.8)
            b.set_fill(color=col, opacity=0.20)
            t = Text("T" if val else "F", font_size=30, color=col, weight="BOLD").move_to(b.get_center())
            return t

        self.play(FadeIn(rules[0]), run_time=1.0)
        diag = VGroup(*[mark(k, k, True) for k in range(n)])
        self.play(FadeIn(diag), run_time=1.4)
        wait_until(self, 24.0)

        self.play(FadeIn(rules[1]), run_time=1.0)
        pairs = VGroup(mark(0, 1, dp[0][1]), mark(1, 2, dp[1][2]))
        self.play(FadeIn(pairs), run_time=1.4)
        wait_until(self, 42.0)

        self.play(FadeIn(rules[2]), Write(recur), run_time=1.6)
        full = mark(0, 2, dp[0][2])
        self.play(FadeIn(full), run_time=1.2)
        wait_until(self, 56.0)

        note = fit_label("O(1) lookup inside backtracking after O(n²) setup",
                         10.5, 24, INK, weight="BOLD").move_to([0, -2.8, 0])
        self.play(FadeIn(note), run_time=1.4)
        self.guard(grid, labels, rules, recur, diag, pairs, full, note)
        pace_to(self, self.cue_duration)


# ─── Cue09 : name the shape first ────────────────────────────────────────────
class Cue09(AvoScene):
    headline = "Name the shape before you touch the keyboard"
    cue_duration = 59.7

    def construct(self):
        big = fit_label("The first 30 seconds of reading beat the next 30 minutes of coding.",
                        12.5, 27, INK, weight="BOLD").move_to([0, 2.35, 0])
        self.play(Write(big), run_time=2.6)
        wait_until(self, 8.0)

        recap = VGroup(
            self._recap("Minimum Window Substring", "sliding window + freq map", ACCENT),
            self._recap("Task Scheduler", "greedy / heap + idle formula", AMBER),
            self._recap("Palindrome Partitioning", "backtracking + palindrome DP", VIOLET),
        ).arrange(DOWN, buff=0.5).move_to([0, -0.3, 0])
        for r, t in zip(recap, [18.0, 30.0, 42.0]):
            self.play(FadeIn(r), run_time=1.3)
            wait_until(self, t)

        close = fit_label("Can you name the shape before you write a line?",
                          11.0, 26, EMERALD, weight="BOLD").move_to([0, -2.7, 0])
        self.play(FadeIn(close), Circumscribe(close, color=EMERALD), run_time=2.2)
        self.guard(big, recap, close)
        pace_to(self, self.cue_duration)

    def _recap(self, name, tech, color):
        box = RoundedRectangle(width=11.0, height=0.95, corner_radius=0.14,
                               stroke_color=color, stroke_width=2.4,
                               fill_color=color, fill_opacity=0.10)
        nm = fit_label(name, 5.0, 24, INK, weight="BOLD")
        arr = Text("→", font_size=26, color=INK_SUBTLE)
        tc = fit_label(tech, 4.4, 23, color, weight="BOLD")
        nm.move_to(box.get_center() + LEFT * 3.0)
        arr.move_to(box.get_center() + LEFT * 0.1)
        tc.move_to(box.get_center() + RIGHT * 2.7)
        return VGroup(box, nm, arr, tc)
