#!/usr/bin/env python3
"""
Open Avocado — static GitHub Pages site generator.

Hand-authored, dependency-free static site (no Jekyll, no bundler). Running this
script regenerates every file under `site/` from the page definitions below.
The GitHub Pages workflow (.github/workflows/deploy-site.yml) uploads `site/`
as-is; it does NOT run this generator, so commit the generated output.

Usage:  python3 scripts/site/generate-site.py
"""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, "site")
ASSETS = os.path.join(SITE, "assets")

REPO_URL = "https://github.com/frankhli843/openavocado"
PAGES_URL = "https://frankhli843.github.io/openavocado/"

# ── Shared brand mark (avocado: green skin, yellow flesh, white pit) ──────────
AVOCADO_SVG = (
    '<svg viewBox="635 -20 445 445" role="img" aria-label="Open Avocado" '
    'width="{w}" height="{w}">'
    '<path fill="#399103" d="M1232.67-1000.76a125.34,125.34,0,0,1,1-13c3.4-33,13.92-86.75,'
    '57.37-160.78,33-56.25,49.52-84.38,70.72-85.09,26.54-.89,46.12,32.06,79.12,87.6,39.58,'
    '66.6,49.47,123.11,52.53,154.17.83,8.43,1.25,12.64,1.12,17.1-1.53,52.59-48.78,130.92-130.92,'
    '130.92A130.92,130.92,0,0,1,1232.67-1000.76Z" transform="translate(-506.6 1267.13)"/>'
    '<path fill="#f8ee7b" d="M1275.87-1006.33a84,84,0,0,1,.65-8.7c2.28-22.12,9.33-58.12,38.44-107.73,'
    '22.12-37.69,33.18-56.53,47.38-57,17.78-.6,30.9,21.48,53,58.69,26.52,44.62,33.14,82.48,35.2,'
    '103.29a90.81,90.81,0,0,1,.75,11.45c-1,35.23-32.68,87.71-87.71,87.71A87.71,87.71,0,0,1,'
    '1275.87-1006.33Z" transform="translate(-506.6 1267.13)"/>'
    '<circle fill="#fff" cx="856.99" cy="264.46" r="42.81"/></svg>'
)

# ── Top navigation (shared) ──────────────────────────────────────────────────
NAV = [
    ("index.html", "Home"),
    ("quickstart.html", "Quick Start"),
    ("architecture.html", "Architecture"),
    ("lesson-authoring.html", "Lesson Authoring"),
    ("configuration.html", "Configuration"),
    ("contributing.html", "Contributing"),
    ("deployment.html", "Deploy"),
    ("privacy.html", "Privacy"),
]

