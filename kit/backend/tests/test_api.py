r"""Run from the backend folder:  ..\..\.venv\Scripts\python -m pytest -q"""
import io

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_overview_shape():
    d = client.get("/api/overview").json()
    assert {"kpis", "series", "breakdown", "records"} <= d.keys()
    assert len(d["series"]) == 24 and d["records"]


def test_predict_high_vs_low():
    hi = client.post("/api/predict", json={"temperature": 110, "vibration": 9, "load": 95, "hours": 7800}).json()
    lo = client.post("/api/predict", json={"temperature": 40, "vibration": 0.5, "load": 15, "hours": 100}).json()
    assert hi["score"] > lo["score"]
    assert hi["label"] == "High" and lo["label"] == "Low"


def test_predict_rejects_bad_input():
    r = client.post("/api/predict", json={"temperature": 999, "vibration": -1, "load": 50, "hours": 10})
    assert r.status_code == 422


def test_analyze_csv():
    csv = b"a,b,c\n1,2,x\n3,,y\n5,6,z\n"
    d = client.post("/api/analyze", files={"file": ("t.csv", io.BytesIO(csv), "text/csv")}).json()
    assert d["rows"] == 3 and d["columns"] == ["a", "b", "c"]
    assert d["summary"][1]["missing"] == 1


def test_assistant_rules():
    d = client.post("/api/assistant", json={"question": "Which items need attention?"}).json()
    assert d["answer"] and d["source"] in ("rules", "llm")
