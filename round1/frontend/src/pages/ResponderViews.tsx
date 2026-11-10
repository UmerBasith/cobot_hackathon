/** Extra responder portal views (sidebar pages): assignments, team status, alerts, reports, resources, settings. */
import { Link } from "react-router-dom";
import { Bell, BarChart3, Boxes, CheckCircle2, ClipboardList, Clock, LogOut, MapPin, Settings, Truck, Users, Wrench } from "lucide-react";
import { Card, EmptyState } from "@/ui";
import { CATEGORY_META } from "@/sections/IncidentUI";
import { cn } from "@/lib/cn";
import { fmtTime } from "@/lib/format";
import { timeAgo } from "@/lib/resq";
import type { Alert, Assignment, Incident, ResponderJob, Team, TeamType } from "@/lib/mock";

export type RView = "dashboard" | "assignments" | "team" | "alerts" | "reports" | "resources" | "settings";

const CREW: Record<TeamType, number> = { fire: 6, ambulance_als: 4, ambulance_bls: 3, police: 4, ndrf: 8, boat: 4 };
const KIT: Record<TeamType, [string, number][]> = {
  fire: [["BA sets", 4], ["Hose reels", 3], ["Hydraulic cutter", 1], ["Extinguishers", 6], ["Ladder (10 m)", 1]],
  ambulance_als: [["Defibrillator", 1], ["Oxygen cylinders", 3], ["Ventilator", 1], ["Trauma kit", 2], ["Stretcher", 1]],
  ambulance_bls: [["Oxygen cylinders", 2], ["First-aid kit", 2], ["Stretcher", 1], ["Splints", 6]],
  police: [["Barricades", 10], ["Radio sets", 4], ["Traffic cones", 20], ["Torch", 4]],
  ndrf: [["Inflatable boats", 2], ["Life jackets", 30], ["Rope (100 m)", 4], ["Concrete cutter", 1], ["Search camera", 1]],
  boat: [["Life jackets", 20], ["Throw ropes", 6], ["Life buoys", 6], ["Outboard motor", 1]],
};
const ST: Record<string, string> = { assigned: "Awaiting response", accepted: "Accepted", rejected: "Rejected", en_route: "En route", on_scene: "On scene", completed: "Completed" };
const CHIP: Record<string, string> = {
  assigned: "bg-amber-100 text-amber-700", accepted: "bg-blue-100 text-blue-700", en_route: "bg-indigo-100 text-indigo-700",
  on_scene: "bg-violet-100 text-violet-700", completed: "bg-emerald-100 text-emerald-700", rejected: "bg-slate-200 text-slate-600",
};

function Head({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl bg-red-50 text-red-600"><Icon className="size-5" /></span>
      <div><h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><p className="text-sm text-slate-500 dark:text-muted">{text}</p></div>
    </div>
  );
}

function history(incidents: Incident[] | null, team: string) {
  const rows: { inc: Incident; a: Assignment }[] = [];
  for (const i of incidents ?? []) for (const a of i.assignments ?? []) if (a.team_id === team) rows.push({ inc: i, a });
  return rows.sort((x, y) => y.a.assigned_at.localeCompare(x.a.assigned_at));
}

export function AssignmentsView({ jobs, incidents, team, onOpen }: { jobs: ResponderJob[] | null; incidents: Incident[] | null; team: string; onOpen: () => void }) {
  const rows = history(incidents, team);
  return (
    <div className="space-y-5">
      <Head icon={ClipboardList} title="My Assignments" text="Active jobs first, then every job this team has handled" />
      <Card className="p-5">
        <p className="mb-3 font-semibold">Active now ({jobs?.length ?? 0})</p>
        {!jobs?.length ? <p className="text-sm text-slate-500">No active job — standing by.</p> : (
          <div className="space-y-2">{jobs.map((j) => <JobRow key={j.assignment.id} inc={j.incident} a={j.assignment} action={<button onClick={onOpen} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Open</button>} />)}</div>
        )}
      </Card>
      <Card className="p-5">
        <p className="mb-3 font-semibold">History ({rows.length})</p>
        {!rows.length ? <p className="text-sm text-slate-500">No past assignments yet.</p>
          : <div className="space-y-2">{rows.map(({ inc, a }) => <JobRow key={a.id} inc={inc} a={a} />)}</div>}
      </Card>
    </div>
  );
}

function JobRow({ inc, a, action }: { inc: Incident; a: Assignment; action?: React.ReactNode }) {
  const M = CATEGORY_META[inc.category];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-line">
      <span className={cn("grid size-9 place-items-center rounded-lg", M?.soft)}>{M && <M.icon className="size-4" />}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{inc.id} · {inc.title}</p>
        <p className="text-xs text-slate-500">{inc.area} · assigned {fmtTime(a.assigned_at)} · ETA {Math.round(a.eta_min)} min · {a.distance_km} km</p>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", CHIP[a.status])}>{ST[a.status]}</span>
      {action}
    </div>
  );
}

