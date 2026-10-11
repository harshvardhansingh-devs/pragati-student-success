"""Record the Prajna demo video: drives Chrome through the demo, burns in captions, adds TTS narration, outputs MP4.

Usage: videoenv/Scripts/python make_video.py <base_url> <out_dir>
"""
import json
import subprocess
import sys
import time
import wave
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1600, 900
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# (scene id, on-screen caption, narration)
SCENES = [
    ("title", "Prajna · Student Success Intelligence",
     "This is Prajna, an AI powered student success platform, built for the KPMG and byteXL HacXLerate challenge."),
    ("login", "One platform for every role",
     "Colleges keep student data in seven disconnected systems. Prajna unifies them, and tells every role who needs help, why, and what to do next. Let's sign in as the principal."),
    ("overview", "The whole institution in one sentence",
     "The overview sums up the institution in one sentence. Four hundred and four students are at high risk, and sixty one are sliding fast. Every number is clickable."),
    ("action", "Action Center: four decisions for this week",
     "The action center turns findings into four decisions for this week, such as students below the seventy five percent attendance rule."),
    ("insights", "Key trends and AI insights across all sources",
     "Key trends track the student success score every week. AI insights cross check all sources. For example, students who skip LMS assignments are five times more likely to be at academic risk."),
    ("atrisk", "At-risk flags: ML model + campus rules",
     "The at risk view combines a machine learning model with campus rules. Every flag shows its probability and its main reason."),
    ("student", "Student 360: every source, one explainable profile",
     "Student three sixty brings every source into one profile. The success score is explainable. Placement risk is high because of a coding score of zero and no mock interviews."),
    ("whatif", "What-if simulator: find the target",
     "The what if simulator finds the target. If coding improves, the placement risk drops."),
    ("assign", "One click: insight becomes a tracked action",
     "One click turns the recommendation into a tracked intervention, with an owner and a due date."),
    ("brief", "AI mentor brief (the AI never sees names)",
     "The AI mentor brief prepares the meeting in seconds. The AI only sees I D's and numbers, never names."),
    ("segments", "Six segments, each with a playbook",
     "Clustering finds six student segments, each with a playbook. Two hundred and eighty academic stars who are not placement ready get a coding bootcamp, in one click."),
    ("copilot", "AI Copilot: ask in plain English",
     "The AI copilot answers plain English questions, using our analytics tools, within the user's permissions."),
    ("data", "Data integration you can see",
     "Data integration is visible. One hundred and eighteen thousand rows from seven sources, over six thousand I D's reconciled, and a thousand duplicates removed."),
    ("studentview", "Students see their own progress",
     "Students get their own view, with their progress, a goal simulator, and AI study tips, in supportive wording. It works on any device."),
    ("outro", "Integrate · Score · Predict · Explain · Act",
     "Prajna. Integrate, score, predict, explain, and act. Live now, and ready for real campus data. Thank you."),
]

# ---------- 1. narration (Windows SAPI) ----------
def tts(text, path):
    ps = ("Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
          "$s.SelectVoice('Microsoft Zira Desktop'); $s.Rate = 0; "
          f"$s.SetOutputToWaveFile('{path}'); $s.Speak(@'\n{text}\n'@); $s.Dispose()")
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()

durs = {}
for sid, _, text in SCENES:
    durs[sid] = tts(text, OUT / f"{sid}.wav")
print("narration seconds:", {k: round(v, 1) for k, v in durs.items()}, "total", round(sum(durs.values()), 1), flush=True)

# ---------- 2. screen recording ----------
CAPTION_JS = """(text) => {
  let el = document.getElementById('__cap');
  if (!el) { el = document.createElement('div'); el.id = '__cap'; document.body.appendChild(el); }
  el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;max-width:80%;'
    + 'background:rgba(15,27,45,.88);color:#fff;font:600 22px Inter,system-ui,sans-serif;padding:12px 22px;border-radius:14px;'
    + 'box-shadow:0 8px 30px rgba(0,0,0,.25);text-align:center;pointer-events:none';
  el.textContent = text;
}"""
CARD_HTML = """<html><head><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:linear-gradient(120deg,#1c5cab,#2a78d6 45%,#4a3aa7);font-family:Inter,sans-serif;color:#fff">
<div style="text-align:center">
<svg width="140" height="140" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a78d6"/><stop offset="1" stop-color="#4a3aa7"/></linearGradient></defs>
<rect width="48" height="48" rx="12" fill="url(#g)" stroke="#fff" stroke-opacity=".35"/><rect x="9" y="28" width="7" height="10" rx="2" fill="#fff" opacity=".75"/>
<rect x="20.5" y="21" width="7" height="17" rx="2" fill="#fff" opacity=".88"/><rect x="32" y="17" width="7" height="21" rx="2" fill="#fff"/>
<path d="M35.5 3.5 Q36.6 9 41.5 10 Q36.6 11 35.5 16.5 Q34.4 11 29.5 10 Q34.4 9 35.5 3.5 Z" fill="#ffd66b"/></svg>
<div style="font-size:84px;font-weight:700;margin-top:18px">Prajna</div>
<div style="font-size:30px;opacity:.9;margin-top:8px">%SUB%</div>
<div style="font-size:22px;opacity:.75;margin-top:28px">%FOOT%</div>
</div></body></html>"""

