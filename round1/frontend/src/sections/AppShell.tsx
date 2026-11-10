/** Dashboard layout: dark navy sidebar + white top bar. Add pages to `appNav` below and routes in App.tsx. */
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { AlertOctagon, AlertTriangle, BarChart3, Bell, BellRing, ChevronDown, ChevronRight, CloudRain, ExternalLink, Home, LayoutDashboard, ListOrdered, LogOut, Menu, Monitor, MoreHorizontal, PhoneCall, RotateCcw, Settings, Smartphone, Truck, Users, Wifi, X, type LucideIcon } from "lucide-react";
import { errText, getEscalations, getStats, getTeams, resetDemo, simulateFlood } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import type { Escalation, Stats, Team } from "@/lib/mock";
import { cn } from "@/lib/cn";
import { BrandMark } from "./Logo";
import { getSession, logout } from "@/lib/auth";
import { useToast } from "@/ui";
import { ThemeToggle } from "./ThemeToggle";
import { Call112 } from "./IncidentUI";

type NavItem = { to: string; label: string; icon: LucideIcon; badge?: "open" | "teams" };
export const appNav: NavItem[] = [
  { to: "/admin", label: "Command Centre", icon: LayoutDashboard },
  { to: "/admin/incidents", label: "Incidents", icon: ListOrdered, badge: "open" },
  { to: "/admin/teams", label: "Response Teams", icon: Users, badge: "teams" },
  { to: "/admin/alerts", label: "Alerts", icon: BellRing },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/zones", label: "Zones & Shelters", icon: Home },
  { to: "/admin/report", label: "New Report", icon: PhoneCall },
];

function SideLogo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <BrandMark tile className="size-10" />
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold text-white">ResQNet</span>
        <span className="block text-[10px] font-medium tracking-wide text-slate-400">Emergency Response Platform</span>
      </span>
    </Link>
  );
}

