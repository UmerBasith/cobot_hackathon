# BRIEF — Round 1 · ResQNet (single source of truth — every agent reads this first)

## 0. Round
- Round 1 · 60 min · Official brief: "Emergency Response & Disaster Management Platform — Round 1: Emergency Incident Reporting & Monitoring" (35 marks).
- **NO deck, NO PDF, NO report this round.** The website IS the presentation. Only extra file: `deliver/DEMO_SCRIPT.md`.
- Round 2 will extend the same app (teams/dispatch, responder app, duplicates linking, escalation, alerts). Do NOT build those now.

## 1. Official required features (every one must be visible in the demo)
1. **Reporting form** fields: Incident Title, Incident Description, Emergency Category, Location, Number of People Affected, Optional Contact Information.
2. **Categories** (official 6 + our 2 extras = 8): Fire Emergency, Road Accident, Medical Emergency, Flood, Building Collapse, Gas Leak, Electrical Hazard, Other Emergencies.
3. **Severity**: Low / Medium / High / Critical, set by a logical rules mechanism from the report info. We show the REASONS (our innovation).
4. **Dashboard**: Total Reported Incidents, Critical Incidents, Pending Incidents, Resolved Incidents, Incidents by Category.
5. **Incident management**: view all, open details, update status, delete test/duplicate reports (+ mark as duplicate). Statuses: Reported, Pending, In Progress, Resolved.
6. **UI/UX**: professional, responsive (375px phone → 1440px), critical incidents visually highlighted (red + pulse, top of list), easy to understand.

## 2. Product
- Name **ResQNet** · tagline "From report to rescue — every second counts."
- Pitch: Citizens report an emergency in seconds (picture tiles, few taps, no login). A transparent rules engine sets severity and explains why. Control room sees a live, ranked queue + map and manages every incident until resolved.
- Innovation: explainable severity (score 0–100 + reasons, e.g. "People trapped +35 (R1)"); rules decide, humans can override; "Call 112" always visible (supports ERSS-112, never replaces it); picture-first reporting.
- Brand: `--brand-hue: 25` (red-coral, urgent), `--accent-hue: 230` (blue, trust). Light theme default.
- Severity colours: Critical red · High orange · Medium yellow/amber · Low green. Never colour alone — always text label too.

## 3. Pages (frontend)
| Route | Content |
|---|---|
| `/` | Landing (= pitch). Hero ("Report emergency" + "Open control room"), problem, how it works (Report → Classify → Prioritise → Manage → Resolve), **live severity demo** (toggle "people trapped?", hazard size, people count → calls `/api/severity/preview` and shows score + level + reasons live), 8 categories, "Built today" features, team. Big red "Call 112" link (`tel:112`) in navbar. |
| `/report` | Citizen report, mobile-first, NO sidebar. Steps: 1) category (8 big picture tiles) 2) quick questions (anyone unconscious/not breathing/trapped? injuries none/minor/serious; hazard size small/medium/large/spreading; still active?) 3) location (map tap via MapLibre + area dropdown; landmark text) 4) details: title (auto-suggested "{Category} at {Area}", editable), description (required, min 10 chars), people affected (number, required), vulnerable chips (children/elderly/patients/disabled/pregnant), injured count, contact name + phone (optional) 5) submit → big ✅, reference ID, severity badge + reasons, status "Reported". Live severity preview while filling (calls preview). Red "Call 112" always visible. |
| `/app` | Admin dashboard (AppShell sidebar): 4 StatTiles (Total, Critical, Pending, Resolved) + **Incidents by Category** bar chart + severity donut + **map** with incident dots coloured by severity (critical pulsing; click → detail) + "Needs attention" list (critical/high open ones). Refresh every 5 s. |
| `/app/incidents` | All incidents table/list: search, filter by status/severity/category, sorted by priority (critical first). Critical rows highlighted red. Row click → detail. Quick status change. Delete (confirm modal). |
| `/app/incidents/:id` | Detail: title, category icon, severity badge + score gauge + reasons list, all report fields, map pin, status stepper (Reported → Pending → In Progress → Resolved) with buttons + note, timeline of updates, "Mark as duplicate of…" (select another incident), Delete (confirm). |
| `/app/report` | Same report form inside admin (call-taker entering a phone call). Optional if time. |
Nav (`appNav`): Dashboard, Incidents, New report. Header link "Citizen view" → `/report`.

