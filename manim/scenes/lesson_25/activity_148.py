"""
Lesson 25 — Part 2 (activity 148): "Rate Limiting — the token bucket and the
burst trade-off" (132.2s, 6 cues).

The concrete rate-limiter walkthrough behind the orientation's "store a count
and a timestamp; refill on demand." A token bucket holds up to `capacity`
tokens and refills at a steady rate; each request spends one, so bursts up to
capacity are allowed and then throttled to the drip rate. The contrast is the
sliding-window counter, which forbids bursts by counting recent timestamps.

Uses sysdesign.py (token_bucket, request_mark, timeline, tick) — the bucket /
timeline vocabulary. MathTex is reserved for the lazy-refill rule and the O(1)
complexity bound.

Cue00 0-24     the bucket holds a capacity of tokens, refills at a steady rate
Cue01 24-49.7  three requests spend three tokens; allowed while tokens remain
Cue02 49.7-76.1 a burst drains to zero; once empty, further requests rejected
Cue03 76.1-102.6 lazy refill: elapsed × rate, capped at capacity, no timer
Cue04 102.6-120.2 sliding-window counter forbids bursts: count recent, allow under limit
Cue05 120.2-132.2 pick the tool: token bucket for bursts, sliding window when forbidden
"""

import theme
from theme import (
    AvoScene, ACCENT, ACCENT_LIGHT, AMBER, EMERALD, ROSE, VIOLET, INK,
    INK_MUTED, INK_SUBTLE,
)
from pacing import pace_to, elapsed
from sysdesign import (
    token_bucket, request_mark, timeline, tick, C_ALLOW, C_REJECT,
)
from arrays import complexity
from bayes import fit_label, chip
from manim import (
    VGroup, Text, MathTex, Arrow, Line, Dot, RoundedRectangle, FadeIn, FadeOut,
    Write, Transform, Indicate, Circumscribe, GrowFromCenter, GrowArrow, Create,
    RIGHT, LEFT, UP, DOWN,
)

BUCKET_X = -3.7


def wait_until(scene, t: float) -> None:
    dt = t - elapsed(scene)
    if dt > 1.0 / 60.0:
        scene.wait(dt)


# ─── Cue00 : the bucket, capacity + steady refill ────────────────────────────
class Cue00(AvoScene):
    headline = "A bucket holds capacity tokens, refills steadily"
    cue_duration = 24.0

    def construct(self):
        bkt = token_bucket(5, 5, label="tokens").move_to([BUCKET_X, -0.1, 0])
        self.play(FadeIn(bkt.box), run_time=1.0)
        self.play(*[GrowFromCenter(d) for d in bkt.tokens], run_time=1.8)
        wait_until(self, 5.0)

        cap = chip("capacity = 5", color=ACCENT, w=4.4, h=0.9, fs=26).move_to([2.4, 1.7, 0])
        refill = chip("refill = 1 token / sec", color=EMERALD, w=5.4, h=0.9, fs=26).move_to([2.8, 0.4, 0])
        spend = chip("each request spends 1", color=AMBER, w=5.4, h=0.9, fs=26).move_to([2.8, -0.9, 0])
        self.play(FadeIn(cap), run_time=1.0)
        wait_until(self, 11.0)
        self.play(FadeIn(refill), run_time=1.0)
        wait_until(self, 16.0)
        self.play(FadeIn(spend), run_time=1.0)
        note = fit_label("the bucket is the only state: a count of tokens plus a timestamp",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.1)
        self.guard(bkt.box, cap, refill, spend, note)
        pace_to(self, self.cue_duration)


