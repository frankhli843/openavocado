"""
Reusable cloud / service-map visual idioms for Lesson 8 "GCP Through an AWS
Lens: Core Services, Projects, and Identity" (acts 45 orientation /
46 resource-hierarchy / 47 compute / 48 storage+messaging / 49 IAM), and any
future cloud-provider lesson.

The lesson's whole pedagogy is *translation*: every concept is a GCP service or
boundary shown beside its AWS equivalent. So the two star idioms are:

  - map_pair(gcp, aws)  — a blue GCP box and an amber AWS box joined by a "≈"
    symbol. This recurs in every part (Cloud Run ≈ Fargate, GCS ≈ S3,
    Pub/Sub ≈ SQS+SNS, IAM binding ≈ IAM policy), so the eye learns one picture.
  - hierarchy(...)      — the nested Organization → Folder → Project → Resource
    ladder with a downward "IAM cascades" arrow, the backbone of act 46 and the
    boundary the orientation keeps returning to.

Plus focused helpers the parts reuse: service_box (a titled/subtitled service
chip), column (a titled vertical stack, for GCP-vs-AWS side-by-side lists),
iam_binding (principal + role + resource → a grant), and arrow_between.

Every helper honours theme.py (dark stage, site accent hues, safe-area guard)
and returns plain Manim mobjects the cue scenes stage, transform, and highlight.
Generic text helpers (chip, fit_label) are reused from bayes.py, not duplicated.

Semantic colours (shared across all five segments so the eye learns them):
  GCP service / boundary      → ACCENT   (site blue)
  AWS service / boundary      → AMBER    (AWS orange)
  neutral structure / arrows  → INK_SUBTLE
  the element in focus / "good"→ EMERALD
  a mistake / "avoid"          → ROSE
"""

from __future__ import annotations

