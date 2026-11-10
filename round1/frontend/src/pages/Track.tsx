/** /track and /track/:id — citizen incident tracking (mobile-first, no contact details shown). */
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ambulance, Calendar, Check, Clock, History, MapPin, Phone, Search, ShieldAlert, Timer } from "lucide-react";
import { Skeleton } from "@/ui";
import { CitizenShell, RED } from "@/sections/CitizenShell";
import { CATEGORY_META, CategoryIcon, ReasonsList } from "@/sections/IncidentUI";
import { LazyMap } from "@/sections/LazyMap";
import { getTrack, timeAgo } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { fmtTime } from "@/lib/format";
import { areaByName } from "@/lib/geo";
import { cn } from "@/lib/cn";
import type { Severity, TrackOut } from "@/lib/mock";

type T = TrackOut & { lat?: number; lng?: number };
const P: Record<Severity, string> = { Critical: "P1 – Critical", High: "P2 – High", Medium: "P3 – Medium", Low: "P4 – Low" };
const PCLS: Record<Severity, string> = { Critical: "bg-red-600 text-white", High: "bg-orange-500 text-white", Medium: "bg-amber-400 text-amber-950", Low: "bg-emerald-600 text-white" };
const STEPS = ["Reported", "Verified", "Assigned", "In Progress", "On Scene", "Resolved"] as const;

export default function Track() {
  const { id } = useParams();
  return (
    <CitizenShell>
      <Hero current={id} />
      <main className="mx-auto max-w-6xl px-4 pb-12 md:px-6">
        {id ? <Tracker id={id.toUpperCase()} /> : <Hint />}
      </main>
    </CitizenShell>
  );
}

function Hero({ current }: { current?: string }) {
  const nav = useNavigate();
  const [v, setV] = useState(current ?? "");
  function go(e: FormEvent) {
    e.preventDefault();
    let x = v.trim().toUpperCase();
    if (/^\d+$/.test(x)) x = `INC-${x}`;
    if (x) nav(`/track/${encodeURIComponent(x)}`);
  }
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-red-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <svg viewBox="0 0 600 120" className="pointer-events-none absolute right-0 bottom-0 hidden h-28 w-[560px] text-rose-200/80 md:block dark:text-slate-800" fill="currentColor" aria-hidden>
        <rect x="10" y="50" width="40" height="70" /><rect x="56" y="30" width="30" height="90" /><rect x="92" y="60" width="50" height="60" /><rect x="150" y="20" width="26" height="100" />
        <path d="M182 120V40l24-20 24 20v80z" /><rect x="236" y="55" width="44" height="65" /><rect x="286" y="35" width="30" height="85" />
        <g transform="translate(380 70)"><rect width="120" height="38" rx="6" /><rect x="84" y="-14" width="36" height="22" rx="4" /><circle cx="24" cy="42" r="10" fill="#fff" /><circle cx="96" cy="42" r="10" fill="#fff" /><rect x="40" y="10" width="22" height="6" fill="#fff" /><rect x="48" y="2" width="6" height="22" fill="#fff" /></g>
      </svg>
      <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Track Your Incident</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Enter your tracking ID to view real-time status and updates</p>
        <form onSubmit={go} className="mt-5 flex max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" />
            <input value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. INC-1012" aria-label="Tracking ID"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-12 font-mono text-base uppercase shadow-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <button type="submit" className="h-12 rounded-xl px-6 font-semibold text-white shadow-lg shadow-red-500/25" style={{ background: RED }}>Track</button>
        </form>
      </div>
    </section>
  );
}

function Hint() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="font-semibold">Your tracking ID is on the confirmation screen after you report.</p>
      <p className="mt-1 text-sm text-slate-500">Try <Link to="/track/INC-1012" className="font-mono font-semibold" style={{ color: RED }}>INC-1012</Link> · Haven&apos;t reported yet? <Link to="/report" className="font-semibold" style={{ color: RED }}>Report an emergency</Link></p>
    </div>
  );
}

function stepIndex(t: T) {
  if (t.status === "Resolved") return 5;
  const s = t.teams.filter((x) => x.status !== "rejected").map((x) => x.status);
  if (s.includes("on_scene") || s.includes("completed")) return 4;
  if (s.includes("en_route") || s.includes("accepted")) return 3;
  if (t.status === "In Progress") return 3;
  if (s.length || t.status === "Assigned") return 2;
  if (t.status === "Pending") return 1;
  return 0;
}

