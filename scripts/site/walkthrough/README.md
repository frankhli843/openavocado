# Landing-page feature-walkthrough video build

Rebuilds `site/assets/media/showcase.mp4` and `showcase-poster.jpg` — the narrated
feature walkthrough on the public landing page. See `docs/showcase-assets.md` for the
full sequence, voiceover script, and honesty note.

## Requirements

- `google-chrome` (headless screenshots for the branded slides + poster)
- `ffmpeg` (clip assembly, Ken-Burns, side-by-side composite, concat)
- `edge-tts` (voiceover narration, `en-US-AriaNeural`)
- A real generated lesson video for the ~60s side-by-side segment. This is an app
  **runtime artifact** and is intentionally not committed to this public repo. Pass its
  path via `LESSON_VIDEO`. The reference build used lesson 15 `activity_86.mp4`
  ("Inside the Attention Block", public-safe deep-learning content).

## Build

```bash
cd scripts/site/walkthrough
python3 render_assets.py                 # -> ./slides/*.png (beats, side-by-side bg, outro)
python3 make_poster.py                   # -> ./work/poster.png
LESSON_VIDEO=/abs/path/to/activity_86.mp4 bash build.sh   # -> ./work/showcase.mp4

# optimise for the web (CRF, mobile-friendly) then place assets:
ffmpeg -y -i work/showcase.mp4 -c:v libx264 -crf 25 -maxrate 1900k -bufsize 3800k \
  -c:a aac -b:a 128k -movflags +faststart ../../../site/assets/media/showcase.mp4
ffmpeg -y -i work/poster.png -vf scale=1280:720 -q:v 4 ../../../site/assets/media/showcase-poster.jpg
```

All slide copy, screenshots (`site/assets/shots/`), and the lesson clip are public-safe:
synthetic "Sample Learner" data, no personal/private content, no legacy "Core" branding.
