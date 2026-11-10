import { Link, useNavigate } from "react-router-dom";
import { AlertOctagon, ArrowRight, CheckCircle2, Clock, Inbox, LayoutGrid, Map as MapIcon, PieChart, Plus, RefreshCw, Siren } from "lucide-react";
import { Badge, BarChartBox, Button, Card, CardBody, CardHeader, ChartLegend, DonutChartBox, EmptyState, Skeleton, StatTile } from "@/ui";
import { PageIntro } from "@/sections/AppShell";
import { CATEGORY_META, CategoryIcon, SEV_HEX, SeverityBadge, StatusBadge } from "@/sections/IncidentUI";
import { LazyMap } from "@/sections/LazyMap";
import { getIncidents, getStats, timeAgo } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Incident, Severity, Stats } from "@/lib/mock";

const SEV_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"];

export default function Dashboard() {
  const nav = useNavigate();
  const [stats, reloadStats, at] = usePoll<Stats>(getStats);
  const [list, reloadList] = usePoll<Incident[]>(() => getIncidents());
  const reload = () => { reloadStats(); reloadList(); };

  const open = (list ?? []).filter((i) => i.status !== "Resolved");
  const attention = open.filter((i) => i.severity === "Critical" || i.severity === "High").slice(0, 6);
  const points = (list ?? []).filter((i) => i.lat != null && i.lng != null)
    .map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, severity: i.severity, title: i.title, resolved: i.status === "Resolved" }));
  const sevData = SEV_ORDER.map((s) => ({ name: s, value: stats?.by_severity.find((x) => x.severity === s)?.count ?? 0 }));
  const catData = (stats?.by_category ?? []).map((c) => ({ label: CATEGORY_META[c.category]?.short ?? c.label, Incidents: c.count }));

  return (
    <>
      <PageIntro title="Control room" text={`Chennai · live incident picture${at ? ` · updated ${fmtTime(at)}` : ""}`}
        actions={<>
          <Button variant="outline" icon={RefreshCw} onClick={reload}>Refresh</Button>
          <Link to="/app/report"><Button icon={Plus}>New report</Button></Link>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats ? (<>
          <StatTile label="Total reported incidents" value={stats.total} icon={Inbox} />
          <StatTile label="Critical (open)" value={stats.critical} icon={AlertOctagon}
            className={cn(stats.critical > 0 && "border-red-300 bg-red-50/70 ring-1 ring-red-200 dark:border-red-900 dark:bg-red-950/40 dark:ring-red-900 [&_.font-display]:text-red-600 dark:[&_.font-display]:text-red-400")} />
          <StatTile label="Pending (awaiting action)" value={stats.pending} icon={Clock}
            className="[&_.font-display]:text-amber-600 dark:[&_.font-display]:text-amber-400" />
          <StatTile label="Resolved" value={stats.resolved} icon={CheckCircle2}
            className="[&_.font-display]:text-emerald-600 dark:[&_.font-display]:text-emerald-400" />
        </>) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Live incident map" subtitle="Colour = severity · click a dot to open" icon={MapIcon}
            action={<div className="hidden gap-3 text-xs text-muted sm:flex">{SEV_ORDER.map((s) => <span key={s} className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: SEV_HEX[s] }} />{s}</span>)}</div>} />
          <CardBody><LazyMap height={420} points={points} onSelect={(id) => nav(`/app/incidents/${id}`)} /></CardBody>
        </Card>
        <Card className="flex min-w-0 flex-col">
          <CardHeader title="Needs attention" subtitle="Open Critical & High, highest first" icon={Siren}
            action={<Badge tone="red" dot pulse>{attention.length}</Badge>} />
          <CardBody className="flex-1 space-y-2">
            {!list && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            {list && attention.length === 0 && <EmptyState icon={CheckCircle2} title="All clear" text="No open Critical or High incidents." />}
            {attention.map((i) => (
              <Link key={i.id} to={`/app/incidents/${i.id}`}
                className={cn("flex items-center gap-3 rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-soft",
                  i.severity === "Critical" ? "row-critical border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30" : "border-line bg-surface")}>
                <CategoryIcon category={i.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.title}</p>
                  <p className="truncate text-xs text-muted">{i.id} · {i.area} · {timeAgo(i.created_at)}</p>
                </div>
                <SeverityBadge severity={i.severity} score={i.score} />
              </Link>
            ))}
            {list && <Link to="/app/incidents" className="flex items-center justify-center gap-1 pt-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">View all incidents <ArrowRight className="size-4" /></Link>}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Incidents by category" subtitle="All reports, all statuses" icon={LayoutGrid} />
          <CardBody>{stats ? <BarChartBox data={catData} x="label" series={[{ key: "Incidents", color: "var(--color-brand-500)" }]} height={280} /> : <Skeleton className="h-[280px]" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="By severity" subtitle="Share of all reports" icon={PieChart} />
          <CardBody>
            {stats ? (<>
              <DonutChartBox data={sevData} colors={SEV_ORDER.map((s) => SEV_HEX[s])} center={{ value: String(stats.total), label: "incidents" }} height={210} />
              <div className="mt-3"><ChartLegend colors={SEV_ORDER.map((s) => SEV_HEX[s])} items={sevData.map((d) => ({ label: d.name, value: String(d.value) }))} /></div>
            </>) : <Skeleton className="h-[280px]" />}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Latest reports" subtitle="Most recent first" icon={Inbox} />
        <CardBody className="space-y-1">
          {[...(list ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map((i) => (
            <Link key={i.id} to={`/app/incidents/${i.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
              <CategoryIcon category={i.category} className="size-8" />
              <span className="hidden w-20 shrink-0 font-mono text-xs text-muted sm:block">{i.id}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{i.title}</span>
              <span className="hidden text-xs text-muted sm:block">{timeAgo(i.created_at)}</span>
              <StatusBadge status={i.status} />
            </Link>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
