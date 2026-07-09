#!/usr/bin/env bash
# Assemble the Open Avocado feature-walkthrough video (v2):
#   narrated product beats -> runtime-paths beat -> lead-in ->
#   ~60s SIDE-BY-SIDE audio-synced lesson video (text left / video right) ->
#   proper outro card.
set -euo pipefail
cd "$(dirname "$0")"

LESSON="${LESSON_VIDEO:-../runtime_artifacts/videos/lesson_15/activity_86.mp4}"
LESSON="$(cd "$(dirname "$LESSON")" && pwd)/$(basename "$LESSON")"
[ -f "$LESSON" ] || { echo "FATAL: lesson video not found: $LESSON" >&2; exit 1; }

VOICE="en-US-AriaNeural"
mkdir -p audio clips work
: > work/concat.txt
CLIPDIR="$(pwd)/clips"

dur_of(){ ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }

# --- 1. Narration (edge-tts) ---
echo "== TTS =="
while IFS='|' read -r id text; do
  [ -z "${id:-}" ] && continue
  edge-tts --voice "$VOICE" --rate=-4% --text "$text" --write-media "audio/${id}.mp3" >/dev/null 2>&1
  echo "  ${id}: $(dur_of audio/${id}.mp3)s"
done < narration.txt

VENC=(-c:v libx264 -profile:v high -pix_fmt yuv420p -r 30 -b:v 3400k)
AENC=(-c:a aac -ar 48000 -ac 2 -b:a 160k)

mk_slide_clip(){ # $1=beat id (uses slides/$1.png + audio/$1.mp3)
  local n="$1" vo="audio/$1.mp3" vd D frames
  vd=$(dur_of "$vo"); D=$(python3 -c "print(round($vd+1.0,2))")
  frames=$(python3 -c "print(int($D*30))")
  ffmpeg -y -loglevel error -loop 1 -i "slides/$n.png" -i "$vo" \
    -filter_complex \
    "[0:v]scale=2560:1440,zoompan=z='min(1.0+0.05*on/${frames},1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30,format=yuv420p[v];\
     [1:a]adelay=350|350,apad,atrim=0:${D},asetpts=N/SR/TB,aformat=sample_rates=48000:channel_layouts=stereo[a]" \
    -map "[v]" -map "[a]" -t "$D" "${VENC[@]}" "${AENC[@]}" -shortest "clips/$n.mp4"
  echo "  $n: ${D}s (vo=${vd}s)"
  echo "file '$CLIPDIR/$n.mp4'" >> work/concat.txt
}

echo "== slide beats =="
for n in beat1 beat2 beat3 beat4 beat5 beat6 beat7 beat8; do mk_slide_clip "$n"; done

# --- 2. Side-by-side audio-synced segment (~60s): text left, real lesson video right ---
echo "== side-by-side AV segment =="
AVDUR=60
# card hole (CSS px, 1280x720 space): left=498 top=184 w=706 h=418
ffmpeg -y -loglevel error -ss 0 -t $AVDUR -i "$LESSON" -i slides/av_bg.png \
  -filter_complex \
  "[1:v]scale=1280:720[bg];\
   [0:v]scale=706:418:force_original_aspect_ratio=increase,crop=706:418,setsar=1[vid];\
   [bg][vid]overlay=498:184,format=yuv420p,fade=t=out:st=$((AVDUR-1)):d=1[v];\
   [0:a]afade=t=in:st=0:d=0.4,afade=t=out:st=$((AVDUR-1)):d=1,aformat=sample_rates=48000:channel_layouts=stereo[a]" \
  -map "[v]" -map "[a]" -t $AVDUR "${VENC[@]}" "${AENC[@]}" clips/av.mp4
echo "  av.mp4: ${AVDUR}s"
echo "file '$CLIPDIR/av.mp4'" >> work/concat.txt

# --- 3. Outro (voiceover + short hold so it lands) ---
echo "== outro =="
ovd=$(dur_of audio/outro.mp3); OD=$(python3 -c "print(round($ovd+1.8,2))")
oframes=$(python3 -c "print(int($OD*30))")
ofade=$(python3 -c "print(round($OD-0.8,2))")
ffmpeg -y -loglevel error -loop 1 -i slides/outro.png -i audio/outro.mp3 \
  -filter_complex \
  "[0:v]scale=2560:1440,zoompan=z='min(1.0+0.04*on/${oframes},1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30,format=yuv420p,fade=t=out:st=${ofade}:d=0.8[v];\
   [1:a]adelay=400|400,apad,atrim=0:${OD},asetpts=N/SR/TB,afade=t=out:st=${ofade}:d=0.8,aformat=sample_rates=48000:channel_layouts=stereo[a]" \
  -map "[v]" -map "[a]" -t "$OD" "${VENC[@]}" "${AENC[@]}" -shortest clips/outro.mp4
echo "  outro: ${OD}s"
echo "file '$CLIPDIR/outro.mp4'" >> work/concat.txt

# --- 4. Concatenate (re-encode uniform) + open fade-in ---
echo "== concat =="
ffmpeg -y -loglevel error -f concat -safe 0 -i work/concat.txt \
  -vf "fade=t=in:st=0:d=0.6" \
  "${VENC[@]}" "${AENC[@]}" -movflags +faststart work/showcase.mp4

echo "== FINAL =="
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_type,width,height,codec_name -of default=noprint_wrappers=1 work/showcase.mp4
