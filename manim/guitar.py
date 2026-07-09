"""
Reusable guitar / fingerpicking visual idioms for Lesson 11 "Fingerpicking
Fundamentals: Why Your Hands Should Do Different Jobs" (acts 66/67/68/69) and any
future music / technique lesson.

The visual vocabulary here is *music-technique-visual*, deliberately NOT the
algorithm (arrays/graph/binsearch) or ML (transformer/imgprep) idioms of the
other lessons. Fingerpicking pedagogy is a story about SIX horizontal strings, a
right hand whose four digits (p-i-m-a) each own a string region, and notes that
are either stacked at one instant (a strum) or spread across time (an arpeggio).
So the idioms make the string set, the PIMA finger assignment, the pluck event,
and the vertical-vs-horizontal texture contrast the stars.

Conventions
-----------
* Strings are numbered 1..6. String 1 (high e) is the thinnest / highest pitch
  and sits at the TOP; string 6 (low E) is the thickest / lowest pitch and sits
  at the BOTTOM — so the wound "bass strings" 6/5/4 the thumb reaches for are the
  bottom group and the "treble strings" 3/2/1 the fingers carry are the top
  group. Lower strings are drawn thicker.
* PIMA colors are fixed so the eye learns them across all four segments:
    p (pulgar / thumb)  → AMBER   (the steady bass role / foundation)
    i (índice / index)  → ACCENT  (blue)
    m (medio / middle)  → EMERALD (green)
    a (anular / ring)   → VIOLET
  Bass strings share the thumb's AMBER tint; treble strings share ACCENT.

Every helper honors theme.py (dark stage, site accent hues, safe-area guard) and
returns plain Manim mobjects the cue scenes stage, transform, and highlight. The
generic text/chip helpers (chip, fit_label) are reused from bayes.py, same as the
other idiom libs, rather than duplicated.
"""

from __future__ import annotations