# ─── Cue01 : three requests spend three tokens ───────────────────────────────
class Cue01(AvoScene):
    headline = "Three requests spend three tokens"
    cue_duration = 25.7

    def construct(self):
        bkt = token_bucket(5, 5, label="tokens").move_to([BUCKET_X, -0.1, 0])
        self.add(bkt.box, *bkt.tokens, bkt.caption)
        wait_until(self, 1.5)

        count = chip("tokens = 5", color=EMERALD, w=4.2, h=0.9, fs=28).move_to([3.2, 2.0, 0])
        self.play(FadeIn(count), run_time=1.0)

        reqs = [request_mark("req 1"), request_mark("req 2"), request_mark("req 3")]
        for r in reqs:
            r.scale(1.0)
        VGroup(*reqs).arrange(DOWN, buff=0.5).move_to([3.2, 0.0, 0])

        remaining = 5
        times = [5.5, 10.5, 15.5]
        for i, r in enumerate(reqs):
            wait_until(self, times[i])
            remaining -= 1
            bkt.set_filled(remaining)
            self.play(FadeIn(r, shift=LEFT * 0.3),
                      Indicate(bkt.tokens[remaining], color=C_REJECT if False else AMBER),
                      run_time=1.2)
            self.play(Transform(count, chip(f"tokens = {remaining}", color=EMERALD,
                                            w=4.2, h=0.9, fs=28).move_to([3.2, 2.0, 0])),
                      run_time=0.7)

        note = fit_label("all three are allowed — the bucket still had tokens to spend",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.1)
        self.guard(bkt.box, count, *reqs, note)
        pace_to(self, self.cue_duration)


# ─── Cue02 : a burst empties the bucket → rejects ────────────────────────────
class Cue02(AvoScene):
    headline = "A burst drains it to zero, then rejects"
    cue_duration = 26.4

    def construct(self):
        bkt = token_bucket(5, 5, label="tokens").move_to([BUCKET_X, -0.1, 0])
        self.add(bkt.box, *bkt.tokens, bkt.caption)
        wait_until(self, 1.5)

        count = chip("tokens = 5", color=EMERALD, w=4.2, h=0.9, fs=28).move_to([3.2, 2.2, 0])
        self.play(FadeIn(count), run_time=0.9)

        # a burst of 5 requests drains it
        self.play(Indicate(VGroup(*bkt.tokens), color=AMBER), run_time=1.2)
        bkt.set_filled(0)
        burst = chip("burst of 5 → all allowed", color=AMBER, w=6.0, h=0.9, fs=25).move_to([3.2, 0.9, 0])
        self.play(FadeOut(VGroup(*bkt.tokens)),
                  Transform(count, chip("tokens = 0", color=ROSE, w=4.2, h=0.9, fs=28).move_to([3.2, 2.2, 0])),
                  FadeIn(burst), run_time=1.6)
        wait_until(self, 10.0)

        # further requests are rejected
        rej = VGroup(request_mark("req 6", allowed=False),
                     request_mark("req 7", allowed=False)).arrange(RIGHT, buff=0.5).move_to([3.2, -0.5, 0])
        self.play(FadeIn(rej, shift=UP * 0.2), run_time=1.4)
        empty_lab = Text("empty!", font_size=26, color=ROSE, weight="BOLD").next_to(bkt.box, UP, buff=0.5)
        self.play(FadeIn(empty_lab), Indicate(bkt.box, color=ROSE), run_time=1.2)
        wait_until(self, 18.0)

        note = fit_label("once the bucket is empty, requests are rejected until it refills",
                         12.6, 22, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.1)
        self.guard(bkt.box, count, burst, rej, empty_lab, note)
        pace_to(self, self.cue_duration)


# ─── Cue03 : lazy refill — elapsed × rate, capped ────────────────────────────
class Cue03(AvoScene):
    headline = "Lazy refill: elapsed × rate, capped at capacity"
    cue_duration = 26.5

    def construct(self):
        bkt = token_bucket(5, 1, label="tokens").move_to([BUCKET_X, -0.1, 0])
        self.add(bkt.box, *bkt.tokens, bkt.caption)
        wait_until(self, 1.2)

        # the refill rule
        rule = MathTex(r"\text{tokens} = \min(\text{cap},\ \text{tokens} + \Delta t \times \text{rate})",
                       color=INK).scale(0.78).move_to([2.6, 2.2, 0])
        self.play(Write(rule), run_time=1.6)
        wait_until(self, 5.0)

        # 3 seconds pass with no request → nothing happens (no timer)
        elapsed_lab = chip("3 sec elapsed, no request", color=INK_MUTED, w=6.0, h=0.85, fs=24).move_to([2.6, 1.1, 0])
        self.play(FadeIn(elapsed_lab), run_time=1.0)
        wait_until(self, 10.0)

        # next request arrives → compute refill: 1 + 3*1 = 4, capped at 5
        calc = MathTex(r"1 + 3 \times 1 = 4", color=EMERALD).scale(0.8).move_to([2.6, -0.1, 0])
        self.play(Write(calc), run_time=1.2)
        bkt.set_filled(4)
        self.play(*[GrowFromCenter(bkt.tokens[i]) for i in range(1, 4)], run_time=1.4)
        wait_until(self, 16.5)

        no_timer = chip("no background timer — computed on read", color=AMBER, w=7.6, h=0.85, fs=23).move_to([2.6, -1.3, 0])
        self.play(FadeIn(no_timer), run_time=1.0)
        note = fit_label("refill is computed lazily from the stored timestamp when a request arrives",
                         12.8, 21, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.1)
        self.guard(bkt.box, rule, elapsed_lab, calc, no_timer, note)
        pace_to(self, self.cue_duration)


