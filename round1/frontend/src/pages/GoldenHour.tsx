/** Golden Hour Engine page (admin) — BRIEF §12 INNOVATION. "We dispatch by survival." */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowRight, BrainCircuit, ChevronRight, FlaskConical, Heart, ListOrdered, Route, Sigma, Sparkles, Timer, Truck, Users, Zap } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, CountUp, EmptyState, Skeleton, useToast } from "@/ui";
import { applyGoldenHour, fmtLoss, getGHSimulation, getGoldenHour, pct, survColor } from "@/lib/golden";
import { errText } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { STATIC } from "@/lib/static";
import { cn } from "@/lib/cn";
import { survivalAt, type GHRow, type GHSimulation, type GoldenHour as GH, type SurvivalProfile } from "@/lib/mock";
import { Heartbeat, ProfileChip } from "@/sections/Survival";

const HALF_LIVES: { p: SurvivalProfile; label: string; half: number; text: string }[] = [
  { p: "cardiac", label: "Cardiac arrest", half: 7, text: "7 min" },
  { p: "fire_trapped", label: "Trapped in fire", half: 12, text: "12 min" },
  { p: "toxic", label: "Gas / shock", half: 20, text: "20 min" },
  { p: "drowning", label: "Rising water", half: 25, text: "25 min" },
  { p: "trauma", label: "Major trauma", half: 60, text: "60 min" },
  { p: "serious", label: "Serious injury", half: 120, text: "2 h" },
  { p: "debris", label: "Under debris", half: 600, text: "10 h" },
];

function DecaySpark({ half }: { half: number }) {
  const pts = Array.from({ length: 31 }, (_, k) => { const t = k * 2; return `${(t / 60) * 100},${40 - survivalAt(t, half) * 38}`; }).join(" ");
  const c = survColor(survivalAt(60, half));
  return (
    <svg viewBox="0 0 100 42" className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,42 ${pts} 100,42`} fill={c} opacity={0.12} stroke="none" />
      <polyline points={pts} fill="none" stroke={c} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Ecg() {
  return (
    <svg viewBox="0 0 600 60" className="pointer-events-none absolute inset-x-0 bottom-3 h-14 w-full opacity-30" preserveAspectRatio="none" aria-hidden>
      <style>{`@keyframes gh-ecg{from{stroke-dashoffset:1200}to{stroke-dashoffset:0}}`}</style>
      <polyline fill="none" stroke="#f87171" strokeWidth={2} strokeDasharray="1200" style={STATIC ? undefined : { animation: "gh-ecg 3.2s linear infinite" }}
        points="0,40 90,40 105,40 115,12 125,55 135,40 230,40 245,40 255,8 265,58 275,40 370,40 385,40 395,14 405,54 415,40 510,40 525,40 535,10 545,56 555,40 600,40" />
    </svg>
  );
}

function RankRow({ r, k, onOpen }: { r: GHRow; k: number; onOpen: () => void }) {
  const col = survColor(r.survival_now);
  return (
    <button onClick={onOpen} className={cn("group w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md",
      k === 0 && r.lives_lost_per_min_delay > 0 ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : "border-line bg-surface")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", k < 3 && r.lives_lost_per_min_delay > 0 ? "bg-red-600 text-white" : "bg-surface-2 text-muted")}>{k + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 line-clamp-2 font-semibold sm:truncate">{r.title}</p>
            {r.cpr_started && <Badge tone="green" dot pulse={!STATIC}><Heart className="size-3" />CPR started</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="font-mono">{r.incident_id}</span><span>· {r.area}</span>
            <ProfileChip profile={r.profile} label={r.profile_label} />
            <span className="inline-flex items-center gap-1"><Users className="size-3" />{r.people_at_risk} at risk</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{fmtLoss(r.lives_lost_per_min_delay)}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">lives lost / min</p>
        </div>
      </div>
      <div className="mt-2.5 pl-11">
        <div className="flex items-center gap-3">
          <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.survival_now * 100}%`, background: col }} />
            <span className="absolute top-0 h-full w-0.5 bg-fg/70" style={{ left: `${r.survival_at_help * 100}%` }} title="Survival when help arrives" />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: col }}>{pct(r.survival_now)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
          <span>At help arrival: <b className="text-fg">{pct(r.survival_at_help)}</b></span>
          <span>In 5 min: <b className="text-red-600 dark:text-red-400">{pct(r.survival_if_5_min_later)}</b></span>
          <span className="inline-flex items-center gap-1"><Timer className="size-3" />{r.help}</span>
        </div>
      </div>
    </button>
  );
}

