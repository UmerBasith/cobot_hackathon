"""Round 2: teams, right-team suggestion, escalation, similar-incident detection."""
from __future__ import annotations

from datetime import datetime, timezone

from .geo import AREAS, haversine_m

# (id, name, type, area)
TEAMS_SEED = [
    ("FIRE-EGM", "Fire Engine · Egmore", "fire", "Egmore"),
    ("FIRE-TNG", "Fire Engine · T. Nagar", "fire", "T. Nagar"),
    ("FIRE-GDY", "Fire Engine · Guindy", "fire", "Guindy"),
    ("FIRE-TBM", "Fire Engine · Tambaram", "fire", "Tambaram"),
    ("ALS-GGH", "ALS Ambulance · Govt General", "ambulance_als", "Egmore"),
    ("ALS-VLC", "ALS Ambulance · Velachery", "ambulance_als", "Velachery"),
    ("BLS-ADY", "BLS Ambulance · Adyar", "ambulance_bls", "Adyar"),
    ("BLS-ANN", "BLS Ambulance · Anna Nagar", "ambulance_bls", "Anna Nagar"),
    ("POL-MYL", "Police Patrol · Mylapore", "police", "Mylapore"),
    ("POL-TBM", "Police Patrol · Tambaram", "police", "Tambaram"),
    ("NDRF-VDL", "NDRF Team · Vandalur", "ndrf", "Vandalur"),
    ("BOAT-ADY", "Rescue Boat · Adyar", "boat", "Adyar"),
    ("BOAT-VLC", "Rescue Boat · Velachery", "boat", "Velachery"),
]

TEAM_TYPE_LABELS = {"fire": "Fire engine", "ambulance_als": "ALS ambulance", "ambulance_bls": "BLS ambulance",
                    "police": "Police", "ndrf": "NDRF rescue", "boat": "Rescue boat"}
SPEED_KMH = {"boat": 20}
MOBILISE_MIN = 2


def make_teams() -> list[dict]:
    out = []
    for tid, name, ttype, area in TEAMS_SEED:
        lat, lng = AREAS[area]
        out.append({"id": tid, "name": name, "type": ttype, "type_label": TEAM_TYPE_LABELS[ttype], "station": area,
                    "lat": lat, "lng": lng, "status": "available", "current_incident": None})
    return out


def required_slots(inc: dict) -> list[dict]:
    """Which kinds of team this incident needs. 'types' = acceptable team types, best first."""
    crit = inc["severity"] == "Critical"
    hurt = inc.get("life_threat") or inc.get("injuries") != "none" or inc.get("injured_count", 0) > 0
    amb = {"slot": "Ambulance", "types": ["ambulance_als", "ambulance_bls"] if crit or inc.get("injuries") == "serious"
           else ["ambulance_bls", "ambulance_als"]}
    fire = {"slot": "Fire engine", "types": ["fire"]}
    police = {"slot": "Police", "types": ["police"]}
    cat = inc["category"]
    slots = {
        "fire": [fire] + ([amb] if hurt else []),
        "medical": [amb],
        "road_accident": [amb, police],
        "flood": [{"slot": "Rescue boat", "types": ["boat", "ndrf"]}] + ([amb] if hurt or crit else []),
        "building_collapse": [{"slot": "Search & rescue", "types": ["ndrf", "fire"]}, fire, amb],
        "gas_leak": [fire, police],
        "electrical": [fire, police] + ([amb] if hurt else []),
        "other": [police] + ([amb] if hurt else []),
    }[cat]
    if crit and cat == "fire":
        slots.insert(1, {"slot": "Second fire engine", "types": ["fire"]})
    return slots


def eta(team: dict, lat: float, lng: float) -> tuple[float, float]:
    km = haversine_m(team["lat"], team["lng"], lat, lng) / 1000
    minutes = MOBILISE_MIN + km / SPEED_KMH.get(team["type"], 25) * 60
    return round(km, 1), round(minutes, 1)


