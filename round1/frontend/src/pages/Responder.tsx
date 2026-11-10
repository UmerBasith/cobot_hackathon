/** /responder — field team portal: dark navy sidebar (desktop), phone layout + bottom tab bar (mobile). */
import { BrandMark } from "@/sections/Logo";
import { logout } from "@/lib/auth";

const signOut = () => { logout("responder"); window.location.assign("/responder/login"); };
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bell, BarChart3, Boxes, CheckCircle2, ChevronDown, ClipboardList, Clock, Info, LayoutDashboard, MapPin,
  ArrowUp, LogOut, Pencil, MoreHorizontal, Send, Navigation, Phone, RefreshCw, Settings, ShieldAlert, Siren, Truck, Users, Wrench, X,
} from "lucide-react";
import { Button, Card, EmptyState, Skeleton, Textarea, useToast } from "@/ui";
import { CATEGORY_META, CategoryIcon, ReasonsList } from "@/sections/IncidentUI";
import { LazyMap } from "@/sections/LazyMap";
import { routeChip, toLines, useRoutes } from "@/lib/useRoutes";
import { assignmentStatus, errText, escalateAssignment, fieldUpdate, getActiveAlerts, getIncidents, getResponderJobs, getTeams, respondAssignment, timeAgo, type FieldTag, type NeedType } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Alert, AssignmentStatus, Incident, ResponderJob, Team, TeamType } from "@/lib/mock";