function SimChart({ s }: { s: GHSimulation }) {
  const data = [
    { name: "Nearest-first", v: s.nearest_first_survivors, c: "#94a3b8" },
    { name: "Golden Hour", v: s.golden_hour_survivors, c: "#dc2626" },
  ];
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
        <XAxis type="number" domain={[0, Math.ceil(s.people_at_risk_avg / 10) * 10]} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={96} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${v} survivors`, "Expected"]} />
        <Bar dataKey="v" radius={[0, 8, 8, 0]} maxBarSize={44} isAnimationActive={!STATIC}>
          {data.map((d) => <Cell key={d.name} fill={d.c} />)}
          <LabelList dataKey="v" position="right" fontSize={13} fontWeight={700} fill="var(--fg)" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function GoldenHour() {
  const nav = useNavigate();
  const toast = useToast();
  const [g, reload, at] = usePoll<GH>(getGoldenHour, 5000);
  const [sim] = usePoll<GHSimulation>(getGHSimulation, 60000);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    try {
      const r = await applyGoldenHour();
      if (!r.assigned) toast("info", "Nothing to assign", "Every life-risk incident already has a team.");
      else toast("success", `Assigned ${r.assigned} team${r.assigned === 1 ? "" : "s"}`, `Golden Hour plan applied · +${r.extra_lives.toFixed(1)} expected lives vs nearest-first`);
      await reload();
    } catch (e) { toast("error", "Could not apply the plan", errText(e)); }
    finally { setBusy(false); }
  }

  const plan = g?.plan;
  const ratio = g && g.people_at_risk ? g.expected_survivors / g.people_at_risk : 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold">Golden Hour Engine</h2>
            <Badge tone="red"><Sparkles className="size-3" />Our innovation</Badge>
          </div>
          <p className="mt-1 text-muted">We don't dispatch by distance or severity. <b className="text-fg">We dispatch by survival.</b></p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted"><span className="size-2 animate-pulse rounded-full bg-red-500" />Live · refresh 5 s{at ? ` · ${at.toLocaleTimeString("en-IN")}` : ""}</p>
      </div>

      {/* Hero strip */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0f1b33] p-5 text-white shadow-xl shadow-red-900/10 sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full bg-red-600/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 size-72 rounded-full bg-rose-500/20 blur-3xl" />
        <Ecg />
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
            <p className="flex items-center gap-2 text-sm text-white/70"><Heartbeat />Lives at risk right now</p>
            <p className="mt-1 font-display text-5xl font-bold tabular-nums">{g ? <CountUp to={g.people_at_risk} /> : "—"}</p>
            <p className="mt-1 text-xs text-white/60">{g ? `${g.incidents.length} incidents with a survival clock` : "Loading…"}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
            <p className="flex items-center gap-2 text-sm text-white/70"><Activity className="size-4 text-emerald-400" />Expected survivors</p>
            <p className="mt-1 font-display text-5xl font-bold tabular-nums text-emerald-300">{g ? <CountUp to={g.expected_survivors} decimals={1} /> : "—"}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${ratio * 100}%` }} /></div>
            <p className="mt-1 text-xs text-white/60">{pct(ratio)} of people at risk, if the current plan holds</p>
          </div>
          <div className="rounded-2xl bg-red-600/25 p-4 ring-1 ring-red-400/40">
            <p className="flex items-center gap-2 text-sm text-red-100"><Zap className="size-4 text-red-300" />Lives lost per minute of delay</p>
            <p className="mt-1 font-display text-5xl font-bold tabular-nums text-red-300">{g ? <CountUp to={g.lives_lost_per_min_delay} decimals={2} /> : "—"}</p>
            <p className="mt-1 text-xs text-red-100/80">Every minute of waiting, across all incidents</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5 [&>*]:min-w-0">
        {/* Ranking */}
        <Card className="xl:col-span-3">
          <CardHeader title="Survival ranking" subtitle="Ranked by lives lost per minute of delay — not distance, not severity score" icon={ListOrdered} />
          <CardBody className="space-y-2.5">
            {!g ? <Skeleton className="h-96" /> : g.incidents.length === 0
              ? <EmptyState icon={Heart} title="No one at risk to life" text="No open incident has injuries or a life threat." />
              : g.incidents.map((r, k) => <RankRow key={r.incident_id} r={r} k={k} onOpen={() => nav(`/admin/incidents/${r.incident_id}`)} />)}
            <p className="pt-1 text-[11px] text-muted">Bar = survival chance now · black tick = survival when help arrives (unassigned: next free team in ~90 min).</p>
          </CardBody>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHeader title="Proof: simulation" subtitle="Golden Hour vs nearest-first dispatch" icon={FlaskConical}
              action={<Badge tone="amber">Simulation</Badge>} />
            <CardBody>
              {!sim ? <Skeleton className="h-60" /> : (<>
                <div className="rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 p-4 text-white">
                  <p className="font-display text-3xl font-bold">+{Math.round(sim.improvement_pct)}% survivors</p>
                  <p className="text-sm text-red-100">+{sim.extra_lives_per_disaster.toFixed(1)} lives per disaster · same {sim.teams} teams</p>
                </div>
                <p className="mt-3 text-xs font-medium text-muted">Expected survivors per disaster ({sim.people_at_risk_avg} people at risk)</p>
                <SimChart s={sim} />
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{sim.method} <b>Simulation, simplified survival model.</b></p>
              </>)}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Plan */}
      <Card className="mt-4 min-w-0">
        <CardHeader title="Golden Hour dispatch plan" subtitle={plan ? `${plan.people_waiting} people waiting · ${plan.teams_free} free teams` : "Best team per incident to save the most lives"} icon={Route}
          action={<Button icon={Truck} loading={busy} disabled={!plan?.steps.length} onClick={apply} className="hidden bg-red-600 hover:bg-red-500 sm:inline-flex">Apply Golden Hour plan</Button>} />
        <CardBody>
          {!plan ? <Skeleton className="h-48" /> : plan.steps.length === 0 ? (
            <EmptyState icon={Truck} title="Nothing to dispatch" text="Every life-risk incident already has a team on the way." />
          ) : (<>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-xs font-medium text-red-700 dark:text-red-300">Golden Hour plan</p>
                <p className="font-display text-3xl font-bold tabular-nums">{plan.expected_survivors_golden.toFixed(1)}</p>
                <p className="text-xs text-muted">expected survivors</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-2 p-4">
                <p className="text-xs font-medium text-muted">Nearest-first</p>
                <p className="font-display text-3xl font-bold tabular-nums text-muted">{plan.expected_survivors_nearest.toFixed(1)}</p>
                <p className="text-xs text-muted">expected survivors</p>
              </div>
              <div className="rounded-2xl bg-emerald-600 p-4 text-white">
                <p className="text-xs font-medium text-emerald-100">Difference</p>
                <p className="font-display text-3xl font-bold tabular-nums">+{plan.extra_lives.toFixed(1)} lives</p>
                <p className="text-xs text-emerald-100">{plan.extra_lives > 0.05 ? "saved by dispatching on survival" : "same plan right now — gains grow when teams are scarce"}</p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Incident</th><th className="py-2 pr-3">Need</th><th className="py-2 pr-3">Golden Hour sends</th>
                  <th className="py-2 pr-3 text-right">ETA</th><th className="py-2 pr-3 text-right">+ Lives</th><th className="py-2">Nearest-first would send</th>
                </tr></thead>
                <tbody>{plan.steps.map((s, k) => {
                  const same = s.nearest_first_team === s.team_name;
                  return (
                    <tr key={s.incident_id} onClick={() => nav(`/admin/incidents/${s.incident_id}`)} className="cursor-pointer border-t border-line hover:bg-surface-2">
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted">{k + 1}</td>
                      <td className="max-w-[260px] py-2.5 pr-3"><p className="truncate font-medium">{s.title}</p><p className="truncate text-xs text-muted">{s.profile_label}</p></td>
                      <td className="py-2.5 pr-3 whitespace-nowrap"><Users className="mr-1 inline size-3.5 text-muted" />{s.people_at_risk}</td>
                      <td className="py-2.5 pr-3 font-medium">{s.team_name}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{Math.round(s.eta_min)} min</td>
                      <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-emerald-600">+{s.lives_gained.toFixed(2)}</td>
                      <td className={cn("py-2.5 text-xs", same ? "text-muted" : "font-medium text-amber-700 dark:text-amber-300")}>{s.nearest_first_team ?? "—"}{same ? " (same)" : ""}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>)}
          <Button icon={Truck} size="lg" loading={busy} disabled={!plan?.steps.length} onClick={apply} className="mt-4 w-full bg-red-600 hover:bg-red-500 sm:hidden">Apply Golden Hour plan</Button>
        </CardBody>
      </Card>

      {/* How it works */}
      <Card className="mt-4 min-w-0">
        <CardHeader title="How it works" subtitle="A survival clock for every person at risk" icon={BrainCircuit} />
        <CardBody className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl bg-[#0f1b33] p-4 text-white">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/60"><Sigma className="size-3.5" />Survival model</p>
              <p className="mt-2 font-mono text-lg">survival = 95% × 0.5<sup>(min waiting ÷ half-life)</sup></p>
            </div>
            <ol className="space-y-2 text-sm">
              {[
                "Each incident gets a condition profile with its own half-life.",
                "Lives lost per minute of delay = people × survival drop in the next minute.",
                "CPR / first aid by a hero slows the fall (×3 for cardiac); a team on scene stops it.",
                "Teams go where they save the most expected lives — not to the nearest call.",
              ].map((t, k) => (
                <li key={k} className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-red-600 text-[11px] font-bold text-white">{k + 1}</span><span>{t}</span></li>
              ))}
            </ol>
            <Link to="/admin/incidents" className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline">See a live survival curve on any incident <ArrowRight className="size-4" /></Link>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Half-life per condition · curve = first 60 min without help</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HALF_LIVES.map((h) => (
                <div key={h.p} className="min-w-0 rounded-xl border border-line p-2.5">
                  <p className="truncate text-xs font-medium">{h.label}</p>
                  <p className="font-display text-lg font-bold">{h.text}</p>
                  <DecaySpark half={h.half} />
                </div>
              ))}
              <div className="min-w-0 rounded-xl bg-emerald-50 p-2.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <p className="text-xs font-medium">CPR hero on scene</p>
                <p className="font-display text-lg font-bold">×3 slower</p>
                <p className="text-[11px]">Team arrival stops the fall <ChevronRight className="inline size-3" /></p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted">Simplified demo assumptions based on published survival patterns; not a clinical tool.</p>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