# ─── Cue04 : sliding-window counter forbids bursts ───────────────────────────
class Cue04(AvoScene):
    headline = "Sliding window: count recent, allow under the limit"
    cue_duration = 17.6

    def construct(self):
        tl = timeline(length=9.0, y=0.2).move_to([0, 0.2, 0])
        self.play(Create(tl.line), FadeIn(tl[1]), run_time=1.2)

        # request ticks; the recent window will enclose the last three
        fracs = [0.18, 0.32, 0.52, 0.68, 0.82]
        ticks = VGroup(*[tick(tl.at(f), color=AMBER) for f in fracs])
        self.play(Create(ticks), run_time=1.4)
        wait_until(self, 4.0)

        # the sliding window spans the last stretch of time (encloses 3 ticks)
        win_lo, win_hi = tl.at(0.44)[0], tl.at(0.9)[0]
        win = RoundedRectangle(width=(win_hi - win_lo), height=1.0, corner_radius=0.12,
                               stroke_color=ACCENT, stroke_width=3.0,
                               fill_color=ACCENT, fill_opacity=0.10)
        win.move_to([(win_lo + win_hi) / 2, 0.2, 0])
        wlab = Text("window: last 60s", font_size=22, color=ACCENT).next_to(win, UP, buff=0.3)
        self.play(Create(win), FadeIn(wlab), run_time=1.4)
        wait_until(self, 9.0)

        cnt = chip("count = 3 ≤ limit 4 → allow", color=EMERALD, w=7.2, h=0.9, fs=24).move_to([0, -1.4, 0])
        self.play(FadeIn(cnt), run_time=1.2)
        note = fit_label("no bursts: it counts timestamps in the window and blocks over the limit",
                         12.8, 21, INK_MUTED).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(note), run_time=1.1)
        self.guard(tl, ticks, win, wlab, cnt, note)
        pace_to(self, self.cue_duration)


# ─── Cue05 : pick the tool ───────────────────────────────────────────────────
class Cue05(AvoScene):
    headline = "Pick the tool: bursts vs smoothness"
    cue_duration = 12.0

    def construct(self):
        left = VGroup(
            Text("token bucket", font_size=30, color=EMERALD, weight="BOLD"),
            fit_label("friendly bursts up to capacity, an average rate over time", 5.6, 20, INK_MUTED),
        ).arrange(DOWN, buff=0.3).move_to([-3.4, 0.9, 0])
        right = VGroup(
            Text("sliding window", font_size=30, color=ACCENT, weight="BOLD"),
            fit_label("strict: no bursts allowed, a rolling count under the limit", 5.6, 20, INK_MUTED),
        ).arrange(DOWN, buff=0.3).move_to([3.4, 0.9, 0])
        divider = Line([0, 2.0, 0], [0, -0.6, 0], color=INK_SUBTLE, stroke_width=2.0)
        self.play(FadeIn(left, shift=RIGHT * 0.2), run_time=1.2)
        self.play(Create(divider), run_time=0.6)
        self.play(FadeIn(right, shift=LEFT * 0.2), run_time=1.2)
        wait_until(self, 6.0)

        bound = complexity(r"O(1)\ \text{time},\ O(1)\ \text{state per client}", color=INK, fs=34)
        bound.move_to([0, -1.7, 0])
        self.play(Write(bound), run_time=1.4)
        self.guard(left, right, divider, bound)
        pace_to(self, self.cue_duration)
