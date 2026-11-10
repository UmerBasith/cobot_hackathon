/**
 * "/" — citizen home, built to match the ResQNet design mock-up:
 * hero (headline + 2 CTAs + trust badges) with the Chennai Central photo fading in on the right,
 * live location/weather card and the active alert card over the photo, 8 emergency service tiles,
 * "Your Shortcuts" and "Discover Services Near You" with a live GPS map.
 * Photo: "Chennai train station" by Arian Zwegers (derivative by MrPanyGof), CC BY 2.0, Wikimedia Commons.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Bell, LocateFixed, BriefcaseMedical, Building2, ChevronDown, ChevronRight, Flame, HeartPulse, Map as MapIcon, MapPin,
  Megaphone, Mountain, MoreHorizontal, Shield, ShieldCheck, UserRound, Users, Waves, WifiOff, Zap, type LucideIcon,
} from "lucide-react";
import { CitizenShell, RED } from "@/sections/CitizenShell";
import { getActiveAlerts, getIncidents, getShelters } from "@/lib/resq";
import { LazyMap } from "@/sections/LazyMap";
import { distanceKm, useLiveLocation } from "@/lib/useLiveLocation";
import { nearestArea } from "@/lib/geo";
import type { Alert, Incident, Shelter } from "@/lib/mock";
import { cn } from "@/lib/cn";
import { HeroOptInCard } from "@/sections/HeroLive";

const BLUE = "#1e40af";
const PHOTO = "/images/chennai-central.webp";

const SERVICES: { label: string; icon: LucideIcon; cat: string; color: string; fill?: string }[] = [
  { label: "Fire", icon: Flame, cat: "fire", color: "#e53935", fill: "#e53935" },
  { label: "Medical", icon: BriefcaseMedical, cat: "medical", color: "#ffffff", fill: "#e53935" },
  { label: "Police", icon: Shield, cat: "other", color: "#1d4ed8", fill: "#1d4ed8" },
  { label: "Flood / Waterlogging", icon: Waves, cat: "flood", color: "#1d4ed8" },
  { label: "Landslide", icon: Mountain, cat: "landslide", color: "#92400e", fill: "#b45309" },
  { label: "Power Outage", icon: Zap, cat: "electrical", color: "#f59e0b", fill: "#fbbf24" },
  { label: "Structural Collapse", icon: Building2, cat: "building_collapse", color: "#334155" },
  { label: "Other", icon: MoreHorizontal, cat: "other", color: "#334155" },
];

const TRUST: { i: LucideIcon; t: string; c: string }[] = [
  { i: Zap, t: "Quick Response", c: "text-amber-500" },
  { i: ShieldCheck, t: "Trusted & Official", c: "text-blue-700" },
  { i: WifiOff, t: "Works Offline", c: "text-slate-700" },
];

const WMO: Record<number, string> = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };

/** Live Chennai weather (open-meteo, no key). Falls back quietly when offline. */
function useWeather() {
  const [w, setW] = useState<{ temp: string; text: string } | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=13.08&longitude=80.27&current=temperature_2m,weather_code");
        const j = await r.json();
        if (!off) setW({ temp: `${Math.round(j.current.temperature_2m)}°C`, text: WMO[j.current.weather_code as number] ?? "Live" });
      } catch { if (!off) setW({ temp: "—", text: "Weather offline" }); }
    })();
    return () => { off = true; };
  }, []);
  return w;
}

/** Split an alert message into a bold title (first sentence) and a softer detail line. */
function splitAlert(a: Alert | null) {
  if (!a) return { title: "No active alerts in your area", detail: "You'll see official warnings here first." };
  const m = a.message.trim();
  const i = m.search(/[.!?](\s|$)/);
  return i > 0 && i < m.length - 1 ? { title: m.slice(0, i + 1), detail: m.slice(i + 1).trim() } : { title: m, detail: a.area ? `Area: ${a.area}` : "" };
}