marks = {}
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    ctx = browser.new_context(viewport={"width": W, "height": H}, record_video_dir=str(OUT / "raw"), record_video_size={"width": W, "height": H},
                              color_scheme="light")
    page = ctx.new_page()
    t0 = time.monotonic()

    def scene(sid, caption, actions):
        start = time.monotonic()
        marks[sid] = start - t0
        actions()
        try:
            page.evaluate(CAPTION_JS, caption)
        except Exception:
            pass
        rest = durs[sid] + 0.7 - (time.monotonic() - start)
        if rest > 0:
            page.wait_for_timeout(int(rest * 1000))

    def smooth_scroll_to(selector_text):
        page.get_by_text(selector_text, exact=False).first.scroll_into_view_if_needed()
        page.wait_for_timeout(400)

    def nav(path):
        page.evaluate("p => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }", path)
        page.wait_for_timeout(1800)

    scene("title", SCENES[0][1], lambda: page.set_content(CARD_HTML.replace("%SUB%", "Student Success Intelligence").replace("%FOOT%", "KPMG × byteXL HacXLerate 2026")))
    def login():
        page.goto(f"{BASE}/login"); page.wait_for_timeout(1500)
    scene("login", SCENES[1][1], login)
    # click inside the scene so the viewer sees the sign-in happen
    page.get_by_text("Principal / Admin").first.click(); page.wait_for_timeout(2500)
    scene("overview", SCENES[2][1], lambda: page.wait_for_timeout(300))
    scene("action", SCENES[3][1], lambda: smooth_scroll_to("Action center"))
    scene("insights", SCENES[4][1], lambda: smooth_scroll_to("AI insights"))
    scene("atrisk", SCENES[5][1], lambda: (nav("/at-risk?tab=placement")))
    scene("student", SCENES[6][1], lambda: (nav("/students/CS22-0155")))

    def whatif():
        smooth_scroll_to("What-if simulator")
        handle = page.locator("input[type=range]").nth(4)  # Coding score slider
        handle.focus()
        for _ in range(32):
            page.keyboard.press("ArrowRight")
        page.wait_for_timeout(1200)
    scene("whatif", SCENES[7][1], whatif)

    def assign():
        smooth_scroll_to("Recommended interventions")
        page.get_by_role("button", name="Assign").first.click(); page.wait_for_timeout(700)
        page.locator("div.bg-accent-soft").get_by_role("button", name="Assign").click(); page.wait_for_timeout(1200)
    scene("assign", SCENES[8][1], assign)

    def brief():
        smooth_scroll_to("AI mentor brief")
        page.get_by_role("button", name="Generate").click()
        page.get_by_text("Source:").wait_for(timeout=40000)
    scene("brief", SCENES[9][1], brief)

    def segments():
        nav("/segments")
        page.get_by_role("button", name="Assign playbook to all").nth(1).click()
        page.wait_for_timeout(1500)
    scene("segments", SCENES[10][1], segments)

    def copilot():
        nav("/copilot")
        page.get_by_role("button", name="3rd-year CSE students with CGPA above 8 but coding below 40").click()
        page.get_by_text("Tools used:").wait_for(timeout=40000)
    scene("copilot", SCENES[11][1], copilot)
    scene("data", SCENES[12][1], lambda: nav("/data"))

    def student_view():
        page.evaluate("() => localStorage.removeItem('prajna.session')")
        page.goto(f"{BASE}/login"); page.wait_for_timeout(1200)
        page.get_by_text("My own progress, goals and AI study tips").click(); page.wait_for_timeout(2500)
    scene("studentview", SCENES[13][1], student_view)
    scene("outro", SCENES[14][1], lambda: page.set_content(CARD_HTML.replace("%SUB%", "Integrate · Score · Predict · Explain · Act")
                                                           .replace("%FOOT%", "prajna-w5i3.onrender.com  ·  github.com/Natural-navya/Prajna")))
    page.wait_for_timeout(800)
    video_path = page.video.path()
    ctx.close()
    browser.close()

print("scene starts (s):", {k: round(v, 1) for k, v in marks.items()}, flush=True)

# ---------- 3. mux narration onto the recording ----------
inputs = ["-i", str(video_path)]
filters = []
for i, (sid, _, _) in enumerate(SCENES, start=1):
    inputs += ["-i", str(OUT / f"{sid}.wav")]
    ms = int(marks[sid] * 1000) + 250
    filters.append(f"[{i}:a]adelay={ms}|{ms}[a{i}]")
mix = "".join(f"[a{i}]" for i in range(1, len(SCENES) + 1)) + f"amix=inputs={len(SCENES)}:normalize=0[aout]"
out = OUT / "Prajna_demo.mp4"
cmd = [FFMPEG, "-y", *inputs, "-filter_complex", ";".join(filters + [mix]), "-map", "0:v", "-map", "[aout]",
       "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
       "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)]
subprocess.run(cmd, check=True, capture_output=True)
print("wrote", out, flush=True)
json.dump({"durations": durs, "marks": marks}, open(OUT / "timing.json", "w"), indent=1)
