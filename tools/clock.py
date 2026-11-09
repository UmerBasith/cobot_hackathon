r"""
clock.py - the round timer. The main Claude runs this at EVERY phase change.

    .venv\Scripts\python tools\clock.py start round1 50     # start the clock (minutes)
    .venv\Scripts\python tools\clock.py round1              # where are we? what should be happening now?
    .venv\Scripts\python tools\clock.py round1 done "backend API ready"   # log a milestone

Phases are fixed fractions of the round so 50 and 90 minute rounds both work.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (name, start fraction, end fraction, what must be happening)
PHASES = [
    ("1 UNDERSTAND + DECIDE", 0.00, 0.12, "Read problem, score 3 ideas, write BRIEF.md (with API contract). Researcher runs in background."),
    ("2 BUILD", 0.12, 0.64, "Frontend + backend agents build in parallel. Storyteller drafts deck.json + report.md. Core flow must work by 40% of the round."),
    ("3 INTEGRATE + TEST", 0.64, 0.78, "Run the app, tester checks every feature, fix bugs. No new features unless everything passes."),
    ("4 PACKAGE", 0.78, 0.92, "Screenshots -> final deck + doc -> export PDFs -> look at slide PNGs and fix layout. Judge review if time."),
    ("5 FREEZE + REHEARSE", 0.92, 1.00, "CODE FREEZE. Copy files to deliver/, write the 3-minute demo script, tell the team where everything is."),
]


def path(rnd: str) -> Path:
    return ROOT / rnd / ".clock.json"


def start(rnd: str, minutes: float):
    p = path(rnd)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps({"start": datetime.now().isoformat(), "minutes": minutes, "log": []}, indent=1))
    print(f"CLOCK STARTED for {rnd}: {minutes:g} minutes, ends at {datetime.now() + timedelta(minutes=minutes):%H:%M}")
    status(rnd)


def status(rnd: str):
    p = path(rnd)
    if not p.exists():
        print(f"No clock for {rnd}. Start it: python tools/clock.py start {rnd} <minutes>")
        return
    d = json.loads(p.read_text())
    t0 = datetime.fromisoformat(d["start"])
    total = d["minutes"]
    used = (datetime.now() - t0).total_seconds() / 60
    left = total - used
    frac = used / total
    print(f"[{rnd}] {used:5.1f} min used | {left:5.1f} min LEFT of {total:g} | now {datetime.now():%H:%M}")
    for name, a, b, what in PHASES:
        mark = ">>" if a <= frac < b else "  "
        print(f" {mark} {name:<22} {a * total:4.0f}-{b * total:3.0f} min   {what if mark == '>>' else ''}")
    if frac >= 1:
        print(" !! TIME IS UP. Stop everything. Make sure deliver/ has the deck, doc and the app is running.")
    elif left <= 5:
        print(" !! LAST 5 MINUTES: CODE FREEZE. Only finish deck/doc/demo notes.")
    elif left <= 12:
        print(" !  Under 12 minutes: no new features. Finish packaging.")
    if d["log"]:
        print(" milestones: " + " | ".join(f"{m['t']} {m['what']}" for m in d["log"][-6:]))


def done(rnd: str, what: str):
    p = path(rnd)
    d = json.loads(p.read_text())
    used = (datetime.now() - datetime.fromisoformat(d["start"])).total_seconds() / 60
    d["log"].append({"t": f"{used:.0f}m", "what": what})
    p.write_text(json.dumps(d, indent=1))
    status(rnd)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__)
    elif a[0] == "start":
        start(a[1], float(a[2]))
    elif len(a) >= 3 and a[1] == "done":
        done(a[0], " ".join(a[2:]))
    else:
        status(a[0])
