/** /app/zones — disaster zones & shelters. */
import { useEffect, useState } from "react";
import { BedDouble, Home, Map as MapIcon, Minus, Plus, RefreshCw, ShieldAlert, Siren, Users } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Input, Skeleton, StatTile, useToast } from "@/ui";
import { PageIntro } from "@/sections/AppShell";
import { LazyMap } from "@/sections/LazyMap";
import { ZONE_HEX } from "@/sections/IncidentUI";
import { errText, getIncidents, getShelters, getZones, updateShelter, updateZone } from "@/lib/resq";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/cn";
import type { Incident, Shelter, Zone, ZoneStatus } from "@/lib/mock";

const ZS: { value: ZoneStatus; label: string }[] = [
  { value: "critical", label: "Critical" }, { value: "evacuate", label: "Evacuate" }, { value: "watch", label: "Watch" }, { value: "safe", label: "Safe" },
];
const ZONE_PILL: Record<ZoneStatus, string> = {
  critical: "bg-red-600 text-white", evacuate: "bg-orange-500 text-white",
  watch: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", safe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

export default function Zones() {
  const [zones, reloadZones] = usePoll<Zone[]>(getZones);
  const [shelters, reloadShelters] = usePoll<Shelter[]>(getShelters);
  const [list] = usePoll<Incident[]>(() => getIncidents(), 10000);
  const reload = () => { reloadZones(); reloadShelters(); };

  const cap = (shelters ?? []).reduce((s, x) => s + x.capacity, 0);
  const occ = (shelters ?? []).reduce((s, x) => s + x.occupancy, 0);
  const pct = cap ? Math.round((occ / cap) * 100) : 0;
  const evac = (zones ?? []).filter((z) => z.status === "evacuate" || z.status === "critical").length;
  const points = (list ?? []).filter((i) => i.status !== "Resolved" && i.lat != null).map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, severity: i.severity, title: i.title }));

  return (
    <>
      <PageIntro title="Disaster zones & shelters" text="Mark areas for evacuation and track relief shelter capacity · live every 5 s"
        actions={<Button variant="outline" icon={RefreshCw} onClick={reload}>Refresh</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shelters && zones ? (<>
          <StatTile label="Total shelter capacity" value={cap} icon={Home} />
          <StatTile label="People sheltered" value={occ} icon={Users} className="[&_.font-display]:text-sky-600 dark:[&_.font-display]:text-sky-400" />
          <StatTile label="Shelters full" value={pct} suffix="%" icon={BedDouble} className={cn(pct >= 90 ? "[&_.font-display]:text-red-600" : pct >= 70 ? "[&_.font-display]:text-amber-600" : "[&_.font-display]:text-emerald-600")} />
          <StatTile label="Zones under evacuation" value={evac} icon={Siren} className={cn(evac > 0 && "border-orange-300 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/30 [&_.font-display]:text-orange-600")} />
        </>) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader title="Zone map" subtitle="Circles = zone status · houses = shelters · dots = open incidents" icon={MapIcon} />
          <CardBody>
            <LazyMap height={460} points={points}
              zones={(zones ?? []).map((z) => ({ id: z.id, lat: z.lat, lng: z.lng, status: z.status, label: z.area }))}
              shelters={(shelters ?? []).map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: s.name, pct: Math.round((s.occupancy / Math.max(1, s.capacity)) * 100) }))} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
              {ZS.map((z) => <span key={z.value} className="flex items-center gap-1.5"><span className="size-3 rounded-full border-2" style={{ borderColor: ZONE_HEX[z.value], background: `${ZONE_HEX[z.value]}33` }} />{z.label}</span>)}
              <span className="flex items-center gap-1.5"><span className="grid size-3.5 place-items-center rounded bg-sky-600" />Shelter</span>
            </div>
          </CardBody>
        </Card>
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Zones" subtitle="Worst first · change status and note" icon={ShieldAlert} />
          <CardBody className="max-h-[540px] space-y-2.5 overflow-auto">
            {!zones ? <Skeleton className="h-60" /> : zones.map((z) => <ZoneRow key={z.id} z={z} onSaved={reloadZones} />)}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 min-w-0">
        <CardHeader title="Relief shelters" subtitle="Occupancy updates instantly · red when 90% full" icon={Home} />
        <CardBody>
          {!shelters ? <Skeleton className="h-40" /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shelters.map((s) => <ShelterCard key={s.id} s={s} onSaved={reloadShelters} />)}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function ZoneRow({ z, onSaved }: { z: Zone; onSaved: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<ZoneStatus>(z.status);
  const [note, setNote] = useState(z.note);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) { setStatus(z.status); setNote(z.note); } }, [z.status, z.note, dirty]);

  async function save(st = status, nt = note) {
    setBusy(true);
    try { await updateZone(z.area, st, nt); toast(st === "evacuate" || st === "critical" ? "warning" : "success", `${z.area} → ${st}`, nt || undefined); setDirty(false); onSaved(); }
    catch (e) { toast("error", "Could not update zone", errText(e)); }
    finally { setBusy(false); }
  }
  return (
    <div className="rounded-xl border border-line p-3" style={{ borderLeft: `4px solid ${ZONE_HEX[z.status]}` }}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-semibold">{z.area}</p>
        <span className="text-xs text-muted">{z.open_incidents} open{z.critical_incidents ? <> · <b className="text-red-600 dark:text-red-400">{z.critical_incidents} critical</b></> : null}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {ZS.map((o) => (
          <button key={o.value} type="button" disabled={busy} onClick={() => { setStatus(o.value); save(o.value, note); }}
            className={cn("h-7 rounded-md text-xs font-medium ring-1 ring-line transition", status === o.value ? ZONE_PILL[o.value] + " ring-transparent" : "bg-surface-2 text-muted hover:text-fg")}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input className="h-8 text-xs" value={note} onChange={(e) => { setNote(e.target.value); setDirty(true); }} placeholder="Note e.g. Move to SH-2" />
        {dirty && <Button size="sm" loading={busy} onClick={() => save()}>Save</Button>}
      </div>
    </div>
  );
}

function ShelterCard({ s, onSaved }: { s: Shelter; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const pct = Math.round((s.occupancy / Math.max(1, s.capacity)) * 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-sky-500";
  async function change(d: number, key: string) {
    const next = Math.max(0, s.occupancy + d);
    if (next > s.capacity) { toast("warning", `${s.name} is full`, `Capacity ${s.capacity}. Send people to another shelter.`); return; }
    setBusy(key);
    try { await updateShelter(s.id, next); onSaved(); }
    catch (e) { toast("error", "Could not update shelter", errText(e)); }
    finally { setBusy(null); }
  }
  return (
    <div className={cn("min-w-0 rounded-xl border p-4", pct >= 90 ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Home className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{s.name}</p>
          <p className="text-xs text-muted">{s.id} · {s.area}</p>
        </div>
        {pct >= 90 && <Badge tone="red" dot pulse>Full soon</Badge>}
      </div>
      <div className="mt-3 flex items-baseline justify-between text-sm"><span><b className="font-display text-xl">{s.occupancy}</b><span className="text-muted"> / {s.capacity}</span></span><span className={cn("font-semibold", pct >= 90 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-sky-600")}>{pct}% full</span></div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {s.facilities.map((f) => <span key={f} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] capitalize text-muted ring-1 ring-line">{f}</span>)}
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" icon={Minus} loading={busy === "m"} disabled={s.occupancy <= 0} onClick={() => change(-10, "m")}>10</Button>
          <Button size="sm" variant="outline" icon={Plus} loading={busy === "p"} onClick={() => change(10, "p")}>10</Button>
        </div>
      </div>
    </div>
  );
}
