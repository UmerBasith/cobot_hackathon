/**
 * BRIEF §12 INNOVATION — Golden Hour Engine + CPR Hero Network building blocks.
 *   <SurvivalCard incidentId>  live survival curve for one incident (5 s refresh)
 *   <HeroCard incidentId>      CPR Hero Network: trained citizens responding nearby
 *   <GoldenHourCard>           compact dashboard card (lives at risk, top 3 by lives lost / min)
 * Survival model is a simplified demo assumption — always labelled as such.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowRight, BellRing, ExternalLink, HeartHandshake, HeartPulse, MapPin, ShieldCheck, Timer, Users } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Skeleton, useToast } from "@/ui";
import { alertHeroes, fmtLoss, getGoldenHour, getIncidentHeroes, getSurvival, pct, survColor } from "@/lib/golden";
import { errText } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { STATIC } from "@/lib/static";
import { cn } from "@/lib/cn";
import type { GoldenHour, HeroStatus, HeroVolunteer, IncidentHeroes, SurvivalOut, SurvivalPoint, SurvivalProfile } from "@/lib/mock";

type Tone = "brand" | "green" | "amber" | "red" | "gray" | "blue";

/** Colour per survival profile (chips on every Golden Hour screen). */
export const PROFILE_TONE: Record<SurvivalProfile, string> = {
  cardiac: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900",
  fire_trapped: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900",
  drowning: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900",
  toxic: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900",
  trauma: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900",
  debris: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900",
  serious: "bg-yellow-50 text-yellow-800 ring-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:ring-yellow-900",
  minor: "bg-surface-2 text-muted ring-line",
};

export function ProfileChip({ profile, label, className }: { profile: SurvivalProfile | null; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
      profile ? PROFILE_TONE[profile] : PROFILE_TONE.minor, className)}>
      <HeartPulse className="size-3 shrink-0" /><span className="truncate">{label}</span>
    </span>
  );
}

/** Small pulsing heart — "this number is alive". */
export function Heartbeat({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-grid size-5 place-items-center", className)}>
      {!STATIC && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
      <HeartPulse className="relative size-4 text-red-500" />
    </span>
  );
}

/* --------------------------------- Survival -------------------------------- */
const C = { none: "#94a3b8", cpr: "#10b981", plan: "#dc2626", now: "var(--fg)", help: "#0284c7" };

function at(points: SurvivalPoint[], t: number, key: keyof SurvivalPoint) {
  if (!points.length) return 0;
  const p = points.find((x) => x.t >= t) ?? points[points.length - 1];
  return p[key];
}

function SurvivalTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-muted">Minute {label} after report</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span><span className="font-semibold tabular-nums">{p.value}%</span></p>
      ))}
    </div>
  );
}

