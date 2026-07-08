"""
Lesson 20 — Part 1 (activity 117): "Trie mechanics — insert / search / startsWith"
(102.4s, 6 short cues).

One running trie the whole way — {car, card} (a straight c-a-r spine, then d) —
so each cue shows the same structure being built or walked. The whole point:
every operation walks the characters; they differ only in what they do with the
end-of-word flag.

Cue00 0-18.6    A node = a map char→child + a boolean "a word ends here".
Cue01 18.6-38.5 insert("car"): walk the chars, create the missing ones, set the
                end flag on the last node (r).
Cue02 38.5-58.9 insert("card"): the whole c-a-r path already exists — only d is
                new; the shared prefix is stored once.
Cue03 58.9-79.4 search("car"): walk c-a-r; the node exists AND its end flag is
                set → true.
Cue04 79.4-93.1 search("ca"): walk c-a; the node exists but its flag is OFF (ca
                was never stored) → false.
Cue05 93.1-102.4 startsWith("ca"): walk c-a, consume the prefix, return true —
                 the flag is never checked.

Uses the trie.py idiom lib. No MathTex.
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
    word_chip,
    C_NODE,
    C_PATH,
    C_NEW,
    C_END,
    C_MISS,
)
from manim import (
    VGroup,
    Text,
    Circle,
    RoundedRectangle,
    SurroundingRectangle,
    Arrow,
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

TOP = 2.15
LG = 1.15
XG = 1.7


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def trie_of(words, x_center=-2.4):
    m = TrieModel(words)
    t = TrieMobject(m, top=TOP, level_gap=LG, x_gap=XG, r=0.40, fs=30, x_center=x_center)
    return m, t


def show_rings(scene, t, words, color=C_END):
    for w in words:
        t.ring[w].set_color(color)
        scene.add(t.ring[w])


# ─── Cue00 : node anatomy ────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "A node: a map char→child, plus a boolean end-of-word flag"
    cue_duration = 18.6

    def construct(self):
        # one node in the middle
        node = Circle(radius=0.62, stroke_color=ACCENT, stroke_width=3.0,
                      fill_color=ACCENT, fill_opacity=0.08).move_to([-2.6, 0.4, 0])
        node_lbl = fit_label("node", 1.0, 22, INK).move_to(node.get_center())
        self.play(GrowFromCenter(node), FadeIn(node_lbl), run_time=1.2)

        # children map callout
        cmap = RoundedRectangle(width=6.6, height=1.5, corner_radius=0.14,
                                stroke_color=EMERALD, stroke_width=2.4,
                                fill_color=EMERALD, fill_opacity=0.06).move_to([2.4, 1.35, 0])
        cmap_t = fit_label("children:  { 'a' → node, 'o' → node, ... }", 6.2, 22, INK).move_to(cmap.get_center())
        self.play(Create(cmap), FadeIn(cmap_t), run_time=1.4)
        wait_until(self, 9)

        # end flag callout
        fmap = RoundedRectangle(width=6.6, height=1.5, corner_radius=0.14,
                                stroke_color=AMBER, stroke_width=2.4,
                                fill_color=AMBER, fill_opacity=0.06).move_to([2.4, -0.6, 0])
        fmap_t = fit_label("isEndOfWord:  true / false", 6.2, 22, INK).move_to(fmap.get_center())
        self.play(Create(fmap), FadeIn(fmap_t), run_time=1.4)
        ring = Circle(radius=0.75, stroke_color=AMBER, stroke_width=3.0).move_to(node.get_center())
        self.play(GrowFromCenter(ring), run_time=1.0)
        legend = fit_label("an amber ring = a real word ends here", 7.0, 21, INK_MUTED).move_to([0, -2.6, 0])
        self.play(FadeIn(legend), run_time=1.2)
        self.guard(node, cmap, fmap, legend)
        pace_to(self, self.cue_duration)


# ─── Cue01 : insert("car") ───────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = 'insert("car"): walk, create missing nodes, set the end flag'
    cue_duration = 19.9  # 38.5 - 18.6

    def construct(self):
        m, t = trie_of(["car"])
        word = word_chip("car", color=ACCENT, fs=26).move_to([3.2, 1.6, 0])
        self.play(FadeIn(t.node[""]), FadeIn(word), run_time=1.0)

        steps = fit_label("create c → a → r, then flag r as end-of-word", 6.4, 22, INK_MUTED).move_to([3.2, 0.4, 0])
        self.play(FadeIn(steps), run_time=1.0)

        for kind, path in t.path_mobjects("car"):
            if kind == "edge":
                t.recolor_edge(path, C_NEW)
                self.play(Create(t.edge[path]), run_time=0.7)
            else:
                t.recolor_node(path, C_NEW)
                self.play(FadeIn(t.node[path], scale=0.6), run_time=0.6)
        # set the end flag on r
        t.ring["car"].set_color(C_END)
        self.add(t.ring["car"])
        flag = fit_label("r.isEndOfWord = true", 5.4, 24, AMBER).move_to([3.2, -1.4, 0])
        self.play(GrowFromCenter(t.ring["car"]), FadeIn(flag),
                  Indicate(t.node["car"], color=AMBER), run_time=1.4)
        self.guard(t, word, steps, flag)
        pace_to(self, self.cue_duration)


# ─── Cue02 : insert("card") reuses the c-a-r spine ───────────────────────────
class Cue02(AvoScene):
    headline = 'insert("card"): c-a-r already exists — only d is new'
    cue_duration = 20.4  # 58.9 - 38.5

    def construct(self):
        m, t = trie_of(["car", "card"])
        show_rings(self, t, ["car"])  # car already stored
        # draw existing car path in neutral, d hidden initially
        self.play(FadeIn(VGroup(t.node[""], t.node["c"], t.node["ca"], t.node["car"],
                                t.edge["c"], t.edge["ca"], t.edge["car"])), run_time=1.4)
        word = word_chip("card", color=EMERALD, fs=26).move_to([3.2, 1.6, 0])
        self.play(FadeIn(word), run_time=0.8)

        # walk c-a-r: all exist → reuse
        for p in ["c", "ca", "car"]:
            t.recolor_edge(p, EMERALD)
        reuse = fit_label("c → a → r all exist → reuse", 6.4, 22, EMERALD).move_to([3.2, 0.4, 0])
        self.play(FadeIn(reuse),
                  Indicate(VGroup(t.edge["c"], t.edge["ca"], t.edge["car"]), color=EMERALD), run_time=1.6)
        wait_until(self, 10)

        # only d is created
        t.recolor_edge("card", C_NEW)
        t.recolor_node("card", C_NEW)
        self.play(Create(t.edge["card"]), run_time=0.7)
        self.play(FadeIn(t.node["card"], scale=0.6), run_time=0.6)
        t.ring["card"].set_color(C_END)
        self.add(t.ring["card"])
        newnote = fit_label("only the d node is new; d.isEndOfWord = true", 6.4, 22, INK_MUTED).move_to([3.2, -1.4, 0])
        self.play(GrowFromCenter(t.ring["card"]), FadeIn(newnote),
                  Indicate(t.node["card"], color=EMERALD), run_time=1.6)
        self.guard(t, word, reuse, newnote)
        pace_to(self, self.cue_duration)


# ─── Cue03 : search("car") → true ────────────────────────────────────────────
class Cue03(AvoScene):
    headline = 'search("car"): the node exists AND its end flag is set → true'
    cue_duration = 20.5  # 79.4 - 58.9

    def construct(self):
        m, t = trie_of(["car", "card"])
        show_rings(self, t, ["car", "card"])
        self.play(FadeIn(t), run_time=1.4)
        query = word_chip("car", color=ACCENT, fs=26).move_to([3.2, 1.6, 0])
        self.play(FadeIn(query), run_time=0.8)

        # walk c-a-r
        for p in ["c", "ca", "car"]:
            t.recolor_edge(p, ACCENT)
            t.recolor_node(p, ACCENT)
            self.play(Indicate(VGroup(t.edge[p], t.node[p]), color=ACCENT), run_time=0.9)
        step1 = fit_label("c → a → r : node exists ✓", 6.4, 23, ACCENT).move_to([3.2, 0.3, 0])
        self.play(FadeIn(step1), run_time=1.0)
        wait_until(self, 11)

        # check the flag on r
        t.ring["car"].set_color(AMBER)
        step2 = fit_label("r.isEndOfWord = true ✓", 6.4, 23, AMBER).move_to([3.2, -0.8, 0])
        self.play(Indicate(t.ring["car"], color=AMBER, scale_factor=1.25), FadeIn(step2), run_time=1.4)
        verdict = fit_label('→ true', 4.0, 30, EMERALD, weight="BOLD").move_to([3.2, -2.0, 0])
        self.play(FadeIn(verdict, shift=UP * 0.1), run_time=1.2)
        self.guard(t, query, step1, step2, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue04 : search("ca") → false ────────────────────────────────────────────
class Cue04(AvoScene):
    headline = 'search("ca"): the node exists but its flag is OFF → false'
    cue_duration = 13.7  # 93.1 - 79.4

    def construct(self):
        m, t = trie_of(["car", "card"])
        show_rings(self, t, ["car", "card"])
        self.play(FadeIn(t), run_time=1.2)
        query = word_chip("ca", color=ACCENT, fs=26).move_to([3.2, 1.5, 0])
        self.play(FadeIn(query), run_time=0.7)

        # walk c-a
        for p in ["c", "ca"]:
            t.recolor_edge(p, ACCENT)
            t.recolor_node(p, ACCENT)
            self.play(Indicate(VGroup(t.edge[p], t.node[p]), color=ACCENT), run_time=0.8)
        step1 = fit_label("c → a : node exists ✓", 6.4, 23, ACCENT).move_to([3.2, 0.2, 0])
        self.play(FadeIn(step1), run_time=0.9)

        # the a node has no end ring
        focus = SurroundingRectangle(t.node["ca"], color=ROSE, buff=0.15, corner_radius=0.1)
        t.recolor_node("ca", ROSE)
        step2 = fit_label('but "ca" was never stored → flag OFF', 6.4, 22, ROSE).move_to([3.2, -0.9, 0])
        self.play(Create(focus), FadeIn(step2), Indicate(t.node["ca"], color=ROSE), run_time=1.4)
        verdict = fit_label('→ false', 4.2, 30, ROSE, weight="BOLD").move_to([3.2, -2.0, 0])
        self.play(FadeIn(verdict, shift=UP * 0.1), run_time=1.2)
        self.guard(t, query, step1, step2, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue05 : startsWith("ca") → true (ignores the flag) ──────────────────────
class Cue05(AvoScene):
    headline = 'startsWith("ca"): consume the prefix, return true — ignore the flag'
    cue_duration = 9.3  # 102.4 - 93.1

    def construct(self):
        m, t = trie_of(["car", "card"])
        show_rings(self, t, ["car", "card"])
        self.play(FadeIn(t), run_time=1.0)
        query = word_chip("ca", color=VIOLET, fs=26).move_to([3.2, 1.4, 0])
        self.play(FadeIn(query), run_time=0.6)

        for p in ["c", "ca"]:
            t.recolor_edge(p, VIOLET)
            t.recolor_node(p, VIOLET)
        self.play(Indicate(VGroup(t.edge["c"], t.node["c"], t.edge["ca"], t.node["ca"]),
                           color=VIOLET), run_time=1.0)
        step = fit_label("prefix c → a consumed — no flag check", 6.4, 22, INK_MUTED).move_to([3.2, -0.3, 0])
        self.play(FadeIn(step), run_time=0.9)
        verdict = fit_label('→ true', 4.0, 30, EMERALD, weight="BOLD").move_to([3.2, -1.6, 0])
        self.play(FadeIn(verdict, shift=UP * 0.1), run_time=1.0)
        self.guard(t, query, step, verdict)
        pace_to(self, self.cue_duration)
