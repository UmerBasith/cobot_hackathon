# Timeline — minute by minute

Run `.venv\Scripts\python tools\clock.py <round>` at every row. If you are behind, apply the CUT rules at the bottom.

## Round 1 — 50 minutes
| Min | Main Claude (captain) | Background agents |
|---|---|---|
| 0 | Start clock. Git checkpoint. Spawn **researcher**. Say to user: "Got it. Planning (5 min)." | researcher starts |
| 0-5 | Analyse problem → 3 ideas → score → pick. Fill BRIEF.md (contract + pages + demo script). | researcher |
| 5-6 | Spawn **backend-builder + frontend-builder + storyteller** in ONE message. Tell user: "Building. Idea: <one line>." | |
| 6-8 | `run_app.ps1`. Merge first research facts into BRIEF §1/§6 (or forward to storyteller). | builders, storyteller |
| 8-20 | Watch, unblock, review what lands in the browser. Commit when hero feature appears. | builders |
| **20** | **Checkpoint: hero feature must work end-to-end.** If not → CUT rule A. | |
| 20-32 | Builders add supporting features + polish. Captain checks UI against UI_RULES. | |
| 32 | Spawn **tester** (backend tests, typecheck/build, every page, every button, bad input). | tester |
| 32-39 | Fix bugs (route to owner agent or fix small ones). Commit. | |
| 39-44 | Screenshots of 2-3 best screens → storyteller finalises deck + doc → build → export → check PNGs. | storyteller |
| 44-46 | Fix any slide/doc overflow. Copy everything into deliver/. | |
| 46-50 | **CODE FREEZE.** DEMO_SCRIPT.md. App open on best page. 5-line summary to user. | |

## Round 2 — 90 minutes
| Min | Main Claude (captain) | Background agents |
|---|---|---|
| 0 | Clock, git, spawn **researcher**. | researcher |
| 0-10 | Analyse, 3 ideas, score, pick. Full BRIEF.md. This round has time for a **second wow feature** — plan it but mark it "phase B". | researcher |
| 10 | Spawn **backend + frontend + storyteller** in one message. | |
| 10-35 | Phase A: hero feature end-to-end. **Checkpoint at 35.** | builders |
| 35-55 | Phase B: second feature, real data/model improvements, polish, dark mode check, mobile check. | builders |
| 55 | Spawn **tester** AND **judge** together. | tester, judge |
| 55-68 | Fix bugs. Apply judge's top fixes that take <5 min each. | |
| 68-80 | Screenshots → final deck + doc → export → visual check → deliver/. | storyteller |
| 80-84 | Last fixes to deck/doc only. | |
| 84-90 | **CODE FREEZE.** DEMO_SCRIPT.md + Q&A prep. Summary to user. | |

## CUT rules (when behind)
- **A — hero feature not working at the checkpoint:** stop all extras. Captain joins the debugging. Simplify the
  feature (rules instead of ML, sample data instead of upload) until it works. Then continue.
- **B — 12 minutes left and app still has bugs:** hide broken features (remove from nav), keep what works.
- **C — deck/doc not started 15 min before end:** captain builds deck.json directly from BRIEF (10 slides) — it takes
  3 minutes with `tools/deck_example.json` as the pattern. Report can be 4 pages.
- Never cut: the working demo, the deck, the demo script.

## Status messages to the user (copy this style)
- "✅ Plan ready (min 5). Idea: <name> — <one line>. Building now."
- "🔨 Min 20: <hero feature> works. Adding <x>."
- "🧪 Min 32: testing. 2 bugs found, fixing."
- "📦 Min 44: deck + report ready in round1/deliver."
- "🏁 Min 48: FREEZE. Open http://localhost:5173. Demo script: round1/deliver/DEMO_SCRIPT.md"
