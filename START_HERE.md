# START HERE — Ctrl.Alt.Elite @ Cobot-Ex 2026

Your job tomorrow is small: **open Claude in this folder and paste the problem statement.** Claude does the rest.

## Tonight (10 minutes)
| # | Do this | Why |
|---|---|---|
| 1 | Charge the laptop + bring the charger | 2.5 hours of heavy work |
| 2 | Run the health check (below). Everything must say OK | catches problems before the round |
| 3 | (Optional) Run `/practice 50` once | a full test of the system on a sample problem |
| 4 | Sleep | really |

Health check (in a terminal, in this folder):
```
powershell -ExecutionPolicy Bypass -File tools\check_setup.ps1
```

## Tomorrow morning, before Round 1
1. Open the **Claude desktop app → Code tab**. Sign in with tomorrow's account.
2. Start a new session with the folder **`C:\PersonalProjects\Hackathon`** (this exact folder, NOT "AI DS Club").
   Claude reads `CLAUDE.md` here automatically — it knows the whole plan.
3. Choose the most capable model (Opus) in the model picker.
4. Set the permission mode to **Auto** (or "Bypass permissions") so Claude doesn't stop to ask on every command.
   Without this you will waste minutes clicking "Allow".
5. Turn on Windows **Focus assist / Do not disturb**. Close other apps. Connect to Wi-Fi (Claude needs internet).
6. Type `hi, check setup` once — Claude will run the health check and tell you it's ready.

## When the round starts
| Round | Type this, then paste the problem (or attach a photo of it) |
|---|---|
| 1 (50 min) | `/round1` + problem |
| 2 (90 min) | `/round2` + problem |

Then just watch. Claude posts a short status at each step. Other commands:
| Command | When |
|---|---|
| `/status` | "where are we?" — time left, what works, what's next |
| `/finalize` | 5-8 minutes before the end if things are late — ships what works |

You may answer Claude's questions, but you don't need to. It continues with sensible defaults.

## What you get at the end of each round (`round1\deliver\` or `round2\deliver\`)
- The **website** running at http://localhost:5173 (open in Chrome, full screen with F11)
- `..._Deck.pptx` — **animated slides** (open in PowerPoint, press F5) + `.pdf` backup
- `..._Report.docx` — **short report ≤ 10 pages** + `.pdf`
- `DEMO_SCRIPT.md` — what to say, what to click, answers to likely judge questions

## While Claude builds (what the two of you do)
- **Umer:** watch the status, read the BRIEF when it appears (`round1\BRIEF.md`) so you understand the idea.
- **Muizzur:** once the demo script is ready, practise the clicks in the browser twice.
- Decide: who talks, who clicks. Practise the first 20 seconds (the problem + big number) out loud.

## Presenting (3 minutes)
1. Start with the problem and ONE big number. 2. Show the live website (at least 1 minute).
3. Say 3 results numbers. 4. Say what's next. 5. Answer honestly ("we haven't tested that yet, next step is…").
If the demo breaks: refresh the page (it has backup data) or show the screenshot slide.

## If something goes wrong
| Problem | Do |
|---|---|
| Claude seems stuck > 3 min | type `/status` |
| Website not opening | tell Claude "the app is down, restart it" |
| Claude account hits a usage limit | log in with the backup account, open the same folder, type `continue round1` — the plan, BRIEF and code are all in the folder |
| PowerPoint file won't open | use the PDF in the same folder |

## What's in this folder
`CLAUDE.md` (Claude's brain) · `playbook\` (timeline, how to win, UI rules, demo guide) · `.claude\agents\` (6 helper
agents: researcher, backend-builder, frontend-builder, storyteller, tester, judge) · `.claude\commands\` (/round1 /round2
/status /finalize /practice) · `kit\` (starter website + API) · `round1\`, `round2\` (ready copies) · `tools\` (scripts).
