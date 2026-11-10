"""Predictive Risk Radar — which areas will need help in the next 6 hours, BEFORE people call.

risk (0-100) = 40 % rain-driven flood risk (forecast rain x how flood-prone the area is)
             + 25 % live pressure (open / critical incidents in the area now)
             + 15 % base vulnerability (flood history)
             + 20 % coverage gap (how far the nearest free rescue boat / ambulance is)
Flood-prone values are a simplified demo index from Chennai's 2015 / 2023 flood history. Rule-based, not AI.
"""
from __future__ import annotations

import json
import time
import urllib.request

from .geo import AREAS, haversine_m

FLOOD_PRONE = {"Velachery": 0.95, "Tambaram": 0.85, "Adyar": 0.8, "Sholinganallur": 0.75, "Chromepet": 0.6,
               "Porur": 0.55, "Guindy": 0.5, "Perambur": 0.5, "Royapuram": 0.55, "T. Nagar": 0.45, "Mylapore": 0.4,
               "Egmore": 0.35, "Anna Nagar": 0.3, "Vandalur": 0.4}
_CACHE: dict = {"at": 0.0, "data": None}


def forecast_mm() -> tuple[dict[str, float], str]:
    """Rain (mm) expected in the next 6 h per area from Open-Meteo (free, no key). Cached 10 min."""
    if _CACHE["data"] is not None and time.time() - _CACHE["at"] < 600:
        return _CACHE["data"], "live"
    lats = ",".join(str(v[0]) for v in AREAS.values())
    lngs = ",".join(str(v[1]) for v in AREAS.values())
    url = (f"https://api.open-meteo.com/v1/forecast?latitude={lats}&longitude={lngs}"
           "&hourly=precipitation&forecast_hours=6&timezone=Asia%2FKolkata")
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            data = json.loads(r.read())
        rows = data if isinstance(data, list) else [data]
        out = {area: round(sum(x or 0 for x in rows[i]["hourly"]["precipitation"]), 1) for i, area in enumerate(AREAS)}
        _CACHE.update(at=time.time(), data=out)
        return out, "live"
    except Exception:  # noqa: BLE001 — offline: no forecast
        return {a: 0.0 for a in AREAS}, "unavailable"


def radar(incidents: list[dict], teams: list[dict], scenario: str | None = None) -> dict:
    if scenario == "heavy_rain":  # demo: a cyclone band (mm in next 6 h), heavier in the south
        rain = {a: round(30 + 70 * FLOOD_PRONE[a] * (1.2 if AREAS[a][0] < 13.0 else 0.8), 1) for a in AREAS}
        source = "demo scenario: heavy rain"
    else:
        rain, source = forecast_mm()
    open_inc = [i for i in incidents if i["status"] != "Resolved"]
    free = [t for t in teams if t["status"] == "available" and t["type"] in ("boat", "ndrf", "ambulance_als", "ambulance_bls")]
    out = []
    for area, (lat, lng) in AREAS.items():
        prone = FLOOD_PRONE.get(area, 0.4)
        mm = rain.get(area, 0.0)
        rain_n = min(1.0, mm / 60)  # 60 mm in 6 h = extreme
        here = [i for i in open_inc if i["area"] == area]
        crit = sum(i["severity"] == "Critical" for i in here)
        pressure = min(1.0, (len(here) + 2 * crit) / 6)
        dists = sorted(((haversine_m(lat, lng, t["lat"], t["lng"]) / 1000, t) for t in free), key=lambda d: d[0])
        near_km = dists[0][0] if dists else 30.0
        gap = min(1.0, near_km / 15)
        score = round(100 * (0.40 * rain_n * prone + 0.25 * pressure + 0.15 * prone + 0.20 * gap))
        level = "severe" if score >= 70 else "high" if score >= 50 else "elevated" if score >= 30 else "low"
        drivers = []
        if mm:
            drivers.append(f"{mm} mm rain expected in 6 h")
        drivers.append(f"Flood-prone index {round(prone * 100)}%")
        if here:
            drivers.append(f"{len(here)} open incident(s){f', {crit} critical' if crit else ''}")
        drivers.append(f"Nearest free rescue unit {round(near_km, 1)} km away" if dists else "No free rescue unit")
        rec = None
        if level in ("severe", "high"):
            boats = [d for d in dists if d[1]["type"] in ("boat", "ndrf")]
            pick = (boats or dists or [None])[0]
            if pick and pick[0] > 2:
                rec = {"team_id": pick[1]["id"], "team_name": pick[1]["name"],
                       "text": f"Pre-position {pick[1]['name']} at {area} now ({round(pick[0], 1)} km away)"}
            elif pick:
                rec = {"team_id": pick[1]["id"], "team_name": pick[1]["name"],
                       "text": f"{pick[1]['name']} already close — keep it on standby for {area}"}
            else:
                rec = {"team_id": None, "team_name": None, "text": f"Request backup units for {area}"}
        out.append({"area": area, "lat": lat, "lng": lng, "risk": score, "level": level, "rain_mm_6h": mm,
                    "flood_prone": prone, "open_incidents": len(here), "critical_incidents": crit,
                    "nearest_unit_km": round(near_km, 1), "drivers": drivers, "recommendation": rec})
    out.sort(key=lambda x: -x["risk"])
    return {"source": source, "areas": out, "max_risk": out[0]["risk"] if out else 0,
            "method": "risk = 40% rain x flood-prone + 25% open/critical incidents + 15% flood history + 20% distance "
                      "to nearest free rescue unit. Rule-based; flood-prone index is a simplified demo value."}
