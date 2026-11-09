r"""
chart.py - quick, good-looking PNG charts for the report (brand colours, clean style).

From Python (e.g. inside an evaluation script):
    import sys; sys.path.insert(0, r"C:\PersonalProjects\Hackathon\tools")
    from chart import bar, line, confusion, pie
    bar({"Vibration": 0.41, "Temperature": 0.27}, "Feature importance", "round1/doc/img/importance.png")

From the command line with a JSON spec:
    .venv\Scripts\python tools\chart.py spec.json
    spec = {"kind": "bar"|"line"|"pie"|"confusion", "title": "...", "out": "path.png", "data": {...},
            "xlabel": "...", "ylabel": "...", "labels": [...] (confusion only)}
    line data: {"x": [...], "series": {"Actual": [...], "Predicted": [...]}}
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

BRAND = ["#6D4AFF", "#22B8CF", "#F59E0B", "#10B981", "#EF4444", "#64748B"]
plt.rcParams.update({
    "font.family": "Segoe UI", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False,
    "axes.edgecolor": "#C9CEDD", "axes.labelcolor": "#3A3F58", "xtick.color": "#5B6280", "ytick.color": "#5B6280",
    "axes.grid": True, "grid.color": "#ECEEF5", "grid.linewidth": 0.8, "axes.axisbelow": True,
    "axes.titleweight": "semibold", "axes.titlesize": 12, "axes.titlelocation": "left", "figure.dpi": 160,
})


def _save(fig, out: str):
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(out, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"OK  {out}")
    return out


def bar(data: dict, title: str, out: str, xlabel: str = "", ylabel: str = "", horizontal: bool = True):
    fig, ax = plt.subplots(figsize=(6.4, 3.4))
    keys, vals = list(data.keys()), list(data.values())
    if horizontal:
        order = sorted(range(len(vals)), key=lambda i: vals[i])
        ax.barh([keys[i] for i in order], [vals[i] for i in order], color=BRAND[0], height=0.6)
        ax.grid(axis="y", visible=False)
    else:
        ax.bar(keys, vals, color=BRAND[0], width=0.6)
        ax.grid(axis="x", visible=False)
    ax.set_title(title); ax.set_xlabel(xlabel); ax.set_ylabel(ylabel)
    return _save(fig, out)


def line(x: list, series: dict, title: str, out: str, xlabel: str = "", ylabel: str = ""):
    fig, ax = plt.subplots(figsize=(6.4, 3.2))
    for i, (name, ys) in enumerate(series.items()):
        ax.plot(x, ys, label=name, color=BRAND[i % len(BRAND)], linewidth=2)
    ax.set_title(title); ax.set_xlabel(xlabel); ax.set_ylabel(ylabel)
    if len(series) > 1:
        ax.legend(frameon=False)
    if len(x) > 12:
        ax.set_xticks(x[:: max(1, len(x) // 8)])
    return _save(fig, out)


def pie(data: dict, title: str, out: str):
    fig, ax = plt.subplots(figsize=(4.6, 3.4))
    ax.pie(list(data.values()), labels=list(data.keys()), colors=BRAND, startangle=90, autopct="%1.0f%%",
           wedgeprops={"width": 0.42, "edgecolor": "white"}, pctdistance=0.79, textprops={"fontsize": 9})
    ax.set_title(title)
    return _save(fig, out)


def confusion(matrix: list[list[int]], labels: list[str], title: str, out: str):
    import numpy as np
    m = np.array(matrix)
    fig, ax = plt.subplots(figsize=(3.8, 3.4))
    ax.imshow(m, cmap="Purples")
    ax.grid(False)
    ax.set_xticks(range(len(labels)), labels); ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual"); ax.set_title(title)
    for i in range(m.shape[0]):
        for j in range(m.shape[1]):
            ax.text(j, i, str(m[i, j]), ha="center", va="center", color="white" if m[i, j] > m.max() / 2 else "#1F233A", fontsize=11)
    return _save(fig, out)


if __name__ == "__main__":
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    k, d = spec["kind"], spec["data"]
    if k == "bar":
        bar(d, spec.get("title", ""), spec["out"], spec.get("xlabel", ""), spec.get("ylabel", ""))
    elif k == "line":
        line(d["x"], d["series"], spec.get("title", ""), spec["out"], spec.get("xlabel", ""), spec.get("ylabel", ""))
    elif k == "pie":
        pie(d, spec.get("title", ""), spec["out"])
    elif k == "confusion":
        confusion(d, spec["labels"], spec.get("title", ""), spec["out"])
