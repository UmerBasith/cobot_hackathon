"""CPR Hero Network — registered, CPR-trained citizens near an emergency are alerted to help before the ambulance."""
from __future__ import annotations

from .geo import haversine_m

# (id, name, skills, lat, lng, phone)
HEROES_SEED = [
    ("HERO-01", "Priya S", ["CPR", "First aid"], 13.0405, 80.2350, "98400 11111"),      # T. Nagar
    ("HERO-02", "Arjun K", ["CPR", "First aid", "Swimmer"], 12.9800, 80.2200, "98400 22222"),  # Velachery
    ("HERO-03", "Dr. Fathima R", ["CPR", "Doctor"], 13.0375, 80.2660, "98400 33333"),  # Mylapore
    ("HERO-04", "Karthik M", ["CPR"], 13.0030, 80.2580, "98400 44444"),                 # Adyar
    ("HERO-05", "Meena V", ["CPR", "Nurse"], 13.0860, 80.2120, "98400 55555"),          # Anna Nagar
    ("HERO-06", "Rahul J", ["First aid", "Swimmer"], 12.9260, 80.1020, "98400 66666"),  # Tambaram
    ("HERO-07", "Sana A", ["CPR", "First aid"], 13.0720, 80.2590, "98400 77777"),       # Egmore
    ("HERO-08", "Vignesh P", ["CPR"], 13.0080, 80.2180, "98400 88888"),                 # Guindy
    ("HERO-09", "Lakshmi N", ["CPR", "First aid"], 12.9020, 80.2270, "98400 99999"),    # Sholinganallur
    ("HERO-10", "Imran H", ["CPR", "Paramedic"], 12.8930, 80.0820, "98401 00000"),      # Vandalur
    ("HERO-11", "Deepa R", ["CPR", "First aid"], 13.0460, 80.2280, "98401 11111"),      # T. Nagar west
    ("HERO-12", "Suresh B", ["CPR", "Swimmer"], 12.9760, 80.2250, "98401 22222"),       # Velachery south
    ("HERO-13", "Anitha G", ["CPR"], 13.0350, 80.2420, "98401 33333"),                  # T. Nagar / Nandanam
]

HERO_SPEED_KMH = 12  # running / two-wheeler mix
RADIUS_M = 3000


def make_heroes() -> list[dict]:
    return [{"id": i, "name": n, "skills": s, "lat": la, "lng": lo, "phone": ph, "available": True,
             "verified": True, "rescues": 0} for i, n, s, la, lo, ph in HEROES_SEED]


def needs_heroes(inc: dict) -> bool:
    """CPR / first-aid heroes help with life threats and serious injuries."""
    return inc["status"] != "Resolved" and (bool(inc.get("life_threat")) or inc.get("injuries") == "serious")


LIVE_TTL_S = 60  # a live website user counts as online if seen in the last minute


def is_online(h: dict) -> bool:
    if not h.get("live"):
        return True
    from datetime import datetime, timezone
    seen = datetime.fromisoformat(h["last_seen"].replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - seen).total_seconds() <= LIVE_TTL_S


def nearby(inc: dict, heroes: list[dict], radius_m: float = RADIUS_M) -> list[dict]:
    """Heroes within radius; real website users (live) first, then by distance."""
    from .geo import AREAS
    lat, lng = inc.get("lat"), inc.get("lng")
    if lat is None or lng is None:
        lat, lng = AREAS.get(inc.get("area", ""), (None, None))
    if lat is None:
        return []
    out = []
    for h in heroes:
        if not is_online(h):
            continue
        d = haversine_m(lat, lng, h["lat"], h["lng"])
        if d <= radius_m:
            out.append({"hero": h, "distance_m": int(d), "eta_min": round(1 + d / 1000 / HERO_SPEED_KMH * 60, 1)})
    return sorted(out, key=lambda x: (not x["hero"].get("live"), x["distance_m"]))
