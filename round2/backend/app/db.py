"""Tiny SQLite helper (no setup). Data file: backend/data/app.db"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "app.db"


def conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute(
        "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, data TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    return c


def add_item(kind: str, data: dict) -> int:
    with conn() as c:
        cur = c.execute("INSERT INTO items (kind, data) VALUES (?, ?)", (kind, json.dumps(data)))
        return int(cur.lastrowid)


def list_items(kind: str, limit: int = 100) -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT * FROM items WHERE kind = ? ORDER BY id DESC LIMIT ?", (kind, limit)).fetchall()
    return [{"id": r["id"], "created": r["created"], **json.loads(r["data"])} for r in rows]


def delete_item(item_id: int) -> None:
    with conn() as c:
        c.execute("DELETE FROM items WHERE id = ?", (item_id,))
