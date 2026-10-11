"""Render promo.html frame-by-frame (deterministic, smooth) to MP4.

Usage: render.py stills <t1,t2,...>   -> stills/t_<t>.jpg for checking
       render.py video                -> promo_silent.mp4 (30 fps, 1920x1080)
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
FPS, DURATION = 30, 70.0
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

SEEK = """t => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }"""


def open_page(p):
    b = p.chromium.launch(channel="chrome", headless=True)
    page = b.new_page(viewport={"width": 1920, "height": 1080})
    page.goto((HERE / "promo.html").as_uri())
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(1500)
    for img in page.query_selector_all("img"):
        img.evaluate("i => i.decode ? i.decode() : null")
    return b, page


mode = sys.argv[1]
with sync_playwright() as p:
    b, page = open_page(p)
    if mode == "stills":
        out = HERE / "stills"; out.mkdir(exist_ok=True)
        for t in [float(x) for x in sys.argv[2].split(",")]:
            page.evaluate(SEEK, t * 1000)
            page.screenshot(path=str(out / f"t_{t:05.1f}.jpg"), type="jpeg", quality=85)
        print("stills done")
    else:
        enc = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                                str(HERE / "promo_silent.mp4")], stdin=subprocess.PIPE)
        n = int(DURATION * FPS)
        for i in range(n):
            page.evaluate(SEEK, i * 1000 / FPS)
            enc.stdin.write(page.screenshot(type="jpeg", quality=92))
            if i % 300 == 0:
                print(f"frame {i}/{n}", flush=True)
        enc.stdin.close()
        enc.wait()
        print("video done", flush=True)
    b.close()
