"""
Lesson 25 — Part 1 (activity 147): "Consistent Hashing — a ring so adding a
server moves few keys" (122.7s, 6 cues).

The concrete ring walkthrough behind the orientation's "place servers and keys
on a ring; a new server only steals one arc." Servers and keys hash onto one
circle; a key is owned by the first server clockwise from its point, so adding
or removing a server disturbs only one arc (~1/N of the keys) instead of the
near-total reshuffle that `server = hash mod N` causes.

Uses sysdesign.py (hash_ring, ring_marker, ring_arc, owner_of) — the ring
vocabulary, NOT the transformer / graph idioms. MathTex is reserved for the two
complexity bounds (O(log n) lookup, ~O(K/N) remap).

Cue00 0-22.3    server = hash mod N reshuffles nearly every key when N changes
Cue01 22.3-46.1 servers + keys on a ring; first server clockwise owns the key
Cue02 46.1-70.6 add a server → it steals only its one arc (~one-Nth of keys)
Cue03 70.6-95.2 one point per server = uneven arcs; many replicas average out
Cue04 95.2-111.5 keep positions sorted, binary-search the next clockwise: O(log n)
Cue05 111.5-122.7 remove a server → its arc spills to the next neighbour clockwise
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from sysdesign import (
    hash_ring, ring_marker, ring_arc, owner_of, C_SERVER, C_NEW, C_KEY,
)
from arrays import value_row, recolor_cell, complexity
from bayes import fit_label, chip
from manim import (
    VGroup, Text, MathTex, Arrow, Line, Dot, RoundedRectangle, FadeIn, FadeOut,
    Write, Transform, Indicate, Circumscribe, GrowFromCenter, GrowArrow, Create,
    RIGHT, LEFT, UP, DOWN,
)

# three evenly spaced servers on the ring, plus keys scattered between them
SRV = [30, 150, 270]                 # S0, S1, S2 angles (deg clockwise from top)
SRV_LAB = ["S0", "S1", "S2"]
SRV_COL = [ACCENT, VIOLET, AMBER]
KEYS = [80, 200, 320, 120, 250]      # key angles
KEY_LAB = ["k1", "k2", "k3", "k4", "k5"]
RING_C = (-2.0, 0.2)
RING_R = 2.05


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def build_ring(servers=SRV, srv_lab=SRV_LAB, keys=None, key_lab=None):
    """A ring with the given servers (and optional keys) as marker VGroups."""
    ring = hash_ring(radius=RING_R, center=RING_C)
    smarks = [ring_marker(ring, d, srv_lab[i], kind="server",
                          color=SRV_COL[i % len(SRV_COL)])
              for i, d in enumerate(servers)]
    kmarks = []
    if keys:
        for i, d in enumerate(keys):
            kmarks.append(ring_marker(ring, d, key_lab[i], kind="key"))
    return ring, smarks, kmarks


# ─── Cue00 : modulo reshuffles almost everything ─────────────────────────────
class Cue00(AvoScene):
    headline = "server = hash mod N — change N, reshuffle all"
    cue_duration = 22.3

    def construct(self):
        formula = MathTex(r"\text{server} = \text{hash}(key)\ \bmod\ N",
                          color=INK).scale(0.9).move_to([0, 2.1, 0])
        self.play(Write(formula), run_time=1.4)
        wait_until(self, 2.4)

        keys = ["k1", "k2", "k3", "k4", "k5", "k6"]
        hashes = [17, 22, 39, 44, 51, 68]
        n4 = [h % 4 for h in hashes]
        n5 = [h % 5 for h in hashes]

        row = value_row(keys, w=1.2, h=0.8, fs=26, index=False).move_to([0, 0.7, 0])
        self.play(FadeIn(row), run_time=1.0)
        b4 = VGroup(*[Text(str(v), font_size=26, color=ACCENT, weight="BOLD")
                      .move_to([row.cells[i].get_center()[0], -0.25, 0])
                      for i, v in enumerate(n4)])
        lab4 = Text("N = 4", font_size=24, color=ACCENT).next_to(b4, LEFT, buff=0.5)
        self.play(FadeIn(b4), FadeIn(lab4), run_time=1.2)
        wait_until(self, 8.0)

        b5 = VGroup(*[Text(str(v), font_size=26, color=ROSE, weight="BOLD")
                      .move_to([row.cells[i].get_center()[0], -1.15, 0])
                      for i, v in enumerate(n5)])
        lab5 = Text("N = 5", font_size=24, color=ROSE).next_to(b5, LEFT, buff=0.5)
        self.play(FadeIn(b5), FadeIn(lab5), run_time=1.2)
        wait_until(self, 12.5)

        # mark which keys changed server (almost all)
        moved = [i for i in range(len(keys)) if n4[i] != n5[i]]
        self.play(*[Indicate(row.cells[i], color=ROSE, scale_factor=1.15) for i in moved],
                  run_time=1.6)
        tally = chip(f"{len(moved)} of 6 keys move", color=ROSE, w=5.0, h=0.95, fs=26)
        tally.move_to([0, -2.35, 0])
        self.play(FadeIn(tally), run_time=1.1)
        note = fit_label("one server added or removed → a cache-miss storm", 12.0, 22, INK_MUTED)
        note.to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(formula, row, b4, lab4, b5, lab5, tally, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the ring, first server clockwise owns the key ───────────────────
class Cue01(AvoScene):
    headline = "On a ring, the first server clockwise owns the key"
    cue_duration = 23.8

    def construct(self):
        ring, smarks, kmarks = build_ring(keys=KEYS[:3], key_lab=KEY_LAB[:3])
        self.play(Create(ring.circle), run_time=1.4)
        self.play(*[GrowFromCenter(m.dot) for m in smarks],
                  *[FadeIn(m.text) for m in smarks], run_time=1.6)
        wait_until(self, 5.0)

        self.play(*[GrowFromCenter(m.dot) for m in kmarks],
                  *[FadeIn(m.text) for m in kmarks], run_time=1.5)
        wait_until(self, 9.0)

        # for each key, arc clockwise to its owning server
        arcs = VGroup()
        for i, kd in enumerate(KEYS[:3]):
            oi = owner_of(SRV, kd)
            arc = ring_arc(ring, kd, SRV[oi], color=SRV_COL[oi], width=8.0)
            arcs.add(arc)
        self.play(Create(arcs), run_time=2.2)
        wait_until(self, 15.0)

        note = fit_label("walk clockwise from a key until you hit a server — that server owns it",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        legend = VGroup(
            Dot(radius=0.12, color=C_SERVER), Text("server", font_size=20, color=INK_MUTED),
            Dot(radius=0.09, color=C_KEY), Text("key", font_size=20, color=INK_MUTED),
        ).arrange(RIGHT, buff=0.28).move_to([3.6, 1.4, 0])
        self.play(FadeIn(note), FadeIn(legend), run_time=1.4)
        self.guard(ring, *smarks, *kmarks, arcs, note, legend)
        pace_to(self, self.cue_duration)


# ─── Cue02 : add a server → only one arc moves ───────────────────────────────
class Cue02(AvoScene):
    headline = "A new server steals only its one arc"
    cue_duration = 24.5

    def construct(self):
        ring, smarks, kmarks = build_ring(keys=KEYS, key_lab=KEY_LAB)
        self.add(ring, *smarks, *kmarks)
        wait_until(self, 1.5)

        # a new server drops in at 210° (between S1@150 and S2@270)
        new_deg = 210
        newm = ring_marker(ring, new_deg, "S3", kind="server", color=C_NEW)
        self.play(GrowFromCenter(newm.dot), FadeIn(newm.text),
                  Circumscribe(newm.dot, color=C_NEW, fade_out=True), run_time=1.8)
        wait_until(self, 6.0)

        # keys whose owner changes: those in the arc (S1, new] i.e. 150<key<=210
        stolen = [i for i, kd in enumerate(KEYS) if 150 < kd <= 210]   # k2@200
        arc = ring_arc(ring, 150, new_deg, color=C_NEW, width=9.0)
        self.play(Create(arc), run_time=1.4)
        self.play(*[Indicate(kmarks[i].dot, color=C_NEW, scale_factor=1.6) for i in stolen],
                  *[kmarks[i].text.animate.set_color(C_NEW) for i in stolen], run_time=1.6)
        for i in stolen:
            kmarks[i].dot.set_fill(C_NEW, opacity=1.0)
            kmarks[i].dot.set_stroke(C_NEW, width=2.0)
        wait_until(self, 13.0)

        note1 = fit_label("only keys in the new arc move — from S2 to S3", 5.4, 22, INK)
        note1.move_to([3.6, 1.4, 0])
        note2 = fit_label("every other key stays exactly where it was", 5.4, 20, INK_MUTED)
        note2.move_to([3.6, 0.5, 0])
        frac = chip("≈ 1/N of keys move", color=C_NEW, w=4.6, h=0.95, fs=26).move_to([3.6, -0.9, 0])
        self.play(FadeIn(note1), run_time=1.0)
        self.play(FadeIn(note2), run_time=1.0)
        self.play(FadeIn(frac), Circumscribe(frac, color=C_NEW), run_time=1.4)
        self.guard(ring, *smarks, *kmarks, newm, arc, note1, note2, frac)
        pace_to(self, self.cue_duration)


# ─── Cue03 : virtual nodes smooth uneven load ────────────────────────────────
class Cue03(AvoScene):
    headline = "Many replicas per server average to a fair share"
    cue_duration = 24.6

    def construct(self):
        # LEFT: one point per server → visibly uneven arcs
        r1 = hash_ring(radius=1.55, center=(-3.6, 0.3))
        s1 = [ring_marker(r1, d, "", kind="server", color=SRV_COL[i])
              for i, d in enumerate([20, 70, 250])]   # clustered → S@70 owns a huge arc
        cap1 = Text("1 point each → lumpy", font_size=22, color=ROSE).next_to(r1, DOWN, buff=0.35)
        self.play(Create(r1.circle), *[GrowFromCenter(m.dot) for m in s1], run_time=1.6)
        # shade the biggest arc (from 70 clockwise to 250) to show imbalance
        big = ring_arc(r1, 70, 250, color=ROSE, width=8.0)
        self.play(Create(big), FadeIn(cap1), run_time=1.6)
        wait_until(self, 6.5)

        # RIGHT: three replicas per server → many small even arcs
        r2 = hash_ring(radius=1.55, center=(3.4, 0.3))
        reps = [15, 135, 255, 55, 175, 295, 95, 215, 335]  # 3 each, interleaved
        rcol = [ACCENT, VIOLET, AMBER] * 3
        s2 = [ring_marker(r2, reps[i], "", kind="server", color=rcol[i], r=0.11)
              for i in range(len(reps))]
        cap2 = Text("3 replicas each → smooth", font_size=22, color=EMERALD).next_to(r2, DOWN, buff=0.35)
        self.play(Create(r2.circle), run_time=1.0)
        self.play(*[GrowFromCenter(m.dot) for m in s2], FadeIn(cap2), run_time=2.0)
        wait_until(self, 16.0)

        arrow = Arrow([-1.7, 0.3, 0], [1.5, 0.3, 0], buff=0.1, color=EMERALD, stroke_width=5)
        note = fit_label("each server hashes to many ring points, so arcs even out",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(GrowArrow(arrow), run_time=1.0)
        self.play(FadeIn(note), run_time=1.0)
        self.guard(r1.circle, big, cap1, r2.circle, cap2, arrow, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : binary-search the ring for the next point clockwise ─────────────
class Cue04(AvoScene):
    headline = "Sort the positions, binary-search the next clockwise"
    cue_duration = 16.3

    def construct(self):
        positions = ["30", "95", "150", "210", "270", "335"]
        row = value_row(positions, w=1.15, h=0.8, fs=24, index=False).move_to([0, 1.3, 0])
        cap = Text("server positions, sorted", font_size=22, color=INK_MUTED).next_to(row, UP, buff=0.28)
        self.play(FadeIn(row), FadeIn(cap), run_time=1.2)
        wait_until(self, 3.0)

        key = Text("key at 120  →  next ≥ 120 ?", font_size=26, color=AMBER).move_to([0, 0.0, 0])
        self.play(FadeIn(key), run_time=1.0)
        # binary search lands on 150 (index 2)
        recolor_cell(row.cells[2], EMERALD)
        self.play(Indicate(row.cells[2], color=EMERALD, scale_factor=1.2), run_time=1.4)
        pick = Text("owner = server @150", font_size=24, color=EMERALD).move_to([0, -0.95, 0])
        self.play(FadeIn(pick), run_time=1.0)
        wait_until(self, 10.5)

        bound = complexity(r"O(\log n)\ \text{ per lookup}", color=INK, fs=44).move_to([0, -2.1, 0])
        self.play(Write(bound), run_time=1.4)
        legend = Text("n = number of ring points", font_size=20, color=INK_SUBTLE).next_to(bound, DOWN, buff=0.2)
        self.play(FadeIn(legend), run_time=0.9)
        self.guard(row, cap, key, pick, bound, legend)
        pace_to(self, self.cue_duration)


# ─── Cue05 : remove a server → arc spills to next neighbour ──────────────────
class Cue05(AvoScene):
    headline = "Remove a server — its arc spills to one neighbour"
    cue_duration = 11.2

    def construct(self):
        ring, smarks, kmarks = build_ring(keys=KEYS[:3], key_lab=KEY_LAB[:3])
        self.add(ring, *smarks, *kmarks)
        wait_until(self, 1.0)

        # remove S1@150; its keys (k1@80, owned by S1) spill clockwise to S2@270
        removed = 1
        gone = Text("✗", font_size=44, color=ROSE, weight="BOLD").move_to(smarks[removed].dot.get_center())
        self.play(smarks[removed].dot.animate.set_opacity(0.15),
                  smarks[removed].text.animate.set_opacity(0.2),
                  FadeIn(gone), run_time=1.2)
        # k1@80 now walks clockwise past the removed S1 to the next server S2@270
        arc = ring_arc(ring, 80, SRV[2], color=SRV_COL[2], width=8.0)
        self.play(Create(arc), Indicate(kmarks[0].dot, color=SRV_COL[2], scale_factor=1.6),
                  kmarks[0].text.animate.set_color(SRV_COL[2]), run_time=1.6)
        wait_until(self, 6.5)

        note = fit_label("only the removed server's arc moves; every other key is untouched",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        bound = complexity(r"\approx O(K/N)\ \text{ keys remapped}", color=INK, fs=36).move_to([3.6, 1.2, 0])
        self.play(FadeIn(note), Write(bound), run_time=1.4)
        self.guard(ring, *kmarks, arc, gone, note, bound)
        pace_to(self, self.cue_duration)
