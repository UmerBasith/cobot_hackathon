import { Link } from "react-router-dom";
import { LayoutDashboard, Lock } from "lucide-react";
import { Logo } from "@/sections/Logo";
import { ThemeToggle } from "@/sections/ThemeToggle";
import { Call112 } from "@/sections/IncidentUI";
import { ReportFlow } from "@/sections/ReportFlow";
import { AlertBanner } from "@/pages/Alerts";

/** /report — citizen view, mobile-first, no sidebar. */
export default function ReportPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/app" className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-fg sm:inline-flex"><LayoutDashboard className="size-4" />Control room</Link>
            <ThemeToggle />
            <Call112 compact />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-5 pb-10 sm:pt-8">
        <AlertBanner />
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          <b>Life in danger right now?</b> Call <a href="tel:112" className="font-semibold underline">112</a> first. Then report here so the control room can see it on the map.
        </div>
        <ReportFlow />
        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" />No login needed. Contact details are optional and only used by responders.</p>
      </main>
    </div>
  );
}
