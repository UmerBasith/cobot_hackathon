import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronRight, Clock, Copy, FileText, Gauge, History, Image as ImageIcon, MapPin, Megaphone, MessageSquare,
  Navigation, ShieldAlert, Timer, Trash2, Truck, TrendingUp, Users, XCircle, Activity, Route,
} from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Select, Skeleton, Tabs, useToast } from "@/ui";
import { CATEGORY_META, SeverityBadge, StatusBadge } from "@/sections/IncidentUI";
import { LazyMap } from "@/sections/LazyMap";
import { DeleteModal } from "./Incidents";
import { ASG_META, DispatchCard, SimilarCard, TeamIcon } from "@/sections/Dispatch";
import { assignTeams, createAlert, deleteIncident, errText, getIncident, getIncidents, getSuggest, getTeams, markDuplicate, timeAgo, updateStatus } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { STATIC } from "@/lib/static";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { STATUSES, type Incident, type Severity, type Status, type SuggestSlot, type Team } from "@/lib/mock";

const ACTION: Record<Status, string> = { Reported: "Mark reported", Pending: "Verify → Pending", "In Progress": "Dispatch → In Progress", Resolved: "Resolve" };
const PRIO: Record<Severity, { p: string; label: string; sla: number; pill: string }> = {
  Critical: { p: "P1", label: "Critical", sla: 15, pill: "bg-red-600 text-white" },
  High: { p: "P2", label: "High", sla: 30, pill: "bg-orange-500 text-white" },
  Medium: { p: "P3", label: "Medium", sla: 60, pill: "bg-amber-400 text-amber-950" },
  Low: { p: "P4", label: "Low", sla: 120, pill: "bg-emerald-500 text-white" },
};
type Tab = "overview" | "assignment" | "communication" | "audit";

