"""
Lesson 20 — Orientation (activity 116): "Trie / Prefix Tree — store strings by
their shared beginnings" (840.1s, 7 long cues).

The big-picture map of the pattern. One running word set the whole way —
{car, card, cart, cat} — so the learner watches the same trie grow, get
anatomized, get walked by all three operations, and finally get contrasted with
a hash set.

Cue00 0-98.4      A hash set nails exact membership but is blind to prefixes;
                  answering "words starting with car?" means scanning them all.
Cue01 98.4-223.1  A trie stores strings along character-labeled paths; car, card,
                  cart share c-a-r and split only where they differ.
Cue02 223.1-354.4 Each node = a map char→child + a boolean "a word ends here".
Cue03 354.4-485.7 insert / search / startsWith all walk the string; they differ
                  only in what they do with the end-of-word flag.
Cue04 485.7-616.9 Insert only card: the c-a-r path exists, so search("car") must
                  check the end flag, not just the path → false.
Cue05 616.9-748.2 Where tries shine: prefix queries, type-ahead, many lookups on
                  a fixed word list, pruning dead grid-search paths.
Cue06 748.2-840.1 When NOT to reach for one: exact membership with no prefixes is
                  simpler with a hash set; tries trade memory for speed.

Uses the trie.py idiom lib (TrieModel / TrieMobject, character-labeled edges,
end-of-word rings, path/subtree recolor). No MathTex — a trie is structural;
complexity notes are plain-text chips.
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
from trie import (
    TrieModel,
    TrieMobject,
    fit_label,
    chip,
    end_flag_badge,
    op_row,
    word_chip,
    C_NODE,
    C_PATH,
    C_NEW,
    C_END,
    C_MISS,
    C_SUBTREE,
)
from manim import (
    VGroup,
    Text,
    Circle,
    Line,
    Dot,
    RoundedRectangle,
    SurroundingRectangle,
    Arrow,
    FadeIn,
    FadeOut,
    Write,
    Create,
    Transform,
    Indicate,
    Circumscribe,
    GrowFromCenter,
    RIGHT,
    LEFT,
    UP,
    DOWN,
)

WORDS = ["car", "card", "cart", "cat"]


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_trie(words, top=2.35, level_gap=1.2, x_gap=1.7, r=0.40, fs=30, x_center=0.0):
    m = TrieModel(words)
    t = TrieMobject(m, top=top, level_gap=level_gap, x_gap=x_gap, r=r, fs=fs, x_center=x_center)
    return m, t


# ─── Cue00 : hash set is blind to prefixes ───────────────────────────────────
class Cue00(AvoScene):
    headline = "Exact membership is easy — prefixes are not"
    cue_duration = 98.4

    def construct(self):
        # a stored word list
        words = ["cat", "car", "card", "cart", "dog"]
        chips = VGroup(*[word_chip(w, color=ACCENT, fs=26) for w in words])
        chips.arrange(RIGHT, buff=0.28)
        if chips.width > 11.5:
            chips.scale(11.5 / chips.width)
        chips.move_to([0, 1.95, 0])
        self.play(FadeIn(chips, shift=UP * 0.15), run_time=1.8)
        wait_until(self, 12)

        # hash-set panel: exact membership is O(1)
        hs = RoundedRectangle(width=6.2, height=1.9, corner_radius=0.16,
                              stroke_color=EMERALD, stroke_width=2.6,
                              fill_color=EMERALD, fill_opacity=0.06).move_to([-3.4, -0.2, 0])
        hs_t = fit_label("hash set", 3.0, 26, EMERALD, weight="BOLD").move_to(hs.get_top() + DOWN * 0.4)
        q1 = fit_label('contains("card") ?', 5.4, 26, INK).move_to(hs.get_center() + DOWN * 0.05)
        a1 = fit_label("yes — O(1), one lookup", 5.4, 22, EMERALD).move_to(hs.get_center() + DOWN * 0.65)
        self.play(Create(hs), FadeIn(hs_t), run_time=1.4)
        self.play(Write(q1), run_time=1.2)
        wait_until(self, 26)
        self.play(FadeIn(a1, shift=UP * 0.1), Indicate(chips[2], color=EMERALD), run_time=1.4)
        wait_until(self, 40)

        # prefix query panel: hash set can't answer
        pq = RoundedRectangle(width=6.2, height=1.9, corner_radius=0.16,
                              stroke_color=ROSE, stroke_width=2.6,
                              fill_color=ROSE, fill_opacity=0.06).move_to([3.4, -0.2, 0])
        pq_t = fit_label("prefix query", 3.2, 26, ROSE, weight="BOLD").move_to(pq.get_top() + DOWN * 0.4)
        q2 = fit_label('starts with "car" ?', 5.4, 26, INK).move_to(pq.get_center() + DOWN * 0.05)
        a2 = fit_label("hash keys are whole words — no help", 5.6, 20, ROSE).move_to(pq.get_center() + DOWN * 0.65)
        self.play(Create(pq), FadeIn(pq_t), run_time=1.4)
        self.play(Write(q2), run_time=1.2)
        wait_until(self, 56)
        self.play(FadeIn(a2, shift=UP * 0.1), run_time=1.4)
        wait_until(self, 66)

        # the only fallback: scan every word
        scan = fit_label("fallback: scan every word, test each prefix  →  O(n · L)",
                         11.5, 26, AMBER).move_to([0, -2.5, 0])
        self.play(FadeIn(scan), run_time=1.2)
        for i in range(len(words)):
            self.play(Indicate(chips[i], color=AMBER, scale_factor=1.12), run_time=0.7)
        wait_until(self, 84)
        note = fit_label("we want prefixes to be cheap — that is what a trie buys",
                         11.5, 24, INK_MUTED).next_to(scan, DOWN, buff=0.3)
        self.play(FadeIn(note), run_time=1.4)
        self.guard(chips, hs, pq, scan, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the trie stores shared paths ────────────────────────────────────
class Cue01(AvoScene):
    headline = "Store strings along character-labeled paths"
    cue_duration = 124.7

    def construct(self):
        # We build the trie for car → card → cart, one word at a time, so the
        # shared c-a-r spine is visibly reused.
        full_m, full_t = build_trie(["car", "card", "cart"], top=2.15, level_gap=1.12, x_gap=1.9)

        root = full_t.node[""]
        self.play(FadeIn(root), run_time=1.0)
        r_lbl = fit_label("root (empty string)", 4.2, 20, INK_MUTED).next_to(root, UP, buff=0.2)
        self.play(FadeIn(r_lbl), run_time=1.0)
        wait_until(self, 8)
        self.play(FadeOut(r_lbl), run_time=0.6)

        # Reveal a word one character at a time, drawing each edge together with
        # its node in a single play (fewer partial-movie seams keeps the chunk on
        # its cue-duration budget for this long, animation-heavy build).
        def reveal_word(word, t_end, ring_color=C_END):
            cur = ""
            for ch in word:
                cur += ch
                self.play(Create(full_t.edge[cur]),
                          FadeIn(full_t.node[cur], scale=0.6), run_time=0.9)
            full_t.ring[word].set_color(ring_color)
            self.play(GrowFromCenter(full_t.ring[word]), run_time=0.6)
            wait_until(self, t_end)

        # insert car
        cw = word_chip("car", color=ACCENT, fs=26).move_to([-4.6, 2.2, 0])
        self.play(FadeIn(cw), run_time=0.8)
        reveal_word("car", 30)

        # insert card — reuses c-a-r, only d is new
        cw2 = word_chip("card", color=EMERALD, fs=26).move_to([-4.6, 1.3, 0])
        self.play(FadeIn(cw2), run_time=0.8)
        # highlight that c-a-r is reused
        for p in ["c", "ca", "car"]:
            full_t.recolor_edge(p, EMERALD)
        reuse = fit_label("c-a-r already exists → reuse it", 5.6, 22, EMERALD).move_to([3.6, 1.4, 0])
        self.play(FadeIn(reuse),
                  Indicate(VGroup(full_t.edge["c"], full_t.edge["ca"], full_t.edge["car"]),
                           color=EMERALD), run_time=1.4)
        wait_until(self, 52)
        # only the d node/edge is new
        full_t.ring["card"].set_color(C_END)
        self.play(Create(full_t.edge["card"]),
                  FadeIn(full_t.node["card"], scale=0.6), run_time=0.9)
        self.play(GrowFromCenter(full_t.ring["card"]), FadeOut(reuse), run_time=0.7)
        wait_until(self, 74)

        # insert cart — reuses c-a-r again, only t is new
        cw3 = word_chip("cart", color=VIOLET, fs=26).move_to([-4.6, 0.4, 0])
        self.play(FadeIn(cw3), run_time=0.8)
        full_t.ring["cart"].set_color(C_END)
        self.play(Create(full_t.edge["cart"]),
                  FadeIn(full_t.node["cart"], scale=0.6), run_time=0.9)
        self.play(GrowFromCenter(full_t.ring["cart"]), run_time=0.6)
        wait_until(self, 92)

        # emphasize: shared spine, split where they differ.
        # NOTE: build the box from COPIES of the c/a/r nodes — wrapping the live
        # edge mobjects in a new VGroup reparents them and hides the r end-ring.
        spine_ref = VGroup(*[full_t.node[p].copy() for p in ["c", "ca", "car"]])
        spine_box = SurroundingRectangle(spine_ref, color=ACCENT, buff=0.24, corner_radius=0.1)
        note = fit_label('shared prefix "c-a-r" stored ONCE; they split only at d vs t',
                         11.5, 24, INK_MUTED).move_to([0, -3.25, 0])
        self.play(Create(spine_box), FadeIn(note), run_time=1.3)
        rings = VGroup(full_t.ring["car"], full_t.ring["card"], full_t.ring["cart"])
        self.play(Indicate(rings, color=AMBER, scale_factor=1.1), run_time=1.0)
        self.guard(full_t, spine_box, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : node anatomy ────────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "A node = a map char→child + a boolean end-of-word flag"
    cue_duration = 131.3

    def construct(self):
        m, t = build_trie(["car", "card", "cart"], top=2.15, level_gap=1.08, x_gap=1.55, x_center=-3.4)
        self.play(FadeIn(t), run_time=1.8)
        for w in ["car", "card", "cart"]:
            self.add(t.ring[w])
        wait_until(self, 8)

        # zoom conceptual box on the 'r' (car) node
        r_node = t.node["car"]
        focus = SurroundingRectangle(r_node, color=ACCENT, buff=0.18, corner_radius=0.1)
        self.play(Create(focus), Indicate(r_node, color=ACCENT), run_time=1.4)
        wait_until(self, 18)

        # anatomy panel on the right
        panel = RoundedRectangle(width=6.6, height=4.3, corner_radius=0.18,
                                 stroke_color=INK_SUBTLE, stroke_width=2.0,
                                 fill_color=theme.STAGE, fill_opacity=0.5).move_to([3.2, 0.1, 0])
        ptitle = fit_label('node "car"', 3.0, 26, ACCENT, weight="BOLD").move_to(panel.get_top() + DOWN * 0.45)
        self.play(Create(panel), FadeIn(ptitle), run_time=1.4)
        wait_until(self, 28)

        # children map
        cmap_t = fit_label("children:  a map from a character to a child node", 6.2, 21, INK).move_to([3.2, 1.15, 0])
        self.play(FadeIn(cmap_t), run_time=1.2)
        d_entry = chip("'d' → card node", color=EMERALD, w=4.2, h=0.8, fs=22).move_to([3.2, 0.35, 0])
        t_entry = chip("'t' → cart node", color=VIOLET, w=4.2, h=0.8, fs=22).move_to([3.2, -0.55, 0])
        self.play(FadeIn(d_entry), run_time=0.9)
        self.play(FadeIn(t_entry), run_time=0.9)
        # link the entries to the tree children
        self.play(Indicate(t.node["card"], color=EMERALD),
                  Indicate(t.node["cart"], color=VIOLET), run_time=1.4)
        wait_until(self, 58)

        # the boolean end flag
        flag_t = fit_label('isEndOfWord:  true  ("car" is a real word)', 6.2, 22, AMBER).move_to([3.2, -1.5, 0])
        self.play(FadeIn(flag_t), run_time=1.2)
        t.ring["car"].set_color(AMBER)
        self.play(Indicate(t.ring["car"], color=AMBER, scale_factor=1.2), run_time=1.4)
        wait_until(self, 78)

        # the end-ring legend, tucked bottom-left under the tree
        legend = end_flag_badge().scale(0.9).move_to([-3.6, -3.25, 0])
        self.play(FadeIn(legend), run_time=1.2)
        wait_until(self, 96)

        # the character is on the EDGE, not the node payload (short line under panel)
        edge_note = fit_label("the character rides the EDGE into the node",
                              6.2, 21, INK_MUTED).move_to([3.2, -2.55, 0])
        self.play(FadeIn(edge_note),
                  Indicate(VGroup(t.edge["car"].char_label), color=ACCENT, scale_factor=1.3), run_time=1.6)
        self.guard(t, panel, legend, edge_note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : the three operations all walk the string ────────────────────────
class Cue03(AvoScene):
    headline = "insert · search · startsWith — all walk the string"
    cue_duration = 131.3

    def construct(self):
        intro = fit_label("Every operation follows the characters down from the root. They differ only in what they do with the end-of-word flag.",
                          12.8, 23, INK_MUTED).move_to([0, 2.7, 0])
        self.play(FadeIn(intro), run_time=1.6)
        wait_until(self, 10)

        rows = VGroup()
        specs = [
            ("insert", "walk the chars; CREATE any missing child; SET the end flag on the last node",
             EMERALD, 12),
            ("search", "walk the chars; if any is missing → false; else RETURN the end flag",
             ACCENT, 12),
            ("startsWith", "walk the chars; if any is missing → false; else true — IGNORE the flag",
             VIOLET, 12),
        ]
        cards = []
        y = 1.2
        for name, does, color, _ in specs:
            card = RoundedRectangle(width=12.4, height=1.35, corner_radius=0.14,
                                    stroke_color=color, stroke_width=2.4,
                                    fill_color=color, fill_opacity=0.05).move_to([0, y, 0])
            nm = fit_label(name, 3.0, 30, color, weight="BOLD").move_to(card.get_left() + RIGHT * 1.7)
            ds = fit_label(does, 8.4, 22, INK).move_to(card.get_center() + RIGHT * 1.9)
            cards.append((card, nm, ds))
            rows.add(VGroup(card, nm, ds))
            y -= 1.7

        # reveal one at a time with generous pacing
        beats = [26, 56, 86]
        for (card, nm, ds), t_end in zip(cards, beats):
            self.play(Create(card), FadeIn(nm), run_time=1.2)
            self.play(Write(ds), run_time=1.4)
            wait_until(self, t_end - 6)
            self.play(Indicate(nm, color=nm.get_color(), scale_factor=1.15), run_time=1.2)
            wait_until(self, t_end)

        # the punchline: the flag is the only difference
        flag_words = VGroup(
            fit_label("insert SETS it", 3.6, 22, EMERALD),
            fit_label("search RETURNS it", 4.0, 22, ACCENT),
            fit_label("startsWith IGNORES it", 4.6, 22, VIOLET),
        ).arrange(RIGHT, buff=0.7).move_to([0, -3.05, 0])
        self.play(FadeIn(flag_words, shift=UP * 0.1), run_time=1.6)
        self.play(Indicate(flag_words, color=AMBER), run_time=1.4)
        self.guard(intro, rows, flag_words)
        pace_to(self, self.cue_duration)


# ─── Cue04 : path exists ≠ word (the end flag matters) ───────────────────────
class Cue04(AvoScene):
    headline = 'Only "card" inserted → the c-a-r path exists, but "car" is not a word'
    cue_duration = 131.2

    def construct(self):
        # trie with ONLY "card"
        m, t = build_trie(["card"], top=2.05, level_gap=1.12, x_gap=1.7, x_center=-2.5)
        self.play(FadeIn(t), run_time=1.6)
        self.add(t.ring["card"])
        t.ring["card"].set_color(C_END)
        chipd = word_chip("card", color=EMERALD, fs=24).move_to([-4.5, 2.35, 0])
        self.play(FadeIn(chipd), Indicate(t.ring["card"], color=AMBER), run_time=1.4)
        note0 = fit_label('only "card" is stored — end flag on the d node', 6.2, 21, INK_MUTED).move_to([3.1, 2.35, 0])
        self.play(FadeIn(note0), run_time=1.2)
        wait_until(self, 18)

        # now search("car")
        query = fit_label('search("car")', 4.6, 30, ACCENT, weight="BOLD").move_to([3.3, 1.15, 0])
        self.play(FadeIn(query), run_time=1.0)
        wait_until(self, 28)

        # walk c-a-r, coloring the path
        for p in ["c", "ca", "car"]:
            t.recolor_edge(p, ACCENT)
            t.recolor_node(p, ACCENT)
            self.play(Indicate(VGroup(t.edge[p], t.node[p]), color=ACCENT), run_time=1.2)
            wait_until(self, elapsed(self) + 6)
        step1 = fit_label("c → a → r : every character exists ✓", 6.4, 23, ACCENT).move_to([3.3, 0.15, 0])
        self.play(FadeIn(step1), run_time=1.4)
        wait_until(self, 74)

        # BUT the r node has no end ring
        r_focus = SurroundingRectangle(t.node["car"], color=ROSE, buff=0.16, corner_radius=0.1)
        self.play(Create(r_focus), run_time=1.2)
        t.recolor_node("car", ROSE)
        step2 = fit_label("but the r node's end flag is OFF", 6.4, 23, ROSE).move_to([3.3, -0.95, 0])
        self.play(FadeIn(step2), Indicate(t.node["car"], color=ROSE, scale_factor=1.2), run_time=1.6)
        wait_until(self, 100)

        verdict = fit_label('search("car") → false', 5.6, 30, ROSE, weight="BOLD").move_to([3.3, -2.05, 0])
        self.play(FadeIn(verdict, shift=UP * 0.1), run_time=1.4)
        lesson = fit_label("a path existing ≠ a word existing — always check the flag",
                           12.4, 23, INK_MUTED).move_to([0, -3.25, 0])
        self.play(FadeIn(lesson), run_time=1.4)
        self.guard(t, chipd, note0, query, step1, step2, verdict, lesson)
        pace_to(self, self.cue_duration)


# ─── Cue05 : where tries shine ───────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Where a trie earns its keep"
    cue_duration = 131.3

    def construct(self):
        apps = [
            ("Prefix queries", "does any stored word start with this? — one walk, not a scan", ACCENT),
            ("Type-ahead", "autocomplete: every completion sits in the prefix's subtree", EMERALD),
            ("Fixed word list, many lookups", "build once, then O(L) per query regardless of dictionary size", VIOLET),
            ("Grid word-search pruning", "stop the DFS the moment the path is not a stored prefix", AMBER),
        ]
        cards = VGroup()
        positions = [[-3.3, 1.15, 0], [3.3, 1.15, 0], [-3.3, -1.45, 0], [3.3, -1.45, 0]]
        built = []
        for (title, body, color), pos in zip(apps, positions):
            card = RoundedRectangle(width=6.3, height=2.1, corner_radius=0.16,
                                    stroke_color=color, stroke_width=2.4,
                                    fill_color=color, fill_opacity=0.06).move_to(pos)
            tt = fit_label(title, 5.8, 25, color, weight="BOLD").move_to(card.get_top() + DOWN * 0.42)
            bd = fit_label(body, 5.8, 19, INK_MUTED)
            if bd.width > 5.8:
                bd.scale(5.8 / bd.width)
            bd.move_to(card.get_center() + DOWN * 0.35)
            built.append(VGroup(card, tt, bd))
            cards.add(VGroup(card, tt, bd))

        beats = [24, 54, 84, 114]
        for grp, t_end in zip(built, beats):
            self.play(FadeIn(grp[0]), FadeIn(grp[1]), run_time=1.2)
            self.play(Write(grp[2]), run_time=1.4)
            wait_until(self, t_end)

        self.guard(cards)
        pace_to(self, self.cue_duration)


# ─── Cue06 : when NOT to use a trie ──────────────────────────────────────────
class Cue06(AvoScene):
    headline = "When a hash set is the simpler tool"
    cue_duration = 91.9

    def construct(self):
        intro = fit_label("A trie is not free — reach for it only when prefixes matter.",
                          12.0, 26, INK).move_to([0, 2.5, 0])
        self.play(FadeIn(intro), run_time=1.4)
        wait_until(self, 10)

        points = [
            ("Exact membership, no prefixes", "a hash set is O(1) and far simpler to reason about", EMERALD),
            ("Memory for speed", "a node per character (+ child map) — heavier than one hash key", AMBER),
            ("Sparse data", "few shared prefixes → little reuse, lots of near-empty nodes", ROSE),
        ]
        rows = VGroup()
        y = 1.1
        built = []
        for title, body, color in points:
            dot = Dot(radius=0.12, color=color).move_to([-5.6, y, 0])
            tt = fit_label(title, 4.8, 25, color, weight="BOLD")
            tt.next_to(dot, RIGHT, buff=0.3)
            bd = fit_label(body, 6.6, 21, INK_MUTED)
            bd.next_to(tt, RIGHT, buff=0.4)
            grp = VGroup(dot, tt, bd)
            built.append(grp)
            rows.add(grp)
            y -= 1.15

        beats = [30, 52, 74]
        for grp, t_end in zip(built, beats):
            self.play(FadeIn(grp, shift=RIGHT * 0.15), run_time=1.4)
            wait_until(self, t_end)

        closing = fit_label("tries trade memory for prefix speed — a great trade only when you need prefixes",
                            12.8, 22, INK_MUTED).move_to([0, -2.9, 0])
        self.play(FadeIn(closing), run_time=1.4)
        self.guard(intro, rows, closing)
        pace_to(self, self.cue_duration)
