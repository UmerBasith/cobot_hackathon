import { Link } from "react-router-dom";
import { LayoutDashboard, Lock, Search, Siren } from "lucide-react";
import { Logo } from "@/sections/Logo";
import { ThemeToggle } from "@/sections/ThemeToggle";
import { Call112 } from "@/sections/IncidentUI";
import { ReportFlow } from "@/sections/ReportFlow";
import { AlertBanner } from "@/pages/Alerts";
import { CitizenShell } from "@/sections/CitizenShell";

/** Shared citizen header (/report, /track). */
export function CitizenHeader() {
  return (
    <header className="glass sticky top-0 z-40 border-b border-line">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Logo />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link to="/report" className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-fg md:inline-flex"><Siren className="size-4" />Report</Link>
          <Link to="/track" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-fg"><Search className="size-4" /><span className="hidden min-[380px]:inline">Track</span><span className="hidden sm:inline">&nbsp;report</span></Link>
          <Link to="/admin" className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-fg lg:inline-flex"><LayoutDashboard className="size-4" />Control room</Link>
          <ThemeToggle />
          <Call112 compact />
        </div>
      </div>
    </header>
  );
}

export default function ReportPage() {
  return (
    <CitizenShell>
      <main className="mx-auto max-w-7xl px-4 pt-5 pb-10 sm:pt-8 md:px-6">
        <AlertBanner />
        <ReportFlow />
        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-500"><Lock className="size-3.5" />No login needed. Contact details are optional and only used by responders.</p>
      </main>
    </CitizenShell>
  );
}
