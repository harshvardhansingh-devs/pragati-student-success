"""Capture crisp app screenshots for the promo video from the local Prajna server."""
import json
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)


def session(email):
    req = urllib.request.Request(f"{BASE}/api/v1/auth/login", data=json.dumps({"email": email, "password": "Prajna@2026"}).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.dumps(json.load(urllib.request.urlopen(req)))


def shoot(ctx, path, name, before=None, scroll_text=None, wait=2500):
    page = ctx.new_page()
    page.goto(f"{BASE}{path}")
    page.wait_for_timeout(wait)
    if before:
        before(page)
    if scroll_text:
        page.get_by_text(scroll_text, exact=False).first.evaluate("e => e.scrollIntoView({block: 'start'})")
        page.evaluate("window.scrollBy(0, -80)")
        page.wait_for_timeout(700)
    page.evaluate("() => document.getElementById('__cap')?.remove()")
    page.screenshot(path=str(OUT / f"{name}.png"))
    page.close()
    print("captured", name, flush=True)


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    admin = session("admin@prajna.demo")
    ctx = b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1.25, color_scheme="light")
    ctx.add_init_script(f"localStorage.setItem('prajna.session', {json.dumps(admin)})")
    shoot(ctx, "/", "overview")
    shoot(ctx, "/students/CS22-0155", "student360")
    shoot(ctx, "/students/CS22-0155", "drivers", scroll_text="Domain profile vs cohort")

    def whatif(page):
        page.get_by_text("What-if simulator").first.evaluate("e => e.scrollIntoView({block: 'center'})")
        page.locator("input[type=range]").nth(4).focus()
        for _ in range(32):
            page.keyboard.press("ArrowRight")
        page.wait_for_timeout(1500)
        page.get_by_text("Recommended interventions").first.evaluate("e => e.scrollIntoView({block: 'start'})")
        page.evaluate("window.scrollBy(0, -380)")
        page.wait_for_timeout(600)
    shoot(ctx, "/students/CS22-0155", "whatif", before=whatif)
    shoot(ctx, "/segments", "segments")

    def ask(page):
        page.get_by_role("button", name="3rd-year CSE students with CGPA above 8 but coding below 40").click()
        page.get_by_text("Tools used:").wait_for(timeout=40000)
        page.wait_for_timeout(500)
    shoot(ctx, "/copilot", "copilot", before=ask)
    shoot(ctx, "/data", "data")
    ctx.close()

    # dark-mode overview for variety
    dctx = b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1.25, color_scheme="dark")
    dctx.add_init_script(f"localStorage.setItem('prajna.session', {json.dumps(admin)})")
    shoot(dctx, "/at-risk?tab=placement", "atrisk_dark")
    dctx.close()

    # phones: login + student's own view
    mctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2.5, is_mobile=True, has_touch=True, color_scheme="light")
    shoot(mctx, "/login", "phone_login")
    mctx.close()
    sctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2.5, is_mobile=True, has_touch=True, color_scheme="light")
    sctx.add_init_script(f"localStorage.setItem('prajna.session', {json.dumps(session('student@prajna.demo'))})")
    shoot(sctx, "/", "phone_student")
    sctx.close()
    b.close()