const REASONS = ["No equipment", "Too far", "Already busy", "Other"];
const KEY = "resq-team";
const CREW: Record<TeamType, number> = { fire: 6, ambulance_als: 4, ambulance_bls: 3, police: 4, ndrf: 8, boat: 4 };
const EQUIP: Record<TeamType, string> = { fire: "Hose, BA sets, cutter", ambulance_als: "Defib, O2, ventilator", ambulance_bls: "O2, stretcher, first aid", police: "Barricades, radio", ndrf: "Rescue kit, boats", boat: "Life jackets, ropes" };
const STATUS_LABEL: Record<AssignmentStatus, string> = { assigned: "Awaiting response", accepted: "Accepted", rejected: "Rejected", en_route: "En route", on_scene: "On scene", completed: "Completed" };
const ORDER: AssignmentStatus[] = ["assigned", "accepted", "en_route", "on_scene", "completed"];
const plate = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9000; return `TN 01 ${String.fromCharCode(65 + (h % 26))}${String.fromCharCode(65 + ((h >> 3) % 26))} ${1000 + h}`; };
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function Responder() {
  const [params, setParams] = useSearchParams();
  const [teams] = usePoll<Team[]>(getTeams, 15000);
  const [alerts] = usePoll<Alert[]>(() => getActiveAlerts(), 30000);
  const stored = (() => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } })();
  const team = params.get("team") ?? stored;
  const [jobs, reload, at] = usePoll<ResponderJob[]>(() => (team ? getResponderJobs(team) : Promise.resolve([])), 5000, [team]);
  const [incidents] = usePoll<Incident[]>(() => getIncidents(), 15000);

  function pick(id: string) {
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
    const p = new URLSearchParams(params); if (id) p.set("team", id); else p.delete("team"); setParams(p, { replace: true });
  }
  const me = teams?.find((t) => t.id === team);
  const active = (jobs ?? []).filter((j) => j.assignment.status !== "assigned").length;
  const queued = (jobs ?? []).filter((j) => j.assignment.status === "assigned").length;
  const doneToday = (incidents ?? []).reduce((n, i) => n + (i.assignments ?? []).filter((a) => a.team_id === team && a.status === "completed" && new Date(a.updated_at).toDateString() === new Date().toDateString()).length, 0);
  const current = jobs?.find((j) => j.assignment.status !== "assigned") ?? jobs?.[0];
  const others = (jobs ?? []).filter((j) => j !== current);
  const alertCount = alerts?.length ?? 0;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-bg dark:text-fg">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-[#0b1736] text-slate-300 lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <BrandMark tile className="size-10" />
          <div className="leading-tight"><p className="font-display text-lg font-bold text-white">ResQNet</p><p className="text-[11px] text-slate-400">Citizen Emergency Platform</p></div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3 text-sm">
          <SideItem icon={LayoutDashboard} label="Dashboard" active onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
          <SideItem icon={ClipboardList} label="My Assignments" count={jobs?.length || undefined} onClick={() => scrollTo("r-current")} />
          <SideItem icon={Users} label="Team Status" onClick={() => scrollTo("r-team")} />
          <SideItem icon={Bell} label="Alerts" count={alertCount || undefined} red onClick={() => scrollTo("r-timeline")} />
          <SideItem icon={BarChart3} label="Reports" onClick={() => scrollTo("r-details")} />
          <SideItem icon={Boxes} label="Resources" onClick={() => scrollTo("r-team")} />
          <SideItem icon={Settings} label="Settings" onClick={() => scrollTo("r-actions")} />
          <SideItem icon={LogOut} label="Log out" onClick={signOut} />
        </nav>
        <Link to="/admin" className="mx-3 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"><LayoutDashboard className="size-3.5" />Open control room</Link>
        <div className="border-t border-white/10 px-5 py-4 text-xs">
          <p className="flex items-center gap-2 font-medium text-emerald-400"><span className="size-2 animate-pulse rounded-full bg-emerald-400" />Connected</p>
          <p className="mt-0.5 text-slate-400">Last sync {at ? fmtTime(at) : "—"}</p>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-line dark:bg-surface/95">
          <div className="flex h-16 items-center gap-2 px-4 lg:px-6">
            <BrandMark tile className="size-9 p-1 lg:hidden" />
            <span className="hidden rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 sm:inline-flex dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">Responder Portal</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />On Duty</span>
            <span className="hidden items-center gap-1 text-xs text-slate-500 md:inline-flex"><MapPin className="size-3.5 text-red-600" />Chennai</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={signOut} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-surface-2" aria-label="Log out" title="Log out"><LogOut className="size-5" /></button>
              <button onClick={() => scrollTo("r-timeline")} className="relative grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-2" aria-label="Alerts">
                <Bell className="size-5" />{alertCount > 0 && <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white">{alertCount}</span>}
              </button>
              <label className="relative flex items-center">
                <Users className="pointer-events-none absolute left-2.5 size-4 text-slate-500" />
                <select value={team} onChange={(e) => pick(e.target.value)} aria-label="Your team"
                  className="h-9 max-w-[11rem] appearance-none truncate rounded-lg border border-slate-200 bg-white pr-8 pl-8 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none sm:max-w-none dark:border-line dark:bg-surface-2 dark:text-fg">
                  <option value="">{teams ? "Select team…" : "Loading…"}</option>
                  {(teams ?? []).map((t) => <option key={t.id} value={t.id}>Team {t.id}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 size-4 text-slate-500" />
              </label>
              <button onClick={reload} className="hidden size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 sm:grid dark:border-line" aria-label="Refresh"><RefreshCw className="size-4" /></button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] space-y-5 px-4 pt-5 pb-28 lg:px-6 lg:pb-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Responder Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-muted">Real-time assignments, navigation and response updates{me ? ` · ${me.name}` : ""}</p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
              <Kpi label="Active" value={active} tone="red" />
              <Kpi label="Queued" value={queued} tone="amber" />
              <Kpi label="Completed Today" value={doneToday} tone="green" />
            </div>
          </div>

          {!team ? <Card className="p-6"><EmptyState icon={Users} title="Pick your team" text="Choose your team in the top bar. Jobs assigned by the control room appear here within 5 seconds." /></Card>
            : !jobs ? <Skeleton className="h-96 rounded-2xl" />
            : !current ? (
              <div className="grid gap-5 lg:grid-cols-3">
                <Card className="p-6 lg:col-span-2"><EmptyState icon={CheckCircle2} title="No active assignment" text="Standing by. New dispatches from the control room appear here within 5 seconds." /></Card>
                {me && <TeamCard team={me} busy={false} />}
              </div>
            ) : (
              <>
                <CurrentJob key={current.assignment.id} job={current} team={me} onChange={reload} />
                {others.length > 0 && (
                  <Card className="p-4">
                    <p className="mb-2 text-sm font-semibold">Queued assignments ({others.length})</p>
                    <div className="space-y-4">{others.map((j) => <CurrentJob key={j.assignment.id} job={j} team={me} onChange={reload} compact />)}</div>
                  </Card>
                )}
              </>
            )}
        </main>
      </div>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-line dark:bg-surface">
        <Tab icon={LayoutDashboard} label="Dashboard" active onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <Tab icon={ClipboardList} label="Assignments" onClick={() => scrollTo("r-current")} />
        <Tab icon={Users} label="Team" onClick={() => scrollTo("r-team")} />
        <Tab icon={Bell} label="Alerts" badge={alertCount} onClick={() => scrollTo("r-timeline")} />
        <Tab icon={MoreHorizontal} label="More" onClick={() => scrollTo("r-actions")} />
      </nav>
    </div>
  );
}

