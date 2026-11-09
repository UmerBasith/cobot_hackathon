# BRIEF — the single source of truth for this round

> The main Claude fills this in during phase 1 (in about 4-8 minutes). EVERY agent reads it first.
> Keep it short. If something changes, update this file and tell the agents.

## 0. Round
- Round: (round1 / round2) · Time: (50 / 90) min · Started: (hh:mm)
- Problem statement (exact words, pasted):

```
(paste here)
```

## 1. What the judges will look for
- Must-haves stated in the problem: …
- Hidden expectations (who is the user, what does "solved" look like): …

## 2. Ideas considered (score 1-5)
| Idea | Impact | Innovation | Doable in time | Demo wow | Fits problem | Total |
|---|---|---|---|---|---|---|
| A | | | | | | |
| B | | | | | | |
| C | | | | | | |

**Chosen:** … **Why (one line):** …

## 3. The product
- Name: … (short, memorable)  · Tagline: …
- One-sentence pitch: "For <user> who <pain>, <name> <does what>, unlike <today> it <key difference>."
- Brand hue (for `--brand-hue` in index.css): …  · Deck colours: brand #…, accent #…
- Hero feature (the ONE thing the demo must show working): …
- Supporting features (max 3, in priority order): 1. … 2. … 3. …
- Wow moment in the demo (what makes judges lean forward): …

## 4. Pages (frontend)
| Route | What is on it | Components from the kit |
|---|---|---|
| / | Landing: hero, features, how it works, impact | sections/Landing |
| /app | … | StatTile, AreaChartBox, … |
| /app/… | … | … |

## 5. API contract (backend <-> frontend). Both agents follow this EXACTLY.
| Method | Path | Request JSON | Response JSON |
|---|---|---|---|
| GET | /api/health | – | {status} |
| … | … | … | … |

TypeScript types go in `frontend/src/lib/mock.ts` (+ a mock value for each, used as fallback).
Pydantic models go in `backend/app/schemas.py`.

## 6. Data and model
- Data source: (given dataset / public dataset / realistic synthetic — say which, honestly)
- Model / algorithm: …  · Metric we will report: …

## 7. Demo script (3 minutes)
1. Problem hook (15 s): …
2. Show landing (15 s): …
3. Hero feature live (60 s): click …, type …, see …
4. Wow moment (30 s): …
5. Results numbers (20 s): …
6. Impact + future (20 s): …

## 8. Owners (who edits which files — no two agents edit the same file)
| Agent | Owns |
|---|---|
| frontend-builder | round/frontend/src/** |
| backend-builder | round/backend/** |
| storyteller | round/deck/**, round/doc/** |
| tester | reads everything, writes round/TEST_REPORT.md; small fixes only after asking main |
