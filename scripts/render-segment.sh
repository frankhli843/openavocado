#!/usr/bin/env bash
#
# render-segment.sh <lesson_id> <activity_id> --quality ql|final [--cue N] [--resume]
#
# Renders one audio segment as per-cue Manim chunks, concatenates them in cue
# order, muxes the segment MP3, and extracts review frames — the reusable
# pipeline the acceptance calls for. Highlight sync is baked in: each chunk is
# ffprobe-pinned to its cue window (pad clone-last-frame if short <=0.25s, FAIL
# if long >0.25s), so the concatenated video lines up with the narration.
#
# Scene convention: manim/scenes/lesson_<id>/activity_<activity>.py defines one
# Scene subclass per cue named Cue00, Cue01, ... Each subclasses AvoScene, sets
# `cue_duration`, and ends construct() with pace_to(self, self.cue_duration).
#
# Outputs (under the runtime_artifacts root via AVOCADOCORE_RUNTIME_ROOT):
#   runtime_artifacts/videos/lesson_<id>/activity_<activity>.mp4        (final, muxed)
#   runtime_artifacts/videos/lesson_<id>/activity_<activity>.poster.png (poster)
#   manim/review/lesson_<id>/<activity>/cueNN_{start,mid,end}.png       (review frames)
#
# All renders are niced and single-chunk-serial (shared box). Requires the
# .venv-manim python, ffmpeg, ffprobe. Run with node not required.
set -euo pipefail

LESSON="${1:?usage: render-segment.sh <lesson_id> <activity_id> --quality ql|final [--cue N] [--resume]}"
ACTIVITY="${2:?missing activity_id}"
shift 2

QUALITY="ql"
ONLY_CUE=""
RESUME=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --quality) QUALITY="$2"; shift 2 ;;
    --cue) ONLY_CUE="$2"; shift 2 ;;
    --resume) RESUME=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ "$QUALITY" == "ql" || "$QUALITY" == "final" ]] || { echo "quality must be ql|final" >&2; exit 2; }

# ─── paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
LIVE_DEFAULT="/home/frank/.openclaw/workspace/code/avocadocore"
RUNTIME_ROOT="${AVOCADOCORE_RUNTIME_ROOT:-$LIVE_DEFAULT/runtime_artifacts}"
VENV_PY="$REPO/.venv-manim/bin/python"
[[ -x "$VENV_PY" ]] || VENV_PY="$LIVE_DEFAULT/.venv-manim/bin/python"
[[ -x "$VENV_PY" ]] || { echo "manim venv python not found ($VENV_PY)" >&2; exit 1; }

STORYBOARD="$REPO/manim/storyboards/lesson_${LESSON}/segment_${ACTIVITY}.json"
SCENE_MODULE="$REPO/manim/scenes/lesson_${LESSON}/activity_${ACTIVITY}.py"
[[ -f "$STORYBOARD" ]] || { echo "storyboard missing: $STORYBOARD (run export-storyboard)" >&2; exit 1; }
[[ -f "$SCENE_MODULE" ]] || { echo "scene module missing: $SCENE_MODULE (author the chunk scenes first)" >&2; exit 1; }

WORK="$REPO/manim/media/lesson_${LESSON}/activity_${ACTIVITY}/${QUALITY}"
CHUNKS="$WORK/chunks"
REVIEW_DIR="$REPO/manim/review/lesson_${LESSON}/${ACTIVITY}"
OUT_DIR="$RUNTIME_ROOT/videos/lesson_${LESSON}"
mkdir -p "$WORK" "$CHUNKS" "$REVIEW_DIR" "$OUT_DIR"

# ─── storyboard fields via python (always available) ─────────────────────────
read_json() { "$VENV_PY" -c "import json,sys;d=json.load(open('$STORYBOARD'));print($1)"; }
NUM_CUES="$(read_json 'len(d["cues"])')"
AUDIO_REL="$(read_json 'd["audio"]["file_path"] or ""')"
AUDIO_DUR="$(read_json 'd["audio"]["duration_sec"] or 0')"
AUDIO_ABS="$RUNTIME_ROOT/${AUDIO_REL#runtime_artifacts/}"

# quality → resolution/fps
if [[ "$QUALITY" == "ql" ]]; then RES="854,480"; FPS="15"; else RES="1920,1080"; FPS="30"; fi