function CurrentJob({ job, team, onChange, compact }: { job: ResponderJob; team?: Team; onChange: () => void; compact?: boolean }) {
  const toast = useToast();
  const { assignment: a, incident: i } = job;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [stamps, setStamps] = useState<Partial<Record<AssignmentStatus, string>>>({});
  useEffect(() => { setRejecting(false); setReason(""); setStamps((s) => (s[a.status] ? s : { ...s, [a.status]: a.updated_at })); }, [a.status, a.updated_at]);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { await fn(); toast("success", ok, `${i.id} · ${a.team_name}`); onChange(); }
    catch (e) { toast("error", "Action failed", errText(e)); }
    finally { setBusy(null); }
  }
  const routes = useRoutes(team && i.lat != null && i.lng != null && a.status !== "completed" && a.status !== "rejected"
    ? [{ id: a.id, from: { lat: team.lat, lng: team.lng }, to: { lat: i.lat, lng: i.lng }, label: team.name }] : []);
  const nav = i.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lng}` : null;
  const eta = Math.max(1, Math.round(a.eta_min));
  const sevTone = i.severity === "Critical" ? "bg-red-600 text-white" : i.severity === "High" ? "bg-orange-500 text-white" : i.severity === "Medium" ? "bg-amber-400 text-amber-950" : "bg-emerald-500 text-white";
  const next: { to: "en_route" | "on_scene"; label: string } | null = a.status === "accepted" ? { to: "en_route", label: "Start — en route" } : a.status === "en_route" ? { to: "on_scene", label: "Arrived — on scene" } : null;
  const acceptReject = a.status === "assigned" && (
    !rejecting ? (
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant="outline" icon={X} onClick={() => setRejecting(true)}>Reject</Button>
        <Button size="lg" icon={CheckCircle2} className="bg-emerald-600 shadow-none hover:bg-emerald-500" loading={busy === "acc"}
          onClick={() => run("acc", () => respondAssignment(a.id, true), "Job accepted")}>Accept</Button>
      </div>
    ) : (
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-line">
        <p className="text-sm font-medium">Why are you rejecting?</p>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)} className={cn("rounded-full px-3.5 py-1.5 text-sm ring-1 transition", reason === r ? "bg-red-600 text-white ring-red-600" : "bg-white ring-slate-200 dark:bg-surface dark:ring-line")}>{r}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
          <Button variant="danger" disabled={!reason} loading={busy === "rej"} onClick={() => run("rej", () => respondAssignment(a.id, false, reason), "Job rejected — control room notified")}>Confirm reject</Button>
        </div>
      </div>
    )
  );

  const header = (
    <Card id={compact ? undefined : "r-current"} className="scroll-mt-20 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-line">
        <p className="text-xs font-bold tracking-wider text-red-600 uppercase">{compact ? "Queued" : "Current Assignment"} <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 font-mono text-red-700 dark:bg-red-950/40 dark:text-red-300">{i.id}</span></p>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-surface-2 dark:text-fg">{STATUS_LABEL[a.status]}</span>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-start gap-4">
          <CategoryIcon category={i.category} className="size-14 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-xl leading-tight font-bold">{i.title}</p>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600 dark:text-muted"><MapPin className="mt-0.5 size-4 shrink-0 text-red-600" /><span><b className="text-slate-800 dark:text-fg">{i.area}</b>{i.landmark ? ` · ${i.landmark}` : ""}</span></p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={cn("rounded-full px-2.5 py-0.5 font-bold", sevTone)}>P{i.severity === "Critical" ? 1 : i.severity === "High" ? 2 : i.severity === "Medium" ? 3 : 4} · {i.severity}</span>
              <span className="text-slate-500 dark:text-muted">Assigned at {fmtTime(a.assigned_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 px-5 py-3 ring-1 ring-red-100 md:flex-col md:justify-center md:gap-0 dark:bg-red-950/30 dark:ring-red-900/50">
          <p className="text-xs font-semibold tracking-wider text-red-600 uppercase">ETA</p>
          <p className="font-display text-3xl font-bold text-red-700 dark:text-red-300">{eta} <span className="text-base font-semibold">min</span></p>
          <p className="text-xs text-red-600/80">{a.distance_km} km</p>
        </div>
      </div>
      <div className="space-y-3 border-t border-slate-100 px-5 py-4 dark:border-line">
        {acceptReject}
        <div className="grid grid-cols-3 gap-2">
          {nav ? <a href={nav} target="_blank" rel="noreferrer"><Button icon={Navigation} className="w-full bg-red-600 shadow-none hover:bg-red-500">Navigate</Button></a>
            : <Button icon={Navigation} disabled className="w-full">Navigate</Button>}
          <Link to={`/admin/incidents/${encodeURIComponent(i.id)}`}><Button variant="outline" icon={Info} className="w-full"><span className="sm:hidden">Details</span><span className="hidden sm:inline">View Details</span></Button></Link>
          <a href="tel:112"><Button variant="outline" icon={Phone} className="w-full"><span className="sm:hidden">Control</span><span className="hidden sm:inline">Contact Control</span></Button></a>
        </div>
      </div>
    </Card>
  );

  if (compact) return header;

  const steps = [
    { label: "Assigned", key: "assigned" as const, at: a.assigned_at },
    { label: "En Route", key: "en_route" as const, at: stamps.en_route },
    { label: "On Site", key: "on_scene" as const, at: stamps.on_scene },
    { label: "Resolved", key: "completed" as const, at: stamps.completed },
  ];
  const idx = ORDER.indexOf(a.status);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {header}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 py-3">
            <div className="min-w-0"><p className="font-semibold">Route to Incident</p>{routes[0] && <p className="truncate text-xs text-blue-700 dark:text-blue-300">{routeChip(routes[0])}</p>}</div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-surface-2"><Truck className="size-3.5" />{eta} min · {a.distance_km} km</span>
          </div>
          {i.lat != null && i.lng != null
            ? <LazyMap height={300} points={[{ id: i.id, lat: i.lat, lng: i.lng, severity: i.severity, title: i.title }]}
                teams={team ? [{ id: team.id, lat: team.lat, lng: team.lng, label: team.name, status: team.status }] : undefined} routes={toLines(routes)} />
            : <div className="grid h-40 place-items-center text-sm text-slate-500">No GPS location for this incident</div>}
        </Card>
        <Card id="r-details" className="scroll-mt-20 p-5">
          <p className="mb-3 font-semibold">Incident Details</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Detail k="Type" v={CATEGORY_META[i.category]?.label ?? i.category} />
            <Detail k="Severity" v={`${i.severity} · ${i.score}/100`} />
            <Detail k="Affected" v={`${i.people_affected} people`} />
            <Detail k="Reported" v={timeAgo(i.created_at)} />
          </dl>
          <div className="mt-4"><p className="text-xs font-medium tracking-wider text-slate-500 uppercase dark:text-muted">Remarks</p><p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm dark:bg-surface-2">{i.description}</p></div>
          {i.reasons.length > 0 && <div className="mt-4"><p className="mb-1.5 text-xs font-medium tracking-wider text-slate-500 uppercase dark:text-muted">Why {i.severity}</p><ReasonsList reasons={i.reasons.slice(0, 4)} compact /></div>}
        </Card>
      </div>

      <div className="space-y-5">
        {team && <TeamCard team={team} busy />}
        <QuickActions job={job} onChange={onChange} />
        <Card id="r-timeline" className="scroll-mt-20 p-5">
          <p className="mb-3 font-semibold">Incident Timeline</p>
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5 dark:border-line">
            {steps.map((s) => {
              const done = ORDER.indexOf(s.key) <= idx;
              const now = s.key === a.status || (s.key === "assigned" && a.status === "accepted");
              return (
                <li key={s.key} className="relative">
                  <span className={cn("absolute top-0.5 -left-[27px] size-3.5 rounded-full ring-4 ring-white dark:ring-surface", done ? (now ? "bg-red-600" : "bg-emerald-500") : "bg-slate-300 dark:bg-line")} />
                  <p className={cn("text-sm font-semibold", !done && "text-slate-400")}>{s.label}{now && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 uppercase dark:bg-red-950/40">Now</span>}</p>
                  <p className="text-xs text-slate-500 dark:text-muted"><Clock className="mr-1 inline size-3" />{done ? (s.at ? fmtTime(s.at) : fmtTime(a.updated_at)) : "Pending"}</p>
                </li>
              );
            })}
          </ol>
          {a.status === "accepted" && <p className="mt-3 text-xs text-emerald-600">Accepted at {fmtTime(a.updated_at)}</p>}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Quick Actions (as in the design mock-up): Update Status · Escalate · Complete Response.
 * Every action is saved on the server, so the control room (incident page + escalation banner) and the
 * citizen's tracking page show it within ~5 s (they refresh every 5 s).
 * ---------------------------------------------------------------------------------------------- */
const TAGS: { k: FieldTag; label: string }[] = [
  { k: "situation", label: "Situation update" }, { k: "contained", label: "Hazard contained" },
  { k: "rescued", label: "People rescued" }, { k: "casualty", label: "Casualty update" }, { k: "need_time", label: "Need more time" },
];
const ESC_REASONS = ["Fire spreading", "More casualties", "Structural collapse risk", "Gas / chemical risk", "Access blocked", "Need more crew"];
const NEEDS: { k: NeedType; label: string }[] = [
  { k: "fire", label: "Fire engine" }, { k: "rescue", label: "Rescue unit" }, { k: "ambulance", label: "Ambulance" }, { k: "police", label: "Police" },
  { k: "ndrf", label: "NDRF" }, { k: "boat", label: "Boat" }, { k: "hazmat", label: "HAZMAT" }, { k: "power", label: "Power board" },
];

function QuickActions({ job, onChange }: { job: ResponderJob; onChange: () => void }) {
  const toast = useToast();
  const { assignment: a, incident: i } = job;
  const [panel, setPanel] = useState<"update" | "escalate" | "complete" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tag, setTag] = useState<FieldTag>("situation");
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState("");
  const [needs, setNeeds] = useState<NeedType[]>([]);
  const [escNote, setEscNote] = useState("");
  const [closing, setClosing] = useState("");
  const active = a.status === "accepted" || a.status === "en_route" || a.status === "on_scene";
  const nextStage: { to: "en_route" | "on_scene"; label: string } | null =
    a.status === "accepted" ? { to: "en_route", label: "En route" } : a.status === "en_route" ? { to: "on_scene", label: "On scene" } : null;
  const escalatedPending = i.escalation && i.escalation.team_id === a.team_id;
  const myUpdates = i.timeline.filter((e) => e.actor === "responder" && e.note.includes(a.team_name)).slice(-3).reverse();

  async function run(key: string, fn: () => Promise<unknown>, ok: string, sub: string, after?: () => void) {
    setBusy(key);
    try { await fn(); toast("success", ok, sub); after?.(); onChange(); }
    catch (e) { toast("error", "Couldn't send", errText(e)); }
    finally { setBusy(null); }
  }
  function open(p: "update" | "escalate" | "complete") {
    if (!active) { toast("info", "Accept the job first", "Quick actions unlock after you accept the dispatch."); return; }
    setPanel((x) => (x === p ? null : p));
  }

  const tiles = [
    { k: "update" as const, icon: Pencil, label: "Update Status", sub: nextStage ? `Next: ${nextStage.label}` : "Send field update" },
    { k: "escalate" as const, icon: ArrowUp, label: "Escalate", sub: escalatedPending ? "Escalated" : "Need more help" },
    { k: "complete" as const, icon: CheckCircle2, label: "Complete Response", sub: a.status === "on_scene" ? "Close the job" : "When on scene" },
  ];

  return (
    <Card id="r-actions" className="scroll-mt-20 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">Quick Actions</p>
        <span className="text-[11px] text-slate-500 dark:text-muted">Seen by control room &amp; citizen</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((t) => (
          <button key={t.k} type="button" onClick={() => open(t.k)} aria-pressed={panel === t.k}
            className={cn("flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-4 text-center ring-1 transition hover:-translate-y-0.5",
              panel === t.k ? "bg-red-600 text-white ring-red-600 shadow-lg shadow-red-500/25" : "bg-red-50 text-red-600 ring-red-100 hover:bg-red-100 dark:bg-red-950/30 dark:ring-red-900/50",
              !active && "opacity-60")}>
            <t.icon className="size-6" strokeWidth={2.2} />
            <span className="text-[13px] leading-tight font-semibold">{t.label}</span>
            <span className={cn("text-[10px] leading-tight", panel === t.k ? "text-white/80" : "text-red-500/80")}>{t.sub}</span>
          </button>
        ))}
      </div>

      {escalatedPending && panel !== "escalate" && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900">
          <ShieldAlert className="size-4 shrink-0" />Escalated at {fmtTime(i.escalation!.at)} · control room alerted: {i.escalation!.reason}
        </p>
      )}

      {/* ---------- Update Status ---------- */}
      {panel === "update" && (
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-3.5 dark:border-line">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-muted">Stage</p>
            <div className="grid grid-cols-2 gap-2">
              {(["en_route", "on_scene"] as const).map((s) => {
                const done = ORDER.indexOf(a.status) >= ORDER.indexOf(s);
                const isNext = nextStage?.to === s;
                return (
                  <Button key={s} variant={isNext ? "primary" : "outline"} disabled={!isNext} loading={busy === s}
                    className={cn(isNext && "bg-red-600 shadow-none hover:bg-red-500")} icon={done ? CheckCircle2 : s === "en_route" ? Truck : MapPin}
                    onClick={() => run(s, () => assignmentStatus(a.id, s), s === "en_route" ? "Marked en route" : "Arrived on scene", `${i.id} · status updated everywhere`)}>
                    {s === "en_route" ? "En route" : "On scene"}
                  </Button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-muted">Field update</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <button key={t.k} type="button" onClick={() => setTag(t.k)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition", tag === t.k ? "bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900" : "bg-white text-slate-700 ring-slate-200 dark:bg-surface dark:text-fg dark:ring-line")}>{t.label}</button>
              ))}
            </div>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} className="min-h-16" placeholder="e.g. Fire contained to 2nd floor, 3 people evacuated" />
            <Button className="mt-2 w-full bg-red-600 shadow-none hover:bg-red-500" icon={Send} disabled={msg.trim().length < 3} loading={busy === "upd"}
              onClick={() => run("upd", () => fieldUpdate(a.id, msg.trim(), tag), "Update sent", "Control room and citizen can see it", () => setMsg(""))}>Send update</Button>
          </div>
        </div>
      )}

      {/* ---------- Escalate ---------- */}
      {panel === "escalate" && (
        <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 dark:border-amber-900 dark:bg-amber-950/20">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">What's wrong?</p>
            <div className="flex flex-wrap gap-1.5">
              {ESC_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition", reason === r ? "bg-amber-600 text-white ring-amber-600" : "bg-white text-slate-700 ring-amber-200 dark:bg-surface dark:text-fg dark:ring-amber-900")}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">Send more</p>
            <div className="grid grid-cols-4 gap-1.5">
              {NEEDS.map((n) => {
                const on = needs.includes(n.k);
                return (
                  <button key={n.k} type="button" onClick={() => setNeeds((x) => (on ? x.filter((y) => y !== n.k) : [...x, n.k]))}
                    className={cn("rounded-lg px-1 py-1.5 text-[11px] font-semibold ring-1 transition", on ? "bg-red-600 text-white ring-red-600" : "bg-white text-slate-700 ring-slate-200 dark:bg-surface dark:text-fg dark:ring-line")}>{n.label}</button>
                );
              })}
            </div>
          </div>
          <Textarea value={escNote} onChange={(e) => setEscNote(e.target.value)} className="min-h-14" placeholder="Optional details, e.g. 2 people trapped on 3rd floor" />
          <Button variant="danger" className="w-full" icon={ArrowUp} disabled={reason.length < 3} loading={busy === "esc"}
            onClick={() => run("esc", () => escalateAssignment(a.id, reason, needs, escNote.trim()), "Escalation sent", "Control room alerted — red alert on their screen", () => { setPanel(null); setEscNote(""); })}>
            Send escalation to control room
          </Button>
          <a href="tel:112" className="block text-center text-xs font-semibold text-red-700 underline dark:text-red-300">Life in danger right now? Call 112 as well</a>
        </div>
      )}

      {/* ---------- Complete Response ---------- */}
      {panel === "complete" && (
        a.status !== "on_scene" ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-surface-2 dark:text-muted">Mark <b>On scene</b> (Update Status) before completing the response.</p>
        ) : (
          <div className="mt-4 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/20">
            <Textarea value={closing} onChange={(e) => setClosing(e.target.value)} className="min-h-16" placeholder="Closing note (required) e.g. Fire out, 2 rescued, shifted to GH" />
            <Button className="w-full bg-emerald-600 shadow-none hover:bg-emerald-500" icon={CheckCircle2} disabled={closing.trim().length < 3} loading={busy === "done"}
              onClick={() => run("done", () => assignmentStatus(a.id, "completed", closing.trim()), "Response completed", "Control room will verify and close", () => setPanel(null))}>
              Complete response
            </Button>
          </div>
        )
      )}

      {myUpdates.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-line">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-muted">Your recent updates</p>
          <ul className="space-y-1.5">
            {myUpdates.map((e, k) => (
              <li key={k} className="flex gap-2 text-xs"><span className="shrink-0 font-mono text-slate-400">{fmtTime(e.at)}</span><span className="text-slate-700 dark:text-fg">{e.note.replace(`${a.team_name} · `, "").replace(`${a.team_name} `, "")}</span></li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function TeamCard({ team, busy }: { team: Team; busy: boolean }) {
  const crew = CREW[team.type] ?? 4;
  return (
    <Card id="r-team" className="scroll-mt-20 p-5">
      <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Team Status – {team.id}</p>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", busy || team.status === "busy" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300")}>
          <span className={cn("size-1.5 rounded-full", busy || team.status === "busy" ? "bg-red-500" : "bg-emerald-500")} />{busy || team.status === "busy" ? "On Mission" : "On Duty"}</span></div>
      <div className="space-y-2.5 text-sm">
        <Row icon={Users} k="Crew" v={`${crew}/${crew} present`} />
        <Row icon={Truck} k="Vehicle" v={plate(team.id)} />
        <Row icon={Wrench} k="Equipment" v={<span className="text-emerald-600">Ready</span>} />
        <Row icon={MapPin} k="Station" v={`${team.station} · ${team.type_label}`} />
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-surface-2 dark:text-muted">{EQUIP[team.type]}</p>
    </Card>
  );
}

function Row({ icon: Icon, k, v }: { icon: typeof Users; k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-slate-500 dark:text-muted"><Icon className="size-4" />{k}</span><span className="text-right font-semibold">{v}</span></div>;
}
function Detail({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs text-slate-500 dark:text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>;
}
function Kpi({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "green" }) {
  const c = { red: "text-red-600", amber: "text-amber-600", green: "text-emerald-600" }[tone];
  return <div className="rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200 dark:bg-surface dark:ring-line"><p className="text-[11px] whitespace-nowrap text-slate-500 dark:text-muted">{label}</p><p className={cn("font-display text-2xl font-bold", c)}>{value}</p></div>;
}
function SideItem({ icon: Icon, label, active, count, red, onClick }: { icon: typeof Users; label: string; active?: boolean; count?: number; red?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-full px-4 py-2.5 transition", active ? "bg-red-600 font-semibold text-white shadow-lg shadow-red-900/30" : "hover:bg-white/5 hover:text-white")}>
      <Icon className="size-4" /><span className="flex-1 text-left">{label}</span>
      {count != null && <span className={cn("rounded-full px-1.5 text-[11px] font-bold", red ? "bg-red-600 text-white" : "bg-white/10")}>{count}</span>}
    </button>
  );
}
function Tab({ icon: Icon, label, active, badge, onClick }: { icon: typeof Users; label: string; active?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "font-semibold text-red-600" : "text-slate-500 dark:text-muted")}>
      <Icon className="size-5" />{label}
      {!!badge && <span className="absolute top-1 right-[28%] grid size-4 place-items-center rounded-full bg-red-600 text-[9px] font-bold text-white">{badge}</span>}
    </button>
  );
}
