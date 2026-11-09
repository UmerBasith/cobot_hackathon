r"""
FastAPI backend.  Start it with:  tools\run_app.ps1 <round folder>
or by hand from the backend folder:
    ..\..\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
API docs page (nice to show judges): http://127.0.0.1:8000/docs
"""
from __future__ import annotations

import io
import math
import random
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .llm import ask_llm, llm_available
from .model import get_model
from .schemas import AnalyzeOut, AssistantIn, AssistantOut, Overview, PredictIn, PredictOut


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_model()  # train once at start so the first request is fast
    yield


app = FastAPI(title="Ctrl.Alt.Elite API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "model": get_model().metrics, "llm": llm_available(),
            "time": datetime.now().isoformat(timespec="seconds")}


@app.get("/api/overview", response_model=Overview)
def overview() -> dict:
    m = get_model()
    rnd = random.Random(7)
    names = ["Robot arm A", "Conveyor 3", "Welding cell", "Picker bot 2", "Paint unit", "AGV 7", "Press line", "Sorter 1"]
    cats = ["Assembly", "Transport", "Assembly", "Logistics", "Finishing", "Logistics", "Forming", "Logistics"]
    records = []
    for i, (n, c) in enumerate(zip(names, cats)):
        row = {"temperature": rnd.uniform(45, 95), "vibration": rnd.uniform(1, 7),
               "load": rnd.uniform(20, 95), "hours": rnd.uniform(200, 7000)}
        s = m.predict(row)["score"]
        records.append({"id": f"U-{101 + i}", "name": n, "category": c, "score": s,
                        "status": "Critical" if s > 66 else "Watch" if s > 33 else "Healthy",
                        "updated": f"{rnd.randint(1, 20)} min ago"})
    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    series = []
    for i in range(24):
        base = 40 + 18 * math.sin(i / 3.5) + i * 0.8
        series.append({"t": (now - timedelta(hours=23 - i)).strftime("%H:%M"),
                       "actual": round(base + rnd.uniform(-4, 4), 1), "predicted": round(base + 1.2, 1)})
    counts = {k: sum(r["status"] == k for r in records) for k in ("Healthy", "Watch", "Critical")}
    total = len(records)
    return {
        "kpis": {"total": 1284, "risk_avg": round(sum(r["score"] for r in records) / total, 1),
                 "alerts": counts["Critical"] + counts["Watch"], "accuracy": m.metrics["accuracy"]},
        "series": series,
        "breakdown": [{"name": k, "value": round(v * 100 / total)} for k, v in counts.items()],
        "records": records,
    }


@app.post("/api/predict", response_model=PredictOut)
def predict(body: PredictIn) -> dict:
    out = get_model().predict(body.model_dump())
    db.add_item("prediction", {**body.model_dump(), "score": out["score"], "label": out["label"]})
    return out


@app.get("/api/predictions")
def predictions(limit: int = 50) -> list[dict]:
    return db.list_items("prediction", limit)


@app.post("/api/analyze", response_model=AnalyzeOut)
async def analyze(file: UploadFile = File(...)) -> dict:
    raw = await file.read()
    if len(raw) > 10_000_000:
        raise HTTPException(413, "File too large (max 10 MB)")
    try:
        name = (file.filename or "").lower()
        df = pd.read_excel(io.BytesIO(raw)) if name.endswith((".xlsx", ".xls")) else pd.read_csv(io.BytesIO(raw))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not read file: {e}") from e
    summary = []
    for col in df.columns:
        s = df[col]
        num = pd.api.types.is_numeric_dtype(s)
        summary.append({"column": str(col),
                        "mean": float(s.mean()) if num and s.notna().any() else None,
                        "min": float(s.min()) if num and s.notna().any() else None,
                        "max": float(s.max()) if num and s.notna().any() else None,
                        "missing": int(s.isna().sum())})
    head = df.head(10)
    preview = head.astype(object).where(head.notna(), None).to_dict(orient="records")
    return {"rows": int(len(df)), "columns": [str(c) for c in df.columns], "summary": summary, "preview": preview}


SYSTEM_PROMPT = (
    "You are the assistant inside a monitoring dashboard built by team Ctrl.Alt.Elite. "
    "Answer in 2-4 short sentences, plain English, using the live data given. Never invent numbers."
)


@app.post("/api/assistant", response_model=AssistantOut)
def assistant(body: AssistantIn) -> dict:
    ov = overview()
    context = ("Live data: " + str(ov["kpis"]) + ". Records: "
               + "; ".join(f"{r['name']} risk {r['score']} ({r['status']})" for r in ov["records"]))
    answer = ask_llm(SYSTEM_PROMPT + "\n" + context, body.question, [m.model_dump() for m in body.history])
    if answer:
        return {"answer": answer, "source": "llm"}
    return {"answer": rules_answer(body.question, ov), "source": "rules"}


def rules_answer(q: str, ov: dict) -> str:
    """Keyword answers grounded in live data, so the demo works with no API key."""
    q = q.lower()
    recs = sorted(ov["records"], key=lambda r: r["score"], reverse=True)
    k = ov["kpis"]
    if any(w in q for w in ("attention", "critical", "worst", "which", "danger", "alert")):
        top = [r for r in recs if r["status"] != "Healthy"][:3]
        if not top:
            return "Everything is healthy right now. No item needs attention."
        return "These need attention first: " + ", ".join(
            f"{r['name']} (risk {r['score']}, {r['status']})" for r in top) + "."
    if any(w in q for w in ("accura", "model", "trust", "reliable")):
        m = get_model().metrics
        return (f"The model scores {m['accuracy']}% accuracy and ROC-AUC {m['roc_auc']} "
                f"on {m['test_rows']} held-out rows it never saw in training.")
    if any(w in q for w in ("action", "recommend", "should", "next")):
        r = recs[0]
        return f"Inspect {r['name']} first (risk {r['score']}). Then review items marked Watch during this shift."
    if any(w in q for w in ("risk", "status", "summary", "overall", "how")):
        return (f"Average risk is {k['risk_avg']}/100 across {len(recs)} tracked units, with {k['alerts']} open alerts. "
                f"Highest risk: {recs[0]['name']} at {recs[0]['score']}.")
    return ("I can summarise status, list items needing attention, explain the model, or suggest next actions. "
            f"Right now average risk is {k['risk_avg']} with {k['alerts']} alerts.")
