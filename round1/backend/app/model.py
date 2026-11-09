"""
Example ML model: trained at startup on synthetic (but realistic) data.
Swap `make_data` for the real dataset when the problem gives one.
Honest rule: if the data is synthetic, SAY SO in the doc and deck.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split

FEATURES = ["temperature", "vibration", "load", "hours"]
RNG = np.random.default_rng(42)


def make_data(n: int = 4000) -> pd.DataFrame:
    df = pd.DataFrame({
        "temperature": RNG.normal(65, 15, n).clip(20, 120),
        "vibration": RNG.gamma(2.2, 1.6, n).clip(0, 10),
        "load": RNG.uniform(10, 100, n),
        "hours": RNG.uniform(0, 8000, n),
    })
    z = (0.06 * (df.temperature - 60) + 0.9 * (df.vibration - 3)
         + 0.03 * (df.load - 50) + 0.0004 * (df.hours - 2000) + RNG.normal(0, 0.8, n))
    df["failure"] = (1 / (1 + np.exp(-z)) > 0.5).astype(int)
    return df


class RiskModel:
    def __init__(self) -> None:
        df = make_data()
        X, y = df[FEATURES], df["failure"]
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
        self.clf = GradientBoostingClassifier(random_state=42).fit(Xtr, ytr)
        p = self.clf.predict_proba(Xte)[:, 1]
        self.metrics = {
            "accuracy": round(float(accuracy_score(yte, p > 0.5)) * 100, 1),
            "f1": round(float(f1_score(yte, p > 0.5)), 3),
            "roc_auc": round(float(roc_auc_score(yte, p)), 3),
            "train_rows": int(len(Xtr)),
            "test_rows": int(len(Xte)),
        }
        self.importance = dict(zip(FEATURES, self.clf.feature_importances_))
        self.means = X.mean().to_dict()
        self.stds = X.std().to_dict()

    def predict(self, row: dict) -> dict:
        x = pd.DataFrame([row])[FEATURES]
        proba = float(self.clf.predict_proba(x)[0, 1])
        score = int(round(proba * 100))
        label = "High" if score > 66 else "Medium" if score > 33 else "Low"
        # Simple explanation: importance x how unusual the value is.
        factors = []
        for f in FEATURES:
            dev = abs((row[f] - self.means[f]) / (self.stds[f] or 1))
            factors.append({"name": f.replace("hours", "run hours").capitalize(), "impact": int(min(100, round(self.importance[f] * dev * 100)))})
        factors.sort(key=lambda d: d["impact"], reverse=True)
        rec = {
            "High": f"Stop and inspect within 1 hour. Main cause: {factors[0]['name'].lower()}.",
            "Medium": f"Schedule a check this shift. Watch {factors[0]['name'].lower()}.",
            "Low": "Operating normally. No action needed.",
        }[label]
        return {"score": score, "label": label, "confidence": round(max(proba, 1 - proba), 3), "factors": factors, "recommendation": rec}


_model: RiskModel | None = None


def get_model() -> RiskModel:
    global _model
    if _model is None:
        _model = RiskModel()
    return _model