function useElapsed(from: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (STATIC) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return { text: m >= 100 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`, min: m };
}

function PrioPill({ sev, className }: { sev: Severity; className?: string }) {
  const p = PRIO[sev];
  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap", p.pill, className)}>{p.p} – {p.label}</span>;
}

export default function IncidentDetail() {
  const { id = "" } = useParams();
  const toast = useToast();
  const nav = useNavigate();
  const [inc, reload] = usePoll<Incident | null>(() => getIncident(id), 5000, [id]);
  const [all] = usePoll<Incident[]>(() => getIncidents(), 15000);
  const [teams] = usePoll<Team[]>(() => getTeams(), 10000);
  const [tab, setTab] = useState<Tab>("overview");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dup, setDup] = useState("");
  const [del, setDel] = useState(false);
  const [slots, setSlots] = useState<SuggestSlot[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const elapsed = useElapsed(inc?.created_at ?? new Date().toISOString());

  const sig = inc ? `${inc.id}|${inc.status}|${inc.assignments.map((a) => a.id + a.status).join(",")}` : "";
  useEffect(() => {
    if (!inc) return; let on = true;
    getSuggest(inc).then((s) => { if (!on) return; setSlots(s); setPicked(s.map((x) => x.best).filter((x): x is string => !!x)); });
    return () => { on = false; };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const readiness = useMemo(() => {
    const g = new Map<string, { label: string; avail: number; total: number; type: Team["type"] }>();
    for (const t of teams ?? []) {
      const k = t.type_label || t.type;
      const e = g.get(k) ?? { label: k, avail: 0, total: 0, type: t.type };
      e.total++; if (t.status === "available") e.avail++; g.set(k, e);
    }
    return [...g.values()];
  }, [teams]);

  if (inc === null && all) {
    return <EmptyState icon={FileText} title={`Incident ${id} not found`} text="It may have been deleted." action={<Link to="/app/incidents"><Button variant="outline" icon={ArrowLeft}>Back to incidents</Button></Link>} />;
  }
  if (!inc) return <div className="space-y-4"><Skeleton className="h-28 rounded-2xl" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div></div>;

  const pr = PRIO[inc.severity];
  const overSla = elapsed.min >= pr.sla && inc.status !== "Resolved";
  const activeIds = inc.assignments.filter((a) => !["rejected", "completed"].includes(a.status)).map((a) => a.team_id);
  const first = inc.assignments.find((a) => !["rejected", "completed"].includes(a.status)) ?? inc.assignments[0];
  const firstTeam = first ? (teams ?? []).find((t) => t.id === first.team_id) : undefined;
  const others = (all ?? []).filter((x) => x.id !== inc.id);
  const citizens = (inc.witnesses ?? 0) + 1;
  const tl = [...inc.timeline].reverse();

  async function setStatus(s: Status, n?: string, msg?: string) {
    setBusy(s + (msg ?? ""));
    try { await updateStatus(inc!.id, s, (n ?? note).trim() || undefined); setNote(""); toast("success", msg ?? `${inc!.id} → ${s}`, n || note || undefined); await reload(); }
    catch (e) { toast("error", "Could not update status", errText(e)); }
    finally { setBusy(null); }
  }
  async function assign(ids: string[], key: string) {
    const free = ids.filter((x) => !activeIds.includes(x));
    if (!free.length) { toast("info", "Already assigned", "Selected teams are already on this incident"); return; }
    setBusy(key);
    try { await assignTeams(inc!.id, free); toast("success", `Dispatched ${free.length} team${free.length > 1 ? "s" : ""}`, `${inc!.id} → In Progress`); await reload(); }
    catch (e) { toast("error", "Could not assign", errText(e)); }
    finally { setBusy(null); }
  }
  async function broadcast() {
    setBusy("alert");
    try { await createAlert({ area: inc!.area, message: `${inc!.title} — avoid the area, follow official instructions.`, level: inc!.severity === "Critical" ? "danger" : "warning", hours: 2 }); toast("success", "Alert broadcast", `Citizens in ${inc!.area} notified`); }
    catch (e) { toast("error", "Could not broadcast", errText(e)); }
    finally { setBusy(null); }
  }
  async function doDup() {
    if (!dup) return;
    setBusy("dup");
    try { await markDuplicate(inc!.id, dup); toast("success", `Marked as duplicate of ${dup}`, "Status set to Resolved"); setDup(""); await reload(); }
    catch (e) { toast("error", "Could not mark duplicate", errText(e)); }
    finally { setBusy(null); }
  }
  async function doDelete() {
    setBusy("del");
    try { await deleteIncident(inc!.id); toast("success", `${inc!.id} deleted`); nav("/app/incidents"); }
    catch (e) { toast("error", "Could not delete", errText(e)); setBusy(null); }
  }

  // workflow stepper
  const atOf = (s: Status) => inc.timeline.find((t) => t.status === s)?.at;
  const has = (st: string[]) => inc.assignments.find((a) => st.includes(a.status));
  const idx = STATUSES.indexOf(inc.status);
  const steps = [
    { label: "Reported", done: true, at: inc.created_at },
    { label: "Verified", done: idx >= 1, at: atOf("Pending"), pending: idx < 1 },
    { label: "Assigned", done: inc.assignments.length > 0 || idx >= 2, at: inc.assignments[0]?.assigned_at ?? atOf("In Progress") },
    { label: "En Route", done: !!has(["en_route", "on_scene", "completed"]) || idx >= 3, at: has(["en_route", "on_scene", "completed"])?.updated_at },
    { label: "On Site", done: !!has(["on_scene", "completed"]) || idx >= 3, at: has(["on_scene", "completed"])?.updated_at },
    { label: "Resolved", done: inc.status === "Resolved", at: atOf("Resolved") },
  ];
  const cur = steps.findIndex((s) => !s.done);

  const mapPoints = inc.lat != null && inc.lng != null ? [{ id: inc.id, lat: inc.lat, lng: inc.lng, severity: inc.severity, title: inc.title, resolved: inc.status === "Resolved" }] : [];
  const teamPts = firstTeam ? [{ id: firstTeam.id, lat: firstTeam.lat, lng: firstTeam.lng, label: firstTeam.name, status: firstTeam.status }] : [];
  const maxPts = Math.max(1, ...inc.reasons.map((r) => Math.abs(r.points)));

  const quick = [
    { key: "assign", icon: Truck, label: "Assign Team", sub: "All suggested", tone: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900", run: () => assign(picked.length ? picked : (slots ?? []).map((s) => s.best).filter((x): x is string => !!x), "assign"), disabled: inc.status === "Resolved" },
    { key: "Pending⚑", icon: TrendingUp, label: "Escalate", sub: "Flag to supervisor", tone: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900", run: () => setStatus(inc.status === "Reported" ? "Pending" : inc.status, "Escalated to supervisor", "Incident escalated"), disabled: inc.status === "Resolved" },
    { key: "alert", icon: Megaphone, label: "Broadcast Alert", sub: inc.area, tone: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900", run: broadcast, disabled: false },
    { key: "Resolved✓", icon: XCircle, label: "Close Incident", sub: "Mark resolved", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900", run: () => setStatus("Resolved", note.trim() || "Closed from command centre", "Incident closed"), disabled: inc.status === "Resolved" },
  ];
  const quickKey = (k: string) => (k === "Pending⚑" ? busy?.endsWith("Incident escalated") : k === "Resolved✓" ? busy?.endsWith("Incident closed") : busy === k);

  const timelineList = (items: typeof tl) => (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((t, k) => (
        <li key={k} className="relative">
          <span className={cn("absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-surface", t.status === "Resolved" ? "bg-emerald-500" : t.status === "In Progress" ? "bg-sky-500" : t.status === "Pending" ? "bg-amber-500" : "bg-red-500")} />
          <div className="flex flex-wrap items-baseline gap-x-2"><p className="text-sm font-semibold">{t.status}</p><span className="text-xs text-muted">{fmtTime(t.at)} · {t.actor}</span></div>
          <p className="text-sm text-muted">{t.note}</p>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-muted">
        <Link to="/app/incidents" className="hover:text-fg">Incidents</Link><ChevronRight className="size-3.5" /><span className="font-medium text-fg">{inc.id}</span>
      </nav>

      {/* Header */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <Card className={cn("rounded-2xl p-5", inc.severity === "Critical" && inc.status !== "Resolved" && "border-red-200 dark:border-red-900")}>
          <div className="flex items-start gap-4">
            <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30">
              {(() => { const I = CATEGORY_META[inc.category]?.icon ?? ShieldAlert; return <I className="size-6" />; })()}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight sm:text-2xl"><button className="mr-2 font-mono text-red-600 hover:underline dark:text-red-400" onClick={() => { navigator.clipboard?.writeText(inc.id); toast("info", "Copied", inc.id); }}>{inc.id}</button>{inc.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted"><Clock className="size-3.5" />Reported {timeAgo(inc.created_at)} · Citizens: {citizens} · Affected: {inc.people_affected} people</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <PrioPill sev={inc.severity} /><StatusBadge status={inc.status} />
                {inc.flags.includes("needs_verification") && <Badge tone="amber">Needs verification</Badge>}
                {inc.duplicate_of && <Badge tone="gray">Duplicate of {inc.duplicate_of}</Badge>}
                {inc.witnesses > 0 && <Badge tone="blue"><Users className="size-3" />{inc.witnesses} more report{inc.witnesses > 1 ? "s" : ""} · +{inc.witnesses * 3}</Badge>}
              </div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-3 gap-3 lg:contents">
          <Card className="rounded-2xl p-4 lg:w-48">
            <p className="text-xs font-medium text-muted">Priority Score</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{inc.score}<span className="text-sm font-medium text-muted"> / 100</span></p>
            <div className="mt-2 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, inc.score)}%` }} /></div>
          </Card>
          <Card className="rounded-2xl p-4 lg:w-40">
            <p className="text-xs font-medium text-muted">SLA Target</p>
            <p className="mt-1 text-2xl font-bold">≤ {pr.sla}<span className="text-sm font-medium text-muted"> min</span></p>
            <p className="mt-1 text-xs text-muted">{pr.p} response window</p>
          </Card>
          <Card className={cn("rounded-2xl p-4 lg:w-40", overSla && "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30")}>
            <p className="text-xs font-medium text-muted">Elapsed</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{inc.status === "Resolved" ? "Closed" : elapsed.text}</p>
            <p className="mt-1 text-xs text-muted">{overSla ? "SLA breached" : inc.status === "Resolved" ? "Resolved" : "Within SLA"}</p>
          </Card>
        </div>
      </div>

      <Tabs<Tab> className="mb-4 max-w-full overflow-x-auto" value={tab} onChange={setTab} tabs={[
        { value: "overview", label: "Overview", icon: Gauge }, { value: "assignment", label: "Assignment", icon: Truck },
        { value: "communication", label: "Communication", icon: MessageSquare }, { value: "audit", label: "Audit History", icon: History },
      ]} />

      {tab === "overview" && (
        <div className="grid gap-4 xl:grid-cols-3">
          {/* Map */}
          <Card className="overflow-hidden rounded-2xl xl:col-span-2">
            <div className="relative">
              {mapPoints.length ? <LazyMap height={390} points={mapPoints} teams={teamPts} /> : <div className="grid h-[390px] place-items-center bg-surface-2 text-sm text-muted"><MapPin className="mb-1 size-5" />Area: {inc.area}</div>}
                            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-red-600 shadow ring-1 ring-red-100 dark:bg-neutral-900/90"><span className="size-2 animate-pulse rounded-full bg-red-500" />Live Route</span>
              </div>
              {first && (
                <div className="pointer-events-none absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg ring-1 ring-line dark:bg-neutral-900/90">
                  <Navigation className="size-3.5 text-red-600" /><span className="font-semibold">{first.team_name}</span><span className="text-muted">ETA {Math.round(first.eta_min)} min · {first.distance_km} km</span>
                </div>
              )}
            </div>
          </Card>

          {/* Incident details */}
          <Card className="rounded-2xl">
            <CardHeader title="Incident Details" icon={FileText} />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Location", <>{inc.area}{inc.landmark ? <span className="text-muted"> · {inc.landmark}</span> : null}</>],
                  ["Category", CATEGORY_META[inc.category]?.label ?? inc.category],
                  ["Severity", <SeverityBadge severity={inc.severity} />],
                  ["Reported By", inc.anonymous ? "Anonymous" : "Citizen (App)"],
                  ["Time", `${fmtTime(inc.created_at)} · ${timeAgo(inc.created_at)}`],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex items-start justify-between gap-3"><dt className="shrink-0 text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">{inc.description}</p>
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-muted">Attachments</p>
                {inc.photo ? <img src={inc.photo} alt="Attached photo" className="h-20 w-28 rounded-lg object-cover ring-1 ring-line" />
                  : <p className="flex items-center gap-1.5 text-xs text-muted"><ImageIcon className="size-3.5" />No photo attached</p>}
              </div>
            </CardBody>
          </Card>

          {/* Workflow */}
          <Card className="rounded-2xl xl:col-span-2">
            <CardHeader title="Status & Workflow" icon={Activity} />
            <CardBody>
              <ol className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {steps.map((s, k) => (
                  <li key={s.label} className="relative text-center">
                    {k > 0 && <span className={cn("absolute right-1/2 top-4 hidden h-0.5 w-full sm:block", s.done ? "bg-emerald-500" : "bg-line")} />}
                    <span className={cn("relative mx-auto grid size-8 place-items-center rounded-full text-xs font-bold",
                      s.done ? "bg-emerald-500 text-white" : k === cur ? "bg-red-600 text-white ring-4 ring-red-100 dark:ring-red-950" : "bg-surface-2 text-muted")}>
                      {s.done ? <Check className="size-4" /> : k + 1}
                    </span>
                    <p className={cn("mt-1.5 text-xs font-semibold", !s.done && k !== cur && "text-muted")}>{s.label}{s.pending && !s.done ? <span className="block text-[10px] font-medium text-amber-600">(Pending)</span> : null}</p>
                    <p className="text-[11px] text-muted">{s.done && s.at ? fmtTime(s.at) : "—"}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          {/* Priority analysis */}
          <Card className="rounded-2xl xl:row-span-2">
            <CardHeader title="Priority Analysis" subtitle="Explainable — every point shown" icon={ShieldAlert} />
            <CardBody className="space-y-3">
              {inc.reasons.map((r, k) => (
                <div key={k}>
                  <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate">{r.label}</span><span className={cn("shrink-0 font-semibold tabular-nums", r.points < 0 ? "text-emerald-600" : "text-red-600")}>{r.points > 0 ? "+" : ""}{r.points}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={cn("h-1.5 rounded-full", r.points < 0 ? "bg-emerald-500" : "bg-gradient-to-r from-amber-400 to-red-500")} style={{ width: `${(Math.abs(r.points) / maxPts) * 100}%` }} /></div>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between rounded-xl border border-red-200 bg-red-50/70 p-3 dark:border-red-900 dark:bg-red-950/30">
                <div><p className="text-xs text-muted">Total Score</p><p className="text-2xl font-bold tabular-nums">{inc.score}<span className="text-sm font-medium text-muted">/100</span></p></div>
                <PrioPill sev={inc.severity} />
              </div>
            </CardBody>
          </Card>

          {/* Suggested teams */}
          <Card className="rounded-2xl">
            <CardHeader title="Suggested Response Teams" subtitle="Nearest right team, by ETA" icon={Route} />
            <CardBody className="space-y-2">
              {!slots ? <Skeleton className="h-24" /> : slots.length === 0 ? <p className="text-sm text-muted">No suggestion for this category.</p> : slots.flatMap((s) => s.candidates.slice(0, 2).map((c) => {
                const on = activeIds.includes(c.team.id); const chk = picked.includes(c.team.id);
                return (
                  <label key={s.slot + c.team.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border p-2", chk ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : "border-line")}>
                    <input type="checkbox" className="size-4 accent-red-600" checked={chk || on} disabled={on || inc.status === "Resolved"} onChange={() => setPicked((p) => chk ? p.filter((x) => x !== c.team.id) : [...p, c.team.id])} />
                    <TeamIcon type={c.team.type} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.team.name}</p><p className="text-xs text-muted">{s.slot}</p></div>
                    {on ? <Badge tone="green"><Check className="size-3" />Assigned</Badge> : <span className="shrink-0 text-right text-xs"><span className="block font-semibold">{Math.round(c.eta_min)} min</span><span className="text-muted">{c.distance_km} km</span></span>}
                  </label>
                );
              }))}
              {inc.status !== "Resolved" && <Button className="w-full bg-red-600 hover:bg-red-500" icon={Truck} disabled={!picked.filter((x) => !activeIds.includes(x)).length} loading={busy === "sel"} onClick={() => assign(picked, "sel")}>Assign Selected</Button>}
            </CardBody>
          </Card>

          {/* Assigned teams */}
          <Card className="rounded-2xl">
            <CardHeader title="Assigned Response Teams" icon={Truck} action={<Badge tone={activeIds.length ? "blue" : "red"}>{activeIds.length} active</Badge>} />
            <CardBody className="space-y-2">
              {inc.assignments.length === 0 ? <p className="text-sm text-muted">No team assigned yet.</p> : inc.assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-xl bg-surface-2 p-2">
                  <TeamIcon type={a.team_type} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.team_name}</p><p className="text-xs text-muted">ETA {Math.round(a.eta_min)} min · {a.distance_km} km</p></div>
                  <Badge tone={ASG_META[a.status].tone} dot pulse={a.status === "en_route"}>{ASG_META[a.status].label}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Readiness */}
          <Card className="rounded-2xl">
            <CardHeader title="Team Readiness (Live)" icon={Users} />
            <CardBody className="space-y-2.5">
              {!teams ? <Skeleton className="h-24" /> : readiness.map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><TeamIcon type={r.type} className="size-6 [&_svg]:size-3.5" />{r.label}</span><span className="font-semibold tabular-nums">{r.avail}/{r.total}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className={cn("h-1.5 rounded-full", r.avail === 0 ? "bg-red-500" : r.avail / r.total < 0.5 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${(r.avail / Math.max(1, r.total)) * 100}%` }} /></div>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Comms log */}
          <Card className="rounded-2xl">
            <CardHeader title="Communication Log" icon={MessageSquare} action={<button className="text-xs font-medium text-red-600 hover:underline" onClick={() => setTab("communication")}>View all</button>} />
            <CardBody>{timelineList(tl.slice(0, 3))}</CardBody>
          </Card>

          {/* Quick actions */}
          <Card className="rounded-2xl xl:col-span-2">
            <CardHeader title="Quick Actions" icon={Timer} />
            <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quick.map((q) => (
                <button key={q.key} disabled={q.disabled || !!busy} onClick={q.run}
                  className={cn("flex flex-col items-start gap-2 rounded-2xl p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0", q.tone)}>
                  <q.icon className={cn("size-6", quickKey(q.key) && "animate-pulse")} />
                  <span><span className="block text-sm font-bold">{q.label}</span><span className="block truncate text-xs opacity-80">{q.sub}</span></span>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "assignment" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <DispatchCard inc={inc} onChange={reload} />
          <SimilarCard inc={inc} onChange={reload} />
        </div>
      )}

      {tab === "communication" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-2xl xl:col-span-2">
            <CardHeader title="Communication" subtitle="Every update, timestamped" icon={MessageSquare} />
            <CardBody>{timelineList(tl)}</CardBody>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader title="Update status" subtitle="Add a note, then move it forward" icon={Activity} />
            <CardBody className="space-y-3">
              <Input placeholder="Note e.g. Fire tender 2 dispatched" value={note} onChange={(e) => setNote(e.target.value)} />
              {STATUSES.filter((s) => s !== "Reported").map((s) => {
                const nextOne = STATUSES.indexOf(s) === idx + 1;
                return <Button key={s} className={cn("w-full", nextOne && "bg-red-600 hover:bg-red-500")} variant={nextOne ? "primary" : "outline"} disabled={inc.status === s} loading={busy === s} onClick={() => setStatus(s)}>{inc.status === s ? `${s} (current)` : STATUSES.indexOf(s) <= idx ? `Back to ${s}` : ACTION[s]}</Button>;
              })}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "audit" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="overflow-hidden rounded-2xl xl:col-span-2">
            <CardHeader title="Audit History" subtitle="Full trail of every change" icon={History} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Time</th><th className="px-4 py-2">Actor</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Note</th></tr></thead>
                <tbody>{tl.map((t, k) => (
                  <tr key={k} className="border-t border-line"><td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{fmtTime(t.at)}</td><td className="px-4 py-2 capitalize">{t.actor}</td><td className="px-4 py-2"><StatusBadge status={t.status} /></td><td className="px-4 py-2 text-muted">{t.note}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader title="Duplicate or test?" subtitle="Keep the queue clean" icon={Copy} />
            <CardBody className="space-y-3">
              <div className="flex gap-2">
                <Select value={dup} onChange={(e) => setDup(e.target.value)} className="min-w-0 flex-1"
                  options={[{ value: "", label: "Duplicate of…" }, ...others.map((o) => ({ value: o.id, label: `${o.id} · ${o.title.slice(0, 32)}` }))]} />
                <Button variant="outline" disabled={!dup} loading={busy === "dup"} onClick={doDup}>Mark</Button>
              </div>
              <Button variant="ghost" icon={Trash2} className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => setDel(true)}>Delete report</Button>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Mobile quick-action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-line bg-surface/95 p-2 backdrop-blur lg:hidden">
        {quick.map((q) => (
          <button key={q.key} disabled={q.disabled || !!busy} onClick={q.run} className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold disabled:opacity-40">
            <q.icon className="size-5 text-red-600" />{q.label}
          </button>
        ))}
      </div>

      <DeleteModal inc={del ? inc : null} busy={busy === "del"} onClose={() => setDel(false)} onConfirm={doDelete} />
    </div>
  );
}