## 4. Map
- **maplibre-gl** (already installed in frontend). Style URL: `https://tiles.openfreemap.org/styles/liberty`. No API key. Attribution must stay visible (default control).
- Centre Chennai `[80.20, 12.98]` (lng, lat), zoom ~10.3. Bounds approx lat 12.85–13.20, lng 80.05–80.32.
- Markers: HTML elements (coloured circle by severity, critical has pulse ring). Click → navigate to detail.
- **Fallback is mandatory:** if the style fails to load (map `error` event before `load`, or no `load` within 6 s), render an SVG schematic Chennai map using the same lat/lng → x/y projection (area bubbles + coastline line + incident dots). The demo must never show a blank map. (This cloud machine cannot reach openfreemap — the fallback is what you will see in screenshots here; the real map works on the laptop.)
- Import `maplibre-gl/dist/maplibre-gl.css`. Lazy-load the map component (React.lazy) so `/report` stays light.

## 5. API contract (all under `/api`; backend + frontend follow EXACTLY)
Enums:
- `Category` = "fire" | "road_accident" | "medical" | "flood" | "building_collapse" | "gas_leak" | "electrical" | "other"
- `Severity` = "Low" | "Medium" | "High" | "Critical"
- `Status` = "Reported" | "Pending" | "In Progress" | "Resolved"
- `Injuries` = "none" | "minor" | "serious" · `Hazard` = "small" | "medium" | "large" | "spreading"
- `Vulnerable` = "children" | "elderly" | "patients" | "disabled" | "pregnant"

`ReportIn`:
```json
{ "title": "Fire at T. Nagar", "description": "min 10 chars", "category": "fire",
  "area": "T. Nagar", "lat": 13.0418, "lng": 80.2341, "landmark": "near bus stand",
  "people_affected": 4, "injured_count": 0, "injuries": "none", "life_threat": false,
  "hazard": "medium", "active": true, "vulnerable": ["children"],
  "contact_name": "", "contact_phone": "" }
```
(title 3–120, description 10–2000, people_affected 0–100000, injured_count 0–100000, lat/lng optional numbers, area required, landmark/contact optional. Defaults: injured_count 0, injuries "none", life_threat false, hazard "small", active true, vulnerable [].)

`Reason` = `{ "label": "People trapped / not breathing", "points": 35, "rule": "R1" | null }`

`SeverityOut` = `{ "score": 0-100, "severity": Severity, "reasons": Reason[], "place_type": "hospital"|..., "place_name": string|null, "flags": string[] }`

`Incident`:
```json
{ "id": "INC-1001", "title": "...", "description": "...", "category": "fire",
  "area": "T. Nagar", "lat": 13.04, "lng": 80.23, "landmark": "",
  "people_affected": 4, "injured_count": 0, "injuries": "none", "life_threat": false,
  "hazard": "medium", "active": true, "vulnerable": [], "contact_name": "", "contact_phone": "",
  "score": 62, "severity": "High", "reasons": [Reason], "place_type": "house", "place_name": null,
  "flags": [], "status": "Reported", "duplicate_of": null,
  "created_at": "2026-11-10T08:30:00Z", "updated_at": "...",
  "timeline": [{ "at": "...", "status": "Reported", "note": "Report received", "actor": "citizen" }] }
```

| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/health | – | `{status:"ok", incidents:int}` |
| POST | /api/severity/preview | ReportIn (title/description may be short; no validation errors for them) | SeverityOut |
| POST | /api/incidents | ReportIn | Incident (201) |
| GET | /api/incidents?status=&severity=&category=&q= | – | Incident[] sorted: open before resolved, then severity Critical→Low, score desc, oldest first |
| GET | /api/incidents/{id} | – | Incident (404 if missing) |
| PATCH | /api/incidents/{id}/status | `{status, note?}` | Incident |
| POST | /api/incidents/{id}/duplicate | `{duplicate_of: "INC-1003"}` | Incident (status → Resolved, note "Duplicate of …") |
| DELETE | /api/incidents/{id} | – | `{deleted: id}` |
| GET | /api/stats | – | `{total, critical, pending, in_progress, resolved, by_category:[{category,label,count}], by_severity:[{severity,count}], by_area:[{area,count}]}` |
| POST | /api/reset | – | `{ok:true, incidents:int}` (restore seed data) |

Stats definitions: `critical` = severity Critical AND status ≠ Resolved. `pending` = status Reported or Pending (waiting for action). `in_progress`, `resolved` = by status. `total` = all incidents.

## 6. Severity engine (backend `app/severity.py`, deterministic)
Score = L + H + E + V + T, capped 100.
- L life threat: life_threat → 35 ("Unconscious / not breathing / trapped"); else injuries serious 18, minor 8, none 0.
- H hazard: small 5, medium 12, large 20, spreading 25.
- E exposure (cap 20): people 0 → 0, 1–5 → 3, 6–20 → 7, 21–100 → 12, 100+ → 15; + place: critical place within 300 m (hospital 8, school/temple/station 6).
- V vulnerable (cap 10): children 4, elderly 4, patients/disabled/pregnant 5 each.
- T time-critical (max 6): active AND category in fire/gas_leak/flood/electrical/building_collapse, or medical with life threat/serious → 6; otherwise 2.
Levels: Critical ≥ 70 · High 45–69 · Medium 25–44 · Low < 25.
Overrides (minimum level; final = higher):
- R1 life_threat → Critical · R2 injured_count ≥ 5 → Critical · R3 hazard spreading at a critical place → Critical
- R5 active fire/gas_leak/electrical → at least High · R6 any injury (injuries ≠ none or injured_count > 0) → at least Medium
- R7 nobody hurt, no life threat, hazard not spreading, people_affected 0 → at most Medium
- R9 description < 15 chars → flag "needs_verification" (priority NOT lowered)
Every applied factor/rule appears in `reasons` with its points.

