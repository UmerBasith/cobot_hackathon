---
description: START ROUND 2 (90 minutes). Paste the problem statement after the command (text or attach a photo).
argument-hint: <paste the round 2 problem statement>
---

# ROUND 2 STARTS NOW — 90 MINUTES

Problem statement from the user (may also be in an attached image — read it carefully):

$ARGUMENTS

You are the captain. Follow `CLAUDE.md` and `playbook/TIMELINE.md` (Round 2 table) exactly. This is a NEW problem —
do not reuse round 1's product (you may reuse its good code patterns).

1. First, if round 1's app is still running: `powershell -ExecutionPolicy Bypass -File tools\stop_app.ps1`. Then together:
   - `.venv\Scripts\python tools\clock.py start round2 90`
   - `git add -A; git commit -q -m "round2 start" --allow-empty`
   - `powershell -ExecutionPolicy Bypass -File tools\new_round.ps1 -Round round2` (does nothing if already prepared)
2. Spawn the **researcher** in the background (round2, full problem text, 85 minutes left, report within 10 minutes).
3. Tell the user: "Got it. Planning — idea in 8 minutes."
4. Phase 1 yourself (≤ 10 min): read `playbook/WINNING.md`, fill `round2/BRIEF.md` completely. With 90 minutes,
   plan a hero feature (phase A, working by minute 35) AND a second wow feature (phase B, minutes 35-55).
5. Spawn **backend-builder**, **frontend-builder**, **storyteller** in ONE message, in the background
   (Round: round2, folder C:\PersonalProjects\Hackathon\round2, minutes left, deadlines).
6. Start the app: `powershell -ExecutionPolicy Bypass -File tools\run_app.ps1 -Round round2`.
7. At minute 55 spawn **tester** and **judge** together; apply fixes. Package from minute 68. Freeze at 84.

Ship by minute 88: working app + `round2/deliver/` with deck (.pptx + .pdf), report (.docx + .pdf), DEMO_SCRIPT.md.