CSS = """
:root {
  --bg: #ffffff;
  --bg-elev: #f5f8f1;
  --bg-elev-2: #eef3e7;
  --border: #dbe4d1;
  --fg: #16210f;
  --fg-soft: #384631;
  --muted: #667a5b;
  --accent: #2f7d0d;
  --accent-strong: #256b0a;
  --accent-soft: #e4f2d7;
  --flesh: #f8ee7b;
  --good: #1a7f37;
  --warn: #9a6700;
  --bad: #cf222e;
  --radius: 12px;
  --shadow: 0 1px 2px rgba(22,33,15,.06), 0 8px 24px rgba(22,33,15,.05);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: var(--fg);
  background: var(--bg);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent-strong); text-decoration: none; }
a:hover { text-decoration: underline; }
code, pre, kbd { font-family: 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace; }
code { background: var(--bg-elev-2); padding: .12em .4em; border-radius: 6px; font-size: .88em; }
pre {
  background: #0f1a0a; color: #e8f2df; padding: 1rem 1.15rem; border-radius: var(--radius);
  overflow-x: auto; font-size: .86rem; line-height: 1.55; margin: 1rem 0;
}
pre code { background: none; padding: 0; color: inherit; font-size: inherit; }

/* nav */
.topnav {
  position: sticky; top: 0; z-index: 100;
  background: rgba(255,255,255,.9); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.topnav-inner {
  width: min(100%, 1040px); margin: 0 auto; padding: .7rem 1.4rem;
  display: flex; align-items: center; gap: 1.4rem;
}
.brand { display: inline-flex; align-items: center; gap: .55rem; font-weight: 700; letter-spacing: -.01em; color: var(--fg); }
.brand svg { display: block; }
.brand .b-open { color: var(--fg); }
.brand .b-avo { color: var(--accent); }
.nav-links {
  display: flex; gap: .25rem; margin-left: auto; overflow-x: auto; scrollbar-width: none;
}
.nav-links::-webkit-scrollbar { display: none; }
.nav-links a {
  color: var(--fg-soft); padding: .35rem .6rem; border-radius: 8px; font-size: .92rem;
  white-space: nowrap; font-weight: 500;
}
.nav-links a:hover { background: var(--bg-elev); text-decoration: none; }
.nav-links a.active { color: var(--accent-strong); background: var(--accent-soft); }
.nav-links a.gh { border: 1px solid var(--border); }

/* layout */
.wrap { width: min(100%, 900px); margin: 0 auto; padding: 2.2rem 1.4rem 4.5rem; }
.wrap.wide { width: min(100%, 1040px); }
h1 { font-size: 2rem; font-weight: 750; letter-spacing: -.02em; line-height: 1.15; margin: 0 0 .5rem; }
h2 { font-size: 1.4rem; font-weight: 700; letter-spacing: -.01em; margin: 2.4rem 0 .8rem; padding-top: .4rem; }
h3 { font-size: 1.08rem; font-weight: 650; margin: 1.6rem 0 .5rem; }
p { margin: .7rem 0; color: var(--fg-soft); }
ul, ol { color: var(--fg-soft); padding-left: 1.3rem; }
li { margin: .3rem 0; }
.lead { font-size: 1.12rem; color: var(--muted); }
.subtle { color: var(--muted); font-size: .92rem; }

/* hero */
.hero { text-align: center; padding: 3.4rem 0 2.2rem; }
.hero .mark { margin: 0 auto 1.1rem; width: 76px; height: 76px; }
.hero .mark svg { filter: drop-shadow(0 6px 14px rgba(47,125,13,.18)); }
.hero h1 { font-size: 3rem; }
.hero h1 .b-avo { color: var(--accent); }
.hero .tagline { font-size: 1.2rem; color: var(--muted); max-width: 640px; margin: .9rem auto 1.8rem; }
.btn-row { display: flex; gap: .7rem; justify-content: center; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: .4rem; padding: .6rem 1.15rem; border-radius: 10px;
  font-weight: 600; font-size: .96rem; border: 1px solid transparent; cursor: pointer;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-strong); text-decoration: none; }
.btn-secondary { background: var(--bg-elev); color: var(--fg); border-color: var(--border); }
.btn-secondary:hover { border-color: var(--accent); text-decoration: none; }

/* inline svg icons */
.svg-ico { display: inline-flex; align-items: center; vertical-align: -.16em; color: var(--accent); }
.svg-ico svg { width: 1.15em; height: 1.15em; }
h1 .svg-ico, h2 .svg-ico, h3 .svg-ico { margin-right: .35rem; }
.card .ico .svg-ico svg, .feature .f h3 .svg-ico svg { width: 1.5rem; height: 1.5rem; }
.card .ico { line-height: 0; }

/* cards */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 1rem; margin: 1.4rem 0; }
.card {
  display: block; background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1.2rem 1.25rem; transition: border-color .15s, transform .15s, box-shadow .15s; color: inherit;
}
.card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow); text-decoration: none; }
.card .ico { font-size: 1.35rem; }
.card h3 { margin: .5rem 0 .3rem; color: var(--fg); }
.card p { margin: 0; font-size: .92rem; }
.runtime-group-label { margin: 2rem 0 -.2rem; font-weight: 700; font-size: .95rem; color: var(--fg-soft); }

/* mission band */
.mission { background: linear-gradient(180deg, var(--accent-soft), #fbfdf8); border: 1px solid var(--border);
  border-radius: 16px; padding: 2rem 2.2rem; margin: 2.4rem 0; text-align: center; }
.mission .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: .78rem; font-weight: 700;
  color: var(--accent-strong); margin: 0 0 .3rem; }
.mission-title { font-size: 1.7rem; margin: .2rem 0 1rem; color: var(--fg); border: 0; padding: 0; }
.mission p { max-width: 720px; margin: .7rem auto; }
.mission em { color: var(--fg-soft); }

/* feature rows */
.feature { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 1.2rem 2rem; margin: 1.2rem 0; }
.feature .f h3 { margin-top: 0; }

/* callouts */
.note, .warn, .planned {
  border: 1px solid var(--border); border-left: 3px solid var(--accent); background: var(--bg-elev);
  border-radius: 10px; padding: .85rem 1.1rem; margin: 1.1rem 0;
}
.note p, .warn p, .planned p { margin: .3rem 0; }
.note strong, .warn strong, .planned strong { color: var(--fg); }
.warn { border-left-color: var(--warn); }
.planned { border-left-color: var(--muted); }
.badge { display: inline-block; font-size: .72rem; font-weight: 700; letter-spacing: .03em; text-transform: uppercase;
  padding: .12rem .5rem; border-radius: 999px; vertical-align: middle; }
.badge-ok { background: var(--accent-soft); color: var(--accent-strong); }
.badge-planned { background: #eceee9; color: var(--muted); }
.badge-partial { background: #fdf3d6; color: var(--warn); }
.badge-prompt { background: #e7eef8; color: #2f5bb0; }

/* tables */
.table-wrap { overflow-x: auto; max-width: 100%; margin: 1.1rem 0; -webkit-overflow-scrolling: touch; }
.table-wrap table { margin: 0; }
table { border-collapse: collapse; width: 100%; margin: 1.1rem 0; font-size: .92rem; }
th, td { text-align: left; padding: .55rem .7rem; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--fg); font-weight: 650; background: var(--bg-elev); }
td code { white-space: nowrap; }

/* steps */
ol.steps { counter-reset: s; list-style: none; padding-left: 0; }
ol.steps > li { position: relative; padding-left: 2.4rem; margin: 1rem 0; }
ol.steps > li::before {
  counter-increment: s; content: counter(s); position: absolute; left: 0; top: 0;
  width: 1.7rem; height: 1.7rem; border-radius: 50%; background: var(--accent-soft); color: var(--accent-strong);
  font-weight: 700; font-size: .85rem; display: grid; place-items: center;
}

/* screenshot placeholder */
.shot {
  border: 1px dashed var(--border); border-radius: var(--radius); background: var(--bg-elev);
  aspect-ratio: 16 / 9; display: grid; place-items: center; color: var(--muted); font-size: .9rem; margin: 1rem 0;
}
.shot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 1rem; }

/* footer */
footer { border-top: 1px solid var(--border); background: var(--bg-elev); }
.footer-inner { width: min(100%, 1040px); margin: 0 auto; padding: 2rem 1.4rem; color: var(--muted); font-size: .9rem; }
.footer-inner p { color: var(--muted); margin: .3rem 0; }

.breadcrumb { font-size: .88rem; color: var(--muted); margin-bottom: .3rem; }
hr { border: none; border-top: 1px solid var(--border); margin: 2.2rem 0; }

/* eyebrow */
.eyebrow { text-transform: uppercase; letter-spacing: .09em; font-size: .78rem; font-weight: 700; color: var(--accent-strong); margin: 0 0 .5rem; }

/* hero refinements */
.hero { padding: 3.2rem 0 1.4rem; }
.hero .eyebrow { margin-bottom: .7rem; }
.btn-ghost { background: transparent; color: var(--accent-strong); border-color: transparent; }
.btn-ghost:hover { background: var(--accent-soft); text-decoration: none; }
.btn svg { width: 1.05em; height: 1.05em; }
.hero-liveline { margin: 1rem auto 0; font-size: .92rem; color: var(--muted); }
.hero-liveline a { font-weight: 600; }

/* responsive video */
.video-wrap { max-width: 940px; margin: 1.6rem auto 0; border-radius: 16px; overflow: hidden;
  border: 1px solid var(--border); box-shadow: 0 12px 40px rgba(22,33,15,.10); background: #0a1207; }
.video-wrap video { display: block; width: 100%; height: auto; }
.video-cap { text-align: center; color: var(--muted); font-size: .86rem; margin: .7rem auto 0; max-width: 720px; }

/* section heading block */
.sec-head { text-align: center; max-width: 700px; margin: 0 auto 1.6rem; }
.sec-head h2 { border: 0; padding: 0; margin: 0 0 .4rem; }
.sec-head p { margin: 0; color: var(--muted); }

/* real screenshot figure */
figure.shot-real { margin: 0; border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
  background: var(--bg-elev); box-shadow: var(--shadow); }
figure.shot-real img { display: block; width: 100%; height: auto; }
figure.shot-real figcaption { padding: .7rem .95rem; font-size: .88rem; color: var(--fg-soft); border-top: 1px solid var(--border); background: #fff; }
figure.shot-real figcaption strong { color: var(--fg); }

/* gallery — masonry columns so varied-height screenshots pack tightly */
.gallery { column-count: 2; column-gap: 1.2rem; margin: 1.4rem 0; }
.gallery figure { break-inside: avoid; margin: 0 0 1.2rem; width: 100%; }
@media (max-width: 720px) { .gallery { column-count: 1; } }

/* split feature (image + text) */
.split { display: grid; grid-template-columns: 1.1fr 1fr; gap: 2rem; align-items: center; margin: 2rem 0; }
.split.rev { grid-template-columns: 1fr 1.1fr; }
.split.rev .split-media { order: 2; }
.split-copy h3 { margin-top: 0; font-size: 1.25rem; }
.split-copy p { margin: .5rem 0; }

/* adaptive loop steps */
.loop { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; margin: 1.4rem 0; counter-reset: lp; }
.loop .step { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 14px; padding: 1.2rem 1.15rem; position: relative; }
.loop .step .n { width: 2rem; height: 2rem; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; display: grid; place-items: center; font-size: .9rem; margin-bottom: .6rem; }
.loop .step h3 { margin: 0 0 .25rem; font-size: 1.02rem; color: var(--fg); }
.loop .step p { margin: 0; font-size: .9rem; }

/* audience cards */
.aud-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1rem; margin: 1.4rem 0; }
.aud { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 14px; padding: 1.2rem 1.25rem; }
.aud h3 { margin: 0 0 .3rem; font-size: 1.02rem; color: var(--fg); }
.aud p { margin: 0; font-size: .9rem; }

/* open-source values band */
.os-band { background: linear-gradient(180deg, #f2f8ec, #ffffff); border: 1px solid var(--border); border-radius: 18px; padding: 2rem 2.2rem; margin: 2.6rem 0; }
.os-band h2 { border: 0; padding: 0; margin: 0 0 .3rem; }
.os-values { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1.1rem; margin-top: 1.2rem; }
.os-values .v h3 { margin: 0 0 .2rem; font-size: 1rem; color: var(--fg); }
.os-values .v p { margin: 0; font-size: .9rem; }

/* final cta */
.cta-band { text-align: center; padding: 2.4rem 0 1rem; }
.cta-band h2 { border: 0; padding: 0; }

@media (max-width: 760px) {
  .split, .split.rev { grid-template-columns: 1fr; }
  .split.rev .split-media { order: 0; }
}
@media (max-width: 640px) {
  .hero h1 { font-size: 2.2rem; }
  h1 { font-size: 1.65rem; }
  .wrap { padding: 1.6rem 1.1rem 3.5rem; }
}
"""


