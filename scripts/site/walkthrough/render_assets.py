#!/usr/bin/env python3
"""Render Open Avocado feature-walkthrough slides + the side-by-side AV background.

Outputs 2560x1440 PNGs (1280x720 CSS @2x) into ./slides via headless Chrome
--screenshot (no running browser needed). Real product screenshots are embedded
as base64 so they render without file:// CORS.
"""
import base64, os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "..", "..", "..", "site", "assets", "shots")
OUT = os.path.join(HERE, "slides")
os.makedirs(OUT, exist_ok=True)

AVO_SVG = ('<svg viewBox="635 -20 445 445" width="40" height="40" role="img" aria-label="Open Avocado">'
 '<path fill="#399103" d="M1232.67-1000.76a125.34,125.34,0,0,1,1-13c3.4-33,13.92-86.75,57.37-160.78,'
 '33-56.25,49.52-84.38,70.72-85.09,26.54-.89,46.12,32.06,79.12,87.6,39.58,66.6,49.47,123.11,52.53,'
 '154.17.83,8.43,1.25,12.64,1.12,17.1-1.53,52.59-48.78,130.92-130.92,130.92A130.92,130.92,0,0,1,'
 '1232.67-1000.76Z" transform="translate(-506.6 1267.13)"/>'
 '<path fill="#f8ee7b" d="M1275.87-1006.33a84,84,0,0,1,.65-8.7c2.28-22.12,9.33-58.12,38.44-107.73,'
 '22.12-37.69,33.18-56.53,47.38-57,17.78-.6,30.9,21.48,53,58.69,26.52,44.62,33.14,82.48,35.2,103.29a90.81,'
 '90.81,0,0,1,.75,11.45c-1,35.23-32.68,87.71-87.71,87.71A87.71,87.71,0,0,1,1275.87-1006.33Z" '
 'transform="translate(-506.6 1267.13)"/><circle fill="#fff" cx="856.99" cy="264.46" r="42.81"/></svg>')

FOOTER = "avocadocore.178-105-119-249.nip.io"

