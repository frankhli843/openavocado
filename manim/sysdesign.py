"""
Reusable system-design visual idioms for Lesson 25 "System Design Algorithmic
Patterns: Consistent Hashing, Rate Limiting, Quorum, Consensus, LRU" (acts
146 orientation / 147 consistent hashing / 148 rate limiting), and any future
distributed-systems lesson.

The two star idioms are the *hash ring* (a circle with server points and key
points; a key is owned by the first server clockwise, and an arc marks that
ownership) and the *token bucket* (a capacity of token slots that drain on a
request and refill lazily). Both recur across the orientation and the parts, so
the eye learns one picture and the parts deepen it. One-off pictures (modulo
reshuffle, quorum overlap, consensus majority, LRU map+list, sliding window)
stay inline in the cue scenes.

Every helper honours theme.py (dark stage, site accent hues, safe-area guard)
and returns plain Manim mobjects the cue scenes stage, transform, and highlight.
Generic text helpers (chip, fit_label) and the value badge are reused from
bayes.py / arrays.py rather than duplicated.

Semantic colours (shared across all three parts so the eye learns them):
  ring / neutral structure   → INK_SUBTLE
  SERVER point on the ring    → ACCENT   (a node that owns an arc)
  NEW server being added      → EMERALD  (the node that steals one arc)
  KEY point on the ring       → AMBER    (data landing on the ring)
  OWNED arc / moved keys       → the owning server's hue
  REJECT / over-limit          → ROSE
  ALLOW / token present         → EMERALD
"""

from __future__ import annotations

import math

from manim import (
    VGroup,
    Circle,
    Dot,
    Arc,
    RoundedRectangle,
    Rectangle,
    Line,
    Arrow,
    Text,
    MathTex,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    PI,
    TAU,
)

