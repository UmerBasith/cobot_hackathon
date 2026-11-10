/** /track and /track/:id — citizen incident tracking (mobile-first, no contact details shown). */
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Clock, Copy, History, MapPin, Radar, Search, ShieldAlert, Siren, Timer, Truck } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Skeleton, Timeline } from "@/ui";
import { CitizenHeader } from "./Report";
import { Call112, CATEGORY_META, CategoryIcon, ReasonsList, SeverityBadge, SEV_HEX } from "@/sections/IncidentUI";
import { ScoreRing } from "@/sections/ReportFlow";
import { ASG_META, TeamIcon } from "@/sections/Dispatch";
import { getTrack, timeAgo } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { STATIC } from "@/lib/static";
import { STATUSES, type TrackOut } from "@/lib/mock";

const STEP_TEXT = {
  Reported: "Your report reached the control room.",
  Pending: "Verified. A response team is being arranged.",
  "In Progress": "Help is on the way or already on site.",
  Resolved: "The incident is closed. Thank you for reporting.",
} as const;

export default function Track() {
  const { id } = useParams();
  return (
    <div className="min-h-screen bg-bg">
      <CitizenHeader />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-12">
        <Lookup current={id} />
        {id ? <Tracker id={id.toUpperCase()} /> : <Intro />}
      </main>
    </div>
  );
}

function Lookup({ current }: { current?: string }) {
  const nav = useNavigate();
  const [v, setV] = useState(current ?? "");
  function go(e: FormEvent) {
    e.preventDefault();
    let x = v.trim().toUpperCase();
    if (/^\d+$/.test(x)) x = `INC-${x}`;
    if (x) nav(`/track/${encodeURIComponent(x)}`);
  }
  return (
    <form onSubmit={go} className="mb-5">
      {!current && (
        <>
          <h1 className="text-3xl font-semibold">Track your report</h1>
          <p className="mt-1 mb-4 text-muted">Enter the reference ID you got after reporting, e.g. <span className="font-mono">INC-1012</span>.</p>
        </>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="INC-1012" className="h-12 pl-9 font-mono text-base uppercase" aria-label="Reference ID" />
        </div>
        <Button type="submit" size="lg" icon={Radar}>Track</Button>
      </div>
    </form>
  );
}

function Intro() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { icon: Siren, t: "Live status", d: "Reported → Pending → In Progress → Resolved." },
        { icon: Truck, t: "Teams on the way", d: "See which team is coming and its ETA." },
        { icon: ShieldAlert, t: "Why this priority", d: "The same reasons the control room sees." },
      ].map((x) => (
        <Card key={x.t} className="p-5">
          <x.icon className="size-5 text-brand-600" />
          <p className="mt-3 font-semibold">{x.t}</p>
          <p className="mt-1 text-sm text-muted">{x.d}</p>
        </Card>
      ))}
      <div className="sm:col-span-3">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted">Haven&apos;t reported yet?</p>
          <Link to="/report"><Button iconRight={ArrowRight}>Report an emergency</Button></Link>
        </Card>
      </div>
    </div>
  );
}

