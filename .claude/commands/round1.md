---
description: START ROUND 1 (50 minutes). Paste the problem statement after the command (text or attach a photo).
argument-hint: <paste the round 1 problem statement>
---

# ROUND 1 STARTS NOW — 50 MINUTES

Problem statement from the user (may also be in an attached image — read it carefully):

$ARGUMENTS

You are the captain. Follow `CLAUDE.md` and `playbook/TIMELINE.md` (Round 1 table) exactly. Do this now, fast:

1. Run these together:
   - `.venv\Scripts\python tools\clock.py start round1 50`
   - `git add -A; git commit -q -m "round1 start" --allow-empty`
   - `powershell -ExecutionPolicy Bypass -File tools\new_round.ps1 -Round round1` (does nothing if already prepared)
2. Spawn the **researcher** agent in the background (round1, the full problem text, 44 minutes left, report within 6 minutes).
3. Tell the user in one line: "Got it. Planning — idea in 5 minutes."
4. Phase 1 yourself (≤ 5 min): read `playbook/WINNING.md`, fill `round1/BRIEF.md` completely (problem pasted in §0,
   3 scored ideas, chosen product, pages, exact API contract, data/model, demo script, owners).
5. Spawn **backend-builder**, **frontend-builder** and **storyteller** in ONE message, in the background, each with:
   "Round: round1. Folder: C:\PersonalProjects\Hackathon\round1. Minutes left: <N>. Read round1/BRIEF.md first,
   then your agent file. Report back within <M> minutes." (backend/frontend: first working version within 12 minutes).
6. Start the app: `powershell -ExecutionPolicy Bypass -File tools\run_app.ps1 -Round round1`.
7. Continue with phases 2-5. Check the clock at every phase change. Status line to the user at each phase.

Ship by minute 48: working app + `round1/deliver/` with deck (.pptx + .pdf), report (.docx + .pdf), DEMO_SCRIPT.md.
