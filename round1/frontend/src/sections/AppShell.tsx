/** Dashboard layout: sidebar + top bar. Add pages to `appNav` below and routes in App.tsx. */
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { ExternalLink, LayoutDashboard, ListOrdered, Menu, PhoneCall, Smartphone, X, type LucideIcon } from "lucide-react";
import { team } from "@/config";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Call112 } from "./IncidentUI";

export const appNav: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/incidents", label: "Incidents", icon: ListOrdered },
  { to: "/app/report", label: "New report", icon: PhoneCall },
];

function SideNav({ onClick }: { onClick?: () => void }) {
  return (
    <nav className="space-y-1">
      {appNav.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to !== "/app/incidents"} onClick={onClick}
          className={({ isActive }) => cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive ? "text-brand-700 dark:text-brand-200" : "text-muted hover:bg-surface-2 hover:text-fg")}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-brand-900/40" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <n.icon className="relative size-[18px]" />
              <span className="relative">{n.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const title = loc.pathname.startsWith("/app/incidents/") ? "Incident detail" : appNav.find((n) => n.to === loc.pathname)?.label ?? "Dashboard";
  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="px-2 py-2"><Logo /></div>
        <div className="mt-6 flex-1"><SideNav /></div>
        <Link to="/report" className="mb-3 flex items-center gap-2 rounded-xl border border-line p-3 text-sm hover:bg-surface-2">
          <Smartphone className="size-4 text-brand-600" /><span className="flex-1">Citizen view</span><ExternalLink className="size-3.5 text-muted" />
        </Link>
        <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
          <p className="font-medium text-fg">{team.name}</p>
          <p>{team.members.join(" · ")}</p>
        </div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} className="absolute inset-y-0 left-0 w-64 bg-surface p-4">
            <div className="flex items-center justify-between px-2 py-2"><Logo /><button onClick={() => setOpen(false)}><X className="size-5" /></button></div>
            <div className="mt-6"><SideNav onClick={() => setOpen(false)} /></div>
          </motion.aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line px-4 sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="size-5" /></button>
          <h1 className="text-lg font-semibold">{title}</h1>
          <Badge tone="green" dot pulse className="hidden sm:inline-flex">Live · 5 s</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/report" className="hidden items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-muted hover:text-fg md:inline-flex">
              <Smartphone className="size-4" />Citizen view
            </Link>
            <ThemeToggle />
            <Call112 compact className="hidden sm:inline-flex" />
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white" title="Control room operator">CR</div>
          </div>
        </header>
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </motion.main>
      </div>
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
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
