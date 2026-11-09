---
description: Show where the current round stands (time left, phase, what's done, what's next) in 6 lines.
argument-hint: [round1|round2]
---

Run `.venv\Scripts\python tools\clock.py $ARGUMENTS` (if no round given, use the round whose `.clock.json` is newest).
Check which agents are still working, whether the app responds (`http://127.0.0.1:8000/api/health`, `http://127.0.0.1:5173`),
and what is in `<round>/deliver/`.

Answer the user in at most 6 short lines: time left · current phase · what works now · what is in progress ·
what is next · any risk. If behind schedule, apply the CUT rules from `playbook/TIMELINE.md` right away and say which.
