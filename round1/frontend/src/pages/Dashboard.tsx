import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertOctagon, ArrowRight, Bell, CheckCircle2, ClipboardList, Clock, Copy, Flame, HeartPulse, LayoutGrid, LifeBuoy, Map as MapIcon, PieChart, QrCode, RotateCcw, Search, Shield, Siren, Timer, Truck, UserPlus, Users, Zap } from "lucide-react";
import { BarChartBox, Button, Card, CardBody, CardHeader, ChartLegend, DonutChartBox, EmptyState, Skeleton, useToast } from "@/ui";
import { CATEGORIES, CATEGORY_META, CategoryIcon, SEV_HEX } from "@/sections/IncidentUI";
import { LazyMap } from "@/sections/LazyMap";
import { errText, getAnalytics, getEscalations, getIncidents, getStats, getTeams, getZones, resetDemo, simulateFlood } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/cn";
import type { Analytics, Category, Escalation, Incident, Severity, Stats, Team, TeamType } from "@/lib/mock";

const SEV_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"];
const PRIO: Record<Severity, { p: string; cls: string }> = {
  Critical: { p: "P1", cls: "bg-red-600 text-white" },
  High: { p: "P2", cls: "bg-orange-500 text-white" },
  Medium: { p: "P3", cls: "bg-amber-400 text-amber-950" },
  Low: { p: "P4", cls: "bg-emerald-500 text-white" },
};
const GROUPS: { label: string; types: TeamType[]; icon: typeof Flame; tone: string }[] = [
  { label: "Fire & Rescue", types: ["fire"], icon: Flame, tone: "text-red-600 bg-red-50 dark:bg-red-950/40" },
  { label: "Medical (EMS)", types: ["ambulance_als", "ambulance_bls"], icon: HeartPulse, tone: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  { label: "Police", types: ["police"], icon: Shield, tone: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  { label: "Disaster Response", types: ["ndrf", "boat"], icon: LifeBuoy, tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
];
const waitMin = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Flame; label: string; value: string; sub: string; tone: "red" | "rose" | "blue" | "green" }) {
  const t = {
    red: "border-red-200 bg-red-50/70 text-red-600 dark:border-red-900 dark:bg-red-950/40",
    rose: "border-rose-200 bg-rose-50/70 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40",
    blue: "border-sky-200 bg-sky-50/70 text-sky-600 dark:border-sky-900 dark:bg-sky-950/40",
    green: "border-emerald-200 bg-emerald-50/70 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40",
  }[tone];
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border p-4 shadow-sm", t)}>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white shadow-sm dark:bg-surface"><Icon className="size-6" /></span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-600 dark:text-muted">{label}</p>
        <p className="font-display text-3xl font-bold leading-tight">{value}</p>
        <p className="truncate text-xs text-slate-500 dark:text-muted">{sub}</p>
      </div>
    </div>
  );
}

function Clock2() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="text-right">
      <p className="text-sm font-semibold">{now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</p>
      <p className="font-mono text-xs text-muted">{now.toLocaleTimeString("en-IN")} IST</p>
    </div>
  );
}

