/** Official Round 2 "Analytics" row: total, critical, available teams, busy teams, assigned incidents, resolved. */
import { AlertOctagon, CheckCircle2, ClipboardList, Siren, Truck, UserCheck, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/ui";
import { cn } from "@/lib/cn";
import type { Stats, Team } from "@/lib/mock";

type Tone = "slate" | "red" | "green" | "amber" | "indigo" | "emerald";
const TONES: Record<Tone, string> = {
  slate: "text-slate-700 bg-slate-100 dark:text-slate-200 dark:bg-slate-800",
  red: "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/50",
  green: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50",
  amber: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50",
  indigo: "text-indigo-600 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/50",
  emerald: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50",
};

export function OfficialStats({ stats, teams, className }: { stats: Stats | null; teams?: Team[] | null; className?: string }) {
  if (!stats) return <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6", className)}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  const avail = stats.available_teams ?? teams?.filter((t) => t.status === "available").length ?? 0;
  const busy = stats.busy_teams ?? teams?.filter((t) => t.status === "busy").length ?? 0;
  const tiles: { label: string; value: number; sub: string; icon: LucideIcon; tone: Tone }[] = [
    { label: "Total incidents", value: stats.total, sub: `${stats.total - stats.resolved} open`, icon: ClipboardList, tone: "slate" },
    { label: "Critical", value: stats.critical, sub: "open, life-threatening", icon: AlertOctagon, tone: "red" },
    { label: "Available teams", value: avail, sub: "ready to dispatch", icon: Truck, tone: "green" },
    { label: "Busy teams", value: busy, sub: "on an incident", icon: Siren, tone: "amber" },
    { label: "Assigned incidents", value: stats.assigned ?? 0, sub: `${stats.in_progress} in progress`, icon: UserCheck, tone: "indigo" },
    { label: "Resolved", value: stats.resolved, sub: `${stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0}% of all`, icon: CheckCircle2, tone: "emerald" },
  ];
  return (
    <section className={className} aria-label="Response analytics">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Response analytics · live</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-muted">{t.label}</p>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", TONES[t.tone])}><t.icon className="size-4" /></span>
            </div>
            <p className="mt-1.5 font-display text-3xl font-bold tabular-nums">{t.value}</p>
            <p className="truncate text-[11px] text-muted">{t.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