function SideNav({ onClick }: { onClick?: () => void }) {
  const [stats] = usePoll<Stats>(getStats);
  const [teams] = usePoll<Team[]>(getTeams);
  const open = stats ? stats.total - stats.resolved : null;
  const busy = teams?.filter((t) => t.status === "busy").length ?? 0;
  const badge = (b?: NavItem["badge"]) =>
    b === "open" ? (open != null ? String(open) : null) : b === "teams" ? (teams ? `${busy}/${teams.length}` : null) : null;
  return (
    <nav className="space-y-1">
      {appNav.map((n) => {
        const b = badge(n.badge);
        return (
          <NavLink key={n.to} to={n.to} end={n.to !== "/admin/incidents"} onClick={onClick}
            className={({ isActive }) => cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive ? "text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-red-600 shadow-lg shadow-red-900/40" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <n.icon className="relative size-[18px]" />
                <span className="relative flex-1">{n.label}</span>
                {b && <span className={cn("relative rounded-full px-2 py-0.5 text-[11px] font-semibold", isActive ? "bg-white/20 text-white" : n.badge === "open" ? "bg-red-600 text-white" : "bg-white/10 text-slate-200")}>{b}</span>}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SideOps({ onDone }: { onDone?: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function simulate() {
    setBusy("sim");
    try { const r = await simulateFlood(); toast("warning", `Disaster simulated: ${r.created.length} new reports`, "Velachery · Tambaram · Adyar — watch the queue"); onDone?.(); }
    catch (e) { toast("error", "Could not simulate", errText(e)); }
    finally { setBusy(null); }
  }
  async function reset() {
    setBusy("reset");
    try { const r = await resetDemo(); toast("success", "Demo data restored", `${r.incidents} incidents`); onDone?.(); }
    catch (e) { toast("error", "Could not reset", errText(e)); }
    finally { setBusy(null); }
  }
  const btn = "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white disabled:opacity-60";
  return (
    <div>
      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Operations</p>
      <button className={btn} onClick={simulate} disabled={!!busy}><CloudRain className={cn("size-[18px] text-sky-400", busy === "sim" && "animate-pulse")} />Simulate Disaster</button>
      <button className={btn} onClick={reset} disabled={!!busy}><RotateCcw className={cn("size-[18px] text-amber-400", busy === "reset" && "animate-spin")} />Reset Demo</button>
      <Link to="/report" onClick={onDone} className={btn}><Smartphone className="size-[18px] text-red-400" /><span className="flex-1">Citizen view</span><ExternalLink className="size-3.5 opacity-60" /></Link>
      <Link to="/responder" onClick={onDone} className={btn}><Truck className="size-[18px] text-emerald-400" /><span className="flex-1">Responder app</span><ExternalLink className="size-3.5 opacity-60" /></Link>
    </div>
  );
}

function SidebarBody({ onClick }: { onClick?: () => void }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Main</p>
        <SideNav onClick={onClick} />
        <NavLink to="/admin" end onClick={onClick} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
          <Settings className="size-[18px]" />Settings
        </NavLink>
        <div className="mt-5"><SideOps onDone={onClick} /></div>
      </div>
      <div className="relative mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-3">
        <svg viewBox="0 0 200 60" className="pointer-events-none absolute -right-2 bottom-0 h-14 w-44 text-red-500/25" fill="currentColor" aria-hidden>
          <path d="M0 60V44h10v-8h8v8h8V30h6v-6h4v6h6v30zM44 60V36h14v-6h6v6h6v24zM74 60V22l6-10 6 10v38zM92 60V40h10V28h4l2-6 2 6h4v12h10v20zM126 60V34h8v-6h12v6h8v26zM160 60V42h6V30h4v-8h4v8h4v12h6v18zM188 60V46h12v14z" />
        </svg>
        <p className="relative flex items-center gap-2 text-xs font-semibold text-emerald-400"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>System Online</p>
        <p className="relative mt-0.5 text-[11px] text-slate-400">Offline Mode Active · Chennai LAN</p>
      </div>
    </>
  );
}

function useUptime() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.floor((now - start) / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

const mobileTabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/incidents", label: "Incidents", icon: ListOrdered },
  { to: "/admin/teams", label: "Teams", icon: Users },
  { to: "/admin/alerts", label: "Alerts", icon: BellRing },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const uptime = useUptime();
  const [esc] = usePoll<Escalation[]>(getEscalations);
  const escCount = esc?.length ?? 0;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#0f1b33] p-4 lg:flex">
        <div className="px-2 pb-5 pt-1"><SideLogo /></div>
        <SidebarBody />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#0f1b33] p-4">
            <div className="flex items-center justify-between px-2 pb-5 pt-1"><SideLogo /><button className="text-slate-300" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button></div>
            <SidebarBody onClick={() => setOpen(false)} />
          </motion.aside>
        </div>
      )}
      <div className="pb-16 lg:pb-0 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 dark:border-line dark:bg-surface/95">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="size-5" /></button>
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 sm:inline-flex dark:border-line dark:bg-surface-2 dark:text-fg"><Monitor className="size-3.5" />Admin Control Room</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />System Online</span>
          <span className="hidden items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 md:inline-flex dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900"><Wifi className="size-3.5" />Offline Mode (LAN)</span>
          <span className="hidden font-mono text-xs text-slate-500 xl:inline">Uptime: {uptime}</span>
          <div className="ml-auto flex items-center gap-2">
            <Call112 compact className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Link to="/admin/alerts" className="relative grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-line dark:bg-surface dark:text-muted" aria-label="Escalations">
              <Bell className="size-[18px]" />
              {escCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-surface">{escCount}</span>}
            </Link>
            <button className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-surface-2" title={`Signed in as ${getSession("admin")?.name ?? "Admin"}`}>
              <span className="grid size-8 place-items-center rounded-full bg-[#0f1b33] text-xs font-semibold text-white">AD</span>
              <span className="hidden text-sm font-medium sm:inline">Admin</span><ChevronDown className="hidden size-4 text-slate-400 sm:block" />
            </button>
            <button onClick={() => { logout("admin"); window.location.assign("/admin/login"); }} className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-red-600 dark:border-line dark:bg-surface dark:text-muted" aria-label="Log out" title="Log out"><LogOut className="size-[18px]" /></button>
          </div>
        </header>
        <EscalationBanner />
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mx-auto max-w-[1400px] p-4 sm:p-6">
          <Outlet />
        </motion.main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-slate-200 bg-white lg:hidden dark:border-line dark:bg-surface">
        {mobileTabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to !== "/admin/incidents"} className={({ isActive }) => cn("flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium", isActive ? "text-red-600" : "text-slate-500")}>
            <t.icon className="size-5" />{t.label}
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-500"><MoreHorizontal className="size-5" />More</button>
      </nav>
    </div>
  );
}

export function PageIntro({ title, text, actions }: { title: string; text?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        {text && <p className="mt-1 text-muted">{text}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Escalation banner (red critical / amber warning), refresh 5 s, click → incident. */
function EscalationBanner() {
  const [list] = usePoll<Escalation[]>(getEscalations);
  const [open, setOpen] = useState(false);
  if (!list?.length) return null;
  const crit = list.filter((e) => e.level === "critical");
  const top = crit[0] ?? list[0];
  const isCrit = top.level === "critical";
  const Icon = isCrit ? AlertOctagon : AlertTriangle;
  const row = (e: Escalation, i: number) => {
    const inner = (<><span className="min-w-0 flex-1 truncate">{e.message}</span>{e.incident_id && <ChevronRight className="size-4 shrink-0 opacity-70" />}</>);
    const cls = "flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5";
    return e.incident_id ? <Link key={i} to={`/admin/incidents/${e.incident_id}`} className={cls}>{inner}</Link> : <div key={i} className={cls}>{inner}</div>;
  };
  return (
    <div className={cn("border-b px-4 py-2 sm:px-6", isCrit ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100")}>
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <span className="relative grid place-items-center"><span className={cn("absolute size-5 animate-ping rounded-full", isCrit ? "bg-red-400/40" : "bg-amber-400/40")} /><Icon className="relative size-5" /></span>
        <p className="shrink-0 text-sm font-semibold">{crit.length ? `${crit.length} critical escalation${crit.length > 1 ? "s" : ""}` : "Warning"}{list.length - crit.length > 0 ? ` · ${list.length - crit.length} warning${list.length - crit.length > 1 ? "s" : ""}` : ""}</p>
        <div className="hidden min-w-0 flex-1 md:block">{row(top, -1)}</div>
        <button onClick={() => setOpen(!open)} className="ml-auto shrink-0 rounded-lg px-2 py-1 text-xs font-medium underline-offset-2 hover:underline">{open ? "Hide" : `View all ${list.length}`}</button>
      </div>
      {open && <div className="mx-auto mt-1 max-w-[1400px] space-y-0.5 pb-1">{list.map(row)}</div>}
    </div>
  );
}