function Tracker({ id }: { id: string }) {
  const [raw, , at] = usePoll<TrackOut | null>(() => getTrack(id), 5000, [id]);
  const t = raw as T | null;
  if (t === null && at) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <Search className="mx-auto size-8 text-slate-400" />
        <p className="mt-3 font-semibold">No report found for {id}</p>
        <p className="text-sm text-slate-500">Check the tracking ID. It looks like INC-1012.</p>
      </div>
    );
  }
  if (!t) return <div className="mt-6 space-y-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;

  const idx = stepIndex(t);
  const active = t.teams.filter((x) => x.status !== "rejected");
  const lead = active[0];
  const geo = t.lat != null && t.lng != null ? { lat: t.lat, lng: t.lng } : areaByName(t.area) ?? { lat: 13.08, lng: 80.27 };
  const firstAt = (s: string) => t.timeline.find((e) => e.status === s)?.at;
  const stepTime: (string | undefined)[] = [t.created_at, firstAt("Pending"), idx >= 2 ? firstAt("Assigned") ?? firstAt("In Progress") ?? t.updated_at : undefined, idx >= 3 ? firstAt("In Progress") ?? t.updated_at : undefined, idx >= 4 ? t.updated_at : undefined, firstAt("Resolved")];
  const card = "rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="-mt-4 space-y-4 md:-mt-6">
      <div className={card}>
        <div className="flex flex-wrap items-start gap-4">
          <CategoryIcon category={t.category} className="size-14 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-2xl font-bold tracking-tight md:text-3xl">{t.id}</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200">{CATEGORY_META[t.category]?.label}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="flex items-start gap-1"><MapPin className="mt-0.5 size-4 shrink-0" />{t.area}{t.landmark ? ` · ${t.landmark}` : ""}, Chennai</span>
              <span className="flex items-start gap-1"><Calendar className="mt-0.5 size-4 shrink-0" />Reported {fmtTime(t.created_at)} ({timeAgo(t.created_at)})</span>
            </div>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-sm font-bold", PCLS[t.severity])}>{P[t.severity]}</span>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
          <ol className="flex flex-col gap-0 md:flex-row md:gap-0">
            {STEPS.map((s, k) => {
              const doneStep = k < idx || (k === idx && idx === 5);
              const cur = k === idx && idx !== 5;
              return (
                <li key={s} className="relative flex gap-3 pb-5 last:pb-0 md:flex-1 md:flex-col md:items-center md:gap-2 md:pb-0 md:text-center">
                  {k < STEPS.length - 1 && <span className={cn("absolute top-9 bottom-0 left-[17px] w-0.5 md:top-[17px] md:right-[-50%] md:bottom-auto md:left-1/2 md:h-0.5 md:w-auto", k < idx ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700")} />}
                  <span className={cn("relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold",
                    doneStep ? "bg-emerald-500 text-white" : cur ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900" : "bg-slate-100 text-slate-400 dark:bg-slate-800")}>
                    {doneStep ? <Check className="size-5" strokeWidth={3} /> : k + 1}
                  </span>
                  <div className="pt-1 md:pt-0">
                    <p className={cn("text-sm font-semibold", cur ? "text-blue-700 dark:text-blue-300" : doneStep ? "" : "text-slate-400")}>{s}</p>
                    <p className="text-xs text-slate-500">
                      {stepTime[k] && (doneStep || cur) ? fmtTime(stepTime[k]!) : cur ? "Now" : "—"}
                      {s === "In Progress" && cur && lead ? ` · ETA ${Math.round(lead.eta_min)} min` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {t.duplicate_of && (
            <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">This report was merged with <Link className="font-mono font-semibold" style={{ color: RED }} to={`/track/${t.duplicate_of}`}>{t.duplicate_of}</Link> — the same incident reported by others.</p>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Clock className="size-3.5" />Live · refreshes every 5 s{at ? ` · checked ${fmtTime(at)}` : ""}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <p className="mb-3 flex items-center gap-2 font-semibold"><Ambulance className="size-5 text-blue-700" />Assigned Response</p>
          {lead ? (
            <>
              <p className="text-lg font-semibold leading-tight">{lead.team_name}</p>
              {active.length > 1 && <p className="text-xs text-slate-500">+{active.length - 1} more team{active.length > 2 ? "s" : ""}</p>}
              <div className="mt-3 rounded-xl bg-blue-50 p-3 dark:bg-blue-950/40">
                <p className="text-xs text-blue-800 dark:text-blue-300">Estimated Arrival</p>
                <p className="flex items-center gap-1.5 font-display text-2xl font-bold text-blue-900 dark:text-blue-100"><Timer className="size-5" />~{Math.round(lead.eta_min)} minutes</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">{t.status === "Resolved" ? "No team needed any more." : "A team will be assigned shortly. Critical reports are handled first."}</p>
          )}
          <a href="tel:112" className="mt-4 flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white" style={{ background: RED }}><Phone className="size-4" />Call 112</a>
        </div>

        <div className={card}>
          <p className="mb-3 flex items-center gap-2 font-semibold"><MapPin className="size-5" style={{ color: RED }} />Incident Location</p>
          <div className="overflow-hidden rounded-xl">
            <LazyMap points={[{ id: t.id, lat: geo.lat, lng: geo.lng, severity: t.severity, title: t.title, resolved: t.status === "Resolved" }]} height={160} />
          </div>
          <a href={`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=16/${geo.lat}/${geo.lng}`} target="_blank" rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-blue-800 py-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
            <MapPin className="size-4" />View on Map
          </a>
        </div>

        <div className={card}>
          <p className="mb-3 flex items-center gap-2 font-semibold"><History className="size-5 text-emerald-600" />Latest Update</p>
          <ul className="space-y-3">
            {[...t.timeline].reverse().slice(0, 3).map((e, k) => (
              <li key={k} className="flex gap-3">
                <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", k === 0 ? "bg-emerald-500" : "bg-slate-300")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{e.note || e.status}</p>
                  <p className="text-xs text-slate-500">{e.status} · {fmtTime(e.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={card}>
        <p className="mb-3 flex flex-wrap items-center gap-x-2 font-semibold"><ShieldAlert className="size-5" style={{ color: RED }} />Why this priority <span className="w-full text-xs font-normal text-slate-500 sm:w-auto">· score {Math.round(t.score)}/100, set by transparent rules</span></p>
        <ReasonsList reasons={t.reasons.slice(0, 4)} compact />
      </div>
    </div>
  );
}
