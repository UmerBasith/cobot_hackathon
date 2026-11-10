"""Chennai areas and critical places (approximate coordinates, demo use)."""
from __future__ import annotations

import math

AREAS: dict[str, tuple[float, float]] = {
    "T. Nagar": (13.0418, 80.2341), "Mylapore": (13.0368, 80.2676), "Adyar": (13.0012, 80.2565),
    "Egmore": (13.0732, 80.2609), "Velachery": (12.9815, 80.2180), "Porur": (13.0382, 80.1565),
    "Anna Nagar": (13.0850, 80.2101), "Sholinganallur": (12.9010, 80.2279), "Tambaram": (12.9249, 80.1000),
    "Perambur": (13.1143, 80.2329), "Guindy": (13.0067, 80.2206), "Royapuram": (13.1137, 80.2954),
    "Chromepet": (12.9516, 80.1462), "Vandalur": (12.8916, 80.0810),
}

# (name, type, lat, lng)
PLACES: list[tuple[str, str, float, float]] = [
    ("Rajiv Gandhi Govt General Hospital", "hospital", 13.0815, 80.2774),
    ("Govt Stanley Hospital", "hospital", 13.1066, 80.2869),
    ("Kilpauk Medical College Hospital", "hospital", 13.0782, 80.2420),
    ("MIOT Hospital", "hospital", 13.0219, 80.1854),
    ("Tambaram Govt Hospital", "hospital", 12.9246, 80.1186),
    ("Chennai Central Station", "station", 13.0827, 80.2757),
    ("Kapaleeshwarar Temple", "temple", 13.0337, 80.2697),
    ("Crescent Institute", "school", 12.8780, 80.0820),
]

PLACE_POINTS = {"hospital": 8, "school": 6, "temple": 6, "station": 6}
NEAR_M = 300


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_place(lat: float | None, lng: float | None) -> tuple[str, str] | None:
    """Return (name, type) of a critical place within NEAR_M metres, else None."""
    if lat is None or lng is None:
        return None
    best = min(PLACES, key=lambda p: haversine_m(lat, lng, p[2], p[3]))
    return (best[0], best[1]) if haversine_m(lat, lng, best[2], best[3]) <= NEAR_M else None


def area_coords(area: str) -> tuple[float, float] | None:
    return AREAS.get(area)
