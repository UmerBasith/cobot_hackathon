"""Disaster zones + shelters (seed data, approximate Chennai locations)."""
from __future__ import annotations

ZONE_STATUSES = ["critical", "evacuate", "watch", "safe"]

# (area, status, note)
ZONES_SEED = [
    ("Velachery", "critical", "Lake overflow, 1st floors flooded"),
    ("Tambaram", "evacuate", "Low-lying streets near Mudichur flooding"),
    ("Adyar", "evacuate", "River level rising near Srinivasapuram"),
    ("Sholinganallur", "watch", "Waterlogging on OMR service roads"),
    ("Chromepet", "watch", "GST Road accidents, wet roads"),
    ("Guindy", "watch", "Heavy rain expected"),
    ("T. Nagar", "safe", "Normal"), ("Mylapore", "safe", "Normal"), ("Egmore", "safe", "Normal"),
    ("Porur", "watch", "Hospital fire response ongoing"), ("Anna Nagar", "safe", "Normal"),
    ("Perambur", "safe", "Normal"), ("Royapuram", "watch", "Old buildings weakened by rain"),
    ("Vandalur", "safe", "Normal"),
]

# (id, name, area, lat, lng, capacity, occupancy, facilities)
SHELTERS_SEED = [
    ("SH-1", "Velachery Govt Higher Sec. School", "Velachery", 12.9780, 80.2230, 400, 362, ["food", "water", "medical"]),
    ("SH-2", "Guindy Community Hall", "Guindy", 13.0090, 80.2150, 250, 120, ["food", "water"]),
    ("SH-3", "Tambaram Corporation Marriage Hall", "Tambaram", 12.9230, 80.1150, 300, 288, ["food", "water", "medical"]),
    ("SH-4", "Adyar Kalakshetra Hall", "Adyar", 13.0050, 80.2610, 200, 74, ["food", "water", "power backup"]),
    ("SH-5", "Crescent Institute Auditorium", "Vandalur", 12.8780, 80.0820, 500, 96, ["food", "water", "medical", "power backup"]),
    ("SH-6", "T. Nagar Corporation School", "T. Nagar", 13.0400, 80.2360, 150, 20, ["water"]),
]
