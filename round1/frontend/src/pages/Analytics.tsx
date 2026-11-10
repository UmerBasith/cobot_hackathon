/** /app/analytics — analytics & performance (measured from demo data). */
import type { ReactNode } from "react";
import { Activity, BarChart3, CheckCircle2, Gauge, LayoutGrid, MapPin, PieChart, RefreshCw, Timer, Truck, Zap, type LucideIcon } from "lucide-react";
import { AreaChartBox, Badge, BarChartBox, Button, Card, CardBody, CardHeader, ChartLegend, DonutChartBox, ProgressBar, Skeleton } from "@/ui";
import { PageIntro } from "@/sections/AppShell";
import { CATEGORY_META, CategoryIcon, SEV_HEX } from "@/sections/IncidentUI";
import { getAnalytics } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Analytics as A } from "@/lib/mock";

const STATUS_HEX = { Reported: "#94a3b8", Pending: "#f59e0b", "In Progress": "#0ea5e9", Resolved: "#10b981" } as const;
const mins = (v: number | null) => (v == null ? "—" : v < 60 ? `${v.toFixed(1)} min` : `${(v / 60).toFixed(1)} h`);

export default function Analytics() {
  const [a, reload, at] = usePoll<A>(getAnalytics, 10000);
  return (
    <>
      <PageIntro title="Analytics & performance" text={`How fast we respond, where incidents happen, how teams perform · measured from demo data${at ? ` · ${fmtTime(at)}` : ""}`}
        actions={<Button variant="outline" icon={RefreshCw} onClick={reload}>Refresh</Button>} />
      {!a ? <Loading /> : (<>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={CheckCircle2} label="Resolution rate" value={`${a.resolution_rate}%`} sub={`${a.resolved} of ${a.total} resolved · ${a.open} open`} tone="green" bar={a.resolution_rate} />
          <Kpi icon={Timer} label="Avg time to assign" value={mins(a.avg_time_to_assign_min)} sub={`Avg time to resolve ${mins(a.avg_time_to_resolve_min)}`} tone="blue" />
          <Kpi icon={Zap} label="Critical: time to assign" value={mins(a.critical_avg_time_to_assign_min)} sub="Target under 2 min (escalates after)" tone="red" />
          <Kpi icon={Truck} label="Team utilisation" value={`${a.utilisation}%`} sub={`${a.teams_busy} of ${a.teams_total} busy · ${a.rejections} rejection${a.rejections === 1 ? "" : "s"}`} tone="blue" bar={a.utilisation} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="min-w-0 xl:col-span-2">
            <CardHeader title="Reported vs resolved" subtitle="Per hour, last 6 hours" icon={Activity} />
            <CardBody>
              <AreaChartBox height={260} x="t" data={a.by_hour.map((h) => ({ t: fmtTime(h.hour), Reported: h.reported, Resolved: h.resolved }))}
                series={[{ key: "Reported", color: "var(--color-brand-500)" }, { key: "Resolved", color: "#10b981" }]} />
            </CardBody>
          </Card>
          <Card className="min-w-0">
            <CardHeader title="Status mix" subtitle="All incidents right now" icon={PieChart} />
            <CardBody>
              <DonutChartBox height={190} data={a.by_status.map((s) => ({ name: s.status, value: s.count }))} colors={a.by_status.map((s) => STATUS_HEX[s.status])}
                center={{ value: String(a.total), label: "incidents" }} />
              <div className="mt-3"><ChartLegend colors={a.by_status.map((s) => STATUS_HEX[s.status])} items={a.by_status.map((s) => ({ label: s.status, value: String(s.count) }))} /></div>
            </CardBody>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader title="Hotspots by area" subtitle="Critical stacked on other incidents" icon={MapPin} />
            <CardBody>
              <BarChartBox stacked height={280} x="area" data={a.by_area.slice(0, 8).map((r) => ({ area: r.area, Critical: r.critical, Other: r.total - r.critical }))}
                series={[{ key: "Critical", color: SEV_HEX.Critical }, { key: "Other", color: "var(--color-accent-500)" }]} />
            </CardBody>
          </Card>
          <Card className="min-w-0">
            <CardHeader title="By category" subtitle="Count and average severity score" icon={LayoutGrid} />
            <CardBody className="space-y-2.5">
              {[...a.by_category].sort((x, y) => y.total - x.total).map((c) => {
                const max = Math.max(1, ...a.by_category.map((x) => x.total));
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <CategoryIcon category={c.category} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between text-sm"><span className="truncate">{CATEGORY_META[c.category]?.label ?? c.label}</span><span className="font-medium tabular-nums">{c.total}</span></div>
                      <ProgressBar value={(c.total / max) * 100} />
                    </div>
                    <Badge tone={c.avg_score >= 70 ? "red" : c.avg_score >= 45 ? "brand" : c.avg_score >= 25 ? "amber" : "green"} className="w-16 justify-center">avg {Math.round(c.avg_score)}</Badge>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="min-w-0">
            <CardHeader title="By severity" subtitle="Total and still open" icon={BarChart3} />
            <CardBody className="space-y-3">
              {a.by_severity.map((s) => (
                <div key={s.severity}>
                  <div className="mb-1 flex justify-between text-sm"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: SEV_HEX[s.severity] }} />{s.severity}</span><span className="text-muted"><b className="text-fg">{s.total}</b> · {s.open} open</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(s.total / Math.max(1, a.total)) * 100}%`, background: SEV_HEX[s.severity] }} /></div>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card className="min-w-0 xl:col-span-2">
            <CardHeader title="Team performance" subtitle="Jobs, completions, rejections and average ETA" icon={Gauge} />
            <CardBody>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                    <tr><th className="px-4 py-2.5 font-medium">Team</th><th className="px-3 py-2.5 text-right font-medium">Jobs</th><th className="px-3 py-2.5 text-right font-medium">Completed</th><th className="px-3 py-2.5 text-right font-medium">Rejected</th><th className="px-4 py-2.5 text-right font-medium">Avg ETA</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {a.team_performance.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No dispatches yet — assign a team from an incident.</td></tr>}
                    {[...a.team_performance].sort((x, y) => y.jobs - x.jobs).filter((t, k) => t.jobs > 0 || k < 6).slice(0, 10).map((t) => (
                      <tr key={t.team_id} className="bg-surface">
                        <td className="px-4 py-2.5"><p className="font-medium">{t.team_name}</p><p className="text-xs text-muted">{t.type_label}</p></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{t.jobs}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{t.completed}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular-nums", t.rejected ? "text-red-600 dark:text-red-400" : "text-muted")}>{t.rejected}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{t.avg_eta_min == null ? "—" : `${t.avg_eta_min.toFixed(1)} min`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
        <p className="mt-4 text-center text-xs text-muted">All times are measured from this demo&apos;s own data (seed incidents + live actions), not field results.</p>
      </>)}
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone, bar }: { icon: LucideIcon; label: string; value: ReactNode; sub: string; tone: "green" | "brand" | "red" | "blue"; bar?: number }) {
  const color = { green: "text-emerald-600 dark:text-emerald-400", brand: "text-brand-600 dark:text-brand-400", red: "text-red-600 dark:text-red-400", blue: "text-sky-600 dark:text-sky-400" }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">{label}</p><Icon className="size-4 text-muted" /></div>
      <p className={cn("mt-2 font-display text-3xl font-semibold", color)}>{value}</p>
      {bar !== undefined && <ProgressBar value={bar} tone={tone === "green" ? "green" : "brand"} className="mt-2 h-1.5" />}
      <p className="mt-2 text-xs text-muted">{sub}</p>
    </Card>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
