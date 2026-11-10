/** Round 2: Dispatch card (suggest → assign), assignments list, possible duplicates. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ambulance, Anchor, Check, Copy, Flame, Link2, Shield, Timer, Truck, Users, type LucideIcon } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton, useToast } from "@/ui";
import { cn } from "@/lib/cn";
import { assignTeams, errText, getSimilar, getSuggest, markDuplicate } from "@/lib/resq";
import type { AssignmentStatus, Incident, Similar, SuggestSlot, TeamType } from "@/lib/mock";
import { SeverityBadge } from "./IncidentUI";

export const TEAM_ICON: Record<TeamType, LucideIcon> = {
  fire: Flame, ambulance_als: Ambulance, ambulance_bls: Ambulance, police: Shield, ndrf: Users, boat: Anchor,
};
export const ASG_META: Record<AssignmentStatus, { label: string; tone: "gray" | "amber" | "blue" | "green" | "red" | "brand" }> = {
  assigned: { label: "Awaiting accept", tone: "amber" },
  accepted: { label: "Accepted", tone: "blue" },
  rejected: { label: "Rejected", tone: "red" },
  en_route: { label: "En route", tone: "brand" },
  on_scene: { label: "On scene", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
};

export function TeamIcon({ type, className }: { type: TeamType; className?: string }) {
  const I = TEAM_ICON[type] ?? Truck;
  return <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300", className)}><I className="size-4" /></span>;
}

const SLOT_TYPES: Record<string, TeamType[]> = {
  "Rescue boat": ["boat", "ndrf"], Ambulance: ["ambulance_als", "ambulance_bls"], "Fire engine": ["fire"],
  Police: ["police"], "NDRF rescue": ["ndrf", "fire"],
};

export function DispatchCard({ inc, onChange }: { inc: Incident; onChange: () => void }) {
  const toast = useToast();
  const [slots, setSlots] = useState<SuggestSlot[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const activeIds = inc.assignments.filter((a) => !["rejected", "completed"].includes(a.status)).map((a) => a.team_id);
  const sig = `${inc.id}|${inc.status}|${inc.assignments.map((a) => a.id + a.status).join(",")}`;

  useEffect(() => { let on = true; getSuggest(inc).then((s) => on && setSlots(s)); return () => { on = false; }; }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  async function assign(ids: string[], key: string) {
    if (!ids.length) return;
    setBusy(key);
    try { await assignTeams(inc.id, ids); toast("success", `Dispatched ${ids.length} team${ids.length > 1 ? "s" : ""}`, `${inc.id} → In Progress`); onChange(); }
    catch (e) { toast("error", "Could not assign", errText(e)); }
    finally { setBusy(null); }
  }

  const active = inc.assignments.filter((a) => !["rejected", "completed"].includes(a.status));
  const coveredBy = (s: SuggestSlot) => {
    const types = new Set<TeamType>([...(SLOT_TYPES[s.slot] ?? []), ...s.candidates.map((c) => c.team.type)]);
    return active.find((a) => types.has(a.team_type));
  };
  const bestIds = (slots ?? []).filter((s) => !coveredBy(s)).map((s) => s.best).filter((x): x is string => !!x && !activeIds.includes(x));
  const resolved = inc.status === "Resolved";

  return (
    <Card className={cn(!resolved && inc.assignments.length === 0 && (inc.severity === "Critical" || inc.severity === "High") && "ring-2 ring-red-300 dark:ring-red-900")}>
      <CardHeader title="Dispatch" subtitle="Right team per need, ranked by ETA" icon={Truck}
        action={inc.assignments.length ? <Badge tone="blue" className="whitespace-nowrap">{activeIds.length} active</Badge> : !resolved ? <Badge tone="red" dot pulse className="whitespace-nowrap">Unassigned</Badge> : undefined} />
      <CardBody className="space-y-4">
        {!resolved && (
          <>
            {!slots ? <Skeleton className="h-28" /> : slots.length === 0 ? <p className="text-sm text-muted">No suggestion for this category.</p> : (
              <div className="space-y-3">
                {slots.map((s) => { const cov = coveredBy(s); return cov ? (
                  <div key={s.slot} className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <TeamIcon type={cov.team_type} />
                    <div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-wider text-muted">{s.slot}</p><p className="truncate text-sm font-medium">{cov.team_name}</p></div>
                    <Badge tone="green"><Check className="size-3" />Covered</Badge>
                  </div>
                ) : (
                  <div key={s.slot} className="rounded-xl border border-line p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{s.slot}</p>
                    {s.candidates.length === 0 && <p className="text-sm text-red-600 dark:text-red-400">No {s.slot.toLowerCase()} available — shortage</p>}
                    <div className="space-y-1.5">
                      {s.candidates.map((c) => {
                        const isBest = c.team.id === s.best; const on = activeIds.includes(c.team.id);
                        return (
                          <div key={c.team.id} className={cn("flex items-center gap-2.5 rounded-lg p-1.5", isBest && "bg-brand-50/70 dark:bg-brand-900/20")}>
                            <TeamIcon type={c.team.type} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{c.team.name}{isBest && <span className="ml-1.5 text-[10px] font-semibold uppercase text-brand-600 dark:text-brand-300">best</span>}</p>
                              <p className="flex items-center gap-1 text-xs text-muted"><Timer className="size-3" />{Math.round(c.eta_min)} min · {c.distance_km} km</p>
                            </div>
                            {on ? <Badge tone="green"><Check className="size-3" />Assigned</Badge>
                              : <Button size="sm" variant={isBest ? "primary" : "outline"} loading={busy === c.team.id} onClick={() => assign([c.team.id], c.team.id)}>Assign</Button>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ); })}
              </div>
            )}
            {bestIds.length > 0 && (
              <Button className="w-full" icon={Truck} loading={busy === "all"} onClick={() => assign(bestIds, "all")}>
                Assign all suggested ({bestIds.length})
              </Button>
            )}
          </>
        )}
        {inc.assignments.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Assignments</p>
            <div className="space-y-1.5">
              {inc.assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-lg bg-surface-2 p-2">
                  <TeamIcon type={a.team_type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.team_name}</p>
                    <p className="truncate text-xs text-muted">{a.id} · ETA {Math.round(a.eta_min)} min{a.reject_reason ? ` · “${a.reject_reason}”` : a.note ? ` · ${a.note}` : ""}</p>
                  </div>
                  <Badge tone={ASG_META[a.status].tone} dot pulse={a.status === "en_route"}>{ASG_META[a.status].label}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        {resolved && inc.assignments.length === 0 && <p className="text-sm text-muted">Incident resolved — no dispatch needed.</p>}
      </CardBody>
    </Card>
  );
}

export function SimilarCard({ inc, onChange }: { inc: Incident; onChange: () => void }) {
  const toast = useToast();
  const [list, setList] = useState<Similar[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => getSimilar(inc.id).then(setList);
  useEffect(() => { load(); }, [inc.id, inc.witnesses]); // eslint-disable-line react-hooks/exhaustive-deps

  async function link(s: Similar) {
    setBusy(s.id);
    try { await markDuplicate(s.id, inc.id); toast("success", `${s.id} linked as duplicate`, `${inc.id} gains a witness (+3)`); await load(); onChange(); }
    catch (e) { toast("error", "Could not link", errText(e)); }
    finally { setBusy(null); }
  }
  const open = (list ?? []).filter((s) => s.status !== "Resolved");
  return (
    <Card>
      <CardHeader title="Possible duplicates" subtitle="Within 500 m and 60 min, related type" icon={Copy}
        action={open.length ? <Badge tone="amber">{open.length}</Badge> : undefined} />
      <CardBody className="space-y-2">
        {!list ? <Skeleton className="h-14" /> : open.length === 0 ? (
          <p className="text-sm text-muted">No similar open reports nearby.</p>
        ) : open.map((s) => (
          <div key={s.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Link to={`/admin/incidents/${s.id}`} className="block truncate text-sm font-medium hover:underline">{s.title}</Link>
                <p className="text-xs text-muted">{s.id} · {Math.round(s.distance_m)} m away · {Math.round(s.minutes_apart)} min apart</p>
              </div>
              <SeverityBadge severity={s.severity} />
            </div>
            <Button size="sm" variant="outline" icon={Link2} className="mt-2 w-full" loading={busy === s.id} onClick={() => link(s)}>Link as duplicate of {inc.id}</Button>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