function WeatherCard({ className }: { className?: string }) {
  const w = useWeather();
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl bg-white/95 px-4 py-3 shadow-lg ring-1 ring-slate-900/5 backdrop-blur", className)}>
      <div className="flex items-center gap-2">
        <MapPin className="size-5 text-blue-700" fill="#1d4ed8" stroke="white" />
        <span className="font-semibold text-slate-900">Chennai</span>
        <ChevronDown className="size-4 text-slate-500" />
      </div>
      <span className="h-8 w-px bg-slate-200" />
      <div className="flex items-center gap-2">
        <SunCloud className="size-8" />
        <div className="leading-tight">
          <p className="text-lg font-bold text-slate-900">{w?.temp ?? "…"}</p>
          <p className="text-xs text-slate-500">{w?.text ?? "Loading"}</p>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert, className }: { alert: Alert | null; className?: string }) {
  const { title, detail } = splitAlert(alert);
  return (
    <Link to="/alerts" className={cn("flex items-center gap-4 rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-red-100 backdrop-blur transition hover:shadow-2xl", className)}>
      {alert
        ? <AlertTriangle className="size-9 shrink-0" fill={RED} stroke="white" strokeWidth={1.8} />
        : <ShieldCheck className="size-9 shrink-0 text-emerald-600" />}
      <div className="min-w-0 flex-1">
        <p className={cn("font-bold", !alert && "text-emerald-700")} style={alert ? { color: RED } : undefined}>{alert ? "Active Alert" : "All clear"}</p>
        <p className="font-semibold text-slate-900 md:truncate">{title}</p>
        {detail && <p className="mt-0.5 text-sm text-slate-600 md:truncate">{detail}</p>}
      </div>
      <ChevronRight className="size-5 shrink-0" style={{ color: RED }} />
    </Link>
  );
}

/** Small sun-behind-cloud glyph like the mock-up. */
function SunCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={className} aria-hidden>
      <circle cx="15" cy="13" r="8" fill="#fbbf24" />
      <g stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
        <path d="M15 1v3M5.5 4.5l2 2M2 13h3M24.5 4.5l-2 2" />
      </g>
      <path d="M13 28h18a6 6 0 0 0 0-12 8 8 0 0 0-15 2 5 5 0 0 0-3 10z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
    </svg>
  );
}

