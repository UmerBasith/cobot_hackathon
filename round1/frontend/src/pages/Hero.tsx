/**
 * "/hero" — CPR Hero Network: the phone app for registered CPR-trained citizens.
 * ?id=HERO-01 (remembered on this phone). Polls GET /api/hero/{id} every 3 s.
 * Flow: alert (full-screen, vibrate + beep) → I'm going → navigate + map → I've arrived → Start CPR
 * (110 bpm metronome guide) → Ambulance took over → thank-you. Every step POSTs /api/hero/{id}/respond.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Ambulance, ArrowRight, Award, BadgeCheck, Bell, CheckCircle2, ChevronRight, Clock, Footprints, Hand, HeartHandshake, HeartPulse,
  LogOut, MapPin, Navigation, Phone, Radio, ShieldCheck, Siren, Timer, Users, Volume2, VolumeX, Wind, X, type LucideIcon,
} from "lucide-react";
import { CitizenShell, RED } from "@/sections/CitizenShell";
import { LazyMap } from "@/sections/LazyMap";
import { useToast } from "@/ui";
import { cn } from "@/lib/cn";
import { usePoll } from "@/lib/usePoll";
import { STATIC } from "@/lib/static";
import { getLiveHero, goLive, useLiveHero } from "@/lib/liveHero";
import {
  alertBeep, click, fmtDist, fmtEta, getHeroes, getInbox, getInboxStrict, heroRespond, initials, mapsLink, unlockAudio, vibrate,
  type HeroAction, type HeroJob, type HeroProfile, type VolunteerStatus,
} from "@/lib/hero";

const LS_ID = "resq.heroId";
const BPM = 110;
const BEAT_MS = Math.round(60000 / BPM);
const BREATH_BEATS = 8; // ~4.4 s pause for 2 rescue breaths after 30 compressions
const RANK: Record<VolunteerStatus, number> = { alerted: 0, accepted: 1, arrived: 2, cpr: 3, done: 4, declined: 5 };
const AFTER: Record<HeroAction, VolunteerStatus> = { accept: "accepted", decline: "declined", arrived: "arrived", cpr: "cpr", done: "done" };

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const CSS = `
@keyframes hero-ring { 0% { transform: scale(.85); opacity: .55 } 100% { transform: scale(2.3); opacity: 0 } }
.hero-ring { animation: hero-ring 2s cubic-bezier(.2,.6,.3,1) infinite; }
@keyframes cpr-push { 0% { transform: scale(1) } 22% { transform: scale(.84) } 100% { transform: scale(1) } }
.cpr-push { animation: cpr-push ${BEAT_MS}ms cubic-bezier(.3,.7,.4,1); }
@keyframes cpr-wave { 0% { transform: scale(1); opacity: .45 } 100% { transform: scale(1.35); opacity: 0 } }
.cpr-wave { animation: cpr-wave ${BEAT_MS}ms ease-out; }
@keyframes ecg-draw { 0% { stroke-dashoffset: 420 } 60%, 100% { stroke-dashoffset: 0 } }
.ecg { stroke-dasharray: 420; animation: ecg-draw 2.6s ease-in-out infinite; }
@keyframes heart-beat { 0%, 100% { transform: scale(1) } 14% { transform: scale(1.12) } 28% { transform: scale(1) } 42% { transform: scale(1.08) } }
.heart-beat { animation: heart-beat 1.6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
`;

function emergencyKind(j: HeroJob) {
  const i = j.incident;
  if (i.category === "medical") return i.life_threat ? "Cardiac emergency" : "Medical emergency";
  if (i.category === "road_accident") return "Road accident — injured";
  if (i.category === "fire") return "Fire — people injured";
  return "Life-threatening emergency";
}

/* ======================================================================= PAGE */
export default function Hero() {
  const [params, setParams] = useSearchParams();
  const qId = params.get("id");
  const focus = params.get("incident");
  const liveHero = useLiveHero();
  const [heroId, setHeroId] = useState<string | null>(() => (qId ? qId.toUpperCase() : getLiveHero()?.heroId ?? ls.get(LS_ID)));
  const [unknown, setUnknown] = useState<string | null>(null);
  useEffect(() => { if (qId) { setHeroId(qId.toUpperCase()); ls.set(LS_ID, qId.toUpperCase()); } }, [qId]);

  const signIn = (id: string) => { setUnknown(null); ls.set(LS_ID, id); setHeroId(id); setParams({ id }, { replace: true }); window.scrollTo({ top: 0 }); };
  const signOut = () => { ls.set(LS_ID, null); setHeroId(null); setParams({}, { replace: true }); };

  return (
    <CitizenShell>
      <style>{CSS}</style>
      {heroId ? <HeroApp key={heroId} id={heroId} focus={focus} onSignOut={signOut} onUnknown={() => { setUnknown(heroId); signOut(); }} />
        : <Picker onPick={signIn} unknown={unknown} liveId={liveHero?.heroId ?? null} />}
    </CitizenShell>
  );
}

