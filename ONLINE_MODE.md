# ONLINE MODE (claude.ai/code in the browser) — read this if you are NOT on the laptop's desktop app

In a cloud session Claude works on a **Linux server**, not on your laptop. That changes 3 things:

| Thing | Desktop app (laptop) | Online (cloud) |
|---|---|---|
| Setup | already done | Claude runs `bash tools/setup.sh` first (2-4 min) |
| Start/stop app | `tools\run_app.ps1` / `stop_app.ps1` | `bash tools/run_app.sh round1` / `bash tools/stop_app.sh` |
| PowerPoint/Word checks, PDFs, slide PNGs (`export_office.ps1`) | works | **not available** (no Office on Linux). The .pptx and .docx are still built correctly by `make_deck.py` / `make_doc.py`. Make PDFs on the laptop (open file → Save as PDF). |
| Screenshots (`screenshot.ps1`) | works | try `npx playwright screenshot --viewport-size=1600,1000 "http://localhost:5173/app?shot=1" round1/deck/shots/app.png` (first run downloads a browser). If that fails, skip the image slide's screenshot and take it on the laptop. |
| **The live demo for judges** | runs on the laptop | **must run on the laptop** — the cloud server is not reachable from the judges' screen |

## The online workflow (Claude follows this)
1. Start of round: `bash tools/setup.sh` (only first time), then the normal `/round1` / `/round2` flow from CLAUDE.md,
   using the `.sh` scripts and `.venv/bin/python` instead of `.venv\Scripts\python`.
2. Commit + push often (every milestone): `git add -A && git commit -m "..." && git push`.
3. Build deck + report into `<round>/deliver/` and **push them**.
4. At the end tell the user exactly these laptop steps:

## Laptop steps at the end of each round (the user does this, ~2 minutes)
Open a terminal in `C:\PersonalProjects\Hackathon` and run:
```
git pull
powershell -ExecutionPolicy Bypass -File tools\run_app.ps1 -Round round1
```
Then open http://localhost:5173 in Chrome, and open `round1\deliver\*.pptx` in PowerPoint (F5).
If `npm` packages changed, run `cd round1\frontend; npm install` first.

**Best option if possible:** log in to the **Claude desktop app** with the new account and open the
`C:\PersonalProjects\Hackathon` folder — then everything (Office checks, screenshots, local demo) works as tested.