## 7. Seed data (Chennai, 12 incidents, looks like an active monsoon flood day)
Mix: 3 Critical, 3 High, 3 Medium, 3 Low; statuses spread (5 Reported, 2 Pending, 3 In Progress, 2 Resolved). Several floods in the south (Velachery, Tambaram, Adyar). Areas: T. Nagar, Mylapore, Adyar, Egmore, Velachery, Porur, Anna Nagar, Sholinganallur, Tambaram, Perambur, Guindy, Royapuram, Chromepet, Vandalur (with lat/lng in backend `app/geo.py`; frontend mirrors list in `src/lib/geo.ts`).

Areas (lat, lng): T. Nagar 13.0418,80.2341 · Mylapore 13.0368,80.2676 · Adyar 13.0012,80.2565 · Egmore 13.0732,80.2609 · Velachery 12.9815,80.2180 · Porur 13.0382,80.1565 · Anna Nagar 13.0850,80.2101 · Sholinganallur 12.9010,80.2279 · Tambaram 12.9249,80.1000 · Perambur 13.1143,80.2329 · Guindy 13.0067,80.2206 · Royapuram 13.1137,80.2954 · Chromepet 12.9516,80.1462 · Vandalur 12.8916,80.0810

## 8. Ownership (no two agents edit the same file)
- Main Claude: `backend/` (all), `BRIEF.md`, `deliver/DEMO_SCRIPT.md`.
- frontend-builder: `frontend/` only.

## 9. Demo (3 min)
1. Landing: problem → how it works → live severity demo (toggle "trapped" → jumps to Critical with reasons).
2. `/report` (phone-size): Building Collapse → trapped Yes → Velachery on map → submit → ✅ INC id, Critical + reasons.
3. `/app`: tiles update, new critical at top, red pulsing dot on map, by-category chart.
4. Open it → reasons → Pending → In Progress → Resolved, timeline. Mark a test report as duplicate / delete it.
5. Close: "rules decide, humans manage, every incident tracked to resolution."

## 10. ROUND 2 FEATURES (added to the SAME app — Round 1 features stay top priority, never break them)
Backend is DONE and live (24 tests pass). Additive fields on `Incident`: `witnesses: int`, `assignments: Assignment[]`.

Types:
- `Team` = `{id, name, type: "fire"|"ambulance_als"|"ambulance_bls"|"police"|"ndrf"|"boat", type_label, station, lat, lng, status: "available"|"busy"|"offline", current_incident: string|null}`
- `Assignment` = `{id: "ASG-1012-1", team_id, team_name, team_type, status: "assigned"|"accepted"|"rejected"|"en_route"|"on_scene"|"completed", eta_min, distance_km, reject_reason, note, assigned_at, updated_at}`
- `SuggestSlot` = `{slot: "Ambulance", best: team_id|null, candidates: [{team: Team, eta_min, distance_km}] (top 3)}`
- `Escalation` = `{level: "critical"|"warning", incident_id|null, message}`
- `Similar` = `{id, title, severity, status, distance_m, minutes_apart}`
- `Alert` = `{id, area, message, level: "info"|"warning"|"danger", hours, created_at, expires_at}`

| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/teams | – | Team[] |
| GET | /api/incidents/{id}/suggest | – | SuggestSlot[] (right team per slot, ranked by ETA) |
| GET | /api/incidents/{id}/similar | – | Similar[] (possible duplicates: ≤500 m, ≤60 min, related category) |
| POST | /api/incidents/{id}/assign | `{team_ids: string[]}` | Incident (status → In Progress; 409 if a team is busy) |
| POST | /api/assignments/{id}/respond | `{accept: bool, reason}` | Incident (reject frees the team) |
| POST | /api/assignments/{id}/status | `{status: "en_route"|"on_scene"|"completed", note}` | Incident (completed needs note ≥3 chars, frees team) |
| GET | /api/responder/{team_id} | – | `[{assignment, incident}]` active jobs of that team |
| GET | /api/escalations | – | Escalation[] (Critical unassigned >2 min, High >5 min, not accepted >1 min, resource shortage) |
| POST | /api/alerts | `{area, message, level, hours}` (area = area name or "All Chennai") | Alert (201) |
| GET | /api/alerts/active?area= | – | Alert[] |
| POST | /api/simulate | `{scenario: "chennai_flood"}` | `{ok, created: string[]}` (8 new flood-day reports incl. duplicates + a vague one) |
Marking a duplicate (`/duplicate`) now also adds a witness to the main incident: +3 points each, and 3+ reports raise it one level (R8).

