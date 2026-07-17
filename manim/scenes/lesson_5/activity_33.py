"""
Lesson 5 - Part 1 (activity 33): "The LLM Pipeline: Seven Stages, Seven
Contracts" (153.17s, 6 cues). The pipeline is a contract chain: each stage
produces an artifact the next depends on, and a broken contract lets downstream
stages run on the wrong thing. Plan and Organize produce a corpus; Tokenize maps
text to stable integer IDs; Train produces a checkpoint of weights; Evaluate
gates the ship decision; and the whole thing is an address system for every
future topic.

Cue00 0.0-25.53     each stage hands the next an artifact
Cue01 25.53-51.06   plan then organize into a corpus
Cue02 51.06-76.58   tokenize into stable integer IDs
Cue03 76.58-102.11  train into a checkpoint of weights
Cue04 102.11-127.64 evaluate gates the ship decision
Cue05 127.64-153.17 seven stages, seven contracts
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from bayes import chip, fit_label
from cloud import service_box, arrow_between
from manim import (
    VGroup, Text, Arrow, RoundedRectangle, FadeIn, FadeOut, Write, Indicate,
    Circumscribe, GrowArrow, Create, RIGHT, LEFT, UP, DOWN,
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


# ─── Cue00 : the contract chain ──────────────────────────────────────────────
class Cue00(AvoScene):
    headline = "Each stage hands the next an artifact"
    cue_duration = 25.528

    def construct(self):
        stages = VGroup(
            block("stage", ACCENT, w=2.4, h=1.0, fs=23),
            block("stage", VIOLET, w=2.4, h=1.0, fs=23),
            block("stage", EMERALD, w=2.4, h=1.0, fs=23),
        ).arrange(RIGHT, buff=1.5).move_to([0, 1.4, 0])
        arts = VGroup(
            fit_label("artifact", 1.3, 17, AMBER).move_to([(stages[0].get_center()[0]+stages[1].get_center()[0])/2, 2.05, 0]),
            fit_label("artifact", 1.3, 17, AMBER).move_to([(stages[1].get_center()[0]+stages[2].get_center()[0])/2, 2.05, 0]),
        )
        arr = VGroup(*[Arrow(stages[i].get_right(), stages[i+1].get_left(), color=INK_SUBTLE, buff=0.1, stroke_width=3) for i in range(2)])
        self.play(FadeIn(stages[0]), run_time=1.4)
        self.play(GrowArrow(arr[0]), FadeIn(arts[0]), FadeIn(stages[1]), run_time=1.8)
        self.play(GrowArrow(arr[1]), FadeIn(arts[1]), FadeIn(stages[2]), run_time=1.8)
        wait_until(self, 14.0)
        note = fit_label("break one contract and downstream runs on the wrong thing",
                         12.5, 23, ROSE).move_to([0, -1.2, 0])
        self.play(Write(note), run_time=2.4)
        self.guard(stages, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : plan and organize ───────────────────────────────────────────────
class Cue01(AvoScene):
    headline = "Plan, then organize into a corpus"
    cue_duration = 25.528

    def construct(self):
        plan = service_box("Plan", "task, scale, data mix, eval target", color=ACCENT, w=6.0, h=1.25, fs=24).move_to([0, 1.9, 0])
        self.play(FadeIn(plan), run_time=1.6)
        wait_until(self, 7.0)
        org = service_box("Organize", "clean, deduplicate, filter, mix", color=VIOLET, w=6.0, h=1.25, fs=24).move_to([0, 0.3, 0])
        a1 = Arrow(plan.get_bottom(), org.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(GrowArrow(a1), FadeIn(org), run_time=1.8)
        wait_until(self, 15.0)
        corpus = block("a training corpus", EMERALD, w=5.0, h=0.95, fs=24).move_to([0, -1.3, 0])
        a2 = Arrow(org.get_bottom(), corpus.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(GrowArrow(a2), FadeIn(corpus), run_time=1.8)
        self.guard(plan, org, corpus)
        pace_to(self, self.cue_duration)


# ─── Cue02 : tokenize ────────────────────────────────────────────────────────
class Cue02(AvoScene):
    headline = "Tokenize into stable integer IDs"
    cue_duration = 25.528

    def construct(self):
        corpus = block("training corpus", EMERALD, w=4.6, h=1.0, fs=24).move_to([-3.6, 1.6, 0])
        tok = service_box("tokenizer", "text to integer IDs", color=ACCENT, w=4.6, h=1.2, fs=24).move_to([3.0, 1.6, 0])
        a1 = arrow_between(corpus, tok, color=INK_SUBTLE)
        self.play(FadeIn(corpus), run_time=1.4)
        self.play(GrowArrow(a1), FadeIn(tok), run_time=1.8)
        wait_until(self, 10.0)
        ids = VGroup(*[block(s, VIOLET, w=1.5, h=0.8, fs=22) for s in ["1042", "88", "7", "512"]]).arrange(RIGHT, buff=0.3).move_to([0, -0.2, 0])
        self.play(FadeIn(ids, lag_ratio=0.15), run_time=2.0)
        wait_until(self, 18.0)
        note = fit_label("training and serving must agree on these IDs", 11.0, 23, INK).move_to([0, -1.7, 0])
        self.play(Write(note), Indicate(ids, color=VIOLET), run_time=2.4)
        self.guard(corpus, tok, ids, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : train ───────────────────────────────────────────────────────────
class Cue03(AvoScene):
    headline = "Train into a checkpoint of weights"
    cue_duration = 25.528

    def construct(self):
        tokens = block("token sequences", VIOLET, w=4.6, h=1.0, fs=24).move_to([0, 1.9, 0])
        train = service_box("Train", "adjust weights to predict next token", color=ACCENT, w=7.0, h=1.2, fs=23).move_to([0, 0.3, 0])
        a1 = Arrow(tokens.get_bottom(), train.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(FadeIn(tokens), run_time=1.4)
        self.play(GrowArrow(a1), FadeIn(train), run_time=1.8)
        wait_until(self, 12.0)
        ckpt = block("a checkpoint: learned weights, not a product", AMBER, w=8.4, h=0.95, fs=22).move_to([0, -1.3, 0])
        a2 = Arrow(train.get_bottom(), ckpt.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(GrowArrow(a2), FadeIn(ckpt), run_time=1.8)
        self.play(Circumscribe(ckpt, color=AMBER), run_time=1.8)
        self.guard(tokens, train, ckpt)
        pace_to(self, self.cue_duration)


# ─── Cue04 : evaluate ────────────────────────────────────────────────────────
class Cue04(AvoScene):
    headline = "Evaluate gates the ship decision"
    cue_duration = 25.528

    def construct(self):
        ckpt = block("a checkpoint", AMBER, w=4.0, h=1.0, fs=24).move_to([0, 1.9, 0])
        gate = service_box("Evaluate", "good enough, safe, better than alternatives", color=ROSE, w=8.0, h=1.2, fs=22).move_to([0, 0.4, 0])
        a1 = Arrow(ckpt.get_bottom(), gate.get_top(), color=INK_SUBTLE, buff=0.12, stroke_width=3)
        self.play(FadeIn(ckpt), run_time=1.4)
        self.play(GrowArrow(a1), FadeIn(gate), run_time=1.8)
        wait_until(self, 12.0)
        verdict = VGroup(
            block("ship", EMERALD, w=3.0, h=0.9, fs=24),
            block("hold", ROSE, w=3.0, h=0.9, fs=24),
        ).arrange(RIGHT, buff=1.2).move_to([0, -1.3, 0])
        self.play(FadeIn(verdict), run_time=1.8)
        self.play(Circumscribe(verdict[0], color=EMERALD), run_time=1.8)
        self.guard(ckpt, gate, verdict)
        pace_to(self, self.cue_duration)


# ─── Cue05 : seven contracts ─────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Seven stages, seven contracts"
    cue_duration = 25.528

    def construct(self):
        names = ["Plan", "Organize", "Tokenize", "Architect", "Train", "Evaluate", "Ship"]
        colors = [ACCENT, VIOLET, EMERALD, AMBER, ACCENT, ROSE, EMERALD]
        row = VGroup(*[block(n, c, w=1.7, h=0.85, fs=19) for n, c in zip(names, colors)]).arrange(RIGHT, buff=0.22).move_to([0, 1.3, 0])
        arr = VGroup(*[Arrow(row[i].get_right(), row[i+1].get_left(), color=INK_SUBTLE, buff=0.06, stroke_width=2.2) for i in range(6)])
        self.play(FadeIn(row[0]), run_time=1.0)
        for i in range(6):
            self.play(GrowArrow(arr[i]), FadeIn(row[i+1]), run_time=0.9)
        wait_until(self, 14.0)
        note = fit_label("an address system: every future topic lands on one stage",
                         12.5, 23, INK).move_to([0, -1.2, 0])
        self.play(Write(note), run_time=2.4)
        self.guard(row, note)
        pace_to(self, self.cue_duration)
