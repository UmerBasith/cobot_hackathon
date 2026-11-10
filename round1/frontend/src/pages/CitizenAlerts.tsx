/** /alerts — active public safety alerts for citizens, filterable by area. */
import { useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, BellOff, Clock, Info, MapPin, type LucideIcon } from "lucide-react";
import { CitizenShell } from "@/sections/CitizenShell";
import { getActiveAlerts, timeAgo } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import type { Alert, AlertLevel } from "@/lib/mock";
import { Skeleton } from "@/ui";
import { cn } from "@/lib/cn";

const LVL: Record<AlertLevel, { label: string; icon: LucideIcon; card: string; chip: string; bar: string }> = {
  danger: { label: "Danger", icon: AlertOctagon, card: "bg-red-50 text-red-600", chip: "bg-red-600 text-white", bar: "bg-red-500" },
  warning: { label: "Warning", icon: AlertTriangle, card: "bg-amber-50 text-amber-600", chip: "bg-amber-500 text-white", bar: "bg-amber-500" },
  info: { label: "Advisory", icon: Info, card: "bg-blue-50 text-blue-700", chip: "bg-blue-700 text-white", bar: "bg-blue-600" },
};

export default function CitizenAlerts() {
  const [alerts] = usePoll<Alert[]>(() => getActiveAlerts(), 10000, []);
  const [area, setArea] = useState("All");
  const areas = useMemo(() => ["All", ...Array.from(new Set((alerts ?? []).map((a) => a.area)))], [alerts]);
  const list = (alerts ?? []).filter((a) => area === "All" || a.area === area);

  return (
    <CitizenShell>
      <section className="border-b border-red-100 bg-gradient-to-br from-red-50 via-white to-blue-50 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
          <h1 className="font-display text-3xl font-bold md:text-4xl">Safety Alerts</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Official alerts issued by the Chennai control room. Updated live.</p>
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
            {areas.map((a) => (
              <button key={a} type="button" onClick={() => setArea(a)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition", area === a ? "border-transparent bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300")}>{a}</button>
            ))}
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6 md:px-6">
        {!alerts && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        {alerts && list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <BellOff className="mx-auto size-8 text-slate-400" />
            <p className="mt-3 font-semibold">No active alerts{area !== "All" ? ` for ${area}` : ""}</p>
            <p className="text-sm text-slate-500">You will see flood, fire and evacuation alerts here as soon as they are issued.</p>
          </div>
        )}
        {list.map((a) => {
          const m = LVL[a.level] ?? LVL.info;
          return (
            <div key={a.id} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 pl-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className={cn("absolute inset-y-0 left-0 w-1.5", m.bar)} />
              <div className="flex items-start gap-3">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", m.card)}><m.icon className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase", m.chip)}>{m.label}</span>
                    <span className="flex items-center gap-1 text-sm font-semibold"><MapPin className="size-3.5 text-slate-400" />{a.area}</span>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-snug">{a.message}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="size-3" />Issued {timeAgo(a.created_at)}</span>
                    <span>Valid until {new Date(a.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CitizenShell>
  );
}