export function SurvivalCard({ incidentId, className }: { incidentId: string; className?: string }) {
  const [s] = usePoll<SurvivalOut>(() => getSurvival(incidentId), 5000, [incidentId]);

  if (!s) return <Card className={cn("rounded-2xl", className)}><CardHeader title="Survival forecast" icon={HeartPulse} /><CardBody><Skeleton className="h-72" /></CardBody></Card>;
  if (!s.profile || !s.points.length) {
    return (
      <Card className={cn("rounded-2xl", className)}>
        <CardHeader title="Survival forecast" subtitle="Golden Hour Engine" icon={HeartPulse} />
        <CardBody><EmptyState icon={ShieldCheck} title="No one at risk to life" text={s.basis || "No injuries or life threat reported. This incident is ranked by severity only."} /></CardBody>
      </Card>
    );
  }

  const now = s.now_min ?? 0;
  const sNow = (s.survival_now ?? at(s.points, now, "current_plan")) / 100;
  const in15 = at(s.points, now + 15, "current_plan");
  const cpr15 = at(s.points, now + 15, "with_cpr");
  const maxT = s.points[s.points.length - 1].t;
  const mini = [
    { k: "In 15 min (current plan)", v: `${Math.round(in15)}%`, c: survColor(in15 / 100) },
    { k: s.cpr_min != null ? "In 15 min (CPR running)" : "In 15 min if CPR starts now", v: `${Math.round(cpr15)}%`, c: C.cpr },
    { k: "Half-life", v: (s.half_life_min ?? 0) >= 120 ? `${Math.round((s.half_life_min ?? 0) / 60)} h` : `${s.half_life_min} min`, c: "var(--fg)" },
    { k: "People at risk", v: String(s.people_at_risk), c: "var(--fg)" },
  ];

  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardHeader title="Survival forecast" subtitle="Golden Hour Engine · live every 5 s" icon={HeartPulse}
        action={<Badge tone="red" dot pulse={!STATIC}>Live</Badge>} />
      <CardBody>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">Survival chance now</p>
            <p className="font-display text-4xl font-bold tabular-nums leading-none" style={{ color: survColor(sNow) }}>{Math.round(sNow * 100)}%</p>
          </div>
          <div className="min-w-0 max-w-full space-y-1 text-right sm:max-w-[60%]">
            <ProfileChip profile={s.profile} label={s.profile_label} />
            <p className="text-xs text-muted">{s.basis}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {mini.map((m) => (
            <div key={m.k} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2">
              <p className="truncate text-[11px] text-muted" title={m.k}>{m.k}</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: m.c }}>{m.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={s.points} margin={{ top: 22, right: 12, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id={`surv-${incidentId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={C.plan} stopOpacity={0.28} />
                  <stop offset="1" stopColor={C.plan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="t" type="number" domain={[0, maxT]} tickCount={7} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v)}m`} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<SurvivalTip />} />
              <Area type="monotone" dataKey="current_plan" name="Current plan" stroke={C.plan} strokeWidth={2.8} fill={`url(#surv-${incidentId})`} isAnimationActive={!STATIC} animationDuration={900} />
              <Line type="monotone" dataKey="with_cpr" name="With CPR / first aid" stroke={C.cpr} strokeWidth={2} dot={false} isAnimationActive={!STATIC} />
              <Line type="monotone" dataKey="no_help" name="No help" stroke={C.none} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={!STATIC} />
              {s.cpr_min != null && <ReferenceLine x={s.cpr_min} stroke={C.cpr} strokeDasharray="3 3" label={{ value: "CPR started", position: "insideBottomLeft", fill: C.cpr, fontSize: 11, fontWeight: 600 }} />}
              {s.help_min != null && <ReferenceLine x={s.help_min} stroke={C.help} strokeDasharray="3 3" label={{ value: "Team arrives", position: "insideTopLeft", fill: C.help, fontSize: 11, fontWeight: 600 }} />}
              <ReferenceLine x={now} stroke={C.now} strokeWidth={1.5} label={{ value: "Now", position: "top", fill: "var(--fg)", fontSize: 11, fontWeight: 700 }} />
              <ReferenceDot x={now} y={Math.round(sNow * 1000) / 10} r={5} fill={C.plan} stroke="white" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: C.plan }} />Current plan</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: C.cpr }} />With CPR / first aid</span>
          <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: C.none }} />No help</span>
          <span className="ml-auto flex items-center gap-1.5 text-muted"><Timer className="size-3.5" />{s.help ?? "No team assigned"}</span>
        </div>
        <p className="mt-2 text-[11px] text-muted">Survival = 95 % × 0.5^(minutes waiting ÷ half-life) · CPR slows the fall ×{s.cpr_slowdown ?? 1} · a team on scene stops it. Simplified demo model.</p>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------- Heroes --------------------------------- */
export const HERO_META: Record<HeroStatus | "not alerted", { label: string; tone: Tone; pulse?: boolean }> = {
  alerted: { label: "Alerted", tone: "amber", pulse: true },
  accepted: { label: "On the way", tone: "blue", pulse: true },
  arrived: { label: "Arrived", tone: "brand" },
  cpr: { label: "Doing CPR", tone: "green", pulse: true },
  done: { label: "Handed over", tone: "gray" },
  declined: { label: "Declined", tone: "red" },
  "not alerted": { label: "Not alerted", tone: "gray" },
};
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const dist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

