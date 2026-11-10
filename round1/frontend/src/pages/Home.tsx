/** "/" — citizen landing: hero, live weather + active alert, emergency service tiles, shortcuts. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Bell, Building2, ChevronDown, ChevronRight, CloudSun, Flame, HeartPulse, Home as HomeIcon, MapPin,
  Megaphone, Mountain, MoreHorizontal, Radar, ShieldCheck, ShieldHalf, Waves, WifiOff, Zap, type LucideIcon,
} from "lucide-react";
import { CitizenShell, RED } from "@/sections/CitizenShell";
import { getActiveAlerts } from "@/lib/resq";
import type { Alert } from "@/lib/mock";
import { cn } from "@/lib/cn";

const SERVICES: { label: string; icon: LucideIcon; cat: string; tint: string }[] = [
  { label: "Fire", icon: Flame, cat: "fire", tint: "bg-orange-50 text-orange-600" },
  { label: "Medical", icon: HeartPulse, cat: "medical", tint: "bg-rose-50 text-rose-600" },
  { label: "Police", icon: ShieldHalf, cat: "other", tint: "bg-blue-50 text-blue-700" },
  { label: "Flood / Waterlogging", icon: Waves, cat: "flood", tint: "bg-sky-50 text-sky-600" },
  { label: "Landslide", icon: Mountain, cat: "landslide", tint: "bg-amber-50 text-amber-700" },
  { label: "Power Outage", icon: Zap, cat: "electrical", tint: "bg-yellow-50 text-yellow-600" },
  { label: "Structural Collapse", icon: Building2, cat: "building_collapse", tint: "bg-stone-100 text-stone-700" },
  { label: "Other", icon: MoreHorizontal, cat: "other", tint: "bg-violet-50 text-violet-600" },
];

const WMO: Record<number, string> = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };

function useWeather() {
  const [w, setW] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=13.08&longitude=80.27&current=temperature_2m,weather_code");
        const j = await r.json();
        const t = Math.round(j.current.temperature_2m);
        if (!off) setW(`${t}°C ${WMO[j.current.weather_code as number] ?? "Live"}`);
      } catch { if (!off) setW("Live"); }
    })();
    return () => { off = true; };
  }, []);
  return w;
}

function ChennaiCentral({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 360" className={className} role="img" aria-label="Chennai Central illustration">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#dbeafe" /><stop offset="1" stopColor="#fef2f2" /></linearGradient>
        <linearGradient id="brick" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d9534f" /><stop offset="1" stopColor="#b23a36" /></linearGradient>
      </defs>
      <rect width="520" height="360" rx="28" fill="url(#sky)" />
      <circle cx="420" cy="70" r="30" fill="#fde68a" opacity="0.8" />
      <g fill="#c7d2fe" opacity="0.7"><rect x="20" y="200" width="40" height="110" rx="3" /><rect x="64" y="170" width="30" height="140" rx="3" /><rect x="440" y="180" width="34" height="130" rx="3" /><rect x="478" y="215" width="26" height="95" rx="3" /></g>
      {/* wings */}
      <rect x="90" y="200" width="340" height="110" fill="url(#brick)" />
      <rect x="90" y="192" width="340" height="12" fill="#f8fafc" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i === 3 || i === 4 ? null : <path key={i} d={`M${108 + i * 40} 300v-52a12 12 0 0 1 24 0v52z`} fill="#fef3c7" stroke="#f8fafc" strokeWidth="2" />))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i === 3 || i === 4 ? null : <rect key={`w${i}`} x={110 + i * 40} y="214" width="20" height="16" rx="8" fill="#f8fafc" opacity="0.9" />))}
      {/* corner turrets */}
      {[96, 404].map((x) => (<g key={x}><rect x={x} y="168" width="22" height="40" fill="#b23a36" /><path d={`M${x - 3} 170 L${x + 11} 148 L${x + 25} 170z`} fill="#8b2a27" /></g>))}
      {/* tower */}
      <rect x="226" y="96" width="68" height="214" fill="url(#brick)" />
      <rect x="220" y="90" width="80" height="10" fill="#f8fafc" />
      <path d="M220 90 L260 44 L300 90z" fill="#8b2a27" />
      <rect x="256" y="26" width="8" height="22" fill="#8b2a27" />
      <circle cx="260" cy="128" r="20" fill="#f8fafc" stroke="#8b2a27" strokeWidth="3" />
      <path d="M260 128v-12M260 128l8 5" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M240 310v-70a20 20 0 0 1 40 0v70z" fill="#fef3c7" stroke="#f8fafc" strokeWidth="3" />
      <rect x="240" y="166" width="40" height="40" rx="20" fill="#f8fafc" opacity="0.9" />
      {/* ground */}
      <rect x="0" y="308" width="520" height="52" fill="#e2e8f0" />
      <rect x="0" y="322" width="520" height="6" fill="#cbd5e1" />
      <g fill="#16a34a" opacity="0.85"><circle cx="58" cy="300" r="16" /><circle cx="470" cy="300" r="18" /><circle cx="440" cy="304" r="12" /></g>
    </svg>
  );
}