export function TeamView({ me, busy }: { me?: Team; busy: boolean }) {
  if (!me) return <Card className="p-6"><EmptyState icon={Users} title="Pick your team" text="Choose your team in the top bar." /></Card>;
  const crew = CREW[me.type] ?? 4;
  const names = ["A. Rahman", "K. Pradeep", "S. Vignesh", "M. Divya", "R. Arun", "P. Kavya", "J. Imran", "L. Nisha"].slice(0, crew);
  return (
    <div className="space-y-5">
      <Head icon={Users} title={`Team Status – ${me.id}`} text={`${me.name} · ${me.type_label}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Availability" value={busy ? "On mission" : me.status === "available" ? "Available" : me.status} tone={busy ? "red" : "green"} />
        <Stat label="Crew" value={`${crew}/${crew} present`} />
        <Stat label="Station" value={me.station} />
      </div>
      <Card className="p-5">
        <p className="mb-3 font-semibold">Crew on duty <span className="text-xs font-normal text-slate-400">· demo data</span></p>
        <div className="grid gap-2 sm:grid-cols-2">{names.map((n, k) => (
          <div key={n} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-line">
            <span className="text-sm font-medium">{n} <span className="text-xs text-slate-400">{k === 0 ? "Team lead" : "Responder"}</span></span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">On duty</span>
          </div>))}</div>
      </Card>
      <Card className="p-5">
        <p className="mb-2 font-semibold">Location</p>
        <p className="flex items-center gap-2 text-sm text-slate-600"><MapPin className="size-4 text-red-600" />{me.station} · {me.lat.toFixed(4)}, {me.lng.toFixed(4)}</p>
        {me.current_incident && <p className="mt-2 text-sm">Current incident: <b>{me.current_incident}</b></p>}
      </Card>
    </div>
  );
}

export function AlertsView({ alerts }: { alerts: Alert[] | null }) {
  const tone = { danger: "border-red-300 bg-red-50", warning: "border-amber-300 bg-amber-50", info: "border-blue-200 bg-blue-50" } as const;
  return (
    <div className="space-y-5">
      <Head icon={Bell} title="Alerts" text="Public safety alerts from the control room" />
      {!alerts?.length ? <Card className="p-6"><EmptyState icon={Bell} title="No active alerts" text="New alerts appear here automatically." /></Card>
        : alerts.map((a) => (
          <div key={a.id} className={cn("rounded-2xl border p-4 dark:bg-surface", tone[a.level])}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{a.level} · {a.area}</p>
            <p className="mt-1 font-semibold">{a.message}</p>
            <p className="mt-1 text-xs text-slate-500">Issued {timeAgo(a.created_at)} · expires {fmtTime(a.expires_at)}</p>
          </div>))}
    </div>
  );
}

export function ReportsView({ incidents, team }: { incidents: Incident[] | null; team: string }) {
  const rows = history(incidents, team);
  const done = rows.filter((r) => r.a.status === "completed");
  const rejected = rows.filter((r) => r.a.status === "rejected").length;
  const avgEta = rows.length ? (rows.reduce((s, r) => s + r.a.eta_min, 0) / rows.length).toFixed(1) : "—";
  return (
    <div className="space-y-5">
      <Head icon={BarChart3} title="Reports" text="This team's performance, from live assignment data" />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Jobs handled" value={String(rows.length)} />
        <Stat label="Completed" value={String(done.length)} tone="green" />
        <Stat label="Rejected" value={String(rejected)} tone={rejected ? "red" : undefined} />
        <Stat label="Avg ETA" value={`${avgEta} min`} />
      </div>
      <Card className="p-5">
        <p className="mb-3 font-semibold">Completed jobs with closing notes</p>
        {!done.length ? <p className="text-sm text-slate-500">No completed jobs yet.</p> : done.map(({ inc, a }) => (
          <div key={a.id} className="border-b border-slate-100 py-2 text-sm last:border-0 dark:border-line">
            <p className="font-semibold"><CheckCircle2 className="mr-1 inline size-4 text-emerald-600" />{inc.id} · {inc.title}</p>
            <p className="text-xs text-slate-500"><Clock className="mr-1 inline size-3" />{fmtTime(a.updated_at)} — {a.note || "No note"}</p>
          </div>))}
      </Card>
    </div>
  );
}

export function ResourcesView({ me }: { me?: Team }) {
  if (!me) return <Card className="p-6"><EmptyState icon={Boxes} title="Pick your team" text="Choose your team in the top bar." /></Card>;
  return (
    <div className="space-y-5">
      <Head icon={Boxes} title="Resources" text={`Vehicle and equipment of ${me.id} · demo data`} />
      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold"><Truck className="size-4 text-red-600" />Vehicle</p>
        <p className="text-sm">{me.type_label} · ready · fuel 85 %</p>
      </Card>
      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold"><Wrench className="size-4 text-red-600" />Equipment checklist</p>
        <div className="grid gap-2 sm:grid-cols-2">{(KIT[me.type] ?? []).map(([n, q]) => (
          <div key={n} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-line">
            <span>{n}</span><span className="font-semibold">× {q} <span className="ml-1 text-xs text-emerald-600">ready</span></span>
          </div>))}</div>
      </Card>
    </div>
  );
}

export function SettingsView({ teams, team, onPick, sound, setSound, onSignOut }: {
  teams: Team[] | null; team: string; onPick: (id: string) => void; sound: boolean; setSound: (v: boolean) => void; onSignOut: () => void;
}) {
  return (
    <div className="space-y-5">
      <Head icon={Settings} title="Settings" text="Your team and device preferences" />
      <Card className="space-y-4 p-5">
        <label className="block text-sm font-semibold">Team
          <select value={team} onChange={(e) => onPick(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-line dark:bg-surface">
            <option value="">Select team</option>
            {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.id} — {t.name}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between text-sm font-semibold">Alert sound for new dispatches
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="size-5 accent-red-600" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-line">Open control room</Link>
          <button onClick={onSignOut} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"><LogOut className="size-4" />Log out</button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-surface dark:ring-line">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("mt-1 font-display text-xl font-bold capitalize", tone === "red" && "text-red-600", tone === "green" && "text-emerald-600")}>{value}</p>
    </div>
  );
}