from manim import (
    VGroup,
    RoundedRectangle,
    Rectangle,
    Line,
    Arrow,
    Text,
    RIGHT,
    LEFT,
    UP,
    DOWN,
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
C_GCP = ACCENT          # a GCP service / boundary
C_AWS = AMBER           # the AWS equivalent
C_NEUTRAL = INK_SUBTLE  # arrows / neutral structure
C_FOCUS = EMERALD       # the element the narration is naming right now / "good"
C_AVOID = ROSE          # a mistake / anti-pattern


# ─── a service box (titled, optional subtitle) ───────────────────────────────
def service_box(name, sub=None, *, color=C_GCP, w=3.2, h=1.3, fs=26, sub_fs=19,
                fill=0.12):
    """
    A rounded service box: a bold title and an optional muted subtitle, both
    clipped to the box width. Returns a VGroup with:
      .box    — the RoundedRectangle
      .title  — the title Text
      .sub    — the subtitle Text (or None)
    The group is centred on the origin; callers .move_to(...) it.
    """
    box = RoundedRectangle(width=w, height=h, corner_radius=0.14,
                           stroke_color=color, stroke_width=2.6,
                           fill_color=color, fill_opacity=fill)
    title = fit_label(name, w - 0.35, fs, color, weight="BOLD")
    grp = VGroup(box)
    if sub:
        subt = fit_label(sub, w - 0.35, sub_fs, INK_MUTED)
        stack = VGroup(title, subt).arrange(DOWN, buff=0.14).move_to(box.get_center())
        grp.add(title, subt)
        grp.sub = subt
    else:
        title.move_to(box.get_center())
        grp.add(title)
        grp.sub = None
    grp.box = box
    grp.title = title
    grp.color = color
    return grp


# ─── the GCP ≈ AWS mapping pair (the star idiom) ─────────────────────────────
def map_pair(gcp_name, aws_name, *, gcp_sub=None, aws_sub=None, sym="≈",
             w=3.4, h=1.3, gap=1.7, fs=26, sub_fs=19):
    """
    A blue GCP service box on the LEFT and an amber AWS box on the RIGHT, joined
    by a `sym` ("≈" by default) that reads "is the GCP equivalent of". Returns a
    VGroup arranged horizontally with:
      .gcp   — the GCP service_box
      .aws   — the AWS service_box
      .sym   — the connector Text
    Centred on the origin; caller positions it.
    """
    gcp = service_box(gcp_name, gcp_sub, color=C_GCP, w=w, h=h, fs=fs, sub_fs=sub_fs)
    aws = service_box(aws_name, aws_sub, color=C_AWS, w=w, h=h, fs=fs, sub_fs=sub_fs)
    connector = Text(sym, font_size=40, color=INK_MUTED)
    row = VGroup(gcp, connector, aws).arrange(RIGHT, buff=gap / 2)
    row.gcp = gcp
    row.aws = aws
    row.sym = connector
    return row


# ─── a titled vertical column of chips (GCP vs AWS side-by-side lists) ────────
def column(title, items, *, color=C_GCP, chip_w=3.6, chip_h=0.86, fs=22,
           title_fs=26, buff=0.26):
    """
    A titled vertical stack: a bold coloured header over `items` chips. Use two
    columns side by side to show a GCP list beside an AWS list. Returns a VGroup
    with:
      .header — the title Text
      .chips  — list of the item chips (index-aligned to `items`)
    """
    header = Text(title, font_size=title_fs, color=color, weight="BOLD")
    chips = [chip(it, color=color, w=chip_w, h=chip_h, fs=fs) for it in items]
    stack = VGroup(header, *chips).arrange(DOWN, buff=buff)
    stack.header = header
    stack.chips = chips
    return stack


# ─── the resource hierarchy ladder (Org → Folder → Project → Resource) ───────
def hierarchy(levels=None, *, w0=6.4, wstep=1.1, h=1.0, vbuff=0.34, fs=24):
    """
    The nested GCP hierarchy as a stack of progressively NARROWER boxes, top to
    bottom — Organization (widest) → Folder → Project → Resource (narrowest) —
    so the "everything nests inside a project" containment reads visually. Each
    level is labelled; adjacent levels are joined by a short down-arrow.

    `levels` is a list of (label, color) tuples; defaults to the canonical four.
    Returns a VGroup with:
      .boxes   — list of the level VGroups (each has .box and .title)
      .arrows  — list of the connecting down-arrows (len = len(levels) - 1)
      .level(i) — the i-th level VGroup
    Centred on the origin; caller positions it.
    """
    if levels is None:
        levels = [
            ("Organization", C_GCP),
            ("Folder", ACCENT_LIGHT),
            ("Project", EMERALD),
            ("Resource", AMBER),
        ]
    boxes = []
    for i, (label, color) in enumerate(levels):
        wi = max(w0 - i * wstep, 2.2)
        b = service_box(label, color=color, w=wi, h=h, fs=fs, fill=0.10)
        boxes.append(b)
    stack = VGroup(*boxes).arrange(DOWN, buff=vbuff)
    arrows = []
    for i in range(len(boxes) - 1):
        a = Arrow(boxes[i].box.get_bottom(), boxes[i + 1].box.get_top(),
                  buff=0.06, color=C_NEUTRAL, stroke_width=3.0,
                  max_tip_length_to_length_ratio=0.35)
        arrows.append(a)
    grp = VGroup(stack, *arrows)
    grp.boxes = boxes
    grp.arrows = arrows
    grp.level = lambda i: boxes[i]
    return grp


# ─── an IAM binding: principal + role + resource → a grant ───────────────────
def iam_binding(principal, role, resource, *, w=3.4, h=1.05, fs=22, gap=0.5):
    """
    The three parts of a GCP IAM binding as coloured chips joined by "+", the
    who/what/where the narration names:
      principal (blue) + role (emerald) + resource (amber)
    Returns a VGroup with:
      .principal, .role, .resource — the three chips
      .plus1, .plus2               — the "+" connectors
    Centred on the origin; caller positions it.
    """
    p = chip(principal, color=C_GCP, w=w, h=h, fs=fs)
    r = chip(role, color=EMERALD, w=w, h=h, fs=fs)
    res = chip(resource, color=C_AWS, w=w, h=h, fs=fs)
    plus1 = Text("+", font_size=34, color=INK_MUTED)
    plus2 = Text("+", font_size=34, color=INK_MUTED)
    row = VGroup(p, plus1, r, plus2, res).arrange(RIGHT, buff=gap / 2)
    row.principal = p
    row.role = r
    row.resource = res
    row.plus1 = plus1
    row.plus2 = plus2
    return row


# ─── a simple labelled arrow between two mobjects ────────────────────────────
def arrow_between(a, b, *, color=C_NEUTRAL, width=3.0, buff=0.12):
    """A straight arrow from the right edge of `a` to the left edge of `b`."""
    return Arrow(a.get_right(), b.get_left(), buff=buff, color=color,
                 stroke_width=width, max_tip_length_to_length_ratio=0.18)
