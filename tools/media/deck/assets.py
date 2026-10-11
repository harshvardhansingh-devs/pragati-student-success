"""Render deck assets with headless Chrome: brand backgrounds, logo, icons (PNG)."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
OUT = HERE / "assets"; OUT.mkdir(exist_ok=True)
(OUT / "icons").mkdir(exist_ok=True)
icons = json.load(open(HERE / "icons.json", encoding="utf-8"))

LOGO = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 48 48">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a78d6"/><stop offset="1" stop-color="#4a3aa7"/></linearGradient></defs>
<rect width="48" height="48" rx="12" fill="url(#g)"/>
<rect x="9" y="28" width="7" height="10" rx="2" fill="#fff" opacity=".75"/><rect x="20.5" y="21" width="7" height="17" rx="2" fill="#fff" opacity=".88"/>
<rect x="32" y="17" width="7" height="21" rx="2" fill="#fff"/>
<path d="M35.5 3.5 Q36.6 9 41.5 10 Q36.6 11 35.5 16.5 Q34.4 11 29.5 10 Q34.4 9 35.5 3.5 Z" fill="#ffd66b"/></svg>"""

BG = """<html><body style="margin:0;width:1920px;height:1080px;overflow:hidden;background:#0B1424">
<div style="position:absolute;inset:0;background:
 radial-gradient(900px 620px at %s, rgba(42,120,214,.55), transparent 65%%),
 radial-gradient(820px 620px at %s, rgba(74,58,167,.55), transparent 65%%), #0B1424"></div>
<div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
 background-size:64px 64px;-webkit-mask-image:radial-gradient(ellipse at center,#000 25%%,transparent 75%%)"></div>
</body></html>"""

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    page = b.new_page(viewport={"width": 1920, "height": 1080})
    for name, a, c in [("bg_cover", "15% 12%", "88% 92%"), ("bg_dark", "85% 8%", "10% 95%"), ("bg_close", "50% 0%", "50% 110%")]:
        page.set_content(BG % (a, c)); page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / f"{name}.png"))
    # logo + icons on transparent background
    sp = b.new_page(viewport={"width": 512, "height": 512})
    sp.set_content(f"<html><body style='margin:0;background:transparent'>{LOGO}</body></html>")
    sp.screenshot(path=str(OUT / "logo.png"), omit_background=True, clip={"x": 0, "y": 0, "width": 512, "height": 512})
    ip = b.new_page(viewport={"width": 256, "height": 256})
    for n, svg in icons.items():
        for color, suffix in [("#FFFFFF", "w"), ("#2A78D6", "b")]:
            ip.set_content(f"<html><body style='margin:0;background:transparent'>{svg.replace('#FFFFFF', color)}</body></html>")
            ip.screenshot(path=str(OUT / "icons" / f"{n}_{suffix}.png"), omit_background=True, clip={"x": 0, "y": 0, "width": 256, "height": 256})
    b.close()
print("assets ok:", len(list((OUT / 'icons').glob('*.png'))), "icon pngs")