def suggest(inc: dict, teams: list[dict]) -> list[dict]:
    lat, lng = inc.get("lat"), inc.get("lng")
    if lat is None or lng is None:
        lat, lng = AREAS.get(inc["area"], (13.0, 80.2))
    taken = {a["team_id"] for a in inc.get("assignments", []) if a["status"] not in ("rejected", "completed")}
    used: set[str] = set()
    out = []
    for slot in required_slots(inc):
        cands = []
        for t in teams:
            if t["type"] not in slot["types"] or t["status"] != "available" or t["id"] in taken:
                continue
            km, mins = eta(t, lat, lng)
            pref = slot["types"].index(t["type"])
            cands.append({"team": t, "eta_min": mins, "distance_km": km, "_k": (pref, mins)})
        cands.sort(key=lambda c: c["_k"])
        for c in cands:
            c.pop("_k")
        best = next((c for c in cands if c["team"]["id"] not in used), None)
        if best:
            used.add(best["team"]["id"])
        out.append({"slot": slot["slot"], "best": best["team"]["id"] if best else None, "candidates": cands[:3]})
    return out


def minutes_since(iso: str) -> float:
    t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - t).total_seconds() / 60


def active_assignments(inc: dict) -> list[dict]:
    return [a for a in inc.get("assignments", []) if a["status"] in ("assigned", "accepted", "en_route", "on_scene")]


def escalations(incidents: list[dict], teams: list[dict]) -> list[dict]:
    out = []
    for inc in incidents:
        if inc["status"] == "Resolved" or active_assignments(inc):
            continue
        waited = minutes_since(inc["created_at"])
        if inc["severity"] == "Critical" and waited > 2:
            out.append({"level": "critical", "incident_id": inc["id"],
                        "message": f"{inc['id']} Critical · {inc['title']} — no team assigned for {int(waited)} min"})
        elif inc["severity"] == "High" and waited > 5:
            out.append({"level": "warning", "incident_id": inc["id"],
                        "message": f"{inc['id']} High · {inc['title']} — waiting {int(waited)} min for a team"})
    for a_inc in incidents:
        for a in a_inc.get("assignments", []):
            if a["status"] == "assigned" and minutes_since(a["assigned_at"]) > 1:
                out.append({"level": "warning", "incident_id": a_inc["id"],
                            "message": f"{a['team_name']} has not accepted {a_inc['id']} for over 1 min"})
    for ttype, label in TEAM_TYPE_LABELS.items():
        if not any(t["type"] == ttype and t["status"] == "available" for t in teams):
            out.append({"level": "warning", "incident_id": None, "message": f"Resource shortage: no {label} available"})
    order = {"critical": 0, "warning": 1}
    return sorted(out, key=lambda e: order[e["level"]])


RELATED = [{"fire", "gas_leak", "electrical"}, {"flood", "building_collapse"}]


def similar(inc: dict, incidents: list[dict]) -> list[dict]:
    """Possible duplicates: related category, within 500 m, reported within 60 min, still open."""
    out = []
    if inc.get("lat") is None:
        return out
    for o in incidents:
        if o["id"] == inc["id"] or o["status"] == "Resolved" or o.get("lat") is None or o.get("duplicate_of"):
            continue
        same = o["category"] == inc["category"] or any(inc["category"] in g and o["category"] in g for g in RELATED)
        d = haversine_m(inc["lat"], inc["lng"], o["lat"], o["lng"])
        gap = abs(minutes_since(inc["created_at"]) - minutes_since(o["created_at"]))
        if same and d <= 500 and gap <= 60:
            out.append({"id": o["id"], "title": o["title"], "severity": o["severity"], "status": o["status"],
                        "distance_m": int(d), "minutes_apart": int(gap)})
    return sorted(out, key=lambda x: x["distance_m"])
