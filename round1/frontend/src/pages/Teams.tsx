import { Link } from "react-router-dom";
import { CircleCheck, CircleDot, Map as MapIcon, RefreshCw, Truck, Users } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton, StatTile } from "@/ui";
import { PageIntro } from "@/sections/AppShell";
import { TeamIcon } from "@/sections/Dispatch";
import { LazyMap } from "@/sections/LazyMap";
import { SEV_HEX } from "@/sections/IncidentUI";
import { getIncidents, getTeams } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { useNavigate } from "react-router-dom";
import type { Incident, Team } from "@/lib/mock";

const ST_TONE = { available: "green", busy: "brand", offline: "gray" } as const;

export default function Teams() {
  const nav = useNavigate();
  const [teams, reloadTeams] = usePoll<Team[]>(getTeams);
  const [list] = usePoll<Incident[]>(() => getIncidents());
  const open = (list ?? []).filter((i) => i.status !== "Resolved" && i.lat != null);
  const points = open.map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, severity: i.severity, title: i.title }));
  const tpoints = (teams ?? []).map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, label: t.name, status: t.status }));
  const count = (s: Team["status"]) => (teams ?? []).filter((t) => t.status === s).length;

  return (
    <>
      <PageIntro title="Response teams" text="Fire, ambulance, police, NDRF and boats across Chennai · live every 5 s"
        actions={<>
          <Button variant="outline" icon={RefreshCw} onClick={reloadTeams}>Refresh</Button>
          <Link to="/responder"><Button icon={Truck}>Responder app</Button></Link>
        </>} />
      <div className="grid gap-4 sm:grid-cols-3">
        {teams ? (<>
          <StatTile label="Teams on roster" value={teams.length} icon={Users} />
          <StatTile label="Available now" value={count("available")} icon={CircleCheck} className="[&_.font-display]:text-emerald-600 dark:[&_.font-display]:text-emerald-400" />
          <StatTile label="Busy on incidents" value={count("busy")} icon={CircleDot} className="[&_.font-display]:text-brand-600 dark:[&_.font-display]:text-brand-400" />
        </>) : Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader title="Roster" subtitle="Status and current incident" icon={Users} />
          <CardBody>
            {!teams ? <Skeleton className="h-80" /> : (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                    <tr><th className="px-4 py-3 font-medium">Team</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Station</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Incident</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {teams.map((t) => (
                      <tr key={t.id} className="bg-surface hover:bg-surface-2/60">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><TeamIcon type={t.type} /><div><p className="font-medium">{t.name}</p><p className="font-mono text-xs text-muted">{t.id}</p></div></div></td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{t.type_label}</td>
                        <td className="px-4 py-2.5">{t.station}</td>
                        <td className="px-4 py-2.5"><Badge tone={ST_TONE[t.status]} dot pulse={t.status === "busy"}>{t.status}</Badge></td>
                        <td className="px-4 py-2.5">{t.current_incident ? <Link className="font-mono text-xs text-brand-600 hover:underline dark:text-brand-300" to={`/app/incidents/${t.current_incident}`}>{t.current_incident}</Link> : <span className="text-muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Teams & open incidents" subtitle="Diamonds = teams · dots = incidents" icon={MapIcon} />
          <CardBody>
            <LazyMap height={460} points={points} teams={tpoints} onSelect={(id) => nav(`/app/incidents/${id}`)} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
              <span className="flex items-center gap-1"><span className="size-2.5 rotate-45 rounded-[2px] bg-[#2563eb]" />Team available</span>
              <span className="flex items-center gap-1"><span className="size-2.5 rotate-45 rounded-[2px] bg-[#7c3aed]" />Team busy</span>
              <span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: SEV_HEX.Critical }} />Critical incident</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
