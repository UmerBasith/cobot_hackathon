/** Citizen layout: desktop header with centred nav + mobile drawer and fixed bottom tab bar. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell, ChevronDown, Home, Info, Megaphone, Menu, MonitorCog, Phone, Radar, ShieldCheck, Siren, Truck, UserRound, X, LayoutGrid, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const RED = "#e53935";

const NAV: { to: string; label: string; short: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", short: "Home", icon: Home },
  { to: "/report", label: "Report", short: "Report", icon: Megaphone },
  { to: "/track", label: "Track Incident", short: "Track", icon: Radar },
  { to: "/services", label: "Services", short: "Services", icon: LayoutGrid },
  { to: "/alerts", label: "Alerts", short: "Alerts", icon: Bell },
];

function isActive(path: string, to: string) {
  return to === "/" ? path === "/" : path === to || path.startsWith(to + "/");
}

export function CitizenLogo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${RED}, #b71c1c)` }}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" /><path d="M12 8.5v7M8.5 12h7" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold text-slate-900 dark:text-white">ResQ<span style={{ color: RED }}>Net</span></span>
        <span className="hidden text-[11px] text-slate-500 sm:block">Citizen Emergency Services</span>
      </span>
    </Link>
  );
}

function RoleMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pr-3 pl-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <span className="grid size-7 place-items-center rounded-full bg-slate-100 dark:bg-slate-800"><UserRound className="size-4" /></span>
        Citizen <ChevronDown className="size-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {[
            { to: "/", label: "Citizen", icon: UserRound },
            { to: "/app", label: "Control room", icon: MonitorCog },
            { to: "/responder", label: "Responder", icon: Truck },
            { to: "/about", label: "About ResQNet", icon: Info },
          ].map((x) => (
            <Link key={x.to} to={x.to} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
              <x.icon className="size-4 text-slate-400" />{x.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CitizenShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
          <button type="button" onClick={() => setDrawer(true)} className="grid size-10 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 md:hidden dark:text-slate-200" aria-label="Open menu">
            <Menu className="size-6" />
          </button>
          <div className="flex flex-1 justify-center md:flex-none md:justify-start"><CitizenLogo /></div>
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {NAV.map((n) => {
              const act = isActive(pathname, n.to);
              return (
                <Link key={n.to} to={n.to} className={cn("relative px-3 py-5 text-sm font-medium transition-colors lg:px-4", act ? "" : "text-slate-600 hover:text-slate-900 dark:text-slate-300")} style={act ? { color: RED } : undefined}>
                  {n.label}
                  {act && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full lg:inset-x-4" style={{ background: RED }} />}
                </Link>
              );
            })}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <a href="tel:112" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90" style={{ background: RED }}>
              <Phone className="size-4" />Call 112
            </a>
            <RoleMenu />
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <Link to="/alerts" className="relative grid size-10 place-items-center rounded-xl text-slate-700 dark:text-slate-200" aria-label="Alerts">
              <Bell className="size-5" /><span className="absolute top-2 right-2 size-2 rounded-full" style={{ background: RED }} />
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-slate-900/40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white p-4 shadow-2xl md:hidden dark:bg-slate-900"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", damping: 28, stiffness: 300 }}>
              <div className="mb-4 flex items-center justify-between"><CitizenLogo /><button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-5" /></button></div>
              <nav className="space-y-1">
                {NAV.map((n) => {
                  const act = isActive(pathname, n.to);
                  return (
                    <Link key={n.to} to={n.to} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", act ? "bg-red-50 dark:bg-red-950/40" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")} style={act ? { color: RED } : undefined}>
                      <n.icon className="size-5" />{n.label}
                    </Link>
                  );
                })}
              </nav>
              <p className="mt-6 mb-2 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Switch role</p>
              <nav className="space-y-1">
                <Link to="/app" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><MonitorCog className="size-5 text-slate-400" />Control room</Link>
                <Link to="/responder" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><Truck className="size-5 text-slate-400" />Responder</Link>
                <Link to="/about" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><Info className="size-5 text-slate-400" />About ResQNet</Link>
              </nav>
              <a href="tel:112" className="mt-auto flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white" style={{ background: RED }}><Phone className="size-4" />Call 112</a>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="pb-24 md:pb-0">{children}</div>

      <footer className="hidden border-t border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-slate-500">
          <p className="flex items-center gap-2"><ShieldCheck className="size-4" style={{ color: RED }} />ResQNet · Chennai citizen emergency platform · In danger? Call <a href="tel:112" className="font-semibold" style={{ color: RED }}>112</a></p>
          <div className="flex gap-4"><Link to="/about" className="hover:text-slate-900">About ResQNet</Link><Link to="/app" className="hover:text-slate-900">Control room</Link><Link to="/responder" className="hover:text-slate-900">Responder</Link></div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.4rem)] shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95">
        <div className="grid grid-cols-5">
          {NAV.map((n) => {
            const act = isActive(pathname, n.to);
            return (
              <NavLink key={n.to} to={n.to} className="flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium" style={act ? { color: RED } : undefined}>
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", act ? "bg-red-50 dark:bg-red-950/50" : "text-slate-500")}>
                  {n.to === "/report" ? <Siren className="size-5" /> : <n.icon className="size-5" />}
                </span>
                <span className={act ? "" : "text-slate-500"}>{n.short}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
