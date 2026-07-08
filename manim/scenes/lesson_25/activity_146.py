"""
Lesson 25 — Orientation (activity 146): "System Design — the algorithmic
toolbox and the recognition habit" (829.9s, 8 long cues).

The reactivation map for the system-design round. The spine idea: the round is
mostly RECOGNITION — hear the signal, reach for the right small tool, defend the
trade-off. From that spine hang the members of the toolbox, each one a
signal→tool pairing the later parts and lessons go deep on:
  keys reshuffle on resize   → consistent hashing (a ring; ~1/N keys move)
  cap the request rate       → token bucket (lazy refill, bursts to capacity)
  strict no-burst limit       → sliding-window counter (rolling recent count)
  read must see latest write  → quorum (R + W > N forces overlap)
  one leader, no split-brain  → consensus (a strict majority makes progress)
  O(1) get + evict            → LRU cache (hash map + doubly linked list)

Uses sysdesign.py (hash_ring, ring_marker, ring_arc, token_bucket, timeline,
tick) for the ring / bucket / window cues and inline helpers for the modulo
table, quorum overlap, consensus majority, and LRU map+list. MathTex is reserved
for the few complexity bounds.

Cue00 0-103.7    the recognition game — a small toolbox hides in system design
Cue01 103.7-207.5 server = hash mod N reshuffles almost every key when N changes
Cue02 207.5-311.2 put servers + keys on a ring; a new server steals one arc (~1/N)
Cue03 311.2-414.9 token bucket: store a count + timestamp, refill lazily, burst to cap
Cue04 414.9-518.7 sliding window: count recent timestamps, allow only under the limit
Cue05 518.7-642.2 quorum: make read and write sets overlap so R + W > N
Cue06 642.2-741   consensus: only a strict majority may make progress → no split brain
Cue07 741-829.9   LRU cache: a hash map + a doubly linked list gives O(1) evict
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from sysdesign import (
    hash_ring, ring_marker, ring_arc, owner_of, token_bucket, timeline, tick,
    C_SERVER, C_NEW, C_KEY, C_ALLOW, C_REJECT,
)
from arrays import value_row, recolor_cell, complexity
from bayes import fit_label, chip
from manim import (
    VGroup, Text, MathTex, Arrow, Line, Dot, Circle, RoundedRectangle,
    FadeIn, FadeOut, Write, Transform, Indicate, Circumscribe, GrowFromCenter,
    GrowArrow, Create, RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def card(title, sub, color, w=4.1, h=1.5):
    box = RoundedRectangle(width=w, height=h, corner_radius=0.14, stroke_color=color,
                           stroke_width=2.6, fill_color=color, fill_opacity=0.10)
    t = fit_label(title, w - 0.4, 26, color, weight="BOLD").move_to(box.get_center() + UP * 0.34)
    s = fit_label(sub, w - 0.35, 19, INK_MUTED).move_to(box.get_center() + DOWN * 0.34)
    grp = VGroup(box, t, s)
    grp.box = box
    return grp


# ─── Cue00 : the recognition game (the toolbox map) ──────────────────────────
class Cue00(AvoScene):
    headline = "System design is recognition: signal → tool → trade-off"
    cue_duration = 103.7

    def construct(self):
        spine = fit_label("hear the signal, reach for the tool, defend the trade-off",
                          12.0, 30, INK_MUTED).move_to([0, 2.35, 0])
        self.play(Write(spine), run_time=2.2)
        wait_until(self, 9.0)

        specs = [
            ("Consistent hashing", "keys reshuffle on resize", ACCENT),
            ("Token bucket", "cap the request rate", EMERALD),
            ("Sliding window", "no bursts allowed", AMBER),
            ("Quorum", "read sees latest write", VIOLET),
            ("Consensus", "one leader, no split-brain", ROSE),
            ("LRU cache", "O(1) get and evict", ACCENT_LIGHT),
        ]
        cards = []
        xs = [-4.5, 0.0, 4.5]
        ys = [0.75, -1.1]
        for i, (t, s, col) in enumerate(specs):
            c = card(t, s, col)
            c.move_to([xs[i % 3], ys[i // 3], 0])
            cards.append(c)

        reveal_times = [16, 27, 38, 50, 62, 74]
        for i, c in enumerate(cards):
            wait_until(self, reveal_times[i])
            self.play(FadeIn(c, shift=UP * 0.15), run_time=1.5)

        wait_until(self, 88.0)
        close = fit_label("name the tool from the signal, then defend its trade-off",
                          12.0, 24, INK).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(close), run_time=1.6)
        self.guard(spine, *cards, close)
        pace_to(self, self.cue_duration)


# ─── Cue01 : modulo reshuffles almost everything ─────────────────────────────
class Cue01(AvoScene):
    headline = "server = hash mod N reshuffles almost every key"
    cue_duration = 103.8

    def construct(self):
        formula = MathTex(r"\text{server} = \text{hash}(key)\ \bmod\ N",
                          color=INK).scale(0.95).move_to([0, 2.2, 0])
        self.play(Write(formula), run_time=2.0)
        wait_until(self, 10.0)

        keys = ["k1", "k2", "k3", "k4", "k5", "k6"]
        hashes = [17, 22, 39, 44, 51, 68]
        n4 = [h % 4 for h in hashes]
        n5 = [h % 5 for h in hashes]

        row = value_row(keys, w=1.25, h=0.8, fs=26, index=False).move_to([0, 0.9, 0])
        self.play(FadeIn(row), run_time=1.4)
        wait_until(self, 20.0)

        lab4 = Text("N = 4", font_size=26, color=ACCENT)
        b4 = [Text(str(v), font_size=28, color=ACCENT, weight="BOLD")
              .move_to([row.cells[i].get_center()[0], -0.25, 0]) for i, v in enumerate(n4)]
        lab4.move_to([-5.1, -0.25, 0])
        self.play(FadeIn(lab4), run_time=0.8)
        for i, b in enumerate(b4):
            wait_until(self, 26 + i * 3.0)
            self.play(FadeIn(b), run_time=0.6)
        wait_until(self, 48.0)

        lab5 = Text("N = 5", font_size=26, color=ROSE)
        b5 = [Text(str(v), font_size=28, color=ROSE, weight="BOLD")
              .move_to([row.cells[i].get_center()[0], -1.2, 0]) for i, v in enumerate(n5)]
        lab5.move_to([-5.1, -1.2, 0])
        self.play(FadeIn(lab5), run_time=0.8)
        for i, b in enumerate(b5):
            wait_until(self, 54 + i * 2.6)
            self.play(FadeIn(b), run_time=0.6)
        wait_until(self, 74.0)

        moved = [i for i in range(len(keys)) if n4[i] != n5[i]]
        self.play(*[Indicate(row.cells[i], color=ROSE, scale_factor=1.15) for i in moved],
                  run_time=2.0)
        tally = chip(f"{len(moved)} of 6 keys jump servers", color=ROSE, w=6.2, h=0.95, fs=26)
        tally.move_to([0, -2.4, 0])
        self.play(FadeIn(tally), run_time=1.2)
        wait_until(self, 88.0)
        note = fit_label("one resize → almost every cache lookup misses: a cache-miss storm",
                         12.8, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.6)
        self.guard(formula, row, lab4, *b4, lab5, *b5, tally, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : the ring — ownership local to an arc ────────────────────────────
class Cue02(AvoScene):
    headline = "On a ring, ownership is local to one arc"
    cue_duration = 103.7

    SRV = [40, 160, 280]
    SRV_LAB = ["A", "B", "C"]
    SRV_COL = [ACCENT, VIOLET, AMBER]
    KEYS = [90, 210, 330]
    KEY_LAB = ["k1", "k2", "k3"]

    def construct(self):
        ring = hash_ring(radius=2.05, center=(-2.2, 0.2))
        smarks = [ring_marker(ring, d, self.SRV_LAB[i], kind="server", color=self.SRV_COL[i])
                  for i, d in enumerate(self.SRV)]
        kmarks = [ring_marker(ring, d, self.KEY_LAB[i], kind="key")
                  for i, d in enumerate(self.KEYS)]

        self.play(Create(ring.circle), run_time=2.0)
        wait_until(self, 8.0)
        for i, m in enumerate(smarks):
            wait_until(self, 12 + i * 5.0)
            self.play(GrowFromCenter(m.dot), FadeIn(m.text), run_time=1.2)
        wait_until(self, 30.0)
        for i, m in enumerate(kmarks):
            wait_until(self, 32 + i * 4.0)
            self.play(GrowFromCenter(m.dot), FadeIn(m.text), run_time=1.0)
        wait_until(self, 46.0)

        arcs = VGroup()
        for i, kd in enumerate(self.KEYS):
            oi = owner_of(self.SRV, kd)
            arcs.add(ring_arc(ring, kd, self.SRV[oi], color=self.SRV_COL[oi], width=8.0))
        self.play(Create(arcs), run_time=2.4)
        own = fit_label("each key is owned by the first server clockwise", 5.6, 22, INK).move_to([3.6, 2.0, 0])
        self.play(FadeIn(own), run_time=1.4)
        wait_until(self, 64.0)

        # add a new server between B@160 and C@280
        newm = ring_marker(ring, 230, "D", kind="server", color=C_NEW)
        self.play(GrowFromCenter(newm.dot), FadeIn(newm.text),
                  Circumscribe(newm.dot, color=C_NEW, fade_out=True), run_time=1.8)
        arc = ring_arc(ring, 160, 230, color=C_NEW, width=9.0)
        stolen = [i for i, kd in enumerate(self.KEYS) if 160 < kd <= 230]  # k2@210
        self.play(Create(arc), run_time=1.4)
        for i in stolen:
            kmarks[i].dot.set_fill(C_NEW, opacity=1.0)
            kmarks[i].dot.set_stroke(C_NEW, width=2.0)
        self.play(*[Indicate(kmarks[i].dot, color=C_NEW, scale_factor=1.6) for i in stolen],
                  *[kmarks[i].text.animate.set_color(C_NEW) for i in stolen], run_time=1.6)
        wait_until(self, 82.0)

        frac = chip("add 1 of N → ≈ 1/N keys move", color=C_NEW, w=5.6, h=0.95, fs=23).move_to([3.4, 0.2, 0])
        self.play(FadeIn(frac), Circumscribe(frac, color=C_NEW), run_time=1.6)
        note = fit_label("no global reshuffle — only the new server's arc changes hands",
                         12.8, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.6)
        self.guard(ring, *smarks, *kmarks, newm, arcs, arc, own, frac, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : token bucket — lazy refill, bounded burst ───────────────────────
class Cue03(AvoScene):
    headline = "Token bucket: a count + a timestamp, refilled lazily"
    cue_duration = 103.7

    def construct(self):
        bkt = token_bucket(5, 5, label="tokens").move_to([-3.8, -0.1, 0])
        self.play(FadeIn(bkt.box), run_time=1.2)
        self.play(*[GrowFromCenter(d) for d in bkt.tokens], run_time=2.0)
        wait_until(self, 10.0)

        state = chip("state = (count, timestamp)", color=ACCENT, w=6.4, h=0.9, fs=24).move_to([3.0, 2.1, 0])
        self.play(FadeIn(state), run_time=1.2)
        wait_until(self, 20.0)

        # a burst up to capacity is allowed
        burst = chip("burst of 5 → all allowed", color=EMERALD, w=6.0, h=0.9, fs=24).move_to([3.0, 0.9, 0])
        self.play(FadeIn(burst), Indicate(VGroup(*bkt.tokens), color=EMERALD), run_time=1.6)
        bkt.set_filled(0)
        self.play(FadeOut(VGroup(*bkt.tokens)), run_time=1.4)
        wait_until(self, 38.0)

        # then empty → throttled to the drip rate
        rej = chip("empty → throttled to drip rate", color=ROSE, w=6.6, h=0.9, fs=24).move_to([3.0, -0.4, 0])
        self.play(FadeIn(rej), Indicate(bkt.box, color=ROSE), run_time=1.6)
        wait_until(self, 56.0)

        # lazy refill on the next request
        rule = MathTex(r"\text{tokens} \leftarrow \min(\text{cap},\ \text{tokens} + \Delta t \times \text{rate})",
                       color=INK).scale(0.7).move_to([3.0, -1.5, 0])
        self.play(Write(rule), run_time=1.8)
        wait_until(self, 70.0)
        bkt.set_filled(3)
        self.play(*[GrowFromCenter(bkt.tokens[i]) for i in range(3)], run_time=1.6)
        wait_until(self, 84.0)

        note = fit_label("bursts up to capacity are friendly; the long-run rate is the drip rate",
                         12.8, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.6)
        self.guard(bkt.box, state, burst, rej, rule, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : sliding window — strict rolling count ───────────────────────────
class Cue04(AvoScene):
    headline = "Sliding-window counter: a strict rolling count"
    cue_duration = 103.8

    def construct(self):
        tl = timeline(length=9.5, y=0.4).move_to([0, 0.4, 0])
        self.play(Create(tl.line), FadeIn(tl[1]), run_time=1.6)
        wait_until(self, 10.0)

        fracs = [0.12, 0.24, 0.4, 0.55, 0.7, 0.86]
        ticks = []
        for i, f in enumerate(fracs):
            wait_until(self, 16 + i * 4.0)
            tk = tick(tl.at(f), color=AMBER)
            ticks.append(tk)
            self.play(Create(tk), run_time=0.8)
        wait_until(self, 44.0)

        win_lo, win_hi = tl.at(0.5)[0], tl.at(0.95)[0]
        win = RoundedRectangle(width=(win_hi - win_lo), height=1.05, corner_radius=0.12,
                               stroke_color=ACCENT, stroke_width=3.0,
                               fill_color=ACCENT, fill_opacity=0.10).move_to([(win_lo + win_hi) / 2, 0.4, 0])
        wlab = Text("window: last 60s", font_size=22, color=ACCENT).next_to(win, UP, buff=0.3)
        self.play(Create(win), FadeIn(wlab), run_time=1.8)
        wait_until(self, 58.0)

        cnt = chip("count = 3 recent  ≤  limit 4 → allow", color=EMERALD, w=8.0, h=0.95, fs=24).move_to([0, -1.3, 0])
        self.play(FadeIn(cnt), run_time=1.4)
        wait_until(self, 74.0)

        strict = fit_label("no bursts: a 6-in-1-second spike would exceed the count and be blocked",
                           12.8, 22, INK_MUTED).move_to([0, -2.3, 0])
        self.play(FadeIn(strict), run_time=1.6)
        wait_until(self, 88.0)
        note = fit_label("strict rolling count — smoother than a bucket, but more state to keep",
                         12.8, 21, INK_SUBTLE).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.6)
        self.guard(tl, *ticks, win, wlab, cnt, strict, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : quorum — R + W > N forces overlap ───────────────────────────────
class Cue05(AvoScene):
    headline = "Quorum: R + W > N forces the sets to overlap"
    cue_duration = 123.5

    def construct(self):
        # five replicas in a row
        labels = ["r1", "r2", "r3", "r4", "r5"]
        nodes = []
        xs = [-4.4, -2.2, 0.0, 2.2, 4.4]
        for i, lab in enumerate(labels):
            c = Circle(radius=0.5, stroke_color=INK_SUBTLE, stroke_width=3.0,
                       fill_color=INK_SUBTLE, fill_opacity=0.08).move_to([xs[i], 0.35, 0])
            t = Text(lab, font_size=26, color=INK, weight="BOLD").move_to(c.get_center())
            nodes.append(VGroup(c, t))
        ng = VGroup(*nodes)
        self.play(FadeIn(ng, lag_ratio=0.15), run_time=2.2)
        n_lab = Text("N = 5 replicas", font_size=24, color=INK_MUTED).next_to(ng, UP, buff=0.35)
        self.play(FadeIn(n_lab), run_time=1.0)
        wait_until(self, 16.0)

        # write set W = {r1,r2,r3}
        wset = [0, 1, 2]
        wboxes = VGroup()
        for i in wset:
            nodes[i][0].set_stroke(EMERALD, 3.4)
            nodes[i][0].set_fill(EMERALD, 0.20)
        wtag = Text("W = 3 (write)", font_size=24, color=EMERALD).move_to([-2.4, -1.1, 0])
        self.play(*[Indicate(nodes[i][0], color=EMERALD) for i in wset], FadeIn(wtag), run_time=1.8)
        wait_until(self, 40.0)

        # read set R = {r3,r4,r5}
        rset = [2, 3, 4]
        rbrace = VGroup()
        for i in rset:
            ring = Circle(radius=0.62, stroke_color=ACCENT, stroke_width=3.4,
                          fill_opacity=0.0).move_to(nodes[i][0].get_center())
            rbrace.add(ring)
        rtag = Text("R = 3 (read)", font_size=24, color=ACCENT).move_to([2.6, -1.1, 0])
        self.play(Create(rbrace), FadeIn(rtag), run_time=1.8)
        wait_until(self, 62.0)

        # r3 is in both → overlap guarantees the read sees the latest write
        overlap = Text("r3 in both sets", font_size=26, color=AMBER, weight="BOLD").move_to([0, -2.1, 0])
        self.play(Indicate(nodes[2][0], color=AMBER, scale_factor=1.3), FadeIn(overlap), run_time=2.0)
        wait_until(self, 84.0)

        ineq = MathTex(r"R + W > N\ :\quad 3 + 3 > 5", color=INK).scale(0.9).move_to([0, 2.4, 0])
        self.play(Write(ineq), run_time=1.8)
        wait_until(self, 100.0)
        note = fit_label("overlap means a read always touches a replica that saw the newest write",
                         12.8, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.8)
        self.guard(ng, n_lab, wtag, rbrace, rtag, overlap, ineq, note)
        pace_to(self, self.cue_duration)


# ─── Cue06 : consensus — majority prevents split brain ───────────────────────
class Cue06(AvoScene):
    headline = "Consensus: only a strict majority makes progress"
    cue_duration = 98.8

    def construct(self):
        labels = ["n1", "n2", "n3", "n4", "n5"]
        xs = [-4.4, -2.2, 0.0, 2.2, 4.4]
        nodes = []
        for i, lab in enumerate(labels):
            c = Circle(radius=0.5, stroke_color=INK_SUBTLE, stroke_width=3.0,
                       fill_color=INK_SUBTLE, fill_opacity=0.08).move_to([xs[i], 0.8, 0])
            t = Text(lab, font_size=26, color=INK, weight="BOLD").move_to(c.get_center())
            nodes.append(VGroup(c, t))
        ng = VGroup(*nodes)
        self.play(FadeIn(ng, lag_ratio=0.15), run_time=2.2)
        wait_until(self, 12.0)

        # a network partition splits the cluster {n1,n2,n3} | {n4,n5}
        wall = Line([1.1, 2.1, 0], [1.1, -0.4, 0], color=ROSE, stroke_width=6)
        wlab = Text("network partition", font_size=24, color=ROSE).next_to(wall, UP, buff=0.2)
        self.play(Create(wall), FadeIn(wlab), run_time=1.8)
        wait_until(self, 34.0)

        # majority side {n1,n2,n3} keeps progress
        maj = [0, 1, 2]
        for i in maj:
            nodes[i][0].set_stroke(EMERALD, 3.4)
            nodes[i][0].set_fill(EMERALD, 0.20)
        majtag = chip("3 of 5 = majority → commits", color=EMERALD, w=5.4, h=0.9, fs=22).move_to([-3.5, -1.4, 0])
        self.play(*[Indicate(nodes[i][0], color=EMERALD) for i in maj], FadeIn(majtag), run_time=2.0)
        wait_until(self, 58.0)

        # minority side {n4,n5} cannot
        mino = [3, 4]
        for i in mino:
            nodes[i][0].set_stroke(ROSE, 3.4)
            nodes[i][0].set_fill(ROSE, 0.16)
        mintag = chip("2 of 5 = no majority → stalls", color=ROSE, w=5.4, h=0.9, fs=22).move_to([3.5, -1.4, 0])
        self.play(*[Indicate(nodes[i][0], color=ROSE) for i in mino], FadeIn(mintag), run_time=2.0)
        wait_until(self, 80.0)

        note = fit_label("two leaders can never both hold a majority, so they can never both commit",
                         13.0, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.8)
        self.guard(ng, wall, wlab, majtag, mintag, note)
        pace_to(self, self.cue_duration)


# ─── Cue07 : LRU cache — map + doubly linked list ────────────────────────────
class Cue07(AvoScene):
    headline = "LRU cache: a hash map + a doubly linked list"
    cue_duration = 88.9

    def construct(self):
        # the hash map (key → node) on top
        keys = ["A", "B", "C"]
        map_cells = []
        for i, k in enumerate(keys):
            box = RoundedRectangle(width=1.2, height=0.8, corner_radius=0.1,
                                   stroke_color=VIOLET, stroke_width=2.6,
                                   fill_color=VIOLET, fill_opacity=0.12)
            t = Text(k, font_size=26, color=INK, weight="BOLD").move_to(box.get_center())
            map_cells.append(VGroup(box, t))
        mg = VGroup(*map_cells).arrange(RIGHT, buff=0.5).move_to([0, 2.0, 0])
        mlab = Text("hash map: key → node", font_size=22, color=VIOLET).next_to(mg, UP, buff=0.28)
        self.play(FadeIn(mg), FadeIn(mlab), run_time=1.8)
        wait_until(self, 14.0)

        # the doubly linked list (MRU front ↔ LRU back)
        list_cells = []
        for i, k in enumerate(keys):
            box = RoundedRectangle(width=1.4, height=1.0, corner_radius=0.1,
                                   stroke_color=ACCENT, stroke_width=2.6,
                                   fill_color=ACCENT, fill_opacity=0.12)
            t = Text(k, font_size=28, color=INK, weight="BOLD").move_to(box.get_center())
            list_cells.append(VGroup(box, t))
        lg = VGroup(*list_cells).arrange(RIGHT, buff=1.0).move_to([0, -0.3, 0])
        # bidirectional arrows between adjacent nodes
        arrows = VGroup()
        for i in range(len(list_cells) - 1):
            a = Arrow(list_cells[i][0].get_right(), list_cells[i + 1][0].get_left(),
                      buff=0.12, color=INK_MUTED, stroke_width=3.5,
                      max_tip_length_to_length_ratio=0.25)
            b = Arrow(list_cells[i + 1][0].get_left(), list_cells[i][0].get_right(),
                      buff=0.12, color=INK_MUTED, stroke_width=3.5,
                      max_tip_length_to_length_ratio=0.25).shift(DOWN * 0.16)
            a.shift(UP * 0.16)
            arrows.add(a, b)
        self.play(FadeIn(lg), run_time=1.4)
        self.play(GrowArrow(arrows[0]), GrowArrow(arrows[1]),
                  GrowArrow(arrows[2]), GrowArrow(arrows[3]), run_time=1.6)
        front = Text("MRU (front)", font_size=20, color=EMERALD).next_to(list_cells[0], DOWN, buff=0.3)
        back = Text("LRU (back)", font_size=20, color=ROSE).next_to(list_cells[-1], DOWN, buff=0.3)
        self.play(FadeIn(front), FadeIn(back), run_time=1.4)
        wait_until(self, 40.0)

        ops = VGroup(
            Text("get(k):  map finds the node → move it to the front", font_size=22, color=INK),
            Text("put(k):  add at the front; evict the back if full", font_size=22, color=INK),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3).move_to([0, -2.0, 0])
        self.play(FadeIn(ops[0]), run_time=1.4)
        wait_until(self, 56.0)
        self.play(FadeIn(ops[1]), run_time=1.4)
        wait_until(self, 70.0)

        bound = complexity(r"O(1)\ \text{ get, put, and evict}", color=EMERALD, fs=34).to_edge(DOWN, buff=0.55)
        self.play(Write(bound), run_time=1.8)
        self.guard(mg, mlab, lg, arrows, front, back, ops, bound)
        pace_to(self, self.cue_duration)