/* ================================================================ HERO APP */
function HeroApp({ id, focus, onSignOut, onUnknown }: { id: string; focus: string | null; onSignOut: () => void; onUnknown: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [inbox, reload, at] = usePoll(async () => {
    try { return await getInboxStrict(id); }
    catch (e) {
      const m = String(e instanceof Error ? e.message : e);
      if (m.startsWith("404")) {
        // Live user whose server entry expired: re-register once, else ask to pick a hero.
        const lv = getLiveHero();
        if (lv && lv.heroId === id) { try { await goLive(lv); return await getInboxStrict(id); } catch { /* fall through */ } }
        onUnknown();
        return null;
      }
      return getInbox(id); // server down: demo fallback for reading only
    }
  }, 3000, [id]);
  const [heroes] = usePoll(getHeroes, 30000);
  const [override, setOverride] = useState<Record<string, VolunteerStatus>>({});
  const [dismissed, setDismissed] = useState<string[]>(() => JSON.parse(ls.get(`resq.hero.dismissed.${id}`) ?? "[]") as string[]);
  const [available, setAvailable] = useState(() => ls.get(`resq.hero.available.${id}`) !== "0");
  const [practice, setPractice] = useState(false);
  const [busy, setBusy] = useState(false);
  const beeped = useRef<Set<string>>(new Set());

  const hero = inbox?.hero;
  const jobs = useMemo(() => (inbox?.jobs ?? []).map((j) => {
    const o = override[j.incident.id];
    const status = o && RANK[o] > RANK[j.volunteer.status] ? o : j.volunteer.status;
    return { ...j, volunteer: { ...j.volunteer, status } };
  }).filter((j) => j.volunteer.status !== "declined" && !dismissed.includes(j.incident.id)), [inbox, override, dismissed]);

  const focused = focus ? jobs.find((j) => j.incident.id === focus && j.volunteer.status !== "alerted") : undefined;
  const active = focused ?? jobs.find((j) => ["accepted", "arrived", "cpr"].includes(j.volunteer.status)) ?? jobs.find((j) => j.volunteer.status === "done") ?? null;
  const alerted = !active && available ? jobs.find((j) => j.volunteer.status === "alerted") ?? null : null;
  const pendingOffDuty = !available && jobs.some((j) => j.volunteer.status === "alerted");

  // New alert: vibrate + beep once per incident.
  useEffect(() => {
    if (!alerted || beeped.current.has(alerted.incident.id) || STATIC) return;
    beeped.current.add(alerted.incident.id);
    vibrate([500, 200, 500, 200, 900]);
    alertBeep();
  }, [alerted]);

  const activeKey = active ? `${active.incident.id}:${active.volunteer.status}` : "";
  useEffect(() => { if (activeKey) window.scrollTo({ top: 0, behavior: "smooth" }); }, [activeKey]);

  async function act(job: HeroJob, action: HeroAction) {
    unlockAudio();
    setBusy(true);
    setError(null);
    const err = await heroRespond(id, job.incident.id, action);
    setBusy(false);
    if (err) {
      setError(err);
      toast("error", "Could not update — please try again", err);
      return;
    }
    setOverride((o) => ({ ...o, [job.incident.id]: AFTER[action] }));
    const msg: Record<HeroAction, [string, string]> = {
      accept: ["You're on the way", "The caller and control room can see a CPR hero is coming."],
      decline: ["No problem", "We alerted the next nearest CPR hero."],
      arrived: ["You're on scene", "Check breathing, call 112, then start CPR."],
      cpr: ["CPR started — push hard, push fast", "The control room sees survival odds rising."],
      done: ["Handed over to the ambulance", "Thank you. You gave them a fighting chance."],
    };
    toast(action === "decline" ? "info" : "success", ...msg[action]);
    void reload();
  }

  function dismiss(incId: string) {
    const next = [...dismissed, incId];
    setDismissed(next); ls.set(`resq.hero.dismissed.${id}`, JSON.stringify(next.slice(-30)));
  }
  function toggleAvailable() {
    const v = !available;
    setAvailable(v); ls.set(`resq.hero.available.${id}`, v ? "1" : "0");
    toast(v ? "success" : "info", v ? "You're on duty" : "You're off duty", v ? "We'll alert you when someone nearby needs CPR." : "You won't get alerts until you turn this back on.");
  }

  if (!hero) return <div className="mx-auto max-w-2xl space-y-4 px-4 py-6"><div className="skeleton h-40 rounded-3xl" /><div className="skeleton h-72 rounded-3xl" /></div>;

  const cprJob = active?.volunteer.status === "cpr" ? active : null;
  const heroCount = heroes?.length ?? 13;

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 md:py-8">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <X className="mt-0.5 size-5 shrink-0" />
            <span className="flex-1"><b>That didn't go through.</b> {error}</span>
            <button type="button" onClick={() => setError(null)} className="text-xs font-semibold underline">Dismiss</button>
          </div>
        )}
        {!active && <HeroHeader hero={hero} available={available} onToggle={toggleAvailable} onSignOut={onSignOut}  />}

        {pendingOffDuty && (
          <button type="button" onClick={toggleAvailable} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
            <Bell className="size-5 shrink-0 text-amber-600" />
            <span className="flex-1"><b>Someone nearby needs CPR.</b> You're off duty — tap to go on duty and see the alert.</span>
            <ChevronRight className="size-4" />
          </button>
        )}

        {active?.volunteer.status === "accepted" && <EnRoute job={active} hero={hero} busy={busy} onArrived={() => act(active, "arrived")} />}
        {active?.volunteer.status === "arrived" && <OnScene job={active} busy={busy} onStart={() => act(active, "cpr")} />}
        {active?.volunteer.status === "done" && <ThankYou job={active} hero={hero} onClose={() => dismiss(active.incident.id)} />}
        {active && <HeroHeader hero={hero} available={available} onToggle={toggleAvailable} onSignOut={onSignOut} />}
        {!active && <Standby available={available} heroCount={heroCount} at={at} onPractice={() => { unlockAudio(); setPractice(true); }} />}
      </div>

      <AnimatePresence>
        {alerted && <AlertOverlay key={alerted.incident.id} job={alerted} busy={busy} onAccept={() => act(alerted, "accept")} onDecline={() => act(alerted, "decline")} />}
        {cprJob && <CprGuide key={cprJob.incident.id} job={cprJob} onDone={() => act(cprJob, "done")} />}
        {practice && <CprGuide key="practice" onDone={() => setPractice(false)} />}
      </AnimatePresence>
    </>
  );
}

