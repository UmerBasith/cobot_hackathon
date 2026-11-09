"""
Optional LLM call. Works with NO key (falls back to rules) so the demo never breaks.
Free option: get a Gemini key at https://aistudio.google.com/apikey and set
    $env:GEMINI_API_KEY = "..."      (PowerShell, before starting the backend)
Optional: $env:GEMINI_MODEL (default below).
"""
from __future__ import annotations

import os

import httpx

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def llm_available() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


def ask_llm(system: str, question: str, history: list[dict] | None = None, timeout: float = 25.0) -> str | None:
    """Returns the answer text, or None if no key / any error (caller then uses rules)."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    contents = []
    for m in (history or [])[-8:]:
        contents.append({"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]})
    if not contents or contents[-1]["parts"][0]["text"] != question:
        contents.append({"role": "user", "parts": [{"text": question}]})
    try:
        r = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            params={"key": key},
            json={"systemInstruction": {"parts": [{"text": system}]}, "contents": contents,
                  "generationConfig": {"temperature": 0.4, "maxOutputTokens": 600}},
            timeout=timeout,
        )
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:  # noqa: BLE001 - demo must never crash
        print(f"[llm] fallback to rules: {e}")
        return None