def b64(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()

BASE_CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html{background:#f7faf3}
html,body{width:1280px;height:720px;overflow:hidden}
body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
 background:radial-gradient(1200px 600px at 78% -10%,#eef7e6 0%,#f7faf3 42%,#ffffff 100%);
 color:#20301a;position:relative}
.wm{position:absolute;top:34px;left:44px;display:flex;align-items:center;gap:10px;z-index:5}
.wm .name{font-weight:800;font-size:22px;letter-spacing:-.01em}
.wm .name .g{color:#399103}
.badge{position:absolute;top:40px;right:46px;font-size:13px;font-weight:600;color:#5c7a49;
 background:#eef3e7;border:1px solid #dbe4d1;border-radius:999px;padding:7px 15px;z-index:5}
.dot{position:absolute;bottom:34px;left:76px;font-size:13px;color:#7d9268}
.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:14px;font-weight:700;color:#399103;margin-bottom:14px}
h1 .g{color:#399103}
"""

def frame(name, body_class, inner):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
{EXTRA_CSS}</style></head><body class="{body_class}">
<div class="wm">{AVO_SVG}<span class="name">Open<span class="g"> Avocado</span></span></div>
<div class="badge">Feature walkthrough</div>
{inner}
<div class="dot">{FOOTER}</div>
</body></html>"""

EXTRA_CSS = """
.stage{width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 76px}
.hero h1{font-size:68px;line-height:1.06;font-weight:800;letter-spacing:-.02em;color:#1c2b16;max-width:900px}
.hero .cap{margin-top:20px;font-size:24px;color:#4a5f3c;max-width:640px;line-height:1.4}
.content .stage{flex-direction:row;align-items:center;gap:56px}
.content .copy{flex:0 0 44%;max-width:44%}
.content h1{font-size:40px;line-height:1.06;font-weight:800;letter-spacing:-.02em;color:#1c2b16;max-width:560px}
.content .cap{margin-top:20px;font-size:20px;color:#4a5f3c;max-width:620px;line-height:1.4}
.fr{flex:1;background:#fff;border:1px solid #dbe4d1;border-radius:16px;
 box-shadow:0 24px 60px -22px rgba(30,60,20,.34),0 4px 14px -6px rgba(30,60,20,.18);
 overflow:hidden;max-height:560px;display:flex;flex-direction:column}
.bar{height:34px;background:#f5f8f1;border-bottom:1px solid #e6ecdd;display:flex;align-items:center;gap:8px;padding:0 14px;flex:0 0 auto}
.bar span{width:11px;height:11px;border-radius:50%;background:#d6dece}
.fr img{display:block;width:auto;height:auto;max-width:100%;max-height:526px;margin:0 auto}
/* runtime-paths */
.runtime .stage{justify-content:center}
.runtime .head{margin-bottom:34px}
.runtime h1{font-size:44px;font-weight:800;letter-spacing:-.02em;color:#1c2b16}
.runtime .sub{margin-top:12px;font-size:21px;color:#4a5f3c;max-width:760px}
.cards{display:flex;gap:22px}
.card{flex:1;background:#fff;border:1px solid #dbe4d1;border-radius:18px;padding:26px 24px;
 box-shadow:0 20px 46px -24px rgba(30,60,20,.30)}
.card .ico{font-size:30px}
.card h3{margin-top:14px;font-size:22px;font-weight:800;color:#1c2b16}
.card .k{margin-top:6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#399103}
.card p{margin-top:12px;font-size:16px;line-height:1.45;color:#4a5f3c}
/* lead-in */
.lead .stage{justify-content:center;align-items:flex-start}
.lead h1{font-size:52px;font-weight:800;letter-spacing:-.02em;color:#1c2b16;max-width:900px;line-height:1.08}
.lead .cap{margin-top:20px;font-size:23px;color:#4a5f3c;max-width:720px;line-height:1.4}
/* side-by-side AV background */
.av .panel{position:absolute;left:76px;top:150px;width:360px}
.av .panel .eyebrow{margin-bottom:16px}
.av .panel h1{font-size:34px;font-weight:800;letter-spacing:-.02em;color:#1c2b16;line-height:1.12}
.av .panel ul{margin-top:22px;list-style:none}
.av .panel li{position:relative;padding-left:26px;margin-bottom:15px;font-size:17px;line-height:1.4;color:#42563a}
.av .panel li::before{content:"";position:absolute;left:0;top:8px;width:11px;height:11px;border-radius:50%;
 background:#399103;box-shadow:0 0 0 4px #e4f1d8}
.av .card{position:absolute;left:498px;top:150px;width:706px;height:452px;background:#0e130b;
 border:1px solid #cdd8c2;border-radius:16px;overflow:hidden;
 box-shadow:0 30px 70px -24px rgba(30,60,20,.42)}
.av .card .bar{height:34px;background:#f5f8f1;border-bottom:1px solid #e6ecdd;display:flex;align-items:center;gap:8px;padding:0 14px}
.av .card .bar .u{margin-left:10px;font-size:12px;color:#8aa079;font-weight:600}
.av .card .hole{position:absolute;left:0;top:34px;width:706px;height:418px;background:#0e130b}
/* outro */
.outro .stage{justify-content:center;align-items:center;text-align:center}
.outro .mk{margin-bottom:22px}
.outro h1{font-size:58px;font-weight:800;letter-spacing:-.02em;color:#1c2b16}
.outro h1 .g{color:#399103}
.outro .cap{margin-top:18px;font-size:24px;color:#4a5f3c;max-width:760px;line-height:1.45}
.outro .cta{margin-top:34px;display:inline-flex;align-items:center;gap:12px;background:#399103;color:#fff;
 font-size:20px;font-weight:700;padding:16px 30px;border-radius:999px;box-shadow:0 18px 40px -16px rgba(57,145,3,.6)}
.outro .url{margin-top:20px;font-size:16px;color:#7d9268;font-weight:600}
"""

def content_slide(eyebrow, title, cap, shot):
    img = b64(os.path.join(SHOTS, shot))
    t = title.replace("Open Avocado", "Open<span class=g> Avocado</span>")
    inner = f"""<div class="stage">
      <div class="copy"><div class="eyebrow">{eyebrow}</div><h1>{t}</h1><div class="cap">{cap}</div></div>
      <div class="fr"><div class="bar"><span></span><span></span><span></span></div><img src="{img}"></div>
    </div>"""
    return frame("content", "content", inner)

def hero_slide(eyebrow, title, cap):
    t = title.replace("Open Avocado", "Open<span class=g> Avocado</span>")
    inner = f"""<div class="stage"><div class="eyebrow">{eyebrow}</div><h1>{t}</h1><div class="cap">{cap}</div></div>"""
    return frame("hero", "hero", inner)

def runtime_slide():
    inner = """<div class="stage">
      <div class="head"><div class="eyebrow">Run it your way</div>
        <h1>One platform, three ways to run</h1>
        <div class="sub">Open Avocado adapts to how you want to power it — private, hosted, or agentic.</div></div>
      <div class="cards">
        <div class="card"><div class="ico">🔒</div><div class="k">Private &amp; offline</div>
          <h3>Your own local LLM</h3><p>Point it at a local model — llama.cpp, Ollama, vLLM, LM Studio — and keep every lesson on your own machine.</p></div>
        <div class="card"><div class="ico">⚡</div><div class="k">Fastest start</div>
          <h3>Your own API key</h3><p>Bring a hosted model key and start generating adaptive lessons in minutes, no infrastructure required.</p></div>
        <div class="card"><div class="ico">🤖</div><div class="k">Most capable</div>
          <h3>An agent harness</h3><p>Connect an agent runtime for richer, more agentic lesson generation, iteration, and tooling.</p></div>
      </div>
    </div>"""
    return frame("runtime", "runtime", inner)

def lead_slide():
    inner = """<div class="stage">
      <div class="eyebrow">Audio-synced lesson videos</div>
      <h1>Every lesson can become a<br><span class=g>narrated video</span></h1>
      <div class="cap">Open Avocado generates a spoken walkthrough with the audio synced to the on-screen visuals. Here is one it produced.</div>
    </div>"""
    return frame("lead", "lead", inner)

def av_background():
    inner = """<div class="av-root">
      <div class="panel">
        <div class="eyebrow">Audio-synced lesson video</div>
        <h1>The lesson, narrated and animated</h1>
        <ul>
          <li>Generated straight from the lesson content</li>
          <li>Narration synced frame-by-frame to the visuals</li>
          <li>Captions and a full transcript included</li>
          <li>Built for focused review and deeper recall</li>
        </ul>
      </div>
      <div class="card"><div class="bar"><span></span><span></span><span></span><span class="u">Inside the Attention Block · Deep Learning</span></div>
        <div class="hole"></div></div>
    </div>"""
    return frame("av", "av", inner)

def render(html, out_png):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, dir="/tmp") as f:
        f.write(html); path = f.name
    subprocess.run([
        "google-chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=2", "--window-size=1280,720",
        "--default-background-color=00000000",
        f"--screenshot={out_png}", f"file://{path}",
    ], check=True, capture_output=True)
    os.unlink(path)
    print(f"rendered {os.path.basename(out_png)} ({os.path.getsize(out_png)} bytes)")

SLIDES = [
    ("beat1", hero_slide("Empower human learning", "Open Avocado",
        "A free, open-source adaptive learning platform powered by AI.")),
    ("beat2", content_slide("Your subjects", "Mastery built from real evidence",
        "Each subject carries a mastery score from what you actually know.", "dashboard.png")),
    ("beat3", content_slide("Lesson orientation", "See where every concept fits",
        "Each lesson opens with a knowledge-graph orientation.", "concept-map.png")),
    ("beat4", content_slide("Interactive by design", "Manipulate to build intuition",
        "Bespoke interactive visualizations inside every lesson.", "viz-attention.png")),
    ("beat5", content_slide("Adaptive quizzes", "Checked one question at a time",
        "Miss one and it re-asks until the concept clicks.", "quiz.png")),
    ("beat6", content_slide("Progress you can trust", "Familiarity to competence to mastery",
        "Evidence-based mastery, and the next lesson generated for you.", "mastery.png")),
    ("beat7", runtime_slide()),
    ("beat8", lead_slide()),
    ("av_bg", av_background()),
    ("outro", frame("outro", "outro", """<div class="stage">
      <div class="mk">""" + AVO_SVG.replace('width="40" height="40"', 'width="72" height="72"') + """</div>
      <h1>Open<span class="g"> Avocado</span></h1>
      <div class="cap">Free, open source, and yours to run — locally, with your own key, or through an agent.</div>
      <div class="cta">▶  View the live demo</div>
      <div class="url">avocadocore.178-105-119-249.nip.io</div>
    </div>""")),
]

if __name__ == "__main__":
    for name, html in SLIDES:
        render(html, os.path.join(OUT, name + ".png"))
    print("ALL SLIDES DONE")
