"""
Lesson 24 — Orientation (activity 140): "Graph Reactivation: One Loop, Swap the
Container" (877.4s, 9 long cues, family-map orientation).

The reactivation map for the whole graph family. The spine idea: graph traversal
is ONE loop over a frontier, and the container holding the frontier decides the
algorithm — a FIFO queue is BFS, a LIFO stack is DFS, a min-priority-queue is
Dijkstra. From that spine hang the variations: BFS's FIFO gives shortest unweighted
paths, marking visited at push keeps each node in the frontier once, multi-source
BFS seeds every source together and counts layers, Union Find answers "same group?"
incrementally, Dijkstra's PQ finalizes the cheapest node on first pop (non-negative
weights only), and topological sort is in-degree BFS that returns fewer nodes when a
cycle exists. The recurring bugs are visited-timing, container mismatch, Dijkstra on
negatives, and bare Union Find — never the ideas themselves.

Uses graph.py (graph_group, container, grid_board, forest_nodes, parent_arrow,
dist_badge) + arrays.code_line for the one-loop skeleton. MathTex only for the
complexity bounds.

Cue00 0-88.8     recall speed — pick the right traversal (the family map)
Cue01 88.8-188   one loop; queue→BFS, stack→DFS, priority queue→Dijkstra
Cue02 188-292.5  FIFO forces nondecreasing distance → first reach = shortest
Cue03 292.5-396.9 mark visited at push → each node enters the frontier once
Cue04 396.9-511.8 multi-source BFS seeds all sources, counts layers
Cue05 511.8-616.3 Union Find: same group? path compression + union by rank
Cue06 616.3-720.8 priority queue expands cheapest; first pop is final (non-neg)
Cue07 720.8-814.8 topological sort = in-degree BFS; fewer nodes ⇔ a cycle
Cue08 814.8-877.4 the four bugs: visited timing, container, negatives, bare UF
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from graph import (
    graph_group, container, recolor_slot, grid_board, set_cell, minute_tag,
    forest_nodes, parent_arrow, root_ring, node_circle, recolor_node, recolor_edge,
    dist_badge, C_UNSEEN, C_FRONTIER, C_CURRENT, C_DONE, C_SOURCE, C_FRESH, C_ROTTEN,
)
from arrays import code_line, value_badge
from bayes import fit_label, chip
from manim import (
    VGroup, Text, MathTex, Arrow, Line, RoundedRectangle, FadeIn, FadeOut, Write,
    Transform, Indicate, Circumscribe, GrowArrow, GrowFromCenter, RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def card(title, sub, color, w=4.0, h=1.45):
    box = RoundedRectangle(width=w, height=h, corner_radius=0.14, stroke_color=color,
                           stroke_width=2.6, fill_color=color, fill_opacity=0.10)
    t = fit_label(title, w - 0.4, 25, color, weight="BOLD").move_to(box.get_center() + UP * 0.32)
    s = fit_label(sub, w - 0.3, 19, INK_MUTED).move_to(box.get_center() + DOWN * 0.32)
    grp = VGroup(box, t, s)
    grp.box = box
    return grp


# a small unweighted graph reused for the BFS cues (dist from S: S0 A1 B1 C2 D2 E3)
BFS_LABELS = ["S", "A", "B", "C", "D", "E"]
BFS_POS = [[-5.0, 0.0], [-2.8, 1.5], [-2.8, -1.5], [-0.4, 1.5], [-0.4, -1.5], [2.0, 0.0]]
BFS_EDGES = [(0, 1), (0, 2), (1, 3), (2, 4), (3, 5), (4, 5)]
BFS_DIST = {0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3}


# ─── Cue00 : the family map ──────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Graph traversal: pick the tool, code it calmly"
    cue_duration = 88.8

    def construct(self):
        spine = fit_label("strong but stale — the goal is recall speed", 11.0, 30, INK_MUTED)
        spine.move_to([0, 2.0, 0])
        self.play(Write(spine), run_time=2.0)
        wait_until(self, 8.0)

        specs = [
            ("BFS", "queue · shortest hops", ACCENT),
            ("DFS", "stack · deep paths", VIOLET),
            ("Dijkstra", "priority queue · weighted", AMBER),
            ("Multi-source BFS", "many seeds · layers", EMERALD),
            ("Union Find", "same group?", ROSE),
            ("Topological sort", "order a DAG", ACCENT_LIGHT),
        ]
        cards = []
        xs = [-4.3, 0.0, 4.3]
        ys = [0.55, -1.15]
        for i, (t, s, col) in enumerate(specs):
            c = card(t, s, col)
            c.move_to([xs[i % 3], ys[i // 3], 0])
            cards.append(c)

        # reveal the six family members two at a time to fill the long cue
        reveal_times = [16, 28, 40, 52, 62, 72]
        for i, c in enumerate(cards):
            wait_until(self, reveal_times[i])
            self.play(FadeIn(c, shift=UP * 0.15), run_time=1.4)

        self.guard(spine, *cards)
        pace_to(self, self.cue_duration)


# ─── Cue01 : one loop, swap the container ────────────────────────────────────
class Cue01(AvoScene):
    headline = "One loop — the container is the algorithm"
    cue_duration = 99.2

    def construct(self):
        # the single traversal skeleton on the left
        lines = [
            code_line("seen = {start}", color=INK),
            code_line("frontier = CONTAINER([start])", color=INK),
            code_line("while frontier:", color=INK),
            code_line("node = frontier.pop()", color=INK, indent=1),
            code_line("for nbr in graph[node]:", color=INK, indent=1),
            code_line("if nbr not in seen:", color=INK, indent=2),
            code_line("seen.add(nbr)", color=INK, indent=3),
            code_line("frontier.push(nbr)", color=INK, indent=3),
        ]
        code = VGroup(*lines).arrange(DOWN, aligned_edge=LEFT, buff=0.18).scale(0.8)
        code.to_edge(LEFT, buff=0.7).shift(UP * 0.2)
        self.play(FadeIn(code, lag_ratio=0.15), run_time=3.0)
        wait_until(self, 12.0)

        # spotlight CONTAINER — the one word that changes everything
        cont_word = lines[1][0]  # the Text of line 1
        box = Circumscribe(lines[1], color=AMBER)
        self.play(box, run_time=1.5)
        swap = fit_label("swap CONTAINER → swap the algorithm", 8.5, 24, AMBER)
        swap.to_edge(LEFT, buff=0.7).shift(DOWN * 2.4)
        self.play(FadeIn(swap), run_time=1.4)
        wait_until(self, 30.0)

        # three container variants on the right, revealed one at a time
        q = container("queue", [1, 2, 3], w=0.7, h=0.62, fs=22, color=ACCENT).scale(0.85)
        q.move_to([3.4, 1.7, 0])
        self.play(FadeIn(q), run_time=1.4)
        wait_until(self, 52.0)

        s = container("stack", [1, 2, 3], w=0.7, h=0.62, fs=22, color=VIOLET).scale(0.72)
        s.move_to([2.2, -1.4, 0])
        self.play(FadeIn(s), run_time=1.4)
        wait_until(self, 72.0)

        p = container("pq", [1, 2, 5], w=0.7, h=0.62, fs=22, color=AMBER).scale(0.85)
        p.move_to([4.7, -1.4, 0])
        self.play(FadeIn(p), run_time=1.4)

        self.guard(code, swap, q, s, p)
        pace_to(self, self.cue_duration)


# ─── Cue02 : FIFO → nondecreasing distance ───────────────────────────────────
class Cue02(AvoScene):
    headline = "FIFO forces nondecreasing distance"
    cue_duration = 104.5

    def construct(self):
        g = graph_group(BFS_LABELS, BFS_EDGES, BFS_POS, node_r=0.42, node_fs=26)
        g.shift(DOWN * 0.2)
        self.play(FadeIn(g), run_time=2.0)
        recolor_node(g.nodes[0], C_CURRENT)
        slab = dist_badge(g.nodes[0], "0", color=C_DONE, side=LEFT)
        self.play(FadeIn(slab), Indicate(g.nodes[0], color=C_CURRENT), run_time=1.6)
        wait_until(self, 12.0)

        # expand BFS layer by layer, stamping each node's distance
        layers = {1: [1, 2], 2: [3, 4], 3: [5]}
        badges = [slab]
        beat_times = {1: 24, 2: 48, 3: 72}
        for d in (1, 2, 3):
            wait_until(self, beat_times[d])
            anims = []
            for n in layers[d]:
                recolor_node(g.nodes[n], C_DONE)
                b = dist_badge(g.nodes[n], str(d), color=C_DONE,
                               side=UP if g.nodes[n].get_y() >= 0 else DOWN)
                badges.append(b)
                anims.append(FadeIn(b))
                anims.append(Indicate(g.nodes[n], color=C_DONE))
            # recolor the edges into that layer
            for (u, v) in BFS_EDGES:
                if BFS_DIST[v] == d and BFS_DIST[u] == d - 1:
                    recolor_edge(g, u, v, C_DONE)
            self.play(*anims, run_time=2.0)

        wait_until(self, 90.0)
        note = fit_label("distances only grow — the first time BFS reaches a node, it's a shortest path",
                         13.0, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), Indicate(g.nodes[5], color=C_DONE, scale_factor=1.2), run_time=1.8)
        self.guard(g, note, *badges)
        pace_to(self, self.cue_duration)


# ─── Cue03 : mark visited at push ────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Mark visited the instant you push"
    cue_duration = 104.4

    def construct(self):
        # a node C reachable from two frontier nodes A and B
        labs = ["A", "B", "C"]
        pos = [[-3.4, 1.4], [-3.4, -1.4], [0.4, 0.0]]
        g = graph_group(labs, [(0, 2), (1, 2)], pos, node_r=0.5, node_fs=30)
        recolor_node(g.nodes[0], C_CURRENT)
        recolor_node(g.nodes[1], C_FRONTIER)
        self.play(FadeIn(g), run_time=1.8)
        seen = value_badge("seen", "{A, B}", color=C_DONE, w=3.4, h=0.9, val_fs=26).move_to([4.4, 1.6, 0])
        self.add(seen)
        wait_until(self, 14.0)

        # A pushes C → mark C seen the instant it enters the frontier
        recolor_node(g.nodes[2], C_FRONTIER)
        recolor_edge(g, 0, 2, C_FRONTIER)
        push1 = Text("A pushes C → seen.add(C)", font_size=24, color=EMERALD, weight="BOLD")
        push1.move_to([0, -2.15, 0])
        self.play(Indicate(g.nodes[2], color=C_FRONTIER),
                  Transform(seen.value_text,
                            Text("{A, B, C}", font_size=26, color=C_DONE, weight="BOLD").move_to(seen.value_text)),
                  FadeIn(push1), run_time=2.0)
        wait_until(self, 46.0)

        # B also reaches C, but C already in seen → does NOT re-enter frontier
        self.play(FadeOut(push1), run_time=0.6)
        push2 = Text("B reaches C, but C ∈ seen → skip", font_size=24, color=ROSE, weight="BOLD")
        push2.move_to([0, -2.15, 0])
        recolor_edge(g, 1, 2, ROSE)
        self.play(FadeIn(push2), Indicate(g.nodes[2], color=ROSE), run_time=1.8)
        wait_until(self, 74.0)

        contrast = fit_label("mark at POP instead and C enters the frontier twice — the classic bug",
                             13.0, 22, AMBER).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(contrast), run_time=1.8)
        self.guard(g, seen, push2, contrast)
        pace_to(self, self.cue_duration)


# ─── Cue04 : multi-source BFS ────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Multi-source BFS: seed all sources, count layers"
    cue_duration = 114.9

    def construct(self):
        states = ["RFFFR", "FFFFF", "FFFFF"]
        layer = [[0, 1, 2, 1, 0], [1, 2, 3, 2, 1], [2, 3, 4, 3, 2]]
        b = grid_board(states, cell=0.8, gap=0.09).shift(LEFT * 1.3 + DOWN * 0.1)
        # start: only the two sources are rotten
        for r in range(3):
            for c in range(5):
                set_cell(b.cell[r][c], C_ROTTEN if layer[r][c] == 0 else C_FRESH)
        self.play(FadeIn(b), run_time=2.0)
        srcs = [(0, 0), (0, 4)]
        self.play(*[Indicate(b.cell[r][c].box, color=ROSE, scale_factor=1.15) for (r, c) in srcs],
                  run_time=1.6)
        lab = fit_label("2 sources enqueued together at layer 0", 4.6, 21, INK_MUTED).move_to([3.9, 2.0, 0])
        self.play(FadeIn(lab), run_time=1.2)
        wait_until(self, 20.0)

        # spread minute by minute
        minute = value_badge("layer", "0", color=C_CURRENT, w=2.8, h=0.9).move_to([4.2, 0.4, 0])
        self.add(minute)
        beat_times = {1: 34, 2: 54, 3: 74, 4: 92}
        for m in (1, 2, 3, 4):
            wait_until(self, beat_times[m])
            cells = [(r, c) for r in range(3) for c in range(5) if layer[r][c] == m]
            for (r, c) in cells:
                set_cell(b.cell[r][c], C_ROTTEN)
            self.play(*[GrowFromCenter(b.cell[r][c].box) for (r, c) in cells],
                      Transform(minute.value_text,
                                Text(str(m), font_size=34, color=C_CURRENT, weight="BOLD").move_to(minute.value_text)),
                      run_time=1.6)

        wait_until(self, 104.0)
        note = fit_label("simultaneous spread becomes one queue loop — deepest layer = the answer",
                         13.0, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), Indicate(b.cell[2][2].box, color=C_DONE, scale_factor=1.2), run_time=1.8)
        self.guard(b, lab, minute, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : Union Find ──────────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Union Find: same group? in near-constant time"
    cue_duration = 104.5

    def construct(self):
        labs = ["0", "1", "2", "3", "4"]
        pos = [[-3.2, 1.3], [-4.4, -0.6], [-2.0, -0.6], [3.2, 1.3], [3.2, -0.6]]
        f = forest_nodes(labs, pos, r=0.4, fs=26)
        self.play(FadeIn(f), run_time=1.8)
        wait_until(self, 12.0)

        # attach with unions, dropping the group count
        count = value_badge("groups", "5", color=INK, w=3.0, h=0.9).move_to([0, -2.1, 0])
        self.play(FadeIn(count), run_time=1.0)
        unions = [(1, 0), (2, 0), (4, 3)]
        arrows = []
        beat_times = [26, 46, 66]
        remaining = 5
        for i, (child, par) in enumerate(unions):
            wait_until(self, beat_times[i])
            a = parent_arrow(f.nodes[child], f.nodes[par], color=ACCENT, r=0.4)
            arrows.append(a)
            remaining -= 1
            self.play(GrowArrow(a),
                      Transform(count.value_text,
                                Text(str(remaining), font_size=34, color=INK, weight="BOLD").move_to(count.value_text)),
                      run_time=1.6)

        wait_until(self, 84.0)
        r0 = root_ring(f.nodes[0], color=ACCENT, r=0.4)
        r3 = root_ring(f.nodes[3], color=EMERALD, r=0.4)
        self.play(FadeIn(r0), FadeIn(r3), run_time=1.2)
        note = fit_label("find follows parents to a root; path compression + union by rank → O(α) ≈ O(1)",
                         13.0, 21, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.6)
        self.guard(f, count, note)
        pace_to(self, self.cue_duration)


# ─── Cue06 : Dijkstra priority queue ─────────────────────────────────────────
class Cue06(AvoScene):
    headline = "Dijkstra: expand the cheapest, first pop is final"
    cue_duration = 104.5

    def construct(self):
        # weighted 4-node graph: dist(S→C)=4 via S-A-B-C
        labs = ["S", "A", "B", "C"]
        pos = [[-4.6, 0.0], [-1.4, 1.6], [-1.4, -1.6], [2.4, 0.0]]
        edges = [(0, 1), (0, 2), (1, 2), (1, 3), (2, 3)]
        weights = {(0, 1): 1, (0, 2): 4, (1, 2): 2, (1, 3): 5, (2, 3): 1}
        g = graph_group(labs, edges, pos, node_r=0.44, node_fs=26, weights=weights)
        g.shift(LEFT * 0.4)
        self.play(FadeIn(g), run_time=2.2)
        recolor_node(g.nodes[0], C_DONE)
        d0 = dist_badge(g.nodes[0], "0", color=C_DONE, side=LEFT)
        self.add(d0)
        wait_until(self, 16.0)

        # settle order by tentative distance: S0 → A1 → B3 → C4
        settle = [(1, 1), (2, 3), (3, 4)]
        badges = [d0]
        beat_times = [30, 52, 74]
        for i, (n, dist) in enumerate(settle):
            wait_until(self, beat_times[i])
            recolor_node(g.nodes[n], C_DONE)
            b = dist_badge(g.nodes[n], str(dist), color=C_DONE,
                           side=UP if g.nodes[n].get_y() >= 0 else DOWN)
            badges.append(b)
            self.play(FadeIn(b), Indicate(g.nodes[n], color=C_CURRENT), run_time=1.8)

        wait_until(self, 90.0)
        warn = fit_label("first pop of a node is its final distance — non-negative weights only",
                         13.0, 22, AMBER).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(warn), Circumscribe(badges[-1], color=C_DONE), run_time=1.8)
        self.guard(g, warn, *badges)
        pace_to(self, self.cue_duration)


# ─── Cue07 : topological sort = in-degree BFS ────────────────────────────────
class Cue07(AvoScene):
    headline = "Topological sort = in-degree BFS"
    cue_duration = 94.0

    def construct(self):
        # DAG: A→B, A→C, B→D, C→D. in-degrees A0 B1 C1 D2
        labs = ["A", "B", "C", "D"]
        pos = [[-4.4, 0.0], [-1.4, 1.5], [-1.4, -1.5], [1.6, 0.0]]
        edges = [(0, 1), (0, 2), (1, 3), (2, 3)]
        g = graph_group(labs, edges, pos, node_r=0.44, node_fs=26, directed=True)
        g.shift(LEFT * 0.3)
        self.play(FadeIn(g), run_time=2.0)
        indeg = {0: 0, 1: 1, 2: 1, 3: 2}
        deg_badges = {}
        for i in range(4):
            db = dist_badge(g.nodes[i], f"in={indeg[i]}", color=INK_MUTED, side=DOWN, fs=20)
            deg_badges[i] = db
        self.play(*[FadeIn(db) for db in deg_badges.values()], run_time=1.6)
        wait_until(self, 16.0)

        order = value_badge("order", "A", color=C_DONE, w=3.6, h=0.9, val_fs=28).move_to([4.4, 1.6, 0])
        recolor_node(g.nodes[0], C_DONE)
        self.play(FadeIn(order), Indicate(g.nodes[0], color=C_DONE), run_time=1.6)
        wait_until(self, 34.0)

        # process A → B,C reach in-degree 0
        for i, txt in [(1, "in=0"), (2, "in=0")]:
            self.play(Transform(deg_badges[i],
                                 dist_badge(g.nodes[i], "in=0", color=EMERALD, side=DOWN, fs=20)),
                      run_time=1.0)
        recolor_node(g.nodes[1], C_DONE)
        recolor_node(g.nodes[2], C_DONE)
        self.play(Indicate(g.nodes[1], color=C_DONE),
                  Indicate(g.nodes[2], color=C_DONE),
                  Transform(order.value_text,
                            Text("A B C", font_size=28, color=C_DONE, weight="BOLD").move_to(order.value_text)),
                  run_time=1.8)
        wait_until(self, 62.0)

        recolor_node(g.nodes[3], C_DONE)
        self.play(Transform(deg_badges[3],
                            dist_badge(g.nodes[3], "in=0", color=EMERALD, side=DOWN, fs=20)),
                  Indicate(g.nodes[3], color=C_DONE),
                  Transform(order.value_text,
                            Text("A B C D", font_size=28, color=C_DONE, weight="BOLD").move_to(order.value_text)),
                  run_time=1.8)
        wait_until(self, 78.0)
        note = fit_label("a cycle never reaches in-degree 0 → fewer than V nodes come out",
                         13.0, 22, AMBER).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.6)
        self.guard(g, order, note)
        pace_to(self, self.cue_duration)


# ─── Cue08 : the four bugs ───────────────────────────────────────────────────
class Cue08(AvoScene):
    headline = "The bugs are mechanics, not the ideas"
    cue_duration = 62.6

    def construct(self):
        bugs = [
            ("visited timing", "mark at push, not pop", ROSE),
            ("container mismatch", "queue vs stack vs PQ", AMBER),
            ("Dijkstra on negatives", "use Bellman-Ford", VIOLET),
            ("bare Union Find", "compress + rank", ACCENT),
        ]
        cards = []
        xs = [-3.4, 3.4]
        ys = [0.9, -1.3]
        for i, (t, s, col) in enumerate(bugs):
            c = card(t, s, col, w=5.4, h=1.5)
            c.move_to([xs[i % 2], ys[i // 2], 0])
            cards.append(c)
        beat_times = [6, 18, 30, 42]
        for i, c in enumerate(cards):
            wait_until(self, beat_times[i])
            self.play(FadeIn(c, shift=UP * 0.12), run_time=1.4)
        wait_until(self, 52.0)
        note = fit_label("the ideas are simple — the points are earned on the mechanics",
                         12.8, 24, EMERALD).move_to([0, 2.1, 0])
        self.play(Write(note), run_time=1.8)
        self.guard(note, *cards)
        pace_to(self, self.cue_duration)
