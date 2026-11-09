---
description: EMERGENCY - stop building now and ship deck + report + demo script from whatever works. Use when time is almost up.
argument-hint: [round1|round2]
---

EMERGENCY FINALIZE for $ARGUMENTS (if empty, the round with the newest `.clock.json`).

1. Tell every running agent (SendMessage) to stop feature work immediately and report what is done. Builders: leave the
   app in a working state (revert the last change if it broke something).
2. Make sure the app runs: `tools\run_app.ps1 -Round <round>` if needed. Hide any broken page from the nav.
3. If `<round>/deck/deck.json` doesn't exist or is incomplete: write it yourself now from BRIEF.md using
   `tools/deck_example.json` as the pattern (10 slides, real numbers only, screenshot of the working page).
4. Build deck + report, export PDFs (commands in CLAUDE.md "Tools"), quick look at the slide PNGs.
   A 4-page report is fine in an emergency.
5. Write `<round>/deliver/DEMO_SCRIPT.md` (short: 6 steps + 5 Q&A).
6. Tell the user in 5 lines: files are in `<round>/deliver/`, open http://localhost:5173/<best page>, the 3 clicks,
   the 3 numbers to say.
Target: everything done in 6 minutes.
