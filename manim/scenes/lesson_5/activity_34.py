"""
Lesson 5 - Part 2 (activity 34): "Data and Tokenization: The First Contract"
(249.96s, 8 cues). A tokenizer is a contract, not a preprocessing step: the
integer ID for a fragment must stay identical from training through inference.
It bridges text to numbers; a tiny vocabulary produces a high UNK rate, LLaMA's
thirty two thousand tokens drops it, and Gemma 4's two hundred sixty two
thousand pushes it near zero. BPE merges common pairs into subwords, ID N always
maps to the same subword, and swapping the tokenizer breaks the contract.

Cue00 0.0-31.24      the token ID must never move
Cue01 31.24-62.49    text becomes numbers
Cue02 62.49-93.74    a tiny vocabulary, a high UNK rate
Cue03 93.74-124.98   LLaMA size, UNK drops away
Cue04 124.98-156.23  Gemma 4, UNK near zero
Cue05 156.23-187.47  merge common pairs into subwords
Cue06 187.47-218.72  ID N always the same subword
Cue07 218.72-249.96  a new tokenizer reads a new language
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from bayes import chip, fit_label
from cloud import service_box, arrow_between
from leaderboard import meter, meter_fill
from manim import (
    VGroup, Text, Arrow, DoubleArrow, RoundedRectangle, FadeIn, FadeOut, Write,
    Transform, Indicate, Circumscribe, GrowArrow, Create, RIGHT, LEFT, UP, DOWN,
)


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


def block(label, color, w=2.4, h=0.9, fs=23, fill=0.16):
    b = RoundedRectangle(width=w, height=h, corner_radius=0.12, stroke_color=color,
                         stroke_width=2.4, fill_color=color, fill_opacity=fill)
    t = fit_label(label, w - 0.28, fs, INK).move_to(b.get_center())
    return VGroup(b, t)


def vocab_scene(scene, size_label, unk_frac, unk_color, note_text):
    """Shared beat: a vocabulary-size chip and a UNK-rate meter."""
    vs = block(f"vocab size: {size_label}", ACCENT, w=6.4, h=1.0, fs=24).move_to([0, 1.9, 0])
    scene.play(FadeIn(vs), run_time=1.6)
    wait_until(scene, 9.0)
    m = meter(unk_frac, w=8.4, h=0.8, color=unk_color, title="UNK rate", fs=22).move_to([0, 0.1, 0])
    scene.play(FadeIn(m), run_time=1.8)
    scene.play(Indicate(m.fill, color=unk_color), run_time=1.6)
    wait_until(scene, 22.0)
    note = fit_label(note_text, 12.5, 23, INK).move_to([0, -1.6, 0])
    scene.play(Write(note), run_time=2.4)
    scene.guard(vs, m, note)


# ─── Cue00 : the contract ────────────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "The token ID must never move"
    cue_duration = 31.245

    def construct(self):
        frag = block("text fragment", ACCENT, w=4.4, h=1.0, fs=24).move_to([0, 1.9, 0])
        idbox = block("integer ID 4271", VIOLET, w=4.4, h=1.0, fs=24).move_to([0, 0.3, 0])
        a1 = Arrow(frag.get_bottom(), idbox.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(FadeIn(frag), run_time=1.4)
        self.play(GrowArrow(a1), FadeIn(idbox), run_time=1.8)
        wait_until(self, 13.0)
        pair = VGroup(
            block("training", EMERALD, w=3.4, h=0.9, fs=23),
            block("inference", EMERALD, w=3.4, h=0.9, fs=23),
        ).arrange(RIGHT, buff=0.5).move_to([0, -1.2, 0])
        eq = Text("=", font_size=34, color=AMBER, weight="BOLD").move_to([0, -1.2, 0])
        self.play(FadeIn(pair), run_time=1.6)
        wait_until(self, 22.0)
        self.play(FadeIn(eq), Indicate(pair, color=EMERALD), run_time=2.0)
        self.guard(frag, idbox, pair)
        pace_to(self, self.cue_duration)


# ─── Cue01 : the bridge ──────────────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Text becomes numbers"
    cue_duration = 31.245

    def construct(self):
        text = block('"tokeni" "zation"', ACCENT, w=5.0, h=1.1, fs=24).move_to([-3.4, 1.4, 0])
        nums = block("[ 15043, 2065 ]", VIOLET, w=5.0, h=1.1, fs=24).move_to([3.4, 1.4, 0])
        a1 = arrow_between(text, nums, color=INK_SUBTLE)
        self.play(FadeIn(text), run_time=1.6)
        wait_until(self, 8.0)
        self.play(GrowArrow(a1), FadeIn(nums), run_time=1.8)
        wait_until(self, 18.0)
        note = fit_label("the whole corpus is converted to integer sequences before training",
                         13.0, 23, INK).move_to([0, -1.2, 0])
        self.play(Write(note), run_time=2.6)
        self.guard(text, nums, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : vocab 1000 ──────────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "A tiny vocabulary, a high UNK rate"
    cue_duration = 31.245

    def construct(self):
        vocab_scene(self, "1,000", 0.72, ROSE,
                    "most subwords are missing, so real text collapses into UNK")
        pace_to(self, self.cue_duration)


# ─── Cue03 : vocab 32000 ─────────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "LLaMA size, UNK drops away"
    cue_duration = 31.245

    def construct(self):
        vocab_scene(self, "32,000  (LLaMA)", 0.08, AMBER,
                    "most English is representable at about three to four characters per token")
        pace_to(self, self.cue_duration)


# ─── Cue04 : vocab 262144 ────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Gemma 4, UNK near zero"
    cue_duration = 31.245

    def construct(self):
        vocab_scene(self, "262,144  (Gemma 4)", 0.01, EMERALD,
                    "tokens get longer and UNK approaches zero even for technical text")
        pace_to(self, self.cue_duration)


# ─── Cue05 : BPE ─────────────────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Merge common pairs into subwords"
    cue_duration = 31.245

    def construct(self):
        chars = block("characters: t o k e n", ACCENT, w=5.6, h=1.0, fs=23).move_to([0, 1.9, 0])
        self.play(FadeIn(chars), run_time=1.6)
        wait_until(self, 9.0)
        merge = block("merge the most common adjacent pair", AMBER, w=7.6, h=1.0, fs=23).move_to([0, 0.3, 0])
        a1 = Arrow(chars.get_bottom(), merge.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(GrowArrow(a1), FadeIn(merge), run_time=1.8)
        wait_until(self, 19.0)
        sub = block('subwords: "token"', EMERALD, w=5.2, h=1.0, fs=24).move_to([0, -1.3, 0])
        a2 = Arrow(merge.get_bottom(), sub.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(GrowArrow(a2), FadeIn(sub), run_time=1.8)
        self.play(Indicate(sub, color=EMERALD), run_time=1.6)
        self.guard(chars, merge, sub)
        pace_to(self, self.cue_duration)


# ─── Cue06 : the shared contract ─────────────────────────────────────────────
class Cue06(AvoScene):
    headline = "ID N always the same subword"
    cue_duration = 31.245

    def construct(self):
        rows = VGroup(
            block('4271  ->  "token"', ACCENT, w=5.2, h=0.85, fs=23),
            block('2065  ->  "ization"', VIOLET, w=5.2, h=0.85, fs=23),
            block('15043 ->  "tokeni"', EMERALD, w=5.2, h=0.85, fs=23),
        ).arrange(DOWN, buff=0.35).move_to([0, 0.9, 0])
        for r in rows:
            self.play(FadeIn(r), run_time=1.2)
        wait_until(self, 16.0)
        note = fit_label("the same mapping from training through all inference",
                         11.5, 23, INK).move_to([0, -1.6, 0])
        self.play(Write(note), Indicate(rows, color=ACCENT), run_time=2.6)
        self.guard(rows, note)
        pace_to(self, self.cue_duration)


# ─── Cue07 : swapping breaks it ──────────────────────────────────────────────
class Cue07(AvoScene):
    headline = "A new tokenizer reads a new language"
    cue_duration = 31.245

    def construct(self):
        old = block("trained IDs", EMERALD, w=4.4, h=1.0, fs=24).move_to([-3.4, 1.6, 0])
        new = block("swapped tokenizer", ROSE, w=4.8, h=1.0, fs=23).move_to([3.2, 1.6, 0])
        clash = DoubleArrow(old.get_right(), new.get_left(), color=ROSE, buff=0.2, stroke_width=4)
        self.play(FadeIn(old), run_time=1.4)
        self.play(FadeIn(new), run_time=1.4)
        wait_until(self, 10.0)
        self.play(GrowArrow(clash), run_time=1.8)
        wait_until(self, 18.0)
        broke = block("the IDs shift: a broken contract", ROSE, w=7.2, h=1.0, fs=23).move_to([0, -1.2, 0])
        self.play(FadeIn(broke), Circumscribe(broke, color=ROSE), run_time=2.4)
        self.guard(old, new, broke)
        pace_to(self, self.cue_duration)
