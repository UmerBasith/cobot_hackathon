---
description: Full practice run on a sample problem (uses a 'practice' folder, real timer). Use the night before to test the whole system.
argument-hint: [minutes, default 50] [optional custom problem]
---

PRACTICE RUN. Treat it exactly like a real round, but in the folder `practice` (not round1/round2).

Arguments: $ARGUMENTS  (first number = minutes, default 50; any text after it = the problem; if no problem given,
pick one at random from the list below).

Sample problems (robotics/AI themed like Cobot-Ex):
1. "Design a smart system that helps a small factory decide which machines need maintenance before they break down."
2. "Build a solution that plans safe, efficient paths for multiple warehouse robots working alongside humans."
3. "Create a platform that helps farmers decide when and how much to irrigate using sensor and weather data."
4. "Develop a tool that detects and prioritises safety incidents on a construction site from reported data."
5. "Build an AI assistant that helps students identify weak topics and plan their exam preparation."

Steps:
1. `powershell -ExecutionPolicy Bypass -File tools\new_round.ps1 -Round practice -Force`
2. `.venv\Scripts\python tools\clock.py start practice <minutes>`
3. Then follow `.claude/commands/round1.md` steps 2-7 but with `practice` instead of `round1` everywhere.
4. At the end write `practice/RETRO.md`: timeline actual vs plan, what broke, what to change in the playbook/tools/
   agents. Then propose the concrete edits to the user (do not change kit/ or tools/ without saying so).
