"""Golden Hour Engine — dispatch by survival, not just by severity or distance.

Each incident gets a survival profile: how fast the chance of survival falls while people wait for help.
Survival is modelled as exponential decay with a half-life per condition. The figures are simplified,
order-of-magnitude values from public emergency-medicine guidance (e.g. cardiac-arrest survival falls
roughly 7-10 % per minute without CPR; bystander CPR slows that fall; major trauma "golden hour";
people trapped under debris survive hours to days). They are DEMO assumptions, not clinical predictions.
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timezone

from .dispatch import SPEED_KMH, MOBILISE_MIN, required_slots, active_assignments
from .geo import AREAS, haversine_m

P0 = 0.95  # chance of survival at the moment of the report
DELAY_IF_UNASSIGNED = 90  # minutes until help if no team is sent in this wave (next free team)

# key -> (label, half-life in minutes without help, slowdown factor once CPR / first aid starts, basis)
PROFILES: dict[str, tuple[str, float, float, str]] = {
    "cardiac": ("Cardiac arrest / not breathing", 7, 3.0,
                "Survival falls about 10 % per minute without CPR; CPR slows the fall."),
    "fire_trapped": ("Trapped in fire / smoke", 12, 1.5, "Smoke and heat kill within minutes."),
    "drowning": ("Trapped in rising water", 25, 1.5, "Rising water: minutes to an hour."),
    "toxic": ("Gas / electric shock exposure", 20, 2.0, "Toxic gas or electric shock: minutes."),
    "trauma": ("Major trauma (golden hour)", 60, 2.0, "Major injuries: the first hour decides survival."),
    "debris": ("Trapped under debris", 600, 1.5, "Trapped under debris: survival over hours to days."),
    "serious": ("Serious injury", 120, 2.0, "Serious but stable injuries: hours."),
    "minor": ("Minor injury", 2880, 1.0, "Minor injuries: no real time pressure."),
}


def profile_key(inc: dict) -> str | None:
    cat, life = inc["category"], bool(inc.get("life_threat"))
    serious = inc.get("injuries") == "serious"
    if life:
        if cat == "medical":
            return "cardiac"
        if cat == "fire":
            return "fire_trapped"
        if cat == "flood":
            return "drowning"
        if cat in ("gas_leak", "electrical"):
            return "toxic"
        if cat in ("building_collapse", "landslide"):
            return "debris"
        return "trauma"
    if serious:
        return "trauma" if cat == "road_accident" or (inc.get("injured_count") or 0) >= 3 else "serious"
    if inc.get("injuries") == "minor" or (inc.get("injured_count") or 0) > 0:
        return "minor"
    return None


def at_risk(inc: dict) -> int:
    injured = int(inc.get("injured_count") or 0)
    if inc.get("life_threat"):
        return max(1, injured, min(int(inc.get("people_affected") or 1), 20))
    if inc.get("injuries") != "none" or injured:
        return max(1, injured)
    return 0


def survival(t: float, half: float, cpr_at: float | None = None, slow: float = 1.0, help_at: float | None = None) -> float:
    """Survival probability t minutes after the report. Decay slows after cpr_at, stops when help arrives."""
    end = t if help_at is None else min(t, help_at)
    if cpr_at is None or cpr_at >= end:
        return P0 * 0.5 ** (max(0.0, end) / half)
    before = P0 * 0.5 ** (max(0.0, cpr_at) / half)
    return before * 0.5 ** ((end - cpr_at) / (half * slow))


def _mins(a: str, b: datetime | None = None) -> float:
    ta = datetime.fromisoformat(a.replace("Z", "+00:00"))
    tb = b or datetime.now(timezone.utc)
    return (tb - ta).total_seconds() / 60


def eta_min(team: dict, lat: float, lng: float) -> float:
    km = haversine_m(team["lat"], team["lng"], lat, lng) / 1000
    return MOBILISE_MIN + km / SPEED_KMH.get(team["type"], 25) * 60


def loc(inc: dict) -> tuple[float, float]:
    if inc.get("lat") is not None and inc.get("lng") is not None:
        return inc["lat"], inc["lng"]
    return AREAS.get(inc["area"], (13.0, 80.2))


def cpr_time(inc: dict) -> float | None:
    """Minutes after the report when a CPR hero / first aider started helping (None = not yet)."""
    starts = [v["cpr_at"] for v in inc.get("volunteers", []) if v.get("cpr_at")]
    return min(_mins(inc["created_at"], datetime.fromisoformat(s.replace("Z", "+00:00"))) for s in starts) if starts else None


def help_time(inc: dict, teams: dict[str, dict]) -> tuple[float | None, str]:
    """Minutes after report when professional help is (or is expected to be) on scene."""
    best: float | None = None
    how = "No team assigned"
    for a in inc.get("assignments", []):
        if a["status"] in ("rejected",):
            continue
        assigned = _mins(inc["created_at"], datetime.fromisoformat(a["assigned_at"].replace("Z", "+00:00")))
        if a["status"] in ("on_scene", "completed"):
            t = _mins(inc["created_at"], datetime.fromisoformat(a["updated_at"].replace("Z", "+00:00")))
            label = f"{a['team_name']} on scene"
        else:
            t = assigned + a["eta_min"]
            label = f"{a['team_name']} arriving (ETA {round(a['eta_min'])} min)"
        if best is None or t < best:
            best, how = t, label
    return best, how


def row(inc: dict, teams: dict[str, dict], now: datetime | None = None) -> dict | None:
    key = profile_key(inc)
    n = at_risk(inc)
    if not key or not n or inc["status"] == "Resolved":
        return None
    label, half, slow, basis = PROFILES[key]
    t_now = _mins(inc["created_at"], now)
    cpr = cpr_time(inc)
    h, how = help_time(inc, teams)
    planned = h if h is not None else t_now + DELAY_IF_UNASSIGNED
    s_now = survival(t_now, half, cpr, slow, h)
    s_arr = survival(planned, half, cpr, slow)
    s_late = survival(planned + 5, half, cpr, slow)
    loss = n * (survival(planned, half, cpr, slow) - survival(planned + 1, half, cpr, slow))
    return {
        "incident_id": inc["id"], "title": inc["title"], "category": inc["category"], "area": inc["area"],
        "severity": inc["severity"], "status": inc["status"], "profile": key, "profile_label": label,
        "basis": basis, "half_life_min": half, "people_at_risk": n, "minutes_since_report": round(t_now, 1),
        "help_eta_min": None if h is None else round(h, 1), "help": how, "cpr_started": cpr is not None,
        "survival_now": round(s_now, 3), "survival_at_help": round(s_arr, 3), "survival_if_5_min_later": round(s_late, 3),
        "expected_survivors": round(n * s_arr, 2), "lives_lost_per_min_delay": round(loss, 3),
    }


def _acceptable(inc: dict, team: dict) -> bool:
    slots = required_slots(inc)  # the primary need only (boat for flood, ambulance for trauma, ...)
    return bool(slots) and team["type"] in slots[0]["types"]


def plan(incidents: list[dict], teams: list[dict], now: datetime | None = None) -> dict:
    """Assign free teams to unassigned life-risk incidents. Golden Hour (greedy max lives gained) vs nearest-first."""
    tmap = {t["id"]: t for t in teams}
    todo = []
    for inc in incidents:
        if inc["status"] == "Resolved" or active_assignments(inc):
            continue
        key = profile_key(inc)
        n = at_risk(inc)
        if key and n:
            todo.append((inc, key, n, _mins(inc["created_at"], now)))
    free = [t for t in teams if t["status"] == "available"]

    def gain(item, team) -> float:
        inc, key, n, t_now = item
        _, half, slow, _ = PROFILES[key]
        cpr = cpr_time(inc)
        arrive = t_now + eta_min(team, *loc(inc))
        return n * (survival(arrive, half, cpr, slow) - survival(t_now + DELAY_IF_UNASSIGNED, half, cpr, slow))

    def survivors(assign: dict[str, dict]) -> float:
        total = 0.0
        for inc, key, n, t_now in todo:
            _, half, slow, _ = PROFILES[key]
            cpr = cpr_time(inc)
            team = assign.get(inc["id"])
            arrive = t_now + (eta_min(team, *loc(inc)) if team else DELAY_IF_UNASSIGNED)
            total += n * survival(arrive, half, cpr, slow)
        return total

    # Golden Hour: repeatedly take the (incident, team) pair that saves the most expected lives
    gh: dict[str, dict] = {}
    pool = list(free)
    left = list(todo)
    while left and pool:
        best = max(((g, it, tm) for it in left for tm in pool if _acceptable(it[0], tm) for g in [gain(it, tm)]),
                   key=lambda x: x[0], default=None)
        if not best or best[0] <= 0:
            break
        _, it, tm = best
        gh[it[0]["id"]] = tm
        pool.remove(tm)
        left.remove(it)
    # Baseline: first come, first served, nearest suitable team
    nf: dict[str, dict] = {}
    pool = list(free)
    for it in sorted(todo, key=lambda x: x[0]["created_at"]):
        cands = [t for t in pool if _acceptable(it[0], t)]
        if cands:
            tm = min(cands, key=lambda t: eta_min(t, *loc(it[0])))
            nf[it[0]["id"]] = tm
            pool.remove(tm)
    steps = []
    for it in sorted(todo, key=lambda x: -gain(x, gh[x[0]["id"]]) if x[0]["id"] in gh else 0):
        inc = it[0]
        if inc["id"] in gh:
            tm = gh[inc["id"]]
            steps.append({"incident_id": inc["id"], "title": inc["title"], "profile_label": PROFILES[it[1]][0],
                          "people_at_risk": it[2], "team_id": tm["id"], "team_name": tm["name"],
                          "eta_min": round(eta_min(tm, *loc(inc)), 1), "lives_gained": round(gain(it, tm), 2),
                          "nearest_first_team": nf[inc["id"]]["name"] if inc["id"] in nf else None})
    a, b = survivors(gh), survivors(nf)
    return {"steps": steps, "expected_survivors_golden": round(a, 2), "expected_survivors_nearest": round(b, 2),
            "extra_lives": round(a - b, 2), "people_waiting": sum(x[2] for x in todo), "teams_free": len(free)}


# ---------------- offline simulation (seeded, honest comparison) ----------------
SIM_MIX = [("cardiac", 0.15), ("fire_trapped", 0.1), ("drowning", 0.2), ("toxic", 0.05), ("trauma", 0.2),
           ("debris", 0.1), ("serious", 0.2)]
SIM_CAT = {"cardiac": ("medical", True), "fire_trapped": ("fire", True), "drowning": ("flood", True),
           "toxic": ("gas_leak", True), "trauma": ("road_accident", False), "debris": ("building_collapse", True),
           "serious": ("medical", False)}


def simulate(teams_seed: list[dict], runs: int = 40, n_incidents: int = 25, seed: int = 7) -> dict:
    """Disaster burst: n incidents at once, one wave of the city's teams. Compare expected survivors."""
    rnd = random.Random(seed)
    areas = list(AREAS.values())
    tot_a = tot_b = people = 0.0
    p1_gain = []
    for _ in range(runs):
        incs = []
        for i in range(n_incidents):
            r, acc = rnd.random(), 0.0
            key = SIM_MIX[-1][0]
            for k, w in SIM_MIX:
                acc += w
                if r <= acc:
                    key = k
                    break
            cat, life = SIM_CAT[key]
            la, lo = rnd.choice(areas)
            n = rnd.choice([1, 1, 1, 2, 3, 5]) if key not in ("trauma",) else rnd.choice([2, 4, 8])
            incs.append({"id": f"S{i}", "title": key, "category": cat, "life_threat": life,
                         "injuries": "serious" if not life else "none", "injured_count": n if not life else 0,
                         "people_affected": n, "lat": la + rnd.uniform(-0.01, 0.01), "lng": lo + rnd.uniform(-0.01, 0.01),
                         "area": "", "status": "Reported", "severity": "Critical" if life else "High", "assignments": [], "volunteers": [],
                         "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")})
        teams = [{**t, "status": "available"} for t in teams_seed]
        res = plan(incs, teams)
        tot_a += res["expected_survivors_golden"]
        tot_b += res["expected_survivors_nearest"]
        people += res["people_waiting"]
    a, b = tot_a / runs, tot_b / runs
    return {"runs": runs, "incidents_per_run": n_incidents, "teams": len(teams_seed), "people_at_risk_avg": round(people / runs, 1),
            "golden_hour_survivors": round(a, 2), "nearest_first_survivors": round(b, 2),
            "extra_lives_per_disaster": round(a - b, 2), "improvement_pct": round(100 * (a - b) / b, 1) if b else 0.0,
            "method": (f"{runs} simulated disaster bursts (seed {seed}), {n_incidents} life-risk incidents each, "
                       f"{len(teams_seed)} teams, one dispatch wave; unserved incidents wait {DELAY_IF_UNASSIGNED} min. "
                       "Survival curves are simplified demo assumptions.")}


def curve(inc: dict, teams: dict[str, dict]) -> dict | None:
    key = profile_key(inc)
    n = at_risk(inc)
    if not key or not n:
        return None
    label, half, slow, basis = PROFILES[key]
    t_now = _mins(inc["created_at"])
    cpr = cpr_time(inc)
    h, how = help_time(inc, teams)
    horizon = max(60.0, min(half * 3, 240.0), (h or 0) + 15, t_now + 15)
    pts = []
    for i in range(0, 41):
        t = horizon * i / 40
        pts.append({"t": round(t, 1),
                    "no_help": round(100 * survival(t, half), 1),
                    "with_cpr": round(100 * survival(t, half, cpr if cpr is not None else t_now, slow), 1),
                    "current_plan": round(100 * survival(t, half, cpr, slow, h), 1)})
    return {"incident_id": inc["id"], "profile": key, "profile_label": label, "basis": basis, "half_life_min": half,
            "cpr_slowdown": slow, "people_at_risk": n, "now_min": round(t_now, 1),
            "help_min": None if h is None else round(h, 1), "help": how, "cpr_min": None if cpr is None else round(cpr, 1),
            "survival_now": round(100 * survival(t_now, half, cpr, slow, h), 1), "points": pts}
