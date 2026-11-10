import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Activity, ArrowLeft, Award, Clock, History, Search, Send, Settings2, ShieldCheck, Truck, Users, Wrench } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Input, Select, Skeleton, Tabs, useToast } from "@/ui";
import { TeamIcon } from "@/sections/Dispatch";
import { assignTeams, errText, getIncidents, getTeams } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import type { Incident, Team, TeamStatus } from "@/lib/mock";
import { P_OF, ST_LABEL, ST_TONE, hashId } from "@/pages/Teams";

const FIRST = ["Arun", "Priya", "Karthik", "Divya", "Suresh", "Meena", "Vignesh", "Lakshmi", "Rajesh", "Anitha"];
const LAST = ["Kumar", "Raman", "Subramanian", "Iyer", "Pillai", "Natarajan", "Babu", "Selvam"];
const ROLES = ["Team Leader", "Senior Responder", "Paramedic", "Driver-Operator", "Rescue Specialist"];
type Tab = "overview" | "mgmt" | "shift" | "certs" | "perf";

function demo(t: Team) {
  const h = hashId(t.id);
  const people = Array.from({ length: 3 }, (_, k) => ({ name: `${FIRST[(h + k * 3) % FIRST.length]} ${LAST[((h >> 3) + k) % LAST.length]}`, role: ROLES[k === 0 ? 0 : 1 + ((h + k) % (ROLES.length - 1))] }));
  const onDuty = 5 + (h % 4);
  return {
    people, onDuty, total: 8,
    vehicles: [`TN-0${(h % 9) + 1}-G-${1000 + (h % 8000)}`, `TN-0${((h >> 2) % 9) + 1}-AB-${2000 + ((h >> 4) % 7000)}`],
    equip: [{ k: "BA sets", v: 4 + (h % 4) }, { k: "Ladders", v: 2 + (h % 2) }, { k: "Hose reels", v: 3 + ((h >> 1) % 3) }, { k: "Extinguishers", v: 6 + ((h >> 2) % 5) }],
    certs: [{ k: "First Aid & CPR", y: 2027 }, { k: "Hazmat Level II", y: 2027 }, { k: "Swift-water Rescue", y: 2028 }, { k: "Incident Command (ICS-200)", y: 2028 }].map((c, i) => ({ ...c, m: ((h >> i) % 12) + 1 })),
    rating: (4.2 + (h % 7) / 10).toFixed(1),
  };
}