echo "── render-segment lesson ${LESSON} activity ${ACTIVITY} [${QUALITY} ${RES}@${FPS}] : ${NUM_CUES} cues, audio ${AUDIO_DUR}s ──"

# ─── per-chunk render + pin to cue duration ──────────────────────────────────
render_chunk() {
  local i="$1"
  local ii; ii="$(printf '%02d' "$i")"
  local cue_dur; cue_dur="$(read_json "round(d['cues'][$i]['end']-d['cues'][$i]['start'],3)")"
  local raw="$CHUNKS/cue${ii}_raw.mp4"
  local pinned="$CHUNKS/cue${ii}.mp4"

  if [[ "$RESUME" == "1" && -f "$pinned" ]]; then
    echo "  cue ${ii}: resume (exists)"; return 0
  fi

  echo "  cue ${ii}: render Cue${ii} (target ${cue_dur}s)"
  # PYTHONPATH points at the manim/ dir (flat modules: theme, pacing, scene imports).
  PYTHONPATH="$REPO/manim" nice -n 10 "$VENV_PY" -m manim render \
    --resolution "$RES" --fps "$FPS" --format mp4 \
    --media_dir "$WORK/manim_out" -o "cue${ii}_raw" \
    "$SCENE_MODULE" "Cue${ii}" >/dev/null 2>"$WORK/cue${ii}.log" || {
      echo "  cue ${ii}: RENDER FAILED — see $WORK/cue${ii}.log" >&2
      tail -12 "$WORK/cue${ii}.log" >&2; exit 1; }

  # Manim writes to media_dir/videos/<module>/<res>/<name>.mp4 — locate it.
  local produced
  produced="$(find "$WORK/manim_out/videos" -name "cue${ii}_raw.mp4" | head -1)"
  [[ -f "$produced" ]] || { echo "  cue ${ii}: produced mp4 not found" >&2; exit 1; }
  cp "$produced" "$raw"

  # ffprobe actual vs target; pad or fail.
  local actual; actual="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$raw")"
  local diff; diff="$("$VENV_PY" -c "print(round($actual-$cue_dur,3))")"
  local absdiff; absdiff="$("$VENV_PY" -c "print(round(abs($actual-$cue_dur),3))")"
  local short; short="$("$VENV_PY" -c "print(1 if $actual < $cue_dur else 0)")"
  local within_frame; within_frame="$(echo "$absdiff <= 0.05" | bc -l)"
  local pad_ok; pad_ok="$(echo "$absdiff <= 0.25" | bc -l)"
  local too_long; too_long="$(echo "$absdiff > 0.25" | bc -l)"

  if [[ "$within_frame" == "1" ]]; then
    cp "$raw" "$pinned"
    echo "  cue ${ii}: ok (${actual}s, Δ${diff}s)"
  elif [[ "$short" == "1" && "$pad_ok" == "1" ]]; then
    # short by <=0.25s → pad by cloning the last frame (tpad).
    ffmpeg -y -v error -i "$raw" -vf "tpad=stop_mode=clone:stop_duration=${absdiff}" \
      -r "$FPS" -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 "$pinned"
    echo "  cue ${ii}: padded +${absdiff}s (was ${actual}s → ${cue_dur}s)"
  elif [[ "$short" == "0" && "$pad_ok" == "1" ]]; then
    # long by <=0.25s → trim to the cue boundary. This usually comes from frame
    # quantization, not author error.
    ffmpeg -y -v error -i "$raw" -t "$cue_dur" -r "$FPS" -c:v libx264 -pix_fmt yuv420p \
      -preset medium -crf 18 "$pinned"
    echo "  cue ${ii}: trimmed -${absdiff}s (was ${actual}s → ${cue_dur}s)"
  elif [[ "$short" == "0" && "$too_long" == "1" ]]; then
    echo "  cue ${ii}: TOO LONG by ${diff}s (>0.25s) — reduce animation run_times in Cue${ii}" >&2
    exit 1
  else
    # short by >0.25s → author should extend the scene; fail loudly.
    echo "  cue ${ii}: OFF by ${diff}s (>0.25s) — adjust Cue${ii} pacing/run_times" >&2
    exit 1
  fi
}

if [[ -n "$ONLY_CUE" ]]; then
  render_chunk "$ONLY_CUE"
  echo "single-cue render done (cue $ONLY_CUE). Re-run without --cue to concat+mux."
  exit 0
fi