export default function Home() {
  const weather = useWeather();
  const [alert, setAlert] = useState<Alert | null>(null);
  useEffect(() => { getActiveAlerts().then((a) => setAlert(a[0] ?? null)); }, []);

  return (
    <CitizenShell>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-red-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 size-[420px] rounded-full bg-blue-100/60 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 [&>*]:min-w-0 pt-6 pb-8 md:grid-cols-2 md:px-6 md:pt-14 md:pb-14">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-semibold shadow-sm" style={{ color: RED }}>
              <span className="size-1.5 animate-pulse rounded-full" style={{ background: RED }} />Live for Chennai
            </span>
            <h1 className="mt-4 font-display text-[2.1rem] leading-[1.1] font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl dark:text-white">
              Your City, Safer and More <span style={{ color: RED }}>Prepared</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-600 md:text-lg dark:text-slate-300">
              Report emergencies, access critical services, get real-time alerts, and stay safe — all in one citizen platform.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className="flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg shadow-red-500/25 transition hover:-translate-y-0.5" style={{ background: RED }}>
                <Megaphone className="size-5" />Report an Emergency
              </Link>
              <Link to="/services" className="flex items-center justify-center gap-2 rounded-xl border-2 border-blue-800 bg-white px-6 py-3 font-semibold text-blue-900 transition hover:bg-blue-50 dark:bg-transparent dark:text-blue-200">
                <MapPin className="size-5" />Explore Services
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-xs font-medium text-slate-600 sm:flex sm:gap-6 sm:text-sm dark:text-slate-300">
              {[
                { i: Zap, t: "Quick Response", c: "text-amber-500" },
                { i: ShieldCheck, t: "Trusted & Official", c: "text-blue-700" },
                { i: WifiOff, t: "Works Offline", c: "text-emerald-600" },
              ].map((x) => (
                <span key={x.t} className="flex flex-col items-center gap-1 rounded-xl bg-white p-2 text-center shadow-sm sm:flex-row sm:bg-transparent sm:p-0 sm:shadow-none dark:bg-slate-900 sm:dark:bg-transparent">
                  <x.i className={cn("size-5 sm:size-4", x.c)} />{x.t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <ChennaiCentral className="hidden w-full drop-shadow-xl md:block" />
            <div className="grid min-w-0 grid-cols-1 gap-3 md:contents">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-lg dark:border-slate-800 dark:bg-slate-900 md:absolute md:top-5 md:left-5 md:w-80">
                <span className="grid size-10 place-items-center rounded-xl bg-red-50" style={{ color: RED }}><MapPin className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold">Chennai <ChevronDown className="size-4 text-slate-400" /></p>
                  <p className="text-xs text-slate-500">Tamil Nadu</p>
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-100 pl-3 text-sm dark:border-slate-800">
                  <CloudSun className="size-5 text-amber-500" />
                  <span className="font-medium">{weather === null ? "…" : weather === "Live" ? "Chennai · Live" : weather}</span>
                </div>
              </div>
              <Link to="/alerts" className="flex items-center gap-3 rounded-2xl border border-red-100 bg-white p-3.5 shadow-lg transition hover:shadow-xl md:absolute md:-bottom-5 md:right-5 md:w-80 dark:border-red-900/40 dark:bg-slate-900">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50" style={{ color: RED }}><AlertTriangle className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: RED }}>Active Alert</p>
                  <p className="truncate text-sm font-medium">{alert ? alert.message : "No active alerts in your area"}</p>
                  {alert && <p className="text-xs text-slate-500">{alert.area}</p>}
                </div>
                <ChevronRight className="size-5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-4 pb-8 md:px-6 md:pt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold md:text-2xl">Emergency Services</h2>
          <Link to="/services" className="flex items-center gap-1 text-sm font-semibold" style={{ color: RED }}>View All Services <ArrowRight className="size-4" /></Link>
        </div>
        <div className="grid grid-cols-4 gap-2.5 md:grid-cols-8 md:gap-4">
          {SERVICES.map((s) => (
            <Link key={s.label} to={`/report?category=${s.cat}`} className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2.5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-4 dark:border-slate-800 dark:bg-slate-900">
              <span className={cn("grid size-11 place-items-center rounded-xl md:size-14", s.tint)}><s.icon className="size-5 md:size-7" /></span>
              <span className="text-[11px] leading-tight font-medium text-slate-700 md:text-sm dark:text-slate-200">{s.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-12 md:grid-cols-[1.4fr_1fr] md:px-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 font-display text-lg font-bold">Your Shortcuts</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { to: "/track", t: "Track Incident", d: "Live status", i: Radar, c: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
              { to: "/alerts", t: "Safety Alerts", d: "Near you", i: Bell, c: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300" },
              { to: "/services#shelters", t: "Nearby Shelters", d: "Open now", i: HomeIcon, c: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
            ].map((x) => (
              <Link key={x.t} to={x.to} className={cn("rounded-2xl p-3 transition hover:-translate-y-0.5 md:p-4", x.c)}>
                <x.i className="size-6" />
                <p className="mt-3 text-sm font-semibold leading-tight">{x.t}</p>
                <p className="text-xs opacity-75">{x.d}</p>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-blue-900 to-slate-900 p-5 text-white shadow-lg">
          <div>
            <h3 className="font-display text-lg font-bold">Discover Services Near You</h3>
            <p className="mt-1 text-sm text-blue-100">Hospitals, fire &amp; police stations, relief shelters and helplines across Chennai.</p>
          </div>
          <Link to="/services" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-blue-900 sm:w-auto sm:self-start">
            <MapPin className="size-4" />Find Nearby Services
          </Link>
        </div>
      </section>
    </CitizenShell>
  );
}
