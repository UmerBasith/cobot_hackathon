"""Turn free text (SMS, voice transcript in English / Tamil / Tanglish) into report fields. Keyword rules, no AI."""
from __future__ import annotations

import re

from .geo import AREAS

CATEGORY_WORDS: dict[str, list[str]] = {
    "fire": ["fire", "smoke", "burning", "flames", "thee", "theee", "தீ", "புகை", "எரி"],
    "flood": ["flood", "water", "waterlog", "drown", "rain", "vellam", "veLLam", "வெள்ளம்", "தண்ணீர்", "நீர்"],
    "road_accident": ["accident", "crash", "collision", "bus", "lorry", "bike", "car", "vibathu", "விபத்து"],
    "medical": ["heart", "chest pain", "collapsed", "unconscious", "fainted", "breath", "cardiac", "stroke", "pregnant",
                "labour", "medical", "ambulance", "maradaippu", "mayakkam", "மாரடைப்பு", "மயக்கம்", "மருத்துவ",
                "நெஞ்சு வலி"],
    "building_collapse": ["collapse", "collapsed building", "wall fell", "building fell", "idinju", "idinthu",
                          "இடிந்து", "இடிஞ்சு", "கட்டிடம்"],
    "gas_leak": ["gas", "cylinder", "leak", "smell", "எரிவாயு", "சிலிண்டர்", "கேஸ்"],
    "electrical": ["electric", "current", "wire", "shock", "transformer", "power", "spark", "மின்சாரம்", "கரண்ட்", "மின்"],
    "landslide": ["landslide", "mudslide", "mud", "மண்சரிவு"],
}
# words that are strong for one category even when another keyword also matches
PRIORITY = ["building_collapse", "fire", "gas_leak", "electrical", "landslide", "road_accident", "flood", "medical"]

LIFE_WORDS = ["trapped", "stuck", "not breathing", "no breath", "unconscious", "no pulse", "drowning", "under debris",
              "maattikittanga", "maatikittanga", "sikki", "mayakkam", "மூச்சு இல்லை", "சிக்கி", "மாட்டிக்", "மயக்கம்"]
SERIOUS_WORDS = ["bleeding", "serious", "badly", "chest pain", "fracture", "burns", "ratham", "இரத்தம்", "ரத்தம்"]
INJURY_WORDS = ["injured", "hurt", "wound", "cut", "kaayam", "காயம்"]
CHILD_WORDS = ["child", "children", "baby", "kid", "kuzhandhai", "குழந்தை"]
ELDER_WORDS = ["elderly", "old man", "old woman", "grandmother", "grandfather", "paati", "thatha", "முதியவர்", "பாட்டி", "தாத்தா"]
SPREAD_WORDS = ["spreading", "rising", "growing", "fast", "பரவுது", "ஏறுது", "அதிகமா"]

TAMIL_AREAS = {"வேளச்சேரி": "Velachery", "தாம்பரம்": "Tambaram", "அடையாறு": "Adyar", "அடையார்": "Adyar",
               "தி நகர்": "T. Nagar", "தி.நகர்": "T. Nagar", "மயிலாப்பூர்": "Mylapore", "எழும்பூர்": "Egmore",
               "கிண்டி": "Guindy", "போரூர்": "Porur", "அண்ணா நகர்": "Anna Nagar", "பெரம்பூர்": "Perambur",
               "ராயபுரம்": "Royapuram", "குரோம்பேட்டை": "Chromepet", "சோழிங்கநல்லூர்": "Sholinganallur",
               "வண்டலூர்": "Vandalur"}
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
                "ten": 10, "twenty": 20, "fifty": 50, "hundred": 100, "oru": 1, "rendu": 2, "moonu": 3, "naalu": 4,
                "anju": 5, "pathu": 10, "ஒன்று": 1, "ஒரு": 1, "இரண்டு": 2, "ரெண்டு": 2, "மூன்று": 3, "மூணு": 3,
                "நான்கு": 4, "நாலு": 4, "ஐந்து": 5, "அஞ்சு": 5, "பத்து": 10}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9஀-௿ ]", "", s.lower().replace(".", " ")).replace("  ", " ")


def find_area(text: str) -> str | None:
    for ta, en in TAMIL_AREAS.items():
        if ta in text:
            return en
    flat = re.sub(r"[^a-z]", "", text.lower())
    for area in sorted(AREAS, key=len, reverse=True):
        key = re.sub(r"[^a-z]", "", area.lower())
        if key and key in flat:
            return area
    alias = {"tnagar": "T. Nagar", "thyagaraya": "T. Nagar", "omr": "Sholinganallur", "gst": "Chromepet",
             "velacheri": "Velachery", "adayar": "Adyar", "thambaram": "Tambaram", "annanagar": "Anna Nagar"}
    for k, v in alias.items():
        if k in flat:
            return v
    return None


def has(text: str, words: list[str]) -> list[str]:
    t = text.lower()
    return [w for w in words if w.lower() in t]


def parse(text: str) -> dict:
    """Returns {fields: partial ReportIn, matched: {...}, confidence 0-1}."""
    t = text.strip()
    scores = {c: len(has(t, ws)) for c, ws in CATEGORY_WORDS.items()}
    best = max(scores.values()) if scores else 0
    category = "other"
    if best:
        cands = [c for c, v in scores.items() if v == best]
        category = min(cands, key=lambda c: PRIORITY.index(c))
    area = find_area(t)
    nums = [int(n) for n in re.findall(r"\b(\d{1,5})\b", t)]
    for w, n in NUMBER_WORDS.items():
        if re.search(rf"(^|\s){re.escape(w)}(\s|$)", t.lower()):
            nums.append(n)
    people = max(nums) if nums else 1
    life = bool(has(t, LIFE_WORDS))
    serious = bool(has(t, SERIOUS_WORDS)) or (category == "medical" and life)
    injured = bool(has(t, INJURY_WORDS))
    vulnerable = (["children"] if has(t, CHILD_WORDS) else []) + (["elderly"] if has(t, ELDER_WORDS) else [])
    spreading = bool(has(t, SPREAD_WORDS))
    hazard = "spreading" if spreading else "large" if (life and category in ("flood", "fire", "building_collapse")) else "medium"
    if category == "medical":
        hazard = "small"
    fields = {"category": category, "area": area, "people_affected": people, "life_threat": life,
              "injuries": "serious" if serious else "minor" if injured else "none",
              "injured_count": people if (injured or serious) and not life else 0,
              "hazard": hazard, "active": True, "vulnerable": vulnerable}
    matched = {"category": [w for w in CATEGORY_WORDS.get(category, []) if w.lower() in t.lower()],
               "life_threat": has(t, LIFE_WORDS), "area": area, "numbers": nums}
    conf = round(min(1.0, 0.3 * bool(best) + 0.3 * bool(area) + 0.2 * bool(nums) + 0.2 * (life or serious or injured)), 2)
    return {"fields": fields, "matched": matched, "confidence": conf}
