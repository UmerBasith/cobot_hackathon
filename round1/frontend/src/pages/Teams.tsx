import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, CircleCheck, CircleDot, Map as MapIcon, Navigation, Phone, PowerOff, RefreshCw, Repeat, Send, ShieldCheck, Siren, Truck, Users, Zap } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, RingGauge, Select, Skeleton, Tabs, useToast } from "@/ui";
import { TeamIcon } from "@/sections/Dispatch";
import { LazyMap } from "@/sections/LazyMap";
import { SEV_HEX } from "@/sections/IncidentUI";
import { assignTeams, errText, getIncidents, getTeams } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import type { Incident, Severity, Team } from "@/lib/mock";

export const ST_TONE = { available: "green", busy: "brand", offline: "gray" } as const;
export const ST_LABEL = { available: "Available", busy: "Deployed", offline: "Offline" } as const;
export const P_OF: Record<Severity, string> = { Critical: "P1", High: "P2", Medium: "P3", Low: "P4" };
const P_TONE = { Critical: "red", High: "amber", Medium: "blue", Low: "gray" } as const;
type Tab = "live" | "teams" | "personnel" | "vehicles" | "equipment" | "schedules";

function etaFor(i: Incident) {
  const live = i.assignments.filter((a) => a.status === "en_route" || a.status === "accepted" || a.status === "assigned");
  return live.length ? Math.min(...live.map((a) => a.eta_min)) : null;
}