/* ================================================================== HEADER */
function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ff5a52] to-[#b71c1c] font-display font-bold text-white shadow-lg shadow-red-500/25", className)}>
      {initials(name)}
    </span>
  );
}

function SkillChips({ skills, className }: { skills: string[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {skills.map((s) => (
        <span key={s} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
          s === "CPR" ? "bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200")}>
          {s === "CPR" && <HeartPulse className="size-3" />}{s}
        </span>
      ))}
    </div>
  );
}

function HeroHeader({ hero, available, onToggle, onSignOut }: { hero: HeroProfile; available: boolean; onToggle: () => void; onSignOut: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,.18)] ring-1 ring-slate-100 sm:p-5 dark:bg-slate-900 dark:ring-slate-800">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-red-500/10 blur-2xl" />
      <div className="relative flex items-start gap-3.5">
        <Avatar name={hero.name} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-xl font-bold text-slate-900 dark:text-white">{hero.name}</h1>
            {hero.verified && <BadgeCheck className="size-5 shrink-0 text-emerald-600" aria-label="Verified" />}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" />Verified CPR responder
          </p>
          <SkillChips skills={hero.skills} className="mt-2" />
        </div>
        <button type="button" onClick={onSignOut} className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Switch hero" title="Switch hero">
          <LogOut className="size-4" />
        </button>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 px-3 py-2.5 dark:bg-amber-950/40">
          <Award className="size-6 text-amber-500" />
          <div className="leading-tight"><p className="font-display text-xl font-bold tabular-nums text-slate-900 dark:text-white">{hero.rescues}</p><p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{hero.rescues === 1 ? "rescue" : "rescues"}</p></div>
        </div>
        <button type="button" onClick={onToggle} role="switch" aria-checked={available}
          className={cn("flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition", available ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-slate-100 dark:bg-slate-800")}>
          <span className="leading-tight">
            <span className={cn("block text-sm font-bold", available ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300")}>{available ? "On duty" : "Off duty"}</span>
            <span className="block text-[11px] text-slate-500">{available ? "Receiving alerts" : "Alerts paused"}</span>
          </span>
          <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", available ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", available ? "left-[22px]" : "left-0.5")} />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ================================================================= STANDBY */
function Standby({ available, heroCount, at, onPractice }: { available: boolean; heroCount: number; at: Date | null; onPractice: () => void }) {
  const steps: { i: LucideIcon; t: string; d: string }[] = [
    { i: Bell, t: "Alert", d: "Someone within 3 km collapses — your phone rings." },
    { i: Footprints, t: "Go", d: "Tap I'm going. We guide you there." },
    { i: HeartPulse, t: "Push", d: "Our metronome coaches CPR until the ambulance arrives." },
  ];
  return (
    <>
      <motion.div initial={STATIC ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl bg-gradient-to-b from-white to-rose-50/60 p-6 text-center shadow-[0_8px_30px_-12px_rgba(15,23,42,.15)] ring-1 ring-slate-100 dark:from-slate-900 dark:to-slate-900 dark:ring-slate-800">
        <HeartIllustration dim={!available} />
        <h2 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white">{available ? "You're on standby" : "You're off duty"}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-600 dark:text-slate-300">
          {available ? "Keep your phone on loud. If someone near you stops breathing, you'll be alerted before the ambulance even leaves." : "Turn on duty above to receive CPR alerts near you."}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
          <span className={cn("relative flex size-2", available ? "text-emerald-500" : "text-slate-400")}>
            {available && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className="relative inline-flex size-2 rounded-full bg-current" />
          </span>
          {available ? "Listening for alerts" : "Paused"}{at && <span className="font-normal text-slate-400">· checked {at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat icon={Users} value={String(heroCount)} label="Nearby heroes in Chennai" tone="text-red-600" />
        <MiniStat icon={Radio} value="3 km" label="Alert radius around you" tone="text-blue-700" />
        <MiniStat icon={Clock} value="~10%" label="Survival lost per minute without CPR" tone="text-amber-600" />
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_-16px_rgba(15,23,42,.15)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">How CPR Hero works</h3>
        <ol className="mt-3 space-y-3">
          {steps.map((s, n) => (
            <li key={s.t} className="flex items-start gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300">
                <s.i className="size-5" /><span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">{n + 1}</span>
              </span>
              <div><p className="font-semibold text-slate-900 dark:text-white">{s.t}</p><p className="text-sm text-slate-600 dark:text-slate-300">{s.d}</p></div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onPractice}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-200 font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40">
          <HeartPulse className="size-5" />Practise the CPR rhythm (110 / min)
        </button>
      </div>
      <p className="px-2 text-center text-[11px] text-slate-400">Demo network · alerts are simulated for the hackathon. Real CPR training: Indian Red Cross / St John Ambulance.</p>
    </>
  );
}

function MiniStat({ icon: I, value, label, tone }: { icon: LucideIcon; value: string; label: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-[0_4px_20px_-12px_rgba(15,23,42,.2)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <I className={cn("size-5", tone)} />
      <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function HeartIllustration({ dim }: { dim?: boolean }) {
  return (
    <svg viewBox="0 0 220 140" className={cn("mx-auto h-32 w-auto", dim && "opacity-40 grayscale")} aria-hidden>
      <defs>
        <radialGradient id="hglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ef4444" stopOpacity=".22" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0" /></radialGradient>
        <linearGradient id="hfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6b63" /><stop offset="100%" stopColor="#d32f2f" /></linearGradient>
      </defs>
      <circle cx="110" cy="66" r="66" fill="url(#hglow)" />
      <path className={dim ? "" : "heart-beat"} d="M110 112 C70 84 52 64 52 44 C52 28 64 18 78 18 C92 18 102 26 110 38 C118 26 128 18 142 18 C156 18 168 28 168 44 C168 64 150 84 110 112 Z" fill="url(#hfill)" />
      <path d="M78 34 C70 36 66 42 66 48" stroke="#fff" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path className={dim ? "" : "ecg"} d="M4 70 H70 L80 70 L88 50 L98 92 L108 38 L118 84 L126 70 H216" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M4 70 H70 L80 70 L88 50 L98 92 L108 38 L118 84 L126 70 H216" stroke="#ef4444" strokeOpacity=".18" strokeWidth="2" fill="none" />
    </svg>
  );
}

/* ============================================================ ALERT (RED) */
function AlertOverlay({ job, busy, onAccept, onDecline }: { job: HeroJob; busy: boolean; onAccept: () => void; onDecline: () => void }) {
  const v = job.volunteer, i = job.incident;
  const place = [i.landmark, i.area].filter(Boolean).join(", ");
  return (
    <motion.div role="alertdialog" aria-modal aria-label="CPR alert" initial={STATIC ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.03 }}
      className="fixed inset-0 z-[70] overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_18%,#f0443a_0%,#c62828_45%,#7f1010_100%)] text-white">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wider uppercase ring-1 ring-white/25">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-80" /><span className="relative inline-flex size-2 rounded-full bg-white" /></span>
            CPR Hero alert
          </span>
          <span className="text-xs font-medium text-white/75">{i.id} · just now</span>
        </div>

        <div className="relative mx-auto mt-8 grid size-36 place-items-center">
          {[0, 0.65, 1.3].map((d) => <span key={d} className="hero-ring absolute inset-0 rounded-full border-2 border-white/70" style={{ animationDelay: `${d}s` }} />)}
          <span className="relative grid size-28 place-items-center rounded-full bg-white shadow-[0_0_60px_rgba(255,255,255,.45)]">
            <HeartPulse className="heart-beat size-14" style={{ color: RED }} strokeWidth={2.2} />
          </span>
        </div>

        <div className="mt-7 text-center">
          <p className="font-display text-[2rem] leading-tight font-extrabold tracking-tight">{emergencyKind(job)}</p>
          <p className="mt-1 font-display text-5xl font-black tabular-nums tracking-tight">{fmtDist(v.distance_m)} <span className="text-2xl font-bold text-white/80">away</span></p>
          <p className="mt-3 text-lg font-semibold">{i.title}</p>
          {place && <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/85"><MapPin className="size-4 shrink-0" />{place}</p>}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { i: Footprints, v: fmtDist(v.distance_m), l: "distance" },
            { i: Clock, v: fmtEta(v.eta_min), l: "to reach" },
            { i: Users, v: String(i.people_affected), l: i.people_affected === 1 ? "person" : "people" },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl bg-black/15 px-2 py-2.5 ring-1 ring-white/15">
              <x.i className="mx-auto size-4 text-white/80" />
              <p className="mt-1 font-display text-lg font-bold tabular-nums">{x.v}</p>
              <p className="text-[11px] text-white/70">{x.l}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/20">
          <Timer className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm leading-snug"><b>Every minute without CPR cuts survival by ~10%.</b> You are the closest trained person — you can be there before the ambulance.</p>
        </div>

        <div className="mt-auto space-y-2.5 pt-6">
          <button type="button" disabled={busy} onClick={onAccept}
            className="flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-xl font-extrabold shadow-[0_14px_40px_-10px_rgba(0,0,0,.45)] transition active:scale-[.98] disabled:opacity-70" style={{ color: RED }}>
            <HeartHandshake className="size-6" />I'm going
          </button>
          <button type="button" disabled={busy} onClick={onDecline}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white/90 ring-1 ring-white/35 transition hover:bg-white/10 disabled:opacity-70">
            <X className="size-4" />Can't go — alert the next hero
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* =============================================================== EN ROUTE */
function JobSummary({ job }: { job: HeroJob }) {
  const i = job.incident;
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50"><HeartPulse className="size-6" /></span>
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wider text-red-600 uppercase">{emergencyKind(job)}</p>
        <p className="font-semibold text-slate-900 dark:text-white">{i.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500"><MapPin className="size-3.5 shrink-0" />{[i.landmark, i.area].filter(Boolean).join(", ")}</p>
      </div>
    </div>
  );
}

function EnRoute({ job, hero, busy, onArrived }: { job: HeroJob; hero: HeroProfile; busy: boolean; onArrived: () => void }) {
  const v = job.volunteer, i = job.incident;
  const hasLL = i.lat != null && i.lng != null;
  return (
    <motion.div initial={STATIC ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_36px_-14px_rgba(15,23,42,.25)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#e53935] to-[#c62828] px-5 py-4 text-white">
        <div>
          <p className="text-xs font-bold tracking-wider text-white/80 uppercase">You're on the way</p>
          <p className="font-display text-2xl font-bold">{fmtEta(v.eta_min)} · {fmtDist(v.distance_m)}</p>
        </div>
        <span className="relative grid size-12 place-items-center rounded-full bg-white/15">
          <span className="hero-ring absolute inset-0 rounded-full border-2 border-white/60" />
          <Footprints className="size-6" />
        </span>
      </div>
      <div className="space-y-4 p-5">
        <JobSummary job={job} />
        {hasLL && (
          <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800">
            <LazyMap height={210} className="rounded-none border-0"
              me={{ lat: hero.lat, lng: hero.lng }}
              points={[{ id: i.id, lat: i.lat as number, lng: i.lng as number, severity: i.severity, title: i.title }]} />
          </div>
        )}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {hasLL && (
            <a href={mapsLink(i.lat as number, i.lng as number)} target="_blank" rel="noreferrer"
              className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#1e40af] py-3.5 font-semibold text-white shadow-lg shadow-blue-800/25 transition hover:bg-[#1e3a8a]">
              <Navigation className="size-5" />Navigate
            </a>
          )}
          <button type="button" disabled={busy} onClick={onArrived}
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white shadow-lg shadow-red-500/25 transition active:scale-[.98] disabled:opacity-60" style={{ background: RED }}>
            <CheckCircle2 className="size-5" />I've arrived
          </button>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3.5 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <p className="mb-1.5 font-semibold text-slate-900 dark:text-white">While you walk</p>
          <ul className="space-y-1">
            <li className="flex gap-2"><ArrowRight className="mt-0.5 size-4 shrink-0 text-red-500" />Ask someone to call 112 and look for an AED.</li>
            <li className="flex gap-2"><ArrowRight className="mt-0.5 size-4 shrink-0 text-red-500" />The caller has been told a CPR hero is coming.</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

/* =============================================================== ON SCENE */
const CPR_STEPS: { i: LucideIcon; t: string; d: string }[] = [
  { i: Phone, t: "Check response & call 112", d: "Tap shoulders, shout. Not breathing normally? Call 112 on speaker." },
  { i: Hand, t: "Hands centre of chest", d: "Heel of one hand on the breastbone, other hand on top, arms straight." },
  { i: HeartPulse, t: "Push hard, push fast", d: "5–6 cm deep, 100–120 a minute. Let the chest rise fully." },
  { i: Ambulance, t: "Don't stop until help arrives", d: "Swap with a bystander every 2 minutes if you can." },
];

function OnScene({ job, busy, onStart }: { job: HeroJob; busy: boolean; onStart: () => void }) {
  return (
    <motion.div initial={STATIC ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_36px_-14px_rgba(15,23,42,.25)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-center gap-3 bg-emerald-600 px-5 py-4 text-white">
        <CheckCircle2 className="size-7" />
        <div><p className="text-xs font-bold tracking-wider text-white/80 uppercase">You're on scene</p><p className="font-display text-xl font-bold">Check, call, then push</p></div>
      </div>
      <div className="space-y-4 p-5">
        <JobSummary job={job} />
        <ol className="space-y-2.5">
          {CPR_STEPS.map((s, n) => (
            <li key={s.t} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white dark:bg-white dark:text-slate-900">{n + 1}</span>
              <div><p className="font-semibold text-slate-900 dark:text-white">{s.t}</p><p className="text-sm text-slate-600 dark:text-slate-300">{s.d}</p></div>
            </li>
          ))}
        </ol>
        <button type="button" disabled={busy} onClick={onStart}
          className="relative flex h-16 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl text-xl font-extrabold text-white shadow-[0_14px_36px_-10px_rgba(229,57,53,.7)] transition active:scale-[.98] disabled:opacity-60" style={{ background: RED }}>
          <HeartPulse className="heart-beat size-6" />Start CPR
        </button>
        <a href="tel:112" className="flex h-11 items-center justify-center gap-2 rounded-2xl font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700"><Phone className="size-4" />Call 112</a>
      </div>
    </motion.div>
  );
}

/* ============================================================== CPR GUIDE */
function useCprMetronome(muted: boolean) {
  const [beat, setBeat] = useState(STATIC ? 16 : 0);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  useEffect(() => {
    if (STATIC) return;
    let b = 0;
    if (!mutedRef.current) click(true);
    const t = setInterval(() => {
      b += 1;
      setBeat(b);
      const pos = b % (30 + BREATH_BEATS);
      if (!mutedRef.current) click(pos === 0);
      if (pos === 30) vibrate(120);
    }, BEAT_MS);
    return () => clearInterval(t);
  }, []);
  return beat;
}

function CprGuide({ job, onDone }: { job?: HeroJob; onDone: () => void }) {
  const [muted, setMuted] = useState(false);
  const beat = useCprMetronome(muted);
  const [start] = useState(() => (job?.volunteer.cpr_at ? Math.min(Date.parse(job.volunteer.cpr_at), Date.now()) : Date.now() - (STATIC ? 134000 : 0)));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (STATIC) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.floor((now - start) / 1000));
  const pos = beat % (30 + BREATH_BEATS);
  const breaths = pos >= 30;
  const count = breaths ? 30 : pos + 1;
  const cycle = Math.floor(beat / (30 + BREATH_BEATS)) + 1;
  const stepIdx = 2; // they are compressing: steps 1–2 done, step 3 active

  return (
    <motion.div initial={STATIC ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] overflow-y-auto bg-[radial-gradient(110%_70%_at_50%_30%,#3b0d14_0%,#160a12_55%,#0b0b14_100%)] text-white">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold tracking-wider text-red-200 uppercase ring-1 ring-red-400/30">
            <HeartPulse className="size-3.5" />{job ? "CPR guide · live" : "CPR practice"}
          </span>
          <button type="button" onClick={() => { unlockAudio(); setMuted((m) => !m); }} aria-label={muted ? "Unmute metronome" : "Mute metronome"}
            className="grid size-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 hover:bg-white/15">
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-white/50 uppercase">CPR time</p>
            <p className="font-display text-4xl font-bold tabular-nums">{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tracking-wider text-white/50 uppercase">Cycle</p>
            <p className="font-display text-4xl font-bold tabular-nums">{cycle}</p>
          </div>
        </div>
        {job && <p className="mt-1 truncate text-sm text-white/60">{job.incident.title} · {job.incident.area}</p>}

        {/* Giant pulsing compression circle */}
        <div className="relative mx-auto mt-6 grid aspect-square w-[min(74vw,290px)] place-items-center">
          {!breaths && <span key={`w${beat}`} className="cpr-wave absolute inset-0 rounded-full bg-red-500/40" />}
          <div key={`c${beat}`} className={cn("relative grid size-full place-items-center rounded-full transition-colors duration-300",
            breaths ? "bg-gradient-to-br from-sky-400 to-blue-700 shadow-[0_0_80px_rgba(56,189,248,.45)]" : "cpr-push bg-gradient-to-br from-[#ff5a52] to-[#b71c1c] shadow-[0_0_90px_rgba(239,68,68,.55)]")}>
            <span className="absolute inset-3 rounded-full ring-2 ring-white/20" />
            {breaths ? (
              <div className="px-6 text-center">
                <Wind className="mx-auto size-10" />
                <p className="mt-2 font-display text-2xl font-extrabold leading-tight">Give 2 breaths</p>
                <p className="mt-1 text-sm text-white/85">or keep pushing if untrained</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-display text-[5.5rem] leading-none font-black tabular-nums">{count}</p>
                <p className="mt-1 text-sm font-bold tracking-[0.25em] text-white/85 uppercase">Push · of 30</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-sm text-white/75">
          <span className="flex items-center gap-1.5"><HeartPulse className="size-4 text-red-400" />{BPM} / min</span>
          <span className="h-4 w-px bg-white/20" />
          <span>5–6 cm deep</span>
          <span className="h-4 w-px bg-white/20" />
          <span>Full recoil</span>
        </div>
        {/* compression progress dots */}
        <div className="mx-auto mt-3 flex max-w-xs flex-wrap justify-center gap-1">
          {Array.from({ length: 30 }, (_, k) => (
            <span key={k} className={cn("h-1.5 w-1.5 rounded-full transition-colors", breaths ? "bg-sky-400" : k < count ? "bg-red-400" : "bg-white/15")} />
          ))}
        </div>

        <ol className="mt-5 space-y-1.5">
          {CPR_STEPS.map((s, n) => (
            <li key={s.t} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", n === stepIdx ? "bg-white/12 ring-1 ring-white/20" : "text-white/60")}>
              {n < stepIdx ? <CheckCircle2 className="size-5 shrink-0 text-emerald-400" /> : <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", n === stepIdx ? "bg-red-500 text-white" : "bg-white/15")}>{n + 1}</span>}
              <span className={n === stepIdx ? "font-semibold text-white" : ""}>{s.t}</span>
            </li>
          ))}
        </ol>

        <div className="mt-auto pt-5">
          <button type="button" onClick={onDone}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-lg font-bold text-slate-900 shadow-xl transition active:scale-[.98]">
            {job ? <><Ambulance className="size-6 text-emerald-600" />Ambulance took over</> : <><X className="size-5" />End practice</>}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================== THANK YOU */
function ThankYou({ job, hero, onClose }: { job: HeroJob; hero: HeroProfile; onClose: () => void }) {
  const v = job.volunteer;
  const cprSecs = v.cpr_at ? Math.max(0, Math.round((Date.parse(v.updated_at) - Date.parse(v.cpr_at)) / 1000)) : null;
  return (
    <motion.div initial={STATIC ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-rose-500 via-[#e53935] to-[#9f1239] p-6 text-center text-white shadow-[0_20px_50px_-18px_rgba(229,57,53,.7)]">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_10%,rgba(255,255,255,.35),transparent_40%),radial-gradient(circle_at_85%_30%,rgba(255,255,255,.25),transparent_35%)]" />
      <div className="relative mx-auto mt-2 grid size-28 place-items-center">
        {[0, 0.8].map((d) => <span key={d} className="hero-ring absolute inset-0 rounded-full border-2 border-white/60" style={{ animationDelay: `${d}s` }} />)}
        <motion.span initial={STATIC ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 12 }}
          className="relative grid size-24 place-items-center rounded-full bg-white shadow-[0_0_50px_rgba(255,255,255,.5)]">
          <HeartHandshake className="size-12" style={{ color: RED }} />
        </motion.span>
      </div>
      <h2 className="relative mt-5 font-display text-3xl leading-tight font-extrabold">You may have just<br />saved a life.</h2>
      <p className="relative mx-auto mt-2 max-w-sm text-white/90">
        Thank you, {hero.name.split(" ")[0]}. Your CPR kept blood flowing to the brain until the ambulance crew took over — bystander CPR can double or triple the chance of survival.
      </p>
      <div className="relative mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/25"><Award className="mx-auto size-5" /><p className="mt-1 font-display text-3xl font-black tabular-nums">{Math.max(hero.rescues, 1)}</p><p className="text-xs text-white/80">{hero.rescues > 1 ? "rescues" : "rescue"} so far</p></div>
        <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/25"><Timer className="mx-auto size-5" /><p className="mt-1 font-display text-3xl font-black tabular-nums">{cprSecs != null ? `${Math.floor(cprSecs / 60)}:${String(cprSecs % 60).padStart(2, "0")}` : "—"}</p><p className="text-xs text-white/80">of CPR given</p></div>
      </div>
      <p className="relative mt-4 text-xs text-white/75">{job.incident.id} · {job.incident.title} · handed over to the ambulance</p>
      <button type="button" onClick={onClose} className="relative mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 font-bold transition active:scale-[.98]" style={{ color: RED }}>
        <ShieldCheck className="size-5" />Back to standby
      </button>
    </motion.div>
  );
}

/* ================================================================= PICKER */
function Picker({ onPick, unknown, liveId }: { onPick: (id: string) => void; unknown: string | null; liveId: string | null }) {
  const [heroes] = usePoll(getHeroes, 30000);
  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:py-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#e53935] to-[#8e1414] p-6 text-white shadow-[0_20px_50px_-20px_rgba(229,57,53,.7)]">
        <div className="pointer-events-none absolute -right-10 -bottom-12 opacity-25"><HeartPulse className="size-56" strokeWidth={1.2} /></div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wider uppercase ring-1 ring-white/25"><Siren className="size-3.5" />CPR Hero Network</span>
        <h1 className="relative mt-3 font-display text-[1.9rem] leading-tight font-extrabold">The closest responder is usually not in an ambulance.</h1>
        <p className="relative mt-2 max-w-md text-white/90">Trained citizens within 3 km get alerted the moment someone collapses — and start CPR minutes before the ambulance arrives.</p>
      </div>

      {unknown && (
        <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>This hero is not registered — choose a hero.</b> <span className="text-amber-800">({unknown} was not found on the server. Turn on hero alerts on the Home page, or pick a demo hero below.)</span>
        </div>
      )}
      {liveId && (
        <button type="button" onClick={() => onPick(liveId)} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-left ring-1 ring-emerald-200">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">live</span>
          <span className="flex-1 text-sm font-semibold text-emerald-900">Continue as you ({liveId})</span>
          <ChevronRight className="size-4 text-emerald-700" />
        </button>
      )}
      <div className="mt-6 mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Sign in as hero <span className="font-normal text-slate-400">(demo)</span></h2>
          <p className="text-sm text-slate-500">{heroes ? `${heroes.length} verified heroes in Chennai` : "Loading heroes…"}</p>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {!heroes && Array.from({ length: 6 }, (_, k) => <div key={k} className="skeleton h-20 rounded-2xl" />)}
        {heroes?.map((h) => (
          <button key={h.id} type="button" onClick={() => onPick(h.id)}
            className="group flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_4px_20px_-12px_rgba(15,23,42,.2)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-red-200 dark:bg-slate-900 dark:ring-slate-800">
            <Avatar name={h.name} className="size-12 text-base" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white"><span className="truncate">{h.name}</span>{h.verified && <BadgeCheck className="size-4 shrink-0 text-emerald-600" />}{h.live && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">live</span>}</p>
              <SkillChips skills={h.skills} className="mt-1" />
            </div>
            <div className="shrink-0 text-right">
              <p className="flex items-center justify-end gap-1 text-sm font-bold text-slate-900 dark:text-white"><Award className="size-4 text-amber-500" />{h.rescues}</p>
              <p className="text-[10px] text-slate-400">rescues</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-slate-300 transition group-hover:text-red-500" />
          </button>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">Want to join for real? <Link to="/about" className="font-semibold text-red-600 hover:underline">Learn about ResQNet</Link></p>
    </div>
  );
}

export function HeroBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{children}</span>;
}