# ── Inline SVG icons (replace emoji so the site renders identically on any OS) ─
def _ic(paths):
    return ('<span class="svg-ico"><svg viewBox="0 0 24 24" fill="none" '
            'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">' + paths + '</svg></span>')

ICONS = {
    "\U0001F3A7": _ic('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="4" height="6" rx="1.3"/><rect x="17.5" y="14" width="4" height="6" rx="1.3"/>'),  # headphones
    "\U0001F9E9": _ic('<path d="M10 3h4v3.2a1.8 1.8 0 1 0 3.6 0V6H21v4.4h-.2a1.8 1.8 0 1 0 0 3.6h.2V21h-4.4v-.2a1.8 1.8 0 1 0-3.6 0v.2H10v-3.4a1.8 1.8 0 1 0-3.6 0v-.2H3V13h.2a1.8 1.8 0 1 0 0-3.6H3V3h4.4"/>'),  # puzzle
    "\U0001F40D": _ic('<path d="M9 8l-4 4 4 4"/><path d="M15 8l4 4-4 4"/>'),  # code
    "\U0001F4CA": _ic('<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M3 20h18"/>'),  # bar chart
    "\U0001F5FA": _ic('<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14"/><path d="M15 6v14"/>'),  # map
    "\U0001F4C8": _ic('<path d="M3 17l6-6 4 4 7-8"/><path d="M17 7h4v4"/>'),  # trending up
    "\U0001F511": _ic('<circle cx="8" cy="8" r="4"/><path d="M11 11l8 8"/><path d="M16 16l2-2"/><path d="M18.5 18.5l1.5-1.5"/>'),  # key
    "\U0001F98E": _ic('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'),  # chip
    "\U0001F916": _ic('<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 4v4"/><circle cx="12" cy="3" r="1.2"/><circle cx="9" cy="13" r="1.1"/><circle cx="15" cy="13" r="1.1"/>'),  # bot
    "\U0001F4DC": _ic('<path d="M6 4h11a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6"/><path d="M4 6a2 2 0 0 1 4 0v3H4z"/><path d="M9 9h7M9 13h7M9 17h4"/>'),  # scroll
    "⚡": _ic('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>'),  # bolt
    "\U0001F3D7": _ic('<rect x="3" y="10" width="8" height="11" rx="1"/><rect x="13" y="4" width="8" height="17" rx="1"/><path d="M6 14h2M6 17h2M16 8h2M16 12h2M16 16h2"/>'),  # building
    "✍": _ic('<path d="M15 5l4 4L8 20l-4 1 1-4L16 5z"/><path d="M13.5 6.5l4 4"/>'),  # pencil
    "⚙": _ic('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'),  # gear
    "\U0001F91D": _ic('<path d="M6 3v7"/><path d="M18 21v-7"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M8.3 11l7.4 2"/>'),  # git/collab
    "\U0001F680": _ic('<path d="M12 3c3 1.5 5 4.5 5 8l-2.5 6h-5L7 11c0-3.5 2-6.5 5-8z"/><circle cx="12" cy="10" r="1.6"/><path d="M9 18l-2 3M15 18l2 3"/>'),  # rocket
}