function QrArt() {
  const n = 21;
  const cells: [number, number][] = [];
  const finder = (r: number, c: number) => [[0, 0], [0, n - 7], [n - 7, 0]].some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!finder(r, c) && ((r * 7 + c * 13 + r * c) % 5 < 2)) cells.push([r, c]);
  const F = ([r, c]: number[]) => (<g key={`${r}-${c}`}><rect x={c} y={r} width={7} height={7} fill="currentColor" /><rect x={c + 1} y={r + 1} width={5} height={5} fill="white" /><rect x={c + 2} y={r + 2} width={3} height={3} fill="currentColor" /></g>);
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="size-28 shrink-0 rounded-lg bg-white p-1 text-[#0f1b33] ring-1 ring-slate-200" aria-label="QR code for citizen reporting">
      {[[0, 0], [0, n - 7], [n - 7, 0]].map(F)}
      {cells.map(([r, c]) => <rect key={`${r}.${c}`} x={c} y={r} width={1} height={1} fill="currentColor" />)}
    </svg>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const toast = useToast();
  const [stats, reloadStats] = usePoll<Stats>(getStats);
  const [list, reloadList] = usePoll<Incident[]>(() => getIncidents());
  const [teams, reloadTeams] = usePoll<Team[]>(getTeams);
  const [an, reloadAn] = usePoll<Analytics>(getAnalytics);
  const [esc, reloadEsc] = usePoll<Escalation[]>(getEscalations);
  const [zones] = usePoll(getZones);
  const reload = () => { reloadStats(); reloadList(); reloadTeams(); reloadAn(); reloadEsc(); };
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"" | Category>("");
  const [sev, setSev] = useState<"" | Severity>("");
  const [heat, setHeat] = useState(false);

  async function simulate() {
    setBusy("sim");
    try { const r = await simulateFlood(); toast("warning", `Disaster simulated: ${r.created.length} new reports`, "Velachery · Tambaram · Adyar — watch the queue and escalations"); reload(); }
    catch (e) { toast("error", "Could not simulate", errText(e)); }
    finally { setBusy(null); }
  }
  async function reset() {
    setBusy("reset");
    try { const r = await resetDemo(); toast("success", "Demo data restored", `${r.incidents} incidents`); reload(); }
    catch (e) { toast("error", "Could not reset", errText(e)); }
    finally { setBusy(null); }
  }

  const open = (list ?? []).filter((i) => i.status !== "Resolved");
  const p1 = open.filter((i) => i.severity === "Critical").length;
  const queue = [...open].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity) || b.score - a.score || a.created_at.localeCompare(b.created_at)).slice(0, 5);
  const ql = q.trim().toLowerCase();
  const points = (list ?? [])
    .filter((i) => i.lat != null && i.lng != null)
    .filter((i) => (!cat || i.category === cat) && (!sev || i.severity === sev) && (!ql || `${i.area} ${i.landmark} ${i.title}`.toLowerCase().includes(ql)))
    .map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, severity: i.severity, title: i.title, resolved: i.status === "Resolved" }));
  const avail = teams?.filter((t) => t.status === "available").length ?? 0;
  const sevData = SEV_ORDER.map((s) => ({ name: s, value: stats?.by_severity.find((x) => x.severity === s)?.count ?? 0 }));
  const catData = (stats?.by_category ?? []).map((c) => ({ label: CATEGORY_META[c.category]?.short ?? c.label, Incidents: c.count }));
  const topEsc = esc?.find((e) => e.level === "critical") ?? esc?.[0];
  const link = `${window.location.origin}/report`;
  const sel = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm dark:border-line dark:bg-surface";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Command Centre</h2>
          <p className="mt-1 text-muted">Real-time situational awareness and incident management</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Clock2 />
          <Button icon={Siren} loading={busy === "sim"} onClick={simulate} className="bg-red-600 text-white hover:bg-red-700">Simulate Disaster</Button>
          <Button variant="outline" icon={RotateCcw} loading={busy === "reset"} onClick={reset} title="Restore the seed incidents">Reset Demo</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats && teams ? (<>
          <Kpi icon={AlertOctagon} tone="red" label="Active Incidents" value={String(stats.total - stats.resolved)} sub={`${stats.pending} pending · ${stats.in_progress} in progress`} />
          <Kpi icon={Zap} tone="rose" label="P1 Critical" value={String(p1)} sub="Open life-threatening incidents" />
          <Kpi icon={Timer} tone="blue" label="Avg. Time to Assign" value={an?.avg_time_to_assign_min != null ? `${an.avg_time_to_assign_min.toFixed(1)} min` : "—"} sub={an?.critical_avg_time_to_assign_min != null ? `P1: ${an.critical_avg_time_to_assign_min.toFixed(1)} min` : "From real assignments"} />
          <Kpi icon={Users} tone="green" label="Teams Available" value={`${avail} / ${teams.length}`} sub={`${teams.filter((t) => t.status === "busy").length} on active missions`} />
        </>) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader title="Live Incident Map" subtitle="Chennai · click a dot to open" icon={MapIcon}
            action={<div className="hidden gap-3 text-xs text-muted md:flex">{SEV_ORDER.map((s) => <span key={s} className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: SEV_HEX[s] }} />{PRIO[s].p} {s}</span>)}</div>} />
          <CardBody>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="relative min-w-40 flex-1">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search location" className={cn(sel, "w-full pl-8")} />
              </label>
              <select value={cat} onChange={(e) => setCat(e.target.value as Category | "")} className={sel} aria-label="Category">
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
              </select>
              <select value={sev} onChange={(e) => setSev(e.target.value as Severity | "")} className={sel} aria-label="Priority">
                <option value="">All Priorities</option>
                {SEV_ORDER.map((s) => <option key={s} value={s}>{PRIO[s].p} · {s}</option>)}
              </select>
              <button onClick={() => setHeat(!heat)} className={cn("flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium", heat ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" : "border-slate-200 bg-white dark:border-line dark:bg-surface")}>
                <span className={cn("relative h-4 w-7 rounded-full transition", heat ? "bg-red-600" : "bg-slate-300")}><span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", heat ? "left-3.5" : "left-0.5")} /></span>Heatmap
              </button>
            </div>
            <LazyMap height={400} points={points} onSelect={(id) => nav(`/admin/incidents/${id}`)}
              zones={heat ? (zones ?? []).map((z) => ({ id: z.id, lat: z.lat, lng: z.lng, status: z.status, label: z.area })) : undefined} />
            <p className="mt-2 text-xs text-muted">{points.length} incident{points.length === 1 ? "" : "s"} shown{heat ? " · zone risk overlay on" : ""}</p>
          </CardBody>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Card className="min-w-0">
            <CardHeader title="Priority Queue" subtitle="Top open incidents by priority" icon={ClipboardList} />
            <CardBody className="pt-0">
              {!list ? <Skeleton className="h-52" /> : queue.length === 0 ? <EmptyState icon={CheckCircle2} title="All clear" text="No open incidents." /> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-2">#</th><th className="py-2 pr-2">Type</th><th className="py-2 pr-2">Location</th><th className="py-2 pr-2">Priority</th><th className="py-2 text-right">Waiting</th></tr></thead>
                  <tbody>
                    {queue.map((i, k) => (
                      <tr key={i.id} onClick={() => nav(`/admin/incidents/${i.id}`)} className={cn("cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-line dark:hover:bg-surface-2", i.severity === "Critical" && "bg-red-50/50 dark:bg-red-950/20")}>
                        <td className="py-2 pr-2 font-mono text-xs text-muted">{k + 1}</td>
                        <td className="py-2 pr-2"><CategoryIcon category={i.category} className="size-7" /></td>
                        <td className="max-w-0 py-2 pr-2"><p className="truncate font-medium">{i.area}</p><p className="truncate text-xs text-muted">{CATEGORY_META[i.category]?.short ?? i.category}</p></td>
                        <td className="py-2 pr-2"><span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", PRIO[i.severity].cls)}>{PRIO[i.severity].p}</span></td>
                        <td className="py-2 text-right font-mono text-xs"><span className={cn(waitMin(i.created_at) > 15 && i.severity === "Critical" && "font-bold text-red-600")}>{waitMin(i.created_at)} min</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Link to="/admin/incidents" className="mt-2 flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">View All Incidents <ArrowRight className="size-4" /></Link>
            </CardBody>
          </Card>
          {topEsc && (
            <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-600 to-red-700 p-4 text-white shadow-lg shadow-red-900/20">
              <div className="flex items-center gap-2"><span className="relative grid place-items-center"><span className="absolute size-6 animate-ping rounded-full bg-white/30" /><Bell className="relative size-5" /></span><p className="font-semibold">Escalation Alert</p><span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{esc!.length} active</span></div>
              <p className="mt-2 text-sm text-red-50">{topEsc.message}</p>
              <Link to={topEsc.incident_id ? `/admin/incidents/${topEsc.incident_id}` : "/admin/incidents"} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">View Details <ArrowRight className="size-4" /></Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Response Teams (Live)" subtitle="Available / total by unit type" icon={Truck}
            action={<Link to="/admin/teams" className="text-sm font-medium text-red-600 hover:underline">Open</Link>} />
          <CardBody className="grid grid-cols-2 gap-3 pt-0">
            {!teams ? <Skeleton className="col-span-2 h-40" /> : GROUPS.map((g) => {
              const all = teams.filter((t) => g.types.includes(t.type));
              const a = all.filter((t) => t.status === "available").length;
              return (
                <Link key={g.label} to="/admin/teams" className="rounded-xl border border-slate-200 p-3 transition hover:-translate-y-0.5 hover:shadow-md dark:border-line">
                  <div className="flex items-center gap-2"><span className={cn("grid size-8 place-items-center rounded-lg", g.tone)}><g.icon className="size-4" /></span><p className="text-sm font-medium leading-tight">{g.label}</p></div>
                  <p className="mt-2 font-display text-2xl font-bold">{a}<span className="text-base font-medium text-muted">/{all.length}</span></p>
                  <p className={cn("text-xs font-semibold", a ? "text-emerald-600" : "text-red-600")}>{a} Available</p>
                </Link>
              );
            })}
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Incident Quick Actions" icon={Zap} />
          <CardBody className="space-y-2 pt-0">
            {[
              { to: "/admin/incidents", label: "Assign Team", text: "Dispatch nearest unit", icon: UserPlus, cls: "bg-red-600 text-white" },
              { to: "/admin/teams", label: "Request Resources", text: "Boats, NDRF, ambulances", icon: Truck, cls: "bg-[#0f1b33] text-white" },
              { to: "/admin/alerts", label: "Send Alert", text: "Warn citizens in a zone", icon: Bell, cls: "bg-amber-500 text-white" },
            ].map((a) => (
              <Link key={a.label} to={a.to} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 transition hover:bg-slate-50 dark:border-line dark:hover:bg-surface-2">
                <span className={cn("grid size-9 place-items-center rounded-lg", a.cls)}><a.icon className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{a.label}</span><span className="block truncate text-xs text-muted">{a.text}</span></span>
                <ArrowRight className="size-4 text-muted" />
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Citizen Reporting Link" subtitle="Scan or share — works on any phone on the LAN" icon={QrCode} />
          <CardBody className="flex items-center gap-4 pt-0">
            <QrArt />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Report an emergency</p>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-line dark:bg-surface-2">
                <code className="min-w-0 flex-1 truncate text-sm font-semibold">{link}</code>
                <button onClick={() => { navigator.clipboard?.writeText(link).then(() => toast("success", "Link copied", link), () => toast("error", "Copy failed", link)); }} className="grid size-8 shrink-0 place-items-center rounded-md bg-red-600 text-white hover:bg-red-700" aria-label="Copy link"><Copy className="size-4" /></button>
              </div>
              <p className="mt-2 text-xs text-muted">Citizens get a 30-second form with GPS, photo and instant AI severity — no app install.</p>
              <Link to="/report" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline">Open citizen view <ArrowRight className="size-4" /></Link>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Incidents by category" subtitle="All reports, all statuses" icon={LayoutGrid} />
          <CardBody>{stats ? <BarChartBox data={catData} x="label" series={[{ key: "Incidents", color: "var(--color-brand-500)" }]} height={260} /> : <Skeleton className="h-[260px]" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="By severity" subtitle="Share of all reports" icon={PieChart} />
          <CardBody>
            {stats ? (<>
              <DonutChartBox data={sevData} colors={SEV_ORDER.map((s) => SEV_HEX[s])} center={{ value: String(stats.total), label: "incidents" }} height={200} />
              <div className="mt-3"><ChartLegend colors={SEV_ORDER.map((s) => SEV_HEX[s])} items={sevData.map((d) => ({ label: d.name, value: String(d.value) }))} /></div>
            </>) : <Skeleton className="h-[260px]" />}
          </CardBody>
        </Card>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><Clock className="size-3.5" />Auto-refresh every 5 s · {open.length} open · {stats?.resolved ?? 0} resolved</p>
    </>
  );
}
