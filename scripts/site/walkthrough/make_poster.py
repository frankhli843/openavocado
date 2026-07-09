#!/usr/bin/env python3
"""Render the walkthrough poster (1280x720@2x) via headless Chrome --screenshot."""
import base64, os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "..", "..", "..", "site", "assets", "shots")
OUT = os.path.join(HERE, "work", "poster.png")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

AVO_SVG = ('<svg viewBox="635 -20 445 445" width="44" height="44" role="img" aria-label="Open Avocado">'
 '<path fill="#399103" d="M1232.67-1000.76a125.34,125.34,0,0,1,1-13c3.4-33,13.92-86.75,57.37-160.78,'
 '33-56.25,49.52-84.38,70.72-85.09,26.54-.89,46.12,32.06,79.12,87.6,39.58,66.6,49.47,123.11,52.53,'
 '154.17.83,8.43,1.25,12.64,1.12,17.1-1.53,52.59-48.78,130.92-130.92,130.92A130.92,130.92,0,0,1,'
 '1232.67-1000.76Z" transform="translate(-506.6 1267.13)"/>'
 '<path fill="#f8ee7b" d="M1275.87-1006.33a84,84,0,0,1,.65-8.7c2.28-22.12,9.33-58.12,38.44-107.73,'
 '22.12-37.69,33.18-56.53,47.38-57,17.78-.6,30.9,21.48,53,58.69,26.52,44.62,33.14,82.48,35.2,103.29a90.81,'
 '90.81,0,0,1,.75,11.45c-1,35.23-32.68,87.71-87.71,87.71A87.71,87.71,0,0,1,1275.87-1006.33Z" '
 'transform="translate(-506.6 1267.13)"/><circle fill="#fff" cx="856.99" cy="264.46" r="42.81"/></svg>')

def b64(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()

dash = b64(os.path.join(SHOTS, "dashboard.png"))

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html{{background:#f7faf3}}
html,body{{width:1280px;height:720px;overflow:hidden}}
body{{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
 background:radial-gradient(1100px 620px at 80% -8%,#e9f5df 0%,#f4f9ef 45%,#ffffff 100%);
 color:#20301a;position:relative}}
.wm{{position:absolute;top:36px;left:48px;display:flex;align-items:center;gap:11px}}
.wm .name{{font-weight:800;font-size:24px;letter-spacing:-.01em}}
.wm .name .g{{color:#399103}}
.badge{{position:absolute;top:44px;right:50px;font-size:14px;font-weight:700;color:#3f5c2c;
 background:#eef3e7;border:1px solid #cfe0bd;border-radius:999px;padding:8px 17px}}
.stage{{position:absolute;inset:0;display:flex;align-items:center;padding:0 80px;gap:56px}}
.copy{{flex:0 0 52%}}
.eyebrow{{text-transform:uppercase;letter-spacing:.16em;font-size:15px;font-weight:700;color:#399103;margin-bottom:16px}}
h1{{font-size:50px;line-height:1.05;font-weight:800;letter-spacing:-.02em;color:#1c2b16;max-width:580px}}
h1 .g{{color:#399103}}
.sub{{margin-top:20px;font-size:19px;color:#4a5f3c;max-width:540px;line-height:1.45}}
.meta{{margin-top:26px;display:flex;align-items:center;gap:14px}}
.play{{width:74px;height:74px;border-radius:50%;background:#399103;display:flex;align-items:center;justify-content:center;
 box-shadow:0 16px 34px -10px rgba(57,145,3,.55)}}
.play::after{{content:"";border-left:26px solid #fff;border-top:16px solid transparent;border-bottom:16px solid transparent;margin-left:6px}}
.mlabel{{font-size:17px;font-weight:700;color:#2f4420}}
.mlabel small{{display:block;font-weight:500;color:#6f855c;font-size:14px;margin-top:2px}}
.art{{flex:1;position:relative;height:100%}}
.frame{{position:absolute;top:50%;left:0;transform:translateY(-50%) rotate(-1.4deg);
 width:640px;background:#fff;border:1px solid #dbe4d1;border-radius:18px;overflow:hidden;
 box-shadow:0 34px 80px -26px rgba(30,60,20,.42),0 6px 18px -8px rgba(30,60,20,.2)}}
.bar{{height:36px;background:#f5f8f1;border-bottom:1px solid #e6ecdd;display:flex;align-items:center;gap:8px;padding:0 15px}}
.bar span{{width:11px;height:11px;border-radius:50%;background:#d6dece}}
.frame img{{display:block;width:100%}}
</style></head><body>
<div class="wm">{AVO_SVG}<span class="name">Open<span class="g"> Avocado</span></span></div>
<div class="badge">Feature walkthrough</div>
<div class="stage">
  <div class="copy">
    <div class="eyebrow">Watch the product in action</div>
    <h1>See <span class="g">Open Avocado</span> work end to end</h1>
    <div class="sub">Subjects and mastery, interactive visuals, adaptive quizzes, an audio-synced lesson video, and the three ways to run it: local LLM, your own API key, or an agent.</div>
    <div class="meta"><div class="play"></div><div class="mlabel">Play walkthrough<small>Narrated feature tour</small></div></div>
  </div>
  <div class="art"><div class="frame"><div class="bar"><span></span><span></span><span></span></div><img src="{dash}"></div></div>
</div>
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