def _swap_icons(text):
    for emoji, svg in ICONS.items():
        text = text.replace(emoji + "️", svg).replace(emoji, svg)
    return text


def head(title, desc, active):
    links = ""
    for href, label in NAV:
        cls = ' class="active"' if href == active else ""
        links += f'<a href="{href}"{cls}>{label}</a>'
    links += f'<a class="gh" href="{REPO_URL}" target="_blank" rel="noopener">GitHub</a>'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{PAGES_URL}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="stylesheet" href="assets/styles.css">
</head>
<body>
<nav class="topnav"><div class="topnav-inner">
<a class="brand" href="index.html">{AVOCADO_SVG.format(w=22)}<span><span class="b-open">Open</span><span class="b-avo"> Avocado</span></span></a>
<div class="nav-links">{links}</div>
</div></nav>
"""


FOOTER = f"""
<footer><div class="footer-inner">
<p><strong>Open Avocado</strong> — open-source adaptive learning platform &amp; lesson-generation framework.</p>
<p><a href="{REPO_URL}">GitHub repository</a> · <a href="{PAGES_URL}">Live site</a> · <a href="privacy.html">Privacy &amp; data boundaries</a></p>
<p class="subtle">Built with Next.js, React, TypeScript, and SQLite. No personal data or credentials are stored in this repository.</p>
</div></footer>
</body>
</html>
"""


def page(fname, title, desc, active, body, wide=False):
    w = ' wide' if wide else ''
    body = _swap_icons(body)
    # Wrap every table in a horizontal-scroll container so wide tables never
    # overflow the page on narrow (mobile) viewports.
    body = re.sub(r'<table>.*?</table>', lambda m: '<div class="table-wrap">' + m.group(0) + '</div>', body, flags=re.S)
    html = head(title, desc, active) + f'<main class="wrap{w}">' + body + "</main>" + FOOTER
    with open(os.path.join(SITE, fname), "w") as f:
        f.write(html)


# ── page bodies are defined in content.py-style dict below ───────────────────
from site_content import PAGE_BODIES, HERO_BODY  # noqa: E402


def build():
    os.makedirs(ASSETS, exist_ok=True)
    with open(os.path.join(ASSETS, "styles.css"), "w") as f:
        f.write(CSS.strip() + "\n")
    with open(os.path.join(ASSETS, "favicon.svg"), "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" ' + AVOCADO_SVG.format(w=64)[4:])
    with open(os.path.join(ASSETS, "logo.svg"), "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" ' + AVOCADO_SVG.format(w=256)[4:])

    # landing
    page("index.html", "Open Avocado — Adaptive Learning Platform",
         "Open-source adaptive learning platform and lesson-generation framework. "
         "Define goals, keep evidence of what a learner knows, and generate the next best lesson.",
         "index.html", HERO_BODY, wide=True)

    for fname, (nav, title, desc, body) in PAGE_BODIES.items():
        page(fname, title, desc, nav, body)

    print(f"Generated {2 + len(PAGE_BODIES)} files into {SITE}/")


if __name__ == "__main__":
    build()