export default function Teams() {
  const nav = useNavigate();
  const toast = useToast();
  const [teams, reloadTeams] = usePoll<Team[]>(getTeams);
  const [list, reloadList] = usePoll<Incident[]>(() => getIncidents());
  const [tab, setTab] = useState<Tab>("live");
  const [incId, setIncId] = useState("");
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const all = list ?? [];
  const open = all.filter((i) => i.status !== "Resolved");
  const points = open.filter((i) => i.lat != null).map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, severity: i.severity, title: i.title }));
  const tpoints = (teams ?? []).map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, label: t.name, status: t.status }));
  const count = (s: Team["status"]) => (teams ?? []).filter((t) => t.status === s).length;
  const enRoute = all.flatMap((i) => i.assignments).filter((a) => a.status === "en_route").length;
  const avail = (teams ?? []).filter((t) => t.status === "available");
  const ready = teams?.length ? Math.round(((teams.length - count("offline")) / teams.length) * 100) : 0;
  const selInc = incId || open[0]?.id || "";
  const etaByTeam = new Map<string, number>();
  all.forEach((i) => i.assignments.forEach((a) => { if (a.status !== "completed" && a.status !== "rejected") etaByTeam.set(a.team_id, a.eta_min); }));

  async function dispatch() {
    if (!selInc) { toast("warning", "Pick an incident", "No open incident selected."); return; }
    if (!pick.length) { toast("warning", "Pick at least one team", "Select available teams to dispatch."); return; }
    setBusy(true);
    try { await assignTeams(selInc, pick); toast("success", `Dispatched to ${selInc}`, `${pick.length} team(s) assigned`); setPick([]); reloadTeams(); reloadList(); }
    catch (e) { toast("error", "Dispatch failed", errText(e)); }
    finally { setBusy(false); }
  }

  const kpis = [
    { label: "Total Teams", v: teams?.length ?? 0, icon: Users, c: "text-ink" },
    { label: "Available", v: count("available"), icon: CircleCheck, c: "text-emerald-600 dark:text-emerald-400" },
    { label: "Deployed", v: count("busy"), icon: CircleDot, c: "text-brand-600 dark:text-brand-400" },
    { label: "En Route", v: enRoute, icon: Navigation, c: "text-amber-600 dark:text-amber-400" },
    { label: "Offline", v: count("offline"), icon: PowerOff, c: "text-muted" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Response Team <span className="text-red-600 dark:text-red-400">Management</span></h1>
          <p className="mt-1 text-sm text-muted">Live team tracking, dispatch and operational readiness</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={() => { reloadTeams(); reloadList(); }}>Refresh</Button>
          <Link to="/responder"><Button icon={Truck}>Responder app</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm">
            <span className="grid size-9 place-items-center rounded-xl bg-surface-2"><k.icon className={`size-4 ${k.c}`} /></span>
            <div><p className="text-xs text-muted">{k.label}</p><p className={`font-display text-xl font-semibold ${k.c}`}>{teams ? k.v : "–"}</p></div>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[
          { value: "live", label: "Live Operations" }, { value: "teams", label: "Teams" }, { value: "personnel", label: "Personnel" },
          { value: "vehicles", label: "Vehicles" }, { value: "equipment", label: "Equipment" }, { value: "schedules", label: "Schedules" },
        ]} />
      </div>

      {tab === "live" && (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="min-w-0 xl:col-span-2">
            <CardHeader title="Live Map" subtitle="Teams (diamonds) and open incidents (dots)" icon={MapIcon}
              action={<div className="flex gap-1.5"><Badge tone="brand">Live Map</Badge><Link to="/admin/zones"><Badge tone="gray">Zones</Badge></Link></div>} />
            <CardBody>
              <LazyMap height={400} points={points} teams={tpoints} onSelect={(id) => nav(`/admin/incidents/${id}`)} />
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                <span className="flex items-center gap-1"><span className="size-2.5 rotate-45 rounded-[2px] bg-[#2563eb]" />Available</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rotate-45 rounded-[2px] bg-[#7c3aed]" />Deployed</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rotate-45 rounded-[2px] bg-amber-500" />En Route</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rotate-45 rounded-[2px] bg-gray-400" />Offline</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: SEV_HEX.Critical }} />Critical incident</span>
              </div>
            </CardBody>
          </Card>

          <Card className="min-w-0">
            <CardHeader title={`Active Incidents (${open.length})`} subtitle="Priority · ETA of nearest team" icon={Siren} />
            <CardBody className="max-h-[470px] space-y-2 overflow-y-auto">
              {!list ? <Skeleton className="h-60" /> : open.length === 0 ? <p className="text-sm text-muted">No open incidents.</p> : open.slice(0, 12).map((i) => {
                const eta = etaFor(i);
                return (
                  <Link key={i.id} to={`/admin/incidents/${i.id}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-surface-2/60">
                    <Badge tone={P_TONE[i.severity]}>{P_OF[i.severity]}</Badge>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.title}</p><p className="truncate text-xs text-muted">{i.id} · {i.area}</p></div>
                    <span className="whitespace-nowrap text-xs text-muted">{eta != null ? `ETA ${eta} min` : "unassigned"}</span>
                    <ArrowRight className="size-4 text-muted" />
                  </Link>
                );
              })}
            </CardBody>
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Dispatch Controls" subtitle="Assign available teams to an incident" icon={Send} />
            <CardBody className="space-y-3">
              <label className="block text-xs font-medium text-muted">Select Incident
                <Select className="mt-1 w-full" value={selInc} onChange={(e) => setIncId(e.target.value)}
                  options={open.length ? open.map((i) => ({ value: i.id, label: `${P_OF[i.severity]} · ${i.id} · ${i.title}`.slice(0, 60) })) : [{ value: "", label: "No open incidents" }]} />
              </label>
              <div>
                <p className="text-xs font-medium text-muted">Assign Teams ({avail.length} available)</p>
                <div className="mt-1 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {avail.length === 0 && <p className="text-xs text-muted">No teams available right now.</p>}
                  {avail.map((t) => {
                    const on = pick.includes(t.id);
                    return (
                      <button key={t.id} type="button" onClick={() => setPick(on ? pick.filter((x) => x !== t.id) : [...pick, t.id])}
                        className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-surface-2 text-ink ring-line hover:ring-brand-400"}`}>
                        {t.id}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" icon={Send} onClick={dispatch} disabled={busy}>{busy ? "Dispatching…" : "Dispatch Team"}</Button>
                <Button variant="outline" icon={Repeat} onClick={() => selInc && nav(`/admin/incidents/${selInc}`)}>Reassign</Button>
              </div>
            </CardBody>
          </Card>

          <Card className="min-w-0 xl:col-span-2">
            <CardHeader title="Response Teams Overview" subtitle="Click a team for details" icon={Users} />
            <CardBody>
              {!teams ? <Skeleton className="h-60" /> : <TeamTable teams={teams} eta={etaByTeam} onOpen={(id) => nav(`/admin/teams/${id}`)} />}
            </CardBody>
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Team Readiness" subtitle="Share of teams not offline" icon={ShieldCheck} />
            <CardBody className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col">
              <RingGauge value={ready} label="ready" sub={`${teams?.length ?? 0} teams`} />
              <div className="w-full space-y-2 text-sm">
                <p className="flex justify-between"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" />Available</span><b>{count("available")}</b></p>
                <p className="flex justify-between"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-brand-500" />Deployed</span><b>{count("busy")}</b></p>
                <p className="flex justify-between"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-gray-400" />Offline</span><b>{count("offline")}</b></p>
              </div>
            </CardBody>
          </Card>

          <Card className="min-w-0 xl:col-span-2">
            <CardHeader title="Quick Actions" icon={Zap} />
            <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button icon={Send} onClick={dispatch}>Dispatch Team</Button>
              <a href="tel:112"><Button className="w-full" variant="outline" icon={Phone}>Call Team</Button></a>
              <Button variant="outline" icon={Repeat} onClick={() => selInc && nav(`/admin/incidents/${selInc}`)}>Reassign</Button>
              <Link to="/admin/alerts"><Button className="w-full" variant="outline" icon={Bell}>Broadcast Alert</Button></Link>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "teams" && (
        <Card className="mt-4"><CardHeader title="All teams" subtitle="Click a team for details" icon={Users} />
          <CardBody>{!teams ? <Skeleton className="h-60" /> : <TeamTable teams={teams} eta={etaByTeam} onOpen={(id) => nav(`/admin/teams/${id}`)} />}</CardBody></Card>
      )}

      {tab !== "live" && tab !== "teams" && (
        <Card className="mt-4">
          <CardHeader title={{ personnel: "Personnel", vehicles: "Vehicles", equipment: "Equipment", schedules: "Schedules" }[tab]} subtitle="demo data" icon={Users} />
          <CardBody className="divide-y divide-line">
            {(teams ?? []).slice(0, 8).map((t, k) => (
              <button key={t.id} onClick={() => nav(`/admin/teams/${t.id}`)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-brand-600">
                <span className="flex items-center gap-2.5"><TeamIcon type={t.type} />{t.name}</span>
                <span className="text-muted">{tab === "personnel" ? `${5 + (k % 4)}/8 on duty` : tab === "vehicles" ? `TN-0${(k % 9) + 1}-G-${4100 + k * 37}` : tab === "equipment" ? `${92 - (k % 5) * 3}% serviceable` : k % 2 ? "Shift B · 14:00–22:00" : "Shift A · 06:00–14:00"}</span>
              </button>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}

function TeamTable({ teams, eta, onOpen }: { teams: Team[]; eta: Map<string, number>; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr><th className="px-4 py-3 font-medium">Team</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Capacity</th><th className="px-4 py-3 font-medium">Location / ETA</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {teams.map((t) => (
            <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer bg-surface hover:bg-surface-2/60">
              <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><TeamIcon type={t.type} /><div><p className="font-medium">{t.name}</p><p className="font-mono text-xs text-muted">{t.id}</p></div></div></td>
              <td className="whitespace-nowrap px-4 py-2.5">{t.type_label}</td>
              <td className="px-4 py-2.5"><Badge tone={ST_TONE[t.status]} dot pulse={t.status === "busy"}>{ST_LABEL[t.status]}</Badge></td>
              <td className="whitespace-nowrap px-4 py-2.5">{crewOf(t.id)} crew</td>
              <td className="px-4 py-2.5">{eta.has(t.id) ? <span className="text-amber-600 dark:text-amber-400">{t.current_incident ?? "En route"} · ETA {eta.get(t.id)} min</span> : <span className="text-muted">{t.station}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function hashId(id: string) { let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
export function crewOf(id: string) { return 4 + (hashId(id) % 5); }
