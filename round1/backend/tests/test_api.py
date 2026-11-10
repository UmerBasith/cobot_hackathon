"""API + severity rule tests. Run:  ../../.venv/bin/python -m pytest -q"""
import pytest
from fastapi.testclient import TestClient

from app import db
from app.severity import assess


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    from app.main import app, reset_data
    reset_data()
    with TestClient(app) as c:
        yield c


def report(**kw):
    base = dict(title="Test incident", description="Something happened here today", category="other",
                area="T. Nagar", people_affected=1)
    return {**base, **kw}


# ---------- severity rules (worked examples) ----------
CASES = [
    ("R1 trapped person -> Critical", report(category="building_collapse", life_threat=True, hazard="medium"), "Critical"),
    ("R2 mass casualty -> Critical", report(category="road_accident", injured_count=6, injuries="serious", active=False), "Critical"),
    ("R3 spreading fire at hospital -> Critical",
     report(category="fire", hazard="spreading", lat=13.0219, lng=80.1854), "Critical"),
    ("R5 active fire -> at least High", report(category="fire", hazard="small", people_affected=0), "High"),
    ("R5 gas leak -> at least High", report(category="gas_leak", hazard="small"), "High"),
    ("Fire already out -> normal score", report(category="fire", hazard="small", active=False), "Low"),
    ("R6 minor injury -> at least Medium", report(category="road_accident", injuries="minor", injured_count=1, active=False), "Medium"),
    ("Fallen tree, nobody hurt -> Low", report(category="other", people_affected=0, active=False), "Low"),
    ("R7 property only -> at most Medium",
     report(category="flood", hazard="large", people_affected=0, vulnerable=["children", "elderly"]), "Medium"),
    ("Big flood with many people -> High", report(category="flood", hazard="large", people_affected=50,
                                               injuries="minor", vulnerable=["elderly"]), "High"),
]


@pytest.mark.parametrize("name,r,expected", CASES, ids=[c[0] for c in CASES])
def test_severity_rules(name, r, expected):
    assert assess(r)["severity"] == expected


def test_reasons_add_up_to_score():
    out = assess(report(category="flood", life_threat=True, hazard="large", people_affected=5,
                        vulnerable=["children", "elderly"]))
    assert out["score"] == sum(x["points"] for x in out["reasons"]) == 72
    assert out["severity"] == "Critical"


def test_maximum_score():
    out = assess(report(category="fire", life_threat=True, hazard="spreading", people_affected=500,
                        vulnerable=["children", "elderly", "patients"], lat=13.0219, lng=80.1854))
    assert out["score"] == 96  # 35 + 25 + 20 + 10 + 6


def test_short_description_flagged_not_lowered():
    out = assess(report(description="help", life_threat=True))
    assert "needs_verification" in out["flags"] and out["severity"] == "Critical"


# ---------- API ----------
def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_create_and_get(client):
    r = client.post("/api/incidents", json=report(category="building_collapse", life_threat=True, area="Velachery"))
    assert r.status_code == 201
    inc = r.json()
    assert inc["id"].startswith("INC-") and inc["severity"] == "Critical" and inc["status"] == "Reported"
    assert client.get(f"/api/incidents/{inc['id']}").json()["title"] == "Test incident"
    assert client.get("/api/incidents").json()[0]["severity"] == "Critical"


def test_validation_errors(client):
    assert client.post("/api/incidents", json=report(description="short")).status_code == 422
    assert client.post("/api/incidents", json=report(category="alien")).status_code == 422
    assert client.post("/api/incidents", json=report(people_affected=-1)).status_code == 422
    assert client.get("/api/incidents/INC-9999").status_code == 404


def test_status_flow_and_stats(client):
    before = client.get("/api/stats").json()
    inc = client.post("/api/incidents", json=report()).json()
    after = client.get("/api/stats").json()
    assert after["total"] == before["total"] + 1 and after["pending"] == before["pending"] + 1
    for st in ["Pending", "In Progress", "Resolved"]:
        out = client.patch(f"/api/incidents/{inc['id']}/status", json={"status": st, "note": "ok"}).json()
        assert out["status"] == st
    assert len(out["timeline"]) == 4
    assert client.get("/api/stats").json()["resolved"] == before["resolved"] + 1
    assert client.patch(f"/api/incidents/{inc['id']}/status", json={"status": "Done"}).status_code == 422


