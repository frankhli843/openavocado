"""
Pacing helpers — pin each chunk scene's length to its cue window.

The whole highlight-sync design rests on this: every chunk is authored for one
cue whose duration is `cue.end - cue.start` (seconds, against the real MP3). If
each chunk video is exactly that long, concatenating chunks in cue order yields
a segment video whose visuals line up with the narration with no runtime sync.

`pace_to(scene, cue_duration)` plays a trailing `self.wait(...)` so the scene's
total time equals `cue_duration`. It reads Manim's accumulated scene time
(`scene.renderer.time`) to know how much has already elapsed from animations.
The render script independently ffprobe-verifies the emitted file and pads/fails
on drift, so this is the primary mechanism with a hard backstop downstream.
"""

from __future__ import annotations

from manim import Scene

# Manim renders discrete frames; allow the wait to be at least one frame so a
# zero-length tail does not produce a truncated final frame.
_MIN_WAIT = 1.0 / 30.0


def elapsed(scene: Scene) -> float:
    """Seconds of scene time consumed so far (animations + prior waits)."""
    t = getattr(getattr(scene, "renderer", None), "time", None)
    if t is None:
        # Older/newer Manim fallback: some versions expose Scene.time.
        t = getattr(scene, "time", 0.0)
    return float(t or 0.0)


def pace_to(scene: Scene, cue_duration: float) -> float:
    """
    Wait so the scene's total length equals `cue_duration` seconds.

    Returns the number of seconds waited (>= _MIN_WAIT). If the animations
    already overran the cue window, still waits one frame and lets the render
    script's ffprobe assert catch the (rare) long-chunk case — authors should
    keep animation run_times comfortably under the cue duration.
    """
    if cue_duration is None or cue_duration <= 0:
        scene.wait(_MIN_WAIT)
        return _MIN_WAIT
    remaining = cue_duration - elapsed(scene)
    wait_for = max(remaining, _MIN_WAIT)
    scene.wait(wait_for)
    return wait_for


def budget(cue_duration: float, reserve: float = 0.0) -> float:
    """
    How much animation time a chunk may spend before it must settle, leaving
    `reserve` seconds of hold at the end. Handy for authors sizing run_times:
        t = budget(cue_dur, reserve=1.5)  # spend <= t animating, hold 1.5s
    """
    if cue_duration is None:
        return 0.0
    return max(cue_duration - reserve, _MIN_WAIT)
