#!/usr/bin/env python3
"""Render the landing-page walkthrough poster (feature-walkthrough cover) via
headless Chrome --screenshot. 1280x720 CSS @2x -> 2560x1440 PNG; the build step
scales it to site/assets/media/showcase-poster.jpg."""
import os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "work", "poster.png")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

AVO_SVG = ('<svg viewBox="635 -20 445 445" width="52" height="52" role="img" aria-label="Open Avocado">'
 '<path fill="#399103" d="M1232.67-1000.76a125.34,125.34,0,0,1,1-13c3.4-33,13.92-86.75,57.37-160.78,'
 '33-56.25,49.52-84.38,70.72-85.09,26.54-.89,46.12,32.06,79.12,87.6,39.58,66.6,49.47,123.11,52.53,'
 '154.17.83,8.43,1.25,12.64,1.12,17.1-1.53,52.59-48.78,130.92-130.92,130.92A130.92,130.92,0,0,1,'
 '1232.67-1000.76Z" transform="translate(-506.6 1267.13)"/>'
 '<path fill="#f8ee7b" d="M1275.87-1006.33a84,84,0,0,1,.65-8.7c2.28-22.12,9.33-58.12,38.44-107.73,'
 '22.12-37.69,33.18-56.53,47.38-57,17.78-.6,30.9,21.48,53,58.69,26.52,44.62,33.14,82.48,35.2,103.29a90.81,'
 '90.81,0,0,1,.75,11.45c-1,35.23-32.68,87.71-87.71,87.71A87.71,87.71,0,0,1,1275.87-1006.33Z" '
 'transform="translate(-506.6 1267.13)"/><circle fill="#fff" cx="856.99" cy="264.46" r="42.81"/></svg>')

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html{{background:#f7faf3}}
html,body{{width:1280px;height:720px;overflow:hidden}}
body{{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#20301a;
 background:radial-gradient(1000px 560px at 50% -8%,#eaf6df 0%,#f4f9ee 46%,#ffffff 100%);
 position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}}
.wm{{position:absolute;top:36px;left:46px;display:flex;align-items:center;gap:11px}}
.wm .name{{font-weight:800;font-size:24px;letter-spacing:-.01em}}
.wm .name .g{{color:#399103}}
.eyebrow{{text-transform:uppercase;letter-spacing:.2em;font-size:15px;font-weight:700;color:#399103;margin-bottom:18px}}
.play{{width:104px;height:104px;border-radius:50%;background:#399103;display:flex;align-items:center;justify-content:center;
 box-shadow:0 20px 50px -14px rgba(57,145,3,.55);margin-bottom:30px}}
.play::after{{content:"";border-left:34px solid #fff;border-top:22px solid transparent;border-bottom:22px solid transparent;margin-left:8px}}
h1{{font-size:60px;line-height:1.05;font-weight:800;letter-spacing:-.02em;color:#1c2b16}}
h1 .g{{color:#399103}}
.sub{{margin-top:20px;font-size:23px;color:#4a5f3c;max-width:900px;line-height:1.4}}
.chips{{margin-top:30px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center}}
.chips span{{font-size:15px;font-weight:700;color:#3f5533;background:#eef7e6;border:1px solid #d6e6c8;border-radius:999px;padding:9px 18px}}
</style></head><body>
<div class="wm">{AVO_SVG}<span class="name">Open<span class="g"> Avocado</span></span></div>
<div class="eyebrow">Feature walkthrough</div>
<div class="play"></div>
<h1>See <span class="g">Open Avocado</span> in action</h1>
<div class="sub">A narrated tour: adaptive lessons, interactive visuals, quizzes, mastery — plus a real audio-synced lesson video.</div>
<div class="chips"><span>🖥️ Local LLM</span><span>🔑 Your API key</span><span>🤖 Agent harness</span></div>
</body></html>"""

if __name__ == "__main__":
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, dir="/tmp") as f:
        f.write(HTML); path = f.name
    subprocess.run([
        "google-chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=2", "--window-size=1280,720",
        f"--screenshot={OUT}", f"file://{path}",
    ], check=True, capture_output=True)
    os.unlink(path)
    print(f"poster -> {OUT} ({os.path.getsize(OUT)} bytes)")