function HeroRow({ id, name, skills, distance_m, eta_min, status, compact }: {
  id: string; name: string; skills: string[]; distance_m: number; eta_min: number; status: HeroStatus | "not alerted"; compact?: boolean;
}) {
  const m = HERO_META[status];
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-2.5", status === "cpr" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-line")}>
      <span className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-red-500 to-rose-700 font-bold text-white", compact ? "size-8 text-xs" : "size-10 text-sm")}>{initials(name)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {!compact && <Badge tone={m.tone} dot pulse={m.pulse && !STATIC}>{m.label}</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {skills.map((sk) => <span key={sk} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">{sk}</span>)}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        <p className="font-semibold tabular-nums">{dist(distance_m)}</p>
        <p className="text-muted">~{Math.max(1, Math.round(eta_min))} min</p>
        {!compact && (
          <Link to={`/hero?id=${id}`} target="_blank" className="mt-0.5 inline-flex items-center gap-0.5 font-medium text-red-600 hover:underline dark:text-red-400" title="Open this hero's phone app (demo)">
            Hero app<ExternalLink className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function HeroCard({ incidentId, className }: { incidentId: string; className?: string }) {
  const toast = useToast();
  const [h, reload] = usePoll<IncidentHeroes>(() => getIncidentHeroes(incidentId), 5000, [incidentId]);
  const [busy, setBusy] = useState(false);

  async function alertNow() {
    setBusy(true);
    try {
      const r = await alertHeroes(incidentId, 3);
      const vols = (r.incident as typeof r.incident & { volunteers?: HeroVolunteer[] }).volunteers ?? [];
      const names = vols.filter((v) => r.alerted.includes(v.id)).map((v) => `${v.name} (${dist(v.distance_m)})`);
      toast("success", `Alerted ${r.alerted.length} CPR hero${r.alerted.length === 1 ? "" : "es"}`, names.join(" · ") || r.alerted.join(", "));
      await reload();
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (msg.startsWith("409")) toast("warning", "No more heroes within 3 km", "Every available trained citizen nearby is already alerted.");
      else toast("error", "Could not alert heroes", errText(e));
    } finally { setBusy(false); }
  }

  const free = (h?.nearby ?? []).filter((n) => n.status === "not alerted");
  const active = (h?.responding ?? []).filter((v) => v.status !== "declined");
  const onScene = active.filter((v) => v.status === "arrived" || v.status === "cpr").length;

  return (
    <Card className={cn("flex flex-col rounded-2xl", className)}>
      <CardHeader title="CPR Hero Network" subtitle="Trained citizens within 3 km" icon={HeartHandshake}
        action={h && active.length > 0 ? <Badge tone={onScene ? "green" : "amber"} dot pulse={!STATIC}>{onScene ? `${onScene} on scene` : `${active.length} responding`}</Badge> : undefined} />
      <CardBody className="flex flex-1 flex-col gap-3">
        <p className="rounded-xl bg-red-50/70 px-3 py-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-200">
          The closest responder is usually not in an ambulance. Verified volunteers start CPR in the first minutes, while the team is on the way.
        </p>
        {!h ? <Skeleton className="h-40" /> : (<>
          {h.responding.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Responding</p>
              {h.responding.map((v) => <HeroRow key={v.id} {...v} />)}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3 text-sm">
              <Users className="size-5 shrink-0 text-muted" />
              <span className="text-muted">{h.needs_heroes ? "No hero alerted yet — alert the nearest trained citizens." : "No life threat reported. Heroes can still be alerted for first aid."}</span>
            </div>
          )}
          {free.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted"><MapPin className="size-3" />Nearby, not alerted</p>
              {free.slice(0, 3).map((n) => <HeroRow key={n.id} {...n} compact />)}
              {free.length > 3 && <p className="text-xs text-muted">+{free.length - 3} more within {h.radius_m / 1000} km</p>}
            </div>
          )}
          <Button icon={BellRing} loading={busy} disabled={!free.length} onClick={alertNow} className="mt-auto w-full bg-red-600 hover:bg-red-500">
            {free.length ? `Alert ${Math.min(3, free.length)} nearest hero${Math.min(3, free.length) === 1 ? "" : "es"}` : "No more heroes within 3 km"}
          </Button>
        </>)}
      </CardBody>
    </Card>
  );
}

/* ------------------------------ Dashboard card ----------------------------- */
export function GoldenHourCard() {
  const [g] = usePoll<GoldenHour>(getGoldenHour, 5000);
  const top = (g?.incidents ?? []).filter((r) => r.lives_lost_per_min_delay > 0).slice(0, 3);
  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-red-200 bg-[#0f1b33] text-white shadow-lg shadow-red-900/10 dark:border-red-900">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-red-600/40 blur-3xl" />
      <div className="relative grid grid-cols-1 gap-4 p-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-200"><Heartbeat className="size-4" />Golden Hour</p>
            <p className="text-[11px] text-white/60">We dispatch by survival</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] text-white/70">Lives at risk</p>
            <p className="font-display text-2xl font-bold tabular-nums">{g ? g.people_at_risk : "—"}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] text-white/70">Lives lost / min of delay</p>
            <p className="font-display text-2xl font-bold tabular-nums text-red-300">{g ? g.lives_lost_per_min_delay.toFixed(2) : "—"}</p>
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          {!g ? <Skeleton className="h-16 bg-white/10" /> : top.length === 0 ? <p className="text-sm text-white/70">No one is losing survival chance right now.</p> : top.map((r, k) => (
            <Link key={r.incident_id} to={`/admin/incidents/${r.incident_id}`} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/10">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-red-600 text-[11px] font-bold">{k + 1}</span>
              <span className="min-w-0 flex-1 truncate">{r.title} <span className="text-white/50">· {r.area}</span></span>
              <span className="hidden shrink-0 text-xs tabular-nums text-white/70 sm:inline">{pct(r.survival_now)} survival</span>
              <span className="shrink-0 font-mono text-xs font-semibold text-red-300">−{fmtLoss(r.lives_lost_per_min_delay)}/min</span>
            </Link>
          ))}
        </div>
        <Link to="/admin/golden-hour" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-500">
          Open Golden Hour Engine<ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
