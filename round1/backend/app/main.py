"""ResQNet API.  Run from the backend folder:  ../../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
API docs: http://127.0.0.1:8000/docs"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .dispatch import active_assignments, escalations, eta, make_teams, similar, suggest
from .schemas import (Alert, AlertIn, AssignIn, AssignmentStatusIn, DuplicateIn, Escalation, Incident, PreviewIn,
                      ReportIn, RespondIn, ResponderJob, SeverityOut, Similar, SimulateIn, Stats, StatusIn,
                      SuggestSlot, Team)
from .seed import SEED, SIMULATE_FLOOD
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
           "witnesses": 0, "assignments": [],
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
    for t in make_teams():
        db.put_doc("team", t)
    for minutes, status, report in sorted(SEED, key=lambda s: -s[0]):
        full = {**DEFAULTS, **report}
        inc = db.insert(lambda seq, r=full, s=status, m=minutes: build_incident(seq, r, s, m))
        if status == "In Progress":  # give in-progress incidents a team that is on the way / on scene
            teams = list(teams_by_id().values())
            for slot in suggest(inc, teams)[:1]:
                if slot["best"]:
                    a = new_assignment(inc, teams_by_id()[slot["best"]], "on_scene" if minutes > 20 else "en_route",
                                       now_iso(max(0, minutes - 3)))
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
    return db.insert(lambda seq: build_incident(seq, report))


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
