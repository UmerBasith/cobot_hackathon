/**
 * Live CPR Hero for real website users:
 *   <HeroOptInCard>   citizen Home card: name, skills, location → opt in / out
 *   <HeroToggle>      compact switch for the drawer
 *   <HeroAlertWatcher> global (CitizenShell): heartbeat + 3 s inbox poll → full-screen red alert popup
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Crosshair, Footprints, HeartHandshake, HeartPulse, MapPin, Timer, X } from "lucide-react";
import { useToast } from "@/ui";
import { cn } from "@/lib/cn";
import { AREAS, nearestArea } from "@/lib/geo";
import { api } from "@/lib/api";
import { STATIC } from "@/lib/static";
import { alertBeep, fmtDist, fmtEta, heroRespond, unlockAudio, vibrate, type HeroInbox, type HeroJob } from "@/lib/hero";
import { SKILLS, addDismissed, dismissedFor, goLive, goOffline, useHeroHeartbeat, useLiveHero } from "@/lib/liveHero";

const RED = "#e53935";

/* ------------------------------------------------------------- opt-in card */
export function HeroOptInCard({ className }: { className?: string }) {
  const toast = useToast();
  const live = useLiveHero();
  const [name, setName] = useState(live?.name ?? "");
  const [skills, setSkills] = useState<string[]>(live?.skills ?? ["CPR"]);
  const [area, setArea] = useState(live?.area ?? "Vandalur");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(live?.lat != null && live.lng != null ? { lat: live.lat, lng: live.lng } : null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const { hash } = useLocation();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (hash === "#hero-optin") box.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [hash]);

  function locate() {
    if (!navigator.geolocation) { toast("warning", "Location not available", "Pick your area instead."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); const g = { lat: p.coords.latitude, lng: p.coords.longitude }; setGps(g); setArea(nearestArea(g.lat, g.lng).name); },
      () => { setLocating(false); toast("warning", "Could not get your location", "Pick your area from the list instead."); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function toggle() {
    unlockAudio();
    if (live) { setBusy(true); await goOffline(); setBusy(false); toast("info", "You're off the hero network", "You won't get alerts any more."); return; }
    if (name.trim().length < 2) { toast("warning", "Add your name", "So the control room knows who is coming."); return; }
    if (!skills.length) { toast("warning", "Pick at least one skill"); return; }
    setBusy(true);
    try {
      await goLive({ name: name.trim(), skills, area, ...(gps ?? {}) });
      toast("success", "You're an active ResQNet Hero", "Keep this tab open — we'll alert you if someone nearby needs help.");
    } catch (e) { toast("error", "Could not join the hero network", e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div ref={box} className={cn("overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_-18px_rgba(15,23,42,.35)] ring-1 ring-red-100 dark:bg-slate-900 dark:ring-red-950", className)}>
      <div className="flex items-start gap-3 bg-gradient-to-br from-[#e53935] to-[#9f1515] p-4 text-white">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><HeartHandshake className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-extrabold">I can help — CPR / first-aid trained.</p>
          <p className="mt-0.5 text-sm text-white/85">Alert me if someone nearby needs help.</p>
        </div>
        <Switch on={!!live} busy={busy} onClick={toggle} />
      </div>
      {live ? (
        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="relative flex size-3"><span className={cn("absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75", !STATIC && "animate-ping")} /><span className="relative inline-flex size-3 rounded-full bg-emerald-500" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">You're an active ResQNet Hero · online</p>
            <p className="truncate text-xs text-slate-500">{live.name} · {live.skills.join(", ")} · {live.lat != null ? "GPS location" : live.area} · ID {live.heroId}</p>
          </div>
          <Link to={`/hero?id=${live.heroId}`} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300">Open hero app</Link>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-950" />
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => {
              const on = skills.includes(s);
              return (
                <button key={s} type="button" onClick={() => setSkills(on ? skills.filter((x) => x !== s) : [...skills, s])}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition", on ? "bg-red-600 text-white ring-red-600" : "bg-white text-slate-600 ring-slate-200 hover:ring-red-300 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700")}>
                  {s}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <select value={area} onChange={(e) => { setArea(e.target.value); setGps(null); }} aria-label="Your area"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              {AREAS.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
            <button type="button" onClick={locate} className={cn("flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1", gps ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "text-slate-700 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700")}>
              <Crosshair className={cn("size-4", locating && "animate-spin")} />{gps ? "GPS on" : "Use GPS"}
            </button>
          </div>
          <button type="button" disabled={busy} onClick={toggle} className="h-11 w-full rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-60" style={{ background: RED }}>
            {busy ? "Joining…" : "Turn on hero alerts"}
          </button>
        </div>
      )}
    </div>
  );
}

function Switch({ on, busy, onClick }: { on: boolean; busy?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Hero alerts" disabled={busy} onClick={onClick}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60", on ? "bg-emerald-400" : "bg-white/30")}>
      <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/** Compact drawer toggle. When off it links to the Home card (needs name + skills). */
export function HeroToggle() {
  const live = useLiveHero();
  const toast = useToast();
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 p-3 dark:bg-red-950/40">
      <HeartHandshake className="size-5 shrink-0 text-red-600" />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-bold text-slate-900 dark:text-white">CPR Hero alerts</p>
        <p className="text-slate-500">{live ? "Active · online" : "Off — I can help nearby"}</p>
      </div>
      {live ? (
        <button type="button" role="switch" aria-checked onClick={async () => { await goOffline(); toast("info", "Hero alerts off"); }} className="relative h-6 w-10 rounded-full bg-emerald-500">
          <span className="absolute top-0.5 left-[18px] size-5 rounded-full bg-white shadow" />
        </button>
      ) : (
        <Link to="/#hero-optin" className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white">Turn on</Link>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- global watcher */
export function HeroAlertWatcher() {
  useHeroHeartbeat();
  const live = useLiveHero();
  const { pathname } = useLocation();
  const onHeroPage = pathname.startsWith("/hero");
  const id = live?.heroId;
  const [job, setJob] = useState<HeroJob | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!id || onHeroPage || STATIC) { setJob(null); return; }
    let off = false;
    const tick = async () => {
      try {
        const inbox = await api.get<HeroInbox>(`/hero/${encodeURIComponent(id)}`);
        if (off) return;
        const dis = dismissedFor(id);
        const next = inbox.jobs.find((j) => j.volunteer.status === "alerted" && !dis.includes(j.incident.id)) ?? null;
        setJob((cur) => (cur && next && cur.incident.id === next.incident.id ? cur : next));
      } catch { /* 404 right after restart: heartbeat re-registers us */ }
    };
    void tick();
    const t = setInterval(tick, 3000);
    return () => { off = true; clearInterval(t); };
  }, [id, onHeroPage]);

  // Vibrate, beep and flash the tab title while an alert is showing.
  useEffect(() => {
    if (!job) return;
    if (!seen.current.has(job.incident.id)) { seen.current.add(job.incident.id); vibrate([300, 150, 300]); alertBeep(); }
    const orig = document.title;
    let flip = false;
    const t = setInterval(() => { flip = !flip; document.title = flip ? "🚨 Help needed nearby" : orig; }, 900);
    return () => { clearInterval(t); document.title = orig; };
  }, [job]);

  if (!id) return null;
  return <AnimatePresence>{job && <HeroAlertPopup key={job.incident.id} heroId={id} job={job} onClose={() => setJob(null)} />}</AnimatePresence>;
}

const CSS = `
@keyframes hl-ring { 0% { transform: scale(.85); opacity: .55 } 100% { transform: scale(2.3); opacity: 0 } }
.hl-ring { animation: hl-ring 2s cubic-bezier(.2,.6,.3,1) infinite; }
@keyframes hl-beat { 0%, 100% { transform: scale(1) } 14% { transform: scale(1.14) } 28% { transform: scale(1) } 42% { transform: scale(1.08) } }
.hl-beat { animation: hl-beat 1.4s ease-in-out infinite; }
`;

export function HeroAlertPopup({ heroId, job, onClose }: { heroId: string; job: HeroJob; onClose: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const v = job.volunteer, i = job.incident;
  const place = [i.landmark, i.area].filter(Boolean).join(", ");

  async function respond(action: "accept" | "decline") {
    unlockAudio();
    setBusy(action);
    const err = await heroRespond(heroId, i.id, action);
    setBusy(null);
    if (err) { toast("error", action === "accept" ? "Could not confirm you're going" : "Could not decline", err); return; }
    addDismissed(heroId, i.id);
    onClose();
    if (action === "accept") {
      toast("success", "You're on the way", "The control room can see a CPR hero is coming.");
      nav(`/hero?id=${encodeURIComponent(heroId)}&incident=${encodeURIComponent(i.id)}`);
    } else toast("info", "No problem", "We alerted the next nearest hero.");
  }

  return (
    <motion.div role="alertdialog" aria-modal aria-label="Help needed nearby" initial={STATIC ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_18%,#f0443a_0%,#c62828_45%,#7f1010_100%)] text-white">
      <style>{CSS}</style>
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wider uppercase ring-1 ring-white/25">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-80" /><span className="relative inline-flex size-2 rounded-full bg-white" /></span>
            Help needed nearby
          </span>
          <span className="text-xs font-medium text-white/75">{i.id}</span>
        </div>
        <div className="relative mx-auto mt-8 grid size-32 place-items-center">
          {[0, 0.65, 1.3].map((d) => <span key={d} className="hl-ring absolute inset-0 rounded-full border-2 border-white/70" style={{ animationDelay: `${d}s` }} />)}
          <span className="relative grid size-24 place-items-center rounded-full bg-white shadow-[0_0_60px_rgba(255,255,255,.45)]">
            <HeartPulse className="hl-beat size-12" style={{ color: RED }} strokeWidth={2.2} />
          </span>
        </div>
        <div className="mt-6 text-center">
          <p className="font-display text-5xl font-black tabular-nums tracking-tight">{fmtDist(v.distance_m)} <span className="text-2xl font-bold text-white/80">away</span></p>
          <p className="mt-3 text-xl font-bold">{i.title}</p>
          {place && <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/85"><MapPin className="size-4 shrink-0" />{place}</p>}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-center">
          {[{ I: Footprints, val: fmtDist(v.distance_m), l: "distance" }, { I: Clock, val: fmtEta(v.eta_min), l: "to reach" }].map((x) => (
            <div key={x.l} className="rounded-2xl bg-black/15 px-2 py-2.5 ring-1 ring-white/15">
              <x.I className="mx-auto size-4 text-white/80" />
              <p className="mt-1 font-display text-lg font-bold tabular-nums">{x.val}</p>
              <p className="text-[11px] text-white/70">{x.l}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/20">
          <Timer className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm leading-snug"><b>~10 % survival lost every minute without CPR.</b> You can be there before the ambulance.</p>
        </div>
        <div className="mt-auto space-y-2.5 pt-6">
          <button type="button" disabled={!!busy} onClick={() => respond("accept")}
            className="flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-xl font-extrabold shadow-[0_14px_40px_-10px_rgba(0,0,0,.45)] transition active:scale-[.98] disabled:opacity-70" style={{ color: RED }}>
            <HeartHandshake className="size-6" />{busy === "accept" ? "Confirming…" : "I'm going"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => respond("decline")}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white/90 ring-1 ring-white/35 transition hover:bg-white/10 disabled:opacity-70">
            <X className="size-4" />{busy === "decline" ? "Sending…" : "Can't go"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