from manim import (
    VGroup,
    RoundedRectangle,
    Text,
    Line,
    Dot,
    Arrow,
    SurroundingRectangle,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ORIGIN,
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

# ─── semantic colors (shared across all four parts) ──────────────────────────
C_THUMB = AMBER      # p / pulgar — the bass pulse, the foundation
C_INDEX = ACCENT     # i / índice
C_MIDDLE = EMERALD   # m / medio
C_RING = VIOLET      # a / anular
C_BASS = AMBER       # bass strings 6/5/4 (thumb's region)
C_TREBLE = ACCENT    # treble strings 3/2/1 (fingers' region)
C_STRING = INK_SUBTLE  # a string at rest

# open-string note name per string number (standard tuning)
STRING_NOTE = {1: "e", 2: "B", 3: "G", 4: "D", 5: "A", 6: "E"}
# which PIMA digit owns which string region
STRING_FINGER = {6: "p", 5: "p", 4: "p", 3: "i", 2: "m", 1: "a"}
FINGER_COLOR = {"p": C_THUMB, "i": C_INDEX, "m": C_MIDDLE, "a": C_RING}
FINGER_SPANISH = {"p": "pulgar", "i": "índice", "m": "medio", "a": "anular"}
FINGER_ENGLISH = {"p": "thumb", "i": "index", "m": "middle", "a": "ring"}


class StringSet(VGroup):
    """
    Six horizontal strings drawn top (string 1, high e) → bottom (string 6, low
    E). Exposes:
      .lines[s]  — the Line mobject for string number s (1..6)
      .ynum[s]   — the y coordinate of string s
      .labels[s] — the "s · note" label VGroup at the left of string s
    plus .left_x / .right_x for placing plucks along the string.
    """

    def __init__(self, width=8.0, gap=0.66, x_center=0.0, y_center=0.0,
                 labels=True, label_fs=20):
        super().__init__()
        self.lines = {}
        self.ynum = {}
        self.labels = {}
        top_y = y_center + gap * 2.5
        self.left_x = x_center - width / 2
        self.right_x = x_center + width / 2
        for s in range(1, 7):
            y = top_y - (s - 1) * gap
            self.ynum[s] = y
            # thicker toward the bass (string 6)
            sw = 1.6 + (s - 1) * 0.9
            line = Line([self.left_x, y, 0], [self.right_x, y, 0],
                        color=C_STRING, stroke_width=sw)
            self.lines[s] = line
            self.add(line)
            if labels:
                lab = Text(f"{s}·{STRING_NOTE[s]}", font_size=label_fs,
                           color=INK_MUTED)
                lab.next_to(line.get_start(), LEFT, buff=0.22)
                self.labels[s] = lab
                self.add(lab)

    def x_at(self, frac: float) -> float:
        """Absolute x for a fraction (0..1) across the playable string span."""
        return self.left_x + frac * (self.right_x - self.left_x)

    def tint(self, s: int, color) -> Line:
        """Recolor string s (e.g. bass=amber, treble=accent)."""
        self.lines[s].set_color(color)
        return self.lines[s]


def region_brace(strings: StringSet, s_lo: int, s_hi: int, color, label,
                 fs=22, side=RIGHT, buff=0.35):
    """
    A translucent rounded band + label spanning string numbers s_lo..s_hi
    (inclusive; s_lo is the TOP/lower-number string). Used to mark the "bass
    strings 6/5/4" and "treble strings 3/2/1" regions. Returns VGroup(band[,lab]).
    """
    y_top = strings.ynum[s_lo]
    y_bot = strings.ynum[s_hi]
    h = (y_top - y_bot) + 0.42
    cy = (y_top + y_bot) / 2
    w = (strings.right_x - strings.left_x) + 0.5
    band = RoundedRectangle(width=w, height=h, corner_radius=0.14,
                            stroke_color=color, stroke_width=2.2,
                            fill_color=color, fill_opacity=0.10)
    band.move_to([(strings.left_x + strings.right_x) / 2, cy, 0])
    grp = VGroup(band)
    if label:
        lab = fit_label(label, 3.0, fs, color, weight="BOLD")
        lab.next_to(band, side, buff=buff)
        grp.add(lab)
    return grp


def pluck(strings: StringSet, s: int, frac: float, color=None, r=0.15,
          letter=None, letter_fs=22):
    """
    A note event: a filled dot on string s at horizontal fraction `frac`,
    optionally tagged with the PIMA letter that plays it. Color defaults to the
    string-region color. Returns VGroup(dot[, tag]); `.dot` is the Dot.
    """
    if color is None:
        color = C_BASS if s >= 4 else C_TREBLE
    d = Dot([strings.x_at(frac), strings.ynum[s], 0], radius=r, color=color)
    d.set_fill(color, opacity=1.0)
    grp = VGroup(d)
    grp.dot = d
    if letter:
        tag = Text(letter, font_size=letter_fs, color=color, weight="BOLD")
        tag.next_to(d, UP, buff=0.1)
        grp.add(tag)
    return grp


def pima_row(fs=30, gap=0.7, box_w=1.0, box_h=1.0, show_english=False):
    """
    The four PIMA chips in a row (p i m a), each in its fixed finger color.
    Returns VGroup with .chips = {letter: VGroup(box, text)} for highlighting.
    """
    row = VGroup()
    chips = {}
    for letter in ["p", "i", "m", "a"]:
        col = FINGER_COLOR[letter]
        box = RoundedRectangle(width=box_w, height=box_h, corner_radius=0.14,
                               stroke_color=col, stroke_width=2.6,
                               fill_color=col, fill_opacity=0.14)
        t = Text(letter, font_size=fs, color=col, weight="BOLD").move_to(box.get_center())
        c = VGroup(box, t)
        chips[letter] = c
        row.add(c)
    row.arrange(RIGHT, buff=gap)
    row.chips = chips
    return row


def finger_legend(letter, fs=22):
    """
    A one-line "p = pulgar (thumb)" legend in the finger's color. Returns Text.
    """
    txt = f"{letter} = {FINGER_SPANISH[letter]} ({FINGER_ENGLISH[letter]})"
    return Text(txt, font_size=fs, color=FINGER_COLOR[letter])


def assign_arrow(chip_mob, strings: StringSet, s: int, color, into=0.4):
    """
    An arrow from a PIMA chip to the string region it owns. The tip lands ON the
    string (`into` units past its left end) so the arrowhead clears the left-edge
    string-number label. Returns the Arrow.
    """
    tip = [strings.left_x + into, strings.ynum[s], 0]
    tail = chip_mob.get_right()
    return Arrow(tail, tip, buff=0.12, color=color, stroke_width=4,
                 max_tip_length_to_length_ratio=0.12)


def strum_column(strings: StringSet, frac=0.5, color=INK, sset=range(1, 7)):
    """
    A vertical dashed line through all played strings at one x — the "vertical
    texture" of a strum: every note at the SAME moment. Returns VGroup(line,
    dots) with dots on each string in `sset`.
    """
    x = strings.x_at(frac)
    ys = [strings.ynum[s] for s in sset]
    line = Line([x, max(ys) + 0.3, 0], [x, min(ys) - 0.3, 0],
                color=color, stroke_width=3)
    grp = VGroup(line)
    for s in sset:
        col = C_BASS if s >= 4 else C_TREBLE
        grp.add(Dot([x, strings.ynum[s], 0], radius=0.13, color=col).set_fill(col, 1.0))
    return grp


def time_axis(strings: StringSet, y=None, label="time →"):
    """
    A horizontal time arrow beneath the strings — the "horizontal texture" of an
    arpeggio: notes spread left→right across time. Returns VGroup(arrow, label).
    """
    if y is None:
        y = strings.ynum[6] - 0.7
    arrow = Arrow([strings.left_x, y, 0], [strings.right_x + 0.3, y, 0],
                  buff=0, color=INK_MUTED, stroke_width=3,
                  max_tip_length_to_length_ratio=0.05)
    lab = Text(label, font_size=20, color=INK_MUTED).next_to(arrow, DOWN, buff=0.12)
    return VGroup(arrow, lab)
