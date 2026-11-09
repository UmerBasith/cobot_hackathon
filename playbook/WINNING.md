# How to win — what judges score and how to pick the idea

## What college hackathon judges actually score (typical rubric)
| Criterion | Weight | What earns full marks |
|---|---|---|
| Problem understanding & relevance | 15-20% | You restate the problem in one sharp sentence, name the user, show a real number about the pain |
| Innovation / uniqueness | 15-20% | One clear twist others won't have (AI explanation, simulation, prediction, smart automation) |
| Technical implementation | 20-25% | It WORKS live. Real logic (model, algorithm, API), not just screens. Clean architecture slide |
| Completeness / functionality | 15% | The full user journey works end to end: input → processing → result → action |
| UI / UX | 10-15% | Looks like a real product. Clear, fast, no broken states |
| Impact & feasibility | 10% | Who benefits, how much, how it scales, cost, next steps |
| Presentation | 10-15% | Confident 3-minute story, live demo, numbers, answers questions honestly |

**Most teams lose on:** broken demo, vague problem, no numbers, ugly UI, running out of time, over-promising.
We win by: working demo + sharp story + real metrics + premium UI + on time.

## Picking the best idea (do this in phase 1, ~3 minutes)
1. Write the problem in ONE sentence: "<user> can't <goal> because <cause>, which costs <impact>."
2. List the must-haves from the statement (every noun/verb the judges wrote is a checklist item).
3. Generate 3 ideas: one safe, one ambitious, one clever-twist. Score each 1-5 on:
   Impact · Innovation · Doable in time (with the kit!) · Demo wow · Fits the problem exactly.
4. Pick the highest total; break ties by **Doable**. Then add ONE wow element from the list below.

## Wow elements the kit already supports (cheap to add)
| Wow | Kit piece | Good for |
|---|---|---|
| Live prediction with score gauge + "why" factors | RingGauge + ProgressBar + backend model | risk, health, quality, fraud, maintenance, crop, demand |
| AI assistant that answers from live data | ChatPanel + /api/assistant (rule fallback) | any domain |
| Robot / agent simulation with path planning | GridSim (A*, collision avoidance) | robotics, cobots, warehouse, traffic, evacuation, delivery |
| Live updating dashboard | StatTile count-up + charts + polling | monitoring, IoT, energy, smart city |
| Upload your data → instant analysis | FileDrop + /api/analyze | data, education, business |
| What-if sliders | Slider + predict endpoint | planning, pricing, energy, scheduling |
| Before/after comparison | compare slide + side-by-side cards | sustainability, efficiency |

## Problem type → solution archetype (starting points, adapt!)
| Problem smells like… | Build | Hero feature |
|---|---|---|
| Robotics / cobots / automation | Control & monitoring dashboard + simulation (GridSim) + safety rules | Simulate the robots doing the task; show efficiency/collision metrics |
| Predictive maintenance / IoT | Sensor dashboard + failure risk model | Move sliders → risk gauge + cause + action |
| Healthcare | Triage/risk screener + doctor dashboard | Enter symptoms/vitals → risk + recommendation (with disclaimer) |
| Agriculture | Crop/disease/irrigation advisor | Input soil/weather → recommendation + savings |
| Education | Personalised learning / performance predictor | Student data → at-risk flag + plan |
| Smart city / traffic / energy | Live map-less grid dashboard + optimiser | Optimise schedule/route → % saved |
| Sustainability / waste | Tracker + classifier + impact calculator | Input → category + CO2 saved |
| Safety / security | Anomaly detector + alerting | Stream → anomaly flagged in real time |
| Finance / commerce | Forecast / fraud / recommendation | Transaction → fraud score + reason |
| Social / accessibility | Assistive app + AI helper | Task done in 2 clicks instead of 10 |
| Hardware required (Arduino/sensors) | Web **digital twin** that simulates the hardware + the real Arduino code in the report appendix | Simulated device behaving correctly live |

## Data honesty
- Given dataset → use it, report real metrics on a held-out split.
- No dataset → generate realistic synthetic data with documented assumptions (ranges from research), say "synthetic"
  on the results slide note. Optional: name a real public dataset as "next step".
- Always show at least 3 real numbers: a quality metric (accuracy/F1/error), a speed number, a test count.

## The story (deck order)
Title → Problem (one big number) → Solution (3 cards) → How it works (flow) → Live demo (screenshot) →
Results (stats) → Why we're different (compare/table) → Impact/feasibility → Roadmap → Thank you.
