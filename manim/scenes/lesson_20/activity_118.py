"""
Lesson 20 — Part 2 (activity 118): "Autocomplete — every word in the prefix's
subtree" (106.5s, 6 short cues).

One running trie the whole way — {cat, car, card, cart}. Prefix "car" has three
completions (car, card, cart); "cat" sits under ca but NOT under car, so it is
the word the walk-to-the-prefix skips. That single word carries the whole
pruning intuition.

Cue00 0-19.4    Autocomplete returns every stored word that begins with the prefix.
Cue01 19.4-40   Walk the prefix from the root; a missing character ⇒ no completions.
Cue02 40-61.3   Standing on the prefix node, every word in its subtree begins with
                the prefix — and nothing outside it does.
Cue03 61.3-82.6 DFS the subtree; at each end-of-word node, record the accumulated
                string.
Cue04 82.6-96.8 Words under ca but not under car (cat) are never even looked at —
                the walk to the prefix skipped them.
Cue05 96.8-106.5 Record only end-of-word nodes; the bare prefix node ca is not a
                 word.

Uses the trie.py idiom lib (subtree_nodes, path recolor, end rings). No MathTex.
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
    word_chip,
    C_NODE,
    C_PATH,
    C_END,
    C_MISS,
    C_SUBTREE,
)
from manim import (
    VGroup,
    Text,
    Circle,
    RoundedRectangle,
    SurroundingRectangle,
    FadeIn,
    FadeOut,
    Write,
    Create,
    Indicate,
    GrowFromCenter,
    RIGHT,
    LEFT,
    UP,
    DOWN,
)

WORDS = ["cat", "car", "card", "cart"]
TOP = 2.25
LG = 1.14
XG = 1.55
XC = -2.6


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def trie_of(words=WORDS, x_center=XC):
    m = TrieModel(words)
    t = TrieMobject(m, top=TOP, level_gap=LG, x_gap=XG, r=0.38, fs=28, x_center=x_center)
    return m, t


def show_rings(scene, t, words, color=C_END):
    for w in words:
        t.ring[w].set_color(color)
        scene.add(t.ring[w])


# ─── Cue00 : what autocomplete returns ───────────────────────────────────────
class Cue00(AvoScene):
    headline = "Autocomplete: every stored word that begins with the prefix"
    cue_duration = 19.4

    def construct(self):
        m, t = trie_of()
        show_rings(self, t, WORDS)
        self.play(FadeIn(t), run_time=1.6)
        wait_until(self, 6)

        prefix = word_chip("car", color=VIOLET, fs=26).move_to([3.4, 1.9, 0])
        plabel = fit_label("prefix", 2.0, 20, INK_MUTED).next_to(prefix, LEFT, buff=0.3)
        self.play(FadeIn(prefix), FadeIn(plabel), run_time=1.0)
        wait_until(self, 11)

        arrow = fit_label("→ completions:", 4.0, 22, INK_MUTED).move_to([3.4, 0.8, 0])
        comps = VGroup(
            word_chip("car", color=EMERALD, fs=24),
            word_chip("card", color=EMERALD, fs=24),
            word_chip("cart", color=EMERALD, fs=24),
        ).arrange(DOWN, buff=0.28).move_to([3.4, -1.1, 0])
        self.play(FadeIn(arrow), run_time=0.8)
        self.play(FadeIn(comps, shift=UP * 0.1), run_time=1.4)
        self.play(Indicate(VGroup(t.ring["car"], t.ring["card"], t.ring["cart"]), color=EMERALD), run_time=1.4)
        self.guard(t, prefix, comps)
        pace_to(self, self.cue_duration)


# ─── Cue01 : walk the prefix from the root ───────────────────────────────────
class Cue01(AvoScene):
    headline = "Step 1: walk the prefix down from the root"
    cue_duration = 20.6

    def construct(self):
        m, t = trie_of()
        show_rings(self, t, WORDS)
        self.play(FadeIn(t), run_time=1.4)

        query = fit_label('prefix = "car"', 4.6, 26, VIOLET, weight="BOLD").move_to([3.4, 1.7, 0])
        self.play(FadeIn(query), run_time=0.9)

        for p in ["c", "ca", "car"]:
            t.recolor_edge(p, ACCENT)
            t.recolor_node(p, ACCENT)
            self.play(Indicate(VGroup(t.edge[p], t.node[p]), color=ACCENT), run_time=1.0)
            wait_until(self, elapsed(self) + 2.5)

        landed = fit_label("landed on the car node", 6.0, 23, ACCENT).move_to([3.4, 0.3, 0])
        self.play(FadeIn(landed), Indicate(t.node["car"], color=ACCENT, scale_factor=1.2), run_time=1.4)
        miss = fit_label("if a character were missing:\nno completions → return empty", 6.4, 21, INK_MUTED)
        miss.move_to([3.4, -1.4, 0])
        self.play(FadeIn(miss), run_time=1.4)
        self.guard(t, query, landed, miss)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the subtree is exactly the completions ──────────────────────────
class Cue02(AvoScene):
    headline = "Every word in the prefix node's subtree begins with the prefix"
    cue_duration = 21.3

    def construct(self):
        m, t = trie_of()
        show_rings(self, t, WORDS)
        self.play(FadeIn(t), run_time=1.4)

        # mark the prefix node
        for p in ["c", "ca", "car"]:
            t.recolor_edge(p, ACCENT)
        t.recolor_node("car", ACCENT)
        self.play(Indicate(t.node["car"], color=ACCENT), run_time=1.0)
        wait_until(self, 5)

        # highlight the whole subtree under "car" in violet.
        # NOTE: build the box from COPIES of the subtree nodes — wrapping live
        # edge mobjects in a new VGroup reparents them and hides their end-rings.
        sub_paths = ["card", "cart"]  # descendants (car itself already marked)
        subtree_ref = VGroup(*[t.node[p].copy() for p in ["car", "card", "cart"]])
        subtree_box = SurroundingRectangle(subtree_ref, color=VIOLET, buff=0.28, corner_radius=0.12)
        for p in sub_paths:
            t.recolor_edge(p, VIOLET)
            t.recolor_node(p, VIOLET)
        self.play(Create(subtree_box),
                  Indicate(VGroup(t.node["card"], t.node["cart"]), color=VIOLET), run_time=1.6)
        note = fit_label("subtree of car = { car, card, cart } — and nothing outside it",
                         8.6, 22, VIOLET).move_to([0.9, -3.15, 0])
        self.play(FadeIn(note), run_time=1.4)
        wait_until(self, 15)

        # cat is explicitly outside
        outside = fit_label("cat is NOT in this subtree", 5.6, 22, INK_MUTED).move_to([3.6, 1.4, 0])
        self.play(FadeIn(outside), Indicate(t.node["cat"], color=INK_SUBTLE), run_time=1.4)
        self.guard(t, subtree_box, note, outside)
        pace_to(self, self.cue_duration)


# ─── Cue03 : DFS the subtree, record end-of-word nodes ───────────────────────
class Cue03(AvoScene):
    headline = "DFS the subtree; record the string at each end-of-word node"
    cue_duration = 21.3

    def construct(self):
        m, t = trie_of()
        show_rings(self, t, WORDS)
        self.play(FadeIn(t), run_time=1.2)

        # prefix path faint accent, subtree violet
        for p in ["c", "ca", "car"]:
            t.recolor_edge(p, ACCENT)
        t.recolor_node("car", ACCENT)

        collected = fit_label("collected:", 3.0, 22, INK_MUTED).move_to([3.6, 2.0, 0])
        self.play(FadeIn(collected), run_time=0.7)
        found = VGroup().move_to([3.6, 0.6, 0])
        self.add(found)

        # visit each end-of-word node in DFS order: car, card, cart
        y0 = 1.2
        for i, w in enumerate(["car", "card", "cart"]):
            t.recolor_node(w, VIOLET)
            self.play(Indicate(t.node[w], color=AMBER, scale_factor=1.25),
                      Indicate(t.ring[w], color=AMBER), run_time=1.0)
            rec = word_chip(w, color=EMERALD, fs=22).move_to([3.6, y0 - i * 0.9, 0])
            self.play(FadeIn(rec, shift=LEFT * 0.15), run_time=0.9)
            found.add(rec)
            wait_until(self, elapsed(self) + 2.8)

        note = fit_label("three end-of-word nodes → three completions", 8.4, 22, INK_MUTED).move_to([2.4, -3.1, 0])
        self.play(FadeIn(note), run_time=1.4)
        self.guard(t, collected, found, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : the pruned branch (cat) is never visited ────────────────────────
class Cue04(AvoScene):
    headline = "Words under ca but not under car (cat) are never looked at"
    cue_duration = 14.2

    def construct(self):
        m, t = trie_of()
        show_rings(self, t, WORDS)
        self.play(FadeIn(t), run_time=1.0)

        # the walk went c → a → r (accent), car subtree violet
        for p in ["c", "ca", "car"]:
            t.recolor_edge(p, ACCENT)
        for p in ["card", "cart"]:
            t.recolor_edge(p, VIOLET)
            t.recolor_node(p, VIOLET)
        t.recolor_node("car", VIOLET)
        self.play(Indicate(VGroup(t.node["car"], t.node["card"], t.node["cart"]), color=VIOLET), run_time=1.0)
        wait_until(self, 4)

        # dim / cross out the cat branch (dim pieces individually — do NOT wrap
        # the live edge in a new VGroup, which reparents and hides end-rings).
        t.recolor_node("cat", C_MISS)
        cross = SurroundingRectangle(t.node["cat"], color=ROSE, buff=0.14, corner_radius=0.1)
        self.play(t.edge["cat"].animate.set_opacity(0.4),
                  t.node["cat"].animate.set_opacity(0.4),
                  t.ring["cat"].animate.set_opacity(0.4),
                  Create(cross), run_time=1.4)
        note = fit_label('the a→t branch was skipped — the walk turned down a→r, never a→t',
                         11.0, 22, ROSE).move_to([0.2, -3.15, 0])
        self.play(FadeIn(note), run_time=1.4)
        pruned = fit_label("no wasted work on cat", 5.6, 24, INK_MUTED).move_to([3.6, 0.9, 0])
        self.play(FadeIn(pruned), run_time=1.2)
        self.guard(t, note, pruned)
        pace_to(self, self.cue_duration)


# ─── Cue05 : record ONLY end-of-word nodes ───────────────────────────────────
class Cue05(AvoScene):
    headline = "Record only end-of-word nodes — the bare prefix ca is not a word"
    cue_duration = 9.7

    def construct(self):
        m, t = trie_of()
        show_rings(self, t, WORDS)
        self.play(FadeIn(t), run_time=0.9)

        # the "ca" node has no ring — recording it would invent a fake word
        focus = SurroundingRectangle(t.node["ca"], color=ROSE, buff=0.14, corner_radius=0.1)
        bad = fit_label('recording every node would invent "ca"', 6.6, 21, ROSE).move_to([3.4, 1.3, 0])
        self.play(Create(focus), FadeIn(bad), Indicate(t.node["ca"], color=ROSE), run_time=1.4)

        good = fit_label("only amber-ring nodes count:\ncar, card, cart", 6.4, 22, EMERALD).move_to([3.4, -0.7, 0])
        self.play(FadeIn(good),
                  Indicate(VGroup(t.ring["car"], t.ring["card"], t.ring["cart"]), color=AMBER), run_time=1.6)
        self.guard(t, bad, good)
        pace_to(self, self.cue_duration)
