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
| 2:45 | "Rules decide severity, humans manage, every incident is tracked to resolution. 24 automated tests check every rule. Next round: dispatching the right teams." | Back to dashboard |

## Numbers you can say (all real)
- **24 automated tests pass** (every severity rule + API: create, status, duplicate, delete, validation, dispatch, responder, alerts, simulate).
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

---

# Round 2 demo add-on (same app — extra 2 minutes)

Extra windows: **C** = http://localhost:5173/responder?team=ALS-VLC (phone size).
Before: click **Reset** on the dashboard.

| Time | Say | Click |
|---|---|---|
| 0:00 | "Round 1 told us *what* is urgent. Round 2 sends the *right* team." | `/app/incidents/INC-1012` (rooftop family, Velachery) |
| 0:15 | "For a rooftop flood it needs a rescue boat and an ambulance — matched by skill first, then arrival time. Boat 3 minutes, ALS ambulance 3 minutes." | **Dispatch** card → **Assign all suggested** |
| 0:35 | "The ambulance crew gets it on their phone with the reasons." | Window C: **Accept** → **En route** → **On scene** |
| 0:55 | "If a team can't go, they reject with a reason and the next best team is suggested." | (optional) assign a second team, **Reject** → "No equipment" → back on detail, next suggestion shows |
| 1:10 | "Now the flood gets worse." | Dashboard → **Simulate flood** |
| 1:20 | "8 new reports. The red escalation banner fires: critical incidents with no team for over 2 minutes." | Point at escalation banner |
| 1:30 | "Three people reported the same rooftop. We link them — 3 reports, more confidence, the score goes up." | INC-1012 → **Possible duplicates** → **Link as duplicate** |
| 1:45 | "Warn the public: alert to Velachery. Every citizen opening the report page sees it." | `/app/alerts` → area Velachery → Publish → window B `/report` shows banner |
| 2:00 | "Responder finishes with a note, admin resolves. Every step is in the timeline." | C: **Completed** + note → detail: **Resolve** → timeline |

## Round 2 numbers (real)
- 13 response teams (fire ×4, ALS ×2, BLS ×2, police ×2, NDRF ×1, boat ×2) across Chennai.
- ETA = 2 min mobilisation + distance ÷ speed (road 25 km/h, boat 20 km/h). Straight-line distance — say "estimated".
- Escalation: Critical with no team > 2 min, High > 5 min, team not accepting > 1 min, any team type fully busy.
- Duplicate = related type + within 500 m + within 60 min. Each linked report +3 points; 3+ reports → one level up (R8).

## Round 2 judge questions
| Question | Answer |
|---|---|
| Why not just the nearest team? | Skill first (boat for flood, NDRF for collapse), then arrival time. The nearest fire engine is useless for a rooftop flood. |
| What if nobody is free? | Escalation banner + "resource shortage" warning; admin sees other candidates further away. |
| Can the system assign by itself? | It suggests; a human approves with one click. Rules decide priority, humans decide action. |
| Live tracking? | Today status updates (en route / on scene). Production: GPS from the responder phone + WebSockets. |
