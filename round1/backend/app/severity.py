"""Deterministic, explainable severity engine.  Score = L + H + E + V + T (max 100), then override rules."""
from __future__ import annotations

from typing import Any

from .geo import PLACE_POINTS, area_coords, nearest_place

LEVELS = ["Low", "Medium", "High", "Critical"]
CATEGORY_LABELS = {
    "fire": "Fire", "road_accident": "Road accident", "medical": "Medical emergency", "flood": "Flood",
    "building_collapse": "Building collapse", "gas_leak": "Gas leak", "electrical": "Electrical hazard", "other": "Other",
}
HAZARD_POINTS = {"small": 5, "medium": 12, "large": 20, "spreading": 25}
VULN_POINTS = {"children": 4, "elderly": 4, "patients": 5, "disabled": 5, "pregnant": 5}
FAST_WORSENING = {"fire", "gas_leak", "flood", "electrical", "building_collapse"}


def level_for(score: int) -> str:
    return "Critical" if score >= 70 else "High" if score >= 45 else "Medium" if score >= 25 else "Low"


def people_points(n: int) -> int:
    return 0 if n <= 0 else 3 if n <= 5 else 7 if n <= 20 else 12 if n <= 100 else 15


def assess(r: dict[str, Any]) -> dict[str, Any]:
    """r: report fields (see ReportIn). Returns {score, severity, reasons, place_type, place_name, flags}."""
    reasons: list[dict[str, Any]] = []
    flags: list[str] = []
    cat = r.get("category", "other")
    injuries = r.get("injuries", "none")
    injured = int(r.get("injured_count") or 0)
    life = bool(r.get("life_threat"))
    hazard = r.get("hazard", "small")
    active = bool(r.get("active", True))
    people = int(r.get("people_affected") or 0)

    lat, lng = r.get("lat"), r.get("lng")
    if (lat is None or lng is None) and r.get("area"):
        c = area_coords(r["area"])
        if c:
            lat, lng = c
    place = nearest_place(lat, lng)

    # L — life threat
    if life:
        reasons.append({"label": "Unconscious / not breathing / trapped", "points": 35, "rule": None})
    elif injuries == "serious":
        reasons.append({"label": "Serious injuries", "points": 18, "rule": None})
    elif injuries == "minor":
        reasons.append({"label": "Minor injuries", "points": 8, "rule": None})
    # H — hazard
    reasons.append({"label": f"Hazard size: {hazard}", "points": HAZARD_POINTS.get(hazard, 5), "rule": None})
    # E — exposure (cap 20)
    pp = people_points(people)
    place_pts = PLACE_POINTS.get(place[1], 0) if place else 0
    if pp:
        reasons.append({"label": f"{people} {'person' if people == 1 else 'people'} affected", "points": pp, "rule": None})
    if place_pts:
        reasons.append({"label": f"Near {place[0]} ({place[1]})", "points": min(place_pts, 20 - pp), "rule": None})
    # V — vulnerability (cap 10)
    v_total = 0
    for v in r.get("vulnerable") or []:
        pts = min(VULN_POINTS.get(v, 0), 10 - v_total)
        if pts > 0:
            reasons.append({"label": f"Vulnerable people: {v}", "points": pts, "rule": None})
            v_total += pts
    # T — time critical
    fast = (active and cat in FAST_WORSENING) or (cat == "medical" and (life or injuries == "serious"))
    reasons.append({"label": "Situation worsens fast" if fast else "Situation stable",
                    "points": 6 if fast else 2, "rule": None})

    score = min(100, sum(x["points"] for x in reasons))
    base = level_for(score)
    lvl = LEVELS.index(base)

    def raise_to(level: str, rule: str, label: str) -> None:
        nonlocal lvl
        if LEVELS.index(level) > lvl:
            lvl = LEVELS.index(level)
            reasons.append({"label": f"{label} → at least {level}", "points": 0, "rule": rule})

    if life:
        raise_to("Critical", "R1", "Life threat (trapped / not breathing / unconscious)")
    if injured >= 5:
        raise_to("Critical", "R2", f"Mass casualty ({injured} injured)")
    if hazard == "spreading" and place:
        raise_to("Critical", "R3", f"Spreading hazard near {place[1]}")
    if active and cat in {"fire", "gas_leak", "electrical"}:
        raise_to("High", "R5", f"Active {CATEGORY_LABELS[cat].lower()}")
    if injuries != "none" or injured > 0:
        raise_to("Medium", "R6", "People injured")
    if not life and injuries == "none" and injured == 0 and hazard != "spreading" and people == 0 and lvl > 1 \
            and not (active and cat in {"fire", "gas_leak", "electrical"}):
        lvl = 1
        reasons.append({"label": "Property only, nobody at risk → at most Medium", "points": 0, "rule": "R7"})
    if len((r.get("description") or "").strip()) < 15:
        flags.append("needs_verification")

    return {"score": int(score), "severity": LEVELS[lvl], "reasons": reasons,
            "place_type": place[1] if place else None, "place_name": place[0] if place else None, "flags": flags}
