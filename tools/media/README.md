# Media generators (demo video, promo video, pitch deck)

These scripts produced the files in `submission/`, which is git-ignored. Run them against a **local** server so the demo clicks (assigning interventions) never write to the live database.

## One-time setup (separate venv; keeps the app's dependencies clean)
```bash
python -m venv tools/media/.venv
tools/media/.venv/Scripts/pip install playwright imageio-ffmpeg numpy      # macOS/Linux: .venv/bin/pip
# Uses your installed Google Chrome (channel="chrome"); otherwise run: python -m playwright install chromium
```
Start the app locally first (see `handbook/RUNBOOK.md`), on SQLite, on port 8000.

## 1. Demo video (`demo_video.py`, ~2:42, narrated + captions)
```bash
tools/media/.venv/Scripts/python tools/media/demo_video.py http://localhost:8000 tools/media/video_out
```
- Drives Chrome through 15 scenes (`SCENES` list: id, caption, narration) and records it.
- Narration uses Windows SAPI ("Microsoft Zira Desktop"), so it's **Windows-only**. On other OSes, replace `tts()` with any text-to-speech.
- Before recording, clear local test interventions so on-screen counts start at 0:
  `python -c "import sqlite3;c=sqlite3.connect('backend/pragati.db');c.execute('delete from app_interventions');c.commit()"`
- To change the links on the closing card, edit the `%FOOT%` text in the `outro` scene.

## 2. Promo video (`promo/`, 70 s, 1080p, music)
```bash
cd tools/media/promo
../.venv/Scripts/python capture.py http://localhost:8000 shots     # fresh app screenshots (desktop, dark, phones)
../.venv/Scripts/python render.py stills 16,46.5,52,68            # optional: check single frames in stills/
../.venv/Scripts/python render.py video                           # -> promo_silent.mp4 (frame-by-frame, deterministic)
../.venv/Scripts/python music.py                                  # -> score.wav (original synthesized track, no copyright)
# mux (ffmpeg path: python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
ffmpeg -i promo_silent.mp4 -vf "scale=in_range=pc:out_range=tv,format=yuv420p" -color_range tv -c:v libx264 -crf 18 -an promo_tv.mp4
ffmpeg -i promo_tv.mp4 -i score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart Prajna_promo.mp4
```
- `promo.html` is one timeline: every `animation-delay` is an **absolute time in seconds**. To move a scene, shift its delays.
- The links live in two places in `promo.html`: the first feature's browser bar and the end card.
- The music is timed to the timeline (logo impact at 7.6 s, pillar chimes at 56.3–58.7 s, end impact at 63.2 s). If you retime scenes, update `music.py`.

## 3. Pitch deck (`deck/`, 12 slides, .pptx)
```bash
cd tools/media/deck
npm init -y && npm install pptxgenjs@3.12.0
node icons.mjs > icons.json          # run from frontend/ (uses the app's lucide-react): cd ../../../frontend && node ../tools/media/deck/icons.mjs > ../tools/media/deck/icons.json
../.venv/Scripts/python assets.py    # backgrounds, logo, white/blue icon PNGs -> assets/
node build.js                        # -> Prajna_Pitch_Deck.pptx (needs ../promo/shots from capture.py)
```
- The links are the `LIVE` and `REPO` constants at the top of `build.js`.
- The `[Team name]` and `[Member …]` placeholders are on slide 1 (the cover).
- Optional: set `SKILL_DIR` to an Anthropic pptx skill to apply the theme colours. It works fine without it.
- Visual check on Windows: open the file in PowerPoint, or export slides with PowerPoint COM (`$slide.Export(path,"PNG",1600,900)`).
