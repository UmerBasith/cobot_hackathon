# ResQNet — Emergency Response & Disaster Management Platform

**Team Ctrl.Alt.Elite** (Umer Basith, Muizzur Rahman) · Code Clash 2026 · Crescent Institute, Chennai

> *From report to rescue — ResQNet ranks every emergency with explainable rules, sends the **right** team (not just the nearest), and keeps working when networks fail. Its innovations dispatch by **survival**, turn trained citizens into first responders, accept reports by **SMS** and **voice in Tamil**, and **predict** where help will be needed before people call.*

![Citizen home](docs/screenshots/c-home-d.png)

---

## Contents
1. [Quick start](#1-quick-start)
2. [Round 1 — every required feature and where it is](#2-round-1--emergency-incident-reporting--monitoring)
3. [Round 2 — every required feature and where it is](#3-round-2--intelligent-coordination)
4. [Innovations — what makes ResQNet different](#4-innovations--what-makes-resqnet-different)
5. [Architecture](#5-architecture)
6. [API reference](#6-api-reference)
7. [Testing & quality](#7-testing--quality)
8. [Honest limits & what's next](#8-honest-limits--whats-next)

---

## 1. Quick start

```bash
# Backend (FastAPI) — from round1/backend
python -m venv ../../.venv && ../../.venv/bin/pip install -r requirements.txt
../../.venv/bin/python -m uvicorn app.main:app --port 8000

# Frontend (React + Vite + Tailwind) — from round1/frontend
npm install && npm run dev        # http://localhost:5173

# Or both at once:  bash tools/run_app.sh round1   (Windows: tools\run_app.ps1 -Round round1)
```

| Who | URL | Demo sign-in |
|---|---|---|
| Citizen | `/` · `/report` · `/track` · `/services` · `/alerts` · `/sms` · `/hero` | none (no login for citizens) |
| Control room | `/admin` | ID `admin` · PIN `1111` |
| Field responder | `/responder` | pick a team · PIN `2222` |

API docs (Swagger): `http://localhost:8000/docs` · Health + active database: `/api/health`

**Storage:** Supabase (Postgres via `DATABASE_URL`, or the Supabase Data API via `SUPABASE_URL` + `SUPABASE_SECRET_KEY` in the git-ignored `round1/backend/.env`; schema in [`round1/backend/supabase_schema.sql`](round1/backend/supabase_schema.sql), RLS enabled). If Supabase is unreachable the backend **falls back to SQLite automatically**, so the platform never stops.

---

## 2. Round 1 — Emergency Incident Reporting & Monitoring

| # | Required by the brief | What we built | Where |
|---|---|---|---|
| 1 | **Reporting form**: title, description, category, location, people affected, optional contact | 4-step mobile flow (Details → Location → Info → Confirm). Title is auto-suggested ("Fire at T. Nagar") and editable; description is validated (10+ characters); location comes from **live GPS**, a map tap or an area list; people affected and injured use +/− steppers; contact is optional with a **"Report anonymously"** switch; optional photo evidence (compressed on the phone) | `frontend/src/sections/ReportFlow.tsx`, `POST /api/incidents` |
| 2 | **Categories**: Fire, Road Accident, Medical, Flood, Building Collapse, Other | All 6, plus **Landslide, Power outage / Electrical, Gas leak** (9 picture tiles, no reading needed) | `IncidentUI.tsx` `CATEGORY_META`, `schemas.py` `Category` |
| 3 | **Severity** Low / Medium / High / Critical by a logical mechanism | Deterministic **rules engine**: score = Life threat (35) + Hazard (25) + Exposure (20) + Vulnerable people (10) + Time-critical (6), plus **safety override rules** R1–R9 (e.g. *trapped / not breathing → always Critical*, *5+ injured → Critical*, *active fire or gas → at least High*). **Every point is shown as a reason** ("Unconscious / trapped +35 (R1)"). Live preview while typing | `backend/app/severity.py`, `POST /api/severity/preview` |
| 4 | **Dashboard**: total, critical, pending, resolved, by category | Command Centre tiles + incidents-by-category chart + severity donut + live map (critical incidents pulse) + escalation banner, refreshed every 5 s | `pages/Dashboard.tsx`, `GET /api/stats` |
| 5 | **Incident management**: view all, open details, update status, delete test / duplicate reports | Searchable, filterable ranked list; detail page with reasons, timeline and audit; status workflow with notes; **mark as duplicate** (the duplicate becomes a confirming witness and raises the main incident's score); **delete with confirmation** | `pages/Incidents.tsx`, `pages/IncidentDetail.tsx`, `PATCH /status`, `POST /duplicate`, `DELETE` |
| 6 | **UI/UX**: professional, responsive, critical highlighted | React + **Tailwind CSS**, tested at 390 px phone and 1440 px desktop with no sideways scrolling; critical incidents red and pulsing; colour is never the only signal (icon + label too); light and dark mode | whole `frontend/` |

**Statuses:** Reported → Pending → **Assigned** → In Progress → Resolved (every change is timestamped in the timeline).

![Report on mobile](docs/screenshots/r-m1.png) ![Incident detail](docs/screenshots/r2-admin_incidents_INC-1010.png)

---

## 3. Round 2 — Intelligent Coordination

| # | Required by the brief | What we built | Where |
|---|---|---|---|
| 1 | **Intelligent prioritisation** by severity, people affected, **time since reporting**, category | `priority_score` = rules severity score (people, category, life threat, hazard, vulnerability) **+ waiting bonus** (+1 per 2 minutes without a team, up to +10). The queue ranks by severity level, then priority score. The incident page shows the breakdown | `main.py` `with_priority`, `GET /api/incidents` |
| 2 | **Team management**: name/ID, category, current location, availability, assigned incident | Create / edit / delete teams; availability dropdown (available, busy, offline); station and coordinates; assigned incident link; team detail page with crew, vehicles, equipment, performance and history | `pages/Teams.tsx`, `pages/TeamDetail.tsx`, `POST/PATCH/DELETE /api/teams` |
| 3 | **Location-based assignment**: nearest **available and suitable** team using coordinates and distance | Haversine distance + ETA (2 min to mobilise + distance ÷ speed). **Skill matching first** (boat for a flood, NDRF for a collapse, ALS for cardiac), then arrival time. Top 3 per need, **"Auto-assign nearest suitable team"** in one click, reject → next best suggested | `backend/app/dispatch.py`, `GET /suggest`, `POST /auto-assign` |
| 4 | **Assignment & tracking**: Assigned / In Progress / Resolved, team details, busy/available | Assigning sets the incident to **Assigned** and the team to **busy**. The responder app moves accepted → en route → on scene → completed (closing note required) and frees the team. Citizens follow the same progress on `/track/:id` | `pages/Responder.tsx`, `POST /api/assignments/{id}/…`, `pages/Track.tsx` |
| 5 | **Route & location visualisation** | MapLibre map (CARTO Voyager / OpenFreeMap tiles) with incidents, teams and a **road route line** (OSRM) between each assigned team and its incident, plus distance and time. A **straight-line fallback** and a built-in offline SVG Chennai map are used when there's no internet | `sections/IncidentMap.tsx`, `lib/useRoutes.ts`, `GET /api/route` |
| 6 | **Advanced analytics**: total, critical, available teams, busy teams, assigned, resolved, by category | Live tiles for all of these, plus reported-vs-resolved per hour, hotspots by area, average time to assign and resolve, team utilisation and a team performance table | `pages/Analytics.tsx`, `GET /api/stats`, `GET /api/analytics` |

Also included: escalation alarms (Critical with no team > 2 min, High > 5 min, team not accepting, resource shortage), public safety **alerts** pushed to the citizen pages, a **"Simulate disaster"** burst for live demos, disaster **zones & shelter** capacity management, and a field **responder portal** (accept/reject with reason, navigate, escalate, field updates).

![Command centre](docs/screenshots/r2-admin.png)

---

## 4. Innovations — what makes ResQNet different

Most emergency apps stop at *report → dashboard → nearest team*. ResQNet adds five capabilities, each working end to end in this repo:

### 4.1 Golden Hour Engine — dispatch by **survival**, not by distance or severity
*Where:* `backend/app/golden.py`, `/admin/golden-hour`, survival chart on every incident.
- Each life-threatening incident gets a **survival profile**: survival = 95 % × 0.5^(minutes waiting ÷ half-life). The half-life depends on the condition (cardiac arrest ≈ 7 min, i.e. about 10 % per minute; trapped in fire 12; rising water 25; major trauma 60; under debris 10 h). CPR slows the fall (×3) and a team on scene stops it.
- Live **"lives at risk"** and **"lives lost per minute of delay"** counters; the queue can be ranked by lives lost per minute.
- **Dispatch plan:** when several emergencies compete for few teams, a greedy optimiser assigns teams to save the most expected lives, compared side by side with nearest-team-first. One click applies it.
- **Proof:** a seeded simulation (40 disaster bursts × 25 incidents, the same 13 teams) gives **≈ +31 % expected survivors (+8.2 lives per disaster)** versus nearest-first. *This is a simulation with simplified survival curves, labelled as such in the UI.*

![Golden Hour](docs/screenshots/final-gh.png)

### 4.2 CPR Hero Network — the closest responder is usually not in an ambulance
*Where:* `backend/app/heroes.py`, `/hero`, global popup in `sections/HeroLive.tsx`.
- Any citizen with the website open can opt in as a **CPR / first-aid trained hero**. Their phone checks in every 15 s with their location.
- A life-threat report **automatically alerts the 3 nearest heroes** (live users first). A **full-screen popup with sound and vibration** appears on whatever citizen page they have open.
- Hero flow: *I'm going → Navigate → Arrived → **CPR guide** (110 bpm metronome, 30:2 counter) → handed over to the ambulance*. When CPR starts, the incident's **survival curve visibly bends upward** for the control room.
- If nobody is within 3 km the search widens (up to 25 km); a decline alerts the next hero; the admin can send a specific hero by hand.

![Hero alert](docs/screenshots/p-popup.png) ![CPR guide](docs/screenshots/h-cpr.png)

### 4.3 Predictive Risk Radar — every other system reacts, ResQNet predicts
*Where:* `backend/app/risk.py`, `/admin/risk`.
- Risk score per Chennai area for the **next 6 hours** = 40 % forecast rain (live Open-Meteo data, no API key) × how flood-prone the area is (simplified index from the 2015/2023 floods) + 25 % live incident pressure + 15 % flood history + 20 % distance to the nearest free rescue unit.
- Recommends **pre-positioning** a boat or NDRF team before calls arrive, in one click. A "heavy rain" scenario switch allows demos on dry days.

![Risk radar](docs/screenshots/i-risk-d.png)

### 4.4 SMS fallback — works on a ₹1,000 feature phone with no data
*Where:* `backend/app/nlp.py`, `POST /api/sms`, `/sms` simulator.
- `FIRE TNAGAR 5 TRAPPED` becomes a real incident (Fire, T. Nagar, 5 people, life threat → **Critical**) and the sender gets a reply SMS with a tracking ID. It understands English, **Tamil script** and Tanglish. The gateway is simulated in the demo; production would plug in an SMS provider.

### 4.5 Speak to Report — in Tamil or English, no typing in panic
*Where:* `ReportFlow.tsx` + `lib/speech.ts` + `POST /api/parse`.
- Press the mic, speak naturally ("வேளச்சேரியில் வெள்ளம், குழந்தைகள் சிக்கி இருக்காங்க"). The transcript fills the form: category, area, people, life threat, injuries, vulnerable people. A **"please check"** banner with confidence is shown. If the area isn't spoken, **live GPS** fills it. A typed fallback runs the same parser.

![SMS](docs/screenshots/i-sms-m.png) ![Voice report](docs/screenshots/i-report-m.png)

### Design principles
- **Explainable:** rules decide severity and every point is visible; humans approve dispatch; nothing is a black box.
- **Resilient:** offline map fallback, SQLite fallback, SMS channel and mock-data fallbacks in the UI, so the demo can't go blank.
- **Inclusive:** picture tiles, Tamil voice, no login for citizens, and **Call 112** on every screen. ResQNet supports India's ERSS-112; it doesn't replace it.
- **Private:** contact details only reach the control room; anonymous reporting; heroes see distance, not identity; Supabase tables have RLS and no public policies.

---

## 5. Architecture

```
 Citizen phone / browser ──┐                       ┌── Supabase Postgres (RLS)  ← DATABASE_URL / Data API
 Responder phone ──────────┼──► React + Tailwind ──► FastAPI (/api) ──┤
 Control room laptop ──────┘    (Vite, MapLibre,     rules engine,    └── SQLite fallback (automatic)
 SMS gateway (simulated) ─────► recharts, motion)    dispatch, golden-hour,
                                                     heroes, risk, NLP
 External (optional, free, no key): Open-Meteo forecast · OSRM routing · CARTO / OpenFreeMap tiles
```

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, **Tailwind CSS v4**, MapLibre GL, Recharts, Motion, lucide icons |
| Backend | Python 3, **FastAPI**, Pydantic validation (bad input → 4xx, never a crash) |
| Data | Supabase Postgres / Supabase Data API, SQLite fallback; JSONB documents |
| Key modules | `severity.py` rules engine · `dispatch.py` skill + ETA matching · `golden.py` survival model and optimiser · `heroes.py` CPR network · `risk.py` radar · `nlp.py` SMS/voice parser |

---

## 6. API reference
All endpoints are under `/api` (51 routes; full interactive docs at `/docs`). Main ones:

| Area | Endpoints |
|---|---|
| Reporting | `POST /incidents` · `POST /severity/preview` · `POST /parse` · `POST /sms` · `GET /track/{id}` |
| Management | `GET /incidents` (ranked) · `GET/DELETE /incidents/{id}` · `PATCH /incidents/{id}/status` · `POST /incidents/{id}/duplicate` · `GET /stats` · `GET /analytics` |
| Dispatch | `GET /incidents/{id}/suggest` · `POST /incidents/{id}/assign` · `POST /incidents/{id}/auto-assign` · `GET /route` · `POST /assignments/{id}/respond` · `POST /assignments/{id}/status` · `GET /responder/{team}` · `GET /escalations` |
| Teams | `GET/POST /teams` · `PATCH/DELETE /teams/{id}` |
| Innovation | `GET /golden-hour` · `POST /golden-hour/apply` · `GET /golden-hour/simulation` · `GET /incidents/{id}/survival` · `POST /hero/live` · `GET /hero/{id}` · `POST /hero/{id}/respond` · `POST /incidents/{id}/heroes/alert` · `GET /risk` · `POST /risk/preposition` |
| Ops | `GET /health` · `POST /reset` · `POST /simulate` · alerts, zones, shelters |

---

## 7. Testing & quality
- **38 automated backend tests** (`round1/backend/tests/test_api.py`, run with `python -m pytest -q` in `round1/backend`). They cover every severity override rule and worked example, validation errors (422/404/409), the status flow, duplicates as witnesses, dispatch (suggest → assign → reject → accept → complete), auto-assign, team CRUD, time-based priority, the survival model maths, the Golden Hour plan and simulation, CPR hero alerts (including live website users and widened search), SMS and Tamil parsing, risk radar and the route fallback. Tests always run on a throw-away SQLite file, never the real database.
- Frontend: TypeScript strict type-check + production build; Playwright smoke tests of every page at 390 px and 1440 px (no page errors, no horizontal overflow); a two-browser end-to-end test of the live CPR hero popup (alert received in ~3 s).

---

## 8. Honest limits & what's next
- Survival curves, the flood-prone index and the +31 % figure come from **simplified demo models and simulation**, not field data; a medical board would calibrate them for real use.
- Seed incidents, crew names and equipment lists are **demo data** for Chennai (approximate coordinates).
- Hero popups need the site to be open (true push notifications need HTTPS, a service worker and a push service); phone GPS needs HTTPS or localhost.
- The SMS gateway is simulated; production would connect an SMS provider. Road routes use the public OSRM demo server.
- Next: ERSS-112 / SMS-gateway integration, PostGIS spatial queries, WebSocket live updates, real authentication with roles, and a pilot with a district control room.