from theme import (
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
from bayes import chip, fit_label  # noqa: F401  (re-exported for cue scenes)

# ─── Semantic role colours ───────────────────────────────────────────────────
C_RING = INK_SUBTLE     # the ring itself / neutral structure
C_SERVER = ACCENT       # a server point that owns an arc
C_NEW = EMERALD         # a newly added server (steals one arc)
C_KEY = AMBER           # a key point landing on the ring
C_REJECT = ROSE         # rejected request / over-limit
C_ALLOW = EMERALD       # allowed request / token present
C_EMPTY = INK_SUBTLE    # an empty token slot


# ─── the hash ring ───────────────────────────────────────────────────────────
def hash_ring(radius=2.2, center=(0.0, 0.0), color=C_RING, width=3.0):
    """
    The clock-face hash ring: a circle the author places server and key points
    on by angle. Angles are DEGREES measured clockwise from the top (12 o'clock
    = 0°), matching how hashes are usually drawn wrapping clockwise. Returns a
    VGroup with:
      .circle   — the ring Circle
      .center   — [x, y, 0] of the ring centre
      .radius   — the ring radius
      .point(deg) helper → [x, y, 0] on the ring at `deg` clockwise-from-top
    """
    cx, cy = center
    circ = Circle(radius=radius, stroke_color=color, stroke_width=width,
                  fill_opacity=0.0).move_to([cx, cy, 0])
    grp = VGroup(circ)
    grp.circle = circ
    grp.center = [cx, cy, 0]
    grp.radius = radius

    def point(deg, r=None):
        rr = radius if r is None else r
        th = math.radians(90.0 - deg)   # 0° = top, increasing clockwise
        return [cx + rr * math.cos(th), cy + rr * math.sin(th), 0]

    grp.point = point
    return grp


def ring_marker(ring, deg, label, *, kind="server", color=None, r=0.16,
                lab_fs=22, lab_gap=0.34):
    """
    A point on the ring at angle `deg` (clockwise from top). kind="server" draws
    a filled dot with its label OUTSIDE the ring; kind="key" draws a smaller dot
    with its label just inside/outside. Returns a VGroup with `.dot` and
    `.text`; the marker's position is on the ring so arcs line up.
    """
    col = color or (C_SERVER if kind == "server" else C_KEY)
    rr = r if kind == "server" else r * 0.7
    p = ring.point(deg)
    dot = Dot(p, radius=rr, color=col)
    dot.set_fill(col, opacity=1.0)
    # label sits radially outward for servers, inward for keys
    out = ring.point(deg, r=ring.radius + lab_gap) if kind == "server" \
        else ring.point(deg, r=ring.radius - lab_gap)
    t = fit_label(str(label), 1.4, lab_fs, col, weight="BOLD").move_to(out)
    grp = VGroup(dot, t)
    grp.dot = dot
    grp.text = t
    grp.deg = deg
    grp.color = col
    return grp


def ring_arc(ring, deg_from, deg_to, *, color=C_SERVER, width=9.0, buff=0.0):
    """
    A thick arc drawn ON the ring from `deg_from` to `deg_to` going CLOCKWISE
    (increasing degrees) — the ownership arc a server holds. Handles wrap past
    360°. Returns an Arc mobject the scene can recolor / fade as ownership moves.
    """
    span = (deg_to - deg_from) % 360
    if span == 0:
        span = 360
    # Manim Arc: start_angle CCW math convention. Our deg is clockwise-from-top,
    # so convert: math_angle = 90 - deg. Clockwise sweep = NEGATIVE angle.
    start_math = math.radians(90.0 - deg_from)
    arc = Arc(radius=ring.radius + buff, start_angle=start_math,
              angle=-math.radians(span), arc_center=ring.center,
              stroke_color=color, stroke_width=width)
    return arc


def owner_of(server_degs, key_deg):
    """
    Index of the server that owns `key_deg`: the first server clockwise
    (strictly increasing degrees, wrapping past 360). `server_degs` is a list of
    server angles. Returns the index into that list.
    """
    best_i, best_gap = 0, 1e9
    for i, s in enumerate(server_degs):
        gap = (s - key_deg) % 360
        if gap < best_gap:
            best_gap = gap
            best_i = i
    return best_i


# ─── the token bucket ────────────────────────────────────────────────────────
def token_bucket(capacity, filled, *, w=1.7, slot_r=0.26, gap=0.16,
                 lit=C_ALLOW, empty=C_EMPTY, label="bucket", lab_fs=22):
    """
    A vertical bucket holding `capacity` token slots, `filled` of them lit. The
    bucket is a rounded rectangle; tokens are dots stacked from the bottom up.
    Returns a VGroup with:
      .box       — the bucket rectangle
      .tokens    — list of the `capacity` token dots, index 0 = bottom
      .capacity, .filled
      .set_filled(n) — recolor the first n dots lit, the rest empty
    """
    n = capacity
    inner_h = n * (2 * slot_r) + (n - 1) * gap
    h = inner_h + 0.5
    box = RoundedRectangle(width=w, height=h, corner_radius=0.12,
                           stroke_color=INK_MUTED, stroke_width=2.6,
                           fill_color=INK_MUTED, fill_opacity=0.05)
    grp = VGroup(box)
    tokens = []
    y0 = box.get_bottom()[1] + 0.25 + slot_r
    cx = box.get_center()[0]
    for i in range(n):
        y = y0 + i * (2 * slot_r + gap)
        col = lit if i < filled else empty
        op = 1.0 if i < filled else 0.12
        d = Dot([cx, y, 0], radius=slot_r, color=col)
        d.set_fill(col, opacity=op)
        d.set_stroke(col, width=2.0, opacity=0.9)
        tokens.append(d)
        grp.add(d)
    lab = Text(label, font_size=lab_fs, color=INK_MUTED).next_to(box, UP, buff=0.24)
    grp.add(lab)
    grp.box = box
    grp.tokens = tokens
    grp.capacity = n
    grp.filled = filled
    grp.caption = lab

    def set_filled(k):
        k = max(0, min(n, k))
        for i, d in enumerate(tokens):
            if i < k:
                d.set_fill(lit, opacity=1.0)
                d.set_stroke(lit, width=2.0, opacity=0.9)
            else:
                d.set_fill(empty, opacity=0.12)
                d.set_stroke(empty, width=2.0, opacity=0.9)
        grp.filled = k
        return grp

    grp.set_filled = set_filled
    return grp


def request_mark(label, *, allowed=True, w=1.5, h=0.62, fs=22):
    """
    A small request pill, green ✓ when allowed and rose ✗ when rejected. Returns
    a VGroup(box, text). Used to show requests spending / being rejected.
    """
    col = C_ALLOW if allowed else C_REJECT
    mark = "✓" if allowed else "✗"
    box = RoundedRectangle(width=w, height=h, corner_radius=0.12,
                           stroke_color=col, stroke_width=2.4,
                           fill_color=col, fill_opacity=0.14)
    t = fit_label(f"{label} {mark}", w - 0.2, fs, col, weight="BOLD").move_to(box.get_center())
    grp = VGroup(box, t)
    grp.box = box
    grp.text = t
    return grp


# ─── a request timeline (sliding-window counter) ─────────────────────────────
def timeline(length=8.0, y=-1.2, color=INK_SUBTLE, label="time →", lab_fs=20):
    """
    A horizontal time axis for the sliding-window counter. Returns a VGroup with
    `.line`, `.x0`, `.x1`, `.y`, and a `.at(frac)` helper mapping 0..1 to an
    [x, y, 0] point along the axis, so the scene drops request ticks at times.
    """
    x0 = -length / 2
    x1 = length / 2
    line = Arrow([x0, y, 0], [x1 + 0.3, y, 0], buff=0.0, color=color, stroke_width=3.0,
                 max_tip_length_to_length_ratio=0.03)
    lab = Text(label, font_size=lab_fs, color=INK_MUTED).next_to(line, RIGHT, buff=0.12)
    grp = VGroup(line, lab)
    grp.line = line
    grp.x0 = x0
    grp.x1 = x1
    grp.y = y

    def at(frac):
        return [x0 + frac * (x1 - x0), y, 0]

    grp.at = at
    return grp


def tick(pt, *, color=AMBER, hh=0.26):
    """A vertical timestamp tick centred on axis point `pt`."""
    return Line([pt[0], pt[1] - hh, 0], [pt[0], pt[1] + hh, 0],
                color=color, stroke_width=4.0)
