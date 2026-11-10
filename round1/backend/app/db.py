"""SQLite store for incidents (one JSON document per row). Data file: backend/data/app.db"""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "app.db"
_lock = threading.Lock()


def conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("CREATE TABLE IF NOT EXISTS incidents (seq INTEGER PRIMARY KEY, id TEXT UNIQUE, data TEXT NOT NULL)")
    return c


def count() -> int:
    with conn() as c:
        return int(c.execute("SELECT COUNT(*) FROM incidents").fetchone()[0])


def all_incidents() -> list[dict]:
    with conn() as c:
        return [json.loads(r["data"]) for r in c.execute("SELECT data FROM incidents ORDER BY seq")]


def get(inc_id: str) -> dict | None:
    with conn() as c:
        r = c.execute("SELECT data FROM incidents WHERE id = ?", (inc_id,)).fetchone()
    return json.loads(r["data"]) if r else None


def insert(make) -> dict:
    """make(seq) -> incident dict. Allocates the next sequence number atomically."""
    with _lock, conn() as c:
        seq = int(c.execute("SELECT COALESCE(MAX(seq), 1000) + 1 FROM incidents").fetchone()[0])
        inc = make(seq)
        c.execute("INSERT INTO incidents (seq, id, data) VALUES (?, ?, ?)", (seq, inc["id"], json.dumps(inc)))
    return inc


def save(inc: dict) -> None:
    with _lock, conn() as c:
        c.execute("UPDATE incidents SET data = ? WHERE id = ?", (json.dumps(inc), inc["id"]))


def delete(inc_id: str) -> bool:
    with _lock, conn() as c:
        return c.execute("DELETE FROM incidents WHERE id = ?", (inc_id,)).rowcount > 0


def clear() -> None:
    with _lock, conn() as c:
        c.execute("DELETE FROM incidents")


# ---- generic documents (teams, alerts) ----
def _docs(c: sqlite3.Connection) -> None:
    c.execute("CREATE TABLE IF NOT EXISTS docs (kind TEXT, id TEXT, data TEXT NOT NULL, PRIMARY KEY (kind, id))")


def docs(kind: str) -> list[dict]:
    with conn() as c:
        _docs(c)
        return [json.loads(r["data"]) for r in c.execute("SELECT data FROM docs WHERE kind = ? ORDER BY rowid", (kind,))]


def put_doc(kind: str, doc: dict) -> None:
    with _lock, conn() as c:
        _docs(c)
        c.execute("INSERT OR REPLACE INTO docs (kind, id, data) VALUES (?, ?, ?)", (kind, doc["id"], json.dumps(doc)))


def clear_docs(kind: str) -> None:
    with _lock, conn() as c:
        _docs(c)
        c.execute("DELETE FROM docs WHERE kind = ?", (kind,))