function Tracker({ id }: { id: string }) {
  const [t, , at] = usePoll<TrackOut | null>(() => getTrack(id), 5000, [id]);
  if (t === null && at) {
    return <EmptyState icon={Search} title={`No report found for ${id}`} text="Check the reference ID. It looks like INC-1012." action={<Link to="/report"><Button variant="outline">Report an emergency</Button></Link>} />;
  }
  if (!t) return <div className="space-y-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;

  const idx = STATUSES.indexOf(t.status);
  const done = t.status === "Resolved";
  const active = t.teams.filter((x) => x.status !== "rejected");
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className={cn("p-5 text-white", done ? "bg-gradient-to-br from-emerald-600 to-emerald-800" : t.severity === "Critical" ? "bg-gradient-to-br from-red-600 to-red-800" : "bg-gradient-to-br from-brand-600 to-brand-800")}>
          <div className="flex items-start gap-3">
            <CategoryIcon category={t.category} className="size-11 bg-white/20 text-white dark:bg-white/20 dark:text-white" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-mono text-sm text-white/80">{t.id}<button type="button" onClick={() => navigator.clipboard?.writeText(t.id)} aria-label="Copy ID"><Copy className="size-3.5" /></button> · {CATEGORY_META[t.category]?.label}</p>
              <h2 className="mt-0.5 text-xl font-semibold leading-tight sm:text-2xl">{t.title}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-white/80"><MapPin className="size-3.5" />{t.area}{t.landmark ? ` · ${t.landmark}` : ""}</p>
            </div>
          </div>
          <p className="mt-4 text-lg font-semibold">{t.status === "In Progress" ? "Help is on the way" : t.status}</p>
          <p className="text-sm text-white/85">{STEP_TEXT[t.status]}</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-4 gap-2">
            {STATUSES.map((s, k) => {
              const reached = k <= idx;
              return (
                <div key={s} className="text-center">
                  <div className="relative flex items-center">
                    <div className={cn("h-1.5 flex-1 rounded-full", k === 0 ? "bg-transparent" : k <= idx ? "bg-emerald-500" : "bg-line")} />
                    <motion.div initial={STATIC ? false : { scale: 0.6 }} animate={{ scale: 1 }}
                      className={cn("relative grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                        k < idx || done ? "bg-emerald-500 text-white" : k === idx ? "bg-brand-600 text-white ring-4 ring-brand-500/20" : "bg-surface-2 text-muted")}>
                      {k === idx && !done && !STATIC && <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" />}
                      {reached && (k < idx || done) ? <CheckCircle2 className="relative size-5" /> : <span className="relative">{k + 1}</span>}
                    </motion.div>
                    <div className={cn("h-1.5 flex-1 rounded-full", k === 3 ? "bg-transparent" : k < idx ? "bg-emerald-500" : "bg-line")} />
                  </div>
                  <p className={cn("mt-2 text-[11px] leading-tight sm:text-xs", k === idx ? "font-semibold text-fg" : "text-muted")}>{s}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted"><Clock className="size-3.5" />Reported {timeAgo(t.created_at)} · last update {fmtTime(t.updated_at)}{at ? ` · live, checked ${fmtTime(at)}` : ""}</p>
          {t.duplicate_of && (
            <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">This report was merged with <Link className="font-mono font-semibold text-brand-600 hover:underline dark:text-brand-300" to={`/track/${t.duplicate_of}`}>{t.duplicate_of}</Link> — the same incident reported by others. Track that one for updates.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold"><Truck className="size-4 text-brand-600" />Teams on the way</p>
          {active.length === 0 ? (
            <p className="text-sm text-muted">{done ? "No team needed any more." : "A team will be assigned shortly. Critical reports are handled first."}</p>
          ) : (
            <div className="space-y-2">
              {active.map((x, k) => (
                <div key={k} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  <TeamIcon type={x.team_type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{x.team_name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted"><Timer className="size-3" />ETA about {Math.round(x.eta_min)} min</p>
                  </div>
                  <Badge tone={ASG_META[x.status].tone} dot pulse={x.status === "en_route"}>{ASG_META[x.status].label}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold"><ShieldAlert className="size-4 text-brand-600" />Priority</p>
          <div className="mb-3 flex items-center gap-3">
            <ScoreRing score={t.score} color={SEV_HEX[t.severity]} size={56} />
            <div><SeverityBadge severity={t.severity} /><p className="mt-1 text-xs text-muted">Set by transparent rules</p></div>
          </div>
          <ReasonsList reasons={t.reasons.slice(0, 4)} compact />
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-4 flex items-center gap-2 font-semibold"><History className="size-4 text-brand-600" />Updates</p>
        <Timeline items={[...t.timeline].reverse().map((e) => ({
          title: e.status, time: fmtTime(e.at), text: e.note,
          tone: e.status === "Resolved" ? "green" : e.status === "In Progress" ? "brand" : e.status === "Pending" ? "amber" : "red",
        }))} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm text-red-900 dark:text-red-100"><b>Situation got worse?</b> Call 112 immediately.</p>
        <Call112 />
      </Card>
    </div>
  );
}