UI to add (in this order, stop if time runs out):
1. Incident detail: **"Dispatch" card** — Suggest teams (slot → best team, ETA, distance, other candidates) → **Assign all suggested** / assign one; assignments list with status chips; **"Possible duplicates"** card from /similar with "Link as duplicate" button; witnesses badge.
2. **`/responder`** (mobile-first, no sidebar, like /report): pick team (dropdown of /api/teams) → active job cards (incident title, severity, area, map pin, reasons, ETA) → Accept / Reject (reason chips: "No equipment", "Too far", "Already busy", "Other") → En route → On scene → Completed (note required). Refresh every 5 s.
3. **Escalation banner** at top of AppShell (red for critical, amber warning) from /api/escalations, refresh 5 s, click → incident.
4. **`/app/teams`**: team table (status chips) + map with team markers (square icons) and incident dots.
5. **`/app/alerts`**: create alert form (area select incl. "All Chennai", message, level, hours) + active list. Citizen `/report` shows active alerts as a banner at top.
6. Dashboard: **"Simulate flood"** button (calls /simulate, toast) next to Reset; teams-available tile or small card.
Nav: Dashboard, Incidents, Teams, Alerts, New report · header links "Citizen view" (/report) and "Responder app" (/responder).

## 11. FINAL PAGE LIST (from the user) — 3 pages added
Citizen: 1 Landing `/` · 2 Emergency reporting `/report` · 3 **Incident tracking `/track` and `/track/:id`** (NEW)
Admin: 1 Command centre `/app` · 2 Incident details & management · 3 Response teams `/app/teams` · 4 Public safety alerts `/app/alerts` · 5 **Analytics & performance `/app/analytics`** (NEW) · 6 **Disaster zones & shelters `/app/zones`** (NEW)
Responder: 1 Responder dashboard `/responder`

Backend (live, 27 tests pass):
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/track/{id} | – | `TrackOut` = `{id, title, category, area, landmark, severity, score, reasons, status, duplicate_of, created_at, updated_at, timeline, teams:[{team_name, team_type, status, eta_min}]}` (no contact details; 404 if unknown) |
| GET | /api/zones | – | `Zone[]` = `{id(area), area, lat, lng, status:"critical"|"evacuate"|"watch"|"safe", note, open_incidents, critical_incidents, updated_at}` sorted worst first |
| PATCH | /api/zones/{area} | `{status, note}` | Zone |
| GET | /api/shelters | – | `Shelter[]` = `{id, name, area, lat, lng, capacity, occupancy, facilities: string[]}` |
| PATCH | /api/shelters/{id} | `{occupancy}` | Shelter (400 if > capacity) |
| GET | /api/analytics | – | `{total, open, resolved, resolution_rate, avg_time_to_assign_min|null, avg_time_to_resolve_min|null, critical_avg_time_to_assign_min|null, teams_total, teams_busy, utilisation, rejections, by_hour:[{hour(ISO), reported, resolved}] (last 6 h), by_area:[{area,total,critical,open}], by_category:[{category,label,total,avg_score}], by_severity:[{severity,total,open}], by_status:[{status,count}], team_performance:[{team_id,team_name,type_label,jobs,completed,rejected,avg_eta_min|null}]}` |

UI:
- `/track` (citizen, mobile-first, same header as /report): enter reference ID → `/track/INC-1012`: big status stepper (Reported → Pending → In Progress → Resolved), severity + reasons, teams on the way with ETA + status chips, timeline, "Call 112". Refresh every 5 s. The /report success screen gets a "Track this report" button → /track/:id. Landing + /report header get a "Track report" link.
- `/app/analytics`: KPI tiles (resolution rate, avg time to assign, critical avg time to assign, team utilisation), reported vs resolved by hour (area/line), by area (bar, critical stacked), by category (bar with avg score), status mix, team performance table (jobs, completed, rejected, avg ETA). Label times "measured from demo data".
- `/app/zones`: map with zone circles coloured by status (critical red, evacuate orange, watch amber, safe green) + shelter markers; zone list with status select + note (PATCH) and open/critical incident counts; shelters list with occupancy bars (% full, red when ≥90%), +10/−10 buttons (PATCH), facilities chips; tiles: total shelter capacity, people sheltered, % full, zones under evacuation.
- Nav: Dashboard, Incidents, Teams, Alerts, Analytics, Zones & shelters, New report.
