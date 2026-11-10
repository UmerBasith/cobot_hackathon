# ResQNet — Round 1 demo script (3 minutes, website only)

**Before judges arrive**
- `git pull` → `cd round1\frontend; npm install` (first time only, needs internet) → `powershell -ExecutionPolicy Bypass -File tools\run_app.ps1 -Round round1`
- Open 2 Chrome windows: **A** = http://localhost:5173 (laptop size) · **B** = http://localhost:5173/report in phone size (F12 → device toolbar → iPhone).
- Click **Reset demo data** if you tested before (or `POST /api/reset` from http://localhost:8000/docs).
- Check the map loads (OpenFreeMap needs internet; without it a built-in Chennai map appears automatically).

**Roles:** Umer talks · Muizzur clicks.

| Time | Say | Click |
|---|---|---|
| 0:00 | "During floods and fires, reports arrive from everywhere and control rooms can't see what is most urgent. ResQNet fixes that: report in seconds, severity decided by clear rules, every incident tracked until it's resolved." | Window A: landing page hero |
| 0:25 | "Severity is not a black box. Watch: a flood, 5 people… now someone is **trapped** — it jumps to **Critical**, and it tells you exactly why." | Scroll to the live severity demo, toggle "trapped" |
| 0:50 | "A citizen reports from a phone. Picture tiles, a few taps, no login. And Call 112 is always one tap away — we support 112, we don't replace it." | Window B: **Building Collapse** → trapped **Yes** → tap **Velachery** on map → people 6 → Submit |
| 1:20 | "Reference number, **Critical**, with the reasons: trapped +35, rule R1." | Show ✅ confirmation |
| 1:30 | "Control room: total, critical, pending, resolved, and incidents by category — live. The new collapse is already at the top, red and pulsing on the map." | Window A: **Open control room** → dashboard |
| 1:55 | "Every incident shows its score, reasons, and full details." | Click the new incident |
| 2:10 | "Admin moves it: Pending → In Progress → Resolved. Every change is in the timeline with time and note." | Click the status buttons |
| 2:30 | "Duplicate or test reports? Mark as duplicate, or delete with confirmation." | Incidents list → mark one as duplicate / delete a test |
| 2:45 | "Rules decide severity, humans manage, every incident is tracked to resolution. 20 automated tests check every rule. Next round: dispatching the right teams." | Back to dashboard |

## Numbers you can say (all real)
- **20 automated tests pass** (every severity rule + API: create, status, duplicate, delete, validation).
- **4 severity levels, 8 categories, 4 statuses** — exactly the brief, plus Gas Leak & Electrical Hazard.
- Score 0–100 from 5 factors: Life threat (35) · Hazard (25) · Exposure (20) · Vulnerable people (10) · Time-critical (6). Highest possible: 96.

## Likely judge questions
| Question | Answer |
|---|---|
| How is severity decided? | Points for life threat, hazard size, people exposed, vulnerable people, and how fast it worsens. Then safety rules: trapped / not breathing → always Critical; 5+ injured → Critical; active fire or gas → at least High; any injury → at least Medium. Every point is shown as a reason. |
| Why not AI? | In emergencies you must explain decisions. Rules are transparent and testable; AI can suggest later, but never decide alone. |
| Fake reports? | Very short descriptions are flagged "needs verification" — but priority is never lowered, because missing a real emergency is worse. Admin can mark duplicates or delete tests. |
| What if the internet fails? | Runs on one laptop. If the online map can't load, a built-in Chennai map takes over automatically. |
| Is the data real? | The 12 incidents are realistic demo data for Chennai (monsoon day). Coordinates are approximate. |
| How does it scale? | Production design: PostgreSQL + PostGIS, a queue for spikes, CDN for the citizen page. Today: FastAPI + SQLite on one laptop. |
| What's next? | Round 2: right-team dispatch, responder app, duplicate linking, escalation alarms, alerts to citizens. |
| Privacy? | Contact info is optional and only visible to the control room. |
