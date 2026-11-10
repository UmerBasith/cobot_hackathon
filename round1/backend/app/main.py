"""ResQNet API.  Run from the backend folder:  ../../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
API docs: http://127.0.0.1:8000/docs"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .schemas import DuplicateIn, Incident, PreviewIn, ReportIn, SeverityOut, Stats, StatusIn
from .seed import SEED
from .severity import CATEGORY_LABELS, LEVELS, assess

STATUSES = ["Reported", "Pending", "In Progress", "Resolved"]


def now_iso(delta_min: int = 0) -> str:
    t = datetime.now(timezone.utc) - timedelta(minutes=delta_min)
    return t.isoformat(timespec="seconds").replace("+00:00", "Z")


def build_incident(seq: int, report: dict, status: str = "Reported", minutes_ago: int = 0, actor: str = "citizen") -> dict:
    created = now_iso(minutes_ago)
    inc = {**report, **assess(report), "id": f"INC-{seq}", "status": "Reported", "duplicate_of": None,
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


def reset_data() -> int:
    db.clear()
    for minutes, status, report in sorted(SEED, key=lambda s: -s[0]):
        full = {"lat": None, "lng": None, "landmark": "", "people_affected": 0, "injured_count": 0, "injuries": "none",
                "life_threat": False, "hazard": "small", "active": True, "vulnerable": [],
                "contact_name": "", "contact_phone": "", **report}
        db.insert(lambda seq, r=full, s=status, m=minutes: build_incident(seq, r, s, m))
    return db.count()


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
    get_or_404(target)
    at = now_iso()
    inc["duplicate_of"] = target
    inc["timeline"].append({"at": at, "status": "Resolved", "note": f"Duplicate of {target}", "actor": "admin"})
    inc["status"], inc["updated_at"] = "Resolved", at
    db.save(inc)
    return inc


@app.delete("/api/incidents/{inc_id}")
def delete_incident(inc_id: str) -> dict:
    get_or_404(inc_id)
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