for ((i=0; i<NUM_CUES; i++)); do render_chunk "$i"; done

# ─── normalize + concat (uniform codec so -c copy is safe) ───────────────────
echo "── concatenating ${NUM_CUES} chunks ──"
NORM="$WORK/norm"; mkdir -p "$NORM"
: > "$WORK/concat.txt"
for ((i=0; i<NUM_CUES; i++)); do
  ii="$(printf '%02d' "$i")"
  n="$NORM/cue${ii}.mp4"
  ffmpeg -y -v error -i "$CHUNKS/cue${ii}.mp4" -r "$FPS" -c:v libx264 -pix_fmt yuv420p \
    -preset medium -crf 18 -an "$n"
  echo "file '$n'" >> "$WORK/concat.txt"
done
SILENT="$WORK/silent_concat.mp4"
ffmpeg -y -v error -f concat -safe 0 -i "$WORK/concat.txt" -c copy "$SILENT"

# ─── mux the segment MP3 ─────────────────────────────────────────────────────
FINAL="$OUT_DIR/activity_${ACTIVITY}.mp4"
if [[ -f "$AUDIO_ABS" ]]; then
  echo "── muxing audio ($AUDIO_REL) ──"
  ffmpeg -y -v error -i "$SILENT" -i "$AUDIO_ABS" \
    -c:v copy -c:a aac -b:a 160k -movflags +faststart -shortest "$FINAL"
else
  echo "  ! audio file missing ($AUDIO_ABS) — emitting silent video" >&2
  cp "$SILENT" "$FINAL"
fi

# ─── final duration assert vs MP3 ────────────────────────────────────────────
FINAL_DUR="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$FINAL")"
DUR_DIFF="$("$VENV_PY" -c "print(round(abs($FINAL_DUR-$AUDIO_DUR),3))")"
echo "── final: ${FINAL_DUR}s vs audio ${AUDIO_DUR}s (Δ${DUR_DIFF}s) ──"
if (( $(echo "$DUR_DIFF > 0.5" | bc -l) )); then
  echo "FAIL: final video duration off from audio by ${DUR_DIFF}s (>0.5s)" >&2
  exit 1
fi

# ─── review frames (ql: start/mid/end per cue; final: spot frames) ───────────
echo "── extracting review frames → $REVIEW_DIR ──"
extract_frame() { ffmpeg -y -v error -ss "$1" -i "$FINAL" -frames:v 1 -q:v 2 "$2"; }
if [[ "$QUALITY" == "ql" ]]; then
  for ((i=0; i<NUM_CUES; i++)); do
    ii="$(printf '%02d' "$i")"
    s="$(read_json "d['cues'][$i]['start']")"
    e="$(read_json "d['cues'][$i]['end']")"
    m="$("$VENV_PY" -c "print(round(($s+$e)/2,2))")"
    sp="$("$VENV_PY" -c "dur=$e-$s; print(round(min($s+1.2, $s+max(0.15, dur/4)),2))")"
    ep="$("$VENV_PY" -c "dur=$e-$s; print(round(max($s+0.15, $e-min(0.3, dur/10)),2))")"
    extract_frame "$sp" "$REVIEW_DIR/cue${ii}_start.png"
    extract_frame "$m"  "$REVIEW_DIR/cue${ii}_mid.png"
    extract_frame "$ep" "$REVIEW_DIR/cue${ii}_end.png"
  done
  echo "  wrote $((NUM_CUES*3)) frames (3/cue)"
else
  # final: 4 evenly spaced spot frames across the segment.
  for k in 1 2 3 4; do
    t="$("$VENV_PY" -c "print(round($FINAL_DUR*$k/5,2))")"
    extract_frame "$t" "$REVIEW_DIR/final_spot${k}.png"
  done
  echo "  wrote 4 spot frames"
fi

# ─── poster ──────────────────────────────────────────────────────────────────
POSTER="$OUT_DIR/activity_${ACTIVITY}.poster.png"
POSTER_T="$("$VENV_PY" -c "print(round($FINAL_DUR*0.12,2))")"
extract_frame "$POSTER_T" "$POSTER"

echo "── DONE ──"
echo "  final:  $FINAL (${FINAL_DUR}s)"
echo "  poster: $POSTER"
echo "  frames: $REVIEW_DIR"
echo "Next: READ the review frames, write review.json, then register-video.ts $LESSON $ACTIVITY"