def test_duplicate_and_delete(client):
    a = client.post("/api/incidents", json=report()).json()
    b = client.post("/api/incidents", json=report()).json()
    d = client.post(f"/api/incidents/{b['id']}/duplicate", json={"duplicate_of": a["id"]}).json()
    assert d["duplicate_of"] == a["id"] and d["status"] == "Resolved"
    assert client.post(f"/api/incidents/{a['id']}/duplicate", json={"duplicate_of": a["id"]}).status_code == 400
    assert client.delete(f"/api/incidents/{b['id']}").json() == {"deleted": b["id"]}
    assert client.get(f"/api/incidents/{b['id']}").status_code == 404


def test_preview_and_filters(client):
    p = client.post("/api/severity/preview", json={"category": "fire", "area": "Egmore", "hazard": "large"}).json()
    assert p["severity"] in {"High", "Critical"} and p["reasons"]
    crit = client.get("/api/incidents", params={"severity": "Critical"}).json()
    assert crit and all(i["severity"] == "Critical" for i in crit)
    assert client.get("/api/incidents", params={"q": "rooftop"}).json()


def test_reset(client):
    assert client.post("/api/reset").json()["incidents"] == 12


# ---------- Round 2: dispatch, responder, duplicates, escalation, alerts ----------
def test_teams_seeded_and_some_busy(client):
    teams = client.get("/api/teams").json()
    assert len(teams) == 12 and any(t["status"] == "busy" for t in teams)


def test_suggest_assign_reject_accept_complete(client):
    inc = client.post("/api/incidents", json=report(category="building_collapse", life_threat=True, area="Velachery",
                                                     lat=12.98, lng=80.218)).json()
    slots = client.get(f"/api/incidents/{inc['id']}/suggest").json()
    assert [s["slot"] for s in slots] == ["Search & rescue", "Fire engine", "Ambulance"]
    ids = [s["best"] for s in slots if s["best"]]
    assert len(ids) == len(set(ids)) >= 2
    out = client.post(f"/api/incidents/{inc['id']}/assign", json={"team_ids": ids}).json()
    assert out["status"] == "In Progress" and len(out["assignments"]) == len(ids)
    assert client.post(f"/api/incidents/{inc['id']}/assign", json={"team_ids": ids[:1]}).status_code == 409
    first, second = out["assignments"][0], out["assignments"][1]
    rej = client.post(f"/api/assignments/{first['id']}/respond", json={"accept": False, "reason": "No equipment"}).json()
    assert rej["assignments"][0]["status"] == "rejected"
    assert client.get("/api/teams").json()  # team freed
    assert next(t for t in client.get("/api/teams").json() if t["id"] == first["team_id"])["status"] == "available"
    client.post(f"/api/assignments/{second['id']}/respond", json={"accept": True})
    assert client.get(f"/api/responder/{second['team_id']}").json()[0]["assignment"]["status"] == "accepted"
    client.post(f"/api/assignments/{second['id']}/status", json={"status": "en_route"})
    client.post(f"/api/assignments/{second['id']}/status", json={"status": "on_scene"})
    assert client.post(f"/api/assignments/{second['id']}/status", json={"status": "completed"}).status_code == 422
    done = client.post(f"/api/assignments/{second['id']}/status", json={"status": "completed", "note": "All rescued"}).json()
    assert done["assignments"][1]["status"] == "completed"


def test_duplicates_raise_witnesses_and_severity(client):
    base = report(category="fire", hazard="medium", area="Egmore", lat=13.0732, lng=80.2609, active=False, people_affected=3)
    main = client.post("/api/incidents", json=base).json()
    dups = [client.post("/api/incidents", json=base).json() for _ in range(2)]
    assert any(s["id"] == dups[0]["id"] for s in client.get(f"/api/incidents/{main['id']}/similar").json())
    for d in dups:
        client.post(f"/api/incidents/{d['id']}/duplicate", json={"duplicate_of": main["id"]})
    m = client.get(f"/api/incidents/{main['id']}").json()
    assert m["witnesses"] == 2 and m["score"] == main["score"] + 6
    assert any(r["rule"] == "R8" for r in m["reasons"])


def test_alerts_simulate_escalations(client):
    a = client.post("/api/alerts", json={"area": "Adyar", "message": "Move to higher ground now", "level": "danger"})
    assert a.status_code == 201
    assert any(x["area"] == "Adyar" for x in client.get("/api/alerts/active", params={"area": "Adyar"}).json())
    n = client.get("/api/stats").json()["total"]
    sim = client.post("/api/simulate", json={"scenario": "chennai_flood"}).json()
    assert client.get("/api/stats").json()["total"] == n + len(sim["created"])
    esc = client.get("/api/escalations").json()
    assert any(e["level"] == "critical" for e in esc)