export default function TeamDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [teams] = usePoll<Team[]>(getTeams);
  const [list, reloadList] = usePoll<Incident[]>(() => getIncidents());
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [stSel, setStSel] = useState("");
  const [deployTo, setDeployTo] = useState("");
  const [showDeploy, setShowDeploy] = useState(false);

  const team = teams?.find((t) => t.id === id) ?? teams?.[0];
  const d = useMemo(() => (team ? demo(team) : null), [team]);
  const open = (list ?? []).filter((i) => i.status !== "Resolved");
  const history = (list ?? []).flatMap((i) => i.assignments.filter((a) => a.team_id === team?.id).map((a) => ({ a, i })))
    .sort((x, y) => y.a.assigned_at.localeCompare(x.a.assigned_at));
  const avgEta = history.length ? (history.reduce((s, h) => s + h.a.eta_min, 0) / history.length).toFixed(1) : "—";
  const sla = history.length ? Math.round((history.filter((h) => h.a.eta_min <= 15).length / history.length) * 100) : 100;
  const shown = (teams ?? []).filter((t) => (t.id + t.name + t.type_label).toLowerCase().includes(q.toLowerCase()));

  if (!teams || !team || !d) return <Skeleton className="h-[600px] rounded-2xl" />;
  const status = localStatus[team.id] ?? ST_LABEL[team.status];
  const tone = (status === "Available" || status === "Ready") ? "green" : status === "Offline" ? "gray" : status === "Maintenance" ? "amber" : "brand";
  const readiness = Math.round((d.onDuty / d.total) * 100);

  function setLocal(s: string) { setLocalStatus({ ...localStatus, [team!.id]: s }); toast("success", `${team!.id} → ${s}`, "Demo control · local only"); }
  async function deploy() {
    const target = deployTo || open[0]?.id;
    if (!target) { toast("warning", "No open incident", "Nothing to deploy to."); return; }
    try { await assignTeams(target, [team!.id]); toast("success", `${team!.id} deployed`, `Assigned to ${target}`); setShowDeploy(false); reloadList(); }
    catch (e) { toast("error", "Deploy failed", errText(e)); }
  }

  const tiles = [
    { k: "Personnel", v: `${d.onDuty}/${d.total}`, icon: Users },
    { k: "Vehicles", v: `${d.vehicles.length}`, icon: Truck },
    { k: "Equipment", v: `${d.equip.reduce((s, e) => s + e.v, 0)}`, icon: Wrench },
    { k: "Certifications", v: `${d.certs.length}`, icon: Award },
    { k: "Readiness", v: `${readiness}%`, icon: ShieldCheck },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="min-w-0 self-start">
        <CardHeader title={`All Teams (${teams.length})`} icon={Users} />
        <CardBody className="space-y-2">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="w-full pl-9" placeholder="Search teams" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-[560px] space-y-1 overflow-y-auto">
            {shown.map((t) => (
              <button key={t.id} onClick={() => nav(`/admin/teams/${t.id}`)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm ${t.id === team.id ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30" : "hover:bg-surface-2"}`}>
                <TeamIcon type={t.type} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{t.name}</span><span className="font-mono text-xs text-muted">{t.id}</span></span>
                <span className={`size-2 rounded-full ${t.status === "available" ? "bg-emerald-500" : t.status === "busy" ? "bg-brand-500" : "bg-gray-400"}`} />
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/admin/teams" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-brand-600"><ArrowLeft className="size-3" />Team management</Link>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{team.id} — {team.type_label}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{team.name} · {team.station} <Badge tone={tone} dot>{status}</Badge></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select className="w-40" value={stSel || status} onChange={(e) => setStSel(e.target.value)}
              options={["Available", "Ready", "Deployed", "Maintenance", "Offline"].map((s) => ({ value: s, label: s }))} />
            <Button variant="outline" onClick={() => setLocal(stSel || status)}>Update Status</Button>
            <Button className="bg-red-600 hover:bg-red-700" icon={Send} onClick={() => setShowDeploy(!showDeploy)}>Deploy Team</Button>
          </div>
        </div>
        {showDeploy && (
          <Card><CardBody className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Deploy {team.id} to</span>
            <Select className="min-w-0 flex-1" value={deployTo || open[0]?.id || ""} onChange={(e) => setDeployTo(e.target.value)}
              options={open.length ? open.map((i) => ({ value: i.id, label: `${P_OF[i.severity]} · ${i.id} · ${i.title}`.slice(0, 60) })) : [{ value: "", label: "No open incidents" }]} />
            <Button className="bg-red-600 hover:bg-red-700" icon={Send} onClick={deploy}>Confirm</Button>
          </CardBody></Card>
        )}

        <div className="overflow-x-auto"><Tabs<Tab> value={tab} onChange={setTab} tabs={[
          { value: "overview", label: "Teams Overview" }, { value: "mgmt", label: "Team Management" }, { value: "shift", label: "Shift & Roster" },
          { value: "certs", label: "Certifications" }, { value: "perf", label: "Performance" }]} /></div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.k} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs text-muted"><t.icon className="size-3.5" />{t.k}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{t.v}</p>
            </div>
          ))}
        </div>
        <p className="-mt-2 text-right text-[11px] text-muted">Personnel, vehicles, equipment and certifications: demo data</p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(tab === "overview" || tab === "mgmt" || tab === "shift") && (
            <Card><CardHeader title="Personnel" subtitle="demo data" icon={Users} /><CardBody className="space-y-2.5">
              {d.people.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{p.name.split(" ").map((x) => x[0]).join("")}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-muted">{p.role}</p></div>
                  <Badge tone="green">On Duty</Badge>
                </div>
              ))}
            </CardBody></Card>
          )}
          {(tab === "overview" || tab === "shift") && (
            <Card><CardHeader title="Shift & Availability" icon={Clock} /><CardBody className="space-y-3 text-sm">
              <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">Current shift</p><p className="font-medium">Shift A · 06:00 – 14:00</p></div>
              <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">Next shift</p><p className="font-medium">Shift B · 14:00 – 22:00</p></div>
              <p className="text-xs text-muted">{d.onDuty} of {d.total} crew on duty</p>
            </CardBody></Card>
          )}
          {(tab === "overview" || tab === "certs") && (
            <Card><CardHeader title="Certifications" subtitle="demo data" icon={Award} /><CardBody className="space-y-2 text-sm">
              {d.certs.map((c) => (
                <div key={c.k} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-500" />{c.k}</span><span className="whitespace-nowrap text-xs text-muted">valid till {String(c.m).padStart(2, "0")}/{c.y}</span></div>
              ))}
            </CardBody></Card>
          )}
          {(tab === "overview" || tab === "mgmt") && (
            <Card><CardHeader title="Vehicles" subtitle="demo data" icon={Truck} /><CardBody className="space-y-2 text-sm">
              {d.vehicles.map((v, i) => (
                <div key={v} className="flex items-center justify-between rounded-xl border border-line px-3 py-2"><span className="font-mono">{v}</span><Badge tone={i === 0 ? "green" : "gray"}>{i === 0 ? "Primary" : "Standby"}</Badge></div>
              ))}
            </CardBody></Card>
          )}
          {(tab === "overview" || tab === "mgmt") && (
            <Card><CardHeader title="Equipment" subtitle="demo data" icon={Wrench} /><CardBody className="grid grid-cols-2 gap-2">
              {d.equip.map((e) => (<div key={e.k} className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{e.k}</p><p className="font-display text-xl font-semibold">{e.v}</p></div>))}
            </CardBody></Card>
          )}
          {(tab === "overview" || tab === "perf") && (
            <Card><CardHeader title="Performance" subtitle="From live assignments" icon={Activity} /><CardBody className="grid grid-cols-2 gap-2">
              {[["Incidents handled", String(history.length)], ["Avg ETA", `${avgEta} min`], ["SLA compliance", `${sla}%`], ["Rating", `${d.rating} / 5`]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{k}</p><p className="font-display text-xl font-semibold">{v}</p></div>
              ))}
            </CardBody></Card>
          )}
          {(tab === "overview" || tab === "perf") && (
            <Card className="md:col-span-2"><CardHeader title="Assignment History" subtitle={`${history.length} assignments`} icon={History} /><CardBody className="space-y-2">
              {history.length === 0 ? <p className="text-sm text-muted">No assignments yet for this team.</p> : history.slice(0, 6).map(({ a, i }) => (
                <Link key={a.id} to={`/admin/incidents/${i.id}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface-2/60">
                  <Badge tone={i.severity === "Critical" ? "red" : i.severity === "High" ? "amber" : "blue"}>{P_OF[i.severity]}</Badge>
                  <span className="min-w-0 flex-1 truncate">{i.title}</span>
                  <span className="whitespace-nowrap text-xs text-muted">{a.status.replace("_", " ")} · {a.eta_min} min</span>
                </Link>
              ))}
            </CardBody></Card>
          )}
          {(tab === "overview" || tab === "mgmt") && (
            <Card><CardHeader title="Team Controls" subtitle="demo · local only" icon={Settings2} /><CardBody className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setLocal("Ready")}>Set Ready</Button>
              <Button variant="outline" onClick={() => setLocal("Deployed")}>On Deployment</Button>
              <Button variant="outline" onClick={() => setLocal("Maintenance")}>Maintenance</Button>
              <Button variant="outline" onClick={() => setLocal("Offline")}>Mark Offline</Button>
            </CardBody></Card>
          )}
        </div>
      </div>
    </div>
  );
}
