"""ResQNet API.  Run from the backend folder:  ../../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
API docs: http://127.0.0.1:8000/docs"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .dispatch import active_assignments, escalations, eta, make_teams, similar, suggest
from .schemas import (Alert, AlertIn, AssignIn, AssignmentStatusIn, DuplicateIn, Escalation, EscalateIn, FieldUpdateIn,
                      Incident, PreviewIn,
                      ReportIn, RespondIn, ResponderJob, SeverityOut, Similar, SimulateIn, Stats, StatusIn,
                      SuggestSlot, Team)
from .schemas import Analytics, Shelter, ShelterIn, TrackOut, Zone, ZoneIn
from .seed import SEED, SIMULATE_FLOOD
from .zones import SHELTERS_SEED, ZONES_SEED
from . import golden
from .heroes import make_heroes, nearby, needs_heroes
from .severity import CATEGORY_LABELS, LEVELS, assess, level_for

STATUSES = ["Reported", "Pending", "In Progress", "Resolved"]


def now_iso(delta_min: int = 0) -> str:
    t = datetime.now(timezone.utc) - timedelta(minutes=delta_min)
    return t.isoformat(timespec="seconds").replace("+00:00", "Z")


def rescore(inc: dict) -> dict:
    """Severity from the report + bonus for confirmed duplicate reports (witnesses)."""
    res = assess(inc)
    w = int(inc.get("witnesses") or 0)
    if w:
        pts = min(9, 3 * w)
        res["reasons"].append({"label": f"{w} more people reported it (+3 each)", "points": pts, "rule": None})
        res["score"] = min(100, res["score"] + pts)
        lvl = max(LEVELS.index(res["severity"]), LEVELS.index(level_for(res["score"])))
        if w >= 2 and lvl < 3:
            lvl += 1
            res["reasons"].append({"label": f"Confirmed by {w + 1} independent reports → one level up", "points": 0,
                                   "rule": "R8"})
        res["severity"] = LEVELS[lvl]
    inc.update(res)
    return inc


def build_incident(seq: int, report: dict, status: str = "Reported", minutes_ago: int = 0, actor: str = "citizen") -> dict:
    created = now_iso(minutes_ago)
    inc = {**report, **assess(report), "id": f"INC-{seq}", "status": "Reported", "duplicate_of": None,
           "witnesses": 0, "assignments": [], "volunteers": [],
           "created_at": created, "updated_at": created,
           "timeline": [{"at": created, "status": "Reported", "note": "Report received", "actor": actor}]}
    # seed history: walk through the statuses up to the target one
    steps = STATUSES[1:STATUSES.index(status) + 1]
    for i, st in enumerate(steps, 1):
        at = now_iso(max(0, minutes_ago - i * max(1, minutes_ago // (len(steps) + 1))))
        note = {"Pending": "Verified by control room", "In Progress": "Response team on the way",
                "Resolved": "Situation under control"}[st]
        inc["timeline"].append({"at": at, "status": st, "note": note, "actor": "admin"})
        inc["status"], inc["updated_at"] = st, at
    return inc


DEFAULTS = {"lat": None, "lng": None, "landmark": "", "people_affected": 0, "injured_count": 0, "injuries": "none",
            "life_threat": False, "hazard": "small", "active": True, "vulnerable": [],
            "contact_name": "", "contact_phone": ""}


def teams_by_id() -> dict[str, dict]:
    return {t["id"]: t for t in db.docs("team")}


def new_assignment(inc: dict, team: dict, status: str = "assigned", at: str | None = None) -> dict:
    lat, lng = inc.get("lat") or team["lat"], inc.get("lng") or team["lng"]
    km, mins = eta(team, lat, lng)
    at = at or now_iso()
    a = {"id": f"ASG-{inc['id'][4:]}-{len(inc['assignments']) + 1}", "team_id": team["id"], "team_name": team["name"],
         "team_type": team["type"], "status": status, "eta_min": mins, "distance_km": km, "reject_reason": "",
         "note": "", "assigned_at": at, "updated_at": at}
    inc["assignments"].append(a)
    team["status"], team["current_incident"] = "busy", inc["id"]
    db.put_doc("team", team)
    return a


def reset_data() -> int:
    db.clear()
    db.clear_docs("team")
    db.clear_docs("alert")
    db.clear_docs("zone")
    db.clear_docs("hero")
    for h in make_heroes():
        db.put_doc("hero", h)
    db.clear_docs("shelter")
    for area, st, note in ZONES_SEED:
        db.put_doc("zone", {"id": area, "area": area, "status": st, "note": note, "updated_at": now_iso()})
    for sid, name, area, lat, lng, cap, occ, fac in SHELTERS_SEED:
        db.put_doc("shelter", {"id": sid, "name": name, "area": area, "lat": lat, "lng": lng, "capacity": cap,
                               "occupancy": occ, "facilities": fac})
    for t in make_teams():
        db.put_doc("team", t)
    for minutes, status, report in sorted(SEED, key=lambda s: -s[0]):
        full = {**DEFAULTS, **report}
        inc = db.insert(lambda seq, r=full, s=status, m=minutes: build_incident(seq, r, s, m))
        if status == "In Progress":  # give in-progress incidents a team that is on the way / on scene
            tmap = teams_by_id()
            # keep the boats free for the demo: waterlogging gets the local police patrol instead
            pick = next((s["best"] for s in suggest(inc, list(tmap.values()))
                         if s["best"] and tmap[s["best"]]["type"] != "boat"), None)
            if not pick:
                pick = min((t for t in tmap.values() if t["type"] == "police" and t["status"] == "available"),
                           key=lambda t: eta(t, inc["lat"], inc["lng"])[1])["id"]
            new_assignment(inc, tmap[pick], "on_scene" if minutes > 20 else "en_route", now_iso(max(0, minutes - 3)))
            db.save(inc)
    put_alert({"area": "Velachery", "message": "Heavy flooding near Velachery lake. Move to upper floors, avoid 100 Feet Road.",
               "level": "danger", "hours": 6})
    return db.count()


def put_alert(body: dict) -> dict:
    n = len(db.docs("alert")) + 1
    created = datetime.now(timezone.utc)
    alert = {**body, "id": f"ALT-{n}", "created_at": now_iso(),
             "expires_at": (created + timedelta(hours=body["hours"])).isoformat(timespec="seconds").replace("+00:00", "Z")}
    db.put_doc("alert", alert)
    return alert


@asynccontextmanager
async def lifespan(_: FastAPI):
    if db.count() == 0:
        reset_data()
    yield


app = FastAPI(title="ResQNet API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def sort_key(inc: dict) -> tuple:
    return (inc["status"] == "Resolved", -LEVELS.index(inc["severity"]), -inc["score"], inc["created_at"])


def get_or_404(inc_id: str) -> dict:
    inc = db.get(inc_id.upper())
    if not inc:
        raise HTTPException(404, f"Incident {inc_id} not found")
    return inc


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "incidents": db.count(), "time": now_iso()}


@app.post("/api/severity/preview", response_model=SeverityOut)
def preview(body: PreviewIn) -> dict:
    return assess(body.model_dump())


@app.post("/api/incidents", response_model=Incident, status_code=201)
def create_incident(body: ReportIn) -> dict:
    report = body.model_dump()
    report["title"], report["description"] = report["title"].strip(), report["description"].strip()
    if report.get("anonymous"):
        report["contact_name"], report["contact_phone"] = "", ""
    inc = db.insert(lambda seq: build_incident(seq, report))
    if needs_heroes(inc):  # CPR Hero Network: alert the 3 nearest trained citizens automatically
        alert_heroes(inc, 3, actor="system")
        db.save(inc)
    return inc


@app.get("/api/incidents", response_model=list[Incident])
def list_incidents(status: str | None = None, severity: str | None = None,
                   category: str | None = None, q: str | None = None) -> list[dict]:
    items = db.all_incidents()
    if status:
        items = [i for i in items if i["status"] == status]
    if severity:
        items = [i for i in items if i["severity"] == severity]
    if category:
        items = [i for i in items if i["category"] == category]
    if q:
        ql = q.lower().strip()
        items = [i for i in items if ql in f'{i["id"]} {i["title"]} {i["description"]} {i["area"]} {i["landmark"]}'.lower()]
    return sorted(items, key=sort_key)


@app.get("/api/incidents/{inc_id}", response_model=Incident)
def get_incident(inc_id: str) -> dict:
    return get_or_404(inc_id)


@app.patch("/api/incidents/{inc_id}/status", response_model=Incident)
def update_status(inc_id: str, body: StatusIn) -> dict:
    inc = get_or_404(inc_id)
    at = now_iso()
    note = body.note.strip() or f"Status changed to {body.status}"
    inc["timeline"].append({"at": at, "status": body.status, "note": note, "actor": "admin"})
    inc["status"], inc["updated_at"] = body.status, at
    db.save(inc)
    return inc


@app.post("/api/incidents/{inc_id}/duplicate", response_model=Incident)
def mark_duplicate(inc_id: str, body: DuplicateIn) -> dict:
    inc = get_or_404(inc_id)
    target = body.duplicate_of.upper()
    if target == inc["id"]:
        raise HTTPException(400, "An incident cannot be a duplicate of itself")
    main = get_or_404(target)
    if inc.get("duplicate_of"):
        raise HTTPException(400, f"{inc['id']} is already linked to {inc['duplicate_of']}")
    at = now_iso()
    inc["duplicate_of"] = target
    inc["timeline"].append({"at": at, "status": "Resolved", "note": f"Duplicate of {target} — linked as a witness report",
                            "actor": "admin"})
    inc["status"], inc["updated_at"] = "Resolved", at
    release_teams(inc, "Incident merged")
    db.save(inc)
    before = main["severity"]
    main["witnesses"] = int(main.get("witnesses") or 0) + 1
    rescore(main)
    note = f"{inc['id']} linked as duplicate ({main['witnesses'] + 1} reports in total)"
    if main["severity"] != before:
        note += f" — severity raised {before} → {main['severity']}"
    main["timeline"].append({"at": at, "status": main["status"], "note": note, "actor": "admin"})
    main["updated_at"] = at
    db.save(main)
    return inc


def release_teams(inc: dict, why: str) -> None:
    teams = teams_by_id()
    for a in active_assignments(inc):
        a["status"], a["note"], a["updated_at"] = "completed", why, now_iso()
        t = teams.get(a["team_id"])
        if t and t["current_incident"] == inc["id"]:
            t["status"], t["current_incident"] = "available", None
            db.put_doc("team", t)


@app.delete("/api/incidents/{inc_id}")
def delete_incident(inc_id: str) -> dict:
    release_teams(get_or_404(inc_id), "Incident deleted")
    db.delete(inc_id.upper())
    return {"deleted": inc_id.upper()}


@app.get("/api/stats", response_model=Stats)
def stats() -> dict:
    items = db.all_incidents()
    by_status = {s: sum(i["status"] == s for i in items) for s in STATUSES}
    areas: dict[str, int] = {}
    for i in items:
        areas[i["area"]] = areas.get(i["area"], 0) + 1
    return {
        "total": len(items),
        "critical": sum(i["severity"] == "Critical" and i["status"] != "Resolved" for i in items),
        "pending": by_status["Reported"] + by_status["Pending"],
        "in_progress": by_status["In Progress"],
        "resolved": by_status["Resolved"],
        "by_category": [{"category": c, "label": lbl, "count": sum(i["category"] == c for i in items)}
                        for c, lbl in CATEGORY_LABELS.items()],
        "by_severity": [{"severity": s, "count": sum(i["severity"] == s for i in items)} for s in reversed(LEVELS)],
        "by_area": sorted(({"area": a, "count": n} for a, n in areas.items()), key=lambda x: -x["count"]),
    }


@app.post("/api/reset")
def reset() -> dict:
    return {"ok": True, "incidents": reset_data()}


# ======================= Round 2: teams, dispatch, responder, escalation, alerts =======================
@app.get("/api/teams", response_model=list[Team])
def list_teams() -> list[dict]:
    return db.docs("team")


@app.get("/api/incidents/{inc_id}/suggest", response_model=list[SuggestSlot])
def suggest_teams(inc_id: str) -> list[dict]:
    return suggest(get_or_404(inc_id), db.docs("team"))


@app.get("/api/incidents/{inc_id}/similar", response_model=list[Similar])
def similar_incidents(inc_id: str) -> list[dict]:
    return similar(get_or_404(inc_id), db.all_incidents())


@app.post("/api/incidents/{inc_id}/assign", response_model=Incident)
def assign(inc_id: str, body: AssignIn) -> dict:
    inc = get_or_404(inc_id)
    if inc["status"] == "Resolved":
        raise HTTPException(400, "Incident is already resolved")
    teams = teams_by_id()
    for tid in body.team_ids:
        t = teams.get(tid)
        if not t:
            raise HTTPException(404, f"Team {tid} not found")
        if t["status"] != "available":
            raise HTTPException(409, f"{t['name']} is not available")
    at = now_iso()
    names = []
    for tid in dict.fromkeys(body.team_ids):
        a = new_assignment(inc, teams[tid], at=at)
        names.append(f"{a['team_name']} (ETA {round(a['eta_min'])} min)")
    if inc["status"] in ("Reported", "Pending"):
        inc["status"] = "In Progress"
    inc["timeline"].append({"at": at, "status": inc["status"], "note": "Assigned: " + ", ".join(names), "actor": "admin"})
    inc["updated_at"] = at
    db.save(inc)
    return inc


def find_assignment(asg_id: str) -> tuple[dict, dict]:
    for inc in db.all_incidents():
        for a in inc.get("assignments", []):
            if a["id"] == asg_id.upper():
                return inc, a
    raise HTTPException(404, f"Assignment {asg_id} not found")


@app.post("/api/assignments/{asg_id}/respond", response_model=Incident)
def respond(asg_id: str, body: RespondIn) -> dict:
    inc, a = find_assignment(asg_id)
    if a["status"] != "assigned":
        raise HTTPException(400, f"Assignment is already {a['status']}")
    at = now_iso()
    a["updated_at"] = at
    if body.accept:
        a["status"] = "accepted"
        note = f"{a['team_name']} accepted"
    else:
        reason = body.reason.strip() or "No reason given"
        a["status"], a["reject_reason"] = "rejected", reason
        t = teams_by_id().get(a["team_id"])
        if t:
            t["status"], t["current_incident"] = "available", None
            db.put_doc("team", t)
        note = f"{a['team_name']} rejected: {reason} — pick the next suggested team"
    inc["timeline"].append({"at": at, "status": inc["status"], "note": note, "actor": "responder"})
    inc["updated_at"] = at
    db.save(inc)
    return inc


@app.post("/api/assignments/{asg_id}/status", response_model=Incident)
def assignment_status(asg_id: str, body: AssignmentStatusIn) -> dict:
    inc, a = find_assignment(asg_id)
    if a["status"] in ("rejected", "completed", "assigned"):
        raise HTTPException(400, f"Cannot change an assignment that is {a['status']}")
    if body.status == "completed" and len(body.note.strip()) < 3:
        raise HTTPException(422, "A closing note is required")
    at = now_iso()
    a["status"], a["updated_at"] = body.status, at
    if body.note:
        a["note"] = body.note.strip()
    label = {"en_route": "is on the way", "on_scene": "arrived on scene", "completed": "finished"}[body.status]
    note = f"{a['team_name']} {label}" + (f": {body.note.strip()}" if body.note.strip() else "")
    if body.status in ("en_route", "on_scene") and inc["status"] in ("Reported", "Pending"):
        inc["status"] = "In Progress"
    if body.status == "completed":
        t = teams_by_id().get(a["team_id"])
        if t:
            t["status"], t["current_incident"] = "available", None
            db.put_doc("team", t)
        if not active_assignments(inc):
            note += " — all teams done, ready for admin to resolve"
    inc["timeline"].append({"at": at, "status": inc["status"], "note": note, "actor": "responder"})
    inc["updated_at"] = at
    db.save(inc)
    return inc


FIELD_TAG_LABEL = {"situation": "Situation update", "contained": "Hazard contained", "rescued": "People rescued",
                   "need_time": "Needs more time", "casualty": "Casualty update"}
NEED_LABEL = {"fire": "fire engine", "rescue": "rescue/ladder unit", "ambulance": "ambulance", "police": "police",
              "ndrf": "NDRF team", "boat": "rescue boat", "hazmat": "HAZMAT team", "power": "power board (TANGEDCO)"}


def active_or_400(asg_id: str) -> tuple[dict, dict]:
    inc, a = find_assignment(asg_id)
    if a["status"] not in ("accepted", "en_route", "on_scene"):
        raise HTTPException(400, f"Accept the job first (assignment is {a['status']})")
    if inc["status"] == "Resolved":
        raise HTTPException(400, f"{inc['id']} is already resolved")
    return inc, a


@app.post("/api/assignments/{asg_id}/update", response_model=Incident)
def field_update(asg_id: str, body: FieldUpdateIn) -> dict:
    """'Update Status' quick action: situation report from the field. Appears on the admin incident page
    and the citizen tracking page (both refresh every 5 s)."""
    inc, a = active_or_400(asg_id)
    at = now_iso()
    note = f"{a['team_name']} · {FIELD_TAG_LABEL[body.tag]}: {body.note.strip()}"
    if inc["status"] in ("Reported", "Pending"):
        inc["status"] = "In Progress"
    inc["timeline"].append({"at": at, "status": inc["status"], "note": note, "actor": "responder"})
    a["note"], a["updated_at"] = body.note.strip(), at
    inc["updated_at"] = at
    db.save(inc)
    return inc


@app.post("/api/assignments/{asg_id}/escalate", response_model=Incident)
def escalate(asg_id: str, body: EscalateIn) -> dict:
    """'Escalate' quick action: raises a critical alert in the control room until more teams are assigned."""
    inc, a = active_or_400(asg_id)
    at = now_iso()
    needs = list(dict.fromkeys(body.needs))
    inc["escalation"] = {"at": at, "team_id": a["team_id"], "team_name": a["team_name"], "reason": body.reason.strip(),
                         "needs": needs, "note": body.note.strip(),
                         "teams_at": len(inc.get("assignments", []))}  # cleared once the admin adds a team
    want = ", ".join(NEED_LABEL[n] for n in needs)
    note = f"ESCALATED by {a['team_name']}: {body.reason.strip()}" + (f" — needs {want}" if want else "") +            (f". {body.note.strip()}" if body.note.strip() else "")
    if inc["status"] in ("Reported", "Pending"):
        inc["status"] = "In Progress"
    inc["timeline"].append({"at": at, "status": inc["status"], "note": note, "actor": "responder"})
    inc["updated_at"] = at
    db.save(inc)
    return inc


@app.get("/api/responder/{team_id}", response_model=list[ResponderJob])
def responder_jobs(team_id: str) -> list[dict]:
    if team_id.upper() not in teams_by_id():
        raise HTTPException(404, f"Team {team_id} not found")
    jobs = []
    for inc in db.all_incidents():
        for a in inc.get("assignments", []):
            if a["team_id"] == team_id.upper() and a["status"] in ("assigned", "accepted", "en_route", "on_scene"):
                jobs.append({"assignment": a, "incident": inc})
    return jobs


@app.get("/api/escalations", response_model=list[Escalation])
def get_escalations() -> list[dict]:
    return escalations(db.all_incidents(), db.docs("team"))


@app.post("/api/alerts", response_model=Alert, status_code=201)
def create_alert(body: AlertIn) -> dict:
    return put_alert(body.model_dump())


@app.get("/api/alerts/active", response_model=list[Alert])
def active_alerts(area: str | None = None) -> list[dict]:
    now = now_iso()
    out = [a for a in db.docs("alert") if a["expires_at"] > now]
    if area:
        out = [a for a in out if a["area"] in (area, "All Chennai")]
    return list(reversed(out))


@app.post("/api/simulate")
def simulate(body: SimulateIn) -> dict:
    """Burst of flood-day reports (incl. duplicates of open incidents and one vague report)."""
    ids = []
    for minutes, report in SIMULATE_FLOOD:
        full = {**DEFAULTS, **report}
        inc = db.insert(lambda seq, r=full, m=minutes: build_incident(seq, r, "Reported", m))
        ids.append(inc["id"])
    return {"ok": True, "created": ids, "scenario": body.scenario}


# ======================= Citizen tracking, zones & shelters, analytics =======================
@app.get("/api/track/{inc_id}", response_model=TrackOut)
def track(inc_id: str) -> dict:
    inc = get_or_404(inc_id.strip())
    teams = [{"team_name": a["team_name"], "team_type": a["team_type"], "status": a["status"], "eta_min": a["eta_min"]}
             for a in inc.get("assignments", []) if a["status"] != "rejected"]
    return {**{k: inc[k] for k in TrackOut.model_fields if k in inc}, "teams": teams, "lat": inc.get("lat"),
            "lng": inc.get("lng")}


@app.get("/api/zones", response_model=list[Zone])
def zones() -> list[dict]:
    from .geo import AREAS
    open_inc = [i for i in db.all_incidents() if i["status"] != "Resolved"]
    out = []
    for z in db.docs("zone"):
        lat, lng = AREAS[z["area"]]
        here = [i for i in open_inc if i["area"] == z["area"]]
        out.append({**z, "lat": lat, "lng": lng, "open_incidents": len(here),
                    "critical_incidents": sum(i["severity"] == "Critical" for i in here)})
    order = {"critical": 0, "evacuate": 1, "watch": 2, "safe": 3}
    return sorted(out, key=lambda z: (order[z["status"]], -z["open_incidents"]))


@app.patch("/api/zones/{area}", response_model=Zone)
def update_zone(area: str, body: ZoneIn) -> dict:
    z = next((z for z in db.docs("zone") if z["area"].lower() == area.lower()), None)
    if not z:
        raise HTTPException(404, f"Zone {area} not found")
    z.update(status=body.status, note=body.note.strip() or z["note"], updated_at=now_iso())
    db.put_doc("zone", z)
    return next(x for x in zones() if x["id"] == z["id"])


@app.get("/api/shelters", response_model=list[Shelter])
def shelters() -> list[dict]:
    return db.docs("shelter")


@app.patch("/api/shelters/{sid}", response_model=Shelter)
def update_shelter(sid: str, body: ShelterIn) -> dict:
    sh = next((x for x in db.docs("shelter") if x["id"] == sid.upper()), None)
    if not sh:
        raise HTTPException(404, f"Shelter {sid} not found")
    if body.occupancy > sh["capacity"]:
        raise HTTPException(400, f"Occupancy cannot exceed capacity ({sh['capacity']})")
    sh["occupancy"] = body.occupancy
    db.put_doc("shelter", sh)
    return sh


def _mins(a: str, b: str) -> float:
    ta = datetime.fromisoformat(a.replace("Z", "+00:00"))
    tb = datetime.fromisoformat(b.replace("Z", "+00:00"))
    return (tb - ta).total_seconds() / 60


def _avg(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 1) if xs else None


@app.get("/api/analytics", response_model=Analytics)
def analytics() -> dict:
    items = db.all_incidents()
    teams = db.docs("team")
    assign_t, crit_assign_t, resolve_t = [], [], []
    rejections = 0
    perf: dict[str, dict] = {t["id"]: {"team_id": t["id"], "team_name": t["name"], "type_label": t["type_label"],
                                       "jobs": 0, "completed": 0, "rejected": 0, "_eta": []} for t in teams}
    for i in items:
        asg = i.get("assignments", [])
        if asg:
            m = _mins(i["created_at"], min(a["assigned_at"] for a in asg))
            assign_t.append(m)
            if i["severity"] == "Critical":
                crit_assign_t.append(m)
        res = next((e["at"] for e in i["timeline"] if e["status"] == "Resolved"), None)
        if res and i["status"] == "Resolved" and not i.get("duplicate_of"):
            resolve_t.append(_mins(i["created_at"], res))
        for a in asg:
            p = perf.get(a["team_id"])
            rejections += a["status"] == "rejected"
            if p:
                p["jobs"] += 1
                p["completed"] += a["status"] == "completed"
                p["rejected"] += a["status"] == "rejected"
                p["_eta"].append(a["eta_min"])
    # last 6 hours, hourly buckets
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    by_hour = []
    for h in range(5, -1, -1):
        start = now - timedelta(hours=h)
        end = start + timedelta(hours=1)
        inb = lambda iso: start <= datetime.fromisoformat(iso.replace("Z", "+00:00")) < end  # noqa: E731
        by_hour.append({"hour": start.isoformat(timespec="minutes").replace("+00:00", "Z"),
                        "reported": sum(inb(i["created_at"]) for i in items),
                        "resolved": sum(any(e["status"] == "Resolved" and inb(e["at"]) for e in i["timeline"])
                                        for i in items)})
    areas: dict[str, dict] = {}
    for i in items:
        a = areas.setdefault(i["area"], {"area": i["area"], "total": 0, "critical": 0, "open": 0})
        a["total"] += 1
        a["critical"] += i["severity"] == "Critical"
        a["open"] += i["status"] != "Resolved"
    resolved = sum(i["status"] == "Resolved" for i in items)
    busy = sum(t["status"] == "busy" for t in teams)
    return {
        "total": len(items), "open": len(items) - resolved, "resolved": resolved,
        "resolution_rate": round(100 * resolved / len(items), 1) if items else 0.0,
        "avg_time_to_assign_min": _avg(assign_t), "avg_time_to_resolve_min": _avg(resolve_t),
        "critical_avg_time_to_assign_min": _avg(crit_assign_t),
        "teams_total": len(teams), "teams_busy": busy,
        "utilisation": round(100 * busy / len(teams), 1) if teams else 0.0, "rejections": rejections,
        "by_hour": by_hour,
        "by_area": sorted(areas.values(), key=lambda a: (-a["critical"], -a["total"])),
        "by_category": [{"category": c, "label": lbl, "total": len(xs),
                         "avg_score": round(sum(x["score"] for x in xs) / len(xs), 1) if xs else 0}
                        for c, lbl in CATEGORY_LABELS.items() for xs in [[i for i in items if i["category"] == c]]],
        "by_severity": [{"severity": s, "total": sum(i["severity"] == s for i in items),
                         "open": sum(i["severity"] == s and i["status"] != "Resolved" for i in items)}
                        for s in reversed(LEVELS)],
        "by_status": [{"status": s, "count": sum(i["status"] == s for i in items)} for s in STATUSES],
        "team_performance": [{**{k: v for k, v in p.items() if k != "_eta"}, "avg_eta_min": _avg(p["_eta"])}
                             for p in perf.values()],
    }


# ======================= Golden Hour Engine =======================
@app.get("/api/golden-hour")
def golden_hour() -> dict:
    items = db.all_incidents()
    teams = db.docs("team")
    tmap = {t["id"]: t for t in teams}
    rows = [r for i in items for r in [golden.row(i, tmap)] if r]
    rows.sort(key=lambda r: -r["lives_lost_per_min_delay"])
    p = golden.plan(items, teams)
    return {"people_at_risk": sum(r["people_at_risk"] for r in rows),
            "expected_survivors": round(sum(r["expected_survivors"] for r in rows), 2),
            "lives_lost_per_min_delay": round(sum(r["lives_lost_per_min_delay"] for r in rows), 3),
            "incidents": rows, "plan": p,
            "method": "Survival = 95 % x 0.5^(minutes waiting / half-life). Half-life depends on the condition; CPR or "
                      "first aid slows the fall; it stops when a team is on scene. Simplified demo assumptions."}


@app.post("/api/golden-hour/apply")
def golden_apply() -> dict:
    p = golden.plan(db.all_incidents(), db.docs("team"))
    done = []
    for st in p["steps"]:
        try:
            assign(st["incident_id"], AssignIn(team_ids=[st["team_id"]]))
            done.append(st)
        except HTTPException:
            continue
    return {"assigned": len(done), "steps": done, "extra_lives": p["extra_lives"]}


_SIM_CACHE: dict = {}


@app.get("/api/golden-hour/simulation")
def golden_simulation() -> dict:
    if not _SIM_CACHE:
        from .dispatch import make_teams
        _SIM_CACHE.update(golden.simulate(make_teams()))
    return _SIM_CACHE


@app.get("/api/incidents/{inc_id}/survival")
def incident_survival(inc_id: str) -> dict:
    inc = get_or_404(inc_id)
    c = golden.curve(inc, teams_by_id())
    if not c:
        return {"incident_id": inc["id"], "profile": None, "people_at_risk": 0, "points": [],
                "profile_label": "No one at risk to life", "basis": "No injuries or life threat reported."}
    return c


# ======================= CPR Hero Network =======================
def alert_heroes(inc: dict, count: int = 3, actor: str = "admin") -> list[dict]:
    already = {v["id"] for v in inc.get("volunteers", [])}
    busy = {v["id"] for i in db.all_incidents() if i["id"] != inc["id"] and i["status"] != "Resolved"
            for v in i.get("volunteers", []) if v["status"] in ("accepted", "arrived", "cpr")}
    picks = [n for n in nearby(inc, db.docs("hero")) if n["hero"]["id"] not in already and n["hero"]["id"] not in busy
             and n["hero"]["available"]][:count]
    at = now_iso()
    inc.setdefault("volunteers", [])
    for n in picks:
        h = n["hero"]
        inc["volunteers"].append({"id": h["id"], "name": h["name"], "skills": h["skills"], "status": "alerted",
                                  "distance_m": n["distance_m"], "eta_min": n["eta_min"], "alerted_at": at,
                                  "updated_at": at, "cpr_at": None})
    if picks:
        inc["timeline"].append({"at": at, "status": inc["status"], "actor": actor,
                                "note": "CPR Hero Network: alerted " + ", ".join(
                                    f"{n['hero']['name']} ({n['distance_m']} m)" for n in picks)})
    return picks


@app.get("/api/heroes")
def list_heroes() -> list[dict]:
    return db.docs("hero")


@app.get("/api/incidents/{inc_id}/heroes")
def incident_heroes(inc_id: str) -> dict:
    inc = get_or_404(inc_id)
    status = {v["id"]: v for v in inc.get("volunteers", [])}
    return {"needs_heroes": needs_heroes(inc), "radius_m": 3000,
            "responding": inc.get("volunteers", []),
            "nearby": [{"id": n["hero"]["id"], "name": n["hero"]["name"], "skills": n["hero"]["skills"],
                        "distance_m": n["distance_m"], "eta_min": n["eta_min"],
                        "status": status.get(n["hero"]["id"], {}).get("status", "not alerted")}
                       for n in nearby(inc, db.docs("hero"))]}


@app.post("/api/incidents/{inc_id}/heroes/alert")
def alert_incident_heroes(inc_id: str, count: int = 3) -> dict:
    inc = get_or_404(inc_id)
    if inc["status"] == "Resolved":
        raise HTTPException(400, "Incident is resolved")
    picks = alert_heroes(inc, max(1, min(count, 5)))
    db.save(inc)
    if not picks:
        raise HTTPException(409, "No more available CPR heroes within 3 km")
    return {"alerted": [p["hero"]["id"] for p in picks], "incident": inc}


@app.get("/api/hero/{hero_id}")
def hero_inbox(hero_id: str) -> dict:
    hero = next((h for h in db.docs("hero") if h["id"] == hero_id.upper()), None)
    if not hero:
        raise HTTPException(404, f"Hero {hero_id} not found")
    jobs = []
    for inc in db.all_incidents():
        for v in inc.get("volunteers", []):
            if v["id"] == hero["id"] and v["status"] not in ("declined",) and inc["status"] != "Resolved":
                jobs.append({"volunteer": v, "incident": {k: inc[k] for k in (
                    "id", "title", "category", "area", "landmark", "lat", "lng", "severity", "score", "description",
                    "people_affected", "life_threat", "injuries", "created_at", "status")}})
    return {"hero": hero, "jobs": jobs}


HERO_FLOW = {"accept": "accepted", "decline": "declined", "arrived": "arrived", "cpr": "cpr", "done": "done"}


@app.post("/api/hero/{hero_id}/respond")
def hero_respond(hero_id: str, body: dict) -> dict:
    action = str(body.get("action", ""))
    if action not in HERO_FLOW:
        raise HTTPException(422, "action must be accept, decline, arrived, cpr or done")
    inc = get_or_404(str(body.get("incident_id", "")))
    v = next((v for v in inc.get("volunteers", []) if v["id"] == hero_id.upper()), None)
    if not v:
        raise HTTPException(404, "This hero was not alerted for this incident")
    at = now_iso()
    v["status"], v["updated_at"] = HERO_FLOW[action], at
    if action == "cpr" and not v.get("cpr_at"):
        v["cpr_at"] = at
    note = {"accept": f"{v['name']} (CPR hero) is on the way — {v['distance_m']} m, ~{round(v['eta_min'])} min",
            "decline": f"{v['name']} (CPR hero) cannot come",
            "arrived": f"{v['name']} (CPR hero) arrived on scene",
            "cpr": f"{v['name']} started CPR / first aid — survival decline slowed",
            "done": f"{v['name']} handed over to the ambulance crew"}[action]
    inc["timeline"].append({"at": at, "status": inc["status"], "note": note, "actor": "hero"})
    inc["updated_at"] = at
    if action == "decline":
        alert_heroes(inc, 1, actor="system")
    if action == "done":
        for h in db.docs("hero"):
            if h["id"] == v["id"]:
                h["rescues"] = int(h.get("rescues", 0)) + 1
                db.put_doc("hero", h)
    db.save(inc)
    return inc