export default function Home() {
  const [alert, setAlert] = useState<Alert | null>(null);
  useEffect(() => { getActiveAlerts().then((a) => setAlert(a[0] ?? null)).catch(() => setAlert(null)); }, []);

  return (
    <CitizenShell>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eef3fb] to-[#f6f8fc] dark:from-slate-900 dark:to-slate-950">
        {/* Photo: right half on desktop, fades into the page on its left edge */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] md:block">
          <img src={PHOTO} alt="Chennai Central railway station" className="size-full object-cover object-[55%_0%]"
            style={{ maskImage: "linear-gradient(to right, transparent 0%, black 28%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 28%)" }}
            loading="eager" fetchPriority="high" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f6f8fc] to-transparent dark:from-slate-950" />
          <span className="absolute right-3 bottom-2 text-[10px] text-slate-500">Photo: Arian Zwegers · CC BY 2.0</span>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pt-6 pb-6 md:min-h-[440px] md:px-6 md:pt-14 md:pb-16">
          <div className="max-w-xl">
            <h1 className="font-display text-[2rem] leading-[1.1] font-bold tracking-tight text-slate-900 md:text-[3.3rem] dark:text-white">
              Your City, Safer <br className="md:hidden" />and <br className="hidden md:block" />More <span style={{ color: RED }}>Prepared</span>
            </h1>
            <p className="mt-4 text-[15px] text-slate-600 md:text-lg dark:text-slate-300">
              Report emergencies, access critical services, get real-time alerts, and stay safe — all in one citizen platform.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className="flex items-center justify-center gap-2.5 rounded-xl px-7 py-3.5 font-semibold text-white shadow-lg shadow-red-500/25 transition hover:-translate-y-0.5" style={{ background: RED }}>
                <Megaphone className="size-5" />Report an Emergency
              </Link>
              <Link to="/services" className="flex items-center justify-center gap-2.5 rounded-xl border-2 bg-white px-7 py-3 font-semibold transition hover:bg-blue-50 dark:bg-transparent" style={{ borderColor: BLUE, color: BLUE }}>
                <MapPin className="size-5" />Explore Services
              </Link>
            </div>
            <div className="mt-6 flex items-center justify-between gap-2 text-xs font-medium text-slate-700 sm:justify-start sm:gap-0 sm:text-sm dark:text-slate-300">
              {TRUST.map((x, i) => (
                <span key={x.t} className={cn("flex items-center gap-2", i > 0 && "sm:ml-5 sm:border-l sm:border-slate-300 sm:pl-5")}>
                  <x.i className={cn("size-5 shrink-0", x.c)} /><span className="leading-tight">{x.t}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Desktop: cards float over the photo */}
          <WeatherCard className="absolute top-8 right-6 hidden md:flex" />
          <AlertCard alert={alert} className="absolute right-6 bottom-8 hidden w-[440px] md:flex" />

          {/* Mobile: cards stack under the hero text */}
          <div className="mt-6 grid gap-3 md:hidden">
            <WeatherCard className="justify-between" />
            <AlertCard alert={alert} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- EMERGENCY SERVICES */}
      <section className="mx-auto max-w-7xl px-4 pt-6 pb-6 md:px-6 md:pt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900 md:text-2xl dark:text-white">Emergency Services</h2>
          <Link to="/services" className="flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
            <span className="md:hidden">View All</span><span className="hidden md:inline">View All Services</span><ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-2.5 md:grid-cols-8 md:gap-4">
          {SERVICES.map((s) => (
            <Link key={s.label} to={`/report?category=${s.cat}`}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white px-1.5 py-3.5 text-center shadow-[0_2px_10px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md md:min-h-[104px] md:py-5 dark:bg-slate-900 dark:ring-slate-800">
              <s.icon className="size-7 md:size-9" style={{ color: s.color }} fill={s.fill ?? "none"} strokeWidth={s.fill ? 1.6 : 2.2} />
              <span className="text-[11px] leading-tight font-semibold text-slate-800 md:text-sm dark:text-slate-200">{s.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- CPR HERO OPT-IN (live) */}
      <section id="hero-optin" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-4 md:px-6">
        <HeroOptInCard className="md:max-w-2xl" />
      </section>

      {/* ------------------------------------------------- CPR HERO NETWORK CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-6 md:px-6">
        <Link to="/hero" className="group relative flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-[#e53935] to-[#9f1239] p-4 text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 md:p-5">
          <HeartPulse className="pointer-events-none absolute -right-6 -bottom-8 size-36 opacity-15" strokeWidth={1.2} />
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25"><HeartPulse className="size-7" /></span>
          <span className="relative min-w-0 flex-1">
            <span className="block font-display text-lg font-bold">Become a CPR Hero</span>
            <span className="block text-sm text-white/85">13 trained citizens in Chennai get alerted when someone nearby collapses — and arrive before the ambulance.</span>
          </span>
          <ChevronRight className="relative size-6 shrink-0 transition group-hover:translate-x-1" />
        </Link>
      </section>

      {/* ------------------------------------------- SHORTCUTS + DISCOVER NEAR YOU */}
      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
        <div className="grid gap-6 border-t border-slate-200 pt-6 md:grid-cols-2 md:gap-0 dark:border-slate-800">
          <div className="md:pr-8">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
              <UserRound className="size-5 text-blue-700" fill="#1d4ed8" stroke="#1d4ed8" />Your Shortcuts
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { to: "/track", t: "Track Incident", i: MapPin, c: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
                { to: "/alerts", t: "Safety Alerts", i: Bell, c: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300" },
                { to: "/services#shelters", t: "Nearby Shelters", i: Users, c: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
              ].map((x) => (
                <Link key={x.t} to={x.to} className={cn("flex flex-col items-center justify-center gap-2 rounded-xl px-2 py-4 text-center transition hover:-translate-y-0.5", x.c)}>
                  <x.i className="size-6" />
                  <span className="text-xs font-semibold text-slate-800 md:text-sm dark:text-slate-100">{x.t}</span>
                </Link>
              ))}
            </div>
          </div>

          <LiveNearby />
        </div>
      </section>
    </CitizenShell>
  );
}

/** "Discover Services Near You" with a real live map: the citizen's GPS dot, nearby shelters and open incidents. */
function LiveNearby() {
  const { pos, status, start } = useLiveLocation();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  useEffect(() => {
    getShelters().then(setShelters).catch(() => {});
    getIncidents().then((x) => setIncidents(x.filter((i) => i.status !== "Resolved"))).catch(() => {});
  }, []);

  const nearest = useMemo(() => {
    if (!pos || !shelters.length) return null;
    return shelters.map((s) => ({ s, km: distanceKm(pos, s) })).sort((a, b) => a.km - b.km)[0];
  }, [pos, shelters]);
  const area = pos ? nearestArea(pos.lat, pos.lng).name : null;

  const msg: Record<typeof status, string> = {
    idle: "See yourself on the map with nearby shelters and incidents.",
    asking: "Waiting for your location… allow location access when your phone asks.",
    live: area ? `You are near ${area} · accurate to ±${pos?.accuracy ?? "?"} m` : "Live location on",
    denied: "Location permission was blocked. Allow it in your browser settings, or tap the map when reporting.",
    unavailable: "Couldn't get a GPS fix. Try moving near a window, or tap the map when reporting.",
    insecure: "Live location needs a secure (https) link. You can still tap the map when reporting.",
  };

  return (
    <div className="md:border-l md:border-slate-200 md:pl-8 dark:md:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
            <MapPin className="size-5 text-blue-700" fill="#1d4ed8" stroke="white" />Discover Services Near You
          </h3>
          <p className={cn("mt-1 text-sm", status === "denied" || status === "insecure" ? "text-amber-700" : "text-slate-600 dark:text-slate-300")}>{msg[status]}</p>
        </div>
        {status === "live" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"><span className="size-2 animate-pulse rounded-full bg-blue-600" />Live</span>
        ) : (
          <button type="button" onClick={start} disabled={status === "asking"}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60" style={{ background: BLUE }}>
            <LocateFixed className="size-4" />{status === "asking" ? "Locating…" : "Show my live location"}
          </button>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800">
        <LazyMap height={240} me={pos} className="rounded-none border-0"
          shelters={shelters.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: s.name, pct: Math.round((s.occupancy / Math.max(1, s.capacity)) * 100) }))}
          points={incidents.map((i) => ({ id: i.id, lat: i.lat ?? 0, lng: i.lng ?? 0, severity: i.severity, title: i.title })).filter((p) => p.lat && p.lng)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {nearest && (
          <span className="mr-auto inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
            <Users className="size-4 text-emerald-600" />Nearest shelter: <b>{nearest.s.name}</b> · {nearest.km < 1 ? `${Math.round(nearest.km * 1000)} m` : `${nearest.km.toFixed(1)} km`}
          </span>
        )}
        {pos && (
          <Link to={`/report?lat=${pos.lat.toFixed(5)}&lng=${pos.lng.toFixed(5)}&area=${encodeURIComponent(area ?? "")}`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md" style={{ background: RED }}>
            <Megaphone className="size-4" />Report from here
          </Link>
        )}
        <Link to="/services" className="inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition hover:bg-blue-50" style={{ borderColor: BLUE, color: BLUE }}>
          <MapIcon className="size-4" />Find Nearby Services
        </Link>
      </div>
    </div>
  );
}
