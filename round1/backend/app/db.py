"""Storage for incidents and documents (teams, alerts, heroes, zones, shelters, sms).

Two backends, same API:
  * Supabase Postgres  — used when DATABASE_URL is set (in the environment or in backend/.env)
  * SQLite             — backend/data/app.db, used otherwise, or automatically if Postgres can't be reached
backend/.env is git-ignored: the database password never goes to GitHub.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "app.db"
_lock = threading.RLock()


def _load_env() -> None:
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()

# ----------------------------------------------------------------- Postgres (Supabase)
_pg = None            # persistent psycopg connection
BACKEND = "sqlite"
BACKEND_ERROR = ""

PG_SCHEMA = """
create table if not exists public.resq_incidents (
  seq  integer primary key,
  id   text not null unique,
  data jsonb not null
);
create table if not exists public.resq_docs (
  kind text not null,
  id   text not null,
  ord  bigint generated always as identity,
  data jsonb not null,
  primary key (kind, id)
);
create index if not exists resq_docs_kind_ord on public.resq_docs (kind, ord);
-- Backend-only tables: RLS on with no policies, so the public Data API (anon / authenticated) can't read or write.
alter table public.resq_incidents enable row level security;
alter table public.resq_docs enable row level security;
"""


def _pg_connect():
    import psycopg  # noqa: PLC0415
    c = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True, connect_timeout=8, prepare_threshold=None)
    c.execute(PG_SCHEMA)
    return c


# ----------------------------------------------------------------- Supabase Data API (HTTPS, works on IPv4)
# Uses SUPABASE_URL + SUPABASE_SECRET_KEY (server-side only — never send the secret key to the browser).
# Tables must exist: run backend/supabase_schema.sql once in the Supabase SQL editor.
# All data is also kept in memory (write-through cache) so reads are instant; writes go to Supabase.
_mem: dict | None = None


def _rest(method: str, path: str, body=None, prefer: str | None = None):
    import urllib.request  # noqa: PLC0415
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/" + path
    key = os.environ["SUPABASE_SECRET_KEY"]
    headers = {"apikey": key, "Content-Type": "application/json", "Accept": "application/json"}
    if not key.startswith("sb_"):  # legacy service_role JWT
        headers["Authorization"] = f"Bearer {key}"
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = r.read()
    return json.loads(raw) if raw else None


def _rest_load() -> dict:
    inc = _rest("GET", "resq_incidents?select=seq,id,data&order=seq.asc")
    docs_rows = _rest("GET", "resq_docs?select=kind,id,data&order=ord.asc")
    m: dict = {"inc": {r["id"]: (r["seq"], _j(r["data"])) for r in inc}, "docs": {}}
    for r in docs_rows:
        m["docs"].setdefault(r["kind"], {})[r["id"]] = _j(r["data"])
    return m


def _init() -> None:
    global _pg, _mem, BACKEND, BACKEND_ERROR
    if os.environ.get("RESQ_FORCE_SQLITE"):
        BACKEND = "sqlite"
        return
    errors = []
    if os.environ.get("DATABASE_URL"):
        try:
            _pg = _pg_connect()
            BACKEND = "supabase"
            return
        except Exception as e:  # noqa: BLE001 — offline demo must keep working
            errors.append(f"postgres: {type(e).__name__}: {str(e)[:160]}")
    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SECRET_KEY"):
        try:
            _mem = _rest_load()
            BACKEND = "supabase-api"
            BACKEND_ERROR = "; ".join(errors)
            return
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if hasattr(e, "read"):
                try:
                    msg += " " + e.read().decode()[:200]  # type: ignore[attr-defined]
                except Exception:  # noqa: BLE001
                    pass
            errors.append(f"api: {type(e).__name__}: {msg[:200]}")
    BACKEND_ERROR = "; ".join(errors)
    if errors:
        print(f"[db] Supabase unreachable, using SQLite instead: {BACKEND_ERROR}")
    BACKEND = "sqlite"


def _api_on() -> bool:
    return BACKEND == "supabase-api" and _mem is not None


def _q(sql: str, args: tuple = ()) -> list[tuple]:
    """Run one Postgres statement (reconnects once if the connection dropped)."""
    global _pg
    for attempt in (1, 2):
        try:
            cur = _pg.execute(sql, args)
            return cur.fetchall() if cur.description else []
        except Exception:  # noqa: BLE001
            if attempt == 2:
                raise
            try:
                _pg.close()
            except Exception:  # noqa: BLE001
                pass
            _pg = _pg_connect()
    return []


def _j(v) -> dict:
    return v if isinstance(v, dict) else json.loads(v)


# ----------------------------------------------------------------- SQLite
def conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("CREATE TABLE IF NOT EXISTS incidents (seq INTEGER PRIMARY KEY, id TEXT UNIQUE, data TEXT NOT NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS docs (kind TEXT, id TEXT, data TEXT NOT NULL, PRIMARY KEY (kind, id))")
    return c


def _pg_on() -> bool:
    return BACKEND == "supabase" and _pg is not None


# ----------------------------------------------------------------- incidents
def count() -> int:
    with _lock:
        if _api_on():
            return len(_mem["inc"])
        if _pg_on():
            return int(_q("select count(*) from resq_incidents")[0][0])
        with conn() as c:
            return int(c.execute("SELECT COUNT(*) FROM incidents").fetchone()[0])


def all_incidents() -> list[dict]:
    with _lock:
        if _api_on():
            return [json.loads(json.dumps(v[1])) for v in sorted(_mem["inc"].values(), key=lambda x: x[0])]
        if _pg_on():
            return [_j(r[0]) for r in _q("select data from resq_incidents order by seq")]
        with conn() as c:
            return [json.loads(r["data"]) for r in c.execute("SELECT data FROM incidents ORDER BY seq")]


def get(inc_id: str) -> dict | None:
    with _lock:
        if _api_on():
            v = _mem["inc"].get(inc_id)
            return json.loads(json.dumps(v[1])) if v else None
        if _pg_on():
            rows = _q("select data from resq_incidents where id = %s", (inc_id,))
            return _j(rows[0][0]) if rows else None
        with conn() as c:
            r = c.execute("SELECT data FROM incidents WHERE id = ?", (inc_id,)).fetchone()
        return json.loads(r["data"]) if r else None


def insert(make) -> dict:
    """make(seq) -> incident dict. Allocates the next sequence number atomically."""
    with _lock:
        if _api_on():
            seq = max([v[0] for v in _mem["inc"].values()] or [1000]) + 1
            inc = make(seq)
            _rest("POST", "resq_incidents", {"seq": seq, "id": inc["id"], "data": inc}, "return=minimal")
            _mem["inc"][inc["id"]] = (seq, json.loads(json.dumps(inc)))
            return inc
        if _pg_on():
            seq = int(_q("select coalesce(max(seq), 1000) + 1 from resq_incidents")[0][0])
            inc = make(seq)
            _q("insert into resq_incidents (seq, id, data) values (%s, %s, %s::jsonb)", (seq, inc["id"], json.dumps(inc)))
            return inc
        with conn() as c:
            seq = int(c.execute("SELECT COALESCE(MAX(seq), 1000) + 1 FROM incidents").fetchone()[0])
            inc = make(seq)
            c.execute("INSERT INTO incidents (seq, id, data) VALUES (?, ?, ?)", (seq, inc["id"], json.dumps(inc)))
        return inc


def save(inc: dict) -> None:
    with _lock:
        if _api_on():
            _rest("PATCH", f"resq_incidents?id=eq.{inc['id']}", {"data": inc}, "return=minimal")
            seq = _mem["inc"].get(inc["id"], (0, None))[0]
            _mem["inc"][inc["id"]] = (seq, json.loads(json.dumps(inc)))
            return
        if _pg_on():
            _q("update resq_incidents set data = %s::jsonb where id = %s", (json.dumps(inc), inc["id"]))
            return
        with conn() as c:
            c.execute("UPDATE incidents SET data = ? WHERE id = ?", (json.dumps(inc), inc["id"]))


def delete(inc_id: str) -> bool:
    with _lock:
        if _api_on():
            if inc_id not in _mem["inc"]:
                return False
            _rest("DELETE", f"resq_incidents?id=eq.{inc_id}", None, "return=minimal")
            _mem["inc"].pop(inc_id, None)
            return True
        if _pg_on():
            return bool(_q("delete from resq_incidents where id = %s returning id", (inc_id,)))
        with conn() as c:
            return c.execute("DELETE FROM incidents WHERE id = ?", (inc_id,)).rowcount > 0


def clear() -> None:
    with _lock:
        if _api_on():
            _rest("DELETE", "resq_incidents?seq=gte.0", None, "return=minimal")
            _mem["inc"].clear()
            return
        if _pg_on():
            _q("delete from resq_incidents")
            return
        with conn() as c:
            c.execute("DELETE FROM incidents")


# ----------------------------------------------------------------- generic documents
def docs(kind: str) -> list[dict]:
    with _lock:
        if _api_on():
            return [json.loads(json.dumps(d)) for d in _mem["docs"].get(kind, {}).values()]
        if _pg_on():
            return [_j(r[0]) for r in _q("select data from resq_docs where kind = %s order by ord", (kind,))]
        with conn() as c:
            return [json.loads(r["data"]) for r in c.execute("SELECT data FROM docs WHERE kind = ? ORDER BY rowid", (kind,))]


def put_doc(kind: str, doc: dict) -> None:
    with _lock:
        if _api_on():
            _rest("POST", "resq_docs?on_conflict=kind,id", {"kind": kind, "id": doc["id"], "data": doc},
                  "resolution=merge-duplicates,return=minimal")
            _mem["docs"].setdefault(kind, {})[doc["id"]] = json.loads(json.dumps(doc))
            return
        if _pg_on():
            _q("insert into resq_docs (kind, id, data) values (%s, %s, %s::jsonb) "
               "on conflict (kind, id) do update set data = excluded.data", (kind, doc["id"], json.dumps(doc)))
            return
        with conn() as c:
            # keep insertion order stable on update (UPDATE keeps rowid; INSERT OR REPLACE would move it)
            if c.execute("UPDATE docs SET data = ? WHERE kind = ? AND id = ?", (json.dumps(doc), kind, doc["id"])).rowcount == 0:
                c.execute("INSERT INTO docs (kind, id, data) VALUES (?, ?, ?)", (kind, doc["id"], json.dumps(doc)))


def delete_doc(kind: str, doc_id: str) -> bool:
    with _lock:
        if _api_on():
            if doc_id not in _mem["docs"].get(kind, {}):
                return False
            _rest("DELETE", f"resq_docs?kind=eq.{kind}&id=eq.{doc_id}", None, "return=minimal")
            _mem["docs"][kind].pop(doc_id, None)
            return True
        if _pg_on():
            return bool(_q("delete from resq_docs where kind = %s and id = %s returning id", (kind, doc_id)))
        with conn() as c:
            return c.execute("DELETE FROM docs WHERE kind = ? AND id = ?", (kind, doc_id)).rowcount > 0


def clear_docs(kind: str) -> None:
    with _lock:
        if _api_on():
            _rest("DELETE", f"resq_docs?kind=eq.{kind}", None, "return=minimal")
            _mem["docs"].pop(kind, None)
            return
        if _pg_on():
            _q("delete from resq_docs where kind = %s", (kind,))
            return
        with conn() as c:
            c.execute("DELETE FROM docs WHERE kind = ?", (kind,))


def info() -> dict:
    return {"backend": BACKEND, "fallback_reason": BACKEND_ERROR or None}


_init()
